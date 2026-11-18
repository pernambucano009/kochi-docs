"""🔤 قوالب التايبوجرافي الجاهزة (١٦ قالب من جلسة القوالب، اتعتمدت ١٨ نوفمبر): كل قالب = كوليكشن + حركات ثابتة + نوع الخلفية.
- type: كلام على خلفية سادة غامقة.
- stock: كلام فوق لقطة متولّدة (قواعد stockgen: موضوع بسيط، من غير اختلاط، فلتر الشكل الطبيعي، وفلتر الـ slop)، وتغميق ٢٥٪.
- other: حركات خاصة (بحث وسوشيال، مكالمة). «مكالمة من المدرب» بصوتين: كل سطر في السكريبت عليه المتكلم A أو B.

الوصفة (نفس سكريبت المعاينات): الصوت ← توقيت الكلمات ← studio_plan بالكوليكشن والـ seed ← الحركات الثابتة مكان أول البلوكات ←
مشروع تايبوجرافي (الصوت مصدر، واللقطة خلفية) ← الرسم بمحرك التايبوجرافي نفسه.
"""
from __future__ import annotations

import re

SPECS: dict[str, dict] = {}
_RAW = [
    # id, الاسم، النوع، الكوليكشن، seed، الحركات، المجالات (* = كلها)، الوصف
    ("ty-slam", "ضربة الكلمة", "type", "katana", 1, ["slamword", "stackrepeat", "spikeburst", "slamword"], "*",
     "كلمات قصيرة تضرب الشاشة واحدة وراء الأخرى بقوة على الإيقاع."),
    ("ty-drum", "قائمة تدور", "type", "drum", 2, ["endcard", "drumpicker", "endcard"], "*",
     "سؤال، ثم قائمة تدور مثل عجلة الاختيار حتى تقف على الإجابة."),
    ("ty-duo", "سؤال وجواب مضغوط", "type", "condensed", 3, ["capstack", "pillword"], "*",
     "سؤال بخط عريض مضغوط، وجوابه في كبسولة ملوّنة."),
    ("ty-figs", "ملصق تحفيزي", "type", "motiv", 4, ["shadowquote", "haloring", "shadowquote", "haloring"], "*",
     "جمل تحفيزية كأنها ملصق، بظل عميق وحلقة ضوء حول الكلمة المهمة."),
    ("ty-strobe", "كلمات سريعة", "type", "strobe", 5, ["strobe", "strobe"], "*",
     "كلمات تومض بسرعة واحدة بعد الأخرى، مناسبة للقوائم والشعارات القصيرة."),
    ("st-offer", "عرض فوق لقطة", "stock", "product", 6, ["stairs", "dates", "signature"], "fitness",
     "العرض يُكتب درجة درجة فوق لقطة هادئة، والتاريخ والتوقيع في النهاية."),
    ("st-depth", "كلام بعمق فوق لقطة", "stock", "depth", 7, ["dofwords", "dofwords"], "fitness",
     "كلمات تتحرك بين القريب والبعيد فوق لقطة بعمق ميدان ضحل."),
    ("st-orbit", "خدمات تدور فوق لقطة", "stock", "iconorbit", 8, ["iconorbit", "goldcap"], "fitness",
     "خدماتك تدور حول الكلمة الأساسية فوق لقطة من المكان."),
    ("ot-social", "بحث وسوشيال", "other", "social", 9, ["emoji", "search"], "*",
     "سؤال يُكتب في خانة البحث، والإجابة عندك."),
    ("ot-call", "مكالمة وشريط سينما", "other", "teaser", 10, ["cineband", "scriptover", "incall"], "*",
     "مكالمة قصيرة بصوتين بين المدرب والعميل، بشريط سينمائي وكلام على الشاشة."),
    ("st-bike", "تحريري فوق دراجة", "stock", "editorial", 11, ["artype", "floor"], "fitness",
     "كلام بأسلوب المجلات فوق لقطة دراجة ثابتة من الجنب."),
    ("st-food", "دافئ فوق أكل صحي", "stock", "warmpsych", 12, ["spread", "tornlabel"], "fitness",
     "ألوان دافئة وملصق ممزّق فوق لقطة أكل صحي."),
    ("st-box", "سريع فوق ملاكمة", "stock", "kinetic", 13, ["stretch", "redword"], "fitness",
     "كلام يتمدد ويضرب بالأحمر فوق لقطة ملاكمة."),
    ("st-run", "اقتباس فوق جري", "stock", "goldquote", 15, ["floor", "serifsolo"], "fitness",
     "اقتباس ذهبي بخط كلاسيكي فوق لقطة جري وقت الشروق."),
    ("st-gold", "فخم فوق أوزان", "stock", "luxgold", 18, ["artype", "signature"], "fitness",
     "عرض فخم بالذهبي فوق لقطة أوزان في نادٍ فارغ."),
    ("st-yoga", "مطبوع فوق يوغا", "stock", "print", 19, ["spread", "redword"], "fitness",
     "كلام بأسلوب الطباعة فوق لقطة يوغا هادئة."),
]
STOCK = {   # (وصف الصورة، وصف الحركة): من غير اختلاط، رجلين أو إيدين أو شخص واحد من ضهره، والجيم فاضي ومبلّر
    "st-offer": ("Vertical photo, side view close-up of one pair of sneakers and lower legs in long training pants walking on a treadmill, empty gym with no other people",
                 "Feet walk steadily on the treadmill belt, slow subtle camera slide, natural light"),
    "st-depth": ("Vertical photo of a calm empty fitness studio: one woman alone in long modest sportswear and hijab stretching on a yoga mat, seen from behind, no other people anywhere",
                 "She slowly stretches her arms overhead, gentle slow camera push-in, calm mood"),
    "st-orbit": ("Vertical photo inside a modern gym: close-up of hands gripping a dumbbell on a rack, no faces",
                 "Hands lift the dumbbell from the rack, slow smooth camera push-in"),
    "st-bike": ("Vertical photo, side view close-up of feet in sneakers pedaling a stationary bike, pedals and crank in focus, empty gym with no other people",
                "Feet pedal the stationary bike steadily, slow subtle camera slide"),
    "st-food": ("Vertical overhead photo of hands arranging a colorful healthy salad bowl with grilled chicken on a wooden table, no faces",
                "Hands place vegetables into the bowl, gentle slow camera push-in"),
    "st-box": ("Vertical photo in a boxing gym: close-up of red boxing gloves punching a heavy bag, no faces, dramatic light",
               "Gloves punch the heavy bag rhythmically, handheld energetic camera"),
    "st-run": ("Vertical photo at sunrise: close-up of running shoes on an outdoor running track, no faces, golden light",
               "Feet run along the track, low tracking camera, golden hour"),
    "st-gold": ("Vertical close-up photo of black and gold weight plates stacked on a barbell rack in an empty luxury gym, absolutely no people, warm light",
                "Slow cinematic camera slide along the weight plates, soft shimmering light"),
    "st-yoga": ("Vertical photo of a rolled out yoga mat in a calm sunlit studio, one woman alone in long modest clothes and hijab sitting cross-legged seen from behind, no other people",
                "She breathes slowly, gentle light, slow push-in"),
}
TWO_VOICES = {"ot-call": ("المدرب", "العميل")}   # قوالب الحوار: A وB
STYLE = "studio"
DIM = 0.25
SECS = 10   # طول اللقطة المتولّدة (بتتكرر لو الكلام أطول)

