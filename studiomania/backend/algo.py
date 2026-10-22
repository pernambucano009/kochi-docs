"""📡 العقل العام: إزاي خوارزميات السوشيال بتشتغل، وإيه اللي بيخلّي الفيديو يتوزّع ويبيع.

معرفة ثابتة لكل العملاء (مش عقل براند): كل أداة بتاخد منها الجزء اللي يخصها بس، علشان البرومبت يفضل قصير.
مقطّرة من: كورس The TikTok & Reels Creator Course (One Peak Creative)، ونشرة وقناة يوتيوب Kallaway.
الأرقام اللي في المصادر دعاية للكورسات، فهنا المبادئ بس. الخوارزميات بتتغير: حدّث الملف ده، الأدوات بتاخد منه لوحدها.
"""
from __future__ import annotations

import json

import playbook

UPDATED = "2026-10-17"

# كل جزء: (العنوان، القواعد). مكتوبة قصيرة ومباشرة لأنها بتتحط جوه برومبتات الموديل
PARTS: dict[str, tuple[str, list[str]]] = {
    "core": ("إزاي الخوارزمية بتوزّع", [
        "المقياس الأول في كل المنصات = وقت المشاهدة (watch time) ونسبة اللي كمّلوا الفيديو. اللايك أقل أهمية بكتير.",
        "الفيديو بيتجرّب الأول على عيّنة صغيرة (حوالي ٢٠٠–٥٠٠ شخص) من المهتمين بالموضوع؛ لو فضلوا يتفرجوا بيكبر للي بعدها (آلاف ← عشرات الآلاف ← ملايين). كل اللعبة إن العيّنة الأولى تحبه.",
        "الخوارزمية بتفهم الفيديو من الكلام المنطوق والكلام المكتوب والكابشن والصورة، وبتوصّله للناس المهتمة بالموضوع ده. الهاشتاجات تأثيرها ضعيف.",
        "الثبات على مجال واحد: لو المتابعين جم عشان موضوع وانت نزلت موضوع تاني، العيّنة الأولى مش هتتفرج والفيديو يقع. السؤال قبل أي بوست: «اللي تابعوني هيحبوا ده؟»",
        "بعد الفرجة: التعليقات والمشاركة والحفظ أقوى إشارات. الحفظ = قيمة بيرجعلها؛ المشاركة = توزيع ببلاش لناس جديدة.",
        "مفيش ساعة سحرية للنشر ولا إعدادات سرية: الثبات وجودة الفكرة أهم من الوقت والهاشتاج.",
        "الجودة فوق الكمية بعد ما تتعلّم: البوست الضعيف بيبوّظ ثقة الجمهور في الحساب. في البداية كتّر وجرّب، ولما تلاقي شكل بيكسب كرّره بجودة أعلى.",
        "ماتعملش Boost (ترويج مدفوع) لمشاهدات أو متابعين: بيجيب ناس مش مهتمة فتبوّظ العيّنة الأولى للفيديوهات الجاية.",
    ]),
    "idea": ("الفكرة (أهم من الهوك)", [
        "الفكرة = موضوع يهم الجمهور فعلًا + زاوية/رأي جديد مش بديهي + معلومة أو قيمة يقدر يطبّقها. هوك قوي على فكرة ضعيفة = فشل.",
        "خد المواضيع من الداتا (اللي نجح عندك أو عند المنافسين بمضاعف عالي ×٥ فأكتر من متوسطهم)، والرأي والزاوية من عندك. ماتنسخش حرفيًا: ثبّت اللي نجح وغيّر عنصر أو اتنين وحسّنهم.",
        "وهم الجِدّة: أي موضوع قديم يبان جديد بكشف زاوية جديدة + ربطها بنتيجة الجمهور عايزها + مقارنتها بالمعتقد القديم («قالولك كذا… الحقيقة كذا»).",
        "لازم تبقى relatable: موقف أو رأي الجمهور عايشه أو بيختلف عليه، ده اللي بيولّد كومنتات ومشاركة.",
        "قابلة للتكرار: أحسن فكرة = شكل (format) تقدر تعيده بتغيير عنصر واحد كل مرة.",
        "ابعد عن الترند إلا لو عندك زاوية مختلفة تمامًا أو انت من أول الناس فيه؛ اللي بيقلّد الترند متأخر مابيستفيدش.",
        "الأشكال اللي بتنجح بثبات: تحدّي فيه رهان (stakes)، تعليمي بفجوة معرفة، قبل وبعد (تحوّل)، تجربة مع ناس، موقف تمثيلي (سكتش)، رد على كومنت، مقارنة ده ولا ده، ترتيب/قايمة.",
    ]),
    "hook": ("الهوك (أول ٣ ثواني)", [
        "الهوك لازم يجاوب في أول جملة: الفيديو عن إيه؟ وهكسب إيه لو كمّلت؟ — بكلام واضح جدًا (لغة طفل ١٢ سنة)، أقل كلمات ممكنة، وتفسير واحد بس.",
        "الفضول = تناقض بين اللي الجمهور فاكره والحقيقة الجديدة؛ كل ما الفجوة أوسع الهوك أقوى. روافعه: رهان (حاجة على المحك)، فجوة معرفة، وعد برد فعل، فكرة غريبة/مضحكة.",
        "٣ هوكات لازم يقولوا نفس المعنى بالظبط: الكلام المكتوب على الشاشة (الأهم، لأن أغلب الناس بتتفرج من غير صوت) + اللي بيتشاف + اللي بيتقال. أي تضارب = ثانية شك = سكرول.",
        "الكلام المكتوب في أول الفيديو: من ٣ لـ ١٠ كلمات، سطرين بالكتير، من غير علامات ترقيم وكلمات ربط، يفضل على الشاشة حوالي ٣ ثواني.",
        "أول فريم لازم يكون فيه حركة أو تباين أو حاجة غير متوقعة، ومكان حلو أحسن من أوضة ضلمة. الوش البشري أكتر حاجة بتوقف الناس.",
        "اختبار الصوت المقفول: لو شغّلت أول ٥ ثواني من غير صوت، حد غريب هيفهم الفيديو عن إيه؟",
        "أول ٢–٤ جمل بعد الهوك (منطقة القفل) هي اللي بتمسك المشاهد: أكّد وعد الهوك فورًا (من غير خداع) وحط دليل بدري: نتيجة، رقم حقيقي، تجربة. أو لمّح للتحوّل، أو سمّي فكرة هتشرحها، أو رد على الاعتراض الأول.",
        "ممنوع الهوكات المبهمة زي «هتتصدم» أو «استنى للآخر» من غير ما تقول عن إيه.",
    ]),
    "story": ("السكريبت والحكي", [
        "ابدأ بالمهم: إيه اللي بيحصل وليه يهمك الأول، وبعدين مين وإزاي، والمكان والزمان آخر حاجة. ابدأ بطاقة عالية مش من الصفر.",
        "اربط الجمل بـ «بس…» و«علشان كده…» مش «وبعدين…»: صراع يفتح سؤال، وسياق يقفله.",
        "النتيجة/المفاجأة (payoff) في آخر الفيديو مش في النص؛ ولما تيجي اقفل بعدها بثواني. ولازم توفّي بوعد الهوك.",
        "لوب الإدمان: رهان ← سؤال كبير يقدر يخمّن إجابته ← مفاجأة منطقية تكسر توقعه ← وانت بتقفل سؤال افتح سؤال جديد فورًا («بس هنا المشكلة…»، «ودي اللحظة اللي عرفت فيها…»).",
        "شيل أي ثانية مش بتضحّك أو بتفيد أو بتقرّب للنتيجة: أه وأمم والصمت والتكرار. الطول = أقصر حاجة توصل للنتيجة؛ قوة الهوك هي اللي بتبرر الطول.",
        "نوّع طول الجمل، واتكلم كأنك بتكلم صاحب واحد مش جمهور. اكتب أول جملة وآخر جملة الأول؛ آخر جملة تستاهل المشاركة، وفي الريلز ممكن توصل لأول جملة (لوب).",
        "الفكرة الأساسية تتلخص في جملة واحدة الناس تقدر تقولها لصاحبهم.",
        "فيه بطل الجمهور يشجعه (ممكن العميل نفسه)، و«خصم» أو طريقة قديمة نقارن بيها.",
    ]),
    "edit": ("المونتاج والشكل", [
        "الفيديو لازم يشد حتى والصوت مقفول: غيّر الزاوية أو اللقطة كل كام ثانية، وقرّب على الوش (punch-in)، وحط لقطات توضيحية (B-roll) فوق الكلام.",
        "ترجمة للكلام دايمًا، ٢–٣ كلمات على الشاشة في المرة، في نص الشاشة أو فوقه شوية (مش تحت خالص علشان مايتغطاش بالكابشن والأزرار).",
        "الموسيقى تناسب الإحساس أهم من إنها ترند، وتبقى واطية تحت الصوت (حوالي ٣–٦٪) علشان ماتغطيش على الهوك.",
        "الصوت لازم يبقى نضيف وواضح؛ الصورة العادية من الموبايل كفاية.",
        "الانتقالات: خلّي الكلام مستمر وانت بتنتقل، وحط صوت «ووش» خفيف يربط اللقطتين.",
        "المحتوى اللي من غير وش محتاج شغل أكتر على الصورة: ستايل بصري ثابت يتعرف زي التوقيع، وشكل متكرر.",
    ]),
    "engage": ("التعليقات والمشاركة والحفظ", [
        "تعليقات: حاجة غير متوقعة، أو موضوع الناس بتختلف عليه (خليك في النص ماتاخدش صف)، أو موقف relatable. رد على أول ٣٠ تعليق وافتح نقاش.",
        "مشاركة: لحظة «لازم تشوف ده»: معلومة مفيدة جدًا، أو حاجة مضحكة، أو مؤثرة.",
        "حفظ: خطوات، قايمة نصايح، شرح عملي يرجعله؛ ده بيطوّل عمر الفيديو.",
    ]),
    "convert": ("تحويل المشاهدات لعملاء", [
        "حدّد اللعبة: شهرة عامة (فلوس إعلانات) غير بناء ثقة وبيع (خدمات/كوتشينج/منتج). للبيع: المشاهدة من الشخص الصح أهم من مليون مشاهدة غلط.",
        "الثقة = دقايق مشاهدة × إن الكلام يخصه × إنه مفيد. اتكلم لشخص واحد محدد بمشكلة محددة.",
        "الدماغ بيصنف الفيديو: حل محتمل لمشكلتي، ولا تسلية، ولا مايخصنيش. علشان يبقى «حل»: سمّي الألم أو النتيجة بالظبط في أول جملتين.",
        "الدليل بيبني الثقة، وأقواه بالترتيب: توصية من حد يعرفه ← جمهور كبير حقيقي ← إنك تبيّن مهارتك جوه الفيديو نفسه ← نتايج عملاء بأسمائهم ← نتيجتك انت. (من غير أرقام مخترعة أبدًا)",
        "دعوة (CTA) في كل فيديو، طبيعية كأنها خدمة: بعد ما تبيّن الألم، قدّم الخطوة الجاية. أحسنها: «علّق بكلمة كذا وأبعتلك [الدليل/الملف]» ومطابقة لموضوع الفيديو بالظبط.",
        "انقل الناس من المنصة (مستأجرة) لحاجة بتاعتك: إيميل، واتساب، قايمة.",
    ]),
    "caption": ("الكابشن والنشر", [
        "الكابشن = هوك تاني، آخر حاجة بيقراها قبل ما يسكرول: يكمّل الفضول ويسيب سؤال مفتوح، وبعده الشرح والدعوة. ماتكتبهوش أي كلام.",
        "٣–٥ هاشتاجات محددة بالمجال في الآخر، وممنوع #fyp و#viral و#explore (بتوديك لناس مش مهتمة).",
        "صورة الغلاف (cover) فريم مثير + عنوان قصير، اختارها بنفسك.",
        "اعمل تاج للبراند أو الأشخاص اللي في الفيديو، ومكان لو البزنس محلي. في إنستجرام: بوست Collab بيظهر عند الاتنين.",
        "لو الفيديو معمول بالذكاء الصناعي علّم عليه إنه AI (مافيش عقاب، والمنصة ممكن تشيله لو ماعلّمتش).",
    ]),
    "analyze": ("تحليل اللي نجح", [
        "قيس كل فيديو بمضاعف متوسط حسابه (مشاهداته ÷ المتوسط)، مش بالأرقام المجردة: ×٥ فأكتر = الفكرة نجحت.",
        "حلّل بالدفعة (كل ١٠ فيديوهات) مش فيديو فيديو: إيه اللي الفايزين عملوه ومش موجود في الخاسرين؟ وجرّب تحسين واحد بس في الدفعة الجاية.",
        "فيديو ×٥–١٠: اعمل ٣ زيه بتعديل بسيط. فيديو ×١٠ فأكتر: كرّر نفس الموضوع ونفس الشكل في ٣ فيديوهات. الهدف ٢–٣ تركيبات (موضوع + شكل) بتكسب.",
        "الترتيب في الأهمية: عملاء/تسجيلات لكل فيديو ← متابعين لكل فيديو ← مشاهدات.",
        "لو الفيديو فشل: الموضوع يهم؟ الزاوية جديدة؟ الهوك قوي وواضح؟ فيه لحظات مملة؟ النتيجة في الآخر؟ relatable؟",
    ]),
}

