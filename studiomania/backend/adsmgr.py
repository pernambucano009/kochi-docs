"""📣 إعلاناتك (مدير الإعلانات): ترويج منشور نُشر، أو إعلان جديد من الصفر، وجماهير مخصصة وشبيهة، كله من داخل البرنامج.

الإعلانات تُنشأ على حساب الإعلانات الخاص بالعميل نفسه (مال الإعلان تتدفع للمنصة من كارته هو)،
والاستهداف يأتي من «🎯 وصفة الاستهداف» (اهتمامات وكلمات بحث وسن وبلاد)، غير من قائمة أشخاص.
نستخدم نفس خدمة النشر (وتحتاج إضافة الإعلانات تكون متفعّلة في الاشتراك).
PUBLISH_MOCK=1: حسابات وإعلانات تجريبية بأرقام وهمية لكي التجربة.
"""
from __future__ import annotations

import random
import time
import uuid

import httpx

import publisher

# المنصة عندنا ← (الاسم عند الخدمة، الاسم بالعربي). جوجل بيتربط لوحده (مش من حساب نشر)
PLATFORMS = {"facebook": ("facebook", "فيسبوك"), "instagram": ("instagram", "إنستجرام"), "tiktok": ("tiktok", "تيك توك"),
             "linkedin": ("linkedin", "لينكدإن"), "pinterest": ("pinterest", "بنترست"), "x": ("twitter", "X (تويتر)"), "google": ("google", "جوجل ويوتيوب")}
ADS_PLATFORM = {"metaads": "facebook", "facebookads": "facebook", "instagramads": "instagram", "tiktokads": "tiktok", "linkedinads": "linkedin",
                "pinterestads": "pinterest", "xads": "x", "twitterads": "x", "googleads": "google"}
SAME_TOKEN = {"facebook", "instagram", "linkedin", "pinterest"}   # بتاخد نفس ربط النشر، من غير تسجيل دخول تاني
GOALS = {"engagement": "تفاعل", "traffic": "زيارات للينك", "awareness": "انتشار", "video_views": "مشاهدات فيديو",
         "lead_generation": "عملاء محتملين", "conversions": "مبيعات/تحويلات"}
GOALS_BY = {"x": {"engagement", "traffic", "awareness", "video_views"}, "pinterest": {"engagement", "traffic", "awareness", "video_views"},
            "google": {"engagement", "traffic", "awareness", "video_views"}}
MIN_BUDGET = {"tiktok": 20, "pinterest": 5}   # بالدولار، والباقي ١
CTAS = {"LEARN_MORE": "اعرف أكثر", "SHOP_NOW": "اشتري الآن", "SIGN_UP": "سجّل", "CONTACT_US": "كلّمنا", "GET_OFFER": "خذ العرض",
        "GET_QUOTE": "اطلب عرض سعر", "SUBSCRIBE": "اشترك", "WATCH_MORE": "شاهد أكثر", "DOWNLOAD": "نزّل", "BOOK_TRAVEL": "احجز"}
ADDON_MSG = "الإعلانات ما زال غير متفعّلة في اشتراكك. كلّم الدعم يفعّلها، وبعدها كل شيء ستشتغل من هنا."
# أسامي البلاد زي ما الوصفة بتكتبها ← الكود اللي المنصات بتفهمه
COUNTRIES = {"السعودية": "SA", "المملكة": "SA", "مصر": "EG", "الإمارات": "AE", "الامارات": "AE", "الكويت": "KW", "قطر": "QA", "البحرين": "BH",
             "عمان": "OM", "عُمان": "OM", "الأردن": "JO", "الاردن": "JO", "لبنان": "LB", "العراق": "IQ", "المغرب": "MA", "الجزائر": "DZ",
             "تونس": "TN", "ليبيا": "LY", "السودان": "SD", "اليمن": "YE", "سوريا": "SY", "فلسطين": "PS",
             "saudi": "SA", "ksa": "SA", "egypt": "EG", "uae": "AE", "emirates": "AE", "kuwait": "KW", "qatar": "QA", "bahrain": "BH",
             "oman": "OM", "jordan": "JO", "lebanon": "LB", "iraq": "IQ", "morocco": "MA", "usa": "US", "united states": "US", "uk": "GB"}


