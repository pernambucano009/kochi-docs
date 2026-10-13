"""🧠 مصادر عقل البراند: قراية ملف أو لينك أو كلام مكتوب، وتحويله لاقتراحات بتستنى موافقتك.
الاقتراحات أنواع: قيمة لخانة موجودة (الجمهور مثلًا)، قاعدة، معلومة (معرفة)، أو سؤال عن حاجة ناقصة."""
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
SOURCE_EXT = TEXT_EXT | DOC_EXT | IMG_EXT
MAX_TEXT = 60000
# الخانات اللي الموديل يقدر يقترح لها قيمة (نفس خانات الخريطة)
FIELDS = {"about": "عن البراند", "audience": "الجمهور", "market": "السوق", "language": "اللغة واللهجة", "domain": "المجال",
          "typography": "الخطوط", "palette": "الألوان", "cta": "الدعوة (CTA)", "link": "اللينك", "caption": "الكابشن الافتراضي"}
SECTIONS = {"identity": "الهوية", "voice": "النبرة", "products": "المنتجات", "offers": "العروض", "audience": "الجمهور",
            "seasonal": "المواسم", "claims": "الادعاءات المسموحة", "campaigns": "حملات ودروس", "visual": "الشكل", "other": "تانية"}


# ---------- القراية ----------
def read_pdf(path: Path, img_dir: Path) -> tuple[str, list[Path]]:
    """نص كل صفحة، وصورة للصفحات اللي معظمها تصميم (الـ brand books غالبًا كده)."""
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
    """http/https بس، ومش عنوان داخلي (عشان محدش يخلي السيرفر يفتح حاجات جوّه الشبكة)."""
    url = url.strip()
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    u = urlparse(url)
    if u.scheme not in ("http", "https") or not u.hostname:
        raise ValueError("اللينك ده مش مظبوط")
    try:
        for info in socket.getaddrinfo(u.hostname, None):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                raise ValueError("اللينك ده لعنوان داخلي")
    except socket.gaierror:
        pass   # من غير DNS مباشر (ورا proxy): الطلب نفسه هيتأكد إن الموقع موجود
    return url


def read_site(url: str, pages: int = 6) -> str:
    """الصفحة الرئيسية + كام صفحة داخلية من نفس الموقع (عن البراند، المنتجات…)."""
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
        raise ValueError("مقدرتش أقرا حاجة من الموقع ده")
    return "\n\n".join(parts)


# ---------- الموديل ----------
FORMAT = """{
  "fields": {"audience": "...", "about": "...", "market": "...", "language": "...", "domain": "...", "typography": "...", "palette": "#HEX اسم اللون, ...", "cta": "...", "link": "...", "caption": "..."},
  "rules": ["قاعدة صريحة لازم تتراعى", "..."],
  "notes": [{"section": "voice|products|offers|audience|seasonal|claims|campaigns|identity|visual|other", "title": "عنوان قصير", "summary": "سطر واحد بيقول الصفحة دي فيها إيه", "body": "التفاصيل"}],
  "questions": ["سؤال عن حاجة مهمة ناقصة ومش موجودة في المصدر"]
}"""


def extract_prompt(brain_txt: str, name: str, note: str, text: str, n_images: int) -> str:
    return (
        "انت بتبني «عقل» لبراند: ذاكرة منظمة بتتقري تلقائي في كل سكريبت وصورة وفيديو بيتعمل للبراند.\n"
        f"المصدر: «{name}»" + (f" — المستخدم قال عنه: {note}" if note else "") + "\n"
        + (f"وفيه {n_images} صورة (صفحات أو صور) مع الرسالة.\n" if n_images else "")
        + "\nاللي في العقل دلوقتي:\n" + (brain_txt or "(لسه فاضي)") + "\n\n"
        "المطلوب: اقرا المصدر وطلّع منه اللي يفيد العقل بس:\n"
        "1) fields: قيمة لخانة من الخانات دي لو المصدر بيقولها بوضوح ومختلفة عن اللي في العقل: "
        + "، ".join(f"{k} ({v})" for k, v in FIELDS.items()) + ". متكتبش خانة مش موجودة في المصدر.\n"
        "2) rules: القواعد الصارمة (ممنوعات، لازم، ادعاءات ممنوعة، disclaimers) بنصها الحرفي لو مكتوبة. كل قاعدة سطر واحد قابل للتنفيذ.\n"
        "3) notes: أي معرفة تانية مهمة (منتجات وأسعار، عروض، أمثلة حقيقية لكلام البراند بين علامات تنصيص، مواسم، حملات ناجحة وليه نجحت…). "
        "كل note موضوع واحد بس، وsummary سطر واحد.\n"
        "4) questions: لو حاجة أساسية ناقصة (الجمهور، النبرة، الممنوعات…) اسأل عنها سؤال قصير. 3 أسئلة بالكتير.\n"
        "قواعد مهمة: ممنوع تخترع أي معلومة مش موجودة في المصدر. اكتب بالعربي (المصطلحات والأسماء زي ما هي). "
        "متكررش حاجة موجودة في العقل بالفعل. لو المصدر مفيهوش حاجة مفيدة رجّع قوايم فاضية.\n"
        f"رجّع JSON بس بالشكل ده:\n{FORMAT}\n\n---\nالمصدر:\n{text[:MAX_TEXT]}"
    )


def to_pending(out: dict, brain: dict, sid: str) -> list[dict]:
    """رد الموديل ← اقتراحات (من غير تكرار للي موجود)."""
    items = []
    rules_now = {r.strip() for r in str(brain.get("rules") or "").split("\n") if r.strip()}
    for k, v in (out.get("fields") or {}).items():
        v = str(v or "").strip()
        if k in FIELDS and v and v != str(brain.get(k) or "").strip():
            items.append({"kind": "field", "field": k, "value": v[:4000]})
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
    return {"fields": {"audience": f"جمهور تجريبي من «{name}»"}, "rules": ["من غير وعود مبالغ فيها"],
            "notes": [{"section": "products", "title": "الباقة الشهرية", "summary": "اشتراك شهري بمدرب", "body": "تفاصيل تجريبية"}],
            "questions": ["مين الجمهور الأساسي بالظبط؟"]}


def notes_text(brain: dict) -> str:
    """المعرفة اللي اتوافق عليها: بتدخل مع العقل في كل توليد."""
    notes = brain.get("notes") or []
    if not notes:
        return ""
    lines = []
    for n in notes[:40]:
        body = str(n.get("body") or "").strip()
        lines.append(f"- [{SECTIONS.get(n.get('section'), '')}] {n.get('title')}: {n.get('summary') or ''}" + (f"\n  {body[:700]}" if body else ""))
    return "معرفة عن البراند (اتوافق عليها):\n" + "\n".join(lines)
