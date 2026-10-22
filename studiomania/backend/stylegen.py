"""🎨 «+ إضافة أسلوب» (داخل «الأسلوب» في عقل العلامة): أسلوب خاص بالعلامة يستنبطه العقل.

تدّيله رابط صفحة (موقع أو منشور) أو صور وفيديوهات ستوك وألوان، وهو يُخرج منها أسلوب الرسم (غير موضوعها):
اسم، ووصف بالإنجليزية يوضع في أوصاف الصور والفيديو، وألوان. الصورة الأولى (أو سكرين شوت الصفحة) تصبح الكفر.
"""
from __future__ import annotations

import re
import uuid
from collections import Counter

HEX = re.compile(r"#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
ICONS = ["🎨", "🖌️", "✨", "🌈", "🖼️", "🧩", "🎞️", "💫"]


def page_assets(html: str, base: str) -> tuple[list[str], list[str]]:
    """من HTML الصفحة: صور المشاركة والصور الكبيرة، والألوان الذي متكررة في الـCSS."""
    from urllib.parse import urljoin
    imgs = re.findall(r'<meta[^>]+(?:property|name)=["\'](?:og:image|twitter:image)["\'][^>]+content=["\']([^"\']+)', html, re.I)
    imgs += re.findall(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\'](?:og:image|twitter:image)', html, re.I)
    imgs += [m for m in re.findall(r'<img[^>]+src=["\']([^"\']+)', html, re.I) if not re.search(r"(sprite|icon|logo|pixel|\.svg|data:)", m, re.I)]
    seen, out = set(), []
    for u in imgs:
        u = urljoin(base, u.strip())
        if u.startswith("http") and u not in seen:
            seen.add(u)
            out.append(u)
    return out[:6], colors_of(html)


def colors_of(text: str, n: int = 6) -> list[str]:
    c = Counter()
    for h in HEX.findall(text or ""):
        h = h.lower()
        if len(h) == 4:
            h = "#" + "".join(ch * 2 for ch in h[1:])
        if h not in ("#ffffff", "#000000"):
            c[h] += 1
    return [h for h, _ in c.most_common(n)]


def messages_text(n_imgs: int, colors: list[str], note: str, page: str) -> str:
    return f"""You are an art director. Look at the {n_imgs} reference image(s){" (screenshots and frames of a page/video)" if page else ""} and extract ONLY the visual style
(rendering technique, medium, line, texture, lighting, color treatment, composition, camera/motion feel) — NOT the subject, people, text or brand names in them.
Colors the user picked: {", ".join(colors) or "-"}
User note: {note or "-"}
{f"Page text (for context only): {page[:1500]}" if page else ""}

Return JSON only:
{{"ar": "short Arabic style name (2-4 words)", "en": "short English name",
  "prompt": "one English sentence usable as a style prompt for image/video generation, specific and reproducible (medium, technique, palette, light, texture). No subject, no brand names, no real people.",
  "look": "one Egyptian Arabic sentence describing the look for the user",
  "palette": ["#hex", "... 3-6 colors from the references"]}}"""


def clean(raw: dict, colors: list[str]) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    pal = [str(x).lower() for x in raw.get("palette") or [] if HEX.fullmatch(str(x).strip())][:6]
    prompt = str(raw.get("prompt") or "").strip()[:600]
    if not prompt:
        raise ValueError("العقل ما عرفش يُخرج أسلوب من هذه المراجع، جرّب صور أوضح")
    return {"ar": str(raw.get("ar") or "ستايلي").strip()[:40], "en": str(raw.get("en") or "My style").strip()[:40],
            "prompt": prompt, "look": str(raw.get("look") or "").strip()[:300], "palette": pal or colors[:6]}


def mock(colors: list[str], note: str) -> dict:
    return {"ar": "أسلوب العلامة", "en": "Brand style", "look": "رسم فلات بخطوط ناعمة وألوان دافية وإضاءة هادية",
            "prompt": "flat illustrated look, soft rounded shapes, warm muted palette, gentle grain texture, soft diffuse light"
                      + (f", {note}" if note else ""), "palette": colors[:6] or ["#f2a65a", "#2d3047", "#f7f4ea"]}


def new_item(name: str = "") -> dict:
    return {"id": "my-" + uuid.uuid4().hex[:8], "ar": name.strip()[:40] or "أسلوب جديد", "en": "", "prompt": "", "look": "",
            "palette": [], "cover": "", "status": "working", "error": None, "icon": ICONS[uuid.uuid4().int % len(ICONS)]}
