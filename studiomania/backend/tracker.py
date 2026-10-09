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
    mask = np.zeros(gray.shape, np.uint8)
    cv2.fillConvexPoly(mask, quad.astype(np.int32), 255)
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


def track(path: str, t0: float, t1: float, tref: float, box: list[float], mode: str = "follow", progress=None) -> dict:
    """box: [x0, y0, x1, y1] بكسور من مقاس الفيديو في الثانية tref. بيرجّع {t0, fps, q: [[8 أرقام]...]}"""
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
