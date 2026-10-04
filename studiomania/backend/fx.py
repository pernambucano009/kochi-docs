"""✨ محرك الافيكتس: كلام متحرك بيترسم فريم بفريم (العربي متشكّل صح بـ Pillow + raqm)، وكل حركة ليها صوتها.

الفكرة: الافيكت والصوت حاجة واحدة. كل قالب بيطلّع مع الفريمات «أحداث صوتية» بتوقيتها بالظبط
(كليك مع كل حرف في الكتابة، بوب لحظة الخبطة، ووش مع الدخول...)، والأصوات نفسها متولدة بالكود
(مفيش ملفات صوت ليها حقوق)، وبتتجمع في تراك واحد بيتركب على صوت اللقطة.
"""
from __future__ import annotations

import math
import re
import subprocess
import wave
from array import array
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont, features
except ImportError:  # من غير Pillow: الكلام بيرجع للطريقة القديمة (ASS) والأصوات بس اللي بتشتغل
    Image = ImageDraw = ImageFont = features = None

FPS = 30
SR = 44100


def available() -> bool:
    """الكلام المتحرك محتاج Pillow بـ raqm (عشان الحروف العربي تتشبك ببعض صح)."""
    try:
        return Image is not None and bool(features.check("raqm"))
    except Exception:  # noqa: BLE001
        return False


# ------------------------------------------------------------ الأصوات (متولدة بالكود)

# expr = موجة الصوت (FFmpeg aevalsrc)، d = مدته، af = فلتر بعده
SFX = {
    "click": {"label": "⌨️ كليك كيبورد", "d": 0.05,
              "expr": "(random(0)*2-1)*exp(-700*t)*0.9+sin(2*PI*190*t)*exp(-140*t)*0.5", "af": "highpass=f=700,volume=0.9"},
    "click2": {"label": "⌨️ كليك ٢", "d": 0.05,
               "expr": "(random(0)*2-1)*exp(-800*t)*0.9+sin(2*PI*230*t)*exp(-160*t)*0.45", "af": "highpass=f=1100,volume=0.85"},
    "click3": {"label": "⌨️ كليك ٣", "d": 0.05,
               "expr": "(random(0)*2-1)*exp(-650*t)*0.9+sin(2*PI*160*t)*exp(-130*t)*0.5", "af": "highpass=f=500,volume=0.9"},
    "pop": {"label": "💥 بوب", "d": 0.16,
            "expr": "sin(2*PI*(220*t+14*(1-exp(-45*t))))*exp(-22*t)", "af": "volume=0.9"},
    "whoosh": {"label": "💨 ووش", "d": 0.38,
               "expr": "(random(0)*2-1)*pow(sin(PI*t/0.38),2)", "af": "highpass=f=350,lowpass=f=3200,volume=0.8"},
    "swipe": {"label": "🖍️ سحبة", "d": 0.22,
              "expr": "(random(0)*2-1)*pow(sin(PI*t/0.22),3)", "af": "highpass=f=1800,volume=0.6"},
    "tick": {"label": "🕐 تيك", "d": 0.04, "expr": "sin(2*PI*2100*t)*exp(-110*t)", "af": "volume=0.6"},
    "ding": {"label": "🔔 دينج", "d": 0.9,
             "expr": "(sin(2*PI*1320*t)+0.5*sin(2*PI*2640*t)+0.25*sin(2*PI*3960*t))*exp(-5*t)*0.45", "af": "volume=0.9"},
    "thud": {"label": "🥁 خبطة", "d": 0.3,
             "expr": "sin(2*PI*(55*t+3*(1-exp(-30*t))))*exp(-11*t)", "af": "volume=1"},
}


def sfx_file(ffmpeg: str, cache: Path, name: str) -> Path:
    """ملف الصوت (WAV mono) بيتولد مرة واحدة ويتحفظ."""
    x = SFX[name]
    out = cache / f"{name}.wav"
    if not out.exists():
        cache.mkdir(parents=True, exist_ok=True)
        subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
                        "-i", f"aevalsrc='{x['expr']}':s={SR}:d={x['d']}", "-af", x["af"], "-ac", "1", "-ar", str(SR),
                        "-c:a", "pcm_s16le", str(out)], check=True, capture_output=True, timeout=60)
    return out


