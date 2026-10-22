"""🧠 مصادر عقل العلامة: قراية ملف أو رابط أو نص مكتوب، وتحويله لاقتراحات تنتظر موافقتك.
الاقتراحات أنواع: قيمة لخانة موجودة (الجمهور مثلًا)، قاعدة، معلومة (معرفة)، أو سؤال عن شيء ناقصة."""
from __future__ import annotations

import html
import ipaddress
import re
import socket
import uuid
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx

TEXT_EXT = {".txt", ".md", ".csv", ".json", ".html", ".htm"}
DOC_EXT = {".pdf", ".docx"}
IMG_EXT = {".png", ".jpg", ".jpeg", ".webp"}
# صوت وفيديو: الكلام بيتفرّغ نص (والفيديو بياخد كام لقطة منه كمان)
AUDIO_EXT = {".mp3", ".wav", ".m4a", ".ogg", ".aac", ".opus"}
VIDEO_EXT = {".mp4", ".mov", ".webm", ".mkv"}
SOURCE_EXT = TEXT_EXT | DOC_EXT | IMG_EXT | AUDIO_EXT | VIDEO_EXT
MAX_TEXT = 60000
# الخانات اللي الموديل يقدر يقترح لها قيمة (نفس خانات الخريطة)
FIELDS = {"about": "عن البراند", "audience": "الجمهور", "market": "السوق", "language": "اللغة واللهجة", "domain": "المجال",
          "typography": "الخطوط", "palette": "الألوان", "cta": "الدعوة (CTA)", "link": "الرابط", "caption": "التعليق النصي الافتراضي"}
# كل خانة بتاخد إيه بالظبط (عشان الموديل ميحطش المجال في خانة السوق مثلًا)
FIELD_SCOPE = {
    "about": "جملتين: العلامة يقدم ماذا وماذا الذي يميزه",
    "audience": "من العميل: السن والاهتمامات واللي يبحث عليه",
    "market": "المكان الجغرافي فقط (دولة / مدينة / منطقة). بدون المجال أو الخدمة",
    "language": "لغة أو لهجة الكلام مع الجمهور بس",
    "domain": "المجال أو نوع النشاط فقط، في كلمات قليلة",
    "typography": "أسماء الخطوط فقط", "palette": "الألوان بأكوادها (#RRGGBB) فقط",
    "cta": "جملة الدعوة للفعل فقط", "link": "رابط أو رقم تواصل فقط", "caption": "تعليق نصي افتراضي قصير",
}
FIELD_RULES = (
    "كل خانة تاخد اللي في وصفها بس، وممنوع تخلط خانة في خانة (مثلًا المجال ميتحطش في السوق). "
    "اقترح قيمة لخانة فقط إذا هي معلومة جديدة أو تصحّح خطأ في ما موجود؛ إذا ما في العقل صحيح بنفس المعنى (حتى إذا بكلام آخر) متقترحش. "
    "ولكل اقتراح خانة اكتب له في why بجملة قصيرة. الشكل: \"fields\": {\"market\": {\"value\": \"…\", \"why\": \"…\"}}.\n"
)


def fields_desc() -> str:
    return "، ".join(f"{k} ({FIELDS[k]}: {FIELD_SCOPE.get(k, '')})" for k in FIELDS)


SECTIONS = {"identity": "الهوية", "voice": "النبرة", "products": "المنتجات", "offers": "العروض", "audience": "الجمهور",
            "seasonal": "المواسم", "claims": "الادعاءات المسموحة", "campaigns": "حملات ودروس", "visual": "الشكل", "other": "أخرى"}


# ---------- القراية ----------
def read_pdf(path: Path, img_dir: Path) -> tuple[str, list[Path]]:
    """نص كل صفحة، وصورة للصفحات التي معظمها تصميم (الـ brand books غالبًا هكذا)."""
    import pymupdf  # noqa: PLC0415
    doc = pymupdf.open(path)
    texts, imgs = [], []
    for i, page in enumerate(doc):
        t = page.get_text().strip()
        texts.append(f"[صفحة {i + 1}]\n{t}")
        if len(t) < 300 and len(imgs) < 8:
            out = img_dir / f"{path.stem}-p{i + 1}.jpg"
            page.get_pixmap(dpi=72).save(out)
            imgs.append(out)
    return "\n\n".join(texts), imgs


