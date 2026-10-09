"""🌍 الدبلجة باللهجات العامية: الكلام بيتسمع، ويتحوّل للهجة (مصري / سعودي) بكلام طبيعي على قد وقت كل جملة،
وكل جملة بتتقال بصوت جاهز وتتحط في مكانها، والموسيقى والمؤثرات بتفضل (لو الصوت اتفصل)، والليب سينك اختياري."""
from __future__ import annotations

import re

# 🇸🇦🇪🇬 اللهجات العربية: فصيح (FasihTTS) — صوت راجل وست لكل لهجة، و«-2» أصوات HD
# 🌍 اللغات الأجنبية: ElevenLabs v3 على Atlas (الأصوات دي بتتكلم كل اللغات)
AR = [  # (المعرف عند فصيح، الاسم، البلد/الناس، أصوات زيادة HD)
    ("ar-eg-cairo", "🇪🇬 مصري", "مصر (القاهرة)", ["ar-eg-cairo-male-2"]),
    ("ar-sa-najdi", "🇸🇦 سعودي نجدي", "السعودية (الرياض ونجد)", []),
    ("ar-sa-hijazi", "🇸🇦 سعودي حجازي", "السعودية (جدة ومكة والحجاز)", []),
    ("ar-gulf", "🌊 خليجي عام", "الخليج", []),
    ("ar-ae", "🇦🇪 إماراتي", "الإمارات", []),
    ("ar-kw", "🇰🇼 كويتي", "الكويت", []),
    ("ar-qa", "🇶🇦 قطري", "قطر", []),
    ("ar-bh", "🇧🇭 بحريني", "البحرين", []),
    ("ar-om", "🇴🇲 عماني", "عمان", []),
    ("ar-levant", "🇱🇧 شامي", "الشام (سوريا ولبنان والأردن وفلسطين)", []),
    ("ar-iq", "🇮🇶 عراقي", "العراق", []),
    ("ar-sd", "🇸🇩 سوداني", "السودان", []),
    ("ar-ma", "🇲🇦 مغربي", "المغرب (الدارجة)", []),
    ("ar-dz", "🇩🇿 جزائري", "الجزائر", []),
    ("ar-tn", "🇹🇳 تونسي", "تونس", []),
    ("ar-msa", "📖 فصحى", "", ["ar-msa-formal-male-2"]),
]
FOREIGN = [  # (المعرف، الاسم، اسم اللغة للموديل)
    ("en", "🇺🇸 English", "natural conversational American English"),
    ("en-gb", "🇬🇧 English (UK)", "natural conversational British English"),
    ("fr", "🇫🇷 Français", "natural conversational French (France)"),
    ("es", "🇪🇸 Español", "natural conversational Spanish"),
    ("de", "🇩🇪 Deutsch", "natural conversational German"),
    ("it", "🇮🇹 Italiano", "natural conversational Italian"),
    ("pt", "🇧🇷 Português", "natural conversational Brazilian Portuguese"),
    ("tr", "🇹🇷 Türkçe", "natural conversational Turkish"),
    ("hi", "🇮🇳 हिन्दी", "natural conversational Hindi"),
    ("id", "🇮🇩 Indonesia", "natural conversational Indonesian"),
    ("ru", "🇷🇺 Русский", "natural conversational Russian"),
    ("ur", "🇵🇰 اردو", "natural conversational Urdu"),
]
ELEVEN = {"eleven_liam": ("ليام (راجل)", "Liam"), "eleven_jessica": ("جيسيكا (ست)", "Jessica"),
          "eleven_charlie": ("تشارلي (راجل)", "Charlie"), "eleven_bella": ("بيلا (ست)", "Bella")}

