"""صناعة الكاروسيل: البرومبتات والهوية البصرية لكوتشي.

الخطوات:
1. نقاش مع موديل الكلام لحد ما نوصل لفكرة.
2. الموديل يكتب خطة الكاروسيل (نص كل سلايد ووصف الرسمة) باللهجة السعودي، كـ JSON.
3. تنقيح: نفس الموديل يراجع الإملاء واللهجة (بعد أي تعديل بإيدك).
4. GPT Image يرسم الكاروسيل كله في صورة واحدة (عشان يطلع متسق).
5. بعد الموافقة، يرسم السلايدات واحدة واحدة بالمقاس النهائي،
   ومعاه الصورة الكاملة والسلايد اللي قبلها كمرجع.
"""

import json
import math
import re

# ---------------------------------------------------------------- الهوية البصرية (بتتعدّل من الإعدادات)

DEFAULT_BRAND = {
    "name": "KOCHI",
    "about": "كوتشي منصة تدريب رياضي وتغذية أونلاين بتوصّل المتدربين في السعودية والخليج بمدربين معتمدين.",
    "audience": "شباب وبنات في السعودية والخليج مهتمين باللياقة والتغذية والجسم الصحي",
    "colors": "",
    "font": "خط عربي عريض وواضح (زي Tajawal أو Cairo)، العناوين Bold والكلام العادي Regular",
    "style": (
        "2D flat vector illustration, clean geometric shapes, solid fills, no gradients or only very soft ones, "
        "no 3D, no photorealism, consistent character design across slides, generous white space, "
        "modern social-media carousel layout"
    ),
    "logo_rule": "اللوجو صغير في نفس الركن في كل السلايدات",
}

SIZES = {
    "9:16": (1440, 2560),  # تيك توك والستوري
    "4:5": (1536, 1920),  # فيد إنستجرام
}
QUALITIES = ("low", "medium", "high", "xhigh", "max")

# أنواع الكاروسيل
KINDS = {
    "template": "تيمبليت (تصميم جاهز)",
    "characters": "شخصيات 2D",
    "coach": "معلومات من مدرب",
}

# الدعوة في آخر سلايد (CTA). بتتعدّل من الهوية، و«auto» الموديل بيختار
DEFAULT_CTAS = [
    {"id": "comment", "label": "💬 اكتب كلمة في الكومنت", "text": "اكتب «{keyword}» بالتعليقات و{reward}"},
    {"id": "follow", "label": "➕ تابعنا", "text": "تابعنا، كل يوم معلومة جديدة"},
    {"id": "platform", "label": "📱 منصة كوتشي", "text": "كوتشي أول منصة عربية تربطك بمدربك المعتمد"},
    {"id": "save", "label": "🔖 احفظ وشارك", "text": "احفظ البوست وأرسله لربعك اللي يحتاجونه"},
    {"id": "coach", "label": "🧑‍🏫 تابع المدرب", "text": "تابع الكوتش {coach} وابدأ رحلتك في كوتشي"},
]


def brand_block(brand: dict, kind: str = "characters") -> str:
    b = {**DEFAULT_BRAND, **{k: v for k, v in (brand or {}).items() if v}}
    lines = [f"Brand: {b['name']}. {b['about']}", f"Audience: {b['audience']}"]
    if kind == "characters":
        lines.append(f"Illustration style: {b['style']}")
    lines.append(f"Typography: {b['font']}")
    if b.get("colors"):
        lines.append(f"Brand colors (use these as the palette, exact hex values): {b['colors']}")
    lines.append(f"Logo: {b['logo_rule']}")
    return "\n".join(lines)


