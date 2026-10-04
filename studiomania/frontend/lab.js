// StudioMania — 🔬 معمل التفكيك: البرنامج بيفكك أي فيديو لعناصره، وإنت بتراجع وتقيّم كل حاجة.
// القطعات وبدايات الأصوات بتتقاس بالكود، والموديل بيسمّي ويوصف، وتقييمك (✅ ❌ والتصحيح) بيتحفظ مع الأصل.

const labx = { list: [], cur: null, timer: null, pick: {} };
const LAB_KEY = "studiomania.lab";
const LAB_SFX_CAT = { click: "🖱️ كليك", whoosh: "💨 ووش", pop: "💥 بوب", impact: "🥁 خبطة", typing: "⌨️ كتابة", swipe: "🖍️ سحبة",
  notification: "🔔 إشعار", riser: "📈 رايزر", transition: "🔀 انتقال", ui: "📱 صوت واجهة", foley: "👣 فولي", ambience: "🌫️ جو المكان", other: "❔ تاني" };
const LAB_TYPES = { character: "🧍 شخصية", background: "🖼️ خلفية", cursor: "🖱️ مؤشر ماوس", icon: "⭐ أيقونة", file: "📄 ملف", folder: "📁 فولدر",
  window: "🪟 نافذة", button: "🔘 زرار", text: "🔤 كلام", logo: "🏷️ لوجو", photo: "🖼️ صورة", ui: "📱 واجهة", object: "📦 حاجة", shape: "🔷 شكل",
  effect: "✨ افيكت", other: "❔ تاني" };
const LAB_ACTIONS = { appear: "بيظهر", disappear: "بيختفي", move: "بيتحرك", click: "بيدوس", drag: "بيسحب", drop: "بيسيب", type: "بيكتب",
  scale: "بيكبر/يصغر", rotate: "بيلف", highlight: "بيتعمله هايلايت", transform: "بيتحول", speak: "بيتكلم", gesture: "بيشاور", other: "تاني" };
const LAB_SCENE = { live_action: "🎥 تصوير حقيقي", screen_recording: "🖥️ تسجيل شاشة", motion_graphics: "✨ موشن جرافيك", mixed: "🔀 مزيج" };
const LAB_STEP = { shots: "✂️ القطعات", audio: "🎧 الصوت", elements: "🧩 العناصر" };
const lt = (t) => `${Math.floor((t || 0) / 60)}:${((t || 0) % 60).toFixed(2).padStart(5, "0")}`;
const le = (v) => escapeHtml(v == null ? "" : String(v));
const labOpts = (map, v) => Object.entries(map).map(([k, l]) => `<option value="${k}" ${k === v ? "selected" : ""}>${l}</option>`).join("");

viewHooks["11"] = initLab;
async function initLab() {
  labx.list = await api("/api/lab");
  const want = labx.cur?.id || storageGet(LAB_KEY);
  const id = labx.list.some((x) => x.id === want) ? want : labx.list[0]?.id;
  if (id) await openLab(id);
  else renderLab();
}
async function openLab(id) {
  const fresh = await api(`/api/lab/${id}`);
  if (labx.cur?.id !== id) $("labVideo").src = fresh.source_url;
  labx.cur = fresh;
  storageSet(LAB_KEY, id);
  renderLab();
  scheduleLabPoll();
}

function scheduleLabPoll() {
  clearTimeout(labx.timer);
  if (!labx.cur?.busy || document.querySelector('.view[data-view="11"]').hidden) return;
  labx.timer = setTimeout(async () => {
    try {
      labx.cur = await api(`/api/lab/${labx.cur.id}`);
      if (!labx.cur.busy) labx.list = await api("/api/lab");
      renderLab();
    } catch { /* السيرفر بيعيد التشغيل */ }
    scheduleLabPoll();
  }, 2500);
}

