"""🧭 مسار القالب: بعد ما العميل يضغط على قالب، العقل يسير معه خطوة بخطوة:
الفكرة ← نوع المنشور (ريل / كاروسيل / مسلسل) ← السيناريو ← الأبطال ← الملفات (@إشارة) ← التوليد.
في كل خطوة العقل يقترح أكثر من اختيار، والعميل يختار أو يعدّل أو يتناقش أو يطلب غيرهم أو يكتب نفسه،
وكل لايك/ديسلايك يُسجّل في العقل لكي يعرف ذوقه أكثر.

الأوصاف هنا هي «دراع العقل»: تُبنى من ملف العلامة + ذوق العميل الذي اتعلّمه + اذهب القالب،
فتتغير تلقائيًا كل ما العقل يعرف أكثر."""
from __future__ import annotations

import json
import re
from pathlib import Path

import growth
import algo

FORMATS = {"reel": "ريل (فيديو قصير)", "carousel": "كاروسيل (صور خلف بعض)", "series": "مسلسل (كذا حلقة)"}
STAGES = ("idea", "format", "scenario", "cast", "voice", "assets", "panel", "generate", "shoot", "review", "montage", "done")


# ---------------------------------------------------------------- ذوق العميل (اللي المخ اتعلّمه)

def prefs_text(brain: dict | None, limit: int = 24) -> str:
    """آخر اللايكات والديسلايكات كسطور تدخل في كل وصف."""
    prefs = (brain or {}).get("prefs") or []
    if not prefs:
        return ""
    likes = [p for p in prefs if p.get("value", 0) > 0][-limit // 2:]
    dislikes = [p for p in prefs if p.get("value", 0) < 0][-limit // 2:]
    out = []
    if likes:
        out.append("أشياء العميل حبها من قبل (امشي على روحها):\n" + "\n".join(f"- [{p.get('kind')}] {p.get('text', '')[:220]}"
                                                                         + (f" — السبب: {p['reason']}" if p.get("reason") else "") for p in likes))
    if dislikes:
        out.append("أشياء العميل رفضها (ابعد عنها):\n" + "\n".join(f"- [{p.get('kind')}] {p.get('text', '')[:220]}"
                                                                 + (f" — السبب: {p['reason']}" if p.get("reason") else "") for p in dislikes))
    return "\n".join(out)


# 🧠 «العقل فاهمك قد إيه»: قايمة شروط واضحة، كل شرط ليه نقط ثابتة ومعروف إمتى بيتحقق، والنسبة = مجموع اللي اتحقق.
# مفيش أوزان مخفية: العميل بيشوف كل شرط عارفه ولا ناقصه. «core» = لازم يتحققوا عشان خطة المحتوى تتعمل.
# (key, label, points, core, hint)
KNOW = (
    ("domain", "المجال", 10, True, "اكتب مجالك (أو حلّل حساب السوشيال والعقل يكتبه)"),
    ("about", "عن العلامة (يعمل ماذا ويفرق في ماذا)", 10, True, "اكتب عن العلامة جملتين على الأقل"),
    ("audience", "الجمهور الذي تكلمه", 10, True, "اكتب من الجمهور: سنه واهتماماته ويبحث عن ماذا"),
    ("market", "السوق", 5, False, "اكتب السوق (مثلًا: السعودية والخليج)"),
    ("language", "اللغة واللهجة", 5, False, "اكتب اللهجة اللي بتتكلم بيها"),
    ("goal", "الهدف (الدعوة أو الرابط)", 5, False, "اكتب الدعوة (CTA) أو الرابط في «التسليم»"),
    ("logo", "الشعار", 5, False, "ارفع الشعار"),
    ("palette", "الألوان", 5, False, "ضع ألوان العلامة"),
    ("typography", "الخطوط", 3, False, "اختر خطوط العلامة"),
    ("rules", "قواعد المحتوى", 5, False, "ضيف قاعدة واحدة على الأقل (حاجة لازم تتعمل أو ممنوعة)"),
    ("knowledge", "معرفة من مصادرك (٣ معلومات)", 10, False, "أضف رابط موقعك أو ملف تعريفي ووافق على المعلومات"),
    ("social", "تحليل حساب السوشيال الخاص بك", 10, False, "حلّل حساب السوشيال من العقل"),
    ("rivals", "منافس معتمد واحد على الأقل", 7, False, "وافق على منافس واحد على الأقل"),
    ("taste", "ذوقك (١٠ لايك أو ديسلايك)", 10, False, "قيّم الأفكار والسيناريوهات باللايك والديسلايك"),
)
KNOW_READY = 70   # من هنا العقل «فاهمك» وخطة المحتوى بتتعمل (ومعاها الشروط الأساسية)


def _know_got(b: dict) -> dict[str, float]:
    """كل شرط اتحقق قدر ماذا (٠ لـ ١). ما يتعد (المعرفة والذوق) يأخذ جزء على قدر الذي أُنشئ."""
    txt = lambda k, n=1: len(str(b.get(k) or "").strip()) >= n  # noqa: E731
    import rivals  # noqa: PLC0415
    return {
        "domain": float(txt("domain", 2) or txt("niche", 2)),
        "about": float(txt("about", 40)),
        "audience": float(txt("audience", 15)),
        "market": float(txt("market", 2)),
        "language": float(txt("language", 2)),
        "goal": float(txt("cta", 3) or txt("link", 8)),
        "logo": float(bool(b.get("logos"))),
        "palette": float(txt("palette", 4)),
        "typography": float(txt("typography", 2)),
        "rules": float(txt("rules", 5)),
        "knowledge": min(1.0, len(b.get("notes") or []) / 3),
        "social": float(bool(b.get("todos") or (b.get("batch") or {}).get("analysis") or txt("niche", 2))),
        "rivals": float(bool(rivals.approved(b.get("competitors") or {}))),
        "taste": min(1.0, len(b.get("prefs") or []) / 10),
    }


def knowledge(brain: dict | None, fields: tuple[str, ...] = (), kinds: tuple[str, ...] = ()) -> dict:
    """«العقل فاهمك قدر ماذا»: مجموع نقاط الشروط الذي اتحققت (من ١٠٠)، ومعها القائمة كلها لكي الرقم يصبح مفهوم."""
    b = brain or {}
    got = _know_got(b)
    items = [{"k": k, "t": t, "pts": p, "core": core, "got": round(p * got[k], 1), "done": got[k] >= 1, "hint": hint} for k, t, p, core, hint in KNOW]
    score = round(sum(i["got"] for i in items))
    core_ok = all(i["done"] for i in items if i["core"])
    ready = score >= KNOW_READY and core_ok
    level = "ما زال يتعرّف عليك" if score < 30 else "بدأ يفهمك" if score < 50 else "قرّب يفهمك" if not ready else "فاهمك"
    missing = sorted((i for i in items if not i["done"]), key=lambda i: (not i["core"], -(i["pts"] - i["got"])))
    return {"score": score, "level": level, "ready": ready, "need": KNOW_READY, "core_ok": core_ok, "items": items,
            "tips": [i["hint"] for i in missing[:3]]}


# ---------------------------------------------------------------- البرومبتات (دراع المخ)

def _tpl_line(tpl: dict) -> str:
    kind = {"motion": "قالب موشن جرافيك بالكود (شكله وحركته ثابتين، النصوص والألوان فقط ما تتغير)", "scene": "قالب فيديو متولّد بالذكاء الاصطناعي بستايل ثابت",
            "ad": "قالب إعلان بشخصية ومنتج", "still": "قالب صور منتج ثابتة", "typo": "قالب نص متحرك (تايبوجرافي)"}.get(tpl.get("kind"), "قالب")
    out = f"القالب الذي العميل اختره: «{tpl.get('name', '')}» — {kind}.\nروحه: {tpl.get('desc', '')}"
    if tpl.get("profile"):
        out += "\n\nبطاقة القالب (اقراها كويس، العمل كله يجب يُبنى عليها):\n" + tpl["profile"]
    return out


TPL_RULE = ("القالب هو نقطة البداية غير ديكور: العميل اختر هذا القالب لكي شكله وطريقة حكيه. أي فكرة أو سيناريو يجب يستخدم الذي القالب يقدمه "
            "(تسلسله، خاناته، مشاهده، حركته، نوع بطله) كوسيلة الحكي نفسها. إذا الفكرة تنفع تُنشأ بأي قالب آخر بنفس السهولة يصبح خطأ. "
            "اسأل نفسك: له هذه الفكرة تحتاج هذا القالب بالذات؟ وإذا القالب بعيد عن مجال العلامة، ابحث عن الزاوية الذكية التي توصل العلامة بعالم القالب.")


def _base_system(brand: str, prefs: str, tpl: dict, assets: list[dict]) -> str:
    parts = ["إنت «مخ البراند»: كاتب ومخرج محتوى سوشيال شاطر بيعرف البراند ده كويس. اكتب بنفس لغة ولهجة البراند (وإن لم تكن محددة فاستنتجها من السوق، وإلا فالعربية الفصحى البسيطة).",
             "ملف العلامة:\n" + (brand or "(لا يوجد بعد بيانات كثير عن العلامة)"), _tpl_line(tpl), TPL_RULE, growth.psych_rule(), algo.rule("core")]
    if prefs:
        parts.append(prefs)
    if assets:
        parts.append("ملفات العميل المرفوعة هذا للشغل (يمكن يعملها إشارة بـ @الاسم):\n" + "\n".join(f"- @{a['name']} ({a.get('kind', 'صورة')})" for a in assets))
    parts.append("ممنوع: ماركات أو أشخاص حقيقيين مش بتوع البراند، وعود طبية أو مالية مبالغ فيها، أي حاجة ضد قواعد البراند. "
                 "وممنوع تخترع أرقام أو إحصائيات أو أسعار أو خصومات أو عروض مش مكتوبة في ملف البراند: لو الفكرة محتاجة رقم حقيقي "
                 "اكتب مكانه [رقمك] أو [السعر] بين قوسين لكي العميل يكتبه نفسه.")
    return "\n\n".join(parts)


def ideas_messages(brand: str, prefs: str, tpl: dict, assets: list[dict], n: int, avoid: list[str], hint: str, season: str = "", extra: str = "") -> list[dict]:
    user = (f"اقترح {n} أفكار لبوست على قالب «{tpl.get('name', '')}» هذا للعلامة. كل فكرة مولودة من القالب: مبنية على تسلسله وخاناته وشكله، "
            "ومختلفة عن الأخرى في الزاوية (مشكلة وحل، حكاية، معلومة، عرض، مقارنة...) فقط كلها داخل عالم القالب.\n"
            + (f"طلب العميل: {hint}\n" if hint else "")
            + (f"المناسبة/الموسم: {season}\n" if season else "")
            + (("ابعد عن هذه الأفكار (اتقالت من قبل):\n" + "\n".join(f"- {a}" for a in avoid[-12:]) + "\n") if avoid else "")
            + growth.hooks_rule() + "\n" + algo.for_use("ideas") + "\n"
            + "لكل فكرة أنشئ «pack» للهوك الأعلى درجة بطريقة الخطاف التلاتي: المكتوب والمعروض والمنطوق يقولون نفس المعنى بالضبط، "
              "ويعدّون اختبار الصوت المقفول، وبعدهم جملتين قفل بطريقة من الـ ٦ (لمّح للدليل، لمّح للتحوّل، تباين سريع، الصندوق السحري، رد على الاعتراض، أكّد الادعاء).\n"
            + (extra + "\n" if extra else "")
            + 'استعد JSON هذا بالشكل فقط: {"ideas": [{"title": "عنوان قصير", '
              '"hooks": [{"text": "الخطاف", "formula": "اسم القالب", "score": 8.5, "why": "له هذه الدرجة", "principle": "المبدأ النفسي"}, {...}, {...}], '
              '"pack": {"screen": "الخطاف المكتوب على الشاشة (٣–١٠ كلمات، سطرين بالكتير، بدون علامات ترقيم)", "visual": "ما يُرى في أول ثانيتين (حركة/تباين/شيء غير متوقعة)", '
              '"spoken": "أول جملة تُقال", "lockin": "الجملتين الذين بعد الخطاف مباشرة (يأكدون الوعد وفيهم دليل أو لمحة)", "lockin_method": "طريقة القفل"}, '
              '"idea": "الفكرة نفسها في جملة واحدة قصيرة (١٥ كلمة بالكتير): الزاوية والموضوع فقط، غير النص الذي سيُقال ولا المشاهد", '
              '"fit": "كيف ماشية على القالب في كلمات قليلة (١٠ كلمات بالكتير)", "why": "له تنفع هذا للعلامة في جملة قصيرة", '
              '"aud": "اسم الجمهور المقصود بالضبط من «الجماهير المستهدفة» إذا موجودة، ونوّع بينهم"}]}\n'
              "مهم: الفكرة غير نص. النص والمشاهد يتكتبون لاحقًا في خطوة النص، فهنا الفكرة عنوان وجملة واحدة وبس.")
    return [{"role": "system", "content": _base_system(brand, prefs, tpl, assets)}, {"role": "user", "content": user}]


def scenarios_messages(brand: str, prefs: str, tpl: dict, assets: list[dict], idea: str, fmt: str, episodes, cast: list[str], n: int, avoid: list[str], hint: str) -> list[dict]:
    if fmt == "carousel":
        shape = ('كل سيناريو = سلايدات (من ٥ لـ ٨): {"title": "...", "summary": "سطر", "slides": [{"n": 1, "heading": "عنوان السلايد", "text": "النص", "visual": "ما يُرى"}], "caption": "تعليق نصي المنشور"}')
    elif fmt == "series":
        cnt = f"عدد الحلقات: {episodes} بالضبط" if str(episodes).isdigit() else "أنت الذي تحدد عدد الحلقات المناسب للحكاية (من ٢ لـ ٦)"
        shape = (f'{cnt}. كل سيناريو = مسلسل: {{"title": "...", "summary": "الحكاية في سطرين", "episodes": [{{"n": 1, "title": "عنوان الحلقة", "beats": ["ما يحدث"], "voice": ["جمل التعليق الصوتي"]}}], "caption": "..."}}')
    else:
        shape = ('كل سيناريو = ريل ١٠-٣٠ ثانية: {"title": "...", "summary": "سطر", "beats": [{"t": "٠-٣ث", "what": "ما يُرى", "say": "النص/التعليق الصوتي", "text": "نص على الشاشة إذا فيه"}], "caption": "..."}')
    user = (f"الفكرة التي العميل اخترها:\n{idea}\n\nنوع المنشور: {FORMATS.get(fmt, fmt)}.\n"
            + (f"أبطال المنشور: {', '.join(cast)}\n" if cast else "")
            + (f"طلب العميل: {hint}\n" if hint else "")
            + (("ابعد عن هذه السيناريوهات:\n" + "\n".join(f"- {a}" for a in avoid[-8:]) + "\n") if avoid else "")
            + f"اكتب {n} سيناريوهات مختلفة عن بعض هذه للفكرة على هذا القالب بالضبط: امشي على تسلسل القالب وخاناته ومشاهده (إذا القالب له تسلسل ثابت، "
              "المشاهد تصبح بنفس الترتيب والعدد)، ووصف كل مشهد يصبح باللي القالب فعلًا يرسمه. أول ثانيتين يجب يشدون، والختام فيه دعوة واضحة.\n"
            + algo.for_use("script") + "\n"
            + shape + '\nاستعد JSON فقط: {"scenarios": [ ... ]}')
    return [{"role": "system", "content": _base_system(brand, prefs, tpl, assets)}, {"role": "user", "content": user}]


def refine_messages(brand: str, prefs: str, tpl: dict, assets: list[dict], stage: str, current: dict, chat: list[dict], fmt: str = "") -> list[dict]:
    what = "الفكرة" if stage == "idea" else "السيناريو"
    sys_ = _base_system(brand, prefs, tpl, assets) + (
        f"\n\nأنت تتناقش مع العميل في {what} ما اختره لكي تعدّلها على مزاجه. رد عليه في سطر أو اثنان ودائمًا استعد النسخة المعدّلة كاملة.\n"
        f"استعد JSON فقط: {{\"reply\": \"ردك\", \"item\": {{...نفس شكل {what} بالضبط بعد التعديل...}}}}")
    msgs = [{"role": "system", "content": sys_},
            {"role": "user", "content": f"{what} الحالية:\n{json.dumps(current, ensure_ascii=False)}" + (f"\nنوع المنشور: {FORMATS.get(fmt, fmt)}" if fmt else "")},
            {"role": "assistant", "content": '{"reply": "حسنًا، قولّي تريد تغيّر ماذا", "item": null}'}]
    return msgs + [{"role": m["role"], "content": m["content"]} for m in chat[-12:]]


def params_messages(schema: dict, scenario: dict, brand_name: str, assets: list[dict]) -> list[dict]:
    """قالب موشن بالكود: النموذج يملأ الخانات (نص، ألوان) من السيناريو."""
    # الصور والخطوط والاختيارات بتتملا من البراند أو العميل بيختارها: الموديل بيكتب الكلام والألوان بس، بنصيحة كل خانة وحدها الأقصى
    fields = {k: {"label": v.get("label"), "kind": v.get("kind"), "example": v.get("def"), **({"hint": v["hint"]} if v.get("hint") else {}),
                  **({"max_chars": v["max"]} if v.get("max") and v.get("kind") == "text" else {}), **({"scene": v["group"]} if v.get("group") else {})}
              for k, v in schema.items() if v.get("kind") not in ("image", "font", "toggle", "select", "number")}
    return [{"role": "system", "content": "أنت تملأ خانات قالب موشن جرافيك من سيناريو. كل خانة نصية اجعلها قصيرة مثل المثال الخاص بها بالضبط (نفس الطول تقريبًا) "
                                          "لكي تتناسب مع التصميم. الأرقام بالأرقام العربية (٠١٢٣). الألوان hex. إذا الخانة قائمة (kind=lines) استعد array بنفس عدد العناصر "
                                          "ونفس الشكل (إذا فيها | اجعلها). خانة role=brand = اسم العلامة. متغيّرش الألوان إلا إذا ألوان العلامة معروفة. "
                                          "إذا الخانة لها hint امشي عليه بالضبط، وإذا لها max_chars ماتعدّيهوش. استعد JSON بالمفاتيح فقط."},
            {"role": "user", "content": f"العلامة: {brand_name}\nالخانات:\n{json.dumps(fields, ensure_ascii=False)}\n\nالسيناريو:\n{json.dumps(scenario, ensure_ascii=False)}"}]


# ---------------------------------------------------------------- قوالب الموشن بالكود: قراية خانات القالب من reel.html

def motion_schema(reel: Path) -> dict:
    """يقرأ M.params({...}) من صفحة القالب ويحوّله JSON (القوالب مكتوبة بشكل ثابت)."""
    try:
        src = reel.read_text(encoding="utf-8")
    except OSError:
        return {}
    m = re.search(r"M\.params\((\{.*?\n\})\);", src, re.S)
    if not m:
        return {}
    body = m.group(1)
    # الثوابت النصية اللي فوق (const G1 = "…", G2 = "…") بتتحط مكان اسمها (أسماء المشاهد مثلًا)
    consts = dict(re.findall(r'(?:const|,)\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("(?:[^"\\]|\\.)*")', src[:m.start()]))
    if consts:
        body = re.sub(r":\s*([A-Za-z_][A-Za-z0-9_]*)\b(?=\s*[,}])", lambda z: ": " + consts.get(z.group(1), z.group(1)), body)
    body = re.sub(r"(?m)^\s*//[^\n]*", "", body)
    # المفاتيح بس اللي بتتحط بين علامات تنصيص، مش أي «كلمة:» جوه نص (زي "me: finally")
    body = re.sub(r'("(?:[^"\\]|\\.)*")|(?<=[{,\s])([A-Za-z_][A-Za-z0-9_]*)\s*:', lambda z: z.group(1) or f'"{z.group(2)}":', body)
    body = re.sub(r",\s*([}\]])", r"\1", body)
    try:
        out = json.loads(body)
    except ValueError:
        return {}
    return {k: v for k, v in out.items() if isinstance(v, dict) and "def" in v}


def clean_params(schema: dict, raw: dict) -> dict:
    out = {}
    for k, v in (raw or {}).items():
        sp = schema.get(k)
        if not sp:
            continue
        if sp.get("kind") == "color":
            if isinstance(v, str) and re.fullmatch(r"#[0-9a-fA-F]{3,8}", v.strip()):
                out[k] = v.strip()
        elif isinstance(sp.get("def"), list):
            if isinstance(v, list) and v:
                out[k] = [str(x)[:200] for x in v[:12]]
        elif isinstance(v, (str, int, float)):
            out[k] = str(v)[:300]
    return out


# ---------------------------------------------------------------- تحويل السيناريو لنص (للتوليد في الأقسام التانية)

def scenario_script(sc: dict, fmt: str) -> str:
    """سيناريو ← نص: «المشهد ن — عنوان» والجمل المسموعة بين « »."""
    lines = []
    if fmt == "series":
        return ""
    for i, b in enumerate(sc.get("beats") or [], 1):
        lines.append(f"المشهد {i} — {b.get('what', '')[:120]}")
        if b.get("say"):
            lines.append(f"«{b['say']}»")
        if b.get("text"):
            lines.append(f"[على الشاشة: {b['text']}]")
    return "\n".join(lines)


def episode_script(ep: dict) -> str:
    lines = [f"«{ep.get('title', '')}»"]
    beats, voice = ep.get("beats") or [], ep.get("voice") or []
    for i in range(max(len(beats), len(voice))):
        lines.append(f"المشهد {i + 1} — {(beats[i] if i < len(beats) else '')[:140]}")
        if i < len(voice) and voice[i]:
            lines.append(f"«{voice[i]}»")
    return "\n".join(lines)


def scenario_text(sc: dict, fmt: str) -> str:
    """نص مقروء للسيناريو (يدخل في الوصف النهائي وفي شات الكاروسيل)."""
    out = [sc.get("title", ""), sc.get("summary", "")]
    if fmt == "carousel":
        out += [f"سلايد {s.get('n', i + 1)}: {s.get('heading', '')} — {s.get('text', '')} (الصورة: {s.get('visual', '')})" for i, s in enumerate(sc.get("slides") or [])]
    elif fmt == "series":
        for e in sc.get("episodes") or []:
            out.append(f"الحلقة {e.get('n')}: {e.get('title', '')} — " + " / ".join(e.get("beats") or []))
    else:
        out += [f"{b.get('t', '')}: {b.get('what', '')}" + (f" | «{b['say']}»" if b.get("say") else "") + (f" | على الشاشة: {b['text']}" if b.get("text") else "")
                for b in sc.get("beats") or []]
    if sc.get("caption"):
        out.append(f"التعليق النصي: {sc['caption']}")
    return "\n".join(x for x in out if x)


# ---------------------------------------------------------------- تجربة من غير Atlas (ATLAS_MOCK=1)

def mock_ideas(n: int, k: int = 0, tpl_name: str = "") -> dict:
    base = [("له الصبح يبدأ متأخر؟", "مشكلة وحل"), ("حكاية أول عميل", "حكاية"), ("٣ أشياء محدش قالك عليها", "معلومة"), ("تحدّي الـ ٧ أيام", "تحدّي"), ("قبل وبعد", "مقارنة")]
    return {"ideas": [{"title": f"{base[(i + k) % 5][0]}", "hooks": growth.mock_hooks(i + k), "idea": f"فكرة تجريبية بزاوية {base[(i + k) % 5][1]}.",
                       "fit": f"ماشية على تسلسل قالب «{tpl_name}»", "why": "تكلم الجمهور بلغته",
                       "ring": 1 + (i + k) % 3, "bucket": "أخطاء المبتدئين",
                       "heat": {"h": 8, "e": 7, "a": 8, "t": 7, "r": 8} if (i + k) % 4 != 1 else {"h": 4, "e": 5, "a": 4, "t": 6, "r": 5},
                       "pack": {"screen": "غلطة تعملها كل يوم", "visual": "يد توقف المنبه فجأة", "spoken": "أنت تبدأ يومك خطأ من أول دقيقة",
                                "lockin": "جرّبت أغيّرها ٣٠ يوم، والفرق ظهر من الأسبوع أولًا", "lockin_method": "لمّح للدليل"}} for i in range(n)]}


def mock_scenarios(fmt: str, n: int, episodes) -> dict:
    out = []
    for i in range(n):
        if fmt == "carousel":
            out.append({"title": f"كاروسيل {i + 1}", "summary": "تجربة", "slides": [{"n": j + 1, "heading": f"سلايد {j + 1}", "text": "نص", "visual": "صورة"} for j in range(5)], "caption": "تعليق نصي"})
        elif fmt == "series":
            ne = int(episodes) if str(episodes).isdigit() else 3
            out.append({"title": f"مسلسل {i + 1}", "summary": "تجربة", "episodes": [{"n": j + 1, "title": f"الحلقة {j + 1}", "beats": ["بداية", "نهاية"], "voice": ["جملة", "جملة"]} for j in range(ne)], "caption": "تعليق نصي"})
        else:
            out.append({"title": f"ريل {i + 1}", "summary": "تجربة", "beats": [{"t": "٠-٣ث", "what": "لقطة تشد", "say": "انتظر!", "text": "انتظر"}, {"t": "٣-١٠ث", "what": "الحل", "say": "جرّب هذا", "text": ""}], "caption": "تعليق نصي"})
    return {"scenarios": out}


# ---------------------------------------------------------------- 🗓️ دراع المواسم: الأعياد والمواسم والمناسبات لبلد (أو كل دول منطقة) الجمهور

def seasons_messages(market: str, audience: str, domain: str, today: str) -> list[dict]:
    return [{"role": "system", "content": "أنت خبير تسويق ومحتوى في الشرق الأوسط والعالم، تعرف التقاويم الرسمية والدينية (هجري وميلادي) والمواسم التجارية والاجتماعية لكل بلد."},
            {"role": "user", "content":
             f"اليوم {today}. سوق العلامة: {market or '(غير محدد)'}. الجمهور: {audience or '(غير محدد)'}. مجال العلامة: {domain or '(غير محدد)'}.\n"
             "١) حدد البلد المستهدف. إذا السوق منطقة (مثل الخليج، الشام، شمال أفريقيا، الوطن العربية، أوروبا...) اجلب كل هؤلاء هذه المنطقة.\n"
             "٢) لكل بلد، اجلب كل المناسبات في الـ ١٢ شهر الجايين من اليوم: الأعياد الرسمية والوطنية، المناسبات الدينية (تاريخها الميلادي المتوقع)، "
             "المواسم (رمضان، الصيف، الدراسة، الشتاء...)، والمناسبات التجارية والاجتماعية (عيد الأم، الجمعة البيضاء، رأس السنة، يوم المعلم...) "
             "التي تهم جمهور هذه العلامة. لا تقترح مناسبة لا يحتفل بها أهل هذا السوق أو لا تناسب ثقافته (مثل الهالوين أو الكريسماس لسوق عربي). المناسبة التي مشتركة بين أكثر من بلد اكتبها مرة واحدة وحط البلاد كلها.\n"
             "٣) لكل مناسبة اقترح زاوية محتوى قصيرة تناسب العلامة.\n"
             'استعد JSON فقط: {"target": "البلد أو المنطقة", "countries": ["..."], "items": [{"name": "اسم المناسبة", "date": "YYYY-MM-DD", "end": "YYYY-MM-DD أو فارغ", '
             '"countries": ["..."], "type": "رسمي|ديني|موسم|تجاري|اجتماعي", "angle": "زاوية محتوى للعلامة"}]}'}]


# 🕌 مناسبات مش من ثقافة الأسواق العربية: ماتتقترحش لعلامة سوقها عربي (السعودية، الخليج، مصر…)
ARAB_MARKET = re.compile(r"سعود|خليج|الرياض|جدة|مكة|إمارات|دبي|أبوظبي|كويت|قطر|بحرين|عمان|عُمان|مصر|القاهرة|أردن|عراق|سوري|لبنان|فلسطين|يمن|ليبيا|تونس|جزائر|مغرب|سودان|عرب|"
                         r"saudi|ksa|uae|gulf|gcc|kuwait|qatar|bahrain|oman|egypt|jordan|iraq|arab", re.I)
FOREIGN_OCCASION = re.compile(r"هالوين|الهالوين|halloween|عيد الفصح|easter|عيد الشكر|thanksgiving|سانت باتريك|patrick|الكريسماس|كريسماس|christmas|"
                              r"عيد الميلاد المجيد|هانوكا|hanukkah|ديوالي|diwali|الفالنتاين|فالنتاين|عيد الحب|valentine", re.I)


def arab_market(market: str) -> bool:
    return bool(ARAB_MARKET.search(market or ""))


def fit_seasons(items: list[dict], market: str) -> list[dict]:
    """يشيل المناسبات اللي مش من ثقافة السوق (هالوين لبراند سعودي مثلًا)."""
    if not arab_market(market):
        return items
    return [i for i in items if not FOREIGN_OCCASION.search(f"{i.get('name', '')} {i.get('angle', '')[:40]}")]


def clean_seasons(raw: dict) -> dict:
    items = []
    for it in (raw.get("items") or [])[:120]:
        if not isinstance(it, dict) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(it.get("date") or "")):
            continue
        items.append({"name": str(it.get("name") or "")[:80], "date": it["date"], "end": str(it.get("end") or "")[:10] if re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(it.get("end") or "")) else "",
                      "countries": [str(c)[:40] for c in (it.get("countries") or [])][:20], "type": str(it.get("type") or "")[:20], "angle": str(it.get("angle") or "")[:300]})
    items.sort(key=lambda x: x["date"])
    return {"target": str(raw.get("target") or "")[:80], "countries": [str(c)[:40] for c in (raw.get("countries") or [])][:30], "items": items}


