"""🧩 «أضف للعقل بكويز»: أسئلة قصيرة، كل إجابة تروح لخانتها في العقل مباشرة.

- العربي فصحى بسيطة (مش لهجة) عشان ينفع لأي بلد، ومعاه نسخة إنجليزي.
- الأمثلة عامة لأي نشاط (غير لبراند معيّن).
- to: field = خانة في العقل · note = معلومة في «المعرفة» أسفل قسم · rules = قاعدة لكل سطر · pick = اختيار من قائمة.
"""
from __future__ import annotations

import rivals

Q = [
    {"id": "domain", "to": {"field": "domain"},
     "ar": "ما مجال عملك؟", "en": "What field is your business in?",
     "ph_ar": "مثلًا: مطعم، عيادة، متجر ملابس، تطبيق، استشارات", "ph_en": "e.g. restaurant, clinic, clothing store, app, consulting"},
    {"id": "type", "to": {"pick": "type"}, "ar": "ما الذي تقدمه؟", "en": "What do you offer?",
     "opts": [["service", "خدمة", "A service"], ["physical", "منتج ملموس", "A physical product"], ["app", "تطبيق أو موقع", "An app or website"]]},
    {"id": "about", "to": {"field": "about"},
     "ar": "صِف مشروعك في جملتين: ماذا تقدم، وما الذي يميزك عن غيرك؟", "en": "Describe your business in two sentences: what you offer and what sets you apart.",
     "ph_ar": "مثلًا: نقدم وجبات صحية جاهزة توصيل في نفس اليوم، وكل وجبة محسوبة السعرات", "ph_en": "e.g. We deliver ready healthy meals the same day, each with counted calories"},
    {"id": "audience", "to": {"field": "audience"},
     "ar": "من هو عميلك المثالي؟", "en": "Who is your ideal customer?",
     "ph_ar": "العمر، الاهتمامات، وما الذي يبحث عنه", "ph_en": "Age, interests, and what they are looking for"},
    {"id": "pain", "to": {"note": "audience", "title_ar": "مشكلة العميل قبل أن يجدنا", "title_en": "Customer problem before finding us"},
     "ar": "ما أكبر مشكلة يعاني منها عميلك قبل أن يجدك؟", "en": "What is the biggest problem your customer has before finding you?",
     "ph_ar": "مثلًا: لا يجد وقتًا للطبخ، أو لا يثق في الجودة", "ph_en": "e.g. no time to cook, or doesn't trust the quality"},
    {"id": "market", "to": {"field": "market"},
     "ar": "في أي دولة أو مدينة يوجد عملاؤك؟", "en": "Which country or city are your customers in?",
     "ph_ar": "مثلًا: الرياض، أو مصر كلها، أو الخليج", "ph_en": "e.g. one city, a whole country, or a region"},
    {"id": "language", "to": {"field": "language"},
     "ar": "بأي لغة أو لهجة تحب أن نخاطب جمهورك؟", "en": "Which language or dialect should we speak to your audience in?",
     "ph_ar": "مثلًا: لهجة البلد، أو فصحى بسيطة، أو إنجليزي", "ph_en": "e.g. the local dialect, simple formal Arabic, or English"},
    {"id": "voice", "to": {"note": "voice", "title_ar": "نبرة العلامة", "title_en": "Brand voice"},
     "ar": "كيف تحب أن يبدو صوت العلامة؟", "en": "How should your brand sound?",
     "ph_ar": "مثلًا: ودود ومرح، أو جاد وموثوق، أو فاخر وهادئ", "ph_en": "e.g. friendly and fun, serious and trusted, or calm and premium"},
    {"id": "products", "to": {"note": "products", "title_ar": "أهم المنتجات والخدمات", "title_en": "Main products and services"},
     "ar": "ما أهم منتجاتك أو خدماتك، وبكم تقريبًا؟", "en": "What are your main products or services, and roughly how much do they cost?",
     "ph_ar": "اكتب كل واحد في سطر مع سعره أن أمكن", "ph_en": "One per line, with price if possible", "multi": True},
    {"id": "offer", "to": {"note": "offers", "title_ar": "العرض الحالي", "title_en": "Current offer"},
     "ar": "هل لديك عرض حالي أو ميزة تجذب العملاء؟", "en": "Do you have a current offer or a hook that attracts customers?",
     "ph_ar": "مثلًا: خصم لأول طلب، أو توصيل مجاني، أو ضمان استرجاع", "ph_en": "e.g. first-order discount, free delivery, or a money-back guarantee"},
    {"id": "proof", "to": {"note": "claims", "title_ar": "نتائج حقيقية يمكن ذكرها", "title_en": "Real results we can mention"},
     "ar": "ما النتائج أو الأرقام الحقيقية التي يمكننا ذكرها؟", "en": "What real results or numbers can we mention?",
     "ph_ar": "مثلًا: عدد العملاء، سنوات الخبرة، تقييمات، شهادات", "ph_en": "e.g. number of customers, years of experience, ratings, testimonials", "multi": True},
    {"id": "faq", "to": {"note": "other", "title_ar": "أسئلة العملاء المتكررة", "title_en": "Frequent customer questions"},
     "ar": "ما الأسئلة التي يكررها عملاؤك دائمًا؟", "en": "What questions do your customers keep asking?",
     "ph_ar": "اكتب كل سؤال في سطر", "ph_en": "One question per line", "multi": True},
    {"id": "rules", "to": {"rules": True},
     "ar": "هل هناك أشياء ممنوعة في محتواك؟", "en": "Is there anything that must never appear in your content?",
     "ph_ar": "كلمات، وعود، موضوعات… اكتب كل قاعدة في سطر", "ph_en": "Words, promises, topics… one rule per line", "multi": True},
    {"id": "cta", "to": {"field": "cta"},
     "ar": "ماذا تريد من المشاهد أن يفعل بعد أن يرى الفيديو؟", "en": "What should viewers do after watching?",
     "ph_ar": "مثلًا: اطلب الآن، احجز موعدك، حمّل التطبيق", "ph_en": "e.g. order now, book a visit, download the app"},
    {"id": "link", "to": {"field": "link"},
     "ar": "ما رابط موقعك أو صفحتك أو رقم التواصل؟", "en": "What is your website, page link, or contact number?",
     "ph_ar": "https://…", "ph_en": "https://…", "ltr": True},
    # المواسم مش سؤال: المخ بيجيبها لوحده من السوق والجمهور (رمضان والأعياد والمواسم المحلية) وبتتحط في «المعرفة»
    {"id": "rivals", "to": {"note": "other", "title_ar": "منافسون وحسابات مُلهمة", "title_en": "Competitors or accounts we like"},
     "ar": "من منافسوك، أو من الحسابات التي تعجبك في مجالك؟", "en": "Who are your competitors, or accounts you admire in your field?",
     "ph_ar": "اكتب اسم الحساب أو رابطه في كل سطر", "ph_en": "One account name or link per line", "multi": True},
]
BY_ID = {q["id"]: q for q in Q}


