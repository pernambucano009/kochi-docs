"""💓 «نبض المجال» (فرع في عقل البراند): المنافسين والترند. أعلى 5 حسابات مشاهدات في مجال البراند وسوقه (تيك توك وإنستجرام).

البرنامج بيدوّر بكلمات المجال بلهجة السوق، يجمّع الحسابات اللي بتطلع، يختار الأقرب للبراند،
وبعدين يجيب آخر بوستات كل حساب ويحسب كل بوست عدّى متوسط صاحبه بكام مرة.
اللي بينجح عندهم (الهوكات والفكرة والهيكل) بيدخل في كتابة الأفكار والسكريبتات.
الداتا من ScrapeCreators (SCRAPECREATORS_API_KEY)، ومن غيره بيشتغل بداتا تجريبية.
"""
from __future__ import annotations

import hashlib
import os
import re
import statistics
import time

import httpx
import algo

API = "https://api.scrapecreators.com"
PLATFORMS = {"tiktok": "تيك توك", "instagram": "إنستجرام"}
TOP = 5            # كام منافس بيفضل في الفرع
STALE = 7 * 86400  # بعد أسبوع البوستات بتتحدّث لوحدها
RECENT = 30 * 86400


def key() -> str:
    return os.environ.get("SCRAPECREATORS_API_KEY", "").strip()


def live() -> bool:
    return bool(key())


class RivalsError(Exception):
    pass


def _get(path: str, params: dict, timeout: float = 40) -> dict:
    last = None
    for _ in range(2):
        try:
            r = httpx.get(API + path, params=params, headers={"x-api-key": key()}, timeout=timeout)
            if r.status_code in (401, 403):
                raise RivalsError("مفتاح ScrapeCreators مش شغال، راجعه في Railway")
            if r.status_code == 402:
                raise RivalsError("رصيد ScrapeCreators خلص")
            if r.status_code >= 500:
                last = f"{r.status_code}"
                continue
            r.raise_for_status()
            return r.json() if r.content else {}
        except httpx.HTTPError as exc:
            last = str(exc)[:120]
    raise RivalsError(f"مصدر الداتا مردش ({last})")


def clean_handle(h: str) -> str:
    h = str(h or "").strip()
    m = re.search(r"(?:tiktok\.com/@|instagram\.com/)([A-Za-z0-9._]+)", h)
    if m:
        h = m.group(1)
    return re.sub(r"[^A-Za-z0-9._]", "", h.lstrip("@"))[:40]


def guess_platform(h: str) -> str:
    return "instagram" if "instagram.com" in str(h) else "tiktok"


# ---------- تحويل رد الـ API لبوست موحّد
def _num(v) -> int:
    try:
        return int(v or 0)
    except (TypeError, ValueError):
        return 0


def norm_tt(raw: dict) -> dict | None:
    if not isinstance(raw, dict):
        return None
    st = raw.get("statistics") if isinstance(raw.get("statistics"), dict) else {}
    au = raw.get("author") if isinstance(raw.get("author"), dict) else {}
    handle = str(au.get("unique_id") or "")
    vid = str(raw.get("aweme_id") or "")
    if not handle or not vid:
        return None
    return {"platform": "tiktok", "id": vid, "handle": handle, "name": str(au.get("nickname") or handle)[:80],
            "followers": _num(au.get("follower_count")),
            "url": raw.get("share_url") or f"https://www.tiktok.com/@{handle}/video/{vid}",
            "caption": str(raw.get("desc") or "")[:600], "views": _num(st.get("play_count")), "likes": _num(st.get("digg_count")),
            "comments": _num(st.get("comment_count")), "shares": _num(st.get("share_count")), "ts": _num(raw.get("create_time"))}


def norm_ig(raw: dict) -> dict | None:
    if not isinstance(raw, dict):
        return None
    if isinstance(raw.get("media"), dict):
        raw = raw["media"]
    cap = raw.get("caption")
    text = cap.get("text", "") if isinstance(cap, dict) else cap if isinstance(cap, str) else ""
    ow = raw.get("owner") or raw.get("user") or {}
    handle = ow.get("username", "") if isinstance(ow, dict) else str(ow or "")
    code = raw.get("code") or raw.get("shortcode") or ""
    if not handle or not code:
        return None
    return {"platform": "instagram", "id": str(code), "handle": handle,
            "name": str((ow.get("full_name") if isinstance(ow, dict) else "") or handle)[:80],
            "followers": _num(ow.get("follower_count") if isinstance(ow, dict) else 0),
            "url": raw.get("url") or f"https://www.instagram.com/reel/{code}",
            "caption": str(text or "")[:600], "views": _num(raw.get("video_play_count") or raw.get("video_view_count") or raw.get("play_count")),
            "likes": _num(raw.get("like_count")), "comments": _num(raw.get("comment_count")), "shares": 0, "ts": _num(raw.get("taken_at"))}


