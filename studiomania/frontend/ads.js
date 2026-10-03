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
      if ($("adGalDialog").open) renderAdGallery();
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
  if (a.prod?.cast_status === "working") items.push(["prod", "🎭 بيطلّع الأبطال والمكونات المتكررة"]);
  const ci = (a.prod?.cast || []).filter((c) => c.status === "working");
  if (ci.length) items.push(["prod", `🖼️ بيرسم صور الأبطال: ${ci.map((c) => c.name).join("، ")}`]);
  const mo = shots.filter((s) => s.motion_status === "working");
  if (mo.length) items.push(["prod", `🎞️ بيستحضر الموشن جرافيك من الإعلان الأصلي: لقطة ${nums(mo)}`]);
  const comps = shots.filter((s) => s.comp_status === "working");
  if (comps.length) items.push(["prod", `🧩 بيستخرج مكونات: لقطة ${nums(comps)}`]);
  const cimg = shots.filter((s) => s.components.some((c) => c.status === "working"));
  if (cimg.length) items.push(["prod", `🖼️ بيولّد صور ${cimg.reduce((k, s) => k + s.components.filter((c) => c.status === "working").length, 0)} مكون (لقطة ${nums(cimg)})`]);
  if (a.prod?.full_voice?.status === "working") items.push(["prod", "🎙️ بيسمع الصوت الكامل ويقطّعه على اللقطات"]);
  const vc = shots.filter((s) => s.voice_status === "working");
  if (vc.length) items.push(["prod", `🎙️ بيولّد الصوت: لقطة ${nums(vc)}`]);
  const ls = shots.filter((s) => s.takes.some((t) => t.lipsync && PBUSY.has(t.status)));
  if (ls.length) items.push(["prod", `👄 بيحرّك البق مع الكلام: لقطة ${nums(ls)}`]);
  const lp = shots.filter((s) => s.layers_status === "working");
  if (lp.length) items.push(["prod", `🤖 بيخطط طبقات الموشن من الأصلي: لقطة ${nums(lp)}`]);
  const cmp = shots.filter((s) => s.takes.some((t) => t.composite && PBUSY.has(t.status)));
  if (cmp.length) items.push(["prod", `✨ بيركّب الموشن على الفيديو: لقطة ${nums(cmp)}`]);
  const gen = shots.filter((s) => s.takes.some((t) => t.status === "working" && !t.composite && !t.lipsync)), waitGen = shots.filter((s) => s.takes.some((t) => t.status === "queued" && !t.composite && !t.lipsync));
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
  if (a.prod?.cast_status === "working" || a.prod?.cast?.some((c) => c.status === "working") || a.prod?.full_voice?.status === "working") return true;
  return !!a.prod?.shots.some((s) => PBUSY.has(s.frame_status) || s.comp_status === "working" || s.motion_status === "working" || s.layers_status === "working" || s.voice_status === "working"
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

// ---------- ✨ الموشن المتركب: طبقات فوق فيديو اللقطة (مكان، توقيت، حركة دخول وخروج) ----------
const LAYER_KINDS = new Set(["graphic", "text", "ui", "icon", "effect", "logo"]);
const ANIM_IN = { fade: "يظهر تدريجي", pop: "ينط (pop)", zoom: "يكبر", slide_up: "يطلع من تحت", slide_down: "ينزل من فوق", slide_left: "يدخل من اليمين", slide_right: "يدخل من الشمال", none: "من غير حركة" };
const ANIM_OUT = { fade: "يختفي تدريجي", pop: "يصغر ويختفي", zoom: "يصغر", slide_up: "يطلع لفوق", slide_down: "ينزل لتحت", slide_left: "يخرج شمال", slide_right: "يخرج يمين", none: "من غير حركة" };
const LOOP = { none: "ثابت", float: "بيطفو", pulse: "بينبض" };
const layerComps = (s) => s.components.filter((c) => c.use !== false && (LAYER_KINDS.has(c.kind) || c.motion));
const opts = (map, v) => Object.entries(map).map(([k, l]) => `<option value="${k}" ${k === v ? "selected" : ""}>${l}</option>`).join("");
function renderLayers(s) {
  const layers = s.layers || [], comps = layerComps(s), byId = Object.fromEntries(s.components.map((c) => [c.id, c]));
  const base = s.takes.find((t) => t.id === s.chosen && t.url && !t.composite) || [...s.takes].reverse().find((t) => t.url && !t.composite);
  const working = s.layers_status === "working";
  const stage = layers.map((L) => {
    const pos = `left:${L.x * 100}%;top:${L.y * 100}%`;
    if (L.type === "text") return `<span class="lt" data-lid="${L.id}" style="${pos};font-size:calc(${L.size} * var(--lh));color:${L.color};${L.box ? `background:${L.box}` : ""}" data-no-i18n>${adEsc(L.text)}</span>`;
    const c = byId[L.comp_id];
    return c?.image_url ? `<img data-lid="${L.id}" src="${c.image_url}" style="${pos};width:${L.w * 100}%" alt="">`
      : `<span class="lt ph" data-lid="${L.id}" style="${pos}">${adEsc(c?.name || "؟")}</span>`;
  }).join("");
  const rows = layers.map((L) => `<div class="ad-lrow" data-lrow="${L.id}">
      ${L.type === "text" ? `<input type="text" value="${adEsc(L.text)}" data-lf="text" data-no-i18n>
        <input type="color" value="${L.color}" data-lf="color" title="لون الكلام"><input type="color" value="${L.box || "#000000"}" data-lf="box" title="لون الخلفية">`
      : `<b data-no-i18n>${adEsc(byId[L.comp_id]?.name || "عنصر")}</b>`}
      <label>من <input type="number" step="0.1" min="0" value="${L.start}" data-lf="start"></label>
      <label>لـ <input type="number" step="0.1" min="0" value="${L.end}" data-lf="end"></label>
      <label>الحجم <input type="number" step="${L.type === "text" ? 0.005 : 0.05}" min="0.01" value="${L.type === "text" ? L.size : L.w}" data-lf="${L.type === "text" ? "size" : "w"}"></label>
      <select data-lf="in" title="الدخول">${opts(ANIM_IN, L.in)}</select>
      <select data-lf="out" title="الخروج">${opts(ANIM_OUT, L.out)}</select>
      <select data-lf="loop" title="وهو ظاهر">${opts(LOOP, L.loop)}</select>
      <button type="button" class="btn sm danger" data-ldel="${L.id}">✕</button>
      ${L.note ? `<small class="muted" data-no-i18n>${adEsc(L.note)}</small>` : ""}</div>`).join("");
  return `<div class="ad-layers">
    <h4 class="pane-h">✨ الموشن المتركب ${working ? `<span class="spin-inline"></span>` : ""}
      <button class="btn sm" data-p="lplan" ${working ? "disabled" : ""}>${working ? "⏳ بيخطط من الأصلي..." : "🤖 خطّط من الإعلان الأصلي"}</button>
      <select class="btn sm" data-laddimg><option value="">＋ عنصر</option>${comps.map((c) => `<option value="${c.id}">${adEsc(c.name)}</option>`).join("")}</select>
      <button class="btn sm" data-p="ltext">＋ كلام</button>
      <button class="btn sm primary" data-p="lcomp" ${layers.length && base ? "" : "disabled"} title="${base ? "" : "ولّد فيديو اللقطة الأول"}">✨ ركّب على الفيديو</button></h4>
    ${s.layers_error ? `<div class="muted">${adEsc(s.layers_error)}</div>` : ""}
    ${layers.length ? `<p class="hint">العناصر والكلام بيتطبعوا فوق الفيديو بحركتهم. اسحب أي عنصر في المعاينة عشان تغيّر مكانه. اللقطات اللي ليها موشن متركب الستوري بورد والفيديو بتوعها بيترسموا من غير الجرافيك.</p>
      <div class="ad-lwrap"><div class="ad-lstage" data-lstage="${s.id}">${base ? `<video src="${base.url}" muted playsinline loop preload="metadata"></video>` : s.frame_url ? `<img class="bg" src="${s.frame_url}" alt="">` : ""}${stage}</div>
      <div class="ad-lrows">${rows}</div></div>` : ""}
  </div>`;
}
async function saveLayers(sid, layers) {
  try { adx.cur = await pAPI(`/shots/${sid}/layers`, { method: "PUT", ...jsonBody({ layers }) }); renderAds(); }
  catch (err) { toast(err.message, true); }
}
$("adPShots").addEventListener("change", (e) => {
  const card = e.target.closest("[data-ps]");
  if (!card) return;
  const s = adx.cur.prod.shots.find((x) => x.id === card.dataset.ps);
  if (e.target.matches("[data-addment]")) {
    const n = e.target.value;
    if (!n) return;
    const text = `${(s.sb_prompt || "").trim()} @${n}`.trim();
    return pAPI(`/shots/${s.id}`, { method: "PATCH", ...jsonBody({ fields: { sb_prompt: text } }) })
      .then((r) => { adx.cur = r; renderAds(); }).catch((err) => toast(err.message, true));
  }
  if (e.target.matches("[data-laddimg]")) {
    const cid = e.target.value;
    if (!cid) return;
    return saveLayers(s.id, [...(s.layers || []), { type: "image", comp_id: cid, start: 0.3, end: Math.max(1, s.seconds - 0.2), x: 0.5, y: 0.5, w: 0.5, in: "pop", out: "fade" }]);
  }
  const row = e.target.closest("[data-lrow]"), f = e.target.dataset.lf;
  if (!row || !f) return;
  const v = ["start", "end", "size", "w"].includes(f) ? Number(e.target.value) : e.target.value;
  saveLayers(s.id, s.layers.map((L) => (L.id === row.dataset.lrow ? { ...L, [f]: v } : L)));
});
// سحب العناصر في المعاينة
let ldrag = null;
$("adPShots").addEventListener("pointerdown", (e) => {
  const el = e.target.closest("[data-lstage] [data-lid]");
  if (!el) return;
  e.preventDefault();
  const stage = el.closest("[data-lstage]");
  ldrag = { el, stage, sid: stage.dataset.lstage, id: el.dataset.lid, r: stage.getBoundingClientRect() };
  el.setPointerCapture(e.pointerId);
  el.classList.add("drag");
});
$("adPShots").addEventListener("pointermove", (e) => {
  if (!ldrag) return;
  const x = Math.min(1, Math.max(0, (e.clientX - ldrag.r.left) / ldrag.r.width));
  const y = Math.min(1, Math.max(0, (e.clientY - ldrag.r.top) / ldrag.r.height));
  Object.assign(ldrag, { x, y });
  ldrag.el.style.left = `${x * 100}%`;
  ldrag.el.style.top = `${y * 100}%`;
});
$("adPShots").addEventListener("pointerup", () => {
  if (!ldrag) return;
  const d = ldrag;
  ldrag = null;
  d.el.classList.remove("drag");
  if (d.x == null) return;
  const s = adx.cur.prod.shots.find((x) => x.id === d.sid);
  saveLayers(d.sid, s.layers.map((L) => (L.id === d.id ? { ...L, x: +d.x.toFixed(3), y: +d.y.toFixed(3) } : L)));
});

// ---------- ✏️ نافذة التعديل: طلبك بالكلام + صور مرجعية (لحد 4) ----------
const fix = { files: [], submit: null };
function openFix({ title, hint, placeholder, submit }) {
  fix.files = [];
  fix.submit = submit;
  $("adFixTitle").textContent = title;
  $("adFixHint").textContent = hint || "";
  $("adFixNote").value = "";
  $("adFixNote").placeholder = placeholder || "";
  renderFixThumbs();
  $("adFixDialog").showModal();
  $("adFixNote").focus();
}
function addFixFiles(list) {
  for (const f of list) if (f.type.startsWith("image/") && fix.files.length < 4) fix.files.push(f);
  renderFixThumbs();
}
function renderFixThumbs() {
  $("adFixThumbs").innerHTML = fix.files.map((f, i) => `<span class="th"><img src="${URL.createObjectURL(f)}" alt=""><button type="button" data-fixdel="${i}">✕</button></span>`).join("");
}
$("adFixFiles").addEventListener("change", (e) => { addFixFiles([...e.target.files]); e.target.value = ""; });
$("adFixThumbs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-fixdel]");
  if (b) { fix.files.splice(Number(b.dataset.fixdel), 1); renderFixThumbs(); }
});
$("adFixDialog").addEventListener("paste", (e) => {
  const imgs = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
  if (imgs.length) { e.preventDefault(); addFixFiles(imgs); }
});
$("adFixCancel").onclick = () => $("adFixDialog").close();
$("adFixForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const note = $("adFixNote").value.trim();
  if (!note) return $("adFixNote").focus();
  const form = new FormData();
  form.append("note", note.slice(0, 1500));
  fix.files.forEach((f, i) => form.append("files", f, f.name || `ref-${i + 1}.png`));
  await busyButton($("adFixGo"), "⏳", async () => {
    await fix.submit(form);
    $("adFixDialog").close();
  });
});
function editFrame(s) {
  openFix({
    title: `✏️ عدّل الستوري بورد: لقطة ${s.n}`,
    placeholder: "مثلًا: قرّب الكاميرا على وشه، خلّي الخلفية جيم، شيل الكوباية، لبّسه زي الصورة المرجعية",
    hint: "الصورة الحالية بتتعدّل: اللي طلبته بس بيتغير والباقي بيفضل زي ما هو. النسخة القديمة بتفضل في النسخ.",
    submit: async (form) => {
      adx.cur = await pAPI(`/shots/${s.id}/edit-frame`, { method: "POST", body: form });
      renderAds();
      toast("✏️ بيرسم نسخة معدّلة، والقديمة بتفضل في النسخ");
    },
  });
}
function editTake(s, tid) {
  openFix({
    title: `✏️ عدّل فيديو لقطة ${s.n} (نسخة جديدة)`,
    placeholder: "مثلًا: الكاميرا تتحرك أبطأ، يبتسم في الآخر، من غير ما يبص للكاميرا",
    hint: "بيولّد نسخة جديدة بـ Seedance (التوليد بيتحسب عليك) والقديمة بتفضل. لو التعديل في الكادر نفسه (المكان، اللبس)، عدّل الستوري بورد الأول.",
    submit: async (form) => {
      form.append("take_id", tid || "");
      adx.cur = await pAPI(`/shots/${s.id}/edit-take`, { method: "POST", body: form });
      renderAds();
      if ($("adGalDialog").open) renderAdGallery();
      scheduleAdPoll();
      toast("✏️ النسخة المعدّلة بتتولد، وهتظهر جنب القديمة");
    },
  });
}

// بيغيّر محتوى العنصر بس لو اتغير فعلًا: الصور والفيديوهات متتحملش من الأول كل ٣ ثواني والصفحة متتهزش
function setHTML(el, html) {
  if (el._html === html) return;
  el._html = html;
  el.innerHTML = html;
}

// بنوقف إعادة الرسم بس لو بتكتب في خانة، مش لو دوست زرار (الزرار بيفضل متعلّم عليه)
function editingIn(el) {
  const f = document.activeElement;
  return !!f && el.contains(f) && f.matches("textarea, select, input:not([type=checkbox]):not([type=file]):not([type=radio])");
}

// ---------- ✍️ برومبت الستوري بورد بالمنشن: @الاسم = صورة حقيقية من عقل الإعلان بتتبعت مع الرسم ----------
const DB_KIND = { character: "🧍", background: "🏞️", prop: "🧰", product: "📦", screen: "📱", logo: "🏷️" };
function renderSb(a, s) {
  const db = a.brain_db || [], byName = Object.fromEntries(db.map((x) => [x.name, x]));
  const ments = (s.mentions || []).filter((n) => byName[n]);
  const rest = db.filter((x) => !ments.includes(x.name));
  return `<div class="ad-sb">
    <label class="ad-f"><span>✍️ برومبت الستوري بورد (بالمنشن من 🧠 العقل)</span>
      <textarea rows="3" dir="ltr" data-pf="sb_prompt" placeholder="لسه متكتبش. دوس «✍️ اكتبه بالمنشن» أو زرار الرسم فوق" data-no-i18n>${adEsc(s.sb_prompt || "")}</textarea></label>
    <div class="ad-ments">${ments.map((n) => `<span class="ment" title="${adEsc(byName[n].kind)}"><img src="${byName[n].url}" alt="">@${adEsc(n)}</span>`).join("")
      || `<span class="muted">مفيش منشن لسه: الرسم مش هياخد صور من العقل للقطة دي.</span>`}</div>
    <div class="row wrap">
      <button class="btn sm" data-p="sbwrite">✍️ ${s.sb_prompt ? "اكتبه تاني بالمنشن" : "اكتبه بالمنشن"}</button>
      ${rest.length ? `<select class="btn sm" data-addment><option value="">＋ منشن من العقل</option>${rest.map((x) => `<option value="${adEsc(x.name)}">${DB_KIND[x.kind] || ""} @${adEsc(x.name)}</option>`).join("")}</select>` : ""}
    </div></div>`;
}

// ---------- 🎙️ الصوت (بعد الستوري بورد): بيحدد مدة اللقطة، و👄 الكلام على الوش ----------
function speakers(a) {
  return (a.prod.cast || []).filter((c) => c.kind === "character" && c.approved).map((c) => c.name);
}
function renderVoice(a, s) {
  const working = s.voice_status === "working", spk = speakers(a);
  const base = s.takes.find((t) => t.id === s.chosen && t.url && !t.composite) || [...s.takes].reverse().find((t) => t.url && !t.composite && !t.lipsync);
  const lipBusy = s.takes.some((t) => t.lipsync && PBUSY.has(t.status));
  return `<div class="ad-voice">
    <div class="row wrap">
      <b>🎙️ الصوت</b>
      <select data-pf="speaker" title="مين بيتكلم"><option value="">🎙️ راوي (فويس أوفر)</option>${spk.map((n) => `<option value="${adEsc(n)}" ${n === s.speaker ? "selected" : ""}>🧍 ${adEsc(n)}</option>`).join("")}</select>
      <label class="check" title="الشخصية بتتكلم قدام الكاميرا وبُقها لازم يتحرك مع الكلام"><input type="checkbox" data-pf="talking" ${s.talking ? "checked" : ""}> 👄 بيتكلم قدام الكاميرا</label>
      ${s.a_end != null ? `<span class="muted">⏱️ من ${s.a_start} لـ ${s.a_end} في الصوت الكامل (${s.seconds} ث)</span>` : ""}
    </div>
    ${s.voice_url ? `<audio src="${s.voice_url}" controls preload="none"></audio>` : `<span class="muted">${s.voice ? "الصوت بتاع اللقطة دي بيتقص لوحده لما ترفع الصوت الكامل فوق." : "اللقطة دي من غير كلام."}</span>`}
    ${s.voice_error ? `<div class="muted">⚠️ ${adEsc(s.voice_error)}</div>` : ""}
    ${s.voice_url ? `<div class="row wrap ad-lip">
      <button class="btn sm primary" data-p="lipkavatar" ${s.frame_url && !lipBusy ? "" : "disabled"} title="صورة الستوري بورد + صوتنا + البرومبت → فيديو جديد الشخصية بتقول فيه الكلام بصوتنا">🎬👄 فيديو بيتكلم بصوتنا من الستوري بورد (الأفضل)</button>
      <button class="btn sm" data-p="lipvideo" ${base && !lipBusy ? "" : "disabled"} title="${base ? "" : "ولّد فيديو اللقطة الأول"}">👄 ركّب الكلام على الفيديو (سريع)</button>
    </div>` : ""}
  </div>`;
}
// السكريبت السادة اللي هتحوّله لصوت: الكلام بس بالترتيب، من غير أرقام لقطات ولا مين بيقول
function adPlainScript(a) {
  return a.prod.shots.map((s) => (s.voice || "").trim()).filter(Boolean).join("\n\n");
}
// نسخة بالتفاصيل (للمراجعة): كل جملة برقم لقطتها ومين بيقولها
function adScript(a) {
  const p = a.prod, lines = p.shots.filter((s) => (s.voice || "").trim());
  return [`سكريبت: ${p.header.title || a.name}`, "",
    ...lines.map((s) => `لقطة ${s.n} — ${s.speaker || "الراوي"}${s.talking ? " (بيتكلم قدام الكاميرا)" : ""}:\n«${s.voice.trim()}»\n`)].join("\n");
}
function renderVoices(a) {
  const p = a.prod, fv = p.full_voice || {}, working = fv.status === "working";
  const n = p.shots.filter((s) => (s.voice || "").trim()).length;
  setHTML($("adVoices"), `<div class="ad-fullvoice">
    <div class="row wrap"><b>🎙️ الصوت الكامل للإعلان</b>
      <span class="muted">١) انسخ السكريبت وحوّله لصوت باللهجة والنبرة اللي تعجبك ← ٢) ارفع الصوت كله ملف واحد ← ٣) البرنامج بيقطّعه على اللقطات بتوقيت الكلام، ومدة كل لقطة بتتظبط عليه.</span></div>
    <div class="row wrap">
      <button class="btn sm" data-fv="copy" ${n ? "" : "disabled"} title="الكلام بس، جاهز تحوّله لصوت">📋 انسخ السكريبت (${n} جملة)</button>
      <button class="btn sm" data-fv="download" ${n ? "" : "disabled"} title="نسخة فيها رقم كل لقطة ومين بيقول الجملة (للمراجعة)">⬇ نزّل نسخة بالتفاصيل</button>
      <label class="btn sm primary">⬆ ارفع الصوت الكامل<input type="file" accept="audio/*,video/*" data-fv-up hidden></label>
      ${fv.file ? `<button class="btn sm" data-fv="realign" ${working ? "disabled" : ""} title="بعد ما تعدّل الكلام في اللقطات">↻ قطّع تاني</button>` : ""}
      ${working ? `<span class="muted"><span class="spin-inline"></span> بيسمع الصوت ويقطّعه على اللقطات...</span>` : ""}
      ${fv.status === "done" ? `<span class="muted">✅ ${fv.duration} ث · اتطابق ${Math.round((fv.ratio || 0) * 100)}% من الكلام</span>` : ""}
    </div>
    ${fv.url ? `<audio src="${fv.url}" controls preload="none"></audio>` : ""}
    ${fv.error ? `<div class="err">✕ ${adEsc(fv.error)}</div>` : ""}
  </div>`);
  if (document.activeElement !== $("adVideoModelSel")) {
    $("adVideoModelSel").innerHTML = a.video_models.map((m) => `<option value="${m.key}" ${m.key === (p.header.video_model || "seedance") ? "selected" : ""}>${m.label}</option>`).join("");
  }
}
function saveVoices(extra = {}) {
  return pAPI("/voices", { method: "PUT", ...jsonBody({ voices: adx.cur.prod.voices || {}, ...extra }) })
    .then((r) => { adx.cur = r; renderAds(); }).catch((err) => toast(err.message, true));
}
$("adVoices").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-fv]");
  if (!b) return;
  if (b.dataset.fv === "copy") return adCopy(adPlainScript(adx.cur));
  if (b.dataset.fv === "download") {
    const url = URL.createObjectURL(new Blob([adScript(adx.cur)], { type: "text/plain;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: "ad-script.txt" }).click();
    return setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  if (b.dataset.fv === "realign") {
    try { adx.cur = await pAPI("/full-voice", { method: "POST", body: new FormData() }); renderAds(); scheduleAdPoll(); }
    catch (err) { toast(err.message, true); }
  }
});
$("adVoices").addEventListener("change", async (e) => {
  if (!e.target.matches("[data-fv-up]")) return;
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  const form = new FormData();
  form.append("file", f);
  try {
    toast("⏳ بيرفع الصوت...");
    adx.cur = await pAPI("/full-voice", { method: "POST", body: form });
    renderAds();
    scheduleAdPoll();
    toast("🎙️ اترفع. البرنامج بيسمعه ويقطّعه على اللقطات");
  } catch (err) { toast(err.message, true); }
});
$("adVideoModelSel").addEventListener("change", () => saveVoices({ video_model: $("adVideoModelSel").value })
  .then(() => toast("🎬 الفيديوهات الجاية هتتولد بالموديل ده")));

// ---------- 🎭 الأبطال والمكونات المتكررة (قبل الستوري بورد) ----------
const CAST_KIND = { character: "🧍 شخصية", background: "🏞️ مكان / خلفية", prop: "🧰 أداة" };
function renderCast(a) {
  const p = a.prod, cast = p.cast || [], busy = p.cast_status === "working";
  const pending = cast.filter((c) => !c.approved).length;
  const head = `<div class="ad-cast-head"><h3 class="pane-h">🎭 الأبطال والمكونات المتكررة</h3>
      <span class="muted">${cast.length ? `${cast.length - pending}/${cast.length} اتوافق عليهم` : "قبل الستوري بورد: صورة ثابتة لكل شخصية ومكان بيتكرر، عشان يفضلوا هما هما في كل اللقطات."}</span>
      <button class="btn sm ${cast.length ? "" : "primary"}" data-cast="extract" ${busy ? "disabled" : ""}>${busy ? "⏳ بيطلّعهم..." : cast.length ? "↻ طلّعهم تاني" : "🎭 طلّع الأبطال والمكونات"}</button>
      ${cast.some((c) => !c.approved) ? `<button class="btn sm" data-cast="images">🖼️ ${cast.some((c) => c.image) ? "ارسم اللي مش معتمدين" : "ارسم صورهم"}</button>` : ""}
      ${cast.some((c) => c.image && !c.approved) ? `<button class="btn sm primary" data-cast="approveall">🧠 اعتمد الكل وضيفهم للعقل</button>` : ""}</div>
    ${p.cast_error ? `<div class="muted">${adEsc(p.cast_error)}</div>` : ""}
    ${cast.length ? `<p class="hint">لما تعتمد، الصورة بتتحفظ في 🧠 عقل الإعلان باسمها، وبرومبتات الستوري بورد بتعمل لها منشن (@الاسم) فصورتها الحقيقية بتتبعت مع الرسم في كل لقطة.</p>` : ""}`;
  const cards = cast.map((c) => `<div class="ad-cast-card ${c.approved ? "ok" : ""}" data-cast-id="${c.id}">
      <div class="img">${c.image_url ? `<img src="${c.image_url}" alt="">` : c.status === "working" ? `<div class="spin"></div>` : "🖼️"}${c.status === "working" && c.image_url ? `<div class="car-wait over"><div class="spin"></div></div>` : ""}</div>
      ${c.images.length > 1 ? `<div class="vers">${c.images.map((f) => `<img src="${f.url}" data-cast-pick="${f.file}" class="${f.url === c.image_url ? "sel" : ""}" title="${adEsc(f.note)}" alt="">`).join("")}</div>` : ""}
      <div class="row"><select data-castf="kind">${Object.entries(CAST_KIND).map(([k, l]) => `<option value="${k}" ${k === c.kind ? "selected" : ""}>${l}</option>`).join("")}</select>
        ${c.approved ? `<b class="okb">🧠 @${adEsc(c.name)}</b>` : c.from_brain ? `<small class="muted">من عقل الإعلان</small>` : ""}</div>
      <input type="text" value="${adEsc(c.name)}" data-castf="name" data-no-i18n>
      <small class="muted">في اللقطات: ${(c.shots || []).join("، ") || "—"}</small>
      <textarea rows="2" data-castf="description" data-no-i18n>${adEsc(c.description)}</textarea>
      <textarea rows="3" dir="ltr" data-castf="image_prompt" placeholder="Fixed description (English)" data-no-i18n>${adEsc(c.image_prompt)}</textarea>
      ${c.error ? `<div class="err">${adEsc(c.error)}</div>` : ""}
      <div class="row wrap">
        <button class="btn sm" data-cast="img" ${c.status === "working" ? "disabled" : ""}>🖼️ ${c.image_url ? "تاني" : "ارسم"}</button>
        ${c.image_url ? `<button class="btn sm" data-cast="edit" ${c.status === "working" ? "disabled" : ""}>✏️ عدّل</button>` : ""}
        <label class="btn sm" title="صورة من عندك">⬆<input type="file" accept="image/*" data-cast-up hidden></label>
        ${c.image_url ? `<button class="btn sm ${c.approved ? "" : "primary"}" data-cast="${c.approved ? "unapprove" : "approve"}">${c.approved ? "↩ الغي الاعتماد" : "🧠 اعتمد وضيفه للعقل"}</button>` : ""}
        <button class="btn sm danger" data-cast="del">✕</button></div>
    </div>`).join("");
  setHTML($("adCast"), head + (cast.length ? `<div class="ad-cast-grid">${cards}</div>` : ""));
}
const cAPI = (path, opts) => pAPI(`/cast${path}`, opts);
$("adCast").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-cast], [data-cast-pick]");
  if (!b) return;
  const card = b.closest("[data-cast-id]"), cid = card?.dataset.castId, act = b.dataset.cast;
  try {
    if (b.dataset.castPick) adx.cur = await cAPI(`/${cid}/pick`, { method: "POST", ...jsonBody({ file: b.dataset.castPick }) });
    else if (act === "extract") {
      if (adx.cur.prod.cast?.length && !confirm("يطلّع الأبطال والمكونات تاني من الاقتراح؟ اللي ليهم صور أو اتوافق عليهم بيفضلوا.")) return;
      adx.cur = await cAPI("/extract", { method: "POST" });
    } else if (act === "images") {
      const redo = adx.cur.prod.cast.filter((c) => !c.approved && c.image_url);
      if (redo.length && !confirm(`في ${redo.length} (${redo.map((c) => c.name).join("، ")}) ليهم صور ومش معتمدين: هيترسموا من جديد والصورة القديمة بتاعتهم هتتمسح.\n\nلو في صورة عاجباك، اعتمدها الأول بـ «🧠 اعتمد وضيفه للعقل» عشان متتمسحش.\n\nتكمل؟`)) return;
      adx.cur = await cAPI(`/images?redo=true`, { method: "POST" });
    }
    else if (act === "approveall") adx.cur = await cAPI("/approve-all", { method: "POST" });
    else if (act === "img") adx.cur = await cAPI(`/images?cast_id=${cid}`, { method: "POST" });
    else if (act === "approve") { adx.cur = await cAPI(`/${cid}/approve`, { method: "POST" }); toast("✅ اتحفظ في عقل الإعلان واتربط باللقطات"); }
    else if (act === "unapprove") adx.cur = await cAPI(`/${cid}/approve?undo=true`, { method: "POST" });
    else if (act === "del") { if (!confirm("تشيله من القايمة؟")) return; adx.cur = await cAPI(`/${cid}`, { method: "DELETE" }); }
    else if (act === "edit") {
      const c = adx.cur.prod.cast.find((x) => x.id === cid);
      return openFix({
        title: `✏️ عدّل صورة «${c.name}»`,
        placeholder: "مثلًا: شعره أطول، لبسه أزرق، أكبر في السن، خلّي الجيم أوسع",
        hint: "الصورة الحالية بتتعدّل والقديمة بتفضل في النسخ.",
        submit: async (form) => { adx.cur = await cAPI(`/${cid}/edit`, { method: "POST", body: form }); renderAds(); },
      });
    }
    renderAds();
    scheduleAdPoll();
  } catch (err) { toast(err.message, true); }
});
$("adCast").addEventListener("change", async (e) => {
  const card = e.target.closest("[data-cast-id]");
  if (!card) return;
  const cid = card.dataset.castId;
  try {
    if (e.target.matches("[data-cast-up]")) {
      const f = e.target.files[0];
      e.target.value = "";
      if (!f) return;
      const form = new FormData();
      form.append("file", f);
      adx.cur = await cAPI(`/${cid}/upload`, { method: "POST", body: form });
    } else if (e.target.dataset.castf) {
      adx.cur = await cAPI(`/${cid}`, { method: "PATCH", ...jsonBody({ fields: { [e.target.dataset.castf]: e.target.value } }) });
    } else return;
    renderAds();
  } catch (err) { toast(err.message, true); }
});

function renderAdProd() {
  const a = adx.cur, p = a.prod;
  $("adProdStart").hidden = !!p;
  $("adProdMain").hidden = !p;
  $("adProdGo").disabled = !a.adaptation?.scenes?.length;
  if (!p) return;
  if (!editingIn($("adCast"))) renderCast(a);
  if (!editingIn($("adVoices"))) renderVoices(a);
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
  if (ldrag || editingIn($("adPShots")) || [...$("adPShots").querySelectorAll("video")].some((v) => !v.paused)) return;
  $("adPShots").style.setProperty("--ad-ar", (h.aspect || "9:16").replace(":", " / "));
  setHTML($("adPShots"), shots.map((s) => {
    const fbusy = PBUSY.has(s.frame_status);
    const ref = s.ref_frame ? `<div class="ref"><img src="/media/ads/${a.id}/frames/${s.ref_frame}" alt="">من الإعلان الأصلي (مشهد ${s.ref_scene})</div>` : "";
    const chosen = s.takes.find((t) => t.id === s.chosen);
    return `<article class="ad-pshot ${s.approved ? "approved" : ""}" data-ps="${s.id}">
      <div>
        <div class="frame">${s.frame_url ? `<img src="${s.frame_url}" alt="">` : ""}${fbusy ? `<div class="car-wait over"><div class="spin"></div></div>` : s.frame_url ? "" : "لسه من غير ستوري بورد"}</div>
        ${s.frames.length > 1 ? `<div class="vers">${s.frames.map((f) => `<img src="${f.url}" data-pframe="${f.file}" class="${f.url === s.frame_url ? "sel" : ""}" alt="">`).join("")}</div>` : ""}
        ${s.frame_error ? `<div class="err">${adEsc(s.frame_error)}</div>` : ""}
        ${s.frame_note ? `<p class="muted ad-note" data-no-i18n>✏️ ${adEsc(s.frame_note)}</p>` : ""}
        ${ref}
        <div class="row wrap" style="margin-top:6px">
          <button class="btn sm" data-p="frame" ${fbusy ? "disabled" : ""}>🎨 ${s.frame_url ? "ارسم تاني" : "ارسم"}</button>
          ${s.frame_url && !fbusy ? `<button class="btn sm" data-p="editframe" title="قول عايز تغيّر إيه ويرسمها تاني">✏️ عدّل</button>
            <button class="btn sm danger" data-p="delframe" title="امسح الستوري بورد دي">🗑️</button>` : ""}
          <button class="btn sm ${s.approved ? "" : "primary"}" data-p="approve">${s.approved ? "✅ معتمدة" : "✅ اعتمد"}</button>
        </div>
        ${(() => { const n = s.components.filter((c) => c.use !== false && c.image_url).length;
          return n ? `<p class="muted" style="font-size:12px;margin:4px 0 0">🧩 الرسم بيستخدم صور ${n} مكون زي ما هي</p>` : ""; })()}
      </div>
      <div class="body">
        <header><b class="n">${s.n}</b><label class="muted">المدة <input type="number" min="1" max="15" step="0.5" value="${s.seconds}" data-pf="seconds" style="width:64px"> ث</label></header>
        <div class="ad-fields">${Object.entries(PSHOT_LABELS).map(([k, l]) => adField(l, s[k], `data-pf="${k}"`, 1)).join("")}</div>
        ${renderSb(a, s)}
        ${renderVoice(a, s)}
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
        ${renderLayers(s)}
        <div class="ad-takes">${s.takes.map((t) => `<div class="ad-take ${t.id === s.chosen ? "sel" : ""} ${t.approved ? "ok" : ""}" data-pt="${t.id}" ${t.note ? `title="✏️ ${adEsc(t.note)}"` : ""}>
          ${t.composite ? `<b class="ad-take-badge">✨ موشن</b>` : t.lipsync ? `<b class="ad-take-badge">👄 بيتكلم</b>` : t.video_model && t.video_model !== "seedance" ? `<b class="ad-take-badge alt">${adEsc(t.video_model.startsWith("kling") ? "Kling" : t.video_model)}</b>` : ""}${t.url ? `<button type="button" class="ad-take-play" data-tplay="${t.id}" title="شغّل وعاين">${lightVideo(t.url, "muted playsinline")}<i>▶</i></button>` : `<div class="wait">${PBUSY.has(t.status) ? `<div class="spin"></div>${t.composite ? "✨ بيركّب" : t.lipsync ? "👄 بيحرّك البق" : "🎬 بيتولد"}` : `✕ ${adEsc(t.error || "فشل")}`}</div>`}
          <div class="acts">${t.status === "done" ? `<button class="btn sm" data-t="${t.approved ? "unapprove" : "approve"}">${t.approved ? "✅" : "موافق"}</button>` : ""}
            ${t.status === "failed" ? `<button class="btn sm" data-t="retry">↻</button>` : ""}
            ${t.status === "done" && !t.composite ? `<button class="btn sm" data-tedit="${t.id}" title="قول عايز تغيّر إيه ويولّد نسخة جديدة">✏️</button>` : ""}
            ${t.id !== s.chosen && t.status === "done" ? `<button class="btn sm" data-t="pick">اختار</button>` : ""}
            ${PBUSY.has(t.status) ? "" : `<button class="btn sm danger" data-t="delete">✕</button>`}</div></div>`).join("")}</div>
        <div class="row wrap">
          <button class="btn sm ${chosen ? "" : "primary"}" data-p="gen" ${s.frame_url ? "" : "disabled"} title="${s.frame_url ? "" : "ارسم الستوري بورد الأول"}">🎬 ${chosen ? "ولّد واحد تاني" : "ولّد الفيديو"}</button>
          <label class="btn sm">⬆ ارفع فيديو<input type="file" accept="video/*" data-p="uptake" hidden></label>
        </div>
      </div>
    </article>`;
  }).join(""));
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
const castWarn = () => {
  const n = (adx.cur.prod.cast || []).filter((c) => !c.approved).length;
  return !n || confirm(`في ${n} من الأبطال والمكونات المتكررة لسه ما اتوافقش عليهم، فمش هيدخلوا في الرسم. ترسم برضه؟`);
};
$("adPFrames").onclick = () => {
  if (!castWarn()) return;
  // المعتمدة متتلمسش. اللي مش معتمدة: البرومبت بيتكتب من جديد بالمنشن وبتترسم، والجديد بيمسح القديم
  const shots = adx.cur.prod.shots, todo = shots.filter((s) => !s.approved);
  if (!todo.length) return toast("كل اللقطات معتمدة ✅. الغي اعتماد اللقطة اللي عايز ترسمها تاني");
  const old = todo.filter((s) => s.frame_url);
  if (old.length && !confirm(`${old.length} لقطة (${old.map((s) => s.n).join("، ")}) ليها ستوري بورد ومش معتمدة: هتترسم من جديد والصورة القديمة بتاعتها هتتمسح.\n\nلو في ستوري بورد عاجبك، اعتمده الأول بـ «✅ اعتمد» تحت الصورة عشان ميتمسحش.\n\nالمعتمدة (${shots.length - todo.length}) مش هتتلمس. تكمل؟`)) return;
  busyButton($("adPFrames"), "✍️ بيكتب البرومبتات...", async () => {
    adx.cur = await pAPI("/sb-prompts?skip_approved=true", { method: "POST" });
    renderAds();
    adx.cur = await pAPI("/frames?redo=true", { method: "POST" });
    renderAds();
    toast(`🎨 بيرسم ${todo.length} لقطة بصور المنشنز من عقل الإعلان`);
  });
};
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
      const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      adx.cur = await pAPI(`/shots/${sid}`, { method: "PATCH", ...jsonBody({ fields: { [e.target.dataset.pf]: v } }) });
      if (["speaker", "talking"].includes(e.target.dataset.pf)) setTimeout(renderAds, 0);
      if (e.target.dataset.pf === "sb_prompt") setTimeout(renderAds, 0);  // المنشنز اتقرت من جديد
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
    else if (e.target.dataset.p === "voiceup") { adx.cur = await pAPI(`/shots/${sid}/voice/upload`, { method: "POST", body: form }); toast("🎙️ الصوت اترفع، ومدة اللقطة اتظبطت عليه"); }
    renderAds();
  } catch (err) { toast(err.message, true); }
});
$("adPShots").addEventListener("click", async (e) => {
  const card = e.target.closest("[data-ps]");
  if (!card) return;
  const sid = card.dataset.ps;
  const s = adx.cur.prod.shots.find((x) => x.id === sid);
  const tp = e.target.closest("[data-tplay]");
  if (tp) return openAdGallery(sid, tp.dataset.tplay);
  const b = e.target.closest("button, img[data-pframe], img[data-cimg]");
  if (!b) return;
  try {
    if (b.dataset.pframe) adx.cur = await pAPI(`/shots/${sid}/frame`, { method: "POST", ...jsonBody({ file: b.dataset.pframe }) });
    else if (b.dataset.p === "frame") adx.cur = await pAPI(`/frames?shot_id=${sid}`, { method: "POST" });
    else if (b.dataset.p === "motion") adx.cur = await pAPI(`/motion?shot_id=${sid}`, { method: "POST" });
    else if (b.dataset.p === "lplan") {
      if (s.layers?.length && !confirm("الطبقات الحالية هتتبدل بخطة جديدة من الإعلان الأصلي. تكمل؟")) return;
      adx.cur = await pAPI(`/layers/plan?shot_id=${sid}`, { method: "POST" });
    } else if (b.dataset.p === "ltext") {
      await saveLayers(sid, [...(s.layers || []), { type: "text", text: "كلام جديد", start: 0.3, end: Math.max(1, s.seconds - 0.3), x: 0.5, y: 0.2, size: 0.05, color: "#FFFFFF", box: "#57B8AF", in: "pop", out: "fade" }]);
      return;
    } else if (b.dataset.ldel) {
      await saveLayers(sid, s.layers.filter((L) => L.id !== b.dataset.ldel));
      return;
    } else if (b.dataset.p === "lcomp") adx.cur = await pAPI(`/shots/${sid}/composite`, { method: "POST" });
    else if (b.dataset.p === "voice") adx.cur = await pAPI(`/voice?shot_id=${sid}`, { method: "POST" });
    else if (b.dataset.p === "voicedel") { if (!confirm("تمسح صوت اللقطة دي؟")) return; adx.cur = await pAPI(`/shots/${sid}/voice`, { method: "DELETE" }); }
    else if (["lipvideo", "lipimage", "lipkavatar"].includes(b.dataset.p)) {
      const m = { lipvideo: "video", lipimage: "image", lipkavatar: "kavatar" }[b.dataset.p];
      if (!confirm(m === "video" ? "يركّب الصوت على فيديو اللقطة ويحرّك البق مع الكلام (نسخة جديدة «👄»). تكمل؟"
        : "يعمل فيديو جديد من صورة الستوري بورد والشخصية بتقول الكلام ده (بياخد حوالي ٣ دقايق). تكمل؟")) return;
      adx.cur = await pAPI(`/shots/${sid}/lipsync?method=${m}`, { method: "POST" });
    }
    else if (b.dataset.p === "sbwrite") adx.cur = await pAPI(`/sb-prompts?shot_id=${sid}`, { method: "POST" });
    else if (b.dataset.p === "editframe") return editFrame(s);
    else if (b.dataset.tedit) return editTake(s, b.dataset.tedit);
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
const BRAIN_KIND_TITLE = { logos: "لوجو", screens: "شاشة", products: "صورة", characters: "شخصيات", sets: "أماكن", props: "أدوات" };
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
  for (const kind of ["logos", "screens", "products", "characters", "sets", "props"]) {
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


// ---------- ▶️ معاينة فيديوهات الإعلان: كل اللقطات قدامك، ودوسة تكبّر الفيديو وتشغّله ----------
const agal = { sid: null, tid: null };
const TAKE_ST = { queued: "⏳ في الطابور", working: "🎬 بيتولد", failed: "✕ فشل" };
function adGalShots() { return adx.cur?.prod?.shots || []; }
function openAdGallery(sid = null, tid = null) {
  agal.sid = sid;
  agal.tid = tid;
  if (!$("adGalDialog").open) $("adGalDialog").showModal();
  renderAdGallery();
}
function shotTake(s) {
  return s.takes.find((t) => t.id === s.chosen && t.url) || [...s.takes].reverse().find((t) => t.url) || null;
}
function renderAdGallery() {
  const shots = adGalShots();
  const ok = shots.filter((s) => s.takes.some((t) => t.id === s.chosen && t.approved)).length;
  const busy = shots.filter((s) => s.takes.some((t) => PBUSY.has(t.status))).length;
  $("adGalCount").textContent = `${shots.length} لقطة · ✅ ${ok} موافق عليها · 🎬 ${busy} بتتولد`;
  $("adGalFullHint").textContent = adx.cur.prod.full_voice?.url ? "الفيديوهات المختارة ورا بعض مع صوتك الكامل، عشان تشوف الإعلان واللب سينك زي ما هيطلعوا."
    : "ارفع الصوت الكامل الأول عشان تقدر تشغّل الإعلان كله بالصوت.";
  const s = shots.find((x) => x.id === agal.sid);
  $("adGalAll").hidden = !!s;
  $("adGalView").hidden = !s;
  if (!s) {
    setHTML($("adGalGrid"), shots.map((x) => {
      const t = shotTake(x), approved = x.takes.some((k) => k.id === x.chosen && k.approved), working = x.takes.some((k) => PBUSY.has(k.status));
      const cls = approved ? "done" : t ? "review" : "todo";
      return `<button type="button" class="gal-tile ${cls}" data-gshot="${x.id}">
        ${t ? lightVideo(t.url, "muted playsinline") : x.frame_url ? `<img src="${x.frame_url}" alt="">` : ""}
        ${working ? `<div class="spin"></div>` : ""}<span class="n">${x.n}</span>
        <span class="st">${approved ? "✅ موافق عليها" : working ? "🎬 بيتولد" : t ? "👀 مستنية موافقتك" : x.frame_url ? "لسه متولدتش" : "من غير ستوري بورد"}</span></button>`;
    }).join("") || `<p class="muted">لسه مفيش لقطات.</p>`);
    return;
  }
  const i = shots.indexOf(s);
  $("adGalPrev").disabled = i <= 0;
  $("adGalNext").disabled = i >= shots.length - 1;
  $("adGalTitle").textContent = `لقطة ${s.n} من ${shots.length}`;
  const take = s.takes.find((t) => t.id === agal.tid && t.url) || shotTake(s);
  agal.tid = take?.id || null;
  const stage = $("adGalStage");
  if (stage.dataset.take !== (take?.id || "") || !stage.firstElementChild) {
    stage.dataset.take = take?.id || "";
    const working = s.takes.find((t) => PBUSY.has(t.status));
    stage.innerHTML = take ? `<video src="${take.url}" controls autoplay playsinline loop ${take.lipsync ? "" : "muted"}></video>`
      : working ? `<div><div class="spin"></div><p>🎬 الفيديو بيتولد...</p></div>`
      : s.frame_url ? `<img src="${s.frame_url}" alt=""><p style="position:absolute">لسه متولدش فيديو</p>` : `<p>لسه مفيش ستوري بورد ولا فيديو</p>`;
  }
  // صوت اللقطة مع الفيديو (الفيديوهات بتتولد من غير صوت). نسخ «👄» فيها الصوت جواها
  const withVoice = !!(take && s.voice_url && !take.lipsync);
  $("adGalVoiceRow").hidden = !withVoice;
  if ($("adGalAudio").dataset.src !== (withVoice ? s.voice_url : "")) {
    $("adGalAudio").dataset.src = withVoice ? s.voice_url : "";
    $("adGalAudio").src = withVoice ? s.voice_url : "";
    bindGalVoice();
  }
  $("adGalInfo").innerHTML = `<b>اللي بيحصل:</b> ${adEsc(s.visual)}${s.voice ? `<br><b>الكلام:</b> ${adEsc(s.voice)}` : ""}${s.motion_notes ? `<br><b>🎞️ الموشن:</b> ${adEsc(s.motion_notes)}` : ""}`;
  setHTML($("adGalTakes"), s.takes.map((t, k) => `<button type="button" class="take ${t.id === agal.tid ? "viewing" : ""} ${t.id === s.chosen ? "sel" : ""}" data-gtake="${t.id}" ${t.url ? "" : "disabled"}>
      ${t.url ? lightVideo(t.url, "muted playsinline") : `<span>${TAKE_ST[t.status] || ""}</span>`}<small>${t.approved ? "✅" : t.id === s.chosen ? "⭐" : ""} ${k + 1}</small></button>`).join("")
    || `<p class="muted">مفيش نسخ لسه.</p>`);
  const t = s.takes.find((x) => x.id === agal.tid);
  if (t?.note) $("adGalInfo").innerHTML += `<br><b>✏️ التعديل المطلوب:</b> ${adEsc(t.note)}`
    + (t.ref_urls?.length ? `<div class="ad-fix-thumbs">${t.ref_urls.map((u) => `<span class="th"><img src="${u}" alt=""></span>`).join("")}</div>` : "");
  $("adGalErr").hidden = !(t?.status === "failed");
  $("adGalErr").textContent = t?.status === "failed" ? `✕ ${t.error || "فشل"}` : "";
  $("adGalActs").innerHTML = (t && t.status === "done" ? `
      <button class="btn ${t.approved ? "" : "primary"}" data-ga="${t.approved ? "unapprove" : "approve"}">${t.approved ? "↩ الغي الموافقة" : "✅ موافق عليه"}</button>
      ${t.id !== s.chosen ? `<button class="btn" data-ga="pick">⭐ اختاره للقطة دي</button>` : ""}
      ${t.composite ? "" : `<button class="btn" data-ga="edit">✏️ عدّل واعمل نسخة جديدة</button>`}
      ${s.voice_url && !t.lipsync && !t.composite ? `<button class="btn" data-ga="lip">👄 ركّب الكلام على الفيديو ده</button>` : ""}
      <button class="btn danger" data-ga="delete">🗑️ امسح النسخة دي</button>` : t?.status === "failed" ? `<button class="btn" data-ga="retry">↻ جرّب تاني</button>` : "")
    + (s.frame_url ? `<button class="btn" data-ga="gen">🎬 ولّد نسخة تانية</button>` : "")
    + (s.frame_url && s.voice_url ? `<button class="btn primary" data-ga="kavatar">🎬👄 فيديو بيتكلم بصوتنا من الستوري بورد</button>` : "");
}
$("adPGallery").onclick = () => openAdGallery();
// صوت اللقطة ماشي مع الفيديو: تشغيل، إيقاف، تقديم، وإعادة من الأول
function bindGalVoice() {
  const v = $("adGalStage").querySelector("video"), au = $("adGalAudio");
  if (!v || v._voiceBound) return;
  v._voiceBound = true;
  const on = () => $("adGalVoice").checked && au.src;
  v.addEventListener("play", () => { if (on()) { au.currentTime = v.currentTime; au.play().catch(() => {}); } });
  v.addEventListener("pause", () => au.pause());
  v.addEventListener("seeked", () => { if (on()) au.currentTime = v.currentTime; });
  v.addEventListener("timeupdate", () => { if (on() && Math.abs(au.currentTime - v.currentTime) > 0.25) au.currentTime = v.currentTime; });
  if (!v.paused && on()) { au.currentTime = v.currentTime; au.play().catch(() => {}); }
}
$("adGalVoice").addEventListener("change", () => { if (!$("adGalVoice").checked) $("adGalAudio").pause(); else bindGalVoice(); });
new MutationObserver(() => bindGalVoice()).observe($("adGalStage"), { childList: true });

// 🎬 الإعلان كله بالصوت الكامل: الفيديو بيتنقل من لقطة للي بعدها على حسب وقت الصوت
const gfull = { list: [], cur: -1 };
function fullPlan() {
  const shots = adGalShots();
  let t = 0;
  return shots.map((s) => {
    const take = s.takes.find((x) => x.id === s.chosen && x.url) || [...s.takes].reverse().find((x) => x.url && x.status === "done");
    const start = s.a_start != null ? Number(s.a_start) : t;
    t = start + Number(s.seconds || 4);
    return { n: s.n, start, end: t, url: take?.url || null, img: s.frame_url };
  });
}
$("adGalFullGo").onclick = () => {
  const fv = adx.cur.prod.full_voice;
  if (!fv?.url) return toast("ارفع الصوت الكامل الأول (في قسم «🎙️ الصوت الكامل» فوق اللقطات)", true);
  gfull.list = fullPlan();
  gfull.cur = -1;
  $("adGalAll").hidden = true;
  $("adGalFull").hidden = false;
  $("adGalFullA").src = fv.url;
  $("adGalFullA").currentTime = 0;
  fullSync();
  $("adGalFullA").play().catch(() => {});
};
function fullSync() {
  const t = $("adGalFullA").currentTime, L = gfull.list;
  let i = L.findIndex((x) => t >= x.start && t < x.end);
  if (i < 0) i = t < (L[0]?.start || 0) ? 0 : L.length - 1;
  const x = L[i], v = $("adGalFullV");
  if (!x) return;
  if (i !== gfull.cur) {
    gfull.cur = i;
    $("adGalFullNow").textContent = `لقطة ${x.n}${x.url ? "" : " (لسه من غير فيديو)"}`;
    $("adGalFullImg").hidden = !!x.url;
    v.hidden = !x.url;
    if (x.url) v.src = x.url; else $("adGalFullImg").src = x.img || "";
  }
  if (x.url) {
    const want = Math.max(0, t - x.start);
    if (Math.abs(v.currentTime - want) > 0.3) v.currentTime = want;
    if ($("adGalFullA").paused) v.pause(); else v.play().catch(() => {});
  }
}
["timeupdate", "seeked", "play", "pause"].forEach((ev) => $("adGalFullA").addEventListener(ev, fullSync));
$("adGalFullBack").onclick = () => { $("adGalFullA").pause(); $("adGalFull").hidden = true; $("adGalAll").hidden = false; };
$("adPLayers").onclick = () => pDo($("adPLayers"), "⏳", () => pAPI("/layers/plan", { method: "POST" }));
$("adPCompose").onclick = () => {
  if (!confirm("يركّب طبقات الموشن على فيديو كل لقطة ليها طبقات وفيديو خلصان. كل لقطة بتاخد نسخة جديدة «✨ موشن» والأصل بيفضل. تكمل؟")) return;
  pDo($("adPCompose"), "⏳", () => pAPI("/composite-all", { method: "POST" }));
};
$("adGalClose").onclick = () => $("adGalDialog").close();
$("adGalDialog").addEventListener("close", () => {
  $("adGalStage").innerHTML = ""; $("adGalStage").dataset.take = ""; agal.sid = null;
  $("adGalAudio").pause(); $("adGalFullA").pause(); $("adGalFull").hidden = true; $("adGalAll").hidden = false;
  renderAds();
});
$("adGalDialog").addEventListener("cancel", (e) => { if (agal.sid) { e.preventDefault(); agal.sid = null; renderAdGallery(); } });
$("adGalBack").onclick = () => { agal.sid = null; $("adGalStage").innerHTML = ""; renderAdGallery(); };
function adGalStep(d) {
  const shots = adGalShots(), i = shots.findIndex((x) => x.id === agal.sid);
  const n = shots[i + d];
  if (n) { agal.sid = n.id; agal.tid = null; renderAdGallery(); }
}
$("adGalPrev").onclick = () => adGalStep(-1);
$("adGalNext").onclick = () => adGalStep(1);
document.addEventListener("keydown", (e) => {
  if (!$("adGalDialog").open || !agal.sid || e.target.closest?.("input, textarea")) return;
  if (e.key === "ArrowLeft") adGalStep(1);  // RTL: الشمال = اللي بعدها
  if (e.key === "ArrowRight") adGalStep(-1);
});
$("adGalGrid").addEventListener("click", (e) => {
  const t = e.target.closest("[data-gshot]");
  if (t) { agal.sid = t.dataset.gshot; agal.tid = null; renderAdGallery(); }
});
$("adGalTakes").addEventListener("click", (e) => {
  const t = e.target.closest("[data-gtake]");
  if (t) { agal.tid = t.dataset.gtake; renderAdGallery(); }
});
$("adGalActs").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-ga]");
  if (!b) return;
  const sid = agal.sid, a = b.dataset.ga;
  try {
    if (a === "gen") {
      if (!confirm("تولّد نسخة تانية للقطة دي بـ Seedance؟ (التوليد بيتحسب عليك)")) return;
      adx.cur = await pAPI(`/shots/${sid}/generate`, { method: "POST" });
    } else if (a === "edit") {
      return editTake(adx.cur.prod.shots.find((x) => x.id === sid), agal.tid);
    } else if (a === "kavatar") {
      if (!confirm("يعمل فيديو جديد من صورة الستوري بورد والشخصية بتقول كلام اللقطة بصوتنا (بياخد حوالي ٣ دقايق). تكمل؟")) return;
      adx.cur = await pAPI(`/shots/${sid}/lipsync?method=kavatar`, { method: "POST" });
      toast("🎬👄 بيعمل الفيديو اللي بيتكلم... هيظهر هنا لما يخلص");
    } else if (a === "lip") {
      if (!confirm("يحرّك البق في الفيديو ده على صوت اللقطة (نسخة جديدة «👄»، بتاخد أقل من دقيقة). تكمل؟")) return;
      adx.cur = await pAPI(`/shots/${sid}/lipsync?method=video&take_id=${agal.tid}`, { method: "POST" });
      toast("👄 بيحرّك البق... النسخة الجديدة هتظهر جنب القديمة وفيها الصوت");
    } else {
      if (a === "delete" && !confirm("تمسح النسخة دي؟")) return;
      adx.cur = await pAPI(`/shots/${sid}/take?action=${a}`, { method: "POST", ...jsonBody({ take_id: agal.tid }) });
      if (a === "delete") agal.tid = null;
    }
    renderAdGallery();
    scheduleAdPoll();
  } catch (err) { toast(err.message, true); }
});
