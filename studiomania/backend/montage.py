"""الخطوة 6: المونتاج النهائي بـ FFmpeg.

بيركّب الفيديوهات المولَّدة ورا بعض (مع القص والزووم والتحريك والصوت لكل واحد)،
وبعدها أوترو المدرب، وفوقهم التعليق الصوتي والموسيقى.
"""

import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

WIDTH, HEIGHT, FPS = 1080, 1920, 30
MUSIC_FADE_SECONDS = 1.5
# عدد الـ threads ثابت: FFmpeg لوحده بيفتح thread لكل core في السيرفر، وعلى Railway
# ده ممكن يبقى عشرات، وكل واحد بيحجز فريمات في الذاكرة لحد ما الذاكرة تخلص
THREADS = max(1, int(os.environ.get("RENDER_THREADS", "2")))


@dataclass
class MediaInfo:
    duration: float
    width: int
    height: int
    has_audio: bool
    fps: float = 30.0


def probe(ffmpeg: str, path: Path) -> MediaInfo:
    err = subprocess.run([ffmpeg, "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    d = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", err)
    if not d:
        raise ValueError(f"تعذّر قراءة الملف: {path.name}")
    h, m, s = d.groups()
    size = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", err)
    w, hh = (int(size.group(1)), int(size.group(2))) if size else (0, 0)
    # فيديو الموبايل الطولي بيتخزن ساعات بالعرض ومعاه «لفّه 90 درجة»، وFFmpeg بيلفّه وهو بيقراه: المقاس الحقيقي بالعكس
    rot = re.search(r"rotation of (-?\d+(?:\.\d+)?) degrees|rotate\s*:\s*(-?\d+)", err)
    if rot and round(abs(float(rot.group(1) or rot.group(2)))) % 180 == 90:
        w, hh = hh, w
    return MediaInfo(
        duration=int(h) * 3600 + int(m) * 60 + float(s),
        width=w,
        height=hh,
        has_audio=bool(re.search(r"Stream #\d+:\d+.*Audio:", err)),
        fps=float(fps.group(1)) if (fps := re.search(r"Video:.*?(\d+(?:\.\d+)?) fps", err)) else 30.0,
    )


@dataclass
class Segment:
    path: Path
    start: float
    end: float
    zoom: float = 1.0  # 1 = الصورة مالية الكادر، 2 = زووم الضعف
    x: float = 0.0  # من -1 (أقصى الشمال) لـ 1 (أقصى اليمين)
    y: float = 0.0  # من -1 (فوق خالص) لـ 1 (تحت خالص)
    volume: float = 1.0
    has_audio: bool = True
    src_duration: float | None = None  # طول الملف الأصلي (عشان نعرف نمدّ القطعة قد إيه للترانزيشن)
    trans_in: str = ""  # ترانزيشن من القطعة اللي قبلها (اسم xfade في FFmpeg)
    trans_dur: float = 0.0
    # تأثيرات القطعة (زي كاب كات)
    speed: float = 1.0          # 0.25 لـ 4
    reverse: bool = False       # بالعكس
    flip_h: bool = False
    flip_v: bool = False
    rotate: int = 0             # 0 / 90 / 180 / 270
    adj: dict | None = None     # {bright, contrast, sat, temp, vignette, sharp} من -100 لـ 100
    look: str = ""              # فلتر جاهز (LOOKS)
    fade_in: float = 0.0        # ظهور من الأسود (ثواني)
    fade_out: float = 0.0       # اختفاء للأسود
    fit: str = "fill"           # fill = يملا الكادر / blur = كامل بخلفية مغبّشة / black = كامل بخلفية سودا
    # الحركة (زي كاب كات): مقاس الملف الأصلي عشان نحسب كل حاجة بالبكسل
    src_w: int = 0
    src_h: int = 0
    angle: float = 0.0          # لف بأي زاوية (درجات) حوالين نص الكادر
    crop: tuple = (0.0, 0.0, 0.0, 0.0)  # قص من الشمال/فوق/اليمين/تحت (نسبة من 0 لـ 0.9)
    kf: list | None = None      # كي فريمز [{t, zoom, x, y, angle}] (t بالثواني من أول القطعة)
    anim_in: tuple = ("", 0.0)  # حركة دخول (النوع، المدة)
    anim_out: tuple = ("", 0.0)
    fx: list | None = None      # تأثيرات [(النوع، القوة من 0 لـ 1)]
    bg: str = "black"           # لون الخلفية لما الصورة مش مالية الكادر
    hide_video: bool = False    # تراك الفيديو مستخبي: الصورة بلون الخلفية والصوت زي ما هو
    blank: bool = False         # قطعة متعطّلة: مكانها بيفضل (بلون الخلفية ومن غير صوت) عشان المواعيد متتغيرش

    @property
    def duration(self) -> float:
        return (self.end - self.start) / max(0.25, min(4.0, self.speed or 1.0))


# ترانزيشنز بين اللقطات (FFmpeg xfade). الطول الكلي للفيديو مبيتغيرش: كل قطعة بتتمد نص مدة الترانزيشن من الفيديو الأصلي
# (أو بتثبت على أول/آخر فريم لو مفيش)، والترانزيشن بيبقى في نص القطع بالظبط، فالكلام والتايبوجرافي بيفضلوا في مواعيدهم.
TRANSITIONS = {"fade", "fadeblack", "fadewhite", "dissolve", "wipeleft", "wiperight", "wipeup", "wipedown", "slideleft", "slideright",
               "slideup", "slidedown", "smoothleft", "smoothright", "circleopen", "circleclose", "radial", "pixelize", "zoomin",
               "hblur", "squeezeh", "squeezev", "diagtl", "hlslice", "rectcrop", "distance"}


@dataclass
class AudioTrack:
    path: Path
    volume: float = 1.0
    delay: float = 0.0  # يبدأ بعد كام ثانية من أول الفيديو
    offset: float = 0.0  # يبدأ من ثانية كام جوه الملف
    length: float | None = None  # ياخد كام ثانية من الملف (None = لحد آخره)
    fade_out: bool = False
    fade_in_s: float = 0.0   # ظهور بالتدريج للقطعة دي (ثواني)
    fade_out_s: float = 0.0  # اختفاء بالتدريج للقطعة دي
    duck: float = 0.0        # بيوطّى قد إيه وقت الكلام (0 = لأ)


@dataclass
class Logo:
    path: Path
    size: float = 18.0  # عرض اللوجو كنسبة من عرض الفيديو
    x: float = 92.0  # من 0 (شمال) لـ 100 (يمين)
    y: float = 4.0  # من 0 (فوق) لـ 100 (تحت)
    opacity: float = 0.9
    until: float | None = None  # يختفي بعد الثانية دي (قبل الأوترو)


@dataclass
class Subtitles:
    ass_path: Path
    fonts_dir: Path


# فلاتر جاهزة (نفس الأسامي في المعاينة)
LOOKS = {
    "bw": "hue=s=0",
    "noir": "hue=s=0,eq=contrast=1.35:brightness=-0.03",
    "warm": "colortemperature=temperature=4800,eq=saturation=1.1",
    "cool": "colortemperature=temperature=8500",
    "vintage": "curves=preset=vintage,eq=saturation=0.85",
    "vivid": "eq=saturation=1.45:contrast=1.08",
    "fade": "eq=contrast=0.82:brightness=0.05:saturation=0.8",
    "teal": "colorbalance=rs=-0.12:bs=0.12:rh=0.12:bh=-0.1",
    "film": "curves=preset=strong_contrast,eq=saturation=0.9,noise=alls=8:allf=t",
    "pink": "colorbalance=rm=0.12:bm=0.06:gm=-0.05,eq=saturation=1.1",
}


def atempo_chain(speed: float) -> str:
    """atempo بيقبل من 0.5 لـ 2 بس، فالسرعات التانية بنعملها كذا مرة ورا بعض."""
    parts, s = [], speed
    while s > 2.0:
        parts.append("atempo=2.0"); s /= 2.0
    while s < 0.5:
        parts.append("atempo=0.5"); s /= 0.5
    parts.append(f"atempo={s:.4f}")
    return ",".join(parts)


def color_filters(seg: "Segment") -> str:
    """الألوان والفلتر الجاهز والفينييت: سلسلة فلاتر بتتحط بعد ما الصورة تبقى على مقاس الكادر."""
    a = seg.adj or {}
    f = []
    b, c, s = float(a.get("bright") or 0) / 100, float(a.get("contrast") or 0) / 100, float(a.get("sat") or 0) / 100
    if b or c or s:
        f.append(f"eq=brightness={b * 0.3:.3f}:contrast={1 + c * 0.6:.3f}:saturation={max(0.0, 1 + s):.3f}")
    temp = float(a.get("temp") or 0) / 100
    if temp:
        f.append(f"colortemperature=temperature={6500 - temp * 2500:.0f}")
    if seg.look in LOOKS:
        f.append(LOOKS[seg.look])
    sharp = float(a.get("sharp") or 0) / 100
    if sharp > 0:
        f.append(f"unsharp=5:5:{sharp * 1.5:.2f}")
    vig = float(a.get("vignette") or 0) / 100
    if vig > 0:
        f.append(f"vignette=angle={0.2 + vig * 0.6:.3f}")
    return ("," + ",".join(f)) if f else ""


# ---------- الحركة: كي فريمز + حركات دخول وخروج + تأثيرات (نفس المعادلات بالظبط في المعاينة montage.js) ----------
ANIMS = {"fade", "zoomin", "zoomout", "slidel", "slider", "slideu", "slided", "pop", "spin"}
ANIM_FADES = {"fade", "zoomin", "zoomout", "pop", "spin"}  # الحركات اللي بتظهر بالتدريج كمان
MOTION_FX = {"shake", "pulse", "glitch"}  # بتحرّك الصورة
POST_FX = {"flash", "rgb", "blur", "grain"}  # بتتحط على الصورة بعد ما تتركّب
EFFECTS = MOTION_FX | POST_FX


def _f(v: float) -> str:
    return f"{v:.5f}"


def kf_expr(kf: list, key: str, default: float, tl: str) -> str:
    """قيمة خاصية في وقت tl من الكي فريمز: بين كل اتنين انتقال ناعم (smoothstep)، وقبل الأول وبعد الآخر ثابتة."""
    pts = sorted((float(k["t"]), float(k.get(key, default))) for k in kf or [] if k.get(key) is not None)
    if not pts:
        return _f(default)
    expr = _f(pts[-1][1])
    for (t0, v0), (t1, v1) in reversed(list(zip(pts, pts[1:]))):
        if t1 - t0 < 1e-3:
            continue
        p = f"(({tl})-{t0:.4f})/{t1 - t0:.4f}"
        expr = f"if(lt({tl},{t1:.4f}),{_f(v0)}+({_f(v1 - v0)})*{p}*{p}*(3-2*{p}),{expr})"
    return f"if(lt({tl},{pts[0][0]:.4f}),{_f(pts[0][1])},{expr})"


def kf_value(kf: list, key: str, default: float, t: float) -> float:
    pts = sorted((float(k["t"]), float(k.get(key, default))) for k in kf or [] if k.get(key) is not None)
    if not pts:
        return default
    if t <= pts[0][0]:
        return pts[0][1]
    for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
        if t < t1 and t1 - t0 >= 1e-3:
            p = (t - t0) / (t1 - t0)
            return v0 + (v1 - v0) * p * p * (3 - 2 * p)
    return pts[-1][1]


def motion_exprs(seg: "Segment", tl: str, fx_tl: str | None = None) -> dict:
    """معادلات FFmpeg لحركة القطعة في الوقت tl (من أول القطعة): z مضاعف الزووم، x/y من -1 لـ 1،
    dx/dy إزاحة زيادة بالبكسل، a زاوية بالدرجات."""
    dur = seg.duration
    kf = seg.kf or []
    z = [kf_expr(kf, "zoom", seg.zoom, tl) if kf else _f(seg.zoom)]
    x = kf_expr(kf, "x", seg.x, tl) if kf else _f(seg.x)
    y = kf_expr(kf, "y", seg.y, tl) if kf else _f(seg.y)
    a = [kf_expr(kf, "angle", seg.angle, tl) if kf else _f(seg.angle)]
    dx, dy = ["0"], ["0"]
    for kind, (typ, d), sign in (("in", seg.anim_in, 1), ("out", seg.anim_out, -1)):
        if typ not in ANIMS or d <= 0.01:
            continue
        d = min(d, dur)
        p = f"clip(({tl})/{d:.4f},0,1)" if kind == "in" else f"clip(({dur:.4f}-({tl}))/{d:.4f},0,1)"
        e = f"(1-pow(1-{p},3))"
        if typ == "zoomin":
            z.append(f"(0.5+0.5*{e})")
        elif typ == "zoomout":
            z.append(f"(1.5-0.5*{e})")
        elif typ == "pop":
            z.append(f"(0.3+0.7*(1+2.70158*pow({p}-1,3)+1.70158*pow({p}-1,2)))")
        elif typ == "spin":
            z.append(f"(0.4+0.6*{e})")
            a.append(f"({-sign * 180}*(1-{e}))")
        elif typ == "slidel":
            dx.append(f"({sign * WIDTH}*(1-{e}))")
        elif typ == "slider":
            dx.append(f"({-sign * WIDTH}*(1-{e}))")
        elif typ == "slideu":
            dy.append(f"({sign * HEIGHT}*(1-{e}))")
        elif typ == "slided":
            dy.append(f"({-sign * HEIGHT}*(1-{e}))")
    tl = fx_tl or tl  # التأثيرات المستمرة بتمشي حتى في فريمات الترانزيشن
    for typ, amt in seg.fx or []:
        if typ == "shake":
            dx.append(f"({amt * WIDTH * 0.015:.3f}*(sin(({tl})*47)+sin(({tl})*31.7)))")
            dy.append(f"({amt * HEIGHT * 0.01:.3f}*(sin(({tl})*39)+sin(({tl})*27.3)))")
        elif typ == "pulse":
            z.append(f"(1+{amt * 0.08:.4f}*pow(max(0,sin(({tl})*12.566)),4))")
        elif typ == "glitch":
            dx.append(f"(gt(mod(({tl}),0.9),0.78)*{amt * WIDTH * 0.04:.2f}*sin(({tl})*90))")
    return {"z": "*".join(z), "x": x, "y": y, "a": "+".join(a), "dx": "+".join(dx), "dy": "+".join(dy)}


def needs_motion(seg: "Segment") -> bool:
    """القطعة محتاجة طريقة التركيب الكاملة (أبطأ شوية) بدل القص السريع."""
    return bool(
        seg.kf or abs(seg.angle) > 0.01 or seg.zoom < 0.999
        or (seg.anim_in[0] in ANIMS and seg.anim_in[1] > 0.01) or (seg.anim_out[0] in ANIMS and seg.anim_out[1] > 0.01)
        or any(t in MOTION_FX for t, _ in seg.fx or [])
    )


def post_fx(seg: "Segment", tl: str) -> str:
    """التأثيرات اللي بتتحط على الكادر بعد التركيب (فلاش، ألوان مفصولة، بلور، حبيبات، وألوان الجليتش)."""
    f = []
    for typ, amt in seg.fx or []:
        if typ == "flash":
            f.append(f"eq=brightness='{amt * 0.5:.3f}*pow(max(0,sin(({tl})*9.4248)),8)':eval=frame")
        elif typ == "rgb":
            n = max(1, round(amt * 12))
            f.append(f"rgbashift=rh=-{n}:bh={n}")
        elif typ == "blur":
            f.append(f"gblur=sigma={max(0.5, amt * 12):.2f}")
        elif typ == "grain":
            f.append(f"noise=alls={max(1, round(amt * 35))}:allf=t+u")
        elif typ == "glitch":
            f.append(f"hue=h='gt(mod(({tl}),0.9),0.78)*{amt * 90:.1f}'")
    return ("," + ",".join(f)) if f else ""


def encoder_args(preset: str, crf: int, low_memory: bool) -> list[str]:
    args = ["-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-threads", "1" if low_memory else str(THREADS)]
    if low_memory:
        args += ["-x264-params", "rc-lookahead=5"]  # فريمات أقل في الذاكرة
    return args


def segment_command(ffmpeg: str, seg: Segment, output: Path, low_memory: bool = False, pre: float = 0.0, post: float = 0.0) -> list[str]:
    """المرحلة الأولى: قطعة واحدة بس، مقصوصة ومتظبطة على 1080×1920 وصوتها موحّد، وعليها تأثيراتها
    (سرعة، عكس، قلب، لف، ألوان، فلتر، ظهور/اختفاء، ملء الكادر أو كاملة بخلفية).
    pre/post: ثواني زيادة (بوقت الفيديو النهائي) قبلها وبعدها للترانزيشن (من الفيديو الأصلي، واللي مش موجود بيثبت على أول/آخر فريم)."""
    if seg.blank:
        total = seg.duration + pre + post
        bgc = ("0x" + seg.bg.lstrip("#")) if re.fullmatch(r"#[0-9a-fA-F]{6}", seg.bg or "") else "black"
        return [ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
                "-f", "lavfi", "-i", f"color=c={bgc}:s={WIDTH}x{HEIGHT}:r={FPS}:d={total:.3f}",
                "-f", "lavfi", "-i", f"anullsrc=r=48000:cl=stereo", "-t", f"{total:.3f}",
                "-map", "0:v", "-map", "1:a", "-pix_fmt", "yuv420p", *encoder_args("veryfast", 16, low_memory),
                "-c:a", "flac", "-sample_fmt", "s16", str(output)]
    sp = max(0.25, min(4.0, seg.speed or 1.0))
    start = max(0.0, seg.start - pre * sp)
    lack_pre = pre - (seg.start - start) / sp
    end = seg.end + post * sp
    lack_post = 0.0
    if seg.src_duration is not None and end > seg.src_duration:
        lack_post, end = (end - seg.src_duration) / sp, seg.src_duration
    take = max(1 / FPS, end - start)
    total = seg.duration + pre + post
    args = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-filter_complex_threads", "1",
            "-threads", "1", "-ss", f"{start:.3f}", "-t", f"{take:.3f}", "-i", str(seg.path)]
    pad = (f",tpad=start_mode=clone:start_duration={lack_pre:.3f}" if lack_pre > 0.001 else "") + \
          (f",tpad=stop_mode=clone:stop_duration={lack_post:.3f}" if lack_post > 0.001 else "")
    # قبل أي حاجة: قص الكادر + عكس + لف + قلب + سرعة (على الفيديو الأصلي)
    pre_f = []
    cl, ct, cr, cb = (max(0.0, min(0.9, float(v or 0))) for v in (seg.crop or (0, 0, 0, 0)))
    if cl + cr > 0.001 or ct + cb > 0.001:
        cw, ch = max(0.1, 1 - cl - cr), max(0.1, 1 - ct - cb)
        pre_f.append(f"crop=w='trunc(iw*{cw:.4f}/2)*2':h='trunc(ih*{ch:.4f}/2)*2':x='iw*{cl:.4f}':y='ih*{ct:.4f}'")
    if seg.reverse:
        pre_f.append("reverse")
    rot = int(seg.rotate or 0) % 360
    if rot == 90:
        pre_f.append("transpose=1")
    elif rot == 180:
        pre_f.append("hflip,vflip")
    elif rot == 270:
        pre_f.append("transpose=2")
    if seg.flip_h:
        pre_f.append("hflip")
    if seg.flip_v:
        pre_f.append("vflip")
    if abs(sp - 1) > 1e-3:
        pre_f.append(f"setpts=PTS/{sp:.4f}")
    head = "[0:v]" + (",".join(pre_f) + "," if pre_f else "")
    z = max(1.0, seg.zoom)
    fades = ""
    if seg.fade_in > 0.01:
        fades += f",fade=t=in:st={pre:.3f}:d={min(seg.fade_in, seg.duration):.3f}"
    if seg.fade_out > 0.01:
        fades += f",fade=t=out:st={max(0.0, pre + seg.duration - seg.fade_out):.3f}:d={min(seg.fade_out, seg.duration):.3f}"
    # الوقت جوه القطعة (قبل ما نزوّد فريمات الترانزيشن الناقصة): t + (اللي اتزوّد قدام) − pre
    off = lack_pre - pre
    tl = f"(t{off:+.4f})"
    look = color_filters(seg) + post_fx(seg, tl)
    bg_color = seg.bg if re.fullmatch(r"#?[0-9a-fA-F]{6}", seg.bg or "") else "black"
    bg_color = ("0x" + bg_color.lstrip("#")) if bg_color != "black" else "black"
    if needs_motion(seg) and seg.src_w and seg.src_h:
        # التركيب الكامل: الصورة بمقاسها الأساسي، بتتلف وتتكبّر وتتحرك فريم بفريم فوق الخلفية
        sw, sh = seg.src_w * max(0.1, 1 - cl - cr), seg.src_h * max(0.1, 1 - ct - cb)
        if rot in (90, 270):
            sw, sh = sh, sw
        fit = seg.fit in ("blur", "black")
        k = min(WIDTH / sw, HEIGHT / sh) if fit else max(WIDTH / sw, HEIGHT / sh)
        bw, bh = max(2, round(sw * k / 2) * 2), max(2, round(sh * k / 2) * 2)
        m = motion_exprs(seg, f"clip({tl},0,{seg.duration:.4f})", tl)
        zexpr, aexpr, dxe, dye = m["z"], m["a"], m["dx"], m["dy"]
        fg = [f"scale={bw}:{bh},setsar=1"]
        # تسريع اللف: لو الصورة مالية الكادر ومفيش حركة بتغيّر الزووم أو المكان، بنشيل اللي عمره ما هيظهر
        # (قص متماثل حوالين نص الصورة، فنص اللف ومكان الصورة مبيتغيروش)
        slides = any(t.startswith("slide") or t in ("zoomin", "pop", "spin") for t, _ in (seg.anim_in, seg.anim_out))
        if aexpr != _f(0.0) and not fit and not seg.kf and not slides and seg.zoom >= 1:
            zz = seg.zoom * (1.1 if any(t == "pulse" for t, _ in seg.fx or []) else 1.0)
            reach = (WIDTH * WIDTH + HEIGHT * HEIGHT) ** 0.5 / 2 + WIDTH * 0.06
            px, py = abs(seg.x) * max(0, bw * seg.zoom - WIDTH) / 2, abs(seg.y) * max(0, bh * seg.zoom - HEIGHT) / 2
            kw = min(bw, round((px + reach) / zz) * 2 + 2) // 2 * 2
            kh = min(bh, round((py + reach) / zz) * 2 + 2) // 2 * 2
            if kw < bw or kh < bh:
                fg.append(f"crop={kw}:{kh}")
        fg.append("format=yuva420p")
        # ظهور واختفاء الصورة نفسها مع الحركة (لازم قبل اللف والتكبير عشان الشفافية متبوظش)
        st0 = pre - lack_pre
        for kind, (typ, d) in (("in", seg.anim_in), ("out", seg.anim_out)):
            if typ in ANIM_FADES and d > 0.01:
                d = min(d, seg.duration)
                st = st0 if kind == "in" else st0 + seg.duration - d
                fg.append(f"fade=t={kind}:st={max(0.0, st):.3f}:d={d:.3f}:alpha=1")
        if aexpr != _f(0.0):
            fg.append(f"rotate=a='({aexpr})*PI/180':ow='hypot(iw,ih)':oh='hypot(iw,ih)':c=black@0")
        fg.append(f"scale=w='max(2,trunc(iw*({zexpr})/2)*2)':h='max(2,trunc(ih*({zexpr})/2)*2)':eval=frame")
        # مكان نص الصورة: «يملا الكادر» بيتحرك جوه الزيادة، و«كامل» بيتحرك بنسبة من الكادر
        cwz = f"({bw}*({zexpr}))"
        chz = f"({bh}*({zexpr}))"
        if fit:
            cx, cy = f"{WIDTH / 2}+({m['x']})*{WIDTH / 2}", f"{HEIGHT / 2}+({m['y']})*{HEIGHT / 2}"
        else:
            cx = f"{WIDTH / 2}-({m['x']})*max(0,{cwz}-{WIDTH})/2"
            cy = f"{HEIGHT / 2}-({m['y']})*max(0,{chz}-{HEIGHT})/2"
        ox, oy = f"{cx}+({dxe})-w/2", f"{cy}+({dye})-h/2"
        if seg.fit == "blur":
            filters = [
                f"{head}split=2[bgs][fgs]",
                f"[bgs]scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase,crop={WIDTH}:{HEIGHT},boxblur=24:3,eq=brightness=-0.06,setsar=1[bg]",
                f"[fgs]{','.join(fg)}[fg]",
            ]
        else:
            filters = [f"{head}{','.join(fg)}[fg]", f"color=c={bg_color}:s={WIDTH}x{HEIGHT}:r={FPS}[bg]"]
        filters.append(f"[bg][fg]overlay=x='{ox}':y='{oy}':eval=frame:shortest=1,setsar=1,fps={FPS}{look}{pad}{fades},format=yuv420p[v]")
    elif seg.fit in ("blur", "black"):
        # الصورة كاملة جوه الكادر، والفاضي حواليها خلفية مغبّشة من نفس الفيديو أو لون
        fg_w, fg_h = f"{WIDTH}*{z:.4f}", f"{HEIGHT}*{z:.4f}"
        fg = f"scale=w='{fg_w}':h='{fg_h}':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1"
        ox, oy = f"(W-w)/2+{seg.x * WIDTH * 0.5:.1f}", f"(H-h)/2+{seg.y * HEIGHT * 0.5:.1f}"
        if seg.fit == "blur":
            filters = [
                f"{head}split=2[bgs][fgs]",
                f"[bgs]scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase,crop={WIDTH}:{HEIGHT},boxblur=24:3,eq=brightness=-0.06[bg]",
                f"[fgs]{fg}[fg]",
                f"[bg][fg]overlay=x='{ox}':y='{oy}',setsar=1,fps={FPS}{look}{pad}{fades},format=yuv420p[v]",
            ]
        else:
            filters = [
                f"{head}{fg}[fg]",
                f"color=c={bg_color}:s={WIDTH}x{HEIGHT}:r={FPS}[bg]",
                f"[bg][fg]overlay=x='{ox}':y='{oy}':shortest=1,setsar=1,fps={FPS}{look}{pad}{fades},format=yuv420p[v]",
            ]
    else:
        # بنقص الجزء اللي هيظهر من الفيديو الأصلي الأول وبعدين نكبّره، بدل ما نكبّر
        # الفيديو كله (لحد 3 أضعاف 1080×1920) ونقص منه — نفس النتيجة بذاكرة أقل بكتير
        filters = [
            f"{head}crop=w='min(iw,ih*{WIDTH}/{HEIGHT})/{z:.4f}':h='min(ih,iw*{HEIGHT}/{WIDTH})/{z:.4f}'"
            f":x='(iw-ow)/2*(1+({seg.x:.4f}))':y='(ih-oh)/2*(1+({seg.y:.4f}))',"
            f"scale={WIDTH}:{HEIGHT},setsar=1,fps={FPS}{look}{pad}{fades},format=yuv420p[v]"
        ]
    if seg.hide_video:
        filters[-1] = filters[-1].replace(",format=yuv420p[v]", f",drawbox=x=0:y=0:w=iw:h=ih:color={bg_color}:t=fill,format=yuv420p[v]")
    if seg.has_audio:
        audio_in = "[0:a]"
    else:
        # فيديو من غير صوت: نحط سكوت بنفس الطول عشان التركيب يمشي
        args += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
        audio_in = "[1:a]"
    delay = f"adelay={int(lack_pre * 1000)}:all=1," if lack_pre > 0.001 else ""
    a_pre = ("areverse," if seg.reverse and seg.has_audio else "") + (f"{atempo_chain(sp)}," if abs(sp - 1) > 1e-3 and seg.has_audio else "")
    a_fade = ""
    if seg.fade_in > 0.01:
        a_fade += f",afade=t=in:st={pre:.3f}:d={min(seg.fade_in, seg.duration):.3f}"
    if seg.fade_out > 0.01:
        a_fade += f",afade=t=out:st={max(0.0, pre + seg.duration - seg.fade_out):.3f}:d={min(seg.fade_out, seg.duration):.3f}"
    filters.append(
        f"{audio_in}aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,{a_pre}{delay}"
        f"volume={seg.volume:.3f},apad,atrim=0:{total:.3f}{a_fade}[a]"
    )
    return args + [
        "-filter_complex", ";".join(filters), "-map", "[v]", "-map", "[a]", "-t", f"{total:.3f}",
        # ملف مؤقت هيتضغط تاني: جودة عالية بس بحجم معقول عشان مساحة السيرفر متخلصش
        *encoder_args("veryfast", 16, low_memory),
        "-c:a", "flac", "-sample_fmt", "s16", str(output),
    ]


