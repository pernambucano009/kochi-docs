"""صناعة الكاروسيل: البرومبتات، والهوية البصرية بتاعة العميل المختار.

الخطوات:
1. نقاش مع موديل الكلام لحد ما نوصل لفكرة.
2. الموديل يكتب خطة الكاروسيل (نص كل سلايد ووصف الرسمة) بلغة العميل ولهجته، كـ JSON.
3. تنقيح: نفس الموديل يراجع الإملاء واللهجة (بعد أي تعديل بإيدك).
4. GPT Image يرسم الكاروسيل كله في صورة واحدة (عشان يطلع متسق).
5. بعد الموافقة، يرسم السلايدات واحدة واحدة بالمقاس النهائي،
   ومعاه الصورة الكاملة والسلايد اللي قبلها كمرجع.
"""

import json
import math
import re

# ---------------------------------------------------------------- الهوية البصرية (بتتعدّل من الإعدادات)

# الافتراضي لأي عميل لسه ملوش هوية: محايد (من غير اسم براند ولا سوق معيّن)
DEFAULT_BRAND = {
    "name": "",
    "about": "",
    "audience": "",
    "colors": "",
    "font": "خط عربي عريض وواضح (زي Tajawal أو Cairo)، العناوين Bold والكلام العادي Regular",
    "style": ("2D flat vector illustration, clean shapes, solid fills, no 3D, no photorealism, consistent characters "
              "across slides, generous white space, modern social-media carousel layout"),
    "logo_rule": "اللوجو صغير في نفس الركن في كل السلايدات",
    "market": "",
    "language": "عربي بسيط",
    "modest": "",
}

# هوية كوتشي القديمة: بتتنقل مرة واحدة لملف عميل كوتشي (البرنامج كان معمول ليها قبل ما يبقى لأي عميل)
LEGACY_BRAND = {
    "name": "KOCHI",
    "about": "كوتشي منصة تدريب رياضي وتغذية أونلاين بتوصّل المتدربين في السعودية والخليج بمدربين معتمدين.",
    "audience": "شباب وبنات في السعودية والخليج مهتمين باللياقة والتغذية والجسم الصحي",
    # من KOCHI Production Brief (الهوية الرسمية: KOCHI Sketchy Fitness)
    "colors": "#57B8AF teal (main accent), #EEECDA cream (backgrounds), #1F2933 charcoal (text and lines)",
    "font": "خط عربي عريض وواضح (زي Tajawal أو Cairo)، العناوين Bold والكلام العادي Regular",
    "style": (
        "KOCHI Sketchy Fitness: hand-drawn illustration, loose pencil-like line work with slight imperfections, "
        "misty watercolor-wash fills, warm muted palette (teal, cream, charcoal), bold clean outlines, minimal cell "
        "shading, no 3D, no photorealism, no gradient fills. Athletic but approachable, like a fitness sketchbook."
    ),
    "logo_rule": "اللوجو صغير في نفس الركن في كل السلايدات",
    "market": "السعودية والخليج",
    "language": "اللهجة السعودية البيضاء",
    "modest": "1",
    "rules": "من غير وعود صحية مبالغ فيها.",
}

# الستايل القديم (قبل الهوية الرسمية): لو متسجل في الإعدادات نتجاهله
OLD_DEFAULT_STYLES = {
    "2D flat vector illustration, clean geometric shapes, solid fills, no gradients or only very soft ones, "
    "no 3D, no photorealism, consistent character design across slides, generous white space, "
    "modern social-media carousel layout",
}
EYES_RULE = "!!!!! TWO TINY SOLID BLACK FILLED CIRCLES AS EYES — NO EXCEPTIONS !!!!!"

