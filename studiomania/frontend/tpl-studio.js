// StudioMania — 🎬 قسم القوالب
// العميل بيختار قالب من المعرض ← يكتب السكريبت أو الموديل يكتبه ← الفويس أوفر بيحدد مدة كل لقطة ← ستوري بورد بنفس الستايل
// ← تقطيع وتوضيح ← لقطات متصلة (كل لقطة من آخر فريم في اللي قبلها) ← المونتاج بالترانزيشن اللي على روح القالب.
// تفاصيل الفيديو نفسه بتترسم بنفس شاشة «📐 فيديو من تيمبليت» (templates.js) جوه القسم ده.

const tsx = { data: null, pick: null, timer: null };
const TS_TRANS = { cut: "قطع مباشر", fade: "تلاشي", fadeblack: "سواد", fadewhite: "فلاش أبيض", dissolve: "ذوبان", wipeleft: "مسحة", slideleft: "زحلقة",
  smoothleft: "زحلقة ناعمة", circleopen: "دائرة", zoomin: "زووم", pixelize: "بكسلات/غليتش", hblur: "ضباب", radial: "عقارب", squeezeh: "عصرة", diagtl: "مايلة", slideup: "لفوق" };
const tse = (s) => escapeHtml(String(s ?? ""));

viewHooks["14"] = tsInit;

function tsHostTpl() {   // لوحة تفاصيل الفيديو (من templates.js) تُنقل داخل هذا القسم
  const box = $("labTpl");
  if (box.parentElement !== $("tsHost")) $("tsHost").appendChild(box);
  tplx.host = "studio";
}
function tsReturnTpl() {
  const box = $("labTpl"), home = $("labTplHome");
  if (home && box.parentElement !== home.parentElement) home.after(box);
  tplx.host = null;
  $("tsGallery").hidden = false;
}

async function tsInit() {
  tsHostTpl();
  try { tsx.data = await api("/api/tpl-studio"); } catch (err) { return toast(err.message, true); }
  if (!tplx.cur || tplx.cur.section !== "templates") { tplx.cur = null; tsHome(); }
  else { $("tsGallery").hidden = true; renderTpl(); scheduleTplPoll(); }
  tsPoll();
}

