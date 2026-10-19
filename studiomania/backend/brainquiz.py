"""🧩 «ضيف للعقل بكويز»: أسئلة قصيرة، كل إجابة بتروح لخانتها في العقل على طول.

- العربي فصحى بسيطة (مش لهجة) عشان ينفع لأي بلد، ومعاه نسخة إنجليزي.
- الأمثلة عامة لأي نشاط (مش لبراند معيّن).
- to: field = خانة في العقل · note = معلومة في «المعرفة» تحت قسم · rules = قاعدة لكل سطر · pick = اختيار من قايمة.
"""
from __future__ import annotations

Q = [
    {"id": "domain", "to": {"field": "domain"},
     "ar": "ما مجال عملك؟", "en": "What field is your business in?",
     "ph_ar": "مثلًا: مطعم، عيادة، متجر ملابس، تطبيق، استشارات", "ph_en": "e.g. restaurant, clinic, clothing store, app, consulting"},
    {"id": "type", "to": {"pick": "type"}, "ar": "ما الذي تقدمه؟", "en": "What do you offer?",
     "opts": [["service", "خدمة", "A service"], ["physical", "منتج ملموس", "A physical product"], ["app", "تطبيق أو موقع", "An app or website"]]},
    {"id": "about", "to": {"field": "about"},
     "ar": "صِف مشروعك في جملتين: ماذا تقدم، وما الذي يميزك عن غيرك؟", "en": "Describe your business in two sentences: what you offer and what sets you apart.",
     "ph_ar": "مثلًا: نقدم وجبات صحية جاهزة بتوصيل في نفس اليوم، وكل وجبة محسوبة السعرات", "ph_en": "e.g. We deliver ready healthy meals the same day, each with counted calories"},
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
    {"id": "voice", "to": {"note": "voice", "title_ar": "نبرة البراند", "title_en": "Brand voice"},
     "ar": "كيف تحب أن يبدو صوت البراند؟", "en": "How should your brand sound?",
     "ph_ar": "مثلًا: ودود ومرح، أو جاد وموثوق، أو فاخر وهادئ", "ph_en": "e.g. friendly and fun, serious and trusted, or calm and premium"},
    {"id": "products", "to": {"note": "products", "title_ar": "أهم المنتجات والخدمات", "title_en": "Main products and services"},
     "ar": "ما أهم منتجاتك أو خدماتك، وبكم تقريبًا؟", "en": "What are your main products or services, and roughly how much do they cost?",
     "ph_ar": "اكتب كل واحد في سطر مع سعره إن أمكن", "ph_en": "One per line, with price if possible", "multi": True},
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
    {"id": "seasons", "to": {"note": "seasonal", "title_ar": "مواسم مهمة للعلامة", "title_en": "Important seasons"},
     "ar": "هل هناك مواسم أو مناسبات مهمة لعملك؟", "en": "Are there seasons or occasions that matter for your business?",
     "ph_ar": "مثلًا: رمضان، الأعياد، العودة للمدارس، الصيف", "ph_en": "e.g. holidays, back to school, summer"},
    {"id": "rivals", "to": {"note": "other", "title_ar": "منافسون وحسابات مُلهمة", "title_en": "Competitors or accounts we like"},
     "ar": "من منافسوك، أو من الحسابات التي تعجبك في مجالك؟", "en": "Who are your competitors, or accounts you admire in your field?",
     "ph_ar": "اكتب اسم الحساب أو رابطه في كل سطر", "ph_en": "One account name or link per line", "multi": True},
]
BY_ID = {q["id"]: q for q in Q}


def public(lang: str) -> list[dict]:
    """الأسئلة باللغة المطلوبة (من غير تفاصيل الحفظ)."""
    en = lang == "en"
    out = []
    for q in Q:
        x = {"id": q["id"], "q": q["en" if en else "ar"], "ph": q.get("ph_en" if en else "ph_ar", ""), "multi": bool(q.get("multi")), "ltr": bool(q.get("ltr"))}
        if "pick" in q["to"]:
            x["opts"] = [[v, en_t if en else ar_t] for v, ar_t, en_t in q["opts"]]
        out.append(x)
    return out


def current(q: dict, brain: dict) -> str:
    """الإجابة اللي في العقل دلوقتي (عشان تظهر لو رجعت للسؤال)."""
    to = q["to"]
    if "field" in to:
        return str(brain.get(to["field"]) or "")
    if "pick" in to:
        return str(brain.get(to["pick"]) or "")
    if "note" in to:
        n = next((x for x in brain.get("notes") or [] if x.get("quiz") == q["id"]), None)
        return str((n or {}).get("body") or "")
    return ""
