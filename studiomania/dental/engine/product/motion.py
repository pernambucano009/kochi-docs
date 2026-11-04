"""فحوصات الحركة بالأرقام (البلاي بوك Q5–Q8): بتقارن حركة الكاميرا عندنا بحركة الأصل في نفس اللحظة.

لكل كادرين ورا بعض (10/ث، بعيد عن القطعات) بنحسب الـoptical flow ونطلع منه حركة الكاميرا:
  زووم (scale) • لف (rotation) • تشويه (الجزء اللي مش زووم/لف/إزاحة: مط أو ميل)
Q5 motion_match  اللفة/الزووم عكس الأصل أو مش موجودين (E160 E161 E167 E33 E164 E165)
Q6 warp          الصورة بتتمط/تتشوه وهي بتلف أكتر من الأصل (E32)
Q7 flashes       تبديل قبل/بعد بفلاش رايح جاي أكتر من الأصل (E151)
Q8 sharp         لقطة السنان القريبة مش حادة (جودة الزووم) مقارنة بالأصل (E109 E162)
"""
import numpy as np, cv2

W = 180   # عرض صغير يكفي لحركة الكاميرا


def _g(f): return cv2.cvtColor(cv2.resize(f, (W, int(W * f.shape[0] / f.shape[1]))), cv2.COLOR_BGR2GRAY)


def cam_motion(a, b):
    """حركة الكاميرا بين كادرين: (لوج الزووم، اللف بالدرجات، التشويه، نسبة النقط اللي ماشية مع الكاميرا)."""
    ga, gb = _g(a), _g(b); H, Wd = ga.shape
    fl = cv2.calcOpticalFlowFarneback(ga, gb, None, .5, 3, 21, 3, 5, 1.1, 0)
    ys, xs = np.mgrid[8:H - 8:6, 8:Wd - 8:6]; u = fl[ys, xs, 0].ravel(); v = fl[ys, xs, 1].ravel()
    tex = cv2.Laplacian(ga, cv2.CV_32F)[ys, xs].ravel(); ok = np.abs(tex) > 4   # نقط فيها تفاصيل بس (الإسود/السادة flow بتاعه وهمي)
    if ok.sum() < 30: return None
    moving = float((np.hypot(u[ok], v[ok]) > .5).mean())   # حركة كاميرا = أغلب النقط بتتحرك (مش عنصر صغير ماشي في الكادر)
    if moving < .4: return 0.0, 0.0, 0.0, 1.0
    x = (xs.ravel() - Wd / 2)[ok] / Wd; y = (ys.ravel() - H / 2)[ok] / Wd; u, v = u[ok] / Wd, v[ok] / Wd
    one, zero = np.ones_like(x), np.zeros_like(x)
    # أفين كامل: u = a x + b y + tx ، v = c x + d y + ty
    A = np.vstack([np.c_[x, y, zero, zero, one, zero], np.c_[zero, zero, x, y, zero, one]]); rhs = np.r_[u, v]
    p, *_ = np.linalg.lstsq(A, rhs, rcond=None); a_, b_, c_, d_ = p[:4]
    res = np.abs(A @ p - rhs).reshape(2, -1).sum(0); inl = float((res < .004).mean())
    zoom = (a_ + d_) / 2; rot = np.degrees((c_ - b_) / 2); warp = abs(a_ - d_) / 2 + abs(b_ + c_) / 2
    return float(zoom), float(rot), float(warp), inl


def profile(fr, cuts, step=1):
    """[(t, zoom, rot, warp, inl)] لكل كادرين (بعيد عن القطعات بـ0.15ث)."""
    out = []
    for (t0, a), (t1, b) in zip(fr[::step], fr[step::step]):
        if any(t0 - .15 <= c <= t1 + .15 for c in cuts): continue
        m = cam_motion(a, b)
        if m: out.append((t1,) + m)
    return out


