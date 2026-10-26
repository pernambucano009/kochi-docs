// 🧊 فحص ثبات الشاشات: الرعشة، وإعادة الرسم، والتمرير اللي بيتلغي، والفيديو اللي بيتحمّل من الأول، والكتابة اللي بتضيع.
// بيشغّل البرنامج في وضع التجربة (من غير مفاتيح ولا نقاط)، ويفتح كل شاشة، وينزل في الصفحة زي المستخدم، ويسيبها
// من غير ما يلمسها، ويسجّل أي حاجة اتغيّرت لوحدها. وفيه سيناريو «وقت التشغيل»: الدبلجة والسيرفر بيرد إنه لسه شغّال.
//
// التشغيل (من فولدر studiomania):  node tests/ui/stability.js            ← كل الشاشات
//                                   node tests/ui/stability.js "#13,#7"   ← شاشات بعينها
// النتيجة: tests/ui/stability.json، والخروج 1 لو فيه مشكلة
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../..");
const PORT = 8700 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const PW = "Stable-pass-2026!";
const IDLE_MS = +(process.env.IDLE_MS || 7000);   // وقت المراقبة من غير لمس لكل شاشة
// الحدود: أعلى من كده = مشكلة يحس بيها المستخدم
const LIMIT = { cls: 0.05, churn: 40, media: 0, jumps: 0, focus: 0 };

function screens() {
  const home = fs.readFileSync(path.join(ROOT, "frontend/home2.js"), "utf8");
  const shell = fs.readFileSync(path.join(ROOT, "frontend/shell.js"), "utf8");
  const pages = [...home.matchAll(/^\s{4}(\w+): (?:KOCHI \? [^\n]*\n\s*: )?\{[^\n]*?page: "(\w+)"/gm)].map((m) => m[2]);
  const block = shell.slice(shell.indexOf("const STEP_INFO"), shell.indexOf("};", shell.indexOf("const STEP_INFO")));
  const steps = [...block.matchAll(/^\s+"?(\w+)"?: \{/gm)].map((m) => m[1]);
  return ["#home", ...new Set(pages.map((k) => "#" + k)), ...steps.map((k) => "#" + k)];
}

// بيتحط في الصفحة قبل أي كود: بيراقب كل حاجة بتتغير لوحدها
const MONITOR = () => {
  const M = (window.__stab = { input: 0, cls: 0, shifts: [], removed: 0, media: [], jumps: [], focus: [], t0: performance.now() });
  const mark = () => { M.input = performance.now(); };
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach((e) => addEventListener(e, mark, true));
  const quiet = () => performance.now() - M.input > 1200;
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput && quiet()) {
        M.cls += e.value;
        const src = (e.sources || [])[0]?.node;
        M.shifts.push({ v: +e.value.toFixed(3), el: src ? (src.id ? "#" + src.id : src.className?.toString?.().slice(0, 40) || src.nodeName) : "?" });
      }
    }).observe({ type: "layout-shift", buffered: false });
  } catch { /* متصفح قديم */ }
  const srcOf = (n) => n.getAttribute && (n.getAttribute("src") || n.currentSrc || "");
  new MutationObserver((muts) => {
    if (!quiet()) return;
    const gone = new Map();
    for (const m of muts) {
      m.removedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        M.removed += 1 + n.getElementsByTagName("*").length;
        [n, ...n.querySelectorAll("video,img,iframe,audio")].forEach((x) => { if (/^(VIDEO|IMG|IFRAME|AUDIO)$/.test(x.tagName) && srcOf(x)) gone.set(srcOf(x), x.tagName); });
      });
    }
    if (!gone.size) return;
    for (const m of muts) m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      [n, ...n.querySelectorAll("video,img,iframe,audio")].forEach((x) => { const s = srcOf(x); if (s && gone.has(s)) M.media.push(x.tagName + " " + s.split("/").pop().slice(0, 40)); });
    });
  }).observe(document, { childList: true, subtree: true });
  // التمرير: كل ربع ثانية بنشوف مكان كل حاجة بتتمرر، ولو اتحركت من غير لمس يبقى اتلغى
  const pos = new Map();
  setInterval(() => {
    const els = [document.scrollingElement, ...document.querySelectorAll("*")].filter((e) => e && e.scrollHeight > e.clientHeight + 40 && (e === document.scrollingElement || /(auto|scroll)/.test(getComputedStyle(e).overflowY)));
    for (const e of els) {
      const was = pos.get(e), now = e.scrollTop;
      if (was !== undefined && Math.abs(now - was) > 40 && quiet() && e.isConnected) M.jumps.push({ el: e.id ? "#" + e.id : e.className?.toString?.().slice(0, 40) || e.nodeName, from: Math.round(was), to: Math.round(now) });
      pos.set(e, now);
    }
  }, 250);
  // الخانة اللي بتكتب فيها اتشالت من الصفحة
  addEventListener("focusout", (e) => { const t = e.target; setTimeout(() => { if (t && !t.isConnected && t.matches?.("input,textarea,[contenteditable]")) M.focus.push(t.name || t.id || t.className || t.tagName); }, 0); }, true);
};

