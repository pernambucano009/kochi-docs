// StudioMania — 📦 استوديو المنتج جوه قسم القوالب: صورة استوديو، المنتج في مشهد، و٤٠ قالب إعلان ثابت
// صورة المنتج هي المرجع دايمًا، والبرومتات المقفولة بتتبعت زي ما هي (والملاحظة جملة واحدة في الآخر).

function tvStillDetail(v) {
  const st = v.still || {}, busy = v.busy, dis = busy ? "disabled" : "", R = v.ref_urls || {}, items = st.items || [];
  const kind = st.kind, open = (k, def) => ((tplx.user?.[k] ?? def) ? "open" : "");
  const slot = (k, l) => `<figure class="ad-ref">${R[k] ? `<img src="${R[k]}" alt="">` : `<div class="fm-ph">${l}</div>`}
      <figcaption>${l} <label class="btn sm">⬆ ارفع<input type="file" accept="image/*" data-stup="${k}" hidden ${dis}></label></figcaption></figure>`;
  const fmts = (v.formats || []).map((f) => `<button class="sc-chip ${f === st.fmt ? "on" : ""}" data-stset="fmt" data-val="${f}" ${dis}>${f}</button>`).join("");
  const missing = items.filter((_, i) => !v.item_urls[i]).length;
  let setup = "";
  if (kind === "studio") {
    setup = `<label>🎨 الخلفية <div class="sc-chips">${Object.entries(v.bgs || {}).map(([k, l]) => `<button class="sc-chip ${k === st.bg ? "on" : ""}" data-stset="bg" data-val="${tse(k)}" ${dis}>${tse(l)}</button>`).join("")}</div>
        <input data-stin="bg" dir="ltr" value="${tse(st.bg || "")}" placeholder="أو أي لون: #F5F0E1" data-no-i18n ${dis}></label>
      <small class="muted">الخلفية لون واحد بس. عايز المنتج في مكان؟ استخدم قالب «المنتج جوه مشهد».</small>`;
  } else if (kind === "scene") {
    setup = `<div class="sc-chips"><button class="sc-chip ${st.how !== "recompose" ? "on" : ""}" data-stset="how" data-val="recreate" ${dis}>📋 نسخ المشهد زي ما هو (نفس الكاميرا والنور والتكوين)</button>
        <button class="sc-chip ${st.how === "recompose" ? "on" : ""}" data-stset="how" data-val="recompose" ${dis}>🏗️ بناء المشهد حوالين المنتج (نفس الروح، كادر جديد)</button></div>
      <small class="muted">${st.how === "recompose" ? "إعادة البناء بتتغير من مرة للتانية: اعمل ٢-٣ مرات وخد الأحلى." : "النسخ بيمشي على المشهد بالظبط، والناس والإيدين اللي في المرجع بيفضلوا موجودين."}</small>`;
  } else {
    setup = `<div class="row wrap"><label>اسم المنتج <input data-stin="product" value="${tse(st.product || "")}" ${dis}></label>
        <label>🗣️ لغة الكلام اللي على الصورة <select data-stin="copy_lang" ${dis}><option value="ar" ${st.copy_lang !== "en" ? "selected" : ""}>عربي (نفس لهجة الفيديو)</option><option value="en" ${st.copy_lang === "en" ? "selected" : ""}>English (الموديل بيكتبه أدق)</option></select></label></div>
      <label>العرض / الفكرة <textarea rows="2" data-stin="offer" ${dis}>${tse(st.offer || "")}</textarea></label>
      <p class="hint">اختار لحد ١٠ قوالب (${(st.picks || []).length} متختار). الكلام والألوان بيتملوا من ملف العميل، واللي مش موجود فيه بيتعلّم عليه ⚠️ عشان تراجعه.</p>
      <div class="st-grid">${(v.adgen || []).map((t) => `<button class="st-tpl ${(st.picks || []).includes(t.n) ? "on" : ""}" data-stpick="${t.n}" ${dis}>
        <b>${t.n}. ${tse(t.ar)}</b><small class="muted" dir="ltr" data-no-i18n>${tse(t.name)} · ${t.ratio}</small></button>`).join("")}</div>`;
  }
  return `<div class="car-head"><button type="button" class="btn sm" data-tvback>→ كل الفيديوهات</button>
      <input class="ad-title" data-tvname value="${le(v.name)}" data-no-i18n>
      <div class="row wrap"><button type="button" class="btn sm danger" data-tvdel ${dis}>🗑️</button></div></div>
    <div class="fm-status"><span class="lab-st ${busy ? "working" : v.status}">${busy ? `<span class="spin-inline"></span>` : ""} ${TV_ST[v.status] || ""}</span>
      ${v.step ? `<small class="muted">${le(v.step)}</small>` : ""}${v.error ? `<small class="err">${le(v.error)}</small>` : ""}
      <small class="muted">📐 <span data-no-i18n>${le(v.template_name)}</span></small></div>
    <details class="panel tv-step" data-dk="p1" ${open("p1", !items.length)}><summary>١. 📦 الصور والإعدادات</summary>
      <div class="ad-refs">${slot("product", "📦 المنتج")}${kind === "scene" ? slot("scene", "🏞️ المشهد اللي عاجبك") : ""}</div>
      <small class="muted">صورة واحدة للمنتج. ${kind === "studio" ? "أي صورة تنفع (حتى من الموبايل)، المهم الليبل يبان واضح." : "صورة استوديو نضيفة بتطلّع أحسن نتيجة (اعملها بقالب «صورة استوديو للمنتج»)."}</small>
      ${setup}
      ${kind !== "adgen" ? `<label>📐 المقاس <div class="sc-chips">${fmts}</div></label>` : ""}
      <label>📝 ملاحظة (اختياري، بتتضاف جملة واحدة في آخر البرومت) <input data-stin="note" value="${tse(st.note || "")}" ${dis}></label>
      <div class="row wrap"><label>موديل الصور <select data-tvopt="image_model">${(v.image_models || []).map((m) => `<option value="${m.key}" ${m.key === v.image_model ? "selected" : ""}>${le(m.label)}</option>`).join("")}</select></label>
        <button class="btn primary" data-stprep ${dis || !R.product ? "disabled" : ""}>${items.length ? "↻ اكتب البرومتات من جديد" : "✍️ جهّز البرومت"}</button></div>
    </details>
    ${items.length ? `<details class="panel tv-step" data-dk="p2" ${open("p2", true)}><summary>٢. 🖼️ الصور <small class="muted">${items.length - missing}/${items.length} اترسمت</small></summary>
      <div class="row wrap"><button class="btn primary" data-strun ${dis}>${missing ? `🖼️ ارسم ${missing === items.length ? "الكل" : `الناقص (${missing})`} (~$${v.missing_cost})` : "✅ كله اترسم"}</button>
        <small class="muted">الكلام اللي على الصورة بيتغير من مرة للتانية: لو حرف باظ ارسمها تاني، ده عادي.</small></div>
      <div class="ad-jobs">${items.map((it, i) => `<article class="ts-scene" data-sti="${i}"><header><b>${tse(it.label)}</b> <small class="muted">${it.ratio}</small></header>
        <div class="ts-sbody">${v.item_urls[i] ? `<a href="${v.item_urls[i]}" target="_blank"><img class="st-out" src="${v.item_urls[i]}" alt=""></a>` : `<div class="fm-ph">لسه</div>`}
          <div class="ts-sf">${(it.copy || []).length ? `<p class="hint">🔤 الكلام: ${it.copy.map((c) => `«${tse(c)}»`).join(" · ")}</p>` : ""}
            ${(it.invented || []).length ? `<p class="err">⚠️ متألّف (راجعه): ${it.invented.map((c) => tse(c)).join(" · ")}</p>` : ""}
            <details><summary class="muted">📋 البرومت (تقدر تعدّله)</summary><textarea rows="7" dir="ltr" data-stprompt data-no-i18n ${dis}>${tse(it.prompt)}</textarea></details>
            <div class="row wrap"><button class="btn sm" data-stone="${i}" ${dis}>${v.item_urls[i] ? "↻ ارسمها تاني" : "🖼️ ارسمها"} (~$${v.item_cost})</button>
              ${v.item_urls[i] ? `<a class="btn sm" href="${v.item_urls[i]}" download>⬇️ نزّل</a>` : ""}</div></div></div></article>`).join("")}</div>
    </details>` : ""}`;
}