def search(platform: str, query: str) -> list[dict]:
    if platform == "tiktok":
        d = _get("/v1/tiktok/search/keyword", {"query": query, "sort_by": "relevance"})
        raw = [e.get("aweme_info", e) for e in d.get("search_item_list") or d.get("data") or [] if isinstance(e, dict)]
        return [p for p in map(norm_tt, raw) if p]
    try:
        d = _get("/v2/instagram/reels/search", {"query": query})
    except RivalsError:
        if " " not in query.strip():
            raise
        d = _get("/v2/instagram/reels/search", {"query": re.sub(r"\s+", "", query)})   # الكلام الطويل بيوقعه، فبنجرّبه هاشتاج
    return [p for p in map(norm_ig, d.get("reels") or d.get("items") or d.get("data") or []) if p]


def profile_posts(platform: str, handle: str) -> list[dict]:
    if platform == "tiktok":
        d = _get("/v3/tiktok/profile/videos", {"handle": handle, "sort_by": "latest"})
        return [p for p in map(norm_tt, d.get("aweme_list") or d.get("data") or []) if p]
    d = _get("/v1/instagram/user/reels", {"handle": handle})
    return [p for p in map(norm_ig, d.get("items") or d.get("data") or []) if p]


def transcript(platform: str, url: str) -> str:
    try:
        if platform == "tiktok":
            t = _get("/v1/tiktok/video/transcript", {"url": url}, 25).get("transcript") or ""
            if isinstance(t, list):
                t = " ".join(map(str, t))
            t = " ".join(x.strip() for x in str(t).split("\n")
                         if x.strip() and not x.startswith("WEBVTT") and "-->" not in x and not re.match(r"^\d{2}:\d{2}", x.strip()))
        else:
            t = " ".join(str(x.get("text") or "") for x in _get("/v2/instagram/media/transcript", {"url": url}, 45).get("transcripts") or [] if isinstance(x, dict))
    except RivalsError:
        return ""
    return " ".join(t.split()[:120])


# ---------- الحساب
def candidates(posts: list[dict], exclude: set[str]) -> list[dict]:
    """الحسابات اللي طلعت في البحث، مترتبة بأعلى مشاهدات."""
    acc: dict[str, dict] = {}
    for p in posts:
        k = f"{p['platform']}:{p['handle'].lower()}"
        if k in exclude:
            continue
        a = acc.setdefault(k, {"platform": p["platform"], "handle": p["handle"], "name": p["name"], "followers": p.get("followers", 0),
                               "hits": 0, "top_views": 0, "sum_views": 0, "samples": []})
        if p["id"] in {s["id"] for s in a["samples"]}:
            continue
        a["hits"] += 1
        a["top_views"] = max(a["top_views"], p["views"])
        a["sum_views"] += p["views"]
        a["followers"] = max(a["followers"], p.get("followers", 0))
        a["samples"].append({"id": p["id"], "caption": p["caption"][:160], "views": p["views"]})
    out = sorted(acc.values(), key=lambda a: (a["sum_views"], a["hits"]), reverse=True)
    for a in out:
        a["samples"] = sorted(a["samples"], key=lambda s: -s["views"])[:3]
    return out


def summarize(platform: str, handle: str, posts: list[dict], now: float | None = None) -> dict:
    """متوسط الحساب (الوسيط، علشان بوست واحد مضروب مايبوّظش الحساب) وكل بوست عدّاه بكام."""
    now = now or time.time()
    posts = [p for p in posts if p["handle"].lower() == handle.lower()] or posts
    views = [p["views"] for p in posts if p["views"]]
    med = int(statistics.median(views)) if views else 0
    rows = []
    for p in sorted(posts, key=lambda p: -p["ts"])[:30]:
        rows.append({**{k: p[k] for k in ("id", "url", "caption", "views", "likes", "comments", "shares", "ts")},
                     "multiple": round(p["views"] / med, 1) if med else 0, "recent": bool(p["ts"] and now - p["ts"] < RECENT)})
    best = sorted(rows, key=lambda r: (-r["multiple"], -r["views"]))[:8]
    first = posts[0] if posts else {}
    return {"platform": platform, "handle": handle, "name": first.get("name") or handle, "followers": first.get("followers", 0),
            "median_views": med, "posts_count": len(rows), "recent_count": sum(r["recent"] for r in rows),
            "top_views": max(views or [0]), "posts": best}


