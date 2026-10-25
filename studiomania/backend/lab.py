"""🔬 معمل التفكيك: يأخذ أي فيديو ويفككه لعناصره لكي نتعرف عليها ونقيّمها.

ما يتقاس بالكود (دقيق بالفريم والمللي ثانية): القطعات بين اللقطات، بدايات الأصوات (onsets)، ومقاطع النص.
ما يفهمه النموذج: ماذا كل صوت (كليك، ووش...)، والموسيقى أين، وماذا العناصر الذي في كل لقطة وتعمل ماذا ومتى.
وتفكيك الصورة لطبقات شفافة (Seedream layer decomposition) يُنشأ لكل لقطة عندما تطلبه.
"""
from __future__ import annotations

import json
import math
import re
import subprocess
import uuid
from array import array
from pathlib import Path

import algo

SR = 16000          # صوت التحليل
HOP = 160           # 10 مللي ثانية
SFX_CATEGORIES = ("click", "whoosh", "pop", "impact", "typing", "swipe", "notification", "riser", "transition",
                  "ui", "foley", "ambience", "other")
ELEMENT_TYPES = ("character", "background", "cursor", "icon", "file", "folder", "window", "button", "text", "logo",
                 "photo", "ui", "object", "shape", "effect", "other")
ACTIONS = ("appear", "disappear", "move", "click", "drag", "drop", "type", "scale", "rotate", "highlight", "transform",
           "speak", "gesture", "other")


# ------------------------------------------------------------ الصورة: القطعات والفريمات

def detect_shots(ffmpeg: str, src: Path, duration: float, threshold: float = 0.27, min_len: float = 0.35) -> list[dict]:
    """القطعات بمقياس تغيّر الصورة بين كل فريم واللي بعده (scene score)، غير بالتخمين."""
    r = subprocess.run([ffmpeg, "-hide_banner", "-i", str(src), "-an", "-vf", f"select='gt(scene,{threshold})',showinfo",
                        "-f", "null", "-"], capture_output=True, text=True, timeout=900)
    cuts = sorted({round(float(m), 3) for m in re.findall(r"pts_time:([0-9.]+)", r.stderr)})
    bounds = [0.0]
    for c in cuts:
        if min_len <= c <= duration - min_len and c - bounds[-1] >= min_len:
            bounds.append(c)
    bounds.append(round(duration, 3))
    return [{"n": i + 1, "start": bounds[i], "end": bounds[i + 1]} for i in range(len(bounds) - 1)]


FINE_FPS = 15
FINE_W, FINE_H = 40, 72


def frame_signals(ffmpeg: str, src: Path) -> tuple[list[float], list[list[float]]]:
    """من فريمات صغيرة (15 في الثانية): الحركة (قدر ماذا الفريم تغيّر عن ما قبله، حتى إذا عنصر صغير يتحرك)
    وتوزيع الألوان (العنصر الذي يتحرك من مكان لمكان مبيغيّروش، العنصر الجديد الذي يدخل يغيّره)."""
    r = subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(src), "-an", "-vf",
                        f"fps={FINE_FPS},scale={FINE_W}:{FINE_H},format=rgb24", "-f", "rawvideo", "-"],
                       capture_output=True, timeout=900)
    size, px = FINE_W * FINE_H * 3, FINE_W * FINE_H
    motion, hists, prev = [], [], None
    for k in range(len(r.stdout) // size):
        fr = r.stdout[k * size:(k + 1) * size]
        hist = [0] * 64
        for i in range(0, size, 3):
            hist[(fr[i] >> 6) << 4 | (fr[i + 1] >> 6) << 2 | fr[i + 2] >> 6] += 1
        hists.append([x / px for x in hist])
        motion.append(0.0 if prev is None else sum(abs(x - y) for x, y in zip(fr, prev)) / size / 255)
        prev = fr
    return motion, hists


def motion_splits(motion: list[float], a: float, b: float, still: float = 0.0015, min_gap: float = 0.45) -> list[float]:
    """⏸️ وقفة ساكنة وبعدها حركة جديدة = جزء جديدة (الوقفة تظل مع الحركة التي قبلها: العنصر ينتهي ويثبت).
    «ساكن» بمقياس ثابت: الفيديو الذي فيه حركة طول الوقت (شخص يتكلم، خلفية متحركة) لا يتقطع على الفاضي."""
    i0, i1 = max(1, int(a * FINE_FPS) + 1), min(len(motion), int(b * FINE_FPS))
    if i1 - i0 < 6:
        return []
    gap, cuts, quiet = int(min_gap * FINE_FPS), [], 0
    for i in range(i0, i1):
        if motion[i] < still:
            quiet += 1
        else:
            if quiet >= gap:
                cuts.append(round(i / FINE_FPS - 0.07, 3))
            quiet = 0
    return cuts


def _hd(a: list[float], b: list[float]) -> float:
    return sum(abs(x - y) for x, y in zip(a, b)) / 2   # 0 = نفس المحتوى، 1 = محتوى تاني خالص


def content_splits(hists: list[list[float]], a: float, b: float, ratio: float = 2.2, floor: float = 0.03,
                   refractory: float = 0.6) -> list[float]:
    """➕ عنصر جديد دخل حتى إذا الحركة ما وقفتش: سرعة تغيّر المحتوى (الألوان) تقفز فجأة أعلى الذي كانت عليه
    في الثانية التي فاتت. التغيير البطيء المستمر (خلفية تتحرك، كاميرا ماشية، شخص يتكلم) مبيقطعش."""
    i0, i1 = max(3, int(a * FINE_FPS) + 3), min(len(hists), int(b * FINE_FPS))
    if i1 - i0 < 8:
        return []
    rate = {i: _hd(hists[i], hists[i - 3]) for i in range(i0 - 3 if i0 > 5 else 3, i1)}
    cuts, last = [], -9.0
    for i in range(i0 + 4, i1):
        prev = sorted(rate[k] for k in range(max(i0, i - FINE_FPS), i - 1) if k in rate)
        base = prev[len(prev) // 2] if prev else 0.0
        if rate[i] > max(floor, ratio * base) and i / FINE_FPS - last >= refractory:
            j = i   # بداية القفزة
            while j - 1 in rate and i - j < 5 and rate[j - 1] > max(floor * 0.5, base * 1.3):
                j -= 1
            cuts.append(round(max(a, (j - 3) / FINE_FPS), 3))
            last = i / FINE_FPS
    return cuts


def merge_cuts(a: float, b: float, *lists: list[float], min_len: float = 0.5) -> list[float]:
    out: list[float] = []
    for c in sorted(x for lst in lists for x in lst):
        if c - (out[-1] if out else a) >= min_len and b - c >= min_len:
            out.append(round(c, 3))
    return out


def fine_shots(ffmpeg: str, src: Path, shots: list[dict]) -> list[dict]:
    """كل لقطة تُقسّم على كل تغيير داخل المشهد، فكل حركة / عنصر جديد يصبح جزء تلقائيًا:
    وقفة بين حركتين، أو عنصر جديد دخل حتى إذا الحركة مكملة."""
    motion, hists = frame_signals(ffmpeg, src)
    out = []
    for s in shots:
        inner = merge_cuts(s["start"], s["end"], motion_splits(motion, s["start"], s["end"]),
                           content_splits(hists, s["start"], s["end"]))
        bounds = [s["start"], *inner, s["end"]]
        for i in range(len(bounds) - 1):
            out.append({"start": bounds[i], "end": bounds[i + 1], "cut": "hard" if i == 0 else "change",
                        "uid": uuid.uuid4().hex[:4]})
    for i, s in enumerate(out):
        s["n"] = i + 1
    return out


def extract_frames(ffmpeg: str, src: Path, start: float, end: float, folder: Path, prefix: str,
                   max_frames: int = 32, per_sec: float = 6, width: int = 360) -> list[dict]:
    """فريمات اللقطة بتوقيتها (للمراجعة وللنموذج): حتى 6 في الثانية و32 للقطة."""
    dur = max(0.04, end - start)
    n = max(2, min(max_frames, int(round(dur * per_sec))))
    folder.mkdir(parents=True, exist_ok=True)
    out = []
    for i in range(n):
        t = start + dur * (i + 0.5) / n
        name = f"{prefix}-{i:02d}.jpg"
        subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.3f}", "-i", str(src), "-frames:v", "1",
                        "-vf", f"scale={width}:-2", "-q:v", "4", str(folder / name)], capture_output=True, timeout=60)
        if (folder / name).exists():
            out.append({"t": round(t, 3), "file": name})
    return out


def grab_frame(ffmpeg: str, src: Path, t: float, out: Path) -> Path:
    """فريم بالجودة الكاملة (للتفكيك لطبقات)."""
    subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.3f}", "-i", str(src), "-frames:v", "1",
                    "-q:v", "2", str(out)], check=True, capture_output=True, timeout=60)
    return out


# ------------------------------------------------------------ الصوت: بدايات الأصوات ومقاطع الكلام

def pcm(ffmpeg: str, src: Path) -> array:
    r = subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(src), "-vn", "-ac", "1", "-ar", str(SR),
                        "-f", "s16le", "-"], capture_output=True, timeout=600)
    data = array("h")
    data.frombytes(r.stdout[: len(r.stdout) // 2 * 2])
    return data


def onsets(samples: array, max_count: int = 300) -> list[dict]:
    """بدايات الأصوات: كل لحظة الطاقة فيها تعلى فجأة (9 dB أعلى الذي قبلها). دقتها 10 مللي ثانية."""
    n = len(samples) // HOP
    if n < 10:
        return []
    db = []
    for i in range(n):
        seg = samples[i * HOP:(i + 1) * HOP]
        e = sum(v * v for v in seg) / HOP
        db.append(10 * math.log10(e / (32768.0 ** 2) + 1e-10))
    out, last = [], -1.0
    for i in range(8, n):
        prev = sum(db[i - 8:i]) / 8
        rise = db[i] - prev
        t = i * HOP / SR
        if db[i] > -45 and rise >= 9 and t - last >= 0.06:
            out.append({"t": round(t, 3), "rise": round(rise, 1), "level": round(db[i], 1)})
            last = t
    out.sort(key=lambda x: -x["rise"])
    return sorted(out[:max_count], key=lambda x: x["t"])


def beat_grid(marks: list[dict], dur: float) -> dict:
    """إيقاع المزيكا من بدايات الأصوات: أكثر مسافة متكررة بين الدقات (٠٫٣–١ ثانية) وشبكة دقات منتظمة مباشرة المزيكا."""
    ts = sorted(m["t"] for m in marks if m.get("rise", 0) >= 9)
    if len(ts) < 4 or dur <= 0:
        return {"period": 0.0, "beats": []}
    votes: dict[int, float] = {}
    for i, a in enumerate(ts):
        for b in ts[i + 1:i + 6]:
            d = b - a
            for k in (1, 2, 3, 4):   # المسافة ممكن تكون دقتين أو تلاتة
                p = d / k
                if 0.3 <= p <= 1.0:
                    key = round(p * 100)
                    votes[key] = votes.get(key, 0) + 1 / k
    if not votes:
        return {"period": 0.0, "beats": []}
    best = max(votes, key=lambda k: sum(votes.get(k + j, 0) for j in (-1, 0, 1)))
    near = [(k, votes[k]) for k in (best - 1, best, best + 1) if k in votes]
    period = sum(k * v for k, v in near) / sum(v for _, v in near) / 100
    # بداية الشبكة: الإزاحة اللي بتخلّي أكتر دقات تقع على الشبكة
    phase = max((t % period for t in ts[:40]), key=lambda ph: sum(1 for t in ts if min((t - ph) % period, period - (t - ph) % period) < 0.05))
    # تظبيط دقيق: خط مستقيم بين رقم الدقة ووقتها من الدقات اللي واقعة على الشبكة (علشان مايبعدش في الآخر)
    pts = [(round((t - phase) / period), t) for t in ts if min((t - phase) % period, period - (t - phase) % period) < 0.06]
    if len(pts) >= 4:
        n = len(pts)
        mx, my = sum(i for i, _ in pts) / n, sum(t for _, t in pts) / n
        den = sum((i - mx) ** 2 for i, _ in pts)
        if den > 0:
            period = sum((i - mx) * (t - my) for i, t in pts) / den
            phase = (my - period * mx) % period
    beats, t = [], phase
    while t <= dur + 1e-6:
        beats.append(round(t, 3))
        t += period
    return {"period": round(period, 3), "beats": beats}


def speech_segments(words: list[dict], gap: float = 0.55) -> list[dict]:
    segs = []
    for w in words or []:
        if segs and w["s"] - segs[-1]["end"] <= gap:
            segs[-1]["end"] = w["e"]
            segs[-1]["text"] += " " + w["w"]
        else:
            segs.append({"start": w["s"], "end": w["e"], "text": w["w"]})
    return [{**s, "start": round(s["start"], 2), "end": round(s["end"], 2)} for s in segs]


def snap(t: float, marks: list[dict], tol: float = 0.2) -> tuple[float, bool]:
    """وقت النموذج يُضبط على أقرب بداية صوت اتقاست بالكود (إذا قريبة)."""
    best = min(marks, key=lambda m: abs(m["t"] - t), default=None)
    if best and abs(best["t"] - t) <= tol:
        return best["t"], True
    return round(t, 3), False


def cut_audio(ffmpeg: str, src: Path, start: float, dur: float, out: Path) -> Path:
    subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{max(0.0, start):.3f}", "-t", f"{dur:.3f}",
                    "-i", str(src), "-vn", "-ac", "1", "-b:a", "96k", "-af", "afade=t=out:st=%.3f:d=0.03" % max(0.0, dur - 0.03),
                    str(out)], check=True, capture_output=True, timeout=60)
    return out


