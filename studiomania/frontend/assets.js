// 📚 مكتبة الأصول: مقاطع حقيقية من الفيديوهات بحركتها وخلفيتها وصوتها، ومعاها تفكيكها،
// وكل أصل تقدر تطلع منه نسخ: تعديل جوه المشهد بالكلام، أو سرعة جزء منه.
const asx = { list: [], cur: null, q: "", cat: "", timer: null };

async function labLibCount() {
  try {
    asx.list = await api("/api/assets");
    $("labLibCount").textContent = asx.list.length ? `(${asx.list.length})` : "";
  } catch { /* مش مهم */ }
}

async function openLib(aid) {
  labx.view = "lib";
  renderLab();
  asx.list = await api("/api/assets");
  $("labLibCount").textContent = asx.list.length ? `(${asx.list.length})` : "";
  asx.cur = aid && asx.list.some((x) => x.id === aid) ? await api(`/api/assets/${aid}`) : null;
  renderLib();
  scheduleAssetPoll();
}

function scheduleAssetPoll() {
  clearTimeout(asx.timer);
  if (!asx.cur?.busy || labx.view !== "lib") return;
  asx.timer = setTimeout(async () => {
    try {
      asx.cur = await api(`/api/assets/${asx.cur.id}`);
      const playing = [...$("labLib").querySelectorAll("video")].some((v) => !v.paused);
      const typing = $("labLib").contains(document.activeElement) && document.activeElement.matches("input, select, textarea");
      if (!playing && !typing) renderLib();
    } catch { /* السيرفر بيعيد التشغيل */ }
    scheduleAssetPoll();
  }, 2500);
}

function renderLib() {
  $("labLib").innerHTML = asx.cur ? assetDetail(asx.cur) : assetGrid();
}

function assetGrid() {
  const q = asx.q.trim().toLowerCase();
  const items = asx.list.filter((a) => (!asx.cat || a.category === asx.cat)
    && (!q || [a.name, a.summary, ...(a.tags || [])].join(" ").toLowerCase().includes(q)));
  const counts = asx.list.reduce((m, a) => ((m[a.category] = (m[a.category] || 0) + 1), m), {});
  return `<div class="car-head"><h2>📚 مكتبة الأصول <span class="muted">(${asx.list.length})</span></h2>
      ${asx.list.length ? `<button type="button" class="btn sm danger" data-asclear>🗑️ امسح المكتبة كلها</button>` : ""}</div>
    <div class="row wrap as-filter">
      <input type="search" data-asq placeholder="🔎 دوّر بالاسم أو التاجز" value="${le(asx.q)}" data-no-i18n>
      <div class="lab-chips"><button type="button" class="chip ${asx.cat ? "" : "on"}" data-ascat="">الكل</button>
        ${Object.entries(ASSET_CATS).filter(([k]) => counts[k]).map(([k, l]) => `<button type="button" class="chip ${asx.cat === k ? "on" : ""}" data-ascat="${k}">${l} <small>${counts[k]}</small></button>`).join("")}</div>
    </div>
    ${items.length ? `<div class="as-grid">${items.map((a) => `<article class="as-card" data-asopen="${a.id}">
      <video src="${a.url}" poster="${a.thumb_url}" preload="none" muted loop playsinline></video>
      <b data-no-i18n>${le(a.name)}</b>
      <small class="muted">${ASSET_CATS[a.category] || ""} · ${a.duration} ث · ${a.elements} عنصر${a.variants ? ` · ${a.variants} نسخة` : ""}</small>
      ${(a.tags || []).length ? `<small class="as-tags" data-no-i18n>${a.tags.map((t) => `#${le(t)}`).join(" ")}</small>` : ""}
    </article>`).join("")}</div>`
    : `<p class="panel muted">${asx.list.length ? "مفيش أصول بالبحث ده." : "المكتبة لسه فاضية. افتح أي فيديو في المعمل، وفي أي لقطة دوس «📚 احفظ كأصل في المكتبة»."}</p>`}`;
}

