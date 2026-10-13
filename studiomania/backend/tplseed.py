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
    # ---------------------------------------------------------------- من skill «claymation»: ٤ أشكال صلصال، كل شكل ليه بلوك ستايل ثابت
    # (variant رابع عنصر فيه = بلوك الستايل بتاع الشكل ده، وبيتحط في أول برومت مفتاح الستايل وكل مشهد)
    "sk-clay": {
        "name": "صلصال ستوب موشن", "icon": "🧱", "uses": "إعلانات وفيديوهات شرح لطيفة بفويس أوفر: منتجات، روتين يومي، قصص قصيرة", "transition": "cut",
        "voice_tone": "warm, playful, friendly narrator with a light smile in the voice; simple and clear",
        "sample": "إزاي فنجان قهوة الصبح بيبدأ رحلته من حبة بن صغيرة لحد إيدك",
        "allow_label": False,
        "writer": "إنت كاتب ومخرج إعلانات وفيديوهات قصيرة بستايل الصلصال (ستوب موشن): دافي وخفيف الدم وبسيط، كل مشهد فكرة واحدة واضحة بتتشاف.\n"
                  "شكل السكريبت: أول مشهد لقطة بتشد (موقف أو سؤال) من غير مقدمة ← المشكلة أو الفكرة ← المنتج/الحل بيظهر ← بيشتغل قدامنا ← "
                  "النتيجة ← جملة ختام قصيرة بترجع لأول مشهد.\n",
        "tokens": "photographed physical modeling clay, handmade stop-motion claymation, visible making-marks on every surface, soft matte plasticine "
                  "sheen with slight subsurface warmth, handmade geometry, real cast shadows, lit like a real miniature film set, camera inside the clay world",
        "negative": "readable text, letters, words, numbers, captions, subtitles, watermark, logo, smooth CGI render, glossy plastic, 3D game render, "
                    "photorealism, live-action footage, motion blur, lip-sync, talking characters, set edges, workbench, color drift",
        "key": "A style swatch image that locks the look of a claymation video. {style} Palette: {palette}. A small busy corner of the clay world with a few "
               "typical sculpted props (thumb-pressed plants, a coiled clay towel, a clay imitation of a glass bottle) and one clay character in the lane's "
               "design language, mid-shot. Everything in frame is real modeling clay, photographed, real cast shadows, the clay scene filling the entire "
               "frame. No letters, no words, no numbers, no logos, no real people.",
        "variants": [
            ("classic", "كلاسيك بريميوم: بلاستيسين مطفي وتفاصيل نضيفة", "rich harmonious sage, cream and terracotta",
             "Premium studio claymation scene - everything sculpted from matte plasticine with refined intentional craftsmanship: subtle tool marks, "
             "controlled texture, soft rounded geometry, slight subsurface warmth, macro lens feel with shallow depth of field, soft diffused studio "
             "lighting with a gentle rim glow, the scene filling the entire frame with the camera inside the miniature clay world. Characters: natural "
             "proportions, neatly sculpted hair showing fine comb grooves, bright friendly eyes with white sclera and colored clay irises, softly "
             "sculpted lips in a warm smile."),
            ("goofy", "كوميدي: عيون كبيرة مدوّرة وبصمات صوابع", "saturated teal and terracotta",
             "Goofy claymation scene - everything sculpted from plasticine with visible fingerprints and thumb smudges, wonky handmade geometry where "
             "nothing is perfectly straight, busy cluttered sets, the scene filling the entire frame with the camera inside the clay world. Characters: "
             "oversized heads, huge round googly cartoon eyes with white sclera, small dark pupils and thick sculpted lids, bold sculpted eyebrows, "
             "round blush-pink clay cheeks, wide open-mouthed grins, hand-sculpted clay hair neatly shaped with a few playful strands out of place."),
            ("simple", "بسيط وهادي: أشكال مدوّرة وعيون نقط", "soft pastel mint, butter yellow and coral",
             "Matte claymation scene - everything sculpted from matte modeling clay, clean rounded forms with soft even surfaces and subtle tool marks, "
             "gently exaggerated cartoon proportions, simple dot eyes, tidy compositions, refined handcrafted stop-motion feel, the scene filling the "
             "entire frame with the camera inside the clay world."),
            ("puppet", "عرايس سينمائي: خيوط وقماش وإضاءة دراما", "cinematic deep teal shadows with warm amber practical light",
             "Stop-motion clay puppet scene - clay characters detailed with tiny craft materials: thread-wrapped hair, fabric details, wire accents, "
             "button details, on a fully sculpted clay set, cinematic stop-motion film lighting with gentle shadows, the scene filling the entire frame "
             "with the camera inside the puppet world."),
        ],
        "devices": "everything sculpted from clay with the material named on each object (thumb-pressed leaves, coiled clay towels, a clay imitation of "
                   "a glass bottle / pouring water / a brass kettle); clay shot types: macro texture close-up, worm's-eye miniature at clay-ankle height, "
                   "tilt-shift tabletop, fingerprint insert, through a sculpted clay window or arch; one clay character per scene at most, mid-shot; "
                   "the product as a clay imitation of its real form; one simple action per scene",
        "motion": "ONE simple action or ONE camera move per scene (slow push-in, gentle orbit, pull-back reveal); stepped 12fps stop-motion cadence, "
                  "no motion blur; clay may squash, knead or morph as the natural way things change",
        "motion_rule": "حركة واحدة بسيطة بس في المشهد (إيماءة واحدة أو حركة كاميرا واحدة)، بإيقاع ستوب موشن متقطع ١٢ فريم ومن غير موشن بلر، "
                       "والحاجات بتتغير بإن الصلصال يتعجن أو يتشكل من جديد.",
        "audio": "٣-٥ أصوات حقيقية للصلصال والمكان (عجن صلصال، طقطقة خفيفة، حاجات بتتحط على ترابيزة...) من غير أي كلام.",
        "guard": "Handmade stop-motion claymation throughout - matte plasticine, visible fingerprints and tool marks, slightly stuttery 12fps stop-motion "
                 "cadence, no motion blur. Non CGI. Non cartoon. Animation must start at the first frame.",
    },
    # ---------------------------------------------------------------- من skill «paper-animation» + «motion-design» (المشهد بيتجمّع من الورق)
    "sk-papercut": {
        "name": "عالم ورق ستوب موشن", "icon": "✂️", "uses": "إعلانات منتجات دافية، فيديوهات شرح وقصص، ومشاهد بتتجمع حتة حتة من الورق", "transition": "cut",
        "voice_tone": "warm storyteller narrator, gentle and curious, like reading a beautiful picture book",
        "sample": "حكاية زرعة صغيرة على شباك بيت في مدينة زحمة",
        "allow_label": False,
        "writer": "إنت كاتب ومخرج فيديوهات قصيرة بستايل عالم الورق (ستوب موشن): حكاية دافية بتتحكي صورة بصورة، كل مشهد فكرة واحدة بتتشاف.\n"
                  "شكل السكريبت: أول مشهد صورة بتشد من غير مقدمة ← الحكاية أو المشكلة ← الحل/المنتج ← بيشتغل قدامنا ← النتيجة ← "
                  "جملة ختام بترجع لأول مشهد بمعنى جديد.\n",
        "tokens": "real physical handmade paper world photographed, visible paper grain and fibre texture, imperfect cut edges, real cast shadows "
                  "between the paper layers, stop-motion paper animation, the camera inside the paper world and the world extending past every edge of the frame",
        "negative": "readable text, letters, words, numbers, captions, subtitles, watermark, logo, smooth digital animation, smooth gradients, glossy 3D, "
                    "photorealism, live-action footage, motion blur, morphing, lip-sync, talking characters, visible table or room around the set, color drift",
        "key": "A style swatch image that locks the look of a paper stop-motion video. {style} Palette: {palette}, with clear contrast between "
               "adjacent paper layers. A small corner of the paper world with a few typical papercraft props and one papercraft figure, mid-shot. Real "
               "physical paper, photographed, real cast shadows. No letters, no words, no numbers, no logos, no real people.",
        "variants": [
            ("classic", "طبقات كارتون: عمق وظلال وتفاصيل كويلينج", "saturated greens stepping from lime to deep forest with a vivid orange sun",
             "Layered papercraft world - everything built from stacked cardstock with visible paper thickness, deep layered depth between foreground, "
             "midground and background paper planes, layered cast shadows, paper quilling details, the camera inside the scene and the paper world "
             "extending past every edge of the frame."),
            ("assembly", "بيتجمّع: كل حتة ورق مقطوع بتدخل وتركب مكانها", "muted tactile slightly desaturated colors",
             "Handcrafted torn-paper collage built entirely from layered cut-and-torn paper pieces: every shape is a separate flat paper cutout with "
             "rough torn edges, visible paper grain and fibre texture, and a hard drop shadow beneath it, small rough white negative-space slivers "
             "between the pieces, a mosaic of overlapping paper facets photographed under soft directional light."),
            ("flat", "ورق ملون مسطح: عرايس ورق بمفاصل (كوميدي)", "bold flat primary colors",
             "Flat construction-paper cutout scene - simple layered flat card shapes, snipped edges, visible paper grain, jointed paper puppet "
             "characters, soft drop shadows between the layers, bold flat colors, the scene filling the entire frame with the camera inside the paper world."),
            ("handmade", "يدوي: حواف مقطوعة وصمغ وورق متكرمش", "warm kraft brown, mustard and tomato red",
             "Handmade paper stop-motion scene - torn paper edges, visible glue seams, construction-paper grain, finger-crumpled textures, "
             "hand-placed imperfection, soft practical lighting with visible falloff, the scene filling the entire frame."),
            ("collage", "كولاج: قصاصات مجلات وطوابع وشريط لاصق", "rich saturated collage colors against newsprint neutrals",
             "Mixed-media paper collage world - the entire scene built from cutouts composed into one deep coherent scene: black-and-white "
             "photographic cutout faces on hand-drawn paper bodies, clothing collaged from colorful patterned paper, structures built from cardboard "
             "and newspaper fragments, vintage magazine clippings, washi tape strips and vintage stamps, hand-drawn ink details over the paper, "
             "the camera inside the scene."),
            ("origami", "أوريجامي: ورق متطبّق وألوان باستيل", "soft pastels - blush, sage and cream",
             "Origami world scene - everything folded from paper with clean geometric creases: delicate origami figures, crisp angular folds on every "
             "object, pleated paper details, soft pastel-colored papers, soft diffused lighting casting gentle shadows that reveal the dimensional "
             "paper folds, folded edges showing paper thickness, the scene filling the entire frame with the camera inside the paper world."),
        ],
        "devices": "every object named with its paper treatment (pleated paper towels, a bottle snipped from green card, shelves layered from magazine "
                   "clippings); say 'papercraft' (never 'paper cut') near faces and products; a stated camera position inside the world (eye level with "
                   "the paper figure, worm's-eye up at cardstock towers, overhead straight down on a paper street); figures mid-shot; one simple action",
        "motion": "ONE move per scene: slow parallax push-in through the layered paper planes (the strongest move), paper elements sliding or pivoting "
                  "at one corner, a jointed paper puppet raising one arm, pieces sliding in from outside the frame and settling with their shadows; "
                  "stop-motion cadence, 12 fps judder, slight frame-to-frame jitter, no motion blur",
        "motion_rule": "حركة واحدة بس في المشهد: دخول بالراحة بين طبقات الورق، أو حتة ورق بتتزحلق أو تلف من ركن، أو عروسة ورق بترفع إيدها، "
                       "أو حتت الورق بتدخل من برّه الكادر وتركب مكانها بظلها، بإيقاع ستوب موشن متقطع ١٢ فريم ومن غير موشن بلر.",
        # حركة زيادة لشكل معيّن (بتتضاف لبرومت كل مشهد لما الشكل ده هو المختار)
        "variant_motion": {"assembly": "The scene assembles itself far-to-near as flat pre-cut torn paper pieces pushed in from outside the frame: the back "
                                       "layer slides in from above and the sides, the ground rises in from below in layered strips, set pieces slide in, "
                                       "props settle, and figures assemble last part by part, each piece with a hard paper shadow sliding in beneath it; "
                                       "then all pieces settle and lock into place with tiny staggered adjustments."},
        "audio": "٣-٥ أصوات ورق حقيقية بس (ورق بيتزحلق، تكات، خشخشة، حتت بتقع) من غير أي كلام أو موسيقى.",
        "guard": "Motion should feel tactile, slightly imperfect and stop-motion realistic, with tiny misalignments, staggered timing, hard shadows, "
                 "overlapping paper layers and visible paper texture; stop-motion cadence, 12 fps judder, no motion blur. No folding, no morphing, "
                 "no in-place drawing, no smooth digital animation: every piece is a pre-made paper piece sliding, rotating or dropping into place. "
                 "Animation must start at the first frame.",
    },
    # ---------------------------------------------------------------- الدفعة التاسعة: ستايلات مولّدة جديدة (نفس شكل الصلصال والورق)
    "sk-felt": {
        "name": "عالم صوف وخيط (فِلت)", "icon": "🧶", "uses": "إعلانات أطفال ومنتجات بيت دافية، قصص قصيرة لطيفة، ومحتوى موسمي", "transition": "cut",
        "voice_tone": "soft, cozy, gentle narrator, like a bedtime story",
        "sample": "بطانية صغيرة بتدفّي بيت كامل في ليلة شتا",
        "allow_label": False,
        "writer": "إنت كاتب ومخرج فيديوهات قصيرة بستايل عرايس الصوف والفِلت (ستوب موشن): دافي وناعم وطفولي، كل مشهد فكرة واحدة بتتشاف.\n"
                  "شكل السكريبت: صورة دافية بتشد من أول ثانية ← المشكلة الصغيرة ← المنتج/الحل ← بيشتغل قدامنا ← الإحساس بعده ← جملة ختام حنينة.\n",
        "tokens": "handmade needle-felted wool and stitched felt stop-motion world photographed, fuzzy wool fibres catching the light, visible stitches, "
                  "yarn and button details, soft rounded felt shapes, warm cozy practical lighting with real soft shadows, miniature set filling the frame",
        "negative": "readable text, letters, words, numbers, captions, subtitles, watermark, logo, smooth CGI render, glossy plastic, photorealism, "
                    "live-action footage, motion blur, lip-sync, talking characters, visible table or room around the set, color drift",
        "key": "A style swatch image that locks the look of a needle-felt stop-motion video. {style} Palette: {palette}. A small cozy corner of the felt "
               "world with a few typical wool props (a knitted rug, felt mushrooms, a yarn-ball cat) and one felt character, mid-shot. Real wool and felt, "
               "photographed, fuzzy fibres, real soft shadows. No letters, no words, no numbers, no logos, no real people.",
        "variants": [
            ("cozy", "دافي: ألوان شتوية وإضاءة لمبة", "warm oatmeal, rust orange and forest green",
             "Cozy needle-felted miniature scene - everything made of fuzzy felted wool with visible fibres and stitched seams, knitted textures, "
             "button eyes, warm lamp light with soft falloff, the camera inside the miniature wool world."),
            ("pastel", "باستيل: ألوان أطفال فاتحة", "soft pastel pink, baby blue and butter yellow",
             "Pastel felt craft scene - clean soft felt shapes, gentle wool fuzz, embroidered details, bright soft daylight, tidy cute compositions, "
             "simple dot eyes, the scene filling the entire frame."),
        ],
        "devices": "every object named with its wool treatment (a felted wool cup, a knitted scarf, yarn-wrapped trees, embroidered stars); felt "
                   "characters mid-shot; macro fibre close-ups; the product as a felt imitation of its real form; one simple action per scene",
        "motion": "ONE simple action or ONE slow camera move per scene (push-in, small orbit); stepped 12fps stop-motion cadence, no motion blur; "
                  "wool may gently puff or settle",
        "motion_rule": "حركة واحدة بسيطة بس في المشهد (إيماءة أو حركة كاميرا بطيئة)، بإيقاع ستوب موشن متقطع ١٢ فريم ومن غير موشن بلر.",
        "audio": "٣-٥ أصوات ناعمة حقيقية (صوف بيتحك، زرار بيتقفل، خطوات خفيفة على سجادة) من غير أي كلام.",
        "guard": "Handmade needle-felt stop-motion throughout - fuzzy wool fibres, visible stitches, 12fps stop-motion cadence, no motion blur. "
                 "Non CGI. Animation must start at the first frame.",
    },
    "sk-anime": {
        "name": "أنيمي مرسوم باليد", "icon": "🌸", "uses": "إعلانات فيها حكاية وإحساس، لحظات يومية حلوة، ومنتجات للشباب", "transition": "cut",
        "voice_tone": "gentle, nostalgic, emotional narrator",
        "sample": "بنت بتذاكر بالليل وكوباية شاي هي اللي مكمّلة معاها",
        "allow_label": False,
        "writer": "إنت كاتب ومخرج فيديوهات قصيرة بستايل الأنيمي المرسوم باليد: لحظات يومية بسيطة فيها إحساس، سما ونور حلو، وتفاصيل صغيرة.\n"
                  "شكل السكريبت: لقطة جو بتشد ← الشخصية في موقف ← المنتج بيدخل في اللحظة ← الإحساس بيتغير ← لقطة واسعة حلوة ← جملة ختام.\n",
        "tokens": "hand-drawn 2D anime film look, painterly watercolor-gouache backgrounds, clean cel-shaded characters with soft line art, lush "
                  "cumulus skies, warm nostalgic light, gentle bloom, subtle film grain, slice-of-life atmosphere",
        "negative": "readable text, letters, words, numbers, captions, subtitles, watermark, logo, 3D render, photorealism, live-action footage, "
                    "chibi, exaggerated fan-service, lip-sync, talking mouths, color drift, existing anime characters",
        "key": "A style swatch image that locks the look of a hand-drawn anime video. {style} Palette: {palette}. A quiet everyday scene with one "
               "original anime character, mid-shot, a painted background full of small details and a big sky. No letters, no words, no numbers, "
               "no logos, no existing characters.",
        "variants": [
            ("summer", "صيفي: سما زرقا وسحاب كبير", "saturated sky blue, fresh green and sunlit cream",
             "Summer slice-of-life anime frame - towering cumulus clouds, bright sunlight with crisp cel shadows, painted greenery, warm breeze feeling."),
            ("dusk", "غروب: برتقالي وبنفسجي حنين", "golden orange, dusty violet and deep blue",
             "Dusk anime frame - golden hour into twilight, long soft shadows, glowing windows, sparkling dust in the light, nostalgic mood."),
            ("night", "ليل: نيون ومطر خفيف", "deep navy, neon pink and warm amber",
             "Night city anime frame - light rain, reflections on wet streets, glowing signs without readable text, warm interior light, calm mood."),
        ],
        "devices": "wide establishing shots with big skies, close-ups of small everyday objects (steam from a cup, curtains in the wind), "
                   "one original character per scene, light rays and floating particles; the product drawn in the same anime style",
        "motion": "ONE gentle move per scene: slow pan across a painted background, hair and clothes moving in the wind, steam or petals drifting, "
                  "limited animation on twos like a hand-drawn anime film",
        "motion_rule": "حركة واحدة هادية في المشهد (بان بطيء على الخلفية، شعر وهدوم بتتحرك مع الهوا، بخار أو ورد طاير)، زي أفلام الأنيمي المرسومة.",
        "audio": "٣-٥ أصوات جو حقيقية (هوا، عصافير، مطر خفيف، جرس دراجة) من غير أي كلام.",
        "guard": "Hand-drawn 2D anime look throughout - cel-shaded characters, painted backgrounds, animation on twos, no 3D, no photorealism. "
                 "Animation must start at the first frame.",
    },
    "sk-watercolor": {
        "name": "ألوان مية متحركة", "icon": "🎨", "uses": "إعلانات هادية وراقية، قصص براندات، مناسبات وتهاني", "transition": "dissolve",
        "voice_tone": "calm, poetic, warm narrator",
        "sample": "رحلة وردة من البذرة لحد ما تبقى في بوكيه عروسة",
        "allow_label": False,
        "writer": "إنت كاتب ومخرج فيديوهات قصيرة بستايل ألوان المية: شاعري وهادي، الألوان بتنزل على الورق وتكوّن المشهد.\n"
                  "شكل السكريبت: بقعة لون بتتفتح لمشهد ← الحكاية ← المنتج ← اللحظة الحلوة ← المشهد بيذوب في ورق أبيض ← جملة ختام.\n",
        "tokens": "animated traditional watercolor painting on cold-press paper, visible paper texture, soft wet-on-wet blooms and pigment granulation, "
                  "loose ink line accents, white paper showing through, gentle color bleeding at the edges",
        "negative": "readable text, letters, words, numbers, captions, subtitles, watermark, logo, 3D render, photorealism, live-action footage, "
                    "hard vector shapes, neon, lip-sync, color drift",
        "key": "A style swatch image that locks the look of an animated watercolor video. {style} Palette: {palette}. A small scene painted in "
               "loose watercolor with ink accents and white paper visible around it. No letters, no words, no numbers, no logos, no real people.",
        "variants": [
            ("botanical", "نباتي: أخضر وورد", "sage green, blush rose and soft ochre",
             "Botanical watercolor - flowers and leaves in loose washes, fine ink outlines, airy white paper margins."),
            ("travel", "سفر: مدن وبحر", "cerulean blue, terracotta and sand",
             "Travel sketchbook watercolor - quick ink sketch lines with washes of color, sunny streets and sea, sketchbook feel."),
        ],
        "devices": "scenes bloom from a drop of pigment spreading on wet paper, edges stay unpainted white paper, ink lines draw in first then color "
                   "floods in, transitions by colors bleeding into the next scene",
        "motion": "ONE move per scene: pigment blooming and spreading, a slow drift across the painting, petals or water gently moving; "
                  "painterly frame-to-frame boil, no hard motion",
        "motion_rule": "حركة واحدة في المشهد: لون بيتفتح وينتشر على الورق، أو حركة بطيئة على اللوحة، أو ورد/مية بيتحركوا بالراحة.",
        "audio": "٣-٥ أصوات هادية (فرشة على ورق، نقطة مية، هوا خفيف) من غير أي كلام.",
        "guard": "Traditional watercolor painting look throughout - visible paper texture, soft washes and granulation, no 3D, no photorealism. "
                 "Animation must start at the first frame.",
    },
    "sk-miniature": {
        "name": "عالم مصغّر (تيلت شيفت)", "icon": "🔍", "uses": "إعلانات خدمات ومدن وتوصيل، فعاليات، ومشاريع على أرض الواقع", "transition": "cut",
        "voice_tone": "upbeat, curious, playful narrator",
        "sample": "يوم في حياة عربية توصيل صغيرة ماشية في المدينة",
        "allow_label": False,
        "writer": "إنت كاتب ومخرج فيديوهات قصيرة بستايل العالم المصغّر (تيلت شيفت): الدنيا شكلها لعب صغيرة، مرح وسريع وواضح.\n"
                  "شكل السكريبت: لقطة من فوق للمدينة الصغيرة ← الحركة اليومية ← المنتج/الخدمة بتظهر ← بتشتغل ← النتيجة ← جملة ختام.\n",
        "tokens": "real-world tilt-shift photography that makes everything look like a tiny model, high vantage point, strong selective focus band with "
                  "blurred top and bottom, punchy saturated colors, bright sunlight, toy-like miniature feel, sped-up timelapse life",
        "negative": "readable text, letters, words, numbers, captions, subtitles, watermark, logo, real brands, close-up faces, cartoon, 3D render, "
                    "color drift",
        "key": "A style swatch image that locks the look of a tilt-shift miniature video. {style} Palette: {palette}. A high-angle view of a busy "
               "street corner with tiny cars and people, a narrow sharp focus band and blurred top and bottom. No letters, no words, no logos.",
        "variants": [
            ("city", "مدينة: شوارع وعربيات", "sunny saturated primaries",
             "Tilt-shift city - busy streets from above, tiny cars and people, crisp sunlight, toy-model look."),
            ("seaside", "شط: بحر وشماسي", "turquoise sea, white sand and coral umbrellas",
             "Tilt-shift beach - colorful umbrellas, tiny swimmers, turquoise water, toy-like summer scene."),
        ],
        "devices": "high angles looking down, a narrow focus band on the hero (a van, a stall, a crowd), timelapse traffic, tiny people as dots; "
                   "the product or service as one hero object in the focus band",
        "motion": "ONE move per scene: slow drift or push over the miniature world while traffic and people move in fast timelapse, stepped "
                  "slightly like a model animation",
        "motion_rule": "حركة واحدة في المشهد: الكاميرا بتعدّي بالراحة فوق العالم الصغير والعربيات والناس ماشيين بسرعة زي التايم لابس.",
        "audio": "٣-٥ أصوات مدينة صغيرة مرحة (زمامير بعيدة، زحمة خفيفة، عصافير) من غير أي كلام.",
        "guard": "Real tilt-shift miniature photography look throughout - strong selective focus, toy-like scale, saturated sunlight. "
                 "Animation must start at the first frame.",
    },
    "sk-noir": {
        "name": "فيلم أبيض وأسود (نوار)", "icon": "🕵️", "uses": "إعلانات غموض وتشويق، عطور وساعات، تيزر لإطلاق منتج", "transition": "cut",
        "voice_tone": "low, slow, mysterious detective narrator",
        "sample": "تحقيق في اختفاء آخر قطعة من الكيكة في المحل",
        "allow_label": False,
        "writer": "إنت كاتب ومخرج فيديوهات قصيرة بستايل أفلام النوار الأبيض والأسود: غموض وظلال وراوي بصوت واطي، وفي الآخر المفاجأة.\n"
                  "شكل السكريبت: لقطة غامضة ← سؤال/لغز ← خيوط ودلايل ← المنتج هو الحل ← لحظة كشف بالنور ← جملة ختام قوية.\n",
        "tokens": "classic black-and-white film noir cinematography, high contrast chiaroscuro lighting, venetian blind shadows, wet streets at night, "
                  "cigarette-free smoky haze, 1940s mood, deep blacks and silver highlights, 35mm film grain",
        "negative": "readable text, letters, words, numbers, captions, subtitles, watermark, logo, color, cartoon, 3D render, smoking, weapons, "
                    "real people likeness, color drift",
        "key": "A style swatch image that locks the look of a film noir video. {style} Palette: {palette}. A rainy night street corner with one "
               "mysterious figure in a trench coat and hat seen from behind, hard light through blinds. No letters, no words, no logos.",
        "variants": [
            ("classic", "كلاسيك: أبيض وأسود صافي", "pure black, white and silver greys",
             "Classic film noir - hard key light, deep shadows, venetian blind patterns, rain-slick streets."),
            ("accent", "لمسة لون: أبيض وأسود ولون واحد للمنتج", "black and white with one red accent on the product",
             "Film noir in black and white with a single saturated red accent reserved for the hero product."),
        ],
        "devices": "silhouettes in doorways, shadows of blinds across faces seen from a distance, close-ups of hands and clues, rain on glass, "
                   "a single hard light revealing the product as the answer",
        "motion": "ONE slow, deliberate move per scene: a slow dolly through shadows, a light switching on, rain falling, smoke drifting",
        "motion_rule": "حركة واحدة بطيئة ومقصودة في المشهد (دخول بطيء وسط الضلمة، نور بيولّع، مطر نازل، دخان بيتحرك).",
        "audio": "٣-٥ أصوات جو غامضة (مطر، خطوات على أرض مبلولة، عربية بعيدة، ساعة بتدق) من غير أي كلام.",
        "guard": "Black-and-white film noir look throughout - high contrast, hard shadows, film grain, no color except a permitted accent. "
                 "Animation must start at the first frame.",
    },
    "sk-lowpoly": {
        "name": "عالم 3D بأشكال بسيطة (لو بولي)", "icon": "🔺", "uses": "شرح تطبيقات وخدمات، إعلانات ألعاب، وفيديوهات تقنية مبهجة", "transition": "cut",
        "voice_tone": "bright, friendly, energetic narrator",
        "sample": "جزيرة صغيرة بتكبر وتتطور كل ما تستخدم التطبيق أكتر",
        "allow_label": False,
        "writer": "إنت كاتب ومخرج فيديوهات قصيرة بستايل الـ 3D البسيط بالأشكال المضلّعة (لو بولي): مبهج وواضح، كل حاجة شبه اللعبة.\n"
                  "شكل السكريبت: لقطة للعالم الصغير ← المشكلة ← المنتج/التطبيق يظهر ← العالم بيتغير ويكبر ← النتيجة ← جملة ختام.\n",
        "tokens": "stylized low-poly 3D world, flat-shaded faceted geometry, soft pastel gradients, clean ambient occlusion, floating diorama island, "
                  "soft global illumination, playful game-art look, simple geometric characters",
        "negative": "readable text, letters, words, numbers, captions, subtitles, watermark, logo, photorealism, live-action footage, hand-drawn, "
                    "noisy textures, existing game characters, color drift",
        "key": "A style swatch image that locks the look of a low-poly 3D video. {style} Palette: {palette}. A small floating island diorama with "
               "faceted trees, a little house and one simple geometric character. No letters, no words, no numbers, no logos.",
        "variants": [
            ("pastel", "باستيل: ألوان هادية", "mint, peach and lavender",
             "Pastel low-poly world - soft gradients, gentle light, cute faceted shapes."),
            ("vivid", "ألوان قوية: ألعاب", "vivid teal, sunny yellow and coral",
             "Vivid low-poly game world - saturated faceted shapes, bright sun, playful energy."),
        ],
        "devices": "floating diorama islands, faceted clouds, pieces building themselves up, simple geometric characters, the product as a "
                   "low-poly version of itself",
        "motion": "ONE move per scene: a slow orbit around the floating diorama, faceted pieces popping up and growing, gentle bobbing",
        "motion_rule": "حركة واحدة في المشهد: لفة بطيئة حوالين الجزيرة، أو حتت مضلّعة بتطلع وتكبر، أو حاجات بتتهز بالراحة.",
        "audio": "٣-٥ أصوات مرحة (بوب، فقاعة، رنة خفيفة، هوا) من غير أي كلام.",
        "guard": "Stylized low-poly 3D look throughout - flat-shaded facets, pastel gradients, no photorealism, no hand-drawn lines. "
                 "Animation must start at the first frame.",
    },
    # ---------------------------------------------------------------- الدفعة العاشرة: ستايلات مولّدة جديدة
    "sk-vhs": {
        "name": 'فيديو بيتي قديم (VHS)', "icon": '📼', "uses": 'إعلانات حنين للماضي، ذكريات العيلة، براندات عمرها سنين', "transition": 'cut',
        "voice_tone": 'warm nostalgic narrator, like remembering old family days',
        "sample": 'أول عيد ميلاد اتعمل فيه تورتة من المحل ده من ٢٠ سنة',
        "allow_label": False,
        "writer": 'إنت كاتب ومخرج فيديوهات قصيرة بستايل شرايط الفيديو البيتي القديمة (VHS): حنين ودفا ولحظات عيلة بسيطة.\nشكل السكريبت: لقطة ذكرى بتشد ← اللحظة العيلية ← المنتج كان موجود فيها ← اللحظة دي لسه بتتكرر النهارده ← جملة ختام.\n',
        "tokens": '1990s home video camcorder footage on VHS tape, soft low-resolution image, color bleeding, chroma noise, gentle tracking lines, warm faded colors, slightly overexposed indoor light, handheld amateur framing, nostalgic family atmosphere',
        "negative": 'readable text, letters, words, numbers, captions, subtitles, watermark, logo, real brands, lip-sync, talking mouths, color drift, modern crisp 4K look, timestamps, on-screen date text',
        "key": 'A style swatch image that locks the look of a 1990s VHS home video. {style} Palette: {palette}. A warm family living room moment around a birthday table, people seen from behind or at a distance, soft VHS blur. No letters, no numbers, no date stamp, no logos.',
        "variants": [
            ('warm', 'دافي: إضاءة بيت صفرا', 'faded warm yellows, browns and soft reds',
             'Warm 90s home video - tungsten indoor light, faded colors, soft blur, gentle tracking noise.'),
            ('summer', 'صيف: بحر وشمس', 'washed-out sky blue, sand and sunburnt orange',
             'Summer vacation camcorder footage - bright overexposed daylight, washed-out colors, beach and sun, wobbly framing.'),
        ],
        "devices": 'handheld zooms, people at a distance or from behind (never sharp close-up faces), birthday cakes, family tables, kids running, the product as it looked back then',
        "motion": 'ONE amateur camera move per scene: a shaky handheld pan or a slow wobbly zoom, occasional tape tracking wobble',
        "motion_rule": 'حركة واحدة بإيد مش ثابتة في المشهد (بان مهزوز أو زووم بطيء)، مع رعشة شريط خفيفة من وقت للتاني.',
        "audio": '٣-٥ أصوات بيت قديمة (ضحك بعيد، تصفيق، صوت شريط بيلف، شمع بيتطفي) من غير كلام واضح.',
        "guard": '1990s VHS camcorder look throughout - soft resolution, chroma bleed, tracking lines, faded warm colors, handheld. No modern crisp footage. Animation must start at the first frame.',
    },
    "sk-chalk": {
        "name": 'رسم بالطباشير', "icon": '🖍️', "uses": 'شرح دروس وخدمات، إعلانات مدارس وكورسات، أفكار بسيطة بتتشرح بالرسم', "transition": 'cut',
        "voice_tone": 'friendly teacher narrator, clear and encouraging',
        "sample": 'إزاي تذاكر أذكى مش أكتر في ٤ خطوات',
        "allow_label": False,
        "writer": 'إنت كاتب ومخرج فيديوهات قصيرة بستايل الرسم بالطباشير على سبورة: بسيط وواضح، كل مشهد رسمة واحدة بتشرح فكرة.\nشكل السكريبت: سؤال بيتكتب بالرسم ← المشكلة ← الفكرة ← الخطوات ← النتيجة ← جملة ختام.\n',
        "tokens": 'hand-drawn chalk illustrations animating on a dark green-black chalkboard, dusty chalk texture, smudges and eraser marks, colored chalk accents, drawings appearing stroke by stroke',
        "negative": 'readable text, letters, words, numbers, captions, subtitles, watermark, logo, real brands, lip-sync, talking mouths, color drift, photorealism, 3D render, clean vector, live-action',
        "key": 'A style swatch image that locks the look of a chalkboard drawing video. {style} Palette: {palette}. A few simple chalk doodles (a lightbulb, arrows, a little character, a book) on a dusty chalkboard with smudges. No letters, no words, no numbers, no logos.',
        "variants": [
            ('classic', 'سبورة خضرا وطباشير أبيض', 'chalk white on deep green-black with yellow and pink accents',
             'Classic school chalkboard - white chalk lines, a few colored accents, visible dust and eraser smudges.'),
            ('color', 'طباشير ملون', 'bright chalk pastels on charcoal black',
             'Colorful chalk art - bold pastel chalk drawings filled with rough strokes on a black board.'),
        ],
        "devices": 'drawings building stroke by stroke, arrows connecting ideas, a simple chalk character, eraser wipes as transitions, chalk dust puffs',
        "motion": 'ONE action per scene: a drawing appears stroke by stroke, or an eraser wipe reveals the next drawing, very slight camera drift',
        "motion_rule": 'حركة واحدة في المشهد: رسمة بتترسم خط خط، أو استيكة بتمسح وتكشف الرسمة اللي بعدها.',
        "audio": '٣-٥ أصوات حقيقية (طباشير بيكتب، استيكة، خبطة على السبورة) من غير كلام.',
        "guard": 'Chalkboard drawing look throughout - dusty chalk strokes on a dark board, drawings appear stroke by stroke, no photorealism. Animation must start at the first frame.',
    },
    "sk-sand": {
        "name": 'رسم بالرمل', "icon": '⏳', "uses": 'حكايات مؤثرة، تهاني ومناسبات، قصص براندات فيها تحول', "transition": 'dissolve',
        "voice_tone": 'soft, emotional, poetic narrator',
        "sample": 'حكاية بيت صغير بقى عيلة كبيرة',
        "allow_label": False,
        "writer": 'إنت كاتب ومخرج فيديوهات قصيرة بستايل الرسم بالرمل على ترابيزة منوّرة: صور بتتحول لبعضها بإيد بتمسح الرمل، حكاية مؤثرة.\nشكل السكريبت: صورة بتتكوّن من الرمل ← الحكاية ← اللحظة الصعبة ← التحول ← النهاية الحلوة ← جملة ختام.\n',
        "tokens": 'sand animation on a backlit light table, fine sand drawn by fingers, warm amber glow through the thin sand, dark silhouettes where the sand is thick, soft grainy edges, images morphing into each other',
        "negative": 'readable text, letters, words, numbers, captions, subtitles, watermark, logo, real brands, lip-sync, talking mouths, color drift, photorealism, 3D render, live-action faces, clean vector',
        "key": 'A style swatch image that locks the look of a sand animation. {style} Palette: {palette}. A simple scene drawn in sand on a glowing light table (a little house, a tree, a bird) with soft grainy edges. No letters, no words, no numbers, no logos.',
        "variants": [
            ('amber', 'عنبري دافي', 'warm amber light and deep brown sand',
             'Classic sand art - warm amber backlight, brown sand silhouettes, soft grainy edges.'),
            ('cool', 'أزرق هادي', 'cool blue backlight and charcoal sand',
             'Sand art on a cool blue backlit table - charcoal sand shapes, calm night mood.'),
        ],
        "devices": 'fingers sweeping sand to transform one image into the next, silhouettes of people at a distance, homes, trees, birds, waves; transitions by sand being swept',
        "motion": 'ONE transformation per scene: sand being swept and redrawn so one image morphs into the next, slow and fluid',
        "motion_rule": 'تحويلة واحدة في المشهد: الرمل بيتمسح ويترسم تاني فالصورة بتتحول للي بعدها بهدوء.',
        "audio": '٣-٥ أصوات هادية (رمل بيتمسح، حبات رمل بتقع، نَفَس هادي) من غير كلام.',
        "guard": 'Sand animation on a light table throughout - grainy sand silhouettes on a glowing surface, images morph by sweeping sand. Animation must start at the first frame.',
    },
    "sk-foodslow": {
        "name": 'أكل بالتصوير البطيء', "icon": '🍓', "uses": 'إعلانات أكل ومشروبات وحلويات، منيو المطاعم، منتجات طازة', "transition": 'cut',
        "voice_tone": 'short, appetizing, confident voice with few words',
        "sample": 'عصير فراولة طازة من الفاكهة للكوباية',
        "allow_label": False,
        "writer": 'إنت كاتب ومخرج إعلانات أكل قصيرة بالتصوير البطيء: كل لقطة بتفتح النفس، رشة أو قطرة أو بخار، والمنتج بطل.\nشكل السكريبت: لقطة شهية بتشد ← المكونات الطازة ← التحضير ← اللحظة الحلوة (رشة/صب) ← المنتج جاهز ← جملة ختام.\n',
        "tokens": 'high-end food commercial macro cinematography in extreme slow motion, splashes and droplets frozen in the air, glossy fresh ingredients, dramatic rim lighting on a dark or clean colored backdrop, shallow depth of field, rich saturated appetizing colors',
        "negative": "readable text, letters, words, numbers, captions, subtitles, watermark, logo, real brands, lip-sync, talking mouths, color drift, cartoon, illustration, people's faces, messy plates",
        "key": 'A style swatch image that locks the look of a slow-motion food commercial. {style} Palette: {palette}. Fresh ingredients and a splash frozen mid-air in macro, dramatic rim light. No letters, no words, no numbers, no logos.',
        "variants": [
            ('dark', 'خلفية غامقة وإضاءة درامية', 'deep black backdrop with vivid ingredient colors',
             'Dark moody food commercial - black backdrop, hard rim light, glistening droplets.'),
            ('fresh', 'خلفية فاتحة ومنعشة', 'clean pastel backdrop with bright fresh colors',
             'Bright fresh food commercial - clean pastel backdrop, soft light, crisp splashes.'),
        ],
        "devices": 'macro splashes, pours, droplets, steam, ingredients falling and colliding, slow rotating hero product, crumbs and sugar dust',
        "motion": 'ONE extreme slow-motion action per scene: a splash, a pour, ingredients falling, steam rising, the camera gliding slowly',
        "motion_rule": 'حركة واحدة بالتصوير البطيء جدًا في المشهد: رشة، صب، مكونات بتقع، بخار طالع، والكاميرا بتتزحلق بالراحة.',
        "audio": '٣-٥ أصوات أكل حقيقية (رشة مية، قرمشة، صب، فوران) من غير كلام.',
        "guard": 'High-end slow-motion food commercial look throughout - macro, frozen splashes, rim light, photoreal. Animation must start at the first frame.',
    },
    "sk-surreal": {
        "name": 'عالم سريالي', "icon": '🌀', "uses": 'إعلانات مختلفة بتلفت النظر، عطور وموضة، أفكار جريئة', "transition": 'cut',
        "voice_tone": 'calm, dreamy, slightly mysterious narrator',
        "sample": 'لو النوم كان مكان، كان هيبقى شكله إيه؟',
        "allow_label": False,
        "writer": 'إنت كاتب ومخرج فيديوهات قصيرة بستايل الأحلام السريالية: حاجات بتطير، مقاييس غريبة، وصور بتفضل في الدماغ.\nشكل السكريبت: صورة مستحيلة بتشد ← الإحساس ← المنتج جوه الحلم ← تحول غريب وحلو ← الصورة الأخيرة ← جملة ختام.\n',
        "tokens": 'surreal dreamlike photography, impossible scale and floating objects, soft pastel skies, smooth minimal landscapes, long soft shadows, clean composition, calm uncanny atmosphere, fine-art photography look',
        "negative": 'readable text, letters, words, numbers, captions, subtitles, watermark, logo, real brands, lip-sync, talking mouths, color drift, cartoon, horror, gore, cluttered scenes, existing artworks',
        "key": 'A style swatch image that locks the look of a surreal dream video. {style} Palette: {palette}. A minimal landscape with one giant everyday object and a few floating smaller objects under a soft sky. No letters, no words, no numbers, no logos.',
        "variants": [
            ('pastel', 'باستيل حالم', 'peach, lilac and sky blue',
             'Pastel surreal dreamscape - soft gradients, floating objects, smooth sand dunes.'),
            ('bold', 'ألوان قوية وظلال حادة', 'terracotta, cobalt and cream',
             'Bold surreal scene - strong sunlight, hard shadows, saturated minimal architecture.'),
        ],
        "devices": 'giant products in empty landscapes, stairs to nowhere, floating spheres and clouds, doors standing in the desert, water defying gravity; the product as the strange hero',
        "motion": 'ONE slow dreamlike move per scene: objects floating up, a slow dolly toward a giant object, water flowing upward, clouds drifting',
        "motion_rule": 'حركة واحدة بطيئة زي الحلم في المشهد: حاجات بتطير لفوق، الكاميرا بتقرّب من حاجة عملاقة، مية بتطلع لفوق، سحاب بيتحرك.',
        "audio": '٣-٥ أصوات حالمة (هوا، رنين خفيف، مية) من غير كلام.',
        "guard": 'Surreal dreamlike fine-art photography look throughout - impossible scale, floating objects, soft light, calm. Animation must start at the first frame.',
    },
    "sk-toy": {
        "name": 'عالم لعب بلاستيك', "icon": '🧸', "uses": 'إعلانات أطفال وألعاب، منتجات مرحة، محتوى خفيف للسوشيال', "transition": 'cut',
        "voice_tone": 'playful, bouncy, cheerful narrator',
        "sample": 'يوم في حياة عربية آيس كريم لعبة في مدينة صغيرة',
        "allow_label": False,
        "writer": 'إنت كاتب ومخرج فيديوهات قصيرة بستايل عالم اللعب البلاستيك: كل حاجة شكلها لعبة لامعة وملونة، مرح وسريع.\nشكل السكريبت: لقطة لعب بتشد ← المشكلة الصغيرة ← المنتج يدخل ← بيحل المشكلة ← فرحة ← جملة ختام.\n',
        "tokens": 'glossy plastic toy world photographed, vinyl collectible toy characters with simple faces, shiny injection-molded plastic, bright candy colors, soft studio light with gentle reflections, miniature toy set, macro shallow depth of field',
        "negative": 'readable text, letters, words, numbers, captions, subtitles, watermark, logo, real brands, lip-sync, talking mouths, color drift, existing toy brands or characters, interlocking brick toys, photoreal humans, horror',
        "key": 'A style swatch image that locks the look of a plastic toy world video. {style} Palette: {palette}. A small toy street with a vinyl toy character and toy cars, glossy plastic, macro. No letters, no words, no numbers, no logos, no existing toy brands.',
        "variants": [
            ('candy', 'ألوان حلويات', 'candy pink, mint and lemon',
             'Candy-colored plastic toy world - glossy pastels, soft reflections.'),
            ('primary', 'ألوان أساسية', 'primary red, blue and yellow',
             'Classic primary-colored toy world - bold glossy plastics, playful.'),
        ],
        "devices": 'toy characters moving in little hops, toy vehicles rolling, wind-up keys turning, the product as a glossy toy version of itself, macro close-ups of plastic shine',
        "motion": 'ONE playful move per scene: toys hopping in stop-motion steps, a toy car rolling, the camera pushing in at toy eye level',
        "motion_rule": 'حركة واحدة مرحة في المشهد: لعب بتتنطط بخطوات ستوب موشن، عربية لعبة بتمشي، أو الكاميرا بتقرّب على مستوى اللعب.',
        "audio": '٣-٥ أصوات لعب (زمبلك، تكات بلاستيك، بوينج) من غير كلام.',
        "guard": 'Glossy plastic toy world look throughout - vinyl toys, candy colors, macro, stop-motion hops. No existing brands. Animation must start at the first frame.',
    },
}


