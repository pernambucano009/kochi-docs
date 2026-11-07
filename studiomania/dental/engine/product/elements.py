"""مصنع العناصر: أي عنصر ناقص في الحالة بيتعمل مرة واحدة من الصور الحقيقية، وبيعدّي على فلترين
(فلتر رقمي/بصري بالموديل + مقارنة السنان بالأصل)، وبعدين بيستنى موافقة العميل. بعد الموافقة أي قالب بياخده زي ما هو.
القواعد:
  - الذكاء الاصطناعي عمره ما يغيّر السنان ولا يجمّل "قبل".
  - وش بعد العلاج من غير مبعد = البق كله (شفايف + سنان) من صورة الابتسامة الحقيقية، مش لزق سنان.
  - أي مشهد جديد (زاوية/خلفية/فيديو) بيتعمل من العنصر المعتمد مباشرة — ممنوع نلزق تاني.
  - الراجل: قبضة تحت الدقن — الست: إيديها على خدها.
الاستخدام:
  python3 elements.py <case> list              ← حالة كل عنصر
  python3 elements.py <case> make [اسم..]      ← يعمل الناقص (أو عناصر بعينها)
  python3 elements.py <case> approve اسم       ← موافقة العميل
  python3 elements.py <case> reject اسم "سبب"   ← رفض (بيتعمل تاني في الدور الجاي)"""
import sys, os, json, shutil, io, base64
S = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/")
for p in ("product", "tools", "gen", "ana", "xpl"): sys.path.insert(0, S + p)
import cv2, numpy as np
from PIL import Image
from case import Case, MISSING, MADE, QA_PASS, QA_FAIL, APPROVED, REJECTED

def nb(prompt, imgs, out, ar="3:4"):
    from at import run, get, upload
    get(run("Image", {"model": "google/nano-banana-pro/edit-developer", "prompt": prompt, "images": [upload(p) for p in imgs], "aspect_ratio": ar, "resolution": "2k"}), out); return out

def vid(img, prompt, out):
    from at import run, get, upload
    get(run("Video", {"model": "bytedance/seedance-2.0-mini/image-to-video", "image": upload(img), "prompt": prompt, "duration": 5, "resolution": "1080p-sr", "aspect_ratio": "3:4", "generate_audio": False}), out); return out

MASKP = {"open": "Convert this photo into a precise segmentation mask with the EXACT same framing, size and geometry. The mouth opening (everything inside the inner edge of the lips: all teeth, gums, dark mouth interior) becomes solid pure white. Everything else (lips, skin, background) becomes pure black. Only black and white.",
         "lips": "Convert this photo into a precise segmentation mask with the EXACT same framing, size and geometry. The whole mouth becomes solid pure white: both lips plus everything inside them (teeth, gums, mouth interior). Everything else becomes pure black. Only black and white."}
def mouth_masks(photo, out_dir, tag):
    from at import run, get, upload
    h, w = cv2.imread(photo).shape[:2]; out = {}
    for k, p in MASKP.items():
        f = f"{out_dir}/{tag}_{k}.png"
        if not os.path.exists(f):
            get(run("Image", {"model": "google/nano-banana-pro/edit-developer", "prompt": p, "images": [upload(photo)], "aspect_ratio": "3:2", "resolution": "2k"}), f)
            cv2.imwrite(f, cv2.resize(cv2.imread(f, 0), (w, h)))
        out[k] = f
    return out

def face_mouth_masks(photo, out_dir, tag):
    """أقنعة البق لصورة وش كامل من نقط الوش نفسها (الموديل بيغلط في الوش الكامل: بيرسم بق مكبّر). lips = الشفايف كلها، open = فتحة البق."""
    from derive import _lmk
    from mouth_swap import INNER, OUTER
    a = np.array(Image.open(photo).convert("RGB")); P = _lmk(a); H, W = a.shape[:2]; out = {}
    for k, idx, dil in (("lips", OUTER, 5), ("open", INNER, 1)):
        m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [P[idx].astype(np.int32)], 255); m = cv2.dilate(m, np.ones((dil, dil), np.uint8))
        f = f"{out_dir}/{tag}_{k}.png"; cv2.imwrite(f, m); out[k] = f
    return out

KEEP = " Keep his/her face, lips, smile shape and EVERY tooth exactly as in the photo; the mouth does not talk or change shape. Steady camera, photorealistic."

# ---------------- الوصفات ----------------
# كل وصفة: (العناصر/الصور المطلوبة، دالة التصنيع، سؤال الفلتر بالموديل، مقارنة السنان: [(صورة العنصر، صورة الأصل)])
def upside_down(lips_p, open_p):
    """صورة ابتسامة مقلوبة ١٨٠؟ في الابتسامة الطبيعية زوايا البق فوق (قريبة من الشفة العليا) والشفة التحتانية نازلة لتحت.
    زوايا البق تحت + فتحة البق في النص العلوي = مقلوبة (مقاس على صور حقيقية: معدولة ≤ 0.19، مقلوبة ≥ 0.64)."""
    ml = cv2.imread(lips_p, 0); mo = cv2.imread(open_p, 0)
    ys, xs = np.where(ml > 128)
    if len(xs) < 100: return False
    top, bot = ys.min(), ys.max(); l, r = np.argmin(xs), np.argmax(xs); h = max(1, bot - top)
    corner = ((ys[l] + ys[r]) / 2 - top) / h; oy = np.where(mo > 128)[0]; opn = (oy.mean() - top) / h if len(oy) else .5
    return corner > .5 and opn < .5