VOICES: dict[str, dict] = {k: {"label": f"{lab} · ElevenLabs", "provider": "eleven", "voice": v, "per_1k": 0.10} for k, (lab, v) in ELEVEN.items()}
DIALECTS: dict[str, dict] = {}
for code, label, where, hd in AR:
    vs = [f"{code if code != 'ar-msa' else 'ar-msa-formal'}{'-darija' if code == 'ar-ma' else '-gulf' if code == 'ar-ae' else ''}-{g}-1" for g in ("male", "female")]
    for v in vs + hd:
        VOICES[v] = {"label": f"{'راجل' if '-male-' in v else 'ست'}{' HD' if v.endswith('-2') else ''} · فصيح", "provider": "fasih", "voice": v,
                     "dialect": code, "per_1k": 0.0}
    DIALECTS[code] = {"label": label, "lang": code, "group": "ar", "voices": hd + vs, "where": where}
for code, label, lang in FOREIGN:
    DIALECTS[code] = {"label": label, "lang": code, "group": "foreign", "voices": list(ELEVEN), "language": lang}

GUIDES = {
    "ar-eg-cairo": ("عامية مصرية قاهرية طبيعية زي ما صناع المحتوى المصريين بيتكلموا. كلام زي: بص، يعني، كده، دلوقتي، عشان، مش، إيه، ليه، إزاي، أوي، خالص، "
                    "بقى، طب، يلا، هـ للمستقبل (هقولك)، بـ للمضارع (بيعمل)، ده/دي/دول. ممنوع الفصحى (سوف، لماذا، هذا، الذي، لكي، جدًا)."),
    "ar-sa-najdi": ("لهجة نجدية (الرياض) طبيعية زي صناع المحتوى السعوديين: وش، ليش، كيف، أبي/أبغى، مرة (بمعنى جدًا)، ترى، زين، كذا، الحين، عشان، "
                    "بـ للمستقبل (بقولك)، هذا/هذي/ذولا، يا خوي، والله. ممنوع الفصحى وممنوع الكلام المصري."),
    "ar-sa-hijazi": "لهجة حجازية (جدة ومكة) طبيعية: إيش، ليش، كدا، دحين، مرة، أبغى، حق (بمعنى بتاع)، يا شيخ، زي كدا. ممنوع الفصحى وممنوع المصري.",
    "ar-msa": "عربية فصحى سليمة وسهلة وقريبة من الناس زي التعليق الصوتي في الإعلانات، مش جامدة.",
}
CHARS_PER_SEC = 14.0      # كلام عربي عامي مريح تقريبًا
MAX_LINE = 9.0            # أطول جملة (ثواني) قبل ما تتقسم
LIPSYNC = {
    "sync": {"label": "Sync.so v3 (أحسن جودة)", "model": "sync/lipsync-v3", "per_sec": 0.22},
    "veed": {"label": "VEED (أرخص)", "model": "veed/lipsync", "per_sec": 0.013},
}


def lines_from_words(words: list[dict], sentences: list[list[int]]) -> list[dict]:
    """الجمل (بأوقاتها) من الكلام: الجملة الطويلة بتتقسم عند أطول وقفة جواها."""
    out = []

    def push(idx: list[int]):
        if not idx:
            return
        s, e = words[idx[0]]["s"], words[idx[-1]]["e"]
        if e - s > MAX_LINE and len(idx) > 3:
            gaps = [(words[idx[j + 1]]["s"] - words[idx[j]]["e"], j) for j in range(1, len(idx) - 2)]
            # أطول وقفة، وبنفضّل اللي في النص
            _, j = max(gaps, key=lambda g: g[0] - abs(g[1] - len(idx) / 2) * 0.01)
            push(idx[: j + 1])
            push(idx[j + 1:])
            return
        out.append({"s": round(s, 3), "e": round(e, 3), "src": " ".join(words[i]["w"] for i in idx)})
    for sent in sentences:
        push(sent)
    return out


