"""🎯 تراك لحاجة في الفيديو: المستخدم بيحدد مربع عليها في فريم، والبرنامج بيتابع نقط مميزة جواها فريم فريم
(Lucas-Kanade optical flow)، ومن حركة النقط بيحسب الحاجة اتحركت إزاي:
  follow  → إزاحة ولفّ وتكبير بس (حاجة بتتحرك: وش، علبة، عربية)
  surface → كمان الميلان والمنظور (ورقة على مكتب، شاشة، يافطة)
النتيجة: 4 أركان للحاجة في كل فريم، بكسور من مقاس الفيديو."""
from __future__ import annotations

import cv2
import numpy as np

MAX_FPS = 30
WORK_W = 640   # الفريمات بتتصغّر للحساب (أسرع بكتير ونفس الدقة تقريبًا للحركة)


def _features(gray, quad, n=300):
    # النقط من جوه الحاجة بس (الحدود متصغّرة شوية ناحية النص) عشان الخلفية اللي وراها ما تشدّش التراك
    c = quad.mean(0)
    inner = c + (quad - c) * 0.7
    mask = np.zeros(gray.shape, np.uint8)
    cv2.fillConvexPoly(mask, inner.astype(np.int32), 255)
    pts = cv2.goodFeaturesToTrack(gray, maxCorners=n, qualityLevel=0.008, minDistance=4, blockSize=7, mask=mask)
    return pts.reshape(-1, 2).astype(np.float32) if pts is not None else np.zeros((0, 2), np.float32)


def _sane(q_old, q_new):
    """الأركان الجديدة معقولة؟ (مش مقلوبة ولا اتكبرت/صغرت فجأة)"""
    if not np.all(np.isfinite(q_new)):
        return False
    a0, a1 = abs(cv2.contourArea(q_old.astype(np.float32))), abs(cv2.contourArea(q_new.astype(np.float32)))
    return a1 > 16 and 0.5 < a1 / max(a0, 1e-6) < 2.0 and cv2.isContourConvex(q_new.astype(np.float32))


def _step(g0, g1, quad, pts, mode):
    """فريم ← الفريم اللي بعده: النقط بتتحرك، والأركان بتتحرك على قدها."""
    if len(pts) < 30:
        more = _features(g0, quad)
        pts = np.vstack([pts, more]) if len(pts) else more
    if len(pts) < 3:
        return quad, pts
    lk = dict(winSize=(21, 21), maxLevel=3, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01))
    p1, st, _ = cv2.calcOpticalFlowPyrLK(g0, g1, pts.reshape(-1, 1, 2), None, **lk)
    pb, stb, _ = cv2.calcOpticalFlowPyrLK(g1, g0, p1, None, **lk)   # رايح جاي: النقطة اللي مارجعتش مكانها غلط
    p1, pb = p1.reshape(-1, 2), pb.reshape(-1, 2)
    ok = (st.reshape(-1) == 1) & (stb.reshape(-1) == 1) & (np.linalg.norm(pb - pts, axis=1) < 1.0)
    a, b = pts[ok], p1[ok]
    M = None
    if mode == "surface" and len(a) >= 8:
        M, inl = cv2.findHomography(a, b, cv2.RANSAC, 3.0)
    elif len(a) >= 3:
        A, inl = cv2.estimateAffinePartial2D(a, b, method=cv2.RANSAC, ransacReprojThreshold=3.0)
        M = np.vstack([A, [0, 0, 1]]) if A is not None else None
    if M is None:
        return quad, b
    q = cv2.perspectiveTransform(quad.reshape(-1, 1, 2).astype(np.float32), M).reshape(-1, 2)
    if not _sane(quad, q):
        return quad, b
    keep = b[inl.reshape(-1) == 1] if inl is not None and len(inl) == len(b) else b
    return q, keep.astype(np.float32)


