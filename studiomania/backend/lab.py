"""🔬 معمل التفكيك: بياخد أي فيديو ويفككه لعناصره عشان نتعرف عليها ونقيّمها.

اللي بيتقاس بالكود (دقيق بالفريم والمللي ثانية): القطعات بين اللقطات، بدايات الأصوات (onsets)، ومقاطع الكلام.
اللي بيفهمه الموديل: إيه كل صوت (كليك، ووش...)، والموسيقى فين، وإيه العناصر اللي في كل لقطة وبتعمل إيه وإمتى.
وتفكيك الصورة لطبقات شفافة (Seedream layer decomposition) بيتعمل لكل لقطة لما تطلبه.
"""
from __future__ import annotations

import json
import math
import re
import subprocess
import uuid
from array import array
from pathlib import Path

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
    """القطعات بمقياس تغيّر الصورة بين كل فريم واللي بعده (scene score)، مش بالتخمين."""
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
    """من فريمات صغيرة (15 في الثانية): الحركة (قد إيه الفريم اتغير عن اللي قبله، حتى لو عنصر صغير بيتحرك)
    وتوزيع الألوان (العنصر اللي بيتحرك من مكان لمكان مبيغيّروش، العنصر الجديد اللي بيدخل بيغيّره)."""
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
    """⏸️ وقفة ساكنة وبعدها حركة جديدة = حتة جديدة (الوقفة بتفضل مع الحركة اللي قبلها: العنصر بيخلص ويثبت).
    «ساكن» بمقياس ثابت: الفيديو اللي فيه حركة طول الوقت (شخص بيتكلم، خلفية متحركة) مش بيتقطع على الفاضي."""
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
    """➕ عنصر جديد دخل حتى لو الحركة ما وقفتش: سرعة تغيّر المحتوى (الألوان) بتقفز فجأة فوق اللي كانت عليه
    في الثانية اللي فاتت. التغيير البطيء المستمر (خلفية بتتحرك، كاميرا ماشية، شخص بيتكلم) مبيقطعش."""
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
    """كل لقطة بتتقسم على كل تغيير جوه المشهد، فكل حركة / عنصر جديد بيبقى حتة لوحده:
    وقفة بين حركتين، أو عنصر جديد دخل حتى لو الحركة مكملة."""
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
    """فريمات اللقطة بتوقيتها (للمراجعة وللموديل): لحد 6 في الثانية و32 للقطة."""
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
    """بدايات الأصوات: كل لحظة الطاقة فيها بتعلى فجأة (9 dB فوق اللي قبلها). دقتها 10 مللي ثانية."""
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
    """وقت الموديل بيتظبط على أقرب بداية صوت اتقاست بالكود (لو قريبة)."""
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
  "speech": [{"start": 0.4, "end": 2.1, "speaker": "مين بيتكلم", "text": "الكلام حرفيًا"}],
  "sfx": [{"t": 1.23, "dur": 0.25, "label": "اسم الصوت بالعربي (مثلًا: كليك ماوس)", "category": "click | whoosh | pop | impact | typing | swipe | notification | riser | transition | ui | foley | ambience | other",
           "what": "إيه اللي بيحصل في الصورة وقتها والصوت ده مربوط بإيه"}]
}"""


def audio_messages(duration: float, marks: list[dict], speech: list[dict]) -> list[dict]:
    def in_speech(t):
        return any(s["start"] - 0.05 <= t <= s["end"] + 0.05 for s in speech)
    hints = ", ".join(f"{m['t']:.2f}{'*' if in_speech(m['t']) else ''}" for m in marks[:250]) or "—"
    said = "\n".join(f"- {s['start']:.2f}–{s['end']:.2f}: {s['text']}" for s in speech[:80]) or "—"
    text = (
        "أنت مهندس صوت. اتفرج على الفيديو ده واسمع صوته كويس، وفكك الصوت لـ ٣ حاجات: الموسيقى، الكلام، والمؤثرات الصوتية (SFX).\n"
        f"مدة الفيديو {duration:.2f} ثانية.\n"
        "المؤثرات الصوتية أهم حاجة: كل صوت لوحده (كليك، ووش، بوب، خبطة، كتابة على كيبورد، إشعار، سحبة، رايزر...) بوقت بدايته بالظبط "
        "ومدته، وإيه اللي بيحصل في الصورة في نفس اللحظة. متجمعش أصوات متكررة في سطر واحد: كل كليك سطر لوحده.\n"
        f"دي أوقات بدايات أصوات اتقاست بالكود بدقة 10 مللي ثانية: {hints}\n"
        "خلي بالك: الأوقات دي فيها بدايات كل حاجة بتعلى فجأة (مقاطع كلام، ضربات موسيقى، ومؤثرات)، مش كلها مؤثرات. "
        "اللي عليه * جوه وقت كلام فالأغلب إنه مقطع من الكلام. اسمع كل وقت وحط في sfx المؤثرات الحقيقية بس، "
        "وخد وقتها من القايمة دي عشان التوقيت يبقى مظبوط. ضربات الموسيقى مش مؤثرات.\n"
        f"والكلام اللي اتسمع (من التفريغ):\n{said}\n\n"
        "الأسماء والأوصاف بالعربي المصري البسيط. رجّع JSON بس بالشكل ده:\n" + AUDIO_FORMAT
    )
    return [{"role": "user", "content": text}]


# ------------------------------------------------------------ الموديل: عناصر كل لقطة

ELEMENTS_FORMAT = """{
  "scene_type": "live_action | screen_recording | motion_graphics | mixed",
  "summary": "اللقطة في جملة",
  "motion_graphics": true,
  "mg_reason": "ليه فيها أو مفيهاش موشن جرافيك ينفع يتاخد (جملة قصيرة)",
  "background": {"name": "اسم الخلفية", "description": "شكلها بالتفصيل"},
  "elements": [
    {"id": "e1", "name": "اسم العنصر (مثلًا: مؤشر ماوس أخضر)",
     "type": "character | cursor | icon | file | folder | window | button | text | logo | photo | ui | object | shape | effect | other",
     "description": "شكله بالتفصيل: اللون، الحجم، الستايل، أي كلام مكتوب عليه حرفيًا",
     "first_t": 0.0, "last_t": 2.0, "box": [0.1, 0.2, 0.3, 0.4],
     "actions": [{"t0": 0.4, "t1": 1.1, "action": "appear | disappear | move | click | drag | drop | type | scale | rotate | highlight | transform | speak | gesture | other",
                  "from": [0.5, 0.5], "to": [0.05, 0.4], "detail": "وصف الحركة (السرعة، الـ easing، مع مين)", "sfx": "id الصوت المربوط لو فيه"}]}
  ]
}"""


def elements_messages(shot: dict, frames: list[dict], sfx: list[dict], speech: list[dict]) -> list[dict]:
    """frames فيها data_url لكل فريم ووقته. الأوقات كلها بالثواني من أول الفيديو."""
    sounds = "\n".join(f"- id={x['id']} t={x['t']:.2f} {x.get('label', '')} ({x.get('category', '')})" for x in sfx) or "—"
    said = "\n".join(f"- {s['start']:.2f}–{s['end']:.2f}: {s.get('text', '')}" for s in speech) or "—"
    text = (
        "أنت موشن ديزاينر ومحلل فيديو. دي فريمات لقطة واحدة من فيديو بالترتيب، وكل فريم مكتوب وقته بالثانية.\n"
        f"اللقطة رقم {shot['n']} من {shot['start']:.2f} لـ {shot['end']:.2f} ثانية.\n"
        "فكك اللقطة لعناصرها: الخلفية، وكل عنصر لوحده (شخصيات، مؤشر ماوس، أيقونات، ملفات، فولدرات، نوافذ، زراير، كلام مكتوب، "
        "لوجوهات، صور، أشكال، افيكتس). لكل عنصر: اسمه وشكله بالتفصيل، مكانه (box = [x, y, w, h] كنسبة من الشاشة)، "
        "وكل حاجة بيعملها بتوقيتها بالظبط: بيظهر/بيختفي/بيتحرك من فين لفين (from/to = [x, y] كنسب)/بيدوس/بيسحب/بيكتب...\n"
        "اربط كل حركة بالصوت اللي حصل معاها لو فيه (اكتب id الصوت من القايمة).\n"
        f"الأصوات اللي في اللقطة دي:\n{sounds}\nالكلام اللي بيتقال:\n{said}\n\n"
        "motion_graphics = true لو اللقطة فيها موشن جرافيك أو افيكتس ينفع تتاخد كأصل: جرافيك متحرك، كلام متحرك، انتقالات، "
        "واجهة تطبيق أو شاشة بتتحرك، حركة ماوس، أيقونات وأشكال بتتحرك، افيكتس. و false لو هي تصوير عادي (شخص بيتكلم، "
        "منتج، مكان) والجرافيك فيها مش موجود أو مجرد ترجمة/كلام ثابت ملوش قيمة كأصل.\n"
        "متخترعش عناصر مش باينة. الأسماء والأوصاف بالعربي المصري البسيط. رجّع JSON بس بالشكل ده:\n" + ELEMENTS_FORMAT
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
    {"name": "اسم قصير واضح (مثلًا: ماوس بيسحب ملفات لسلة المهملات)",
     "category": "motion_graphics | effect | transition | text | screen | cursor | other",
     "t0": 1.20, "t1": 3.80,
     "elements": ["s1e1", "s1e2"],
     "description": "إيه اللي بيحصل فيه بالظبط (الحركة والإيقاع والشكل)",
     "use": "ينفع يتستخدم في إيه في فيديو تاني",
     "tags": ["ماوس", "سحب"],
     "controls": [
       {"label": "لون المؤشر", "type": "color", "target": "مؤشر ماوس أخضر", "value": "#3CFF6B"},
       {"label": "اسم الملف الأول", "type": "text", "target": "ملف صورة: علي", "value": "علي"},
       {"label": "الملفات بتترمي فين", "type": "choice", "target": "سلة المهملات", "value": "سلة المهملات", "options": ["سلة المهملات", "فولدر"]}
     ]}
  ]
}"""


