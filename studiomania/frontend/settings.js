// StudioMania — الإعدادات والخروج

// باقي مفاتيح المنصة (الأدمن بس): بتتحفظ على السيرفر، والبوابة بتشتغل بيها في خلال دقيقة من غير إعادة تشغيل
const MORE_KEYS = [["fasih", "مفتاح فصيح", "الأصوات العربية"], ["munsit", "مفتاح منصت", "الأصوات الخليجية"], ["eleven", "مفتاح ElevenLabs", "الأصوات واستنساخ الصوت (مباشر)"], ["minimax", "مفتاح MiniMax", "الأصوات واستنساخ الصوت (مباشر)"], ["silma", "مفتاح SILMA", "أصوات بالفصحى والسعودية"], ["recraft", "مفتاح Recraft", "الشعار والرسومات المتجهية"],
  ["giphy", "مفتاح Giphy", "الكوميكس"], ["klipy", "مفتاح Klipy", "الكوميكس"], ["resend", "مفتاح Resend", "رسائل تأكيد الحساب بالبريد"], ["smtp_pass", "كلمة مرور البريد الإلكتروني (SMTP_PASS)", "رسائل تأكيد الحساب بالبريد"],
  ["paypal_id", "PayPal Client ID", "الدفع"], ["paypal_secret", "PayPal Secret", "الدفع"], ["paypal_hook", "PayPal Webhook ID", "الدفع"],
  ["google_id", "Google Client ID", "الدخول بجوجل والنسخة الاحتياطية"], ["google_secret", "Google Client secret", "الدخول بجوجل والنسخة الاحتياطية"],
  ["authentica", "مفتاح Authentica", "الدخول برقم الجوال (رمز برسالة نصية أو واتساب)"],
  ["openai", "مفتاح OpenAI", "الصوت المباشر (مختبر المساعد)"], ["gemini", "مفتاح Gemini", "الصوت المباشر (مختبر المساعد)"],
  ["openai_admin", "مفتاح أدمن OpenAI (Admin key)", "قراءة مصاريف OpenAI الفعلية في «رصيد المنصات» (من إعدادات المنظمة في OpenAI ← Admin keys)"]];

async function loadSettings() {
  const s = await api("/api/settings");
  const more = $("keysMore");
  if (more) more.innerHTML = MORE_KEYS.filter(([k]) => s.keys[k]).map(([k, t, why]) => `<label class="field" title="${why}">${t}
      <input type="password" data-mkey="${k}" autocomplete="off" placeholder="${s.keys[k].set ? `•••••••••••• (${s.keys[k].hint})` : "الصق المفتاح هنا"}"></label>`).join("");
  for (const name of ["atlas", "zernio", "scrape", "pexels"]) {
    const k = s.keys[name];
    if (!k || !$(`${name}State`)) continue;   // العميل مابيشوفش مفاتيح المنصة    // المفتاح المتسجل بيبان نقط جوه الخانة (زي البروتوتايب)، والحالة سطر صغير بس لو مفيش مفتاح
    $(`${name}State`).textContent = k.set ? "" : "✕ لا يوجد مفتاح بعد";
    $(`${name}State`).hidden = k.set;
    $(`${name}State`).className = "hint";
    $(`${name}Key`).placeholder = k.set ? `•••••••••••• (${k.hint})` : "الصق المفتاح هنا";
    $(`${name}Key`).value = "";
  }
  api("/api/system").then((x) => {
    $("sysInfo").textContent = `🖥️ الخادم: ${x.cpus ?? "?"} معالج · الذاكرة ${x.memory_limit_mb ? `${x.memory_limit_mb} ميجا (مستخدم ${x.memory_used_mb ?? "?"})` : "دون حد معروف"}`;
  }).catch(() => {});
  loadStorage();
  $("pwForm").hidden = s.password_from_env;
  $("pwEnvNote").hidden = !s.password_from_env;
}

$("keysForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = {};
  for (const name of ["atlas", "zernio", "scrape", "pexels"]) {
    const v = $(`${name}Key`).value.trim();
    if (v) body[name] = v;
  }
  document.querySelectorAll("[data-mkey]").forEach((i) => { if (i.value.trim()) (body.keys ||= {})[i.dataset.mkey] = i.value.trim(); });
  if (!Object.keys(body).length) return toast("الصق مفتاحًا أولًا");
  try {
    await api("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    toast("✅ حُفظت المفاتيح");
    gen.atlas = null; // صفحة التوليد تعيد قراءة حالة المفتاح
    await loadSettings();
  } catch (err) {
    toast(err.message, true);
  }
});

$("pwForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current: $("pwCurrent").value, new: $("pwNew").value }),
    });
    $("pwForm").reset();
    toast("✅ تغيّرت كلمة المرور");
  } catch (err) {
    toast(err.message, true);
  }
});