def _smooth(qs, ref, r=2):
    """تنعيم خفيف عشان الرعشة، والفريم اللي المستخدم حدد فيه بيفضل زي ما هو بالظبط."""
    arr = np.array(qs, np.float64)
    out = arr.copy()
    for i in range(len(arr)):
        lo, hi = max(0, i - r), min(len(arr), i + r + 1)
        w = np.array([1.0 / (1 + abs(j - i)) for j in range(lo, hi)])
        out[i] = (arr[lo:hi] * w[:, None, None]).sum(0) / w.sum()
    out[ref] = arr[ref]
    return out


def track(path: str, t0: float, t1: float, tref: float, box: list[float], mode: str = "follow", progress=None, quad: list[float] | None = None) -> dict:
    """box: [x0, y0, x1, y1] أو quad: 8 أرقام (4 أركان) بكسور من مقاس الفيديو في الثانية tref. بيرجّع {t0, fps, q: [[8 أرقام]...]}"""
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise RuntimeError("مش قادر يفتح الفيديو عشان يعمل تراك")
    vfps = cap.get(cv2.CAP_PROP_FPS) or 30
    vw, vh = cap.get(cv2.CAP_PROP_FRAME_WIDTH), cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    step = max(1, round(vfps / MAX_FPS))
    f0 = max(0, int(t0 * vfps))
    f1 = int(t1 * vfps) + 1 if t1 > t0 else total
    if total:
        f1 = min(f1, total - 1)
    k = WORK_W / vw if vw > WORK_W else 1.0
    cap.set(cv2.CAP_PROP_POS_FRAMES, f0)
    grays, idx = [], f0
    while idx <= f1:
        ok, fr = cap.read()
        if not ok:
            break
        if (idx - f0) % step == 0:
            g = cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY)
            if k != 1.0:
                g = cv2.resize(g, (int(vw * k), int(vh * k)), interpolation=cv2.INTER_AREA)
            grays.append(g)
        idx += 1
    cap.release()
    n = len(grays)
    if n < 2:
        raise RuntimeError("الجزء ده من الفيديو قصير قوي على التراك")
    fps = vfps / step
    ref = int(round(min(max(tref - f0 / vfps, 0), (n - 1) / fps) * fps))
    ref = min(max(ref, 0), n - 1)
    gw, gh = grays[0].shape[1], grays[0].shape[0]
    if quad:
        q = np.array([[quad[j * 2] * gw, quad[j * 2 + 1] * gh] for j in range(4)], np.float32)
    else:
        x0, y0, x1, y1 = box
        q = np.array([[x0 * gw, y0 * gh], [x1 * gw, y0 * gh], [x1 * gw, y1 * gh], [x0 * gw, y1 * gh]], np.float32)
    qs = [None] * n
    qs[ref] = q
    done = 0
    thumbs = [cv2.resize(g, (64, 36), interpolation=cv2.INTER_AREA).astype(np.float32) for g in grays]
    for rng in (range(ref, n - 1), range(ref, 0, -1)):
        quad, pts, cut = q.copy(), _features(grays[ref], q), False
        for j in rng:
            nj = j + 1 if rng.step == 1 else j - 1
            # قطع في المونتاج (لقطة جديدة خالص): التراك بيقف ويفضل مكانه لحد آخر الجزء ده
            cut = cut or float(np.mean(np.abs(thumbs[j] - thumbs[nj]))) > 38
            if not cut:
                quad, pts = _step(grays[j], grays[nj], quad, pts, mode)
            qs[nj] = quad
            done += 1
            if progress and done % 15 == 0:
                progress(done / max(1, n - 1))
    sm = _smooth(qs, ref)
    return {"t0": round(f0 / vfps, 4), "fps": round(fps, 4), "mode": mode,
            "q": [[round(float(v), 5) for p in fq for v in (p[0] / gw, p[1] / gh)] for fq in sm]}


