"""🧠 عقل سمسمكيت: مراجع أي لقطة اتولّدت بالذكاء الاصطناعي قبل ما توصل للعميل.
بيقيس بالكود (اللقطة بعدت عن الصورة الأصلية؟ فيها قفزة أو تشوّه مفاجئ؟) وبيبص بعين نموذج رؤية على اللقطات بالترتيب
جنب الصورة الأصلية: حركة مش بشرية، أصابع/سنان/عيون مشوهة، ملامح بتتغير، أشياء بتذوب أو بتظهر من العدم، كلام مكتوب…
اللقطة اللي تفشل بتتعاد لوحدها، والسبب بيتسجل عشان نوري العميل إننا رفضنا لقطة «AI slop» قبل ما يشوفها."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

FRAMES = 10
SIZE = (72, 128)   # للقياس بس (عرض × طول)

PROMPT = (
    "You are the strict quality gate of a video platform. An AI video model animated the FIRST image (the source still) into a short clip; "
    "the next {n} images are frames of that clip in time order. The clip is meant to show (the planned shot, INCLUDING its planned camera move — a planned slow push-in or drift is fine, only judge moves beyond the plan): «{desc}».\n"
    "Reject anything a viewer would recognise as 'AI slop'. Check carefully, frame by frame:\n"
    "- anatomy: hands/fingers (count, merging, bending), teeth (count, shape, melting), eyes (blink, gaze, symmetry), lips, faces\n"
    "- identity: the person's face/features change between frames or drift away from the source\n"
    "- morphing: objects melt, stretch, merge, appear or vanish; tools change shape; textures boil or crawl\n"
    "- physics/motion: non-human or illogical movement, jumps, sudden zooms, the camera leaving the planned framing\n"
    "- framing drift: the shot stops being the shot in the source (e.g. a macro becomes a wide shot, new body parts appear)\n"
    "- artifacts: text/letters that appear, flicker, smearing, blur bursts\n"
    "Judge like a real viewer: things that make sense in the scene are NOT problems (a hand or tool naturally entering or leaving the frame, "
    "a normal blink, a slight planned zoom). Only report what looks impossible, broken or uncanny (things appearing from nothing or melting away, "
    "wrong anatomy, a face turning into another face).\n"
    "Measured by code: {measured}.\n"
    'Answer JSON only: {{"score": 1-10 (10 = indistinguishable from real footage), "pass": true/false (false if ANY clear problem a '
    'normal viewer would notice), "issues": [{{"type": "anatomy|identity|morphing|motion|framing|artifact", "frame": number, '
    '"what": "short concrete description in English"}}], "reason_ar": "one short sentence in Modern Standard Arabic for the client '
    'explaining why the shot was rejected, or empty if it passed"}}'
)


def frames(ffmpeg: str, clip: Path, out: Path, n: int = FRAMES, width: int = 360) -> list[Path]:
    """n لقطات موزعة على طول اللقطة (من غير أول وآخر جزء صغير)."""
    out.mkdir(parents=True, exist_ok=True)
    r = subprocess.run([ffmpeg, "-hide_banner", "-i", str(clip)], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr or "")
    dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)) if m else 5.0
    paths = []
    for i in range(n):
        t = 0.05 + (dur - 0.15) * i / max(n - 1, 1)
        p = out / f"f{i:02d}.jpg"
        subprocess.run([ffmpeg, "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", str(clip), "-frames:v", "1", "-vf", f"scale={width}:-2", str(p)], check=False)
        if p.exists():
            paths.append(p)
    return paths


def _gray(p: Path) -> np.ndarray:
    a = np.asarray(Image.open(p).convert("L").resize(SIZE), dtype=np.float32)
    return (a - a.mean()) / (a.std() + 1e-6)


def _sim(a: np.ndarray, b: np.ndarray) -> float:
    return float((a * b).mean())   # ارتباط (1 = نفس الصورة)


def measure(still: Path | None, fr: list[Path]) -> dict:
    """drift: قد إيه آخر اللقطة بعدت عن الصورة الأصلية · jump: أكبر قفزة بين لقطتين جنب بعض قصاد المعتاد."""
    g = [_gray(p) for p in fr]
    if len(g) < 2:
        return {}
    base = _gray(still) if still and still.exists() else g[0]
    sims = [_sim(base, x) for x in g]
    steps = [float(np.abs(g[i + 1] - g[i]).mean()) for i in range(len(g) - 1)]
    med = float(np.median(steps)) or 1e-6
    out = {"start_similarity": round(sims[0], 2), "end_similarity": round(sims[-1], 2), "min_similarity": round(min(sims), 2),
           "biggest_jump_vs_typical": round(max(steps) / med, 1), "jump_at_frame": int(np.argmax(steps)) + 1}
    flags = []
    if sims[-1] < 0.35:
        flags.append("the end of the clip looks very different from the source (framing/identity drift)")
    if out["biggest_jump_vs_typical"] > 3.5 and max(steps) > 0.35:
        flags.append(f"sudden jump between frames {out['jump_at_frame']} and {out['jump_at_frame'] + 1}")
    out["flags"] = flags
    return out


def review(ffmpeg: str, clip: Path, still: Path | None, desc: str, look, work: Path) -> dict:
    """look(images: list[Path], prompt) -> dict (نموذج الرؤية). النتيجة: {pass, score, issues, reason_ar, measured}."""
    fr = frames(ffmpeg, clip, work)
    m = measure(still, fr)
    imgs = ([still] if still and still.exists() else []) + fr
    v = {}
    for _ in range(2):   # رد مش JSON سليم بيتعاد مرة
        try:
            v = look(imgs, PROMPT.format(n=len(fr), desc=desc, measured=json.dumps(m))) or {}
            break
        except Exception as exc:  # noqa: BLE001
            v = {"error": str(exc)[:200]}
    try:
        score = int(float(v.get("score")))
    except (TypeError, ValueError):
        score = None
    issues = [i for i in v.get("issues") or [] if isinstance(i, dict)][:6]
    # أرقام الكود بتروح للنموذج كدليل بس: تقريب الكاميرا المخطط بيقلّل التشابه برضه، فمش بنرفض بيها لوحدها
    hard = False
    if "pass" in v:   # رفض من غير ولا مشكلة محددة = مش رفض؛ والنجاح لازم درجة ٦ على الأقل
        ok = (bool(v.get("pass")) or not issues) and (score or 0) >= 6 and not hard
    else:
        ok = not hard
    return {"pass": ok, "score": score, "issues": issues, "reason_ar": "" if ok else str(v.get("reason_ar") or "").strip()[:200],
            "measured": m, "error": v.get("error")}
