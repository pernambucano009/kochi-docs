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
    for _col, _typ in (("provider", "TEXT"), ("sub_id", "TEXT"), ("customer", "TEXT"), ("ends_at", "REAL"), ("sub_started", "REAL"),
                       ("cycle", "TEXT"), ("refill_at", "REAL")):
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
        raise HTTPException(400, "البريد الإلكتروني غير مظبوط")
    return e


def check_pw(p: str) -> None:
    if len(p or "") < 8:
        raise HTTPException(400, "كلمة المرور يجب يكون 8 حروف أو أرقام على الأقل")


# محاولات الدخول الغلط: ١٠ في ١٥ دقيقة لكل إيميل / IP
_fails: dict[str, list[float]] = {}


def throttle(*keys: str) -> None:
    now = time.time()
    for k in keys:
        lst = [t for t in _fails.get(k, []) if now - t < 900]
        _fails[k] = lst
        if len(lst) >= 10:
            raise HTTPException(429, "محاولات كثير خطأ. انتظر ربع ساعة وجرّب مرة أخرى")


def failed(*keys: str) -> None:
    for k in keys:
        _fails.setdefault(k, []).append(time.time())


def client_ip(request: Request) -> str:
    # آخر عنوان هو اللي البروكسي بتاع Railway ضافه؛ الأول الزائر يقدر يكتبه بنفسه ويتهرب من حد المحاولات
    fwd = [x.strip() for x in (request.headers.get("x-forwarded-for") or "").split(",") if x.strip()]
    return fwd[-1] if fwd else (request.client.host if request.client else "")


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


def hook_secret() -> str:
    v = kv_get("zernio_hook_secret")
    if not v:
        v = secrets.token_hex(24)
        kv_set("zernio_hook_secret", v)
    return v


# 💬 مين صاحب حساب السوشيال ده؟ كل نسخة بتكتب حساباتها اللي عليها «علّق بكلمة» في dm_accounts.json
_dm_routes: dict = {"t": 0.0, "map": {}}


def dm_route(account: str) -> str | None:
    if time.time() - _dm_routes["t"] > 30 or account not in _dm_routes["map"]:
        m = {}
        for d in [DATA_DIR, *(p for p in TENANTS.iterdir() if p.is_dir())]:
            try:
                accs = json.loads((d / "dm_accounts.json").read_text("utf-8"))
            except (OSError, ValueError):
                continue
            wid = OWNER if d == DATA_DIR else d.name
            for a in accs if isinstance(accs, list) else []:
                m[str(a)] = wid
        _dm_routes.update(t=time.time(), map=m)
    return _dm_routes["map"].get(account)


def tenant_env(wid: str) -> dict:
    env = dict(os.environ)
    for k, v in owner_keys().items():
        env.setdefault(k, v)
    d = workspace_dir(wid)
    d.mkdir(parents=True, exist_ok=True)
    env.setdefault("COMICS_DATA", str(DATA_DIR / "_shared" / "comics"))   # مكتبة الكوميكس واحدة لكل الحسابات
    env.update(STUDIOMANIA_DATA=str(d), GATEWAY_SECRET=GATEWAY_SECRET, TENANT_ID=wid,
               TENANT_ROLE="admin" if wid == OWNER else "customer", PLATFORM_DB=str(PDB))
    env.pop("APP_PASSWORD", None)
    # أسرار المنصة نفسها (الدفع والإيميل والدخول بجوجل) بتفضل في البوابة بس
    for k in list(env):
        if k.startswith(("STRIPE_", "PAYPAL_", "TAP_", "SMTP_", "RESEND_", "GOOGLE_CLIENT_")):
            env.pop(k)
    env["ZERNIO_HOOK_SECRET"] = hook_secret()   # توقيع الرسايل اللي جاية من خدمة النشر (علّق بكلمة)
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
            raise HTTPException(503, "البرنامج لم يستطع يفتح، جرّب مرة أخرى بعد قليلًا")
        try:
            if httpx.get(f"http://127.0.0.1:{port}/health", timeout=2).status_code == 200:
                return Tenant(wid, port, proc)
        except httpx.HTTPError:
            pass
        time.sleep(0.4)
    proc.kill()
    raise HTTPException(503, "البرنامج تأخر في الفتح، جرّب مرة أخرى")


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


