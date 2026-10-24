// 📣 «إعلاناتك» (فرع منافسينك في عقل العلامة): ترويج بوست اتنشر، إعلان جديد من الصفر، متابعة الإعلانات، والجماهير.
// الاستهداف بيتملي من «🎯 وصفة الاستهداف» (اهتمامات حقيقية من المنصة نفسها + سن + بلاد + كلمات بحث)، وفلوس الإعلان بتتدفع للمنصة من حساب إعلانات العميل.
const AdsMgrPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const BACK = location.hash === "#adsmgr";   // راجع من تسجيل الدخول على منصة الإعلانات
  const S = { el: null, d: null, tab: "boost", dw: null, menu: null, busy: "", t: { age_min: 18, age_max: 45, countries: [], interests: [] }, f: {}, hits: [], aud: null, audAcc: "", open: null };
  const META = ["facebook", "instagram"];
  const html = () => `<div class="nb-wrap fs-wrap rv-wrap" id="amWrap"><div class="nh-empty">جارٍ التحميل…</div></div>`;
  const fmt = (n) => { n = +n || 0; return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n * 100) / 100); };
  const ST = { active: ["يعمل", "ok"], paused: ["متوقف", "wait"], pending: ["قيد المراجعة", "wait"], in_review: ["قيد المراجعة", "wait"], rejected: ["مرفوض", "bad"], completed: ["انتهى", ""], cancelled: ["ملغى", ""], unknown: ["…", ""] };
  const accsFor = (p) => (S.d.ad_accounts || []).filter((a) => a.platform === p || (META.includes(p) && META.includes(a.platform)));
  const platName = (p) => S.d.platforms[p] || p;
  const opts = (o, cur) => Object.entries(o).map(([k, t]) => `<option value="${esc(k)}" ${k === cur ? "selected" : ""}>${esc(t)}</option>`).join("");
  const val = (k, d = "") => S.f[k] ?? d;

  // 📣 من البروتوتايب: الأرقام والإعلانات بس، والترويج والإعلان الجديد والجماهير والحسابات في درج على الجنب
  const DW = { boost: "روّج منشورًا", create: "إعلان جديد", aud: "الجماهير المخصصة", acc: "حسابات الإعلانات" };
  // حسابات الإعلانات: ميتا ولينكدإن وبنترست تستخدم ربط النشر، وتيك توك وX تسجّل الدخول، وجوجل وحده
  function accounts() {
    const d = S.d, social = new Set((d.social || []).map((a) => a.platform));
    const btn = (p, label) => {
      const has = accsFor(p).length, needSocial = p !== "google" && !social.has(p) && !(META.includes(p) && META.some((m) => social.has(m)));
      return `<label class="pk-tg${needSocial && !has ? " dim" : ""}">${esc(label)}${has ? `<span class="pk-ok">✓ مربوط</span>`
        : `<button class="pk-chip" data-amcon="${p}" ${needSocial ? `disabled title="اربط حساب ${esc(label)} للنشر أولًا من صفحة النشر"` : ""}>اربط</button>`}</label>`;
    };
    return `${(d.ad_accounts || []).map((a) => `<div class="pk-li"><b>${esc(platName(a.platform))}</b><small>${esc(a.name)} · <span dir="ltr">${esc(a.ad_account)} · ${esc(a.currency)}</span></small></div>`).join("")}
      ${btn("facebook", "ميتا (فيسبوك وإنستجرام)")}${btn("tiktok", "تيك توك")}${btn("google", "جوجل ويوتيوب")}${btn("linkedin", "لينكدإن")}${btn("pinterest", "بنترست")}${btn("x", "X")}
      <p class="pk-note">ميتا ولينكدإن ونترست تستخدم ربط النشر نفسه. تيك توك وX وجوجل تطلب تسجيل الدخول على المنصة ثم تعود إلى هنا.</p>`;
  }
  // 🎯 الاستهداف: البلوك نفسه في الترويج والإعلان الجديد
  function target(p) {
    const t = S.t, r = S.d.recipe || {};
    return `<div class="pk-dh"><b class="pk-h3">الاستهداف</b>
        <button class="pk-chip" data-amfill ${!r.summary || S.busy ? "disabled" : ""} ${r.summary ? "" : `title="وافق على المنافسين أولًا لتُصنع وصفة الاستهداف"`}>${S.busy === "fill" ? "جارٍ البحث…" : "املأه من الوصفة"}</button></div>
      <div class="pk-row2"><label class="pk-f">من سن<input type="number" min="13" max="65" data-amt="age_min" value="${t.age_min}"></label><label class="pk-f">إلى<input type="number" min="13" max="65" data-amt="age_max" value="${t.age_max}"></label></div>
      ${p === "google" ? "" : `<div class="pk-f">الدول<div class="pk-pills">${t.countries.map((c) => `<span class="pk-pill" dir="ltr">${esc(c)}<i data-amrmc="${esc(c)}">✕</i></span>`).join("")}
          <input type="text" maxlength="2" placeholder="SA" dir="ltr" data-amcin class="pk-in2">${pkIb("plus", "أضف الدولة", "data-amcadd", "sm")}</div></div>
      <div class="pk-f">الاهتمامات<div class="pk-pills">${t.interests.map((i) => `<span class="pk-pill">${esc(i.name)}<i data-amrmi="${esc(i.id)}">✕</i></span>`).join("") || `<small>بدون اهتمامات = جمهور واسع في هذه الدول والأعمار</small>`}</div></div>
      <div class="pk-row2"><input type="text" class="pk-q" placeholder="ابحث عن اهتمام (بالإنجليزية أفضل): Fitness" dir="auto" data-amq>${pkIb("search", "ابحث", "data-amsearch", "sm")}</div>
      ${S.hits.length ? `<div class="pk-pills">${S.hits.map((h) => `<button class="pk-pill add" data-amhit="${esc(h.id)}">＋ ${esc(h.name)}</button>`).join("")}</div>` : ""}`}
      ${r.locations?.length ? `<p class="pk-note">الوصفة تقترح: ${esc(r.locations.join("، "))}</p>` : ""}`;
  }
  function common(p, accs) {
    const goals = S.d.goals[p] || {}, min = S.d.min_budget[p] || 1, b = +val("budget", Math.max(5, min)), days = +val("days", 7);
    if (!goals[S.f.goal]) S.f.goal = Object.keys(goals)[0];
    const cur = accs.find((a) => a.ad_account === val("ad_account"))?.currency || accs[0]?.currency || "USD";
    return `<label class="pk-f">حساب الإعلانات<select data-amf="ad_account">${accs.map((a) => `<option value="${esc(a.ad_account)}" ${a.ad_account === val("ad_account") ? "selected" : ""}>${esc(a.name)} (${esc(a.currency)})</option>`).join("")}</select></label>
      <label class="pk-f">الهدف<select data-amf="goal">${opts(goals, val("goal", Object.keys(goals)[0]))}</select></label>
      <div class="pk-row2"><label class="pk-f">الميزانية اليومية (${esc(cur)})<input type="number" min="${min}" step="1" data-amf="budget" value="${b}"></label>
        <label class="pk-f">المدة بالأيام<input type="number" min="1" max="90" data-amf="days" value="${days}"></label></div>
      <p class="pk-note">الإجمالي نحو <b class="num">${fmt(b * days)}</b> ${esc(cur)} · أقل ميزانية يومية ${min}</p>
      <label class="pk-f">اسم الإعلان (لك فقط)<input type="text" data-amf="name" value="${esc(val("name"))}" placeholder="مثلًا: عرض الشتاء"></label>`;
  }
  const noAcc = (p) => `<p class="pk-err">اربط حساب إعلانات ${esc(platName(p))} أولًا.</p><button class="pk-chip" data-amdw="acc">حسابات الإعلانات</button>`;
  const goBtn = (attr, t) => `<div class="pk-dacts"><button class="nb-btn fs-go" ${attr} ${S.busy ? "disabled" : ""}>${S.busy === "go" ? "جارٍ إنشاء الإعلان…" : t}</button></div>`;
  function boostTab() {
    const posts = S.d.posts || [];
    if (!posts.length) return `<p class="pk-note">لا توجد منشورات نُشرت من البرنامج بعد. انشر منشورًا أولًا ثم روّجه من هنا.</p>`;
    const post = posts.find((x) => x.id === val("post")) || posts[0], p = post.platforms.includes(val("platform")) ? val("platform") : post.platforms[0], accs = accsFor(p);
    S.f.post = post.id; S.f.platform = p;
    if (!accs.some((a) => a.ad_account === val("ad_account"))) S.f.ad_account = accs[0]?.ad_account;
    return `<label class="pk-f">المنشور<select data-amf="post">${posts.map((x) => `<option value="${esc(x.id)}" ${x.id === post.id ? "selected" : ""}>${esc((x.name ? x.name + " · " : "") + (x.caption || "").slice(0, 60))}</option>`).join("")}</select></label>
      <label class="pk-f">على<select data-amf="platform">${post.platforms.map((k) => `<option value="${k}" ${k === p ? "selected" : ""}>${esc(platName(k))}</option>`).join("")}</select></label>
      ${accs.length ? common(p, accs) + target(p) + goBtn("data-amboost", "روّج المنشور") : noAcc(p)}`;
  }
  function createTab() {
    const plats = Object.keys(S.d.platforms), p = plats.includes(val("cplatform")) ? val("cplatform") : "facebook", accs = accsFor(p), ex = S.d.exports || [];
    S.f.cplatform = p;
    if (!accs.some((a) => a.ad_account === val("ad_account"))) S.f.ad_account = accs[0]?.ad_account;
    const g = p === "google", lim = g ? [30, 90] : [255, 500];
    return `<label class="pk-f">المنصة<select data-amf="cplatform">${opts(S.d.platforms, p)}</select></label>
      <p class="pk-note">${g ? "إعلان بحث: يظهر لمن يبحث عن هذه الكلمات" : "صورة أو فيديو مع عنوان ونص ودعوة"}</p>
      ${!accs.length ? noAcc(p) : `${common(p, accs)}
      <div class="pk-row2"><label class="pk-f pk-grow">ما الذي تروّج له؟<input type="text" data-amf="offer" value="${esc(val("offer"))}" placeholder="مثلًا: خصم ٢٠٪ على التشكيلة الجديدة"></label>
        ${pkIb("spark", S.busy === "copy" ? "جارٍ الكتابة…" : "اكتبه لي من الوصفة", `data-amcopy ${S.busy ? "disabled" : ""}`, "sm")}</div>
      <label class="pk-f">العنوان (${lim[0]} حرفًا)<input type="text" maxlength="${lim[0]}" data-amf="headline" value="${esc(val("headline"))}"></label>
      <label class="pk-f">النص (${lim[1]} حرف)<textarea rows="3" maxlength="${lim[1]}" data-amf="body">${esc(val("body"))}</textarea></label>
      ${(val("more_headlines", []) || []).length ? `<div class="pk-pills">${val("more_headlines").map((h) => `<button class="pk-pill add" data-amalt="${esc(h)}">${esc(h)}</button>`).join("")}</div>` : ""}
      <label class="pk-f">الرابط<input type="url" dir="ltr" data-amf="link" value="${esc(val("link"))}" placeholder="https://"></label>
      ${META.includes(p) ? `<label class="pk-f">الزر<select data-amf="cta">${opts(S.d.ctas, val("cta", "LEARN_MORE"))}</select></label>` : ""}
      ${g ? `<label class="pk-f">كلمات البحث (كلمة في كل سطر)<textarea rows="4" data-amf="keywords">${esc(val("keywords", (S.d.recipe?.keywords || []).join("\n")))}</textarea></label>`
        : `<label class="pk-f">الصورة أو الفيديو<select data-amf="export_id"><option value="">اختر من الفيديوهات الجاهزة</option>${ex.map((e) => `<option value="${esc(e.id)}" ${e.id === val("export_id") ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select></label>`}
      ${target(p)}${goBtn("data-amcreate", "أنشئ الإعلان")}`}`;
  }
  // صف الإعلان: الاسم والحالة والإنفاق والنتائج، والأوامر في قائمة ⋯
  function row(a) {
    const st = ST[a.status] || [a.status, ""], m = a.metrics || {}, on = S.open === a.id, menu = S.menu === a.id, live = ["active", "paused"].includes(a.status);
    return `<div class="am-r" data-adid="${esc(a.id)}"><span class="am-th" title="${esc(platName(a.platform))}">${pkIc(a.kind === "boost" ? "trend" : "megaphone", 18)}</span>
        <div class="am-n"><b>${esc(a.name)}</b><small>${a.kind === "boost" ? "ترويج منشور" : "إعلان جديد"} · ${esc(S.d.goals[a.platform]?.[a.goal] || a.goal || "")}</small></div>
        <span class="am-st ${st[1]}">${esc(st[0])}</span><span class="num" dir="ltr">${fmt(m.spend)}</span><span class="num">${fmt(m.clicks)} <small>نقرة</small></span>
        <span class="pk-wrapm">${pkIb("more", "خيارات", "data-ammenu", "sm")}${menu ? `<div class="pk-menu" role="menu">
          ${a.status === "active" ? `<button data-ampause>أوقف</button>` : a.status === "paused" ? `<button data-amresume>شغّل</button>` : ""}
          ${live ? `<button data-ambudget>عدّل الميزانية</button>` : ""}<button data-amstats>${on ? "أخفِ التفاصيل" : "التفاصيل"}</button>
          ${live ? `<button class="bad" data-amcancel>ألغِ الإعلان</button>` : ""}</div>` : ""}</span>
        ${a.error ? `<p class="pk-err am-full">⚠️ ${esc(a.error)}</p>` : ""}
        ${on ? `<div class="am-full pk-sub"><span>الظهور <b class="num">${fmt(m.impressions)}</b></span><span>الوصول <b class="num">${fmt(m.reach)}</b></span><span>CTR <b class="num">${m.ctr ?? "—"}%</b></span><span>تكلفة النقرة <b class="num">${m.cpc ?? "—"}</b></span>${a.budget?.amount ? `<span>يوميًا <b class="num">${a.budget.amount}</b></span>` : ""}</div><div class="am-full pk-note" data-amstatbox>جارٍ التحميل…</div>` : ""}</div>`;
  }
  function listView() {
    const L = S.d.ads || [];
    if (!(S.d.ad_accounts || []).length) return `<div class="pk-hero"><span class="pk-big">${pkIc("megaphone", 40)}</span><h2>اربط حساب الإعلانات</h2>
      <p>تُدفع تكلفة الإعلان للمنصة مباشرة من حسابك، ويأخذ البرنامج ${S.d.fee} نقطة فقط عن كل إعلان.</p><button class="nb-btn fs-go" data-amdw="acc">اربط حسابًا</button></div>`;
    const sum = (k) => L.reduce((n, a) => n + (+a.metrics?.[k] || 0), 0), spend = sum("spend"), clicks = sum("clicks");
    return `<div class="pk-kpis"><div><b class="num" dir="ltr">${fmt(spend)}</b><span>الإنفاق</span></div><div><b class="num">${fmt(clicks)}</b><span>نقرة</span></div>
        <div><b class="num" dir="ltr">${clicks ? fmt(spend / clicks) : "—"}</b><span>تكلفة النقرة</span></div><div><b class="num">${L.filter((a) => a.status === "active").length}</b><span>إعلانات تعمل</span></div></div>
      ${L.length ? `<div class="am-rows"><div class="am-r am-hd"><span></span><span>الإعلان</span><span>الحالة</span><span>الإنفاق</span><span>النتائج</span><span></span></div>${L.map(row).join("")}</div>`
        : `<div class="pk-empty">لا توجد إعلانات بعد. اضغط «＋» لإنشاء إعلان، أو روّج منشورًا نُشر.</div>`}`;
  }
  function drawer() {
    if (!S.dw) return "";
    if (S.dw === "aud") { const b = audTab(); return `<aside class="pk-drawer" aria-label="${DW.aud}"><div class="pk-dh"><h2>${DW.aud}</h2>${pkIb("close", "إغلاق", "data-amdx", "sm")}</div>${b}</aside>`; }
    const body = { boost: boostTab, create: createTab, acc: accounts }[S.dw]();
    return `<aside class="pk-drawer" aria-label="${DW[S.dw]}"><div class="pk-dh"><h2>${DW[S.dw]}</h2>${pkIb("close", "إغلاق", "data-amdx", "sm")}</div>${body}</aside>`;
  }
  function audTab() {
    const meta = (S.d.ad_accounts || []).filter((a) => META.includes(a.platform));
    if (!meta.length) return noAcc("facebook");
    const acc = meta.find((a) => a.ad_account === S.audAcc) || meta[0], A = S.aud;
    S.audAcc = acc.ad_account;
    if (!A || A.acc !== acc.ad_account) { loadAud(acc); return `<div class="pk-empty">جارٍ التحميل…</div>`; }
    const kind = val("akind", "website"), list = A.audiences || [];
    return `<p class="pk-note">أقوى من الاهتمامات: أشخاص عرفوك من قبل، ومنهم جمهور مشابه.</p>
      ${meta.length > 1 ? `<label class="pk-f">حساب ميتا<select data-amaudacc>${meta.map((a) => `<option value="${esc(a.ad_account)}" ${a === acc ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>` : ""}
      ${list.map((x) => `<div class="pk-li"><b>${esc(x.name)}</b><small>${esc({ website: "زوار الموقع", customer_list: "قائمة عملاء", lookalike: "جمهور مشابه" }[x.type] || x.type)}${x.size ? ` · نحو ${fmt(x.size)}` : ""}</small>
          <span class="pk-acts">${x.type === "customer_list" ? pkIb("upload", "ارفع العملاء (CSV)", `data-amup="${esc(x.id)}"`, "sm") : ""}${pkIb("trash", "احذف", `data-amaudel="${esc(x.id)}"`, "sm")}</span></div>`).join("") || `<p class="pk-note">لا توجد جماهير بعد.</p>`}
      <b class="pk-h3">جمهور جديد</b>
      <label class="pk-f">النوع<select data-amf="akind">${opts({ website: "زوار موقعك (بالبكسل)", customer_list: "قائمة عملائك", lookalike: "جمهور مشابه" }, kind)}</select></label>
      <label class="pk-f">الاسم<input type="text" data-amf="aname" value="${esc(val("aname"))}" placeholder="مثلًا: زوار آخر ٣٠ يومًا"></label>
      ${kind === "website" ? `<div class="pk-row2"><label class="pk-f">البكسل<select data-amf="pixel">${(A.pixels || []).map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("") || `<option value="">لا يوجد بكسل على الحساب</option>`}</select></label>
          <label class="pk-f">آخر (يوم)<input type="number" min="1" max="180" data-amf="adays" value="${val("adays", 30)}"></label></div>` : ""}
      ${kind === "lookalike" ? `<label class="pk-f">من جمهور<select data-amf="source">${list.filter((x) => x.type !== "lookalike").map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("") || `<option value="">أنشئ جمهور زوار أو عملاء أولًا</option>`}</select></label>
          <div class="pk-row2"><label class="pk-f">الدولة<input type="text" maxlength="2" dir="ltr" data-amf="country" value="${esc(val("country", S.d.recipe?.countries?.[0] || "SA"))}"></label>
          <label class="pk-f">الحجم<select data-amf="ratio">${[1, 2, 3, 5, 10].map((r) => `<option value="${r / 100}" ${+val("ratio", 0.01) === r / 100 ? "selected" : ""}>${r}٪ ${r === 1 ? "(الأقرب)" : ""}</option>`).join("")}</select></label></div>` : ""}
      ${kind === "customer_list" ? `<p class="pk-note">بعد إنشائه، ارفع ملف CSV فيه بريد أو رقم كل عميل (بمفتاح الدولة، مثل +966…). يجب أن يكونون عملاءك فعلًا وقد وافقوا على التواصل، وتُشفَّر البيانات قبل وصولها إلى ميتا.</p>` : ""}
      <div class="pk-dacts"><button class="nb-btn fs-go" data-amaudnew ${S.busy ? "disabled" : ""}>أنشئ الجمهور</button></div>
      <input type="file" accept=".csv,text/csv" hidden data-amfile>`;
  }
  async function loadAud(acc) {
    try { const r = await api(`/api/ads-audiences?account_id=${encodeURIComponent(acc.account || "")}`); S.aud = { ...r, acc: acc.ad_account }; }
    catch (err) { S.aud = { audiences: [], pixels: [], acc: acc.ad_account }; toast(err.message, true); }
    if (S.dw === "aud") render();
  }
  function render() {
    const w = S.el;
    if (!w || !S.d) return;
    const d = S.d, ok = d.ready && (d.ad_accounts || []).length;
    w.innerHTML = `<div class="pk"><div class="pk-top"><div class="pk-sub">${d.mock ? `<span>وضع تجربة: أرقام تجريبية</span>` : ""}${d.recipe?.summary ? `<span data-tip="${esc(d.recipe.summary.slice(0, 90))}">الاستهداف من وصفة الاستهداف</span>` : ""}</div>
        <div class="pk-acts">${d.ready ? pkIb("link", "حسابات الإعلانات", 'data-amdw="acc"') : ""}${ok ? pkIb("users", "الجماهير المخصصة", 'data-amdw="aud"') + pkIb("trend", "روّج منشورًا", 'data-amdw="boost"') + pkIb("plus", "إعلان جديد بوصفة الاستهداف", 'data-amdw="create"', "blk") : ""}</div></div>
      ${!d.ready ? `<p class="pk-err">خدمة الإعلانات غير متصلة بعد. تواصل مع الدعم.</p>` : d.error ? `<p class="pk-err">⚠️ ${esc(d.error)}</p>` : ""}
      ${d.ready ? listView() : ""}${drawer()}</div>`;
    if (S.open) loadStats(S.open);
  }
  async function loadStats(id) {
    try {
      const r = await api(`/api/ads/${encodeURIComponent(id)}/analytics`), box = S.el.querySelector(`[data-adid="${CSS.escape(id)}"] [data-amstatbox]`);
      if (!box) return;
      const bd = r.breakdowns || {};
      box.innerHTML = Object.keys(bd).length ? Object.entries(bd).map(([k, rows]) => `<p><b>${esc({ age: "السن", gender: "النوع", country: "البلد" }[k] || k)}:</b> ${(rows || []).slice(0, 6).map((x) => `${esc(x.key || x.value || x.age || x.gender || x.country || "")} <span class="num">${fmt(x.spend ?? x.impressions)}</span>`).join(" · ")}</p>`).join("") : "لا توجد تفاصيل بعد.";
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
      const dw = q("[data-amdw]");
      if (dw) { S.dw = dw.dataset.amdw; S.tab = S.dw; S.hits = []; S.menu = null; return render(); }
      if (q("[data-amdx]")) { S.dw = null; return render(); }
      if (q("[data-ammenu]")) { const id = q("[data-adid]").dataset.adid; S.menu = S.menu === id ? null : id; return render(); }
      if (S.menu && !q(".pk-menu")) { S.menu = null; render(); }
      if (q("[data-amcon]")) {
        const p = q("[data-amcon]").dataset.amcon;
        try { const r = await api("/api/ads/connect", { method: "POST", ...jsonBody({ platform: p }) }); if (r.url) { location.href = r.url; return; } S.d = r; render(); toast("✓ رُبط حساب الإعلانات"); }
        catch (err) { toast(err.message, true); }
        return;
      }
      if (q("[data-amfill]")) {
        const p = S.dw === "boost" ? S.f.platform : S.f.cplatform, acc = accOf(S.f.ad_account);
        return run("fill", async () => {
          const r = await api("/api/ads/targeting", { method: "POST", ...jsonBody({ account_id: acc?.account || "", platform: p }) });
          S.t = { age_min: r.age_min, age_max: r.age_max, countries: r.countries.length ? r.countries : S.t.countries, interests: r.interests };
          if (p === "google" && r.keywords?.length) S.f.keywords = r.keywords.join("\n");
          toast(`✓ أُضيف ${r.interests.length} اهتمامًا من ${r.asked.length} في الوصفة${r.countries.length ? "" : " · اختر الدولة بنفسك"}`);
        });
      }
      if (q("[data-amcadd]")) { const v = w.querySelector("[data-amcin]").value.trim().toUpperCase(); if (/^[A-Z]{2}$/.test(v) && !S.t.countries.includes(v)) S.t.countries.push(v); return render(); }
      if (q("[data-amrmc]")) { S.t.countries = S.t.countries.filter((c) => c !== q("[data-amrmc]").dataset.amrmc); return render(); }
      if (q("[data-amrmi]")) { S.t.interests = S.t.interests.filter((i) => i.id !== q("[data-amrmi]").dataset.amrmi); return render(); }
      if (q("[data-amsearch]")) {
        const v = w.querySelector("[data-amq]").value.trim(), acc = accOf(S.f.ad_account);
        if (!v) return;
        try { S.hits = await api(`/api/ads/interests?q=${encodeURIComponent(v)}&account_id=${encodeURIComponent(acc?.account || "")}`); if (!S.hits.length) toast("لم أجد اهتمامًا بهذا الاسم", true); render(); }
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
      const common = () => { const acc = accOf(S.f.ad_account); return { ad_account: S.f.ad_account, account_id: META.includes(acc?.platform) ? "" : acc?.account || "", name: S.f.name || "", goal: S.f.goal || Object.keys(S.d.goals[S.dw === "boost" ? S.f.platform : S.f.cplatform] || {})[0], budget: +(S.f.budget || 5), days: +(S.f.days || 7), currency: acc?.currency || "USD", targeting: tgBody() }; };
      const confirmSpend = (c) => uiConfirm(`سيُنشأ إعلان بميزانية ${c.budget} ${c.currency} يوميًا لمدة ${c.days} يومًا (نحو ${fmt(c.budget * c.days)} ${c.currency})، ويُدفع هذا المبلغ للمنصة من حساب إعلاناتك، إضافة إلى ${S.d.fee} نقطة للبرنامج. هل تتابع؟`);
      if (q("[data-amboost]")) {
        const c = common();
        if (!(await confirmSpend(c))) return;
        return run("go", async () => { S.d = await api("/api/ads/boost", { method: "POST", ...jsonBody({ ...c, platform: S.f.platform, post_id: S.f.post }) }); S.dw = null; toast("✓ أُنشئ الإعلان، وستراجعه المنصة ثم يبدأ"); });
      }
      if (q("[data-amcreate]")) {
        const c = common();
        if (!(await confirmSpend(c))) return;
        return run("go", async () => {
          S.d = await api("/api/ads/create", { method: "POST", ...jsonBody({ ...c, platform: S.f.cplatform, headline: S.f.headline || "", body: S.f.body || "", link: S.f.link || "", export_id: S.f.export_id || "",
            cta: S.f.cta || "LEARN_MORE", keywords: String(S.f.keywords ?? (S.d.recipe?.keywords || []).join("\n")).split("\n").map((x) => x.trim()).filter(Boolean), more_headlines: S.f.more_headlines || [], more_bodies: S.f.more_bodies || [] }) });
          S.dw = null; toast("✓ أُنشئ الإعلان، وستراجعه المنصة ثم يبدأ");
        });
      }
      const id = q("[data-adid]")?.dataset.adid;
      if (id) {
        const patch = (b) => run("x", async () => { S.d = await api(`/api/ads/${encodeURIComponent(id)}`, { method: "PATCH", ...jsonBody(b) }); });
        if (q("[data-ampause]")) return patch({ status: "paused" });
        if (q("[data-amresume]")) return patch({ status: "active" });
        if (q("[data-ambudget]")) { const v = await uiPrompt("الميزانية اليومية الجديدة:"); if (v && +v > 0) patch({ budget: +v }); return; }
        if (q("[data-amcancel]")) { if (await uiConfirm("هل تلغي هذا الإعلان؟ لا يمكن التراجع.")) run("x", async () => { S.d = await api(`/api/ads/${encodeURIComponent(id)}`, { method: "DELETE" }); }); return; }
        if (q("[data-amstats]")) { S.menu = null; S.open = S.open === id ? null : id; return render(); }
      }
      const acc = (S.d.ad_accounts || []).find((a) => a.ad_account === S.audAcc);
      if (q("[data-amaudnew]")) {
        const k = S.f.akind || "website";
        return run("aud", async () => {
          const r = await api("/api/ads-audiences", { method: "POST", ...jsonBody({ account_id: acc?.account || "", ad_account: S.audAcc, name: S.f.aname || "", kind: k, source: S.f.source || w.querySelector('[data-amf="source"]')?.value || "",
            country: S.f.country || w.querySelector('[data-amf="country"]')?.value || "", ratio: +(S.f.ratio || 0.01), pixel: S.f.pixel || w.querySelector('[data-amf="pixel"]')?.value || "", days: +(S.f.adays || 30) }) });
          S.aud = { ...r, acc: S.audAcc }; S.f.aname = ""; toast("✓ أُنشئ الجمهور" + (k === "customer_list" ? "، ارفع العملاء الآن" : ""));
        });
      }
      if (q("[data-amaudel]")) {
        if (!(await uiConfirm("هل تحذف هذا الجمهور من المنصة؟"))) return;
        return run("aud", async () => { const r = await api(`/api/ads-audiences/${encodeURIComponent(q("[data-amaudel]").dataset.amaudel)}?account_id=${encodeURIComponent(acc?.account || "")}`, { method: "DELETE" }); S.aud = { ...r, acc: S.audAcc }; });
      }
      if (q("[data-amup]")) { const f = w.querySelector("[data-amfile]"); f.dataset.aid = q("[data-amup]").dataset.amup; f.value = ""; f.click(); }
    });
  }
  async function upload(input) {
    const f = input.files?.[0];
    if (!f) return;
    if (!(await uiConfirm("هل العملاء في هذا الملف عملاؤك فعلًا ووافقوا على التواصل معهم؟"))) return;
    const fd = new FormData();
    fd.append("file", f); fd.append("consent", "yes");
    try { const r = await api(`/api/ads-audiences/${encodeURIComponent(input.dataset.aid)}/users`, { method: "POST", body: fd }); toast(`✓ رُفع ${r.uploaded} عميلًا`); S.aud = null; render(); }
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
  if (BACK) window.addEventListener("load", () => setTimeout(() => { if (typeof NH !== "undefined" && NH) { NH.openPublish("adsmgr"); } }, 1200));
  return { html, mount, close: () => {} };
})();