SIZES = {
    "4:5": (1536, 1920),  # بوست إنستجرام (المقاس الصح للكاروسيل)
    "9:16": (1440, 2560),  # الكاروسيلات القديمة بس
}
# مقاس النشر والتنزيل: إنستجرام بيعرض الكاروسيل 1080×1350
POST_SIZES = {"4:5": (1080, 1350), "9:16": (1080, 1920)}
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
    {"id": "follow", "label": "➕ تابعنا", "text": "تابعنا عشان تشوف أكتر"},
    {"id": "save", "label": "🔖 احفظ وشارك", "text": "احفظ البوست وشاركه مع اللي محتاجه"},
    {"id": "coach", "label": "🧑‍🏫 تابع المتكلم", "text": "تابع {coach}"},
]
LEGACY_CTAS = [
    {"id": "comment", "label": "💬 اكتب كلمة في الكومنت", "text": "اكتب «{keyword}» بالتعليقات و{reward}"},
    {"id": "follow", "label": "➕ تابعنا", "text": "تابعنا، كل يوم معلومة جديدة"},
    {"id": "platform", "label": "📱 منصة كوتشي", "text": "كوتشي أول منصة عربية تربطك بمدربك المعتمد"},
    {"id": "save", "label": "🔖 احفظ وشارك", "text": "احفظ البوست وأرسله لربعك اللي يحتاجونه"},
    {"id": "coach", "label": "🧑‍🏫 تابع المدرب", "text": "تابع الكوتش {coach} وابدأ رحلتك في كوتشي"},
]


def full_brand(brand: dict | None) -> dict:
    return {**DEFAULT_BRAND, **{k: v for k, v in (brand or {}).items() if v}}


def style_text(style: dict | None) -> str | None:
    """ستايل الرسم المختار من المكتبة: بيحل محل ستايل البراند في الرسم بس، والألوان تفضل ألوان البراند."""
    if not style:
        return None
    return (f"the \"{style['name']}\" art style shown in the style reference images"
            + (f": {style['notes'].strip().rstrip('.')}" if style.get("notes") else "")
            + ". Keep its line work, shapes, proportions, shading and texture, but use ONLY the brand colors below.")


def brand_block(brand: dict, kind: str = "characters", style: dict | None = None) -> str:
    b = full_brand(brand)
    lines = [f"Brand: {b['name'] or 'the brand'}. {b['about']}".strip(), f"Audience: {b['audience']}" if b["audience"] else ""]
    if b.get("market"):
        lines.append(f"Market: {b['market']}")
    lines = [x for x in lines if x]
    lines.append(f"Illustration style (for every character, icon and drawing): {style_text(style) or b['style']}")
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

def dialect_rules(brand: dict | None) -> str:
    b = full_brand(brand)
    return f"""قواعد الكتابة على السلايدات:
- اللغة: {b['language']}، طبيعية زي ما الجمهور بيتكلم على السوشيال{f" ({b['market']})" if b.get("market") else ""}.
- إملاء صحيح 100%: الهمزات والتاء المربوطة والألف المقصورة في مكانها.
- من غير تشكيل، ومن غير إيموجي جوه نص السلايد.
- جمل قصيرة جدًا: العنوان من 2 لـ 6 كلمات، والكلام تحته 20 كلمة بالكتير.
- معلومات صحيحة ومفيدة، ومن غير وعود مبالغ فيها.
- أول سلايد هوك يوقّف السكرول.""" + (f"\n- قواعد العميل: {b['rules']}" if b.get("rules") else "")


def chat_system(brand: dict) -> str:
    b = full_brand(brand)
    return f"""انت كاتب محتوى ومخطط كاروسيلات لإنستجرام وتيك توك لبراند {b['name'] or 'العميل'}.
{b['about']}
الجمهور: {b['audience'] or b.get('market') or '—'}.

شغلك في النقاش: تقترح أفكار كاروسيل قوية (هوك واضح، قيمة حقيقية، تسلسل منطقي)، وتطوّر الفكرة مع المستخدم.
لما تقترح أفكار: رقّمها، ولكل فكرة عنوان/هوك وسطر يشرح الزاوية وعدد السلايدات المقترح.
اتكلم مع المستخدم بالعربي البسيط، وأي نص مقترح للسلايدات يكون بـ{b['language']}.
{dialect_rules(b)}"""


PLAN_SCHEMA = """{
  "title": "اسم قصير للكاروسيل",
  "caption": "كابشن البوست بنفس لغة السلايدات",
  "hashtags": ["#هاشتاق", "..."],
  "slides": [
    {"headline": "عنوان السلايد", "body": "الكلام تحت العنوان (ممكن يبقى فاضي)", "visual": "وصف الرسمة بالإنجليزي"}
  ]
}"""


