"""أدوات استخراج العناصر الناقصة من عناصر الحالة الموجودة.
1) teeth_only: السنان لوحدها (علوي/سفلي/الاتنين) من صورة بالمبعد.
2) after_portrait: وش المريض بعد العلاج = وش قبل + سنان البعد الحقيقية (الموديل يدمج، وبعدين نرجّع السنان الحقيقية بالبكسل).
3) profile: صورة جانبية للمريض من صورته الأمامية.
4) qa: فلتر يقيّم أي صورة مشتقة قبل ما تتستخدم."""
import sys, json, base64, io, os, cv2, numpy as np
S = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/")
sys.path.insert(0, S + "gen"); sys.path.insert(0, S + "ana"); sys.path.insert(0, S + "xpl")
from at import run, get, upload
from PIL import Image, ImageDraw, ImageFilter
OUT = S + "tools/out/"; os.makedirs(OUT, exist_ok=True)
def nb(prompt, imgs, out, ar="9:16"):
    u = run("Image", {"model": "google/nano-banana-pro/edit-developer", "prompt": prompt, "images": [upload(p) for p in imgs], "aspect_ratio": ar, "resolution": "2k"}); get(u, out); return out
def qa(images, question):
    from explainer import chat
    parts = [{"type": "text", "text": question + '\nAnswer JSON: {"pass": true/false, "score": 1-10, "issues": ["..."], "reason_ar": "جملة قصيرة بالفصحى"}'}]
    for p in images:
        b = io.BytesIO(); Image.open(p).convert("RGB").resize((768, int(768 * Image.open(p).height / Image.open(p).width))).save(b, "JPEG", quality=88)
        parts.append({"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()}})
    return chat(parts, model="google/gemini-2.5-pro", mt=3000)
# ---------- 1) السنان لوحدها ----------
def teeth_only(src, mask, labels, which="upper", out=None):
    from teethlib import analyze
    im, teeth = analyze(src, mask, labels); rgb = cv2.cvtColor(im, cv2.COLOR_BGR2RGB)
    sel = [t for t in teeth if (which == "both") or (which == "upper" and t["fdi"] < 30) or (which == "lower" and t["fdi"] > 30)]
    m = np.zeros(im.shape[:2], np.uint8)
    for t in sel: cv2.fillPoly(m, [t["c"].astype(np.int32)], 255)
    m = cv2.GaussianBlur(m, (0, 0), 1.2); x, y, w, h = cv2.boundingRect((m > 10).astype(np.uint8))
    rgba = np.dstack([rgb, m])[y - 10:y + h + 10, x - 10:x + w + 10]; out = out or OUT + f"teeth_{which}.png"; Image.fromarray(rgba).save(out); return out
# ---------- 2) وش بعد العلاج ----------
def _lmk(img):
    import mediapipe as mp
    from mediapipe.tasks.python import vision, BaseOptions
    det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=S + "face/face_landmarker.task"), num_faces=1))
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(img))); L = r.face_landmarks[0]; h, w = img.shape[:2]
    return np.float32([[p.x * w, p.y * h] for p in L])
