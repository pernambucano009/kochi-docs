"""🗣️ لهجة العلامة في المحتوى: من خانة «اللغة واللهجة» في عقل العلامة، وإن كانت فارغة فمن السوق، وإن لم يُعرف فالفصحى البسيطة.
المحتوى الذي يُنشر (الأفكار والخطافات والنصوص والتعليقات النصية والإعلانات) بلهجة العلامة، والشروحات والتحليلات داخل البرنامج بالفصحى."""
import re

import dub

HINTS = (("نجد|رياض|القصيم", "ar-sa-najdi"), ("حجاز|جدة|جده|مكة|مكه|المدينة", "ar-sa-hijazi"), ("سعود|saudi|ksa", "ar-sa-najdi"),
         ("إمارات|امارات|دبي|أبوظبي|ابوظبي|uae|emirat", "ar-ae"), ("كويت|kuwait", "ar-kw"), ("قطر|qatar", "ar-qa"), ("بحرين|bahrain", "ar-bh"),
         ("عمان|عُمان|مسقط|oman", "ar-om"), ("خليج|gulf", "ar-gulf"), ("مصر|مصري|القاهرة|egypt", "ar-eg-cairo"),
         ("شام|سوري|لبنان|أردن|اردن|فلسطين|levant", "ar-levant"), ("عراق|iraq", "ar-iq"), ("سودان|sudan", "ar-sd"), ("مغرب|دارجة|morocc", "ar-ma"),
         ("جزائر|algeria", "ar-dz"), ("تونس|tunis", "ar-tn"), ("فصحى|فصحي|msa", "ar-msa"), (r"english|إنجليز|انجليز", "en"))
ANALYSIS = "اكتب الشرح والتحليل بالعربية الفصحى البسيطة"


def code(b: dict | None, extra: str = "") -> str:
    """اللغة أولًا (هي اختيار العميل)، وبعدها السوق، وإلا الفصحى."""
    b = b or {}
    for txt in (f"{b.get('language') or ''} {extra}", str(b.get("market") or "")):
        t = txt.lower()
        for pat, c in HINTS:
            if re.search(pat, t):
                return c
    return "ar-msa"


def name(b: dict | None, extra: str = "") -> str:
    """اسم اللهجة للموديل: نص العميل كما هو لو كتب لغة لا نعرفها، وإلا اسم اللهجة."""
    c = code(b, extra)
    raw = str((b or {}).get("language") or "").strip()
    if raw and c == "ar-msa" and not re.search("فصح|msa", raw.lower()):
        return raw[:80]
    if c == "en":
        return "English"
    d = dub.DIALECTS.get(c)
    return "العربية الفصحى البسيطة" if c == "ar-msa" or not d else d["label"].split(" ", 1)[-1]


def content(b: dict | None, extra: str = "") -> str:
    """سطر البرومبت: كل نص يُنشر بلهجة العلامة، مع دليل اللهجة إن وُجد."""
    c = code(b, extra)
    guide = dub.GUIDES.get(c)
    g = guide if isinstance(guide, str) else "".join(guide) if guide else ""
    return (f"كل نص يُنشر أو يُقال في المحتوى (الأفكار والخطافات والنصوص والتعليقات النصية ونصوص الإعلانات) يكون بهذه اللهجة: {name(b, extra)}"
            + (f": {g}" if g else "") + " لا تكتب بلهجة أخرى أبدًا.")

# للبرومبتات اللي معاها نص ملف العلامة بس: الشرح فصحى، والمحتوى المقترح بلهجة العلامة من ملفها
MIXED = ("اكتب الشرح والتحليل بالعربية الفصحى البسيطة، وأي نص محتوى مقترح (خطافات وأفكار وجمل تُقال أو تُكتب) بلغة العلامة ولهجتها "
         "كما في خانة «اللغة واللهجة» في ملفها، وإن لم تُحدد فاستنتجها من السوق، وإلا فالعربية الفصحى البسيطة")
