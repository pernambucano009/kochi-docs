"""الخطوة 7: النشر على السوشيال ميديا عن طريق Zernio (اسمها القديم Late).

أول ما تجدول منشور، البرنامج يرفع الفيديو لـ Zernio ويسلّمها المنشور بميعاده،
وZernio هي ما تنشر في الموعد، فالجهاز ليس ضروريًا يكون مفتوح وقتها.
الطريقة مأخوذة من المستودع الرسمي getlate-dev/late-api.

- ZERNIO_API_KEY في .env: النشر الحقيقي.
- PUBLISH_MOCK=1: البرنامج يعتبر المنشور نُشر في موعده (للتجربة).
- ولا هذا ولا هذا: المنشورات تتجدول داخل البرنامج، وتُرسل لـ Zernio أول ما المفتاح يُضاف.
"""

import mimetypes
import json
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
    "whatsapp": ("whatsapp", "واتساب بيزنس"),
}
# كل الربط بيحصل من جوه البرنامج: تسجيل الدخول على المنصة نفسها، وبعدها اختيار الصفحة/البورد/المكان عندنا (headless).
# دول بيتربطوا من غير تسجيل دخول: بلوسكاي (باسورد تطبيق)، تيليجرام (كود للبوت)، واتساب بيزنس (بيانات Meta)
CREDENTIALS = {"bluesky", "telegram", "whatsapp"}
SOON = {"snapchat": "سناب شات ما زال في تجربة مغلقة لدى المنصة، وسيُفتح قريبًا"}
NOT_FOR_POSTS = {"whatsapp"}   # واتساب للرسايل والرد على العملاء (الإنبوكس والبرودكاست)، مش لنشر الفيديوهات
# اختيار بعد تسجيل الدخول: الخطوة ← (المنصة، مسار القايمة، مسار الاختيار، اسم القايمة في الرد)
SELECT_STEPS = {
    "facebook": ("select-page", "select-page", "pages"),
    "instagram": ("select-account", "select-account", "pages"),
    "linkedin": ("organizations", "select-organization", "organizations"),
    "googlebusiness": ("locations", "select-location", "locations"),
    "pinterest": ("select-board", "select-board", "boards"),
}


def split_target(t: str) -> tuple[str, str | None]:
    """«tiktok» = أول حساب تيك توك مربوط · «tiktok@<id>» = حساب معيّن (إذا لديك أكثر من حساب على نفس المنصة)."""
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
        raw = f"{what}: HTTP {resp.status_code}: {str(detail or data)[:300]}"
        if os.environ.get("TENANT_ROLE") != "customer":
            raise PublishError(raw)
        # العميل مايشوفش رسالة المزوّد الخام: رسالة مفهومة، والخام في اللوج
        print(f"[publisher] {raw}", flush=True)
        raise PublishError(f"{what}: {friendly_status(resp.status_code)}")
    return data


def friendly_status(code: int) -> str:
    if code in (400, 422):
        return "بعض البيانات المطلوبة ناقصة أو غير صحيحة. راجع الحقول وحاول مجددًا"
    if code in (401, 403):
        return "الحساب المربوط يحتاج إعادة ربط من «حساباتك»"
    if code == 404:
        return "العنصر غير موجود لدى المنصة"
    if code == 429:
        return "طلبات كثيرة في وقت قصير. حاول بعد دقيقة"
    return "المنصة لا تستجيب الآن. حاول بعد قليل"


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
            hit = _check(c.post(f"{BASE_URL}/profiles", json={"name": name}), "إنشاء ملف تعريف")
            hit = hit.get("profile", hit) if isinstance(hit, dict) else {}
    _profile_id = hit.get("_id") or hit.get("id")
    return _profile_id


def _pid(x) -> str | None:
    v = x.get("profileId") if isinstance(x, dict) else None
    if isinstance(v, dict):
        v = v.get("_id") or v.get("id")
    return str(v) if v else None


def mine(account_id: str | None) -> bool:
    """هذا الحساب الخاص بـ هذا العميل؟ (إذا لا يوجد بروفايلات، كل الحسابات الخاصة بك)."""
    if not scoped():
        return True
    return bool(account_id) and any(a["id"] == account_id for a in account_list())


def require_mine(account_id: str | None) -> None:
    if not mine(account_id):
        raise PublishError("هذا الحساب غير مربوط لديك")


