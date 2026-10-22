"""🎥 «من مرجع لبرومبت»: فيديو مرجعي ← تحليل حقيقي (قياسات + فريمات + قطعات) ← وصف جاهز لموديل فيديو، بـ 14 جزء ثابت.

القياسات والفريمات تُنشأ هنا بـ FFmpeg (غير تخمين)، والنموذج يرى الفريمات بتوقيتها ويكتب قائمة اللقطات والوصف.
"""
from __future__ import annotations

import re

TARGETS = {"": "أي نموذج", "Seedance": "Seedance", "Kling": "Kling", "Veo": "Veo", "Sora": "Sora", "Runway": "Runway", "Omni Flash": "Omni Flash"}
SECTIONS = ("SCENE CONTEXT", "LOCATION MAP", "FIRST FRAME / BLOCKING", "FORMAT MODE", "OPTICS", "CAMERA", "ACTION", "PHYSICS",
            "LIGHTING", "COLOR GRADE", "STYLE", "OUTPUT SETTINGS", "AUDIO", "POSITIVE LOCKS")

RULES = f"""Reverse-engineer this video into one generation-ready prompt that could recreate it.
You were given MEASURED facts (from ffprobe/ffmpeg, trust them) and frames extracted at fixed times (each frame is labelled with its time).
Never guess from a filename or anything stated by the user; describe only what is actually visible in the frames.

First build a timecoded shot list with in/out points, shot size, angle, camera move and what changes inside each shot, and state the total shot count.
Then write the prompt as ONE copy-paste block with no commentary inside it, using these sections in this order and nothing else:
SCENE CONTEXT — two or three lines naming what the film is, the subject, and how many timed beats it moves through, written as a stated progression.
LOCATION MAP — foreground, midground and background each in its own sentence, naming surfaces and materials rather than objects, ending with where the light originates.
FIRST FRAME / BLOCKING — the frame-one composition only: what sits where, camera height relative to subject, what is already visible or bright before anything moves.
FORMAT MODE — either a single continuous take or "Timed multishot, N seconds" followed by the line "Cuts only at the specified points, the camera does not cut on its own", then every beat as "0.0s to 1.0s — shot description, what the camera does, what the subject does, what the light does." with "1.0s HARD CUT" on its own line between beats; beat durations must total the measured duration.
OPTICS — one clause per beat: shot size, horizontal field of view in degrees and focus state; then "No drift mid-segment" and any flare behaviour and which beats carry it.
CAMERA — operator position and static/moving per beat, with rates in real units (degrees per second, km/h), ending with highlight roll-off behaviour.
ACTION — camera motion and subject motion kept explicitly separate, a rate for anything repeating, what stays absolutely still, and the internal timing of any two-phase beat.
PHYSICS — thickness, mass, how sources affect each other, specular and contact-shadow behaviour, scattering density; only what is visible.
LIGHTING — every source with direction in degrees, hardness and colour, haze density as a percentage, white balance in Kelvin.
COLOR GRADE — two or three colours maximum, each with a named role, plus black level behaviour.
STYLE — photoreal / 3D render / film stock / 2D motion graphics, then render traits (ray tracing, bloom, grain, bitrate).
OUTPUT SETTINGS — aspect ratio, resolution, real-time or ramped speed, motion blur at source fps.
AUDIO — music in (parentheses), sound effects in <angle brackets>, dialogue in {{braces}}, on-screen text in 「corner brackets」, or "silent, no audio design".
POSITIVE LOCKS — four to eight short lines of what stays identical across every beat, each phrased as something present (never "no X" / "avoid X").
Throughout: plain declarative sentences, real measurable units, no marketing adjectives ("stunning", "breathtaking", "cinematic masterpiece").
Write "ambiguous in source" instead of inventing anything. Never invent brand names, logos or real likenesses that are not clearly present.
Treat timestamps as time budgets, never more than one clear change per second.
Section headers must be exactly: {", ".join(SECTIONS)}."""


def messages_text(facts: dict, times: list[float], cuts: list[float], target: str, goal: str, note: str) -> str:
    want = ("Write it as a faithful copy of the reference." if goal == "copy" else
            "Keep the structure, timing, camera language and look, but change the subject/world so the result is an original variant, not a copy.")
    return f"""{RULES}

MEASURED FACTS: duration {facts['duration']:.2f}s · {facts['width']}x{facts['height']} · {facts['fps']:g} fps · aspect {facts['aspect']} · audio track: {'yes' if facts['has_audio'] else 'no'}
DETECTED HARD CUTS (scene change > 0.3) at: {', '.join(f'{c:.2f}s' for c in cuts) or 'none detected'}
FRAMES: {len(times)} frames follow, in order, at: {', '.join(f'{t:.2f}s' for t in times)}
TARGET MODEL: {target or 'model-agnostic'}. Video models usually generate at most 10-15s per clip.
GOAL: {want}{(' User note: ' + note) if note else ''}

Return JSON only:
{{"shots": [{{"t0": 0.0, "t1": 1.0, "size": "CU/MS/WS...", "angle": "", "move": "", "change": "what changes inside the shot"}}],
 "shot_count": 0,
 "prompt": "the full prompt block with the 14 section headers, each header on its own line",
 "notes": {{"struggle": "بالعربية الفصحى البسيطة: ماذا الذي النموذج سيتعب يحافظ عليه، وماذا الذي يتصلّح في المونتاج",
            "split": "بالعربية: يُولّد مرة واحدة ولا يُقسّم مقاطع، ومنين",
            "variants": ["بالعربية: شيء تتغيّر تظهر نسخة مختلفة", "...", "..."]}},
 "clips": [{{"t0": 0.0, "t1": 5.0, "prompt": "self-contained prompt for this clip only (same 14 sections, FORMAT MODE covering only this clip, times starting at 0.0s)"}}]}}
"clips" is an empty list when one generation is enough."""


