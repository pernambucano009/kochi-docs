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

const gen = { atlas: null, coachId: null, clips: [], selected: new Set(), list: [], timer: null, prompts: [], promptId: null, editing: null };

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

  const [coaches, clips] = await Promise.all([api("/api/coaches"), api("/api/clips"), loadPrompts()]);
  gen.clips = clips;
  const ids = new Set(clips.map((c) => c.id));
  gen.selected = new Set([...gen.selected].filter((id) => ids.has(id)));
  if (gen.pending) {
    // جاي من التقطيع أو من المشروع: نعلّم على قطع الفيديو ده ونختار المدرب بتاعه
    const { videoId, coachId } = gen.pending;
    gen.pending = null;
    const mine = clips.filter((c) => c.video_id === videoId && c.duration >= MIN_REF);
    gen.selected = new Set(mine.map((c) => c.id));
    const coach = coachId || mine.find((c) => c.video_coach_id)?.video_coach_id;
    if (coach && coaches.some((c) => c.id === coach)) gen.coachId = coach;
    toast(`✅ اتعلّم على ${mine.length} قطعة${coach ? " واتختار المدرب" : ". اختار المدرب"}`);
    setTimeout(() => document.querySelector(".clip-pick.selected")?.scrollIntoView({ block: "center", behavior: "smooth" }), 200);
  }
  renderCoachPicker(coaches);
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

// يفتح صفحة التوليد وقطع فيديو معيّن متعلّم عليها
function openGenerateWith(videoId, coachId = null) {
  gen.pending = { videoId, coachId };
  showStep("2");
}

// ---------- المدرب ----------
function renderCoachPicker(coaches) {
  if (!coaches.some((c) => c.id === gen.coachId)) gen.coachId = coaches[0]?.id || null;
  $("coachPickerEmpty").hidden = coaches.length > 0;
  $("coachPicker").innerHTML = coaches
    .map(
      (c) => `<button class="coach-pick ${c.id === gen.coachId ? "selected" : ""}" data-id="${c.id}">
        <img src="${c.image_url}" alt="">${escapeHtml(c.name)}</button>`
    )
    .join("");
  updateGenerateBtn();
}
$("coachPicker").addEventListener("click", (e) => {
  const b = e.target.closest(".coach-pick");
  if (!b) return;
  gen.coachId = b.dataset.id;
  document.querySelectorAll(".coach-pick").forEach((x) => x.classList.toggle("selected", x === b));
  updateGenerateBtn();
});

