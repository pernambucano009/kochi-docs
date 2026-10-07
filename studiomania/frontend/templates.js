// 🗺️ مخطط الفيديو (في المعمل) و📐 فيديو من تيمبليت:
// المخطط = الثوابت + الأجزاء بخاناتها + إزاي كل جزء بيدخل في اللي بعده. الفيديو الجديد: الخانات بتتملا بمحتوى العميل ←
// شيت ستوري بورد واحد فيه كل اللوحات (عشان تطلع متسقة) ← تقطيع ← توضيح ← كل لوحتين ورا بعض = جزء (لقطة واحدة متصلة).
const tplx = { list: [], tvs: [], cur: null, timer: null, stop: null };
const TV_ST = { filling: "✍️ بيملا الخانات", filled: "📝 الخانات جاهزة", sheeting: "🖼️ بيرسم الشيت", cut: "✂️ اللوحات جاهزة",
  sharpening: "✨ بيوضّح", working: "🎬 بيولّد", done: "✅ الفيديو جاهز", failed: "✕ فشل" };
const TV_RATIOS = { "9:16": "📱 9:16 طولي (ريلز)", "16:9": "🖥️ 16:9 عرضي", "1:1": "⬛ 1:1 مربع" };
const SCH_GLOBAL = { style: "🎨 العالم والستايل", spine: "🦴 العمود الفقري (اللي ماسك العين طول الفيديو)", camera: "🎥 لغة الكاميرا",
  text_style: "🔤 شكل الكلام", palette: "🌈 الألوان", music: "🎵 الموسيقى" };
const SCH_BEAT = { what: "اللي بيحصل", layout: "🧩 التكوين والخانات", camera: "🎥 الكاميرا", into_next: "➡️ بيدخل في اللي بعده إزاي", keeps: "📌 بيفضل ثابت", sfx: "🔊 الصوت" };

// ---------- في المعمل: 🗺️ المخطط
function renderLabSchema(d) {
  const sc = d.schema, el = $("labSchema"), data = sc?.data;
  if (!sc) { el.innerHTML = ""; el.hidden = true; return; }
  el.hidden = false;
  const roles = d.schema_roles || {};
  el.innerHTML = `<details class="sch" ${tplx.schOpen === false ? "" : "open"} data-schbox><summary><b>🗺️ مخطط الفيديو</b>
      ${sc.status === "working" ? `<span class="lab-st working"><span class="spin-inline"></span> بيتفرج على الفيديو كله</span>
        <button type="button" class="btn sm" data-schstop>⏹ وقّف</button>` : ""}
      ${sc.status !== "working" && (data || sc.error) ? `<button type="button" class="btn sm danger" data-schdel title="يمسح المخطط ده (التيمبليتس اللي اتحفظت منه بتفضل)">🗑️ امسح المخطط</button>` : ""}
      ${sc.error ? `<small class="err">${le(sc.error)}</small>` : ""}
      ${data ? `<small class="muted">${data.beats.length} جزء${data.beat_sec ? ` · بيت كل ${data.beat_sec} ث` : ""}</small>` : ""}</summary>
    ${data ? `<p class="sch-sum" data-no-i18n><b>${le(data.title)}</b> — ${le(data.summary)}</p>
      <details class="sch-glob"><summary>الثوابت (اللي بيخلّي الفيديو قطعة واحدة)</summary>
        ${Object.entries(SCH_GLOBAL).map(([k, l]) => `<label>${l}<textarea rows="2" data-sg="${k}" ${k === "music" ? "" : 'dir="ltr"'} data-no-i18n>${le(data[k])}</textarea></label>`).join("")}
      </details>
      <div class="sch-beats">${data.beats.map((b, i) => `<article class="sch-beat" data-sb="${i}">
        <div class="sch-bhead">${b.thumb_url ? `<img src="${b.thumb_url}" alt="" data-schplay="${b.t0}" data-to="${b.t1}">` : ""}
          <div><b>${i + 1}</b> <select data-sbf="role">${Object.entries(roles).map(([k, l]) => `<option value="${k}" ${k === b.role ? "selected" : ""}>${l}</option>`).join("")}</select>
            <button type="button" class="btn sm" data-schplay="${b.t0}" data-to="${b.t1}">▶️ ${lt(b.t0)} ← ${lt(b.t1)}</button>
            <small class="muted">${(b.t1 - b.t0).toFixed(1)} ث</small></div></div>
        ${Object.entries(SCH_BEAT).map(([k, l]) => `<label>${l}<textarea rows="${k === "what" || k === "sfx" ? 1 : 2}" data-sbf="${k}" ${k === "what" || k === "sfx" ? "" : 'dir="ltr"'} data-no-i18n>${le(b[k])}</textarea></label>`).join("")}
      </article>`).join("")}</div>
      <div class="row wrap sch-save"><input type="text" data-schname placeholder="اسم التيمبليت" value="${le(data.title)}" data-no-i18n>
        <button type="button" class="btn primary" data-schtpl>📐 احفظه كتيمبليت</button>
        <small class="muted">التعديلات بتتحفظ لوحدها. التيمبليت بيتحفظ بصور الأجزاء ونسخة من الفيديو ده للمقارنة.</small></div>` : ""}
  </details>`;
}