def _read(path: Path) -> array:
    with wave.open(str(path)) as w:
        data = array("h", w.readframes(w.getnframes()))
    return data


def mix_events(ffmpeg: str, cache: Path, events: list[tuple[float, str, float]], duration: float, out: Path) -> Path | None:
    """events = (الوقت بالثواني، اسم الصوت، علوّه) → تراك WAV واحد بطول اللقطة."""
    events = [e for e in events if e[1] in SFX and 0 <= e[0] < duration and e[2] > 0]
    if not events:
        return None
    n = int(duration * SR) + 1
    buf = array("f", bytes(4 * n))
    cache_data: dict[str, array] = {}
    for t, name, gain in events:
        data = cache_data.get(name)
        if data is None:
            data = cache_data[name] = _read(sfx_file(ffmpeg, cache, name))
        i0 = int(t * SR)
        g = gain / 32768.0
        for i in range(min(len(data), n - i0)):
            buf[i0 + i] += data[i] * g
    peak = max(1.0, max(abs(v) for v in buf))
    pcm = array("h", (int(max(-1.0, min(1.0, v / peak)) * 32000) for v in buf))
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return out


# ------------------------------------------------------------ القوالب

# in = حركة الدخول. الصوت الافتراضي لكل حركة (sfx: "auto")
TEXT_FX = {
    "typewriter": {"label": "⌨️ كتابة حرف حرف", "sfx": "click", "hint": "كل حرف بيظهر مع كليك"},
    "words": {"label": "🗣️ كلمة كلمة", "sfx": "tick", "hint": "كل كلمة بتظهر مع تيك"},
    "pop": {"label": "💥 ينط (pop)", "sfx": "pop", "hint": "بيكبر بسرعة ويرجع مع بوب لحظة الخبطة"},
    "counter": {"label": "🔢 عداد", "sfx": "tick", "hint": "الرقم اللي في الكلام بيعد من صفر، وتيك مع كل رقم ودينج في الآخر"},
    "highlight": {"label": "🖍️ هايلايت", "sfx": "swipe", "hint": "خط ماركر بيترسم ورا الكلام مع صوت سحبة"},
    "slide_up": {"label": "⬆️ يطلع من تحت", "sfx": "whoosh", "hint": ""},
    "slide_down": {"label": "⬇️ ينزل من فوق", "sfx": "whoosh", "hint": ""},
    "slide_left": {"label": "⬅️ يدخل من اليمين", "sfx": "whoosh", "hint": ""},
    "slide_right": {"label": "➡️ يدخل من الشمال", "sfx": "whoosh", "hint": ""},
    "zoom": {"label": "🔍 يكبر", "sfx": "whoosh", "hint": ""},
    "fade": {"label": "🌫️ يظهر تدريجي", "sfx": None, "hint": ""},
    "none": {"label": "من غير حركة", "sfx": None, "hint": ""},
}
OUT_SFX = {"slide_up": "whoosh", "slide_down": "whoosh", "slide_left": "whoosh", "slide_right": "whoosh"}
SLIDE = {"slide_up": (0, 1), "slide_down": (0, -1), "slide_left": (1, 0), "slide_right": (-1, 0)}
AR = re.compile(r"[؀-ۿ]")
NUM = re.compile(r"[0-9٠-٩]+(?:[.,][0-9٠-٩]+)?")
AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"


def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return lo if v < lo else hi if v > hi else v


def _ease_out(p: float) -> float:
    return 1 - (1 - p) ** 3


def _back(p: float) -> float:
    return 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2


def _rgba(hexc: str, a: int = 255) -> tuple[int, int, int, int]:
    h = (hexc or "#FFFFFF").lstrip("#")
    try:
        return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a
    except (ValueError, IndexError):
        return 255, 255, 255, a


