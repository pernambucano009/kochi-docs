// StudioMania — الإعلانات: إعلان مرجعي ← تفصيص (مشاهد، فكرة، تصوير، إخراج، أصوات، مؤثرات) ← اقتراح لكوتشي
// ومكتبة ستايلات (صور) بتتحفظ وتتختار لأي إعلان

const adx = { list: [], cur: null, styles: [], brains: [], brainId: null, tab: "analysis", timer: null, view: "ad" };
const AD_KEY = "studiomania.ad";

async function initAds() {
  [adx.list, adx.styles, adx.brains] = await Promise.all([api("/api/ads"), api("/api/ad-styles"), api("/api/ad-brains")]);
  api("/api/ads-settings").then((s) => ($("adVideoModel").value = s.video_model)).catch(() => {});
  const want = adx.cur?.id || storageGet(AD_KEY);
  const id = adx.list.some((a) => a.id === want) ? want : adx.list[0]?.id;
  if (id) await openAd(id);
  else renderAds();
}
viewHooks["10"] = initAds;

async function openAd(id) {
  adx.cur = await api(`/api/ads/${id}`);
  adx.view = "ad";
  storageSet(AD_KEY, id);
  renderAds();
}

const AD_LABELS = {
  summary: "الملخص", idea: "الفكرة", hook: "الهوك (أول 3 ثواني)", structure: "البناء", audience: "الجمهور",
  tone: "النبرة", cta: "الدعوة للفعل", cinematography: "التصوير", direction: "الإخراج", editing: "المونتاج", colors: "الألوان",
};
const SCENE_LABELS = {
  visual: "اللي بيحصل", shot: "اللقطة", camera: "الكاميرا", on_screen_text: "كلام على الشاشة", voice: "الصوت / الكلام",
  sfx: "المؤثرات", music: "الموسيقى", transition: "الانتقال", purpose: "وظيفة المشهد",
};
const ADAPT_LABELS = {
  concept: "الفكرة", why_it_fits: "ليه مناسب لكوتشي", kochi_angle: "كوتشي بيظهر إزاي", hook: "الهوك", format: "المقاس",
  voiceover_script: "الفويس أوفر كامل", music_direction: "الموسيقى", sound_design: "المؤثرات وتصميم الصوت", cast: "الممثلين",
  locations: "أماكن التصوير", production_notes: "ملاحظات التنفيذ", cta: "الدعوة للفعل", caption: "كابشن البوست",
};
const ADAPT_SCENE_LABELS = {
  visual: "اللي هيحصل", shot: "اللقطة", camera: "الكاميرا", on_screen_text: "كلام على الشاشة", voice: "الكلام",
  sfx: "المؤثرات", music: "الموسيقى",
};
const adFmt = (t) => `${Math.floor((t || 0) / 60)}:${((t || 0) % 60).toFixed(1).padStart(4, "0")}`;
const adEsc = (v) => escapeHtml(v == null ? "" : String(v));

function renderAds() {
  $("adList").innerHTML = adx.list.map((a) => `<li class="${a.id === adx.cur?.id ? "active" : ""}" data-ad="${a.id}">
      ${a.thumb ? `<img src="${a.thumb}" alt="">` : `<span class="ph">🎬</span>`}
      <span class="nm" data-no-i18n>${adEsc(a.name)}</span>
      <small>${a.status === "working" || a.status === "queued" ? "⏳" : a.status === "failed" ? "✕" : a.adapt_status === "working" ? "✍️" : ""}</small></li>`).join("")
    || `<li class="muted">لسه مفيش إعلانات.</li>`;
  const a = adx.cur;
  $("adStyles").hidden = adx.view !== "styles";
  $("adBrain").hidden = adx.view !== "brain";
  $("adMain").hidden = adx.view !== "ad" || !a;
  $("adEmpty").hidden = adx.view !== "ad" || !!a;
  if (adx.view === "styles") renderStyleLib();
  if (adx.view === "brain") renderBrain();
  if (a && adx.view === "ad") {
    if (document.activeElement !== $("adName")) $("adName").value = a.name;
    document.querySelectorAll("#adTabs [data-t]").forEach((b) => b.classList.toggle("active", b.dataset.t === adx.tab));
    document.querySelectorAll(".ad-sec").forEach((x) => (x.hidden = x.dataset.sec !== adx.tab));
    renderAdStatus();
    renderAdAnalysis();
    renderAdAudio();
    renderAdAdapt();
    renderAdSettings();
    renderAdProd();
    renderAdFlow();
    renderAdActivity();
  }
  scheduleAdPoll();
}

function renderAdStatus() {
  const a = adx.cur;
  const busy = a.status === "queued" || a.status === "working";
  const el = $("adStatus");
  el.hidden = !busy && a.status !== "failed";
  el.className = `ad-status ${a.status === "failed" ? "err" : ""}`;
  el.innerHTML = busy ? `<div class="spin"></div> ${adEsc(a.step || "في الطابور...")} <span class="muted">(الإعلان الطويل بياخد دقيقة أو اتنين)</span>`
    : a.status === "failed" ? `✕ ${adEsc(a.error || "التحليل فشل")} <button class="btn sm" data-ad-retry>🔍 حلّل تاني</button>` : "";
}

// حقل قابل للتعديل: بيتحفظ لما تخرج منه
const adField = (label, value, attrs, rows = 2, ltr = false) => `<label class="ad-f"><span>${label}</span>
  <textarea rows="${rows}" ${attrs} ${ltr ? 'dir="ltr"' : ""} data-no-i18n>${adEsc(value)}</textarea></label>`;

function renderAdAnalysis() {
  const a = adx.cur;
  const sc = a.analysis?.scenes || [];
  const missing = sc.length && !sc.some((s) => (s.components || []).length);
  $("adSceneCompsGo").hidden = !a.analysis;
  $("adSceneCompsGo").disabled = a.scomp_status === "working";
  $("adSceneCompsGo").textContent = a.scomp_status === "working" ? "⏳ بيستخرج الموشن جرافيك..." : missing ? "🎞️ استخرج الموشن جرافيك والمكونات" : "↻ استخرج الموشن جرافيك والمكونات تاني";
  $("adSceneCompsGo").classList.toggle("primary", !!missing);
  $("adSceneCompsErr").hidden = !a.analysis?.components_error;
  $("adSceneCompsErr").textContent = a.analysis?.components_error ? `✕ ${a.analysis.components_error}` : "";
  const v = $("adVideo");
  if (a.source_url && v.getAttribute("src") !== a.source_url) v.src = a.source_url;
  const an = a.analysis;
  if (!an) {
    $("adSummary").innerHTML = `<p class="muted">${a.status === "failed" ? "" : "⏳ بيحلل الإعلان..."}</p>`;
    $("adScenes").innerHTML = "";
    return;
  }
  if (!editingIn($("adSummary"))) {
    $("adSummary").innerHTML = `${an.brand ? `<p class="muted" data-no-i18n>${adEsc(an.brand)} · ${adFmt(a.source?.duration)}</p>` : ""}` +
      Object.entries(AD_LABELS).map(([k, l]) => adField(l, an[k], `data-an="${k}"`)).join("");
  }
  if (!editingIn($("adScenes"))) {
    $("adScenes").innerHTML = (an.scenes || []).map((s) => `<article class="ad-scene" data-scene="${s.n}">
      <div class="ad-scene-media">${s.frame_url ? `<img src="${s.frame_url}" alt="" data-seek="${s.start}">` : ""}
        <b>${s.n}</b><span class="t">${adFmt(s.start)} → ${adFmt(s.end)}</span></div>
      <div class="ad-scene-body">${Object.entries(SCENE_LABELS).filter(([k]) => s[k] != null).map(([k, l]) => adField(l, s[k], `data-sk="${k}"`, 1)).join("")}
        ${s.motion_graphics ? `<div class="ad-mg" data-no-i18n>🎞️ <b>الموشن جرافيك:</b> ${adEsc(s.motion_graphics)}</div>` : ""}
        ${(s.components || []).length ? `<div class="ad-scomps" data-no-i18n>${s.components.map((c) => `<span class="ad-scomp" title="${adEsc(c.description)}">
          ${KIND_LABEL[c.kind] || "🧩"} <b>${adEsc(c.name)}</b>${c.animation ? `<small>${adEsc(c.animation)}</small>` : ""}</span>`).join("")}</div>` : ""}</div>
    </article>`).join("");
  }
}