function schemaFromDom() {
  const el = $("labSchema"), data = JSON.parse(JSON.stringify(labx.cur.schema.data));
  el.querySelectorAll("[data-sg]").forEach((x) => (data[x.dataset.sg] = x.value));
  el.querySelectorAll("[data-sb]").forEach((card) => {
    const b = data.beats[Number(card.dataset.sb)];
    card.querySelectorAll("[data-sbf]").forEach((x) => (b[x.dataset.sbf] = x.value));
    delete b.thumb_url;
  });
  return data;
}

function schPlay(t0, t1) {
  const v = $("labVideo");
  clearInterval(tplx.stop);
  v.currentTime = t0;
  v.play().catch(() => {});
  tplx.stop = setInterval(() => { if (v.currentTime >= t1 || v.paused) { v.pause(); clearInterval(tplx.stop); } }, 40);
  v.scrollIntoView({ behavior: "smooth", block: "center" });
}

$("labSchemaBtn").onclick = () => {
  const has = labx.cur?.schema?.data;
  if (!confirm(has ? `تطلّع مخطط «${labx.cur.name}» من جديد؟ التعديلات اللي عملتها عليه هتتبدل (التيمبليتس اللي اتحفظت مش هتتأثر).`
    : `يطلّع مخطط الفيديو المفتوح دلوقتي: «${labx.cur.name}»؟ (لو عايز فيديو تاني، اختاره من القايمة الأول)`)) return;
  busyButton($("labSchemaBtn"), "⏳", async () => {
    labx.cur = await api(`/api/lab/${labx.cur.id}/schema`, { method: "POST" });
    renderLab(); scheduleLabPoll();
  });
};

$("labSchema").addEventListener("click", async (e) => {
  const stop = e.target.closest("[data-schstop]");
  if (stop) {
    e.preventDefault();
    return busyButton(stop, "⏳", async () => {
      labx.cur = await api(`/api/lab/${labx.cur.id}/schema/stop`, { method: "POST" });
      renderLab(); toast("⏹ اتوقف");
    });
  }
  const del = e.target.closest("[data-schdel]");
  if (del) {
    e.preventDefault();
    if (!confirm(`تمسح مخطط «${labx.cur.name}»؟ (التيمبليتس اللي اتحفظت منه بتفضل)`)) return;
    return busyButton(del, "⏳", async () => {
      labx.cur = await api(`/api/lab/${labx.cur.id}/schema`, { method: "DELETE" });
      renderLab(); toast("🗑️ اتمسح");
    });
  }
  const pl = e.target.closest("[data-schplay]");
  if (pl) { e.preventDefault(); return schPlay(Number(pl.dataset.schplay), Number(pl.dataset.to)); }
  const save = e.target.closest("[data-schtpl]");
  if (save) {
    const name = $("labSchema").querySelector("[data-schname]").value.trim();
    return busyButton(save, "⏳", async () => {
      labx.cur = await api(`/api/lab/${labx.cur.id}/schema`, { method: "PATCH", ...jsonBody({ data: schemaFromDom() }) });
      await api(`/api/lab/${labx.cur.id}/schema/template`, { method: "POST", ...jsonBody({ name }) });
      toast("📐 اتحفظ كتيمبليت. تلاقيه في «📐 فيديو من تيمبليت»");
    });
  }
});
$("labSchema").addEventListener("change", async (e) => {
  if (!e.target.matches("[data-sg], [data-sbf]")) return;
  try {
    labx.cur = await api(`/api/lab/${labx.cur.id}/schema`, { method: "PATCH", ...jsonBody({ data: schemaFromDom() }) });
    toast("✅ اتحفظ");
  } catch (err) { toast(err.message, true); }
});
$("labSchema").addEventListener("toggle", (e) => { if (e.target.matches("[data-schbox]")) tplx.schOpen = e.target.open; }, true);

// ---------- 📐 فيديو من تيمبليت
async function openTpl(vid) {
  labx.view = "tpl";
  renderLab();
  [tplx.list, tplx.tvs] = await Promise.all([api("/api/templates"), api("/api/tvideos")]);
  tplx.cur = vid && tplx.tvs.some((x) => x.id === vid) ? await api(`/api/tvideos/${vid}`) : null;
  renderTpl();
  scheduleTplPoll();
}

function scheduleTplPoll() {
  clearTimeout(tplx.timer);
  if (!tplx.cur?.busy || labx.view !== "tpl") return;
  tplx.timer = setTimeout(async () => {
    try {
      tplx.cur = await api(`/api/tvideos/${tplx.cur.id}`);
      const playing = [...$("labTpl").querySelectorAll("video")].some((v) => !v.paused);
      const typing = $("labTpl").contains(document.activeElement) && document.activeElement.matches("input, select, textarea");
      if (!playing && !typing) renderTpl();
    } catch { /* السيرفر بيعيد التشغيل */ }
    scheduleTplPoll();
  }, 2500);
}

function renderTpl() {
  const box = $("labTpl");
  box.innerHTML = tplx.cur ? tvDetail(tplx.cur) : tplHome();
}

