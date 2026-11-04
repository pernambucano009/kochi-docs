"""استقبال الحالة: كل صورة في فولدر الطبيب بتتصنف لوحدها (قبل/بعد، بمبعد/ابتسامة/وش، أمامي/جانبي، بريب، عدسات، كاست)،
وبتتعدل لو مقلوبة، وبتتحط في مكانها الثابت في canon/. وكمان بيتحدد نوع المريض (راجل/ست) عشان وضعية الصور.
الاستخدام: python3 intake.py <فولدر الصور> <فولدر الحالة>"""
import sys, os, io, json, base64, shutil
S = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/")
sys.path.insert(0, S + "xpl"); sys.path.insert(0, S + "product")
from PIL import Image, ImageOps
from case import Case, SLOTS

EN = {  # وصف إنجليزي لكل خانة للموديل
    "before_face": "full face portrait BEFORE treatment, smiling, NO lip retractor",
    "before_retracted": "intraoral frontal photo BEFORE treatment WITH lip retractor (teeth + gums, old/stained/damaged teeth)",
    "after_retracted": "intraoral frontal photo AFTER treatment WITH lip retractor (new white veneers/crowns, gums)",
    "after_retracted_close": "closer intraoral frontal AFTER photo with retractor (a second, tighter frontal framing)",
    "after_retracted_side1": "lateral (angled) intraoral AFTER photo with retractor, WIDER framing (more of the retractor visible). If only one lateral retracted photo exists, use this key",
    "after_retracted_side2": "a SECOND lateral intraoral AFTER photo with retractor: a CLOSER framing than side1 or the opposite side",
    "after_smile": "close-up of the smile AFTER treatment, lips visible, NO retractor, frontal",
    "after_smile_side_r": "close-up angled smile AFTER treatment, no retractor, where the front (central) teeth are in the RIGHT half of the image and the back teeth recede to the LEFT",
    "after_smile_side_l": "close-up angled smile AFTER treatment, no retractor, where the front (central) teeth are in the LEFT half of the image and the back teeth recede to the RIGHT",
    "after_face": "full face portrait AFTER treatment, smiling, NO retractor",
    "before_face_retracted": "full face BEFORE treatment wearing a lip retractor",
    "after_face_retracted": "full face AFTER treatment wearing a lip retractor",
    "prep": "prepared (shaved/reduced) teeth during treatment",
    "veneers": "veneers/crowns alone (not in the mouth)",
    "cast": "restorations on a dental stone cast/model",
    "doctor": "photo of the dentist (not the patient)",
}
VIEWS = {"face_smile": "full face (or head and shoulders) smiling, NO retractor",
         "face_retracted": "full face wearing a lip/cheek retractor",
         "retracted_front": "intraoral photo with retractor, FRONTAL view (teeth + gums)",
         "retracted_lateral": "intraoral photo with retractor, LATERAL/angled view",
         "smile_front": "close-up of the lips + teeth smiling, no retractor, frontal",
         "smile_lateral": "close-up of the lips + teeth smiling, no retractor, angled/side",
         "prep": "prepared (reduced) teeth during treatment", "veneers": "veneers/crowns alone outside the mouth",
         "cast": "restorations on a dental stone model", "doctor": "photo of the dentist", "other": "anything else"}
P1 = """This sheet shows the SAME dental case photo four times, rotated differently, in tiles labeled A, B, C, D.
Pick the tile where the photo is correctly UPRIGHT: as a person would see it face to face — forehead/nose/mustache ABOVE the mouth,
UPPER teeth (and upper gum) on TOP with their biting edges pointing DOWN, lower teeth at the bottom. For a stone model or veneers, natural upright display.
Answer ONLY JSON:
{{"upright": "A"|"B"|"C"|"D",
 "view": one of {views},
 "mirrored": true only if it is an intraoral MIRROR photo that must be flipped,
 "gender": "male"/"female"/"unknown",
 "quality": 1-10}}
Views: {desc}"""
ROT = {"A": 0, "B": 90, "C": 180, "D": 270}   # لف مع عقارب الساعة

