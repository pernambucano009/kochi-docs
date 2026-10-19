"""📱 حساب سوشيال ← العقل: البايو والمعلومات، الصور والفيديوهات (كل واحدة في مكانها)، النيتش، وتحليل البوستات والمشاهدات،
وتحليل أحسن وأضعف الفيديوهات (الأخطاء واللي ناقص) كـ «نقاط لازم تتشتغل».

الداتا من ScrapeCreators (نفس مفتاح «نبض المجال»). من غير المفتاح أو في وضع التجربة بيشتغل بداتا تجريبية.
"""
from __future__ import annotations

import json
import re
import statistics
import time
import uuid

import brainsrc
import rivals

KINDS = {"products": "صور المنتج", "characters": "شخصيات البراند / صاحب الحساب", "sets": "الأماكن والخلفيات", "props": "الأدوات", "logos": "اللوجو"}


def parse(s: str) -> tuple[str, str]:
    """لينك أو @يوزر ← (المنصة، اليوزر)."""
    s = str(s or "").strip()
    plat = "tiktok" if "tiktok.com" in s else "instagram"
    if re.match(r"^tiktok\s*[:@]", s, re.I) or s.lower().startswith("tt:"):
        plat = "tiktok"
    h = rivals.clean_handle(re.sub(r"^(tiktok|instagram|ig|tt)\s*[:]\s*", "", s, flags=re.I))
    return plat, h


def _first(*vals):
    for v in vals:
        if v:
            return v
    return None


def _url(x) -> str:
    if isinstance(x, str):
        return x
    if isinstance(x, dict):
        return str(_first(x.get("url"), (x.get("url_list") or [None])[0]) or "")
    if isinstance(x, list) and x:
        return _url(x[0])
    return ""


def profile(plat: str, handle: str) -> dict:
    """بيانات الحساب نفسه: الاسم والبايو والمتابعين والصورة واللينك."""
    if plat == "tiktok":
        d = rivals._get("/v1/tiktok/profile", {"handle": handle})
        u = (d.get("userInfo") or {}).get("user") or d.get("user") or {}
        st = (d.get("userInfo") or {}).get("stats") or d.get("stats") or {}
        return {"platform": plat, "handle": handle, "name": u.get("nickname") or handle, "bio": u.get("signature") or "",
                "followers": rivals._num(st.get("followerCount")), "posts": rivals._num(st.get("videoCount")),
                "avatar": _url(_first(u.get("avatarLarger"), u.get("avatarMedium"))), "link": (u.get("bioLink") or {}).get("link") or "",
                "category": ""}
    d = rivals._get("/v1/instagram/profile", {"handle": handle})
    u = ((d.get("data") or {}).get("user")) or d.get("user") or {}
    return {"platform": plat, "handle": handle, "name": u.get("full_name") or handle, "bio": u.get("biography") or "",
            "followers": rivals._num((u.get("edge_followed_by") or {}).get("count") or u.get("follower_count")),
            "posts": rivals._num((u.get("edge_owner_to_timeline_media") or {}).get("count") or u.get("media_count")),
            "avatar": _url(_first(u.get("profile_pic_url_hd"), u.get("profile_pic_url"))), "link": u.get("external_url") or "",
            "category": u.get("category_name") or u.get("business_category_name") or ""}


def _media(plat: str, raw: dict) -> tuple[str, str]:
    """(صورة الغلاف، لينك الفيديو) من البوست الخام."""
    if plat == "tiktok":
        v = raw.get("video") or {}
        return _url(_first(v.get("cover"), v.get("origin_cover"), v.get("dynamic_cover"))), _url(_first(v.get("play_addr"), v.get("download_addr")))
    m = raw.get("media") if isinstance(raw.get("media"), dict) else raw
    cand = ((m.get("image_versions2") or {}).get("candidates") or [])
    return _url(_first(cand[0] if cand else None, m.get("display_uri"), m.get("thumbnail_url"), m.get("display_url"))), _url(_first(m.get("video_versions"), m.get("video_url")))


def posts(plat: str, handle: str) -> list[dict]:
    """آخر البوستات بأرقامها وصورة الغلاف ولينك الفيديو."""
    if plat == "tiktok":
        d = rivals._get("/v3/tiktok/profile/videos", {"handle": handle, "sort_by": "latest"})
        raws, norm = d.get("aweme_list") or d.get("data") or [], rivals.norm_tt
    else:
        d = rivals._get("/v1/instagram/user/reels", {"handle": handle})
        raws, norm = d.get("items") or d.get("data") or [], rivals.norm_ig
    out = []
    for raw in raws[:30]:
        p = norm(raw)
        if p:
            p["cover"], p["video"] = _media(plat, raw)
            out.append(p)
    return out


def stats(items: list[dict]) -> dict:
    """أرقام الحساب: متوسط ووسيط المشاهدات، التفاعل، وكل قد إيه بينزل، وأحسن وأضعف بوستات."""
    if not items:
        return {"n": 0}
    views = [p["views"] for p in items if p.get("views")]
    eng = [(p["likes"] + p["comments"] + p.get("shares", 0)) / p["views"] for p in items if p.get("views")]
    ts = sorted(p["ts"] for p in items if p.get("ts"))
    gaps = [(b - a) / 86400 for a, b in zip(ts, ts[1:])]
    by = sorted([p for p in items if p.get("views")], key=lambda p: p["views"], reverse=True)
    return {"n": len(items), "avg_views": int(statistics.mean(views)) if views else 0, "median_views": int(statistics.median(views)) if views else 0,
            "engagement": round(statistics.mean(eng) * 100, 2) if eng else 0, "every_days": round(statistics.median(gaps), 1) if gaps else None,
            "best": [p["id"] for p in by[:3]], "worst": [p["id"] for p in by[-3:][::-1]] if len(by) > 3 else []}


