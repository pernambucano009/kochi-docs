"""📡 العقل العام: كيف خوارزميات السوشيال تشتغل، وماذا الذي يخلّي الفيديو يتوزّع ويبيع.

معرفة ثابتة لكل العملاء (غير عقل علامة): كل أداة تأخذ منها الجزء الذي يخصها فقط، لكي الوصف يظل قصير.
مقطّرة من: كورس The TikTok & Reels Creator Course (One Peak Creative)، ونشرة وقناة يوتيوب Kallaway.
الأرقام الذي في المصادر دعاية للكورسات، فهنا المبادئ فقط. الخوارزميات تتغير: حدّث هذا الملف، الأدوات تأخذ منه تلقائيًا.
"""
from __future__ import annotations

import json
import dialect

import playbook

UPDATED = "2026-10-17"

# كل جزء: (العنوان، القواعد). مكتوبة قصيرة ومباشرة لأنها بتتحط جوه برومبتات الموديل
PARTS: dict[str, tuple[str, list[str]]] = {
    "core": ("كيف الخوارزمية توزّع", [
        "المقياس أولًا في كل المنصات = وقت المشاهدة (watch time) ونسبة التي كمّلوا الفيديو. اللايك أقل أهمية بكتير.",
        "الفيديو يتجرّب أولًا على عيّنة صغيرة (نحو ٢٠٠–٥٠٠ شخص) من المهتمين بالموضوع؛ إذا فضلوا يتفرجون يكبر للي بعدها (آلاف ← عشرات الآلاف ← ملايين). كل اللعبة أن العيّنة الأولى تحبه.",
        "الخوارزمية تفهم الفيديو من النص المنطوق والنص المكتوب والتعليق النصي والصورة، وتوصّله للناس المهتمة هذا بالموضوع. الهاشتاجات تأثيرها ضعيف.",
        "الثبات على مجال واحد: إذا المتابعين جم لكي موضوع وأنت نزلت موضوع آخر، العيّنة الأولى لن تشاهد والفيديو يقع. السؤال قبل أي منشور: «ما تابعوني سيحبون هذا؟»",
        "بعد الفرجة: التعليقات والمشاركة والحفظ أقوى إشارات. الحفظ = قيمة يرجعلها؛ المشاركة = توزيع مجانًا لناس جديدة.",
        "لا يوجد ساعة سحرية للنشر ولا إعدادات سرية: الثبات وجودة الفكرة أهم من الوقت والهاشتاج.",
        "الجودة أعلى الكمية بعد ما تتعلّم: المنشور الضعيف يُفسد ثقة الجمهور في الحساب. في البداية كتّر وجرّب، وعندما تجد شكل يكسب كرّره بجودة أعلى.",
        "ماتعملش Boost (ترويج مدفوع) لمشاهدات أو متابعين: يجلب أشخاص غير مهتمة فتُفسد العيّنة الأولى للفيديوهات القادمة.",
    ]),
    "idea": ("الفكرة (أهم من الخطاف)", [
        "الفكرة = موضوع يهم الجمهور فعلًا + زاوية/رأي جديد غير بديهي + معلومة أو قيمة يستطيع يطبّقها. خطاف قوي على فكرة ضعيفة = فشل.",
        "خذ المواضيع من الداتا (ما نجح لديك أو عند المنافسين بمضاعف عالي ×٥ فأكثر من متوسطهم)، والرأي والزاوية من جهازك. ماتنسخش حرفيًا: ثبّت الذي نجح وغيّر عنصر أو اثنان وحسّنهم.",
        "وهم الجِدّة: أي موضوع قديم يظهر جديد بكشف زاوية جديدة + ربطها نتيجة الجمهور تريدها + مقارنتها بالمعتقد القديم («قالولك كذا… الحقيقة كذا»).",
        "يجب تصبح relatable: موقف أو رأي الجمهور عايشه أو يختلف عليه، هذا ما يولّد تعليقات ومشاركة.",
        "قابلة للتكرار: أحسن فكرة = شكل (format) يمكنك تعيده بتغيير عنصر واحد كل مرة.",
        "ابعد عن الترند إلا إذا لديك زاوية مختلفة تمامًا أو أنت من أول الأشخاص فيه؛ ما يقلّد الترند متأخر مابيستفيدش.",
        "الأشكال الذي تنجح بثبات: تحدّي فيه رهان (stakes)، تعليمي بفجوة معرفة، قبل وبعد (تحوّل)، تجربة مع أشخاص، موقف تمثيلي (سكتش)، رد على تعليق، مقارنة هذا ولا هذا، ترتيب/قائمة.",
    ]),
    "hook": ("الخطاف (أول ٣ ثواني)", [
        "الخطاف يجب يجاوب في أول جملة: الفيديو عن ماذا؟ وهكسب ماذا إذا كمّلت؟ — بكلام واضح جدًا (لغة طفل ١٢ سنة)، أقل كلمات ممكنة، وتفسير واحد فقط.",
        "الفضول = تناقض بين ما الجمهور فاكره والحقيقة الجديدة؛ كل ما الفجوة أوسع الخطاف أقوى. روافعه: رهان (شيء على المحك)، فجوة معرفة، وعد برد فعل، فكرة غريبة/مضحكة.",
        "٣ خطافات يجب يقولون نفس المعنى بالضبط: النص المكتوب على الشاشة (الأهم، لأن أغلب الأشخاص تشاهد بدون صوت) + ما يُرى + ما يُقال. أي تضارب = ثانية شك = سكرول.",
        "النص المكتوب في أول الفيديو: من ٣ لـ ١٠ كلمات، سطرين بالكتير، بدون علامات ترقيم وكلمات ربط، يظل على الشاشة نحو ٣ ثواني.",
        "أول فريم يجب يكون فيه حركة أو تباين أو شيء غير متوقعة، ومكان جميل أحسن من أوضة ضلمة. الوجه البشري أكثر شيء توقف الأشخاص.",
        "اختبار الصوت المقفول: إذا شغّلت أول ٥ ثواني بدون صوت، حد غريب سيفهم الفيديو عن ماذا؟",
        "أول ٢–٤ جمل بعد الخطاف (منطقة القفل) هي ما تمسك المشاهد: أكّد وعد الخطاف فخلف (بدون خداع) وحط دليل بدري: نتيجة، رقم حقيقي، تجربة. أو لمّح للتحوّل، أو سمّي فكرة ستشرحها، أو رد على الاعتراض أولًا.",
        "ممنوع الهوكات المبهمة زي «هتتصدم» أو «استنى للآخر» من غير ما تقول عن إيه.",
    ]),
    "story": ("النص والحكي", [
        "ابدأ بالمهم: ماذا الذي يحدث وليه يهمك أولًا، ثم من وكيف، والمكان والزمان آخر شيء. ابدأ بطاقة عالية غير من الصفر.",
        "اربط الجمل بـ «فقط…» و«لذلك…» غير «ثم…»: صراع يفتح سؤال، وسياق يقفله.",
        "النتيجة/المفاجأة (payoff) في آخر الفيديو غير في النص؛ وعندما تأتي أغلق بعدها بثواني. ويجب توفّي بوعد الخطاف.",
        "لوب الإدمان: رهان ← سؤال كبير يستطيع يخمّن إجابته ← مفاجأة منطقية تكسر توقعه ← وأنت تقفل سؤال افتح سؤال جديد فخلف («فقط هنا المشكلة…»، «ودي اللحظة التي عرفت فيها…»).",
        "أزل أي ثانية لا تضحّك أو تفيد أو تقرّب للنتيجة: أه وأمم والصمت والتكرار. الطول = أقصر شيء توصل للنتيجة؛ قوة الخطاف هي ما تبرر الطول.",
        "نوّع طول الجمل، واتكلم كأنك تكلم صاحب واحد غير جمهور. اكتب أول جملة وآخر جملة أولًا؛ آخر جملة تستاهل المشاركة، وفي الريلز يمكن توصل لأول جملة (لوب).",
        "الفكرة الأساسية تتلخص في جملة واحدة الأشخاص يمكنك تقولها لصاحبهم.",
        "فيه بطل الجمهور يشجعه (يمكن العميل نفسه)، و«خصم» أو طريقة قديمة نقارن بها.",
    ]),
    "edit": ("المونتاج والشكل", [
        "الفيديو يجب يشد حتى والصوت مغلق: غيّر الزاوية أو اللقطة كل كم ثانية، وقرّب على الوجه (punch-in)، وحط لقطات توضيحية (B-roll) أعلى النص.",
        "ترجمة للكلام دائمًا، ٢–٣ كلمات على الشاشة في المرة، في نص الشاشة أو فوقه قليلًا (غير أسفل تمامًا لكي لا يُغطّى بالكابشن والأزرار).",
        "الموسيقى تناسب الإحساس أهم من أنها ترند، وتصبح واطية أسفل الصوت (نحو ٣–٦٪) لكي ماتغطيش على الخطاف.",
        "الصوت يجب يصبح نضيف وواضح؛ الصورة العادية من الجوال كفاية.",
        "الانتقالات: اجعل النص مستمر وأنت تنتقل، وحط صوت «ووش» خفيف يربط اللقطتين.",
        "المحتوى الذي بدون وجه يحتاج عمل أكثر على الصورة: أسلوب بصري ثابت يتعرف مثل التوقيع، وشكل متكرر.",
    ]),
    "engage": ("التعليقات والمشاركة والحفظ", [
        "تعليقات: شيء غير متوقعة، أو موضوع الأشخاص تختلف عليه (خليك في النص ماتاخدش صف)، أو موقف relatable. رد على أول ٣٠ تعليق وافتح نقاش.",
        "مشاركة: لحظة «يجب ترى هذا»: معلومة مفيدة جدًا، أو شيء مضحكة، أو مؤثرة.",
        "حفظ: خطوات، قائمة نصايح، شرح عملي يرجعله؛ هذا يطوّل عمر الفيديو.",
    ]),
    "convert": ("تحويل المشاهدات لعملاء", [
        "حدّد اللعبة: شهرة عامة (مال إعلانات) غير بناء ثقة وبيع (خدمات/كوتشينج/منتج). للبيع: المشاهدة من الشخص الصحيح أهم من مليون مشاهدة خطأ.",
        "الثقة = دقايق مشاهدة × أن النص يخصه × أنه مفيد. اتكلم لشخص واحد محدد بمشكلة محددة.",
        "الدماغ يصنف الفيديو: حل محتمل لمشكلتي، ولا تسلية، ولا لا يخصني. لكي يصبح «حل»: سمّي الألم أو النتيجة بالضبط في أول جملتين.",
        "الدليل يبني الثقة، وأقواه بالترتيب: توصية من حد يعرفه ← جمهور كبير حقيقي ← أنك تبيّن مهارتك داخل الفيديو نفسه ← نتائج عملاء بأسمائهم ← نتيجتك أنت. (بدون أرقام مخترعة أبدًا)",
        "دعوة (CTA) في كل فيديو، طبيعية كأنها خدمة: بعد ما تبيّن الألم، قدّم الخطوة القادمة. أحسنها: «علّق بكلمة كذا وأبعتلك [الدليل/الملف]» ومطابقة لموضوع الفيديو بالضبط.",
        "انقل الأشخاص من المنصة (مستأجرة) لحاجة الخاصة بك: بريد إلكتروني، واتساب، قائمة.",
    ]),
    "caption": ("التعليق النصي والنشر", [
        "التعليق النصي = خطاف آخر، آخر شيء يقرؤها قبل ما يسكرول: يُكمل الفضول ويترك سؤال مفتوح، وبعده الشرح والدعوة. ماتكتبهوش أي نص.",
        "٣–٥ هاشتاجات محددة بالمجال في الآخر، وممنوع #fyp و#viral و#explore (بتوديك لناس مش مهتمة).",
        "صورة الغلاف (cover) فريم مثير + عنوان قصير، اخترها بنفسك.",
        "أنشئ تاج للعلامة أو الأشخاص الذين في الفيديو، ومكان إذا البزنس محلي. في إنستجرام: منشور Collab يظهر عند الاتنين.",
        "إن كان الفيديو مصنوعًا بالذكاء الاصطناعي فعلّم عليه بذلك (لا عقوبة، وقد تحذفه المنصة إن لم تحدد).",
    ]),
    "analyze": ("تحليل الذي نجح", [
        "قيس كل فيديو بمضاعف متوسط حسابه (مشاهداته ÷ المتوسط)، غير بالأرقام المجردة: ×٥ فأكثر = الفكرة نجحت.",
        "حلّل بالدفعة (كل ١٠ فيديوهات) غير فيديو فيديو: ماذا الذي الفايزين عملوه ومش موجود في الخاسرين؟ وجرّب تحسين واحد فقط في الدفعة القادمة.",
        "فيديو ×٥–١٠: أنشئ ٣ زيه بتعديل بسيط. فيديو ×١٠ فأكثر: كرّر نفس الموضوع ونفس الشكل في ٣ فيديوهات. الهدف ٢–٣ تركيبات (موضوع + شكل) تكسب.",
        "الترتيب في الأهمية: عملاء/تسجيلات لكل فيديو ← متابعين لكل فيديو ← مشاهدات.",
        "إذا الفيديو فشل: الموضوع يهم؟ الزاوية جديدة؟ الخطاف قوي وواضح؟ فيه لحظات مملة؟ النتيجة في الآخر؟ relatable؟",
    ]),
}

