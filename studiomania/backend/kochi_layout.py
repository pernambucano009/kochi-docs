"""ترتيب مونتاج كوتشي التلقائي: التعليق الصوتي يتقطع جمل ويتوزع على الفيديو، والموسيقى تتقطع على الجمل.

القواعد (من صاحب البرنامج):
- أول جملة (الخطاف) في أول الفيديو تمامًا.
- آخر جملة («سوي فولو...») تبدأ مع الأوترو، وصوت الأوترو نفسه مغلق.
- الجمل الذي في النص تتوزع على باقي الفيديو بمسافات متساوية بينها.
- الموسيقى تبدأ بعد نهاية أول جملة بفريمين، وتتقطع عند كل جملة: وقت النص 20%، وبين الجمل عالية.
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

SILENCE_DB = -38          # أوطى من كده = سكوت
MIN_PAUSE = 0.38          # سكوت أطول من كده = نهاية جملة
MIN_SPEECH = 0.25         # كلام أقصر من كده (نَفَس / خبطة) بيتلزق في اللي جنبه
PAD = 0.06                # هامش صغير قبل وبعد كل جملة عشان الكلام مايتقصّش
MUSIC_SPEECH_VOL = 0.2    # الموسيقى وقت التعليق
MUSIC_GAP_VOL = 1.0       # الموسيقى بين الجمل
MUSIC_FRAMES_AFTER_HOOK = 2
MIN_GAP = 0.15            # أقل مسافة بين جملتين لو الفيديو أقصر من التعليق


def speech_segments(ffmpeg: str, path: Path, duration: float, silence_db: float = SILENCE_DB,
                    min_pause: float = MIN_PAUSE) -> list[tuple[float, float]]:
    """أماكن النص في التسجيل [(بداية، نهاية)] بالثواني، بدون ما نبعته لأي خدمة خارج."""
    r = subprocess.run([ffmpeg, "-hide_banner", "-nostats", "-i", str(path), "-af",
                        f"silencedetect=noise={silence_db}dB:d={min_pause}", "-f", "null", "-"],
                       capture_output=True, text=True, timeout=300)
    starts = [float(x) for x in re.findall(r"silence_start: (-?[0-9.]+)", r.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([0-9.]+)", r.stderr)]
    silences = []
    for i, s in enumerate(starts):
        silences.append((max(0.0, s), ends[i] if i < len(ends) else duration))
    speech, t = [], 0.0
    for s, e in silences:
        if s - t > 0.01:
            speech.append((t, s))
        t = e
    if duration - t > 0.01:
        speech.append((t, duration))
    return merge_short(speech)


def merge_short(segs: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out: list[list[float]] = []
    for s, e in segs:
        if out and (e - s < MIN_SPEECH or out[-1][1] - out[-1][0] < MIN_SPEECH):
            out[-1][1] = e
        else:
            out.append([s, e])
    return [(s, e) for s, e in out]


def padded(segs: list[tuple[float, float]], duration: float) -> list[tuple[float, float]]:
    """كل جملة بهامش صغير، بدون ما تدخل في ما جنبها."""
    out = []
    for i, (s, e) in enumerate(segs):
        lo = segs[i - 1][1] if i else 0.0
        hi = segs[i + 1][0] if i + 1 < len(segs) else duration
        out.append((max(lo, s - PAD, 0.0), min(hi, e + PAD, duration)))
    return out


def place_sentences(lens: list[float], video_end: float, outro_start: float | None) -> list[float]:
    """متى تبدأ كل جملة على التايم لاين."""
    n = len(lens)
    if n == 0:
        return []
    if n == 1:
        return [0.0]
    # آخر جملة: مع الأوترو، أو في آخر الفيديو لو مفيش أوترو
    last = outro_start if outro_start is not None else max(0.0, video_end - lens[-1])
    first_end = lens[0]
    mids = lens[1:-1]
    window = last - first_end
    need = sum(mids)
    if mids and window - need >= MIN_GAP * (len(mids) + 1):
        gap = (window - need) / (len(mids) + 1)
    else:
        gap = MIN_GAP
    starts, t = [0.0], first_end
    for ln in mids:
        t += gap
        starts.append(t)
        t += ln
    # التعليق أطول من الفيديو: آخر جملة بتتزق لبعد اللي قبلها
    starts.append(max(last, t + MIN_GAP) if mids else max(last, first_end + MIN_GAP))
    return starts


def layout(sentences: list[tuple[float, float]], video_end: float, outro_start: float | None,
           music_len: float | None, total: float, fps: int = 30) -> dict:
    """يعود قطع التعليق وقطع الموسيقى بنفس شكل بيانات المونتاج (parts)."""
    lens = [e - s for s, e in sentences]
    starts = place_sentences(lens, video_end, outro_start)
    voice = [{"delay": round(t, 3), "offset": round(s, 3), "length": round(e - s, 3), "volume": 1}
             for t, (s, e) in zip(starts, sentences)]
    spans = [(t, t + ln) for t, ln in zip(starts, lens)]
    music = []
    if music_len and spans:
        m0 = spans[0][1] + MUSIC_FRAMES_AFTER_HOOK / fps
        end = max(total, spans[-1][1])
        cuts = sorted({round(x, 3) for a, b in spans[1:] for x in (a, b) if m0 < x < end})
        bounds = [m0, *cuts, end]
        for a, b in zip(bounds, bounds[1:]):
            off = a - m0
            if b - a < 1 / fps or off >= music_len:
                continue
            talking = any(s <= a + 1e-3 and b <= e + 1e-3 for s, e in spans)
            music.append({"delay": round(a, 3), "offset": round(off, 3), "length": round(min(b - a, music_len - off), 3),
                          "volume": MUSIC_SPEECH_VOL if talking else MUSIC_GAP_VOL})
    return {"voice": voice, "music": music, "sentences": len(sentences),
            "overflow": round(max(0.0, (spans[-1][1] if spans else 0) - total), 2)}


def auto_cuts(duration: float, scene_cuts: list[float], max_len: float = 14.5, min_len: float = 2.0) -> list[float]:
    """نقاط تقطيع بحيث كل قطعة أقل من max_len: نقطع عند تغيّر المشهد إذا فيه، وإلا نقسم بالتساوي."""
    cuts, pos = [], 0.0
    scenes = sorted(c for c in scene_cuts if min_len <= c <= duration - min_len)
    while duration - pos > max_len:
        hi = pos + max_len
        options = [c for c in scenes if pos + min_len <= c <= hi and duration - c >= min_len]
        if options:
            c = options[-1]
        else:
            n = -(-(duration - pos) // max_len)          # كام قطعة فاضلة
            c = pos + (duration - pos) / n
        cuts.append(round(c, 3))
        pos = c
    return cuts


def scene_cuts(ffmpeg: str, src: Path, threshold: float = 0.3) -> list[float]:
    """أماكن تغيّر المشهد، على نسخة صغيرة من الفيديو (أسرع كثير من الحجم الكامل على الخادم)."""
    r = subprocess.run([ffmpeg, "-hide_banner", "-nostats", "-i", str(src), "-an", "-sn", "-vf",
                        f"fps=10,scale=160:-2,select='gt(scene,{threshold})',showinfo", "-f", "null", "-"],
                       capture_output=True, text=True, timeout=900)
    return sorted({round(float(m), 2) for m in re.findall(r"pts_time:([0-9.]+)", r.stderr)})
