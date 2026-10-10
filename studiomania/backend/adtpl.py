"""🎯 قوالب الإعلانات (UGC، إعلان سينمائي، ...): شخصية ثابتة + صورة المنتج + سكريبت ← برومتات Seedance جاهزة.

الطريقة مستوحاة من skills «ugc» (PYNK AI UGC Studio) و«ad-director / ad-assets» و«image/video-prompter» (Pink Prompt Director):
- الشخصية بتتعمل مرة واحدة (صورة وش ← صورة جسم كامل بنفس الوش) وبتتبعت مرجع مع كل توليدة، فبتفضل هي هي.
- صورة المنتج هي المرجع: البرومت عمره ما بيوصف شكل المنتج بالكلام (الوصف بيخلي الموديل يعيد تصميمه).
- الكلام على الشاشة ممنوع جوه الفيديو؛ اسم البراند والجملة الأخيرة بيتكتبوا بخطوطنا في الآخر.
"""
from __future__ import annotations

import re

# اللهجة ← اسمها بالإنجليزي (للموديل اللي بيتكلم بصوته جوه الفيديو)
SPOKEN = {
    "ar-eg-cairo": "Egyptian Arabic (Cairo dialect)", "ar-sa-najdi": "Saudi Arabic (Najdi dialect)", "ar-sa-hijazi": "Saudi Arabic (Hijazi dialect)",
    "ar-gulf": "Gulf Arabic", "ar-ae": "Emirati Arabic", "ar-kw": "Kuwaiti Arabic", "ar-qa": "Qatari Arabic", "ar-bh": "Bahraini Arabic",
    "ar-om": "Omani Arabic", "ar-levant": "Levantine Arabic", "ar-iq": "Iraqi Arabic", "ar-sd": "Sudanese Arabic", "ar-ma": "Moroccan Darija",
    "ar-dz": "Algerian Arabic", "ar-tn": "Tunisian Arabic", "ar-msa": "Modern Standard Arabic",
}

# ---------------------------------------------------------------- الشخصية (Mode 0/1 من skill «image-prompter»: وش ← جسم كامل)
FLAT_CLOSE = (
    "Mid-gray seamless studio background - even neutral mid-gray, no seam line, no gradient, no falloff to black or white. One broad diffused "
    "source from camera-left and slightly above, a soft triangle of light on the shadow cheek, gentle wrap onto the face, no hard shadow edges, "
    "no rim light, no hair light. Skin reads matte and velvety - zero shine on forehead, nose bridge, cheekbones, temples and chin - in a "
    "low-contrast natural look. Skin renders at its true natural tone, warmth preserved, never pale or washed-out or cool-shifted by the "
    "background. Real peach fuzz at the jaw and hairline, real soft fine even pore texture, subsurface scattering reading as semi-translucent "
    "biology, never plastic, never waxy AI render, never glass-skin, never harsh - fine flattering texture that keeps the face looking good, "
    "no acne, no blemishes, no rough pores. Natural photographic realism, soft natural grain. Photographed not generated."
)


def hero_messages(desc: str, brief: str, kind: str) -> list[dict]:
    """وصف الشخصية (اللي كتبه العميل بالعربي) ← مواصفات ثابتة بالإنجليزي للصور."""
    sys = (
        "إنت مسؤول الكاستينج في إعلانات واقعية. هتاخد وصف قصير لشخصية (أو مفيش) وتطلع مواصفات كاملة ثابتة بالإنجليزي لصورة مرجعية.\n"
        "- من غير سن ولا أسامي: اوصف بالشعر والملامح والجسم والطاقة واللبس.\n"
        "- اللبس: لبس عادي من الحياة يناسب الإعلان" + (" (حد بيصوّر نفسه بالموبايل)" if kind == "ugc" else "") + "، فوق وتحت وجزمة، ومحتشم.\n"
        "- handle: وصف قصير مميز للشخصية يتقال في البرومتات (زي: the woman with the soft brown hijab and the denim jacket).\n"
        'رجّع JSON بس: {"gender": "female|male", "identity": "English: face, skin tone and finish, hair (color, length, texture), eyes, brows, lips, '
        'build, default expression - one paragraph", "outfit": "English: top / bottom / shoes / accessories", "handle": "English short descriptor", '
        '"summary_ar": "ملخص الشخصية في سطر بالعامية"}')
    return [{"role": "system", "content": sys}, {"role": "user", "content": f"وصف الشخصية: {desc or '(اختار إنت شخصية تناسب الإعلان)'}\nالإعلان عن: {brief}"}]


