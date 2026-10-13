"""🔠 النصوص الحرة في المونتاج (زي كاب كات): كل نص بخطه ولونه ومكانه وحركة دخوله وخروجه،
بيتحول لملف ASS وبيترسم بـ libass في التصدير. نفس المعادلات بالظبط في المعاينة (montage-text.js)."""
from __future__ import annotations

import re

# الخط في البرنامج ← (اسم العيلة جوه الملف، تقيل؟)
FONTS = {
    "SM Tajawal": False, "SM Almarai": False, "SM Cairo": False, "SM Lalezar": False, "SM Changa": False, "SM Kufi": False,
    "SM Plex": False, "IBM Plex Sans Arabic": True, "Amiri": True,
    # إنجليزي بس (العربي بيتكتب بخط تاني)
    "Anton": False, "Outfit": True, "Instrument Serif": False,
}
# libass بيحسب حجم الخط بارتفاع السطر كله (usWinAscent + usWinDescent)، والمتصفح بالـ em.
# بنضرب في النسبة دي عشان «الحجم» يبقى نفس شكل الحروف في كل الخطوط وفي المعاينة.
WIN = {"SM Tajawal": 1.476, "SM Almarai": 1.561, "SM Cairo": 1.883, "SM Lalezar": 1.567, "SM Changa": 2.048, "SM Kufi": 2.157,
       "SM Plex": 1.729, "IBM Plex Sans Arabic": 1.729, "Amiri": 2.76, "Anton": 1.733, "Outfit": 1.26, "Instrument Serif": 1.3}
ANIMS = {"fade", "pop", "zoom", "slideup", "slidedown", "slideleft", "slideright", "type"}
REF = 1080  # المقاسات متخزنة على أساس إن الضلع الأصغر للكادر 1080


