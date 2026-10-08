"""التايبوجرافي: الكلام المتقال بيتحوّل لموشن جرافيك (كلمات بتتكتب وتتبعتر وتتبدل بأيقونات...).

الرسم نفسه في frontend/typo-engine.js (نفس الملف بيعرض المعاينة وبيرسم الفيديو على السيرفر).
هنا: الستايلات، وبرومبت الموديل اللي بيقسم الكلام على حركات، واستخراج التايبوجرافي من فيديو في المعمل،
وشيل خلفية الأيقونات عشان تبقى ستيكرات شفافة.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

KINDS = {
    "pop": "كلمة كبيرة لوحدها على كارت ملون وبتتشطب في الآخر (للكلمة الأقوى، الهوك أو الافتتاحية)",
    "type": "سطر بيتكتب حرف حرف على قد الكلام ومعاه مؤشر وخربشة قلم (للجمل الهادية والأسئلة)",
    "build": "الجملة بتظهر كلمة كلمة وكلمة منها (focus) بتنوّر، وممكن صورة كبيرة جنبها (side)",
    "icon": "كلمة واحدة مهمة ومعاها أيقونة بتعبّر عنها (أسماء الحاجات، المفاهيم، القيم)",
    "letters": "كلمة قصيرة بحروف متباعدة وحرف منها بيتبدل بأيقونات ورا بعض (كلمة عاطفية أو الخلاصة)",
    "scatter": "حروف متبعترة بتتجمّع لحد ما تبقى الكلمة (لحظة فهم أو تحوّل، أو الختام)",
    "ring": "أيقونات كتير في دايرة بتلف (لما الكلام بيعدّ حاجات كتير أو «كل حاجة»)",
    "anchor": "الكلام بيتكتب كلمة كلمة جنب أو فوق أو على حاجة ظاهرة في الفيديو (مرساة) وبيتحرك معاها، "
              "وكلمة منه ممكن ما تتكتبش وتبقى الحاجة نفسها هي الكلمة (skip) ويترسم حواليها دايرة بالقلم",
}
# الحركات الاحترافية (frontend/typo-moments.js): متبنية من الفيديو المرجع لحظة بلحظة
PRO_KINDS = {
    "track": "كلام كبير جدًا قاعد على خطين متقطعين والكاميرا ماشية معاه كلمة كلمة، وصندوق بالقلم حوالين كلمة وشريط أسود بينسحب عن كلمة "
             "(لأول الجملة/الهوك، من 2 لـ 4 كلمات قصيرة)",
    "sign": "السطر الصغير (الجملة لحد دلوقتي) بين أقواس، وإمضا بالقلم بتتكتب تحته، وخطوط قلم، ودايرة بالقلم حوالين الكلمة المهمة (focus) "
            "(لكمالة الجملة، من 2 لـ 7 كلمات)",
    "spot": "الجملة كاملة في النص، ونجمة لمعة كبيرة من الجنب، والكادر بيضلم حوالين بقعة نور، و2-4 أيقونات بتطفو "
            "(لآخر الجملة/السؤال/الخلاصة، من كلمة لـ 4 كلمات، وبيستنى لحد ما الجملة الجاية تبدأ)",
}
KINDS.update(PRO_KINDS)
# عناصر ستوديو (frontend/typo-studio.js): متاخدة من الفيديوهات المرجعية، وبتقرا الشخص اللي في الفيديو
STUDIO_KINDS = {
    "behind": "كلمة أو كلمتين عملاقين ورا الشخص (الشخص قدام الكلام). للهوك والكلمة الأقوى، بس لما يكون فيه شخص في الفيديو",
    "arc": "الكلام متقوّس حوالين راس الشخص كلمة كلمة، والكلمة المهمة (focus) حمرا وأكبر (من 2 لـ 5 كلمات، لما يكون فيه شخص)",
    "artype": "سطر بيتكتب حرف حرف بمؤشر برتقاني، ونقطة برتقاني وخط متعرج على الكلمة المهمة (focus). ممتاز للعربي وللرسايل والأسئلة",
    "redword": "كلمة واحدة بس في النص حمرا ومنوّرة، بتتبدل مع كل كلمة بتتقال (للجمل المؤثرة واللحظات الجد، من 1 لـ 6 كلمات)",
    "signature": "إمضا بتتكتب بقلم رفيع بخط الإيد ومعاها خطوط قلم (لاسم، براند، توقيع، أو كلمة الختام). sign = الكلمة أو الكلمتين اللي يتكتبوا",
    "poster": "بوستر أحمر مالي الشاشة بكلام أسود مضغوط عملاق (للصدمة والعنوان والجملة اللي لازم تتشاف، من كلمة لـ 5 كلمات، بيغطي الفيديو)",
    "stack": "كومة كلام مايلة: كلام أبيض صغير وكلمات حمرا كبيرة مايلة، في الناحية الفاضية جنب الشخص (لشرح جملة فيها كلمتين مهمين، من 3 لـ 7 كلمات). "
             "focus = الكلمة الأهم، وممكن anchor وplace زي type",
    "push": "كلمة واحدة في الكادر، والكلمة الجاية بتزقها وتاخد مكانها (لتعداد سريع أو جملة بإيقاع سريع، من 3 لـ 6 كلمات)",
    "crt": "شاشة قديمة: كلام أبيض منوّر ضبابي بحواف أحمر وأزرق وجلتش على كل كلمة (للغموض والتحذير والكلام التقني أو المخيف، من 2 لـ 8 كلمات)",
    "ransom": "حروف مقصوصة من مجلات، كل حرف بلون وخط (لكلمة مفاجئة أو سر أو حاجة مجنونة، من كلمة لـ 3 كلمات)",
    "halo": "دايرة متقطعة بتلف حوالين راس الشخص، والكلام بخط إيد حواليها (لما بيتكلم عن نفسه أو عن فكرة في دماغه، من 2 لـ 6 كلمات، لما يكون فيه شخص)",
    "floor": "كلام نايم على الأرض بمنظور ومنوّر (لجملة هادية أو بداية فصل جديد، من 2 لـ 6 كلمات)",
    "hand": "خط إيد بيرتعش زي فيلم قديم بحواف خضرا وبنفسجي (للإحساس والذكريات والكلام الشخصي، من 2 لـ 8 كلمات)",
    "tags": "كلمات على مربعات حمرا تحت بعض في الناحية الفاضية جنب الشخص (لتعداد مميزات أو أسماء أو كلمات مفتاحية، من 2 لـ 5 كلمات). ممكن anchor وplace",
    "space": "الكلام متوزع في فراغ 3D والكاميرا ماشية جواه كلمة كلمة (للخيال والمستقبل والأفكار الكتير، من 3 لـ 7 كلمات)",
    "route": "خريطة نقط ومسار بيترسم وطيارة من مكان لمكان (للسفر والانتقال من حالة لحالة). أول كلمة = المكان الأول وآخر كلمة = التاني، "
             "أو اكتب text بالشكل «القاهرة → دبي»",
    "board": "لوحة تحقيق: ورق متدبّس وخيوط حمرا منوّرة بتوصل بينهم (لما بيربط أفكار أو يحلل أو يكشف سر، من 3 لـ 9 كلمات)",
    "cube": "مكعب سلكي بيلف حوالين راس الشخص والكلام تحته (لما بيشاور على حاجة واحدة مختارة: «ده بالظبط»، من كلمة لـ 4 كلمات)",
    "comments": "لوحة زجاج فيها كومنتات ناس بتطلع ورا بعض (لما بيتكلم عن ردود الناس أو الأسئلة اللي بتجيله، من 3 لـ 9 كلمات)",
    "lock": "كبسولة فيها قفل بيتقفل على الكلمة المهمة (focus) والباقي تحتها (للحاجة الثابتة أو المضمونة أو الممنوعة، من كلمة لـ 4 كلمات)",
    "thermal": "الشخص بألوان كاميرا حرارية والكلام بطباشير فوق راسه (للإحساس القوي: غضب، توتر، طاقة، من 2 لـ 6 كلمات، لما يكون فيه شخص)",
    "shapes": "أشكال مرسومة بتترعش زي فيلم 16مم (دايرة وخطوط) والكلام في النص (للهدوء والتأمل والفلسفة، من 2 لـ 5 كلمات)",
    "select": "الكلام جوه مربع تحديد زي برامج التصميم والماوس بيمسك الركن ويكبّره (للتصميم والتعديل والتكبير، من كلمة لـ 4 كلمات)",
    "chat": "فقاعات شات ورا بعض وقبل كل واحدة نقط الكتابة (لما بيحكي محادثة أو رسايل، من 3 لـ 9 كلمات)",
    "counter": "رقم بيعدّ من الصفر لحد قيمته بمؤشر منوّر (بس لما يكون فيه رقم في الكلام: فلوس، نسبة، عدد)",
}
STUDIO_KINDS.update({
    "fill": "كلمة أو كلمتين عملاقين والصورة من الفيديو جواهم (للكلمة اللي هي موضوع الفيديو، من كلمة لـ 3 كلمات)",
    "polaroid": "صورة بولارويد من الفيديو والكلام بخط إيد تحتها (للذكرى واللحظة والقصة، من 2 لـ 6 كلمات)",
    "cards": "كروت ملونة طايرة في 3D كل كارت عليه جزء من الكلام (للعروض والخدمات والاختيارات، من 3 لـ 9 كلمات)",
    "burst": "انفجار كوميكس برتقاني والكلمة بيضا بحدود سودا في النص (للحماس والصدمة والضحك، من كلمة لـ 2)",
    "dots": "الشخص بيتحول لنقط منوّرة والكلام جنبه (للتكنولوجيا والذكاء الاصطناعي والتحول، من 2 لـ 6 كلمات، لما يكون فيه شخص)",
    "neon": "كلمة أو كلمتين نيون أحمر منوّر ورا الشخص (للعنوان أو اسم المنتج، لما يكون فيه شخص)",
})
STUDIO_KINDS.update({
    "outline": "كلمة أو كلمتين كبار بيض بحدود بينك وعمق، حروفهم بتنط واحدة واحدة، وتاج بينك مايل بيتكتب فيه الكلمة المهمة (focus) (للهوك والطاقة والكلام البوب، من كلمة لـ 4)",
    "spin": "أول حرفين من الكلمة عملاقين بيلفوا مالين الكادر بينك وأسود، وبعدين الكلمة كاملة (لكلمة واحدة قوية، فعل أو نداء)",
    "sweep": "كلمة عملاقة بتعدّي بسرعة بموشن بلير وبعدين بتصغر في النص ونسخ منها بتلف حواليها (للتحذير والتنبيه، كلمة أو كلمتين)",
    "extrude": "كلام بينك بعمق 3D بيتكتب حرف حرف على شبكة، وآخر كلمة في مربع أسود (لجملة قصيرة فيها كلمة خطيرة في الآخر، من 2 لـ 5 كلمات)",
    "stories": "كروت ستوري بتلف في 3D والكلام على الكارت اللي في النص (للسوشيال والقصص اليومية، من 2 لـ 5 كلمات)",
    "post": "كارت بوست بيدخل بنطة والكلام طالع منه بحدود بينك (لما بيتكلم عن بوست أو صورة أو ترند، من 2 لـ 4 كلمات)",
    "retro": "بوستر قديم: ورق بيج ونجمة حمرا ورا الشخص (سيلويت أسود) وكلام كريمي مضغوط عملاق وراه، وباقي الكلام في لافتات سودا (لافتتاحية قوية، من 2 لـ 6 كلمات)",
    "duotone": "الفيديو أزرق بنقط والشخص سيلويت، كلام كريمي عملاق وراه كلمة تحت كلمة، وآخر الكلام أحمر بيتكتب تحت (لجملة درامية، من 3 لـ 6 كلمات)",
    "label": "كلمة حمرا كبيرة مضغوطة (focus) وتاج أزرق بيتكتب فوقها بباقي الكلام (من 2 لـ 5 كلمات)",
    "mirror": "كلمة مضغوطة وانعكاسها تحتها (للتأمل ومراجعة النفس، كلمة أو كلمتين)",
    "banners": "شرايط مايلة بتتحرك عكس بعض فيها الكلمة متكررة (لكلمة بتتكرر أو شعار، كلمة أو كلمتين)",
    "tiles": "كروت صور مدوّرة من الفيديو وكارت أحمر في النص فيه الكلمة المهمة (focus) متكررة، أو الكلام كله (من 1 لـ 3 كلمات)",
    "bubble": "فقاعة كلام حمرا فيها الكلمة المهمة (focus)، وكلمة كبيرة كريمي وكلمة صغيرة سودا (للمقارنة والردود، من 2 لـ 4 كلمات)",
    "band": "شريط أزرق مايل ورا كلمة كريمي عملاقة، وكلمة صغيرة سودا بتعدّي عليها (لأمر أو نصيحة: «إنقذ نفسك»، كلمتين أو 3)",
})
STILL_KINDS = {"fill", "polaroid", "cards", "stories", "post", "tiles"}
# عناصر ستوديو اللي ممكن تتحط جنب حاجة في الفيديو (anchor)
ANCHOR_STUDIO = {"stack", "tags", "ransom", "comments"}
KINDS.update(STUDIO_KINDS)
INTROS = {"track": ("", "flash", "card"), "spot": ("", "burst")}
OUTROS = {"track": ("", "pixel", "wipe"), "spot": ("", "red", "white")}
# لغة الستايل: الاختيارات اللي بتخلّي كل لقطة مختلفة وهي من نفس العيلة
VARIANTS = {"tone": ("", "paper", "dark", "yellow", "red"), "layout": ("", "line", "stack"), "frame": ("", "brackets", "box", "none"),
            "sigpos": ("", "below", "behind", "none"), "flank": ("", "left", "right"), "color": ("", "blue", "red", "yellow"),
            "arrange": ("", "scatter", "row"), "flare": ("", "star", "none")}
MARKS = {"box": "صندوق بالقلم (تركيز)", "circle": "دايرة حمرا بالقلم (أهم كلمة)", "underline": "خط تحتها (تأكيد)",
         "strike": "شطب (نفي، حاجة غلط، «مش»)", "arrow": "سهم بالإيد جاي عليها (بص هنا)", "highlight": "لون ورا الكلمة (رقم أو اسم)",
         "redact": "شريط أسود بيغطيها وبينسحب (مفاجأة، كشف)"}
PRO_GRAMMAR = (
    "لغة الستايل ده (ركّب منها لقطات جديدة، ما تكررش نفس التوليفة مرتين ورا بعض):\n"
    "- tone: paper (ورق فاتح، الأساس) | dark (غامق: للجد والحزن والسر) | yellow (كارت أصفر: طاقة وحماس) | red (كارت أحمر: تحذير، صدمة)\n"
    "- track: layout = line (سطر والكاميرا ماشية) | stack (كلمة تحت كلمة والكاميرا طالعة: للتعداد والخطوات)؛ "
    "intro = flash (أول الفيديو بس) | card (كارت ملون بالكلمة الأولى) | فاضي؛ outro = pixel (بيتكسّر بكسلات) | wipe (شريط أسود بيمسح) | فاضي\n"
    "- sign: frame = brackets | box | none؛ sigpos = below (الإمضا تحت) | behind (إمضا حمرا كبيرة ورا الكلام) | none؛ sign = الكلمتين اللي يتكتبوا إمضا\n"
    "- spot: flank = left | right (ناحية النجمة)؛ color = blue | red | yellow؛ arrange = scatter (أيقونات حوالين) | row (صف أيقونات تحت الكلام: للتعداد)؛ "
    "flare = star | none؛ tone dark = النجمة على أسود من غير بقعة نور؛ intro = burst | فاضي؛ outro = red | white | فاضي\n"
    "- marks: علامات قلم على كلمات جوه البلوك [{\"type\": ..., \"word\": رقم الكلمة جوه البلوك من 0}] (من 0 لـ 3 في البلوك):\n"
    + "".join(f"  - {k}: {v}\n" for k, v in MARKS.items())
    + "- خلّي العلامة على معنى الكلمة: النفي strike، الكلمة الأهم circle، المفاجأة redact، الأرقام highlight، الإشارة arrow.\n"
    "- غيّر بين tone وlayout وcolor وside على طول الفيديو، والمفاجآت (card أحمر/أصفر، dark) في اللحظات القوية بس.\n"
)
PLACES = ("auto", "left", "right", "above", "below", "on")
THEMES = ("light", "dark", "accent")

# الستايل اللي اتطلّع من فيديو المرجع (أبيض رمادي / أسود / أحمر، وكارت أصفر للكلمة الكبيرة)
BUILTIN_STYLES = {
    "studio": {
        "name": "🎬 ستوديو (عناصر الفيديوهات المرجعية)", "font": "SM Tajawal", "case": "none", "grain": 0.06, "weight": 700, "studio": True,
        "light": {"bg": "#F4EFE9", "ink": "#121A2E", "accent": "#E5261F"},
        "dark": {"bg": "#0E0E10", "ink": "#F4F4F2", "accent": "#E5261F"},
        "accent": {"bg": "#E5261F", "ink": "#FFFFFF", "accent": "#121A2E"},
        "rules": ["لو فيه شخص في الفيديو: أول كلمة أو كلمتين في الهوك behind، والجمل اللي بتتقال وهو بيتكلم arc حوالين راسه",
                  "الكلام العربي والأسئلة والرسايل artype", "الجمل المؤثرة والجد redword",
                  "الأسماء والبراند والختام signature", "غيّر بين العناصر ومتكررش نفس العنصر أكتر من مرتين ورا بعض",
                  "التعداد tags أو push، والصدمة والعنوان poster، والغموض والتحذير crt، والمفاجأة ransom",
                  "الكلام الشخصي والذكريات hand، والكلام عن نفسه أو فكرة في دماغه halo، وبداية فصل جديد floor",
                  "الجمل اللي فيها كلمتين مهمين stack جنب الشخص",
                  "الأرقام counter، والمحادثات chat، وردود الناس comments، والسفر route، والربط والتحليل board",
                  "موضوع الفيديو fill، والذكرى polaroid، والعروض والاختيارات cards، والحماس burst، والتكنولوجيا dots، والعنوان ورا الشخص neon",
                  "ستايل البوب البينك: outline للهوك، spin لكلمة قوية، sweep للتحذير، extrude لجملة آخرها خطير، stories وpost للسوشيال",
                  "ستايل البوستر القديم: retro للافتتاحية، duotone للدراما، label وband للأوامر والنصايح، mirror للتأمل، banners لشعار، tiles وbubble للردود",
                  "متخلطش الستايلين في نفس الجملة: الجملة كلها من عيلة واحدة",
                  "الحاجة المختارة cube، والمضمون أو الممنوع lock، والإحساس القوي thermal، والتأمل shapes، والتصميم select، والخيال space",
                  "build وtype للجمل العادية الطويلة"],
        "kinds": {"behind": 2, "arc": 2, "artype": 2, "redword": 2, "signature": 1, "stack": 2, "tags": 1, "push": 1, "poster": 1,
                  "crt": 1, "ransom": 1, "halo": 1, "floor": 1, "hand": 1, "build": 1,
                  "space": 1, "route": 1, "board": 1, "cube": 1, "comments": 1, "lock": 1, "thermal": 1, "shapes": 1, "select": 1, "chat": 1, "counter": 1,
                  "fill": 1, "polaroid": 1, "cards": 1, "burst": 1, "dots": 1, "neon": 1,
                  "outline": 1, "spin": 1, "sweep": 1, "extrude": 1, "stories": 1, "post": 1,
                  "retro": 1, "duotone": 1, "label": 1, "mirror": 1, "banners": 1, "tiles": 1, "bubble": 1, "band": 1},
    },
    "pro": {
        "name": "⭐ احترافي (زي الفيديو المرجع)", "font": "SM Tajawal", "case": "lower", "grain": 0.12, "weight": 700, "pro": True,
        "light": {"bg": "#ECEBE8", "ink": "#191716", "accent": "#E0261F"},
        "dark": {"bg": "#0C0808", "ink": "#F4F4F2", "accent": "#E0261F"},
        "accent": {"bg": "#E0AB1C", "ink": "#3B2408", "accent": "#191716"},
        "rules": ["الإيقاع: كل جملة غالبًا track لأولها، وsign لكمالتها، وspot لآخرها لو سؤال أو خلاصة؛ بس اكسر القاعدة لما المعنى يستاهل",
                  "أول الفيديو track intro=flash",
                  "track قبل sign دايمًا outro=pixel", "spot قبل تغيير كبير (جملة جديدة بإحساس تاني) outro=red",
                  "focus في sign وspot = الكلمة اللي عليها الضغط", "sign = كلمة أو كلمتين بتتكتب إمضا (أهم كلمتين في الجزء ده)"],
        "kinds": {"track": 3, "sign": 3, "spot": 2},
    },
    "mono-red": {
        "name": "أبيض وأسود وأحمر (المرجع)", "font": "SM Tajawal", "case": "lower", "grain": 0.12, "weight": 700,
        "light": {"bg": "#ECEBE8", "ink": "#141414", "accent": "#E5322D"},
        "dark": {"bg": "#0E0E0F", "ink": "#F4F4F2", "accent": "#E5322D"},
        "accent": {"bg": "#E9B21C", "ink": "#2A1A08", "accent": "#141414"},
        "rules": ["افتتاحية بكلمة كبيرة (pop) على الكارت الأصفر", "الأسئلة والجمل الطويلة type على خلفية فاتحة",
                  "الكلام الشخصي build على خلفية غامقة وجنبه صورة", "كل قيمة أو اسم حاجة = icon",
                  "الكلمة العاطفية في الآخر letters أو scatter"],
        "kinds": {"pop": 1, "type": 2, "build": 3, "icon": 3, "letters": 1, "scatter": 1, "ring": 1},
    },
    "kochi": {
        "name": "كوتشي (تيل وكريمي)", "font": "SM Changa", "case": "none", "grain": 0.08, "weight": 700,
        "light": {"bg": "#EEECDA", "ink": "#1E2A2A", "accent": "#E4572E"},
        "dark": {"bg": "#14201F", "ink": "#EEECDA", "accent": "#57B8AF"},
        "accent": {"bg": "#57B8AF", "ink": "#0E1A19", "accent": "#E4572E"},
        "rules": ["الهوك pop على التيل", "المعلومة build وكلمة الرقم focus", "الأكل والتمارين icon"],
        "kinds": {"pop": 1, "type": 1, "build": 3, "icon": 3, "letters": 1, "scatter": 1, "ring": 1},
    },
}

PLAN_FORMAT = """{
  "blocks": [{"from": 0, "to": 3, "kind": "pop | type | build | icon | letters | scatter | ring | behind | arc | artype | redword | signature | poster | stack | push | crt | ransom | halo | floor | hand | tags | space | route | board | cube | comments | lock | thermal | shapes | select | chat | counter | fill | polaroid | cards | burst | dots | neon | outline | spin | sweep | extrude | stories | post | retro | duotone | label | mirror | banners | tiles | bubble | band", "theme": "light | dark | accent",
              "text": "الكلام اللي يتكتب (من كلام الجمل دي بالظبط، ممكن تختصره لكلمة أو كلمتين في pop/icon/letters/scatter)",
              "focus": 0, "icon": "اسم ستيكر من المكتبة أو وصف قصير بالإنجليزي لأيقونة جديدة", "icons": ["..."], "letter": 1,
              "side": "اسم ستيكر/صورة كبيرة جنب الكلام في build أو فاضي",
              "anchor": "رقم مرساة من الفيديو (a1...) أو فاضي", "place": "auto | left | right | above | below | on", "skip": -1,
              "intro": "flash (track) | burst (spot) | فاضي", "outro": "pixel (track) | red (spot) | فاضي",
              "sign": "كلمة أو كلمتين تتكتب إمضا (sign)", "marks": [{"type": "circle", "word": 0}],
              "tone": "paper", "layout": "line", "frame": "brackets", "sigpos": "below", "flank": "left", "color": "blue", "arrange": "scatter", "flare": "star"}]
}"""


def words_text(words: list[dict]) -> str:
    return " ".join(f"[{i}]{w['w']}({w['s']:.2f})" for i, w in enumerate(words))


def anchors_text(anchors: list[dict]) -> str:
    out = []
    for a in anchors:
        k = a["keys"][len(a["keys"]) // 2]["box"]
        out.append(f"- {a['id']}: {a['label']} ({a['kind']}) من {a['t0']:.1f} لـ {a['t1']:.1f} ث، مكانها في الكادر تقريبًا "
                   f"x {k[0]:.2f}-{k[2]:.2f} / y {k[1]:.2f}-{k[3]:.2f}" + (f" — {a['note']}" if a.get("note") else ""))
    return "\n".join(out)


def plan_messages(words: list[dict], style: dict, stickers: list[str], brief: str, anchors: list[dict] | None = None,
                  person: dict | None = None) -> list[dict]:
    """الموديل بيقسم الكلام (كل كلمة برقمها ووقتها) على بلوكات، ولكل بلوك حركة وأيقونات.
    لو فيه فيديو متحلّل: بيشوف المراسي (الحاجات اللي في الكادر وأماكنها) وبيدمج الكلام معاها."""
    pro = bool(style.get("pro"))
    pool = PRO_KINDS if pro else {k: v for k, v in KINDS.items() if k not in PRO_KINDS}
    if style.get("studio"):
        pool = {k: v for k, v in KINDS.items() if k in STUDIO_KINDS or k in ("build", "type", "pop")}
    if not (person or {}).get("present"):   # من غير شخص: الحركات اللي محتاجاه مالهاش لازمة
        pool = {k: v for k, v in pool.items() if k not in ("behind", "arc", "halo", "thermal", "dots", "neon")}
    kinds = "\n".join(f"- {k}: {v}" for k, v in pool.items())
    rules = "\n".join(f"- {r}" for r in style.get("rules") or [])
    weights = ", ".join(f"{k}×{v}" for k, v in (style.get("kinds") or {}).items())
    text = (
        "أنت مصمم موشن تايبوجرافي محترف (زي فيديوهات الكلام المتحرك اللي الكلام فيها بيتحول لكلمات وأشكال وأيقونات). "
        "قدامك كلام متقال، كل كلمة برقمها ووقت ما اتقالت. قسّمه على بلوكات ورا بعض، كل بلوك = لقطة على الشاشة بحركة من دول:\n"
        f"{kinds}\n\n"
        + (f"قواعد الستايل ده:\n{rules}\n" if rules else "")
        + (f"الحركات بتتكرر تقريبًا بالنسب دي: {weights}\n" if weights else "")
        + (f"عن الفيديو: {brief}\n" if brief else "")
        + (f"الستيكرات اللي في المكتبة (استخدم الاسم بالظبط لو مناسب): {', '.join(stickers[:120])}\n" if stickers else
           "مفيش ستيكرات في المكتبة: اكتب وصف قصير بالإنجليزي لكل أيقونة محتاجها وهتترسم.\n")
        + ("\nالكلام ده هيتركب فوق فيديو متصوّر. دي الحاجات اللي ظاهرة فيه (المراسي) وإمتى وفين:\n" + anchors_text(anchors) + "\n"
           "اندمج مع الفيديو: استخدم anchor كتير لما يكون فيه حاجة مناسبة ظاهرة وقت الكلام ده (الوقت لازم يكون جوه وقت المرساة):\n"
           "- لو الكلام بيشاور على حاجة ظاهرة (me/this/here/ده/دي/هنا/الصورة/الورقة/المنتج/اسمها...): kind=anchor على المرساة دي، "
           "وskip = رقم الكلمة دي جوه البلوك (من 0) عشان ما تتكتبش والحاجة نفسها تبقى مكانها. مثال: «this is me» وفيه صورة ← "
           "this is جنب الصورة، وme ما تتكتبش.\n"
           "- place: left/right/above/below = جنبها في المساحة الفاضية، on = مكتوب عليها (ورقة، شاشة، حيطة سادة)، auto = البرنامج يختار.\n"
           "- type/build/icon ممكن كمان تاخد anchor وplace عشان تتحط جنب الحاجة بدل نص الشاشة. pop/ring/letters/scatter ملو الشاشة من غير anchor.\n"
           "- ما تكتبش أبدًا فوق وش حد (المراسي اللي نوعها face): حط الكلام جنبه.\n"
           "- الخلفية هي الفيديو نفسه، فـ theme هنا بيحدد لون الكلام بس (dark = كلام فاتح).\n" if anchors else "")
        + (f"\nفيه شخص ظاهر في الفيديو ({int(person.get('share', 1) * 100)}% من الوقت)، راسه حوالين x={person.get('head_x')} y={person.get('head_y')} "
           "من الكادر: استخدم behind للكلمات القوية القصيرة (بتتكتب عملاقة وراه)، وarc للكلام اللي بيقوله وهو بيتكلم.\n" if (person or {}).get("present") else "")
        + "\nالكلام:\n" + words_text(words) + "\n\n"
        "القواعد:\n"
        "- from/to = أرقام الكلمات (من كام لكام، شامل). البلوكات ورا بعض وبتغطي كل الكلمات من غير ما تسيب ولا كلمة.\n"
        "- كل بلوك من كلمة لحد 9 كلمات، والإيقاع يتغير: لقطات سريعة لكلمة واحدة، وجمل أطول بالراحة.\n"
        "- غيّر theme عشان الفيديو يقلب بين فاتح وغامق (مش كل بلوك نفس الخلفية)، وaccent قليل (للحظات القوية بس).\n"
        "- icon/letters/ring/side محتاجين صور: اختار من المكتبة بالاسم الأول، ولو مفيش مناسب اكتب اسم قصير بالإنجليزي لأيقونة جديدة (2-3 كلمات، من غير كلمة icon). "
        "ring محتاج 5-6 icons.\n"
        "- الأيقونات الجديدة بتترسم بفلوس: الفيديو كله ميزيدش عن 8 أيقونات جديدة مختلفة، وكرر نفس الاسم بالظبط لو نفس الحاجة اتكررت.\n"
        + ("- ده ستايل احترافي: استخدم track وsign وspot بس. spot أيقوناته 2-4 (icons).\n" + PRO_GRAMMAR if pro else "")
        + "- letters: text كلمة واحدة قصيرة، وletter = رقم الحرف اللي هيتبدل (من 0).\n"
        "- focus = رقم الكلمة جوه البلوك اللي تنوّر (من 0) أو -1.\n"
        "- text في pop/icon/letters/scatter كلمة أو كلمتين بس من الكلام نفسه، بنفس لغته.\n"
        "رجّع JSON بس بالشكل ده:\n" + (re.sub(r'"kind": "[^"]*"', '"kind": "track | sign | spot"', PLAN_FORMAT, count=1) if pro else PLAN_FORMAT)
    )
    return [{"role": "user", "content": text}]


PRO_MAP = {"pop": "track", "type": "track", "build": "sign", "anchor": "sign", "icon": "spot", "letters": "spot", "scatter": "spot", "ring": "spot"}


def _i(v, d=0):
    try:
        return int(v)
    except (TypeError, ValueError):
        return d


def clean_plan(raw: dict, words: list[dict], duration: float, pro: bool = False) -> list[dict]:
    """البلوكات بأوقات حقيقية من الكلمات: كل بلوك من أول كلمة فيه لحد أول كلمة في اللي بعده."""
    n = len(words)
    out = []
    for b in (raw or {}).get("blocks") or []:
        if not isinstance(b, dict):
            continue
        a, z = max(0, _i(b.get("from"))), min(n - 1, _i(b.get("to"), n - 1))
        if out and a <= out[-1]["to"]:
            a = out[-1]["to"] + 1
        if a > z:
            continue
        kind = b.get("kind") if b.get("kind") in KINDS else "build"
        if pro and kind not in PRO_KINDS:   # الستايل الاحترافي: أي حركة قديمة بتتحوّل لأقرب حركة احترافية
            kind = PRO_MAP.get(kind, "sign")
        icons = [str(x).strip() for x in (b.get("icons") or []) if str(x).strip()][:9]
        out.append({"from": a, "to": z, "kind": kind, "theme": b.get("theme") if b.get("theme") in THEMES else "light",
                    "text": str(b.get("text") or "").strip(), "focus": _i(b.get("focus"), -1),
                    "icon": str(b.get("icon") or "").strip(), "icons": icons, "letter": _i(b.get("letter"), 1),
                    "side": str(b.get("side") or "").strip(), "anchor": str(b.get("anchor") or "").strip(),
                    "place": b.get("place") if b.get("place") in PLACES else "auto", "skip": _i(b.get("skip"), -1),
                    "intro": b.get("intro") if b.get("intro") in INTROS.get(kind, ("",)) else "",
                    "outro": b.get("outro") if b.get("outro") in OUTROS.get(kind, ("",)) else "",
                    "sign": str(b.get("sign") or "").strip()[:40], "box": _i(b.get("box"), -1), "redact": _i(b.get("redact"), -1),
                    **{k: (b.get(k) if b.get(k) in vals else "") for k, vals in VARIANTS.items()},
                    "marks": [{"type": m["type"], "word": _i(m.get("word")), **({"color": m["color"]} if m.get("color") in ("red", "yellow") else {})}
                              for m in (b.get("marks") or []) if isinstance(m, dict) and m.get("type") in MARKS][:4]})
    if not out and n:
        return pro_plan(words, duration) if pro else mock_plan(words, duration)
    # كلمات اتسابت في الآخر: تتضاف لآخر بلوك
    if out and out[-1]["to"] < n - 1:
        out[-1]["to"] = n - 1
    for b in out:   # العلامات على كلام جوه البلوك بس
        b["marks"] = [m for m in b["marks"] if 0 <= m["word"] <= b["to"] - b["from"]]
    if pro and out:   # الانتقالات اللي بتعمل الإيقاع لو الموديل نسيها
        if out[0]["kind"] == "track" and not out[0]["intro"]:
            out[0]["intro"] = "flash"
        for a, b in zip(out, out[1:] + [None]):
            if a["kind"] == "track" and b and b["kind"] != "track" and not a["outro"]:
                a["outro"] = "pixel"
            if a["kind"] == "spot" and not a["intro"]:
                a["intro"] = "burst"
    return timed(out, words, duration)


def timed(blocks: list[dict], words: list[dict], duration: float) -> list[dict]:
    for k, b in enumerate(blocks):
        ws = words[b["from"]: b["to"] + 1]
        b["t0"] = 0.0 if k == 0 else round(ws[0]["s"] - 0.05, 3)
        b["words"] = [{"w": w["w"], "t0": w["s"], "t1": w["e"]} for w in ws]
        if not b.get("text"):
            b["text"] = " ".join(w["w"] for w in ws)
    for k, b in enumerate(blocks):
        b["t1"] = blocks[k + 1]["t0"] if k + 1 < len(blocks) else round(max(duration, b["words"][-1]["t1"] + 0.4), 3)
        b["t1"] = max(b["t1"], b["t0"] + 0.3)
    return blocks


def sentences(words: list[dict]) -> list[list[int]]:
    """أرقام كلام كل جملة (لحد . ؟ ! أو وقفة طويلة)."""
    out, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        gap = (words[i + 1]["s"] - w["e"]) if i + 1 < len(words) else 9
        if re.search(r"[.!?؟]$", w["w"]) or gap > 0.9:
            out.append(cur)
            cur = []
    return out + ([cur] if cur else [])


def pro_plan(words: list[dict], duration: float, icons: list[str] | None = None, pick=None) -> list[dict]:
    """الإخراج الاحترافي من غير موديل: إيقاع الفيديو المرجع (track ← sign ← spot) مع تنويع ثابت من جملة للتانية.
    pick(أرقام كلام الجملة) ← أيقونات من القاموس بروح الستايل (الجملة اللي فيها حاجة ملموسة بتاخد spot بأيقوناتها)."""
    import random
    out = []
    sents = sentences(words)
    for si, sent in enumerate(sents):
        rnd = random.Random(si * 7919 + len(words))
        n = len(sent)
        head = sent[: min(4, max(1, n // 3))] if n > 2 else sent
        rest = sent[len(head):]
        tail = rest[-min(3, max(1, len(rest) // 3)):] if len(rest) >= 3 else []
        found = pick(sent) if pick else []
        if found and not tail and rest:   # فيها حاجة ليها أيقونة: آخر كلمة بتبقى spot
            tail = rest[-1:]
        mid = rest[: len(rest) - len(tail)]
        neg = [i for i, k in enumerate(head) if re.search(r"(n't|not|no|مش|ما|لا|مفيش)", words[k]["w"].lower())]
        tr = {"from": head[0], "to": head[-1], "kind": "track", "intro": "flash" if si == 0 else rnd.choice(["", "", "card"]),
              "outro": rnd.choice(["pixel", "pixel", "wipe"]) if mid or tail else "", "tone": "" if si == 0 else rnd.choice(["", "", "dark", "yellow"]),
              "layout": "stack" if n >= 6 and rnd.random() < 0.35 else "",
              "marks": [{"type": "strike", "word": neg[0]}] if neg else [{"type": rnd.choice(["box", "underline", "redact"]), "word": min(1, len(head) - 1)}]}
        out.append(tr)
        if mid:
            longest = max(mid, key=lambda i: len(words[i]["w"]))
            out.append({"from": mid[0], "to": mid[-1], "kind": "sign", "focus": mid.index(longest), "sign": words[longest]["w"].strip(".,،؟?!"),
                        "frame": rnd.choice(["brackets", "box", "none"]), "sigpos": rnd.choice(["below", "behind"]),
                        "tone": rnd.choice(["", "", "dark"]), "marks": [{"type": rnd.choice(["circle", "underline", "arrow"]), "word": mid.index(longest)}]})
        if tail:
            out.append({"from": tail[0], "to": tail[-1], "kind": "spot", "intro": "burst", "outro": "red" if si < len(sents) - 1 else "",
                        "icons": (found if pick else icons or [])[:4], "focus": len(tail) - 1, "flank": rnd.choice(["", "right"]), "color": rnd.choice(["blue", "red", "yellow"]),
                        "arrange": rnd.choice(["scatter", "row"]), "tone": rnd.choice(["", "", "dark"])})
    for b in out:
        b.setdefault("theme", "light")
        for k, v in (("text", ""), ("focus", -1), ("icon", ""), ("icons", []), ("letter", 1), ("side", ""), ("anchor", ""), ("place", "auto"),
                     ("skip", -1), ("intro", ""), ("outro", ""), ("sign", ""), ("box", -1), ("redact", -1), ("marks", []),
                     *((k2, "") for k2 in VARIANTS)):
            b.setdefault(k, v)
    return timed(out, words, duration)


def studio_plan(words: list[dict], duration: float, person: dict | None = None) -> list[dict]:
    """ستوديو من غير موديل: كل جملة بتتقسم على عناصر الفيديوهات المرجعية على حسب طولها ولغتها، ووجود شخص في الفيديو."""
    has = bool((person or {}).get("present"))
    out = []
    sents = sentences(words)
    for si, sent in enumerate(sents):
        n = len(sent)
        ar = any(AR.search(words[i]["w"]) for i in sent)
        longest = lambda idx: max(idx, key=lambda i: len(words[i]["w"]))  # noqa: E731
        if n <= 2:
            kind = ("behind", "neon", "fill")[si % 3] if has and si % 2 == 0 else ("signature" if si == len(sents) - 1 else ("redword", "poster", "ransom", "burst", "fill")[si % 5])
            out.append({"from": sent[0], "to": sent[-1], "kind": kind, "sign": " ".join(words[i]["w"] for i in sent).strip(".,،؟?!")})
            continue
        head = sent[:1] if n < 6 else sent[:2]
        rest = sent[len(head):]
        if has and si % 3 != 2:
            out.append({"from": head[0], "to": head[-1], "kind": "behind"})
        else:
            rest = sent
        tail = rest[-2:] if len(rest) >= 6 else []
        mid = rest[: len(rest) - len(tail)]
        if mid and any(re.search(r"[\d٠-٩]", words[i]["w"]) for i in mid):
            out.append({"from": mid[0], "to": mid[-1], "kind": "counter"})
            mid = []
        if mid:
            # بيلف على العناصر عشان كل جملة تبقى شكل مختلف
            if ar and si % 4 == 1:
                kind = "artype"
            elif has:
                kind = ("arc", "stack", "halo", "tags", "cube", "hand", "push", "lock", "select")[si % 9] if len(mid) <= 6 else ("stack", "chat", "board", "comments", "hand", "cards", "polaroid", "dots")[si % 8]
            else:
                kind = ("redword", "stack", "crt", "push", "shapes", "floor", "space", "select", "lock")[si % 9] if len(mid) <= 6 else ("hand", "chat", "board", "space", "crt", "cards")[si % 6]
            out.append({"from": mid[0], "to": mid[-1], "kind": kind, "focus": mid.index(longest(mid))})
        if tail:
            last = si == len(sents) - 1
            out.append({"from": tail[0], "to": tail[-1], "kind": "signature" if last else "redword",
                        "sign": " ".join(words[i]["w"] for i in tail).strip(".,،؟?!")})
    for b in out:
        b.setdefault("theme", "light")
        for k, v in (("text", ""), ("focus", -1), ("icon", ""), ("icons", []), ("letter", 1), ("side", ""), ("anchor", ""), ("place", "auto"),
                     ("skip", -1), ("intro", ""), ("outro", ""), ("sign", ""), ("box", -1), ("redact", -1), ("marks", []),
                     *((k2, "") for k2 in VARIANTS)):
            b.setdefault(k, v)
    return timed(out, words, duration)


AR = re.compile(r"[\u0600-\u06FF]")


def mock_plan(words: list[dict], duration: float) -> list[dict]:
    """من غير موديل: الكلام بيتقسم على الوقفات، والحركات بتتلف بالترتيب."""
    groups, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        gap = (words[i + 1]["s"] - w["e"]) if i + 1 < len(words) else 9
        if len(cur) >= 6 or gap > 0.35 or re.search(r"[.!?؟،,]$", w["w"]):
            groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)
    order = ["pop", "type", "build", "icon", "build", "scatter", "letters"]
    themes = ["accent", "light", "dark", "dark", "light", "light", "dark"]
    out = []
    for k, g in enumerate(groups):
        kind = order[k % len(order)]
        last = words[g[-1]]["w"]
        out.append({"from": g[0], "to": g[-1], "kind": kind, "theme": themes[k % len(themes)],
                    "text": last if kind in ("pop", "icon", "letters", "scatter") else "", "focus": len(g) - 1 if kind == "build" else -1,
                    "icon": "star" if kind == "icon" else "", "icons": ["heart", "star"] if kind == "letters" else [], "letter": 1, "side": ""})
    return timed(out, words, duration)


# ---------------------------------------------------------------- استخراج التايبوجرافي من فيديو (المعمل)

EXTRACT_FORMAT = """{
  "style": {"name": "اسم قصير للستايل بالعربي", "font_look": "English: the typeface look (geometric sans, serif, handwritten...) and weight",
            "case": "lower | upper | none", "grain": 0.1,
            "light": {"bg": "#hex", "ink": "#hex", "accent": "#hex"}, "dark": {"bg": "#hex", "ink": "#hex", "accent": "#hex"},
            "accent": {"bg": "#hex", "ink": "#hex", "accent": "#hex"},
            "icon_style": "English: how the icons/images look (pixel art, 3D, flat, photo cutouts...) so new ones can be drawn the same way",
            "rules": ["قاعدة بالعربي: إمتى بيستخدم كل حركة ولأي نوع كلام"]},
  "moments": [{"t0": 0.0, "t1": 1.2, "kind": "pop | type | build | icon | letters | scatter | ring | other", "theme": "light | dark | accent",
               "text": "الكلام المكتوب على الشاشة", "said": "الكلام المتقال وقتها", "how": "وصف الحركة بالعربي (إزاي الكلام اتحوّل لشكل)",
               "icons": [{"name": "english-short-name", "desc": "English: what it is and how it looks", "t": 1.0, "box": [0.1, 0.2, 0.3, 0.5]}]}]
}"""


def extract_messages(duration: float) -> list[dict]:
    kinds = "\n".join(f"- {k}: {v}" for k, v in KINDS.items())
    text = (
        "أنت مصمم موشن تايبوجرافي. اتفرج على الفيديو ده كله بالصوت، وطلّع كل اللحظات اللي الكلام المتقال فيها اتحوّل لحاجة على الشاشة: "
        "كلمات مكتوبة بحركة، أو حروف، أو أشكال، أو أيقونات، أو صور بتمثّل الكلام.\n"
        f"الفيديو مدته {duration:.2f} ثانية.\n"
        "صنّف كل لحظة بأقرب حركة من دول (ولو مفيش زيها اكتب other ووصفها في how):\n" + kinds + "\n\n"
        "- moments ورا بعض بالترتيب وبتوقيت مظبوط.\n"
        "- icons: كل أيقونة/صورة/رمز ظاهر في اللحظة دي، باسم قصير بالإنجليزي، ووقت تكون فيه واضحة لوحدها (t)، "
        "وbox = مكانها في الفريم [x0, y0, x1, y1] من 0 لـ 1 (مربع ضيق حواليها هي بس).\n"
        "- style: الألوان الحقيقية بالهكس للخلفية الفاتحة والغامقة والملونة، وشكل الخط، وrules = إمتى بيستخدم كل حركة.\n"
        "رجّع JSON بس بالشكل ده:\n" + EXTRACT_FORMAT
    )
    return [{"role": "user", "content": text}]


HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def _plain(v) -> str:
    return re.sub(r"^\s*English\s*:\s*", "", str(v or "")).strip()


def _theme(v: dict | None, base: dict) -> dict:
    v = v if isinstance(v, dict) else {}
    return {k: (v.get(k) if isinstance(v.get(k), str) and HEX.match(v.get(k)) else base[k]) for k in ("bg", "ink", "accent")}


def clean_extract(raw: dict, duration: float) -> dict:
    raw = raw or {}
    base = BUILTIN_STYLES["mono-red"]
    st = raw.get("style") if isinstance(raw.get("style"), dict) else {}
    moments = []
    for m in raw.get("moments") or []:
        if not isinstance(m, dict):
            continue
        try:
            t0, t1 = max(0.0, float(m.get("t0"))), min(duration, float(m.get("t1")))
        except (TypeError, ValueError):
            continue
        if t1 - t0 < 0.1:
            continue
        icons = []
        for ic in m.get("icons") or []:
            if not isinstance(ic, dict):
                continue
            box = ic.get("box")
            try:
                box = [min(1.0, max(0.0, float(x))) for x in box][:4] if isinstance(box, list) and len(box) == 4 else None
            except (TypeError, ValueError):
                box = None
            if box and (box[2] - box[0] < 0.02 or box[3] - box[1] < 0.02):
                box = None
            try:
                t = min(t1, max(t0, float(ic.get("t", (t0 + t1) / 2))))
            except (TypeError, ValueError):
                t = (t0 + t1) / 2
            name = re.sub(r"[^a-z0-9-]+", "-", str(ic.get("name") or "icon").lower()).strip("-")[:30] or "icon"
            icons.append({"name": name, "desc": str(ic.get("desc") or "")[:200], "t": round(t, 2), "box": box})
        moments.append({"t0": round(t0, 2), "t1": round(t1, 2), "kind": m.get("kind") if m.get("kind") in KINDS else "other",
                        "theme": m.get("theme") if m.get("theme") in THEMES else "light", "text": str(m.get("text") or "")[:200],
                        "said": str(m.get("said") or "")[:200], "how": str(m.get("how") or "")[:400], "icons": icons[:12]})
    counts: dict[str, int] = {}
    for m in moments:
        if m["kind"] in KINDS:
            counts[m["kind"]] = counts.get(m["kind"], 0) + 1
    style = {
        "name": str(st.get("name") or "ستايل من المعمل")[:60], "font": base["font"],
        "font_look": str(st.get("font_look") or "")[:200], "case": st.get("case") if st.get("case") in ("lower", "upper", "none") else "none",
        "grain": min(0.4, max(0.0, float(st.get("grain") or 0.1))) if isinstance(st.get("grain"), (int, float)) else 0.1, "weight": 700,
        "light": _theme(st.get("light"), base["light"]), "dark": _theme(st.get("dark"), base["dark"]), "accent": _theme(st.get("accent"), base["accent"]),
        "icon_style": _plain(st.get("icon_style"))[:300],
        "rules": [str(r)[:200] for r in (st.get("rules") or []) if str(r).strip()][:12], "kinds": counts or base["kinds"],
    }
    return {"style": style, "moments": moments}


def mock_extract(duration: float) -> dict:
    d = max(2.0, duration)
    return clean_extract({
        "style": {"name": "ستايل تجريبي", "case": "lower", "rules": ["كلمة مهمة = icon", "الختام scatter"]},
        "moments": [
            {"t0": 0, "t1": d * 0.2, "kind": "pop", "theme": "accent", "text": "how", "how": "كلمة كبيرة على أصفر"},
            {"t0": d * 0.2, "t1": d * 0.5, "kind": "type", "text": "how do you communicate", "how": "كتابة بمؤشر"},
            {"t0": d * 0.5, "t1": d * 0.8, "kind": "icon", "theme": "dark", "text": "action.", "how": "كاميرا جنب الكلمة",
             "icons": [{"name": "camera", "desc": "pixel art camera", "t": d * 0.6, "box": [0.3, 0.3, 0.6, 0.7]}]},
            {"t0": d * 0.8, "t1": d, "kind": "scatter", "text": "love", "how": "حروف بتتجمع"},
        ]}, duration)


def box_messages(name: str, desc: str, frames: list[str]) -> list[dict]:
    """الموديل بيشوف 3 فريمات حوالين وقت الأيقونة ويقول أوضح فريم ومكانها بالظبط (على الصور الثابتة أدق بكتير من الفيديو)."""
    parts: list[dict] = [{"type": "text", "text": (
        f"Find this single object: «{name}» — {desc}.\n"
        f"You get {len(frames)} frames (frame 0, 1, 2...). Pick the frame where the object is most fully visible, sharp and least covered, "
        "and give a tight box around that ONE object only (not neighbours, not text).\n"
        'Return JSON only: {"frame": 0, "top": 0, "left": 0, "bottom": 0, "right": 0} where top/bottom are vertical and left/right '
        'are horizontal positions scaled to 0-1000 of the image height/width. If it is not visible in any frame return {"frame": -1}.')}]
    for i, f in enumerate(frames):
        parts += [{"type": "text", "text": f"frame {i}:"}, {"type": "image_url", "image_url": {"url": f}}]
    return [{"role": "user", "content": parts}]


def iou(a: list[float], b: list[float]) -> float:
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua if ua > 0 else 0.0


def clean_box(raw: dict, n: int, prior: list[float] | None = None) -> tuple[int, list[float]] | None:
    """box_2d المفروض [ymin, xmin, ymax, xmax] من 0 لـ 1000، بس الموديل ساعات بيقلبها x قبل y:
    لو معانا مكان تقريبي (من الفيديو) بناخد الترتيب اللي أقرب له."""
    try:
        k = int((raw or {}).get("frame", 0 if n == 1 else -1))
        if all(key in raw for key in ("top", "left", "bottom", "right")):   # بالأسماء: مفيش لخبطة في الترتيب
            b = [min(1.0, max(0.0, float(raw[key]) / 1000)) for key in ("left", "top", "right", "bottom")]
            return (k, b) if 0 <= k < n and b[2] - b[0] >= 0.02 and b[3] - b[1] >= 0.02 else None
        v = [min(1.0, max(0.0, float(x) / 1000)) for x in raw.get("box_2d")][:4]
    except (TypeError, ValueError, AttributeError):
        return None
    if not 0 <= k < n or len(v) != 4:
        return None
    yx = [v[1], v[0], v[3], v[2]]
    box = yx
    if prior and iou(v, prior) > iou(yx, prior) + 0.05:
        box = v
    if box[2] - box[0] < 0.02 or box[3] - box[1] < 0.02:
        return None
    return k, box


# ---------------------------------------------------------------- تحليل الفيديو اللي التايبوجرافي هيتركب عليه

ANCHOR_KINDS = ("photo", "paper", "screen", "object", "product", "face", "person", "sign", "space")
SCENE_FORMAT = """{"anchors": [{"label": "English: short name (e.g. framed photo of the speaker, sheet of paper on the desk)",
  "kind": "photo | paper | screen | object | product | face | person | sign | space",
  "t0": 0.0, "t1": 3.0, "left": 0.1, "top": 0.2, "right": 0.4, "bottom": 0.6,
  "note": "بالعربي: إيه اللي ينفع يتعمل معاها (اكتب جنبها، عليها، هي نفسها كلمة...)"}]}"""


def scene_messages(duration: float, words: list[dict]) -> list[dict]:
    text = (
        "أنت مصمم موشن تايبوجرافي هيكتب كلام متحرك فوق الفيديو ده ويدمجه مع اللي في الكادر. اتفرج على الفيديو كله، "
        "وطلّع كل الحاجات الظاهرة اللي الكلام ممكن يندمج معاها (المراسي):\n"
        "- صور أو براويز، أوراق وكتب ومكاتب، شاشات وموبايلات، منتجات وحاجات في الإيد، يافطات، الوشوش والأشخاص، "
        "ومساحات فاضية واضحة (حيطة سادة، سما) ينفع يتكتب فيها (kind=space).\n"
        f"الفيديو مدته {duration:.2f} ثانية.\n"
        + ("الكلام المتقال بتوقيته (عشان تركّز على الحاجات اللي الكلام بيشاور عليها):\n" + words_text(words) + "\n" if words else "")
        + "- t0/t1 = من إمتى لإمتى الحاجة ظاهرة. left/right = مكانها بالعرض وtop/bottom = بالطول "
        "(من 0 لـ 1 من عرض/طول الكادر) في نص المدة دي.\n"
        "- لو الكاميرا بتتقطع أو الحاجة بتختفي وترجع، اكتبها مرتين.\n"
        "- من 3 لـ 15 مرساة، الأهم الأول.\n"
        "رجّع JSON بس بالشكل ده:\n" + SCENE_FORMAT
    )
    return [{"role": "user", "content": text}]


def clean_scene(raw: dict, duration: float) -> list[dict]:
    out = []
    for a in (raw or {}).get("anchors") or []:
        if not isinstance(a, dict):
            continue
        try:
            t0, t1 = max(0.0, float(a.get("t0"))), min(duration, float(a.get("t1")))
            raw_box = [a.get(k) for k in ("left", "top", "right", "bottom")] if a.get("left") is not None else a.get("box")
            box = [min(1.0, max(0.0, float(v))) for v in raw_box][:4]
        except (TypeError, ValueError):
            continue
        if t1 - t0 < 0.2 or len(box) != 4 or box[2] - box[0] < 0.02 or box[3] - box[1] < 0.02:
            continue
        out.append({"id": f"a{len(out) + 1}", "label": _plain(a.get("label"))[:80] or "thing",
                    "kind": a.get("kind") if a.get("kind") in ANCHOR_KINDS else "object", "t0": round(t0, 2), "t1": round(t1, 2),
                    "note": str(a.get("note") or "")[:200], "keys": [{"t": round((t0 + t1) / 2, 2), "box": box}]})
    return out[:15]


def mock_scene(duration: float) -> list[dict]:
    d = max(1.0, duration)
    return clean_scene({"anchors": [
        {"label": "framed photo", "kind": "photo", "t0": 0, "t1": d * 0.6, "box": [0.55, 0.25, 0.9, 0.6], "note": "صورة على الحيطة"},
        {"label": "speaker face", "kind": "face", "t0": 0, "t1": d, "box": [0.15, 0.2, 0.45, 0.55], "note": "ما تكتبش عليه"},
        {"label": "sheet of paper", "kind": "paper", "t0": d * 0.5, "t1": d, "box": [0.2, 0.65, 0.7, 0.9], "note": "ينفع يتكتب عليها"},
    ]}, duration)


# ---------------------------------------------------------------- الستيكرات: شيل الخلفية

def key_background(src: Path, out: Path, tol: int = 34, pad: int = 6) -> tuple[int, int]:
    """يشيل الخلفية السادة (أو قريبة من السادة) اللي لازقة في حواف الصورة، ويقص على الشكل. بيرجّع المقاس."""
    from PIL import Image, ImageFilter

    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    border = [px[x, y][:3] for x in range(0, w, max(1, w // 40)) for y in (0, h - 1)] + \
             [px[x, y][:3] for y in range(0, h, max(1, h // 40)) for x in (0, w - 1)]
    border.sort(key=lambda c: sum(c))
    bg = border[len(border) // 2]

    def near(c):
        return abs(c[0] - bg[0]) + abs(c[1] - bg[1]) + abs(c[2] - bg[2]) <= tol * 3

    seen = bytearray(w * h)
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    mask = Image.new("L", (w, h), 255)
    mp = mask.load()
    while stack:
        x, y = stack.pop()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        if not near(px[x, y]):
            continue
        mp[x, y] = 0
        if x > 0: stack.append((x - 1, y))
        if x < w - 1: stack.append((x + 1, y))
        if y > 0: stack.append((x, y - 1))
        if y < h - 1: stack.append((x, y + 1))
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    im.putalpha(mask)
    box = mask.point(lambda v: 255 if v > 20 else 0).getbbox()
    if box:
        box = (max(0, box[0] - pad), max(0, box[1] - pad), min(w, box[2] + pad), min(h, box[3] + pad))
        im = im.crop(box)
    im.save(out, "PNG")
    return im.size


def sticker_prompt(desc: str, icon_style: str) -> str:
    return (f"A single isolated icon/sticker: {desc}. Style: {icon_style or 'bold clean pixel-art icon, crisp outline, flat vivid colors'}. "
            "Centered, fully visible with generous margin, on a perfectly plain flat pure white #FFFFFF background, "
            "no shadow on the background, no text, no frame, no other objects.")


def json_or(text: str, default):
    try:
        return json.loads(text)
    except (TypeError, ValueError):
        return default


# ---------------------------------------------------------------- تتبّع الحاجة وهي بتتحرك (من غير موديل)

def track_template(frames: list, mid: int, box: list[float]) -> list[list[float] | None]:
    """frames: صور رمادي صغيرة (numpy) ورا بعض. الحاجة معروف مكانها بالظبط في الفريم mid (box من 0 لـ 1)،
    وفي باقي الفريمات بندوّر على نفس الحتة (normalized cross-correlation) قريب من مكانها في الفريم اللي قبله."""
    import numpy as np

    h, w = frames[mid].shape
    x0, y0, x1, y1 = int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)
    x1, y1 = max(x1, x0 + 4), max(y1, y0 + 4)
    tpl = frames[mid][y0:y1, x0:x1].astype(np.float32)
    th, tw = tpl.shape
    tz = tpl - tpl.mean()
    tn = float(np.sqrt((tz ** 2).sum())) or 1.0
    out: list = [None] * len(frames)
    out[mid] = [x0 / w, y0 / h, x1 / w, y1 / h]

    P = (th, tw)   # الحواف بتتمد عشان الحاجة تفضل تتتبع وهي خارجة من الكادر

    def find(img, px, py):
        rx, ry = max(8, int(w * 0.12)), max(8, int(h * 0.12))   # بيدوّر قريب من المكان اللي فات
        big = np.pad(img, ((P[0], P[0]), (P[1], P[1])), mode="edge")
        ax, ay = max(0, px + P[1] - rx), max(0, py + P[0] - ry)
        bx, by = min(w + 2 * P[1], px + P[1] + tw + rx), min(h + 2 * P[0], py + P[0] + th + ry)
        win = big[ay:by, ax:bx].astype(np.float32)
        if win.shape[0] < th or win.shape[1] < tw:
            return None
        H2, W2 = win.shape
        F = np.fft.rfft2(win, s=(H2 + th, W2 + tw))
        T = np.fft.rfft2(tz[::-1, ::-1], s=(H2 + th, W2 + tw))
        corr = np.fft.irfft2(F * T, s=(H2 + th, W2 + tw))[th - 1:H2, tw - 1:W2]
        ii = np.pad(win, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
        ii2 = np.pad(win ** 2, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
        s = ii[th:, tw:] - ii[:-th, tw:] - ii[th:, :-tw] + ii[:-th, :-tw]
        s2 = ii2[th:, tw:] - ii2[:-th, tw:] - ii2[th:, :-tw] + ii2[:-th, :-tw]
        n = th * tw
        den = np.sqrt(np.maximum(s2 - s * s / n, 1e-6)) * tn
        ncc = corr[: s.shape[0], : s.shape[1]] / den[: corr.shape[0], : corr.shape[1]]
        j = int(np.argmax(ncc))
        yy, xx = divmod(j, ncc.shape[1])
        if float(ncc.flat[j]) < 0.45:   # مش لاقيها (اختفت أو اتغطّت)
            return None
        return ax + xx - P[1], ay + yy - P[0]

    for rng_ in (range(mid + 1, len(frames)), range(mid - 1, -1, -1)):
        px, py = x0, y0
        for i in rng_:
            hit = find(frames[i], px, py)
            if hit is None:
                break
            px, py = hit
            out[i] = [px / w, py / h, (px + tw) / w, (py + th) / h]
    return out