def _order(pts):
    """4 نقط بالترتيب: فوق شمال، فوق يمين، تحت يمين، تحت شمال."""
    p = np.array(pts, np.float32).reshape(4, 2)
    s, d = p.sum(1), np.diff(p, axis=1).reshape(-1)
    return np.array([p[np.argmin(s)], p[np.argmin(d)], p[np.argmax(s)], p[np.argmax(d)]], np.float32)


def _boxy(q) -> bool:
    """شكل قريب من مستطيل في المنظور: كل زاوية بين 55° و125° ومفيش ضلع أقصر من ربع اللي قصاده."""
    q = np.asarray(q, np.float64)
    for i in range(4):
        a, b, c = q[i - 1], q[i], q[(i + 1) % 4]
        v1, v2 = a - b, c - b
        cosv = np.dot(v1, v2) / max(1e-6, np.linalg.norm(v1) * np.linalg.norm(v2))
        if not (55 <= np.degrees(np.arccos(np.clip(cosv, -1, 1))) <= 125):
            return False
    sides = [np.linalg.norm(q[i] - q[(i + 1) % 4]) for i in range(4)]
    return min(sides[0], sides[2]) > 0.25 * max(sides[0], sides[2]) and min(sides[1], sides[3]) > 0.25 * max(sides[1], sides[3])