def kind_writing_rules(ctx: dict) -> str:
    """قواعد الكتابة على حسب الاختيارات (تيمبليت + ستايل + شخصيات + مدرب مع بعض)."""
    rules = []
    c = ctx.get("coach")
    if c:
        handle = f" (@{c['instagram']})" if c.get("instagram") else ""
        rules.append(f"- الكاروسيل ده معلومات ونصايح من المدرب {c['name']}{handle}: الكلام على لسانه أو منسوب له، "
                     f"وأول سلايد يقدّمه (مثلًا: نصيحة من كوتش {c['name']}).")
    names = "، ".join(ch["name"] for ch in ctx.get("characters") or [])
    who = "، ".join(x for x in [f"المدرب {c['name']}" if c else "", names] if x)
    if ctx.get("template") and not who:
        rules.append("- حقل visual بالإنجليزي ويوصف المحتوى المرسوم بس (أيقونات وعناصر وشخصيات لو محتاج)، "
                     "لأن التصميم نفسه ثابت من التيمبليت.")
    else:
        rules.append(f"- حقل visual بالإنجليزي ويوصف {who or 'شخصيات البراند'} بتعمل إيه في كل سلايد "
                     "(وضعية، تمرين، تعبير) وأي أيقونات بسيطة، بنفس الشكل في كل السلايدات.")
    return "\n".join(rules)


def cta_rule(ctx: dict, brand: dict | None = None) -> str:
    text = ctx.get("cta_text")
    if text:
        return f"- آخر سلايد هو الدعوة (CTA) ونصها لازم يكون بالمعنى ده بالظبط، ولو فيه كلمة بين « » تفضل زي ما هي: {text}\n- الكابشن يكرر نفس الدعوة."
    name = full_brand(brand)["name"]
    return ("- آخر سلايد دعوة (CTA): اختار الأنسب للمحتوى من دول: اكتب كلمة في الكومنت ونرسلك حاجة، "
            f"أو تابعنا عشان تشوف أكتر،{f' أو جملة قصيرة عن {name}،' if name else ''} أو احفظ البوست وشاركه.")


def plan_messages(brand: dict, chat: list[dict], slides: int, ctx: dict) -> list[dict]:
    ask = f"""اكتب الكاروسيل النهائي من النقاش اللي فات، في {slides} سلايدات بالظبط.
{dialect_rules(brand)}
{kind_writing_rules(ctx)}
{cta_rule(ctx, brand)}
رجّع JSON بس، من غير أي كلام قبله أو بعده، بالشكل ده:
{PLAN_SCHEMA}"""
    return [{"role": "system", "content": chat_system(brand)}, *chat[-20:], {"role": "user", "content": ask}]


