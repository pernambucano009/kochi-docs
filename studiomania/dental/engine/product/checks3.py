"""فحوصات بالأرقام لأخطاء جولة المعرض 11 (البلاي بوك references/qa.md Q16–Q20). من غير موديل ذكاء اصطناعي.

Q16 blend_gaps     فراغ إسود يمين اللثة في كادر **مخلوط** (الفك بيدوب مع الوش/مشهد تاني) — Q1 مابيشوفهوش لأن الشمال مش إسود (E437)
Q17 flicker        بكسلات بترمش كادر واحد وترجع (رعشة سودا بين السنان) جوه لقطة واحدة (E438)
Q18 exit_dir       الفك/الابتسامة بتخرج من الكادر عكس اتجاه الأصل (E439)
Q19 stage_order    ترتيب القصة: «بعد» ظاهر والأصل لسه على «قبل» (أو العكس) (E440) — استشاري (low): قناع السنان البسيط بيحسب الجلد الفاتح سنان في لقطة الوش
Q20 off_center     مكان الابتسامة في اللقطة القريبة بعيد عن مكانها في الأصل (E441)
Q22 missing_morph  الأصل فيه تحول قبل ← بعد (أو العكس) جوه نفس اللقطة، وإحنا في نفس الوقت لقطة واحدة لونها ثابت (E454)
Q23 static_motion  (مش متوصّل — اتجرب ومابيفرقش؛ البديل في مراجعة Claude) (E455)
Q24 half_pop       نص الشاشة (فك في الفكين المتقابلين) بيتغير فجأة كادر/اتنين والنص التاني ثابت وبيرجع (E459)
Q21 tool_motion    أداة (فرشة/سرنجة/قلم) بتتحرك عكس اتجاه الأصل، أو نايمة بالعرض والأصل واقفة بالطول (E452)

الاستخدام:  python3 checks3.py <ours.mp4> <ref.mp4> [t0 t1]   ← كل الفحوصات على الفيديو (أو نافذة منه)
"""
import sys, json
import numpy as np, cv2


def read(path, fps=10, w=360, t0=0.0, t1=1e9):
    """[(ثانية، كادر BGR)] بمعدل fps وعرض w. fps=None = كل الكادرات."""
    cap = cv2.VideoCapture(path); sf = cap.get(cv2.CAP_PROP_FPS) or 30; out = []; i = 0; nxt = t0
    while True:
        ok, f = cap.read()
        if not ok: break
        t = i / sf; i += 1
        if t < t0 - 1e-6: continue
        if t > t1: break
        if fps and t + 1e-6 < nxt: continue
        if fps: nxt += 1 / fps
        out.append((round(t, 3), cv2.resize(f, (w, int(w * f.shape[0] / f.shape[1])))))
    return out


def _cuts(fr, thr=.45):
    cs = []
    for (t0, a), (t1, b) in zip(fr, fr[1:]):
        ha = cv2.calcHist([cv2.cvtColor(a, cv2.COLOR_BGR2HSV)], [0, 1], None, [16, 8], [0, 180, 0, 256]); hb = cv2.calcHist([cv2.cvtColor(b, cv2.COLOR_BGR2HSV)], [0, 1], None, [16, 8], [0, 180, 0, 256])
        if cv2.compareHist(cv2.normalize(ha, None), cv2.normalize(hb, None), cv2.HISTCMP_BHATTACHARYYA) > thr: cs.append(t1)
    return cs


def _runs(ts, gap=.25, min_len=.3):
    """ثواني متتالية ← فترات [(من، لحد)] طولها ≥ min_len."""
    rs = []
    for t in sorted(ts):
        if rs and t - rs[-1][1] <= gap: rs[-1][1] = t
        else: rs.append([t, t])
    return [(round(a, 2), round(b, 2)) for a, b in rs if b - a >= min_len]


# ---------------- Q16: فراغ يمين اللثة في كادر مخلوط ----------------
def _pink(bgr):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV); return (hsv[..., 0] > 150) & (hsv[..., 1] > 40) & (hsv[..., 2] > 70)


