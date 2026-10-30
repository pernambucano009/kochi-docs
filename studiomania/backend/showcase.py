"""🎬 الفيديو الاستعراضي: فيديو العميل نفسه بيتقطع لقطع صغيرة (٣-٥ ثواني)، وفي كل قطعة ميزة مختلفة من المنصة
(ترجمة وصوت أنقى، كلمات متحركة، زووم، نص ورا الشخص، خلفية جديدة، ألوان، زاوية كاميرا تانية، دبلجة بصوته، موسيقى ولقطات، خاتمة بشعاره).
في أول كل قطعة اسم الميزة مكتوب، وسعاد بتشرح كل قطعة وهي بتتعرض (did / can هنا بالإنجليزي عشان تتبعتلها).
الحاجات الغالية (الدبلجة بالليب سينك، الزاوية بالذكاء الاصطناعي) على جملة واحدة أو تلات ثواني بس، فبتبقى رخيصة.
الملف ده فيه الرسم بـ FFmpeg بس؛ أي خدمة خارجية (التفريغ، العقل، الصوت، الليب سينك…) بتيجي من app.py في ext."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import captions
import sfxlib
import textlayer

W, H, FPS = 1080, 1920, 30
SEG = 4.0   # طول القطعة العادية بالثواني

# الترتيب = ترتيب العرض. title: اللي مكتوب على الفيديو وفي الكارت. did / can: لسعاد (هي بتقولهم بلهجة العميل)
CHAPTERS = {
    "captions": {"title": "ترجمة تلقائية وصوت أنقى",
                 "did": "automatic on-screen captions in our style, and we cleaned the voice (less noise, clearer and louder)",
                 "can": "they can pick any caption style, font and colors, and we can clean background noise and echo from any recording"},
    "typo": {"title": "كلمات متحركة مع كلامك",
             "did": "kinetic typography: the key words pop on screen exactly when they say them, with small sound effects",
             "can": "dozens of typography styles, icons and stickers that replace words, all in their brand colors"},
    "zoom": {"title": "زووم على اللحظة المهمة",
             "did": "a punch-in zoom exactly on the most important word",
             "can": "since we write the script with them, we already know the important moments, so zooms, camera moves and emphasis land there automatically"},
    "behind": {"title": "النص خلفك",
               "did": "the big title is placed BEHIND them: we separate the person from the background in every single frame",
               "can": "titles behind the person, text that wraps around the head, and 3D text in the scene"},
    "bg": {"title": "خلفية جديدة بلا شاشة خضراء",
           "did": "we replaced the background behind them, with no green screen",
           "can": "film anywhere and appear in a studio, a clinic or any place they like, and remove unwanted things from the shot"},
    "grade": {"title": "تصحيح الألوان",
              "did": "professional color grading: the original on one side and the graded look on the other",
              "can": "one consistent color identity for all their videos, so their account looks like a brand"},
    "angle": {"title": "زاوية كاميرا ثانية بالذكاء الاصطناعي",
              "did": "from a single phone shot, AI created a second camera angle, like a two-camera shoot",
              "can": "a multi-camera feel without a second camera or a cameraman, for more dynamic videos"},
    "dub": {"title": "دبلجة بصوتك إلى لغة أخرى",
            "did": "we dubbed one sentence into another language in their OWN voice, with the lips moving with the new words",
            "can": "they can run a channel in every Arabic dialect and every language if they want, all in their own voice"},
    "finish": {"title": "موسيقى ومؤثرات ولقطات داعمة",
               "did": "music, sound effects and stock footage (B-roll) that illustrates what they are saying",
               "can": "the full edit is done automatically: fitting music, transitions and footage, ready to publish"},
    "outro": {"title": "خاتمة بشعارك",
              "did": "an ending with their logo and brand name",
              "can": "ready templates with their name and logo for every video in their field"},
}
CHAPTERS["titles"] = {"title": "عناوين متحركة على الفيديو",
                      "did": "animated titles with their message on top of the video (this video has no speech, so we wrote short titles)",
                      "can": "titles, prices and offers that move with the music, in their brand colors and fonts"}
CHAPTERS["dub_voice"] = {"title": "دبلجة التعليق الصوتي إلى لغة أخرى",
                         "did": "we dubbed the voice-over of this part into another language with a natural voice",
                         "can": "they can run a channel in every Arabic dialect and every language if they want"}
ORDER = ["captions", "typo", "zoom", "behind", "bg", "grade", "angle", "dub", "finish"]
# 🧭 الفيديو نوعه إيه؟ كل نوع ليه التعديلات اللي ليها معنى فيه بس (فيديو موسيقى بس مالوش ترجمة، ومن غير شخص مافيش «نص خلفك»)
TYPES = {
    "talking": {"label": "a person talking to the camera", "kinds": ORDER},
    "voiceover": {"label": "footage with a voice-over (no one talking to the camera)",
                  "kinds": ["captions", "typo", "zoom", "behind", "bg", "grade", "angle", "dub_voice", "finish"]},
    "people_music": {"label": "people on screen but no speech (music only)", "kinds": ["titles", "zoom", "behind", "bg", "grade", "angle", "finish"]},
    "broll_music": {"label": "no people and no speech (product/place footage with music)", "kinds": ["titles", "zoom", "grade", "angle", "finish"]},
}
# الزووم من غير كلام: على اللحظة المهمة في الصورة مش على كلمة
ZOOM_NO_SPEECH = "a punch-in zoom on the key moment of the shot"
NEEDS_PERSON = {"behind", "bg"}
SPEECH = {"captions", "typo", "dub", "dub_voice"}


def video_type(has_speech: bool, people: bool, talking: bool) -> str:
    if has_speech and people and talking:
        return "talking"
    if has_speech:
        return "voiceover"
    return "people_music" if people else "broll_music"


def sample_frames(ffmpeg: str, src: Path, dur: float, folder: Path, n: int = 6) -> list[Path]:
    out = []
    for k in range(n):
        f = folder / f"cls_{k}.jpg"
        r = subprocess.run(ff(ffmpeg) + ["-ss", f"{dur * (k + .5) / n:.2f}", "-i", str(src), "-frames:v", "1", "-vf", "scale=384:-2", "-q:v", "5", str(f)],
                           capture_output=True, timeout=60)
        if r.returncode == 0 and f.exists():
            out.append(f)
    return out


CLASSIFY_PROMPT = ("These are frames from one short social-media video, in order, plus what is said in it (may be empty). Answer JSON only: "
                   '{"people": true/false (a real person is clearly visible in most frames), '
                   '"talking_person": true/false (a visible person speaks to the camera, not only a voice-over), '
                   '"what": "one short English sentence: what the video shows"}. Spoken: ')
AR_DIGITS = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


class ShowcaseError(Exception):
    pass


# ---------------------------------------------------------------- FFmpeg
def run(cmd: list[str], timeout: int = 900) -> None:
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        raise ShowcaseError((r.stderr or "ffmpeg failed")[-700:])


def ff(ffmpeg: str) -> list[str]:
    return [ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]


ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", "-r", str(FPS),
       "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart"]
COVER = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1"


def probe(ffmpeg: str, path: Path) -> tuple[float, bool]:
    """المدة، وفيه صوت ولا لأ."""
    err = subprocess.run([ffmpeg, "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err)
    dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)) if m else 0.0
    return dur, "Audio:" in err


def normalize(ffmpeg: str, src: Path, out: Path, max_s: float = 90) -> float:
    """أي فيديو ← طولي 1080×1920، 30 فريم، بصوت (لو مفيش صوت بيتحط سكوت)."""
    dur, has_a = probe(ffmpeg, src)
    if dur < 1:
        raise ShowcaseError("الفيديو قصير جدًا أو غير مقروء")
    t = min(dur, max_s)
    ins = ["-i", str(src)] + ([] if has_a else ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"])
    run(ff(ffmpeg) + ins + ["-t", f"{t:.3f}", "-vf", f"{COVER},fps={FPS}", "-map", "0:v:0", "-map", "0:a:0" if has_a else "1:a:0", *ENC, str(out)], 1200)
    return t


def mean_volume(ffmpeg: str, path: Path) -> float | None:
    r = subprocess.run([ffmpeg, "-hide_banner", "-i", str(path), "-vn", "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True, timeout=120)
    m = re.search(r"mean_volume:\s*(-?[\d.]+) dB", r.stderr or "")
    return float(m.group(1)) if m else None


def luma(ffmpeg: str, path: Path, t: float) -> float:
    """متوسط الإضاءة في لقطة (0-255): التصحيح بيفتّح الفيديو الغامق بدل ما يغمّقه أكتر."""
    r = subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", str(path), "-frames:v", "1", "-vf", "scale=64:-2,format=gray",
                        "-f", "rawvideo", "-"], capture_output=True, timeout=60)
    return sum(r.stdout) / len(r.stdout) if r.stdout else 128.0


def cut(ffmpeg: str, src: Path, s: float, d: float, out: Path) -> Path:
    run(ff(ffmpeg) + ["-ss", f"{s:.3f}", "-i", str(src), "-t", f"{d:.3f}", *ENC, str(out)])
    return out


def sub(ass: Path, fonts: Path) -> str:
    return f"subtitles=filename='{captions.filter_path(ass)}':fontsdir='{captions.filter_path(fonts)}'"


# ---------------------------------------------------------------- ASS (اسم الميزة، قبل/بعد، النص الكبير)
def _ts(t: float) -> str:
    return captions.ass_time(max(0.0, t))


def ass_doc(styles: list[str], events: list[str]) -> str:
    return "\n".join([
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}", "WrapStyle: 0", "ScaledBorderAndShadow: yes", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, "
        "StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        *styles, "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text", *events]) + "\n"


def label_ass(n: int, total: int, title: str, color: str = "#E5613E", extra: list[str] | None = None, styles: list[str] | None = None) -> str:
    """اسم الميزة فوق في أول القطعة (شريط ملوّن)، ورقمها."""
    box = textlayer.ass_color(color)
    base = [f"Style: L,SM Tajawal,64,&H00FFFFFF,&H00FFFFFF,{box},{box},-1,0,0,0,100,100,0,0,3,22,0,5,40,40,0,1",
              "Style: N,SM Tajawal,40,&H00FFFFFF,&H00FFFFFF,&H64000000,&H64000000,-1,0,0,0,100,100,0,0,3,12,0,5,40,40,0,1",
              "Style: B,SM Tajawal,52,&H00FFFFFF,&H00FFFFFF,&H8C000000,&H8C000000,-1,0,0,0,100,100,0,0,3,14,0,5,40,40,0,1"]
    num = f"{n}/{total}".translate(AR_DIGITS)
    if not title:   # جوه القطعة: الإضافات بس (قبل/بعد، اللغة). الاسم والرقم بيتكتبوا في الآخر بعد ما نعرف كام قطعة نجحت
        return ass_doc(base + (styles or []), extra or [])
    ev = [f"Dialogue: 2,{_ts(0.15)},{_ts(2.6)},N,,0,0,0,,{{\\pos({W // 2},140)\\fad(200,250)}}{num}",
          f"Dialogue: 2,{_ts(0.15)},{_ts(2.6)},L,,0,0,0,,{{\\pos({W // 2},235)\\fad(200,250)\\fscx88\\fscy88\\t(0,180,\\fscx100\\fscy100)}}{title}"]
    return ass_doc(base + (styles or []), ev + (extra or []))


def write(path: Path, text: str) -> Path:
    path.write_text(text, encoding="utf-8")
    return path


# ---------------------------------------------------------------- الصوت: مؤثرات على مكانها
def sfx_mix(sfx_dir: Path, events: list[tuple[str, float, float]], first: int) -> tuple[list[str], str, int]:
    """events: (الاسم، الوقت، الصوت) ← مدخلات إضافية + فلتر بيدمجهم مع [0:a] في [a]."""
    ins, parts = [], []
    for k, (name, t, vol) in enumerate(events):
        ins += ["-i", str(sfxlib.ensure(sfx_dir, name))]
        ms = max(0, int(t * 1000))
        parts.append(f"[{first + k}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms},volume={vol:.2f}[s{k}]")
    if not events:
        return [], "[0:a]anull[a]", 0
    mix = "[0:a]" + "".join(f"[s{k}]" for k in range(len(events)))
    parts.append(f"{mix}amix=inputs={len(events) + 1}:normalize=0:duration=first,alimiter=limit=0.95[a]")
    return ins, ";".join(parts), len(events)


# ---------------------------------------------------------------- اختيار القطع من الكلام
def _plain(w: str) -> str:
    return re.sub(r"[^\w]", "", re.sub(r"[ً-ْ]", "", str(w or "")).replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")).lower()


def sentences(words: list[dict], gap: float = 0.45) -> list[tuple[int, int]]:
    """الجمل: (أول كلمة، آخر كلمة) عند الوقفات أو علامات الترقيم."""
    out, a = [], 0
    for i in range(len(words)):
        end = i == len(words) - 1 or words[i + 1]["s"] - words[i]["e"] > gap or re.search(r"[.!?؟،,]$", str(words[i]["w"]))
        if end:
            out.append((a, i))
            a = i + 1
    return out


def windows(words: list[dict], dur: float, kinds: list[str]) -> dict[str, tuple[float, float]]:
    """كل ميزة ← (بداية، نهاية) في الفيديو: موزعين على طوله، ومتظبطين على أول وآخر كلمة.
    الدبلجة: جملة كاملة (٢-٦ ثواني) عشان الكلام الجديد يتقال كله في مكانها."""
    n = len(kinds)
    out: dict[str, tuple[float, float]] = {}
    span = max(0.0, dur - SEG)
    starts = [span * i / max(1, n - 1) for i in range(n)]
    taken: list[tuple[float, float]] = []
    if "dub" in kinds and words:
        slot = starts[kinds.index("dub")]
        cands = [(words[a]["s"], words[b]["e"]) for a, b in sentences(words) if 1.8 <= words[b]["e"] - words[a]["s"] <= 6.5]
        if cands:
            s, e = min(cands, key=lambda c: abs(c[0] - slot))
            out["dub"] = (max(0.0, s - 0.12), min(dur, e + 0.25))
            taken.append(out["dub"])
    for kind, t in zip(kinds, starts):
        if kind in out:
            continue
        if words:   # تبدأ مع أول كلمة قريبة، وتخلص بعد آخر كلمة جوه الوقت (من غير ما تقطع كلمة في نصها)
            near = min(words, key=lambda w: abs(w["s"] - t))
            if abs(near["s"] - t) < 1.2:
                t = max(0.0, near["s"] - 0.1)
        t = min(t, span)
        e = t + SEG
        inside = [w for w in words if t < w["e"] <= e + 0.4]
        if inside and inside[-1]["e"] - t >= 3.0:
            e = min(dur, inside[-1]["e"] + 0.2)
        # لو الفيديو طويل كفاية: بلاش تتداخل مع جملة الدبلجة (نفس الكلام مرتين)
        for a, b in taken:
            if t < b and e > a and dur > SEG * n:
                t, e = b, min(dur, b + SEG)
        out[kind] = (round(t, 3), round(min(e, dur), 3))
    return out


def rel(words: list[dict], s: float, e: float) -> list[dict]:
    return [{"w": w["w"], "s": round(max(0.0, w["s"] - s), 3), "e": round(min(e, w["e"]) - s, 3)} for w in words if w["s"] >= s - 0.05 and w["s"] < e - 0.1]


def find(words: list[dict], wanted: list[str]) -> list[dict]:
    """الكلمات اللي العقل اختارها ← مكانها في الكلام (بالترتيب، من غير تكرار)."""
    out, used = [], set()
    for x in wanted:
        px = _plain(x)
        for i, w in enumerate(words):
            pw = _plain(w["w"])
            if i not in used and px and pw and (pw == px or (len(px) > 2 and (px in pw or pw in px))):
                used.add(i)
                out.append(w)
                break
    return sorted(out, key=lambda w: w["s"])


def key_words(words: list[dict], n: int = 3) -> list[dict]:
    """من غير العقل: أطول كلمات في القطعة (غالبًا هي المهمة)."""
    return sorted(sorted(words, key=lambda w: -len(_plain(w["w"])))[:n], key=lambda w: w["s"])


def plan_messages(texts: dict[str, str], brand: str, niche: str, dub_lang: str, what: str = "", speech: bool = True) -> list[dict]:
    rows = "\n".join(f"- {k}: «{v}»" for k, v in texts.items()) if speech else "(this video has no speech)"
    return [{"role": "user", "content": (
        "We are editing a short showcase reel from a creator's own video. Each part below is a few seconds of what they say.\n"
        f"Brand: {brand or '-'}. Field: {niche or '-'}. The video shows: {what or '-'}.\nParts:\n{rows}\n\n"
        "Return JSON only:\n"
        '{"titles": ["2-4 very short on-screen titles (2-4 words each) in Arabic about what the video shows and the brand (only used if there is no speech)"],\n'
        ' "typo": ["2-4 key words copied EXACTLY from the typo part, in spoken order"],\n'
        ' "zoom": "the single most important word copied EXACTLY from the zoom part",\n'
        ' "behind": "1-2 short words to show huge behind the person (from the behind part, or the brand name), in the same language",\n'
        f' "dub": "the dub part translated into {dub_lang}, natural spoken style, about the same length",\n'
        ' "broll": "an English stock-video search query (2-4 words) that illustrates the IDEA of the finish part in the context of their field (not a literal word; adults, no children or schools unless the field is about them)",\n'
        ' "bg": "an English stock-photo search query (2-4 words) for a nice, clean place that fits THEIR field (e.g. a modern gym, a dental clinic, a cafe); no people",\n'
        ' "music": "an English music search query (2-3 words) for a fitting upbeat background track"}')}]


def clean_plan(raw: dict) -> dict:
    s = lambda k, n: str(raw.get(k) or "").strip()[:n]  # noqa: E731
    typo = [str(x).strip()[:40] for x in raw.get("typo") or [] if str(x).strip()][:4] if isinstance(raw.get("typo"), list) else []
    titles = [str(x).strip()[:40] for x in raw.get("titles") or [] if str(x).strip()][:4] if isinstance(raw.get("titles"), list) else []
    return {"titles": titles, "typo": typo, "zoom": s("zoom", 40), "behind": s("behind", 24), "dub": s("dub", 300),
            "broll": s("broll", 60), "bg": s("bg", 60), "music": s("music", 60)}


# ---------------------------------------------------------------- كل ميزة
def fx_captions(c: dict, clip: Path, out: Path, d: float, words: list[dict], lab: str) -> None:
    caps = write(c["work"] / "cap_captions.ass", captions.build_ass(words, {"template": "kochi"}, d, (W, H)))
    vf = f"{sub(caps, c['fonts'])},{sub(lab, c['fonts'])}" if words else sub(lab, c["fonts"])
    af = "highpass=f=90,afftdn=nf=-25,acompressor=threshold=-22dB:ratio=3:attack=5:release=120"   # العلو بيتظبط مع باقي القطع في الآخر
    run(ff(c["ffmpeg"]) + ["-i", str(clip), "-vf", vf, "-af", af, "-t", f"{d:.3f}", *ENC, str(out)])


def fx_typo(c: dict, clip: Path, out: Path, d: float, words: list[dict], lab: Path, pick: list[str]) -> None:
    ws = find(words, pick) or key_words(words)
    color = c["colors"][0] if c["colors"] else "#FFD400"
    items = []
    for k, w in enumerate(ws):
        nxt = ws[k + 1]["s"] if k + 1 < len(ws) else d
        items.append({"text": w["w"], "t0": w["s"], "dur": max(0.5, min(nxt, d) - w["s"]), "font": "SM Lalezar", "size": 190,
                      "color": "#FFFFFF" if k % 2 == 0 else color, "y": 0.42 + 0.05 * (k % 2), "x": 0.5, "angle": (-4, 3, -2, 4)[k % 4],
                      "stroke": {"w": 10, "color": "#000000"}, "shadow": True,
                      "anim_in": {"type": "pop", "dur": 0.28}, "anim_out": {"type": "fade", "dur": 0.15}})
    t = textlayer.build_ass(items, d, W, H)
    vf = sub(lab, c["fonts"]) if not t else f"{sub(write(c['work'] / 'typo.ass', t), c['fonts'])},{sub(lab, c['fonts'])}"
    ins, af, _ = sfx_mix(c["sfx"], [("pop", w["s"], 0.55) for w in ws], 1)
    run(ff(c["ffmpeg"]) + ["-i", str(clip), *ins, "-filter_complex", f"[0:v]{vf}[v];{af}", "-map", "[v]", "-map", "[a]", "-t", f"{d:.3f}", *ENC, str(out)])


def fx_titles(c: dict, clip: Path, out: Path, d: float, lab: Path, titles: list[str]) -> None:
    """فيديو من غير كلام: عناوين قصيرة برسالته بتظهر ورا بعض على الإيقاع (مع صوت بوب)."""
    color = c["colors"][0] if c["colors"] else "#FFD400"
    n = max(1, len(titles))
    step_t = (d - 0.5) / n
    items = [{"text": tt, "t0": 0.4 + k * step_t, "dur": step_t, "font": "SM Lalezar", "size": 150 if len(tt) < 14 else 105,
              "color": "#FFFFFF" if k % 2 == 0 else color, "y": 0.5, "x": 0.5, "stroke": {"w": 10, "color": "#000000"}, "shadow": True,
              "anim_in": {"type": "pop", "dur": 0.3}, "anim_out": {"type": "fade", "dur": 0.2}} for k, tt in enumerate(titles)]
    t = textlayer.build_ass(items, d, W, H)
    vf = sub(lab, c["fonts"]) if not t else f"{sub(write(c['work'] / 'titles.ass', t), c['fonts'])},{sub(lab, c['fonts'])}"
    ins, af, _ = sfx_mix(c["sfx"], [("pop", x["t0"], 0.5) for x in items], 1)
    run(ff(c["ffmpeg"]) + ["-i", str(clip), *ins, "-filter_complex", f"[0:v]{vf}[v];{af}", "-map", "[v]", "-map", "[a]", "-t", f"{d:.3f}", *ENC, str(out)])


def fx_zoom(c: dict, clip: Path, out: Path, d: float, words: list[dict], lab: Path, pick: str) -> None:
    w = (find(words, [pick]) or key_words(words, 1) or [{"s": d * 0.4}])[0]
    tk = max(0.4, min(d - 0.8, w["s"] - 0.05))
    p = f"clip((it-{tk:.3f})/0.32,0,1)"
    z = f"1+0.3*{p}*{p}*(3-2*{p})"
    hy = c.get("head_y") or 0.36
    zp = f"zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih*{hy:.3f}-(ih/zoom*{hy:.3f})':d=1:s={W}x{H}:fps={FPS}"
    ins, af, _ = sfx_mix(c["sfx"], [("whoosh", tk - 0.2, 0.5), ("impact", tk, 0.35)], 1)
    run(ff(c["ffmpeg"]) + ["-i", str(clip), *ins, "-filter_complex", f"[0:v]{zp},{sub(lab, c['fonts'])}[v];{af}",
                           "-map", "[v]", "-map", "[a]", "-t", f"{d:.3f}", *ENC, str(out)])


def person_masks(c: dict, clip: Path, d: float, name: str) -> tuple[Path, dict] | None:
    """الشخص في كل فريم (ماسك أبيض وأسود بحجم الفيديو). من غير الموديل: None والقطعة دي بتتشال."""
    fn = c["ext"].get("person")
    if not fn:
        return None
    folder = c["work"] / f"person_{name}"
    try:
        info = fn(clip, folder, d)
    except Exception as exc:  # noqa: BLE001
        print(f"showcase person: {exc}", flush=True)
        return None
    if not info or not info.get("n"):
        return None
    return folder, info


def _person_layer(mask_dir: Path) -> list[str]:
    return ["-framerate", str(FPS), "-i", str(mask_dir / "m_%05d.webp")]


def behind_text(text: str, brand: str, words: list[dict]) -> str:
    """كلمة أو اتنين بس، بلغة واحدة (من غير خلط عربي وإنجليزي)، وقصيرة كفاية تبان في عرض الكادر."""
    def ok(x: str) -> str:
        x = re.sub(r"\s+", " ", str(x or "")).strip()
        ar, lat = bool(re.search(r"[\u0600-\u06ff]", x)), bool(re.search(r"[A-Za-z]", x))
        if ar and lat:   # خليط: الجزء العربي بس
            x = " ".join(w for w in x.split() if re.search(r"[\u0600-\u06ff]", w) and not re.search(r"[A-Za-z]", w))
        x = " ".join([w for w in x.split() if len(w) > 1][:2])
        return x if 2 <= len(x) <= 12 else ""
    return ok(text) or ok(brand) or ok((key_words(words, 1) or [{"w": ""}])[0]["w"]) or "✦"


def fx_behind(c: dict, clip: Path, out: Path, d: float, words: list[dict], lab: Path, text: str, masks: tuple[Path, dict]) -> None:
    folder, info = masks
    text = behind_text(text, c.get("brand") or "", words)
    hy = c.get("head_y") or 0.32
    color = c["colors"][0] if c["colors"] else "#FFD400"
    # الكلمة كلها لازم تبان في عرض الكادر (الحرف العريض تقريبًا نص حجم الخط)
    size = max(120, min(330, int(W * 0.9 / max(1, len(text)) / 0.52)))
    t = textlayer.build_ass([{"text": text, "t0": 0.25, "dur": d - 0.25, "font": "SM Lalezar", "size": size,
                              "color": color, "y": max(0.2, min(0.45, hy)), "x": 0.5, "shadow": True,
                              "anim_in": {"type": "zoom", "dur": 0.6}}], d, W, H)
    big = write(c["work"] / "behind.ass", t or "")
    ins, af, _ = sfx_mix(c["sfx"], [("riser", 0.0, 0.3), ("boom", 0.25, 0.4)], 2)
    fc = (f"[0:v]split=2[a][b];[a]{sub(big, c['fonts'])}[t];[1:v]format=rgba,alphaextract,scale={W}:{H},format=gray[m];"
          f"[b]format=yuv420p[bb];[bb][m]alphamerge[p];[t][p]overlay=0:0:eof_action=pass:format=auto,format=yuv420p,{sub(lab, c['fonts'])}[v];{af}")
    run(ff(c["ffmpeg"]) + ["-i", str(clip), *_person_layer(folder), *ins, "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-t", f"{d:.3f}", *ENC, str(out)])


def fx_bg(c: dict, clip: Path, out: Path, d: float, lab: Path, masks: tuple[Path, dict], bg: Path | None) -> None:
    folder, _ = masks
    cols = (c["colors"] + ["#1B2A4A", "#E5613E"])[:2]
    if bg:
        bg_in = ["-loop", "1", "-t", f"{d:.3f}", "-i", str(bg)]
        bgf = f"[2:v]{COVER},fps={FPS},zoompan=z='1.04+0.03*on/{int(d * FPS)}':d=1:s={W}x{H}:fps={FPS},eq=brightness=-0.04[bg]"
    else:   # من غير مكتبة الصور: تدرّج بألوان العلامة
        bg_in = ["-f", "lavfi", "-t", f"{d:.3f}", "-i", f"gradients=s={W}x{H}:c0=0x{cols[0][1:]}:c1=0x{cols[1][1:]}:x0=0:y0=0:x1={W}:y1={H}:speed=0.02:r={FPS}"]
        bgf = "[2:v]format=yuv420p,vignette=PI/5[bg]"
    ins, af, _ = sfx_mix(c["sfx"], [("swipe", 0.1, 0.45)], 3)
    fc = (f"{bgf};[1:v]format=rgba,alphaextract,scale={W}:{H},format=gray[m];[0:v]format=yuv420p[p0];[p0][m]alphamerge[p];"
          f"[bg][p]overlay=0:0:eof_action=pass:format=auto,format=yuv420p,{sub(lab, c['fonts'])}[v];{af}")
    run(ff(c["ffmpeg"]) + ["-i", str(clip), *_person_layer(folder), *bg_in, *ins, "-filter_complex", fc,
                           "-map", "[v]", "-map", "[a]", "-t", f"{d:.3f}", *ENC, str(out)])


# 🎨 «لوك» سينمائي: تباين أعلى، ألوان أغنى، ظلال مايلة للأزرق وبشرة دافية، وفينيت خفيف
GRADE = "eq=contrast=1.13:saturation=1.28:gamma=0.97,colorbalance=rs=-0.05:gs=-0.01:bs=0.07:rh=0.06:gh=0.01:bh=-0.07,vignette=PI/5"


def grade_for(y: float) -> str:
    """التصحيح على قد الفيديو: الغامق بيفتح (من غير فينيت يغمّق الأطراف)، والفاتح بياخد عمق، وكله ألوان أنضف وحدّة خفيفة."""
    if y < 105:
        return ("eq=gamma=1.22:brightness=0.03:contrast=1.06:saturation=1.15,colorbalance=rs=-0.02:bs=0.03:rh=0.04:bh=-0.03,"
                "unsharp=5:5:0.5")
    if y > 175:
        return "eq=gamma=0.94:contrast=1.1:saturation=1.2,colorbalance=rs=-0.03:bs=0.05:rh=0.05:bh=-0.05,unsharp=5:5:0.4"
    return "eq=gamma=1.04:contrast=1.1:saturation=1.22,colorbalance=rs=-0.03:bs=0.05:rh=0.05:bh=-0.05,unsharp=5:5:0.4,vignette=PI/7"


def fx_grade(c: dict, clip: Path, out: Path, d: float, lab: Path) -> None:
    """قبل وبعد في نفس الكادر: خط بيمشي من اليمين للشمال، اللي عدّى عليه بقى بالألوان الجديدة."""
    a, b = 0.7, min(d - 0.6, 2.6)
    p = f"clip((T-{a})/{b - a:.2f},0,1)"
    st = ["Style: S,SM Tajawal,54,&H00FFFFFF,&H00FFFFFF,&H8C000000,&H8C000000,-1,0,0,0,100,100,0,0,3,14,0,5,0,0,0,1"]
    extra = [f"Dialogue: 3,{_ts(0.4)},{_ts(d)},S,,0,0,0,,{{\\pos({int(W * 0.18)},{int(H * 0.86)})\\fad(200,0)}}قبل",
             f"Dialogue: 3,{_ts(0.4)},{_ts(d)},S,,0,0,0,,{{\\pos({int(W * 0.82)},{int(H * 0.86)})\\fad(200,0)}}بعد"]
    lab2 = write(c["work"] / "grade_lab.ass", label_ass(0, 0, "", c["accent"], extra, st))
    fc = (f"[0:v]split=2[o][g];[g]{GRADE}[gg];[o][gg]blend=all_expr='if(gte(X,W*(1-{p})),B,A)',"
          f"drawbox=x='iw*(1-clip((t-{a})/{b - a:.2f},0,1))-3':y=0:w=6:h=ih:color=white@0.9:t=fill,{sub(lab2, c['fonts'])}[v]")
    run(ff(c["ffmpeg"]) + ["-i", str(clip), "-filter_complex", fc.replace(GRADE, grade_for(luma(c["ffmpeg"], clip, d / 2))), "-map", "[v]", "-map", "0:a",
                           "-t", f"{d:.3f}", *ENC, str(out)])


ANGLE_PROMPT = ("Show this exact same moment filmed by a second camera from a different angle: a three-quarter side view from the "
                "person's left, slightly lower and a bit closer, like a professional two-camera interview. Keep the same person, face, "
                "hair, clothes, background, lighting, mouth movements, gestures and timing exactly the same. No text, no new objects.")


def fx_angle(c: dict, clip: Path, out: Path, d: float, lab: Path) -> None:
    """أول ثانية من الزاوية الأصلية، وبعدها قطع على الزاوية التانية (اللي اتعملت بالذكاء الاصطناعي)، والصوت هو هو."""
    a = 1.0
    part = cut(c["ffmpeg"], clip, a, d - a, c["work"] / "angle_src.mp4")
    gen = c["ext"]["angle"](part, ANGLE_PROMPT, d - a, c["work"] / "angle_ai.mp4")
    ins, af, _ = sfx_mix(c["sfx"], [("shutter", a - 0.05, 0.4)], 2)
    fc = (f"[0:v]trim=0:{a},setpts=PTS-STARTPTS[v0];[1:v]{COVER},fps={FPS},trim=0:{d - a:.3f},setpts=PTS-STARTPTS,"
          f"tpad=stop_mode=clone:stop_duration=2[v1];[v0][v1]concat=n=2:v=1:a=0,trim=0:{d:.3f},setpts=PTS-STARTPTS,{sub(lab, c['fonts'])}[v];{af}")
    run(ff(c["ffmpeg"]) + ["-i", str(clip), "-i", str(gen), *ins, "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-t", f"{d:.3f}", *ENC, str(out)])


def fx_dub(c: dict, clip: Path, out: Path, d: float, lab: Path, text: str, lang_label: str, lip: bool = True) -> None:
    """الجملة بلغة تانية بصوته هو (نسخة من صوته)، والشفايف بتتحرك على الكلام الجديد. lip=False: تعليق صوتي (مفيش شفايف)."""
    voice = c["ext"]["speak"](text, c["work"] / "dub_voice.wav", d)
    fit = c["work"] / "dub_fit.wav"
    vd, _ = probe(c["ffmpeg"], voice)
    tempo = min(1.35, vd / max(0.5, d - 0.15)) if vd > d - 0.15 else 1.0
    run(ff(c["ffmpeg"]) + ["-i", str(voice), "-af", f"atempo={tempo:.3f},adelay=80|80,apad=whole_dur={d:.3f},atrim=0:{d:.3f}",
                           "-ac", "2", "-ar", "48000", str(fit)])
    lip = c["ext"]["lipsync"](clip, fit, c["work"] / "dub_lip.mp4", d) if lip else clip
    words = captions.words_from_text(text, 0.15, max(0.6, min(d, vd / tempo + 0.1)))
    caps = write(c["work"] / "dub_caps.ass", captions.build_ass(words, {"template": "classic"}, d, (W, H)))
    st = "Style: G,SM Tajawal,50,&H00FFFFFF,&H00FFFFFF,&H8CE5613E,&H8CE5613E,-1,0,0,0,100,100,0,0,3,14,0,5,0,0,0,1"
    lab2 = write(c["work"] / "dub_lab.ass", label_ass(0, 0, "", c["accent"],
                                                       [f"Dialogue: 3,{_ts(0.3)},{_ts(d)},G,,0,0,0,,{{\\pos({W // 2},330)\\fad(250,0)}}{lang_label}"], [st]))
    run(ff(c["ffmpeg"]) + ["-i", str(lip), "-i", str(fit), "-filter_complex",
                           f"[0:v]{COVER},fps={FPS},tpad=stop_mode=clone:stop_duration=2,trim=0:{d:.3f},setpts=PTS-STARTPTS,{sub(caps, c['fonts'])},{sub(lab2, c['fonts'])}[v]",
                           "-map", "[v]", "-map", "1:a", "-t", f"{d:.3f}", *ENC, str(out)])


def fx_finish(c: dict, clip: Path, out: Path, d: float, words: list[dict], lab: Path, broll: Path | None, music: Path | None) -> None:
    """موسيقى تحت الكلام، ومؤثرات، ولقطة داعمة في النص (من مكتبة الفيديوهات) والكلام شغال عليها."""
    caps = write(c["work"] / "cap_finish.ass", captions.build_ass(words, {"template": "tiktok"}, d, (W, H)))
    a0, a1 = 1.1, min(d - 0.7, 2.9)
    ins, n_in, fc = ["-i", str(clip)], 1, []
    vlab = "[0:v]"
    if broll:
        ins += ["-i", str(broll)]
        fc.append(f"[1:v]{COVER},fps={FPS},trim=0:{a1 - a0:.3f},setpts=PTS-STARTPTS+{a0}/TB[br]")
        fc.append(f"[0:v][br]overlay=0:0:eof_action=pass:enable='between(t,{a0},{a1})'[vb]")
        vlab, n_in = "[vb]", 2
    fc.append(f"{vlab}{sub(caps, c['fonts'])},{sub(lab, c['fonts'])}[v]")
    if music:
        ins += ["-i", str(music)]
        fc.append(f"[{n_in}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{d:.3f},afade=t=in:d=0.4,"
                  f"afade=t=out:st={max(0.0, d - 0.5):.2f}:d=0.5,volume=0.16[mu]")
        fc.append("[0:a][mu]amix=inputs=2:normalize=0:duration=first[a0]")
        n_in += 1
    else:
        fc.append("[0:a]anull[a0]")
    sx = [("whoosh", a0 - 0.2, 0.45), ("whoosh_rev", a1 - 0.2, 0.35)] if broll else [("whoosh", 0.05, 0.4)]
    sins, saf, _ = sfx_mix(c["sfx"], sx, n_in)
    fc.append(saf.replace("[0:a]", "[a0]"))
    run(ff(c["ffmpeg"]) + ins + sins + ["-filter_complex", ";".join(fc), "-map", "[v]", "-map", "[a]", "-t", f"{d:.3f}", *ENC, str(out)])


def fx_outro(c: dict, out: Path, lab: Path) -> float:
    import firstvid
    raw = c["work"] / "outro_raw.mp4"
    firstvid.outro(c["ffmpeg"], raw, c.get("logo"), c.get("brand") or "", c["colors"], c["font"], (W, H), 2.8, FPS)
    d, _ = probe(c["ffmpeg"], raw)
    ins, af, _ = sfx_mix(c["sfx"], [("success", 0.25, 0.5)], 2)
    run(ff(c["ffmpeg"]) + ["-i", str(raw), "-f", "lavfi", "-t", f"{d:.3f}", "-i", "anullsrc=r=48000:cl=stereo", *ins,
                           "-filter_complex", f"[0:v]{COVER},fps={FPS},{sub(lab, c['fonts'])}[v];{af.replace('[0:a]', '[1:a]')}",
                           "-map", "[v]", "-map", "[a]", "-t", f"{d:.3f}", *ENC, str(out)])
    return d


# ---------------------------------------------------------------- كله مع بعض
def build(c: dict, src: Path, step) -> dict:
    """c: ffmpeg, work, fonts, font, sfx, colors, accent, brand, logo, dialect_lang, dub_lang (lang, label), ext{transcribe, plan, angle,
    speak, lipsync, person, broll, bg, music}. step(نص، نسبة). يعود {video, duration, chapters, skipped}."""
    work: Path = c["work"]
    work.mkdir(parents=True, exist_ok=True)
    ffm = c["ffmpeg"]
    step("🎞️ يجهّز الفيديو", 3)
    norm = work / "norm.mp4"
    dur = normalize(ffm, src, norm)
    if dur < 8:
        raise ShowcaseError("الفيديو قصير جدًا: نحتاج ٨ ثوانٍ على الأقل")
    step("📝 يسمع كلامك", 8)
    wav = work / "speech.wav"
    run(ff(ffm) + ["-i", str(norm), "-vn", "-ac", "1", "-ar", "16000", str(wav)])
    words = [w for w in (c["ext"]["transcribe"](wav, dur) or []) if str(w.get("w") or "").strip()]
    # 🧭 قبل أي تعديل: الفيديو ده فيه كلام؟ فيه شخص؟ الشخص بيتكلم للكاميرا؟ وعلى أساسه بنختار التعديلات اللي ليها معنى
    step("👁️ يتعرّف على محتوى الفيديو", 10)
    spoken = sum(max(0.0, w["e"] - w["s"]) for w in words)
    has_speech = len(words) >= 6 and spoken / dur >= 0.18
    info = {}
    try:
        if c["ext"].get("classify"):
            info = c["ext"]["classify"](sample_frames(ffm, norm, dur, work), " ".join(w["w"] for w in words)[:600]) or {}
    except Exception as exc:  # noqa: BLE001
        print(f"showcase classify: {exc}", flush=True)
    people = bool(info.get("people", has_speech))
    vtype = video_type(has_speech, people, bool(info.get("talking_person", has_speech)))
    c["vtype"], c["what"] = vtype, str(info.get("what") or "")[:200]
    kinds = list(TYPES[vtype]["kinds"])
    if c["ext"].get("person") is None or not people:
        kinds = [k for k in kinds if k not in NEEDS_PERSON]
    if not has_speech:
        words = []
    if "dub" in kinds and len(words) < 4:
        kinds.remove("dub")
    dub_k = "dub" if "dub" in kinds else "dub_voice" if "dub_voice" in kinds else None
    win = windows(words, dur, [("dub" if k == "dub_voice" else k) for k in kinds])
    if dub_k == "dub_voice" and "dub" in win:
        win["dub_voice"] = win.pop("dub")
    if dub_k and dub_k not in win:
        kinds.remove(dub_k)
    texts = {k: " ".join(w["w"] for w in rel(words, *win[k])) for k in kinds}
    step("🧠 يختار اللحظات", 12)
    try:
        plan = clean_plan(c["ext"]["plan"](plan_messages({("dub" if k == "dub_voice" else k): v for k, v in texts.items()}, c.get("brand", ""),
                                                         c.get("niche", ""), c["dub_lang"][2], c["what"], has_speech)) or {})
    except Exception as exc:  # noqa: BLE001  (من غير العقل: أطول الكلمات، ومن غير دبلجة)
        print(f"showcase plan: {exc}", flush=True)
        plan = clean_plan({})
    if not plan["dub"] and dub_k in kinds:
        kinds.remove(dub_k)
    if "titles" in kinds and not plan["titles"]:
        plan["titles"] = [x for x in (c.get("brand") or "", c.get("niche") or "") if x][:2] or ["✓"]
    has_outro = bool(c.get("logo") or c.get("brand"))
    total = len(kinds) + int(has_outro)
    parts, chapters, skipped, t = [], [], [], 0.0
    # الحاجات الخارجية (الصور والموسيقى) بتتجاب الأول، ولو فشلت القطعة بتكمل من غيرها
    ext = c["ext"]
    fetch = lambda key, q: (ext[key](q, work / f"stock_{key}") if ext.get(key) and q else None)  # noqa: E731
    for n, kind in enumerate(kinds, 1):
        s, e = win[kind]
        d = round(e - s, 3)
        step(f"✨ {CHAPTERS[kind]['title']} ({n} من {total})", 15 + int(75 * (n - 1) / total))
        clip = cut(ffm, norm, s, d, work / f"clip_{kind}.mp4")
        out = work / f"seg_{n:02d}_{kind}.mp4"
        lab = write(work / f"lab_{kind}.ass", label_ass(0, 0, "", c["accent"]))
        ws = rel(words, s, e)
        try:
            if kind == "captions":
                fx_captions(c, clip, out, d, ws, lab)
            elif kind == "typo":
                fx_typo(c, clip, out, d, ws, lab, plan["typo"])
            elif kind == "zoom":
                fx_zoom(c, clip, out, d, ws, lab, plan["zoom"])
            elif kind in NEEDS_PERSON:
                masks = person_masks(c, clip, d, kind)
                if not masks:
                    raise ShowcaseError("person not found")
                if kind == "behind":
                    fx_behind(c, clip, out, d, ws, lab, plan["behind"], masks)
                else:
                    fx_bg(c, clip, out, d, lab, masks, fetch("bg", plan["bg"]))
            elif kind == "grade":
                fx_grade(c, clip, out, d, lab)
            elif kind == "angle":
                fx_angle(c, clip, out, d, lab)
            elif kind == "dub":
                fx_dub(c, clip, out, d, lab, plan["dub"], c["dub_lang"][1])
            elif kind == "dub_voice":
                fx_dub(c, clip, out, d, lab, plan["dub"], c["dub_lang"][1], lip=False)
            elif kind == "titles":
                fx_titles(c, clip, out, d, lab, plan["titles"])
            elif kind == "finish":
                fx_finish(c, clip, out, d, ws, lab, fetch("broll", plan["broll"]), fetch("music", plan["music"]))
        except Exception as exc:  # noqa: BLE001  (قطعة وقعت: الباقي بيكمل، وبنقول إنها اتشالت)
            print(f"showcase {kind}: {str(exc)[:500]}", flush=True)
            skipped.append({"kind": kind, "title": CHAPTERS[kind]["title"], "error": str(exc)[-300:]})
            continue
        od, _ = probe(ffm, out)
        parts.append(out)
        did = ZOOM_NO_SPEECH if kind == "zoom" and not has_speech else CHAPTERS[kind]["did"]
        chapters.append({"kind": kind, "title": CHAPTERS[kind]["title"], "t0": round(t, 2), "t1": round(t + od, 2),
                         "did": did, "can": CHAPTERS[kind]["can"]})
        t += od
    if has_outro:
        try:
            out = work / "seg_99_outro.mp4"
            od = fx_outro(c, out, write(work / "lab_outro.ass", label_ass(0, 0, "", c["accent"])))
            parts.append(out)
            chapters.append({"kind": "outro", "title": CHAPTERS["outro"]["title"], "t0": round(t, 2), "t1": round(t + od, 2),
                             "did": CHAPTERS["outro"]["did"], "can": CHAPTERS["outro"]["can"]})
            t += od
        except Exception as exc:  # noqa: BLE001
            print(f"showcase outro: {exc}", flush=True)
    if len(parts) < 3:
        raise ShowcaseError("تعذّر تجهيز الفيديو الاستعراضي من هذا الفيديو")
    step("🎬 يجمع القطع", 93)
    # اسم كل ميزة ورقمها (على عدد القطع اللي نجحت فعلًا)، وعلو الصوت واحد في كل القطع
    done = []
    for i, (p, ch) in enumerate(zip(parts, chapters), 1):
        lab = write(work / f"final_{i}.ass", label_ass(i, len(parts), ch["title"], c["accent"]))
        gain = 0.0 if ch["kind"] == "outro" else max(-8.0, min(14.0, -18.0 - (mean_volume(ffm, p) or -18.0)))
        q = work / f"final_{i:02d}.mp4"
        run(ff(ffm) + ["-i", str(p), "-vf", sub(lab, c["fonts"]), "-af", f"volume={gain:.1f}dB,alimiter=limit=0.95", *ENC, str(q)])
        done.append(q)
    parts = done
    lst = write(work / "list.txt", "".join(f"file '{p.as_posix()}'\n" for p in parts))
    final = work / "showcase.mp4"
    run(ff(ffm) + ["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", "-movflags", "+faststart", str(final)], 600)
    return {"video": final, "duration": round(t, 2), "chapters": chapters, "skipped": skipped, "plan": plan,
            "type": vtype, "type_label": TYPES[vtype]["label"], "what": c["what"]}


def to_json(d: dict) -> str:
    return json.dumps(d, ensure_ascii=False)
