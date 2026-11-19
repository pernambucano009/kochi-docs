"""🚨 صندوق الأخطاء: أي خطأ ظهر لأي عميل، أو شغل فشل أو وقف في النص، بيتسجّل هنا لوحده (من غير ما العميل يبلّغ).

- المصادر: ردود الـ API اللي فيها خطأ (٤٠٠ وأكتر)، والشغل اللي حالته «فشل» في ردود المتابعة، والشغل اللي فضل «شغّال» أكتر من اللازم،
  وأخطاء الواجهة نفسها (رسالة خطأ ظهرت، أو كود وقع في المتصفح).
- نفس الخطأ بيتجمّع في سطر واحد (البصمة: النوع + المسار من غير الأرقام + الرسالة من غير الأرقام)، ومعاه عدد المرات والعملاء.
- لكل خطأ: السبب والإصلاح المقترح (قواعد معروفة)، وصفحة الأدمن بتعرضه (/admin/inspect ← صندوق الأخطاء).
- المكان: قاعدة بيانات المنصة (PLATFORM_DB) لو البرنامج شغال ورا البوابة، وإلا ملف issues.db جنب بيانات البرنامج.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import threading
import time
from contextlib import closing
from pathlib import Path

TENANT = os.environ.get("TENANT_ID") or "owner"
_LOCK = threading.Lock()
_SEEN: dict[str, float] = {}      # (بصمة + رقم الشغل) ← أول مرة: المتابعة كل ثانيتين ماتعدّش نفس الفشل ١٠٠ مرة
_WORKING: dict[str, float] = {}   # شغل حالته «شغّال» ← أول مرة شفناه
STUCK_MIN = float(os.environ.get("ISSUE_STUCK_MIN") or 45)
SKIP_STATUS = {401}               # «سجّل الدخول» مش خطأ في البرنامج


def db_path() -> Path:
    p = os.environ.get("PLATFORM_DB")
    if p:
        return Path(p)
    return Path(os.environ.get("STUDIOMANIA_DATA") or Path(__file__).resolve().parent.parent / "data") / "issues.db"


def _db() -> sqlite3.Connection:
    c = sqlite3.connect(db_path(), timeout=15)
    c.row_factory = sqlite3.Row
    c.execute("""CREATE TABLE IF NOT EXISTS issues (id TEXT PRIMARY KEY, kind TEXT, path TEXT, status INTEGER, message TEXT, raw TEXT,
                 cause TEXT, fix TEXT, screen TEXT, count INTEGER DEFAULT 1, users TEXT DEFAULT '[]', workspaces TEXT DEFAULT '[]',
                 first_at REAL, last_at REAL, resolved_at REAL, note TEXT DEFAULT '')""")
    return c


def _norm(s: str) -> str:
    s = re.sub(r"[0-9a-f]{8,}", "#", str(s or ""))
    return re.sub(r"[\d٠-٩]+", "#", s)[:300]


def norm_path(p: str) -> str:
    return "/".join("{id}" if re.fullmatch(r"[0-9a-f]{6,}|\d+|[\w-]{10,}", x or "") and i > 2 else x for i, x in enumerate(p.split("?")[0].split("/")))


# 🩺 السبب والإصلاح المقترح: أشهر الأخطاء ومعناها الحقيقي
RULES: list[tuple[str, str, str]] = [
    (r"free users|paid plan|upgrade|subscription|payment required", "خطة مزوّد الخدمة لا تسمح بهذه الخاصية أو رصيده انتهى",
     "اشحن رصيد المزوّد أو رقِّ خطته (الإعدادات ← رصيد المنصات يبيّن أي مزوّد)، ثم أعد المحاولة"),
    (r"insufficient|credits|balance|رصيد|نقاط|NoCredits", "رصيد العميل أو رصيد المنصة لا يكفي",
     "إذا كان رصيد العميل: اقترح عليه الشحن. إذا كان رصيد المنصة: اشحن المزوّد من الإعدادات ← رصيد المنصات"),
    (r"timeout|timed out|انتهى وقت|ReadTimeout", "المزوّد تأخر في الرد أو الشغل أطول من المسموح",
     "أعد المحاولة. إذا تكرر: زِد مهلة الانتظار في الكود أو قسّم الشغل لأجزاء أصغر"),
    (r"rate.?limit|too many requests", "طلبات كثيرة على المزوّد في وقت قصير", "انتظر دقيقة وأعد المحاولة. إذا تكرر: قلّل التوازي أو ارفع حد المزوّد"),
    (r"api key|unauthorized|invalid key|forbidden|مفتاح", "مفتاح المزوّد ناقص أو غير صحيح أو انتهى", "راجع المفتاح في الإعدادات ← المفاتيح"),
    (r"ffmpeg|codec|moov atom|invalid data|Invalid argument", "الملف المرفوع تالف أو بصيغة غير مدعومة", "اطلب من العميل رفع الملف بصيغة MP4 أو تحويله، أو أضف تحويلًا تلقائيًا قبل المعالجة"),
    (r"no space|disk|ENOSPC", "مساحة السيرفر امتلأت", "نظّف الملفات القديمة أو زِد مساحة السيرفر"),
    (r"JSON|parse|Expecting value|decode", "رد الذكاء الاصطناعي لم يأتِ بالشكل المتوقع", "أعد المحاولة. إذا تكرر: شدّد صيغة الطلب للموديل أو أضف إصلاحًا للرد"),
    (r"not found|غير موجود", "شيء مطلوب غير موجود (حُذف أو رابط قديم)", "تأكد أن الواجهة لا تطلب عنصرًا محذوفًا، وأن الرابط صحيح"),
    (r"Traceback|Exception|خطأ داخلي", "خطأ في كود البرنامج نفسه", "افتح التفاصيل التقنية وصلّح الكود في المكان المذكور"),
    (r"stuck|شغّال منذ", "الشغل بدأ ولم ينتهِ (وقف في النص)", "تأكد أن العملية ما زالت تعمل. غالبًا السيرفر أعاد التشغيل أثناءها: اجعل الشغل يُستكمل تلقائيًا أو يُعلَّم فاشلًا ويُعاد"),
]


BY_STATUS = {402: 0, 504: 2, 429: 3, 404: 8, 500: 9}   # الرقم ← القاعدة (لو الرسالة نفسها مافيهاش حاجة معروفة)


LANG_FIX = {"no_en": ("جمل تظهر للعميل وليس لها ترجمة إنجليزية في frontend/i18n-en.js، فتظهر بالعربي في وضع الإنجليزي",
                     "أضف ترجمتها في frontend/i18n-en.js (الجملة بالضبط كمفتاح)، أو علّمها data-no-i18n إن كانت محتوى العميل"),
            "dialect": ("كلام الواجهة لازم يكون بالعربية الفصحى، وهذه الجمل فيها كلمات عامية",
                        "أعد كتابتها بالفصحى (وحدّث مفتاحها في i18n-en.js)، أو أضفها إلى tests/i18n/allow.json إن كانت محتوى بلهجة العميل")}


def explain(message: str, raw: str = "", status: int = 0, kind: str = "") -> tuple[str, str]:
    if kind == "i18n":
        return LANG_FIX["dialect" if "عامية" in message else "no_en"]
    txt = f"{message}\n{raw}\n{kind}"
    if status == 500:   # خطأ في الكود: الرسالة نفسها فيها كلام زي «key» أو «JSON» بيوه
        return RULES[9][1], RULES[9][2]
    for pat, cause, fix in RULES:
        if re.search(pat, txt, re.I):
            return cause, fix
    if status in BY_STATUS:
        return RULES[BY_STATUS[status]][1], RULES[BY_STATUS[status]][2]
    if 400 <= status < 500:
        return "طلب مرفوض من البرنامج (غالبًا رسالة توضيحية للعميل)", "راجع إذا كانت الرسالة واضحة للعميل وتخبره ماذا يفعل"
    return "غير معروف بعد", "افتح التفاصيل التقنية"


def record(kind: str, path: str, message: str, raw: str = "", status: int = 0, user: str = "", screen: str = "", ref: str = "") -> None:
    """يسجّل خطأ (أو يزوّد عدّاده لو اتسجّل قبل كده). مابيرميش استثناء أبدًا: التسجيل ماينفعش يكسر البرنامج."""
    try:
        np_ = norm_path(path)
        fp = hashlib.sha1(f"{kind}|{np_}|{_norm(message)}".encode()).hexdigest()[:16]
        if ref:   # نفس الشغل بيرجع في كل متابعة: يتعد مرة واحدة
            k = f"{fp}:{ref}"
            if k in _SEEN:
                return
            _SEEN[k] = time.time()
            if len(_SEEN) > 5000:
                for x in sorted(_SEEN, key=_SEEN.get)[:2500]:
                    _SEEN.pop(x, None)
        cause, fix = explain(message, raw, status, kind)
        now = time.time()
        with _LOCK, closing(_db()) as c, c:
            r = c.execute("SELECT users, workspaces FROM issues WHERE id=?", (fp,)).fetchone()
            if r:
                us, ws = set(json.loads(r["users"] or "[]")), set(json.loads(r["workspaces"] or "[]"))
                if user:
                    us.add(user)
                ws.add(TENANT)
                c.execute("""UPDATE issues SET count=count+1, last_at=?, raw=?, users=?, workspaces=?, resolved_at=NULL,
                             screen=COALESCE(NULLIF(?, ''), screen) WHERE id=?""",
                          (now, str(raw)[:4000], json.dumps(sorted(us)[:50]), json.dumps(sorted(ws)[:50]), screen, fp))
            else:
                c.execute("""INSERT INTO issues (id, kind, path, status, message, raw, cause, fix, screen, users, workspaces, first_at, last_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                          (fp, kind, np_, status, str(message)[:1000], str(raw)[:4000], cause, fix, screen,
                           json.dumps([user] if user else []), json.dumps([TENANT]), now, now))
    except Exception:   # noqa: BLE001
        pass


