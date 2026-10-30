"""🎙️ الصوت المباشر (المساعد اللي بيكلّم العميل لايف أول ما يسجّل): مختبر بيجرّب نماذج الصوت المباشر بكل لهجة.

- المتصفح بيكلّم المزوّد على طول (أسرع رد ممكن)، والسيرفر بيدّيه مفتاح مؤقت بس (المفتاح الأساسي ما بيطلعش من السيرفر).
- OpenAI: مفتاح مؤقت من /v1/realtime/client_secrets، والمتصفح بيوصل WebRTC على /v1/realtime/calls.
- تقييمات الأدمن (النجوم وسرعة الرد والملاحظات) بتتحفظ في data/live_lab.json، وعليها هنختار النموذج لكل لهجة.
"""
from __future__ import annotations

import json
import re
import os
import threading
import time
import uuid
from pathlib import Path

import httpx

OPENAI_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_VOICES = ["marin", "cedar", "coral", "sage", "shimmer", "ash", "ballad", "echo", "verse", "alloy"]
# لو المزوّد ما رجعش قائمة النماذج (أو المفتاح لسه مش متسجل) بنعرض دول
OPENAI_MODELS = ["gpt-realtime-2.1", "gpt-realtime-2.1-mini", "gpt-realtime-2", "gpt-realtime", "gpt-realtime-mini"]
# دولار في الدقيقة تقريبًا (دخل وقت ما العميل بيتكلم، خرج وقت ما المساعد بيتكلم): تقدير للعرض بس، مش للفوترة
PRICE_PER_MIN = {"openai": (0.02, 0.08), "openai-mini": (0.006, 0.024)}
# 💵 السعر الحقيقي بالتوكن (دولار لكل مليون، من صفحة أسعار المزوّد: حدّثها لو اتغيرت). المكالمة بتتحسب من أرقام الاستهلاك اللي المزوّد نفسه بيرجعها
TOKEN_PRICE = {
    "full": {"text_in": 4.0, "text_cached": 0.4, "text_out": 16.0, "audio_in": 32.0, "audio_cached": 0.4, "audio_out": 64.0},
    "mini": {"text_in": 0.6, "text_cached": 0.06, "text_out": 2.4, "audio_in": 10.0, "audio_cached": 0.3, "audio_out": 20.0},
}


def tier(model: str) -> str:
    return "mini" if "mini" in (model or "") else "full"


def usage_usd(model: str, u: dict) -> float:
    """u: مجموع أرقام الاستهلاك من كل الردود (text_in, audio_in, text_cached, audio_cached, text_out, audio_out)."""
    p = TOKEN_PRICE[tier(model)]
    n = lambda k: max(0.0, float(u.get(k) or 0))  # noqa: E731
    tokens = (n("text_out") * p["text_out"] + n("audio_out") * p["audio_out"]
              + max(0.0, n("text_in") - n("text_cached")) * p["text_in"] + n("text_cached") * p["text_cached"]
              + max(0.0, n("audio_in") - n("audio_cached")) * p["audio_in"] + n("audio_cached") * p["audio_cached"])
    return round(tokens / 1e6, 4)

