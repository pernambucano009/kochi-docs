"""خريطة احتياجات القوالب: كل قالب محتاج إيه من الصور الحقيقية والعناصر — بتتطلع أوتوماتيك من كود القوالب نفسه
(بتتبع كل دالة مساعدة بيستعملها القالب لحد آخرها)، فلو قالب اتعدل الخريطة بتتحدث لوحدها.

الاستخدام:
  python3 needs.py                ← احتياجات كل قالب
  python3 needs.py <case>         ← جاهزية كل قالب للحالة دي: جاهز / ناقصه إيه بالظبط"""
import ast, os, re, sys, json
S = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/")
sys.path.insert(0, S + "product")
from case import Case, SLOTS, APPROVED, QA_PASS

SRC = [S + "tpl/tl.py", S + "ana/anim.py", S + "tpl/T.py"]
RES = re.compile(r"[\w/]+\.(png|jpg|jpeg|webp|json|npy|mp4)$")
CANON = {rel: slot for slot, (rel, _, _) in SLOTS.items()}
CANON["after/smile_front.jpg"] = "after_smile"
# ملفات العناصر ← اسم العنصر في مصنع العناصر (elements.py)
EL_OF = [(r"after_portrait_v3\.png", "after_portrait_v3.png"), (r"after_portrait_(hands|pose_m)\.png", "pose"),
         (r"after_view_", "after_views"), (r"(before|after)_teeth_(upper|lower|both)\.png", "teeth_only"),
         (r"smile_(open|lips)\.png", "ms/smile_masks"), (r"profile_right\.png", "profile_right.png"),
         (r"angle_closed_0\.png", "angle_closed_0.png"), (r"before_face_hi\.png", "before_face_hi.png"),
         (r"beach\.png", "beach.png"), (r"selfie_img\.png", "selfie_img.png"), (r"mirror_img\.png", "mirror_img.png"),
         (r"doctor_img\.png", "doctor_img.png")]
PORT = []   # كل الأدوات اتنقلت لأي حالة
EL_OF += [(r"retract_|rcrop_teeth", "retract"), (r"ap_teeth_|smile_to_ap", "ap_teeth"), (r"selfie_real\.png", "selfie_real.png"), (r"twin_mouths\.png", "twin_mouths.png"), (r"gum_back_", "gum_back_after.png")]
ANA = {"ai_before.png": "before_retracted", "ai_after.png": "after_retracted", "ai_smile.png": "after_smile",
       "lab_before.json": "before_retracted", "lab_after.json": "after_retracted", "lab_smile.json": "after_smile"}


def _scan():
    """كل دالة/متغير عام ← (الملفات اللي بيشاور عليها، الأسماء اللي بيستعملها، أسماء الفيديوهات)"""
    defs, templates = {}, {}
    for f in SRC:
        tree = ast.parse(open(f).read())
        for node in tree.body:
            names, files, clips = set(), set(), set()
            for n in ast.walk(node):
                if isinstance(n, ast.Name): names.add(n.id)
                elif isinstance(n, ast.Constant) and isinstance(n.value, str) and RES.search(n.value): files.add(n.value)
                elif isinstance(n, ast.JoinedStr):
                    v = "".join(x.value if isinstance(x, ast.Constant) else "*" for x in n.values)
                    if RES.search(v): files.add(v)
                elif isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id in ("vclip", "asset_clip"):
                    clips |= {a.value for a in n.args if isinstance(a, ast.Constant)}
            info = (files, names, clips)
            if isinstance(node, (ast.FunctionDef, ast.ClassDef)):
                defs[node.name] = info
                for d in getattr(node, "decorator_list", []):
                    if isinstance(d, ast.Call) and getattr(d.func, "id", "") == "T" and d.args and isinstance(d.args[0], ast.Constant):
                        templates[d.args[0].value] = info   # آخر تعريف هو اللي شغال
            elif isinstance(node, (ast.Assign, ast.AnnAssign)):
                for t in (node.targets if isinstance(node, ast.Assign) else [node.target]):
                    if isinstance(t, ast.Name): defs[t.id] = info
    return defs, templates


def _closure(info, defs):
    files, clips, seen, todo = set(info[0]), set(info[2]), set(), list(info[1])
    while todo:
        n = todo.pop()
        if n in seen or n not in defs: continue
        seen.add(n); f, ns, cl = defs[n]; files |= f; clips |= cl; todo += list(ns)
    return files, clips


def _clip_el(name):
    sys.path.insert(0, S + "tpl")
    import importlib
    src = open(S + "tpl/T.py").read()
    lm = eval(re.search(r"LIVE_MAP = (\{.*?\})", src, re.S).group(1)); cv = eval(re.search(r"CASE_V = (\{.*?\})", src, re.S).group(1))
    m = cv.get(name) or lm.get(name)
    return ("v/" + m + ".mp4") if m else None


def needs_all():
    defs, templates = _scan(); src = open(S + "tpl/T.py").read()
    cancelled = eval(re.search(r"CANCELLED = (\{.*?\})", src).group(1))
    out = {}
    for name in sorted(templates):
        if name in cancelled: continue
        files, clips = _closure(templates[name], defs)
        slots, els, port = set(), set(), set()
        for f in files:
            base = f.split("/")[-1]
            for rel, slot in CANON.items():
                if f.endswith(rel): slots.add(slot)
            if base in ANA: slots.add(ANA[base])
            for pat, el in EL_OF:
                if re.search(pat, base): els.add(el)
            for pat, why in PORT:
                if re.search(pat, base): port.add(why)
        for cl in clips:
            e = _clip_el(cl)
            if e: els.add(e)
        if "city" in str(files) or "CITY" in str(templates[name][1]): els.add("city")
        out[name] = {"slots": sorted(slots), "elements": sorted(els), "pending_port": sorted(port)}
    return out


def readiness(case_dir):
    c = Case(case_dir); rep = {}
    for name, n in needs_all().items():
        miss = [f"صورة حقيقية: {SLOTS[s][1]}" for s in n["slots"] if not c.has(s)]
        miss += [f"عنصر: {e} ({c.el(e)['status']})" for e in n["elements"] if e != "city" and not c.approved(e)]
        if "city" in n["elements"] and not c.m["settings"].get("city"): miss.append("إعداد: مدينة العيادة")
        miss += [f"أداة لسه متنقلتش: {p}" for p in n["pending_port"]]
        rep[name] = {"ready": not miss, "missing": miss}
    return rep


if __name__ == "__main__":
    if len(sys.argv) > 1:
        r = readiness(sys.argv[1]); ok = [k for k, v in r.items() if v["ready"]]
        print(f"جاهز ({len(ok)}): {' '.join(ok)}")
        for k, v in r.items():
            if not v["ready"]: print(f"{k}: " + " | ".join(v["missing"]))
    else:
        for k, v in needs_all().items(): print(k, json.dumps(v, ensure_ascii=False))