# الفرق بين المنصات (اللي اتقال في المصادر بس)
PLATFORMS = {
    "tiktok": "تيك توك: ممكن حساب جديد يوصل ملايين من أول فيديو في يوم؛ مهم للمنتجات الاستهلاكية ولبناء الوعي، وأضعف في تحويل الخدمات.",
    "instagram": "إنستجرام: أبطأ في الثقة بحساب جديد (محتاج كذا بوست)؛ أقوى منصة للتحويل بالكومنت والرسايل (ManyChat)؛ فيه Collab وتسوق جوه الفيديو.",
    "youtube": "يوتيوب شورتس: جمهور أصغر سنًا ومحتوى ترفيهي؛ والفيديو الطويل على يوتيوب أقوى حاجة للثقة والمبيعات.",
    "linkedin": "لينكدإن: جمهور أكبر سنًا ومهني وقيمته أعلى، بس متأخر عن الترندات والفيديو فيه أحدث.",
    "facebook": "فيسبوك: نفس منطق الريلز، وبيمشي مع إنستجرام حسب سن الجمهور.",
}

def rule(*parts: str, platform: str = "") -> str:
    """القواعد المختصرة (لما البرومبت محتاج تذكير سريع بس)."""
    blocks = []
    for p in parts:
        if p in PARTS:
            title, items = PARTS[p]
            blocks.append(f"[{title}]\n" + "\n".join(f"- {x}" for x in items))
    if platform in PLATFORMS:
        blocks.append("[المنصة]\n- " + PLATFORMS[platform])
    if not blocks:
        return ""
    return "📡 قواعد الخوارزميات (العقل العام للبرنامج، طبّقها من غير ما تذكرها بالاسم):\n" + "\n\n".join(blocks)


