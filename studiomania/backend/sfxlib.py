"""🔉 مكتبة مؤثرات صوتية للمونتاج (زي كاب كات): كلها متولّدة بالحساب، فمفيش ملفات صوت ليها حقوق في الكود.
بتتعمل مرة واحدة على السيرفر أول ما حد يطلبها."""
from __future__ import annotations

import wave
from pathlib import Path

import numpy as np

SR = 44100


def _t(sec: float) -> np.ndarray:
    return np.arange(int(SR * sec)) / SR


def _env(n: int, attack: float, decay: float) -> np.ndarray:
    """ظرف بسيط: طلوع سريع ونزول أُسّي."""
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-np.maximum(0, t - attack) / max(decay, 1e-4))


def _noise(sec: float, seed: int) -> np.ndarray:
    return np.random.default_rng(seed).standard_normal(int(SR * sec))


def _bandpass(x: np.ndarray, lo: np.ndarray | float, hi: np.ndarray | float) -> np.ndarray:
    """فلتر تقريبي في الترددات (كفاية للمؤثرات)، والحدود ممكن تتغير مع الوقت (بنقسّم على قطع)."""
    out = np.zeros_like(x)
    n, step = len(x), 2048
    lo_a = np.broadcast_to(np.asarray(lo, float), (n,)) if np.ndim(lo) else np.full(n, float(lo))
    hi_a = np.broadcast_to(np.asarray(hi, float), (n,)) if np.ndim(hi) else np.full(n, float(hi))
    win = np.hanning(step * 2)
    for s in range(0, n, step):
        seg = x[s:s + step * 2]
        if len(seg) < 8:
            break
        w = win[:len(seg)]
        f = np.fft.rfftfreq(len(seg), 1 / SR)
        k = min(n - 1, s + step)
        mask = (f >= lo_a[k]) & (f <= hi_a[k])
        y = np.fft.irfft(np.fft.rfft(seg * w) * mask, len(seg))
        out[s:s + len(seg)] += y
    return out


def _norm(x: np.ndarray, peak: float = 0.85) -> np.ndarray:
    m = np.max(np.abs(x)) or 1.0
    return x / m * peak


def whoosh(rev: bool = False) -> np.ndarray:
    d = 0.7
    t = _t(d)
    sweep = 300 + 4000 * np.sin(np.pi * t / d) ** 2
    x = _bandpass(_noise(d, 1), sweep * 0.5, sweep * 1.4) * np.sin(np.pi * t / d) ** 1.5
    return x[::-1] if rev else x


def pop() -> np.ndarray:
    t = _t(0.18)
    f = 900 * np.exp(-t * 28) + 180
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(len(t), 0.002, 0.04)


def bubble() -> np.ndarray:
    t = _t(0.25)
    f = 300 + 1400 * (t / 0.25) ** 0.6
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(len(t), 0.005, 0.07)


def ding(f0: float = 1318.5) -> np.ndarray:
    t = _t(1.4)
    x = sum(a * np.sin(2 * np.pi * f0 * m * t) for m, a in ((1, 1), (2.01, 0.4), (3.02, 0.18), (4.2, 0.08)))
    return x * _env(len(t), 0.003, 0.45)


def click() -> np.ndarray:
    t = _t(0.05)
    x = _bandpass(_noise(0.05, 3), 1500, 9000) * _env(len(t), 0.0005, 0.006)
    return x + 0.4 * np.sin(2 * np.pi * 2200 * t) * _env(len(t), 0.0005, 0.004)


def tick() -> np.ndarray:
    t = _t(0.04)
    return np.sin(2 * np.pi * 3800 * t) * _env(len(t), 0.0003, 0.005)


def boom() -> np.ndarray:
    t = _t(1.6)
    f = 120 * np.exp(-t * 3) + 38
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(len(t), 0.004, 0.5)
    hit = _bandpass(_noise(1.6, 5), 40, 900) * _env(len(t), 0.002, 0.08)
    return sub + 0.5 * hit


def riser() -> np.ndarray:
    d = 2.2
    t = _t(d)
    f = 200 * (12 ** (t / d))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.35
    air = _bandpass(_noise(d, 7), f * 0.8, f * 3)
    return (tone + air) * (t / d) ** 2


def impact() -> np.ndarray:
    t = _t(1.0)
    body = _bandpass(_noise(1.0, 9), 50, 2500) * _env(len(t), 0.001, 0.12)
    low = np.sin(2 * np.pi * 55 * t) * _env(len(t), 0.002, 0.3)
    return body + 0.8 * low