function renderAdAudio() {
  const a = adx.cur;
  const au = a.audio, t = a.audio_tech;
  const working = a.audio_status === "working";
  $("adAudioGo").hidden = !a.source?.has_audio;
  $("adAudioGo").disabled = working;
  $("adAudioGo").textContent = working ? "⏳ بيسمع الصوت..." : au ? "↻ حلّل الصوت تاني" : "🎧 حلّل الصوت";
  $("adAudioGo").classList.toggle("primary", !au);
  if (!a.source?.has_audio) { $("adAudio").innerHTML = `<p class="muted">الإعلان ده من غير صوت.</p>`; return; }
  const err = a.audio_error && !working ? `<div class="err">✕ ${adEsc(a.audio_error)}</div>` : "";
  if (!au) {
    $("adAudio").innerHTML = err || `<p class="muted">${working ? "⏳ بيسمع الصوت بالتفصيل (دقيقة تقريبًا)..." : "لسه متحللش. دوس «🎧 حلّل الصوت» لو محتاجه."}</p>`;
    return;
  }
  const m = au.music || {};
  const tech = t ? `<div class="ad-chips"><span>🔊 الارتفاع ${t.lufs ?? "؟"} LUFS</span><span>📈 أعلى نقطة ${t.true_peak ?? "؟"} dB</span><span>↕ المدى ${t.range_lu ?? "؟"} LU</span></div>` : "";
  $("adAudio").innerHTML = `${err}${tech}
    <h3 class="pane-h">🗣️ الأصوات</h3>
    <div class="ad-cards">${(au.voices || []).map((v) => `<div class="ad-card" data-no-i18n><b>${adEsc(v.who)}</b>
      <span>${[v.gender, v.age, v.language].filter(Boolean).map(adEsc).join(" · ")}</span>
      <span>النبرة: ${adEsc(v.tone)} · الإحساس: ${adEsc(v.emotion)} · السرعة: ${adEsc(v.pace)}</span>
      <span class="muted">${adEsc(v.delivery)}</span></div>`).join("") || `<p class="muted">مفيش كلام.</p>`}</div>
    ${(au.transcript || []).length ? `<h3 class="pane-h">📝 الكلام بالتوقيت</h3><div class="ad-tr" data-no-i18n>${au.transcript.map((x) =>
      `<p><span class="t" data-seek="${x.start}">${adFmt(x.start)}</span> ${x.speaker ? `<b>${adEsc(x.speaker)}:</b> ` : ""}${adEsc(x.text)}</p>`).join("")}</div>` : ""}
    <h3 class="pane-h">🎵 الموسيقى</h3>
    <div class="ad-card wide" data-no-i18n><span><b>${adEsc(m.genre)}</b> · ${adEsc(m.mood)}${m.tempo_bpm ? ` · ≈ ${adEsc(m.tempo_bpm)} BPM` : ""}${m.key ? ` · ${adEsc(m.key)}` : ""}</span>
      <span>الآلات: ${adEsc(m.instruments)}</span><span>الطاقة: ${adEsc(m.energy)}</span><span>دورها: ${adEsc(m.role)}</span>
      ${(m.moments || []).length ? `<span>${m.moments.map((x) => `<i data-seek="${x.t}">${adFmt(x.t)}</i> ${adEsc(x.event)}`).join(" · ")}</span>` : ""}</div>
    <h3 class="pane-h">💥 المؤثرات الصوتية</h3>
    <div class="ad-tr" data-no-i18n>${(au.sfx || []).map((x) => `<p><span class="t" data-seek="${x.t}">${adFmt(x.t)}</span> <b>${adEsc(x.sound)}</b> <span class="muted">${adEsc(x.purpose)}</span></p>`).join("") || `<p class="muted">مفيش.</p>`}</div>
    <h3 class="pane-h">🎚️ المكس وتصميم الصوت</h3>
    <div class="ad-card wide" data-no-i18n><span>الصوت المحيط: ${adEsc(au.ambience)}</span><span>المكس: ${adEsc(au.mix)}</span><span><b>${adEsc(au.sound_design_notes)}</b></span></div>`;
}

// الموشن جرافيك في مشهد الاقتراح، وجنبه الموشن بتاع المشهد الأصلي اللي اتبنى عليه
function adaptMotion(s) {
  const orig = (adx.cur.analysis?.scenes || []).find((x) => String(x.n) === String(s.ref_scene));
  return `<div class="ad-motion">
    ${orig?.motion_graphics ? `<div class="ad-mg orig" data-no-i18n>↩ <b>الموشن في المشهد الأصلي ${adEsc(orig.n)}:</b> ${adEsc(orig.motion_graphics)}</div>` : ""}
    ${adField("🎞️ الموشن جرافيك في المشهد (نسخة كوتشي)", s.motion_graphics, 'data-ask="motion_graphics"', 3)}
    ${adField("Motion prompt", s.motion_prompt, 'data-ask="motion_prompt"', 2, true)}</div>`;
}

// اقتراح اتكتب قبل ما الموشن جرافيك يدخل فيه (طريقة قديمة) والتحليل فيه موشن
const adaptNoMotion = (a) => !!a.adaptation?.scenes?.length && !a.adaptation.scenes.some((s) => s.motion_graphics)
  && (a.analysis?.scenes || []).some((s) => s.motion_graphics);

function renderAdAdapt() {
  const a = adx.cur;
  const busy = a.adapt_status === "working";
  $("adAdaptState").innerHTML = busy ? `<span class="spin-inline"></span> ✍️ بيكتب الاقتراح...` : a.adapt_status === "failed" ? `✕ ${adEsc(a.adapt_error)}` : "";
  $("adAdaptGo").disabled = busy || !a.analysis;
  const ad = a.adaptation;
  if (!ad) { $("adAdapt").innerHTML = `<p class="muted">${busy ? "⏳ بيكتب..." : a.analysis ? "لسه مفيش اقتراح. دوس «التالي: اكتب اقتراح كوتشي» تحت التحليل." : "الاقتراح بيتكتب بعد التحليل."}</p>`; return; }
  if (editingIn($("adAdapt"))) return;
  const style = adx.styles.find((s) => s.id === a.settings.style_id);
  $("adAdapt").innerHTML = `<div class="ad-adapt-head">
      <input class="ad-adapt-title" data-ad-key="title" value="${adEsc(ad.title)}" data-no-i18n>
      <span class="muted">${ad.duration ? `${adEsc(ad.duration)} ثانية` : ""}${style ? ` · 🎨 ${adEsc(style.name)}` : ""}</span>
      <button class="btn sm" data-copy-adapt>📋 انسخ الاقتراح كله</button></div>
    <div class="ad-fields">${["concept", "why_it_fits", "kochi_angle", "hook", "format"].map((k) => adField(ADAPT_LABELS[k], ad[k], `data-ad-key="${k}"`)).join("")}</div>
    <h3 class="pane-h">🎬 المشاهد</h3>
    <div class="ad-scenes">${(ad.scenes || []).map((s, i) => `<article class="ad-scene adapt" data-ascene="${i}">
      <div class="ad-scene-media"><b>${s.n ?? i + 1}</b><span class="t">${adEsc(s.seconds)}ث</span></div>
      <div class="ad-scene-body">${adaptMotion(s)}${Object.entries(ADAPT_SCENE_LABELS).map(([k, l]) => adField(l, s[k], `data-ask="${k}"`, 1)).join("")}
        ${adField("Prompt (Seedance)", s.prompt, 'data-ask="prompt"', 3, true)}
        <button class="btn sm" type="button" data-copy-prompt="${i}">📋 انسخ البرومبت</button>
        ${s.ref_scene ? `<div class="muted">↩ مستوحى من المشهد ${adEsc(s.ref_scene)} في الإعلان الأصلي</div>` : ""}
        ${(s.components || []).length ? `<div class="ad-scomps" data-no-i18n>${s.components.map((c) => `<span class="ad-scomp" title="${adEsc(c.description)}">
          ${KIND_LABEL[c.kind] || "🧩"} <b>${adEsc(c.name)}</b>${c.from ? `<small>بدل: ${adEsc(c.from)}</small>` : ""}${c.animation ? `<small>${adEsc(c.animation)}</small>` : ""}</span>`).join("")}</div>` : ""}</div></article>`).join("")}</div>
    <div class="ad-fields">${["voiceover_script", "music_direction", "sound_design", "cast", "locations", "production_notes", "cta", "caption"]
      .map((k) => adField(ADAPT_LABELS[k], ad[k], `data-ad-key="${k}"`, k === "voiceover_script" || k === "production_notes" ? 4 : 2)).join("")}</div>`;
}

function renderAdSettings() {
  const a = adx.cur, st = a.settings || {};
  if (document.activeElement !== $("adSetBrain")) {
    $("adSetBrain").innerHTML = `<option value="">تلقائي${adx.brains[0] ? ` (${adEsc(adx.brains[0].name)})` : ""}</option>`
      + adx.brains.map((b) => `<option value="${b.id}">${adEsc(b.name)}</option>`).join("") + `<option value="none">من غير عقل إعلان</option>`;
  }
  for (const el of document.querySelectorAll("[data-set]")) if (document.activeElement !== el) el.value = st[el.dataset.set] ?? "";
  $("adStylePick").innerHTML = `<button type="button" class="ad-style-card ${!st.style_id ? "sel" : ""}" data-pick-style=""><span class="ph">∅</span><b>من غير ستايل</b></button>` +
    adx.styles.map((s) => `<button type="button" class="ad-style-card ${s.id === st.style_id ? "sel" : ""}" data-pick-style="${s.id}">
      ${s.images[0] ? `<img src="${s.images[0]}" alt="">` : `<span class="ph">🎨</span>`}<b data-no-i18n>${adEsc(s.name)}</b></button>`).join("");
  $("adReanalyze").disabled = $("adReedit").disabled = a.status === "working" || a.status === "queued";
  $("adReadapt").disabled = a.adapt_status === "working" || !a.analysis;
}

