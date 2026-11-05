"""المشغّل: من صور الطبيب لحد الفيديوهات اللي عدّت الفلتر — لأي حالة.

  python3 run.py new <فولدر الصور> <فولدر الحالة>   1) تصنيف الصور وحطها في أماكنها  2) تحليل السنان  3) تقرير الناقص
  python3 run.py elements <case> [aXX ...]          يعمل العناصر الناقصة اللي القوالب دي محتاجاها (أو كل القوالب) ويعدّيها على الفلتر
  python3 run.py approve <case> <عنصر> | reject <case> <عنصر> "سبب"   موافقة/رفض العميل
  python3 run.py status <case>                       الصور + العناصر + جاهزية كل قالب
  python3 run.py render <case> [aXX ...]             يعمل القوالب الجاهزة بس، وكل فيديو يعدّي على فلتر الفيديو (مقارنة بالأصل)
  python3 run.py all <فولدر الصور> <case>            new + elements (ومن غير موافقة العميل مافيش render)

الترتيب ثابت: صور حقيقية ← تحليل ← عناصر (فلتر + موافقة العميل) ← قوالب ← فلتر الفيديو ← تسليم."""
import sys, os, json, subprocess
S = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/")
sys.path.insert(0, S + "product")
from case import Case, SLOTS, APPROVED, QA_PASS


def cmd_new(src, d):
    from intake import intake
    from analysis import run as analyze
    c = intake(src, d); print(c.summary()); print("تحليل السنان:", analyze(d)); return c


def cmd_elements(d, tpls=None):
    from needs import needs_all
    from elements import make_parallel as make, RECIPES
    c = Case(d); want = set()
    for name, n in needs_all().items():
        if not tpls or name in tpls: want |= set(n["elements"])
    if "city" in want:
        want.discard("city")
        if c.m["settings"].get("city"):
            from city_assets import make as city
            city(c.m["settings"]["city"])
    # الاعتماديات: أي عنصر محتاج عنصر تاني لازم يتعمل الأول
    todo, changed = set(want), True
    while changed:
        changed = False
        for n in list(todo):
            for dep in RECIPES.get(n, ([],))[0]:
                if not dep.startswith("slot:") and dep not in todo: todo.add(dep); changed = True
    order = [n for n in RECIPES if n in todo]   # ترتيب الوصفات = ترتيب الاعتماديات
    print("هيتعمل:", order); rep = make(c, order); print(json.dumps(rep, ensure_ascii=False, indent=1)); return rep


def cmd_status(d):
    from needs import readiness
    c = Case(d); print(c.summary()); r = readiness(d)
    ok = [k for k, v in r.items() if v["ready"]]; print(f"\nقوالب جاهزة ({len(ok)}): {' '.join(ok)}")
    for k, v in r.items():
        if not v["ready"]: print(f"  {k}: " + " | ".join(v["missing"]))
    return r


def cmd_render(d, tpls=None):
    from needs import readiness
    from qa_video import check
    c = Case(d); r = readiness(d); out = {}
    for name in (tpls or sorted(r)):
        if not r.get(name, {}).get("ready"): out[name] = {"skipped": r.get(name, {}).get("missing", ["مش موجود"])}; continue
        env = c.env(); log = f"{c.d}/out/R_{name}.log"
        with open(log, "w") as f: p = subprocess.run(["python3", "T.py", name], cwd=S + "tpl", env=env, stdout=f, stderr=subprocess.STDOUT, timeout=3600)
        vid = f"{c.d}/out/{name}.mp4"
        if not os.path.exists(vid): out[name] = {"error": "الريندر فشل", "log": log}; continue
        q = check(vid, name, out_dir=c.d + "/qa"); out[name] = {"passed": q["passed"], "score": q["score"], "issues": len(q["issues"])}
        c.m.setdefault("videos", {})[name] = out[name]; c.save()
    print(json.dumps(out, ensure_ascii=False, indent=1)); return out


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a: print(__doc__); sys.exit()
    if a[0] == "new": cmd_new(a[1], a[2])
    elif a[0] == "elements": cmd_elements(a[1], a[2:] or None)
    elif a[0] in ("approve", "reject"):
        from case import REJECTED
        c = Case(a[1]); c.set_el(a[2], status=APPROVED if a[0] == "approve" else REJECTED, note=a[3] if len(a) > 3 else ""); print(a[0], a[2])
    elif a[0] == "status": cmd_status(a[1])
    elif a[0] == "render": cmd_render(a[1], a[2:] or None)
    elif a[0] == "all": cmd_new(a[1], a[2]); cmd_elements(a[2]); cmd_status(a[2])