class AdsError(Exception):
    pass


def mock() -> bool:
    return publisher.service_name() == "mock"


def ready() -> None:
    if publisher.service_name() not in ("zernio", "mock"):
        raise AdsError("خدمة النشر والإعلانات غير متصلة ما زال. كلّم الدعم")


def _check(resp: httpx.Response, what: str):
    if resp.status_code == 403 and "add-on" in resp.text.lower():
        raise AdsError(ADDON_MSG)
    if resp.status_code == 422 and "ads connection" in resp.text.lower():
        raise AdsError("يجب تربط حساب الإعلانات هذه للمنصة أولًا (من «اربط حساب إعلانات»)")
    try:
        return publisher._check(resp, what)
    except publisher.PublishError as exc:
        raise AdsError(str(exc)) from exc


def _get(path: str, params: dict | None = None, what: str = "الإعلانات"):
    with publisher._client(40) as c:
        return _check(c.get(f"{publisher.BASE_URL}{path}", params={k: v for k, v in (params or {}).items() if v not in (None, "")}), what)


def _send(method: str, path: str, body: dict, what: str):
    with publisher._client(60) as c:
        return _check(c.request(method, f"{publisher.BASE_URL}{path}", json=body), what)


def countries(locs: list[str]) -> list[str]:
    out = []
    for loc in locs or []:
        low = str(loc).lower()
        for name, code in COUNTRIES.items():
            if name in low and code not in out:
                out.append(code)
    return out


def goals_for(platform: str) -> dict:
    ok = GOALS_BY.get(platform)
    return {k: v for k, v in GOALS.items() if not ok or k in ok}


def check_budget(platform: str, amount: float) -> None:
    lo = MIN_BUDGET.get(platform, 1)
    if amount < lo:
        raise AdsError(f"أقل ميزانية يومية على {PLATFORMS.get(platform, (platform, platform))[1]} هي {lo} دولار")


# ---------------------------------------------------------------- 🧪 وضع التجربة
_M: dict = {"accounts": [], "ads": [], "audiences": []}


def _mock_ad(kind: str, platform: str, name: str, budget: float, extra: dict) -> dict:
    ad = {"id": f"mad-{uuid.uuid4().hex[:6]}", "name": name, "platform": platform, "status": "active", "kind": kind,
          "budget": {"amount": budget, "type": "daily"}, "created": time.time(), **extra}
    _M["ads"].append(ad)
    return ad


def _mock_metrics(ad: dict) -> dict:
    days = max(1.0, (time.time() - ad["created"]) / 86400)
    rnd = random.Random(ad["id"])
    spend = round(min(days, 7) * ad["budget"]["amount"] * rnd.uniform(.6, 1), 2)
    imp = int(spend * rnd.uniform(250, 600))
    clicks = int(imp * rnd.uniform(.008, .025))
    return {"spend": spend, "impressions": imp, "reach": int(imp * .7), "clicks": clicks, "ctr": round(clicks / imp * 100, 2) if imp else 0,
            "cpc": round(spend / clicks, 2) if clicks else 0, "conversions": int(clicks * rnd.uniform(.02, .08))}


# ---------------------------------------------------------------- حسابات الإعلانات
def _norm_account(a: dict) -> dict | None:
    if not isinstance(a, dict):
        return None
    plat = str(a.get("platform") or "").lower()
    plat = ADS_PLATFORM.get(plat, plat if plat in PLATFORMS else {"twitter": "x"}.get(plat, ""))
    acc = a.get("accountId")
    acc = (acc.get("_id") or acc.get("id")) if isinstance(acc, dict) else acc
    ad_id = a.get("adAccountId") or a.get("id") or a.get("_id")
    if not plat or not ad_id:
        return None
    return {"ad_account": str(ad_id), "account": str(acc or a.get("socialAccountId") or a.get("_id") or ""), "platform": plat,
            "name": a.get("name") or a.get("adAccountName") or str(ad_id), "currency": a.get("currency") or "USD"}