# الفرق بين المنصات (اللي اتقال في المصادر بس)
PLATFORMS = {
    "tiktok": "تيك توك: يمكن حساب جديد يوصل ملايين من أول فيديو في يوم؛ مهم للمنتجات الاستهلاكية ولبناء الوعي، وأضعف في تحويل الخدمات.",
    "instagram": "إنستجرام: أبطأ في الثقة بحساب جديد (يحتاج كذا منشور)؛ أقوى منصة للتحويل بالكومنت والرسائل (ManyChat)؛ فيه Collab وتسوق داخل الفيديو.",
    "youtube": "يوتيوب شورتس: جمهور أصغر سنًا ومحتوى ترفيهي؛ والفيديو الطويل على يوتيوب أقوى شيء للثقة والمبيعات.",
    "linkedin": "لينكدإن: جمهور أكبر سنًا ومهني وقيمته أعلى، فقط متأخر عن الترندات والفيديو فيه أحدث.",
    "facebook": "فيسبوك: نفس منطق الريلز، ويسير مع إنستجرام حسب سن الجمهور.",
}

def rule(*parts: str, platform: str = "") -> str:
    """القواعد المختصرة (عندما الوصف يحتاج تذكير سريع فقط)."""
    blocks = []
    for p in parts:
        if p in PARTS:
            title, items = PARTS[p]
            blocks.append(f"[{title}]\n" + "\n".join(f"- {x}" for x in items))
    if platform in PLATFORMS:
        blocks.append("[المنصة]\n- " + PLATFORMS[platform])
    if not blocks:
        return ""
    return "📡 قواعد الخوارزميات (العقل العام للبرنامج، طبّقها بدون ما تذكرها بالاسم):\n" + "\n\n".join(blocks)