$("openSettings").onclick = () => showStep("settings");
$("logout").onclick = async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  location.href = "/login";
};

viewHooks["settings"] = () => { loadSettings(); markLook(); loadSetAccounts(); loadSetCredit(); loadKochiOld(); loadProviders(); loadBackup(); };

// ---------- 🗄️ النسخة الاحتياطية على جوجل درايف (البوابة هي اللي بتعملها) ----------
function renderBackup(b) {
  const box = $("bkBox");
  if (!box) return;
  const last = b.last?.at ? `${new Date(b.last.at * 1000).toLocaleString(UI_LOCALE(), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · ${(b.last.size / 1048576).toFixed(1)} ميجا · ${b.last.files} ملف` : "لم تُنشأ بعد";
  box.innerHTML = !b.google ? `<p class="hint">⚠️ يلزم ضبط GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET في Railway أولًا (وهما نفسهما المستخدمان للدخول بجوجل).</p>`
    : !b.connected ? `<div class="row wrap"><a class="btn primary" href="/auth/drive">🔗 اربط جوجل درايف</a></div><p class="hint">ستسجّل الدخول ببريد الشركة. لا يرى البرنامج إلا الملفات التي أنشأها هو.</p>${b.error ? `<p class="hint bad">⚠️ ${escapeHtml(b.error)}</p>` : ""}`
    : `<p>✅ مربوط بـ <b dir="ltr">${escapeHtml(b.email || "جوجل درايف")}</b></p>
       <p class="hint">آخر نسخة: ${escapeHtml(last)}${b.busy ? " · ⏳ تُنشأ الآن" : ""}</p>
       ${b.error ? `<p class="hint bad">⚠️ آخر محاولة فشلت: ${escapeHtml(b.error)}</p>` : ""}
       <div class="row wrap"><button type="button" class="btn sm primary" id="bkRun" ${b.busy ? "disabled" : ""}>أنشئ نسخة الآن</button>
         <button type="button" class="btn sm" id="bkOff">افصل درايف</button></div>`;
}
async function loadBackup() {
  const box = $("bkBox");
  if (!box) return;
  try { renderBackup(await api("/api/platform/backup")); }
  catch { box.innerHTML = `<p class="hint">النسخة الاحتياطية تعمل على الخادم فقط (عبر البوابة).</p>`; }
}
$("bkBox")?.addEventListener("click", async (e) => {
  if (e.target.closest("#bkRun")) {
    e.target.disabled = true; e.target.textContent = "⏳ جارٍ إنشاء النسخة…";
    try { renderBackup(await api("/api/platform/backup", { method: "POST" })); toast("✅ رُفعت النسخة إلى درايف"); } catch (err) { toast(err.message, true); loadBackup(); }
  }
  if (e.target.closest("#bkOff") && (await uiConfirm("أتفصل جوجل درايف؟ ستتوقف النسخ اليومية."))) {
    try { renderBackup(await api("/api/platform/backup/disconnect", { method: "POST" })); } catch (err) { toast(err.message, true); }
  }
});

