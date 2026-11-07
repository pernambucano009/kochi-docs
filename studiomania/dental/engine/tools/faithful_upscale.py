"""أداة عامة: تكبير أمين — الحدة والتفاصيل الدقيقة من موديل التكبير، والألوان والبقع والشكل من الصورة الأصلية
(علشان التكبير مايجمّلش السنان ولا يغيّر الحالة الحقيقية)."""
import sys, cv2, numpy as np
from PIL import Image
def faithful(orig, up, out, sig=2.2):
    U = np.array(Image.open(up).convert("RGB")).astype(np.float32); O = np.array(Image.open(orig).convert("RGB").resize((U.shape[1], U.shape[0]), Image.BICUBIC)).astype(np.float32)
    hi = U - cv2.GaussianBlur(U, (0, 0), sig); lo = cv2.GaussianBlur(O, (0, 0), sig)
    Image.fromarray(np.clip(lo + hi, 0, 255).astype(np.uint8)).save(out); return out
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

if __name__ == "__main__": print(faithful(*sys.argv[1:4]))