def for_use(use: str, platform: str = "", limit: int = 14000) -> str:
    """الفريمويركس الكاملة التي تخص هذه الأداة من مكتبة playbook (غير ملخّص)."""
    body = playbook.pack(use, limit)
    if platform in PLATFORMS:
        body += "\n\n[المنصة]\n- " + PLATFORMS[platform]
    if not body:
        return ""
    return ("📚 العقل العام: فريمويركس المحتوى والخوارزميات. اشتغل بها فعلًا في كل ما تكتبه (طبّق الخطوات، "
            "غير تذكرها بالاسم ولا تشرحها للعميل)، وقواعد العلامة لها الأولوية إذا حصل تعارض:\n\n" + body)


def public() -> dict:
    """للعرض في البرنامج: العميل يرى كل الفريمويركس الذي الأدوات ماشية عليها."""
    return {"updated": UPDATED, "parts": [{"key": f["id"], "title": f["title"], "items": f["steps"]} for f in playbook.public()],
            "platforms": PLATFORMS}


# ---------------------------------------------------------------- 🔎 فحص قبل النشر

KINDS = {"script": "نص فيديو قصير", "caption": "تعليق نصي منشور", "idea": "فكرة فيديو", "hook": "خطاف"}

CHECKS = [
    ("topic", "الموضوع يهم المشاهد المثالي ومن مجال الحساب"),
    ("seed", "الزاوية أو الرأي جديد ومش بديهي"),
    ("format", "الشكل (format) أنسب طريقة للفكرة"),
    ("hook", "الخطاف: موضوع واضح + سبب يُكمل + مختصر + تفسير واحد"),
    ("align", "المكتوب والمعروض والمنطوق يقولون نفس المعنى"),
    ("soundoff", "يتفهم بدون صوت في أول ٥ ثواني"),
    ("lockin", "أول جمل بعد الخطاف تأكد الوعد وفيها دليل بدري"),
    ("lulls", "لا يوجد حشو أو لحظات مملة"),
    ("loops", "أسئلة تُفتح وتُغلق (فقط… لذلك…) وفيه مفاجأة منطقية"),
    ("payoff", "النتيجة في الآخر وتوفي بوعد الخطاف"),
    ("relatable", "relatable ويولّد تعليقات أو مشاركة"),
    ("save", "فيه قيمة تُحفظ (خطوات، قائمة، شرح)"),
    ("trust", "فيه دليل حقيقي يبني ثقة"),
    ("cta", "دعوة واضحة مطابقة لموضوع الفيديو"),
    ("repeat", "شكل ينفع يتكرر بتغيير عنصر"),
]


