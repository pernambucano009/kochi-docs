"""🏆 صفوة المجال: أحسن الصفحات في نيتش واحد وأكتر فيديوهاتها إبداعًا، عشان صاحب المنصة يختار منها ونفكّكها لقوالب.
البحث بكلمات المجال (بكل اللغات، الإبداع ملوش جنسية) + صفحات يديها صاحب المنصة بنفسه؛ لكل صفحة بنجيب فيديوهاتها
ونحسب كل فيديو عدّى متوسط صفحته بكام (ده مقياس الإبداع الحقيقي، مش المشاهدات لوحدها). الاختيار النهائي بإيد صاحب المنصة."""
from __future__ import annotations

import json
import math
import re
import statistics
import threading
import time
from pathlib import Path

import httpx

import rivals

NICHES = {
    "dental": {"name": "طب الأسنان", "queries": [
        "dentist", "cosmetic dentistry", "smile makeover", "veneers", "dental veneers", "dental implants", "teeth whitening",
        "dentistry", "dental clinic", "orthodontics", "تجميل الاسنان", "ابتسامة هوليود", "دكتور اسنان", "عيادة اسنان",
        "odontologia", "dentista", "lentes de contato dental", "estetica dental", "carillas dentales", "diş hekimi"]},
}
SEARCH_PAGES = 30   # كام صفحة من نتايج البحث بنجيب فيديوهاتها كلها
MIN_VIEWS = 10000
_lock = threading.Lock()
_jobs: dict[str, dict] = {}


def root(base: Path, niche: str) -> Path:
    d = base / "elite" / re.sub(r"[^a-z]", "", niche)
    (d / "thumbs").mkdir(parents=True, exist_ok=True)
    return d


def load(base: Path, niche: str) -> dict:
    try:
        return json.loads((root(base, niche) / "state.json").read_text("utf-8"))
    except (OSError, ValueError):
        return {"niche": niche, "pages": {}, "videos": {}, "seeds": []}


def save(base: Path, niche: str, st: dict) -> None:
    f = root(base, niche) / "state.json"
    tmp = f.with_suffix(".tmp")
    tmp.write_text(json.dumps(st, ensure_ascii=False), "utf-8")
    tmp.replace(f)


# ---------------------------------------------------------------- الرد الخام ← فيديو موحّد (ومعاه الصورة المصغرة ولينك الفيديو للتفكيك بعدين)
def _first(*vals) -> str:
    for v in vals:
        if isinstance(v, list) and v:
            v = v[0]
        if isinstance(v, dict):
            v = v.get("url") or (v.get("url_list") or [None])[0]
        if isinstance(v, str) and v.startswith("http"):
            return v
    return ""


def norm(platform: str, raw: dict) -> dict | None:
    if platform == "tiktok":
        p = rivals.norm_tt(raw)
        if not p:
            return None
        v = raw.get("video") if isinstance(raw.get("video"), dict) else {}
        p.update(thumb=_first(v.get("cover"), v.get("origin_cover"), v.get("dynamic_cover")), media=_first(v.get("play_addr"), v.get("download_addr")),
                 seconds=round(rivals._num(v.get("duration")) / 1000, 1) if rivals._num(v.get("duration")) > 1000 else rivals._num(v.get("duration")))
        return p
    m = raw.get("media") if isinstance(raw.get("media"), dict) else raw
    p = rivals.norm_ig(raw)
    if not p:
        return None
    iv = m.get("image_versions2") if isinstance(m.get("image_versions2"), dict) else {}
    p.update(thumb=_first(iv.get("candidates"), m.get("thumbnail_url"), m.get("display_uri"), m.get("display_url")),
             media=_first(m.get("video_versions"), m.get("video_url")), seconds=round(float(m.get("video_duration") or 0), 1))
    return p