{
  const box = $("labTpl");
  const S = (path, method, body) => api(`/api/tvideos/${tplx.cur.id}${path}`, { method, ...jsonBody(body || {}) });
  const run = (b, fn) => busyButton(b, "⏳", async () => { tplx.cur = await fn(); renderTpl(); scheduleTplPoll(); });
  const set = async (body) => { try { tplx.cur = await S("/still", "PUT", body); renderTpl(); } catch (err) { toast(err.message, true); } };
  box.addEventListener("click", (e) => {
    if (!tplx.cur || tplx.cur.mode !== "still") return;
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.stset) return set({ [b.dataset.stset]: b.dataset.val });
    if (b.dataset.stpick) {
      const n = Number(b.dataset.stpick), picks = new Set(tplx.cur.still.picks || []);
      if (picks.has(n)) picks.delete(n); else if (picks.size < 10) picks.add(n); else return toast("لحد ١٠ قوالب في المرة", true);
      return set({ picks: [...picks] });
    }
    if (b.hasAttribute("data-stprep")) return run(b, () => S("/still/prepare", "POST"));
    if (b.hasAttribute("data-strun")) return run(b, () => S("/still/run", "POST", {}));
    if (b.dataset.stone) return run(b, () => S("/still/run", "POST", { i: Number(b.dataset.stone) }));
  });
  box.addEventListener("change", async (e) => {
    if (!tplx.cur || tplx.cur.mode !== "still") return;
    const t = e.target;
    if (t.dataset.stup) {
      const f = t.files[0];
      if (!f) return;
      const fd = new FormData();
      fd.append("file", f);
      try { tplx.cur = await api(`/api/tvideos/${tplx.cur.id}/still/upload/${t.dataset.stup}`, { method: "POST", body: fd }); renderTpl(); toast("✅ اترفعت"); }
      catch (err) { toast(err.message, true); }
      return;
    }
    if (t.dataset.stin) return set({ [t.dataset.stin]: t.value });
    if (t.hasAttribute("data-stprompt")) {
      const i = t.closest("[data-sti]").dataset.sti;
      try { tplx.cur = await S(`/still/items/${i}`, "PUT", { prompt: t.value }); toast("✅ اتحفظ"); }
      catch (err) { toast(err.message, true); }
    }
  });
}
