// StudioMania — الإعلانات: إعلان مرجعي ← تفصيص (مشاهد، فكرة، تصوير، إخراج، أصوات، مؤثرات) ← اقتراح لكوتشي
// ومكتبة ستايلات (صور) بتتحفظ وتتختار لأي إعلان

const adx = { list: [], cur: null, styles: [], tab: "analysis", timer: null, view: "ad" };
const AD_KEY = "studiomania.ad";

async function initAds() {
  [adx.list, adx.styles] = await Promise.all([api("/api/ads"), api("/api/ad-styles")]);
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
  $("adMain").hidden = adx.view !== "ad" || !a;
  $("adEmpty").hidden = adx.view === "styles" || !!a;
  if (adx.view === "styles") renderStyleLib();
  if (a && adx.view === "ad") {
    if (document.activeElement !== $("adName")) $("adName").value = a.name;
    document.querySelectorAll("#adTabs [data-t]").forEach((b) => b.classList.toggle("active", b.dataset.t === adx.tab));
    document.querySelectorAll(".ad-sec").forEach((x) => (x.hidden = x.dataset.sec !== adx.tab));
    renderAdStatus();
    renderAdAnalysis();
    renderAdAudio();
    renderAdAdapt();
    renderAdSettings();
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
  const v = $("adVideo");
  if (a.source_url && v.getAttribute("src") !== a.source_url) v.src = a.source_url;
  const an = a.analysis;
  if (!an) {
    $("adSummary").innerHTML = `<p class="muted">${a.status === "failed" ? "" : "⏳ بيحلل الإعلان..."}</p>`;
    $("adScenes").innerHTML = "";
    return;
  }
  if (!$("adSummary").contains(document.activeElement)) {
    $("adSummary").innerHTML = `${an.brand ? `<p class="muted" data-no-i18n>${adEsc(an.brand)} · ${adFmt(a.source?.duration)}</p>` : ""}` +
      Object.entries(AD_LABELS).map(([k, l]) => adField(l, an[k], `data-an="${k}"`)).join("");
  }
  if (!$("adScenes").contains(document.activeElement)) {
    $("adScenes").innerHTML = (an.scenes || []).map((s) => `<article class="ad-scene" data-scene="${s.n}">
      <div class="ad-scene-media">${s.frame_url ? `<img src="${s.frame_url}" alt="" data-seek="${s.start}">` : ""}
        <b>${s.n}</b><span class="t">${adFmt(s.start)} → ${adFmt(s.end)}</span></div>
      <div class="ad-scene-body">${Object.entries(SCENE_LABELS).filter(([k]) => s[k] != null).map(([k, l]) => adField(l, s[k], `data-sk="${k}"`, 1)).join("")}</div>
    </article>`).join("");
  }
}

function renderAdAudio() {
  const a = adx.cur;
  const au = a.audio, t = a.audio_tech;
  if (!a.source?.has_audio) { $("adAudio").innerHTML = `<p class="muted">الإعلان ده من غير صوت.</p>`; return; }
  if (!au) {
    $("adAudio").innerHTML = a.audio_error ? `<div class="err">✕ ${adEsc(a.audio_error)}</div>` : `<p class="muted">⏳ لسه بيسمع الصوت...</p>`;
    return;
  }
  const m = au.music || {};
  const tech = t ? `<div class="ad-chips"><span>🔊 الارتفاع ${t.lufs ?? "؟"} LUFS</span><span>📈 أعلى نقطة ${t.true_peak ?? "؟"} dB</span><span>↕ المدى ${t.range_lu ?? "؟"} LU</span></div>` : "";
  $("adAudio").innerHTML = `${tech}
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

function renderAdAdapt() {
  const a = adx.cur;
  const busy = a.adapt_status === "working";
  $("adAdaptState").innerHTML = busy ? `<span class="spin-inline"></span> ✍️ بيكتب الاقتراح...` : a.adapt_status === "failed" ? `✕ ${adEsc(a.adapt_error)}` : "";
  $("adAdaptGo").disabled = busy || !a.analysis;
  const ad = a.adaptation;
  if (!ad) { $("adAdapt").innerHTML = `<p class="muted">${busy ? "⏳ بيكتب..." : a.analysis ? "لسه مفيش اقتراح. دوس «اكتب الاقتراح من جديد» في الإعدادات." : "الاقتراح بيتكتب بعد التحليل."}</p>`; return; }
  if ($("adAdapt").contains(document.activeElement)) return;
  const style = adx.styles.find((s) => s.id === a.settings.style_id);
  $("adAdapt").innerHTML = `<div class="ad-adapt-head">
      <input class="ad-adapt-title" data-ad-key="title" value="${adEsc(ad.title)}" data-no-i18n>
      <span class="muted">${ad.duration ? `${adEsc(ad.duration)} ثانية` : ""}${style ? ` · 🎨 ${adEsc(style.name)}` : ""}</span>
      <button class="btn sm" data-copy-adapt>📋 انسخ الاقتراح كله</button></div>
    <div class="ad-fields">${["concept", "why_it_fits", "kochi_angle", "hook", "format"].map((k) => adField(ADAPT_LABELS[k], ad[k], `data-ad-key="${k}"`)).join("")}</div>
    <h3 class="pane-h">🎬 المشاهد</h3>
    <div class="ad-scenes">${(ad.scenes || []).map((s, i) => `<article class="ad-scene adapt" data-ascene="${i}">
      <div class="ad-scene-media"><b>${s.n ?? i + 1}</b><span class="t">${adEsc(s.seconds)}ث</span></div>
      <div class="ad-scene-body">${Object.entries(ADAPT_SCENE_LABELS).map(([k, l]) => adField(l, s[k], `data-ask="${k}"`, 1)).join("")}
        ${adField("Prompt (Seedance)", s.prompt, 'data-ask="prompt"', 3, true)}
        <button class="btn sm" type="button" data-copy-prompt="${i}">📋 انسخ البرومبت</button></div></article>`).join("")}</div>
    <div class="ad-fields">${["voiceover_script", "music_direction", "sound_design", "cast", "locations", "production_notes", "cta", "caption"]
      .map((k) => adField(ADAPT_LABELS[k], ad[k], `data-ad-key="${k}"`, k === "voiceover_script" || k === "production_notes" ? 4 : 2)).join("")}</div>`;
}

function renderAdSettings() {
  const a = adx.cur, st = a.settings || {};
  for (const el of document.querySelectorAll("[data-set]")) if (document.activeElement !== el) el.value = st[el.dataset.set] ?? "";
  $("adStylePick").innerHTML = `<button type="button" class="ad-style-card ${!st.style_id ? "sel" : ""}" data-pick-style=""><span class="ph">∅</span><b>من غير ستايل</b></button>` +
    adx.styles.map((s) => `<button type="button" class="ad-style-card ${s.id === st.style_id ? "sel" : ""}" data-pick-style="${s.id}">
      ${s.images[0] ? `<img src="${s.images[0]}" alt="">` : `<span class="ph">🎨</span>`}<b data-no-i18n>${adEsc(s.name)}</b></button>`).join("");
  $("adReanalyze").disabled = a.status === "working" || a.status === "queued";
  $("adReadapt").disabled = a.adapt_status === "working" || !a.analysis;
}

function renderStyleLib() {
  if ($("adStyleGrid").contains(document.activeElement)) return;
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
$("adFile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  const form = new FormData();
  form.append("file", f);
  try {
    toast(`⏳ بيرفع ${f.name}...`);
    const a = await api("/api/ads", { method: "POST", body: form });
    adx.list = await api("/api/ads");
    adx.cur = a;
    adx.tab = "analysis";
    adx.view = "ad";
    storageSet(AD_KEY, a.id);
    renderAds();
    toast("✅ اترفع. التحليل بدأ وبعده الاقتراح لكوتشي");
  } catch (err) { toast(err.message, true); }
});
$("adTabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-t]");
  if (!b) return;
  adx.tab = b.dataset.t;
  renderAds();
});
$("adName").addEventListener("change", () => patchAd({ name: $("adName").value }).then(async () => { adx.list = await api("/api/ads"); renderAds(); }));

async function patchAd(body) {
  try { adx.cur = await api(`/api/ads/${adx.cur.id}`, { method: "PATCH", ...jsonBody(body) }); }
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
      ...(ad.scenes || []).map((s, i) => [`— المشهد ${s.n ?? i + 1} (${s.seconds}ث)`, ...Object.entries(ADAPT_SCENE_LABELS).map(([k, l]) => `${l}: ${s[k] || ""}`), `Prompt: ${s.prompt || ""}`].join("\n")), "",
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
  if (!confirm("تحلل الإعلان من الأول؟ التعديلات اللي عملتها على التحليل هتتمسح، والاقتراح هيتكتب من جديد.")) return;
  busyButton($("adReanalyze"), "⏳", async () => {
    adx.cur = await api(`/api/ads/${adx.cur.id}/analyze`, { method: "POST" });
    adx.tab = "analysis";
    renderAds();
  });
}
$("adReanalyze").onclick = reanalyze;
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
  const busy = (a && (["queued", "working"].includes(a.status) || a.adapt_status === "working")) || adx.styles.some((s) => s.status === "working");
  if (!busy || document.querySelector('.view[data-view="10"]').hidden) return;
  adx.timer = setTimeout(async () => {
    try {
      if (adx.styles.some((s) => s.status === "working")) adx.styles = await api("/api/ad-styles");
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
