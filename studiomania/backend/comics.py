"""🎭 مكتبة الكوميكس: كوميكس موجودة (GIF وصور وفيديوهات قصيرة) من مصادر كبيرة، وكل واحد مكتوب له سياقه
(الإحساس، الموقف، بيتقال إمتى، الجملة اللي فيه، اللهجة)، علشان أي أداة تستحضر الكوميك المناسب للكلام.

المصادر: KLIPY (KLIPY_API_KEY) و GIPHY (GIPHY_API_KEY) و Imgflip (قوالب الميمز، بدون مفتاح).
التجميع بيدوّر بكلمات كتير (عربي مصري وخليجي + إنجليزي) والمخ بيتفرج على كل واحد ويكتب سياقه.
"""
from __future__ import annotations

import hashlib
import os
import re

import httpx

KINDS = {"gif": "GIF", "clip": "فيديو بصوت", "meme": "ميم (صورة)", "sticker": "ستيكر", "image": "صورة"}
# التصنيفات الكبيرة اللي بتتفلتر وتتمسح بيها: صور (ميم وستيكر وصورة) / GIF / فيديوهات
GROUPS = {"images": ("صور", ("meme", "sticker", "image")), "gifs": ("GIF", ("gif",)), "videos": ("فيديوهات", ("clip",))}
EMOTIONS = ("صدمة", "ضحك", "فرحة", "احتفال", "حزن", "إحباط", "غضب", "سخرية", "استغراب", "تفكير", "كسوف", "خوف", "حماس", "ملل", "إعجاب",
            "رفض", "موافقة", "انتظار", "تعب", "حب", "ترحيب", "وداع", "نصر", "فشل", "توتر", "ارتياح", "فخر", "غيرة", "حيرة", "هدوء")

# كلمات التجميع: ردود فعل ومواقف يومية بالمصري والخليجي والفصحى والإنجليزي
SEEDS_AR = """يا نهار ابيض|ماذا هذا|لا قادر|حسنًا والله|يا سلام|حسنًا يا عم|انا مالي|اهدى|عيب هكذا|يا خبر|جميل جدًا|برافو|تحفة|حرام عليك|الله يسامحك|
غير فاهم|كيف أي|بجد|لا يا شيخ|انتهى|كفاية|هيا ينا|أين|انتظر|هموت من الضحك|ضحك|صدمة|مصدوم|زعلان|فرحان|غضبان|متعصب|مكسوف|خايف|مرعوب|زهقان|
تعبان|نايم|جعان|اكل|مال|مفلس|غني|عمل|مدير|موظف|امتحان|مذاكرة|نتيجة|نجحت|سقطت|مدرسة|جامعة|عيد|رمضان|فطار|سحور|عزومة|ماما|بابا|الحماة|الجواز|
عريس|عروسة|خطوبة|حب|قلب|غيرة|خيانة|صحاب|اخويا|جيران|زحمة|مواصلات|تاكسي|عربية|مرور|شتا|صيف|حر|برد|كورة|جون|ماتش|ملعب|رقص|غنا|
فرح|حفلة|مفاجأة|هدية|عيد ميلاد|سفر|اجازة|بحر|مصيف|دكتور|مستشفى|دوا|رجيم|جيم|تمرين|اكل صحي|كرش|نوم|صحيان|منبه|جوال|نت|واي فاي|
لايك|تعليق|اشتري|تسوق|خصم|غالي|رخيص|لا داعي|حسنًا|اوكي|لا|اه|اكيد|مستحيل|يمكن|لا تعرف|فكرة|عبقري|غبي|هبل|جنان|مجنون|تفكير|حيرة|انتظار|بسرعة|
ببطء|متأخر|معاد|وعد|كدب|صراحة|سر|فضيحة|مشكلة|حل|نجاح|فشل|تحدي|حماس|يأس|امل|دعاء|الحمد لله|ما شاء الله|ان شاء الله|سبحان الله|يا رب|
والله العظيم|يا جماعة|يا ولاد|يا بني|يا حبيبي|يا باشا|يا معلم|يا كبير|اسطورة|ملك|بطل|وحش|اسد|قطة|كلب|مصري|مصريين|خليجي|سعودي|ههههه|
لا تعليق|بدون تعليق|اتصدمت|انصدمت|عادي|غير مهم|شكرا|اسف|سامحني|زعلت|صالحني|مبروك|الف مبروك|حظ|حظ سعيد|نحس|ابتسامة|دموع|بكا|عياط|صريخ|
سيستيريا|سكوت|نص|رغي|نميمة|حماتي|مراتي|جوزي|عيال|اطفال|مدرسين|استاذ|طالب|اخر الشهر|المرتب|البنك|الدين|سلف|كوميكس|ميمز|افيهات|افيه|
مشهد|فيلم|مسرحية|مسلسل|كرتون|الشيخ|حرامي|بوليس|ظابط|محامي|قاضي|سجن|براءة|""".replace("\n", "")