# ---------------------------------------------------------------- الحسابات المربوطة

_accounts_cache: tuple[float, list] | None = None


def account_list(refresh: bool = False) -> list[dict]:
    """كل الحسابات المربوطة في Zernio (يمكن أكثر من حساب على نفس المنصة)."""
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
    if prof:
        # 🔒 كل عميل يشوف حسابات البروفايل بتاعه بس. الحساب اللي مش معروف بروفايله مايظهرش (لو Zernio تجاهل الفلتر
        # ورجّع كل الحسابات، حسابات صاحب البرنامج الشخصية ماتوصلش لأي عميل)
        dropped = [a for a in items or [] if _pid(a) != prof]
        items = [a for a in items or [] if _pid(a) == prof]
        if dropped and not os.environ.get("ZERNIO_PROFILE_ID"):
            print(f"[publisher] {len(dropped)} account(s) outside profile {prof} hidden", flush=True)
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
    """أول حساب مربوط لكل منصة: {منصة لدينا: {"id", "name"}} (للكود القديم والنشر بدون اختيار حساب)."""
    found: dict = {}
    for a in account_list(refresh):
        found.setdefault(a["platform"], {"id": a["id"], "name": a["name"]})
    return found


def resolve_targets(targets: list[str]) -> list[tuple[str, str]]:
    """كل هدف ← (منصة، رقم الحساب). إذا الحساب المختار اتفصل أو المنصة غير مربوطة يقول بالضبط ماذا الناقص."""
    lst = account_list(refresh=True)
    ids = {a["id"]: a for a in lst}
    out, missing = [], []
    for t in targets:
        p, acc = split_target(t)
        if acc:
            if acc in ids and ids[acc]["platform"] == p:
                out.append((p, acc))
            else:
                missing.append(f"{PLATFORMS.get(p, (p, p))[1]} (الحساب الذي اخترته اتفصل)")
        else:
            first = next((a for a in lst if a["platform"] == p), None)
            if first:
                out.append((p, first["id"]))
            else:
                missing.append(PLATFORMS.get(p, (p, p))[1])
    if missing:
        raise PublishError(f"هذه الحسابات غير مربوطة: {'، '.join(missing)}. اربطها من صفحة النشر")
    return list(dict.fromkeys(out))


# ---------------------------------------------------------------- ربط وفصل الحسابات من جوه البرنامج

def default_profile() -> str:
    """البروفايل (مجلد الحسابات) عند Zernio: الخاص بالعميل إذا فيه بوابة، وإلا أولًا، وإذا لا يوجد نعمل واحد."""
    if (prof := tenant_profile()):
        return prof
    with _client(30) as c:
        data = _check(c.get(f"{BASE_URL}/profiles"), "قراءة البروفايلات")
        items = data.get("profiles", data.get("data", [])) if isinstance(data, dict) else data
        if items:
            return items[0].get("_id") or items[0].get("id")
        made = _check(c.post(f"{BASE_URL}/profiles", json={"name": "SimsimKit"}), "إنشاء ملف تعريف")
    made = made.get("profile", made) if isinstance(made, dict) else {}
    return made.get("_id") or made.get("id")


def connect_url(platform: str, redirect_url: str) -> str:
    """رابط تسجيل الدخول على المنصة نفسها. بعد الموافقة يعود للبرنامج مباشرة (headless)،
    وإذا المنصة تحتاج تختار صفحة أو بورد أو مكان، الاختيار يحدث لدينا (pending_options / pending_select)."""
    if platform not in PLATFORMS or platform in CREDENTIALS:
        raise PublishError("منصة غير معروفة")
    if platform in SOON:
        raise PublishError(SOON[platform])
    with _client(30) as c:
        data = _check(c.get(f"{BASE_URL}/connect/{PLATFORMS[platform][0]}",
                            params={"profileId": default_profile(), "redirect_url": redirect_url, "headless": "true", "welcome": "false"}), "تجهيز الربط")
    url = data.get("authUrl") or data.get("url") if isinstance(data, dict) else None
    if not url:
        raise PublishError(f"تجهيز الربط: رد غير متوقع: {str(data)[:200]}")
    global _accounts_cache
    _accounts_cache = None
    return url


