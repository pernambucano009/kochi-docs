"""فولدر الحالة → تصنيف كل صورة + مطابقة القبل والبعد بنفس الزاوية + القوالب اللي تنفع.

1) التصنيف (طلب واحد لموديل رؤية لكل الصور مع بعض، صور مصغّرة): المرحلة (قبل/تحضير/بعد)، النوع
   (ابتسامة/مبعّد/ماكرو/وش/إطباق)، الاتجاه (قدام/يمين/شمال).
2) قياس الزاوية بالأرقام من الصورة نفسها: ميل الكاميرا يمين/شمال = عدم تماثل السنان حوالين نص البق
   (في صورة قدام النصين متساويين؛ لما الكاميرا تلف ناحية بتكبر الناحية التانية). صورتين نفس النوع والاتجاه
   ولازم كمان الفرق في الرقم ده يبقى صغير ← «نفس الزاوية».
3) القوالب: كل قالب محتاج إيه، ونشوف الفولدر فيه إيه.

الاستخدام: python3 case_scan.py <فولدر> [--no-ai labels.json]
"""
import os, sys, json, glob, base64, io, math, cv2, numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); S = os.path.dirname(HERE) + "/"
sys.path.insert(0, HERE); sys.path.insert(0, S + "xpl"); sys.path.insert(0, S + "gen")
import lib, mouth

EXT = (".jpg", ".jpeg", ".png", ".webp", ".heic")
PROMPT = """You are sorting the photos of ONE dental case (same patient). For each numbered photo return:
- stage: "before" (original teeth, untreated), "prep" (teeth prepared/trimmed for veneers or crowns, temporary or stumps, retraction cord), "after" (final result: veneers/crowns/whitening done), or "unknown"
- kind: "smile" (lips visible, natural smile close-up), "retracted" (cheek retractor or lips pulled, gums visible), "macro" (very close-up of 2-4 teeth), "face" (whole face visible), "occlusal" (photo of the biting surfaces / mirror view), "other"
- view: "front" (camera straight in front of the midline), "right" (camera on the patient's RIGHT side = we see more of the patient's right teeth, shown on the IMAGE LEFT), "left" (camera on the patient's left side)
- mouth: what the mouth shows: "smile" (natural smile, lips around teeth), "retracted" (retractor / gums exposed), "closed", "other" — also for face photos
- yaw: camera horizontal angle in degrees, -45..45 (0 = straight front; positive = camera moved toward the patient's LEFT side)
- rotated: true if the photo is rotated 90 degrees or upside-down
Judge stage by the teeth themselves (stains, chips, gaps, uneven shapes = before; uniform, smooth, bright restorations = after; trimmed stumps = prep).
Then compare the photos with EACH OTHER: put photos that were taken from the same camera angle and the same framing type
(e.g. a before and an after retracted front view; a before smile and an after smile from the same side) in the same group.
A before/after pair belongs together only if a viewer would see them as the same shot of the mouth before and after.
Return JSON: {"photos": [{"i": 1, "stage": "...", "kind": "...", "mouth": "...", "view": "...", "yaw": 0, "rotated": false}, ...],
              "same_angle_groups": [[1, 4], [2, 5, 7], ...]}"""


def thumbs(paths, side=640):
    out = []
    for p in paths:
        im = Image.fromarray(lib.load(p)); im.thumbnail((side, side)); b = io.BytesIO(); im.save(b, "JPEG", quality=85)
        out.append(base64.b64encode(b.getvalue()).decode())
    return out


def classify(paths):
    from explainer import chat
    parts = [{"type": "text", "text": PROMPT}]
    for i, t in enumerate(thumbs(paths), 1):
        parts += [{"type": "text", "text": f"Photo {i}:"}, {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + t}}]
    r = chat(parts, model="google/gemini-2.5-pro", mt=4000)
    r = r if isinstance(r, dict) else json.loads(r[r.find("{"):r.rfind("}") + 1])
    by = {int(x["i"]): x for x in r.get("photos", [])}
    grp = {}
    for g, mem in enumerate(r.get("same_angle_groups", [])):
        for i in mem: grp[int(i)] = g
    return [dict(by.get(i + 1, {"stage": "unknown", "kind": "other", "view": "front"}), group=grp.get(i + 1)) for i in range(len(paths))]


