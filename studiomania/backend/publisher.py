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
import uuid
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
    "linkedin": ("linkedin", "لينكدإن"),
    "threads": ("threads", "ثريدز"),
    "pinterest": ("pinterest", "بنترست"),
    "reddit": ("reddit", "ريديت"),
    "bluesky": ("bluesky", "بلوسكاي"),
    "snapchat": ("snapchat", "سناب شات"),
    "googlebusiness": ("googlebusiness", "جوجل بيزنس"),
    "telegram": ("telegram", "تيليجرام"),
}
# دول بيتربطوا بطريقة غير تسجيل الدخول (باسورد تطبيق / بوت)، فبيتربطوا من لوحة Zernio نفسها
DASHBOARD_ONLY = {"bluesky", "telegram"}


def split_target(t: str) -> tuple[str, str | None]:
    """«tiktok» = أول حساب تيك توك مربوط · «tiktok@<id>» = حساب معيّن (لو عندك أكتر من حساب على نفس المنصة)."""
    p, _, acc = str(t).partition("@")
    return p, (acc or None)


def valid_target(t: str) -> bool:
    return split_target(t)[0] in PLATFORMS


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


# ---------------------------------------------------------------- 🔒 كل عميل ليه بروفايل لوحده عند Zernio
# البوابة بتدّي كل نسخة عميل ZERNIO_PROFILE_NAME (بروفايل بيتعمل لو مش موجود)، وصاحب البرنامج ZERNIO_PROFILE_ID.
# من غيرهم (البرنامج شغال لوحده من غير بوابة) كل الحسابات بتاعتك زي الأول.

_profile_id: str | None = None


def scoped() -> bool:
    return bool(os.environ.get("ZERNIO_PROFILE_ID") or os.environ.get("ZERNIO_PROFILE_NAME"))


def tenant_profile() -> str | None:
    global _profile_id
    if os.environ.get("ZERNIO_PROFILE_ID"):
        return os.environ["ZERNIO_PROFILE_ID"]
    name = os.environ.get("ZERNIO_PROFILE_NAME")
    if not name:
        return None
    if _profile_id:
        return _profile_id
    with _client(30) as c:
        data = _check(c.get(f"{BASE_URL}/profiles"), "قراءة البروفايلات")
        items = data.get("profiles", data.get("data", [])) if isinstance(data, dict) else data
        hit = next((x for x in items or [] if x.get("name") == name), None)
        if not hit:
            hit = _check(c.post(f"{BASE_URL}/profiles", json={"name": name}), "عمل بروفايل")
            hit = hit.get("profile", hit) if isinstance(hit, dict) else {}
    _profile_id = hit.get("_id") or hit.get("id")
    return _profile_id


def _pid(x) -> str | None:
    v = x.get("profileId") if isinstance(x, dict) else None
    if isinstance(v, dict):
        v = v.get("_id") or v.get("id")
    return str(v) if v else None


def mine(account_id: str | None) -> bool:
    """الحساب ده بتاع العميل ده؟ (لو مفيش بروفايلات، كل الحسابات بتاعتك)."""
    if not scoped():
        return True
    return bool(account_id) and any(a["id"] == account_id for a in account_list())


def require_mine(account_id: str | None) -> None:
    if not mine(account_id):
        raise PublishError("الحساب ده مش مربوط عندك")


# ---------------------------------------------------------------- الحسابات المربوطة

_accounts_cache: tuple[float, list] | None = None


def account_list(refresh: bool = False) -> list[dict]:
    """كل الحسابات المربوطة في Zernio (ممكن أكتر من حساب على نفس المنصة)."""
    global _accounts_cache
    if not refresh and _accounts_cache and time.monotonic() - _accounts_cache[0] < 300:
        return _accounts_cache[1]
    params = {"excludeHidden": "true"}
    prof = tenant_profile()
    if prof:
        params["profileId"] = prof
    with _client(30) as c:
        data = _check(c.get(f"{BASE_URL}/accounts", params=params), "قراءة الحسابات")
    items = data.get("accounts", data.get("data", [])) if isinstance(data, dict) else data
    if prof:   # لو Zernio رجّع حسابات بروفايلات تانية، بنشيلها
        items = [a for a in items or [] if _pid(a) in (None, prof)] if any(_pid(a) for a in items or []) else items
    reverse = {remote: ours for ours, (remote, _) in PLATFORMS.items()}
    out = []
    for a in items or []:
        ours = reverse.get(str(a.get("platform", "")).lower())
        if not ours or a.get("isActive", True) is False or a.get("enabled", True) is False:
            continue
        out.append({
            "id": a.get("_id") or a.get("id"),
            "platform": ours,
            "name": a.get("displayName") or a.get("username") or a.get("name") or "",
            "username": a.get("username") or "",
            "avatar": a.get("profilePicture") or None,
            "url": a.get("profileUrl") or None,
            "needs_reconnect": bool(a.get("needsReconnection")),
        })
    _accounts_cache = (time.monotonic(), out)
    return out