def scan_json(path: str, body, user: str = "") -> None:
    """ردود المتابعة: أي شغل حالته «فشل» (ومعاه سبب) أو «شغّال» من زمان، جوه الرد بأي عمق."""
    now = time.time()

    def walk(x, depth=0):
        if depth > 6:
            return
        if isinstance(x, dict):
            st = str(x.get("status") or "")
            ref = str(x.get("id") or x.get("job") or "")
            if st in ("failed", "error") and (x.get("error") or x.get("message")):
                record("job", path, str(x.get("error") or x.get("message")), str(x.get("error_raw") or x.get("raw") or ""), user=user, ref=ref or str(x.get("error"))[:40])
            elif st in ("working", "running", "rendering", "processing") and ref:
                k = f"{norm_path(path)}:{ref}"
                t0 = _WORKING.setdefault(k, now)
                if now - t0 > STUCK_MIN * 60:
                    record("stuck", path, f"يعمل منذ أكثر من {int(STUCK_MIN)} دقيقة: {x.get('step') or x.get('stage') or st}", json.dumps(x, ensure_ascii=False)[:1500],
                           user=user, ref=ref)
            elif ref:
                _WORKING.pop(f"{norm_path(path)}:{ref}", None)
            for v in x.values():
                if isinstance(v, (dict, list)):
                    walk(v, depth + 1)
        elif isinstance(x, list):
            for v in x[:200]:
                walk(v, depth + 1)
    try:
        walk(body)
    except Exception:   # noqa: BLE001
        pass


