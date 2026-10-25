"""🔎 مراجعة فيديو القالب قبل التسليم: الكلام المنطوق (اللي اتسمع فعلًا من التعليق الصوتي) ↔ خانات القالب ↔ الصورة.

كل قالب ليه قواعده (RULES): الأرقام اللي على الشاشة (أسعار، دقايق، تقييم) لازم تطابق اللي اتقال، والعدّاد يعدّ نفس الوقت
اللي اتقال، واسم المنتج اللي اتقال هو اللي على الشاشة، وصورة المنتج فعلًا صورة المنتج ده (فحص بالصورة في app.py).
- لو مفيش معطيات من العميل: الشاشة بتتظبط على الكلام (الدقايق، السعر الجديد).
- لو فيه معطيات من العميل: هي الصح، واللي مخالف بيتعلّم ملاحظة واضحة (والنص بيتكتب من جديد في المحاولة الجاية).
"""
from __future__ import annotations

import re

_DIG = str.maketrans("٠١٢٣٤٥٦٧٨٩٫،", "0123456789.,")
_WORDS = {
    "واحد": 1, "وحدة": 1, "اثنين": 2, "إثنين": 2, "اثنان": 2, "ثنين": 2, "ثلاث": 3, "ثلاثة": 3, "تلات": 3, "تلاتة": 3, "أربع": 4, "أربعة": 4, "اربعة": 4,
    "خمس": 5, "خمسة": 5, "ست": 6, "ستة": 6, "سبع": 7, "سبعة": 7, "ثمان": 8, "ثمانية": 8, "ثماني": 8, "تمانية": 8, "تسع": 9, "تسعة": 9, "عشر": 10, "عشرة": 10,
    "عشرين": 20, "عشرون": 20, "ثلاثين": 30, "ثلاثون": 30, "تلاتين": 30, "أربعين": 40, "اربعين": 40, "خمسين": 50, "ستين": 60, "سبعين": 70,
    "ثمانين": 80, "تمانين": 80, "تسعين": 90, "مية": 100, "مئة": 100, "مائة": 100, "ميتين": 200, "مئتين": 200, "ألف": 1000, "الف": 1000,
}
# مدد بالكلام → دقايق
_SPANS = [(r"نص(?:ف)?\s*ساع[ةه]", 30), (r"ربع\s*ساع[ةه]", 15), (r"ساعتين", 120), (r"ساعة\s*و\s*نص(?:ف)?", 90), (r"(?<![\d\s])ساع[ةه](?!\s*و)", 60)]


def numbers(text: str) -> list[float]:
    """كل الأرقام في الكلام: بالأرقام (89، ٨٩) وبالكلمات البسيطة (تسعة وثمانين = 89)."""
    t = str(text or "").translate(_DIG)
    out = [float(x.replace(",", "")) for x in re.findall(r"\d+(?:[.,]\d+)?", t)]
    toks = re.findall(r"[؀-ۿ]+", t)
    cur, have = 0, False
    for w in toks + ["."]:
        w2 = next((w[i:] for i in (0, 1, 2) if w[i:] in _WORDS and (i == 0 or w[:i] in ("و", "ب", "ل", "وب", "بـ"))), w)
        if w2 in _WORDS:
            v = _WORDS[w2]
            cur = cur * v if v == 1000 and cur else cur + v
            have = True
        elif have:
            out.append(float(cur))
            cur, have = 0, False
    return out


def minutes(text: str) -> list[int]:
    """المدد المذكورة بالدقايق: «30 دقيقة»، «نص ساعة»، «ساعتين»، «2 ساعة»."""
    t = str(text or "").translate(_DIG)
    out = [int(float(m)) for m in re.findall(r"(\d+(?:\.\d+)?)\s*(?:دقيقة|دقائق|دقايق|د\b|min)", t)]
    out += [int(float(m) * 60) for m in re.findall(r"(\d+(?:\.\d+)?)\s*(?:ساعة|ساعات|ساعه|hours?)", t)]
    for pat, v in _SPANS:
        if re.search(pat, t):
            out.append(v)
    for w, v in _WORDS.items():   # «ثلاثين دقيقة»
        if re.search(rf"\b{w}\s*(?:دقيقة|دقائق|دقايق)", t):
            out.append(v)
    return sorted(set(out))


def _n(v) -> float | None:
    m = re.search(r"\d+(?:\.\d+)?", str(v or "").translate(_DIG))
    return float(m.group()) if m else None