def cta_text(cta: dict | None, ctas: list[dict], coach_name: str | None) -> str | None:
    """نص الـ CTA بعد ما نحط الكلمة والجايزة واسم المدرب. None = الموديل يختار."""
    if not cta or cta.get("type") in (None, "", "auto"):
        return None
    if cta.get("type") == "custom":
        return (cta.get("text") or "").strip() or None
    base = next((c for c in ctas if c["id"] == cta["type"]), None)
    if not base:
        return None
    text = base["text"]
    if "{coach}" in text and not coach_name:
        return None  # دعوة المدرب من غير مدرب: الموديل يختار بداله
    text = text.replace("{keyword}", (cta.get("keyword") or "جدول").strip())
    text = text.replace("{reward}", (cta.get("reward") or "نرسلك التفاصيل").strip())
    # «تابع الكوتش {coach}» من غير ما تتكرر كلمة كوتش لو هي في الاسم
    coach = re.sub(r"^(الكوتش|كوتش|الكابتن|كابتن|coach|captain)\s+", "", (coach_name or "").strip(), flags=re.I)
    text = text.replace("{coach}", coach)
    return re.sub(r"\s+", " ", text).strip()


# ---------------------------------------------------------------- الكلام

DIALECT_RULES = """قواعد الكتابة على السلايدات:
- اللهجة سعودية بيضاء طبيعية (زي ما يتكلم شاب سعودي على السوشيال)، مش فصحى ومش مصري.
- إملاء صحيح 100%: الهمزات والتاء المربوطة والألف المقصورة في مكانها.
- من غير تشكيل، ومن غير إيموجي جوه نص السلايد.
- جمل قصيرة جدًا: العنوان من 2 لـ 6 كلمات، والكلام تحته 20 كلمة بالكتير.
- معلومات صحيحة علميًا ومفيدة، ومن غير وعود مبالغ فيها.
- أول سلايد هوك يوقّف السكرول."""


def chat_system(brand: dict) -> str:
    b = {**DEFAULT_BRAND, **{k: v for k, v in (brand or {}).items() if v}}
    return f"""انت كاتب محتوى ومخطط كاروسيلات لإنستجرام وتيك توك لبراند {b['name']}.
{b['about']}
الجمهور: {b['audience']}.

شغلك في النقاش: تقترح أفكار كاروسيل قوية (هوك واضح، قيمة حقيقية، تسلسل منطقي)، وتطوّر الفكرة مع المستخدم.
لما تقترح أفكار: رقّمها، ولكل فكرة عنوان/هوك وسطر يشرح الزاوية وعدد السلايدات المقترح.
اتكلم مع المستخدم بالعربي البسيط، وأي نص مقترح للسلايدات يكون باللهجة السعودية.
{DIALECT_RULES}"""


PLAN_SCHEMA = """{
  "title": "اسم قصير للكاروسيل",
  "caption": "كابشن البوست باللهجة السعودية",
  "hashtags": ["#هاشتاق", "..."],
  "slides": [
    {"headline": "عنوان السلايد", "body": "الكلام تحت العنوان (ممكن يبقى فاضي)", "visual": "وصف الرسمة بالإنجليزي"}
  ]
}"""


def kind_writing_rules(ctx: dict) -> str:
    kind = ctx.get("kind")
    if kind == "coach" and ctx.get("coach"):
        c = ctx["coach"]
        handle = f" (@{c['instagram']})" if c.get("instagram") else ""
        return (f"- الكاروسيل ده معلومات ونصايح من المدرب {c['name']}{handle}: الكلام على لسانه أو منسوب له، "
                f"وأول سلايد يقدّمه (مثلًا: نصيحة من كوتش {c['name']}).\n"
                "- حقل visual بالإنجليزي: مكان صورة المدرب الحقيقية في السلايد وتعبيره، وأي أيقونات بسيطة.")
    if kind == "template":
        return "- حقل visual بالإنجليزي ويوصف المحتوى المرسوم بس (أيقونات وعناصر)، لأن التصميم نفسه ثابت من التيمبليت."
    names = "، ".join(ch["name"] for ch in ctx.get("characters") or []) or "شخصيات البراند"
    return f"- حقل visual بالإنجليزي ويوصف الشخصيات ({names}) بتعمل إيه في كل سلايد، بنفس الشكل في كل السلايدات."