function renderStyleLib() {
  if (editingIn($("adStyleGrid"))) return;
  $("adStylesBack").hidden = !adx.cur;
  $("adStyleGrid").innerHTML = adx.styles.map((s) => `<article class="ad-style" data-style="${s.id}">
      <div class="imgs">${s.images.map((u) => `<img src="${u}" alt="">`).join("")}</div>
      <input value="${adEsc(s.name)}" data-style-name data-no-i18n>
      ${s.status === "working" ? `<p class="muted"><span class="spin-inline"></span> بيشوف الصور ويكتب وصف الستايل...</p>` : ""}
      ${s.status === "failed" ? `<div class="err">✕ ${adEsc(s.error)}</div>` : ""}
      <textarea rows="4" dir="ltr" data-style-notes placeholder="Style description" data-no-i18n>${adEsc(s.notes)}</textarea>
      <div class="row"><span class="muted">${s.from_ad ? "📣 من إعلان" : ""}</span><span class="spacer"></span><button class="btn sm danger" data-style-del>🗑️</button></div>
    </article>`).join("") || `<p class="muted">لسه مفيش ستايلات. ارفع صور تمثّل الشكل اللي عايزه.</p>`;
}

// ---------- الأحداث ----------
$("adList").addEventListener("click", (e) => {
  const li = e.target.closest("[data-ad]");
  if (li) openAd(li.dataset.ad).catch((err) => toast(err.message, true));
});
// الفيديو بيفتح في محرر صغير (قص وكروب) قبل ما يترفع
$("adFile").addEventListener("change", (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (f) openAdEditor({ file: f });
});
async function uploadAd(file, edit) {
  const form = new FormData();
  form.append("file", file);
  if (edit.start != null) form.append("trim_start", edit.start);
  if (edit.end != null) form.append("trim_end", edit.end);
  if (edit.crop) form.append("crop", edit.crop);
  toast(`⏳ بيرفع ${file.name}...`);
  const a = await api("/api/ads", { method: "POST", body: form });
  adx.list = await api("/api/ads");
  adx.cur = a;
  adx.tab = "analysis";
  adx.view = "ad";
  storageSet(AD_KEY, a.id);
  renderAds();
  toast("✅ اترفع. التحليل بدأ وبعده الاقتراح لكوتشي");
}

// ---------- محرر القص والكروب ----------
const aed = { file: null, aid: null, url: null, dur: 0, start: 0, end: 0, crop: null, ratio: "none", drag: null, stopAt: null };
const aedFmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
function openAdEditor({ file = null, ad = null }) {
  aed.file = file;
  aed.aid = ad?.id || null;
  if (aed.url?.startsWith("blob:")) URL.revokeObjectURL(aed.url);
  aed.url = file ? URL.createObjectURL(file) : ad.original_url;
  const prev = ad?.source?.edit || {};
  aed.start = prev.start || 0;
  aed.endWanted = prev.end || null;
  aed.crop = prev.crop ? { x: prev.crop[0], y: prev.crop[1], w: prev.crop[2], h: prev.crop[3] } : null;
  aed.ratio = aed.crop ? "free" : "none";
  const v = $("adEdVideo");
  v.src = aed.url;
  $("adEdGo").textContent = file ? "✅ تمام، ارفع وحلّل" : "✅ طبّق وحلّل من جديد";
  $("adEdInfo").textContent = file ? file.name : ad.name;
  $("adEditDialog").showModal();
}
$("adEdVideo").addEventListener("loadedmetadata", () => {
  const v = $("adEdVideo");
  aed.dur = v.duration || 0;
  aed.end = Math.min(aed.endWanted || aed.dur, aed.dur);
  aed.A = v.videoWidth / v.videoHeight;
  v.currentTime = aed.start;
  renderAdEditor();
});
$("adEdVideo").addEventListener("timeupdate", () => {
  const v = $("adEdVideo");
  if (aed.stopAt != null && v.currentTime >= aed.stopAt) { v.pause(); aed.stopAt = null; }
  renderAdTimes();
});
function renderAdTimes() {
  const t = $("adEdVideo").currentTime || 0;
  $("adEdStartLbl").textContent = `⟦ ${aedFmt(aed.start)}`;
  $("adEdEndLbl").textContent = `${aedFmt(aed.end)} ⟧`;
  $("adEdNowLbl").textContent = `${aedFmt(t)} · ${aedFmt(Math.max(0, aed.end - aed.start))}`;
  if (document.activeElement !== $("adEdSeek")) $("adEdSeek").value = aed.dur ? Math.round((t / aed.dur) * 1000) : 0;
}
function renderAdEditor() {
  renderAdTimes();
  document.querySelectorAll("#adEdRatios [data-r]").forEach((b) => b.classList.toggle("active", b.dataset.r === String(aed.ratio)));
  const box = $("adEdCrop");
  box.hidden = !aed.crop;
  if (!aed.crop) return;
  const W = $("adEdVideo").clientWidth, H = $("adEdVideo").clientHeight;
  Object.assign(box.style, { left: `${aed.crop.x * W}px`, top: `${aed.crop.y * H}px`, width: `${aed.crop.w * W}px`, height: `${aed.crop.h * H}px` });
}
window.addEventListener("resize", () => { if ($("adEditDialog").open) renderAdEditor(); });
$("adEdSeek").addEventListener("input", () => { $("adEdVideo").currentTime = (Number($("adEdSeek").value) / 1000) * aed.dur; });
$("adEdSetStart").onclick = () => { aed.start = Math.min($("adEdVideo").currentTime, aed.end - 0.5); renderAdTimes(); };
$("adEdSetEnd").onclick = () => { aed.end = Math.max($("adEdVideo").currentTime, aed.start + 0.5); renderAdTimes(); };
$("adEdResetTrim").onclick = () => { aed.start = 0; aed.end = aed.dur; renderAdTimes(); };
$("adEdPlay").onclick = () => {
  const v = $("adEdVideo");
  v.currentTime = aed.start;
  aed.stopAt = aed.end;
  v.play().catch(() => {});
};
// مقاس الكروب: نسبة العرض للطول بالبكسل؛ بنحسبها ككسور من الصورة
function fitCrop(r) {
  const A = aed.A || 1;
  let w = 1, h = 1;
  if (r < A) w = r / A; else h = A / r;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}
$("adEdRatios").addEventListener("click", (e) => {
  const b = e.target.closest("[data-r]");
  if (!b) return;
  aed.ratio = b.dataset.r === "none" || b.dataset.r === "free" ? b.dataset.r : Number(b.dataset.r);
  if (aed.ratio === "none") aed.crop = null;
  else if (aed.ratio === "free") aed.crop = aed.crop || { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
  else aed.crop = fitCrop(aed.ratio);
  renderAdEditor();
});
$("adEdCrop").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const W = $("adEdVideo").clientWidth, H = $("adEdVideo").clientHeight;
  aed.drag = { h: e.target.dataset.h || "move", sx: e.clientX, sy: e.clientY, c0: { ...aed.crop }, W, H };
  $("adEdCrop").setPointerCapture(e.pointerId);
});
$("adEdCrop").addEventListener("pointermove", (e) => {
  const d = aed.drag;
  if (!d) return;
  const dx = (e.clientX - d.sx) / d.W, dy = (e.clientY - d.sy) / d.H, c = d.c0;
  const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (d.h === "move") {
    aed.crop = { ...c, x: cl(c.x + dx, 0, 1 - c.w), y: cl(c.y + dy, 0, 1 - c.h) };
  } else {
    // الركن المقابل ثابت
    const left = d.h.includes("w"), top = d.h.includes("n");
    const ax = left ? c.x + c.w : c.x, ay = top ? c.y + c.h : c.y;
    let w = cl(left ? c.w - dx : c.w + dx, 0.05, left ? ax : 1 - ax);
    let h = cl(top ? c.h - dy : c.h + dy, 0.05, top ? ay : 1 - ay);
    if (typeof aed.ratio === "number") {
      const k = (aed.A || 1) / aed.ratio; // h = w * A / r
      h = w * k;
      const maxH = top ? ay : 1 - ay;
      if (h > maxH) { h = maxH; w = h / k; }
    }
    aed.crop = { x: left ? ax - w : ax, y: top ? ay - h : ay, w, h };
  }
  renderAdEditor();
});
$("adEdCrop").addEventListener("pointerup", () => (aed.drag = null));
$("adEdCancel").onclick = () => $("adEditDialog").close();
$("adEditDialog").addEventListener("close", () => { $("adEdVideo").pause(); });
$("adEdGo").onclick = () => busyButton($("adEdGo"), "⏳ بيرفع ويقص...", async () => {
  const full = aed.start < 0.05 && aed.end > aed.dur - 0.05;
  const c = aed.crop;
  const edit = {
    start: full ? null : Number(aed.start.toFixed(3)),
    end: full ? null : Number(aed.end.toFixed(3)),
    crop: c ? [c.x, c.y, c.w, c.h].map((v) => v.toFixed(4)).join(",") : "",
  };
  if (aed.file) await uploadAd(aed.file, edit);
  else {
    if (!confirm("القص والكروب الجديد هيتطبق على الفيديو الأصلي، والتحليل والاقتراح هيتعملوا من الأول. تكمّل؟")) return;
    adx.cur = await api(`/api/ads/${aed.aid}/edit`, { method: "POST", ...jsonBody(edit) });
    adx.tab = "analysis";
    renderAds();
  }
  $("adEditDialog").close();
});

$("adTabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-t]");
  if (!b) return;
  adx.tab = b.dataset.t;
  renderAds();
});
$("adName").addEventListener("change", () => patchAd({ name: $("adName").value }).then(async () => { adx.list = await api("/api/ads"); renderAds(); }));