def ad_accounts() -> list[dict]:
    """حسابات الإعلانات المربوطة (مثلًا حساب ميتا act_123) ومعها حساب النشر الذي تُنشأ منه."""
    if mock():
        return _M["accounts"]
    prof = publisher.tenant_profile()
    data = _get("/ads/accounts", {"profileId": prof}, "قراءة حسابات الإعلانات")
    items = publisher._pick(data, "accounts")
    return [x for x in (_norm_account(a) for a in items) if x]   # الطلب نفسه متفلتر ببروفايل العميل


def connect(platform: str, account_id: str, redirect_url: str) -> dict:
    """ربط الإعلانات: ميتا ولينكدإن ونترست يأخذون ربط النشر مباشرة، وتيك توك وX وجوجل بتسجيل دخول على المنصة نفسها."""
    if platform not in PLATFORMS:
        raise AdsError("منصة غير معروفة")
    if mock():
        name = {"facebook": "حساب إعلانات ميتا التجريبي", "instagram": "حساب إعلانات ميتا التجريبي"}.get(platform, f"إعلانات {PLATFORMS[platform][1]} التجريبي")
        if not any(a["platform"] == platform for a in _M["accounts"]):
            _M["accounts"].append({"ad_account": f"act_{len(_M['accounts']) + 1}0001", "account": account_id or f"m-{platform}", "platform": platform,
                                   "name": name, "currency": "USD"})
        return {"done": True}
    remote = "googleads" if platform == "google" else PLATFORMS[platform][0]
    if platform not in SAME_TOKEN and platform != "google" and not account_id:
        raise AdsError(f"اربط حساب {PLATFORMS[platform][1]} للنشر أولًا، ثم اربط إعلاناته")
    data = _get(f"/connect/{remote}/ads", {"profileId": publisher.default_profile(), "accountId": account_id or None,
                                          "redirect_url": redirect_url, "headless": "true"}, "ربط الإعلانات")
    if isinstance(data, dict) and data.get("alreadyConnected"):
        return {"done": True}
    url = (data.get("authUrl") or data.get("url")) if isinstance(data, dict) else None
    if url:
        return {"url": url}
    return {"done": True}


# ---------------------------------------------------------------- الاستهداف
def interests(q: str, account_id: str) -> list[dict]:
    if mock():
        return [{"id": f"600{abs(hash(q)) % 100000}", "name": q.strip().title()}] if q.strip() else []
    data = _get("/ads/interests", {"q": q, "accountId": account_id}, "البحث في الاهتمامات")
    out = []
    for x in publisher._pick(data, "interests"):
        if isinstance(x, dict) and x.get("id") and x.get("name"):
            out.append({"id": str(x["id"]), "name": str(x["name"]), "size": x.get("audienceSize") or x.get("audience_size_upper_bound")})
    return out[:10]


def map_interests(names: list[str], account_id: str, n: int = 12) -> list[dict]:
    """أسامي الاهتمامات التي في الوصفة ← الاهتمام الحقيقي عند المنصة (أقرب نتيجة لكل اسم)."""
    out, seen = [], set()
    for name in (names or [])[:n]:
        try:
            hits = interests(name, account_id)
        except AdsError:
            continue
        best = next((h for h in hits if h["name"].lower() == name.lower()), hits[0] if hits else None)
        if best and best["id"] not in seen:
            seen.add(best["id"])
            out.append({"id": best["id"], "name": best["name"]})
    return out


