"""🗺️ خريطة لغة البرنامج: كل جملة عربي بتظهر للعميل، من الكود نفسه (مش من الشاشة بس)، ومكانها، وترجمتها، ولو فيها عامية.

المصادر: الموقع (frontend/*.js و*.html)، تطبيق الجوال (mobile/app و mobile/src)، رسايل السيرفر اللي بتظهر في الواجهة
(HTTPException والملاحظات والعناوين)، وخانات القوالب (library/motion/r/*/reel.html).
الكلام اللي البرنامج بيكتبه للعميل بلهجته (البرومبتات) وأمثلة المحتوى بيتعلّم «محتوى» ومش بيتحسب خطأ.

    python3 tools/langmap.py            ← ملخص
    python3 tools/langmap.py --json     ← الخريطة كاملة
    python3 tools/langmap.py --csv      ← جدول (عربي، إنجليزي، إسباني، برتغالي، المكان) لإضافة لغات جديدة
"""
from __future__ import annotations

import csv
import io
import json
import re
import sys
import tokenize
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AR = re.compile(r"[ء-ي]")
HARAKAT = re.compile(r"[ً-ٰٟـ]")
LETTER = r"ء-ي"

# ---------------------------------------------------------------- العامية (نفس قايمة tests/i18n/dialect.js)
_words = json.loads((ROOT / "backend" / "dialect_words.json").read_text(encoding="utf-8"))
_alt = "|".join(re.escape(w).replace(" ", r"\s") for w in _words)
DIAL_RE = re.compile(rf"(?<![{LETTER}])({_alt})(?![{LETTER}])")
BVERB = re.compile(rf"(?<![{LETTER}])(بي|بت|بن)(عمل|قول|تكلم|شتغل|ظهر|جيب|دور|حصل|كتب|رسم|حكي|غني|تحرك|تحول|تجمع|تفتح|طلع|نزل|خلص|ضيف|شيل|حط|بعت|ساعد|عرف|فهم|شوف|لف|تغير|كبر|صغر|ترسم|ترمي|تكلم|تتحرك|تبني|توطى|يتكلم|يعمل|يقول)")


def dialect_of(s: str) -> str | None:
    s = re.sub(r"لا حاجة|بحاجة|في حاجة إلى", "", HARAKAT.sub("", s))   # «حاجة» بمعنى الاحتياج فصحى
    m = DIAL_RE.search(s) or BVERB.search(s)
    return m.group(0) if m else None


# ---------------------------------------------------------------- القاموس الإنجليزي
def en_dict() -> dict:
    src = (ROOT / "frontend" / "i18n-en.js").read_text(encoding="utf-8")
    body = src.split("window.I18N_EN = ", 1)[1].strip().rstrip(";").strip()
    body = re.sub(r",\s*}$", "}", body)   # فاصلة بعد آخر جملة
    return json.loads(body)