async function patchAd(body) {
  try { adx.cur = await api(`/api/ads/${adx.cur.id}`, { method: "PATCH", ...jsonBody(body) }); renderAdFlow(); }
  catch (err) { toast(err.message, true); }
}
// تعديل التحليل: الحقول العامة والمشاهد
$("adSummary").addEventListener("change", (e) => {
  const k = e.target.dataset.an;
  if (k) patchAd({ analysis: { [k]: e.target.value } });
});
$("adScenes").addEventListener("change", (e) => {
  const card = e.target.closest("[data-scene]");
  const k = e.target.dataset.sk;
  if (!card || !k) return;
  const scenes = adx.cur.analysis.scenes.map((s) => (String(s.n) === card.dataset.scene ? { ...s, [k]: e.target.value } : s));
  patchAd({ analysis: { scenes } });
});
// القفز لمكان في الفيديو
document.querySelector('.view[data-view="10"]').addEventListener("click", (e) => {
  const s = e.target.closest("[data-seek]");
  if (!s) return;
  const v = $("adVideo");
  v.currentTime = Number(s.dataset.seek) || 0;
  if (adx.tab !== "analysis") { adx.tab = "analysis"; renderAds(); }
  v.play().catch(() => {});
});
$("adStatus").addEventListener("click", (e) => { if (e.target.closest("[data-ad-retry]")) reanalyze(); });
$("adAudioGo").onclick = () => busyButton($("adAudioGo"), "⏳", async () => {
  adx.cur = await api(`/api/ads/${adx.cur.id}/audio-analyze`, { method: "POST" });
  renderAds();
});
$("adSceneCompsGo").onclick = () => busyButton($("adSceneCompsGo"), "⏳", async () => {
  adx.cur = await api(`/api/ads/${adx.cur.id}/scene-components`, { method: "POST" });
  renderAds();
});

// الاقتراح: تعديل بإيدك أو برسالة
function adaptCopy() {
  const ad = structuredClone(adx.cur.adaptation);
  return ad;
}
$("adAdapt").addEventListener("change", (e) => {
  const ad = adaptCopy();
  if (e.target.dataset.adKey) ad[e.target.dataset.adKey] = e.target.value;
  const sc = e.target.closest("[data-ascene]");
  if (sc && e.target.dataset.ask) ad.scenes[Number(sc.dataset.ascene)][e.target.dataset.ask] = e.target.value;
  patchAd({ adaptation: ad });
});
$("adAdapt").addEventListener("click", async (e) => {
  const cp = e.target.closest("[data-copy-prompt]");
  if (cp) return adCopy(adx.cur.adaptation.scenes[Number(cp.dataset.copyPrompt)].prompt || "");
  if (e.target.closest("[data-copy-adapt]")) {
    const ad = adx.cur.adaptation;
    const parts = [ad.title, "", ...["concept", "why_it_fits", "kochi_angle", "hook", "format"].map((k) => `${ADAPT_LABELS[k]}: ${ad[k] || ""}`), "",
      ...(ad.scenes || []).map((s, i) => [`— المشهد ${s.n ?? i + 1} (${s.seconds}ث)`, `الموشن جرافيك: ${s.motion_graphics || ""}`, ...Object.entries(ADAPT_SCENE_LABELS).map(([k, l]) => `${l}: ${s[k] || ""}`), `Prompt: ${s.prompt || ""}`].join("\n")), "",
      ...["voiceover_script", "music_direction", "sound_design", "cast", "locations", "production_notes", "cta", "caption"].map((k) => `${ADAPT_LABELS[k]}: ${ad[k] || ""}`)];
    adCopy(parts.join("\n"));
  }
});
async function adCopy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  toast("📋 اتنسخ");
}
$("adAdaptForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const message = $("adAdaptMsg").value.trim();
  if (!message) return $("adAdaptMsg").focus();
  busyButton($("adAdaptGo"), "⏳", async () => {
    adx.cur = await api(`/api/ads/${adx.cur.id}/adapt`, { method: "POST", ...jsonBody({ message }) });
    $("adAdaptMsg").value = "";
    renderAds();
  });
});
$("adAdaptMsg").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("adAdaptForm").requestSubmit(); }
});

// الإعدادات
document.querySelectorAll("[data-set]").forEach((el) => el.addEventListener("change", () => {
  const v = el.type === "number" ? Number(el.value) || null : el.value;
  patchAd({ settings: { [el.dataset.set]: v } });
}));
$("adStylePick").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-pick-style]");
  if (!b) return;
  await patchAd({ settings: { style_id: b.dataset.pickStyle || null } });
  renderAds();
  toast(b.dataset.pickStyle ? "🎨 اتختار الستايل. دوس «اكتب الاقتراح من جديد» عشان البرومبتات تتكتب بيه" : "اتشال الستايل");
});
$("adReadapt").onclick = () => busyButton($("adReadapt"), "⏳", async () => {
  adx.cur = await api(`/api/ads/${adx.cur.id}/adapt`, { method: "POST", ...jsonBody({ message: "" }) });
  adx.tab = "adapt";
  renderAds();
});
function reanalyze() {
  if (!confirm("تحلل الإعلان من الأول؟ التعديلات اللي عملتها على التحليل هتتمسح. الاقتراح الحالي هيفضل لحد ما تدوس «التالي» عشان يتكتب من التحليل الجديد.")) return;
  busyButton($("adReanalyze"), "⏳", async () => {
    adx.cur = await api(`/api/ads/${adx.cur.id}/analyze`, { method: "POST" });
    adx.tab = "analysis";
    renderAds();
  });
}
$("adReanalyze").onclick = reanalyze;
$("adReedit").onclick = () => openAdEditor({ ad: adx.cur });
$("adDelete").onclick = async () => {
  if (!confirm(`تحذف «${adx.cur.name}» وتحليله؟`)) return;
  try {
    await api(`/api/ads/${adx.cur.id}`, { method: "DELETE" });
    adx.list = await api("/api/ads");
    adx.cur = null;
    if (adx.list[0]) await openAd(adx.list[0].id); else renderAds();
  } catch (err) { toast(err.message, true); }
};
$("adVideoModel").addEventListener("change", async () => {
  try { await api("/api/ads-settings", { method: "PUT", ...jsonBody({ video_model: $("adVideoModel").value }) }); toast("اتحفظ"); }
  catch (err) { toast(err.message, true); }
});
$("adSaveStyle").onclick = () => busyButton($("adSaveStyle"), "⏳", async () => {
  const s = await api(`/api/ads/${adx.cur.id}/save-style`, { method: "POST", ...jsonBody({ name: "" }) });
  adx.styles = await api("/api/ad-styles");
  renderAds();
  toast(`🎨 اتحفظ «${s.name}» في مكتبة الستايلات`);
});

// مكتبة الستايلات
$("adStylesGo").onclick = $("adStylesGo2").onclick = () => { adx.view = "styles"; renderAds(); };
$("adStylesBack").onclick = () => { adx.view = "ad"; renderAds(); };
$("adStyleFiles").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = "";
  if (!files.length) return;
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("name", $("adStyleName").value.trim());
  try {
    toast("⏳ بيرفع الصور...");
    await api("/api/ad-styles", { method: "POST", body: form });
    $("adStyleName").value = "";
    adx.styles = await api("/api/ad-styles");
    renderAds();
    toast("✅ الستايل اتضاف، والبرنامج بيكتب وصفه");
  } catch (err) { toast(err.message, true); }
});
$("adStyleGrid").addEventListener("change", async (e) => {
  const card = e.target.closest("[data-style]");
  if (!card) return;
  const body = e.target.matches("[data-style-name]") ? { name: e.target.value } : e.target.matches("[data-style-notes]") ? { notes: e.target.value } : null;
  if (!body) return;
  try { await api(`/api/ad-styles/${card.dataset.style}`, { method: "PATCH", ...jsonBody(body) }); adx.styles = await api("/api/ad-styles"); toast("اتحفظ"); }
  catch (err) { toast(err.message, true); }
});
$("adStyleGrid").addEventListener("click", async (e) => {
  const card = e.target.closest("[data-style]");
  if (!card || !e.target.closest("[data-style-del]") || !confirm("تحذف الستايل ده؟")) return;
  try { await api(`/api/ad-styles/${card.dataset.style}`, { method: "DELETE" }); adx.styles = await api("/api/ad-styles"); renderAds(); }
  catch (err) { toast(err.message, true); }
});

// متابعة: التحليل والاقتراح ووصف الستايلات بيشتغلوا في الخلفية
function scheduleAdPoll() {
  clearTimeout(adx.timer);
  const a = adx.cur;
  const busy = (a && (["queued", "working"].includes(a.status) || a.adapt_status === "working" || a.scomp_status === "working" || a.audio_status === "working" || prodBusy(a))) || adx.styles.some((s) => s.status === "working") || adx.brains.some((b) => b.status === "working");
  if (!busy || document.querySelector('.view[data-view="10"]').hidden) return;
  adx.timer = setTimeout(async () => {
    try {
      if (adx.styles.some((s) => s.status === "working")) adx.styles = await api("/api/ad-styles");
      if (adx.brains.some((b) => b.status === "working")) adx.brains = await api("/api/ad-brains");
      if (adx.cur) {
        const fresh = await api(`/api/ads/${adx.cur.id}`);
        const changed = fresh.status !== adx.cur.status || fresh.adapt_status !== adx.cur.adapt_status;
        adx.cur = fresh;
        if (changed) adx.list = await api("/api/ads");
      }
      renderAds();
    } catch { scheduleAdPoll(); }
  }, 3000);
}