def review_messages(text: str, kind: str, platform: str, brand: str, goal: str = "") -> list[dict]:
    checks = "\n".join(f'- "{k}": {t}' for k, t in CHECKS)
    return [{"role": "system", "content": "أنت مراجع محتوى سوشيال صريح وعملي، تقيّم قبل النشر بقواعد الخوارزميات. " + dialect.ANALYSIS + ". Return JSON only.\n\n"
             + for_use("review", platform)},
            {"role": "user", "content": f"""{('العلامة:' + chr(10) + brand[:3000] + chr(10) * 2) if brand else ''}{('هدف المحتوى: ' + goal + chr(10)) if goal else ''}قيّم {KINDS.get(kind, 'المحتوى')} هذا قبل النشر:
«««
{text[:6000]}
»»»

لكل بند من هؤلاء ادّي درجة من ١٠ وسبب في جملة واحدة وتعديل محدد إذا الدرجة أقل من ٨ (إذا البند مايتطبقش على هذا النوع اجعل score = null):
{checks}

استعد JSON هذا بالشكل فقط:
{{"score": الدرجة الكلية من ١٠٠,
  "verdict": "جملة: ينفع ينزل ولا يحتاج تعديل وليه",
  "checks": [{{"key": "hook", "score": 7, "why": "", "fix": ""}}],
  "top_fixes": ["أهم ٣ تعديلات بالترتيب"],
  "hooks": ["٣ خطافات أحسن بنفس المعنى ولغة المحتوى"],
  "caption": "تعليق نصي مقترح (خطاف آخر + الدعوة + ٣–٥ هاشتاجات من المجال)"}}
ماتخترعش أرقام أو نتائج عن العلامة."""}]


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
    return clean_review({"score": 64, "verdict": "الفكرة كويسة فقط الخطاف يحتاج يصبح أوضح والنتيجة تتأخر للآخر",
                         "checks": [{"key": k, "score": 5 + i % 5, "why": "تجريبي", "fix": "تعديل تجريبي" if 5 + i % 5 < 8 else ""} for i, (k, _) in enumerate(CHECKS)],
                         "top_fixes": ["قل الموضوع في أول جملة", "أخّر النتيجة لآخر ٥ ثواني", "أضف دعوة بكلمة في التعليق"],
                         "hooks": ["أغلب الأشخاص تعمل هكذا خطأ", "قالولك كذا… الحقيقة كذا", "إذا أنت كذا، هذا الفيديو لك"],
                         "caption": "مكنتش متوقع هذه النتيجة 👀\n\nعلّق بكلمة «دليل» وأبعتلك الخطوات\n#مجالك #نصايح"})


# ---------------------------------------------------------------- 🧭 خطة المحتوى للبراند (فريمويركس الاستراتيجية مطبّقة على العميل)

GAMES = {"mainstream": "شهرة عامة", "category": "شهرة في الفئة", "intuitive": "منتج بديهي (يتباع بالإحساس)",
         "explanatory": "منتج يحتاج شرح", "authority": "بناء ثقة وخبرة (خدمات/كوتشينج)"}
AXES = {"topic": "الموضوع", "substance": "العمق", "avatar": "الجمهور", "format": "الشكل", "visual": "الصورة"}
DAYS = ["السبت", "الأحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة"]


def strategy_messages(brand: str, rivals_txt: str, notes: str = "") -> list[dict]:
    games = " · ".join(f"{k} = {v}" for k, v in GAMES.items())
    axes = "، ".join(f"{k} ({v})" for k, v in AXES.items())
    return [{"role": "system", "content": "أنت استراتيجي محتوى سوشيال شاطر، تطبّق هذه الفريمويركس بالحرف على علامة حقيقي. " + dialect.MIXED + ". Return JSON only.\n\n"
             + for_use("strategy", limit=16000)},
            {"role": "user", "content": f"""العلامة:
{brand[:5000] or '(بيانات قليلة)'}

{rivals_txt[:2500] if rivals_txt else '(لا يوجد بعد داتا منافسين)'}
{('ملاحظات العميل: ' + notes) if notes else ''}

اعمل خطة محتوى كاملة للبراند ده مبنية على الفريمويركس، كلها مخصوصة ليه (ممنوع كلام عام ينفع لأي براند، وممنوع أرقام أو نتايج مخترعة):
استعد JSON هذا بالشكل فقط:
{{"game": {{"key": "واحد من: {games}", "why": "له هذه لعبته في جملتين"}},
  "statement": "أنا بساعد [من بالضبط] يوصل لـ[نتيجة] عن طريق [طريقة]",
  "avatar": "الشخص الواحد الذي نكلمه: سنه، موقفه، ألمه الأساسي، يحلم بإيه",
  "rings": ["٥ دوائر الجمهور من المركز الأضيق للأعرض"],
  "buckets": [{{"name": "مجموعة مواضيع", "ring": رقم الدائرة 1-5, "why": "له تهم الجمهور (من داتا المنافسين إذا موجودة)", "topics": ["٣ مواضيع محددة من ٣–٥ كلمات"]}}],
  "formats": [{{"name": "شكل (format)", "why": "له يناسب العلامة"}}],
  "formulas": [{{"topic": "مجموعة", "format": "شكل", "visual": "طريقة العرض البصري"}}],
  "week": [{{"day": "السبت", "ring": 1, "bucket": "", "idea": "فكرة الفيديو", "hook": "الخطاف المكتوب على الشاشة", "cta": "الدعوة"}}],
  "takes": ["٥ آراء عكس السائد في المجال العلامة يستطيع يدافع عنها"],
  "words": ["٢–٣ كلمات أو عبارات تريدون الأشخاص تربط العلامة بها"],
  "signature": "شيء شكلية ثابتة تميّز فيديوهات العلامة",
  "white_space": {{{', '.join(f'"{k}": "الفراغ في {v} ما المنافسين غير مغطيينه"' for k, v in AXES.items())}}},
  "funnel": {{"keyword": "كلمة التعليق", "magnet": "الهدية المجانية المطابقة للمواضيع (ملف/دليل…)", "offer": "كيف توصل للعرض المدفوع"}},
  "cadence": "كم فيديو في الأسبوع والآن في أي مرحلة (تجريب ولا تكرار) وماذا الذي يتقاس",
  "platform": "منصة البيت المقترحة وليه",
  "profile": {{"bio": "سيرة مقترح ~٨٠ حرف", "pinned": "الفيديو الذي يتثبّت"}},
  "avoid": ["٣–٥ أشياء العلامة يبعد عنها"]}}
أعداد: buckets ٣–٤، formats ٢–٣، formulas ٤–٦، week ٧ أيام بالضبط بخلطة ٣-٢-١ (٤ في الدايرتين ١–٢، ١ في الدائرة ٤، ١ تجريبي، ١ تكرار لأحسن تركيبة)."""}]


