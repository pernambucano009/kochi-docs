"""🎞️ «فريم فريم»: استوديو أنيميشن مرسوم بالكود، على مراحل والعميل متحكم في كل مرحلة قبل اللي بعدها.

المراحل: المدخلات ← دليل الستايل (من المراجع) ← الفكرة والمشاهد ← صور ثابتة للمراجعة ← الفيديو.
الرسم والصوت والمتصفح المقفول من stylecl؛ هنا البرومبتات والقيم الافتراضية والتجهيز.
"""
from __future__ import annotations

import json

import stylecl

FORMATS = {"auto": "البرنامج يختار", "single-world story": "حكاية في عالم واحد", "transformation journey": "رحلة تحوّل",
           "showcase montage": "مونتاج عوالم", "explainer": "شرح بالرسم", "seamless loop": "لوب من غير نهاية",
           "kinetic type": "كلام متحرك"}
ENERGY = {"calm": "هادي", "building": "بيتصاعد", "intense": "حماسي"}
SOUND = {"on": "موسيقى ومؤثرات", "sfx": "مؤثرات بس", "off": "من غير صوت"}

ENGINES = {"canvas": "أشكال وخطوط بالكود", "brush": "فُرش حقيقية (رصاص، فحم، حبر، ألوان مية)"}
DEFAULT_INPUTS = {"idea": "", "duration": 15, "ratio": "9:16", "energy": "building", "format": "auto", "fps": 30, "engine": "canvas",
                  "title": "", "closing": "", "include": "", "avoid": "", "sound": "on", "font": "auto"}


def clean_inputs(raw: dict | None, base: dict | None = None) -> dict:
    d = {**DEFAULT_INPUTS, **(base or {})}
    for k, v in (raw or {}).items():
        if k in DEFAULT_INPUTS:
            d[k] = v
    d["idea"] = str(d["idea"] or "").strip()[:1500]
    d["duration"] = d["duration"] if d["duration"] in stylecl.DURATIONS else 15
    d["ratio"] = d["ratio"] if d["ratio"] in stylecl.RATIOS else "9:16"
    d["energy"] = d["energy"] if d["energy"] in ENERGY else "building"
    d["format"] = d["format"] if d["format"] in FORMATS else "auto"
    d["fps"] = 24 if str(d["fps"]) == "24" else 30
    d["sound"] = d["sound"] if d["sound"] in SOUND else "on"
    d["font"] = d["font"] if d["font"] in ("auto", *stylecl.FONTS) else "auto"
    d["engine"] = d["engine"] if d["engine"] in ENGINES else "canvas"
    for k in ("title", "closing", "include", "avoid"):
        d[k] = str(d[k] or "").strip()[:300]
    return d


def _extras(i: dict) -> str:
    out = [f"Energy: {i['energy']}."]
    if i["format"] != "auto":
        out.append(f"Format (required): {i['format']}.")
    if i["title"]:
        out.append(f"Optional title on screen: «{i['title']}».")
    if i["closing"]:
        out.append(f"Closing line on the end card: «{i['closing']}».")
    if i["include"]:
        out.append(f"Must include: {i['include']}.")
    if i["avoid"]:
        out.append(f"Must avoid: {i['avoid']}.")
    if i["font"] != "auto":
        out.append(f"Typeface: {i['font']}.")
    if i.get("engine") == "brush":
        out.append("Marks are drawn with REAL natural-media brushes (" + ", ".join(stylecl.BRUSH_NAMES) + ", watercolour fills with bleed, "
                   "pencil hatching, flow fields). Lean into hand-drawn line, pencil shading and watercolour; keep grounds light (marks print like ink).")
    return "\n".join(out)


# ---------------------------------------------------------------- المرحلة 2: دليل الستايل

def bible_messages(i: dict, n_refs: int, brand: str) -> list[dict]:
    text = f"""You are the art director of a small animation studio. You get {n_refs} reference image(s) (or frames from a reference video).
Write the STYLE BIBLE for a {i['duration']}s {i['ratio']} animation that will be drawn entirely in code on a 2D canvas (shapes, variable-width ink,
gradients, halftone/riso, paper texture, type). No photos: if a reference is photographic, translate it into the closest drawable look.

Take the LOOK, never the subject: palette, texture, line, rendering technique, composition, typography, motion rhythm.
List everything each reference DEPICTS (characters, objects, scenes) under do_not_copy, so it is never reused.
The animation is about: {i['idea']}
{_extras(i)}
{('Brand (only if it fits the look):' + chr(10) + brand) if brand else ''}

Return JSON only:
{{"name": "short style name", "look": "3-5 precise sentences a painter could follow",
 "palette": ["#hex", ... 6-10], "palette_roles": {{"#hex": "role (ground / ink / accent / shadow ...)"}}, "background": "#hex",
 "ground": "paper / flat / gradient ...", "texture": "texture recipe (grain amount, fibres, halftone cell, misregistration px ...)",
 "line": "line quality (weight, taper, boil)", "shapes": "", "light": "", "depth": "", "composition": "",
 "type": "one of: {', '.join(stylecl.FONTS)}", "motion": "average shot length + easing personality", "sound_cues": "what this world sounds like",
 "do_not_copy": ["..."]}}"""
    return [{"role": "user", "content": text}]