def variant_text(prompt: str, change: str) -> str:
    return f"""Here is a generation-ready video prompt with fixed sections ({", ".join(SECTIONS)}).
Rewrite it into a VARIANT: apply this change everywhere it matters and keep everything else (structure, timing, camera language, look, units, locks) the same.
Change: {change}
Keep the exact section headers and the same plain, measurable style. Return JSON only: {{"prompt": "...", "summary": "بالعربية في جملة: ماذا الذي تغيّر"}}

PROMPT:
{prompt}"""


def mock_result(facts: dict, cuts: list[float]) -> dict:
    d = facts["duration"]
    edges = [0.0, *[c for c in cuts if 0 < c < d], d]
    shots = [{"t0": round(a, 2), "t1": round(b, 2), "size": "MS", "angle": "eye level", "move": "static", "change": "ambiguous in source"}
             for a, b in zip(edges, edges[1:])]
    fm = "\n".join(f"{s['t0']:.1f}s to {s['t1']:.1f}s — shot {k + 1}, camera static, subject ambiguous in source." + (f"\n{s['t1']:.1f}s HARD CUT" if k < len(shots) - 1 else "")
                   for k, s in enumerate(shots))
    prompt = "\n\n".join([
        f"SCENE CONTEXT\nTest reference. {len(shots)} timed beats.", "LOCATION MAP\nForeground: ambiguous in source. Midground: ambiguous in source. Background: ambiguous in source. Light originates from above.",
        "FIRST FRAME / BLOCKING\nSubject centred, camera at subject height.", f"FORMAT MODE\nTimed multishot, {d:.1f} seconds. Cuts only at the specified points, the camera does not cut on its own.\n{fm}",
        "OPTICS\nBeat 1: MS, 40 degrees, deep focus. No drift mid-segment.", "CAMERA\nStatic tripod for every beat.", "ACTION\nCamera static. Subject ambiguous in source.",
        "PHYSICS\nambiguous in source.", "LIGHTING\nSoft key from 45 degrees left, 5600 K, haze 0%.", "COLOR GRADE\nNeutral grey carries volume; black level clean.",
        "STYLE\n2D motion graphics, light grain.", f"OUTPUT SETTINGS\n{facts['aspect']}, {facts['width']}x{facts['height']}, real time, motion blur at {facts['fps']:g} fps.",
        "AUDIO\nsilent, no audio design.", "POSITIVE LOCKS\nThe same palette in every beat.\nOne subject in frame."])
    return {"shots": shots, "shot_count": len(shots), "prompt": prompt,
            "notes": {"struggle": "تجربة: لا يوجد تحليل حقيقي في وضع التجربة", "split": "مرة واحدة", "variants": ["غيّر الموضوع", "غيّر الألوان", "غيّر المكان"]},
            "clips": []}


def clean_result(raw: dict, dur: float) -> dict:
    if not isinstance(raw, dict) or not str(raw.get("prompt") or "").strip():
        raise ValueError("التحليل أعد بدون وصف")
    shots = []
    for s in raw.get("shots") or []:
        try:
            t0, t1 = float(s.get("t0") or 0), float(s.get("t1") or 0)
        except (TypeError, ValueError, AttributeError):
            continue
        if t1 > t0:
            shots.append({"t0": round(max(0, t0), 2), "t1": round(min(dur, t1), 2), **{k: str(s.get(k) or "")[:300] for k in ("size", "angle", "move", "change")}})
    clips = []
    for c in raw.get("clips") or []:
        try:
            t0, t1 = float(c.get("t0") or 0), float(c.get("t1") or 0)
        except (TypeError, ValueError, AttributeError):
            continue
        if t1 > t0 and str(c.get("prompt") or "").strip():
            clips.append({"t0": round(t0, 2), "t1": round(t1, 2), "prompt": str(c["prompt"])[:8000]})
    n = raw.get("notes") if isinstance(raw.get("notes"), dict) else {}
    return {"shots": shots, "shot_count": len(shots), "prompt": str(raw["prompt"])[:12000],
            "notes": {"struggle": str(n.get("struggle") or "")[:1200], "split": str(n.get("split") or "")[:800],
                      "variants": [str(v)[:200] for v in n.get("variants") or []][:5]},
            "clips": clips[:6]}


def missing_sections(prompt: str) -> list[str]:
    return [s for s in SECTIONS if not re.search(rf"^\s*{re.escape(s)}\s*$", prompt, re.M)]


def aspect(w: int, h: int) -> str:
    r = w / h if h else 1
    for name, v in (("9:16", 9 / 16), ("16:9", 16 / 9), ("1:1", 1.0), ("4:5", .8), ("3:4", .75), ("4:3", 4 / 3), ("21:9", 21 / 9)):
        if abs(r - v) < .03:
            return name
    return f"{w}:{h}"