def for_use(use: str, platform: str = "", limit: int = 14000) -> str:
    """الفريمويركس الكاملة اللي تخص الأداة دي من مكتبة playbook (مش ملخّص)."""
    body = playbook.pack(use, limit)
    if platform in PLATFORMS:
        body += "\n\n[المنصة]\n- " + PLATFORMS[platform]
    if not body:
        return ""
    return ("📚 العقل العام: فريمويركس المحتوى والخوارزميات. اشتغل بيها فعلًا في كل اللي بتكتبه (طبّق الخطوات، "
            "مش تذكرها بالاسم ولا تشرحها للعميل)، وقواعد البراند ليها الأولوية لو حصل تعارض:\n\n" + body)


def public() -> dict:
    """للعرض في البرنامج: العميل يشوف كل الفريمويركس اللي الأدوات ماشية عليها."""
    return {"updated": UPDATED, "parts": [{"key": f["id"], "title": f["title"], "items": f["steps"]} for f in playbook.public()],
            "platforms": PLATFORMS}


# ---------------------------------------------------------------- 🔎 فحص قبل النشر

KINDS = {"script": "سكريبت فيديو قصير", "caption": "كابشن بوست", "idea": "فكرة فيديو", "hook": "هوك"}

CHECKS = [
    ("topic", "الموضوع يهم المشاهد المثالي ومن مجال الحساب"),
    ("seed", "الزاوية أو الرأي جديد ومش بديهي"),
    ("format", "الشكل (format) أنسب طريقة للفكرة"),
    ("hook", "الهوك: موضوع واضح + سبب يكمّل + مختصر + تفسير واحد"),
    ("align", "المكتوب والمعروض والمنطوق بيقولوا نفس المعنى"),
    ("soundoff", "يتفهم من غير صوت في أول ٥ ثواني"),
    ("lockin", "أول جمل بعد الهوك بتأكد الوعد وفيها دليل بدري"),
    ("lulls", "مفيش حشو أو لحظات مملة"),
    ("loops", "أسئلة بتتفتح وتتقفل (بس… علشان كده…) وفيه مفاجأة منطقية"),
    ("payoff", "النتيجة في الآخر وبتوفي بوعد الهوك"),
    ("relatable", "relatable وبيولّد كومنتات أو مشاركة"),
    ("save", "فيه قيمة تتحفظ (خطوات، قايمة، شرح)"),
    ("trust", "فيه دليل حقيقي يبني ثقة"),
    ("cta", "دعوة واضحة مطابقة لموضوع الفيديو"),
    ("repeat", "شكل ينفع يتكرر بتغيير عنصر"),
]


def review_messages(text: str, kind: str, platform: str, brand: str, goal: str = "") -> list[dict]:
    checks = "\n".join(f'- "{k}": {t}' for k, t in CHECKS)
    return [{"role": "system", "content": "إنت مراجع محتوى سوشيال صريح وعملي، بتقيّم قبل النشر بقواعد الخوارزميات. بترد بالعربي المصري البسيط. Return JSON only.\n\n"
             + for_use("review", platform)},
            {"role": "user", "content": f"""{('البراند:' + chr(10) + brand[:3000] + chr(10) * 2) if brand else ''}{('هدف المحتوى: ' + goal + chr(10)) if goal else ''}قيّم {KINDS.get(kind, 'المحتوى')} ده قبل النشر:
«««
{text[:6000]}
»»»

لكل بند من دول ادّي درجة من ١٠ وسبب في جملة واحدة وتعديل محدد لو الدرجة أقل من ٨ (لو البند مايتطبقش على النوع ده خلّي score = null):
{checks}

رجّع JSON بالشكل ده بس:
{{"score": الدرجة الكلية من ١٠٠,
  "verdict": "جملة: ينفع ينزل ولا محتاج تعديل وليه",
  "checks": [{{"key": "hook", "score": 7, "why": "", "fix": ""}}],
  "top_fixes": ["أهم ٣ تعديلات بالترتيب"],
  "hooks": ["٣ هوكات أحسن بنفس المعنى ولغة المحتوى"],
  "caption": "كابشن مقترح (هوك تاني + الدعوة + ٣–٥ هاشتاجات من المجال)"}}
ماتخترعش أرقام أو نتايج عن البراند."""}]


def clean_review(raw: dict) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    names = dict(CHECKS)
    checks = []
    for c in raw.get("checks") or []:
        if not isinstance(c, dict) or c.get("key") not in names:
            continue
        try:
            sc = None if c.get("score") is None else max(0, min(10, round(float(c["score"]))))
        except (TypeError, ValueError):
            sc = None
        checks.append({"key": c["key"], "title": names[c["key"]], "score": sc, "why": str(c.get("why") or "")[:300], "fix": str(c.get("fix") or "")[:300]})
    scored = [c["score"] for c in checks if c["score"] is not None]
    try:
        total = max(0, min(100, round(float(raw.get("score")))))
    except (TypeError, ValueError):
        total = round(sum(scored) / len(scored) * 10) if scored else 0
    lst = lambda k, n: [str(x)[:400] for x in (raw.get(k) or []) if str(x).strip()][:n]
    return {"score": total, "verdict": str(raw.get("verdict") or "")[:400], "checks": checks,
            "top_fixes": lst("top_fixes", 3), "hooks": lst("hooks", 3), "caption": str(raw.get("caption") or "")[:1500]}


def mock_review(text: str) -> dict:
    return clean_review({"score": 64, "verdict": "الفكرة كويسة بس الهوك محتاج يبقى أوضح والنتيجة تتأخر للآخر",
                         "checks": [{"key": k, "score": 5 + i % 5, "why": "تجريبي", "fix": "تعديل تجريبي" if 5 + i % 5 < 8 else ""} for i, (k, _) in enumerate(CHECKS)],
                         "top_fixes": ["قول الموضوع في أول جملة", "أخّر النتيجة لآخر ٥ ثواني", "ضيف دعوة بكلمة في الكومنت"],
                         "hooks": ["أغلب الناس بتعمل كده غلط", "قالولك كذا… الحقيقة كذا", "لو انت كذا، الفيديو ده ليك"],
                         "caption": "مكنتش متوقع النتيجة دي 👀\n\nعلّق بكلمة «دليل» وأبعتلك الخطوات\n#مجالك #نصايح"})


# ---------------------------------------------------------------- 🧭 خطة المحتوى للبراند (فريمويركس الاستراتيجية مطبّقة على العميل)

GAMES = {"mainstream": "شهرة عامة", "category": "شهرة في الفئة", "intuitive": "منتج بديهي (بيتباع بالإحساس)",
         "explanatory": "منتج محتاج شرح", "authority": "بناء ثقة وخبرة (خدمات/كوتشينج)"}
AXES = {"topic": "الموضوع", "substance": "العمق", "avatar": "الجمهور", "format": "الشكل", "visual": "الصورة"}
DAYS = ["السبت", "الأحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة"]


