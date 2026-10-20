"""🤖 الموديل المخصص (أوتوميشن على كانفاس): كل عميل بيرتّب خطوات بأفعال، وكل خطوة بتمنشن حاجة من مكتبة العقل.

الخطوات بالترتيب بتتحول لمشروع مونتاج عادي (بيتفتح في المحرر ويتصدّر): اسحب صور/فيديوهات ← إنترو/أوترو ← تعليق صوتي ←
موسيقى بتوطى تحت الكلام ← قطّع ← كابشن ← صدّر. كل تشغيل بيختار ملفات لسه متستخدمتش (لحد ما الفولدر يخلص ويبدأ من الأول).

التقطيع بيفتح مسارات: «قطّع الفيديو» بيقسم فيديو طويل لقطع (كل قطعة أقل من الطول اللي تحدده)، وكل قطعة ليها مسار لوحدها
تحط فيه خطوات (زي «ولّد» ببرومبت)، وبعدين «جمّع» بيلم المخرجات اللي تختارها بالترتيب اللي تحدده في فيديو واحد.
"""
from __future__ import annotations

import json
import math
import random
import re
import uuid

VERBS = {
    "pull": {"t": "اسحب", "desc": "صور أو فيديوهات من المكتبة (فولدر، ملف بعينه، أو بحث بالمعنى)", "accept": ("image", "video"),
             "opts": {"type": "image", "count": 4, "order": "fresh", "sec": 2.5}},
    "intro": {"t": "حط إنترو", "desc": "فيديو في أول الفيديو", "accept": ("video",), "opts": {}},
    "outro": {"t": "حط أوترو", "desc": "فيديو في آخر الفيديو", "accept": ("video",), "opts": {}},
    "voice": {"t": "حط تعليق صوتي", "desc": "تسجيل صوت من المكتبة، والفيديو على قده", "accept": ("audio",), "opts": {"fit": True, "order": "fresh"}},
    "music": {"t": "حط موسيقى", "desc": "موسيقى بتوطى لوحدها وقت الكلام", "accept": ("audio",), "opts": {"volume": 35, "duck": True, "order": "fresh"}},
    "split": {"t": "قطّع الفيديو", "desc": "يقسم فيديو طويل لقطع أقصر، وكل قطعة بتمشي في مسار لوحدها", "accept": ("video",),
              "opts": {"max": 15.0, "note": "", "order": "fresh"}},
    "gen": {"t": "ولّد", "desc": "فيديو جديد بالذكاء الصناعي: من القطعة، أو من صورة، أو من مراجع (شخصيات وخلفيات)، أو من الكلام بس، على حسب الموديل",
            "accept": (), "opts": {"prompt": "", "model": "", "refs": [], "start": None, "end": None, "use_piece": True}},
    "merge": {"t": "جمّع", "desc": "يجمع المخرجات اللي تختارها في فيديو واحد بالترتيب اللي تحدده", "accept": (), "opts": {"items": []}},
    "cut": {"t": "طول اللقطات", "desc": "أقصى طول لكل لقطة، وانتقال بين اللقطات", "accept": (), "opts": {"max": 3.0, "trans": "fade"}},
    "caption": {"t": "حط كابشن", "desc": "الكلام مكتوب على الشاشة من التعليق الصوتي", "accept": (), "opts": {"on": True}},
    "export": {"t": "صدّر", "desc": "الفيديو بيتصدّر بالمقاس ده", "accept": (), "opts": {"ratio": "9:16"}},
    "publish": {"t": "انشر", "desc": "على حساباتك المربوطة في صفحة النشر، أو يستنى موافقتك", "accept": (), "opts": {"when": "draft", "platforms": [], "caption": ""}},
}
FIXED = ("export", "publish")
LANE_VERBS = ("gen",)
REF_KINDS = {"char": "شخصية", "twin": "نسختي", "bg": "خلفية", "file": "ملف", "folder": "فولدر", "frame": "أول فريم من القطعة"}
MAX_REFS = 6          # الخطوات اللي بتتحط جوه مسار قطعة
MAX_LANES = 12   # آخر خطوتين دايمًا: صدّر وبعدها انشر (مابيتشالوش ومابيتحركوش)
WHEN = {"draft": "يستنى موافقتي", "now": "ينزل على طول"}
ORDERS = {"fresh": "اللي متستخدمش قبل كده", "random": "عشوائي", "newest": "الأحدث الأول", "oldest": "الأقدم الأول"}
TRANS = {"": "من غير", "fade": "ذوبان", "whip": "سحبة"}
RATIOS = ("9:16", "1:1", "4:5", "16:9")
MAX_STEPS = 24


