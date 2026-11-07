"""أداة عامة: حدود السنان الكاملة (حتى المستخبي ورا الشفة) من صورة المبعد → صورة الابتسامة، بمطابقة كل سنة برقمها
(طرف الحافة القاطعة + ركنين الثلث القاطع ظاهرين في الصورتين)."""
import sys, json, cv2, numpy as np
S = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/"); sys.path.insert(0, S + "ana"); sys.path.insert(0, S + "tools")
from PIL import Image
from teethlib import analyze
def key_pts(c, frac=.3):
    c = np.asarray(c, np.float32); y0, y1 = c[:, 1].min(), c[:, 1].max(); low = c[c[:, 1] > y1 - (y1 - y0) * frac]
    return np.float32([c[np.argmax(c[:, 1])], low[np.argmin(low[:, 0])], low[np.argmax(low[:, 0])]])
def map_teeth(full, vis):
    """full/vis: {fdi: contour}. يرجّع التحويل (تشابه) من full لـ vis."""
    common = [k for k in full if k in vis and k < 30]
    if len(common) < 2: raise SystemExit(f"TEETH_NO_MATCH: السنان المرقّمة في الابتسامة {sorted(k for k in vis if k < 30)} والمبعد {sorted(k for k in full if k < 30)}")
    P1 = np.vstack([key_pts(full[k]) for k in common]); P2 = np.vstack([key_pts(vis[k]) for k in common])
    M, inl = cv2.estimateAffinePartial2D(P1, P2, method=cv2.RANSAC, ransacReprojThreshold=12)
    return M, common, int(inl.sum())
if __name__ == "__main__":
    _, tA = analyze(S + "case1/after/front.jpg", S + "ana/ai_after.png", S + "ana/lab_after.json")
    _, tS = analyze(S + "case1/ret/smile_front_ret4.jpg", S + "ana/ai_smile.png", S + "ana/lab_smile.json")
    full = {int(t["fdi"]): t["c"] for t in tA}; vis = {int(t["fdi"]): t["c"] for t in tS}
    M, common, inl = map_teeth(full, vis); print("common", common, "inliers", inl, "scale", round(float(np.hypot(M[0, 0], M[0, 1])), 3))
    out = {}
    for k in full:
        c = np.asarray(full[k], np.float32) @ M[:, :2].T + M[:, 2]
        if k in vis:   # تصحيح لكل سنة: نزقها بحيث طرفها وركنيها يقعدوا على المرسوم في الصورة (بحد أقصى صغير)
            d = np.median(key_pts(vis[k]) - key_pts(c), 0); d = np.clip(d, -30, 30); c = c + d
        out[k] = c.tolist()
    json.dump(out, open(S + "tools/out/smile_teeth_full.json", "w"))
    Sm = np.array(Image.open(S + "case1/ret/smile_front_ret4.jpg").convert("RGB")); chk = Sm.copy()
    for k, c in out.items():
        if k < 30: cv2.polylines(chk, [np.int32(c)], True, (255, 255, 255), 3)
    Image.fromarray(chk).resize((1000, 667)).save(S + "tpl/out/smile_full_chk.jpg")
