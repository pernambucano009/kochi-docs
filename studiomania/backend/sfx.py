"""🔊 الأصوات الرسمية للتايبوجرافي (متاخدة من فيديوهات المرجع، ومتخزنة على السيرفر بس مش في الكود).

القاعدة:
- كتابة رسالة (حرف حرف بمؤشر، الحركة type): ضغطات الكيبورد (key_*) وصوت التايبينج (typing_*) بس.
- أي كلمة أو حرف أو عنصر بيظهر أو بيختفي: الكليكات (click_*)، والبرنامج بيبدّل بينهم عشان الصوت مايتكررش.
"""
from __future__ import annotations

import io
import random
import re
import wave
import zipfile
from pathlib import Path

import numpy as np

SR = 44100
KINDS = ("click", "key", "typing")
NAME = re.compile(r"^(click|key|typing)_[A-Za-z0-9_-]{1,40}\.wav$")
# الحركات اللي هي كتابة رسالة
TYPING_KINDS = {"type"}


def kind_of(name: str) -> str | None:
    m = NAME.match(name)
    return m.group(1) if m else None


def read_wav(data: bytes) -> np.ndarray:
    """أي wav (أحادي/ستيريو، 16 بت) ← مصفوفة أحادية على 44100."""
    with wave.open(io.BytesIO(data)) as w:
        ch, sw, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        raw = w.readframes(n)
    if sw != 2:
        raise ValueError("الملف لازم يكون WAV بـ 16 بت")
    x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    if ch > 1:
        x = x.reshape(-1, ch).mean(1)
    if sr != SR:
        x = np.interp(np.linspace(0, len(x) - 1, int(len(x) * SR / sr)), np.arange(len(x)), x).astype(np.float32)
    return x


def write_wav(path: Path, x: np.ndarray) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def add_files(folder: Path, name: str, data: bytes) -> list[str]:
    """بيضيف ملف wav أو zip فيه ملفات. الأسماء لازم تبدأ بـ click_ أو key_ أو typing_."""
    folder.mkdir(parents=True, exist_ok=True)
    items = []
    if name.lower().endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            for info in z.infolist():
                base = Path(info.filename).name
                if kind_of(base) and info.file_size < 5_000_000:
                    items.append((base, z.read(info)))
    else:
        items.append((Path(name).name, data))
    added = []
    for base, blob in items:
        if not kind_of(base):
            continue
        x = read_wav(blob)   # بيتأكد إن الملف سليم، وبيتخزن بشكل واحد
        write_wav(folder / base, x)
        added.append(base)
    return added


def library(folder: Path) -> dict[str, list[Path]]:
    lib = {k: [] for k in KINDS}
    if folder.exists():
        for f in sorted(folder.glob("*.wav")):
            k = kind_of(f.name)
            if k:
                lib[k].append(f)
    return lib


def events(blocks: list[dict], duration: float) -> list[tuple[float, str, float]]:
    """(وقت، نوع الصوت، قوة) لكل ظهور/اختفاء في الفيديو، على نفس توقيت المحرّك."""
    ev: list[tuple[float, str, float]] = []
    for b in blocks:
        t0, t1 = float(b.get("t0") or 0), float(b.get("t1") or 0)
        ws = b.get("words") or []
        if not ws and b.get("text"):
            parts = str(b["text"]).split()
            span = (t1 - t0) * 0.7 / max(1, len(parts))
            ws = [{"w": w, "t0": t0 + i * span, "t1": t0 + (i + 1) * span} for i, w in enumerate(parts)]
        if b.get("kind") in TYPING_KINDS:
            # نفس سرعة الكتابة اللي في k_type: الكلمة بتتكتب في 0.12–0.35 ثانية
            for w in ws:
                chars = [c for c in str(w.get("w") or "") if not c.isspace()]
                if not chars:
                    continue
                a = float(w.get("t0", t0))
                d = max(0.12, min(0.35, float(w.get("t1", a + 0.3)) - a))
                for i in range(len(chars)):
                    ev.append((a + d * i / len(chars), "key", 0.75))
            continue
        ev.append((t0, "click", 0.85))   # العنصر بيظهر
        for w in ws:
            ev.append((float(w.get("t0", t0)), "click", 0.7))
        if t1 < duration - 0.05:
            ev.append((t1 - 0.02, "click", 0.45))   # بيختفي (أخف)
    ev.sort()
    out: list[tuple[float, str, float]] = []
    for e in ev:   # كليكين ورا بعض في أقل من 60 مللي = واحد
        if e[1] == "click" and out and out[-1][1] == "click" and e[0] - out[-1][0] < 0.06:
            continue
        if 0 <= e[0] < duration:
            out.append(e)
    return out


def render(folder: Path, blocks: list[dict], duration: float, out: Path, seed: int = 7) -> bool:
    """بيكتب تراك المؤثرات. بيرجع False لو المكتبة فاضية أو مفيش أحداث."""
    lib = library(folder)
    cache: dict[Path, np.ndarray] = {}

    def snd(p: Path) -> np.ndarray:
        if p not in cache:
            cache[p] = read_wav(p.read_bytes())
        return cache[p]

    ev = events(blocks, duration)
    if not ev:
        return False
    rnd = random.Random(seed)
    track = np.zeros(int(SR * (duration + 1)), np.float32)
    last: dict[str, Path | None] = {"click": None, "key": None}
    used = False
    for t, kind, gain in ev:
        pool = lib.get(kind) or []
        if kind == "key" and not pool:
            pool = lib.get("typing") or []
        if not pool:
            continue
        choices = [p for p in pool if p != last.get(kind)] or pool   # مانكررش نفس الملف ورا بعض
        p = rnd.choice(choices)
        last[kind] = p
        x = snd(p)
        if p.name.startswith("typing_"):
            x = x[: int(SR * 0.09)]   # لو مفيش ضغطات لوحدها: حتة صغيرة من التايبينج
        g = gain * rnd.uniform(0.85, 1.0)
        s = int(t * SR) + int(rnd.uniform(-0.004, 0.004) * SR)
        s = max(0, s)
        e = min(len(track), s + len(x))
        track[s:e] += x[: e - s] * g
        used = True
    if not used:
        return False
    peak = float(np.abs(track).max())
    if peak > 0.95:
        track *= 0.95 / peak
    write_wav(out, track[: int(SR * duration)])
    return True
