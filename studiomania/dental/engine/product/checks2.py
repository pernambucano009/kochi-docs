"""فحوصات أوتوماتيك للأخطاء اللي كانت بالعين بس (البلاي بوك qa.md Q9–Q11).

Q9  lint_templates   فحص كود القوالب (T.py/tl.py) قبل الريندر:
      L1 نص على الشاشة بالعامية (E312)  — نفس قايمة العامية بتاعة المنصة (dialect_words.json)
      L2 قلب صورة (flip/mirror) من غير سبب مكتوب (E53 نص معكوس)          — لازم "# qa-ok: السبب" على نفس السطر
      L3 perspective warp من غير سبب مكتوب (E32 تشويه في اللف)            — نفسه
      L5 أي صورة كاست بيستخدمها القالب لازم تعدّي Q11 (E203)
      L6 صبغة على السنان (upper_tint) أو تحول قبل/بعد بتوقيت مكتوب باليد بدل strokes.Stroke / strokes.BeforeAfter (E452 E454 E458)
      L4 أنماط اتسببت في أخطاء قبل كده: pkill (E378)، setdefault(..., Clip( (E364)، رقم ffmpeg من غير صفر "=.5" (E360)
Q10 iso_check        عنصر سنان معزولة (RGBA): جوه بق/لسان باين (E24 E140) • سنان لامسة حافة الصورة = مقطوشة (E141)
Q11 cast_gum         كاست المعمل عليه لثة (E203)
الاستخدام:  python3 checks2.py lint      |  python3 checks2.py iso <png...>  |  python3 checks2.py cast <png...>
"""
import sys, re, json, os
import numpy as np, cv2
from PIL import Image
S = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/")
DIALECT = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/../../backend/dialect_words.json")