def head_prompt(hero: dict) -> str:
    top = "a plain black long-sleeve crew-neck top"
    return (f"A clean character-reference 3:4 headshot, framed from forehead to upper chest with the face filling most of the frame. {hero['identity']} "
            f"Wearing {top}, no jewelry, no logos, no graphics. Body squared to camera, head level, relaxed natural expression with warm "
            f"approachable energy, eyes to camera, lips closed and relaxed.\n\n{FLAT_CLOSE}")


def body_prompt(hero: dict) -> str:
    return (f"A full-body character reference photo of {hero['handle']}, standing relaxed with weight on one hip, arms loose, natural easy energy, "
            f"eyes to camera with a soft closed-lip smile. Wearing {hero['outfit']}. Face, hair and identity identical to the attached headshot "
            "reference.\n\nMid-gray seamless studio background - even neutral mid-gray, no seam line, no gradient. One broad diffused source from "
            "camera-left and slightly above, gentle wrap onto the figure, no harsh shadows, no rim light. Skin and fabric read matte and natural in a "
            "low-contrast look, true natural skin tone and true garment colors, warmth preserved, never washed-out or cool-shifted. Real fine even "
            "pore texture, real fabric weave and drape, never plastic, never waxy. Natural photographic realism, soft natural grain. Photographed not generated.")


# ---------------------------------------------------------------- 📱 UGC (skill «ugc»): ١٥ ثانية، ٤ نبضات، الكاميرا الأمامية والخلفية
UGC_PLACES = {
    "bathroom": "حمام، الصبح (سكين كير وتجهيز)", "car": "عربية راكنة، كرسي السواق (كلام على السريع)",
    "kitchen": "مطبخ، نور النهار (روتين ونصيحة صادقة)", "bedroom": "أوضة نوم، بالليل (دافي وصادق)",
    "desk": "مكتب في البيت (شغل وإنتاجية)", "street": "شارع أو كافيه برّه (حركة وطاقة)",
}
UGC_BEATS = [("0-3s", "Opener"), ("3-7s", "Use"), ("7-11s", "Result"), ("11-15s", "Verdict")]