# 🙈 العميل مايشوفش أخطاء تقنية (HTTP 400، أسماء موديلات، request_id، Traceback…): الأصل بيتسجل في صندوق الأخطاء،
#   وللعميل جملة هادية. بيتطبق على خانات الخطأ بس (error / detail / render_error) في ردود /api/.
FRIENDLY = "تعذّر إتمام هذه الخطوة الآن. سجّلنا المشكلة وسنصلحها، فجرّب مرة أخرى بعد قليل."
ERR_KEYS = ("error", "detail", "render_error")
_TECH = re.compile(r"HTTP ?\d{3}|request_id|Traceback|\{['\"]|\b(?:google|openai|anthropic|deepseek|minimax|kling|bytedance|atlas|gemini|gpt)[-/.]|"
                   r"Error\b|Exception|errno|ffmpeg|https?://|\b[45]\d\d\b.*(?:bad request|not found|forbidden|unauthorized)|\.py\b", re.I)


def technical(s: str) -> bool:
    if not isinstance(s, str) or not s.strip():
        return False
    if _TECH.search(s):
        return True
    latin = sum(c.isascii() and c.isalpha() for c in s)
    return len(s) > 24 and latin > 0.5 * sum(c.isalpha() for c in s)


def soften(x, depth: int = 0):
    """يبدّل رسايل الخطأ التقنية بجملة هادية (في أي عمق). يرجع (القيمة, اتغيّر؟)."""
    if depth > 8:
        return x, False
    changed = False
    if isinstance(x, dict):
        out = {}
        for k, v in x.items():
            if k in ERR_KEYS and isinstance(v, str) and technical(v):
                out[k], changed = FRIENDLY, True
            elif isinstance(v, (dict, list)):
                out[k], c = soften(v, depth + 1)
                changed = changed or c
            else:
                out[k] = v
        return out, changed
    if isinstance(x, list):
        out = []
        for v in x:
            nv, c = soften(v, depth + 1) if isinstance(v, (dict, list)) else (v, False)
            out.append(nv)
            changed = changed or c
        return out, changed
    return x, False