def glitch() -> np.ndarray:
    rng = np.random.default_rng(11)
    parts = []
    for _ in range(9):
        d = rng.uniform(0.02, 0.06)
        t = _t(d)
        if rng.random() < 0.5:
            parts.append(np.sign(np.sin(2 * np.pi * rng.uniform(200, 2000) * t)) * 0.6)
        else:
            parts.append(_noise(d, int(rng.integers(1000))) * 0.5)
        parts.append(np.zeros(int(SR * rng.uniform(0.0, 0.03))))
    return np.concatenate(parts)


def shutter() -> np.ndarray:
    a = _bandpass(_noise(0.06, 13), 800, 7000) * _env(int(SR * 0.06), 0.0005, 0.012)
    gap = np.zeros(int(SR * 0.07))
    b = _bandpass(_noise(0.09, 14), 500, 5000) * _env(int(SR * 0.09), 0.0005, 0.02)
    return np.concatenate([a, gap, b])


def notify() -> np.ndarray:
    return np.concatenate([ding(987.8)[: int(SR * 0.16)] * np.linspace(1, 0.6, int(SR * 0.16)), ding(1318.5)[: int(SR * 0.9)]])


def success() -> np.ndarray:
    notes = (523.3, 659.3, 784.0, 1046.5)
    out = np.zeros(int(SR * 1.3))
    for k, f in enumerate(notes):
        s = int(SR * 0.09 * k)
        n = ding(f)[: len(out) - s]
        out[s:s + len(n)] += n * 0.6
    return out


def error() -> np.ndarray:
    t = _t(0.5)
    x = np.sign(np.sin(2 * np.pi * 160 * t)) * 0.5 + np.sin(2 * np.pi * 120 * t) * 0.5
    return x * (_env(len(t), 0.005, 0.3))


def heartbeat() -> np.ndarray:
    def thump(f: float) -> np.ndarray:
        t = _t(0.25)
        return np.sin(2 * np.pi * f * t) * _env(len(t), 0.004, 0.06)
    one = np.concatenate([thump(60), np.zeros(int(SR * 0.12)), thump(52), np.zeros(int(SR * 0.45))])
    return np.concatenate([one, one])


def typing() -> np.ndarray:
    rng = np.random.default_rng(17)
    out = []
    for _ in range(14):
        c = click() * rng.uniform(0.5, 1)
        out += [c, np.zeros(int(SR * rng.uniform(0.04, 0.14)))]
    return np.concatenate(out)


def coin() -> np.ndarray:
    a = ding(987.8)[: int(SR * 0.08)]
    b = ding(1318.5)[: int(SR * 0.6)]
    return np.concatenate([a, b])


def swipe() -> np.ndarray:
    d = 0.3
    t = _t(d)
    return _bandpass(_noise(d, 19), 2000 + 6000 * t / d, 9000 + 6000 * t / d) * np.sin(np.pi * t / d)


# الاسم ← (اسم عربي، الدالة)
SOUNDS = {
    "whoosh": ("ووش (انتقال)", whoosh),
    "whoosh_rev": ("ووش بالعكس", lambda: whoosh(True)),
    "swipe": ("سحبة", swipe),
    "pop": ("بوب", pop),
    "bubble": ("فقاعة", bubble),
    "click": ("كليك", click),
    "tick": ("تِك", tick),
    "ding": ("دينج", ding),
    "notify": ("إشعار", notify),
    "success": ("نجاح", success),
    "error": ("غلط", error),
    "coin": ("عملة", coin),
    "shutter": ("كاميرا", shutter),
    "typing": ("كتابة كيبورد", typing),
    "glitch": ("جليتش", glitch),
    "impact": ("خبطة", impact),
    "boom": ("بووم", boom),
    "riser": ("طلوع (رايزر)", riser),
    "heartbeat": ("نبض قلب", heartbeat),
}


def ensure(folder: Path, name: str) -> Path:
    """بيرجّع مسار ملف المؤثر، وبيعمله لو مش موجود."""
    if name not in SOUNDS:
        raise KeyError(name)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{name}.wav"
    if not path.exists():
        x = _norm(np.asarray(SOUNDS[name][1](), float))
        fade = min(len(x), int(SR * 0.004))
        if fade:
            x[-fade:] *= np.linspace(1, 0, fade)
        pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
        tmp = path.with_suffix(".tmp")
        with wave.open(str(tmp), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        tmp.replace(path)
    return path


def duration(path: Path) -> float:
    with wave.open(str(path)) as w:
        return w.getnframes() / w.getframerate()