def _issue(what: str, detail: str, fix: dict | None = None) -> dict:
    return {"what": what, "detail": detail, "fix": fix or {}}


def check(tpl: str, params: dict, spoken: str, facts: dict | None = None) -> list[dict]:
    """قواعد القالب: يرجّع الملاحظات، وكل ملاحظة ليها تصليح للخانات (لو ينفع يتصلح من غير ما الكلام يتغير)."""
    p, sp, facts = params or {}, spoken or "", facts or {}
    nums, mins = numbers(sp), minutes(sp)
    out: list[dict] = []
    near = lambda a, b: a is not None and b is not None and abs(a - b) < 0.51  # noqa: E731

    def said(v):
        x = _n(v)
        return x is None or any(near(x, y) for y in nums)

    if tpl == "t-price":
        old, new = _n(p.get("oldPrice")), _n(p.get("newPrice"))
        if new is None:
            out.append(_issue("السعر", "لا يوجد سعر بعد الخصم على الشاشة"))
        if old is not None and new is not None and old <= new:
            out.append(_issue("السعر", "السعر القديم ليس أكبر من الجديد، فلا يوجد خصم يُعرض", {"oldPrice": "", "showSave": "false"}))
        if new is not None and nums and not said(new):
            out.append(_issue("السعر", f"الشاشة تعرض {int(new)} لكن التعليق الصوتي لم يذكره"))
        show = str(p.get("showCd", "true")).lower() not in ("false", "0", "")
        if show:
            screen = int(_n(p.get("mins")) or 0) or (int(_n(p.get("hours")) or 0) * 60 + 45)
            if mins and screen not in mins:
                if facts.get("cdMins"):
                    out.append(_issue("العدّاد", f"العدّاد يعد {screen} دقيقة والكلام يذكر {mins[0]} دقيقة"))
                else:
                    out.append(_issue("العدّاد", f"العدّاد كان سيعد {screen} دقيقة والكلام يذكر {mins[0]} دقيقة: ضُبط على الكلام", {"mins": str(mins[0])}))
            elif not mins and not facts.get("cdMins"):
                out.append(_issue("العدّاد", "الكلام لم يذكر أي مدة، فأُخفي العدّاد بدل عرض وقت غير حقيقي", {"showCd": "false"}))
    elif tpl == "t-map":
        eta = int(_n(p.get("eta")) or 0)
        if mins and eta and eta not in mins:
            fix = {} if facts.get("eta") else {"eta": str(mins[0])}
            out.append(_issue("وقت التوصيل", f"العدّاد على الخريطة {eta} دقيقة والكلام يذكر {mins[0]} دقيقة" + ("" if facts.get("eta") else ": ضُبط على الكلام"), fix))
    elif tpl == "t-review":
        r = _n(p.get("rating"))
        if r is not None and nums and any(0 < y <= 5 for y in nums) and not said(r):
            out.append(_issue("التقييم", f"التقييم على الشاشة {r} ولا يطابق الرقم المذكور في الكلام"))
    elif tpl == "t-shopfloat":
        for k in ("price1", "price2"):
            if p.get(k) and nums and not said(p[k]):
                out.append(_issue("السعر", f"سعر «{p.get('name' + k[-1], '')}» على الشاشة ({p[k]}) لم يُذكر في الكلام"))
    elif tpl == "t-chart":
        vals = [_n(str(x).split("|")[-1]) for x in p.get("data") or []]
        if nums and vals and max(v for v in vals if v is not None) not in nums and not facts.get("data"):
            out.append(_issue("الأرقام", "أعلى رقم في الرسم لا يطابق أي رقم ذُكر في الكلام"))
    # عام: اسم المنتج اللي على الشاشة لازم يكون هو اللي اتقال (لو الكلام ذكر منتج)
    for k in ("product", "name1"):
        name = str(p.get(k) or "").strip()
        if name and len(name) > 2 and sp and not any(w in sp for w in re.findall(r"[؀-ۿ]{3,}", name)):
            out.append(_issue("اسم المنتج", f"«{name}» على الشاشة لكنه لم يُذكر في الكلام"))
    return out


def apply_fixes(params: dict, issues: list[dict]) -> dict:
    p = dict(params or {})
    for i in issues:
        p.update(i.get("fix") or {})
    return p


def image_prompt(product: str) -> str:
    return (f"This image is used as the product picture in an ad for «{product}». Does it clearly show that product (or that kind of dish/item)? "
            'Answer JSON only: {"match": true|false, "shows": "what the image shows in 3-6 Arabic words"}')