def blend_gap(bgr, min_w=.03, dark_k=.45):
    """None لو مفيش جسم لثة ناحية اليمين. وإلا نسبة صفوف جسم اللثة اللي بعد آخر لثة فيها شريط غامق لحد الحافة (أعرض من min_w).
    غامق = أغمق من dark_k من نور اللثة نفسها — كده بيشتغل حتى لو الخلفية وش باهت بيدوب (مش إسود صريح)."""
    H, W = bgr.shape[:2]; pk = _pink(bgr)
    body = cv2.morphologyEx(pk.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))) > 0
    if body[:, W // 2:].mean() < .05: return None
    v = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)[..., 2].astype(np.float32); gv = float(np.median(v[body]))
    rows = np.where(body[:, W // 2:].sum(1) > W * .04)[0]
    if len(rows) < H * .2: return None
    R = max(3, int(H * .07)); rows = rows[(rows >= rows.min() + R) & (rows <= rows.max() - R)]
    if not len(rows): return None
    bad = 0
    for y in rows:
        xr = np.where(body[y])[0][-1]; strip = v[y, xr + 2:]
        if len(strip) > W * min_w and strip.mean() < gv * dark_k: bad += 1
    return bad / len(rows)


def blend_gaps(fr, min_rows=.25):
    """الكادرات اللي فيها فراغ غامق يمين اللثة، وQ1 (jaw_gap) مابيشوفهاش (الشمال مش إسود = كادر مخلوط/ذوبان)."""
    from checks import jaw_gap
    ts = []
    for t, f in fr:
        if jaw_gap(f) is not None: continue        # كادر فك معزول صريح ← ده شغل Q1
        r = blend_gap(f)
        if r is not None and r >= min_rows: ts.append(t)
    return _runs(ts, gap=.25, min_len=.15)


# ---------------- Q17: رعشة (بكسلات بترمش كادر واحد) ----------------
def flicker(fr, d=55, back=22, frac=.0012, min_frames=3):
    """كادر i بيختلف جامد عن اللي قبله واللي بعده، واللي قبله ≈ اللي بعده (رمش في نفس المكان) — جوه لقطة واحدة.
    fr لازم يكون بكل الكادرات (fps=None). بيرجع فترات [(من، لحد)]."""
    cs = set(_cuts(fr)); g = [(t, cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.int16)) for t, f in fr]; ts = []
    for k in range(1, len(g) - 1):
        (ta, a), (tb, b), (tc, c) = g[k - 1], g[k], g[k + 1]
        if tb in cs or tc in cs: continue
        if (b < 25).mean() < .3: continue
        if (np.abs(a - c) > 25).mean() > .02: continue    # المشهد نفسه بيتحرك (عنصر طاير/بيتزحلق) — الرعشة بتبان في لقطة ثابتة تقريبًا (a03 0–5: صف التصميمات)          # بس لقطات الفك المعزول على أسود (E438). في لقطة الوش القناع البسيط بيحسب الجلد الفاتح سنان، والرسومات المتحركة = تصميم
        pk = _pink(fr[k - 1][1])
        if pk.mean() < .03: continue
        roi = cv2.dilate(pk.astype(np.uint8), np.ones((15, 15), np.uint8)) > 0   # جنب اللثة بس (الرمش بين السنان عند حافة اللثة). الشخصيات/الرسومات المتحركة على الأسود برا (a08)
        m = (np.abs(b - a) > d) & (np.abs(b - c) > d) & (np.abs(a - c) < back) & roi & (np.minimum(a, c) > 90) & (b < 45)   # فاتح ← غامق ← فاتح (فراغ إسود بيظهر ويختفي)
        m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))   # بكسل لوحده = ضوضاء ضغط
        if m.mean() > frac: ts.append(tb)
    # لازم يتكرر: min_frames كادرات رمش في نفس الثانية (كادر واحد = انتقال/ضوضاء)
    by = {}
    for t in ts: by.setdefault(int(t), []).append(t)
    keep = [t for s, v in by.items() if len(v) >= min_frames for t in v]
    return _runs(keep, gap=.5, min_len=0)


# ---------------- Q18: اتجاه خروج المحتوى ----------------
def _content(bgr, lvl=30):
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY) > lvl; H, W = g.shape
    if not g.any(): return 0.0, None
    xs = np.where(g)[1]; return g.mean(), xs.mean() / W


