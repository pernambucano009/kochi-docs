"""📈 الترند (دراع تلقائيًا في عقل العلامة): ما حسنًا الآن في سوق العلامة ومجاله.

يُحدّث تلقائيًا كل قليلًا: ندوّر بكلام الأشخاص في السوق (نفس بحث المنافسين)، ونأخذ أعلى المنشورات في آخر أيام،
والعقل يجمّعهم في ترندات (موضوع/صوت/شكل حسنًا) ولكل ترند زاوية للعلامة. الجديد يتعدّ في المربع الأحمر حتى ما تفتحه،
والترند يظل في القائمة حتى ما تحذفه. أي ترند يمكنك تستخدمه في منشور الآن، أو تحفظه لبعدين ويظهرلك وأنت تختار الفكرة.
"""
from __future__ import annotations

import re
import time
import uuid

EVERY = 12 * 3600      # كل قد إيه بيتحدّث لوحده
WINDOW = 10 * 86400    # البوستات اللي في آخر ١٠ أيام بس هي «ترند»
KEEP = 60              # أقصى عدد ترندات في القايمة


def recent(posts: list[dict], now: float | None = None, n: int = 24) -> list[dict]:
    now = now or time.time()
    seen, out = set(), []
    for p in sorted(posts, key=lambda p: -(p.get("views") or 0)):
        if p.get("id") in seen or not p.get("ts") or now - p["ts"] > WINDOW:
            continue
        seen.add(p.get("id"))
        out.append({k: p.get(k) for k in ("platform", "handle", "url", "caption", "views", "ts")})
        if len(out) >= n:
            break
    return out


def messages(brand: str, market: str, posts: list[dict], old_titles: list[str]) -> list[dict]:
    lines = "\n".join(f"[{i}] {p.get('platform')} @{p.get('handle')} · {p.get('views')} views · {(p.get('caption') or '')[:220]}" for i, p in enumerate(posts))
    return [{"role": "system", "content": "You spot what is trending right now in a market for short-form video. Return JSON only."},
            {"role": "user", "content": f"""Brand:
{brand}
Market: {market or "-"}

These are the most viewed posts of the last days in this niche and market:
{lines or "(none)"}

Group them into the real trends happening now (a topic, a sound/meme format, a challenge, a news moment, a question people keep asking).
Only real trends supported by the posts above (cite their indexes). Max 6. Skip anything already known: {old_titles[:40]}
For each: a short Arabic title, what the trend is (one sentence, Egyptian Arabic), and an angle for THIS brand (one sentence, Egyptian Arabic).
Return JSON: {{"trends": [{{"title": "...", "what": "...", "angle": "...", "posts": [0, 3]}}]}}"""}]


def _norm(s: str) -> str:
    return re.sub(r"[\W_]+", " ", str(s or "").lower()).strip()


def similar(a: str, b: str) -> bool:
    wa, wb = set(_norm(a).split()), set(_norm(b).split())
    return bool(wa and wb) and len(wa & wb) / max(1, min(len(wa), len(wb))) >= .6


def clean(raw: dict, posts: list[dict], old: list[dict]) -> list[dict]:
    out = []
    for t in (raw or {}).get("trends") or []:
        if not isinstance(t, dict) or not str(t.get("title") or "").strip():
            continue
        title = str(t["title"]).strip()[:90]
        if any(similar(title, o.get("title", "")) for o in [*old, *out]):
            continue
        src = []
        for i in t.get("posts") or []:
            try:
                p = posts[int(i)]
            except (TypeError, ValueError, IndexError):
                continue
            src.append({k: p.get(k) for k in ("platform", "handle", "url", "views", "ts", "caption")})
        out.append({"id": uuid.uuid4().hex[:8], "title": title, "what": str(t.get("what") or "")[:300], "angle": str(t.get("angle") or "")[:300],
                    "posts": src[:4], "at": time.time(), "seen": False})
    return out[:6]


def mock(old: list[dict], n: int = 2) -> list[dict]:
    k = len(old)
    pool = [("تحدي «يوم في حياتي» بالجوال", "أشخاص كثير تصور يومها في ٣٠ ثانية بلقطات سريعة", "صوّر يوم في العلامة من خلف الكواليس"),
            ("سؤال «ماذا أكثر شيء ندمت عليها؟»", "الأشخاص ترد على هذا السؤال في فيديوهات قصيرة", "رد بغلطة شائعة في مجالك وكيف تتجنبها"),
            ("صوت «قبل وبعد» الهادي", "صوت هادي مع تحوّل قبل وبعد", "اعرض نتيجة حقيقية لعميل قبل وبعد"),
            ("ترند «٣ أشياء محدش قالهالك»", "قوائم سريعة بمعلومات غير معروفة", "٣ معلومات في مجالك الأشخاص لا عارفاها")]
    out = []
    for i in range(n):
        t, w, a = pool[(k + i) % len(pool)]
        if any(similar(t, o.get("title", "")) for o in old):
            continue
        out.append({"id": uuid.uuid4().hex[:8], "title": t, "what": w, "angle": a, "posts": [], "at": time.time(), "seen": False})
    return out


def merge(old: list[dict], new: list[dict]) -> list[dict]:
    """الجديد أعلى، والقديم يظل (حتى ما تحذفه)، بحد أقصى."""
    return [*new, *old][:KEEP]


def to_saved(t: dict) -> dict:
    """الترند داخل «محفوظاتك لبعدين»: يُعرض بجانب الأفكار، وعندما تستخدمه الأفكار تُبنى عليه."""
    return {"title": t.get("title") or "", "idea": t.get("what") or "", "hook": t.get("angle") or "",
            "url": (t.get("posts") or [{}])[0].get("url") if t.get("posts") else ""}


def hint(item: dict) -> str:
    return (f"ابنِ الأفكار على هذا الترند ما حسنًا الآن في السوق: «{item.get('title', '')}». "
            f"الترند: {item.get('idea', '')}. زاوية مقترحة للعلامة: {item.get('hook', '')}. "
            "اجعل كل فكرة مرتبطة بالترند بوضوح، ومن غير ما تنسخ منشور حد.")
