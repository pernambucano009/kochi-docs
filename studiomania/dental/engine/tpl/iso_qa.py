"""فحص العزل الأوتوماتيكي (الفك العلوي المعزول على خلفية سودا) — بيلاقي العيوب لوحده من غير ما حد يشاور عليها، وبيصلّح الآمن منها.

بيشتغل على قناع العزل + الصورة + حدود السنان العلوية (في إحداثيات الصورة الأصلية: السنان رأسية، اللثة فوق).
كل فحص هنا اتعمل من عيب حقيقي العميل علّم عليه (كتالوج الأخطاء E274/E275):

  residue     حاجة باينة تحت نص السنان وبرا حدودها (شفة، ظل، سنة سفلية من الفراغ القاطع)   ← بتتشال
  island      جزيرة باينة مش متصلة بالفك                                                  ← بتتشال
  hole        خرم إسود جوه الفك (مقفول من كل ناحية)                                       ← بيتقفل لو الصورة الأصلية فيها لثة/سنة
  gum_gap     سنة مالهاش لثة فوقها (فراغ إسود فوق آخر سنة)                                ← بتتكمّل لو الصورة الأصلية فيها لثة
  dark_spot   بقعة غامقة جوه الجزء الظاهر (لثة أو سنة)                                    ← تقرير بس
  tooth_hole  سنة جزء منها ناقص أو غامق (شريحة طايرة / فراغ جوه السنة)                    ← تقرير بس

check() بترجّع (القناع بعد الإصلاح، لستة العيوب). كل عيب: نوعه، مكانه (x, y, w, h)، مساحته، واتصلح ولا لأ.
"""
import numpy as np, cv2

def _comps(mask, min_area):
    n, lb, st, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    return [(lb == i, tuple(int(v) for v in st[i, :4]), int(st[i, 4])) for i in range(1, n) if st[i, 4] >= min_area]

def _gumlike(lab):   # لثة: وردي/أحمر مش غامق
    return (lab[..., 1] > 138) & (lab[..., 0] > 60)

def _toothlike(lab):
    return (lab[..., 0] > 120) & (lab[..., 1] < 142)

