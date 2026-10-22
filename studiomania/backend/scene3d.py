"""🧊 استوديو المشهد: مسودة 3D بأشكال بسيطة (البيت على المحارة) ← فيديو حقيقي.

المشهد JSON صغير: أشكال (صندوق، كورة، أسطوانة، بطاقة بصورة…) بمكان ولون وحركة، وكاميرا بنقط على الوقت.
المتصفح يرسمه (three.js) ويُخرج منه فيديو رمادي، هذا والفيديو يُرسل لموديل فيديو يأخذ فيديو مرجع
ومعه صور العناصر والوصف، فالنموذج يلوّن المشهد بدون ما يخمّن الحركة ولا زاوية الكاميرا.
"""
from __future__ import annotations

import json
import math
import re
import uuid

SHAPES = {"box": "صندوق", "sphere": "كورة", "cylinder": "أسطوانة", "cone": "مخروط", "torus": "حلقة", "capsule": "كبسولة",
          "plane": "أرضية/حيطة", "card": "بطاقة بصورة"}
LIGHTS = {"studio": "استوديو", "sunset": "غروب", "night": "ليل", "soft": "ناعم"}
RATIOS = ("9:16", "16:9", "1:1", "4:5")
MAX_OBJECTS = 24
MAX_KEYS = 8


def oid() -> str:
    return uuid.uuid4().hex[:8]


def _num(v, lo: float, hi: float, d: float) -> float:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return d
    return d if math.isnan(x) else max(lo, min(hi, x))


def _vec(v, d: list[float], lo: float = -50, hi: float = 50) -> list[float]:
    v = v if isinstance(v, (list, tuple)) else []
    return [round(_num(v[i] if i < len(v) else None, lo, hi, d[i]), 3) for i in range(3)]


def _color(v, d: str = "#9a9a9a") -> str:
    v = str(v or "")
    return v if re.fullmatch(r"#[0-9a-fA-F]{6}", v) else d


def clean_ref(r) -> dict | None:
    """صورة على شكل (من المكتبة أو شخصية أو خلفية): الرابط لكي المتصفح يرسمها، والإشارة لكي تُرسل للنموذج."""
    if not isinstance(r, dict) or not r.get("id") or not r.get("kind"):
        return None
    return {"kind": str(r["kind"])[:20], "id": str(r["id"])[:120], "label": str(r.get("label") or "")[:80], "thumb": str(r.get("thumb") or "")[:400]}


def clean_object(o: dict) -> dict | None:
    if not isinstance(o, dict):
        return None
    shape = o.get("shape") if o.get("shape") in SHAPES else "box"
    a = o.get("anim") if isinstance(o.get("anim"), dict) else {}
    anim = {"spin": round(_num(a.get("spin"), -720, 720, 0), 1), "bob": round(_num(a.get("bob"), 0, 3, 0), 2),
            "move": _vec(a["move"], [0, 0, 0]) if isinstance(a.get("move"), (list, tuple)) else None}
    return {"id": str(o.get("id") or oid())[:12], "name": str(o.get("name") or SHAPES[shape])[:60], "shape": shape,
            "color": _color(o.get("color")), "pos": _vec(o.get("pos"), [0, 0.5, 0]), "rot": _vec(o.get("rot"), [0, 0, 0], -360, 360),
            "scale": _vec(o.get("scale"), [1, 1, 1], 0.02, 30), "img": clean_ref(o.get("img")), "what": str(o.get("what") or "")[:300], "anim": anim}


def clean_key(k: dict) -> dict | None:
    if not isinstance(k, dict):
        return None
    return {"t": round(_num(k.get("t"), 0, 60, 0), 2), "pos": _vec(k.get("pos"), [0, 1.6, 5]), "look": _vec(k.get("look"), [0, 0.6, 0]),
            "fov": round(_num(k.get("fov"), 12, 100, 40), 1)}


def clean(raw: dict) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    dur = round(_num(raw.get("duration"), 2, 15, 5), 1)
    objs = [x for x in (clean_object(o) for o in (raw.get("objects") or [])[:MAX_OBJECTS]) if x]
    keys = sorted([x for x in (clean_key(k) for k in (raw.get("camera") or [])[:MAX_KEYS]) if x], key=lambda k: k["t"])
    if not keys:
        keys = [clean_key({"t": 0}), clean_key({"t": dur, "pos": [0, 1.2, 3.2]})]
    for k in keys:
        k["t"] = min(k["t"], dur)
    return {"ratio": raw.get("ratio") if raw.get("ratio") in RATIOS else "9:16", "duration": dur, "bg": _color(raw.get("bg"), "#1c1c1f"),
            "floor": bool(raw.get("floor", True)), "light": raw.get("light") if raw.get("light") in LIGHTS else "studio",
            "objects": objs, "camera": keys}


