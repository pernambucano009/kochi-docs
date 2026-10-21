// 📣 «إعلاناتك» (فرع منافسينك في عقل البراند): ترويج بوست اتنشر، إعلان جديد من الصفر، متابعة الإعلانات، والجماهير.
// الاستهداف بيتملي من «🎯 وصفة الاستهداف» (اهتمامات حقيقية من المنصة نفسها + سن + بلاد + كلمات بحث)، وفلوس الإعلان بتتدفع للمنصة من حساب إعلانات العميل.
const AdsMgrPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const BACK = location.hash === "#adsmgr";   // راجع من تسجيل الدخول على منصة الإعلانات
  const S = { el: null, d: null, tab: "boost", busy: "", t: { age_min: 18, age_max: 45, countries: [], interests: [] }, f: {}, hits: [], aud: null, audAcc: "", open: null };
  const TABS = [["boost", "🚀 روّج بوست"], ["create", "✨ إعلان جديد"], ["list", "📊 إعلاناتك"], ["aud", "👥 الجماهير"]];
  const META = ["facebook", "instagram"];
  const html = () => `<div class="nb-wrap fs-wrap rv-wrap" id="amWrap"><div class="nh-empty">بيحمّل…</div></div>`;
  const fmt = (n) => { n = +n || 0; return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n * 100) / 100); };
  const ST = { active: ["شغال", "ok"], paused: ["متوقف", "wait"], pending: ["بيتراجع", "wait"], in_review: ["بيتراجع", "wait"], rejected: ["اترفض", "bad"], completed: ["خلص", ""], cancelled: ["اتلغى", ""], unknown: ["…", ""] };
  const accsFor = (p) => (S.d.ad_accounts || []).filter((a) => a.platform === p || (META.includes(p) && META.includes(a.platform)));
  const platName = (p) => S.d.platforms[p] || p;
  const opts = (o, cur) => Object.entries(o).map(([k, t]) => `<option value="${esc(k)}" ${k === cur ? "selected" : ""}>${esc(t)}</option>`).join("");
  const val = (k, d = "") => S.f[k] ?? d;

  function hero() {
    const d = S.d;
    return `<section class="fs-hero"><div class="fs-hero-t"><b>إعلاناتك</b><span class="latin">YOUR ADS</span></div>
      <p>روّج بوست نزل، أو اعمل إعلان جديد، وتابع أرقامه، واعمل جماهير مخصصة وشبيهة. كله من هنا، والاستهداف بيتملي من «🎯 وصفة الاستهداف» اللي اتعملت من منافسينك المعتمدين.</p>
      <p class="nb-hint">💳 فلوس الإعلان نفسها بتتدفع للمنصة من حساب الإعلانات بتاعك (الكارت اللي عليه). البرنامج بياخد ${d.fee} نقطة بس على كل إعلان بيتعمل.</p>
      ${d.mock ? `<p class="nb-hint">⚠️ وضع تجربة: حسابات وإعلانات وأرقام تجريبية.</p>` : ""}
      ${!d.ready ? `<div class="fs-err">⚠️ خدمة الإعلانات مش متوصّلة لسه. كلّم الدعم.</div>` : d.error ? `<div class="fs-err">⚠️ ${esc(d.error)}</div>` : ""}
      ${d.recipe?.summary ? `<p class="nb-hint">🎯 ${esc(d.recipe.summary)}</p>` : `<p class="nb-hint">🎯 مفيش وصفة استهداف لسه: يجب الموافقة على المنافسين في صفحة المنافسين علشان تتعمل لوحدها.</p>`}</section>`;
  }
  // حسابات الإعلانات: ميتا ولينكدإن وبنترست بياخدوا ربط النشر، وتيك توك وX بيسجّلوا دخول، وجوجل لوحده
  function accounts() {
    const d = S.d, social = new Set((d.social || []).map((a) => a.platform));
    const btn = (p, label) => {
      const has = accsFor(p).length, needSocial = p !== "google" && !social.has(p) && !(META.includes(p) && META.some((m) => social.has(m)));
      return has ? `<span class="pl-chip">✓ ${esc(label)}</span>`
        : `<button class="nb-btn sm" data-amcon="${p}" ${needSocial ? `disabled title="اربط حساب ${esc(label)} للنشر الأول من صفحة النشر"` : ""}>＋ ${esc(label)}</button>`;
    };
    return `<section class="fs-card"><h3>🔗 حسابات الإعلانات</h3>
      ${(d.ad_accounts || []).length ? `<div class="am-accs">${d.ad_accounts.map((a) => `<span class="am-acc"><b>${esc(platName(a.platform))}</b> ${esc(a.name)} <small dir="ltr">${esc(a.ad_account)} · ${esc(a.currency)}</small></span>`).join("")}</div>` : `<p class="nb-hint">لسه مفيش حساب إعلانات مربوط.</p>`}
      <div class="nb-bar">${btn("facebook", "ميتا (فيسبوك وإنستجرام)")}${btn("tiktok", "تيك توك")}${btn("google", "جوجل ويوتيوب")}${btn("linkedin", "لينكدإن")}${btn("pinterest", "بنترست")}${btn("x", "X")}</div>
      <p class="nb-hint">ميتا ولينكدإن وبنترست بيستخدموا نفس ربط النشر. تيك توك وX وجوجل بيطلبوا تسجيل دخول على المنصة نفسها وبعدها بترجع هنا.</p></section>`;
  }
  // 🎯 الاستهداف: نفس البلوك في الترويج والإعلان الجديد
  function target(p) {
    const t = S.t, r = S.d.recipe || {};
    return `<div class="am-tg"><div class="am-tgh"><b>🎯 الاستهداف</b>
        <button class="nb-btn sm fs-go" data-amfill ${!r.summary || S.busy ? "disabled" : ""}>${S.busy === "fill" ? "⏳ بيدوّر على الاهتمامات…" : "🎯 املاه من الوصفة"}</button></div>
      <div class="am-row"><label>السن <input type="number" min="13" max="65" data-amt="age_min" value="${t.age_min}"> لـ <input type="number" min="13" max="65" data-amt="age_max" value="${t.age_max}"></label></div>
      ${p === "google" ? "" : `<div class="am-row"><b>البلاد</b><span>${t.countries.map((c) => `<span class="pl-chip" dir="ltr">${esc(c)} <i data-amrmc="${esc(c)}">✕</i></span>`).join("")}</span>
        <input type="text" maxlength="2" placeholder="SA" dir="ltr" data-amcin class="am-sm"><button class="nb-btn sm" data-amcadd>＋</button></div>
      <div class="am-row"><b>الاهتمامات</b><span>${t.interests.map((i) => `<span class="pl-chip">${esc(i.name)} <i data-amrmi="${esc(i.id)}">✕</i></span>`).join("") || `<small class="nb-hint">من غير اهتمامات = جمهور واسع في البلاد والسن دول</small>`}</span></div>
      <div class="am-row"><input type="text" placeholder="دوّر على اهتمام (بالإنجليزي أحسن): Fitness" dir="auto" data-amq><button class="nb-btn sm" data-amsearch>🔍</button></div>
      ${S.hits.length ? `<div class="am-row">${S.hits.map((h) => `<button class="pl-chip am-hit" data-amhit="${esc(h.id)}">＋ ${esc(h.name)}</button>`).join("")}</div>` : ""}`}
      ${r.locations?.length ? `<p class="nb-hint">الوصفة بتقول: ${esc(r.locations.join("، "))}</p>` : ""}</div>`;
  }
  function common(p, accs) {
    const goals = S.d.goals[p] || {}, min = S.d.min_budget[p] || 1, b = +val("budget", Math.max(5, min)), days = +val("days", 7);
    if (!goals[S.f.goal]) S.f.goal = Object.keys(goals)[0];
    return `<div class="am-row"><label>حساب الإعلانات <select data-amf="ad_account">${accs.map((a) => `<option value="${esc(a.ad_account)}" ${a.ad_account === val("ad_account") ? "selected" : ""}>${esc(a.name)} (${esc(a.currency)})</option>`).join("")}</select></label>
        <label>الهدف <select data-amf="goal">${opts(goals, val("goal", Object.keys(goals)[0]))}</select></label></div>
      <div class="am-row"><label>ميزانية يومية <input type="number" min="${min}" step="1" data-amf="budget" value="${b}"> <span data-amcur>${esc(accs.find((a) => a.ad_account === val("ad_account"))?.currency || accs[0]?.currency || "USD")}</span></label>
        <label>لمدة <input type="number" min="1" max="90" data-amf="days" value="${days}"> يوم</label>
        <span class="nb-hint">الإجمالي حوالي <b class="num">${fmt(b * days)}</b> · أقل يومية هنا ${min}</span></div>
      <div class="am-row"><label>اسم الإعلان (ليك انت) <input type="text" data-amf="name" value="${esc(val("name"))}" placeholder="مثلًا: عرض الشتا"></label></div>`;
  }
  function noAcc(p) {
    return `<div class="fs-err">⚠️ اربط حساب إعلانات ${esc(platName(p))} الأول من «🔗 حسابات الإعلانات» فوق.</div>`;
  }
  function boostTab() {
    const posts = S.d.posts || [];
    if (!posts.length) return `<section class="fs-card"><h3>🚀 روّج بوست</h3><p class="nb-hint">لسه مفيش بوستات اتنشرت من البرنامج على فيسبوك أو إنستجرام أو تيك توك أو لينكدإن أو بنترست أو X. انشر بوست الأول وبعدين روّجه من هنا.</p></section>`;
    const post = posts.find((x) => x.id === val("post")) || posts[0], p = post.platforms.includes(val("platform")) ? val("platform") : post.platforms[0], accs = accsFor(p);
    S.f.post = post.id; S.f.platform = p;
    if (!accs.some((a) => a.ad_account === val("ad_account"))) S.f.ad_account = accs[0]?.ad_account;
    return `<section class="fs-card"><h3>🚀 روّج بوست <small>البوست نفسه بيوصل لناس أكتر بالاستهداف اللي تختاره</small></h3>
      <div class="am-row"><label>البوست <select data-amf="post">${posts.map((x) => `<option value="${esc(x.id)}" ${x.id === post.id ? "selected" : ""}>${esc((x.name ? x.name + " · " : "") + (x.caption || "").slice(0, 60))}</option>`).join("")}</select></label>
        <label>على <select data-amf="platform">${post.platforms.map((k) => `<option value="${k}" ${k === p ? "selected" : ""}>${esc(platName(k))}</option>`).join("")}</select></label></div>
      ${accs.length ? common(p, accs) + target(p) + `<div class="nb-bar"><button class="nb-btn fs-go" data-amboost ${S.busy ? "disabled" : ""}>${S.busy === "go" ? "⏳ بيعمل الإعلان…" : "🚀 روّج البوست"}</button></div>` : noAcc(p)}</section>`;
  }
  function createTab() {
    const plats = Object.keys(S.d.platforms), p = plats.includes(val("cplatform")) ? val("cplatform") : "facebook", accs = accsFor(p), ex = S.d.exports || [];
    S.f.cplatform = p;
    if (!accs.some((a) => a.ad_account === val("ad_account"))) S.f.ad_account = accs[0]?.ad_account;
    const g = p === "google", lim = g ? [30, 90] : [255, 500];
    return `<section class="fs-card"><h3>✨ إعلان جديد <small>${g ? "إعلان بحث: بيظهر للناس اللي بيدوروا على الكلمات دي" : "صورة أو فيديو بعنوان ونص ودعوة"}</small></h3>
      <div class="am-row"><label>المنصة <select data-amf="cplatform">${opts(S.d.platforms, p)}</select></label></div>
      ${!accs.length ? noAcc(p) : `${common(p, accs)}
      <div class="am-copy"><div class="am-row"><label class="am-grow">بتروّج لإيه؟ <input type="text" data-amf="offer" value="${esc(val("offer"))}" placeholder="مثلًا: خصم ٢٠٪ على التشكيلة الجديدة"></label>
          <button class="nb-btn sm" data-amcopy ${S.busy ? "disabled" : ""}>${S.busy === "copy" ? "⏳ بيكتب…" : "✍️ اكتبهولي من الوصفة"}</button></div>
        <label>العنوان <small class="num">(${lim[0]} حرف)</small><input type="text" maxlength="${lim[0]}" data-amf="headline" value="${esc(val("headline"))}"></label>
        <label>النص <small class="num">(${lim[1]} حرف)</small><textarea rows="3" maxlength="${lim[1]}" data-amf="body">${esc(val("body"))}</textarea></label>
        ${(val("more_headlines", []) || []).length ? `<p class="nb-hint">عناوين بديلة: ${val("more_headlines").map((h) => `<button class="pl-chip" data-amalt="${esc(h)}">${esc(h)}</button>`).join("")}</p>` : ""}
        <div class="am-row"><label class="am-grow">اللينك <input type="url" dir="ltr" data-amf="link" value="${esc(val("link"))}" placeholder="https://"></label>
          ${META.includes(p) ? `<label>الزرار <select data-amf="cta">${opts(S.d.ctas, val("cta", "LEARN_MORE"))}</select></label>` : ""}</div>
        ${g ? `<label>كلمات البحث (كل كلمة في سطر)<textarea rows="4" data-amf="keywords">${esc(val("keywords", (S.d.recipe?.keywords || []).join("\n")))}</textarea></label>`
          : `<label>الصورة/الفيديو <select data-amf="export_id"><option value="">اختار من الفيديوهات الجاهزة</option>${ex.map((e) => `<option value="${esc(e.id)}" ${e.id === val("export_id") ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select></label>`}</div>
      ${target(p)}
      <div class="nb-bar"><button class="nb-btn fs-go" data-amcreate ${S.busy ? "disabled" : ""}>${S.busy === "go" ? "⏳ بيعمل الإعلان…" : "✨ اعمل الإعلان"}</button></div>`}</section>`;
  }
  function listTab() {
    const L = S.d.ads || [];
    if (!L.length) return `<section class="fs-card"><p class="nb-hint">لسه مفيش إعلانات اتعملت من البرنامج للبراند ده.</p></section>`;
    return L.map((a) => {
      const st = ST[a.status] || [a.status, ""], m = a.metrics || {}, on = S.open === a.id;
      return `<article class="fs-card am-ad" data-adid="${esc(a.id)}"><div class="rv-head"><span class="rv-pl">${esc(platName(a.platform))}</span><b>${esc(a.name)}</b>
          <span class="am-st ${st[1]}">${esc(st[0])}</span><small>${a.kind === "boost" ? "ترويج بوست" : "إعلان جديد"} · ${esc(S.d.goals[a.platform]?.[a.goal] || a.goal || "")}</small>
          <span class="rv-acts">${a.status === "active" ? `<button class="nb-btn sm" data-ampause>⏸ وقّف</button>` : a.status === "paused" ? `<button class="nb-btn sm" data-amresume>▶ شغّل</button>` : ""}
            ${["active", "paused"].includes(a.status) ? `<button class="nb-btn sm" data-ambudget>💰 الميزانية</button><button class="nb-btn sm danger" data-amcancel>✕ الغي</button>` : ""}
            <button class="nb-btn sm" data-amstats>${on ? "اقفل" : "📈 التفاصيل"}</button></span></div>
        <div class="rv-stats"><span>صرف <b class="num">${fmt(m.spend)}</b></span><span>ظهر <b class="num">${fmt(m.impressions)}</b></span><span>وصل لـ <b class="num">${fmt(m.reach)}</b></span>
          <span>ضغطات <b class="num">${fmt(m.clicks)}</b></span><span>CTR <b class="num">${m.ctr ?? "—"}%</b></span><span>تمن الضغطة <b class="num">${m.cpc ?? "—"}</b></span>
          ${a.budget?.amount ? `<span>يومي <b class="num">${a.budget.amount}</b></span>` : ""}</div>
        ${a.error ? `<div class="fs-err">⚠️ ${esc(a.error)}</div>` : ""}${on ? `<div class="am-stats" data-amstatbox>بيحمّل…</div>` : ""}</article>`;
    }).join("");
  }
  function audTab() {
    const meta = (S.d.ad_accounts || []).filter((a) => META.includes(a.platform));
    if (!meta.length) return `<section class="fs-card"><h3>👥 الجماهير</h3>${noAcc("facebook")}</section>`;
    const acc = meta.find((a) => a.ad_account === S.audAcc) || meta[0], A = S.aud;
    S.audAcc = acc.ad_account;
    if (!A || A.acc !== acc.ad_account) { loadAud(acc); return `<section class="fs-card"><div class="nh-empty">بيحمّل…</div></section>`; }
    const kind = val("akind", "website"), list = A.audiences || [];
    return `<section class="fs-card"><h3>👥 الجماهير <small>أقوى من الاهتمامات: ناس عرفوك قبل كده، ومنهم جمهور شبيه</small></h3>
      <div class="am-row"><label>حساب ميتا <select data-amaudacc>${meta.map((a) => `<option value="${esc(a.ad_account)}" ${a === acc ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label></div>
      ${list.length ? `<div class="pl-grid">${list.map((x) => `<div class="pl-card"><b>${esc(x.name)}</b><small>${esc({ website: "زوار الموقع", customer_list: "قايمة عملاء", lookalike: "جمهور شبيه" }[x.type] || x.type)}${x.size ? ` · حوالي ${fmt(x.size)}` : ""}</small>
          ${x.type === "customer_list" ? `<button class="nb-btn sm" data-amup="${esc(x.id)}">⬆️ ارفع عملاء (CSV)</button>` : ""}<button class="nb-btn sm danger" data-amaudel="${esc(x.id)}">✕ امسح</button></div>`).join("")}</div>` : `<p class="nb-hint">لسه مفيش جماهير.</p>`}</section>
      <section class="fs-card"><h3>＋ جمهور جديد</h3>
        <div class="am-row"><label>النوع <select data-amf="akind">${opts({ website: "🌐 زوار موقعك (بالبيكسل)", customer_list: "📇 قايمة عملائك", lookalike: "👯 جمهور شبيه" }, kind)}</select></label>
          <label class="am-grow">الاسم <input type="text" data-amf="aname" value="${esc(val("aname"))}" placeholder="مثلًا: زوار آخر ٣٠ يوم"></label></div>
        ${kind === "website" ? `<div class="am-row"><label>البيكسل <select data-amf="pixel">${(A.pixels || []).map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("") || `<option value="">مفيش بيكسل على الحساب</option>`}</select></label>
            <label>آخر <input type="number" min="1" max="180" data-amf="adays" value="${val("adays", 30)}"> يوم</label></div>` : ""}
        ${kind === "lookalike" ? `<div class="am-row"><label>من جمهور <select data-amf="source">${list.filter((x) => x.type !== "lookalike").map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("") || `<option value="">اعمل جمهور زوار أو عملاء الأول</option>`}</select></label>
            <label>البلد <input type="text" maxlength="2" dir="ltr" class="am-sm" data-amf="country" value="${esc(val("country", S.d.recipe?.countries?.[0] || "SA"))}"></label>
            <label>الحجم <select data-amf="ratio">${[1, 2, 3, 5, 10].map((r) => `<option value="${r / 100}" ${+val("ratio", 0.01) === r / 100 ? "selected" : ""}>${r}٪ ${r === 1 ? "(الأقرب ليهم)" : ""}</option>`).join("")}</select></label></div>` : ""}
        ${kind === "customer_list" ? `<p class="nb-hint">بعد ما يتعمل، ارفع ملف CSV فيه إيميل أو رقم كل عميل (الرقم بكود الدولة، مثلًا +966…). لازم يكونوا عملاءك فعلًا ووافقوا إنك تتواصل معاهم، والبيانات بتتشفّر قبل ما توصل لميتا.</p>` : ""}
        <div class="nb-bar"><button class="nb-btn fs-go" data-amaudnew ${S.busy ? "disabled" : ""}>＋ اعمل الجمهور</button></div></section>
      <input type="file" accept=".csv,text/csv" hidden data-amfile>`;
  }
  async function loadAud(acc) {
    try { const r = await api(`/api/ads-audiences?account_id=${encodeURIComponent(acc.account || "")}`); S.aud = { ...r, acc: acc.ad_account }; }
    catch (err) { S.aud = { audiences: [], pixels: [], acc: acc.ad_account }; toast(err.message, true); }
    if (S.tab === "aud") render();
  }
  function render() {
    const w = S.el;
    if (!w || !S.d) return;
    const body = { boost: boostTab, create: createTab, list: listTab, aud: audTab }[S.tab]();
    w.innerHTML = hero() + (S.d.ready ? accounts() + `<nav class="rv-tabs" role="tablist">${TABS.map(([k, t]) => `<button role="tab" data-amtab="${k}" aria-selected="${k === S.tab}" class="${k === S.tab ? "on" : ""}">${t}${k === "list" && S.d.ads?.length ? ` (${S.d.ads.length})` : ""}</button>`).join("")}</nav>` + body : "");
    if (S.open) loadStats(S.open);
  }
  async function loadStats(id) {
    try {
      const r = await api(`/api/ads/${encodeURIComponent(id)}/analytics`), box = S.el.querySelector(`[data-adid="${CSS.escape(id)}"] [data-amstatbox]`);
      if (!box) return;
      const bd = r.breakdowns || {};
      box.innerHTML = Object.keys(bd).length ? Object.entries(bd).map(([k, rows]) => `<p><b>${esc({ age: "السن", gender: "النوع", country: "البلد" }[k] || k)}:</b> ${(rows || []).slice(0, 6).map((x) => `${esc(x.key || x.value || x.age || x.gender || x.country || "")} <span class="num">${fmt(x.spend ?? x.impressions)}</span>`).join(" · ")}</p>`).join("") : `<p class="nb-hint">لسه مفيش تفاصيل.</p>`;
    } catch (err) { toast(err.message, true); }
  }
  const tgBody = () => ({ age_min: +S.t.age_min, age_max: +S.t.age_max, countries: S.t.countries, interests: S.t.interests });
  const accOf = (adAcc) => (S.d.ad_accounts || []).find((a) => a.ad_account === adAcc);
  async function run(kind, fn) {
    S.busy = kind; render();
    try { await fn(); } catch (err) { toast(err.message, true); }
    S.busy = ""; render();
  }
  function bind(w) {
    w.addEventListener("change", (e) => {
      const f = e.target.dataset.amf, t = e.target.dataset.amt;
      if (f) {
        S.f[f] = e.target.value;
        if (["post", "platform", "cplatform", "ad_account", "akind", "budget", "days"].includes(f)) render();
      }
      if (t) S.t[t] = +e.target.value;
      if (e.target.matches("[data-amaudacc]")) { S.audAcc = e.target.value; S.aud = null; render(); }
      if (e.target.matches("[data-amfile]")) upload(e.target);
    });
    w.addEventListener("input", (e) => { const f = e.target.dataset.amf; if (f && !["budget", "days"].includes(f)) S.f[f] = e.target.value; });
    w.addEventListener("click", async (e) => {
      const q = (s) => e.target.closest(s);
      const tb = q("[data-amtab]");
      if (tb) { S.tab = tb.dataset.amtab; S.hits = []; return render(); }
      if (q("[data-amcon]")) {
        const p = q("[data-amcon]").dataset.amcon;
        try { const r = await api("/api/ads/connect", { method: "POST", ...jsonBody({ platform: p }) }); if (r.url) { location.href = r.url; return; } S.d = r; render(); toast("✅ حساب الإعلانات اتربط"); }
        catch (err) { toast(err.message, true); }
        return;
      }
      if (q("[data-amfill]")) {
        const p = S.tab === "boost" ? S.f.platform : S.f.cplatform, acc = accOf(S.f.ad_account);
        return run("fill", async () => {
          const r = await api("/api/ads/targeting", { method: "POST", ...jsonBody({ account_id: acc?.account || "", platform: p }) });
          S.t = { age_min: r.age_min, age_max: r.age_max, countries: r.countries.length ? r.countries : S.t.countries, interests: r.interests };
          if (p === "google" && r.keywords?.length) S.f.keywords = r.keywords.join("\n");
          toast(`🎯 اتملى: ${r.interests.length} اهتمام من ${r.asked.length} في الوصفة${r.countries.length ? "" : " · اختار البلد بنفسك"}`);
        });
      }
      if (q("[data-amcadd]")) { const v = w.querySelector("[data-amcin]").value.trim().toUpperCase(); if (/^[A-Z]{2}$/.test(v) && !S.t.countries.includes(v)) S.t.countries.push(v); return render(); }
      if (q("[data-amrmc]")) { S.t.countries = S.t.countries.filter((c) => c !== q("[data-amrmc]").dataset.amrmc); return render(); }
      if (q("[data-amrmi]")) { S.t.interests = S.t.interests.filter((i) => i.id !== q("[data-amrmi]").dataset.amrmi); return render(); }
      if (q("[data-amsearch]")) {
        const v = w.querySelector("[data-amq]").value.trim(), acc = accOf(S.f.ad_account);
        if (!v) return;
        try { S.hits = await api(`/api/ads/interests?q=${encodeURIComponent(v)}&account_id=${encodeURIComponent(acc?.account || "")}`); if (!S.hits.length) toast("مالقيتش اهتمام بالاسم ده", true); render(); }
        catch (err) { toast(err.message, true); }
        return;
      }
      if (q("[data-amhit]")) { const h = S.hits.find((x) => x.id === q("[data-amhit]").dataset.amhit); if (h && !S.t.interests.some((i) => i.id === h.id)) S.t.interests.push({ id: h.id, name: h.name }); S.hits = []; return render(); }
      if (q("[data-amalt]")) { S.f.headline = q("[data-amalt]").dataset.amalt; return render(); }
      if (q("[data-amcopy]")) {
        return run("copy", async () => {
          const r = await api("/api/ads/copy", { method: "POST", ...jsonBody({ platform: S.f.cplatform, offer: S.f.offer || "" }) });
          Object.assign(S.f, { headline: r.headline, body: r.body, more_headlines: r.more_headlines, more_bodies: r.more_bodies, cta: r.cta });
        });
      }
      const common = () => { const acc = accOf(S.f.ad_account); return { ad_account: S.f.ad_account, account_id: META.includes(acc?.platform) ? "" : acc?.account || "", name: S.f.name || "", goal: S.f.goal || Object.keys(S.d.goals[S.tab === "boost" ? S.f.platform : S.f.cplatform] || {})[0], budget: +(S.f.budget || 5), days: +(S.f.days || 7), currency: acc?.currency || "USD", targeting: tgBody() }; };
      const confirmSpend = (c) => uiConfirm(`هيتعمل إعلان بميزانية ${c.budget} ${c.currency} في اليوم لمدة ${c.days} يوم (حوالي ${fmt(c.budget * c.days)} ${c.currency})، والفلوس دي بتتدفع للمنصة من حساب إعلاناتك. + ${S.d.fee} نقطة للبرنامج. تكمّل؟`);
      if (q("[data-amboost]")) {
        const c = common();
        if (!(await confirmSpend(c))) return;
        return run("go", async () => { S.d = await api("/api/ads/boost", { method: "POST", ...jsonBody({ ...c, platform: S.f.platform, post_id: S.f.post }) }); S.tab = "list"; toast("🚀 الإعلان اتعمل، بيتراجع من المنصة وبعدها بيشتغل"); });
      }
      if (q("[data-amcreate]")) {
        const c = common();
        if (!(await confirmSpend(c))) return;
        return run("go", async () => {
          S.d = await api("/api/ads/create", { method: "POST", ...jsonBody({ ...c, platform: S.f.cplatform, headline: S.f.headline || "", body: S.f.body || "", link: S.f.link || "", export_id: S.f.export_id || "",
            cta: S.f.cta || "LEARN_MORE", keywords: String(S.f.keywords ?? (S.d.recipe?.keywords || []).join("\n")).split("\n").map((x) => x.trim()).filter(Boolean), more_headlines: S.f.more_headlines || [], more_bodies: S.f.more_bodies || [] }) });
          S.tab = "list"; toast("✨ الإعلان اتعمل، بيتراجع من المنصة وبعدها بيشتغل");
        });
      }
      const id = q("[data-adid]")?.dataset.adid;
      if (id) {
        const patch = (b) => run("x", async () => { S.d = await api(`/api/ads/${encodeURIComponent(id)}`, { method: "PATCH", ...jsonBody(b) }); });
        if (q("[data-ampause]")) return patch({ status: "paused" });
        if (q("[data-amresume]")) return patch({ status: "active" });
        if (q("[data-ambudget]")) { const v = await uiPrompt("الميزانية اليومية الجديدة:"); if (v && +v > 0) patch({ budget: +v }); return; }
        if (q("[data-amcancel]")) { if (await uiConfirm("تلغي الإعلان ده؟ مش هيرجع تاني.")) run("x", async () => { S.d = await api(`/api/ads/${encodeURIComponent(id)}`, { method: "DELETE" }); }); return; }
        if (q("[data-amstats]")) { S.open = S.open === id ? null : id; return render(); }
      }
      const acc = (S.d.ad_accounts || []).find((a) => a.ad_account === S.audAcc);
      if (q("[data-amaudnew]")) {
        const k = S.f.akind || "website";
        return run("aud", async () => {
          const r = await api("/api/ads-audiences", { method: "POST", ...jsonBody({ account_id: acc?.account || "", ad_account: S.audAcc, name: S.f.aname || "", kind: k, source: S.f.source || w.querySelector('[data-amf="source"]')?.value || "",
            country: S.f.country || w.querySelector('[data-amf="country"]')?.value || "", ratio: +(S.f.ratio || 0.01), pixel: S.f.pixel || w.querySelector('[data-amf="pixel"]')?.value || "", days: +(S.f.adays || 30) }) });
          S.aud = { ...r, acc: S.audAcc }; S.f.aname = ""; toast("✅ الجمهور اتعمل" + (k === "customer_list" ? "، ارفع العملاء دلوقتي" : ""));
        });
      }
      if (q("[data-amaudel]")) {
        if (!(await uiConfirm("تمسح الجمهور ده من المنصة؟"))) return;
        return run("aud", async () => { const r = await api(`/api/ads-audiences/${encodeURIComponent(q("[data-amaudel]").dataset.amaudel)}?account_id=${encodeURIComponent(acc?.account || "")}`, { method: "DELETE" }); S.aud = { ...r, acc: S.audAcc }; });
      }
      if (q("[data-amup]")) { const f = w.querySelector("[data-amfile]"); f.dataset.aid = q("[data-amup]").dataset.amup; f.value = ""; f.click(); }
    });
  }
  async function upload(input) {
    const f = input.files?.[0];
    if (!f) return;
    if (!(await uiConfirm("العملاء اللي في الملف ده عملاءك فعلًا ووافقوا إنك تتواصل معاهم؟"))) return;
    const fd = new FormData();
    fd.append("file", f); fd.append("consent", "yes");
    try { const r = await api(`/api/ads-audiences/${encodeURIComponent(input.dataset.aid)}/users`, { method: "POST", body: fd }); toast(`✅ اترفع ${r.uploaded} عميل`); S.aud = null; render(); }
    catch (err) { toast(err.message, true); }
  }
  async function mount(root) {
    const w = root.querySelector("#amWrap");
    if (!w) return;
    S.el = w; S.aud = null; S.open = null;
    bind(w);
    try {
      S.d = await api("/api/ads");
      if (S.d.recipe?.age) S.t = { ...S.t, age_min: S.d.recipe.age[0], age_max: S.d.recipe.age[1], countries: S.d.recipe.countries || [] };
      render();
    } catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  // راجع من تسجيل الدخول على منصة الإعلانات: افتح العقل وبعدين إعلاناتك
  if (BACK) window.addEventListener("load", () => setTimeout(() => { if (typeof NH !== "undefined" && NH) { NH.openBrand(); setTimeout(() => window.NHNav?.("adsmgr"), 1500); } }, 1200));
  return { html, mount, close: () => {} };
})();
