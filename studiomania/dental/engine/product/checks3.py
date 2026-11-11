"""فحوصات بالأرقام لأخطاء جولة المعرض 11 (البلاي بوك references/qa.md Q16–Q20). من غير موديل ذكاء اصطناعي.

Q16 blend_gaps     فراغ إسود يمين اللثة في كادر **مخلوط** (الفك بيدوب مع الوش/مشهد تاني) — Q1 مابيشوفهوش لأن الشمال مش إسود (E437)
Q17 flicker        بكسلات بترمش كادر واحد وترجع (رعشة سودا بين السنان) جوه لقطة واحدة (E438)
Q18 exit_dir       الفك/الابتسامة بتخرج من الكادر عكس اتجاه الأصل (E439)
Q19 stage_order    ترتيب القصة: «بعد» ظاهر والأصل لسه على «قبل» (أو العكس) (E440) — استشاري (low): قناع السنان البسيط بيحسب الجلد الفاتح سنان في لقطة الوش
Q20 off_center     مكان الابتسامة في اللقطة القريبة بعيد عن مكانها في الأصل (E441)

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
        tm = teeth_mask(fr[k][1])
        if tm.mean() < .04: continue
        roi = cv2.dilate(tm.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0   # بين السنان وحواليها بس
        m = (np.abs(b - a) > d) & (np.abs(b - c) > d) & (np.abs(a - c) < back) & roi
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


def exit_dir(fo, fr_ref, tol=1.2):
    """الخروجات اللي عندنا اتجاهها عكس خروج الأصل في نفس الوقت تقريبًا."""
    eo, er = exits(fo), exits(fr_ref); bad = []
    for t, d in eo:
        near = [dr for tr, dr in er if abs(tr - t) <= tol]
        if near and all(dr != d for dr in near): bad.append((t, d, near[0]))
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


def off_center(fo, fr_ref, tol=.1, min_len=1.0, black=.35):
    """فترات مكان الابتسامة عندنا بعيد عن مكانها في الأصل في نفس الوقت بأكتر من tol من عرض الشاشة.
    (لو قالبنا طولي والأصل بالعرض بيتقارن عرضنا بطول الأصل.) (مش مقارنة بنص الشاشة: في اللقطة الملفوفة السنان نفسها بتبقى ناحية الشفة العليا، فالمرجع هو تكوين الأصل.)
    لقطات الفك المعزول على أسود متستثنية (مكانها بالتصميم: الأطراف شمال واللثة لازقة يمين)."""
    def iso(f): return (cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) < 25).mean() > black
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
    for a, b in flicker(fa): out.append({"t": a, "severity": "high", "code": "Q17", "issue_ar": f"رعشة: بكسلات بترمش كادر واحد وترجع ({a}–{b}ث) — غالبًا ملء/عزل بيتحسب كل كادر والكاميرا بتتحرك (E438)"})
    for t, d, dr in exit_dir(fo, fr): out.append({"t": t, "severity": "high", "code": "Q18", "issue_ar": f"المحتوى بيخرج {'يمين' if d > 0 else 'شمال'} والأصل بيخرج {'يمين' if dr > 0 else 'شمال'} (E439)"})
    for a, b, s in stage_order(fo, fr): out.append({"t": a, "severity": "low", "code": "Q19", "issue_ar": f"ترتيب القصة: عندنا «{'بعد' if s == 'after' else 'قبل'}» والأصل «{'قبل' if s == 'after' else 'بعد'}» ({a}–{b}ث) (E440)"})
    for a, b in off_center(fo, fr): out.append({"t": a, "severity": "medium", "code": "Q20", "issue_ar": f"مكان الابتسامة في الشاشة مختلف عن الأصل ({a}–{b}ث) — سنتر على نص فتحة البق (E441)"})
    return [i for i in out if not _ok(name, i["code"], i["t"])]


if __name__ == "__main__":
    a = sys.argv[1:]; t0, t1 = (float(a[2]), float(a[3])) if len(a) >= 4 else (0.0, 1e9)
    for i in run_all(a[0], a[1], t0, t1): print(json.dumps(i, ensure_ascii=False))