def search(platform: str, query: str) -> list[dict]:
    if platform == "tiktok":
        d = rivals._get("/v1/tiktok/search/keyword", {"query": query, "sort_by": "relevance"})
        raw = [e.get("aweme_info", e) for e in d.get("search_item_list") or d.get("data") or [] if isinstance(e, dict)]
    else:
        d = rivals._get("/v2/instagram/reels/search", {"query": query})
        raw = d.get("reels") or d.get("items") or d.get("data") or []
    return [p for p in (norm(platform, r) for r in raw if isinstance(r, dict)) if p]


def page_videos(platform: str, handle: str) -> list[dict]:
    if platform == "tiktok":
        d = rivals._get("/v3/tiktok/profile/videos", {"handle": handle, "sort_by": "latest"})
        raw = d.get("aweme_list") or d.get("data") or []
    else:
        d = rivals._get("/v1/instagram/user/reels", {"handle": handle})
        raw = d.get("items") or d.get("data") or []
    return [p for p in (norm(platform, r) for r in raw if isinstance(r, dict)) if p]


def mock_page(platform: str, handle: str) -> list[dict]:
    return [{**p, "thumb": "", "media": "", "seconds": 20 + i} for i, p in enumerate(rivals.mock_posts(platform, handle))]


# ---------------------------------------------------------------- الترتيب: فيديو عدّى متوسط صفحته بكتير + مشاهداته عالية
def score(v: dict) -> float:
    return round(math.log10(max(v.get("views") or 1, 1)) * min(max(v.get("multiple") or 1, 1), 12), 2)


def add_page(st: dict, platform: str, handle: str, vids: list[dict], seed: bool) -> None:
    mine = [v for v in vids if v["handle"].lower() == handle.lower()] or vids
    views = [v["views"] for v in mine if v.get("views")]
    med = int(statistics.median(views)) if views else 0
    key = f"{platform}:{handle.lower()}"
    old = st["pages"].get(key) or {}
    st["pages"][key] = {"platform": platform, "handle": handle, "name": (mine[0].get("name") if mine else "") or handle,
                        "followers": max([v.get("followers") or 0 for v in mine] + [0]), "median": med, "count": len(mine),
                        "seed": seed or old.get("seed", False), "state": old.get("state", ""), "at": int(time.time())}
    for v in mine:
        vid = f"{platform}:{v['id']}"
        mult = round(v["views"] / med, 1) if med else 0
        keep = seed or (v["views"] >= MIN_VIEWS and mult >= 1.5)
        if not keep and vid not in st["videos"]:
            continue
        o = st["videos"].get(vid) or {}
        st["videos"][vid] = {**{k: v.get(k) for k in ("platform", "id", "handle", "url", "caption", "views", "likes", "comments", "ts", "thumb", "media", "seconds")},
                             "page": key, "followers": st["pages"][key]["followers"], "multiple": mult, "state": o.get("state", ""), "note": o.get("note", ""),
                             "thumb_file": o.get("thumb_file", "")}
        st["videos"][vid]["score"] = score(st["videos"][vid])
    # من كل صفحة مش مزروعة بنسيب أعلى ٦ بس (اللي مختار أو مستبعد بيفضل زي ما هو)
    if not seed:
        rows = sorted((x for x in st["videos"].values() if x["page"] == key and not x["state"]), key=lambda x: -x["score"])
        for x in rows[6:]:
            st["videos"].pop(f"{x['platform']}:{x['id']}", None)


def fetch_thumbs(base: Path, niche: str, st: dict) -> None:
    d = root(base, niche) / "thumbs"
    with httpx.Client(timeout=25, follow_redirects=True) as c:
        for vid, v in st["videos"].items():
            if v.get("thumb_file") or not v.get("thumb"):
                continue
            name = re.sub(r"[^A-Za-z0-9_-]", "_", vid) + ".jpg"
            try:
                r = c.get(v["thumb"])
                if r.status_code < 400 and r.content[:3] in (b"\xff\xd8\xff", b"RIF", b"\x89PN"):
                    (d / name).write_bytes(r.content)
                    v["thumb_file"] = name
            except httpx.HTTPError:
                continue