FLIP_Q = """TOP: a crop of this patient's full face photo, correctly upright (nose above the mouth). It is the reference.
BOTTOM LEFT and BOTTOM RIGHT: the same close-up smile photo of the same patient; one of them is rotated 180 degrees (upside down).
Which bottom image has the SAME orientation as the reference? Compare the lips: the upper lip (under the nose, with the cupid's bow and philtrum) must be on top, the fuller lower lip below, the upper teeth (bigger central incisors) on top.
Answer ONLY JSON: {"same": "LEFT"|"RIGHT", "why": "short"}"""

def _flip_votes(c, photo, votes=3):
    """الموديل يقارن الابتسامة (معدولة ومقلوبة) بوش المريض نفسه قبل العلاج (اتجاهه أكيد صح من نقط الوش). رجوع: عدد الأصوات اللي بتقول مقلوبة، وعدد الأصوات."""
    import concurrent.futures as cf, base64, io
    from PIL import Image
    from derive import _lmk
    from explainer import chat
    B = np.array(Image.open(c.canon("before_face")).convert("RGB")); P = _lmk(B)
    x0, y0 = P[[61, 291, 0, 17]].min(0); x1, y1 = P[[61, 291, 0, 17]].max(0); w = x1 - x0
    ref = Image.fromarray(B[int(max(0, y0 - w * .9)):int(y1 + w * .5), int(max(0, x0 - w * .4)):int(x1 + w * .4)])
    sm = Image.open(photo).convert("RGB"); sm.thumbnail((560, 560)); ref.thumbnail((560, 400)); fl = sm.rotate(180)
    g = Image.new("RGB", (sm.width * 2 + 20, ref.height + sm.height + 20), (255, 255, 255))
    g.paste(ref, ((g.width - ref.width) // 2, 0)); g.paste(sm, (0, ref.height + 20)); g.paste(fl, (sm.width + 20, ref.height + 20))
    b = io.BytesIO(); g.save(b, "JPEG", quality=88); u = "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()
    def q(_):
        try: return str(chat([{"type": "text", "text": FLIP_Q}, {"type": "image_url", "image_url": {"url": u}}], model="google/gemini-2.5-pro", mt=2000).get("same", "")).upper()[:1]
        except BaseException: return ""
    with cf.ThreadPoolExecutor(votes) as ex: rs = [r for r in ex.map(q, range(votes)) if r in ("L", "R")]
    return sum(r == "R" for r in rs), len(rs)

def smile_flipped(c, m):
    """القرار من أكتر من علامة (مش الموديل لوحده): شكل زوايا البق، ومقارنة الموديل بوش المريض نفسه."""
    geo = upside_down(m["lips"], m["open"])
    if not c.has("before_face"): return geo
    try: fl, n = _flip_votes(c, c.canon("after_smile"))
    except Exception: return geo
    if n == 0: return geo
    if fl == n or fl == 0: return fl == n   # الموديل متفق تمامًا ومعاه المرجع: نمشي وراه
    return geo if fl * 2 == n else (fl * 2 > n)

def fix_smile_flip(c, m):
    """لو ابتسامة البعد مقلوبة: نعدل الصورة وأقنعتها ونعيد تحليل سنانها (مرة واحدة، قبل ما أي حاجة تتعمل منها)."""
    if smile_flipped(c, m):   # الموديل ماعرفش إنها مقلوبة: نعدلها هنا قبل ما أي حاجة تتعمل منها
        for f in (c.canon("after_smile"), c.d + "/canon/after/smile_front.jpg", m["lips"], m["open"]):
            if os.path.exists(f): cv2.imwrite(f, cv2.rotate(cv2.imread(f, cv2.IMREAD_UNCHANGED), cv2.ROTATE_180))
        sl = c.m["slots"].get("after_smile", {}); sl["rotate"] = (int(sl.get("rotate", 0)) + 180) % 360
        v = c.m.get("intake", {}).get("views", {}).get(sl.get("file"))
        if v is not None: v["rotate"] = sl["rotate"]; v["by"] = "lips"
        for f in ("ai_smile.png", "lab_smile.json"):   # تحليل السنان اتعمل على الصورة المقلوبة
            if os.path.exists(c.d + "/ana/" + f): os.remove(c.d + "/ana/" + f)
        c.save(); c.log("ابتسامة البعد كانت مقلوبة ١٨٠: اتعدلت")
        import subprocess; subprocess.run([sys.executable, S + "product/analysis.py", c.d], check=True, env=c.env())
        return True
    return False

def r_smile_masks(c):
    m = mouth_masks(c.canon("after_smile"), c.d + "/elements/ms", "smile"); fix_smile_flip(c, m)
    return [m["open"], m["lips"]]

def r_after_portrait(c):
    out = c.el_path("after_portrait_v3.png")
    if c.has("after_face"): shutil.copy(c.canon("after_face"), out); return [out]   # الطبيب رفع صورة البعد بالوش: حقيقية، مفيش تصنيع
    if os.path.exists(out): os.remove(out)   # صورة قديمة فاشلة ماتفضلش معروضة
    if str(c.m["slots"].get("after_smile", {}).get("view", "")).endswith("lateral"): raise ValueError("SMILE_NOT_FRONTAL lateral")
    from mouth_swap import swap
    ms = c.d + "/elements/ms/"
    if os.path.exists(ms + "smile_lips.png"): fix_smile_flip(c, {"lips": ms + "smile_lips.png", "open": ms + "smile_open.png"})   # حالات قديمة: الأقنعة اتعملت قبل الفحص ده
    inc = None   # عرض السنتين الأماميتين في صورة الابتسامة (من تحليل السنان) — مقياس البق على الوش
    try:
        sys.path.insert(0, S + "ana"); from teethlib import analyze
        _, tS = analyze(c.canon("after_smile"), c.d + "/ana/ai_smile.png", c.d + "/ana/lab_smile.json")
        ws = [t["w"] for t in tS if t["fdi"] in (11, 21)]; inc = sum(ws) / len(ws) if ws else None
    except Exception: inc = None
    swap(c.canon("before_face"), out, smile_p=c.canon("after_smile"), lips_p=ms + "smile_lips.png", open_p=ms + "smile_open.png", inc_w=inc)   # البق كله بالشفايف من صورة الابتسامة الحقيقية
    return [out]

def r_pose(c):   # الوضعية حسب النوع: راجل = قبضة تحت الدقن، ست = إيديها على خدها — وبعدين البق الحقيقي يرجع مكانه
    g = c.m["patient"].get("gender", "male"); base = c.el_path("pose_base.png"); out = c.el_path("after_portrait_pose_m.png" if g == "male" else "after_portrait_hands.png")
    pose = "resting his chin on his closed fist (fist under the chin), confident" if g == "male" else "gently placing both hands on her cheeks"
    nb(f"Same photo of the same person, same face, same lighting and background, now {pose}. Keep the head angle and the smile exactly the same.", [c.el_path("after_portrait_v3.png")], base)
    if os.path.exists(out): os.remove(out)   # صورة قديمة فاشلة ماتفضلش معروضة
    if str(c.m["slots"].get("after_smile", {}).get("view", "")).endswith("lateral"): raise ValueError("SMILE_NOT_FRONTAL lateral")
    from mouth_swap import swap
    ms = c.d + "/elements/ms/"
    if os.path.exists(ms + "smile_lips.png"): fix_smile_flip(c, {"lips": ms + "smile_lips.png", "open": ms + "smile_open.png"})   # حالات قديمة: الأقنعة اتعملت قبل الفحص ده; swap(base, out, smile_p=c.canon("after_smile"), lips_p=ms + "smile_lips.png", open_p=ms + "smile_open.png"); return [out]

def r_profile(c):
    out = c.el_path("profile_right.png")
    nb("Same person, exact same identity, hair, skin, clothes and lighting, photographed in strict side profile facing right, lips gently closed, no teeth visible, plain light background, photorealistic.", [c.canon("before_face")], out); return [out]

def r_angle_closed(c):
    out = c.el_path("angle_closed_0.png")
    nb("Same person, same identity, hair, skin, clothes and lighting, head turned to a three-quarter view, lips gently closed in a calm expression, no teeth visible at all, plain light background, photorealistic.", [c.canon("before_face")], out); return [out]

def r_after_views(c):
    from view_teeth import put
    outs = []
    for side, d, slot in (("l", "left", "after_smile_side_l"), ("r", "right", "after_smile_side_r")):
        if not c.has(slot): continue
        base = c.el_path(f"view_{side}_base.png")
        nb(f"Same photo of the same person with the same smile and the same teeth, head turned about 40 degrees to a three-quarter view facing the {d} side of the image. Same lighting, background and clothes, photorealistic.", [c.el_path("after_portrait_v3.png")], base)
        m = mouth_masks(c.canon(slot), c.d + "/elements/ms", f"side_{side}"); out = c.el_path(f"after_view_{side}.png")
        put(base, c.canon(slot), m["open"], out); outs.append(out)   # السنان الحقيقية من الصورة الجانبية جوه فتحة البق
    return outs

def r_before_hi(c):   # تكبير أمين لوش القبل: الحدة من موديل التكبير، الألوان والبقع من الأصل (مايتجمّلش)
    from at import run, get, upload
    from faithful_upscale import faithful
    up = c.el_path("before_face_x2.png"); out = c.el_path("before_face_hi.png")
    get(run("Image", {"model": "tencent/image/upscaler", "image": upload(c.canon("before_face"))}), up); faithful(c.canon("before_face"), up, out); return [out]

def r_teeth_only(c):
    from derive import teeth_only
    A = c.d + "/ana/"; outs = []
    for tag, slot, pref in (("before", "before_retracted", "before"), ("after", "after_retracted", "after")):
        for which in ("upper", "lower", "both"):
            o = c.el_path(f"{pref}_teeth_{which}.png"); teeth_only(c.canon(slot), A + f"ai_{tag}.png", A + f"lab_{tag}.json", which, o); outs.append(o)
    return outs

def r_live(name, src_el, prompt):
    def f(c):
        os.makedirs(c.d + "/elements/v", exist_ok=True); out = c.d + f"/elements/v/{name}.mp4"
        src = c.canon(src_el[5:]) if src_el.startswith("slot:") else c.el_path(("after_portrait_pose_m.png" if c.m["patient"].get("gender", "male") == "male" else "after_portrait_hands.png") if src_el == "POSE" else src_el)
        vid(src, prompt + KEEP, out); return [out]
    return f

def vid_se(img, end, prompt, out):   # فيديو من صورة بداية لصورة نهاية (اللفّة من البروفايل للوش الحقيقي)
    from at import run, get, upload
    get(run("Video", {"model": "vidu/q3-pro/start-end-to-video", "image": upload(img), "end_image": upload(end), "prompt": prompt, "duration": 4}), out); return out

def _he(c): return ("He", "his", "man") if c.m["patient"].get("gender", "male") == "male" else ("She", "her", "woman")

def r_selfie_img(c):
    he, his, man = _he(c); out = c.el_path("selfie_img.png")
    nb(f"Same {man}, same face, same teeth exactly, same clothes and background: {he.lower()} is holding a black smartphone in front of {his} face taking a selfie, natural pose, realistic photo.", [c.el_path("after_portrait_v3.png")], out, ar="9:16"); return [out]

def r_mirror_img(c):
    he, his, man = _he(c); out = c.el_path("mirror_img.png")
    nb(f"This same {man} (identical face, smile and teeth) stands in a modern elegant dental clinic, looking at {his} reflection in a large illuminated wall mirror, smiling, touching {his} cheek, warm interior light, realistic photo.", [c.el_path("after_portrait_v3.png")], out, ar="9:16"); return [out]

def r_doctor_img(c):
    he, his, man = _he(c); out = c.el_path("doctor_img.png"); imgs = [c.el_path("after_portrait_v3.png")]
    who = "behind stands a dentist in a white coat"
    if c.has("doctor"): imgs.append(c.canon("doctor")); who = "behind stands the dentist from the second photo (same face) in a white coat"
    nb(f"Studio photo on plain white background: this same {man} from the first photo (identical face, smile and teeth) sits in front; {who}, both hands raised gracefully in front of the patient's chest as if shaping something invisible in the air. Realistic photo.", imgs, out, ar="9:16"); return [out]

def r_turn(c):
    he, his, man = _he(c); os.makedirs(c.d + "/elements/v", exist_ok=True); out = c.d + "/elements/v/before_turn.mp4"
    vid_se(c.el_path("profile_right.png"), c.canon("before_face"), f"{he} slowly turns {his} head from profile to face the camera, lips closed, then a gentle smile at the very end, static camera.", out); return [out]

def r_beach(c):
    out = c.el_path("beach.png")
    nb("The same person from this photo, unchanged face and smile, sitting relaxed on a sunny beach chair by the sea, happy, photorealistic, vertical framing. Do not change the face, lips or teeth.", [c.el_path("after_portrait_v3.png")], out, ar="9:16"); return [out]

def r_smile_fit(c):
    from face_teeth import smile_fit
    r = smile_fit(c); E = c.d + "/elements/"; return [r["check"], E + "ap_teeth_v3.json", E + "ap_teeth_full.json", E + "smile_to_ap.npy"]

def r_retract(c):
    from face_teeth import retract
    r = retract(c); E = c.d + "/elements/"; return [E + "retract_face.png", r["check"], E + "retract_teeth_box.npy", E + "rcrop_teeth.png"]

def _before_mouth(c, base, out):   # بق القبل الحقيقي (شفايف + سنان) يرجع على صورة متولدة — أقنعة بنقط الوش (E14)
    from mouth_swap import swap
    m = face_mouth_masks(c.canon("before_face"), c.d + "/elements", "before_face")
    swap(base, out, smile_p=c.canon("before_face"), lips_p=m["lips"], open_p=m["open"]); return out

def r_selfie_before(c):   # a33: سيلفي "قبل" والجوال ضهره للكاميرا (E13) — والبق الحقيقي يرجع
    he, his, man = _he(c); raw = c.el_path("selfie_real_raw.png"); out = c.el_path("selfie_real.png")
    hand = "his other hand gently touches his cheek" if man == "man" else "her other hand gently rests on her cheek"
    nb(f"Edit this photo: the SAME {man} (same face, hair, clothes, same smile, keep the teeth exactly as they are). Change only the pose: {he.lower()} is filming a selfie: one arm stretched forward holding a smartphone in front of {his} face at arm's length, slightly to the side, "
       f"the BACK of the phone facing the camera (camera lenses and back panel visible, screen facing {his} face), the phone is NOT at the ear and NOT a phone call; {hand}. Plain light studio background, vertical portrait, face large and fully visible, photorealistic.",
       [c.canon("before_face")], raw, ar="9:16")
    return [_before_mouth(c, raw, out)]

def r_selfie_before_v(c):   # start-end بنفس الصورة: البداية والنهاية بالبق الحقيقي (E01)
    os.makedirs(c.d + "/elements/v", exist_ok=True); out = c.d + "/elements/v/before_selfie.mp4"; he, his, man = _he(c); img = c.el_path("selfie_real.png")
    vid_se(img, img, f"The {man} poses for a selfie, slightly tilting {his} head and moving the phone a little, keeping the same smile. Natural hand-held motion. The mouth does not talk, keep every tooth exactly as it is (old stained teeth, never whiten).", out); return [out]

def r_twin(c):   # a33: نفس المريض مرتين — البعد قدام شمال، القبل ورا يمين — وكل نسخة ببقها الحقيقي
    from mouth_swap import swap
    he, his, man = _he(c); base = c.el_path("twin_base.png"); out = c.el_path("twin_mouths.png"); E = c.d + "/elements/"
    nb(f"Studio photo on a plain light background: the SAME {man} from both photos appears TWICE, standing side by side shoulder to shoulder, both smiling broadly at the camera with teeth visible. "
       "On the LEFT, slightly in front: exactly the person from image 1 (same face, hair, clothes, same smile). On the RIGHT, slightly behind: exactly the person from image 2 (same face, same smile and teeth). "
       "Both heads fully visible, faces large, vertical portrait framing, photorealistic, natural lighting. Do not change faces or teeth.", [c.el_path("after_portrait_v3.png"), c.canon("before_face")], base, ar="9:16")
    im = Image.open(base).convert("RGB"); W, H = im.size; bm = face_mouth_masks(c.canon("before_face"), E, "before_face")
    for side, box in (("L", (0, int(H * .2), int(W * .56), int(H * .62))), ("R", (int(W * .48), int(H * .3), W, int(H * .72)))):
        crop = E + f"twin_{side}.png"; im.crop(box).save(crop); sw = E + f"twin_{side}_sw.png"
        if side == "L": swap(crop, sw, smile_p=c.canon("after_smile"), lips_p=E + "ms/smile_lips.png", open_p=E + "ms/smile_open.png")
        else: swap(crop, sw, smile_p=c.canon("before_face"), lips_p=bm["lips"], open_p=bm["open"])
        im.paste(Image.open(sw).convert("RGB"), box[:2])
    im.save(out); return [out]

def r_twin_walkin(c):   # الكادر الأول = البعد لوحده (بقه الحقيقي راجع)، والأخير = التوأم بالبقين الحقيقيين ← vidu start-end (E01 E11)
    from derive import _lmk
    he, his, man = _he(c); E = c.d + "/elements/"; tw = c.el_path("twin_mouths.png"); raw = E + "twin_start_raw.png"; st = c.el_path("twin_start.png")
    nb("Remove the second person on the right (behind) completely and fill that area with the same plain light background. Keep the person on the left EXACTLY unchanged: same face, smile, teeth, clothes, size and position.", [tw], raw, ar="9:16")
    b = np.array(Image.open(tw).convert("RGB")); a = np.array(Image.open(raw).convert("RGB").resize((b.shape[1], b.shape[0]))); H, W = b.shape[:2]
    box = (0, int(H * .2), int(W * .56), int(H * .62)); P = _lmk(b[box[1]:box[3], box[0]:box[2]].copy())
    x0, y0 = P[[61, 291, 0, 17]].min(0) + box[:2]; x1, y1 = P[[61, 291, 0, 17]].max(0) + box[:2]; pd = float(x1 - x0) * .35
    m = Image.new("L", (W, H)); from PIL import ImageDraw, ImageFilter; ImageDraw.Draw(m).ellipse((float(x0) - pd, float(y0) - pd, float(x1) + pd, float(y1) + pd), fill=255)
    m = np.array(m.filter(ImageFilter.GaussianBlur(pd / 3)))[..., None] / 255.; Image.fromarray((b * m + a * (1 - m)).astype(np.uint8)).save(st)
    os.makedirs(E + "v", exist_ok=True); out = E + "v/twin_walkin.mp4"
    vid_se(st, tw, f"A second {man} walks in from outside the RIGHT edge of the frame and stops right beside the first one, shoulder to shoulder, both smiling at the camera. "
           "The second one never appears behind the first one's head and there is never a third person. The first one stays still. Static camera, plain background, natural movement, "
           "the mouths do not talk, keep every tooth exactly as it is during the whole video (the second one's teeth stay old, yellow and stained in every frame, never whiten).", out); return [out]

def r_gum_back(c):   # خلفية لثة ممتدة لحد حافة الشاشة (R4.1) — مرة لكل حالة، والريندر بياخد منها نسيج اللثة (auto_gum)
    import subprocess
    code = ("import sys; sys.argv=['T.py']; import T, shutil; from tl import shift_x, right_gap; f = T.morph_frame(1, 1.0); dx = right_gap(f) + 6; "
            "p = T.gum_backdrop(shift_x(f, dx), 'after_dx%d' % dx); shutil.copy(T.TO + 'gum_back_after_dx%d.png' % dx, T.TO + 'gum_back_after.png')")
    r = subprocess.run(["python3", "-c", code], cwd=S + "tpl", env=dict(os.environ, CASE_DIR=c.d), capture_output=True, text=True)
    if r.returncode != 0:   # السبب الحقيقي (آخر سطر في الخطأ) بدل نص الأمر نفسه
        ls = [l for l in r.stderr.splitlines() if l.strip() and not l.startswith(("W0000", "I0000", "INFO"))]
        raise RuntimeError(ls[-1][:300] if ls else f"exit {r.returncode}")
    return [c.el_path("gum_back_after.png")]

RECIPES = {
    "ms/smile_masks":        (["slot:after_smile"], r_smile_masks, None, []),
    "after_portrait_v3.png": (["slot:before_face", "slot:after_smile", "ms/smile_masks"], r_after_portrait,
                              "This is the patient's face photo with the patient's REAL after-treatment mouth (lips and teeth together, taken from a real close-up photo of the same patient) placed on it on purpose. "
                              "New veneers/crowns are expected to look whiter, more uniform and somewhat bigger than the old teeth, and the real lips may show dryness or texture: that is NOT a problem. "
                              "Slight differences in sharpness or tone around the mouth are acceptable at social-media viewing size. "
                              "The mouth size and position were already measured from face landmarks before building this photo, so do not judge them. "
                              "FAIL only for a real defect: the mouth is upside down or rotated, a hard visible box/edge or colour patch around the mouth, doubled lips or teeth. Otherwise PASS.", [("mouth", "slot:after_smile")]),
    "ap_teeth":              (["after_portrait_v3.png", "slot:after_retracted"], r_smile_fit, "This is a crop of a smiling face with thin white outlines drawn on the teeth. Pass only if each outline follows a real visible tooth edge closely (no outline floating on lips/skin, no big offset).", []),
    "retract":               (["slot:before_face"], r_retract, "Image of a patient wearing a black dental lip retractor, with a red box. Pass only if: same person, natural retractor, the red box tightly surrounds the visible teeth.", []),
    "pose":                  (["after_portrait_v3.png"], r_pose, "Is the pose natural (fist under chin for a man / hands on cheeks for a woman), hands anatomically correct, same identity and same smile?", [("mouth", "slot:after_smile")]),
    "profile_right.png":     (["slot:before_face"], r_profile, "Is this a believable strict side profile of the SAME person (identity, hair, skin), lips closed?", []),
    "angle_closed_0.png":    (["slot:before_face"], r_angle_closed, "Is this the SAME person at a three-quarter angle with lips closed and no teeth visible?", []),
    "after_views":           (["after_portrait_v3.png", "slot:after_smile_side_l"], r_after_views, "Is this the same person at a 3/4 angle with natural mouth and teeth that match the real side smile photo?", []),
    "before_face_hi.png":    (["slot:before_face"], r_before_hi, "This is a sharpened version of a patient's real photo before dental treatment. The face proportions, camera angle and lens perspective are the original photo's and must NOT be judged. "
                              "FAIL only if the sharpening added artifacts (halos, smeared or melted areas, invented details) or the teeth look whitened or beautified. Otherwise PASS."
                              "Its teeth are compared with the original photo in a separate check, so do not ask for the original.", [("mouth", "slot:before_face")]),
    "teeth_only":            (["slot:before_retracted", "slot:after_retracted"], r_teeth_only, None, [("iso", None)]),
    "v/after_live.mp4":      (["after_portrait_v3.png"], r_live("after_live", "after_portrait_v3.png", "The person holds the smile, blinks naturally once, slight natural head movement and breathing."), "VIDEO", []),
    "v/after_blink.mp4":     (["after_portrait_v3.png"], r_live("after_blink", "after_portrait_v3.png", "The person starts with eyes gently closed while smiling, then slowly opens the eyes and keeps smiling, subtle head movement."), "VIDEO", []),
    "v/after_fist.mp4":      (["pose"], r_live("after_fist", "POSE", "The person keeps the pose and smiles, blinks once, tiny head tilt."), "VIDEO", []),
    "v/before_live.mp4":     (["slot:before_face"], r_live("before_live", "slot:before_face", "The person holds the smile, blinks naturally once, slight natural head movement. The old teeth keep their exact yellow color, stains, gaps and shapes; never whiten or fix them."), "VIDEO", [("mouth", "slot:before_face"), ("drift", "slot:before_face")]),   # فحص السنان إجباري: الموديل بيحب يبيّض القبل
    "selfie_img.png":        (["after_portrait_v3.png"], r_selfie_img, "Same person taking a selfie, natural hands and phone, same smile and teeth?", [("mouth", "after_portrait_v3.png")]),
    "mirror_img.png":        (["after_portrait_v3.png"], r_mirror_img, "Same person admiring the smile in a clinic mirror, natural hand, believable reflection?", [("mouth", "after_portrait_v3.png")]),
    "doctor_img.png":        (["after_portrait_v3.png"], r_doctor_img, "Patient in front with a dentist behind gesturing; patient identity and smile unchanged; hands anatomically correct?", [("mouth", "after_portrait_v3.png")]),
    "v/before_turn.mp4":     (["profile_right.png", "slot:before_face"], r_turn, "VIDEO", []),
    "v/after_selfie.mp4":    (["selfie_img.png"], r_live("after_selfie", "selfie_img.png", "The person holds the phone steady and smiles at it, very small natural movement, fingers stay still on the phone, static camera."), "VIDEO", []),
    "v/after_mirror.mp4":    (["mirror_img.png"], r_live("after_mirror", "mirror_img.png", "The person smiles at the reflection and gently touches the cheek, very slow natural movement, static camera."), "VIDEO", []),
    "v/doctor_talk.mp4":     (["doctor_img.png"], r_live("doctor_talk", "doctor_img.png", "The dentist behind slowly moves both hands in graceful shaping gestures in front of the patient, the patient keeps smiling still, static camera."), "VIDEO", []),
    "beach.png":             (["after_portrait_v3.png"], r_beach, "Same person, same face and smile (teeth unchanged), naturally placed on a beach, believable lighting?", [("mouth", "after_portrait_v3.png")]),
    "selfie_real.png":       (["slot:before_face"], r_selfie_before, "Check ONLY: (1) the person is filming a selfie with the phone held in front of the face at arm's length (NOT at the ear, NOT a phone call); (2) the BACK of the phone with camera lenses faces the viewer; (3) hands anatomically correct; (4) same identity as a normal photo. The old stained teeth are REAL and intentional (before treatment) — do not judge dental appearance.", [("mouth", "slot:before_face")]),
    "v/before_selfie.mp4":   (["selfie_real.png"], r_selfie_before_v, "VIDEO", [("drift", "slot:before_face")]),
    "twin_mouths.png":       (["after_portrait_v3.png", "slot:before_face", "slot:after_smile", "ms/smile_masks"], r_twin, "Marketing composite: the same patient appears twice (front-left after treatment with new white teeth, back-right before treatment with old stained teeth). Check ONLY: both look like the same person, faces/hands/bodies are anatomically natural, no visible seams or duplicated body parts. The white teeth and the stained teeth are REAL photos of this patient and intentional — do not judge whiteness, staining or dental appearance. Small lighting differences around a mouth are acceptable at social-media viewing size.", [("stats", "slot:before_face")]),
    "v/twin_walkin.mp4":     (["twin_mouths.png"], r_twin_walkin, "VIDEO", [("drift", "slot:before_face")]),
    "gum_back_after.png":    (["slot:after_retracted", "after_portrait_v3.png"], r_gum_back, "Isolated dental arch on black, rotated sideways (tooth tips to the left). Check ONLY: the pink gum continues naturally and continuously all the way to the RIGHT edge of the image (no black gap between gum and right edge), with natural gum texture and no obvious artifacts or stripes. Ignore the patient's dental/gum condition and anything on the left black side.", []),
    "v/beach_live.mp4":      (["beach.png"], r_live("beach_live", "beach.png", "The person keeps looking straight at the camera with a big happy smile, relaxed on the beach chair, slight natural head movement and a soft blink; sea waves, palm leaves and the shirt move in the breeze. Never turns the head away."), "VIDEO", []),
}
# عناصر لسه أدواتها مربوطة بالحالة الأولى ومحتاجة نقل (بتظهر في التقرير عشان نعرف الناقص بالظبط)
PENDING_PORT = {}   # اتنقلوا: ap_teeth و retract (face_teeth.py)

# ---------------- الفلاتر ----------------
def _b64(p, w=768):
    im = Image.open(p).convert("RGB"); im = im.resize((w, int(w * im.height / im.width))); b = io.BytesIO(); im.save(b, "JPEG", quality=88); return base64.b64encode(b.getvalue()).decode()

def ai_check(paths, question):
    from explainer import chat
    # سؤال بيحدد بنفسه إمتى يرفض («Otherwise PASS»): مانزودش «كن صارم» (كان بيرفض حاجات العميل قبلها، زي وش البعد المتركّب)
    tone = "" if question.rstrip().endswith("Otherwise PASS.") else "\nBe strict like a senior dental marketing editor."
    parts = [{"type": "text", "text": question + tone + ' Answer ONLY JSON: {"pass": true/false, "score": 1-10, "issues": ["..."], "reason_ar": "جملة قصيرة"}'}]
    for p in paths: parts.append({"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + _b64(p)}})
    r = chat(parts, model="google/gemini-2.5-pro", mt=2000); t = r if isinstance(r, str) else json.dumps(r)
    return json.loads(t[t.find("{"):t.rfind("}") + 1])

def mouth_crop(p):   # قص منطقة البق بنقط الوش (عشان نقارن السنان بالأصل)
    from derive import _lmk
    a = np.array(Image.open(p).convert("RGB")); P = _lmk(a); x0, y0 = P[[61, 291, 0, 17]].min(0); x1, y1 = P[[61, 291, 0, 17]].max(0); pad = (x1 - x0) * .25
    out = p.rsplit(".", 1)[0] + "_mouthcrop.jpg"; Image.fromarray(a[int(max(0, y0 - pad)):int(y1 + pad), int(max(0, x0 - pad)):int(x1 + pad)]).save(out); return out

def teeth_check(c, el_path, ref):
    """فلتر السنان: السنان في العنصر لازم تكون هي نفسها سنان الصورة الحقيقية (العدد، الشكل، اللون، البقع لو قبل)."""
    refp = c.canon(ref[5:]) if ref.startswith("slot:") else c.el_path(ref)
    try: a, b = mouth_crop(el_path), (mouth_crop(refp) if not ref.startswith("slot:after_smile") else refp)
    except Exception as e: return {"pass": False, "score": 0, "issues": [f"مش لاقي الوش/البق: {e}"]}
    # البق اتنقل من الصورة الحقيقية بتحويل محفوظ (مقاس + لفّة + ضغط رأسي ٨٪ اختيار العميل): المرجع يبقى الصورة الحقيقية بنفس التحويل ونفس القص،
    # فالفلتر بيقارن «المتوقع» بالناتج (أي سنة اتغيرت أو اتبيضت أو اتخلقت = رفض)، مش فرق المقاس والدقة
    Mp = el_path.rsplit(".", 1)[0] + "_M.npy"
    if ref.startswith("slot:after_smile") and os.path.exists(Mp):
        from derive import _lmk
        E_ = np.array(Image.open(el_path).convert("RGB")); P = _lmk(E_); x0, y0 = P[[61, 291, 0, 17]].min(0); x1, y1 = P[[61, 291, 0, 17]].max(0); pad = (x1 - x0) * .25
        Rw = cv2.warpAffine(np.array(Image.open(refp).convert("RGB")), np.load(Mp), (E_.shape[1], E_.shape[0]), flags=cv2.INTER_AREA)
        b = el_path.rsplit(".", 1)[0] + "_ref_same.jpg"
        Image.fromarray(Rw[int(max(0, y0 - pad)):int(y1 + pad), int(max(0, x0 - pad)):int(x1 + pad)]).save(b, quality=92)
    ia, ib = Image.open(a), Image.open(b).convert("RGB")
    if ib.width > ia.width * 1.5:
        ib = ib.resize((ia.width, max(1, round(ib.height * ia.width / ib.width))), Image.LANCZOS); b = b.rsplit(".", 1)[0] + "_ref_small.jpg"; ib.save(b, quality=92)
    return ai_check([a, b], "Image 1 is a generated photo, image 2 is the REAL reference (shown at the same small size). Are the TEETH in image 1 the same teeth as image 2 (same count, shapes, proportions, arrangement, color, stains if any)? "
                    "Ignore the area around the mouth (image 2 is only the real mouth photo aligned to the same place), fine surface texture, sharpness and small brightness differences (different lighting). Changed tooth shapes or count, whitening, beautification or invented teeth = fail.")

def video_check(path):
    import subprocess
    frames = []; d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True).stdout or 4)
    for t in (round(d * .08, 2), round(d * .5, 2), round(d * .92, 2)):   # نسب من المدة (فيديوهات vidu 4ث وseedance 5ث)
        f = path.replace(".mp4", f"_f{t}.jpg"); subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", str(t), "-i", path, "-frames:v", "1", f]); frames.append(f)
    return ai_check(frames, "These are frames from the start, middle and end of a short generated video of a dental patient. Pass only if: same identity in all frames, the smile/teeth stay the same (no morphing, no flicker, no extra teeth), natural motion, no distortion of the face.")

# ---------------- التشغيل ----------------
def ready(c, needs):
    for n in needs:
        if n.startswith("slot:"):
            if not c.has(n[5:]): return False, f"الصورة الحقيقية ناقصة: {n[5:]}"
        elif not c.approved(n) and c.el(n)["status"] not in (QA_PASS,): return False, f"مستني العنصر: {n}"
    return True, ""

def make(c, names=None, force=False):
    report = {}
    for name, (needs, fn, q, tchecks) in RECIPES.items():
        if names and name not in names: continue
        st = c.el(name)["status"]
        if not force and st in (APPROVED, QA_PASS): report[name] = st; continue
        ok, why = ready(c, needs)
        if not ok: c.set_el(name, status=MISSING, note=why); report[name] = why; continue
        for attempt in range(VIDEO_TRIES if q == "VIDEO" else 1):   # موديلات الفيديو عشوائية: لو الفيديو اترفض بيتعمل تاني (E83)
            if attempt:
                for o in outs:
                    if os.path.exists(o): os.replace(o, o.replace(".mp4", f"_rej{attempt}.mp4"))
            try: outs = fn(c)
            except BaseException as e: outs = None; c.set_el(name, status=QA_FAIL, note=f"فشل التصنيع: {str(e)[:200]}"); report[name] = "فشل"; break
            res = _qa(c, name, outs, q, tchecks)
            if res.get("pass"): break
        if outs is None: continue
        st = QA_PASS if res.get("pass") else QA_FAIL
        c.set_el(name, status=st, files=[os.path.relpath(o, c.d) for o in outs], qa=res, note=res.get("reason_ar", ""), tries=attempt + 1); report[name] = st
    return report

def make_parallel(c, names, workers=4):
    """نفس make، بس العناصر اللي مش معتمدة على بعض بتتعمل في نفس الوقت (كل مستوى من الاعتماديات مع بعض).
    أغلب الوقت بيضيع في انتظار موديلات الصور والفحص، فالتوازي بيقصّر الخطوة من غير ما يغيّر الناتج."""
    import concurrent.futures as cf
    todo, done, report = [n for n in RECIPES if n in set(names)], set(), {}
    while todo:
        lvl = [n for n in todo if not any(d in todo for d in RECIPES[n][0] if not d.startswith("slot:"))]
        if not lvl: lvl = todo[:1]
        with cf.ThreadPoolExecutor(min(workers, len(lvl))) as ex:
            for r in ex.map(lambda n: make(c, [n]), lvl): report.update(r)
        todo = [n for n in todo if n not in lvl]
    return report

VIDEO_TRIES = 2
def _qa(c, name, outs, q, tchecks):
    if True:
        res = {"pass": True, "score": 10, "issues": []}
        try:
            if q == "VIDEO": res = video_check(outs[0])
            elif q and q.rstrip().endswith("Otherwise PASS."):   # سؤال «عيوب حقيقية بس»: رأي الموديل بيتغير من مرة للتانية، فالقرار بأغلبية ٣
                import concurrent.futures as cf
                with cf.ThreadPoolExecutor(3) as ex: rs = list(ex.map(lambda _: ai_check(outs[:1], q), range(3)))
                ok = sum(bool(r.get("pass")) for r in rs) >= 2; best = max(rs, key=lambda r: (bool(r.get("pass")) == ok, r.get("score", 0)))
                res = {**best, "pass": ok, "votes": [bool(r.get("pass")) for r in rs]}
            elif q: res = ai_check(outs[:1], q)
        except BaseException as e: res = {"pass": False, "score": 0, "issues": [f"الفحص نفسه وقع: {str(e)[:150]}"]}   # فحص عنصر واحد مايوقّفش الباقي
        for kind, ref in tchecks:
            src = outs[0]
            if src.endswith(".mp4"):   # فيديو: بنفحص كادر من النص
                import subprocess; fr = src.replace(".mp4", "_mid.jpg"); subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", "1.8", "-i", src, "-frames:v", "1", fr]); src = fr
            if kind == "iso":   # Q10 (E24 E140 E141): سنان معزولة — مفيش جوه بق/لسان، ومش مقطوشة عند الحافة — على كل الملفات
                from checks2 import iso_check
                for o in outs:
                    r = iso_check(o)
                    if not r["pass"]: res["pass"] = False; res["issues"] = res.get("issues", []) + [os.path.basename(o) + ": " + x for x in r["issues"]]
                continue
            if kind == "stats":   # Q2 لصورة: سنان وش القبل بالأرقام (مش أول وش يتلاقى)
                from checks import teeth_image
                ti = teeth_image(outs[0], c.canon(ref[5:]) if ref.startswith("slot:") else c.el_path(ref), faces=2 if "twin" in name else 1); res["teeth"] = ti
                if not ti.get("pass"): res["pass"] = False; res["issues"] = res.get("issues", []) + ti.get("issues", [])
                continue
            if kind == "drift":   # البلاي بوك Q2 (E01): فيديو "قبل" — تنوّع البقع والصفار في كل الكادرات مقارنة بالصورة الحقيقية (بالأرقام)
                from checks import teeth_drift
                td = teeth_drift(outs[0], c.canon(ref[5:]) if ref.startswith("slot:") else c.el_path(ref), faces=2 if "twin" in name else 1); res["drift"] = td
                if not td.get("pass"): res["pass"] = False; res["issues"] = res.get("issues", []) + td.get("issues", [])
                continue
            tc = teeth_check(c, src, ref); res["teeth"] = tc
            if not tc.get("pass"): res["pass"] = False; res["issues"] = res.get("issues", []) + ["السنان اتغيرت: " + "; ".join(tc.get("issues", []))]
        return res

if __name__ == "__main__":
    c = Case(sys.argv[1]); cmd = sys.argv[2] if len(sys.argv) > 2 else "list"
    if cmd == "make": print(json.dumps(make(c, sys.argv[3:] or None), ensure_ascii=False, indent=1))
    elif cmd == "check":   # إعادة الفحص بس (من غير تصنيع تاني) بعد تعديل سؤال الفلتر
        for n in sys.argv[3:]:
            needs, fn, q, tchecks = RECIPES[n]; el = c.el(n); outs = [os.path.join(c.d, f) for f in el.get("files", [])]
            fn_saved = RECIPES[n]; RECIPES[n] = (needs, lambda c_, o=outs: o, q, tchecks); c.set_el(n, status=MISSING)
            print(n, make(c, [n])[n]); RECIPES[n] = fn_saved
    elif cmd == "approve": c.set_el(sys.argv[3], status=APPROVED); print("اتعتمد", sys.argv[3])
    elif cmd == "reject": c.set_el(sys.argv[3], status=REJECTED, note=sys.argv[4] if len(sys.argv) > 4 else ""); print("اترفض", sys.argv[3])
    else:
        print(c.summary()); print("\nأدوات لسه محتاجة نقل:"); [print(" -", k, "←", v) for k, v in PENDING_PORT.items()]