def analyze_prompt(prof: dict, st: dict, items: list[dict], videos: list[dict], n_imgs: int, brain_txt: str, fields: dict) -> str:
    rows = [{"id": p["id"], "views": p["views"], "likes": p["likes"], "comments": p["comments"], "caption": p["caption"][:300],
             "days_ago": round((time.time() - p["ts"]) / 86400) if p.get("ts") else None} for p in items[:25]]
    return (
        "انت محلل محتوى سوشيال وبتبني «عقل» لبراند (ذاكرة بتتقري في كل سكريبت وفيديو بيتعمل له). عندك حساب البراند نفسه:\n"
        f"الحساب: {json.dumps({k: prof[k] for k in ('platform', 'handle', 'name', 'bio', 'followers', 'posts', 'link', 'category')}, ensure_ascii=False)}\n"
        f"الأرقام: {json.dumps(st, ensure_ascii=False)}\n"
        f"آخر البوستات: {json.dumps(rows, ensure_ascii=False)}\n"
        f"فيديوهات اتفرّغ كلامها (ومعاها لقطات منها بالترتيب في الصور): {json.dumps(videos, ensure_ascii=False)}\n"
        f"وفيه {n_imgs} صورة بالترتيب: الأول لقطات الفيديوهات، وبعدين صور أغلفة البوستات وصورة البروفايل (images_from).\n\n"
        "اللي في العقل دلوقتي:\n" + (brain_txt or "(لسه فاضي)") + "\n\n"
        "المطلوب JSON:\n"
        "1) fields: قيم للخانات دي لو الحساب بيقولها بوضوح: " + brainsrc.fields_desc() + ". " + brainsrc.FIELD_RULES +
        "2) niche: النيتش بالظبط في جملة (المجال + الجمهور + الزاوية).\n"
        "3) notes: معرفة مهمة عن الشخص أو البراند (اللي بيقدمه، أسلوبه، المواضيع اللي بيتكلم فيها، أكتر حاجة بتنجح عنده وليه). كل note موضوع واحد.\n"
        "4) todos: «نقاط لازم تتشتغل»: أخطاء حقيقية شفتها ولقطات ناقصة (الهوك، أول ٣ ثواني، الإضاءة والصوت، الكلام على الشاشة، طول الفيديو، "
        "الدعوة للفعل، انتظام النشر، البايو، الفرق بين أحسن وأضعف بوستات). كل نقطة: title قصير، why (الدليل من الأرقام أو الفيديو)، how (تتصلّح إزاي بالظبط). من ٣ لـ ٨ نقاط.\n"
        "5) images: لكل صورة من صور الأغلفة والبروفايل (بالرقم i من 0 في images_from) حدد kind من: " + "، ".join(f"{k} ({v})" for k, v in KINDS.items())
        + " أو skip لو مش مفيدة للعقل، ووصف قصير description.\n"
        "ممنوع تخترع معلومة مش موجودة في الحساب. اكتب بالعربي.\n"
        'الشكل: {"fields":{"<خانة>":{"value":"","why":""}},"niche":"","notes":[{"section":"identity|voice|products|offers|audience|campaigns|other","title":"","summary":"","body":""}],'
        '"todos":[{"title":"","why":"","how":""}],"images":[{"i":0,"kind":"","description":""}]}'
    )


def mock_posts(plat: str, handle: str) -> tuple[dict, list[dict]]:
    now = time.time()
    prof = {"platform": plat, "handle": handle, "name": handle, "bio": "حساب تجريبي · نقدم خدمات للعملاء", "followers": 12400, "posts": 210,
            "avatar": "", "link": "https://example.com", "category": "Business"}
    items = [{"platform": plat, "id": f"p{i}", "handle": handle, "name": handle, "followers": 12400, "url": f"https://example.com/p{i}",
              "caption": f"بوست تجريبي رقم {i + 1}", "views": [52000, 3100, 8800, 1500, 26000, 4100, 2300, 9900][i % 8], "likes": 300 + i * 40,
              "comments": 12 + i, "shares": 3, "ts": int(now - i * 3 * 86400), "cover": "", "video": ""} for i in range(10)]
    return prof, items


def mock_out() -> dict:
    return {"fields": {"about": "حساب تجريبي بيقدم خدمات للعملاء"}, "niche": "خدمات للعملاء في السوق المحلي",
            "notes": [{"section": "campaigns", "title": "أكتر حاجة بتنجح عنده", "summary": "البوستات اللي فيها قبل وبعد بتجيب ٥ أضعاف المشاهدات", "body": ""}],
            "todos": [{"title": "الهوك ضعيف في أول ثانيتين", "why": "أضعف ٣ فيديوهات بيبدأوا بمقدمة وتحية", "how": "ابدأ بالنتيجة أو بسؤال، والتحية في الآخر"},
                      {"title": "النشر مش منتظم", "why": "بين البوستات من يوم لـ ١٢ يوم", "how": "٣ بوستات في الأسبوع في نفس المواعيد"}],
            "images": []}


def clean_todos(raw: list, source: str) -> list[dict]:
    out = []
    for t in raw or []:
        if isinstance(t, dict) and str(t.get("title") or "").strip():
            out.append({"id": "t" + uuid.uuid4().hex[:9], "title": str(t["title"]).strip()[:120],
                        "why": str(t.get("why") or "").strip()[:600], "how": str(t.get("how") or "").strip()[:800], "source": source, "done": False})
    return out[:10]