def detect(path: str, t: float, pt: list[float], person_mask: str | None = None) -> tuple[list[float], str]:
    """🎯 دوسة على حاجة في الفريم ← حدودها (4 أركان بكسور من الفيديو) ونوعها:
    surface لو ليها حواف مربعة واضحة (ورقة، شاشة، يافطة) فبتتتبع بالمنظور، وfollow لأي حاجة تانية (شخص، وش، علبة)."""
    cap = cv2.VideoCapture(path)
    cap.set(cv2.CAP_PROP_POS_MSEC, max(0.0, t) * 1000)
    ok, fr = cap.read()
    cap.release()
    if not ok:
        raise RuntimeError("مش قادر يقرا الفريم ده من الفيديو")
    H0, W0 = fr.shape[:2]
    k = WORK_W / W0 if W0 > WORK_W else 1.0
    img = cv2.resize(fr, (int(W0 * k), int(H0 * k))) if k != 1.0 else fr
    h, w = img.shape[:2]
    px, py = float(pt[0]) * w, float(pt[1]) * h
    area = w * h
    norm = lambda q: [round(float(v), 5) for p in _order(q) for v in (p[0] / w, p[1] / h)]  # noqa: E731

    # 1) حاجة ليها 4 حواف واضحة حوالين الدوسة (ورقة، شاشة، كتاب، يافطة)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.dilate(cv2.Canny(cv2.bilateralFilter(gray, 7, 50, 50), 40, 120), np.ones((3, 3), np.uint8))
    cnts, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    for c in cnts:
        ca = cv2.contourArea(c)
        if not (area * 0.004 < ca < area * 0.7) or cv2.pointPolygonTest(c, (px, py), False) < 0:
            continue
        ap = cv2.approxPolyDP(c, 0.03 * cv2.arcLength(c, True), True)
        if len(ap) == 4 and cv2.isContourConvex(ap) and _boxy(ap.reshape(4, 2)) and (best is None or ca < best[0]):
            best = (ca, ap.reshape(4, 2))
    if best is not None:
        return norm(best[1]), "surface"

    # 2) حاجة لونها واحد تقريبًا (كوباية، تيشيرت، علبة): بنملا من مكان الدوسة على قد ما اللون قريب
    lab_img = cv2.cvtColor(cv2.bilateralFilter(img, 9, 60, 60), cv2.COLOR_BGR2LAB)
    for tol in (10, 16, 24):
        ffm = np.zeros((h + 2, w + 2), np.uint8)
        cv2.floodFill(lab_img.copy(), ffm, (int(px), int(py)), (0, 0, 0), (tol,) * 3, (tol,) * 3,
                      4 | cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE | (255 << 8))
        reg = cv2.morphologyEx(ffm[1:-1, 1:-1], cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        ra = int((reg > 0).sum())
        if area * 0.003 < ra < area * 0.45:
            return norm(cv2.boxPoints(cv2.minAreaRect(cv2.findNonZero(reg)))), "follow"
        if ra >= area * 0.45:
            break

    # 3) أي حاجة تانية: GrabCut من حوالين الدوسة (والدوسة نفسها أكيد جوه الحاجة)
    try:
        s = int(min(w, h) * 0.5)
        rx, ry = int(max(0, min(w - s, px - s / 2))), int(max(0, min(h - s, py - s / 2)))
        mask = np.full((h, w), cv2.GC_BGD, np.uint8)
        mask[ry:ry + s, rx:rx + s] = cv2.GC_PR_FGD
        cv2.circle(mask, (int(px), int(py)), max(4, s // 25), cv2.GC_FGD, -1)
        bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
        cv2.grabCut(img, mask, None, bgd, fgd, 4, cv2.GC_INIT_WITH_MASK)
        fg = ((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)).astype(np.uint8)
        n, lab = cv2.connectedComponents(fg)
        if lab[int(py), int(px)] > 0:
            comp = (lab == lab[int(py), int(px)]).astype(np.uint8)
            if area * 0.002 < comp.sum() < s * s * 0.8:   # فصل الحاجة فعلًا (مش رجّع المربع كله)
                pts = cv2.findNonZero(comp)
                return norm(cv2.boxPoints(cv2.minAreaRect(pts))), "follow"
    except cv2.error:
        pass
    # 4) الشخص (لو الفيديو اتحلل): الدوسة جوه الشخص ومفيش حاجة أصغر اتعرفت ← حدود الشخص كله
    if person_mask:
        m = cv2.imread(person_mask, cv2.IMREAD_UNCHANGED)
        if m is not None:
            a = m[..., 3] if m.ndim == 3 and m.shape[2] == 4 else (cv2.cvtColor(m, cv2.COLOR_BGR2GRAY) if m.ndim == 3 else m)
            a = cv2.resize(a, (w, h)) > 128
            if a[int(min(h - 1, max(0, py))), int(min(w - 1, max(0, px)))]:
                n, lab = cv2.connectedComponents(a.astype(np.uint8))
                comp = (lab == lab[int(py), int(px)]).astype(np.uint8)
                x, y, bw, bh = cv2.boundingRect(comp)
                return norm([[x, y], [x + bw, y], [x + bw, y + bh], [x, y + bh]]), "follow"

    s = min(w, h) * 0.18   # مالقاش حدود واضحة: مربع صغير حوالين الدوسة
    return norm([[px - s, py - s], [px + s, py - s], [px + s, py + s], [px - s, py + s]]), "follow"


def regions(path: str, t: float, person_mask: str | None = None, head: list[float] | None = None) -> tuple[list[dict], np.ndarray]:
    """🖱️ كل الحاجات اللي في الفريم وحدودها (عشان لما الماوس يعدّي على حاجة حدودها تنوّر قبل ما تدوس):
    الراس، الشخص، الحاجات اللي ليها 4 حواف (ورقة/شاشة)، وأجزاء لونها واحد (إيد، كوباية، تيشيرت، علبة).
    بيرجّع الحاجات (حدود بكسور من الفيديو) وخريطة صغيرة فيها رقم الحاجة اللي في كل نقطة (-1 = مفيش)."""
    cap = cv2.VideoCapture(path)
    cap.set(cv2.CAP_PROP_POS_MSEC, max(0.0, t) * 1000)
    ok, fr = cap.read()
    cap.release()
    if not ok:
        raise RuntimeError("مش قادر يقرا الفريم ده من الفيديو")
    H0, W0 = fr.shape[:2]
    k = 360 / W0 if W0 > 360 else 1.0
    img = cv2.resize(fr, (int(W0 * k), int(H0 * k)), interpolation=cv2.INTER_AREA) if k != 1.0 else fr
    h, w = img.shape[:2]
    area = w * h
    out: list[dict] = []
    masks: list[np.ndarray] = []

    def add(mask: np.ndarray, kind: str, name: str, quad=None):
        cnts, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not cnts:
            return
        c = max(cnts, key=cv2.contourArea)
        poly = cv2.approxPolyDP(c, 0.006 * cv2.arcLength(c, True), True).reshape(-1, 2)
        if len(poly) < 3:
            return
        q = _order(quad if quad is not None else cv2.boxPoints(cv2.minAreaRect(c)))
        out.append({"kind": kind, "name": name, "poly": [[round(float(x) / w, 4), round(float(y) / h, 4)] for x, y in poly],
                    "quad": [round(float(v), 5) for p in q for v in (p[0] / w, p[1] / h)]})
        masks.append(mask.astype(bool))

    # الشخص وراسه
    pm = None
    if person_mask:
        m = cv2.imread(person_mask, cv2.IMREAD_UNCHANGED)
        if m is not None:
            a = m[..., 3] if m.ndim == 3 and m.shape[2] == 4 else (cv2.cvtColor(m, cv2.COLOR_BGR2GRAY) if m.ndim == 3 else m)
            pm = cv2.resize(a, (w, h)) > 128
    if head:
        hm = np.zeros((h, w), np.uint8)
        cv2.circle(hm, (int(head[0] * w), int(head[1] * h)), max(4, int(head[2] * w * 0.55)), 1, -1)
        if pm is not None:
            hm &= pm.astype(np.uint8)
        if hm.sum() > area * 0.002:
            add(hm, "follow", "الراس")
    # أجزاء لونها واحد (بعد تنعيم يخلي كل حاجة لون واحد تقريبًا)
    sm = cv2.pyrMeanShiftFiltering(img, 8, 22)
    lab = cv2.cvtColor(sm, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    K = 10
    _, lbl, _ = cv2.kmeans(lab, K, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 12, 1.0), 2, cv2.KMEANS_PP_CENTERS)
    lbl = lbl.reshape(h, w)
    ker = np.ones((5, 5), np.uint8)
    for c in range(K):
        mc = cv2.morphologyEx((lbl == c).astype(np.uint8), cv2.MORPH_OPEN, ker)
        n, cc, stats, _ = cv2.connectedComponentsWithStats(mc)
        for j in range(1, n):
            a = stats[j, cv2.CC_STAT_AREA]
            if area * 0.006 < a < area * 0.4:
                comp = cv2.morphologyEx((cc == j).astype(np.uint8), cv2.MORPH_CLOSE, ker)
                add(comp, "follow", "حاجة")
    # حاجات ليها 4 حواف واضحة (ورقة، شاشة، يافطة)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.dilate(cv2.Canny(cv2.bilateralFilter(gray, 7, 50, 50), 40, 120), np.ones((3, 3), np.uint8))
    cnts, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    for c in cnts:
        ca = cv2.contourArea(c)
        if not (area * 0.01 < ca < area * 0.6):
            continue
        ap = cv2.approxPolyDP(c, 0.03 * cv2.arcLength(c, True), True)
        if len(ap) == 4 and cv2.isContourConvex(ap) and _boxy(ap.reshape(4, 2)):
            mq = np.zeros((h, w), np.uint8)
            cv2.fillConvexPoly(mq, ap.reshape(4, 2).astype(np.int32), 1)
            add(mq, "surface", "سطح", ap.reshape(4, 2))
    if pm is not None and pm.sum() > area * 0.01:
        add(pm, "follow", "الشخص")
    # الخريطة: كل نقطة بتاخد أصغر حاجة فيها (الراس قبل الشخص، والكوباية قبل الحيطة)
    grid = np.full((h, w), -1, np.int16)
    best = np.full((h, w), np.inf)
    for i, m in enumerate(masks):
        a = m.sum()
        sel = m & (a < best)
        grid[sel] = i
        best[sel] = a
    return out, grid
