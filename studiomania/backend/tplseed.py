"""📚 القوالب الجاهزة (أول ٥ قوالب في المعرض): Style DNA كامل لكل قالب بنفس شكل المخطط اللي المعمل بيطلّعه،
ومعاه الخلفية الثابتة والممنوعات ووصف الكادر الأخير والترانزيشن اللي على روح الستايل.
مأخوذة من مكتبة skill «video-prompt» (MIT، تيسير العطية @taiseralattiyah)."""
from __future__ import annotations


def _beats(rows: list[tuple]) -> list[dict]:
    """(المدة، الدور، اللي بيحصل بالعربي، layout، camera، into_next، keeps) ← أجزاء متتالية من غير فراغ."""
    out, t = [], 0.0
    for dur, role, what, layout, camera, into_next, keeps in rows:
        out.append({"t0": round(t, 2), "t1": round(t + dur, 2), "role": role, "what": what, "layout": layout,
                    "slots": [], "camera": camera, "into_next": into_next, "keeps": keeps, "sfx": ""})
        t += dur
    out[-1]["into_next"] = ""
    return out


BUILTIN = {
    "sk-paper": {
        "name": "تكريم ورقي عتيق", "icon": "📜", "uses": "تكريم، ذكرى سنوية، ملخص إنجازات", "transition": "dissolve",
        "voice_tone": "warm, grateful, slow and proud",
        "sample": "تكريم مدرب رياضي بعد ١٠ سنين: أول فصل، أول بطولة، ١٠٠٠ متدرب، وشكرًا في الآخر",
        "schema": {
            "title": "تكريم ورقي عتيق", "summary": "كولاج أرشيفي على ورق كريمي: صور مقصوصة زي الستيكر، خط إيد ونجوم، وكارت شكر في الآخر.",
            "beat_sec": 0.0,
            "style": "Archival scrapbook collage on aged cream ruled paper: cut-out photos with a white sticker border and colored rings, "
                     "hand-drawn ink stars and underlines, stencil/typewriter headings, soft paper grain, gentle drop shadows, flat top light.",
            "background": "Cream paper with thin ruled lines across every frame; in the last third the paper turns older with a faint coffee stain and a postage stamp.",
            "palette": "Sage green (#9CAF88), mustard yellow (#D9A441), cornflower blue (#6495ED) plus cream (#F3EAD3) and black (#1A1A1A) only.",
            "spine": "The same cream ruled paper sheet stays under everything; cut-out photo cards are placed on it one after another.",
            "camera": "Mostly locked-off on the paper cards; only the final card sways very slightly.",
            "text_style": "Bold stencil/typewriter headings, cursive handwritten signature, one huge slab-serif wordmark at the end.",
            "music": "موسيقى دافية هادية (غير محدد بالظبط)", "negative": "No colors outside the palette, no glossy 3D, no neon, no real faces of real people (use silhouettes or generic portraits), no real logos.",
            "last_frame": "A static closing card on the aged paper: the wordmark in slab serif with the identity colors as a stripe, a small flag-like color band and a cursive signature under it.",
            "beats": _beats([
                (1.5, "hook", "هوك: توقيع بخط الإيد ودايرة فيها بورتريه", "[signature] handwritten at top, [portrait] cut-out in a colored ring at center", "static", "a paper strip tears across the frame revealing the logo underneath", "the cream ruled paper"),
                (1.0, "other", "ورق بيتقطع ويكشف الشعار", "[logo] revealed under a torn paper edge", "static", "the logo slides off and the first achievement card is placed on the paper", "the cream ruled paper"),
                (2.0, "feature", "إنجاز أول بخط تحته ونجمة", "[achievement 1] as a cut-out photo card, a hand-drawn underline and star", "static", "a second card is placed beside it", "paper and the first card"),
                (2.0, "feature", "إنجاز تاني", "[achievement 2] cut-out card with a hand-drawn star", "static", "a third card is placed", "paper"),
                (2.0, "proof", "إنجاز تالت/رقم", "[achievement 3 or number] on a card with an underline", "static", "a cursive heading is written over the cards", "paper"),
                (1.5, "other", "عنوان بخط كورسيف", "[cursive heading] written across the paper", "static", "a wide color stripe sweeps in", "paper"),
                (2.0, "other", "شريط لون عريض لبورتريه كبير", "[big portrait] cut-out on a wide sage/mustard stripe", "very slow push in", "the portrait fades to a silhouette with the word «thanks»", "the stripe"),
                (1.5, "other", "«شكرًا» فوق سيلويت", "[thanks] in stencil letters over a dark silhouette", "static", "the paper ages and the closing card is placed", "paper"),
                (2.0, "cta", "كارت أخير ثابت بالشعار والتوقيع", "[wordmark] huge slab serif, identity color band, [signature]", "slight sway", "", ""),
            ]),
        },
    },
    "sk-archive": {
        "name": "الأرشيف الحركي", "icon": "🗞️", "uses": "سيرة حياة، قصة تحفيزية، «فشل وبعدين نجاح»", "transition": "hblur",
        "voice_tone": "calm, reflective storyteller, low and steady",
        "sample": "قصة متدرب: بدأ بوزن زيادة، فشل مرتين، وبعدين قرر يكمل ونجح",
        "schema": {
            "title": "الأرشيف الحركي", "summary": "أبيض وأسود بالكامل: صور مقصوصة على ورق رسالة مكتوبة على آلة كاتبة، وكلام كبير بيتحرك.",
            "beat_sec": 0.0,
            "style": "Fully black-and-white archival kinetic typography: cut-out photos on a typewritten letter background, soft shadows, "
                     "film grain, scenes dissolve into each other through a blur.",
            "background": "An old typewritten letter page (grey text lines, paper texture) behind everything.",
            "palette": "Grey (#8A8A8A), black (#111111) and white (#F5F5F5) only.",
            "spine": "The same typewritten letter page stays behind every frame; photos and words are laid over it.",
            "camera": "Locked-off most of the time; a slow push-in on two key beats only.",
            "text_style": "Bold condensed sans for key words, light sans for the rest, handwriting only for signatures.",
            "music": "تعليق صوتي هادي من غير موسيقى تقريبًا، وصوت ورق وقلم خفيف",
            "negative": "No color at all, no glossy 3D, no real faces of real people, no logos, no neon.",
            "last_frame": "The closing sentence typed piece by piece in bold condensed sans on the letter page, perfectly still.",
            "beats": _beats([
                (1.8, "hook", "هوك: عنوان كبير", "[title] in bold condensed sans over the letter page", "static", "the title blurs and dissolves into the first setback photo", "letter page"),
                (2.0, "problem", "نكسة أولى بسهم مرسوم", "[setback 1] cut-out photo, a hand-drawn arrow pointing down", "static", "blur dissolve into the next setback", "letter page"),
                (2.0, "problem", "نكسة أكبر بدايرة مرسومة", "[setback 2] cut-out photo circled in ink", "slow push in", "a huge ghost word passes across", "letter page"),
                (1.5, "other", "كلمة شبح كبيرة عابرة", "[ghost word] huge, semi-transparent, sliding across", "static", "it fades revealing the opening photo again", "letter page"),
                (2.0, "other", "نبضة مقابلة بتكرر صورة البداية", "[mirror moment] same framing as the hook photo, now hopeful", "static", "quick cuts begin", "letter page"),
                (2.5, "proof", "مونتاج سريع ٤-٦ صور ناحية الخاتمة", "[4-6 quick photos] stacked one after another", "slow push in", "the photos settle and the final sentence starts typing", "letter page"),
                (2.2, "cta", "كارت أخير بالجملة الختامية بتتكتب حتة حتة", "[closing sentence] typed word by word", "static", "", ""),
            ]),
        },
    },
    "sk-engraved": {
        "name": "تحريري محفور", "icon": "🖋️", "uses": "محتوى تعليمي أو تسويقي: نصايح، شرح فكرة، إعلان منتج", "transition": "wipeleft",
        "voice_tone": "confident, clear teacher, punchy",
        "sample": "بطّل تتمرن كل يوم من غير راحة، وابدأ تنظم أيام الراحة: العضلة بتكبر وانت مرتاح",
        "schema": {
            "title": "تحريري محفور", "summary": "أبيض وأسود على ورق خشن برسومات محفورة زي الكتب القديمة، وشعار بازل بيتفك ويتركب.",
            "beat_sec": 0.0,
            "style": "Black-and-white editorial engraving on rough light paper: copperplate-style engraved illustrations like old books, "
                     "a jigsaw-puzzle emblem that breaks apart and reassembles, sharp arrows used as transitions.",
            "background": "Rough off-white paper texture in every frame.",
            "palette": "Black (#0E0E0E), white (#FAFAF7) and grey (#9A9A9A) only.",
            "spine": "The puzzle-piece emblem and the paper texture carry through the whole video.",
            "camera": "Locked-off with a very light parallax drift only.",
            "text_style": "Very bold geometric sans headlines, lighter sans for the secondary line.",
            "music": "إيقاع هادي ثابت (غير محدد)", "negative": "No color, no 3D render, no photos, no real logos or real people.",
            "last_frame": "A closing card on the paper: bold geometric headline, an engraved illustration strip under it, and a lighter second line.",
            "beats": _beats([
                (1.5, "hook", "الشعار بيتفك مع «بطّل تعمل كذا»", "[emblem] puzzle pieces breaking apart, [STOP doing X] headline", "static", "the pieces fly back and reassemble", "paper"),
                (1.5, "feature", "بيتركب تاني مع «ابدأ اعمل كذا»", "[emblem] reassembled, [START doing Y] headline", "static", "push close to a strong contrast line", "emblem"),
                (2.0, "proof", "لقطة قريبة بجملة تباين قوية", "[contrast line] bold, engraved detail behind", "slight parallax", "a puzzle-made figure assembles", "paper"),
                (2.5, "feature", "شخصية من قطع البازل بكلام بيتصاعد", "[figure] engraved, made of puzzle pieces, [rising text] stacking", "slight parallax", "a sharp arrow sweeps across to the next card", "paper"),
                (1.5, "other", "سهم حاد ينقل لكارت «إيد ماسكة حاجة»", "[hand holding object] engraved", "static", "the hand card slides away to the closing card", "paper"),
                (2.0, "cta", "كارت أخير بعنوان وشريط رسمة وسطر تاني", "[headline], engraved strip, [second line]", "static", "", ""),
            ]),
        },
    },
    "sk-glass": {
        "name": "زجاجي ثلاثي الأبعاد", "icon": "🧊", "uses": "بزنس، تسويق، نمو وأرقام", "transition": "fadewhite",
        "voice_tone": "premium, assured, slightly dramatic",
        "sample": "نادي رياضي كبر من ٥٠ مشترك لـ ٥٠٠٠ في سنتين: إزاي القرار الصح غيّر كل حاجة",
        "schema": {
            "title": "زجاجي ثلاثي الأبعاد", "summary": "رندر ثلاثي الأبعاد فخم: ألواح زجاج شفافة متكدسة، رقم ضخم بيطلع، وفلاش أبيض في النص.",
            "beat_sec": 0.0,
            "style": "Premium dark 3D render: stacked translucent frosted-glass panels with soft refraction, a huge counting number, "
                     "studio rim light, shallow depth; mid-video a white flash flips the scene from black to white.",
            "background": "Deep black studio void in the first half, clean white void after the flash.",
            "palette": "Black (#0A0A0A), white (#FFFFFF), greys (#7A7A7A); gold (#D4AF37) and neon green (#39FF14) appear only at the climax.",
            "spine": "The stack of glass panels stays at the center and transforms from beat to beat.",
            "camera": "Slow parallax and a slow orbit around the glass stack; one flash cut in the middle only.",
            "text_style": "Clean bold sans numbers and short labels floating on the glass.",
            "music": "إيقاع إلكتروني فخم بيتصاعد (غير محدد)", "negative": "No warm colors except the climax gold, no cartoon look, no real logos, no clutter.",
            "last_frame": "A burnt-out highlight dissolve: the glass stack glowing white with one gold edge, almost overexposed, still.",
            "beats": _beats([
                (1.8, "hook", "هوك: عناصر زجاج بتتكدس", "[glass panels] stacking in the black void", "slow orbit", "the top panel shows a number that starts counting", "glass stack"),
                (2.5, "proof", "عداد بيطلع بسرعة", "[big number] counting up on the glass", "slow push in", "a second progress element rises next to it", "glass stack"),
                (2.0, "feature", "عنصر «تقدّم» تاني", "[progress element] bars/graph in glass", "slow parallax", "a white flash", "glass stack"),
                (0.5, "other", "فلاش أبيض", "white flash fills the frame", "static", "the scene is now white", ""),
                (2.0, "feature", "عنصر قرار/لغز على الأبيض", "[decision element] a glass cube puzzle on white", "slow orbit", "one element starts to glow", "glass on white"),
                (2.0, "proof", "الذروة: عنصر بينوّر بلون واحد وسط الضل", "[hero element] glowing gold/green among grey shadows", "slow push in", "light burns out to white", "the hero element"),
                (1.7, "cta", "ذوبان أخير والإضاءة محروقة", "[closing line] over a bright burnt-out glow", "static", "", ""),
            ]),
        },
    },
    "sk-glitch": {
        "name": "الغليتش الأبيض", "icon": "⚡", "uses": "إعلانات أدوات وتطبيقات، خصوصًا أدوات الذكاء الاصطناعي", "transition": "pixelize",
        "voice_tone": "upbeat, modern tech presenter",
        "sample": "تطبيق تمارين بالذكاء الاصطناعي: بيعملك جدول، بيعدّ التكرارات، بيظبط الأكل، جربه النهارده",
        "schema": {
            "title": "الغليتش الأبيض", "summary": "أبيض ورمادي نضيف، عناصر ثلاثية الأبعاد ناعمة زي الصلصال، ولمسة غليتش أحمر-سماوي على الحواف.",
            "beat_sec": 0.0,
            "style": "Clean white and light-grey tech ad: soft matte clay-like 3D objects, gentle studio light, a subtle red-cyan chromatic glitch "
                     "on the edges of every element as the visual signature.",
            "background": "Seamless white-to-light-grey studio backdrop in every frame.",
            "palette": "White (#FFFFFF), light grey (#E6E6E6), black (#111111) plus the glitch accent: soft pink (#FF8FB1) and cyan (#4FD8E8) only.",
            "spine": "A single clay 3D object/icon floats at center and morphs from beat to beat.",
            "camera": "Locked-off; the objects rotate or float in place instead of the camera moving.",
            "text_style": "Bold modern sans headlines, lighter or italic secondary line, a rare italic serif for the special word.",
            "music": "بيت تكنو خفيف وسريع (غير محدد)", "negative": "No dark backgrounds, no saturated colors outside the glitch accent, no real logos, no realistic humans.",
            "last_frame": "A still CTA line in bold sans on white with a tiny chromatic glitch on its edges, nothing else.",
            "beats": _beats([
                (1.3, "hook", "هوك: شعار/عنصر فكرة عامة", "[concept object] clay 3D at center with edge glitch", "static", "the object morphs into the first use-case icon", "white backdrop"),
                (1.4, "feature", "استخدام ١: أيقونة وعنوانين", "[use 1 icon] + [headline] + [subline]", "static", "the icon morphs into the next one", "white backdrop"),
                (1.4, "feature", "استخدام ٢", "[use 2 icon] + [headline]", "static", "morph", "white backdrop"),
                (1.4, "feature", "استخدام ٣", "[use 3 icon] + [headline]", "static", "the icon flattens into a product screen", "white backdrop"),
                (2.0, "proof", "واجهة منتج تجريبية", "[product UI] floating clay phone/tablet showing a mock screen", "static", "the screen zooms to a supporting proof", "white backdrop"),
                (1.8, "proof", "«رهان أكبر» بدليل داعم", "[bigger claim] with a supporting number/visual", "static", "elements fade leaving a question", "white backdrop"),
                (1.5, "other", "سؤال بلاغي ختامي", "[rhetorical question] bold sans", "static", "the question resolves into the CTA line", "white backdrop"),
                (1.5, "cta", "سطر CTA أخير ثابت", "[CTA line]", "static", "", ""),
            ]),
        },
    },
}