def after_portrait(face_before, smile_after, smile_mask, smile_labels, out=None):
    out = out or OUT + "after_portrait.png"
    # أ) الموديل يرسم نفس الشخص بنفس الصورة وبيبتسم بالسنان الجديدة (صورة 2 مرجع للسنان)
    P = ("Image 1 is a real portrait of a man before dental treatment. Image 2 is a real close-up photo of HIS new smile after veneers. "
         "Produce image 1 again as a high-resolution, natural, unedited studio portrait of the SAME man (identical face, age, skin, beard, hair, shirt, pose, "
         "lighting and white background), smiling the same way, but with the new teeth from image 2 exactly: same shape, size, color and arrangement. "
         "Natural lips and smile lines. Do not beautify or change his face.")
    gen = OUT + "ap_gen.png"
    if not os.path.exists(gen): nb(P, [face_before, smile_after], gen, "3:4")
    # ب) نرجّع السنان الحقيقية بالبكسل: نطابق زوايا البق بين صورة الابتسامة والصورة المولدة
    G = np.array(Image.open(gen).convert("RGB")); A = np.array(Image.open(smile_after).convert("RGB"))
    from teethlib import analyze
    _, teeth = analyze(smile_after, smile_mask, smile_labels); up = [t for t in teeth]
    m = np.zeros(A.shape[:2], np.uint8)
    for t in up: cv2.fillPoly(m, [t["c"].astype(np.int32)], 255)
    lg = _lmk(G)
    inner = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]
    poly = lg[inner]; gx0, gy0 = poly.min(0); gx1, gy1 = poly.max(0)
    # فتحة البق في صورة الابتسامة = الغلاف حوالين كل السنان
    allc = np.vstack([t["c"] for t in up]).astype(np.float32); hull = cv2.convexHull(allc.astype(np.int32)).reshape(-1, 2)
    hx0, hy0 = hull.min(0); hx1, hy1 = hull.max(0)
    s_ = (gx1 - gx0) * .97 / (hx1 - hx0); cxA, cyA = (hx0 + hx1) / 2, (hy0 + hy1) / 2; cxG, cyG = (gx0 + gx1) / 2, (gy0 + gy1) / 2
    Mx = np.float32([[s_, 0, cxG - s_ * cxA], [0, s_, cyG - s_ * cyA]])
    wa = cv2.warpAffine(A, Mx, (G.shape[1], G.shape[0]), flags=cv2.INTER_AREA)
    hm = np.zeros(A.shape[:2], np.uint8); cv2.fillPoly(hm, [hull.astype(np.int32)], 255); wh = cv2.warpAffine(cv2.dilate(hm, np.ones((25, 25), np.uint8)), Mx, (G.shape[1], G.shape[0]))
    im_ = np.zeros(G.shape[:2], np.uint8); cv2.fillPoly(im_, [poly.astype(np.int32)], 255)
    k = (cv2.GaussianBlur(np.minimum(wh, im_), (0, 0), 2).astype(np.float32) / 255)[..., None]
    np.save(OUT + "ap_mask.npy", k[..., 0])
    # توحيد إضاءة الصورتين بس (درجة اللون a/b، من غير ما نلمس الإضاءة L ولا الشكل): صورة الابتسامة متصورة بإضاءة أبرد
    kk = k[..., 0] > .5; la_ = cv2.cvtColor(wa, cv2.COLOR_RGB2LAB).astype(np.float32); lg_ = cv2.cvtColor(G, cv2.COLOR_RGB2LAB).astype(np.float32)
    for c in (1, 2): la_[..., c] += (lg_[..., c][kk].mean() - la_[..., c][kk].mean())
    wa = cv2.cvtColor(np.clip(la_, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)
    c1 = (wa * k + G * (1 - k)).astype(np.uint8); Image.fromarray(c1).save(OUT + "ap_c1.png")
    # تمرير دمج: يظبط الحواف والإضاءة حوالين البق من غير ما يغيّر السنان
    H = ("Make this one natural, unedited studio portrait photo. Blend the mouth seamlessly: match lighting and shadows inside the mouth, "
         "soft natural lip edges, no seams or pasted look. Do NOT change the teeth at all (same shape, size, number, color, position). Keep the same person exactly.")
    h = np.array(Image.open(nb(H, [OUT + "ap_c1.png"], OUT + "ap_h.png", "3:4")).convert("RGB").resize((G.shape[1], G.shape[0])))
    g1, g2 = cv2.cvtColor(c1, cv2.COLOR_RGB2GRAY).astype(np.float32), cv2.cvtColor(h, cv2.COLOR_RGB2GRAY).astype(np.float32); Wp = np.eye(2, 3, dtype=np.float32)
    try: _, Wp = cv2.findTransformECC(g1, g2, Wp, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 100, 1e-5), None, 5)
    except cv2.error: pass
    h = cv2.warpAffine(h, Wp, (G.shape[1], G.shape[0]), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
    # آخر خطوة: السنان الحقيقية ترجع بالبكسل (قناع أصغر شوية من الحواف)
    k2 = (cv2.GaussianBlur(cv2.erode((k[..., 0] * 255).astype(np.uint8), np.ones((7, 7), np.uint8)), (0, 0), 2).astype(np.float32) / 255)[..., None]
    res = (wa * k2 + h * (1 - k2)).astype(np.uint8); Image.fromarray(res).save(out)
    return out, Mx
# ---------- 3) صورة جانبية ----------
def profile(face, out=None, side="right"):
    out = out or OUT + f"profile_{side}.png"
    P = (f"Show this exact same man in a strict {side}-side profile view (head turned 90 degrees, we see only his {side} side), "
         "same age, face, beard, hair, shirt, natural relaxed expression with lips closed, same soft studio lighting and plain white background, "
         "realistic photo, sharp, no stylization.")
    return nb(P, [face], out, "3:4")
if __name__ == "__main__":
    C = S + "case1/"; A_ = S + "ana/"
    w = sys.argv[1]
    if w == "teeth":
        for wh in ("upper", "lower", "both"): print(teeth_only(C + "after/front.jpg", A_ + "ai_after.png", A_ + "lab_after.json", wh, OUT + f"after_teeth_{wh}.png"))
        for wh in ("upper", "lower", "both"): print(teeth_only(C + "before/macro.jpg", A_ + "ai_before.png", A_ + "lab_before.json", wh, OUT + f"before_teeth_{wh}.png"))
    if w == "portrait":
        p, _ = after_portrait(C + "before/face.webp", C + "ret/smile_front_ret4.jpg", A_ + "ai_smile.png", A_ + "lab_smile.json")
        r = qa([C + "before/face.webp", C + "ret/smile_front_ret4.jpg", p], "Image 1: patient before treatment. Image 2: his real teeth after treatment. Image 3: a composed portrait that should show the SAME person from image 1 with EXACTLY the teeth of image 2. "
               "Check strictly: same identity (face, age, beard, hair)? teeth identical to image 2 (shape, count, color)? natural seams around lips, no double edges, no distortion? looks like a real photo?")
        print(p, json.dumps(r, ensure_ascii=False))
    if w == "profile":
        p = profile(C + "before/face.webp")
        r = qa([C + "before/face.webp", p], "Image 1 is a real frontal photo. Image 2 should be the SAME person in strict side profile. Check: same identity, age, beard, hair, clothes, lighting? anatomically correct profile (one eye, ear visible, natural nose/chin)? realistic photo? no artifacts?")
        print(p, json.dumps(r, ensure_ascii=False))
