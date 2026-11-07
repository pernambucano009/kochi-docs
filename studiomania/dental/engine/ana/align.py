"""مطابقة صورة البعد على القبل: بنستخدم مراكز السنان اللي ليها نفس الرقم في الصورتين."""
import cv2, numpy as np
from teethlib import analyze
import os as _os
_CD = _os.environ.get("CASE_DIR"); C = (_CD + "/canon/") if _CD else ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/case1/"); AN = (_CD + "/ana/") if _CD else ""
def pair():
    ib, tb = analyze(C + "before/macro.jpg", AN + "ai_before.png", AN + "lab_before.json"); ia, ta = analyze(C + "after/front.jpg", AN + "ai_after.png", AN + "lab_after.json")
    B = {t["fdi"]: t for t in tb if t["fdi"] < 30}; A = {t["fdi"]: t for t in ta if t["fdi"] < 30}
    common = sorted(set(B) & set(A))
    if len(common) < 2: raise SystemExit(f"TEETH_NO_MATCH: الأسنان العلوية المرقّمة قبل {sorted(B)} وبعد {sorted(A)}")
    src = np.float32([[A[k]["cx"], A[k]["y"] + A[k]["h"]] for k in common] + [[A[k]["cx"], A[k]["y"]] for k in common])   # الحافة القاطعة + عنق السن
    dst = np.float32([[B[k]["cx"], B[k]["y"] + B[k]["h"]] for k in common] + [[B[k]["cx"], B[k]["y"]] for k in common])
    M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.LMEDS)
    wa = cv2.warpAffine(ia, M, (ib.shape[1], ib.shape[0]), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    common_all = sorted(set(k for k in {t["fdi"] for t in tb} & {t["fdi"] for t in ta} if k))   # العلوي والسفلي
    Ball = {t["fdi"]: t for t in tb}; Aall = {t["fdi"]: t for t in ta}; B.update({k: Ball[k] for k in common_all}); A.update({k: Aall[k] for k in common_all})
    masks = {}
    for k in common_all:
        mb = np.zeros(ib.shape[:2], np.uint8); cv2.fillPoly(mb, [B[k]["c"].astype(np.int32)], 255)
        ma = np.zeros(ia.shape[:2], np.uint8); cv2.fillPoly(ma, [A[k]["c"].astype(np.int32)], 255); ma = cv2.warpAffine(ma, M, (ib.shape[1], ib.shape[0]))
        masks[k] = cv2.GaussianBlur(cv2.dilate(np.maximum(mb, ma), np.ones((15, 15), np.uint8)), (0, 0), 4)
    return ib, wa, masks, common_all, M
if __name__ == "__main__":
    ib, wa, masks, common, M = pair(); print(common, np.round(M, 3))
    over = cv2.addWeighted(ib, .5, wa, .5, 0); cv2.imwrite("align_check.jpg", cv2.resize(over, (1200, 800)))
