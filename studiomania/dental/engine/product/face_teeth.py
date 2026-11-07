"""أدوات هندسة السنان على الوش لأي حالة (كانت مربوطة بالحالة الأولى):

1) smile_fit: حدود كل سنة على وش بعد العلاج
   - smile_to_ap.npy     : التحويل من صورة الابتسامة الحقيقية ← الوش (نفس اللي اتركّب بيه البق)
   - ap_teeth_v3.json    : حدود السنان الظاهرة على الوش (الخطوط البيضا على الوش)
   - smile_teeth_full.json / ap_teeth_full.json : حدود السنة كاملة (حتى المستخبي ورا الشفة) من صورة المبعد ← الابتسامة ← الوش
2) retract: وش المريض بالمبعد الإسود + مكان السنان جواه (للمشاهد اللي الماكرو الحقيقي بيتحط فيها جوه الوش)
   - retract_face.png (لو الطبيب رفع وش بالمبعد بيتاخد هو)، retract_teeth_box.npy، rcrop_teeth.png، retract_crop.npy"""
import sys, os, json
S = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/")
for p in ("product", "tools", "ana", "gen"): sys.path.insert(0, S + p)
import cv2, numpy as np
from PIL import Image


def fit_M(base_p, smile_p, lips_p, open_p):
    """نفس حساب mouth_swap: تشابه من أطراف فتحة الابتسامة لزوايا بق الوش (للوش الحقيقي اللي مااتعملهوش تركيب)."""
    from mouth_swap import big, corners, OUTER
    from derive import _lmk
    B = np.array(Image.open(base_p).convert("RGB")); P = _lmk(B); fo = P[OUTER]
    mo = big(cv2.imread(open_p, 0)); ml = np.maximum(big(cv2.imread(lips_p, 0)), mo)
    sl, sr = corners(ml); bl, br = P[61], P[291]; v1 = sr - sl; v2 = br - bl
    s = np.linalg.norm(v2) / np.linalg.norm(v1); a = np.arctan2(v2[1], v2[0]) - np.arctan2(v1[1], v1[0])
    R = s * np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]]); c1 = (sl + sr) / 2; c2 = (bl + br) / 2
    ys = np.where(ml.any(1))[0]; so = np.float32([c1[0], (ys.min() + ys.max()) / 2]); bo = np.float32([c2[0], (fo[:, 1].min() + fo[:, 1].max()) / 2])
    M = np.hstack([R, (bo - R @ so)[:, None]]).astype(np.float32)
    H, W = B.shape[:2]; return M, cv2.warpAffine(mo, M, (W, H))


def smooth_poly(pts, n=64, sig=1.2):
    """حدود السنة من قناع الموديل بتبقى مسنّنة لما تتصغّر على الوش: نعيد توزيع النقط ونمرّرها بتنعيم دائري."""
    c = np.asarray(pts, np.float32)
    if len(c) < 6: return c
    cc = np.vstack([c, c[:1]]); d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(cc, axis=0), axis=1))]
    if d[-1] <= 0: return c
    t = np.linspace(0, d[-1], n, endpoint=False); x = np.interp(t, d, cc[:, 0]); y = np.interp(t, d, cc[:, 1])
    k = np.exp(-.5 * (np.arange(-4, 5) / sig) ** 2); k /= k.sum()
    xs = np.convolve(np.r_[x[-4:], x, x[:4]], k, "valid"); ys = np.convolve(np.r_[y[-4:], y, y[:4]], k, "valid")
    return np.c_[xs, ys].astype(np.float32)