def strategy_messages(brand: str, rivals_txt: str, notes: str = "") -> list[dict]:
    games = " · ".join(f"{k} = {v}" for k, v in GAMES.items())
    axes = "، ".join(f"{k} ({v})" for k, v in AXES.items())
    return [{"role": "system", "content": "إنت استراتيجي محتوى سوشيال شاطر، بتطبّق الفريمويركس دي بالحرف على براند حقيقي، بالعربي المصري البسيط. Return JSON only.\n\n"
             + for_use("strategy", limit=16000)},
            {"role": "user", "content": f"""البراند:
{brand[:5000] or '(بيانات قليلة)'}

{rivals_txt[:2500] if rivals_txt else '(لسه مفيش داتا منافسين)'}
{('ملاحظات العميل: ' + notes) if notes else ''}

اعمل خطة محتوى كاملة للبراند ده مبنية على الفريمويركس، كلها مخصوصة ليه (ممنوع كلام عام ينفع لأي براند، وممنوع أرقام أو نتايج مخترعة):
رجّع JSON بالشكل ده بس:
{{"game": {{"key": "واحد من: {games}", "why": "ليه دي لعبته في جملتين"}},
  "statement": "أنا بساعد [مين بالظبط] يوصل لـ[نتيجة] عن طريق [طريقة]",
  "avatar": "الشخص الواحد اللي بنكلمه: سنه، موقفه، ألمه الأساسي، بيحلم بإيه",
  "rings": ["٥ دواير الجمهور من المركز الأضيق للأعرض"],
  "buckets": [{{"name": "مجموعة مواضيع", "ring": رقم الدايرة 1-5, "why": "ليه تهم الجمهور (من داتا المنافسين لو موجودة)", "topics": ["٣ مواضيع محددة من ٣–٥ كلمات"]}}],
  "formats": [{{"name": "شكل (format)", "why": "ليه يناسب البراند"}}],
  "formulas": [{{"topic": "مجموعة", "format": "شكل", "visual": "طريقة العرض البصري"}}],
  "week": [{{"day": "السبت", "ring": 1, "bucket": "", "idea": "فكرة الفيديو", "hook": "الهوك المكتوب على الشاشة", "cta": "الدعوة"}}],
  "takes": ["٥ آراء عكس السائد في المجال البراند يقدر يدافع عنها"],
  "words": ["٢–٣ كلمات أو عبارات عايزين الناس تربط البراند بيها"],
  "signature": "حاجة شكلية ثابتة تميّز فيديوهات البراند",
  "white_space": {{{', '.join(f'"{k}": "الفراغ في {v} اللي المنافسين مش مغطيينه"' for k, v in AXES.items())}}},
  "funnel": {{"keyword": "كلمة الكومنت", "magnet": "الهدية المجانية المطابقة للمواضيع (ملف/دليل…)", "offer": "إزاي توصل للعرض المدفوع"}},
  "cadence": "كام فيديو في الأسبوع ودلوقتي في أنهي مرحلة (تجريب ولا تكرار) وإيه اللي يتقاس",
  "platform": "منصة البيت المقترحة وليه",
  "profile": {{"bio": "بايو مقترح ~٨٠ حرف", "pinned": "الفيديو اللي يتثبّت"}},
  "avoid": ["٣–٥ حاجات البراند يبعد عنها"]}}
أعداد: buckets ٣–٤، formats ٢–٣، formulas ٤–٦، week ٧ أيام بالظبط بخلطة ٣-٢-١ (٤ في الدايرتين ١–٢، ١ في الدايرة ٤، ١ تجريبي، ١ تكرار لأحسن تركيبة)."""}]


# 🧭 خطة المحتوى بتتبني لوحدها من كل اللي العقل عرفه: كل خانة، كل إجابة، كل معلومة، كل موسم، كل لايك وديسلايك، كل تحليل.
# العدّاد = عدد المعلومات دي، وكل ما يزيد كفاية (أو حاجة أساسية تتغير) الخطة بتتعمل من جديد لوحدها.
PLAN_FIELDS = (("domain", "المجال"), ("about", "عن البراند"), ("audience", "الجمهور"), ("market", "السوق"), ("language", "اللغة واللهجة"),
               ("niche", "النيتش"), ("type", "نوع المنتج"), ("cta", "الدعوة (CTA)"), ("link", "اللينك"), ("caption", "الكابشن الافتراضي"), ("rules", "القواعد"))
PLAN_KEY = ("domain", "about", "audience", "market", "type", "cta")   # لو واحدة منهم اتغيرت الخطة بتتعمل من جديد على طول
PLAN_STEP = 3          # أو لما يتجمع ٣ معلومات جديدة
PLAN_MIN = 8           # أقل عدد معلومات تتعمل بيه أول خطة (ولازم المجال أو «عن البراند»، ودرجة فهم العقل PLAN_SCORE في app.py)


def plan_inputs(b: dict) -> list[tuple[str, str]]:
    """(النوع، المعلومة) لكل حاجة الخطة بتتبني عليها."""
    out = [("field", t) for k, t in PLAN_FIELDS if str(b.get(k) or "").strip()]
    out += [("quiz", q) for q in b.get("quiz_done") or []]
    out += [("note", n.get("title") or "") for n in b.get("notes") or [] if n.get("quiz") != "seasons_ai"]
    out += [("season", i.get("name") or "") for i in ((b.get("seasons") or {}).get("items") or [])[:40]]
    out += [("pref", (p.get("text") or "")[:40]) for p in (b.get("prefs") or [])[-60:]]
    comp = b.get("competitors") or {}
    out += [("rival", i.get("handle") or "") for i in comp.get("items") or []]
    if comp.get("digest"):
        out.append(("rivals_digest", "اللي بينجح عند المنافسين"))
    out += [("todo", t.get("title") or "") for t in b.get("todos") or []]
    bt = b.get("batch") or {}
    out += [("batch", h.get("hypothesis") or "") for h in bt.get("history") or []]
    if bt.get("analysis"):
        out.append(("batch", "تحليل آخر ١٠ فيديوهات"))
    out += [("trend", t.get("title") or "") for t in ((b.get("trends") or {}).get("items") or []) if t.get("saved")]
    return out


PLAN_KINDS = {"field": "خانات الهوية والتسليم", "quiz": "إجابات الكويز", "note": "معلومات المعرفة", "season": "مواسم ومناسبات", "pref": "لايكات وديسلايكات على الأفكار والسكريبتات",
              "rival": "منافسين", "rivals_digest": "تحليل المنافسين", "todo": "تحليل حسابك على السوشيال", "batch": "تحليل فيديوهاتك", "trend": "ترندات محفوظة"}


def plan_key_sig(b: dict) -> str:
    return "|".join(str(b.get(k) or "")[:300] for k in PLAN_KEY)


def plan_goal(b: dict) -> str:
    """الهدف بيتستنتج من العقل نفسه (الدعوة، اللينك، العروض، المنتجات، نوع المنتج) مش من العميل."""
    notes = {n.get("section"): n for n in b.get("notes") or []}
    bits = [f"الدعوة اللي في آخر الفيديوهات: {b['cta']}" if b.get("cta") else "", f"اللينك: {b['link']}" if b.get("link") else "",
            f"العرض: {(notes.get('offers') or {}).get('body', '')[:300]}" if notes.get("offers") else "",
            f"المنتجات والخدمات: {(notes.get('products') or {}).get('body', '')[:400]}" if notes.get("products") else ""]
    bits = [x for x in bits if x]
    return ("استنتج هدف البراند (بيع ولا شهرة ولا حجز ولا تحميل…) من المعلومات دي ومن ملف البراند، ماتسألش العميل:\n" + "\n".join(bits)) if bits else \
        "استنتج هدف البراند من ملفه (نوع المنتج، المجال، اللي بيقدمه)، ماتسألش العميل."


def plan_should(b: dict, count: int) -> bool:
    st = b.get("strategy") or {}
    if count < PLAN_MIN or not (b.get("domain") or b.get("about")):
        return False
    if not st:
        return True
    return plan_key_sig(b) != st.get("key_sig") or count - int(st.get("built_from") or 0) >= PLAN_STEP