def exits(fr, drop=.5, win=1.6):
    """لحظات خروج المحتوى من الكادر على خلفية سودا: نسبة المحتوى بتقع لأقل من (1-drop) خلال win ثانية من غير قطع.
    بيرجع [(الثانية، الاتجاه +1 يمين / -1 شمال)]."""
    st = [(t, *_content(f)) for t, f in fr]; out = []; cs = _cuts(fr); last = -9
    for i, (t, a, x) in enumerate(st):
        if a < .08 or x is None or t - last < win: continue
        for t2, a2, x2 in st[i + 1:]:
            if t2 - t > win or any(t < c <= t2 for c in cs): break
            if a2 < a * (1 - drop) and x2 is not None:
                if abs(x2 - x) > .08: out.append((round(t, 2), 1 if x2 > x else -1)); last = t
                break
    return out


def exit_dir(fo, fr_ref, tol=1.2, dt_max=.4):
    """الخروجات اللي عندنا اتجاهها عكس خروج الأصل في نفس الوقت تقريبًا، أو في نفس الاتجاه بس بدري/متأخر > dt_max (a16 24: خرجنا قبل الأصل بثانية).
    بيرجع [(ثانيتنا، اتجاهنا، اتجاه الأصل، ثانية الأصل)]."""
    eo, er = exits(fo), exits(fr_ref); bad = []
    for t, d in eo:
        near = sorted([(abs(tr - t), tr, dr) for tr, dr in er if abs(tr - t) <= tol])
        if not near: continue
        if all(dr != d for _, _, dr in near): bad.append((t, d, near[0][2], near[0][1]))
        elif near[0][0] > dt_max: bad.append((t, d, d, near[0][1]))
    return bad


# ---------------- Q19: ترتيب قبل/بعد ----------------
def teeth_color(bgr, min_frac=.008):
    """(L, b*) لسنان الكادر (نفس قناع Q20: فاتحة جدًا بعتبة نسبية، كتل كبيرة)، أو None لو السنان قليلة.
    القناع القديم (V>120) كان بيحسب الجلد سنان في لقطة الوش."""
    m = teeth_mask(bgr)
    if m.mean() < min_frac: return None
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32); return float(np.median(lab[..., 0][m])), float(np.median(lab[..., 2][m]))


def stages(fr, sep=5.0, close=.06):
    """كل كادر: before/after/None بالتقسيم لمجموعتين حسب صفار السنان (b*)، **جوه كل نوع لقطة لوحده**
    (وش: السنان < close من الكادر / سنان قريبة): إضاءة الوش غير إضاءة الفك المعزول، فالمقارنة بينهم بتغلط (a16).
    الأصفر = قبل. لو المجموعتين في نوع اللقطة مش منفصلين كفاية (فرق b* < sep) ← مش بنحكم على النوع ده."""
    cs = [(t, teeth_color(f), float(teeth_mask(f).mean())) for t, f in fr]; out = {t: None for t, _, _ in cs}
    for grp in (lambda a: a < close, lambda a: a >= close):
        sub = [(t, c) for t, c, a in cs if c and grp(a)]; vals = np.array([c[1] for _, c in sub])
        if len(vals) < 6: continue
        lo, hi = np.percentile(vals, 15), np.percentile(vals, 85)
        if hi - lo < sep: continue
        mid = (lo + hi) / 2; band = (hi - lo) * .2
        for t, c in sub: out[t] = "before" if c[1] > mid + band else "after" if c[1] < mid - band else None
    return sorted(out.items())


def stage_order(fo, fr_ref, min_len=1.0):
    """فترات عندنا «بعد» والأصل «قبل» في نفس الوقت (أو العكس) لمدة ≥ min_len."""
    so, sr = dict(stages(fo)), stages(fr_ref)
    def ref_at(t):
        c = [s for tr, s in sr if abs(tr - t) <= .3 and s]; return max(set(c), key=c.count) if c else None
    wrong = [t for t, s in so.items() if s and ref_at(t) and s != ref_at(t)]
    return [(a, b, so[a]) for a, b in _runs(wrong, gap=.35, min_len=min_len)]