// ---------- 💳 رصيد المنصات (للأدمن): الرصيد وحد التنبيه لكل منصة ----------
const PROV_ST = { ok: ["✓ سليم", "ok"], low: ["🟠 أوشك على النفاد", "low"], bad: ["🔴 نفد / توجد مشكلة", "bad"], unknown: ["—", ""] };
function renderProviders(d) {
  const box = $("provList");
  if (!box) return;
  box.innerHTML = d.items.map((p) => {
    const st = PROV_ST[p.state] || PROV_ST.unknown;
    const bal = p.balance == null ? (p.api ? (p.error ? `<small class="bad">${escapeHtml(p.error)}</small>` : "—") : "<small>ليس لها عدّاد، ونعرف عند فشل أول طلب</small>")
      : `<b class="num">${p.unit === "$" ? "$" : ""}${Number(p.balance).toLocaleString("en-US", { maximumFractionDigits: 2 })}</b> ${p.unit !== "$" ? escapeHtml(p.unit) : ""}`;
    // رابط صفحة الشحن جنب اسم كل منصة: يفتح في تاب جديد
    const top = p.url ? `<a class="prov-top" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer" title="افتح صفحة الشحن في ${escapeHtml(p.name)}">اشحن الرصيد ↗</a>` : "";
    return `<div class="prov ${st[1]}" data-prov="${p.key}"><div><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.what)}</small>${top}</div>
      <div class="prov-bal">${bal}${p.fail ? `<small class="bad" title="${escapeHtml(p.fail.msg)}">آخر طلب فشل: ${escapeHtml(p.fail.msg.slice(0, 70))}</small>` : ""}</div>
      <span class="prov-st">${st[0]}</span>
      ${["zernio", "fasih", "munsit", "minimax", "silma"].includes(p.key) ? "<span></span>" : `<label class="prov-min">نبّهني عند أقل من <input type="number" min="0" step="any" value="${p.min}" data-provmin="${p.key}"></label>`}
      ${!p.api || p.fail ? `<button type="button" class="btn xs" data-provclear="${p.key}">شحنت ✓</button>` : ""}
      ${provPack(p)}</div>`;
  }).join("");
  $("provAt").textContent = d.checked ? `آخر فحص ${new Date(d.checked * 1000).toLocaleTimeString(UI_LOCALE(), { hour: "numeric", minute: "2-digit" })}` : "";
}
// 📒 باقات كل منصة (واحدة أو أكتر: بكام وبتدّينا كام) ← سعر الوحدة لكل باقة، والباقة اللي بنشتريها بتحسب الاستهلاك والشحنات بالدولار.
// وتحتها 🧮 السيناريوهات: استهلاك الشهر ده (متوقَّع للشهر كله) لو اشترينا بكل باقة، عشان دراسة الجدوى.
const nf = (v, d = 2) => Number(v).toLocaleString("en-US", { maximumFractionDigits: d });
const usdf = (v) => (v == null ? "—" : "$" + nf(v));
const unitf = (v) => (v >= 0.01 ? "$" + nf(v, 4) : "$" + Number(v).toPrecision(2));
// الدفع (مرة واحدة / شهري / سنوي) والوحدة اللي بتيجي (نقاط / دقائق / دولار …) لكل باقة
const PK_BILL = { once: "مرة واحدة", month: "اشتراك شهري", year: "اشتراك سنوي" };
const PK_UNIT = { pts: "نقاط", min: "دقائق", sec: "ثوانٍ", usd: "دولار", chars: "حروف", msg: "رسائل", req: "طلبات", tok: "رموز (Tokens)", img: "صور", vid: "فيديوهات", acc: "حسابات" };
const PK_PER = { once: "", month: " / شهر", year: " / سنة" };
const opts = (o, v) => Object.entries(o).map(([k, t]) => `<option value="${k}"${k === v ? " selected" : ""}>${t}</option>`).join("");
const pkUnits = (x) => `${nf(x.units, 0)} ${PK_UNIT[x.unit] || ""}`;
function packRow(key, x = {}, unit = "pts") {
  return `<div class="pk-row"><label class="pk-use" title="الباقة التي نشتريها الآن"><input type="radio" name="pkuse-${key}" ${x.use ? "checked" : ""}> نشتريها</label>
    <input type="text" class="pk-name" placeholder="اسم الباقة" value="${escapeHtml(x.name || "")}" maxlength="40">
    <label>السعر $<input type="number" class="pk-usd" min="0" step="any" value="${x.usd ?? ""}"></label>
    <label>تعطينا<input type="number" class="pk-units" min="0" step="any" value="${x.units ?? ""}"></label>
    <select class="pk-unit" title="الوحدة">${opts(PK_UNIT, x.unit || unit)}</select>
    <label>الدفع<select class="pk-bill">${opts(PK_BILL, x.billing || "once")}</select></label>
    <input type="text" class="pk-note" placeholder="ملاحظة" value="${escapeHtml(x.note || "")}" maxlength="200">
    <span class="hint">${x.unit_usd ? `سعر الوحدة ${unitf(x.unit_usd)}${x.save_pct ? ` · أرخص بـ ${nf(x.save_pct, 1)}٪` : ""}` : ""}</span>
    <button type="button" class="btn xs ghost" data-pkdel title="احذف الباقة">✕</button></div>`;
}
function provPack(p) {
  const m = p.month || {};
  const unit = p.unit && p.unit !== "$" ? p.unit : "وحدة";
  const pack = p.spend || p.unit === "$" ? "" : `<div class="pk-list" data-pk="${p.key}" data-unit="${p.unit_def || "pts"}"><b class="pk-h">باقات ${escapeHtml(p.name)}</b>
      ${(p.packs?.length ? p.packs : [{ use: true }]).map((x) => packRow(p.key, x, p.unit_def)).join("")}
      <div class="pk-act"><button type="button" class="btn xs ghost" data-pkadd>＋ باقة أخرى</button><button type="button" class="btn xs" data-pksave>حفظ الباقات</button>
      ${p.unit_usd ? "" : `<span class="hint">اكتب باقة واحدة على الأقل لنحسب بالدولار</span>`}</div></div>`;
  const use = p.spend ? `<span>مصاريف هذا الشهر: <b>${usdf(m.used_usd)}</b></span>`
    : p.balance == null && !m.used ? "" : `<span>استهلاك هذا الشهر: <b>${m.used ? nf(m.used) : 0}</b> ${p.unit === "$" ? "$" : escapeHtml(unit)}${m.used_usd != null && p.unit !== "$" ? ` (${usdf(m.used_usd)})` : ""}</span>
      ${m.topups ? `<span>شحنات هذا الشهر: <b>${m.topups}</b>${m.topup_usd != null ? ` بإجمالي ${usdf(m.topup_usd)}` : ""}، آخرها ${new Date(m.last_topup * 1000).toLocaleDateString(UI_LOCALE())}</span>` : ""}`;
  const sc = (m.scenarios || []).length ? `<div class="pk-sc"><b class="pk-h">🧮 لو اشترينا بكل باقة (استهلاك الشهر كله المتوقَّع: ${nf(m.scenarios[0].month_units)} ${escapeHtml(unit)})</b>
      <table><thead><tr><th>الباقة</th><th>الدفع</th><th>سعر الوحدة</th><th>التوفير</th><th>بسعر الوحدة</th><th>عدد الباقات</th><th>ندفع</th><th>تكلفة السنة</th></tr></thead><tbody>
      ${m.scenarios.map((x) => `<tr class="${x.use ? "on" : ""}${x.custom ? " cu" : ""}"><td>${x.custom ? `🤝 باقة مخصصة لنا ${x.quoted ? "(عرض المزود)" : `(تقدير: خصم ${nf(x.pct, 1)}٪)`}` : escapeHtml(x.name || `$${nf(x.usd)} / ${nf(x.units, 0)}`)}${x.use ? " ✓" : ""}${x.units ? `<small> · $${nf(x.usd)}${PK_PER[x.billing] || ""} ← ${pkUnits(x)}</small>` : ""}</td>
        <td>${x.units ? PK_BILL[x.billing] || "" : "—"}</td><td>${unitf(x.unit_usd)}${x.unit && PK_UNIT[x.unit] ? `<small> / ${PK_UNIT[x.unit]}</small>` : ""}</td><td>${x.save_pct ? nf(x.save_pct, 1) + "٪" : "—"}</td><td>${usdf(x.month_usd)}</td><td>${x.packs ?? "—"}</td><td><b>${usdf(x.pay_usd)}</b>${x.units ? PK_PER[x.billing] || "" : ""}</td><td>${usdf(x.year_usd)}</td></tr>`).join("")}
      </tbody></table></div>` : "";
  return `<div class="prov-pack">${pack}${use}${provCustom(p)}${sc}</div>`;
}
// 🤝 باقة مخصصة لنا: لكل منصة احتمال التواصل مع المزود لباقة كبيرة بسعر أفضل. قبل العرض = تقدير بنسبة خصم، وبعده = سعر العرض نفسه
const CU_ST = { idea: "لم نتواصل بعد", asked: "تواصلنا وننتظر الرد", quoted: "وصلنا عرض", no: "رفض المزود" };
function provCustom(p) {
  const c = p.custom || {};
  return `<div class="pk-list pk-cu" data-cu="${p.key}"><b class="pk-h">🤝 باقة مخصصة لنا من ${escapeHtml(p.name)} (للتفاوض على سعر أفضل)</b>
    <div class="pk-row"><label>الحالة<select class="cu-st">${Object.entries(CU_ST).map(([k, v]) => `<option value="${k}"${(c.status || "idea") === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>الخصم المتوقع ٪<input type="number" class="cu-pct" min="0" max="90" step="any" value="${c.pct ?? 20}"></label>
      <label>سعر العرض $<input type="number" class="cu-usd" min="0" step="any" value="${c.usd ?? ""}"></label>
      <label>يعطينا<input type="number" class="cu-units" min="0" step="any" value="${c.units ?? ""}"></label>
      <select class="cu-unit" title="الوحدة">${opts(PK_UNIT, c.unit || p.unit_def || "pts")}</select>
      <label>الدفع<select class="cu-bill">${opts(PK_BILL, c.billing || "once")}</select></label></div>
    <div class="pk-row"><input type="text" class="cu-contact" placeholder="وسيلة التواصل (بريد المبيعات أو رابط النموذج)" value="${escapeHtml(c.contact || "")}" maxlength="200">
      <input type="text" class="cu-note" placeholder="ملاحظة (مثلًا: طلبوا التزامًا سنويًا)" value="${escapeHtml(c.note || "")}" maxlength="300">
      <button type="button" class="btn xs" data-cusave>حفظ</button></div>
    <span class="hint">قبل وصول عرض نحسبها تقديرًا: أرخص سعر وحدة عندنا ناقص الخصم المتوقع. ولو كتبت سعر العرض نحسب به مباشرة.</span></div>`;
}
async function loadProviders() {
  if (!$("provList")) return;
  try { renderProviders(await api("/api/admin/providers")); } catch { $("provList").innerHTML = ""; }
}
$("provRefresh")?.addEventListener("click", async () => {
  $("provRefresh").disabled = true;
  try { renderProviders(await api("/api/admin/providers/refresh", { method: "POST" })); toast("✅ فُحص"); } catch (err) { toast(err.message, true); }
  $("provRefresh").disabled = false;
});
$("provList")?.addEventListener("change", async (e) => {
  if (e.target.closest(".pk-list")) return;   // الباقات بتتحفظ بزرار «حفظ الباقات»
  const k = e.target.dataset.provmin;
  if (!k) return;
  try { renderProviders(await api("/api/admin/providers/min", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: k, min: +e.target.value || 0 }) })); toast("✅ حُفظ حد التنبيه"); }
  catch (err) { toast(err.message, true); }
});
$("provList")?.addEventListener("click", async (e) => {
  const cu = e.target.closest("[data-cu]");
  if (cu && e.target.closest("[data-cusave]")) {
    const v = (c) => cu.querySelector(c).value, usd = +v(".cu-usd") || 0, units = +v(".cu-units") || 0;
    if ((usd > 0) !== (units > 0)) { toast("اكتب سعر العرض وعدد الوحدات معًا", true); return; }
    try { renderProviders(await api("/api/admin/providers/custom", { method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: cu.dataset.cu, status: v(".cu-st"), pct: +v(".cu-pct") || 0, usd, units, contact: v(".cu-contact").trim(), note: v(".cu-note").trim(), unit: v(".cu-unit"), billing: v(".cu-bill") }) })); toast("✅ حُفظت الباقة المخصصة"); }
    catch (err) { toast(err.message, true); }
    return;
  }
  const list = e.target.closest(".pk-list:not(.pk-cu)");
  if (list && e.target.closest("[data-pkadd]")) { list.querySelector(".pk-act").insertAdjacentHTML("beforebegin", packRow(list.dataset.pk, {}, list.dataset.unit)); return; }
  if (list && e.target.closest("[data-pkdel]")) { e.target.closest(".pk-row").remove(); return; }
  if (list && e.target.closest("[data-pksave]")) {
    const packs = [...list.querySelectorAll(".pk-row")].map((r) => ({ name: r.querySelector(".pk-name").value.trim(), usd: +r.querySelector(".pk-usd").value || 0,
      units: +r.querySelector(".pk-units").value || 0, use: r.querySelector(".pk-use input").checked, unit: r.querySelector(".pk-unit").value, billing: r.querySelector(".pk-bill").value, note: r.querySelector(".pk-note").value.trim() }));
    if (packs.some((x) => (x.usd > 0) !== (x.units > 0))) { toast("اكتب السعر وعدد الوحدات لكل باقة", true); return; }
    try { renderProviders(await api("/api/admin/providers/pack", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: list.dataset.pk, packs }) })); toast("✅ حُفظت الباقات"); }
    catch (err) { toast(err.message, true); }
    return;
  }
  const k = e.target.closest("[data-provclear]")?.dataset.provclear;
  if (!k) return;
  try { renderProviders(await api(`/api/admin/providers/${k}/clear`, { method: "POST" })); toast("✅ سُجّل الشحن"); } catch (err) { toast(err.message, true); }
});

// ---------- شغل كوتشي القديم: اتنقل لبرنامج كوتشي لوحده، فبيتمسح من هنا بدوسة (بعد ما تتأكد إنه وصل هناك) ----------
async function loadKochiOld() {
  const k = await api("/api/admin/kochi-cleanup").catch(() => null);
  const n = k ? k.folders + k.videos + k.projects : 0;
  $("kochiOld").hidden = !n;
  if (n) $("kochiOldInfo").textContent = `${k.folders} مشروع · ${k.videos} فيديو خام · ${k.projects} مونتاج`;
}
$("kochiOldWipe").onclick = async () => {
  if (!(await uiConfirm("هل تأكدت أن كل عمل كوتشي وصل إلى برنامج كوتشي الجديد؟\n\nسيُحذف من سمسم كيت: مشاريع كوتشي بفيديوهاتها الخام وقطعها والفيديوهات المولّدة والمونتاج والفيديوهات المصدّرة منها (عدا ما عليه منشور مجدول).\nتبقى الشخصيات والتعليق الصوتي والموسيقى.\n\nلا يمكن التراجع عن هذا الحذف."))) return;
  const btn = $("kochiOldWipe");
  btn.disabled = true;
  try {
    const r = await api("/api/admin/kochi-cleanup", { method: "POST" });
    toast(`✅ حُذف عمل كوتشي القديم · تحرّر ${fmtMb(r.freed_mb)}${r.kept ? ` · بقي ${r.kept} عليه منشور مجدول` : ""}`);
    loadKochiOld();
    loadStorage();
  } catch (err) { toast(err.message, true); }
  btn.disabled = false;
};

// ---------- الحسابات المربوطة (من Zernio) ----------
async function loadSetAccounts() {
  const list = $("setAccList");
  list.innerHTML = `<li class="muted">جارٍ التحميل…</li>`;
  try {
    const p = await api("/api/publisher");
    $("setAccHint").innerHTML = p.service === "zernio"
      ? `<a href="#7" data-goto="7">اربط أو افصل حسابات من صفحة النشر →</a>`
      : "خدمة النشر غير متصلة بعد";
    // كل المنصات، وكل الحسابات المربوطة على كل منصة (الربط والفصل من صفحة النشر)
    list.innerHTML = Object.entries(p.platforms).map(([k, label]) => {
      const accs = (p.account_list || []).filter((a) => a.platform === k);
      return `<li class="${accs.length ? "on" : ""}"><i></i><span>${escapeHtml(label)}</span>
        <small dir="ltr">${accs.map((a) => escapeHtml(a.username ? "@" + a.username : a.name)).join(" · ")}</small>${accs.length ? "" : "<small>غير مربوط</small>"}</li>`;
    }).join("") + (p.accounts_error ? `<li class="err">${escapeHtml(p.accounts_error)}</li>` : "");
  } catch (err) {
    list.innerHTML = `<li class="err">${escapeHtml(err.message)}</li>`;
  }
}

// ---------- رصيد Atlas: نفس عداد الشريط الجانبي ----------
async function loadSetCredit() {
  const m = await api("/api/atlas/money").catch(() => null);
  $("setCredit").hidden = !m;
  if (!m) return;
  $("setCreditVal").textContent = `$${m.balance.toFixed(2)}`;
  $("setCreditSpent").textContent = `صُرف اليوم $${m.spent_today.toFixed(2)}`;
  const full = Math.max(m.balance + m.spent_week, 1);   // الدائرة: الرصيد من (الرصيد + صرف الأسبوع)
  const c = 2 * Math.PI * 16;
  $("setCreditRing").style.strokeDasharray = `${(c * Math.min(1, m.balance / full)).toFixed(1)} ${c.toFixed(1)}`;
}
$("setLogout")?.addEventListener("click", () => $("logout").click());
// 📊 استهلاك نقاط العميل (آخر ٣٠ يومًا، بالأقسام)
(window.MEP || Promise.resolve(null)).then(async (me) => {
  const box = $("useBox");
  if (!box || !me || me.role === "admin") return;
  try {
    const d = await api("/api/billing/usage");
    const max = Math.max(1, ...d.by_cat.map((x) => x.points)), n = (v) => (+v || 0).toLocaleString("ar-EG");
    box.innerHTML = `<div class="use-tot"><span><small class="hint">صرفت</small><b>${n(d.used)} نقطة</b></span><span><small class="hint">رصيدك الآن</small><b>${n(d.balance)} نقطة</b></span></div>`
      + (d.by_cat.length ? `<div class="use-bars">${d.by_cat.slice(0, 8).map((x) => `<div><span>${escapeHtml(x.cat)}</span><i style="width:${Math.max(4, Math.round((100 * x.points) / max))}%"></i><span>${n(x.points)}</span></div>`).join("")}</div>`
        : `<p class="hint">لم تصرف نقاطًا في آخر ٣٠ يومًا.</p>`);
  } catch { box.innerHTML = ""; }
});
// 🗑️ حذف الحساب نهائيًا (للعملاء، مش المشرف): الحساب والعلامات والفيديوهات والملفات كلها، والاشتراك بيتلغي. بعدها تقدر تسجّل من جديد بنفس البريد
(window.MEP || Promise.resolve(null)).then((me) => { if (me && me.role !== "admin" && $("setDelete")) $("setDelete").hidden = false; });
$("setDelete")?.addEventListener("click", async () => {
  const v = await uiPrompt("سيُحذف حسابك وكل علاماتك وفيديوهاتك وملفاتك نهائيًا، ويُلغى اشتراكك، ولا يمكن استرجاع أي شيء. للتأكيد اكتب كلمة: احذف");
  if (v == null) return;
  if (!["احذف", "delete"].includes(v.trim().toLowerCase())) return toast("لم يُحذف شيء: اكتب كلمة «احذف» بالضبط للتأكيد", true);
  try {
    const r = await fetch("/api/me/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "تعذّر حذف الحساب، جرّب مرة أخرى");
    location.replace("/welcome");
  } catch (err) { toast(err.message, true); }
});

// ---------- الشكل واللغة: نفس سويتش الرئيسية، من جوه الإعدادات ----------
const lookTheme = () => document.documentElement.dataset.nhTheme || "light";
function markLook() {
  $("themePicks")?.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.theme === lookTheme()));
  $("langPicks")?.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.lang === (window.I18N?.lang || "ar")));
}
$("themePicks")?.addEventListener("click", (e) => {
  const b = e.target.closest("[data-theme]");
  if (!b || b.dataset.theme === lookTheme()) return;
  document.getElementById("nhTheme")?.click();   // مفتاح الرئيسية هو ما يحفظ الاختيار ويقلب المجسّم أيضًا
});
// القلبة بتحصل بعد الانيميشن، فبنعلّم الاختيار لما الوضع يتغيّر فعلًا
new MutationObserver(markLook).observe(document.documentElement, { attributes: true, attributeFilter: ["data-nh-theme"] });
$("langPicks")?.addEventListener("click", (e) => {
  const b = e.target.closest("[data-lang]");
  if (b && b.dataset.lang !== (window.I18N?.lang || "ar")) $("langToggle").click();
});

// ---------- المساحة ----------
const STORAGE_LABELS = {
  raw: "الفيديوهات الخام", clips: "القطع", generated: "فيديوهات Seedance", coaches: "الشخصيات",
  audio: "الصوت والموسيقى", exports: "الفيديوهات الجاهزة", tmp: "ملفات مؤقتة",
  lab: "معمل التفكيك (تقسيم الفيديوهات)", typo: "فيديوهات التايبوجرافي", refs: "📦 أرشيف المراجع", ads: "الإعلانات",
  series: "المسلسلات", films: "الأفلام", carousels: "الكاروسيل", assets: "مكتبة العناصر", tvideos: "فيديوهات القوالب",
};
// الأقسام اللي ينفع تتمسح كلها مرة واحدة، واللي بيتمسح فيها بالظبط
const WIPE_INFO = {
  lab: ["🗑️ احذف كل فيديوهات التفكيك", "ستُحذف كل فيديوهات معمل التفكيك مع تقسيمها. تبقى الأساليب والملصقات المحفوظة في المكتبة."],
  typo: ["🗑️ احذف كل فيديوهات التايبوجرافي", "ستُحذف كل مشاريع التايبوجرافي (الفيديوهات والصوت والتحليل). تبقى الأساليب والملصقات والأصوات."],
  refs: ["🗑️ احذف كل الأرشيف", "ستُحذف كل ملفات أرشيف المراجع."],
  raw: ["🗑️ احذف كل الفيديوهات الخام", "ستُحذف كل الفيديوهات الخام وقطعها، ولن تجد المشاريع المصنوعة منها."],
  exports: ["🗑️ احذف كل الفيديوهات الجاهزة", "ستُحذف كل الفيديوهات الجاهزة، عدا ما عليه منشورات مجدولة."],
};
async function loadStorage() {
  try {
    const st = await api("/api/storage");
    const used = st.total_mb - st.free_mb;
    const pct = Math.round((used / st.total_mb) * 100);
    $("storageInfo").innerHTML = `
      <div class="bar"><span style="width:${pct}%;background:${pct > 90 ? "var(--danger)" : "var(--accent)"}"></span></div>
      <p class="${pct > 90 ? "err" : "hint"}">مستخدم ${fmtMb(used)} من ${fmtMb(st.total_mb)} · فارغ ${fmtMb(st.free_mb)}</p>
      <ul>${Object.entries(st.folders).filter(([, v]) => v >= 0.1).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
        const n = (st.wipe || {})[k];
        return `<li><span>${STORAGE_LABELS[k] || k}${n ? ` <small class="muted">(${n})</small>` : ""}</span><span class="row">${n ? `<button class="btn sm danger" data-wipe="${k}" data-n="${n}">${WIPE_INFO[k][0]}</button>` : ""}<b>${fmtMb(v)}</b></span></li>`;
      }).join("")}</ul>`;
  } catch (err) {
    $("storageInfo").textContent = err.message;
  }
}
function fmtMb(mb) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} جيجا` : `${Math.round(mb)} ميجا`;
}
$("storageInfo").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-wipe]");
  if (!b) return;
  const [label, what] = WIPE_INFO[b.dataset.wipe];
  if (!(await uiConfirm(`${label} (${b.dataset.n})؟\n\n${what}\n\nلا يمكن التراجع عن هذا الحذف.`))) return;
  b.disabled = true;
  try {
    const r = await api(`/api/storage/wipe/${b.dataset.wipe}`, { method: "POST" });
    toast(`✅ حُذف ${r.deleted}${r.kept ? ` · بقي ${r.kept} قيد العمل الآن` : ""} · تحرّر ${fmtMb(r.freed_mb)}`);
  } catch (err) {
    toast(err.message, true);
  }
  loadStorage();
});
$("cleanTmp").onclick = async () => {
  try {
    const r = await api("/api/storage/clean", { method: "POST" });
    toast(`✅ حُذف ${fmtMb(r.freed_mb)}`);
    loadStorage();
  } catch (err) {
    toast(err.message, true);
  }
};

