"""🎛️ استوديو التحكم: المشهد = خلفية + طبقات (كل عنصر من التفكيك صورة شفافة في مكانه)، وكل طبقة ليها إعدادات نتحكم فيها
(مكان، حجم، دوران، لون، شفافية، قلب، ترتيب) وحركة بالوقت (دخول، انتقال لمكان تاني، خروج) وصوت مربوط بالحركة.
الرسم فريم بفريم بـ Pillow وبيتبعت لـ FFmpeg، وأصوات الحركات من مكتبة الافيكتس (fx.SFX).
"""
from __future__ import annotations

import json
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageEnhance

import fx

FPS = 30
ENTERS = ("none", "fade", "pop", "zoom", "slide_up", "slide_down", "slide_left", "slide_right")
EASES = ("linear", "ease_out", "ease_in_out", "back")
SLIDE = {"slide_up": (0, 1), "slide_down": (0, -1), "slide_left": (1, 0), "slide_right": (-1, 0)}
ENTER_SFX = {"pop": "pop", "zoom": "whoosh", "slide_up": "whoosh", "slide_down": "whoosh", "slide_left": "whoosh", "slide_right": "whoosh"}


def _num(v, d: float, lo: float, hi: float) -> float:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return d
    return d if x != x else max(lo, min(hi, x))


def new_scene(W: int, H: int, bg: str | None, items: list[dict], duration: float = 4.0) -> dict:
    layers = []
    for i, it in enumerate(items):
        box = it.get("box") if isinstance(it.get("box"), list) and len(it["box"]) == 4 else [0, 0, W, H]
        layers.append({"id": f"L{i + 1}", "file": it["file"], "orig_file": it["file"], "name": it.get("name") or f"طبقة {i + 1}",
                       "box": [int(v) for v in box], "z": int(it.get("z") or i + 1)})
    return clean({"W": W, "H": H, "duration": duration, "bg": {"file": bg, "orig_file": bg}, "layers": layers}, W, H)


def clean(sc: dict, W: int | None = None, H: int | None = None) -> dict:
    """القيم كلها في حدودها (اللي جاي من الواجهة أو من الموديل)."""
    W, H = int(W or sc.get("W") or 1080), int(H or sc.get("H") or 1920)
    dur = round(_num(sc.get("duration"), 4, 0.5, 15), 2)
    bg = sc.get("bg") or {}
    out = {"W": W, "H": H, "duration": dur,
           "bg": {"file": bg.get("file"), "orig_file": bg.get("orig_file") or bg.get("file"), "visible": bool(bg.get("visible", True)),
                  "hue": _num(bg.get("hue"), 0, -180, 180), "sat": _num(bg.get("sat"), 1, 0, 3), "bright": _num(bg.get("bright"), 1, 0, 3),
                  "versions": [str(v) for v in bg.get("versions") or []][-10:]},
           "layers": []}
    for i, L in enumerate(sc.get("layers") or []):
        if not isinstance(L, dict) or not L.get("file"):
            continue
        a, en, ex = L.get("anim") or {}, L.get("enter") or {}, L.get("exit") or {}
        out["layers"].append({
            "id": str(L.get("id") or f"L{i + 1}")[:12], "file": str(L["file"]), "orig_file": str(L.get("orig_file") or L["file"]),
            "name": str(L.get("name") or "")[:80], "box": [int(_num(v, 0, -10 * W, 10 * W)) for v in (L.get("box") or [0, 0, W, H])[:4]],
            "z": int(_num(L.get("z"), i + 1, -100, 100)), "visible": bool(L.get("visible", True)),
            "dx": _num(L.get("dx"), 0, -2, 2), "dy": _num(L.get("dy"), 0, -2, 2), "scale": _num(L.get("scale"), 1, 0.05, 6),
            "rot": _num(L.get("rot"), 0, -360, 360), "opacity": _num(L.get("opacity"), 1, 0, 1), "flip": bool(L.get("flip")),
            "hue": _num(L.get("hue"), 0, -180, 180), "sat": _num(L.get("sat"), 1, 0, 3), "bright": _num(L.get("bright"), 1, 0, 3),
            "anim": {"on": bool(a.get("on")), "t0": _num(a.get("t0"), 0, 0, dur), "t1": _num(a.get("t1"), min(1, dur), 0, dur),
                     "dx": _num(a.get("dx"), _num(L.get("dx"), 0, -2, 2), -2, 2), "dy": _num(a.get("dy"), _num(L.get("dy"), 0, -2, 2), -2, 2),
                     "scale": _num(a.get("scale"), _num(L.get("scale"), 1, 0.05, 6), 0.05, 6), "rot": _num(a.get("rot"), _num(L.get("rot"), 0, -360, 360), -720, 720),
                     "opacity": _num(a.get("opacity"), _num(L.get("opacity"), 1, 0, 1), 0, 1),
                     "ease": a.get("ease") if a.get("ease") in EASES else "ease_out",
                     "sfx": a.get("sfx") if a.get("sfx") in ("auto", "none", *fx.SFX) else "auto"},
            "enter": {"type": en.get("type") if en.get("type") in ENTERS else "none", "t": _num(en.get("t"), 0, 0, dur),
                      "dur": _num(en.get("dur"), 0.4, 0.05, 3), "sfx": en.get("sfx") if en.get("sfx") in ("auto", "none", *fx.SFX) else "auto"},
            "exit": {"type": ex.get("type") if ex.get("type") in ENTERS else "none", "t": _num(ex.get("t"), dur, 0, dur),
                     "dur": _num(ex.get("dur"), 0.35, 0.05, 3), "sfx": ex.get("sfx") if ex.get("sfx") in ("auto", "none", *fx.SFX) else "auto"},
            "versions": [str(v) for v in L.get("versions") or []][-10:],
        })
    return out


