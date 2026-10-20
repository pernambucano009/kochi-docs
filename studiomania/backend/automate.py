"""🤖 الموديل المخصص (أوتوميشن على كانفاس): كل عميل بيرتّب خطوات بأفعال، وكل خطوة بتمنشن حاجة من مكتبة العقل.

الخطوات بالترتيب بتتحول لمشروع مونتاج عادي (بيتفتح في المحرر ويتصدّر): اسحب صور/فيديوهات ← إنترو/أوترو ← تعليق صوتي ←
موسيقى بتوطى تحت الكلام ← قطّع ← كابشن ← صدّر. كل تشغيل بيختار ملفات لسه متستخدمتش (لحد ما الفولدر يخلص ويبدأ من الأول).
"""
from __future__ import annotations

import random
import uuid

VERBS = {
    "pull": {"t": "اسحب", "desc": "صور أو فيديوهات من المكتبة (فولدر، ملف بعينه، أو بحث بالمعنى)", "accept": ("image", "video"),
             "opts": {"type": "image", "count": 4, "order": "fresh", "sec": 2.5}},
    "intro": {"t": "حط إنترو", "desc": "فيديو في أول الفيديو", "accept": ("video",), "opts": {}},
    "outro": {"t": "حط أوترو", "desc": "فيديو في آخر الفيديو", "accept": ("video",), "opts": {}},
    "voice": {"t": "حط تعليق صوتي", "desc": "تسجيل صوت من المكتبة، والفيديو على قده", "accept": ("audio",), "opts": {"fit": True, "order": "fresh"}},
    "music": {"t": "حط موسيقى", "desc": "موسيقى بتوطى لوحدها وقت الكلام", "accept": ("audio",), "opts": {"volume": 35, "duck": True, "order": "fresh"}},
    "cut": {"t": "قطّع", "desc": "أقصى طول لكل لقطة، وانتقال بين اللقطات", "accept": (), "opts": {"max": 3.0, "trans": "fade"}},
    "caption": {"t": "حط كابشن", "desc": "الكلام مكتوب على الشاشة من التعليق الصوتي", "accept": (), "opts": {"on": True}},
    "export": {"t": "صدّر", "desc": "الفيديو بيتصدّر بالمقاس ده", "accept": (), "opts": {"ratio": "9:16"}},
    "publish": {"t": "انشر", "desc": "على حساباتك المربوطة في صفحة النشر، أو يستنى موافقتك", "accept": (), "opts": {"when": "draft", "platforms": [], "caption": ""}},
}
FIXED = ("export", "publish")   # آخر خطوتين دايمًا: صدّر وبعدها انشر (مابيتشالوش ومابيتحركوش)
WHEN = {"draft": "يستنى موافقتي", "now": "ينزل على طول"}
ORDERS = {"fresh": "اللي متستخدمش قبل كده", "random": "عشوائي", "newest": "الأحدث الأول", "oldest": "الأقدم الأول"}
TRANS = {"": "من غير", "fade": "ذوبان", "whip": "سحبة"}
RATIOS = ("9:16", "1:1", "4:5", "16:9")
MAX_STEPS = 24


def sid() -> str:
    return uuid.uuid4().hex[:8]


def new_step(verb: str) -> dict:
    v = VERBS[verb]
    return {"id": sid(), "verb": verb, "src": None, "opts": dict(v["opts"])}


def starter() -> list[dict]:
    """الموديل الجديد بيبدأ بمثال يتعدّل: اسحب ← تعليق ← موسيقى ← قطّع ← كابشن ← صدّر ← انشر."""
    return [new_step(v) for v in ("pull", "voice", "music", "cut", "caption", "export", "publish")]


def clean_src(raw) -> dict | None:
    if not isinstance(raw, dict):
        return None
    mode = raw.get("mode")
    if mode == "folder":
        return {"mode": "folder", "id": str(raw.get("id") or "")[:20] or None, "label": str(raw.get("label") or "")[:200]}
    if mode == "file" and raw.get("id"):
        return {"mode": "file", "id": str(raw["id"])[:20], "label": str(raw.get("label") or "")[:200]}
    if mode == "search" and str(raw.get("q") or "").strip():
        return {"mode": "search", "q": str(raw["q"]).strip()[:120], "label": str(raw["q"]).strip()[:120]}
    return None