def smile_fit(c):
    from teethlib import analyze
    from teeth_map import map_teeth, key_pts
    E = c.d + "/elements/"; A = c.d + "/ana/"; ap = E + "after_portrait_v3.png"
    if os.path.exists(E + "after_portrait_v3_M.npy"): M = np.load(E + "after_portrait_v3_M.npy"); op = np.load(E + "after_portrait_v3_open.npy")
    else: M, op = fit_M(ap, c.canon("after_smile"), E + "ms/smile_lips.png", E + "ms/smile_open.png")
    np.save(E + "smile_to_ap.npy", M)
    _, tS = analyze(c.canon("after_smile"), A + "ai_smile.png", A + "lab_smile.json")
    vis_ap = {}
    for th in tS:   # الظاهر بس جوه فتحة البق على الوش
        cc = th["c"].astype(np.float32) @ M[:, :2].T + M[:, 2]
        tm = np.zeros(op.shape, np.uint8); cv2.fillPoly(tm, [cc.astype(np.int32)], 255); v = np.minimum(op, tm)
        cs = cv2.findContours(v, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0]
        if cs and cv2.contourArea(max(cs, key=cv2.contourArea)) > 80: vis_ap[int(th["fdi"])] = smooth_poly(max(cs, key=cv2.contourArea)[:, 0]).tolist()
    json.dump(vis_ap, open(E + "ap_teeth_v3.json", "w"))
    _, tA = analyze(c.canon("after_retracted"), A + "ai_after.png", A + "lab_after.json")
    full = {int(t["fdi"]): t["c"] for t in tA}; vis = {int(t["fdi"]): t["c"] for t in tS}
    Mf, common, inl = map_teeth(full, vis); sm_full = {}
    for k in full:
        cc = np.asarray(full[k], np.float32) @ Mf[:, :2].T + Mf[:, 2]
        if k in vis: cc = cc + np.clip(np.median(key_pts(vis[k]) - key_pts(cc), 0), -30, 30)
        sm_full[k] = cc.tolist()
    json.dump(sm_full, open(E + "smile_teeth_full.json", "w"))
    json.dump({k: (np.float32(v) @ M[:, :2].T + M[:, 2]).tolist() for k, v in sm_full.items() if int(k) < 30}, open(E + "ap_teeth_full.json", "w"))
    # صورة مراجعة: الحدود على الوش
    im = np.array(Image.open(ap).convert("RGB")); ys, xs = np.where(op > 0)
    y0, y1, x0, x1 = max(0, ys.min() - 60), ys.max() + 60, max(0, xs.min() - 80), xs.max() + 80
    up = 2 if (x1 - x0) < 900 else 1   # صورة المراجعة مكبّرة ×٢ بخطوط ناعمة (الفلتر كان بيشوف الخطوط مسنّنة على بق صغير)
    crop = cv2.resize(im[y0:y1, x0:x1], None, fx=up, fy=up, interpolation=cv2.INTER_CUBIC)
    for k, v in vis_ap.items(): cv2.polylines(crop, [np.int32((np.float32(v) - [x0, y0]) * up)], True, (255, 255, 255) if k < 30 else (255, 80, 80), 2, cv2.LINE_AA)
    chk = E + "ap_teeth_chk.jpg"; Image.fromarray(crop).save(chk, quality=92)
    return {"visible": sorted(vis_ap), "matched": common, "inliers": inl, "check": chk}


RETRACT_P = ("Same {man}, same studio photo, background and clothes: eyes gently closed, relaxed face, a black dental cheek-and-lip retractor in "
             "{his} mouth stretching the lips wide so both upper and lower teeth and gums are fully visible, front view. Realistic clinical photo.")


