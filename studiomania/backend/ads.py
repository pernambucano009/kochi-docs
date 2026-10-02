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
  "scenes": [
    {"n": 1, "seconds": 3,
     "visual": "اللي هيحصل في المشهد",
     "shot": "نوع اللقطة", "camera": "حركة الكاميرا والعدسة",
     "on_screen_text": "الكلام المكتوب على الشاشة",
     "voice": "الكلام اللي هيتقال (باللهجة السعودية)",
     "sfx": "المؤثرات الصوتية", "music": "الموسيقى في المشهد",
     "prompt": "English prompt for a video model (Seedance) for this scene: subject, action, setting in Saudi Arabia, lighting, lens, camera move, mood, the chosen visual style. Vertical 9:16."}
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


def adapt_messages(brand: dict, analysis: dict, audio: dict, settings: dict, style: dict | None, chat: list[dict]) -> list[dict]:
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
    system = (
        "أنت كريتيف دايركتور لبراند كوتشي. شغلتك تاخد إعلان مرجعي متفصّص وتقترح إعلان لكوتشي مستوحى منه "
        "(نفس الذكاء والبناء والإحساس، مش نسخة)، مناسب للسوق السعودي والخليجي.\n\n"
        f"عن كوتشي: {brand.get('about', '')}\nالجمهور: {brand.get('audience', '')}\n"
        f"ألوان البراند: {brand.get('colors', '')}\n\n"
        + style_txt
        + "تحليل الإعلان المرجعي:\n" + json.dumps(analysis, ensure_ascii=False)[:14000] + "\n\n"
        + ("تحليل الصوت:\n" + json.dumps(audio, ensure_ascii=False)[:6000] + "\n\n" if audio else "")
        + "المطلوب:\n" + "\n".join(f"- {a}" for a in asks if a) + "\n"
        "- مشاهد بنفس روح الإعلان الأصلي لكن بقصة كوتشي، وكل مشهد ببرومبت إنجليزي جاهز لموديل فيديو.\n"
        "- من غير كليشيهات إعلانات ومن غير وعود صحية مبالغ فيها.\n"
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
            "duration": duration, "format": "9:16", "hook": "سؤال سريع",
            "scenes": [{"n": i + 1, "seconds": 5, "visual": f"مشهد {i + 1}", "shot": "medium", "camera": "static",
                        "on_screen_text": "", "voice": "جملة تجريبية", "sfx": "", "music": "", "prompt": "Test scene. Vertical 9:16."}
                       for i in range(3)],
            "voiceover_script": "فويس أوفر تجريبي", "music_direction": "beat", "sound_design": "whoosh",
            "cast": "مدرب", "locations": "جيم", "production_notes": "تجربة", "cta": "حمّل كوتشي", "caption": "كابشن"}