# 🧭 خطة المحتوى بتتبني لوحدها من كل اللي العقل عرفه: كل خانة، كل إجابة، كل معلومة، كل موسم، كل لايك وديسلايك، كل تحليل.
# العدّاد = عدد المعلومات دي، وكل ما يزيد كفاية (أو حاجة أساسية تتغير) الخطة بتتعمل من جديد لوحدها.
PLAN_FIELDS = (("domain", "المجال"), ("about", "عن البراند"), ("audience", "الجمهور"), ("market", "السوق"), ("language", "اللغة واللهجة"),
               ("niche", "النيتش"), ("type", "نوع المنتج"), ("cta", "الدعوة (CTA)"), ("link", "الرابط"), ("caption", "التعليق النصي الافتراضي"), ("rules", "القواعد"))
PLAN_KEY = ("domain", "about", "audience", "market", "type", "cta")   # لو واحدة منهم اتغيرت الخطة بتتعمل من جديد على طول
PLAN_STEP = 3          # أو لما يتجمع ٣ معلومات جديدة
PLAN_MIN = 8           # أقل عدد معلومات تتعمل بيه أول خطة (ولازم المجال أو «عن البراند»، ودرجة فهم العقل PLAN_SCORE في app.py)


def plan_inputs(b: dict) -> list[tuple[str, str]]:
    """(النوع، المعلومة) لكل شيء الخطة تُبنى عليها."""
    out = [("field", t) for k, t in PLAN_FIELDS if str(b.get(k) or "").strip()]
    out += [("quiz", q) for q in b.get("quiz_done") or []]
    out += [("note", n.get("title") or "") for n in b.get("notes") or [] if n.get("quiz") != "seasons_ai"]
    out += [("season", i.get("name") or "") for i in ((b.get("seasons") or {}).get("items") or [])[:40]]
    out += [("pref", (p.get("text") or "")[:40]) for p in (b.get("prefs") or [])[-60:]]
    comp = b.get("competitors") or {}
    out += [("rival", i.get("handle") or "") for i in comp.get("items") or []]
    if comp.get("digest"):
        out.append(("rivals_digest", "ما ينجح عند المنافسين"))
    out += [("todo", t.get("title") or "") for t in b.get("todos") or []]
    bt = b.get("batch") or {}
    out += [("batch", h.get("hypothesis") or "") for h in bt.get("history") or []]
    if bt.get("analysis"):
        out.append(("batch", "تحليل آخر ١٠ فيديوهات"))
    out += [("trend", t.get("title") or "") for t in ((b.get("trends") or {}).get("items") or []) if t.get("saved")]
    return out


PLAN_KINDS = {"field": "خانات الهوية والتسليم", "quiz": "إجابات الكويز", "note": "معلومات المعرفة", "season": "مواسم ومناسبات", "pref": "لايكات وديسلايكات على الأفكار والنصوص",
              "rival": "منافسين", "rivals_digest": "تحليل المنافسين", "todo": "تحليل حسابك على السوشيال", "batch": "تحليل فيديوهاتك", "trend": "ترندات محفوظة"}


def plan_key_sig(b: dict) -> str:
    return "|".join(str(b.get(k) or "")[:300] for k in PLAN_KEY)


def plan_goal(b: dict) -> str:
    """الهدف يتستنتج من العقل نفسه (الدعوة، الرابط، العروض، المنتجات، نوع المنتج) غير من العميل."""
    notes = {n.get("section"): n for n in b.get("notes") or []}
    bits = [f"الدعوة التي في آخر الفيديوهات: {b['cta']}" if b.get("cta") else "", f"الرابط: {b['link']}" if b.get("link") else "",
            f"العرض: {(notes.get('offers') or {}).get('body', '')[:300]}" if notes.get("offers") else "",
            f"المنتجات والخدمات: {(notes.get('products') or {}).get('body', '')[:400]}" if notes.get("products") else ""]
    bits = [x for x in bits if x]
    return ("استنتج هدف العلامة (بيع ولا شهرة ولا حجز ولا تحميل…) من هذه المعلومات ومن ملف العلامة، ماتسألش العميل:\n" + "\n".join(bits)) if bits else \
        "استنتج هدف العلامة من ملفه (نوع المنتج، المجال، ما يقدمه)، ماتسألش العميل."


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
    """الخطة التي العميل عملها تدخل في كل وصف محتوى (مختصرة)."""
    st = (brain or {}).get("strategy") or {}
    if not st.get("statement") and not st.get("buckets"):
        return ""
    lines = ["خطة المحتوى المعتمدة للعلامة (امشي عليها: نفس الجمهور والمواضيع والآراء، وماتخرجش خارج المجال):"]
    if st.get("statement"):
        lines.append(f"- التموضع: {st['statement']}")
    if st.get("game", {}).get("key"):
        lines.append(f"- لعبة المحتوى: {GAMES.get(st['game']['key'], '')}")
    if st.get("avatar"):
        lines.append(f"- الشخص الذي نكلمه: {st['avatar']}")
    if st.get("buckets"):
        lines.append("- مجموعات المواضيع: " + " · ".join(f"{b['name']} ({'، '.join(b['topics'][:3])})" for b in st["buckets"]))
    if st.get("formats"):
        lines.append("- الأشكال الأساسية: " + "، ".join(f["name"] for f in st["formats"]))
    if st.get("takes"):
        lines.append("- آراء العلامة المختلفة: " + " · ".join(st["takes"][:5]))
    if st.get("words"):
        lines.append("- كلمات نتعرف بها (كررها): " + "، ".join(st["words"]))
    fn = st.get("funnel") or {}
    if fn.get("keyword") or fn.get("magnet"):
        lines.append(f"- الدعوة: علّق بكلمة «{fn.get('keyword') or '…'}» ونأخذ {fn.get('magnet') or 'الهدية'}")
    if st.get("avoid"):
        lines.append("- نبعد عن: " + " · ".join(st["avoid"]))
    return "\n".join(lines)[:2200]