// ---------- التنقل بين الخطوات: كل خطوة بتاخد آخر نسخة من اللي قبلها ----------
// based_on = رقم نسخة الخطوة اللي قبلها وقت ما الخطوة دي اتعملت. لو أقل من الحالي يبقى الخطوة دي قديمة
const adaptStale = (a) => (!!a.adaptation && a.adaptation.based_on != null && a.adaptation.based_on < a.analysis_ver) || adaptNoMotion(a);
// التنفيذ قديم لو الاقتراح اتغير بعده، أو لو الاقتراح نفسه قديم (التحليل أو الموشن اتغيروا بعده)
const prodStale = (a) => !!a.prod && ((a.prod.based_on != null && a.prod.based_on < a.adapt_ver) || adaptStale(a));

function renderAdFlow() {
  const a = adx.cur;
  if (adx.followProd === a.id && a.adapt_status !== "working") {
    adx.followProd = null;
    if (a.prod && !prodStale(a)) { adx.tab = "prod"; return renderAds(); }
  }
  const anBusy = ["queued", "working"].includes(a.status) || a.scomp_status === "working";
  const adBusy = a.adapt_status === "working";
  const n1 = $("adNextAnalysis");
  n1.hidden = !a.analysis;
  const sc = a.analysis?.scenes || [];
  if (a.analysis && sc.length && !sc.some((s) => (s.components || []).length || s.motion_graphics) && a.scomp_status !== "working") {
    n1.innerHTML = `<span class="muted">⚠️ لسه الموشن جرافيك ومكونات المشاهد ما اتستخرجوش، والاقتراح بيتبني عليهم.</span>
      <button class="btn primary" data-scomps ${anBusy ? "disabled" : ""}>🎞️ استخرج الموشن جرافيك والمكونات</button>`;
  } else if (a.analysis) {
    const fresh = a.adaptation && !adaptStale(a);
    n1.innerHTML = `<span class="muted">${adBusy ? "✍️ اقتراح كوتشي بيتكتب من التحليل ده..." : fresh ? "✅ اقتراح كوتشي متحدّث بآخر نسخة من التحليل والمكونات."
      : a.adaptation ? "⚠️ التحليل أو المكونات اتغيروا بعد ما الاقتراح اتكتب." : "الخطوة الجاية: اقتراح لكوتشي مبني على المشاهد والمكونات دي."}</span>
      <button class="btn primary" data-flow="adapt" ${anBusy || adBusy ? "disabled" : ""}>${adBusy ? "⏳ بيكتب الاقتراح..."
        : fresh ? "التالي: اقتراح كوتشي ←" : "التالي: اكتب اقتراح كوتشي من التحليل ده ←"}</button>`;
  }
  const s1 = $("adAdaptStale");
  s1.hidden = !adaptStale(a) || adBusy;
  s1.innerHTML = `<span class="grow">${adaptNoMotion(a) ? "⚠️ الاقتراح ده مكتوب بالطريقة القديمة على الفكرة بس، من غير الموشن جرافيك بتاع كل مشهد."
    : "⚠️ الاقتراح ده مكتوب على نسخة أقدم من التحليل (التحليل أو المكونات اتغيروا بعده)."}</span>
    <button class="btn sm primary" data-flow="adapt" ${anBusy ? "disabled" : ""}>↻ اكتبه من جديد بالتحليل الجديد</button>`;
  const n2 = $("adNextAdapt");
  n2.hidden = !a.adaptation?.scenes?.length || adBusy;
  if (!n2.hidden) {
    const fresh = a.prod && !prodStale(a), old = adaptStale(a);
    n2.innerHTML = `<span class="muted">${fresh ? "✅ التنفيذ ماشي على آخر نسخة من الاقتراح."
      : old ? "⚠️ الاقتراح ده مبني على تحليل أقدم، فالموشن جرافيك الجديد مش فيه. هيتكتب من جديد بالموشن وبعدين يتاخد للتنفيذ."
      : a.prod ? "⚠️ الاقتراح اتغير بعد ما التنفيذ بدأ." : "الخطوة الجاية: التنفيذ (ستوري بورد ← مكونات ← فيديو لكل لقطة)."}</span>
      <button class="btn primary" data-flow="prod" ${prodBusy(a) && !fresh ? "disabled" : ""}>${fresh ? "التالي: التنفيذ ←"
        : old ? "التالي: حدّث الاقتراح بالموشن وخده للتنفيذ ←" : "التالي: خد الاقتراح ده للتنفيذ ←"}</button>`;
  }
  const s2 = $("adProdStale"), hist = a.prod_history || [];
  const stale = prodStale(a);
  s2.hidden = !stale && !hist.length;
  s2.classList.toggle("ad-stale", stale);
  s2.classList.toggle("ad-next", !stale);
  s2.innerHTML = `${stale ? `<span class="grow">${adaptStale(a) ? "⚠️ التحليل أو الموشن جرافيك اتغيروا بعد ما الاقتراح اتكتب، فاللقطات هنا ماشية على النسخة القديمة."
      : "⚠️ اقتراح كوتشي اتغير بعد ما التنفيذ ده بدأ، فاللقطات هنا ماشية على النسخة القديمة."}</span>
      <button class="btn sm primary" data-flow="prod" ${prodBusy(a) || a.adapt_status === "working" ? "disabled" : ""}>${adaptStale(a) ? "↻ حدّث الاقتراح بالموشن وخده للتنفيذ" : "↻ خد الاقتراح الجديد للتنفيذ"}</button>` : `<span class="grow muted">📦 في تنفيذ قديم محفوظ.</span>`}
    ${hist.length ? `<button class="btn sm" data-prod-restore="0" ${prodBusy(a) ? "disabled" : ""}>↶ رجّع التنفيذ السابق (${hist[0].shots} لقطة)</button>` : ""}`;
}

// شريط «بيعمل إيه دلوقتي»: كل الشغل اللي شغال في الخلفية للإعلان ده
function renderAdActivity() {
  const a = adx.cur, items = [];
  const nums = (arr) => arr.map((s) => s.n).join("، ");
  if (["queued", "working"].includes(a.status)) items.push(["analysis", `🔍 بيحلل الإعلان: ${a.step || "في الطابور"}`]);
  if (a.scomp_status === "working") items.push(["analysis", "🎞️ بيستخرج الموشن جرافيك ومكونات كل مشهد"]);
  if (a.adapt_status === "working") items.push(["adapt", a.chain_prod ? "✍️ بيكتب اقتراح كوتشي بالموشن، وبعده هيبدأ التنفيذ" : "✍️ بيكتب اقتراح كوتشي"]);
  if (a.audio_status === "working") items.push(["audio", "🎧 بيسمع الصوت ويفصّصه"]);
  const shots = a.prod?.shots || [];
  const drawing = shots.filter((s) => s.frame_status === "working"), waitDraw = shots.filter((s) => s.frame_status === "queued");
  if (drawing.length) items.push(["prod", `🎨 بيرسم الستوري بورد: لقطة ${nums(drawing)}`]);
  if (waitDraw.length) items.push(["prod", `⏳ مستني يرسم: لقطة ${nums(waitDraw)}`]);
  const mo = shots.filter((s) => s.motion_status === "working");
  if (mo.length) items.push(["prod", `🎞️ بيستحضر الموشن جرافيك من الإعلان الأصلي: لقطة ${nums(mo)}`]);
  const comps = shots.filter((s) => s.comp_status === "working");
  if (comps.length) items.push(["prod", `🧩 بيستخرج مكونات: لقطة ${nums(comps)}`]);
  const cimg = shots.filter((s) => s.components.some((c) => c.status === "working"));
  if (cimg.length) items.push(["prod", `🖼️ بيولّد صور ${cimg.reduce((k, s) => k + s.components.filter((c) => c.status === "working").length, 0)} مكون (لقطة ${nums(cimg)})`]);
  const gen = shots.filter((s) => s.takes.some((t) => t.status === "working")), waitGen = shots.filter((s) => s.takes.some((t) => t.status === "queued"));
  if (gen.length) items.push(["prod", `🎬 بيولّد فيديو: لقطة ${nums(gen)}`]);
  if (waitGen.length) items.push(["prod", `⏳ فيديو في الطابور: لقطة ${nums(waitGen)}`]);
  const el = $("adActivity");
  el.classList.toggle("busy", !!items.length);
  el.innerHTML = items.length
    ? `<div class="spin"></div><b>شغال دلوقتي:</b>${items.map(([t, x]) => `<button type="button" class="ad-act" data-act-tab="${t}">${x}</button>`).join("")}`
    : `<span class="dot"></span><span class="muted">ساكت دلوقتي، مفيش حاجة شغالة. اختار الخطوة اللي عايزها.</span>`;
}

