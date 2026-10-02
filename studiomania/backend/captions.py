"""الكابشن: تحويل كلام التعليق الصوتي لملف ASS بيتكتب على الفيديو بـ FFmpeg (libass).

الخطوط العربي في فولدر fonts متجهزة بـ tools/prepare_fonts.py عشان تتكتب صح من غير مربعات.
"""

import re
from pathlib import Path

WIDTH, HEIGHT = 1080, 1920

FONTS = [
    {"family": "SM Tajawal", "label": "تجوال", "file": "SM-Tajawal.ttf"},
    {"family": "SM Almarai", "label": "المراعي", "file": "SM-Almarai.ttf"},
    {"family": "SM Cairo", "label": "القاهرة", "file": "SM-Cairo.ttf"},
    {"family": "SM Lalezar", "label": "لاله‌زار (عريض)", "file": "SM-Lalezar.ttf"},
    {"family": "SM Changa", "label": "تشانجا", "file": "SM-Changa.ttf"},
    {"family": "SM Plex", "label": "بليكس", "file": "SM-Plex.ttf"},
    {"family": "SM Kufi", "label": "كوفي", "file": "SM-Kufi.ttf"},
]

# كل تيمبليت = إعدادات جاهزة، وأي حاجة فيها تقدر تغيّرها
TEMPLATES = {
    "tiktok": {
        "label": "تيك توك (كلمة ملوّنة)", "font": "SM Tajawal", "size": 100, "y": 68, "words": 3,
        "color": "#FFFFFF", "highlight": "#FFD400", "highlight_on": True, "box": False, "box_color": "#000000", "pop": False,
    },
    "pop": {
        "label": "بوب (كلمة كلمة)", "font": "SM Lalezar", "size": 130, "y": 62, "words": 1,
        "color": "#FFFFFF", "highlight": "#FFFFFF", "highlight_on": False, "box": False, "box_color": "#000000", "pop": True,
    },
    "classic": {
        "label": "ترجمة عادية", "font": "SM Almarai", "size": 62, "y": 86, "words": 7,
        "color": "#FFFFFF", "highlight": "#FFFFFF", "highlight_on": False, "box": True, "box_color": "#000000", "pop": False,
    },
    "box": {
        "label": "بوكس ملوّن", "font": "SM Cairo", "size": 88, "y": 72, "words": 3,
        "color": "#111111", "highlight": "#FF6B2C", "highlight_on": True, "box": True, "box_color": "#FFD400", "pop": False,
    },
    "kochi": {
        "label": "كوتشي", "font": "SM Changa", "size": 104, "y": 70, "words": 2,
        "color": "#FFFFFF", "highlight": "#80DFCC", "highlight_on": True, "box": False, "box_color": "#000000", "pop": True,
    },
}
DEFAULT_TEMPLATE = "kochi"


def style_for(settings: dict) -> dict:
    """يدمج التيمبليت مع التعديلات اللي المستخدم عملها."""
    base = dict(TEMPLATES.get(settings.get("template") or DEFAULT_TEMPLATE, TEMPLATES[DEFAULT_TEMPLATE]))
    for k in ("font", "size", "y", "words", "color", "highlight", "highlight_on", "box", "box_color", "pop"):
        if settings.get(k) is not None:
            base[k] = settings[k]
    if base["font"] not in {f["family"] for f in FONTS}:
        base["font"] = FONTS[0]["family"]
    base["size"] = max(30, min(200, int(base["size"])))
    base["y"] = max(5, min(95, float(base["y"])))
    base["words"] = max(1, min(10, int(base["words"])))
    return base


def ass_color(hex_color: str, alpha: int = 0) -> str:
    m = re.fullmatch(r"#?([0-9a-fA-F]{6})", hex_color or "")
    rgb = m.group(1) if m else "FFFFFF"
    r, g, b = rgb[0:2], rgb[2:4], rgb[4:6]
    return f"&H{alpha:02X}{b}{g}{r}".upper()


def ass_time(t: float) -> str:
    t = max(0.0, t)
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def clean(word: str) -> str:
    # الأقواس والشرطة المايلة ليهم معنى خاص في ASS، والإيموجي مش موجود في الخطوط
    word = re.sub(r"[{}\\]", "", word)
    return "".join(ch for ch in word if ord(ch) < 0x2190 or 0xFB50 <= ord(ch) <= 0xFEFF).strip()