def trending(posts: list[dict], now: float | None = None, n: int = 15) -> list[dict]:
    """نبض المجال: أعلى البوستات مشاهدات في آخر ٣٠ يوم (من أي حساب)."""
    now = now or time.time()
    seen, out = set(), []
    for p in sorted(posts, key=lambda p: -p["views"]):
        if p["id"] in seen or not p["ts"] or now - p["ts"] > RECENT:
            continue
        seen.add(p["id"])
        out.append({k: p.get(k) for k in ("platform", "handle", "url", "caption", "views", "likes", "comments", "ts")})
        if len(out) >= n:
            break
    return out


def fmt(n: int) -> str:
    n = int(n or 0)
    return f"{n / 1e6:.1f}M" if n >= 1e6 else f"{n / 1e3:.0f}K" if n >= 1e3 else str(n)


# ---------- البرومبتات
def brand_info(brain: dict) -> str:
    return "\n".join(f"{t}: {brain.get(k)}" for k, t in (("name", "البراند"), ("domain", "المجال"), ("about", "عنه"), ("audience", "الجمهور"),
                                                          ("market", "السوق/البلد"), ("language", "اللغة واللهجة")) if brain.get(k))[:2000]


def queries_messages(brain: dict) -> list[dict]:
    return [{"role": "system", "content": "You find the biggest short-video creators in a niche. Return JSON only."},
            {"role": "user", "content": f"""{brand_info(brain)}

Write the search queries people in this market would actually type on TikTok and Instagram Reels to find content creators in this exact niche,
in the market's own language and dialect (Arabic dialect words if the market is Arab), plus 1-2 in English if creators there also post in English.
Include the city/country name in some of them. Short queries, 1-3 words, no hashtags symbols.
Return JSON: {{"queries": ["...", "...", "...", "..."]}} with 4 to 6 queries."""}]


def pick_messages(brain: dict, cands: list[dict], n: int) -> list[dict]:
    lines = "\n".join(f"[{i}] {c['platform']} @{c['handle']} ({c['name']}) · {c['hits']} posts in results · top {fmt(c['top_views'])} views · "
                      + " | ".join(s['caption'][:90] for s in c['samples']) for i, c in enumerate(cands))
    return [{"role": "system", "content": "You pick the real competitors of a brand. Return JSON only."},
            {"role": "user", "content": f"""{brand_info(brain)}

These accounts came up when searching the niche. Pick the {n} that are the closest competitors (same niche, same audience, same market/country),
preferring the highest views. Skip news pages, meme pages, unrelated viral accounts, and accounts from a clearly different country or language.
{lines}

Return JSON: {{"picks": [{{"i": 0, "why": "بالعربي المصري في جملة قصيرة: ليه ده منافس"}}]}} ordered best first, at most {n}."""}]


def digest_messages(brain: dict, items: list[dict]) -> list[dict]:
    blocks = []
    for c in items:
        posts = "\n".join(f"  ×{p['multiple']} · {fmt(p['views'])} views · caption: {p['caption'][:200]}" + (f" · spoken: {p['spoken'][:300]}" if p.get("spoken") else "")
                          for p in c.get("posts", [])[:6])
        blocks.append(f"@{c['handle']} ({c['platform']}, median {fmt(c['median_views'])} views):\n{posts}")
    return [{"role": "system", "content": "You are a short-form content strategist. Return JSON only.\n\n" + algo.for_use("analysis")},
            {"role": "user", "content": f"""{brand_info(brain)}

Here are the brand's top competitors and their posts that beat their own median the most (×multiple = views ÷ that account's median).
A high multiple means the IDEA worked, not the account. Find what repeats in the winners.
{chr(10).join(blocks)}

Write everything in simple Egyptian Arabic. Return JSON:
{{"hooks": ["نوع هوك بيكسب عندهم + مثال قصير منهم", "..."],
  "concepts": ["فكرة/زاوية محتوى بتجيب مشاهدات عالية عندهم", "..."],
  "formats": ["شكل/هيكل الفيديو (مثلًا: قبل وبعد، قايمة ٣ حاجات، رد على كومنت)", "..."],
  "angles": ["زاوية ممكن البراند ياخدها ومحدش منهم عاملها كويس", "..."],
  "avoid": ["حاجة بتجيب مشاهدات قليلة عندهم", "..."],
  "summary": "جملتين: إيه اللي بينجح في المجال ده دلوقتي"}}
3 to 5 items in each list."""}]