def allow() -> dict:
    try:
        return json.loads((ROOT / "tests" / "i18n" / "allow.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


# ---------------------------------------------------------------- استخراج الجمل بمكانها
STR_JS = re.compile(r"`((?:[^`\\]|\\.)*)`|\"((?:[^\"\\\n]|\\.)*)\"|'((?:[^'\\\n]|\\.)*)'")
TEXT_NODE = re.compile(r">([^<>{}`]*[ء-ي][^<>{}`]*)<")


def norm(s: str) -> str:
    """${x} و {x} ← {0} {1}… (نفس شكل مفاتيح القاموس)، والمسافات واحدة."""
    k = [0]

    def rep(_m):
        r = "{%d}" % k[0]
        k[0] += 1
        return r
    s = re.sub(r"\$\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", rep, s)
    return re.sub(r"\s+", " ", s).strip()


def pieces(s: str):
    """الجملة ممكن تبقى HTML: كل نص عربي بين الوسوم لوحده."""
    if "<" in s and ">" in s:
        for part in re.split(r"<[^>]*>", s):
            part = part.strip()
            if AR.search(part):
                yield part
    elif AR.search(s):
        yield s.strip()


sys.path.insert(0, str(ROOT / "tools"))
from extract_i18n import js_literals, segments  # noqa: E402  (نفس طريقة تقطيع الجمل اللي القاموس اتبنى بيها)


def line_of(src: str, key: str) -> int:
    runs = sorted(re.findall(r"[\u0621-\u064A][\u0621-\u064A\u064B-\u0652 ]{3,}", key), key=len, reverse=True)
    for r in runs[:2]:
        i = src.find(r.strip()[:24])
        if i >= 0:
            return src.count("\n", 0, i) + 1
    return 0


def scan_js(rel: str, kind: str):
    src = (ROOT / rel).read_text(encoding="utf-8")
    if rel in CONTENT_FILES:
        kind = "content"
    for lit in js_literals(src):
        if not AR.search(lit) or (re.search(r"[|][^ |]", lit) and lit.count(" ") < 2):   # أنماط بحث
            continue
        for k in segments(lit):
            if CODE.search(k):   # المحلّل اتلخبط وجاب حتة كود مش جملة
                continue
            yield k, f"{rel}:{line_of(src, k)}", kind


def scan_html(rel: str, kind: str):
    src = (ROOT / rel).read_text(encoding="utf-8")
    src = re.sub(r"<script\b.*?</script>|<style\b.*?</style>|<!--.*?-->", lambda m: "\n" * m.group(0).count("\n"), src, flags=re.S)
    for i, line in enumerate(src.split("\n"), 1):
        for m in TEXT_NODE.finditer(line):
            yield m.group(1).strip(), f"{rel}:{i}", kind
        for m in re.finditer(r'(?:title|placeholder|aria-label|alt|data-tip)="([^"]*[ء-ي][^"]*)"', line):
            yield m.group(1).strip(), f"{rel}:{i}", kind


# رسايل السيرفر اللي بتظهر للعميل كما هي (مش البرومبتات)
SERVER_UI = re.compile(r"HTTPException\(|\b(note|step|error|label|title|hint|desc|message|reason|toast)\s*=|\"(note|step|error|label|title|hint|desc|name|msg|why|text)\"\s*:")


def scan_py(rel: str):
    src = (ROOT / rel).read_text(encoding="utf-8")
    lines = src.split("\n")
    try:
        toks = list(tokenize.generate_tokens(io.StringIO(src).readline))
    except (tokenize.TokenError, IndentationError):
        return
    for tok in toks:
        if tok.type != tokenize.STRING or not AR.search(tok.string):
            continue
        m = re.match(r"^([rRbBuUfF]*)('''|\"\"\"|'|\")", tok.string)
        if not m or len(m.group(2)) == 3:
            continue   # docstrings
        body = tok.string[len(m.group(1)) + len(m.group(2)):-len(m.group(2))]
        if "f" in m.group(1).lower():
            body = re.sub(r"(?<!\{)\{[^{}]+\}(?!\})", "${x}", body).replace("{{", "{").replace("}}", "}")
        line = lines[tok.start[0] - 1]
        kind = "server" if SERVER_UI.search(line) and len(body) < 400 and "JSON" not in body else "content"
        for p in pieces(body.replace("\\n", "\n")):
            for seg in p.split("\n"):
                if AR.search(seg):
                    yield seg.strip(), f"{rel}:{tok.start[0]}", kind


TPL_FIELD = re.compile(r'\b(label|hint|tip|name|about|story|group)\s*:\s*"([^"]*[ء-ي][^"]*)"')


def scan_template(rel: str):
    for i, line in enumerate((ROOT / rel).read_text(encoding="utf-8").split("\n"), 1):
        if line.strip().startswith("//"):
            continue
        for m in TPL_FIELD.finditer(line):
            yield m.group(2).strip(), f"{rel}:{i}", "template"
        if "tips:" in line:
            for s in re.findall(r'"([^"]*[ء-ي][^"]*)"', line.split("tips:", 1)[1]):
                yield s.strip(), f"{rel}:{i}", "template"


def sources():
    fe = ROOT / "frontend"
    for f in sorted(fe.glob("*.js")):
        if not f.name.startswith("i18n"):
            yield from scan_js(f"frontend/{f.name}", "web")
    for f in sorted(fe.glob("*.html")):
        yield from scan_html(f"frontend/{f.name}", "web")
        if f.name in ("welcome.html", "welcome-m.html", "auth.html", "inspect.html", "index.html"):
            src = (fe / f.name).read_text(encoding="utf-8")
            for sc in re.findall(r"<script>(.*?)</script>", src, flags=re.S):
                for lit in js_literals(sc):
                    for k in segments(lit) if AR.search(lit) else ():
                        yield k, f"frontend/{f.name}:{line_of(src, k)}", "web"
    for d in ("mobile/app", "mobile/src"):
        for f in sorted((ROOT / d).rglob("*.ts*")):
            if "node_modules" not in f.parts:
                yield from scan_js(str(f.relative_to(ROOT)), "mobile")
    for f in sorted((ROOT / "backend").glob("*.py")):
        yield from scan_py(f"backend/{f.name}")
    for f in sorted((ROOT / "library" / "motion" / "r").glob("*/reel.html")):
        yield from scan_template(str(f.relative_to(ROOT)))


# الكود اللي بيعرض الكلام نفسه للعميل بالإنجليزي من غير القاموس (التطبيق عربي بس، والإنجليزي جوه الصفحة نفسها)
NO_EN = ("mobile", "content")
OWN_EN = ("frontend/welcome.html", "frontend/welcome-m.html", "frontend/inspect.html", "frontend/privacy.html", "frontend/terms.html", "frontend/refund.html")
# كلام بيترسم جوه الفيديو نفسه (التايبوجرافي): محتوى بلهجة العميل، مش واجهة
CONTENT_FILES = ("frontend/typo-studio.js", "frontend/typo-moments.js", "frontend/typo-engine.js")
CODE = re.compile(r";\s*return\b|=>|\bfunction\b|P\.k_|\bconst\s|\}\s*\)|[{};]\s*$")


def build() -> dict:
    en, al = en_dict(), allow()
    ok_dial = set(al.get("dialect") or []) | set(al.get("content") or [])
    items: dict[str, dict] = {}
    for text, where, kind in sources():
        k = norm(text)
        if len(k) < 2 or not AR.search(k):
            continue
        it = items.setdefault(k, {"ar": k, "kinds": set(), "where": [], "en": None, "dialect": None})
        it["kinds"].add(kind)
        if len(it["where"]) < 12:
            it["where"].append(where)
    for k, it in items.items():
        it["en"] = en.get(k) or en.get(k.rstrip(".:،")) or None
        kinds = it["kinds"]
        ui = kinds - {"content"}
        it["kind"] = "web" if "web" in kinds else "template" if "template" in kinds else "server" if "server" in kinds else "mobile" if "mobile" in kinds else "content"
        d = dialect_of(k) if ui and k not in ok_dial else None
        it["dialect"] = d
        own = all(w.split(":")[0] in OWN_EN for w in it["where"])
        it["needs_en"] = bool(ui - set(NO_EN)) and not own
        reviewed = k in set(al.get("content") or [])   # اتراجع بالعين: بيانات وضع التجربة، أجزاء برومبت، محتوى بلهجة العميل
        if reviewed:
            it["kind"], d, it["dialect"] = "content", None, None
        it["problems"] = [] if reviewed else [p for p, bad in (("no_en", it["needs_en"] and not it["en"]), ("dialect", bool(d))) if bad]
        it["kinds"] = sorted(kinds)
    rows = sorted(items.values(), key=lambda x: (not x["problems"], x["where"][0]))
    stat = {"total": len(rows), "ui": sum(r["kind"] != "content" for r in rows), "no_en": sum("no_en" in r["problems"] for r in rows),
            "dialect": sum("dialect" in r["problems"] for r in rows),
            "by_kind": {k: sum(r["kind"] == k for r in rows) for k in ("web", "mobile", "server", "template", "content")}}
    return {"stat": stat, "items": rows}


def to_csv(rows: list[dict]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["ar", "en", "es", "pt", "kind", "problems", "where"])
    for r in rows:
        if r["kind"] == "content":
            continue
        w.writerow([r["ar"], r["en"] or "", "", "", r["kind"], " ".join(r["problems"]), " ".join(r["where"])])
    return "﻿" + buf.getvalue()


if __name__ == "__main__":
    m = build()
    if "--json" in sys.argv:
        json.dump(m, sys.stdout, ensure_ascii=False, indent=1)
    elif "--csv" in sys.argv:
        sys.stdout.write(to_csv(m["items"]))
    else:
        print(json.dumps(m["stat"], ensure_ascii=False))
        if "--check" in sys.argv and (m["stat"]["no_en"] or m["stat"]["dialect"]):   # للـ CI: أي مشكلة = أحمر
            for r in [x for x in m["items"] if x["problems"]]:
                print(" ".join(r["problems"]), "|", r["where"][0], "|", r["ar"][:120])
            sys.exit(1)
        for r in [x for x in m["items"] if x["problems"]][:60]:
            print(" ".join(r["problems"]), "|", r["where"][0], "|", r["ar"][:90], f"[{r['dialect']}]" if r["dialect"] else "")