// ---------- القطع ----------
const MIN_REF = 2;
function renderClipPicker() {
  $("clipPickerEmpty").hidden = gen.clips.length > 0;
  const groups = new Map();
  for (const c of gen.clips) {
    if (!groups.has(c.video_id)) groups.set(c.video_id, { name: c.video_name, clips: [] });
    groups.get(c.video_id).clips.push(c);
  }
  $("clipPicker").innerHTML = [...groups.entries()]
    .map(([vid, g]) => {
      const usable = g.clips.filter((c) => c.duration >= MIN_REF);
      const all = usable.length > 0 && usable.every((c) => gen.selected.has(c.id));
      return `<div class="clip-group">
        <div class="clip-group-head"><span>${escapeHtml(g.name)}</span>
          <button class="btn sm" data-all="${vid}">${all ? "إلغاء الكل" : "اختار الكل"}</button></div>
        <div class="clip-picks">${g.clips
          .map((c) => {
            const short = c.duration < MIN_REF;
            return `<div class="clip-pick ${gen.selected.has(c.id) ? "selected" : ""} ${short ? "too-short" : ""}"
              data-id="${c.id}" title="${short ? `أقصر من ${MIN_REF} ثانية، Seedance مش هيقبلها` : ""}">
              <video src="${c.url}#t=0.5" preload="metadata" muted playsinline></video>
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
$("clipPicker").addEventListener("click", (e) => {
  const allBtn = e.target.closest("[data-all]");
  if (allBtn) {
    const usable = gen.clips.filter((c) => c.video_id === allBtn.dataset.all && c.duration >= MIN_REF);
    const all = usable.every((c) => gen.selected.has(c.id));
    usable.forEach((c) => (all ? gen.selected.delete(c.id) : gen.selected.add(c.id)));
    if (!all) autoPickCoach(usable.map((c) => c.id));
    return renderClipPicker();
  }
  const pick = e.target.closest(".clip-pick");
  if (!pick || pick.classList.contains("too-short")) return;
  const id = pick.dataset.id;
  gen.selected.has(id) ? gen.selected.delete(id) : gen.selected.add(id);
  autoPickCoach([id]);
  renderClipPicker();
});
// معاينة القطعة لما الماوس يقف عليها
$("clipPicker").addEventListener("mouseover", (e) => e.target.closest(".clip-pick")?.querySelector("video")?.play().catch(() => {}));
$("clipPicker").addEventListener("mouseout", (e) => {
  const v = e.target.closest(".clip-pick")?.querySelector("video");
  if (v && !e.relatedTarget?.closest?.(".clip-pick")) { v.pause(); v.currentTime = 0.5; }
});

// لو الفيديو مربوط بمدرب، نختاره لوحده
function autoPickCoach(clipIds) {
  const clip = gen.clips.find((c) => clipIds.includes(c.id) && gen.selected.has(c.id) && c.video_coach_id);
  if (!clip || clip.video_coach_id === gen.coachId) return;
  const btn = document.querySelector(`.coach-pick[data-id="${clip.video_coach_id}"]`);
  if (!btn) return;
  gen.coachId = clip.video_coach_id;
  document.querySelectorAll(".coach-pick").forEach((x) => x.classList.toggle("selected", x === btn));
  toast(`🧑‍🏫 اتختار ${btn.textContent.trim()} لوحده (مربوط بالفيديو)`);
}

function coachMismatch() {
  const chosen = gen.clips.filter((c) => gen.selected.has(c.id) && c.video_coach_id && c.video_coach_id !== gen.coachId);
  return chosen.length;
}

function updateGenerateBtn() {
  const n = gen.selected.size;
  $("clipPickCount").textContent = n ? `${n} مختارة` : "";
  const btn = $("generateBtn");
  btn.disabled = !n || !gen.coachId || !gen.promptId;
  btn.textContent = n ? `✨ ولّد ${n} فيديو` : "✨ ولّد";
  const mis = coachMismatch();
  $("clipPickCount").textContent += mis ? ` · ⚠️ ${mis} قطعة مربوطة بمدرب تاني` : "";
}

$("generateBtn").onclick = async () => {
  const btn = $("generateBtn");
  btn.disabled = true;
  try {
    const res = await api("/api/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clip_ids: [...gen.selected],
        coach_id: gen.coachId,
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
  const list = gen.list;
  $("gensEmpty").hidden = list.length > 0;
  const active = list.filter((g) => ACTIVE.has(g.status)).length;
  const done = list.filter((g) => g.status === "completed").length;
  $("genSummary").textContent = list.length ? `${done} جاهز${active ? ` · ${active} شغال` : ""}` : "";

  // منعيدش رسم الفيديوهات اللي خلصت عشان متقفش لو شغالة
  const grid = $("gensGrid");
  const existing = new Map([...grid.children].map((el) => [el.dataset.id, el]));
  const frag = document.createDocumentFragment();
  for (const g of list) {
    const key = `${g.status}|${g.error || ""}`;
    let el = existing.get(g.id);
    if (!el || el.dataset.key !== key) {
      el = document.createElement("div");
      el.className = "gen";
      el.dataset.id = g.id;
      el.dataset.key = key;
      el.innerHTML = genCard(g);
    }
    frag.appendChild(el);
  }
  grid.replaceChildren(frag);
}

function genCard(g) {
  const isActive = ACTIVE.has(g.status);
  const media = g.output_url
    ? `<video src="${g.output_url}" controls preload="metadata" playsinline></video>`
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

$("gensGrid").addEventListener("click", async (e) => {
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
