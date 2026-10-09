"""🌍 الدبلجة باللهجات العامية: الكلام بيتسمع، ويتحوّل للهجة (مصري / سعودي) بكلام طبيعي على قد وقت كل جملة،
وكل جملة بتتقال بصوت جاهز وتتحط في مكانها، والموسيقى والمؤثرات بتفضل (لو الصوت اتفصل)، والليب سينك اختياري."""
from __future__ import annotations

import re

# الأصوات اللي اتسمعت واتختارت (العينات اللي عجبت): ElevenLabs v3 (ليام / جيسيكا) وxAI (ريكس مصري)
VOICES = {
    "eleven_liam": {"label": "ليام (راجل) · ElevenLabs", "body": {"model": "elevenlabs/v3/text-to-speech", "voice": "Liam"}, "per_1k": 0.10},
    "eleven_jessica": {"label": "جيسيكا (ست) · ElevenLabs", "body": {"model": "elevenlabs/v3/text-to-speech", "voice": "Jessica"}, "per_1k": 0.10},
    "xai_rex": {"label": "ريكس (راجل) · xAI", "body": {"model": "xai/tts-v1", "voice": "rex"}, "per_1k": 0.015},
}
DIALECTS = {
    "eg": {"label": "🇪🇬 مصري", "lang": "ar-EG", "voices": ["eleven_liam", "eleven_jessica", "xai_rex"],
           "guide": ("عامية مصرية قاهرية طبيعية زي ما صناع المحتوى المصريين بيتكلموا في الفيديوهات. "
                     "استخدم كلام زي: بص، يعني، كده، دلوقتي، عشان، مش، إيه، ليه، إزاي، أوي، خالص، بقى، طب، يلا، هـ (للمستقبل: هقولك، هتلاقي)، "
                     "بـ (للمضارع: بيعمل، بتاكل)، ده/دي/دول. ممنوع الفصحى (سوف، لماذا، هذا، الذي، لكي، جدًا)."),
           "sample": "بص يا سيدي، أنا هقولك على حاجة بسيطة خالص"},
    "sa": {"label": "🇸🇦 سعودي", "lang": "ar-SA", "voices": ["eleven_liam", "eleven_jessica"],
           "guide": ("لهجة سعودية بيضاء (نجدية / الرياض) طبيعية زي ما صناع المحتوى السعوديين يتكلمون. "
                     "استخدم كلام مثل: وش، ليش، كيف، أبي/أبغى، مرة (بمعنى جدًا)، ترى، زين، كذا، الحين، عشان، بـ (للمستقبل: بقولك، بتلقى)، "
                     "هذا/هذي/ذولا، يا خوي، والله. ممنوع الفصحى (سوف، لماذا، الذي، لكي، جدًا) وممنوع الكلام المصري."),
           "sample": "اسمع يا خوي، بقولك شي بسيط مرة"},
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
    rows = []
    for i, ln in enumerate(lines):
        nxt = lines[i + 1]["s"] if i + 1 < len(lines) else total
        room = max(0.6, nxt - ln["s"] - 0.1)
        rows.append({"i": i, "seconds": round(room, 1), "max_chars": int(room * CHARS_PER_SEC), "text": ln["src"]})
    sys = (f"إنت كاتب دبلجة محترف. هتحوّل كلام فيديو (أي لغة) لـ {d['label']} عامي طبيعي جدًا، كأن الشخص نفسه بيتكلم باللهجة دي من الأول.\n"
           f"اللهجة: {d['guide']}\n"
           "القواعد:\n"
           "- نفس المعنى ونفس الإحساس والطاقة، مش ترجمة حرفية. الأمثال والهزار يتحولوا لحاجة مفهومة في اللهجة.\n"
           "- كل جملة لازم تتقال في الوقت بتاعها: متعداش max_chars حرف (لو الأصل طويل اختصر من غير ما المعنى يضيع).\n"
           "- نفس عدد الجمل بالظبط ونفس الترتيب، وكل جملة فيها اللي اتقال في الجملة دي بس.\n"
           "- الأسامي والماركات تفضل زي ما هي. الأرقام تتكتب بالكلام زي ما بتتنطق في اللهجة.\n"
           "- من غير تشكيل، ومن غير إيموجي، ومن غير أقواس أو شرح.\n"
           'رجّع JSON بس: {"lines": ["الجملة 1", "الجملة 2", ...]}')
    user = (f"{'عن الفيديو: ' + brief.strip() + chr(10) if brief.strip() else ''}"
            f"الجمل:\n{__import__('json').dumps(rows, ensure_ascii=False)}")
    return [{"role": "system", "content": sys}, {"role": "user", "content": user}]


def clean_line(s: str) -> str:
    s = re.sub(r"[ً-ْ]", "", str(s or ""))   # التشكيل
    return re.sub(r"\s+", " ", s).strip()[:600]


def tts_body(voice: str, dialect: str, text: str) -> dict:
    v = VOICES[voice]
    body = {**v["body"], "text": text}
    if body["model"].startswith("xai/"):
        body["language"] = DIALECTS[dialect]["lang"]
    return body


def estimate(lines: list[str], voice: str, seconds: float, lipsync: str | None) -> float:
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