def components_messages(d: dict, rejected: list[dict]) -> list[dict]:
    """من التفكيك (اللقطات وعناصرها وحركاتها بتوقيتها) لكومبوننتس جاهزة تتحفظ في المكتبة."""
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
    bad = "\n".join(f"- «{r.get('name')}» ({r.get('t0')}–{r.get('t1')}): {r.get('note') or 'من غير سبب'}" for r in rejected[:30])
    text = (
        "أنت موشن ديزاينر بتبني مكتبة أصول (assets) من فيديوهات حقيقية: موشن جرافيك، افيكتس، انتقالات، كلام متحرك، "
        "تسجيلات شاشة، حركات ماوس... كل أصل = مقطع من الفيديو زي ما هو بحركته وخلفيته وصوته، وبعدين أي عميل يقدر "
        "يغيّر فيه حاجات (ألوان، كلام، أسامي، وجهة حركة، سرعة) والحركة تفضل زي ما هي.\n"
        f"ده تفكيك فيديو مدته {d['source']['duration']:.2f} ثانية (الأوقات بالثانية من أول الفيديو):\n" + "\n".join(lines) + "\n\n"
        "طلّع منه الكومبوننتس اللي تستاهل تتحفظ وتتعاد:\n"
        "- كل كومبوننت حتة واحدة مكتملة ليها بداية ونهاية واضحة (حركة كاملة، افيكت كامل، انتقال كامل). "
        "سيب هامش صغير قبلها وبعدها (حوالي 0.15 ثانية) من غير ما تدخل في حاجة تانية.\n"
        "- ممكن يعدّي القطع بين لقطتين لو هو انتقال أو حركة مستمرة. ومفيش حد أدنى ولا أقصى للمدة: خليه زي ما هو في الفيديو.\n"
        + ("- اللقطات هنا متقسمة على كل تغيير في الحركة (🔀 = تغيير جوه نفس المشهد من غير قطع)، فكل لقطة غالبًا كومبوننت لوحده: "
           "خلّي t0 و t1 هما حدود اللقطة بالظبط، ومتجمعش لقطتين إلا لو هي نفس الحركة مكملة.\n" if fine else "")
        +
        "- موشن جرافيك وافيكتس بس: جرافيك متحرك، كلام متحرك، انتقالات، واجهات وشاشات بتتحرك، حركات ماوس، افيكتس. "
        "متطلعش شخصيات ولا تصوير عادي لناس أو منتجات أو أماكن ولا خلفيات لوحدها، حتى لو باينة في الفيديو.\n"
        "- متكررش نفس الحتة، ومتطلعش حاجات عادية ملهاش قيمة كأصل (لقطة واقفة من غير حركة مثلًا).\n"
        "- elements = ids العناصر اللي جواه من القايمة.\n"
        "- controls = الحاجات اللي العميل هيحب يغيّرها فيه، بقيمتها الحالية زي ما هي في الفيديو بالظبط "
        "(الكلام المكتوب حرفيًا، اللون بالـ hex). type: text للكلام والأسامي، color للألوان، choice لما يبقى فيه اختيارات، "
        "number للأرقام. target = اسم العنصر اللي بيتغيّر. من 1 لـ 6 مفاتيح.\n"
        + (f"\nاقتراحات اترفضت قبل كده وسبب الرفض (اتعلم منها ومتكررهاش):\n{bad}\n" if bad else "")
        + "\nالأسامي والأوصاف بالعربي المصري البسيط. رجّع JSON بس بالشكل ده:\n" + COMPONENTS_FORMAT
    )
    return [{"role": "user", "content": text}]


