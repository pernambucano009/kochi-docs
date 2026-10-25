"""🧾 فكرة الإعلان ومعطياته لكل قالب كود: قبل أول فيديو (وأي فيديو من القالب) البرنامج يشرح للعميل الإعلان بكلام بسيط
(«هنعمل لك إعلان عن طبق من قائمتكم بسعر مخفّض…») ثم يطلب منه المعطيات الحقيقية فقط (اسم الطبق، السعر القديم والجديد، مدة العرض، صورة).

- ask: الخانات اللي العميل بيملاها (حقائق مش كلام إعلاني). العقل بيكتب الباقي (الخطاف، الجمل، الدعوة) حواليها.
- apply(): المعطيات ← خانات القالب، وبتتقفل: العقل مايغيّرهاش، والتعليق الصوتي لازم يقول نفس الأرقام.
- check(): بعد ما الفيديو يتعمل، مراجعة القالب نفسه (videoqa.py) بتقارن الكلام المنطوق بالمعطيات دي.
"""
from __future__ import annotations

import re

# 🏷️ اسم «الحاجة» اللي بنعلن عنها حسب المجال: طبق من قائمة مطعمكم، منتج من متجركم…
NOUNS = {
    "food": ("طبق", "قائمة مطعمكم", "الطبق"), "beauty": ("خدمة", "خدمات صالونكم", "الخدمة"),
    "ecom": ("منتج", "متجركم", "المنتج"), "realestate": ("عقار", "عقاراتكم", "العقار"),
    "edu": ("دورة", "دوراتكم", "الدورة"), "fitness": ("اشتراك", "ناديكم", "الاشتراك"),
    "home": ("خدمة", "خدماتكم", "الخدمة"), "shops": ("منتج", "محلكم", "المنتج"),
}
DEFAULT_NOUN = ("منتج", "منتجاتكم", "المنتج")


def noun(field: str) -> tuple[str, str, str]:
    return NOUNS.get(field or "", DEFAULT_NOUN)


def _q(key, label, kind="text", ph="", req=True, **kw):
    return {"key": key, "label": label, "kind": kind, "ph": ph, "req": req, **kw}


