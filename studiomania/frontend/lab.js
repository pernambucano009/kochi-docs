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
  const shotPlaying = [...document.querySelectorAll("[data-shotvid]")].some((v) => !v.paused);
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
