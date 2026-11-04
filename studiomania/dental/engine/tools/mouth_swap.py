"""وش بعد العلاج v2: بنركّب البق كله (الشفايف + السنان + الجلد حواليه) من صورة الابتسامة الحقيقية بعد العلاج على الوش، بدل السنان بس."""
import sys, cv2, numpy as np
S = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/"); sys.path.insert(0, S + "tools")
from PIL import Image
from derive import _lmk
INNER = [78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178,88,95]
OUTER = [61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146]
def big(m):
    m = (m > 128).astype(np.uint8); n, lab, st, _ = cv2.connectedComponentsWithStats(m); i = 1 + np.argmax(st[1:, 4]); m = (lab == i).astype(np.uint8) * 255
    c, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); f = np.zeros_like(m); cv2.drawContours(f, c, -1, 255, -1); return f
def corners(m):   # طرفين فتحة البق (أبعد نقطة شمال ويمين)
    ys, xs = np.where(m > 0); l = np.argmin(xs); r = np.argmax(xs); return np.float32([xs[l], ys[l]]), np.float32([xs[r], ys[r]])
def swap(base_p, out_p, smile_p=None, lips_p=None, open_p=None):
    B = np.array(Image.open(base_p).convert("RGB")); Sm = np.array(Image.open(smile_p or S + "case1/ret/smile_front_ret4.jpg").convert("RGB"))
    mo = big(cv2.imread(open_p or S + "tools/ms/smile_open.png", 0)); ml = big(cv2.imread(lips_p or S + "tools/ms/smile_lips.png", 0)); ml = np.maximum(ml, mo)
    P = _lmk(B); fi = P[INNER]; fo = P[OUTER]
    sl, sr = corners(ml); bl, br = P[61], P[291]   # أطراف البق الخارجية (زوايا الشفايف)
    # تحويل تشابه (تكبير + لف + نقل) من أطراف فتحة الابتسامة لأطراف فتحة بق الوش، من غير ما نشوّه السنان
    v1 = sr - sl; v2 = br - bl; s = np.linalg.norm(v2) / np.linalg.norm(v1); a = np.arctan2(v2[1], v2[0]) - np.arctan2(v1[1], v1[0])
    R = s * np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]]); c1 = (sl + sr) / 2; c2 = (bl + br) / 2
    # نظبط الرأسي على نص فتحة البق في الوش
    ys = np.where(ml.any(1))[0]; so = np.float32([c1[0], (ys.min() + ys.max()) / 2]); yb = fo[:, 1]; bo = np.float32([c2[0], (yb.min() + yb.max()) / 2])
    t = bo - R @ so; M = np.hstack([R, t[:, None]]).astype(np.float32); H, W = B.shape[:2]
    Sw = cv2.warpAffine(Sm, M, (W, H), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REFLECT); mlw = cv2.warpAffine(ml, M, (W, H)); mow = cv2.warpAffine(mo, M, (W, H))
    bo_m = np.zeros((H, W), np.uint8); cv2.fillPoly(bo_m, [fo.astype(np.int32)], 255)
    region = np.maximum(mlw, bo_m); k = max(9, int(.12 * np.linalg.norm(v2))); region = cv2.dilate(region, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    x, y, w, h = cv2.boundingRect(region); ctr = (x + w // 2, y + h // 2)
    comp = cv2.seamlessClone(Sw, B, region, ctr, cv2.NORMAL_CLONE)   # Poisson: الألوان والإضاءة بتتظبط على الوش من غير حواف
    # السنان (فتحة البق) ترجع بالبكسل الحقيقي بعد ظبط لون خفيف، علشان Poisson مايغيّرش لونها
    ring = cv2.dilate(mow, np.ones((9, 9), np.uint8)) > 0
    la = cv2.cvtColor(Sw, cv2.COLOR_RGB2LAB).astype(np.float32); lb = cv2.cvtColor(comp, cv2.COLOR_RGB2LAB).astype(np.float32)
    for ch, wgt in ((0, .5), (1, .7), (2, .7)): la[..., ch] += (lb[..., ch][ring].mean() - la[..., ch][ring].mean()) * wgt
    Sc = cv2.cvtColor(np.clip(la, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)
    kk = cv2.GaussianBlur(cv2.erode(mow, np.ones((3, 3), np.uint8)), (0, 0), 1.5).astype(np.float32)[..., None] / 255
    out = (Sc * kk + comp * (1 - kk)).astype(np.uint8)
    sh = cv2.GaussianBlur(B, (0, 0), 2) ; sharpB = np.abs(B.astype(np.float32) - sh).mean(); so_ = cv2.GaussianBlur(out, (0, 0), 2); sharpO = np.abs(out.astype(np.float32) - so_).mean()
    Image.fromarray(out).save(out_p)
    np.save(out_p.replace(".png", "_open.npy"), mow); np.save(out_p.replace(".png", "_M.npy"), M); return out_p   # M: تحويل صورة الابتسامة ← الوش (لحدود السنان على الوش)
if __name__ == "__main__":
    for b, o in (("after_portrait_hands.png", "ap2_hands.png"), ("after_portrait.png", "ap2.png")): print(swap(S + "tools/out/" + b, S + "tools/out/" + o))