# {n} = طبق، {from} = قائمة مطعمكم، {the} = الطبق
BRIEFS: dict[str, dict] = {
    "t-price": {
        "idea": "سنصنع لك إعلانًا عن {n} من {from} بسعر مخفّض: السعر القديم يُشطب ويظهر الجديد، ثم عدّاد للوقت الذي تحدده.",
        "ask": [
            _q("product", "اسم {the}", ph="مثال: مندي لحم عائلي", max=20),
            _q("img", "صورة {the}", "image", req=False, hint="صورة واضحة، والأفضل بلا خلفية. إن لم ترفعها نرسم {the} بنفس شكل القالب."),
            _q("oldPrice", "السعر قبل الخصم", "num", ph="مثال: 120"),
            _q("newPrice", "السعر بعد الخصم", "num", ph="مثال: 89"),
            _q("cdKind", "العدّاد في الإعلان", "choice", opts=[["offer", "مدة العرض"], ["delivery", "وقت التوصيل"], ["none", "بدون عدّاد"]], value="offer"),
            _q("cdMins", "المدة بالدقائق", "num", ph="مثال: 30 دقيقة، أو 120 لساعتين", req=False, show_if=["cdKind", ["offer", "delivery"]]),
        ],
    },
    "t-chat": {
        "idea": "سنصنع لك محادثة قصيرة بين عميل و{brand} على الجوال، تنتهي بتأكيد طلب {n} من {from}.",
        "ask": [
            _q("item", "ماذا يطلب العميل في المحادثة؟", ph="مثال: مندي دجاج لأربعة أشخاص", max=40),
            _q("eta", "متى يصل الطلب أو موعد الحجز؟", ph="مثال: خلال 45 دقيقة", max=24),
            _q("pay", "طريقة الدفع", ph="مثال: الدفع عند الاستلام", req=False, max=24),
        ],
    },
    "t-map": {
        "idea": "سنصنع لك إعلان توصيل: الطلب يخرج من فرعكم على الخريطة ويصل للعميل خلال الوقت الذي تحدده.",
        "ask": [
            _q("store", "اسم الفرع الذي يخرج منه الطلب", ph="مثال: فرع العليا", max=16),
            _q("areas", "خمسة أحياء أو مدن توصلون لها فعلًا", "lines", ph="حي في كل سطر", count=5, max=14),
            _q("eta", "وقت التوصيل بالدقائق", "num", ph="مثال: 30"),
        ],
    },
    "t-review": {
        "idea": "سنصنع لك إعلانًا بآراء عملائكم الحقيقية وتقييمكم، بأسماء أصحابها (بإذنهم).",
        "ask": [
            _q("q1", "رأي عميل حقيقي", "textarea", ph="انسخه كما كتبه العميل", max=70),
            _q("n1", "اسم صاحب الرأي", ph="الاسم الأول وأول حرف من العائلة، مثال: سارة م.", max=14),
            _q("q2", "رأي ثانٍ أقصر", "textarea", ph="جملة واحدة", max=70),
            _q("n2", "اسم صاحب الرأي الثاني", max=14),
            _q("rating", "متوسط تقييمكم من 5", "num", ph="مثال: 4.8", req=False),
            _q("count", "عدد التقييمات", "num", ph="مثال: 350", req=False),
            _q("verified", "هل الرأيان من مشترين فعليين؟", "choice", opts=[["1", "نعم"], ["0", "لا"]], value="1"),
        ],
    },
    "t-show": {
        "idea": "سنصنع لك مسابقة قصيرة: سؤال إجابته الصحيحة {the} أو ميزته، والفائز يحصل على جائزة حقيقية منكم.",
        "ask": [
            _q("answer", "الإجابة الصحيحة: ما الذي يميزكم؟", ph="مثال: توصيل خلال 30 دقيقة", max=12),
            _q("prize", "الجائزة الحقيقية للمتفاعلين", ph="مثال: توصيل مجاني لأول طلب", max=26),
        ],
    },
    "t-flow": {
        "idea": "سنصنع لك شرحًا مرسومًا لخطوات خدمتكم من أول طلب حتى النتيجة التي يحصل عليها العميل.",
        "ask": [
            _q("steps", "الخطوات (من 3 إلى 5)", "lines", ph="خطوة في كل سطر، مثال: احجز موعدك", count=[3, 5], max=24),
            _q("result", "النتيجة التي يحصل عليها العميل", ph="مثال: بيت نظيف خلال ساعتين", max=26),
        ],
    },
    "t-board": {
        "idea": "سنصنع لك سبورة مرسومة: مشكلة يعرفها عميلكم، وثلاث خطوات لحلها، والنتيجة.",
        "ask": [
            _q("problem", "المشكلة أو السؤال", ph="مثال: كيف تحافظ على بشرتك في الصيف؟", max=20),
            _q("steps", "ثلاث خطوات للحل", "lines", ph="خطوة في كل سطر", count=3, max=16),
            _q("result", "النتيجة", ph="مثال: بشرة صحية", max=16),
        ],
    },
    "t-flipcards": {
        "idea": "سنصنع لك رسالة على ثلاث بطاقات تنقلب، وعلى كل بطاقة صورة من {from}.",
        "ask": [
            _q("img1", "صورة البطاقة الأولى", "image", req=False),
            _q("img2", "صورة البطاقة الثانية", "image", req=False),
            _q("img3", "صورة البطاقة الثالثة", "image", req=False),
            _q("msg", "الرسالة التي تريد إيصالها", ph="مثال: جلستك الأولى بنصف السعر هذا الأسبوع", max=60),
        ],
    },
    "t-shopfloat": {
        "idea": "سنصنع لك عرضًا لمنتجين من {from} بصورهما وأسعارهما، مع زر الطلب.",
        "ask": [
            _q("name1", "اسم المنتج الأول", ph="مثال: فازة سيراميك", max=18),
            _q("price1", "سعره", "num"),
            _q("img1", "صورته", "image", req=False, hint="إن لم ترفعها نرسمه بنفس شكل القالب."),
            _q("name2", "اسم المنتج الثاني", max=18),
            _q("price2", "سعره", "num"),
            _q("img2", "صورته", "image", req=False),
        ],
    },
    "t-count": {
        "idea": "سنصنع لك عدًّا تنازليًا يشد الانتباه، وعند الصفر يظهر عرضكم.",
        "ask": [
            _q("offer", "ما العرض بالتفصيل؟", ph="مثال: خصم 30٪ على كل الأحذية", max=34),
            _q("until", "متى ينتهي العرض؟", ph="مثال: نهاية الأسبوع", req=False, max=20),
        ],
    },
    "t-chart": {
        "idea": "سنصنع لك رسمًا بيانيًا متحركًا بأرقامكم الحقيقية، ينتهي بالنتيجة الكبيرة.",
        "ask": [
            _q("what", "ماذا تقيس الأرقام؟", ph="مثال: عدد العملاء", max=20),
            _q("data", "الأرقام (من 3 إلى 8)", "lines", ph="الفترة|الرقم في كل سطر، مثال: يناير|120", count=[3, 8], pair=True),
            _q("unit", "الوحدة", ph="مثال: عميل", req=False, max=16),
        ],
    },
    "t-pictogram": {
        "idea": "سنصنع لك بطاقات مرسومة لأنشطة {from}، وكل بطاقة فيها رسمة تتحرك بالنشاط نفسه.",
        "ask": [
            _q("items", "الأنشطة التي تقدمونها", "multi", opts="pictos", ph="اختر حتى 6", count=[2, 6]),
        ],
    },
    "t-versus": {
        "idea": "سنصنع لك مقارنة بين {the} والبديل المعتاد، جولة بجولة، بأرقام صادقة.",
        "ask": [
            _q("a", "اسم {the}", ph="مثال: باقتنا الذهبية", max=12),
            _q("rows", "نقاط المقارنة (من 3 إلى 5)", "lines", ph="النقطة|درجتكم|درجة البديل من 10، مثال: السعر|8|5", count=[3, 5], pair=True),
        ],
    },
}