def retract(c):
    E = c.d + "/elements/"; f = E + "retract_face.png"
    if c.has("before_face_retracted"): Image.open(c.canon("before_face_retracted")).convert("RGB").save(f)   # صورة حقيقية من الطبيب
    elif not os.path.exists(f):
        from elements import nb, _he
        he, his, man = _he(c); nb(RETRACT_P.format(man=man, his=his), [c.canon("before_face")], f)
    F = cv2.imread(f); H, W = F.shape[:2]; hsv = cv2.cvtColor(F, cv2.COLOR_BGR2HSV)
    op = _open_from_landmarks(F)   # فتحة البق من نقط الوش: بتشتغل مع أي لون مبعد (شفاف/أبيض/إسود)
    if op is not None: return _retract_rest(c, E, F, hsv, op)
    # احتياطي: فتحة المبعد = بين حافتي الحلقتين السودا من جوه (المبعد الإسود بس)
    dark = (hsv[..., 2] < 55).astype(np.uint8); dark[:int(H * .5)] = 0
    n, lb, st, _ = cv2.connectedComponentsWithStats(dark); big = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 3000]
    ring = np.isin(lb, big).astype(np.uint8); cx = W // 2; ys = np.where(ring.any(1))[0]; pl, pr = [], []
    for y in range(ys.min(), ys.max()):
        L = np.where(ring[y, :cx])[0]; R = np.where(ring[y, cx:])[0]
        if len(L) and len(R): pl.append((L.max(), y)); pr.append((cx + R.min(), y))
    wid = np.array([r[0] - l[0] for l, r in zip(pl, pr)]); keep = wid > wid.max() * .6
    pl = [p for p, k in zip(pl, keep) if k]; pr = [p for p, k in zip(pr, keep) if k]
    op = np.zeros((H, W), np.uint8); cv2.fillPoly(op, [np.int32(pl + pr[::-1])], 255); op = cv2.erode(op, np.ones((7, 7), np.uint8))
    return _retract_rest(c, E, F, hsv, op)


OUTER_LIPS = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146]
def _open_from_landmarks(F):
    """فتحة البق = حدود الشفايف الخارجية (نقط الوش) — المبعد بيمطها، فالسنان واللثة كلها جواها مهما كان لون المبعد أو شكله.
    الشفايف نفسها مابتتحسبش سنان (السنان = فاتح وقليل التشبع جوه الفتحة)."""
    try:
        from derive import _lmk
        P = _lmk(cv2.cvtColor(F, cv2.COLOR_BGR2RGB))
    except Exception:
        return None
    H, W = F.shape[:2]; op = np.zeros((H, W), np.uint8); cv2.fillPoly(op, [np.int32(P[OUTER_LIPS])], 255)
    if op.sum() / 255 < H * W * .002: return None   # الفتحة صغيرة جدًا: النقط غلط
    k = max(3, int(np.sqrt(op.sum() / 255) * .06)) | 1
    return cv2.dilate(op, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))


def _retract_rest(c, E, F, hsv, op):
    H, W = F.shape[:2]; cv2.imwrite(E + "retract_open.png", op)
    tm = ((hsv[..., 2] > 140) & (hsv[..., 1] < 120) & (op > 0)).astype(np.uint8); tm = cv2.morphologyEx(tm, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    x, y, w, h = cv2.boundingRect(tm); pad = int(.08 * w); x, y = max(0, x - pad), max(0, y - pad); w, h = min(W - x, w + 2 * pad), min(H - y, h + 2 * pad)
    cv2.imwrite(E + "rcrop.png", F[y:y + h, x:x + w]); np.save(E + "retract_crop.npy", np.array([x, y]))
    cwd = os.getcwd(); os.chdir(S + "ana")
    try:
        from aimask import one
        one(E + "rcrop.png", E + "rcrop_teeth.png")
    finally: os.chdir(cwd)
    m = cv2.imread(E + "rcrop_teeth.png", 0) > 128; ys_, xs_ = np.where(m)
    box = np.array([x + xs_.min(), y + ys_.min(), x + xs_.max(), y + ys_.max()]); np.save(E + "retract_teeth_box.npy", box)
    v = F.copy(); cv2.rectangle(v, tuple(map(int, box[:2])), tuple(map(int, box[2:])), (0, 0, 255), 4); cv2.imwrite(E + "retract_chk.jpg", v)
    return {"box": box.tolist(), "check": E + "retract_chk.jpg"}


if __name__ == "__main__":
    from case import Case
    c = Case(sys.argv[1]); what = sys.argv[2] if len(sys.argv) > 2 else "smile_fit"
    print(json.dumps(smile_fit(c) if what == "smile_fit" else retract(c), default=str))
