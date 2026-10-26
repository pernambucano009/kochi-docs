// 🗣️ فحص ثابت (من غير متصفح): أي جملة عربي مكتوبة في كود الواجهة أو نصوص السيرفر اللي بتظهر للعميل وفيها عامية.
// الفحص الشامل (audit.js) بيشوف اللي بيظهر على الشاشة بس، فالكلام اللي جوه شاشات بتحتاج بيانات (زي نصايح الأفاتار) كان بيفوته.
// التشغيل: node tests/i18n/static.js   ← الخروج 1 لو فيه جملة جديدة مش في allow.json (dialect)
const fs = require("fs");
const path = require("path");
const { dialectOf } = require("./dialect");

const ROOT = path.resolve(__dirname, "../..");
const ALLOW = new Set((() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, "allow.json"), "utf8")).dialect || []; } catch { return []; } })());
// ملفات السيرفر اللي نصوصها بتظهر في الواجهة كما هي (مش كلام البرنامج اللي بيكتبه للعميل بلهجته)
const BACKEND_UI = ["backend/twin.py"];
// 📱 وتطبيق الجوال كمان (كل شاشاته)
const walk = (d) => fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? (e.name === "node_modules" ? [] : walk(`${d}/${e.name}`)) : /\.tsx?$/.test(e.name) ? [`${d}/${e.name}`] : []) : [];
const files = [
  ...fs.readdirSync(path.join(ROOT, "frontend")).filter((f) => f.endsWith(".js") && f !== "i18n-en.js").map((f) => "frontend/" + f),
  ...BACKEND_UI, ...walk("mobile/app"), ...walk("mobile/src"),
];
const hits = [];
for (const f of files) {
  fs.readFileSync(path.join(ROOT, f), "utf8").split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|#|\/\*|\*)/.test(line)) return;   // تعليقات الكود عامية عادي
    const code = line.replace(/\s(\/\/|#) .*$/, "");
    for (const m of code.matchAll(/["'`]([^"'`]*[ء-ي][^"'`]*)["'`]/g)) {
      const s = m[1].replace(/\$\{[^}]*\}/g, "…").trim();
      if (s.includes("|")) continue;   // أنماط بحث (regex) مش كلام بيظهر
      const d = dialectOf(s);
      if (d && !ALLOW.has(s)) hits.push({ file: `${f}:${i + 1}`, word: d, text: s.slice(0, 160) });
    }
  });
}
fs.writeFileSync(path.join(__dirname, "static-report.json"), JSON.stringify(hits, null, 1));
hits.forEach((h) => console.log(`${h.file}  [${h.word}]  ${h.text}`));
console.log(`\n${hits.length} جملة فيها عامية`);
process.exit(hits.length ? 1 : 0);