def cta_rule(ctx: dict) -> str:
    text = ctx.get("cta_text")
    if text:
        return f"- آخر سلايد هو الدعوة (CTA) ونصها لازم يكون بالمعنى ده بالظبط، ولو فيه كلمة بين « » تفضل زي ما هي: {text}\n- الكابشن يكرر نفس الدعوة."
    return ("- آخر سلايد دعوة (CTA): اختار الأنسب للمحتوى من دول: اكتب كلمة في الكومنت ونرسلك حاجة، "
            "أو تابعنا عشان كل يوم معلومة جديدة، أو كوتشي أول منصة عربية تربطك بمدربك المعتمد، أو احفظ البوست وشاركه.")


def plan_messages(brand: dict, chat: list[dict], slides: int, ctx: dict) -> list[dict]:
    ask = f"""اكتب الكاروسيل النهائي من النقاش اللي فات، في {slides} سلايدات بالظبط.
{DIALECT_RULES}
{kind_writing_rules(ctx)}
{cta_rule(ctx)}
رجّع JSON بس، من غير أي كلام قبله أو بعده، بالشكل ده:
{PLAN_SCHEMA}"""
    return [{"role": "system", "content": chat_system(brand)}, *chat[-20:], {"role": "user", "content": ask}]


def polish_messages(brand: dict, plan: dict, ctx: dict | None = None) -> list[dict]:
    keep = ""
    if ctx and ctx.get("cta_text"):
        keep = f"\n- سيب معنى الدعوة في آخر سلايد زي ما هو، وأي كلمة بين « » متتغيرش: {ctx['cta_text']}"
    ask = f"""راجع نص الكاروسيل ده ونقّحه:
- حوّل أي كلمة مش سعودية للهجة السعودية البيضاء.
- صحّح أي غلطة إملائية أو همزة أو تاء مربوطة.
- قصّر أي جملة طويلة من غير ما المعنى يضيع.
- متغيّرش عدد السلايدات ولا حقل visual.{keep}
{DIALECT_RULES}
رجّع نفس الـ JSON بالظبط بعد التنقيح، من غير أي كلام تاني:
{json.dumps(plan, ensure_ascii=False, indent=1)}"""
    return [{"role": "system", "content": chat_system(brand)}, {"role": "user", "content": ask}]


def parse_plan(text: str, slides: int | None = None) -> dict:
    """بيطلّع الـ JSON من رد الموديل حتى لو كتب حاجة قبله أو بعده أو حطه في ```."""
    t = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    start, end = t.find("{"), t.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("الموديل مرجّعش خطة. جرّب تاني")
    data = json.loads(t[start : end + 1])
    out_slides = []
    for s in data.get("slides") or []:
        if not isinstance(s, dict):
            continue
        out_slides.append({
            "headline": str(s.get("headline") or s.get("title") or "").strip(),
            "body": str(s.get("body") or s.get("text") or "").strip(),
            "visual": str(s.get("visual") or s.get("image") or "").strip(),
        })
    if not out_slides:
        raise ValueError("الخطة طلعت من غير سلايدات. جرّب تاني")
    tags = data.get("hashtags") or []
    return {
        "title": str(data.get("title") or "").strip(),
        "caption": str(data.get("caption") or "").strip(),
        "hashtags": [str(h).strip() for h in tags if str(h).strip()] if isinstance(tags, list) else [],
        "slides": out_slides[: slides or len(out_slides)],
    }


# ---------------------------------------------------------------- الصور

TEXT_RULES = (
    "All on-image text is Arabic, right-to-left, in Saudi dialect. Render every text EXACTLY as written between "
    "the quotes: same letters, same words, same order. Do not translate, add, remove or rephrase any word, "
    "no diacritics, no extra text, no lorem ipsum, no watermarks. Arabic letters must be correctly connected."
)