def clean_digest(raw: dict) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    out = {k: [str(x)[:300] for x in raw.get(k) or [] if str(x).strip()][:6] for k in ("hooks", "concepts", "formats", "angles", "avoid")}
    out["summary"] = str(raw.get("summary") or "")[:600]
    return out


def insight_text(brain: dict | None) -> str:
    """اللي بيدخل في برومبت الأفكار والسكريبتات."""
    c = (brain or {}).get("competitors") or {}
    items = [i for i in c.get("items") or [] if i.get("posts")]
    if not items and not c.get("trending"):
        return ""
    lines = ["منافسين البراند في نفس المجال والسوق (أعلى مشاهدات). اتعلّم من الفكرة والهوك والهيكل اللي نجح عندهم، وماتنسخش كلامهم:"]
    for i in items[:TOP]:
        lines.append(f"- @{i['handle']} ({PLATFORMS.get(i['platform'], i['platform'])}، متوسطه {fmt(i.get('median_views'))}):")
        for p in i["posts"][:3]:
            hook = (p.get("spoken") or p.get("caption") or "").split("\n")[0][:140]
            lines.append(f"  ×{p.get('multiple')} ({fmt(p.get('views'))}): {hook}")
    if tr := c.get("trending") or []:
        lines.append("أعلى بوستات في المجال آخر ٣٠ يوم (الترند دلوقتي):")
        lines += [f"  {fmt(p.get('views'))} @{p.get('handle')}: {(p.get('caption') or '').split(chr(10))[0][:120]}" for p in tr[:5]]
    d = c.get("digest") or {}
    for k, t in (("hooks", "هوكات بتكسب عندهم"), ("concepts", "أفكار بتجيب مشاهدات"), ("formats", "أشكال ناجحة"), ("angles", "زوايا فاضية ينفع ناخدها"), ("avoid", "بيجيب مشاهدات قليلة")):
        if d.get(k):
            lines.append(f"{t}: " + " · ".join(d[k][:5]))
    lines.append("لما تختار الهوك والفكرة: خليها على نفس نمط البوستات اللي عدّت متوسطها بكتير، بس بزاوية البراند وصوته.")
    return "\n".join(lines)[:2500]


# ---------- داتا تجريبية (من غير مفتاح)
def _h(s: str) -> int:
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16)


MOCK_HOOKS = ["أكتر غلطة بتعملها كل يوم ومش واخد بالك", "جربت ده ٣٠ يوم وده اللي حصل", "محدش هيقولك السر ده", "٣ حاجات لو عرفتها من بدري",
              "رد على كومنت: هو ده بجد بيفرق؟", "قبل وبعد في أسبوع واحد", "ده اللي بيحصل لما تعمل كده", "متشتريش قبل ما تشوف ده"]


def mock_posts(platform: str, handle: str, now: float | None = None) -> list[dict]:
    now = now or time.time()
    s = _h(platform + handle)
    base = 20000 + s % 180000
    out = []
    for k in range(12):
        v = base * (1 + (_h(f"{handle}{k}") % 9) / 3) * (6 if k in (2, 7) else 1)
        out.append({"platform": platform, "id": f"m{s % 999}{k}", "handle": handle, "name": handle.replace("_", " ").title(), "followers": base * 12,
                    "url": f"https://example.com/{handle}/{k}", "caption": MOCK_HOOKS[(s + k) % len(MOCK_HOOKS)] + " #تجربة",
                    "views": int(v), "likes": int(v / 12), "comments": int(v / 150), "shares": int(v / 300), "ts": int(now - k * 3 * 86400)})
    return out


def mock_search(brain: dict) -> list[dict]:
    seed = re.sub(r"[^a-z]", "", (brain.get("domain") or "niche").encode("ascii", "ignore").decode().lower())[:6] or "niche"
    out = []
    for k in range(9):
        plat = "tiktok" if k % 2 == 0 else "instagram"
        out += mock_posts(plat, f"{seed}_creator{k + 1}")[:2 + k % 3]
    return out


def mock_digest() -> dict:
    return {"hooks": ["«أكتر غلطة…»: بيبدأ بالغلطة اللي الجمهور بيعملها", "«جربت ٣٠ يوم»: تجربة شخصية بنتيجة"],
            "concepts": ["قبل وبعد في وقت قصير", "رد على كومنت فيه شك"], "formats": ["قايمة ٣ حاجات بسرعة", "قبل/بعد في نفس الكادر"],
            "angles": ["محدش بيشرح السعر بصراحة"], "avoid": ["الفيديوهات الإعلانية المباشرة من غير قصة"],
            "summary": "تجربة: البوستات اللي بتبدأ بغلطة أو تجربة شخصية بتعدّي متوسطها بكتير."}
