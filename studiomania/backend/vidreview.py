"""🎥 رأي في فيديوهات العميل نفسها (مش بس الأرقام): الإضاءة والألوان والوضوح والصوت والدقة بتتقاس بالكود من الفيديو،
واللقطات + الكلام + الأرقام بتروح للنموذج يقول اللي حلو في كل فيديو واللي ممكن يتحسن بالدليل.
النتيجة بتظهر في كارت تحليل الحساب، وسعاد بتكلّم العميل عن فيديوهاته بالاسم."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image


def metrics(ffmpeg: str, mp4: Path, frames: list[Path], size: tuple[int, int] | None) -> dict:
    """أرقام الجودة من اللقطات والصوت: الإضاءة (0-255)، والتباين، والتشبع، والوضوح، وعلو الصوت، والدقة."""
    lum, con, sat, sharp = [], [], [], []
    for f in frames:
        try:
            im = Image.open(f).convert("RGB")
        except OSError:
            continue
        a = np.asarray(im, dtype=np.float32)
        g = a[..., 0] * .299 + a[..., 1] * .587 + a[..., 2] * .114
        lum.append(float(g.mean()))
        con.append(float(g.std()))
        mx, mn = a.max(-1), a.min(-1)
        sat.append(float(np.mean(np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)) * 100))
        lap = g[1:-1, 1:-1] * 4 - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:]
        sharp.append(float(lap.var()))
    vol = None
    r = subprocess.run([ffmpeg, "-hide_banner", "-i", str(mp4), "-vn", "-af", "volumedetect", "-f", "null", "-"],
                       capture_output=True, text=True, timeout=180)
    m = re.search(r"mean_volume:\s*(-?[\d.]+) dB", r.stderr or "")
    if m:
        vol = float(m.group(1))
    avg = lambda x: round(sum(x) / len(x), 1) if x else None  # noqa: E731
    out = {"brightness": avg(lum), "contrast": avg(con), "saturation": avg(sat), "sharpness": avg(sharp), "loudness_db": vol}
    if size:
        out.update(width=size[0], height=size[1], vertical=size[1] > size[0])
    out["flags"] = flags(out)
    return out


def flags(m: dict) -> list[str]:
    """ملاحظات مقاسة (بالإنجليزي للنموذج)، عشان رأيه يبقى على دليل مش تخمين."""
    f = []
    b, c, s, sh, v = m.get("brightness"), m.get("contrast"), m.get("saturation"), m.get("sharpness"), m.get("loudness_db")
    if b is not None and b < 75:
        f.append("dark image (underexposed)")
    if b is not None and b > 195:
        f.append("overexposed / too bright")
    if c is not None and c < 38:
        f.append("flat, low-contrast image")
    if s is not None and s < 18:
        f.append("washed-out, dull colors")
    if s is not None and s > 62:
        f.append("oversaturated colors")
    if sh is not None and sh < 60:
        f.append("soft / blurry image")
    if v is not None and v < -32:
        f.append("voice too quiet")
    if v is not None and v > -9:
        f.append("audio too loud / may distort")
    if m.get("height") and min(m.get("width") or 0, m["height"]) < 640:
        f.append(f"low resolution ({m.get('width')}x{m['height']})")
    if m.get("vertical") is False:
        f.append("horizontal video (not vertical 9:16)")
    return f


def prompt(brand: str, videos: list[dict]) -> str:
    rows = []
    for i, v in enumerate(videos):
        rows.append(f"[{i}] {'one of their best' if v['rank'] == 'best' else 'one of their weakest'} · {v['views']} views · {v['seconds']}s · "
                    f"caption: {v.get('caption', '')[:200]!r} · spoken: {v.get('transcript', '')[:500]!r} · "
                    f"measured: {json.dumps({k: v['metrics'].get(k) for k in ('brightness', 'contrast', 'saturation', 'sharpness', 'loudness_db', 'width', 'height')})} · "
                    f"measured issues: {', '.join(v['metrics'].get('flags') or []) or 'none'} · frames: {v['frames']} images in order")
    return (f"You review the short videos of a brand's own social account ({brand or 'the brand'}), like a friendly expert video editor "
            "who wants to help them. For EACH video look at its frames (in order), what is said, the caption and the measured numbers, and say:\n"
            "- good: 1–2 specific, real things that are good in it (the content, the cases/results shown, the person's energy, a strong hook…). "
            "Be generous but only with what you really see.\n"
            "- improve: 1–3 specific, practical improvements based on what you SEE in the frames and the measured issues: lighting, color "
            "grading, sharpness/quality, framing and background, sound, the hook in the first 2 seconds, text on screen/captions, length, "
            "a clear call to action. Each one short, with the reason (e.g. «الإضاءة خافتة على الوجه، فيظهر الفيديو باهتًا»).\n"
            "- line: one short sentence that sums up the video (what it is about).\n"
            "Never invent things you cannot see. Write in clear simple Modern Standard Arabic.\n"
            f"Videos (images come after this text, grouped per video in this same order):\n" + "\n".join(rows) +
            '\nReturn JSON only: {"videos": [{"i": 0, "line": "...", "good": ["..."], "improve": ["..."]}], '
            '"overall": "one or two sentences on the overall production quality of their videos and the single most important fix", '
            '"presenter": {"gender": "m, f, mixed (both appear a lot) or none (nobody appears/talks)", '
            '"who": "short English description of the main person who appears or talks in most videos"}}')


def clean(raw: dict, videos: list[dict]) -> tuple[list[dict], str]:
    out = []
    for x in raw.get("videos") or []:
        try:
            i = int(x.get("i"))
        except (TypeError, ValueError, AttributeError):
            continue
        if not 0 <= i < len(videos) or any(o["i"] == i for o in out):
            continue
        strs = lambda k, n: [str(s).strip()[:220] for s in (x.get(k) or []) if str(s).strip()][:n]  # noqa: E731
        out.append({"i": i, "line": str(x.get("line") or "").strip()[:200], "good": strs("good", 2), "improve": strs("improve", 3)})
    return out, str(raw.get("overall") or "").strip()[:400]


def presenter(raw: dict) -> dict:
    """مين اللي بيظهر في فيديوهات الصفحة (راجل / ست / الاتنين / محدش)، عشان لو مختلف عن نوع العميل في التسجيل سعاد تسأله."""
    p = raw.get("presenter") if isinstance(raw.get("presenter"), dict) else {}
    g = str(p.get("gender") or "").strip().lower()
    return {"gender": g if g in ("m", "f", "mixed", "none") else "", "who": str(p.get("who") or "").strip()[:160]}


def mock(videos: list[dict]) -> dict:
    return {"videos": [{"i": i, "line": "فيديو تجريبي", "good": ["الفكرة واضحة من أول ثانية"],
                        "improve": [*(f"ملاحظة مقاسة: {f}" for f in v["metrics"].get("flags") or []), "أضف ترجمة مكتوبة على الشاشة"][:3]}
                       for i, v in enumerate(videos)], "overall": "الجودة جيدة عمومًا، وأهم تحسين هو الإضاءة على الوجه."}