# ---------------------------------------------------------------- 🔗 الاختيار بعد تسجيل الدخول (من غير ما العميل يشوف صفحات Zernio)
_PENDING: dict[str, dict] = {}


def _drop_cache() -> None:
    global _accounts_cache
    _accounts_cache = None


def _pick(data, key: str) -> list:
    if isinstance(data, dict):
        v = data.get(key)
        if isinstance(v, list):
            return v
        for x in data.values():
            if isinstance(x, list):
                return x
    return data if isinstance(data, list) else []


def _profile_json(raw: str | None):
    """userProfile يأتي متشفّر مرتين في الرابط: نفكّه مرة أيضًا ونقراه JSON."""
    from urllib.parse import unquote
    if not raw:
        return None
    v = raw
    for _ in range(4):   # ممكن ييجي متشفّر (%7B…) أو JSON جوه نص
        if not isinstance(v, str):
            return v
        try:
            v = json.loads(v)
        except (TypeError, ValueError):
            nxt = unquote(v)
            if nxt == v:
                return None
            v = nxt
    return v if not isinstance(v, str) else None


def pending_options(params: dict) -> dict:
    """أعد من تسجيل الدخول ويحتاج يختار: نجلب الصفحات/المنظمات/الأماكن/البوردات ونحفظ بيانات الربط لدينا (غير في المتصفح)."""
    plat = str(params.get("platform") or "")
    mine_plat = next((k for k, v in PLATFORMS.items() if v[0] == plat), plat)
    if plat not in SELECT_STEPS:
        raise PublishError("لا يوجد اختيار مطلوب هذه للمنصة")
    list_path, _, key = SELECT_STEPS[plat]
    profile = params.get("profileId") or default_profile()
    temp, ctoken, pend = params.get("tempToken"), params.get("connect_token"), params.get("pendingDataToken")
    headers = {"X-Connect-Token": ctoken} if ctoken else {}
    q = {"profileId": profile}
    if pend:
        q["pendingDataToken"] = pend
    if temp:
        q["tempToken"] = temp
    if plat == "linkedin":
        ids = params.get("orgIds")
        if not ids and params.get("organizations"):   # بعض الردود بتبعت المنظمات نفسها في اللينك
            orgs = _profile_json(params["organizations"]) or []
            ids = ",".join(str(o.get("id")) for o in orgs if isinstance(o, dict) and o.get("id")) if isinstance(orgs, list) else None
        q = {"tempToken": temp, **({"orgIds": ids} if ids else {})}
    with _client(30) as c:
        data = _check(c.get(f"{BASE_URL}/connect/{plat}/{list_path}", params=q, headers=headers), "قائمة الاختيار")
    items = _pick(data, key)
    opts = []
    for x in items:
        if not isinstance(x, dict):
            continue
        if plat == "instagram":
            ig = x.get("instagram_business_account") or {}
            opts.append({"id": str(x.get("id")), "name": ig.get("username") and f"@{ig['username']}" or x.get("name"), "sub": x.get("name") or "", "img": ig.get("profile_picture_url")})
        elif plat == "googlebusiness":
            opts.append({"id": str(x.get("id")), "name": x.get("name") or "", "sub": x.get("address") or x.get("accountName") or "", "account": x.get("accountId")})
        elif plat == "linkedin":
            opts.append({"id": str(x.get("id")), "name": x.get("name") or x.get("vanityName") or str(x.get("id")), "sub": x.get("website") or x.get("industry") or "",
                         "img": x.get("logoUrl"), "urn": x.get("urn") or f"urn:li:organization:{x.get('id')}", "vanity": x.get("vanityName")})
        else:
            opts.append({"id": str(x.get("id")), "name": x.get("name") or x.get("username") or str(x.get("id")), "sub": x.get("category") or x.get("description") or x.get("username") or ""})
    sid = uuid.uuid4().hex
    now = time.time()
    for k in [k for k, v in _PENDING.items() if now - v["at"] > 900]:
        _PENDING.pop(k, None)
    _PENDING[sid] = {"at": now, "platform": plat, "profile": profile, "temp": temp, "ctoken": ctoken, "pend": pend,
                     "user": _profile_json(params.get("userProfile")), "opts": {o["id"]: o for o in opts}}
    return {"sid": sid, "platform": mine_plat, "label": PLATFORMS.get(mine_plat, (plat, plat))[1], "options": opts,
            "personal": plat == "linkedin"}