for _id, _n, _t, _c, _s, _k, _f, _d in _RAW:
    SPECS[_id] = {"id": _id, "name": _n, "type": _t, "collection": _c, "seed": _s, "kinds": _k,
                  "fields": "*" if _f == "*" else _f.split(), "desc": _d}


def fits(tid: str, field: str) -> bool:
    s = SPECS.get(tid)
    return bool(s) and (s["fields"] == "*" or not field or field in s["fields"])


def script_hint(tid: str) -> str:
    """توجيه كتابة السكريبت للقالب (للمسار)."""
    s = SPECS.get(tid) or {}
    if tid in TWO_VOICES:
        a, b = TWO_VOICES[tid]
        return (f"هذا القالب حوار قصير بصوتين: {a} (A) و{b} (B). اكتب ٣ إلى ٥ أسطر قصيرة، وكل سطر يبدأ بـ «A:» أو «B:» حسب من يتكلم، "
                "والحوار يبدأ بـ A وينتهي بدعوة واضحة.")
    base = "هذا القالب كلام فقط يتحرك على الإيقاع: جمل قصيرة جدًا (٢ إلى ٥ كلمات)، من ٣ إلى ٥ جمل، وكل جملة تنتهي بنقطة."
    if s.get("type") == "stock":
        base += " والكلام يظهر فوق لقطة هادئة من المكان."
    return base


LINE_RE = re.compile(r"^\s*([AB])\s*[:：]\s*(.+)$", re.I)


def dialogue(text: str) -> list[tuple[str, str]]:
    """«A: …» / «B: …» ← [(A, جملة)]. سطر من غير متكلم بياخد متكلم اللي قبله (والأول A)."""
    out, who = [], "A"
    for ln in str(text or "").splitlines():
        ln = ln.strip()
        if not ln:
            continue
        m = LINE_RE.match(ln)
        if m:
            who, ln = m.group(1).upper(), m.group(2).strip()
        out.append((who, ln))
    return out