# ------------------------------------------------------------ الحركة

def _ease(p: float, kind: str) -> float:
    p = max(0.0, min(1.0, p))
    if kind == "linear":
        return p
    if kind == "ease_in_out":
        return 3 * p * p - 2 * p * p * p
    if kind == "back":
        return 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2
    return 1 - (1 - p) ** 3


def pose(L: dict, t: float) -> dict | None:
    """مكان وحجم ودوران وشفافية الطبقة في اللحظة t (أو None لو مش ظاهرة)."""
    p = {k: L[k] for k in ("dx", "dy", "scale", "rot", "opacity")}
    a = L["anim"]
    if a["on"] and a["t1"] > a["t0"]:
        q = _ease((t - a["t0"]) / (a["t1"] - a["t0"]), a["ease"])
        for k in p:
            p[k] = p[k] + (a[k] - p[k]) * q
    en, ex = L["enter"], L["exit"]
    if en["type"] != "none":
        if t < en["t"]:
            return None
        q = min(1.0, (t - en["t"]) / en["dur"])
        if en["type"] == "fade":
            p["opacity"] *= q
        elif en["type"] == "pop":
            p["scale"] *= max(0.0, _ease(q, "back"))
        elif en["type"] == "zoom":
            p["scale"] *= 0.6 + 0.4 * _ease(q, "ease_out")
            p["opacity"] *= q
        elif en["type"] in SLIDE:
            sx, sy = SLIDE[en["type"]]
            p["dx"] += sx * 0.3 * (1 - _ease(q, "ease_out"))
            p["dy"] += sy * 0.3 * (1 - _ease(q, "ease_out"))
            p["opacity"] *= min(1.0, q * 2)
    if ex["type"] != "none" and t >= ex["t"]:
        q = min(1.0, (t - ex["t"]) / ex["dur"])
        if q >= 1:
            return None
        if ex["type"] in ("fade", "zoom"):
            p["opacity"] *= 1 - q
        if ex["type"] in ("pop", "zoom"):
            p["scale"] *= 1 - (0.4 if ex["type"] == "zoom" else 1) * q ** 2
        elif ex["type"] in SLIDE:
            sx, sy = SLIDE[ex["type"]]
            p["dx"] -= sx * 0.3 * q ** 2
            p["dy"] -= sy * 0.3 * q ** 2
    return p if p["opacity"] > 0.003 and p["scale"] > 0.01 else None