# الأنشطة اللي ليها رسمة متحركة في t-pictogram (عربي|English) — نفس الترتيب في القالب
PICTOS = [["جري", "Running"], ["سباحة", "Swimming"], ["يوجا", "Yoga"], ["ملاكمة", "Boxing"], ["أثقال", "Weights"], ["دراجة", "Cycling"]]


def brief(tpl: str, field: str = "", brand: str = "") -> dict | None:
    """الفكرة بكلام العميل + الخانات اللي هيملاها (بأسماء على قدّ مجاله)."""
    b = BRIEFS.get(tpl)
    if not b:
        return None
    n, frm, the = noun(field)
    fill = lambda s: str(s).replace("{n}", n).replace("{from}", frm).replace("{the}", the).replace("{brand}", brand or "متجرك")  # noqa: E731
    ask = []
    for q in b["ask"]:
        q = {k: fill(v) if isinstance(v, str) else v for k, v in q.items()}
        if q.get("opts") == "pictos":
            q["opts"] = [[a, a] for a, _ in PICTOS]
        ask.append(q)
    return {"tpl": tpl, "idea": fill(b["idea"]), "ask": ask}


def _num(v) -> float | None:
    s = str(v or "").strip().translate(str.maketrans("٠١٢٣٤٥٦٧٨٩٫", "0123456789."))
    m = re.search(r"\d+(?:\.\d+)?", s)
    return float(m.group()) if m else None


def _lines(v) -> list[str]:
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    return [x.strip() for x in str(v or "").splitlines() if x.strip()]