# كل لهجة: اسمها، ووصفها للموديل، وجملة الافتتاح بلهجتها (صاحب المنصة كتب المصري، والباقي على نفس المعنى)
# الجملة فيها {name} (اسم العميل) و{agent} (اسم المساعد)، وبصيغة المساعدة البنت؛ الموديل بيعدّل الضماير لو المساعد ولد أو العميل بنت
DIALECTS = {
    "ar-eg-cairo": ("🇪🇬 مصري", "Egyptian Arabic (Cairene colloquial)",
                    "إزيك يا {name}؟ أنا {agent}، وجاية النهارده عشان أضمن إن رحلتك مع سمسمكيت تكون ألطف ما يكون. ها، مستعد ندردش شوية عشان أتعرف عليك أكتر؟"),
    "ar-sa-najdi": ("🇸🇦 سعودي نجدي", "Saudi Najdi Arabic (Riyadh)",
                    "هلا والله يا {name}، كيف حالك؟ أنا {agent}، وجيتك اليوم عشان أضمن إن رحلتك مع سمسمكيت تكون أحلى ما يكون. ها، جاهز نسولف شوي عشان أتعرف عليك أكثر؟"),
    "ar-sa-hijazi": ("🇸🇦 سعودي حجازي", "Saudi Hijazi Arabic (Jeddah, Makkah)",
                     "أهلين يا {name}، كيفك؟ أنا {agent}، وجيت اليوم عشان أضمن إن رحلتك مع سمسمكيت تكون ألطف شي. ها، جاهز ندردش شوية عشان أتعرف عليك أكتر؟"),
    "ar-gulf": ("🌊 خليجي عام", "general Gulf Arabic",
                "هلا والله يا {name}، شلونك؟ أنا {agent}، وجيت اليوم عشان أضمن إن رحلتك مع سمسمكيت تكون أحلى ما يكون. ها، جاهز نسولف شوي عشان أتعرف عليك أكثر؟"),
    "ar-ae": ("🇦🇪 إماراتي", "Emirati Arabic",
              "هلا والله يا {name}، شحالك؟ أنا {agent}، وياية اليوم عشان أضمن إن رحلتك ويا سمسمكيت تكون أحلى ما يكون. ها، مستعد نسولف شوي عشان أتعرف عليك أكثر؟"),
    "ar-kw": ("🇰🇼 كويتي", "Kuwaiti Arabic",
              "هلا والله يا {name}، شلونك؟ أنا {agent}، وجاية اليوم عشان أضمن إن رحلتك ويا سمسمكيت تكون أحلى شي. ها، جاهز نسولف شوي عشان أتعرف عليك أكثر؟"),
    "ar-qa": ("🇶🇦 قطري", "Qatari Arabic",
              "هلا والله يا {name}، شلونك؟ أنا {agent}، وجاية اليوم عشان أضمن إن رحلتك ويا سمسمكيت تكون أحلى ما يكون. ها، مستعد نسولف شوي عشان أتعرف عليك أكثر؟"),
    "ar-bh": ("🇧🇭 بحريني", "Bahraini Arabic",
              "هلا والله يا {name}، شلونك؟ أنا {agent}، وجاية اليوم عشان أضمن إن رحلتك ويا سمسمكيت تكون أحلى شي. ها، جاهز نسولف شوي عشان أتعرف عليك أكثر؟"),
    "ar-om": ("🇴🇲 عماني", "Omani Arabic",
              "هلا يا {name}، كيف حالك؟ أنا {agent}، وجاية اليوم عشان أضمن إن رحلتك مع سمسمكيت تكون أحلى ما يكون. ها، مستعد نسولف شوي عشان أتعرف عليك أكثر؟"),
    "ar-levant": ("🇱🇧 شامي", "Levantine Arabic (Syrian/Lebanese/Jordanian)",
                  "كيفك يا {name}؟ أنا {agent}، وجاية اليوم لأتأكد إنو رحلتك مع سمسمكيت تكون أحلى ما يكون. شو، جاهز نحكي شوي لأتعرّف عليك أكتر؟"),
    "ar-iq": ("🇮🇶 عراقي", "Iraqi Arabic (Baghdadi)",
              "هلا بيك يا {name}، شلونك؟ آني {agent}، وجاية اليوم حتى أضمن إن رحلتك ويا سمسمكيت تكون أحلى شي. ها، حاضر نسولف شوية حتى أتعرف عليك أكثر؟"),
    "ar-sd": ("🇸🇩 سوداني", "Sudanese Arabic",
              "كيفك يا {name}؟ أنا {agent}، وجاية الليلة عشان أضمن إنو رحلتك مع سمسمكيت تكون أحلى حاجة. ها، جاهز نتونس شوية عشان أتعرف عليك أكتر؟"),
    "ar-ma": ("🇲🇦 مغربي", "Moroccan Darija",
              "لاباس عليك أ {name}؟ أنا {agent}، وجيت اليوم باش نضمن بلي الرحلة ديالك مع سمسمكيت تكون زوينة بزاف. واش واجد نهضرو شوية باش نتعرف عليك كثر؟"),
    "ar-dz": ("🇩🇿 جزائري", "Algerian Darja",
              "واش راك يا {name}؟ أنا {agent}، وجيت اليوم باش نضمن بلي الرحلة تاعك مع سمسمكيت تكون مليحة بزاف. واش راك واجد نهدرو شوية باش نتعرف عليك كثر؟"),
    "ar-tn": ("🇹🇳 تونسي", "Tunisian Derja",
              "شنحوالك يا {name}؟ أنا {agent}، وجيت اليوم باش نضمن إلي الرحلة متاعك مع سمسمكيت تكون باهية برشا. حاضر نحكيو شوية باش نتعرف عليك أكثر؟"),
    "ar-msa": ("📖 فصحى", "Modern Standard Arabic",
               "كيف حالك يا {name}؟ أنا {agent}، وجئت اليوم لأضمن أن تكون رحلتك مع سمسمكيت ألطف ما يكون. هل أنت مستعد لنتحدث قليلًا لأتعرف عليك أكثر؟"),
}
# اسم المساعد في كل لهجة (أقرب لأهلها): (اسم بنت، اسم ولد). الاسم لازم يمشي مع الصوت
AGENT_NAMES = {
    "ar-eg-cairo": ("سعاد", "كريم"), "ar-sa-najdi": ("نورة", "فهد"), "ar-sa-hijazi": ("ريم", "ماجد"), "ar-gulf": ("مريم", "خالد"),
    "ar-ae": ("ميثاء", "حمدان"), "ar-kw": ("دانة", "مشاري"), "ar-qa": ("العنود", "جاسم"), "ar-bh": ("فاطمة", "علي"), "ar-om": ("شيخة", "سالم"),
    "ar-levant": ("لين", "كرم"), "ar-iq": ("زينب", "حيدر"), "ar-sd": ("آمنة", "عثمان"), "ar-ma": ("سلمى", "يونس"), "ar-dz": ("أمينة", "ياسين"),
    "ar-tn": ("ياسمين", "أيمن"), "ar-msa": ("سارة", "عمر"),
}
# نوع كل صوت (عشان الاسم والضماير): f بنت، m ولد
VOICE_GENDER = {"marin": "f", "cedar": "m", "coral": "f", "sage": "f", "shimmer": "f", "alloy": "f", "ash": "m", "ballad": "m", "echo": "m", "verse": "m",
                "Kore": "f", "Puck": "m", "Charon": "m", "Zephyr": "f", "Fenrir": "m", "Leda": "f", "Orus": "m", "Aoede": "f", "Callirrhoe": "f",
                "Autonoe": "f", "Enceladus": "m", "Iapetus": "m", "Umbriel": "m", "Algieba": "m", "Despina": "f", "Erinome": "f", "Algenib": "m",
                "Rasalgethi": "m", "Laomedeia": "f", "Achernar": "f", "Alnilam": "m", "Schedar": "m", "Gacrux": "f", "Pulcherrima": "f",
                "Achird": "m", "Zubenelgenubi": "m", "Vindemiatrix": "f", "Sadachbia": "m", "Sadaltager": "m", "Sulafat": "f"}
# أسئلة العقل اللي الموديل بيسألها بالترتيب (من نفس كويز العقل، عشان كل إجابة تروح خانتها)
SKIP_Q = {"language", "link", "type"}   # اللهجة معروفة من التسجيل، والحساب بيتطلب الأول، والنوع بيبان من الوصف


def agent_name(dialect: str, gender: str) -> str:
    f, m = AGENT_NAMES.get(dialect) or AGENT_NAMES["ar-eg-cairo"]
    return m if gender == "m" else f