def sfx_events(sc: dict) -> list[tuple[float, str, float]]:
    ev = []
    for L in sc["layers"]:
        if not L["visible"]:
            continue
        en, ex, a = L["enter"], L["exit"], L["anim"]
        if en["type"] != "none" and en["sfx"] != "none":
            name = ENTER_SFX.get(en["type"]) if en["sfx"] == "auto" else en["sfx"]
            if name:
                ev.append((en["t"] + (en["dur"] * 0.55 if en["type"] == "pop" else 0), name, 0.9))
        if a["on"] and a["sfx"] != "none" and a["t1"] > a["t0"]:
            moved = math.hypot(a["dx"] - L["dx"], a["dy"] - L["dy"]) > 0.03 or abs(a["rot"] - L["rot"]) > 10
            grew = abs(a["scale"] - L["scale"]) > 0.1
            name = (("whoosh" if moved else "pop" if grew else None) if a["sfx"] == "auto" else a["sfx"])
            if name:
                ev.append((a["t0"] if name == "whoosh" else a["t1"], name, 0.8))
        if ex["type"] != "none" and ex["sfx"] != "none":
            name = ENTER_SFX.get(ex["type"]) if ex["sfx"] == "auto" else ex["sfx"]
            if name:
                ev.append((ex["t"], name, 0.6))
    return ev


# ------------------------------------------------------------ الرسم

def _filters(im: Image.Image, hue: float, sat: float, bright: float, flip: bool = False) -> Image.Image:
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if abs(hue) < 0.5 and abs(sat - 1) < 0.01 and abs(bright - 1) < 0.01:
        return im
    alpha = im.getchannel("A") if im.mode == "RGBA" else None
    rgb = im.convert("RGB")
    if abs(hue) >= 0.5:
        h, s, v = rgb.convert("HSV").split()
        shift = int(round(hue / 360 * 255))
        h = h.point(lambda x: (x + shift) % 256)
        rgb = Image.merge("HSV", (h, s, v)).convert("RGB")
    if abs(sat - 1) >= 0.01:
        rgb = ImageEnhance.Color(rgb).enhance(sat)
    if abs(bright - 1) >= 0.01:
        rgb = ImageEnhance.Brightness(rgb).enhance(bright)
    if alpha is not None:
        rgb = rgb.convert("RGBA")
        rgb.putalpha(alpha)
    return rgb