def mock_strategy() -> dict:
    return clean_strategy({
        "game": {"key": "authority", "why": "العلامة تبيع خدمة تحتاج إلى ثقة، فالمهم المشاهد المناسب لا عدد المشاهدات"},
        "statement": "أنا بساعد المبتدئين في الجيم يوصلون لأول نتيجة في ٩٠ يوم عن طريق تمارين يتية بسيطة",
        "avatar": "شاب ٢٢–٣٠ سنة، يعمل وماعندوش وقت، جرّب الجيم وتوقف، نفسه يرى نتيجة بدون ما يعيش في الجيم",
        "rings": ["مبتدئين جيم مشغولين", "مبتدئين لياقة", "مهتمين بالصحة", "شباب يهتمون بشكلهم", "أي حد"],
        "buckets": [{"name": "أخطاء المبتدئين", "ring": 1, "why": "أعلى مضاعف لدى المنافسين", "topics": ["غلطة الإحماء", "تمرين البطن الغلط", "الأكل بعد التمرين"]},
                    {"name": "تمارين يتية سريعة", "ring": 2, "why": "تُحفظ كثيرًا", "topics": ["١٠ دقايق الصبح", "بدون أدوات", "قبل النوم"]},
                    {"name": "قصص تحوّل", "ring": 4, "why": "تتشارك", "topics": ["٩٠ يوم", "رجعت بعد سنة", "بدون جيم"]}],
        "formats": [{"name": "غلطة ← التصحيح", "why": "يستوقف من يقعون في الخطأ"}, {"name": "قبل وبعد", "why": "تحوّل واضح"}],
        "formulas": [{"topic": "أخطاء المبتدئين", "format": "غلطة ← التصحيح", "visual": "الكوتش للكاميرا + لقطة الغلط"}],
        "week": [{"day": d, "ring": [1, 2, 1, 2, 4, 3, 1][i], "bucket": "أخطاء المبتدئين", "idea": "فكرة تجريبية", "hook": "أنت تعمل هذا التمرين خطأ", "cta": "علّق «خطة»"} for i, d in enumerate(DAYS)],
        "takes": ["لا يحتاج جيم في أول ٣ شهور", "الكارديو غير أحسن طريقة للتنشيف"], "words": ["٩٠ يوم", "بدون جيم"],
        "signature": "خلفية الأوضة نفسها ولوح أبيض عليه رقم اليوم",
        "white_space": {k: "تجريبي" for k in AXES}, "funnel": {"keyword": "خطة", "magnet": "جدول ٩٠ يوم PDF", "offer": "متابعة شهرية"},
        "cadence": "٣ فيديو في الأسبوع أول شهر (تجريب)، لاحقًا ٥", "platform": "إنستجرام لكي التعليق بكلمة والرسائل",
        "profile": {"bio": "تمارين يتية للمبتدئين · نتيجة في ٩٠ يوم · فيديو يومي", "pinned": "أكبر ٣ أخطاء للمبتدئين"},
        "avoid": ["فيديوهات ترند خارج اللياقة", "وعود بأرقام وزن"]})


# ---------------------------------------------------------------- 📊 تحليل الدفعة: آخر ١٠ فيديوهات + قاعدة ٥× و١٠×

BATCH = 10


def batch_rows(posts: list[dict], metrics: dict | None = None, n: int = BATCH) -> dict:
    """آخر n منشور، وكل منشور بكام ضعف وسيط الدفعة في (العملاء ← المتابعين ← المشاهدات)."""
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


VERDICTS = {"gold": "🥇 دهب: فيديو عمل ١٠ أضعاف أو أكثر. كرّر نفس الموضوع ونفس الشكل بالضبط في ٣ من العشرة الجايين.",
            "win": "🏆 فايز: فيديو بين ٥ و١٠ أضعاف. خذ نفس الموضوع/الشكل وعدّل فيه قليلًا في ٣ من العشرة الجايين.",
            "redo": "🔁 محدش عدّى ٥ أضعاف: الدفعة القادمة من أولًا، وغالبًا فيه غلطة واضحة (الموضوع ولا الخطاف)."}


