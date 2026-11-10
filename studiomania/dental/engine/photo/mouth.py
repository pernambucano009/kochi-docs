"""فتحة البق (السنان + جوه البق) وزواياها — من غير ما نحتاج الوش كله (الصور القريبة مافيهاش عيون)."""
import os, sys, cv2, numpy as np
from PIL import Image
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "/"
sys.path.insert(0, S + "tools")


def load(p):
    from PIL import ImageOps
    return np.array(ImageOps.exif_transpose(Image.open(p)).convert("RGB"))


def face_mouth_box(a):
    """لو الوش باين: مربع حوالين البق بنقط الوش. لو لأ: None."""
    try:
        from derive import _lmk
        P = _lmk(a)
    except Exception:
        return None
    x0, y0 = P[[61, 291, 0, 17]].min(0); x1, y1 = P[[61, 291, 0, 17]].max(0); w = x1 - x0
    return int(max(0, x0 - w * .3)), int(max(0, y0 - w * .3)), int(min(a.shape[1], x1 + w * .3)), int(min(a.shape[0], y1 + w * .3))


OPEN_SCORE = [0.0]


def opening(a):
    """فتحة البق = المنطقة اللي جوه حلقة الشفايف (الشفايف أحمر من الجلد والسنان)، بتبتدي من السنان."""
    h, w = a.shape[:2]; k = 900 / max(h, w); sm = cv2.resize(a, (int(w * k), int(h * k)), interpolation=cv2.INTER_AREA)
    H, Wd = sm.shape[:2]
    lab = cv2.cvtColor(sm, cv2.COLOR_RGB2LAB).astype(np.float32); L, A = lab[..., 0], lab[..., 1]
    c = A[H // 4:3 * H // 4, Wd // 6:5 * Wd // 6]
    thr, _ = cv2.threshold(np.clip(c, 0, 255).astype(np.uint8), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    lip = (A > thr).astype(np.uint8) * 255
    lip = cv2.morphologyEx(lip, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    lip = cv2.morphologyEx(lip, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    teeth = (L > np.percentile(L, 97) * .75) & (A < thr - 4)
    dark = L < np.percentile(L, 8) + 6
    inside = (lip == 0).astype(np.uint8)
    n, lb, st, cen = cv2.connectedComponentsWithStats(inside, connectivity=4)
    best, bs = 0, -1
    for i in range(1, n):
        x, y, ww, hh, ar = st[i]
        if ar < H * Wd * .01: continue
        t = teeth[lb == i].mean(); edge = (x == 0) + (y == 0) + (x + ww >= Wd) + (y + hh >= H)
        sc = t * ar / (1 + 3 * edge)
        if sc > bs: best, bs = i, sc
    OPEN_SCORE[0] = 0.0
    if best:
        x, y, ww, hh, ar = st[best]; edge = (x == 0) + (y == 0) + (x + ww >= Wd) + (y + hh >= H)
        OPEN_SCORE[0] = float(teeth[lb == best].mean()) * min(ww / max(hh, 1), 4) / (1 + 2 * edge)
    mk = (lb == best).astype(np.uint8) * 255
    # الحلقة ممكن تكون مفتوحة عند الزوايا (بشرة غامقة/دقن) فالقناع يسرّب للجلد: نحصره حوالين غلاف السنان اللي جواه
    comp = lb == best
    tz = cv2.morphologyEx((teeth & comp).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    nt, lt, stt, _ = cv2.connectedComponentsWithStats(tz)
    if nt > 1:
        big = 1 + int(np.argmax(stt[1:, 4])); tz = (lt == big).astype(np.uint8)   # صف السنان = أكبر حتة فاتحة (الجلد الفاتح حتت لوحدها)
        hull = cv2.convexHull(np.column_stack(np.where(tz))[:, ::-1].astype(np.int32))
        hm = np.zeros_like(mk); cv2.fillPoly(hm, [hull], 255)
        hm = cv2.dilate(hm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(Wd * .03) | 1, int(Wd * .015) | 1)))
        core = comp & (hm > 0)
        # الضلمة اللي في أركان البق (الممر بين السنان والخد) لازقة في الصف ← تتضاف
        dk = (comp & dark).astype(np.uint8); nd, ld = cv2.connectedComponents(dk)
        touch = set(np.unique(ld[cv2.dilate(core.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0])) - {0}
        add = np.isin(ld, list(touch)) & (np.abs(np.arange(H)[:, None] - np.where(core)[0].mean()) < (np.ptp(np.where(core)[0]) + 1) * .8)
        mk = ((core | add) * 255).astype(np.uint8)
    mk = cv2.morphologyEx(mk, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    cs, _ = cv2.findContours(mk, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); cv2.drawContours(mk, cs, -1, 255, -1)
    return cv2.resize(mk, (w, h), interpolation=cv2.INTER_LINEAR) > 127


def corners(mk):
    """زاويتين البق = أبعد نقطتين يمين وشمال في الفتحة (متوسط الصفوف في آخر ١٪ من العرض)."""
    ys, xs = np.where(mk); x0, x1 = xs.min(), xs.max(); band = (x1 - x0) * .01
    l = np.array([x0, ys[xs <= x0 + band].mean()]); r = np.array([x1, ys[xs >= x1 - band].mean()])
    return l, r, np.array([xs.mean(), ys.mean()])


INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]


def analyze(p):
    """الوش باين ← زوايا البق الداخلية من نقط الوش (78، 308). صورة قريبة ← من حلقة الشفايف."""
    a = load(p)
    try:
        from derive import _lmk
        P = _lmk(a)
    except Exception:
        P = None
    if P is not None:
        mk = np.zeros(a.shape[:2], np.uint8); cv2.fillPoly(mk, [P[INNER].astype(np.int32)], 255); mk = mk > 0
        return dict(img=a, mask=mk, l=P[78].astype(np.float64), r=P[308].astype(np.float64), c=P[INNER].mean(0), from_face=True)
    best = None
    for k in (0, 1, 2, 3):   # صورة البق ممكن تكون متلفّة: نجرب الأربع اتجاهات — فتحة عريضة مليانة سنان، ونصها تحت خط الزاويتين (شكل الابتسامة)
        ak = np.ascontiguousarray(np.rot90(a, k)); mk = opening(ak); sc = OPEN_SCORE[0]
        if mk.any():
            l_, r_, c_ = corners(mk); sc *= 1.0 if c_[1] > (l_[1] + r_[1]) / 2 else .3
        if best is None or sc > best[0]: best = (sc, ak, mk, k)
    sc, a, mk, k = best
    l, r, c = corners(mk)
    return dict(img=a, mask=mk, l=l, r=r, c=c, from_face=False, rot=k * 90, score=round(sc, 3))


if __name__ == "__main__":
    for p in sys.argv[1:]:
        R = analyze(p); a = R["img"].copy(); a[R["mask"]] = (a[R["mask"]] * .5 + np.array([0, 255, 0]) * .5).astype(np.uint8)
        for q in (R["l"], R["r"], R["c"]): cv2.circle(a, tuple(int(v) for v in q), max(6, a.shape[1] // 150), (255, 0, 0), -1)
        out = S + "photo/dbg_" + os.path.basename(p).rsplit(".", 1)[0] + ".jpg"; Image.fromarray(a).save(out); print(out, R["l"].round(), R["r"].round(), R["from_face"])