def ugc_messages(d: dict, lang_txt: str, guide: str, brain_txt: str) -> list[dict]:
    a = d["ad"]
    own = (a.get("script") or "").strip()
    sys = (
        "إنت كاتب ومخرج إعلانات UGC: حد حقيقي ماسك موبايله وبيتكلم عن منتج بيحبه فعلًا، مش إعلان متصوّر.\n"
        f"الفيديو ١٥ ثانية بالظبط، ٤ نبضات، والكلام بلغة: {lang_txt}. {guide}\n"
        "- السكريبت كله حوالي ٣٢-٣٨ كلمة (كلام طبيعي مريح في ١٥ ثانية): ١ افتتاحية/رد فعل قبل أي كلام عن المنتج (٤-٧ كلمات) · ٢ وهي بتستخدمه "
        "(إحساسه، طعمه، ريحته، شكله) (٦-٩ كلمات) · ٣ النتيجة اللي عمله لها، وده أهم جزء (٩-١٤ كلمة) · ٤ حكمها في الآخر قصير (٣-٦ كلمات).\n"
        "- كلام متقطع وعفوي زي ما بتكلم صاحبتها، مش لغة إعلانات. اسم المنتج مرة واحدة بالكتير. من غير «اللينك في البايو» ومن غير هاشتاجات.\n"
        "- ممنوع تخترع أرقام أو ادعاءات: استخدم بس اللي في الفكرة أو ملف العميل.\n"
        "- world (English, 35-40 words): المكان بقى مكان حقيقي محدد: الأسطح، مصدر النور واتجاهه، والإحساس.\n"
        "- lighting (English, short): النور اللي يناسب المكان (natural window light / warm lamp light / daylight through the windshield...).\n"
        "- action (English) لكل نبضة: زاوية كاميرا جديدة أو تبديل بين الكاميرا الأمامية والخلفية مكتوب كحركة هي بتعملها، ولحظة واحدة للمنتج "
        "(@Image3): تميله في النور، تقرّبه من العدسة، تملا بيه الكادر، أو تمسكه جنب وشها.\n"
        'رجّع JSON بس: {"title": "اسم قصير", "world": "...", "lighting": "...", '
        '"beats": [{"line": "الجملة بالظبط", "action": "English camera + action"}]} أربع نبضات بالظبط.')
    task = (f"العميل كتب السكريبت ده: «{own}». قسّمه على الأربع نبضات بكلامه هو، وقصّر بس لو أطول من الوقت. لو جزء ناقص اكتبه إنت."
            if own else f"الفكرة: {d.get('brief') or ''}")
    p = a.get("product") or {}
    return [{"role": "system", "content": sys}, {"role": "user", "content":
            f"ملف العميل:\n{brain_txt or '(مفيش)'}\n\nالمنتج: {p.get('name') or '-'} ({p.get('kind') or '-'})\nالمكان: {a.get('place') or '-'}\n{task}"}]


def ugc_prompt(d: dict) -> str:
    """البرومت الكبير (Master prompt) بنفس ترتيب skill «ugc» بالظبط."""
    a, plan = d["ad"], d["ad"]["plan"]
    name = (a.get("product") or {}).get("name") or "the product"
    she = "she" if (a.get("hero") or {}).get("gender") != "male" else "he"
    her = "her" if she == "she" else "his"
    beats = "\n".join(f'{t} - {lab}: {(b.get("action") or "").strip().rstrip(".")}. "{b.get("line") or ""}"' for (t, lab), b in zip(UGC_BEATS, plan["shots"]))
    return (f"A UGC selfie review of {name}. iPhone footage cutting between front and back camera, {plan.get('lighting') or 'natural light'}. "
            f"The appearance of the model and the product comes entirely from the three attached assets. @Image1 locks {her} face and identity - "
            f"match it exactly. @Image2 locks {her} outfit and body - same clothing, same fabric, same fit. @Image3 is the {name} in {her} hand, and it "
            f"stays exactly as @Image3 shows it. Never describe their appearance in words - the assets are the source of truth.\n\n"
            f"{plan.get('world') or ''}\n\n{beats}\n\n"
            f"{she.capitalize()} speaks in {d['ad'].get('spoken') or 'Arabic'}, natural casual voice, the lines exactly as written. The video looks and sounds like "
            "real iPhone footage - authentic UGC aesthetic, iPhone HDR, slight handheld shake, natural voice and room tone fitting the scene. Nothing "
            "produced makes it in - no text overlays, no captions, no filters, no processed look, no music. The phone, the camera, and hands holding "
            "the phone or camera are never visible.")