# ------------------------------------------------------------ الموديل: الصوت

AUDIO_FORMAT = """{
  "music": [{"start": 0.0, "end": 12.5, "description": "نوع الموسيقى وآلاتها", "mood": "المود"}],
  "speech": [{"start": 0.4, "end": 2.1, "speaker": "من يتكلم", "text": "النص حرفيًا"}],
  "sfx": [{"t": 1.23, "dur": 0.25, "label": "اسم الصوت بالعربية (مثلًا: كليك ماوس)", "category": "click | whoosh | pop | impact | typing | swipe | notification | riser | transition | ui | foley | ambience | other",
           "what": "ماذا الذي يحدث في الصورة وقتها هذا والصوت مربوط بإيه"}]
}"""


def audio_messages(duration: float, marks: list[dict], speech: list[dict]) -> list[dict]:
    def in_speech(t):
        return any(s["start"] - 0.05 <= t <= s["end"] + 0.05 for s in speech)
    hints = ", ".join(f"{m['t']:.2f}{'*' if in_speech(m['t']) else ''}" for m in marks[:250]) or "—"
    said = "\n".join(f"- {s['start']:.2f}–{s['end']:.2f}: {s['text']}" for s in speech[:80]) or "—"
    text = (
        "أنت مهندس صوت. شاهد هذا الفيديو واسمع صوته كويس، وفكك الصوت لـ ٣ أشياء: الموسيقى، النص، والمؤثرات الصوتية (SFX).\n"
        f"مدة الفيديو {duration:.2f} ثانية.\n"
        "المؤثرات الصوتية أهم شيء: كل صوت تلقائيًا (كليك، ووش، بوب، خبطة، كتابة على كيبورد، إشعار، سحبة، رايزر...) بوقت بدايته بالضبط "
        "ومدته، وماذا الذي يحدث في الصورة في نفس اللحظة. متجمعش أصوات متكررة في سطر واحد: كل كليك سطر تلقائيًا.\n"
        f"هذه أوقات بدايات أصوات اتقاست بالكود بدقة 10 مللي ثانية: {hints}\n"
        "اجعل بالك: هذه الأوقات فيها بدايات كل شيء تعلى فجأة (مقاطع نص، ضربات موسيقى، ومؤثرات)، غير كلها مؤثرات. "
        "ما عليه * داخل وقت نص فالأغلب أنه مقطع من النص. اسمع كل وقت وحط في sfx المؤثرات الحقيقية فقط، "
        "وخد وقتها من هذه القائمة لكي التوقيت يصبح مظبوط. ضربات الموسيقى غير مؤثرات.\n"
        f"والنص الذي اتسمع (من التفريغ):\n{said}\n\n"
        "الأسماء والأوصاف بالعربية الفصحى البسيطة. استعد JSON فقط هذا بالشكل:\n" + AUDIO_FORMAT
    )
    return [{"role": "user", "content": text}]


# ------------------------------------------------------------ الموديل: عناصر كل لقطة

ELEMENTS_FORMAT = """{
  "scene_type": "live_action | screen_recording | motion_graphics | mixed",
  "summary": "اللقطة في جملة",
  "motion_graphics": true,
  "mg_reason": "له فيها أو لا تحتوي موشن جرافيك ينفع يُؤخذ (جملة قصيرة)",
  "background": {"name": "اسم الخلفية", "description": "شكلها بالتفصيل"},
  "elements": [
    {"id": "e1", "name": "اسم العنصر (مثلًا: مؤشر ماوس أخضر)",
     "type": "character | cursor | icon | file | folder | window | button | text | logo | photo | ui | object | shape | effect | other",
     "description": "شكله بالتفصيل: اللون، الحجم، الأسلوب، أي نص مكتوب عليه حرفيًا",
     "first_t": 0.0, "last_t": 2.0, "box": [0.1, 0.2, 0.3, 0.4],
     "actions": [{"t0": 0.4, "t1": 1.1, "action": "appear | disappear | move | click | drag | drop | type | scale | rotate | highlight | transform | speak | gesture | other",
                  "from": [0.5, 0.5], "to": [0.05, 0.4], "detail": "وصف الحركة (السرعة، الـ easing، مع من)", "sfx": "id الصوت المربوط إذا فيه"}]}
  ]
}"""


def elements_messages(shot: dict, frames: list[dict], sfx: list[dict], speech: list[dict]) -> list[dict]:
    """frames فيها data_url لكل فريم ووقته. الأوقات كلها بالثواني من أول الفيديو."""
    sounds = "\n".join(f"- id={x['id']} t={x['t']:.2f} {x.get('label', '')} ({x.get('category', '')})" for x in sfx) or "—"
    said = "\n".join(f"- {s['start']:.2f}–{s['end']:.2f}: {s.get('text', '')}" for s in speech) or "—"
    text = (
        "أنت موشن ديزاينر ومحلل فيديو. هذه فريمات لقطة واحدة من فيديو بالترتيب، وكل فريم مكتوب وقته بالثانية.\n"
        f"اللقطة رقم {shot['n']} من {shot['start']:.2f} لـ {shot['end']:.2f} ثانية.\n"
        "فكك اللقطة لعناصرها: الخلفية، وكل عنصر تلقائيًا (شخصيات، مؤشر ماوس، أيقونات، ملفات، مجلدات، نوافذ، أزرار، نص مكتوب، "
        "لوجوهات، صور، أشكال، افيكتس). لكل عنصر: اسمه وشكله بالتفصيل، مكانه (box = [x, y, w, h] كنسبة من الشاشة)، "
        "وكل شيء يعملها بتوقيتها بالضبط: يظهر/يختفي/يتحرك من أين لفين (from/to = [x, y] كنسب)/يضغط/يسحب/يكتب...\n"
        "اربط كل حركة بالصوت الذي حصل معها إذا فيه (اكتب id الصوت من القائمة).\n"
        f"الأصوات التي في هذه اللقطة:\n{sounds}\nالنص الذي يُقال:\n{said}\n\n"
        "motion_graphics = true إذا اللقطة فيها موشن جرافيك أو افيكتس ينفع تُؤخذ كأصل: جرافيك متحرك، نص متحرك، انتقالات، "
        "واجهة تطبيق أو شاشة تتحرك، حركة ماوس، أيقونات وأشكال تتحرك، افيكتس. و false إذا هي تصوير عادي (شخص يتكلم، "
        "منتج، مكان) والجرافيك فيها غير موجود أو مجرد ترجمة/نص ثابت ليس له قيمة كأصل.\n"
        "متخترعش عناصر غير باينة. الأسماء والأوصاف بالعربية الفصحى البسيطة. استعد JSON فقط هذا بالشكل:\n" + ELEMENTS_FORMAT
    )
    parts: list[dict] = [{"type": "text", "text": text}]
    for f in frames:
        parts.append({"type": "text", "text": f"t={f['t']:.2f}"})
        parts.append({"type": "image_url", "image_url": {"url": f["data_url"]}})
    return [{"role": "user", "content": parts}]


def clean_elements(data: dict, shot: dict, sfx_ids: set[str]) -> dict:
    def num(v, d=0.0):
        try:
            x = float(v)
            return x if x == x else d
        except (TypeError, ValueError):
            return d

    def pt(v):
        return [round(min(1.2, max(-0.2, num(v[0]))), 3), round(min(1.2, max(-0.2, num(v[1]))), 3)] \
            if isinstance(v, (list, tuple)) and len(v) >= 2 else None

    els = []
    for i, e in enumerate((data or {}).get("elements") or []):
        if not isinstance(e, dict) or not str(e.get("name") or "").strip():
            continue
        acts = []
        for a in e.get("actions") or []:
            if not isinstance(a, dict):
                continue
            t0 = min(shot["end"], max(shot["start"], num(a.get("t0"), shot["start"])))
            acts.append({"t0": round(t0, 2), "t1": round(min(shot["end"], max(t0, num(a.get("t1"), t0))), 2),
                         "action": a.get("action") if a.get("action") in ACTIONS else "other",
                         "from": pt(a.get("from")), "to": pt(a.get("to")), "detail": str(a.get("detail") or "")[:300],
                         "sfx": str(a.get("sfx")) if str(a.get("sfx") or "") in sfx_ids else None, "review": None})
        box = e.get("box") if isinstance(e.get("box"), list) and len(e["box"]) == 4 else None
        els.append({"id": f"{shot.get('uid') or 's' + str(shot['n'])}e{i + 1}", "name": str(e["name"])[:80],
                    "type": e.get("type") if e.get("type") in ELEMENT_TYPES else "other",
                    "description": str(e.get("description") or "")[:600],
                    "first_t": round(num(e.get("first_t"), shot["start"]), 2), "last_t": round(num(e.get("last_t"), shot["end"]), 2),
                    "box": [round(min(1, max(0, num(v))), 3) for v in box] if box else None,
                    "actions": sorted(acts, key=lambda a: a["t0"]), "review": None})
    bg = (data or {}).get("background") or {}
    return {"scene_type": (data or {}).get("scene_type") if (data or {}).get("scene_type") in
            ("live_action", "screen_recording", "motion_graphics", "mixed") else "mixed",
            "summary": str((data or {}).get("summary") or "")[:400],
            "motion_graphics": (data or {}).get("motion_graphics") is not False,
            "mg_reason": str((data or {}).get("mg_reason") or "")[:200],
            "background": {"name": str(bg.get("name") or "")[:80], "description": str(bg.get("description") or "")[:600], "review": None},
            "elements": els}


# ------------------------------------------------------------ 💡 الكومبوننتس: قطع من الفيديو تنفع تتعاد وتتحكم فيها

# الكومبوننتس موشن جرافيك وافيكتس بس (مش شخصيات ولا منتجات ولا تصوير عادي)
COMPONENT_CATS = ("motion_graphics", "effect", "transition", "text", "screen", "cursor", "other")
CONTROL_TYPES = ("text", "color", "choice", "number")

COMPONENTS_FORMAT = """{
  "components": [
    {"name": "اسم قصير واضح (مثلًا: ماوس يسحب ملفات لسلة المهملات)",
     "category": "motion_graphics | effect | transition | text | screen | cursor | other",
     "t0": 1.20, "t1": 3.80,
     "elements": ["s1e1", "s1e2"],
     "description": "ماذا الذي يحدث فيه بالضبط (الحركة والإيقاع والشكل)",
     "use": "ينفع يتستخدم في ماذا في فيديو آخر",
     "tags": ["ماوس", "سحب"],
     "controls": [
       {"label": "لون المؤشر", "type": "color", "target": "مؤشر ماوس أخضر", "value": "#3CFF6B"},
       {"label": "اسم الملف أولًا", "type": "text", "target": "ملف صورة: علي", "value": "علي"},
       {"label": "الملفات تترمي أين", "type": "choice", "target": "سلة المهملات", "value": "سلة المهملات", "options": ["سلة المهملات", "مجلد"]}
     ]}
  ]
}"""


