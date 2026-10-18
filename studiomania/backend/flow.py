"""🧭 مسار القالب: بعد ما العميل يدوس على قالب، المخ بيمشي معاه خطوة بخطوة:
الفكرة ← نوع البوست (ريل / كاروسيل / مسلسل) ← السيناريو ← الأبطال ← الملفات (@منشن) ← التوليد.
في كل خطوة المخ بيقترح أكتر من اختيار، والعميل يختار أو يعدّل أو يتناقش أو يطلب غيرهم أو يكتب بنفسه،
وكل لايك/ديسلايك بيتسجل في المخ عشان يعرف ذوقه أكتر.

البرومبتات هنا هي «دراع المخ»: بتتبني من ملف البراند + ذوق العميل اللي اتعلّمه + روح القالب،
فبتتغير لوحدها كل ما المخ يعرف أكتر."""
from __future__ import annotations

import json
import re
from pathlib import Path

import growth
import algo

FORMATS = {"reel": "ريل (فيديو قصير)", "carousel": "كاروسيل (صور ورا بعض)", "series": "مسلسل (كذا حلقة)"}
STAGES = ("idea", "format", "scenario", "cast", "assets", "generate", "done")


# ---------------------------------------------------------------- ذوق العميل (اللي المخ اتعلّمه)