# ---------------------------------------------------------------- 🎬 إعلان سينمائي (skills «ad-director» + «video-prompter»)
CINEMA_LOOKS = {   # الشكل ← (اسم عربي، سطر الكاميرا والجريد)
    "narrative": ("حياة حقيقية: شوارع وبيوت وعربيات", "wide-latitude cinema capture, vintage 2x anamorphic character at a wide aperture - oval bokeh, "
                  "soft frame-edge falloff - light diffusion bloom softening highlights, handheld with natural operator breath, color-negative daylight "
                  "film rendition with fine 35mm grain, teal-amber grade, shallow depth of field, 24fps 180-degree shutter"),
    "studio": ("استوديو وموضة: نضيف ومتصمّم", "wide-latitude cinema capture, clean spherical lens character at a wide aperture - natural round bokeh, "
               "even sharpness - mild diffusion bloom, locked tripod with an optional slow push-in, saturated editorial grade, fine grain, "
               "warm-retained blacks, 24fps 180-degree shutter"),
    "action": ("أكشن وطاقة: حركة وتراب وسرعة", "wide-latitude cinema capture, vintage 2x anamorphic character at a wide aperture - oval bokeh, soft edge "
               "falloff - light diffusion bloom, handheld and shaky throughout with no stabilized shots, color-negative film rendition with heavier "
               "low-light grain, dusty atmospheric haze, 24fps 180-degree shutter"),
    "mood": ("أجواء هادية: مكان وطقس وإحساس", "wide-latitude cinema capture, vintage 2x anamorphic character at a wide aperture - oval bokeh, soft edge "
             "falloff - light diffusion bloom, locked-off or extremely slow push-in only, color-negative film rendition with fine grain, atmospheric "
             "haze, weathered material detail, 24fps 180-degree shutter"),
}
CINEMA_BEATS = {"HOOK": "تشد العين", "SETUP": "تعريف", "PROBLEM": "المشكلة", "REVEAL": "ظهور المنتج", "DEMO": "المنتج شغال",
                "REACTION": "رد الفعل", "PAYOFF": "النتيجة", "HERO": "لقطة المنتج"}
CAPTURE = (
    "Capture Realism: the subject sits inside real depth - {air} atmosphere suspended in the air between camera, subject and the far background, "
    "the background rendered softer, desaturated and lower-contrast than the foreground so the subject sits within the air rather than pasted on a "
    "flat plane.{skin} Low-contrast curve - shadows lifted gently holding texture, highlights rolled off softly never clipping to white, nothing "
    "crushed to black. All specular highlights removed from skin, hair, fabric and surrounding surfaces, every pixel reading matte and diffuse. "
    "Slightly desaturated grade with warmth preserved."
)
SKIN = (" Skin reads true cinematic matte - zero shine on forehead, nose bridge, cheekbones, temples and chin, real peach fuzz at the jaw and "
        "hairline, real soft fine even pore texture, warmth preserved, never plastic, never harsh - fine flattering texture that keeps the face looking good.")
MUSIC_TAIL = ("Diegetic sound only, recorded on set. No music, no score, no soundtrack, no song, no singing, no humming, no voiceover, no narration.")
NO_TEXT = ("NO ON-SCREEN TEXT (CRITICAL): no captions, no subtitles, no titles, no lower thirds, no watermarks, no logos added, no UI, no Chinese "
           "or Korean characters, no invented words anywhere in frame. Printed text that physically exists on the product label stays exactly as in "
           "its reference.")