def public(lang: str) -> list[dict]:
    """الأسئلة باللغة المطلوبة (بدون تفاصيل الحفظ)."""
    en = lang == "en"
    out = []
    for q in Q:
        x = {"id": q["id"], "q": q["en" if en else "ar"], "ph": q.get("ph_en" if en else "ph_ar", ""), "multi": bool(q.get("multi")), "ltr": bool(q.get("ltr"))}
        if "pick" in q["to"]:
            x["opts"] = [[v, en_t if en else ar_t] for v, ar_t, en_t in q["opts"]]
        out.append(x)
    return out


def current(q: dict, brain: dict) -> str:
    """الإجابة التي في العقل الآن (لكي تظهر إذا رجعت للسؤال)."""
    to = q["to"]
    if "field" in to:
        return str(brain.get(to["field"]) or "")
    if "pick" in to:   # النوع الافتراضي («تطبيق») لا يظهر كإجابة: إما ما اختاره العميل أو المجال، وإلا فارغ
        return str(brain.get(to["pick"]) or "") if to["pick"] != "type" or brain.get("type_set") else ""
    if "note" in to:
        n = next((x for x in brain.get("notes") or [] if x.get("quiz") == q["id"]), None)
        return str((n or {}).get("body") or "")
    return ""


# ✅ مهام العقل: الحاجات اللي مش أسئلة (ترفع صور، فيديو، تسجّل صوتك…). الكويز بيجمعها مع الأسئلة،
# ولما الاتنين يخلصوا يبقى العقل عنده كل اللي محتاجه. go: نقطة في الخريطة (leaf) أو صفحة (page).
def tasks(b: dict, ctx: dict) -> list[dict]:
    import re
    hexes = re.findall(r"#[0-9a-fA-F]{6}\b", str(b.get("palette") or ""))
    has = lambda k: bool(b.get(k))  # noqa: E731
    app = b.get("type") == "app"
    tw = ctx.get("twin") or {}
    items = [
        ("logo", "ارفع الشعار", "الشعار يوضع على الفيديوهات والصور", has("logos"), {"leaf": "look:logos:"}),
        ("palette", "ضع ألوان العلامة", "الألوان تسير على كل التصميمات", bool(hexes), {"leaf": "look:palette:"}),
        ("typography", "اختر خطوط العلامة", "خط العناوين وخط النص", bool(str(b.get("typography") or "").strip()), {"leaf": "look:typography:"}),
        ("intro", "ارفع إنترو العلامة", "فيديو قصير في أول كل فيديو", bool(b.get("intro_file")), {"leaf": "delivery:intro:"}),
        ("outro", "ارفع أوترو العلامة", "فيديو قصير في آخر كل فيديو", bool(b.get("outro_file")), {"leaf": "delivery:outro:"}),
        ("caption", "اكتب التعليق النصي الافتراضي", "الشكل الذي التعليق النصي ينزل به مع كل منشور", bool(str(b.get("caption") or "").strip()), {"leaf": "delivery:caption:"}),
        # الحساب اتدّى للعقل (من أسئلة البداية أو سؤال الرابط) ← التحليل شغّال لوحده، فالمهمة متتعدّش ومتطلبهوش تاني
        ("social", "حلّل حساب السوشيال الخاص بك", "العقل يتعلم من بوستاتك ومشاهداتك",
         bool(b.get("todos") or b.get("niche") or b.get("social") or any(x.get("kind") == "social" and x.get("status") != "failed" for x in b.get("sources") or [])),
         {"leaf": "improve:social:"}),
        ("rivals", "وافق على منافسوك", "البرنامج يقترح، وأنت تختار ما تريد تصبح زيهم", bool(rivals.approved(b.get("competitors") or {})), {"page": "rivals"}),
        ("twin_photos", "ارفع صورك لكي الأفاتار", "صور وشّك من كذا زاوية في «نسختي»", bool(tw.get("photo")), {"page": "twin"}),
        ("twin_video", "ارفع فيديو لك وأنت تتكلم", "لكي الأفاتار يتحرك ويتكلم زيك", bool(tw.get("video")), {"page": "twin"}),
        ("twin_voice", "سجّل صوتك", "لكي الأفاتار يتكلم بصوتك", bool(tw.get("voice")), {"page": "twin"}),
        ("characters", "أنشئ شخصية للعلامة", "شخصية ثابتة تظهر في الفيديوهات", ctx.get("coaches", 0) > 0, {"page": "coaches"}),
        ("voice", "أضف تعليق صوتي", "تسجيلات صوت توضع على الفيديوهات", ctx.get("voices", 0) > 0, {"page": "brainlib", "tab": "voice"}),
        ("music", "أضف موسيقى", "موسيقى العلامة للفيديوهات", ctx.get("music", 0) > 0, {"page": "brainlib", "tab": "music"}),
        ("lib_media", "ارفع صور وفيديوهات في مكتبة العقل", "المكتبة التي النموذج المخصص يسحب منها", ctx.get("lib_media", 0) > 0, {"page": "brainlib"}),
    ]
    return [{"id": i, "t": t, "why": w, "done": bool(d), "go": g} for i, t, w, d, g in items]