def mock_seasons(today: str) -> dict:
    y = int(today[:4])
    return {"target": "مصر", "countries": ["مصر"], "items": [{"name": "رأس السنة", "date": f"{y + 1}-01-01", "end": "", "countries": ["مصر"], "type": "اجتماعي", "angle": "بداية جديدة"},
                                                           {"name": "عيد الأم", "date": f"{y + 1}-03-21", "end": "", "countries": ["مصر"], "type": "اجتماعي", "angle": "شكرًا يا ماما"}]}


# ---------------------------------------------------------------- 🎙️ قوالب الكود بفويس أوفر: السكريبت على مشاهد القالب، والمشاهد على قد الصوت
MAX_STRETCH = 1.5   # نفس MAXS في core.js: أكتر من كده المشهد بيقف ثابت لحد ما الجملة تخلص
LEAD, TAIL = 0.25, 0.7   # المشهد بيبدأ قبل الكلام بشوية، وآخر مشهد بيكمّل بعد آخر كلمة


def scene_fields(schema: dict, scenes: list[dict]) -> dict[str, list[str]]:
    """الخانات النصية لكل مشهد (بالـ group)، بدون الألوان والخطوط والصور والاختيارات."""
    names = {sc["name"] for sc in scenes}
    out: dict[str, list[str]] = {sc["name"]: [] for sc in scenes}
    for k, v in schema.items():
        if v.get("kind") in ("text", "lines", None) and v.get("group") in names:
            out[v["group"]].append(k)
    return out