def components_messages(d: dict, rejected: list[dict]) -> list[dict]:
    """من التفكيك (اللقطات وعناصرها وحركاتها بتوقيتها) لكومبوننتس جاهزة تُحفظ في المكتبة."""
    fine = any(s.get("cut") == "change" for s in d.get("shots") or [])
    lines = []
    for s in d.get("shots") or []:
        an = s.get("analysis") or {}
        if s.get("ignored"):  # لقطات اتشالت (تصوير عادي من غير موشن)
            continue
        lines.append(f"\n## لقطة {s['n']} ({s['start']:.2f}–{s['end']:.2f}){' 🔀' if s.get('cut') == 'change' else ''} · {an.get('scene_type', '')}: {an.get('summary', '')}")
        if (an.get("background") or {}).get("name"):
            lines.append(f"الخلفية: {an['background']['name']} — {an['background'].get('description', '')}")
        for e in an.get("elements") or []:
            lines.append(f"- [{e['id']}] {e['name']} ({e['type']}) {e['first_t']:.2f}–{e['last_t']:.2f}: {e.get('description', '')}")
            for a in e.get("actions") or []:
                lines.append(f"    · {a['t0']:.2f}–{a['t1']:.2f} {a['action']}: {a.get('detail', '')}")
    bad = "\n".join(f"- «{r.get('name')}» ({r.get('t0')}–{r.get('t1')}): {r.get('note') or 'بدون سبب'}" for r in rejected[:30])
    text = (
        "أنت موشن ديزاينر تبني مكتبة أصول (assets) من فيديوهات حقيقية: موشن جرافيك، افيكتس، انتقالات، نص متحرك، "
        "تسجيلات شاشة، حركات ماوس... كل أصل = مقطع من الفيديو كما هو بحركته وخلفيته وصوته، ثم أي عميل يستطيع "
        "يغيّر فيه أشياء (ألوان، نص، أسامي، وجهة حركة، سرعة) والحركة تظل كما هي.\n"
        f"هذا تفكيك فيديو مدته {d['source']['duration']:.2f} ثانية (الأوقات بالثانية من أول الفيديو):\n" + "\n".join(lines) + "\n\n"
        "طلّع منه الكومبوننتس الذي تستاهل تُحفظ وتُعاد:\n"
        "- كل كومبوننت جزء واحدة مكتملة لها بداية ونهاية واضحة (حركة كاملة، افيكت كامل، انتقال كامل). "
        "اترك هامش صغير قبلها وبعدها (نحو 0.15 ثانية) بدون ما تدخل في شيء أخرى.\n"
        "- يمكن يعدّي القطع بين لقطتين إذا هو انتقال أو حركة مستمرة. ولا يوجد حد أدنى ولا أقصى للمدة: اجعله كما هو في الفيديو.\n"
        + ("- اللقطات هنا متقسمة على كل تغيير في الحركة (🔀 = تغيير داخل نفس المشهد بدون قطع)، فكل لقطة غالبًا كومبوننت تلقائيًا: "
           "اجعل t0 و t1 هم حدود اللقطة بالضبط، ومتجمعش لقطتين إلا إذا هي نفس الحركة مكملة.\n" if fine else "")
        +
        "- موشن جرافيك وافيكتس فقط: جرافيك متحرك، نص متحرك، انتقالات، واجهات وشاشات تتحرك، حركات ماوس، افيكتس. "
        "متطلعش شخصيات ولا تصوير عادي لناس أو منتجات أو أماكن ولا خلفيات تلقائيًا، حتى إذا باينة في الفيديو.\n"
        "- متكررش نفس الجزء، ومتطلعش أشياء عادية ليس لها قيمة كأصل (لقطة واقفة بدون حركة مثلًا).\n"
        "- elements = ids العناصر الذي جواه من القائمة.\n"
        "- controls = الأشياء التي العميل سيحب يغيّرها فيه، بقيمتها الحالية كما هي في الفيديو بالضبط "
        "(النص المكتوب حرفيًا، اللون بالـ hex). type: text للكلام والأسامي، color للألوان، choice عندما يصبح فيه اختيارات، "
        "number للأرقام. target = اسم العنصر الذي يتغيّر. من 1 لـ 6 مفاتيح.\n"
        + (f"\nاقتراحات اترفضت من قبل وسبب الرفض (اتعلم منها ومتكررهاش):\n{bad}\n" if bad else "")
        + "\nالأسامي والأوصاف بالعربية الفصحى البسيطة. استعد JSON فقط هذا بالشكل:\n" + COMPONENTS_FORMAT
    )
    return [{"role": "user", "content": text}]


def snap_to(t: float, bounds: list[float], within: float = 0.3) -> float:
    """حدود الكومبوننت على حدود اللقطات إذا قريبة منها (لكي كل جزء تصبح كاملة)."""
    near = min(bounds, key=lambda x: abs(x - t), default=t)
    return near if abs(near - t) <= within else t


def clean_components(data: dict, duration: float, element_ids: set[str], bounds: list[float] | None = None) -> list[dict]:
    def num(v, dflt=0.0):
        try:
            x = float(v)
            return x if x == x else dflt
        except (TypeError, ValueError):
            return dflt

    out = []
    for c in (data or {}).get("components") or []:
        if not isinstance(c, dict) or not str(c.get("name") or "").strip():
            continue
        t0 = min(duration, max(0.0, snap_to(num(c.get("t0")), bounds or [])))
        t1 = min(duration, max(t0, snap_to(num(c.get("t1"), duration), bounds or [])))
        if t1 - t0 < 0.15:
            continue
        controls = []
        for k in c.get("controls") or []:
            if not isinstance(k, dict) or not str(k.get("label") or "").strip():
                continue
            ctype = k.get("type") if k.get("type") in CONTROL_TYPES else "text"
            ctl = {"key": f"k{len(controls) + 1}", "label": str(k["label"])[:60], "type": ctype,
                   "target": str(k.get("target") or "")[:80], "value": str(k.get("value") if k.get("value") is not None else "")[:200]}
            if ctype == "choice":
                ctl["options"] = [str(o)[:80] for o in k.get("options") or [] if str(o).strip()][:8] or [ctl["value"]]
            controls.append(ctl)
        out.append({"id": uuid.uuid4().hex[:8], "name": str(c["name"])[:100],
                    "category": c.get("category") if c.get("category") in COMPONENT_CATS else "other",
                    "t0": round(t0, 2), "t1": round(t1, 2),
                    "elements": [str(e) for e in c.get("elements") or [] if str(e) in element_ids],
                    "description": str(c.get("description") or "")[:600], "use": str(c.get("use") or "")[:300],
                    "tags": [str(t).strip()[:30] for t in c.get("tags") or [] if str(t).strip()][:8],
                    "controls": controls[:6], "review": None, "asset": None})
    return sorted(out, key=lambda c: c["t0"])


def mock_components(d: dict) -> dict:
    comps = []
    for s in d.get("shots") or []:
        els = (s.get("analysis") or {}).get("elements") or []
        if not els or s.get("ignored"):
            continue
        comps.append({"name": f"تجربة: ماوس يسحب ملف (لقطة {s['n']})", "category": "cursor", "t0": s["start"], "t1": s["end"],
                      "elements": [e["id"] for e in els], "description": "المؤشر يتحرك ويسحب الملف للسلة", "use": "شرح ميزة في تطبيق",
                      "tags": ["ماوس", "سحب"],
                      "controls": [{"label": "لون المؤشر", "type": "color", "target": els[0]["name"], "value": "#3CFF6B"},
                                   {"label": "اسم الملف", "type": "text", "target": els[-1]["name"], "value": "علي"},
                                   {"label": "الملف يروح أين", "type": "choice", "target": "السلة", "value": "سلة المهملات",
                                    "options": ["سلة المهملات", "مجلد"]}]})
    return {"components": comps}


# ------------------------------------------------------------ 🔗 الكونيكتورز: تحوّل بيحكي بيودّي من مشهد لمشهد من غير قطع

CONNECTOR_FAMILIES = {
    "zoom_through": "🔍 زووم داخل شيء (العنصر يصبح العالم الجديد)",
    "background_swap": "🖼️ تبديل الخلفية (ما أمام ثابت)",
    "anchor_carry": "📌 مرساة ماشية (ماوس / كاركتر / عنصر ينقلنا)",
    "scatter": "✨ تبعثر أو تساقط (العناصر تقع أو تتفرق)",
    "material_shift": "🧱 تغيير الخامة (رقمي ← ورق، شاشة ← حقيقي...)",
    "reveal_pullback": "🔭 كشف بالزووم أوت (نبعد فنكتشف أكبر)",
    "morph": "🫧 تحوّل شكل لشكل",
    "ui_to_world": "📱 من الشاشة للعالم الحقيقي (أو العكس)",
    "other": "مرة أخرى / جديد",
}

CONNECTORS_FORMAT = """{
  "connectors": [
    {"name": "اسم قصير للكونيكتور (مثلًا: زر Enter يفتح خريطة إسبانيا)",
     "family": "zoom_through | background_swap | anchor_carry | scatter | material_shift | reveal_pullback | morph | ui_to_world | other",
     "t0": 3.20, "t1": 5.10,
     "from_scene": "المشهد قبله يحكي ماذا",
     "to_scene": "المشهد بعده يحكي ماذا",
     "trigger": "الشرارة التي تبدأ التحوّل (ضغطة، كلمة، حركة...) ومتى",
     "anchors": ["ما يظل ثابت والعين ماسكاه طول التحوّل (النص المكتوب، الماوس...)"],
     "transforms": [{"t0": 3.4, "t1": 4.0, "from": "إطار مربع المحادثة", "to": "يختفي والنص يظل", "how": "fade للإطار فقط، ease-out"}],
     "camera": "حركة الكاميرا الافتراضية (تكبير ناعم على...، زووم أوت، بان...) بالسرعة والـ easing",
     "rhythm": "الإيقاع: كل خطوة آخذة قدر ماذا، فيه وقفات؟ متزامن مع صوت؟",
     "recipe": ["الوصفة عامة بدون تفاصيل هذه القصة لكي تُطبّق على أي مشهدين: خطوة ١ ...", "خطوة ٢ ..."],
     "story_role": "هذا التحوّل يخدم القصة كيف (له أحسن من قطع عادي)",
     "sound": "الصوت المصاحب إذا فيه"}
  ]
}"""


