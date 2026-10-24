"""🌍 الدبلجة باللهجات العامية: الكلام بيتسمع، ويتحوّل للهجة (مصري / سعودي) بكلام طبيعي على قد وقت كل جملة،
وكل جملة بتتقال بصوت جاهز وتتحط في مكانها، والموسيقى والمؤثرات بتفضل (لو الصوت اتفصل)، والليب سينك اختياري."""
from __future__ import annotations

import re

# 🇸🇦🇪🇬 اللهجات العربية: فصيح (FasihTTS) بأصوات HD بس («-2»، الواجهة الجديدة). الأصوات القديمة «-1» صوتها أوحش وبتلخبط اللهجة.
# كل لهجة ليها صوتين ثابتين (عمر وليلى)، والأصوات التانية (سامي وزيد ورامي وهالة ونور وسلمى) بتيجي من كتالوج فصيح (merge_fasih).
# 🌍 اللغات الأجنبية: ElevenLabs v3 على Atlas (الأصوات دي بتتكلم كل اللغات)
AR = [  # (معرف اللهجة عند فصيح، الاسم، البلد/الناس، أول جزء من معرف الصوت، ثابتة ولا تجريبية)
    ("ar-eg-cairo", "🇪🇬 مصري", "مصر (القاهرة)", "ar-eg-cairo", True),
    ("ar-sa-najdi", "🇸🇦 سعودي نجدي", "السعودية (الرياض ونجد)", "ar-sa-najdi", False),
    ("ar-sa-hijazi", "🇸🇦 سعودي حجازي", "السعودية (جدة ومكة والحجاز)", "ar-sa-hijazi", False),
    ("ar-gulf", "🌊 خليجي عام", "الخليج", "ar-gulf", True),
    ("ar-ae", "🇦🇪 إماراتي", "الإمارات", "ar-ae-gulf", False),
    ("ar-kw", "🇰🇼 كويتي", "الكويت", "ar-kw", False),
    ("ar-qa", "🇶🇦 قطري", "قطر", "ar-qa", False),
    ("ar-bh", "🇧🇭 بحريني", "البحرين", "ar-bh", False),
    ("ar-om", "🇴🇲 عماني", "عمان", "ar-om", False),
    ("ar-levant", "🇱🇧 شامي", "الشام (سوريا ولبنان والأردن وفلسطين)", "ar-levant", False),
    ("ar-iq", "🇮🇶 عراقي", "العراق", "ar-iq", False),
    ("ar-sd", "🇸🇩 سوداني", "السودان", "ar-sd", False),
    ("ar-ma", "🇲🇦 مغربي", "المغرب (الدارجة)", "ar-ma-darija", False),
    ("ar-dz", "🇩🇿 جزائري", "الجزائر", "ar-dz", False),
    ("ar-tn", "🇹🇳 تونسي", "تونس", "ar-tn", False),
    ("ar-msa", "📖 فصحى", "", "ar-msa-formal", True),
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
ELEVEN = {"eleven_liam": ("ليام (رجل)", "Liam"), "eleven_jessica": ("جيسيكا (امرأة)", "Jessica"),
          "eleven_charlie": ("تشارلي (رجل)", "Charlie"), "eleven_bella": ("بيلا (امرأة)", "Bella")}

FASIH_PER_MIN = 0.19   # باقة فصيح: ١٠٠ دقيقة بـ $19
VOICES: dict[str, dict] = {k: {"label": lab, "provider": "eleven", "voice": v, "per_1k": 0.10} for k, (lab, v) in ELEVEN.items()}
DIALECTS: dict[str, dict] = {}
for code, label, where, base, stable in AR:
    vs = []
    for g, name in (("male", "عمر (رجل)"), ("female", "ليلى (امرأة)")):
        v = f"{base}-{g}-2"
        VOICES[v] = {"label": name + ("" if stable else " · تجريبي"), "provider": "fasih", "voice": v, "dialect": code,
                     "gender": g, "per_1k": 0.0, "per_min": FASIH_PER_MIN}
        # المشاريع القديمة اللي اتحفظ فيها الصوت القديم «-1» بتتقال بالصوت الـ HD اللي زيه
        VOICES[f"{base}-{g}-1"] = {**VOICES[v], "hidden": True}
        vs.append(v)
    DIALECTS[code] = {"label": label, "lang": code, "group": "ar", "voices": vs, "where": where}
for code, label, lang in FOREIGN:
    DIALECTS[code] = {"label": label, "lang": code, "group": "foreign", "voices": list(ELEVEN), "language": lang}

def merge_fasih(voices: list[dict]) -> int:
    """بيضيف أصوات كتالوج فصيح (GET /v1/voices) للهجاتها: HD ونشطة بس، وصوت كل لهجة لازم يتبعت بنفس dialectId بتاعه."""
    added = 0
    for x in voices or []:
        vid, dia = str(x.get("id") or ""), str(x.get("dialectId") or "")
        if not vid.endswith("-2") or dia not in DIALECTS or DIALECTS[dia]["group"] != "ar" or (x.get("lifecycle") or "active") != "active":
            continue
        g = "female" if str(x.get("gender") or "").lower().startswith("f") else "male"
        name = x.get("arabicName") or x.get("name") or vid
        lab = (f"🎨 {name} (صوتك الخاص)" if x.get("custom") else
               f"{name} ({'امرأة' if g == 'female' else 'رجل'})" + (" · تجريبي" if x.get("status") == "preview" else ""))
        if vid in VOICES and not VOICES[vid].get("hidden"):
            VOICES[vid]["label"] = lab
        else:
            VOICES[vid] = {"label": lab, "provider": "fasih", "voice": vid, "dialect": dia, "gender": g, "per_1k": 0.0,
                           "per_min": FASIH_PER_MIN, "sample": x.get("sampleUrl") or ""}
        if vid not in DIALECTS[dia]["voices"]:
            # الصوت الخاص بيبقى أول اختيار في لهجته
            DIALECTS[dia]["voices"].insert(0, vid) if x.get("custom") else DIALECTS[dia]["voices"].append(vid)
            added += 1
    return added


# 🗣️ منصت للهجات الخليجية: كل صوت بيروح للهجته من الـ id أو الوصف، وبيبقى أول اختيار فيها (فصيح بيفضل بعده).
# الفصحى مش من منصت (هتبقى SILMA)، والصوت اللي لهجته مش معروفة بيروح للخليجي العام.
MUNSIT_PER_1K = 0.08   # باقة منصت: 200 ألف كريدت بـ $8، وكل 1000 كريدت ≈ 500 حرف
MUNSIT_HINTS = (("najd", "ar-sa-najdi"), ("hijaz", "ar-sa-hijazi"), ("uae", "ar-ae"), ("emira", "ar-ae"), ("kuwai", "ar-kw"), ("-kw-", "ar-kw"),
                ("qatar", "ar-qa"), ("bahrain", "ar-bh"), ("oman", "ar-om"), ("saudi", "ar-sa-najdi"), ("-sa-", "ar-sa-najdi"), ("gulf", "ar-gulf"), ("khaleej", "ar-gulf"))


def munsit_dialect(x: dict) -> str | None:
    txt = " ".join(str(x.get(k) or "") for k in ("voice_id", "id", "description", "dialect", "accent")).lower() + " " + " ".join(map(str, x.get("languages") or [])).lower()
    if any(w in txt for w in ("fusha", "msa", "formal", "modern standard")) and not any(h in txt for h, _ in MUNSIT_HINTS):
        return None
    return next((d for h, d in MUNSIT_HINTS if h in txt), "ar-gulf")


def merge_munsit(voices: list[dict]) -> int:
    added = 0
    for x in voices or []:
        vid = str(x.get("voice_id") or x.get("id") or "")
        dia = munsit_dialect(x)
        if not vid or not dia or dia not in DIALECTS:
            continue
        key = f"munsit:{vid}"
        g = "female" if str(x.get("gender") or "").lower().startswith(("f", "w")) else "male"
        name = x.get("name") or vid
        VOICES[key] = {"label": f"{name} ({'امرأة' if g == 'female' else 'رجل'})", "provider": "munsit", "voice": vid, "dialect": dia, "gender": g,
                       "per_1k": MUNSIT_PER_1K}
        if key not in DIALECTS[dia]["voices"]:
            # أصوات منصت قبل أصوات فصيح في لهجتها (بالترتيب اللي جت بيه)
            at = sum(1 for v in DIALECTS[dia]["voices"] if VOICES.get(v, {}).get("provider") == "munsit")
            DIALECTS[dia]["voices"].insert(at, key)
            added += 1
    return added


# ✅ المزوّد المعتمد لكل لهجة بعد تقييم صاحب المنصة في مختبر الأصوات (ومعه أهل اللهجة):
# أصواته تصبح أول اختيار في لهجتها في كل البرنامج (التعليق الصوتي، الدبلجة، القوالب، الأفاتار). أي لهجة تُعتمد تُضاف هنا.
APPROVED: dict[str, str] = {
    "ar-sd": "fasih",   # السوداني: فصيح (تقييم ٢٤ أكتوبر ٢٠٢٦)
}


def apply_approved() -> None:
    """أصوات المزوّد المعتمد أولًا في لهجتها (بنفس ترتيبها)، والباقي بعدها."""
    for dia, prov in APPROVED.items():
        d = DIALECTS.get(dia)
        if not d:
            continue
        vs = d["voices"]
        d["voices"] = [v for v in vs if VOICES.get(v, {}).get("provider") == prov] + [v for v in vs if VOICES.get(v, {}).get("provider") != prov]


apply_approved()


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
    "sync": {"label": "ليب سينك احترافي (أجود وأغلى)", "model": "sync/lipsync-v3", "per_sec": 0.22},
    "veed": {"label": "ليب سينك عادي", "model": "veed/lipsync", "per_sec": 0.013},
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
    """بالدولار: الصوت (ElevenLabs بالحرف، فصيح بالدقيقة) + الليب سينك لو مطلوب."""
    chars = sum(len(x) for x in lines)
    cost = chars / 1000 * VOICES[voice]["per_1k"] + seconds / 60 * VOICES[voice].get("per_min", 0)
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
