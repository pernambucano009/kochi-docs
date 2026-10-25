"""🎬 أول فيديو: أدوات اللوجو والأوترو (بدون أي خدمة خارجية، فمفيش نقاط بتتصرف عليها).
- cutout: شيل خلفية اللوجو (اللوجوهات غالبًا على خلفية سادة: بنشيل اللون اللي على الأطراف وبنسيب الشكل بحواف ناعمة).
- palette: ألوان العلامة من اللوجو (للفرع «الشكل» في العقل).
- outro: أوترو قصير من اللوجو (أو اسم العلامة لو مفيش لوجو) على لون العلامة.
- brand_finish: اللوجو في ركن الفيديو + الأوترو في آخره."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, features

try:
    import cv2
except Exception:  # noqa: BLE001
    cv2 = None


def _border(a: np.ndarray) -> np.ndarray:
    return np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])


def has_alpha(img: Image.Image) -> bool:
    """اللوجو شفاف أصلًا (PNG من غير خلفية)؟"""
    if img.mode not in ("RGBA", "LA", "P"):
        return False
    a = np.asarray(img.convert("RGBA"))[..., 3]
    return float((_border(a) < 250).mean()) > 0.5


def cutout(src: Path, dst: Path) -> dict:
    """يشيل الخلفية السادة اللي حوالين اللوجو، ويقص الفراغ الزيادة. يرجع {ok, already}."""
    img = Image.open(src)
    img.load()
    if has_alpha(img):
        out = img.convert("RGBA")
        already = True
    else:
        rgb = np.asarray(img.convert("RGB")).astype(np.float32)
        h, w = rgb.shape[:2]
        bg = np.median(_border(rgb), axis=0)
        dist = np.sqrt(((rgb - bg) ** 2).sum(-1))
        lo, hi = 22.0, 70.0
        near = (dist < hi).astype(np.uint8)
        # الخلفية = اللون القريب من لون الأطراف «والمتصل بيها» بس (عشان الأبيض اللي جوه اللوجو مايتشالش)
        keep = np.zeros((h, w), bool)
        if cv2 is not None:
            n, lab = cv2.connectedComponents(near, connectivity=4)
            edge = set(np.unique(_border(lab)).tolist()) - {0}
            keep = np.isin(lab, list(edge)) if edge else keep
        else:
            keep = near.astype(bool)
        alpha = np.where(keep, np.clip((dist - lo) / (hi - lo), 0, 1), 1.0)
        out = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), "RGBA")
        already = False
    box = out.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox()
    if box:
        pad = max(4, int(max(box[2] - box[0], box[3] - box[1]) * 0.04))
        box = (max(0, box[0] - pad), max(0, box[1] - pad), min(out.width, box[2] + pad), min(out.height, box[3] + pad))
        out = out.crop(box)
    if max(out.size) > 1200:
        out.thumbnail((1200, 1200), Image.LANCZOS)
    out.save(dst, "PNG")
    return {"ok": True, "already": already}


def _hex(c) -> str:
    return "#%02X%02X%02X" % tuple(int(x) for x in c[:3])


def palette(path: Path, n: int = 3) -> list[str]:
    """أهم ألوان اللوجو (من غير الأبيض والأسود والرمادي، إلا لو اللوجو كله كده)."""
    img = Image.open(path).convert("RGBA")
    img.thumbnail((160, 160))
    px = np.asarray(img).reshape(-1, 4)
    px = px[px[:, 3] > 128][:, :3]
    if not len(px):
        return []
    q = Image.fromarray(px.reshape(1, -1, 3).astype(np.uint8), "RGB").quantize(16, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[:48]
    counts = sorted(q.getcolors() or [], reverse=True)
    cols, greys = [], []
    total = sum(c for c, _ in counts) or 1
    for cnt, idx in counts:
        c = pal[idx * 3: idx * 3 + 3]
        if cnt < total * 0.03:   # ألوان الحواف الناعمة مش ألوان العلامة
            continue
        if len(c) < 3:
            continue
        mx, mn = max(c), min(c)
        (greys if mx - mn < 28 else cols).append(c)
    pick = []
    for c in cols + greys:
        if all(sum((a - b) ** 2 for a, b in zip(c, p)) > 2200 for p in pick):
            pick.append(c)
        if len(pick) >= n:
            break
    return [_hex(c) for c in pick]


def _rgb(h: str) -> tuple[int, int, int]:
    h = (h or "").lstrip("#")
    try:
        return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    except (ValueError, IndexError):
        return 229, 97, 62


def _lum(c) -> float:
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def outro_colors(colors: list[str]) -> tuple[tuple, tuple]:
    """خلفية الأوترو من لون العلامة (فاتح أو غامق حسب اللوجو)، ولون الكلام اللي يبان عليها."""
    main = _rgb(colors[0]) if colors else (24, 23, 24)
    if _lum(main) > 200:   # اللوجو فاتح: خلفية غامقة
        return (18, 18, 20), (245, 245, 245)
    # خلفية فاتحة جدًا بلمسة من لون العلامة، فاللوجو نفسه يبان بألوانه، والاسم بلون العلامة
    tint = tuple(int(c * 0.1 + 255 * 0.9) for c in main)
    return tint, (main if _lum(main) < 150 else (24, 23, 24))


def _ease(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def outro(ffmpeg: str, dst: Path, logo: Path | None, name: str, colors: list[str], font: Path,
          size: tuple[int, int] = (1080, 1920), dur: float = 2.6, fps: int = 30) -> Path:
    """أوترو بسيط: اللوجو بيكبر بهدوء ويظهر، واسم العلامة تحته. لو مفيش لوجو: الاسم لوحده كبير."""
    W, H = size
    bg, ink = outro_colors(colors)
    logo_img = None
    if logo and logo.exists():
        logo_img = Image.open(logo).convert("RGBA")
        logo_img.thumbnail((int(W * 0.56), int(H * 0.26)), Image.LANCZOS)
    rtl = features.check("raqm")
    kw = {"direction": "rtl", "language": "ar"} if rtl and any("؀" <= ch <= "ۿ" for ch in name) else {}
    fsize = 64 if logo_img else 118
    fnt = ImageFont.truetype(str(font), fsize)
    # الخلفية: لون العلامة مع نور خفيف في النص
    yy, xx = np.mgrid[0:H, 0:W]
    glow = np.clip(1 - np.sqrt(((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H * 0.45) / (H * 0.5)) ** 2), 0, 1)[..., None]
    base = np.array(bg, np.float32) * (0.93 + 0.08 * glow) if _lum(bg) > 200 else np.array(bg, np.float32) * (0.82 + 0.3 * glow)
    base = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB")
    n = int(dur * fps)
    proc = subprocess.Popen([ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
                             "-f", "lavfi", "-t", f"{dur}", "-i", "anullsrc=r=48000:cl=stereo",
                             "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", str(dst)],
                            stdin=subprocess.PIPE)
    try:
        for i in range(n):
            t = i / fps
            fr = base.copy()
            k = _ease(t / 0.9)
            cy = H * 0.45
            if logo_img:
                s = 0.86 + 0.14 * k
                lw, lh = max(1, int(logo_img.width * s)), max(1, int(logo_img.height * s))
                li = logo_img.resize((lw, lh), Image.LANCZOS)
                a = li.getchannel("A").point(lambda v, k=k: int(v * k))
                li.putalpha(a)
                fr.paste(li, (int((W - lw) / 2), int(cy - lh / 2 - 40 * (1 - k))), li)
                ty = cy + logo_img.height / 2 + 70
            else:
                ty = cy
            if name:
                kt = _ease((t - 0.35) / 0.8)
                lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                d = ImageDraw.Draw(lay)
                d.text((W / 2, ty + 30 * (1 - kt)), name, font=fnt, fill=(*ink, int(255 * kt)), anchor="mm", **kw)
                fr.paste(lay, (0, 0), lay)
            fade = min(1.0, (dur - t) / 0.25)
            if fade < 1:
                fr = Image.blend(Image.new("RGB", (W, H), (0, 0, 0)), fr, max(0.0, fade))
            proc.stdin.write(fr.tobytes())
    finally:
        proc.stdin.close()
        proc.wait()
    if proc.returncode != 0 or not dst.exists():
        raise RuntimeError("الأوترو لم يُصنع")
    return dst


def brand_finish(ffmpeg: str, src: Path, dst: Path, logo: Path | None, outro_path: Path | None) -> Path:
    """اللوجو صغير في الركن فوق (طول الفيديو) + الأوترو في الآخر، بنفس المقاس."""
    probe = subprocess.run([ffmpeg, "-i", str(src)], capture_output=True, text=True).stderr
    m = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", probe)
    W, H = (int(m.group(1)), int(m.group(2))) if m else (1080, 1920)
    W, H = W - W % 2, H - H % 2
    has_audio = "Audio:" in probe
    inputs, chains = ["-i", str(src)], []
    v = "[0:v]"
    chains.append(f"{v}scale={W}:{H},setsar=1,fps=30,format=yuv420p[base]")
    cur = "[base]"
    idx = 1
    if logo and logo.exists():
        inputs += ["-i", str(logo)]
        lw = int(min(W, H) * 0.16)
        chains.append(f"[{idx}:v]scale={lw}:-1,format=rgba,colorchannelmixer=aa=0.9[lg]")
        m_ = int(min(W, H) * 0.045)
        chains.append(f"{cur}[lg]overlay=W-w-{m_}:{m_}[vl]")
        cur = "[vl]"
        idx += 1
    a_main = "[0:a]" if has_audio else None
    if not has_audio:
        inputs += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
        a_main = f"[{idx}:a]"
        idx += 1
    if outro_path and outro_path.exists():
        inputs += ["-i", str(outro_path)]
        chains.append(f"[{idx}:v]scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[ov]")
        chains.append(f"{a_main}aresample=48000,aformat=channel_layouts=stereo[a0]")
        chains.append(f"[{idx}:a]aresample=48000,aformat=channel_layouts=stereo[a1]")
        chains.append(f"{cur}[a0][ov][a1]concat=n=2:v=1:a=1[vo][ao]")
        cur, aout = "[vo]", "[ao]"
    else:
        chains.append(f"{a_main}aresample=48000[ao]")
        aout = "[ao]"
    cmd = [ffmpeg, "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(chains), "-map", cur, "-map", aout,
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart"]
    if not (outro_path and outro_path.exists()):   # بدون أوترو: الصوت الصامت لازم يقف مع الفيديو
        cmd.append("-shortest")
    cmd.append(str(dst))
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not dst.exists():
        raise RuntimeError(f"تركيب اللوجو والأوترو فشل: {r.stderr[-300:]}")
    return dst