def connectors_messages(d: dict, rejected: list[dict] | None = None) -> list[dict]:
    """النموذج يشاهد الفيديو كله ويُخرج كل لحظة القصة فيها تتحوّل لمشهد آخر بدون قطع، بوصفتها."""
    lines = []
    for s in d.get("shots") or []:
        an = s.get("analysis") or {}
        els = "، ".join(e["name"] for e in (an.get("elements") or [])[:12])
        lines.append(f"- لقطة {s['n']} ({s['start']:.2f}–{s['end']:.2f}): {an.get('summary', '')}" + (f" | عناصر: {els}" if els else ""))
    fams = "\n".join(f"- {k}: {v}" for k, v in CONNECTOR_FAMILIES.items())
    text = (
        "أنت مخرج موشن جرافيك ومونتير محترف. شاهد هذا الفيديو كله بالصوت.\n"
        "نجمع «موصلات»: غير ترانزيشن عادي (فيد، زحلقة، تصغير بين آخر فريم وأول فريم)، لكن تحوّل يحكي داخل القصة نفسها: "
        "المشهد يتحوّل للمشهد الذي بعده أمام عين المشاهد بدون قطع. مثلًا: الماوس يضغط Enter ← زووم ناعم على مربع "
        "المحادثة ← إطاره يختفي والنص يظل ← الزر يتلوّن أنه اتداس ← الخلفية تتحوّل لخريطة عليها فنادق تقييماتها ← "
        "الماوس يضغط على فندق ← الفنادق الأخرى تقع مثل حبات الخرز ← الخريطة تصبح ورق ← زووم أوت نجد الكاركتر ماسكها وهو سايق.\n"
        "كل جزء من هؤلاء يمكن تصبح كونيكتور تلقائيًا إذا لها شرارة ونتيجة واضحة، أو كونيكتور واحد طويل إذا هي حركة واحدة متصلة.\n\n"
        f"الفيديو مدته {d['source']['duration']:.2f} ثانية. التقطيع والعناصر الذي اتعرفت (للمساعدة، الفيديو هو المرجع):\n"
        + "\n".join(lines) + "\n\n"
        "طلّع كل الموصلات التي في الفيديو بالتوقيت الدقيق (t0 أول ما التحوّل يبدأ، t1 عندما المشهد الجديد يستقر). لكل واحد:\n"
        "- الشرارة، واللي يظل ثابت (المرساة)، وكل تحوّل (ماذا يتحول لإيه، متى، وكيف بالضبط: الحركة والـ easing)، "
        "وحركة الكاميرا، والإيقاع، والصوت.\n"
        "- recipe = وصفة عامة بخطوات مرقمة تنفع تُطبّق على أي مشهدين آخرين (بدون أسامي المنتج أو المكان الذي في هذا الفيديو).\n"
        f"- family واحدة من هؤلاء:\n{fams}\n"
        "- القطع العادي والترانزيشن البدائي (فيد بين مشهدين مالهمش علاقة ببعض) غير كونيكتور: متطلّعهوش.\n"
        "- إذا الفيديو لا يحتوي موصلات استعد قائمة فارغة. متخترعش.\n"
        + ("اقتراحات اترفضت من قبل وسبب الرفض (اتعلم منها):\n"
           + "\n".join(f"- «{r.get('name')}» ({r.get('t0')}–{r.get('t1')}): {r.get('note') or 'بدون سبب'}" for r in rejected[:30]) + "\n"
           if rejected else "")
        +
        "النص بالعربية الفصحى البسيطة. استعد JSON فقط هذا بالشكل:\n" + CONNECTORS_FORMAT
    )
    return [{"role": "user", "content": text}]


CONNECTOR_KEYS = ("name", "family", "t0", "t1", "from_scene", "to_scene", "trigger", "anchors", "transforms", "camera",
                  "rhythm", "recipe", "story_role", "sound")


def connector_refine_messages(c: dict, note: str, clip_start: float, history: list[dict]) -> list[dict]:
    """💬 المستخدم يقول للشرح «عدّل كذا»: النموذج يشاهد الجزء مرة أخرى (ومعها قليلًا قبلها وبعدها) ويعدّل الشرح."""
    cur = {k: c.get(k) for k in CONNECTOR_KEYS}
    rel = json.loads(json.dumps(cur))   # الأوقات من أول المقطع المبعوت
    for k in ("t0", "t1"):
        rel[k] = round(float(rel[k]) - clip_start, 2)
    for x in rel.get("transforms") or []:
        x["t0"], x["t1"] = round(x["t0"] - clip_start, 2), round(x["t1"] - clip_start, 2)
    past = "\n".join(f"- {h['role']}: {h['text']}" for h in history[-8:])
    text = (
        "أنت مخرج موشن جرافيك. هذا مقطع من فيديو فيه «كونيكتور»: تحوّل يحكي يودّي من مشهد لمشهد بدون قطع. "
        "المقطع فيه قليلًا قبل الموصل وقليلًا بعده لكي ترى الصورة كاملة، والأوقات كلها بالثواني من أول هذا المقطع.\n"
        f"هذا الشرح الحالي:\n{json.dumps(rel, ensure_ascii=False, indent=1)}\n\n"
        + (f"نص من قبل عن نفس الموصل:\n{past}\n\n" if past else "")
        + f"المستخدم ترى أن الشرح يحتاج يُعدّل ويقولك:\n«{note}»\n\n"
        "شاهد المقطع مرة أخرى بدقة، ونفّذ طلبه، وصحّح أي شيء أخرى خطأ تشوفها. إذا طلب تغيير البداية أو النهاية غيّر t0 و t1. "
        "الوصفة (recipe) تظل عامة تنفع لأي مشهدين. family واحدة من: " + ", ".join(CONNECTOR_FAMILIES) + ".\n"
        "بالعربية الفصحى البسيطة. استعد JSON فقط: {\"reply\": \"رد قصير له عملت هكذا\", \"connector\": {نفس شكل الشرح الحالي بالضبط}}"
    )
    return [{"role": "user", "content": text}]


def apply_refine(c: dict, data: dict, clip_start: float, duration: float) -> dict:
    """الشرح المعدّل بأوقات الفيديو الأصلي (والأشياء الإدارية مثل التقييم والفريمات تظل)."""
    got = (data or {}).get("connector") if isinstance((data or {}).get("connector"), dict) else data
    if not isinstance(got, dict):
        return {}
    got = {**got}
    for k in ("t0", "t1"):
        if got.get(k) is not None:
            try:
                got[k] = float(got[k]) + clip_start
            except (TypeError, ValueError):
                got.pop(k)
    for x in got.get("transforms") or []:
        if isinstance(x, dict):
            for k in ("t0", "t1"):
                try:
                    x[k] = float(x.get(k)) + clip_start
                except (TypeError, ValueError):
                    x[k] = got.get("t0", c["t0"])
    merged = {**{k: c.get(k) for k in CONNECTOR_KEYS}, **{k: v for k, v in got.items() if k in CONNECTOR_KEYS and v not in (None, "")}}
    clean = clean_connectors({"connectors": [merged]}, duration)
    if not clean:
        return {}
    out = clean[0]
    return {k: out[k] for k in CONNECTOR_KEYS}


def clean_connectors(data: dict, duration: float) -> list[dict]:
    def num(v, dflt=0.0):
        try:
            x = float(v)
            return x if x == x else dflt
        except (TypeError, ValueError):
            return dflt

    def strs(v, n=10, k=300):
        return [str(x)[:k] for x in v or [] if str(x).strip()][:n] if isinstance(v, list) else []

    out = []
    for c in (data or {}).get("connectors") or []:
        if not isinstance(c, dict) or not str(c.get("name") or "").strip():
            continue
        t0 = min(duration, max(0.0, num(c.get("t0"))))
        t1 = min(duration, max(t0, num(c.get("t1"), t0)))
        if t1 - t0 < 0.2:
            continue
        tr = [{"t0": round(min(t1, max(t0, num(x.get("t0"), t0))), 2), "t1": round(min(t1, max(t0, num(x.get("t1"), t1))), 2),
               "from": str(x.get("from") or "")[:200], "to": str(x.get("to") or "")[:200], "how": str(x.get("how") or "")[:300]}
              for x in c.get("transforms") or [] if isinstance(x, dict)][:12]
        out.append({"id": uuid.uuid4().hex[:8], "name": str(c["name"])[:100],
                    "family": c.get("family") if c.get("family") in CONNECTOR_FAMILIES else "other",
                    "t0": round(t0, 2), "t1": round(t1, 2),
                    **{k: str(c.get(k) or "")[:500] for k in ("from_scene", "to_scene", "trigger", "camera", "rhythm", "story_role", "sound")},
                    "anchors": strs(c.get("anchors"), 8, 200), "transforms": sorted(tr, key=lambda x: x["t0"]),
                    "recipe": strs(c.get("recipe"), 12, 300), "review": None, "asset": None})
    return sorted(out, key=lambda c: c["t0"])


def mock_connectors(d: dict) -> dict:
    dur = d["source"]["duration"]
    a, b = round(dur * 0.3, 2), round(dur * 0.55, 2)
    return {"connectors": [{
        "name": "تجربة: زر يفتح خريطة", "family": "background_swap", "t0": a, "t1": b,
        "from_scene": "حد يكتب سؤال لموديل ذكاء اصطناعي", "to_scene": "خريطة عليها فنادق",
        "trigger": "الماوس يضغط Enter", "anchors": ["النص المكتوب", "مؤشر الماوس"],
        "transforms": [{"t0": a, "t1": a + 0.4, "from": "إطار المربع", "to": "يختفي", "how": "fade للإطار فقط"},
                       {"t0": a + 0.4, "t1": b, "from": "الخلفية", "to": "خريطة", "how": "تتلوّن من النص لبرة"}],
        "camera": "تكبير ناعم 8% ease-in-out", "rhythm": "سريع ثم وقفة نص ثانية", "sound": "ووش خفيف",
        "recipe": ["الضغطة على زر تعمل تكبير ناعم على العنصر", "إطار العنصر يختفي والمحتوى يظل",
                   "الخلفية تتحول للعالم الذي المحتوى يتكلم عنه"],
        "story_role": "يوري نتيجة الطلب في نفس اللحظة بدون قطع"}]}


# ------------------------------------------------------------ 🧪 تجربة كونيكتور: نطبّق الوصفة بين لقطتين

TRIAL_FORMAT = """{
  "adapted": "الوصفة ستتنفذ بين هؤلاء اللقطتين كيف (بالعربية، خطوات قصيرة مرقمة)",
  "anchors": ["ما سيظل ثابت والعين ماسكاه بين هؤلاء اللقطتين"],
  "keyframes": [{"label": "اسم المرحلة بالعربية (مثلًا: الإطار أُزيل والخلفية بقت خريطة)",
                 "prompt": "English image-edit instruction. IMAGE 1 is the current frame, IMAGE 2 is the final frame we are heading to. Describe exactly the in-between state to draw from IMAGE 1: what stays identical (layout, text, cursor...), what has changed and how far along the transformation is"}],
  "segments": [{"label": "هذه الحركة بالعربية",
                "prompt": "English prompt for a start-frame/end-frame video model: one continuous shot with no cut, the exact motion from the start frame to the end frame (camera move, what transforms into what and in which order, easing), keep everything else steady",
                "seconds": 2.0}]
}"""


def trial_plan_messages(recipe: dict, mode: str, a_label: str, b_label: str, max_keys: int = 2) -> str:
    """نص الطلب. الصور توضع بعده بالترتيب: 1 = آخر فريم في A، 2 = أول فريم في B، وبعدهم فريمات الموصل المرجعي."""
    r = {k: recipe.get(k) for k in ("family", "trigger", "anchors", "transforms", "camera", "rhythm", "recipe", "story_role", "sound")}
    goal = ("🔁 تجربة إعادة بناء: A وB هم نفس النقطتين الذين الموصل الأصلي بينهم في الفيديو. المطلوب نعيد عمله بأقرب شكل للأصلي."
            if mode == "rebuild" else
            "🔀 تجربة نقل: A وB لقطتين مختلفين عن الموصل الأصلي. المطلوب نطبّق نفس الفكرة والإحساس على قصة هؤلاء اللقطتين.")
    return (
        "أنت مخرج موشن جرافيك. لدينا «كونيكتور»: تحوّل يحكي يودّي من مشهد لمشهد بدون قطع، ومعه وصفته.\n"
        f"{goal}\n\n"
        f"وصفة الموصل:\n{json.dumps(r, ensure_ascii=False, indent=1)}\n\n"
        f"اللقطة A: {a_label}\nاللقطة B: {b_label}\n\n"
        "الصور بالترتيب: الصورة 1 = آخر فريم في A (البداية). الصورة 2 = أول فريم في B (النهاية). "
        "والصور الذي بعدهم = فريمات الموصل المرجعي (البداية والنص والنهاية) لكي ترى الشكل والإحساس.\n\n"
        "سنفّذها هكذا: صور مفتاحية للمراحل الذي في النص (بموديل تعديل صور يأخذ الصورة التي قبلها)، ثم نموذج فيديو "
        "يأخذ صورة بداية وصورة نهاية ويعمل الحركة بينهم. الحتت بالترتيب: الصورة 1 ← المراحل ← الصورة 2.\n"
        f"- keyframes من 0 لـ {max_keys} (المراحل الذي يجب تتحدد لكي التحوّل يسير صحيح؛ إذا التحوّل بسيط اجعلها 0 أو 1).\n"
        "- segments = عدد keyframes + 1 بالضبط، كل واحدة الحركة من الصورة التي قبلها للي بعدها.\n"
        "- seconds = الطول الذي الجزء المفروض تاخده في الفيديو النهائي (حسب إيقاع الموصل الأصلي)، من 0.6 لـ 6.\n"
        "- الأوصاف بالإنجليزية ودقيقة: النص المكتوب على الشاشة يظل كما هو بالضبط، ولا يوجد قطع.\n"
        "استعد JSON فقط هذا بالشكل:\n" + TRIAL_FORMAT
    )