def _win(pr, t0, t1, k):
    v = [p[k] for p in pr if t0 <= p[0] < t1]
    return float(np.sum(v)) if len(v) >= 3 else 0.0


def motion_match(po, pr, T, win=1.0, slack=.5):
    """Q5: كل ثانية في الأصل فيها لفة/زووم واضح (لفة ≥ 6° أو زووم ≥ 12%) لازم يكون عندنا نفس الاتجاه
    في نفس الثانية ± نص ثانية. بيرجع [(t, نوع، الأصل، عندنا)]."""
    issues = []
    for t in np.arange(0, T - win + 1e-6, win / 2):
        for k, name, thr in ((2, "rot", 6.0), (1, "zoom", .12)):
            r = _win(pr, t, t + win, k)
            if abs(r) < thr: continue
            cand = [_win(po, t + s, t + s + win, k) for s in (-slack, -slack / 2, 0, slack / 2, slack)]
            best = max(cand, key=lambda o: o * np.sign(r))
            if best * np.sign(r) < abs(r) / 3:
                opp = -min(cand, key=lambda o: o * np.sign(r)) * np.sign(r)   # قد إيه بتاعنا رايح عكس
                kind = "عكس" if opp > max(abs(r) / 3, 10.0 if name == "rot" else .25) and best * np.sign(r) <= 0 else "ناقص"   # اتظبط: الغلط الحقيقي (a05/a09/a29 القديمة) عكسه 16–27°، وحركة الراس في الفيديو الحي ≤ 7°
                issues.append((round(float(t), 1), name, kind, round(r, 2), round(best, 2), round(float(opp), 2)))
    # دمج النوافذ المتداخلة
    out = []
    for i in issues:
        if out and out[-1][1] == i[1] and i[0] - out[-1][0] <= win: continue
        out.append(i)
    return out


def warp_issues(po, pr, thr=.006, mult=3.0):
    """Q6: تشويه (مط/ميل) لكادرات متتالية وهي بتتحرك، أكتر من أقصى تشويه في الأصل."""
    ref = np.percentile([p[3] for p in pr] or [0], 98)
    lim = max(thr, mult * ref); bad = [p for p in po if p[3] > lim]
    secs = {}
    for p in bad: secs.setdefault(int(p[0] * 2) / 2, []).append(p[3])
    return [(t, round(max(v), 4), round(lim, 4)) for t, v in sorted(secs.items()) if len(v) >= 2]


def _lum(f): return float(cv2.cvtColor(cv2.resize(f, (64, 114)), cv2.COLOR_BGR2LAB)[..., 0].mean())


def flashes(fr, cuts, win=1.0):
    """عدد مرات "رايح جاي" (قطعة وبعدها في أقل من ثانية قطعة ترجع لنفس الشكل) في كل ثانية."""
    by_t = {round(t, 2): f for t, f in fr}; ts = sorted(by_t)
    def near(t): return by_t[min(ts, key=lambda x: abs(x - t))]
    out = []
    for c1, c2 in zip(cuts, cuts[1:]):
        if c2 - c1 > win: continue
        a, b = near(c1 - .15), near(c2 + .15)
        d = np.abs(cv2.resize(a, (64, 114)).astype(np.int16) - cv2.resize(b, (64, 114)).astype(np.int16)).mean()
        if d < 12: out.append(round(c1, 1))   # رجعنا لنفس الكادر تقريبًا = فلاش
    return out


def flash_issues(fo, co, fr, cr):
    """Q7: فلاشات رايح جاي عندنا والأصل مافيهوش في نفس الثانية (±1ث)."""
    ro = flashes(fr, cr)
    return [t for t in flashes(fo, co) if not any(abs(t - r) <= 1.0 for r in ro)]


def sharp(f):
    """حدة الجزء اللي فيه تفاصيل في الكادر (مش الخلفية السادة): Laplacian على أعلى 20% تفاصيل."""
    g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY); lap = np.abs(cv2.Laplacian(g, cv2.CV_32F))
    e = cv2.GaussianBlur(lap, (0, 0), 6); m = e > np.percentile(e, 80)
    return float(lap[m].mean()) if m.any() else 0.0