def render(ffmpeg: str, sc: dict, files: Path, out: Path, work: Path, sfx_cache: Path, width: int = 720) -> Path:
    """فيديو المشهد بحركاته وأصواتها."""
    W, H = sc["W"], sc["H"]
    k = width / W
    ow, oh = width, int(round(H * k / 2) * 2)
    bg = sc["bg"]
    if bg.get("file") and bg.get("visible", True) and (files / bg["file"]).exists():
        base = _filters(Image.open(files / bg["file"]).convert("RGB"), bg["hue"], bg["sat"], bg["bright"]).resize((ow, oh), Image.LANCZOS)
    else:
        base = Image.new("RGB", (ow, oh), (16, 16, 16))
    layers = [L for L in sorted(sc["layers"], key=lambda x: x["z"]) if L["visible"] and (files / L["file"]).exists()]
    src = {}
    for L in layers:  # الصورة متفلترة مرة واحدة بالحجم اللي هتترسم بيه
        im = Image.open(files / L["file"]).convert("RGBA")
        x1, y1, x2, y2 = L["box"]
        bw, bh = max(1, int((x2 - x1) * k)), max(1, int((y2 - y1) * k))
        src[L["id"]] = _filters(im.resize((bw, bh), Image.LANCZOS), L["hue"], L["sat"], L["bright"], L["flip"])
    work.mkdir(parents=True, exist_ok=True)
    events = sfx_events(sc)
    wav = fx.mix_events(ffmpeg, sfx_cache, events, sc["duration"], work / f"{out.stem}-sfx.wav") if events else None
    cmd = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{ow}x{oh}",
           "-r", str(FPS), "-i", "pipe:0"]
    if wav:
        cmd += ["-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "160k", "-af", f"apad=whole_dur={sc['duration']:.2f}"]
    cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-t", f"{sc['duration']:.2f}",
            "-movflags", "+faststart", str(out)]
    errlog = work / f"{out.stem}.log"
    cache: dict = {}
    with open(errlog, "wb") as err:
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=err)
        try:
            for f in range(int(math.ceil(sc["duration"] * FPS))):
                t = f / FPS
                frame = base.copy().convert("RGBA")
                for L in layers:
                    p = pose(L, t)
                    if not p:
                        continue
                    key = (L["id"], round(p["scale"], 3), round(p["rot"], 1), round(p["opacity"], 2))
                    im = cache.get(key)
                    if im is None:
                        im = src[L["id"]]
                        if abs(p["scale"] - 1) > 0.002:
                            im = im.resize((max(1, int(im.width * p["scale"])), max(1, int(im.height * p["scale"]))), Image.BILINEAR)
                        if abs(p["rot"]) > 0.05:
                            im = im.rotate(-p["rot"], resample=Image.BICUBIC, expand=True)
                        if p["opacity"] < 0.997:
                            im = im.copy()
                            im.putalpha(im.getchannel("A").point(lambda v, o=p["opacity"]: int(v * o)))
                        if len(cache) > 600:
                            cache.clear()
                        cache[key] = im
                    x1, y1, x2, y2 = L["box"]
                    cx = (x1 + x2) / 2 * k + p["dx"] * ow
                    cy = (y1 + y2) / 2 * k + p["dy"] * oh
                    x, y = int(cx - im.width / 2), int(cy - im.height / 2)
                    sx, sy = max(0, -x), max(0, -y)
                    cw, ch = min(im.width - sx, ow - max(0, x)), min(im.height - sy, oh - max(0, y))
                    if cw > 0 and ch > 0:
                        frame.alpha_composite(im.crop((sx, sy, sx + cw, sy + ch)), (max(0, x), max(0, y)))
                proc.stdin.write(frame.convert("RGB").tobytes())
            proc.stdin.close()
            code = proc.wait(timeout=600)
        except Exception:
            proc.kill()
            raise
    if code != 0:
        raise RuntimeError(f"رسم المشهد فشل: {errlog.read_text(errors='ignore')[-300:]}")
    errlog.unlink(missing_ok=True)
    if wav:
        wav.unlink(missing_ok=True)
    return out


def trim_fit(im: Image.Image) -> Image.Image:
    """الصورة على قد محتواها (من غير الحواف الشفافة)."""
    im = im.convert("RGBA")
    bb = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    return im.crop(bb) if bb else im