def provider_watch() -> None:
    """💳 رصيد المنصات: كل نص ساعة بنسأل، وكل دقيقة بنشوف لو حد سجّل طلب فشل بسبب الرصيد. التنبيه جرس عند الأدمن + إيميل."""
    import providers
    from datetime import datetime, timezone
    f = PLATFORM / "providers.json"   # نفس الملف اللي النسخ بتكتب فيه (جنب PLATFORM_DB)
    d = providers.load(f)
    if time.time() - float(d.get("checked") or 0) > providers.CHECK_EVERY:
        d = providers.refresh(f, owner_keys())
    rows = providers.alerts(d)
    providers.save(f, d)
    for row in rows:
        title, body = providers.alert_text(row)
        admin_alert(title, body, f"credit:{row['key']}", "اشحن من لوحة المنصة، وبعدها البرنامج هيرجع يشتغل لوحده.")


def admin_alert(title: str, body: str, ref: str, tail: str = "") -> None:
    """تنبيه للأدمن: جرس في البرنامج (قاعدة بيانات مساحة صاحب البرنامج) + إيميل."""
    from datetime import datetime, timezone
    try:
        with closing(sqlite3.connect(DATA_DIR / "studiomania.db", timeout=10)) as c, c:
            c.execute("INSERT INTO notifications (id, kind, level, title, body, link, ref, read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)",
                      (uuid.uuid4().hex[:12], "admin", "bad", title, body, "settings", ref, datetime.now(timezone.utc).isoformat(timespec="seconds")))
    except sqlite3.Error:
        pass
    with closing(db()) as c:
        admins = [r["email"] for r in c.execute("SELECT email FROM users WHERE role='admin'")]
    want = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
    for email in sorted({*admins, *([want] if want else [])}):
        try:
            mailer.send(email, f"{title} · {mailer.BRAND}", f"{body}\n\n{tail}".strip())
        except Exception:  # noqa: BLE001  (الإيميل مش أهم من الجرس)
            pass


# ---------------------------------------------------------------- 🗄️ النسخة الاحتياطية اليومية على جوجل درايف
_backup_busy = threading.Lock()


def backup_state() -> dict:
    try:
        last = json.loads(kv_get("backup_last") or "{}")
    except ValueError:
        last = {}
    return {"connected": bool(kv_get("drive_refresh")), "email": kv_get("drive_email") or "", "last": last,
            "error": kv_get("backup_error") or "", "google": bool(os.environ.get("GOOGLE_CLIENT_ID") and os.environ.get("GOOGLE_CLIENT_SECRET")),
            "busy": _backup_busy.locked(), "keep": __import__("backup").KEEP}


def backup_now() -> dict:
    import backup
    if not _backup_busy.acquire(blocking=False):
        raise backup.BackupError("فيه نسخة بتتعمل دلوقتي")
    try:
        out = backup.run(DATA_DIR, kv_get("drive_refresh") or "", os.environ.get("GOOGLE_CLIENT_ID", ""), os.environ.get("GOOGLE_CLIENT_SECRET", ""),
                         kv_get("drive_folder"))
        kv_set("drive_folder", out["folder"])
        kv_set("backup_last", json.dumps(out))
        kv_set("backup_error", "")
        return out
    except (backup.BackupError, httpx.HTTPError, OSError) as exc:
        kv_set("backup_error", str(exc)[:300])
        kv_set("backup_tried", str(time.time()))
        raise backup.BackupError(str(exc)) from exc
    finally:
        _backup_busy.release()


def backup_first() -> None:
    import backup
    try:
        backup_now()
    except backup.BackupError:
        pass   # الغلطة بتظهر في الإعدادات


def backup_tick() -> None:
    """مرة في اليوم (ولو فشلت بنجرّب تاني بعد ٣ ساعات، والتنبيه مرة واحدة لكل غلطة)."""
    import backup
    if not kv_get("drive_refresh") or not os.environ.get("GOOGLE_CLIENT_ID"):
        return
    try:
        last = float(json.loads(kv_get("backup_last") or "{}").get("at") or 0)
    except ValueError:
        last = 0
    tried = float(kv_get("backup_tried") or 0)
    if time.time() - last < backup.EVERY or time.time() - tried < 3 * 3600:
        return
    kv_set("backup_tried", str(time.time()))
    try:
        backup_now()
        kv_set("backup_alerted", "")
    except backup.BackupError as exc:
        if kv_get("backup_alerted") != str(exc)[:120]:
            kv_set("backup_alerted", str(exc)[:120])
            admin_alert("🔴 النسخة الاحتياطية مااتعملتش", str(exc)[:300], "backup", "افتح الإعدادات ← النسخة الاحتياطية، ودوس «اعمل نسخة دلوقتي» أو اربط جوجل درايف تاني.")