function tplHome() {
  const L = tplx.list;
  return `<div class="car-head"><h2>📐 فيديو من تيمبليت</h2></div>
    <section class="panel lab-sec">
      <h4>📐 التيمبليتس <small class="muted">(${L.length})</small></h4>
      ${L.length ? `<div class="tp-list">${L.map((t) => `<article class="tp-card">
          <div class="tp-strip">${t.schema.beats.slice(0, 6).map((b) => (b.thumb_url ? `<img src="${b.thumb_url}" alt="">` : "")).join("")}</div>
          <input class="tp-name" data-tpname="${t.id}" value="${le(t.name)}" data-no-i18n>
          <small class="muted">${t.schema.beats.length} جزء · ${t.duration} ث · من «<span data-no-i18n>${le(t.lab_name)}</span>»</small>
          <label class="row">المقاس <select data-tpratio="${t.id}">${Object.entries(TV_RATIOS).map(([k, l]) => `<option value="${k}" ${k === t.ratio ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <div class="row wrap">${t.source_url ? `<a class="btn sm" href="${t.source_url}" target="_blank" rel="noopener">▶️ الأصلي</a>` : ""}
            <button type="button" class="btn sm danger" data-tpdel="${t.id}">🗑️</button></div>
        </article>`).join("")}</div>`
        : `<p class="muted">لسه مفيش تيمبليتس. افتح فيديو احترافي في المعمل، ودوس «🗺️ المخطط»، وبعدين «📐 احفظه كتيمبليت».</p>`}
    </section>
    ${L.length ? `<section class="panel lab-sec tp-new"><h4>➕ فيديو جديد من تيمبليت</h4>
      <label>التيمبليت <select data-tvf="template">${L.map((t) => `<option value="${t.id}" data-no-i18n>${le(t.name)} (${t.schema.beats.length} جزء)</option>`).join("")}</select></label>
      <label>الفيديو عن إيه؟ <textarea rows="2" data-tvf="brief" placeholder="مثلًا: أهم ٣ مميزات في التطبيق، والختام: حمّل التطبيق"></textarea></label>
      <div class="row wrap">
        <label>المقاس <select data-tvf="ratio">${Object.entries(TV_RATIOS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
        <label>موديل الصور <select data-tvf="image_model"><option value="nano2">Nano Banana 2 (بيلتزم بالمقاس، رخيص)</option><option value="nanopro">Nano Banana Pro (أجود)</option><option value="sunburst">GPT Image 2.5 (زي ChatGPT)</option></select></label>
        <label>الكلام على الشاشة <select data-tvf="text_mode"><option value="blank">مساحات فاضية (العربي في المونتاج)</option><option value="en">إنجليزي جوه الصور</option></select></label>
        <label>موديل الحركة <select data-tvf="model"><option value="seedance-mini">Seedance 2.0 Mini (الأرخص)</option><option value="seedance-fast">Seedance 2.0 Fast</option><option value="seedance">Seedance 2.0 (أجود)</option><option value="seedance-2.5">Seedance 2.5 (لحد 30 ثانية في توليدة واحدة، أغلى)</option></select></label>
        <label>الجودة <select data-tvf="resolution"><option value="480p">480p</option><option value="720p">720p (الضعف)</option></select></label>
        <button type="button" class="btn primary" data-tvnew>✍️ املا التيمبليت</button></div>
    </section>` : ""}
    ${tplx.tvs.length ? `<h4>🎞️ الفيديوهات</h4><div class="fm-list">${tplx.tvs.map((v) => `<article class="fm-card" data-tvopen="${v.id}">
      ${v.thumb ? `<img src="${v.thumb}" alt="">` : `<span class="ph">📐</span>`}
      <b data-no-i18n>${le(v.name)}</b><small class="muted">${v.beats} جزء · ${TV_ST[v.status] || ""}</small></article>`).join("")}</div>` : ""}`;
}

function tvPanelImg(v, j) {
  const p = v.panel_files[j] || {}, u = p.full || p.cell;
  return u ? `<img src="${u}" alt="" class="${p.full ? "" : "tv-cell"}" title="${p.full ? "واضحة" : "من الشيت (لسه ما اتوضّحتش)"}">` : `<div class="fm-ph">لوحة ${j + 1}</div>`;
}

// صورة الشيت ومربعات القص (وفي وضع التعديل: المربعات بتتسحب وبتتكبّر بإيدك)
function tvSheetView(sh, busy) {
  const ed = tplx.edit?.[sh.k], boxes = ed || sh.boxes || [];
  const msg = { found: ["muted", "✂️ لقيت اللوحات في الصورة وقطعتها زي ما اترسمت، وكل لوحة اتكمّلت لـ 9:16 من غير ما يتقص منها حاجة (الأطراف المغبّشة «وضّح» بيكمّلها)"],
    manual: ["muted", "✏️ اتقطعت بالمربعات اللي إنت ظبطتها"], grid: ["muted", "✂️ قطعتها على الشبكة اللي طلبناها"],
    equal: ["err", "⚠️ ملقتش فواصل واضحة بين اللوحات، فقطعتها خانات متساوية. بص على المربعات، ولو مش مظبوطة: «✏️ ظبّط القص بإيدك»"] }[sh.how];
  return `<div class="tv-sheetwrap ${ed ? "editing" : ""}" data-sheetwrap="${sh.k}"><img src="${sh.url}" alt="" class="tv-sheetimg" draggable="false">
      ${boxes.map((b, i) => `<span class="tv-box" data-bi="${i}" style="left:${b[0] * 100}%;width:${(b[1] - b[0]) * 100}%;top:${b[2] * 100}%;height:${(b[3] - b[2]) * 100}%">${sh.cells[i] + 1}${ed ? `<i class="tv-handle" data-handle></i>` : ""}</span>`).join("")}</div>
    ${msg && !ed ? `<small class="${msg[0]}">${msg[1]}</small>` : ""}
    ${ed ? `<small class="muted">اسحب أي مربع عشان تحرّكه، واسحب الركن عشان تكبّره أو تصغّره. كل مربع لازم يغطي اللوحة بتاعته بالظبط (الرقم = رقم اللوحة).</small>
      <div class="row wrap"><button type="button" class="btn sm primary" data-tvcut="${sh.k}">💾 قطّع بالمربعات دي</button>
        <button type="button" class="btn sm" data-tvcutcancel="${sh.k}">إلغاء</button></div>`
      : `<div class="row wrap"><button type="button" class="btn sm" data-tvedit="${sh.k}" ${busy ? "disabled" : ""}>✏️ ظبّط القص بإيدك</button>
        <button type="button" class="btn sm" data-tvreslice="${sh.k}" ${busy ? "disabled" : ""} title="يدوّر على اللوحات في الصورة من جديد ويقطّعها (ببلاش)">✂️ دوّر وقطّع تاني</button></div>`}`;
}

// سحب المربعات (تحريك أو تكبير من الركن)
document.addEventListener("pointerdown", (e) => {
  const box = e.target.closest("[data-sheetwrap].editing [data-bi]");
  if (!box) return;
  e.preventDefault();
  const wrap = box.closest("[data-sheetwrap]"), k = wrap.dataset.sheetwrap, i = Number(box.dataset.bi);
  const r = wrap.getBoundingClientRect(), start = [...tplx.edit[k][i]], sx = e.clientX, sy = e.clientY, resize = !!e.target.closest("[data-handle]");
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const move = (ev) => {
    const dx = (ev.clientX - sx) / r.width, dy = (ev.clientY - sy) / r.height, b = tplx.edit[k][i];
    if (resize) { b[1] = clamp(Math.max(start[0] + 0.03, start[1] + dx)); b[3] = clamp(Math.max(start[2] + 0.03, start[3] + dy)); }
    else {
      const w = start[1] - start[0], h = start[3] - start[2];
      b[0] = clamp(Math.min(1 - w, start[0] + dx)); b[1] = b[0] + w; b[2] = clamp(Math.min(1 - h, start[2] + dy)); b[3] = b[2] + h;
    }
    Object.assign(box.style, { left: `${b[0] * 100}%`, width: `${(b[1] - b[0]) * 100}%`, top: `${b[2] * 100}%`, height: `${(b[3] - b[2]) * 100}%` });
  };
  const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
});

function tvDetail(v) {
  const sch = v.schema, fill = v.fill, c = v.costs || {}, busy = v.busy, beats = sch.beats;
  // كل خطوة بتفتح لوحدها لما ييجي دورها، إلا لو انت فتحتها أو قفلتها بإيدك
  const open = (k, def) => ((tplx.user?.[k] ?? def) ? "open" : "");
  const cutAll = v.panel_files.length && v.panel_files.every((p) => p.cell);
  const missSegs = v.seg_files.filter((x) => !x).length;
  const sheetsAll = v.sheets.length && v.sheets.every((sh) => sh.url);
  return `<div class="car-head"><button type="button" class="btn sm" data-tvback>→ كل الفيديوهات</button>
      <input class="ad-title" data-tvname value="${le(v.name)}" data-no-i18n>
      <div class="row wrap">${v.seg_files.some(Boolean) || v.final_url ? `<button type="button" class="btn sm primary" data-tveditor ${busy ? "disabled" : ""}>🎞️ انقل للمونتاج</button>` : ""}
        ${v.final_url ? `<a class="btn sm" href="${v.final_url}" download="${le(v.name)}.mp4">⬇️ نزّل</a>` : ""}
        <button type="button" class="btn sm danger" data-tvdel ${busy ? "disabled" : ""}>🗑️</button></div></div>
    <div class="fm-status"><span class="lab-st ${busy ? "working" : v.status}">${busy ? `<span class="spin-inline"></span>` : ""} ${TV_ST[v.status] || ""}</span>
      ${v.step ? `<small class="muted">${le(v.step)}</small>` : ""}${v.error ? `<small class="err">${le(v.error)}</small>` : ""}
      <small class="muted">📐 <span data-no-i18n>${le(v.template_name)}</span> · ${beats.length} جزء · ${(beats.at(-1).t1 - beats[0].t0).toFixed(1)} ث</small></div>
    ${v.final_url ? `<section class="panel fm-final"><video src="${v.final_url}" controls playsinline preload="metadata"></video></section>` : ""}
    <div class="row wrap tv-opts">
      <label>المقاس <select data-tvopt="ratio" ${busy ? "disabled" : ""}>${Object.entries(TV_RATIOS).map(([k, l]) => `<option value="${k}" ${k === v.ratio ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label>موديل الصور <select data-tvopt="image_model">${(v.image_models || []).map((m) => `<option value="${m.key}" ${m.key === v.image_model ? "selected" : ""}>${le(m.label)}</option>`).join("")}</select></label>
      <label>الكلام على الشاشة <select data-tvopt="text_mode">${Object.entries(v.text_modes).map(([k, l]) => `<option value="${k}" ${k === v.text_mode ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label>موديل الحركة <select data-tvopt="model">${v.models.map((m) => `<option value="${m.key}" ${m.key === v.model ? "selected" : ""}>${le(m.label)}</option>`).join("")}</select></label>
      <label>الجودة <select data-tvopt="resolution"><option value="480p" ${v.resolution === "480p" ? "selected" : ""}>480p</option><option value="720p" ${v.resolution === "720p" ? "selected" : ""}>720p</option></select></label>
      <button type="button" class="btn sm" data-tvrefill ${busy ? "disabled" : ""}>✍️ املاه من جديد</button>
    </div>
    ${fill ? `
    <details class="panel tv-step" data-dk="s1" ${open("s1", !cutAll)}><summary>١. 📝 السكريبت والخانات <small class="muted">التعديلات بتتحفظ لوحدها</small></summary>
      <p class="hint" dir="ltr" data-no-i18n>${le(fill.world)}</p>
      <div class="row wrap"><button type="button" class="btn sm" data-tvcopy="text">📋 انسخ الكلام بتوقيته (للمونتاج)</button>
        <button type="button" class="btn sm" data-tvcopy="voice">📋 انسخ الفويس أوفر</button></div>
      ${beats.map((b, i) => `<article class="tv-beat" data-tb="${i}">
        <header><b>${i + 1}</b> <span class="muted">${lt(b.t0)} ← ${lt(b.t1)} · ${(b.t1 - b.t0).toFixed(1)} ث</span> <small data-no-i18n>${le(b.what)}</small></header>
        <div class="tv-brow"><figure class="fm-frame">${tvPanelImg(v, i)}<figcaption>لوحة ${i + 1}</figcaption></figure>
          <div class="tv-bf"><label>🖼️ اللوحة ${i + 1} <textarea rows="2" dir="ltr" data-pd="${i}" data-no-i18n>${le(fill.panels[i].desc)}</textarea></label>
            <label>🔤 الكلام <input data-tf="text" value="${le(fill.beats[i].text)}" data-no-i18n></label>
            <label>🎙️ الفويس <input data-tf="voice" value="${le(fill.beats[i].voice)}" data-no-i18n></label>
            <label>🎬 الحركة للوحة ${i + 2} <textarea rows="2" dir="ltr" data-tf="motion" data-no-i18n>${le(fill.beats[i].motion)}</textarea></label></div></div>
      </article>`).join("")}
      <article class="tv-beat"><header><b>🏁</b> آخر الفيديو</header>
        <div class="tv-brow"><figure class="fm-frame">${tvPanelImg(v, beats.length)}<figcaption>لوحة ${beats.length + 1}</figcaption></figure>
          <div class="tv-bf"><label>🖼️ اللوحة ${beats.length + 1} <textarea rows="2" dir="ltr" data-pd="${beats.length}" data-no-i18n>${le(fill.panels[beats.length].desc)}</textarea></label></div></div></article>
    </details>
    <details class="panel tv-step" data-dk="s2" ${open("s2", !cutAll)}><summary>٢. 🎞️ الستوري بورد في صورة واحدة <small class="muted">(كل اللوحات مع بعض عشان تطلع متسقة)</small></summary>
      ${v.sheets.map((sh) => `<div class="tv-sheet" data-sheet="${sh.k}">
        <b>${v.sheets.length > 1 ? `الشيت ${sh.k + 1}: ` : ""}لوحات ${sh.cells[0] + 1}–${sh.cells.at(-1) + 1} (${sh.rows}×${sh.cols})</b>
        <textarea rows="4" dir="ltr" readonly data-no-i18n>${le(sh.prompt)}</textarea>
        <div class="row wrap"><button type="button" class="btn sm" data-tvcopyp="${sh.k}">📋 انسخ البرومبت (لـ ChatGPT)</button>
          <button type="button" class="btn sm primary" data-tvdraw="${sh.k}" ${busy ? "disabled" : ""}>${sh.url ? "↻ ارسم الشيت تاني" : "🖼️ ارسمه هنا"} (~${c.sheets && (c.sheets / v.sheets.length).toFixed(2)}$)</button>
          <button type="button" class="btn sm" data-tvup="${sh.k}" ${busy ? "disabled" : ""}>⬆ ارفع الشيت من ChatGPT</button></div>
        ${sh.url ? tvSheetView(sh, busy) : ""}
        <small class="muted">لو بتستخدم ChatGPT: الصق البرومبت، وارفع معاه صور اللوجو والشاشات اللي في البرومبت، وبعدين ارفع الصورة اللي يطلّعها هنا. البرنامج بيقطّعها لوحده.</small>
      </div>`).join("")}
    </details>
    <section class="panel tv-once"><b>🎬 الفيديو كله مرة واحدة (لقطة متصلة)</b>
      <p class="hint">الشيت كله بيتبعت للموديل مرة واحدة، فبيطلّع فيديو واحد ماشي على اللوحات بالترتيب من غير ما يتقطع. محتاج الشيت بس، من غير تقطيع ولا توضيح.</p>
      <button type="button" class="btn primary" data-tvonce ${busy || !sheetsAll ? "disabled" : ""}>${v.final_kind === "once" ? "↻ ولّده تاني" : "🎬 ولّد الفيديو كله مرة واحدة"} (~${c.once}$)</button>
      ${!sheetsAll ? `<small class="muted">ارسم الشيت أو ارفعه الأول (خطوة ٢)</small>` : ""}
      ${c.once_parts > 1 ? `<small class="muted">الفيديو أطول من ${c.once_max} ثانية، فهيتولّد على ${c.once_parts} حتت. كل حتة بتكمّل على اللي قبلها من آخر فريم فيها، فبيفضل لقطة واحدة. (Seedance 2.5 بيعمل لحد 30 ثانية في توليدة واحدة)</small>` : ""}
    </section>
    <details class="panel tv-step" data-dk="s3" ${open("s3", false)}><summary>٣. ✨ اللوحات <small class="muted">${v.panel_files.filter((p) => p.full).length}/${v.panel_files.length} واضحة</small></summary>
      ${v.sheets.some((sh) => sh.url) ? `<div class="row wrap">${v.sheets.map((sh) => `<button type="button" class="btn sm" data-tvdraw="${sh.k}" ${busy ? "disabled" : ""}
        title="يرسم الشيت كله من جديد ويقطّعه (اللوحات اللي منه بتتبدل)">↻ ارسم ${v.sheets.length > 1 ? `الشيت ${sh.k + 1}` : "الشيت"} تاني</button>`).join("")}</div>` : ""}
      <p class="hint">اللوحات المقطوعة من الشيت صغيرة. «وضّح» بيرسم كل لوحة بجودة كاملة بنفس شكلها بالظبط. ممكن تولّد من غير توضيح بس الجودة هتبقى أقل.</p>
      ${c.sharpen ? `<button type="button" class="btn primary" data-tvsharp ${busy || !cutAll ? "disabled" : ""}>✨ وضّح كل اللوحات (~${c.sharpen}$)</button>` : ""}
      <div class="tv-panels">${v.panel_files.map((p, j) => `<div class="tv-panel" data-tp="${j}">${tvPanelImg(v, j)}
        <small>لوحة ${j + 1} ${p.full ? "✅" : p.cell ? "✂️" : ""}</small>
        ${p.cell && !busy ? `<input type="text" data-tpnote placeholder="ملاحظة (اختياري)" data-no-i18n><button type="button" class="btn sm" data-tvsharp1="${j}" title="بيرسمها بجودة كاملة بنفس شكلها اللي في الشيت">${p.full ? "✨ وضّحها تاني" : "✨ وضّحها"}</button>
          <button type="button" class="btn sm" data-tvredraw="${j}" title="لو اللوحة اللي في الشيت باظت: بترسم من وصفها من الأول، بعالم اللوحات اللي جنبها">🎨 ارسمها من جديد</button>` : ""}</div>`).join("")}</div>
    </details>
    <details class="panel tv-step" data-dk="s4" ${open("s4", false)}><summary>٤. 🧩 أو جزء جزء <small class="muted">(كل لوحتين = جزء، وبيتلزقوا) ${v.seg_files.filter(Boolean).length}/${beats.length} جزء اتولد</small></summary>
      ${missSegs ? `<button type="button" class="btn primary" data-tvrun ${busy || !cutAll ? "disabled" : ""}>🎬 ولّد اللي لسه متولدش بس (${missSegs} جزء) ~${c.video}$</button>`
        : `<button type="button" class="btn" data-tvrun ${busy ? "disabled" : ""}>🎞️ جمّع الفيديو تاني (ببلاش)</button>`}
      <div class="tv-segs">${beats.map((b, i) => `<div class="tv-seg">
        <div class="tv-segimgs">${tvPanelImg(v, i)}<span>←</span>${tvPanelImg(v, i + 1)}</div>
        ${v.seg_files[i] ? `<video src="${v.seg_files[i]}" controls playsinline preload="metadata"></video>` : ""}
        <small>جزء ${i + 1} · ${(b.t1 - b.t0).toFixed(1)} ث ${v.seg_files[i] ? "✅" : ""}</small>
        ${!busy && v.panel_files[i]?.cell && v.panel_files[i + 1]?.cell ? `<button type="button" class="btn sm" data-tvrun1="${i}">${v.seg_files[i] ? "↻ ولّده تاني" : "🎬 ولّده"} (~${c.seg[i]}$)</button>` : ""}
      </div>`).join("")}</div>
    </details>` : ""}`;
}

function tvFillFromDom() {
  const box = $("labTpl"), f = JSON.parse(JSON.stringify(tplx.cur.fill));
  box.querySelectorAll("[data-pd]").forEach((x) => (f.panels[Number(x.dataset.pd)].desc = x.value));
  box.querySelectorAll("[data-tb]").forEach((card) => {
    const b = f.beats[Number(card.dataset.tb)];
    card.querySelectorAll("[data-tf]").forEach((x) => (b[x.dataset.tf] = x.value));
  });
  return f;
}

// خانة رفع الشيت برة الجزء اللي بيترسم تاني
function tvSheetInput() {
  let inp = document.getElementById("tvSheetFile");
  if (inp) return inp;
  inp = Object.assign(document.createElement("input"), { type: "file", accept: "image/*", id: "tvSheetFile", hidden: true });
  document.body.append(inp);
  inp.addEventListener("change", async () => {
    const file = inp.files[0], vid = tplx.cur?.id, k = inp.dataset.k;
    inp.value = "";
    if (!file || !vid) return;
    const fd = new FormData(); fd.append("file", file);
    toast("⬆ بيرفع الشيت ويقطّعه...");
    try { tplx.cur = await api(`/api/tvideos/${vid}/sheets/${k}/upload`, { method: "POST", body: fd }); renderTpl(); toast("✂️ اتقطّع لوحات"); }
    catch (err) { toast(err.message, true); }
  });
  return inp;
}

$("labTplBtn").onclick = () => (labx.view === "tpl" && !tplx.cur ? (labx.view = "lab", renderLab()) : openTpl());
$("labLibBtn").addEventListener("click", () => clearTimeout(tplx.timer));
$("labFilmBtn").addEventListener("click", () => clearTimeout(tplx.timer));

$("labTpl").addEventListener("click", async (e) => {
  const t = e.target, V = (path, opts) => api(`/api/tvideos/${tplx.cur.id}${path}`, opts);
  const go = (btn, fn) => busyButton(btn, "⏳", async () => { tplx.cur = await fn(); renderTpl(); scheduleTplPoll(); });
  const op = t.closest("[data-tvopen]");
  if (op) { tplx.user = {}; return openTpl(op.dataset.tvopen); }
  if (t.closest("[data-tvback]")) { tplx.cur = null; return openTpl(); }
  const del = t.closest("[data-tpdel]");
  if (del) {
    if (!confirm("تمسح التيمبليت ده؟ (الفيديوهات اللي اتعملت منه بتفضل)")) return;
    await api(`/api/templates/${del.dataset.tpdel}`, { method: "DELETE" });
    return openTpl();
  }
  const nb = t.closest("[data-tvnew]");
  if (nb) {
    const g = (k) => $("labTpl").querySelector(`[data-tvf="${k}"]`).value;
    return busyButton(nb, "⏳", async () => {
      tplx.user = {};
      tplx.cur = await api("/api/tvideos", { method: "POST", ...jsonBody({ template: g("template"), brief: g("brief"), text_mode: g("text_mode"), ratio: g("ratio"), image_model: g("image_model"),
        model: g("model"), resolution: g("resolution") }) });
      tplx.tvs = await api("/api/tvideos");
      renderTpl(); scheduleTplPoll();
    });
  }
  if (!tplx.cur) return;
  if (t.closest("[data-tvdel]")) {
    if (!confirm("تمسح الفيديو ده بكل لوحاته؟")) return;
    await V("", { method: "DELETE" }); tplx.cur = null; return openTpl();
  }
  const rf = t.closest("[data-tvrefill]");
  if (rf) {
    if (!confirm("تملا الخانات من جديد؟ الشيتات واللوحات والفيديوهات اللي اتعملت هتتمسح.")) return;
    return go(rf, () => V("/refill", { method: "POST" }));
  }
  const cp = t.closest("[data-tvcopy]");
  if (cp) {
    const f = tvFillFromDom(), beats = tplx.cur.schema.beats;
    if (cp.dataset.tvcopy === "voice") return copyText(voiceText(f.beats.map((b) => b.voice)));
    return copyText(f.beats.map((b, i) => (b.text ? `${lt(beats[i].t0)} ← ${lt(beats[i].t1)}: ${b.text}` : "")).filter(Boolean).join("\n"));
  }
  const cpp = t.closest("[data-tvcopyp]");
  if (cpp) {
    const p = tplx.cur.sheets[Number(cpp.dataset.tvcopyp)].prompt;
    try { await navigator.clipboard.writeText(p); } catch { /* المتصفح رافض */ }
    return toast("📋 اتنسخ البرومبت. الصقه في ChatGPT ومعاه صور اللوجو والشاشات");
  }
  const dr = t.closest("[data-tvdraw]");
  if (dr) {
    const sh = tplx.cur.sheets[Number(dr.dataset.tvdraw)];
    if (sh.url && !confirm("الشيت ده مرسوم. ترسمه تاني؟ اللوحات المقطوعة منه هتتبدل.")) return;
    try { tplx.cur = await V("", { method: "PATCH", ...jsonBody({ fill: tvFillFromDom() }) }); } catch (err) { return toast(err.message, true); }
    return go(dr, () => V(`/sheets/${dr.dataset.tvdraw}/draw`, { method: "POST" }));
  }
  const up = t.closest("[data-tvup]");
  if (up) { const inp = tvSheetInput(); inp.dataset.k = up.dataset.tvup; return inp.click(); }
  const sh = t.closest("[data-tvsharp]");
  if (sh) {
    if (!confirm(`يوضّح كل اللوحات اللي لسه ما اتوضّحتش؟ حوالي ${tplx.cur.costs.sharpen}$`)) return;
    return go(sh, () => V("/sharpen", { method: "POST", ...jsonBody({}) }));
  }
  const edb = t.closest("[data-tvedit]");
  if (edb) {
    const sh = tplx.cur.sheets[Number(edb.dataset.tvedit)];
    const cols = sh.cols, rows = sh.rows;
    (tplx.edit ||= {})[sh.k] = (sh.boxes?.length === sh.cells.length ? sh.boxes : sh.cells.map((_, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      return [c / cols + 0.01, (c + 1) / cols - 0.01, r / rows + 0.01, (r + 1) / rows - 0.01];
    })).map((b) => [...b]);
    return renderTpl();
  }
  const cc = t.closest("[data-tvcutcancel]");
  if (cc) { delete tplx.edit[cc.dataset.tvcutcancel]; return renderTpl(); }
  const cut = t.closest("[data-tvcut]");
  if (cut) {
    const k = cut.dataset.tvcut;
    return busyButton(cut, "⏳", async () => {
      tplx.cur = await V(`/sheets/${k}/slice`, { method: "POST", ...jsonBody({ boxes: tplx.edit[k] }) });
      delete tplx.edit[k]; renderTpl(); toast("✂️ اتقطّعت بالمربعات بتاعتك");
    });
  }
  const rs = t.closest("[data-tvreslice]");
  if (rs) {
    if (!confirm("يدوّر على اللوحات في الصورة من جديد ويقطّعها؟ اللوحات الحالية (والموضّحة منها) هتتبدل.")) return;
    return busyButton(rs, "⏳", async () => {
      tplx.cur = await V(`/sheets/${rs.dataset.tvreslice}/slice`, { method: "POST", ...jsonBody({}) });
      renderTpl(); toast("✂️ اتقطّع تاني");
    });
  }
  const rd = t.closest("[data-tvredraw]");
  if (rd) {
    const j = Number(rd.dataset.tvredraw), note = rd.closest("[data-tp]").querySelector("[data-tpnote]").value.trim();
    if (!confirm(`يرسم اللوحة ${j + 1} من الأول من وصفها (حوالي ${tplx.cur.costs.panel}$)؟ اللي في الشيت بتتبدل.`)) return;
    return go(rd, () => V(`/panels/${j}/redraw`, { method: "POST", ...jsonBody({ note }) }));
  }
  const sh1 = t.closest("[data-tvsharp1]");
  if (sh1) {
    const j = Number(sh1.dataset.tvsharp1), note = sh1.closest("[data-tp]").querySelector("[data-tpnote]").value.trim();
    return go(sh1, () => V("/sharpen", { method: "POST", ...jsonBody({ j, note }) }));
  }
  const once = t.closest("[data-tvonce]");
  if (once) {
    if (!confirm(`يولّد الفيديو كله في توليدة واحدة من الشيت؟ حوالي ${tplx.cur.costs.once}$`)) return;
    return go(once, () => V("/run", { method: "POST", ...jsonBody({ once: true }) }));
  }
  const run = t.closest("[data-tvrun]"), run1 = t.closest("[data-tvrun1]");
  if (run || run1) {
    const c = tplx.cur.costs;
    const msg = run1 ? `يولّد الجزء ${Number(run1.dataset.tvrun1) + 1} بس؟ حوالي ${c.seg[Number(run1.dataset.tvrun1)]}$`
      : c.video ? `يولّد الأجزاء اللي لسه متولدتش بس؟ حوالي ${c.video}$، واللي اتولد مش هيتلمس.` : "";
    if (msg && !confirm(msg)) return;
    return go(run || run1, () => V("/run", { method: "POST", ...jsonBody(run1 ? { i: Number(run1.dataset.tvrun1) } : {}) }));
  }
  const ed = t.closest("[data-tveditor]");
  if (ed) {
    return busyButton(ed, "⏳", async () => {
      const r = await V("/to-editor", { method: "POST" });
      storageSet("studiomania.projectId.ads", r.project_id);
      if (typeof mt !== "undefined") mt.project = null;
      toast("🎞️ اتفتح في مونتاج الإعلانات. الكلام العربي: «📋 انسخ الكلام بتوقيته» وضيفه هناك");
      showStep("6a");
    });
  }
});

$("labTpl").addEventListener("click", (e) => {
  const sum = e.target.closest("details[data-dk] > summary");
  if (sum) (tplx.user ||= {})[sum.parentElement.dataset.dk] = !sum.parentElement.open;
}, true);

$("labTpl").addEventListener("change", async (e) => {
  const t = e.target;
  if (t.matches('[data-tvf="template"]')) {   // المقاس بيمشي على التيمبليت اللي اخترته (وتقدر تغيّره)
    const tp = tplx.list.find((x) => x.id === t.value), r = $("labTpl").querySelector('[data-tvf="ratio"]');
    if (tp && r) r.value = tp.ratio || "9:16";
    return;
  }
  try {
    if (t.matches("[data-tpname]")) {
      await api(`/api/templates/${t.dataset.tpname}`, { method: "PATCH", ...jsonBody({ name: t.value }) });
      return toast("✅ اتحفظ");
    }
    if (!tplx.cur) return;
    if (t.matches("[data-tvname]")) { tplx.cur = await api(`/api/tvideos/${tplx.cur.id}`, { method: "PATCH", ...jsonBody({ name: t.value }) }); return toast("✅ اتحفظ"); }
    if (t.matches("[data-tpratio]")) {
      await api(`/api/templates/${t.dataset.tpratio}`, { method: "PATCH", ...jsonBody({ ratio: t.value }) });
      tplx.list = await api("/api/templates");
      return toast("✅ اتحفظ. الفيديوهات الجديدة من التيمبليت ده هتبقى بالمقاس ده");
    }
    if (t.matches('[data-tvopt="ratio"]')) {
      if ((tplx.cur.sheets || []).some((x) => x.url) && !confirm("تغيّر المقاس؟ الشيتات واللوحات والفيديوهات اللي اتعملت بالمقاس القديم هتتمسح، ولازم ترسم الشيت تاني.")) {
        t.value = tplx.cur.ratio; return;
      }
    }
    if (t.matches("[data-tvopt]")) {
      tplx.cur = await api(`/api/tvideos/${tplx.cur.id}`, { method: "PATCH", ...jsonBody({ [t.dataset.tvopt]: t.value }) });
      renderTpl();
      return toast(t.dataset.tvopt === "text_mode" ? "✅ اتغير. البرومبتات اتحدثت؛ ارسم الشيت تاني عشان ياخد بيه"
        : t.dataset.tvopt === "image_model" ? "✅ اتغير. دوس «↻ ارسم الشيت تاني» عشان يترسم بالموديل الجديد" : "✅ اتحفظ");
    }
    if (t.matches("[data-pd], [data-tf]")) {
      tplx.cur = await api(`/api/tvideos/${tplx.cur.id}`, { method: "PATCH", ...jsonBody({ fill: tvFillFromDom() }) });
      $("labTpl").querySelectorAll(".tv-sheet textarea[readonly]").forEach((x, k) => (x.value = tplx.cur.sheets[k]?.prompt || x.value));
      toast("✅ اتحفظ");
    }
  } catch (err) { toast(err.message, true); }
});