def pending_select(sid: str, choice: str, redirect_url: str) -> None:
    """العميل اختر من القائمة التي لدينا: نكمّل الربط."""
    p = _PENDING.pop(sid, None)
    if not p or time.time() - p["at"] > 900:
        raise PublishError("الربط خذ وقت طويل وخلص. ابدأه مرة أخرى")
    plat, o = p["platform"], p["opts"].get(choice)
    if not o and not (plat == "linkedin" and choice == "personal"):
        raise PublishError("هذا الاختيار غير في القائمة")
    base = {"profileId": p["profile"], "redirect_url": redirect_url}
    if plat == "facebook":
        body = {**base, "pageId": choice, "tempToken": p["temp"], "userProfile": p["user"]}
    elif plat == "instagram":
        body = {**base, "pageId": choice, "tempToken": p["temp"]}
    elif plat == "linkedin":
        body = {**base, "tempToken": p["temp"], "userProfile": p["user"] or {}, "accountType": "personal" if choice == "personal" else "organization"}
        if choice != "personal":
            body["selectedOrganization"] = {"id": o["id"], "urn": o["urn"], "name": o["name"], **({"logoUrl": o["img"]} if o.get("img") else {}),
                                            **({"vanityName": o["vanity"]} if o.get("vanity") else {})}
    elif plat == "googlebusiness":
        body = {**base, "locationId": choice, **({"pendingDataToken": p["pend"]} if p["pend"] else {}), **({"accountId": o["account"]} if o.get("account") else {})}
        if not p["pend"] and p["temp"]:
            body["tempToken"] = p["temp"]
    else:   # pinterest
        body = {**base, "boardId": choice, "boardName": o["name"], "tempToken": p["temp"], **({"userProfile": p["user"]} if p["user"] else {})}
    headers = {"X-Connect-Token": p["ctoken"]} if p["ctoken"] else {}
    with _client(30) as c:
        _check(c.post(f"{BASE_URL}/connect/{plat}/{SELECT_STEPS[plat][1]}", json={k: v for k, v in body.items() if v is not None}, headers=headers), "إكمال الربط")
    _drop_cache()


def connect_bluesky(identifier: str, app_password: str) -> None:
    profile = default_profile()
    with _client(30) as c:
        users = _check(c.get(f"{BASE_URL}/users"), "قراءة الحساب")
        uid = (users or {}).get("currentUserId") if isinstance(users, dict) else None
        if not uid:
            raise PublishError("تعذّر ذلك أعرف رقم الحساب عند خدمة النشر")
        _check(c.post(f"{BASE_URL}/connect/bluesky/credentials", json={"identifier": identifier.strip(), "appPassword": app_password.strip(),
                                                                       "state": f"{uid}-{profile}"}), "ربط بلوسكاي")
    _drop_cache()


def telegram_code() -> dict:
    with _client(30) as c:
        data = _check(c.get(f"{BASE_URL}/connect/telegram", params={"profileId": default_profile()}), "كود تيليجرام")
    return {"code": data.get("code"), "bot": data.get("botUsername"), "expires_in": data.get("expiresIn")}


def telegram_status(code: str) -> str:
    with _client(30) as c:
        data = _check(c.patch(f"{BASE_URL}/connect/telegram", params={"code": code}), "حالة تيليجرام")
    st = str((data or {}).get("status") or "pending")
    if st == "connected":
        _drop_cache()
    return st


def connect_whatsapp(access_token: str, waba_id: str, phone_id: str, pin: str = "") -> None:
    body = {"profileId": default_profile(), "accessToken": access_token.strip(), "wabaId": waba_id.strip(), "phoneNumberId": phone_id.strip()}
    if pin.strip():
        body["pin"] = pin.strip()
    with _client(60) as c:
        _check(c.post(f"{BASE_URL}/connect/whatsapp/credentials", json=body), "ربط واتساب")
    _drop_cache()


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
    """رابط الرفع ورابط الفيديو بعد الرفع. Zernio يسمّي الآخر publicUrl (ومن قبل fileUrl)."""
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
    """يرفع ملف (فيديو أو صورة) لـ Zernio ويعود الرابط الخاص به."""
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
    """يرفع الفيديو ويسلّم المنشور لـ Zernio، ويعود رقم المنشور لديهم."""
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
        data = _check(c.post(f"{BASE_URL}/posts", json=body), "تسليم المنشور")
    post = data.get("post", data) if isinstance(data, dict) else {}
    remote_id = post.get("_id") or post.get("id")
    if not remote_id:
        raise PublishError(f"تسليم المنشور: الرد لا يحتوي رقم المنشور: {str(data)[:200]}")
    return remote_id