ENV0 = set(os.environ)   # اللي جاي من الاستضافة نفسها ليه الأولوية على اللي اتحفظ من صفحة الإعدادات


def sync_owner_keys() -> None:
    """مفاتيح المنصة اللي الأدمن حفظها من صفحة الإعدادات (الدفع والإيميل والدخول بجوجل) بتوصل للبوابة من غير إعادة تشغيل."""
    for k, v in owner_keys().items():
        if k not in ENV0 and v and os.environ.get(k) != v:
            os.environ[k] = v


try:
    sync_owner_keys()
except Exception:  # noqa: BLE001
    pass


def reaper() -> None:
    while True:
        time.sleep(60)
        try:
            sync_owner_keys()
        except Exception:  # noqa: BLE001
            pass
        try:
            provider_watch()
        except Exception:  # noqa: BLE001  (المراقبة عمرها ماتوقف البوابة)
            pass
        try:
            backup_tick()
        except Exception:  # noqa: BLE001
            pass
        try:
            yearly_refill()
        except Exception:  # noqa: BLE001
            pass
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
        raise HTTPException(401, "يجب تسجّل دخول")
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
        raise HTTPException(400, "حساب الأدمن متعمل من قبل")
    want = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
    email = norm_email(body.email)
    if want and email != want:
        raise HTTPException(403, "هذا البريد الإلكتروني غير هو بريد إلكتروني الأدمن المتسجل في الخادم")
    if old_password_set() and not old_password_ok(body.old_password):
        failed(client_ip(request))
        raise HTTPException(401, "كلمة المرور القديم الخاص بالبرنامج خطأ")
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
        raise HTTPException(400, "البرنامج ما زال يُجهّز")
    email = norm_email(body.email)
    check_pw(body.password)
    if user_by("email", email):
        raise HTTPException(400, "هذا البريد الإلكتروني لديه حساب. ادخل به أو استخدم «نسيت كلمة المرور»")
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
        raise HTTPException(401, "البريد الإلكتروني أو كلمة المرور خطأ")
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
        raise HTTPException(401, "يجب تسجّل دخول")
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
            raise HTTPException(400, "هذا الرابط خلص أو اتستخدم من قبل. ادخل واطلب رابط جديد")
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
            raise HTTPException(400, "هذا الرابط خلص أو اتستخدم من قبل. اطلب رابط جديد")
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
        raise HTTPException(401, "يجب تسجّل دخول")
    if u["pw"] and not pw_ok(body.current, u["pw"]):
        raise HTTPException(400, "كلمة المرور الحالي خطأ")
    check_pw(body.new)
    with closing(db()) as c, c:
        c.execute("UPDATE users SET pw=? WHERE id=?", (pw_hash(body.new), u["id"]))
    return with_session(JSONResponse({"ok": True}), user_by("id", u["id"]), request)


# ---------------------------------------------------------------- الدخول بجوجل

@app.get("/auth/google")
def google_start(request: Request):
    cid = os.environ.get("GOOGLE_CLIENT_ID")
    if not cid:
        raise HTTPException(404, "الدخول بجوجل غير متفعّل")
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
            # أول ربط بجوجل: صاحب الإيميل الحقيقي اتأكد، فأي باسورد اتعمل قبل كده (ممكن من حد تاني) بيتشال وجلساته بتقفل
            if not u["google_sub"] and u["role"] != "admin":
                c.execute("UPDATE users SET pw=NULL WHERE id=?", (u["id"],))
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
                       amount: float, cycle: str = "month") -> None:
    p = plan_of(plan)
    w = workspace(wid)
    if not p or not w:
        return
    old = (w["provider"], w["sub_id"])
    with closing(db()) as c, c:
        if not paid_once(c, ref, wid, provider, "subscription", amount, f"{plan} +{extra} {'ap' if autopilot else ''}"):
            return
        c.execute("""UPDATE workspaces SET plan=?, extra_accounts=?, autopilot=?, provider=?, sub_id=?, customer=COALESCE(?, customer),
                     ends_at=NULL, sub_started=?, cycle=?, refill_at=? WHERE id=?""",
                  (plan, extra, int(autopilot), provider, sub_id, customer, time.time(), "year" if cycle == "year" else "month", time.time(), wid))
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
        c.execute("UPDATE workspaces SET refill_at=? WHERE id=?", (time.time(), wid))
        ledger_add(c, wid, p["credits"], "renewal", f"تجديد باقة {p['name']}", ref)