def clean_seeds(text: str) -> list[dict]:
    out = []
    for line in re.split(r"[\s,،]+", text or ""):
        if not line.strip():
            continue
        h = rivals.clean_handle(line)
        if h:
            out.append({"platform": "tiktok" if "tiktok.com" in line else "instagram", "handle": h})
    return out[:40]


def job(niche: str) -> dict:
    return _jobs.get(niche) or {}


def discover(base: Path, niche: str, seeds: list[dict], use_search: bool, mock: bool) -> None:
    """بيشتغل في الخلفية: الصفحات المزروعة كلها + البحث بكلمات المجال ← أعلى الصفحات ← فيديوهاتها ← الصور المصغرة."""
    J = _jobs[niche] = {"status": "running", "step": "", "done": 0, "total": 0, "error": "", "at": int(time.time())}
    try:
        with _lock:
            st = load(base, niche)
        known = {(s["platform"], s["handle"].lower()) for s in st.get("seeds") or []}
        st["seeds"] = (st.get("seeds") or []) + [s for s in seeds if (s["platform"], s["handle"].lower()) not in known]
        pages: list[tuple[str, str, bool]] = [(s["platform"], s["handle"], True) for s in seeds]
        if use_search:
            hits: list[dict] = []
            qs = NICHES[niche]["queries"]
            J.update(step="search", total=len(qs) * 2)
            for q in qs:
                for plat in ("instagram", "tiktok"):
                    try:
                        hits += rivals.mock_posts(plat, f"{re.sub(r'[^a-z]', '', q)[:8] or 'dent'}_{plat[:2]}") if mock else search(plat, q)
                    except rivals.RivalsError as exc:
                        J["error"] = str(exc)
                    J["done"] += 1
            rejected = {k for k, p in st["pages"].items() if p.get("state") == "rejected"}
            for c in rivals.candidates(hits, rejected)[:SEARCH_PAGES]:
                if all(c["handle"].lower() != h.lower() for _, h, _ in pages):
                    pages.append((c["platform"], c["handle"], False))
        J.update(step="pages", done=0, total=len(pages))
        for plat, handle, seed in pages:
            try:
                vids = mock_page(plat, handle) if mock else page_videos(plat, handle)
                with _lock:
                    st = {**load(base, niche), "seeds": st["seeds"]}
                    add_page(st, plat, handle, vids, seed)
                    save(base, niche, st)
            except rivals.RivalsError as exc:
                J["error"] = f"@{handle}: {exc}"
            J["done"] += 1
        J.update(step="thumbs")
        with _lock:
            st = load(base, niche)
        if not mock:
            fetch_thumbs(base, niche, st)
        with _lock:
            cur = load(base, niche)
            for vid, v in st["videos"].items():
                if vid in cur["videos"] and v.get("thumb_file"):
                    cur["videos"][vid]["thumb_file"] = v["thumb_file"]
            cur["updated_at"] = int(time.time())
            save(base, niche, cur)
        J.update(status="done", step="")
    except Exception as exc:  # noqa: BLE001
        J.update(status="failed", error=str(exc)[:300])


# ---------------------------------------------------------------- 🎞️ الفيديو نفسه يشتغل جوه اللوحة (بيتحمّل أول مرة يظهر ويتخزن)
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
MAX_MB = 80


def _safe(key: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "_", key)


def _download(url: str, dest: Path, platform: str) -> bool:
    """من غير Referer الأول (بعض الـ CDN بيرفضه)، وبعدين بـ Referer المنصة (تيك توك أحيانًا بيطلبه)."""
    if not url:
        return False
    ref = "https://www.tiktok.com/" if platform == "tiktok" else "https://www.instagram.com/"
    return any(_get_file(url, dest, h) for h in (UA, {**UA, "Referer": ref}))


