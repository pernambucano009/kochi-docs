"""وش بزاوية: الوش المولّد زي ما هو، وجوه فتحة بقه بالظبط بنحط السنان الحقيقية من صورة الابتسامة الجانبية
(محاذاة بأطراف فتحة البق: شمال/يمين/فوق/تحت)، بلون متظبط على الوش."""
import sys, cv2, numpy as np
S = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/"); sys.path.insert(0, S + "tools")
from PIL import Image
from derive import _lmk
from mouth_swap import big
INNER = [78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178,88,95]
def ext(pts):
    pts = np.float32(pts); return np.float32([pts[np.argmin(pts[:, 0])], pts[np.argmax(pts[:, 0])], pts[np.argmin(pts[:, 1])], pts[np.argmax(pts[:, 1])]])
def put(base_p, photo_p, open_p, out_p):
    B = np.array(Image.open(base_p).convert("RGB")); Ph = np.array(Image.open(photo_p).convert("RGB")); mo = big(cv2.imread(open_p, 0))
    P = _lmk(B); inn = P[INNER]; c, _ = cv2.findContours(mo, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); cs = max(c, key=cv2.contourArea)[:, 0]
    M, _ = cv2.estimateAffinePartial2D(ext(cs), ext(inn))   # تشابه بس (من غير مط)
    W = cv2.warpAffine(Ph, M, (B.shape[1], B.shape[0]), flags=cv2.INTER_AREA).astype(np.float32); mw = cv2.warpAffine(mo, M, (B.shape[1], B.shape[0]))
    bm = np.zeros(B.shape[:2], np.uint8); cv2.fillPoly(bm, [inn.astype(np.int32)], 255); m = np.minimum(cv2.erode(bm, np.ones((3, 3), np.uint8)), cv2.dilate(mw, np.ones((9, 9), np.uint8)))
    kk = m > 128; la = cv2.cvtColor(W.astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32); lb = cv2.cvtColor(B, cv2.COLOR_RGB2LAB).astype(np.float32)
    for ch, w in ((0, .6), (1, .8), (2, .8)): la[..., ch] += (lb[..., ch][kk].mean() - la[..., ch][kk].mean()) * w
    W = cv2.cvtColor(np.clip(la, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).astype(np.float32); s = float(np.sqrt(abs(np.linalg.det(M[:, :2]))))
    if s < 1: W = cv2.GaussianBlur(W, (0, 0), .4 + .6 * (1 - s))
    k = cv2.GaussianBlur(m, (0, 0), 1.5).astype(np.float32)[..., None] / 255
    Image.fromarray((W * k + B * (1 - k)).astype(np.uint8)).save(out_p); np.save(out_p.replace(".png", "_open.npy"), m); return out_p
if __name__ == "__main__":
    O = S + "tools/out/"
    for s_ in sys.argv[1:]: print(put(O + f"view_{s_}_base.png", S + f"case1/ret/smile_side_{s_}_ret4.jpg", S + f"tools/ms/side_{s_}_open.png", O + f"after_view_{s_}.png"))