MONTH = 30 * 86400


def renews_at(w) -> float | None:
    """إمتى نقط الباقة هترجع تاني (تقريبًا شهر من آخر مرة)."""
    if not w or w["plan"] in ("none", "trial") or not w["refill_at"]:
        return None
    return w["refill_at"] + MONTH


def yearly_refill() -> None:
    """الاشتراك السنوي بيتدفع مرة في السنة، بس نقط الباقة بترجع لعددها كل شهر (من غير ترحيل)."""
    now = time.time()
    with closing(db()) as c:
        rows = c.execute("""SELECT id, plan, refill_at FROM workspaces WHERE cycle='year' AND plan NOT IN ('none', 'trial')
                            AND (ends_at IS NULL OR ends_at > ?) AND refill_at IS NOT NULL AND refill_at <= ?""", (now, now - MONTH)).fetchall()
    for r in rows:
        p = plan_of(r["plan"])
        if not p:
            continue
        with closing(db()) as c, c:
            c.execute("UPDATE workspaces SET refill_at=? WHERE id=?", (r["refill_at"] + MONTH, r["id"]))
            c.execute("UPDATE wallet SET plan_credits=?, updated_at=? WHERE workspace=?", (p["credits"], now, r["id"]))
            ledger_add(c, r["id"], p["credits"], "renewal", f"نقط الشهر · باقة {p['name']} السنوية")


def end_subscription(wid: str, at: float | None = None) -> None:
    """الاشتراك اتلغى: بيفضل شغال لآخر الفترة المدفوعة، وبعدها نقط الباقة والحسابات والأوتوبايلوت بيروحوا (النقط الزيادة بتفضل)."""
    with closing(db()) as c, c:
        if at and at > time.time():
            c.execute("UPDATE workspaces SET ends_at=? WHERE id=?", (at, wid))
            return
        c.execute("UPDATE workspaces SET plan='none', extra_accounts=0, autopilot=0, sub_id=NULL, ends_at=NULL WHERE id=?", (wid,))
        c.execute("UPDATE wallet SET plan_credits=0, updated_at=? WHERE workspace=?", (time.time(), wid))
        ledger_add(c, wid, 0, "cancel", "الاشتراك خلص")


def topup_bonus(c, wid: str, cfg: dict) -> int:
    """باقة «وكالات» النقط الزيادة ليها بالضعف (topup_bonus في الباقة)."""
    r = c.execute("SELECT plan FROM workspaces WHERE id=?", (wid,)).fetchone()
    p = next((x for x in cfg["plans"] if r and x["key"] == r["plan"]), None)
    return max(1, int((p or {}).get("topup_bonus") or 1))


def add_topup(wid: str, key: str, provider: str, ref: str, amount: float) -> bool:
    cfg = billing.config(DATA_DIR)
    t = next((x for x in cfg["topups"] if x["key"] == key), None)
    if not t or amount + 0.01 < t["price"]:
        return False
    with closing(db()) as c, c:
        if not paid_once(c, ref, wid, provider, "topup", amount, key):
            return True
        n = t["credits"] * topup_bonus(c, wid, cfg)
        c.execute("INSERT OR IGNORE INTO wallet (workspace, plan_credits, topup_credits, updated_at) VALUES (?, 0, 0, ?)", (wid, time.time()))
        c.execute("UPDATE wallet SET topup_credits=topup_credits+?, updated_at=? WHERE workspace=?", (n, time.time(), wid))
        ledger_add(c, wid, n, "topup", f"نقط زيادة {n}", ref)
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
        raise HTTPException(401, "يجب تسجّل دخول")
    if u["workspace"] == OWNER:
        raise HTTPException(400, "حساب صاحب البرنامج لا يحتاج اشتراك")
    return u


