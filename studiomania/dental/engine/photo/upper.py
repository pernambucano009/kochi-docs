"""عزل فك واحد على أسود (E463) — p02 و p04 وأي قالب «ريتراكتد على أسود».
صورة مبعّد فيها الفكين (مش على كونتراستور) ← الفك المطلوب بس (سنان+لثة) على أسود + انعكاس خفيف تحت أطراف السنان زي سطح الكونتراستور.
- السنان: SAM (نقط موجبة على سنان الفك المطلوب، سالبة على الفك التاني، ومربع فتحة المبعّد).
- اللثة والشفايف وكل اللي فوق السنان: بيفضلوا زي ما هم (E465) — بنشيل بس اللي تحت أطراف السنان من ناحية البق.
- مفيش أي تعديل على السنان؛ الانعكاس نسخة مقلوبة شفافة من نفس البكسلات.
- الفك اللي تحت = نفس الشغل على الصورة مقلوبة.
"""
import os, sys, numpy as np, cv2
HERE = os.path.dirname(os.path.abspath(__file__))
for p in (os.path.join(os.path.dirname(HERE), "ana"), HERE): sys.path.insert(0, p) if p not in sys.path else None
import lib
WARN = []; QV = []   # فحوص أوتوماتيك (Q25/Q26) بتطلع في نتيجة القالب


def upper_end(mk):
    """لكل عمود: آخر صف في أول حتة سنان من فوق (حافة الأسنان العليا). بيرجع (yend، فيه فك تاني باين؟)."""
    H, W = mk.shape; ys, xs = np.where(mk)
    if len(xs) < 50: return None, False
    x0, x1 = np.percentile(xs, 2), np.percentile(xs, 98); h = np.ptp(ys); gap = max(4, int(h * .03))
    ye = np.full(W, -1.0); lower = 0; cols = 0
    for x in range(int(x0), int(x1)):
        c = np.where(mk[:, x])[0]
        if len(c) < 3: continue
        cols += 1; br = np.where(np.diff(c) > gap)[0]
        if len(br): ye[x] = c[br[0]]; lower += (len(c) - br[0] - 1) > h * .04
        else: ye[x] = c[-1]
    ok = ye >= 0
    if ok.sum() < 10: return None, False
    xi = np.arange(W); ye = np.interp(xi, xi[ok], ye[ok])
    k = max(5, int(W * .02)); pad = np.pad(ye, k, mode="edge")
    ye = np.array([np.median(pad[i:i + 2 * k + 1]) for i in range(W)])
    ye = cv2.blur(ye.astype(np.float32).reshape(1, -1), (max(3, int(W * .006)), 1)).ravel()
    return ye, lower > cols * .25


def needs_isolation(a):
    """الفك التاني باين (يعني مش متصورة على كونتراستور أسود) → نعزل."""
    _, lower = upper_end(lib.teeth_mask(a)); return lower


def _pts(m, n):
    dt = cv2.distanceTransform(m.astype(np.uint8), cv2.DIST_L2, 5); ys, xs = np.where(dt > dt.max() * .5)
    if len(xs) == 0: return []
    o = np.argsort(xs); idx = np.linspace(0, len(xs) - 1, n).astype(int)
    return [(float(xs[o][i]), float(ys[o][i])) for i in idx]