def quiz_questions() -> list[tuple[str, str]]:
    """(رقم السؤال في كويز العقل، نصه) بالترتيب."""
    try:
        import brainquiz  # noqa: PLC0415
        return [(q["id"], q["ar"]) for q in brainquiz.Q if q["id"] not in SKIP_Q]
    except Exception:  # noqa: BLE001
        return [("domain", "ما مجال عملك؟"), ("about", "صِف مشروعك: ماذا تقدم، وما الذي يميزك؟"), ("audience", "من هو عميلك المثالي؟"),
                ("market", "في أي مدينة أو دولة عملاؤك؟")]


# 🧰 أدوات المساعد الحقيقي (بعد التسجيل): كل إجابة بتتحفظ في العقل وقت ما بتتقال، وتحليل الحساب بيبدأ في الخلفية
TOOLS = [
    {"type": "function", "name": "save_answer", "description": "Save the user's answer to one onboarding question into their brand profile.",
     "parameters": {"type": "object", "properties": {
         "qid": {"type": "string", "description": "The question id from the list in the instructions."},
         "answer": {"type": "string", "description": "The answer, written clearly in Arabic, keeping the user's own facts and words. No invented details."}},
         "required": ["qid", "answer"]}},
    {"type": "function", "name": "skip_question", "description": "The user asked to skip this question (or move to the next one, or answer it "
     "later). Call it with the question id, then go on to the next question.",
     "parameters": {"type": "object", "properties": {"qid": {"type": "string"}}, "required": ["qid"]}},
    {"type": "function", "name": "start_account_analysis", "description": "Start analysing the user's Instagram or TikTok account in the background.",
     "parameters": {"type": "object", "properties": {"account": {"type": "string", "description": "The @handle or profile link exactly as the user gave it."}},
                    "required": ["account"]}},
    {"type": "function", "name": "get_account_analysis", "description": "Check whether the account analysis is ready and get its main findings.",
     "parameters": {"type": "object", "properties": {}}},
    {"type": "function", "name": "show_input", "description": "Show a box on the user's screen to type or upload what you are asking for. "
     "Call it in the SAME turn you ask for it.",
     "parameters": {"type": "object", "properties": {"kind": {"type": "string", "enum": ["account", "logo", "products", "intro", "rival", "none"],
         "description": "account: Instagram/TikTok link or @handle. logo: their logo image. products: photos of their products or work. "
                        "intro: a short video that opens their videos. rival: the link of a page they consider a competitor. "
                        "none: close the box (they said later / they have none)."}}, "required": ["kind"]}},
    {"type": "function", "name": "show_card", "description": "Show a card on the user's screen for the current stop of the tour (call it in the SAME turn "
     "you start talking about that stop). Returns real data and facts to talk about; if ok is false, skip that stop.",
     "parameters": {"type": "object", "properties": {"kind": {"type": "string", "enum": ["analysis", "types", "phone", "avatar", "process", "custom", "autopilot", "library"]}},
                    "required": ["kind"]}},
    {"type": "function", "name": "suggest_competitor", "description": "Find ONE real account in the user's field and area (a possible competitor) "
     "and show it on their screen with its real numbers. Each call shows a different account. Takes a few seconds.",
     "parameters": {"type": "object", "properties": {}}},
    {"type": "function", "name": "check_competitor", "description": "Check a page the user TYPED (link or @handle) and show its real numbers and "
     "an honest verdict on screen. Only with exactly what they typed, never from speech.",
     "parameters": {"type": "object", "properties": {"link": {"type": "string"}}, "required": ["link"]}},
    {"type": "function", "name": "decide_competitor", "description": "Record the decision on the account shown: add=true adds it to their "
     "competitors page, add=false means it is not a competitor (never suggested again).",
     "parameters": {"type": "object", "properties": {"platform": {"type": "string"}, "handle": {"type": "string"}, "add": {"type": "boolean"}},
                    "required": ["platform", "handle", "add"]}},
    {"type": "function", "name": "set_field", "description": "Fix the user's field in their account, once you and the user agreed which field is right "
     "(when what they say differs from the field they chose at signup).",
     "parameters": {"type": "object", "properties": {
         "field": {"type": "string", "enum": ["food", "beauty", "ecom", "realestate", "edu", "fitness", "home", "shops", "other"],
                   "description": "food: restaurants and cafes. beauty: clinics and beauty. ecom: online stores. realestate: real estate. edu: education and "
                                  "coaching. fitness: sports and fitness. home: home services and contracting. shops: local shops and retail. other: none of these."},
         "what": {"type": "string", "description": "Their field in their own words, in Arabic (always fill it)."}}, "required": ["field", "what"]}},
    {"type": "function", "name": "save_preference", "description": "Save what the user said about a tour stop (e.g. keep these video types or try "
     "others, they like filming themselves or not, they want autopilot or not) into their brand profile.",
     "parameters": {"type": "object", "properties": {"topic": {"type": "string", "enum": ["analysis", "types", "rivals", "phone", "avatar", "process", "autopilot", "presenter"]},
                                                     "text": {"type": "string", "description": "Their answer, clearly, in Arabic."}}, "required": ["topic", "text"]}},
    {"type": "function", "name": "start_showcase", "description": "Start making the showcase reel from the user's own video (only after they agreed). "
     "It renders in the background for a few minutes.", "parameters": {"type": "object", "properties": {}}},
    {"type": "function", "name": "get_showcase", "description": "Check whether the showcase reel is ready (and how far it got).",
     "parameters": {"type": "object", "properties": {}}},
    {"type": "function", "name": "play_showcase", "description": "Show the ready showcase reel on the user's screen and start playing it.",
     "parameters": {"type": "object", "properties": {}}},
    {"type": "function", "name": "find_competitors", "description": "Search for the competitor accounts the user named (by voice or typed). "
     "The team looks them up in the background and sends the user a notification to confirm the ones found.",
     "parameters": {"type": "object", "properties": {"names": {"type": "array", "items": {"type": "string"},
         "description": "Each competitor exactly as the user said or typed it: a brand name, a person's name, an @handle or a link."}},
         "required": ["names"]}},
    {"type": "function", "name": "set_user_gender", "description": "The user told you (or corrected you) that they are a man or a woman. "
     "Call it once, then keep using that gender.",
     "parameters": {"type": "object", "properties": {"gender": {"type": "string", "enum": ["m", "f"]}}, "required": ["gender"]}},
    {"type": "function", "name": "finish", "description": "Call once at the very end, after you thanked the user and said goodbye.",
     "parameters": {"type": "object", "properties": {"later": {"type": "boolean",
         "description": "true if the user wants to continue another time (said later / not now / not ready), false when the conversation is complete."}}}},
]


