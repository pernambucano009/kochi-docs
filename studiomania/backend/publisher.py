"""الخطوة 7: النشر على السوشيال ميديا.

البرنامج نفسه هو اللي بيجدول، ولما ييجي ميعاد بوست بينادي publish().
الربط الفعلي مع المنصات هيتعمل عن طريق خدمة وسيطة (Ayrshare أو Late أو Postiz)
لما نختارها. لحد كده:
- PUBLISH_MOCK=1: بيعتبر البوست اتنشر (للتجربة).
- غير كده: البوست بيفشل برسالة واضحة إن مفيش خدمة مربوطة.
"""

import os
from pathlib import Path

PLATFORMS = {
    "tiktok": "تيك توك",
    "instagram": "إنستجرام",
    "youtube": "يوتيوب شورتس",
    "snapchat": "سناب شات",
    "facebook": "فيسبوك",
    "x": "X (تويتر)",
}


class PublishError(Exception):
    pass


def service_name() -> str | None:
    """اسم خدمة النشر المربوطة، أو None لو لسه مفيش."""
    if os.environ.get("PUBLISH_MOCK") == "1":
        return "mock"
    return None


def publish(video: Path, caption: str, platforms: list[str]) -> dict:
    service = service_name()
    if service == "mock":
        return {"mock": True, "platforms": platforms}
    raise PublishError("لسه مفيش خدمة نشر مربوطة بالبرنامج، فالبوست متنشرش. اربط خدمة ودوس إعادة المحاولة")
