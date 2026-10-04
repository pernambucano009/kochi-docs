// StudioMania — 🔬 معمل التفكيك: البرنامج بيفكك أي فيديو لعناصره، وإنت بتراجع وتقيّم كل حاجة.
// القطعات وبدايات الأصوات بتتقاس بالكود، والموديل بيسمّي ويوصف، وتقييمك (✅ ❌ والتصحيح) بيتحفظ مع الأصل.

const labx = { list: [], cur: null, timer: null, pick: {}, hear: { speech: true, music: true, sfx: true }, stems: null, win: {} };
const LAB_KEY = "studiomania.lab";
const LAB_SFX_CAT = { click: "🖱️ كليك", whoosh: "💨 ووش", pop: "💥 بوب", impact: "🥁 خبطة", typing: "⌨️ كتابة", swipe: "🖍️ سحبة",
  notification: "🔔 إشعار", riser: "📈 رايزر", transition: "🔀 انتقال", ui: "📱 صوت واجهة", foley: "👣 فولي", ambience: "🌫️ جو المكان", other: "❔ تاني" };
const LAB_TYPES = { character: "🧍 شخصية", background: "🖼️ خلفية", cursor: "🖱️ مؤشر ماوس", icon: "⭐ أيقونة", file: "📄 ملف", folder: "📁 فولدر",
  window: "🪟 نافذة", button: "🔘 زرار", text: "🔤 كلام", logo: "🏷️ لوجو", photo: "🖼️ صورة", ui: "📱 واجهة", object: "📦 حاجة", shape: "🔷 شكل",
  effect: "✨ افيكت", other: "❔ تاني" };
const LAB_ACTIONS = { appear: "بيظهر", disappear: "بيختفي", move: "بيتحرك", click: "بيدوس", drag: "بيسحب", drop: "بيسيب", type: "بيكتب",
  scale: "بيكبر/يصغر", rotate: "بيلف", highlight: "بيتعمله هايلايت", transform: "بيتحول", speak: "بيتكلم", gesture: "بيشاور", other: "تاني" };
const LAB_SCENE = { live_action: "🎥 تصوير حقيقي", screen_recording: "🖥️ تسجيل شاشة", motion_graphics: "✨ موشن جرافيك", mixed: "🔀 مزيج" };
const LAB_STEP = { shots: "✂️ القطعات", stems: "🎚️ فصل التراكات", audio: "🎧 الصوت", elements: "🧩 العناصر" };
const LAB_STEMS = { dialogue: "🗣️ الكلام", music: "🎵 الموسيقى", effects: "🔊 المؤثرات" };
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
  labx.win = labWindows(fresh);
  labSetupStems(fresh);
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
      labx.win = labWindows(labx.cur);
      if (!labx.cur.busy) { labx.list = await api("/api/lab"); labSetupStems(labx.cur); }
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
    return `<span class="lab-st ${s.status || ""}">${s.status === "working" ? `<span class="spin-inline"></span>` : s.status === "done" ? "✅" : s.status === "failed" ? "✕" : s.status === "skipped" ? "⏭" : "⏸"}
      ${l}${s.progress ? ` <small>${le(s.progress)}</small>` : ""}${s.error ? ` <small class="err">${le(s.error)}</small>` : ""}</span>`;
  }).join("");
  renderLabScore(d);
  renderLabTimeline(d);
  const busyEdit = (el) => el.contains(document.activeElement) && document.activeElement.matches("input, select, textarea");
  if (!busyEdit($("labAudio"))) renderLabAudio(d);
  const shotPlaying = [...document.querySelectorAll("[data-shotvid], [data-vedvid]")].some((v) => !v.paused);
  if (!busyEdit($("labShots")) && !shotPlaying) renderLabShots(d);
}

const LAB_SCORE = { shots: "✂️ القطعات", stems: "🎚️ التراكات", sfx: "🔊 المؤثرات", music: "🎵 الموسيقى", speech: "🗣️ الكلام", elements: "🧩 العناصر", actions: "🎬 الحركات", layers: "🗂️ الطبقات" };
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
  const lane = (label, items, k) => `<div class="lab-lane"><span class="lab-ll">${k ? `<button type="button" class="lab-hear ${labx.hear[k] ? "on" : ""}" data-hear="${k}" title="اسمع / اقفل">${labx.hear[k] ? "🔊" : "🔇"}</button>` : ""}${label}</span><div class="lab-lt">${items}</div></div>`;
  const allOn = Object.values(labx.hear).every(Boolean);
  $("labTimeline").innerHTML =
    `<div class="lab-hearnote ${allOn ? "" : "on"}">${allOn ? "🎧 دوس 🔊 جنب أي حارة عشان تقفلها وتسمع الباقي لوحده"
      : labx.stems ? "🎚️ بتسمع التراكات المفصولة اللي مفتوحة بس" : "⚠️ مفيش تراكات مفصولة: الصوت بيسكت برا أوقات الحاجات اللي مفتوحة (تقدر تتأكد من التوقيت، بس الكلام والموسيقى في نفس اللحظة بيبقوا مع بعض)"}</div>`
    + lane("✂️ اللقطات", (d.shots || []).map((s) => `<i class="blk shot ${s.review?.ok === false ? "bad" : ""}" style="right:${pct(s.start)};width:calc(${pct(s.end - s.start)} - 2px)" data-seek="${s.start}" title="لقطة ${s.n}">${s.n}</i>`).join(""))
    + lane("🗣️ كلام", (a.speech || []).map((s) => `<i class="blk sp" style="right:${pct(s.start)};width:${pct(s.end - s.start)}" data-seek="${s.start}" title="${le(s.text)}"></i>`).join(""), "speech")
    + lane("🎵 موسيقى", (a.music || []).map((s) => `<i class="blk mu" style="right:${pct(s.start)};width:${pct(s.end - s.start)}" data-seek="${s.start}" title="${le(s.description)}"></i>`).join(""), "music")
    + lane("🔊 مؤثرات", (a.sfx || []).map((x) => `<i class="tick ${x.review?.ok === false ? "bad" : x.review?.ok ? "ok" : ""}" style="right:${pct(x.t)}" data-seek="${x.t}" data-clip="${x.clip_url || ""}" title="${le(x.label)} · ${lt(x.t)}"></i>`).join(""), "sfx")
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