# 👤 نوع العميل من اسمه الأول (عشان المساعدة ماتكلمش راجل بصيغة المؤنث). مش متأكدين ← مذكر (الأصل في الكلام)، ولو صحّحها بتغيّر
_F_NAMES = set("""فاطمة فاطمه مريم سارة ساره نور نورة نوره هدى منى مها هند ليلى ليلي سلمى رنا ريم دانة دانه لمى جود شهد هالة هاله آية اية ايه ياسمين
رحاب أمل امل عبير ندى نهى سمر سماح أسماء اسماء دعاء رضوى نادين شيماء إيمان ايمان هبة هبه رحمة رحمه بسمة بسمه زينب خديجة عائشة عايشه حنان سهى رغد
لينا جنى جنا ملك روان غادة غاده إسراء اسراء آلاء الاء منار مروة مروه نسرين وفاء سعاد ميار يارا تسنيم أريج اريج عفاف نجلاء مي ميرنا نرمين شروق
fatma fatima fatmah mariam maryam mariem sara sarah nour noor noura nora huda hoda mona muna maha hind laila layla leila salma rana reem rim
dana lama jood shahd hala aya ayah yasmin yasmine jasmine rehab amal abeer nada noha samar samah asmaa asma doaa radwa nadine shaimaa shaymaa
eman iman heba hiba rahma basma zeinab zainab khadija aisha aysha hanan soha raghad lina lena jana malak rawan ghada esraa israa manar
marwa nesreen nisreen wafaa souad suad mayar yara tasneem areej afaf nagla may mai mirna nermeen shorouk""".split())
_M_NAMES = set("""محمد أحمد احمد محمود مصطفى علي عمر خالد حسن حسين إسلام اسلام يوسف إبراهيم ابراهيم عبدالله عبد كريم طارق ياسر وليد هاني سامي زياد مازن
فهد فيصل سعد سلطان ناصر تركي بدر راشد حمد ماجد عادل أيمن ايمن أسامة اسامة أسامه حمزة حمزه طه رضا علاء بهاء ضياء مؤمن مؤنس معاذ عمرو شريف
mohamed mohammed muhammad mohammad ahmed ahmad mahmoud mostafa moustafa mustafa ali omar khaled khalid hassan hussein hossam islam youssef yousef
yusuf ibrahim abdullah abdallah abdo kareem karim tarek tariq yasser waleed walid hany hani sami ziad mazen fahad fahd faisal saad sultan nasser
turki badr rashid hamad majed adel ayman osama usama hamza taha reda alaa bahaa diaa moamen moaz amr sherif""".split())


def name_gender(name: str) -> str:
    """m / f من الاسم الأول. مش معروف ← "" (والمساعدة بتكلّمه بالمذكر)."""
    n = (name or "").strip().split()[0].lower() if (name or "").strip() else ""
    n = n.replace("أ", "ا").replace("إ", "ا") if n else n
    if not n:
        return ""
    if n in _M_NAMES or n.replace("ا", "أ", 1) in _M_NAMES:
        return "m"
    if n in _F_NAMES or n.replace("ا", "أ", 1) in _F_NAMES:
        return "f"
    if re.search(r"[\u0600-\u06FF]", n) and n.endswith(("ة", "اء")) and n not in ("علاء", "بهاء", "ضياء", "حمزة", "اسامة", "طلحة"):
        return "f"
    return ""


STEP_NAMES = {"account": "their Instagram/TikTok account", "logo": "uploading their logo", "photos": "uploading photos of their work/products/cases"}


