"""🏷️ ختم اللوجو في آخر فيديوهات القوالب: نسخة من لوجو العميل بنفس ستايل القالب (مرسومة مرة واحدة لكل ستايل)،
وكارت قفلة صغير (آخر فريم مغبّش وفاتح، واللوجو بيطلع عليه) بيتلزق في آخر الفيديو."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

# الستايلات اللي ليها رسم (نفس ستايلات مكتبة العناصر). أي قالب مش منهم بياخد اللوجو الأصلي زي ما هو.
STYLES = {
    "crayon": "children's wax crayon drawing on paper: waxy textured strokes, slightly rough edges, bright crayon colors",
    "ink": "traditional Chinese ink wash painting (sumi-e): black ink brush strokes of varied thickness, soft grey washes, mostly monochrome",
    "oneline": "a single continuous thin black line drawing (one-line art), minimal, no fills",
    "riso": "risograph print with three transparent overlapping inks (blue #0078BF, fluorescent pink #FF48B0, yellow #FFE800), coarse halftone dots, slight misregistration",
    "sketch": "pencil sketch on paper: graphite hatching and loose construction lines, monochrome grey",
    "toon": "1950s vintage cartoon advertisement style: bold rounded shapes, flat offset print colors (teal, coral, mustard, cream), misregistered black outlines",
    "ukiyo": "Japanese ukiyo-e woodblock print: flat traditional colors, bold black carved outlines, subtle paper grain",
    "watercolor": "loose watercolor painting: soft transparent washes, pigment blooms and wet edges, light paper texture",
}
LABELS = {"crayon": "ألوان شمع", "ink": "حبر صيني", "oneline": "خط واحد", "riso": "طباعة ريزو", "sketch": "رسم بالقلم",
          "toon": "كرتون قديم", "ukiyo": "طباعة يابانية", "watercolor": "ألوان مائية"}


# 🎨 قوالب مالهاش رسم في مكتبة العناصر: ليها ستايل لوجو خاص بيها، بيترسم بس لما العميل يطلبه من صفحة القوالب
#   (النسخ الـ٨ اللي فوق بس هي اللي بتترسم لوحدها أول ما اللوجو يترفع).
EXTRA = {
    "pixel": "8-bit retro video game pixel art: chunky square pixels, limited bright palette, no anti-aliasing",
    "blueprint": "technical blueprint drawing: thin white construction lines and dimension marks on a deep blue grid paper",
    "glass": "stained glass window: bold dark lead lines separating glowing translucent colored glass pieces",
    "screen": "silkscreen poster print: two or three flat opaque ink layers, slight registration offset, ink texture",
    "deco": "1920s Art Deco: gold geometric line work, symmetry and sunburst rays on glossy black",
    "holo": "holographic projection: glowing cyan light lines and scanlines, translucent wireframe on a dark background",
    "impasto": "thick impasto oil painting: heavy palette-knife strokes with raised paint edges and rich color",
    "shadow": "shadow puppet theatre: translucent colored leather cut-out with punched holes, backlit, dark outline",
    "ascii": "amber monochrome ASCII art on an old computer screen: built from text characters only",
    "dossier": "vintage case-file print: rubber-stamp ink, halftone dots and flat spot colors on cream archive paper",
    "woodcut": "woodcut relief print: bold black carved strokes with gouge marks and one flat accent color",
    "redcut": "red paper cut-out art: the shape is cut from one sheet of red paper, holes where light passes",
    "onehero": "clean modern 3D render: soft studio light, smooth rounded materials, gentle shadows",
}
EXTRA_LABELS = {"pixel": "بكسل", "blueprint": "مخطط هندسي", "glass": "زجاج معشّق", "screen": "طباعة حريرية", "deco": "آرت ديكو",
                "holo": "هولوجرام", "impasto": "زيت سميك", "shadow": "خيال الظل", "ascii": "حروف الشاشة", "dossier": "ملف أرشيف",
                "woodcut": "حفر خشب", "redcut": "قص ورق", "onehero": "مجسّم"}
ALL = {**STYLES, **EXTRA}
ALL_LABELS = {**LABELS, **EXTRA_LABELS}


def prompt_like() -> str:
    """باقي القوالب (مالهاش ستايل مكتوب): المرجع صورة من القالب نفسه (الصورة التانية)."""
    return ("Redraw the exact logo from the FIRST image in the visual style of the SECOND image (a frame from an animated video): "
            "the same art medium, line quality, texture, color palette and rendering. Keep exactly the same shapes, layout, proportions, letters and text "
            "of the logo (same spelling, same language, nothing added or removed). Do not copy anything else from the second image. "
            "Centered on a plain flat pure white background, nothing else in the image, no extra text, no frame, no shadow.")


def prompt(style: str) -> str:
    return ("Redraw this exact logo in a new art style. Keep exactly the same shapes, layout, proportions, letters and text "
            "(same spelling, same language, nothing added or removed). Only the rendering changes to: "
            f"{ALL[style]}. Centered on a plain flat pure white background, nothing else in the image, no extra text, no frame, no shadow.")


def style_of(mid: str, index: Path) -> str | None:
    """ستايل القالب من خريطة مكتبة العناصر (القالب نفسه بيتكتب في المكتبة بستايله)."""
    try:
        s = (json.loads(index.read_text("utf-8")).get("tpl") or {}).get(mid)
    except (OSError, ValueError):
        return None
    if s in STYLES:
        return s
    x = mid[2:] if mid.startswith("t-") else ""
    if x in EXTRA:
        return x
    return f"x-{mid}" if re.fullmatch(r"[a-z0-9-]+", mid) and not mid.startswith("b-") else None   # باقي القوالب: على شكل القالب نفسه


def file_for(folder: Path, src: Path, style: str) -> Path:
    """النسخة مربوطة بملف اللوجو نفسه: لو اتغيّر اللوجو، النسخ القديمة ماتتستخدمش."""
    return folder / f"logost-{style}-{src.stem}.png"


def stamp(clip: Path, logo: Path, ffmpeg: str, secs: float = 2.0) -> bool:
    """يلزق كارت القفلة في آخر الفيديو (بدّل نفس الملف). يرجع False لو فشل (والفيديو يفضل زي ما هو)."""
    tmp_last, out = clip.with_name("stamp-last.png"), clip.with_name("stamp-out.mp4")
    try:
        probe = subprocess.run([ffmpeg, "-hide_banner", "-i", str(clip)], capture_output=True, text=True, timeout=60).stderr
        m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe)
        wh = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", probe)
        if not m or not wh:
            return False
        dur = int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])
        w, h = int(wh[1]), int(wh[2])
        has_a = "Audio:" in probe
        subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-sseof", "-0.2", "-i", str(clip), "-frames:v", "1", "-update", "1", str(tmp_last)],
                       check=True, capture_output=True, timeout=60)
        fade, lw, lh = 0.4, int(w * 0.6), int(h * 0.32)
        off = max(0.0, dur - fade)
        fc = (f"[1:v]scale={w}:{h},setsar=1,boxblur=24:2,eq=brightness=0.28:saturation=0.5,fps=30,format=yuv420p[bg];"
              f"[2:v]scale={lw}:{lh}:force_original_aspect_ratio=decrease,format=rgba,fade=t=in:st=0.3:d=0.5:alpha=1[lg];"
              f"[bg][lg]overlay=x=(W-w)/2:y='(H-h)/2+50*max(0,1-(t-0.3)/0.6)':eval=frame,format=yuv420p,settb=AVTB[end];"
              f"[0:v]fps=30,scale={w}:{h},setsar=1,format=yuv420p,settb=AVTB[main];"
              f"[main][end]xfade=transition=fade:duration={fade}:offset={off:.3f}[v]")
        total = off + secs
        args = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(clip),
                "-loop", "1", "-t", f"{secs}", "-i", str(tmp_last), "-loop", "1", "-t", f"{secs}", "-i", str(logo)]
        if has_a:
            fc += f";[0:a]apad,atrim=end={total:.3f},afade=t=out:st={max(0.0, total - secs):.3f}:d={secs}[a]"
            maps = ["-map", "[v]", "-map", "[a]", "-c:a", "aac", "-b:a", "192k"]
        else:
            maps = ["-map", "[v]"]
        subprocess.run(args + ["-filter_complex", fc, *maps, "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
                               "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)], check=True, capture_output=True, timeout=600)
        out.replace(clip)
        return True
    except Exception as exc:  # noqa: BLE001 — الختم إضافة: لو فشل الفيديو يطلع من غيره
        print(f"[stamp] {clip}: {exc}", flush=True)
        out.unlink(missing_ok=True)
        return False
    finally:
        tmp_last.unlink(missing_ok=True)


# 🧼 تجهيز اللوجو وقت الرفع: تكبير لو صغير/ضعيف، وشيل الخلفية (لو سادة بالكود ببلاش، ولو مش سادة بموديل)
MIN_SIDE = 1000
UPSCALER = "tencent/image/upscaler"            # بيكبّر ×2
BG_REMOVER = "midjourney/v8.2/remove-background"


def needs_upscale(path: Path) -> bool:
    from PIL import Image
    with Image.open(path) as im:
        return max(im.size) < MIN_SIDE


def plain_background(path: Path) -> bool:
    """أطراف الصورة لون واحد تقريبًا؟ (يبقى الكود يشيلها من غير موديل)"""
    import numpy as np
    from PIL import Image
    with Image.open(path) as im:
        a = np.asarray(im.convert("RGB")).astype(np.float32)
    b = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    return float(np.sqrt(((b - np.median(b, axis=0)) ** 2).sum(-1)).mean()) < 12.0