def schedule_carousel(images: list[Path], caption: str, when_utc: str, publish_now: bool, options: dict | None = None,
                      targets: list[str] | None = None) -> str:
    """كاروسيل صور على إنستجرام (حتى 10 صور). إنستجرام لا يقبل موسيقى على الكاروسيل من الـ API."""
    ig = [t for t in (targets or []) if split_target(t)[0] == "instagram"] or ["instagram"]
    ig_targets = resolve_targets(ig)
    if not 2 <= len(images) <= 10:
        raise PublishError("يجب أن يتكون الكاروسيل من 2 إلى 10 صور")
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
        raise PublishError(f"تسليم الكاروسيل: الرد لا يحتوي رقم المنشور: {str(data)[:200]}")
    return remote_id


def cancel(remote_id: str) -> None:
    with _client(30) as c:
        resp = c.delete(f"{BASE_URL}/posts/{remote_id}")
    if resp.status_code != 404:
        _check(resp, "إلغاء المنشور")


def list_posts(status: str, limit: int = 100) -> list[dict]:
    """منشورات Zernio بحالة معيّنة، بشكل موحّد:
    [{"id", "status", "content", "scheduled_for", "published_at", "media_url",
      "platforms": [{"key" (لدينا), "status", "url", "error", "published_at"}]}]"""
    params = {"status": status, "limit": limit}
    if (prof := tenant_profile()):
        params["profileId"] = prof
    with _client(30) as c:
        data = _check(c.get(f"{BASE_URL}/posts", params=params), "قراءة المنشورات ")
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
    """المنشورات المتجدولة عند Zernio (الشكل القديم الذي تستخدمه مقارنة القائمة)."""
    return [
        {"id": p["id"], "content": p["content"], "scheduled_for": p["scheduled_for"],
         "platforms": list(dict.fromkeys(x["key"] for x in p["platforms"])), "media_url": p["media_url"]}
        for p in list_posts("scheduled") if p["status"] == "scheduled"
    ]


def retry(remote_id: str) -> None:
    with _client(30) as c:
        _check(c.post(f"{BASE_URL}/posts/{remote_id}/retry"), "إعادة المحاولة")


def remote_status(remote_id: str) -> tuple[str, str | None]:
    """يعود (published | failed | pending, رسالة الخطأ إذا فيه)."""
    with _client(30) as c:
        data = _check(c.get(f"{BASE_URL}/posts/{remote_id}"), "متابعة المنشور")
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

INBOX_ADDON_MSG = "صندوق الردود ما زال غير متفعّل في الاشتراك. كلّم الدعم يفعّله"


def _inbox_check(resp: httpx.Response, what: str):
    if resp.status_code == 403 and "inbox" in resp.text.lower():
        raise PublishError(INBOX_ADDON_MSG)
    return _check(resp, what)


def _failed(meta: dict | None) -> list[str]:
    """الحسابات التي Zernio لم يستطع يقرأ منها (حد أقصى للطلبات أو الربط باظ)."""
    out = []
    for f in (meta or {}).get("failedAccounts") or []:
        out.append(f"{f.get('platform') or ''} {('@' + f['accountUsername']) if f.get('accountUsername') else ''}: {f.get('error') or ''}".strip())
    return out


def inbox_posts(limit: int = 50, cursor: str | None = None) -> dict:
    """المنشورات التي عليها تعليقات (من كل الحسابات)، الأحدث أولًا."""
    params = {"limit": limit, "minComments": 1, "sortBy": "date", "sortOrder": "desc"}
    if cursor:
        params["cursor"] = cursor
    with _client() as c:
        data = _inbox_check(c.get(f"{BASE_URL}/inbox/comments", params=params), "قراءة المنشورات التي عليها تعليقات")
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
                            "قراءة التعليقات")
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
        data = _inbox_check(c.get(f"{BASE_URL}/inbox/conversations", params=params), "قراءة الرسائل")
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