@app.get("/billing")
def billing_page(request: Request, ok: str = "", err: str = ""):
    """الصفحة القديمة اتشالت: «باقتي ونقاطي» بقت جوه البرنامج (أيقونة الكارت في الشريط اللي فوق)."""
    if not current_user(request):
        return RedirectResponse("/login?next=/billing")
    q = "&ok=" + ok if ok in ("plan", "topup") else "&err=paypal" if err == "paypal" else ""
    return RedirectResponse("/?plans=1" + q)


@app.get("/api/billing")
def billing_state(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401, "يجب تسجّل دخول")
    w = workspace(u["workspace"])
    with closing(db()) as c:
        hist = [dict(r) for r in c.execute("SELECT delta, kind, note, at FROM ledger WHERE workspace=? ORDER BY at DESC LIMIT 30",
                                          (u["workspace"],))]
    cfg = billing.config(DATA_DIR)
    return {"me": me_dict(u), "owner": u["workspace"] == OWNER, "plan": w["plan"] if w else "owner",
            "extra_accounts": (w["extra_accounts"] if w else 0), "autopilot": bool(w and w["autopilot"]),
            "cycle": (w["cycle"] if w and w["cycle"] else "month"), "renews_at": renews_at(w),
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
    cycle: str = "month"      # month | year


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
                raise HTTPException(400, "باقة هذه النقاط غير موجودة")
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
                raise HTTPException(400, "طريقة دفع غير معروفة")
            return {"url": url}
        try:
            tot = billing.custom_total(cfg, body.plan, body.accounts, body.autopilot)
        except ValueError as e:
            raise HTTPException(400, str(e))
        p, add = plan_of(body.plan), {a["key"]: a for a in cfg["addons"]}
        extra = tot["accounts"] - p["accounts"]
        ap_paid = tot["autopilot"] and not p.get("autopilot")
        yr = body.cycle == "year"
        px = (lambda v: billing.yearly(cfg, v)) if yr else (lambda v: v)
        meta = {"wid": wid, "kind": "plan", "plan": p["key"], "extra": str(extra), "ap": "1" if ap_paid else "0", "cycle": "year" if yr else "month"}
        if body.provider == "stripe":
            lines = [(f"SimsimKit · باقة {p['name']}{' · سنوي' if yr else ''}", px(p["price"]), 1), (add["account"]["name"], px(add["account"]["price"]), extra)]
            if ap_paid:
                lines.append((add["autopilot"]["name"], px(add["autopilot"]["price"]), 1))
            url = payments.stripe_checkout(mode="subscription", lines=lines, meta=meta, email=u["email"],
                                           customer=w["customer"] if w and w["provider"] == "stripe" else None,
                                           success=f"{back}/billing?ok=plan", cancel=f"{back}/billing", interval="year" if yr else "month")
        elif body.provider == "paypal":
            key = f"{p['key']}:{extra}:{int(ap_paid)}:{tot['total']}{':y' if yr else ''}"
            pid = payments.paypal_plan((kv_get, kv_set), key, f"SimsimKit {p['name_en']} +{extra} accounts{' +autopilot' if ap_paid else ''}{' yearly' if yr else ''}",
                                       px(tot["total"]), "YEAR" if yr else "MONTH")
            url = payments.paypal_subscribe(pid, f"{wid}|{p['key']}|{extra}|{int(ap_paid)}{'|y' if yr else ''}", u["email"],
                                            ret=f"{back}/api/billing/paypal/sub", cancel=f"{back}/billing")
        else:
            raise HTTPException(400, "طريقة دفع غير معروفة")
        return {"url": url}
    except payments.PayError as e:
        raise HTTPException(502, str(e))


@app.post("/api/billing/portal")
def portal(request: Request):
    u = customer_user(request)
    w = workspace(u["workspace"])
    if not w or w["provider"] != "stripe" or not w["customer"]:
        raise HTTPException(400, "لا يوجد اشتراك بالكارت")
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
        raise HTTPException(400, "لا يوجد اشتراك يعمل")
    try:
        if w["provider"] == "paypal":
            nxt = payments.paypal_sub(w["sub_id"]).get("next")
            payments.paypal_cancel(w["sub_id"])
            end_subscription(u["workspace"], _iso(nxt))
        else:
            raise HTTPException(400, "الاشتراك بالكارت يتلغي من «إدارة الاشتراك»")
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
                                   obj["subscription"], obj.get("customer"), obj["id"], amount, m.get("cycle") or "month")
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
    if s["status"] not in ("ACTIVE", "APPROVED") or len(parts) not in (4, 5) or parts[0] != u["workspace"]:
        return RedirectResponse("/billing?err=paypal")
    wid, plan, extra, ap = parts[:4]
    yr = len(parts) == 5 and parts[4] == "y"
    cfg = billing.config(DATA_DIR)
    tot = billing.custom_total(cfg, plan, int(extra), ap == "1")
    apply_subscription(wid, plan, int(extra), ap == "1", "paypal", subscription_id, None, f"pp-sub-{subscription_id}",
                       billing.yearly(cfg, tot["total"]) if yr else tot["total"], "year" if yr else "month")
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
        raise HTTPException(403, "للأدمن فقط")
    return u