def yaw_index(path, kind):
    """عدم التماثل يمين/شمال (−1..1): (مساحة السنان يمين نص البق − شمال) / المجموع. قدام ≈ 0."""
    try:
        if kind == "smile":
            R = mouth.analyze(path); a = R["img"]; l, r = R["l"], R["r"]; mk = lib.teeth_mask(a) & R["mask"]
        else:
            a = lib.load(path); mk = lib.teeth_mask(a)
            lab = cv2.cvtColor(a, cv2.COLOR_RGB2LAB); pink = (lab[..., 1] > 138) & (lab[..., 0] > 50)
            ys, xs = np.where(mk); near = cv2.dilate(mk.astype(np.uint8), np.ones((41, 41), np.uint8)) > 0
            uy, ux = np.where(mk | (pink & near)); l = np.array([np.percentile(ux, 1), 0]); r = np.array([np.percentile(ux, 99), 0])
        ys, xs = np.where(mk); mid = (l[0] + r[0]) / 2
        wl, wr = (xs < mid).sum(), (xs >= mid).sum()
        return round(float((wr - wl) / max(wl + wr, 1)), 3)
    except Exception as e:
        return None


# القالب ← محتاج إيه (المرحلة، النوع، الاتجاه)
NEEDS = {
    "p01": ("قبل وبعد: الابتسامة", [("before", "smile", "front"), ("after", "smile", "front")]),
    "p02": ("قبل وبعد: بالمبعّد", [("before", "retracted", "front"), ("after", "retracted", "front")]),
    "p03": ("قبل وبعد: من الجنب", [("before", "*", "side"), ("after", "*", "side")]),
    "p04": ("المرآة الطولية", [("before", "retracted", "*"), ("after", "retracted", "*")]),
    "p05": ("الماكرو بالتوقيع", [("after", "retracted|macro", "front")]),
    "p06": ("المراحل الثلاث: شرائط", [("before", "retracted", "*"), ("prep", "retracted", "*"), ("after", "retracted", "*")]),
    "p07": ("المراحل الثلاث: صفوف", [("before", "retracted", "*"), ("prep", "retracted", "*"), ("after", "retracted", "*")]),
    "p08": ("الأسنان على الأسود", [("after", "retracted", "front")]),
    "p09": ("قبل وبعد على الأسود", [("before", "retracted", "front"), ("after", "retracted", "front")]),
}
YAW_TOL = 10    # أقصى فرق (درجات) في زاوية الكاميرا بين صورتين «نفس الزاوية»


def ok(ph, stage, kind, view):
    if ph["stage"] != stage: return False
    if kind != "*" and ph["kind"] not in kind.split("|"): return False
    if view == "side": return ph["view"] in ("right", "left")
    return view == "*" or ph["view"] == view


def plan(photos):
    res = {}
    for tid, (name, need) in NEEDS.items():
        if len(need) == 1:
            c = [p for p in photos if ok(p, *need[0])]
            res[tid] = dict(name=name, ok=bool(c), photos={need[0][0]: c[0]["file"]} if c else None,
                            why=None if c else "ناقص صورة " + {"after": "بعد"}[need[0][0]] + " بالمبعّد من قدام")
            continue
        best = None
        for b in [p for p in photos if ok(p, *need[0])]:
            for a in [p for p in photos if ok(p, *need[-1]) and p["kind"] == b["kind"] and p["view"] == b["view"]]:
                mids = [[p for p in photos if ok(p, *n) and p["kind"] == b["kind"] and p["view"] == b["view"]] for n in need[1:-1]]
                if any(not m for m in mids): continue
                trio = [b] + [m[0] for m in mids] + [a]
                # نفس الزاوية = الموديل حطهم في نفس المجموعة، وزاوية الكاميرا المقدّرة قريبة (≤ 10°)
                same = len({p["group"] for p in trio}) == 1 and trio[0]["group"] is not None
                # صورة وش كاملة قصاد صورة بق قريبة: الموديل بيعتبرهم «تصويرة مختلفة»، بس إحنا بنقص البق من الوش ← تكفي الزاوية
                same = same or any(p.get("from_face") for p in trio)
                ys = [p["yaw_ai"] for p in trio if isinstance(p.get("yaw_ai"), (int, float))]
                d = (max(ys) - min(ys)) if len(ys) == len(trio) else 0
                d = d if same else max(d, 99)
                if best is None or d < best[0]: best = (d, trio)
        if best is None:
            res[tid] = dict(name=name, ok=False, photos=None, why="مفيش صور للمراحل المطلوبة بنفس النوع والاتجاه")
        elif best[0] > YAW_TOL:
            res[tid] = dict(name=name, ok=False, photos={p["stage"]: p["file"] for p in best[1]},
                            why="الصور موجودة بس زاوية الكاميرا مختلفة" + (f" (فرق حوالي {best[0]:.0f}°)" if best[0] < 99 else ""))
        else:
            res[tid] = dict(name=name, ok=True, photos={p["stage"]: p["file"] for p in best[1]}, why=None, angle_diff=round(best[0], 3))
    return res


