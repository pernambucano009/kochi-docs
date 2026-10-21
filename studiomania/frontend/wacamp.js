// 💬 «حملات واتساب» (فرع منافسينك في عقل البراند): للناس اللي وافقوا بس.
// اجمع الموافقات (لينك وQR، «علّق بكلمة»، عملاءك اللي وافقوا) ← رسايل متوافق عليها من واتساب ← حملات وسلاسل متابعة. اللي بيلغي مابيوصلوش حاجة تاني.
const WaCampPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, d: null, tab: "grow", busy: "", f: {}, cs: null, steps: [{ template: "", delay_hours: 0 }] };
  const TABS = [["grow", "🧲 اجمع الموافقات"], ["people", "👥 المشتركين"], ["tpl", "📝 الرسايل"], ["send", "📣 الحملات"]];
  const TST = { APPROVED: ["✓ متوافق عليها", "ok"], PENDING: ["⏳ بتتراجع", "wait"], REJECTED: ["✕ اترفضت", "bad"], PAUSED: ["متوقفة", "wait"], DISABLED: ["متقفلة", "bad"] };
  const BST = { completed: "اتبعتت", sending: "بتتبعت", scheduled: "متجدولة", draft: "مسودة", cancelled: "اتلغت", failed: "فشلت" };
  const html = () => `<div class="nb-wrap fs-wrap rv-wrap" id="waWrap"><div class="nh-empty">بيحمّل…</div></div>`;
  const val = (k, d = "") => S.f[k] ?? d;
  const pretty = (u) => { try { return decodeURIComponent(u).replace(/^https:\/\//, ""); } catch { return u; } };
  const approved = () => (S.d.templates || []).filter((t) => t.status === "APPROVED");

  function hero() {
    const d = S.d;
    return `<section class="fs-hero"><div class="fs-hero-t"><b>حملات واتساب</b><span class="latin">WHATSAPP CAMPAIGNS</span></div>
      <p>رسايل واتساب للناس اللي وافقوا بس: هما اللي كلّموك الأول (من اللينك أو الـ QR أو كومنت بكلمة)، أو عملاءك اللي وافقوا قبل كده. بعدها تبعتلهم عروض وأخبار وسلاسل متابعة.</p>
      <p class="nb-hint">🔒 واتساب بيقفل الرقم اللي بيبعت لناس ما وافقوش، علشان كده مفيش هنا قوايم ناس من برّه. كل رسالة تسويق فيها «${esc(d.stop)}»، واللي بيلغي مابيوصلوش حاجة تاني.</p>
      <p class="nb-hint">💳 تمن الرسايل نفسها Meta بتحاسب عليه حساب واتساب بيزنس بتاعك. البرنامج بياخد حوالي ${d.fee_per_100} نقطة لكل ١٠٠ رسالة.</p>
      ${d.mock ? `<p class="nb-hint">⚠️ وضع تجربة: مشتركين وحملات تجريبية.</p>` : ""}
      ${!d.ready ? `<div class="fs-err">⚠️ خدمة الرسايل مش متوصّلة لسه. كلّم الدعم.</div>` : !d.account ? `<div class="fs-err">⚠️ اربط «واتساب بيزنس» الأول من صفحة النشر (🔗 اربط حساب ← واتساب بيزنس).</div>` : d.error ? `<div class="fs-err">⚠️ ${esc(d.error)}</div>` : ""}
      ${d.account ? `<div class="rv-count"><span><b class="num">${d.contacts.subscribed}</b> مشترك</span><span><b class="num">${d.contacts.total - d.contacts.subscribed}</b> لغوا</span><span><b class="num">${approved().length}</b> رسالة جاهزة</span></div>` : ""}</section>`;
  }
  function growTab() {
    const d = S.d, posts = d.posts || [];
    return `<section class="fs-card"><h3>🔗 لينك وQR الواتساب <small>حطه في البايو والإعلانات والمحل وعلى المنتج</small></h3>
        <div class="am-row"><label>رقم الواتساب <input type="tel" dir="ltr" data-waf="number" value="${esc(val("number", d.number))}" placeholder="+966501234567"></label>
          <label class="am-grow">الكلمة اللي بتتكتب لوحدها <input type="text" data-waf="keyword" value="${esc(val("keyword", d.keyword))}"></label>
          <button class="nb-btn sm" data-wanum>حفظ</button></div>
        ${d.link ? `<div class="wa-link"><img src="/api/wa/qr.svg?t=${encodeURIComponent(d.link)}" alt="QR لينك الواتساب" width="132" height="132">
          <div><code dir="ltr">${esc(pretty(d.link))}</code><div class="nb-bar"><button class="nb-btn sm" data-wacp="${esc(d.link)}">📋 انسخ اللينك</button>
          <a class="nb-btn sm" href="/api/wa/qr.svg" download="whatsapp-qr.svg">⬇️ نزّل الـ QR</a></div>
          <p class="nb-hint">اللي يدوس أو يصوّر بيفتح محادثة معاك والكلمة مكتوبة، فهو اللي بيبدأ، وده موافقة. في إعلانات ميتا اختار هدف «رسايل واتساب» وحط نفس الرقم.</p></div></div>` : `<p class="nb-hint">اكتب رقم الواتساب بكود الدولة علشان اللينك والـ QR يتعملوا.</p>`}</section>
      <section class="fs-card"><h3>💬 «علّق بكلمة» <small>اللي يكتب الكلمة في الكومنت بيوصله رسالة فيها لينك الواتساب</small></h3>
        ${!posts.length ? `<p class="nb-hint">لسه مفيش بوستات اتنشرت من البرنامج على إنستجرام أو فيسبوك.</p>` : (() => {
          const p = posts.find((x) => x.id === val("apost")) || posts[0], pl = p.platforms.includes(val("aplat")) ? val("aplat") : p.platforms[0];
          S.f.apost = p.id; S.f.aplat = pl;
          return `<div class="am-row"><label>البوست <select data-waf="apost">${posts.map((x) => `<option value="${esc(x.id)}" ${x.id === p.id ? "selected" : ""}>${esc(x.caption.slice(0, 60) || x.id)}</option>`).join("")}</select></label>
            <label>على <select data-waf="aplat">${p.platforms.map((k) => `<option value="${k}" ${k === pl ? "selected" : ""}>${k === "instagram" ? "إنستجرام" : "فيسبوك"}</option>`).join("")}</select></label></div>
          <div class="am-row"><label class="am-grow">الكلمات (افصل بفاصلة) <input type="text" data-waf="akw" value="${esc(val("akw", d.keyword))}"></label>
            <label class="am-grow">الرد على الكومنت <input type="text" data-waf="areply" value="${esc(val("areply", "بعتنالك رسالة 💬"))}"></label></div>
          <p class="nb-hint">الرسالة اللي هتوصلهم: «أهلًا! كلّمنا على واتساب من هنا وهنبعتلك التفاصيل: ${esc(d.link ? pretty(d.link) : "(اكتب الرقم فوق)")}»</p>
          <div class="nb-bar"><button class="nb-btn fs-go" data-waauto ${S.busy ? "disabled" : ""}>＋ شغّل الرد الأوتوماتيك</button></div>`;
        })()}
        ${(d.automations || []).map((a) => `<div class="wa-item"><b>${esc(a.name)}</b><span>${a.keywords.map((k) => `<span class="pl-chip">${esc(k)}</span>`).join("")}</span>
          <span class="am-st ${a.active ? "ok" : ""}">${a.active ? "شغال" : "متوقف"}</span>${a.stats?.sent != null ? `<small>بعت ${a.stats.sent}</small>` : ""}
          <button class="nb-btn sm" data-waatog="${esc(a.id)}" data-on="${a.active ? 0 : 1}">${a.active ? "⏸ وقّف" : "▶ شغّل"}</button><button class="nb-btn sm danger" data-waadel="${esc(a.id)}">✕</button></div>`).join("")}</section>
      <section class="fs-card"><h3>📇 عملاءك اللي وافقوا</h3>
        <p class="nb-hint">اسم ورقم بكود الدولة في كل سطر (أو ملف CSV). للعملاء اللي وافقوا فعلًا إنهم يوصلهم منك رسايل على واتساب بس.</p>
        <textarea rows="4" data-waf="people" placeholder="أحمد, +966501234567&#10;سارة, +201001234567">${esc(val("people"))}</textarea>
        <div class="am-row"><label>تاج (اختياري) <input type="text" data-waf="ptag" value="${esc(val("ptag"))}" placeholder="مثلًا: عملاء-قدام"></label>
          <label class="wa-ok"><input type="checkbox" data-waf="consent" ${val("consent") ? "checked" : ""}> أأكد إن الناس دول وافقوا يوصلهم مني رسايل على واتساب</label></div>
        <div class="nb-bar"><button class="nb-btn fs-go" data-waadd>＋ ضيفهم</button><button class="nb-btn" data-wacsv>⬆️ ارفع CSV</button></div>
        <input type="file" accept=".csv,text/csv" hidden data-wafile></section>`;
  }
  function peopleTab() {
    if (!S.cs) { loadPeople(); return `<section class="fs-card"><div class="nh-empty">بيحمّل…</div></section>`; }
    const tags = S.d.contacts.tags || [];
    return `<section class="fs-card"><div class="am-row"><input type="search" data-waf="q" value="${esc(val("q"))}" placeholder="دوّر باسم أو رقم" class="am-grow">
        <select data-waf="qtag"><option value="">كل التاجات</option>${tags.map((t) => `<option ${t === val("qtag") ? "selected" : ""}>${esc(t)}</option>`).join("")}</select><button class="nb-btn sm" data-wasearch>🔍</button></div>
      ${S.cs.contacts.length ? `<div class="wa-people">${S.cs.contacts.map((c) => `<div class="wa-item" data-cid="${esc(c.id)}"><b>${esc(c.name)}</b><span dir="ltr" class="num">${esc(c.phone)}</span>
          <span>${c.tags.map((t) => `<span class="pl-chip">${esc(t)}</span>`).join("")}</span><span class="am-st ${c.subscribed ? "ok" : "bad"}">${c.subscribed ? "مشترك" : "لغى"}</span>
          <button class="nb-btn sm" data-wasub="${c.subscribed ? 0 : 1}">${c.subscribed ? "لغّي اشتراكه" : "رجّعه"}</button><button class="nb-btn sm danger" data-wacdel>✕</button></div>`).join("")}</div>`
        : `<p class="nb-hint">لسه مفيش مشتركين. ابدأ من «🧲 اجمع الموافقات».</p>`}</section>`;
  }
  async function loadPeople() {
    try { S.cs = await api(`/api/wa/contacts?search=${encodeURIComponent(val("q"))}&tag=${encodeURIComponent(val("qtag"))}`); }
    catch (err) { S.cs = { contacts: [] }; toast(err.message, true); }
    if (S.tab === "people") render();
  }
  const prev = () => `${esc(val("tbody").replace(/\{\{1\}\}/g, "أحمد"))}${val("tcat", "MARKETING") === "MARKETING" ? `<small>${esc(S.d.stop)}</small>` : ""}${val("tbtn") ? `<span>${esc(val("tbtn"))}</span>` : ""}`;
  function tplTab() {
    const d = S.d, cat = val("tcat", "MARKETING"), body = val("tbody");
    return `<section class="fs-card"><h3>📝 رسالة جديدة <small>واتساب بيراجعها (من دقايق لـ ٢٤ ساعة) قبل ما تتبعت</small></h3>
        <div class="am-row"><label class="am-grow">الرسالة عن إيه؟ <input type="text" data-waf="tgoal" value="${esc(val("tgoal"))}" placeholder="مثلًا: عرض الويك إند على التشكيلة الجديدة"></label>
          <button class="nb-btn sm" data-wadraft ${S.busy ? "disabled" : ""}>${S.busy === "draft" ? "⏳ بيكتب…" : "✍️ اكتبهالي"}</button></div>
        <div class="am-row"><label>النوع <select data-waf="tcat">${Object.entries(d.categories).map(([k, t]) => `<option value="${k}" ${k === cat ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
          <label>اللغة <select data-waf="tlang">${Object.entries(d.langs).map(([k, t]) => `<option value="${k}" ${k === val("tlang", "ar") ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
          <label>اسم داخلي (إنجليزي) <input type="text" dir="ltr" data-waf="tname" value="${esc(val("tname"))}" placeholder="weekend_offer"></label></div>
        <label class="wa-full">النص <small>{{1}} = اسم العميل</small><textarea rows="4" data-waf="tbody" maxlength="1000">${esc(body)}</textarea></label>
        <div class="am-row"><label>زرار رد سريع (اختياري) <input type="text" maxlength="25" data-waf="tbtn" value="${esc(val("tbtn"))}"></label></div>
        <div class="wa-bubble" data-waprev ${body ? "" : "hidden"}>${prev()}</div>
        <div class="nb-bar"><button class="nb-btn fs-go" data-watpl ${S.busy ? "disabled" : ""}>📤 ابعتها لواتساب تتراجع</button></div></section>
      <section class="fs-card"><h3>رسايلك</h3>${(d.templates || []).map((t) => { const st = TST[t.status] || [t.status, ""]; return `<div class="wa-item"><b dir="ltr">${esc(t.name)}</b>
          <span class="am-st ${st[1]}">${esc(st[0])}</span><small>${esc(d.categories[t.category] || t.category)}</small><p>${esc(t.body)}</p>${t.reason ? `<small class="fs-err">${esc(t.reason)}</small>` : ""}
          <button class="nb-btn sm danger" data-watdel="${esc(t.name)}">✕</button></div>`; }).join("") || `<p class="nb-hint">لسه مفيش رسايل.</p>`}</section>`;
  }
  function varsFor(name, key) {
    const t = approved().find((x) => x.name === name);
    if (!t || !t.vars) return "";
    return Array.from({ length: t.vars }, (_, i) => `<label>{{${i + 1}}} <select data-wavar="${key}:${i + 1}"><option value="name">اسم العميل</option><option value="custom" ${val(`${key}:${i + 1}`) && val(`${key}:${i + 1}`) !== "name" ? "selected" : ""}>نص ثابت</option></select>
      ${val(`${key}:${i + 1}`) && val(`${key}:${i + 1}`) !== "name" ? `<input type="text" data-wavartxt="${key}:${i + 1}" value="${esc(val(`${key}:${i + 1}`) === "custom" ? "" : val(`${key}:${i + 1}`))}">` : ""}</label>`).join("");
  }
  const varsBody = (name, key) => { const t = approved().find((x) => x.name === name), o = {}; for (let i = 1; i <= (t?.vars || 0); i++) { const v = val(`${key}:${i}`, "name"); o[i] = v === "custom" ? "" : v; } return o; };
  function sendTab() {
    const d = S.d, ok = approved(), tags = d.contacts.tags || [];
    if (!ok.length) return `<section class="fs-card"><p class="nb-hint">محتاج رسالة واحدة على الأقل متوافق عليها من واتساب. اعملها من «📝 الرسايل».</p></section>` + lists();
    const tp = ok.some((t) => t.name === val("btpl")) ? val("btpl") : ok[0].name;
    S.f.btpl = tp;
    return `<section class="fs-card"><h3>📣 حملة جديدة <small>للمشتركين بس (اللي لغوا مش هيوصلهم)</small></h3>
        <div class="am-row"><label>الرسالة <select data-waf="btpl">${ok.map((t) => `<option value="${esc(t.name)}" ${t.name === tp ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
          <label>لمين <select data-waf="btag"><option value="">كل المشتركين (${d.contacts.subscribed})</option>${tags.map((t) => `<option ${t === val("btag") ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
          <label>اسم الحملة <input type="text" data-waf="bname" value="${esc(val("bname"))}" placeholder="عرض الويك إند"></label></div>
        <div class="am-row">${varsFor(tp, "b")}</div>
        <div class="wa-bubble">${esc(ok.find((t) => t.name === tp).body)}</div>
        <div class="am-row"><label><input type="radio" name="wawhen" data-waf="bwhen" value="now" ${val("bwhen", "now") === "now" ? "checked" : ""}> دلوقتي</label>
          <label><input type="radio" name="wawhen" data-waf="bwhen" value="later" ${val("bwhen") === "later" ? "checked" : ""}> في ميعاد</label>
          ${val("bwhen") === "later" ? `<input type="datetime-local" data-waf="bat" value="${esc(val("bat"))}">` : ""}</div>
        <div class="nb-bar"><button class="nb-btn fs-go" data-wabc ${S.busy ? "disabled" : ""}>${S.busy === "bc" ? "⏳ بيبعت…" : "📣 ابعت الحملة"}</button></div></section>
      <section class="fs-card"><h3>🔁 سلسلة متابعة <small>رسالة ورا رسالة بمواعيد، واللي يرد أو يلغي بيخرج منها لوحده</small></h3>
        ${S.steps.map((s, i) => `<div class="am-row wa-step"><b class="num">${i + 1}</b><select data-wastep="${i}">${ok.map((t) => `<option value="${esc(t.name)}" ${t.name === s.template ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select>
          ${i ? `<label>بعد <input type="number" min="1" max="720" data-wadelay="${i}" value="${s.delay_hours || 24}"> ساعة من اللي قبلها</label>` : `<small>أول ما يدخل</small>`}
          ${i ? `<button class="nb-btn sm danger" data-wastepx="${i}">✕</button>` : ""}</div>`).join("")}
        ${S.steps.length < 6 ? `<button class="nb-btn sm" data-wastepadd>＋ خطوة</button>` : ""}
        <div class="am-row"><label>اسم السلسلة <input type="text" data-waf="sname" value="${esc(val("sname"))}" placeholder="ترحيب بالمشتركين الجداد"></label>
          <label>دخّل فيها <select data-waf="stag"><option value="">كل المشتركين</option>${tags.map((t) => `<option ${t === val("stag") ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label></div>
        <div class="nb-bar"><button class="nb-btn fs-go" data-waseq ${S.busy ? "disabled" : ""}>🔁 شغّل السلسلة</button></div></section>` + lists();
  }
  function lists() {
    const d = S.d;
    return `${(d.broadcasts || []).length ? `<section class="fs-card"><h3>حملاتك</h3>${d.broadcasts.map((b) => `<div class="wa-item"><b>${esc(b.name)}</b><span class="am-st ${b.status === "completed" ? "ok" : b.status === "failed" ? "bad" : "wait"}">${esc(BST[b.status] || b.status)}</span>
        <span class="rv-stats"><span>لـ <b class="num">${b.stats.total ?? "—"}</b></span><span>وصلت <b class="num">${b.stats.delivered ?? "—"}</b></span><span>اتقرت <b class="num">${b.stats.read ?? "—"}</b></span>${b.stats.failed ? `<span>فشلت <b class="num">${b.stats.failed}</b></span>` : ""}</span>
        ${b.status === "scheduled" || b.status === "sending" ? `<button class="nb-btn sm danger" data-wabcx="${esc(b.id)}">✕ الغي</button>` : ""}</div>`).join("")}</section>` : ""}
      ${(d.sequences || []).length ? `<section class="fs-card"><h3>سلاسلك</h3>${d.sequences.map((q) => `<div class="wa-item"><b>${esc(q.name)}</b><span class="am-st ${q.status === "active" ? "ok" : "wait"}">${q.status === "active" ? "شغالة" : "متوقفة"}</span>
        <small>${q.steps} خطوات · ${q.enrolled} مشترك فيها</small><button class="nb-btn sm" data-waseqtog="${esc(q.id)}" data-on="${q.status === "active" ? 0 : 1}">${q.status === "active" ? "⏸ وقّف" : "▶ شغّل"}</button></div>`).join("")}</section>` : ""}`;
  }
  function render() {
    const w = S.el;
    if (!w || !S.d) return;
    const body = S.d.account ? { grow: growTab, people: peopleTab, tpl: tplTab, send: sendTab }[S.tab]() : "";
    w.innerHTML = hero() + (S.d.account ? `<nav class="rv-tabs" role="tablist">${TABS.map(([k, t]) => `<button role="tab" data-watab="${k}" aria-selected="${k === S.tab}" class="${k === S.tab ? "on" : ""}">${t}</button>`).join("")}</nav>` + body : "");
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
      const tb = q("[data-watab]");
      if (tb) { S.tab = tb.dataset.watab; if (S.tab === "people") S.cs = null; return render(); }
      if (q("[data-wacp]")) { navigator.clipboard.writeText(q("[data-wacp]").dataset.wacp).then(() => toast("📋 اتنسخ")); return; }
      if (q("[data-wanum]")) return run("x", async () => { S.d = await post("/api/wa/number", { number: val("number", S.d.number), keyword: val("keyword", S.d.keyword) }); toast("✅ اتحفظ"); });
      if (q("[data-waauto]")) return run("auto", async () => { S.d = await post("/api/wa/automations", { post_id: S.f.apost, platform: S.f.aplat, keywords: String(val("akw", S.d.keyword)).split(/[,،]/).map((x) => x.trim()).filter(Boolean), reply: val("areply", "بعتنالك رسالة 💬") }); toast("✅ الرد الأوتوماتيك اشتغل"); });
      if (q("[data-waatog]")) { const b = q("[data-waatog]"); return run("x", async () => { S.d = await post(`/api/wa/automations/${encodeURIComponent(b.dataset.waatog)}/toggle`, { on: b.dataset.on === "1" }); }); }
      if (q("[data-waadel]")) { if (await uiConfirm("تمسح الرد الأوتوماتيك ده؟")) run("x", async () => { S.d = await api(`/api/wa/automations/${encodeURIComponent(q("[data-waadel]").dataset.waadel)}`, { method: "DELETE" }); }); return; }
      if (q("[data-waadd]")) {
        if (!val("consent")) return toast("أكد الأول إن الناس دول وافقوا", true);
        const people = String(val("people")).split("\n").map((l) => { const parts = l.split(/[,،\t]/).map((x) => x.trim()); const ph = parts.find((x) => /\d{8,}/.test(x.replace(/\D/g, ""))) || ""; return { name: parts.find((x) => x && x !== ph) || "", phone: ph }; }).filter((p) => p.phone);
        if (!people.length) return toast("اكتب اسم ورقم في كل سطر", true);
        return run("add", async () => { const r = await post("/api/wa/contacts", { people, tags: val("ptag") ? [val("ptag")] : [], consent: true }); S.d = r; S.f.people = ""; toast(`✅ اتضاف ${r.created}${r.skipped ? ` · اتساب ${r.skipped} (مكرر أو رقم من غير كود دولة)` : ""}`); });
      }
      if (q("[data-wacsv]")) { if (!val("consent")) return toast("أكد الأول إن الناس دول وافقوا", true); const f = w.querySelector("[data-wafile]"); f.value = ""; f.click(); return; }
      if (q("[data-wasearch]")) { S.cs = null; return render(); }
      const cid = q("[data-cid]")?.dataset.cid;
      if (cid && q("[data-wasub]")) return run("x", async () => { await api(`/api/wa/contacts/${encodeURIComponent(cid)}`, { method: "PATCH", ...jsonBody({ subscribed: q("[data-wasub]").dataset.wasub === "1" }) }); S.cs = null; S.d = await api("/api/wa"); });
      if (cid && q("[data-wacdel]")) { if (await uiConfirm("تمسحه من القايمة خالص؟")) run("x", async () => { await api(`/api/wa/contacts/${encodeURIComponent(cid)}`, { method: "DELETE" }); S.cs = null; S.d = await api("/api/wa"); }); return; }
      if (q("[data-wadraft]")) return run("draft", async () => { const r = await post("/api/wa/templates/draft", { goal: val("tgoal") || "عرض للمشتركين", category: val("tcat", "MARKETING") }); Object.assign(S.f, { tname: r.name, tbody: r.body, tbtn: r.button }); });
      if (q("[data-watpl]")) return run("tpl", async () => { S.d = await post("/api/wa/templates", { name: val("tname") || "offer", category: val("tcat", "MARKETING"), language: val("tlang", "ar"), body: val("tbody"), button: val("tbtn") }); S.f.tbody = ""; S.f.tname = ""; S.f.tbtn = ""; toast("📤 اتبعتت لواتساب، أول ما تتوافق هتقدر تبعتها"); });
      if (q("[data-watdel]")) { if (await uiConfirm("تمسح الرسالة دي من واتساب؟")) run("x", async () => { S.d = await api(`/api/wa/templates/${encodeURIComponent(q("[data-watdel]").dataset.watdel)}`, { method: "DELETE" }); }); return; }
      if (q("[data-wabc]")) {
        const later = val("bwhen") === "later";
        if (later && !val("bat")) return toast("اختار الميعاد", true);
        const n = val("btag") ? "اللي عليهم التاج ده" : `${S.d.contacts.subscribed} مشترك`;
        if (!(await uiConfirm(`هتتبعت «${S.f.btpl}» لـ ${n}${later ? " في الميعاد اللي اخترته" : " دلوقتي"}. تكمّل؟`))) return;
        return run("bc", async () => { S.d = await post("/api/wa/broadcast", { name: val("bname") || S.f.btpl, template: S.f.btpl, vars: varsBody(S.f.btpl, "b"), tag: val("btag"), when: later ? new Date(val("bat")).toISOString() : null }); S.f.bname = ""; toast(later ? "🗓 الحملة اتجدولت" : "📣 الحملة بتتبعت"); });
      }
      if (q("[data-wabcx]")) { if (await uiConfirm("تلغي الحملة دي؟")) run("x", async () => { S.d = await post(`/api/wa/broadcast/${encodeURIComponent(q("[data-wabcx]").dataset.wabcx)}/cancel`, {}); }); return; }
      if (q("[data-wastepadd]")) { S.steps.push({ template: approved()[0]?.name || "", delay_hours: 24 }); return render(); }
      if (q("[data-wastepx]")) { S.steps.splice(+q("[data-wastepx]").dataset.wastepx, 1); return render(); }
      if (q("[data-waseq]")) {
        const steps = S.steps.map((s, i) => ({ template: s.template || approved()[0]?.name, delay_hours: i ? s.delay_hours || 24 : 0, vars: varsBody(s.template || approved()[0]?.name, `s${i}`) }));
        return run("seq", async () => { const r = await post("/api/wa/sequences", { name: val("sname") || "سلسلة متابعة", steps, tag: val("stag"), enroll_now: true }); S.d = r; toast(`🔁 السلسلة اشتغلت${r.enrolled ? ` ودخل فيها ${r.enrolled} مشترك` : ""}`); });
      }
      if (q("[data-waseqtog]")) { const b = q("[data-waseqtog]"); return run("x", async () => { S.d = await post(`/api/wa/sequences/${encodeURIComponent(b.dataset.waseqtog)}/toggle`, { on: b.dataset.on === "1" }); }); }
    });
  }
  async function csv(input) {
    const f = input.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f); fd.append("tags", val("ptag")); fd.append("consent", "yes");
    run("add", async () => { const r = await api("/api/wa/contacts/csv", { method: "POST", body: fd }); S.d = r; toast(`✅ اتضاف ${r.created}${r.skipped ? ` · اتساب ${r.skipped}` : ""}`); });
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