def instructions(dialect: str, agent: str = "", user: str = "محمود", agent_gender: str = "f", user_gender: str = "m", tools: bool = False,
                 known: dict | None = None, returning: bool = False, have: dict | None = None, ctx: str = "", lessons: list[str] | None = None, steps: list[str] | None = None) -> str:
    """have: اللي العقل فيه أصلًا ومش محتاج يتطلب تاني (account: اسم الحساب، logo / products: True لو اترفعوا)."""
    have = have or {}
    label, lang, sample = DIALECTS.get(dialect) or DIALECTS["ar-eg-cairo"]
    # الاسم الأول بس («Islam Shehata» ← Islam)، والموديل بينطقه ويكتبه بالعربي
    user = (user or "").strip().split()[0] if (user or "").strip() else ""
    latin = bool(re.search(r"[A-Za-z]", user))
    agent = agent or agent_name(dialect, agent_gender)
    # الافتتاح على أدوار: التحية لوحدها (لحد أول «؟»)، وبعدها الباقي، وكل دور العميل لازم يرد بعده
    full = sample.format(name=user, agent=agent)
    t1, _, t2 = full.partition("؟")
    t1, t2 = t1.strip() + "؟", (re.split(r"(?<=[.!])\s+", t2.strip())[-1] if t2.strip() else full)   # «ها، مستعد ندردش شوية…؟» بس
    ig_ex = ', for example: «إيه رأيك تكتبلي لينك حسابك على الإنستجرام عشان الشباب يبدأوا فيه التحليل لحد ما إحنا نخلص؟»' \
        if dialect == "ar-eg-cairo" else ""
    fill_line = "" if returning else ("   Once they agree to chat, tell them in one short sentence that they will see their brand brain filling up on the screen in front of\n"
                                      "   them with every answer (so they feel the brain being built while you talk).")
    # من غير أمثلة بلهجة معيّنة: المثال المصري كان بيشد الموديل للمصري في اللهجات التانية
    me = "a woman: use feminine forms whenever you talk about yourself" if agent_gender != "m" else "a man: use masculine forms whenever you talk about yourself"
    you = ("a woman: address her ONLY with feminine pronouns, verbs and adjectives" if user_gender == "f" else
           "a man: address him ONLY with masculine pronouns, verbs and adjectives (never feminine forms for him)")
    you += (". Your own gender is NOT the user's: feminine forms are only for words about yourself. "
            "If the user says or shows they are of the other gender, switch at once" + (" and call set_user_gender" if tools else ""))
    # 🧠 اللي في العقل أصلًا مابيتسألش تاني: الأسئلة المجاوبة بتتشال من القايمة، وبتتبعت كمعلومة يبني عليها الكلام
    known = {k: v for k, v in (known or {}).items() if v}
    left = [(qid, q) for qid, q in quiz_questions() if qid not in known]
    qs = "\n".join(f"   {i + 1}. " + (f"[{qid}] " if tools else "") + q for i, (qid, q) in enumerate(left)) or "   (all answered already: skip this step)"
    kn = "\n".join(f"   [{k}] {v[:200]}" for k, v in known.items())
    if kn:
        qs += "\nAlready in their brand brain (never ask these again; you may refer to them naturally):\n" + kn
    # 🧭 الجولة بعد الأسئلة: محطة محطة، كل واحدة بكارت على الشاشة. اللي اتعرض في مكالمة قبل كده مابيتعادش
    seen = set(have.get("tour") or [])
    stops = [
        ("analysis", "Their account analysis: call get_account_analysis; if ready, call show_card analysis. If it has gender_check.mismatch, "
                     "resolve that FIRST as its note says, before anything else. Then talk about THEIR VIDEOS themselves, "
                     "not only the numbers: name a specific video (what it is about, its views) and what is really good in it (be warm and "
                     "generous, e.g. the cases they show look great), then what could be better in it (lighting, color grading, quality, sound, "
                     "the first seconds, text on screen) from the review. Then 1–2 account-level points (posting rhythm, bio, call to action). "
                     "One or two videos per turn, then ask what they think; continue with the next video if they are interested."),
        ("types", "Video types: call show_card types. Say which kinds of videos fit them (in their terms), and ask if they want to keep "
                  "these or also try other kinds. Save their answer with save_preference (topic types)."),
        ("rivals", "COMPETITORS: an important stop, never skip it, but you only OPEN the topic: the user adds more later by themselves from "
                   "their competitors page. Goal: agree together on at least one real competitor for their competitors page. If they already "
                   "named competitors in the questions, start from those (do not ask again who their competitors are).\n"
                   "      1) Call suggest_competitor. While it searches say at most 'let me look for one' and nothing else: never ask whether to "
                   "add an account, or describe one, before its card is on the screen (the result arrives in a few seconds and you will speak "
                   "again). Then tell them in one or two sentences who it is (name, what they post, a real number), say you found "
                   "it in their field and area, and ask: is this really one of the pages we should add to your competitors?\n"
                   "      2) Yes → decide_competitor add=true, then say in one sentence what works for them (from their best videos).\n"
                   "      3) No → decide_competitor add=false, then ask if they know a page they consider a competitor and can type its link "
                   "(call show_input kind rival). When they type it, it is checked automatically and you get the result.\n"
                   "      4) Their page: give your honest opinion with the evidence. If it is weak, say kindly but clearly that it does not look "
                   "like an active or strong page, and why (for example: one post in the last month, last post 40 days ago, around 300 views "
                   "a video). If it is good, say what works there. Then ask if we add it.\n"
                   "      5) They say they do not know one, or 'you find one', or they disagree with your opinion → call suggest_competitor again for a "
                   "different account and ask: what do you think of this one? Keep going like this until you agree on one.\n"
                   "      6) After each one you agree on, ask ONCE if they want to look at one more or move on. The moment they say anything "
                   "like enough, save these, that's fine, or move on → call save_preference (topic rivals) with what they said, tell them in "
                   "one sentence they can add more any time from their competitors page, and go to the next stop. Never come back to "
                   "competitors in this call, and never ask about them again.\n"
                   "      Use only the real numbers from the tools; never invent a page or a number."),
        ("phone", "Phone videos: call show_card phone. Explain they can film themselves with the phone and our teleprompter shows the script "
                  "while they film, then we edit it. Ask if they like appearing in their videos."),
        ("avatar", "The avatar: call show_card avatar. Explain the digital copy of them (only with their permission) that talks with new "
                   "words without filming. Ask if that interests them."),
        ("showcase", None),
        ("process", "How a video is made: call show_card process. Explain idea → script → editing → voice → publishing, and that at each step "
                    "they choose fully automatic, approve each step, or do it themselves. Ask which level of control they prefer and save it (topic process)."),
        ("custom", "Custom templates: call show_card custom. Explain they can build their own template once and run it any time. One short question."),
        ("autopilot", "The finale, autopilot: call show_card autopilot. Explain it posts every day at the best times from the templates they "
                      "choose, by itself or after their approval. Ask if they would like to turn it on, and save their answer (topic autopilot)."),
    ]
    tour_lines = []
    # 🎬 الفيديو الاستعراضي من فيديوهم: كل جزء فيه ميزة، وهي بتشرح كل جزء وهو بيتعرض
    if not tools:
        showcase_goal = "Skip this step."
    elif have.get("showcase") == "done" and have.get("showcase_used"):
        showcase_goal = "Their showcase reel was already made and shown: skip this step (they find it in their ready videos)."
    elif have.get("showcase") == "working":
        showcase_goal = "Their showcase reel is being made right now: check get_showcase, and play it when it is ready."
    elif have.get("showcase") == "done":
        showcase_goal = "Their showcase reel is ready: ask if they want to watch it now, and if yes call play_showcase."
    else:
        showcase_goal = ("Offer a gift, and ask their permission: we take one of the videos from their own page (they upload nothing) and make a short reel"
                         + " from it, where every few seconds shows a different thing the platform can do (captions, moving text, zoom, text behind them, a new "
                         "background, colors, a second camera angle, dubbing in their own voice, music and footage), and you explain each part while it plays. "
                         "Ask if they would like it; if yes, call start_showcase. If they say no or later, move on.")
    for k, txt in stops:
        if k == "showcase":
            txt = None if "Skip this step" in showcase_goal or "skip this step" in showcase_goal else "The showcase reel: " + showcase_goal
        elif k in seen:
            continue
        if txt:
            tour_lines.append(f"   {chr(97 + len(tour_lines))}. {txt}")
    tour = ("A guided tour of what the platform can do for them, one stop at a time, in this order (it is long and that is fine: they can stop "
            "any time and continue later from where you stopped). At each stop: call the tool in the same turn, explain in 1–3 short sentences "
            "in their terms, ask ONE short question and wait. Never read the card out loud; talk about it."
            + (" The showcase reel is the heart of this tour and takes several minutes to make: if they did not agree to it yet when they typed "
               "their account, offer it right after the analysis stop (start it if they agree); play it as soon as the screen says it is ready." if "Offer a gift" in showcase_goal else "")
            + " Do not suggest video ideas or scripts unless they ask you."
            + "\n" + "\n".join(tour_lines)
            ) if tools and tour_lines else "Skip this step."
    tool_txt = ("""
Tools (use them silently, never read them out loud):
- After each answer, call save_answer with the question id in [brackets] and the answer, in the same turn as your short reaction and
  the next question. If one answer covers several questions, save each one.
- If they ask to skip a question, move to the next one, or answer it later, call skip_question with its id (never save_answer for it).
- Only in the turn where you actually ask for the account, the logo, product photos or the intro video (and you say that word),
  call show_input with that kind,
  and tell them they can type it or upload it in the box that appeared. The screen tells you when they uploaded something.
  If they say later, not now, or that they have none, call show_input with kind "none" and move on.
- Right after they typed their account and its analysis started, ask in one short sentence for their permission to make a gift: a short
  showcase reel from one of the videos on their own page (they upload nothing). If they agree, call start_showcase right away (it waits for
  the analysis by itself and takes several minutes), then continue with the questions. It plays later in the tour when it is ready.
- The account link must be TYPED by the user in the box (spoken links are not accepted). If they say it by voice, thank them and
  ask them to type it in the box. Only after they typed it, call start_account_analysis with exactly what they typed. NEVER guess or make up an account (not from the brand name, not from anything else). If they say later, do not
  call it and do not say you are checking it: just say no problem and move on.
- When the user names competitors or accounts they like (the [rivals] question, or anytime), call find_competitors with each one,
  and tell them in one short sentence that you will look them up and they will get a notification to confirm the ones you found.
- If the account analysis is not ready when you reach that stop, say the results will appear on their screen in a few minutes, move on,
  and come back to it later in the tour (call get_account_analysis again).
- The showcase reel: ask their permission to take one of the videos from their own page; call start_showcase only after they agreed.
  We take the video from their page ourselves: NEVER ask them to upload or send a video. If it fails, say kindly you could not find
  a suitable video on their page and move on.
  While it renders, keep the conversation going (the account findings, their questions). Call get_showcase at most once a minute and
  never invent its progress. The screen also tells you when it is ready: then tell them in one short sentence and call play_showcase.
- During the reel the screen pauses after each part and sends you (SYSTEM: …) with what was done in that part and what else is
  possible. Explain it in 1–2 short, lively sentences in the dialect (what we did here, and what else they can do with it), in their
  terms (their field, their clients), then stop talking: the reel continues by itself. Do not ask a question after each part.
  For the dubbing part, add that they can run a channel in every dialect and every language if they want.
  After the last part, ask what they thought of it.
- Then thank them, say goodbye in one sentence, and call finish.""" if tools else "")
    return f"""You are {agent}, the personal assistant of SimsimKit, a platform that makes social-media videos for businesses.
The user, {user or "(name unknown)"}, just signed up. Speak ONLY in {lang} ({label}), exactly like a native speaker from there talks in daily life:
warm, natural, short sentences. Never use Modern Standard Arabic unless the dialect IS Modern Standard Arabic. Never switch dialects.
Grammar of gender (very important in Arabic): you are {me}. The user is {you}.

This is a REAL conversation, not a script. The most important rule: every time the user speaks, first respond to what they
actually said, and only then (if it fits) move toward your next goal. Examples of what that means:
- They ask "who are you?" or "what is this?" → answer warmly in a sentence or two (you are {agent}, their assistant at SimsimKit,
  you help set up their brand so the platform makes videos that sound like them), then gently continue.
- "Later" / "not now" about ONE thing you asked (the account, the logo, photos, a video, a template, a question) means skip only that
  thing: say no problem and continue with the next one. Never end the call because of it.
- They clearly want to stop the whole conversation (not ready to chat at the start, or they say they want to stop / continue another
  time / are busy now) → do not insist: if it is not clear whether they mean the whole call, ask once ("تحب نكمّل المكالمة بعدين؟").
  When they confirm, say a warm goodbye in the SAME turn, like «تمام، زي ما تحب، أنا موجودة هنا في أي وقت تحب نكمّل فيه», and only
  then call finish with later=true. Never call finish without saying goodbye out loud first.
- They ask a question, joke, or go off-topic → reply to it naturally first. Never ignore what they said.
- Their answer is unclear or unrelated to your question → ask again in other words; do not save it and do not move on.
  Before every save_answer, check that what they said really answers THAT question logically (a random word, "ok", "yes", a name, or
  something about another topic is not an answer to "describe your work" or "who is your ideal client"). If not, ask again.

Your goals, in this order (each is a goal to reach naturally, not a line to recite):
1. {"They talked with you before and are coming back: welcome them back warmly by name, ask how they are, then ask if they want to continue where you stopped (do NOT re-introduce yourself or restart)." if returning else "Greet them by name and check how they are, then ask if they are ready to chat a little so you get to know them."}
   Style reference for the greeting (adapt it, do not read it blindly): {("«أهلًا يا " + user + " تاني! عامل إيه؟» … «جاهز نكمّل أسئلتنا؟ فاضلنا حاجات بسيطة»" if dialect == "ar-eg-cairo" else "a warm welcome-back in their dialect with their name (like: hello again, how are you?), then ask if they are ready to continue our questions where we stopped, saying how little is left") if returning else "«" + t1 + "» … «" + t2 + "»"}
   Each of these is its own turn: say one, then STOP and wait for their reply and respond to it. Never put the greeting, "ready to chat?"
   and "let's start" in the same turn: after asking if they are ready, wait for their answer before starting.
   When they say yes, react in a few words and ask your FIRST real question in that same turn. Never say only "let's start step by step"
   (or anything like it) and stop: that sentence alone is forbidden.{"" if user else " The name is unknown: greet without a name and ask for their name first."}{f" Their name is written in Latin letters: always say it, and write it, in its Arabic form (for example Islam → إسلام, Mohamed → محمد), never spelled in English." if latin else ""}
{fill_line}
{("   What is left, in this order (continue from the first one; everything else is done, never redo it): " + ", ".join(STEP_NAMES.get(x, x) for x in steps) + ".") if steps else ""}
2. {f"They already gave their account ({have['account']}) and it is being analysed: do NOT ask for it again." if have.get("account") else f"Ask for their Instagram (or TikTok) account link so the team starts analysing it while you talk{ig_ex}."}
3. Get to know them and their work. The list below is ONLY the information you need (a checklist), NOT a script to read:
{qs}
   {("What they chose when signing up: " + ctx + ". If what they tell you about their work does not match the field they chose "
     "(for example they chose restaurants but say they are a dentist), you MUST resolve it before any other question: tell them kindly that "
     "at signup they chose that field, ask which one is right so you fix it in their account, then call set_field with the right one, and "
     "only then continue. Never continue with two different fields.") if ctx and tools else ("What they chose when signing up (a hint): " + ctx) if ctx else ""}
   - Never assume they have a "project", "business", "company", "shop" or "products". If you do not know yet, first ask what they do.
     Then talk in THEIR terms: a dentist has a clinic, patients and treatments (عيادتك، مرضاك، خدماتك), a freelancer has clients and
     work, a restaurant has dishes and guests.
   - Build every question on their previous answers, like a real conversation between people: reword each item to fit who they are
     and what they just said, pick the item that follows most naturally (the order is flexible), and react to the answer first.
   - Cover EVERY item in the list before moving on. Skip an item only when it clearly does not apply or their
     earlier answers already covered it (then save it from what they said); when unsure, ask it briefly.
   - Never ask something that contradicts or ignores what they told you (e.g. after "I'm single", never ask about their kids).
   - One question per turn; follow up briefly when an answer is interesting.
4. {tour}
5. At the very end, before saying goodbye: call show_card library and remind them warmly not to forget to add to their content library as
   many photos and videos as they can (their logo, their work, cases, place, team), because we use them to make their content.
   Never ask them to upload anything during the call: we already took what we need from their page.
6. Then thank them and tell them you are preparing what you found.
{tool_txt}
Rules:
- Never end a turn on a plain statement: if you are not asking anything, keep going in the same turn to your next question.
  A transition like "ok, let's continue step by step" or "let me organise what we have" is never a whole turn: say it and ask the next
  question right after it, in the same turn. Better: skip the transition and react to their answer, then ask the next question.
- Background noise: the microphone can pick up other people, a TV or a conversation in the room. If what you hear does not sound
  like the user answering you (it is about something else, addressed to someone else, or does not fit your question at all),
  it is NOT an answer: never save it and never move to the next question because of it. Ask once, gently, if they were talking to
  you (or stay silent if it is just noise), and wait.
- After a question, wait for the answer however long it takes. If they stay silent, stay silent too: never repeat or rephrase the
  question on your own, and never answer it for them.
- Every time you ask them to type something (their account, a competitor's link), call show_input with that kind in the SAME turn
  (otherwise there is no box on their screen). Only mention "the box on your screen" after calling it.
- After you ask them to type or upload something (account, logo, photos, video), say it ONCE and then stay completely silent and wait:
  they are busy getting it. Never repeat the request or add reminders like "ok, when you have it…". The screen tells you when it arrives.
- Messages that contain "(SYSTEM: …)" come from the platform, not from the user: follow them and never read them out loud.
  Only stop talking after a question (or a request like uploading something).
- Turn-taking: every turn is 1–2 short sentences with at most ONE question, then STOP and wait for the user. Never ask two things
  in one turn, never chain the next question before they answered. A tool result alone is never a reason to speak again
  (except get_account_analysis at the end).
- If the user interrupts, stop immediately and listen to them.
- A topic the user closed (they said enough, done, save these, move on) stays closed: never reopen it or ask about it again.
- Only use facts the user actually said. Never assume a business, product or detail they did not say, and never mix in an example
  as if it were theirs. If you did not hear clearly, ask them to repeat it, without guessing alternatives.
- Never mention the names of the AI models or companies behind the platform.
- No filler turns or preambles: never say things like "let me organise", "let me think", "I'll save that", "one moment", "let me prepare
  the next step". Call tools silently and say only your real reaction and your next question.
- Your very first turn is only the greeting (no tools, no request for the account yet).
- The end: when the tour is done, thank them warmly and say goodbye out loud in the same turn, then call finish with later=false
  (later=true ONLY if they asked to stop and continue another time). If the showcase reel is still being made, tell them it will
  appear on their screen and in their ready videos in a few minutes, before saying goodbye.""" + (
        "\nLessons from reviewing your past calls (follow them strictly):\n" + "\n".join(f"- {x}" for x in lessons[:30]) if lessons else "")


