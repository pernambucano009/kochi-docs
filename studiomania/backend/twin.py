"""🪞 «نسختي»: نسخة من الشخص نفسه (أفاتار) من تسجيلات حقيقية له.

نديله نص يقرؤه أمام الكاميرا (هذا الفيديو هو ما نركّب عليه أي نص جديد لاحقًا)، وصور من كذا اتجاه،
وتسجيل صوت تلقائيًا في مكان هادي. العربية فصحى بسيطة لكي ينفع لأي بلد، ومعه نسخة إنجليزي.
"""
from __future__ import annotations

# الفيديو: جمل قصيرة بحروف ومخارج مختلفة (عشان الشفايف تتعلّم كل الأشكال)، وفيها وقفات وابتسامة وسكوت
VIDEO_SCRIPT = {
    "ar": [
        "(ابدأ بثلاث ثوانٍ صامتًا، تنظر إلى الكاميرا وتبتسم ابتسامة خفيفة.)",
        "مرحبًا، اسمي … وهذا تسجيل لنسختي الرقمية.",
        "أحب أن أبدأ يومي بهدوء: كوب ماء، ثم خطة بسيطة عندما سأفعله.",
        "في عملي أحاول دائمًا أن أشرح الفكرة الصعبة بكلمات سهلة وواضحة.",
        "هل تعرف ما الذي يصنع الفرق الحقيقي؟ الاستمرار، حتى عندما يكون التقدم بطيئًا.",
        "واحد، اثنان، ثلاثة، أربعة، خمسة، ستة، سبعة، ثمانية، تسعة، عشرة.",
        "شمس، ظل، زهر، صوت، فجر، غيم، قمر، ثلج، حلم، طريق.",
        "شكرًا لأنك معي. سأراك في الفيديو القادم.",
        "(اختم بثلاث ثوانٍ صامتًا، تنظر إلى الكاميرا وتبتسم.)",
    ],
    "en": [
        "(Start with three silent seconds, looking at the camera with a light smile.)",
        "Hi, my name is … and this is a recording for my digital twin.",
        "I like to start my day calmly: a glass of water, then a simple plan.",
        "In my work, I always try to explain hard ideas in clear, simple words.",
        "Do you know what really makes the difference? Showing up, even when progress feels slow.",
        "One, two, three, four, five, six, seven, eight, nine, ten.",
        "Sun, shadow, flower, voice, morning, cloud, moon, snow, dream, road.",
        "Thanks for being here. I'll see you in the next video.",
        "(End with three silent seconds, looking at the camera and smiling.)",
    ],
}

# الصوت لوحده: كلام مختلف عن الفيديو، بنبرة طبيعية، عشان نعرف صوته في أكتر من إحساس
VOICE_SCRIPT = {
    "ar": [
        "أهلًا بك. سأتحدث الآن بصوتي الطبيعي، كما أتحدث مع صديق.",
        "الخبر الجيد أن كل شيء بدأ يتحسن، وأنا سعيد جدًا بذلك!",
        "لكن دعني أكون صريحًا: الطريق لم يكن سهلًا أبدًا.",
        "سؤال بسيط: ماذا ستفعل اليوم لتقترب خطوة من هدفك؟",
        "تذكر دائمًا: البداية الصغيرة أفضل من الانتظار الطويل.",
        "الأرقام: مئة وخمسة وعشرون، ألفان وستة وعشرون، سبعة في المئة.",
        "شكرًا لك، وإلى اللقاء.",
    ],
    "en": [
        "Hello. I'm going to speak in my natural voice, like I'm talking to a friend.",
        "The good news is that things are finally getting better, and I'm really happy about it!",
        "But let me be honest: the road was never easy.",
        "A simple question: what will you do today to get one step closer to your goal?",
        "Always remember: a small start beats a long wait.",
        "Numbers: one hundred twenty-five, two thousand twenty-six, seven percent.",
        "Thank you, and see you soon.",
    ],
}

TIPS = {
    "video": ["الكاميرا في مستوى العين، والجوال ثابت على حامل أو شيء ثابتة.", "إضاءة أمام وشك (نافذة أو لمبة)، غير وراك.",
              "من الصدر لفوق، والوجه في نص الكادر، ومن غير نضارة شمس أو شيء مغطية البق.", "اقرا براحة وبصوتك الطبيعي، وانظر للكاميرا غير للشاشة.",
              "نفس اللبس والمكان الذي تريدهم يظهرون في فيديوهاتك.", "من دقيقة لدقيقتين، وفيديو طولي إذا ستعمل ريلز."],
    "photos": ["نفس الإضاءة واللبس الخاصين بالفيديو.", "خلفية بسيطة، والوجه واضح ومش متغطي.", "صورة لكل اتجاه، بدون فلاتر."],
    "backgrounds": ["صوّر المكان الذي تصوّر فيه فيديوهاتك وهو فارغ (من غيرك)، من نفس مكان الكاميرا.", "صورة لكل مكان: المكتب، المطبخ، الجيم، المحل…",
                    "نفس إضاءة التصوير، لكي اللقطات التي البرنامج يعملها بيك تظهر شبه فيديوهاتك."],
    "voice": ["مكان هادي بدون صدى (أوضة فيها ستاير أو هدوم أحسن من حمام أو صالة فارغة).", "الجوال على بعد شبر من بقك.",
              "اقرا نبرتك العادية، ومن غير موسيقى أو تكييف يعمل.", "من دقيقة لدقيقتين."],
}

ANGLES = [
    ("front", "أمام الكاميرا مباشرة", "Facing the camera"),
    ("smile", "أمام الكاميرا بابتسامة", "Facing the camera, smiling"),
    ("r45", "لافف ربع لفة يمين", "Quarter turn right"),
    ("l45", "لافف ربع لفة شمال", "Quarter turn left"),
    ("r90", "بجانب يمين (بروفايل)", "Right profile"),
    ("l90", "بجانب شمال (بروفايل)", "Left profile"),
    ("up", "باصص لفوق قليلًا", "Looking slightly up"),
    ("body", "نص جسم أو جسم كامل", "Half or full body"),
]
ANGLE_IDS = [a[0] for a in ANGLES]


def kit(lang: str) -> dict:
    en = lang == "en"
    return {"video_script": VIDEO_SCRIPT["en" if en else "ar"], "voice_script": VOICE_SCRIPT["en" if en else "ar"], "tips": TIPS,
            "angles": [{"id": a, "label": e if en else ar} for a, ar, e in ANGLES]}


def ready(t: dict) -> dict:
    """النسخة جاهزة لإيه: الفيديو تلقائيًا يكفي للتركيب، والصورة القدامية تكفي لطريقة الصورة."""
    photos = {p["angle"] for p in t.get("photos") or []}
    return {"video": bool((t.get("video") or {}).get("file")), "photo": "front" in photos or "smile" in photos,
            "voice": bool((t.get("voice") or {}).get("file")), "photos": len(photos), "angles": len(ANGLE_IDS),
            "backgrounds": len(t.get("backgrounds") or [])}