def polish_messages(brand: dict, plan: dict, ctx: dict | None = None) -> list[dict]:
    keep = ""
    if ctx and ctx.get("cta_text"):
        keep = f"\n- سيب معنى الدعوة في آخر سلايد زي ما هو، وأي كلمة بين « » متتغيرش: {ctx['cta_text']}"
    ask = f"""راجع نص الكاروسيل ده ونقّحه:
- خلّي كل الكلام بـ{full_brand(brand)['language']}، وحوّل أي كلمة خارجة عنها.
- صحّح أي غلطة إملائية أو همزة أو تاء مربوطة.
- قصّر أي جملة طويلة من غير ما المعنى يضيع.
- متغيّرش عدد السلايدات ولا حقل visual.{keep}
{dialect_rules(brand)}
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
    "All on-image text is Arabic, right-to-left. Render every text EXACTLY as written between "
    "the quotes: same letters, same words, same order. Do not translate, add, remove or rephrase any word, "
    "no diacritics, no extra text, no lorem ipsum, no watermarks. Arabic letters must be correctly connected."
)


def overview_grid(n: int) -> tuple[int, int]:
    """الكاروسيل كله في صورة واحدة: كام عمود وكام صف."""
    cols = n if n <= 4 else math.ceil(n / 2)
    return cols, math.ceil(n / cols)


def overview_size(n: int, ratio: str) -> str:
    """مقاس الصورة الكاملة: كل سلايد بنفس نسبة المقاس النهائي، والمساحة في حدود 2560x1440."""
    pw, ph = SIZES.get(ratio, SIZES["4:5"])
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


def kind_design_rules(ctx: dict, brand: dict | None = None) -> str:
    b = full_brand(brand)
    """قواعد الرسم من الاختيارات مع بعض: التيمبليت للتقسيم، والمدرب والشخصيات للناس، والستايل لطريقة الرسم."""
    parts = []
    t = ctx.get("template")
    if t:
        parts.append(
            "LAYOUT: follow the template reference images for STRUCTURE: copy their layout grid, composition, "
            "text hierarchy and positions, shapes and decorative motifs, spacing and logo position, on every slide. "
            "If a reference is a mockup photo of slides on a phone or table, ignore the phone, perspective, shadows "
            "and background: take only the flat slide designs and adapt them to the vertical slide size. "
            "RECOLOR everything to the brand palette below (do not keep the template's own colors unless the "
            "template notes say so). Only the text and content visuals change between slides."
            + (f" Template notes: {t['notes']}" if t.get("notes") else ""))
    c = ctx.get("coach")
    if c:
        handle = f' and the handle "@{c["instagram"]}"' if c.get("instagram") else ""
        parts.append(
            f"COACH: the carousel is presented by {c.get('name', '')}. Reproduce the coach from the "
            "coach reference image(s): same face, hair or head covering, skin tone, body type and outfit, drawn as an "
            "illustrated character in the illustration style below. Show the coach on the first and last slides at "
            f'least (posing or demonstrating the tip), with the name "{c.get("name", "")}"{handle} written small near '
            "the character." + (f" Coach notes: {c['notes']}" if c.get("notes") else ""))
    names = ", ".join(ch["name"] for ch in ctx.get("characters") or [])
    if names:
        parts.append(
            f"CHARACTERS: {names}. Reuse the character reference images exactly: same faces, proportions, hair, "
            "outfits and colors, drawn in the illustration style below. Never redesign the characters.")
    elif not c:
        parts.append(
            "CHARACTERS: when a slide shows people, invent ONE or TWO original characters that fit the audience"
            + (f" ({b['market']})" if b.get("market") else "") + (", modestly dressed" if b.get("modest") else "")
            + ", drawn in the illustration style below, and keep them identical on every slide.")
    return f"DESIGN of this {b['name'] or 'brand'} carousel.\n" + "\n".join(parts) + f"\n{EYES_RULE}"


def overview_prompt(brand: dict, plan: dict, ratio: str, refs: dict, ctx: dict) -> str:
    n = len(plan["slides"])
    cols, rows = overview_grid(n)
    lines = [
        f"Design a complete, cohesive social-media carousel of {n} slides, shown together on ONE sheet as a grid of "
        f"{cols} columns x {rows} rows of {ratio} vertical panels with thin light gaps between them. "
        "Slide 1 is the top-left panel and the order continues left to right, row by row. "
        "Every panel is a finished slide. All panels share one visual system: same background treatment, "
        "same color palette, same typography, same characters, same logo position.",
        kind_design_rules(ctx, brand),
        brand_block(brand, style=ctx.get("style")),
        TEXT_RULES,
    ]
    lines += reference_notes(refs)
    lines.append("Slides:")
    for i, s in enumerate(plan["slides"], 1):
        lines.append(f"Slide {i}: {slide_text(s)}. Visual: {s.get('visual') or 'supporting visual'}")
    lines.append(EYES_RULE)
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
    lines += [kind_design_rules(ctx, brand), brand_block(brand, style=ctx.get("style")), TEXT_RULES]
    lines += reference_notes(refs)
    lines.append(f"Slide {k} text: {slide_text(s)}")
    lines.append(f"Visual: {s.get('visual') or 'supporting visual'}")
    lines.append(EYES_RULE)
    return "\n".join(lines)


def _idx(items: list[int]) -> str:
    return ", ".join(str(i) for i in items)


def reference_notes(refs: dict) -> list[str]:
    notes = []
    if refs.get("logo"):
        notes.append(f"Reference image {refs['logo']} is the brand logo: place it small and unchanged, never redraw it.")
    if refs.get("template"):
        notes.append(f"Reference images {_idx(refs['template'])} are the design TEMPLATE to copy.")
    if refs.get("style"):
        notes.append(f"Reference images {_idx(refs['style'])} are ART STYLE references only: copy how things are drawn "
                     "(line work, shapes, proportions, shading, texture). Do NOT copy their people, scenes, text or colors.")
    for name, idx in refs.get("characters") or []:
        notes.append(f"Reference images {_idx(idx)} show the character \"{name}\": reproduce this exact character.")
    if refs.get("coach"):
        notes.append(f"Reference images {_idx(refs['coach'])} show the coach character {refs.get('coach_name') or ''}: "
                     "reproduce this exact character.")
    return notes


# ---------------------------------------------------------------- قراءة صور المكتبة (موديل الرؤية)

DESCRIBE_FOCUS = {
    "template": "a social-media carousel TEMPLATE. Describe: layout grid and composition, text hierarchy and where "
                "headline/body/numbers sit, typography (serif/sans/condensed/handwritten, weights, case, sizes), "
                "the exact color palette as hex codes, shapes, icons and decorative motifs, background treatment, "
                "how slides connect to each other, overall mood. If it is a mockup photo (phone, table, perspective), "
                "describe only the flat slide designs.",
    "style": "an ILLUSTRATION STYLE reference. Describe how things are drawn: line work, shapes, body proportions, "
             "faces, shading and lighting, textures (grain, watercolor...), color approach, level of detail, mood. "
             "Do not describe the specific people or scene.",
    "character": "a CHARACTER reference. Describe the character so it can be redrawn identically: gender, age, "
                 "body type, skin tone, hair or head covering, face details, outfit and colors, accessories, "
                 "personality in the pose, drawing style.",
    "coach": "a fitness COACH character. Describe them so they can be redrawn identically: gender, age, body type, "
             "skin tone, hair/beard or head covering, face details, outfit and colors, accessories, drawing style.",
}


def describe_messages(kind: str, image_urls: list[str]) -> list[dict]:
    """رسالة لموديل الرؤية: يكتب اسم عربي قصير وملاحظات تصميم بالإنجليزي (JSON)."""
    content: list[dict] = [{"type": "text", "text": (
        f"The images show {DESCRIBE_FOCUS.get(kind, DESCRIBE_FOCUS['template'])}\n"
        "Reply with JSON only: {\"name\": \"a short catchy Arabic name of 2-4 words that describes the look "
        "(Egyptian/Saudi everyday words, no quotes)\", \"notes\": \"compact English design notes, 60-110 words, "
        "concrete and specific, written as instructions for an image model\"}"
    )}]
    content += [{"type": "image_url", "image_url": {"url": u}} for u in image_urls]
    return [{"role": "user", "content": content}]


def parse_description(text: str) -> dict:
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        raise ValueError("الموديل ما رجعش وصف")
    data = json.loads(m.group(0), strict=False)  # بعض الموديلات بتحط سطر جديد جوه النص
    name = str(data.get("name") or "").strip().strip('"«»')[:60]
    notes = re.sub(r"\s+", " ", str(data.get("notes") or "")).strip()[:1500]
    if not notes:
        raise ValueError("الموديل ما رجعش وصف")
    return {"name": name, "notes": notes}


def mock_description(kind: str) -> dict:
    return {"name": {"template": "تصميم تجريبي جريء", "style": "ستايل تجريبي ناعم"}.get(kind, "شخصية تجريبية"),
            "notes": "Mock description: bold sans headline top-start, big slide number, charcoal and cream panels, "
                     "teal accent, thin arrow connecting slides."}


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
        {"headline": "ابدأ مع مدربك النهارده", "body": "خطة تمرين وتغذية تناسبك", "visual": "coach character giving thumbs up with phone showing app"},
    ]
    while len(items) < slides:
        items.insert(-1, {"headline": f"نصيحة رقم {len(items)}", "body": "كلام تجريبي للسلايد", "visual": "flat icon"})
    return json.dumps({"title": "الراحة جزء من التمرين", "caption": "الراحة مو رفاهية 💪", "hashtags": ["#لياقة"],
                       "slides": items[: slides - 1] + [{"headline": cta, "body": "", "visual": "call to action"} if cta else items[-1]]},
                      ensure_ascii=False)
