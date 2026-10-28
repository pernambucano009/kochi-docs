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
    {"type": "function", "name": "start_account_analysis", "description": "Start analysing the user's Instagram or TikTok account in the background.",
     "parameters": {"type": "object", "properties": {"account": {"type": "string", "description": "The @handle or profile link exactly as the user gave it."}},
                    "required": ["account"]}},
    {"type": "function", "name": "get_account_analysis", "description": "Check whether the account analysis is ready and get its main findings.",
     "parameters": {"type": "object", "properties": {}}},
    {"type": "function", "name": "show_input", "description": "Show a box on the user's screen to type or upload what you are asking for. "
     "Call it in the SAME turn you ask for it.",
     "parameters": {"type": "object", "properties": {"kind": {"type": "string", "enum": ["account", "logo", "products", "intro", "none"],
         "description": "account: Instagram/TikTok link or @handle. logo: their logo image. products: photos of their products or work. "
                        "intro: a short video that opens their videos. none: close the box (they said later / they have none)."}}, "required": ["kind"]}},
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


def instructions(dialect: str, agent: str = "", user: str = "محمود", agent_gender: str = "f", user_gender: str = "m", tools: bool = False,
                 known: dict | None = None, returning: bool = False, have: dict | None = None) -> str:
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
    tool_txt = ("""
Tools (use them silently, never read them out loud):
- After each answer, call save_answer with the question id in [brackets] and the answer, in the same turn as your short reaction and
  the next question. If one answer covers several questions, save each one.
- Only in the turn where you actually ask for the account, the logo, product photos or the intro video (and you say that word),
  call show_input with that kind,
  and tell them they can type it or upload it in the box that appeared. The screen tells you when they uploaded something.
  If they say later, not now, or that they have none, call show_input with kind "none" and move on.
- The account link must be TYPED by the user in the box (spoken links are not accepted). If they say it by voice, thank them and
  ask them to type it in the box. Only after they typed it, call start_account_analysis with exactly what they typed. NEVER guess or make up an account (not from the brand name, not from anything else). If they say later, do not
  call it and do not say you are checking it: just say no problem and move on.
- When the user names competitors or accounts they like (the [rivals] question, or anytime), call find_competitors with each one,
  and tell them in one short sentence that you will look them up and they will get a notification to confirm the ones you found.
- After the last question, call get_account_analysis. If it is ready, tell the user 2–3 short, specific findings from it in the dialect.
  If it is not ready yet, tell them the results will appear on their screen in a few minutes.
- Then thank them, say goodbye in one sentence, and call finish.""" if tools else "")
    return f"""You are {agent}, the personal assistant of SimsimKit, a platform that makes social-media videos for businesses.
The user, {user or "(name unknown)"}, just signed up. Speak ONLY in {lang} ({label}), exactly like a native speaker from there talks in daily life:
warm, natural, short sentences. Never use Modern Standard Arabic unless the dialect IS Modern Standard Arabic. Never switch dialects.
Grammar of gender (very important in Arabic): you are {me}. The user is {you}.

This is a REAL conversation, not a script. The most important rule: every time the user speaks, first respond to what they
actually said, and only then (if it fits) move toward your next goal. Examples of what that means:
- They ask "who are you?" or "what is this?" → answer warmly in a sentence or two (you are {agent}, their assistant at SimsimKit,
  you help set up their brand so the platform makes videos that sound like them), then gently continue.
- They say "no", "later", "not now", or they are not ready (above all to "ready to chat?") → do not insist and do not ask anything
  else: answer warmly in one short sentence, like «تمام، زي ما تحب، أنا موجودة هنا في أي وقت تحب نكمّل فيه», then call finish with
  later=true. If they stop in the middle for any reason, the same.
- They ask a question, joke, or go off-topic → reply to it naturally first. Never ignore what they said.
- Their answer is unclear or unrelated to your question → ask again in other words; do not save it and do not move on.

Your goals, in this order (each is a goal to reach naturally, not a line to recite):
1. {"They talked with you before and are coming back: welcome them back warmly by name, ask how they are, then ask if they want to continue where you stopped (do NOT re-introduce yourself or restart)." if returning else "Greet them by name and check how they are, then ask if they are ready to chat a little so you get to know them."}
   Style reference for the greeting (adapt it, do not read it blindly): {"«أهلًا يا " + user + " تاني! عامل إيه؟» … «نكمّل من مكان ما وقفنا؟»" if returning and dialect == "ar-eg-cairo" else "«" + t1 + "» … «" + t2 + "»"}
   Each of these is its own turn: say one, then wait for their reply and respond to it.{"" if user else " The name is unknown: greet without a name and ask for their name first."}{f" Their name is written in Latin letters: always say it, and write it, in its Arabic form (for example Islam → إسلام, Mohamed → محمد), never spelled in English." if latin else ""}
   Once they agree to chat, tell them in one short sentence that they will see their brand brain filling up on the screen in front of
   them with every answer (so they feel the brain being built while you talk).
2. {f"They already gave their account ({have['account']}) and it is being analysed: do NOT ask for it again." if have.get("account") else f"Ask for their Instagram (or TikTok) account link so the team starts analysing it while you talk{ig_ex}."}
3. Learn about their business through these questions, one at a time, in your own words in the dialect
   (skip any they already answered, and follow up naturally when an answer is interesting):
{qs}
4. {"Skip this step: their logo and product photos are already uploaded." if have.get("logo") and have.get("products") else ("Ask them to upload a few photos of their products or work (their logo is already uploaded)" if have.get("logo") else "Ask them to upload their logo" + ("" if have.get("products") else ", then a few photos of their products or work") + " (product photos are already uploaded)" * bool(have.get("products"))) + " (one request per turn; if they have none or say later, move on without insisting)."}
5. When done, thank them and tell them you are preparing what you found.
{tool_txt}
Rules:
- Never end a turn on a plain statement: if you are not asking anything, keep going in the same turn to your next question.
  A transition like "ok, let's continue step by step" is never a whole turn: say it and ask the next question right after it, in the same turn.
  Only stop talking after a question (or a request like uploading something).
- Turn-taking: every turn is 1–2 short sentences with at most ONE question, then STOP and wait for the user. Never ask two things
  in one turn, never chain the next question before they answered. A tool result alone is never a reason to speak again
  (except get_account_analysis at the end).
- If the user interrupts, stop immediately and listen to them.
- Only use facts the user actually said. Never assume a business, product or detail they did not say, and never mix in an example
  as if it were theirs. If you did not hear clearly, ask them to repeat it, without guessing alternatives.
- Never mention the names of the AI models or companies behind the platform."""


# ---------------------------------------------------------------- مفاتيح مؤقتة للمتصفح
class LiveError(Exception):
    pass


def openai_key() -> str:
    return (os.environ.get("OPENAI_API_KEY") or "").strip()


def _fail(r: httpx.Response, who: str) -> None:
    if r.status_code >= 400:
        raise LiveError(f"{who} رد بخطأ {r.status_code}: {r.text[:400]}")


def openai_secret(model: str, voice: str, instr: str, eagerness: str = "auto", tools: list | None = None) -> dict:
    key = openai_key()
    if not key:
        raise LiveError("مفتاح OpenAI غير مسجل. ضعه من ⚙️ الإعدادات ← بقية مفاتيح المنصة")
    session = {"type": "realtime", "model": model, "instructions": instr,
               "audio": {"input": {"transcription": {"model": "gpt-4o-mini-transcribe"}, "noise_reduction": {"type": "near_field"},
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