async function adFlow(btn, to) {
  const a = adx.cur;
  if (to === "adapt") {
    if (a.adaptation && !adaptStale(a)) { adx.tab = "adapt"; return renderAds(); }
    if (a.adaptation && !confirm("هيكتب اقتراح جديد من آخر نسخة من التحليل والمكونات. التعديلات اللي عملتها بإيدك في الاقتراح الحالي هتتشال. تكمل؟")) return;
    return busyButton(btn, "⏳", async () => {
      adx.cur = await api(`/api/ads/${a.id}/adapt`, { method: "POST", ...jsonBody({ message: "" }) });
      adx.tab = "adapt";
      renderAds();
    });
  }
  if (a.prod && !prodStale(a)) { adx.tab = "prod"; return renderAds(); }
  if (adaptStale(a)) {
    // الموشن بيوصل للتنفيذ عن طريق الاقتراح: يتكتب من جديد من آخر تحليل، وبعدها التنفيذ بيبدأ منه لوحده
    if (!confirm(a.prod ? "الاقتراح هيتكتب من جديد من آخر تحليل (بالموشن جرافيك اللي اتستخرج)، وبعدها التنفيذ هيبدأ منه لوحده. التنفيذ الحالي هيتحفظ وتقدر ترجعه. تكمل؟"
      : "الاقتراح هيتكتب من جديد من آخر تحليل (بالموشن جرافيك اللي اتستخرج)، وبعدها التنفيذ هيبدأ منه لوحده. تكمل؟")) return;
    return busyButton(btn, "⏳", async () => {
      adx.cur = await api(`/api/ads/${a.id}/adapt`, { method: "POST", ...jsonBody({ message: "", then_prod: true }) });
      adx.followProd = a.id;
      renderAds();
    });
  }
  if (a.prod && !confirm("هيبدأ تنفيذ جديد من آخر نسخة من الاقتراح. التنفيذ الحالي (صوره وفيديوهاته) هيتحفظ وتقدر ترجعه بزرار «رجّع التنفيذ السابق». تكمل؟")) return;
  return busyButton(btn, "⏳", async () => {
    adx.cur = await pAPI("/start", { method: "POST" });
    adx.tab = "prod";
    renderAds();
  });
}
document.querySelector('.view[data-view="10"]').addEventListener("click", (e) => {
  const f = e.target.closest("[data-flow]");
  if (f) return adFlow(f, f.dataset.flow);
  if (e.target.closest("[data-scomps]")) return $("adSceneCompsGo").click();
  const go = e.target.closest("[data-act-tab]");
  if (go) { adx.tab = go.dataset.actTab; return renderAds(); }
  const r = e.target.closest("[data-prod-restore]");
  if (r && confirm("ترجّع التنفيذ السابق؟ التنفيذ الحالي هيتحفظ مكانه.")) pDo(r, "⏳", () => pAPI(`/restore?i=${r.dataset.prodRestore}`, { method: "POST" }));
});

// ---------- 4. التنفيذ: راس الإعلان ← ستوري بورد ← مكونات ← لقطات ← المونتاج ----------
const PBUSY = new Set(["queued", "working"]);
function prodBusy(a) {
  return !!a.prod?.shots.some((s) => PBUSY.has(s.frame_status) || s.comp_status === "working" || s.motion_status === "working"
    || s.components.some((c) => c.status === "working") || s.takes.some((t) => PBUSY.has(t.status)));
}
const HEADER_LABELS = { title: "اسم الإعلان", concept: "الكونسبت", style: "الستايل البصري (بالإنجليزي)", characters: "الشخصيات (نفس الشكل في كل لقطة)",
  locations: "الأماكن", palette: "ألوان البراند", brand: "🧠 هوية المنتج (من عقل الإعلان)", rules: "قواعد ثابتة" };
const KIND_LABEL = { character: "🧍 شخصية", prop: "📦 أداة", background: "🏞️ خلفية", graphic: "✨ جرافيك", text: "🔤 كلام", ui: "📱 شاشة", icon: "⭐ أيقونة", effect: "💫 تأثير", logo: "🏷️ لوجو" };
const PSHOT_LABELS = { visual: "اللي بيحصل", shot: "اللقطة", camera: "الكاميرا", on_screen_text: "كلام على الشاشة", voice: "الكلام", sfx: "المؤثرات" };
const pAPI = (path, opts) => api(`/api/ads/${adx.cur.id}/prod${path}`, opts);
async function pDo(btn, label, fn) {
  return busyButton(btn, label, async () => { adx.cur = await fn(); renderAds(); });
}

// بنوقف إعادة الرسم بس لو بتكتب في خانة، مش لو دوست زرار (الزرار بيفضل متعلّم عليه)
function editingIn(el) {
  const f = document.activeElement;
  return !!f && el.contains(f) && f.matches("textarea, select, input:not([type=checkbox]):not([type=file]):not([type=radio])");
}

function renderAdProd() {
  const a = adx.cur, p = a.prod;
  $("adProdStart").hidden = !!p;
  $("adProdMain").hidden = !p;
  $("adProdGo").disabled = !a.adaptation?.scenes?.length;
  if (!p) return;
  const h = p.header;
  if (!editingIn($("adHeader"))) {
    $("adHeader").innerHTML = Object.entries(HEADER_LABELS).map(([k, l]) => adField(l, h[k], `data-h="${k}"`, k === "style" || k === "characters" ? 3 : 2, k === "style")).join("");
  }
  $("adHeaderStyle").innerHTML = `<option value="">من غير ستايل</option>` + adx.styles.map((s) => `<option value="${s.id}" ${s.id === h.style_id ? "selected" : ""}>${adEsc(s.name)}</option>`).join("");
  $("adHeaderAspect").value = h.aspect || "9:16";
  const shots = p.shots, n = shots.length;
  const framed = shots.filter((s) => s.frame).length, comps = shots.filter((s) => s.components.length).length;
  const okv = shots.filter((s) => s.takes.some((t) => t.id === s.chosen && t.approved)).length;
  $("adPProgress").textContent = `🎨 ${framed}/${n} · 🧩 ${comps}/${n} · ✅ ${shots.filter((s) => s.approved).length}/${n} · 🎬 ${okv}/${n}`;
  $("adPApproveAll").textContent = shots.every((s) => s.approved) ? "↩ الغي اعتماد الكل" : "✅ اعتمد كل اللقطات";
  if (editingIn($("adPShots"))) return;
  $("adPShots").innerHTML = shots.map((s) => {
    const fbusy = PBUSY.has(s.frame_status);
    const ref = s.ref_frame ? `<div class="ref"><img src="/media/ads/${a.id}/frames/${s.ref_frame}" alt="">من الإعلان الأصلي (مشهد ${s.ref_scene})</div>` : "";
    const chosen = s.takes.find((t) => t.id === s.chosen);
    return `<article class="ad-pshot ${s.approved ? "approved" : ""}" data-ps="${s.id}">
      <div>
        <div class="frame">${s.frame_url ? `<img src="${s.frame_url}" alt="">` : ""}${fbusy ? `<div class="car-wait over"><div class="spin"></div></div>` : s.frame_url ? "" : "لسه من غير ستوري بورد"}</div>
        ${s.frames.length > 1 ? `<div class="vers">${s.frames.map((f) => `<img src="${f.url}" data-pframe="${f.file}" class="${f.url === s.frame_url ? "sel" : ""}" alt="">`).join("")}</div>` : ""}
        ${s.frame_error ? `<div class="err">${adEsc(s.frame_error)}</div>` : ""}
        ${ref}
        <div class="row wrap" style="margin-top:6px">
          <button class="btn sm" data-p="frame" ${fbusy ? "disabled" : ""}>🎨 ${s.frame_url ? "ارسم تاني" : "ارسم"}</button>
          ${s.frame_url && !fbusy ? `<button class="btn sm danger" data-p="delframe" title="امسح الستوري بورد دي">🗑️</button>` : ""}
          <button class="btn sm ${s.approved ? "" : "primary"}" data-p="approve">${s.approved ? "✅ معتمدة" : "✅ اعتمد"}</button>
        </div>
        ${(() => { const n = s.components.filter((c) => c.use !== false && c.image_url).length;
          return n ? `<p class="muted" style="font-size:12px;margin:4px 0 0">🧩 الرسم بيستخدم صور ${n} مكون زي ما هي</p>` : ""; })()}
      </div>
      <div class="body">
        <header><b class="n">${s.n}</b><label class="muted">المدة <input type="number" min="1" max="15" step="0.5" value="${s.seconds}" data-pf="seconds" style="width:64px"> ث</label></header>
        <div class="ad-fields">${Object.entries(PSHOT_LABELS).map(([k, l]) => adField(l, s[k], `data-pf="${k}"`, 1)).join("")}</div>
        <div class="ad-motion">${s.ref_motion ? `<div class="ad-mg orig" data-no-i18n>↩ <b>الموشن في المشهد الأصلي ${adEsc(s.ref_scene)}:</b> ${adEsc(s.ref_motion)}</div>` : ""}
          ${adField("🎞️ الموشن جرافيك في اللقطة", s.motion_notes, 'data-pf="motion_notes"', 2)}
          <div class="row wrap"><button class="btn sm" data-p="motion" ${s.motion_status === "working" ? "disabled" : ""}>${s.motion_status === "working" ? "⏳ بيستحضر الموشن..." : "🎞️ استحضر الموشن من المشهد الأصلي"}</button></div>
          ${s.motion_error ? `<div class="err">${adEsc(s.motion_error)}</div>` : ""}
          ${adField("Motion prompt (بيدخل في الستوري بورد والفيديو)", s.motion_prompt, 'data-pf="motion_prompt"', 2, true)}</div>
        <h4 class="pane-h">🧩 المكونات ${s.comp_status === "working" ? `<span class="spin-inline"></span>` : ""}
          <button class="btn sm" data-p="comps" ${!s.frame_url || s.comp_status === "working" ? "disabled" : ""} title="الموديل يشوف الستوري بورد واللقطة الأصلية ويظبط المكونات عليهم">${s.components.length ? "↻ حدّث المكونات من الستوري بورد" : "🧩 استخرج المكونات"}</button>
          ${s.components.length ? `<button class="btn sm" data-p="compimgs">🖼️ صور المكونات</button><button class="btn sm" data-p="addcomp">＋ مكون</button>` : ""}</h4>
        ${s.comp_error ? `<div class="err">${adEsc(s.comp_error)}</div>` : ""}
        <div class="ad-comps">${s.components.map((c) => `<div class="ad-comp ${c.use === false ? "off" : ""}" data-pc="${c.id}">
          <div class="img">${c.image_url ? `<img src="${c.image_url}" alt="">` : c.status === "working" ? `<div class="spin"></div>` : "🖼️"}</div>
          ${c.images.length > 1 ? `<div class="vers">${c.images.map((f) => `<img src="${f.url}" data-cimg="${f.file}" class="${f.url === c.image_url ? "sel" : ""}" alt="">`).join("")}</div>` : ""}
          <span class="kind">${KIND_LABEL[c.kind] || adEsc(c.kind)}${c.motion ? " · 🎞️" : ""}${c.brain_asset ? ` · <b class="up">🧠 من عقل الإعلان</b>` : c.uploaded ? ` · <b class="up">⬆ من عندك</b>` : ""}</span>
          <input type="text" value="${adEsc(c.name)}" data-cf="name" data-no-i18n>
          <textarea rows="3" dir="ltr" data-cf="image_prompt" placeholder="Image prompt" data-no-i18n>${adEsc(c.image_prompt)}</textarea>
          ${c.animation ? `<span class="muted" data-no-i18n>🎞️ ${adEsc(c.animation)}</span>` : ""}
          ${c.error ? `<div class="err">${adEsc(c.error)}</div>` : ""}
          <div class="row wrap">${c.uploaded ? "" : `<button class="btn sm" data-c="img" ${c.status === "working" ? "disabled" : ""}>🖼️ ${c.image_url ? "تاني" : "ولّد"}</button>`}
            <label class="btn sm" title="صورة من عندك">⬆<input type="file" accept="image/*" data-c="up" hidden></label>
            <label class="check" title="يدخل في الفيديو"><input type="checkbox" data-cf="use" ${c.use === false ? "" : "checked"}>يدخل</label>
            <button class="btn sm danger" data-c="del">✕</button></div>
        </div>`).join("")}</div>
        ${adField("برومبت تجميع اللقطة (Seedance)", s.assembly_prompt || s.prompt, 'data-pf="assembly_prompt"', 3, true)}
        <div class="ad-takes">${s.takes.map((t) => `<div class="ad-take ${t.id === s.chosen ? "sel" : ""} ${t.approved ? "ok" : ""}" data-pt="${t.id}">
          ${t.url ? lightVideo(t.url, 'controls playsinline') : `<div class="wait">${PBUSY.has(t.status) ? `<div class="spin"></div>🎬 بيتولد` : `✕ ${adEsc(t.error || "فشل")}`}</div>`}
          <div class="acts">${t.status === "done" ? `<button class="btn sm" data-t="${t.approved ? "unapprove" : "approve"}">${t.approved ? "✅" : "موافق"}</button>` : ""}
            ${t.status === "failed" ? `<button class="btn sm" data-t="retry">↻</button>` : ""}
            ${t.id !== s.chosen && t.status === "done" ? `<button class="btn sm" data-t="pick">اختار</button>` : ""}
            ${PBUSY.has(t.status) ? "" : `<button class="btn sm danger" data-t="delete">✕</button>`}</div></div>`).join("")}</div>
        <div class="row wrap">
          <button class="btn sm ${chosen ? "" : "primary"}" data-p="gen" ${s.frame_url ? "" : "disabled"} title="${s.frame_url ? "" : "ارسم الستوري بورد الأول"}">🎬 ${chosen ? "ولّد واحد تاني" : "ولّد الفيديو"}</button>
          <label class="btn sm">⬆ ارفع فيديو<input type="file" accept="video/*" data-p="uptake" hidden></label>
        </div>
      </div>
    </article>`;
  }).join("");
}

