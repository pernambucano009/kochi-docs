// 🔎 فحص اللغة الشامل: بيشغّل البرنامج في وضع التجربة (من غير أي مفاتيح ولا نقاط)، ويفتح كل شاشة بالإنجليزي،
// ويدوس كل زرار وتبويب ومربع (وجوه النوافذ اللي بتتفتح)، ويسجّل:
//   1) أي جملة عربي ظهرت ومالهاش ترجمة إنجليزي كاملة في القاموس (I18N.misses)
//   2) أي جملة عربي فيها عامية (الواجهة لازم فصحى)
// الأزرار الخطيرة (احذف، خروج، افصل…) مابيدوسهاش، وأي تأكيد بيقول له «لا».
//
// التشغيل (من فولدر studiomania):   node tests/i18n/audit.js            ← كل الشاشات
//                                    node tests/i18n/audit.js "#settings,#brand"   ← شاشات بعينها
//                                    CHUNK=1/3 node tests/i18n/audit.js   ← تلت الشاشات (تقريبًا ٢٥ دقيقة لكل جزء)
// النتيجة: tests/i18n/report.json، والخروج 1 لو فيه جملة جديدة مش في tests/i18n/allow.json
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../..");
const PORT = 8800 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const PW = "Audit-pass-2026!";
const ALLOW = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, "allow.json"), "utf8")); } catch { return { missing: [], dialect: [] }; } })();
const MAX_CLICKS = +(process.env.MAX_CLICKS || 70);   // لكل شاشة