def accounts(refresh: bool = False) -> dict:
    """أول حساب مربوط لكل منصة: {منصة عندنا: {"id", "name"}} (للكود القديم والنشر من غير اختيار حساب)."""
    found: dict = {}
    for a in account_list(refresh):
        found.setdefault(a["platform"], {"id": a["id"], "name": a["name"]})
    return found


def resolve_targets(targets: list[str]) -> list[tuple[str, str]]:
    """كل هدف ← (منصة، رقم الحساب). لو الحساب المختار اتفصل أو المنصة مش مربوطة بيقول بالظبط إيه الناقص."""
    lst = account_list(refresh=True)
    ids = {a["id"]: a for a in lst}
    out, missing = [], []
    for t in targets:
        p, acc = split_target(t)
        if acc:
            if acc in ids and ids[acc]["platform"] == p:
                out.append((p, acc))
            else:
                missing.append(f"{PLATFORMS.get(p, (p, p))[1]} (الحساب اللي اخترته اتفصل)")
        else:
            first = next((a for a in lst if a["platform"] == p), None)
            if first:
                out.append((p, first["id"]))
            else:
                missing.append(PLATFORMS.get(p, (p, p))[1])
    if missing:
        raise PublishError(f"الحسابات دي مش مربوطة في Zernio: {'، '.join(missing)}. اربطها من صفحة النشر")
    return list(dict.fromkeys(out))


# ---------------------------------------------------------------- ربط وفصل الحسابات من جوه البرنامج

def default_profile() -> str:
    """البروفايل (فولدر الحسابات) عند Zernio: بتاع العميل لو فيه بوابة، وإلا الأول، ولو مفيش بنعمل واحد."""
    if (prof := tenant_profile()):
        return prof
    with _client(30) as c:
        data = _check(c.get(f"{BASE_URL}/profiles"), "قراءة البروفايلات")
        items = data.get("profiles", data.get("data", [])) if isinstance(data, dict) else data
        if items:
            return items[0].get("_id") or items[0].get("id")
        made = _check(c.post(f"{BASE_URL}/profiles", json={"name": "StudioMania"}), "عمل بروفايل")
    made = made.get("profile", made) if isinstance(made, dict) else {}
    return made.get("_id") or made.get("id")


def connect_url(platform: str, redirect_url: str) -> str:
    """لينك تسجيل الدخول على المنصة؛ بعد ما العميل يوافق Zernio بيرجّعه للبرنامج (ولو محتاج يختار صفحة/بورد بيختار عند Zernio)."""
    if platform not in PLATFORMS:
        raise PublishError("منصة مش معروفة")
    with _client(30) as c:
        data = _check(c.get(f"{BASE_URL}/connect/{PLATFORMS[platform][0]}",
                            params={"profileId": default_profile(), "redirect_url": redirect_url}), "تجهيز الربط")
    url = data.get("authUrl") or data.get("url") if isinstance(data, dict) else None
    if not url:
        raise PublishError(f"تجهيز الربط: رد غير متوقع: {str(data)[:200]}")
    global _accounts_cache
    _accounts_cache = None
    return url


def disconnect(account_id: str) -> None:
    global _accounts_cache
    require_mine(account_id)
    with _client(30) as c:
        resp = c.delete(f"{BASE_URL}/accounts/{account_id}")
    if resp.status_code != 404:
        _check(resp, "فصل الحساب")
    _accounts_cache = None


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
    return upload_file(path)


def upload_file(path: Path) -> str:
    """بيرفع ملف (فيديو أو صورة) لـ Zernio ويرجّع اللينك بتاعه."""
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
    targets = resolve_targets(platforms)
    opts = options or {}
    url = upload_video(video)
    entries = []
    first_line = (caption.strip().split("\n")[0] or title)[:100]
    for p, acc in targets:
        entry = {"platform": PLATFORMS[p][0], "accountId": acc}
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
        elif p == "pinterest":
            entry["platformSpecificData"] = {"title": first_line, **({"isAiGenerated": True} if ai_made else {})}
        elif p == "reddit":
            entry["platformSpecificData"] = {"title": (title or first_line)[:300]}
        elif p == "snapchat":
            entry["platformSpecificData"] = {"contentType": "spotlight"}   # الفيديوهات القصيرة على Spotlight (مش ستوري بتختفي)
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