def snap_to(t: float, bounds: list[float], within: float = 0.3) -> float:
    """حدود الكومبوننت على حدود اللقطات لو قريبة منها (عشان كل حتة تبقى كاملة)."""
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
        comps.append({"name": f"تجربة: ماوس بيسحب ملف (لقطة {s['n']})", "category": "cursor", "t0": s["start"], "t1": s["end"],
                      "elements": [e["id"] for e in els], "description": "المؤشر بيتحرك وبيسحب الملف للسلة", "use": "شرح ميزة في تطبيق",
                      "tags": ["ماوس", "سحب"],
                      "controls": [{"label": "لون المؤشر", "type": "color", "target": els[0]["name"], "value": "#3CFF6B"},
                                   {"label": "اسم الملف", "type": "text", "target": els[-1]["name"], "value": "علي"},
                                   {"label": "الملف بيروح فين", "type": "choice", "target": "السلة", "value": "سلة المهملات",
                                    "options": ["سلة المهملات", "فولدر"]}]})
    return {"components": comps}


# ------------------------------------------------------------ تجارب من غير Atlas

def mock_audio(duration: float, marks: list[dict]) -> dict:
    sfx = [{"t": m["t"], "dur": 0.2, "label": "كليك تجريبي", "category": "click", "what": "تجربة"} for m in marks[:6]]
    return {"music": [{"start": 0.0, "end": round(duration, 2), "description": "بيت إلكتروني خفيف", "mood": "حماسي"}],
            "speech": [{"start": 0.3, "end": min(duration, 1.8), "speaker": "راوي", "text": "كلام تجريبي"}], "sfx": sfx}