async function serve(data) {
  const env = { ...process.env, STUDIOMANIA_DATA: data, ATLAS_MOCK: "1", PUBLISH_MOCK: "1" };
  for (const k of ["APP_PASSWORD", "GATEWAY_SECRET", "TENANT_ROLE"]) delete env[k];
  const proc = spawn(process.env.PYTHON || "python3", ["-m", "uvicorn", "app:app", "--app-dir", "backend", "--port", String(PORT), "--log-level", "warning"], { cwd: ROOT, env, stdio: ["ignore", "ignore", "pipe"] });
  let err = ""; proc.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(BASE + "/health")).ok) return proc; } catch { /* لسه */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  proc.kill(); throw new Error("البرنامج ماشتغلش:\n" + err);
}

// فيديو صغير (٤ ثواني بصوت) لسيناريو الدبلجة
function tinyVideo(dir) {
  const out = path.join(dir, "tiny.mp4");
  let ff = "ffmpeg";
  try { ff = execFileSync(process.env.PYTHON || "python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim(); } catch { /* ffmpeg من النظام */ }
  execFileSync(ff, ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=320x568:rate=24:duration=4", "-f", "lavfi", "-i", "sine=frequency=300:duration=4",
    "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", out]);
  return out;
}

async function main() {
  const only = process.argv[2] ? process.argv[2].split(",") : null;
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "stab-"));
  const app = await serve(data);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route("**/*", (r) => (new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort()));
  await ctx.addInitScript(MONITOR);
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.dismiss().catch(() => {}));

  await page.goto(BASE + "/login");
  await page.fill("#pw", PW);
  if (await page.isVisible("#pw2")) await page.fill("#pw2", PW);
  await page.click("#submit");
  await page.waitForTimeout(1500);

  const results = [];
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      const no = page.locator(".ui-dlg .ui-dlg-no:not([disabled])");
      if (!(await no.count())) break;
      await no.first().click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(400);
    }
  };
  // نفتح الشاشة، ننزل لنص كل حاجة بتتمرر، ونسيبها من غير لمس ونقيس
  const observe = async (name) => {
    await page.evaluate(() => {
      for (const e of [document.scrollingElement, ...document.querySelectorAll("*")]) {
        if (e && e.scrollHeight > e.clientHeight + 200 && (e === document.scrollingElement || /(auto|scroll)/.test(getComputedStyle(e).overflowY))) e.scrollTop = (e.scrollHeight - e.clientHeight) / 2;
      }
      // إحنا اللي نزلنا دلوقتي: نعتبرها لمسة، عشان مايتحسبش «التمرير اتلغى»
      const M = window.__stab; Object.assign(M, { cls: 0, shifts: [], removed: 0, media: [], jumps: [], focus: [], input: performance.now(), t0: performance.now() });
    }).catch(() => {});
    await page.waitForTimeout(1300);
    await page.evaluate(() => Object.assign(window.__stab, { cls: 0, shifts: [], removed: 0, media: [], jumps: [], focus: [], t0: performance.now() })).catch(() => {});
    await page.waitForTimeout(IDLE_MS);
    const m = await page.evaluate(() => ({ ...window.__stab, secs: (performance.now() - window.__stab.t0) / 1000 })).catch(() => null);
    if (!m) return;
    const r = { screen: name, cls: +m.cls.toFixed(3), churn: Math.round(m.removed / m.secs), media: [...new Set(m.media)], jumps: m.jumps.slice(0, 5), focus: m.focus, shifts: m.shifts.slice(0, 5) };
    r.bad = [r.cls > LIMIT.cls && "رعشة", r.churn > LIMIT.churn && "إعادة رسم", r.media.length > LIMIT.media && "فيديو/صورة بتتحمّل من الأول", r.jumps.length > LIMIT.jumps && "التمرير بيتلغي", r.focus.length > LIMIT.focus && "الكتابة بتضيع"].filter(Boolean);
    results.push(r);
    console.log(`${name.padEnd(22)} ${r.bad.length ? "✗ " + r.bad.join("، ") : "✓"}   (رعشة ${r.cls} · ${r.churn} عنصر/ث · فيديو ${r.media.length} · نطّات ${r.jumps.length})`);
  };

  for (const scr of only || screens()) {
    await page.goto(BASE + "/" + scr).catch(() => {});
    await page.reload({ waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(1500);
    await settle();
    await observe(scr);
  }

  // ---------- سيناريو وقت التشغيل: الدبلجة والسيرفر بيرد «لسه شغّال» ----------
  if (!only || only.includes("#13")) {
    try {
      const file = tinyVideo(data);
      const id = await page.evaluate(async (b64) => {
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const fd = new FormData(); fd.append("file", new Blob([bin], { type: "video/mp4" }), "tiny.mp4");
        const r = await fetch("/api/dub", { method: "POST", body: fd }); return (await r.json()).id;
      }, fs.readFileSync(file).toString("base64"));
      // نستنى الكلام يتكتب (وضع التجربة)، وبعدين نخلّي كل رد «لسه شغّال» بخطوة بتتغير
      for (let i = 0; i < 40; i++) {
        const d = await page.evaluate(async (id) => (await fetch(`/api/dub/${id}`)).json(), id);
        if (!d.busy) break;
        await page.waitForTimeout(500);
      }
      let n = 0;
      await page.route(new RegExp(`/api/dub/${id}$`), async (r) => {
        const res = await r.fetch(); const j = await res.json();
        n++; j.busy = true; j.step = `جارٍ تسجيل الجمل (${n} من 10)`;
        for (const t of Object.values(j.targets || {})) { t.busy = true; t.step = j.step; }
        r.fulfill({ response: res, json: j });
      });
      await page.evaluate((id) => localStorage.setItem("studiomania.dub", id), id);
      await page.goto(BASE + "/#13"); await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(1500);
      await settle();
      await observe("#13 وقت التشغيل");
      await page.unroute(new RegExp(`/api/dub/${id}$`));
    } catch (e) { console.log("سيناريو الدبلجة ماكملش:", e.message.slice(0, 200)); }
  }

  await browser.close();
  app.kill();
  const bad = results.filter((r) => r.bad.length);
  fs.writeFileSync(path.join(__dirname, "stability.json"), JSON.stringify({ at: new Date().toISOString(), limits: LIMIT, results }, null, 1));
  console.log(`\n🧊 ${results.length} شاشة: ${bad.length} فيها مشكلة. التفاصيل: tests/ui/stability.json`);
  fs.rmSync(data, { recursive: true, force: true });
  process.exit(bad.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