def build_commands(
    ffmpeg: str,
    segments: list[Segment],
    output: Path,
    work_dir: Path,
    voice: AudioTrack | list[AudioTrack] | None = None,
    music: AudioTrack | list[AudioTrack] | None = None,
    logo: Logo | None = None,
    subtitles: Subtitles | None = None,
    low_memory: bool = False,
    sounds: list[AudioTrack] | None = None,
    audio_fx: dict | None = None,
) -> tuple[list[list[str]], float]:
    """يبني أوامر FFmpeg بالترتيب ويرجّعها مع الطول النهائي للفيديو.

    كل قطعة بتتجهّز لوحدها الأول، وبعدين أمر أخير بيلزقهم ويحط اللوجو والكابشن
    والصوت. كده الذاكرة ثابتة مهما كان عدد القطع (لو كله في أمر واحد، كل قطعة
    بتفتح فيديو في نفس الوقت والذاكرة بتخلص على السيرفر).
    """
    if not segments:
        raise ValueError("مفيش فيديوهات في المونتاج")
    total = sum(s.duration for s in segments)
    work_dir.mkdir(parents=True, exist_ok=True)
    commands, parts = [], []
    # مدة كل ترانزيشن (بين القطعة k-1 وk)، مش أطول من 80٪ من أقصر القطعتين ومن غير ما نص الترانزيشنين يكلوا القطعة كلها
    tr = [0.0] * len(segments)
    for k in range(1, len(segments)):
        seg = segments[k]
        if seg.trans_in in TRANSITIONS and seg.trans_dur > 0:
            tr[k] = round(min(seg.trans_dur, 2.0, segments[k - 1].duration * 0.8, seg.duration * 0.8), 3)
    for k in range(len(segments)):   # القطعة مايتاكلش منها أكتر من 90٪ (ترانزيشن قبل + بعد)
        nxt = tr[k + 1] if k + 1 < len(segments) else 0.0
        over = (tr[k] + nxt) / 2 - segments[k].duration * 0.9
        if over > 0:
            if tr[k]: tr[k] = max(0.0, tr[k] - over)
            elif nxt: tr[k + 1] = max(0.0, nxt - over)
    if not any(tr):
        for n, seg in enumerate(segments):
            part = work_dir / f"seg{n:03d}.mkv"
            commands.append(segment_command(ffmpeg, seg, part, low_memory))
            parts.append(part)
    else:
        # كل قطعة بتتعمل ممدودة، وبعدين بتتقطع لجسم + نصين ترانزيشن، والترانزيشن بيتعمل من نص القطعتين
        ext = []
        for n, seg in enumerate(segments):
            pre, post = tr[n] / 2, (tr[n + 1] / 2 if n + 1 < len(segments) else 0.0)
            part = work_dir / f"ext{n:03d}.mkv"
            commands.append(segment_command(ffmpeg, seg, part, low_memory, pre, post))
            ext.append((part, pre, post, seg.duration))
        enc = [*encoder_args("veryfast", 16, low_memory), "-c:a", "flac", "-sample_fmt", "s16"]
        cut = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-threads", "1"]
        for n, (part, pre, post, dur) in enumerate(ext):
            body_from, body_len = 2 * pre, dur - pre - post
            if body_len >= 1 / FPS:
                body = work_dir / f"body{n:03d}.mkv"
                commands.append(cut + ["-ss", f"{body_from:.3f}", "-t", f"{body_len:.3f}", "-i", str(part), "-map", "0:v", "-map", "0:a",
                                       "-t", f"{body_len:.3f}", *enc, str(body)])
                parts.append(body)
            if n + 1 < len(ext) and tr[n + 1] > 0:
                d = tr[n + 1]
                b_part = ext[n + 1][0]
                chunk = work_dir / f"tr{n:03d}.mkv"
                a_from = pre + dur - post
                kind = segments[n + 1].trans_in
                commands.append(cut + ["-ss", f"{a_from:.3f}", "-t", f"{d:.3f}", "-i", str(part), "-ss", "0", "-t", f"{d:.3f}", "-i", str(b_part),
                                       "-filter_complex",
                                       # xfade محتاج القطعة الأولى أطول شوية من الترانزيشن، فبنثبّت آخر فريم شوية وبنقص الناتج
                                       f"[0:v]setpts=PTS-STARTPTS,fps={FPS},settb=AVTB,tpad=stop_mode=clone:stop_duration=0.3[a];"
                                       f"[1:v]setpts=PTS-STARTPTS,fps={FPS},settb=AVTB,tpad=stop_mode=clone:stop_duration=0.3[b];"
                                       f"[a][b]xfade=transition={kind}:duration={d:.3f}:offset=0,trim=0:{d:.3f},setpts=PTS-STARTPTS,format=yuv420p[v];"
                                       f"[0:a]asetpts=PTS-STARTPTS,afade=t=out:d={d:.3f}[x];[1:a]asetpts=PTS-STARTPTS,afade=t=in:d={d:.3f}[y];"
                                       f"[x][y]amix=inputs=2:normalize=0,atrim=0:{d:.3f}[au]",
                                       "-map", "[v]", "-map", "[au]", "-t", f"{d:.3f}", *enc, str(chunk)])
                parts.append(chunk)
    concat_list = work_dir / "list.txt"
    concat_list.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")

    base_args = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-filter_complex_threads", "1"]
    concat_in = ["-f", "concat", "-safe", "0", "-i", str(concat_list)]
    mixed, video = work_dir / "mix.flac", work_dir / "video.mp4"

    # (أ) الصوت لوحده: صوت الفيديوهات + قطع التعليق والموسيقى
    # كل ملف صوت بيتفتح مرة واحدة بس، وبنقسمه جوه لقطعه — FFmpeg 7.0 ممكن يعلّق لما
    # يبقى فيه مدخلات كتير ماشية بسرعات مختلفة في نفس الأمر
    def as_list(t):
        return [x for x in t if x] if isinstance(t, list) else ([t] if t else [])

    tracks = [("voice", t) for t in as_list(voice)] + [("music", t) for t in as_list(music)] + [("sound", t) for t in as_list(sounds)]
    afx = audio_fx or {}
    args = base_args + ["-vn"] + concat_in
    filters = ["[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[base]"]
    groups: dict[str, list[str]] = {"voice": [], "music": [], "sound": []}
    files: dict[Path, list[tuple[str, AudioTrack]]] = {}
    for kind, t in tracks:
        files.setdefault(t.path, []).append((kind, t))
    for fi, (path, parts_of_file) in enumerate(files.items(), start=1):
        args += ["-i", str(path)]
        outs = [f"[f{fi}p{k}]" for k in range(len(parts_of_file))]
        filters.append(
            f"[{fi}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,"
            f"asplit={len(outs)}{''.join(outs)}" if len(outs) > 1 else
            f"[{fi}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo{outs[0]}"
        )
        for k, (kind, track) in enumerate(parts_of_file):
            offset = max(0.0, track.offset)
            trim = f"atrim=start={offset:.3f}" + (f":duration={track.length:.3f}" if track.length else "")
            delay = max(0.0, track.delay)
            # بنأخّر القطعة بتغيير وقتها وaresample بيملا اللي قبلها سكوت.
            # adelay بيتجاهل التأخير لو جه بعد قص الصوت (في FFmpeg 7.0)، فالقطع كانت بتبدأ من أول الفيديو
            clean = ""
            if kind == "voice" and afx.get("enhance"):
                # تنضيف الصوت: شيل الزنّة الواطية والوشّ، وضغط خفيف يخلي الكلام واضح
                clean = "highpass=f=80,afftdn=nf=-25,acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=2,equalizer=f=3200:t=q:w=1.2:g=2.5,"
            chain = (
                f"{outs[k]}{trim},asetpts=PTS-STARTPTS+{delay:.3f}/TB,aresample=async=1:first_pts=0,{clean}"
                f"volume={track.volume:.3f},apad,atrim=0:{total:.3f}"
            )
            end_p = min(total, delay + track.length) if track.length else total
            if track.fade_in_s > 0.01:
                chain += f",afade=t=in:st={delay:.3f}:d={min(track.fade_in_s, max(0.01, end_p - delay)):.3f}"
            if track.fade_out_s > 0.01:
                d = min(track.fade_out_s, max(0.01, end_p - delay))
                chain += f",afade=t=out:st={max(delay, end_p - d):.3f}:d={d:.3f}"
            elif track.fade_out:
                # يختفي بالتدريج في آخره، أو في آخر الفيديو لو هو أطول منه
                end = min(total, delay + track.length) if track.length else total
                if end - delay > MUSIC_FADE_SECONDS:
                    chain += f",afade=t=out:st={end - MUSIC_FADE_SECONDS:.3f}:d={MUSIC_FADE_SECONDS}"
            label = f"[a{fi}_{k}]"
            filters.append(chain + label)
            groups[kind].append(label)

    def bus(labels: list[str], name: str) -> str | None:
        if not labels:
            return None
        if len(labels) == 1:
            return labels[0]
        filters.append(f"{''.join(labels)}amix=inputs={len(labels)}:duration=first:normalize=0[{name}]")
        return f"[{name}]"

    vbus, mbus, sbus = bus(groups["voice"], "vbus"), bus(groups["music"], "mbus"), bus(groups["sound"], "sbus")
    duck = max(0.0, min(1.0, float(afx.get("duck") or 0)))
    if vbus and mbus and duck > 0.01:
        # الموسيقى بتوطى لوحدها وقت الكلام (sidechain)
        filters.append(f"{vbus}asplit=2[vmain][vside]")
        filters.append(f"{mbus}[vside]sidechaincompress=threshold=0.02:ratio={1 + duck * 11:.2f}:attack=15:release=450:makeup=1[mduck]")
        vbus, mbus = "[vmain]", "[mduck]"
    mix = ["[base]"] + [b for b in (vbus, mbus, sbus) if b]
    tail = ",loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000" if afx.get("normalize") else ""
    if len(mix) > 1:
        filters.append(f"{''.join(mix)}amix=inputs={len(mix)}:duration=first:normalize=0{tail}[aout]")
    else:
        filters.append(f"[base]anull{tail}[aout]")
    commands.append(args + [
        "-filter_complex", ";".join(filters), "-map", "[aout]", "-t", f"{total:.3f}",
        "-c:a", "flac", "-sample_fmt", "s16", str(mixed),
    ])

    # (ب) الصورة لوحدها: الفيديوهات + اللوجو + الكابشن
    args = base_args + ["-an"] + concat_in
    filters = ["[0:v]null[vcat]"]
    video_label = "[vcat]"
    if logo:
        # صورة واحدة بس (من غير -loop): الـ overlay بيكرّر آخر فريم لوحده لآخر الفيديو
        args += ["-i", str(logo.path)]
        lw = max(2, int(WIDTH * logo.size / 100) // 2 * 2)
        filters.append(
            f"[1:v]scale={lw}:-2,format=rgba,colorchannelmixer=aa={max(0.0, min(1.0, logo.opacity)):.2f}[logo]"
        )
        enable = f":enable='lt(t,{logo.until:.3f})'" if logo.until else ""
        filters.append(
            f"{video_label}[logo]overlay=x='(W-w)*{logo.x / 100:.4f}':y='(H-h)*{logo.y / 100:.4f}'"
            f":eof_action=repeat{enable}[vlogo]"
        )
        video_label = "[vlogo]"
    if subtitles:
        from captions import filter_path

        filters.append(
            f"{video_label}subtitles=filename='{filter_path(subtitles.ass_path)}'"
            f":fontsdir='{filter_path(subtitles.fonts_dir)}'[vsub]"
        )
        video_label = "[vsub]"
    filters.append(f"{video_label}format=yuv420p[vout]")
    commands.append(args + [
        "-filter_complex", ";".join(filters), "-map", "[vout]", "-t", f"{total:.3f}",
        *encoder_args("veryfast", 20, low_memory), str(video),
    ])

    # (ج) نركّب الصوت على الصورة من غير ما نضغط الصورة تاني
    commands.append(base_args + [
        "-i", str(video), "-i", str(mixed), "-map", "0:v", "-map", "1:a", "-t", f"{total:.3f}",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(output),
    ])
    return commands, total
