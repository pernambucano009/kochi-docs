"""قاموس المعاني: كلمة من الكلام ← معنى (concept) ← أيقونة من المكتبة بروح الستايل.

القاموس بيتملي لوحده: كل أيقونة بتتطلّع من فيديو في المعمل (أو بتترسم) بتيجي بكلماتها عربي وإنجليزي.
والكلمة اللي القاموس ميعرفهاش بتروح لموديل صغير مرة واحدة بس، وإجابته بتتحفظ (حتى لو "ملهاش أيقونة").
"""
from __future__ import annotations

import json
import re
from pathlib import Path

_TASHKEEL = re.compile(r"[ؗ-ًؚ-ْٰـ]")
_PUNCT = re.compile(r"[^\w\u0600-\u06FF]+|[\u060C\u061B\u061F\u066A-\u066D\u06D4]")
_AR_PREFIX = ("وال", "بال", "فال", "كال", "لل", "ال")

STOP = set("""
a an the and or but if so to of in on at by for with from as is are was were be been being am do does did done not no yes
i me my we our you your he him his she her it its they them their this that these those there here what which who whom whose
how why when where just very really too also than then can could will would shall should may might must have has had get got
over under into onto out up down off about through one ones own s t don didn isn aren wasn weren let lets like
في من على عن الى إلى ان أن إن كان كانت يكون هو هي هم انت انتي إنت إنتي انا أنا احنا إحنا نحن هذا هذه ذلك تلك ده دي دول
اللي الذي التي الذين و او أو ثم بس لكن لو اذا إذا مع عند لما كل اي أي ايه إيه ليه ازاي إزاي فين مين امتى إمتى كده كدا
مش ما لا لم لن مفيش عشان علشان بعدين وبعدين بعد قبل لسه لسة دلوقتي هنا هناك يا ياه بقى برضه برضو كمان جدا جداً اوي قوي خالص يعني طيب اه ايوه لأ لا شوية حاجة حاجه
""".split())


def norm(word: str) -> str:
    """شكل واحد للكلمة: من غير تشكيل ولا علامات، والهمزات واحدة، ومن غير «ال» و«و»… وجمع الإنجليزي بيرجع مفرد."""
    w = _PUNCT.sub("", _TASHKEEL.sub("", (word or "").lower()))
    if re.search(r"[؀-ۿ]", w):
        w = re.sub("[أإآ]", "ا", w).replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
        for p in _AR_PREFIX:
            if w.startswith(p) and len(w) - len(p) >= 3:
                w = w[len(p):]
                break
        return w
    if w.endswith("'s"):
        w = w[:-2]
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 4 and w.endswith(("ches", "shes", "sses", "xes")):
        return w[:-2]
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
        return w[:-1]
    return w


_AR_SUFFIX = ("هما", "كما", "تها", "تهم", "ها", "هم", "كم", "كي", "نا", "ات", "ين", "ون", "وا", "ته", "ه", "ك", "ي", "ت")
_AR_VERB = ("بت", "بي", "بن", "هت", "هي", "حت", "ت", "ي", "ن", "ا", "ب")


def forms(word: str) -> list[str]:
    """الكلمة وأشكالها من غير اللواحق (فلوسك ← فلوس، بتحبها ← حب، وكتابك ← كتاب) عشان تتلاقى في القاموس.
    الترتيب مهم: الأقرب للكلمة الأول (عشان «كتاب» متتقريش «تاب»)."""
    n = norm(word)
    if not re.search(r"[\u0600-\u06FF]", n):
        return [n]
    def unsuf(x):
        return next((x[: -len(s)] for s in _AR_SUFFIX if x.endswith(s) and len(x) - len(s) >= 3), None)
    def unpre(x, pres, keep=2):
        return next((x[len(p):] for p in pres if x.startswith(p) and len(x) - len(p) >= keep), None)
    out = [n]
    def add(x):
        if x and x not in out:
            out.append(x)
    add(unsuf(n))
    for base in list(out):
        w = unpre(base, ("و", "ف", "ب", "ل", "ك"), 3)   # حرف عطف/جر لازق
        add(w)
        if w:
            add(unsuf(w))
    for base in list(out):
        add(unpre(base, _AR_VERB))   # أول الفعل (بت/هت/ي…)
    return out


def content(word: str) -> bool:
    """كلمة ليها معنى ممكن يبقى صورة (مش حرف جر ولا ضمير)."""
    n = norm(word)
    return len(n) >= (2 if re.search(r"[\u0600-\u06FF]", n) else 3) and n not in STOP and _TASHKEEL.sub("", (word or "").lower()).strip(".,،!?؟") not in STOP and not n.isdigit()


def slug(concept: str) -> str:
    return re.sub(r"[^a-z0-9-]+", "-", (concept or "").lower().strip()).strip("-")[:30]


# ---------------------------------------------------------------- التخزين
def load(path: Path) -> dict:
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        d = {}
    d.setdefault("concepts", {})
    d.setdefault("words", {})
    return d


def save(path: Path, d: dict) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def learn(d: dict, concept: str, en: list | None = None, ar: list | None = None) -> str:
    """معنى جديد (أو كلمات زيادة لمعنى موجود)."""
    c = slug(concept)
    if not c:
        return ""
    e = d["concepts"].setdefault(c, {"en": [], "ar": []})
    for lang, vals in (("en", en), ("ar", ar)):
        for v in vals or []:
            v = str(v).strip()[:30]
            if v and v not in e[lang]:
                e[lang].append(v)
        e[lang] = e[lang][:40]
    return c