def adapt_messages(dialect: str, lines: list[dict], total: float, brief: str = "") -> list[dict]:
    """رسايل الموديل اللي بيحوّل الكلام للهجة: نفس عدد الجمل، وكل جملة على قد وقتها."""
    d = DIALECTS[dialect]
    if d["group"] == "foreign":
        target, guide = d["language"], f"Write it the way native {d['language']} creators actually talk on social media: casual, natural, no stiff textbook phrasing."
    else:
        target = d["label"].split(" ", 1)[1] + " عامي" if dialect != "ar-msa" else "عربية فصحى"
        guide = GUIDES.get(dialect) or (f"اللهجة العامية في {d['where']} زي ما الناس هناك بيتكلموها فعلًا في الفيديوهات، بكلماتها وتعبيراتها المحلية. "
                                        "ممنوع الفصحى وممنوع لهجة بلد تاني.")
    rows = []
    for i, ln in enumerate(lines):
        nxt = lines[i + 1]["s"] if i + 1 < len(lines) else total
        room = max(0.6, nxt - ln["s"] - 0.1)
        rows.append({"i": i, "seconds": round(room, 1), "max_chars": int(room * CHARS_PER_SEC), "text": ln["src"]})
    sys = (f"إنت كاتب دبلجة محترف. هتحوّل كلام فيديو (أي لغة) لـ {target} طبيعي جدًا، كأن الشخص نفسه بيتكلم كده من الأول.\n"
           f"الأسلوب: {guide}\n"
           "القواعد:\n"
           "- نفس المعنى ونفس الإحساس والطاقة، مش ترجمة حرفية. الأمثال والهزار يتحولوا لحاجة مفهومة في اللهجة.\n"
           "- كل جملة لازم تتقال في الوقت بتاعها: متعداش max_chars حرف (لو الأصل طويل اختصر من غير ما المعنى يضيع).\n"
           "- نفس عدد الجمل بالظبط ونفس الترتيب، وكل جملة فيها اللي اتقال في الجملة دي بس.\n"
           "- الأسامي والماركات تفضل زي ما هي. الأرقام تتكتب بالكلام زي ما بتتنطق في اللهجة.\n"
           "- من غير تشكيل، ومن غير إيموجي، ومن غير أقواس أو شرح. الجمل بلغة الهدف بس.\n"
           'رجّع JSON بس: {"lines": ["الجملة 1", "الجملة 2", ...]}')
    user = (f"{'عن الفيديو: ' + brief.strip() + chr(10) if brief.strip() else ''}"
            f"الجمل:\n{__import__('json').dumps(rows, ensure_ascii=False)}")
    return [{"role": "system", "content": sys}, {"role": "user", "content": user}]


def clean_line(s: str) -> str:
    s = re.sub(r"[ً-ْ]", "", str(s or ""))   # التشكيل
    return re.sub(r"\s+", " ", s).strip()[:600]


def tts_body(voice: str, dialect: str, text: str) -> dict:
    """ElevenLabs على Atlas."""
    return {"model": "elevenlabs/v3/text-to-speech", "text": text, "voice": VOICES[voice]["voice"]}


def estimate(lines: list[str], voice: str, seconds: float, lipsync: str | None) -> float:
    """بالدولار (فصيح بيتحسب من باقة الدقايق عندهم، فمش داخل هنا)."""
    chars = sum(len(x) for x in lines)
    cost = chars / 1000 * VOICES[voice]["per_1k"]
    if lipsync in LIPSYNC:
        cost += seconds * LIPSYNC[lipsync]["per_sec"]
    return round(cost, 2)


def place(lines: list[dict], durs: list[float], total: float, max_speed: float = 1.25) -> list[dict]:
    """كل جملة بتبدأ في ميعادها، ولو صوتها أطول من مكانها بتتسرّع شوية (لحد 1.25)، ولو لسه أطول بتتأخر الجملة اللي بعدها."""
    out, prev_end = [], 0.0
    for i, (ln, d) in enumerate(zip(lines, durs)):
        nxt = lines[i + 1]["s"] if i + 1 < len(lines) else total
        start = max(ln["s"], prev_end + 0.06)
        room = max(0.3, nxt - start - 0.05)
        speed = min(max_speed, max(1.0, d / room)) if d > room else 1.0
        end = start + d / speed
        out.append({"start": round(start, 3), "speed": round(speed, 3), "end": round(end, 3)})
        prev_end = end
    return out