def _tech_msgs(x, depth: int = 0) -> list[str]:
    """رسايل الخطأ التقنية اللي soften هيبدّلها."""
    out: list[str] = []
    if depth > 8:
        return out
    if isinstance(x, dict):
        for k, v in x.items():
            if k in ERR_KEYS and isinstance(v, str) and technical(v):
                out.append(v)
            elif isinstance(v, (dict, list)):
                out += _tech_msgs(v, depth + 1)
    elif isinstance(x, list):
        for v in x[:200]:
            out += _tech_msgs(v, depth + 1)
    return out


class Middleware:
    """ASGI خام: بيبص على ردود /api/ (من غير ما يلمس الستريم والفيديو) ويسجّل الأخطاء والشغل الفاشل أو المتعطّل."""

    MAX = 600_000

    def __init__(self, app_):
        self.app = app_

    async def __call__(self, scope, receive, send):
        path = scope.get("path") or ""
        if scope["type"] != "http" or not path.startswith("/api/") or path.startswith("/api/issues"):
            return await self.app(scope, receive, send)
        hdr = {k.decode().lower(): v.decode("latin-1") for k, v in scope.get("headers") or []}
        user = hdr.get("x-user-email", "")
        state = {"status": 200, "json": False, "buf": bytearray(), "over": False, "start": None}
        soft = not path.startswith(("/api/platform", "/api/admin", "/api/lab"))   # صفحات الأدمن والمعمل بتشوف الأصل

        async def send2(msg):
            if msg["type"] == "http.response.start":
                state["status"] = msg["status"]
                ct = next((v.decode() for k, v in msg.get("headers") or [] if k.lower() == b"content-type"), "")
                state["json"] = "json" in ct
                if state["json"] and soft:   # الرد بيستنى لحد ما يكمل، عشان رسالة الخطأ تتبدّل قبل ما توصل
                    state["start"] = msg
                    return
            elif msg["type"] == "http.response.body" and state["json"] and not state["over"]:
                state["buf"] += msg.get("body") or b""
                if len(state["buf"]) > self.MAX:   # رد كبير: يعدّي زي ما هو
                    state["over"] = True
                    if state["start"] is not None:
                        await send(state["start"])
                        state["start"] = None
                        body, state["buf"] = bytes(state["buf"]), bytearray()
                        return await send({**msg, "body": body})
                    state["buf"] = bytearray()
                if not msg.get("more_body"):
                    self.inspect(scope, path, state, user)
                    if state["start"] is not None:
                        body = bytes(state["buf"])
                        try:
                            old = json.loads(body or b"null")
                            new, changed = soften(old)
                            if changed:
                                body = json.dumps(new, ensure_ascii=False).encode()
                                for m in _tech_msgs(old)[:3]:   # الأصل اللي اتخبّى عن العميل لازم يوصل الصندوق
                                    record("api", f"{scope.get('method')} {path}", m[:300], m[:2000], state["status"], user, ref=path)   # المتابعة كل ثانيتين: مرة واحدة
                        except ValueError:
                            pass
                        start = state["start"]
                        state["start"] = None
                        hs = [(k, v) for k, v in start.get("headers") or [] if k.lower() != b"content-length"] + [(b"content-length", str(len(body)).encode())]
                        await send({**start, "headers": hs})
                        return await send({"type": "http.response.body", "body": body, "more_body": False})
                    return await send(msg)
                if state["start"] is not None:
                    return
            await send(msg)
        try:
            await self.app(scope, receive, send2)
        except Exception as exc:   # خطأ في الكود (٥٠٠): يتسجل بمكانه بالظبط، وبعدين يكمّل زي ما هو
            import traceback  # noqa: PLC0415
            tb = traceback.extract_tb(exc.__traceback__)
            where = next((f"{Path(f.filename).name}:{f.lineno} ({f.name})" for f in reversed(tb) if "/backend/" in f.filename), "")
            record("api", f"{scope.get('method')} {path}", f"خطأ داخلي في السيرفر: {type(exc).__name__}: {str(exc)[:200]}",
                   f"{where}\n" + "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))[-3500:], 500, user)
            raise

    @staticmethod
    def inspect(scope, path, state, user) -> None:
        st, raw = state["status"], bytes(state["buf"])
        if st >= 400 and st not in SKIP_STATUS:
            try:
                d = json.loads(raw or b"{}")
                msg = d.get("detail") if isinstance(d, dict) else str(d)
            except ValueError:
                msg = raw[:300].decode("utf-8", "replace")
            record("api", f"{scope.get('method')} {path}", str(msg), raw[:2000].decode("utf-8", "replace"), st, user)
        elif st < 300 and raw and (b'"failed"' in raw or b'"working"' in raw or b'"running"' in raw or b'"rendering"' in raw):
            try:
                scan_json(path, json.loads(raw), user)
            except ValueError:
                pass


def listing(open_only: bool = True, limit: int = 300) -> list[dict]:
    with closing(_db()) as c:
        q = "SELECT * FROM issues" + (" WHERE resolved_at IS NULL" if open_only else "") + " ORDER BY last_at DESC LIMIT ?"
        rows = [dict(r) for r in c.execute(q, (limit,))]
    for r in rows:
        r["users"], r["workspaces"] = json.loads(r["users"] or "[]"), json.loads(r["workspaces"] or "[]")
    return rows


def resolve(iid: str, note: str = "", reopen: bool = False) -> None:
    with closing(_db()) as c, c:
        c.execute("UPDATE issues SET resolved_at=?, note=? WHERE id=?", (None if reopen else time.time(), note[:2000], iid))


def open_count() -> int:
    try:
        with closing(_db()) as c:
            return c.execute("SELECT COUNT(*) FROM issues WHERE resolved_at IS NULL").fetchone()[0]
    except sqlite3.Error:
        return 0