def clean_trial_plan(data: dict, max_keys: int = 2) -> dict:
    d = data or {}
    keys = [{"label": str(k.get("label") or f"مرحلة {i + 1}")[:120], "prompt": str(k.get("prompt") or "")[:2000]}
            for i, k in enumerate(d.get("keyframes") or []) if isinstance(k, dict) and str(k.get("prompt") or "").strip()][:max_keys]
    segs = []
    for i, x in enumerate(d.get("segments") or []):
        if not isinstance(x, dict):
            continue
        try:
            sec = float(x.get("seconds") or 2)
        except (TypeError, ValueError):
            sec = 2.0
        segs.append({"label": str(x.get("label") or f"حركة {i + 1}")[:120], "prompt": str(x.get("prompt") or "")[:2000],
                     "seconds": round(min(6.0, max(0.6, sec)), 2)})
    while len(segs) < len(keys) + 1:   # لازم حركة بين كل صورتين
        segs.append({"label": f"حركة {len(segs) + 1}", "prompt": "Smooth continuous transformation from the start frame to the end frame, no cut.",
                     "seconds": 2.0})
    return {"adapted": str(d.get("adapted") or "")[:2000], "anchors": [str(x)[:200] for x in d.get("anchors") or []][:8],
            "keyframes": keys, "segments": segs[:len(keys) + 1]}


def mock_trial_plan() -> dict:
    return {"adapted": "١. زووم ناعم على العنصر الذي اتداس\n٢. الخلفية تتحول للمشهد الجديد", "anchors": ["النص المكتوب"],
            "keyframes": [{"label": "النص: الخلفية تتحول", "prompt": "Halfway state: background morphing into the next scene."}],
            "segments": [{"label": "زووم وبداية التحوّل", "prompt": "Slow zoom in, background starts morphing.", "seconds": 1.5},
                         {"label": "التحوّل يُكمل", "prompt": "Background finishes morphing into the final frame.", "seconds": 1.5}]}


# ------------------------------------------------------------ 🎞️ فيديو مبني على الكونيكتورز

FILM_FORMAT = """{
  "title": "اسم الفيديو",
  "idea": "الفكرة في سطرين: القصة التي تربط المشاهد والموصلات",
  "scenes": [{"label": "اسم المشهد بالعربية", "feature": "الميزة التي المشهد يعرضها",
              "voice": "جملة الفويس أوفر اللي بتتقال على المشهد ده (بلغة ولهجة العميل، طبيعية ومتسلسلة مع اللي قبلها، تتقال في وقت المشهد والكونيكتور اللي بعده)",
              "text": "الكلام المكتوب على الشاشة في المشهد ده (قصير، بلغة ولهجة العميل) أو فاضي",
              "screen": "اسم شاشة / شعار / صورة منتج من ملف العميل إذا المشهد تحتاجها بالضبط، أو فارغ",
              "start": "English image prompt for the FIRST frame of the scene (composition, subject, UI, background, colors, the on-screen text in quotes)",
              "end": "English image-edit instruction from the first frame to the LAST frame of the scene: what moved or appeared, and how it is set up so the next connector can start (keep the same style and text)",
              "motion": "English prompt for a start-frame/end-frame video model: the continuous motion inside the scene, no cut",
              "seconds": 3}],
  "links": [{"asset": "id الموصل من القائمة", "why": "له هذا الموصل بالذات بين هؤلاء المشهدين وكيف يُكمل القصة"}]
}"""


def film_plan_messages(brain_txt: str, brief: str, conns: list[dict], n_scenes: int) -> str:
    """نص طلب السيناريو. بعده تأتي فريمات كل كونيكتور مرجعي بالترتيب الذي في القائمة."""
    rows = []
    for c in conns:
        r = c.get("connector") or {}
        rows.append({"id": c["id"], "name": c.get("name"), **{k: r.get(k) for k in (
            "family", "from_scene", "to_scene", "trigger", "anchors", "transforms", "camera", "rhythm", "recipe", "story_role")}})
    return (
        "أنت مخرج إعلانات موشن جرافيك. سنعمل فيديو قصير مبني على «موصلات»: تحوّلات تحكي وتودّي من مشهد لمشهد بدون قطع. "
        "هذه الموصلات اتطلعت من فيديوهات حقيقية ومعها وصفتها. المطلوب سيناريو المشاهد يُكتب على مقاس الموصلات: "
        "كل مشهد يجب ينتهي في وضع يخلي شرارة الموصل الذي بعده تحدث طبيعي، والمشهد الذي بعده يبدأ مكان ما الموصل يوصل.\n\n"
        f"ملف العميل:\n{brain_txt or '(لا يوجد)'}\n\n"
        f"المطلوب من الفيديو: {brief or 'فيديو قصير يعرض أهم مميزات المنتج'}\n\n"
        f"الموصلات المتاحة (استخدم كل واحد مرة على الأقل إذا ينفع، بالترتيب الذي يخدم القصة):\n{json.dumps(rows, ensure_ascii=False, indent=1)}\n\n"
        "الصور الذي بعد هذا النص = فريمات الموصلات المرجعية بنفس ترتيب القائمة (البداية والنص والنهاية لكل واحد).\n\n"
        f"- عدد المشاهد {n_scenes}، وعدد links = عدد المشاهد - 1 بالضبط (link رقم 1 بين المشهد 1 و2 وهكذا).\n"
        "- كل مشهد يعرض ميزة واحدة واضحة. أول مشهد خطاف قوي، وآخر مشهد فيه اسم/شعار العلامة وجملة تحفيز.\n"
        "- الكلام على الشاشة قصير جدًا (٣-٧ كلمات) ومكتوب صح بلغة ولهجة العميل.\n"
        "- إذا المشهد فيه شاشة التطبيق أو الشعار الحقيقي اكتب اسمه في screen بالضبط كما هو في ملف العميل.\n"
        "- الأوصاف بالإنجليزية، والنص الذي سيُكتب على الشاشة يوضع بين علامات تنصيص كما هو بالعربية.\n"
        "- التعليق الصوتي: جملة واحدة قصيرة لكل مشهد (٥-١٢ كلمة)، والجمل مع بعض تحكي قصة واحدة متصلة، والنص الذي على الشاشة "
        "ليس ضروريًا يكرر الفويس بالحرف.\n"
        "- seconds للمشهد من 2 لـ 5.\n"
        + algo.AIVIDEO_RULE + "\n"
        "استعد JSON فقط هذا بالشكل:\n" + FILM_FORMAT
    )


def clean_film_plan(data: dict, conn_ids: list[str], max_scenes: int = 8) -> dict:
    d = data or {}
    scenes = []
    for i, x in enumerate(d.get("scenes") or []):
        if not isinstance(x, dict):
            continue
        try:
            sec = float(x.get("seconds") or 3)
        except (TypeError, ValueError):
            sec = 3.0
        scenes.append({"label": str(x.get("label") or f"مشهد {i + 1}")[:120], "feature": str(x.get("feature") or "")[:300],
                       "voice": str(x.get("voice") or "")[:600],
                       "text": str(x.get("text") or "")[:200], "screen": str(x.get("screen") or "")[:120],
                       "start": str(x.get("start") or "")[:3000], "end": str(x.get("end") or "")[:3000],
                       "motion": str(x.get("motion") or "")[:2000], "seconds": round(min(10.0, max(1.0, sec)), 2)})
    scenes = scenes[:max_scenes]
    links = []
    for i in range(max(0, len(scenes) - 1)):
        x = (d.get("links") or [])[i] if i < len(d.get("links") or []) else {}
        x = x if isinstance(x, dict) else {}
        aid = str(x.get("asset") or "")
        if aid not in conn_ids and conn_ids:
            aid = conn_ids[i % len(conn_ids)]
        links.append({"asset": aid, "why": str(x.get("why") or "")[:1000]})
    return {"title": str(d.get("title") or "")[:120], "idea": str(d.get("idea") or "")[:2000], "scenes": scenes, "links": links}


def mock_film_plan(conns: list[dict], n_scenes: int, brand: str) -> dict:
    feats = ["الخطاف", "ميزة أولى", "ميزة أخرى", "ميزة تالتة", "ميزة رابعة", "ميزة خامسة", "ميزة سادسة", "الختام"]
    scenes = [{"label": f"مشهد {i + 1}", "feature": feats[min(i, len(feats) - 1)], "text": f"{brand} {i + 1}", "screen": "",
               "voice": f"هذه الجملة رقم {i + 1} في التعليق الصوتي",
               "start": f"Scene {i + 1} first frame.", "end": "Element moves to the center.", "motion": "Slow push in.", "seconds": 3}
              for i in range(n_scenes)]
    links = [{"asset": conns[i % len(conns)]["id"], "why": "تجربة"} for i in range(n_scenes - 1)] if conns else []
    return {"title": f"مميزات {brand}", "idea": "فيديو تجريبي", "scenes": scenes, "links": links}


SCRIPT_APPLY_FORMAT = """{"scenes": [{"i": "رقم المشهد كما هو", "action": "none أو text أو redraw",
  "why": "له (بالعربية، سطر)",
  "start": "English prompt جديد لأول المشهد (إذا redraw فقط)", "end": "English prompt جديد لآخر المشهد (إذا redraw فقط)",
  "motion": "English motion prompt جديد (إذا redraw فقط)"}]}"""


def film_script_apply_messages(plan: dict, changed: list[dict]) -> str:
    """النص عُدّل: لكل مشهد تغيّر، النموذج يقرر الفريمات تُعدّل كيف."""
    scenes = [{"i": i, "label": s["label"], "voice": s.get("voice", ""), "text": s.get("text", "")} for i, s in enumerate(plan["scenes"])]
    return (
        "أنت مخرج موشن جرافيك. لدينا فيديو رُسمت فريماته، والمستخدم عدّل في النص (التعليق الصوتي والنص الذي على الشاشة). "
        "المطلوب لكل مشهد تغيّر تقرر الفريمات الخاصة به تُعدّل كيف:\n"
        "- none: التغيير لا يحتاج يُرى في الصورة (مثلًا الفويس ضُبطت صياغته فقط والمعنى كما هو، والنص الذي على الشاشة ما اتغيرش).\n"
        "- text: الصورة كما هي، فقط النص المكتوب على الشاشة يُستبدل بالجديد.\n"
        "- redraw: معنى المشهد تغيّر (ميزة أخرى، شيء أخرى يجب تظهر) والفريمات يجب تُرسم من جديد: اكتب start وend وmotion جداد "
        "بنفس أسلوب القديمة، ومن غير ما تُفسد علاقة آخر المشهد بالكونيكتور الذي بعده وأوله بالكونيكتور الذي قبله.\n\n"
        f"فكرة الفيديو: {plan.get('idea', '')}\n\nالنص كله الآن:\n{json.dumps(scenes, ensure_ascii=False, indent=1)}\n\n"
        f"المشاهد الذي تغيّرت (القديم والجديد والأوصاف الحالية):\n{json.dumps(changed, ensure_ascii=False, indent=1)}\n\n"
        "استعد JSON فقط هذا بالشكل، لكل مشهد تغيّر:\n" + SCRIPT_APPLY_FORMAT
    )


SCRIPT_REWRITE_FORMAT = """{"scenes": [{"i": "رقم المشهد", "voice": "جملة التعليق الصوتي الجديدة", "text": "النص الجديد على الشاشة"}]}"""


