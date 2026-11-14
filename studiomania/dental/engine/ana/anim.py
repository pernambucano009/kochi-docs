"""قالب «درس القياس / التحليل» متحرك: صورة الماكرو ملفوفة 90° (زي مرجع 40)، الخطوط تترسم سنة سنة، ثم المنتصف والنسب، ثم انتقال للبعد.
STYLE: neon (خطوط ملونة مضيئة) أو fine (أبيض رفيع + مسطرة)."""
import cv2, numpy as np, sys, subprocess, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from teethlib import analyze
STYLE = sys.argv[1] if __name__ == "__main__" else "fine"
FW, FH, FPS = 1080, 1920, 30; FD = (__import__("os").environ.get("DENTAL_FONTS") or __import__("os").path.join((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))), "..", "..", "fonts", ""))
NEON = {1: (0, 240, 255), 2: (255, 70, 200), 3: (120, 255, 90)}
FA = ImageFont.truetype(FD + "TY-Alexandria-800.ttf", 54); FA2 = ImageFont.truetype(FD + "TY-Alexandria-500.ttf", 40)
FN = ImageFont.truetype(FD + ("TY-Outfit-800.ttf" if STYLE == "neon" else "TY-InstrumentSerif-Italic.ttf"), 46 if STYLE == "neon" else 58)
ease = lambda x: 0 if x <= 0 else 1 if x >= 1 else 1 - (1 - x) ** 3
import os as _os2
_AN = (_os2.environ["CASE_DIR"] + "/ana/") if _os2.environ.get("CASE_DIR") else ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/ana/")
AIMASK = {"macro.jpg": _AN + "gm_before.png", "front.jpg": _AN + "gm_after.png"}   # قناع (سنان + لثة علوية) لكل حالة
def iso_mask_ai(bgr, masks, ai_path, strict=False):
    """العزل الدقيق: قناع الذكاء الاصطناعي (سنان + لثة علوية)، بناخد بس الجزء المتصل بالسنان العلوية، ونضيف حدود السنان نفسها."""
    H, W = bgr.shape[:2]; teeth = np.zeros((H, W), np.uint8)
    for m in masks: teeth = np.maximum(teeth, m)
    ai = cv2.resize(cv2.imread(ai_path, 0), (W, H)); b = (ai > 128).astype(np.uint8)
    b = cv2.morphologyEx(b, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)); n, lb = cv2.connectedComponents(np.maximum(b, (teeth > 0).astype(np.uint8)))
    ids = set(np.unique(lb[teeth > 0])) - {0}; keep = np.isin(lb, list(ids)).astype(np.uint8) * 255
    # تحت الحافة القاطعة مفيش غير السنان — عمود عمود (مش خط واحد عند أوطى سنة): الناب والضاحك حافتهم أعلى من القواطع،
    # فالشفة السفلية/أطراف السنان السفلية اللي تحتهم كانت بتفضل (بقع بنية ووردية تحت الناب وبين الرباعية والناب)
    cols0 = np.where(teeth.any(0))[0]; xs0 = np.arange(cols0.min(), cols0.max() + 1)
    bots0 = np.array([np.where(teeth[:, x] > 0)[0].max() if teeth[:, x].any() else np.nan for x in xs0], np.float32)
    okb = ~np.isnan(bots0); bots0 = np.interp(np.arange(W), xs0[okb], bots0[okb])   # بين السنان: خط بين حافتيهم؛ برا آخر سنة: حافة آخر سنة
    hm0 = np.mean([np.ptp(np.where(m > 0)[0]) for m in masks]); below = np.zeros_like(keep)
    for x in range(W): below[min(H, int(bots0[x] + hm0 * .04) + 1):, x] = 255
    keep[below > 0] = np.minimum(keep, teeth)[below > 0]
    # اللثة مسموح بيها فوق خط اللثة بس (+ الحليمات بين السنان لحد ~٠٫٤ من طول السنة): أي حاجة وردية أوطى من كده بين السنان
    # (شفة/لسان باين من الفراغات عند الحافة القاطعة) بتتشال — كانت بتفضل شرايط وردية بين الرباعية والناب وبين الناب والضاحك
    tops0 = np.array([np.where(teeth[:, x] > 0)[0].min() if teeth[:, x].any() else np.nan for x in xs0], np.float32)
    ok0 = ~np.isnan(tops0); win0 = max(5, int(np.median([np.ptp(np.where(m > 0)[1]) for m in masks])) | 1)
    xg = np.arange(max(0, cols0.min() - win0), min(W, cols0.max() + win0 + 1))   # برا آخر سنة بنص عرض سنة كمان (مش قطع رأسي عند آخر عمود = درج)
    tops0 = np.interp(xg, xs0[ok0], tops0[ok0]); env0 = np.convolve(np.pad(tops0, win0 // 2, mode="edge"), np.ones(win0) / win0, "valid")
    gum_ok = np.zeros_like(keep)
    for i, x in enumerate(xg): gum_ok[:min(H, int(env0[i] + hm0 * .4)), x] = 255
    keep = np.maximum(np.minimum(keep, gum_ok), teeth)
    if strict and not __import__("os").environ.get("ISO_NOGUMFILL"):   # سنة طرفية من غير لثة فوقها في قناع الموديل (لثة في الضل عند آخر القوس): كان بيطلع فراغ إسود كبير فوق الضاحك.
        # بنكمّل اللثة فوقها بارتفاع اللثة عند السنان اللي جنبها (مش أكتر من ٠٫٦ من طول السنة)
        tt = np.array([np.where(teeth[:, x] > 0)[0].min() if teeth[:, x].any() else -1 for x in xs0])
        gh = np.full(len(xs0), np.nan, np.float32)
        for i, x in enumerate(xs0):
            if tt[i] < 0: continue
            col = keep[:tt[i], x] > 0; n = 0
            while n < len(col) and col[len(col) - 1 - n]: n += 1
            if n > hm0 * .15: gh[i] = n
        okg = ~np.isnan(gh)
        if okg.any() and (~okg & (tt >= 0)).any():
            ghi = np.minimum(np.interp(np.arange(len(xs0)), np.where(okg)[0], gh[okg]), hm0 * .6)
            for i, x in enumerate(xs0):
                if not okg[i] and tt[i] >= 0: keep[max(0, int(tt[i] - ghi[i])):tt[i], x] = 255
    if not strict:   # صورة البعد (بمبعد إسود): عزل الذكاء الاصطناعي لوحده طلع ممتاز
        keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)); aik = cv2.dilate(b * 255, np.ones((9, 9), np.uint8))
        o = np.maximum(np.minimum(keep, aik), np.minimum(teeth, aik))
        if not __import__("os").environ.get("ISO_NOSPIKE"):   # نفس تنضيف حافة اللثة بتاع القبل (باطن الشفة الغامق، نتوءات، أطراف القوس، خيوط):
            o = gum_round_ends(gum_despike(o, teeth, win0, hm0, bgr), teeth, win0)   # srv بعد: قناع SAM طلع لجوه الشفة العليا في لفّة
            sm_ = cv2.GaussianBlur(o.astype(np.float32), (0, 0), max(4, hm0 * .04)); o = np.maximum(np.where(sm_ > 127, 255, 0).astype(np.uint8), np.minimum(teeth, aik))   # حافة ناعمة (من غير تسنين)
            n_, lb_ = cv2.connectedComponents((o > 0).astype(np.uint8)); ids_ = set(np.unique(lb_[teeth > 0])) - {0}   # حتت طايرة مش متصلة بالسنان ← تتشال
            o = np.where(np.isin(lb_, list(ids_)), o, 0).astype(np.uint8)
            o = fill_small_holes(o, hm0 * win0 * .25)
        return cv2.GaussianBlur(o, (0, 0), 1.6)
    # 1) اللثة بارتفاع محدد فوق كل سنة (مش لحد الشفايف)، ومفيش حاجة برا عرض السنان
    hmean = np.mean([np.ptp(np.where(m > 0)[0]) for m in masks]); band = np.zeros_like(keep)
    cols = np.where(teeth.any(0))[0]; x0, x1 = cols.min(), cols.max(); xs = np.arange(x0, x1 + 1)
    tops = np.array([np.where(teeth[:, x] > 0)[0].min() if teeth[:, x].any() else np.nan for x in xs], np.float32)
    ok = ~np.isnan(tops); tops = np.interp(xs, xs[ok], tops[ok])
    # خط لثة ناعم: أعلى نقطة (أصغر y) في شباك بعرض سنة، وبعدين تنعيم
    win = int(np.median([np.ptp(np.where(m > 0)[1]) for m in masks]))
    env = np.array([tops[max(0, i - win):i + win].min() for i in range(len(tops))])
    k = max(5, win) | 1; env = np.convolve(np.pad(env, k // 2, mode="edge"), np.ones(k) / k, "valid")
    for i, x in enumerate(xs): band[max(0, int(env[i] - hmean * .7)):H, x] = 255
    keep = np.minimum(keep, band)
    out = np.maximum(keep, teeth)
    # 2) حافة ناعمة: تنعيم قوي للشكل وبعدين قصّه تاني (يشيل التسنين)
    sm = cv2.GaussianBlur(out.astype(np.float32), (0, 0), 14); out2 = (sm > 127).astype(np.uint8) * 255
    out2 = np.maximum(out2, teeth)   # السنان نفسها ما تتقصش أبدًا
    if not __import__("os").environ.get("ISO_NOSPIKE"): out2 = gum_despike(out2, teeth, win, hmean, bgr)
    if not __import__("os").environ.get("ISO_NOROUND"): out2 = gum_round_ends(out2, teeth, win)
    n, lb = cv2.connectedComponents((out2 > 0).astype(np.uint8)); ids = set(np.unique(lb[teeth > 0])) - {0}; out2 = np.isin(lb, list(ids)).astype(np.uint8) * 255
    return cv2.GaussianBlur(out2, (0, 0), 2.0)
def fill_small_holes(mask, max_area):
    """خروم صغيرة محاطة باللثة/السنان من كل ناحية (عند تلاقي سنتين باللثة): في الفيديو كانت بتطلع نقط سودا في اللثة (srv بعد ث14/24).
    بتتملي من الصورة نفسها (القناع بس اللي بيتقفل)، والفراغات الكبيرة/المفتوحة على البرّا مابتتلمسش."""
    inv = (mask <= 127).astype(np.uint8); n, lb, st, _ = cv2.connectedComponentsWithStats(inv)
    H, W = mask.shape; out = mask.copy()
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if a < max_area and x > 0 and y > 0 and x + w < W and y + h < H: out[lb == i] = 255
    return out
def gum_round_ends(mask, teeth, tw):
    """طرفين القوس: شريط اللثة كان بيخلص بقطع رأسي مستقيم (في الفيديو بعد اللف = قطع أفقي مستقيم آخر القوس) أو درج مسنن.
    آخر ٠٫٧ عرض سنة من كل طرف: سُمك اللثة فوق السنان بيقل على شكل ربع دايرة لحد الصفر عند الطرف. السنان نفسها ما بتتقصش."""
    H, W = mask.shape; tt = teeth > 0; cols = np.where((mask > 127).any(0))[0]
    if len(cols) < 20 or not tt.any(): return mask
    tc = np.where(tt.any(0))[0]; R = max(10, int(tw * .7)); out = mask.copy()
    def ttop(x):
        x = int(np.clip(x, tc.min(), tc.max()))
        while not tt[:, x].any(): x += 1 if x < (tc.min() + tc.max()) / 2 else -1
        return np.argmax(tt[:, x])
    for side in (0, 1):
        xe = cols.min() if side == 0 else cols.max(); sgn = 1 if side == 0 else -1
        xr = xe + sgn * R; mt = np.where(mask[:, xr] > 127)[0]
        if not len(mt): continue
        G = max(0, ttop(xr) - mt.min())   # سُمك اللثة عند بداية التدوير
        for d in range(R + 1):
            x = xe + sgn * d
            if not (0 <= x < W): continue
            f = np.sqrt(max(0., 1 - ((R - d) / R) ** 2)); y0 = ttop(x) - int(G * f)
            col = out[:, x].copy(); col[:max(0, y0)] = 0
            if tt[:, x].any(): col[tt[:, x]] = np.maximum(col[tt[:, x]], mask[:, x][tt[:, x]])
            else: col[:] = 0 if f < .2 else col
            out[:, x] = col
    sm = cv2.GaussianBlur(out.astype(np.float32), (0, 0), 3); out = np.where(sm > 127, 255, 0).astype(np.uint8)
    out = np.maximum(np.minimum(out, mask), np.where(tt, mask, 0)).astype(np.uint8)
    # لسان/خيوط لثة رفيعة طالعة لبرا (شفة ليفية عند طرف القوس، حتة لثة متعلقة بعد القص): فتح بشكل بيضاوي بعرض ٠٫٢ سنة.
    # السنان بتتضاف قبل الفتح علشان الحليمات اللي بين السنان (رفيعة بس محصورة بين سنتين) ماتتشالش
    k = max(9, int(tw * .2)) | 1; ttd = cv2.dilate(tt.astype(np.uint8) * 255, np.ones((7, 7), np.uint8))
    op = cv2.morphologyEx(np.maximum(out, ttd), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    return np.maximum(np.minimum(op, out), np.where(tt, out, 0)).astype(np.uint8)
def _cut_dark_rim(mask, teeth, th, bgr):
    """شريط باطن الشفة (بنفسجي/رمادي غامق) بين اللثة والشفة العليا: قناع اللثة ساعات بياخده.
    بنشيل أي حتة فوق السنان أغمق بكتير من اللثة نفسها (L أقل من وسيط اللثة بـ 28) وأقل حمار منها، ومتصلة بالبرّا. السنان والحليمات اللي بينها مش بتتلمس."""
    H, W = mask.shape; lab = cv2.cvtColor(cv2.GaussianBlur(bgr, (0, 0), 2), cv2.COLOR_BGR2LAB).astype(np.int16); L, A = lab[..., 0], lab[..., 1]
    tt = teeth > 0; gum = (mask > 127) & ~cv2.dilate(tt.astype(np.uint8), np.ones((15, 15), np.uint8)).astype(bool)
    if gum.sum() < 500: return mask
    Lg = np.median(L[gum]); Ag = np.median(A[gum]); cols = np.where(tt.any(0))[0]
    if not len(cols): return mask
    xs = np.arange(cols.min(), cols.max() + 1); tops = np.array([np.argmax(tt[:, x]) if tt[:, x].any() else np.nan for x in xs], np.float32)
    ok = ~np.isnan(tops); tops = np.interp(np.arange(W), xs[ok], tops[ok])
    above = np.arange(H)[:, None] < (tops[None, :] - th * .15)   # بعيد عن السنان (الحليمات بين السنان مش بتتلمس)
    edge = np.zeros(W, bool); edge[(mask[:4] > 127).any(0)] = True   # اللثة واصلة لحد طرف الصورة = مفيش شفة فوقها (صورة ماكرو): مانقصش
    edge = np.convolve(edge.astype(np.float32), np.ones(41), "same") > 0
    # أو أغمق من اللثة بـ 40+ حتى لو أحمر زيها (باطن الشفة تحت المبعد: test1 بعد L 87-101 vs لثة 145) — لثة الضل في full1 كانت أغمق بـ 37 بس
    dark = (mask > 127) & above & ((L < Lg - 28) & (A < Ag - 2) | (L < Lg - 40)) & ~edge[None, :]   # غامق *وأقل حمار* من اللثة: باطن الشفة رمادي/بنفسجي. لثة في الضل بتفضل حمرا (اتقاس: لثة ظل a=164 vs لثة 163؛ شفة 145 vs لثة 150)
    if not dark.any(): return mask
    ext = (mask <= 127).astype(np.uint8)
    n, lb = cv2.connectedComponents((dark | (ext > 0)).astype(np.uint8))
    outl = set(np.unique(lb[ext > 0])) - {0}
    rm = dark & np.isin(lb, list(outl))
    rm = cv2.morphologyEx(rm.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0   # مش نقط صغيرة
    out = mask.copy(); out[rm] = 0
    n, lb = cv2.connectedComponents((out > 127).astype(np.uint8)); ids = set(np.unique(lb[tt])) - {0}   # حتت اتفصلت = تتشال
    return np.where(np.isin(lb, list(ids)), out, 0).astype(np.uint8)
def gum_despike(mask, teeth, tw, th, bgr=None):
    """حافة اللثة العليا لازم تكون خط ناعم: قناع اللثة ساعات بيطلع لجوه الشفة العليا في نتوءات (شوك على حافة اللثة في الفيديو).
    بنقيس أول صف في القناع لكل عمود، ونحسب خط مرجعي = الوسيط في شباك بعرض سنتين، وأي حتة طالعة فوقه بأكتر من ١٢٪ من طول السنة بتتقص (نتوءات test1 كانت ١٧٪؛ ٦٪ كان بيسنن حافة اللثة العادية).
    بيقص بس، عمره ما بيضيف، وعمره ما بيقرب من السنان."""
    H, W = mask.shape
    if bgr is not None: mask = _cut_dark_rim(mask, teeth, th, bgr)
    cols = np.where((mask > 0).any(0))[0]
    if len(cols) < 10: return mask
    top = np.array([np.argmax(mask[:, x] > 0) for x in cols], np.float32)
    k = max(9, int(tw * 2)) | 1; pad = np.pad(top, k // 2, mode="edge")
    base = np.array([np.median(pad[i:i + k]) for i in range(len(top))], np.float32)
    k2 = max(5, int(tw * .6)) | 1; base = np.convolve(np.pad(base, k2 // 2, mode="edge"), np.ones(k2) / k2, "valid")
    bad = (top < base - th * .12) & (top > 3)   # عمود واصل لطرف الصورة مش نتوء
    if not bad.any(): return mask
    bad = np.convolve(bad.astype(np.float32), np.ones(k2), "same") > 0   # النتوء كله لحد رجله (مش بس طرفه) → مايفضلش درج
    out = mask.copy(); tt = teeth > 0
    for i, x in enumerate(cols):
        if bad[i] and top[i] < base[i]:
            t0 = np.argmax(tt[:, x]) if tt[:, x].any() else H
            out[:max(0, min(int(base[i]), t0 - 2)), x] = 0
    sm = cv2.GaussianBlur(out.astype(np.float32), (0, 0), max(4, tw * .06))   # تنعيم مكان القص بس
    out2 = np.where(sm > 127, 255, 0).astype(np.uint8); out2 = np.minimum(out2, mask)   # التنعيم مايضيفش حاجة مكانتش موجودة
    return np.maximum(out2, np.minimum(mask, (tt * 255).astype(np.uint8)))
def iso_mask(bgr, masks, band=.45, src=None):
    import os
    if src and os.path.basename(src) in AIMASK and os.path.exists(AIMASK[os.path.basename(src)]): return iso_mask_ai(bgr, masks, AIMASK[os.path.basename(src)], strict=os.path.basename(src) == "macro.jpg")
    return iso_mask_old(bgr, masks, band)
def iso_mask_old(bgr, masks, band=.45):
    """عزل دقيق: السنان نفسها + اللثة اللي فوقها بس (حسب لون اللثة)، ومن غير جوه البق ولا اللسان ولا الفراغات القاطعة."""
    H, W = bgr.shape[:2]; teeth = np.zeros((H, W), np.uint8)
    for m in masks: teeth = np.maximum(teeth, m)
    ys, xs = np.where(teeth > 0); hmean = np.mean([np.ptp(np.where(m > 0)[0]) for m in masks])
    top = np.full(W, -1); bot = np.full(W, -1)
    for x in range(xs.min(), xs.max() + 1):
        col = np.where(teeth[:, x] > 0)[0]
        if len(col): top[x], bot[x] = col.min(), col.max()
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.int16); gumc = (lab[..., 1] > 140) & (lab[..., 0] > 105)   # لون لثة (وردي ومش غامق)
    band_m = np.zeros((H, W), np.uint8); bh = int(hmean * band)
    for x in np.where(top >= 0)[0]:
        y0 = max(0, top[x] - bh); y1 = min(H, top[x] + int(hmean * .3)); band_m[y0:y1, x] = 255
    gum = ((band_m > 0) & gumc).astype(np.uint8) * 255
    gum = cv2.morphologyEx(gum, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)); gum = cv2.morphologyEx(gum, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lb, st, _ = cv2.connectedComponentsWithStats(np.maximum(gum, teeth)); keep = np.zeros_like(gum)
    big = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]) if n > 1 else 0
    keep[lb == big] = 255   # اللثة اللي متصلة بالسنان بس
    # حافة لثة ناعمة: أعلى نقطة لثة في كل عمود، متنعّمة، وبنملا منها لحد السنة
    gtop = np.full(W, -1.0)
    for x in np.where(top >= 0)[0]:
        col = np.where(keep[:top[x] + 1, x] > 0)[0]; gtop[x] = col.min() if len(col) else top[x]
    v = np.where(gtop >= 0)[0]; g = gtop[v]; k = max(5, int(hmean * .35)) | 1
    gs = np.convolve(np.pad(g, k // 2, mode="edge"), np.ones(k) / k, "valid"); gs = np.maximum(gs, g - hmean * .08)   # ما نطلعش برا اللثة الحقيقية كتير
    fill = np.zeros((H, W), np.uint8)
    for x, y in zip(v, gs): fill[int(y):top[x] + int(hmean * .3), x] = 255
    fill = (fill > 0) & (((fill > 0) & (keep > 0)) | (teeth > 0) | (gumc & (fill > 0)))
    out = np.maximum(teeth, fill.astype(np.uint8) * 255); out = cv2.morphologyEx(out, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    return cv2.GaussianBlur(out, (0, 0), 2.2)
class Shot:
    def __init__(s, src, mask, cache):
        im, teeth = analyze(src, mask, cache); s.H, s.W = im.shape[:2]
        s.img = Image.fromarray(cv2.cvtColor(im, cv2.COLOR_BGR2RGB)).transpose(Image.Transpose.ROTATE_270)   # فوق → يمين
        s.teeth_all = teeth
        up = [t for t in teeth if t["fdi"] < 30]; s.six = sorted([t for t in up if t["fdi"] % 10 <= 3], key=lambda t: (t["fdi"] % 10, t["cx"]))
        s.rest = [t for t in teeth if t not in s.six]
        a = [t for t in s.six if t["fdi"] == 11][0]; b = [t for t in s.six if t["fdi"] == 21][0]; s.mid = (a["x"] + a["w"] + b["x"]) / 2
        x0 = min(t["x"] for t in s.six); x1 = max(t["x"] + t["w"] for t in s.six); span = (x1 - x0) * 1.45
        inc = np.mean([t["y"] + t["h"] for t in s.six])
        s.ch = span; s.cw = span * FW / FH; s.cX = s.H - 1 - (inc - s.cw * .05); s.cY = (x0 + x1) / 2   # مركز القص في الصورة الملفوفة
        masks = []
        for t in up:   # العزل بكل السنان العلوية الظاهرة (مش الست الأمامية بس): كانت 24/25 بتتقص ويفضل منها حتة متعلقة (test1 بعد)
            mm = np.zeros((s.H, s.W), np.uint8); cv2.fillPoly(mm, [t["c"].astype(np.int32)], 255); masks.append(mm)
        s.iso = Image.fromarray(iso_mask(im, masks, src=src)).transpose(Image.Transpose.ROTATE_270)
        tot = sum(t["w"] for t in s.six); s.pct = {id(t): 100 * t["w"] / tot for t in s.six}
        wv = {k: np.mean([t["w"] for t in s.six if t["fdi"] % 10 == k]) for k in (1, 2, 3)}; s.gold = f"1 : {wv[2] / wv[1]:.2f} : {wv[3] / wv[1]:.2f}"
        def ept(t):
            c = t["c"]; band = c[np.abs(c[:, 0] - t["cx"]) < t["w"] * .25]; return band[np.argmax(band[:, 1])]
        P = np.array([ept(t) for t in up]); s.arc = np.polyfit(P[:, 0], P[:, 1], 2); s.arcx = (P[:, 0].min(), P[:, 0].max())
    def crop(s, z, iso=0.0):
        """منطقة القص (cx, cy, cw, ch) في الصورة الملفوفة — نفسها للصورة (base) وللرسومات (tf)."""
        cw, ch = s.cw / z, s.ch / z; iw, ih = s.img.size
        cx = min(max(s.cX, cw / 2), iw - cw / 2) if cw < iw else iw / 2; cy = min(max(s.cY, ch / 2), ih - ch / 2) if ch < ih else ih / 2
        s.cX, s.cY = cx, cy   # منطقة القص جوه الصورة دايمًا (من غير شريط إسود)
        ar = s.arch_rows() if iso > 0 else None
        if ar:   # الفك المعزول: حد الكادر فوق وتحت = نهاية الفك الحقيقية (من غير لثة ممدودة ولا سنان مخترعة) — E457/E456
            e0, e1 = ar; eh = e1 - e0
            if ch > eh: ch = eh; cw = ch * s.cw / s.ch   # قرّب لحد ما الفك يملا الطول
            cy = min(max(cy, e0 + ch / 2), e1 - ch / 2)
            cx = min(max(cx, cw / 2), iw - cw / 2) if cw < iw else iw / 2
        s._last_iso = iso; return cx, cy, cw, ch
    def tf(s, x, y, z):   # من إحداثيات الصورة الأصلية → إحداثيات الفريم (نفس قص آخر base)
        X, Y = s.H - 1 - y, x; cx, cy, cw, ch = s.crop(z, getattr(s, "_last_iso", 0.0))
        return ((X - (cx - cw / 2)) * FW / cw, (Y - (cy - ch / 2)) * FH / ch)
    def iso_full(s):
        """قناع العزل + لثة المريض الحقيقية جنب كل سنة (من الصورة نفسها، بنفس عرض شريط اللثة في النص).
        العزل كان بيقص اللثة لشريحة رفيعة جنب البريمولارز فكانت بتبان إسود (طلب الطبيب: من غير اختراع — دي لثة موجودة في الصورة)."""
        k_ = getattr(s, "_if_src", None)
        if k_ is not None and k_[0] is s.iso and k_[1] is s.img: return s._if   # مقارنة بالكائن نفسه مش id() — الـ id بيتعاد استخدامه لصورة جديدة فكان بياخد قناع كادر تاني (فك بيختفي كادر: a06 16.5/18.5 — E459)
        mk = np.asarray(s.iso.convert("L")); m = mk > 127; hsv = cv2.cvtColor(np.asarray(s.img.convert("RGB")), cv2.COLOR_RGB2HSV)
        h, sa, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
        gumc = ((h > 155) | (h < 6)) & (sa > 35) & (sa < 175) & (v > 100)
        tooth = m & (v > 120) & (sa < 90) & ~gumc
        H_, W_ = m.shape; xs_ = np.arange(W_)[None, :]
        has_t = tooth.sum(1) > 6
        lt = np.where(has_t, W_ - 1 - np.argmax(tooth[:, ::-1], axis=1), -1)
        mr = np.where(m.any(1), W_ - 1 - np.argmax(m[:, ::-1], axis=1), -1)
        wb = (mr - lt)[has_t & (mr - lt > 60)]
        if len(wb) < 20: s._if = s.iso; s._if_src = (s.iso, s.img); return s._if
        w_b = float(np.median(wb))
        ty = np.where(has_t)[0]; rows_ok = np.zeros(H_, bool); rows_ok[ty.min():ty.max() + 1] = True
        lts = np.interp(np.arange(H_), ty, lt[ty])   # حافة السنان ناحية اللثة (ناعمة بين الصفوف)
        add = gumc & rows_ok[:, None] & (xs_ > lts[:, None] - 4) & (xs_ <= lts[:, None] + w_b)
        add = cv2.morphologyEx(add.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        n_, lab = cv2.connectedComponents(np.maximum(add, m.astype(np.uint8)))
        keep = np.isin(lab, np.unique(lab[m])) & (lab > 0)   # متصل بالفك بس (مش شفة بعيدة)
        # الإضافة لازم تبقى شريط متصل بحافة اللثة وحافته ناعمة: لون «وردي» لوحده كان بياخد حتت من الشفة ورا اللثة ويقصّها بحد مستقيم
        # ← بقع لثة مربّعة وبينها إسود على حافة الفك (فيديو المكالمة الأولى a03: 0–25ث). طول الإضافة في كل صف = الجزء المتصل من
        # حافة القناع، وبعدين وسيط + تنعيم رأسي، فالصف اللي فيه خرم بياخد طول جيرانه والحتة السايبة بتتشال.
        ad = keep & (add > 0) & ~m; ext = np.zeros(H_, np.float32)
        for y in np.where(ad.any(1) & (mr >= 0))[0]:
            x0_ = int(mr[y]) + 1; run = ad[y, x0_:x0_ + int(w_b) + 8]
            if not len(run): continue
            st_ = int(np.argmax(run)) if run.any() else len(run)
            if st_ > 3: continue   # مش لازقة في حافة اللثة
            nz_ = np.where(~run[st_:])[0]; ext[y] = st_ + (int(nz_[0]) if len(nz_) else len(run) - st_)
        raw_ = cv2.dilate(np.clip(ext, 0, 250).astype(np.uint8)[:, None], np.ones((15, 1), np.uint8))[:, 0]   # خرم أطول من ١٥ صف = مفيش لثة هناك فعلًا (مايتملاش من الجيران)
        ext = np.minimum(cv2.medianBlur(np.clip(ext, 0, 250).astype(np.uint8)[:, None], 31)[:, 0], raw_).astype(np.float32)
        ext = cv2.GaussianBlur(ext[:, None], (1, 0), sigmaX=1, sigmaY=8)[:, 0]; ext[ext < max(12, .3 * w_b)] = 0   # شريحة رفيعة (أقل من تلت عرض اللثة) بتبان خط/رقعة رمادي على الحافة مش لثة
        band_ = (mr[:, None] >= 0) & (xs_ > mr[:, None] - 2) & (xs_ <= mr[:, None] + ext[:, None]) & (ext[:, None] > 0)
        full = np.maximum(mk, (cv2.GaussianBlur(band_.astype(np.float32), (0, 0), 2) * 255).astype(np.uint8))
        s._if = Image.fromarray(full); s._if_src = (s.iso, s.img); return s._if
    def arch_rows(s):
        """أول وآخر صف فيه سنة **ولثة حقيقية** جنبها (جوه قناع العزل) في الصورة الملفوفة. حد الكادر فوق وتحت بيقف هنا:
        بعدها اللثة الحقيقية بتخلص (جنب آخر بريمولارز) فكان بيبان إسود — مفيش امتداد ولا اختراع، الكادر بيقف عند آخر لثة."""
        k_ = getattr(s, "_ar_src", None)
        if not (k_ is not None and k_[0] is s.iso and k_[1] is s.img):
            m = np.asarray(s.iso_full().convert("L")) > 127; hsv = cv2.cvtColor(np.asarray(s.img.convert("RGB")), cv2.COLOR_RGB2HSV)
            pink = m & (hsv[..., 0] > 150) & (hsv[..., 1] > 40) & (hsv[..., 2] > 70)
            tooth = m & (hsv[..., 2] > 120) & (hsv[..., 1] < 90) & ~pink
            W_ = m.shape[1]; xs_ = np.arange(W_)[None, :]
            last_t = np.where(tooth.any(1), W_ - 1 - np.argmax(tooth[:, ::-1], axis=1), -1)[:, None]
            pr_ = (pink & (xs_ > last_t)).sum(1); med_ = np.median(pr_[pr_ > 12]) if (pr_ > 12).sum() > 20 else 12
            gum = pr_ > max(12, .45 * med_)   # لثة **جنب** السنان بعرض حقيقي (≥ 45% من عرض شريط اللثة) — الشريحة الرفيعة عند الأطراف مش كفاية (كانت بتسيب إسود في الركن)
            gum = cv2.morphologyEx(gum.astype(np.uint8)[:, None], cv2.MORPH_CLOSE, np.ones((25, 1), np.uint8))[:, 0] > 0   # فجوات صغيرة بين السنان مش نهاية
            r = np.where(gum)[0]
            if not len(r): r = np.where(m.sum(1) > max(8, m.shape[1] * .01))[0]
            s._ar = (int(r.min()), int(r.max())) if len(r) else None; s._ar_src = (s.iso, s.img)
        return s._ar
    def base(s, z, iso=0.0):
        cx, cy, cw, ch = s.crop(z, iso)
        box = (int(cx - cw / 2), int(cy - ch / 2), int(cx + cw / 2), int(cy + ch / 2))
        im = s.img.crop(box).resize((FW, FH), Image.BICUBIC)
        if iso > 0:   # كل حاجة غير الست سنان واللثة بتسودّ (زي الأصل)
            mk = s.iso_full().crop(box).resize((FW, FH), Image.BICUBIC).point(lambda v: int(255 - iso * (255 - v) * .96))
            im = Image.composite(im, Image.new("RGB", im.size, (4, 4, 5)), mk)
        return im
def neon_style(): return STYLE == "neon"
PHI = (1 + 5 ** .5) / 2
def spiral(d, x0, y0, w, h, p, flip, A):
    """حلزون ذهبي مظبوط: نقص مربعات (فوق، يمين، تحت، شمال) من المستطيل، وفي كل مربع ربع دايرة متصلة باللي قبلها."""
    x, y, W_, H_ = x0, y0, w, h; segs = []
    for k in range(8):
        o = k % 4; sd = min(W_, H_)
        if o == 0: sq = (x, y, x + sd, y + sd); c = (x, y + sd); ang = (270, 360); y += sd; H_ -= sd
        elif o == 1: sq = (x + W_ - sd, y, x + W_, y + sd); c = (x + W_ - sd, y); ang = (0, 90); W_ -= sd
        elif o == 2: sq = (x, y + H_ - sd, x + sd, y + H_); c = (x + sd, y + H_ - sd); ang = (90, 180); H_ -= sd
        else: sq = (x, y, x + sd, y + sd); c = (x + sd, y + sd); ang = (180, 270); x += sd; W_ -= sd
        segs.append((sq, c, sd, ang))
    n = len(segs); fy = lambda v: 2 * y0 + h - v
    for k, (sq, c, sd, (a0, a1)) in enumerate(segs):
        q = max(0., min(1., p * n - k))
        if q <= 0: break
        if flip: sq = (sq[0], fy(sq[3]), sq[2], fy(sq[1])); c = (c[0], fy(c[1])); a0, a1 = 360 - a1, 360 - a0
        d.rectangle(sq, outline=(255, 255, 255, A(.45 * q)), width=1)
        bb = (c[0] - sd, c[1] - sd, c[0] + sd, c[1] + sd)
        if flip: d.arc(bb, a1 - (a1 - a0) * q, a1, fill=(255, 255, 255, A(.9)), width=2)
        else: d.arc(bb, a0, a0 + (a1 - a0) * q, fill=(255, 255, 255, A(.9)), width=2)
def partial(pts, p):
    n = max(2, int(len(pts) * p)); return pts[:n]
def render(sh, t, z, plan, fade=1.0):
    """plan: أزمنة البداية لكل طبقة (نسبية لـ t)"""
    fr = sh.base(z, 0 if neon_style() else 1.0).convert("RGBA"); ov = Image.new("RGBA", fr.size); d = ImageDraw.Draw(ov)   # معزول من أول كادر: التدرج من الصورة الكاملة كان بيبيّن السنان السفلية والشفايف غامقة لجزء من الثانية (a07 12.9، a06 19.1)
    gl = Image.new("RGBA", fr.size); g = ImageDraw.Draw(gl); A = lambda a: int(255 * a * fade)
    neon = STYLE == "neon"
    # 1) حدود السنان: الثنايا ثم الرباعيات ثم الأنياب
    for i, tt in enumerate(sh.six):
        p = ease((t - plan["lines"] - i * plan["stagger"]) / plan["draw"])
        if p <= 0: continue
        pts = [sh.tf(x, y, z) for x, y in tt["c"][::2]] + [sh.tf(*tt["c"][0], z)]; pts = partial(pts, p)
        col = NEON[tt["fdi"] % 10] if neon else (255, 255, 255)
        if neon: g.line(pts, fill=col + (A(1),), width=22); d.line(pts, fill=col + (A(1),), width=6)
        else: d.line(pts, fill=col + (A(.95),), width=3)
    pr = ease((t - plan["lines"] - 6 * plan["stagger"]) / .8)
    if pr > 0 and neon:
        for tt in sh.rest:
            pts = [sh.tf(x, y, z) for x, y in tt["c"][::3]] + [sh.tf(*tt["c"][0], z)]
            d.line(pts, fill=(255, 255, 255, A(.35 * pr)), width=2)
    # 2) خط المنتصف وخطوط نقط التلامس (أفقية في الصورة الملفوفة) لحد المسطرة
    pm = ease((t - plan["mid"]) / .7)
    if pm > 0:
        ruler = FW - 70
        edges = sorted(set([round(tt["x"]) for tt in sh.six] + [round(tt["x"] + tt["w"]) for tt in sh.six]))
        for ex in edges:
            fx0, fy = sh.tf(ex, max(tt["y"] + tt["h"] for tt in sh.six) + 30, z); x_end = fx0 + (ruler - fx0) * pm
            if neon: d.line([(fx0, fy), (x_end, fy)], fill=(255, 255, 255, A(.55)), width=2)
            else:
                for xx in range(int(fx0), int(x_end), 14): d.line([(xx, fy), (min(xx + 7, x_end), fy)], fill=(255, 255, 255, A(.8)), width=2)
        mx, my = sh.tf(sh.mid, 0, z); mfx = 40 + (FW - 80) * pm
        d.line([(40, my), (mfx, my)], fill=(255, 255, 255, A(1)), width=4 if neon else 2)
        if not neon:   # مسطرة مدرّجة على جنب اللثة زي الأصل
            for k, yy in enumerate(range(160, FH - 160, 12)):
                L = 26 if k % 10 == 0 else 14 if k % 5 == 0 else 8
                if (yy - 160) / (FH - 320) <= pm: d.line([(FW - 40 - L, yy), (FW - 40, yy)], fill=(255, 255, 255, A(.75)), width=2)
            d.line([(FW - 40, 160), (FW - 40, 160 + (FH - 320) * pm)], fill=(255, 255, 255, A(.75)), width=2)
    ps = ease((t - plan["mid"] - .3) / 1.6)
    if ps > 0 and not neon:
        mx, my = sh.tf(sh.mid, 0, z); xi = min(sh.tf(tt["x"], tt["y"] + tt["h"], z)[0] for tt in sh.six) - 30
        L = max(sh.tf(tt["x"] + tt["w"], 0, z)[1] for tt in sh.six) - my; R = my - min(sh.tf(tt["x"], 0, z)[1] for tt in sh.six)
        for (hh, fl) in ((L, False), (R, True)):
            ww = min(xi - 60, hh / PHI); hh = ww * PHI   # مستطيل ذهبي بالظبط
            y0 = my if not fl else my - hh
            if ww > 80: spiral(d, xi - ww, y0, ww, hh, ps, fl, A)
    # 3) النسب
    for i, tt in enumerate(sorted(sh.six, key=lambda q: q["fdi"] % 10)):
        pp = ease((t - plan["pct"] - i * .12) / .35)
        if pp <= 0: continue
        cx, cy = sh.tf(tt["cx"], tt["y"] + tt["h"] * .45, z); txt = f"{sh.pct[id(tt)]:.1f}%" if not neon else f"{sh.pct[id(tt)]:.0f}%"
        col = NEON[tt["fdi"] % 10] if neon else (255, 255, 255)
        sz = .7 + .3 * pp; f2 = FN.font_variant(size=max(66, int(FN.size * sz * 1.4)))   # أرقام كبيرة واضحة
        bx = d.textbbox((0, 0), txt, font=f2, anchor="mm", stroke_width=3); hw, hh_ = (bx[2] - bx[0]) / 2 + 12, (bx[3] - bx[1]) / 2 + 12
        Wd, Hd = d.im.size; cx = min(max(cx, hw), Wd - hw); cy = min(max(cy, hh_), Hd - hh_)   # الرقم دايمًا جوه الكادر (كان بيتقص عند الحافة لأول/آخر سنة: E450 a31)
        d.text((cx, cy), txt, font=f2, fill=col + (A(pp),), anchor="mm", stroke_width=3, stroke_fill=(0, 0, 0, A(.6 * pp)))
    # 4) قوس الابتسامة
    pa = ease((t - plan["arc"]) / .8)
    if pa > 0:
        xs = np.linspace(sh.arcx[0], sh.arcx[1], 60); pts = [sh.tf(x, np.polyval(sh.arc, x) + 20, z) for x in xs]
        pts = partial(pts, pa); col = (255, 215, 120) if neon else (255, 255, 255)
        if neon: g.line(pts, fill=col + (A(1),), width=16)
        d.line(pts, fill=col + (A(.95),), width=5 if neon else 2)
    # 5) العناوين (معتدلة)
    pt = ease((t - plan["title"]) / .5)
    if pt > 0:
        d.rounded_rectangle((FW / 2 - 230, 70, FW / 2 + 230, 160), 45, fill=(0, 0, 0, A(.45 * pt)))
        d.text((FW / 2, 115), plan["label"], font=FA, fill=(255, 255, 255, A(pt)), anchor="mm", direction="rtl")
    pg = ease((t - plan["gold"]) / .5)
    if pg > 0:
        y = FH - 170; d.rounded_rectangle((90, y - 70, FW - 90, y + 75), 30, fill=(0, 0, 0, A(.5 * pg)))
        d.text((FW / 2, y - 28), "الثنية : الرباعية : الناب", font=FA2, fill=(255, 255, 255, A(pg)), anchor="mm", direction="rtl")
        d.text((FW / 2, y + 28), sh.gold, font=FA2.font_variant(size=44), fill=(255, 220, 140, A(pg)), anchor="mm")
    if neon: fr = Image.alpha_composite(fr, gl.filter(ImageFilter.GaussianBlur(9)))
    return Image.alpha_composite(fr, ov).convert("RGB")
if __name__ == "__main__":
    OUT, MUSIC, MOFF = sys.argv[2], sys.argv[3], float(sys.argv[4])
    C = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/case1/")
    B = Shot(C + "before/macro.jpg", "ai_before.png", "lab_before.json"); Af = Shot(C + "after/front.jpg", "ai_after.png", "lab_after.json")
    PB = dict(lines=.8, stagger=.32, draw=.9, mid=3.5, pct=4.3, arc=5.2, gold=5.8, title=.3, label="قبل")
    PA = dict(lines=.9, stagger=.18, draw=.6, mid=2.4, pct=2.9, arc=3.5, gold=3.9, title=.1, label="بعد")
    T_SW = 7.4; DUR = 14.0
    def frame(t):
        if t < T_SW:
            im = render(B, t, 1.0 + .05 * t / T_SW, PB)
            if t > T_SW - .25: im = Image.blend(im, Image.new("RGB", im.size, "white"), (t - (T_SW - .25)) / .25)
            return im
        u = t - T_SW; fade = 1 - ease((u - 5.0) / .8)
        im = render(Af, u, 1.08 - .06 * min(1, u / 6.6), PA, fade=max(fade, 0) if u < 5.8 else 0)
        if u < .3: im = Image.blend(Image.new("RGB", im.size, "white"), im, u / .3)
        return im
    if "--still" in sys.argv:
        for tt in (2.0, 6.5, 7.4 + 4.5, 13.5): frame(tt).save(f"st_{STYLE}_{tt}.jpg")
        raise SystemExit
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{FW}x{FH}", "-r", str(FPS), "-i", "-", "-ss", str(MOFF), "-i", MUSIC,
           "-filter_complex", f"[1:a]atrim=0:{DUR},asetpts=PTS-STARTPTS,afade=t=in:d=0.4,afade=t=out:st={DUR - 1.2}:d=1.2,loudnorm=I=-14:TP=-1.5[a]", "-map", "0:v", "-map", "[a]",
           "-c:a", "aac", "-b:a", "192k", "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-t", str(DUR), OUT]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(int(DUR * FPS)): p.stdin.write(frame(i / FPS).tobytes())
    p.stdin.close(); p.wait(); print("done", OUT)