def type_times(L: dict) -> list[float]:
    """وقت ظهور كل حرف في الكتابة (بيتظبط عشان الكتابة تخلص قبل الخروج)."""
    n = len(L["text"])
    avail = max(0.3, (L["end"] - L["out_dur"]) - L["start"] - 0.25)
    cps = max(float(L.get("speed") or 16), n / avail)
    return [L["start"] + i / cps for i in range(n)]


def word_times(L: dict) -> list[float]:
    n = len(L["text"].split())
    avail = max(0.3, (L["end"] - L["out_dur"]) - L["start"] - 0.25)
    wps = max(float(L.get("speed") or 4) if L.get("in") == "words" else 4, n / avail)
    return [L["start"] + i / wps for i in range(n)]


def _number(text: str):
    m = NUM.search(text)
    if not m:
        return None
    raw = m.group(0)
    arabic = any(c in AR_DIGITS for c in raw)
    latin = raw.translate(str.maketrans(AR_DIGITS, "0123456789")).replace(",", ".")
    try:
        val = float(latin)
    except ValueError:
        return None
    decimals = len(latin.split(".")[1]) if "." in latin else 0
    return m.start(), m.end(), val, decimals, arabic


def counter_text(L: dict, t: float) -> str:
    num = _number(L["text"])
    if not num:
        return L["text"]
    a, b, val, dec, arabic = num
    dur = max(L["in_dur"], 1.2)
    v = val * _ease_out(_clamp((t - L["start"]) / dur))
    s = f"{v:.{dec}f}"
    if arabic:
        s = s.translate(str.maketrans("0123456789.", AR_DIGITS + "٫"))
    return L["text"][:a] + s + L["text"][b:]


def sfx_events(L: dict) -> list[tuple[float, str, float]]:
    """الأحداث الصوتية بتاعة الطبقة (كلام أو صورة) بتوقيتها."""
    choice = L.get("sfx") or "auto"
    if choice == "none":
        return []
    vol = float(L.get("sfx_vol") if L.get("sfx_vol") is not None else 1.0)
    anim = L.get("in") or "fade"
    base = TEXT_FX.get(anim, {}).get("sfx")
    name = base if choice == "auto" else choice
    ev: list[tuple[float, str, float]] = []
    if name and L.get("type") == "text" and anim == "typewriter":
        for i, t in enumerate(type_times(L)):
            if not L["text"][i].isspace():
                # تلات أصوات كليك بالتبادل عشان الكتابة متبقاش آلية
                ev.append((t, name if choice != "auto" else ("click", "click2", "click3")[(i * 7) % 3], vol * 0.55))
    elif name and L.get("type") == "text" and anim == "words":
        ev += [(t, name, vol * 0.7) for t in word_times(L)]
    elif name and L.get("type") == "text" and anim == "counter":
        num = _number(L["text"])
        dur = max(L["in_dur"], 1.2)
        last, prev = -1.0, None
        steps = int(dur * FPS)
        for k in range(steps + 1):
            t = L["start"] + dur * k / steps
            shown = counter_text(L, t)
            if shown != prev and t - last >= 0.06:
                ev.append((t, name, vol * 0.5))
                last = t
            prev = shown
        if num:
            ev.append((L["start"] + dur, "ding", vol * 0.8))
    elif name and anim == "pop":
        ev.append((L["start"] + L["in_dur"] * 0.55, name, vol))
    elif name and anim == "highlight":
        ev.append((L["start"] + min(0.35, L["in_dur"]), name, vol))
    elif name:
        ev.append((max(0.0, L["start"] - 0.05), name, vol * 0.8))
    out = L.get("out") or "fade"
    if choice != "none" and out in OUT_SFX and L["end"] - L["out_dur"] > 0:
        ev.append((L["end"] - L["out_dur"], OUT_SFX[out], vol * 0.5))
    return ev


# ------------------------------------------------------------ الرسم

