// 🧭 مسار القالب: العميل داس على قالب ← المخ بيمشي معاه خطوة بخطوة
// الفكرة ← نوع البوست ← السيناريو ← الأبطال ← الملفات (@منشن) ← التوليد ← التقييم.
// في كل خطوة: اختار / عدّل / اتناقش مع المخ / اقترح غيرهم / اكتب بنفسك، وكل 👍👎 بيتسجل في المخ.
const Flow = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const J = (o) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });
  const S = { seen: new Set(), html: {}, busyFrom: null, tickT: null, el: null, d: null, timer: null, edit: null, own: false, hint: false, chat: null, cast: null, seasons: null, why: false };
  const STEPS = [["idea", "الفكرة"], ["format", "نوع البوست"], ["scenario", "السيناريو"], ["cast", "الأبطال"], ["assets", "ملفاتك"], ["generate", "التوليد"]];
  const FMT = { reel: ["🎬", "ريل", "فيديو قصير رأسي"], carousel: ["🗂️", "كاروسيل", "صور ورا بعض بتتقلب"], series: ["📺", "مسلسل", "كذا حلقة بنفس الأبطال"] };
  const OUT = { tvideo: "قسم القوالب", carousel: "الكاروسيل", series: "المسلسلات", typo: "التايبوجرافي", motion: "الموشن" };
  const idx = (st) => Math.max(0, STEPS.findIndex(([k]) => k === (st === "done" ? "generate" : st)));

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
    Object.assign(S, { d: null, edit: null, own: false, hint: false, chat: null, cast: null });
    S.el.hidden = false;
    S.el.innerHTML = `<div class="flw-box"><div class="flw-load"><span class="flw-spin"></span><p>المخ بيقرا البراند والقالب وبيجهّز أفكار…</p></div></div>`;
    try {
      S.d = await api("/api/flows", { method: "POST", ...J({ template: t.id, name: t.name || "", cat: t.cat || "", desc: t.desc || "" }) });
      try { localStorage.setItem("studiomania.flow", S.d.id); } catch { /* مش مهم */ }
      render(); poll();
    } catch (err) { toast(err.message, true); close(); }
  }
  async function open(fid) {
    shell();
    Object.assign(S, { d: null, edit: null, own: false, hint: false, chat: null, cast: null });
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
      } catch { /* السيرفر بيعيد التشغيل */ }
      poll();
    }, 1400);
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
    return `<button type="button" class="flw-meter" data-why title="المخ يعرفك قد إيه">
      <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="${r}" class="bg"/><circle cx="18" cy="18" r="${r}" class="fg" stroke-dasharray="${(k.score / 100) * c} ${c}"/></svg>
      <span><b class="num">${k.score}٪</b><small>${esc(k.level)}</small></span></button>
      ${S.why ? `<div class="flw-tips"><b>المخ يعرفك ${k.score}٪</b><small>كل ما تقيّم وتكمّل بيانات البراند، الاقتراحات بتبقى على ذوقك أكتر.</small>
        ${(k.tips || []).map((t) => `<p>• ${esc(t)}</p>`).join("")}<small class="muted">${k.counts?.prefs || 0} تقييم متسجل</small></div>` : ""}`;
  }
  function stepper(d) {
    const cur = idx(d.stage);
    const ready = { idea: true, format: !!d.idea, scenario: !!d.format, cast: !!d.scenario, assets: !!d.scenario, generate: !!d.scenario };
    return `<ol class="flw-steps">${STEPS.map(([k, t], i) => `<li class="${i < cur ? "past" : i === cur ? "now" : ""}">
      <button type="button" ${ready[k] && i !== cur && !busy() ? `data-go="${k}"` : "disabled"}><i class="num">${i < cur ? "✓" : i + 1}</i><span>${t}</span></button></li>`).join("")}</ol>`;
  }
  function rateBtns(stage, id) {
    const v = (S.d.ratings || {})[`${stage}:${id || "final"}`] || 0;
    return `<span class="flw-rate"><button type="button" class="${v === 1 ? "on" : ""}" data-rate="${stage}" data-rid="${esc(id || "")}" data-v="${v === 1 ? 0 : 1}" title="عجبني">👍</button>
      <button type="button" class="${v === -1 ? "on bad" : ""}" data-rate="${stage}" data-rid="${esc(id || "")}" data-v="${v === -1 ? 0 : -1}" title="مش عاجبني">👎</button></span>`;
  }
  const working = (t) => `<div class="flw-work"><span class="flw-spin"></span><p>${t} <small class="muted" data-secs></small></p></div>`;
  const failed = (what) => (S.d.error && !S.d.busy ? `<div class="flw-empty bad">⚠️ ${esc(S.d.error)}
    <div class="flw-acts"><button type="button" class="flw-btn pri" data-retry="${what}">↻ جرّب تاني</button></div></div>` : "");
  function chatBox(stage) {
    const log = S.d[stage === "idea" ? "idea_chat" : "scen_chat"] || [];
    return `<div class="flw-chat">
      ${log.length ? `<div class="flw-log">${log.slice(-8).map((m) => `<p class="${m.role}">${esc(m.content)}</p>`).join("")}</div>` : ""}
      <div class="flw-chatrow"><input data-chatin="${stage}" placeholder="${stage === "idea" ? "مثلًا: خليها أجرأ، أو ركّز على السعر…" : "مثلًا: الهوك أقوى، أو قلل الكلام…"}" ${S.d.busy ? "disabled" : ""}>
        <button type="button" class="flw-btn" data-send="${stage}" ${S.d.busy ? "disabled" : ""}>ابعت</button></div></div>`;
  }
  // الاختيار اللي فات (بيظهر فوق الخطوة الجاية): تقدر تتناقش فيه أو ترجع تغيّره
  function picked(stage) {
    const it = S.d[stage];
    if (!it) return "";
    const open = S.chat === stage;
    return `<div class="flw-picked"><div><small class="latin">${stage === "idea" ? "Idea" : "Scenario"}</small>
        <b>${esc(it.title || "")}</b><p>${esc(stage === "idea" ? it.idea || it.hook || "" : it.summary || "")}</p></div>
      <div class="flw-pact"><button type="button" class="flw-link" data-chat="${stage}">💬 ${open ? "اقفل النقاش" : "اتناقش مع المخ"}</button>
        <button type="button" class="flw-link" data-go="${stage}">↩︎ غيّر</button></div>
      ${open ? chatBox(stage) : ""}</div>`;
  }

  // ---------------------------------------------------------------- 1) الفكرة
  function ideaCard(it) {
    if (S.edit === it.id) return ideaForm(it);
    return `<article class="flw-card${S.seen.has(it.id) ? "" : " in"}" data-cid="${esc(it.id)}"><div class="flw-ch"><b>${esc(it.title)}</b>${rateBtns("idea", it.id)}</div>${algoTags(it)}
      ${it.hook ? `<p class="flw-hook">«${esc(it.hook)}»</p>` : ""}${hooksRow(it)}${it.pack && (it.pack.for == null || it.pack.for === it.hook) ? packRow(it.pack) : ""}<p>${esc(it.idea)}</p>${it.fit ? `<small class="flw-fit">🎨 على القالب: ${esc(it.fit)}</small>` : ""}${it.why ? `<small class="muted">💡 ${esc(it.why)}</small>` : ""}
      <div class="flw-acts"><button type="button" class="flw-btn pri" data-pick-idea="${it.id}">اختار الفكرة دي</button>
        <button type="button" class="flw-link" data-edit="${it.id}">✏️ عدّل</button></div></article>`;
  }
  // ٣ هوكات بدرجات (من قوالب مختلفة): الأعلى هو المختار، والعميل يقدر يبدّل بدوسة
  function hooksRow(it) {
    if (!(it.hooks || []).length) return "";
    return `<div class="flw-hooks">${it.hooks.map((h) => `<button type="button" class="flw-hk${h.text === it.hook ? " on" : ""}" data-hook="${esc(it.id)}" data-text="${esc(h.text)}"
        title="${esc(h.why || "")}"><b class="num">${h.score}</b><span>${esc(h.formula || "هوك")}</span>${h.principle ? `<small class="flw-psy" title="المبدأ النفسي">🧠 ${esc(h.principle)}</small>` : ""}${h.text === it.hook ? "" : `<i>«${esc(h.text)}»</i>`}</button>`).join("")}</div>`;
  }
  // ⚡ وضع الخوارزمية: الفكرة معلّمة بدايرة الجمهور ومجموعة المواضيع ودرجة HEAT
  function algoTags(it) {
    const h = it.heat;
    if (!h && !it.ring && !it.bucket) return "";
    const names = { h: "فضول الهوك", e: "مفيش ركود", a: "نتيجة في الآخر", t: "relatable", r: "تتكرر" };
    const tip = h ? Object.entries(names).map(([k, t]) => `${t}: ${h[k] ?? "—"}`).join(" · ") : "";
    return `<div class="flw-algo">${h?.avg != null ? `<span class="heat ${h.avg >= 8 ? "hi" : ""}" title="${esc(tip)}">🔥 HEAT ${h.avg}</span>` : ""}
      ${it.ring ? `<span title="دايرة الجمهور (١ الأضيق)">🎯 دايرة ${it.ring}</span>` : ""}${it.bucket ? `<span>🗂 ${esc(it.bucket)}</span>` : ""}</div>`;
  }
  // الهوك التلاتي: نفس المعنى مكتوب ومعروض ومنطوق (أغلب الناس بتتفرج من غير صوت)، وبعده جمل القفل اللي بتمسك المشاهد
  function packRow(p) {
    if (!p) return "";
    const row = (ic, t, v) => (v ? `<div><span>${ic} ${t}</span><b>${esc(v)}</b></div>` : "");
    return `<div class="flw-pack" title="الهوك التلاتي: لازم التلاتة يقولوا نفس المعنى">${row("📝", "على الشاشة", p.screen)}${row("👁", "اللي بيتشاف", p.visual)}${row("🎙", "اللي بيتقال", p.spoken)}
      ${row("🔒", `بعد الهوك${p.lockin_method ? ` (${esc(p.lockin_method)})` : ""}`, p.lockin)}</div>`;
  }
  function ideaForm(it = {}) {
    return `<form class="flw-card flw-form" data-ideaform="${esc(it.id || "")}">
      <label>العنوان <input name="title" value="${esc(it.title || "")}" placeholder="عنوان قصير للفكرة"></label>
      <label>الهوك (أول جملة بتشد) <input name="hook" value="${esc(it.hook || "")}"></label>
      <label>الفكرة <textarea name="idea" rows="3" placeholder="احكي الفكرة في سطرين">${esc(it.idea || "")}</textarea></label>
      <div class="flw-acts"><button class="flw-btn pri">اختار دي</button><button type="button" class="flw-link" data-cancel>إلغاء</button></div></form>`;
  }
  function seasonsRow() {
    const s = S.seasons;
    if (!s) return "";
    if (s.status === "working") return `<div class="flw-seasons"><small class="muted"><span class="flw-spin sm"></span> المخ بيجهّز مناسبات ${esc(s.market || "بلدك")}…</small></div>`;
    if (!(s.items || []).length) return "";
    const fmt = (x) => new Date(x).toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "short" });
    return `<div class="flw-seasons"><small class="muted">🗓️ مناسبات جاية${s.target ? ` في ${esc(s.target)}` : ""}:</small>
      ${s.items.slice(0, 8).map((x, i) => `<button type="button" class="flw-chip" data-season="${i}" title="${esc(x.angle || "")}">${esc(x.name)} <span class="num">${fmt(x.date)}</span></button>`).join("")}</div>`;
  }
  function stIdea(d) {
    const loading = d.busy === "ideas";
    return `<h2>اختار فكرة للبوست</h2><p class="flw-sub">المخ اقترح أفكار على قد البراند والقالب. اختار واحدة، أو عدّلها، أو اطلب غيرهم، أو اكتب فكرتك.</p>
      ${seasonsRow()}
      ${d.algo_mode && (d.ideas_dropped || []).length ? `<p class="flw-algo-note" title="${esc(d.ideas_dropped.map((x) => `«${x.title}»: ${x.why_out}`).join("\n"))}">⚡ وضع الخوارزمية شال ${d.ideas_dropped.length} ${d.ideas_dropped.length === 1 ? "فكرة ضعيفة" : "أفكار ضعيفة"} وجاب غيرها (حط الماوس تشوف ليه)</p>` : ""}
      <div class="flw-cards">${(d.ideas || []).map(ideaCard).join("")}${S.own ? ideaForm() : ""}</div>
      ${loading ? working("المخ بيفكّر في أفكار على القالب…") : failed("idea")}
      <div class="flw-more">${S.hint ? `<div class="flw-chatrow"><input id="flwHint" placeholder="عايز أفكار عن إيه؟ (اختياري)"><button type="button" class="flw-btn" data-more="idea">اقترح</button></div>` : `
        <button type="button" class="flw-btn" data-more="idea" ${loading ? "disabled" : ""}>💡 اقترح أفكار تانية</button>
        <button type="button" class="flw-link" data-hint>🎯 وجّه المخ</button>`}
        <button type="button" class="flw-link" data-own>✍️ اكتب فكرتك</button></div>`;
  }

  // ---------------------------------------------------------------- 2) نوع البوست
  function stFormat(d) {
    const f = S.fmt || d.format || "reel";
    return `${picked("idea")}<h2>نوع البوست</h2>
      <div class="flw-fmts">${Object.entries(FMT).map(([k, [ic, t, s]]) => `<button type="button" class="flw-fmt${f === k ? " on" : ""}" data-fmt="${k}"><i>${ic}</i><b>${t}</b><small>${s}</small></button>`).join("")}</div>
      ${f === "series" ? `<div class="flw-eps"><b>عدد الحلقات</b><div>${["auto", 2, 3, 4, 5, 6, 7, 8, 10].map((n) => `<button type="button" class="flw-chip${String(S.eps || d.episodes || "auto") === String(n) ? " on" : ""}" data-eps="${n}">${n === "auto" ? "✨ تلقائي (المخ يقرر)" : n}</button>`).join("")}</div></div>` : ""}
      <div class="flw-acts end"><button type="button" class="flw-btn pri big" data-setfmt ${d.busy ? "disabled" : ""}>كمّل للسيناريو ←</button></div>`;
  }

  // ---------------------------------------------------------------- 3) السيناريو
  function scenBody(sc, fmt) {
    if (fmt === "carousel") return `<ol class="flw-beats">${(sc.slides || []).map((s) => `<li><b>${esc(s.heading)}</b> ${esc(s.text)}${s.visual ? `<small class="muted">🖼️ ${esc(s.visual)}</small>` : ""}</li>`).join("")}</ol>`;
    if (fmt === "series") return `<ol class="flw-beats">${(sc.episodes || []).map((e) => `<li><b>${esc(e.title)}</b> ${esc((e.beats || []).join(" ← "))}</li>`).join("")}</ol>`;
    return `<ol class="flw-beats">${(sc.beats || []).map((b) => `<li><span class="num">${esc(b.t || "")}</span> ${esc(b.what)}${b.say ? `<em>«${esc(b.say)}»</em>` : ""}${b.text ? `<small class="muted">📝 ${esc(b.text)}</small>` : ""}</li>`).join("")}</ol>`;
  }
  // تعديل السيناريو بإيده: خانات لكل مشهد / سلايد / حلقة
  const COLS = {
    reel: [["what", "اللي بيحصل"], ["say", "الكلام المسموع"], ["text", "على الشاشة"]],
    carousel: [["heading", "العنوان"], ["text", "الكلام"], ["visual", "الصورة"]],
    series: [["title", "اسم الحلقة"], ["beats", "الأحداث (سطر لكل حدث)"], ["voice", "جمل الصوت (سطر لكل جملة)"]],
  };
  const ROWS = { reel: ["beats", "المشهد"], carousel: ["slides", "السلايد"], series: ["episodes", "الحلقة"] };
  function rowHTML(r, fmt, i) {
    const cell = ([k, l]) => fmt === "series" && k !== "title"
      ? `<label>${l}<textarea data-k="${k}" rows="2" dir="auto">${esc((r[k] || []).join("\n"))}</textarea></label>`
      : `<label>${l}<input data-k="${k}" value="${esc(r[k] || "")}" dir="auto"></label>`;
    return `<div class="flw-row"><b class="num">${ROWS[fmt][1]} ${i + 1}</b><div>${COLS[fmt].map(cell).join("")}</div><button type="button" class="flw-x" data-rowdel title="امسح">✕</button></div>`;
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
      <button type="button" class="flw-link" data-rowadd>+ ضيف ${ROWS[fmt][1]}</button>
      <label>الكابشن <input name="caption" value="${esc(sc.caption || "")}"></label>
      <div class="flw-acts"><button class="flw-btn pri">اختار ده</button><button type="button" class="flw-link" data-cancel>إلغاء</button></div></form>`;
  }
  function scenCard(sc, fmt) {
    if (S.edit === sc.id) return scenForm(sc, fmt);
    return `<article class="flw-card${S.seen.has(sc.id) ? "" : " in"}" data-cid="${esc(sc.id)}"><div class="flw-ch"><b>${esc(sc.title)}</b>${rateBtns("scenario", sc.id)}</div>
      ${sc.summary ? `<p>${esc(sc.summary)}</p>` : ""}${scenBody(sc, fmt)}${sc.caption ? `<small class="muted">✍️ ${esc(sc.caption)}</small>` : ""}
      <div class="flw-acts"><button type="button" class="flw-btn pri" data-pick-scen="${sc.id}">اختار السيناريو ده</button>
        <button type="button" class="flw-link" data-edit="${sc.id}">✏️ عدّل</button></div></article>`;
  }
  function stScenario(d) {
    const loading = d.busy === "scenarios";
    const eps = d.format === "series" ? ` · ${d.episodes === "auto" ? "عدد الحلقات تلقائي" : `${d.episodes} حلقات`}` : "";
    return `${picked("idea")}<h2>اختار السيناريو</h2><p class="flw-sub">${FMT[d.format]?.[0] || ""} ${FMT[d.format]?.[1] || ""}${eps} — <button type="button" class="flw-link" data-go="format">غيّر النوع</button></p>
      <div class="flw-cards wide">${(d.scenarios || []).map((s) => scenCard(s, d.format)).join("")}${S.own ? scenForm({}, d.format) : ""}</div>
      ${loading ? working("المخ بيكتب السيناريوهات…") : failed("scen")}
      <div class="flw-more">${S.hint ? `<div class="flw-chatrow"><input id="flwHint" placeholder="عايز السيناريو يبقى إزاي؟ (اختياري)"><button type="button" class="flw-btn" data-more="scen">اقترح</button></div>` : `
        <button type="button" class="flw-btn" data-more="scen" ${loading ? "disabled" : ""}>💡 اقترح سيناريوهات تانية</button>
        <button type="button" class="flw-link" data-hint>🎯 وجّه المخ</button>`}
        <button type="button" class="flw-link" data-own>✍️ اكتب السيناريو بنفسك</button></div>`;
  }

  // ---------------------------------------------------------------- 4) الأبطال
  function stCast(d) {
    const opts = S.castOpts;
    if (!opts) { loadCast(); return `${picked("scenario")}${working("بجيب الشخصيات…")}`; }
    S.cast ??= (d.cast || []).map((c) => c.id);
    return `${picked("scenario")}<h2>مين أبطال البوست؟</h2><p class="flw-sub">اختار من شخصيات البراند اللي في المخ (تقدر تختار أكتر من واحدة أو ولا واحدة).</p>
      ${opts.length ? `<div class="flw-cast">${opts.map((o) => `<button type="button" class="flw-person${S.cast.includes(o.id) ? " on" : ""}" data-person="${esc(o.id)}">
        <img src="${esc(o.image_url)}" alt="" loading="lazy"><b>${esc(o.name)}</b>${o.about ? `<small>${esc(o.about.slice(0, 70))}</small>` : ""}</button>`).join("")}</div>`
        : `<div class="flw-empty">لسه مفيش شخصيات في المخ. ضيفها من «الشخصيات» أو من عقل البراند، أو كمّل من غير أبطال.</div>`}
      <div class="flw-acts end"><button type="button" class="flw-btn pri big" data-setcast>${S.cast.length ? `كمّل بـ ${S.cast.length} ${S.cast.length === 1 ? "بطل" : "أبطال"}` : "كمّل من غير أبطال"} ←</button></div>`;
  }
  async function loadCast() {
    if (S.castLoading) return;
    S.castLoading = true;
    try { S.castOpts = await api(`/api/flows/${S.d.id}/cast-options`); } catch (err) { S.castOpts = []; toast(err.message, true); }
    S.castLoading = false;
    render();
  }

  // ---------------------------------------------------------------- 5) الملفات
  function assetTile(a) {
    const media = a.kind === "فيديو" ? `<video src="${esc(a.url)}" muted playsinline preload="metadata"></video>` : `<img src="${esc(a.url)}" alt="" loading="lazy">`;
    return `<div class="flw-asset">${media}<label class="latin">@<input data-aname="${esc(a.file)}" value="${esc(a.name)}" dir="auto"></label>
      <button type="button" class="flw-x" data-adel="${esc(a.file)}" title="امسح">✕</button></div>`;
  }
  function stAssets(d) {
    return `${picked("scenario")}<h2>ارفع ملفاتك</h2><p class="flw-sub">صور منتج، لوجو، لقطات… كل ملف ليه اسم، وتقدر تعمل له منشن <b class="latin">@اسمه</b> في البرومبت عشان المخ يستخدمه في المكان الصح.</p>
      <label class="flw-drop"><input type="file" id="flwFiles" accept="image/*,video/*" multiple hidden><i>⬆️</i><b>دوس أو اسحب الملفات هنا</b><small class="muted">صور أو فيديوهات، لحد ١٠ مرة واحدة</small></label>
      ${(d.assets || []).length ? `<div class="flw-assets">${d.assets.map(assetTile).join("")}</div>` : ""}
      <div class="flw-acts end"><button type="button" class="flw-btn pri big" data-go="generate">${(d.assets || []).length ? "كمّل" : "كمّل من غير ملفات"} ←</button></div>`;
  }

  // ---------------------------------------------------------------- 6) التوليد والنتيجة
  function stGenerate(d) {
    const fmt = FMT[d.format] || FMT.reel;
    return `<h2>جاهز للتوليد</h2>${d.error ? `<div class="flw-empty bad">⚠️ ${esc(d.error)}</div>` : ""}
      <div class="flw-sum">
        <div><small>القالب</small><b>${esc(d.template.name)}</b></div><div><small>النوع</small><b>${fmt[0]} ${fmt[1]}</b></div>
        <div><small>الفكرة</small><b>${esc(d.idea?.title || "")}</b></div><div><small>السيناريو</small><b>${esc(d.scenario?.title || "")}</b></div>
        <div><small>الأبطال</small><b>${(d.cast || []).map((c) => esc(c.name)).join("، ") || "—"}</b></div><div><small>الملفات</small><b>${(d.assets || []).length || "—"}</b></div></div>
      <label class="flw-prompt"><b>توجيهات للتوليد (اختياري)</b>
        <textarea id="flwPrompt" rows="4" dir="auto" placeholder="مثلًا: افتح بـ @${esc(d.assets?.[0]?.name || "المنتج")} قريب، والألوان دافية، والختام بالعرض">${esc(d.prompt || "")}</textarea></label>
      ${(d.assets || []).length ? `<div class="flw-ment"><small class="muted">دوس عشان تعمل منشن:</small>${d.assets.map((a) => `<button type="button" class="flw-chip" data-ment="${esc(a.name)}">@${esc(a.name)}</button>`).join("")}</div>` : ""}
      <div class="flw-acts end"><button type="button" class="flw-btn pri big" data-gen ${d.busy ? "disabled" : ""}>🚀 ولّد</button></div>`;
  }
  function stDone(d) {
    const o = d.output || {};
    const isWork = o.status === "working" || d.busy === "generate";
    const pct = o.progress ? ` ${Math.round(o.progress * 100)}٪` : "";
    const rated = (d.ratings || {})["output:final"];
    return `<h2>${isWork ? "بيتولّد…" : o.status === "failed" ? "التوليد وقف" : "خلص! 🎉"}</h2>
      ${isWork ? working(`المخ بيبني ${OUT[o.kind] ? `في ${OUT[o.kind]}` : "البوست"}${pct}`) : ""}
      ${o.status === "failed" || d.error ? `<div class="flw-empty bad">⚠️ ${esc(o.error || d.error || "")}</div>` : ""}
      ${o.video_url ? `<video class="flw-out" src="${esc(o.video_url)}" controls playsinline autoplay loop></video>` : ""}
      ${!isWork && o.kind ? `<div class="flw-done">
        ${o.kind !== "motion" ? `<p>${o.kind === "tvideo" ? "الفيديو اتجهّز في قسم القوالب بالسيناريو والتوجيهات بتاعتك، كمّل هناك (الصوت والستوري بورد والتوليد)." : o.kind === "series" ? `المسلسل اتعمل بـ ${(o.episodes || []).length} حلقات والسكريبت جاهز في كل حلقة.` : o.kind === "carousel" ? "الكاروسيل اتعمل بالسلايدز والكلام." : "الفيديو اتجهّز في التايبوجرافي."}</p>
          <button type="button" class="flw-btn pri big" data-openout>افتح في ${OUT[o.kind]} ←</button>` : o.video_url ? `<a class="flw-btn" href="${esc(o.video_url)}" download>⬇️ نزّل الفيديو</a>` : ""}
        <div class="flw-final"><b>عجبك الناتج؟</b> ${rateBtns("output", "")}<small class="muted">${rated ? "اتسجل في المخ ✓" : "تقييمك بيعلّم المخ ذوقك"}</small></div>
        ${rated === -1 ? `<div class="flw-chatrow"><input id="flwWhy" placeholder="إيه اللي مش عاجبك؟ (المخ هيفتكره)"><button type="button" class="flw-btn" data-why-send>سجّل</button></div>` : ""}
        <button type="button" class="flw-link" data-go="scenario">↩︎ جرّب سيناريو تاني</button></div>` : ""}`;
  }

  // ---------------------------------------------------------------- الرسم
  // الشاشة بتتبني مرة واحدة، وبعد كده بيتغير بس الجزء اللي اتغير فعلًا (من غير ما تختفي وتظهر كل شوية)
  function render() {
    const d = S.d;
    if (!d || !S.el) return;
    const st = d.stage === "generate" && (d.output || d.busy === "generate") ? "done" : d.stage;
    const body = { idea: stIdea, format: stFormat, scenario: stScenario, cast: stCast, assets: stAssets, generate: stGenerate, done: stDone }[st] || stIdea;
    if (S.stage && S.stage !== st) S.chat = null;   // النقاش بيتقفل لما تنتقل خطوة
    if (!d.busy) S.busyFrom = null;
    const head = `<div class="flw-tpl"><small class="latin">Template</small><b>${esc(d.template.name)}</b>${d.brand_name ? `<small class="muted">لـ ${esc(d.brand_name)}</small>` : ""}</div>
        ${stepper(d)}<div class="flw-hr">${meter(d.knowledge)}<button type="button" class="flw-x big" data-close aria-label="اقفل">✕</button></div>`;
    const main = body(d);
    let box = S.el.querySelector(".flw-box[data-built]");
    if (!box) {
      S.el.innerHTML = `<div class="flw-box" data-built><header class="flw-head"></header><main class="flw-main"></main></div>`;
      box = S.el.querySelector(".flw-box");
      S.html = {};
    }
    if (S.html.head !== head) { box.querySelector(".flw-head").innerHTML = head; S.html.head = head; }
    if (S.html.main !== main) {
      const m = box.querySelector(".flw-main"), scroll = m.scrollTop;
      // اللي بيكتبه العميل في خانة مفتوحة ميضيعش لو الشاشة اتحدثت
      const keep = [...m.querySelectorAll("input[id], textarea[id]")].map((el) => [el.id, el.value]);
      m.innerHTML = main;
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
      cur.textContent = n < 3 ? "" : n < 45 ? `${n} ثانية` : `${n} ثانية · بياخد وقت أكتر من العادي، لو اتأخر أوي المخ هيجرّب موديل أسرع لوحده`;
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
    if (q("[data-why]")) { S.why = !S.why; return render(); }
    if (S.why && !q(".flw-tips")) { S.why = false; render(); }
    let b;
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
    if (q("[data-setcast]")) return call("/cast", { ids: S.cast || [] });
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
      if (await call("/rate", { stage: "output", value: -1, reason: r })) toast("📝 المخ هيفتكر ده");
      return;
    }
    if (q("[data-openout]")) return openOutput(S.d.output);
  }
  function onChange(e) {
    if (e.target.id === "flwFiles") upload(e.target.files);
    const n = e.target.dataset?.aname;
    if (n !== undefined) call(`/assets/${encodeURIComponent(n)}`, { name: e.target.value }, "PATCH");
  }
  function onInput() { /* الكتابة بتوقف إعادة الرسم أثناء البولنج (شوف poll) */ }
  async function upload(files) {
    if (!files?.length) return;
    const fd = new FormData();
    [...files].forEach((f) => fd.append("files", f));
    toast("⬆️ بيرفع…");
    if (await call("/assets", fd)) toast("✅ اترفع");
  }
  document.addEventListener("submit", (e) => {
    const f = e.target;
    if (!S.el?.contains(f)) return;
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    if (f.dataset.ideaform !== undefined) { reset(); call("/idea", { item: { id: f.dataset.ideaform || "", title: v.title, hook: v.hook, idea: v.idea } }); }
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