def targeting(t: dict) -> dict:
    """الاستهداف الذي يُرسل: سن وبلاد واهتمامات (هذا ما الخدمة تقبله في الترويج والإعلان الجديد)."""
    out = {"ageMin": max(13, min(65, int(t.get("age_min") or 18))), "ageMax": max(13, min(65, int(t.get("age_max") or 45)))}
    if t.get("countries"):
        out["countries"] = [str(c).upper()[:2] for c in t["countries"]][:25]
    if t.get("interests"):
        out["interests"] = [{"id": str(i["id"]), "name": str(i.get("name") or "")} for i in t["interests"] if isinstance(i, dict) and i.get("id")][:25]
    return out


# ---------------------------------------------------------------- الإعلانات
def boost(post_id: str, account_id: str, ad_account: str, platform: str, name: str, goal: str, budget: float, days: int, currency: str, tg: dict) -> dict:
    check_budget(platform, budget)
    body = {"postId": post_id, "accountId": account_id, "adAccountId": ad_account, "name": name[:120], "goal": goal,
            "budget": {"amount": budget, "type": "daily"}, "currency": currency, "targeting": targeting(tg)}
    if days:
        body["schedule"] = {"startDate": time.strftime("%Y-%m-%d"), "endDate": time.strftime("%Y-%m-%d", time.gmtime(time.time() + days * 86400))}
    if mock():
        return _mock_ad("boost", platform, name, budget, {"post": post_id, "goal": goal, "targeting": body["targeting"], "days": days})
    data = _send("POST", "/ads/boost", body, "ترويج المنشور")
    ad = (data.get("ad") or data) if isinstance(data, dict) else {}
    return {"id": str(ad.get("_id") or ad.get("id") or ad.get("adId") or ""), "name": name, "platform": platform}


def create(account_id: str, ad_account: str, platform: str, name: str, goal: str, budget: float, days: int, currency: str, tg: dict,
           headline: str, body_text: str, link: str, media_url: str, cta: str, keywords: list[str] | None = None,
           more_headlines: list[str] | None = None, more_bodies: list[str] | None = None) -> dict:
    check_budget(platform, budget)
    t = targeting(tg)
    body = {"accountId": account_id, "adAccountId": ad_account, "name": name[:120], "goal": goal, "budgetAmount": budget, "budgetType": "daily",
            "currency": currency, "headline": headline, "body": body_text, "linkUrl": link, "ageMin": t["ageMin"], "ageMax": t["ageMax"]}
    if media_url:
        body["imageUrl"] = media_url   # تيك توك: لينك الفيديو بيتحط هنا
    if t.get("countries"):
        body["countries"] = t["countries"]
    if t.get("interests"):
        body["interests"] = t["interests"]
    if platform in ("facebook", "instagram") and cta in CTAS:
        body["callToAction"] = cta
    if platform == "google":
        body.update(campaignType="search", keywords=(keywords or [])[:20], headline=headline[:30], body=body_text[:90],
                    additionalHeadlines=[h[:30] for h in more_headlines or [] if h][:14], additionalDescriptions=[d[:90] for d in more_bodies or [] if d][:3])
    elif platform == "pinterest":
        body["headline"], body["body"] = headline[:100], body_text[:500]
    if days:
        body["schedule"] = {"startDate": time.strftime("%Y-%m-%d"), "endDate": time.strftime("%Y-%m-%d", time.gmtime(time.time() + days * 86400))}
    if mock():
        return _mock_ad("create", platform, name, budget, {"goal": goal, "headline": headline, "targeting": t, "days": days})
    data = _send("POST", "/ads/create", body, "عمل الإعلان")
    ad = (data.get("ad") or data) if isinstance(data, dict) else {}
    return {"id": str(ad.get("_id") or ad.get("id") or ad.get("adId") or ""), "name": name, "platform": platform}


def _norm_ad(a: dict) -> dict:
    m = a.get("metrics") or a.get("insights") or {}
    plat = str(a.get("platform") or "").lower()
    plat = ADS_PLATFORM.get(plat, {"twitter": "x"}.get(plat, plat))
    b = a.get("budget") or {}
    return {"id": str(a.get("_id") or a.get("id") or ""), "name": a.get("name") or "", "platform": plat,
            "status": str(a.get("status") or "").lower(), "budget": {"amount": b.get("amount") if isinstance(b, dict) else b, "type": (b.get("type") if isinstance(b, dict) else None) or "daily"},
            "metrics": {k: m.get(k) for k in ("spend", "impressions", "reach", "clicks", "ctr", "cpc", "conversions") if k in m},
            "error": a.get("rejectionReason") or a.get("error")}


