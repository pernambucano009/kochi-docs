// StudioMania — الإعدادات والخروج

// باقي مفاتيح المنصة (الأدمن بس): بتتحفظ على السيرفر، والبوابة بتشتغل بيها في خلال دقيقة من غير إعادة تشغيل
const MORE_KEYS = [["fasih", "مفتاح فصيح", "الأصوات العربية"], ["munsit", "مفتاح منصت", "الأصوات الخليجي"], ["eleven", "مفتاح ElevenLabs", "الأصوات وكلون الصوت (مباشر)"], ["minimax", "مفتاح MiniMax", "الأصوات وكلون الصوت (مباشر)"], ["silma", "مفتاح SILMA", "أصوات عربي فصحى وسعودي"], ["recraft", "مفتاح Recraft", "اللوجو والرسومات الفيكتور"], ["audioshake", "مفتاح AudioShake", "فصل الصوت عن الموسيقى"],
  ["giphy", "مفتاح Giphy", "الكوميكس"], ["klipy", "مفتاح Klipy", "الكوميكس"], ["resend", "مفتاح Resend", "إيميلات تأكيد الحساب"], ["smtp_pass", "كلمة مرور البريد الإلكتروني (SMTP_PASS)", "إيميلات تأكيد الحساب"],
  ["paypal_id", "PayPal Client ID", "الدفع"], ["paypal_secret", "PayPal Secret", "الدفع"], ["paypal_hook", "PayPal Webhook ID", "الدفع"],
  ["stripe", "Stripe Secret key", "الدفع"], ["stripe_hook", "Stripe Webhook secret", "الدفع"],
  ["google_id", "Google Client ID", "الدخول بجوجل والنسخة الاحتياطية"], ["google_secret", "Google Client secret", "الدخول بجوجل والنسخة الاحتياطية"]];