def motion_script_messages(brand: str, prefs: str, tpl: dict, schema: dict, scenes: list[dict], idea: str, lang_label: str, guide: str,
                           cps: float, n: int, avoid: list[str], hint: str) -> list[dict]:
    """نص لقالب كود: لكل مشهد جملة تعليق صوتي على قدر وقته + النص الذي يظهر في خانات هذا المشهد."""
    fields = scene_fields(schema, scenes)
    rows = []
    for sc in scenes:
        sec = round(sc["t1"] - sc["t0"], 1)
        rows.append({"scene": sc["name"], "seconds": sec, "what_happens": sc.get("about", ""), "max_say_chars": int(sec * cps * 1.15),
                     "fields": {k: {"label": schema[k].get("label"), "example": schema[k].get("def"), **({"hint": schema[k]["hint"]} if schema[k].get("hint") else {}),
                                    **({"max_chars": schema[k]["max"]} if schema[k].get("max") else {})} for k in fields[sc["name"]]}})
    sys = ("أنت كاتب إعلانات ومحتوى سوشيال. هذا القالب فيديو يُرسم بالكود: مشاهده ثابتة وحركتها ثابتة، والمتغيّر النص فقط. "
           "لكل مشهد اكتب: say = جملة تعليق صوتي واحدة تُقال على هذا المشهد (طبيعية ومتكلّمة، ماتعدّيش max_say_chars لكي المشهد مايتمطش جدًا)، "
           "وfields = النص الذي يظهر في خانات المشهد (قصير مثل المثال، وماتعدّيش max_chars، وإذا الخانة قائمة استعد array بنفس عدد العناصر وشكلها). "
           "الجمل يجب تُكمل بعض كقصة واحدة بالترتيب، وماتكررش النص المكتوب على الشاشة حرفيًا في التعليق الصوتي (الصوت يشرح والشاشة تلخّص). "
           f"لغة التعليق الصوتي والنص: {lang_label}. {guide} الأرقام بالأرقام العربية (٠١٢٣). "
           'استعد JSON: {"scripts":[{"title":"","summary":"","caption":"","scenes":[{"scene":"اسم المشهد بالضبط","say":"","fields":{}}]}]}')
    user = (f"العلامة:\n{brand}\n\n{prefs}\n\nالقالب: {tpl.get('name', '')}\n{tpl.get('profile', '')}\n\nالفكرة:\n{idea}\n\n"
            f"المشاهد بالترتيب:\n{json.dumps(rows, ensure_ascii=False)}\n\nاكتب {n} نص مختلفين.")
    if avoid:
        user += "\nماتكررش هؤلاء: " + "، ".join(avoid)
    if hint:
        user += f"\nطلب العميل: {hint}"
    return [{"role": "system", "content": sys}, {"role": "user", "content": user}]