def index(d: dict) -> dict[str, str]:
    """كلمة (بشكلها الموحّد) ← معنى. اللي اتعلّمناه من الموديل بيكسب على اللي اتخمّن من الأسماء."""
    out: dict[str, str] = {}
    for c, e in d["concepts"].items():
        for w in [c.replace("-", " "), *e.get("en", []), *e.get("ar", [])]:
            for part in [w, *w.split()]:
                n = norm(part)
                if len(n) >= 2 and n not in STOP:
                    out.setdefault(n, c)
    for n, c in d["words"].items():
        out[n] = c
    return out


def lookup(words: list[str], d: dict) -> tuple[dict[int, str], list[str]]:
    """أرقام الكلام اللي ليها معنى معروف، والكلمات اللي القاموس ميعرفهاش (عشان تتسأل للموديل الصغير مرة واحدة)."""
    idx = index(d)
    hits, unknown = {}, []
    for i, w in enumerate(words):
        if not content(w):
            continue
        fs = forms(w)
        f = next((x for x in fs if x in idx), None)
        if f is not None:
            if idx[f]:
                hits[i] = idx[f]
        elif fs[0] not in unknown:
            unknown.append(fs[0])
    return hits, unknown


# ---------------------------------------------------------------- الموديل الصغير
def ask_messages(unknown: list[str], known: list[str]) -> list[dict]:
    text = (
        "إنت قاموس أيقونات لفيديوهات تايبوجرافي. لكل كلمة من الكلمات دي قول هي تترسم أيقونة إيه (معنى ملموس واحد)، "
        "أو \"\" لو الكلمة معنى مجرد ملوش صورة واضحة (زي: change, feel, maybe, كده).\n"
        "- لو المعنى موجود في القايمة دي استخدم اسمه بالظبط: " + ", ".join(known[:300]) + "\n"
        "- لو جديد: اسم إنجليزي قصير (كلمة أو اتنين بشرطة، زي coffee-cup) وكلمات تانية بتدل عليه عربي (فصحى ومصري وخليجي) وإنجليزي.\n"
        "الكلمات: " + json.dumps(unknown[:60], ensure_ascii=False) + "\n"
        'رجّع JSON بس: {"words": {"<الكلمة>": "<المعنى أو فاضي>"}, "new": {"<معنى جديد>": {"en": ["..."], "ar": ["..."]}}}'
    )
    return [{"role": "user", "content": text}]


def apply_answer(d: dict, unknown: list[str], raw: dict) -> int:
    """إجابة الموديل ← القاموس. الكلمة اللي ملهاش أيقونة بتتحفظ فاضية عشان متتسألش تاني."""
    raw = raw if isinstance(raw, dict) else {}
    for c, e in (raw.get("new") or {}).items():
        if isinstance(e, dict):
            learn(d, c, e.get("en"), e.get("ar"))
    got = 0
    ans = {norm(k): v for k, v in (raw.get("words") or {}).items()} if isinstance(raw.get("words"), dict) else {}
    for n in unknown:
        c = slug(str(ans.get(n) or ""))
        if c and c not in d["concepts"]:
            learn(d, c, [c.replace("-", " ")])
        d["words"][n] = c
        got += bool(c)
    return got


def tag_messages(icons: list[dict]) -> list[dict]:
    """أيقونات جديدة (اسم + وصف) ← معنى كل واحدة وكلماتها، عشان القاموس يتملي لوحده."""
    text = (
        "دي أيقونات اتطلّعت من فيديو. لكل واحدة اكتب معناها الملموس (اسم إنجليزي قصير بشرطة، زي vinyl-record) "
        "وكلمات بتدل عليها أو على اللي بترمز له في الكلام: عربي (فصحى ومصري وخليجي) وإنجليزي، لحد 12 لكل لغة.\n"
        "- استخدم نفس الاسم لو أيقونتين نفس الحاجة.\n"
        "الأيقونات: " + json.dumps([{"id": i["id"], "name": i.get("name"), "desc": i.get("desc")} for i in icons], ensure_ascii=False) + "\n"
        'رجّع JSON بس: {"icons": [{"id": "...", "concept": "...", "en": ["..."], "ar": ["..."]}]}'
    )
    return [{"role": "user", "content": text}]


def guess_concept(name: str) -> str:
    """من غير موديل: اسم الأيقونة نفسه (من غير كلام زي pixel/icon)."""
    parts = [p for p in re.split(r"[-_\s]+", (name or "").lower()) if p and p not in ("pixel", "icon", "sticker", "art", "small", "big", "red", "black", "white")]
    return slug("-".join(parts[-2:])) if parts else ""


# ---------------------------------------------------------------- اختيار الأيقونة
def pick(concept: str, stickers: list[dict], style: str = "") -> str | None:
    """معنى ← ستيكر: الأول من نفس الستايل (نفس الروح)، وبعدين أي ستيكر بنفس المعنى."""
    same = [s for s in stickers if s.get("concept") == concept]
    if not same:
        return None
    own = [s for s in same if style and s.get("style") == style]
    return (own or same)[0]["id"]


def icons_for(idxs: list[int], hits: dict[int, str], stickers: list[dict], style: str, limit: int = 4) -> list[str]:
    """أيقونات جملة: معاني كلامها بالترتيب، وكل معنى بأيقونة الستايل (أو اسم المعنى لو لسه محتاج يترسم)."""
    out = []
    for i in idxs:
        c = hits.get(i)
        if not c:
            continue
        v = pick(c, stickers, style) or c
        if v not in out:
            out.append(v)
        if len(out) >= limit:
            break
    return out