def default() -> dict:
    """مشهد البداية: قاعدة ومنتج عليها يدور، والكاميرا تقرّب."""
    return clean({"duration": 5, "objects": [
        {"name": "القاعدة", "shape": "cylinder", "color": "#d8d4cc", "pos": [0, 0.15, 0], "scale": [1.6, 0.3, 1.6]},
        {"name": "المنتج", "shape": "box", "color": "#e5613e", "pos": [0, 0.75, 0], "scale": [0.9, 0.9, 0.9], "anim": {"spin": 45}}],
        "camera": [{"t": 0, "pos": [0, 1.8, 5.5], "look": [0, 0.7, 0], "fov": 38}, {"t": 5, "pos": [1.2, 1.3, 3.2], "look": [0, 0.75, 0], "fov": 34}]})


def plan_messages(text: str, brand: str, current: dict, names: list[str]) -> list[dict]:
    return [{"role": "user", "content": f"""You are a previs artist. Build a ROUGH 3D blockout (grey placeholder shapes, like an unfinished house) for a short video.
The blockout only fixes layout, object motion and camera motion; a video AI will later paint the real look on top using reference images.
Coordinates: meters, y is up, the floor is y=0, the main subject usually near the origin. Keep everything within about 6 m.
Shapes: {", ".join(SHAPES)} ("card" = a flat picture standing in the scene, good for a product photo, a logo or a person cutout; "plane" = floor/wall).
Each object: {{"id","name" (short Egyptian Arabic),"shape","color" (#rrggbb, rough tones only),"pos":[x,y,z] (center),"rot":[x,y,z] degrees,
"scale":[x,y,z] (size in meters per axis; card/plane use x=width y=height),"what": "what this placeholder really is, in English, detailed (material, color, brand-free)",
"anim": {{"spin": degrees per second around y (0 = still), "bob": up-down meters (0 = none), "move": [x,y,z] end position or null}}}}
Camera: 2 to 5 keys {{"t" seconds,"pos":[x,y,z],"look":[x,y,z] (point it looks at),"fov" degrees}}; the camera glides smoothly between keys. Make the move cinematic and purposeful.
duration: 3 to 12 seconds. ratio: one of {", ".join(RATIOS)}. light: one of {", ".join(LIGHTS)}. bg: background color.
Use 2 to 10 objects. Do not try to model fine details; one simple shape per thing.
Library items the client may attach later (names only): {json.dumps(names[:40], ensure_ascii=False)}
Brand notes: {brand[:1200] or "none"}
Current scene (keep what the client does not ask to change): {json.dumps(current, ensure_ascii=False)[:3000]}
The client's description (Egyptian Arabic, may be spoken): «{text}»
Return JSON only: {{"scene": {{"duration","ratio","bg","floor","light","objects":[...],"camera":[...]}},
"prompt": "an English prompt for the video AI describing the final real look of the shot (materials, lighting, mood), and saying to keep the camera move and layout of the reference video",
"say": "one or two short sentences in Egyptian Arabic about what you built"}}"""}]


def mock_plan(text: str) -> dict:
    """تجربة بدون نموذج: يفهم كلمات بسيطة (يدور، يقرّب، أعلى، حذاء/زجاجة/علبة)."""
    t = text or ""
    s = default()
    prod = s["objects"][1]
    if re.search(r"جزم|حذاء|كوتشي|shoe", t):
        prod.update(name="الحذاء", shape="capsule", scale=[0.5, 0.45, 1.2], rot=[90, 0, 0], what="a modern running sneaker")
    elif re.search(r"زجاج|برفان|عطر|bottle", t):
        prod.update(name="الزجاجة", shape="cylinder", scale=[0.45, 1.1, 0.45], pos=[0, 0.85, 0], what="a premium glass perfume bottle")
    if re.search(r"فوق|تطلع|up", t):
        s["camera"].append({"t": s["duration"], "pos": [0, 3.2, 2.2], "look": [0, 0.7, 0], "fov": 36})
        s["camera"][1]["t"] = round(s["duration"] * 0.6, 1)
    if re.search(r"ثابت|مش بيلف", t):
        prod["anim"]["spin"] = 0
    return {"scene": clean(s), "prompt": "Premium product commercial, soft studio light, clean reflections. Keep the exact camera move, layout and object motion of the reference video; replace the grey placeholders with the real objects.",
            "say": "عملت مسودة: قاعدة والمنتج عليها يبحث، والكاميرا تقرّب. عدّل الذي تريده وطلّع المسودة."}


def gen_prompt(sc: dict, prompt: str, refs: list[dict]) -> str:
    """وصف التوليد: الوصف الخاص بالعميل + وصف كل شكل هو ماذا في الحقيقة + أوامر أن النموذج يسير على الحركة بالحرف."""
    parts = [prompt.strip()] if prompt.strip() else []
    things = [f"the {o['color']} {o['shape']} named «{o['name']}» is {o['what']}" + (f" (see reference «{o['img']['label']}»)" if o.get("img") else "")
              for o in sc.get("objects") or [] if o.get("what") or o.get("img")]
    if things:
        parts.append("In the reference video: " + "; ".join(things) + ".")
    parts.append("Use the reference video ONLY as a layout and motion guide: keep its exact camera path, framing, timing and object positions and movement. "
                 "Replace every grey placeholder shape with the real object, photoreal materials and lighting. No placeholder shapes, no text, no watermark.")
    return "\n".join(parts)[:4000]