def clean_scripts(raw: dict, schema: dict, scenes: list[dict]) -> list[dict]:
    """يضبط رد العقل: كل مشهد ترتيبه (حتى إذا اسمه جه خطأ)، والخانات المسموحة فقط."""
    fields, out = scene_fields(schema, scenes), []
    for s in (raw.get("scripts") or [])[:4]:
        if not isinstance(s, dict):
            continue
        got = [x for x in s.get("scenes") or [] if isinstance(x, dict)]
        by = {str(x.get("scene") or "").strip(): x for x in got}
        rows = []
        for i, sc in enumerate(scenes):
            x = by.get(sc["name"]) or (got[i] if i < len(got) else {})
            f = x.get("fields") if isinstance(x.get("fields"), dict) else {}
            rows.append({"scene": sc["name"], "say": str(x.get("say") or "").strip()[:400],
                         "fields": clean_params({k: schema[k] for k in fields[sc["name"]]}, f)})
        out.append({"title": str(s.get("title") or "")[:120], "summary": str(s.get("summary") or "")[:400], "caption": str(s.get("caption") or "")[:600], "scenes": rows})
    return out


def mock_scripts(schema: dict, scenes: list[dict], n: int) -> dict:
    fields = scene_fields(schema, scenes)
    return {"scripts": [{"title": f"نص تجريبي {j + 1}", "summary": "نص للتجربة بدون العقل", "caption": "تعليق نصي تجريبي",
                         "scenes": [{"scene": sc["name"], "say": f"هذه جملة المشهد {i + 1} للتجربة.", "fields": {k: schema[k].get("def") for k in fields[sc["name"]]}}
                                    for i, sc in enumerate(scenes)]} for j in range(n)]}


