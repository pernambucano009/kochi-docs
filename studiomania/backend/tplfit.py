"""🎯 كل قالب يصلح لأنهي مجالات (من جرد جلسة القوالب). القالب المتخصص بيفضل في تخصصه: مابيظهرش في المعرض ولا بيدخل
الأوتوبايلوت لعميل مجاله مش من مجالاته. والقالب اللي محتاج نوع محتوى (صوت، تطبيق، يوتيوب، شخص، رمضان، مناسبة) مابيتختارش
تلقائيًا غير لو العميل اختاره بنفسه.

المجالات = مفاتيح fieldpacks.FIELDS. «*» = كل المجالات. els = القالب بياخد عناصر المجال (فيصلح لأي مجال ليه مكتبة عناصر).
"""
from __future__ import annotations

from pathlib import Path

ALL = "*"
EL_DIR = Path(__file__).resolve().parent.parent / "frontend" / "gallery" / "el"

_ALL = ("t-chart t-chat t-keynote t-logo t-loop t-particles t-review t-swiss t-title3d t-wrapped t-beat "
        "t-newsletter t-flipcards t-microgame t-spy t-audiogram 017 019 026 038 042 052 061 080 119 121 123 149 226 b-intro b-outro")
_ALL_ELS = "t-brandreveal t-board t-flow t-milestone t-riso t-glass t-sketch t-redcut t-shadow 027"
_FIELDS_ELS = {
    "t-watercolor": "food", "t-impasto": "food", "t-oneline": "food", "t-woodcut": "food shops", "t-ascii": "food ecom",
    "t-dossier": "food ecom shops", "t-ink": "beauty food", "t-ukiyo": "food", "t-screen": "food ecom", "t-deco": "ecom beauty",
    "t-holo": "ecom shops", "t-blueprint": "ecom home realestate", "t-crayon": "edu", "t-toon": "ecom shops home", "t-pixel": "shops ecom food",
}
_SPECIAL = {
    "t-shopfloat": "ecom shops food beauty", "t-brandline": "ecom shops food", "t-captions": "ecom shops beauty food", "t-onehero": "ecom shops food",
    "t-iso": "ecom shops food", "t-silent": "food ecom shops", "t-hose": "food", "009": "food", "t-anime": "food", "t-brick": "shops ecom food",
    "t-pictogram": "fitness", "t-math": "edu realestate fitness", "055": "edu fitness realestate beauty dental home",
}
_NEED = {"t-price": "offer", "t-count": "offer", "t-tilt": "event", "t-versus": "compare", "t-show": "quiz", "t-ytintro": "youtube", "t-launch": "app", "t-notch": "app", "t-screencast": "app", "t-lower": "person",
         "t-lantern": "ramadan", "065": "event", "072": "event", "t-signature": "thanks"}   # قص ورق أحمر: بيعرض الشعار بس (طلب صاحب المشروع)

# 🎨 «قوالب الرسومات» (نفس تقسيمة المعرض): قوالب الموشن غير العروض وآراء العملاء والمتخصصة
NOT_ART = {"t-price", "t-count", "t-review", "t-signature", "t-tilt", "t-versus", "t-show", "t-map", "t-audiogram", "t-ytintro", "t-launch",
           "t-notch", "t-screencast", "t-lower", "t-lantern"}


def is_art(tid: str) -> bool:
    return str(tid).startswith("t-") and tid not in NOT_ART


def art_allowed(brain: dict | None, field: str) -> bool:
    """العميل قال إن قوالب الرسومات مش مناسبة لصفحته («0»)، أو مجاله تنمية بشرية ولسه ماوافقش: مابتتختارش تلقائيًا ومابتظهرش."""
    ok = str((brain or {}).get("art_ok") or "")
    return ok == "1" or (ok != "0" and field != "selfdev")


FIT: dict[str, dict] = {}
for _t in _ALL.split():
    FIT[_t] = {"fields": ALL, "els": False}
for _t in _ALL_ELS.split():
    FIT[_t] = {"fields": ALL, "els": True}
for _t, _f in _FIELDS_ELS.items():
    FIT[_t] = {"fields": _f.split(), "els": True}
for _t, _f in _SPECIAL.items():
    FIT[_t] = {"fields": _f.split(), "els": False, "special": True}
for _t, _n in _NEED.items():
    FIT[_t] = {"fields": ALL, "els": False, "need": _n}
# 🚫 قوالب صاحب المشروع قال إنها ماتصلحش لمجال معين (ملاحظاته في معرض المراجعة)
NOT_FOR = {
    "selfdev": {"t-brandreveal", "t-microgame", "t-logo", "t-notch", "t-glass", "t-spy", "t-lantern"},
}
# 🛵 الخريطة: للي عندهم منتجات وتوصيل بس (مطاعم، متاجر إلكترونية، محلات)، ومابتتختارش لوحدها
FIT["t-map"] = {"fields": ["food", "ecom", "shops"], "els": False, "special": True, "need": "delivery"}


def has_els(field: str) -> bool:
    return bool(field) and (EL_DIR / field / "index.json").is_file()


def fits(tpl: str, field: str) -> bool:
    """القالب يصلح لعميل المجال ده؟ (مجال مش معروف، أو قالب مش في الخريطة: يصلح)"""
    if tpl in NOT_FOR.get(field, ()):
        return False
    f = FIT.get(tpl)
    if not f or not field:
        return True
    if f["fields"] == ALL or field in f["fields"]:
        return True
    return bool(f.get("els")) and not f.get("special") and has_els(field)


def auto_ok(tpl: str, field: str, chosen: bool = False) -> bool:
    """الأوتوبايلوت يختاره لوحده؟ لازم يصلح للمجال، والمحتاج نوع محتوى بعينه بس لو العميل اختاره."""
    f = FIT.get(tpl) or {}
    return fits(tpl, field) and (not f.get("need") or chosen)


def unfit(field: str) -> list[str]:
    return [t for t in FIT if not fits(t, field)]