$("adProdGo").onclick = () => pDo($("adProdGo"), "⏳", () => pAPI("/start", { method: "POST" }));
$("adProdRestart").onclick = () => {
  if (!confirm("تبدأ التنفيذ من جديد من اقتراح كوتشي الحالي؟ التنفيذ ده (صوره وفيديوهاته) هيتحفظ وتقدر ترجعه بزرار «رجّع التنفيذ السابق».")) return;
  pDo($("adProdRestart"), "⏳", () => pAPI("/start", { method: "POST" }));
};
$("adHeader").addEventListener("change", (e) => {
  const k = e.target.dataset.h;
  if (k) pAPI("/header", { method: "PATCH", ...jsonBody({ header: { [k]: e.target.value } }) }).then((a) => (adx.cur = a)).catch((err) => toast(err.message, true));
});
$("adHeaderStyle").addEventListener("change", () => pAPI("/header", { method: "PATCH", ...jsonBody({ header: { style_id: $("adHeaderStyle").value || null } }) })
  .then((a) => { adx.cur = a; renderAds(); toast("🎨 الستايل اتغير في راس الإعلان. الصور والفيديوهات الجاية هتتعمل بيه"); }).catch((err) => toast(err.message, true)));
$("adHeaderAspect").addEventListener("change", () => pAPI("/header", { method: "PATCH", ...jsonBody({ header: { aspect: $("adHeaderAspect").value } }) })
  .then((a) => { adx.cur = a; renderAds(); }).catch((err) => toast(err.message, true)));
$("adPBrain").onclick = () => busyButton($("adPBrain"), "⏳", async () => {
  const r = await pAPI("/apply-brain", { method: "POST" });
  adx.cur = r;
  renderAds();
  toast(r.applied ? `🧠 اتحط ${r.applied} مكون من عقل الإعلان (شاشات / لوجو / منتج)` : "مفيش مكونات شاشات أو لوجو محتاجة صور من عقل الإعلان");
});
$("adPMotion").onclick = () => {
  if (!confirm("يتفرج على كل مشهد في الإعلان الأصلي ويستحضر الموشن جرافيك بتاعه في اللقطة المقابلة (الموشن المكتوب + عناصر الموشن كمكونات). الموشن المكتوب دلوقتي هيتبدل، والمكونات الموجودة مش هتتلمس. تكمل؟")) return;
  pDo($("adPMotion"), "⏳", () => pAPI("/motion", { method: "POST" }));
};
$("adPDelFrames").onclick = () => {
  const n = adx.cur.prod.shots.filter((s) => s.frames.length).length;
  if (!n) return toast("مفيش ستوري بورد تتمسح");
  if (!confirm(`تمسح الستوري بورد بتاعة كل اللقطات (${n} لقطة، بكل نسخها)؟ المكونات والفيديوهات مش هتتلمس.`)) return;
  pDo($("adPDelFrames"), "⏳", () => pAPI("/frames", { method: "DELETE" }));
};
$("adPFrames").onclick = () => pDo($("adPFrames"), "⏳", () => pAPI("/frames", { method: "POST" }));
$("adPComps").onclick = () => pDo($("adPComps"), "⏳", () => pAPI("/components", { method: "POST" }));
$("adPCompImgs").onclick = () => {
  const comps = adx.cur.prod.shots.flatMap((s) => s.components).filter((c) => c.use !== false);
  const todo = comps.filter((c) => !c.image_url && c.status !== "working").length, done = comps.length - todo;
  if (!todo) return toast("كل المكونات ليها صور ✅");
  if (!confirm(`هيولّد صور لـ ${todo} مكون ملهمش صورة. المكونات اللي ليها صورة (${done})، ومنها اللي انت رافعها، مش هتتلمس. تكمل؟`)) return;
  pDo($("adPCompImgs"), "⏳", () => pAPI("/comp-images", { method: "POST" }));
};
$("adPApproveAll").onclick = () => pDo($("adPApproveAll"), "⏳", () => pAPI(`/approve-all?approved=${!adx.cur.prod.shots.every((s) => s.approved)}`, { method: "POST" }));
$("adPGenerate").onclick = () => {
  const n = adx.cur.prod.shots.filter((s) => s.approved && s.frame_url && !s.takes.some((t) => t.status !== "failed")).length;
  if (n && !confirm(`تولّد فيديو لـ ${n} لقطة بـ Seedance؟ (التوليد بيتحسب عليك)`)) return;
  pDo($("adPGenerate"), "⏳", () => pAPI("/generate-approved", { method: "POST" }));
};
$("adPEditor").onclick = () => busyButton($("adPEditor"), "⏳", async () => {
  const r = await pAPI("/to-editor", { method: "POST" });
  storageSet("studiomania.projectId", r.project_id);
  if (typeof mt !== "undefined") mt.project = null;
  toast("🎞️ اتفتح الإعلان في المونتاج");
  showStep("6");
});