def say_seconds(text: str, cps: float) -> float:
    return round(len(re.sub(r"\s+", " ", text or "").strip()) / cps, 1) if text else 0.0


def vo_plan(scenes: list[dict], dur: float, spans: list[tuple[float, float] | None], vo_dur: float) -> dict:
    """طول كل مشهد على قدر جملته، ومكان كل جزء صوت في الفيديو الجديد.
    scenes = مشاهد القالب بترتيب M.meta (t0/t1 الأصليين)، spans = (بداية، نهاية) الجملة في ملف الصوت لكل مشهد (None = بدون نص).
    يجب يسير بنفس طريقة timeMap في core.js: الفراغات بين المشاهد تظل بطولها."""
    timing = [0.0] * len(scenes)
    last_voiced = max((i for i, sp in enumerate(spans) if sp), default=-1)
    for i, sc in enumerate(scenes):
        L = max(0.01, min(sc["t1"], dur) - sc["t0"])
        sp = spans[i] if i < len(spans) else None
        if not sp:
            timing[i] = round(L, 3)
            continue
        need = (sp[1] - sp[0]) + LEAD + (TAIL if i == last_voiced else 0.15)
        timing[i] = round(max(need, L / MAX_STRETCH), 3)
    # أماكن المشاهد في الوقت الجديد (نفس ترتيب core: بالـ t0، والفراغات زي ما هي)
    order = sorted(range(len(scenes)), key=lambda i: scenes[i]["t0"])
    starts, cur, r = [0.0] * len(scenes), 0.0, 0.0
    for i in order:
        a, b = max(scenes[i]["t0"], cur), min(scenes[i]["t1"], dur)
        if b <= a:
            continue
        if a > cur:
            r += a - cur
        starts[i] = r
        r += timing[i]
        cur = b
    total = r + max(0.0, dur - cur)
    pieces = [{"from": round(max(0.0, spans[i][0] - 0.05), 3), "to": round(min(vo_dur, spans[i][1]), 3), "at": round(starts[i] + LEAD, 3)}
              for i in range(len(scenes)) if i < len(spans) and spans[i]]
    return {"timing": timing, "total": round(total, 3), "pieces": pieces}
