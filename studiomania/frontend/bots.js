// 🤖 «بوتات الرسايل»: بوت على إنستجرام أو فيسبوك أو واتساب من وصفة جاهزة (علّق بكلمة، كلمة في الرسايل، منشن الستوري،
// أسئلة وتحويل للفريق، مساعد ذكي). العميل بيختار ويكتب الرسايل بس، والبرنامج بيبني الـ workflow عند Zernio ويشغّله.
const BotsPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, d: null, recipe: "", f: {}, busy: false };
  const PL = { instagram: "إنستجرام", facebook: "فيسبوك", whatsapp: "واتساب" };
  const ST = { active: ["يعمل", "ok"], paused: ["متوقف", "wait"], draft: ["مسودة", "wait"] };
  const FIELD = {
    keywords: ["الكلمات التي تشغّله (افصل بينها بفاصلة)", "text", "مثلًا: برنامج, سعر"],
    post: ["على منشور معيّن (اختياري، رقم المنشور)", "text", "اتركه فارغًا لكل المنشورات"],
    message: ["الرسالة التي ستصله", "area", ""],
    link_title: ["اسم زر الرابط", "text", "مثلًا: سجّل هنا"],
    link: ["الرابط", "url", "https://…"],
    q1: ["السؤال الأول", "text", ""], a1: ["خياراته (افصل بينها بفاصلة)", "text", ""],
    q2: ["السؤال الثاني", "text", ""], a2: ["خياراته (افصل بينها بفاصلة)", "text", ""],
    ai: ["يكمل المحادثة بالذكاء الاصطناعي من عقل العلامة إن ردّ العميل", "check", ""],
  };
  const html = () => `<div class="nb-wrap fs-wrap rv-wrap" id="botWrap"><div class="nh-empty">جارٍ التحميل…</div></div>`;
  const val = (k) => S.f[k] ?? S.d.defaults[S.recipe]?.[k] ?? "";

  function field(k) {
    const [t, type, ph] = FIELD[k];
    if (type === "check") return `<label class="pk-tg">${t}<input type="checkbox" data-bf="${k}" ${S.f[k] ? "checked" : ""}></label>`;
    if (type === "area") return `<label class="pk-f">${t}<textarea rows="3" data-bf="${k}" placeholder="${esc(ph)}">${esc(val(k))}</textarea></label>`;
    return `<label class="pk-f">${t}<input type="${type === "url" ? "url" : "text"}" ${type === "url" ? 'dir="ltr"' : ""} data-bf="${k}" value="${esc(val(k))}" placeholder="${esc(ph)}"></label>`;
  }
  function formHTML() {
    const R = S.d.recipes, r = R[S.recipe];
    if (!r) return `<b class="pk-h3">بوت جديد</b><p class="pk-note">اختر نوع البوت:</p><div class="bot-recipes">${Object.entries(R).map(([k, x]) =>
      `<button type="button" class="bot-recipe" data-brecipe="${k}"><b>${esc(x.t)}</b><small>${esc(x.desc)}</small><span>${x.platforms.map((p) => PL[p]).join(" · ")}</span></button>`).join("")}</div>`;
    const accs = S.d.accounts.filter((a) => r.platforms.includes(a.platform));
    if (!S.f.account || !accs.some((a) => a.id === S.f.account)) S.f.account = accs[0]?.id || "";
    return `<div class="bot-formhead"><b class="pk-h3">${esc(r.t)}</b>${pkIb("close", "عودة إلى الأنواع", "data-bback", "sm")}</div><p class="pk-note">${esc(r.desc)}</p>
      ${accs.length ? `<label class="pk-f">على حساب<select data-bf="account">${accs.map((a) => `<option value="${esc(a.id)}" ${a.id === S.f.account ? "selected" : ""}>${PL[a.platform]} · ${esc(a.name || a.username)}</option>`).join("")}</select></label>`
        : `<p class="pk-err">لا يوجد حساب ${r.platforms.map((p) => PL[p]).join(" أو ")} مربوط. اربطه من صفحة النشر أولًا.</p>`}
      <label class="pk-f">اسم البوت<input type="text" data-bf="name" value="${esc(S.f.name ?? r.t)}"></label>
      ${r.fields.map(field).join("")}
      ${S.recipe === "assistant" || S.f.ai ? `<p class="pk-note">يقرأ الرد الذكي من عقل العلامة (الهوية والمعرفة والقواعد)، ويُخصم كل رد بنقطة تقريبًا. إن طلب العميل أحدًا من الفريق أو سأل عن شيء غير موجود في العقل، تُحوَّل المحادثة إلى صندوق الرسائل.</p>` : ""}
      <div class="pk-dacts"><button class="nb-btn fs-go" data-bgo ${S.busy || !accs.length ? "disabled" : ""}>${S.busy ? "جارٍ التشغيل…" : "🤖 شغّل البوت"}</button></div>`;
  }
  function render() {
    const d = S.d;
    if (!d.live) { S.el.innerHTML = `<div class="nh-empty">${esc(d.note)}</div>`; return; }
    S.el.innerHTML = `<div class="bot-grid"><section class="bot-list"><b class="pk-h3">بوتاتك</b>
      ${d.bots.map((b) => { const st = ST[b.status] || [b.status, ""]; return `<div class="pk-li"><b>${esc(b.name)}</b><small>${PL[b.platform] || esc(b.platform)} · ${esc(b.account)}</small>
        <span class="am-st ${st[1]}">${st[0]}</span><small>بدأ ${b.started} · انتهى ${b.completed}${b.exited ? ` · حُوّل ${b.exited}` : ""}</small>
        <span class="pk-acts">${pkIb(b.status === "active" ? "close" : "play", b.status === "active" ? "أوقف" : "شغّل", `data-btog="${esc(b.id)}" data-on="${b.status === "active" ? 0 : 1}"`, "sm")}${pkIb("trash", "احذف", `data-bdel="${esc(b.id)}"`, "sm")}</span></div>`; }).join("")
        || `<p class="pk-note">لا توجد بوتات بعد. اختر نوعًا من اليمين وشغّله في دقيقة.</p>`}
      <p class="pk-note">المحادثات التي يحوّلها البوت إلى الفريق تظهر في «صندوق الرسائل».</p></section>
      <section class="bot-form">${formHTML()}</section></div>`;
  }
  async function run(fn) {
    S.busy = true; render();
    try { await fn(); } catch (err) { toast(err.message, true); }
    S.busy = false; render();
  }
  function bind(w) {
    w.addEventListener("input", (e) => { const k = e.target.dataset?.bf; if (k) S.f[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value; });
    w.addEventListener("change", (e) => { const k = e.target.dataset?.bf; if (k) { S.f[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value; if (k === "ai" || k === "account") render(); } });
    w.addEventListener("click", async (e) => {
      const q = (s) => e.target.closest(s);
      if (q("[data-brecipe]")) { S.recipe = q("[data-brecipe]").dataset.brecipe; S.f = {}; return render(); }
      if (q("[data-bback]")) { S.recipe = ""; return render(); }
      if (q("[data-btog]")) { const b = q("[data-btog]"); return run(async () => { S.d = await api(`/api/bots/${encodeURIComponent(b.dataset.btog)}/state`, { method: "POST", ...jsonBody({ on: b.dataset.on === "1" }) }); }); }
      if (q("[data-bdel]")) { if (await uiConfirm("أتحذف هذا البوت نهائيًا؟")) run(async () => { S.d = await api(`/api/bots/${encodeURIComponent(q("[data-bdel]").dataset.bdel)}`, { method: "DELETE" }); }); return; }
      if (q("[data-bgo]")) {
        const r = S.d.recipes[S.recipe], opts = {};
        r.fields.forEach((k) => { opts[k] = k === "ai" ? !!S.f.ai : val(k); });
        return run(async () => {
          S.d = await api("/api/bots", { method: "POST", ...jsonBody({ recipe: S.recipe, account: S.f.account, name: S.f.name ?? r.t, opts }) });
          S.recipe = ""; S.f = {};
          toast("✓ بدأ البوت العمل");
        });
      }
    });
  }
  async function mount(root) {
    const w = root.querySelector("#botWrap");
    if (!w) return;
    S.el = w;
    bind(w);
    try { S.d = await api("/api/bots"); render(); } catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  return { html, mount, close: () => {} };
})();