class _Sprite:
    """الكلام مرسوم في صورة شفافة على قده (بالبوكس والهايلايت)، والحركة بتتعمل عليها."""

    def __init__(self, L: dict, W: int, H: int, fonts: dict[str, Path]):
        self.L = L
        px = max(12, int(L["size"] * H))
        path = fonts.get(L.get("font")) or next(iter(fonts.values()))
        self.font = ImageFont.truetype(str(path), px, layout_engine=ImageFont.Layout.RAQM)
        self.px = px
        self.rtl = bool(AR.search(L["text"]))
        self.dir = "rtl" if self.rtl else "ltr"  # الاتجاه صريح: «+٣٥٠ متدرب» الرقم يفضل في أول السطر (يمين)
        self.maxw = int(W * 0.86)
        self.cache: dict = {}

    def _lines(self, text: str) -> list[str]:
        out = []
        for para in text.split("\n"):
            cur = ""
            for w in para.split(" "):
                cand = f"{cur} {w}".strip()
                if cur and self.font.getlength(cand, direction=self.dir) > self.maxw:
                    out.append(cur)
                    cur = w
                else:
                    cur = cand
            out.append(cur)
        return out

    def image(self, shown: str, full: str, hl: float, cursor: bool) -> Image.Image:
        key = (shown, hl if hl < 1 else 1, cursor)
        if key in self.cache:
            return self.cache[key]
        L, px = self.L, self.px
        lines = self._lines(full)
        asc, desc = self.font.getmetrics()
        lh = int((asc + desc) * 1.12)
        widths = [int(self.font.getlength(x, direction=self.dir)) for x in lines]
        bw = max(widths + [1])
        box = bool(L.get("box"))
        padx, pady = (int(px * 0.55), int(px * 0.32)) if box else (int(px * 0.2), int(px * 0.12))
        stroke = 0 if box else max(2, px // 14)
        cw, ch = bw + 2 * padx + 2 * stroke, lh * len(lines) + 2 * pady + 2 * stroke
        img = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        if box:
            d.rounded_rectangle((0, 0, cw - 1, ch - 1), radius=int(px * 0.35), fill=_rgba(L["box"], 235))
        # اللي ظاهر من الكلام (الكتابة حرف حرف / كلمة كلمة) موزّع على نفس السطور
        left = len(shown)
        for k, (line, w) in enumerate(zip(lines, widths)):
            y = pady + stroke + k * lh
            part = line[:max(0, left)]
            left -= len(line) + 1
            if hl > 0:  # خط الماركر بيترسم من أول السطر (يمين للعربي)
                hw = int(w * _ease_out(_clamp(hl)))
                lx, rx = (cw - w) // 2, (cw + w) // 2
                x0, x1 = (rx - hw, rx) if self.rtl else (lx, lx + hw)
                pad = int(px * 0.12)
                d.rounded_rectangle((x0 - pad, y + int(lh * 0.45), x1 + pad, y + int(lh * 0.92)),
                                    radius=int(px * 0.15), fill=_rgba(L.get("accent") or "#FFD54A", 210))
            if not part:
                continue
            # بيتكتب من أول السطر: يمين للعربي وشمال للإنجليزي، فالكلام اللي اتكتب ميتحركش
            if self.rtl:
                x, anchor = (cw + w) // 2, "ra"
            else:
                x, anchor = (cw - w) // 2, "la"
            d.text((x, y + int(lh * 0.06)), part, font=self.font, fill=_rgba(L["color"]), anchor=anchor,
                   direction=self.dir, stroke_width=stroke, stroke_fill=(0, 0, 0, 150))
            if cursor and left < 0:
                pw = int(self.font.getlength(part, direction=self.dir))
                cx = x - pw - int(px * 0.08) if self.rtl else x + pw + int(px * 0.08)
                d.rectangle((cx, y + int(lh * 0.15), cx + max(2, px // 12), y + int(lh * 0.85)), fill=_rgba(L["color"]))
                cursor = False
        if len(self.cache) > 400:
            self.cache.clear()
        self.cache[key] = img
        return img


def _state(L: dict, t: float, W: int, H: int) -> dict | None:
    if t < L["start"] or t > L["end"]:
        return None
    pin = _clamp((t - L["start"]) / L["in_dur"])
    pout = _clamp((t - (L["end"] - L["out_dur"])) / L["out_dur"])
    anim, out = L.get("in") or "fade", L.get("out") or "fade"
    op, sc, dx, dy = 1.0, 1.0, 0.0, 0.0
    if anim in ("fade", "zoom") or anim in SLIDE:
        op *= _ease_out(pin)
    if anim == "pop":
        sc *= max(0.0, _back(pin))
    elif anim == "zoom":
        sc *= 0.6 + 0.4 * _ease_out(pin)
    if anim in SLIDE:
        sx, sy = SLIDE[anim]
        dx += sx * 0.25 * W * (1 - _ease_out(pin))
        dy += sy * 0.25 * H * (1 - _ease_out(pin))
    if out in ("fade", "zoom") or out in SLIDE:
        op *= 1 - pout
    if out == "pop":
        sc *= 1 - pout ** 3
    elif out == "zoom":
        sc *= 1 - 0.4 * pout ** 3
    if out in SLIDE:
        sx, sy = SLIDE[out]
        dx -= sx * 0.25 * W * pout ** 3
        dy -= sy * 0.25 * H * pout ** 3
    if L.get("loop") == "pulse":
        sc *= 1 + 0.04 * math.sin(2 * math.pi * (t - L["start"]) / 1.2)
    elif L.get("loop") == "float":
        dy += 0.012 * H * math.sin(2 * math.pi * (t - L["start"]) / 2)
    text, shown, hl, cursor = L["text"], L["text"], 0.0, False
    if anim == "typewriter":
        times = type_times(L)
        k = sum(1 for x in times if x <= t)
        shown = text[:k]
        # المؤشر ثابت وهو بيكتب، وبعد ما يخلص بيرمش شوية ويختفي
        cursor = k < len(text) or (t - times[-1] < 0.9 and int(t * 3) % 2 == 0) if times else False
    elif anim == "words":
        words = text.split()
        k = sum(1 for x in word_times(L) if x <= t)
        shown = " ".join(words[:k])
    elif anim == "counter":
        text = shown = counter_text(L, t)
    elif anim == "highlight":
        hl = _clamp((t - L["start"] - min(0.35, L["in_dur"])) / 0.45) if t >= L["start"] + min(0.35, L["in_dur"]) else 0.0
        op *= _ease_out(_clamp(pin * 3))
    return {"op": _clamp(op), "sc": max(0.0, sc), "dx": dx, "dy": dy, "text": text, "shown": shown, "hl": hl, "cursor": cursor}


def frames(layers: list[dict], W: int, H: int, duration: float, fonts: dict[str, Path]):
    """فريمات RGBA شفافة (bytes) بطول اللقطة، 30 فريم في الثانية، فيها الكلام المتحرك بس."""
    sprites = {L["id"]: _Sprite(L, W, H, fonts) for L in layers}
    empty = bytes(W * H * 4)
    for f in range(int(math.ceil(duration * FPS))):
        t = f / FPS
        states = [(L, _state(L, t, W, H)) for L in layers]
        states = [(L, s) for L, s in states if s and s["op"] > 0.003 and s["sc"] > 0.01]
        if not states:
            yield empty
            continue
        frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for L, s in states:
            img = sprites[L["id"]].image(s["shown"], s["text"], s["hl"], s["cursor"])
            if abs(s["sc"] - 1) > 0.005:
                img = img.resize((max(1, int(img.width * s["sc"])), max(1, int(img.height * s["sc"]))), Image.BILINEAR)
            if s["op"] < 0.997:
                a = img.getchannel("A").point(lambda v, o=s["op"]: int(v * o))
                img = img.copy()
                img.putalpha(a)
            x = int(L["x"] * W - img.width / 2 + s["dx"])
            y = int(L["y"] * H - img.height / 2 + s["dy"])
            # الجزء اللي جوه الشاشة بس (الكلام وهو داخل من بره بيبقى نصه بره)
            sx, sy = max(0, -x), max(0, -y)
            cw, ch = min(img.width - sx, W - max(0, x)), min(img.height - sy, H - max(0, y))
            if cw > 0 and ch > 0:
                frame.alpha_composite(img.crop((sx, sy, sx + cw, sy + ch)), (max(0, x), max(0, y)))
        yield frame.tobytes()