def sid() -> str:
    return uuid.uuid4().hex[:8]


def new_step(verb: str) -> dict:
    v = VERBS[verb]
    st = {"id": sid(), "verb": verb, "src": None, "opts": json.loads(json.dumps(v["opts"]))}
    if verb == "split":
        st["lanes"] = [[]]
    return st


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


def clean_ref(raw) -> dict | None:
    """منشن (@) لشخصية أو نسختي أو خلفية أو ملف أو فولدر من مكتبة المحتويات، أو «أول فريم من القطعة»."""
    if not isinstance(raw, dict) or raw.get("kind") not in REF_KINDS:
        return None
    if raw["kind"] == "frame":
        return {"kind": "frame", "id": "", "label": REF_KINDS["frame"]}
    if not str(raw.get("id") or "").strip():
        return None
    return {"kind": raw["kind"], "id": str(raw["id"])[:120], "label": str(raw.get("label") or "")[:80], "thumb": str(raw.get("thumb") or "")[:300]}


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
        elif k in ("caption", "prompt"):
            base[k] = str(raw[k] or "")[:2000]
        elif k == "note":
            base[k] = str(raw[k] or "")[:600]
        elif k == "model":
            base[k] = str(raw[k] or "")[:120]
        elif k == "items" and isinstance(raw[k], list):
            out = []
            for it in raw[k][:40]:
                if isinstance(it, dict) and isinstance(it.get("lane"), (int, float)) and 0 <= int(it["lane"]) < MAX_LANES:
                    out.append({"lane": int(it["lane"]), "node": str(it.get("node") or "piece")[:12]})
            base[k] = out
        elif k == "refs" and isinstance(raw[k], list):
            seen, out = set(), []
            for r in raw[k]:
                r = clean_ref(r)
                if r and r["kind"] != "frame" and (r["kind"], r["id"]) not in seen:
                    seen.add((r["kind"], r["id"]))
                    out.append(r)
            base[k] = out[:MAX_REFS]
        elif k in ("start", "end"):
            base[k] = clean_ref(raw[k])
        elif k in ("fit", "duck", "on", "use_piece"):
            base[k] = bool(raw[k])
        elif k == "count":
            base[k] = int(num(k, 1, 20))
        elif k == "sec":
            base[k] = round(num(k, 0.8, 12), 1)
        elif k == "max":
            base[k] = round(num(k, 2, 120), 1) if verb == "split" else round(num(k, 0.8, 20), 1)
        elif k == "volume":
            base[k] = int(num(k, 0, 100))
    return base


def _clean_one(s: dict) -> dict:
    return {"id": str(s.get("id") or sid())[:12], "verb": s["verb"], "src": clean_src(s.get("src")) if VERBS[s["verb"]]["accept"] else None,
            "opts": clean_opts(s["verb"], s.get("opts") or {})}


def clean_lane(raw) -> list[dict]:
    return [_clean_one(s) for s in (raw if isinstance(raw, list) else [])[:8] if isinstance(s, dict) and s.get("verb") in LANE_VERBS]


def clean_steps(raw: list) -> list[dict]:
    """الخطوات بالترتيب، و«صدّر» و«انشر» آخر حاجة دايمًا (لو مش موجودين بيتضافوا).
    «قطّع الفيديو» واحد بس، ومعاه مساراته، و«جمّع» لازم ييجي بعده (لو مش موجود بيتضاف بعده على طول)."""
    out, fixed, split, merge = [], {}, None, None
    for s in raw or []:
        if not isinstance(s, dict) or s.get("verb") not in VERBS or s["verb"] in LANE_VERBS:
            continue
        st = _clean_one(s)
        if st["verb"] in FIXED:
            fixed.setdefault(st["verb"], st)
            continue
        if st["verb"] == "split":
            if split:
                continue
            st["lanes"] = [clean_lane(x) for x in (s.get("lanes") or [[]])[:MAX_LANES]] or [[]]
            split = st
        if st["verb"] == "merge":
            if merge or not split:   # «جمّع» من غير تقطيع قبله مالوش لازمة
                continue
            merge = st
        if len(out) < MAX_STEPS:
            out.append(st)
    if split:
        if merge is None:
            merge = new_step("merge")
            out.insert(out.index(split) + 1, merge)
        n = max(1, len(split["lanes"]))
        merge["opts"]["items"] = [it for it in merge["opts"]["items"] if it["lane"] < max(n, MAX_LANES)]
    return out + [fixed.get(v) or new_step(v) for v in FIXED]


