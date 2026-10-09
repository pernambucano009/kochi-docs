"""🪄 المشهد: تغيير الخلفية ورا الشخص، وشيل حاجات من الفيديو.

- camera(): حركة الكاميرا في كل لقطة (من نقط الخلفية بس، الشخص مستبعد) عشان الخلفية الجديدة تتحرك معاها،
  ومكان القطعات بين اللقطات.
- removal(): بيشيل حاجة من جزء من الفيديو: المكان اللي وراها بيتاخد من الفريمات التانية اللي الحاجة فيها كانت
  اتحركت أو الكاميرا شافت اللي وراها (median)، واللي عمره ما ظهر بيتملا (تقريبي، أو من صورة الـ AI لو اتطلبت).
  الناتج فيديو نضيف للجزء ده + فيديو للماسك (فين اتغير).
- composite(): التصدير: الفيديو الأصلي ← الحاجات اللي اتشالت ← الخلفية الجديدة ورا الشخص."""
from __future__ import annotations

import subprocess
from pathlib import Path

import cv2
import numpy as np

FPS = 30
CUT = 38          # فرق الصورة الصغيرة اللي بيعتبر قطع (نفس التراك)
WORK = 360        # عرض الفريمات لحساب حركة الكاميرا


def _alpha(path: Path, w: int, h: int) -> np.ndarray | None:
    """ماسك الشخص (0..1) بمقاس معين، من صورة m_xxxxx.webp."""
    if not path.exists():
        return None
    m = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if m is None:
        return None
    a = m[..., 3] if m.ndim == 3 and m.shape[2] == 4 else (cv2.cvtColor(m, cv2.COLOR_BGR2GRAY) if m.ndim == 3 else m)
    if a.shape[1] != w or a.shape[0] != h:
        a = cv2.resize(a, (w, h), interpolation=cv2.INTER_LINEAR)
    return a.astype(np.float32) / 255.0


def _read(cap, step: int):
    """الفريم الجاي بـ 30 في الثانية (لو الفيديو 60 بيتخطى فريم)."""
    ok, fr = cap.read()
    for _ in range(step - 1):
        if not cap.grab():
            break
    return ok, fr


def _seek(cap, i: int, step: int) -> None:
    cap.set(cv2.CAP_PROP_POS_FRAMES, i * step)


def mask_path(person_dir: Path, i: int) -> Path:
    return person_dir / f"m_{i:05d}.webp"


# ---------------------------------------------------------------- 🎥 حركة الكاميرا

