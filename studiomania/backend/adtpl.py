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


# ---------------------------------------------------------------- 🦴 هيكل عظمي · 🗣️ المنتج بيتكلم · 🎵 إعلان أغنية (skills «skeleton-ads» / «talking-object» / «song-style-ad»)
# شخصية واحدة (plate) بتتعمل مرة وبتتبعت مع كل توليدة، واللقطات بتتجمع في توليدات لحد ١٥ ثانية (كل لقطة ليها وقتها جوه البرومت).

LOOKS = {
    "skeleton": {
        "bare": ("سينمائي: هيكل عاجي وعيون كرتون كبيرة", "A full anatomical skeleton with natural adult human proportions, tall and lanky, smooth ivory-cream "
                 "bones with realistic bone detail (not toy-smooth, not chibi, not scary), and large expressive cartoon eyes with white sclera and dark "
                 "pupils set in the eye sockets, giving an emotive, lovable face. No clothing.",
                 "cinematic 3D animated render, photoreal {theme} environment, warm {palette} color grade, soft volumetric light with drifting "
                 "atmosphere, shallow depth of field"),
        "dressed": ("لابس: نفس الهيكل بلبس على الموضوع", "The same friendly skeleton (ivory bones, large expressive cartoon eyes with white sclera and dark "
                    "pupils) wearing a complete outfit that fits the theme ({wardrobe}); skull, hands and any exposed bones still visible.",
                    "cinematic 3D animated render, photoreal {theme} environment, warm {palette} color grade, soft volumetric light, shallow depth of field"),
        "xray": ("أشعة: جسم شفاف والأعضاء منورة (صحة ومكملات)", "A translucent glowing anatomical human body revealing the full white skeleton plus visible "
                 "internal organs (heart, lungs, intestines) glowing red and orange through a blue-tinted translucent skin outline, with large "
                 "expressive cartoon eyes.",
                 "clean sci-fi medical 3D render, cool blue translucent body with warm organ glow, {theme} setting with x-ray glow, soft rim light"),
        "cute": ("كيوت: هيكل صغير شكل اللعبة (للبراندات الهزارية بس)", "A cute chibi cartoon skeleton with an oversized round skull, big adorable eyes, a "
                 "small rounded body, and smooth toy-like bones; bright, friendly, non-scary.",
                 "playful 3D animated feature-film render, simple clean {palette} background, soft even studio lighting"),
    },
    "talking": {
        "pixar": ("3D كرتون (زي أفلام الأنيميشن)", "", "Pixar-style 3D animated render, soft cinematic lighting, rich saturated colors"),
        "clay": ("صلصال ستوب موشن", "", "handmade stop-motion claymation, matte plasticine with visible fingerprints and tool marks, real miniature-set lighting"),
        "watercolor": ("ألوان مية", "", "hand-painted watercolor animation, soft paper texture, gentle washes and ink outlines"),
        "paper": ("ورق مقصوص", "", "layered papercraft animation, stacked cardstock with visible paper thickness and soft cast shadows"),
        "toy": ("لعبة مكعبات", "", "toy brick-built animated world, glossy plastic bricks and minifigure-like characters, playful macro lighting"),
    },
}
LOOKS["song"] = LOOKS["talking"]


def plate_messages(kind: str, look: str, desc: str, brief: str, product: str) -> list[dict]:
    """وصف الشخصية الرئيسية (اللي بتتعمل plate) بالإنجليزي."""
    if kind == "skeleton":
        task = ("The hero is the skeleton (its design is locked). Choose the ad's world: theme (a recurring setting that dramatizes the angle, e.g. "
                "1940s small town / modern office / the product's industry), palette (a warm color grade in a few words) and wardrobe (only used by "
                "the dressed look: a full outfit that fits the theme).")
    else:
        task = ("Design ONE character that talks to camera. If the brief points to the product itself, the character IS the product "
                "(anthropomorphized: large expressive eyes on the upper part, a mouth below, short stylized arms, the label and colours kept from the "
                "product photo). Otherwise an animated person, animal or ingredient that carries the message. Write it in layers: subject + 2-3 "
                "defining adjectives, body form, colour/texture, face, limbs, a pose of active intent. Brand palette and mood are brand signal, not defaults.")
    sys = (f"{task}\nReturn JSON only: {{\"character\": \"English character description (empty for the skeleton)\", \"is_product\": true/false, "
           "\"theme\": \"...\", \"palette\": \"...\", \"wardrobe\": \"...\", \"handle\": \"short English descriptor used in prompts\", "
           "\"summary_ar\": \"ملخص الشخصية في سطر بالعامية\"}")
    return [{"role": "system", "content": sys}, {"role": "user", "content": f"Look: {look}\nUser description (Arabic): {desc or '-'}\nAd brief (Arabic): {brief}\nProduct: {product or '-'}"}]


