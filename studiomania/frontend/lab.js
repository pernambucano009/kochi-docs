// StudioMania — 🔬 معمل التفكيك: البرنامج بيفكك أي فيديو لعناصره، وإنت بتراجع وتقيّم كل حاجة.
// القطعات وبدايات الأصوات بتتقاس بالكود، والموديل بيسمّي ويوصف، وتقييمك (✅ ❌ والتصحيح) بيتحفظ مع الأصل.

const labx = { list: [], cur: null, timer: null, pick: {}, aopen: {}, view: "lab", cfilter: "", audioOpen: false, hear: { speech: true, music: true, sfx: true }, stems: null, win: {} };
const LAB_KEY = "studiomania.lab";
const LAB_SFX_CAT = { click: "🖱️ كليك", whoosh: "💨 ووش", pop: "💥 بوب", impact: "🥁 خبطة", typing: "⌨️ كتابة", swipe: "🖍️ سحبة",
  notification: "🔔 إشعار", riser: "📈 رايزر", transition: "🔀 انتقال", ui: "📱 صوت واجهة", foley: "👣 فولي", ambience: "🌫️ جو المكان", other: "❔ تاني" };
const LAB_TYPES = { character: "🧍 شخصية", background: "🖼️ خلفية", cursor: "🖱️ مؤشر ماوس", icon: "⭐ أيقونة", file: "📄 ملف", folder: "📁 فولدر",
  window: "🪟 نافذة", button: "🔘 زرار", text: "🔤 كلام", logo: "🏷️ لوجو", photo: "🖼️ صورة", ui: "📱 واجهة", object: "📦 حاجة", shape: "🔷 شكل",
  effect: "✨ افيكت", other: "❔ تاني" };
const LAB_ACTIONS = { appear: "بيظهر", disappear: "بيختفي", move: "بيتحرك", click: "بيدوس", drag: "بيسحب", drop: "بيسيب", type: "بيكتب",
  scale: "بيكبر/يصغر", rotate: "بيلف", highlight: "بيتعمله هايلايت", transform: "بيتحول", speak: "بيتكلم", gesture: "بيشاور", other: "تاني" };
const LAB_SCENE = { live_action: "🎥 تصوير حقيقي", screen_recording: "🖥️ تسجيل شاشة", motion_graphics: "✨ موشن جرافيك", mixed: "🔀 مزيج" };
const LAB_STEP = { shots: "✂️ القطعات", elements: "🧩 العناصر", components: "💡 الكومبوننتس", stems: "🎚️ فصل التراكات", audio: "🎧 الصوت" };
const LAB_STEMS = { dialogue: "🗣️ الكلام", music: "🎵 الموسيقى", effects: "🔊 المؤثرات" };
const lt = (t) => `${Math.floor((t || 0) / 60)}:${((t || 0) % 60).toFixed(2).padStart(5, "0")}`;
const le = (v) => escapeHtml(v == null ? "" : String(v));
const labOpts = (map, v) => Object.entries(map).map(([k, l]) => `<option value="${k}" ${k === v ? "selected" : ""}>${l}</option>`).join("");

viewHooks["11"] = initLab;
async function initLab() {
  labx.list = await api("/api/lab");
  const want = labx.cur?.id || storageGet(LAB_KEY);
  const id = labx.list.some((x) => x.id === want) ? want : labx.list[0]?.id;
  labLibCount();
  if (id) await openLab(id);
  else renderLab();
  if (labx.view === "lib") openLib(asx.cur?.id);
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
  const d = labx.cur, lib = labx.view === "lib";
  $("labLibBtn").classList.toggle("active", lib);
  $("labLib").hidden = !lib;
  $("labMain").hidden = !d || lib;
  $("labEmpty").hidden = !!d || lib;
  if (!d || lib) return;
  if (document.activeElement !== $("labName")) $("labName").value = d.name;
  $("labSplit").value = d.split || "fine";
  $("labSplit").disabled = d.busy;
  document.querySelectorAll("[data-labrun]").forEach((b) => (b.disabled = d.busy));
  $("labStatus").innerHTML = Object.entries(LAB_STEP).filter(([k]) => !["stems", "audio"].includes(k) || d.steps?.[k]).map(([k, l]) => {
    const s = d.steps?.[k] || {};
    return `<span class="lab-st ${s.status || ""}">${s.status === "working" ? `<span class="spin-inline"></span>` : s.status === "done" ? "✅" : s.status === "failed" ? "✕" : s.status === "skipped" ? "⏭" : "⏸"}
      ${l}${s.progress ? ` <small>${le(s.progress)}</small>` : ""}${s.error ? ` <small class="err">${le(s.error)}</small>` : ""}</span>`;
  }).join("");
  renderLabScore(d);
  renderLabTimeline(d);
  const busyEdit = (el) => el.contains(document.activeElement) && document.activeElement.matches("input, select, textarea");
  const compPlaying = [...$("labComps").querySelectorAll("video")].some((v) => !v.paused);
  if (!busyEdit($("labComps")) && !compPlaying) renderLabComps(d);
  if (!busyEdit($("labAudio"))) renderLabAudio(d);
  const shotPlaying = [...document.querySelectorAll("[data-shotvid]")].some((v) => !v.paused);
  if (!busyEdit($("labShots")) && !shotPlaying) renderLabShots(d);
}