SEEDS_EN = """omg|wow|shocked|surprised|mind blown|facepalm|eye roll|laughing|lol|crying|sad|happy dance|celebrate|party|yes|no|nope|thumbs up|
clapping|applause|confused|thinking|waiting|bored|tired|sleepy|angry|rage|frustrated|nervous|scared|awkward|embarrassed|shy|love|heart|kiss|hug|
thank you|sorry|please|good job|well done|congrats|winner|fail|epic fail|oops|deal with it|cool|mic drop|boom|money|rich|broke|shopping|sale|
work|boss|monday|friday|weekend|coffee|hungry|food|pizza|diet|gym|workout|sweat|exhausted|running|dance|music|singing|bye|hello|wave|welcome|
excited|hype|lets go|finally|really|seriously|what|why|how|hmm|suspicious|side eye|judging|smug|proud|flex|strong|weak|dead|dying|help|panic|
calm|relax|chill|peace|nice|perfect|chefs kiss|delicious|disgusted|gross|cringe|yikes|ouch|pain|mood|same|me|you|we|team|teamwork|high five|
fist bump|handshake|deal|agree|disagree|whatever|meh|fine|okay|sure|maybe|never|always|time|late|hurry|slow|fast|speed|traffic|car|travel|
vacation|beach|summer|winter|cold|hot|rain|birthday|gift|surprise|reaction|meme|classic meme|cat|dog|baby|kids|mom|dad|family|friends""".replace("\n", "")


def seeds() -> list[str]:
    return [q.strip() for q in (SEEDS_AR + "|" + SEEDS_EN).split("|") if q.strip()]


# «ردود فعل بس»: الكوميدي هنا مش ضحك، ده الوش اللي بيتحط عشان يعلّق على الكلام (استغراب، غضب، دهشة، ملل، حيرة)
# فيديو أو GIF بس، ومن غير أي كلام مكتوب على الشاشة
REACTIONS = {"surprise": "استغراب", "anger": "غضب", "shock": "دهشة", "bored": "ملل", "confused": "حيرة"}
REACTION_KINDS = ("gif", "clip")
REACTION_SEEDS = {
    "surprise": "ماذا هذا|بجد|كيف أي|لا يا شيخ|نعم|أي ماذا|surprised face|raised eyebrow|wait what|side eye|suspicious look|double take|what reaction",
    "anger": "متعصب|غضبان|اتنرفز|ستجنن|angry face|rage reaction|furious|annoyed face|frustrated reaction|angry stare|losing it|mad face",
    "shock": "مصدوم|يا نهار ابيض|يا خبر|اتصدمت|shocked face|jaw drop|mind blown|speechless|gasp|stunned|omg reaction|in disbelief",
    "bored": "زهقان|ملل|غير فارقة|نايم|bored face|yawn|unimpressed|eye roll|not interested|waiting bored|so bored|blank stare",
    "confused": "غير فاهم|حيرة|محتار|confused face|confused math|thinking hard|huh|puzzled|what is happening|lost|scratching head|confused look",
}


def reaction_seeds() -> list[str]:
    return list(dict.fromkeys(q.strip() for v in REACTION_SEEDS.values() for q in v.split("|") if q.strip()))


def reaction_reject(ctx: dict) -> str | None:
    """له هذا الكوميك مايدخلش مكتبة «ردود الفعل»: عليه نص مكتوب، أو غير رد فعل من الخمسة. None = ينفع."""
    if ctx.get("text_on_screen"):
        return "عليه نص مكتوب"
    if ctx.get("reaction") not in REACTIONS:
        return "غير رد فعل"
    return None


