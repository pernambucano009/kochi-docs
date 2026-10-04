"""الإعلانات: تفصيص إعلان مرجعي (مشاهد، فكرة، تصوير، إخراج، أصوات، مؤثرات) واقتراح تنفيذه لكوتشي.

التحليل بيتعمل بموديل بيفهم الفيديو والصوت مع بعض (Gemini عن طريق Atlas)، وبعده تحليل للصوت لوحده
بتفاصيل أكتر، والاقتراح بيكتبه موديل الكلام.
"""

from __future__ import annotations

import json
import re

VIDEO_FORMAT = """{
  "title": "اسم قصير للإعلان",
  "brand": "البراند أو المنتج اللي في الإعلان (لو باين)",
  "summary": "ملخص الإعلان في جملتين",
  "idea": "الفكرة الإبداعية الأساسية (Big Idea) وليه بتشتغل",
  "hook": "أول 3 ثواني: إيه اللي بيشد المشاهد",
  "structure": "بناء الإعلان (مثلًا: مشكلة ← تصاعد ← حل ← CTA)",
  "audience": "الجمهور المستهدف",
  "tone": "النبرة والإحساس العام",
  "cta": "الدعوة للفعل في الآخر",
  "cinematography": "طريقة التصوير: العدسات، حركة الكاميرا، الإضاءة، الألوان، الكادرات",
  "direction": "الإخراج: أداء الممثلين، الإيقاع، التمثيل، طريقة سرد القصة",
  "editing": "المونتاج: سرعة القطع، الانتقالات، الجرافيك والكلام على الشاشة",
  "colors": "الألوان المسيطرة والـ Color Grading",
  "scenes": [
    {"n": 1, "start": 0.0, "end": 2.5,
     "visual": "اللي بيحصل في المشهد",
     "shot": "نوع اللقطة (close-up / wide / POV ...)",
     "camera": "حركة الكاميرا والعدسة",
     "on_screen_text": "الكلام المكتوب على الشاشة لو فيه",
     "voice": "الكلام اللي بيتقال حرفيًا (لو فيه) ومين بيقوله",
     "sfx": "المؤثرات الصوتية في المشهد",
     "music": "الموسيقى في المشهد",
     "transition": "الانتقال للمشهد اللي بعده",
     "purpose": "وظيفة المشهد في الإعلان"}
  ]
}"""

AUDIO_FORMAT = """{
  "voices": [{"who": "مين (راوي / ممثل / ...)", "gender": "", "age": "", "language": "اللغة واللهجة",
              "tone": "النبرة", "emotion": "الإحساس", "pace": "السرعة", "delivery": "طريقة الأداء"}],
  "transcript": [{"start": 0.0, "end": 1.5, "speaker": "", "text": "الكلام حرفيًا"}],
  "music": {"genre": "", "mood": "", "tempo_bpm": 0, "key": "لو واضح", "instruments": "",
            "energy": "إزاي الطاقة بتطلع وتنزل على طول الإعلان", "role": "دور الموسيقى في الإعلان",
            "moments": [{"t": 0.0, "event": "دخول / drop / سكوت / تغيير"}]},
  "sfx": [{"t": 0.0, "sound": "الصوت", "purpose": "ليه موجود"}],
  "ambience": "الصوت المحيط (جو المكان)",
  "mix": "توازن الصوت: الكلام مقابل الموسيقى والمؤثرات، وأي تقنيات (ducking، صمت مقصود...)",
  "sound_design_notes": "أهم حاجة في تصميم الصوت ممكن نتعلمها"
}"""

ADAPT_FORMAT = """{
  "title": "اسم الإعلان المقترح لكوتشي",
  "concept": "الفكرة في جملتين",
  "why_it_fits": "ليه الفكرة دي مناسبة لكوتشي ولجمهوره، وإيه اللي اتاخد من الإعلان الأصلي وإيه اللي اتغير",
  "kochi_angle": "إزاي كوتشي (التطبيق / المدربين / المتدربين) بيظهر في الإعلان",
  "duration": 30,
  "format": "9:16 ريلز / تيك توك ...",
  "hook": "أول 3 ثواني",
  "angle": "الزاوية / الرسالة البيعية اللي الإعلان ماشي بيها (جملة)",
  "tone": "الإحساس والتون (كلمتين)",
  "palette": "ألوان الإعلان ده بالـ hex ودور كل لون (الخلفيات، الإضاءة، اللبس، الجرافيك)",
  "scenes": [
    {"n": 1, "seconds": 3, "ref_scene": 1,
     "motion_graphics": "الموشن جرافيك في المشهد بالتفصيل (بالعربي): كل عنصر متحرك (كارت، شاشة تطبيق، أيقونة، كلام متحرك، لوجو، أشكال) إزاي بيدخل ويتحرك ويخرج، بالتوقيت جوه المشهد (من ثانية كام لكام)، الاتجاه والسرعة والـ easing، والانتقال للمشهد اللي بعده. نفس بناء الموشن في المشهد الأصلي بمحتوى كوتشي",
     "motion_prompt": "English description of the same motion-graphics animation for a video model: each animated element, how it enters, moves and exits, timing, easing, and the transition out",
     "visual": "اللي هيحصل في المشهد",
     "shot": "نوع اللقطة", "camera": "حركة الكاميرا والعدسة",
     "on_screen_text": "الكلام المكتوب على الشاشة",
     "voice": "الكلام اللي هيتقال (باللهجة السعودية)",
     "sfx": "المؤثرات الصوتية", "music": "الموسيقى في المشهد",
     "prompt": "English prompt for a video model (Seedance) for this scene: subject, action, setting in Saudi Arabia, lighting, lens, camera move, mood, the chosen visual style, AND the motion-graphics elements and how they animate. Vertical 9:16.",
     "components": [
       {"name": "اسم المكون في إعلان كوتشي", "kind": "character | prop | background | graphic | text | ui | icon | effect",
        "from": "اسم المكون اللي يقابله في المشهد الأصلي (أو فاضي لو جديد)",
        "asset": "لو المكون ده شاشة تطبيق أو لوجو أو صورة المنتج: اسم الأصل الحقيقي من عقل الإعلان بالظبط (وإلا فاضي)",
        "description": "شكله ودوره في المشهد",
        "image_prompt": "English prompt to create this element alone, isolated on a plain flat background, in the ad style",
        "animation": "حركته في المشهد (زي حركة المكون الأصلي لو ليه أصل)"}
     ]}
  ],
  "voiceover_script": "الفويس أوفر كامل",
  "music_direction": "الموسيقى المطلوبة (نوع، مود، BPM، أمثلة)",
  "sound_design": "المؤثرات وتصميم الصوت",
  "cast": "مين هيظهر (مدرب / متدرب / ...) وشكلهم",
  "locations": "أماكن التصوير",
  "production_notes": "ملاحظات التنفيذ: تصوير حقيقي ولا AI، المعدات، الوقت، الميزانية التقريبية",
  "cta": "الدعوة للفعل",
  "caption": "كابشن البوست"
}"""


def video_messages(duration: float, user_notes: str = "") -> list[dict]:
    text = (
        "أنت مخرج إعلانات ومحلل إبداعي. اتفرج على الإعلان ده كويس (الصورة والصوت مع بعض) وفصّصه بالتفصيل.\n"
        f"مدة الإعلان {duration:.1f} ثانية. قسّمه لمشاهد حقيقية حسب القطعات، وكل مشهد بوقت بدايته ونهايته بالثواني "
        "من 0 لآخر الإعلان من غير فراغات.\n"
        "اكتب الكلام اللي بيتقال حرفيًا بلغته الأصلية. باقي التحليل بالعربي المصري البسيط.\n"
        + (f"ملاحظات المستخدم: {user_notes.strip()}\n" if user_notes.strip() else "")
        + f"رجّع JSON بس بالشكل ده:\n{VIDEO_FORMAT}"
    )
    return [{"role": "user", "content": text}]