def clean_strategy(raw: dict) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    s = lambda v, n=400: str(v or "").strip()[:n]
    lst = lambda v, n, m=300: [s(x, m) for x in (v or []) if s(x, m)][:n] if isinstance(v, list) else []
    num = lambda v, lo, hi: max(lo, min(hi, int(v))) if str(v).strip().lstrip("-").isdigit() else lo
    g = raw.get("game") or {}
    key = s(g.get("key"), 40).split(" ")[0].split("=")[0].strip()
    out = {"game": {"key": key if key in GAMES else "authority", "why": s(g.get("why"))},
           "statement": s(raw.get("statement")), "avatar": s(raw.get("avatar"), 600), "rings": lst(raw.get("rings"), 5, 120),
           "buckets": [{"name": s(b.get("name"), 80), "ring": num(b.get("ring"), 1, 5), "why": s(b.get("why")), "topics": lst(b.get("topics"), 4, 100)}
                       for b in (raw.get("buckets") or []) if isinstance(b, dict) and s(b.get("name"))][:5],
           "formats": [{"name": s(f.get("name"), 80), "why": s(f.get("why"))} for f in (raw.get("formats") or []) if isinstance(f, dict) and s(f.get("name"))][:4],
           "formulas": [{k: s(f.get(k), 120) for k in ("topic", "format", "visual")} for f in (raw.get("formulas") or []) if isinstance(f, dict)][:8],
           "week": [{"day": s(w.get("day"), 20) or DAYS[i % 7], "ring": num(w.get("ring"), 1, 5), "bucket": s(w.get("bucket"), 80), "idea": s(w.get("idea")),
                     "hook": s(w.get("hook"), 160), "cta": s(w.get("cta"), 200)} for i, w in enumerate(raw.get("week") or []) if isinstance(w, dict)][:7],
           "takes": lst(raw.get("takes"), 6), "words": lst(raw.get("words"), 4, 60), "signature": s(raw.get("signature")),
           "white_space": {k: s((raw.get("white_space") or {}).get(k)) for k in AXES},
           "funnel": {k: s((raw.get("funnel") or {}).get(k), 300) for k in ("keyword", "magnet", "offer")},
           "cadence": s(raw.get("cadence"), 500), "platform": s(raw.get("platform"), 400),
           "profile": {k: s((raw.get("profile") or {}).get(k), 200) for k in ("bio", "pinned")}, "avoid": lst(raw.get("avoid"), 5)}
    return out


def strategy_text(brain: dict | None) -> str:
    """الخطة اللي العميل عملها بتدخل في كل برومبت محتوى (مختصرة)."""
    st = (brain or {}).get("strategy") or {}
    if not st.get("statement") and not st.get("buckets"):
        return ""
    lines = ["خطة المحتوى المعتمدة للبراند (امشي عليها: نفس الجمهور والمواضيع والآراء، وماتخرجش برّه المجال):"]
    if st.get("statement"):
        lines.append(f"- التموضع: {st['statement']}")
    if st.get("game", {}).get("key"):
        lines.append(f"- لعبة المحتوى: {GAMES.get(st['game']['key'], '')}")
    if st.get("avatar"):
        lines.append(f"- الشخص اللي بنكلمه: {st['avatar']}")
    if st.get("buckets"):
        lines.append("- مجموعات المواضيع: " + " · ".join(f"{b['name']} ({'، '.join(b['topics'][:3])})" for b in st["buckets"]))
    if st.get("formats"):
        lines.append("- الأشكال الأساسية: " + "، ".join(f["name"] for f in st["formats"]))
    if st.get("takes"):
        lines.append("- آراء البراند المختلفة: " + " · ".join(st["takes"][:5]))
    if st.get("words"):
        lines.append("- كلمات نتعرف بيها (كررها): " + "، ".join(st["words"]))
    fn = st.get("funnel") or {}
    if fn.get("keyword") or fn.get("magnet"):
        lines.append(f"- الدعوة: علّق بكلمة «{fn.get('keyword') or '…'}» وناخد {fn.get('magnet') or 'الهدية'}")
    if st.get("avoid"):
        lines.append("- نبعد عن: " + " · ".join(st["avoid"]))
    return "\n".join(lines)[:2200]


def mock_strategy() -> dict:
    return clean_strategy({
        "game": {"key": "authority", "why": "البراند بيبيع خدمة محتاجة ثقة، فالمهم المشاهد الصح مش عدد المشاهدات"},
        "statement": "أنا بساعد المبتدئين في الجيم يوصلوا لأول نتيجة في ٩٠ يوم عن طريق تمارين بيتية بسيطة",
        "avatar": "شاب ٢٢–٣٠ سنة، شغال وماعندوش وقت، جرّب الجيم ووقف، نفسه يشوف نتيجة من غير ما يعيش في الجيم",
        "rings": ["مبتدئين جيم مشغولين", "مبتدئين لياقة", "مهتمين بالصحة", "شباب بيهتموا بشكلهم", "أي حد"],
        "buckets": [{"name": "أخطاء المبتدئين", "ring": 1, "why": "أعلى مضاعف عند المنافسين", "topics": ["غلطة الإحماء", "تمرين البطن الغلط", "الأكل بعد التمرين"]},
                    {"name": "تمارين بيتية سريعة", "ring": 2, "why": "بتتحفظ كتير", "topics": ["١٠ دقايق الصبح", "من غير أدوات", "قبل النوم"]},
                    {"name": "قصص تحوّل", "ring": 4, "why": "بتتشارك", "topics": ["٩٠ يوم", "رجعت بعد سنة", "من غير جيم"]}],
        "formats": [{"name": "غلطة ← التصحيح", "why": "بيوقف الناس اللي بتعمل الغلطة"}, {"name": "قبل وبعد", "why": "تحوّل واضح"}],
        "formulas": [{"topic": "أخطاء المبتدئين", "format": "غلطة ← التصحيح", "visual": "الكوتش للكاميرا + لقطة الغلط"}],
        "week": [{"day": d, "ring": [1, 2, 1, 2, 4, 3, 1][i], "bucket": "أخطاء المبتدئين", "idea": "فكرة تجريبية", "hook": "انت بتعمل التمرين ده غلط", "cta": "علّق «خطة»"} for i, d in enumerate(DAYS)],
        "takes": ["مش محتاج جيم في أول ٣ شهور", "الكارديو مش أحسن طريقة للتنشيف"], "words": ["٩٠ يوم", "من غير جيم"],
        "signature": "خلفية الأوضة نفسها ولوح أبيض عليه رقم اليوم",
        "white_space": {k: "تجريبي" for k in AXES}, "funnel": {"keyword": "خطة", "magnet": "جدول ٩٠ يوم PDF", "offer": "متابعة شهرية"},
        "cadence": "٣ فيديو في الأسبوع أول شهر (تجريب)، بعدين ٥", "platform": "إنستجرام علشان الكومنت بكلمة والرسايل",
        "profile": {"bio": "تمارين بيتية للمبتدئين · نتيجة في ٩٠ يوم · فيديو يومي", "pinned": "أكبر ٣ أخطاء للمبتدئين"},
        "avoid": ["فيديوهات ترند برّه اللياقة", "وعود بأرقام وزن"]})


# ---------------------------------------------------------------- 📊 تحليل الدفعة: آخر ١٠ فيديوهات + قاعدة ٥× و١٠×

BATCH = 10