def chunk_words(words: list[dict], per_chunk: int) -> list[list[dict]]:
    """يقسم الكلام لمجموعات، ويبدأ مجموعة جديدة لو فيه سكتة طويلة أو نهاية جملة."""
    chunks, cur = [], []
    for i, w in enumerate(words):
        if cur and (len(cur) >= per_chunk or w["s"] - cur[-1]["e"] > 0.7):
            chunks.append(cur)
            cur = []
        cur.append(w)
        if per_chunk > 3 and re.search(r"[.!?؟،,]$", w["w"]) and i + 1 < len(words):
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    return chunks


def build_ass(words: list[dict], settings: dict, total: float) -> str:
    """words: [{"w": كلمة, "s": بداية, "e": نهاية}] بالثواني على تايم لاين الفيديو النهائي."""
    st = style_for(settings)
    words = [dict(w, w=clean(w["w"])) for w in words if clean(w.get("w", "")) and w["s"] < total]
    border = 3 if st["box"] else 1
    outline = 14 if st["box"] else max(3, st["size"] // 16)
    outline_color = ass_color(st["box_color"], 0x20 if st["box"] else 0)
    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {WIDTH}",
        f"PlayResY: {HEIGHT}",
        "WrapStyle: 0",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
        "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, "
        "MarginR, MarginV, Encoding",
        f"Style: Cap,{st['font']},{st['size']},{ass_color(st['color'])},{ass_color(st['color'])},{outline_color},"
        f"&H80000000,0,0,0,0,100,100,0,0,{border},{outline},{0 if st['box'] else 2},5,60,60,0,-1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    pos = f"\\pos({WIDTH // 2},{int(HEIGHT * st['y'] / 100)})"
    pop = "\\fscx118\\fscy118\\t(0,120,\\fscx100\\fscy100)" if st["pop"] else ""
    hl, base = ass_color(st["highlight"]), ass_color(st["color"])
    chunks = chunk_words(words, st["words"])
    for ci, chunk in enumerate(chunks):
        start = chunk[0]["s"]
        nxt = chunks[ci + 1][0]["s"] if ci + 1 < len(chunks) else None
        end = chunk[-1]["e"] + 0.25
        if nxt is not None:
            end = min(max(end, chunk[-1]["e"]), nxt)
        end = min(end, total)
        if end <= start:
            continue
        if st["highlight_on"] and len(chunk) > 1:
            # نفس الجملة بتتكرر، وكل مرة كلمة مختلفة ملوّنة على قد وقتها
            for wi, w in enumerate(chunk):
                ws = start if wi == 0 else w["s"]
                we = end if wi == len(chunk) - 1 else chunk[wi + 1]["s"]
                if we <= ws:
                    continue
                text = " ".join(
                    f"{{\\c{hl}&}}{x['w']}{{\\c{base}&}}" if xi == wi else x["w"] for xi, x in enumerate(chunk)
                )
                anim = pop if wi == 0 else ""
                lines.append(f"Dialogue: 0,{ass_time(ws)},{ass_time(we)},Cap,,0,0,0,,{{{pos}{anim}}}{text}")
        else:
            color = f"\\c{hl}&" if st["highlight_on"] else ""
            text = " ".join(x["w"] for x in chunk)
            lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Cap,,0,0,0,,{{{pos}{pop}{color}}}{text}")
    return "\n".join(lines) + "\n"


def filter_path(path: Path) -> str:
    """يحضّر مسار الملف عشان يتكتب جوه فلتر FFmpeg (ويندوز فيه : و \\)."""
    p = str(path).replace("\\", "/")
    return p.replace(":", "\\:").replace("'", "\\'").replace(",", "\\,")


def words_from_text(text: str, start: float, end: float) -> list[dict]:
    """لو الخدمة رجّعت كلام من غير أوقات، نوزّعه بالتساوي على الوقت."""
    ws = [w for w in text.split() if w.strip()]
    if not ws:
        return []
    step = (end - start) / len(ws)
    return [{"w": w, "s": round(start + i * step, 3), "e": round(start + (i + 1) * step, 3)} for i, w in enumerate(ws)]