def grow_keep(kp, img_rgb, steps):
    """السنة الحقيقية الباقية بتطلع شوية برا حدودها المرسومة (الحدود تقريبية): نكبّر الحماية جوه البكسلات اللي لونها سنة ومتصلة بيها."""
    lab = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2LAB).astype(np.int16); core = kp > 0
    if not core.any(): return core
    Lm = np.median(lab[..., 0][core]); Am = np.median(lab[..., 1][core])
    ok = (np.abs(lab[..., 0] - Lm) < 30) & (lab[..., 1] < Am + 6)   # لون السنة نفسها بالظبط تقريبًا (مش بطانة الخد الوردي-الرمادي جنبها)
    g = core.copy()
    for _ in range(int(steps)):
        g2 = (cv2.dilate(g.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & (ok | core)
        if (g2 == g).all(): break
        g = g2
    return g
def check(m, img_rgb, contours, repair=True, src_rgb=None, keep=(), old=()):
    """m: قناع 0..255 (uint8). img_rgb: الصورة اللي القناع هيتطبق عليها. contours: لستة حدود السنان العلوية الظاهرة (Nx2).
    src_rgb: الصورة الأصلية للإصلاح بالإضافة (لو None = img_rgb)."""
    H, W = m.shape; src_rgb = img_rgb if src_rgb is None else src_rgb
    lab = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2LAB).astype(np.int16); slab = cv2.cvtColor(src_rgb, cv2.COLOR_RGB2LAB).astype(np.int16)
    teeth = np.zeros((H, W), np.uint8); kp = np.zeros((H, W), np.uint8)
    for c in contours: cv2.fillPoly(teeth, [np.int32(np.round(c))], 255)
    for c in keep: cv2.fillPoly(kp, [np.int32(np.round(c))], 255)   # سنان حقيقية زي ما هي من صورتها (حدودها من نفس الصورة): ما تتقصش أبدًا
    kpd = cv2.dilate(grow_keep(kp, img_rgb, 15).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0 if kp.any() else kp > 0   # للحماية من القص بس
    teeth = np.maximum(teeth, kp); m_in = m.copy()   # فحوصات اللثة والبواقي على حدود السنة الحقيقية (مش منطقة الحماية)
    if not teeth.any(): return m, []
    allc = list(contours) + list(keep); hs = [np.ptp(c[:, 1]) for c in allc]; ws = [np.ptp(c[:, 0]) for c in allc]; hm = float(np.median(hs)); wm = float(np.median(ws))
    unit = max(1.0, hm / 100.0)                                     # المساحات بتتقاس بالنسبة لحجم السنة (مستقل عن دقة الصورة)
    A_MIN = int(25 * unit * unit)
    vis = m > 127; out = m.copy(); D = []
    cols = np.where(teeth.any(0))[0]; xs = np.arange(cols.min(), cols.max() + 1)
    tb = teeth[:, xs] > 0; has = tb.any(0)
    top = np.where(has, tb.argmax(0), np.nan).astype(np.float32); bot = np.where(has, H - 1 - tb[::-1].argmax(0), np.nan).astype(np.float32)
    ok = ~np.isnan(top); top = np.interp(xs, xs[ok], top[ok]); bot = np.interp(xs, xs[ok], bot[ok])
    mid_full = np.interp(np.arange(W), xs, (top + bot) / 2)
    below = np.arange(H)[:, None] > mid_full[None, :]
    teethd = cv2.dilate(teeth, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(5 * unit) | 1, int(5 * unit) | 1))) > 0

    # 1) residue: باين تحت نص السنان وبرا حدودها
    res = vis & below & ~teethd
    gumL = np.median(lab[..., 0][vis & ~teethd & ~below & _gumlike(lab)]) if (vis & ~teethd & ~below & _gumlike(lab)).any() else 140
    notgum = vis & ~teethd & ~_toothlike(lab) & ((lab[..., 0] < gumL - 30) | ~_gumlike(lab))   # برا السنان ومش لثة فاتحة (جوه البق/ظل/شفة)
    cut = np.zeros((H, W), bool)
    for blob, box, a in _comps(res, A_MIN):
        D.append({"type": "residue", "box": box, "area": a, "fixed": bool(repair)})
        if repair:   # البقايا بتكمّل لفوق (جوه البق باين من الفراغ بين السنان): نكبّر البقعة جوه البكسلات اللي مش سنة ومش لثة
            g = blob.copy()
            for _ in range(int(hm * .5)):
                g2 = (cv2.dilate(g.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & (notgum | blob)
                if (g2 == g).all(): break
                g = g2
            cut |= g
    if cut.any():   # حافة ناعمة (مش مربعات سودا)
        soft = cv2.GaussianBlur(cv2.dilate(cut.astype(np.uint8) * 255, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))).astype(np.float32), (0, 0), 1.6 * unit) / 255
        out = (out.astype(np.float32) * (1 - np.clip(soft, 0, 1))).astype(np.uint8)
    # 1ب) edge_residue: شفة/ظل دخلت *جوه* حدود السنة عند حافتها القاطعة (شريط بني تحت الناب): حزام الحافة في النص السفلي،
    # بكسلات أغمق بكتير من السنة نفسها أو حمرا، ومتصلة بالخلفية (مش تفاصيل جوه السنة)
    vis1 = out > 127; ext = ~vis1; edge_bad = np.zeros((H, W), bool)
    for c in contours:
        ck = np.zeros((H, W), np.uint8); cv2.fillPoly(ck, [np.int32(np.round(c))], 255)
        core = cv2.erode(ck, np.ones((int(11 * unit) | 1,) * 2, np.uint8)) > 0
        if core.sum() < A_MIN: continue
        Lm = np.median(lab[..., 0][core]); Am = np.median(lab[..., 1][core])
        band = (ck > 0) & ~(cv2.erode(ck, np.ones((int(13 * unit) | 1,) * 2, np.uint8)) > 0) & below
        edge_bad |= band & vis1 & ((lab[..., 0] < Lm - 45) | (lab[..., 1] > Am + 10))
    if edge_bad.any():
        n_, lb_ = cv2.connectedComponents((edge_bad | ext).astype(np.uint8), connectivity=8)
        outside_ids = set(np.unique(lb_[ext])) - {0}
        edge_bad &= np.isin(lb_, list(outside_ids)); edge_bad &= ~kpd
        cut2 = np.zeros((H, W), bool)
        for blob, box, a in _comps(edge_bad, max(4, A_MIN // 3)):
            D.append({"type": "edge_residue", "box": box, "area": a, "fixed": bool(repair)}); cut2 |= blob
        if repair and cut2.any():
            soft = cv2.GaussianBlur(cv2.dilate(cut2.astype(np.uint8) * 255, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))).astype(np.float32), (0, 0), 1.6 * unit) / 255
            out = (out.astype(np.float32) * (1 - np.clip(soft, 0, 1))).astype(np.uint8)
    if kp.any(): out[kpd] = np.maximum(out[kpd], m_in[kpd])   # السنان الحقيقية الباقية: أي قص عليها بيترجع
    # 2) island: جزيرة مش متصلة بالفك الأساسي
    vis2 = out > 127; n, lb, st, _ = cv2.connectedComponentsWithStats(vis2.astype(np.uint8), 8)
    if n > 2:
        main = 1 + int(np.argmax(st[1:, 4]))
        for i in range(1, n):
            if i != main and st[i, 4] >= A_MIN // 4:
                D.append({"type": "island", "box": tuple(int(v) for v in st[i, :4]), "area": int(st[i, 4]), "fixed": bool(repair)})
                if repair: out[lb == i] = 0
    # 3) hole: خرم مقفول جوه الفك
    vis2 = out > 127; inv = (~vis2).astype(np.uint8); n, lb, st, _ = cv2.connectedComponentsWithStats(inv, 4)
    border = set(np.unique(np.r_[lb[0], lb[-1], lb[:, 0], lb[:, -1]]))
    for i in range(1, n):
        if i in border or st[i, 4] < A_MIN // 2: continue
        blob = lb == i
        if below[blob].mean() > .5: continue   # فراغ طبيعي بين السنان عند الحافة القاطعة: مش عيب، وما يتقفلش
        fill = max((_gumlike(slab) | _toothlike(slab))[blob].mean(), (_gumlike(lab) | _toothlike(lab))[blob].mean()) > .6   # الفريم الحالي كمان (فراغ بيتقفل أثناء المورف: الصورة فيها سنة والقناع لسه إسود)
        D.append({"type": "hole", "box": tuple(int(v) for v in st[i, :4]), "area": int(st[i, 4]), "fixed": bool(repair and fill)})
        if repair and fill: out[blob] = 255
    # 4) gum_gap: كل عمود فيه سنة لازم يبقى فوقها لثة (٠٫١٥ من طول السنة على الأقل)
    vis2 = out > 127; need = int(max(3, hm * .15)); gap = np.zeros(len(xs), bool)
    for i, x in enumerate(xs):
        t = int(top[i]); y0 = max(0, t - need)
        if teeth[:, x].any() and t - y0 >= 2: gap[i] = vis2[y0:t, x].mean() < .5
    i = 0
    while i < len(xs):
        if not gap[i]: i += 1; continue
        j = i
        while j < len(xs) and gap[j]: j += 1
        if j - i >= max(4, wm * .2):
            x0, x1 = int(xs[i]), int(xs[j - 1]); y0 = int(max(0, min(top[i:j]) - hm * .6)); y1 = int(max(top[i:j]))
            # لثة الجيران: ارتفاعها في الأعمدة اللي جنب الفراغ
            fixed = False
            if repair:
                okc = [k for k in range(len(xs)) if not gap[k] and teeth[:, xs[k]].any()]
                if okc:
                    gh = []
                    for k in okc:
                        t = int(top[k]); col = vis2[:t, xs[k]]; n_ = 0
                        while n_ < len(col) and col[len(col) - 1 - n_]: n_ += 1
                        gh.append(n_)
                    gh = np.interp(np.arange(i, j), okc, gh); gh = np.minimum(gh, hm * .6)
                    reg = np.zeros((H, W), bool)
                    for k, g in zip(range(i, j), gh): reg[max(0, int(top[k] - g)):int(top[k]), xs[k]] = True
                    if _gumlike(slab)[reg].mean() > .5 or (slab[..., 1][reg] > 132).mean() > .6:   # الصورة الأصلية فيها لثة هناك (حتى لو في الضل)
                        # اللثة المتكمّلة لازم تلزق في اللثة الموجودة (مش شريط لوحده فوق سنة طرفية ← كان بيبان حتة طايرة)
                        gum_now = (out > 127) & ~(teeth > 0)
                        touch = (cv2.dilate(reg.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & gum_now & ~reg
                        if touch.sum() >= max(10, .25 * need * 2):
                            out[reg] = 255; fixed = True
            D.append({"type": "gum_gap", "box": (x0, y0, x1 - x0 + 1, y1 - y0 + 1), "area": int((x1 - x0 + 1) * need), "fixed": fixed})
        i = j
    # 5) dark_spot: بقعة غامقة جوه الجزء الظاهر (مش على الحافة الخارجية)
    vis2 = out > 127; core = cv2.erode(vis2.astype(np.uint8), np.ones((int(9 * unit) | 1,) * 2, np.uint8)) > 0
    Lmed_g = np.median(lab[..., 0][core & ~teethd]) if (core & ~teethd).any() else 120
    dark = core & (lab[..., 0] < min(45, Lmed_g - 60))
    for blob, box, a in _comps(dark, A_MIN):
        D.append({"type": "dark_spot", "box": box, "area": a, "fixed": False})
    # 6) tooth_hole: كل سنة لازم تبقى ظاهرة ولونها سنة تقريبًا كلها
    for c in allc:
        ck = np.zeros((H, W), np.uint8); cv2.fillPoly(ck, [np.int32(np.round(c))], 255); ck = cv2.erode(ck, np.ones((int(5 * unit) | 1,) * 2, np.uint8)) > 0
        if ck.sum() < A_MIN: continue
        Lm = np.median(lab[..., 0][ck]); badp = ck & (~vis2 | (lab[..., 0] < Lm - 70))
        frac = badp.sum() / ck.sum()
        big = _comps(badp, A_MIN)
        if frac > .06 and big:
            x, y, w, h = cv2.boundingRect(np.int32(np.round(c)))
            D.append({"type": "tooth_hole", "box": (x, y, w, h), "area": int(badp.sum()), "frac": round(float(frac), 3), "fixed": False})
    # 7) stale_tooth: سنة قديمة باينة جنب اللثة برا شكل السنة الجديدة (هلال بيج عند عنق السنة) — المورف لازم يدوّبها في اللثة
    # بنقارن بلون اللثة نفسها (بعيد شوية عن السنان): الهلال أفتح وأقل احمرار من اللثة، ولازق في السنة الجديدة
    vis2 = out > 127; dist = cv2.distanceTransform((teeth == 0).astype(np.uint8), cv2.DIST_L2, 3)
    gref = vis2 & ~below & (dist > 25 * unit) & (dist < 60 * unit)
    if gref.sum() > 50:
        gL, gA = np.median(lab[..., 0][gref]), np.median(lab[..., 1][gref])
        between = cv2.morphologyEx(teeth, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(17 * unit) | 1,) * 2)) > 0   # خط التلامس بين سنتين جنب بعض (لونه سنة طبيعي)
        stale = vis2 & ~below & ~between & (dist > 1.5) & (dist < 20 * unit) & (lab[..., 1] < gA - 14) & (lab[..., 0] > gL + 10)
        if len(old):   # مكان السنة القديمة اللي السنة الجديدة مش مغطياه: لازم يبقى لثة، مش مينا قديمة (حتى لو لونها قريب من اللثة)
            ob_ = np.zeros((H, W), np.uint8)
            for c in old: cv2.fillPoly(ob_, [np.int32(np.round(c))], 255)
            gone = (ob_ > 0) & ~(cv2.dilate(teeth, np.ones((5, 5), np.uint8)) > 0) & ~between & ~below & vis2
            # مقارنة باللثة القريبة (مش لون لثة واحد للفك كله): المينا القديمة أقل احمرار **وأفتح** من اللثة اللي جنبها.
            # (الضل عند جنب الناب أقل احمرار بس أغمق ← مش مينا). معايرة: هلال ١١ و١٢ في النسخة القديمة اتمسك، والنضيفة عدّت.
            gw = cv2.GaussianBlur(gref.astype(np.float32), (0, 0), 40 * unit) + 1e-3
            lA = cv2.GaussianBlur(np.where(gref, lab[..., 1], 0).astype(np.float32), (0, 0), 40 * unit) / gw
            lL = cv2.GaussianBlur(np.where(gref, lab[..., 0], 0).astype(np.float32), (0, 0), 40 * unit) / gw
            stale |= gone & (lab[..., 1] < lA - 9) & (lab[..., 0] > lL + 15)
    else: stale = np.zeros((H, W), bool)
    for blob, box, a in _comps(stale, A_MIN):
        D.append({"type": "stale_tooth", "box": box, "area": a, "fixed": False})
    # 8) keep_altered: السنة الباقية من القبل لازم تفضل زي صورتها بالظبط (أي لون اتغيّر عليها = حاجة اترسمت فوقها)
    if kp.any() and src_rgb is not img_rgb:
        core_k = cv2.erode(kp, np.ones((3, 3), np.uint8)) > 0
        diff = np.abs(lab - slab).sum(2) > 45
        bad = core_k & diff & vis2
        for blob, box, a in _comps(bad, max(4, A_MIN // 3)):
            D.append({"type": "keep_altered", "box": box, "area": a, "fixed": False})
    return out, D

def check_and_verify(m, img_rgb, contours, repair=True, src_rgb=None, rounds=2, keep=(), old=()):
    """يصلّح وبعدين يفحص تاني (لحد rounds مرات). أي عيب لسه موجود بعد الإصلاح بيرجع fixed=False (مايعديش ساكت)."""
    out, D = check(m, img_rgb, contours, repair=repair, src_rgb=src_rgb, keep=keep, old=old)
    if not repair: return out, D
    for _ in range(rounds - 1):
        out2, D2 = check(out, img_rgb, contours, repair=True, src_rgb=src_rgb, keep=keep, old=old)
        if not D2: break
        out = out2
    _, left = check(out, img_rgb, contours, repair=False, src_rgb=src_rgb, keep=keep, old=old)
    for d in left: d["fixed"] = False; d["after_repair"] = True
    return out, [d for d in D if d["fixed"]] + left
def draw(img_rgb, mask, defects, path, rotate=None):
    """صورة مراجعة: الفك المعزول وعليه مربعات العيوب (أحمر = اتساب، أخضر = اتصلح)."""
    a = mask.astype(np.float32)[..., None] / 255; v = (img_rgb * a + np.array([4, 4, 5]) * (1 - a)).astype(np.uint8)
    v = cv2.cvtColor(v, cv2.COLOR_RGB2BGR).copy()
    for d in defects:
        x, y, w, h = d["box"]; col = (0, 200, 0) if d["fixed"] else (0, 0, 255); pad = 6
        cv2.rectangle(v, (x - pad, y - pad), (x + w + pad, y + h + pad), col, 2)
        cv2.putText(v, d["type"], (x - pad, max(14, y - pad - 4)), cv2.FONT_HERSHEY_SIMPLEX, .55, col, 2)
    if rotate is not None: v = np.ascontiguousarray(np.rot90(v, rotate))
    cv2.imwrite(path, v)
