// StudioMania — 🎯 قوالب الإعلانات (UGC ريفيو / إعلان سينمائي) جوه قسم القوالب
// الشخصية (وش ← جسم كامل بنفس الوش) ← صورة المنتج ← السكريبت واللقطات ← التوليد (Seedance بالمراجع) ← التجميع (والكارت الأخير بخطوطنا)

const AD_SLOTS = { head: "👤 الوجه", body: "🧍 الجسم كامل", product: "📦 المنتج", place: "🏙️ المكان", plate: "🎨 الشخصية" };
const AD_LINE = { skeleton: "🎙️ الراوي يقول", talking: "🗣️ الشخصية تقول", song: "🎵 السطور الذي تتغنى" };
const UGC_BEATS = ["٠–٣ث · الافتتاحية", "٣–٧ث · وهي تستخدمه", "٧–١١ث · النتيجة", "١١–١٥ث · الحكم"];

function tvAdDetail(v) {
  const a = v.ad || {}, busy = v.busy, plan = a.plan, ugc = a.kind === "ugc", hero = a.hero || {}, R = v.ref_urls || {};
  const open = (k, def) => ((tplx.user?.[k] ?? def) ? "open" : "");
  const dis = busy ? "disabled" : "";
  const D = tsx.data;
  const langs = D ? Object.entries(D.dialects).map(([k, d]) => `<option value="${k}" ${k === v.lang ? "selected" : ""}>${tse(d.label)}</option>`).join("") : "";
  const voices = D && D.dialects[v.lang] ? D.dialects[v.lang].voices.map((x) => `<option value="${x}" ${x === v.voice ? "selected" : ""}>${tse(D.voices[x])}</option>`).join("") : "";
  const slot = (k) => `<figure class="ad-ref">${R[k] ? `<img src="${R[k]}" alt="">` : `<div class="fm-ph">${AD_SLOTS[k]}</div>`}
      <figcaption>${AD_SLOTS[k]} <label class="btn sm">⬆ ارفع<input type="file" accept="image/*" data-adup="${k}" hidden ${dis}></label></figcaption></figure>`;
  const missing = (v.jobs || []).filter((j) => !j.url), cost = missing.reduce((s, j) => s + j.cost, 0);
  const plateK = !!v.plate_kind, kind = a.kind;
  const hasHero = plateK ? !!R.plate : !!R.head, hasProd = !!R.product, needProd = ["ugc", "cinema", "talking"].includes(kind);
  const looks = `<div class="sc-chips">${Object.entries(v.looks || {}).map(([k, l]) => `<button class="sc-chip ${k === a.look ? "on" : ""}" data-adlook="${k}" ${dis}>${tse(l)}</button>`).join("")}</div>`;
  return `<div class="car-head"><button type="button" class="btn sm" data-tvback>→ كل الفيديوهات</button>
      <input class="ad-title" data-tvname value="${le(v.name)}" data-no-i18n>
      <div class="row wrap">${v.final_url ? `<button type="button" class="btn sm primary" data-tveditor ${dis}>🎞️ انقل للمونتاج</button>
        <a class="btn sm" href="${v.final_url}" download="${le(v.name)}.mp4">⬇️ نزّل</a>` : ""}
        <button type="button" class="btn sm danger" data-tvdel ${dis}>🗑️</button></div></div>
    <div class="fm-status"><span class="lab-st ${busy ? "working" : v.status}">${busy ? `<span class="spin-inline"></span>` : ""} ${TV_ST[v.status] || ""}</span>
      ${v.step ? `<small class="muted">${le(v.step)}</small>` : ""}${v.error ? `<small class="err">${le(v.error)}</small>` : ""}
      <small class="muted">📐 <span data-no-i18n>${le(v.template_name)}</span> · ${ugc ? "١٥ ثانية بتوليدة واحدة" : `${v.total} ث · ${(plan?.shots || []).length} لقطة`}</small></div>
    ${v.final_url ? `<section class="panel fm-final"><video src="${v.final_url}" controls playsinline preload="metadata"></video></section>` : ""}

    ${plateK ? `<details class="panel tv-step" data-dk="a1" ${open("a1", !hasHero)}><summary>١. 🎨 الشخصية والأسلوب <small class="muted">صورة واحدة للشخصية تُرسل مع كل توليدة لكي تظل هي هي</small></summary>
      <label>${kind === "skeleton" ? "💀 شكل الهيكل" : "🎨 أسلوب الأنيميشن"} ${looks}</label>
      <label>${kind === "skeleton" ? "الموضوع / العالم (اختياري)" : "الشخصية (اختياري)"} <textarea rows="2" data-adhero placeholder="${kind === "skeleton" ? "مثلًا: مدينة صغيرة في الأربعينات" : kind === "talking" ? "مثلًا: المنتج نفسه بعيون وبق، أو حبة قهوة صغيرة دمها خفيف" : "مثلًا: بنت كرتون تغني على مسرح نيون"}" ${dis}>${tse(hero.desc || "")}</textarea></label>
      ${kind === "talking" && !hasProd ? `<p class="hint">💡 تريد المنتج نفسه هو ما يتكلم؟ ارفع صورته في خطوة ٢ أولًا.</p>` : ""}
      ${hero.summary_ar ? `<p class="hint">🪪 ${tse(hero.summary_ar)}${hero.theme ? ` · 🌍 <span dir="ltr" data-no-i18n>${tse(hero.theme)}</span>` : ""}</p>` : ""}
      <button class="btn sm primary" data-adherogo ${dis}>${hasHero ? "↻ ارسم الشخصية مرة أخرى" : "🎨 ارسم الشخصية"} (~$${v.plate_cost})</button>
      <div class="ad-refs">${slot("plate")}</div>
    </details>` : `
    <details class="panel tv-step" data-dk="a1" ${open("a1", !hasHero)}><summary>١. 👤 الشخصية <small class="muted">تُنشأ مرة واحدة وتُرسل مع كل توليدة لكي تظل هي هي</small></summary>
      <label>صِفها في كلمتين (أو اتركها فارغة والبرنامج يختار) <textarea rows="2" data-adhero placeholder="مثلًا: بنت محجبة دمها خفيف، طرحة بيج وجاكيت جينز" ${dis}>${tse(hero.desc || "")}</textarea></label>
      ${hero.summary_ar ? `<p class="hint">🪪 ${tse(hero.summary_ar)} · <span dir="ltr" data-no-i18n>${tse(hero.handle || "")}</span></p>` : ""}
      <div class="row wrap"><button class="btn sm primary" data-adherogo ${dis}>${hasHero ? "↻ أنشئ الشخصية من جديد" : "👤 أنشئ الشخصية"} (~$${v.hero_cost})</button>
        ${hasHero ? `<button class="btn sm" data-adheroone="head" ${dis}>↻ الوجه فقط</button><button class="btn sm" data-adheroone="body" ${dis}>↻ الجسم فقط (بنفس الوجه)</button>` : ""}</div>
      <div class="ad-refs">${slot("head")}${slot("body")}</div>
      <small class="muted">لديك صور شخصية أُنشئت من قبل؟ ارفعها في الخانتين بدل ما تعمل جديدة.${ugc ? "" : " الإعلان السينمائي يمكن يصبح بدون شخصية (إيدين ومنتج فقط)."}</small>
    </details>`}

    <details class="panel tv-step" data-dk="a2" ${open("a2", (hasHero || !ugc) && !plan)}><summary>٢. 📦 المنتج ${plateK ? (needProd ? "" : "(اختياري)") : ugc ? "والمكان" : "والمكان والشكل"}</summary>
      <div class="row wrap"><label>اسم المنتج <input data-adset="product_name" value="${tse(a.product?.name || "")}" placeholder="GlowDrop" ${dis}></label>
        <label>نوعه <input data-adset="product_kind" value="${tse(a.product?.kind || "")}" placeholder="سيروم للوش" ${dis}></label></div>
      <div class="ad-refs">${slot("product")}${ugc || plateK ? "" : slot("place")}</div>
      <small class="muted">صورة واحدة نضيفة للمنتج (من أمام، مالية الكادر، خلفية بسيطة). الصورة هي المرجع: البرومت عمره ما يوصف شكل المنتج بالكلام.</small>
      ${plateK ? "" : `<label>📍 المكان ${ugc ? `<div class="sc-chips">${Object.entries(v.places || {}).map(([k, l]) => `<button class="sc-chip ${a.place === l ? "on" : ""}" data-adplace="${tse(l)}" ${dis}>${tse(l)}</button>`).join("")}</div>` : ""}
        <input data-adset="place" value="${tse(a.place || "")}" placeholder="${ugc ? "أو اكتب مكان آخر" : "مثلًا: شارع هادي الفجر بعد المطر"}" ${dis}></label>
      ${ugc ? "" : `<div class="row wrap"><button class="btn sm" data-adplacego ${dis || !a.place ? "disabled" : ""}>🏙️ ارسم صورة المكان (~$${v.plate_cost})</button>
          <small class="muted">اختياري: صورة للمكان بدون أشخاص تُرسل مع اللقطات لكي المكان يظل هو هو.</small></div>
        <label>🎥 شكل الصورة ${looks}</label>`}`}
    </details>

    <details class="panel tv-step" data-dk="a3" ${open("a3", hasProd && !!a.product?.name && !plan)}><summary>٣. ✍️ النص ${ugc ? "(٤ جمل في ١٥ ثانية)" : "واللقطات"}</summary>
      <label>${ugc || plateK ? "سكريبتك أو فكرتك (اختياري: إذا فارغ البرنامج يكتبه من الفكرة)" : "الإعلان بكلامك (ما يحدث، من فيه، وتريد المشاهد يحس بإيه في الآخر)"}
        <textarea rows="3" data-adset="script" placeholder="${kind === "skeleton" ? "مثلًا: ماذا الذي يحدث إذا مشيت ١٠ آلاف خطوة كل يوم؟" : kind === "talking" ? "مثلًا: الكريم يعرّف نفسه: أنا مصنوع من دهن طبيعي، بقفل الشقوق، فبشرة البيبي تظل ناعمة" : kind === "song" ? "مثلًا: أغنية بوب خفيفة عن أن هذا الشاي يصحّيك بدون ما يتعبك" : ugc ? "مثلًا: بصي أنا لقيت هذا السيروم… ريحته جميلة ومش لزج… بشرتي بقت أنور في أسبوعين… انتهى بقى روتيني" : "مثلًا: واحدة تجري الصبح، تتعب أعلى التل، تُخرج الإزازة وتشرب وتُكمل أسرع"}" ${dis}>${tse(a.script || "")}</textarea></label>
      <div class="row wrap"><label>🗣️ اللغة <select data-adset="lang" ${dis}>${langs}</select></label>
        ${kind === "skeleton" ? `<label>🎙️ الراوي <select data-adset="voice" ${dis}>${voices}</select></label>
          <small class="muted">الراوي يُسجّل أولًا، وكل لقطة تأخذ طول جملتها بالضبط.</small>` : ""}
        ${ugc || plateK ? "" : `<label>⏱️ الطول <select data-adset="length" ${dis}>${(v.lengths || []).map((x) => `<option value="${x}" ${x === (a.length || 15) ? "selected" : ""}>${x} ثانية</option>`).join("")}</select></label>
          <label>🎙️ التعليق الصوتي <select data-adset="voice" ${dis}>${voices}</select></label>
          <label class="check"><input type="checkbox" data-adset="voice_on" ${v.voice_on !== false ? "checked" : ""} ${dis}> تعليق صوتي</label>
          <label class="check"><input type="checkbox" data-adset="end_on" ${a.end_on !== false ? "checked" : ""} ${dis}> بطاقة أخير باسم العلامة</label>`}</div>
      <button class="btn primary" data-adplan ${dis}>${plan ? "↻ اكتبه من جديد" : "✍️ اكتب النص"}</button>
      ${plan ? (ugc ? tvAdUgcBeats(v) : plateK ? tvAdBeats(v) : tvAdShots(v)) : ""}
    </details>

    ${plan ? `<details class="panel tv-step" data-dk="a4" ${open("a4", true)}><summary>٤. 🎬 التوليد <small class="muted">${(v.jobs || []).length - missing.length}/${(v.jobs || []).length} وُلّد</small></summary>
      <div class="row wrap tv-opts"><label>نموذج الحركة <select data-tvopt="model">${vmOptions(v.models.filter((m) => m.key !== "seedance-mini"), v.model, (v.jobs || []).reduce((a, j) => a + (j.secs || 0), 0) || 15, v.resolution, "للإعلان كله")}</select></label>
        <label>الجودة <select data-tvopt="resolution"><option value="480p" ${v.resolution === "480p" ? "selected" : ""}>480p</option><option value="720p" ${v.resolution === "720p" ? "selected" : ""}>720p</option></select></label>
        <label>المقاس <select data-tvopt="ratio" ${dis}>${Object.entries(TV_RATIOS).map(([k, l]) => `<option value="${k}" ${k === v.ratio ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
      ${needProd && !hasProd ? `<p class="err">ارفع صورة المنتج أولًا (خطوة ٢)</p>` : ""}${(ugc || plateK) && !hasHero ? `<p class="err">أنشئ الشخصية أولًا (خطوة ١)</p>` : ""}
      ${kind === "song" && !v.song_url ? `<p class="err">أنشئ الأغنية أولًا (خطوة ٣)</p>` : ""}
      <button class="btn primary" data-adrun ${dis || (needProd && !hasProd) || ((ugc || plateK) && !hasHero) || (kind === "song" && !v.song_url) ? "disabled" : ""}>${missing.length ? `🎬 ولّد ${missing.length === v.jobs.length ? "كله" : `الناقص (${missing.length})`} (~$${cost.toFixed(2)})` : "🎞️ جمّع آخر (مجانًا)"}</button>
      ${plateK ? `<small class="muted">اللقطات التي خلف بعض تُجمع في توليدة واحدة حتى ١٥ ثانية، والشخصية تُرسل مع كل توليدة. ${kind === "talking" ? "الشخصية تقول كلامها بصوتها." : kind === "song" ? "الأغنية توضع أسفل الفيديو كله." : "الراوي أعلى الفيديو."}</small>`
        : ugc ? `<small class="muted">الشخصية تقول النص بصوتها داخل الفيديو، والكاميرا تُنقل بين الأمامية والخلفية مثل الريفيوهات الحقيقية.</small>`
        : `<small class="muted">كل لقطة توليدة تلقائيًا (أقل شيء ٤ ثواني وتُقص على طولها)، وصوت المكان واطي أسفل التعليق الصوتي.</small>`}
      <div class="ad-jobs">${(v.jobs || []).map((j) => `<article class="ts-scene"><header><b>${tse(j.label)}</b> <small class="muted">${j.dur} ث</small></header>
        <div class="ts-sbody">${j.url ? `<video src="${j.url}" controls playsinline preload="metadata"></video>` : `<div class="fm-ph">ما زال</div>`}
          <div class="ts-sf"><details><summary class="muted">📋 البرومت</summary><textarea rows="6" dir="ltr" readonly data-no-i18n>${tse(j.prompt)}</textarea></details>
            <button class="btn sm" data-adone="${j.key}" ${dis || (needProd && !hasProd) ? "disabled" : ""}>${j.url ? "↻ ولّده مرة أخرى" : "🎬 ولّده"} (~$${j.cost})</button></div></div></article>`).join("")}</div>
    </details>` : ""}`;
}

function tvAdUgcBeats(v) {
  const p = v.ad.plan, dis = v.busy ? "disabled" : "";
  const words = p.shots.reduce((s, b) => s + (b.line || "").split(/\s+/).filter(Boolean).length, 0);
  return `<p class="hint">🗣️ ${words} كلمة (المريح في ١٥ ثانية نحو ٣٢-٣٨) · المكان: <span dir="ltr" data-no-i18n>${tse(p.world)}</span></p>
    <div class="ts-lines">${p.shots.map((b, i) => `<div class="ts-line" data-adshot="${i}"><span class="muted">${UGC_BEATS[i]}</span>
      <textarea rows="2" dir="auto" data-adf="line" ${dis}>${tse(b.line)}</textarea>
      <textarea rows="2" dir="ltr" data-adf="action" data-no-i18n title="الكاميرا والحركة (إنجليزي)" ${dis}>${tse(b.action)}</textarea></div>`).join("")}</div>`;
}

function tvAdBeats(v) {
  const a = v.ad, p = a.plan, dis = v.busy ? "disabled" : "", kind = a.kind;
  const chk = (i, k, l) => `<label class="check"><input type="checkbox" data-adwith="${k}" ${(p.shots[i].with || []).includes(k) ? "checked" : ""} ${dis}> ${l}</label>`;
  return `${p.angle ? `<p class="hint">🧭 ${tse(p.angle)}</p>` : ""}
    ${kind === "song" ? `<div class="panel ad-song"><label>🎶 الأسلوب الموسيقي (إنجليزي) <input dir="ltr" data-adsong="style" value="${tse(p.style || "")}" data-no-i18n ${dis}></label>
      <label>📝 الكلمات <textarea rows="6" dir="auto" data-adsong="lyrics" ${dis}>${tse(p.lyrics || "")}</textarea></label>
      <div class="row wrap"><button class="btn primary" data-adsonggo ${dis}>${v.song_url ? "↻ أنشئ الأغنية مرة أخرى" : "🎵 أنشئ الأغنية"} (~$${v.song_cost})</button>
        ${v.song_url ? `<audio src="${v.song_url}" controls preload="metadata"></audio><small class="muted">${a.song_dur} ث · اللقطات وُزّعت على وقتها</small>` : `<small class="muted">الأغنية تُنشأ أولًا، ثم كل لقطة تأخذ وقت سطورها.</small>`}</div></div>` : ""}
    <div class="ts-scenes">${p.shots.map((s, i) => `<article class="ts-scene" data-adshot="${i}"><header><b>${i + 1}</b>
        <label class="ad-dur"><input type="number" step="0.5" min="1.5" max="8" data-adf="dur" value="${s.dur}" ${dis}> ث</label></header>
      <div class="ts-sf"><label>${AD_LINE[kind]} <input dir="auto" data-adf="line" value="${tse(s.line)}" ${dis}></label>
        ${kind === "talking" ? `<label>🎭 نبرة الصوت <input dir="ltr" data-adf="emotion" value="${tse(s.emotion)}" data-no-i18n ${dis}></label>` : ""}
        ${kind === "song" ? `<label class="check"><input type="checkbox" data-adsing ${s.sing ? "checked" : ""} ${dis}> 🎤 البطل يغني أمام الكاميرا</label>` : ""}
        <label>🖼️ الكادر <textarea rows="3" dir="ltr" data-adf="visual" data-no-i18n ${dis}>${tse(s.visual)}</textarea></label>
        <label>🎥 الكاميرا <input dir="ltr" data-adf="camera" value="${tse(s.camera)}" data-no-i18n ${dis}></label>
        <div class="row wrap">${chk(i, "hero", "🎨 الشخصية")}${chk(i, "product", "📦 المنتج")}</div></div></article>`).join("")}</div>`;
}

function tvAdShots(v) {
  const p = v.ad.plan, dis = v.busy ? "disabled" : "", B = v.beat_names || {};
  const chk = (i, k, l) => `<label class="check"><input type="checkbox" data-adwith="${k}" ${(p.shots[i].with || []).includes(k) ? "checked" : ""} ${dis}> ${l}</label>`;
  return `<label>🌍 العالم الثابت في كل اللقطات <input dir="ltr" data-adworld value="${tse(p.world)}" data-no-i18n ${dis}></label>
    ${v.ad.end_on !== false ? `<div class="row wrap"><label>🏷️ اسم العلامة في البطاقة الأخير <input data-adset="brand" value="${tse(p.end?.brand || "")}" ${dis}></label>
      <label>الجملة <input data-adset="slogan" value="${tse(p.end?.slogan || "")}" ${dis}></label></div>` : ""}
    <div class="ts-scenes">${p.shots.map((s, i) => `<article class="ts-scene" data-adshot="${i}"><header><b>${i + 1} · ${tse(B[s.beat] || s.beat)}</b> <small dir="auto">${tse(s.what)}</small>
        <label class="ad-dur"><input type="number" step="0.5" min="1.5" max="8" data-adf="dur" value="${s.dur}" ${dis}> ث</label></header>
      <div class="ts-sf"><label>🖼️ الكادر <textarea rows="3" dir="ltr" data-adf="visual" data-no-i18n ${dis}>${tse(s.visual)}</textarea></label>
        <label>🎥 الكاميرا <input dir="ltr" data-adf="camera" value="${tse(s.camera)}" data-no-i18n ${dis}></label>
        <label>🔊 صوت المكان <input dir="ltr" data-adf="audio" value="${tse(s.audio)}" data-no-i18n ${dis}></label>
        <label>🎙️ التعليق الصوتي <input dir="auto" data-adf="line" value="${tse(s.line)}" ${dis}></label>
        <div class="row wrap">${chk(i, "hero", "👤 الشخصية")}${chk(i, "product", "📦 المنتج")}${chk(i, "place", "🏙️ المكان")}</div></div></article>`).join("")}</div>`;
}

{
  const box = $("labTpl");
  const A = (path, method, body) => api(`/api/tvideos/${tplx.cur.id}${path}`, { method, ...jsonBody(body || {}) });
  const run = (b, fn) => busyButton(b, "⏳", async () => { tplx.cur = await fn(); renderTpl(); scheduleTplPoll(); });
  const setAd = async (body) => {
    try { tplx.cur = await A("/ad", "PUT", body); renderTpl(); }
    catch (err) { toast(err.message, true); }
  };
  box.addEventListener("click", (e) => {
    if (!tplx.cur || tplx.cur.mode !== "ad") return;
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-adherogo") || b.dataset.adheroone) {
      const desc = box.querySelector("[data-adhero]")?.value || "";
      return run(b, () => A("/ad/hero", "POST", { desc, only: b.dataset.adheroone || null }));
    }
    if (b.dataset.adplace) return setAd({ place: b.dataset.adplace });
    if (b.dataset.adlook) return setAd({ look: b.dataset.adlook });
    if (b.hasAttribute("data-adplacego")) return run(b, () => A("/ad/place", "POST"));
    if (b.hasAttribute("data-adplan")) {
      const script = box.querySelector('[data-adset="script"]')?.value;
      return run(b, async () => { if (script !== undefined) await A("/ad", "PUT", { script }); return A("/ad/plan", "POST"); });
    }
    if (b.hasAttribute("data-adrun")) return run(b, () => A("/ad/run", "POST", {}));
    if (b.hasAttribute("data-adsonggo")) {
      const g = (k) => box.querySelector(`[data-adsong="${k}"]`)?.value;
      return run(b, () => A("/ad/song", "POST", { lyrics: g("lyrics"), style: g("style") }));
    }
    if (b.dataset.adone) return run(b, () => A("/ad/run", "POST", { key: b.dataset.adone }));
  });
  box.addEventListener("change", async (e) => {
    if (!tplx.cur || tplx.cur.mode !== "ad") return;
    const t = e.target;
    if (t.dataset.adup) {
      const f = t.files[0];
      if (!f) return;
      const fd = new FormData();
      fd.append("file", f);
      try { tplx.cur = await api(`/api/tvideos/${tplx.cur.id}/ad/upload/${t.dataset.adup}`, { method: "POST", body: fd }); renderTpl(); toast("✅ رُفعت"); }
      catch (err) { toast(err.message, true); }
      return;
    }
    if (t.dataset.adset) {
      const k = t.dataset.adset;
      if (k === "script") return;   // يُحفظ مع زر «اكتب النص»
      const val = t.type === "checkbox" ? t.checked : k === "length" ? Number(t.value) : t.value;
      return setAd({ [k]: val });
    }
    if (t.dataset.adsong) return;   // يُرسل مع زر «أنشئ الأغنية»
    const row = t.closest("[data-adshot]");
    if (row && t.hasAttribute("data-adsing")) {
      try { tplx.cur = await A(`/ad/shots/${row.dataset.adshot}`, "PUT", { sing: t.checked }); toast("✅ حُفظ"); } catch (err) { toast(err.message, true); }
      return;
    }
    if (t.hasAttribute("data-adworld") || (row && (t.dataset.adf || t.dataset.adwith))) {
      const i = row ? row.dataset.adshot : 0;
      let body;
      if (t.hasAttribute("data-adworld")) body = { world: t.value };
      else if (t.dataset.adwith) body = { with_: [...row.querySelectorAll("[data-adwith]")].filter((x) => x.checked).map((x) => x.dataset.adwith) };
      else body = { [t.dataset.adf]: t.dataset.adf === "dur" ? Number(t.value) : t.value };
      try { tplx.cur = await A(`/ad/shots/${i}`, "PUT", body); toast("✅ حُفظ"); if (t.dataset.adf === "dur") renderTpl(); }
      catch (err) { toast(err.message, true); }
    }
  });
}