# ---------------------------------------------------------------- مفاتيح مؤقتة للمتصفح
class LiveError(Exception):
    pass


def openai_key() -> str:
    return (os.environ.get("OPENAI_API_KEY") or "").strip()


def _fail(r: httpx.Response, who: str) -> None:
    if r.status_code >= 400:
        raise LiveError(f"{who} رد بخطأ {r.status_code}: {r.text[:400]}")


def stt_lang(dialect: str) -> str:
    """لغة كلام العميل لخدمة تحويل الكلام لنص: من غيرها الكلام العربي كان بيتكتب صيني وكوري وتركي."""
    return "ar" if dialect.startswith("ar") else (dialect.split("-")[0] or "ar")


def stt_hint(dialect: str, name: str = "", brand: str = "") -> str:
    label = (DIALECTS.get(dialect) or DIALECTS["ar-eg-cairo"])[1]
    return (f"Arabic, {label} dialect, a phone-style conversation about their business and social media"
            + (f". Names: {name}" if name else "") + (f", {brand}" if brand else "") + ". Instagram, TikTok, SimsimKit.")


def openai_secret(model: str, voice: str, instr: str, eagerness: str = "auto", tools: list | None = None, lang: str = "", hint: str = "") -> dict:
    key = openai_key()
    if not key:
        raise LiveError("مفتاح OpenAI غير مسجل. ضعه من ⚙️ الإعدادات ← بقية مفاتيح المنصة")
    session = {"type": "realtime", "model": model, "instructions": instr,
               "audio": {"input": {"transcription": {"model": "gpt-4o-transcribe", **({"language": lang} if lang else {}), **({"prompt": hint} if hint else {})},
                                   "noise_reduction": {"type": "near_field"},
                                   "turn_detection": {"type": "semantic_vad", "eagerness": eagerness, "interrupt_response": True, "create_response": True}},
                         "output": {"voice": voice}}}
    if tools:
        session.update(tools=tools, tool_choice="auto")
    try:
        r = httpx.post(f"{OPENAI_URL}/realtime/client_secrets", headers={"Authorization": f"Bearer {key}"},
                       json={"expires_after": {"anchor": "created_at", "seconds": 600}, "session": session}, timeout=30)
    except httpx.HTTPError as exc:   # الشبكة وقعت أو الخدمة مابتردش: رسالة مفهومة بدل خطأ داخلي
        raise LiveError(f"تعذّر الاتصال بخدمة الصوت: {type(exc).__name__}") from exc
    _fail(r, "OpenAI")
    d = r.json()
    return {"value": d.get("value"), "expires_at": d.get("expires_at")}