# ---------------------------------------------------------------- 🎬 قوالب «مشاهد» (فيديوهات شرح زي Vox)
# كل مشهد ١٠ ثواني بالظبط، وصورة «مفتاح ستايل» واحدة بتتبعت مع كل مشهد، والفويس أوفر جملة لكل مشهد،
# وكل مشهد حركة كاميرا واحدة بتبدأ وتخلص بموشن بلر فالقطع بين المشاهد مايبانش. (الطريقة مستوحاة من skill «vox-animation»)

SCENES = {
    "sk-vox": {
        "name": "كولاج تحريري (Vox)", "icon": "📰", "uses": "فيديوهات شرح بالمعلومات: ليه وإزاي، أرقام، قصة موضوع", "transition": "cut",
        "voice_tone": "curious, precise, a little wry documentary narrator; explains, never hypes",
        "sample": "ليه الأكل اللي بيترمي مشكلة مواصلات أكتر ما هي مشكلة مطبخ",
        "allow_label": False,
        "tokens": "editorial mixed-media collage, archival photo cutouts with rough white paper borders, flat bold color fields, halftone dots and paper grain, "
                  "torn paper edges and tape strips, hand-drawn black marker circles and arrows, snappy motion-graphics animation, non-photorealistic, no live-action",
        "negative": "readable text, letters, words, numbers, captions, subtitles, watermark, logo, photorealism, live-action footage, 3D render, lip-sync, "
                    "talking characters, color drift",
        "key": "A style swatch for an editorial mixed-media collage explainer: {palette} paper background with halftone dot texture, archival photo cutouts "
               "with rough white paper borders, torn edges and tape strips, hand-drawn black marker circles and arrows, bold flat color blocks, subtle "
               "paper grain and soft drop shadows. Abstract composition only: no people with faces, no letters, no words, no numbers. Non-photorealistic, "
               "no live-action, no 3D render.",
        "variants": [("classic", "كلاسيك: أصفر دافي وكريمي وكحلي وكورال", "warm yellow and off-white, with navy and coral blocks"),
                     ("night", "ليلي: كحلي غامق ولمسات كورال وأصفر", "deep navy with coral and mustard accents"),
                     ("paper", "ورقي هادي: كريمي وأخضر مطفي وأحمر طوبي", "cream paper with muted sage and brick red accents")],
        "devices": "archival cutouts drifting or snapping in; one dominant flat color field per scene; paper and print textures; hand-drawn marker "
                   "annotations (circles drawing themselves, sweeping underlines, arrows) with no letters; abstract unlabeled data graphics (bars growing, "
                   "lines drawing upward); flat stylized maps with routes and pulsing dots; redaction/highlight bars and spotlight vignettes; scale comparisons "
                   "(one object multiplying into rows, stacks growing). Combine two or three per scene.",
        "motion": "snappy ease-out entrances with slight overshoot, slow push-in on 'listen to this' moments, whip-pans or page-flips between ideas, "
                  "parallax between collage layers; something always moves but only one thing is loud at a time",
    },
    "sk-diorama": {
        "name": "ديوراما ورقي وثائقي", "icon": "🗞️", "uses": "فيديوهات وثائقية درامية: فلوس، اقتصاد، سلطة، تحقيقات", "transition": "cut",
        "voice_tone": "serious, cinematic documentary narrator, measured and tense",
        "sample": "إزاي شركة واحدة بقت مسيطرة على سوق المكملات الغذائية في كام سنة",
        "allow_label": True,
        "tokens": "cinematic vintage paper diorama, aged sepia newsprint world, monochrome halftone print, monochrome archival cutout figures with black "
                  "censor bars over their eyes, single burnt-orange accent, distressed letterpress, warm tungsten light, macro tilt-shift shallow depth of "
                  "field, film grain, handcrafted stop-motion paper feel, non-photorealistic, no live-action",
        "negative": "gibberish letters, captions, subtitles, watermark, logo, photorealism, live-action footage, recognizable real faces, lip-sync, talking characters, color drift",
        "key": "A style swatch for a cinematic vintage paper-diorama documentary: a miniature three-dimensional landscape built from aged sepia newspaper "
               "and cardboard, torn edges, layered paper walls of old newsprint, monochrome archival cutouts of anonymous suited figures with black "
               "censor bars over their eyes, one dominant {palette} paper prop as the single color accent, distressed letterpress texture, warm tungsten "
               "light with deep shadows, macro tilt-shift shallow depth of field, film grain and dust. Physical paper craft only: no letters, no words, "
               "no numbers, no logos, no live-action people.",
        "variants": [("classic", "كلاسيك: سيبيا ولمسة برتقالي محروق", "burnt-orange"),
                     ("crimson", "أحمر: سيبيا ولمسة أحمر نبيذي", "deep crimson red"),
                     ("teal", "تركواز: سيبيا ولمسة تركواز باهت", "faded teal")],
        "devices": "paper canyons and newsprint landscapes, archival cutout figures with censor bars (mid-shot or full body, never close-up faces), "
                   "torn front pages, stamps punching onto documents, paper props as the single color accent, one short distressed letterpress label "
                   "(1-2 words or a number) on a torn colored paper element per scene",
        "motion": "ONE continuous high-energy FPV camera move with aggressive speed ramps; an impact every ~3 seconds (slam, stamp, shockwave, snap, rip); "
                  "the scene emerges from motion blur and ends fully motion-blurred mid-dive/whip/fall",
    },
}