def clean_script(text: str) -> str:
    """السكريبت من غير علامات المتكلم (اللي بيتكتب على الشاشة)."""
    if any(LINE_RE.match(ln) for ln in str(text or "").splitlines()):
        return " ".join(t for _, t in dialogue(text))
    return re.sub(r"\s+", " ", str(text or "")).strip()


def align(tokens: list[str], heard: list[dict]) -> list[dict]:
    """كلمات السكريبت بتوقيت التفريغ: لو نفس العدد كلمة بكلمة، وإلا على مدة الكلام بالتناسب مع طول الكلمات."""
    if not tokens:
        return []
    if not heard:
        out, t = [], 0.3
        for w in tokens:
            d = 0.32 + 0.035 * len(w)
            out.append({"w": w, "s": round(t, 3), "e": round(t + d, 3)})
            t += d + 0.04
        return out
    if len(tokens) == len(heard):
        return [{"w": t, "s": float(x["s"]), "e": float(x["e"])} for t, x in zip(tokens, heard)]
    a0, a1 = float(heard[0]["s"]), float(heard[-1]["e"])
    L = sum(len(x) + 1 for x in tokens)
    c, out = 0, []
    for x in tokens:
        s0 = a0 + (a1 - a0) * c / L
        c += len(x) + 1
        out.append({"w": x, "s": round(s0, 3), "e": round(a0 + (a1 - a0) * c / L - 0.04, 3)})
    return out


def stock_messages(tid: str, script: str, field_name: str) -> list[dict]:
    """وصف لقطة على قد السكريبت، من نفس عيلة لقطة القالب، وبقواعد اللقطات المتولّدة."""
    img, mot = STOCK.get(tid) or ("", "")
    return [{"role": "system", "content": "You write prompts for one short generated stock clip. Answer JSON only."},
            {"role": "user", "content": (
                f"Business field: {field_name}. Spoken script (Arabic): «{script[:600]}»\n"
                f"Reference shot of this template: {img}. Motion: {mot}\n"
                "Write ONE simple shot that fits what the script says, in the same family as the reference (same kind of framing). "
                "Simple subject only: hands, feet or legs, equipment, food, or ONE person seen from the side or from behind. "
                "No faces, no text, no screens, no pouring liquids, no complex body movement, no mixed-gender scenes; if a woman appears she is alone "
                "and in modest clothing with hijab. Empty background, softly blurred.\n"
                'Answer: {"image": "english image prompt", "motion": "english camera/motion prompt"}')}]


# النص النجدي المثال (معاينة المعرض)
SAMPLE = {
    "ty-slam": "خمس دقايق بس. كل يوم. بدون أعذار. وجسمك يشكرك.",
    "ty-drum": "وش تحب تتمرن؟ حديد، كارديو، يوغا، سباحة، وكلها عندنا.",
    "ty-duo": "تبي نتيجة أسرع؟ تمرّن أذكى، مو أكثر.",
    "ty-figs": "ثلاث حصص بالأسبوع. أكل متوازن. ونوم ثمان ساعات. هذي الخلطة.",
    "ty-strobe": "قوة، صبر، التزام. هذا اللي يصنع الفرق.",
    "st-offer": "أول حصة مجانية. بدون التزام. احجز الحين.",
    "st-depth": "جسمك يستاهل وقت لنفسه. ساعة بس باليوم.",
    "st-orbit": "حديد، كارديو، تغذية. كل اللي تحتاجه في مكان واحد.",
    "ot-social": "كتبت في البحث: كيف أنزل وزني؟ الجواب عندنا في نادي الحركة.",
    "ot-call": "A: مكالمة من مدربك. جاهز لأول حصة؟\nB: جاهز، متى نبدأ؟\nA: نشوفك بكرة الساعة ست.",
    "st-bike": "الدراجة الثابتة ثلاثين دقيقة. تحرق أكثر مما تتوقع.",
    "st-food": "الأكل الصحي مو حرمان. صحنك ملوّن، وطاقتك أعلى.",
    "st-box": "طلّع طاقتك. ملاكمة، تنفس، وارجع أخف.",
    "st-run": "كل خطوة تقرّبك من هدفك. لا توقف.",
    "st-gold": "اشتراك سنوي بخصم ثلاثين بالمية. لين نهاية الشهر.",
    "st-yoga": "دقيقة تنفس قبل التمرين. تفرق معك.",
}