# ---------------------------------------------------------------- المصادر
def klipy_key() -> str:
    return os.environ.get("KLIPY_API_KEY", "").strip()


def giphy_key() -> str:
    return os.environ.get("GIPHY_API_KEY", "").strip()


def sources() -> dict:
    return {"klipy": {"name": "KLIPY", "on": bool(klipy_key()), "env": "KLIPY_API_KEY", "kinds": ["gif", "clip", "meme", "sticker"]},
            "giphy": {"name": "GIPHY", "on": bool(giphy_key()), "env": "GIPHY_API_KEY", "kinds": ["gif", "sticker"]},
            "imgflip": {"name": "Imgflip (قوالب ميمز)", "on": True, "env": "", "kinds": ["meme"]}}


class SourceError(Exception):
    pass


def _get(url: str, params: dict) -> dict:
    try:
        r = httpx.get(url, params=params, timeout=30, follow_redirects=True)
    except httpx.HTTPError as exc:
        raise SourceError(f"المصدر مردش: {str(exc)[:100]}") from exc
    if r.status_code in (401, 403):
        raise SourceError("مفتاح المصدر لا يعمل")
    if r.status_code == 429:
        raise SourceError("المصدر يقول انتظر قليلًا (كثير طلبات)")
    if r.status_code >= 400:
        raise SourceError(f"المصدر استعد {r.status_code}")
    try:
        return r.json()
    except ValueError as exc:
        raise SourceError("المصدر استعد رد غير مفهوم") from exc


def _urls(obj, out: list) -> None:
    """يلم كل روابط الميديا من أي شكل رد (الأسماء تختلف من مصدر للتاني)."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and v.startswith("http") and re.search(r"\.(mp4|gif|webp|jpe?g|png)(\?|$)", v, re.I):
                out.append((str(k), v, obj))
            else:
                _urls(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _urls(v, out)


def best_media(item: dict) -> tuple[str, str] | None:
    """أحسن ملف: mp4 متوسط الحجم، وإلا gif، وإلا صورة."""
    found: list = []
    _urls(item, found)
    if not found:
        return None
    def score(f):
        k, url, holder = f
        ext = re.search(r"\.(mp4|gif|webp|jpe?g|png)", url, re.I).group(1).lower()
        path = "/".join(str(x) for x in holder.keys()) + url
        size_pref = 3 if re.search(r"\b(md|hd|original|downsized_medium|fixed_height)\b", path) else 2 if re.search(r"\b(sm|downsized)\b", path) else 1
        if re.search(r"still|preview|xs|thumb|480w_still|_s\.gif", url + path, re.I):
            size_pref = 0
        return ({"mp4": 4, "gif": 3, "webp": 2}.get(ext, 1), size_pref)
    k, url, _ = max(found, key=score)
    ext = re.search(r"\.(mp4|gif|webp|jpe?g|png)", url, re.I).group(1).lower().replace("jpeg", "jpg")
    return url, ext


def klipy_search(kind: str, q: str, page: int) -> list[dict]:
    path = {"gif": "gifs", "clip": "clips", "meme": "static-memes", "sticker": "stickers"}.get(kind, "gifs")
    d = _get(f"https://api.klipy.com/api/v1/{klipy_key()}/{path}/search", {"q": q, "page": page, "per_page": 30, "locale": "ar_EG" if re.search(r"[؀-ۿ]", q) else "en_US"})
    data = d.get("data") if isinstance(d, dict) else None
    rows = (data.get("data") if isinstance(data, dict) else data) or []
    out = []
    for it in rows if isinstance(rows, list) else []:
        if not isinstance(it, dict):
            continue
        m = best_media(it.get("file") or it)
        if not m:
            continue
        out.append({"source": "klipy", "source_id": str(it.get("id") or it.get("slug") or m[0]), "kind": kind, "url": m[0], "ext": m[1],
                    "title": str(it.get("title") or "")[:200], "tags": [str(t)[:40] for t in it.get("tags") or [] if isinstance(t, str)][:15]})
    return out


def giphy_search(kind: str, q: str, page: int) -> list[dict]:
    path = "stickers" if kind == "sticker" else "gifs"
    d = _get(f"https://api.giphy.com/v1/{path}/search", {"api_key": giphy_key(), "q": q, "limit": 40, "offset": page * 40, "rating": "pg-13",
                                                          "lang": "ar" if re.search(r"[؀-ۿ]", q) else "en"})
    out = []
    for it in d.get("data") or []:
        im = (it.get("images") or {}) if isinstance(it, dict) else {}
        src = im.get("downsized_medium") or im.get("fixed_height") or im.get("original") or {}
        url, ext = (src.get("mp4"), "mp4") if src.get("mp4") else (src.get("url"), "gif")
        if not url:
            continue
        out.append({"source": "giphy", "source_id": str(it.get("id")), "kind": kind, "url": url, "ext": ext,
                    "title": str(it.get("title") or it.get("alt_text") or "")[:200], "tags": []})
    return out


def imgflip_templates() -> list[dict]:
    d = _get("https://api.imgflip.com/get_memes", {})
    return [{"source": "imgflip", "source_id": str(m.get("id")), "kind": "meme", "url": m.get("url"), "ext": (m.get("url") or "x.jpg").rsplit(".", 1)[-1].lower(),
             "title": str(m.get("name") or "")[:200], "tags": ["meme template"]} for m in (d.get("data") or {}).get("memes") or [] if m.get("url")]


def search(source: str, kind: str, q: str, page: int = 0) -> list[dict]:
    if source == "klipy":
        return klipy_search(kind, q, page + 1)
    if source == "giphy":
        return giphy_search(kind, q, page)
    return []


# ---------------------------------------------------------------- السياق
def tag_messages(items: list[dict]) -> str:
    lines = "\n".join(f"[{k}] kind={it['kind']} · source title: {it.get('title') or '-'} · tags: {', '.join(it.get('tags') or []) or '-'} · found by searching: {it.get('query') or '-'}"
                      for k, it in enumerate(items))
    return f"""You catalogue reaction comics (memes, GIFs, short clips) so a video tool can drop the right one at the right moment.
