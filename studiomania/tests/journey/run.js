// 🧭 رحلة التجربة: حساب عميل حقيقي على الـ staging، بنقاط حقيقية، بيمشي في البرنامج زي العميل بالظبط،
// ويسجّل لكل خطوة: نجحت ولا لا، صرفت كام نقطة، ورسالة الخطأ لو فيه، وصور الشاشات بالعربي والإنجليزي، وفيديو للرحلة كلها،
// والكلام العربي اللي ظهر في الوضع الإنجليزي، والعامية في كلام الواجهة.
//
// على الـ staging (من GitHub Actions):  BASE=https://staging.simsimkit.com ADMIN_EMAIL=… ADMIN_PASSWORD=… PHASE=1 node tests/journey/run.js
//   ← بيعمل (أو يعيد ضبط) حساب العميل journey@test.simsimkit.com برصيد BUDGET نقطة بس، فمستحيل يصرف أكتر منه.
// تجربة محلية من غير رصيد (وضع التجربة):   PHASE=1 node tests/journey/run.js
// المجالات: كلها، أو NICHES=food,tech
// النتيجة: tests/journey/out/phase-N/ (report.json، report.md، shots/، video/)
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { chromium } = require("playwright");
const { dialectOf } = require("../i18n/dialect");

const ROOT = path.resolve(__dirname, "../..");
const PHASE = String(process.env.PHASE || "1");
const LIVE = !!process.env.BASE;
const PORT = 8700 + Math.floor(Math.random() * 90);
const BASE = (process.env.BASE || `http://127.0.0.1:${PORT}`).replace(/\/$/, "");
const BUDGET = +(process.env.BUDGET || 2000);   // أقصى نقاط للمرحلة (٣٠٠ نقطة ≈ ١ دولار تكلفة حقيقية)
const EMAIL = process.env.JOURNEY_EMAIL || "journey@test.simsimkit.com";
const PW = LIVE ? "J-" + crypto.randomBytes(12).toString("base64url") : "Journey-pass-2026!";
const OUT = path.join(__dirname, "out", `phase-${PHASE}`);
const BRANDS = JSON.parse(fs.readFileSync(path.join(__dirname, "brands.json"), "utf8"))
  .filter((b) => !process.env.NICHES || process.env.NICHES.split(",").includes(b.niche));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const AR = /[؀-ۿ]/;
const ALLOW = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "tests/i18n/allow.json"), "utf8")); } catch { return { missing: [] }; } })();
// كل الكلام اللي رجع من السيرفر في الرحلة (محتوى العلامة ونتايج الذكاء الاصطناعي): عشان نفرّق بين
// «واجهة ناقصها ترجمة» و«محتوى العميل مش محمي من الترجمة» (اللي ممكن يتترجم كلمة كلمة ويبوظ)
const CONTENT = new Set();
const grab = (v) => {
  if (typeof v === "string") { if (AR.test(v) && v.length > 1) CONTENT.add(v.replace(/\s+/g, " ").trim()); }
  else if (v && typeof v === "object") Object.values(v).forEach(grab);
};

fs.rmSync(OUT, { recursive: true, force: true });
for (const d of ["shots", "video"]) fs.mkdirSync(path.join(OUT, d), { recursive: true });

async function serve(data) {
  const env = { ...process.env, STUDIOMANIA_DATA: data, ATLAS_MOCK: "1", PUBLISH_MOCK: "1" };
  for (const k of ["APP_PASSWORD", "GATEWAY_SECRET", "TENANT_ROLE", "BASE"]) delete env[k];
  const proc = spawn(process.env.PYTHON || "python3", ["-m", "uvicorn", "app:app", "--app-dir", "backend", "--port", String(PORT), "--log-level", "warning"],
    { cwd: ROOT, env, stdio: ["ignore", "ignore", "pipe"] });
  let err = ""; proc.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(BASE + "/health")).ok) return proc; } catch { /* لسه بيقوم */ }
    await sleep(500);
  }
  proc.kill(); throw new Error("البرنامج لم يعمل:\n" + err);
}