async function loadSettings() {
  const s = await api("/api/settings");
  const more = $("keysMore");
  if (more) more.innerHTML = MORE_KEYS.filter(([k]) => s.keys[k]).map(([k, t, why]) => `<label class="field" title="${why}">${t}
      <input type="password" data-mkey="${k}" autocomplete="off" placeholder="${s.keys[k].set ? `•••••••••••• (${s.keys[k].hint})` : "الصق المفتاح هنا"}"></label>`).join("");
  for (const name of ["atlas", "zernio", "scrape", "pexels"]) {
    const k = s.keys[name];
    // المفتاح المتسجل بيبان نقط جوه الخانة (زي البروتوتايب)، والحالة سطر صغير بس لو مفيش مفتاح
    $(`${name}State`).textContent = k.set ? "" : "✕ لا يوجد مفتاح ما زال";
    $(`${name}State`).hidden = k.set;
    $(`${name}State`).className = "hint";
    $(`${name}Key`).placeholder = k.set ? `•••••••••••• (${k.hint})` : "الصق المفتاح هنا";
    $(`${name}Key`).value = "";
  }
  api("/api/system").then((x) => {
    $("sysInfo").textContent = `🖥️ الخادم: ${x.cpus ?? "?"} معالج · الذاكرة ${x.memory_limit_mb ? `${x.memory_limit_mb} ميجا (مستخدم ${x.memory_used_mb ?? "?"})` : "بدون حد معروف"}`;
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
  if (!Object.keys(body).length) return toast("الصق مفتاح أولًا");
  try {
    await api("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    toast("✅ المفاتيح حُفظت");
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
    toast("✅ كلمة المرور تغيّر");
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
  const last = b.last?.at ? `${new Date(b.last.at * 1000).toLocaleString(UI_LOCALE(), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · ${(b.last.size / 1048576).toFixed(1)} ميجا · ${b.last.files} ملف` : "ما زال لم تُنشأ";
  box.innerHTML = !b.google ? `<p class="hint">⚠️ يحتاج GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET في Railway أولًا (نفس الخاصين بالدخول بجوجل).</p>`
    : !b.connected ? `<div class="row wrap"><a class="btn primary" href="/auth/drive">🔗 اربط جوجل درايف</a></div><p class="hint">ستسجّل دخول بإيميل الشركة. البرنامج يرى الملفات التي هو عملها فقط.</p>${b.error ? `<p class="hint bad">⚠️ ${escapeHtml(b.error)}</p>` : ""}`
    : `<p>✅ مربوط بـ <b dir="ltr">${escapeHtml(b.email || "جوجل درايف")}</b></p>
       <p class="hint">آخر نسخة: ${escapeHtml(last)}${b.busy ? " · ⏳ تُنشأ الآن" : ""}</p>
       ${b.error ? `<p class="hint bad">⚠️ آخر محاولة فشلت: ${escapeHtml(b.error)}</p>` : ""}
       <div class="row wrap"><button type="button" class="btn sm primary" id="bkRun" ${b.busy ? "disabled" : ""}>أنشئ نسخة الآن</button>
         <button type="button" class="btn sm" id="bkOff">افصل الدرايف</button></div>`;
}
async function loadBackup() {
  const box = $("bkBox");
  if (!box) return;
  try { renderBackup(await api("/api/platform/backup")); }
  catch { box.innerHTML = `<p class="hint">النسخة الاحتياطية تشتغل على الخادم فقط (من خلال البوابة).</p>`; }
}
$("bkBox")?.addEventListener("click", async (e) => {
  if (e.target.closest("#bkRun")) {
    e.target.disabled = true; e.target.textContent = "⏳ جارٍ العمل النسخة…";
    try { renderBackup(await api("/api/platform/backup", { method: "POST" })); toast("✅ النسخة رُفعت على الدرايف"); } catch (err) { toast(err.message, true); loadBackup(); }
  }
  if (e.target.closest("#bkOff") && (await uiConfirm("تفصل جوجل درايف؟ النسخ اليومية ستقف."))) {
    try { renderBackup(await api("/api/platform/backup/disconnect", { method: "POST" })); } catch (err) { toast(err.message, true); }
  }
});

// ---------- 💳 رصيد المنصات (للأدمن): الرصيد وحد التنبيه لكل منصة ----------
const PROV_ST = { ok: ["✓ حسنًا", "ok"], low: ["🟠 قرّب ينتهي", "low"], bad: ["🔴 خلص / فيه مشكلة", "bad"], unknown: ["—", ""] };
function renderProviders(d) {
  const box = $("provList");
  if (!box) return;
  box.innerHTML = d.items.map((p) => {
    const st = PROV_ST[p.state] || PROV_ST.unknown;
    const bal = p.balance == null ? (p.api ? (p.error ? `<small class="bad">${escapeHtml(p.error)}</small>` : "—") : "<small>ليس لها عداد، نعرف من أول طلب يفشل</small>")
      : `<b class="num">${p.unit === "$" ? "$" : ""}${Number(p.balance).toLocaleString("en-US", { maximumFractionDigits: 2 })}</b> ${p.unit !== "$" ? escapeHtml(p.unit) : ""}`;
    return `<div class="prov ${st[1]}" data-prov="${p.key}"><div><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.what)}</small></div>
      <div class="prov-bal">${bal}${p.fail ? `<small class="bad" title="${escapeHtml(p.fail.msg)}">آخر طلب فشل: ${escapeHtml(p.fail.msg.slice(0, 70))}</small>` : ""}</div>
      <span class="prov-st">${st[0]}</span>
      ${p.key === "zernio" || p.key === "fasih" || p.key === "munsit" ? "<span></span>" : `<label class="prov-min">نبّهني أسفل <input type="number" min="0" step="any" value="${p.min}" data-provmin="${p.key}"></label>`}
      ${!p.api || p.fail ? `<button type="button" class="btn xs" data-provclear="${p.key}">شحنت ✓</button>` : ""}</div>`;
  }).join("");
  $("provAt").textContent = d.checked ? `آخر تشييك ${new Date(d.checked * 1000).toLocaleTimeString(UI_LOCALE(), { hour: "numeric", minute: "2-digit" })}` : "";
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
  const k = e.target.dataset.provmin;
  if (!k) return;
  try { renderProviders(await api("/api/admin/providers/min", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: k, min: +e.target.value || 0 }) })); toast("✅ حد التنبيه حُفظ"); }
  catch (err) { toast(err.message, true); }
});
$("provList")?.addEventListener("click", async (e) => {
  const k = e.target.closest("[data-provclear]")?.dataset.provclear;
  if (!k) return;
  try { renderProviders(await api(`/api/admin/providers/${k}/clear`, { method: "POST" })); toast("✅ سُجّل أنه شُحن"); } catch (err) { toast(err.message, true); }
});