def _upper_mask(a):
    mk = lib.teeth_mask(a); ye, _ = upper_end(mk)
    if ye is None: raise lib.PhotoError("NO_TEETH: مش لاقي السنان في صورة المبعّد")
    H, W = mk.shape; yy = np.arange(H)[:, None]
    up = mk & (yy <= ye[None, :]); lo = mk & (yy > ye[None, :] + 5)
    lab = cv2.cvtColor(a, cv2.COLOR_RGB2LAB); L = lab[..., 0]; bright = L > 45
    ys, xs = np.where(up); yt = max(0, int(ys.min() - np.ptp(ys) * 1.2))
    cols = np.where(bright[yt:int(np.median(ye))].mean(0) > .5)[0]
    box = [int(cols.min()), yt, int(cols.max()), float(np.percentile(ye[cols], 90)) + 10]
    try:
        import sam21
        E = sam21.embed(a); m, sc = sam21.masks_from_points(E, _pts(up, 6), _pts(lo, 4), box); teeth = (m > .5) | up
    except Exception:
        teeth = up
    teeth &= yy <= (ye[None, :] + np.ptp(ys) * .15)
    # E465: اللثة والشفايف واللي فوقهم بيفضلوا زي ما هم في الصورة — بنشيل بس اللي تحت أطراف السنان (جوه البق + الفك التاني).
    # أطراف السنان: قناع SAM + بنكمّل لتحت طول ما البكسل لون سنة (الحافة الشفافة) عشان مانقصش الـ incisal edge.
    ys_, _ = np.where(teeth); th = max(10, np.ptp(ys_))
    tooth_col = (L > 105) & (np.hypot(lab[..., 1].astype(np.float32) - 128, lab[..., 2].astype(np.float32) - 128) < 28)
    teeth = cv2.dilate(teeth.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    yb = np.full(W, -1.0)
    for x in range(W):
        c = np.where(teeth[:, x])[0]
        if not len(c): continue
        y = c[-1]; lim = min(H - 1, y + int(th * .06))
        while y + 1 <= lim and tooth_col[y + 1, x]: y += 1
        yb[x] = y + 1
    ok = yb >= 0; xi = np.arange(W)
    xs_ok = xi[ok]
    # برا آخر سنة يمين/شمال: نفس مستوى آخر سنة (ركن البق)
    yb = np.interp(xi, xs_ok, yb[ok])
    # قناع ناقص في نص سنة (SAM مسك جزء منها) كان بيعمل «قطع» رأسي في السنة: أعلى حافة في شباك ~ سدس عرض سنة
    k = max(3, int(th * .15)) | 1
    yb = cv2.dilate(yb.astype(np.float32).reshape(1, -1), np.ones((1, k), np.uint8)).ravel()
    # السنان الخلفية اللي SAM مامسكهاش (في الضل، أغمق): نكمّل لتحت طول ما البكسل لون سنة حتى لو غامق شوية (E470)،
    # ونعدّي فراغ ٢ بكسل (لمعة/خط)، عشان أطراف 14/15/24/25 ماتتقصش
    Cm = np.hypot(lab[..., 1].astype(np.float32) - 128, lab[..., 2].astype(np.float32) - 128)
    tooth_dim = (L > 70) & (Cm < 32)
    def _ext(x, y, lim, M):
        while y + 1 <= lim:
            if M[y + 1, x]: y += 1
            elif y + 3 <= lim and M[y + 2, x] and M[y + 3, x]: y += 3
            else: break
        return y
    for x in range(W):
        y = int(yb[x]); yb[x] = _ext(x, y, min(H - 1, y + int(th * .5)), tooth_dim)
    # عمود واحد نازل لوحده (لمعة/حاجة بلون سنة تحت) كان بيعمل خط رأسي في القص والانعكاس: حد أقصى = الوسيط المحلي + ١٢٪ سنة
    kk = max(5, int(th * .6)) | 1; pad_ = np.pad(yb, kk // 2, mode="edge")
    med = np.array([np.median(pad_[i:i + kk]) for i in range(W)])
    yb = np.minimum(yb, med + th * .12)
    # شوك رفيعة في قناع SAM (عمود أو اتنين نازلين تحت السنة) كانت بتسيب خط رأسي تحت السنان: نشيلها بفتح أفقي
    tclean = cv2.morphologyEx(teeth.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 0
    m = (yy <= yb[None, :]) | tclean
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((1, 7), np.uint8)) > 0
    # E474: أي حاجة نازلة تحت خط أطراف السنان اللي جنبها (شوكة من قناع SAM عرضها أكتر من الفتح) بتتقص: حد = وسيط محلي + ١.٥٪ سنة
    kk2 = max(5, int(th * .5)) | 1; pb = np.pad(yb, kk2 // 2, mode="edge")
    medb = np.array([np.median(pb[i:i + kk2]) for i in range(W)])
    cap = np.minimum(yb, medb + th * .015 + 2)
    m &= yy <= cap[None, :]
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((1, 21), np.uint8)) > 0   # بقايا نتوءات رفيعة
    yb = np.where(m.any(0), H - 1 - np.argmax(m[::-1], 0), cap).astype(float)
    # Q25 (E465/E470): طرف سنة اتقص؟ لون سنة لازق تحت خط القص — على عرض القوس كله (مش بس أعمدة SAM)
    cols = np.where(teeth.any(0))[0]; x0, x1 = cols.min(), cols.max(); pad = int((x1 - x0) * .12)
    band = np.zeros_like(m)
    for x in range(max(0, x0 - pad), min(W, x1 + pad), 2):
        y = int(yb[x]); band[y + 1:min(H, y + 4), x] = True
    cut = float((tooth_dim & band).sum() / max(1, band.sum()))
    QV.append(round(cut, 3))
    if cut > .12: WARN.append(f"Q25 INCISAL_CUT: {cut:.0%} من خط القص تحته لون سنة — ممكن طرف سنة اتقص")
    return m, teeth, yb


def isolate(a, arch="upper", refl=.5, depth=.6):   # انعكاس الكونتراستور (E471: كان باهت قوي فماكانش باين)
    """بيرجع (صورة الفك على أسود + انعكاس، قناع السنان)."""
    if arch == "lower": a = a[::-1].copy()
    m, teeth, yb = _upper_mask(a); H, W = m.shape; yy = np.arange(H)[:, None]
    soft = cv2.GaussianBlur(m.astype(np.float32), (0, 0), .8)[..., None]
    up = (a * soft).astype(np.uint8)
    ys, _ = np.where(teeth); th = max(10, np.ptp(ys) * depth)
    d = yy - yb[None, :]; my = np.broadcast_to(yb[None, :] - d, (H, W)).astype(np.float32)
    mx = np.broadcast_to(np.arange(W, dtype=np.float32)[None, :], (H, W)).astype(np.float32)
    r = cv2.remap(cv2.GaussianBlur(up, (0, 0), 1.5), mx, my, cv2.INTER_LINEAR, borderValue=0)
    al = np.where((d > 0) & (d < th), refl * (1 - d / th) ** 2, 0)[..., None]
    out = np.clip(up.astype(np.float32) + r * al, 0, 255).astype(np.uint8)
    if arch == "lower": out, teeth = out[::-1].copy(), teeth[::-1].copy()
    return out, teeth
