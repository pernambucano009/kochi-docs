// 🧭 مسار القالب: العميل داس على قالب ← المخ بيمشي معاه خطوة بخطوة
// قالب كود: الفكرة ← السكريبت على مشاهد القالب ← الصوت (المشاهد بتاخد طول جملها) ← لوحة التحكم ← التصدير.
// قالب تايبوجرافي: الفكرة ← السكريبت ← التوليد.
// (الطريقة القديمة لقوالب التوليد: الفكرة ← نوع البوست ← السيناريو ← الأبطال ← الملفات ← التوليد.)
// في كل خطوة: اختار / عدّل / اتناقش مع المخ / اقترح غيرهم / اكتب بنفسك، وكل 👍👎 بيتسجل في المخ.
const Flow = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  // 💳 التكلفة جنب زرار الصرف: «نحو N نقطة · رصيدك M» (والرصيد مش ظاهر لصاحب البرنامج)
  const costTag = (pts, bal) => pts ? `<small class="flw-cost${bal != null && bal < pts ? " low" : ""}">نحو ${Number(pts).toLocaleString("en-US")} نقطة${bal != null ? ` · رصيدك ${Number(bal).toLocaleString("en-US")}` : ""}</small>` : "";
  const J = (o) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });
  const S = { seen: new Set(), html: {}, busyFrom: null, tickT: null, el: null, d: null, timer: null, edit: null, own: false, hint: false, chat: null, cast: null, seasons: null, why: false };
  const STEPS_AI = [["idea", "الفكرة"], ["format", "نوع المنشور"], ["scenario", "السيناريو"], ["cast", "الأبطال"], ["voice", "الصوت"], ["assets", "ملفاتك"], ["generate", "التوليد"]];
  // قالب كود: السكريبت على مشاهد القالب ← الصوت (المشاهد بتاخد طول جملها) ← لوحة التحكم ← التصدير
  const STEPS_CODE = [["idea", "الفكرة"], ["scenario", "النص"], ["voice", "الصوت"], ["panel", "لوحة التحكم"], ["generate", "التصدير"]];
  // قالب تايبوجرافي: كلام بس بيتحرك (مفيش نوع بوست ولا أبطال ولا ملفات)
  const STEPS_TYPO = [["idea", "الفكرة"], ["scenario", "النص"], ["generate", "التوليد"]];
  const isCode = (d) => d?.template?.kind === "motion";
  // 📱 تصوير بالموبايل: الفكرة والسكريبت اختياريين (تقدر تتخطاهم لو عندك الفيديو)، وبعدين الفيديو ← الملاحظات ← المونتاج الأوتوماتيك
  const STEPS_PHONE = [["idea", "الفكرة"], ["scenario", "النص"], ["shoot", "الفيديو"], ["review", "الملاحظات"], ["montage", "المونتاج"]];
  const isPhone = (d) => d?.template?.kind === "phone";
  const steps = (d) => (isCode(d) ? STEPS_CODE : d?.template?.kind === "typo" ? STEPS_TYPO : isPhone(d) ? STEPS_PHONE : STEPS_AI);
  const FMT = { reel: ["🎬", "ريل", "فيديو قصير رأسي"], carousel: ["🗂️", "كاروسيل", "صور خلف بعض تتقلب"], series: ["📺", "مسلسل", "كذا حلقة بنفس الأبطال"] };
  const OUT = { tvideo: "قسم القوالب", carousel: "الكاروسيل", series: "المسلسلات", typo: "التايبوجرافي", motion: "الموشن" };
  const idx = (st, d = S.d) => Math.max(0, steps(d).findIndex(([k]) => k === (st === "done" ? "generate" : st)));

  // ---------------------------------------------------------------- فتح وقفل
  function shell() {
    if (S.el) return S.el;
    S.el = Object.assign(document.createElement("div"), { className: "flw", hidden: true });
    S.el.setAttribute("role", "dialog");
    S.el.addEventListener("click", onClick);
    S.el.addEventListener("change", onChange);
    S.el.addEventListener("input", onInput);
    S.el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && e.target.matches("[data-chatin]")) { e.preventDefault(); send(e.target.dataset.chatin); }
    });
    document.body.appendChild(S.el);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.el && !S.el.hidden) { e.preventDefault(); e.stopImmediatePropagation(); close(); } }, true);
    return S.el;
  }
  async function start(t) {
    shell();
    Object.assign(S, { d: null, edit: null, own: false, hint: false, chat: null, cast: null, vopts: null, vo: null });
    S.el.hidden = false;
    S.el.innerHTML = `<div class="flw-box"><div class="flw-load"><span class="flw-spin"></span><p>العقل يقرأ العلامة والقالب ويُجهّز أفكار…</p></div></div>`;
    try {
      S.d = await api("/api/flows", { method: "POST", ...J({ template: t.id, name: t.name || "", cat: t.cat || "", desc: t.desc || "" }) });
      try { localStorage.setItem("studiomania.flow", S.d.id); } catch { /* غير مهم */ }
      render(); poll();
    } catch (err) { toast(err.message, true); close(); }
  }
  async function open(fid) {
    shell();
    Object.assign(S, { d: null, edit: null, own: false, hint: false, chat: null, cast: null, vopts: null, vo: null });
    S.el.hidden = false;
    S.el.innerHTML = `<div class="flw-box"><div class="flw-load"><span class="flw-spin"></span></div></div>`;
    try { S.d = await api(`/api/flows/${fid}`); render(); poll(); } catch (err) { toast(err.message, true); close(); }
  }
  function close() {
    clearTimeout(S.timer);
    if (!S.el) return;
    S.el.querySelectorAll("video").forEach((v) => v.pause());
    S.el.hidden = true;
    S.el.innerHTML = "";
    S.d = null;
  }

  // ---------------------------------------------------------------- مزامنة مع السيرفر
  const busy = () => S.d?.busy || S.d?.output?.status === "working";
  function poll() {
    clearTimeout(S.timer);
    if (!S.d || !busy()) return;
    S.timer = setTimeout(async () => {
      if (!S.d) return;
      try {
        const was = S.d.busy;
        S.d = await api(`/api/flows/${S.d.id}`);
        if (S.d.error && was) toast(S.d.error, true);
        const typing = S.el.contains(document.activeElement) && document.activeElement.matches("input, textarea, select");
        if (!typing || !busy()) render();
      } catch { /* الخادم يعيد التشغيل */ }
      poll();
    }, 1400);
  }
  async function loadSaved() {
    S.saved = null; render();
    try { S.saved = await api(`/api/flows/${S.d.id}/saved`); } catch (err) { S.saved = []; toast(err.message, true); }
    render();
  }
  async function call(path, body, method = "POST") {
    try {
      S.d = await api(`/api/flows/${S.d.id}${path}`, { method, ...(body instanceof FormData ? { body } : J(body || {})) });
      render(); poll();
      return true;
    } catch (err) { toast(err.message, true); return false; }
  }

  // ---------------------------------------------------------------- أجزاء مشتركة
  function meter(k) {
    if (!k) return "";
    const r = 15, c = 2 * Math.PI * r;
    return `<button type="button" class="flw-meter" data-why title="العقل فاهمك قدر ماذا (اضغط ترى الشروط)">
      <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="${r}" class="bg"/><circle cx="18" cy="18" r="${r}" class="fg" stroke-dasharray="${(k.score / 100) * c} ${c}"/></svg>
      <span><b class="num">${k.score}٪</b><small>${esc(k.level)}</small></span></button>`;
  }
  function stepper(d) {
    const cur = idx(d.stage, d);
    const ready = { idea: true, format: !!d.idea, scenario: !!d.format, cast: !!d.scenario, voice: !!d.scenario, assets: !!d.scenario, panel: !!d.scenario, generate: !!d.scenario && !isCode(d),
      shoot: isPhone(d), review: !!d.footage?.main, montage: !!(d.review || d.montage) };
    return `<ol class="flw-steps">${steps(d).map(([k, t], i) => `<li class="${i < cur ? "past" : i === cur ? "now" : ""}">
      <button type="button" ${ready[k] && i !== cur && !busy() ? `data-go="${k}"` : "disabled"}><i class="num">${i < cur ? "✓" : i + 1}</i><span>${t}</span></button></li>`).join("")}</ol>`;
  }
  function rateBtns(stage, id) {
    const v = (S.d.ratings || {})[`${stage}:${id || "final"}`] || 0;
    return `<span class="flw-rate"><button type="button" class="${v === 1 ? "on" : ""}" data-rate="${stage}" data-rid="${esc(id || "")}" data-v="${v === 1 ? 0 : 1}" title="عجبني">👍</button>
      <button type="button" class="${v === -1 ? "on bad" : ""}" data-rate="${stage}" data-rid="${esc(id || "")}" data-v="${v === -1 ? 0 : -1}" title="غير يعجبني">👎</button></span>`;
  }
  const working = (t) => `<div class="flw-work"><span class="flw-spin"></span><p>${t} <small class="muted" data-secs></small></p></div>`;
  const failed = (what) => (S.d.error && !S.d.busy ? `<div class="flw-empty bad">⚠️ ${esc(S.d.error)}
    <div class="flw-acts"><button type="button" class="flw-btn pri" data-retry="${what}">↻ جرّب مرة أخرى</button></div></div>` : "");
  function chatBox(stage) {
    const log = S.d[stage === "idea" ? "idea_chat" : "scen_chat"] || [];
    return `<div class="flw-chat">
      ${log.length ? `<div class="flw-log">${log.slice(-8).map((m) => `<p class="${m.role}">${esc(m.content)}</p>`).join("")}</div>` : ""}
      <div class="flw-chatrow"><input data-chatin="${stage}" placeholder="${stage === "idea" ? "مثلًا: اجعلها أجرأ، أو ركّز على السعر…" : "مثلًا: الخطاف أقوى، أو قلل النص…"}" ${S.d.busy ? "disabled" : ""}>
        <button type="button" class="flw-btn" data-send="${stage}" ${S.d.busy ? "disabled" : ""}>أرسل</button></div></div>`;
  }
  // الاختيار اللي فات (بيظهر فوق الخطوة الجاية): تقدر تتناقش فيه أو ترجع تغيّره
  function picked(stage) {
    const it = S.d[stage];
    if (!it) return "";
    const open = S.chat === stage;
    return `<div class="flw-picked"><div><small class="latin">${stage === "idea" ? "Idea" : "Scenario"}</small>
        <b>${esc(it.title || "")}</b><p>${esc(stage === "idea" ? it.idea || it.hook || "" : it.summary || "")}</p></div>
      <div class="flw-pact"><button type="button" class="flw-link" data-chat="${stage}">💬 ${open ? "أغلق النقاش" : "ناقش مع العقل"}</button>
        <button type="button" class="flw-link" data-go="${stage}">↩︎ غيّر</button></div>
      ${open ? chatBox(stage) : ""}</div>`;
  }

  // 🧭 نصيحة القالب (قوالب الذكاء الصناعي): نوع الفكرة أو السيناريو اللي بينجح عليه
  const tipBox = (t) => (t ? `<div class="flw-tip"><b>💡 نصيحة القالب</b><span>${esc(t)}</span></div>` : "");
  // 🧭 إعدادات القالب: الصور اللي محتاجها، والشكل والطول والمقاس (بتتحفظ أول ما تدوس)
  function tplPanel(d) {
    const g = d.guide;
    if (!g) return "";
    const ts = { length: g.len, ratio: "", look: "", ...(d.tset || {}) };
    const row = (title, items, attr, cur) => (items.length ? `<div class="flw-tset"><small>${title}</small><div class="flw-langs">${items.map(([v, l]) =>
      `<button type="button" class="flw-chip${String(v) === String(cur) ? " on" : ""}" data-nofx ${attr}="${esc(v)}">${esc(l)}</button>`).join("")}</div></div>` : "");
    const looks = g.looks.map((x) => [x.id, x.label]), lens = g.lens.map((n) => [n, `${n} ثانية`]);
    const ratios = g.ratios.map((r) => [r, { "9:16": "📱 طولي 9:16", "1:1": "⬜ مربع 1:1", "16:9": "🖥️ عرضي 16:9" }[r] || r]);
    return `<div class="flw-tpanel"><h3 class="flw-h3">🧭 إعدادات القالب</h3>
      ${g.refs.length ? `<div class="flw-refs"><small>الصور الذي هذا القالب تحتاجها: ارفع كل واحدة في خانتها وستتسمّى تلقائيًا.</small>
        ${g.refs.map((r) => { const key = refKey(r.name), has = (d.assets || []).some((a) => a.name === key); return `<div class="flw-ref${has ? " ok" : ""}"><i>${has ? "✅" : "🖼️"}</i><div><b>${esc(r.name)}</b>
          <span class="num latin">${esc(r.ratio)}</span><small class="muted">${esc(r.why)}</small></div>
          <label class="flw-link">${has ? "↻ غيّر" : "⬆️ ارفع"}<input type="file" accept="image/*" hidden data-refup="${esc(key)}"></label></div>`; }).join("")}</div>` : ""}
      ${row("شكل الأسلوب", looks, "data-tlook", ts.look || looks[0]?.[0] || "")}
      ${row("طول الفيديو", lens, "data-tlen", ts.length)}${!g.lens.length && g.len ? `<small class="muted">⏱️ طوله ${g.len} ثانية (ثابت هذا للقالب)</small>` : ""}
      ${row("مقاس الفيديو", ratios, "data-tratio", ts.ratio || "9:16")}</div>`;
  }
  const refKey = (n) => n.trim().replace(/\s+/g, "_");
  function tset(k, v) {
    const g = S.d.guide, cur = { length: g.len, ratio: "", look: "", ...(S.d.tset || {}) };
    cur[k] = k === "length" ? +v : v;
    return call("/tset", cur);
  }

  // ---------------------------------------------------------------- 1) الفكرة
  function ideaCard(it) {
    if (S.edit === it.id) return ideaForm(it);
    return `<article class="flw-card${S.seen.has(it.id) ? "" : " in"}" data-cid="${esc(it.id)}"><div class="flw-ch"><b>${esc(it.title)}</b>${rateBtns("idea", it.id)}</div>${algoTags(it)}
      ${it.aud ? `<small class="flw-aud">👥 ${esc(it.aud)}</small>` : ""}<p class="flw-idea">${esc(it.idea)}</p>${it.hook ? `<p class="flw-hook">«${esc(it.hook)}»</p>` : ""}
      ${(it.hooks || []).length || it.pack || it.fit || it.why ? `<details class="flw-more"><summary>التفاصيل (خطافات أخرى، وكيف ماشية على القالب)</summary>${hooksRow(it)}${it.pack && (it.pack.for == null || it.pack.for === it.hook) ? packRow(it.pack) : ""}${it.fit ? `<small class="flw-fit">🎨 على القالب: ${esc(it.fit)}</small>` : ""}${it.why ? `<small class="muted">💡 ${esc(it.why)}</small>` : ""}</details>` : ""}
      <div class="flw-acts"><button type="button" class="flw-btn pri" data-pick-idea="${it.id}">اختر هذه الفكرة</button>
        <button type="button" class="flw-link" data-edit="${it.id}">✏️ عدّل</button>${laterBtn("idea", it.id)}</div></article>`;
  }
  // 🔖 احفظها لبعدين: بتروح مكتبة «محفوظاتك» ومابتتقترحش تاني لحد ما تستخدمها
  function laterBtn(kind, id) {
    const on = (S.d?.saved_ids || []).includes(id);
    return `<button type="button" class="flw-link" data-later="${kind}:${esc(id)}" ${on ? "disabled" : ""}>${on ? "🔖 حُفظت لبعدين" : "🔖 احفظها لبعدين"}</button>`;
  }
  // مكتبة «لبعدين» + ملاحظة لو شلنا اقتراحات شبه اللي اتستخدم قبل كده
  function savedBox(kind, d) {
    const n = kind === "idea" ? d.ideas_repeats : d.scen_repeats;
    const note = n ? `<p class="flw-algo-note">🔁 شلنا ${n} ${kind === "idea" ? "أفكار" : "اقتراحات"} شبه أشياء استخدمتها من قبل، وجبنا غيرها.</p>` : "";
    if (!S.savedOpen) return `${note}<div class="flw-saved"><button type="button" class="flw-link" data-savedopen>🔖 محفوظاتك لبعدين</button></div>`;
    const items = S.saved;
    const row = (x) => `<li><div><b>${x.kind === "idea" ? "💡" : x.kind === "trend" ? "📈" : "🎬"} ${esc(x.title || "بدون عنوان")}</b>
        <small class="muted">${x.kind === "idea" ? "فكرة" : x.kind === "trend" ? "ترند (الأفكار ستُبنى عليه)" : `سيناريو${x.idea_title ? ` لفكرة «${esc(x.idea_title)}»` : ""} · قالب «${esc(x.template?.name || "")}»`}</small>
        ${x.hook ? `<p class="flw-hook">«${esc(x.hook)}»</p>` : ""}${x.text ? `<p>${esc(x.text)}</p>` : ""}</div>
      <div class="flw-acts">${x.here ? `<button type="button" class="flw-btn pri" data-usesaved="${esc(x.id)}" ${S.d.busy ? "disabled" : ""}>استخدمها هنا</button>` : `<small class="muted">تنفع في قالبها فقط</small>`}
        <button type="button" class="flw-link" data-delsaved="${esc(x.id)}">✕ أزلها</button></div></li>`;
    return `${note}<div class="flw-saved open"><div class="flw-ch"><b>🔖 محفوظاتك لبعدين</b><button type="button" class="flw-link" data-savedopen>إخفاء</button></div>
      ${items == null ? working("يجلب المحفوظات…") : items.length ? `<ul>${items.map(row).join("")}</ul>` : `<p class="muted">لا يوجد بعد. أي فكرة أو سيناريو يعجبك ولن تستخدمه الآن، اضغط «🔖 احفظها لبعدين».</p>`}</div>`;
  }
  // ٣ هوكات بدرجات (من قوالب مختلفة): الأعلى هو المختار، والعميل يقدر يبدّل بدوسة
  function hooksRow(it) {
    if (!(it.hooks || []).length) return "";
    return `<div class="flw-hooks">${it.hooks.map((h) => `<button type="button" class="flw-hk${h.text === it.hook ? " on" : ""}" data-hook="${esc(it.id)}" data-text="${esc(h.text)}"
        title="${esc(h.why || "")}"><b class="num">${h.score}</b><span>${esc(h.formula || "خطاف")}</span>${h.principle ? `<small class="flw-psy" title="المبدأ النفسي">🧠 ${esc(h.principle)}</small>` : ""}${h.text === it.hook ? "" : `<i>«${esc(h.text)}»</i>`}</button>`).join("")}</div>`;
  }
  // ⚡ وضع الخوارزمية: الفكرة معلّمة بدايرة الجمهور ومجموعة المواضيع ودرجة HEAT
  function algoTags(it) {
    const h = it.heat;
    if (!h && !it.ring && !it.bucket) return "";
    const names = { h: "فضول الخطاف", e: "لا يوجد ركود", a: "نتيجة في الآخر", t: "relatable", r: "تتكرر" };
    const tip = h ? Object.entries(names).map(([k, t]) => `${t}: ${h[k] ?? "—"}`).join(" · ") : "";
    return `<div class="flw-algo">${h?.avg != null ? `<span class="heat ${h.avg >= 8 ? "hi" : ""}" title="${esc(tip)}">🔥 HEAT ${h.avg}</span>` : ""}
      ${it.ring ? `<span title="دائرة الجمهور (١ الأضيق)">🎯 دائرة ${it.ring}</span>` : ""}${it.bucket ? `<span>🗂 ${esc(it.bucket)}</span>` : ""}</div>`;
  }
  // الهوك التلاتي: نفس المعنى مكتوب ومعروض ومنطوق (أغلب الناس بتتفرج من غير صوت)، وبعده جمل القفل اللي بتمسك المشاهد
  function packRow(p) {
    if (!p) return "";
    const row = (ic, t, v) => (v ? `<div><span>${ic} ${t}</span><b>${esc(v)}</b></div>` : "");
    return `<div class="flw-pack" title="الخطاف التلاتي: يجب التلاتة يقولون نفس المعنى">${row("📝", "على الشاشة", p.screen)}${row("👁", "ما يُرى", p.visual)}${row("🎙", "ما يُقال", p.spoken)}
      ${row("🔒", `بعد الخطاف${p.lockin_method ? ` (${esc(p.lockin_method)})` : ""}`, p.lockin)}</div>`;
  }
  function ideaForm(it = {}) {
    return `<form class="flw-card flw-form" data-ideaform="${esc(it.id || "")}">
      <label>العنوان <input name="title" value="${esc(it.title || "")}" placeholder="عنوان قصير للفكرة"></label>
      <label>الخطاف (أول جملة تشد) <input name="hook" value="${esc(it.hook || "")}"></label>
      <label>الفكرة <textarea name="idea" rows="3" placeholder="احكي الفكرة في سطرين">${esc(it.idea || "")}</textarea></label>
      <div class="flw-acts"><button class="flw-btn pri">اختر هذه</button><button type="button" class="flw-link" data-cancel>إلغاء</button></div></form>`;
  }
  function seasonsRow() {
    const s = S.seasons;
    if (!s) return "";
    if (s.status === "working") return `<div class="flw-seasons"><small class="muted"><span class="flw-spin sm"></span> العقل يُجهّز مناسبات ${esc(s.market || "بلدك")}…</small></div>`;
    if (!(s.items || []).length) return "";
    const fmt = (x) => new Date(x).toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "short" });
    return `<div class="flw-seasons"><small class="muted">🗓️ مناسبات قادمة${s.target ? ` في ${esc(s.target)}` : ""}:</small>
      ${s.items.slice(0, 8).map((x, i) => `<button type="button" class="flw-chip" data-season="${i}" title="${esc(x.angle || "")}">${esc(x.name)} <span class="num">${fmt(x.date)}</span></button>`).join("")}</div>`;
  }
  // 📈 ترند محفوظ من عقل البراند: «تبني الفكرة عليه؟»، واللي اخترت «استخدمه دلوقتي» بيتطبّق لوحده أول ما تفتح القالب
  function trendRow(d) {
    if (S.trendsFor !== d.id) {
      S.trendsFor = d.id; S.trends = null;
      api(`/api/flows/${d.id}/saved`).then((x) => { S.trends = x.filter((i) => i.kind === "trend"); S.mine = x.filter((i) => i.kind === "idea" && i.mine); render(); }).catch(() => { S.trends = []; S.mine = []; });
      return "";
    }
    const list = S.trends || [], now = list.find((x) => x.now);
    if (now && !d.busy && S.trendAuto !== now.id) {
      S.trendAuto = now.id;
      setTimeout(() => call(`/use-saved/${now.id}`).then(() => { S.trendsFor = null; poll(); }), 0);
      return `<div class="flw-trend on"><b>📈 يبني الأفكار على الترند «${esc(now.title)}»…</b></div>`;
    }
    if (d.trend?.title) return `<div class="flw-trend on"><b>📈 هذه الأفكار مبنية على الترند «${esc(d.trend.title)}»</b></div>`;
    if (!list.length) return "";
    return `<div class="flw-trend"><b>📈 لديك ${list.length === 1 ? "ترند محفوظ" : `${list.length} ترند محفوظين`} لبعدين. تبني الفكرة عليه؟</b>
      <div class="flw-acts">${list.slice(0, 3).map((x) => `<button type="button" class="flw-btn" data-usesaved="${esc(x.id)}" title="${esc(x.text || "")}" ${d.busy ? "disabled" : ""}>استخدم «${esc(x.title)}»</button>`).join("")}</div></div>`;
  }
  // 💡 أفكارك من «فولدر الأفكار» (مكتبة محتويات البراند): بتظهر هنا لو حابب تستخدم واحدة
  function mineRow(d) {
    const list = S.trendsFor === d.id ? S.mine || [] : [];
    if (!list.length) return "";
    return `<div class="flw-trend flw-mine"><b>💡 أفكارك الذي في مجلد الأفكار (${list.length}). تستخدم واحدة منهم؟</b>
      <div class="flw-acts">${list.slice(0, 6).map((x) => `<button type="button" class="flw-btn" data-usesaved="${esc(x.id)}" title="${esc([x.text, x.url].filter(Boolean).join("\n"))}" ${d.busy ? "disabled" : ""}>${x.used_at ? "✓ " : ""}«${esc(x.title)}»</button>`).join("")}</div></div>`;
  }
  function stIdea(d) {
    const loading = d.busy === "ideas";
    return `<h2>اختر فكرة للبوست</h2><p class="flw-sub">العقل اقترح أفكار على قدر العلامة والقالب. اختر واحدة، أو عدّلها، أو اطلب غيرهم، أو اكتب فكرتك.</p>
      ${isPhone(d) ? `<div class="flw-skip"><button type="button" class="flw-btn" data-skipshoot>⏭ عندي الفيديو الخاص بي، على الرفع مباشرة</button></div>` : ""}${tipBox(d.guide?.idea)}${seasonsRow()}
      ${d.algo_mode && (d.ideas_dropped || []).length ? `<p class="flw-algo-note" title="${esc(d.ideas_dropped.map((x) => `«${x.title}»: ${x.why_out}`).join("\n"))}">⚡ وضع الخوارزمية شال ${d.ideas_dropped.length} ${d.ideas_dropped.length === 1 ? "فكرة ضعيفة" : "أفكار ضعيفة"} وجاب غيرها (ضع الماوس ترى له)</p>` : ""}
      ${trendRow(d)}${mineRow(d)}${savedBox("idea", d)}<div class="flw-cards">${(d.ideas || []).map(ideaCard).join("")}${S.own ? ideaForm() : ""}</div>
      ${loading ? working("العقل يفكّر في أفكار على القالب…") : failed("idea")}
      <div class="flw-more">${S.hint ? `<div class="flw-chatrow"><input id="flwHint" placeholder="تريد أفكار عن ماذا؟ (اختياري)"><button type="button" class="flw-btn" data-more="idea">اقترح</button></div>` : `
        <button type="button" class="flw-btn" data-more="idea" ${loading ? "disabled" : ""}>💡 اقترح أفكار أخرى</button>
        <button type="button" class="flw-link" data-hint>🎯 وجّه العقل</button>`}
        <button type="button" class="flw-link" data-own>✍️ اكتب فكرتك</button></div>`;
  }

  // ---------------------------------------------------------------- 2) نوع البوست
  function stFormat(d) {
    const f = S.fmt || d.format || "reel";
    return `${picked("idea")}<h2>نوع المنشور</h2>
      <div class="flw-fmts">${Object.entries(FMT).map(([k, [ic, t, s]]) => `<button type="button" class="flw-fmt${f === k ? " on" : ""}" data-fmt="${k}"><i>${ic}</i><b>${t}</b><small>${s}</small></button>`).join("")}</div>
      ${f === "series" ? `<div class="flw-eps"><b>عدد الحلقات</b><div>${["auto", 2, 3, 4, 5, 6, 7, 8, 10].map((n) => `<button type="button" class="flw-chip${String(S.eps || d.episodes || "auto") === String(n) ? " on" : ""}" data-eps="${n}">${n === "auto" ? "✨ تلقائي (العقل يقرر)" : n}</button>`).join("")}</div></div>` : ""}
      <div class="flw-acts end"><button type="button" class="flw-btn pri big" data-setfmt ${d.busy ? "disabled" : ""}>أكمل للسيناريو ←</button></div>`;
  }

  // ---------------------------------------------------------------- 3) السيناريو
  function scenBody(sc, fmt) {
    if (fmt === "carousel") return `<ol class="flw-beats">${(sc.slides || []).map((s) => `<li><b>${esc(s.heading)}</b> ${esc(s.text)}${s.visual ? `<small class="muted">🖼️ ${esc(s.visual)}</small>` : ""}</li>`).join("")}</ol>`;
    if (fmt === "series") return `<ol class="flw-beats">${(sc.episodes || []).map((e) => `<li><b>${esc(e.title)}</b> ${esc((e.beats || []).join(" ← "))}</li>`).join("")}</ol>`;
    return `<ol class="flw-beats">${(sc.beats || []).map((b) => `<li><span class="num">${esc(b.t || "")}</span> ${esc(b.what)}${b.say ? `<em>«${esc(b.say)}»</em>` : ""}${b.text ? `<small class="muted">📝 ${esc(b.text)}</small>` : ""}</li>`).join("")}</ol>`;
  }
  // تعديل السيناريو بإيده: خانات لكل مشهد / سلايد / حلقة
  const COLS = {
    reel: [["what", "ما يحدث"], ["say", "النص المسموع"], ["text", "على الشاشة"]],
    carousel: [["heading", "العنوان"], ["text", "النص"], ["visual", "الصورة"]],
    series: [["title", "اسم الحلقة"], ["beats", "الأحداث (سطر لكل حدث)"], ["voice", "جمل الصوت (سطر لكل جملة)"]],
  };
  const ROWS = { reel: ["beats", "المشهد"], carousel: ["slides", "السلايد"], series: ["episodes", "الحلقة"] };
  function rowHTML(r, fmt, i) {
    const cell = ([k, l]) => fmt === "series" && k !== "title"
      ? `<label>${l}<textarea data-k="${k}" rows="2" dir="auto">${esc((r[k] || []).join("\n"))}</textarea></label>`
      : `<label>${l}<input data-k="${k}" value="${esc(r[k] || "")}" dir="auto"></label>`;
    return `<div class="flw-row"><b class="num">${ROWS[fmt][1]} ${i + 1}</b><div>${COLS[fmt].map(cell).join("")}</div><button type="button" class="flw-x" data-rowdel title="احذف">✕</button></div>`;
  }
  function rowsFrom(form, fmt) {
    const out = [...form.querySelectorAll(".flw-row")].map((row, i) => {
      const r = {};
      row.querySelectorAll("[data-k]").forEach((el) => {
        r[el.dataset.k] = fmt === "series" && el.dataset.k !== "title" ? el.value.split("\n").map((x) => x.trim()).filter(Boolean) : el.value.trim();
      });
      if (fmt === "reel") r.t = `${i + 1}`;
      else r.n = i + 1;
      return r;
    }).filter((r) => Object.values(r).some((v) => (Array.isArray(v) ? v.length : v && !/^\d+$/.test(v))));
    return { [ROWS[fmt][0]]: out };
  }
  function scenForm(sc, fmt) {
    const rows = sc[ROWS[fmt][0]] || [{}, {}, {}];
    return `<form class="flw-card flw-form flw-wideform" data-scenform="${esc(sc.id || "")}">
      <label>العنوان <input name="title" value="${esc(sc.title || "")}"></label>
      <label>الملخص <textarea name="summary" rows="2">${esc(sc.summary || "")}</textarea></label>
      <div class="flw-rows">${rows.map((r, i) => rowHTML(r, fmt, i)).join("")}</div>
      <button type="button" class="flw-link" data-rowadd>+ أضف ${ROWS[fmt][1]}</button>
      <label>التعليق النصي <input name="caption" value="${esc(sc.caption || "")}"></label>
      <div class="flw-acts"><button class="flw-btn pri">اختر هذا</button><button type="button" class="flw-link" data-cancel>إلغاء</button></div></form>`;
  }
  // ⚡ السيناريو اتفحص بالـ ١٥ بند واتصلّح قبل ما يظهر: درجته واللي اتغيّر
  function scenAlgo(a) {
    if (!a || a.score == null) return "";
    return `<details class="flw-scal"><summary><span class="heat ${a.score >= 85 ? "hi" : ""}">⚡ ${a.score}/100</span> ${a.fixes.length ? `أُصلح فيه ${a.fixes.length} ${a.fixes.length === 1 ? "شيء" : "أشياء"}` : "فُحص ولا أحتاج تصليح"}</summary>
      ${a.fixes.length ? `<ul>${a.fixes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</details>`;
  }
  function scenCard(sc, fmt) {
    if (S.edit === sc.id) return scenForm(sc, fmt);
    return `<article class="flw-card${S.seen.has(sc.id) ? "" : " in"}" data-cid="${esc(sc.id)}"><div class="flw-ch"><b>${esc(sc.title)}</b>${rateBtns("scenario", sc.id)}</div>
      ${scenAlgo(sc.algo)}${sc.summary ? `<p>${esc(sc.summary)}</p>` : ""}${scenBody(sc, fmt)}${sc.caption ? `<small class="muted">✍️ ${esc(sc.caption)}</small>` : ""}
      <div class="flw-acts"><button type="button" class="flw-btn pri" data-pick-scen="${sc.id}">اختر هذا السيناريو</button>
        <button type="button" class="flw-link" data-edit="${sc.id}">✏️ عدّل</button>${laterBtn("scenario", sc.id)}</div></article>`;
  }
  function stScenario(d) {
    const loading = d.busy === "scenarios";
    const eps = d.format === "series" ? ` · ${d.episodes === "auto" ? "عدد الحلقات تلقائي" : `${d.episodes} حلقات`}` : "";
    const skipS = isPhone(d) ? `<div class="flw-skip"><button type="button" class="flw-btn" data-skipshoot>⏭ عندي الفيديو الخاص بي، على الرفع مباشرة</button></div>` : "";
    return `${picked("idea")}<h2>اختر السيناريو</h2><p class="flw-sub">${FMT[d.format]?.[0] || ""} ${FMT[d.format]?.[1] || ""}${eps}${isPhone(d) ? "" : ` — <button type="button" class="flw-link" data-go="format">غيّر النوع</button>`}</p>${skipS}
      ${tipBox(d.guide?.scen)}${savedBox("scenario", d)}<div class="flw-cards wide">${(d.scenarios || []).map((s) => scenCard(s, d.format)).join("")}${S.own ? scenForm({}, d.format) : ""}</div>
      ${loading ? working("العقل يكتب السيناريوهات…") : failed("scen")}
      <div class="flw-more">${S.hint ? `<div class="flw-chatrow"><input id="flwHint" placeholder="تريد السيناريو يصبح كيف؟ (اختياري)"><button type="button" class="flw-btn" data-more="scen">اقترح</button></div>` : `
        <button type="button" class="flw-btn" data-more="scen" ${loading ? "disabled" : ""}>💡 اقترح سيناريوهات أخرى</button>
        <button type="button" class="flw-link" data-hint>🎯 وجّه العقل</button>`}
        <button type="button" class="flw-link" data-own>✍️ اكتب السيناريو بنفسك</button></div>`;
  }

  // ---------------------------------------------------------------- 🎙️ قالب كود: السكريبت على مشاهد القالب
  // كل مشهد: جملة فويس أوفر (وجنبها هتاخد قد إيه مقارنة بطول المشهد) + الكلام اللي بيظهر في خانات المشهد
  const sec = (txt, cps) => (txt ? Math.round((String(txt).replace(/\s+/g, " ").trim().length / cps) * 10) / 10 : 0);
  function sayBadge(say, scn, ml) {
    if (!say) return `<small class="flw-sec muted">بدون نص</small>`;
    const L = scn.t1 - scn.t0, need = sec(say, ml.cps), over = need > L * ml.max_stretch;
    return `<small class="flw-sec ${over ? "bad" : need > L ? "warn" : ""}" title="طول المشهد الأصلي ${L.toFixed(1)} ثانية">
      ⏱ <span class="num">${need}</span> ث من <span class="num">${L.toFixed(1)}</span>${over ? " · طويلة: المشهد سيقف ثابت قليلًا، قصّرها" : need > L ? " · المشهد سيُبطئ قليلًا" : ""}</small>`;
  }
  const fieldVal = (v) => (Array.isArray(v) ? v.join(" · ") : String(v ?? ""));
  function scriptBody(sc, ml) {
    return `<ol class="flw-beats flw-sbeats">${(sc.scenes || []).map((r, i) => { const scn = ml.scenes[i] || { t0: 0, t1: 1 }; return `<li>
      <b class="flw-scn">${esc(r.scene)}</b>${r.say ? `<em>🎙 «${esc(r.say)}»</em>` : ""}${sayBadge(r.say, scn, ml)}
      ${Object.entries(r.fields || {}).map(([k, v]) => `<small class="muted">📝 ${esc(ml.fields[k]?.label || k)}: ${esc(fieldVal(v))}</small>`).join("")}</li>`; }).join("")}</ol>`;
  }
  function scriptForm(sc, ml) {
    const rows = ml.scenes.map((scn, i) => (sc.scenes || [])[i] || { scene: scn.name, say: "", fields: {} });
    return `<form class="flw-card flw-form flw-wideform" data-scriptform="${esc(sc.id || "")}">
      <label>العنوان <input name="title" value="${esc(sc.title || "")}"></label>
      ${rows.map((r, i) => `<fieldset class="flw-srow" data-si="${i}"><legend>${esc(ml.scenes[i].name)} <small class="muted num">${(ml.scenes[i].t1 - ml.scenes[i].t0).toFixed(1)} ث</small></legend>
        <label>🎙 التعليق الصوتي <textarea data-say rows="2" dir="auto">${esc(r.say || "")}</textarea></label>
        ${Object.entries(r.fields || {}).map(([k, v]) => `<label>📝 ${esc(ml.fields[k]?.label || k)}${ml.fields[k]?.kind === "lines"
          ? `<textarea data-fk="${esc(k)}" data-lines rows="3" dir="auto">${esc((Array.isArray(v) ? v : String(v || "").split("\n")).join("\n"))}</textarea>`
          : `<input data-fk="${esc(k)}" value="${esc(fieldVal(v))}" dir="auto">`}</label>`).join("")}</fieldset>`).join("")}
      <label>التعليق النصي <input name="caption" value="${esc(sc.caption || "")}"></label>
      <div class="flw-acts"><button class="flw-btn pri">اختر هذا</button><button type="button" class="flw-link" data-cancel>إلغاء</button></div></form>`;
  }
  function scriptFrom(form, ml) {
    const base = (S.d.scenarios || []).find((x) => x.id === form.dataset.scriptform) || S.d.scenario || {};
    return {
      id: form.dataset.scriptform || "", title: form.querySelector("[name=title]").value.trim(), caption: form.querySelector("[name=caption]").value.trim(), summary: base.summary || "",
      scenes: [...form.querySelectorAll(".flw-srow")].map((fs, i) => ({ scene: ml.scenes[i].name, say: fs.querySelector("[data-say]").value.trim(),
        fields: Object.fromEntries([...fs.querySelectorAll("[data-fk]")].map((el) => [el.dataset.fk, el.hasAttribute("data-lines") ? el.value.split("\n").map((x) => x.trim()).filter(Boolean) : el.value.trim()])) })),
    };
  }
  function scriptCard(sc, ml) {
    if (S.edit === sc.id) return scriptForm(sc, ml);
    const total = (sc.scenes || []).reduce((a, r, i) => a + Math.max(sec(r.say, ml.cps), ml.scenes[i] ? (ml.scenes[i].t1 - ml.scenes[i].t0) / ml.max_stretch : 0), 0);
    return `<article class="flw-card${S.seen.has(sc.id) ? "" : " in"}" data-cid="${esc(sc.id)}"><div class="flw-ch"><b>${esc(sc.title)}</b>${rateBtns("scenario", sc.id)}</div>
      ${sc.summary ? `<p>${esc(sc.summary)}</p>` : ""}${scriptBody(sc, ml)}
      <small class="muted">⏱ الفيديو سيصبح نحو <span class="num">${Math.round(total)}</span> ثانية بالفويس أوفر (القالب الأصلي <span class="num">${Math.round(ml.DUR)}</span>)</small>
      ${sc.caption ? `<small class="muted">✍️ ${esc(sc.caption)}</small>` : ""}
      <div class="flw-acts"><button type="button" class="flw-btn pri" data-pick-scen="${sc.id}">اختر هذا النص</button>
        <button type="button" class="flw-link" data-edit="${sc.id}">✏️ عدّل</button>${laterBtn("scenario", sc.id)}</div></article>`;
  }
  function stScript(d) {
    const ml = d.mlive, loading = d.busy === "scenarios";
    if (!ml) return `${picked("idea")}<div class="flw-empty bad">تعذّرت قراءة مشاهد القالب.</div>`;
    if (!S.vopts) loadVoice();
    const langs = (S.vopts?.dialects || []).filter((x) => x.group === "ar");
    const cur = d.lang || S.vopts?.pick?.lang;
    return `${picked("idea")}<h2>النص على مشاهد القالب</h2>
      <p class="flw-sub">لكل مشهد جملة تعليق صوتي والنص الذي يظهر فيه. المشهد يأخذ طول جملته، فاجعل الجمل قريبة من طول المشهد (بجانب كل جملة ستأخذ قدر ماذا).</p>
      ${langs.length ? `<div class="flw-tset"><small>لهجة التعليق الصوتي (النص يُكتب بها):</small><div class="flw-langs">${langs.map((x) => `<button type="button" class="flw-chip${x.id === cur ? " on" : ""}" data-slang="${esc(x.id)}" ${loading ? "disabled" : ""}>${esc(x.label)}</button>`).join("")}</div></div>` : ""}
      ${savedBox("scenario", d)}<div class="flw-cards wide">${(d.scenarios || []).map((s) => scriptCard(s, ml)).join("")}</div>
      ${loading ? working("العقل يكتب النص على مشاهد القالب…") : failed("scen")}
      <div class="flw-more">${S.hint ? `<div class="flw-chatrow"><input id="flwHint" placeholder="تريد النص يصبح كيف؟ (اختياري)"><button type="button" class="flw-btn" data-more="scen">اقترح</button></div>` : `
        <button type="button" class="flw-btn" data-more="scen" ${loading ? "disabled" : ""}>💡 اقترح نصوص أخرى</button>
        <button type="button" class="flw-link" data-hint>🎯 وجّه العقل</button>`}</div>`;
  }
  // 🎛️ لوحة التحكم: طول كل مشهد على قد الصوت، والفويس أوفر، وزرار يفتح لوحة القالب نفسها (المعاينة والخانات)
  function stPanel(d) {
    const ml = d.mlive || { scenes: [] }, vt = d.vo_track, t = vt?.timing;
    const rows = ml.scenes.map((s, i) => { const L = s.t1 - s.t0, n = t ? t[i] : L; return `<li><b>${esc(s.name)}</b><span class="num">${L.toFixed(1)}</span>${t ? ` ← <span class="num ${n > L * (ml.max_stretch || 1.5) ? "warn" : ""}">${n.toFixed(1)}</span>` : ""} ث</li>`; }).join("");
    return `${picked("scenario")}<h2>لوحة التحكم</h2>
      <p class="flw-sub">${vt ? "المشاهد ضُبطت على التعليق الصوتي: كل مشهد يأخذ طول جملته." : "بدون تعليق صوتي: المشاهد بطولها الأصلي."} افتح لوحة القالب ترى الفيديو بالصوت وتضبط النص والألوان والخطوط والصور، ثم صدّر.</p>
      ${d.vo_url ? `<audio class="flw-vo" src="${esc(d.vo_url)}" controls preload="metadata"></audio>` : ""}
      <ol class="flw-times">${rows}</ol>${vt ? `<small class="muted">⏱ الفيديو <span class="num">${vt.total.toFixed(1)}</span> ثانية</small>` : ""}
      <div class="flw-acts end"><button type="button" class="flw-btn big" data-panel>🎛️ افتح لوحة القالب</button>
        <button type="button" class="flw-btn pri big" data-export ${d.busy ? "disabled" : ""}>🎬 صدّر الفيديو<small class="flw-cost">بدون نقاط</small></button></div>
      <div class="flw-more"><button type="button" class="flw-link" data-go="voice">↩︎ غيّر الصوت</button><button type="button" class="flw-link" data-go="scenario">↩︎ غيّر النص</button></div>`;
  }

  // ---------------------------------------------------------------- 4) الأبطال
  function stCast(d) {
    const opts = S.castOpts;
    if (!opts) { loadCast(); return `${picked("scenario")}${working("بجيب الشخصيات…")}`; }
    S.cast ??= (d.cast || []).map((c) => c.id);
    return `${picked("scenario")}<h2>من أبطال المنشور؟</h2><p class="flw-sub">اختر من شخصيات العلامة الذي في العقل (يمكنك تختار أكثر من واحدة أو ولا واحدة).</p>
      ${opts.length ? `<div class="flw-cast">${opts.map((o) => `<button type="button" class="flw-person${S.cast.includes(o.id) ? " on" : ""}" data-person="${esc(o.id)}">
        <img src="${esc(o.image_url)}" alt="" loading="lazy"><b>${esc(o.name)}</b>${o.about ? `<small>${esc(o.about.slice(0, 70))}</small>` : ""}</button>`).join("")}</div>`
        : `<div class="flw-empty">لا يوجد بعد شخصيات في العقل. أضفها من «الشخصيات» أو من عقل العلامة، أو أكمل بدون أبطال.</div>`}
      <div class="flw-acts end"><button type="button" class="flw-btn pri big" data-setcast>${S.cast.length ? `أكمل بـ ${S.cast.length} ${S.cast.length === 1 ? "بطل" : "أبطال"}` : "أكمل بدون أبطال"} ←</button></div>`;
  }
  async function loadCast() {
    if (S.castLoading) return;
    S.castLoading = true;
    try { S.castOpts = await api(`/api/flows/${S.d.id}/cast-options`); } catch (err) { S.castOpts = []; toast(err.message, true); }
    S.castLoading = false;
    render();
  }

  // ---------------------------------------------------------------- 🎙️ الصوت: مين بيتكلم، وبأي لهجة، وبأي صوت
  function stVoice(d) {
    if (d.busy === "vo") return `${picked("scenario")}${working("يسجّل التعليق الصوتي كله مرة واحدة، ويسمعه لكي يعرف كل جملة تبدأ وتنتهي أين ويضبط المشاهد عليها…")}`;
    const o = S.vopts;
    if (!o) { loadVoice(); return `${picked("scenario")}${working("بجيب الأصوات…")}`; }
    S.vo ??= { ...o.pick };
    const v = S.vo, on = v.speaker !== "none";
    const voices = o.voices[v.lang] || [];
    if (!voices.some((x) => x.id === v.voice)) v.voice = voices[0]?.id || "";
    const grp = (g) => o.dialects.filter((x) => x.group === g).map((x) => `<button type="button" class="flw-chip${x.id === v.lang ? " on" : ""}" data-vlang="${esc(x.id)}">${esc(x.label)}</button>`).join("");
    return `${picked("scenario")}<h2>من الذي يتكلم؟</h2><p class="flw-sub">اختر صاحب الصوت، ثم اللهجة والصوت الذي سيُقال به النص.</p>
      <div class="flw-spk">${o.speakers.map((s) => `<button type="button" class="flw-person sm${s.id === v.speaker ? " on" : ""}" data-vspk="${esc(s.id)}">
        ${s.image_url ? `<img src="${esc(s.image_url)}" alt="" loading="lazy">` : `<i>${s.id === "none" ? "🔇" : "🎙️"}</i>`}<b>${esc(s.name)}</b><small>${esc(s.about || "")}</small></button>`).join("")}</div>
      ${on ? `<h3 class="flw-h3">اللهجة</h3><div class="flw-langs">${grp("ar")}</div><div class="flw-langs">${grp("foreign")}</div>
        ${!o.fasih && o.dialects.find((x) => x.id === v.lang)?.group === "ar" ? `<div class="flw-empty bad">الأصوات العربية غير متاحة الآن، وفريقنا يعمل على إصلاحها.</div>` : ""}
        <h3 class="flw-h3">الصوت</h3><div class="flw-voices">${voices.map((x) => `<div class="flw-voice${x.id === v.voice ? " on" : ""}">
          <button type="button" class="flw-vpick" data-nofx data-vvoice="${esc(x.id)}"><i>${x.gender === "female" ? "👩" : "👨"}</i><b>${esc(x.label)}</b></button>
          ${o.voices[v.lang] && o.fasih && /^ar-/.test(x.id) ? `<button type="button" class="flw-vplay" data-nofx data-vplay="${esc(x.id)}" title="اسمع عينة">${S.vplay === x.id ? "⏳" : "▶"}</button>` : ""}</div>`).join("")}</div>` : ""}
      ${isCode(d) ? failed("vo") : ""}
      <div class="flw-acts end"><button type="button" class="flw-btn pri big" data-setvoice>${isCode(d) && on ? `🎙️ سجّل التعليق الصوتي واضبط المشاهد ←${costTag(voices.find((x) => x.id === v.voice)?.pts, o.balance)}` : "أكمل ←"}</button></div>`;
  }
  async function loadVoice() {
    if (S.vLoading) return;
    S.vLoading = true;
    try { S.vopts = await api(`/api/flows/${S.d.id}/voice-options`); } catch (err) { toast(err.message, true); S.vopts = null; S.vLoading = false; return; }
    S.vLoading = false;
    render();
  }
  async function playSample(id) {
    const cached = (S.vopts.voices[S.vo.lang] || []).find((x) => x.id === id)?.sample;
    let url = cached;
    if (!url) {
      S.vplay = id; render();
      try { url = (await api("/api/voice-sample", { method: "POST", ...J({ voice: id }) })).url; } catch (err) { toast(err.message, true); }
      S.vplay = null; render();
      if (!url) return;
      const it = (S.vopts.voices[S.vo.lang] || []).find((x) => x.id === id); if (it) it.sample = url;
    }
    S.audio?.pause(); S.audio = new Audio(url); S.audio.play().catch(() => {});
  }

  // ---------------------------------------------------------------- 5) الملفات
  function assetTile(a) {
    const media = a.kind === "فيديو" ? `<video src="${esc(a.url)}" muted playsinline preload="metadata"></video>` : `<img src="${esc(a.url)}" alt="" loading="lazy">`;
    return `<div class="flw-asset">${media}<label class="latin">@<input data-aname="${esc(a.file)}" value="${esc(a.name)}" dir="auto"></label>
      <button type="button" class="flw-x" data-adel="${esc(a.file)}" title="احذف">✕</button></div>`;
  }
  function stAssets(d) {
    return `${picked("scenario")}<h2>ارفع ملفاتك</h2><p class="flw-sub">صور منتج، شعار، لقطات… كل ملف له اسم، ويمكنك تعمل له إشارة <b class="latin">@اسمه</b> في الوصف لكي العقل يستخدمه في المكان الصحيح.</p>
      <label class="flw-drop"><input type="file" id="flwFiles" accept="image/*,video/*" multiple hidden><i>⬆️</i><b>اضغط أو اسحب الملفات هنا</b><small class="muted">صور أو فيديوهات، حتى ١٠ مرة واحدة</small></label>
      ${(d.assets || []).length ? `<div class="flw-assets">${d.assets.map(assetTile).join("")}</div>` : ""}
      ${tplPanel(d)}
      <div class="flw-acts end"><button type="button" class="flw-btn pri big" data-go="generate">${(d.assets || []).length ? "أكمل" : "أكمل بدون ملفات"} ←</button></div>`;
  }

  // ---------------------------------------------------------------- 6) التوليد والنتيجة
  function stGenerate(d) {
    if (d.template.kind === "typo") {   // تايبوجرافي: النص فقط، والحركة والتوقيت في قسم التايبوجرافي
      return `<h2>جاهز للتوليد</h2>${d.error ? `<div class="flw-empty bad">⚠️ ${esc(d.error)}</div>` : ""}
        <div class="flw-sum"><div><small>القالب</small><b>${esc(d.template.name)}</b></div><div><small>الفكرة</small><b>${esc(d.idea?.title || "")}</b></div>
          <div><small>النص</small><b>${esc(d.scenario?.title || "")}</b></div></div>
        <p class="muted">النص سيوضع في التايبوجرافي، وسناك تختار الشكل والصوت وتصدّر الفيديو.</p>
        <div class="flw-acts end"><button type="button" class="flw-btn pri big" data-gen ${d.busy ? "disabled" : ""}>🚀 ولّد</button></div>`;
    }
    const fmt = FMT[d.format] || FMT.reel;
    return `<h2>جاهز للتوليد</h2>${d.error ? `<div class="flw-empty bad">⚠️ ${esc(d.error)}</div>` : ""}
      <div class="flw-sum">
        <div><small>القالب</small><b>${esc(d.template.name)}</b></div><div><small>النوع</small><b>${fmt[0]} ${fmt[1]}</b></div>
        <div><small>الفكرة</small><b>${esc(d.idea?.title || "")}</b></div><div><small>السيناريو</small><b>${esc(d.scenario?.title || "")}</b></div>
        <div><small>الأبطال</small><b>${(d.cast || []).map((c) => esc(c.name)).join("، ") || "—"}</b></div><div><small>الملفات</small><b>${(d.assets || []).length || "—"}</b></div></div>
      <label class="flw-prompt"><b>توجيهات للتوليد (اختياري)</b>
        <textarea id="flwPrompt" rows="4" dir="auto" placeholder="مثلًا: افتح بـ @${esc(d.assets?.[0]?.name || "المنتج")} قريب، والألوان دافية، والختام بالعرض">${esc(d.prompt || "")}</textarea></label>
      ${(d.assets || []).length ? `<div class="flw-ment"><small class="muted">اضغط لكي تعمل إشارة:</small>${d.assets.map((a) => `<button type="button" class="flw-chip" data-ment="${esc(a.name)}">@${esc(a.name)}</button>`).join("")}</div>` : ""}
      <div class="flw-acts end"><button type="button" class="flw-btn pri big" data-gen ${d.busy ? "disabled" : ""}>🚀 ولّد</button></div>`;
  }
  function stDone(d) {
    const o = d.output || {};
    const isWork = o.status === "working" || d.busy === "generate";
    const pct = o.progress ? ` ${Math.round(o.progress * 100)}٪` : "";
    const rated = (d.ratings || {})["output:final"];
    return `<h2>${isWork ? "جارٍ التوليد…" : o.status === "failed" ? "التوليد توقف" : "خلص! 🎉"}</h2>
      ${isWork ? working(`العقل يبني ${OUT[o.kind] ? `في ${OUT[o.kind]}` : "المنشور"}${pct}`) : ""}
      ${o.status === "failed" || d.error ? `<div class="flw-empty bad">⚠️ ${esc(o.error || d.error || "")}</div>` : ""}
      ${o.video_url ? `<video class="flw-out" src="${esc(o.video_url)}" controls playsinline autoplay loop></video>` : ""}
      ${!isWork && o.kind ? `<div class="flw-done">
        ${o.kind !== "motion" ? `<p>${o.kind === "tvideo" ? "الفيديو جُهّز في قسم القوالب بالسيناريو والتوجيهات الخاصة بك، أكمل هناك (الصوت والستوري بورد والتوليد)." : o.kind === "series" ? `المسلسل أُنشئ بـ ${(o.episodes || []).length} حلقات والنص جاهز في كل حلقة.` : o.kind === "carousel" ? "الكاروسيل أُنشئ بالسلايدز والنص." : "الفيديو جُهّز في التايبوجرافي."}</p>
          <button type="button" class="flw-btn pri big" data-openout>افتح في ${OUT[o.kind]} ←</button>` : o.video_url ? `<a class="flw-btn" href="${esc(o.video_url)}" download>⬇️ نزّل الفيديو</a>` : ""}
        <div class="flw-final"><b>عجبك الناتج؟</b> ${rateBtns("output", "")}<small class="muted">${rated ? "سُجّل في العقل ✓" : "تقييمك يعلّم العقل ذوقك"}</small></div>
        ${rated === -1 ? `<div class="flw-chatrow"><input id="flwWhy" placeholder="ماذا الذي لم يعجبك؟ (العقل سيتذكره)"><button type="button" class="flw-btn" data-why-send>سجّل</button></div>` : ""}
        <button type="button" class="flw-link" data-go="scenario">↩︎ جرّب سيناريو آخر</button></div>` : ""}`;
  }

  // ---------------------------------------------------------------- 📱 تصوير بالموبايل
  const secs = (x) => `${Math.floor((x || 0) / 60)}:${String(Math.round((x || 0) % 60)).padStart(2, "0")}`;
  function libBox(role) {
    if (S.lib?.role !== role) return "";
    const items = S.lib.items;
    return `<div class="flw-lib">${items == null ? working("يجلب فيديوهاتك…") : items.length ? items.map((x) => `<button type="button" class="flw-libit" data-libpick="${esc(x.gen_id)}">
      <video src="${esc(x.url)}#t=0.5" muted preload="metadata"></video><small>${esc(x.name)}</small></button>`).join("") : `<p class="muted">لا يوجد بعد فيديوهات مرفوعة.</p>`}</div>`;
  }
  function stShoot(d) {
    const f = d.footage || {}, mn = f.main, sc = d.scenario;
    const beats = (sc?.beats || []).map((b, i) => `<li><b class="num">${i + 1}</b><span dir="auto">${esc(b.say || b.text || "")}</span>${b.visual ? `<small class="muted">🎥 ${esc(b.visual)}</small>` : ""}</li>`).join("");
    return `<h2>الفيديو</h2><p class="flw-sub">صوّر نفسك بالجوال وأنت تتكلم (طولي، والضوء قدامك)، وارفعه. لقطات الـ B-roll البرنامج يعملها تلقائيًا في المونتاج.</p>
      ${beats ? `<details class="flw-shotlist" open><summary>📝 النص الذي ستقوله</summary><ol>${beats}</ol></details>` : ""}
      <div class="flw-ph">
        <section><h3>🎙️ الفيديو (أنت تتكلم)</h3>
          ${mn ? `<div class="flw-main-v"><video src="${esc(mn.url)}" controls playsinline preload="metadata"></video>
            <small class="muted">${esc(mn.name)} · ${secs(mn.duration)} · ${mn.w}×${mn.h}${mn.audio ? "" : " · ⚠️ بدون صوت"}</small>
            <button type="button" class="flw-link" data-fdel="${esc(mn.gen_id)}">بدّله</button></div>`
          : `<div class="flw-acts">${beats ? `<button type="button" class="flw-btn pri" data-phone>📱 صوّر من موبايلك بالتيلي برومبتر</button>` : ""}<label class="flw-btn ${beats ? "" : "pri"}">⬆ ارفع فيديو جديد<input type="file" accept="video/*" data-phup="main" hidden></label>
              <button type="button" class="flw-btn" data-lib="main">☁️ أو اختر مما رفعته من قبل</button></div>${libBox("main")}`}
          ${(f.broll || []).length ? `<div class="flw-broll">${f.broll.map((x) => `<figure><video src="${esc(x.url)}#t=0.5" muted preload="metadata"></video><button type="button" data-fdel="${esc(x.gen_id)}" title="أزلها">✕</button></figure>`).join("")}</div>` : ""}</section>
        ${castBox(d)}</div>
      ${d.busy === "upload" ? working("جارٍ الرفع…") : failed("shoot")}
      ${mn ? `<div class="flw-acts end"><button type="button" class="flw-link" data-automont>⏭ على المونتاج مباشرة</button>
        <button type="button" class="flw-btn pri big" data-phreview ${d.busy ? "disabled" : ""}>🔎 راجع الفيديو وقولّي أحسّن ماذا</button></div>` : ""}`;
  }
  // 🪞 مين في الفيديو وصوّر فين: عشان لقطات الـ B-roll اللي فيها الشخص تطلع بنفس الوش ونفس المكان
  function castBox(d) {
    if (S.twins === undefined) {
      S.twins = null;
      api("/api/twins").then((t) => { S.twins = t; render(); }).catch(() => { S.twins = []; render(); });
    }
    const twins = (S.twins || []).filter((t) => t.ready?.photos), cast = d.phone_cast;
    if (!cast && twins.length && !S.castAuto) {   // أول مرة: أول نسخة جاهزة هي الاختيار
      S.castAuto = true;
      call("/phone-cast", { twin: twins[0].id, bg: "" });
    }
    const tw = twins.find((t) => t.id === cast?.twin);
    const bgs = tw?.backgrounds || [];
    const auto = `<p class="muted">🪄 الـ B-roll تلقائي: اللقطات التي يجب تظهر فيها تُنشأ بالأفاتار${tw ? " في نفس المكان" : ""}، واللي ليس ضروريًا تأتي من فيديوهات ستوك حقيقية. وفي المونتاج يمكنك تزيل أي لقطة أو تبدّلها بفيديو من جهازك.</p>`;
    if (S.twins === null) return `<section><h3>🪞 من في الفيديو؟</h3>${working("يجلب الأفاتار…")}</section>`;
    if (!twins.length) return `<section><h3>🪞 من في الفيديو؟</h3><p class="muted">إذا عملت أفاتار في «🪞 الأفاتار» (فيديو وصور من كذا اتجاه)، البرنامج يستطيع يعمل لقطات B-roll به. من غيرها سيستخدم فيديوهات ستوك فقط.</p>
      <button type="button" class="flw-link" data-gotwin>🪞 أنشئ أفاتار</button>${auto}</section>`;
    return `<section><h3>🪞 من في الفيديو؟</h3>
      <label class="flw-csel"><select data-casttwin><option value="">بدون أفاتار (ستوك فقط)</option>
        ${twins.map((t) => `<option value="${esc(t.id)}" ${cast?.twin === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
      ${tw ? `<h4>🏠 صوّرت أين؟</h4><div class="flw-bgs">
        <button type="button" class="flw-bgit ${!cast.bg ? "on" : ""}" data-castbg=""><span>🎬</span><small>مثل الفيديو نفسه</small></button>
        ${bgs.map((b) => `<button type="button" class="flw-bgit ${cast.bg === b.id ? "on" : ""}" data-castbg="${esc(b.id)}"><img src="${esc(b.url)}" alt=""><small>${esc(b.name || "مكان")}</small></button>`).join("")}
        <button type="button" class="flw-bgit add" data-gotwin><span>＋</span><small>أضف مكان</small></button></div>` : ""}
      ${auto}</section>`;
  }
  function stReview(d) {
    const r = d.review;
    if (d.busy === "review" || !r) return `<h2>الملاحظات</h2>${d.busy === "review" ? working("البرنامج يشاهد الفيديو ويسمع النص ويقارنه بقواعد الخوارزميات…") : failed("review")}`;
    const mt = r.metrics || {}, note = (n) => `<li class="${n.level}"><div><b>${n.level === "must" ? "🔴" : "🟡"} ${esc(n.title)}</b>${n.t != null ? `<button type="button" class="flw-chip num" data-seek="${n.t}">⏱ ${secs(n.t)}</button>` : ""}</div>
      ${n.why ? `<p>${esc(n.why)}</p>` : ""}${n.fix ? `<p class="flw-fix">✅ ${esc(n.fix)}</p>` : ""}</li>`;
    return `<h2>الملاحظات</h2><p class="flw-sub">هذه ملاحظات على الفيديو كما هو، على قواعد الخوارزميات التي لدينا. إذا ستنفذها، صوّر مرة أخرى وارفع. وإذا كفاية هكذا، أكمل للمونتاج.</p>
      <div class="flw-rev"><div class="flw-score">${r.score != null ? `<b class="num">${r.score}</b><small>من 100</small>` : ""}</div><div><p>${esc(r.summary || "")}</p>
        <small class="muted">${{ comedy: "😂 كوميدي", educational: "📚 تعليمي", story: "📖 حكاية", sales: "🛒 بيع" }[r.tone] ? `${{ comedy: "😂 كوميدي", educational: "📚 تعليمي", story: "📖 حكاية", sales: "🛒 بيع" }[r.tone]} · ` : ""}⏱ ${secs(mt.dur)} · ${mt.w}×${mt.h}${mt.wpm ? ` · ${mt.wpm} كلمة/دقيقة` : ""}${mt.first_word != null ? ` · أول كلمة بعد ${mt.first_word} ث` : ""}</small></div></div>
      <video class="flw-rv" src="${esc(d.footage?.main?.url || "")}" controls playsinline preload="metadata"></video>
      <ul class="flw-notes">${(r.notes || []).map(note).join("") || `<li class="nice"><b>لا يوجد ملاحظات مهمة 👌</b></li>`}</ul>
      ${(r.broll || []).length ? `<h3>🎥 لقطات B-roll تقوّي النص</h3><ul class="flw-bsug">${r.broll.map((b) => `<li>${esc(b.what)}${b.at ? ` <small class="muted">(${esc(b.at)})</small>` : ""}</li>`).join("")}</ul>` : ""}
      <div class="flw-acts end"><label class="flw-csel">🎭 كوميكس <select data-comics><option value="auto" ${(S.comics || "auto") === "auto" ? "selected" : ""}>إذا الفيديو كوميدي</option><option value="on" ${S.comics === "on" ? "selected" : ""}>دائمًا</option><option value="off" ${S.comics === "off" ? "selected" : ""}>لا</option></select></label><button type="button" class="flw-btn" data-reshoot>🎬 سنفّذها وأعيد التصوير</button>
        <button type="button" class="flw-btn pri big" data-automont ${d.busy ? "disabled" : ""}>⏭ أكمل للمونتاج التلقائي</button></div>`;
  }
  function stMontage(d) {
    const mo = d.montage, ms = S.mstate || {};
    if (d.busy === "montage" || !mo) return `<h2>المونتاج</h2>${d.busy === "montage" ? working("يقص السكتات، ويغيّر زاوية الكاميرا كل لقطة، ويضبط الألوان، ويختار ويعمل لقطات الـ B-roll، ويضع التايبوجرافي… (لقطات الأفاتار يمكن تأخذ كم دقيقة)") : failed("montage")}`;
    const rp = mo.report || {}, pj = ms.project || {}, ty = ms.typo;
    const rendering = pj.render_status === "rendering", done = pj.export_url && !rendering;
    const tyBusy = ty?.busy;
    return `<h2>${mo.plain ? "الفيديو بدون مونتاج" : "المونتاج التلقائي جاهز"}</h2>
      ${mo.plain ? `<p class="flw-sub">الفيديو كما هو، فقط على مقاس الريلز.</p>` : `<ul class="flw-mrep">
        <li>✂️ أُزيل <b class="num">${rp.cut || 0}</b> ثانية سكوت</li><li>🎥 <b class="num">${rp.shots || 1}</b> لقطة بزوايا كاميرا مختلفة (واسعة، قريبة، من الجنب…)</li>
        <li>🎨 الألوان ضُبطت تلقائي</li>${rp.broll_ai ? `<li>🪄 <b class="num">${rp.broll_ai}</b> لقطة B-roll بالأفاتار (في نفس المكان)</li>` : ""}${rp.broll_stock ? `<li>🎞️ <b class="num">${rp.broll_stock}</b> لقطة ستوك حقيقية أعلى النص</li>` : ""}${rp.broll && !rp.broll_ai && !rp.broll_stock ? `<li>🎞️ <b class="num">${rp.broll}</b> لقطة B-roll أعلى النص</li>` : ""}${rp.broll_note ? `<li class="muted">⚠️ ${esc(rp.broll_note)}</li>` : ""}${rp.comics ? `<li>🎭 <b class="num">${rp.comics}</b> كوميك عند الإفيهات</li>` : rp.comics === 0 ? `<li class="muted">🎭 لم أجد كوميكس في المكتبة تناسب هذا النص</li>` : ""}
        <li>🔤 التايبوجرافي: ${!rp.typo ? "لا يوجد نص مسموع" : tyBusy ? `⏳ ${esc(ty.step || "جارٍ الإنشاء")}` : ty?.error ? `⚠️ ${esc(ty.error)}` : "✓ جاهز"}</li></ul>`}
      ${done ? `<video class="flw-rv" src="${esc(pj.export_url)}" controls playsinline></video>` : ""}
      ${rendering ? working(`يصدّر الفيديو… ${esc(pj.render_progress || "")}`) : pj.render_error ? `<div class="flw-empty bad">⚠️ ${esc(pj.render_error)}</div>` : ""}
      <div class="flw-acts end">
        ${mo.plain ? `<button type="button" class="flw-link" data-automont>↩︎ استعد المونتاج التلقائي</button>` : `<button type="button" class="flw-link" data-plain>✕ بدون مونتاج</button>`}
        <button type="button" class="flw-btn" data-myedit>✏️ هعمل المونتاج بنفسي</button>
        ${done ? `<a class="flw-btn" href="${esc(pj.export_url)}" download>⬇ نزّل</a>` : ""}
        <button type="button" class="flw-btn pri big" data-render ${rendering || tyBusy ? "disabled" : ""}>${done ? "🔁 صدّر آخر" : "✓ موافق، صدّر الفيديو"}</button></div>
      ${rp.broll && !mo.plain ? `<p class="muted">✏️ إذا ستعمل المونتاج بنفسك: لقطات الـ B-roll طبقات أعلى الفيديو، تزيل أي واحدة أو تبدّلها بفيديو أو صورة من جهازك.</p>` : ""}
      ${tyBusy ? `<p class="muted">التصدير ينتظر التايبوجرافي ينتهي لكي النص يظهر أعلى الفيديو.</p>` : ""}
      ${mo.plain ? "" : camBench(d)}`;
  }
  // 🎥 تجربة زاوية كاميرا حقيقية: لقطة ٥ ثواني على كل موديل ممكن يغيّر مكان الكاميرا، والنتايج جنب بعض
  const CAMNAME = { wide: "واسعة", close: "قريبة", medium: "متوسطة", side_l: "من الشمال", closer: "قريبة جدًا", side_r: "من اليمين" };
  function camBench(d) {
    const cm = S.cam, cb = d.cambench, shots = (S.mstate || {}).shots || [];
    if (!S.camOpen) return `<div class="flw-cam"><button type="button" class="flw-link" data-camopen>🎥 جرّب زاوية كاميرا حقيقية (تجربة)</button></div>`;
    if (!cm) return `<div class="flw-cam">${working("يبحث عن النماذج التي على Atlas…")}</div>`;
    const sec = cm.seconds || 5;
    const runs = (cb?.runs || []).map((r) => `<figure class="${r.status}">${r.file ? `<video src="/media/ads/flows/${esc(d.id)}/${esc(r.file)}" controls loop playsinline></video>` : `<span class="flw-ph">${r.status === "failed" ? "⚠️" : "⏳"}</span>`}
      <figcaption><b>${esc(r.label)}</b><small class="${r.status === "failed" ? "err" : "muted"}">${r.status === "done" ? `✓${r.credits ? ` · ${r.credits} نقطة` : ""}` : r.status === "failed" ? esc(r.error || "فشل") : "يُنشأ (يمكن يأخذ كم دقيقة)"}</small></figcaption></figure>`).join("");
    return `<div class="flw-cam"><h3>🎥 زاوية كاميرا حقيقية (تجربة)</h3>
      <p class="flw-sub">نرسل ${sec} ثواني من لقطة لكل نموذج على Atlas يمكن يصوّر نفس المشهد من مكان آخر، وترى النتائج بجانب بعض وتقرر أي ينفع.</p>
      ${cm.models.length ? "" : `<p class="flw-empty bad">لم أجد نماذج تعديل فيديو في كتالوج Atlas.</p>`}
      <div class="flw-camf"><label>اللقطة <select data-camshot>${shots.map((x) => `<option value="${x.i}" ${S.camShot == x.i ? "selected" : ""}>${x.i + 1} · ${esc(CAMNAME[x.cam] || x.cam || "")} · ${secs(x.start)}</option>`).join("")}</select></label>
        <label>الزاوية <select data-camangle>${Object.entries(cm.angles).map(([k, t]) => `<option value="${k}" ${(S.camAngle || "side") === k ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
        <label title="صور الشخص من كذا اتجاه تخلّي النموذج لا يخمّن شكله من الزاوية الجديدة">📷 صور الشخص <select data-camtwin><option value="">بدون صور</option>
          ${(S.camTwins || []).filter((t) => t.ready?.photos).map((t) => `<option value="${esc(t.id)}" ${S.camTwin === t.id || (!S.camTwin && S.camTwin !== "" && t === S.camTwins.find((x) => x.ready?.photos)) ? "selected" : ""}>${esc(t.name)} (${t.ready.photos} صورة)</option>`).join("")}</select></label></div>
      ${(S.camTwins || []).some((t) => t.ready?.photos) ? "" : `<p class="muted">💡 إذا عملت أفاتار في «🪞 الأفاتار» وصوّرت صورك من كذا اتجاه، يمكنك تبعتها مع اللقطة والوجه من الزاوية الجديدة سيظهر أدق.</p>`}
      <div class="flw-camm">${cm.models.map((m) => `<label><input type="checkbox" data-cammodel value="${esc(m.model)}" ${!S.camSel || S.camSel.includes(m.model) ? "checked" : ""}>
        ${esc(m.label)} <small class="muted">${m.kind === "ref" ? "مرجع فيديو" : "تعديل فيديو"} · ${m.per_sec ? `$${(m.per_sec * sec * (m.kind === "ref" ? 2 : 1)).toFixed(2)} للتجربة` : "السعر غير معروف"}</small></label>`).join("")}</div>
      <div class="flw-acts"><button type="button" class="flw-btn pri" data-camgo ${cm.models.length ? "" : "disabled"}>جرّب على النماذج المختارة</button>
        <small class="muted">يُخصم من الرصيد على قدر النماذج التي اشتغلت فقط.</small></div>
      ${cb ? `<h4>اللقطة ${cb.shot + 1} · ${esc(cb.angle_ar)}${cb.photos ? ` · 📷 ومعها ${cb.photos} صور للشخص` : " · بدون صور للشخص"}</h4><div class="flw-camr"><figure><video src="/media/ads/flows/${esc(d.id)}/${esc(cb.src)}" controls loop playsinline></video><figcaption><b>الأصل</b></figcaption></figure>${runs}</div>` : ""}</div>`;
  }
  // نتايج تجربة الكاميرا: بنحدّث لحد ما كل الموديلات تخلص
  function campoll() {
    clearTimeout(S.ctimer);
    if (!S.d?.cambench?.runs?.some((r) => r.status === "working")) return;
    S.ctimer = setTimeout(async () => {
      try { S.d = await api(`/api/flows/${S.d.id}`); render(); } catch { /* الخادم يعيد التشغيل */ }
      campoll();
    }, 5000);
  }
  async function mpoll() {
    clearTimeout(S.mtimer);
    if (!S.d || S.d.stage !== "montage" || !S.d.montage) return;
    try { S.mstate = await api(`/api/flows/${S.d.id}/montage-state`); render(); } catch { /* الخادم يعيد التشغيل */ }
    const ms = S.mstate || {};
    if (ms.typo?.busy || ms.project?.render_status === "rendering") S.mtimer = setTimeout(mpoll, 2500);
  }

  // ---------------------------------------------------------------- الرسم
  // الشاشة بتتبني مرة واحدة، وبعد كده بيتغير بس الجزء اللي اتغير فعلًا (من غير ما تختفي وتظهر كل شوية)
  function render() {
    const d = S.d;
    if (!d || !S.el) return;
    const st = d.stage === "generate" && (d.output || d.busy === "generate") ? "done" : d.stage;
    const body = { idea: stIdea, format: stFormat, scenario: isCode(d) ? stScript : stScenario, cast: stCast, voice: stVoice, assets: stAssets, panel: stPanel, generate: stGenerate, done: stDone,
      shoot: stShoot, review: stReview, montage: stMontage }[st] || stIdea;
    if (S.stage && S.stage !== st) S.chat = null;   // النقاش يُغلق عندما تنتقل خطوة
    if (st === "montage" && d.montage && S.mfor !== d.montage.at) { S.mfor = d.montage.at; S.mstate = null; setTimeout(mpoll, 0); }
    if (!d.busy) S.busyFrom = null;
    const head = `<div class="flw-tpl"><small class="latin">Template</small><b>${esc(d.template.name)}</b>${d.brand_name ? `<small class="muted">لـ ${esc(d.brand_name)}</small>` : ""}</div>
        ${stepper(d)}<div class="flw-hr">${meter(d.knowledge)}<button type="button" class="flw-x big" data-close aria-label="أغلق">✕</button></div>`;
    const main = body(d);
    let box = S.el.querySelector(".flw-box[data-built]");
    if (!box) {
      S.el.innerHTML = `<div class="flw-box" data-built><header class="flw-head"></header><main class="flw-main"></main></div>`;
      box = S.el.querySelector(".flw-box");
      S.html = {};
    }
    if (S.html.head !== head) { setHTML(box.querySelector(".flw-head"), head); S.html.head = head; }
    if (S.html.main !== main) {
      const m = box.querySelector(".flw-main"), scroll = m.scrollTop;
      // اللي بيكتبه العميل في خانة مفتوحة ميضيعش لو الشاشة حُدّثت
      const keep = [...m.querySelectorAll("input[id], textarea[id]")].map((el) => [el.id, el.value]);
      if (S.stage === st) setHTML(m, main); else m.innerHTML = main;   // نفس الخطوة: نغيّر الذي تغيّر فقط (بدون وميض)
      keep.forEach(([id, v]) => { const el = m.querySelector(`#${id}`); if (el && !el.value) el.value = v; });
      if (S.stage === st) m.scrollTop = scroll; else m.scrollTop = 0;
      S.html.main = main;
      m.querySelectorAll(".flw-card[data-cid]").forEach((c) => S.seen.add(c.dataset.cid));
    }
    S.stage = st;
    tick();
    if (st === "idea" && !S.seasons) loadSeasons();
  }
  // عدّاد «بقاله كام ثانية بيفكر» بيتحدث لوحده من غير ما يعيد رسم الشاشة
  function tick() {
    clearInterval(S.tickT);
    const el = S.el?.querySelector("[data-secs]");
    if (!el || !S.d?.busy) return;
    S.busyFrom ??= Date.now() - (S.d.busy_for || 0) * 1000;
    const up = () => {
      const n = Math.round((Date.now() - S.busyFrom) / 1000);
      const cur = S.el?.querySelector("[data-secs]");
      if (!cur) return clearInterval(S.tickT);
      cur.textContent = n < 3 ? "" : n < 45 ? `${n} ثانية` : `${n} ثانية · يأخذ وقت أكثر من العادي، إذا تأخر جدًا العقل سيجرّب نموذج أسرع تلقائيًا`;
    };
    up();
    S.tickT = setInterval(up, 1000);
  }
  async function loadSeasons() {
    S.seasons = { status: "loading", items: [] };
    try {
      for (let i = 0; i < 20; i++) {
        S.seasons = await api("/api/brain-seasons");
        if (S.seasons.status !== "working" || !S.d || S.el.hidden) break;
        if (S.d.stage === "idea") render();
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch { S.seasons = { items: [] }; }
    if (S.d?.stage === "idea") render();
  }

  // ---------------------------------------------------------------- الأحداث
  function renum(f) { f.querySelectorAll(".flw-row > b").forEach((el, i) => (el.textContent = `${ROWS[S.d.format][1]} ${i + 1}`)); }
  async function send(stage) {
    const inp = S.el.querySelector(`[data-chatin="${stage}"]`), msg = inp?.value.trim();
    if (!msg) return;
    inp.disabled = true;
    S.d.busy = "chat";
    await call("/chat", { stage, message: msg });
  }
  function reset() { S.edit = null; S.own = false; S.hint = false; }
  async function onClick(e) {
    const t = e.target;
    const q = (sel) => t.closest(sel);
    if (q("[data-close]")) return close();
    if (q("[data-why]")) return window.uiKnow?.(S.d?.knowledge);
    let b;
    if (q("[data-skipshoot]")) { reset(); return call("/skip-shoot", {}); }
    // 📱 التصوير بيتبعت لتطبيق الموبايل: السكريبت على التيلي برومبتر، والفيديو بيرجع للخطوة دي لوحده
    if (q("[data-phone]")) {
      const done = await window.uiPhone?.({ kind: "shoot", fid: S.d.id, title: `صوّر «${S.d.scenario?.title || S.d.idea?.title || "الفيديو"}» بالتيلي برومبتر` });
      if (done) { S.d = await api(`/api/flows/${S.d.id}`); render(); }
      return;
    }
    if ((b = q("[data-lib]"))) {
      if (S.lib?.role === b.dataset.lib) { S.lib = null; return render(); }
      S.lib = { role: b.dataset.lib, items: null }; render();
      try { S.lib.items = await api("/api/footage-library"); } catch (err) { S.lib.items = []; toast(err.message, true); }
      return render();
    }
    if ((b = q("[data-libpick]"))) { const role = S.lib?.role || "main"; S.lib = null; return call("/footage/pick", { gen_id: b.dataset.libpick, role }); }
    if ((b = q("[data-fdel]"))) return call(`/footage/${b.dataset.fdel}`, null, "DELETE");
    if (q("[data-phreview]")) return call("/review", {}).then(poll);
    if (q("[data-reshoot]")) return call("/stage", { stage: "shoot" });
    if ((b = q("[data-castbg]"))) return call("/phone-cast", { twin: S.d.phone_cast?.twin || "", bg: b.dataset.castbg });
    if (q("[data-gotwin]")) { S.twins = undefined; close(); return showStep("16"); }
    if (q("[data-automont]")) { S.mstate = null; return call("/auto-montage", { plain: false, comics: S.comics || "auto" }).then(poll); }
    if (q("[data-plain]")) { if (!(await uiConfirm("تزيل المونتاج التلقائي وتُخرج الفيديو كما هو؟"))) return; S.mstate = null; return call("/auto-montage", { plain: true }).then(poll); }
    if ((b = q("[data-seek]"))) { const v = S.el.querySelector(".flw-rv"); if (v) { v.currentTime = +b.dataset.seek; v.play().catch(() => {}); } return; }
    if (q("[data-myedit]")) { const pid = S.d.montage?.project_id; if (!pid) return; close(); storageSet(projectKey("free"), pid); return showStep("6f"); }
    if (q("[data-render]")) {
      const pid = S.d.montage?.project_id;
      try { await api(`/api/projects/${pid}/render`, { method: "POST" }); toast("⏳ جارٍ التصدير الفيديو…"); } catch (err) { return toast(err.message, true); }
      return mpoll();
    }
    if (q("[data-camopen]")) {
      S.camOpen = true; render();
      if (!S.cam) {
        try { [S.cam, S.camTwins] = await Promise.all([api("/api/cam-models"), api("/api/twins").catch(() => [])]); } catch (err) { S.cam = { models: [], angles: {}, seconds: 5 }; toast(err.message, true); }
        render();
      }
      return;
    }
    if (q("[data-camgo]")) {
      const el = S.el;
      const models = [...el.querySelectorAll("[data-cammodel]:checked")].map((x) => x.value);
      if (!models.length) return toast("اختر نموذج واحد على الأقل", true);
      S.camSel = models;
      S.camShot = +(el.querySelector("[data-camshot]")?.value || 0);
      S.camAngle = el.querySelector("[data-camangle]")?.value || "side";
      S.camTwin = el.querySelector("[data-camtwin]")?.value ?? "";
      const ok = await call("/cambench", { shot: S.camShot, angle: S.camAngle, models, twin: S.camTwin });
      if (ok) campoll();
      return;
    }
    if ((b = q("[data-go]"))) { reset(); S.chat = null; S.fmt = null; S.eps = null; return call("/stage", { stage: b.dataset.go }); }
    if ((b = q("[data-rate]"))) {
      return call("/rate", { stage: b.dataset.rate, item: b.dataset.rid, value: +b.dataset.v });
    }
    if ((b = q("[data-rowdel]"))) { const f = b.closest("form"); b.closest(".flw-row").remove(); return renum(f); }
    if ((b = q("[data-rowadd]"))) {
      const f = b.closest("form"), box = f.querySelector(".flw-rows");
      box.insertAdjacentHTML("beforeend", rowHTML({}, S.d.format, box.children.length));
      return box.lastElementChild.querySelector("input, textarea")?.focus();
    }
    if ((b = q("[data-edit]"))) { S.edit = b.dataset.edit; S.own = false; return render(); }
    if (q("[data-cancel]")) { reset(); return render(); }
    if (q("[data-own]")) { S.own = true; S.edit = null; render(); return S.el.querySelector(".flw-form input")?.focus(); }
    if (q("[data-hint]")) { S.hint = true; render(); return S.el.querySelector("#flwHint")?.focus(); }
    if ((b = q("[data-retry]")) && b.dataset.retry === "vo") return call("/voice", S.vo);
    if ((b = q("[data-slang]"))) return call("/scenarios", { lang: b.dataset.slang, more: false });
    if (q("[data-panel]")) {
      const d = S.d;
      return MotionPage.openTemplate(d.template.id, d.template.name, {
        vals: d.params || {}, timing: d.vo_track?.timing || null, vo: d.vo_url || null,
        onExport: (vals) => api(`/api/flows/${d.id}/export`, { method: "POST", ...J({ params: vals }) }).then((x) => { S.d = x; render(); poll(); }),
      });
    }
    if (q("[data-export]")) return call("/export", { params: {} });
    if ((b = q("[data-retry]"))) {
      const idea = b.dataset.retry === "idea";
      return call(idea ? "/ideas" : "/scenarios", { more: !!(idea ? S.d.ideas : S.d.scenarios)?.length });
    }
    if ((b = q("[data-more]"))) {
      const hint = S.el.querySelector("#flwHint")?.value.trim() || "";
      S.hint = false;
      return call(b.dataset.more === "idea" ? "/ideas" : "/scenarios", { hint, more: true });
    }
    if ((b = q("[data-season]"))) {
      const s = S.seasons.items[+b.dataset.season];
      return call("/ideas", { hint: `أفكار لمناسبة «${s.name}» (${s.date}${s.countries?.length ? ` — ${s.countries.join("، ")}` : ""}). زاوية مقترحة: ${s.angle || ""}`, more: true });
    }
    if ((b = q("[data-hook]"))) return call("/hook", { idea_id: b.dataset.hook, hook: b.dataset.text });
    if ((b = q("[data-later]"))) { const [kind, id] = b.dataset.later.split(":"); if (await call("/save-later", { kind, id })) { toast("🔖 حُفظت في «محفوظاتك لبعدين»"); S.saved = null; if (S.savedOpen) loadSaved(); } return; }
    if (q("[data-savedopen]")) { S.savedOpen = !S.savedOpen; render(); if (S.savedOpen) loadSaved(); return; }
    if ((b = q("[data-usesaved]"))) { reset(); S.savedOpen = false; S.saved = null; return call(`/use-saved/${b.dataset.usesaved}`).then(poll); }
    if ((b = q("[data-delsaved]"))) { try { S.saved = await api(`/api/flows/${S.d.id}/saved/${b.dataset.delsaved}`, { method: "DELETE" }); render(); } catch (err) { toast(err.message, true); } return; }
    if ((b = q("[data-pick-idea]"))) { reset(); return call("/idea", { id: b.dataset.pickIdea }); }
    if ((b = q("[data-pick-scen]"))) { reset(); S.castOpts = null; S.cast = null; return call("/scenario", { id: b.dataset.pickScen }); }
    if ((b = q("[data-chat]"))) { S.chat = S.chat === b.dataset.chat ? null : b.dataset.chat; render(); return S.el.querySelector("[data-chatin]")?.focus(); }
    if ((b = q("[data-send]"))) return send(b.dataset.send);
    if ((b = q("[data-fmt]"))) { S.fmt = b.dataset.fmt; return render(); }
    if ((b = q("[data-eps]"))) { S.eps = b.dataset.eps; return render(); }
    if (q("[data-setfmt]")) {
      const f = S.fmt || S.d.format || "reel";
      const ok = await call("/format", { format: f, episodes: String(S.eps || S.d.episodes || "auto") });
      if (ok) { S.fmt = null; S.eps = null; }
      return;
    }
    if ((b = q("[data-person]"))) {
      const id = b.dataset.person;
      S.cast = S.cast.includes(id) ? S.cast.filter((x) => x !== id) : [...S.cast, id];
      return render();
    }
    if (q("[data-setcast]")) { S.vopts = null; S.vo = null; return call("/cast", { ids: S.cast || [] }); }
    if ((b = q("[data-vspk]"))) { S.vo.speaker = b.dataset.vspk; return render(); }
    if ((b = q("[data-vlang]"))) { S.vo.lang = b.dataset.vlang; S.vo.voice = ""; return render(); }
    if ((b = q("[data-vvoice]"))) { S.vo.voice = b.dataset.vvoice; return render(); }
    if ((b = q("[data-vplay]"))) return playSample(b.dataset.vplay);
    if (q("[data-setvoice]")) { S.audio?.pause(); return call("/voice", S.vo); }
    if ((b = q("[data-tlook]"))) return tset("look", b.dataset.tlook);
    if ((b = q("[data-tlen]"))) return tset("length", b.dataset.tlen);
    if ((b = q("[data-tratio]"))) return tset("ratio", b.dataset.tratio);
    if ((b = q("[data-adel]"))) return call(`/assets/${encodeURIComponent(b.dataset.adel)}`, null, "DELETE");
    if ((b = q("[data-ment]"))) {
      const ta = S.el.querySelector("#flwPrompt"), m = `@${b.dataset.ment} `;
      const p = ta.selectionStart ?? ta.value.length;
      ta.value = ta.value.slice(0, p) + (p && !/\s$/.test(ta.value.slice(0, p)) ? " " : "") + m + ta.value.slice(p);
      return ta.focus();
    }
    if (q("[data-gen]")) {
      S.d.busy = "generate";
      return call("/generate", { prompt: S.el.querySelector("#flwPrompt")?.value || "" });
    }
    if (q("[data-why-send]")) {
      const r = S.el.querySelector("#flwWhy")?.value.trim();
      if (!r) return;
      await api(`/api/flows/${S.d.id}/rate`, { method: "POST", ...J({ stage: "output", value: 0 }) });
      if (await call("/rate", { stage: "output", value: -1, reason: r })) toast("📝 العقل سيتذكر هذا");
      return;
    }
    if (q("[data-openout]")) return openOutput(S.d.output);
  }
  async function onChange(e) {
    if (e.target.matches?.("[data-comics]")) { S.comics = e.target.value; return; }
    if (e.target.matches?.("[data-casttwin]")) return call("/phone-cast", { twin: e.target.value, bg: "" });
    if (e.target.id === "flwFiles") upload(e.target.files);
    const ph = e.target.dataset?.phup;
    if (ph && e.target.files?.length) {
      const files = [...e.target.files];
      e.target.value = "";
      for (const [i, file] of files.entries()) {
        const f = new FormData(); f.append("role", ph); f.append("file", file);
        toast(`⏳ جارٍ الرفع ${files.length > 1 ? `${i + 1} من ${files.length}` : "الفيديو"}…`);
        if (!(await call("/footage", f))) break;
      }
      return;
    }
    const rk = e.target.dataset?.refup, rf = e.target.files?.[0];
    if (rk && rf) {
      // الخانة متاخدة قبل كده: الملف القديم بيتشال والجديد بياخد نفس الاسم
      const old = (S.d.assets || []).find((a) => a.name === rk);
      (old ? call(`/assets/${encodeURIComponent(old.file)}`, null, "DELETE") : Promise.resolve(true))
        .then(() => upload([new File([rf], rk + (rf.name.match(/\.\w+$/)?.[0] || ".png"), { type: rf.type })]));
    }
    const n = e.target.dataset?.aname;
    if (n !== undefined) call(`/assets/${encodeURIComponent(n)}`, { name: e.target.value }, "PATCH");
  }
  function onInput() { /* الكتابة توقف إعادة الرسم أثناء البولنج (انظر poll) */ }
  async function upload(files) {
    if (!files?.length) return;
    const fd = new FormData();
    [...files].forEach((f) => fd.append("files", f));
    toast("⬆️ يرفع…");
    if (await call("/assets", fd)) toast("✅ رُفع");
  }
  document.addEventListener("submit", (e) => {
    const f = e.target;
    if (!S.el?.contains(f)) return;
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    if (f.dataset.ideaform !== undefined) { reset(); call("/idea", { item: { id: f.dataset.ideaform || "", title: v.title, hook: v.hook, idea: v.idea } }); }
    if (f.dataset.scriptform !== undefined) { reset(); call("/scenario", { item: scriptFrom(f, S.d.mlive) }); return; }
    if (f.dataset.scenform !== undefined) {
      reset(); S.castOpts = null; S.cast = null;
      call("/scenario", { item: { id: f.dataset.scenform || "", title: v.title, summary: v.summary, caption: v.caption, ...rowsFrom(f, S.d.format) } });
    }
  });
  // سحب وإفلات الملفات
  document.addEventListener("dragover", (e) => { if (e.target.closest?.(".flw-drop")) { e.preventDefault(); e.target.closest(".flw-drop").classList.add("over"); } });
  document.addEventListener("dragleave", (e) => e.target.closest?.(".flw-drop")?.classList.remove("over"));
  document.addEventListener("drop", (e) => { if (e.target.closest?.(".flw-drop")) { e.preventDefault(); upload(e.dataTransfer.files); } });

  // ---------------------------------------------------------------- فتح الناتج في قسمه
  async function openOutput(o) {
    if (!o) return;
    close();
    try {
      if (o.kind === "tvideo") { tplx.cur = await api(`/api/tvideos/${o.id}`); showStep("14"); }
      else if (o.kind === "carousel") { storageSet(CAR_KEY, o.id); showStep("8"); openCarousel(o.id); }
      else if (o.kind === "series") { storageSet(SER_KEY, `${o.id}:${(o.episodes || [])[0] || ""}`); showStep("9"); }
      else if (o.kind === "typo") { storageSet("studiomania.typo", o.id); tyx.cur = null; showStep("12"); }
    } catch (err) { toast(err.message, true); }
  }

  // مشاريع بدأت ومخلصتش (بتبان فوق المعرض)
  async function recent() {
    try { return (await api("/api/flows")).filter((f) => f.stage !== "done").slice(0, 6); } catch { return []; }
  }
  return { start, open, close, recent };
})();
