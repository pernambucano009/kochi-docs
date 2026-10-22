"""✏️ رسومات Hairline: أي رسمة جاهزة (من الـ 33) على قدر الجملة، وإذا لا يوجد، العقل يرسم رسمة جديدة بنفس الأسلوب.

الرسمة الجديدة خطوط فقط (path) في مساحة 400×320 مثل رسومات Hairline، وتُحفظ في مكتبة باسم الكلمة،
فنفس الكلمة بعد ذلك تأتي من المكتبة مباشرة بدون ما تُحسب مرة أخرى.
"""
from __future__ import annotations

import re

from ideamem import norm

FIGS = ["laptop", "phone", "keyboard", "terminal", "padlock", "vault", "plot", "cabinet", "router", "dish", "query", "drawer", "basket",
        "plug", "hub", "relay", "settle", "format", "rebuild", "stack", "loupe", "lockers", "rail", "sieve", "elevator", "terrain", "riffle",
        "exploded", "phosphor", "slow", "turntable", "branches", "patch"]

# الكلمة ← الرسمة الجاهزة (نفس اللي في typo-studio.js، بعد توحيد الحروف العربي)
WORDS = [
    (r"لابتوب|كمبيوتر|جهاز|مكتب|laptop|computer|desk|work", "laptop"), (r"جوال|تليفون|تطبيق|ابلكيشن|app|phone|mobile", "phone"),
    (r"كتابه|اكتب|كيبورد|typing|keyboard|write", "keyboard"), (r"كود|برمجه|خادم|terminal|code|coding|command|developer", "terminal"),
    (r"امان|حمايه|قفل|كلمة مرور|secure|security|lock|password|safe", "padlock"), (r"مال|ادخار|توفير|بنك|خزنه|money|saving|bank|vault|cash", "vault"),
    (r"ارقام|نمو|مبيعات|نتائج|نتائج|احصاي|chart|growth|sales|numbers|data|stats", "plot"), (r"سوال|له|كيف|question|why|how", "query"),
    (r"ملفات|ارشيف|ورق|file|files|archive|documents", "drawer"), (r"تسوق|شراء|سله|متجر|shop|store|buy|cart", "basket"),
    (r"طاقه|كهربا|شحن|power|energy|charge|plug", "plug"), (r"انترنت|واي ?فاي|شبكه|internet|wifi|network", "router"),
    (r"فريق|أشخاص|تواصل|team|people|connect|community", "hub"), (r"خطوات|مراحل|steps|levels|stages", "elevator"),
    (r"تنظيم|ترتيب|منظم|organi[sz]e|tidy|order", "settle"), (r"بحث|تفاصيل|دقه|search|detail|zoom", "loupe"),
    (r"اشاره|بث|اعلان|signal|broadcast|reach|ads?", "dish"), (r"وقت|ببطء|بطء|time|slow|patience", "slow"),
    (r"تصميم|طبقات|design|layers", "exploded"), (r"لبس|هدوم|موضه|fashion|clothes|outfit", "rail"), (r"فلتر|تصفيه|filter|sift", "sieve"),
]
_WORDS = [(re.compile(rf"(?:^|\s)(?:ال)?(?:{p})", re.I), f) for p, f in WORDS]

# كلام مالوش رسمة (حروف وضماير وأفعال عامة): مايتعملوش رسمة جديدة
_WEAK = set(norm("""انا أنت أنتِ نحن هو هي هم هذا هذه هؤلاء الذي في من على الى عن مع كل فقط أيضًا أي إذا عندما لكي لكي ان أنه
غير لا يوجد فيه كان كانت يكون سيكون بقى بقت تريد تريد يمكن يجب جدا جدًا تمامًا اليوم غدًا أمس شيء أشياء واحد اول اخر
the a an and or but is are was were be to of in on for with you your we our i my me it this that these those so very just really
do does did have has had can will would should could not no yes all any some more most love like want need make get go new good great best"""
                 + " حب بحب عايزه نفسي جديد حلو جميل جميله احسن قبل بعد شكل حقيقي حقيقيه طريقه حاجه فعلا كده زي مره كتير شويه").split())