def mock_elements(shot: dict, sfx: list[dict]) -> dict:
    s, e = shot["start"], shot["end"]
    if shot["n"] % 2 == 0:
        return {"scene_type": "live_action", "summary": "تجربة: شخص بيتكلم قدام الكاميرا", "motion_graphics": False,
                "mg_reason": "تصوير عادي من غير جرافيك", "background": {"name": "كافيه", "description": "تجربة"},
                "elements": [{"id": "e1", "name": "شخص", "type": "character", "description": "راجل قاعد", "first_t": s, "last_t": e,
                              "actions": [{"t0": s, "t1": e, "action": "speak", "detail": "بيتكلم"}]}]}
    return {"scene_type": "screen_recording", "summary": "تجربة: ماوس بيسحب ملف", "motion_graphics": True,
            "background": {"name": "سطح مكتب", "description": "خلفية زرقا فاتحة"},
            "elements": [{"id": "e1", "name": "مؤشر ماوس أخضر", "type": "cursor", "description": "سهم أخضر", "first_t": s, "last_t": e,
                          "box": [0.45, 0.45, 0.05, 0.05],
                          "actions": [{"t0": s, "t1": (s + e) / 2, "action": "move", "from": [0.5, 0.5], "to": [0.05, 0.4],
                                       "detail": "حركة سريعة", "sfx": sfx[0]["id"] if sfx else None}]},
                         {"id": "e2", "name": "ملف صورة: علي", "type": "file", "description": "أيقونة صورة", "first_t": s, "last_t": e,
                          "box": [0.03, 0.38, 0.08, 0.1], "actions": [{"t0": (s + e) / 2, "t1": e, "action": "drag", "from": [0.05, 0.4],
                                                                       "to": [0.92, 0.8], "detail": "بيتسحب للسلة"}]}]}


def to_json(d: dict) -> str:
    return json.dumps(d, ensure_ascii=False)


# ------------------------------------------------------------ ✏️ التعديل جوه المشهد (الحركة زي ما هي)

VEDIT_MODELS = {
    "gemini": {"model": "google/gemini-omni-1.1-flash/video-edit", "label": "Gemini Omni 1.1 (الأدق في الحفاظ على الحركة)", "per_sec": 0.107},
    "flux": {"model": "black-forest-labs/flux-3/edit-video", "label": "FLUX 3 (أرخص، بيغيّر التوقيت أحيانًا)", "per_sec": 0.03},
    "kling": {"model": "kwaivgi/kling-video-o3-std/video-edit", "label": "Kling O3 (ضعيف في الكلام العربي)", "per_sec": 0.107},
}

VEDIT_FORMAT = """{"prompt": "the full English edit instruction"}"""


def vedit_messages(shot: dict, instruction: str) -> list[dict]:
    """يحوّل طلبك (بالعربي ومذكور فيه أسامي العناصر) لتعليمات إنجليزي دقيقة لموديل تعديل الفيديو."""
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
    """⏩ يسرّع أو يبطّأ جزء من اللقطة بس (من t0 لـ t1) والباقي زي ما هو. factor > 1 = أسرع."""
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