def batch_rows(posts: list[dict], metrics: dict | None = None, n: int = BATCH) -> dict:
    """آخر n بوست، وكل بوست بكام ضعف وسيط الدفعة في (العملاء ← المتابعين ← المشاهدات)."""
    import statistics
    metrics = metrics or {}
    rows = sorted(posts, key=lambda p: -(p.get("ts") or 0))[:n]
    out = [{**{k: p.get(k) for k in ("id", "url", "caption", "views", "likes", "comments", "shares", "ts", "spoken")},
            "leads": (metrics.get(str(p.get("id"))) or {}).get("leads"), "follows": (metrics.get(str(p.get("id"))) or {}).get("follows")} for p in rows]

    def mult(key):
        vals = [r[key] for r in out if isinstance(r.get(key), (int, float)) and r[key] > 0]
        if len(vals) < 3:
            return None
        med = statistics.median(vals)
        for r in out:
            r[f"x_{key}"] = round(r[key] / med, 1) if isinstance(r.get(key), (int, float)) and med else None
        return med
    meds = {k: mult(k) for k in ("leads", "follows", "views")}
    best = 0.0
    for r in out:
        # المقياس الأهم الموجود: عملاء ← متابعين ← مشاهدات
        key = next((k for k in ("leads", "follows", "views") if meds.get(k) and r.get(f"x_{k}") is not None), None)
        r["x"] = r.get(f"x_{key}") if key else None
        r["by"] = key
        r["tier"] = "gold" if (r["x"] or 0) >= 10 else "win" if (r["x"] or 0) >= 5 else "ok" if (r["x"] or 0) >= 1 else "low"
        best = max(best, r["x"] or 0)
    verdict = "gold" if best >= 10 else "win" if best >= 5 else "redo"
    return {"rows": out, "medians": meds, "verdict": verdict, "best": best}


VERDICTS = {"gold": "🥇 دهب: فيديو عمل ١٠ أضعاف أو أكتر. كرّر نفس الموضوع ونفس الشكل بالظبط في ٣ من العشرة الجايين.",
            "win": "🏆 فايز: فيديو بين ٥ و١٠ أضعاف. خد نفس الموضوع/الشكل وعدّل فيه شوية في ٣ من العشرة الجايين.",
            "redo": "🔁 محدش عدّى ٥ أضعاف: الدفعة الجاية من الأول، وغالبًا فيه غلطة واضحة (الموضوع ولا الهوك)."}


def batch_messages(brand: str, strategy: str, b: dict) -> list[dict]:
    lines = []
    for i, r in enumerate(b["rows"], 1):
        extra = "".join(f" · {t} {r[k]}" for k, t in (("leads", "عملاء"), ("follows", "متابعين")) if r.get(k) is not None)
        lines.append(f"{i}) ×{r['x'] if r['x'] is not None else '?'} ({r['tier']}) · {r.get('views') or 0} مشاهدة{extra} · "
                     f"كومنت {r.get('comments') or 0} · شير {r.get('shares') or 0}\n   الكابشن: {(r.get('caption') or '')[:300]}"
                     + (f"\n   الكلام: {r['spoken'][:400]}" if r.get("spoken") else ""))
    return [{"role": "system", "content": "إنت محلل محتوى بيشتغل بنظام الدفعة (كل ١٠ فيديوهات مع بعض)، بالعربي المصري البسيط. Return JSON only.\n\n"
             + for_use("analysis", limit=9000) + "\n\n" + rule("idea", "hook")},
            {"role": "user", "content": f"""البراند:
{brand[:3000]}
{strategy}

آخر {len(b['rows'])} فيديوهات للبراند (×المضاعف = قد إيه عدّى وسيط الدفعة في أهم مقياس موجود: العملاء ثم المتابعين ثم المشاهدات):
{chr(10).join(lines)}

حكم الدفعة: {VERDICTS[b['verdict']]}

١) شغّل شيك ليست الـ ١١ قطعة (الشكل، الموضوع، البذرة، المحتوى، الهوك المعروض، الهوك المكتوب، الهوك المنطوق، هيكل الحكاية، الدعوة، العرض البصري، العناصر) على الفايزين مقابل الخاسرين: إيه اللي الفايزين عملوه ومش موجود في الخاسرين؟
٢) طلّع فرضية تحسين واحدة بس للدفعة الجاية.
٣) خطة الدفعة الجاية حسب الحكم: لو دهب أو فايز ٣ فيديوهات على نفس التركيبة + ٧ فيديوهات بالفرضية الجديدة؛ لو مفيش فايز ١٠ فيديوهات جديدة بتصلّح الغلطة.
رجّع JSON بالشكل ده بس:
{{"summary": "جملتين: الدفعة دي بتقول إيه",
  "bricks": [{{"brick": "اسم القطعة", "winners": "اللي في الفايزين", "losers": "اللي في الخاسرين"}}],
  "pattern": "النمط المشترك في الفايزين",
  "mistake": "أوضح غلطة في الخاسرين",
  "hypothesis": "التحسين الواحد اللي هنجرّبه",
  "formula": {{"topic": "", "format": "", "hook_style": ""}},
  "next": [{{"n": 1, "kind": "repeat أو test", "idea": "", "hook": "الهوك المكتوب على الشاشة", "based_on": رقم الفيديو أو null}}],
  "stop": ["حاجات نبطّلها"]}}
next = ١٠ فيديوهات بالظبط. ماتخترعش أرقام."""}]


def clean_batch(raw: dict) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    s = lambda v, n=400: str(v or "").strip()[:n]
    nxt = []
    for i, x in enumerate(raw.get("next") or []):
        if not isinstance(x, dict) or not s(x.get("idea")):
            continue
        bo = x.get("based_on")
        nxt.append({"n": i + 1, "kind": "repeat" if str(x.get("kind")).startswith("rep") else "test", "idea": s(x.get("idea")), "hook": s(x.get("hook"), 160),
                    "based_on": int(bo) if str(bo).isdigit() else None})
    f = raw.get("formula") or {}
    return {"summary": s(raw.get("summary"), 500), "pattern": s(raw.get("pattern"), 500), "mistake": s(raw.get("mistake"), 400),
            "hypothesis": s(raw.get("hypothesis"), 400), "formula": {k: s(f.get(k), 120) for k in ("topic", "format", "hook_style")},
            "bricks": [{"brick": s(x.get("brick"), 60), "winners": s(x.get("winners"), 250), "losers": s(x.get("losers"), 250)}
                       for x in (raw.get("bricks") or []) if isinstance(x, dict) and s(x.get("brick"))][:11],
            "next": nxt[:10], "stop": [s(x, 200) for x in (raw.get("stop") or []) if s(x)][:5]}


def mock_batch(b: dict) -> dict:
    top = max(range(len(b["rows"])), key=lambda i: b["rows"][i]["x"] or 0) + 1 if b["rows"] else None
    return clean_batch({"summary": "الفيديوهات اللي بتبدأ بغلطة الجمهور كسبت، واللي بتبدأ بالبراند وقعت.", "pattern": "هوك «انت بتعمل كذا غلط» + النتيجة في الآخر",
                        "mistake": "أول ٣ ثواني مفيهاش الموضوع", "hypothesis": "كل الهوكات تبدأ بالموضوع في أول ٣ كلمات",
                        "formula": {"topic": "أخطاء المبتدئين", "format": "غلطة ← تصحيح", "hook_style": "تقريري"},
                        "bricks": [{"brick": "الهوك المكتوب", "winners": "موضوع واضح", "losers": "تحية وتعريف"}],
                        "next": [{"kind": "repeat" if i < 3 else "test", "idea": f"فكرة تجريبية {i + 1}", "hook": "انت بتعمل ده غلط", "based_on": top if i < 3 else None} for i in range(10)],
                        "stop": ["نبدأ بـ «أهلًا بيكم»"]})