def prefs_text(brain: dict | None, limit: int = 24) -> str:
    """آخر اللايكات والديسلايكات كسطور بتدخل في كل برومبت."""
    prefs = (brain or {}).get("prefs") or []
    if not prefs:
        return ""
    likes = [p for p in prefs if p.get("value", 0) > 0][-limit // 2:]
    dislikes = [p for p in prefs if p.get("value", 0) < 0][-limit // 2:]
    out = []
    if likes:
        out.append("حاجات العميل حبها قبل كده (امشي على روحها):\n" + "\n".join(f"- [{p.get('kind')}] {p.get('text', '')[:220]}"
                                                                         + (f" — السبب: {p['reason']}" if p.get("reason") else "") for p in likes))
    if dislikes:
        out.append("حاجات العميل رفضها (ابعد عنها):\n" + "\n".join(f"- [{p.get('kind')}] {p.get('text', '')[:220]}"
                                                                 + (f" — السبب: {p['reason']}" if p.get("reason") else "") for p in dislikes))
    return "\n".join(out)


def knowledge(brain: dict | None, fields: tuple[str, ...], kinds: tuple[str, ...]) -> dict:
    """«المخ يعرفك قد إيه»: نسبة من ١٠٠ محسوبة من عدد المعلومات اللي عنده عن البراند وذوقك."""
    b = brain or {}
    filled = sum(1 for k in fields if str(b.get(k) or "").strip() and k not in ("type", "logo_on", "intro_on", "outro_on"))
    assets = sum(len(b.get(k) or []) for k in kinds)
    notes = len(b.get("notes") or [])
    prefs = len(b.get("prefs") or [])
    seasons = 1 if (b.get("seasons") or {}).get("items") else 0
    # كل نوع معلومة ليه سقف عشان محدش يملا النسبة من حتة واحدة
    score = (min(filled, 14) / 14 * 40 + min(assets, 12) / 12 * 15 + min(notes, 20) / 20 * 15 + min(prefs, 30) / 30 * 25 + seasons * 5)
    score = round(min(100, score))
    level = ("لسه بيتعرّف عليك" if score < 25 else "بدأ يفهمك" if score < 50 else "فاهمك كويس" if score < 75 else "حافظك")
    tips = []
    if filled < 8:
        tips.append("كمّل بيانات البراند (الجمهور، القواعد، الألوان، اللغة)")
    if assets < 3:
        tips.append("ارفع لوجو وصور منتج وشخصيات")
    if notes < 5:
        tips.append("زوّد مصادر (لينك موقعك، ملف تعريفي) في عقل البراند")
    if prefs < 10:
        tips.append("قيّم الأفكار والسيناريوهات باللايك والديسلايك")
    return {"score": score, "level": level, "counts": {"fields": filled, "assets": assets, "notes": notes, "prefs": prefs, "seasons": seasons}, "tips": tips[:3]}


# ---------------------------------------------------------------- البرومبتات (دراع المخ)

def _tpl_line(tpl: dict) -> str:
    kind = {"motion": "قالب موشن جرافيك بالكود (شكله وحركته ثابتين، النصوص والألوان بس اللي بتتغير)", "scene": "قالب فيديو متولّد بالذكاء الاصطناعي بستايل ثابت",
            "ad": "قالب إعلان بشخصية ومنتج", "still": "قالب صور منتج ثابتة", "typo": "قالب كلام متحرك (تايبوجرافي)"}.get(tpl.get("kind"), "قالب")
    out = f"القالب اللي العميل اختاره: «{tpl.get('name', '')}» — {kind}.\nروحه: {tpl.get('desc', '')}"
    if tpl.get("profile"):
        out += "\n\nبطاقة القالب (اقراها كويس، الشغل كله لازم يتبني عليها):\n" + tpl["profile"]
    return out


TPL_RULE = ("القالب هو نقطة البداية مش ديكور: العميل اختار القالب ده عشان شكله وطريقة حكيه. أي فكرة أو سيناريو لازم يستخدم اللي القالب بيقدمه "
            "(تسلسله، خاناته، مشاهده، حركته، نوع بطله) كوسيلة الحكي نفسها. لو الفكرة تنفع تتعمل بأي قالب تاني بنفس السهولة يبقى غلط. "
            "اسأل نفسك: ليه الفكرة دي محتاجة القالب ده بالذات؟ ولو القالب بعيد عن مجال البراند، دوّر على الزاوية الذكية اللي توصل البراند بعالم القالب.")


def _base_system(brand: str, prefs: str, tpl: dict, assets: list[dict]) -> str:
    parts = ["إنت «مخ البراند»: كاتب ومخرج محتوى سوشيال شاطر بيعرف البراند ده كويس. اكتب بنفس لغة ولهجة البراند (لو مش محددة: عربي مصري خفيف).",
             "ملف البراند:\n" + (brand or "(لسه مفيش بيانات كتير عن البراند)"), _tpl_line(tpl), TPL_RULE, growth.psych_rule(), algo.rule("core")]
    if prefs:
        parts.append(prefs)
    if assets:
        parts.append("ملفات العميل المرفوعة للشغل ده (ممكن يعملها منشن بـ @الاسم):\n" + "\n".join(f"- @{a['name']} ({a.get('kind', 'صورة')})" for a in assets))
    parts.append("ممنوع: ماركات أو أشخاص حقيقيين مش بتوع البراند، وعود طبية أو مالية مبالغ فيها، أي حاجة ضد قواعد البراند. "
                 "وممنوع تخترع أرقام أو إحصائيات أو أسعار أو خصومات أو عروض مش مكتوبة في ملف البراند: لو الفكرة محتاجة رقم حقيقي "
                 "اكتب مكانه [رقمك] أو [السعر] بين قوسين عشان العميل يكتبه بنفسه.")
    return "\n\n".join(parts)


def ideas_messages(brand: str, prefs: str, tpl: dict, assets: list[dict], n: int, avoid: list[str], hint: str, season: str = "", extra: str = "") -> list[dict]:
    user = (f"اقترح {n} أفكار لبوست على قالب «{tpl.get('name', '')}» للبراند ده. كل فكرة مولودة من القالب: مبنية على تسلسله وخاناته وشكله، "
            "ومختلفة عن التانية في الزاوية (مشكلة وحل، حكاية، معلومة، عرض، مقارنة...) بس كلها جوه عالم القالب.\n"
            + (f"طلب العميل: {hint}\n" if hint else "")
            + (f"المناسبة/الموسم: {season}\n" if season else "")
            + (("ابعد عن الأفكار دي (اتقالت قبل كده):\n" + "\n".join(f"- {a}" for a in avoid[-12:]) + "\n") if avoid else "")
            + growth.hooks_rule() + "\n" + algo.for_use("ideas") + "\n"
            + "لكل فكرة اعمل «pack» للهوك الأعلى درجة بطريقة الهوك التلاتي: المكتوب والمعروض والمنطوق بيقولوا نفس المعنى بالظبط، "
              "ويعدّوا اختبار الصوت المقفول، وبعدهم جملتين قفل بطريقة من الـ ٦ (لمّح للدليل، لمّح للتحوّل، تباين سريع، الصندوق السحري، رد على الاعتراض، أكّد الادعاء).\n"
            + (extra + "\n" if extra else "")
            + 'رجّع JSON بالشكل ده بس: {"ideas": [{"title": "عنوان قصير", '
              '"hooks": [{"text": "الهوك", "formula": "اسم القالب", "score": 8.5, "why": "ليه الدرجة دي", "principle": "المبدأ النفسي"}, {...}, {...}], '
              '"pack": {"screen": "الهوك المكتوب على الشاشة (٣–١٠ كلمات، سطرين بالكتير، من غير علامات ترقيم)", "visual": "اللي بيتشاف في أول ثانيتين (حركة/تباين/حاجة غير متوقعة)", '
              '"spoken": "أول جملة بتتقال", "lockin": "الجملتين اللي بعد الهوك على طول (بيأكدوا الوعد وفيهم دليل أو لمحة)", "lockin_method": "طريقة القفل"}, '
              '"idea": "الفكرة في ٢-٣ جمل، بتوصف اللي هيتشاف في القالب", '
              '"fit": "إزاي الفكرة ماشية على القالب: أنهي جزء/خانة/مشهد في القالب بيعمل إيه", "why": "ليه تنفع للبراند ده"}]}')
    return [{"role": "system", "content": _base_system(brand, prefs, tpl, assets)}, {"role": "user", "content": user}]


def scenarios_messages(brand: str, prefs: str, tpl: dict, assets: list[dict], idea: str, fmt: str, episodes, cast: list[str], n: int, avoid: list[str], hint: str) -> list[dict]:
    if fmt == "carousel":
        shape = ('كل سيناريو = سلايدات (من ٥ لـ ٨): {"title": "...", "summary": "سطر", "slides": [{"n": 1, "heading": "عنوان السلايد", "text": "الكلام", "visual": "اللي بيتشاف"}], "caption": "كابشن البوست"}')
    elif fmt == "series":
        cnt = f"عدد الحلقات: {episodes} بالظبط" if str(episodes).isdigit() else "إنت اللي تحدد عدد الحلقات المناسب للحكاية (من ٢ لـ ٦)"
        shape = (f'{cnt}. كل سيناريو = مسلسل: {{"title": "...", "summary": "الحكاية في سطرين", "episodes": [{{"n": 1, "title": "عنوان الحلقة", "beats": ["اللي بيحصل"], "voice": ["جمل الفويس أوفر"]}}], "caption": "..."}}')
    else:
        shape = ('كل سيناريو = ريل ١٠-٣٠ ثانية: {"title": "...", "summary": "سطر", "beats": [{"t": "٠-٣ث", "what": "اللي بيتشاف", "say": "الكلام/الفويس أوفر", "text": "كلام على الشاشة لو فيه"}], "caption": "..."}')
    user = (f"الفكرة اللي العميل اختارها:\n{idea}\n\nنوع البوست: {FORMATS.get(fmt, fmt)}.\n"
            + (f"أبطال البوست: {', '.join(cast)}\n" if cast else "")
            + (f"طلب العميل: {hint}\n" if hint else "")
            + (("ابعد عن السيناريوهات دي:\n" + "\n".join(f"- {a}" for a in avoid[-8:]) + "\n") if avoid else "")
            + f"اكتب {n} سيناريوهات مختلفة عن بعض للفكرة دي على القالب ده بالظبط: امشي على تسلسل القالب وخاناته ومشاهده (لو القالب له تسلسل ثابت، "
              "المشاهد تبقى بنفس الترتيب والعدد)، ووصف كل مشهد يبقى باللي القالب فعلًا بيرسمه. أول ثانيتين لازم يشدوا، والختام فيه دعوة واضحة.\n"
            + algo.for_use("script") + "\n"
            + shape + '\nرجّع JSON بس: {"scenarios": [ ... ]}')
    return [{"role": "system", "content": _base_system(brand, prefs, tpl, assets)}, {"role": "user", "content": user}]


def refine_messages(brand: str, prefs: str, tpl: dict, assets: list[dict], stage: str, current: dict, chat: list[dict], fmt: str = "") -> list[dict]:
    what = "الفكرة" if stage == "idea" else "السيناريو"
    sys_ = _base_system(brand, prefs, tpl, assets) + (
        f"\n\nإنت بتتناقش مع العميل في {what} اللي اختاره عشان تعدّلها على مزاجه. رد عليه في سطر أو اتنين ودايمًا رجّع النسخة المعدّلة كاملة.\n"
        f"رجّع JSON بس: {{\"reply\": \"ردك\", \"item\": {{...نفس شكل {what} بالظبط بعد التعديل...}}}}")
    msgs = [{"role": "system", "content": sys_},
            {"role": "user", "content": f"{what} الحالية:\n{json.dumps(current, ensure_ascii=False)}" + (f"\nنوع البوست: {FORMATS.get(fmt, fmt)}" if fmt else "")},
            {"role": "assistant", "content": '{"reply": "تمام، قولّي عايز تغيّر إيه", "item": null}'}]
    return msgs + [{"role": m["role"], "content": m["content"]} for m in chat[-12:]]


def params_messages(schema: dict, scenario: dict, brand_name: str, assets: list[dict]) -> list[dict]:
    """قالب موشن بالكود: الموديل بيملا الخانات (كلام، ألوان) من السيناريو."""
    # الصور والخطوط والاختيارات بتتملا من البراند أو العميل بيختارها: الموديل بيكتب الكلام والألوان بس، بنصيحة كل خانة وحدها الأقصى
    fields = {k: {"label": v.get("label"), "kind": v.get("kind"), "example": v.get("def"), **({"hint": v["hint"]} if v.get("hint") else {}),
                  **({"max_chars": v["max"]} if v.get("max") and v.get("kind") == "text" else {}), **({"scene": v["group"]} if v.get("group") else {})}
              for k, v in schema.items() if v.get("kind") not in ("image", "font", "toggle", "select", "number")}
    return [{"role": "system", "content": "إنت بتملا خانات قالب موشن جرافيك من سيناريو. كل خانة نصية خليها قصيرة زي المثال بتاعها بالظبط (نفس الطول تقريبًا) "
                                          "عشان تتناسب مع التصميم. الأرقام بالأرقام العربي (٠١٢٣). الألوان hex. لو الخانة قايمة (kind=lines) رجّع array بنفس عدد العناصر "
                                          "وبنفس الشكل (لو فيها | خليها). خانة role=brand = اسم البراند. متغيّرش الألوان إلا لو ألوان البراند معروفة. "
                                          "لو الخانة ليها hint امشي عليه بالظبط، ولو ليها max_chars ماتعدّيهوش. رجّع JSON بالمفاتيح بس."},
            {"role": "user", "content": f"البراند: {brand_name}\nالخانات:\n{json.dumps(fields, ensure_ascii=False)}\n\nالسيناريو:\n{json.dumps(scenario, ensure_ascii=False)}"}]


# ---------------------------------------------------------------- قوالب الموشن بالكود: قراية خانات القالب من reel.html

def motion_schema(reel: Path) -> dict:
    """بيقرا M.params({...}) من صفحة القالب ويحوّله JSON (القوالب مكتوبة بشكل ثابت)."""
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
    body = re.sub(r'(?<=[{,\s])([A-Za-z_][A-Za-z0-9_]*)\s*:', r'"\1":', body)
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
    """سيناريو ← سكريبت: «المشهد ن — عنوان» والجمل المسموعة بين « »."""
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
    """نص مقروء للسيناريو (بيدخل في البرومبت النهائي وفي شات الكاروسيل)."""
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
        out.append(f"الكابشن: {sc['caption']}")
    return "\n".join(x for x in out if x)


# ---------------------------------------------------------------- تجربة من غير Atlas (ATLAS_MOCK=1)

def mock_ideas(n: int, k: int = 0, tpl_name: str = "") -> dict:
    base = [("ليه الصبح بيبدأ متأخر؟", "مشكلة وحل"), ("حكاية أول عميل", "حكاية"), ("٣ حاجات محدش قالك عليها", "معلومة"), ("تحدّي الـ ٧ أيام", "تحدّي"), ("قبل وبعد", "مقارنة")]
    return {"ideas": [{"title": f"{base[(i + k) % 5][0]}", "hooks": growth.mock_hooks(i + k), "idea": f"فكرة تجريبية بزاوية {base[(i + k) % 5][1]}.",
                       "fit": f"ماشية على تسلسل قالب «{tpl_name}»", "why": "بتكلم الجمهور بلغته",
                       "ring": 1 + (i + k) % 3, "bucket": "أخطاء المبتدئين",
                       "heat": {"h": 8, "e": 7, "a": 8, "t": 7, "r": 8} if (i + k) % 4 != 1 else {"h": 4, "e": 5, "a": 4, "t": 6, "r": 5},
                       "pack": {"screen": "غلطة بتعملها كل يوم", "visual": "إيد بتوقف المنبه فجأة", "spoken": "انت بتبدأ يومك غلط من أول دقيقة",
                                "lockin": "جرّبت أغيّرها ٣٠ يوم، والفرق ظهر من الأسبوع الأول", "lockin_method": "لمّح للدليل"}} for i in range(n)]}


def mock_scenarios(fmt: str, n: int, episodes) -> dict:
    out = []
    for i in range(n):
        if fmt == "carousel":
            out.append({"title": f"كاروسيل {i + 1}", "summary": "تجربة", "slides": [{"n": j + 1, "heading": f"سلايد {j + 1}", "text": "كلام", "visual": "صورة"} for j in range(5)], "caption": "كابشن"})
        elif fmt == "series":
            ne = int(episodes) if str(episodes).isdigit() else 3
            out.append({"title": f"مسلسل {i + 1}", "summary": "تجربة", "episodes": [{"n": j + 1, "title": f"الحلقة {j + 1}", "beats": ["بداية", "نهاية"], "voice": ["جملة", "جملة"]} for j in range(ne)], "caption": "كابشن"})
        else:
            out.append({"title": f"ريل {i + 1}", "summary": "تجربة", "beats": [{"t": "٠-٣ث", "what": "لقطة بتشد", "say": "استنى!", "text": "استنى"}, {"t": "٣-١٠ث", "what": "الحل", "say": "جرّب ده", "text": ""}], "caption": "كابشن"})
    return {"scenarios": out}


# ---------------------------------------------------------------- 🗓️ دراع المواسم: الأعياد والمواسم والمناسبات لبلد (أو كل دول منطقة) الجمهور

def seasons_messages(market: str, audience: str, domain: str, today: str) -> list[dict]:
    return [{"role": "system", "content": "إنت خبير تسويق ومحتوى في الشرق الأوسط والعالم، عارف التقاويم الرسمية والدينية (هجري وميلادي) والمواسم التجارية والاجتماعية لكل بلد."},
            {"role": "user", "content":
             f"النهارده {today}. سوق البراند: {market or '(مش محدد)'}. الجمهور: {audience or '(مش محدد)'}. مجال البراند: {domain or '(مش محدد)'}.\n"
             "١) حدد البلد المستهدف. لو السوق منطقة (زي الخليج، الشام، شمال أفريقيا، الوطن العربي، أوروبا...) هات كل دول المنطقة دي.\n"
             "٢) لكل بلد، هات كل المناسبات في الـ ١٢ شهر الجايين من النهارده: الأعياد الرسمية والوطنية، المناسبات الدينية (بتاريخها الميلادي المتوقع)، "
             "المواسم (رمضان، الصيف، الدراسة، الشتا...)، والمناسبات التجارية والاجتماعية (عيد الأم، الجمعة البيضا، الفالنتاين، رأس السنة، يوم المعلم...) "
             "اللي تهم جمهور البراند ده. المناسبة اللي مشتركة بين أكتر من بلد اكتبها مرة واحدة وحط البلاد كلها.\n"
             "٣) لكل مناسبة اقترح زاوية محتوى قصيرة تناسب البراند.\n"
             'رجّع JSON بس: {"target": "البلد أو المنطقة", "countries": ["..."], "items": [{"name": "اسم المناسبة", "date": "YYYY-MM-DD", "end": "YYYY-MM-DD أو فاضي", '
             '"countries": ["..."], "type": "رسمي|ديني|موسم|تجاري|اجتماعي", "angle": "زاوية محتوى للبراند"}]}'}]


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