// ---------- الشاشات: من الكود نفسه، فأي شاشة جديدة بتدخل الفحص لوحدها ----------
function screens() {
  const home = fs.readFileSync(path.join(ROOT, "frontend/home2.js"), "utf8");
  const shell = fs.readFileSync(path.join(ROOT, "frontend/shell.js"), "utf8");
  const pages = [...home.matchAll(/^\s{4}(\w+): (?:KOCHI \? [^\n]*\n\s*: )?\{[^\n]*?page: "(\w+)"/gm)].map((m) => m[2]);
  const block = shell.slice(shell.indexOf("const STEP_INFO"), shell.indexOf("};", shell.indexOf("const STEP_INFO")));
  const steps = [...block.matchAll(/^\s+"?(\w+)"?: \{/gm)].map((m) => m[1]);
  return ["#home", ...new Set(pages.map((k) => "#" + k)), ...steps.map((k) => "#" + k)];
}
const PUBLIC = ["/welcome", "/pricing", "/terms.html", "/privacy.html", "/refund.html", "/go.html"];

// ---------- العامية ----------
// كلمات واضحة إنها عامية (مصري/خليجي/شامي). كلمة كاملة بس، عشان «بيت» و«بينما» مايتعلّموش
const DIALECT = ["إزاي", "ازاي", "عايز", "عايزة", "عاوز", "دلوقتي", "دلوقت", "كده", "كدا", "مش", "مفيش", "مافيش", "فين", "إيه", "ايه", "اللي", "بتاع", "بتاعة", "بتاعك",
  "بتاعتك", "علشان", "عشان", "لسه", "برضه", "حاجة", "حاجات", "خليك", "شوية", "كتير", "أوي", "اوي", "إحنا", "احنا", "معلش", "يلا", "جوه", "بره", "برّه", "زي", "بقى", "بقت",
  "هيبقى", "هتبقى", "بيبقى", "اتعمل", "اتعملت", "ابعت", "ابعتلي", "عاجبك", "ماتنساش", "شغّال", "شغال", "خلّي", "خلي", "ليه", "إمتى", "امتى", "مين", "كمان", "تاني", "تانية",
  "اوعى", "باسورد", "الباسوردين", "حلو", "حلوة", "بتاعنا", "ولا حاجة", "يعمل إيه", "هنا بس", "بس"];
const DIAL_RE = new RegExp(`(?<![\\u0621-\\u064A])(${DIALECT.map((w) => w.replace(/ /g, "\\s")).join("|")})(?![\\u0621-\\u064A])`);
// فعل مضارع بـ «بـ» قدامه (بيعمل، بتقول، بنكتب): أكتر علامة للعامية. الكلمات الفصحى اللي بتبدأ كده مستثناة
const BVERB = /(?<![ء-ي])(بي|بت|بن)(عمل|قول|تكلم|شتغل|ظهر|جيب|دور|حصل|كتب|رسم|حكي|غني|تحرك|تحول|تجمع|تفتح|طلع|نزل|خلص|ضيف|شيل|حط|بعت|ساعد|عرف|فهم|شوف|لف|تغير|كبر|صغر|ترسم|ترمي|تكلم|تتحرك|تبني|توطى|يتكلم|يعمل|يقول)/;

function dialectOf(s) {
  const m = s.match(DIAL_RE) || s.match(BVERB);
  return m ? m[0] : null;
}

// ---------- الأزرار الخطيرة ----------
const DANGER = /حذف|احذف|امسح|مسح|خروج|اخرج|افصل|فصل الحساب|ألغ|إلغاء الاشتراك|سجّل الخروج|delete|remove|log ?out|sign ?out|disconnect|unlink|cancel (the )?subscription|reset|wipe|🗑|✕ احذف/i;
const SKIP_SEL = "#nhLang, #langToggle, [data-lang], [data-theme], #nhTheme, #logout, #setLogout, a[download], a[target=_blank], [href^='http']";

async function serve(data) {
  const env = { ...process.env, STUDIOMANIA_DATA: data, ATLAS_MOCK: "1", PUBLISH_MOCK: "1" };
  for (const k of ["APP_PASSWORD", "GATEWAY_SECRET", "TENANT_ROLE"]) delete env[k];
  const py = process.env.PYTHON || "python3";
  const proc = spawn(py, ["-m", "uvicorn", "app:app", "--app-dir", "backend", "--port", String(PORT), "--log-level", "warning"], { cwd: ROOT, env, stdio: ["ignore", "ignore", "pipe"] });
  let err = ""; proc.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(BASE + "/health"); if (r.ok) return proc; } catch { /* لسه بيقوم */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  proc.kill(); throw new Error("البرنامج ماشتغلش:\n" + err);
}

async function main() {
  const only = process.argv[2] ? process.argv[2].split(",") : null;
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "i18n-audit-"));
  // 💳 حالات ماتظهرش في وضع التجربة لوحدها (رصيد خلص، طلب فشل) عشان كروت «رصيد المنصات» تتفحص هي كمان
  fs.writeFileSync(path.join(data, "providers.json"), JSON.stringify({ p: {
    scrape: { balance: 0, ok: false, fail: { at: Date.now() / 1000, msg: "402 payment required: credits" } },
    eleven: { balance: 4200, ok: true }, atlas: { balance: 3.5, ok: true } }, min: {}, alerted: {} }));
  const app = await serve(data);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // 🔒 مفيش أي طلب يطلع برّه الجهاز (خدمات حقيقية، دخول بجوجل، روابط شحن)
  await ctx.route("**/*", (r) => (new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort()));
  const page = await ctx.newPage();
  ctx.on("page", (pg) => { if (pg !== page) pg.close().catch(() => {}); });   // أي تبويب جديد بيتقفل
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));

  // دخول (أول مرة بيعمل كلمة المرور)
  await page.goto(BASE + "/login");
  await page.fill("#pw", PW);
  if (await page.isVisible("#pw2")) await page.fill("#pw2", PW);
  await page.click("#submit");
  await page.waitForTimeout(1500);
  await page.evaluate(() => { localStorage.setItem("studiomania.lang", "en"); localStorage.setItem("studiomania.i18n-audit", "1"); });
  // شوية بيانات عشان الشاشات ماتبقاش فاضية
  await page.evaluate(async () => {
    const j = (b) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    await fetch("/api/folders", j({ name: "Audit project" })).catch(() => {});
    const fd = new FormData(); fd.append("text", "Audit idea"); await fetch("/api/my-ideas", { method: "POST", body: fd }).catch(() => {});
  });

  const miss = new Map(), seen = new Map(), vals = new Map();   // الجملة ← أول شاشة ظهرت فيها
  const collect = async (where) => {
    const r = await page.evaluate(() => ({ m: window.I18N?.misses?.() || [], s: window.I18N?.seen?.() || [],
      // ✍️ اللي جوه خانات الكتابة: أداة الترجمة مابتلمسهاش، فالكلام العربي اللي البرنامج حاطه فيها كان بيعدّي من غير ما يتشاف
      // (زي ملاحظات الفواتير في الإعدادات). اللي العميل كتبه أو محتوى علامته بيتعلّم data-no-i18n عشان مايتعدّش
      v: [...document.querySelectorAll("input:not([type=hidden]):not([type=file]), textarea")]
        .filter((x) => x.offsetParent && /[\u0600-\u06FF]/.test(x.value) && !x.closest("[data-no-i18n]") && x.value === x.defaultValue)
        .map((x) => x.value.replace(/\s+/g, " ").trim().slice(0, 200)) })).catch(() => ({ m: [], s: [], v: [] }));
    r.m.forEach((x) => miss.has(x) || miss.set(x, where));
    r.s.forEach((x) => seen.has(x) || seen.set(x, where));
    r.v.forEach((x) => vals.has(x) || vals.set(x, where));
  };
  const open = async (url) => {
    await page.goto(BASE + url).catch(() => {});
    await page.reload({ waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(1800);
    // نوافذ أول استخدام: «لاحقًا»
    for (let i = 0; i < 3; i++) {
      const no = page.locator(".ui-dlg .ui-dlg-no:not([disabled])");
      if (!(await no.count())) break;
      await collect(url); await no.first().click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(500);
    }
  };

  // CHUNK=2/3 ← الجزء التاني من ٣ (الفحص الكامل أطول من حد وقت التشغيل، فبيتقسم)
  const [ci, cn] = (process.env.CHUNK || "1/1").split("/").map(Number);
  const all = only || [...PUBLIC, ...screens()];
  const list = all.filter((_, i) => i % cn === ci - 1);
  let clicks = 0;
  for (const scr of list) {
    const url = scr.startsWith("#") ? "/" + scr : scr;
    await open(url);
    await collect(scr);
    const done = new Set();
    let fails = 0;
    for (let n = 0; n < MAX_CLICKS; n++) {
      // الأزرار الظاهرة دلوقتي (أولوية للي جوه نافذة مفتوحة)، كل واحد ببصمة: نوعه وكلامه ومكانه في الصفحة
      const cand = await page.evaluate(({ skip, danger }) => {
        const D = new RegExp(danger, "i");
        const els = [...document.querySelectorAll("button, [role=button], [role=tab], a[href^='#'], summary, .nh-tile, [data-id], [data-go], [data-tab], [data-pick], label.chip, .bl-fd")];
        const out = [];
        for (const el of els) {
          if (el.closest(skip) || el.matches(skip) || el.disabled) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) continue;
          const st = getComputedStyle(el);
          if (st.visibility === "hidden" || st.pointerEvents === "none" || +st.opacity < 0.2) continue;
          const lab = [(el.textContent || "").trim().slice(0, 60), el.getAttribute("title") || "", el.getAttribute("aria-label") || "", el.className && typeof el.className === "string" ? el.className : "",
            ...[...el.attributes].filter((a) => a.name.startsWith("data-")).map((a) => a.name + "=" + a.value)].join(" | ");
          if (D.test(lab)) continue;
          // زرار «تمام» في نافذة تأكيد: بس لو النافذة نفسها مافيهاش كلام خطير
          if (el.matches(".ui-dlg-ok") && D.test(el.closest(".ui-dlg")?.textContent || "")) continue;
          const inModal = !!el.closest(".ui-dlg, .vl-ov, dialog[open], .flw, .hp-box, [role=dialog]");
          out.push({ sig: el.tagName + "|" + lab.slice(0, 140), inModal });
        }
        return out;
      }, { skip: SKIP_SEL, danger: DANGER.source }).catch(() => []);
      const next = cand.filter((c) => !done.has(c.sig)).sort((a, b) => b.inModal - a.inModal)[0];
      if (!next) break;
      done.add(next.sig);
      const before = await page.evaluate(() => location.pathname + location.hash).catch(() => "");
      // نلاقي نفس العنصر تاني بنفس البصمة وندوس عليه
      const ok = await page.evaluate(({ sig, skip }) => {
        const els = [...document.querySelectorAll("button, [role=button], [role=tab], a[href^='#'], summary, .nh-tile, [data-id], [data-go], [data-tab], [data-pick], label.chip, .bl-fd")];
        for (const el of els) {
          if (el.closest(skip) || el.matches(skip)) continue;
          const lab = [(el.textContent || "").trim().slice(0, 60), el.getAttribute("title") || "", el.getAttribute("aria-label") || "", el.className && typeof el.className === "string" ? el.className : "",
            ...[...el.attributes].filter((a) => a.name.startsWith("data-")).map((a) => a.name + "=" + a.value)].join(" | ");
          if (el.tagName + "|" + lab.slice(0, 140) === sig) { el.setAttribute("data-audit-hit", "1"); return true; }
        }
        return false;
      }, { sig: next.sig, skip: SKIP_SEL }).catch(() => false);
      if (!ok) continue;
      const hit = page.locator("[data-audit-hit]").first();
      const clicked = await hit.click({ timeout: 1500 }).then(() => true, () => false);
      await page.evaluate(() => document.querySelectorAll("[data-audit-hit]").forEach((e) => e.removeAttribute("data-audit-hit"))).catch(() => {});
      if (!clicked) { if (++fails > 6) { await open(url); fails = 0; } continue; }
      fails = 0; clicks++;
      await page.waitForTimeout(700);
      await collect(scr);
      // لو الضغطة ودّتنا شاشة تانية: نرجع لشاشتنا (الشاشة التانية ليها دورها في القايمة)
      const after = await page.evaluate(() => location.pathname + location.hash).catch(() => "");
      if (after !== before && !next.inModal) await open(url);
    }
    // اقفل أي نافذة لسه مفتوحة
    await page.keyboard.press("Escape").catch(() => {});
    process.stdout.write(`${scr}: ${miss.size} ناقص / ${clicks} ضغطة\n`);
  }

  await browser.close();
  app.kill();

  // ---------- التقرير ----------
  const AR = /[؀-ۿ]/;
  const LATIN = /[A-Za-z]{3,}/;
  // الجمل الأصلية بس (اللي اتخلطت بعد ترجمة جزئية بتتشال، أصلها موجود)
  const missing = [...miss].filter(([s]) => AR.test(s) && !(LATIN.test(s) && [...miss.keys()].some((o) => o !== s && !LATIN.test(o))) && !/^[؀-ۿ]$/.test(s) && !/^[٠-٩\d\s.,:%]+$/.test(s))
    .map(([s, w]) => ({ text: s, screen: w })).filter((x) => !ALLOW.missing.includes(x.text));
  const dialect = [...seen].map(([s, w]) => ({ text: s, screen: w, word: dialectOf(s) })).filter((x) => x.word && !ALLOW.dialect.includes(x.text));
  const inputs = [...vals].map(([s, w]) => ({ text: s, screen: w })).filter((x) => !(ALLOW.inputs || []).includes(x.text));
  const report = { at: new Date().toISOString(), screens: list.length, clicks, missing, inputs, dialect, errors: [...new Set(errors)] };
  fs.writeFileSync(path.join(__dirname, process.env.CHUNK ? `report-${ci}.json` : "report.json"), JSON.stringify(report, null, 1));
  console.log(`\n🔎 ${list.length} شاشة، ${clicks} ضغطة`);
  console.log(`  ${missing.length} جملة ظهرت بالإنجليزي من غير ترجمة`);
  console.log(`  ${inputs.length} خانة كتابة فيها كلام عربي من البرنامج`);
  console.log(`  ${dialect.length} جملة عربي فيها عامية`);
  console.log(`  ${report.errors.length} خطأ في الصفحة`);
  console.log("  التفاصيل: tests/i18n/report.json");
  fs.rmSync(data, { recursive: true, force: true });
  process.exit(missing.length || inputs.length || dialect.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