def cinema_messages(d: dict, lang_txt: str, guide: str, brain_txt: str, total: int) -> list[dict]:
    a = d["ad"]
    has_hero = bool((a.get("hero") or {}).get("head"))
    shots = {6: "2-3", 10: "3-4", 15: "4-6", 20: "5-7", 30: "7-10"}.get(total, "4-6")
    look = CINEMA_LOOKS.get(a.get("look") or "narrative", CINEMA_LOOKS["narrative"])[0]
    sys = (
        "إنت مخرج إعلانات سينمائية. بتقسّم الإعلان للقطات بتوقيتها، كل لقطة زاوية واحدة متصلة (توليدة واحدة).\n"
        f"طول الإعلان {total} ثانية من غير الكارت الأخير، {shots} لقطات، كل لقطة بين ٢ و٤ ثواني. ستايل الصورة: {look}.\n"
        "- beat لكل لقطة واحد من: HOOK (أول فريم بيشد، حاجة بتحصل فعلًا) · SETUP (بس لو الإعلان أطول من ١٠ ثواني) · PROBLEM (المشكلة اللي المنتج "
        "بيحلها، باينة جسديًا) · REVEAL (أول مرة المنتج يبان واضح والليبل قدام الكاميرا) · DEMO (المنتج شغال في الإيد) · REACTION (الوش، النفس) · "
        "PAYOFF (النتيجة اللي المنتج عملها) · HERO (المنتج لوحده متصوّر حلو).\n"
        "- visual (English): اللي الكاميرا شايفاه بس: مين/إيه فين في الكادر (قدام/وسط/ورا)، الوضع، الحركة اللي بتحصل بالثواني، الإيد ماسكة المنتج إزاي، "
        "والنور جاي منين. ممنوع توصف شكل المنتج أو الشخصية (الصور المرجعية بتكفي).\n"
        "- camera (English): العدسة (مثلًا 35mm wide / 50mm medium / 85mm close-up) وحركة كاميرا واحدة.\n"
        "- audio (English): ٢-٤ أصوات حقيقية في المكان من غير موسيقى ولا كلام.\n"
        "- with: المراجع اللي في اللقطة من: hero (الشخصية)" + ("" if has_hero else " - مفيش شخصية، فاللقطات إيدين أو منتج بس") + "، product، place.\n"
        f"- line: جملة فويس أوفر قصيرة للقطة دي (اختياري، فاضية لو اللقطة صامتة) بلغة: {lang_txt}. {guide} "
        "كل ثانية حوالي كلمتين بالكتير، والفويس أوفر كله بيحكي فكرة واحدة.\n"
        "- end: الكارت الأخير (اسم البراند زي ما بيتكتب + جملة قصيرة ٢-٥ كلمات بنفس اللغة).\n"
        "- world (English): سطر واحد ثابت لكل اللقطات: المكان والوقت والنور والألوان، عشان كلهم يتقطعوا على بعض.\n"
        "- ممنوع تخترع أرقام أو ادعاءات، وممنوع أسامي أو وشوش ناس حقيقيين أو شعارات تانية.\n"
        'رجّع JSON بس: {"title": "اسم قصير", "world": "...", "end": {"brand": "...", "slogan": "..."}, '
        '"shots": [{"beat": "HOOK", "dur": 2.5, "what": "وصف قصير بالعامية", "visual": "...", "camera": "...", "audio": "...", "with": ["hero", "product"], "line": ""}]}')
    p = a.get("product") or {}
    return [{"role": "system", "content": sys}, {"role": "user", "content":
            f"ملف العميل:\n{brain_txt or '(مفيش)'}\n\nالمنتج: {p.get('name') or '-'} ({p.get('kind') or '-'})\nالمكان: {a.get('place') or '-'}\n"
            f"الإعلان: {(a.get('script') or '').strip() or d.get('brief') or ''}"}]


def plate_messages(place: str, brief: str) -> list[dict]:
    """صورة المكان من غير ناس (Mode 3: خمس فقرات بلغة السينما)."""
    sys = ("You write one photoreal environment-plate image prompt (no people in it) in cinema prose: five short paragraphs - (1) the place, time "
           "of day and weather, (2) foreground, midground and far background planes with real materials, (3) the light sources and where they fall, "
           "(4) colour and atmosphere with visible haze between the planes, (5) the camera: a vintage 2x anamorphic lens, eye level, a frame that "
           "leaves room for a person and a product. No people, no text, no signs with words, no logos. Return JSON only: {\"prompt\": \"...\"}")
    return [{"role": "system", "content": sys}, {"role": "user", "content": f"Place (Arabic): {place}\nAd: {brief}"}]


PLATE_CLOSE = (" Captured with a wide-latitude cinema look, vintage 2x anamorphic character, oval bokeh, soft frame-edge falloff, a light diffusion bloom "
               "lifting highlights into a soft halation. True atmospheric perspective with visible haze between planes. Highlights rolled off gently, "
               "lifted blacks that never crush. Color-negative film look with fine 35mm grain. No people, no text. Photographed not generated.")