// ---------- 🎧 اسمع حاجة وحدة: بالتراكات المفصولة لو موجودة، وإلا بإسكات الصوت برا أوقاتها
function labWindows(d) {
  const a = d.audio || {};
  return { speech: (a.speech || []).map((s) => [s.start - 0.05, s.end + 0.1]), music: (a.music || []).map((m) => [m.start, m.end]),
    sfx: (a.sfx || []).map((x) => [x.t - 0.03, x.t + (x.dur || 0.3) + 0.08]) };
}
function labAudible(t) {
  const h = labx.hear;
  if (h.speech && h.music && h.sfx) return true;
  return Object.entries(labx.win).some(([k, ws]) => h[k] && ws.some(([a, b]) => t >= a && t <= b));
}
const STEM_OF = { speech: "dialogue", music: "music", sfx: "effects" };
function labSetupStems(d) {
  if (labx.stems) Object.values(labx.stems).forEach((a) => a.pause());
  labx.stems = null;
  const st = d.stems || {};
  if (!["dialogue", "music", "effects"].every((k) => st[k]?.url)) { $("labVideo").muted = false; return; }
  labx.stems = Object.fromEntries(Object.entries(STEM_OF).map(([k, f]) => { const a = new Audio(st[f].url); a.preload = "auto"; return [k, a]; }));
}
function labGateLoop() {
  const v = $("labVideo");
  if (labx.stems) {  // الفيديو ساكت والتراكات ماشية معاه
    v.muted = true;
    for (const [k, a] of Object.entries(labx.stems)) {
      a.volume = labx.hear[k] ? 1 : 0;
      if (Math.abs(a.currentTime - v.currentTime) > 0.12) a.currentTime = v.currentTime;
      if (v.paused !== a.paused) v.paused ? a.pause() : a.play().catch(() => {});
    }
  } else if (!v.paused) v.volume = labAudible(v.currentTime) ? 1 : 0;
  document.querySelectorAll("[data-shotvid]").forEach((x) => {
    if (!x.paused) x.volume = labAudible(x.currentTime) ? 1 : 0;
    labShotStop(x);
  });
  requestAnimationFrame(labGateLoop);
}
requestAnimationFrame(labGateLoop);
// مربع اللقطة: بيوقف عند آخر اللقطة (أو آخر الجزء اللي طلبته) ولو التكرار شغال يرجع لأولها
function labShotStop(v) {
  if (v.paused) return;
  const end = Number(v.dataset.stop || v.dataset.end);
  if (v.currentTime >= end - 0.02) {
    if (v.dataset.loop === "1" && !v.dataset.stop) v.currentTime = Number(v.dataset.start);
    else { v.pause(); delete v.dataset.stop; }
  }
}
function labPlayShot(n, from, to) {
  const v = document.querySelector(`[data-shotvid="${n}"]`);
  if (!v) return;
  document.querySelectorAll("[data-shotvid]").forEach((x) => x !== v && x.pause());
  $("labVideo").pause();
  const go = () => {
    v.currentTime = Math.max(Number(v.dataset.start), from);
    if (to != null) v.dataset.stop = Math.min(Number(v.dataset.end), to); else delete v.dataset.stop;
    v.play().catch(() => {});
  };
  if (v.readyState < 1) { v.preload = "auto"; v.addEventListener("loadedmetadata", go, { once: true }); v.load(); } else go();
}