For each image below (same order as the list; for videos/GIFs you see one frame), write its context.
{lines}

Return JSON only: {{"items": [{{"i": 0,
 "emotion": "one or two of: {'، '.join(EMOTIONS)}",
 "situation": "بالعربية الفصحى: الموقف الذي هذا الكوميك يوضع فيه (جملة)",
 "use_when": "بالعربية الفصحى: النص الذي إذا قيل في الفيديو يصبح هذا الكوميك مناسب (أمثلة قصيرة)",
 "phrase": "the exact text/catchphrase written or famously said in it, or empty",
 "text_on_screen": true if ANY words/letters/captions/subtitles are written on the image (watermark logos alone don't count), else false,
 "reaction": "the face/body reaction it shows: {' | '.join(REACTIONS)} | other  (surprise = puzzled/raised eyebrow, anger, shock = astonished/jaw drop, bored, confused)",
 "who": "famous character/actor/film if clearly recognisable, else empty",
 "lang": "ar-eg | ar-gulf | ar | en | none",
 "audience": "ar | en | both  (ar: Arabic text/speech OR from Arab film/TV/people/culture · en: English text/speech OR clearly from Western film/TV/meme culture · both: no text and nothing culture-specific, a universal reaction anyone gets)",
 "tags": ["5-10 short search words, Arabic and English"],
 "flags": ["nsfw" | "political" | "religious" | "violent" | "watermark" | "low_quality"],
 "quality": 1-5}}]}}
Be precise and honest; if unsure about "who", leave it empty. Never invent a phrase that is not there."""


def clean_ctx(raw: dict) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    flags = [f for f in raw.get("flags") or [] if f in ("nsfw", "political", "religious", "violent", "watermark", "low_quality")]
    try:
        q = max(1, min(5, int(raw.get("quality") or 3)))
    except (TypeError, ValueError):
        q = 3
    return {"emotion": str(raw.get("emotion") or "")[:60], "situation": str(raw.get("situation") or "")[:300], "use_when": str(raw.get("use_when") or "")[:400],
            "phrase": str(raw.get("phrase") or "")[:160], "who": str(raw.get("who") or "")[:120], "lang": str(raw.get("lang") or "")[:10],
            "audience": str(raw.get("audience") or "").strip().lower()[:4] if str(raw.get("audience") or "").strip().lower() in LANGS else "",
            "tags": [str(t)[:40] for t in raw.get("tags") or [] if str(t).strip()][:12], "flags": flags, "quality": q,
            "text_on_screen": raw.get("text_on_screen") in (True, "true", 1, "yes"),
            "reaction": str(raw.get("reaction") or "").strip().lower() if str(raw.get("reaction") or "").strip().lower() in REACTIONS else ""}


# الكوميك عربي صرف، ولا أجنبي صرف، ولا يصلح للاثنين
LANGS = {"ar": "عربي", "en": "أجنبي", "both": "يصلح للاثنين"}
_AR = re.compile(r"[\u0600-\u06FF]")


def lang_group(ctx: dict, title: str = "", query: str = "") -> str:
    """من وصف العقل إذا موجود، وإذا ما زال مااتوصفش: من لغة الكلمة التي اتلاقى بها."""
    ctx = ctx or {}
    if ctx.get("audience") in LANGS:
        return ctx["audience"]
    lg = str(ctx.get("lang") or "")
    if lg.startswith("ar"):
        return "ar"
    if lg == "en":
        return "en"
    guess = "ar" if _AR.search(f"{title} {query}") else "en"
    return "both" if lg == "none" and not ctx.get("who") else guess


def text_lang(text: str) -> str:
    return "ar" if _AR.search(text or "") else "en"


def ctx_text(title: str, query: str, ctx: dict) -> str:
    """النص الذي البحث يبحث فيه."""
    return " ".join([title or "", query or "", ctx.get("emotion", ""), ctx.get("situation", ""), ctx.get("use_when", ""), ctx.get("phrase", ""),
                     ctx.get("who", ""), " ".join(ctx.get("tags") or [])]).strip()


def fts_query(text: str) -> str:
    words = [w for w in re.findall(r"[\w؀-ۿ]{2,}", (text or "").lower()) if len(w) > 1][:24]
    return " OR ".join(f'"{w}"' for w in words)


def pick_messages(scenes: list[dict], cands: dict[int, list[dict]], every: float) -> list[dict]:
    blocks = []
    for i, cs in cands.items():
        s = scenes[i]
        opts = "\n".join(f"    ({c['id']}) {c['kind']} · {c['ctx'].get('emotion', '')} · {c['ctx'].get('situation', '')} · phrase: {c['ctx'].get('phrase', '') or '-'}" for c in cs)
        blocks.append(f"SCENE {i + 1}: «{s['text']}»\n{opts}")
    n = max(1, round(len(scenes) * every))
    return [{"role": "system", "content": "You are a funny Egyptian social-media video editor. Return JSON only."},
            {"role": "user", "content": f"""A narrated short video. Pick reaction comics (memes/GIFs) that make the right scenes funnier.
Pick for about {n} scenes only (the ones where a reaction really lands: a surprise, a fail, a win, a punchline), never two scenes in a row, never the same comic twice.
Only choose from the candidates listed under each scene (by id). The comic must match the meaning and emotion of THAT scene's words.
{chr(10).join(blocks)}

Return JSON: {{"picks": [{{"scene": 1, "id": "comic id", "why": "بالعربية في جملة"}}]}}"""}]


def mock_items(q: str, kind: str, n: int = 4) -> list[dict]:
    h = int(hashlib.md5((q + kind).encode()).hexdigest()[:6], 16)
    return [{"source": "mock", "source_id": f"{h}-{k}", "kind": kind, "url": "", "ext": "gif" if kind != "meme" else "png", "title": f"{q} {k + 1}", "tags": [q]} for k in range(n)]


def mock_ctx(it: dict, k: int) -> dict:
    return clean_ctx({"emotion": EMOTIONS[k % len(EMOTIONS)], "situation": f"عندما حد يقول «{it.get('query') or it.get('title')}»",
                      "use_when": it.get("query") or it.get("title"), "phrase": "", "tags": [it.get("query") or ""], "quality": 4,
                      "text_on_screen": k % 3 == 2, "reaction": list(REACTIONS)[k % len(REACTIONS)],
                      "lang": "ar-eg" if _AR.search(it.get("query") or "") else ("en" if k % 2 else "none")})