def list_ads(ids: set[str] | None = None) -> list[dict]:
    if mock():
        return [{**a, "metrics": _mock_metrics(a) if a["status"] != "cancelled" else {}} for a in _M["ads"] if not ids or a["id"] in ids]
    data = _get("/ads", {"source": "zernio", "profileId": publisher.tenant_profile(), "limit": 200}, "قراءة الإعلانات")
    out = [_norm_ad(a) for a in publisher._pick(data, "ads") if isinstance(a, dict)]
    return [a for a in out if a["id"] and (not ids or a["id"] in ids)]


def update(ad_id: str, status: str | None = None, budget: float | None = None, platform: str = "") -> None:
    body: dict = {}
    if status in ("active", "paused"):
        body["status"] = status
    if budget:
        check_budget(platform, budget)
        body["budget"] = {"amount": budget, "type": "daily"}
    if not body:
        return
    if mock():
        for a in _M["ads"]:
            if a["id"] == ad_id:
                a.update({k: v for k, v in body.items()})
        return
    _send("PUT", f"/ads/{ad_id}", body, "تعديل الإعلان")


def cancel(ad_id: str) -> None:
    if mock():
        for a in _M["ads"]:
            if a["id"] == ad_id:
                a["status"] = "cancelled"
        return
    with publisher._client(40) as c:
        _check(c.delete(f"{publisher.BASE_URL}/ads/{ad_id}"), "إلغاء الإعلان")


def analytics(ad_id: str) -> dict:
    if mock():
        a = next((x for x in _M["ads"] if x["id"] == ad_id), None)
        if not a:
            raise AdsError("الإعلان غير موجود")
        m = _mock_metrics(a)
        return {"summary": m, "daily": [], "breakdowns": {"age": [{"key": "25-34", "spend": round(m["spend"] * .5, 2)}, {"key": "18-24", "spend": round(m["spend"] * .3, 2)}]}}
    data = _get(f"/ads/{ad_id}/analytics", {"breakdowns": "age,gender,country"}, "أرقام الإعلان")
    an = (data.get("analytics") or data) if isinstance(data, dict) else {}
    return {"summary": an.get("summary") or {}, "daily": an.get("daily") or [], "breakdowns": an.get("breakdowns") or {}}


# ---------------------------------------------------------------- 👥 الجماهير (ميتا)
def audiences(account_id: str = "") -> list[dict]:
    if mock():
        return _M["audiences"]
    data = _get("/ads/audiences", {"accountId": account_id or None, "profileId": publisher.tenant_profile()}, "قراءة الجماهير")
    out = []
    for a in publisher._pick(data, "audiences"):
        if isinstance(a, dict):
            out.append({"id": str(a.get("_id") or a.get("id") or ""), "name": a.get("name") or "", "type": a.get("type") or a.get("subtype") or "",
                        "size": a.get("approximateCount") or a.get("size"), "platform": ADS_PLATFORM.get(str(a.get("platform") or "").lower(), str(a.get("platform") or "")),
                        "status": a.get("status") or ""})
    return [a for a in out if a["id"]]


