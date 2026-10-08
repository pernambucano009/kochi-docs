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


def _largest(on: np.ndarray) -> np.ndarray:
    """أكبر جزء متصل بس (إيدين أو حاجات طايرة في الكادر ماتلخبطش مكان الراس). بيشتغل على نسخة صغيرة."""
    h, w = on.shape
    sy, sx = max(1, h // 64), max(1, w // 64)
    small = on[::sy, ::sx]
    lab = np.zeros(small.shape, np.int32)
    best, best_n, cur = 0, 0, 0
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
                if n > best_n:
                    best, best_n = cur, n
    keep = np.kron(lab == best, np.ones((sy, sx), bool))[:h, :w]
    if keep.shape != on.shape:
        keep = np.pad(keep, ((0, h - keep.shape[0]), (0, w - keep.shape[1])))
    return on & keep


def _stats(alpha: np.ndarray) -> dict | None:
    """الصندوق ومكان الراس من الماسك (0..1)، بكسور من عرض وطول الفريم."""
    h, w = alpha.shape
    on = alpha > 0.5
    if on.mean() < 0.01:
        return None
    on = _largest(on)
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
    return {"box": [round(x0 / w, 4), round(y0 / h, 4), round(x1 / w, 4), round(y1 / h, 4)],
            "head": [round(cx / w, 4), round(cy / h, 4), round(r / w, 4)], "cover": round(float(on.mean()), 3)}


def analyze(ffmpeg: str, src: Path, out_dir: Path, models_dir: Path, fps: int, duration: float, width: int = 540,
            on_step=None, max_seconds: float = 120) -> dict:
    """بيكتب out_dir/p_00000.webp … ويرجّع {fps, n, sw, sh, frames: [stats|None, ...]}."""
    from PIL import Image

    out_dir.mkdir(parents=True, exist_ok=True)
    for f in out_dir.glob("p_*.webp"):
        f.unlink()
    seg = Segmenter(models_dir)
    dur = min(duration, max_seconds)
    probe = subprocess.run([ffmpeg, "-hide_banner", "-i", str(src)], capture_output=True, text=True).stderr
    # الفريمات بمقاس ثابت بالعرض والطول بنفس النسبة
    proc = subprocess.Popen([ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(src), "-t", f"{dur:.3f}",
                             "-vf", f"fps={fps},scale={width}:-2", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    import re
    m = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", probe)
    sw, sh = (int(m.group(1)), int(m.group(2))) if m else (width, width)
    ph = int(round(width * sh / sw / 2)) * 2
    size = width * ph * 3
    frames, i, prev = [], 0, None
    while True:
        buf = proc.stdout.read(size)
        if len(buf) < size:
            break
        rgb = np.frombuffer(buf, np.uint8).reshape(ph, width, 3)
        m256 = seg.mask(rgb)
        if prev is not None:   # تنعيم بسيط بين الفريمات عشان الحواف ماترتعشش
            m256 = m256 * 0.7 + prev * 0.3
        prev = m256
        alpha = np.asarray(Image.fromarray((np.clip((m256 - 0.35) / 0.3, 0, 1) * 255).astype(np.uint8)).resize((width, ph), Image.BICUBIC),
                           dtype=np.float32) / 255
        st = _stats(alpha)
        frames.append(st)
        im = Image.fromarray(rgb).convert("RGBA")
        im.putalpha(Image.fromarray((alpha * 255).astype(np.uint8)))
        im.save(out_dir / f"p_{i:05d}.webp", "WEBP", quality=82, method=2)
        i += 1
        if on_step and i % fps == 0:
            on_step(i // fps, int(dur))
    proc.wait(timeout=60)
    info = {"fps": fps, "n": i, "sw": sw, "sh": sh, "frames": frames}
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