def read_docx(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml").decode("utf-8", "ignore")
    xml = re.sub(r"</w:p>", "\n", xml)
    return html.unescape(re.sub(r"<[^>]+>", "", xml)).strip()


class _Text(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "template"}

    def __init__(self):
        super().__init__()
        self.out, self.links, self.meta, self._skip = [], [], {}, 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in self.SKIP:
            self._skip += 1
        elif tag == "a" and a.get("href"):
            self.links.append(a["href"])
        elif tag == "meta" and (a.get("name") or a.get("property")) and a.get("content"):
            self.meta[(a.get("name") or a.get("property")).lower()] = a["content"]
        elif tag in ("p", "div", "li", "h1", "h2", "h3", "h4", "br", "section", "tr"):
            self.out.append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self._skip:
            self._skip -= 1

    def handle_data(self, data):
        if not self._skip and data.strip():
            self.out.append(data.strip() + " ")


def html_text(raw: str) -> tuple[str, list[str], dict]:
    p = _Text()
    try:
        p.feed(raw)
    except Exception:  # noqa: BLE001 — صفحة بايظة: ناخد اللي اتقرا
        pass
    text = re.sub(r"\n\s*\n+", "\n", "".join(p.out)).strip()
    return text, p.links, p.meta


def safe_url(url: str) -> str:
    """http/https فقط، ومش عنوان داخلي (لكي محدش يخلي الخادم يفتح أشياء داخل الشبكة)."""
    url = url.strip()
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    u = urlparse(url)
    if u.scheme not in ("http", "https") or not u.hostname:
        raise ValueError("هذا الرابط غير مظبوط")
    try:
        for info in socket.getaddrinfo(u.hostname, None):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                raise ValueError("هذا الرابط لعنوان داخلي")
    except socket.gaierror:
        pass   # من غير DNS مباشر (ورا proxy): الطلب نفسه هيتأكد إن الموقع موجود
    return url


def read_site(url: str, pages: int = 6) -> str:
    """الصفحة الرئيسية + كم صفحة داخلية من نفس الموقع (عن العلامة، المنتجات…)."""
    url = safe_url(url)
    host = urlparse(url).hostname
    seen, queue, parts = set(), [url], []
    headers = {"User-Agent": "Mozilla/5.0 (StudioMania brand reader)"}
    # كل طلب (حتى بعد التحويل لعنوان تاني) بيتأكد إنه مش لعنوان داخلي
    hooks = {"request": [lambda req: safe_url(str(req.url))]}
    with httpx.Client(timeout=20, follow_redirects=True, headers=headers, event_hooks=hooks) as client:
        while queue and len(seen) < pages:
            u = queue.pop(0)
            if u in seen:
                continue
            seen.add(u)
            try:
                r = client.get(u)
                if r.status_code >= 400 or "html" not in r.headers.get("content-type", "html"):
                    continue
                text, links, meta = html_text(r.text[:2_000_000])
            except (httpx.HTTPError, ValueError):
                continue
            head = " · ".join(v for k, v in meta.items() if k in ("description", "og:title", "og:description", "keywords"))
            parts.append(f"[{u}]\n{head}\n{text[:15000]}")
            for href in links:
                nu = urljoin(u, href).split("#")[0]
                if urlparse(nu).hostname == host and nu not in seen and nu not in queue and not re.search(r"\.(jpg|png|pdf|zip|mp4|webp|svg)$", nu, re.I):
                    queue.append(nu)
    if not parts:
        raise ValueError("تعذّرت قراءة شيء من هذا الموقع")
    return "\n\n".join(parts)


# ---------- الموديل ----------
FORMAT = """{
  "fields": {"<خانة>": {"value": "...", "why": "له هذا الاقتراح"}},
  "rules": ["قاعدة صريحة يجب تتراعى", "..."],
  "notes": [{"section": "voice|products|offers|audience|seasonal|claims|campaigns|identity|visual|other", "title": "عنوان قصير", "summary": "سطر واحد يقول هذه الصفحة فيها ماذا", "body": "التفاصيل"}],
  "questions": ["سؤال عن شيء مهمة ناقصة ومش موجودة في المصدر"]
}"""


def extract_prompt(brain_txt: str, name: str, note: str, text: str, n_images: int) -> str:
    return (
        "أنت تبني «عقل» لبراند: ذاكرة منظمة تتقري تلقائي في كل نص وصورة وفيديو يُنشأ للعلامة.\n"
        f"المصدر: «{name}»" + (f" — المستخدم قال عنه: {note}" if note else "") + "\n"
        + (f"وفيه {n_images} صورة (صفحات أو صور) مع الرسالة.\n" if n_images else "")
        + "\nما في العقل الآن:\n" + (brain_txt or "(ما زال فارغ)") + "\n\n"
        "المطلوب: اقرا المصدر وطلّع منه الذي يفيد العقل فقط:\n"
        "1) fields: قيمة لخانة من هذه الخانات إذا المصدر يقولها بوضوح: " + fields_desc() + ". لم يُكتب خانة غير موجودة في المصدر. " + FIELD_RULES +
        "2) rules: القواعد الصارمة (ممنوعات، لازم، ادعاءات ممنوعة، disclaimers) بنصها الحرفي لو مكتوبة. كل قاعدة سطر واحد قابل للتنفيذ.\n"
        "3) notes: أي معرفة أخرى مهمة (منتجات وأسعار، عروض، أمثلة حقيقية لكلام العلامة بين علامات تنصيص، مواسم، حملات ناجحة وليه نجحت…). "
        "كل note موضوع واحد فقط، وsummary سطر واحد.\n"
        "4) questions: لو حاجة أساسية ناقصة (الجمهور، النبرة، الممنوعات…) اسأل عنها سؤال قصير. 3 أسئلة بالكتير. "
        "ماتسألش عن المواسم أو المناسبات أو الأعياد: البرنامج يجيبها تلقائيًا من السوق والجمهور.\n"
        "قواعد مهمة: ممنوع تخترع أي معلومة مش موجودة في المصدر. اكتب بالعربي (المصطلحات والأسماء زي ما هي). "
        "متكررش شيء موجودة في العقل بالفعل. إذا المصدر لا يحتوي شيء مفيدة استعد قوائم فارغة.\n"
        f"استعد JSON فقط هذا بالشكل:\n{FORMAT}\n\n---\nالمصدر:\n{text[:MAX_TEXT]}"
    )


def to_pending(out: dict, brain: dict, sid: str) -> list[dict]:
    """رد النموذج ← اقتراحات (بدون تكرار للي موجود)."""
    items = []
    rules_now = {r.strip() for r in str(brain.get("rules") or "").split("\n") if r.strip()}
    for k, v in (out.get("fields") or {}).items():
        why = str(v.get("why") or "").strip()[:300] if isinstance(v, dict) else ""
        v = str((v.get("value") if isinstance(v, dict) else v) or "").strip()
        now = str(brain.get(k) or "").strip()
        if k in FIELDS and v and v != now and v.lower() not in now.lower():
            items.append({"kind": "field", "field": k, "value": v[:4000], **({"why": why} if why else {})})
    for r in out.get("rules") or []:
        r = str(r or "").strip()
        if r and r not in rules_now:
            items.append({"kind": "rule", "value": r[:600]})
    for n in out.get("notes") or []:
        if isinstance(n, dict) and str(n.get("title") or "").strip():
            items.append({"kind": "note", "section": n.get("section") if n.get("section") in SECTIONS else "other",
                          "title": str(n["title"]).strip()[:120], "summary": str(n.get("summary") or "").strip()[:300],
                          "value": str(n.get("body") or "").strip()[:6000]})
    for q in (out.get("questions") or [])[:3]:
        q = str(q or "").strip()
        if q:
            items.append({"kind": "question", "title": q[:300], "value": ""})
    for it in items:
        it.update(id=uuid.uuid4().hex[:10], source=sid)
    return items[:60]


def mock_out(name: str) -> dict:
    return {"fields": {"audience": f"جمهور تجريبي من «{name}»"}, "rules": ["بدون وعود مبالغ فيها"],
            "notes": [{"section": "products", "title": "الباقة الشهرية", "summary": "اشتراك شهري بمدرب", "body": "تفاصيل تجريبية"}],
            "questions": ["من الجمهور الأساسي بالضبط؟"]}


# ---------- الاختيار وقت التوليد ----------
_AR = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي", "ـ": ""})
_STOP = {"في", "من", "علي", "على", "عن", "الي", "إلى", "مع", "هذه", "هذا", "ما", "the", "and", "for", "with", "that", "this", "هو", "هي", "كل", "إذا", "او", "أو", "فقط"}


def tokens(text: str) -> set[str]:
    """كلمات للمقارنة: بدون تشكيل، والألف والياء والتاء المربوطة موحّدين، ومن غير «ال» في أولًا."""
    t = re.sub(r"[\u064B-\u0652\u0670]", "", str(text or "").lower()).translate(_AR)
    out = set()
    for w in re.findall(r"[\w]+", t):
        if w.startswith("ال") and len(w) > 4:
            w = w[2:]
        if len(w) >= 3 and w not in _STOP and not w.isdigit():
            out.add(w)
    return out


CORE = {"voice", "claims"}   # النبرة والادعاءات المسموحة بيدخلوا دايمًا (زي القواعد)


def pick_notes(notes: list[dict], query: str = "", k: int = 8) -> list[dict]:
    """من المعرفة كلها: الأساسيات دائمًا، ثم الأقرب للطلب (بالكلام المشترك)، وإذا لا يوجد طلب الأحدث."""
    core = [n for n in notes if n.get("section") in CORE][:6]
    rest = [n for n in notes if n not in core]
    q = tokens(query)
    if q:
        def hit(words: set[str]) -> int:   # نفس الكلمة أو أولها زي بعض (رمضان / رمضانيه)
            return sum(1 for a in q if any(a == b or (min(len(a), len(b)) >= 4 and (a.startswith(b) or b.startswith(a))) for b in words))
        def score(n):
            return 2 * hit(tokens(n.get("title", ""))) + hit(tokens(f"{n.get('summary', '')} {n.get('body', '')}"))
        ranked = sorted(((score(n), -i, n) for i, n in enumerate(rest)), key=lambda x: (x[0], x[1]), reverse=True)
        hits = [n for s, _, n in ranked if s > 0][:k]
        rest = hits + [n for n in reversed(rest) if n not in hits][: max(0, 3 - len(hits))]
    else:
        rest = list(reversed(rest))[:k]
    return core + rest


def notes_text(brain: dict, query: str = "") -> str:
    """المعرفة التي اعتُمد عليها: الأنسب للطلب فقط (غير كلها)، بحد أقصى للطول."""
    notes = brain.get("notes") or []
    if not notes:
        return ""
    lines, size = [], 0
    for n in pick_notes(notes, query):
        body = str(n.get("body") or "").strip()
        line = f"- [{SECTIONS.get(n.get('section'), '')}] {n.get('title')}: {n.get('summary') or ''}" + (f"\n  {body[:700]}" if body else "")
        if size + len(line) > 5000:
            break
        lines.append(line)
        size += len(line)
    return "معرفة عن العلامة (اعتُمد عليها، الأنسب هذا للطلب):\n" + "\n".join(lines)


# ---------- التعلّم من التقييم ----------
def similar(a: str, b: str) -> bool:
    """ملاحظتين يقولون نفس الشيء تقريبًا (كلمات مشتركة كفاية)."""
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return False
    common = sum(1 for x in ta if any(x == y or (min(len(x), len(y)) >= 4 and (x.startswith(y) or y.startswith(x))) for y in tb))
    return common >= 2 or common / min(len(ta), len(tb)) >= .6


def learn(d: dict, fb: dict, repeat: int = 3) -> list[dict]:
    """تقييم جديد ← اقتراحات (تنتظر موافقتك مثل أي اقتراح):
    ممتاز ← مثال حقيقي يُضاف للمعرفة (النبرة) · ملاحظة اتكررت 3 مرات ← قاعدة مقترحة."""
    out = []
    if fb["rating"] == "great" and (fb.get("text") or fb.get("note")):
        out.append({"kind": "note", "section": "voice", "title": f"مثال ممتاز: {fb.get('what') or 'نتيجة'}"[:120],
                    "summary": fb.get("note") or "نتيجة اتقيّمت ممتاز، استخدمها كمثال للنبرة والأسلوب",
                    "value": (fb.get("text") or "")[:6000]})
    elif fb["rating"] == "bad" and fb.get("note"):
        same = [x for x in d.get("feedback") or [] if x.get("rating") == "bad" and x.get("note") and similar(x["note"], fb["note"])]
        already = any(p.get("kind") == "rule" and p.get("source") == "feedback" and similar(p.get("value", ""), fb["note"]) for p in d.get("pending") or [])
        if len(same) + 1 >= repeat and not already:   # + التقييم الجديد نفسه
            out.append({"kind": "rule", "value": f"تجنّب: {fb['note']}"[:600], "why": f"هذه الملاحظة اتكررت {len(same) + 1} مرات في تقييماتك"})
    for it in out:
        it.update(id=uuid.uuid4().hex[:10], source="feedback")
    return out