def scan(folder, labels=None):
    paths = sorted(p for p in glob.glob(folder.rstrip("/") + "/*") if p.lower().endswith(EXT))
    if not paths: raise lib.PhotoError("EMPTY_CASE: الفولدر فاضي")
    L = json.load(open(labels)) if labels else classify(paths)
    photos = []
    for p, c in zip(paths, L):
        kind = c.get("kind", "other")
        if kind == "face" and c.get("mouth") in ("smile", "retracted"): kind = c["mouth"]   # صورة وش: بنقص البق منها (القالب بيرفض لو طلع صغير قوي)
        ph = dict(file=os.path.basename(p), stage=c.get("stage", "unknown"), kind=kind, view=c.get("view", "front"), rotated=bool(c.get("rotated")),
                  yaw_ai=c.get("yaw"), group=c.get("group"), from_face=c.get("kind") == "face")
        ph["yaw"] = None   # القياس بالأرقام (yaw_index) طلع مش ثابت مع اختلاف لون السنان قبل/بعد — الاعتماد على مقارنة الموديل
        photos.append(ph)
    pl = plan(photos)
    out = dict(folder=folder, photos=photos, templates=pl, usable=[t for t, v in pl.items() if v["ok"]])
    json.dump(out, open(folder.rstrip("/") + "/scan.json", "w"), ensure_ascii=False, indent=1)
    return out


def report(o):
    st = {"before": "قبل", "prep": "تحضير", "after": "بعد", "unknown": "؟"}
    kd = {"smile": "ابتسامة", "retracted": "مبعّد", "macro": "ماكرو", "face": "وش", "occlusal": "إطباق", "other": "تانية"}
    vw = {"front": "قدام", "right": "يمين", "left": "شمال"}
    lines = ["الصور:"] + [f"  {p['file']}: {st.get(p['stage'], p['stage'])} · {kd.get(p['kind'], p['kind'])} · {vw.get(p['view'], p['view'])}"
                         + (f" · زاوية {p['yaw_ai']:+}°" if isinstance(p.get('yaw_ai'), (int, float)) else "") + (f" · مجموعة {p['group']}" if p.get('group') is not None else "") + (" · من صورة وش" if p.get('from_face') else "") for p in o["photos"]]
    lines += [f"القوالب اللي تنفع ({len(o['usable'])} من {len(o['templates'])}):"]
    for t, v in o["templates"].items():
        lines.append(f"  {'✓' if v['ok'] else '✗'} {t} {v['name']}" + ("" if v["ok"] else f" — {v['why']}"))
    return "\n".join(lines)


def render(o, brand, out_dir):
    """كل القوالب اللي تنفع ← صور جاهزة. قالب يفشل (صورة صغيرة/مقصوصة قريب) بيترفع من القايمة بسببه."""
    import templates
    os.makedirs(out_dir, exist_ok=True); done = {}
    for tid in o["usable"]:
        v = o["templates"][tid]; ph = {k: os.path.join(o["folder"], f) for k, f in v["photos"].items()}
        try: done[tid] = templates.make(tid, brand, os.path.join(out_dir, tid + ".jpg"), **ph)[0]
        except lib.PhotoError as e: v.update(ok=False, why=str(e).split(": ", 1)[-1]); o["usable"] = [t for t in o["usable"] if t != tid]
    return done


def labels_json(inp, out):
    """للمنصة: [{"id", "path"}] ← [{"id", stage, kind, view, yaw, group, from_face, rotated}] (طلب واحد للحالة كلها)."""
    items = json.load(open(inp)); paths = [x["path"] for x in items]
    L = classify(paths) if paths else []
    res = []
    for x, c in zip(items, L):
        kind = c.get("kind", "other")
        if kind == "face" and c.get("mouth") in ("smile", "retracted"): kind = c["mouth"]
        res.append(dict(id=x["id"], stage=c.get("stage", "unknown"), kind=kind, view=c.get("view", "front"), yaw=c.get("yaw"),
                        group=c.get("group"), from_face=c.get("kind") == "face", rotated=bool(c.get("rotated"))))
    json.dump(res, open(out, "w"), ensure_ascii=False)


if __name__ == "__main__":
    if sys.argv[1] == "--labels":
        labels_json(sys.argv[2], sys.argv[3]); sys.exit(0)
    lab = sys.argv[sys.argv.index("--no-ai") + 1] if "--no-ai" in sys.argv else None
    o = scan(sys.argv[1], lab)
    if "--render" in sys.argv:
        i = sys.argv.index("--render"); out = render(o, json.load(open(sys.argv[i + 1])), sys.argv[i + 2])
        json.dump(o, open(sys.argv[1].rstrip("/") + "/scan.json", "w"), ensure_ascii=False, indent=1)
    print(report(o))