def film_script_rewrite_messages(brain_txt: str, plan: dict, instruction: str) -> str:
    scenes = [{"i": i, "feature": s.get("feature", ""), "voice": s.get("voice", ""), "text": s.get("text", "")}
              for i, s in enumerate(plan["scenes"])]
    return (
        "أنت كاتب إعلانات. هذا نص فيديو قصير (لكل مشهد: جملة تعليق صوتي ونص مكتوب على الشاشة). "
        "عدّله حسب طلب المستخدم وبس، والمشاهد التي الطلب لا يخصها اتركها كما هي بالحرف. "
        "خلي اللغة واللهجة زي ملف العميل، وعدد المشاهد زي ما هو.\n\n"
        f"ملف العميل:\n{brain_txt or '(لا يوجد)'}\n\nالنص:\n{json.dumps(scenes, ensure_ascii=False, indent=1)}\n\n"
        f"طلب المستخدم: {instruction}\n\nاستعد JSON فقط هذا بالشكل (كل المشاهد):\n" + SCRIPT_REWRITE_FORMAT
    )


# ------------------------------------------------------------ 🗺️ مخطط الفيديو (تيمبليت كامل)

SCHEMA_ROLES = {"hook": "🪝 خطاف", "problem": "😣 مشكلة", "feature": "✨ ميزة", "proof": "📈 دليل", "cta": "👉 دعوة", "other": "• آخر"}

SCHEMA_FORMAT = """{
  "title": "اسم قصير هذا للأسلوب (بالعربية)",
  "summary": "هذا الفيديو حسنًا كيف في سطرين (بالعربية)",
  "beat_sec": 0.5,
  "style": "English: the single visual world of the whole video (render style, materials, lighting, background, depth, typography look) so it can be recreated",
  "palette": "English: ONLY the locked colors, each with name + approximate HEX, e.g. sage green (#9CAF88)",
  "background": "English: the persistent background/texture that repeats through the whole video",
  "negative": "English: what this style never has (colors outside the palette, elements that break it)",
  "last_frame": "English: a precise description of the final held frame (it stays in the viewer's eye and becomes the screenshot)",
  "transition": "one of: cut | fade | fadeblack | fadewhite | dissolve | wipeleft | slideleft | smoothleft | circleopen | zoomin | pixelize | hblur (the cut style between parts that matches this video)",
  "spine": "English: the element(s) that stay on screen and carry the eye through the whole video (or how continuity is kept)",
  "camera": "English: the overall camera language (always moving? push-ins? orbit? speed and easing)",
  "text_style": "English: how on-screen text looks and where it sits",
  "music": "نوع الموسيقى وإيقاعها (بالعربية)",
  "beats": [{"t0": 0.0, "t1": 1.5, "role": "hook | problem | feature | proof | cta | other",
             "what": "ما يحدث في هذا الجزء بالعربية",
             "layout": "English: the composition of this beat with content SLOTS in brackets, e.g. [app screen] in a phone at center, [headline] top third",
             "slots": [{"kind": "screen | logo | headline | subtext | product | person | icon | other", "desc": "English: what goes there"}],
             "camera": "English: camera move inside this beat",
             "into_next": "English: exactly how this beat flows into the next one with no cut (what moves/morphs/zooms), or empty for the last",
             "keeps": "English: what stays identical going into the next beat",
             "sfx": "المؤثر الصوتي إذا فيه"}]
}"""


def schema_messages(d: dict) -> list[dict]:
    """النموذج يشاهد الفيديو كله ويُخرج مخططه: الثوابت، والتايم لاين جزء جزء بالخانات التي تتملا بمحتوى أي عميل."""
    lines = [f"- لقطة {s['n']} ({s['start']:.2f}–{s['end']:.2f}): {(s.get('analysis') or {}).get('summary', '')}" for s in d.get("shots") or []]
    conns = [f"- {c['name']} ({c['t0']:.2f}–{c['t1']:.2f}): {c.get('trigger', '')}" for c in d.get("connectors") or []]
    text = (
        "أنت مخرج موشن جرافيك محترف. شاهد هذا الفيديو كله بالصوت. هذا الفيديو يحس أنه قطعة واحدة متصلة، "
        "والمطلوب نطلّع «مخططه» لكي نعمل فيديوهات أخرى لعملاء آخرين بنفس الإحساس بالضبط: نفس العالم، ونفس الإيقاع، "
        "ونفس حركة الكاميرا، ونفس طريقة انتقال كل جزء للي بعده بدون قطع.\n\n"
        f"الفيديو مدته {d['source']['duration']:.2f} ثانية.\n"
        + ("اللقطات التي اتعرفت (للمساعدة، الفيديو هو المرجع):\n" + "\n".join(lines) + "\n" if lines else "")
        + ("الموصلات التي اتعرفت:\n" + "\n".join(conns) + "\n" if conns else "")
        + "\nقسّم الفيديو لأجزاء (beats) على الإيقاع: كل جزء له وظيفة في القصة ووضع واضح للشاشة (من 0.8 لـ 4 ثواني غالبًا). "
        "الأجزاء خلف بعض بدون فراغ (t1 الخاص بـ جزء = t0 الخاص بـ ما بعده) وتغطي الفيديو كله.\n"
        "- اكتب المحتوى كخانات عامة بين أقواس [ ] (مثلًا [app screen]، [headline]، [logo]) بدل اسم المنتج أو النص الذي في هذا الفيديو، "
        "لكي التيمبليت ينفع لأي عميل.\n"
        "- into_next أهم شيء: كيف هذا الجزء يتحوّل للي بعده أمام العين بدون قطع (زووم داخل شيء، عنصر يكبر ويصبح الخلفية، الكاميرا تدور...).\n"
        "- beat_sec = طول البيت في الموسيقى (إذا غير واضح اكتب 0).\n"
        "- الأجزاء توصف «النمط» فقط (نوع النبضة ومدتها ووظيفتها) غير محتوى هذا الفيديو، لكي القالب ينفع لأي فكرة.\n"
        "- الألوان المقفولة فقط، كل لون باسمه وكود HEX تقريبي. الخطوط بأدوارها (عنوان / ثانوي / توقيع) بدون ما تخترع خط غير موجود.\n"
        "- أي شيء غير واضحة في الفيديو اكتبها «غير محدد» (unspecified) بدل ما تخمّن. وفي الصوت فرّق بين ما متأكد منه واللي مستنتج.\n"
        "- negative = قايمة الممنوعات بتاعة الستايل ده، و last_frame = وصف دقيق للكادر الأخير الثابت.\n"
        "- ممنوع تنقل أسامي أو شعارات أو حسابات صاحب الفيديو الأصلي أو وشوش أشخاص حقيقيين: كله يتوصف بشكل عام.\n"
        "استعد JSON فقط هذا بالشكل:\n" + SCHEMA_FORMAT
    )
    return [{"role": "user", "content": text}]