# ---------------------------------------------------------------- 🎯 قوالب «إعلانات» (شخصية ثابتة + صورة المنتج + سكريبت ← Seedance)
# kind: ugc = ١٥ ثانية بتوليدة واحدة والشخصية بتتكلم بصوتها · cinema = لقطات بتوقيتها + كارت أخير بخطوطنا + فويس أوفر اختياري

ADS = {
    "sk-ugc": {
        "name": "UGC ريفيو بالموبايل", "icon": "📱", "kind": "ugc", "hero": "person", "needs_product": True,
        "uses": "ريفيو منتج ١٥ ثانية: حد حقيقي ماسك الموبايل وبيتكلم عن المنتج (تيك توك وريلز)",
        "voice_tone": "casual, warm, real creator talking to a friend",
        "sample": "ريفيو سريع لسيروم فيتامين سي من حد جربه أسبوعين",
    },
    "sk-cinema-ad": {
        "name": "إعلان سينمائي باللقطات", "icon": "🎬", "kind": "cinema", "hero": "person", "needs_product": True,
        "uses": "إعلان تلفزيوني/سوشيال متصوّر: لقطات بتوقيتها، المنتج بطل، وكارت أخير باسم البراند",
        "voice_tone": "calm, confident commercial voiceover, few words",
        "sample": "إعلان قهوة باردة: واحدة بتجري الصبح، تتعب فوق التل، تشرب وتكمّل",
    },
    # skeleton = راوي + هيكل عظمي ثابت بيتصاعد (يوم ١ ← يوم ٣٦٥) · talking = شخصية أنيميشن بتتكلم بصوتها · song = أغنية والفيديو ماشي عليها
    "sk-skeleton": {
        "name": "إيه اللي يحصل لو…؟ (هيكل عظمي)", "icon": "💀", "kind": "skeleton", "hero": "plate", "needs_product": False,
        "uses": "إعلان بيتصاعد: هيكل عظمي كرتون بيعيش رحلة يوم ١ ← يوم ٣٠ ← يوم ٣٦٥ وراوي بيحكي (فضول وانتصار أو كارثة)",
        "voice_tone": "calm, dramatic documentary narrator",
        "sample": "إيه اللي يحصل لو شربت مية كفاية كل يوم لمدة سنة؟",
    },
    "sk-talking": {
        "name": "المنتج بيتكلم (أنيميشن)", "icon": "🗣️", "kind": "talking", "hero": "plate", "needs_product": True,
        "uses": "شخصية أنيميشن (المنتج نفسه أو مكوّن أو حيوان) بتكلم الكاميرا: «أنا X، بعمل Y، فـ Z بيحصلك»",
        "voice_tone": "expressive animated character voice",
        "sample": "علبة كريم بتعرّف نفسها وبتشرح ليه بتحمي بشرة البيبي",
    },
    "sk-song": {
        "name": "إعلان أغنية (ميوزك فيديو)", "icon": "🎵", "kind": "song", "hero": "plate", "needs_product": False,
        "uses": "أغنية حقيقية بتحكي نتيجة العميل، وفيديو أنيميشن ماشي عليها والبطل بيغني في الهوك والكورس",
        "voice_tone": "sung",
        "sample": "أغنية خفيفة عن إن الشاي ده بيصحّيك من غير ما يتعبك",
    },
}


# ---------------------------------------------------------------- 📦 استوديو المنتج (صور ثابتة): من skills «studio-shot» و«product-visuals» و«ad-generator»
STILLS = {
    "sk-studio-shot": {"name": "صورة استوديو للمنتج", "icon": "📸", "kind": "studio",
                       "uses": "أي صورة للمنتج (حتى لو من الموبايل) ← صورة استوديو نضيفة على خلفية بلون واحد", "sample": ""},
    "sk-product-scene": {"name": "المنتج جوه مشهد", "icon": "🏞️", "kind": "scene",
                         "uses": "حط المنتج في أي مشهد عاجبك (صورة من بنترست أو إعلان شفته): نسخ اللقطة أو بنائها حوالين المنتج", "sample": ""},
    "sk-static-ads": {"name": "إعلانات ثابتة (٤٠ قالب)", "icon": "🖼️", "kind": "adgen",
                      "uses": "٤٠ شكل إعلان صورة مجرّبين: عروض، آراء، مقارنات، قبل وبعد، نوتس، بوست-إت… بألوان وكلام البراند", "sample": ""},
}