// تقييم: ✅ ❌ لأي حاجة (الضغطة التانية على نفس الزرار بتلغيه)
const rv = (kind, ref, review) => {
  const ok = review?.ok;
  return `<span class="lab-rv" data-kind="${kind}" data-ref="${le(ref)}">
    <button type="button" class="${ok === true ? "on ok" : ""}" data-rvok="1" title="صح">✅</button>
    <button type="button" class="${ok === false ? "on bad" : ""}" data-rvok="0" title="غلط">❌</button>
    <input type="text" class="lab-note" value="${le(review?.note)}" placeholder="ملاحظة" data-rvnote></span>`;
};
const orig = (x) => x?.original ? `<small class="muted" title="اللي الموديل قاله قبل تصحيحك" data-no-i18n>كان: ${le(Object.values(x.original).join(" · "))}</small>` : "";

function renderLab() {
  $("labList").innerHTML = labx.list.map((x) => `<li class="${x.id === labx.cur?.id ? "active" : ""}" data-lab="${x.id}">
      ${x.thumb ? `<img src="${x.thumb}" alt="">` : `<span class="ph">🎬</span>`}
      <span class="ad-li-body"><span class="nm" data-no-i18n>${le(x.name)}</span>
        <small class="muted">${x.duration} ث · ${x.shots} لقطة</small></span>
      <small>${x.busy ? "⏳" : ""}</small></li>`).join("") || `<li class="muted">لسه مفيش فيديوهات.</li>`;
  const d = labx.cur;
  $("labMain").hidden = !d;
  $("labEmpty").hidden = !!d;
  if (!d) return;
  if (document.activeElement !== $("labName")) $("labName").value = d.name;
  document.querySelectorAll("[data-labrun]").forEach((b) => (b.disabled = d.busy));
  $("labStatus").innerHTML = Object.entries(LAB_STEP).map(([k, l]) => {
    const s = d.steps?.[k] || {};
    return `<span class="lab-st ${s.status || ""}">${s.status === "working" ? `<span class="spin-inline"></span>` : s.status === "done" ? "✅" : s.status === "failed" ? "✕" : "⏸"}
      ${l}${s.progress ? ` <small>${le(s.progress)}</small>` : ""}${s.error ? ` <small class="err">${le(s.error)}</small>` : ""}</span>`;
  }).join("");
  renderLabScore(d);
  renderLabTimeline(d);
  const busyEdit = (el) => el.contains(document.activeElement) && document.activeElement.matches("input, select, textarea");
  if (!busyEdit($("labAudio"))) renderLabAudio(d);
  if (!busyEdit($("labShots"))) renderLabShots(d);
}

const LAB_SCORE = { shots: "✂️ القطعات", sfx: "🔊 المؤثرات", music: "🎵 الموسيقى", speech: "🗣️ الكلام", elements: "🧩 العناصر", actions: "🎬 الحركات", layers: "🗂️ الطبقات" };
function renderLabScore(d) {
  const r = d.reviews || {};
  $("labScore").innerHTML = `<b>👤 تقييمك لدقة التفكيك:</b>` + Object.entries(LAB_SCORE).filter(([k]) => r[k]?.total).map(([k, l]) => {
    const x = r[k], done = x.ok + x.bad, acc = done ? Math.round((x.ok / done) * 100) : null;
    return `<span class="lab-sc" title="✅ ${x.ok} · ❌ ${x.bad} · لسه ${x.total - done}">${l} <b>${acc == null ? "—" : acc + "%"}</b>
      <small>${done}/${x.total}</small></span>`;
  }).join("");
}