def mock_bible(i: dict) -> dict:
    p = stylecl.mock_plan(i["idea"], i["duration"])["style"]
    return {**p, "palette": [*p["palette"], "#1b1b1b", "#efe6d2"], "palette_roles": {"#efe6d2": "ground", "#1b1b1b": "ink"},
            "ground": "paper", "shapes": "دواير وأشكال ناعمة", "light": "مسطّح", "depth": "طبقتين", "composition": "الموضوع في النص",
            "type": "Cairo", "sound_cues": "بوب وكليكات", "do_not_copy": ["الأشكال اللي في المرجع"]}


def clean_bible(raw: dict) -> dict:
    if not isinstance(raw, dict) or not raw.get("palette"):
        raise ValueError("دليل الستايل رجع ناقص")
    pal = [str(c)[:9] for c in raw.get("palette") or [] if isinstance(c, str) and c.startswith("#")][:12]
    raw["palette"] = pal or ["#efe6d2", "#1b1b1b"]
    raw["do_not_copy"] = [str(x)[:200] for x in raw.get("do_not_copy") or []][:20]
    if raw.get("type") not in stylecl.FONTS:
        raw["type"] = "Cairo"
    return raw


# ---------------------------------------------------------------- المرحلة 3: الفكرة والمشاهد

def concept_messages(i: dict, bible: dict) -> list[dict]:
    dur = i["duration"]
    text = f"""You are the director of a small animation studio with great taste. Plan a {dur}s {i['ratio']} piece drawn in code, in this style bible:
{json.dumps(bible, ensure_ascii=False)[:4000]}

IDEA: {i['idea']}
{_extras(i)}

Rules (each prevents a real failure):
- One idea with a payoff. If it rests on a real fact, use one TRUE detail.
- Every transition is motivated (match on shape/position, a real impact, an iris from a dot, a line the subject crosses, a window that grows, ink that spreads).
- Camera locked unless it follows a subject or reveals something; every move eases in, travels and lands with a hold.
- Energy curve: hook (0-1s) -> build (each beat adds something) -> breath (slow-mo/freeze/silence) -> payoff -> end card held >= 1s.
  15s template: 0-1 hook · 1-4 establish · 4-8 escalate (new state every 1-2s) · 8-11 peak · 11-13 breath · 13-15 payoff+card. Scale to {dur}s.
- One continuity device through the whole piece.
- Fill the frame like a poster; in 9:16 stack sky/title (top 25%), subject band, ground. No dead stretch longer than ~2s.
- Every visible action gets a sound; risers into transitions, impacts on them, silence on a freeze. {'' if i['sound'] == 'on' else 'Sound mode: ' + i['sound'] + '.'}
- On-screen text: minimal, short, same language as the idea. Never use anything from do_not_copy.
Formats: {', '.join(k for k in FORMATS if k != 'auto')}.

Return JSON only:
{{"title": "short name", "format": "", "logline": "the piece in one sentence", "why": "why it matters", "payoff": "the one moment",
 "device": "continuity device",
 "beats": [{{"t0": 0, "t1": 1.0, "what": "exactly what we see", "text": "", "transition": "what motivates the cut into the next beat", "camera": "", "sound": ""}}],
 "end_card": {{"text": "{i['closing'] or 'closing line'}", "t0": {max(1, dur - 1.5)}}},
 "sfx": [{{"t": 0.2, "kind": "{'|'.join(stylecl.SFX_KINDS)}"}}],
 "music": {{"bpm": 100, "mood": "{'|'.join(stylecl.MOODS)}", "key": "C|D|E|F|G|A|B"}}}}"""
    return [{"role": "user", "content": text}]