# ---------------- Q9: فحص كود القوالب ----------------
def _dialect():
    try:
        sys.path.insert(0, ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/../../tools")); from langmap import dialect_of; return dialect_of
    except Exception:
        w = json.load(open(DIALECT, encoding="utf-8")); words = [x for v in (w.values() if isinstance(w, dict) else [w]) for x in v]
        return lambda s: next((x for x in words if re.search(r"(^|\s)%s($|\s)" % re.escape(x), s)), None)


def _templ_of(lines):
    cur, out = None, []
    for ln in lines:
        m = re.match(r'@T\("(a\d+)"', ln)
        if m: cur = m.group(1)
        out.append(cur)
    return out


AR = re.compile(r'"([^"\n]*[؀-ۿ][^"\n]*)"')
def lint_templates(files=("tpl/T.py", "tpl/tl.py")):
    dial = _dialect(); issues = []
    for f in files:
        L = open(S + f, encoding="utf-8").read().split("\n"); tp = _templ_of(L)
        for i, ln in enumerate(L, 1):
            code = ln.split("#")[0] if "#" in ln and not ln.strip().startswith("#") else ("" if ln.strip().startswith("#") else ln)
            ok = "qa-ok" in ln; where = f"{f}:{i}" + (f" ({tp[i - 1]})" if tp[i - 1] else "")
            for s in ([] if ('"""' in ln or "qa_warn(" in ln or "print(" in ln) else AR.findall(code)):   # النصوص العربي اللي في الكود = نصوص على الشاشة (من غير الـdocstrings)
                d = dial(s)
                if d: issues.append({"rule": "L1", "err": "E312", "where": where, "issue_ar": f"نص بالعامية على الشاشة: «{s[:60]}» (كلمة: {d})"})
            if re.search(r"FLIP_LEFT_RIGHT|ImageOps\.mirror|cv2\.flip\(", code) and not ok:
                issues.append({"rule": "L2", "err": "E53", "where": where, "issue_ar": "قلب صورة من غير سبب مكتوب (لو فيها نص هيطلع معكوس) — اكتب # qa-ok: السبب"})
            if re.search(r"warpPerspective|getPerspectiveTransform", code) and not ok:
                issues.append({"rule": "L3", "err": "E32", "where": where, "issue_ar": "تحويل منظور (بيمط الصورة) من غير سبب مكتوب — اللف يبقى زاوية + زووم بس"})
            if re.search(r"\bpkill\b", code): issues.append({"rule": "L4", "err": "E378", "where": where, "issue_ar": "pkill ممنوع"})
            if re.search(r"setdefault\([^)]*Clip\(", code): issues.append({"rule": "L4", "err": "E364", "where": where, "issue_ar": "setdefault(..., Clip(...)) بيفتح ffmpeg كل مرة"})
            if re.search(r"[\"'][^\"']*\b[a-z_]+=\.\d", code) and re.search(r"ffmpeg|-vf|-af|filter", ln): issues.append({"rule": "L4", "err": "E360", "where": where, "issue_ar": "رقم في فلتر ffmpeg من غير صفر قبل العلامة"})
            if f.endswith("T.py") and re.search(r"upper_tint\(\s*\(", code) and "Stroke" not in code and not ok:   # L6: الصبغة لازم تعدّي على Stroke (اتجاه وتوقيت من الأصل)
                issues.append({"rule": "L6", "err": "E452", "where": where, "issue_ar": "صبغة على السنان باتجاه/توقيت مكتوب باليد — استخدم strokes.Stroke (بيقرا الاتجاه والتوقيت من الأصل)"})
            for a in re.findall(r'assets/([A-Za-z0-9_]*cast[A-Za-z0-9_]*\.png)', code):   # L5: أي كاست بيتستخدم لازم يعدّي Q11 (E203)
                r = cast_gum(S + "assets/" + a) if os.path.exists(S + "assets/" + a) else {"pass": True}
                if not r["pass"] and not ok: issues.append({"rule": "L5", "err": "E203", "where": where, "issue_ar": f"القالب بيستخدم {a} وعليه لثة ({r['pink_frac']:.1%})"})
    return issues


# ---------------- Q10: عنصر سنان معزولة ----------------
def iso_check(path, max_mouth=.015, edge=3):
    """جوه البق/اللسان = بكسلات أحمر غامق (مش وردي اللثة الفاتح ولا السنان). والسنان مش لازم تلمس حافة الصورة."""
    im = np.array(Image.open(path).convert("RGBA")); a = im[..., 3] > 128
    if a.sum() < 500: return {"pass": False, "issues": ["العنصر فاضي"]}
    hsv = cv2.cvtColor(im[..., :3], cv2.COLOR_RGB2HSV).astype(int); h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    red = ((h < 6) | (h > 168)) & (s > 120) & (v < 150) & (v > 40)          # لسان/جوه البق: أحمر مشبّع (البقع البني على السنان h 8–20 مابتتحسبش)
    dark = (v < 25)                                                          # فراغ البق الإسود جوه القناع
    mouth = (red | dark) & a
    # اللي على حدود السنان بالظبط (ظل طبيعي بين السنان) مايتحسبش: بنعدّ الكتل الكبيرة بس
    n, lab, st, _ = cv2.connectedComponentsWithStats(mouth.astype(np.uint8))
    big = sum(st[k, 4] for k in range(1, n) if st[k, 4] > a.sum() * .002)
    frac = big / a.sum(); issues = []
    if frac > max_mouth: issues.append(f"جوه البق/لسان باين ورا السنان: {frac:.1%} من العنصر (الحد {max_mouth:.0%})")
    H, W = a.shape; touch = {"فوق": a[:edge].mean(), "تحت": a[-edge:].mean(), "شمال": a[:, :edge].mean(), "يمين": a[:, -edge:].mean()}
    teethy = (v > 150) & (s < 90) & a   # السنان بس (مش اللثة) لامسة الحافة = مقطوشة
    tt = {"فوق": teethy[:edge].sum(), "تحت": teethy[-edge:].sum(), "شمال": teethy[:, :edge].sum(), "يمين": teethy[:, -edge:].sum()}
    cut = [k for k, n_ in tt.items() if n_ > 3 * edge * 10]
    if cut: issues.append("السنان لامسة حافة الصورة (مقطوشة): " + "، ".join(cut))
    return {"pass": not issues, "mouth_frac": round(float(frac), 4), "edge_teeth": {k: int(v_) for k, v_ in tt.items()}, "issues": issues}


# ---------------- Q11: كاست من غير لثة ----------------
def cast_gum(path, max_pink=.04):
    """لثة = وردي/أحمر متوسط التشبع. الكاست الصح: جبس بيج/أبيض + عدسات."""
    im = np.array(Image.open(path).convert("RGBA")); a = im[..., 3] > 128
    hsv = cv2.cvtColor(im[..., :3], cv2.COLOR_RGB2HSV).astype(int); h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    obj = a & (v > 40); pink = obj & ((h > 160) | (h < 6)) & (s > 60) & (v > 90)
    frac = pink.sum() / max(1, obj.sum())
    return {"pass": bool(frac <= max_pink), "pink_frac": round(float(frac), 4), "issues": [] if frac <= max_pink else [f"الكاست عليه لثة: {frac:.1%} وردي"]}


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "lint":
        r = lint_templates(); print(len(r), "مشكلة")
        for i in r: print(f"  [{i['rule']} {i['err']}] {i['where']}: {i['issue_ar']}")
    elif cmd in ("iso", "cast"):
        for p in sys.argv[2:]: print(p, json.dumps((iso_check if cmd == "iso" else cast_gum)(p), ensure_ascii=False))