# ✨ الاقتراح المستني (من تحليل الحساب أو أي مصدر) اللي بيجاوب على كل سؤال
NOTE_SECTIONS = {"products": "products", "offer": "offers", "proof": "claims", "voice": "voice"}


def answers(q: dict, p: dict) -> bool:
    """الاقتراح ده بيجاوب على السؤال ده؟"""
    to = q["to"]
    if "field" in to or "pick" in to:
        return p.get("kind") == "field" and p.get("field") == (to.get("field") or to.get("pick"))
    if "rules" in to:
        return p.get("kind") == "rule"
    if q["id"] in NOTE_SECTIONS:
        return p.get("kind") == "note" and p.get("section") == NOTE_SECTIONS[q["id"]]
    return False


def suggestions(brain: dict) -> dict[str, str]:
    out = {}
    pend = brain.get("pending") or []
    for q in Q:
        hits = [p for p in pend if answers(q, p)]
        if not hits:
            continue
        if q["to"].get("rules") or q["id"] in NOTE_SECTIONS:
            out[q["id"]] = "\n".join(str(p.get("value") or p.get("summary") or p.get("title") or "").strip() for p in hits if (p.get("value") or p.get("summary")))[:4000]
        else:
            out[q["id"]] = str(hits[-1].get("value") or "")[:4000]
    if social_link(out.get("link", "")):   # اقتراح قديم كان الحساب نفسه: مش رابط الدعوة
        out.pop("link")
    return {k: v for k, v in out.items() if v}


def social_link(ans: str) -> bool:
    """الإجابة رابط حساب إنستغرام أو تيك توك (أو @اسم)؟ (مش موقع ولا رقم)"""
    a = str(ans or "").strip()
    return bool(a) and ("instagram.com" in a or "tiktok.com" in a or (a.startswith("@") and " " not in a and len(a) > 2))
