"""الموشن جرافيك المتركب: طبقات (صور عناصر وكلام) بتتحرك فوق فيديو اللقطة وتتطبع عليه بـ FFmpeg.

كل طبقة ليها: مكانها (x, y = نص الطبقة كنسبة من عرض وطول الفيديو)، حجمها، وقت ظهورها واختفائها
(بالثواني من أول اللقطة)، وحركة دخول وخروج وحركة مستمرة. الصور بتتقص من خلفيتها (cutout) قبل ما تتركب،
والكلام بيتكتب بـ libass (ASS) عشان العربي يطلع متشكّل صح.
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

from captions import FONTS, ass_color, ass_time, filter_path

IN_ANIMS = ("none", "fade", "pop", "zoom", "slide_up", "slide_down", "slide_left", "slide_right")
OUT_ANIMS = ("none", "fade", "pop", "zoom", "slide_up", "slide_down", "slide_left", "slide_right")
LOOPS = ("none", "float", "pulse")
DEFAULT_FONT = FONTS[0]["family"]


def _num(v, default: float, lo: float, hi: float) -> float:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return default
    return min(hi, max(lo, x)) if x == x else default


def clean_layers(layers, seconds: float, comp_ids: set[str]) -> list[dict]:
    """يظبط الطبقات اللي جاية من الموديل أو من الواجهة: القيم في حدودها والصور لمكونات موجودة."""
    out = []
    for i, x in enumerate(layers or []):
        if not isinstance(x, dict):
            continue
        kind = "text" if x.get("type") == "text" else "image"
        if kind == "image" and str(x.get("comp_id")) not in comp_ids:
            continue
        text = str(x.get("text") or "").strip()[:200]
        if kind == "text" and not text:
            continue
        start = _num(x.get("start"), 0, 0, max(0.0, seconds - 0.1))
        end = _num(x.get("end"), seconds, start + 0.1, max(seconds, start + 0.1))
        layer = {
            "id": str(x.get("id") or f"L{i + 1}")[:12], "type": kind, "start": round(start, 2), "end": round(end, 2),
            "x": round(_num(x.get("x"), 0.5, -0.2, 1.2), 3), "y": round(_num(x.get("y"), 0.5, -0.2, 1.2), 3),
            "in": x.get("in") if x.get("in") in IN_ANIMS else "fade",
            "out": x.get("out") if x.get("out") in OUT_ANIMS else "fade",
            "loop": x.get("loop") if x.get("loop") in LOOPS else "none",
            "in_dur": round(_num(x.get("in_dur"), 0.4, 0.05, 3), 2), "out_dur": round(_num(x.get("out_dur"), 0.3, 0.05, 3), 2),
            "note": str(x.get("note") or "")[:200],
        }
        if kind == "image":
            layer.update(comp_id=str(x["comp_id"]), w=round(_num(x.get("w"), 0.5, 0.03, 1.5), 3))
        else:
            layer.update(text=text, size=round(_num(x.get("size"), 0.045, 0.015, 0.2), 3),
                         color=_hex(x.get("color"), "#FFFFFF"), box=_hex(x.get("box"), "") if x.get("box") else "",
                         font=str(x.get("font") or DEFAULT_FONT)[:40], bold=bool(x.get("bold", True)))
        out.append(layer)
    return out[:20]


def _hex(v, default: str) -> str:
    m = re.fullmatch(r"#?([0-9a-fA-F]{6})", str(v or "").strip())
    return f"#{m.group(1).upper()}" if m else default


# ------------------------------------------------------------ قص خلفية الصورة

def _corner_rgba(ffmpeg: str, path: Path) -> tuple[int, int, int, int] | None:
    r = subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(path), "-vf", "crop=2:2:1:1,format=rgba",
                        "-frames:v", "1", "-f", "rawvideo", "-"], capture_output=True, timeout=30)
    return tuple(r.stdout[:4]) if len(r.stdout) >= 4 else None


def cutout(ffmpeg: str, src: Path, dst: Path, kind: str) -> Path:
    """صورة بخلفية شفافة. الشاشات (ui) بتفضل زي ما هي. الصور اللي شفافة أصلًا متتلمسش.
    غير كده: لون الركن هو لون الخلفية وبيتشال (ولو أخضر كروما بيتشال بقوة أكبر ومن غير ما يسيب أطراف خضرا)."""
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        return dst
    dst.parent.mkdir(parents=True, exist_ok=True)
    corner = _corner_rgba(ffmpeg, src)
    if kind == "ui" or not corner or corner[3] < 250:
        vf = "format=rgba"
    else:
        r, g, b, _ = corner
        greenish = g > 150 and r < 120 and b < 120
        sim = 0.3 if greenish else 0.1
        vf = f"format=rgba,colorkey=0x{r:02X}{g:02X}{b:02X}:{sim}:0.08" + (",despill=type=green" if greenish else "")
    subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-vf", vf, "-frames:v", "1", str(dst)],
                   check=True, capture_output=True, timeout=60)
    return dst


# ------------------------------------------------------------ تعبيرات الحركة (FFmpeg expressions)

def _p_in(L) -> str:
    return f"clip((t-{L['start']})/{L['in_dur']},0,1)"


def _p_out(L) -> str:
    return f"clip((t-({L['end']}-{L['out_dur']}))/{L['out_dur']},0,1)"


def _ease_out(p: str) -> str:
    return f"(1-pow(1-{p},3))"


def _back(p: str) -> str:  # easeOutBack: بيعدّي الحجم شوية ويرجع (إحساس pop)
    return f"(1+2.70158*pow({p}-1,3)+1.70158*pow({p}-1,2))"


def _scale_expr(L) -> str:
    parts = []
    if L["in"] == "pop":
        parts.append(_back(_p_in(L)))
    elif L["in"] == "zoom":
        parts.append(f"(0.6+0.4*{_ease_out(_p_in(L))})")
    if L["out"] == "pop":
        parts.append(f"(1-pow({_p_out(L)},3))")
    elif L["out"] == "zoom":
        parts.append(f"(1-0.4*pow({_p_out(L)},3))")
    if L["loop"] == "pulse":
        parts.append(f"(1+0.04*sin(2*PI*(t-{L['start']})/1.2))")
    return "*".join(parts) or "1"


SLIDE = {"slide_up": (0, 1), "slide_down": (0, -1), "slide_left": (1, 0), "slide_right": (-1, 0)}


def _offset_expr(L, axis: int, size: str) -> str:
    """إزاحة الطبقة: الدخول من بره مكانها والخروج لبره، بنسبة 0.25 من الشاشة."""
    terms = []
    if L["in"] in SLIDE and SLIDE[L["in"]][axis]:
        terms.append(f"{SLIDE[L['in']][axis]}*0.25*{size}*(1-{_ease_out(_p_in(L))})")
    if L["out"] in SLIDE and SLIDE[L["out"]][axis]:
        terms.append(f"{-SLIDE[L['out']][axis]}*0.25*{size}*pow({_p_out(L)},3)")
    if axis == 1 and L["loop"] == "float":
        terms.append(f"0.012*{size}*sin(2*PI*(t-{L['start']})/2)")
    return "+".join(terms) or "0"


def _fades(L) -> str:
    f = []
    if L["in"] in ("fade", "zoom") or L["in"] in SLIDE:
        f.append(f"fade=t=in:st={L['start']}:d={L['in_dur']}:alpha=1")
    if L["out"] in ("fade", "zoom") or L["out"] in SLIDE:
        f.append(f"fade=t=out:st={max(L['start'], L['end'] - L['out_dur']):.2f}:d={L['out_dur']}:alpha=1")
    return ("," + ",".join(f)) if f else ""


# ------------------------------------------------------------ الكلام (ASS)

def build_ass(layers: list[dict], W: int, H: int, total: float) -> str:
    lines = ["[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}", "WrapStyle: 0",
             "ScaledBorderAndShadow: yes", "", "[V4+ Styles]",
             "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
             "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, "
             "MarginR, MarginV, Encoding"]
    events = []
    for k, L in enumerate(layers):
        size = max(10, int(L["size"] * H))
        box = bool(L.get("box"))
        lines.append(f"Style: T{k},{L['font']},{size},{ass_color(L['color'])},{ass_color(L['color'])},"
                     f"{ass_color(L['box'] or '#000000', 0 if box else 0x60)},&H80000000,{-1 if L['bold'] else 0},0,0,0,"
                     f"100,100,0,0,{3 if box else 1},{int(size * 0.45) if box else max(2, size // 14)},0,5,20,20,0,-1")
        x, y = int(L["x"] * W), int(L["y"] * H)
        dur = int((L["end"] - L["start"]) * 1000)
        ti, to = int(L["in_dur"] * 1000), int(L["out_dur"] * 1000)
        tags = []
        if L["in"] in SLIDE:
            dx, dy = SLIDE[L["in"]]
            tags.append(f"\\move({x + int(dx * 0.25 * W)},{y + int(dy * 0.25 * H)},{x},{y},0,{ti})")
        else:
            tags.append(f"\\pos({x},{y})")
        fin = ti if (L["in"] in ("fade", "zoom") or L["in"] in SLIDE) else 0
        fout = to if L["out"] not in ("none", "pop") else 0
        if fin or fout:
            tags.append(f"\\fad({fin},{fout})")
        if L["in"] == "pop":
            tags.append(f"\\fscx0\\fscy0\\t(0,{int(ti * 0.7)},\\fscx112\\fscy112)\\t({int(ti * 0.7)},{ti},\\fscx100\\fscy100)")
        elif L["in"] == "zoom":
            tags.append(f"\\fscx60\\fscy60\\t(0,{ti},\\fscx100\\fscy100)")
        if L["out"] in ("pop", "zoom"):
            tags.append(f"\\t({max(0, dur - to)},{dur},\\fscx{0 if L['out'] == 'pop' else 60}\\fscy{0 if L['out'] == 'pop' else 60})")
        text = L["text"].replace("\\", "").replace("{", "(").replace("}", ")").replace("\n", "\\N")
        events.append(f"Dialogue: {k},{ass_time(L['start'])},{ass_time(min(total, L['end']))},T{k},,0,0,0,,{{{''.join(tags)}}}{text}")
    return "\n".join(lines + ["", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"] + events) + "\n"


# ------------------------------------------------------------ الطباعة على الفيديو

def video_size(ffmpeg: str, path: Path) -> tuple[int, int]:
    err = subprocess.run([ffmpeg, "-hide_banner", "-i", str(path)], capture_output=True, text=True, timeout=30).stderr
    m = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", err)
    return (int(m.group(1)), int(m.group(2))) if m else (720, 1280)


def render(ffmpeg: str, base: Path, layers: list[dict], images: dict[str, Path], out: Path, duration: float,
           fonts_dir: Path, work: Path) -> None:
    """images: comp_id → صورة مقصوصة (PNG شفاف). بيطلع فيديو بنفس مقاس ومدة الأساس، والصوت لو موجود."""
    W, H = video_size(ffmpeg, base)
    inputs = ["-i", str(base)]
    chain, last = [], "[0:v]"
    imgs = [L for L in layers if L["type"] == "image" and L["comp_id"] in images]
    for k, L in enumerate(imgs, start=1):
        inputs += ["-loop", "1", "-t", f"{duration:.2f}", "-i", str(images[L["comp_id"]])]
        bw = max(2, int(L["w"] * W))
        sc = _scale_expr(L)
        scale = (f"scale=w='max(2,trunc({bw}*({sc})/2)*2)':h=-2:eval=frame" if sc != "1" else f"scale={bw}:-2")
        chain.append(f"[{k}:v]format=rgba,{scale}{_fades(L)}[l{k}]")
        x = f"{L['x']}*W-w/2+({_offset_expr(L, 0, 'W')})"
        y = f"{L['y']}*H-h/2+({_offset_expr(L, 1, 'H')})"
        chain.append(f"{last}[l{k}]overlay=x='{x}':y='{y}':eval=frame:enable='between(t,{L['start']},{L['end']})'[v{k}]")
        last = f"[v{k}]"
    texts = [L for L in layers if L["type"] == "text"]
    if texts:
        ass = work / f"{out.stem}.ass"
        ass.write_text(build_ass(texts, W, H, duration), encoding="utf-8")
        chain.append(f"{last}subtitles=filename='{filter_path(ass)}':fontsdir='{filter_path(fonts_dir)}'[vt]")
        last = "[vt]"
    chain.append(f"{last}format=yuv420p[vout]")
    cmd = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", *inputs, "-filter_complex", ";".join(chain),
           "-map", "[vout]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
           "-c:a", "copy", "-t", f"{duration:.2f}", "-movflags", "+faststart", str(out)]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if r.returncode != 0:
        raise RuntimeError(f"تركيب الموشن فشل: {(r.stderr or '')[-400:]}")


# ------------------------------------------------------------ خطة الطبقات بالموديل

LAYERS_FORMAT = """{
  "layers": [
    {"type": "image", "comp_id": "id مكون من القايمة", "start": 0.3, "end": 3.2,
     "x": 0.5, "y": 0.72, "w": 0.6,
     "in": "pop | fade | zoom | slide_up | slide_down | slide_left | slide_right | none", "in_dur": 0.4,
     "out": "fade | pop | zoom | slide_* | none", "out_dur": 0.3, "loop": "none | float | pulse",
     "note": "ليه الطبقة دي وإيه اللي بتقابله في الأصلي (بالعربي)"},
    {"type": "text", "text": "كلام قصير بالعربي", "start": 0.5, "end": 2.5, "x": 0.5, "y": 0.2, "size": 0.05,
     "color": "#FFFFFF", "box": "#57B8AF أو فاضي", "in": "slide_up", "out": "fade", "loop": "none"}
  ]
}"""


def layers_messages(header_txt: str, shot: dict, comps: list[dict], orig: dict | None, with_video: bool) -> list[dict]:
    rows = "\n".join(f"- id={c['id']} ({c.get('kind')}) {c.get('name')}: {c.get('description', '')} | حركته: {c.get('animation', '')}"
                     for c in comps)
    text = (
        "أنت موشن ديزاينر. هنركّب الموشن جرافيك كطبقات فوق فيديو لقطة إعلان (الفيديو نفسه فيه الناس والمكان بس). "
        + (f"اتفرج على الإعلان الأصلي المرفق وركّز في المشهد الأصلي من {orig.get('start', 0):.1f} لـ {orig.get('end', 0):.1f} ثانية، "
           "وانقل الموشن جرافيك بتاعه بالظبط: نفس أماكن العناصر على الشاشة ونفس توقيت دخولها وخروجها ونفس نوع حركتها، "
           "بمحتوى كوتشي.\n" if with_video and orig else "")
        + f"\nراس الإعلان:\n{header_txt}\n\n"
        f"لقطة كوتشي ({shot.get('seconds')} ثانية): {shot.get('visual', '')}\n"
        f"الكلام على الشاشة: {shot.get('on_screen_text', '') or '—'}\nالموشن المطلوب: {shot.get('motion_notes', '') or '—'}\n"
        + (f"الموشن في الأصلي (من التحليل): {orig.get('motion_graphics', '')}\n" if orig and orig.get("motion_graphics") else "")
        + f"\nالعناصر المتاحة كصور (استخدم الـ id بالظبط):\n{rows or '—'}\n\n"
        "القواعد: الأوقات بالثواني من أول اللقطة (0 لـ مدة اللقطة). x وy = مكان نص العنصر كنسبة من عرض وطول الشاشة (0 لـ 1). "
        "w = عرض الصورة كنسبة من عرض الشاشة. size = حجم الكلام كنسبة من طول الشاشة. متغطيش وش الشخص. "
        "الكلام القصير (عناوين، أرقام، CTA) يبقى طبقة text. متستخدمش الشخصيات أو الخلفيات كطبقات. "
        "لو اللقطة مفيهاش موشن جرافيك رجّع layers فاضية.\n"
        f"رجّع JSON بس بالشكل ده:\n{LAYERS_FORMAT}"
    )
    return [{"role": "user", "content": text}]


def mock_layers(shot: dict, comps: list[dict]) -> dict:
    sec = float(shot.get("seconds") or 4)
    layers = [{"type": "image", "comp_id": c["id"], "start": 0.3 + i * 0.4, "end": sec - 0.2, "x": 0.5, "y": 0.68 - i * 0.2,
               "w": 0.55, "in": "pop", "out": "fade", "loop": "float"} for i, c in enumerate(comps[:2])]
    layers.append({"type": "text", "text": "كوتشي معاك", "start": 0.6, "end": sec - 0.3, "x": 0.5, "y": 0.15, "size": 0.05,
                   "color": "#FFFFFF", "box": "#57B8AF", "in": "slide_up", "out": "fade"})
    return {"layers": layers}
