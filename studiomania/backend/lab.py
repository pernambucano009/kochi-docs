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


# ------------------------------------------------------------ 🔗 الكونيكتورز: تحوّل بيحكي بيودّي من مشهد لمشهد من غير قطع

CONNECTOR_FAMILIES = {
    "zoom_through": "🔍 زووم جوه حاجة (العنصر بيبقى العالم الجديد)",
    "background_swap": "🖼️ تبديل الخلفية (اللي قدام ثابت)",
    "anchor_carry": "📌 مرساة ماشية (ماوس / كاركتر / عنصر بينقلنا)",
    "scatter": "✨ تبعثر أو تساقط (العناصر بتقع أو بتتفرق)",
    "material_shift": "🧱 تغيير الخامة (رقمي ← ورق، شاشة ← حقيقي...)",
    "reveal_pullback": "🔭 كشف بالزووم أوت (نبعد فنكتشف أكبر)",
    "morph": "🫧 تحوّل شكل لشكل",
    "ui_to_world": "📱 من الشاشة للعالم الحقيقي (أو العكس)",
    "other": "تاني / جديد",
}

CONNECTORS_FORMAT = """{
  "connectors": [
    {"name": "اسم قصير للكونيكتور (مثلًا: زرار Enter بيفتح خريطة إسبانيا)",
     "family": "zoom_through | background_swap | anchor_carry | scatter | material_shift | reveal_pullback | morph | ui_to_world | other",
     "t0": 3.20, "t1": 5.10,
     "from_scene": "المشهد قبله بيحكي إيه",
     "to_scene": "المشهد بعده بيحكي إيه",
     "trigger": "الشرارة اللي بتبدأ التحوّل (ضغطة، كلمة، حركة...) وإمتى",
     "anchors": ["اللي بيفضل ثابت والعين ماسكاه طول التحوّل (الكلام المكتوب، الماوس...)"],
     "transforms": [{"t0": 3.4, "t1": 4.0, "from": "إطار مربع المحادثة", "to": "بيختفي والكلام يفضل", "how": "fade للإطار بس، ease-out"}],
     "camera": "حركة الكاميرا الافتراضية (زووم إن ناعم على...، زووم أوت، بان...) بالسرعة والـ easing",
     "rhythm": "الإيقاع: كل خطوة واخدة قد إيه، فيه وقفات؟ متزامن مع صوت؟",
     "recipe": ["الوصفة عامة من غير تفاصيل القصة دي عشان تتطبق على أي مشهدين: خطوة ١ ...", "خطوة ٢ ..."],
     "story_role": "التحوّل ده بيخدم القصة إزاي (ليه أحسن من قطع عادي)",
     "sound": "الصوت المصاحب لو فيه"}
  ]
}"""


def connectors_messages(d: dict, rejected: list[dict] | None = None) -> list[dict]:
    """الموديل بيتفرج على الفيديو كله ويطلّع كل لحظة القصة فيها بتتحوّل لمشهد تاني من غير قطع، بوصفتها."""
    lines = []
    for s in d.get("shots") or []:
        an = s.get("analysis") or {}
        els = "، ".join(e["name"] for e in (an.get("elements") or [])[:12])
        lines.append(f"- لقطة {s['n']} ({s['start']:.2f}–{s['end']:.2f}): {an.get('summary', '')}" + (f" | عناصر: {els}" if els else ""))
    fams = "\n".join(f"- {k}: {v}" for k, v in CONNECTOR_FAMILIES.items())
    text = (
        "أنت مخرج موشن جرافيك ومونتير محترف. اتفرج على الفيديو ده كله بالصوت.\n"
        "بنجمع «كونيكتورز»: مش ترانزيشن عادي (فيد، زحلقة، تصغير بين آخر فريم وأول فريم)، لكن تحوّل بيحكي جوه القصة نفسها: "
        "المشهد بيتحوّل للمشهد اللي بعده قدام عين المشاهد من غير قطع. مثلًا: الماوس بيدوس Enter ← زووم ناعم على مربع "
        "المحادثة ← إطاره بيختفي والكلام يفضل ← الزرار يتلوّن إنه اتداس ← الخلفية تتحوّل لخريطة عليها فنادق بتقييماتها ← "
        "الماوس يدوس على فندق ← الفنادق التانية تقع زي حبات الخرز ← الخريطة تبقى ورق ← زووم أوت نلاقي الكاركتر ماسكها وهو سايق.\n"
        "كل حتة من دول ممكن تبقى كونيكتور لوحده لو ليها شرارة ونتيجة واضحة، أو كونيكتور واحد طويل لو هي حركة واحدة متصلة.\n\n"
        f"الفيديو مدته {d['source']['duration']:.2f} ثانية. التقطيع والعناصر اللي اتعرفت (للمساعدة، الفيديو هو المرجع):\n"
        + "\n".join(lines) + "\n\n"
        "طلّع كل الكونيكتورز اللي في الفيديو بالتوقيت الدقيق (t0 أول ما التحوّل يبدأ، t1 لما المشهد الجديد يستقر). لكل واحد:\n"
        "- الشرارة، واللي بيفضل ثابت (المرساة)، وكل تحوّل (إيه بيتحول لإيه، إمتى، وإزاي بالظبط: الحركة والـ easing)، "
        "وحركة الكاميرا، والإيقاع، والصوت.\n"
        "- recipe = وصفة عامة بخطوات مرقمة تنفع تتطبق على أي مشهدين تانيين (من غير أسامي المنتج أو المكان اللي في الفيديو ده).\n"
        f"- family واحدة من دول:\n{fams}\n"
        "- القطع العادي والترانزيشن البدائي (فيد بين مشهدين مالهمش علاقة ببعض) مش كونيكتور: متطلّعهوش.\n"
        "- لو الفيديو مفيهوش كونيكتورز رجّع قايمة فاضية. متخترعش.\n"
        + ("اقتراحات اترفضت قبل كده وسبب الرفض (اتعلم منها):\n"
           + "\n".join(f"- «{r.get('name')}» ({r.get('t0')}–{r.get('t1')}): {r.get('note') or 'من غير سبب'}" for r in rejected[:30]) + "\n"
           if rejected else "")
        +
        "الكلام بالعربي المصري البسيط. رجّع JSON بس بالشكل ده:\n" + CONNECTORS_FORMAT
    )
    return [{"role": "user", "content": text}]


