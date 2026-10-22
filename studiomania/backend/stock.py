"""📚 مكتبة صور وفيديوهات حقيقية (متصوّرة، مش متولّدة) للخلفيات، من Pexels.

- المفتاح PEXELS_API_KEY (من الإعدادات ← المفاتيح، أو Railway).
- شرطهم: لينك واضح لـ Pexels جنب النتايج، واسم المصوّر لو ينفع (بنحفظه مع الخلفية).
- الحد: ٢٠٠ طلب في الساعة، فالنتايج بتتحفظ شوية في الذاكرة.
"""
from __future__ import annotations

import os
import re
import time
from urllib.parse import urlparse

import httpx

API = "https://api.pexels.com"
_CACHE: dict[tuple, tuple[float, dict]] = {}
TTL = 30 * 60


class StockError(Exception):
    pass


def key() -> str:
    return os.environ.get("PEXELS_API_KEY", "").strip().strip("'\"").strip()


def live() -> bool:
    return bool(key())


def has_arabic(s: str) -> bool:
    return bool(re.search(r"[؀-ۿ]", s or ""))


def _get(path: str, params: dict) -> dict:
    ck = (path, tuple(sorted(params.items())))
    hit = _CACHE.get(ck)
    if hit and time.time() - hit[0] < TTL:
        return hit[1]
    try:
        r = httpx.get(API + path, params=params, headers={"Authorization": key()}, timeout=25)
    except httpx.HTTPError as exc:
        raise StockError("مكتبة الصور مش بترد دلوقتي، جرّب تاني") from exc
    if r.status_code in (401, 403):
        raise StockError("مفتاح Pexels مش شغال، راجعه في الإعدادات")
    if r.status_code == 429:
        raise StockError("وصلنا للحد بتاع مكتبة الصور في الساعة دي، جرّب بعد شوية")
    if r.status_code >= 400:
        raise StockError(f"مكتبة الصور رجّعت خطأ ({r.status_code})")
    data = r.json()
    _CACHE[ck] = (time.time(), data)
    if len(_CACHE) > 300:
        for k in sorted(_CACHE, key=lambda k: _CACHE[k][0])[:100]:
            _CACHE.pop(k, None)
    return data


def _best_file(files: list[dict], vertical: bool) -> dict | None:
    """أنسب نسخة للفيديو: HD (حوالي ١٠٨٠) مش 4K عشان التنزيل والرندر يبقوا سريعين."""
    mp4 = [f for f in files if (f.get("file_type") or "").endswith("mp4") and f.get("link")]
    if not mp4:
        return None
    side = lambda f: min(f.get("width") or 0, f.get("height") or 0)  # noqa: E731
    ok = [f for f in mp4 if 700 <= side(f) <= 1300] or mp4
    return min(ok, key=lambda f: abs(side(f) - 1080))


def search(q: str, kind: str = "video", orientation: str = "portrait", page: int = 1) -> dict:
    """بحث بالإنجليزي. بيرجّع نتايج موحّدة للصور والفيديو."""
    q = q.strip()[:100]
    if not q:
        return {"items": [], "next": False}
    p = {"query": q, "per_page": 24, "page": max(1, min(20, int(page)))}
    if orientation in ("portrait", "landscape", "square"):
        p["orientation"] = orientation
    vertical = orientation == "portrait"
    out = []
    if kind == "photo":
        d = _get("/v1/search", p)
        for ph in d.get("photos") or []:
            src = ph.get("src") or {}
            out.append({"id": f"p{ph['id']}", "kind": "image", "w": ph.get("width"), "h": ph.get("height"),
                        "thumb": src.get("medium") or src.get("small"), "preview": src.get("large"),
                        "file": src.get("large2x") or src.get("original"), "author": ph.get("photographer") or "",
                        "author_url": ph.get("photographer_url") or "", "page": ph.get("url") or "", "alt": ph.get("alt") or ""})
    else:
        d = _get("/videos/search", p)
        for v in d.get("videos") or []:
            f = _best_file(v.get("video_files") or [], vertical)
            if not f:
                continue
            small = min((x for x in v.get("video_files") or [] if (x.get("file_type") or "").endswith("mp4") and x.get("link")),
                        key=lambda x: (x.get("width") or 9999) * (x.get("height") or 9999), default=f)
            user = v.get("user") or {}
            out.append({"id": f"v{v['id']}", "kind": "video", "w": v.get("width"), "h": v.get("height"), "dur": v.get("duration"),
                        "thumb": v.get("image"), "preview": small.get("link"), "file": f.get("link"),
                        "author": user.get("name") or "", "author_url": user.get("url") or "", "page": v.get("url") or ""})
    return {"items": out, "next": bool(d.get("next_page"))}


def allowed_url(u: str) -> bool:
    """بننزّل بس من سيرفرات Pexels (عشان محدش يبعت لينك تاني ينزّله على السيرفر)."""
    p = urlparse(u or "")
    return p.scheme == "https" and p.hostname in ("images.pexels.com", "videos.pexels.com", "player.vimeo.com")


# 🎵 موسيقى من Openverse (من غير مفتاح): بس اللي رخصته تسمح بالاستخدام التجاري، ومعاها اسم صاحبها ورخصتها
OV_API = "https://api.openverse.org/v1/audio/"
AUDIO_EXT = ("mp3", "wav", "ogg", "flac", "m4a")


def music_search(q: str) -> list[dict]:
    q = " ".join((q or "").split())[:100]
    if not q:
        return []
    ck = ("ov", q)
    hit = _CACHE.get(ck)
    if hit and time.time() - hit[0] < TTL:
        return hit[1]["items"]
    try:
        r = httpx.get(OV_API, params={"q": q, "page_size": 20, "license_type": "commercial", "category": "music", "mature": "false"},
                      headers={"User-Agent": "SimsimKit/1.0"}, timeout=25)
    except httpx.HTTPError as exc:
        raise StockError("مكتبة الموسيقى مش بترد دلوقتي، جرّب تاني") from exc
    if r.status_code == 429:
        raise StockError("وصلنا للحد بتاع مكتبة الموسيقى دلوقتي، جرّب بعد شوية")
    if r.status_code >= 400:
        raise StockError(f"مكتبة الموسيقى رجّعت خطأ ({r.status_code})")
    out = []
    for a in r.json().get("results") or []:
        u = a.get("url") or ""
        dur = (a.get("duration") or 0) / 1000
        if not u.startswith("https://") or (dur and dur < 15):
            continue
        ext = (a.get("filetype") or "mp3").lower()
        out.append({"id": f"a{a.get('id')}", "kind": "audio", "file": u, "title": a.get("title") or "", "author": a.get("creator") or "",
                    "author_url": a.get("creator_url") or "", "page": a.get("foreign_landing_url") or "", "dur": dur or None,
                    "license": f"{a.get('license') or ''} {a.get('license_version') or ''}".strip(), "ext": ext if ext in AUDIO_EXT else "mp3"})
    _CACHE[ck] = (time.time(), {"items": out})
    return out