def batch_text(brain: dict | None) -> str:
    """آخر تحليل دفعة بيدخل في كتابة الأفكار: نكرّر الفايز ونجرّب الفرضية."""
    a = ((brain or {}).get("batch") or {}).get("analysis") or {}
    if not a.get("hypothesis") and not a.get("pattern"):
        return ""
    f = a.get("formula") or {}
    lines = ["آخر تحليل لفيديوهات البراند نفسه (اشتغل عليه):"]
    if a.get("pattern"):
        lines.append(f"- اللي نجح عندنا: {a['pattern']}")
    if any(f.values()):
        lines.append(f"- التركيبة الفايزة: موضوع «{f.get('topic')}» · شكل «{f.get('format')}» · هوك {f.get('hook_style')}")
    if a.get("hypothesis"):
        lines.append(f"- التحسين اللي بنجرّبه الدفعة دي: {a['hypothesis']}")
    if a.get("stop"):
        lines.append("- بطّلنا: " + " · ".join(a["stop"][:4]))
    return "\n".join(lines)[:1200]


# ---------------------------------------------------------------- ⚡ وضع الخوارزمية: القواعد خطوات إجبارية في صناعة الفيديو (مفتوح لكل براند إلا لو قفله)

def mode_on(brain: dict | None) -> bool:
    return (brain or {}).get("algo_mode", True) is not False


HEAT_KEYS = {"h": "فضول الخطاف", "e": "لا يوجد ركود", "a": "نتيجة في الآخر", "t": "relatable", "r": "قابلة للتكرار"}
IDEA_MIN = 6.5   # متوسط HEAT اللي أقل منه الفكرة بتترفض وتتعمل غيرها


def idea_gate_rule(brain: dict | None) -> str:
    st = (brain or {}).get("strategy") or {}
    buckets = "، ".join(b["name"] for b in st.get("buckets") or [])
    return ("\n⚡ وضع الخوارزمية: لكل فكرة زوّد في الـ JSON:\n"
            f'"ring": رقم دايرة الجمهور من ١ (الأضيق) لـ ٥ (الأعرض)' + (f" حسب الخطة ({' ← '.join(st.get('rings') or [])})" if st.get("rings") else "") + ",\n"
            f'"bucket": مجموعة المواضيع' + (f" (واحدة من: {buckets})" if buckets else "") + ",\n"
            '"heat": {"h": 0-10 قوة الفضول في الخطاف, "e": 0-10 خالية من الركود, "a": 0-10 فيه نتيجة قوية في الآخر, "t": 0-10 relatable, "r": 0-10 قابلة للتكرار بتغيير عنصر}.\n'
            "قيّم بصراحة (الدرجة العالية لازم تكون مستحقة). ماتقترحش أفكار في الدايرة الخامسة ولا برّه مجموعات المواضيع.")


def heat_of(raw) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    out = {}
    for k in HEAT_KEYS:
        try:
            out[k] = max(0.0, min(10.0, float(raw.get(k))))
        except (TypeError, ValueError):
            out[k] = None
    vals = [v for v in out.values() if v is not None]
    out["avg"] = round(sum(vals) / len(vals), 1) if vals else None
    return out


def idea_gate(it: dict, brain: dict | None) -> str:
    """سبب رفض الفكرة (فاضي = تعدّي)."""
    st = (brain or {}).get("strategy") or {}
    names = {b["name"] for b in st.get("buckets") or []}
    h = (it.get("heat") or {}).get("avg")
    if h is not None and h < IDEA_MIN:
        return f"درجة HEAT {h} أقل من {IDEA_MIN}"
    if it.get("ring") == 5:
        return "في أوسع دايرة (هتجيب جمهور غلط)"
    if names and it.get("bucket") and it["bucket"] not in names and not any(n in it["bucket"] or it["bucket"] in n for n in names):
        return f"برّه مجموعات المواضيع ({it['bucket']})"
    return ""


SCEN_KEYS = ("beats", "slides", "episodes")


def scenario_fix_messages(brand: str, idea: str, fmt: str, scenarios: list[dict]) -> list[dict]:
    checks = "\n".join(f'- "{k}": {t}' for k, t in CHECKS)
    body = json.dumps([{k: v for k, v in s.items() if k != "id"} for s in scenarios], ensure_ascii=False)
    return [{"role": "system", "content": "إنت مراجع ومصلّح سكريبتات فيديو قصير صارم، بتشتغل بفريمويركس الخوارزميات. بترد بنفس لغة ولهجة السكريبت. Return JSON only.\n\n"
             + for_use("script", limit=9000)},
            {"role": "user", "content": f"""البراند:
{brand[:2500]}

الفكرة:
{idea[:1500]}

نوع البوست: {fmt}
السيناريوهات:
{body[:12000]}

لكل سيناريو: قيّمه على البنود دي (من ١٠ لكل بند، وnull لو مايتطبقش على النوع ده):
{checks}
وأي بند أقل من ٨ صلّحه جوه السيناريو نفسه: الموضوع واضح في أول جملة، المكتوب على الشاشة والمعروض والمنطوق نفس المعنى، جمل قفل بعد الهوك، شيل الحشو، «بس…/علشان كده…» بدل «وبعدين»، النتيجة في آخر مشهد وتوفّي بالوعد، ودعوة مطابقة للموضوع.
ممنوع تغيّر عدد المشاهد/السلايدات/الحلقات ولا ترتيب تسلسل القالب ولا شكل الـ JSON، وممنوع تخترع أرقام أو نتايج.
رجّع JSON بالشكل ده بس:
{{"scenarios": [{{"score": الدرجة من ١٠٠ بعد التصليح, "checks": [{{"key": "hook", "score": 9}}], "fixes": ["اللي اتصلّح في جملة"], "scenario": {{...نفس السيناريو كامل بنفس المفاتيح بعد التصليح...}}}}]}}
بنفس ترتيب السيناريوهات وعددها."""}]


def apply_scenario_fixes(items: list[dict], raw: dict) -> list[dict]:
    """بيركّب التصليح على السيناريوهات لو الشكل سليم، ولو لأ بيسيب الأصل."""
    names = dict(CHECKS)
    out = []
    fixed = raw.get("scenarios") if isinstance(raw, dict) else None
    for i, s in enumerate(items):
        f = fixed[i] if isinstance(fixed, list) and i < len(fixed) and isinstance(fixed[i], dict) else {}
        sc = f.get("scenario") if isinstance(f.get("scenario"), dict) else None
        key = next((k for k in SCEN_KEYS if isinstance(s.get(k), list)), None)
        ok = sc and (not key or (isinstance(sc.get(key), list) and len(sc[key]) == len(s[key])))
        new = {**s, **{k: v for k, v in sc.items() if k != "id"}} if ok else dict(s)
        try:
            score = max(0, min(100, round(float(f.get("score")))))
        except (TypeError, ValueError):
            score = None
        checks = [{"key": c["key"], "title": names[c["key"]], "score": c.get("score")} for c in (f.get("checks") or [])
                  if isinstance(c, dict) and c.get("key") in names]
        new["algo"] = {"score": score, "fixes": [str(x)[:200] for x in (f.get("fixes") or []) if str(x).strip()][:6] if ok else [],
                       "checks": checks, "applied": bool(ok)}
        out.append(new)
    return out