const LAB_SCORE = { components: "💡 الكومبوننتس المقبولة", shots: "✂️ القطعات", stems: "🎚️ التراكات", sfx: "🔊 المؤثرات", music: "🎵 الموسيقى", speech: "🗣️ الكلام" };
function renderLabScore(d) {
  const r = d.reviews || {};
  $("labScore").innerHTML = `<b>👤 تقييمك:</b>` + Object.entries(LAB_SCORE).filter(([k]) => r[k]?.total && (k === "components" || r[k].ok + r[k].bad)).map(([k, l]) => {
    const x = r[k], done = x.ok + x.bad, acc = done ? Math.round((x.ok / done) * 100) : null;
    return `<span class="lab-sc" title="✅ ${x.ok} · ❌ ${x.bad} · لسه ${x.total - done}">${l} <b>${acc == null ? "—" : acc + "%"}</b>
      <small>${done}/${x.total}</small></span>`;
  }).join("");
}

// التايم لاين: لقطات / كلام / موسيقى / مؤثرات، والمؤشر ماشي مع الفيديو
function renderLabTimeline(d) {
  const T = d.source.duration || 1, pct = (t) => `${(Math.max(0, Math.min(T, t)) / T) * 100}%`, a = d.audio || {};
  const lane = (label, items, k) => `<div class="lab-lane"><span class="lab-ll">${k ? `<button type="button" class="lab-hear ${labx.hear[k] ? "on" : ""}" data-hear="${k}" title="اسمع / اقفل">${labx.hear[k] ? "🔊" : "🔇"}</button>` : ""}${label}</span><div class="lab-lt">${items}</div></div>`;
  const allOn = Object.values(labx.hear).every(Boolean), hasAudio = !!(a.sfx || a.speech || a.music);
  const cst = (c) => c.asset ? "ok" : c.review?.ok === false ? "bad" : "";
  $("labTimeline").innerHTML =
    lane("✂️ اللقطات", (d.shots || []).map((s) => `<i class="blk shot ${s.review?.ok === false ? "bad" : ""} ${s.ignored ? "off" : ""} ${s.cut === "change" ? "chg" : ""}" style="right:${pct(s.start)};width:calc(${pct(s.end - s.start)} - 2px)" data-seek="${s.start}" title="لقطة ${s.n}">${s.n}</i>`).join(""))
    + lane("💡 كومبوننتس", (d.components || []).map((c) => `<i class="blk comp ${cst(c)}" style="right:${pct(c.t0)};width:calc(${pct(c.t1 - c.t0)} - 2px)" data-seek="${c.t0}" data-gocomp="${c.id}" title="${le(c.name)}"></i>`).join(""))
    + (!hasAudio ? "" : `<div class="lab-hearnote ${allOn ? "" : "on"}">${allOn ? "🎧 دوس 🔊 جنب أي حارة عشان تقفلها وتسمع الباقي لوحده"
      : labx.stems ? "🎚️ بتسمع التراكات المفصولة اللي مفتوحة بس" : "⚠️ مفيش تراكات مفصولة: الصوت بيسكت برا أوقات الحاجات اللي مفتوحة (تقدر تتأكد من التوقيت، بس الكلام والموسيقى في نفس اللحظة بيبقوا مع بعض)"}</div>`
    + lane("🗣️ كلام", (a.speech || []).map((s) => `<i class="blk sp" style="right:${pct(s.start)};width:${pct(s.end - s.start)}" data-seek="${s.start}" title="${le(s.text)}"></i>`).join(""), "speech")
    + lane("🎵 موسيقى", (a.music || []).map((s) => `<i class="blk mu" style="right:${pct(s.start)};width:${pct(s.end - s.start)}" data-seek="${s.start}" title="${le(s.description)}"></i>`).join(""), "music")
    + lane("🔊 مؤثرات", (a.sfx || []).map((x) => `<i class="tick ${x.review?.ok === false ? "bad" : x.review?.ok ? "ok" : ""}" style="right:${pct(x.t)}" data-seek="${x.t}" data-clip="${x.clip_url || ""}" title="${le(x.label)} · ${lt(x.t)}"></i>`).join(""), "sfx"))
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
  document.querySelectorAll("[data-cvid]").forEach((x) => {  // كارت الكومبوننت: بيلف على الحتة بتاعته بس
    if (!x.paused && (x.currentTime >= Number(x.dataset.t1) || x.currentTime < Number(x.dataset.t0) - 0.3)) x.currentTime = Number(x.dataset.t0);
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
  const inner = labAudioInner(d);
  $("labAudio").innerHTML = `<details data-audiobox ${labx.audioOpen ? "open" : ""}><summary><b>🎧 الصوت</b> <span class="muted">(متوقف دلوقتي: الأصل بيتحفظ بصوته الأصلي، والتحليل ده تجريبي)</span></summary>
    <div class="row wrap"><button type="button" class="btn sm" data-labrun="stems">🎚️ افصل التراكات (AudioShake)</button>
      <button type="button" class="btn sm" data-labrun="audio">🎧 حلّل الصوت</button></div>${inner}</details>`;
}
function labAudioInner(d) {
  const a = d.audio || {};
  if (a.none) return `<p class="muted">الفيديو ده مفيهوش صوت.</p>`;
  if (!a.sfx && !a.speech) return `<p class="muted">${d.steps?.audio?.status === "working" ? "⏳ بيفكك الصوت..." : "لسه ما اتفككش."}</p>`;
  const sfx = a.sfx || [];
  return `<h4>🎧 الصوت <span class="muted">(${sfx.length} مؤثر · ${(a.speech || []).length} جملة · ${(a.music || []).length} موسيقى · ${(a.onsets || []).length} بداية صوت اتقاست)</span></h4>
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

// 📚 احفظ مقطع من اللقطة (بحركته وخلفيته وصوته) كأصل في المكتبة
const ASSET_CATS = { motion_graphics: "✨ موشن جرافيك", effect: "💥 افيكت", transition: "🔀 انتقال", text: "🔤 كلام متحرك",
  screen: "🖥️ تسجيل شاشة / واجهة", cursor: "🖱️ حركة ماوس", character: "🧍 شخصية", background: "🖼️ خلفية", product: "📦 منتج", other: "تاني" };
function labAssetForm(d, s) {
  const els = s.analysis?.elements || [], T = d.source.duration;
  const guess = s.analysis?.scene_type === "screen_recording" ? "screen" : s.analysis?.scene_type === "motion_graphics" ? "motion_graphics" : "other";
  return `<details class="lab-asset" data-ashot="${s.n}" ${labx.aopen[s.n] ? "open" : ""}><summary>📚 احفظ حتة بإيدك</summary>
    <small class="muted">لو الاقتراحات فاتتها حاجة: بتاخد المقطع زي ما هو (الحركة والخلفية والصوت) ومعاه تفكيك عناصره، وتقدر تعدّي حدود اللقطة.</small>
    <div class="lab-chips"><button type="button" class="chip" data-arange="${s.start},${s.end}">🎬 اللقطة كلها</button>
      ${els.map((e) => `<button type="button" class="chip" data-arange="${e.first_t},${e.last_t}" data-aname="${le(e.name)}">${LAB_TYPES[e.type]?.split(" ")[0] || ""} ${le(e.name)} <small>${lt(e.first_t)}–${lt(e.last_t)}</small></button>`).join("")}</div>
    <div class="row wrap">
      <input type="text" data-af="name" placeholder="اسم الأصل" value="${le((s.analysis?.summary || "").slice(0, 80))}" data-no-i18n>
      <select data-af="category">${labOpts(ASSET_CATS, guess)}</select>
      <input type="text" data-af="tags" placeholder="تاجز: ماوس، سحب، فولدر" data-no-i18n>
    </div>
    <div class="row wrap"><label>من <input type="number" step="0.05" min="0" max="${T}" value="${s.start.toFixed(2)}" data-af="t0"></label>
      <label>لـ <input type="number" step="0.05" min="0" max="${T}" value="${s.end.toFixed(2)}" data-af="t1"></label>
      <small class="muted">(بالثواني من أول الفيديو)</small>
      <button type="button" class="btn sm primary" data-asave>📚 احفظ</button></div>
  </details>`;
}

// ---------- 💡 الكومبوننتس المقترحة: كل كارت حتة من الفيديو بتلف لوحدها، ✅ = تدخل المكتبة، ❌ = مرفوضة (وسببك بيعلّم الموديل)
const COMP_FILTER = { "": "الكل", todo: "لسه", ok: "في المكتبة", bad: "مرفوضة" };
const compState = (c) => (c.asset ? "ok" : c.review?.ok === false ? "bad" : "todo");
function compPoster(d, t) {
  const fr = (d.shots || []).flatMap((s) => s.frames || []);
  return (fr.find((f) => f.t >= t) || fr[fr.length - 1])?.url || "";
}
function renderLabComps(d) {
  const all = d.components || [], st = d.steps?.components || {};
  const n = { todo: 0, ok: 0, bad: 0 };
  all.forEach((c) => n[compState(c)]++);
  const items = all.filter((c) => !labx.cfilter || compState(c) === labx.cfilter);
  $("labComps").innerHTML = `<h3 class="pane-h">💡 الكومبوننتس المقترحة <span class="muted">(${all.length})</span>
      <button type="button" class="btn sm" data-labrun="components" ${d.busy ? "disabled" : ""} title="اقتراحات جديدة. اللي قبلته أو رفضته بيفضل زي ما هو">↻ اقترح تاني</button>
      ${all.length ? `<button type="button" class="btn sm danger" data-compfresh ${d.busy ? "disabled" : ""} title="يمسح كل الاقتراحات ويقترح من الصفر">🗑️ امسح واقترح من جديد</button>` : ""}</h3>
    <p class="hint">الموديل طلّع الحتت دي من التفكيك. اتفرج على كل واحدة: ✅ تدخل المكتبة على طول بحركتها وخلفيتها وصوتها ومفاتيح التحكم بتاعتها، ❌ ترفضها واكتب السبب عشان الاقتراحات الجاية تبقى أحسن. تقدر تظبط الاسم والبداية والنهاية قبل ما تقبل.</p>
    ${st.status === "working" || st.status === "queued" ? `<p class="muted"><span class="spin-inline"></span> ${le(st.progress || "مستني العناصر تخلص...")}</p>` : ""}
    ${st.status === "skipped" || st.status === "failed" ? `<p class="err">${le(st.error)}</p>` : ""}
    ${all.length ? `<div class="lab-chips">${Object.entries(COMP_FILTER).map(([k, l]) => `<button type="button" class="chip ${labx.cfilter === k ? "on" : ""}" data-cfilter="${k}">${l} <small>${k ? n[k] : all.length}</small></button>`).join("")}</div>` : ""}
    <div class="lab-comps">${items.map((c) => {
      const s = compState(c), cat = d.categories || Object.keys(ASSET_CATS);
      return `<article class="lab-comp ${s}" data-comp="${c.id}">
        <video data-cvid data-t0="${c.t0}" data-t1="${c.t1}" src="${d.source_url}#t=${c.t0}" poster="${compPoster(d, c.t0)}" preload="none" playsinline controls></video>
        <input type="text" class="lab-cname" value="${le(c.name)}" data-cf="name" data-no-i18n>
        <div class="row wrap"><select data-cf="category">${cat.map((k) => `<option value="${k}" ${k === c.category ? "selected" : ""}>${ASSET_CATS[k] || k}</option>`).join("")}</select>
          <label>من <input type="number" step="0.05" min="0" max="${d.source.duration}" value="${c.t0}" data-cf="t0"></label>
          <label>لـ <input type="number" step="0.05" min="0" max="${d.source.duration}" value="${c.t1}" data-cf="t1"></label>
          <small class="muted">${(c.t1 - c.t0).toFixed(2)} ث</small></div>
        ${c.description ? `<small data-no-i18n>${le(c.description)}</small>` : ""}
        ${c.use ? `<small class="muted" data-no-i18n>💼 ${le(c.use)}</small>` : ""}
        ${(c.controls || []).length ? `<div class="lab-ctls"><b>🎛️ مفاتيح التحكم:</b>${c.controls.map((k) => `<span class="lab-ctl" title="${le(k.target)}">${k.type === "color" && /^#[0-9a-f]{3,8}$/i.test(k.value) ? `<i style="background:${le(k.value)}"></i>` : ""}<span data-no-i18n>${le(k.label)}: <b>${le(k.value)}</b></span></span>`).join("")}</div>` : ""}
        ${(c.tags || []).length ? `<small class="as-tags" data-no-i18n>${c.tags.map((t) => `#${le(t)}`).join(" ")}</small>` : ""}
        <div class="row wrap lab-cact">
          ${c.asset ? `<button type="button" class="btn sm ok" data-casset="${c.asset}">📚 في المكتبة ↗</button>`
            : `<button type="button" class="btn sm primary" data-cok>✅ اقبل وحطه في المكتبة</button>`}
          <button type="button" class="btn sm ${s === "bad" ? "danger" : ""}" data-cbad>❌ ${s === "bad" ? "مرفوض" : "ارفض"}</button>
          <input type="text" class="lab-note grow" value="${le(c.review?.note)}" placeholder="ليه؟ (مثلًا: مقطوع من النص، مش مفيد)" data-cnote>
        </div>
      </article>`;
    }).join("") || (all.length ? `<p class="muted">مفيش حاجة هنا.</p>` : st.status === "done" ? `<p class="muted">الموديل ملقاش حتت تستاهل تتحفظ.</p>` : "")}</div>`;
}
async function labComp(cid, body, btn) {
  const go = async () => {
    labx.cur = await api(`/api/lab/${labx.cur.id}/components/${cid}`, { method: "PATCH", ...jsonBody(body) });
    renderLabComps(labx.cur); renderLabTimeline(labx.cur); renderLabScore(labx.cur);
    if (body.ok) { toast("📚 اتحفظ في المكتبة"); labLibCount(); }
  };
  if (btn) return busyButton(btn, "⏳", go);
  try { await go(); } catch (err) { toast(err.message, true); }
}

function renderLabShots(d) {
  const sfxById = Object.fromEntries((d.audio?.sfx || []).map((x) => [x.id, x]));
  if (!(d.shots || []).length) { $("labShots").innerHTML = `<h3 class="pane-h">🎬 اللقطات</h3><p class="muted">${d.steps?.shots?.status === "working" ? "⏳ بيدور على القطعات..." : "لسه."}</p>`; return; }
  const kept = d.shots.filter((s) => !s.ignored), gone = d.shots.filter((s) => s.ignored);
  const noComp = kept.filter((s) => !(d.components || []).some((c) => c.review?.ok !== false && c.t0 < s.end && c.t1 > s.start));
  $("labShots").innerHTML = `<h3 class="pane-h">🎬 اللقطات وعناصرها <span class="muted">(${kept.length}${gone.length ? ` من ${d.shots.length}` : ""})</span>
      ${noComp.length && (d.components || []).length ? `<button type="button" class="btn sm" data-prune title="${noComp.map((s) => s.n).join("، ")}">🧹 شيل اللقطات اللي ملهاش كومبوننتس (${noComp.length})</button>` : ""}</h3>
    ${gone.length ? `<details class="lab-gone"><summary>🙈 لقطات اتشالت (${gone.length}) <span class="muted">مش بتدخل في الكومبوننتس. البرنامج بيشيل لوحده التصوير العادي اللي مفيهوش موشن جرافيك.</span></summary>
      ${gone.map((s) => `<div class="lab-row"><img src="${s.frames?.[0]?.url || ""}" alt="" class="lab-gone-th">
        <b>لقطة ${s.n}</b> <span class="lab-time">${lt(s.start)} ← ${lt(s.end)}</span>
        <small class="muted grow" data-no-i18n>${s.ignored.by === "auto" ? "🤖 " : "✋ "}${le(s.ignored.reason)}${s.analysis?.summary ? ` · ${le(s.analysis.summary)}` : ""}</small>
        <button type="button" class="btn sm" data-seek="${s.start}" data-playvid>▶️</button>
        <button type="button" class="btn sm" data-unhide="${s.n}">↩ رجّعها</button></div>`).join("")}</details>` : ""}` + kept.map((s) => {
    const an = s.analysis, pick = labx.pick[s.n] ?? -1;
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
        <span class="muted">القطع مظبوط؟</span>${rv("shot", s.n, s.review)}
        ${s.cut === "change" ? `<span class="chip" title="مفيش قطع هنا: الحركة وقفت وبدأت حركة جديدة في نفس المشهد">🔀 تغيير جوه المشهد</span>` : ""}
        <button type="button" class="btn sm" data-split="${s.n}" title="لو البرنامج فوّت تغيير: اختار فريم من الشريط (أو وقّف الفيديو عند المكان) ودوس هنا">✂️ قسّم هنا</button>
        <button type="button" class="btn sm" data-hide="${s.n}" title="مش هتدخل في الكومبوننتس، وتقدر ترجّعها">🗑️ شيلها</button>
        ${d.shots[d.shots.length - 1].n !== s.n ? `<button type="button" class="btn sm" data-merge="${s.n}" title="لو الحتة دي واللي بعدها حركة واحدة">🔗 ادمج مع اللي بعدها</button>` : ""}</header>
      <div class="lab-strip">${(s.frames || []).map((f) => `<img src="${f.url}" data-seek="${f.t}" data-pickt="${f.t}" class="${Math.abs(f.t - pick) < 0.001 ? "sel" : ""}" title="${lt(f.t)}" alt="">`).join("")}</div>
      ${s.analysis_error ? `<div class="err">${le(s.analysis_error)}</div>` : ""}
      ${an ? `<p data-no-i18n>${le(an.summary)}</p>
        <div class="lab-row"><b>🖼️ الخلفية:</b> <input type="text" value="${le(an.background?.name)}" data-fix="background|${s.n}|name" data-no-i18n>
          <small class="muted grow" data-no-i18n>${le(an.background?.description)}</small></div>
        <div class="lab-els">${(an.elements || []).map((e) => `<div class="lab-el">
          <div class="lab-row"><select data-fix="element|${e.id}|type">${labOpts(LAB_TYPES, e.type)}</select>
            <input type="text" value="${le(e.name)}" data-fix="element|${e.id}|name" data-no-i18n>
            <button type="button" class="btn sm" data-seek="${e.first_t}" data-to="${e.last_t}" title="شغّل العنصر من أول ما يظهر لحد ما يختفي">▶️</button>
          <span class="lab-time">${lt(e.first_t)} ← ${lt(e.last_t)}</span>${orig(e)}</div>
          <small class="muted" data-no-i18n>${le(e.description)}</small>
          ${(e.actions || []).map((x, i) => `<div class="lab-row lab-act">
            <button type="button" class="btn sm" data-seek="${x.t0}" data-to="${x.t1}" data-playvid>▶️</button>
            <span class="lab-time">${lt(x.t0)}–${lt(x.t1)}</span>
            <select data-fix="action|${e.id}:${i}|action">${labOpts(LAB_ACTIONS, x.action)}</select>
            ${x.from && x.to ? `<small class="muted" dir="ltr">(${x.from.join(", ")}) → (${x.to.join(", ")})</small>` : ""}
            <small class="grow" data-no-i18n>${le(x.detail)}</small>
            ${x.sfx && sfxById[x.sfx] ? `<button type="button" class="btn sm" data-seek="${sfxById[x.sfx].t}" data-to="${sfxById[x.sfx].t + 0.4}" title="الصوت المربوط">🔊 ${le(sfxById[x.sfx].label)}</button>` : ""}
            </div>`).join("")}
        </div>`).join("") || `<p class="muted">مفيش عناصر.</p>`}</div>`
        : `<p class="muted">${d.steps?.elements?.status === "working" ? "⏳ بيفكك العناصر..." : "العناصر لسه ما اتفككتش."}</p>`}
      ${labAssetForm(d, s)}
      </div></div></article>`;
  }).join("");
}