// ---------- سجل آخر تصدير (عشان نعرف المشكلة فين) ----------
$("showLog").onclick = async () => {
  try {
    const r = await api("/api/render-log");
    $("renderLog").textContent = r.log;
    $("renderLog").hidden = false;
    $("copyLog").hidden = false;
  } catch (err) {
    toast(err.message, true);
  }
};
$("copyLog").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("renderLog").textContent);
    toast("✅ نُسخ، أرسله في المحادثة");
  } catch {
    toast("حدّد النص وانسخه بنفسك", true);
  }
};

// 💸 فواتيري الشهرية (لصاحب المنصة): جدول بيتعدّل في مكانه، وبيتحفظ بزرار
const Exp = { rows: [], cycles: {} };
function expRender(d) {
  const box = $("expBox");
  if (!box) return;
  if (d) Object.assign(Exp, { rows: d.rows, cycles: d.cycles, monthly: d.monthly, usage: d.usage });
  const esc = (s) => escapeHtml(String(s ?? ""));
  box.innerHTML = `<div class="exp-tbl" role="table" aria-label="فواتيري الشهرية">
    <div class="exp-row exp-h" role="row"><span>الخدمة</span><span>أقل شراء ($)</span><span>الدفع</span><span>يوم التجديد</span><span>يعطينا</span><span>الوحدة</span><span>سعر الوحدة</span><span>ملاحظة</span><span></span></div>
    ${Exp.rows.map((r, i) => `<div class="exp-row" role="row" data-ei="${i}">
      <input type="text" data-ek="name" value="${esc(I18N.t(r.name))}" data-orig="${esc(r.name)}" aria-label="الخدمة">
      <input type="number" min="0" step="0.01" data-ek="amount" value="${esc(r.amount)}" aria-label="المبلغ" dir="ltr">
      <select data-ek="cycle" aria-label="الدفع">${Object.entries(Exp.cycles).map(([k, t]) => `<option value="${k}" ${k === r.cycle ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
      <input type="number" min="0" max="31" data-ek="day" value="${r.day || ""}" placeholder="—" aria-label="يوم التجديد" dir="ltr">
      <input type="number" min="0" data-ek="units" value="${r.units || ""}" placeholder="—" aria-label="يعطينا كم وحدة" dir="ltr">
      <input type="text" data-ek="unit" value="${esc(I18N.t(r.unit || ""))}" data-orig="${esc(r.unit || "")}" placeholder="نقطة، رسالة…" aria-label="الوحدة">
      <span class="exp-pu">${r.units && r.amount ? "$" + (r.amount / r.units).toPrecision(2) : "—"}</span>
      <input type="text" data-ek="note" value="${esc(I18N.t(r.note))}" data-orig="${esc(r.note)}" aria-label="ملاحظة">
      <button type="button" class="btn sm" data-edel="${i}" aria-label="احذف السطر">✕</button></div>`).join("")}
    </div>
    <div class="exp-sum"><b>الشهري: $${Number(Exp.monthly || 0).toFixed(2)}</b><span>حسب الاستخدام (آخر شحن): $${Number(Exp.usage || 0).toFixed(2)}</span></div>
    <div class="row wrap"><button type="button" class="btn sm" id="expAdd">+ خدمة</button><button type="button" class="btn primary sm" id="expSave">حفظ</button></div>`;
}
function expRead() {
  document.querySelectorAll("#expBox .exp-row[data-ei]").forEach((row) => {
    const r = Exp.rows[+row.dataset.ei];
    // الخانة معروضة مترجمة في الإنجليزي: لو ما اتعدلتش بنحفظ الأصل مش الترجمة
    row.querySelectorAll("[data-ek]").forEach((x) => { r[x.dataset.ek] = x.type === "number" ? Number(x.value || 0) : x.dataset.orig != null && x.value === I18N.t(x.dataset.orig) ? x.dataset.orig : x.value; });
  });
}
$("expBox")?.addEventListener("click", async (e) => {
  if (e.target.closest("#expAdd")) { expRead(); Exp.rows.push({ name: "", amount: 0, cycle: "monthly", day: 0, units: 0, unit: "", note: "" }); return expRender(); }
  const del = e.target.closest("[data-edel]");
  if (del) { expRead(); Exp.rows.splice(+del.dataset.edel, 1); return expRender(); }
  if (e.target.closest("#expSave")) {
    expRead();
    try { expRender(await api("/api/expenses", { method: "PUT", ...jsonBody({ rows: Exp.rows }) })); toast("✓ حُفظت الفواتير"); } catch (err) { toast(err.message, true); }
  }
});
// المصاريف لصاحب المنصة بس: العميل مايطلبهاش أصلًا (كانت بترجع ٤٠٣ عند كل عميل وتتسجل خطأ)
const expHide = () => { const b = $("expBox"); if (b) b.closest(".set-card").hidden = true; };
(window.MEP || Promise.resolve(null)).then((me) => (me && me.role !== "admin" ? expHide() : api("/api/expenses").then(expRender))).catch(expHide);