$("adPShots").addEventListener("change", async (e) => {
  const card = e.target.closest("[data-ps]");
  if (!card) return;
  const sid = card.dataset.ps;
  try {
    if (e.target.dataset.pf) {
      adx.cur = await pAPI(`/shots/${sid}`, { method: "PATCH", ...jsonBody({ fields: { [e.target.dataset.pf]: e.target.value } }) });
      return;
    }
    const comp = e.target.closest("[data-pc]");
    if (comp && e.target.dataset.cf) {
      const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      adx.cur = await pAPI(`/shots/${sid}/components/${comp.dataset.pc}`, { method: "PATCH", ...jsonBody({ fields: { [e.target.dataset.cf]: v } }) });
      if (e.target.type === "checkbox") renderAds();
      return;
    }
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    const form = new FormData();
    form.append("file", f);
    toast("⏳ بيرفع...");
    if (comp && e.target.dataset.c === "up") adx.cur = await pAPI(`/shots/${sid}/components/${comp.dataset.pc}/upload`, { method: "POST", body: form });
    else if (e.target.dataset.p === "uptake") adx.cur = await pAPI(`/upload-take?shot_id=${sid}`, { method: "POST", body: form });
    renderAds();
  } catch (err) { toast(err.message, true); }
});
$("adPShots").addEventListener("click", async (e) => {
  const card = e.target.closest("[data-ps]");
  if (!card) return;
  const sid = card.dataset.ps;
  const s = adx.cur.prod.shots.find((x) => x.id === sid);
  const b = e.target.closest("button, img[data-pframe], img[data-cimg]");
  if (!b) return;
  try {
    if (b.dataset.pframe) adx.cur = await pAPI(`/shots/${sid}/frame`, { method: "POST", ...jsonBody({ file: b.dataset.pframe }) });
    else if (b.dataset.p === "frame") adx.cur = await pAPI(`/frames?shot_id=${sid}`, { method: "POST" });
    else if (b.dataset.p === "motion") adx.cur = await pAPI(`/motion?shot_id=${sid}`, { method: "POST" });
    else if (b.dataset.p === "delframe") {
      const more = s.frames.length > 1;
      if (!confirm(more ? `تمسح الستوري بورد المعروضة للقطة ${s.n}؟ النسخة اللي قبلها هتظهر مكانها.` : `تمسح الستوري بورد بتاعة اللقطة ${s.n}؟`)) return;
      adx.cur = await pAPI(`/shots/${sid}/frame`, { method: "DELETE" });
    }
    else if (b.dataset.p === "approve") adx.cur = await pAPI(`/shots/${sid}`, { method: "PATCH", ...jsonBody({ fields: { approved: !s.approved } }) });
    else if (b.dataset.p === "comps") {
      if (s.components.length && !confirm("تحدّث المكونات من الستوري بورد؟ المكونات اللي ليها صورة بنفس الاسم بتفضل بصورتها.")) return;
      adx.cur = await pAPI(`/components?shot_id=${sid}`, { method: "POST" });
    } else if (b.dataset.p === "compimgs") adx.cur = await pAPI(`/comp-images?shot_id=${sid}`, { method: "POST" });
    else if (b.dataset.p === "addcomp") adx.cur = await pAPI(`/shots/${sid}/components`, { method: "POST", ...jsonBody({ fields: {} }) });
    else if (b.dataset.p === "gen") {
      if (!confirm(`تولّد فيديو للقطة ${s.n} بـ Seedance؟ (التوليد بيتحسب عليك)`)) return;
      adx.cur = await pAPI(`/shots/${sid}/generate`, { method: "POST" });
    } else {
      const comp = b.closest("[data-pc]");
      if (comp && b.dataset.cimg) adx.cur = await pAPI(`/shots/${sid}/components/${comp.dataset.pc}`, { method: "PATCH", ...jsonBody({ fields: { image: b.dataset.cimg } }) });
      else if (comp && b.dataset.c === "img") adx.cur = await pAPI(`/comp-images?shot_id=${sid}&comp_id=${comp.dataset.pc}`, { method: "POST" });
      else if (comp && b.dataset.c === "del") {
        if (!confirm("تشيل المكون ده؟")) return;
        adx.cur = await pAPI(`/shots/${sid}/components/${comp.dataset.pc}`, { method: "DELETE" });
      } else {
        const take = b.closest("[data-pt]");
        if (!take || !b.dataset.t) return;
        if (b.dataset.t === "delete" && !confirm("تمسح النسخة دي؟")) return;
        adx.cur = await pAPI(`/shots/${sid}/take?action=${b.dataset.t}`, { method: "POST", ...jsonBody({ take_id: take.dataset.pt }) });
      }
    }
    renderAds();
  } catch (err) { toast(err.message, true); }
});


// ---------- 🧠 عقل الإعلان: المنتج وأصوله الحقيقية (شاشات، لوجو، صور منتج) وهويته المستنبطة ----------
const BRAIN_KIND_TITLE = { logos: "لوجو", screens: "شاشة", products: "صورة" };
const curBrain = () => adx.brains.find((b) => b.id === adx.brainId) || adx.brains[0];
function renderBrain() {
  const b = curBrain();
  adx.brainId = b?.id || null;
  $("adBrainPick").innerHTML = adx.brains.map((x) => `<option value="${x.id}" ${x.id === adx.brainId ? "selected" : ""}>${adEsc(x.name)}</option>`).join("");
  $("adBrainBody").hidden = !b;
  $("adBrainDel").disabled = !b;
  if (!b) return;
  $("adBrainState").innerHTML = b.status === "working" ? `<span class="spin-inline"></span> 🔍 بيشوف الصور ويستنبط الهوية...`
    : b.status === "failed" ? `✕ ${adEsc(b.error || "الاستنباط فشل")}` : "";
  $("adBrainAnalyze").disabled = b.status === "working";
  if (editingIn($("adBrainBody"))) return;
  document.querySelectorAll("#adBrainBody [data-bf]").forEach((el) => (el.value = b[el.dataset.bf] || ""));
  document.querySelector('#adBrainBody [data-bn="name"]').value = b.name;
  document.querySelectorAll("#adBrainBody [data-bsec]").forEach((el) => (el.hidden = b.type !== "app"));
  for (const kind of ["logos", "screens", "products"]) {
    const grid = document.querySelector(`[data-bgrid="${kind}"]`);
    grid.hidden = kind === "screens" && b.type !== "app";
    grid.innerHTML = b[kind].map((x) => `<div class="ad-brain-item" data-bfile="${adEsc(x.file)}">
        <img src="${x.url}" alt="" loading="lazy">
        <input type="text" value="${adEsc(x.name)}" data-ba="name" data-no-i18n>
        <textarea rows="3" data-ba="description" placeholder="${b.status === "working" ? "بيتوصف..." : "وصف"}" data-no-i18n>${adEsc(x.description)}</textarea>
        <button class="btn sm danger" type="button" data-bdel title="احذف">✕</button></div>`).join("")
      || `<p class="muted">لسه مفيش ${BRAIN_KIND_TITLE[kind]}.</p>`;
  }
}
const bAPI = (path, opts) => api(`/api/ad-brains/${adx.brainId}${path}`, opts);
async function brainSave(fn) {
  try {
    const b = await fn();
    adx.brains = adx.brains.map((x) => (x.id === b.id ? b : x));
    renderAds();
  } catch (err) { toast(err.message, true); }
}
$("adBrainGo").onclick = $("adBrainGo2").onclick = async () => {
  adx.view = "brain";
  if (adx.cur?.settings?.brain_id && adx.cur.settings.brain_id !== "none") adx.brainId = adx.cur.settings.brain_id;
  adx.brains = await api("/api/ad-brains");
  renderAds();
};
$("adBrainBack").onclick = () => { adx.view = "ad"; renderAds(); };
$("adBrainPick").onchange = () => { adx.brainId = $("adBrainPick").value; renderAds(); };
$("adBrainNew").onclick = async () => {
  const name = prompt("اسم المنتج؟");
  if (!name?.trim()) return;
  try {
    const b = await api("/api/ad-brains", { method: "POST", ...jsonBody({ name, fields: {} }) });
    adx.brains.push(b);
    adx.brainId = b.id;
    renderAds();
  } catch (err) { toast(err.message, true); }
};
$("adBrainDel").onclick = async () => {
  const b = curBrain();
  if (!b || !confirm(`تحذف عقل «${b.name}» بكل شاشاته ولوجوهاته؟`)) return;
  try { await api(`/api/ad-brains/${b.id}`, { method: "DELETE" }); adx.brains = await api("/api/ad-brains"); adx.brainId = null; renderAds(); }
  catch (err) { toast(err.message, true); }
};
$("adBrainAnalyze").onclick = () => brainSave(() => bAPI("/analyze", { method: "POST" }));
$("adBrainBody").addEventListener("change", async (e) => {
  const el = e.target;
  if (el.dataset.bf) return brainSave(() => bAPI("", { method: "PATCH", ...jsonBody({ fields: { [el.dataset.bf]: el.value } }) }));
  if (el.dataset.bn) return brainSave(() => bAPI("", { method: "PATCH", ...jsonBody({ name: el.value, fields: {} }) }));
  const item = el.closest("[data-bfile]");
  if (item && el.dataset.ba) return brainSave(() => bAPI(`/assets/${encodeURIComponent(item.dataset.bfile)}`, { method: "PATCH", ...jsonBody({ [el.dataset.ba]: el.value }) }));
  if (el.dataset.bup) {
    const files = [...el.files].filter((f) => /\.(png|jpe?g|webp)$/i.test(f.name));
    el.value = "";
    if (!files.length) return toast("مفيش صور (PNG / JPG / WEBP) في اللي اخترته", true);
    const form = new FormData();
    form.append("kind", el.dataset.bup);
    files.slice(0, 120).forEach((f) => form.append("files", f));
    toast(`⏳ بيرفع ${files.length} صورة...`);
    await brainSave(() => bAPI("/assets", { method: "POST", body: form }));
    toast("✅ اترفعت، والبرنامج بيوصفهم ويستنبط الهوية");
  }
});
$("adBrainBody").addEventListener("click", (e) => {
  const item = e.target.closest("[data-bfile]");
  if (!item || !e.target.closest("[data-bdel]") || !confirm("تحذف الصورة دي من عقل الإعلان؟")) return;
  brainSave(() => bAPI(`/assets/${encodeURIComponent(item.dataset.bfile)}`, { method: "DELETE" }));
});