// ---------- الأحداث
const labAudio = new Audio();
document.querySelector('.view[data-view="11"]').addEventListener("click", async (e) => {
  if (e.target.closest("#labLib")) return;  // المكتبة ليها أحداثها في assets.js
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
  const split = e.target.closest("[data-split]");
  if (split) {
    const n = split.dataset.split, s = labx.cur.shots.find((x) => String(x.n) === n);
    const v = document.querySelector(`[data-shotvid="${n}"]`), pick = labx.pick[n];
    const t = pick > s.start + 0.2 && pick < s.end - 0.2 ? pick
      : v && v.currentTime > s.start + 0.2 && v.currentTime < s.end - 0.2 ? v.currentTime : null;
    if (t == null) return toast("اختار الفريم اللي التغيير بيبدأ عنده من الشريط، أو وقّف الفيديو بتاع الحتة عنده", true);
    if (!confirm(`تقسم الحتة عند ${lt(t)}؟ (العناصر بتتحلل للحتتين من جديد)`)) return;
    return busyButton(split, "⏳", async () => {
      labx.cur = await api(`/api/lab/${labx.cur.id}/shots/${n}/split`, { method: "POST", ...jsonBody({ t }) });
      labx.pick = {};
      renderLab(); scheduleLabPoll();
    });
  }
  const merge = e.target.closest("[data-merge]");
  if (merge) {
    return busyButton(merge, "⏳", async () => {
      labx.cur = await api(`/api/lab/${labx.cur.id}/shots/${merge.dataset.merge}/merge`, { method: "POST" });
      labx.pick = {};
      renderLab();
      toast("🔗 اتدمجوا. لو عايز الكومبوننتس تتظبط عليهم دوس «↻ اقترح تاني»");
    });
  }
  const hide = e.target.closest("[data-hide], [data-unhide]"), prune = e.target.closest("[data-prune]");
  if (hide || prune) {
    if (prune && !confirm("يشيل كل اللقطات اللي ملهاش ولا كومبوننت؟ (تقدر ترجّع أي واحدة بعدين)")) return;
    const url = prune ? `/api/lab/${labx.cur.id}/shots/prune` : `/api/lab/${labx.cur.id}/shots/${hide.dataset.hide || hide.dataset.unhide}`;
    return busyButton(hide || prune, "⏳", async () => {
      labx.cur = await api(url, prune ? { method: "POST" } : { method: "PATCH", ...jsonBody({ ignored: !!hide.dataset.hide }) });
      renderLab();
    });
  }
  const fresh = e.target.closest("[data-compfresh]");
  if (fresh) {
    if (!confirm("تمسح كل اقتراحات الكومبوننتس (حتى اللي قبلتها أو رفضتها) ويقترح من الصفر؟\nاللي اتحفظ في المكتبة بيفضل فيها، وأسباب الرفض بتفضل محفوظة عشان الموديل يتعلم منها.")) return;
    return busyButton(fresh, "⏳", async () => {
      labx.cur = await api(`/api/lab/${labx.cur.id}/run?step=components&fresh=true`, { method: "POST" });
      labx.cfilter = "";
      renderLab(); scheduleLabPoll();
    });
  }
  const cf = e.target.closest("[data-cfilter]");
  if (cf) { labx.cfilter = cf.dataset.cfilter; return renderLabComps(labx.cur); }
  const gc = e.target.closest("[data-gocomp]");
  if (gc) {
    labx.cfilter = "";
    renderLabComps(labx.cur);
    const card = $("labComps").querySelector(`[data-comp="${gc.dataset.gocomp}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.classList.add("flash"); setTimeout(() => card?.classList.remove("flash"), 1200);
    return;
  }
  const comp = e.target.closest("[data-comp]");
  if (comp) {
    const cid = comp.dataset.comp, c = labx.cur.components.find((x) => x.id === cid);
    const okb = e.target.closest("[data-cok]"), badb = e.target.closest("[data-cbad]"), asset = e.target.closest("[data-casset]");
    if (asset) return openLib(asset.dataset.casset);
    const note = comp.querySelector("[data-cnote]").value;
    if (okb) return labComp(cid, { review: true, ok: true, note }, okb);
    if (badb) return labComp(cid, { review: true, ok: c.review?.ok === false ? null : false, note }, badb);
    return;
  }
  const abox = e.target.closest("[data-ashot]");
  if (abox) {
    const ar = e.target.closest("[data-arange]"), save = e.target.closest("[data-asave]");
    const f = (k) => abox.querySelector(`[data-af="${k}"]`);
    if (ar) {
      const [a, b] = ar.dataset.arange.split(",").map(Number);
      f("t0").value = a.toFixed(2); f("t1").value = b.toFixed(2);
      if (ar.dataset.aname) f("name").value = ar.dataset.aname;
      return;
    }
    if (save) {
      return busyButton(save, "⏳", async () => {
        const a = await api(`/api/lab/${labx.cur.id}/asset`, { method: "POST", ...jsonBody({
          name: f("name").value, category: f("category").value, tags: f("tags").value.split(/[,،]/),
          t0: Number(f("t0").value), t1: Number(f("t1").value) }) });
        toast(`📚 اتحفظ في المكتبة: ${a.name}`);
        labLibCount();
      });
    }
    return;
  }
  const li = e.target.closest("[data-lab]");
  if (li) { labx.view = "lab"; return openLab(li.dataset.lab); }
  const ok = e.target.closest("[data-rvok]");
  if (ok) {
    const box = ok.closest(".lab-rv"), val = ok.dataset.rvok === "1";
    const cur = ok.classList.contains("on");
    return labReview(box.dataset.kind, box.dataset.ref, { ok: cur ? null : val, note: box.querySelector("[data-rvnote]").value });
  }
  const run = e.target.closest("[data-labrun]");
  if (run) {
    const ask = { all: "تفكك الفيديو من الأول؟ (الكومبوننتس اللي قبلتها أو رفضتها بتفضل، واللي في المكتبة مش بيتمسح)",
      components: "يقترح كومبوننتس جديدة؟ اللي قبلته أو رفضته بيفضل زي ما هو، ورفضك بيتبعت له عشان يتعلم منه." }[run.dataset.labrun]
      || "تعيد الخطوة دي؟ (العناصر والكومبوننتس بيتعملوا من جديد بعدها)";
    if (!confirm(ask)) return;
    try { labx.cur = await api(`/api/lab/${labx.cur.id}/run?step=${run.dataset.labrun}`, { method: "POST" }); renderLab(); scheduleLabPoll(); }
    catch (err) { toast(err.message, true); }
    return;
  }
});
document.querySelector('.view[data-view="11"]').addEventListener("toggle", (e) => {
  if (e.target.matches?.("[data-ashot]")) labx.aopen[e.target.dataset.ashot] = e.target.open;
  if (e.target.matches?.("[data-audiobox]")) labx.audioOpen = e.target.open;
}, true);
document.querySelector('.view[data-view="11"]').addEventListener("change", (e) => {
  if (e.target.closest("#labLib")) return;
  const comp = e.target.closest("[data-comp]");
  if (comp) {
    const cid = comp.dataset.comp, c = labx.cur.components.find((x) => x.id === cid);
    if (e.target.dataset.cf) {
      const k = e.target.dataset.cf;
      return labComp(cid, { [k]: ["t0", "t1"].includes(k) ? Number(e.target.value) : e.target.value });
    }
    if (e.target.matches("[data-cnote]") && c.review) return labComp(cid, { review: true, ok: c.review.ok, note: e.target.value });
    return;
  }
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

$("labSplit").addEventListener("change", async () => {
  const v = $("labSplit").value;
  try {
    labx.cur = await api(`/api/lab/${labx.cur.id}`, { method: "PATCH", ...jsonBody({ split: v }) });
    if (confirm(v === "fine" ? "تقسّم الفيديو من جديد على كل تغيير جوه المشهد؟ (العناصر والكومبوننتس بيتعملوا من جديد بعدها)"
      : "تقسّم الفيديو من جديد على القطعات بس؟ (العناصر والكومبوننتس بيتعملوا من جديد بعدها)")) {
      labx.cur = await api(`/api/lab/${labx.cur.id}/run?step=shots`, { method: "POST" });
      scheduleLabPoll();
    }
    renderLab();
  } catch (err) { toast(err.message, true); }
});