def _get_file(url: str, dest: Path, h: dict) -> bool:
    tmp = dest.with_suffix(".part")
    try:
        with httpx.Client(timeout=60, follow_redirects=True) as c, c.stream("GET", url, headers=h) as r:
            if r.status_code >= 400:
                return False
            n = 0
            with tmp.open("wb") as f:
                for chunk in r.iter_bytes(1 << 16):
                    n += len(chunk)
                    if n > MAX_MB << 20:
                        raise ValueError("too big")
                    f.write(chunk)
        head = tmp.read_bytes()[:12]
        if n < 20000 or head[4:8] != b"ftyp":
            tmp.unlink(missing_ok=True)
            return False
        tmp.replace(dest)
        return True
    except (httpx.HTTPError, OSError, ValueError):
        tmp.unlink(missing_ok=True)
        return False


def fresh_media(v: dict) -> str:
    """لينكات الفيديو بتنتهي بعد شوية: بنجيب لينك جديد للبوست نفسه."""
    try:
        if v["platform"] == "tiktok":
            d = rivals._get("/v2/tiktok/video", {"url": v["url"]}, 40)
            raw = d.get("aweme_detail") or d.get("data") or d
        else:
            d = rivals._get("/v1/instagram/post", {"url": v["url"]}, 40)
            raw = (d.get("data") or {}).get("xdt_shortcode_media") or d.get("data") or d
        p = norm(v["platform"], raw) if isinstance(raw, dict) else None
        return (p or {}).get("media") or (raw.get("video_url") if isinstance(raw, dict) else "") or ""
    except rivals.RivalsError:
        return ""


def media_file(base: Path, niche: str, key: str) -> Path | None:
    d = root(base, niche) / "media"
    d.mkdir(exist_ok=True)
    f = d / (_safe(key) + ".mp4")
    if f.exists():
        return f
    v = load(base, niche)["videos"].get(key)
    if not v:
        return None
    if _download(v.get("media") or "", f, v["platform"]):
        return f
    url = fresh_media(v) if rivals.live() else ""
    if url and _download(url, f, v["platform"]):
        with _lock:
            st = load(base, niche)
            if key in st["videos"]:
                st["videos"][key]["media"] = url
                save(base, niche, st)
        return f
    return None


def mark(base: Path, niche: str, kind: str, key: str, state: str, note: str = "") -> dict:
    with _lock:
        st = load(base, niche)
        if kind == "page":
            p = st["pages"].get(key)
            if not p:
                return {}
            p["state"] = state
            if state == "rejected":   # فيديوهات الصفحة المستبعدة بتختفي (إلا اللي اخترته قبل كده)
                st["videos"] = {k: v for k, v in st["videos"].items() if v["page"] != key or v.get("state") == "picked"}
        else:
            v = st["videos"].get(key)
            if not v:
                return {}
            v["state"] = state
            if state == "skipped":   # المستبعد ملوش لازمة يفضل واخد مساحة
                (root(base, niche) / "media" / (_safe(key) + ".mp4")).unlink(missing_ok=True)
            if note:
                v["note"] = note[:500]
        save(base, niche, st)
        return st


def view(base: Path, niche: str) -> dict:
    st = load(base, niche)
    vids = sorted(st["videos"].values(), key=lambda v: (v.get("state") != "picked", v.get("state") == "skipped", -v.get("score", 0)))
    pages = sorted(st["pages"].items(), key=lambda kv: (kv[1].get("state") == "rejected", not kv[1].get("seed"), -kv[1].get("median", 0)))
    return {"niche": niche, "name": NICHES[niche]["name"], "queries": NICHES[niche]["queries"], "job": job(niche),
            "videos": [{**v, "key": f"{v['platform']}:{v['id']}"} for v in vids], "pages": [{**p, "key": k} for k, p in pages],
            "seeds": st.get("seeds") or [], "updated_at": st.get("updated_at"),
            "counts": {"videos": len(vids), "picked": sum(v.get("state") == "picked" for v in vids), "pages": len(pages)}}