function assetDetail(a) {
  const vs = a.variants || [], done = vs.filter((v) => v.status === "done"), src = a.source || {};
  const models = a.vedit_models || [], dur = a.duration;
  return `<div class="car-head"><button type="button" class="btn sm" data-asback>→ المكتبة</button>
      <input class="ad-title" data-asf="name" value="${le(a.name)}" data-no-i18n>
      <div class="row wrap"><a class="btn sm" href="${a.url}" download="${le(a.name)}.mp4">⬇️ نزّل</a>
        <button type="button" class="btn sm danger" data-asdel>🗑️</button></div></div>
    <div class="as-top">
      <video data-asmain src="${a.url}" poster="${a.thumb_url}" controls playsinline preload="metadata"></video>
      <div class="as-meta">
        <label>النوع <select data-asf="category">${labOpts(ASSET_CATS, a.category)}</select></label>
        <label>تاجز <input type="text" data-asf="tags" value="${le((a.tags || []).join("، "))}" placeholder="ماوس، سحب، فولدر" data-no-i18n></label>
        <label>ملاحظات <textarea rows="2" data-asf="notes" placeholder="هتستخدمه في إيه؟ إيه اللي حلو فيه؟" data-no-i18n>${le(a.notes)}</textarea></label>
        <small class="muted">${a.duration} ث · ${a.width}×${a.height} · من
          <a href="#" data-asgolab="${src.lab}" data-no-i18n>«${le(src.lab_name)}»</a> ${(src.shots || [src.shot]).length > 1 ? `لقطات ${(src.shots || []).join("، ")}` : `لقطة ${(src.shots || [src.shot])[0]}`} (${lt(src.t0)} ← ${lt(src.t1)})</small>
        ${a.description || a.summary ? `<p data-no-i18n>${le(a.description || a.summary)}</p>` : ""}
        ${a.use ? `<small class="muted" data-no-i18n>💼 ${le(a.use)}</small>` : ""}
      </div>
    </div>
    ${a.connector ? assetConnector(a) : ""}
    <section class="panel lab-sec"><h4>🧩 اللي جواه</h4>
      ${a.background?.name ? `<div class="lab-row"><b>🖼️ الخلفية:</b> <span data-no-i18n>${le(a.background.name)}</span> <small class="muted" data-no-i18n>${le(a.background.description)}</small></div>` : ""}
      ${(a.elements || []).map((e) => `<div class="lab-el">
        <div class="lab-row"><span>${LAB_TYPES[e.type] || ""}</span> <b data-no-i18n>${le(e.name)}</b>
          <button type="button" class="btn sm" data-asplay="${e.first_t}" data-to="${e.last_t}">▶️</button>
          <span class="lab-time">${lt(e.first_t)} ← ${lt(e.last_t)}</span></div>
        ${(e.actions || []).map((x) => `<div class="lab-row lab-act"><button type="button" class="btn sm" data-asplay="${x.t0}" data-to="${x.t1}">▶️</button>
          <span class="lab-time">${lt(x.t0)}–${lt(x.t1)}</span> ${LAB_ACTIONS[x.action] || le(x.action)} <small class="grow" data-no-i18n>${le(x.detail)}</small></div>`).join("")}
      </div>`).join("") || `<p class="muted">مفيش عناصر متفككة في المقطع ده.</p>`}
      ${(a.sfx || []).length ? `<div class="lab-chips">${a.sfx.map((x) => `<button type="button" class="chip" data-asplay="${x.t}" data-to="${x.t + 0.4}">🔊 ${le(x.label || x.category)} <small>${lt(x.t)}</small></button>`).join("")}</div>` : ""}
    </section>
    <section class="panel lab-sec"><div class="lab-vedit" data-asedit>
      <b>✏️ اطلع منه نسخة</b> <small class="muted">المشهد بيفضل بحركته وخلفيته، واللي بتطلبه بس هو اللي بيتغيّر</small>
      ${(a.controls || []).length ? `<div class="as-ctls"><b>🎛️ مفاتيح التحكم</b> <small class="muted">غيّر اللي إنت عايزه بس وسيب الباقي</small>
        ${a.controls.map((k) => `<label class="as-ctl" title="${le(k.target)}"><span data-no-i18n>${le(k.label)}</span>
          ${k.type === "color" ? `<input type="color" value="${/^#[0-9a-f]{6}$/i.test(k.value) ? k.value : "#000000"}" data-ctl="${k.key}">`
            : k.type === "choice" ? `<select data-ctl="${k.key}">${(k.options || []).map((o) => `<option ${o === k.value ? "selected" : ""} data-no-i18n>${le(o)}</option>`).join("")}</select>`
            : `<input type="${k.type === "number" ? "number" : "text"}" value="${le(k.value)}" data-ctl="${k.key}" data-no-i18n>`}</label>`).join("")}
      </div>` : ""}
      ${(a.elements || []).length ? `<div class="lab-chips">${a.elements.map((e) => `<button type="button" class="chip" data-vchip="${le(e.name)}">${LAB_TYPES[e.type]?.split(" ")[0] || ""} ${le(e.name)}</button>`).join("")}</div>` : ""}
      <textarea rows="2" data-vtext placeholder="${(a.controls || []).length ? "وأي حاجة تانية عايز تغيّرها بالكلام (اختياري)" : "مثلًا: «مؤشر الماوس» خليه بلون البراند، والفولدر اسمه «عملاء»"}"></textarea>
      <div class="row wrap">
        <select data-vmodel>${models.map((m) => `<option value="${m.key}">${le(m.label)} · ~${(m.per_sec * dur).toFixed(2)}$</option>`).join("")}</select>
        ${done.length ? `<select data-vbase><option value="">على الأصل</option>${done.map((v) => `<option value="${v.id}">على النسخة ${vs.indexOf(v) + 1}</option>`).join("")}</select>` : ""}
        <button type="button" class="btn sm primary" data-vgo>✨ عدّل</button>
      </div>
      <details class="lab-speed"><summary>⏩ سرّع / بطّأ جزء (ببلاش، من غير AI)</summary>
        <div class="row wrap"><label>من <input type="number" step="0.05" min="0" max="${dur}" value="0" data-sp="t0"></label>
          <label>لـ <input type="number" step="0.05" min="0" max="${dur}" value="${dur}" data-sp="t1"></label>
          <label>السرعة <input type="number" step="0.1" min="0.2" max="5" value="1.5" data-sp="factor">×</label>
          <button type="button" class="btn sm" data-vspeed>⏩ طبّق</button></div></details>
      ${vs.length ? `<div class="lab-vgrid">${vs.map((v, i) => `<div class="lab-ver">
        ${v.status === "done" ? `<video data-asvar="${v.id}" src="${v.url}" playsinline controls preload="metadata"></video>`
          : v.status === "working" ? `<div class="lab-ver-wait"><span class="spin"></span><small>${le(v.step || "شغال...")}</small></div>`
          : `<div class="lab-ver-wait err">✕ ${le(v.error)}</div>`}
        <small data-no-i18n><b>${i + 1}.</b> ${le(v.instruction)}${v.base ? ` <span class="muted">(على نسخة ${vs.findIndex((x) => x.id === v.base) + 1})</span>` : ""}</small>
        ${v.prompt ? `<details><summary class="muted">التعليمات اللي اتبعتت للموديل</summary><small dir="ltr" data-no-i18n>${le(v.prompt)}</small></details>` : ""}
        <div class="row wrap">${v.status === "done" ? `<button type="button" class="btn sm" data-ascmp="${v.id}">▶️ مع الأصل</button>
            <a class="btn sm" href="${v.url}" download>⬇️</a>` : ""}
          <button type="button" class="btn sm danger" data-asvdel="${v.id}">🗑️</button>
          ${v.status === "done" ? `<span class="lab-rv" data-asrv="${v.id}">
            <button type="button" class="${v.review?.ok === true ? "on ok" : ""}" data-asok="1" title="حلوة">✅</button>
            <button type="button" class="${v.review?.ok === false ? "on bad" : ""}" data-asok="0" title="وحشة">❌</button>
            <input type="text" class="lab-note" value="${le(v.review?.note)}" placeholder="ملاحظة" data-asnote></span>` : ""}</div>
      </div>`).join("")}</div>` : ""}
    </div></section>`;
}

// 🔗 وصفة الكونيكتور: الشرارة واللي بيفضل ثابت والتحوّلات والكاميرا والإيقاع، والفريمات المفتاحية
function assetConnector(a) {
  const c = a.connector || {}, t0 = a.source?.t0 || 0;
  return `<section class="panel lab-sec as-conn"><h4>🔗 وصفة الكونيكتور</h4>
    ${(a.keyframes || []).length ? `<div class="lab-conn-keys">${a.keyframes.map((k) => `<figure><img src="${k.url}" alt="" data-asplay="${k.t}" data-to="${k.t + 0.6}"><figcaption>${k.label} · ${lt(k.t)}</figcaption></figure>`).join("")}</div>` : ""}
    ${c.from_scene || c.to_scene ? `<div class="lab-conn-story" data-no-i18n><span>${le(c.from_scene)}</span> <b>⟵</b> <span>${le(c.to_scene)}</span></div>` : ""}
    <dl class="lab-conn-dl">
      ${c.trigger ? `<dt>🎯 الشرارة</dt><dd data-no-i18n>${le(c.trigger)}</dd>` : ""}
      ${(c.anchors || []).length ? `<dt>📌 بيفضل ثابت</dt><dd data-no-i18n>${c.anchors.map((x) => `<span class="chip">${le(x)}</span>`).join(" ")}</dd>` : ""}
      ${(c.transforms || []).length ? `<dt>🔄 التحوّلات</dt><dd><ol class="lab-conn-tr">${c.transforms.map((x) => `<li><button type="button" class="btn sm" data-asplay="${Math.max(0, x.t0 - t0)}" data-to="${Math.max(0, x.t1 - t0)}">▶️</button>
        <span data-no-i18n><b>${le(x.from)}</b> ← ${le(x.to)}${x.how ? ` <small class="muted">(${le(x.how)})</small>` : ""}</span></li>`).join("")}</ol></dd>` : ""}
      ${c.camera ? `<dt>🎥 الكاميرا</dt><dd data-no-i18n>${le(c.camera)}</dd>` : ""}
      ${c.rhythm ? `<dt>⏱️ الإيقاع</dt><dd data-no-i18n>${le(c.rhythm)}</dd>` : ""}
      ${c.sound ? `<dt>🔊 الصوت</dt><dd data-no-i18n>${le(c.sound)}</dd>` : ""}
      ${c.story_role ? `<dt>📖 بيخدم القصة إزاي</dt><dd data-no-i18n>${le(c.story_role)}</dd>` : ""}
    </dl>
    ${(c.recipe || []).length ? `<h4>🧪 الوصفة</h4><ol class="as-recipe" data-no-i18n>${c.recipe.map((x) => `<li>${le(x)}</li>`).join("")}</ol>` : ""}
  </section>`;
}

function asPlay(t0, t1) {
  const v = $("labLib").querySelector("[data-asmain]");
  if (!v) return;
  clearInterval(asx.stopper);
  v.currentTime = Math.max(0, t0 - 0.3);
  v.play().catch(() => {});
  asx.stopper = setInterval(() => { if (v.currentTime >= t1 + 0.3 || v.paused) { v.pause(); clearInterval(asx.stopper); } }, 50);
}

async function asReview(box, ok) {
  try {
    asx.cur = await api(`/api/assets/${asx.cur.id}/review`, { method: "PATCH", ...jsonBody({ variant: box.dataset.asrv, ok, note: box.querySelector("[data-asnote]").value }) });
    box.querySelectorAll("[data-asok]").forEach((b) => {
      const on = ok != null && (b.dataset.asok === "1") === ok;
      b.className = on ? `on ${ok ? "ok" : "bad"}` : "";
    });
  } catch (err) { toast(err.message, true); }
}

$("labLibBtn").onclick = () => (labx.view === "lib" && !asx.cur ? (labx.view = "lab", renderLab()) : openLib());

$("labLib").addEventListener("click", async (e) => {
  const t = e.target;
  const cat = t.closest("[data-ascat]");
  if (cat) { asx.cat = cat.dataset.ascat; return renderLib(); }
  const open = t.closest("[data-asopen]");
  if (open) return openLib(open.dataset.asopen);
  if (t.closest("[data-asback]")) { asx.cur = null; return openLib(); }
  const clear = t.closest("[data-asclear]");
  if (clear) {
    if (!confirm(`تمسح كل الأصول اللي في المكتبة (${asx.list.length}) بكل نسخها؟ مفيش رجوع.`)) return;
    if (!confirm("متأكد؟ المكتبة هتبقى فاضية. (الفيديوهات اللي في المعمل مش هتتمسح، والكومبوننتس اللي كنت قبلتها هترجع «لسه» وتقدر تقبلها تاني)")) return;
    return busyButton(clear, "⏳", async () => {
      const r = await api("/api/assets", { method: "DELETE" });
      toast(`🗑️ اتمسح ${r.deleted} أصل. المكتبة فاضية`);
      asx.cur = null; asx.cat = ""; asx.q = "";
      if (labx.cur) labx.cur = await api(`/api/lab/${labx.cur.id}`);
      await openLib();
    });
  }
  const golab = t.closest("[data-asgolab]");
  if (golab) {
    e.preventDefault();
    if (!labx.list.some((x) => x.id === golab.dataset.asgolab)) return toast("الفيديو الأصلي اتمسح من المعمل", true);
    labx.view = "lab";
    return openLab(golab.dataset.asgolab);
  }
  if (t.closest("[data-asdel]")) {
    if (!confirm("تمسح الأصل ده من المكتبة بكل نسخه؟")) return;
    try { await api(`/api/assets/${asx.cur.id}`, { method: "DELETE" }); asx.cur = null; return openLib(); }
    catch (err) { return toast(err.message, true); }
  }
  const play = t.closest("[data-asplay]");
  if (play) return asPlay(Number(play.dataset.asplay), Number(play.dataset.to));
  const okb = t.closest("[data-asok]");
  if (okb) return asReview(okb.closest("[data-asrv]"), okb.classList.contains("on") ? null : okb.dataset.asok === "1");
  const box = t.closest("[data-asedit]");
  if (!box) return;
  const chip = t.closest("[data-vchip]");
  if (chip) { const ta = box.querySelector("[data-vtext]"); ta.value += `${ta.value && !ta.value.endsWith(" ") ? " " : ""}«${chip.dataset.vchip}» `; ta.focus(); return; }
  const base = () => box.querySelector("[data-vbase]")?.value || null;
  const go = t.closest("[data-vgo]"), sp = t.closest("[data-vspeed]"), del = t.closest("[data-asvdel]"), cmp = t.closest("[data-ascmp]");
  if (go) {
    // مفاتيح التحكم اللي اتغيرت بتتحول لطلب واحد مع الكلام اللي اتكتب
    const changes = (asx.cur.controls || []).map((k) => {
      const v = box.querySelector(`[data-ctl="${k.key}"]`)?.value ?? k.value;
      return String(v).toLowerCase() === String(k.value).toLowerCase() ? null : `${k.label}${k.target ? ` («${k.target}»)` : ""}: من «${k.value}» لـ «${v}»`;
    }).filter(Boolean);
    const text = [...changes, box.querySelector("[data-vtext]").value.trim()].filter(Boolean).join("\n");
    if (!text) return toast("غيّر مفتاح أو اكتب عايز تغيّر إيه", true);
    const sel = box.querySelector("[data-vmodel]");
    if (!confirm(`يعدّل الأصل بـ ${sel.selectedOptions[0].textContent}؟`)) return;
    return busyButton(go, "⏳", async () => {
      asx.cur = await api(`/api/assets/${asx.cur.id}/variants`, { method: "POST", ...jsonBody({ instruction: text, model: sel.value, base: base() }) });
      renderLib(); scheduleAssetPoll();
    });
  }
  if (sp) {
    const g = (k) => Number(box.querySelector(`[data-sp="${k}"]`).value);
    return busyButton(sp, "⏳", async () => {
      asx.cur = await api(`/api/assets/${asx.cur.id}/variants`, { method: "POST", ...jsonBody({ speed: { t0: g("t0"), t1: g("t1"), factor: g("factor") }, base: base() }) });
      renderLib(); scheduleAssetPoll();
    });
  }
  if (del) {
    if (!confirm("تمسح النسخة دي؟")) return;
    asx.cur = await api(`/api/assets/${asx.cur.id}/variants/${del.dataset.asvdel}`, { method: "DELETE" });
    return renderLib();
  }
  if (cmp) {  // الأصل والنسخة بيبدأوا مع بعض
    const v = box.querySelector(`[data-asvar="${cmp.dataset.ascmp}"]`), o = $("labLib").querySelector("[data-asmain]");
    v.currentTime = 0; o.currentTime = 0; o.muted = true; v.muted = false;
    v.play().catch(() => {}); o.play().catch(() => {});
  }
});

$("labLib").addEventListener("input", (e) => {
  if (!e.target.matches("[data-asq]")) return;
  asx.q = e.target.value;
  const pos = e.target.selectionStart;
  renderLib();
  const q = $("labLib").querySelector("[data-asq]");
  q.focus(); q.setSelectionRange(pos, pos);
});

$("labLib").addEventListener("change", async (e) => {
  const f = e.target.dataset.asf;
  if (f) {
    const v = e.target.value;
    try {
      asx.cur = await api(`/api/assets/${asx.cur.id}`, { method: "PATCH", ...jsonBody({ [f]: f === "tags" ? v.split(/[,،]/) : v }) });
      const i = asx.list.findIndex((x) => x.id === asx.cur.id);
      if (i >= 0) Object.assign(asx.list[i], { name: asx.cur.name, category: asx.cur.category, tags: asx.cur.tags });
      toast("✅ اتحفظ");
    } catch (err) { toast(err.message, true); }
    return;
  }
  if (e.target.matches("[data-asnote]")) {
    const box = e.target.closest("[data-asrv]"), on = box.querySelector(".on");
    asReview(box, on ? on.dataset.asok === "1" : null);
  }
});

// المعاينة: الكارت بيتحرك لما الماوس يعدّي عليه
$("labLib").addEventListener("mouseover", (e) => {
  const c = e.target.closest(".as-card");
  if (c && !c.contains(e.relatedTarget)) { const v = c.querySelector("video"); v.preload = "auto"; v.play().catch(() => {}); }
});
$("labLib").addEventListener("mouseout", (e) => {
  const c = e.target.closest(".as-card");
  if (c && !c.contains(e.relatedTarget)) c.querySelector("video").pause();
});
