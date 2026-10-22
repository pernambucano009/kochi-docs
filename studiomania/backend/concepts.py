"""قاموس المعاني: كلمة من النص ← معنى (concept) ← أيقونة من المكتبة بروح الأسلوب.

القاموس يُملأ تلقائيًا: كل أيقونة تُستخرج من فيديو في المعمل (أو تُرسم) تأتي بكلماتها عربي وإنجليزي.
والكلمة التي القاموس لا يعرفها تروح لموديل صغير مرة واحدة فقط، وإجابته تُحفظ (حتى إذا "ليس لها أيقونة").
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
في من على عن الى إلى ان أن أن كان كانت يكون هو هي هم أنت أنتِ أنت إنتي انا أنا نحن نحن نحن هذا هذه ذلك تلك هذا هذه هؤلاء
ما الذي التي الذين و او أو ثم فقط لكن إذا اذا إذا مع عند عندما كل اي أي ماذا ماذا له كيف كيف أين من متى متى هكذا هكذا
غير ما لا لم لن لا يوجد لكي لكي لاحقًا ثم بعد قبل ما زال ما زال الآن هنا هناك يا  بقى أيضًا أيضًا أيضًا جدا جداً جدًا قوي تمامًا أي حسنًا اه نعم لا لا قليلًا شيء شيء
""".split())


def norm(word: str) -> str:
    """شكل واحد للكلمة: بدون تشكيل ولا علامات، والهمزات واحدة، ومن غير «ال» و«و»… وجمع الإنجليزية يعود مفرد."""
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


_AR_SUFFIX = ("هم", "كما", "تها", "تهم", "ها", "هم", "كم", "كي", "نا", "ات", "ين", "ون", "وا", "ته", "ه", "ك", "ي", "ت")
_AR_VERB = ("بت", "بي", "بن", "هت", "هي", "حت", "ت", "ي", "ن", "ا", "ب")


def forms(word: str) -> list[str]:
    """الكلمة وأشكالها بدون اللواحق (فلوسك ← مال، تحبها ← حب، وكتابك ← كتاب) لكي تتلاقى في القاموس.
    الترتيب مهم: الأقرب للكلمة أولًا (لكي «كتاب» متتقريش «تبويب»)."""
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
    """كلمة لها معنى يمكن يصبح صورة (غير حرف جر ولا ضمير)."""
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
    """كلمة (بشكلها الموحّد) ← معنى. ما اتعلّمناه من النموذج يكسب على ما اتخمّن من الأسماء."""
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
    """أرقام النص الذي لها معنى معروف، والكلمات التي القاموس لا يعرفها (لكي تتسأل للنموذج الصغير مرة واحدة)."""
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
        "أنت قاموس أيقونات لفيديوهات تايبوجرافي. لكل كلمة من هذه الكلمات قل هي تُرسم أيقونة ماذا (معنى ملموس واحد)، "
        "أو \"\" لو الكلمة معنى مجرد ملوش صورة واضحة (زي: change, feel, maybe, كده).\n"
        "- إذا المعنى موجود في هذه القائمة استخدم اسمه بالضبط: " + ", ".join(known[:300]) + "\n"
        "- لو جديد: اسم إنجليزي قصير (كلمة أو اتنين بشرطة، زي coffee-cup) وكلمات تانية بتدل عليه عربي (فصحى ومصري وخليجي) وإنجليزي.\n"
        "الكلمات: " + json.dumps(unknown[:60], ensure_ascii=False) + "\n"
        'استعد JSON فقط: {"words": {"<الكلمة>": "<المعنى أو فارغ>"}, "new": {"<معنى جديد>": {"en": ["..."], "ar": ["..."]}}}'
    )
    return [{"role": "user", "content": text}]


def apply_answer(d: dict, unknown: list[str], raw: dict) -> int:
    """إجابة النموذج ← القاموس. الكلمة التي ليس لها أيقونة تُحفظ فارغة لكي متتسألش آخر."""
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
    """أيقونات جديدة (اسم + وصف) ← معنى كل واحدة وكلماتها، لكي القاموس يُملأ تلقائيًا."""
    text = (
        "هذه أيقونات اتطلّعت من فيديو. لكل واحدة اكتب معناها الملموس (اسم إنجليزي قصير بشرطة، مثل vinyl-record) "
        "وكلمات بتدل عليها أو على اللي بترمز له في الكلام: عربي (فصحى ومصري وخليجي) وإنجليزي، لحد 12 لكل لغة.\n"
        "- استخدم نفس الاسم إذا أيقونتين نفس الشيء.\n"
        "الأيقونات: " + json.dumps([{"id": i["id"], "name": i.get("name"), "desc": i.get("desc")} for i in icons], ensure_ascii=False) + "\n"
        'استعد JSON فقط: {"icons": [{"id": "...", "concept": "...", "en": ["..."], "ar": ["..."]}]}'
    )
    return [{"role": "user", "content": text}]


def guess_concept(name: str) -> str:
    """من غير موديل: اسم الأيقونة نفسه (من غير كلام زي pixel/icon)."""
    parts = [p for p in re.split(r"[-_\s]+", (name or "").lower()) if p and p not in ("pixel", "icon", "sticker", "art", "small", "big", "red", "black", "white")]
    return slug("-".join(parts[-2:])) if parts else ""


# ---------------------------------------------------------------- اختيار الأيقونة
def pick(concept: str, stickers: list[dict], style: str = "") -> str | None:
    """معنى ← ستيكر: أولًا من نفس الأسلوب (نفس الروح)، ثم أي ستيكر بنفس المعنى."""
    same = [s for s in stickers if s.get("concept") == concept]
    if not same:
        return None
    own = [s for s in same if style and s.get("style") == style]
    return (own or same)[0]["id"]


def icons_for(idxs: list[int], hits: dict[int, str], stickers: list[dict], style: str, limit: int = 4) -> list[str]:
    """أيقونات جملة: معاني كلامها بالترتيب، وكل معنى بأيقونة الأسلوب (أو اسم المعنى إذا ما زال يحتاج يُرسم)."""
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