CONNECTOR_KEYS = ("name", "family", "t0", "t1", "from_scene", "to_scene", "trigger", "anchors", "transforms", "camera",
                  "rhythm", "recipe", "story_role", "sound")


def connector_refine_messages(c: dict, note: str, clip_start: float, history: list[dict]) -> list[dict]:
    """💬 المستخدم بيقول للشرح «عدّل كذا»: الموديل بيتفرج على الحتة تاني (ومعاها شوية قبلها وبعدها) ويعدّل الشرح."""
    cur = {k: c.get(k) for k in CONNECTOR_KEYS}
    rel = json.loads(json.dumps(cur))   # الأوقات من أول المقطع المبعوت
    for k in ("t0", "t1"):
        rel[k] = round(float(rel[k]) - clip_start, 2)
    for x in rel.get("transforms") or []:
        x["t0"], x["t1"] = round(x["t0"] - clip_start, 2), round(x["t1"] - clip_start, 2)
    past = "\n".join(f"- {h['role']}: {h['text']}" for h in history[-8:])
    text = (
        "أنت مخرج موشن جرافيك. ده مقطع من فيديو فيه «كونيكتور»: تحوّل بيحكي بيودّي من مشهد لمشهد من غير قطع. "
        "المقطع فيه شوية قبل الكونيكتور وشوية بعده عشان تشوف الصورة كاملة، والأوقات كلها بالثواني من أول المقطع ده.\n"
        f"ده الشرح الحالي:\n{json.dumps(rel, ensure_ascii=False, indent=1)}\n\n"
        + (f"كلام قبل كده عن نفس الكونيكتور:\n{past}\n\n" if past else "")
        + f"المستخدم شايف إن الشرح محتاج يتعدّل وبيقولك:\n«{note}»\n\n"
        "اتفرج على المقطع تاني بدقة، ونفّذ طلبه، وصحّح أي حاجة تانية غلط تشوفها. لو طلب تغيير البداية أو النهاية غيّر t0 و t1. "
        "الوصفة (recipe) تفضل عامة تنفع لأي مشهدين. family واحدة من: " + ", ".join(CONNECTOR_FAMILIES) + ".\n"
        "بالعربي المصري البسيط. رجّع JSON بس: {\"reply\": \"رد قصير ليه عملت كده\", \"connector\": {نفس شكل الشرح الحالي بالظبط}}"
    )
    return [{"role": "user", "content": text}]


def apply_refine(c: dict, data: dict, clip_start: float, duration: float) -> dict:
    """الشرح المعدّل بأوقات الفيديو الأصلي (والحاجات الإدارية زي التقييم والفريمات بتفضل)."""
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
        "name": "تجربة: زرار بيفتح خريطة", "family": "background_swap", "t0": a, "t1": b,
        "from_scene": "حد بيكتب سؤال لموديل ذكاء اصطناعي", "to_scene": "خريطة عليها فنادق",
        "trigger": "الماوس بيدوس Enter", "anchors": ["الكلام المكتوب", "مؤشر الماوس"],
        "transforms": [{"t0": a, "t1": a + 0.4, "from": "إطار المربع", "to": "بيختفي", "how": "fade للإطار بس"},
                       {"t0": a + 0.4, "t1": b, "from": "الخلفية", "to": "خريطة", "how": "تتلوّن من النص لبرة"}],
        "camera": "زووم إن ناعم 8% ease-in-out", "rhythm": "سريع وبعدين وقفة نص ثانية", "sound": "ووش خفيف",
        "recipe": ["الضغطة على زرار بتعمل زووم إن ناعم على العنصر", "إطار العنصر بيختفي والمحتوى بيفضل",
                   "الخلفية بتتحول للعالم اللي المحتوى بيتكلم عنه"],
        "story_role": "بيوري نتيجة الطلب في نفس اللحظة من غير قطع"}]}


