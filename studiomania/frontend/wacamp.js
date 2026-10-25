// 💬 «حملات واتساب»: للمشتركين الذين وافقوا فقط.
// من البروتوتايب: الأرقام ومصادر الاشتراك وقائمة الحملات أو السلاسل أو المشتركين، وكل نموذج في درج على الجنب.
const WaCampPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, d: null, seg: "camp", dw: null, menu: null, busy: "", f: {}, cs: null, steps: [{ template: "", delay_hours: 0 }] };
  const TST = { APPROVED: ["معتمدة", "ok"], PENDING: ["قيد المراجعة", "wait"], REJECTED: ["مرفوضة", "bad"], PAUSED: ["متوقفة", "wait"], DISABLED: ["مغلقة", "bad"] };
  const BST = { completed: "تم الإرسال", sending: "جارٍ الإرسال", scheduled: "مجدولة", draft: "مسودة", cancelled: "ملغاة", failed: "فشلت" };
  const DW = { link: "رابط ورمز QR", auto: "كلمة في التعليقات", add: "أضف عملاء وافقوا", tpl: "الرسائل المعتمدة", bc: "حملة جديدة", seq: "سلسلة متابعة جديدة" };
  const html = () => `<div class="nb-wrap fs-wrap rv-wrap" id="waWrap"><div class="nh-empty">جارٍ التحميل…</div></div>`;
  const val = (k, d = "") => S.f[k] ?? d;
  const pretty = (u) => { try { return decodeURIComponent(u).replace(/^https:\/\//, ""); } catch { return u; } };
  const approved = () => (S.d.templates || []).filter((t) => t.status === "APPROVED");
  const f = (k, t, v, attrs = "") => `<label class="pk-f">${t}<input type="text" data-waf="${k}" value="${esc(v)}" ${attrs}></label>`;
  const go = (attr, t, busyT) => `<div class="pk-dacts"><button class="nb-btn fs-go" ${attr} ${S.busy ? "disabled" : ""}>${S.busy && busyT ? busyT : t}</button></div>`;

  function linkDw() {
    const d = S.d;
    return `<p class="pk-note">ضعه في النبذة والإعلانات والمحل وعلى المنتج. من يضغط أو يصوّر يفتح محادثة معك والكلمة مكتوبة، فيكون هو من بدأ، وهذه موافقة.</p>
      <label class="pk-f">رقم الواتساب<input type="tel" dir="ltr" data-waf="number" value="${esc(val("number", d.number))}" placeholder="+966501234567"></label>
      ${f("keyword", "الكلمة التي تُكتب تلقائيًا", val("keyword", d.keyword))}
      <div class="pk-dacts"><button class="nb-btn" data-wanum>احفظ</button></div>
      ${d.link ? `<div class="wa-link"><img src="/api/wa/qr.svg?t=${encodeURIComponent(d.link)}" alt="رمز QR لرابط الواتساب" width="132" height="132">
        <div><code dir="ltr">${esc(pretty(d.link))}</code><div class="pk-acts">${pkIb("copy", "انسخ الرابط", `data-wacp="${esc(d.link)}"`, "sm")}
        <a class="pk-ib sm" data-tip="نزّل رمز QR" aria-label="نزّل رمز QR" href="/api/wa/qr.svg" download="whatsapp-qr.svg">${pkIc("download")}</a></div></div></div>
        <p class="pk-note">في إعلانات ميتا اختر هدف «رسائل واتساب» وضع الرقم نفسه.</p>` : `<p class="pk-note">اكتب رقم الواتساب بمفتاح الدولة ليُنشأ الرابط والرمز.</p>`}`;
  }
  function autoDw() {
    const d = S.d, posts = d.posts || [];
    const list = (d.automations || []).map((a) => `<div class="pk-li"><b>${esc(a.name)}</b><span class="pk-pills">${a.keywords.map((k) => `<span class="pk-pill">${esc(k)}</span>`).join("")}</span>
        <span class="am-st ${a.active ? "ok" : ""}">${a.active ? "يعمل" : "متوقف"}</span>${a.stats?.sent != null ? `<small>أُرسل ${a.stats.sent}</small>` : ""}
        <span class="pk-acts">${pkIb(a.active ? "close" : "play", a.active ? "أوقف" : "شغّل", `data-waatog="${esc(a.id)}" data-on="${a.active ? 0 : 1}"`, "sm")}${pkIb("trash", "احذف", `data-waadel="${esc(a.id)}"`, "sm")}</span></div>`).join("");
    if (!posts.length) return `<p class="pk-note">لا توجد منشورات نُشرت من البرنامج على إنستغرام أو فيسبوك بعد.</p>${list}`;
    const p = posts.find((x) => x.id === val("apost")) || posts[0], pl = p.platforms.includes(val("aplat")) ? val("aplat") : p.platforms[0];
    S.f.apost = p.id; S.f.aplat = pl;
    return `<p class="pk-note">من يكتب الكلمة في التعليق تصله رسالة فيها رابط الواتساب.</p>
      <label class="pk-f">المنشور<select data-waf="apost">${posts.map((x) => `<option value="${esc(x.id)}" ${x.id === p.id ? "selected" : ""}>${esc(x.caption.slice(0, 60) || x.id)}</option>`).join("")}</select></label>
      <label class="pk-f">على<select data-waf="aplat">${p.platforms.map((k) => `<option value="${k}" ${k === pl ? "selected" : ""}>${k === "instagram" ? "إنستجرام" : "فيسبوك"}</option>`).join("")}</select></label>
      ${f("akw", "الكلمات (افصل بينها بفاصلة)", val("akw", d.keyword))}${f("areply", "الرد على التعليق", val("areply", "أرسلنا لك رسالة 💬"))}
      <p class="pk-note">الرسالة التي ستصلهم: «أهلًا! تواصل معنا على واتساب من هنا وسنرسل لك التفاصيل: ${esc(d.link ? pretty(d.link) : "(أضف الرقم أولًا)")}»</p>
      ${go("data-waauto", "شغّل الرد التلقائي")}${list}`;
  }
  function addDw() {
    return `<p class="pk-note">اسم ورقم بمفتاح الدولة في كل سطر، أو ملف CSV. للعملاء الذين وافقوا فعلًا على استقبال رسائل منك على واتساب فقط.</p>
      <label class="pk-f">العملاء<textarea rows="5" data-waf="people" placeholder="أحمد, +966501234567&#10;سارة, +201001234567">${esc(val("people"))}</textarea></label>
      ${f("ptag", "وسم (اختياري)", val("ptag"), 'placeholder="مثلًا: عملاء-سابقون"')}
      <label class="pk-tg">أؤكد أن هؤلاء وافقوا على استقبال رسائل مني على واتساب<input type="checkbox" data-waf="consent" ${val("consent") ? "checked" : ""}></label>
      <div class="pk-dacts"><button class="nb-btn fs-go" data-waadd ${S.busy ? "disabled" : ""}>أضفهم</button>${pkIb("upload", "ارفع ملف CSV", "data-wacsv")}</div>
      <input type="file" accept=".csv,text/csv" hidden data-wafile>`;
  }
  const prev = () => `${esc(val("tbody").replace(/\{\{1\}\}/g, "أحمد"))}${val("tcat", "MARKETING") === "MARKETING" ? `<small>${esc(S.d.stop)}</small>` : ""}${val("tbtn") ? `<span>${esc(val("tbtn"))}</span>` : ""}`;
  function tplDw() {
    const d = S.d, cat = val("tcat", "MARKETING"), body = val("tbody");
    return `${(d.templates || []).map((t) => { const st = TST[t.status] || [t.status, ""]; return `<div class="pk-li"><b dir="ltr">${esc(t.name)}</b>
        <span class="am-st ${st[1]}">${esc(st[0])}</span><small>${esc(d.categories[t.category] || t.category)}</small><span class="pk-acts">${pkIb("trash", "احذف", `data-watdel="${esc(t.name)}"`, "sm")}</span>
        <small class="am-full">${esc(t.body)}</small>${t.reason ? `<small class="pk-err">${esc(t.reason)}</small>` : ""}</div>`; }).join("") || `<p class="pk-note">لا توجد رسائل بعد.</p>`}
      <b class="pk-h3">رسالة جديدة</b><p class="pk-note">يراجعها واتساب (من دقائق إلى ٢٤ ساعة) قبل إرسالها.</p>
      <div class="pk-row2">${f("tgoal", "عمّ الرسالة؟", val("tgoal"), 'placeholder="مثلًا: عرض نهاية الأسبوع"')}${pkIb("spark", S.busy === "draft" ? "جارٍ الكتابة…" : "اكتبها لي", `data-wadraft ${S.busy ? "disabled" : ""}`, "sm")}</div>
      <div class="pk-row2"><label class="pk-f">النوع<select data-waf="tcat">${Object.entries(d.categories).map(([k, t]) => `<option value="${k}" ${k === cat ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
        <label class="pk-f">اللغة<select data-waf="tlang">${Object.entries(d.langs).map(([k, t]) => `<option value="${k}" ${k === val("tlang", "ar") ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label></div>
      ${f("tname", "اسم داخلي (بالإنجليزية)", val("tname"), 'dir="ltr" placeholder="weekend_offer"')}
      <label class="pk-f">النص ({{1}} = اسم العميل)<textarea rows="4" data-waf="tbody" maxlength="1000">${esc(body)}</textarea></label>
      ${f("tbtn", "زر رد سريع (اختياري)", val("tbtn"), 'maxlength="25"')}
      <div class="wa-bubble" data-waprev ${body ? "" : "hidden"}>${prev()}</div>
      ${go("data-watpl", "أرسلها إلى واتساب للمراجعة")}`;
  }
  function varsFor(name, key) {
    const t = approved().find((x) => x.name === name);
    if (!t || !t.vars) return "";
    return Array.from({ length: t.vars }, (_, i) => `<label class="pk-f">{{${i + 1}}}<select data-wavar="${key}:${i + 1}"><option value="name">اسم العميل</option><option value="custom" ${val(`${key}:${i + 1}`) && val(`${key}:${i + 1}`) !== "name" ? "selected" : ""}>نص ثابت</option></select>
      ${val(`${key}:${i + 1}`) && val(`${key}:${i + 1}`) !== "name" ? `<input type="text" data-wavartxt="${key}:${i + 1}" value="${esc(val(`${key}:${i + 1}`) === "custom" ? "" : val(`${key}:${i + 1}`))}">` : ""}</label>`).join("");
  }
  const varsBody = (name, key) => { const t = approved().find((x) => x.name === name), o = {}; for (let i = 1; i <= (t?.vars || 0); i++) { const v = val(`${key}:${i}`, "name"); o[i] = v === "custom" ? "" : v; } return o; };
  const needTpl = () => `<p class="pk-note">تحتاج إلى رسالة واحدة على الأقل معتمدة من واتساب.</p><button class="pk-chip" data-wadw="tpl">الرسائل المعتمدة</button>`;
  const tagSel = (k, all) => `<select data-waf="${k}"><option value="">${all}</option>${(S.d.contacts.tags || []).map((t) => `<option ${t === val(k) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
  function bcDw() {
    const ok = approved();
    if (!ok.length) return needTpl();
    const tp = ok.some((t) => t.name === val("btpl")) ? val("btpl") : ok[0].name;
    S.f.btpl = tp;
    return `<p class="pk-note">للمشتركين فقط، ولا تصل إلى من ألغى اشتراكه.</p>
      <label class="pk-f">الرسالة<select data-waf="btpl">${ok.map((t) => `<option value="${esc(t.name)}" ${t.name === tp ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
      <label class="pk-f">إلى${tagSel("btag", `كل المشتركين (${S.d.contacts.subscribed})`)}</label>
      ${f("bname", "اسم الحملة", val("bname"), 'placeholder="عرض نهاية الأسبوع"')}${varsFor(tp, "b")}
      <div class="wa-bubble">${esc(ok.find((t) => t.name === tp).body)}</div>
      <div class="pk-pills"><button class="pk-pill add${val("bwhen", "now") === "now" ? " on" : ""}" data-wawhen="now">الآن</button><button class="pk-pill add${val("bwhen") === "later" ? " on" : ""}" data-wawhen="later">في موعد</button></div>
      ${val("bwhen") === "later" ? `<label class="pk-f">الموعد<input type="datetime-local" data-waf="bat" value="${esc(val("bat"))}"></label>` : ""}
      ${go("data-wabc", "أرسل الحملة", "جارٍ الإرسال…")}`;
  }
  function seqDw() {
    const ok = approved();
    if (!ok.length) return needTpl();
    return `<p class="pk-note">رسالة تلو الأخرى بمواعيد، ومن يرد أو يلغي اشتراكه يخرج منها تلقائيًا.</p>
      ${S.steps.map((s, i) => `<div class="pk-row2 wa-step"><b class="num">${i + 1}</b><label class="pk-f">${i ? "بعد الرسالة السابقة بـ (ساعة)" : "عند الاشتراك مباشرة"}<select data-wastep="${i}">${ok.map((t) => `<option value="${esc(t.name)}" ${t.name === s.template ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
        ${i ? `<label class="pk-f">ساعات<input type="number" min="1" max="720" data-wadelay="${i}" value="${s.delay_hours || 24}"></label>${pkIb("close", "احذف الخطوة", `data-wastepx="${i}"`, "sm")}` : ""}</div>`).join("")}
      ${S.steps.length < 6 ? `<button class="pk-chip" data-wastepadd>＋ خطوة</button>` : ""}
      ${f("sname", "اسم السلسلة", val("sname"), 'placeholder="ترحيب بالمشتركين الجدد"')}
      <label class="pk-f">أدخل فيها${tagSel("stag", "كل المشتركين")}</label>
      ${go("data-waseq", "شغّل السلسلة")}`;
  }
  // القائمة الرئيسية: الحملات أو السلاسل أو المشتركون
  function rowsCamp() {
    const L = S.d.broadcasts || [];
    if (!L.length) return `<div class="pk-empty">لا توجد حملات بعد. اضغط «＋» لإنشاء حملة.</div>`;
    return `<div class="wa-r wa-hd"><span>الاسم</span><span>إلى</span><span>الحالة</span><span>وصلت</span><span>قُرئت</span><span></span></div>` + L.map((b) => `<div class="wa-r"><b>${esc(b.name)}</b><small>${esc(b.tag || "كل المشتركين")}</small>
      <span class="am-st ${b.status === "completed" ? "ok" : b.status === "failed" ? "bad" : "wait"}">${esc(BST[b.status] || b.status)}</span><span class="num">${b.stats.delivered ?? "—"}</span><span class="num">${b.stats.read ?? "—"}</span>
      <span>${b.status === "scheduled" || b.status === "sending" ? pkIb("close", "ألغِ الحملة", `data-wabcx="${esc(b.id)}"`, "sm") : ""}</span></div>`).join("");
  }
  function rowsSeq() {
    const L = S.d.sequences || [];
    if (!L.length) return `<div class="pk-empty">لا توجد سلاسل متابعة بعد. اضغط «＋» لإنشاء سلسلة.</div>`;
    return `<div class="wa-r wa-hd"><span>الاسم</span><span>الخطوات</span><span>الحالة</span><span>المشتركون</span><span></span><span></span></div>` + L.map((q) => `<div class="wa-r"><b>${esc(q.name)}</b><small>${q.steps} خطوات</small>
      <span class="am-st ${q.status === "active" ? "ok" : "wait"}">${q.status === "active" ? "تعمل" : "متوقفة"}</span><span class="num">${q.enrolled}</span><span></span>
      <span>${pkIb(q.status === "active" ? "close" : "play", q.status === "active" ? "أوقف" : "شغّل", `data-waseqtog="${esc(q.id)}" data-on="${q.status === "active" ? 0 : 1}"`, "sm")}</span></div>`).join("");
  }
  function rowsPeople() {
    if (!S.cs) { loadPeople(); return `<div class="pk-empty">جارٍ التحميل…</div>`; }
    return `<div class="pk-row2 wa-find"><input type="search" class="pk-q" data-waf="q" value="${esc(val("q"))}" placeholder="ابحث باسم أو رقم" aria-label="بحث">${tagSel("qtag", "كل الوسوم")}${pkIb("search", "ابحث", "data-wasearch", "sm")}</div>
      ${S.cs.contacts.length ? S.cs.contacts.map((c) => `<div class="wa-r" data-cid="${esc(c.id)}"><b>${esc(c.name)}</b><span dir="ltr" class="num">${esc(c.phone)}</span>
        <span class="am-st ${c.subscribed ? "ok" : "bad"}">${c.subscribed ? "مشترك" : "ألغى"}</span><span class="pk-pills">${c.tags.map((t) => `<span class="pk-pill">${esc(t)}</span>`).join("")}</span>
        <button class="pk-chip" data-wasub="${c.subscribed ? 0 : 1}">${c.subscribed ? "ألغِ اشتراكه" : "أعده"}</button><span>${pkIb("trash", "احذف", "data-wacdel", "sm")}</span></div>`).join("")
        : `<div class="pk-empty">لا يوجد مشتركون بعد. ابدأ من مصادر الاشتراك بالأعلى.</div>`}`;
  }
  function render() {
    const w = S.el;
    if (!w || !S.d) return;
    const d = S.d, c = d.contacts || { subscribed: 0, total: 0 };
    const segs = [["camp", "الحملات"], ["seq", "سلاسل المتابعة"], ["people", "المشتركون"]].map(([k, t]) => `<button class="pk-chip${S.seg === k ? " on" : ""}" data-waseg="${k}">${t}</button>`).join("");
    const src = (k, ic, t, tip) => `<button class="wa-src" data-wadw="${k}" data-tip="${tip}"><i>${pkIc(ic, 16)}</i>${t}</button>`;
    const body = !d.ready ? `<p class="pk-err">خدمة الرسائل غير متصلة بعد. تواصل مع الدعم.</p>`
      : !d.account ? `<div class="pk-hero"><span class="pk-big">${pkIc("msg", 40)}</span><h2>اربط واتساب بيزنس</h2><p>اربطه من صفحة النشر (اربط حسابًا ← واتساب للأعمال)، ثم عُد إلى هنا لجمع الموافقات وإرسال الحملات.</p></div>`
      : `<div class="pk-top"><div class="pk-kpis"><div><b class="num">${c.subscribed}</b><span>مشترك وافق على الرسائل</span></div><div><b class="num">${c.total - c.subscribed}</b><span>ألغوا الاشتراك</span></div><div><b class="num">${approved().length}</b><span>رسالة معتمدة</span></div></div>
          <div class="wa-srcs">${src("link", "link", "رابط", "رابط يشاركه العميل ليشترك")}${src("link", "qr", "رمز QR", "يُطبع في المحل أو على المنتج")}${src("auto", "chat", "كلمة في التعليقات", "من يكتبها في التعليق يصله رابط الاشتراك")}</div></div>
        <div class="pk-chips">${segs}</div><div class="wa-rows">${{ camp: rowsCamp, seq: rowsSeq, people: rowsPeople }[S.seg]()}</div>`;
    const dw = S.dw && d.account ? `<aside class="pk-drawer" aria-label="${DW[S.dw]}"><div class="pk-dh"><h2>${DW[S.dw]}</h2>${pkIb("close", "إغلاق", "data-wadx", "sm")}</div>${{ link: linkDw, auto: autoDw, add: addDw, tpl: tplDw, bc: bcDw, seq: seqDw }[S.dw]()}</aside>` : "";
    w.innerHTML = `<div class="pk"><div class="pk-top"><div class="pk-sub">${d.mock ? `<span>وضع تجريبي: بيانات تجريبية</span>` : ""}${d.account ? `<span data-tip="كل رسالة تسويقية فيها «${esc(d.stop)}»، ومن يلغي لا يصله شيء بعدها">للموافقين فقط 🔒</span>` : ""}${d.account && d.error ? `<span class="pk-err">⚠️ ${esc(d.error)}</span>` : ""}</div>
        ${d.account ? `<div class="pk-acts">${pkIb("users", "أضف عملاء وافقوا", 'data-wadw="add"')}${pkIb("msg", "الرسائل المعتمدة من واتساب", 'data-wadw="tpl"')}${pkIb("plus", S.seg === "seq" ? "سلسلة متابعة جديدة" : "حملة جديدة", `data-wadw="${S.seg === "seq" ? "seq" : "bc"}"`, "blk")}</div>` : ""}</div>
      ${body}${dw}</div>`;
  }
  async function loadPeople() {
    try { S.cs = await api(`/api/wa/contacts?search=${encodeURIComponent(val("q"))}&tag=${encodeURIComponent(val("qtag"))}`); }
    catch (err) { S.cs = { contacts: [] }; toast(err.message, true); }
    if (S.seg === "people") render();
  }
  async function run(kind, fn) {
    S.busy = kind; render();
    try { await fn(); } catch (err) { toast(err.message, true); }
    S.busy = ""; render();
  }
  const post = (path, body) => api(path, { method: "POST", ...jsonBody(body) });
  function bind(w) {
    w.addEventListener("input", (e) => {
      const f = e.target.dataset.waf;
      if (f && e.target.type !== "radio" && e.target.type !== "checkbox") S.f[f] = e.target.value;
      if (e.target.dataset.wavartxt) S.f[e.target.dataset.wavartxt] = e.target.value || "custom";
      if (f === "tbody" || f === "tbtn") { const b = w.querySelector("[data-waprev]"); if (b) { b.hidden = !val("tbody"); b.innerHTML = prev(); } }
    });
    w.addEventListener("change", (e) => {
      const f = e.target.dataset.waf;
      if (f) S.f[f] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      if (e.target.dataset.wavar) S.f[e.target.dataset.wavar] = e.target.value;
      if (e.target.dataset.wastep) S.steps[+e.target.dataset.wastep].template = e.target.value;
      if (e.target.dataset.wadelay) S.steps[+e.target.dataset.wadelay].delay_hours = +e.target.value;
      if (["apost", "aplat", "tcat", "btpl", "bwhen"].includes(f) || e.target.dataset.wavar) render();
      if (e.target.matches("[data-wafile]")) csv(e.target);
    });
    w.addEventListener("click", async (e) => {
      const q = (s) => e.target.closest(s);
      const sg = q("[data-waseg]");
      if (sg) { S.seg = sg.dataset.waseg; if (S.seg === "people") S.cs = null; return render(); }
      const dw = q("[data-wadw]");
      if (dw) { S.dw = dw.dataset.wadw; return render(); }
      if (q("[data-wadx]")) { S.dw = null; return render(); }
      if (q("[data-wawhen]")) { S.f.bwhen = q("[data-wawhen]").dataset.wawhen; return render(); }
      if (q("[data-wacp]")) { navigator.clipboard.writeText(q("[data-wacp]").dataset.wacp).then(() => toast("✓ نُسخ")); return; }
      if (q("[data-wanum]")) return run("x", async () => { S.d = await post("/api/wa/number", { number: val("number", S.d.number), keyword: val("keyword", S.d.keyword) }); toast("✓ تم الحفظ"); });
      if (q("[data-waauto]")) return run("auto", async () => { S.d = await post("/api/wa/automations", { post_id: S.f.apost, platform: S.f.aplat, keywords: String(val("akw", S.d.keyword)).split(/[,،]/).map((x) => x.trim()).filter(Boolean), reply: val("areply", "أرسلنا لك رسالة 💬") }); toast("✓ بدأ الرد التلقائي"); });
      if (q("[data-waatog]")) { const b = q("[data-waatog]"); return run("x", async () => { S.d = await post(`/api/wa/automations/${encodeURIComponent(b.dataset.waatog)}/toggle`, { on: b.dataset.on === "1" }); }); }
      if (q("[data-waadel]")) { if (await uiConfirm("هل تحذف هذا الرد التلقائي؟")) run("x", async () => { S.d = await api(`/api/wa/automations/${encodeURIComponent(q("[data-waadel]").dataset.waadel)}`, { method: "DELETE" }); }); return; }
      if (q("[data-waadd]")) {
        if (!val("consent")) return toast("أكّد أولًا أن هؤلاء وافقوا", true);
        const people = String(val("people")).split("\n").map((l) => { const parts = l.split(/[,،\t]/).map((x) => x.trim()); const ph = parts.find((x) => /\d{8,}/.test(x.replace(/\D/g, ""))) || ""; return { name: parts.find((x) => x && x !== ph) || "", phone: ph }; }).filter((p) => p.phone);
        if (!people.length) return toast("اكتب اسمًا ورقمًا في كل سطر", true);
        return run("add", async () => { const r = await post("/api/wa/contacts", { people, tags: val("ptag") ? [val("ptag")] : [], consent: true }); S.d = r; S.f.people = ""; toast(`✓ أُضيف ${r.created}${r.skipped ? ` · تُرك ${r.skipped} (مكرر أو رقم بلا مفتاح دولة)` : ""}`); S.dw = null; });
      }
      if (q("[data-wacsv]")) { if (!val("consent")) return toast("أكّد أولًا أن هؤلاء وافقوا", true); const f = w.querySelector("[data-wafile]"); f.value = ""; f.click(); return; }
      if (q("[data-wasearch]")) { S.cs = null; return render(); }
      const cid = q("[data-cid]")?.dataset.cid;
      if (cid && q("[data-wasub]")) return run("x", async () => { await api(`/api/wa/contacts/${encodeURIComponent(cid)}`, { method: "PATCH", ...jsonBody({ subscribed: q("[data-wasub]").dataset.wasub === "1" }) }); S.cs = null; S.d = await api("/api/wa"); });
      if (cid && q("[data-wacdel]")) { if (await uiConfirm("هل تحذفه من القائمة نهائيًا؟")) run("x", async () => { await api(`/api/wa/contacts/${encodeURIComponent(cid)}`, { method: "DELETE" }); S.cs = null; S.d = await api("/api/wa"); }); return; }
      if (q("[data-wadraft]")) return run("draft", async () => { const r = await post("/api/wa/templates/draft", { goal: val("tgoal") || "عرض للمشتركين", category: val("tcat", "MARKETING") }); Object.assign(S.f, { tname: r.name, tbody: r.body, tbtn: r.button }); });
      if (q("[data-watpl]")) return run("tpl", async () => { S.d = await post("/api/wa/templates", { name: val("tname") || "offer", category: val("tcat", "MARKETING"), language: val("tlang", "ar"), body: val("tbody"), button: val("tbtn") }); S.f.tbody = ""; S.f.tname = ""; S.f.tbtn = ""; toast("✓ أُرسلت إلى واتساب، ويمكنك إرسالها بعد اعتمادها"); });
      if (q("[data-watdel]")) { if (await uiConfirm("هل تحذف هذه الرسالة من واتساب؟")) run("x", async () => { S.d = await api(`/api/wa/templates/${encodeURIComponent(q("[data-watdel]").dataset.watdel)}`, { method: "DELETE" }); }); return; }
      if (q("[data-wabc]")) {
        const later = val("bwhen") === "later";
        if (later && !val("bat")) return toast("اختر الموعد", true);
        const n = val("btag") ? "أصحاب هذا الوسم" : `${S.d.contacts.subscribed} مشتركًا`;
        if (!(await uiConfirm(`ستُرسل «${S.f.btpl}» إلى ${n}${later ? " في الموعد الذي اخترته" : " الآن"}. هل تتابع؟`))) return;
        return run("bc", async () => { S.d = await post("/api/wa/broadcast", { name: val("bname") || S.f.btpl, template: S.f.btpl, vars: varsBody(S.f.btpl, "b"), tag: val("btag"), when: later ? new Date(val("bat")).toISOString() : null }); S.f.bname = ""; S.dw = null; S.seg = "camp"; toast(later ? "✓ جُدولت الحملة" : "✓ جارٍ إرسال الحملة"); });
      }
      if (q("[data-wabcx]")) { if (await uiConfirm("هل تلغي هذه الحملة؟")) run("x", async () => { S.d = await post(`/api/wa/broadcast/${encodeURIComponent(q("[data-wabcx]").dataset.wabcx)}/cancel`, {}); }); return; }
      if (q("[data-wastepadd]")) { S.steps.push({ template: approved()[0]?.name || "", delay_hours: 24 }); return render(); }
      if (q("[data-wastepx]")) { S.steps.splice(+q("[data-wastepx]").dataset.wastepx, 1); return render(); }
      if (q("[data-waseq]")) {
        const steps = S.steps.map((s, i) => ({ template: s.template || approved()[0]?.name, delay_hours: i ? s.delay_hours || 24 : 0, vars: varsBody(s.template || approved()[0]?.name, `s${i}`) }));
        return run("seq", async () => { const r = await post("/api/wa/sequences", { name: val("sname") || "سلسلة متابعة", steps, tag: val("stag"), enroll_now: true }); S.d = r; S.dw = null; S.seg = "seq"; toast(`✓ بدأت السلسلة${r.enrolled ? ` ودخلها ${r.enrolled} مشتركًا` : ""}`); });
      }
      if (q("[data-waseqtog]")) { const b = q("[data-waseqtog]"); return run("x", async () => { S.d = await post(`/api/wa/sequences/${encodeURIComponent(b.dataset.waseqtog)}/toggle`, { on: b.dataset.on === "1" }); }); }
    });
  }
  async function csv(input) {
    const f = input.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f); fd.append("tags", val("ptag")); fd.append("consent", "yes");
    run("add", async () => { const r = await api("/api/wa/contacts/csv", { method: "POST", body: fd }); S.d = r; S.dw = null; toast(`✓ أُضيف ${r.created}${r.skipped ? ` · تُرك ${r.skipped}` : ""}`); });
  }
  async function mount(root) {
    const w = root.querySelector("#waWrap");
    if (!w) return;
    S.el = w; S.cs = null;
    bind(w);
    try { S.d = await api("/api/wa"); S.steps = [{ template: approved()[0]?.name || "", delay_hours: 0 }]; render(); }
    catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  return { html, mount, close: () => {} };
})();