def audio_messages(duration: float) -> list[dict]:
    text = (
        "أنت مهندس صوت ومصمم Sound Design. اسمع صوت الإعلان ده وفصّصه بكل تفاصيله: كل صوت بشري (مين، نبرته، "
        "إحساسه، سرعته، لهجته) والكلام حرفيًا بتوقيته، والموسيقى (النوع، المود، السرعة BPM بالتقريب، الآلات، "
        "إزاي بتتطور، أماكن الدروب والسكوت)، وكل مؤثر صوتي بتوقيته ووظيفته، والصوت المحيط، وتوازن المكس.\n"
        f"مدة الصوت {duration:.1f} ثانية. التوقيتات بالثواني. التحليل بالعربي المصري البسيط والكلام المنطوق بلغته الأصلية.\n"
        f"رجّع JSON بس بالشكل ده:\n{AUDIO_FORMAT}"
    )
    return [{"role": "user", "content": text}]


def with_media(messages: list[dict], data_url: str, filename: str) -> list[dict]:
    """يحط الفيديو أو الصوت جوه رسالة المستخدم (بيتبعت كملف base64، ده اللي Gemini على Atlas بيفهمه كامل)."""
    msg = dict(messages[-1])
    msg["content"] = [{"type": "text", "text": msg["content"]},
                      {"type": "file", "file": {"filename": filename, "file_data": data_url}}]
    return messages[:-1] + [msg]


# 🎛️ التطبيق على البراند: الألوان (مفاتيح) والباقي اختيارات بتتكتب للموديل زي ما هي
PALETTE_MODES = {
    "": "ألوان البراند هي أساس الإعلان (الخلفيات والجرافيك والجو).",
    "accent": "الخلفيات والجو والإضاءة بألوان طبيعية مناسبة للمكان والمود، وألوان البراند تظهر كلمسات بس "
              "(اللوجو، شاشة التطبيق، الأزرار، كلمة مهمة في الجرافيك). متلوّنش المشهد كله بلون البراند.",
    "reference": "خد باليتة ألوان الإعلان الأصلي وجوّه وإضاءته زي ما هي، والبراند يظهر بلوجوه وشاشاته بس.",
    "fresh": "اختار باليتة جديدة ومختلفة تناسب مود الإعلان ده ومختلفة عن الإعلانات اللي فاتت "
             "(مثلًا دافية غروب، نيون ليلي، ألوان باستيل، أبيض وأسود مع لون واحد). ألوان البراند في اللوجو والشاشات بس.",
}
BRAND_LEVELS = {
    "subtle": "البراند خفيف: القصة والإحساس الأول، والتطبيق يظهر في النص التاني أو في الآخر بشكل طبيعي مش إعلاني.",
    "strong": "البراند قوي: التطبيق واللوجو ظاهرين من أول ثانية والإعلان كله بيوري التطبيق وهو بيشتغل.",
}


def brand_controls(settings: dict, others: list[dict] | None = None) -> str:
    """توجيهات التطبيق على البراند اللي اختارها المستخدم + الإعلانات اللي فاتت عشان ميكررهاش."""
    s = settings or {}
    lines = []
    if s.get("direction"):
        lines.append(f"الاتجاه اللي المستخدم اختاره (التزم بيه): {s['direction']}")
    for k, label in (("angle", "الزاوية / الرسالة البيعية"), ("tone", "الإحساس والتون"), ("setting", "المكان"),
                     ("hero", "بطل الإعلان"), ("feature", "الميزة أو الشاشة اللي نركز عليها في التطبيق")):
        if s.get(k):
            lines.append(f"{label}: {s[k]}")
    mode = s.get("palette_mode") or ""
    if mode == "custom" and s.get("palette_custom"):
        lines.append(f"الألوان: استخدم الألوان دي للإعلان ده: {s['palette_custom']}. ألوان البراند في اللوجو والشاشات بس.")
    else:
        lines.append("الألوان: " + PALETTE_MODES.get(mode, PALETTE_MODES[""]))
    if BRAND_LEVELS.get(s.get("brand_level") or ""):
        lines.append(BRAND_LEVELS[s["brand_level"]])
    txt = "التطبيق على البراند (اختيارات المستخدم، ليها الأولوية):\n" + "\n".join(f"- {x}" for x in lines) + "\n"
    if s.get("variety") != "off" and others:
        txt += ("إعلانات عملناها قبل كده للبراند ده. الإعلان الجديد لازم يبقى مختلف عنهم بوضوح في الزاوية والهوك "
                "والتون والألوان والمكان والأشخاص (إلا اللي المستخدم اختاره فوق):\n"
                + "\n".join("- " + " | ".join(f"{k}: {o[k]}" for k in ("title", "angle", "hook", "tone", "palette", "locations") if o.get(k))
                             for o in others[:8]) + "\n")
    if not s.get("angle") and not s.get("direction"):
        txt += "لو الزاوية مش محددة: متقعش في الزاوية المعتادة (تطبيق بيتابعك وبيوريك تقدمك)، فكّر في زاوية طازة تناسب الإعلان الأصلي.\n"
    return txt + "\n"