def create_audience(account_id: str, ad_account: str, name: str, kind: str, source: str = "", country: str = "", ratio: float = 0.01,
                    pixel: str = "", days: int = 30) -> dict:
    body = {"accountId": account_id, "adAccountId": ad_account, "name": name[:100], "type": kind}
    if kind == "lookalike":
        if not source or not country:
            raise AdsError("الجمهور الشبيه يحتاج جمهور أصلي وبلد")
        body.update(sourceAudienceId=source, country=country.upper()[:2], ratio=max(0.01, min(0.2, ratio)))
    elif kind == "website":
        if not pixel:
            raise AdsError("جمهور زوار الموقع يحتاج البيكسل الخاص بـ موقعك")
        body.update(pixelId=pixel, retentionDays=max(1, min(180, days)))
    elif kind != "customer_list":
        raise AdsError("نوع جمهور غير معروف")
    if mock():
        a = {"id": f"maud-{uuid.uuid4().hex[:6]}", "name": name, "type": kind, "size": None if kind == "customer_list" else 120000, "platform": "facebook", "status": "ready"}
        _M["audiences"].append(a)
        return a
    data = _send("POST", "/ads/audiences", body, "عمل الجمهور")
    a = (data.get("audience") or data) if isinstance(data, dict) else {}
    return {"id": str(a.get("_id") or a.get("id") or ""), "name": name, "type": kind}


def upload_users(audience_id: str, users: list[dict]) -> int:
    users = [u for u in users if u.get("email") or u.get("phone")][:10000]
    if not users:
        raise AdsError("لا يوجد إيميلات أو أرقام في الملف")
    if mock():
        for a in _M["audiences"]:
            if a["id"] == audience_id:
                a["size"] = (a.get("size") or 0) + len(users)
        return len(users)
    _send("POST", f"/ads/audiences/{audience_id}/users", {"users": users}, "رفع العملاء")
    return len(users)


def delete_audience(audience_id: str) -> None:
    if mock():
        _M["audiences"][:] = [a for a in _M["audiences"] if a["id"] != audience_id]
        return
    with publisher._client(40) as c:
        _check(c.delete(f"{publisher.BASE_URL}/ads/audiences/{audience_id}"), "مسح الجمهور")


def pixels(account_id: str) -> list[dict]:
    if mock():
        return [{"id": "1234567890", "name": "بيكسل الموقع التجريبي"}]
    data = _get(f"/accounts/{account_id}/conversion-destinations", None, "قراءة البيكسل")
    return [{"id": str(x.get("id") or x.get("_id")), "name": x.get("name") or str(x.get("id"))} for x in publisher._pick(data, "destinations") if isinstance(x, dict) and (x.get("id") or x.get("_id"))]


def copy_messages(brand: str, platform: str, aud: dict, offer: str) -> list[dict]:
    angles = "\n".join(f"- {a.get('angle')}: {a.get('text')}" for a in (aud.get("angles") or [])[:6])
    return [{"role": "system", "content": "You write high-converting ad copy for the Arab market. Return JSON only."},
            {"role": "user", "content": f"""Brand: {brand[:1500]}
Platform: {platform}. What we promote / offer: «{offer[:600] or "the brand's main product"}»
Audience recipe: {aud.get("summary", "")}
Winning angles from competitor research:
{angles or "(none)"}
Audience objections to answer: {"; ".join((aud.get("objections") or [])[:5])}
Write in the market's dialect, short and punchy, no false claims, no fake urgency, no emojis spam.
Limits: headline max {30 if platform == "google" else 60} chars, body max {90 if platform == "google" else 220} chars.
Return JSON: {{"headline": "...", "body": "...", "more_headlines": ["5 to 10 alternatives, same limit"], "more_bodies": ["2 to 3 alternatives"], "cta": "one of {", ".join(CTAS)}"}}"""}]


def clean_copy(raw: dict, platform: str) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    hl, bl = (30, 90) if platform == "google" else (255, 500)
    strs = lambda v, n, m: [str(x).strip()[:m] for x in (v if isinstance(v, list) else []) if str(x).strip()][:n]  # noqa: E731
    return {"headline": str(raw.get("headline") or "")[:hl], "body": str(raw.get("body") or "")[:bl],
            "more_headlines": strs(raw.get("more_headlines"), 14, hl), "more_bodies": strs(raw.get("more_bodies"), 3, bl),
            "cta": raw.get("cta") if raw.get("cta") in CTAS else "LEARN_MORE"}
