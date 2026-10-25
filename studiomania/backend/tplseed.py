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
        "sample": "تكريم مدرب رياضي بعد ١٠ سنوات: أول حصة، أول بطولة، ١٠٠٠ متدرب، وشكر في النهاية",
        "schema": {
            "title": "تكريم ورقي عتيق", "summary": "كولاج أرشيفي على ورق كريمي: صور مقصوصة مثل الملصقات، وخط يد ونجوم، وبطاقة شكر في النهاية.",
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
        "name": "الأرشيف الحركي", "icon": "🗞️", "uses": "سيرة حياة، قصة ملهمة، «فشل ثم نجاح»", "transition": "hblur",
        "voice_tone": "calm, reflective storyteller, low and steady",
        "sample": "قصة متدرب: بدأ بوزن زائد، وفشل مرتين، ثم قرر أن يكمل فنجح",
        "schema": {
            "title": "الأرشيف الحركي", "summary": "أبيض وأسود بالكامل: صور مقصوصة على ورق رسالة مكتوبة على آلة كاتبة، ونص كبير يتحرك.",
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
        "name": "تحريري محفور", "icon": "🖋️", "uses": "محتوى تعليمي أو تسويقي: نصائح، شرح فكرة، إعلان منتج", "transition": "wipeleft",
        "voice_tone": "confident, clear teacher, punchy",
        "sample": "توقف عن التمرين كل يوم بلا راحة، وابدأ بتنظيم أيام الراحة: العضلة تنمو وأنت مرتاح",
        "schema": {
            "title": "تحريري محفور", "summary": "أبيض وأسود على ورق خشن برسومات محفورة مثل الكتب القديمة، وشعار على شكل أحجية يتفكك ويتركب.",
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
        "name": "زجاجي ثلاثي الأبعاد", "icon": "🧊", "uses": "أعمال، تسويق، نمو وأرقام", "transition": "fadewhite",
        "voice_tone": "premium, assured, slightly dramatic",
        "sample": "نادٍ رياضي نما من ٥٠ مشتركًا إلى ٥٠٠٠ في سنتين: كيف غيّر القرار الصحيح كل شيء",
        "schema": {
            "title": "زجاجي ثلاثي الأبعاد", "summary": "رندر ثلاثي الأبعاد فاخر: ألواح زجاج شفافة متراصة، ورقم ضخم يظهر، وومضة بيضاء في المنتصف.",
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
        "sample": "تطبيق تمارين بالذكاء الاصطناعي: يصنع لك جدولًا، ويعدّ التكرارات، وينظّم أكلك، جرّبه اليوم",
        "schema": {
            "title": "الغليتش الأبيض", "summary": "أبيض ورمادي نظيف، وعناصر ثلاثية الأبعاد ناعمة مثل الصلصال، ولمسة تشويش أحمر وسماوي على الحواف.",
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
    # ---------------------------------------------------------------- 🎞️ من مراجع العميل (دفعتين، ١٠ فيديوهات): كل قالب = ستايل + إيقاع + أجزاء
    "sk-decoloop": {
        "name": "لوحة آرت ديكو بتكبير لا ينتهي", "icon": "🎭", "uses": "ملصق متحرك للعلامة، أجواء، إعلان مكان (مطعم، فندق، مسرح، معرض)", "transition": "cut",
        "voice_tone": "elegant, slow, almost whispered",
        "sample": "أجواء مقهى قديم في وسط المدينة: الزبونة تنظر عبر نظارتها فترى المقهى، والكاميرا تدخل ثم تعود إليها",
        "schema": {
            "title": "لوحة آرت ديكو بتكبير لا ينتهي", "summary": "رسم مسطح بألوان قليلة، والشخصية بالكاد تتحرك، والكاميرا تدخل في تفصيلة وتخرج منها إلى اللقطة الأولى نفسها (حلقة).",
            "beat_sec": 0.0, "loop": True,
            "style": "Flat vector art-deco poster illustration, mid-century travel-poster feel: crisp geometric shapes, no outlines, hard-edged two-tone shadows, "
                     "subtle paper grain, living-illustration animation (slow blinks, breathing, a curl of steam), never cartoon bouncy.",
            "background": "One saturated flat color field (deep red) with the building/place drawn in a lighter warm tone.",
            "palette": "Signal red (#D7000F), deep maroon (#5A0008), peach (#F5A878), cream (#F7F1E3) and near-black (#120606) only.",
            "spine": "The same character and the same place reflected in a detail (glasses, window, cup) - the camera travels between them.",
            "camera": "One continuous slow zoom: into a detail, through it into the place, back out to the character; never a cut.",
            "text_style": "No text in the illustration; at most one tiny art-deco wordmark at the end added in editing.",
            "music": "جاز هادي أو بيانو بطيء", "negative": "No outlines, no gradients, no 3D, no photorealism, no extra colors, no text or letters, no fast motion.",
            "last_frame": "Exactly the first frame again: the extreme close-up of the detail with the place reflected inside it.",
            "beats": _beats([
                (3.0, "hook", "لقطة قريبة جدًا لتفصيلة (عدسة نضارة/شباك) والمكان منعكس جواها", "[place] reflected inside a round lens filling the frame", "slow zoom out", "the camera pulls back revealing the character's face", "the reflection"),
                (5.0, "feature", "وش الشخصية بالكامل والمكان في عينيها، رمشة بطيئة", "[character] portrait centered, [place] mirrored in both lenses", "very slow push in", "the camera dives into one lens", "the character"),
                (4.0, "feature", "جوه العدسة: المكان كبير والكاميرا بتقرّب من شباك", "[place] facade, one lit window", "slow push in", "the window grows until the character is seen inside it", "the facade"),
                (5.0, "proof", "الشخصية واقفة في الشباك، صغيرة في المبنى", "[character] small in the window of [place]", "slow push in", "push into her glasses until the lens fills the frame", "the window"),
                (4.0, "cta", "رجوع لنفس اللقطة الأولى (لوب)", "[place] reflected inside a round lens filling the frame", "slow push in", "", "the reflection"),
            ]),
        },
    },
    "sk-morphpaint": {
        "name": "لوحات تحريرية تتحول", "icon": "🖌️", "uses": "فكرة نفسية أو اجتماعية، رسالة توعية، قصة مشاعر (بقليل من الكلام)", "transition": "cut",
        "voice_tone": "intimate, quiet, honest inner voice",
        "sample": "الضغط الذي تشعر به الفتيات من التعليقات على مظهرهن، وكيف يتعلمن حب أنفسهن",
        "schema": {
            "title": "لوحات تحريرية تتحول", "summary": "رسومات مجلة مرسومة باليد، وكل مشهد استعارة للفكرة، وكل مشهد يذوب في الذي يليه دون قطع، والأخير يعود إلى الأول.",
            "beat_sec": 0.0, "loop": True,
            "style": "Contemporary editorial illustration, gouache and colored pencil on paper, pale porcelain skin with rosy cheeks, muted flat backgrounds, "
                     "surreal visual metaphors (objects growing out of the head, clothes turning into bones, notes piling up), continuous morph between scenes.",
            "background": "Flat muted backdrops that shift between dusty blue, teal and pale grey; a bathroom-sink still life recurs.",
            "palette": "Dusty blue (#4F86C6), teal (#4E8E95), pale grey (#C9CDD0), vermilion red (#E8462B), black (#1B1B1B), off-white (#F4F1EA).",
            "spine": "The same young character (same face, same haircut logic) in every scene; one bold red word-object as the recurring symbol.",
            "camera": "Mostly frontal and still; transformations happen inside the frame (morph), slight drift only.",
            "text_style": "One single bold red word painted as an object inside the scene (in the client's language, added in editing if Arabic).",
            "music": "أمبينت هادي فيه حزن خفيف", "negative": "No photorealism, no 3D, no anime, no extra characters' faces close-up, no cuts, no gore.",
            "last_frame": "Exactly the first frame again: the character at the sink in front of the poster with the red word.",
            "beats": _beats([
                (3.5, "hook", "الشخصية قدام مراية/حوض والكلمة الحمرا ورا", "[character] at a sink, [red word] huge behind", "static", "her clothes morph into a bone-pattern top", "the character"),
                (3.5, "feature", "الهدوم بتتحول لهيكل عظمي مرسوم", "[character] wearing a bone-pattern top, seen from behind", "slow drift", "the hair grows into a starry hat while a reflection appears", "the character"),
                (4.0, "feature", "انعكاس في المراية بيبص عليها", "[character] leaning to a mirror, a different [reflection] looking back", "static", "papers and notes start sprouting from her head", "the mirror"),
                (4.0, "proof", "ورق وتعليقات بتطلع من دماغها وتغطيها", "[character] buried under floating notes", "static", "the notes blow away revealing her calm", "the notes"),
                (4.0, "feature", "إيديها على راسها والكلمة فوقها بعلامات زائد", "[character] hands on head, [red word] with plus signs above", "slow push in", "a hand gently lifts a mask off her face", "the character"),
                (4.0, "proof", "إيد بتشيل قناع أبيض من على وشها", "[character] a white mask being lifted off", "static", "she is back at the sink as in the beginning", "the mask"),
                (3.5, "cta", "رجوع للقطة الأولى (لوب)", "[character] at a sink, [red word] huge behind", "static", "", "the character"),
            ]),
        },
    },
    "sk-cutcollage": {
        "name": "كولاج صور مقصوصة على ورق", "icon": "✂️", "uses": "إعلان خدمة أو مدينة أو مشروع عقاري، كلمة واحدة كبيرة لكل مشهد", "transition": "slideup",
        "voice_tone": "upbeat, short punchy words",
        "sample": "شركة تصميم: «حركة» ← «تصميم» ← «علامة»، كل كلمة على عالم مقصوص مختلف",
        "schema": {
            "title": "كولاج صور مقصوصة على ورق", "summary": "صور حقيقية مقصوصة (يخت، أشجار، منارة) على ورق كرافت ملون بخدوش، والعناصر تنزل وتتركب، وكلمة كبيرة في المنتصف.",
            "beat_sec": 0.0,
            "style": "Photo-collage stop-motion: real photographic cut-outs (houses, trees, landmarks) with crisp edges on scratched craft-paper color fields, "
                     "a torn-paper street strip, objects drop in and settle with a little bounce, one circular window holding a moving real scene (waves, clouds).",
            "background": "Textured craft paper with scratches and folds - burnt orange in the first half, sky blue in the second.",
            "palette": "Burnt orange (#D9772E), sky blue (#8DB4D6), asphalt (#2B2F33), white (#FFFFFF), mustard (#E5C04B).",
            "spine": "The same scratched paper texture and the same street strip; each scene adds cut-outs on top of it.",
            "camera": "Locked-off; the background slides up like a paper sheet to change scene.",
            "text_style": "One huge bold condensed sans word per scene, white or mustard, sitting on the paper (added in editing).",
            "music": "بيت مرح خفيف بإيقاع واضح", "negative": "No 3D render, no illustration style, no gradients, no extra text, no people faces.",
            "last_frame": "A circular window with a real moving scene inside, a mustard word across it, on blue scratched paper.",
            "beats": _beats([
                (1.0, "hook", "شجر مقصوص بينزل على ورق برتقالي", "[cut-out trees] dropping on orange paper", "static", "a house cut-out drops between the trees", "the paper"),
                (2.0, "feature", "بيت بيتركب على شريط شارع والكلمة الأولى تحته", "[cut-out building] on a street strip, empty space below for [word 1]", "static", "the whole sheet slides up revealing blue paper", "the street strip"),
                (3.0, "cta", "دايرة فيها منظر حقيقي بيتحرك والكلمة التانية", "[landmark] inside a circular window with real waves and clouds, space for [word 2]", "very slow push in", "", "the circle"),
            ]),
        },
    },
    "sk-redcollage": {
        "name": "كولاج أبيض وأسود بدائرة حمراء", "icon": "🔴", "uses": "شرح منتج أو خدمة (تطبيق، SaaS، خدمة عملاء) بقصة صاحب عمل", "transition": "cut",
        "voice_tone": "clear, confident explainer, friendly",
        "sample": "صاحب ورشة كان يخسر الزبائن لعدم وجود تقييمات، وبالتطبيق صار يجمعها ويكسب الثقة",
        "schema": {
            "title": "كولاج أبيض وأسود بدائرة حمراء", "summary": "شخص حقيقي بالأبيض والأسود مقصوص مثل الملصق، ودائرة ملونة خلفه، وخربشة بالأحمر، وجوال وختم شمع؛ قطع كل ثانيتين على الإيقاع.",
            "beat_sec": 2.0,
            "style": "Mixed-media paper collage: black-and-white photographic cut-out people with a thin white sticker border, a big flat crimson circle behind them, "
                     "cream handmade paper with fibers, hand-drawn crimson marker arrows/circles/loops that draw themselves, tape strips, a wax seal, torn paper scraps.",
            "background": "Cream handmade paper with visible fibers and tiny crimson squiggles, soft shadows.",
            "palette": "Crimson (#8E1B2C), cream (#EFE6D6), black and white photo tones, warm grey (#8C8478).",
            "spine": "The same crimson circle and the same cut-out person return in most beats.",
            "camera": "Mostly locked-off with small push-ins; cuts land exactly every 2 seconds on the beat.",
            "text_style": "Short words added in editing; inside the images only abstract UI bars, no readable text.",
            "music": "بيت إلكتروني نضيف بإيقاع ثابت (قطع كل ثانيتين)", "negative": "No color photos, no 3D render, no readable text, no logos, no extra accent colors.",
            "last_frame": "The person standing in the crimson circle holding the result (certificate/paper), confetti of paper scraps falling.",
            "beats": _beats([
                (2.0, "hook", "دايرة حمرا فاضية والشخص بيطلع فيها", "[person] cut-out appearing in the crimson circle", "static", "cut to the problem object", "the circle"),
                (2.0, "feature", "الموبايل في الدايرة بيعرض الحل", "[phone] with simple UI bars inside the circle", "slow push in", "cut to the key symbol", "the circle"),
                (2.0, "feature", "الرمز الأساسي (ختم شمع) متعلّق ومتلزّق", "[symbol] wax seal taped on the circle", "static", "cut to the person reaching for it", "the circle"),
                (2.0, "proof", "الشخص بيمد إيده والشخبطة الحمرا بتترسم حواليه", "[person] reaching, crimson arrows and loops drawing around", "static", "cut to the full system", "the arrows"),
                (2.0, "proof", "المنظومة كلها: الشخص والموبايل وخريطة ورسومات", "[person] small beside a big [phone], charts and map scraps", "slow push in", "cut to the person holding a paper", "the phone"),
                (2.0, "feature", "إيد بتحط الختم على ورقة", "[hand] pressing [symbol] onto a document", "static", "cut to the stamp impact", "the document"),
                (2.0, "proof", "الختم بينزل وورق بيتطاير", "[stamp] impact on a document, paper bits flying", "static", "cut to the happy person", "the document"),
                (2.0, "cta", "الشخص ماسك النتيجة جوه الدايرة وورق بيمطر", "[person] holding [result] in the crimson circle, paper confetti", "static", "", "the circle"),
            ]),
        },
    },
    "sk-burst": {
        "name": "المنتج ينفجر إلى عالمه", "icon": "💥", "uses": "منتج له أكثر من لون أو استخدام (ساعة، حقيبة، سماعة، علبة): لكل نسخة عالمها", "transition": "cut",
        "voice_tone": "light, modern, few words",
        "sample": "ساعة ذكية بثلاثة أشكال: رياضة (برتقالي)، سفر (أزرق)، أناقة (وردي)",
        "schema": {
            "title": "المنتج ينفجر إلى عالمه", "summary": "رندر ثلاثي الأبعاد ناعم: المنتج يطفو ويدور، ويتفكك إلى سحابة أشياء من عالمه نفسه، ثم يتجمع من جديد بلون آخر.",
            "beat_sec": 0.0,
            "style": "Soft pastel 3D product render: the product floats and rotates in a dreamy blurred room, then explodes into a floating cloud of themed props "
                     "(matching its use) that hang in the air and collapse back into the next color version; glossy clay-like props, soft global illumination.",
            "background": "A softly blurred pastel interior (shelves, books, a sideboard) whose color matches the current version.",
            "palette": "Each version owns one pastel world: apricot/orange, periwinkle blue, blush pink; always with white and silver.",
            "spine": "The product stays at the center the whole time; only its color, theme and the props around it change.",
            "camera": "Slow orbit around the floating product, gentle push-in during each explosion.",
            "text_style": "Optional one short word per version added in editing.",
            "music": "بوب إلكتروني ناعم", "negative": "No people, no hands, no text, no logos, no harsh shadows, no dark scenes, no product shape changes.",
            "last_frame": "The last version of the product floating at the center surrounded by its props, slowly turning.",
            "beats": _beats([
                (3.0, "hook", "المنتج طاير ولافف في أوضة لونها مطابق للنسخة الأولى", "[product version 1] floating center", "slow orbit", "the product bursts into a cloud of themed props", "the product"),
                (3.0, "feature", "سحابة حاجات من عالم الاستخدام الأول", "[props of use 1] floating around the product", "slow push in", "the props collapse into the product in color 2", "the product"),
                (3.0, "feature", "النسخة التانية بلون عالمها", "[product version 2] floating center", "slow orbit", "the product bursts into props of use 2", "the product"),
                (3.0, "feature", "سحابة حاجات العالم التاني", "[props of use 2] floating", "slow push in", "the props collapse into color 3", "the product"),
                (3.0, "cta", "النسخة التالتة وعالمها حواليها", "[product version 3] with [props of use 3]", "slow orbit", "", "the product"),
            ]),
        },
    },
    "sk-pillpromo": {
        "name": "ترويج مستقل: «من يحتاج إلى هذه الحبة؟»", "icon": "💊", "uses": "مصمم أو محرر فيديو أو أي مستقل يعرّف بنفسه وأعماله ويختم بدعوة للمراسلة", "transition": "zoomin",
        "voice_tone": "friendly, direct, a little playful",
        "sample": "مصمم جرافيك يعرّف بنفسه ويعرض أعماله (مجلات، هويات، تغليف) ويقول «راسلني لتصميمك»",
        "schema": {
            "title": "ترويج مستقل: «من يحتاج إلى هذه الحبة؟»", "summary": "خطاف بحبة ثلاثية الأبعاد، وشخص مقصوص يلقي التحية، ومجلد يُفتح على أعماله، وكل نوع عمل بنموذج عرض، وجدار تحت الإضاءة، ودعوة للمراسلة.",
            "beat_sec": 0.0,
            "style": "Clean 3D motion-graphics promo on a light grey grid wall with diagonal window-light shadows: glossy 3D capsule pill, a real person photo cut-out, "
                     "a 3D blue folder opening with work samples, realistic mockups (magazine spreads, business cards, snack packaging with flying pieces), "
                     "a spotlight wall with pinned notes, a phone portfolio scroll, an Instagram-style DM button.",
            "background": "Light grey grid paper wall with soft diagonal window shadows; two scenes on deep blue.",
            "palette": "Light grey (#D9DADC), deep blue (#1E4E79), bright blue (#2F80ED), white, warm accents from the works.",
            "spine": "The blue-and-white capsule pill: opens the video and closes it.",
            "camera": "Snappy zooms and whip transitions between sections; mockups rotate slowly in 3D.",
            "text_style": "Bold rounded sans with one big highlighted word per line (added in editing).",
            "music": "بيت لطيف سريع", "negative": "No clutter, no extra people, no fake readable text, no real brand logos.",
            "last_frame": "The blue-white capsule pill alone on the grey grid wall, space below for the CTA word.",
            "beats": _beats([
                (2.0, "hook", "حباية ثري دي بتقع وحبيبات بتتطاير", "[3D capsule pill] falling with tiny beads on grey grid wall", "static", "zoom into deep blue with space for the question", "the pill"),
                (2.0, "other", "الشخص مقصوص بيلوّح «هاي»", "[person cut-out] waving on the grid wall, a star burst", "static", "slide to the person at work", "the grid wall"),
                (2.5, "feature", "الشخص من ضهره قدام الشاشة وليبلز الوظايف", "[person] at a desk with screens, space for role labels", "slow push in", "zoom out to a blue folder", "the grid wall"),
                (2.5, "feature", "فولدر أزرق بيتفتح وأعمال طالعة منه", "[3D blue folder] opening with [work samples] popping out on deep blue", "static", "whip to the first work mockup", "the folder"),
                (3.0, "proof", "موك أب الشغل الأول بيلف", "[work 1 mockup] rotating in 3D", "slow orbit", "whip blur to the next work", "the grid wall"),
                (3.0, "proof", "موك أب الشغل التاني وحاجات بتطير", "[work 2 mockup] with flying pieces", "slow push in", "cut to a spotlight wall", "the grid wall"),
                (3.0, "feature", "حيطة سبوت لايت عليها نوتس الخدمات", "[spotlight wall] with pinned notes of services", "static", "zoom into a phone portfolio", "the spotlight"),
                (3.0, "proof", "موبايل بيعمل سكرول في البورتفوليو", "[phone] scrolling a portfolio of [works]", "tilt", "the phone flies away revealing a DM button", "the phone"),
                (2.0, "cta", "زرار رسالة والحباية في الآخر", "[DM button] then [3D capsule pill] alone", "static", "", "the pill"),
            ]),
        },
    },
}


# ---------------------------------------------------------------- 🎬 قوالب «مشاهد» (فيديوهات شرح زي Vox)
# كل مشهد ١٠ ثواني بالظبط، وصورة «مفتاح ستايل» واحدة بتتبعت مع كل مشهد، والفويس أوفر جملة لكل مشهد،
# وكل مشهد حركة كاميرا واحدة بتبدأ وتخلص بموشن بلر فالقطع بين المشاهد مايبانش. (الطريقة مستوحاة من skill «vox-animation»)

SCENES = {
    "sk-vox": {
        "name": "كولاج تحريري (Vox)", "icon": "📰", "uses": "فيديوهات شرح بالمعلومات: لماذا وكيف، أرقام، قصة موضوع", "transition": "cut",
        "voice_tone": "curious, precise, a little wry documentary narrator; explains, never hypes",
        "sample": "لماذا الطعام المهدر مشكلة نقل أكثر منه مشكلة مطبخ",
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
        "name": "ديوراما ورقية وثائقية", "icon": "🗞️", "uses": "فيديوهات وثائقية درامية: المال، الاقتصاد، السلطة، التحقيقات", "transition": "cut",
        "voice_tone": "serious, cinematic documentary narrator, measured and tense",
        "sample": "كيف سيطرت شركة واحدة على سوق المكملات الغذائية في بضع سنوات",
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
        "name": "صلصال بالتحريك المتقطع", "icon": "🧱", "uses": "إعلانات وفيديوهات شرح لطيفة بتعليق صوتي: منتجات، روتين يومي، قصص قصيرة", "transition": "cut",
        "voice_tone": "warm, playful, friendly narrator with a light smile in the voice; simple and clear",
        "sample": "كيف يبدأ فنجان قهوة الصباح رحلته من حبة بن صغيرة حتى يصل إلى يدك",
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
        "name": "عالم ورقي بالتحريك المتقطع", "icon": "✂️", "uses": "إعلانات منتجات دافئة، فيديوهات شرح وقصص، ومشاهد تتجمع قطعة قطعة من الورق", "transition": "cut",
        "voice_tone": "warm storyteller narrator, gentle and curious, like reading a beautiful picture book",
        "sample": "حكاية نبتة صغيرة على نافذة بيت في مدينة مزدحمة",
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
        "name": "عالم صوف وخيط (فِلت)", "icon": "🧶", "uses": "إعلانات أطفال ومنتجات منزلية دافئة، قصص قصيرة لطيفة، ومحتوى موسمي", "transition": "cut",
        "voice_tone": "soft, cozy, gentle narrator, like a bedtime story",
        "sample": "بطانية صغيرة تدفئ بيتًا كاملًا في ليلة شتاء",
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
        "name": "أنيمي مرسوم باليد", "icon": "🌸", "uses": "إعلانات فيها حكاية ومشاعر، لحظات يومية جميلة، ومنتجات للشباب", "transition": "cut",
        "voice_tone": "gentle, nostalgic, emotional narrator",
        "sample": "فتاة تذاكر ليلًا وكوب الشاي رفيقها حتى النهاية",
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
        "name": "ألوان مائية متحركة", "icon": "🎨", "uses": "إعلانات هادئة وراقية، قصص علامات تجارية، مناسبات وتهانٍ", "transition": "dissolve",
        "voice_tone": "calm, poetic, warm narrator",
        "sample": "رحلة وردة من البذرة حتى تصبح في باقة عروس",
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
        "sample": "يوم في حياة سيارة توصيل صغيرة تجوب المدينة",
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
        "name": "فيلم أبيض وأسود (نوار)", "icon": "🕵️", "uses": "إعلانات غموض وتشويق، عطور وساعات، إعلان تشويقي لإطلاق منتج", "transition": "cut",
        "voice_tone": "low, slow, mysterious detective narrator",
        "sample": "تحقيق في اختفاء آخر قطعة من الكعكة في المحل",
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
        "name": "عالم ثلاثي الأبعاد بأشكال بسيطة (لو بولي)", "icon": "🔺", "uses": "شرح تطبيقات وخدمات، إعلانات ألعاب، وفيديوهات تقنية مبهجة", "transition": "cut",
        "voice_tone": "bright, friendly, energetic narrator",
        "sample": "جزيرة صغيرة تكبر وتتطور كلما استخدمت التطبيق أكثر",
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
    # ---------------------------------------------------------------- الدفعة الأخيرة: ستايلات مولّدة
    "sk-hd2d": {
        "name": 'عالم بكسل جوه ديوراما (HD-2D)', "icon": '🏮', "uses": 'إعلانات ألعاب وتطبيقات، حكايات مغامرة، محتوى جيمرز', "transition": 'cut',
        "voice_tone": 'epic but warm storyteller, like an RPG narrator',
        "sample": 'رحلة بطل صغير بيدوّر على أحسن قهوة في المدينة',
        "allow_label": False,
        "writer": 'إنت كاتب ومخرج فيديوهات قصيرة بستايل ألعاب الـ HD-2D: شخصيات بكسل صغيرة جوه عالم مجسّم منوّر زي لعبة مغامرات.\nشكل السكريبت: لقطة واسعة للعالم ← البطل وهدفه ← العقبة ← المنتج هو الأداة السحرية ← الانتصار ← جملة ختام.\n',
        "tokens": 'HD-2D look: flat hand-made pixel-art sprite characters standing inside a fully 3D miniature diorama with pixel-art textures, high three-quarter camera, strong tilt-shift focus band, warm point lights casting real shadows, volumetric fog, heavy bloom and vignette, floating dust particles',
        "negative": 'readable text, letters, words, numbers, captions, subtitles, watermark, logo, real brands, lip-sync, talking mouths, color drift, photoreal humans, smooth 3D characters, existing game characters or logos',
        "key": 'A style swatch image that locks the look of an HD-2D video. {style} Palette: {palette}. A small lantern-lit town square diorama with one pixel sprite hero, seen from a high three-quarter angle with tilt-shift blur. No letters, no words, no numbers, no logos.',
        "variants": [
            ('night', 'ليل وفوانيس', 'warm lantern amber and deep teal night',
             'Night town diorama - lanterns throwing warm pools of light, deep blue fog, glowing windows.'),
            ('day', 'نهار وغابة', 'sunlit greens and golden light',
             'Daytime forest village diorama - god rays through trees, soft fog, warm sunlight.'),
        ],
        "devices": 'pixel sprites as the only characters, lanterns, campfires, glowing windows, treasure chests, a framed dialogue box shape without text, the product as a glowing pixel item',
        "motion": 'ONE smooth camera move per scene through the diorama (slow dolly or crane) while sprites move in stepped pixel frames; fog, light flicker and dust drift continuously',
        "motion_rule": 'حركة كاميرا ناعمة واحدة جوه الديوراما، والشخصيات البكسل بتتحرك بخطوات متقطعة، والضباب والنور بيترعشوا.',
        "audio": '٣-٥ أصوات لعبة (خطوات بكسل، شنشنة نار، رنة كنز، هوا) من غير كلام.',
        "guard": 'HD-2D throughout - flat pixel sprites inside a lit 3D diorama, tilt-shift, bloom, fog. Animation must start at the first frame.',
    },
    "sk-popup": {
        "name": 'كتاب بوب أب', "icon": '📖', "uses": 'حكايات أطفال، إعلانات بتحكي قصة، مناسبات وهدايا', "transition": 'cut',
        "voice_tone": 'warm storybook narrator, gentle wonder',
        "sample": 'كتاب بيتفتح وتطلع منه حكاية أول محل للعيلة',
        "allow_label": False,
        "writer": 'إنت كاتب ومخرج فيديوهات قصيرة بستايل كتاب البوب أب: كتاب حقيقي على مكتب بيتفتح ومسرح ورق بيطلع منه، وشخصيات ورق مقصوصة بتمثّل.\nشكل السكريبت: الكتاب بيتفتح ← المشهد بيقوم ← الحكاية ← المنتج ← الصفحة الأخيرة ← جملة ختام.\n',
        "tokens": 'a real pop-up book on a wooden desk under warm lamp light, paper sets springing up from the pages with layered V-folds, flat cut-paper characters with white borders, macro lens shallow depth of field, real soft shadows, photoreal room around a paper world',
        "negative": 'readable text, letters, words, numbers, captions, subtitles, watermark, logo, real brands, lip-sync, talking mouths, color drift, existing game characters, cartoon render of the whole frame, CGI plastic look',
        "key": 'A style swatch image that locks the look of a pop-up book video. {style} Palette: {palette}. An open pop-up book on a desk with a paper town rising from the pages and one cut-paper character with a white border, macro lens. No letters, no words, no numbers, no logos.',
        "variants": [
            ('cozy', 'مكتب دافي', 'warm wood, cream paper and saturated paper colors',
             'Cozy lamp-lit desk with a pop-up book and colorful paper scenery.'),
            ('bright', 'نهار منوّر', 'bright daylight, white desk and pastel papers',
             'Bright daylight desk, pastel pop-up pieces, crisp soft shadows.'),
        ],
        "devices": 'pages turning, paper pieces rising back to front, pull-tabs moving parts, flat paper actors sliding in slots, the product as a pop-up paper piece',
        "motion": 'ONE action per scene: a page opening and the paper set springing up, a pull-tab moving a paper piece, the macro camera slowly pushing in',
        "motion_rule": 'حركة واحدة في المشهد: صفحة بتتفتح والمسرح الورق بيقوم، أو لسان ورق بيحرّك حتة، أو الكاميرا بتقرّب بالراحة.',
        "audio": '٣-٥ أصوات ورق حقيقية (صفحة بتتقلب، ورق بيقوم، تكة) من غير كلام.',
        "guard": 'Real pop-up book on a desk throughout - paper sets rising from the pages, cut-paper actors, macro lens. Animation must start at the first frame.',
    },
    "sk-scifitoon": {
        "name": 'كرتون فضاء مضحك', "icon": '🛸', "uses": 'إعلانات كوميدية، تطبيقات وتقنية، محتوى شبابي جريء', "transition": 'cut',
        "voice_tone": 'playful, funny narrator',
        "sample": 'رائد فضاء صغير وروبوته بيدوروا على إشارة نت في كوكب غريب',
        "allow_label": False,
        "writer": 'إنت كاتب ومخرج فيديوهات قصيرة بستايل كرتون الفضاء المضحك: خطوط تقيلة، كواكب ملونة، رائد فضاء صغير وروبوت صاحبه، وهزار خفيف.\nشكل السكريبت: موقف غريب في الفضاء ← مشكلة سخيفة ← محاولة فاشلة ← المنتج بيحل المشكلة ← رد فعل مضحك ← جملة ختام.\n',
        "tokens": 'original 2D space comedy cartoon look: bold uniform dark outlines that gently boil, flat colors with simple hard-edged shadows, round friendly characters (a small astronaut in a chunky suit and a little round helper robot), playful retro rockets and colorful cratered planets, starry backgrounds, one bold palette per planet',
        "negative": 'readable text, letters, words, numbers, captions, subtitles, watermark, logo, real brands, lip-sync, talking mouths, color drift, existing cartoon characters, anime, 3D render, photorealism',
        "key": 'A style swatch image that locks the look of a space comedy cartoon. {style} Palette: {palette}. A small colorful planet surface with a parked retro rocket, a chubby little astronaut and a round helper robot, thick outlines, flat colors, stars and a ringed planet in the sky. No letters, no words, no logos, no existing characters.',
        "variants": [
            ('candy', 'كوكب حلويات', 'candy pink, mint and sunny yellow',
             'Candy-colored planet - pink craters, mint sky, flat cartoon shadows.'),
            ('alien', 'كوكب غريب', 'magenta sky, lime plants and purple rocks',
             'Night planet - glowing plants, two moons, flat bold colors.'),
        ],
        "devices": 'reaction close-ups, rockets landing with puffs, beeping robot gadgets, comic pauses, the product as a space gadget that actually works',
        "motion": 'ONE action per scene with snappy cartoon timing: a rocket landing, a character reacting, the robot beeping; outlines boiling on twos',
        "motion_rule": 'حركة واحدة في المشهد بتوقيت كرتون سريع: صاروخ بينزل، رد فعل شخصية، أو الروبوت بيصفّر، والخطوط بتغلي.',
        "audio": '٣-٥ أصوات فضاء مرحة (صاروخ، بيب روبوت، فقاعة، بوينج) من غير كلام.',
        "guard": 'Original 2D space comedy cartoon look throughout - thick boiling outlines, flat colors, no 3D, no existing characters. Animation must start at the first frame.',
    },
    "sk-drone": {
        "name": 'إعلان عقارات بالدرون', "icon": '🏙️', "uses": 'إعلانات عقارات ومشروعات وكمباوندات، فنادق ومنتجعات، شركات مقاولات', "transition": 'cut',
        "voice_tone": 'confident, premium, calm voiceover',
        "sample": 'كمباوند جديد على البحر: من فوق للتفاصيل',
        "allow_label": False,
        "writer": 'إنت كاتب ومخرج إعلانات عقارات فخمة بتصوير درون: لقطات واسعة مبهرة، تفاصيل راقية، ونمط حياة.\nشكل السكريبت: لقطة من فوق بتبهر ← المكان والموقع ← التفاصيل (مية، خضرة، تصميم) ← نمط الحياة ← الغروب ← جملة ختام.\n',
        "tokens": 'premium real-estate commercial filmed by drone: sweeping aerial shots over modern architecture, turquoise pools, palm trees and sea, golden hour sunlight, crisp cinematic color grade, smooth gimbal motion, high-end lifestyle feel',
        "negative": 'readable text, letters, words, numbers, captions, subtitles, watermark, logo, real brands, lip-sync, talking mouths, color drift, close-up faces, real brand buildings, cartoon, illustration',
        "key": 'A style swatch image that locks the look of a drone real-estate commercial. {style} Palette: {palette}. An aerial golden-hour view of modern white villas with turquoise pools and palm trees by the sea. No letters, no words, no numbers, no logos.',
        "variants": [
            ('coast', 'ساحلي', 'turquoise sea, white villas and golden light',
             'Coastal resort aerials - turquoise water, white architecture, palms, golden hour.'),
            ('city', 'أبراج المدينة', 'glass blue towers and warm sunset',
             'City towers aerials - glass towers reflecting sunset, wide boulevards, premium feel.'),
        ],
        "devices": 'top-down reveals, orbit around a tower, pull-back reveal of the whole project, slow glide over pools, people only as small distant silhouettes',
        "motion": 'ONE smooth drone move per scene: a slow orbit, a rising reveal, a top-down glide or a pull-back, perfectly stable gimbal',
        "motion_rule": 'حركة درون ناعمة واحدة في المشهد: لفة بطيئة، أو طلعة بتكشف المكان، أو تزحلق من فوق، أو رجوع لورا يبيّن المشروع كله.',
        "audio": '٣-٥ أصوات راقية (هوا، أمواج، عصافير بعيدة) من غير كلام.',
        "guard": 'Premium drone real-estate commercial look throughout - aerial, golden hour, cinematic grade, stable gimbal. Animation must start at the first frame.',
    },
}


# ---------------------------------------------------------------- 🎯 قوالب «إعلانات» (شخصية ثابتة + صورة المنتج + سكريبت ← Seedance)
# kind: ugc = ١٥ ثانية بتوليدة واحدة والشخصية بتتكلم بصوتها · cinema = لقطات بتوقيتها + كارت أخير بخطوطنا + فويس أوفر اختياري

ADS = {
    "sk-ugc": {
        "name": "مراجعة بالجوال", "icon": "📱", "kind": "ugc", "hero": "person", "needs_product": True,
        "uses": "مراجعة منتج في ١٥ ثانية: شخص حقيقي يمسك الجوال ويتحدث عن المنتج (تيك توك وريلز)",
        "voice_tone": "casual, warm, real creator talking to a friend",
        "sample": "مراجعة سريعة لسيروم فيتامين سي من شخص جرّبه أسبوعين",
    },
    "sk-cinema-ad": {
        "name": "إعلان سينمائي باللقطات", "icon": "🎬", "kind": "cinema", "hero": "person", "needs_product": True,
        "uses": "إعلان تلفزيوني أو للتواصل الاجتماعي مصوَّر: لقطات بتوقيتها، والمنتج هو البطل، وبطاقة أخيرة باسم العلامة",
        "voice_tone": "calm, confident commercial voiceover, few words",
        "sample": "إعلان قهوة باردة: فتاة تركض صباحًا، تتعب فوق التل، تشرب ثم تكمل",
    },
    # skeleton = راوي + هيكل عظمي ثابت بيتصاعد (يوم ١ ← يوم ٣٦٥) · talking = شخصية أنيميشن بتتكلم بصوتها · song = أغنية والفيديو ماشي عليها
    "sk-skeleton": {
        "name": "ماذا يحدث لو…؟ (هيكل عظمي)", "icon": "💀", "kind": "skeleton", "hero": "plate", "needs_product": False,
        "uses": "إعلان متصاعد: هيكل عظمي كرتوني يعيش رحلة يوم ١ ← يوم ٣٠ ← يوم ٣٦٥ وراوٍ يحكي (فضول ثم انتصار أو كارثة)",
        "voice_tone": "calm, dramatic documentary narrator",
        "sample": "ماذا يحدث لو شربت ما يكفي من الماء كل يوم لمدة سنة؟",
    },
    "sk-talking": {
        "name": "المنتج يتكلم (أنيميشن)", "icon": "🗣️", "kind": "talking", "hero": "plate", "needs_product": True,
        "uses": "شخصية أنيميشن (المنتج نفسه أو مكوّن أو حيوان) تتحدث إلى الكاميرا: «أنا X، أفعل Y، فيحدث لك Z»",
        "voice_tone": "expressive animated character voice",
        "sample": "علبة كريم تعرّف بنفسها وتشرح لماذا تحمي بشرة الطفل",
    },
    "sk-song": {
        "name": "إعلان بأغنية (فيديو موسيقي)", "icon": "🎵", "kind": "song", "hero": "plate", "needs_product": False,
        "uses": "أغنية حقيقية تحكي نتيجة العميل، وفيديو أنيميشن على إيقاعها والبطل يغني في الخطاف واللازمة",
        "voice_tone": "sung",
        "sample": "أغنية خفيفة عن شاي يوقظك دون أن يرهقك",
    },
}


# ---------------------------------------------------------------- 📦 استوديو المنتج (صور ثابتة): من skills «studio-shot» و«product-visuals» و«ad-generator»
STILLS = {
    "sk-studio-shot": {"name": "صورة استوديو للمنتج", "icon": "📸", "kind": "studio",
                       "uses": "أي صورة للمنتج (حتى لو من الجوال) ← صورة استوديو نظيفة على خلفية بلون واحد", "sample": ""},
    "sk-product-scene": {"name": "المنتج داخل مشهد", "icon": "🏞️", "kind": "scene",
                         "uses": "ضع المنتج في أي مشهد يعجبك (صورة من بنترست أو إعلان رأيته): نسخ اللقطة أو بناؤها حول المنتج", "sample": ""},
    "sk-static-ads": {"name": "إعلانات ثابتة (٤٠ قالبًا)", "icon": "🖼️", "kind": "adgen",
                      "uses": "٤٠ شكلًا مجرّبًا لإعلانات الصور: عروض، آراء، مقارنات، قبل وبعد، ملاحظات، أوراق لاصقة… بألوان العلامة وكلامها", "sample": ""},
}