_models: dict = {"at": 0.0, "v": None}


def models() -> dict:
    """النماذج المتاحة فعلًا بالمفاتيح المتسجلة (الأسماء بتتغير كتير، فبنسأل المزوّد نفسه)."""
    if _models["v"] and time.time() - _models["at"] < 600:
        return _models["v"]
    oa = list(OPENAI_MODELS)
    if openai_key():
        try:
            r = httpx.get(f"{OPENAI_URL}/models", headers={"Authorization": f"Bearer {openai_key()}"}, timeout=20)
            found = sorted({m["id"] for m in r.json().get("data", []) if "realtime" in m.get("id", "") and "transcri" not in m["id"]}, reverse=True)
            if found:
                oa = [m for m in OPENAI_MODELS if m in found] + [m for m in found if m not in OPENAI_MODELS]
        except (httpx.HTTPError, ValueError, KeyError):
            pass
    v = {"openai": {"ready": bool(openai_key()), "models": oa, "voices": OPENAI_VOICES},
         "agents": AGENT_NAMES, "voice_gender": VOICE_GENDER,
         "dialects": [{"code": k, "label": v[0]} for k, v in DIALECTS.items()], "price": PRICE_PER_MIN}
    if openai_key():
        _models.update(at=time.time(), v=v)
    return v