def cinema_shot_prompt(d: dict, i: int, refs: list[str]) -> str:
    """لقطة واحدة على العمود الفقري بتاع «ad-director» (مختصر): الهيدر ← الستايل ← بلا كلام ← المراجع ← الكادر ← الكاميرا ← الواقعية ← الصوت ← الأقفال."""
    a, plan = d["ad"], d["ad"]["plan"]
    s = plan["shots"][i]
    look = CINEMA_LOOKS.get(a.get("look") or "narrative", CINEMA_LOOKS["narrative"])[1]
    dur = max(1.0, float(s.get("dur") or 3))
    who = (a.get('hero') or {}).get('handle') or 'the character'
    desc = {"hero_head": f"the face of {who} - match face, hair and identity exactly",
            "hero_body": f"the full body and outfit of {who} - same clothing, same fabric, same fit",
            "product": f"the {(a.get('product') or {}).get('name') or 'product'} - identical shape, proportions, label, colours and packaging, it has real "
                       "mass and sits in the same light as everything else, never floating, never glowing",
            "place": "the location plate - same place, same light, same materials"}
    assets = " ".join(f"@image{k + 1} is {desc[r]}." for k, r in enumerate(refs))
    hero_in = any(r.startswith("hero") for r in refs)
    return (f"1 continuous shot, {dur:.1f} seconds, real-time. Cinematic commercial, {plan.get('world') or ''}.\n"
            f"{NO_TEXT}\n"
            f"ASSETS: {assets}\n"
            f"SHOT: {s.get('visual') or ''}\n"
            f"CAMERA: {s.get('camera') or ''}. {look}.\n"
            + CAPTURE.format(air="light", skin=SKIN if hero_in else "") + "\n"
            f"AUDIO: {s.get('audio') or 'room tone'}. {MUSIC_TAIL}\n"
            "LOCKS: identity, product and label stay identical to their references for the whole shot; no morphing; one continuous take, no cuts.")


def end_card_prompt(d: dict) -> str:
    a, plan = d["ad"], d["ad"]["plan"]
    look = CINEMA_LOOKS.get(a.get("look") or "narrative", CINEMA_LOOKS["narrative"])[1]
    return (f"1 continuous shot, 4 seconds, real-time. Cinematic commercial end card, {plan.get('world') or ''}.\n{NO_TEXT}\n"
            f"ASSETS: @image1 is the {(a.get('product') or {}).get('name') or 'product'} - identical shape, label, colours and packaging.\n"
            "SHOT: the product alone, upright, label square to camera, resting on a clean surface in the lower-middle of the frame with a real contact "
            "shadow beneath it, the upper half of the frame left calm and empty (space for the brand name added later). Everything settles and holds still.\n"
            f"CAMERA: 85mm, locked-off with an extremely slow push-in. {look}.\n"
            + CAPTURE.format(air="thin", skin="") + "\n"
            f"AUDIO: clean room tone. {MUSIC_TAIL}\n"
            "LOCKS: product identical to its reference, no figures, no faces, no hands, no text of any kind.")


def clean_plan_shots(kind: str, res: dict, total: int) -> list[dict]:
    if kind == "ugc":
        bs = [x for x in (res.get("beats") or []) if isinstance(x, dict)][:4]
        while len(bs) < 4:
            bs.append({"line": "", "action": "she turns the back camera to the product"})
        return [{"line": _txt(b.get("line"), 300), "action": _txt(b.get("action"), 600), "dur": 3.0 if k == 0 else 4.0} for k, b in enumerate(bs)]
    out = []
    for s in (res.get("shots") or [])[:12]:
        if not isinstance(s, dict):
            continue
        beat = str(s.get("beat") or "").upper()
        w = [x for x in (s.get("with") or []) if x in ("hero", "product", "place")]
        out.append({"beat": beat if beat in CINEMA_BEATS else "DEMO", "dur": max(1.5, min(5.0, float(s.get("dur") or 3))),
                    "what": _txt(s.get("what"), 300), "visual": _txt(s.get("visual"), 1500), "camera": _txt(s.get("camera"), 400),
                    "audio": _txt(s.get("audio"), 300), "with": w, "line": _txt(s.get("line"), 300)})
    if out:   # المدد بتتظبط على الطول اللي اتختار
        k = total / sum(s["dur"] for s in out)
        for s in out:
            s["dur"] = round(max(1.5, s["dur"] * k), 1)
    return out


def _txt(v, n: int) -> str:
    return re.sub(r"\s+", " ", str(v or "")).strip()[:n]
