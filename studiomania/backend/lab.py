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
        els.append({"id": f"s{shot['n']}e{i + 1}", "name": str(e["name"])[:80],
                    "type": e.get("type") if e.get("type") in ELEMENT_TYPES else "other",
                    "description": str(e.get("description") or "")[:600],
                    "first_t": round(num(e.get("first_t"), shot["start"]), 2), "last_t": round(num(e.get("last_t"), shot["end"]), 2),
                    "box": [round(min(1, max(0, num(v))), 3) for v in box] if box else None,
                    "actions": sorted(acts, key=lambda a: a["t0"]), "review": None})
    bg = (data or {}).get("background") or {}
    return {"scene_type": (data or {}).get("scene_type") if (data or {}).get("scene_type") in
            ("live_action", "screen_recording", "motion_graphics", "mixed") else "mixed",
            "summary": str((data or {}).get("summary") or "")[:400],
            "background": {"name": str(bg.get("name") or "")[:80], "description": str(bg.get("description") or "")[:600], "review": None},
            "elements": els}


# ------------------------------------------------------------ تجارب من غير Atlas

def mock_audio(duration: float, marks: list[dict]) -> dict:
    sfx = [{"t": m["t"], "dur": 0.2, "label": "كليك تجريبي", "category": "click", "what": "تجربة"} for m in marks[:6]]
    return {"music": [{"start": 0.0, "end": round(duration, 2), "description": "بيت إلكتروني خفيف", "mood": "حماسي"}],
            "speech": [{"start": 0.3, "end": min(duration, 1.8), "speaker": "راوي", "text": "كلام تجريبي"}], "sfx": sfx}


def mock_elements(shot: dict, sfx: list[dict]) -> dict:
    s, e = shot["start"], shot["end"]
    return {"scene_type": "screen_recording", "summary": "تجربة: ماوس بيسحب ملف",
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