def adapt_messages(brand: dict, analysis: dict, audio: dict, settings: dict, style: dict | None, chat: list[dict],
                   brain: dict | None = None, others: list[dict] | None = None) -> list[dict]:
    style_txt = ""
    if style:
        style_txt = (f"الستايل البصري المختار «{style.get('name', '')}»:\n{style.get('notes') or ''}\n"
                     "كل برومبت لازم يتكتب بالستايل ده.\n\n")
    s = settings or {}
    asks = [
        f"المدة المطلوبة: حوالي {s['duration']} ثانية" if s.get("duration") else "",
        f"المقاس / المنصة: {s['format']}" if s.get("format") else "",
        f"اللغة واللهجة: {s['language']}" if s.get("language") else "الكلام باللهجة السعودية",
        f"طريقة التنفيذ: {s['production']}" if s.get("production") else "",
        f"تعليمات إضافية: {s['notes']}" if s.get("notes") else "",
    ]
    copy = s.get("fidelity", "copy") != "inspired"
    n_orig = len((analysis or {}).get("scenes") or [])
    if copy:
        intro = ("شغلتك تاخد إعلان مرجعي متفصّص وتعمل نسخة منه لكوتشي **لقطة بلقطة**: نفس عدد المشاهد ونفس ترتيبها ومدتها، "
                 "نفس الكادر وزاوية الكاميرا وحركتها وتكوين الصورة ومكان كل عنصر على الشاشة، نفس الموشن جرافيك والانتقالات والإيقاع. "
                 "اللي بيتغير بس: المنتج والبراند (كوتشي بدلهم)، الكلام المكتوب والمنطوق، والأشخاص (بلبس محتشم). مناسب للسوق السعودي والخليجي.\n\n")
        asks.insert(0, f"عدد المشاهد = {n_orig} بالظبط (زي الأصلي)، المشهد رقم n يقابل المشهد الأصلي رقم n (ref_scene = n) وبنفس مدته تقريبًا. "
                       "متدمجش مشاهد ومتزودش مشاهد ومتغيّرش الترتيب." if n_orig else "")
    else:
        intro = ("شغلتك تاخد إعلان مرجعي متفصّص وتقترح إعلان لكوتشي مستوحى منه "
                 "(نفس الذكاء والبناء والإحساس، مش نسخة)، مناسب للسوق السعودي والخليجي.\n\n")
    system = (
        f"أنت كريتيف دايركتور لبراند {(brain or {}).get('name') or 'كوتشي'}. " + intro
        + (f"عقل الإعلان (المنتج وهويته وأصوله الحقيقية، التزم بيه بالظبط):\n{brain_text(brain)}\n"
           "أي شاشة تطبيق أو لوجو أو صورة منتج في الإعلان لازم تكون من الأصول دي (اكتب اسمها في asset)، "
           "ومتخترعش شاشات أو لوجوهات تانية. ألوان البراند اللي في العقل ثابتة في اللوجو والشاشات، "
           "وألوان الإعلان نفسه حسب «التطبيق على البراند» تحت.\n\n" if brain else
           f"عن كوتشي: {brand.get('about', '')}\nالجمهور: {brand.get('audience', '')}\n"
           f"ألوان البراند: {brand.get('colors', '')}\n\n")
        + style_txt
        + brand_controls(s, others)
        + "تحليل الإعلان المرجعي (وكل مشهد بمكوناته وعناصر الموشن جرافيك وحركتها):\n" + json.dumps(analysis, ensure_ascii=False)[:40000] + "\n\n"
        + ("تحليل الصوت:\n" + json.dumps(audio, ensure_ascii=False)[:6000] + "\n\n" if audio else "")
        + "المطلوب:\n" + "\n".join(f"- {a}" for a in asks if a) + "\n"
        "- الإعلان الجديد بيتبني على الموشن جرافيك بتاع الأصلي مش على الفكرة بس: امشي مشهد بمشهد على الأصلي، "
        "وخد من كل مشهد الموشن جرافيك بتاعه (العناصر المتحركة، طريقة دخولها وحركتها وخروجها، توقيتها، الإيقاع، الانتقالات) "
        "واعمل نفس البناء الحركي بمحتوى كوتشي. القصة والكلام يتكتبوا عشان يخدموا الموشن ده.\n"
        "- كل مشهد لازم يكون فيه motion_graphics مفصّل بالتوقيت وmotion_prompt بالإنجليزي، والبرومبت يوصف الموشن كمان. "
        "لو المشهد الأصلي مفيهوش موشن جرافيك اكتب الحركة والانتقال بس.\n"
        + ("- كل مشهد بنفس visual وshot وcamera بتوع المشهد الأصلي المقابل (بمحتوى كوتشي)، وكل مشهد ببرومبت إنجليزي جاهز لموديل فيديو "
           "بيوصف نفس الكادر والحركة.\n" if copy else
           "- مشاهد بنفس روح الإعلان الأصلي لكن بقصة كوتشي، وكل مشهد ببرومبت إنجليزي جاهز لموديل فيديو.\n")
        + 
        "- كل مشهد ref_scene = رقم المشهد الأصلي اللي مستوحى منه. وحوّل مكونات المشهد الأصلي (خصوصًا عناصر الموشن جرافيك) "
        "لنسخة كوتشي: نفس الوظيفة ونفس طريقة الحركة، بس بشكل كوتشي (شاشة التطبيق بدل شاشتهم، لوجو كوتشي بدل لوجوهم، "
        "شخصياتنا بدل ممثليهم). الشخصية اللي بتتكرر في أكتر من مشهد اكتب برومبتها بنفس الوصف بالظبط.\n"
        "- من غير كليشيهات إعلانات ومن غير وعود صحية مبالغ فيها.\n"
        "- اللبس محتشم دايمًا في كل مشهد وكل برومبت: البنات لبس واسع طويل مغطي الدراعات والرجلين بالكامل مع حجاب، "
        "والرجالة لابسين تيشيرت دايمًا وشورت تحت الركبة أو بنطلون. متكتبش أي لبس ضيق أو قصير أو مكشوف.\n"
        f"رجّع JSON بس بالشكل ده:\n{ADAPT_FORMAT}"
    )
    first = {"role": "user", "content": "اقترح إعلان كوتشي مستوحى من الإعلان ده."}
    return [{"role": "system", "content": system}, first] + chat[-12:]


def _extract(text: str) -> str:
    t = re.sub(r"^```(?:json)?\s*|\s*```\s*$", "", (text or "").strip(), flags=re.S)
    i = t.find("{")
    if i < 0:
        return ""
    j = t.rfind("}")
    return t[i:j + 1] if j > i else t[i:]  # من غير قفلة = الرد اتقطع


def _cleanup(raw: str) -> str:
    """أشهر غلطات الموديلات في JSON."""
    s = re.sub(r"//[^\n\"]*\n", "\n", raw)                                  # تعليقات
    s = re.sub(r",\s*([}\]])", r"\1", s)                                  # فاصلة زيادة قبل القفلة
    s = re.sub(r'(:\s*)(\d+):(\d{2}(?:\.\d+)?)(?=\s*[,}\]])',             # وقت مكتوب 1:20 بدل 80
               lambda m: f"{m.group(1)}{int(m.group(2)) * 60 + float(m.group(3)):.2f}", s)
    s = re.sub(r":\s*(NaN|undefined|None)\b", ": null", s)
    s = s.replace("“", '"').replace("”", '"')
    return s