def validate(tpl: str, facts: dict) -> tuple[dict, list[str]]:
    """ينضّف المعطيات ويرجّع (المعطيات، رسائل الأخطاء بكلام واضح)."""
    b = brief(tpl)
    if not b:
        return {}, []
    out, errs = {}, []
    for q in b["ask"]:
        k, v = q["key"], facts.get(q["key"])
        if q.get("show_if") and str(facts.get(q["show_if"][0]) or "") not in q["show_if"][1]:
            continue
        if q["kind"] == "num":
            x = _num(v)
            if x is None:
                if q["req"]:
                    errs.append(f"اكتب رقمًا في «{q['label']}»")
                continue
            out[k] = int(x) if x == int(x) else x
        elif q["kind"] in ("lines", "multi"):
            items = _lines(v) if q["kind"] == "lines" else [str(x) for x in (v or []) if str(x).strip()]
            lo, hi = (q["count"], q["count"]) if isinstance(q.get("count"), int) else tuple(q.get("count") or (1, 12))
            if q["req"] and len(items) < lo:
                errs.append(f"«{q['label']}»: اكتب {lo} على الأقل" if lo != hi else f"«{q['label']}»: اكتب {lo} بالضبط")
                continue
            out[k] = items[:hi]
        elif q["kind"] == "image":
            if v and str(v).startswith("/media/"):
                out[k] = str(v)
        else:
            s = str(v or "").strip()
            if not s:
                if q["req"]:
                    errs.append(f"اكتب «{q['label']}»")
                continue
            out[k] = s[: q.get("max", 200) * 2] if q.get("max") else s[:300]
    if tpl == "t-price" and "oldPrice" in out and "newPrice" in out and out["oldPrice"] <= out["newPrice"]:
        errs.append("السعر قبل الخصم يجب أن يكون أكبر من السعر بعده")
    return out, errs


def ar_digits(v) -> str:
    return str(v).translate(str.maketrans("0123456789.", "٠١٢٣٤٥٦٧٨٩٫"))


def apply(tpl: str, facts: dict, currency: str = "") -> tuple[dict, dict]:
    """المعطيات ← (خانات القالب المقفولة، وصف للعقل يقول له يستخدم إيه في الكلام المنطوق)."""
    f, p, say = facts or {}, {}, {}
    if tpl == "t-price":
        p.update(product=f.get("product"), oldPrice=str(f.get("oldPrice", "")), newPrice=str(f.get("newPrice", "")))
        if currency:
            p["currency"] = currency
        if f.get("img"):
            p["img"] = f["img"]
        kind, mins = f.get("cdKind") or "offer", f.get("cdMins")
        if kind == "none" or not mins:
            p["showCd"] = "false"
        else:
            p.update(showCd="true", mins=str(int(mins)), ends="يصلك طلبك خلال" if kind == "delivery" else "ينتهي العرض خلال")
            say["countdown"] = f"{'التوصيل' if kind == 'delivery' else 'العرض ينتهي'} خلال {int(mins)} دقيقة (العدّاد يعد هذا الوقت بالضبط)"
        say.update(product=f.get("product"), old=f.get("oldPrice"), new=f.get("newPrice"))
    elif tpl == "t-chat":
        say.update(item=f.get("item"), eta=f.get("eta"), pay=f.get("pay"))
        p["card2"] = " · ".join(x for x in (f.get("eta"), f.get("pay")) if x)[:34]
    elif tpl == "t-map":
        p.update(store=f.get("store"), areas=f.get("areas"), eta=str(int(f.get("eta") or 30)))
        say.update(eta=f"التوصيل خلال {int(f.get('eta') or 30)} دقيقة", areas="، ".join(f.get("areas") or []))
    elif tpl == "t-review":
        p.update(q1=f.get("q1"), n1=f.get("n1"), q2=f.get("q2"), n2=f.get("n2"), verified="true" if f.get("verified", "1") == "1" else "false")
        if f.get("rating"):
            p["rating"] = str(f["rating"])
        if f.get("count"):
            p["count"] = str(int(f["count"]))
        say.update(rating=f.get("rating"), count=f.get("count"))
    elif tpl == "t-show":
        p.update(a3=f.get("answer"), prize=f.get("prize"))
        say.update(answer=f.get("answer"), prize=f.get("prize"))
    elif tpl == "t-flow":
        p["steps"] = [s if "|" in s else f"{s}|" for s in f.get("steps") or []]
        p["result"] = f.get("result")
        say.update(steps=f.get("steps"), result=f.get("result"))
    elif tpl == "t-board":
        st = (f.get("steps") or []) + ["", "", ""]
        p.update(title1=f.get("problem"), step1=st[0], step2=st[1], step3=st[2], title2="في ثلاث خطوات", result=f.get("result"))
        say.update(problem=f.get("problem"), steps=f.get("steps"), result=f.get("result"))
    elif tpl == "t-flipcards":
        p.update({k: f[k] for k in ("img1", "img2", "img3") if f.get(k)})
        say["message"] = f.get("msg")
    elif tpl == "t-shopfloat":
        cur = f" {currency}" if currency else ""
        p.update(name1=f.get("name1"), price1=f"{ar_digits(f.get('price1', ''))}{cur}", name2=f.get("name2"), price2=f"{ar_digits(f.get('price2', ''))}{cur}")
        p.update({k: f[k] for k in ("img1", "img2") if f.get(k)})
        say.update(p1=f"{f.get('name1')} بـ {f.get('price1')}{cur}", p2=f"{f.get('name2')} بـ {f.get('price2')}{cur}")
    elif tpl == "t-count":
        p["offer"] = f.get("offer")
        say.update(offer=f.get("offer"), until=f.get("until"))
    elif tpl == "t-chart":
        p.update(data=f.get("data"), title=f.get("what"))
        if f.get("unit"):
            p["unit"] = f["unit"]
        say["data"] = f.get("data")
    elif tpl == "t-pictogram":
        en = dict(PICTOS)
        p["items"] = [f"{a}|{en.get(a, a)}" for a in f.get("items") or []]
        say["items"] = f.get("items")
    elif tpl == "t-versus":
        p.update(a=f.get("a"), rows=f.get("rows"))
        say.update(a=f.get("a"), rows=f.get("rows"))
    return {k: v for k, v in p.items() if v not in (None, "", [])}, {k: v for k, v in say.items() if v not in (None, "", [])}