def _f(v, d=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return d


def clean_schema(data: dict, duration: float) -> dict:
    d = data or {}
    beats = []
    for x in d.get("beats") or []:
        if not isinstance(x, dict):
            continue
        t0, t1 = max(0.0, _f(x.get("t0"))), min(duration, _f(x.get("t1")))
        if t1 - t0 < 0.2:
            continue
        slots = [{"kind": str(z.get("kind") or "other")[:20], "desc": str(z.get("desc") or "")[:300]}
                 for z in x.get("slots") or [] if isinstance(z, dict)][:6]
        beats.append({"t0": round(t0, 2), "t1": round(t1, 2), "role": x.get("role") if x.get("role") in SCHEMA_ROLES else "other",
                      "what": str(x.get("what") or "")[:600], "layout": str(x.get("layout") or "")[:800], "slots": slots,
                      "camera": str(x.get("camera") or "")[:400], "into_next": str(x.get("into_next") or "")[:800],
                      "keeps": str(x.get("keeps") or "")[:400], "sfx": str(x.get("sfx") or "")[:200]})
    beats.sort(key=lambda b: b["t0"])
    beats = beats[:16]
    if beats:
        beats[-1]["into_next"] = ""
    tr = str(d.get("transition") or "").strip().lower()
    return {k: _plain(d.get(k))[:1500] for k in ("title", "summary", "style", "palette", "spine", "camera", "text_style", "music",
                                                 "background", "negative", "last_frame")} | {
        "transition": tr if tr in TRANSITION_KEYS else "",
        "beat_sec": round(max(0.0, _f(d.get("beat_sec"))), 3), "loop": bool(d.get("loop")), "beats": beats}


def mock_schema(d: dict) -> dict:
    dur = d["source"]["duration"]
    n = max(2, min(5, int(dur // 2)))
    step = dur / n
    roles = ["hook", "feature", "feature", "proof", "cta"]
    return {"title": "جوال في النص والكاميرا ماشية", "summary": "جوال ثابت في النص والكاميرا تدخل داخل الشاشات", "beat_sec": 0.5,
            "style": "Clean 3D render, soft studio light, pastel background.", "palette": "teal, cream", "spine": "A phone at center.",
            "camera": "Always pushing in slowly.", "text_style": "Bold sans headline in the top third.", "music": "بيت خفيف",
            "beats": [{"t0": round(i * step, 2), "t1": round((i + 1) * step, 2), "role": roles[min(i, 4)], "what": f"جزء {i + 1}",
                       "layout": "[app screen] in a phone at center, [headline] top third", "slots": [{"kind": "screen", "desc": "app screen"}],
                       "camera": "slow push in", "into_next": "zoom into the screen until it becomes the background" if i < n - 1 else "",
                       "keeps": "the phone", "sfx": ""} for i in range(n)]}


TRANSITION_KEYS = {"cut", "fade", "fadeblack", "fadewhite", "dissolve", "wipeleft", "slideleft", "smoothleft", "circleopen", "zoomin",
                   "pixelize", "hblur", "radial", "squeezeh", "diagtl", "slideup"}

TEXT_MODES = {"blank": "مساحات فارغة (النص العربية في المونتاج)", "en": "نص إنجليزي داخل الصور"}

FILL_FORMAT = """{
  "title": "اسم الفيديو",
  "world": "English: ONE consistent world for the whole video (style, lighting, background, the spine element, the brand colors) repeated in every panel",
  "panels": [{"desc": "English: exactly what the frame looks like at this moment (composition per the template layout, which real brand asset fills which slot)", "asset": "اسم الأصل من ملف العميل الذي يظهر هنا أو فارغ"}],
  "beats": [{"motion": "English prompt for a start-frame/end-frame video model: the continuous motion from this panel to the next one (camera move + the template's into_next), no cut",
             "text": "الكلام اللي على الشاشة في الجزء ده", "voice": "جملة فويس أوفر للجزء ده (بلغة ولهجة العميل) أو فاضي"}]
}"""


def fill_messages(brain_txt: str, schema: dict, brief: str, text_mode: str) -> str:
    n = len(schema["beats"])
    beats = [{k: b[k] for k in ("t0", "t1", "role", "what", "layout", "slots", "camera", "into_next", "keeps")} for b in schema["beats"]]
    glob = {k: schema.get(k) for k in ("style", "palette", "background", "spine", "camera", "text_style", "negative", "last_frame") if schema.get(k)}
    text_rule = ("الكلام اللي على الشاشة بالإنجليزي (قصير جدًا، ٢-٥ كلمات) وهيترسم جوه الصور." if text_mode == "en" else
                 "الكلام اللي على الشاشة بلغة ولهجة العميل (قصير جدًا) ومش هيترسم في الصور: الصور بتسيب مكانه فاضي "
                 "(مساحة نضيفة في مكان خانة النص) وسيُضاف في المونتاج.")
    return (
        "أنت مخرج إعلانات موشن جرافيك. لدينا «تيمبليت» متطلّع من فيديو احترافي يحس أنه قطعة واحدة. "
        "المطلوب تعمل فيديو جديد هذا للعميل على نفس التيمبليت بالضبط: نفس عدد الأجزاء ونفس وظيفة كل جزء ونفس الكاميرا ونفس طريقة الانتقال، "
        "فقط المحتوى (الخانات) تتملا بمنتج العميل وأصوله الحقيقية.\n\n"
        f"ملف العميل:\n{brain_txt or '(لا يوجد)'}\n\nالمطلوب من الفيديو: {brief or 'فيديو يعرض أهم مميزات المنتج'}\n\n"
        f"ثوابت التيمبليت:\n{json.dumps(glob, ensure_ascii=False, indent=1)}\n\nأجزاء التيمبليت:\n{json.dumps(beats, ensure_ascii=False, indent=1)}\n\n"
        f"- panels = {n + 1} لوحة بالضبط: لوحة رقم i هي شكل الشاشة في أول الجزء i، واللوحة الأخيرة شكلها في آخر الفيديو. "
        "أي الجزء i يتحرك من اللوحة i للوحة i+1، فاللوحتين يجب يكونون نفس العالم ونفس العناصر، والفرق بينهم هو ما يعمله into_next.\n"
        + ("- 🔁 هذا الفيديو لوب: آخر جزء يعود لأول لوحة بالضبط، فاللوحة الأخيرة يجب تكون نفس اللوحة الأولى حرفيًا (نفس desc)، "
           "والـ motion الخاص بـ آخر جزء يوصّل هذا للشكل بدون قطع.\n" if schema.get("loop") else "") +
        f"- beats = {n} بالضبط بنفس الترتيب.\n"
        "- العالم واحد في كل اللوحات: نفس الخلفية والإضاءة والألوان، والعمود الفقري (spine) موجود ومتوصف بنفس النص في كل لوحة.\n"
        f"- {text_rule}\n"
        "- إذا خانة فيها شاشة التطبيق أو الشعار أو المنتج، اكتب اسمه في asset بالضبط مثل ملف العميل (إذا اللوحة فيها جوال يعرض التطبيق، "
        "يجب asset = اسم شاشة حقيقية من ملف العميل).\n"
        "- ⚠️ desc بيوصف محتوى حقيقي من منتج العميل: الميزة الحقيقية والشاشة الحقيقية. ممنوع تمامًا أي كلام عام أو خانات زي "
        "[headline] أو headline أو CTA أو proof statement أو feature description أو placeholder أو label، وممنوع أقواس [ ].\n"
        + ("- ⚠️ الصور بدون نص: desc ما يذكرش أي نص مكتوب أو عناوين أو أزرار عليها نص أو أرقام. مكان النص اكتب بداله: "
           "\"a clean empty area in the upper part (reserved for text added later)\".\n" if text_mode != "en" else "")
        + "- العمود الفقري (spine) فكرة استمرارية (حركة، عنصر ثابت)، غير خط أو علامة تُرسم: وصّفه كعنصر حقيقي في المشهد أو كطريقة حركة.\n"
        + (algo.AIVIDEO_RULE if text_mode != "en" else algo.AIVIDEO_RULE.rsplit("\n", 1)[0]) + "\n"
        "استعد JSON فقط هذا بالشكل:\n" + FILL_FORMAT
    )


def _plain(v) -> str:
    """النموذج ساعات ينسخ «English:» من الشكل المطلوب: يُزال."""
    return re.sub(r"^\s*English\s*:\s*", "", str(v or "")).strip()


def clean_fill(data: dict, n: int) -> dict:
    d = data or {}
    panels = [{"desc": _plain(x.get("desc"))[:2000], "asset": str(x.get("asset") or "")[:120]}
              for x in d.get("panels") or [] if isinstance(x, dict)][:n + 1]
    while len(panels) < n + 1:
        panels.append({"desc": panels[-1]["desc"] if panels else "", "asset": ""})
    beats = [{"motion": _plain(x.get("motion"))[:1500], "text": str(x.get("text") or "")[:200], "voice": str(x.get("voice") or "")[:600]}
             for x in d.get("beats") or [] if isinstance(x, dict)][:n]
    while len(beats) < n:
        beats.append({"motion": "Smooth continuous camera move from the start frame to the end frame, no cut.", "text": "", "voice": ""})
    return {"title": str(d.get("title") or "")[:120], "world": _plain(d.get("world"))[:2000], "panels": panels, "beats": beats}


def mock_fill(schema: dict, brand: str) -> dict:
    n = len(schema["beats"])
    return {"title": f"{brand} على التيمبليت", "world": "Pastel 3D studio, a teal phone at center.",
            "panels": [{"desc": f"Panel {i + 1}: the phone at center showing screen {i + 1}.", "asset": ""} for i in range(n + 1)],
            "beats": [{"motion": "Slow push in.", "text": f"{brand} {i + 1}", "voice": f"جملة {i + 1}"} for i in range(n)]}


def sheet_grid(count: int) -> tuple[int, int]:
    """(أعمدة، صفوف): أقل خانات فارغة ممكنة (النموذج يرسم في الخانات الفاضية)، والورقة كله يأخذ النسبة التي تُخرج كل لوحة بالمقاس."""
    return {1: (1, 1), 2: (2, 1), 3: (3, 1), 4: (2, 2), 5: (3, 2), 6: (3, 2), 7: (4, 2), 8: (4, 2), 9: (3, 3)}.get(count, (3, 3))


def sheet_ratio(count: int, ratio: str) -> str:
    """نسبة الورقة كله = نسبة اللوحة × الشبكة (أقرب نسبة النموذج يدعمها)."""
    cols, rows = sheet_grid(count)
    pw, ph = {"9:16": (9, 16), "16:9": (16, 9)}.get(ratio, (1, 1))
    want = cols * pw / (rows * ph)
    return min(("9:16", "16:9", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "21:9"),
               key=lambda r: abs(int(r.split(":")[0]) / int(r.split(":")[1]) - want))


RATIO_WORDS = {"9:16": "tall vertical portrait (width:height = 9:16, like a phone screen)",
               "16:9": "wide horizontal landscape (width:height = 16:9)", "1:1": "square (1:1)"}


def sheet_prompt(schema: dict, fill: dict, cells: list[int], ratio: str, text_mode: str, texts: list[str],
                 refs: list[str], style_from_prev: bool) -> str:
    """وصف ورقة ستوري بورد واحد فيه هذه اللوحات كلها، ينفع يوضع في ChatGPT كما هو."""
    cols, rows = sheet_grid(len(cells))
    lines = []
    for k, j in enumerate(cells):
        t = texts[j] if j < len(texts) else ""
        txt = (f' On-screen text: "{t}".' if text_mode == "en" and t else
               " Leave a clean empty area where the headline would go (no letters)." if text_mode != "en" and t else "")
        lines.append(f"Panel {k + 1}: {fill['panels'][j]['desc']}{txt}")
    ref_txt = "".join(f"\nReference image {i + 1} is {r}: use it exactly as it is wherever it appears." for i, r in enumerate(refs))
    shape = RATIO_WORDS.get(ratio, ratio)
    empty = cols * rows - len(cells)
    return (
        f"IMAGE FORMAT: the whole sheet is {sheet_ratio(len(cells), ratio)} (width:height); each of the {rows}x{cols} cells inside it is a {shape} frame.\n"
        f"SAFE AREA: each panel may be trimmed to an exact {shape} frame from its centre, so keep every important element "
        "(subject, device, logo, faces, the empty text area) well inside the centre of its panel; near the panel edges put only background.\n"
        f"One single image: a storyboard sheet, an exact grid of {rows} rows x {cols} columns of equal cells. EVERY cell is a {shape} frame "
        f"(never square, never cropped differently), all the same size, read left to right, top to bottom, separated by thin plain white "
        "gutters, no borders, no panel numbers, no captions.\n"
        + (f"There are {len(cells)} panels: fill the first {len(cells)} cells in reading order and leave the last {empty} cell(s) plain white.\n"
           if empty else "")
        + "All panels are frames of ONE continuous video shot in ONE world: identical style, lighting, background, colors, materials and the "
        "same recurring elements in every panel, so that consecutive panels look like moments of the same take.\n"
        f"WORLD: {fill.get('world') or schema.get('style')}\n"
        f"STYLE: {schema.get('style')}\nPALETTE (use only these colors): {schema.get('palette')}\n"
        + (f"PERSISTENT BACKGROUND (identical in every panel): {schema.get('background')}\n" if schema.get("background") else "")
        + (f"NEVER: {schema.get('negative')}\n" if schema.get("negative") else "")
        + f"CONTINUITY (an idea about how the shot stays one piece; do NOT draw it as lines, guides, arrows or marks): {schema.get('spine')}\n"
        + ("No text or letters anywhere except inside real brand assets.\n" if text_mode != "en" else
           f"TEXT STYLE: {schema.get('text_style')} Spell English text exactly as given.\n")
        + ("The previous storyboard sheet is attached: match its world and style exactly.\n" if style_from_prev else "")
        + "\n".join(lines) + ref_txt
        + f"\nDraw exactly {len(cells)} panels" + (f" and leave the other {empty} cell(s) completely plain white." if empty else ".")
        + ("\nREMINDER: absolutely no letters, words, numbers, labels or placeholder text anywhere (only inside the real logo/screens given)."
           if text_mode != "en" else "")
    )


def once_prompt(schema: dict, fill: dict, ids: list[int], secs: float, sheets: list[str], refs: list[str], extend: bool) -> str:
    """وصف توليدة واحدة تسير على لوحات هذه الأجزاء بالترتيب في لقطة واحدة متصلة. sheets: وصف كل صورة ورقة (رقمها = ترتيبها)،
    refs: أصول العميل بعدها. extend: هذه التوليدة تُكمل على الفيديو الذي قبلها (@video1) من آخر فريم فيه."""
    beats = schema["beats"]
    span = sum(beats[i]["t1"] - beats[i]["t0"] for i in ids) or 1
    f, t, lines = secs / span, 0.0, []
    for i in ids:
        b, d = beats[i], (beats[i]["t1"] - beats[i]["t0"]) * f
        bits = [_plain(fill["beats"][i].get("motion")), f"Camera: {_plain(b.get('camera')).rstrip('.')}." if b.get("camera") else "",
                f"Flows into the next panel: {_plain(b.get('into_next')).rstrip('.')}." if b.get("into_next") else ""]
        lines.append(f"{t:.1f}s-{t + d:.1f}s: from panel {i + 1} to panel {i + 2}. " + " ".join(x for x in bits if x))
        t += d
    first, last = ids[0], ids[-1] + 1
    sheet_txt = "".join(f"@image{k + 1} is {x}\n" for k, x in enumerate(sheets))
    ref_txt = "".join(f"\n@image{len(sheets) + k + 1} is {r}: keep it exactly as it looks wherever it appears." for k, r in enumerate(refs))
    head = (f"Extend @video1 forward. The first frame of this video continues directly from the last frame of @video1, which shows panel {first + 1}: "
            f"{fill['panels'][first]['desc']} Same framing, lighting and the same camera motion and direction, with no cut, no fade and no restart. "
            "Do not replay anything from @video1.\n"
            if extend else f"The video opens on panel {first + 1}. ")
    return (
        head + sheet_txt
        + "The storyboard panels, read left to right and top to bottom, are consecutive moments of ONE video. "
        f"Turn panels {first + 1} to {last + 1} into ONE continuous single-take {secs:.0f}-second video that passes through every one of them in order "
        f"and ends exactly on panel {last + 1}. No cuts, no fades, no pauses, never go back to an earlier panel: the camera keeps moving the whole "
        "time and every move flows straight into the next one, so the whole video feels like one piece.\n"
        f"CAMERA LANGUAGE: {_plain(schema.get('camera'))}\n"
        f"CONTINUITY: {_plain(schema.get('spine'))}\n"
        f"WORLD: {_plain(fill.get('world') or schema.get('style'))}\n"
        "TIMELINE:\n" + "\n".join(lines) + "\n"
        f"END STATE: panel {last + 1}: {fill['panels'][last]['desc']}\n"
        "Keep the look, colors, lighting, UI and every element identical to the storyboard. The output is a full-screen frame: "
        "never show the storyboard grid, the white gutters, several panels at once, panel numbers or any notes. "
        "Do not add any new text or letters." + ref_txt
    )


def _bands(white: list[float], n: int, parts: int, thr: float = 0.9) -> list[tuple[int, int]] | None:
    """حدود كل خانة على محور واحد من نسبة البكسلات البيضا في كل عمود/صف. None إذا الفواصل غير واضحة."""
    runs, start = [], None
    for i, v in enumerate(white + [0.0]):
        if v >= thr and start is None:
            start = i
        elif v < thr and start is not None:
            runs.append((start, i))
            start = None
    lead = runs[0][1] if runs and runs[0][0] == 0 else 0
    tail = runs[-1][0] if runs and runs[-1][1] >= n else n
    inner = [r for r in runs if r[0] > 0 and r[1] < n]
    seps = []
    for k in range(1, parts):
        want = lead + (tail - lead) * k / parts
        best = min(inner, key=lambda r: abs((r[0] + r[1]) / 2 - want), default=None)
        if best is None or abs((best[0] + best[1]) / 2 - want) > (tail - lead) / parts * 0.3 or best in seps:
            return None
        seps.append(best)
    edges = [lead] + [x for r in seps for x in r] + [tail]
    out = [(edges[2 * k], edges[2 * k + 1]) for k in range(parts)]
    return out if all(b - a > n / parts * 0.5 for a, b in out) else None


def _content_runs(white: list[float], n: int, thr: float = 0.9, max_gutter: float = 0.08, min_panel: float = 0.06) -> list[tuple[int, int]]:
    """أجزاء المحتوى على محور واحد. الفاصل = خط أبيض رفيع (أو هامش على الطرف)؛ مساحة بيضاء عريضة داخل لوحة غير فاصل."""
    gaps, start = [], None
    for i, v in enumerate(white + [0.0]):
        if v >= thr and start is None:
            start = i
        elif v < thr and start is not None:
            if start == 0 or i >= n or i - start <= n * max_gutter:
                gaps.append((start, i))
            start = None
    cuts, pos = [], 0
    for a, b in gaps:
        if a > pos:
            cuts.append((pos, a))
        pos = b
    if pos < n:
        cuts.append((pos, n))
    return [c for c in cuts if c[1] - c[0] >= n * min_panel]


def sheet_panels(gray: bytes, w: int, h: int, need: int) -> list[tuple[float, float, float, float]] | None:
    """اللوحات كما رُسمت فعلًا (صفوف، وداخل كل صف أعمدته)، بالترتيب من الشمال لليمين ومن أعلى لتحت.
    يعود (x0, x1, y0, y1) بالنسبة، أو None إذا ما لقاش العدد المطلوب."""
    if len(gray) < w * h:
        return None
    # لون الفواصل = لون أطراف الشيت (أبيض، رمادي، أسود... أيًا كان)، والبكسل «فاصل» لو قريب منه جدًا
    edge = sorted([gray[y * w + x] for y in (0, 1, h - 2, h - 1) for x in range(w)] + [gray[y * w + x] for x in (0, 1, w - 2, w - 1) for y in range(h)])
    bg = edge[len(edge) // 2]
    px = lambda x, y: abs(gray[y * w + x] - bg) <= 9  # noqa: E731
    rows = _content_runs([sum(px(x, y) for x in range(w)) / w for y in range(h)], h)
    out = []
    for y0, y1 in rows:
        cols = _content_runs([sum(px(x, y) for y in range(y0, y1)) / (y1 - y0) for x in range(w)], w)
        for x0, x1 in cols:
            # الحدود من فوق وتحت لكل لوحة لوحدها (لو الصف فيه لوحات بأطوال مختلفة)
            ys = _content_runs([sum(px(x, y) for x in range(x0, x1)) / (x1 - x0) for y in range(y0, y1)], y1 - y0, min_panel=0.3)
            a, b = (ys[0][0] + y0, ys[-1][1] + y0) if ys else (y0, y1)
            out.append((x0 / w, x1 / w, a / h, b / h))
    return out if len(out) >= need else None


def sheet_cells(gray: bytes, w: int, h: int, rows: int, cols: int) -> tuple[list, list] | None:
    """الفواصل البيضا بين اللوحات (من صورة رمادي صغيرة). يعود حدود الأعمدة والصفوف بالنسبة (0..1)، أو None."""
    if len(gray) < w * h:
        return None
    col_white = [sum(1 for y in range(h) if gray[y * w + x] > 228) / h for x in range(w)]
    row_white = [sum(1 for x in range(w) if gray[y * w + x] > 228) / w for y in range(h)]
    xs, ys = _bands(col_white, w, cols), _bands(row_white, h, rows)
    if not xs or not ys:
        return None
    return [(a / w, b / w) for a, b in xs], [(a / h, b / h) for a, b in ys]


def panel_redraw_prompt(schema: dict, fill: dict, j: int, ratio: str, text_mode: str, text: str, note: str, n_refs: int, n_style: int) -> str:
    """🎨 لوحة واحدة من أولًا (إذا ما في الورقة باظت)، بنفس عالم اللوحات التي جنبها."""
    return (f"A {RATIO_WORDS.get(ratio, ratio)} final frame (frame {j + 1} of {len(fill['panels'])}) of ONE continuous video shot. "
            "If the output is not exactly that shape it will be trimmed from the centre: keep every important element well inside the "
            "central area and put only background near the edges.\n"
            f"WORLD: {fill.get('world') or schema.get('style')}\nSTYLE: {schema.get('style')}\nPALETTE: {schema.get('palette')}\n"
            f"RECURRING ELEMENT: {schema.get('spine')}\nTHIS FRAME: {fill['panels'][j]['desc']}"
            + (f'\nOn-screen text exactly: "{text}".' if text_mode == "en" and text else "\nNo text or letters except inside real brand assets.")
            + (f"\nAlso: {note}" if note else "")
            + "".join(f"\nIMAGE {i + 1} is a real brand asset: keep it exactly as it is wherever it appears." for i in range(n_refs))
            + "".join(f"\nIMAGE {n_refs + i + 1} is a neighbouring frame of the same shot: match its world, style, lighting and recurring elements exactly."
                      for i in range(n_style)))


def panel_sharpen_prompt(desc: str, text_mode: str, text: str, note: str = "", padded: bool = False) -> str:
    return ("IMAGE 1 is one panel cut out of a storyboard sheet. Redraw it as a full-resolution final frame in the output's exact aspect "
            "ratio (keep everything inside the frame, extend the background if needed instead of stretching): EXACTLY the same composition, "
            "camera angle, elements, colors, lighting and style, only sharper and fully detailed. Do not add or remove anything. "
            "Fill the whole frame (no gutters or borders). If the output is not exactly 9:16 it will be trimmed from the centre, so keep "
            "every important element well inside the central area and put only background near the edges."
            + (" The blurred bands at the edges of IMAGE 1 are only padding to reach the right frame shape: replace them by naturally "
               "extending the scene (background, floor, surroundings) so it looks like one complete frame; the sharp central picture stays "
               "exactly as it is." if padded else "")
            + (f' On-screen text exactly: "{text}".' if text_mode == "en" and text else " No text or letters except inside real brand assets.")
            + (f"\nThe frame shows: {desc}" if desc else "")
            + (f"\nAlso: {note}" if note else "")
            + "\nOther attached images (if any) are the real brand assets: keep them exactly as they are.")


# ------------------------------------------------------------ تجارب من غير Atlas

def mock_audio(duration: float, marks: list[dict]) -> dict:
    sfx = [{"t": m["t"], "dur": 0.2, "label": "كليك تجريبي", "category": "click", "what": "تجربة"} for m in marks[:6]]
    return {"music": [{"start": 0.0, "end": round(duration, 2), "description": "بيت إلكتروني خفيف", "mood": "حماسي"}],
            "speech": [{"start": 0.3, "end": min(duration, 1.8), "speaker": "راوي", "text": "نص تجريبي"}], "sfx": sfx}


def mock_elements(shot: dict, sfx: list[dict]) -> dict:
    s, e = shot["start"], shot["end"]
    if shot["n"] % 2 == 0:
        return {"scene_type": "live_action", "summary": "تجربة: شخص يتكلم أمام الكاميرا", "motion_graphics": False,
                "mg_reason": "تصوير عادي بدون جرافيك", "background": {"name": "كافيه", "description": "تجربة"},
                "elements": [{"id": "e1", "name": "شخص", "type": "character", "description": "راجل قاعد", "first_t": s, "last_t": e,
                              "actions": [{"t0": s, "t1": e, "action": "speak", "detail": "يتكلم"}]}]}
    return {"scene_type": "screen_recording", "summary": "تجربة: ماوس يسحب ملف", "motion_graphics": True,
            "background": {"name": "سطح مكتب", "description": "خلفية زرقاء فاتحة"},
            "elements": [{"id": "e1", "name": "مؤشر ماوس أخضر", "type": "cursor", "description": "سهم أخضر", "first_t": s, "last_t": e,
                          "box": [0.45, 0.45, 0.05, 0.05],
                          "actions": [{"t0": s, "t1": (s + e) / 2, "action": "move", "from": [0.5, 0.5], "to": [0.05, 0.4],
                                       "detail": "حركة سريعة", "sfx": sfx[0]["id"] if sfx else None}]},
                         {"id": "e2", "name": "ملف صورة: علي", "type": "file", "description": "أيقونة صورة", "first_t": s, "last_t": e,
                          "box": [0.03, 0.38, 0.08, 0.1], "actions": [{"t0": (s + e) / 2, "t1": e, "action": "drag", "from": [0.05, 0.4],
                                                                       "to": [0.92, 0.8], "detail": "يتسحب للسلة"}]}]}


def to_json(d: dict) -> str:
    return json.dumps(d, ensure_ascii=False)


# ------------------------------------------------------------ ✏️ التعديل جوه المشهد (الحركة زي ما هي)

VEDIT_MODELS = {
    "gemini": {"model": "google/gemini-omni-1.1-flash/video-edit", "label": "Gemini Omni 1.1 (الأدق في الحفاظ على الحركة)", "per_sec": 0.107},
    "flux": {"model": "black-forest-labs/flux-3/edit-video", "label": "FLUX 3 (أرخص، يغيّر التوقيت أحيانًا)", "per_sec": 0.03},
    "kling": {"model": "kwaivgi/kling-video-o3-std/video-edit", "label": "Kling O3 (ضعيف في النص العربية)", "per_sec": 0.107},
}

VEDIT_FORMAT = """{"prompt": "the full English edit instruction"}"""


def vedit_messages(shot: dict, instruction: str) -> list[dict]:
    """يحوّل طلبك (بالعربية ومذكور فيه أسامي العناصر) لتعليمات إنجليزي دقيقة لموديل تعديل الفيديو."""
    an = shot.get("analysis") or {}
    els = "\n".join(f"- {e['name']} ({e['type']}): {e.get('description', '')}" for e in an.get("elements") or [])
    text = (
        "You write instructions for an AI video-edit model that edits an existing clip while preserving its motion.\n"
        f"The clip: {an.get('summary', '')}\nBackground: {(an.get('background') or {}).get('description', '')}\n"
        f"Elements in the clip:\n{els or '—'}\n\n"
        f"The user's requested changes (Arabic):\n{instruction}\n\n"
        "Write ONE precise English instruction for the video-edit model: name each element by its look and position so the model "
        "finds it, state exactly what changes (color, size, content, text — keep any Arabic text the user wants verbatim in Arabic "
        "script, in quotes), and if the user changes a motion (where it goes, path, destination) describe the new motion clearly. "
        "End by saying that everything else — background, layout, other elements, camera, timing and the smooth motion — must stay "
        "exactly the same.\n"
        f"Reply with JSON only: {VEDIT_FORMAT}"
    )
    return [{"role": "user", "content": text}]


def retime(ffmpeg: str, src: Path, out: Path, t0: float, t1: float, factor: float, duration: float) -> Path:
    """⏩ يسرّع أو يُبطئ جزء من اللقطة فقط (من t0 لـ t1) والباقي كما هو. factor > 1 = أسرع."""
    t0, t1 = max(0.0, t0), min(duration, t1)
    parts = []
    fc = []
    segs = [(0.0, t0, 1.0), (t0, t1, factor), (t1, duration, 1.0)]
    for i, (a, b, f) in enumerate(s for s in segs if s[1] - s[0] > 0.02):
        fc.append(f"[0:v]trim={a:.3f}:{b:.3f},setpts=(PTS-STARTPTS)/{f:.4f}[v{i}]")
        parts.append(f"[v{i}]")
    fc.append("".join(parts) + f"concat=n={len(parts)}:v=1:a=0[vout]")
    subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-filter_complex", ";".join(fc),
                    "-map", "[vout]", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", str(out)],
                   check=True, capture_output=True, timeout=300)
    return out
