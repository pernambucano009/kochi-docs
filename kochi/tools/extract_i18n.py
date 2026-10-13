"""يطلّع كل الجمل العربي اللي بتظهر في الواجهة (من الـ HTML والـ JS ورسايل السيرفر)
عشان نترجمها. الجمل اللي فيها قيم متغيّرة بتطلع بعلامات {0} و {1}.

python tools/extract_i18n.py > /tmp/keys.json
"""
import io
import json
import re
import sys
import tokenize
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AR = re.compile(r"[؀-ۿ]")
MARK = "\x00{}\x00"


def js_literals(src: str):
    """يرجّع النصوص الثابتة في ملف JS: (نص فيه علامات مكان القيم المتغيّرة)."""
    out, i, n = [], 0, len(src)
    prev = ""  # آخر حرف مهم، عشان نفرّق بين القسمة والـ regex

    def read_template(i):
        # i بعد العلامة ` مباشرة
        parts, buf, k = [], [], 0
        while i < n:
            c = src[i]
            if c == "\\":
                buf.append(src[i:i + 2]); i += 2; continue
            if c == "`":
                parts.append("".join(buf)); return "".join(parts), i + 1
            if c == "$" and i + 1 < n and src[i + 1] == "{":
                parts.append("".join(buf)); buf = []
                j, depth = i + 2, 1
                while j < n and depth:
                    cj = src[j]
                    if cj in "'\"":
                        e = skip_string(j)
                        out.append(src[j + 1:e - 1])
                        j = e
                        continue
                    if cj == "`":
                        inner, j = read_template(j + 1)
                        out.append(inner)
                        continue
                    if cj == "{": depth += 1
                    elif cj == "}": depth -= 1
                    j += 1
                parts.append(MARK.format(k)); k += 1
                i = j; continue
            buf.append(c); i += 1
        return "".join(parts + buf), i

    def skip_string(i):
        q = src[i]; i += 1
        while i < n and src[i] != q:
            i += 2 if src[i] == "\\" else 1
        return i + 1

    while i < n:
        c = src[i]
        if src.startswith("//", i):
            i = src.find("\n", i); i = n if i < 0 else i; continue
        if src.startswith("/*", i):
            i = src.find("*/", i) + 2; continue
        if c in "'\"":
            j = skip_string(i); out.append(src[i + 1:j - 1]); i = j; prev = c; continue
        if c == "`":
            t, i = read_template(i + 1); out.append(t); prev = "`"; continue
        if c == "/" and (prev in "(,=:[!&|?{};+-*%<>~^" or prev == "" or src[max(0, i - 7):i].rstrip().endswith("return")):
            j = i + 1; cls = False
            while j < n:
                if src[j] == "\\": j += 2; continue
                if src[j] == "[": cls = True
                elif src[j] == "]": cls = False
                elif src[j] == "/" and not cls: break
                elif src[j] == "\n": break
                j += 1
            i = j + 1; prev = "/"; continue
        if not c.isspace(): prev = c
        i += 1
    return out


def segments(text: str):
    """يقسم النص على تاجات الـ HTML ويرجّع الأجزاء اللي فيها عربي (والـ title/placeholder)."""
    res = []
    for m in re.finditer(r'(?:title|placeholder|aria-label)="([^"]*)"', text):
        res.append(m.group(1))
    for part in re.split(r"<[^>]*>", text):
        res.append(part)
    keys = []
    for part in res:
        part = re.sub(r"\s+", " ", part).strip()
        if not AR.search(part):
            continue
        idx = [int(x) for x in re.findall(r"\x00(\d+)\x00", part)]
        order = {v: k for k, v in enumerate(dict.fromkeys(idx))}
        part = re.sub(r"\x00(\d+)\x00", lambda m: "{%d}" % order[int(m.group(1))], part)
        part = part.replace("\\n", "\n").replace("\\'", "'").replace('\\"', '"')
        for line in part.split("\n"):
            line = line.strip()
            if AR.search(line):
                keys.append(line)
    return keys


def py_strings(src: str):
    out = []
    for tok in tokenize.generate_tokens(io.StringIO(src).readline):
        if tok.type != tokenize.STRING or not AR.search(tok.string):
            continue
        s = tok.string
        m = re.match(r"^([rRbBuUfF]*)('''|\"\"\"|'|\")", s)
        prefix, q = m.group(1).lower(), m.group(2)
        if len(q) == 3:
            continue  # docstrings
        body = s[len(m.group(1)) + len(q):-len(q)]
        if "f" in prefix:
            k = [0]
            def rep(mm):
                r = MARK.format(k[0]); k[0] += 1; return r
            body = re.sub(r"(?<!\{)\{[^{}]+\}(?!\})", rep, body)
            body = body.replace("{{", "{").replace("}}", "}")
        out.append(body)
    return out


def main():
    keys = {}
    fe = ROOT / "frontend"
    for f in sorted(fe.glob("*.js")):
        if f.name.startswith("i18n"):
            continue
        for lit in js_literals(f.read_text(encoding="utf-8")):
            for k in segments(lit):
                keys.setdefault(k, f.name)
    for f in (fe / "index.html", fe / "login.html"):
        html = f.read_text(encoding="utf-8")
        html = re.sub(r"<script.*?</script>|<style.*?</style>", "", html, flags=re.S)
        for k in segments(html):
            keys.setdefault(k, f.name)
    for f in sorted((ROOT / "backend").glob("*.py")):
        for lit in py_strings(f.read_text(encoding="utf-8")):
            for k in segments(lit):
                keys.setdefault(k, f.name)
    if "--missing" in sys.argv:
        # الجمل اللي لسه مش في القاموس الإنجليزي
        dic = (ROOT / "frontend" / "i18n-en.js").read_text(encoding="utf-8")
        known = set(json.loads(dic.split("window.I18N_EN = ", 1)[1].strip().rstrip(";")))
        keys = {k: v for k, v in keys.items() if k not in known and len(k) > 1 and not re.search(r"[\\[\]$]", k)}
    json.dump(keys, sys.stdout, ensure_ascii=False, indent=0)


if __name__ == "__main__":
    main()