def schedule_carousel(images: list[Path], caption: str, when_utc: str, publish_now: bool, options: dict | None = None,
                      targets: list[str] | None = None) -> str:
    """كاروسيل صور على إنستجرام (لحد 10 صور). إنستجرام مش بيقبل موسيقى على الكاروسيل من الـ API."""
    ig = [t for t in (targets or []) if split_target(t)[0] == "instagram"] or ["instagram"]
    ig_targets = resolve_targets(ig)
    if not 2 <= len(images) <= 10:
        raise PublishError("الكاروسيل لازم يكون من 2 لـ 10 صور")
    opts = options or {}
    urls = [upload_file(p) for p in images]
    data = {}
    tags = opts.get("ig_tags") or []
    if tags:
        # التاج على السلايد اللي اختاره (mediaIndex بيبدأ من صفر)، تحت في النص
        index = min(max(int(opts.get("tag_slide") or 1), 1), len(urls)) - 1
        data["userTags"] = [{"username": t, "x": 0.5, "y": 0.85, "mediaIndex": index} for t in tags]
        if opts.get("ig_collab"):
            data["collaborators"] = tags[:3]
    entries = []
    for _, acc in ig_targets:
        entry = {"platform": "instagram", "accountId": acc}
        if data:
            entry["platformSpecificData"] = data
        entries.append(entry)
    body = {"content": caption, "platforms": entries, "mediaItems": [{"type": "image", "url": u} for u in urls]}
    if publish_now:
        body["publishNow"] = True
    else:
        body["scheduledFor"] = when_utc
    with _client() as c:
        data = _check(c.post(f"{BASE_URL}/posts", json=body), "تسليم الكاروسيل")
    post = data.get("post", data) if isinstance(data, dict) else {}
    remote_id = post.get("_id") or post.get("id")
    if not remote_id:
        raise PublishError(f"تسليم الكاروسيل: الرد مفيهوش رقم البوست: {str(data)[:200]}")
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
    params = {"status": status, "limit": limit}
    if (prof := tenant_profile()):
        params["profileId"] = prof
    with _client(30) as c:
        data = _check(c.get(f"{BASE_URL}/posts", params=params), "قراءة البوستات من Zernio")
    items = data.get("posts", data.get("data", [])) if isinstance(data, dict) else data
    if scoped():   # بس البوستات اللي على حسابات العميل ده
        ids = {a["id"] for a in account_list()}

        def acc(pl):
            v = pl.get("accountId") if isinstance(pl, dict) else None
            return str(v.get("_id") or v.get("id")) if isinstance(v, dict) else str(v or "")
        items = [p for p in items or [] if isinstance(p, dict) and any(acc(pl) in ids for pl in p.get("platforms") or [])]
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


# ---------------------------------------------------------------- 💬 صندوق الكومنتات والرسايل (Inbox)
# محتاج إضافة «Inbox» في اشتراك Zernio. الرسايل (DM): إنستجرام، فيسبوك، X وغيرهم، مش تيك توك.
# قايمة البوستات اللي عليها كومنتات Zernio بيحدّثها كل 10 دقايق بالكتير.

INBOX_ADDON_MSG = "صندوق الردود محتاج إضافة «Inbox» في اشتراك Zernio. فعّلها من لوحة Zernio وارجع هنا"


def _inbox_check(resp: httpx.Response, what: str):
    if resp.status_code == 403 and "inbox" in resp.text.lower():
        raise PublishError(INBOX_ADDON_MSG)
    return _check(resp, what)


def _failed(meta: dict | None) -> list[str]:
    """الحسابات اللي Zernio مقدرش يقرا منها (حد أقصى للطلبات أو الربط باظ)."""
    out = []
    for f in (meta or {}).get("failedAccounts") or []:
        out.append(f"{f.get('platform') or ''} {('@' + f['accountUsername']) if f.get('accountUsername') else ''}: {f.get('error') or ''}".strip())
    return out


def inbox_posts(limit: int = 50, cursor: str | None = None) -> dict:
    """البوستات اللي عليها كومنتات (من كل الحسابات)، الأحدث الأول."""
    params = {"limit": limit, "minComments": 1, "sortBy": "date", "sortOrder": "desc"}
    if cursor:
        params["cursor"] = cursor
    with _client() as c:
        data = _inbox_check(c.get(f"{BASE_URL}/inbox/comments", params=params), "قراءة البوستات اللي عليها كومنتات")
    rows = [p for p in data.get("data") or [] if mine(p.get("accountId"))]
    posts = [{
        "id": p.get("id"), "platform": p.get("platform"), "account_id": p.get("accountId"),
        "account": p.get("accountUsername"), "content": p.get("content") or "", "picture": p.get("picture"),
        "url": p.get("permalink"), "created_at": p.get("createdTime"), "comments": p.get("commentCount") or 0,
        "likes": p.get("likeCount") or 0,
    } for p in rows]
    page = data.get("pagination") or {}
    return {"posts": posts, "next": page.get("nextCursor") if page.get("hasMore") else None, "failed": _failed(data.get("meta"))}