def batch_messages(brand: str, strategy: str, b: dict) -> list[dict]:
    lines = []
    for i, r in enumerate(b["rows"], 1):
        extra = "".join(f" · {t} {r[k]}" for k, t in (("leads", "عملاء"), ("follows", "متابعين")) if r.get(k) is not None)
        lines.append(f"{i}) ×{r['x'] if r['x'] is not None else '?'} ({r['tier']}) · {r.get('views') or 0} مشاهدة{extra} · "
                     f"تعليق {r.get('comments') or 0} · شير {r.get('shares') or 0}\n   التعليق النصي: {(r.get('caption') or '')[:300]}"
                     + (f"\n   النص: {r['spoken'][:400]}" if r.get("spoken") else ""))
    return [{"role": "system", "content": "أنت محلل محتوى يشتغل بنظام الدفعة (كل ١٠ فيديوهات مع بعض). " + dialect.MIXED + ". Return JSON only.\n\n"
             + for_use("analysis", limit=9000) + "\n\n" + rule("idea", "hook")},
            {"role": "user", "content": f"""العلامة:
{brand[:3000]}
{strategy}

آخر {len(b['rows'])} فيديوهات للعلامة (×المضاعف = قدر ماذا عدّى وسيط الدفعة في أهم مقياس موجود: العملاء ثم المتابعين ثم المشاهدات):
{chr(10).join(lines)}

حكم الدفعة: {VERDICTS[b['verdict']]}

١) شغّل شيك ليست الـ ١١ قطعة (الشكل، الموضوع، البذرة، المحتوى، الخطاف المعروض، الخطاف المكتوب، الخطاف المنطوق، هيكل الحكاية، الدعوة، العرض البصري، العناصر) على الفايزين مقابل الخاسرين: ماذا الذي الفايزين عملوه ومش موجود في الخاسرين؟
٢) طلّع فرضية تحسين واحدة فقط للدفعة القادمة.
٣) خطة الدفعة القادمة حسب الحكم: إذا دهب أو فايز ٣ فيديوهات على نفس التركيبة + ٧ فيديوهات بالفرضية الجديدة؛ إذا لا يوجد فايز ١٠ فيديوهات جديدة تصلّح الغلطة.
استعد JSON هذا بالشكل فقط:
{{"summary": "جملتين: هذه الدفعة تقول ماذا",
  "bricks": [{{"brick": "اسم القطعة", "winners": "ما في الفايزين", "losers": "ما في الخاسرين"}}],
  "pattern": "النمط المشترك في الفايزين",
  "mistake": "أوضح غلطة في الخاسرين",
  "hypothesis": "التحسين الواحد الذي سنجرّبه",
  "formula": {{"topic": "", "format": "", "hook_style": ""}},
  "next": [{{"n": 1, "kind": "repeat أو test", "idea": "", "hook": "الخطاف المكتوب على الشاشة", "based_on": رقم الفيديو أو null}}],
  "stop": ["أشياء نبطّلها"]}}
next = ١٠ فيديوهات بالضبط. ماتخترعش أرقام."""}]


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
    return clean_batch({"summary": "الفيديوهات التي تبدأ بغلطة الجمهور كسبت، واللي تبدأ بالعلامة وقعت.", "pattern": "خطاف «أنت تعمل كذا خطأ» + النتيجة في الآخر",
                        "mistake": "أول ٣ ثواني لا تحتوي الموضوع", "hypothesis": "كل الخطافات تبدأ بالموضوع في أول ٣ كلمات",
                        "formula": {"topic": "أخطاء المبتدئين", "format": "غلطة ← تصحيح", "hook_style": "تقريري"},
                        "bricks": [{"brick": "الخطاف المكتوب", "winners": "موضوع واضح", "losers": "تحية وتعريف"}],
                        "next": [{"kind": "repeat" if i < 3 else "test", "idea": f"فكرة تجريبية {i + 1}", "hook": "أنت تعمل هذا خطأ", "based_on": top if i < 3 else None} for i in range(10)],
                        "stop": ["نبدأ بـ «أهلًا بيكم»"]})


def batch_text(brain: dict | None) -> str:
    """آخر تحليل دفعة يدخل في كتابة الأفكار: نكرّر الفايز ونجرّب الفرضية."""
    a = ((brain or {}).get("batch") or {}).get("analysis") or {}
    if not a.get("hypothesis") and not a.get("pattern"):
        return ""
    f = a.get("formula") or {}
    lines = ["آخر تحليل لفيديوهات العلامة نفسه (اشتغل عليه):"]
    if a.get("pattern"):
        lines.append(f"- ما نجح لدينا: {a['pattern']}")
    if any(f.values()):
        lines.append(f"- التركيبة الفايزة: موضوع «{f.get('topic')}» · شكل «{f.get('format')}» · خطاف {f.get('hook_style')}")
    if a.get("hypothesis"):
        lines.append(f"- التحسين الذين نجرّبه هذه الدفعة: {a['hypothesis']}")
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
            f'"ring": رقم دائرة الجمهور من ١ (الأضيق) لـ ٥ (الأعرض)' + (f" حسب الخطة ({' ← '.join(st.get('rings') or [])})" if st.get("rings") else "") + ",\n"
            f'"bucket": مجموعة المواضيع' + (f" (واحدة من: {buckets})" if buckets else "") + ",\n"
            '"heat": {"h": 0-10 قوة الفضول في الخطاف, "e": 0-10 خالية من الركود, "a": 0-10 فيه نتيجة قوية في الآخر, "t": 0-10 relatable, "r": 0-10 قابلة للتكرار بتغيير عنصر}.\n'
            "قيّم بصراحة (الدرجة العالية يجب تكون مستحقة). ماتقترحش أفكار في الدائرة الخامسة ولا خارج مجموعات المواضيع.")


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
    """سبب رفض الفكرة (فارغ = تعدّي)."""
    st = (brain or {}).get("strategy") or {}
    names = {b["name"] for b in st.get("buckets") or []}
    h = (it.get("heat") or {}).get("avg")
    if h is not None and h < IDEA_MIN:
        return f"درجة HEAT {h} أقل من {IDEA_MIN}"
    if it.get("ring") == 5:
        return "في أوسع دائرة (ستجلب جمهور خطأ)"
    if names and it.get("bucket") and it["bucket"] not in names and not any(n in it["bucket"] or it["bucket"] in n for n in names):
        return f"خارج مجموعات المواضيع ({it['bucket']})"
    return ""


SCEN_KEYS = ("beats", "slides", "episodes")


def scenario_fix_messages(brand: str, idea: str, fmt: str, scenarios: list[dict]) -> list[dict]:
    checks = "\n".join(f'- "{k}": {t}' for k, t in CHECKS)
    body = json.dumps([{k: v for k, v in s.items() if k != "id"} for s in scenarios], ensure_ascii=False)
    return [{"role": "system", "content": "إنت مراجع ومصلّح سكريبتات فيديو قصير صارم، بتشتغل بفريمويركس الخوارزميات. بترد بنفس لغة ولهجة السكريبت. Return JSON only.\n\n"
             + for_use("script", limit=9000)},
            {"role": "user", "content": f"""العلامة:
{brand[:2500]}

الفكرة:
{idea[:1500]}

نوع المنشور: {fmt}
السيناريوهات:
{body[:12000]}

لكل سيناريو: قيّمه على هذه البنود (من ١٠ لكل بند، وnull إذا مايتطبقش على هذا النوع):
{checks}
وأي بند أقل من ٨ صلّحه داخل السيناريو نفسه: الموضوع واضح في أول جملة، المكتوب على الشاشة والمعروض والمنطوق نفس المعنى، جمل قفل بعد الخطاف، أزل الحشو، «فقط…/لذلك…» بدل «ثم»، النتيجة في آخر مشهد وتوفّي بالوعد، ودعوة مطابقة للموضوع.
ممنوع تغيّر عدد المشاهد/السلايدات/الحلقات ولا ترتيب تسلسل القالب ولا شكل الـ JSON، وممنوع تخترع أرقام أو نتايج.
استعد JSON هذا بالشكل فقط:
{{"scenarios": [{{"score": الدرجة من ١٠٠ بعد التصليح, "checks": [{{"key": "hook", "score": 9}}], "fixes": ["ما أُصلح في جملة"], "scenario": {{...نفس السيناريو كامل بنفس المفاتيح بعد التصليح...}}}}]}}
بنفس ترتيب السيناريوهات وعددها."""}]