# قواعد برومبت توليد الفيديو (playbook: aivideo) — مختصرة علشان تتحط جنب تعليمات كل موديل من غير ما تعارضها
AIVIDEO_RULE = ("⚡ قواعد برومبت الفيديو (من العقل العام):\n"
                "- كل شخصية وكل منتج يتوصفوا بنفس الجملة بالظبط في كل برومبت (انسخها حرفيًا: نفس اللبس والألوان والملامح)، والمتغير بس المكان والفعل والكاميرا.\n"
                "- أقل كلمات توصّل الصورة: الشخص + المكان + الفعل + التفاصيل المهمة بس (+ الكلام ونبرته لو بيتكلم). الوصف الزيادة بيلخبط الموديل ويقلل الجودة.\n"
                "- اللقطة الواحدة فعل واحد واضح، مش كذا حدث ورا بعض.\n"
                "- أول لقطة فيها حركة أو تباين أو حاجة غير متوقعة من أول ثانية (الهوك المعروض).\n"
                "- من غير أي كلام مكتوب جوه الصورة: الكلام على الشاشة بيتحط في المونتاج.")


# ---------------------------------------------------------------- ✂️ السكتات والحشو (بتتعلّم بالأحمر والعميل يراجع قبل الحذف)
SILENCE_MIN = 0.45    # السكوت اللي أطول من كده بيتعلّم
SILENCE_PAD = 0.12    # بنسيب نَفَس صغير قبل وبعد الكلام علشان القطع مايبانش
FILLERS = {"امم", "اممم", "ممم", "مم", "إمم", "ااه", "آآ", "اا", "ااا", "إيييه", "um", "umm", "uh", "uhh", "hmm", "erm", "ah"}


def silence_marks(quiet: list[tuple[float, float]], a: float, b: float, first: bool, last: bool) -> list[dict]:
    """السكتات جوه قطعة [a, b] من الفيديو الأصلي. السكوت في أول أول قطعة وآخر آخر قطعة بيتشال كله (القفل بعد النتيجة)."""
    out = []
    for s, e in quiet:
        s, e = max(s, a), min(e, b)
        if e - s < SILENCE_MIN:
            continue
        head, tail = s <= a + 0.05, e >= b - 0.05
        cs = s if (head and first) else s + SILENCE_PAD
        ce = e if (tail and last) else e - SILENCE_PAD
        if ce - cs >= 0.25:
            out.append({"a": round(cs, 2), "b": round(ce, 2), "kind": "end" if tail and last else "start" if head and first else "silence"})
    return out


def filler_marks(words: list[dict], base: float) -> list[dict]:
    """الحشو (أمم/آه) والكلمة اللي اتكررت ورا بعضها. الأوقات بالنسبة للفيديو الأصلي."""
    norm = lambda w: "".join(ch for ch in str(w).lower() if ch.isalnum())
    out = []
    for i, w in enumerate(words):
        t = norm(w.get("w"))
        if not t:
            continue
        if t in FILLERS or (len(t) >= 2 and len(set(t)) == 1):
            out.append({"a": round(base + w["s"], 2), "b": round(base + w["e"], 2), "kind": "filler", "text": str(w.get("w"))[:20]})
        elif i + 1 < len(words) and norm(words[i + 1].get("w")) == t and len(t) > 1:
            out.append({"a": round(base + w["s"], 2), "b": round(base + words[i + 1]["s"], 2), "kind": "repeat", "text": str(w.get("w"))[:20]})
    return out


def hook_text_messages(context: str) -> list[dict]:
    return [{"role": "system", "content": "إنت بتكتب الهوك المكتوب على الشاشة لفيديو قصير. Return JSON only.\n\n" + playbook.pack("hook", 4000)},
            {"role": "user", "content": f"""الفيديو ده:
{context[:2000]}

اكتب الكلام اللي يتحط على الشاشة في أول ٣ ثواني: نفس معنى أول جملة بتتقال، ٣–٨ كلمات، سطرين بالكتير (افصل بينهم بـ \\n عند عبارة طبيعية)، من غير علامات ترقيم ولا كلمات ربط، بنفس لغة ولهجة الكلام.
رجّع {{"text": "..."}}"""}]


# ---------------------------------------------------------------- ⚡ النشر: كابشن جاهز بالقواعد + علامة AI + الدفعة الأوتوماتيك

AI_LABEL = "🤖 الفيديو معمول بالذكاء الصناعي"
BAD_TAGS = {"fyp", "foryou", "foryoupage", "viral", "explore", "explorepage", "trending", "اكسبلور", "إكسبلور", "ترند", "فيرال"}
BATCH_EVERY = 10   # كل كام بوست منشور الدفعة بتتحلل لوحدها


def post_caption_messages(context: str, strategy: str, platform: str) -> list[dict]:
    return [{"role": "system", "content": "إنت بتكتب كابشن فيديو قصير بقواعد الخوارزميات. Return JSON only.\n\n" + playbook.pack("caption", 3000)},
            {"role": "user", "content": f"""{strategy or 'مفيش خطة محتوى لسه.'}

الفيديو (المنصة: {platform or 'تيك توك وريلز'}):
{context[:2500]}

اكتب:
- "first": أول سطر هوك تاني (٥–١٢ كلمة) بيكمّل فضول الفيديو، مش تكرار للهوك اللي على الشاشة، ومن غير «أهلًا» أو تحية.
- "body": سطر أو اتنين قيمة من الفيديو بنفس اللهجة (من غير حشو).
- "cta": دعوة واحدة مطابقة للفيديو؛ لو الخطة فيها كلمة كومنت استخدمها بالظبط («علّق بكلمة …» وهتاخد الهدية).
- "tags": ٣–٥ هاشتاجات للمجال نفسه بس (من غير #fyp #viral #explore ولا هاشتاجات عامة).
رجّع {{"first": "", "body": "", "cta": "", "tags": ["#..."]}}"""}]


def clean_tags(raw) -> list[str]:
    out = []
    for t in raw if isinstance(raw, list) else str(raw or "").split():
        t = "#" + str(t).strip().lstrip("#").replace(" ", "_")[:40]
        if len(t) > 2 and t[1:].lower() not in BAD_TAGS and t not in out:
            out.append(t)
    return out[:5]


def funnel_cta(brain: dict | None) -> str:
    fn = ((brain or {}).get("strategy") or {}).get("funnel") or {}
    if not fn.get("keyword"):
        return ""
    return f"علّق بكلمة «{fn['keyword']}»" + (f" وهبعتلك {fn['magnet']}" if fn.get("magnet") else "")


def assemble_caption(raw: dict, brain: dict | None, ai: bool) -> str:
    raw = raw if isinstance(raw, dict) else {}
    s = lambda k: str(raw.get(k) or "").strip()
    cta = s("cta")
    fc = funnel_cta(brain)
    if fc and (((brain or {}).get("strategy") or {}).get("funnel") or {}).get("keyword", "") not in cta:
        cta = fc   # كلمة الكومنت بتاعة الخطة دايمًا هي الدعوة (علشان ManyChat يرد)
    parts = [s("first"), s("body"), cta, " ".join(clean_tags(raw.get("tags")))]
    if ai:
        parts.append(AI_LABEL)
    return "\n\n".join(p for p in parts if p)[:2200]


def mock_post_caption(context: str) -> dict:
    return {"first": "أغلب الناس بتعمل الغلطة دي من غير ما تاخد بالها 👇", "body": (context.split("\n")[0] or "الفيديو ده هيوفّر عليك وقت")[:120],
            "cta": "احفظ الفيديو علشان ترجعله", "tags": ["#تسويق", "#محتوى", "#fyp", "#براند"]}