# ------------------------------------------------------------ 🧪 تجربة كونيكتور: نطبّق الوصفة بين لقطتين

TRIAL_FORMAT = """{
  "adapted": "الوصفة هتتنفذ بين اللقطتين دول إزاي (بالعربي، خطوات قصيرة مرقمة)",
  "anchors": ["اللي هيفضل ثابت والعين ماسكاه بين اللقطتين دول"],
  "keyframes": [{"label": "اسم المرحلة بالعربي (مثلًا: الإطار اتشال والخلفية بقت خريطة)",
                 "prompt": "English image-edit instruction. IMAGE 1 is the current frame, IMAGE 2 is the final frame we are heading to. Describe exactly the in-between state to draw from IMAGE 1: what stays identical (layout, text, cursor...), what has changed and how far along the transformation is"}],
  "segments": [{"label": "الحركة دي بالعربي",
                "prompt": "English prompt for a start-frame/end-frame video model: one continuous shot with no cut, the exact motion from the start frame to the end frame (camera move, what transforms into what and in which order, easing), keep everything else steady",
                "seconds": 2.0}]
}"""


def trial_plan_messages(recipe: dict, mode: str, a_label: str, b_label: str, max_keys: int = 2) -> str:
    """نص الطلب. الصور بتتحط بعده بالترتيب: 1 = آخر فريم في A، 2 = أول فريم في B، وبعدهم فريمات الكونيكتور المرجعي."""
    r = {k: recipe.get(k) for k in ("family", "trigger", "anchors", "transforms", "camera", "rhythm", "recipe", "story_role", "sound")}
    goal = ("🔁 تجربة إعادة بناء: A وB هما نفس النقطتين اللي الكونيكتور الأصلي بينهم في الفيديو. المطلوب نعيد عمله بأقرب شكل للأصلي."
            if mode == "rebuild" else
            "🔀 تجربة نقل: A وB لقطتين مختلفين عن الكونيكتور الأصلي. المطلوب نطبّق نفس الفكرة والإحساس على قصة اللقطتين دول.")
    return (
        "أنت مخرج موشن جرافيك. عندنا «كونيكتور»: تحوّل بيحكي بيودّي من مشهد لمشهد من غير قطع، ومعاه وصفته.\n"
        f"{goal}\n\n"
        f"وصفة الكونيكتور:\n{json.dumps(r, ensure_ascii=False, indent=1)}\n\n"
        f"اللقطة A: {a_label}\nاللقطة B: {b_label}\n\n"
        "الصور بالترتيب: الصورة 1 = آخر فريم في A (البداية). الصورة 2 = أول فريم في B (النهاية). "
        "والصور اللي بعدهم = فريمات الكونيكتور المرجعي (البداية والنص والنهاية) عشان تشوف الشكل والإحساس.\n\n"
        "هنفّذها كده: صور مفتاحية للمراحل اللي في النص (بموديل تعديل صور بياخد الصورة اللي قبلها)، وبعدين موديل فيديو "
        "بياخد صورة بداية وصورة نهاية ويعمل الحركة بينهم. الحتت بالترتيب: الصورة 1 ← المراحل ← الصورة 2.\n"
        f"- keyframes من 0 لـ {max_keys} (المراحل اللي لازم تتحدد عشان التحوّل يمشي صح؛ لو التحوّل بسيط خليها 0 أو 1).\n"
        "- segments = عدد keyframes + 1 بالظبط، كل واحدة الحركة من الصورة اللي قبلها للي بعدها.\n"
        "- seconds = الطول اللي الحتة المفروض تاخده في الفيديو النهائي (حسب إيقاع الكونيكتور الأصلي)، من 0.6 لـ 6.\n"
        "- البرومبتات بالإنجليزي ودقيقة: الكلام المكتوب على الشاشة يفضل زي ما هو بالظبط، ومفيش قطع.\n"
        "رجّع JSON بس بالشكل ده:\n" + TRIAL_FORMAT
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
    return {"adapted": "١. زووم ناعم على العنصر اللي اتداس\n٢. الخلفية تتحول للمشهد الجديد", "anchors": ["الكلام المكتوب"],
            "keyframes": [{"label": "النص: الخلفية بتتحول", "prompt": "Halfway state: background morphing into the next scene."}],
            "segments": [{"label": "زووم وبداية التحوّل", "prompt": "Slow zoom in, background starts morphing.", "seconds": 1.5},
                         {"label": "التحوّل بيكمل", "prompt": "Background finishes morphing into the final frame.", "seconds": 1.5}]}


# ------------------------------------------------------------ 🎞️ فيديو مبني على الكونيكتورز

FILM_FORMAT = """{
  "title": "اسم الفيديو",
  "idea": "الفكرة في سطرين: القصة اللي بتربط المشاهد والكونيكتورز",
  "scenes": [{"label": "اسم المشهد بالعربي", "feature": "الميزة اللي المشهد بيعرضها",
              "voice": "جملة الفويس أوفر اللي بتتقال على المشهد ده (بلغة ولهجة العميل، طبيعية ومتسلسلة مع اللي قبلها، تتقال في وقت المشهد والكونيكتور اللي بعده)",
              "text": "الكلام المكتوب على الشاشة في المشهد ده (قصير، بلغة ولهجة العميل) أو فاضي",
              "screen": "اسم شاشة / لوجو / صورة منتج من ملف العميل لو المشهد محتاجها بالظبط، أو فاضي",
              "start": "English image prompt for the FIRST frame of the scene (composition, subject, UI, background, colors, the on-screen text in quotes)",
              "end": "English image-edit instruction from the first frame to the LAST frame of the scene: what moved or appeared, and how it is set up so the next connector can start (keep the same style and text)",
              "motion": "English prompt for a start-frame/end-frame video model: the continuous motion inside the scene, no cut",
              "seconds": 3}],
  "links": [{"asset": "id الكونيكتور من القايمة", "why": "ليه الكونيكتور ده بالذات بين المشهدين دول وإزاي بيكمّل القصة"}]
}"""


def film_plan_messages(brain_txt: str, brief: str, conns: list[dict], n_scenes: int) -> str:
    """نص طلب السيناريو. بعده بتيجي فريمات كل كونيكتور مرجعي بالترتيب اللي في القايمة."""
    rows = []
    for c in conns:
        r = c.get("connector") or {}
        rows.append({"id": c["id"], "name": c.get("name"), **{k: r.get(k) for k in (
            "family", "from_scene", "to_scene", "trigger", "anchors", "transforms", "camera", "rhythm", "recipe", "story_role")}})
    return (
        "أنت مخرج إعلانات موشن جرافيك. هنعمل فيديو قصير مبني على «كونيكتورز»: تحوّلات بتحكي وبتودّي من مشهد لمشهد من غير قطع. "
        "الكونيكتورز دي اتطلعت من فيديوهات حقيقية ومعاها وصفتها. المطلوب سيناريو المشاهد يتكتب على مقاس الكونيكتورز: "
        "كل مشهد لازم يخلص في وضع يخلي شرارة الكونيكتور اللي بعده تحصل طبيعي، والمشهد اللي بعده يبدأ مكان ما الكونيكتور بيوصل.\n\n"
        f"ملف العميل:\n{brain_txt or '(مفيش)'}\n\n"
        f"المطلوب من الفيديو: {brief or 'فيديو قصير بيعرض أهم مميزات المنتج'}\n\n"
        f"الكونيكتورز المتاحة (استخدم كل واحد مرة على الأقل لو ينفع، بالترتيب اللي يخدم القصة):\n{json.dumps(rows, ensure_ascii=False, indent=1)}\n\n"
        "الصور اللي بعد الكلام ده = فريمات الكونيكتورز المرجعية بنفس ترتيب القايمة (البداية والنص والنهاية لكل واحد).\n\n"
        f"- عدد المشاهد {n_scenes}، وعدد links = عدد المشاهد - 1 بالظبط (link رقم 1 بين المشهد 1 و2 وهكذا).\n"
        "- كل مشهد بيعرض ميزة واحدة واضحة. أول مشهد هوك قوي، وآخر مشهد فيه اسم/لوجو البراند وجملة تحفيز.\n"
        "- الكلام على الشاشة قصير جدًا (٣-٧ كلمات) ومكتوب صح بلغة ولهجة العميل.\n"
        "- لو المشهد فيه شاشة التطبيق أو اللوجو الحقيقي اكتب اسمه في screen بالظبط زي ما هو في ملف العميل.\n"
        "- البرومبتات بالإنجليزي، والكلام اللي هيتكتب على الشاشة يتحط بين علامات تنصيص زي ما هو بالعربي.\n"
        "- الفويس أوفر: جملة واحدة قصيرة لكل مشهد (٥-١٢ كلمة)، والجمل مع بعض بتحكي قصة واحدة متصلة، والكلام اللي على الشاشة "
        "مش لازم يكرر الفويس بالحرف.\n"
        "- seconds للمشهد من 2 لـ 5.\n"
        "رجّع JSON بس بالشكل ده:\n" + FILM_FORMAT
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
    feats = ["الهوك", "ميزة أولى", "ميزة تانية", "ميزة تالتة", "ميزة رابعة", "ميزة خامسة", "ميزة سادسة", "الختام"]
    scenes = [{"label": f"مشهد {i + 1}", "feature": feats[min(i, len(feats) - 1)], "text": f"{brand} {i + 1}", "screen": "",
               "voice": f"دي الجملة رقم {i + 1} في الفويس أوفر",
               "start": f"Scene {i + 1} first frame.", "end": "Element moves to the center.", "motion": "Slow push in.", "seconds": 3}
              for i in range(n_scenes)]
    links = [{"asset": conns[i % len(conns)]["id"], "why": "تجربة"} for i in range(n_scenes - 1)] if conns else []
    return {"title": f"مميزات {brand}", "idea": "فيديو تجريبي", "scenes": scenes, "links": links}


SCRIPT_APPLY_FORMAT = """{"scenes": [{"i": "رقم المشهد زي ما هو", "action": "none أو text أو redraw",
  "why": "ليه (بالعربي، سطر)",
  "start": "English prompt جديد لأول المشهد (لو redraw بس)", "end": "English prompt جديد لآخر المشهد (لو redraw بس)",
  "motion": "English motion prompt جديد (لو redraw بس)"}]}"""


def film_script_apply_messages(plan: dict, changed: list[dict]) -> str:
    """السكريبت اتعدّل: لكل مشهد اتغير، الموديل بيقرر الفريمات تتعدّل إزاي."""
    scenes = [{"i": i, "label": s["label"], "voice": s.get("voice", ""), "text": s.get("text", "")} for i, s in enumerate(plan["scenes"])]
    return (
        "أنت مخرج موشن جرافيك. عندنا فيديو اترسمت فريماته، والمستخدم عدّل في السكريبت (الفويس أوفر والكلام اللي على الشاشة). "
        "المطلوب لكل مشهد اتغير تقرر الفريمات بتاعته تتعدّل إزاي:\n"
        "- none: التغيير مش محتاج يتشاف في الصورة (مثلًا الفويس اتظبطت صياغته بس والمعنى زي ما هو، والكلام اللي على الشاشة ما اتغيرش).\n"
        "- text: الصورة زي ما هي، بس الكلام المكتوب على الشاشة يتبدل بالجديد.\n"
        "- redraw: معنى المشهد اتغير (ميزة تانية، حاجة تانية لازم تظهر) والفريمات لازم تترسم من جديد: اكتب start وend وmotion جداد "
        "بنفس أسلوب القديمة، ومن غير ما تبوّظ علاقة آخر المشهد بالكونيكتور اللي بعده وأوله بالكونيكتور اللي قبله.\n\n"
        f"فكرة الفيديو: {plan.get('idea', '')}\n\nالسكريبت كله دلوقتي:\n{json.dumps(scenes, ensure_ascii=False, indent=1)}\n\n"
        f"المشاهد اللي اتغيرت (القديم والجديد والبرومبتات الحالية):\n{json.dumps(changed, ensure_ascii=False, indent=1)}\n\n"
        "رجّع JSON بس بالشكل ده، لكل مشهد اتغير:\n" + SCRIPT_APPLY_FORMAT
    )


SCRIPT_REWRITE_FORMAT = """{"scenes": [{"i": "رقم المشهد", "voice": "جملة الفويس أوفر الجديدة", "text": "الكلام الجديد على الشاشة"}]}"""


def film_script_rewrite_messages(brain_txt: str, plan: dict, instruction: str) -> str:
    scenes = [{"i": i, "feature": s.get("feature", ""), "voice": s.get("voice", ""), "text": s.get("text", "")}
              for i, s in enumerate(plan["scenes"])]
    return (
        "أنت كاتب إعلانات. ده سكريبت فيديو قصير (لكل مشهد: جملة فويس أوفر وكلام مكتوب على الشاشة). "
        "عدّله حسب طلب المستخدم وبس، والمشاهد اللي الطلب مش بيخصها سيبها زي ما هي بالحرف. "
        "خلي اللغة واللهجة زي ملف العميل، وعدد المشاهد زي ما هو.\n\n"
        f"ملف العميل:\n{brain_txt or '(مفيش)'}\n\nالسكريبت:\n{json.dumps(scenes, ensure_ascii=False, indent=1)}\n\n"
        f"طلب المستخدم: {instruction}\n\nرجّع JSON بس بالشكل ده (كل المشاهد):\n" + SCRIPT_REWRITE_FORMAT
    )


# ------------------------------------------------------------ 🗺️ مخطط الفيديو (تيمبليت كامل)

SCHEMA_ROLES = {"hook": "🪝 هوك", "problem": "😣 مشكلة", "feature": "✨ ميزة", "proof": "📈 دليل", "cta": "👉 دعوة", "other": "• تاني"}

SCHEMA_FORMAT = """{
  "title": "اسم قصير للأسلوب ده (بالعربي)",
  "summary": "الفيديو ده ماشي إزاي في سطرين (بالعربي)",
  "beat_sec": 0.5,
  "style": "English: the single visual world of the whole video (render style, materials, lighting, background, depth, typography look) so it can be recreated",
  "palette": "English: main colors",
  "spine": "English: the element(s) that stay on screen and carry the eye through the whole video (or how continuity is kept)",
  "camera": "English: the overall camera language (always moving? push-ins? orbit? speed and easing)",
  "text_style": "English: how on-screen text looks and where it sits",
  "music": "نوع الموسيقى وإيقاعها (بالعربي)",
  "beats": [{"t0": 0.0, "t1": 1.5, "role": "hook | problem | feature | proof | cta | other",
             "what": "اللي بيحصل في الجزء ده بالعربي",
             "layout": "English: the composition of this beat with content SLOTS in brackets, e.g. [app screen] in a phone at center, [headline] top third",
             "slots": [{"kind": "screen | logo | headline | subtext | product | person | icon | other", "desc": "English: what goes there"}],
             "camera": "English: camera move inside this beat",
             "into_next": "English: exactly how this beat flows into the next one with no cut (what moves/morphs/zooms), or empty for the last",
             "keeps": "English: what stays identical going into the next beat",
             "sfx": "المؤثر الصوتي لو فيه"}]
}"""


def schema_messages(d: dict) -> list[dict]:
    """الموديل بيتفرج على الفيديو كله ويطلّع مخططه: الثوابت، والتايم لاين جزء جزء بالخانات اللي بتتملا بمحتوى أي عميل."""
    lines = [f"- لقطة {s['n']} ({s['start']:.2f}–{s['end']:.2f}): {(s.get('analysis') or {}).get('summary', '')}" for s in d.get("shots") or []]
    conns = [f"- {c['name']} ({c['t0']:.2f}–{c['t1']:.2f}): {c.get('trigger', '')}" for c in d.get("connectors") or []]
    text = (
        "أنت مخرج موشن جرافيك محترف. اتفرج على الفيديو ده كله بالصوت. الفيديو ده بيحس إنه قطعة واحدة متصلة، "
        "والمطلوب نطلّع «مخططه» عشان نعمل فيديوهات تانية لعملاء تانيين بنفس الإحساس بالظبط: نفس العالم، ونفس الإيقاع، "
        "ونفس حركة الكاميرا، ونفس طريقة انتقال كل جزء للي بعده من غير قطع.\n\n"
        f"الفيديو مدته {d['source']['duration']:.2f} ثانية.\n"
        + ("اللقطات اللي اتعرفت (للمساعدة، الفيديو هو المرجع):\n" + "\n".join(lines) + "\n" if lines else "")
        + ("الكونيكتورز اللي اتعرفت:\n" + "\n".join(conns) + "\n" if conns else "")
        + "\nقسّم الفيديو لأجزاء (beats) على الإيقاع: كل جزء ليه وظيفة في القصة ووضع واضح للشاشة (من 0.8 لـ 4 ثواني غالبًا). "
        "الأجزاء ورا بعض من غير فراغ (t1 بتاع جزء = t0 بتاع اللي بعده) وبتغطي الفيديو كله.\n"
        "- اكتب المحتوى كخانات عامة بين أقواس [ ] (مثلًا [app screen]، [headline]، [logo]) بدل اسم المنتج أو الكلام اللي في الفيديو ده، "
        "عشان التيمبليت ينفع لأي عميل.\n"
        "- into_next أهم حاجة: إزاي الجزء ده بيتحوّل للي بعده قدام العين من غير قطع (زووم جوه حاجة، عنصر بيكبر ويبقى الخلفية، الكاميرا بتلف...).\n"
        "- beat_sec = طول البيت في الموسيقى (لو مش واضح اكتب 0).\n"
        "رجّع JSON بس بالشكل ده:\n" + SCHEMA_FORMAT
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
    return {k: str(d.get(k) or "")[:1500] for k in ("title", "summary", "style", "palette", "spine", "camera", "text_style", "music")} | {
        "beat_sec": round(max(0.0, _f(d.get("beat_sec"))), 3), "beats": beats}


def mock_schema(d: dict) -> dict:
    dur = d["source"]["duration"]
    n = max(2, min(5, int(dur // 2)))
    step = dur / n
    roles = ["hook", "feature", "feature", "proof", "cta"]
    return {"title": "موبايل في النص والكاميرا ماشية", "summary": "موبايل ثابت في النص والكاميرا بتدخل جوه الشاشات", "beat_sec": 0.5,
            "style": "Clean 3D render, soft studio light, pastel background.", "palette": "teal, cream", "spine": "A phone at center.",
            "camera": "Always pushing in slowly.", "text_style": "Bold sans headline in the top third.", "music": "بيت خفيف",
            "beats": [{"t0": round(i * step, 2), "t1": round((i + 1) * step, 2), "role": roles[min(i, 4)], "what": f"جزء {i + 1}",
                       "layout": "[app screen] in a phone at center, [headline] top third", "slots": [{"kind": "screen", "desc": "app screen"}],
                       "camera": "slow push in", "into_next": "zoom into the screen until it becomes the background" if i < n - 1 else "",
                       "keeps": "the phone", "sfx": ""} for i in range(n)]}


TEXT_MODES = {"blank": "مساحات فاضية (الكلام العربي في المونتاج)", "en": "كلام إنجليزي جوه الصور"}

FILL_FORMAT = """{
  "title": "اسم الفيديو",
  "world": "English: ONE consistent world for the whole video (style, lighting, background, the spine element, the brand colors) repeated in every panel",
  "panels": [{"desc": "English: exactly what the frame looks like at this moment (composition per the template layout, which real brand asset fills which slot)", "asset": "اسم الأصل من ملف العميل اللي بيظهر هنا أو فاضي"}],
  "beats": [{"motion": "English prompt for a start-frame/end-frame video model: the continuous motion from this panel to the next one (camera move + the template's into_next), no cut",
             "text": "الكلام اللي على الشاشة في الجزء ده", "voice": "جملة فويس أوفر للجزء ده (بلغة ولهجة العميل) أو فاضي"}]
}"""


def fill_messages(brain_txt: str, schema: dict, brief: str, text_mode: str) -> str:
    n = len(schema["beats"])
    beats = [{k: b[k] for k in ("t0", "t1", "role", "what", "layout", "slots", "camera", "into_next", "keeps")} for b in schema["beats"]]
    glob = {k: schema.get(k) for k in ("style", "palette", "spine", "camera", "text_style")}
    text_rule = ("الكلام اللي على الشاشة بالإنجليزي (قصير جدًا، ٢-٥ كلمات) وهيترسم جوه الصور." if text_mode == "en" else
                 "الكلام اللي على الشاشة بلغة ولهجة العميل (قصير جدًا) ومش هيترسم في الصور: الصور بتسيب مكانه فاضي "
                 "(مساحة نضيفة في مكان خانة الكلام) وهيتضاف في المونتاج.")
    return (
        "أنت مخرج إعلانات موشن جرافيك. عندنا «تيمبليت» متطلّع من فيديو احترافي بيحس إنه قطعة واحدة. "
        "المطلوب تعمل فيديو جديد للعميل ده على نفس التيمبليت بالظبط: نفس عدد الأجزاء ونفس وظيفة كل جزء ونفس الكاميرا ونفس طريقة الانتقال، "
        "بس المحتوى (الخانات) بتتملا بمنتج العميل وأصوله الحقيقية.\n\n"
        f"ملف العميل:\n{brain_txt or '(مفيش)'}\n\nالمطلوب من الفيديو: {brief or 'فيديو بيعرض أهم مميزات المنتج'}\n\n"
        f"ثوابت التيمبليت:\n{json.dumps(glob, ensure_ascii=False, indent=1)}\n\nأجزاء التيمبليت:\n{json.dumps(beats, ensure_ascii=False, indent=1)}\n\n"
        f"- panels = {n + 1} لوحة بالظبط: لوحة رقم i هي شكل الشاشة في أول الجزء i، واللوحة الأخيرة شكلها في آخر الفيديو. "
        "يعني الجزء i بيتحرك من اللوحة i للوحة i+1، فاللوحتين لازم يكونوا نفس العالم ونفس العناصر، والفرق بينهم هو اللي بيعمله into_next.\n"
        f"- beats = {n} بالظبط بنفس الترتيب.\n"
        "- العالم واحد في كل اللوحات: نفس الخلفية والإضاءة والألوان، والعمود الفقري (spine) موجود ومتوصف بنفس الكلام في كل لوحة.\n"
        f"- {text_rule}\n"
        "- لو خانة فيها شاشة التطبيق أو اللوجو أو المنتج، اكتب اسمه في asset بالظبط زي ملف العميل.\n"
        "رجّع JSON بس بالشكل ده:\n" + FILL_FORMAT
    )


def clean_fill(data: dict, n: int) -> dict:
    d = data or {}
    panels = [{"desc": str(x.get("desc") or "")[:2000], "asset": str(x.get("asset") or "")[:120]}
              for x in d.get("panels") or [] if isinstance(x, dict)][:n + 1]
    while len(panels) < n + 1:
        panels.append({"desc": panels[-1]["desc"] if panels else "", "asset": ""})
    beats = [{"motion": str(x.get("motion") or "")[:1500], "text": str(x.get("text") or "")[:200], "voice": str(x.get("voice") or "")[:600]}
             for x in d.get("beats") or [] if isinstance(x, dict)][:n]
    while len(beats) < n:
        beats.append({"motion": "Smooth continuous camera move from the start frame to the end frame, no cut.", "text": "", "voice": ""})
    return {"title": str(d.get("title") or "")[:120], "world": str(d.get("world") or "")[:2000], "panels": panels, "beats": beats}


def mock_fill(schema: dict, brand: str) -> dict:
    n = len(schema["beats"])
    return {"title": f"{brand} على التيمبليت", "world": "Pastel 3D studio, a teal phone at center.",
            "panels": [{"desc": f"Panel {i + 1}: the phone at center showing screen {i + 1}.", "asset": ""} for i in range(n + 1)],
            "beats": [{"motion": "Slow push in.", "text": f"{brand} {i + 1}", "voice": f"جملة {i + 1}"} for i in range(n)]}


def sheet_grid(count: int) -> tuple[int, int]:
    """شبكة مربعة (2×2 أو 3×3): كده الشيت كله بنفس نسبة اللوحة الواحدة، فاللوحات بتطلع بالمقاس الصح."""
    k = 1 if count <= 1 else 2 if count <= 4 else 3
    return k, k


RATIO_WORDS = {"9:16": "tall vertical portrait (width:height = 9:16, like a phone screen)",
               "16:9": "wide horizontal landscape (width:height = 16:9)", "1:1": "square (1:1)"}


def sheet_prompt(schema: dict, fill: dict, cells: list[int], ratio: str, text_mode: str, texts: list[str],
                 refs: list[str], style_from_prev: bool) -> str:
    """برومبت شيت ستوري بورد واحد فيه اللوحات دي كلها، ينفع يتحط في ChatGPT زي ما هو."""
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
        f"IMAGE FORMAT: the whole image is {shape}.\n"
        f"One single image: a storyboard sheet, an exact grid of {rows} rows x {cols} columns of equal cells. EVERY cell is a {shape} frame "
        f"(never square, never cropped differently), all the same size, read left to right, top to bottom, separated by thin plain white "
        "gutters, no borders, no panel numbers, no captions.\n"
        + (f"There are {len(cells)} panels: fill the first {len(cells)} cells in reading order and leave the last {empty} cell(s) plain white.\n"
           if empty else "")
        + "All panels are frames of ONE continuous video shot in ONE world: identical style, lighting, background, colors, materials and the "
        "same recurring elements in every panel, so that consecutive panels look like moments of the same take.\n"
        f"WORLD: {fill.get('world') or schema.get('style')}\n"
        f"STYLE: {schema.get('style')}\nPALETTE: {schema.get('palette')}\nRECURRING ELEMENT: {schema.get('spine')}\n"
        + ("No text or letters anywhere except inside real brand assets.\n" if text_mode != "en" else
           f"TEXT STYLE: {schema.get('text_style')} Spell English text exactly as given.\n")
        + ("The previous storyboard sheet is attached: match its world and style exactly.\n" if style_from_prev else "")
        + "\n".join(lines) + ref_txt
    )


def _bands(white: list[float], n: int, parts: int, thr: float = 0.9) -> list[tuple[int, int]] | None:
    """حدود كل خانة على محور واحد من نسبة البكسلات البيضا في كل عمود/صف. None لو الفواصل مش واضحة."""
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


def sheet_cells(gray: bytes, w: int, h: int, rows: int, cols: int) -> tuple[list, list] | None:
    """الفواصل البيضا بين اللوحات (من صورة رمادي صغيرة). بيرجّع حدود الأعمدة والصفوف بالنسبة (0..1)، أو None."""
    if len(gray) < w * h:
        return None
    col_white = [sum(1 for y in range(h) if gray[y * w + x] > 228) / h for x in range(w)]
    row_white = [sum(1 for x in range(w) if gray[y * w + x] > 228) / w for y in range(h)]
    xs, ys = _bands(col_white, w, cols), _bands(row_white, h, rows)
    if not xs or not ys:
        return None
    return [(a / w, b / w) for a, b in xs], [(a / h, b / h) for a, b in ys]


def panel_redraw_prompt(schema: dict, fill: dict, j: int, ratio: str, text_mode: str, text: str, note: str, n_refs: int, n_style: int) -> str:
    """🎨 لوحة واحدة من الأول (لو اللي في الشيت باظت)، بنفس عالم اللوحات اللي جنبها."""
    return (f"A {RATIO_WORDS.get(ratio, ratio)} final frame (frame {j + 1} of {len(fill['panels'])}) of ONE continuous video shot.\n"
            f"WORLD: {fill.get('world') or schema.get('style')}\nSTYLE: {schema.get('style')}\nPALETTE: {schema.get('palette')}\n"
            f"RECURRING ELEMENT: {schema.get('spine')}\nTHIS FRAME: {fill['panels'][j]['desc']}"
            + (f'\nOn-screen text exactly: "{text}".' if text_mode == "en" and text else "\nNo text or letters except inside real brand assets.")
            + (f"\nAlso: {note}" if note else "")
            + "".join(f"\nIMAGE {i + 1} is a real brand asset: keep it exactly as it is wherever it appears." for i in range(n_refs))
            + "".join(f"\nIMAGE {n_refs + i + 1} is a neighbouring frame of the same shot: match its world, style, lighting and recurring elements exactly."
                      for i in range(n_style)))


def panel_sharpen_prompt(desc: str, text_mode: str, text: str, note: str = "") -> str:
    return ("IMAGE 1 is one panel cut out of a storyboard sheet. Redraw it as a full-resolution final frame in the output's exact aspect "
            "ratio (keep everything inside the frame, extend the background if needed instead of stretching): EXACTLY the same composition, "
            "camera angle, elements, colors, lighting and style, only sharper and fully detailed. Do not add or remove anything. "
            "Fill the whole frame (no gutters or borders)."
            + (f' On-screen text exactly: "{text}".' if text_mode == "en" and text else " No text or letters except inside real brand assets.")
            + (f"\nThe frame shows: {desc}" if desc else "")
            + (f"\nAlso: {note}" if note else "")
            + "\nOther attached images (if any) are the real brand assets: keep them exactly as they are.")


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
