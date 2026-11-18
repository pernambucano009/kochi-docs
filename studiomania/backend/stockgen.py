"""🎞️ لقطات الستوك اللي البرنامج بيولّدها (قوالب التايبوجرافي فوق الستوك والأوتوبايلوت): قرار صاحب المشروع ١٨ نوفمبر.

اللقطة المتولّدة لازم تبان طبيعية، مش «AI»:
- مواضيع بسيطة: إيدين، رجلين، أدوات، أكل، ناس من الجنب أو من ضهرهم. الجسم مايظهرش كامل بقدر الإمكان.
- لقطة من الجنب ومبلّرة شوية أحسن مليون مرة من زوم بدقة عالية باين إنه AI.
- من غير وشوش قريبة، ومن غير جسم كامل بيعمل حركة معقدة (سباحة، رقص)، ومن غير مية أو سوايل بتتصب،
  ومن غير كلام أو شاشات أو لافتات في المشهد.
- بعد التوليد: فلتر «شكل طبيعي» (كونتراست وتشبع أقل، بلور خفيف، حبيبات، فينييت). اتجرب بالعين في معرض جلسة القوالب.
- وفلتر الـ slop بموديل رؤية: اللقطة اللي موضوعها نفسه غلط (جسم مشوّه، صوابع غلط، كلام وهمي، فيزياء مية غريبة،
  ناس زي المانيكان) بتتولد تاني مرة واحدة بلقطة أبسط، وبعدها تتشال. الفلتر اللوني مابيصلّحش الحاجات دي.
- الحركات التقنية (hud وtermbar) ماتتحطش فوق لقطة متولّدة.
- مفيش لقطات مختلطة: مفيش ستات وسط رجالة، ولا ستات بيقفزوا أو بيرقصوا. الأحسن من غير ناس، أو جزء من الجسم، أو شخص واحد لوحده،
  ولو فيه ستات يبقوا مع ستات بس وبلبس محتشم.
"""
from __future__ import annotations

PROMPT_RULES = (
    "Natural documentary stock footage look. Simple subject: hands, feet or legs, equipment, food, or people seen from the side or from behind. "
    "No close-up faces, no full bodies doing complex movement, no pouring water or liquids, no text, letters, screens, signs or logos in the scene. "
    "Side or back angle, shallow depth of field with a softly blurred background, soft natural light, muted realistic colors, slight film grain. "
    "Not hyper detailed, not 8k, not ultra sharp, not glossy. "
    "No mixed-gender scenes: never women among men, no women jumping or dancing. Prefer no people, or only hands/feet, or one person alone; "
    "if women appear, only with other women and in modest clothing."
)

# الفلتر على لقطة 1080×1920. البلور بيتحسب على المقاس: لقطة أصغر = sigma أصغر بنفس النسبة.
NATURAL_VF = "eq=contrast=0.80:saturation=0.76:brightness=0.02:gamma=1.06,gblur=sigma={sigma:.2f},noise=alls=9:allf=t,vignette=PI/5"
BASE_H, BASE_SIGMA = 1920, 3.2

# حركات التايبوجرافي اللي بتسيب اللقطة باينة (للستوك)، واللي بتفرش خلفية سادة وتغطيها (لقوالب «تايبوجرافي بس»)
SEE_THROUGH = ("artype floor dofwords iconorbit stairs signature redword spread serif serifsolo tags marker megapan anchorword "
               "tornlabel stretch outline").split()
COVERS = ("endcard portalchat blurduo kinstack blurstrobe luxmix medallion quoteline selectword markpan contactcard brushbar blobcam "
          "scriptover cineband objectquote hudcallout termbar").split()   # hud وtermbar بيزوّدوا إحساس الـ AI فوق لقطة متولّدة

SLOP_CHECK = (
    "These are frames from one AI-generated stock clip. Reject it if ANY frame shows: a deformed face or body, wrong hands or fingers, "
    "fake or garbled text, signs or screens, unnatural water or liquid physics, mannequin-like people, an obviously synthetic glossy look, "
    "women mixed among men, women jumping or dancing, or immodest clothing. "
    'Answer JSON only: {"ok": true|false, "problem": "short english reason, empty if ok"}'
)


def natural_vf(height: int) -> str:
    """فلتر ffmpeg للشكل الطبيعي على مقاس اللقطة."""
    return NATURAL_VF.format(sigma=BASE_SIGMA * max(240, int(height or BASE_H)) / BASE_H)


def prompt(subject: str) -> str:
    return f"{subject.strip().rstrip('.')}. {PROMPT_RULES}"