// التايم لاين: لقطات / كلام / موسيقى / مؤثرات، والمؤشر ماشي مع الفيديو
function renderLabTimeline(d) {
  const T = d.source.duration || 1, pct = (t) => `${(Math.max(0, Math.min(T, t)) / T) * 100}%`, a = d.audio || {};
  const lane = (label, items) => `<div class="lab-lane"><span class="lab-ll">${label}</span><div class="lab-lt">${items}</div></div>`;
  $("labTimeline").innerHTML =
    lane("✂️ اللقطات", (d.shots || []).map((s) => `<i class="blk shot ${s.review?.ok === false ? "bad" : ""}" style="right:${pct(s.start)};width:calc(${pct(s.end - s.start)} - 2px)" data-seek="${s.start}" title="لقطة ${s.n}">${s.n}</i>`).join(""))
    + lane("🗣️ كلام", (a.speech || []).map((s) => `<i class="blk sp" style="right:${pct(s.start)};width:${pct(s.end - s.start)}" data-seek="${s.start}" title="${le(s.text)}"></i>`).join(""))
    + lane("🎵 موسيقى", (a.music || []).map((s) => `<i class="blk mu" style="right:${pct(s.start)};width:${pct(s.end - s.start)}" data-seek="${s.start}" title="${le(s.description)}"></i>`).join(""))
    + lane("🔊 مؤثرات", (a.sfx || []).map((x) => `<i class="tick ${x.review?.ok === false ? "bad" : x.review?.ok ? "ok" : ""}" style="right:${pct(x.t)}" data-seek="${x.t}" data-clip="${x.clip_url || ""}" title="${le(x.label)} · ${lt(x.t)}"></i>`).join(""))
    + `<div class="lab-head" id="labHead"></div>`;
  labHead();
}
function labHead() {
  const v = $("labVideo"), d = labx.cur, h = $("labHead");
  if (!h || !d) return;
  const track = $("labTimeline").querySelector(".lab-lt");
  if (!track) return;
  // الوقت صفر على يمين التراك (عربي)
  h.style.left = `${track.offsetLeft + track.offsetWidth * (1 - Math.min(1, v.currentTime / (d.source.duration || 1)))}px`;
}
$("labVideo").addEventListener("timeupdate", labHead);

function renderLabAudio(d) {
  const a = d.audio || {};
  if (a.none) { $("labAudio").innerHTML = `<h3 class="pane-h">🎧 الصوت</h3><p class="muted">الفيديو ده مفيهوش صوت.</p>`; return; }
  if (!a.sfx && !a.speech) { $("labAudio").innerHTML = `<h3 class="pane-h">🎧 الصوت</h3><p class="muted">${d.steps?.audio?.status === "working" ? "⏳ بيفكك الصوت..." : "لسه ما اتفككش."}</p>`; return; }
  const sfx = a.sfx || [];
  $("labAudio").innerHTML = `<h3 class="pane-h">🎧 الصوت <span class="muted">(${sfx.length} مؤثر · ${(a.speech || []).length} جملة · ${(a.music || []).length} موسيقى · ${(a.onsets || []).length} بداية صوت اتقاست)</span></h3>
    <p class="hint">⏱️ = الوقت اتظبط على بداية الصوت اللي اتقاست بالكود (دقة 10 مللي ثانية). ▶️ بيشغّل الصوت لوحده وبيودّي الفيديو للحظته. فصل التراكات نفسها (ملف للكلام وملف للمؤثرات) محتاج خدمة خارجية، وهنضيفها لما تختارها.</p>
    <h4>🔊 المؤثرات الصوتية</h4>
    <div class="lab-rows">${sfx.map((x) => `<div class="lab-row" data-sfx="${x.id}">
      <button type="button" class="btn sm" data-play="${x.clip_url}" data-seek="${x.t}">▶️</button>
      <span class="lab-time" title="${x.snapped ? `الموديل قال ${x.t_model}` : "مقاسش"}">${lt(x.t)} ${x.snapped ? "⏱️" : ""}</span>
      <input type="text" value="${le(x.label)}" data-fix="sfx|${x.id}|label" data-no-i18n>
      <select data-fix="sfx|${x.id}|category">${labOpts(LAB_SFX_CAT, x.category)}</select>
      <small class="muted grow" data-no-i18n>${le(x.what)}</small>${orig(x)}
      ${rv("sfx", x.id, x.review)}</div>`).join("") || `<p class="muted">مفيش مؤثرات.</p>`}</div>
    <h4>🎵 الموسيقى</h4>
    <div class="lab-rows">${(a.music || []).map((m, i) => `<div class="lab-row">
      <button type="button" class="btn sm" data-seek="${m.start}" data-playvid>▶️</button>
      <span class="lab-time">${lt(m.start)} ← ${lt(m.end)}</span>
      <input type="text" value="${le(m.description)}" data-fix="music|${i}|description" data-no-i18n>
      <input type="text" class="sm" value="${le(m.mood)}" data-fix="music|${i}|mood" data-no-i18n>${orig(m)}
      ${rv("music", i, m.review)}</div>`).join("") || `<p class="muted">مفيش موسيقى.</p>`}</div>
    <h4>🗣️ الكلام</h4>
    <div class="lab-rows">${(a.speech || []).map((s, i) => `<div class="lab-row">
      <button type="button" class="btn sm" data-seek="${s.start}" data-playvid>▶️</button>
      <span class="lab-time">${lt(s.start)} ← ${lt(s.end)}</span>
      <input type="text" class="sm" value="${le(s.speaker)}" placeholder="مين" data-fix="speech|${i}|speaker" data-no-i18n>
      <input type="text" value="${le(s.text)}" data-fix="speech|${i}|text" data-no-i18n>${orig(s)}
      ${rv("speech", i, s.review)}</div>`).join("") || `<p class="muted">مفيش كلام.</p>`}</div>`;
}

