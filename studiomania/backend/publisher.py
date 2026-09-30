"""الخطوة 7: النشر على السوشيال ميديا عن طريق Zernio (اسمها القديم Late).

أول ما تجدول بوست، البرنامج بيرفع الفيديو لـ Zernio ويسلّمها البوست بميعاده،
وZernio هي اللي بتنشر في الميعاد، فالجهاز مش لازم يكون مفتوح وقتها.
الطريقة مأخوذة من المستودع الرسمي getlate-dev/late-api.

- ZERNIO_API_KEY في .env: النشر الحقيقي.
- PUBLISH_MOCK=1: البرنامج بيعتبر البوست اتنشر في ميعاده (للتجربة).
- ولا ده ولا ده: البوستات بتتجدول جوه البرنامج، وتتبعت لـ Zernio أول ما المفتاح يتضاف.
"""

import mimetypes
import os
import time
from pathlib import Path

import httpx

BASE_URL = os.environ.get("ZERNIO_BASE_URL", "https://zernio.com/api/v1")
DASHBOARD_URL = "https://zernio.com/dashboard"

# اسم المنصة عندنا ← (الاسم عند Zernio، الاسم بالعربي)
PLATFORMS = {
    "tiktok": ("tiktok", "تيك توك"),
    "instagram": ("instagram", "إنستجرام"),
    "youtube": ("youtube", "يوتيوب شورتس"),
    "facebook": ("facebook", "صفحة فيسبوك"),
    "x": ("twitter", "X (تويتر)"),
}


class PublishError(Exception):
    pass


def service_name() -> str | None:
    if os.environ.get("PUBLISH_MOCK") == "1":
        return "mock"
    if api_key():
        return "zernio"
    return None


def api_key() -> str | None:
    return os.environ.get("ZERNIO_API_KEY") or os.environ.get("LATE_API_KEY")


def _client(timeout: float = 60) -> httpx.Client:
    return httpx.Client(timeout=timeout, headers={"Authorization": f"Bearer {api_key()}"})


def _check(resp: httpx.Response, what: str):
    try:
        data = resp.json()
    except ValueError:
        data = resp.text[:200]
    if resp.status_code >= 400:
        detail = data.get("error") or data.get("message") if isinstance(data, dict) else data
        raise PublishError(f"{what}: HTTP {resp.status_code}: {str(detail or data)[:300]}")
    return data


# ---------------------------------------------------------------- الحسابات المربوطة

_accounts_cache: tuple[float, dict] | None = None


def accounts(refresh: bool = False) -> dict:
    """الحسابات المربوطة في Zernio: {منصة عندنا: {"id", "name"}}."""
    global _accounts_cache
    if not refresh and _accounts_cache and time.monotonic() - _accounts_cache[0] < 300:
        return _accounts_cache[1]
    with _client(30) as c:
        data = _check(c.get(f"{BASE_URL}/accounts"), "قراءة الحسابات")
    items = data.get("accounts", data.get("data", [])) if isinstance(data, dict) else data
    reverse = {remote: ours for ours, (remote, _) in PLATFORMS.items()}
    found: dict = {}
    for a in items or []:
        ours = reverse.get(str(a.get("platform", "")).lower())
        if ours and ours not in found and a.get("isActive", True) is not False:
            found[ours] = {
                "id": a.get("_id") or a.get("id"),
                "name": a.get("displayName") or a.get("username") or a.get("name") or "",
            }
    _accounts_cache = (time.monotonic(), found)
    return found


# ---------------------------------------------------------------- رفع الفيديو وتسليم البوست


def presign_urls(data) -> tuple[str | None, str | None]:
    """لينك الرفع ولينك الفيديو بعد الرفع. Zernio بيسمّي التاني publicUrl (وقبل كده fileUrl)."""
    if isinstance(data, dict) and isinstance(data.get("data"), dict):
        data = data["data"]
    if not isinstance(data, dict):
        return None, None
    upload_url = data.get("uploadUrl") or data.get("upload_url")
    file_url = next(
        (data[k] for k in ("publicUrl", "public_url", "fileUrl", "file_url", "mediaUrl", "url") if isinstance(data.get(k), str)),
        None,
    )
    if not file_url:
        # أي لينك تاني في الرد غير لينك الرفع
        file_url = next(
            (v for k, v in data.items() if isinstance(v, str) and v.startswith("http") and v != upload_url and k.lower().endswith("url")),
            None,
        )
    return upload_url, file_url


def upload_video(path: Path) -> str:
    content_type = mimetypes.guess_type(path.name)[0] or "video/mp4"
    with _client() as c:
        data = _check(
            c.post(f"{BASE_URL}/media/presign", json={"filename": path.name, "contentType": content_type}),
            "تجهيز رفع الفيديو",
        )
    upload_url, file_url = presign_urls(data)
    if not upload_url or not file_url:
        raise PublishError(f"تجهيز رفع الفيديو: رد غير متوقع (الحقول: {', '.join(map(str, data)) if isinstance(data, dict) else type(data).__name__})")
    with path.open("rb") as f, httpx.Client(timeout=900) as c:
        resp = c.put(upload_url, content=f, headers={"Content-Type": content_type})
    if resp.status_code >= 400:
        raise PublishError(f"رفع الفيديو: HTTP {resp.status_code}")
    return file_url