def apply_scenario_fixes(items: list[dict], raw: dict) -> list[dict]:
    """يركّب التصليح على السيناريوهات إذا الشكل سليم، وإذا لا يترك الأصل."""
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
AIVIDEO_RULE = ("⚡ قواعد وصف الفيديو (من العقل العام):\n"
                "- كل شخصية وكل منتج يتوصفون بنفس الجملة بالضبط في كل وصف (انسخها حرفيًا: نفس اللبس والألوان والملامح)، والمتغير فقط المكان والفعل والكاميرا.\n"
                "- أقل كلمات توصّل الصورة: الشخص + المكان + الفعل + التفاصيل المهمة فقط (+ النص ونبرته إذا يتكلم). الوصف الزيادة يلخبط النموذج ويقلل الجودة.\n"
                "- اللقطة الواحدة فعل واحد واضح، غير كذا حدث خلف بعض.\n"
                "- أول لقطة فيها حركة أو تباين أو شيء غير متوقعة من أول ثانية (الخطاف المعروض).\n"
                "- بدون أي نص مكتوب داخل الصورة: النص على الشاشة يوضع في المونتاج.")


# ---------------------------------------------------------------- ✂️ السكتات والحشو (بتتعلّم بالأحمر والعميل يراجع قبل الحذف)
SILENCE_MIN = 0.45    # السكوت اللي أطول من كده بيتعلّم
SILENCE_PAD = 0.12    # بنسيب نَفَس صغير قبل وبعد الكلام علشان القطع مايبانش
FILLERS = {"امم", "اممم", "ممم", "مم", "إمم", "ااه", "آآ", "اا", "ااا", "إيييه", "um", "umm", "uh", "uhh", "hmm", "erm", "ah"}


def silence_marks(quiet: list[tuple[float, float]], a: float, b: float, first: bool, last: bool, min_len: float = SILENCE_MIN) -> list[dict]:
    """السكتات داخل قطعة [a, b] من الفيديو الأصلي. السكوت في أول أول قطعة وآخر آخر قطعة يُزال كله (القفل بعد النتيجة)."""
    out = []
    for s, e in quiet:
        s, e = max(s, a), min(e, b)
        if e - s < min_len:
            continue
        head, tail = s <= a + 0.05, e >= b - 0.05
        cs = s if (head and first) else s + SILENCE_PAD
        ce = e if (tail and last) else e - SILENCE_PAD
        if ce - cs >= 0.25:
            out.append({"a": round(cs, 2), "b": round(ce, 2), "kind": "end" if tail and last else "start" if head and first else "silence"})
    return out


def filler_marks(words: list[dict], base: float) -> list[dict]:
    """الحشو (أمم/نعم) والكلمة التي اتكررت خلف بعضها. الأوقات بالنسبة للفيديو الأصلي."""
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
    return [{"role": "system", "content": "أنت تكتب الخطاف المكتوب على الشاشة لفيديو قصير. Return JSON only.\n\n" + playbook.pack("hook", 4000)},
            {"role": "user", "content": f"""هذا الفيديو:
{context[:2000]}

اكتب الكلام اللي يتحط على الشاشة في أول ٣ ثواني: نفس معنى أول جملة بتتقال، ٣–٨ كلمات، سطرين بالكتير (افصل بينهم بـ \\n عند عبارة طبيعية)، من غير علامات ترقيم ولا كلمات ربط، بنفس لغة ولهجة الكلام.
استعد {{"text": "..."}}"""}]


# ---------------------------------------------------------------- ⚡ النشر: كابشن جاهز بالقواعد + علامة AI + الدفعة الأوتوماتيك

AI_LABEL = "🤖 الفيديو مصنوع بالذكاء الاصطناعي"
BAD_TAGS = {"fyp", "foryou", "foryoupage", "viral", "explore", "explorepage", "trending", "اكسبلور", "إكسبلور", "ترند", "فيرال"}
BATCH_EVERY = 10   # كل كام بوست منشور الدفعة بتتحلل لوحدها


def post_caption_messages(context: str, strategy: str, platform: str) -> list[dict]:
    return [{"role": "system", "content": "أنت تكتب تعليق نصي فيديو قصير بقواعد الخوارزميات. Return JSON only.\n\n" + playbook.pack("caption", 3000)},
            {"role": "user", "content": f"""{strategy or 'لا يوجد خطة محتوى ما زال.'}

الفيديو (المنصة: {platform or 'تيك توك وريلز'}):
{context[:2500]}

اكتب:
- "first": أول سطر خطاف آخر (٥–١٢ كلمة) يُكمل فضول الفيديو، غير تكرار للهوك الذي على الشاشة، ومن غير «أهلًا» أو تحية.
- "body": سطر أو اتنين قيمة من الفيديو بنفس اللهجة (من غير حشو).
- "cta": دعوة واحدة مطابقة للفيديو؛ إذا الخطة فيها كلمة تعليق استخدمها بالضبط («علّق بكلمة …» وستأخذ الهدية).
- "tags": ٣–٥ هاشتاجات للمجال نفسه فقط (بدون #fyp #viral #explore ولا هاشتاجات عامة).
استعد {{"first": "", "body": "", "cta": "", "tags": ["#..."]}}"""}]


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
            "cta": "احفظ الفيديو لكي ترجعله", "tags": ["#تسويق", "#محتوى", "#fyp", "#علامة"]}