def overview_grid(n: int) -> tuple[int, int]:
    """الكاروسيل كله في صورة واحدة: كام عمود وكام صف."""
    cols = n if n <= 4 else math.ceil(n / 2)
    return cols, math.ceil(n / cols)


def overview_size(n: int, ratio: str) -> str:
    """مقاس الصورة الكاملة: كل سلايد بنفس نسبة المقاس النهائي، والمساحة في حدود 2560x1440."""
    pw, ph = SIZES.get(ratio, SIZES["9:16"])
    cols, rows = overview_grid(n)
    r = (cols * pw) / (rows * ph)
    r = max(1 / 3, min(3, r))
    area = 2560 * 1440
    w = math.sqrt(area * r)
    h = w / r
    w, h = min(3840, int(w) // 16 * 16), min(3840, int(h) // 16 * 16)
    return f"{w}x{h}"


def slide_text(s: dict) -> str:
    parts = [f'headline: "{s["headline"]}"'] if s.get("headline") else []
    if s.get("body"):
        parts.append(f'body: "{s["body"]}"')
    return " | ".join(parts) or "(no text on this slide)"


def kind_design_rules(ctx: dict) -> str:
    kind = ctx.get("kind")
    if kind == "template":
        t = ctx.get("template") or {}
        return ("DESIGN: follow the template reference images exactly. Copy their design system: layout grid, "
                "background, shapes and decorations, color palette, typography style, sizes and text positions, "
                "logo position. Keep the same look on every slide; only the text and the small content visuals change."
                + (f" Template notes: {t['notes']}" if t.get("notes") else ""))
    if kind == "coach":
        c = ctx.get("coach") or {}
        handle = f' and the handle "@{c["instagram"]}"' if c.get("instagram") else ""
        return (f"DESIGN: a clean, premium fitness-tips carousel featuring the real coach {c.get('name', '')}. "
                "Use the coach photo reference as a real photographic cut-out of the same person (do not turn it into "
                "an illustration, do not change the face, body or skin tone). Show the coach on the first and last "
                f'slides at least, with the name "{c.get("name", "")}"{handle} written small near the photo.')
    names = ", ".join(ch["name"] for ch in ctx.get("characters") or [])
    return ("DESIGN: 2D flat vector character carousel. Reuse the character reference images exactly: same faces, "
            "proportions, hair, outfits and colors, drawn in the same flat style. Never redesign the characters."
            + (f" Characters: {names}." if names else ""))


def overview_prompt(brand: dict, plan: dict, ratio: str, refs: dict, ctx: dict) -> str:
    n = len(plan["slides"])
    cols, rows = overview_grid(n)
    lines = [
        f"Design a complete, cohesive social-media carousel of {n} slides, shown together on ONE sheet as a grid of "
        f"{cols} columns x {rows} rows of {ratio} vertical panels with thin light gaps between them. "
        "Slide 1 is the top-left panel and the order continues left to right, row by row. "
        "Every panel is a finished slide. All panels share one visual system: same background treatment, "
        "same color palette, same typography, same characters, same logo position.",
        kind_design_rules(ctx),
        brand_block(brand, ctx.get("kind", "characters")),
        TEXT_RULES,
    ]
    lines += reference_notes(refs)
    lines.append("Slides:")
    for i, s in enumerate(plan["slides"], 1):
        lines.append(f"Slide {i}: {slide_text(s)}. Visual: {s.get('visual') or 'supporting visual'}")
    return "\n".join(lines)


def slide_prompt(brand: dict, plan: dict, k: int, ratio: str, refs: dict, ctx: dict) -> str:
    n = len(plan["slides"])
    s = plan["slides"][k - 1]
    lines = [
        f"Create slide {k} of {n} of this carousel as ONE standalone full-bleed {ratio} vertical slide, high resolution.",
        "Reference image 1 is the approved carousel overview (all slides on one sheet, slide 1 top-left, "
        f"left to right). Recreate panel {k} from it faithfully: same layout, composition, colors, typography, "
        "characters and logo position, just sharper and at full size. Do not show other panels, gaps or grid.",
    ]
    if refs.get("previous"):
        lines.append("Reference image 2 is the finished previous slide: match its exact style, colors, fonts and character design.")
    lines += [kind_design_rules(ctx), brand_block(brand, ctx.get("kind", "characters")), TEXT_RULES]
    lines += reference_notes(refs)
    lines.append(f"Slide {k} text: {slide_text(s)}")
    lines.append(f"Visual: {s.get('visual') or 'supporting visual'}")
    return "\n".join(lines)


def _idx(items: list[int]) -> str:
    return ", ".join(str(i) for i in items)


def reference_notes(refs: dict) -> list[str]:
    notes = []
    if refs.get("logo"):
        notes.append(f"Reference image {refs['logo']} is the brand logo: place it small and unchanged, never redraw it.")
    if refs.get("template"):
        notes.append(f"Reference images {_idx(refs['template'])} are the design TEMPLATE to copy.")
    for name, idx in refs.get("characters") or []:
        notes.append(f"Reference images {_idx(idx)} show the character \"{name}\": reproduce this exact character.")
    if refs.get("coach"):
        notes.append(f"Reference image {refs['coach']} is a real photo of the coach {refs.get('coach_name') or ''}.")
    return notes


# ---------------------------------------------------------------- وضع التجربة (من غير Atlas)

def mock_reply(chat: list[dict]) -> str:
    last = chat[-1]["content"] if chat else ""
    return (
        f"تمام، عن «{last[:40]}» عندي ٣ أفكار:\n"
        "1. «تمرّن كل يوم ولا تشوف نتيجة؟» ليه الراحة جزء من التمرين (6 سلايدات)\n"
        "2. «البروتين مو بس للمتضخمين» كم تحتاج فعلًا (5 سلايدات)\n"
        "3. «٣ أغلاط تخرّب الدايت» (5 سلايدات)\n"
        "أي وحدة تبي نكمل عليها؟"
    )


def mock_plan(slides: int, cta: str | None = None) -> str:
    items = [
        {"headline": "تمرّن كل يوم وما تشوف نتيجة؟", "body": "", "visual": "tired character looking at a mirror"},
        {"headline": "العضلة تكبر وانت ترتاح", "body": "التمرين يكسّر الألياف، والنوم يبنيها من جديد", "visual": "character sleeping, muscle icon glowing"},
        {"headline": "نام ٧ ساعات على الأقل", "body": "قلة النوم ترفع الكورتيزول وتوقف التقدم", "visual": "moon and clock icons"},
        {"headline": "يوم راحة مو كسل", "body": "خذ يومين راحة بالأسبوع وخلك نشيط بمشي خفيف", "visual": "character walking in a park"},
        {"headline": "كل بروتين كافي", "body": "حوالي ١.٦ جرام لكل كيلو من وزنك يوميًا", "visual": "plate with chicken, eggs and yogurt"},
        {"headline": "ابدأ مع مدربك في كوتشي", "body": "خطة تمرين وتغذية تناسبك", "visual": "coach character giving thumbs up with phone showing app"},
    ]
    while len(items) < slides:
        items.insert(-1, {"headline": f"نصيحة رقم {len(items)}", "body": "كلام تجريبي للسلايد", "visual": "flat icon"})
    return json.dumps({"title": "الراحة جزء من التمرين", "caption": "الراحة مو رفاهية 💪", "hashtags": ["#كوتشي", "#لياقة"],
                       "slides": items[: slides - 1] + [{"headline": cta, "body": "", "visual": "call to action"} if cta else items[-1]]},
                      ensure_ascii=False)
