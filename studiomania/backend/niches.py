"""🏷️ مجال العميل (عقارات، مطاعم، متاجر…) من عقل العلامة: معرض القوالب يعرض المناسب لمجاله أولًا."""
from __future__ import annotations

import re

# (المفتاح، الاسم، كلمات تدل عليه) — الترتيب مهم: أول مجال كلماته تظهر هو المختار
NICHES = [
    ("realestate", "العقارات", r"عقار|عقارات|شقق|شقة|فلل|فيلا|كمبوند|مطور عقاري|تطوير عقاري|وحدات سكنية|إسكان|اسكان|real ?estate|propert|apartment|villa"),
    ("food", "المطاعم والكافيهات", r"مطعم|مطاعم|كافيه|كافي|قهوة|مخبز|حلويات|أكل|اكل|وجبات|بيتزا|برجر|restaurant|cafe|coffee|bakery|food"),
    ("beauty", "التجميل والعيادات", r"تجميل|صالون|عيادة|عيادات|بشرة|ليزر|أسنان|اسنان|مكياج|سبا|عطور|عطر|beauty|clinic|salon|skin|dental|perfume"),
    ("fitness", "الرياضة واللياقة", r"لياقة|رياضة|جيم|نادي|تمارين|تغذية|دايت|مدرب|fitness|gym|workout|coach"),
    ("edu", "التعليم والكورسات", r"تعليم|كورس|كورسات|دورة|دورات|أكاديمية|اكاديمية|مدرسة|تدريب|education|course|academy|school"),
    ("tech", "التقنية والتطبيقات", r"تطبيق|تقنية|برمجيات|برمجة|سوفتوير|منصة رقمية|ذكاء اصطناعي|ذكاء صناعي|saas|app|software|tech"),
    ("travel", "السياحة والسفر", r"سياحة|سفر|فندق|فنادق|رحلات|طيران|منتجع|travel|tour|hotel|resort"),
    ("retail", "المتاجر والمنتجات", r"متجر|متاجر|منتج|منتجات|ملابس|موضة|أزياء|ازياء|إلكتروني|الكتروني|شوب|store|shop|fashion|ecommerce|product"),
    ("services", "الشركات والخدمات", r"شركة|خدمات|استشار|محاماة|محاسبة|تسويق|وكالة|مقاولات|صيانة|agency|consult|b2b|service"),
    ("creator", "صناع المحتوى", r"صانع محتوى|صناع محتوى|بودكاست|يوتيوب|بلوجر|مؤثر|شخصي|creator|podcast|youtube|influencer|personal brand"),
]


def detect(b: dict | None) -> dict:
    """{key, name} لمجال العميل، أو key فاضي إذا لم نعرفه."""
    b = b or {}
    text = " ".join(str(b.get(k) or "") for k in ("niche", "domain", "type", "about", "market", "name")).lower()
    for key, name, rx in NICHES:
        if re.search(rx, text, re.I):
            return {"key": key, "name": name}
    return {"key": "", "name": ""}
