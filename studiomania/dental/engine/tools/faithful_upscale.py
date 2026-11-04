"""أداة عامة: تكبير أمين — الحدة والتفاصيل الدقيقة من موديل التكبير، والألوان والبقع والشكل من الصورة الأصلية
(علشان التكبير مايجمّلش السنان ولا يغيّر الحالة الحقيقية)."""
import sys, cv2, numpy as np
from PIL import Image
def faithful(orig, up, out, sig=2.2):
    U = np.array(Image.open(up).convert("RGB")).astype(np.float32); O = np.array(Image.open(orig).convert("RGB").resize((U.shape[1], U.shape[0]), Image.BICUBIC)).astype(np.float32)
    hi = U - cv2.GaussianBlur(U, (0, 0), sig); lo = cv2.GaussianBlur(O, (0, 0), sig)
    Image.fromarray(np.clip(lo + hi, 0, 255).astype(np.uint8)).save(out); return out
if __name__ == "__main__": print(faithful(*sys.argv[1:4]))
