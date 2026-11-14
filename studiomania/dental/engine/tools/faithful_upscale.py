"""أداة عامة: تكبير أمين — الحدة والتفاصيل الدقيقة من موديل التكبير، والألوان والبقع والشكل من الصورة الأصلية
(علشان التكبير مايجمّلش السنان ولا يغيّر الحالة الحقيقية)."""
import sys, cv2, numpy as np
from PIL import Image
def faithful(orig, up, out, sig=2.2):
    U = np.array(Image.open(up).convert("RGB")).astype(np.float32); O = np.array(Image.open(orig).convert("RGB").resize((U.shape[1], U.shape[0]), Image.BICUBIC)).astype(np.float32)
    hi = U - cv2.GaussianBlur(U, (0, 0), sig); lo = cv2.GaussianBlur(O, (0, 0), sig)
    Image.fromarray(np.clip(lo + hi * .7, 0, 255).astype(np.uint8)).save(out); return out   # ٧٠٪ من حدة موديل التكبير: الكاملة كانت بتعمل هالات وملمس خشن على الجلد
def upscale_small(path, min_w=1400, passes=2):
    """صورة قريبة صغيرة (مقصوصة من صورة الوش مثلًا): تكبير أمين لحد ما عرضها يوصل min_w (كل مرة ×٢ تقريبًا)، مكانها.
    بيرجع (العرض قبل، العرض بعد)."""
    import os, sys as _s
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); _s.path.insert(0, root + "/gen")
    from at import run, get, upload
    w0 = Image.open(path).width; w = w0
    for i in range(passes):
        if w >= min_w: break
        up = path.rsplit(".", 1)[0] + f"_up{i}.png"
        get(run("Image", {"model": "tencent/image/upscaler", "image": upload(path)}), up)
        tmp = path.rsplit(".", 1)[0] + "_fx.png"; faithful(path, up, tmp)
        Image.open(tmp).convert("RGB").save(path, quality=95); os.remove(tmp); os.remove(up); w = Image.open(path).width
    return w0, w

def hires(path, sig=6.0):
    """نسخة عالية الدقة (×٢) من صورة الحالة للعرض في الفيديو: <الاسم>_hi.png جنب الصورة. الحدة والتفاصيل (كل اللي أدق من sig بكسل)
    من موديل التكبير، واللون والتصبغات وشكل السنان من الصورة الأصلية. الصورة الأصلية نفسها مابتتغيرش، والتحليل بيفضل عليها."""
    import os, sys as _s
    out = path.rsplit(".", 1)[0] + "_hi.png"
    if os.path.exists(out): return out
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); _s.path.insert(0, root + "/gen")
    from at import run, get, upload
    up = path.rsplit(".", 1)[0] + "_upx.png"
    get(run("Image", {"model": "tencent/image/upscaler", "image": upload(path)}), up)
    U = np.array(Image.open(up).convert("RGB")).astype(np.float32); os.remove(up)
    O = np.array(Image.open(path).convert("RGB").resize((U.shape[1], U.shape[0]), Image.BICUBIC)).astype(np.float32)
    Image.fromarray(np.clip(cv2.GaussianBlur(O, (0, 0), sig) + (U - cv2.GaussianBlur(U, (0, 0), sig)), 0, 255).astype(np.uint8)).save(out)
    return out

if __name__ == "__main__":
    if sys.argv[1] == "hires":   # python3 faithful_upscale.py hires <case_dir>: صورتين الريتراكتور (قبل/بعد)
        import os
        for rel in ("canon/before/macro.jpg", "canon/after/front.jpg"):
            f = os.path.join(sys.argv[2], rel)
            if os.path.exists(f): print("HIRES", hires(f), flush=True)
    else: print(faithful(*sys.argv[1:4]))
