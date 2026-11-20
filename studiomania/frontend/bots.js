// 🤖 الرد الآلي: ٥ أنواع موزّعين حوالين النص (زي النجمة)، كل نوع أيقونة واسم قصير بس، والتفاصيل بتفتح في لوح على الجنب.
// النص: كام رد شغال دلوقتي، و«علّق بكلمة» في المنشورات اللي البرنامج بينشرها. البرنامج بيبني الـ workflow عند Zernio ويشغّله.
const BotsPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, d: null, open: "", f: {}, busy: false, accOpen: false, brain: null, pub: null };
  const PL = { instagram: "إنستجرام", facebook: "فيسبوك", whatsapp: "واتساب" };
  // الاسم القصير، وسطر واحد، والأيقونة (خط واحد بيلف عليه السنيك)
  const R = {
    comment: { n: "علّق بكلمة", s: "رسالة على الخاص", ic: "M3.5 5h13v9.5H9.5l-4 3.5v-3.5h-2z M7 8.5h6.5 M7 11.5h4 M18 9.5h3.5 M19.8 7.5l1.9 2-1.9 2" },
    keyword: { n: "كلمة في الخاص", s: "ردّ فوري", ic: "M3 6h18v12H3z M3 6.5l9 6.5 9-6.5 M14.5 18l2.5-4h-3l2.5-4" },
    story: { n: "منشن في الستوري", s: "شكر وهدية", ic: "M15.8 16.4A8.5 8.5 0 1 1 20.5 12v1.3a2.4 2.4 0 0 1-4.8 0V12 M12 8.4a3.6 3.6 0 1 0 .01 0" },
    qualify: { n: "سؤالان ثم الفريق", s: "يفرز ويحوّل", ic: "M4 6h9 M4 10.5h9 M4 15h5.5 M17.5 11a2.6 2.6 0 1 0 .01 0 M13.5 20.5c.6-3 7.4-3 8 0" },
    assistant: { n: "مساعد ذكي", s: "يرد على أي رسالة", ic: "M12 2.8l2 5.7 5.7 2-5.7 2-2 5.7-2-5.7-5.7-2 5.7-2z M19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" },
  };
  const ORDER = ["comment", "keyword", "story", "qualify", "assistant"];
  const FIELD = {
    keywords: ["الكلمات التي تشغّله", "text", "مثلًا: برنامج, سعر"],
    post: ["على منشور معيّن (اختياري)", "text", "اتركه فارغًا لكل المنشورات"],
    message: ["الرسالة التي ستصله", "area", ""],
    link_title: ["اسم زر الرابط", "text", "مثلًا: سجّل هنا"],
    link: ["الرابط", "url", "https://…"],
    q1: ["السؤال الأول", "text", ""], a1: ["خياراته", "text", ""],
    q2: ["السؤال الثاني", "text", ""], a2: ["خياراته", "text", ""],
    ai: ["يكمل المحادثة بالذكاء الاصطناعي من عقل العلامة", "check", ""],
  };
  const svgIc = (d, cls = "") => `<svg class="bx-ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path class="b" d="${d}"/><path class="s" d="${d}" pathLength="100"/></svg>`;
  const plIc = (p) => (typeof ibPlat === "function" ? ibPlat(p) : "");
  const accName = (a) => esc(a.username ? "@" + a.username : a.name || "");
  const html = () => `<div class="bx" id="botWrap"><div class="bx-loading">جارٍ التحميل…</div></div>`;
  const val = (k) => S.f[k] ?? S.d.defaults[S.open]?.[k] ?? "";
  const botsOf = (k) => (S.d?.bots || []).filter((b) => b.recipe === k);

  // ---------- النجمة ----------
  // ٥ أماكن حوالين النص (خماسي): فوق، واليمين واليسار، وتحت يمين وتحت يسار
  const POS = [[50, 10], [87, 38], [73, 82], [27, 82], [13, 38]];
  // البروز وقت الهوفر بيروح ناحية النص (مش برا الشاشة): [x, y] بالبكسل
  const LIFT = [[0, 6], [-10, 0], [-8, -8], [8, -8], [10, 0]];
  function star() {
    const d = S.d, on = d.bots.filter((b) => b.status === "active").length;
    const pd = S.pub;
    const pubTxt = !pd ? "" : pd.mode === "always" ? `في كل منشور · «${esc(pd.word)}»` : pd.mode === "ask" ? "أختار عند النشر" : "متوقف";
    return `<svg class="bx-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${POS.map(([x, y]) => `<line x1="50" y1="50" x2="${x}" y2="${y}"/>`).join("")}</svg>
      <div class="bx-hub">
        <b class="bx-num num">${on}</b><span class="bx-sub">${on === 1 ? "رد آلي يعمل الآن" : "ردود آلية تعمل الآن"}</span>
        <button type="button" class="bx-pub" data-bxpub><span>«علّق بكلمة» في منشوراتك</span><b>${pubTxt}</b></button>
      </div>
      ${ORDER.map((k, i) => { const n = botsOf(k).filter((b) => b.status === "active").length;
        return `<button type="button" class="bx-node${n ? " live" : ""}${S.open === k ? " open" : ""}" data-brecipe="${k}" style="left:${POS[i][0]}%;top:${POS[i][1]}%;--mx:${LIFT[i][0]}px;--my:${LIFT[i][1]}px">
          ${svgIc(R[k].ic)}<b>${R[k].n}</b><small>${n ? `<i class="bx-dot"></i>يعمل${n > 1 ? ` · ${n}` : ""}` : R[k].s}</small></button>`; }).join("")}`;
  }

  // ---------- اللوح اللي على الجنب ----------
  function field(k) {
    const [t, type, ph] = FIELD[k];
    if (type === "check") return `<label class="bx-chk"><input type="checkbox" data-bf="${k}" ${S.f[k] ? "checked" : ""}><span>${t}</span></label>`;
    if (type === "area") return `<label class="bx-f"><span>${t}</span><textarea rows="3" data-bf="${k}" placeholder="${esc(ph)}">${esc(val(k))}</textarea></label>`;
    return `<label class="bx-f"><span>${t}</span><input type="${type === "url" ? "url" : "text"}" ${type === "url" ? 'dir="ltr"' : ""} data-bf="${k}" value="${esc(val(k))}" placeholder="${esc(ph)}"></label>`;
  }
  function accPick(r, accs) {
    const all = S.d.all_accounts?.length ? S.d.all_accounts : accs;
    if (!all.length) return `<p class="bx-err">لا يوجد حساب مربوط. اربط حسابًا من «حساباتك» أولًا.</p>`;
    const cur = accs.find((a) => a.id === S.f.account);
    return `<div class="bx-f bot-accf"><span>على حساب</span>
      <button type="button" class="bot-accbtn" data-baccopen aria-expanded="${S.accOpen ? "true" : "false"}">${cur ? `${plIc(cur.platform)}<b>${accName(cur)}</b>` : `<b class="muted">اختر حسابًا</b>`}<i class="bot-caret">▾</i></button>
      ${S.accOpen ? `<ul class="bot-accmenu">${all.map((a) => { const ok = r.platforms.includes(a.platform);
        return `<li><button type="button" ${ok ? `data-bacc="${esc(a.id)}"` : "disabled"} class="${a.id === S.f.account ? "on" : ""}">${plIc(a.platform)}<b>${accName(a)}</b>${ok ? "" : `<small>لا يدعم هذا النوع</small>`}</button></li>`; }).join("")}</ul>` : ""}
      ${accs.length ? "" : `<small class="bx-err">هذا النوع يعمل على ${r.platforms.map((p) => PL[p]).join(" أو ")} فقط، ولا يوجد حساب منها مربوط.</small>`}</div>`;
  }
  function sheet() {
    if (S.open === "_pub") return pubSheet();
    const k = S.open, r = S.d.recipes[k];
    if (!r) return "";
    const accs = S.d.accounts.filter((a) => r.platforms.includes(a.platform));
    if (!S.f.account || !accs.some((a) => a.id === S.f.account)) S.f.account = accs[0]?.id || "";
    const mine = botsOf(k);
    return `<aside class="bx-sheet"><header>${svgIc(R[k].ic, "lg")}<div><b>${R[k].n}</b><small>${esc(r.desc)}</small></div>
        <button type="button" class="bx-x" data-bclose aria-label="إغلاق">✕</button></header>
      ${mine.length ? `<section class="bx-mine">${mine.map((b) => `<div class="bx-row">${plIc(b.platform)}<span><b>${esc(b.account || b.name)}</b>
          <small>بدأ ${b.started} · انتهى ${b.completed}${b.exited ? ` · حُوّل ${b.exited}` : ""}</small></span>
          <button type="button" class="bx-tg${b.status === "active" ? " on" : ""}" data-btog="${esc(b.id)}" data-on="${b.status === "active" ? 0 : 1}" aria-label="${b.status === "active" ? "أوقف" : "شغّل"}"><i></i></button>
          ${pkIb("trash", "احذف", `data-bdel="${esc(b.id)}"`, "sm")}</div>`).join("")}</section>` : ""}
      <section class="bx-new">${mine.length ? `<h4>رد جديد</h4>` : ""}
        ${accPick(r, accs)}
        ${r.fields.map(field).join("")}
        ${k === "assistant" || S.f.ai ? `<p class="bx-note">يرد من عقل العلامة، ويُخصم كل رد بنقطة تقريبًا. وإن طلب العميل شخصًا أو سأل عن شيء غير موجود، تُحوَّل المحادثة إلى الرسائل.</p>` : ""}
        <button type="button" class="bx-go" data-bgo ${S.busy || !accs.length || !S.f.account ? "disabled" : ""}>${S.busy ? "جارٍ التشغيل…" : "شغّل"}</button></section></aside>`;
  }
  function pubSheet() {
    const p = S.pub, pill = (k, t) => `<button type="button" class="ib-pill${p.mode === k ? " on" : ""}" data-dm="${k}">${t}</button>`;
    return `<aside class="bx-sheet"><header>${svgIc(R.comment.ic, "lg")}<div><b>«علّق بكلمة» في منشوراتك</b><small>من يعلّق بالكلمة تحت المنشور تصله رسالة على الخاص.</small></div>
        <button type="button" class="bx-x" data-bclose aria-label="إغلاق">✕</button></header>
      <section class="bx-new"><div class="ib-pills">${pill("always", "في كل منشور")}${pill("ask", "أختار عند النشر")}${pill("off", "لا")}</div>
        ${p.mode === "always" ? `<label class="bx-f"><span>كلمة التعليق في كل منشور</span><input type="text" id="bxWord" value="${esc(p.word)}" placeholder="مثلًا: برنامج"></label>`
          : p.mode === "ask" ? `<p class="bx-note">تكتب الكلمة عند صنع كل فيديو.</p>` : ""}
        <button type="button" class="bx-go" data-bxsave>احفظ</button></section></aside>`;
  }

  function render() {
    const d = S.d;
    if (!d.live) { S.el.innerHTML = `<div class="bx-loading">${esc(d.note)}</div>`; return; }
    S.el.classList.toggle("has-sheet", !!S.open);
    S.el.innerHTML = `<div class="bx-star">${star()}</div>${S.open ? sheet() : ""}`;
  }
  async function run(fn) {
    S.busy = true; render();
    try { await fn(); } catch (err) { toast(err.message, true); }
    S.busy = false; render();
  }
  async function loadPub() {
    try {
      const brains = await api("/api/ad-brains"), list = Array.isArray(brains) ? brains : [];
      const b = list.find((x) => x.id === clientx?.active) || list[0] || {};
      S.pub = { bid: b.id, mode: b.dm_mode || (String(b.dm_word || "").trim() ? "always" : "ask"), word: b.dm_word || "" };
    } catch { S.pub = null; }
  }
  function bind(w) {
    w.addEventListener("input", (e) => { const k = e.target.dataset?.bf; if (k) S.f[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value; });
    w.addEventListener("change", (e) => { const k = e.target.dataset?.bf; if (k) { S.f[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value; if (k === "ai") render(); } });
    w.addEventListener("click", async (e) => {
      const q = (s) => e.target.closest(s);
      if (q("[data-baccopen]")) { S.accOpen = !S.accOpen; return render(); }
      if (q("[data-bacc]")) { S.f.account = q("[data-bacc]").dataset.bacc; S.accOpen = false; return render(); }
      if (q("[data-brecipe]")) { const k = q("[data-brecipe]").dataset.brecipe; S.open = S.open === k ? "" : k; S.f = {}; S.accOpen = false; return render(); }
      if (q("[data-bxpub]")) { S.open = S.open === "_pub" ? "" : "_pub"; return render(); }
      if (q("[data-bclose]")) { S.open = ""; return render(); }
      if (q("[data-dm]")) { if ($("bxWord")) S.pub.word = $("bxWord").value; S.pub.mode = q("[data-dm]").dataset.dm; return render(); }
      if (q("[data-bxsave]")) {
        const word = ($("bxWord")?.value ?? S.pub.word).trim();
        if (S.pub.mode === "always" && !word) { $("bxWord")?.focus(); return toast("اكتب كلمة التعليق التي ستُقال في كل منشور", true); }
        return run(async () => {
          // الكلمة الثابتة بتتحفظ مع «في كل منشور» بس (في «أختار عند النشر» بتتكتب مع كل فيديو)
          await api(`/api/ad-brains/${encodeURIComponent(S.pub.bid)}`, { method: "PATCH", ...jsonBody({ fields: S.pub.mode === "always" ? { dm_mode: "always", dm_word: word } : { dm_mode: S.pub.mode } }) });
          S.pub.word = word; S.open = "";
          toast("✅ حُفظت الإعدادات");
        });
      }
      if (q("[data-btog]")) { const b = q("[data-btog]"); return run(async () => { S.d = await api(`/api/bots/${encodeURIComponent(b.dataset.btog)}/state`, { method: "POST", ...jsonBody({ on: b.dataset.on === "1" }) }); }); }
      if (q("[data-bdel]")) { if (await uiConfirm("أتحذف هذا الرد الآلي نهائيًا؟")) run(async () => { S.d = await api(`/api/bots/${encodeURIComponent(q("[data-bdel]").dataset.bdel)}`, { method: "DELETE" }); }); return; }
      if (q("[data-bgo]")) {
        const r = S.d.recipes[S.open], opts = {};
        r.fields.forEach((k) => { opts[k] = k === "ai" ? !!S.f.ai : val(k); });
        return run(async () => {
          S.d = await api("/api/bots", { method: "POST", ...jsonBody({ recipe: S.open, account: S.f.account, name: R[S.open].n, opts }) });
          S.f = {};
          toast("✓ بدأ الرد الآلي العمل");
        });
      }
    });
  }
  async function mount(root) {
    const w = root.querySelector("#botWrap");
    if (!w) return;
    S.el = w; S.open = "";
    bind(w);
    try { [S.d] = await Promise.all([api("/api/bots"), loadPub()]); render(); } catch (err) { w.innerHTML = `<div class="bx-loading">${esc(err.message)}</div>`; }
  }
  return { html, mount, close: () => {} };
})();