# ---------------- Q20: الابتسامة مش في النص ----------------
def teeth_mask(bgr):
    """سنان: فاتحة جدًا وقليلة التشبع (مش جلد ولا لمعة شفة)، كتل كبيرة بس. شريط العنوان اللي فوق (6%) متشال."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV); v = hsv[..., 2]; thr = max(140, min(205, np.percentile(v, 96) - 20))   # عتبة نسبية: إضاءة الأصل أغمق من بتاعنا
    m = (v > thr) & (hsv[..., 1] < 95) & ~_pink(bgr)
    m[:int(m.shape[0] * .06)] = False
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if n < 2: return m > 0
    keep = [i for i in range(1, n) if st[i, 4] > .1 * st[1:, 4].max()]
    return np.isin(lab, keep)


def smile_center(bgr, min_frac=.02, axis=1, with_dir=False):
    """مركز السنان (0..1) على المحور axis (1 = أفقي، 0 = رأسي) في اللقطة القريبة، أو None لو مش لقطة سنان قريبة.
    with_dir: كمان اتجاه صف السنان (True = طولي/ملفوف، False = بالعرض) — عرض الكتلة مقابل طولها."""
    m = teeth_mask(bgr)
    if m.mean() < min_frac: return None
    ys, xs = np.where(m); c = (ys, xs)[axis]; H, W = bgr.shape[:2]
    v = (np.percentile(c, 5) + np.percentile(c, 95)) / 2 / (W if axis == 1 else H)
    if not with_dir: return v
    tall = (np.percentile(ys, 95) - np.percentile(ys, 5)) / H > (np.percentile(xs, 95) - np.percentile(xs, 5)) / W
    return v, tall


def _has_face(gray_or_bgr, bgr=None):
    """في وش كامل في الكادر؟ (العينين الاتنين جوه الكادر — لقطة البق القريبة مافيهاش عينين). نفس كاشف الوش بتاع المحرك."""
    from checks import faces_lmk
    f = bgr if bgr is not None else cv2.cvtColor(gray_or_bgr, cv2.COLOR_GRAY2BGR)
    H, W = f.shape[:2]
    try: L = faces_lmk(cv2.cvtColor(f, cv2.COLOR_BGR2RGB), n=1)
    except Exception: return False
    if not L: return False
    e1, e2 = L[0][33], L[0][263]
    return all(0 <= p[0] < W and 0 <= p[1] < H for p in (e1, e2))


def off_center(fo, fr_ref, tol=.1, min_len=1.0, black=.35):
    """فترات مكان الابتسامة عندنا بعيد عن مكانها في الأصل في نفس الوقت بأكتر من tol من عرض الشاشة.
    (لو قالبنا طولي والأصل بالعرض بيتقارن عرضنا بطول الأصل.) (مش مقارنة بنص الشاشة: في اللقطة الملفوفة السنان نفسها بتبقى ناحية الشفة العليا، فالمرجع هو تكوين الأصل.)
    لقطات الفك المعزول على أسود متستثنية (مكانها بالتصميم: الأطراف شمال واللثة لازقة يمين)."""
    def iso(f):   # مش لقطة بق قريبة: فك معزول على أسود، أو فكين قصاد بعض بفاصل أسود، أو لقطة فيها وش كامل (القناع البسيط بيحسب الجلد/الشعر سنان)
        g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        if (g < 25).mean() > black: return True
        H, W = g.shape; mid = (g[int(H * .1):int(H * .9), int(W * .2):int(W * .8)] < 30).mean(0)
        if (mid > .85).any(): return True                       # عمود أسود بطول الكادر في النص = فاصل بين فكين (a14)
        return _has_face(g, f)
    # قالب طولي من أصل بالعرض (الصورة ملفوفة 90°): العرض عندنا = الطول في الأصل
    rot = bool(fo) and bool(fr_ref) and (fo[0][1].shape[0] > fo[0][1].shape[1]) != (fr_ref[0][1].shape[0] > fr_ref[0][1].shape[1])
    ro = {t: smile_center(f, axis=0 if rot else 1) for t, f in fr_ref if not iso(f)}
    def ref_at(t):
        c = [v for tr, v in ro.items() if abs(tr - t) <= .3 and v is not None]; return float(np.median(c)) if c else None
    bad = []
    for t, f in fo:
        if iso(f): continue
        c = smile_center(f); r = ref_at(t)
        if c is not None and r is not None and abs(c - r) > tol: bad.append(t)
    return _runs(bad, gap=.35, min_len=min_len)


# ---------------- Q21: اتجاه الأداة وحركتها ----------------
def movers(fr, lo=.002, hi=.12, thr=28, max_obj=.1):
    """لكل كادر في لقطة ثابتة (الكاميرا مش بتتحرك): الجسم اللي بيتحرك = فرق الكادرين.
    بيرجع {ثانية: (x، y، زاوية المحور 0=بالعرض 90=بالطول، المساحة)} بنسب الكادر."""
    cs = set(_cuts(fr)); out = {}
    for (t0, a), (t1, b) in zip(fr, fr[1:]):
        if t1 in cs: continue
        d = cv2.absdiff(cv2.cvtColor(a, cv2.COLOR_BGR2GRAY), cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)) > thr
        d = cv2.morphologyEx(d.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)); fr_ = d.mean()
        if not (lo < fr_ < hi): continue
        n, lab, st, cen = cv2.connectedComponentsWithStats(d)
        if n < 2: continue
        k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])); ys, xs = np.where(lab == k)
        if len(xs) < 30 or len(xs) > max_obj * d.size: continue   # جسم كبير (كاست/وش) مش أداة
        c = np.cov(np.vstack([xs, ys])); w, v = np.linalg.eigh(c); vx, vy = v[:, 1]
        if w[1] < 2.5 * max(w[0], 1e-6): continue   # مش جسم طويل (أداة)
        H, W = d.shape; out[t1] = (xs.mean() / W, ys.mean() / H, abs(np.degrees(np.arctan2(vy, vx))) % 180, len(xs) / d.size)
    return out


def tool_motion(fo, fr_ref, win=.6, min_dx=.05, min_len=.4):
    """بيقارن الأداة اللي بتتحرك عندنا بالأصل في نفس الثانية: اتجاه الحركة بالعرض، ووضعها (بالطول/بالعرض).
    بيرجع [(من، لحد، السبب)]."""
    mo, mr = movers(fo), movers(fr_ref); bad_dir, bad_ax = [], []
    def track(m, t, sx=.25, sy=.2):
        """سلسلة متصلة لنفس الجسم حوالين t (كل خطوة < sx بالعرض و< sy بالطول) — حواف كاست بيلف بتنط فوق وتحت فمش بتعمل سلسلة."""
        ks = sorted(k for k in m if t - win / 2 <= k <= t + win / 2)
        if not ks: return None
        c = min(ks, key=lambda k: abs(k - t)); i = ks.index(c); ch = [c]
        for j in range(i + 1, len(ks)):
            if ks[j] - ch[-1] > .25 or abs(m[ks[j]][0] - m[ch[-1]][0]) > sx or abs(m[ks[j]][1] - m[ch[-1]][1]) > sy: break
            ch.append(ks[j])
        for j in range(i - 1, -1, -1):
            if ch[0] - ks[j] > .25 or abs(m[ks[j]][0] - m[ch[0]][0]) > sx or abs(m[ks[j]][1] - m[ch[0]][1]) > sy: break
            ch.insert(0, ks[j])
        return [(k, m[k]) for k in ch] if len(ch) >= 4 else None
    for t in sorted(mo):
        a, b = track(mo, t), track(mr, t)
        if not a or not b: continue
        dxa = a[-1][1][0] - a[0][1][0]; dxb = b[-1][1][0] - b[0][1][0]
        if abs(dxa) > min_dx and abs(dxb) > min_dx and np.sign(dxa) != np.sign(dxb): bad_dir.append(t)
        axa = np.median([v[2] for _, v in a]); axb = np.median([v[2] for _, v in b])
        va, vb = abs(axa - 90) < 30, abs(axb - 90) < 30; ha, hb = min(axa, 180 - axa) < 30, min(axb, 180 - axb) < 30
        if (va and hb) or (ha and vb): bad_ax.append(t)
    return [(a, b, "dir") for a, b in _runs(bad_dir, gap=.35, min_len=min_len)] + [(a, b, "axis") for a, b in _runs(bad_ax, gap=.35, min_len=min_len)]


# ---------------- Q22: تحول قبل/بعد ناقص ----------------
def morphs(fr, d_min=6.0, win=2.0, close=.06):
    """تحولات لون السنان جوه لقطة واحدة (من غير قطع) في لقطة سنان قريبة بس (السنان ≥ close من الكادر — في لقطة الوش
    التأثيرات زي الجبس/البودرة بتغير اللون من غير ما يكون تحول): b* بيتغير ≥ d_min خلال ≤ win ثانية. بيرجع [(البداية، النهاية، التغيير)]."""
    cs = _cuts(fr); col = [(t, (teeth_color(f) or (None, None))[1] if teeth_mask(f).mean() >= close else None) for t, f in fr]; out = []; i = 0
    while i < len(col):
        t0, v0 = col[i]
        if v0 is None: i += 1; continue
        best = None
        for t1, v1 in col[i + 1:]:
            if t1 - t0 > win or any(t0 < c <= t1 for c in cs): break
            if v1 is not None and abs(v1 - v0) >= d_min: best = (t0, t1, v1 - v0); break
        if best: out.append(tuple(round(x, 2) for x in best)); i = next((k for k, (t, _) in enumerate(col) if t > best[1] + .5), len(col))
        else: i += 1
    return out


def missing_morph(fo, fr_ref, tol=1.5, frac=.4):
    """تحولات الأصل اللي مالهاش تحول عندنا (تغيير ≥ frac من حجمه) في حدود tol ثانية. بيرجع [(من، لحد، التغيير في الأصل)].
    استشاري (low): على النسخ السليمة بيطلّع إنذارات في مشاهد فيها حاجة تانية بتغير لون السنان (عدسات بتتركب، تحضير، زووم للقطة تانية)."""
    mr, mo = morphs(fr_ref), morphs(fo, d_min=2.5)
    return [(a, b, d) for a, b, d in mr if not any(abs(x - a) <= tol + (b - a) and abs(dd) >= frac * abs(d) for x, _, dd in mo)]


# ---------------- Q23: صورة ساكتة والأصل بيتحرك ----------------
def motion_energy(fr):
    """طاقة الحركة لكل كادر: متوسط فرق الكادر عن اللي قبله (رمادي، 0–255). القطع بيتشال."""
    cs = set(_cuts(fr)); out = {}
    for (t0, a), (t1, b) in zip(fr, fr[1:]):
        if t1 in cs: continue
        out[t1] = float(cv2.absdiff(cv2.cvtColor(a, cv2.COLOR_BGR2GRAY), cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)).mean())
    return out


def static_motion(fo, fr_ref, win=1.0, ratio=.3, low=.9, min_len=2.5):
    """فترات عندنا متوسط الحركة (في نافذة win) < low وأقل من ratio من حركة الأصل في نفس الوقت، لمدة ≥ min_len."""
    eo, er = motion_energy(fo), motion_energy(fr_ref)
    def avg(e, t): v = [x for k, x in e.items() if abs(k - t) <= win / 2]; return np.mean(v) if v else None
    bad = []
    for t in sorted(eo):
        a, b = avg(eo, t), avg(er, t)
        if a is not None and b is not None and a < low and a < ratio * b: bad.append(t)
    return _runs(bad, gap=.35, min_len=min_len)


# ---------------- Q24: فك بيختفي/بيتغير كادر واحد ----------------
def half_pop(fa, jump=15.0, calm=2.0):
    """كادرات كاملة (fps الأصلي): نص واحد بيتغير فجأة (فرق متوسط > jump) والنص التاني ثابت (< calm)، ومش قطع مشهد. بيرجع [ثواني]."""
    out = []; prev = None
    for t, f in fa:
        g = cv2.cvtColor(cv2.resize(f, (180, 320)), cv2.COLOR_BGR2GRAY).astype(np.float32)
        if prev is not None:
            d = np.abs(g - prev); l, r = d[:, :90].mean(), d[:, 90:].mean()
            if (l > jump and r < calm) or (r > jump and l < calm): out.append(round(t, 2))
        prev = g
    return out


# اختلافات مقصودة عن الأصل (زي qa-ok في الكود): {قالب: {فحص: [(من، لحد، السبب)]}} — الفحص مايطلّعش إنذار جوه الفترة دي
QA_OK = {
    "a12": {"Q20": [(21.0, 27.0, "الأصل هنا ابتسامة بالعرض، وإحنا ملفوفين +90 بقاعدة B11 (الأطراف شمال) — التكوين مختلف بالقصد")]},
}


def _ok(name, code, t):
    return any(a <= (t or 0) <= b for a, b, _ in QA_OK.get(name or "", {}).get(code, []))


def run_all(ours, ref, t0=0.0, t1=1e9, ref_t0=None, name=None):
    """كل الفحوصات ← [{t, severity, code, issue_ar}]."""
    rt0 = t0 if ref_t0 is None else ref_t0; rt1 = rt0 + (t1 - t0)
    fo = read(ours, 10, t0=t0, t1=t1); fr = read(ref, 10, t0=rt0, t1=rt1); sh = rt0 - t0
    fr = [(t - sh, f) for t, f in fr]
    out = []
    for a, b in blend_gaps(fo): out.append({"t": a, "severity": "high", "code": "Q16", "issue_ar": f"فراغ غامق يمين اللثة وهي بتدوب مع مشهد تاني ({a}–{b}ث) — املا اللثة في طبقة الفك قبل الخلط (E437)"})
    fa = read(ours, None, t0=t0, t1=t1)
    for t in half_pop(fa): out.append({"t": t, "severity": "high", "code": "Q24", "issue_ar": f"نص الشاشة اتغير فجأة كادر واحد عند {t}ث والنص التاني ثابت — فك بيختفي/بيقفز (E459)"})
    for a, b in flicker(fa): out.append({"t": a, "severity": "high", "code": "Q17", "issue_ar": f"رعشة: بكسلات بترمش كادر واحد وترجع ({a}–{b}ث) — غالبًا ملء/عزل بيتحسب كل كادر والكاميرا بتتحرك (E438)"})
    for t, d, dr, tr in exit_dir(fo, fr):
        if d != dr: out.append({"t": t, "severity": "high", "code": "Q18", "issue_ar": f"المحتوى بيخرج {'يمين' if d > 0 else 'شمال'} والأصل بيخرج {'يمين' if dr > 0 else 'شمال'} (E439)"})
        else: out.append({"t": t, "severity": "medium", "code": "Q18", "issue_ar": f"الخروج من الكادر عندنا عند {t}ث والأصل عند {tr}ث — التوقيت مختلف (E445)"})
    for a, b, s in stage_order(fo, fr): out.append({"t": a, "severity": "low", "code": "Q19", "issue_ar": f"ترتيب القصة: عندنا «{'بعد' if s == 'after' else 'قبل'}» والأصل «{'قبل' if s == 'after' else 'بعد'}» ({a}–{b}ث) (E440)"})
    for a, b in off_center(fo, fr): out.append({"t": a, "severity": "medium", "code": "Q20", "issue_ar": f"مكان الابتسامة في الشاشة مختلف عن الأصل ({a}–{b}ث) — سنتر على نص فتحة البق (E441)"})
    for a, b, d in missing_morph(fo, fr): out.append({"t": a, "severity": "low", "code": "Q22", "issue_ar": f"الأصل فيه تحول {'قبل ← بعد' if d < 0 else 'بعد ← قبل'} جوه نفس اللقطة ({a}–{b}ث) وإحنا لأ — اعمل نفس التحول بالمورف/المزج في نفس الثانية (E454)"})
    # Q23 static_motion مش متوصّل: الأصل نفسه «ساكت» بالبكسلات وهو بيرسم رسومات رفيعة ببطء (a22 20–23ث) فمابيفرقش — الفحص ده بقى في مراجعة Claude (static stretch)
    for a, b, k in tool_motion(fo, fr):
        out.append({"t": a, "severity": "medium", "code": "Q21", "issue_ar": (f"الأداة بتتحرك عكس اتجاه الأصل ({a}–{b}ث) — خليها تمشي مع اللون/الأثر اللي بتسيبه زي الأصل (E452)" if k == "dir" else f"الأداة نايمة بالعرض والأصل واقفة بالطول (أو العكس) ({a}–{b}ث) — لف الصورة وخلي راسها ناحية السنان (E452)")})
    return [i for i in out if not _ok(name, i["code"], i["t"])]


if __name__ == "__main__":
    a = sys.argv[1:]; t0, t1 = (float(a[2]), float(a[3])) if len(a) >= 4 else (0.0, 1e9)
    for i in run_all(a[0], a[1], t0, t1): print(json.dumps(i, ensure_ascii=False))
