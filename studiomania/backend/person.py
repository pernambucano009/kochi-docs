"""🧍 قراءة الشخص في الفيديو: فصله عن الخلفية في كل فريم + مكان جسمه وراسه.

بيطلّع لكل فريم (على نفس سرعة رسم التايبوجرافي):
- صورة WebP شفافة للشخص لوحده (عشان الكلام يتحط وراه: الكلام تحت والشخص فوقه)
- مكانه: الصندوق حوالين الجسم، ونص الراس ونص قطرها (عشان الكلام يتقوّس حوالين الراس أو يتحط جنبه)

الموديل: MediaPipe selfie multiclass (256×256، بيشتغل على الـ CPU). بيتحمّل أول مرة بس.
"""
from __future__ import annotations

import json
import subprocess
import urllib.request
from pathlib import Path

import numpy as np

MODEL_URL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite"


def available() -> bool:
    try:
        import ai_edge_litert.interpreter  # noqa: F401
        return True
    except Exception:  # noqa: BLE001
        return False


def _model(models_dir: Path) -> Path:
    models_dir.mkdir(parents=True, exist_ok=True)
    f = models_dir / "selfie_multiclass_256x256.tflite"
    if not f.exists() or f.stat().st_size < 1_000_000:
        tmp = f.with_suffix(".part")
        urllib.request.urlretrieve(MODEL_URL, tmp)
        tmp.replace(f)
    return f


class Segmenter:
    def __init__(self, models_dir: Path):
        from ai_edge_litert.interpreter import Interpreter

        self.it = Interpreter(model_path=str(_model(models_dir)), num_threads=2)
        self.it.allocate_tensors()
        self.i = self.it.get_input_details()[0]["index"]
        self.o = self.it.get_output_details()[0]["index"]

    def mask(self, rgb: np.ndarray) -> np.ndarray:
        """صورة RGB (أي مقاس) ← احتمال إن البكسل شخص (256×256، من 0 لـ 1)."""
        from PIL import Image

        x = np.asarray(Image.fromarray(rgb).resize((256, 256), Image.BILINEAR), dtype=np.float32) / 255.0
        self.it.set_tensor(self.i, x[None])
        self.it.invoke()
        y = self.it.get_tensor(self.o)[0]
        if y.min() < 0 or y.max() > 1.001:   # لوجيتس ← احتمالات
            y = np.exp(y - y.max(-1, keepdims=True))
            y /= y.sum(-1, keepdims=True)
        return 1 - y[..., 0]   # كل حاجة غير الخلفية = الشخص (شعر، وش، جسم، هدوم)