def _finite(v):
    """NaN و Infinity مش JSON صحيح للمتصفح: بيبقوا null."""
    if isinstance(v, float) and (v != v or v in (float("inf"), float("-inf"))):
        return None
    if isinstance(v, dict):
        return {k: _finite(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_finite(x) for x in v]
    return v


def parse_json(text: str, what: str) -> dict:
    """JSON من رد الموديل، ولو فيه غلطات بنحاول نصلّحها قبل ما نقول إنه مش مفهوم."""
    data = _parse_json(text, what)
    return _finite(data)


def _parse_json(text: str, what: str) -> dict:
    raw = _extract(text)
    if not raw:
        raise ValueError(f"الموديل ما رجعش {what}")
    last = None
    for candidate in (raw, _cleanup(raw)):
        try:
            data = json.loads(candidate, strict=False)
            if isinstance(data, dict):
                return data
        except ValueError as exc:
            last = exc
    try:
        import json_repair  # بيصلّح JSON مقطوع أو فيه غلطات
        data = json_repair.loads(_cleanup(raw))
        if isinstance(data, dict) and data:
            return data
    except Exception as exc:  # noqa: BLE001
        last = exc
    raise ValueError(f"رد الموديل في {what} مش مفهوم ({last})")


def clean_scenes(scenes, duration: float) -> list[dict]:
    """المشاهد مترتبة ومتلاصقة من 0 لآخر الإعلان."""
    out = []
    for s in scenes or []:
        if not isinstance(s, dict):
            continue
        def num(v):
            try:
                return float(v)
            except (TypeError, ValueError):
                return None
        start, end = num(s.get("start")), num(s.get("end"))
        prev_end = out[-1]["end"] if out else 0.0
        start = prev_end if start is None else start
        end = start if end is None else end
        out.append({**{k: str(v) if not isinstance(v, (int, float)) else v for k, v in s.items()}, "start": start, "end": end})
    out.sort(key=lambda s: s["start"])
    for i, s in enumerate(out):
        s["n"] = i + 1
        s["start"] = 0.0 if i == 0 else out[i - 1]["end"]
        nxt = out[i + 1]["start"] if i + 1 < len(out) else duration
        s["end"] = round(max(s["start"] + 0.2, min(max(s["end"], s["start"] + 0.2), nxt if i + 1 < len(out) else duration)), 2)
    if out:
        out[-1]["end"] = round(max(out[-1]["start"] + 0.2, duration), 2)
    return out


def style_messages(names: str) -> list[dict]:
    return [{"role": "user", "content": (
        "دي صور ستايل بصري لإعلانات. اوصف الستايل بالإنجليزي في فقرة واحدة تنفع تتحط في برومبت موديل صور/فيديو: "
        "طريقة التصوير أو الرسم، الإضاءة، الألوان والـ grading، العدسة، الملمس، الإحساس. "
        f"وبعدها اقترح اسم قصير بالعربي. الصور: {names}\n"
        'رجّع JSON بس: {"name": "...", "notes": "English style description"}')}]


# ---------------------------------------------------------------- وضع التجربة (من غير Atlas)

def mock_analysis(duration: float) -> dict:
    n = max(2, min(6, int(duration // 3) or 2))
    step = duration / n
    return {
        "title": "إعلان تجريبي", "brand": "براند", "summary": "إعلان تجريبي عشان تشوف الشكل.",
        "idea": "فكرة تجريبية", "hook": "لقطة سريعة تشد العين", "structure": "مشكلة ← حل ← CTA",
        "audience": "شباب", "tone": "حماسي", "cta": "حمّل التطبيق", "cinematography": "كاميرا محمولة وإضاءة طبيعية",
        "direction": "أداء طبيعي", "editing": "قطع سريع", "colors": "دافية",
        "scenes": [{"n": i + 1, "start": round(i * step, 2), "end": round((i + 1) * step, 2), "visual": f"مشهد {i + 1}",
                    "shot": "close-up", "camera": "handheld", "on_screen_text": "", "voice": "", "sfx": "whoosh",
                    "music": "beat", "transition": "cut", "purpose": "تجربة"} for i in range(n)],
    }


def mock_audio() -> dict:
    return {"voices": [{"who": "راوي", "gender": "ذكر", "age": "30", "language": "عربي", "tone": "هادي",
                        "emotion": "ثقة", "pace": "متوسط", "delivery": "حكي"}],
            "transcript": [{"start": 0, "end": 2, "speaker": "راوي", "text": "كلام تجريبي"}],
            "music": {"genre": "hip-hop", "mood": "حماسي", "tempo_bpm": 96, "key": "", "instruments": "drums, bass",
                      "energy": "بتطلع لحد الآخر", "role": "إيقاع", "moments": [{"t": 0, "event": "دخول"}]},
            "sfx": [{"t": 1.0, "sound": "whoosh", "purpose": "انتقال"}], "ambience": "شارع",
            "mix": "الكلام فوق الموسيقى", "sound_design_notes": "تجربة"}


def mock_adaptation(duration: int = 30) -> dict:
    return {"title": "كوتشي: إعلان تجريبي", "concept": "فكرة تجريبية", "why_it_fits": "تجربة", "kochi_angle": "التطبيق",
            "duration": duration, "format": "9:16", "hook": "سؤال سريع", "angle": "زاوية تجريبية", "tone": "هادي",
            "palette": "#1D3557 كحلي (الخلفيات)، #F1FAEE أبيض دافي",
            "scenes": [{"n": i + 1, "seconds": 5, "ref_scene": 1 + i % 2, "visual": f"مشهد {i + 1}",
                        "motion_graphics": "كارت كوتشي بينط من تحت في أول ثانية ويكبر، وبعدين بيتزحلق لبرة شمال",
                        "motion_prompt": "A KOCHI card pops up from the bottom in the first second, scales up, then slides out left.", "shot": "medium", "camera": "static",
                        "on_screen_text": "", "voice": "جملة تجريبية", "sfx": "", "music": "", "prompt": "Test scene. Vertical 9:16.",
                        "components": [{"name": "المتدرب", "kind": "character", "from": "الممثل", "description": "شاب سعودي",
                                        "image_prompt": "A young Saudi man, full body.", "animation": "ثابت"},
                                       {"name": "كارت كوتشي", "kind": "ui", "from": "كارت سعر", "description": "كارت التطبيق",
                                        "image_prompt": "A KOCHI app card UI.", "animation": "بينط من تحت"}]}
                       for i in range(3)],
            "voiceover_script": "فويس أوفر تجريبي", "music_direction": "beat", "sound_design": "whoosh",
            "cast": "مدرب", "locations": "جيم", "production_notes": "تجربة", "cta": "حمّل كوتشي", "caption": "كابشن"}


# ================================================================ التنفيذ: راس الإعلان ← ستوري بورد ← مكونات ← لقطات

ASPECTS = {  # المقاس ← (مقاس صورة الستوري بورد، نسبة Seedance)
    "9:16": ("1152x2048", "9:16"),
    "16:9": ("2048x1152", "16:9"),
    "1:1": ("1536x1536", "1:1"),
}


def aspect_of(text: str) -> str:
    t = (text or "").replace(" ", "")
    for k in ("16:9", "1:1"):
        if k in t:
            return k
    return "9:16"


def ad_palette(a: dict, brand: dict, settings: dict | None, brain: dict | None) -> str:
    """ألوان الإعلان ده: ألوان البراند كاملة، أو ألوان الإعلان نفسه والبراند لمسات بس (عشان الإعلانات متطلعش كلها شبه بعض)."""
    brand_pal = (brain or {}).get("palette") or brand.get("colors", "")
    mode = (settings or {}).get("palette_mode") or ""
    own = (settings or {}).get("palette_custom") if mode == "custom" else a.get("palette")
    if not mode or not own:
        return brand_pal
    return f"{own}. Brand colors ({brand_pal}) only on the logo, app screens and small accents."


def header_from(adaptation: dict, style: dict | None, brand: dict, settings: dict, brain: dict | None = None) -> dict:
    """راس الإعلان: الثوابت اللي بتدخل في كل برومبت عشان الإعلان كله يطلع بنفس الشكل."""
    a = adaptation or {}
    return {
        "title": a.get("title", ""),
        "concept": a.get("concept", ""),
        "style": (style or {}).get("notes") or "",
        "style_id": (settings or {}).get("style_id"),
        "characters": a.get("cast", ""),
        "locations": a.get("locations", ""),
        "palette": ad_palette(a, brand, settings, brain),
        "brand": brain_header(brain),
        "fidelity": (settings or {}).get("fidelity") or "copy",
        "brain_id": (brain or {}).get("id"),
        "rules": "Vertical social ad, consistent characters, wardrobe and lighting in every shot. No watermarks, no random text.",
        "aspect": aspect_of((settings or {}).get("format") or a.get("format") or ""),
    }


def header_text(h: dict) -> str:
    parts = [
        f"AD: {h.get('title', '')}. CONCEPT: {h.get('concept', '')}",
        f"PRODUCT / BRAND IDENTITY (stay strictly on-brand): {h['brand']}" if h.get("brand") else "",
        f"VISUAL STYLE (must match exactly): {h['style']}" if h.get("style") else "",
        f"CHARACTERS (keep identical in every shot): {h['characters']}" if h.get("characters") else "",
        f"LOCATIONS: {h['locations']}" if h.get("locations") else "",
        f"COLOR PALETTE: {h['palette']}" if h.get("palette") else "",
        f"RULES: {h['rules']}" if h.get("rules") else "",
    ]
    return "\n".join(p for p in parts if p)


def frame_prompt(h: dict, shot: dict, ref_comps: list[dict] | None = None, n_style: int = 0, orig_idx: int = 0) -> str:
    """برومبت صورة الستوري بورد. ref_comps = المكونات اللي صورها رايحة للموديل بنفس الترتيب (أول الصور)،
    وبعدها n_style صورة ستايل."""
    ref_comps = ref_comps or []
    with_img = {c.get("id") for c in ref_comps}
    rest = [c for c in shot.get("components") or [] if c.get("use", True) and c.get("id") not in with_img]
    refs_txt = ""
    if ref_comps:
        refs_txt = ("REFERENCE IMAGES — these are the REAL brand assets of this ad. Put each one into the frame EXACTLY as it is "
                    "(same screen content and layout, same logo, same face and outfit, same colors and text). Do not redesign them, "
                    "do not replace them, and do not invent any other app screens, logos or brand marks:\n"
                    + "\n".join(f"- Image {i + 1} = {c.get('name')}: {c.get('description') or c.get('image_prompt') or ''}".rstrip(": ")
                                 + (f" (motion: {c['animation']})" if c.get("animation") else "")
                                 for i, c in enumerate(ref_comps)))
        if n_style:
            first = len(ref_comps) + (2 if orig_idx else 1)
            refs_txt += (f"\nImages {first}-{first + n_style - 1} are visual-style references only "
                         "(look, lighting, palette). Do not copy their content.")
    elif n_style:
        refs_txt = "The reference images are visual-style references only (look, lighting, palette). Do not copy their content."
    if orig_idx:
        refs_txt += (f"\nImage {orig_idx} is the matching frame from the ORIGINAL reference ad. "
                     + ("Recreate its composition exactly: same framing and shot size, camera angle, subject pose and placement, "
                        "layout and position of every on-screen graphic, card, text box and screen. Replace only the brand content "
                        "(app screens, logo, text, product) with ours, and the people with ours in modest clothing. "
                        "Never copy the original brand's logo, name or text."
                        if h.get("fidelity", "copy") != "inspired" else
                        "Use it as loose inspiration for composition and energy only; never copy its brand, logo or text."))
    return "\n".join(x for x in [
        f"Storyboard frame for a {h.get('aspect', '9:16')} commercial shot. Polished, like a real frame grab from the final ad.",
        header_text(h),
        f"SHOT {shot.get('n')}: {shot.get('visual', '')}",
        f"STORYBOARD PROMPT (main instruction; @Name = the matching reference image below): {shot['sb_prompt']}" if shot.get("sb_prompt") else "",
        f"Framing / camera: {shot.get('shot', '')} {shot.get('camera', '')}".strip(),
        f"On-screen graphics or text in this shot: {shot['on_screen_text']}" if shot.get("on_screen_text") else "",
        f"Motion graphics in this shot (show them mid-animation, at their key pose): {shot['motion_prompt']}" if shot.get("motion_prompt") else "",
        refs_txt,
        ("Other elements to draw: " + "; ".join(f"{c.get('name')}: {c.get('image_prompt') or c.get('description')}" for c in rest)) if rest else "",
        f"Details: {shot.get('prompt', '')}" if shot.get("prompt") else "",
        ("CLEAN PLATE: do not draw any floating graphics, UI cards, icons, captions, on-screen text or logos — they are "
         "composited later as motion-graphics layers. Keep natural empty space where they will sit." if shot.get("clean") else ""),
        ("Any app screen or logo in the frame must be one of the reference images above."
         if any(c.get("kind") in ("ui", "logo") for c in ref_comps) else ""),
    ] if x)


def frame_edit_prompt(h: dict, note: str, ref_comps: list[dict], n_extra: int = 0) -> str:
    """تعديل صورة الستوري بورد بطلب المستخدم: الصورة 1 هي الحالية، وبعدها الصور اللي بعتها، وبعدها أصول البراند."""
    extra = (f"\nImages 2-{n_extra + 1} are reference images the director attached for this change: use them for exactly "
             "what the change asks (the look of a person, object, outfit, place, pose or style), not as a new layout."
             if n_extra else "")
    assets = extra + "".join(f"\n- Image {i + 2 + n_extra} = {c.get('name')} (real brand asset, keep exactly as it looks)"
                             for i, c in enumerate(ref_comps))
    return "\n".join(x for x in [
        "Edit image 1 (the current storyboard frame of a commercial).",
        f"REQUESTED CHANGE (written in Arabic by the director — apply it precisely): {note}",
        "Change only what is requested. Keep everything else identical: composition, camera angle, characters' faces and "
        "clothing, lighting, colors, style, and every brand asset.",
        header_text(h),
        f"Reference images:{assets}" if assets else "",
        f"{h.get('aspect', '9:16')} frame, no watermarks.",
    ] if x)


COMPONENTS_FORMAT = """{
  "components": [
    {"name": "اسم قصير بالعربي", "kind": "character | prop | background | graphic | text | ui | icon | effect",
     "description": "وصف المكون ودوره في اللقطة (بالعربي)",
     "image_prompt": "English prompt for an image model to create THIS element alone, isolated on a plain flat background, in the ad's visual style, high detail",
     "animation": "إزاي المكون ده بيتحرك في اللقطة (دخول، حركة، خروج) بالعربي"}
  ],
  "motion_notes": "شرح الموشن جرافيك والحركة في اللقطة بالعربي",
  "assembly_prompt": "English prompt for a reference-to-video model (Seedance) that builds this shot from the reference images: image 1 is the storyboard frame (composition), the next images are the components. Describe the action, the camera move, and how each graphic element animates, in the ad's style."
}"""


def components_messages(h: dict, shot: dict, has_reference: bool) -> list[dict]:
    text = (
        "أنت موشن ديزاينر ومخرج إعلانات. قدامك صورة الستوري بورد للقطة من إعلان كوتشي"
        + (" وبعدها صورة من اللقطة المقابلة في الإعلان الأصلي اللي بنستلهم منه" if has_reference else "")
        + ".\nفصّص اللقطة لمكوناتها عشان كل مكون يتعمل لوحده بموديل صور وبعدين نجمعهم في فيديو: "
        "الشخصيات، الأدوات والمنتجات، الخلفية، وكل عناصر الموشن جرافيك (أيقونات، كروت كلام، شاشات تطبيق، أشكال، أسهم، "
        "إيموجي، تأثيرات). لو الإعلان الأصلي فيه موشن جرافيك في اللقطة دي، استخرج عناصره وطريقة حركتها وطبّقها على كوتشي.\n\n"
        f"راس الإعلان (ثابت لكل اللقطات):\n{header_text(h)}\n\n"
        f"اللقطة {shot.get('n')} ({shot.get('seconds', '')} ثانية): {shot.get('visual', '')}\n"
        f"كلام على الشاشة: {shot.get('on_screen_text', '') or '—'}\nالصوت: {shot.get('voice', '') or '—'}\n"
        + (f"الموشن جرافيك المطلوب في اللقطة (التزم بيه): {shot.get('motion_notes')}\n" if shot.get("motion_notes") else "")
        + "\n"
        + (f"مكونات المشهد الأصلي المقابل (حوّلها لنسخة كوتشي بنفس الوظيفة والحركة): "
           f"{json.dumps(shot.get('ref_components'), ensure_ascii=False)}\nالموشن جرافيك في الأصلي: {shot.get('ref_motion', '')}\n"
           if shot.get("ref_components") else "")
        + (f"المكونات المقترحة للقطة دي (عدّلها على الستوري بورد وكمّل الناقص): "
           f"{json.dumps([{k: c.get(k) for k in ('name', 'kind', 'description', 'animation')} for c in shot.get('components') or []], ensure_ascii=False)}\n"
           if shot.get("components") else "")
        + "الشخصيات اللي بتتكرر في الإعلان اكتب برومبتها بنفس الوصف بالظبط. أقصى حاجة 8 مكونات، الأهم الأول.\n"
        f"رجّع JSON بس بالشكل ده:\n{COMPONENTS_FORMAT}"
    )
    return [{"role": "user", "content": text}]


def component_prompt(h: dict, comp: dict) -> str:
    return "\n".join(x for x in [
        comp.get("image_prompt") or comp.get("description", ""),
        f"Visual style: {h['style']}" if h.get("style") else "",
        f"Color palette: {h['palette']}" if h.get("palette") and comp.get("kind") in ("graphic", "text", "ui", "icon", "effect") else "",
        f"Brand identity: {h['brand']}" if h.get("brand") and comp.get("kind") in ("graphic", "text", "ui", "icon", "effect", "logo") else "",
        "Single isolated element centered on a plain flat light background, nothing else in the image, no watermark.",
    ] if x)


def video_prompt(h: dict, shot: dict, ref_comps: list[dict] | int = 0) -> str:
    comps = ref_comps if isinstance(ref_comps, list) else []
    n = len(comps) if comps else int(ref_comps or 0)
    refs = "Reference image 1 is the storyboard frame: keep its composition."
    if comps:
        refs += (" The next reference images are the real brand assets of the shot, use them exactly as they look "
                 "(no other app screens or logos): " + "; ".join(f"image {i + 2} = {c.get('name')}" for i, c in enumerate(comps)) + ".")
    elif n:
        refs += f" Reference images 2-{n + 1} are the elements of the shot: use them exactly as they look."
    return "\n".join(x for x in [
        shot.get("assembly_prompt") or shot.get("prompt") or shot.get("visual", ""),
        f"Motion graphics animation: {shot['motion_prompt']}" if shot.get("motion_prompt") and not shot.get("assembly_prompt") else "",
        ("Clean plate: no on-screen graphics, UI cards, text or logos (motion graphics are composited later)."
         if shot.get("clean") else ""),
        refs,
        f"Visual style: {h['style']}" if h.get("style") else "",
        f"Characters: {h['characters']}" if h.get("characters") else "",
        f"{h.get('aspect', '9:16')} commercial shot, smooth cinematic motion, no text artifacts, no watermark.",
    ] if x)


def mock_components() -> dict:
    return {"components": [
        {"name": "المدرب", "kind": "character", "description": "مدرب بيشاور على الموبايل", "image_prompt": "A fitness coach character, full body.", "animation": "بيدخل من اليمين"},
        {"name": "شاشة التطبيق", "kind": "ui", "description": "شاشة كوتشي", "image_prompt": "A phone screen showing a fitness app UI.", "animation": "بتكبر من النص"},
        {"name": "أيقونة نار", "kind": "icon", "description": "إيموجي حماس", "image_prompt": "A flat fire icon.", "animation": "بتنط فوق الموبايل"},
    ], "motion_notes": "حركة تجريبية", "assembly_prompt": "Test assembly prompt."}


SCENE_COMPONENTS_FORMAT = """{
  "scenes": [
    {"n": 1,
     "motion_graphics": "وصف الموشن جرافيك في المشهد ده (لو فيه): العناصر وإزاي بتتحرك وتتنقل",
     "components": [
       {"name": "اسم قصير", "kind": "character | prop | background | graphic | text | ui | icon | effect | logo",
        "description": "شكله ودوره في المشهد",
        "animation": "إزاي بيدخل ويتحرك ويخرج (التوقيت والاتجاه والسرعة والـ easing)"}
     ]}
  ]
}"""


def scene_components_messages(scenes: list[dict]) -> list[dict]:
    rows = "\n".join(f'{s["n"]}. [{s.get("start", 0):.1f}–{s.get("end", 0):.1f}] {s.get("visual", "")}' for s in scenes)
    text = (
        "أنت موشن ديزاينر. اتفرج على الإعلان ده وفصّص كل مشهد لمكوناته اللي اتعمل منها: الشخصيات، الأدوات والمنتجات، "
        "الخلفيات، وكل عناصر الموشن جرافيك (أيقونات، كروت كلام، شاشات، أشكال، أسهم، لوجوهات، تأثيرات، كلام متحرك). "
        "لكل مكون اكتب شكله ودوره وطريقة حركته بالتفصيل (دخول، حركة، خروج، توقيت).\n"
        f"المشاهد بأوقاتها:\n{rows}\n\n"
        "نفس أرقام المشاهد. التحليل بالعربي المصري البسيط. أقصى حاجة 10 مكونات للمشهد، الأهم الأول.\n"
        f"رجّع JSON بس بالشكل ده:\n{SCENE_COMPONENTS_FORMAT}"
    )
    return [{"role": "user", "content": text}]


def merge_scene_components(scenes: list[dict], data: dict) -> int:
    """يحط مكونات كل مشهد جوه المشهد نفسه. بيرجّع عدد المشاهد اللي اتفصّصت."""
    by_n = {}
    for x in (data or {}).get("scenes") or []:
        if isinstance(x, dict) and str(x.get("n", "")).strip().isdigit():
            by_n[int(str(x["n"]).strip())] = x
    count = 0
    for s in scenes:
        x = by_n.get(int(s.get("n") or 0))
        if not x:
            continue
        comps = [{k: str(c.get(k) or "") for k in ("name", "kind", "description", "animation")}
                 for c in x.get("components") or [] if isinstance(c, dict) and c.get("name")][:10]
        s["components"] = comps
        s["motion_graphics"] = str(x.get("motion_graphics") or "")
        count += 1
    return count


def mock_scene_components(scenes: list[dict]) -> dict:
    return {"scenes": [{"n": s["n"], "motion_graphics": "كروت بتطلع من الموبايل",
                        "components": [{"name": "الممثل", "kind": "character", "description": "شاب", "animation": "ثابت"},
                                       {"name": "كارت سعر", "kind": "graphic", "description": "كارت أبيض", "animation": "بينط من تحت"}]}
                       for s in scenes]}


# ================================================================ عقل الإعلان: المنتج وأصوله (شاشات، لوجو، صور المنتج) والهوية

BRAIN_TYPES = {"app": "تطبيق موبايل", "physical": "منتج ملموس", "service": "خدمة"}

BRAIN_FORMAT = """{
  "palette": "ألوان البراند بالـ hex واسم ودور كل لون، مثلًا: #57B8AF teal (main accent), #EEECDA cream (backgrounds)",
  "theme": "الثيم العام (فاتح / غامق، الإحساس، الزوايا، الظلال، المسافات)",
  "typography": "الخطوط وشكلها (عريض، مستدير، ...)",
  "ui_style": "English, prompt-ready description of the product's UI / visual identity so any generated screen or graphic stays on-brand",
  "logo_description": "English description of the logo (shape, colors, wordmark) so it can be recognised",
  "assets": [{"file": "اسم الملف زي ما هو", "name": "اسم قصير بالعربي (مثلًا: شاشة الرئيسية، شاشة المدربين، اللوجو)", "description": "إيه اللي في الصورة بالتفصيل بالعربي"}]
}"""


def brain_messages(brain: dict, files: list[str]) -> str:
    return (
        "أنت مصمم هوية ومدير فني. قدامك أصول منتج (لوجو، شاشات تطبيق، صور منتج) بنفس ترتيب أسامي الملفات دي: "
        f"{', '.join(files)}.\n"
        f"المنتج: {brain.get('name', '')} — {BRAIN_TYPES.get(brain.get('type'), '')} في مجال {brain.get('domain', '') or '؟'}. "
        f"{brain.get('about', '')}\n"
        "استنبط الهوية البصرية بالظبط من الصور (الألوان الحقيقية بالـ hex، الثيم، الخطوط، شكل الواجهة)، "
        "ووصّف كل صورة لوحدها عشان نعرف نختار الشاشة المناسبة لأي مشهد في إعلان.\n"
        f"رجّع JSON بس بالشكل ده:\n{BRAIN_FORMAT}"
    )


def brain_text(brain: dict | None) -> str:
    """ملخص عقل الإعلان اللي بيدخل في كتابة الاقتراح."""
    if not brain:
        return ""
    lines = [f"المنتج: {brain.get('name', '')} ({BRAIN_TYPES.get(brain.get('type'), '')})" + (f" — المجال: {brain['domain']}" if brain.get("domain") else "")]
    for k, label in (("about", "عنه"), ("audience", "الجمهور"), ("rules", "قواعد لازم تتراعى"), ("palette", "الألوان"),
                     ("theme", "الثيم"), ("typography", "الخطوط"), ("ui_style", "شكل الواجهة")):
        if brain.get(k):
            lines.append(f"{label}: {brain[k]}")
    for kind, label in (("screens", "شاشات التطبيق الحقيقية المتاحة"), ("logos", "اللوجوهات المتاحة"), ("products", "صور المنتج المتاحة"),
                        ("characters", "شخصيات البراند الثابتة (لو مناسبة استخدمها بنفس اسمها)"), ("sets", "أماكن البراند الثابتة"),
                        ("props", "أدوات البراند الثابتة")):
        items = brain.get(kind) or []
        if items:
            lines.append(f"{label} (استخدم الاسم بالظبط في asset):\n" + "\n".join(f"- {a.get('name') or a['file']}: {a.get('description', '')}" for a in items[:60]))
    return "\n".join(lines)


def brain_header(brain: dict | None) -> str:
    """سطر الهوية (بالإنجليزي في الغالب) اللي بيدخل في راس الإعلان وكل برومبت صورة وفيديو."""
    if not brain:
        return ""
    parts = [f"{brain.get('name', '')} — {({'app': 'mobile app', 'physical': 'physical product', 'service': 'service'}).get(brain.get('type'), '')}"
             + (f", {brain['domain']}" if brain.get("domain") else ""),
             brain.get("ui_style", ""), f"Theme: {brain['theme']}" if brain.get("theme") else "",
             f"Typography: {brain['typography']}" if brain.get("typography") else "",
             f"Logo: {brain['logo_description']}" if brain.get("logo_description") else ""]
    return ". ".join(p.strip().rstrip(".") for p in parts if p and p.strip()) + "."


MATCH_FORMAT = """{"matches": [{"id": "id المكون", "file": "اسم ملف الصورة المناسبة أو فاضي لو مفيش مناسبة"}]}"""


def match_messages(comps: list[dict], assets: list[dict]) -> list[dict]:
    text = (
        "عندك مكونات من لقطات إعلان، وعندك الأصول الحقيقية للمنتج (شاشات / لوجو / صور منتج). "
        "اختار لكل مكون الصورة الحقيقية الأنسب ليه من الأصول.\n"
        "المكونات:\n" + "\n".join(f"- id={c['id']} ({c.get('kind')}) {c.get('name')}: {c.get('description', '')} {c.get('asset', '')}" for c in comps)
        + "\n\nالأصول:\n" + "\n".join(f"- file={a['file']} [{a['kind']}] {a.get('name', '')}: {a.get('description', '')}" for a in assets)
        + f"\n\nرجّع JSON بس:\n{MATCH_FORMAT}"
    )
    return [{"role": "user", "content": text}]


# ================================================================ 🎭 الأبطال والمكونات المتكررة (قبل الستوري بورد)

CAST_KINDS = {"character": "شخصية", "background": "مكان / خلفية", "prop": "أداة / حاجة"}

CAST_FORMAT = """{
  "cast": [
    {"name": "اسم قصير مميز (مثلًا: سارة، المدرب فهد، الجيم، الكافيه، زجاجة المية)",
     "kind": "character | background | prop",
     "description": "وصفه بالعربي ودوره في الإعلان",
     "image_prompt": "English, very detailed and fixed description used in EVERY shot. Character: gender, age, Saudi/Gulf look, face, hair, body type, exact modest outfit with colors (women: loose long clothing and hijab). Background: the empty place with its layout, materials, colors and lighting, no people. Prop: exact shape, material, colors, branding.",
     "shots": [1, 3, 4]}
  ]
}"""


def cast_messages(header_txt: str, adaptation: dict, shots: list[dict], known: list[dict] | None = None) -> list[dict]:
    rows = "\n".join(
        f"لقطة {s.get('n')}: {s.get('visual', '')} | المكونات: " + "، ".join(f"{c.get('name')} ({c.get('kind')})" for c in s.get("components") or [])
        for s in shots)
    text = (
        "أنت كاستنج دايركتور ومصمم إنتاج لإعلان. اطلع من الإعلان ده الأبطال (الشخصيات) والأماكن/الخلفيات والأدوات "
        "اللي لازم تفضل هي هي في كل لقطة بتظهر فيها، عشان نعمل لكل واحد صورة مرجعية ثابتة قبل الستوري بورد.\n"
        "- كل شخصية بتظهر في الإعلان (حتى لو في لقطة واحدة) تتعمل لوحدها باسم مميز.\n"
        "- الأماكن والأدوات: اللي بتتكرر في لقطتين أو أكتر بس.\n"
        "- متطلّعش شاشات التطبيق ولا اللوجو ولا عناصر الموشن جرافيك (ليهم مكان تاني).\n"
        "- shots = أرقام اللقطات اللي بيظهر فيها بالظبط.\n"
        "- اللبس محتشم دايمًا: البنات لبس واسع طويل مع حجاب، والرجالة تيشيرت وبنطلون أو شورت تحت الركبة.\n"
        "- أقصى حاجة 8، الأهم الأول.\n\n"
        f"راس الإعلان:\n{header_txt}\n\nالشخصيات المكتوبة في الاقتراح: {adaptation.get('cast', '') or '—'}\n"
        f"الأماكن: {adaptation.get('locations', '') or '—'}\n\nاللقطات:\n{rows}\n\n"
        + ("موجودين قبل كده في عقل الإعلان (لو حد منهم مناسب للإعلان ده استخدمه بنفس اسمه ووصفه بالظبط بدل ما تعمل جديد):\n"
           + "\n".join(f"- {k.get('name')} ({k.get('kind')}): {k.get('prompt') or k.get('description', '')}" for k in known) + "\n\n"
           if known else "")
        + 
        f"رجّع JSON بس بالشكل ده:\n{CAST_FORMAT}"
    )
    return [{"role": "user", "content": text}]


def cast_prompt(h: dict, item: dict) -> str:
    kind = item.get("kind")
    head = {
        "character": "Character reference sheet for a commercial: ONE person, full body, standing, front view, neutral friendly "
                     "expression, even soft studio light, plain light grey background, nothing else in the image.",
        "background": "Location reference plate for a commercial: the empty place only, no people, eye-level wide shot, "
                      "natural realistic lighting.",
        "prop": "Product/prop reference for a commercial: the object alone, centered, on a plain light background, soft studio light.",
    }.get(kind, "Reference image for a commercial.")
    return "\n".join(x for x in [
        head,
        item.get("image_prompt") or item.get("description", ""),
        f"Visual style: {h['style']}" if h.get("style") else "",
        f"Brand identity: {h['brand']}" if h.get("brand") and kind != "character" else "",
        f"{h.get('aspect', '9:16')} framing." if kind == "background" else "",
        "No text, no watermark.",
    ] if x)


def mock_cast(shots: list[dict]) -> dict:
    ns = [s.get("n") for s in shots] or [1]
    return {"cast": [
        {"name": "المتدرب", "kind": "character", "description": "شاب سعودي في العشرينات", "image_prompt": "A Saudi man in his 20s, short black hair, light beard, loose navy t-shirt, grey track pants.", "shots": ns},
        {"name": "الجيم", "kind": "background", "description": "جيم حديث", "image_prompt": "A modern bright gym with black rubber floor and wooden walls.", "shots": ns[:2]},
    ]}


# ================================================================ ✍️ برومبتات الستوري بورد بالمنشن من عقل الإعلان

SB_FORMAT = """{"shots": [{"id": "id اللقطة زي ما هو", "prompt": "English storyboard prompt that mentions database items as @Name exactly"}]}"""


def sb_messages(header_txt: str, shots: list[dict], db_items: list[dict]) -> list[dict]:
    db = "\n".join(f"- @{a['name']} ({a['kind']}): {a.get('prompt') or a.get('description', '')}" for a in db_items)
    rows = []
    for s in shots:
        rows.append(
            f"### id={s['id']} (لقطة {s.get('n')}، {s.get('seconds')} ثانية)\n"
            f"اللي بيحصل: {s.get('visual', '')}\nاللقطة: {s.get('shot', '')} | الكاميرا: {s.get('camera', '')}\n"
            + ("الجرافيك بيتركب بعدين: متكتبش جرافيك ولا كلام على الشاشة.\n" if s.get("layers") else
               f"كلام على الشاشة: {s.get('on_screen_text', '') or '—'}\nالموشن: {s.get('motion_notes', '') or '—'}\n")
            + f"المكونات: {', '.join(c.get('name', '') for c in s.get('components') or [])}\n"
            + f"البرومبت الحالي: {s.get('sb_prompt') or s.get('prompt', '')}")
    text = (
        "أنت ستوري بورد آرتيست. اكتب لكل لقطة برومبت إنجليزي لموديل صور يرسم كادر الستوري بورد.\n"
        "عندك قاعدة بيانات عقل الإعلان: كل عنصر فيها ليه صورة مرجعية حقيقية هتتبعت مع البرومبت.\n"
        "القواعد:\n"
        "- أي شخصية أو مكان أو أداة أو شاشة أو لوجو موجود في قاعدة البيانات وبيظهر في اللقطة: اعمله منشن بـ @ والاسم بالظبط زي ما هو مكتوب.\n"
        "- متوصفش شكل العنصر اللي عملتله منشن (صورته المرجعية هي اللي بتحدد شكله)، اكتب بس هو بيعمل إيه، مكانه في الكادر، وضعه، وتعبيره.\n"
        "- اكتب الكادر والكاميرا والإضاءة والتكوين بوضوح.\n"
        "- اللبس محتشم دايمًا.\n\n"
        f"راس الإعلان:\n{header_txt}\n\nقاعدة بيانات عقل الإعلان:\n{db or '—'}\n\nاللقطات:\n" + "\n\n".join(rows)
        + f"\n\nرجّع JSON بس بالشكل ده:\n{SB_FORMAT}"
    )
    return [{"role": "user", "content": text}]


def find_mentions(text: str, names: list[str]) -> list[str]:
    """المنشنز في البرومبت (@الاسم). الأسامي الأطول الأول عشان «@المدرب فهد» متتقريش «@المدرب»."""
    found, t = [], text or ""
    for n in sorted({n for n in names if n}, key=len, reverse=True):
        if f"@{n}" in t:
            found.append(n)
            t = t.replace(f"@{n}", " ")
    return found


def mock_sb(shots: list[dict], db_items: list[dict]) -> dict:
    tags = " ".join(f"@{a['name']}" for a in db_items[:2])
    return {"shots": [{"id": s["id"], "prompt": f"Medium shot: {tags} in frame, soft light. Shot {s.get('n')}."} for s in shots]}


DIRECTIONS_FORMAT = """{"directions": [
  {"title": "اسم الاتجاه", "angle": "الزاوية / الرسالة البيعية", "hook": "أول 3 ثواني", "tone": "التون",
   "setting": "المكان", "hero": "بطل الإعلان", "palette": "الألوان بالكلام وبالـ hex",
   "feature": "الميزة اللي بنوريها في التطبيق", "summary": "الإعلان في جملتين"}
]}"""


def directions_messages(brand: dict, analysis: dict, settings: dict, brain: dict | None, others: list[dict] | None) -> list[dict]:
    """3 اتجاهات مختلفة جدًا عن بعض لتطبيق الإعلان على البراند، المستخدم يختار منهم."""
    about = brain_text(brain) if brain else f"عن كوتشي: {brand.get('about', '')}\nالجمهور: {brand.get('audience', '')}"
    copy = (settings or {}).get("fidelity", "copy") != "inspired"
    system = (
        f"أنت كريتيف دايركتور لبراند {(brain or {}).get('name') or 'كوتشي'}، للسوق السعودي والخليجي.\n{about}\n\n"
        "ده تحليل إعلان مرجعي هنعمل منه إعلان للبراند"
        + (" (نفس اللقطات والموشن، بس المحتوى والقصة والألوان والأشخاص بتوعنا)" if copy else " (مستوحى منه)") + ":\n"
        + json.dumps({k: (analysis or {}).get(k) for k in ("summary", "idea", "hook", "structure", "style", "scenes")}, ensure_ascii=False)[:15000]
        + "\n\n" + brand_controls({**(settings or {}), "direction": ""}, others)
        + "اقترح 3 اتجاهات مختلفة جدًا عن بعض (زاوية بيعية مختلفة، تون مختلف، ألوان مختلفة، مكان وأشخاص مختلفين)، "
        "كلهم ينفعوا على بناء الإعلان المرجعي. لو المستخدم محدد حاجة فوق التزم بيها في التلاتة وغيّر الباقي. "
        "من غير كليشيهات، واللبس محتشم دايمًا. بالعربي المصري البسيط.\n"
        f"رجّع JSON بس بالشكل ده:\n{DIRECTIONS_FORMAT}"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": "اقترح 3 اتجاهات."}]


def mock_directions() -> dict:
    return {"directions": [
        {"title": "مدرب في جيبك", "angle": "متابعة حقيقية من مدرب مش برنامج جاهز", "hook": "رسالة من المدرب الساعة 6 الصبح",
         "tone": "كوميدي ذكي", "setting": "البيت", "hero": "شاب سعودي", "palette": "دافي: #F4A261 برتقالي، #264653 كحلي",
         "feature": "المحادثة مع المدرب", "summary": "شاب بيحاول يهرب من التمرين والمدرب دايمًا سابقه بخطوة."},
        {"title": "أكلنا مش عدو", "angle": "نظام أكل يناسب أكلنا", "hook": "كبسة… ومع ذلك نزل وزن",
         "tone": "دافي وعائلي", "setting": "سفرة العيلة", "hero": "أم مع العيلة", "palette": "ألوان طبيعية مع لمسات تيل",
         "feature": "شاشة الوجبات", "summary": "العيلة بتاكل عادي والأم ماشية على خطتها من غير ما تحرم نفسها."},
        {"title": "١٥ دقيقة", "angle": "مفيش وقت؟ برنامج مرن", "hook": "عداد ١٥:٠٠ بيعد",
         "tone": "حماسي سريع", "setting": "المكتب", "hero": "بنت بحجاب ولبس رياضي محتشم", "palette": "نيون ليلي: #7B2FF7 بنفسجي، #00F5D4",
         "feature": "تمرين اليوم", "summary": "تمرين سريع بين الاجتماعات بيغيّر يومها."},
    ]}