def fit_into(im: Image.Image, w: int, h: int) -> Image.Image:
    """جوه مربع العنصر الأصلي بنفس النسب (متوسّط)."""
    im = trim_fit(im)
    r = min(w / im.width, h / im.height)
    im = im.resize((max(1, int(im.width * r)), max(1, int(im.height * r))), Image.LANCZOS)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((w - im.width) // 2, (h - im.height) // 2))
    return canvas


# ------------------------------------------------------------ التحكم بالكلام

PATCH_FORMAT = """{
  "duration": 4,
  "layers": [{"id": "L1", "visible": true, "dx": 0, "dy": 0, "scale": 1, "rot": 0, "opacity": 1, "flip": false,
              "hue": 0, "sat": 1, "bright": 1, "z": 1,
              "anim": {"on": true, "t0": 0.5, "t1": 1.5, "dx": 0.3, "dy": -0.2, "scale": 1, "rot": 0, "opacity": 1, "ease": "ease_out | linear | ease_in_out | back", "sfx": "auto | none"},
              "enter": {"type": "none | fade | pop | zoom | slide_up | slide_down | slide_left | slide_right", "t": 0, "dur": 0.4},
              "exit": {"type": "none | fade | pop | zoom | slide_*", "t": 3.5, "dur": 0.35},
              "image_edit": "لو اللي اتطلب تغيير في شكل العنصر نفسه (لون معين، لبس، شكل): اكتب التعديل هنا بالإنجليزي، وإلا سيبها فاضية"}],
  "notes": "اللي اتعمل بالعربي في جملة"
}"""


def patch_messages(sc: dict, instruction: str) -> list[dict]:
    rows = [{"id": L["id"], "name": L["name"], "box_center": [round((L["box"][0] + L["box"][2]) / 2 / sc["W"], 3),
                                                               round((L["box"][1] + L["box"][3]) / 2 / sc["H"], 3)],
             **{k: L[k] for k in ("visible", "dx", "dy", "scale", "rot", "opacity", "flip", "hue", "sat", "bright", "z", "anim", "enter", "exit")}}
            for L in sc["layers"]]
    text = (
        "أنت مساعد في استوديو موشن. المشهد عبارة عن خلفية وطبقات (كل عنصر صورة شفافة في مكانه الأصلي). "
        "عدّل إعدادات الطبقات عشان تنفّذ طلب المستخدم بالظبط، ومتغيّرش أي حاجة ما اتطلبتش.\n"
        "القواعد: dx وdy = إزاحة مركز العنصر عن مكانه الأصلي كنسبة من عرض وطول الشاشة (dx موجب = يمين، dy موجب = تحت). "
        "box_center = مكان مركز العنصر الأصلي كنسبة (0 لـ 1)، فلو عايز تودّيه لنقطة (x, y): dx = x − box_center[0]، dy = y − box_center[1]. "
        "scale = الحجم (1 = الأصلي). rot = الدوران بالدرجات. hue = تدوير اللون بالدرجات (−180 لـ 180)، sat = التشبع، bright = السطوع. "
        "z = الترتيب (الأكبر فوق). anim = حركة من الإعدادات الأساسية لقيم anim بين t0 وt1 بالثواني. "
        "enter / exit = دخول وخروج. الحركات بتطلع بصوتها لوحدها (sfx: auto).\n"
        "لو الطلب لون محدد أو تغيير شكل العنصر نفسه (مش مجرد تدوير لون)، اكتبه في image_edit بالإنجليزي.\n"
        f"مدة المشهد: {sc['duration']} ثانية.\nالطبقات دلوقتي:\n{json.dumps(rows, ensure_ascii=False)}\n\n"
        f"طلب المستخدم: {instruction}\n\n"
        "رجّع JSON بس فيه الطبقات اللي اتغيرت بس (بالـ id) بالقيم الجديدة، بالشكل ده:\n" + PATCH_FORMAT
    )
    return [{"role": "user", "content": text}]


def apply_patch(sc: dict, patch: dict) -> tuple[dict, list[tuple[str, str]], str]:
    """بيرجّع المشهد الجديد، وطلبات تعديل الصور [(id, التعديل)]، وملاحظة الموديل."""
    by_id = {L["id"]: L for L in sc["layers"]}
    edits = []
    for p in (patch or {}).get("layers") or []:
        if not isinstance(p, dict) or p.get("id") not in by_id:
            continue
        L = by_id[p["id"]]
        for k, v in p.items():
            if k in ("anim", "enter", "exit") and isinstance(v, dict):
                L[k] = {**L[k], **v}
            elif k in ("visible", "dx", "dy", "scale", "rot", "opacity", "flip", "hue", "sat", "bright", "z"):
                L[k] = v
        if str(p.get("image_edit") or "").strip():
            edits.append((L["id"], str(p["image_edit"]).strip()[:500]))
    if (patch or {}).get("duration"):
        sc["duration"] = patch["duration"]
    return clean(sc), edits, str((patch or {}).get("notes") or "")[:300]