@app.get("/auth/drive")
def drive_start(request: Request):
    """ربط جوجل درايف للنسخة الاحتياطية (الأدمن بس)."""
    import backup
    admin(request)
    cid = os.environ.get("GOOGLE_CLIENT_ID")
    if not cid or not os.environ.get("GOOGLE_CLIENT_SECRET"):
        return RedirectResponse("/#settings")
    state = secrets.token_urlsafe(16)
    resp = RedirectResponse(backup.oauth_url(cid, f"{base_url(request)}/auth/drive/callback", state))
    resp.set_cookie("d_state", state, max_age=600, httponly=True, samesite="lax")
    return resp


@app.get("/auth/drive/callback")
def drive_back(request: Request, code: str = "", state: str = "", error: str = ""):
    import backup
    admin(request)
    if error or not state or not hmac.compare_digest(state, request.cookies.get("d_state") or ""):
        return RedirectResponse("/#settings")
    try:
        r = backup.exchange(code, os.environ["GOOGLE_CLIENT_ID"], os.environ.get("GOOGLE_CLIENT_SECRET", ""), f"{base_url(request)}/auth/drive/callback")
    except (backup.BackupError, httpx.HTTPError, KeyError) as exc:
        kv_set("backup_error", str(exc)[:300])
        return RedirectResponse("/#settings")
    kv_set("drive_refresh", r["refresh"])
    kv_set("drive_email", r["email"])
    kv_set("drive_folder", "")
    kv_set("backup_error", "")
    kv_set("backup_tried", "0")
    threading.Thread(target=backup_first, daemon=True).start()   # أول نسخة على طول
    resp = RedirectResponse("/#settings")
    resp.delete_cookie("d_state")
    return resp


@app.get("/api/platform/backup")
def backup_get(request: Request):
    admin(request)
    return backup_state()


@app.post("/api/platform/backup")
async def backup_run(request: Request):
    import backup
    admin(request)
    if not kv_get("drive_refresh"):
        raise HTTPException(400, "اربط جوجل درايف أولًا")
    try:
        await asyncio.to_thread(backup_now)
    except backup.BackupError as exc:
        raise HTTPException(400, str(exc)) from exc
    return backup_state()


@app.post("/api/platform/backup/disconnect")
def backup_disconnect(request: Request):
    admin(request)
    kv_set("drive_refresh", "")
    kv_set("drive_email", "")
    return backup_state()


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
# هيدرز البوابة بس هي اللي تحطها: لو الزائر بعتها بنفسه بتتشال
SPOOF = ("x-gateway-secret", "x-user-", "x-forwarded-", "x-real-ip", "forwarded")
MAX_BODY = int(float(os.environ.get("MAX_UPLOAD_MB") or 2048) * 1024 * 1024)
SEC_HEADERS = {"x-content-type-options": "nosniff", "x-frame-options": "SAMEORIGIN", "referrer-policy": "strict-origin-when-cross-origin"}


class SecurityMiddleware:
    """هيدرز أمان على كل رد، ورفض الرفع اللي حجمه المعلن أكبر من الحد (ASGI خام عشان الستريم والفيديو يفضلوا زي ما هم)."""

    def __init__(self, app_):
        self.app = app_

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        cl = dict(scope.get("headers") or []).get(b"content-length", b"0")
        if cl.isdigit() and int(cl) > MAX_BODY:
            resp = JSONResponse({"detail": f"الملف أكبر من المسموح ({MAX_BODY // 1048576} ميجا)"}, status_code=413)
            return await resp(scope, receive, send)

        async def send2(msg):
            if msg["type"] == "http.response.start":
                have = {k.lower() for k, _ in msg.get("headers") or []}
                msg["headers"] = list(msg.get("headers") or []) + [(k.encode(), v.encode()) for k, v in SEC_HEADERS.items() if k.encode() not in have]
            await send(msg)
        await self.app(scope, receive, send2)