function renderLabAudio(d) {
  const a = d.audio || {};
  if (a.none) { $("labAudio").innerHTML = `<h3 class="pane-h">🎧 الصوت</h3><p class="muted">الفيديو ده مفيهوش صوت.</p>`; return; }
  if (!a.sfx && !a.speech) { $("labAudio").innerHTML = `<h3 class="pane-h">🎧 الصوت</h3><p class="muted">${d.steps?.audio?.status === "working" ? "⏳ بيفكك الصوت..." : "لسه ما اتفككش."}</p>`; return; }
  const sfx = a.sfx || [];
  $("labAudio").innerHTML = `<h3 class="pane-h">🎧 الصوت <span class="muted">(${sfx.length} مؤثر · ${(a.speech || []).length} جملة · ${(a.music || []).length} موسيقى · ${(a.onsets || []).length} بداية صوت اتقاست)</span></h3>
    ${labStems(d)}
    <p class="hint">⏱️ = الوقت اتظبط على بداية الصوت اللي اتقاست بالكود (دقة 10 مللي ثانية)${a.from_stem ? "، ومن تراك المؤثرات النضيف" : ""}. ▶️ بيشغّل الصوت لوحده وبيودّي الفيديو للحظته.</p>
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

// 🎚️ التراكات المفصولة (AudioShake): كل تراك تسمعه لوحده وتقيّمه
function labStems(d) {
  const st = d.stems || {}, step = d.steps?.stems || {};
  const rows = Object.entries(LAB_STEMS).filter(([k]) => st[k]).map(([k, l]) => `<div class="lab-row">
      <b class="lab-stem-l">${l}</b>
      ${st[k].url ? `<audio src="${st[k].url}" controls preload="none"></audio><a class="btn sm" href="${st[k].url}" download>⬇</a>` : `<span class="err">✕ ${le(st[k].error || "مطلعش")}</span>`}
      ${st[k].url ? rv("stem", k, st[k].review) : ""}</div>`).join("");
  return `<h4>🎚️ التراكات المفصولة</h4>${rows ? `<div class="lab-rows">${rows}</div>`
    : `<p class="muted">${step.status === "working" ? `<span class="spin-inline"></span> ${le(step.progress || "بيفصل التراكات...")}`
      : !d.audioshake ? "مفتاح AudioShake مش متسجل، فالتحليل اشتغل على الصوت كله. حطه على Railway في المتغير AUDIOSHAKE_API_KEY وبعدين دوس «🎚️ التراكات»."
      : step.error ? `✕ ${le(step.error)}` : "لسه ما اتفصلتش."}</p>`}`;
}

// ✏️ التعديل جوه المشهد: نفس اللقطة بحركتها، وكل عنصر يتغيّر بالكلام
function labVedit(d, s) {
  const els = s.analysis?.elements || [], vs = s.vedits || [], dur = (s.end - s.start);
  const models = d.vedit_models || [];
  const done = vs.filter((v) => v.status === "done");
  return `<div class="lab-vedit" data-vshot="${s.n}">
    <b>✏️ عدّل جوه المشهد</b> <small class="muted">المشهد بيفضل زي ما هو بحركته وخلفيته، واللي بتطلبه بس هو اللي بيتغيّر</small>
    ${els.length ? `<div class="lab-chips">${els.map((e) => `<button type="button" class="chip" data-vchip="${le(e.name)}" title="${le(e.description)}">${LAB_TYPES[e.type]?.split(" ")[0] || ""} ${le(e.name)}</button>`).join("")}</div>` : ""}
    <textarea rows="2" data-vtext placeholder="مثلًا: «مؤشر الماوس» خليه أزرق وأصغر، و«الملفات» غيّر أساميها لسعاد ولمياء وكريم، وبدل ما يحطهم في السلة يحطهم في فولدر «فواتير»"></textarea>
    <div class="row wrap">
      <select data-vmodel>${models.map((m) => `<option value="${m.key}">${le(m.label)} · ~${(m.per_sec * dur).toFixed(2)}$</option>`).join("")}</select>
      ${done.length ? `<select data-vbase><option value="">على الأصلي</option>${done.map((v, i) => `<option value="${v.id}">على النسخة ${i + 1}</option>`).join("")}</select>` : ""}
      <button type="button" class="btn sm primary" data-vgo>✨ عدّل المشهد</button>
    </div>
    <details class="lab-speed"><summary>⏩ سرّع / بطّأ جزء من اللقطة (ببلاش، من غير AI)</summary>
      <div class="row wrap"><label>من <input type="number" step="0.05" min="0" max="${dur.toFixed(2)}" value="0" data-sp="t0"></label>
        <label>لـ <input type="number" step="0.05" min="0" max="${dur.toFixed(2)}" value="${dur.toFixed(2)}" data-sp="t1"></label>
        <label>السرعة <input type="number" step="0.1" min="0.2" max="5" value="1.5" data-sp="factor">×</label>
        <button type="button" class="btn sm" data-vspeed>⏩ طبّق</button></div>
      <small class="muted">الأوقات من أول اللقطة (0 لـ ${dur.toFixed(2)} ث). مثلًا حركة الماوس من ثانية كام لكام تبقى أسرع ×2 والباقي زي ما هو.</small></details>
    ${vs.length ? `<div class="lab-vgrid">${vs.map((v, i) => `<div class="lab-ver">
      ${v.status === "done" ? `<video data-vedvid="${v.id}" src="${v.url}" playsinline controls preload="metadata"></video>`
        : v.status === "working" ? `<div class="lab-ver-wait"><span class="spin"></span><small>${le(v.step || "شغال...")}</small></div>`
        : `<div class="lab-ver-wait err">✕ ${le(v.error)}</div>`}
      <small data-no-i18n><b>${i + 1}.</b> ${le(v.instruction)}${v.base ? ` <span class="muted">(على نسخة ${vs.findIndex((x) => x.id === v.base) + 1})</span>` : ""}</small>
      ${v.prompt ? `<details><summary class="muted">التعليمات اللي اتبعتت للموديل</summary><small dir="ltr" data-no-i18n>${le(v.prompt)}</small></details>` : ""}
      <div class="row wrap">${v.status === "done" ? `<button type="button" class="btn sm" data-vcmp="${v.id}">▶️ مع الأصلي</button>` : ""}
        <button type="button" class="btn sm danger" data-vdel="${v.id}">🗑️</button>${v.status === "done" ? rv("vedit", `${s.n}:${v.id}`, v.review) : ""}</div>
    </div>`).join("")}</div>` : ""}
  </div>`;
}

function renderLabShots(d) {
  const sfxById = Object.fromEntries((d.audio?.sfx || []).map((x) => [x.id, x]));
  if (!(d.shots || []).length) { $("labShots").innerHTML = `<h3 class="pane-h">🎬 اللقطات</h3><p class="muted">${d.steps?.shots?.status === "working" ? "⏳ بيدور على القطعات..." : "لسه."}</p>`; return; }
  $("labShots").innerHTML = `<h3 class="pane-h">🎬 اللقطات وعناصرها <span class="muted">(${d.shots.length})</span></h3>` + d.shots.map((s) => {
    const an = s.analysis, L = s.layers || {}, pick = labx.pick[s.n] ?? L.t ?? (s.start + s.end) / 2;
    return `<article class="lab-shot" data-shot="${s.n}">
      <div class="lab-shotplay">
        <video data-shotvid="${s.n}" data-start="${s.start}" data-end="${s.end}" src="${d.source_url}#t=${s.start},${s.end}"
          poster="${s.frames?.[0]?.url || ""}" preload="none" playsinline></video>
        <div class="row"><button type="button" class="btn sm primary" data-shotplay="${s.n}">▶️ شغّل اللقطة</button>
          <label class="check" title="تكرار"><input type="checkbox" data-shotloop="${s.n}"> 🔁</label></div>
      </div>
      <div class="lab-shotbody">
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
            <button type="button" class="btn sm" data-seek="${e.first_t}" data-to="${e.last_t}" title="شغّل العنصر من أول ما يظهر لحد ما يختفي">▶️</button>
          <span class="lab-time">${lt(e.first_t)} ← ${lt(e.last_t)}</span>${orig(e)}${rv("element", e.id, e.review)}</div>
          <small class="muted" data-no-i18n>${le(e.description)}</small>
          ${(e.actions || []).map((x, i) => `<div class="lab-row lab-act">
            <button type="button" class="btn sm" data-seek="${x.t0}" data-to="${x.t1}" data-playvid>▶️</button>
            <span class="lab-time">${lt(x.t0)}–${lt(x.t1)}</span>
            <select data-fix="action|${e.id}:${i}|action">${labOpts(LAB_ACTIONS, x.action)}</select>
            ${x.from && x.to ? `<small class="muted" dir="ltr">(${x.from.join(", ")}) → (${x.to.join(", ")})</small>` : ""}
            <small class="grow" data-no-i18n>${le(x.detail)}</small>
            ${x.sfx && sfxById[x.sfx] ? `<button type="button" class="btn sm" data-seek="${sfxById[x.sfx].t}" data-to="${sfxById[x.sfx].t + 0.4}" title="الصوت المربوط">🔊 ${le(sfxById[x.sfx].label)}</button>` : ""}
            ${rv("action", `${e.id}:${i}`, x.review)}</div>`).join("")}
        </div>`).join("") || `<p class="muted">مفيش عناصر.</p>`}</div>`
        : `<p class="muted">${d.steps?.elements?.status === "working" ? "⏳ بيفكك العناصر..." : "العناصر لسه ما اتفككتش."}</p>`}
      ${labVedit(d, s)}
      <div class="lab-layers">
        <div class="row wrap"><button type="button" class="btn sm" data-layers="${s.n}" ${L.status === "working" ? "disabled" : ""}>
          ${L.status === "working" ? `<span class="spin-inline"></span> بيفكك الطبقات...` : `🗂️ فكّك الفريم ${lt(pick)} لطبقات`}</button>
          <span class="muted">اختار الفريم من الشريط فوق · بيتحسب على Atlas (حوالي 0.40$ للفريم)${L.price ? ` · آخر مرة: ${le(L.price)}$` : ""}</span></div>
        ${L.error ? `<div class="err">${le(L.error)}</div>` : ""}
        ${(L.items || []).length ? `<button type="button" class="btn primary" data-studio="${s.n}">🎛️ افتح استوديو التحكم في العناصر دي</button>` : ""}
        ${(L.items || []).length ? `<div class="lab-lgrid">
          ${L.base_url ? `<figure><div class="lab-ck"><img src="${L.base_url}" alt=""></div><figcaption>🖼️ الخلفية لوحدها</figcaption></figure>` : ""}
          ${L.items.map((x, i) => `<figure><div class="lab-ck"><img src="${x.url}" alt=""></div>
            <input type="text" value="${le(x.name)}" data-fix="layer|${s.n}:${i}|name" data-no-i18n>${orig(x)}
            ${x.description ? `<small class="muted" data-no-i18n>${le(x.description)}</small>` : ""}${rv("layer", `${s.n}:${i}`, x.review)}</figure>`).join("")}</div>` : ""}
      </div></div></article>`;
  }).join("");
}

// ---------- الأحداث
const labAudio = new Audio();
document.querySelector('.view[data-view="11"]').addEventListener("click", async (e) => {
  const hear = e.target.closest("[data-hear]");
  if (hear) {
    labx.hear[hear.dataset.hear] = !labx.hear[hear.dataset.hear];
    if (Object.values(labx.hear).every(Boolean)) $("labVideo").volume = 1;
    renderLabTimeline(labx.cur);
    return;
  }
  const sp = e.target.closest("[data-shotplay]");
  if (sp) {
    const v = document.querySelector(`[data-shotvid="${sp.dataset.shotplay}"]`);
    if (v && !v.paused) return v.pause();
    return labPlayShot(sp.dataset.shotplay, Number(v.dataset.start));
  }
  const inShot = e.target.closest(".lab-shot");
  const seekIn = e.target.closest("[data-seek]");
  if (inShot && seekIn && !seekIn.dataset.pickt) {
    // جوه اللقطة: الحركة/الصوت بيتشغل في مربع اللقطة نفسها، من قبلها بشوية لبعدها بشوية
    const t = Number(seekIn.dataset.seek), to = Number(seekIn.dataset.to || t + 1.2);
    return labPlayShot(inShot.dataset.shot, t - 0.4, to + 0.4);
  }
  if (inShot && seekIn?.dataset.pickt) {
    const v = inShot.querySelector("[data-shotvid]");
    labx.pick[inShot.dataset.shot] = Number(seekIn.dataset.pickt);
    inShot.querySelectorAll("[data-pickt]").forEach((x) => x.classList.toggle("sel", x === seekIn));
    const lb = inShot.querySelector("[data-layers]");
    if (lb && !lb.disabled) lb.innerHTML = `🗂️ فكّك الفريم ${lt(Number(seekIn.dataset.pickt))} لطبقات`;
    if (v) {
      const show = () => { v.pause(); v.currentTime = Number(seekIn.dataset.pickt); };
      if (v.readyState < 1) { v.preload = "auto"; v.addEventListener("loadedmetadata", show, { once: true }); v.load(); } else show();
    }
    return;
  }
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
  const vbox = e.target.closest("[data-vshot]");
  if (vbox) {
    const n = vbox.dataset.vshot, chip = e.target.closest("[data-vchip]");
    if (chip) { const ta = vbox.querySelector("[data-vtext]"); ta.value += `${ta.value && !ta.value.endsWith(" ") ? " " : ""}«${chip.dataset.vchip}» `; ta.focus(); return; }
    const go = e.target.closest("[data-vgo]"), sp = e.target.closest("[data-vspeed]"), del = e.target.closest("[data-vdel]"), cmp = e.target.closest("[data-vcmp]");
    if (go) {
      const text = vbox.querySelector("[data-vtext]").value.trim();
      if (!text) return toast("اكتب عايز تغيّر إيه", true);
      const sel = vbox.querySelector("[data-vmodel]");
      if (!confirm(`يعدّل المشهد بـ ${sel.selectedOptions[0].textContent}؟`)) return;
      return busyButton(go, "⏳", async () => {
        labx.cur = await api(`/api/lab/${labx.cur.id}/shots/${n}/vedit`, { method: "POST", ...jsonBody({ instruction: text, model: sel.value, base: vbox.querySelector("[data-vbase]")?.value || null }) });
        renderLabShots(labx.cur); scheduleLabPoll();
      });
    }
    if (sp) {
      const g = (k) => Number(vbox.querySelector(`[data-sp="${k}"]`).value);
      return busyButton(sp, "⏳", async () => {
        labx.cur = await api(`/api/lab/${labx.cur.id}/shots/${n}/vedit`, { method: "POST", ...jsonBody({ speed: { t0: g("t0"), t1: g("t1"), factor: g("factor") }, base: vbox.querySelector("[data-vbase]")?.value || null }) });
        renderLabShots(labx.cur); scheduleLabPoll();
      });
    }
    if (del) {
      if (!confirm("تمسح النسخة دي؟")) return;
      labx.cur = await api(`/api/lab/${labx.cur.id}/shots/${n}/vedit/${del.dataset.vdel}`, { method: "DELETE" });
      return renderLabShots(labx.cur);
    }
    if (cmp) {  // الأصلي في مربع اللقطة والنسخة جنبه، بيبدأوا مع بعض
      const v = vbox.querySelector(`[data-vedvid="${cmp.dataset.vcmp}"]`), o = document.querySelector(`[data-shotvid="${n}"]`);
      v.currentTime = 0; v.muted = false; v.play().catch(() => {});
      if (o) { o.muted = true; labPlayShot(n, Number(o.dataset.start)); }
      return;
    }
  }
  const stu = e.target.closest("[data-studio]");
  if (stu) return openStudio(stu.dataset.studio);
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
  if (e.target.dataset.shotloop) {
    const v = document.querySelector(`[data-shotvid="${e.target.dataset.shotloop}"]`);
    if (v) v.dataset.loop = e.target.checked ? "1" : "0";
    return;
  }
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
    // الزراير بتتحدث مكانها من غير ما الصفحة تترسم تاني (عشان الفيديوهات ومكانك ميضيعوش)
    const box = findReview(kind, String(ref));
    if (box && !fix) box.querySelectorAll("[data-rvok]").forEach((b) => {
      const on = ok != null && (b.dataset.rvok === "1") === ok;
      b.className = on ? `on ${ok ? "ok" : "bad"}` : "";
    });
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

// ---------- 🎛️ استوديو التحكم: كل عنصر من الفريم المفكك طبقة نتحكم فيها (مكان، حجم، دوران، لون، حركة وصوتها)
const ls = { lid: null, n: null, sc: null, sel: null, t: 0, playing: false, saveT: null, endMode: false, sfxUrl: {} };
const LS_ENTER = { none: "من غير", fade: "يظهر تدريجي", pop: "ينط (pop)", zoom: "يكبر", slide_up: "يطلع من تحت", slide_down: "ينزل من فوق", slide_left: "يدخل من اليمين", slide_right: "يدخل من الشمال" };
const LS_EXIT = { none: "من غير", fade: "يختفي تدريجي", pop: "يصغر ويختفي", zoom: "يصغر", slide_up: "يطلع لفوق", slide_down: "ينزل لتحت", slide_left: "يخرج شمال", slide_right: "يخرج يمين" };
const LS_EASE = { ease_out: "بيهدى في الآخر", linear: "سرعة ثابتة", ease_in_out: "ناعم من الطرفين", back: "بيعدّي ويرجع (نطة)" };
const lsEase = (p, k) => { p = Math.max(0, Math.min(1, p)); return k === "linear" ? p : k === "ease_in_out" ? 3 * p * p - 2 * p * p * p
  : k === "back" ? 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2 : 1 - (1 - p) ** 3; };
const LS_SLIDE = { slide_up: [0, 1], slide_down: [0, -1], slide_left: [1, 0], slide_right: [-1, 0] };
// نفس حسبة السيرفر (scene.pose) عشان المعاينة تطلع زي الفيديو
function lsPose(L, t) {
  const p = { dx: L.dx, dy: L.dy, scale: L.scale, rot: L.rot, opacity: L.opacity }, a = L.anim, en = L.enter, ex = L.exit;
  if (a.on && a.t1 > a.t0) { const q = lsEase((t - a.t0) / (a.t1 - a.t0), a.ease); for (const k in p) p[k] += (a[k] - p[k]) * q; }
  if (en.type !== "none") {
    if (t < en.t) return null;
    const q = Math.min(1, (t - en.t) / en.dur);
    if (en.type === "fade") p.opacity *= q;
    else if (en.type === "pop") p.scale *= Math.max(0, lsEase(q, "back"));
    else if (en.type === "zoom") { p.scale *= 0.6 + 0.4 * lsEase(q); p.opacity *= q; }
    else if (LS_SLIDE[en.type]) { const [sx, sy] = LS_SLIDE[en.type]; p.dx += sx * 0.3 * (1 - lsEase(q)); p.dy += sy * 0.3 * (1 - lsEase(q)); p.opacity *= Math.min(1, q * 2); }
  }
  if (ex.type !== "none" && t >= ex.t) {
    const q = Math.min(1, (t - ex.t) / ex.dur);
    if (q >= 1) return null;
    if (ex.type === "fade" || ex.type === "zoom") p.opacity *= 1 - q;
    if (ex.type === "pop" || ex.type === "zoom") p.scale *= 1 - (ex.type === "zoom" ? 0.4 : 1) * q * q;
    else if (LS_SLIDE[ex.type]) { const [sx, sy] = LS_SLIDE[ex.type]; p.dx -= sx * 0.3 * q * q; p.dy -= sy * 0.3 * q * q; }
  }
  return p.opacity > 0.003 && p.scale > 0.01 ? p : null;
}
function lsSfxEvents(sc) {
  const ENTER = { pop: "pop", zoom: "whoosh", slide_up: "whoosh", slide_down: "whoosh", slide_left: "whoosh", slide_right: "whoosh" }, ev = [];
  for (const L of sc.layers) {
    if (!L.visible) continue;
    const en = L.enter, ex = L.exit, a = L.anim;
    if (en.type !== "none" && en.sfx !== "none") { const n = en.sfx === "auto" ? ENTER[en.type] : en.sfx; if (n) ev.push([en.t + (en.type === "pop" ? en.dur * 0.55 : 0), n]); }
    if (a.on && a.sfx !== "none" && a.t1 > a.t0) {
      const moved = Math.hypot(a.dx - L.dx, a.dy - L.dy) > 0.03 || Math.abs(a.rot - L.rot) > 10, grew = Math.abs(a.scale - L.scale) > 0.1;
      const n = a.sfx === "auto" ? (moved ? "whoosh" : grew ? "pop" : null) : a.sfx;
      if (n) ev.push([n === "whoosh" ? a.t0 : a.t1, n]);
    }
    if (ex.type !== "none" && ex.sfx !== "none") { const n = ex.sfx === "auto" ? ENTER[ex.type] : ex.sfx; if (n) ev.push([ex.t, n]); }
  }
  return ev.sort((x, y) => x[0] - y[0]);
}

async function openStudio(n) {
  ls.lid = labx.cur.id; ls.n = Number(n); ls.sel = null; ls.t = 0; ls.endMode = false;
  try { ls.sc = await api(`/api/lab/${ls.lid}/shots/${n}/scene`); }
  catch (err) { return toast(err.message, true); }
  $("lsTitle").textContent = `لقطة ${n} · ${ls.sc.layers.length} طبقة`;
  $("lsOut").innerHTML = "";
  $("labStudio").showModal();
  lsRenderAll();
}
function lsRenderAll() {
  const sc = ls.sc;
  $("lsDur").value = sc.duration;
  $("lsScrub").max = sc.duration;
  $("lsBgOn").checked = sc.bg.visible !== false;
  $("lsBgVer").innerHTML = [sc.bg.file, ...(sc.bg.versions || []).slice().reverse()].filter((v, i, a) => v && a.indexOf(v) === i)
    .map((f, i) => `<option value="${f}">${i === 0 ? "الخلفية الحالية" : f === sc.bg.orig_file ? "الخلفية الأصلية" : `نسخة ${i}`}</option>`).join("");
  const st = $("lsStage");
  st.style.aspectRatio = `${sc.W} / ${sc.H}`;
  st.innerHTML = (sc.bg.url ? `<img class="bg" src="${sc.bg.url}" alt="">` : "")
    + sc.layers.map((L) => `<img data-lsl="${L.id}" src="${L.url}" alt="" draggable="false">`).join("")
    + `<div class="lab-st-ghost" id="lsGhost" hidden></div>`;
  lsLayersList();
  lsProps();
  lsPaint();
}
function lsLayersList() {
  $("lsLayers").innerHTML = ls.sc.layers.slice().sort((a, b) => b.z - a.z).map((L) => `<div class="lab-st-li ${L.id === ls.sel ? "sel" : ""}" data-lssel="${L.id}">
    <button type="button" data-lseye="${L.id}" title="إظهار / إخفاء">${L.visible ? "👁" : "🚫"}</button>
    <span class="ck"><img src="${L.url}" alt=""></span><span class="nm" data-no-i18n>${le(L.name)}</span>
    ${L.anim.on || L.enter.type !== "none" || L.exit.type !== "none" ? `<small title="ليه حركة">🎬</small>` : ""}</div>`).join("");
}
// رسم المعاينة في اللحظة ls.t
function lsPaint() {
  const sc = ls.sc, st = $("lsStage");
  const bg = st.querySelector("img.bg");
  if (bg) bg.style.visibility = sc.bg.visible === false ? "hidden" : "";
  for (const L of sc.layers) {
    const el = st.querySelector(`[data-lsl="${L.id}"]`);
    if (!el) continue;
    const p = L.visible ? lsPose(L, ls.t) : null;
    el.hidden = !p;
    if (!p) continue;
    const [x1, y1, x2, y2] = L.box;
    Object.assign(el.style, { left: `${(x1 / sc.W) * 100}%`, top: `${(y1 / sc.H) * 100}%`, width: `${((x2 - x1) / sc.W) * 100}%`,
      height: `${((y2 - y1) / sc.H) * 100}%`, zIndex: 10 + L.z, opacity: p.opacity,
      transform: `translate(${p.dx * 100 * sc.W / (x2 - x1)}%, ${p.dy * 100 * sc.H / (y2 - y1)}%) rotate(${p.rot}deg) scale(${p.scale * (L.flip ? -1 : 1)}, ${p.scale})`,
      filter: `hue-rotate(${L.hue}deg) saturate(${L.sat}) brightness(${L.bright})` });
    el.classList.toggle("sel", L.id === ls.sel);
  }
  // شبح مكان نهاية الحركة للطبقة المختارة
  const L = ls.sc.layers.find((x) => x.id === ls.sel), g = $("lsGhost");
  g.hidden = !(L && L.anim.on);
  if (L && L.anim.on) {
    const [x1, y1, x2, y2] = L.box;
    Object.assign(g.style, { left: `${(x1 / sc.W + L.anim.dx) * 100}%`, top: `${(y1 / sc.H + L.anim.dy) * 100}%`,
      width: `${((x2 - x1) / sc.W) * 100}%`, height: `${((y2 - y1) / sc.H) * 100}%`,
      transform: `rotate(${L.anim.rot}deg) scale(${L.anim.scale})`, zIndex: 999 });
  }
  $("lsT").textContent = ls.t.toFixed(2);
  $("lsScrub").value = ls.t;
}
const lsNum = (k, label, min, max, step, val, suffix = "") => `<label class="lab-st-f"><span>${label}</span>
  <input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-lsf="${k}"><b>${Number(val).toFixed(step < 1 ? 2 : 0)}${suffix}</b></label>`;
function lsProps() {
  const L = ls.sc.layers.find((x) => x.id === ls.sel);
  if (!L) { $("lsProps").innerHTML = `<p class="muted">دوس على أي عنصر في الصورة أو في القايمة عشان تتحكم فيه. اسحبه بالماوس عشان تغيّر مكانه.</p>`; return; }
  const sfxOpts = (v) => `<option value="auto" ${v === "auto" ? "selected" : ""}>🔊 صوت تلقائي</option><option value="none" ${v === "none" ? "selected" : ""}>🔇 من غير صوت</option>`
    + (ls.sc.sfx || []).map((s) => `<option value="${s}" ${s === v ? "selected" : ""}>${s}</option>`).join("");
  $("lsProps").innerHTML = `<div class="row"><b data-no-i18n>${le(L.name)}</b><span class="spacer"></span>
      <button type="button" class="btn sm" data-lsz="1" title="لقدام">⬆</button><button type="button" class="btn sm" data-lsz="-1" title="لورا">⬇</button>
      <button type="button" class="btn sm" data-lsreset>↺ زي الأصل</button></div>
    ${lsNum("scale", "الحجم", 0.1, 4, 0.01, L.scale, "×")}${lsNum("rot", "الدوران", -180, 180, 1, L.rot, "°")}
    ${lsNum("opacity", "الشفافية", 0, 1, 0.01, L.opacity)}${lsNum("hue", "اللون", -180, 180, 1, L.hue, "°")}
    ${lsNum("sat", "التشبع", 0, 3, 0.01, L.sat)}${lsNum("bright", "السطوع", 0, 3, 0.01, L.bright)}
    <label class="check"><input type="checkbox" data-lsf="flip" ${L.flip ? "checked" : ""}> ↔️ اقلبه</label>
    <div class="lab-st-sub"><b>✏️ غيّر شكله بالـ AI</b> <small class="muted">(لون محدد، لبس، تفاصيل · حوالي 0.005$)</small>
      <div class="row"><input type="text" id="lsEditTxt" placeholder="مثلًا: make it blue / خليه أحمر لامع"><button type="button" class="btn sm" data-lsedit>✨</button></div>
      <div class="row"><label class="btn sm">⬆ بدّله بصورة<input type="file" accept="image/*" data-lsup hidden></label>
        ${(L.versions || []).length ? `<select data-lsver class="sm"><option value="">النسخ القديمة (${L.versions.length})</option>${L.versions.slice().reverse().map((v, i) => `<option value="${v}">${v === L.orig_file ? "الأصلية" : `نسخة ${L.versions.length - i}`}</option>`).join("")}</select>` : ""}</div></div>
    <div class="lab-st-sub"><b>🎬 الحركة</b>
      <label class="lab-st-f"><span>دخول</span><select data-lsx="enter.type">${labOpts(LS_ENTER, L.enter.type)}</select>
        <input type="number" step="0.1" min="0" value="${L.enter.t}" data-lsx="enter.t" title="إمتى (ثانية)"><select data-lsx="enter.sfx">${sfxOpts(L.enter.sfx)}</select></label>
      <label class="check"><input type="checkbox" data-lsx="anim.on" ${L.anim.on ? "checked" : ""}> ينتقل لمكان/حجم تاني</label>
      ${L.anim.on ? `<div class="lab-st-anim">
        <label class="lab-st-f"><span>من ثانية</span><input type="number" step="0.1" min="0" value="${L.anim.t0}" data-lsx="anim.t0"><span>لـ</span><input type="number" step="0.1" min="0" value="${L.anim.t1}" data-lsx="anim.t1"></label>
        <button type="button" class="btn sm ${ls.endMode ? "primary" : ""}" data-lsend>${ls.endMode ? "✅ خلصت (اسحب العنصر لمكان النهاية)" : "📍 حدد مكان النهاية بالسحب"}</button>
        ${lsNum("anim.scale", "حجم النهاية", 0.1, 4, 0.01, L.anim.scale, "×")}${lsNum("anim.rot", "دوران النهاية", -360, 360, 1, L.anim.rot, "°")}
        ${lsNum("anim.opacity", "شفافية النهاية", 0, 1, 0.01, L.anim.opacity)}
        <label class="lab-st-f"><span>الإحساس</span><select data-lsx="anim.ease">${labOpts(LS_EASE, L.anim.ease)}</select><select data-lsx="anim.sfx">${sfxOpts(L.anim.sfx)}</select></label>
      </div>` : ""}
      <label class="lab-st-f"><span>خروج</span><select data-lsx="exit.type">${labOpts(LS_EXIT, L.exit.type)}</select>
        <input type="number" step="0.1" min="0" value="${L.exit.t}" data-lsx="exit.t" title="إمتى (ثانية)"><select data-lsx="exit.sfx">${sfxOpts(L.exit.sfx)}</select></label>
    </div>`;
}
function lsSave() {
  clearTimeout(ls.saveT);
  ls.saveT = setTimeout(async () => {
    try {
      const { sfx, ...body } = ls.sc;
      const keep = ls.sel;
      ls.sc = await api(`/api/lab/${ls.lid}/shots/${ls.n}/scene`, { method: "PUT", ...jsonBody(body) });
      ls.sel = keep;
    } catch (err) { toast(err.message, true); }
  }, 500);
}
const lsLayer = () => ls.sc.layers.find((x) => x.id === ls.sel);
function lsSetPath(obj, path, v) { const [a, b] = path.split("."); if (b) obj[a][b] = v; else obj[a] = v; }

$("labStudio").addEventListener("input", (e) => {
  const L = lsLayer();
  const f = e.target.dataset.lsf;
  if (f && L) {
    const v = e.target.type === "checkbox" ? e.target.checked : Number(e.target.value);
    lsSetPath(L, f, v);
    const b = e.target.parentElement.querySelector("b");
    if (b && e.target.type === "range") b.textContent = `${v.toFixed(Number(e.target.step) < 1 ? 2 : 0)}`;
    lsPaint(); lsSave();
  }
  if (e.target === $("lsScrub")) { ls.t = Number(e.target.value); lsPaint(); }
});
$("labStudio").addEventListener("change", (e) => {
  const L = lsLayer(), x = e.target.dataset.lsx;
  if (x && L) {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.type === "number" ? Number(e.target.value) : e.target.value;
    lsSetPath(L, x, v);
    if (x === "anim.on" && v) Object.assign(L.anim, { dx: L.dx + 0.15, dy: L.dy - 0.1, scale: L.scale, rot: L.rot, opacity: L.opacity, t1: Math.max(L.anim.t1, L.anim.t0 + 0.6) });
    if (x === "enter.type" && v !== "none" && L.enter.dur === undefined) L.enter.dur = 0.4;
    lsProps(); lsLayersList(); lsPaint(); lsSave();
    return;
  }
  if (e.target === $("lsDur")) { ls.sc.duration = Number(e.target.value) || 4; $("lsScrub").max = ls.sc.duration; lsSave(); }
  if (e.target === $("lsBgOn")) { ls.sc.bg.visible = e.target.checked; lsPaint(); lsSave(); }
  if (e.target === $("lsBgVer") && e.target.value) {
    const old = ls.sc.bg.file; ls.sc.bg.file = e.target.value;
    ls.sc.bg.versions = [...(ls.sc.bg.versions || []).filter((v) => v !== e.target.value), old];
    lsSave(); setTimeout(() => lsReload(), 700);
  }
  if (e.target.matches("[data-lsver]") && e.target.value && L) {
    const old = L.file; L.file = e.target.value; L.versions = [...L.versions.filter((v) => v !== e.target.value), old];
    lsSave(); setTimeout(() => lsReload(), 700);
  }
  if (e.target.matches("[data-lsup]") && L) {
    const f = e.target.files[0];
    if (!f) return;
    const form = new FormData(); form.append("file", f);
    toast("⏳ بيحط الصورة مكان العنصر...");
    api(`/api/lab/${ls.lid}/shots/${ls.n}/scene/layers/${L.id}/upload`, { method: "POST", body: form })
      .then((sc) => { ls.sc = sc; lsRenderAll(); }).catch((err) => toast(err.message, true));
  }
});
async function lsReload() { const keep = ls.sel; ls.sc = await api(`/api/lab/${ls.lid}/shots/${ls.n}/scene`); ls.sel = keep; lsRenderAll(); }
$("labStudio").addEventListener("click", async (e) => {
  const sel = e.target.closest("[data-lssel]"), eye = e.target.closest("[data-lseye]");
  if (eye) { const L = ls.sc.layers.find((x) => x.id === eye.dataset.lseye); L.visible = !L.visible; lsLayersList(); lsPaint(); lsSave(); return; }
  if (sel) { ls.sel = sel.dataset.lssel; ls.endMode = false; lsLayersList(); lsProps(); lsPaint(); return; }
  const L = lsLayer();
  if (e.target.closest("[data-lsz]") && L) { L.z += Number(e.target.closest("[data-lsz]").dataset.lsz) * 1.5; lsLayersList(); lsPaint(); lsSave(); return; }
  if (e.target.closest("[data-lsreset]") && L) {
    Object.assign(L, { dx: 0, dy: 0, scale: 1, rot: 0, opacity: 1, flip: false, hue: 0, sat: 1, bright: 1 });
    L.anim.on = false; L.enter.type = "none"; L.exit.type = "none";
    lsProps(); lsLayersList(); lsPaint(); lsSave(); return;
  }
  if (e.target.closest("[data-lsend]")) { ls.endMode = !ls.endMode; if (ls.endMode && L) { ls.t = L.anim.t1; } lsProps(); lsPaint(); return; }
  const ed = e.target.closest("[data-lsedit]");
  if (ed && L) {
    const txt = $("lsEditTxt").value.trim();
    if (!txt) return toast("اكتب التعديل", true);
    await busyButton(ed, "⏳", async () => { clearTimeout(ls.saveT); ls.sc = await api(`/api/lab/${ls.lid}/shots/${ls.n}/scene/layers/${L.id}/edit`, { method: "POST", ...jsonBody({ instruction: txt }) }); });
    lsRenderAll();
  }
});
$("lsClose").onclick = () => { ls.playing = false; $("labStudio").close(); };
$("lsAskGo").onclick = () => busyButton($("lsAskGo"), "⏳ بيفكر...", async () => {
  const txt = $("lsAsk").value.trim();
  if (!txt) return toast("اكتب عايز تعمل إيه", true);
  clearTimeout(ls.saveT);
  const r = await api(`/api/lab/${ls.lid}/shots/${ls.n}/scene/ai`, { method: "POST", ...jsonBody({ instruction: txt }) });
  ls.sc = r;
  $("lsAskNote").textContent = [r.notes, r.edits?.length ? `✏️ اتعدّل شكل ${r.edits.length} عنصر بالـ AI` : "", ...(r.errors || [])].filter(Boolean).join(" · ");
  lsRenderAll();
});
$("lsBgClean").onclick = () => busyButton($("lsBgClean"), "⏳", async () => {
  if (!confirm("يعمل خلفية نضيفة من غير ناس ولا عناصر (بالـ AI، حوالي 0.005$)؟")) return;
  clearTimeout(ls.saveT);
  ls.sc = await api(`/api/lab/${ls.lid}/shots/${ls.n}/scene/bg/clean`, { method: "POST" });
  lsRenderAll();
});
// المعاينة: الحركة بتتشغل في المتصفح بأصواتها
$("lsPlay").onclick = () => {
  if (ls.playing) { ls.playing = false; $("lsPlay").textContent = "▶️ معاينة"; return; }
  ls.playing = true; $("lsPlay").textContent = "⏸ وقف";
  const ev = lsSfxEvents(ls.sc), t0 = performance.now(); let k = 0;
  const step = () => {
    if (!ls.playing) return;
    ls.t = (performance.now() - t0) / 1000;
    while (k < ev.length && ev[k][0] <= ls.t) { new Audio(`/api/fx/sfx/${ev[k][1]}.wav`).play().catch(() => {}); k++; }
    if (ls.t >= ls.sc.duration) { ls.t = ls.sc.duration; ls.playing = false; $("lsPlay").textContent = "▶️ معاينة"; }
    lsPaint();
    if (ls.playing) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
$("lsRender").onclick = () => busyButton($("lsRender"), "⏳ بيرسم...", async () => {
  clearTimeout(ls.saveT);
  const { sfx, ...body } = ls.sc;
  ls.sc = await api(`/api/lab/${ls.lid}/shots/${ls.n}/scene`, { method: "PUT", ...jsonBody(body) });
  const r = await api(`/api/lab/${ls.lid}/shots/${ls.n}/scene/render`, { method: "POST" });
  $("lsOut").innerHTML = `<video src="${r.url}" controls autoplay playsinline></video><a class="btn sm" href="${r.url}" download>⬇ نزّل الفيديو</a>`;
});
// السحب: بيغيّر المكان (أو مكان النهاية لو «حدد مكان النهاية» شغال)
$("lsStage").addEventListener("pointerdown", (e) => {
  const el = e.target.closest("[data-lsl]");
  if (!el) return;
  e.preventDefault();
  ls.sel = el.dataset.lsl;
  const L = lsLayer(), r = $("lsStage").getBoundingClientRect();
  if (!ls.endMode) { lsLayersList(); lsProps(); }
  const key = ls.endMode && L.anim.on ? L.anim : L;
  const sx = e.clientX, sy = e.clientY, ox = key.dx, oy = key.dy;
  const move = (ev) => { key.dx = ox + (ev.clientX - sx) / r.width; key.dy = oy + (ev.clientY - sy) / r.height; lsPaint(); };
  const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); lsSave(); };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
});