# ---------------------------------------------------------------- التقييمات
_lock = threading.Lock()


def _file(data_dir: Path) -> Path:
    return data_dir / "live_lab.json"


def results(data_dir: Path) -> list[dict]:
    try:
        return json.loads(_file(data_dir).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []


def save_result(data_dir: Path, r: dict) -> dict:
    keep = ("provider", "model", "voice", "dialect", "stars", "dialect_ok", "notes", "latency_ms", "latencies", "seconds", "interrupts", "cost")
    row = {k: r.get(k) for k in keep}
    row.update(id=uuid.uuid4().hex[:10], at=time.time())
    with _lock:
        rows = results(data_dir)
        rows.append(row)
        _file(data_dir).parent.mkdir(parents=True, exist_ok=True)
        _file(data_dir).write_text(json.dumps(rows[-2000:], ensure_ascii=False), encoding="utf-8")
    return row


def delete_result(data_dir: Path, rid: str) -> None:
    with _lock:
        rows = [x for x in results(data_dir) if x.get("id") != rid]
        _file(data_dir).write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")


def summary(rows: list[dict]) -> list[dict]:
    """لكل لهجة × نموذج × صوت: متوسط النجوم وسرعة الرد، ونسبة «اللهجة صح»."""
    g: dict[tuple, list] = {}
    for x in rows:
        g.setdefault((x.get("dialect"), x.get("provider"), x.get("model"), x.get("voice")), []).append(x)
    out = []
    for (d, p, m, v), xs in g.items():
        st = [x["stars"] for x in xs if x.get("stars")]
        lat = [x["latency_ms"] for x in xs if x.get("latency_ms")]
        ok = [x["dialect_ok"] for x in xs if x.get("dialect_ok") is not None]
        out.append({"dialect": d, "provider": p, "model": m, "voice": v, "n": len(xs),
                    "stars": round(sum(st) / len(st), 2) if st else None,
                    "latency_ms": int(sorted(lat)[len(lat) // 2]) if lat else None,
                    "dialect_ok": round(100 * sum(1 for o in ok if o) / len(ok)) if ok else None})
    return sorted(out, key=lambda r: (r["dialect"] or "", -(r["stars"] or 0)))