def teethiness(f):
    """نسبة بكسلات لون السنان (فاتح، قليل التشبع، مايل للأصفر) — علشان نعرف إن اللقطة لقطة سنان قريبة."""
    hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV); h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    return float(((v > 150) & (s < 90) & ((h < 35) | (h > 170))).mean())


def sharp_issues(fo_hi, fr_hi, ratio=.45):
    """Q8: لقطة سنان قريبة (≥ 25% من الكادر سنان) حدتها أقل من 45% من حدة لقطات السنان القريبة في الأصل."""
    rs = [sharp(f) for t, f in fr_hi if teethiness(f) > .25]
    if not rs: rs = [sharp(f) for t, f in fr_hi]
    ref = float(np.median(rs)); out = {}
    for t, f in fo_hi:
        if teethiness(f) > .25:
            s = sharp(f)
            if s < ratio * ref: out.setdefault(int(t), []).append(s)
    return [(t, round(float(np.median(v)), 1), round(ref, 1)) for t, v in sorted(out.items()) if len(v) >= 2], round(ref, 1)


def shear(f, min_len=.22, tol=2.5):
    """Q6b تشويه ثابت: الصورة المعروضة حوافها (قدام خلفية سودا) مش زوايا قايمة = ممطوطة/مايلة (perspective/shear).
    اللف العادي بيخلي الحواف مايلة بس متعامدة. بيرجع أكبر انحراف عن 90° بين حافتين طوال، أو None."""
    g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY); H, Wd = g.shape
    m = (cv2.medianBlur(g, 3) > 3).astype(np.uint8) * 255; m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)); m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    e = cv2.Canny(m, 50, 150); e[:3] = 0; e[-3:] = 0; e[:, :3] = 0; e[:, -3:] = 0
    L = cv2.HoughLinesP(e, 1, np.pi / 360, 40, minLineLength=int(min_len * H), maxLineGap=6)
    if L is None or len(L) < 2: return None
    seg = []
    for x1, y1, x2, y2 in L.reshape(-1, 4):
        a = np.degrees(np.arctan2(y2 - y1, x2 - x1)) % 180
        if min(abs(a - 0), abs(a - 90), abs(a - 180)) < .7 and (min(x1, x2) < 6 or max(x1, x2) > Wd - 6 or min(y1, y2) < 6 or max(y1, y2) > H - 6): continue
        seg.append((a, (x1 + x2) / 2, (y1 + y2) / 2))
    worst = None
    for i in range(len(seg)):
        for j in range(i + 1, len(seg)):
            (a1, x1, y1), (a2, x2, y2) = seg[i], seg[j]
            d = abs(a1 - a2) % 180; d = min(d, 180 - d)
            if 45 < d < 135: dev = abs(d - 90)                     # حافتين متجاورين مش متعامدين = ميل (shear)
            else:                                                  # حافتين متقابلين مش متوازيين = perspective
                n = np.radians(a1 + 90); sep = abs((x2 - x1) * np.cos(n) + (y2 - y1) * np.sin(n))
                dev = d if sep > .3 * min(H, Wd) else 0
            if dev > tol and (worst is None or dev > worst): worst = dev
    return worst


def shear_issues(fo, fr, min_frames=3):
    """ثواني فيها 3 كادرات أو أكتر ممطوطة والأصل في نفس الثانية مش كده."""
    def at(frs, t): return min(frs, key=lambda x: abs(x[0] - t))[1]
    sec = {}
    for t, f in fo:
        s = shear(f)
        if s and not shear(at(fr, t)): sec.setdefault(int(t), []).append(s)
    return [(t, round(max(v), 1)) for t, v in sorted(sec.items()) if len(v) >= min_frames]