def camera(path: str, person_dir: Path | None = None, progress=None) -> dict:
    """{fps, n, w, h, shots: [[f0, f1]], cam: [[a, b, tx, c, d, ty]]} — cam بيحوّل من أول فريم في اللقطة للفريم ده (بكسل الفيديو)."""
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise RuntimeError("مش قادر يفتح الفيديو")
    vfps = cap.get(cv2.CAP_PROP_FPS) or FPS
    step = max(1, round(vfps / FPS))   # الفريمات بتتعد بـ 30 في الثانية (زي ماسكات الشخص)
    fps = vfps / step
    W0, H0 = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int((cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0) / step)
    k = WORK / W0 if W0 > WORK else 1.0
    w, h = int(W0 * k), int(H0 * k)
    lk = dict(winSize=(21, 21), maxLevel=3, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01))
    ker = np.ones((9, 9), np.uint8)
    cams, shots = [], [[0, 0]]
    M = np.eye(3)
    prev = prev_t = prev_m = None
    i = 0
    while True:
        ok, fr = _read(cap, step)
        if not ok:
            break
        g = cv2.cvtColor(cv2.resize(fr, (w, h), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
        th = cv2.resize(g, (64, 36), interpolation=cv2.INTER_AREA).astype(np.float32)
        # نقط الخلفية بس: الشخص (ومعاه هامش) مستبعد عشان حركته ماتتحسبش حركة كاميرا
        bm = np.full((h, w), 255, np.uint8)
        a = _alpha(mask_path(person_dir, i), w, h) if person_dir else None
        if a is not None:
            bm[cv2.dilate((a > 0.2).astype(np.uint8), ker) > 0] = 0
        if prev is not None:
            if float(np.mean(np.abs(th - prev_t))) > CUT:
                M = np.eye(3)
                shots[-1][1] = i - 1
                shots.append([i, i])
            else:
                S = np.eye(3)
                pts = cv2.goodFeaturesToTrack(prev, maxCorners=400, qualityLevel=0.01, minDistance=8, blockSize=7, mask=prev_m)
                if pts is not None and len(pts) >= 12:
                    p1, st, _ = cv2.calcOpticalFlowPyrLK(prev, g, pts, None, **lk)
                    pb, stb, _ = cv2.calcOpticalFlowPyrLK(g, prev, p1, None, **lk)
                    p0, p1, pb = pts.reshape(-1, 2), p1.reshape(-1, 2), pb.reshape(-1, 2)
                    good = (st.reshape(-1) == 1) & (stb.reshape(-1) == 1) & (np.linalg.norm(pb - p0, axis=1) < 1.0)
                    if good.sum() >= 12:
                        A, inl = cv2.estimateAffinePartial2D(p0[good], p1[good], method=cv2.RANSAC, ransacReprojThreshold=2.0)
                        flow = float(np.median(np.linalg.norm(p1[good] - p0[good], axis=1)))
                        # كاميرا ثابتة: حركة أقل من ربع بكسل دي رعشة حساب، مش حركة (من غيرها الخلفية بتزحف بالراحة)
                        if A is not None and inl is not None and inl.sum() >= 10 and flow > 0.25:
                            S = np.vstack([A, [0, 0, 1]])
                M = S @ M
        cams.append(M.copy())
        prev, prev_t, prev_m = g, th, bm
        i += 1
        if progress and total and i % 30 == 0:
            progress(i / total)
    cap.release()
    shots[-1][1] = max(0, i - 1)
    D, Di = np.diag([1 / k, 1 / k, 1]), np.diag([k, k, 1])
    out = []
    for C in cams:
        F = D @ C @ Di   # من بكسل الصورة الصغيرة لبكسل الفيديو
        out.append([round(float(F[0, 0]), 6), round(float(F[0, 1]), 6), round(float(F[0, 2]), 3),
                    round(float(F[1, 0]), 6), round(float(F[1, 1]), 6), round(float(F[1, 2]), 3)])
    return {"fps": round(fps, 4), "n": i, "w": W0, "h": H0, "shots": shots, "cam": out}


def cam_mat(c) -> np.ndarray:
    return np.array([[c[0], c[1], c[2]], [c[3], c[4], c[5]], [0, 0, 1]], np.float64)


def shots_on(shots: list, frames: list) -> list[bool]:
    """اللقطة فيها شخص (أغلب فريماتها)؟ الخلفية بتتغير فيها بس؛ لقطات الـ B-roll بتفضل زي ما هي."""
    out = []
    for f0, f1 in shots:
        seg = frames[f0:f1 + 1]
        out.append(bool(seg) and sum(1 for f in seg if f) / len(seg) >= 0.5)
    return out


# ---------------------------------------------------------------- 🧽 شيل حاجة

def _encoder(ffmpeg: str, out: Path, w: int, h: int, fps: float, crf: int = 17):
    return subprocess.Popen([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24",
                             "-s", f"{w}x{h}", "-r", f"{fps:.4f}", "-i", "-", "-c:v", "libx264", "-preset", "veryfast",
                             "-crf", str(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)],
                            stdin=subprocess.PIPE, stderr=subprocess.PIPE)


def _close(proc) -> None:
    proc.stdin.close()
    err = proc.stderr.read().decode(errors="ignore")
    if proc.wait(timeout=600) != 0:
        raise RuntimeError(f"حفظ الفيديو فشل: {err.strip()[-300:]}")


def removal(ffmpeg: str, path: str, out_clean: Path, out_mask: Path, f0: int, f1: int, fref: int, mask_fn, cams: list,
            ai_plate: np.ndarray | None = None, progress=None) -> dict:
    """mask_fn(i) → ماسك uint8 (255 = الحاجة) بمقاس الفيديو للفريم i. cams: مصفوفة الكاميرا لكل فريم (من camera()).
    بيرجّع {holes: نسبة المكان اللي عمره ما ظهر، bbox}."""
    cap = cv2.VideoCapture(path)
    vfps = cap.get(cv2.CAP_PROP_FPS) or FPS
    step = max(1, round(vfps / FPS))
    fps = vfps / step
    W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    C = {i: cam_mat(cams[i]) if i < len(cams) else np.eye(3) for i in range(f0, f1 + 1)}
    # 1) المكان اللي الحاجة بتعدّي عليه في إحداثيات أول فريم في اللقطة (عشان الكاميرا لو اتحركت)
    union = np.zeros((H, W), np.uint8)
    for i in range(f0, f1 + 1):
        m = mask_fn(i)
        if m is not None and m.any():
            union |= cv2.warpAffine(m, np.linalg.inv(C[i])[:2], (W, H), flags=cv2.INTER_NEAREST)
    if not union.any():
        raise RuntimeError("مش لاقي الحاجة في الفريمات دي")
    x, y, bw, bh = cv2.boundingRect(union)
    pad = max(16, int(0.02 * W))
    x0, y0, x1, y1 = max(0, x - pad), max(0, y - pad), min(W, x + bw + pad), min(H, y + bh + pad)
    rw, rh = x1 - x0, y1 - y0
    # الحساب بدقة أقل لو المكان كبير (الذاكرة)
    s = min(1.0, (360_000 / max(1, rw * rh)) ** 0.5)
    sw, sh = max(8, int(rw * s)), max(8, int(rh * s))
    T = np.array([[s, 0, -x0 * s], [0, s, -y0 * s], [0, 0, 1]], np.float64)   # إحداثيات اللقطة → المربع الصغير
    # 2) الخلفية اللي ورا الحاجة: من فريمات كتير (الوسيط)، كل فريم بياخد بس النقط اللي الحاجة مش عليها
    n = f1 - f0 + 1
    idx = sorted(set(np.linspace(f0, f1, min(n, 36)).round().astype(int).tolist()))
    stack, seen = [], np.zeros((sh, sw), np.int32)
    for i in idx:
        _seek(cap, i, step)
        ok, fr = cap.read()
        if not ok:
            continue
        A = (T @ np.linalg.inv(C[i]))[:2]
        roi = cv2.warpAffine(fr, A, (sw, sh), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0).astype(np.float32)
        m = mask_fn(i)
        mm = cv2.warpAffine(m if m is not None else np.zeros((H, W), np.uint8), A, (sw, sh), flags=cv2.INTER_NEAREST, borderValue=255)
        valid = cv2.warpAffine(np.full((H, W), 255, np.uint8), A, (sw, sh), flags=cv2.INTER_NEAREST, borderValue=0)
        bad = (mm > 0) | (valid == 0)
        roi[bad] = np.nan
        stack.append(roi)
        seen += (~bad).astype(np.int32)
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        plate = np.nanmedian(np.stack(stack), axis=0) if stack else np.zeros((sh, sw, 3), np.float32)
    holes = (seen == 0)
    plate = np.nan_to_num(plate, nan=0.0).clip(0, 255).astype(np.uint8)
    u_small = cv2.warpAffine(union, T[:2], (sw, sh), flags=cv2.INTER_NEAREST) > 0
    hole_mask = (holes & u_small)
    hole_frac = float(hole_mask.sum()) / max(1, int(u_small.sum()))
    if hole_mask.any():
        if ai_plate is not None:
            # صورة الـ AI (بإحداثيات الفريم اللي اتطلبت عليه) للمكان اللي عمره ما ظهر
            ai = cv2.resize(ai_plate, (W, H), interpolation=cv2.INTER_AREA) if ai_plate.shape[:2] != (H, W) else ai_plate
            ai_roi = cv2.warpAffine(ai, (T @ np.linalg.inv(C.get(fref, np.eye(3))))[:2], (sw, sh), flags=cv2.INTER_LINEAR)
            # ألوان صورة الـ AI بتتظبط على قد الخلفية الحقيقية اللي حوالين المكان ده
            ring = cv2.dilate(hole_mask.astype(np.uint8), np.ones((15, 15), np.uint8)).astype(bool) & ~holes
            if ring.sum() > 50:
                d = plate[ring].astype(np.float32).mean(0) - ai_roi[ring].astype(np.float32).mean(0)
                ai_roi = (ai_roi.astype(np.float32) + d).clip(0, 255).astype(np.uint8)
            plate[hole_mask] = ai_roi[hole_mask]
        else:
            plate = cv2.inpaint(plate, (holes & cv2.dilate(u_small.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)).astype(np.uint8) * 255,
                                max(3, int(6 * s)), cv2.INPAINT_TELEA)
    # 3) كل فريم: الخلفية دي بتترسم مكان الحاجة (بحافة ناعمة) والباقي زي ما هو
    feather = max(3.0, W / 270)
    enc_c, enc_m = _encoder(ffmpeg, out_clean, W, H, fps), _encoder(ffmpeg, out_mask, W, H, fps, crf=20)
    Ti = np.linalg.inv(T)
    try:
        _seek(cap, f0, step)
        for i in range(f0, f1 + 1):
            ok, fr = _read(cap, step)
            if not ok:
                break
            m = mask_fn(i)
            if m is None:
                m = np.zeros((H, W), np.uint8)
            a = cv2.GaussianBlur(cv2.dilate(m, np.ones((5, 5), np.uint8)).astype(np.float32) / 255, (0, 0), feather)
            a = np.clip(a * 1.6, 0, 1)
            pl = cv2.warpAffine(plate, (C[i] @ Ti)[:2], (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            a3 = a[..., None]
            out = (fr.astype(np.float32) * (1 - a3) + pl.astype(np.float32) * a3).clip(0, 255).astype(np.uint8)
            enc_c.stdin.write(out.tobytes())
            enc_m.stdin.write(cv2.cvtColor((a * 255).astype(np.uint8), cv2.COLOR_GRAY2BGR).tobytes())
            if progress and (i - f0) % 15 == 0:
                progress((i - f0) / max(1, n))
    finally:
        cap.release()
        _close(enc_c)
        _close(enc_m)
    return {"holes": round(hole_frac, 4), "bbox": [round(x0 / W, 4), round(y0 / H, 4), round(x1 / W, 4), round(y1 / H, 4)]}


def poly_masks(polys: dict, W: int, H: int, grow: float = 0.012):
    """ماسك من حدود (بكسور) لكل فريم، بهامش صغير (الحواف والضل اللي حوالين الحاجة)."""
    g = max(3, int(grow * W)) | 1
    ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (g, g))

    def fn(i):
        p = polys.get(i)
        if p is None:
            return None
        m = np.zeros((H, W), np.uint8)
        cv2.fillPoly(m, [np.round(np.array(p) * [W, H]).astype(np.int32)], 255)
        return cv2.dilate(m, ker)
    return fn


def person_masks(person_dir: Path, W: int, H: int, grow: float = 0.012):
    g = max(3, int(grow * W)) | 1
    ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (g, g))

    def fn(i):
        a = _alpha(mask_path(person_dir, i), W, H)
        return None if a is None else cv2.dilate(((a > 0.15) * 255).astype(np.uint8), ker)
    return fn


# ---------------------------------------------------------------- 🎬 التصدير

def _cover(img: np.ndarray, W: int, H: int, zoom: float = 1.0) -> tuple[np.ndarray, np.ndarray]:
    """الصورة على قد الكادر (cover) ومصفوفة مكانها: من بكسل الصورة لبكسل الكادر."""
    ih, iw = img.shape[:2]
    k = max(W / iw, H / ih) * zoom
    P = np.array([[k, 0, (W - iw * k) / 2], [0, k, (H - ih * k) / 2], [0, 0, 1]], np.float64)
    return img, P


class _Loop:
    """فيديو الخلفية: فريم ورا فريم، ولما يخلص بيبدأ من الأول."""
    def __init__(self, path: str):
        self.path = path
        self.cap = cv2.VideoCapture(path)

    def next(self):
        ok, fr = self.cap.read()
        if not ok:
            self.cap.release()
            self.cap = cv2.VideoCapture(self.path)
            ok, fr = self.cap.read()
        return fr if ok else None

    def close(self):
        self.cap.release()


def composite(ffmpeg: str, in_args: list[str], out: Path, W: int, H: int, fps: int, total: float, removals: list[dict],
              bg: dict | None, progress=None) -> None:
    """removals: [{f0, f1, clean, mask}] — bg: {kind, color, image, video, blur, dim, follow, cam, on: [bool لكل فريم], person_dir, n}."""
    n = int(round(total * fps))
    dec = subprocess.Popen([ffmpeg, "-hide_banner", "-loglevel", "error", *in_args, "-t", f"{total:.3f}",
                            "-vf", f"fps={fps},scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                           stdout=subprocess.PIPE)
    enc = _encoder(ffmpeg, out, W, H, fps, crf=17)
    caps: dict[int, tuple] = {}
    img = P = None
    loop = None
    if bg:
        if bg["kind"] == "image" and bg.get("image"):
            im = cv2.imread(bg["image"], cv2.IMREAD_COLOR)
            if im is not None:
                img, P = _cover(im, W, H, 1.12 if bg.get("follow") else 1.0)
        elif bg["kind"] == "video" and bg.get("video"):
            loop = _Loop(bg["video"])
        col = bg.get("color") or "#101010"
        solid = np.zeros((H, W, 3), np.uint8)
        solid[:] = (int(col[5:7], 16), int(col[3:5], 16), int(col[1:3], 16))
    try:
        for i in range(n):
            buf = dec.stdout.read(W * H * 3)
            if len(buf) < W * H * 3:
                break
            fr = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
            for j, r in enumerate(removals):
                if r["f0"] <= i <= r["f1"] and caps.get(j, (1,))[0] is not None:
                    if j not in caps:
                        cc, cm = cv2.VideoCapture(r["clean"]), cv2.VideoCapture(r["mask"])
                        cc.set(cv2.CAP_PROP_POS_FRAMES, i - r["f0"])
                        cm.set(cv2.CAP_PROP_POS_FRAMES, i - r["f0"])
                        caps[j] = (cc, cm)
                    okc, c = caps[j][0].read()
                    okm, m = caps[j][1].read()
                    if okc and okm:
                        if c.shape[:2] != (H, W):
                            c, m = cv2.resize(c, (W, H)), cv2.resize(m, (W, H))
                        a = (m[..., :1].astype(np.float32) / 255)
                        fr = (fr * (1 - a) + c * a).astype(np.uint8)
                elif i > r["f1"] and caps.get(j, (None,))[0] is not None:
                    caps[j][0].release(); caps[j][1].release()
                    caps[j] = (None, None)
            if bg and i < bg.get("n", 0) and (bg["on"][i] if i < len(bg["on"]) else False):
                a = _alpha(mask_path(bg["person_dir"], i), W, H)
                if a is not None:
                    a = np.clip((a - 0.08) / 0.92, 0, 1)   # الحافة بتتشد شوية: أقل من الخلفية القديمة حوالين الشخص
                    C = cam_mat(bg["cam"][i]) if bg.get("follow") and bg.get("cam") and i < len(bg["cam"]) else np.eye(3)
                    kind = bg["kind"]
                    if kind == "blur":
                        # تغبيش من غير ما ألوان الشخص تسيح على الخلفية: الخلفية بس بتتغبّش وبتتقسم على مكانها
                        q = 4
                        sm = cv2.resize(fr, (W // q, H // q), interpolation=cv2.INTER_AREA).astype(np.float32)
                        wt = cv2.resize(1 - a, (W // q, H // q), interpolation=cv2.INTER_AREA)
                        sig = max(1.0, float(bg.get("blur") or 18) / q)
                        num = cv2.GaussianBlur(sm * wt[..., None], (0, 0), sig)
                        den = cv2.GaussianBlur(wt, (0, 0), sig)[..., None]
                        b = cv2.resize((num / np.maximum(den, 1e-3)).clip(0, 255).astype(np.uint8), (W, H), interpolation=cv2.INTER_LINEAR)
                    elif kind == "image" and img is not None:
                        b = cv2.warpAffine(img, (C @ P)[:2], (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
                    elif kind == "video" and loop is not None:
                        v = loop.next()
                        if v is None:
                            b = solid
                        else:
                            v, Pv = _cover(v, W, H, 1.12 if bg.get("follow") else 1.0)
                            b = cv2.warpAffine(v, (C @ Pv)[:2], (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
                    else:
                        b = solid
                    dim = float(bg.get("dim") or 0)
                    if dim > 0:
                        b = (b.astype(np.float32) * (1 - dim)).astype(np.uint8)
                    a3 = a[..., None]
                    fr = (fr.astype(np.float32) * a3 + b.astype(np.float32) * (1 - a3)).clip(0, 255).astype(np.uint8)
            enc.stdin.write(fr.tobytes())
            if progress and i % fps == 0:
                progress(i / max(1, n))
    finally:
        dec.stdout.close()
        dec.wait(timeout=60)
        for cc, cm in caps.values():
            if cc is not None:
                cc.release(); cm.release()
        if loop:
            loop.close()
        _close(enc)


def polys_from_track(tr: dict, poly: list, fref: int, f0: int, f1: int) -> dict:
    """حدود الحاجة (بكسور) في كل فريم: الحدود اللي اتحددت في fref بتتحرك زي أركان التراك."""
    i0 = int(round(tr["t0"] * FPS))
    qs = tr["q"]
    q4 = lambda q: np.array(q, np.float32).reshape(4, 2)  # noqa: E731
    r = min(max(fref - i0, 0), len(qs) - 1)
    qref = q4(qs[r])
    p = np.array(poly, np.float32).reshape(-1, 1, 2)
    out = {}
    for i in range(f0, f1 + 1):
        j = min(max(i - i0, 0), len(qs) - 1)
        Hm = cv2.getPerspectiveTransform(qref, q4(qs[j]))
        out[i] = cv2.perspectiveTransform(p, Hm).reshape(-1, 2).tolist()
    return out
