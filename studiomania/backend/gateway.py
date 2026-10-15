"""🚪 البوابة: الحسابات والدخول، وكل عميل ليه نسخة برنامج لوحده ببياناته (مفيش عميل يشوف حاجة عميل تاني).

- البوابة هي اللي بتفتح للناس (PORT). البرنامج نفسه (app.py) بيشتغل نسخة لكل مساحة عمل على 127.0.0.1 بس،
  وبيقبل الطلبات اللي جاية من البوابة بس (هيدر سري GATEWAY_SECRET).
- مساحة صاحب البرنامج (owner) = فولدر البيانات القديم زي ما هو (مفيش نقل)، والعملاء في _platform/tenants/<id>.
- نسخة العميل بتتفتح أول ما يدخل، وبتتقفل لو مفيش استخدام IDLE_MIN دقيقة ومفيش شغل شغال جواها.
- الحسابات: إيميل وباسورد (مع تأكيد الإيميل) أو جوجل (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).
- أول دخول: صاحب البرنامج بيعمل حساب الأدمن بإيميله، وبيأكد بالباسورد القديم بتاع البرنامج لو كان متعمل.

التشغيل: uvicorn gateway:app --app-dir backend
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import socket
import sqlite3
import subprocess
import sys
import threading
import time
import uuid
from contextlib import closing
from pathlib import Path
from urllib.parse import urlencode

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse, Response, StreamingResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

import billing
import mailer
import payments

BACKEND = Path(__file__).resolve().parent
ROOT = BACKEND.parent
FRONTEND = ROOT / "frontend"
DATA_DIR = Path(os.environ.get("STUDIOMANIA_DATA") or ROOT / "data")
PLATFORM = DATA_DIR / "_platform"
TENANTS = PLATFORM / "tenants"
PDB = PLATFORM / "platform.db"
TENANTS.mkdir(parents=True, exist_ok=True)

COOKIE = "sp_session"
SESSION_DAYS = 30
IDLE_MIN = float(os.environ.get("TENANT_IDLE_MIN") or 30)
OWNER = "owner"
TRIAL = next((p for p in billing.DEFAULTS["plans"] if p["key"] == "trial"), {"credits": 300})

_secret_file = PLATFORM / "secret.key"
if not _secret_file.exists():
    _secret_file.write_bytes(secrets.token_bytes(32))
    _secret_file.chmod(0o600)
SECRET = _secret_file.read_bytes()
# السر اللي بين البوابة ونسخ البرنامج (بيتغيّر مع كل تشغيل، والنسخ بتتفتح من جديد)
GATEWAY_SECRET = secrets.token_hex(24)


# ---------------------------------------------------------------- قاعدة بيانات المنصة

def db() -> sqlite3.Connection:
    c = sqlite3.connect(PDB, timeout=30)
    c.row_factory = sqlite3.Row
    return c


with closing(db()) as _c, _c:
    _c.executescript("""
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT DEFAULT '', pw TEXT, verified INTEGER DEFAULT 0,
      role TEXT DEFAULT 'customer', workspace TEXT NOT NULL, google_sub TEXT, created_at REAL, last_login REAL);
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY, name TEXT DEFAULT '', plan TEXT DEFAULT 'trial', extra_accounts INTEGER DEFAULT 0,
      autopilot INTEGER DEFAULT 0, created_at REAL);
    CREATE TABLE IF NOT EXISTS tokens (token TEXT PRIMARY KEY, user_id TEXT, kind TEXT, expires REAL);
    CREATE TABLE IF NOT EXISTS wallet (workspace TEXT PRIMARY KEY, plan_credits INTEGER DEFAULT 0, topup_credits INTEGER DEFAULT 0,
      updated_at REAL);
    CREATE TABLE IF NOT EXISTS ledger (id TEXT PRIMARY KEY, workspace TEXT, delta INTEGER, kind TEXT, note TEXT, ref TEXT, at REAL);
    CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
    CREATE TABLE IF NOT EXISTS payments (ref TEXT PRIMARY KEY, workspace TEXT, provider TEXT, kind TEXT, amount REAL, note TEXT, at REAL);
    """)
    _cols = {r[1] for r in _c.execute("PRAGMA table_info(workspaces)")}
    for _col, _typ in (("provider", "TEXT"), ("sub_id", "TEXT"), ("customer", "TEXT"), ("ends_at", "REAL"), ("sub_started", "REAL")):
        if _col not in _cols:
            _c.execute(f"ALTER TABLE workspaces ADD COLUMN {_col} {_typ}")


def kv_get(k: str) -> str | None:
    with closing(db()) as c:
        r = c.execute("SELECT v FROM kv WHERE k=?", (k,)).fetchone()
    return r["v"] if r else None


def kv_set(k: str, v: str) -> None:
    with closing(db()) as c, c:
        c.execute("INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)", (k, v))


# ---------------------------------------------------------------- الباسوردات والجلسات

def pw_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    return f"{salt.hex()}${hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 200_000).hex()}"


def pw_ok(password: str, stored: str | None) -> bool:
    if not stored or "$" not in stored:
        return False
    salt, digest = stored.split("$", 1)
    return hmac.compare_digest(hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000).hex(), digest)


def _sign(payload: str) -> str:
    return hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()


def _ver(u: sqlite3.Row) -> str:
    # تغيير الباسورد بيقفل كل الجلسات القديمة
    return hashlib.sha256((u["pw"] or u["google_sub"] or "").encode()).hexdigest()[:10]


def make_session(u: sqlite3.Row) -> str:
    payload = f"{u['id']}.{int(time.time()) + SESSION_DAYS * 86400}.{_ver(u)}"
    return f"{payload}.{_sign(payload)}"


def user_by(field: str, value: str) -> sqlite3.Row | None:
    assert field in ("id", "email", "google_sub")
    with closing(db()) as c:
        return c.execute(f"SELECT * FROM users WHERE {field}=?", (value,)).fetchone()


def current_user(request: Request) -> sqlite3.Row | None:
    tok = request.cookies.get(COOKIE) or ""
    parts = tok.split(".")
    if len(parts) != 4:
        return None
    uid, exp, ver, sig = parts
    if not hmac.compare_digest(sig, _sign(f"{uid}.{exp}.{ver}")) or not exp.isdigit() or int(exp) < time.time():
        return None
    u = user_by("id", uid)
    return u if u and _ver(u) == ver else None


def with_session(resp: Response, u: sqlite3.Row, request: Request) -> Response:
    secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    resp.set_cookie(COOKIE, make_session(u), max_age=SESSION_DAYS * 86400, httponly=True, samesite="lax", secure=secure)
    return resp


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def norm_email(e: str) -> str:
    e = (e or "").strip().lower()
    if not EMAIL_RE.match(e) or len(e) > 200:
        raise HTTPException(400, "الإيميل مش مظبوط")
    return e


def check_pw(p: str) -> None:
    if len(p or "") < 8:
        raise HTTPException(400, "الباسورد لازم يكون 8 حروف أو أرقام على الأقل")


# محاولات الدخول الغلط: ١٠ في ١٥ دقيقة لكل إيميل / IP
_fails: dict[str, list[float]] = {}


def throttle(*keys: str) -> None:
    now = time.time()
    for k in keys:
        lst = [t for t in _fails.get(k, []) if now - t < 900]
        _fails[k] = lst
        if len(lst) >= 10:
            raise HTTPException(429, "محاولات كتير غلط. استنى ربع ساعة وجرّب تاني")


def failed(*keys: str) -> None:
    for k in keys:
        _fails.setdefault(k, []).append(time.time())


def client_ip(request: Request) -> str:
    return (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")).split(",")[0].strip()


# ---------------------------------------------------------------- مساحات العمل والنقط

def new_workspace(name: str) -> str:
    wid = uuid.uuid4().hex[:12]
    with closing(db()) as c, c:
        c.execute("INSERT INTO workspaces (id, name, plan, created_at) VALUES (?, ?, 'trial', ?)", (wid, name, time.time()))
        c.execute("INSERT INTO wallet (workspace, plan_credits, topup_credits, updated_at) VALUES (?, ?, 0, ?)",
                  (wid, TRIAL["credits"], time.time()))
        c.execute("INSERT INTO ledger (id, workspace, delta, kind, note, at) VALUES (?, ?, ?, 'trial', 'نقط التجربة المجانية', ?)",
                  (uuid.uuid4().hex, wid, TRIAL["credits"], time.time()))
    return wid


def workspace_dir(wid: str) -> Path:
    return DATA_DIR if wid == OWNER else TENANTS / wid


def workspace(wid: str) -> sqlite3.Row | None:
    with closing(db()) as c:
        return c.execute("SELECT * FROM workspaces WHERE id=?", (wid,)).fetchone()


def wallet(wid: str) -> dict:
    with closing(db()) as c:
        r = c.execute("SELECT * FROM wallet WHERE workspace=?", (wid,)).fetchone()
    if not r:
        return {"plan_credits": 0, "topup_credits": 0, "total": 0}
    return {"plan_credits": r["plan_credits"], "topup_credits": r["topup_credits"], "total": r["plan_credits"] + r["topup_credits"]}


# ---------------------------------------------------------------- نسخ البرنامج (نسخة لكل مساحة عمل)

class Tenant:
    def __init__(self, wid: str, port: int, proc: subprocess.Popen):
        self.wid, self.port, self.proc = wid, port, proc
        self.last = time.time()


_tenants: dict[str, Tenant] = {}
_locks: dict[str, asyncio.Lock] = {}


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def owner_keys() -> dict:
    """مفاتيح الخدمات اللي صاحب البرنامج حفظها من صفحة الإعدادات (في قاعدة بيانات مساحته)، عشان نسخ العملاء تشتغل بيها."""
    out = {}
    try:
        with closing(sqlite3.connect(DATA_DIR / "studiomania.db")) as c:
            for k, v in c.execute("SELECT key, value FROM settings WHERE key LIKE 'key:%'"):
                out[k[4:]] = v
    except sqlite3.Error:
        pass
    return out


def tenant_env(wid: str) -> dict:
    env = dict(os.environ)
    for k, v in owner_keys().items():
        env.setdefault(k, v)
    d = workspace_dir(wid)
    d.mkdir(parents=True, exist_ok=True)
    env.update(STUDIOMANIA_DATA=str(d), GATEWAY_SECRET=GATEWAY_SECRET, TENANT_ID=wid,
               TENANT_ROLE="admin" if wid == OWNER else "customer", PLATFORM_DB=str(PDB))
    env.pop("APP_PASSWORD", None)
    if wid == OWNER:
        if kv_get("zernio_owner_profile"):
            env["ZERNIO_PROFILE_ID"] = kv_get("zernio_owner_profile")
    else:
        env["ZERNIO_PROFILE_NAME"] = f"ws-{wid}"
        env.pop("ZERNIO_PROFILE_ID", None)
    return env


def _spawn(wid: str) -> Tenant:
    port = free_port()
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app:app", "--app-dir", str(BACKEND), "--host", "127.0.0.1", "--port", str(port),
         "--proxy-headers", "--forwarded-allow-ips", "127.0.0.1", "--log-level", "warning"],
        env=tenant_env(wid), cwd=str(ROOT))
    deadline = time.time() + 90
    while time.time() < deadline:
        if proc.poll() is not None:
            raise HTTPException(503, "البرنامج مقدرش يفتح، جرّب تاني بعد شوية")
        try:
            if httpx.get(f"http://127.0.0.1:{port}/health", timeout=2).status_code == 200:
                return Tenant(wid, port, proc)
        except httpx.HTTPError:
            pass
        time.sleep(0.4)
    proc.kill()
    raise HTTPException(503, "البرنامج اتأخر في الفتح، جرّب تاني")


async def ensure(wid: str) -> Tenant:
    t = _tenants.get(wid)
    if t and t.proc.poll() is None:
        t.last = time.time()
        return t
    lock = _locks.setdefault(wid, asyncio.Lock())
    async with lock:
        t = _tenants.get(wid)
        if t and t.proc.poll() is None:
            return t
        t = await asyncio.to_thread(_spawn, wid)
        _tenants[wid] = t
        return t


def _busy(t: Tenant) -> bool:
    try:
        r = httpx.get(f"http://127.0.0.1:{t.port}/api/_tenant/busy", headers={"x-gateway-secret": GATEWAY_SECRET}, timeout=5)
        return bool(r.json().get("busy"))
    except (httpx.HTTPError, ValueError):
        return False


def _keep(wid: str) -> bool:
    if wid == OWNER:
        return True
    w = workspace(wid)
    plan = next((p for p in billing.config(DATA_DIR)["plans"] if w and p["key"] == w["plan"]), None)
    return bool(w and (w["autopilot"] or (plan and plan.get("autopilot"))))   # الأوتوبايلوت لازم يفضل شغال


def reaper() -> None:
    while True:
        time.sleep(60)
        for wid, t in list(_tenants.items()):
            if t.proc.poll() is not None:
                _tenants.pop(wid, None)
            elif time.time() - t.last > IDLE_MIN * 60 and not _keep(wid) and not _busy(t):
                t.proc.terminate()
                _tenants.pop(wid, None)


# ---------------------------------------------------------------- التطبيق

app = FastAPI(title="Gateway", docs_url=None, redoc_url=None, openapi_url=None)
_http = httpx.AsyncClient(timeout=httpx.Timeout(None, connect=10), limits=httpx.Limits(max_connections=400))


@app.on_event("startup")
async def _start():
    threading.Thread(target=reaper, daemon=True).start()


@app.on_event("shutdown")
async def _stop():
    for t in _tenants.values():
        t.proc.terminate()


def page(name: str) -> Response:
    html = (FRONTEND / name).read_text(encoding="utf-8")
    return Response(html, media_type="text/html; charset=utf-8", headers={"Cache-Control": "no-cache"})


def base_url(request: Request) -> str:
    env = (os.environ.get("PUBLIC_URL") or "").rstrip("/")
    if env:
        return env
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    return f"{proto}://{request.headers.get('host') or request.url.netloc}"


def needs_owner_setup() -> bool:
    with closing(db()) as c:
        return not c.execute("SELECT 1 FROM users WHERE role='admin'").fetchone()


def old_password_set() -> bool:
    try:
        with closing(sqlite3.connect(DATA_DIR / "studiomania.db")) as c:
            return bool(c.execute("SELECT 1 FROM settings WHERE key='password_hash'").fetchone()) or bool(os.environ.get("APP_PASSWORD"))
    except sqlite3.Error:
        return bool(os.environ.get("APP_PASSWORD"))


def old_password_ok(p: str) -> bool:
    if os.environ.get("APP_PASSWORD"):
        return hmac.compare_digest(p.encode(), os.environ["APP_PASSWORD"].encode())
    try:
        with closing(sqlite3.connect(DATA_DIR / "studiomania.db")) as c:
            r = c.execute("SELECT value FROM settings WHERE key='password_hash'").fetchone()
    except sqlite3.Error:
        return False
    return bool(r) and pw_ok(p, r[0])


AUTH_PAGES = ("/login", "/signup", "/forgot", "/reset", "/verify", "/setup")
PUBLIC_FILES = {"/pricing", "/pricing.html", "/api/pricing"}


@app.get("/health")
def health():
    return {"ok": True, "tenants": len(_tenants)}


for _p in AUTH_PAGES:
    app.add_api_route(_p, lambda: page("auth.html"), methods=["GET"], include_in_schema=False)

# الصفحات العامة (الرئيسية والشروط والخصوصية والاسترجاع): مفتوحة لأي حد، وبوابات الدفع بتراجعها
SITE_PAGES = {"/welcome": "welcome.html", "/terms": "terms.html", "/privacy": "privacy.html", "/refund": "refund.html"}
for _p, _f in SITE_PAGES.items():
    for _u in (_p, _p + ".html"):
        app.add_api_route(_u, (lambda f=_f: page(f)), methods=["GET"], include_in_schema=False)


@app.get("/api/auth/state")
def auth_state(request: Request):
    u = current_user(request)
    return {"logged_in": bool(u and u["verified"]), "user": me_dict(u) if u else None, "needs_setup": needs_owner_setup(),
            "old_password": old_password_set(), "google": bool(os.environ.get("GOOGLE_CLIENT_ID")),
            "mail": mailer.configured()}


def me_dict(u: sqlite3.Row) -> dict:
    w = workspace(u["workspace"])
    return {"email": u["email"], "name": u["name"], "verified": bool(u["verified"]), "role": u["role"],
            "workspace": u["workspace"], "plan": (w["plan"] if w else "owner"), "credits": wallet(u["workspace"]),
            "has_password": bool(u["pw"])}


@app.get("/api/me")
def me(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401, "لازم تسجّل دخول")
    return me_dict(u)


class SetupIn(BaseModel):
    email: str
    password: str
    name: str = ""
    old_password: str = ""


@app.post("/api/auth/setup")
def owner_setup(body: SetupIn, request: Request):
    """أول مرة: حساب صاحب البرنامج (الأدمن)، ومساحته هي البيانات القديمة زي ما هي."""
    if not needs_owner_setup():
        raise HTTPException(400, "حساب الأدمن متعمل قبل كده")
    want = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
    email = norm_email(body.email)
    if want and email != want:
        raise HTTPException(403, "الإيميل ده مش هو إيميل الأدمن المتسجل في السيرفر")
    if old_password_set() and not old_password_ok(body.old_password):
        failed(client_ip(request))
        raise HTTPException(401, "الباسورد القديم بتاع البرنامج غلط")
    check_pw(body.password)
    uid = uuid.uuid4().hex[:12]
    with closing(db()) as c, c:
        c.execute("INSERT OR IGNORE INTO workspaces (id, name, plan, created_at) VALUES (?, ?, 'owner', ?)", (OWNER, "Owner", time.time()))
        c.execute("INSERT INTO users (id, email, name, pw, verified, role, workspace, created_at) VALUES (?, ?, ?, ?, 1, 'admin', ?, ?)",
                  (uid, email, body.name.strip()[:80], pw_hash(body.password), OWNER, time.time()))
    _remember_owner_profile()
    return with_session(JSONResponse({"ok": True}), user_by("id", uid), request)


def _remember_owner_profile() -> None:
    """بروفايل Zernio بتاع صاحب البرنامج (أول بروفايل موجود) عشان حسابات العملاء متظهرش عنده."""
    if kv_get("zernio_owner_profile"):
        return
    try:
        env = {**os.environ, **owner_keys()}
        key = env.get("ZERNIO_API_KEY") or env.get("LATE_API_KEY")
        if not key:
            return
        base = os.environ.get("ZERNIO_BASE_URL", "https://zernio.com/api/v1")
        data = httpx.get(f"{base}/profiles", headers={"Authorization": f"Bearer {key}"}, timeout=20).json()
        items = data.get("profiles", data.get("data", [])) if isinstance(data, dict) else data
        if items:
            kv_set("zernio_owner_profile", items[0].get("_id") or items[0].get("id"))
    except (httpx.HTTPError, ValueError, AttributeError):
        pass


class SignupIn(BaseModel):
    email: str
    password: str
    name: str = ""


SKIP_VERIFY = os.environ.get("SKIP_EMAIL_VERIFY") == "1"
if SKIP_VERIFY:   # الحسابات اللي اتعملت قبل ما المتغير يتحط كمان
    with closing(db()) as _c, _c:
        _c.execute("UPDATE users SET verified=1 WHERE verified=0")
MAIL_FAIL = "الإيميل مقدرش يتبعت دلوقتي. جرّب كمان شوية، ولو فضلت المشكلة كلّمنا"


def send_verify(u: sqlite3.Row, request: Request) -> tuple[bool, str | None]:
    """(اتبعت؟، لينك وضع التجربة)."""
    tok = secrets.token_urlsafe(32)
    with closing(db()) as c, c:
        c.execute("DELETE FROM tokens WHERE user_id=? AND kind='verify'", (u["id"],))
        c.execute("INSERT INTO tokens (token, user_id, kind, expires) VALUES (?, ?, 'verify', ?)", (tok, u["id"], time.time() + 3 * 86400))
    link = f"{base_url(request)}/verify?token={tok}"
    sent = mailer.send(u["email"], f"أكّد إيميلك · {mailer.BRAND}", f"أهلًا! أكّد إيميلك من اللينك ده:\n{link}",
                       mailer.button_html("أكّد إيميلك", "دوس على الزرار عشان نتأكد إن الإيميل ده بتاعك ونفتحلك حسابك.", link, "أكّد الإيميل"))
    return sent, (link if (not sent and os.environ.get("MAIL_DEV") == "1") else None)


@app.post("/api/auth/signup")
def signup(body: SignupIn, request: Request):
    throttle(client_ip(request))
    if needs_owner_setup():
        raise HTTPException(400, "البرنامج لسه بيتجهز")
    email = norm_email(body.email)
    check_pw(body.password)
    if user_by("email", email):
        raise HTTPException(400, "الإيميل ده عنده حساب. ادخل بيه أو استخدم «نسيت الباسورد»")
    wid = new_workspace(body.name.strip()[:80] or email.split("@")[0])
    uid = uuid.uuid4().hex[:12]
    with closing(db()) as c, c:
        c.execute("INSERT INTO users (id, email, name, pw, verified, role, workspace, created_at) VALUES (?, ?, ?, ?, ?, 'customer', ?, ?)",
                  (uid, email, body.name.strip()[:80], pw_hash(body.password), int(SKIP_VERIFY), wid, time.time()))
    u = user_by("id", uid)
    if SKIP_VERIFY:   # لحد ما الإيميل يشتغل على السيرفر
        return with_session(JSONResponse({"ok": True, "verify": False}), u, request)
    sent, dev = send_verify(u, request)
    failed(client_ip(request))   # كل تسجيل بيتحسب، عشان محدش يعمل حسابات كتير من نفس المكان
    return with_session(JSONResponse({"ok": True, "verify": True, "dev_link": dev, "mail_failed": not sent and not dev}), u, request)


class LoginIn(BaseModel):
    email: str
    password: str


@app.post("/api/auth/login")
def login(body: LoginIn, request: Request):
    email = (body.email or "").strip().lower()
    throttle(email, client_ip(request))
    u = user_by("email", email)
    if not u or not pw_ok(body.password, u["pw"]):
        failed(email, client_ip(request))
        time.sleep(0.8)
        raise HTTPException(401, "الإيميل أو الباسورد غلط")
    with closing(db()) as c, c:
        c.execute("UPDATE users SET last_login=?, verified=MAX(verified, ?) WHERE id=?", (time.time(), int(SKIP_VERIFY), u["id"]))
    return with_session(JSONResponse({"ok": True, "verify": not (u["verified"] or SKIP_VERIFY)}), u, request)


@app.post("/api/auth/logout")
def logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(COOKIE)
    return resp


@app.post("/api/auth/resend")
def resend(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401, "لازم تسجّل دخول")
    if u["verified"]:
        return {"ok": True, "verified": True}
    throttle("resend:" + u["id"])
    failed("resend:" + u["id"])
    sent, dev = send_verify(u, request)
    if not sent and not dev:
        raise HTTPException(503, MAIL_FAIL)
    return {"ok": True, "dev_link": dev}


@app.get("/api/auth/verify")
def verify(token: str, request: Request):
    with closing(db()) as c, c:
        r = c.execute("SELECT * FROM tokens WHERE token=? AND kind='verify'", (token,)).fetchone()
        if not r or r["expires"] < time.time():
            raise HTTPException(400, "اللينك ده خلص أو اتستخدم قبل كده. ادخل واطلب لينك جديد")
        c.execute("UPDATE users SET verified=1 WHERE id=?", (r["user_id"],))
        c.execute("DELETE FROM tokens WHERE token=?", (token,))
    return with_session(JSONResponse({"ok": True}), user_by("id", r["user_id"]), request)


class ForgotIn(BaseModel):
    email: str


@app.post("/api/auth/forgot")
def forgot(body: ForgotIn, request: Request):
    throttle(client_ip(request))
    failed(client_ip(request))
    u = user_by("email", (body.email or "").strip().lower())
    dev = None
    if u:
        tok = secrets.token_urlsafe(32)
        with closing(db()) as c, c:
            c.execute("DELETE FROM tokens WHERE user_id=? AND kind='reset'", (u["id"],))
            c.execute("INSERT INTO tokens (token, user_id, kind, expires) VALUES (?, ?, 'reset', ?)", (tok, u["id"], time.time() + 3600))
        link = f"{base_url(request)}/reset?token={tok}"
        sent = mailer.send(u["email"], f"غيّر الباسورد · {mailer.BRAND}", f"لو انت اللي طلبت تغيير الباسورد، ادخل على اللينك ده (صالح ساعة):\n{link}",
                           mailer.button_html("غيّر الباسورد", "لو انت اللي طلبت تغيير الباسورد دوس على الزرار. اللينك صالح ساعة. لو مش انت، تجاهل الإيميل ده.", link, "اعمل باسورد جديد"))
        dev = link if (not sent and os.environ.get("MAIL_DEV") == "1") else None
    # نفس الرد سواء الإيميل موجود ولا لأ (عشان محدش يعرف مين متسجل)
    return {"ok": True, "dev_link": dev}


class ResetIn(BaseModel):
    token: str
    password: str


@app.post("/api/auth/reset")
def reset(body: ResetIn, request: Request):
    check_pw(body.password)
    with closing(db()) as c, c:
        r = c.execute("SELECT * FROM tokens WHERE token=? AND kind='reset'", (body.token,)).fetchone()
        if not r or r["expires"] < time.time():
            raise HTTPException(400, "اللينك ده خلص أو اتستخدم قبل كده. اطلب لينك جديد")
        # تغيير الباسورد من الإيميل = الإيميل اتأكد كمان
        c.execute("UPDATE users SET pw=?, verified=1 WHERE id=?", (pw_hash(body.password), r["user_id"]))
        c.execute("DELETE FROM tokens WHERE user_id=? AND kind='reset'", (r["user_id"],))
    return with_session(JSONResponse({"ok": True}), user_by("id", r["user_id"]), request)


class ChangePwIn(BaseModel):
    current: str = ""
    new: str


@app.post("/api/auth/password")
def change_pw(body: ChangePwIn, request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401, "لازم تسجّل دخول")
    if u["pw"] and not pw_ok(body.current, u["pw"]):
        raise HTTPException(400, "الباسورد الحالي غلط")
    check_pw(body.new)
    with closing(db()) as c, c:
        c.execute("UPDATE users SET pw=? WHERE id=?", (pw_hash(body.new), u["id"]))
    return with_session(JSONResponse({"ok": True}), user_by("id", u["id"]), request)


# ---------------------------------------------------------------- الدخول بجوجل

@app.get("/auth/google")
def google_start(request: Request):
    cid = os.environ.get("GOOGLE_CLIENT_ID")
    if not cid:
        raise HTTPException(404, "الدخول بجوجل مش متفعّل")
    state = secrets.token_urlsafe(16)
    q = urlencode({"client_id": cid, "redirect_uri": f"{base_url(request)}/auth/google/callback", "response_type": "code",
                   "scope": "openid email profile", "state": state, "prompt": "select_account"})
    resp = RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{q}")
    resp.set_cookie("g_state", state, max_age=600, httponly=True, samesite="lax")
    return resp


@app.get("/auth/google/callback")
def google_back(request: Request, code: str = "", state: str = ""):
    if not state or not hmac.compare_digest(state, request.cookies.get("g_state") or ""):
        return RedirectResponse("/login?err=google")
    try:
        r = httpx.post("https://oauth2.googleapis.com/token", timeout=20, data={
            "code": code, "client_id": os.environ["GOOGLE_CLIENT_ID"], "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
            "redirect_uri": f"{base_url(request)}/auth/google/callback", "grant_type": "authorization_code"})
        idt = r.json()["id_token"]
        seg = idt.split(".")[1]
        info = json.loads(base64.urlsafe_b64decode(seg + "=" * (-len(seg) % 4)))
    except (httpx.HTTPError, KeyError, ValueError, IndexError):
        return RedirectResponse("/login?err=google")
    if info.get("aud") != os.environ["GOOGLE_CLIENT_ID"] or not info.get("email_verified") or not info.get("email"):
        return RedirectResponse("/login?err=google")
    email, sub = info["email"].lower(), str(info["sub"])
    u = user_by("google_sub", sub) or user_by("email", email)
    if needs_owner_setup():
        return RedirectResponse("/setup")
    if not u:
        wid = new_workspace(info.get("name") or email.split("@")[0])
        uid = uuid.uuid4().hex[:12]
        with closing(db()) as c, c:
            c.execute("INSERT INTO users (id, email, name, verified, role, workspace, google_sub, created_at) VALUES (?, ?, ?, 1, 'customer', ?, ?, ?)",
                      (uid, email, (info.get("name") or "")[:80], wid, sub, time.time()))
        u = user_by("id", uid)
    else:
        with closing(db()) as c, c:
            c.execute("UPDATE users SET google_sub=?, verified=1, last_login=? WHERE id=?", (sub, time.time(), u["id"]))
        u = user_by("id", u["id"])
    resp = with_session(RedirectResponse("/"), u, request)
    resp.delete_cookie("g_state")
    return resp



# ---------------------------------------------------------------- 💳 الاشتراكات والنقط (Stripe / PayPal)

def plan_of(key: str) -> dict | None:
    return next((p for p in billing.config(DATA_DIR)["plans"] if p["key"] == key and not p.get("once")), None)


def ledger_add(c: sqlite3.Connection, wid: str, delta: int, kind: str, note: str, ref: str = "") -> None:
    c.execute("INSERT INTO ledger (id, workspace, delta, kind, note, ref, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
              (uuid.uuid4().hex, wid, delta, kind, note, ref, time.time()))


def paid_once(c: sqlite3.Connection, ref: str, wid: str, provider: str, kind: str, amount: float, note: str) -> bool:
    """True أول مرة بس (كل دفعة بتتسجل مرة واحدة حتى لو الإشعار وصل مرتين)."""
    try:
        c.execute("INSERT INTO payments (ref, workspace, provider, kind, amount, note, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  (ref, wid, provider, kind, amount, note, time.time()))
        return True
    except sqlite3.IntegrityError:
        return False


def apply_subscription(wid: str, plan: str, extra: int, autopilot: bool, provider: str, sub_id: str, customer: str | None, ref: str,
                       amount: float) -> None:
    p = plan_of(plan)
    w = workspace(wid)
    if not p or not w:
        return
    old = (w["provider"], w["sub_id"])
    with closing(db()) as c, c:
        if not paid_once(c, ref, wid, provider, "subscription", amount, f"{plan} +{extra} {'ap' if autopilot else ''}"):
            return
        c.execute("""UPDATE workspaces SET plan=?, extra_accounts=?, autopilot=?, provider=?, sub_id=?, customer=COALESCE(?, customer),
                     ends_at=NULL, sub_started=? WHERE id=?""", (plan, extra, int(autopilot), provider, sub_id, customer, time.time(), wid))
        c.execute("INSERT OR IGNORE INTO wallet (workspace, plan_credits, topup_credits, updated_at) VALUES (?, 0, 0, ?)", (wid, time.time()))
        c.execute("UPDATE wallet SET plan_credits=?, updated_at=? WHERE workspace=?", (p["credits"], time.time(), wid))
        ledger_add(c, wid, p["credits"], "plan", f"باقة {p['name']}", ref)
    # اشتراك قديم بباقة تانية: بيتلغي (عشان العميل مايدفعش مرتين)
    if old[1] and old[1] != sub_id:
        try:
            (payments.stripe_cancel if old[0] == "stripe" else payments.paypal_cancel)(old[1])
        except payments.PayError:
            pass


def renew(wid: str, ref: str, amount: float) -> None:
    """تجديد شهري: نقط الباقة بترجع لعددها (من غير ترحيل)."""
    w = workspace(wid)
    p = plan_of(w["plan"]) if w else None
    if not p:
        return
    if w["sub_started"] and time.time() - w["sub_started"] < 2 * 86400:
        return   # أول دفعة (الاشتراك لسه متعمل ومحسوب)
    with closing(db()) as c, c:
        if not paid_once(c, ref, wid, w["provider"] or "", "renewal", amount, w["plan"]):
            return
        c.execute("UPDATE wallet SET plan_credits=?, updated_at=? WHERE workspace=?", (p["credits"], time.time(), wid))
        ledger_add(c, wid, p["credits"], "renewal", f"تجديد باقة {p['name']}", ref)


def end_subscription(wid: str, at: float | None = None) -> None:
    """الاشتراك اتلغى: بيفضل شغال لآخر الفترة المدفوعة، وبعدها نقط الباقة والحسابات والأوتوبايلوت بيروحوا (النقط الزيادة بتفضل)."""
    with closing(db()) as c, c:
        if at and at > time.time():
            c.execute("UPDATE workspaces SET ends_at=? WHERE id=?", (at, wid))
            return
        c.execute("UPDATE workspaces SET plan='none', extra_accounts=0, autopilot=0, sub_id=NULL, ends_at=NULL WHERE id=?", (wid,))
        c.execute("UPDATE wallet SET plan_credits=0, updated_at=? WHERE workspace=?", (time.time(), wid))
        ledger_add(c, wid, 0, "cancel", "الاشتراك خلص")


def add_topup(wid: str, key: str, provider: str, ref: str, amount: float) -> bool:
    t = next((x for x in billing.config(DATA_DIR)["topups"] if x["key"] == key), None)
    if not t or amount + 0.01 < t["price"]:
        return False
    with closing(db()) as c, c:
        if not paid_once(c, ref, wid, provider, "topup", amount, key):
            return True
        c.execute("INSERT OR IGNORE INTO wallet (workspace, plan_credits, topup_credits, updated_at) VALUES (?, 0, 0, ?)", (wid, time.time()))
        c.execute("UPDATE wallet SET topup_credits=topup_credits+?, updated_at=? WHERE workspace=?", (t["credits"], time.time(), wid))
        ledger_add(c, wid, t["credits"], "topup", f"نقط زيادة {t['credits']}", ref)
    return True


def expirer() -> None:
    while True:
        time.sleep(3600)
        with closing(db()) as c:
            due = [r["id"] for r in c.execute("SELECT id FROM workspaces WHERE ends_at IS NOT NULL AND ends_at < ?", (time.time(),))]
        for wid in due:
            end_subscription(wid)


threading.Thread(target=expirer, daemon=True).start()


def customer_user(request: Request) -> sqlite3.Row:
    u = current_user(request)
    if not u or not u["verified"]:
        raise HTTPException(401, "لازم تسجّل دخول")
    if u["workspace"] == OWNER:
        raise HTTPException(400, "حساب صاحب البرنامج مش محتاج اشتراك")
    return u


@app.get("/billing")
def billing_page(request: Request):
    if not current_user(request):
        return RedirectResponse("/login?next=/billing")
    return page("billing.html")


@app.get("/api/billing")
def billing_state(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401, "لازم تسجّل دخول")
    w = workspace(u["workspace"])
    with closing(db()) as c:
        hist = [dict(r) for r in c.execute("SELECT delta, kind, note, at FROM ledger WHERE workspace=? ORDER BY at DESC LIMIT 30",
                                          (u["workspace"],))]
    cfg = billing.config(DATA_DIR)
    return {"me": me_dict(u), "owner": u["workspace"] == OWNER, "plan": w["plan"] if w else "owner",
            "extra_accounts": (w["extra_accounts"] if w else 0), "autopilot": bool(w and w["autopilot"]),
            "provider": w["provider"] if w else None, "ends_at": w["ends_at"] if w else None,
            "can_portal": bool(w and w["provider"] == "stripe" and w["customer"]),
            "stripe": payments.stripe_on(), "paypal": payments.paypal_on(),
            "plans": cfg["plans"], "addons": cfg["addons"], "topups": cfg["topups"], "rules": cfg["rules"], "history": hist}


class CheckoutIn(BaseModel):
    provider: str
    kind: str                 # plan | topup
    plan: str = ""
    accounts: int = 0         # حسابات زيادة
    autopilot: bool = False
    topup: str = ""


@app.post("/api/billing/checkout")
def checkout(body: CheckoutIn, request: Request):
    u = customer_user(request)
    wid, back = u["workspace"], base_url(request)
    w = workspace(wid)
    cfg = billing.config(DATA_DIR)
    try:
        if body.kind == "topup":
            t = next((x for x in cfg["topups"] if x["key"] == body.topup), None)
            if not t:
                raise HTTPException(400, "باقة النقط دي مش موجودة")
            name = f"SimsimKit · {t['credits']:,} نقطة"
            if body.provider == "stripe":
                url = payments.stripe_checkout(mode="payment", lines=[(name, t["price"], 1)],
                                               meta={"wid": wid, "kind": "topup", "topup": t["key"]}, email=u["email"],
                                               customer=w["customer"] if w and w["provider"] == "stripe" else None,
                                               success=f"{back}/billing?ok=topup", cancel=f"{back}/billing")
            elif body.provider == "paypal":
                url = payments.paypal_order(t["price"], f"{wid}|topup|{t['key']}", name,
                                            ret=f"{back}/api/billing/paypal/order", cancel=f"{back}/billing")
            else:
                raise HTTPException(400, "طريقة دفع مش معروفة")
            return {"url": url}
        try:
            tot = billing.custom_total(cfg, body.plan, body.accounts, body.autopilot)
        except ValueError as e:
            raise HTTPException(400, str(e))
        p, add = plan_of(body.plan), {a["key"]: a for a in cfg["addons"]}
        extra = tot["accounts"] - p["accounts"]
        ap_paid = tot["autopilot"] and not p.get("autopilot")
        meta = {"wid": wid, "kind": "plan", "plan": p["key"], "extra": str(extra), "ap": "1" if ap_paid else "0"}
        if body.provider == "stripe":
            lines = [(f"SimsimKit · باقة {p['name']}", p["price"], 1), (add["account"]["name"], add["account"]["price"], extra)]
            if ap_paid:
                lines.append((add["autopilot"]["name"], add["autopilot"]["price"], 1))
            url = payments.stripe_checkout(mode="subscription", lines=lines, meta=meta, email=u["email"],
                                           customer=w["customer"] if w and w["provider"] == "stripe" else None,
                                           success=f"{back}/billing?ok=plan", cancel=f"{back}/billing")
        elif body.provider == "paypal":
            key = f"{p['key']}:{extra}:{int(ap_paid)}:{tot['total']}"
            pid = payments.paypal_plan((kv_get, kv_set), key, f"SimsimKit {p['name_en']} +{extra} accounts{' +autopilot' if ap_paid else ''}",
                                       tot["total"])
            url = payments.paypal_subscribe(pid, f"{wid}|{p['key']}|{extra}|{int(ap_paid)}", u["email"],
                                            ret=f"{back}/api/billing/paypal/sub", cancel=f"{back}/billing")
        else:
            raise HTTPException(400, "طريقة دفع مش معروفة")
        return {"url": url}
    except payments.PayError as e:
        raise HTTPException(502, str(e))


@app.post("/api/billing/portal")
def portal(request: Request):
    u = customer_user(request)
    w = workspace(u["workspace"])
    if not w or w["provider"] != "stripe" or not w["customer"]:
        raise HTTPException(400, "مفيش اشتراك بالكارت")
    try:
        return {"url": payments.stripe_portal(w["customer"], f"{base_url(request)}/billing")}
    except payments.PayError as e:
        raise HTTPException(502, str(e))


@app.post("/api/billing/cancel")
def cancel_sub(request: Request):
    """إلغاء اشتراك PayPal من جوه البرنامج (Stripe بيتلغي من بوابة العميل)."""
    u = customer_user(request)
    w = workspace(u["workspace"])
    if not w or not w["sub_id"]:
        raise HTTPException(400, "مفيش اشتراك شغال")
    try:
        if w["provider"] == "paypal":
            nxt = payments.paypal_sub(w["sub_id"]).get("next")
            payments.paypal_cancel(w["sub_id"])
            end_subscription(u["workspace"], _iso(nxt))
        else:
            raise HTTPException(400, "الاشتراك بالكارت بيتلغي من «إدارة الاشتراك»")
    except payments.PayError as e:
        raise HTTPException(502, str(e))
    return {"ok": True}


def _iso(s: str | None) -> float | None:
    if not s:
        return None
    from datetime import datetime
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


@app.post("/api/billing/stripe/webhook")
async def stripe_hook(request: Request):
    raw = await request.body()
    if not payments.stripe_verify(raw, request.headers.get("stripe-signature", "")):
        raise HTTPException(400, "bad signature")
    ev = json.loads(raw)
    obj, typ = (ev.get("data") or {}).get("object") or {}, ev.get("type")
    if typ == "checkout.session.completed" and obj.get("payment_status") in ("paid", "no_payment_required"):
        m = obj.get("metadata") or {}
        wid, amount = m.get("wid") or obj.get("client_reference_id"), (obj.get("amount_total") or 0) / 100
        if wid and workspace(wid):
            if m.get("kind") == "topup":
                add_topup(wid, m.get("topup", ""), "stripe", obj["id"], amount)
            elif m.get("kind") == "plan" and obj.get("subscription"):
                apply_subscription(wid, m.get("plan", ""), int(m.get("extra") or 0), m.get("ap") == "1", "stripe",
                                   obj["subscription"], obj.get("customer"), obj["id"], amount)
    elif typ == "invoice.paid" and obj.get("billing_reason") == "subscription_cycle":
        with closing(db()) as c:
            r = c.execute("SELECT id FROM workspaces WHERE provider='stripe' AND sub_id=?", (obj.get("subscription"),)).fetchone()
        if r:
            renew(r["id"], obj["id"], (obj.get("amount_paid") or 0) / 100)
    elif typ == "customer.subscription.deleted":
        with closing(db()) as c:
            r = c.execute("SELECT id FROM workspaces WHERE provider='stripe' AND sub_id=?", (obj.get("id"),)).fetchone()
        if r:
            end_subscription(r["id"])
    elif typ == "customer.subscription.updated" and obj.get("cancel_at_period_end"):
        with closing(db()) as c:
            r = c.execute("SELECT id FROM workspaces WHERE provider='stripe' AND sub_id=?", (obj.get("id"),)).fetchone()
        if r and obj.get("current_period_end"):
            with closing(db()) as c, c:
                c.execute("UPDATE workspaces SET ends_at=? WHERE id=?", (float(obj["current_period_end"]) + 3600, r["id"]))
    return {"ok": True}


@app.get("/api/billing/paypal/order")
def paypal_order_back(request: Request, token: str = ""):
    u = customer_user(request)
    try:
        cap = payments.paypal_capture(token)
    except payments.PayError:
        return RedirectResponse("/billing?err=paypal")
    wid, kind, key = (cap.get("custom") or "||").split("|")[:3]
    if cap["status"] != "COMPLETED" or wid != u["workspace"] or kind != "topup" or not add_topup(wid, key, "paypal", token, cap["amount"]):
        return RedirectResponse("/billing?err=paypal")
    return RedirectResponse("/billing?ok=topup")


@app.get("/api/billing/paypal/sub")
def paypal_sub_back(request: Request, subscription_id: str = ""):
    u = customer_user(request)
    try:
        s = payments.paypal_sub(subscription_id)
    except payments.PayError:
        return RedirectResponse("/billing?err=paypal")
    parts = (s.get("custom") or "").split("|")
    if s["status"] not in ("ACTIVE", "APPROVED") or len(parts) != 4 or parts[0] != u["workspace"]:
        return RedirectResponse("/billing?err=paypal")
    wid, plan, extra, ap = parts
    tot = billing.custom_total(billing.config(DATA_DIR), plan, int(extra), ap == "1")
    apply_subscription(wid, plan, int(extra), ap == "1", "paypal", subscription_id, None, f"pp-sub-{subscription_id}", tot["total"])
    return RedirectResponse("/billing?ok=plan")


@app.post("/api/billing/paypal/webhook")
async def paypal_hook(request: Request):
    ev = json.loads(await request.body() or b"{}")
    if not await asyncio.to_thread(payments.paypal_verify, request.headers, ev):
        raise HTTPException(400, "bad signature")
    typ, res = ev.get("event_type"), ev.get("resource") or {}
    sub_id = res.get("billing_agreement_id") if typ == "PAYMENT.SALE.COMPLETED" else res.get("id")
    with closing(db()) as c:
        r = c.execute("SELECT id FROM workspaces WHERE provider='paypal' AND sub_id=?", (sub_id,)).fetchone()
    if not r:
        return {"ok": True}
    if typ == "PAYMENT.SALE.COMPLETED":
        renew(r["id"], res.get("id") or ev.get("id"), float((res.get("amount") or {}).get("total") or 0))
    elif typ in ("BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.SUSPENDED", "BILLING.SUBSCRIPTION.EXPIRED"):
        end_subscription(r["id"], _iso((res.get("billing_info") or {}).get("next_billing_time")) if typ == "BILLING.SUBSCRIPTION.CANCELLED" else None)
    return {"ok": True}

# ---------------------------------------------------------------- لوحة الأدمن (أول جزء: العملاء)

def admin(request: Request) -> sqlite3.Row:
    u = current_user(request)
    if not u or u["role"] != "admin":
        raise HTTPException(403, "للأدمن بس")
    return u


@app.get("/api/platform/users")
def admin_users(request: Request):
    admin(request)
    with closing(db()) as c:
        rows = c.execute("""SELECT u.email, u.name, u.verified, u.role, u.workspace, u.created_at, u.last_login, w.plan,
                            COALESCE(x.plan_credits, 0) + COALESCE(x.topup_credits, 0) AS credits
                            FROM users u LEFT JOIN workspaces w ON w.id = u.workspace LEFT JOIN wallet x ON x.workspace = u.workspace
                            ORDER BY u.created_at DESC""").fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------- كل الباقي بيروح لنسخة البرنامج بتاعة العميل

# حاجات للأدمن بس (المفاتيح، المعمل، أدوات السيرفر، مكسبنا)
ADMIN_ONLY = re.compile(r"^/(api/(lab|admin|pricing/margins|atlas)(/|$)|api/settings$|media/lab/|lab\b)")
HOP = {"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers", "transfer-encoding", "upgrade", "host"}


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
async def proxy(path: str, request: Request):
    url_path = "/" + path
    u = current_user(request)
    if not u or not u["verified"]:
        # ملفات الشكل (CSS / JS) لصفحات الدخول بتتقرا من الفولدر على طول
        f = (FRONTEND / path).resolve()
        if url_path.endswith((".css", ".js", ".svg", ".png", ".ico", ".woff2")) and f.parent == FRONTEND.resolve() and f.is_file():
            return Response(f.read_bytes(), media_type={".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml",
                                                        ".png": "image/png"}.get(f.suffix, "application/octet-stream"),
                            headers={"Cache-Control": "no-cache"})
    u_pub = False
    if not u:
        if url_path.startswith("/api/") and url_path not in PUBLIC_FILES or url_path.startswith("/media/"):
            return JSONResponse({"detail": "لازم تسجّل دخول"}, status_code=401)
        if url_path in PUBLIC_FILES:
            u_pub = True   # صفحة الأسعار: بتتقرا من نسخة صاحب البرنامج
        else:
            if url_path in ("/", ""):
                return RedirectResponse("/welcome")   # الزائر بيشوف الصفحة الرئيسية الأول
            return RedirectResponse("/login?next=" + url_path)
    elif not u["verified"]:
        if url_path in PUBLIC_FILES:
            u_pub = True
        elif url_path.startswith("/api/"):
            return JSONResponse({"detail": "أكّد إيميلك الأول"}, status_code=403)
        else:
            return RedirectResponse("/verify")
    if u and u["role"] != "admin" and ADMIN_ONLY.match(url_path):
        if url_path == "/api/settings" and request.method == "GET":
            return JSONResponse({"keys": {}, "password_from_env": False, "customer": True})
        return JSONResponse({"detail": "الصفحة دي مش متاحة"}, status_code=403)
    # الملفات العامة (من غير دخول) بتتقرا من نسخة صاحب البرنامج، ومن غير بيانات
    t = await ensure(OWNER if u_pub else u["workspace"])
    t.last = time.time()
    headers = [(k, v) for k, v in request.headers.raw if k.decode().lower() not in HOP and k.decode().lower() != "cookie"]
    headers += [(b"x-gateway-secret", GATEWAY_SECRET.encode()), (b"x-forwarded-host", (request.headers.get("host") or "").encode()),
                (b"x-forwarded-proto", (request.headers.get("x-forwarded-proto") or request.url.scheme).encode())]
    if u and not u_pub:
        headers += [(b"x-user-email", u["email"].encode()), (b"x-user-role", u["role"].encode())]
    target = f"http://127.0.0.1:{t.port}{url_path}" + (f"?{request.url.query}" if request.url.query else "")
    req = _http.build_request(request.method, target, headers=headers,
                              content=request.stream() if request.method not in ("GET", "HEAD", "OPTIONS") else None)
    try:
        r = await _http.send(req, stream=True)
    except httpx.HTTPError:
        _tenants.pop(t.wid, None)
        return JSONResponse({"detail": "البرنامج بيعيد التشغيل، جرّب تاني كمان ثانية"}, status_code=503)
    out_headers = [(k, v) for k, v in r.headers.multi_items() if k.lower() not in HOP and k.lower() != "set-cookie"]
    resp = StreamingResponse(r.aiter_raw(), status_code=r.status_code, background=BackgroundTask(r.aclose))
    resp.raw_headers = [(k.encode("latin-1"), v.encode("latin-1")) for k, v in out_headers]
    return resp