def schedule(
    video: Path, caption: str, platforms: list[str], when_utc: str, title: str, ai_made: bool, publish_now: bool,
    options: dict | None = None,
) -> str:
    """يرفع الفيديو ويسلّم البوست لـ Zernio، ويرجّع رقم البوست عندهم."""
    linked = accounts(refresh=True)
    missing = [PLATFORMS[p][1] for p in platforms if p not in linked]
    if missing:
        raise PublishError(f"الحسابات دي مش مربوطة في Zernio: {'، '.join(missing)}. اربطها من {DASHBOARD_URL}")

    opts = options or {}
    url = upload_video(video)
    entries = []
    for p in platforms:
        entry = {"platform": PLATFORMS[p][0], "accountId": linked[p]["id"]}
        if p == "tiktok":
            entry["platformSpecificData"] = {
                "privacyLevel": "PUBLIC_TO_EVERYONE",
                "allowComment": True,
                "allowDuet": True,
                "allowStitch": True,
                "contentPreviewConfirmed": True,
                "expressConsentGiven": True,
                "videoMadeWithAi": ai_made,
            }
            if opts.get("cover_ms") is not None:
                entry["platformSpecificData"]["videoCoverTimestampMs"] = opts["cover_ms"]
        elif p == "instagram":
            data = {}
            tags = opts.get("ig_tags") or []
            if tags:
                # في الريلز إنستجرام بيتجاهل المكان (x و y) وبيحط التاج على الفيديو كله
                data["userTags"] = [{"username": t, "x": 0.5, "y": 0.5} for t in tags]
                if opts.get("ig_collab"):
                    data["collaborators"] = tags[:3]
            if opts.get("cover_ms") is not None:
                data["thumbOffset"] = opts["cover_ms"]
            if data:
                entry["platformSpecificData"] = data
        elif p == "youtube":
            entry["platformSpecificData"] = {
                "title": title[:100],
                "visibility": "public",
                "containsSyntheticMedia": ai_made,
            }
        entries.append(entry)

    body = {"content": caption, "platforms": entries, "mediaItems": [{"type": "video", "url": url}]}
    if publish_now:
        body["publishNow"] = True
    else:
        body["scheduledFor"] = when_utc
    with _client() as c:
        data = _check(c.post(f"{BASE_URL}/posts", json=body), "تسليم البوست")
    post = data.get("post", data) if isinstance(data, dict) else {}
    remote_id = post.get("_id") or post.get("id")
    if not remote_id:
        raise PublishError(f"تسليم البوست: الرد مفيهوش رقم البوست: {str(data)[:200]}")
    return remote_id


def cancel(remote_id: str) -> None:
    with _client(30) as c:
        resp = c.delete(f"{BASE_URL}/posts/{remote_id}")
    if resp.status_code != 404:
        _check(resp, "إلغاء البوست")


def list_posts(status: str, limit: int = 100) -> list[dict]:
    """بوستات Zernio بحالة معيّنة، بشكل موحّد:
    [{"id", "status", "content", "scheduled_for", "published_at", "media_url",
      "platforms": [{"key" (عندنا), "status", "url", "error", "published_at"}]}]"""
    with _client(30) as c:
        data = _check(c.get(f"{BASE_URL}/posts", params={"status": status, "limit": limit}), "قراءة البوستات من Zernio")
    items = data.get("posts", data.get("data", [])) if isinstance(data, dict) else data
    reverse = {remote: ours for ours, (remote, _) in PLATFORMS.items()}
    out = []
    for post in items or []:
        if not isinstance(post, dict):
            continue
        pid = post.get("_id") or post.get("id")
        if not pid:
            continue
        media = next((m.get("url") for m in post.get("mediaItems") or [] if isinstance(m, dict) and m.get("url")), None)
        plats = []
        for pl in post.get("platforms") or []:
            name = str(pl.get("platform") if isinstance(pl, dict) else pl).lower()
            if name not in reverse:
                continue
            info = pl if isinstance(pl, dict) else {}
            plats.append({
                "key": reverse[name],
                "status": str(info.get("status") or post.get("status") or "").lower(),
                "url": info.get("platformPostUrl") or info.get("postUrl") or info.get("url"),
                "error": info.get("errorMessage") or info.get("error"),
                "published_at": info.get("publishedAt"),
            })
        out.append({
            "id": str(pid), "status": str(post.get("status") or status).lower(), "content": post.get("content") or "",
            "scheduled_for": post.get("scheduledFor"), "published_at": post.get("publishedAt"),
            "media_url": media, "platforms": plats,
        })
    return out


def list_scheduled() -> list[dict]:
    """البوستات المتجدولة عند Zernio (الشكل القديم اللي بتستخدمه مقارنة القايمة)."""
    return [
        {"id": p["id"], "content": p["content"], "scheduled_for": p["scheduled_for"],
         "platforms": list(dict.fromkeys(x["key"] for x in p["platforms"])), "media_url": p["media_url"]}
        for p in list_posts("scheduled") if p["status"] == "scheduled"
    ]


def retry(remote_id: str) -> None:
    with _client(30) as c:
        _check(c.post(f"{BASE_URL}/posts/{remote_id}/retry"), "إعادة المحاولة")


def remote_status(remote_id: str) -> tuple[str, str | None]:
    """يرجّع (published | failed | pending, رسالة الخطأ لو فيه)."""
    with _client(30) as c:
        data = _check(c.get(f"{BASE_URL}/posts/{remote_id}"), "متابعة البوست")
    post = data.get("post", data) if isinstance(data, dict) else {}
    status = str(post.get("status", "")).lower()
    errors = []
    for p in post.get("platforms") or []:
        if str(p.get("status", "")).lower() == "failed":
            name = next((v[1] for v in PLATFORMS.values() if v[0] == p.get("platform")), p.get("platform"))
            errors.append(f"{name}: {p.get('errorMessage') or p.get('error') or 'فشل'}")
    if status in ("published", "completed"):
        return "published", None
    if status in ("failed", "partial", "partially_published"):
        return "failed", "، ".join(errors) or "فشل النشر"
    return "pending", None