def walk(steps: list[dict]):
    """كل الخطوات، واللي جوه مسارات التقطيع كمان."""
    for s in steps:
        yield s
        for lane in s.get("lanes") or []:
            yield from lane


# ---------------------------------------------------------------- التقطيع
def even_spans(dur: float, mx: float) -> list[tuple[float, float]]:
    """قطع متساوية، كل واحدة أقل من (أو قد) الطول الأقصى. فيديو ٤٠ ثانية على ١٥ = ٣ قطع."""
    n = max(1, math.ceil(dur / max(0.5, mx) - 1e-6))
    step = dur / n
    return [(round(i * step, 2), round(dur if i == n - 1 else (i + 1) * step, 2)) for i in range(n)]


def snap_quiet(spans: list[tuple[float, float]], quiet: list[tuple[float, float]], mx: float) -> list[tuple[float, float]]:
    """مكان القطع بيتزق لأقرب سكوت (علشان مايقطعش في نص كلمة)، من غير ما أي قطعة تعدّي الطول الأقصى."""
    if len(spans) < 2 or not quiet:
        return spans
    cuts = [b for _, b in spans[:-1]]
    end = spans[-1][1]
    for i, c in enumerate(cuts):
        prev = cuts[i - 1] if i else 0.0
        nxt = cuts[i + 1] if i + 1 < len(cuts) else end
        best = None
        for a, b in quiet:
            m = (a + b) / 2
            if abs(m - c) <= 2.0 and m - prev <= mx and nxt - m <= mx and m - prev > 1 and nxt - m > 1 and (best is None or abs(m - c) < abs(best - c)):
                best = m
        if best is not None:
            cuts[i] = round(best, 2)
    pts = [0.0, *cuts, end]
    return [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]


def split_messages(note: str, words: list[dict], dur: float, mx: float) -> list[dict]:
    said = " ".join(f"[{w['s']:.1f}]{w['w']}" for w in words[:900])
    return [{"role": "user", "content": f"""You cut a video into pieces for short-form content.
Video length: {dur:.1f} s. Every piece MUST be at most {mx:g} s long. Pieces are in order and must not overlap.
What the client wants from the cut (follow it): «{note}»
The speech with timestamps in seconds ([t]word): {said or "(no speech)"}
Prefer cutting at the end of a sentence or a pause, never in the middle of a word. You may skip parts the client wants removed.
Return JSON only: {{"pieces": [{{"start": 0.0, "end": 12.4, "why": "short reason in Egyptian Arabic"}}]}}"""}]


def clean_spans(raw: dict, dur: float, mx: float) -> list[tuple[float, float]]:
    out, last = [], 0.0
    for p in (raw or {}).get("pieces") or []:
        try:
            a, b = max(last, float(p["start"])), min(dur, float(p["end"]))
        except (KeyError, TypeError, ValueError):
            continue
        if b - a < 0.8:
            continue
        while b - a > mx + 0.3:   # قطعة أطول من المسموح: بتتقسم
            out.append((round(a, 2), round(a + mx, 2)))
            a += mx
        out.append((round(a, 2), round(b, 2)))
        last = b
    return out[:MAX_LANES * 3]


def lane_for(lanes: list[list[dict]], i: int) -> list[dict]:
    """مسار القطعة رقم i، والقطع الزيادة (اللي الموديل مايعرفش عددها قبل التشغيل) بتمشي زي آخر مسار."""
    if not lanes:
        return []
    return lanes[i] if i < len(lanes) else lanes[-1]