def _grid(im, t=420):
    from PIL import ImageDraw
    g = Image.new("RGB", (2 * t, 2 * t + 60), (255, 255, 255))
    for i, (k, a) in enumerate(ROT.items()):
        x = im.rotate(-a, expand=True); x.thumbnail((t - 10, t - 30)); ox, oy = (i % 2) * t, (i // 2) * (t + 30)
        g.paste(x, (ox + (t - x.width) // 2, oy + 30)); ImageDraw.Draw(g).text((ox + 8, oy + 6), k, fill=(220, 0, 0))
    return g

P2 = """These are all the photos of ONE dental patient's case (already rotated upright). Each image is labeled with its number and view.
Decide for each image whether it shows the teeth BEFORE treatment (old, stained, worn, damaged, gaps, original teeth) or AFTER treatment (new uniform white veneers/crowns).
Compare the photos with each other: the same teeth appear in several photos; before and after look clearly different.
Then assign the best image to each slot (each image at most once; skip a slot if no image fits). For intraoral/smile slots prefer LANDSCAPE (wider than tall) framings over vertical ones; the image size is given in each label:
{slots}
Answer ONLY JSON: {{"phase": {{"1": "before"|"after"|"during", ...}}, "assign": {{"slot_key": image_number, ...}}, "not_upright": [image numbers still not upright], "why": "short"}}"""

def _b64(im, mx=900):
    im = im.copy(); im.thumbnail((mx, mx)); b = io.BytesIO(); im.save(b, "JPEG", quality=85); return base64.b64encode(b.getvalue()).decode()

def _json(r):
    t = r if isinstance(r, str) else json.dumps(r); return json.loads(t[t.find("{"):t.rfind("}") + 1])

TIE = """Two versions of the same dental photo: LEFT and RIGHT (one is rotated 180° or 90° vs the other).
Which one is correctly upright? Clues: facial hair / mustache / nose / philtrum must be ABOVE the mouth; chin hair BELOW;
upper central incisors are the BIGGEST teeth and sit on TOP; lower incisors are small and narrow at the bottom; the upper gum line curves like a smile arch.
Answer ONLY JSON: {"upright": "LEFT"|"RIGHT", "why": "short"}"""

def _vote(im, q):   # النوع/الجودة/النوع (راجل/ست) + اختيار الاتجاه من 4
    from explainer import chat
    r = _json(chat([{"type": "text", "text": q}, {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + _b64(_grid(im), 900)}}], model="google/gemini-2.5-pro", mt=4000))
    r["rotate"] = ROT.get(str(r.get("upright", "A")).strip().upper()[:1], 0); return r

ORIENT = """Describe this photo EXACTLY as it is displayed (do not mentally rotate it). Directions are relative to the image frame: "up" = toward the top edge of the image.
1. "hair": where is facial hair / mustache / nose / nostrils relative to the mouth: up, down, left, right, or none (if not visible)?
2. "chin": where is the chin / lower face relative to the mouth: up, down, left, right, or none?
3. "teeth_edges": the biting edges of the two biggest front teeth point toward which image edge: up, down, left, right?
Answer ONLY JSON: {"hair": "...", "chin": "...", "teeth_edges": "..."}"""
TO_UP = {"up": 0, "left": 90, "down": 180, "right": 270}      # لف مع عقارب الساعة علشان الاتجاه ده يبقى فوق
TO_DOWN = {"down": 0, "right": 90, "up": 180, "left": 270}    # ... علشان الاتجاه ده يبقى تحت

def view_of(path, votes=3):
    """الاتجاه: أوضح علامة هي مكان الشنب/المناخير بالنسبة للبق (الموديل بيلاحظه صح حتى لو الصورة مقلوبة)،
    وبعدها مكان الدقن، وبعدها اتجاه حواف السنان. ولو مفيش أي علامة: تصويت على 4 اتجاهات."""
    import concurrent.futures as cf
    from collections import Counter
    from explainer import chat
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    q = P1.format(views=list(VIEWS), desc="; ".join(f"{k} = {v}" for k, v in VIEWS.items()))
    oq = lambda: _json(chat([{"type": "text", "text": ORIENT}, {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + _b64(im, 1000)}}], model="google/gemini-2.5-pro", mt=3000))
    with cf.ThreadPoolExecutor(2) as ex: fv, fo = ex.submit(_vote, im, q), ex.submit(oq)
    res = fv.result(); o = fo.result(); res["orient"] = o
    h, ch, te = (str(o.get(k, "none")).lower().strip() for k in ("hair", "chin", "teeth_edges"))
    if h in TO_UP: res["rotate"], res["by"] = TO_UP[h], "hair"
    elif ch in TO_DOWN: res["rotate"], res["by"] = TO_DOWN[ch], "chin"
    elif res.get("view") in ("retracted_front", "retracted_lateral", "smile_front", "smile_lateral", "prep") and te in TO_DOWN:
        res["rotate"], res["by"] = TO_DOWN[te], "teeth"
    else:
        with cf.ThreadPoolExecutor(votes) as ex: rs = list(ex.map(lambda _: _vote(im, q), range(votes)))
        res["rotate"], res["by"] = Counter(r["rotate"] for r in rs).most_common(1)[0][0], "vote"
    return res

def upright(path, r):
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    if r.get("rotate"): im = im.rotate(-int(r["rotate"]), expand=True)
    if r.get("mirrored"): im = ImageOps.mirror(im)
    return im

def intake(src_dir, case_dir):
    import concurrent.futures as cf
    from explainer import chat
    c = Case(case_dir); files = []
    for f in sorted(os.listdir(src_dir)):
        if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".heic")): shutil.copy(os.path.join(src_dir, f), f"{c.d}/input/{f}"); files.append(f)
    def one(f):
        try: return f, view_of(f"{c.d}/input/{f}")
        except BaseException as e: return f, {"view": "other", "error": str(e)[:200]}
    with cf.ThreadPoolExecutor(6) as ex: views = dict(ex.map(one, files))
    pics = [f for f in files if views[f].get("view") not in ("other", "doctor")]
    ims = {f: upright(f"{c.d}/input/{f}", views[f]) for f in pics}
    # الدور التاني: مقارنة كل الصور ببعض (قبل/بعد + أحسن صورة لكل خانة)
    parts = [{"type": "text", "text": P2.format(slots="\n".join(f"- {k}: {EN[k]}" for k in EN if k != "doctor"))}]
    for i, f in enumerate(pics, 1):
        parts += [{"type": "text", "text": f"Image {i} (view: {views[f]['view']}, {ims[f].width}x{ims[f].height}{', landscape' if ims[f].width > ims[f].height else ', vertical'}):"}, {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + _b64(ims[f], 640)}}]
    r2 = _json(chat(parts, model="google/gemini-2.5-pro", mt=6000))
    for i in r2.get("not_upright", []):   # لسه مقلوبة: نسأل تاني عنها لوحدها بعد اللف
        f = pics[int(i) - 1]; tmp = f"{c.d}/input/_up_{f}.jpg"; ims[f].save(tmp); r = view_of(tmp); ims[f] = upright(tmp, r); os.remove(tmp)
    assign = {k: pics[int(v) - 1] for k, v in r2.get("assign", {}).items() if k in SLOTS and v and 0 < int(v) <= len(pics)}
    docs = [f for f in files if views[f].get("view") == "doctor"]
    if docs: assign["doctor"] = docs[0]; ims[docs[0]] = upright(f"{c.d}/input/{docs[0]}", views[docs[0]])
    for k, f in assign.items():
        out = c.canon(k); os.makedirs(os.path.dirname(out), exist_ok=True); ims[f].save(out, quality=95)
        if k == "after_smile": ims[f].save(f"{c.d}/canon/after/smile_front.jpg", quality=95)
        v = views[f]; c.m["slots"][k] = {"file": f, "view": v.get("view"), "rotate": v.get("rotate", 0), "mirrored": v.get("mirrored", False), "quality": v.get("quality"),
                                         "phase": r2.get("phase", {}).get(str(pics.index(f) + 1)) if f in pics else None}
    g = [views[f].get("gender") for f in files if views[f].get("view", "").startswith("face") and views[f].get("gender") in ("male", "female")]
    c.m["patient"]["gender"] = max(set(g), key=g.count) if g else c.m["patient"].get("gender", "male")
    unused = [f for f in files if f not in assign.values()]
    c.m["intake"] = {"views": views, "phase": r2.get("phase"), "why": r2.get("why"), "unused": unused}; c.save()
    c.log("الاستقبال خلص: " + ", ".join(f"{k}←{f}" for k, f in assign.items()) + (f" | مااتستخدمتش: {', '.join(unused)}" if unused else "")); return c

if __name__ == "__main__":
    c = intake(sys.argv[1], sys.argv[2]); print(c.summary())