def clean_opts(verb: str, raw: dict) -> dict:
    base = dict(VERBS[verb]["opts"])
    raw = raw if isinstance(raw, dict) else {}
    num = lambda k, lo, hi: max(lo, min(hi, float(raw[k]))) if isinstance(raw.get(k), (int, float)) else base[k]  # noqa: E731
    for k in base:
        if k not in raw:
            continue
        if k == "type" and raw[k] in ("image", "video", "any"):
            base[k] = raw[k]
        elif k == "order" and raw[k] in ORDERS:
            base[k] = raw[k]
        elif k == "trans" and raw[k] in TRANS:
            base[k] = raw[k]
        elif k == "ratio" and raw[k] in RATIOS:
            base[k] = raw[k]
        elif k == "when" and raw[k] in WHEN:
            base[k] = raw[k]
        elif k == "platforms" and isinstance(raw[k], list):
            base[k] = [str(x)[:80] for x in raw[k] if str(x).strip()][:12]
        elif k == "caption":
            base[k] = str(raw[k] or "")[:2000]
        elif k in ("fit", "duck", "on"):
            base[k] = bool(raw[k])
        elif k == "count":
            base[k] = int(num(k, 1, 20))
        elif k == "sec":
            base[k] = round(num(k, 0.8, 12), 1)
        elif k == "max":
            base[k] = round(num(k, 0.8, 20), 1)
        elif k == "volume":
            base[k] = int(num(k, 0, 100))
    return base


def clean_steps(raw: list) -> list[dict]:
    """الخطوات بالترتيب، و«صدّر» و«انشر» آخر حاجة دايمًا (لو مش موجودين بيتضافوا)."""
    out, fixed = [], {}
    for s in raw or []:
        if not isinstance(s, dict) or s.get("verb") not in VERBS:
            continue
        st = {"id": str(s.get("id") or sid())[:12], "verb": s["verb"], "src": clean_src(s.get("src")) if VERBS[s["verb"]]["accept"] else None,
              "opts": clean_opts(s["verb"], s.get("opts") or {})}
        if st["verb"] in FIXED:
            fixed.setdefault(st["verb"], st)
            continue
        if len(out) < MAX_STEPS:
            out.append(st)
    return out + [fixed.get(v) or new_step(v) for v in FIXED]


def pick(files: list[dict], n: int, order: str, used: dict[str, int], rnd: random.Random) -> tuple[list[dict], bool]:
    """اختيار n ملف: «مايتكررش» بياخد الأقل استخدامًا الأول (ولو الكل اتستخدم بيلف من الأول). بيرجّع (الملفات، لفّ من الأول؟)."""
    if not files:
        return [], False
    if order == "newest":
        ranked = sorted(files, key=lambda f: f.get("at") or "", reverse=True)
    elif order == "oldest":
        ranked = sorted(files, key=lambda f: f.get("at") or "")
    elif order == "random":
        ranked = files[:]
        rnd.shuffle(ranked)
    else:
        ranked = files[:]
        rnd.shuffle(ranked)
        ranked.sort(key=lambda f: used.get(f["id"], 0))
    out = ranked[:n]
    wrapped = order == "fresh" and any(used.get(f["id"], 0) for f in out)
    return out, wrapped


def plan_lengths(kinds_durs: list[tuple[str, float | None]], target: float | None, cap: float | None, image_sec: list[float]) -> list[float]:
    """طول كل لقطة: الصور بمدتها (أو على قد التعليق الصوتي لو «على قده»)، والفيديوهات بطولها، والكل مايعدّيش «أقصى طول»."""
    out = []
    for (k, d), s in zip(kinds_durs, image_sec):
        L = s if k == "image" else (d or s)
        if cap:
            L = min(L, cap)
        out.append(max(0.6, L))
    if target and out:
        total = sum(out)
        if total > 0:
            k = target / total
            out = [max(0.6, min((cap or 1e9) if kd[0] != "video" else min(cap or 1e9, kd[1] or 1e9), x * k)) for x, kd in zip(out, kinds_durs)]
    return [round(x, 2) for x in out]