function tsHome() {
  tplx.cur = null;
  $("labTpl").hidden = true;
  $("labTpl").innerHTML = "";
  $("tsGallery").hidden = false;
  const D = tsx.data;
  if (!D) return;
  const card = (t) => {
    const busy = t.sample_status === "working";
    return `<article class="ts-card ${tsx.pick === t.id ? "on" : ""}" data-tspick="${t.id}">
      <div class="ts-media">${t.sample_url ? `<video src="${t.sample_url}" muted loop playsinline autoplay preload="metadata"></video>`
        : t.cover_url ? `<img src="${t.cover_url}" alt="">` : `<span class="ts-ph">${tse(t.icon || "🎬")}</span>`}
        ${busy ? `<span class="ts-badge"><span class="spin-inline"></span> ${tse(t.sample_step || "جارٍ صنع العينة")}</span>` : ""}</div>
      <div class="ts-info"><b data-no-i18n>${tse(t.icon || "")} ${tse(t.name)}</b>
        ${t.uses ? `<small class="muted">مناسب لـ: ${tse(t.uses)}</small>` : ""}
        <small class="muted">${t.mode === "still" ? "📦 صور ثابتة · صورة المنتج هي المرجع" : t.mode === "ad" ? "🎯 شخصية ثابتة · صورة المنتج · نص ← فيديو بالمراجع" : "🎬 مشاهد من ١٠ ثوانٍ · مفتاح أسلوب · صوت المؤثرات"}</small>
        ${t.sample_error ? `<small class="err">⚠️ ${tse(t.sample_error)}</small>` : ""}
        <div class="row wrap"><button class="btn sm primary" data-tsuse="${t.id}">✨ استخدم القالب</button>
          ${t.mode === "ad" || t.mode === "still" ? "" : !t.sample_url || t.sample_status === "failed" || t.sample_old ? `<button class="btn sm" data-tssample="${t.id}" ${busy ? "disabled" : ""}>🎞️ أنشئ عينة (~$${t.sample_cost})</button>`
            : `<button class="btn sm" data-tssample="${t.id}" ${busy ? "disabled" : ""} title="عينة جديدة">↻</button>`}</div></div></article>`;
  };
  const t = D.templates.find((x) => x.id === tsx.pick);
  const opt = (g) => Object.entries(D.dialects).filter(([, v]) => v.group === g).map(([k, v]) => `<option value="${k}" ${k === D.brand_lang ? "selected" : ""}>${tse(v.label)}</option>`).join("");
  $("tsGallery").innerHTML = `
    <section class="panel"><div class="car-head"><h2>القوالب</h2><small class="muted">اختر أسلوبًا، واكتب فكرتك، والباقي علينا: نص ← تعليق صوتي ← لوحة القصة ← فيديو متصل ← مونتاج</small></div>
      <div class="ts-grid">${D.templates.map(card).join("")}</div></section>
    ${t ? `<section class="panel ts-new" id="tsNew"><h3>${tse(t.icon || "")} فيديو جديد على «${tse(t.name)}»</h3>
      <label>الفيديو عن ماذا؟ <textarea id="tsBrief" rows="2" placeholder="${tse(t.sample_brief || "مثلًا: أهم ٣ مميزات في التطبيق والختام: جرّبه اليوم")}"></textarea></label>
      <div class="ts-mode"><label class="check"><input type="radio" name="tsMode" value="ai" checked> ✍️ الذكاء الاصطناعي يكتب النص بطول القالب</label>
        <label class="check"><input type="radio" name="tsMode" value="own"> 📝 سأكتبه بنفسي</label></div>
      <textarea id="tsScript" rows="4" placeholder="اكتب النص هنا، وسيوزّعه البرنامج على لقطات القالب دون تغيير كلامك" hidden></textarea>
      <div class="row wrap">
        <label>🗣️ اللغة / اللهجة <select id="tsLang"><optgroup label="لهجات عربية">${opt("ar")}</optgroup><optgroup label="لغات أجنبية">${opt("foreign")}</optgroup></select></label>
        <label>🎙️ الصوت <select id="tsVoice"></select></label>
        <label class="check"><input type="checkbox" id="tsVoiceOn" checked> تعليق صوتي (يحدد مدة كل لقطة)</label>
      </div>
      ${t.mode === "still" ? `<small class="muted">📦 صور فقط (بدون فيديو). ارفع صورة المنتج داخل، وكل صورة توريك تمنها قبل ما تُرسم.</small>` : t.mode === "ad" ? `<small class="muted">${t.ad_cfg?.kind === "ugc" ? "📱 ١٥ ثانية: الشخصية تتكلم بصوتها داخل الفيديو." : "🎬 الطول وعدد اللقطات تختارهم داخل."} الخطوات: الشخصية ← صورة المنتج ← النص ← التوليد.</small>` : `
      <div class="row wrap"><label>⏱️ الطول <select id="tsLen">${[30, 60, 90, 120].map((x) => `<option value="${x}" ${x === 60 ? "selected" : ""}>${x} ثانية (${x / 10} مشاهد)</option>`).join("")}</select></label>
        <small class="muted">كل مشهد ١٠ ثوانٍ وله جملة تعليق صوتي. اكتب في الفكرة الأرقام التي تريدها في الفيديو (البرنامج لا يخترع أرقامًا).</small></div>`}
      <div class="row wrap">
        <label>المقاس <select id="tsRatio">${Object.entries(TV_RATIOS).map(([k, l]) => `<option value="${k}" ${k === (t.ratio || "9:16") ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>نموذج الصور <select id="tsImg"><option value="sunburst">GPT Image 2.5 (مثل ChatGPT)</option><option value="nano2">Nano Banana 2 (أرخص)</option><option value="nanopro">Nano Banana Pro</option></select></label>
        <label>النص على الشاشة <select id="tsText"><option value="blank">مساحات فارغة (النص في المونتاج)</option><option value="en">إنجليزي داخل الصور</option></select></label>
      </div>
      ${!D.fasih ? `<small class="err">اللهجات العربية غير متاحة الآن، أطفئ التعليق الصوتي أو اختر لغة أخرى.</small>` : ""}
      <div class="row wrap"><button class="btn primary" id="tsGo">🚀 ابدأ</button><small class="muted">الحركة بـ Seedance 2.0 Mini (الأرخص) ويمكنك اختيار أي نموذج آخر بالداخل، وكل خطوة تعرض سعرها قبل أن تبدأ</small></div>
    </section>` : ""}
    ${D.videos.length ? `<section class="panel"><h3>فيديوهاتك من القوالب</h3><div class="fm-list">${D.videos.map((v) => `<article class="fm-card" data-tsopen="${v.id}">
      ${v.thumb ? `<img src="${v.thumb}" alt="">` : `<span class="ph">🎬</span>`}<b data-no-i18n>${tse(v.name)}</b>
      <small class="muted">${tse(v.template_name)} · ${TV_ST[v.status] || ""}</small></article>`).join("")}</div></section>` : ""}`;
  if (t) tsVoices();
}

function tsVoices() {
  const D = tsx.data, lang = $("tsLang")?.value, sel = $("tsVoice");
  if (!sel || !lang) return;
  sel.innerHTML = D.dialects[lang].voices.map((v) => `<option value="${v}">${tse(D.voices[v])}</option>`).join("");
}

async function tsOpenVideo(id) {
  tsHostTpl();
  $("tsGallery").hidden = true;
  try {
    tplx.cur = await api(`/api/tvideos/${id}`);
    if (!tplx.list?.length) tplx.list = await api("/api/templates");
  } catch (err) { toast(err.message, true); return tsHome(); }
  renderTpl();
  scheduleTplPoll();
}

function tsPoll() {
  clearTimeout(tsx.timer);
  if (!tsx.data?.templates.some((t) => t.sample_status === "working")) return;
  tsx.timer = setTimeout(async () => {
    if (document.querySelector('.view[data-view="14"]').hidden) return;
    try {
      const was = tsx.data.templates.filter((t) => t.sample_status === "working").map((t) => t.id);
      tsx.data = await api("/api/tpl-studio");
      for (const id of was) {
        const t = tsx.data.templates.find((x) => x.id === id);
        if (t && t.sample_status !== "working") toast(t.sample_status === "done" ? `🎞️ عينة «${t.name}» جاهزة` : `⚠️ عينة «${t.name}»: ${t.sample_error || "فشلت"}`, t.sample_status !== "done");
      }
      if (!tplx.cur && !$("tsGallery").hidden && !$("tsGallery").contains(document.activeElement)) morphing(tsHome);
    } catch { /* الخادم يعيد التشغيل */ }
    tsPoll();
  }, 4000);
}

$("tsGallery").addEventListener("click", async (e) => {
  const b = e.target.closest("button, [data-tspick], [data-tsopen]");
  if (!b) return;
  if (b.dataset.tssample) {
    const t = tsx.data.templates.find((x) => x.id === b.dataset.tssample);
    if (!(await uiConfirm(`تعمل عينة لـ «${t.name}»؟ نحو $${t.sample_cost} (ستوري بورد GPT Image + لقطات Seedance Mini 480p بدون صوت)`))) return;
    try { await api(`/api/templates/${t.id}/sample`, { method: "POST" }); tsx.data = await api("/api/tpl-studio"); tsHome(); tsPoll(); toast("🎞️ جارٍ صنع العينة… دقائق"); }
    catch (err) { toast(err.message, true); }
    return;
  }
  if (b.dataset.tsuse) { tsx.pick = b.dataset.tsuse; tsHome(); $("tsNew")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (b.dataset.tsopen) return tsOpenVideo(b.dataset.tsopen);
  if (b.id === "tsGo") {
    const mode = document.querySelector('input[name="tsMode"]:checked').value;
    const brief = $("tsBrief").value.trim(), script = $("tsScript").value.trim();
    const still = tsx.data.templates.find((x) => x.id === tsx.pick)?.mode === "still";
    if (mode === "ai" && !brief && !still) { toast("اكتب موضوع الفيديو أولًا", true); return; }
    if (mode === "own" && !script) { toast("اكتب النص أولًا", true); return; }
    return busyButton(b, "⏳", async () => {
      tplx.user = {};
      const v = await api("/api/tvideos", { method: "POST", ...jsonBody({ template: tsx.pick, section: "templates", brief: brief || script.slice(0, 300),
        script, script_mode: mode, lang: $("tsLang").value, voice: $("tsVoice").value, voice_on: $("tsVoiceOn").checked,
        ratio: $("tsRatio").value, image_model: $("tsImg").value, text_mode: $("tsText").value,
        model: tsx.data.templates.find((x) => x.id === tsx.pick)?.mode === "ad" ? "seedance-fast" : "seedance-mini", resolution: "480p",
        length: Number($("tsLen")?.value || 60) }) });
      tsx.pick = null;
      tsx.data = await api("/api/tpl-studio");
      tsOpenVideo(v.id);
      if (tplx.cur?.mode !== "ad") toast("✍️ جارٍ كتابة النص وتسجيل التعليق الصوتي…");
    });
  }
  if (b.dataset.tspick && !e.target.closest("button")) { tsx.pick = b.dataset.tspick; tsHome(); }
});
$("tsGallery").addEventListener("change", (e) => {
  if (e.target.id === "tsLang") tsVoices();
  if (e.target.name === "tsMode") $("tsScript").hidden = e.target.value !== "own";
});

// ---------- 🎙️ الفويس أوفر جوه تفاصيل الفيديو (قسم القوالب بس)
function tvVoiceBlock(v) {
  const D = tsx.data, vo = v.vo || {}, lines = vo.lines || v.script_lines || [], beats = v.schema.beats, busy = v.busy;
  const langs = D ? Object.entries(D.dialects).map(([k, d]) => `<option value="${k}" ${k === v.lang ? "selected" : ""}>${tse(d.label)}</option>`).join("") : "";
  const voices = D && D.dialects[v.lang] ? D.dialects[v.lang].voices.map((x) => `<option value="${x}" ${x === v.voice ? "selected" : ""}>${tse(D.voices[x])}</option>`).join("") : "";
  return `<details class="panel tv-step" data-dk="s0" ${(tplx.user?.s0 ?? !v.panel_files.some((p) => p.cell)) ? "open" : ""}>
    <summary>🎙️ النص والتعليق الصوتي <small class="muted">الصوت يحدد مدة كل لقطة</small></summary>
    ${v.vo_url ? `<audio src="${v.vo_url}" controls preload="metadata" class="ts-vo"></audio>` : ""}
    <div class="row wrap"><label>🗣️ اللغة <select data-vo="lang" ${busy ? "disabled" : ""}>${langs}</select></label>
      <label>🎙️ الصوت <select data-vo="voice" ${busy ? "disabled" : ""}>${voices}</select></label>
      <label class="check"><input type="checkbox" data-vo="on" ${v.voice_on !== false ? "checked" : ""} ${busy ? "disabled" : ""}> تعليق صوتي</label></div>
    <div class="ts-lines">${beats.map((b, i) => `<div class="ts-line"><span class="muted">${i + 1} · ${(b.t1 - b.t0).toFixed(1)}ث${vo.durs?.[i] ? ` (النص ${vo.durs[i]}ث)` : ""}</span>
      <textarea data-voline="${i}" rows="2" dir="auto" ${busy ? "disabled" : ""}>${tse(lines[i] || "")}</textarea>
      ${v.vo_line_urls?.[i] ? `<audio src="${v.vo_line_urls[i]}" controls preload="metadata"></audio>` : ""}</div>`).join("")}</div>
    ${lines.some((x) => x) && typeof BrainRate !== "undefined" ? BrainRate.html({ kind: "script", what: v.title || v.name || "نص", ref: `tv:${v.id}:${lines.join("|").length}`, text: lines.filter(Boolean).join("\n") }) : ""}
    <button class="btn sm primary" data-vosave ${busy ? "disabled" : ""}>🎙️ سجّل تعليقًا صوتيًا آخر (وتُضبط المدد)</button>
    <small class="muted">إن تغيّرت المدد فستُنشأ اللقطات المولّدة سابقًا من جديد.</small>
  </details>`;
}

$("labTpl").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-vosave]");
  if (!b || !tplx.cur) return;
  const box = $("labTpl");
  const lines = [...box.querySelectorAll("[data-voline]")].map((x) => x.value);
  const body = { lines, lang: box.querySelector('[data-vo="lang"]').value, voice: box.querySelector('[data-vo="voice"]').value,
    voice_on: box.querySelector('[data-vo="on"]').checked };
  busyButton(b, "⏳", async () => {
    tplx.cur = await api(`/api/tvideos/${tplx.cur.id}/voice`, { method: "POST", ...jsonBody(body) });
    renderTpl(); scheduleTplPoll();
  });
});
$("labTpl").addEventListener("change", (e) => {
  if (e.target.dataset.vo !== "lang" || !tsx.data) return;
  const sel = $("labTpl").querySelector('[data-vo="voice"]');
  sel.innerHTML = tsx.data.dialects[e.target.value].voices.map((x) => `<option value="${x}">${tse(tsx.data.voices[x])}</option>`).join("");
});

// ---------- 🎬 قوالب المشاهد (Vox): مفتاح الستايل + مشهد مشهد
function tvScenesBlock(v) {
  const cfg = v.scene_cfg || {}, busy = v.busy, sc = v.scenes || [], miss = v.scene_urls.filter((x) => !x).length;
  return `<details class="panel tv-step" data-dk="k1" ${(tplx.user?.k1 ?? !v.stylekey_url) ? "open" : ""}><summary>🎨 مفتاح الأسلوب <small class="muted">صورة واحدة تثبّت شكل الفيديو كله وتُرسل مع كل مشهد</small></summary>
      <div class="sc-chips">${(cfg.variants || []).map(([k, l]) => `<button class="sc-chip ${k === (v.style_variant || "classic") ? "on" : ""}" data-skvar="${k}" ${busy ? "disabled" : ""}>${tse(l)}</button>`).join("")}</div>
      <div class="ts-key">${v.stylekey_url ? `<img src="${v.stylekey_url}" alt="">` : ""}
        <button class="btn sm primary" data-skgo ${busy || !sc.length ? "disabled" : ""}>${v.stylekey_url ? "↻ ارسمه مرة أخرى" : "🎨 ارسم مفتاح الأسلوب"} (~$0.10)</button></div>
    </details>
    <details class="panel tv-step" data-dk="k2" ${(tplx.user?.k2 ?? !!v.stylekey_url) ? "open" : ""}><summary>🎬 المشاهد <small class="muted">${sc.length - miss}/${sc.length} وُلّد · كل مشهد ١٠ ثوانٍ بأصوات مؤثراته</small></summary>
      ${v.through_line ? `<p class="hint">🧵 العنصر الذي يتكرر في كل المشاهد: <span dir="ltr" data-no-i18n>${tse(v.through_line)}</span></p>` : ""}
      <div class="row wrap"><button class="btn primary" data-scgo ${busy || !v.stylekey_url ? "disabled" : ""}>${miss ? `🎬 ولّد ${miss === sc.length ? "كل المشاهد" : `الناقص (${miss})`} (~$${(miss * v.scene_cost).toFixed(2)})` : "🎞️ جمّع الفيديو مرة أخرى (مجانًا)"}</button>
        ${!v.stylekey_url ? `<small class="muted">ارسم مفتاح الأسلوب أولًا</small>` : ""}</div>
      <div class="ts-scenes">${sc.map((s, i) => `<article class="ts-scene" data-sci="${i}"><header><b>مشهد ${i + 1}</b> <small dir="auto">«${tse((v.vo?.lines || v.script_lines || [])[i] || "")}»</small></header>
        <div class="ts-sbody">${v.scene_urls[i] ? `<video src="${v.scene_urls[i]}" controls playsinline preload="metadata"></video>` : `<div class="fm-ph">ما زال</div>`}
          <div class="ts-sf"><label>🖼️ المشهد <textarea rows="3" dir="ltr" data-scf="scene" data-no-i18n ${busy ? "disabled" : ""}>${tse(s.scene)}</textarea></label>
            <label>🎥 الحركة <textarea rows="2" dir="ltr" data-scf="motion" data-no-i18n ${busy ? "disabled" : ""}>${tse(s.motion)}</textarea></label>
            <label>🔊 المؤثرات <input dir="ltr" data-scf="audio" value="${tse(s.audio)}" data-no-i18n ${busy ? "disabled" : ""}></label>
            ${cfg.allow_label ? `<label>🏷️ الكلمة المطبوعة <input dir="ltr" data-scf="label" value="${tse(s.label)}" maxlength="24" ${busy ? "disabled" : ""}></label>` : ""}
            <button class="btn sm" data-scone="${i}" ${busy || !v.stylekey_url ? "disabled" : ""}>${v.scene_urls[i] ? "↻ ولّده مرة أخرى" : "🎬 ولّده"} (~$${v.scene_cost})</button></div></div>
      </article>`).join("")}</div>
    </details>`;
}

$("labTpl").addEventListener("click", (e) => {
  const b = e.target.closest("[data-skvar], [data-skgo], [data-scgo], [data-scone]");
  if (!b || !tplx.cur) return;
  const V = (path, body) => api(`/api/tvideos/${tplx.cur.id}${path}`, { method: "POST", ...jsonBody(body || {}) });
  if (b.dataset.skvar) { tplx.cur.style_variant = b.dataset.skvar; renderTpl(); return; }
  const run = (fn) => busyButton(b, "⏳", async () => { tplx.cur = await fn(); renderTpl(); scheduleTplPoll(); });
  if (b.hasAttribute("data-skgo")) return run(() => V("/stylekey", { variant: tplx.cur.style_variant || "classic" }));
  if (b.hasAttribute("data-scgo")) return run(() => V("/scenes/run", {}));
  if (b.dataset.scone) return run(() => V("/scenes/run", { i: Number(b.dataset.scone) }));
});
$("labTpl").addEventListener("change", async (e) => {
  const f = e.target.dataset.scf;
  if (!f || !tplx.cur) return;
  const i = e.target.closest("[data-sci]").dataset.sci;
  try { tplx.cur = await api(`/api/tvideos/${tplx.cur.id}/scenes/${i}`, { method: "PUT", ...jsonBody({ [f]: e.target.value }) }); toast("✅ حُفظ"); }
  catch (err) { toast(err.message, true); }
});