def _components(on: np.ndarray) -> tuple[np.ndarray, list[tuple[int, int]], int, int]:
    """الأجزاء المتصلة على نسخة صغيرة: (الأرقام، [(رقم، حجم)] من الأكبر، sy، sx)."""
    h, w = on.shape
    sy, sx = max(1, h // 64), max(1, w // 64)
    small = on[::sy, ::sx].copy()
    # الراس والجسم ممكن يتفصلوا بخط رفيع (رقبة غامقة): بنوصّل الحتت القريبة من بعض
    for _ in range(2):   # بالطول بس، عشان شخصين جنب بعض مايتلزقوش
        d = small.copy()
        d[1:] |= small[:-1]; d[:-1] |= small[1:]
        small = d
    lab = np.zeros(small.shape, np.int32)
    sizes, cur = [], 0
    H, W = small.shape
    for y0 in range(H):
        for x0 in range(W):
            if small[y0, x0] and not lab[y0, x0]:
                cur += 1
                stack, n = [(y0, x0)], 0
                lab[y0, x0] = cur
                while stack:
                    y, x = stack.pop()
                    n += 1
                    for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                        if 0 <= yy < H and 0 <= xx < W and small[yy, xx] and not lab[yy, xx]:
                            lab[yy, xx] = cur
                            stack.append((yy, xx))
                sizes.append((cur, n))
    sizes.sort(key=lambda c: -c[1])
    return lab, sizes, sy, sx


def _part(on: np.ndarray, lab: np.ndarray, num: int, sy: int, sx: int) -> np.ndarray:
    h, w = on.shape
    keep = np.kron(lab == num, np.ones((sy, sx), bool))[:h, :w]
    if keep.shape != on.shape:
        keep = np.pad(keep, ((0, h - keep.shape[0]), (0, w - keep.shape[1])))
    return on & keep


def fill_holes(alpha: np.ndarray) -> np.ndarray:
    """الخروم جوه الشخص (شعر غامق، نضارة) بتتملي، عشان الكلام اللي وراه مايبانش من جوه راسه."""
    from PIL import Image, ImageFilter

    h, w = alpha.shape
    f = 4
    # الأول بنقفل الشقوق الصغيرة اللي بتفتح الخرم على برّه (تكبير وبعدين تصغير) على نسخة أصغر 4 مرات (أسرع بكتير)،
    # وبناخد منها الأماكن اللي اتملت بس (من غير ما الحواف تتنفخ)
    hs, ws = h // f, w // f
    small = alpha[: hs * f, : ws * f].reshape(hs, f, ws, f).mean((1, 3))
    k = max(3, (ws // 40) | 1)
    im = Image.fromarray((small * 255).astype(np.uint8))
    closed = np.asarray(im.filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.MinFilter(k)), dtype=np.float32) / 255
    gap = np.where(closed - small > 0.25, closed, 0).astype(np.float32)
    if gap.any():
        up = np.zeros((h, w), np.float32)
        up[: hs * f, : ws * f] = np.asarray(Image.fromarray(gap).resize((ws * f, hs * f), Image.BILINEAR), dtype=np.float32)
        alpha = np.maximum(alpha, up)
    on = alpha[: h // f * f, : w // f * f].reshape(h // f, f, w // f, f).max((1, 3)) > 0.4
    out = np.zeros_like(on)
    out[0, :], out[-1, :], out[:, 0], out[:, -1] = ~on[0, :], ~on[-1, :], ~on[:, 0], ~on[:, -1]
    for _ in range(400):   # الخلفية اللي توصل لحرف الكادر = برّه، الباقي خروم
        nxt = out.copy()
        nxt[1:] |= out[:-1]; nxt[:-1] |= out[1:]; nxt[:, 1:] |= out[:, :-1]; nxt[:, :-1] |= out[:, 1:]
        nxt &= ~on
        if (nxt == out).all():
            break
        out = nxt
    holes = ~on & ~out
    if not holes.any():
        return alpha
    soft = np.asarray(Image.fromarray(holes.astype(np.uint8) * 255).resize((w // f * f, h // f * f), Image.BILINEAR)
                      .filter(ImageFilter.GaussianBlur(f / 2)), dtype=np.float32) / 255
    full = np.zeros((h, w), np.float32)
    full[: soft.shape[0], : soft.shape[1]] = np.clip(soft * 1.6, 0, 1)
    return np.maximum(alpha, full)


def _solid(alpha: np.ndarray, st: dict) -> float:
    """قد إيه الراس متقصوصة صح (0..1). الضلمة أو الضهر للكاميرا بيخلّوها ضعيفة، ووقتها الكلام مايتحطش وراها."""
    h, w = alpha.shape
    cx, cy, r = st["head"][0] * w, st["head"][1] * h, st["head"][2] * w
    yy, xx = np.ogrid[:h, :w]
    inside = (xx - cx) ** 2 + (yy - cy) ** 2 <= (r * 0.8) ** 2
    if inside.sum() < 20 or r < w * 0.03:
        return 0.0
    return round(float((alpha[inside] > 0.75).mean()), 2)


def _stats_one(on: np.ndarray, cover: float) -> dict:
    h, w = on.shape
    rows, cols = np.where(on.any(1))[0], np.where(on.any(0))[0]
    y0, y1, x0, x1 = rows[0], rows[-1], cols[0], cols[-1]
    # الراس: من فوق الجسم لحد ما العرض يتضاعف (الكتاف). عرض الراس = متوسط العرض في الجزء ده
    widths = on[y0:y1 + 1].sum(1)
    first = widths[: max(3, int((y1 - y0) * 0.08))].max() if len(widths) else 1
    end = int(min(len(widths), (y1 - y0) * 0.45))
    for k in range(int((y1 - y0) * 0.06), end):
        if widths[k] > max(first, widths[: k + 1].max() * 0.55) * 1.9 and k > 4:
            end = k
            break
    rows = on[y0:y0 + max(end, 4)]
    ys, xs = np.where(rows)
    cx = float(xs.mean()) if len(xs) else (x0 + x1) / 2
    wmed = float(np.median(widths[max(1, end // 3):max(2, end)])) if end > 3 else (x1 - x0) * 0.3
    r = max(wmed / 2, 4.0)
    cy = y0 + r * 1.15
    return {"box": [round(float(x0) / w, 4), round(float(y0) / h, 4), round(float(x1) / w, 4), round(float(y1) / h, 4)],
            "head": [round(cx / w, 4), round(float(cy) / h, 4), round(r / w, 4)], "cover": round(cover, 3)}


def _stats(alpha: np.ndarray) -> dict | None:
    """الصندوق ومكان الراس من الماسك (0..1)، بكسور من عرض وطول الفريم.
    لو فيه أكتر من شخص (أو صورة جوه صورة) بيتحفظوا كلهم في others، والكادر النهائي بيختار اللي باين فيه."""
    on = alpha > 0.5
    if on.mean() < 0.01:
        return None
    lab, sizes, sy, sx = _components(on)
    if not sizes:
        return None
    parts = [c for c in sizes[:3] if c[1] >= sizes[0][1] * 0.2]
    found = []
    for num, _ in parts:
        part = _part(on, lab, num, sy, sx)
        if part.any():
            st = _stats_one(part, float(part.mean()))
            st["solid"] = _solid(alpha, st)
            found.append(st)
    if not found:
        return None
    main = dict(found[0])
    if len(found) > 1:
        main["others"] = found[1:]
    return main


def _box(x: np.ndarray, r: int) -> np.ndarray:
    """متوسط مربع (2r+1)×(2r+1) حوالين كل بكسل (بالجمع التراكمي، سريع)."""
    pad = np.pad(x, ((r + 1, r), (r + 1, r)), mode="edge").astype(np.float64)
    c = pad.cumsum(0).cumsum(1)
    k = 2 * r + 1
    return ((c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)).astype(np.float32)


def guided(gray: np.ndarray, p: np.ndarray, r: int, eps: float = 1e-3, s: int = 2) -> np.ndarray:
    """فلتر موجَّه (He et al., النسخة السريعة): حواف الماسك بتلزق على الحواف الحقيقية في الصورة (الشعر والوش)."""
    from PIL import Image

    h, w = gray.shape
    Is, ps = gray[::s, ::s], p[::s, ::s]
    rs = max(1, r // s)
    mI, mp = _box(Is, rs), _box(ps, rs)
    var = _box(Is * Is, rs) - mI * mI
    cov = _box(Is * ps, rs) - mI * mp
    A = cov / (var + eps)
    B = mp - A * mI
    mA, mB = _box(A, rs), _box(B, rs)
    up = lambda z: np.asarray(Image.fromarray(z).resize((w, h), Image.BILINEAR), dtype=np.float32)  # noqa: E731
    return up(mA) * gray + up(mB)


def analyze(ffmpeg: str, src: Path, out_dir: Path, models_dir: Path, fps: int, duration: float, width: int = 540,
            on_step=None, max_seconds: float = 120, mask_width: int = 720) -> dict:
    """بيكتب out_dir/p_00000.webp (الشخص لوحده، 540) وm_00000.webp (شكل الشخص بس بدقة الفيديو، للكلام اللي وراه)
    ويرجّع {fps, n, sw, sh, mw, frames: [stats|None, ...]}."""
    from PIL import Image

    out_dir.mkdir(parents=True, exist_ok=True)
    for f in [*out_dir.glob("p_*.webp"), *out_dir.glob("m_*.webp")]:
        f.unlink()
    seg = Segmenter(models_dir)
    dur = min(duration, max_seconds)
    probe = subprocess.run([ffmpeg, "-hide_banner", "-i", str(src)], capture_output=True, text=True).stderr
    import re
    m = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", probe)
    sw, sh = (int(m.group(1)), int(m.group(2))) if m else (width, width)
    even = lambda v: max(2, int(v / 2 + 0.5) * 2)  # noqa: E731
    # الماسك بدقة قريبة من الفيديو (لحد 720) عشان حواف الشعر ماتتغبّش لما تتكبّر في الكادر
    # الطول بنحسبه إحنا ونبعته لـ FFmpeg بالظبط: لو كل واحد قرّب بطريقة، الفريمات بتتقري مزاحة وبتبعد عن الشخص كل ما الفيديو يمشي
    mw = even(min(mask_width, sw))
    mh = even(mw * sh / sw)
    ph = even(width * sh / sw)
    proc = subprocess.Popen([ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(src), "-t", f"{dur:.3f}",
                             "-vf", f"fps={fps},scale={mw}:{mh}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    size = mw * mh * 3
    r = max(3, mw // 240)
    frames, i, prev_a, prev_g = [], 0, None, None
    while True:
        buf = proc.stdout.read(size)
        if len(buf) < size:
            break
        rgb = np.frombuffer(buf, np.uint8).reshape(mh, mw, 3)
        gray = (rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114).astype(np.float32) / 255
        m256 = seg.mask(rgb)
        p = np.asarray(Image.fromarray(m256.astype(np.float32)).resize((mw, mh), Image.BILINEAR), dtype=np.float32)
        p = np.clip((p - 0.35) / 0.3, 0, 1)
        # 1) الحواف على الصورة الحقيقية، و2) حافة حادة (من غير هالة ضبابية حوالين الشعر)
        a = np.clip((guided(gray, p, r) - 0.5) * 6 + 0.5, 0, 1)
        # 3) ثبات بين الفريمات: اللي مااتحركش بياخد من الفريم اللي قبله (مايرتعشش)، واللي اتحرك بيمشي مع الفريم الجديد على طول
        if prev_a is not None:
            # الرعشة فرق صغير في الحافة: ده بس اللي بيتنعّم. الحركة الحقيقية (فرق كبير أو الصورة اتغيرت) بتاخد الفريم الجديد على طول من غير ديل
            move = _box(np.abs(gray - prev_g), 3)
            k = np.where((np.abs(a - prev_a) < 0.35) & (move < 0.04), 0.5, 1.0)
            a = a * k + prev_a * (1 - k)
        prev_a, prev_g = a, gray
        a = fill_holes(a)
        # 32 درجة شفافية بس: الفرق مش باين في الحافة، والملف بيصغر للنص تقريبًا
        q8 = (np.round(a * 31) * (255 / 31)).astype(np.uint8)
        Image.fromarray(np.dstack([np.zeros((mh, mw, 3), np.uint8), q8]), "RGBA").save(out_dir / f"m_{i:05d}.webp", "WEBP", quality=60, method=1)
        # النسخة الصغيرة: مكان الشخص وراسه، والشخص لوحده بألوانه (للكاميرا الحرارية والنقط)
        lo = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((width, ph), Image.BILINEAR), dtype=np.float32) / 255
        frames.append(_stats(lo))
        im = Image.fromarray(rgb).resize((width, ph), Image.BILINEAR).convert("RGBA")
        im.putalpha(Image.fromarray((lo * 255).astype(np.uint8)))
        im.save(out_dir / f"p_{i:05d}.webp", "WEBP", quality=70, method=2)
        i += 1
        if on_step and i % fps == 0:
            on_step(i // fps, int(dur))
    proc.wait(timeout=60)
    info = {"fps": fps, "n": i, "sw": sw, "sh": sh, "mw": mw, "frames": frames}
    (out_dir / "person.json").write_text(json.dumps(info), encoding="utf-8")
    return info


def summary(info: dict | None) -> dict:
    """ملخص للموديل اللي بيوزّع الكلام: إمتى فيه شخص وفين راسه."""
    if not info or not info.get("frames"):
        return {"present": False}
    fr = info["frames"]
    have = [f for f in fr if f]
    if len(have) < len(fr) * 0.3:
        return {"present": False}
    hx = float(np.median([f["head"][0] for f in have]))
    hy = float(np.median([f["head"][1] for f in have]))
    cover = float(np.median([f["cover"] for f in have]))
    side = "left" if hx < 0.4 else "right" if hx > 0.6 else "center"
    return {"present": True, "head_x": round(hx, 2), "head_y": round(hy, 2), "cover": round(cover, 2), "side": side,
            "share": round(len(have) / len(fr), 2)}
