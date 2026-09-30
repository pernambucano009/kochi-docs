// StudioMania — الخطوة 2: توليد فيديوهات بـ Seedance

const PROMPT_KEY = "studiomania.promptId";
const AUDIO_KEY = "studiomania.audio";
const ACTIVE = new Set(["queued", "uploading", "submitted", "processing", "downloading"]);
const STATUS_LABEL = {
  queued: "في الطابور",
  uploading: "بيرفع الملفات",
  submitted: "اتبعت لـ Seedance",
  processing: "Seedance بيولّد",
  downloading: "بيحمّل الفيديو",
  completed: "جاهز",
  failed: "فشل",
};

const gen = {
  atlas: null, clips: [], selected: new Set(), list: [], timer: null, prompts: [], promptId: null, editing: null,
  coaches: new Map(), archive: new Map(), viewArchive: null, show: new Set(),
};

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

async function initGenerate() {
  if (!gen.atlas) {
    gen.atlas = await api("/api/atlas");
    const a = gen.atlas;
    $("fixedSettings").innerHTML = [a.model_label, a.resolution, a.ratio, "المدة على قد القطعة"]
      .map((t) => `<span class="pill">${t}</span>`).join("");
    $("audioCheck").checked = storageGet(AUDIO_KEY) === "1";
    gen.promptId = storageGet(PROMPT_KEY);
  }
  const alert = $("atlasAlert");
  alert.hidden = gen.atlas.configured || gen.atlas.mock;
  alert.innerHTML = `⚠️ مفتاح Atlas مش متسجل. حطه من <a href="#" data-goto="settings">⚙️ الإعدادات</a>.`;

  const [coaches, clips] = await Promise.all([api("/api/coaches"), api("/api/clips"), loadPrompts(), loadArchive()]);
  gen.coaches = new Map(coaches.map((c) => [c.id, c]));
  gen.clips = clips;
  const ids = new Set(clips.map((c) => c.id));
  gen.selected = new Set([...gen.selected].filter((id) => ids.has(id)));
  if (gen.pending) {
    // جاي من التقطيع أو من المشروع: نعلّم على قطع الفيديو ده
    const { videoId } = gen.pending;
    gen.pending = null;
    gen.show.add(videoId); // يظهر حتى لو في الأرشيف
    const mine = clips.filter((c) => c.video_id === videoId && c.duration >= MIN_REF);
    const coach = gen.coaches.get(mine[0]?.video_coach_id);
    if (coach) mine.forEach((c) => gen.selected.add(c.id));
    toast(coach ? `✅ اتعلّم على ${mine.length} قطعة · المدرب: ${coach.name}` : "⚠️ المشروع ده مفيهوش مدرب. اختاره من صفحة المشاريع", !coach);
    setTimeout(() => document.querySelector(`.clip-group[data-vid="${videoId}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 200);
  }
  renderClipPicker();
  await loadGenerations();
}

$("audioCheck").addEventListener("change", () => storageSet(AUDIO_KEY, $("audioCheck").checked ? "1" : "0"));

// ---------- مكتبة البرومبتات ----------
async function loadPrompts() {
  gen.prompts = await api("/api/prompts");
  if (!gen.prompts.some((p) => p.id === gen.promptId)) {
    gen.promptId = (gen.prompts.find((p) => p.is_default) || gen.prompts[0])?.id || null;
  }
  renderPrompts();
}

function renderPrompts() {
  $("promptList").innerHTML = gen.prompts
    .map(
      (p) => `<div class="prompt-item ${p.id === gen.promptId ? "selected" : ""}" data-id="${p.id}">
        <div class="top">
          <span>${p.id === gen.promptId ? "🔘" : "⚪"}</span>
          <span class="name">${escapeHtml(p.name)}</span>
          ${p.is_default ? `<span class="pill">الافتراضي</span>` : ""}
          <span class="acts">
            <button class="btn sm" data-act="edit" title="تعديل">✎</button>
            <button class="btn sm danger" data-act="delete" title="حذف">✕</button>
          </span>
        </div>
        <div class="text">${escapeHtml(p.text)}</div>
      </div>`
    )
    .join("");
  updateGenerateBtn();
}

function openPromptForm(p = null) {
  gen.editing = p;
  $("promptName").value = p?.name || "";
  $("promptText").value = p?.text || "";
  $("promptDefault").checked = !!p?.is_default;
  $("promptForm").hidden = false;
  $("promptName").focus();
}
function closePromptForm() {
  gen.editing = null;
  $("promptForm").hidden = true;
}

$("newPrompt").onclick = () => openPromptForm();
$("promptCancel").onclick = closePromptForm;

$("promptForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = JSON.stringify({
    name: $("promptName").value,
    text: $("promptText").value,
    is_default: $("promptDefault").checked,
  });
  try {
    const saved = await api(gen.editing ? `/api/prompts/${gen.editing.id}` : "/api/prompts", {
      method: gen.editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    gen.promptId = saved.id;
    storageSet(PROMPT_KEY, saved.id);
    toast("✅ البرومبت اتحفظ واتختار");
    closePromptForm();
    await loadPrompts();
  } catch (err) {
    toast(err.message, true);
  }
});

$("promptList").addEventListener("click", async (e) => {
  const item = e.target.closest(".prompt-item");
  if (!item) return;
  const p = gen.prompts.find((x) => x.id === item.dataset.id);
  const act = e.target.closest("button[data-act]")?.dataset.act;
  if (act === "edit") return openPromptForm(p);
  if (act === "delete") {
    if (!confirm(`حذف البرومبت "${p.name}"؟`)) return;
    try {
      await api(`/api/prompts/${p.id}`, { method: "DELETE" });
      if (gen.editing?.id === p.id) closePromptForm();
      await loadPrompts();
    } catch (err) {
      toast(err.message, true);
    }
    return;
  }
  gen.promptId = p.id;
  storageSet(PROMPT_KEY, p.id);
  renderPrompts();
});

// يفتح صفحة التوليد وقطع فيديو معيّن متعلّم عليها (المدرب بييجي من المشروع)
function openGenerateWith(videoId) {
  gen.pending = { videoId };
  showStep("2");
}

// ---------- الأرشيف ----------
async function loadArchive() {
  const list = await api("/api/archive");
  gen.archive = new Map(list.map((a) => [a.video_id, a]));
}
const isArchived = (vid) => !!gen.archive.get(vid)?.archived;

async function setArchived(vid, archived) {
  try {
    await api(`/api/videos/${vid}/archive`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived }),
    });
    await loadArchive();
    gen.show.delete(vid);
    if (archived) {
      gen.clips.filter((c) => c.video_id === vid).forEach((c) => gen.selected.delete(c.id));
      if (gen.viewArchive === vid) gen.viewArchive = null;
    } else if (gen.viewArchive === vid) gen.viewArchive = null;
    toast(archived ? "🗄️ اتنقل للأرشيف" : "↩ رجع للشغال");
    renderClipPicker();
    renderGenerations();
  } catch (err) {
    toast(err.message, true);
  }
}

function renderArchive() {
  const items = [...gen.archive.values()].filter((a) => a.archived);
  const counts = new Map();
  for (const g of gen.list) if (g.status === "completed") counts.set(g.video_id, (counts.get(g.video_id) || 0) + 1);
  $("archiveEmpty").hidden = items.length > 0;
  $("archiveCount").textContent = items.length ? `(${items.length})` : "";
  $("archiveList").innerHTML = items
    .map((a) => `<li data-vid="${a.video_id}" class="${gen.viewArchive === a.video_id ? "active" : ""}">
      <div class="nm">${escapeHtml(a.name)}</div>
      <div class="meta">${counts.get(a.video_id) ? `<span>🎞️ ${counts.get(a.video_id)} فيديو</span>` : ""}
        ${a.exported_url ? `<a href="${a.exported_url}" target="_blank">✅ اتصدّر</a>` : `<span>اتأرشف بإيدك</span>`}</div>
      <div class="acts">
        <button class="btn sm" data-arch="view">${gen.viewArchive === a.video_id ? "✕ اقفل" : "👁 اعرض"}</button>
        <button class="btn sm" data-arch="restore" title="رجّعه للشغال">↩ رجّعه</button>
      </div>
    </li>`)
    .join("");
}

$("archiveList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-arch]");
  if (!b) return;
  const vid = b.closest("li").dataset.vid;
  if (b.dataset.arch === "restore") return setArchived(vid, false);
  gen.viewArchive = gen.viewArchive === vid ? null : vid;
  renderGenerations();
  if (gen.viewArchive) $("gensTitle").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("archiveBanner").addEventListener("click", (e) => {
  if (e.target.closest("[data-arch-close]")) { gen.viewArchive = null; renderGenerations(); }
  if (e.target.closest("[data-arch-restore]")) setArchived(gen.viewArchive, false);
});

// ---------- القطع ----------
const MIN_REF = 2;

function coachChip(coachId) {
  const c = gen.coaches.get(coachId);
  return c
    ? `<span class="coach-chip"><img src="${c.image_url}" alt="">${escapeHtml(c.name)}</span>`
    : `<span class="coach-chip missing">⚠️ مفيش مدرب</span>`;
}

function renderClipPicker() {
  const groups = new Map();
  for (const c of gen.clips) {
    if (isArchived(c.video_id) && !gen.show.has(c.video_id)) continue;
    if (!groups.has(c.video_id)) groups.set(c.video_id, { name: c.video_name, coach: c.video_coach_id, clips: [] });
    groups.get(c.video_id).clips.push(c);
  }
  $("clipPickerEmpty").hidden = groups.size > 0;
  $("clipPicker").innerHTML = [...groups.entries()]
    .map(([vid, g]) => {
      const hasCoach = gen.coaches.has(g.coach);
      const usable = g.clips.filter((c) => c.duration >= MIN_REF);
      const all = usable.length > 0 && usable.every((c) => gen.selected.has(c.id));
      return `<div class="clip-group ${hasCoach ? "" : "no-coach"}" data-vid="${vid}">
        <div class="clip-group-head">
          <span class="ttl">${escapeHtml(g.name)}${isArchived(vid) ? ` <span class="pill">🗄️ من الأرشيف</span>` : ""}</span>
          ${coachChip(g.coach)}
          <span class="spacer"></span>
          ${hasCoach
            ? `<button class="btn sm" data-all="${vid}">${all ? "إلغاء الكل" : "اختار الكل"}</button>`
            : `<button class="btn sm primary" data-pick-coach="${vid}">🧑‍🏫 اختار المدرب من المشروع</button>`}
          <button class="btn sm" data-archive="${vid}" title="انقل المشروع ده للأرشيف">🗄️</button>
        </div>
        <div class="clip-picks">${g.clips
          .map((c) => {
            const short = c.duration < MIN_REF;
            const off = short || !hasCoach;
            return `<div class="clip-pick ${gen.selected.has(c.id) ? "selected" : ""} ${off ? "too-short" : ""}"
              data-id="${c.id}" title="${short ? `أقصر من ${MIN_REF} ثانية، Seedance مش هيقبلها` : !hasCoach ? "اختار مدرب للمشروع الأول" : ""}">
              ${lightVideo(c.url, "muted playsinline")}
              <span class="tick">✓</span>
              <span class="tag"><span>#${c.index}</span><span>${c.duration.toFixed(1)}ث</span></span>
            </div>`;
          })
          .join("")}</div>
      </div>`;
    })
    .join("");
  updateGenerateBtn();
}
$("clipPicker").addEventListener("click", async (e) => {
  const arch = e.target.closest("[data-archive]");
  if (arch) return setArchived(arch.dataset.archive, true);
  const pc = e.target.closest("[data-pick-coach]");
  if (pc) {
    setFlowByVideo(pc.dataset.pickCoach);
    fol.current = null;
    return showStep("0");
  }
  const allBtn = e.target.closest("[data-all]");
  if (allBtn) {
    const usable = gen.clips.filter((c) => c.video_id === allBtn.dataset.all && c.duration >= MIN_REF);
    const all = usable.every((c) => gen.selected.has(c.id));
    usable.forEach((c) => (all ? gen.selected.delete(c.id) : gen.selected.add(c.id)));
    return renderClipPicker();
  }
  const pick = e.target.closest(".clip-pick");
  if (!pick) return;
  if (pick.classList.contains("too-short")) {
    if (pick.closest(".no-coach")) toast("المشروع ده مفيهوش مدرب. دوس «اختار المدرب من المشروع»", true);
    return;
  }
  const id = pick.dataset.id;
  gen.selected.has(id) ? gen.selected.delete(id) : gen.selected.add(id);
  renderClipPicker();
});
// معاينة القطعة لما الماوس يقف عليها
$("clipPicker").addEventListener("mouseover", (e) => e.target.closest(".clip-pick")?.querySelector("video")?.play().catch(() => {}));
$("clipPicker").addEventListener("mouseout", (e) => {
  const v = e.target.closest(".clip-pick")?.querySelector("video");
  if (v && !e.relatedTarget?.closest?.(".clip-pick")) { v.pause(); v.currentTime = 0.5; }
});

function updateGenerateBtn() {
  const n = gen.selected.size;
  const coaches = new Set(gen.clips.filter((c) => gen.selected.has(c.id)).map((c) => c.video_coach_id));
  $("clipPickCount").textContent = n
    ? `${n} مختارة` + (coaches.size > 1 ? ` · ${coaches.size} مدربين` : "")
    : "";
  const btn = $("generateBtn");
  btn.disabled = !n || !gen.promptId;
  btn.textContent = n ? `✨ ولّد ${n} فيديو` : "✨ ولّد";
}

$("generateBtn").onclick = async () => {
  const btn = $("generateBtn");
  btn.disabled = true;
  try {
    // لو بتولّد تاني لمشروع في الأرشيف، يرجع للشغال عشان تشوف النتايج
    const vids = new Set(gen.clips.filter((c) => gen.selected.has(c.id)).map((c) => c.video_id));
    for (const vid of vids) {
      if (!isArchived(vid)) continue;
      await api(`/api/videos/${vid}/archive`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: false }),
      });
    }
    if ([...vids].some(isArchived)) await loadArchive();
    const res = await api("/api/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clip_ids: [...gen.selected],
        prompt_id: gen.promptId,
        generate_audio: $("audioCheck").checked,
      }),
    });
    toast(`🚀 اتبعت ${res.created} طلب`);
    gen.selected.clear();
    renderClipPicker();
    await loadGenerations();
  } catch (err) {
    toast(err.message, true);
  } finally {
    updateGenerateBtn();
  }
};

// ---------- النتايج ----------
async function loadGenerations() {
  gen.list = await api("/api/generations");
  renderGenerations();
  clearTimeout(gen.timer);
  const viewOpen = !document.querySelector('.view[data-view="2"]').hidden;
  if (viewOpen && gen.list.some((g) => ACTIVE.has(g.status))) gen.timer = setTimeout(loadGenerations, 3000);
}

function renderGenerations() {
  renderArchive();
  const viewing = gen.viewArchive && gen.archive.get(gen.viewArchive);
  if (!viewing) gen.viewArchive = null;
  // الشغال: كل اللي مش في الأرشيف · الأرشيف: المشروع اللي فتحته بس
  const list = gen.list.filter((g) => (viewing ? g.video_id === gen.viewArchive : !isArchived(g.video_id)));
  $("gensTitle").textContent = viewing ? "🗄️ فيديوهات من الأرشيف" : "الفيديوهات المولَّدة";
  $("archiveBanner").hidden = !viewing;
  if (viewing) {
    $("archiveBanner").innerHTML = `<span>بتتفرج على <b>${escapeHtml(viewing.name)}</b> من الأرشيف</span>
      <button class="btn sm" data-arch-restore>↩ رجّعه للشغال</button>
      <button class="btn sm primary" data-arch-close>رجوع للشغال عليه</button>`;
  }
  $("gensEmpty").hidden = list.length > 0;
  $("gensEmpty").textContent = viewing ? "مفيش فيديوهات مولَّدة للمشروع ده." : "لسه مفيش فيديوهات مولَّدة.";
  const active = list.filter((g) => ACTIVE.has(g.status)).length;
  const done = list.filter((g) => g.status === "completed").length;
  $("genSummary").textContent = list.length ? `${done} جاهز${active ? ` · ${active} شغال` : ""}` : "";

  // متقسّمة على المشاريع
  const groups = new Map();
  for (const g of list) {
    const key = g.video_id || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(g);
  }
  // منعيدش رسم الفيديوهات اللي خلصت عشان متقفش لو شغالة
  const host = $("gensGroups");
  const existing = new Map([...host.querySelectorAll(".gen")].map((el) => [el.dataset.id, el]));
  const frag = document.createDocumentFragment();
  for (const [vid, gens] of groups) {
    const a = gen.archive.get(vid);
    const box = document.createElement("div");
    box.className = "gen-group";
    const ready = gens.filter((g) => g.status === "completed").length;
    box.innerHTML = `<div class="gen-group-head">
        <span class="ttl">${escapeHtml(a?.name || gens[0].clip_label.replace(/ #\d+$/, "") || "من غير مشروع")}</span>
        <span class="muted">${ready} / ${gens.length} جاهز</span>
        ${a?.exported_url ? `<a class="muted" href="${a.exported_url}" target="_blank">✅ اتصدّر</a>` : ""}
        <span class="spacer"></span>
        ${vid && !viewing ? `<button class="btn sm" data-archive="${vid}">🗄️ أرشفه</button>` : ""}
      </div><div class="gens"></div>`;
    const grid = box.querySelector(".gens");
    for (const g of gens) {
      const key = `${g.status}|${g.error || ""}`;
      let el = existing.get(g.id);
      if (!el || el.dataset.key !== key) {
        el = document.createElement("div");
        el.className = "gen";
        el.dataset.id = g.id;
        el.dataset.key = key;
        el.innerHTML = genCard(g);
      }
      grid.appendChild(el);
    }
    frag.appendChild(box);
  }
  host.replaceChildren(frag);
}

function genCard(g) {
  const isActive = ACTIVE.has(g.status);
  const media = g.output_url
    ? lightVideo(g.output_url, "controls playsinline")
    : `<div class="wait">${isActive ? `<div class="spin"></div><br>${STATUS_LABEL[g.status]}...` : "مفيش فيديو"}</div>`;
  const pillCls = g.status === "completed" ? "completed" : g.status === "failed" ? "failed" : "active";
  const p = g.params;
  return `<div class="media">${media}</div>
    <div class="body">
      <div class="who"><img src="${g.coach_image_url}" alt="">${escapeHtml(g.coach_name)}</div>
      <div>${escapeHtml(g.clip_label)} · ${g.model_label} · ${p.resolution} · ${p.duration}ث</div>
      <span class="pill ${pillCls}">${STATUS_LABEL[g.status] || g.status}</span>
      ${g.error ? `<div class="err">${escapeHtml(g.error)}</div>` : ""}
      <div class="acts">
        <a class="btn sm" href="${g.clip_url}" target="_blank">القطعة الأصلية</a>
        ${g.output_url ? `<a class="btn sm" href="${g.output_url}" download>⬇ تحميل</a>` : ""}
        ${g.status === "failed" ? `<button class="btn sm" data-act="retry">↻ إعادة المحاولة</button>` : ""}
        ${isActive ? "" : `<button class="btn sm danger" data-act="delete">حذف</button>`}
      </div>
    </div>`;
}

$("gensGroups").addEventListener("click", async (e) => {
  const arch = e.target.closest("[data-archive]");
  if (arch) return setArchived(arch.dataset.archive, true);
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.closest(".gen").dataset.id;
  try {
    if (btn.dataset.act === "retry") await api(`/api/generations/${id}/retry`, { method: "POST" });
    if (btn.dataset.act === "delete") {
      if (!confirm("حذف الفيديو ده؟")) return;
      await api(`/api/generations/${id}`, { method: "DELETE" });
    }
    await loadGenerations();
  } catch (err) {
    toast(err.message, true);
  }
});

viewHooks["2"] = initGenerate;