function renderLabShots(d) {
  const sfxById = Object.fromEntries((d.audio?.sfx || []).map((x) => [x.id, x]));
  if (!(d.shots || []).length) { $("labShots").innerHTML = `<h3 class="pane-h">🎬 اللقطات</h3><p class="muted">${d.steps?.shots?.status === "working" ? "⏳ بيدور على القطعات..." : "لسه."}</p>`; return; }
  $("labShots").innerHTML = `<h3 class="pane-h">🎬 اللقطات وعناصرها <span class="muted">(${d.shots.length})</span></h3>` + d.shots.map((s) => {
    const an = s.analysis, L = s.layers || {}, pick = labx.pick[s.n] ?? L.t ?? (s.start + s.end) / 2;
    return `<article class="lab-shot" data-shot="${s.n}">
      <header><b>لقطة ${s.n}</b> <span class="lab-time">${lt(s.start)} ← ${lt(s.end)} (${(s.end - s.start).toFixed(2)} ث)</span>
        ${an ? `<span class="chip">${LAB_SCENE[an.scene_type] || ""}</span>` : ""}
        <span class="muted">القطع مظبوط؟</span>${rv("shot", s.n, s.review)}</header>
      <div class="lab-strip">${(s.frames || []).map((f) => `<img src="${f.url}" data-seek="${f.t}" data-pickt="${f.t}" class="${Math.abs(f.t - pick) < 0.001 ? "sel" : ""}" title="${lt(f.t)}" alt="">`).join("")}</div>
      ${s.analysis_error ? `<div class="err">${le(s.analysis_error)}</div>` : ""}
      ${an ? `<p data-no-i18n>${le(an.summary)}</p>
        <div class="lab-row"><b>🖼️ الخلفية:</b> <input type="text" value="${le(an.background?.name)}" data-fix="background|${s.n}|name" data-no-i18n>
          <small class="muted grow" data-no-i18n>${le(an.background?.description)}</small>${rv("background", s.n, an.background?.review)}</div>
        <div class="lab-els">${(an.elements || []).map((e) => `<div class="lab-el">
          <div class="lab-row"><select data-fix="element|${e.id}|type">${labOpts(LAB_TYPES, e.type)}</select>
            <input type="text" value="${le(e.name)}" data-fix="element|${e.id}|name" data-no-i18n>
            <span class="lab-time">${lt(e.first_t)} ← ${lt(e.last_t)}</span>${orig(e)}${rv("element", e.id, e.review)}</div>
          <small class="muted" data-no-i18n>${le(e.description)}</small>
          ${(e.actions || []).map((x, i) => `<div class="lab-row lab-act">
            <button type="button" class="btn sm" data-seek="${x.t0}" data-playvid>▶️</button>
            <span class="lab-time">${lt(x.t0)}–${lt(x.t1)}</span>
            <select data-fix="action|${e.id}:${i}|action">${labOpts(LAB_ACTIONS, x.action)}</select>
            ${x.from && x.to ? `<small class="muted" dir="ltr">(${x.from.join(", ")}) → (${x.to.join(", ")})</small>` : ""}
            <small class="grow" data-no-i18n>${le(x.detail)}</small>
            ${x.sfx && sfxById[x.sfx] ? `<button type="button" class="btn sm" data-play="${sfxById[x.sfx].clip_url}" data-seek="${sfxById[x.sfx].t}" title="الصوت المربوط">🔊 ${le(sfxById[x.sfx].label)}</button>` : ""}
            ${rv("action", `${e.id}:${i}`, x.review)}</div>`).join("")}
        </div>`).join("") || `<p class="muted">مفيش عناصر.</p>`}</div>`
        : `<p class="muted">${d.steps?.elements?.status === "working" ? "⏳ بيفكك العناصر..." : "العناصر لسه ما اتفككتش."}</p>`}
      <div class="lab-layers">
        <div class="row wrap"><button type="button" class="btn sm" data-layers="${s.n}" ${L.status === "working" ? "disabled" : ""}>
          ${L.status === "working" ? `<span class="spin-inline"></span> بيفكك الطبقات...` : `🗂️ فكّك الفريم ${lt(pick)} لطبقات`}</button>
          <span class="muted">اختار الفريم من الشريط فوق · بيتحسب على Atlas (حوالي 0.40$ للفريم)${L.price ? ` · آخر مرة: ${le(L.price)}$` : ""}</span></div>
        ${L.error ? `<div class="err">${le(L.error)}</div>` : ""}
        ${(L.items || []).length ? `<div class="lab-lgrid">
          ${L.base_url ? `<figure><div class="lab-ck"><img src="${L.base_url}" alt=""></div><figcaption>🖼️ الخلفية لوحدها</figcaption></figure>` : ""}
          ${L.items.map((x, i) => `<figure><div class="lab-ck"><img src="${x.url}" alt=""></div>
            <input type="text" value="${le(x.name)}" data-fix="layer|${s.n}:${i}|name" data-no-i18n>${orig(x)}
            ${x.description ? `<small class="muted" data-no-i18n>${le(x.description)}</small>` : ""}${rv("layer", `${s.n}:${i}`, x.review)}</figure>`).join("")}</div>` : ""}
      </div></article>`;
  }).join("");
}