def look_style(kind: str, look: str, hero: dict) -> tuple[str, str]:
    """(وصف الشخصية، سطر الستايل) بعد ما الموضوع والألوان اتملوا."""
    L = LOOKS[kind].get(look) or next(iter(LOOKS[kind].values()))
    fill = {"theme": hero.get("theme") or "warm cinematic", "palette": hero.get("palette") or "amber", "wardrobe": hero.get("wardrobe") or "a themed outfit"}
    char = (L[1].format(**fill) if L[1] else hero.get("character") or "")
    return char, L[2].format(**fill)


def plate_prompt(kind: str, look: str, hero: dict, with_product: bool) -> str:
    char, style = look_style(kind, look, hero)
    prod = (" The character is the product from the attached image - same silhouette, colours and label - brought to life with a face and limbs."
            if with_product and hero.get("is_product") else "")
    return (f"{style}. Character plate: {char}{prod} The character alone, full body visible, a pose of active intent, centred on a plain soft "
            "neutral background. Same character in every later shot. No text, no letters, no logos added.")


def beats_messages(d: dict, lang_txt: str, guide: str, brain_txt: str) -> list[dict]:
    a = d["ad"]
    kind, hero = a["kind"], a.get("hero") or {}
    p = a.get("product") or {}
    common = ("- visual (English): what the camera sees in this beat: the character's situation, action and emotion, the setting, props and the product "
              "(when it appears), and a framing that varies across beats (wide, medium, close product handling, hero). Never describe the product's "
              "looks or the character's design (the references carry them).\n"
              "- camera (English): one camera move.\n- with: which references appear in the beat: hero, product.\n"
              "- ممنوع تخترع أرقام أو إثباتات مش في ملف العميل، وممنوع أسامي ناس حقيقيين أو شعارات تانية.\n")
    if kind == "skeleton":
        sys = ("إنت كاتب إعلانات Direct Response بفورمات «إيه اللي يحصل لو...؟»: هيكل عظمي كرتون ثابت بيعيش رحلة بتتصاعد (يوم ١ ← يوم ٣٠ ← يوم ٣٦٥) "
               "وصوت راوي واحد بيحكي.\n"
               "- اختار الزاوية: تحوّل بالاستخدام اليومي / تمن إنك ماتعملش حاجة / الطريقة القديمة لحد ما تبوظ / المنتج في عالم غريب. والسلم: وقت أو كمية أو مراحل.\n"
               f"- السكريبت بلغة: {lang_txt}. {guide} سؤال فضول في الأول ← ٥-٧ نبضات بتتصاعد (جملة واحدة لكل نبضة ولكل درجة في السلم) ← النتيجة "
               "(انتصار أو كارثة) + دعوة خفيفة. المجموع حوالي ٧٠-١١٠ كلمة. المنتج بيدخل في نبضة واحدة واضحة (اللفة).\n"
               "- line: جملة الراوي للنبضة دي.\n" + common +
               'رجّع JSON بس: {"title": "...", "angle": "الزاوية والسلم في سطر", "shots": [{"line": "...", "visual": "...", "camera": "...", "with": ["hero"]}]}')
    elif kind == "talking":
        sys = ("إنت كاتب ومخرج إعلانات «الشخصية اللي بتتكلم»: شخصية أنيميشن بتكلم الكاميرا وتقول السكريبت، والصورة هي دليل الجملة.\n"
               "- الشكل: «أنا X. بعمل Y. فـ Z بيحصلك». اختار: تعريف مباشر / مشكلة بعدين حل / شرير بعدين بطل، واختار نبرة واحدة وثبّتها.\n"
               f"- الكلام بلغة: {lang_txt}. {guide} ٤-٧ نبضات، كل نبضة جملة قصيرة سهلة النطق (٥-١٢ كلمة)، والمجموع يتقال في ٢٠-٣٥ ثانية. "
               "أول فريم لازم يشد من غير صوت، وأول جملة بتنادي على مشكلة المشاهد بالظبط.\n"
               "- line: الجملة اللي الشخصية بتقولها. emotion (English): نبرة الصوت (warm, reassuring / frustrated / proud...).\n"
               "- كل نبضة فيها حركتين على الأقل من: الكاميرا بتتحرك، الشخصية بتتحرك وبتعمل اللي بتقوله، المكان بيتفاعل.\n" + common +
               'رجّع JSON بس: {"title": "...", "angle": "الشكل والنبرة في سطر", "shots": [{"line": "...", "emotion": "...", "visual": "...", "camera": "...", "with": ["hero"]}]}')
    else:
        sys = ("إنت كاتب أغاني إعلانات: أغنية حقيقية (مش جينجل) بتحكي نتيجة العميل، فوق فيديو أنيميشن والبطل بيغني في لقطة أو اتنين.\n"
               f"- الكلمات بلغة: {lang_txt}. {guide} الهوك في أول ٥ ثواني، والكلمات عن النتيجة اللي العميل بيوصلها مش اسم البراند. "
               "سطور قصيرة تتغني (٤-٨ مقاطع). ٣٠ ثانية = كوبليه، كورس، كوبليه، كورس. استخدم [Verse] و[Chorus] في الكلمات.\n"
               "- style (English, under 25 words): genre, vocal, tempo/BPM, mood, production. Genre from the audience. No artist names.\n"
               "- shots: لقطة لكل سطر أو سطرين بالترتيب: lyric = السطور اللي بتتغنى في اللقطة دي بالظبط، sing = true للقطات اللي البطل بيغني فيها "
               "قدام الكاميرا (الهوك والكورس الأخير غالبًا)، والباقي صورة بتوضح الكلام.\n" + common +
               'رجّع JSON بس: {"title": "...", "angle": "الفكرة في سطر", "style": "...", "lyrics": "...", '
               '"shots": [{"lyric": "...", "sing": false, "visual": "...", "camera": "...", "with": ["hero"]}]}')
    return [{"role": "system", "content": sys}, {"role": "user", "content":
            f"ملف العميل:\n{brain_txt or '(مفيش)'}\n\nالمنتج: {p.get('name') or '-'} ({p.get('kind') or '-'})\nالشخصية: {hero.get('handle') or '-'}\n"
            f"الإعلان: {(a.get('script') or '').strip() or d.get('brief') or ''}"}]