KIND = ("hi", "mid", "lo", "edge")
_D_OK = re.compile(r"^[MmLlHhVvCcSsQqTtAaZz0-9 .,\-]{2,1200}$")


def pick_fig(text: str) -> str:
    t = " " + norm(text)
    return next((f for rx, f in _WORDS if rx.search(t)), "")


def _weak(w: str) -> bool:
    n = norm(w)
    return n in _WEAK or (n.startswith("ال") and len(n) > 4 and n[2:] in _WEAK) or len(n) <= 2 or n.isdigit()


def concept(words: list[str], focus: int = -1) -> str:
    """أهم كلمة في الجملة تُرسم: الكلمة المهمة إذا محددة، وإلا آخر كلمة غير ضعيفة."""
    clean = [w for w in (re.sub(r"[^\w]", "", x) for x in words) if w]
    if 0 <= focus < len(words):
        f = re.sub(r"[^\w]", "", words[focus])
        if f and not _weak(f):
            return f
    cands = [w for w in clean if not _weak(w)]
    return cands[-1] if cands else ""   # الاسم غالبًا آخر الجملة («my new car» · «بعد التبييض»)


def slug(word: str) -> str:
    s = re.sub(r"\s+", "-", norm(word))[:40]
    return re.sub(r"^ال(?=\w{3})", "", s) or "x"


def draw_messages(word: str, context: str) -> list[dict]:
    return [{"role": "system", "content": (
        "You draw minimalist isometric LINE ART in the 'Hairline' style: one object, built from simple rounded solids "
        "(boxes, cylinders, slabs, plates) seen in 30-degree isometric projection, thin strokes only, no fills, no text, no people's faces. "
        "Canvas: viewBox 0 0 400 320; the object is centered around (200,170), about 220 wide, sitting on a thin rounded base plate. "
        "Draw back-to-front. Each path is one stroke group. Return JSON only.")},
        {"role": "user", "content": (
            f"Object to draw: «{word}» (from the sentence: «{context[:200]}»). If the word is abstract, draw the simplest concrete object that means it.\n"
            'Return {"name": "short English name", "paths": [{"d": "SVG path data using M L C Q A Z with absolute coordinates", '
            '"c": "hi | mid | lo | edge"}]} with 12 to 40 paths. hi = the main lit edges (a few), edge = the outer silhouette, '
            "mid = inner details, lo = faint background lines like the base grid.")}]


def clean_drawing(raw: dict) -> dict | None:
    out = []
    for p in raw.get("paths") or []:
        if not isinstance(p, dict):
            continue
        d = re.sub(r"\s+", " ", str(p.get("d") or "")).strip()
        if not _D_OK.match(d) or not d[:1] in "Mm":
            continue
        out.append({"d": d, "c": p.get("c") if p.get("c") in KIND else "mid"})
        if len(out) >= 60:
            break
    return {"name": str(raw.get("name") or "")[:60], "paths": out} if len(out) >= 4 else None


def mock_drawing(word: str) -> dict:
    """تجربة بدون نموذج: صندوق أيزومتريك على قاعدة."""
    return {"name": f"mock {word}", "paths": [
        {"d": "M90 230 L200 285 L310 230 L200 175 Z", "c": "lo"},
        {"d": "M140 200 L200 230 L260 200 L200 170 Z", "c": "edge"},
        {"d": "M140 200 L140 130 L200 100 L260 130 L260 200", "c": "edge"},
        {"d": "M140 130 L200 160 L260 130", "c": "hi"},
        {"d": "M200 160 L200 230", "c": "hi"},
        {"d": "M170 145 L170 215", "c": "mid"},
        {"d": "M230 145 L230 215", "c": "mid"},
    ]}