def prompt_text(say: dict) -> str:
    """للعقل: المعطيات الحقيقية اللي لازم تتقال كما هي، ومينفعش يخترع غيرها."""
    if not say:
        return ""
    rows = "\n".join(f"- {k}: {v if not isinstance(v, list) else ' / '.join(map(str, v))}" for k, v in say.items())
    return ("\nمعطيات حقيقية من العميل (استخدمها كما هي في الكلام المنطوق، ولا تخترع أسعارًا أو أوقاتًا أو أسماء غيرها، "
            "ولا تذكر رقمًا لم يرد هنا):\n" + rows)


CURRENCY = [("سعود", "ريال"), ("إمارات", "درهم"), ("كويت", "دينار"), ("قطر", "ريال"), ("بحرين", "دينار"), ("عُمان", "ريال"), ("عمان", "ريال"),
            ("مصر", "جنيه"), ("أردن", "دينار"), ("عراق", "دينار"), ("ليبيا", "دينار"), ("تونس", "دينار"), ("جزائر", "دينار"), ("مغرب", "درهم"),
            ("سودان", "جنيه"), ("يمن", "ريال"), ("لبنان", "ليرة"), ("سوري", "ليرة")]


def currency(market: str) -> str:
    return next((c for k, c in CURRENCY if k in (market or "")), "")


# 🎨 القوالب اللي فيها صورة منتج: لو العميل مارفعش صورة، البرنامج يرسم المنتج نفسه (من اسمه) بنفس ستايل القالب
# (خانة الصورة ← خانة الاسم، ووصف الستايل). الرسمة بتتعمل على أبيض وبعدين بتتشال خلفيتها.
DRAW_STYLE_FLAT = ("Flat cartoon vector illustration with soft glossy gradients, clean bold shapes, a thin white outline around the object, "
                   "warm cheerful colors, a soft drop shadow under it. The object alone, centered, fully visible with margin, "
                   "on a seamless pure white background. No text, no letters, no logo, no brand name. Object: ")
DRAW_STYLE_SOFT = ("Soft 3D clay-like product render, smooth matte surfaces, gentle studio light, pastel-warm palette, "
                   "the object alone, centered, fully visible with margin, on a seamless pure white background. No text, no logo. Object: ")
DRAW = {
    "t-price": {"slots": [("img", "product")], "style": DRAW_STYLE_FLAT},
    "t-shopfloat": {"slots": [("img1", "name1"), ("img2", "name2")], "style": DRAW_STYLE_SOFT},
}


def draw_jobs(tpl: str, params: dict) -> list[tuple[str, str, str]]:
    """(خانة الصورة، اسم المنتج، البرومبت) لكل صورة ناقصة ينفع نرسمها."""
    d = DRAW.get(tpl)
    if not d:
        return []
    out = []
    for img, name in d["slots"]:
        what = str(params.get(name) or "").strip()
        if what and not params.get(img):
            out.append((img, what, d["style"] + what))
    return out