# ---------------------------------------------------------------- «اوصفه بكلامك»: المخ بيبني الخطوات
def describe_messages(text: str, folders: list[str], files: list[str], current: list[dict]) -> list[dict]:
    verbs = "\n".join(f"- {k}: {v['t']} — {v['desc']} · opts: {json.dumps(v['opts'], ensure_ascii=False)}" + (f" · src kinds: {', '.join(v['accept'])}" if v["accept"] else "")
                      for k, v in VERBS.items())
    return [{"role": "user", "content": f"""You build an automation ("custom model") for a video tool from the client's description (Egyptian Arabic, maybe spoken).
The model is an ordered list of steps (left to right). Available verbs:
{verbs}
Rules:
- Steps run in order. export and publish are always the last two (add them; publish when: "draft" waits for approval, "now" posts immediately).
- "src" points at the client's library: {{"mode": "folder", "id": null, "label": "<folder path>"}} or {{"mode": "search", "q": "<words>"}}.
  Use one of these folder paths when it fits: {json.dumps(folders[:80], ensure_ascii=False)}
  Some files: {json.dumps(files[:120], ensure_ascii=False)}
- split ("قطّع الفيديو") cuts ONE long video into pieces of at most opts.max seconds; put the client's cutting wishes in opts.note.
  It has "lanes": a list of lanes, one per piece, each lane a list of lane steps (only "gen" allowed, with opts.prompt in English describing the new video).
  If the client wants the same thing for every piece, give one lane. If he says what each piece should become, give one lane per piece.
- merge ("جمّع") must come right after split. opts.items is an ordered list of {{"lane": <piece index from 0>, "node": "piece" (the original cut) or the id of a gen step in that lane}}.
  Empty items = the last output of every lane in order.
- Give every step a short unique "id" (letters/digits).
- Keep what the client did not ask to change from the current model: {json.dumps(current, ensure_ascii=False)[:3000]}
Client's description: «{text}»
Return JSON only: {{"steps": [ ...steps... ], "say": "one or two short sentences in Egyptian Arabic about what you built"}}"""}]


def _num_near(text: str, words: tuple[str, ...]) -> float | None:
    for w in words:
        m = re.search(rf"(\d+(?:\.\d+)?)\s*(?:ثانيه|ثانية|ث|ثواني|sec|s)?\s*{w}|{w}\D{{0,20}}?(\d+(?:\.\d+)?)", text)
        if m:
            return float(m.group(1) or m.group(2))
    return None


def mock_describe(text: str, current: list[dict]) -> dict:
    """تجربة من غير موديل: بيفهم الكلمات المشهورة (تقطيع، ولّد، جمّع، تعليق، موسيقى، كابشن، صور)."""
    t = text or ""
    steps: list[dict] = []
    if re.search(r"صور|فيديوهات من", t) and not re.search(r"قط[عّ]", t):
        steps.append(new_step("pull"))
    if re.search(r"قط[عّ]|تقطيع|split", t):
        sp = new_step("split")
        mx = _num_near(t, ("ثانية", "ثانيه", "ثواني", "sec")) or 15
        sp["opts"]["max"] = max(2.0, min(120.0, mx))
        sp["opts"]["note"] = t[:200]
        if re.search(r"ول[دّ]|توليد|generate|برومبت|prompt", t):
            g = new_step("gen")
            m = re.search(r"(?:برومبت|prompt)[:\s]+(.+)", t)
            g["opts"]["prompt"] = (m.group(1) if m else t)[:400]
            sp["lanes"] = [[g]]
        steps.append(sp)
        steps.append(new_step("merge"))
    if re.search(r"تعليق|فويس|voice", t):
        steps.append(new_step("voice"))
    if re.search(r"موسيق|music", t):
        steps.append(new_step("music"))
    if re.search(r"كابشن|caption", t):
        steps.append(new_step("caption"))
    if not steps:
        return {"steps": current, "say": "مافهمتش أعمل إيه بالظبط. قول مثلًا: «قطّع الفيديو لقطع ١٥ ثانية، وولّد كل قطعة بستايل كرتون، وجمّعهم».", "changed": False}
    pub = next((x for x in current if x.get("verb") == "publish"), None)
    if pub is not None:
        steps.append(pub)
    return {"steps": steps, "say": f"عملت {len(steps)} خطوة من كلامك. راجعها وعدّل اللي عايزه.", "changed": True}


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