def _comment(x: dict) -> dict:
    who = x.get("from") or {}
    return {
        "id": x.get("id"), "text": x.get("message") or "", "created_at": x.get("createdTime"),
        "name": who.get("name") or who.get("username") or "", "username": who.get("username"),
        "picture": who.get("picture"), "mine": bool(who.get("isOwner")), "likes": x.get("likeCount") or 0,
        "can_reply": x.get("canReply", True), "hidden": bool(x.get("isHidden")), "url": x.get("url"),
        "replies": [_comment(r) for r in x.get("replies") or []],
    }


def inbox_comments(post_id: str, account_id: str) -> list[dict]:
    require_mine(account_id)
    with _client() as c:
        data = _inbox_check(c.get(f"{BASE_URL}/inbox/comments/{post_id}", params={"accountId": account_id, "limit": 100}),
                            "قراءة الكومنتات")
    return [_comment(x) for x in data.get("comments") or []]


def inbox_reply_comment(post_id: str, account_id: str, message: str, comment_id: str | None) -> str:
    require_mine(account_id)
    body = {"accountId": account_id, "message": message}
    if comment_id:
        body["commentId"] = comment_id
    with _client() as c:
        # Idempotency-Key: لو الاتصال قطع وجربنا تاني، الرد مايتكررش
        data = _inbox_check(c.post(f"{BASE_URL}/inbox/comments/{post_id}", json=body,
                                   headers={"Idempotency-Key": uuid.uuid4().hex}), "إرسال الرد")
    return ((data or {}).get("data") or {}).get("commentId") or ""


def inbox_conversations(limit: int = 50, cursor: str | None = None) -> dict:
    params = {"limit": limit, "status": "active", "sortOrder": "desc"}
    if cursor:
        params["cursor"] = cursor
    with _client() as c:
        data = _inbox_check(c.get(f"{BASE_URL}/inbox/conversations", params=params), "قراءة الرسايل")
    convs = [{
        "id": x.get("id"), "platform": x.get("platform"), "account_id": x.get("accountId"), "account": x.get("accountUsername"),
        "name": x.get("participantName") or "", "picture": x.get("participantPicture"), "last": x.get("lastMessage") or "",
        "updated_at": x.get("updatedTime"), "unread": x.get("unreadCount") or 0, "url": x.get("url"),
        "request": x.get("folder") == "requests",
    } for x in data.get("data") or [] if mine(x.get("accountId"))]
    page = data.get("pagination") or {}
    return {"conversations": convs, "next": page.get("nextCursor") if page.get("hasMore") else None, "failed": _failed(data.get("meta"))}


def inbox_messages(conversation_id: str, account_id: str) -> list[dict]:
    require_mine(account_id)
    with _client() as c:
        data = _inbox_check(c.get(f"{BASE_URL}/inbox/conversations/{conversation_id}/messages",
                                  params={"accountId": account_id, "limit": 100, "sortOrder": "asc"}), "قراءة المحادثة")
    out = []
    for m in data.get("messages") or []:
        if m.get("isDeleted"):
            continue
        out.append({
            "id": m.get("id"), "text": m.get("message") or "", "mine": m.get("direction") == "outgoing",
            "name": m.get("senderName") or "", "created_at": m.get("createdAt"),
            "attachments": [{"type": a.get("type"), "url": a.get("previewUrl") or a.get("url")} for a in m.get("attachments") or []],
            "status": m.get("deliveryStatus"),
        })
    out.sort(key=lambda m: m["created_at"] or "")
    return out


def inbox_send(conversation_id: str, account_id: str, message: str) -> str:
    require_mine(account_id)
    with _client() as c:
        data = _inbox_check(c.post(f"{BASE_URL}/inbox/conversations/{conversation_id}/messages",
                                   json={"accountId": account_id, "message": message},
                                   headers={"Idempotency-Key": uuid.uuid4().hex}), "إرسال الرسالة")
    return ((data or {}).get("data") or {}).get("messageId") or ""


def inbox_mark_read(conversation_id: str, account_id: str) -> None:
    require_mine(account_id)
    with _client() as c:
        try:
            c.post(f"{BASE_URL}/inbox/conversations/{conversation_id}/read", json={"accountId": account_id})
        except httpx.HTTPError:
            pass  # مش مهم لو فشلت