def clean_beats(kind: str, res: dict) -> list[dict]:
    out = []
    for s in (res.get("shots") or [])[:12]:
        if not isinstance(s, dict):
            continue
        line = _txt(s.get("lyric") if kind == "song" else s.get("line"), 300)
        out.append({"line": line, "emotion": _txt(s.get("emotion"), 80), "sing": bool(s.get("sing")), "visual": _txt(s.get("visual"), 1500),
                    "camera": _txt(s.get("camera"), 300), "with": [x for x in (s.get("with") or ["hero"]) if x in ("hero", "product")],
                    "dur": max(2.5, min(6.0, len(line) / 14.0 + 0.6))})
    return out


def group_beats(shots: list[dict], cap: float = 15.0) -> list[list[int]]:
    """لقطات ورا بعض في توليدة واحدة لحد ١٥ ثانية."""
    groups, cur, t = [], [], 0.0
    for i, s in enumerate(shots):
        if cur and t + s["dur"] > cap:
            groups.append(cur)
            cur, t = [], 0.0
        cur.append(i)
        t += s["dur"]
    if cur:
        groups.append(cur)
    return groups


def batch_prompt(d: dict, idx: list[int], roles: list[str]) -> str:
    a = d["ad"]
    kind, hero, shots = a["kind"], a.get("hero") or {}, a["plan"]["shots"]
    char, style = look_style(kind, a.get("look") or "", hero)
    who = hero.get("handle") or "the character"
    desc = {"plate": f"{who} - the hero character; keep its design exactly as in this image in every beat ({char[:900]})",
            "product": f"the {(a.get('product') or {}).get('name') or 'product'} - identical shape, label, colours and packaging"}
    refs = " ".join(f"@image{k + 1} is {desc[r]}." for k, r in enumerate(roles))
    lines, t = [], 0.0
    for n, i in enumerate(idx):
        s = shots[i]
        t1 = t + s["dur"]
        talk = ""
        if kind == "talking" and s.get("line"):
            talk = f' {who} talks to camera in a {s.get("emotion") or "warm, confident"} voice, saying in {a.get("spoken") or "Arabic"}: "{s["line"]}"'
        elif kind == "song" and s.get("sing"):
            talk = f" {who} sings this line on camera with expressive mouth movement and performance energy."
        lines.append(f"[{t:.1f}-{t1:.1f}s] Beat {n + 1}: {s.get('visual') or ''} Camera: {s.get('camera') or 'slow push-in'}.{talk}"
                     + (" Cut to -" if n < len(idx) - 1 else ""))
        t = t1
    sound = ("Natural voice for the spoken lines, light diegetic sound. No captions, no background music." if kind == "talking"
             else "No dialogue, no voice, no singing audio, no music (the voiceover / song is added in the edit); light diegetic sound only.")
    return (f"{style}.\nReferences: {refs}\n" + "\n".join(lines) + f"\n{sound} No on-screen text, no captions, no letters anywhere. "
            "The hero character stays the exact same design in every beat.")