// ---------- الأحداث
const labAudio = new Audio();
document.querySelector('.view[data-view="11"]').addEventListener("click", async (e) => {
  const seek = e.target.closest("[data-seek]");
  if (seek) {
    const v = $("labVideo");
    v.currentTime = Number(seek.dataset.seek);
    const clip = seek.dataset.play || seek.dataset.clip;
    if (clip) { v.pause(); labAudio.src = clip; labAudio.play().catch(() => {}); }
    else if (seek.dataset.playvid !== undefined) v.play().catch(() => {});
    if (seek.dataset.pickt) {
      labx.pick[seek.closest("[data-shot]").dataset.shot] = Number(seek.dataset.pickt);
      renderLabShots(labx.cur);
    }
    return;
  }
  const li = e.target.closest("[data-lab]");
  if (li) return openLab(li.dataset.lab);
  const ok = e.target.closest("[data-rvok]");
  if (ok) {
    const box = ok.closest(".lab-rv"), val = ok.dataset.rvok === "1";
    const cur = ok.classList.contains("on");
    return labReview(box.dataset.kind, box.dataset.ref, { ok: cur ? null : val, note: box.querySelector("[data-rvnote]").value });
  }
  const run = e.target.closest("[data-labrun]");
  if (run) {
    if (!confirm(run.dataset.labrun === "all" ? "تفكك الفيديو من الأول؟ تقييمك للحاجات اللي هتتعمل من جديد هيتمسح." : "تعيد الخطوة دي؟ (والعناصر بتتعمل من جديد بعدها)")) return;
    try { labx.cur = await api(`/api/lab/${labx.cur.id}/run?step=${run.dataset.labrun}`, { method: "POST" }); renderLab(); scheduleLabPoll(); }
    catch (err) { toast(err.message, true); }
    return;
  }
  const lay = e.target.closest("[data-layers]");
  if (lay) {
    const n = lay.dataset.layers, s = labx.cur.shots.find((x) => String(x.n) === n);
    const t = labx.pick[n] ?? (s.start + s.end) / 2;
    if (!confirm(`يفكك الفريم ${lt(t)} من لقطة ${n} لطبقات شفافة؟ (بيتحسب على Atlas، حوالي 0.40$)`)) return;
    try { labx.cur = await api(`/api/lab/${labx.cur.id}/shots/${n}/layers?t=${t}`, { method: "POST" }); renderLab(); scheduleLabPoll(); }
    catch (err) { toast(err.message, true); }
  }
});
document.querySelector('.view[data-view="11"]').addEventListener("change", (e) => {
  const fix = e.target.dataset.fix;
  if (fix) {
    const [kind, ref, field] = fix.split("|");
    return labReview(kind, ref, { fix: { [field]: e.target.value }, keep: true });
  }
  if (e.target.matches("[data-rvnote]")) {
    const box = e.target.closest(".lab-rv"), on = box.querySelector(".on");
    labReview(box.dataset.kind, box.dataset.ref, { ok: on ? on.dataset.rvok === "1" : null, note: e.target.value });
  }
});
// التصحيح بيحتفظ بالتقييم اللي كان موجود
function findReview(kind, ref) {
  return document.querySelector(`.lab-rv[data-kind="${kind}"][data-ref="${CSS.escape(ref)}"]`);
}
async function labReview(kind, ref, { ok, note, fix, keep }) {
  if (keep) {
    const box = findReview(kind, ref), on = box?.querySelector(".on");
    ok = on ? on.dataset.rvok === "1" : null;
    note = box?.querySelector("[data-rvnote]").value || "";
  }
  try {
    labx.cur = await api(`/api/lab/${labx.cur.id}/review`, { method: "PATCH", ...jsonBody({ kind, ref: String(ref), ok, note: note || "", fix: fix || {} }) });
    renderLabScore(labx.cur);
    renderLabTimeline(labx.cur);
    if (!fix) { renderLabAudio(labx.cur); renderLabShots(labx.cur); }
  } catch (err) { toast(err.message, true); }
}
$("labFile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  const form = new FormData();
  form.append("file", f);
  try {
    toast("⏳ بيرفع الفيديو...");
    const d = await api("/api/lab", { method: "POST", body: form });
    labx.list = await api("/api/lab");
    await openLab(d.id);
    toast("🔬 بدأ التفكيك");
  } catch (err) { toast(err.message, true); }
});
$("labName").addEventListener("change", async () => {
  try { labx.cur = await api(`/api/lab/${labx.cur.id}`, { method: "PATCH", ...jsonBody({ name: $("labName").value }) }); labx.list = await api("/api/lab"); renderLab(); }
  catch (err) { toast(err.message, true); }
});
$("labDelete").onclick = async () => {
  if (!confirm("تمسح الفيديو ده من المعمل بكل تفكيكه وتقييمك؟")) return;
  try {
    await api(`/api/lab/${labx.cur.id}`, { method: "DELETE" });
    labx.cur = null;
    $("labVideo").removeAttribute("src");
    await initLab();
  } catch (err) { toast(err.message, true); }
};