// ---------- شغل كوتشي القديم: اتنقل لبرنامج كوتشي لوحده، فبيتمسح من هنا بدوسة (بعد ما تتأكد إنه وصل هناك) ----------
async function loadKochiOld() {
  const k = await api("/api/admin/kochi-cleanup").catch(() => null);
  const n = k ? k.folders + k.videos + k.projects : 0;
  $("kochiOld").hidden = !n;
  if (n) $("kochiOldInfo").textContent = `${k.folders} مشروع · ${k.videos} فيديو خام · ${k.projects} مونتاج`;
}
$("kochiOldWipe").onclick = async () => {
  if (!(await uiConfirm("تأكدت أن كل عمل كوتشي وصل لبرنامج كوتشي الجديد؟\n\nسيُحذف من سمسم كيت: مشاريع كوتشي بفيديوهاتها الخام وقطعها والفيديوهات المولّدة والمونتاج والفيديوهات التي صُدّرت منها (إلا الذي عليها منشور ما زال متجدول).\nالشخصيات والتعليق الصوتي والموسيقى يظلون.\n\nهذا المسح لا يصلح يترجع."))) return;
  const btn = $("kochiOldWipe");
  btn.disabled = true;
  try {
    const r = await api("/api/admin/kochi-cleanup", { method: "POST" });
    toast(`✅ حُذف عمل كوتشي القديم · فضي ${fmtMb(r.freed_mb)}${r.kept ? ` · فضل ${r.kept} عليه منشور متجدول` : ""}`);
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
      ? `<a href="#7" data-goto="7">اربط أو افصل حسابات من صفحة النشر ←</a>`
      : "خدمة النشر ما زال غير متصلة";
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
  series: "المسلسلات", films: "الأفلام", carousels: "الكاروسيل", assets: "مكتبة العناصر", tvideos: "فيديوهات التيمبليتس",
};
// الأقسام اللي ينفع تتمسح كلها مرة واحدة، واللي بيتمسح فيها بالظبط
const WIPE_INFO = {
  lab: ["🗑️ احذف كل فيديوهات التفكيك", "كل الفيديوهات التي في معمل التفكيك ستُحذف هي وتقسيمها. الأساليب والستيكرات التي حُفظت في المكتبة تظل."],
  typo: ["🗑️ احذف كل فيديوهات التايبوجرافي", "كل مشاريع التايبوجرافي ستُحذف (الفيديوهات والصوت والتحليل). الأساليب والستيكرات والأصوات تظل."],
  refs: ["🗑️ احذف كل الأرشيف", "كل الملفات التي في أرشيف المراجع ستُحذف."],
  raw: ["🗑️ احذف كل الفيديوهات الخام", "كل الفيديوهات الخام وقطعها ستُحذف، والمشاريع الذي معمولة منها لن تجدها."],
  exports: ["🗑️ احذف كل الفيديوهات الجاهزة", "كل الفيديوهات الجاهزة ستُحذف، ما عدا الذي عليها منشورات متجدولة."],
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
  if (!(await uiConfirm(`${label} (${b.dataset.n})؟\n\n${what}\n\nهذا المسح لا يصلح يترجع.`))) return;
  b.disabled = true;
  try {
    const r = await api(`/api/storage/wipe/${b.dataset.wipe}`, { method: "POST" });
    toast(`✅ حُذف ${r.deleted}${r.kept ? ` · ${r.kept} يعملون الآن فضلوا` : ""} · فضي ${fmtMb(r.freed_mb)}`);
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
    toast("✅ نُسخ، أرسله في الشات");
  } catch {
    toast("حدّد النص وانسخه بنفسك", true);
  }
};