// ---------- التقرير ----------
const R = { phase: PHASE, base: LIVE ? BASE : "local-mock", at: new Date().toISOString(), budget: BUDGET, steps: [], lang: { en_arabic: [], en_content: [], ui_dialect: [] }, errors: [] };
const seenEn = new Map(), seenDial = new Map();

async function main() {
  const local = LIVE ? null : await serve(fs.mkdtempSync(path.join(os.tmpdir(), "journey-")));
  const browser = await chromium.launch();
  try {
    // 1) حساب العميل (الأدمن بيعمله على الـ staging) والدخول
    const login = await browser.newContext({ baseURL: BASE });
    if (LIVE) {
      if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw new Error("ADMIN_EMAIL و ADMIN_PASSWORD ناقصين");
      const adm = await browser.newContext({ baseURL: BASE });
      const a = await adm.request.post("/api/auth/login", { data: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
      if (!a.ok()) throw new Error("دخول الأدمن فشل: " + a.status() + " " + (await a.text()).slice(0, 200));
      const t = await adm.request.post("/api/platform/test-account", { data: { email: EMAIL, password: PW, credits: BUDGET, plan: "agency" } });
      if (!t.ok()) throw new Error("حساب التجربة لم يُنشأ: " + t.status() + " " + (await t.text()).slice(0, 300));
      await adm.close();
      const l = await login.request.post("/api/auth/login", { data: { email: EMAIL, password: PW } });
      if (!l.ok()) throw new Error("دخول العميل فشل: " + l.status());
    } else {
      const st = await (await login.request.get("/api/auth/state")).json().catch(() => ({}));
      await login.request.post(st.setup || st.needs_setup ? "/api/auth/setup" : "/api/auth/login", { data: { password: PW } });
      await login.request.post("/api/auth/login", { data: { password: PW } });
    }
    const storage = await login.storageState();
    await login.close();

    for (const brand of BRANDS) await runBrand(browser, storage, brand);
  } catch (e) {
    R.errors.push("الرحلة توقفت: " + (e.stack || e.message || e).toString().slice(0, 800));
  } finally {
    await browser.close().catch(() => {});
    if (local) local.kill();
    write();
  }
}

async function balance(req) {
  if (!LIVE) return null;
  const r = await req.get("/api/billing").catch(() => null);
  const j = r && r.ok() ? await r.json().catch(() => ({})) : {};
  const w = j.wallet || j.balance || j;
  return typeof w.total === "number" ? w.total : typeof j.credits === "number" ? j.credits : null;
}

async function runBrand(browser, storage, brand) {
  const ctx = await browser.newContext({ baseURL: BASE, storageState: storage, viewport: { width: 1440, height: 900 },
    recordVideo: { dir: path.join(OUT, "video"), size: { width: 1280, height: 800 } } });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  page.on("pageerror", (e) => R.errors.push(`[${brand.niche}] خطأ في الصفحة: ${e.message.slice(0, 200)}`));
  page.on("response", async (r) => {
    if (r.url().includes("/api/") && r.status() < 400 && (r.headers()["content-type"] || "").includes("json")) grab(await r.json().catch(() => null));
    if (r.status() >= 400 && r.url().includes("/api/") && !(!LIVE && new URL(r.url()).pathname === "/api/me")) {
      const body = await r.text().catch(() => "");
      R.errors.push(`[${brand.niche}] ${r.request().method()} ${new URL(r.url()).pathname} → ${r.status()} ${body.slice(0, 200)}`);
    }
  });
  const req = ctx.request;
  const j = async (method, url, data, form) => {
    const r = await req.fetch(url, { method, ...(form ? { multipart: form } : data !== undefined ? { data } : {}), timeout: 180000 });
    const txt = await r.text();
    let body; try { body = JSON.parse(txt); } catch { body = txt; }
    grab(body);
    if (!r.ok()) throw new Error(`${r.status()} ${typeof body === "object" ? body.detail || JSON.stringify(body) : body}`.slice(0, 400));
    return body;
  };
  const poll = async (url, done, ms = 240000) => {
    const t0 = Date.now(); let last;
    while (Date.now() - t0 < ms) { last = await j("GET", url); if (done(last)) return last; await sleep(3000); }
    throw new Error("انتهى وقت الانتظار (" + Math.round(ms / 1000) + " ث)");
  };
  // خطوة: بتتسجّل بنتيجتها ونقاطها ووقتها، والخطوة اللي تفشل مابتوقفش الباقي
  const step = async (name, fn) => {
    const b0 = await balance(req), t0 = Date.now();
    const s = { niche: brand.niche, brand: brand.name, step: name, ok: true };
    try { const note = await fn(); if (note) s.note = String(note).slice(0, 600); } catch (e) { s.ok = false; s.error = String(e.message || e).slice(0, 600); }
    const b1 = await balance(req);
    s.secs = Math.round((Date.now() - t0) / 1000);
    if (b0 != null && b1 != null) { s.credits = b0 - b1; s.usd = +(s.credits / 300).toFixed(3); }
    R.steps.push(s);
    console.log(`${s.ok ? "✅" : "❌"} [${brand.niche}] ${name}${s.credits != null ? ` · ${s.credits} نقطة` : ""} · ${s.secs}ث${s.error ? " · " + s.error : ""}`);
    return s.ok;
  };

  let bid = "";
  await step("إنشاء العلامة وتفعيلها", async () => {
    const b = await j("POST", "/api/ad-brains", { name: brand.name, fields: {} });
    bid = b.id;
    await j("PUT", "/api/clients/active", { id: bid });
  });
  if (!bid) { await ctx.close(); return; }

  await step("أسئلة العقل (١٥ سؤالًا)", async () => {
    const qs = await j("GET", "/api/brain-quiz?lang=ar");
    let n = 0;
    for (const q of qs) {
      const ans = brand.a[q.id];
      if (!ans) continue;
      await j("POST", `/api/ad-brains/${bid}/quiz`, { qid: q.id, answer: ans, lang: "ar" });
      n++;
    }
    const p = await j("GET", `/api/ad-brains/${bid}/plan`);
    const miss = ((p.know || {}).items || []).filter((i) => !i.done).map((i) => i.t);
    return `أجاب ${n} سؤالًا · العقل يفهمه ${p.score}٪ (المطلوب للخطة ${p.need}٪) · الناقص: ${miss.join("، ")}`;
  });

  await step("مصدر نصي للعقل ← اقتراحات ← موافقة", async () => {
    await j("POST", `/api/ad-brains/${bid}/sources`, undefined,
      { text: `${brand.a.about}\n${brand.a.proof.replace(/\n/g, "، ")}\n${brand.a.offer}`, note: "ملاحظات صاحب العلامة" });
    const b = await poll(`/api/ad-brains/${bid}`, (x) => !(x.sources || []).some((s) => /work|pending|run/.test(s.status || "")), 180000);
    const pend = (b.pending || []).filter((p) => p.id);
    // سؤال من العقل: بنجاوبه زي العميل
    for (const p of pend) await j("POST", `/api/ad-brains/${bid}/pending/${p.id}/approve`, p.kind === "question" ? { value: brand.a.audience } : {});
    return `${pend.length} اقتراح وافقنا عليه (${pend.map((p) => p.kind).join("، ")})`;
  });

  await step("رفع الشعار", async () => {
    // شعار بسيط بيترسم هنا (حرف أول من الاسم على دايرة بلون العلامة)، زي ما العميل بيرفع شعاره
    const lp = await ctx.newPage();
    await lp.setViewportSize({ width: 512, height: 512 });
    await lp.setContent(`<body style="margin:0;display:grid;place-items:center;height:512px;background:#fff"><div style="width:420px;height:420px;border-radius:50%;background:${brand.palette.split(",")[0]};
      display:grid;place-items:center;color:#fff;font:bold 220px sans-serif">${brand.name.trim()[0]}</div></body>`);
    const png = await lp.screenshot({ type: "png" });
    await lp.close();
    const b = await j("POST", `/api/ad-brains/${bid}/assets`, undefined, { kind: "logos", files: { name: "logo.png", mimeType: "image/png", buffer: png } });
    await poll(`/api/ad-brains/${bid}`, (x) => x.status !== "working", 240000).catch(() => null);
    return `${(b.logos || []).length} شعار`;
  });

  await step("ألوان العلامة", async () => {
    await j("PATCH", `/api/ad-brains/${bid}`, { fields: { palette: brand.palette } });
  });

  await step("اقتراح الخطوط ← قبوله", async () => {
    const s = await j("POST", `/api/ad-brains/${bid}/suggest/typography`);
    const v = s.value || (s.suggestion || {}).value;
    if (!v) throw new Error("لا يوجد اقتراح: " + JSON.stringify(s).slice(0, 200));
    await j("PATCH", `/api/ad-brains/${bid}`, { fields: { typography: v } });
    return v;
  });

  await step("الخطة (الاستراتيجية)", async () => {
    const s = await j("POST", "/api/strategy", { notes: "" });
    const st = s.strategy || {};
    return `${Object.keys(st).length} خانة · ${JSON.stringify(st).slice(0, 300)}`;
  });

  await step("فكرة ← تنقيح ← سكريبت", async () => {
    const fd = { text: `فكرة فيديو عن ${brand.a.pain} وكيف ${brand.name} يحلّها` };
    const l = await j("POST", "/api/my-ideas", undefined, fd);
    const it = (l.items || l.saved || l).filter ? (l.items || l.saved || l).slice(-1)[0] : null;
    const id = it && (it.id || (it.item && it.id));
    if (!id) throw new Error("الفكرة لم تُحفظ: " + JSON.stringify(l).slice(0, 200));
    const p = await j("POST", `/api/my-ideas/${id}/polish`);
    const s = await j("POST", `/api/my-ideas/${id}/script`);
    return `تنقيح: ${JSON.stringify(p).slice(0, 160)} · سكريبت: ${JSON.stringify(s).slice(0, 200)}`;
  });

  await step("منافسوك: اقتراح منافسين", async () => {
    await j("POST", "/api/rivals/discover");
    const r = await poll("/api/rivals", (x) => x.status !== "working", 420000);
    if (r.status === "failed") throw new Error(r.error || "فشل");
    const pick = r.items.filter((i) => i.state !== "approved").slice(0, 3).map((i) => i.id);
    if (pick.length) await j("POST", "/api/rivals/review", { approve: true, ids: pick });
    return `${r.items.length} منافس مقترح، وافقنا على ${pick.length} · ${r.items.slice(0, 5).map((i) => i.handle || i.name).join("، ")}`;
  });

  await step("الترند في المجال", async () => {
    await j("POST", `/api/ad-brains/${bid}/trends/refresh`);
    const t = await poll(`/api/ad-brains/${bid}/trends`, (x) => x.status !== "working", 420000);
    if (t.error) throw new Error(t.error);
    return `${t.items.length} ترند · ${t.items.slice(0, 3).map((i) => i.title || i.name || "").join("، ")}`;
  });

  await step("خطة الشهر", async () => {
    const m0 = await j("GET", "/api/plan/month");
    if (!m0.ready) throw new Error(`الخطة غير جاهزة: العقل ${m0.score}٪ من ${m0.need}٪ · استراتيجية: ${m0.has_strategy}`);
    await j("POST", "/api/plan/month", { per_day: 1 });
    const m = await poll("/api/plan/month", (x) => x.status !== "working", 420000);
    if (m.status === "failed") throw new Error(m.error || "فشلت");
    const items = (m.month && (m.month.items || m.month.days)) || [];
    return `${items.length} عنصر`;
  });

  // 📸 الشاشات بالعربي والإنجليزي
  for (const scr of ["#home", "#brand", "#plan", "#rivals", "#viral", "#brainlib"]) {
    for (const lang of ["ar", "en"]) await shot(page, brand, scr, lang);
  }
  await ctx.close();
  // الفيديو بيتحفظ لما الكونتكست يتقفل: اسمه بالمجال
  const vids = fs.readdirSync(path.join(OUT, "video")).filter((f) => f.endsWith(".webm") && !/^\d\d-/.test(f));
  vids.forEach((f) => fs.renameSync(path.join(OUT, "video", f), path.join(OUT, "video", `${String(BRANDS.indexOf(brand) + 1).padStart(2, "0")}-${brand.niche}.webm`)));
}

async function shot(page, brand, scr, lang) {
  await page.goto("/").catch(() => {});
  await page.evaluate((l) => { localStorage.setItem("studiomania.lang", l); localStorage.setItem("studiomania.i18n-audit", "1"); }, lang).catch(() => {});
  await page.goto("/" + scr).catch(() => {});
  // الشاشات بتسأل السيرفر كل شوية، فالصفحة مابتهداش أبدًا: بنستنى التحميل وبعدين ٣ ثواني
  await page.reload({ waitUntil: "load" }).catch(() => {});
  await sleep(3000);
  for (let i = 0; i < 3; i++) {   // نوافذ أول استخدام
    const no = page.locator(".ui-dlg .ui-dlg-no:not([disabled])");
    if (!(await no.count())) break;
    await no.first().click({ timeout: 1500 }).catch(() => {}); await sleep(400);
  }
  const file = `${brand.niche}-${scr.replace("#", "")}-${lang}.png`;
  await page.screenshot({ path: path.join(OUT, "shots", file), fullPage: true }).catch(() => {});
  const r = await page.evaluate(() => ({ m: window.I18N?.misses?.() || [], s: window.I18N?.seen?.() || [] })).catch(() => ({ m: [], s: [] }));
  if (lang === "en") r.m.filter((x) => AR.test(x) && !/^[؀-ۿ]$/.test(x)).forEach((x) => seenEn.has(x) || seenEn.set(x, `${brand.niche} ${scr}`));
  else r.s.forEach((x) => { const w = dialectOf(x); if (w && !seenDial.has(x)) seenDial.set(x, { where: `${brand.niche} ${scr}`, word: w }); });
}

function write() {
  const isContent = (x) => { const n = x.replace(/\s+/g, " ").replace(/…$/, "").trim(); return n.length > 1 && [...CONTENT].some((c) => c.includes(n)); };
  const en = [...seenEn].filter(([text]) => !ALLOW.missing.includes(text) && !/^[\s\d٠-٩.,:%·]+$/.test(text));
  R.lang.en_arabic = en.filter(([t]) => !isContent(t)).map(([text, where]) => ({ text, where }));
  R.lang.en_content = en.filter(([t]) => isContent(t)).map(([text, where]) => ({ text, where }));
  R.lang.ui_dialect = [...seenDial].map(([text, v]) => ({ text, ...v }));
  R.errors = [...new Set(R.errors)];
  const ok = R.steps.filter((s) => s.ok).length;
  const credits = R.steps.reduce((a, s) => a + (s.credits || 0), 0);
  R.total = { steps: R.steps.length, ok, failed: R.steps.length - ok, credits, usd: +(credits / 300).toFixed(2) };
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(R, null, 1));
  const md = [`# رحلة التجربة · المرحلة ${PHASE}`, "", `- الخطوات: ${ok} نجحت من ${R.steps.length}`, `- النقاط: ${credits} (≈ $${R.total.usd} تكلفة حقيقية)`,
    `- واجهة عربي في الوضع الإنجليزي: ${R.lang.en_arabic.length} · محتوى غير محمي من الترجمة: ${R.lang.en_content.length} · عامية في الواجهة: ${R.lang.ui_dialect.length} · أخطاء: ${R.errors.length}`, "",
    "| المجال | الخطوة | النتيجة | نقاط | ثوانٍ | ملاحظة |", "|---|---|---|---|---|---|",
    ...R.steps.map((s) => `| ${s.niche} | ${s.step} | ${s.ok ? "✅" : "❌"} | ${s.credits ?? ""} | ${s.secs} | ${(s.error || s.note || "").replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 160)} |`),
    "", "## عربي في الوضع الإنجليزي", ...R.lang.en_arabic.map((x) => `- ${x.text} — ${x.where}`),
    "", "## محتوى العميل أو الذكاء الاصطناعي غير محمي من الترجمة (لازم data-no-i18n)", ...R.lang.en_content.map((x) => `- ${x.text} — ${x.where}`),
    "", "## عامية في الواجهة", ...R.lang.ui_dialect.map((x) => `- ${x.text} («${x.word}») — ${x.where}`),
    "", "## الأخطاء", ...R.errors.map((e) => "- " + e.replace(/\n/g, " "))].join("\n");
  fs.writeFileSync(path.join(OUT, "report.md"), md + "\n");
  console.log(md.split("\n").slice(0, 6).join("\n"));
}

main();