def mock_concept(i: dict) -> dict:
    p = stylecl.mock_plan(i["idea"], i["duration"])
    d = i["duration"]
    beats = [{"t0": 0, "t1": 1, "what": "نقطة صغيرة بتنور في النص", "text": "", "transition": "النقطة بتكبر", "camera": "ثابتة", "sound": "pop"},
             {"t0": 1, "t1": d * .55, "what": "دواير بتفتح طبقة ورا طبقة", "text": i["title"], "transition": "قزحية", "camera": "ثابتة", "sound": "whoosh"},
             {"t0": d * .55, "t1": d - 1.5, "what": "الكلام بيتكتب", "text": i["idea"][:30], "transition": "فريز", "camera": "ثابتة", "sound": "click"}]
    return {"title": p["title"], "format": "kinetic type", "logline": i["idea"][:80], "why": "", "payoff": "النص الأخير", "device": "النقطة",
            "beats": beats, "end_card": {"text": i["closing"] or "SimsimKit", "t0": d - 1.5}, "sfx": p["sfx"], "music": p["music"]}


def clean_concept(raw: dict, dur: int) -> dict:
    if not isinstance(raw, dict) or not raw.get("beats"):
        raise ValueError("لازم يكون فيه مشهد واحد على الأقل")
    beats = []
    for b in raw.get("beats") or []:
        if not isinstance(b, dict):
            continue
        try:
            t0, t1 = max(0.0, float(b.get("t0") or 0)), min(float(dur), float(b.get("t1") or 0))
        except (TypeError, ValueError):
            continue
        if t1 > t0:
            beats.append({"t0": round(t0, 2), "t1": round(t1, 2), **{k: str(b.get(k) or "")[:400] for k in ("what", "text", "transition", "camera", "sound")}})
    if not beats:
        raise ValueError("المشاهد مالهاش توقيت صحيح")
    raw["beats"] = sorted(beats, key=lambda b: b["t0"])[:24]
    ec = raw.get("end_card") if isinstance(raw.get("end_card"), dict) else {}
    try:
        t0 = float(ec.get("t0") or dur - 1.5)
    except (TypeError, ValueError):
        t0 = dur - 1.5
    raw["end_card"] = {"text": str(ec.get("text") or "")[:120], "t0": round(min(max(0.0, t0), dur - 1.0), 2)}
    return raw


def clean_sound(raw: dict | None, dur: int) -> dict:
    raw = raw or {}
    sfx = []
    for c in raw.get("sfx") or []:
        try:
            t = float(c.get("t"))
        except (TypeError, ValueError, AttributeError):
            continue
        if 0 <= t < dur and c.get("kind") in stylecl.SFX_KINDS:
            sfx.append({"t": round(t, 2), "kind": c["kind"]})
    m = raw.get("music") if isinstance(raw.get("music"), dict) else {}
    try:
        bpm = max(60, min(160, int(float(m.get("bpm") or 100))))
    except (TypeError, ValueError):
        bpm = 100
    return {"sfx": sorted(sfx, key=lambda c: c["t"])[:60],
            "music": {"bpm": bpm, "mood": m.get("mood") if m.get("mood") in stylecl.MOODS else "warm", "key": str(m.get("key") or "D")[:1].upper()}}


# ---------------------------------------------------------------- المرحلة 4 و5: الكود والصور الثابتة

def plan_for_code(d: dict) -> dict:
    """الخطة اللي بتروح لموديل الكود والمراجعة: الفكرة + دليل الستايل + الصوت."""
    i, c = d["inputs"], d.get("concept") or {}
    return {**{k: v for k, v in c.items() if k not in ("sfx", "music")}, "style": d.get("bible") or {}, "fps": i["fps"], "engine": i.get("engine", "canvas"),
            "energy": i["energy"], "must_include": i["include"], "must_avoid": i["avoid"], "duration": i["duration"]}


def still_times(d: dict) -> list[float]:
    """صورة من كل مشهد (قرب آخره، بعد ما الحركة تستقر) + كارت النهاية، لحد 8."""
    dur = float(d["inputs"]["duration"])
    c = d.get("concept") or {}
    ts = [round(b["t0"] + (b["t1"] - b["t0"]) * .7, 2) for b in c.get("beats") or []]
    ec = (c.get("end_card") or {}).get("t0")
    if ec is not None:
        ts.append(round(min(dur - .1, float(ec) + .6), 2))
    ts = sorted({t for t in ts if 0 <= t < dur})
    if len(ts) > 8:
        step = len(ts) / 8
        ts = [ts[int(k * step)] for k in range(8)]
    return ts or stylecl.sample_times(dur)


def sound_plan(d: dict) -> dict:
    """الصوت حسب اختيار العميل: كامل، مؤثرات بس، أو ساكت."""
    s = d.get("sound") or {}
    mode = d["inputs"]["sound"]
    if mode == "off":
        return {"sfx": [], "music": {"mood": "calm", "bpm": 60, "key": "D"}, "silent": True}
    return {"sfx": s.get("sfx") or [], "music": s.get("music") or {}, "no_music": mode == "sfx"}