def _color(hex_: str, default: str = "#ffffff") -> tuple[int, int, int]:
    h = hex_ if isinstance(hex_, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", hex_) else default
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def ass_color(hex_: str, alpha: int = 0, default: str = "#ffffff") -> str:
    r, g, b = _color(hex_, default)
    return f"&H{alpha:02X}{b:02X}{g:02X}{r:02X}"


def _ts(t: float) -> str:
    t = max(0.0, t)
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _esc(s: str) -> str:
    return s.replace("\\", "＼").replace("{", "｛").replace("}", "｝").replace("\r", "").replace("\n", "\\N")


def clean(x: dict) -> dict | None:
    """بيظبط بيانات نص واحد (اللي جاية من البرنامج) في حدودها."""
    text = str(x.get("text") or "").strip()[:400]
    if not text:
        return None
    num = lambda k, d, lo, hi: max(lo, min(hi, float(x.get(k, d) if x.get(k) is not None else d)))  # noqa: E731
    font = x.get("font") if x.get("font") in FONTS else "SM Tajawal"

    def anim(a):
        if not isinstance(a, dict) or a.get("type") not in ANIMS:
            return None
        return {"type": a["type"], "dur": max(0.05, min(3.0, float(a.get("dur") or 0.4)))}

    st = x.get("stroke") or {}
    bg = x.get("bg") or {}
    return {
        "text": text, "t0": max(0.0, float(x.get("t0") or 0)), "dur": num("dur", 3, 0.1, 600),
        "font": font, "size": num("size", 80, 10, 400), "color": x.get("color") or "#ffffff",
        "x": num("x", 0.5, -0.5, 1.5), "y": num("y", 0.5, -0.5, 1.5), "angle": num("angle", 0, -360, 360),
        "scale": num("scale", 1, 0.1, 5), "opacity": num("opacity", 1, 0, 1), "spacing": num("spacing", 0, -10, 40),
        "bold": bool(x.get("bold")) or FONTS[font], "italic": bool(x.get("italic")),
        "stroke": {"w": max(0.0, min(30.0, float(st.get("w") or 0))), "color": st.get("color") or "#000000"},
        "shadow": bool(x.get("shadow")),
        "bg": {"on": bool(bg.get("on")), "color": bg.get("color") or "#000000"},
        "anim_in": anim(x.get("anim_in")), "anim_out": anim(x.get("anim_out")),
    }


def anim_state(typ: str, p: float, entering: bool, w: int, h: int) -> dict:
    """حالة النص في حركة الدخول/الخروج: p من 0 (برّه) لـ 1 (مكانه). scale و alpha و dx/dy بالبكسل."""
    st = {"scale": 1.0, "alpha": 1.0, "dx": 0.0, "dy": 0.0}
    q = 1 - p
    sign = 1 if entering else -1
    if typ in ("fade", "zoom", "slideup", "slidedown", "slideleft", "slideright"):
        st["alpha"] = p
    if typ == "pop":
        st["alpha"] = min(1.0, p / 0.3)
        st["scale"] = (p / 0.7) * 1.12 if p < 0.7 else 1.12 - 0.12 * (p - 0.7) / 0.3
    elif typ == "zoom":
        st["scale"] = 0.6 + 0.4 * p
    elif typ == "slideup":
        st["dy"] = sign * 0.12 * h * q
    elif typ == "slidedown":
        st["dy"] = -sign * 0.12 * h * q
    elif typ == "slideleft":
        st["dx"] = sign * 0.15 * w * q
    elif typ == "slideright":
        st["dx"] = -sign * 0.15 * w * q
    return st


def build_ass(texts: list[dict], total: float, w: int, h: int) -> str | None:
    items = [c for c in (clean(x) for x in texts or [] if isinstance(x, dict)) if c and c["t0"] < total]
    if not items:
        return None
    k = min(w, h) / REF
    styles, events = [], []
    for n, t in enumerate(items):
        size = t["size"] * k  # حجم الحروف (em)
        box = t["bg"]["on"]
        outline = size * 0.22 if box else t["stroke"]["w"] * k
        out_col = ass_color(t["bg"]["color"]) if box else ass_color(t["stroke"]["color"], 0, "#000000")
        shadow = size * 0.06 if t["shadow"] else 0
        styles.append(
            f"Style: T{n},{t['font']},{size * WIN.get(t['font'], 1.5):.1f},{ass_color(t['color'])},&H000000FF,{out_col},&H80000000,"
            f"{-1 if t['bold'] else 0},{-1 if t['italic'] else 0},0,0,100,100,{t['spacing'] * k:.1f},0,"
            f"{3 if box else 1},{outline:.1f},{shadow:.1f},5,0,0,0,1"
        )
        x, y = t["x"] * w, t["y"] * h
        a0 = int(round((1 - t["opacity"]) * 255))
        base = f"\\an5\\frz{-t['angle']:.2f}"
        ai, ao = t["anim_in"], t["anim_out"]
        din = min(ai["dur"], t["dur"] * 0.5) if ai else 0.0
        dout = min(ao["dur"], t["dur"] * 0.5) if ao else 0.0
        start, end = t["t0"], min(total, t["t0"] + t["dur"])
        text = _esc(t["text"])
        sc = t["scale"] * 100

        def phase(s0: float, s1: float, st0: dict, st1: dict, body: str) -> None:
            if s1 - s0 < 0.01:
                return
            ms = int((s1 - s0) * 1000)
            x0, y0, x1, y1 = x + st0["dx"], y + st0["dy"], x + st1["dx"], y + st1["dy"]
            pos = f"\\move({x0:.1f},{y0:.1f},{x1:.1f},{y1:.1f})" if (abs(x1 - x0) + abs(y1 - y0)) > 0.5 else f"\\pos({x0:.1f},{y0:.1f})"
            tags = base + pos
            f0, f1 = sc * st0["scale"], sc * st1["scale"]
            tags += f"\\fscx{f0:.1f}\\fscy{f0:.1f}"
            if abs(f1 - f0) > 0.1:
                tags += f"\\t(0,{ms},\\fscx{f1:.1f}\\fscy{f1:.1f})"
            al0 = int(round(255 - (255 - a0) * st0["alpha"]))
            al1 = int(round(255 - (255 - a0) * st1["alpha"]))
            tags += f"\\alpha&H{al0:02X}&"
            if al1 != al0:
                tags += f"\\t(0,{ms},\\alpha&H{al1:02X}&)"
            events.append(f"Dialogue: {n},{_ts(s0)},{_ts(s1)},T{n},,0,0,0,,{{{tags}}}{body}")

        def anim_phases(a: dict, s0: float, s1: float, entering: bool) -> None:
            typ = a["type"]
            if typ == "type":
                chars = list(t["text"])
                if not entering:
                    chars = chars[::-1]
                n_ch = max(1, len(chars))
                for i in range(n_ch):
                    c0, c1 = s0 + (s1 - s0) * i / n_ch, s0 + (s1 - s0) * (i + 1) / n_ch
                    part = "".join(t["text"][: i + 1]) if entering else t["text"][: n_ch - i - 1]
                    if part.strip():
                        phase(c0, c1, anim_state("", 1, True, w, h), anim_state("", 1, True, w, h), _esc(part))
                return
            if typ == "pop":
                # بوب: بيكبر لحد 112٪ وبعدين يرجع 100٪ (خطوتين)
                m = s0 + (s1 - s0) * 0.7
                pa, pb = (0.0, 0.7) if entering else (1.0, 0.7)
                pc = 1.0 if entering else 0.0
                if entering:
                    phase(s0, m, anim_state(typ, pa, True, w, h), anim_state(typ, pb, True, w, h), text)
                    phase(m, s1, anim_state(typ, pb, True, w, h), anim_state(typ, pc, True, w, h), text)
                else:
                    phase(s0, s0 + (s1 - s0) * 0.3, anim_state(typ, 1.0, False, w, h), anim_state(typ, 0.7, False, w, h), text)
                    phase(s0 + (s1 - s0) * 0.3, s1, anim_state(typ, 0.7, False, w, h), anim_state(typ, 0.0, False, w, h), text)
                return
            p0, p1 = (0.0, 1.0) if entering else (1.0, 0.0)
            phase(s0, s1, anim_state(typ, p0, entering, w, h), anim_state(typ, p1, entering, w, h), text)

        if ai:
            anim_phases(ai, start, start + din, True)
        rest = anim_state("", 1, True, w, h)
        phase(start + din, end - dout, rest, rest, text)
        if ao:
            anim_phases(ao, end - dout, end, False)
    head = [
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {w}", f"PlayResY: {h}", "WrapStyle: 2", "ScaledBorderAndShadow: yes", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, "
        "StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        *styles, "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    return "\n".join(head + events) + "\n"