app.add_middleware(SecurityMiddleware)


async def capped(stream):
    """الرفع من غير حجم معروف: بيقف لو عدّى الحد."""
    n = 0
    async for chunk in stream:
        n += len(chunk)
        if n > MAX_BODY:
            raise HTTPException(413, "الملف أكبر من المسموح")
        yield chunk


@app.post("/hooks/zernio")
async def zernio_hook(request: Request):
    """الرسايل اللي على الخاص من خدمة النشر: بنتأكد من التوقيع، ونوصّلها لنسخة العميل صاحب الحساب."""
    import dmflow
    raw = await request.body()
    if not dmflow.verify(raw, request.headers.get("x-zernio-signature") or "", hook_secret()):
        return JSONResponse({"detail": "bad signature"}, status_code=401)
    try:
        payload = json.loads(raw)
    except ValueError:
        return JSONResponse({"detail": "bad json"}, status_code=400)
    msg = dmflow.parse(payload)
    wid = dm_route(msg["account"]) if msg else None
    if not wid:
        return {"ok": True, "did": "no-route"}
    t = await ensure(wid)
    try:
        r = await _http.post(f"http://127.0.0.1:{t.port}/api/_hooks/dm", content=raw,
                             headers={"x-gateway-secret": GATEWAY_SECRET, "content-type": "application/json"}, timeout=60)
        return JSONResponse(r.json(), status_code=r.status_code)
    except (httpx.HTTPError, ValueError):
        return JSONResponse({"detail": "tenant error"}, status_code=502)


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
async def proxy(path: str, request: Request):
    url_path = "/" + path
    if url_path.startswith(("/api/_hooks/", "/api/_tenant/")):   # داخلي بين البوابة والنسخ بس
        return JSONResponse({"detail": "مش موجود"}, status_code=404)
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
    if u and u["verified"] and url_path in ("/pricing", "/pricing.html"):
        return RedirectResponse("/?plans=1")   # المسجّل دخول بيشوف «باقتي ونقاطي» جوه البرنامج
    if u and u["role"] != "admin" and ADMIN_ONLY.match(url_path):
        if url_path == "/api/settings" and request.method == "GET":
            return JSONResponse({"keys": {}, "password_from_env": False, "customer": True})
        return JSONResponse({"detail": "الصفحة دي مش متاحة"}, status_code=403)
    # الملفات العامة (من غير دخول) بتتقرا من نسخة صاحب البرنامج، ومن غير بيانات
    t = await ensure(OWNER if u_pub else u["workspace"])
    t.last = time.time()
    headers = [(k, v) for k, v in request.headers.raw
               if (n := k.decode().lower()) not in HOP and n != "cookie" and not n.startswith(SPOOF)]
    headers += [(b"x-gateway-secret", GATEWAY_SECRET.encode()), (b"x-forwarded-host", (request.headers.get("host") or "").encode()),
                (b"x-forwarded-proto", (request.headers.get("x-forwarded-proto") or request.url.scheme).encode())]
    if u and not u_pub:
        headers += [(b"x-user-email", u["email"].encode()), (b"x-user-role", u["role"].encode())]
    target = f"http://127.0.0.1:{t.port}{url_path}" + (f"?{request.url.query}" if request.url.query else "")
    req = _http.build_request(request.method, target, headers=headers,
                              content=capped(request.stream()) if request.method not in ("GET", "HEAD", "OPTIONS") else None)
    try:
        r = await _http.send(req, stream=True)
    except httpx.HTTPError:
        _tenants.pop(t.wid, None)
        return JSONResponse({"detail": "البرنامج بيعيد التشغيل، جرّب تاني كمان ثانية"}, status_code=503)
    out_headers = [(k, v) for k, v in r.headers.multi_items() if k.lower() not in HOP and k.lower() != "set-cookie"]
    resp = StreamingResponse(r.aiter_raw(), status_code=r.status_code, background=BackgroundTask(r.aclose))
    resp.raw_headers = [(k.encode("latin-1"), v.encode("latin-1")) for k, v in out_headers]
    return resp
