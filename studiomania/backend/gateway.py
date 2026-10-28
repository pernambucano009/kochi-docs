"""🚪 البوابة: الحسابات والدخول، وكل عميل له نسخة برنامج تلقائيًا ببياناته (لا يوجد عميل يرى شيء عميل آخر).

- البوابة هي ما تفتح للناس (PORT). البرنامج نفسه (app.py) يشتغل نسخة لكل مساحة عمل على 127.0.0.1 فقط،
  ويقبل الطلبات التي قادمة من البوابة فقط (سيدر سري GATEWAY_SECRET).
- مساحة صاحب البرنامج (owner) = مجلد البيانات القديم كما هو (لا يوجد نقل)، والعملاء في _platform/tenants/<id>.
- نسخة العميل تُفتح أول ما يدخل، وتُغلق إذا لا يوجد استخدام IDLE_MIN دقيقة ولا يوجد عمل يعمل جواها.
- الحسابات: بريد إلكتروني وكلمة مرور (مع تأكيد البريد الإلكتروني) أو جوجل (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).
- أول دخول: صاحب البرنامج يعمل حساب الأدمن بإيميله، ويأكد بالباسورد القديم الخاص بالبرنامج إذا كان متعمل.

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
import shutil
import socket
import sqlite3
import subprocess
import sys
import threading
import time
import uuid
from contextlib import closing
from pathlib import Path
from urllib.parse import quote, urlencode

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response, StreamingResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

import billing
import fieldpacks
import mailer
import payments
import appauth
import livevoice
import phoneauth

BACKEND = Path(__file__).resolve().parent
ROOT = BACKEND.parent
FRONTEND = ROOT / "frontend"
DATA_DIR = Path(os.environ.get("STUDIOMANIA_DATA") or ROOT / "data")
PLATFORM = DATA_DIR / "_platform"
TENANTS = PLATFORM / "tenants"
PDB = PLATFORM / "platform.db"
os.environ.setdefault("PLATFORM_DB", str(PDB))   # 🚨 صندوق الأخطاء (issues.py) في قاعدة المنصة نفسها، للبوابة وكل النسخ
import issues  # noqa: E402
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
    CREATE TABLE IF NOT EXISTS coupons (code TEXT PRIMARY KEY, points INTEGER DEFAULT 0, pct INTEGER DEFAULT 0, max_uses INTEGER DEFAULT 0,
      used INTEGER DEFAULT 0, expires REAL, note TEXT DEFAULT '', created_at REAL, once INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS coupon_uses (code TEXT, workspace TEXT, at REAL, PRIMARY KEY (code, workspace));
    CREATE TABLE IF NOT EXISTS costs (id TEXT PRIMARY KEY, workspace TEXT, usd REAL, what TEXT, promo INTEGER DEFAULT 0, plan TEXT, ref TEXT, at REAL);
    """)
    _cols = {r[1] for r in _c.execute("PRAGMA table_info(workspaces)")}
    for _col, _typ in (("provider", "TEXT"), ("sub_id", "TEXT"), ("customer", "TEXT"), ("ends_at", "REAL"), ("sub_started", "REAL"),
                       ("cycle", "TEXT"), ("refill_at", "REAL"), ("discount_pct", "INTEGER"), ("discount_code", "TEXT"), ("discount_once", "INTEGER")):
        if _col not in _cols:
            _c.execute(f"ALTER TABLE workspaces ADD COLUMN {_col} {_typ}")
    if "apple_sub" not in {r[1] for r in _c.execute("PRAGMA table_info(users)")}:   # 🍎 الدخول بـ Apple من الآيفون
        _c.execute("ALTER TABLE users ADD COLUMN apple_sub TEXT")
    if "phone" not in {r[1] for r in _c.execute("PRAGMA table_info(users)")}:   # 📱 الدخول برقم الجوال
        _c.execute("ALTER TABLE users ADD COLUMN phone TEXT")
        _c.execute("CREATE UNIQUE INDEX IF NOT EXISTS users_phone ON users(phone)")


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
    return hashlib.sha256((u["pw"] or u["google_sub"] or u["apple_sub"] or u["phone"] or "").encode()).hexdigest()[:10]


def make_session(u: sqlite3.Row) -> str:
    payload = f"{u['id']}.{int(time.time()) + SESSION_DAYS * 86400}.{_ver(u)}"
    return f"{payload}.{_sign(payload)}"


def user_by(field: str, value: str) -> sqlite3.Row | None:
    assert field in ("id", "email", "google_sub", "phone", "apple_sub")
    with closing(db()) as c:
        return c.execute(f"SELECT * FROM users WHERE {field}=?", (value,)).fetchone()


def current_user(request: Request) -> sqlite3.Row | None:
    # تطبيق الموبايل: مشغّل الفيديو مابيبعتش كوكي، فبيبعت نفس توكن الجلسة في Authorization
    auth = request.headers.get("authorization") or ""
    tok = request.cookies.get(COOKIE) or (auth[7:].strip() if auth[:7].lower() == "bearer " else "")
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
        raise HTTPException(400, "البريد الإلكتروني غير صحيح")
    return e


def check_pw(p: str) -> None:
    if len(p or "") < 8:
        raise HTTPException(400, "يجب أن تتكون كلمة المرور من 8 أحرف أو أرقام على الأقل")


# محاولات الدخول الغلط: ١٠ في ١٥ دقيقة لكل إيميل / IP
_fails: dict[str, list[float]] = {}


def throttle(*keys: str) -> None:
    now = time.time()
    for k in keys:
        lst = [t for t in _fails.get(k, []) if now - t < 900]
        _fails[k] = lst
        if len(lst) >= 10:
            raise HTTPException(429, "محاولات خاطئة كثيرة. انتظر ربع ساعة ثم حاول مرة أخرى")


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
        c.execute("INSERT INTO ledger (id, workspace, delta, kind, note, at) VALUES (?, ?, ?, 'trial', 'نقاط التجربة المجانية', ?)",
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
    """مفاتيح الخدمات التي صاحب البرنامج حفظها من صفحة الإعدادات (في قاعدة بيانات مساحته)، لكي نسخ العملاء تشتغل بها."""
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
        if k.startswith(("PAYPAL_", "TAP_", "SMTP_", "RESEND_", "GOOGLE_CLIENT_")):
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
            raise HTTPException(503, "تعذّر فتح البرنامج، حاول مرة أخرى بعد قليل")
        try:
            if httpx.get(f"http://127.0.0.1:{port}/health", timeout=2).status_code == 200:
                return Tenant(wid, port, proc)
        except httpx.HTTPError:
            pass
        time.sleep(0.4)
    proc.kill()
    raise HTTPException(503, "تأخر فتح البرنامج، حاول مرة أخرى")


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
    """💳 رصيد المنصات: كل نص ساعة نسأل، وكل دقيقة نرى إذا حد سجّل طلب فشل بسبب الرصيد. التنبيه جرس عند الأدمن + بريد إلكتروني."""
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
        admin_alert(title, body, f"credit:{row['key']}", "اشحن من لوحة المنصة، وبعدها البرنامج سيعود يشتغل تلقائيًا.")


def admin_alert(title: str, body: str, ref: str, tail: str = "") -> None:
    """تنبيه للأدمن: جرس في البرنامج (قاعدة بيانات مساحة صاحب البرنامج) + بريد إلكتروني."""
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
        raise backup.BackupError("فيه نسخة تُنشأ الآن")
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
    """مرة في اليوم (وإذا فشلت نجرّب مرة أخرى بعد ٣ ساعات، والتنبيه مرة واحدة لكل غلطة)."""
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
            admin_alert("🔴 النسخة الاحتياطية لم تُنشأ", str(exc)[:300], "backup", "افتح الإعدادات ← النسخة الاحتياطية، واضغط «أنشئ نسخة الآن» أو اربط جوجل درايف آخر.")


ENV0 = set(os.environ)   # اللي جاي من الاستضافة نفسها ليه الأولوية على اللي اتحفظ من صفحة الإعدادات


def sync_owner_keys() -> None:
    """مفاتيح المنصة التي الأدمن حفظها من صفحة الإعدادات (الدفع والبريد الإلكتروني والدخول بجوجل) توصل للبوابة بدون إعادة تشغيل."""
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
    if STAGING:   # 🔒 التجريبي: صاحب البرنامج ياخد بروفايل نشر لوحده قبل ما أي نسخة تقوم
        threading.Thread(target=_remember_owner_profile, daemon=True).start()


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
SITE_PAGES = {"/welcome": "welcome.html", "/m": "welcome-m.html", "/terms": "terms.html", "/privacy": "privacy.html", "/refund": "refund.html", "/go": "go.html"}
for _p, _f in SITE_PAGES.items():
    for _u in (_p, _p + ".html"):
        app.add_api_route(_u, (lambda f=_f: page(f)), methods=["GET"], include_in_schema=False)


@app.get("/api/auth/state")
def auth_state(request: Request):
    u = current_user(request)
    return {"logged_in": bool(u and u["verified"]), "user": me_dict(u) if u else None, "needs_setup": needs_owner_setup(),
            "old_password": old_password_set(), "google": bool(os.environ.get("GOOGLE_CLIENT_ID")), "phone": phoneauth.enabled(),
            "mail": mailer.configured(), **fieldpacks.signup_options()}


PHONE_MAIL = "@phone.simsimkit"   # حسابات الجوال من غير بريد: البريد في الجدول عنوان داخلي بس


def real_email(u: sqlite3.Row) -> str:
    return "" if u["email"].endswith((PHONE_MAIL, "@apple.simsimkit")) else u["email"]


def me_dict(u: sqlite3.Row) -> dict:
    w = workspace(u["workspace"])
    return {"email": real_email(u) or u["phone"] or "", "phone": u["phone"] or "", "name": u["name"], "verified": bool(u["verified"]), "role": u["role"],
            "workspace": u["workspace"], "plan": (w["plan"] if w else "owner"), "credits": wallet(u["workspace"]),
            "has_password": bool(u["pw"]), "pts_per_usd": round(billing.MARKUP / billing.CREDIT_USD)}


@app.get("/api/auth/app-token")
def app_token(request: Request):
    """📱 توكن الجلسة لمشغّل الفيديو في التطبيق (الفيديوهات محتاجة دخول، والمشغّل مابيشيلش الكوكي)."""
    u = current_user(request)
    if not u or not u["verified"]:
        raise HTTPException(401, "يجب تسجيل الدخول")
    return {"token": make_session(u)}


@app.get("/api/me")
def me(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401, "يجب تسجيل الدخول")
    return me_dict(u)


class SetupIn(BaseModel):
    email: str
    password: str
    name: str = ""
    old_password: str = ""


@app.post("/api/auth/setup")
def owner_setup(body: SetupIn, request: Request):
    """أول مرة: حساب صاحب البرنامج (الأدمن)، ومساحته هي البيانات القديمة كما هي."""
    if not needs_owner_setup():
        raise HTTPException(400, "حساب المشرف موجود بالفعل")
    want = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
    email = norm_email(body.email)
    if want and email != want:
        raise HTTPException(403, "هذا البريد ليس بريد المشرف المسجّل على الخادم. استخدم البريد المحدد للمشرف")
    if old_password_set() and not old_password_ok(body.old_password):
        failed(client_ip(request))
        raise HTTPException(401, "كلمة المرور القديمة للبرنامج غير صحيحة")
    check_pw(body.password)
    uid = uuid.uuid4().hex[:12]
    with closing(db()) as c, c:
        c.execute("INSERT OR IGNORE INTO workspaces (id, name, plan, created_at) VALUES (?, ?, 'owner', ?)", (OWNER, "Owner", time.time()))
        c.execute("INSERT INTO users (id, email, name, pw, verified, role, workspace, created_at) VALUES (?, ?, ?, ?, 1, 'admin', ?, ?)",
                  (uid, email, body.name.strip()[:80], pw_hash(body.password), OWNER, time.time()))
    _remember_owner_profile()
    return with_session(JSONResponse({"ok": True}), user_by("id", uid), request)


STAGING = os.environ.get("STAGING") == "1"


def _remember_owner_profile() -> None:
    """بروفايل Zernio الخاص بـ صاحب البرنامج (أول بروفايل موجود) لكي حسابات العملاء متظهرش لديه.
    🔒 النسخة التجريبية ليها بروفايل لوحدها («staging-owner»): حسابات السوشيال الحقيقية بتاعة صاحب البرنامج ماتظهرش فيها."""
    if kv_get("zernio_owner_profile") and (not STAGING or kv_get("zernio_owner_profile_kind") == "staging"):
        return
    try:
        env = {**os.environ, **owner_keys()}
        key = env.get("ZERNIO_API_KEY") or env.get("LATE_API_KEY")
        if not key:
            return
        base = os.environ.get("ZERNIO_BASE_URL", "https://zernio.com/api/v1")
        data = httpx.get(f"{base}/profiles", headers={"Authorization": f"Bearer {key}"}, timeout=20).json()
        items = data.get("profiles", data.get("data", [])) if isinstance(data, dict) else data
        if STAGING:
            hit = next((x for x in items or [] if x.get("name") == "staging-owner"), None)
            if not hit:
                hit = httpx.post(f"{base}/profiles", headers={"Authorization": f"Bearer {key}"}, json={"name": "staging-owner"}, timeout=20).json()
                hit = hit.get("profile", hit) if isinstance(hit, dict) else {}
            if hit.get("_id") or hit.get("id"):
                kv_set("zernio_owner_profile", hit.get("_id") or hit.get("id"))
                kv_set("zernio_owner_profile_kind", "staging")
        elif items:
            kv_set("zernio_owner_profile", items[0].get("_id") or items[0].get("id"))
    except (httpx.HTTPError, ValueError, AttributeError):
        pass


class SignupIn(BaseModel):
    email: str
    password: str
    name: str = ""
    country: str = ""
    dialect: str = ""
    field: str = ""
    goal: str = ""
    coupon: str = ""
    gender: str = ""          # m / f: عشان المساعدة تخاطبه صح


# 🗣️ البلد واللهجة والمجال والهدف (fieldpacks): بيتحفظوا في onboard.json في مساحة العميل، والعقل بياخدهم أول ما يتعمل.


def save_onboard(wid: str, country: str, dial: str, field: str = "", goal: str = "", brand: str = "", gender: str = "") -> None:
    ob = fieldpacks.onboard_dict(country, dial, field, goal, brand)
    if not ob:
        return
    if gender in ("m", "f"):
        ob["gender"] = gender
    d = workspace_dir(wid)
    d.mkdir(parents=True, exist_ok=True)
    (d / "onboard.json").write_text(json.dumps(ob, ensure_ascii=False), encoding="utf-8")


SKIP_VERIFY = os.environ.get("SKIP_EMAIL_VERIFY") == "1"
if SKIP_VERIFY:   # الحسابات اللي اتعملت قبل ما المتغير يتحط كمان
    with closing(db()) as _c, _c:
        _c.execute("UPDATE users SET verified=1 WHERE verified=0")
MAIL_FAIL = "تعذّر إرسال البريد الإلكتروني الآن. حاول مرة أخرى بعد قليل، وإن استمرت المشكلة تواصل معنا"


def send_verify(u: sqlite3.Row, request: Request) -> tuple[bool, str | None]:
    """(أُرسل؟، رابط وضع التجربة)."""
    tok = secrets.token_urlsafe(32)
    with closing(db()) as c, c:
        c.execute("DELETE FROM tokens WHERE user_id=? AND kind='verify'", (u["id"],))
        c.execute("INSERT INTO tokens (token, user_id, kind, expires) VALUES (?, ?, 'verify', ?)", (tok, u["id"], time.time() + 3 * 86400))
    link = f"{base_url(request)}/verify?token={tok}"
    sent = mailer.send(u["email"], f"أكّد إيميلك · {mailer.BRAND}", f"أهلًا! أكّد إيميلك من هذا الرابط:\n{link}",
                       mailer.button_html("أكّد إيميلك", "اضغط على الزر لكي نتأكد أن هذا البريد الإلكتروني الخاص بك ونفتحلك حسابك.", link, "أكّد البريد الإلكتروني"))
    return sent, (link if (not sent and os.environ.get("MAIL_DEV") == "1") else None)


@app.post("/api/auth/signup")
def signup(body: SignupIn, request: Request):
    throttle(client_ip(request))
    if needs_owner_setup():
        raise HTTPException(400, "البرنامج قيد التجهيز")
    email = norm_email(body.email)
    check_pw(body.password)
    if user_by("email", email):
        raise HTTPException(400, "يوجد حساب بهذا البريد الإلكتروني. سجّل الدخول به أو استخدم «نسيت كلمة المرور»")
    if body.coupon.strip():   # الكود الغلط بيتقال قبل ما الحساب يتعمل
        with closing(db()) as c:
            k = c.execute("SELECT expires, max_uses, used FROM coupons WHERE code=?", (coupon_code(body.coupon),)).fetchone()
        if not k or (k["expires"] and k["expires"] < time.time()) or (k["max_uses"] and k["used"] >= k["max_uses"]):
            raise HTTPException(400, "كود الخصم غير صحيح أو انتهت صلاحيته")
    wid = new_workspace(body.name.strip()[:80] or email.split("@")[0])
    if body.coupon.strip():
        coupon_redeem(wid, body.coupon)
    save_onboard(wid, body.country.strip().upper()[:2], body.dialect.strip()[:20], body.field.strip()[:20], body.goal.strip()[:20], body.name.strip()[:80], body.gender)
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
        raise HTTPException(401, "البريد الإلكتروني أو كلمة المرور غير صحيحة")
    with closing(db()) as c, c:
        c.execute("UPDATE users SET last_login=?, verified=MAX(verified, ?) WHERE id=?", (time.time(), int(SKIP_VERIFY), u["id"]))
    return with_session(JSONResponse({"ok": True, "verify": not (u["verified"] or SKIP_VERIFY)}), u, request)


class PhoneSendIn(BaseModel):
    phone: str
    channel: str = "sms"


@app.post("/api/auth/phone/send")
def phone_send(body: PhoneSendIn, request: Request):
    """📱 يرسل رمز الدخول للجوال (رسالة نصية أو واتساب)."""
    if not phoneauth.enabled():
        raise HTTPException(400, "الدخول برقم الجوال غير متاح الآن. ادخل بالبريد الإلكتروني أو بجوجل")
    if needs_owner_setup():
        raise HTTPException(400, "البرنامج قيد التجهيز")
    ip = client_ip(request)
    try:
        phone = phoneauth.normalize(body.phone)
        phoneauth.check_limits(phone, ip)
        phoneauth.mark(phone, ip)
        code = phoneauth.send(phone, body.channel)
    except phoneauth.PhoneError as exc:
        raise HTTPException(429 if "انتظر" in str(exc) else 400, str(exc)) from exc
    return {"ok": True, "phone": phone, "channel": "whatsapp" if body.channel == "whatsapp" else "sms", "wait": phoneauth.COOLDOWN, "dev_code": code}


class PhoneVerifyIn(BaseModel):
    phone: str
    code: str
    name: str = ""
    country: str = ""
    dialect: str = ""
    field: str = ""
    goal: str = ""


@app.post("/api/auth/phone/verify")
def phone_verify(body: PhoneVerifyIn, request: Request):
    """الرمز صح ← يدخل، ولو الرقم جديد يتعمل له حساب (من غير بريد ولا كلمة مرور)."""
    try:
        phone = phoneauth.normalize(body.phone)
    except phoneauth.PhoneError as exc:
        raise HTTPException(400, str(exc)) from exc
    throttle("otp:" + phone, client_ip(request))
    if not phoneauth.verify(phone, body.code):
        failed("otp:" + phone, client_ip(request))
        time.sleep(0.5)
        raise HTTPException(400, "الرمز غير صحيح أو انتهت صلاحيته. تأكد منه أو اطلب رمزًا جديدًا")
    u = user_by("phone", phone)
    new = not u
    if new:
        name = body.name.strip()[:80]
        wid = new_workspace(name or phone)
        save_onboard(wid, body.country.strip().upper()[:2], body.dialect.strip()[:20], body.field.strip()[:20], body.goal.strip()[:20], name)
        uid = uuid.uuid4().hex[:12]
        with closing(db()) as c, c:
            c.execute("INSERT INTO users (id, email, name, verified, role, workspace, phone, created_at, last_login) VALUES (?, ?, ?, 1, 'customer', ?, ?, ?, ?)",
                      (uid, phone[1:] + PHONE_MAIL, name, wid, phone, time.time(), time.time()))
        u = user_by("id", uid)
    else:
        with closing(db()) as c, c:
            c.execute("UPDATE users SET verified=1, last_login=? WHERE id=?", (time.time(), u["id"]))
    return with_session(JSONResponse({"ok": True, "new": new}), u, request)


@app.get("/api/platform/sms")
def sms_status(request: Request):
    """رصيد خدمة رسائل الدخول (للأدمن)."""
    admin(request)
    return {**phoneauth.balance(), "enabled": phoneauth.enabled(), "dev": phoneauth.dev()}


@app.post("/api/auth/logout")
def logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(COOKIE)
    return resp


@app.post("/api/auth/resend")
def resend(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401, "يجب تسجيل الدخول")
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
            raise HTTPException(400, "انتهت صلاحية هذا الرابط أو استُخدم من قبل. سجّل الدخول واطلب رابطًا جديدًا")
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
        sent = mailer.send(u["email"], f"غيّر كلمة المرور · {mailer.BRAND}", f"إذا أنت ما طلبت تغيير كلمة المرور، ادخل على هذا الرابط (صالح ساعة):\n{link}",
                           mailer.button_html("غيّر كلمة المرور", "إذا أنت ما طلبت تغيير كلمة المرور اضغط على الزر. الرابط صالح ساعة. إذا غير أنت، تجاهل هذا البريد الإلكتروني.", link, "أنشئ كلمة مرور جديد"))
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
            raise HTTPException(400, "انتهت صلاحية هذا الرابط أو استُخدم من قبل. اطلب رابطًا جديدًا")
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
        raise HTTPException(401, "يجب تسجيل الدخول")
    if u["pw"] and not pw_ok(body.current, u["pw"]):
        raise HTTPException(400, "كلمة المرور الحالية غير صحيحة")
    check_pw(body.new)
    with closing(db()) as c, c:
        c.execute("UPDATE users SET pw=? WHERE id=?", (pw_hash(body.new), u["id"]))
    return with_session(JSONResponse({"ok": True}), user_by("id", u["id"]), request)


# ---------------------------------------------------------------- الدخول بجوجل

def g_state_make(app: str = "") -> str:
    """حالة موقّعة (بدل كوكي بس): متصفحات التطبيقات على الموبايل (واتساب، جيميل، إنستجرام…) ساعات بتفتح جوجل في نافذة تانية
    وبترجع من غير الكوكي، فالدخول كان بيفشل. التوقيع بالسر بيمنع أي حد يزوّرها، وصالحة ١٠ دقايق بس."""
    # 📱 من تطبيق الجوال: بصمة سر التطبيق (PKCE) بتتشال جوه الحالة الموقّعة، عشان الكود يرجع للتطبيق ده بس
    raw = f"{int(time.time())}.{secrets.token_urlsafe(12)}{'~' + app if app else ''}"
    return raw + "." + hmac.new(SECRET, raw.encode(), hashlib.sha256).hexdigest()[:32]


def g_state_ok(state: str) -> bool:
    try:
        ts, nonce, sig = state.split(".")
        good = hmac.new(SECRET, f"{ts}.{nonce}".encode(), hashlib.sha256).hexdigest()[:32]
        return hmac.compare_digest(sig, good) and 0 <= time.time() - int(ts) < 600
    except (ValueError, AttributeError):
        return False


def g_state_app(state: str) -> str:
    try:
        return state.split(".")[1].split("~", 1)[1]
    except (IndexError, AttributeError):
        return ""


APP_RETURN = "simsimkit://auth"


def google_fail(why: str, raw: str = "", app: bool = False) -> RedirectResponse:
    """الدخول بجوجل فشل: السبب الحقيقي بيتسجل في صندوق الأخطاء، والعميل بيشوف رسالة بتقوله يعمل إيه."""
    issues.record("api", "GET /auth/google/callback", f"الدخول بجوجل فشل: {why}", raw[:2000], 400)
    return RedirectResponse(f"{APP_RETURN}?err={why}" if app else f"/login?err=google&why={why}")


@app.get("/auth/google")
def google_start(request: Request, app: str = ""):
    cid = os.environ.get("GOOGLE_CLIENT_ID")
    if not cid:
        raise HTTPException(404, "الدخول بجوجل غير مفعّل")
    if app and not appauth.CHALLENGE_RE.match(app):
        raise HTTPException(400, "طلب الدخول من التطبيق غير صحيح")
    state = g_state_make(app)
    q = urlencode({"client_id": cid, "redirect_uri": f"{base_url(request)}/auth/google/callback", "response_type": "code",
                   "scope": "openid email profile", "state": state, "prompt": "select_account"})
    resp = RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{q}")
    resp.set_cookie("g_state", state, max_age=600, httponly=True, samesite="lax", secure=base_url(request).startswith("https"))
    return resp


@app.get("/auth/google/callback")
def google_back(request: Request, code: str = "", state: str = "", error: str = ""):
    if error:   # العميل لغى، أو جوجل رفض (مثلًا التطبيق لسه في وضع الاختبار والإيميل مش متضاف)
        return google_fail("cancel" if error == "access_denied" else "denied", f"error={error}", bool(g_state_ok(state) and g_state_app(state)))
    if not state or not (hmac.compare_digest(state, request.cookies.get("g_state") or "") or g_state_ok(state)):
        return google_fail("state", f"cookie={'yes' if request.cookies.get('g_state') else 'no'} ua={request.headers.get('user-agent', '')[:200]}")
    app = bool(g_state_app(state))
    # 🔑 السر ممكن يكون في متغيرات الاستضافة وفي صفحة الإعدادات بقيمتين مختلفتين (الاستضافة ليها الأولوية في sync_owner_keys)،
    # فلو جوجل رفض واحد بنجرّب التاني. والتشخيص بيكتب مصدر كل سر وآخر ٤ حروف منه بس، عشان تتقارن بصفحة جوجل
    cid, ok_keys = os.environ["GOOGLE_CLIENT_ID"], owner_keys()
    tries = [("hosting" if "GOOGLE_CLIENT_SECRET" in ENV0 else "settings", os.environ.get("GOOGLE_CLIENT_SECRET", ""))]
    if ok_keys.get("GOOGLE_CLIENT_SECRET") and ok_keys["GOOGLE_CLIENT_SECRET"] != tries[0][1]:
        tries.append(("settings", ok_keys["GOOGLE_CLIENT_SECRET"]))
    try:
        notes = []
        for src, sec in tries:
            r = httpx.post("https://oauth2.googleapis.com/token", timeout=20, data={
                "code": code, "client_id": cid, "client_secret": sec,
                "redirect_uri": f"{base_url(request)}/auth/google/callback", "grant_type": "authorization_code"})
            body = r.json()
            notes.append(f"{src} secret …{sec[-4:] if len(sec) > 8 else '?'}: {r.status_code} {body.get('error', 'ok')}")
            if "id_token" in body or body.get("error") != "invalid_client":
                break
        if "id_token" not in body:   # غالبًا: السر غلط (invalid_client) أو الرابط مختلف (redirect_uri_mismatch)
            idnote = f"client_id …{cid[-30:]}" + (" (صفحة الإعدادات فيها client_id مختلف)" if ok_keys.get("GOOGLE_CLIENT_ID") not in (None, "", cid) else "")
            return google_fail("token", f"{r.status_code} {json.dumps(body)[:600]} redirect_uri={base_url(request)}/auth/google/callback | {idnote} | {' ; '.join(notes)}", app)
        if src != tries[0][0]:   # السر اللي في الإعدادات هو الصح: يبقى هو المستخدم من دلوقتي
            os.environ["GOOGLE_CLIENT_SECRET"] = sec
        seg = body["id_token"].split(".")[1]
        info = json.loads(base64.urlsafe_b64decode(seg + "=" * (-len(seg) % 4)))
    except (httpx.HTTPError, KeyError, ValueError, IndexError) as exc:
        return google_fail("token", f"{type(exc).__name__}: {exc}", app)
    if info.get("aud") != cid or not info.get("email_verified") or not info.get("email"):
        return google_fail("email", f"aud_ok={info.get('aud') == cid} verified={info.get('email_verified')}", app)
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
    if app:   # 📱 للتطبيق: كود مرة واحدة (دقيقتين) والتطبيق بيبدّله بجلسة بالسر بتاعه
        code = secrets.token_urlsafe(24)
        with closing(db()) as c, c:
            c.execute("DELETE FROM tokens WHERE kind LIKE 'app:%' AND expires < ?", (time.time(),))
            c.execute("INSERT INTO tokens (token, user_id, kind, expires) VALUES (?, ?, ?, ?)", (code, u["id"], "app:" + g_state_app(state), time.time() + 120))
        resp = RedirectResponse(f"{APP_RETURN}?code={code}")
    else:
        resp = with_session(RedirectResponse("/"), u, request)
    resp.delete_cookie("g_state")
    return resp


class AppExchangeIn(BaseModel):
    code: str
    verifier: str


@app.post("/api/auth/app-exchange")
def app_exchange(body: AppExchangeIn, request: Request):
    """📱 التطبيق بيبدّل كود جوجل بجلسة: لازم السر اللي بصمته اتبعتت في الأول."""
    throttle(client_ip(request))
    with closing(db()) as c, c:
        r = c.execute("SELECT * FROM tokens WHERE token=? AND kind LIKE 'app:%'", (body.code,)).fetchone()
        if r:
            c.execute("DELETE FROM tokens WHERE token=?", (body.code,))
    if not r or r["expires"] < time.time() or not hmac.compare_digest(r["kind"][4:], appauth.challenge_of(body.verifier)):
        failed(client_ip(request))
        raise HTTPException(400, "انتهت مهلة الدخول. حاول مرة أخرى")
    u = user_by("id", r["user_id"])
    return with_session(JSONResponse({"ok": True, "token": make_session(u)}), u, request)


class AppleIn(BaseModel):
    identity_token: str
    name: str = ""


@app.post("/api/auth/apple")
def apple_login(body: AppleIn, request: Request):
    """🍎 الدخول بـ Apple من تطبيق الآيفون: بنتأكد من توقيع Apple، وبنلاقي الحساب أو نعمل واحد جديد."""
    throttle(client_ip(request))
    if needs_owner_setup():
        raise HTTPException(400, "البرنامج قيد التجهيز")
    try:
        info = appauth.apple_verify(body.identity_token, appauth.apple_audiences())
    except appauth.AuthError as exc:
        failed(client_ip(request))
        issues.record("api", "POST /api/auth/apple", f"الدخول بـ Apple فشل: {exc}", "", 400)
        raise HTTPException(400, str(exc)) from exc
    sub, email = info["sub"], info["email"] if info["email_verified"] else ""
    u = user_by("apple_sub", sub) or (user_by("email", email) if email else None)
    new = not u
    if new:
        name = body.name.strip()[:80]
        wid = new_workspace(name or (email.split("@")[0] if email else "Apple"))
        save_onboard(wid, "SA", "", "", "", name)
        uid = uuid.uuid4().hex[:12]
        with closing(db()) as c, c:
            c.execute("INSERT INTO users (id, email, name, verified, role, workspace, apple_sub, created_at, last_login) VALUES (?, ?, ?, 1, 'customer', ?, ?, ?, ?)",
                      (uid, email or f"{sub[:40]}@apple.simsimkit", name, wid, sub, time.time(), time.time()))
        u = user_by("id", uid)
    else:
        with closing(db()) as c, c:
            # نفس قاعدة جوجل: أول ربط بإيميل اتأكد منه، أي باسورد اتعمل قبل كده (ممكن من حد تاني) بيتشال
            if not u["apple_sub"] and not u["google_sub"] and u["role"] != "admin":
                c.execute("UPDATE users SET pw=NULL WHERE id=?", (u["id"],))
            c.execute("UPDATE users SET apple_sub=?, verified=1, last_login=? WHERE id=?", (sub, time.time(), u["id"]))
        u = user_by("id", u["id"])
    return with_session(JSONResponse({"ok": True, "new": new, "token": make_session(u)}), u, request)



# ---------------------------------------------------------------- 💳 الاشتراكات والنقط (PayPal)

def plan_of(key: str) -> dict | None:
    return next((p for p in billing.config(DATA_DIR)["plans"] if p["key"] == key and not p.get("once")), None)


def ledger_add(c: sqlite3.Connection, wid: str, delta: int, kind: str, note: str, ref: str = "") -> None:
    c.execute("INSERT INTO ledger (id, workspace, delta, kind, note, ref, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
              (uuid.uuid4().hex, wid, delta, kind, note, ref, time.time()))


def paid_once(c: sqlite3.Connection, ref: str, wid: str, provider: str, kind: str, amount: float, note: str) -> bool:
    """True أول مرة فقط (كل دفعة تتسجل مرة واحدة حتى إذا الإشعار وصل مرتين)."""
    try:
        c.execute("INSERT INTO payments (ref, workspace, provider, kind, amount, note, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  (ref, wid, provider, kind, amount, note, time.time()))
        # 🎟️ خصم «للدفعة الجاية بس» بيتشال أول ما يدفع (الاشتراك نفسه خلاص دورته الأولى بالخصم والباقي بالسعر العادي)
        c.execute("UPDATE workspaces SET discount_pct=NULL, discount_code=NULL, discount_once=NULL WHERE id=? AND discount_once=1", (wid,))
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
            if old[0] == "paypal":
                payments.paypal_cancel(old[1])
        except payments.PayError:
            pass


def renew(wid: str, ref: str, amount: float) -> None:
    """تجديد شهري: نقاط الباقة تعود لعددها (بدون ترحيل)."""
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
    """متى نقاط الباقة ستعود مرة أخرى (تقريبًا شهر من آخر مرة)."""
    if not w or w["plan"] in ("none", "trial") or not w["refill_at"]:
        return None
    return w["refill_at"] + MONTH


def yearly_refill() -> None:
    """الاشتراك السنوي يتدفع مرة في السنة، فقط نقاط الباقة تعود لعددها كل شهر (بدون ترحيل)."""
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
            ledger_add(c, r["id"], p["credits"], "renewal", f"نقاط الشهر · باقة {p['name']} السنوية")


def end_subscription(wid: str, at: float | None = None) -> None:
    """الاشتراك أُلغي: يظل يعمل لآخر الفترة المدفوعة، وبعدها نقاط الباقة والحسابات والأوتوبايلوت يروحون (النقاط الزيادة تظل)."""
    with closing(db()) as c, c:
        if at and at > time.time():
            c.execute("UPDATE workspaces SET ends_at=? WHERE id=?", (at, wid))
            return
        c.execute("UPDATE workspaces SET plan='none', extra_accounts=0, autopilot=0, sub_id=NULL, ends_at=NULL WHERE id=?", (wid,))
        c.execute("UPDATE wallet SET plan_credits=0, updated_at=? WHERE workspace=?", (time.time(), wid))
        ledger_add(c, wid, 0, "cancel", "الاشتراك خلص")


def topup_bonus(c, wid: str, cfg: dict) -> int:
    """باقة «وكالات» النقاط الزيادة لها بالضعف (topup_bonus في الباقة)."""
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
        ledger_add(c, wid, n, "topup", f"نقاط زيادة {n}", ref)
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
        raise HTTPException(401, "يجب تسجيل الدخول")
    if u["workspace"] == OWNER:
        raise HTTPException(400, "حساب مالك البرنامج لا يحتاج إلى اشتراك")
    return u


@app.get("/billing")
def billing_page(request: Request, ok: str = "", err: str = ""):
    """الصفحة القديمة أُزيلت: «باقتي ونقاطي» بقت داخل البرنامج (أيقونة البطاقة في الشريط الذي أعلى)."""
    if not current_user(request):
        return RedirectResponse("/login?next=/billing")
    q = "&ok=" + ok if ok in ("plan", "topup") else "&err=paypal" if err == "paypal" else ""
    return RedirectResponse("/?plans=1" + q)


@app.get("/api/billing")
def billing_state(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401, "يجب تسجيل الدخول")
    w = workspace(u["workspace"])
    with closing(db()) as c:
        hist = [dict(r) for r in c.execute("SELECT delta, kind, note, at FROM ledger WHERE workspace=? ORDER BY at DESC LIMIT 30",
                                          (u["workspace"],))]
    cfg = billing.config(DATA_DIR)
    return {"me": me_dict(u), "owner": u["workspace"] == OWNER, "plan": w["plan"] if w else "owner",
            "extra_accounts": (w["extra_accounts"] if w else 0), "autopilot": bool(w and w["autopilot"]),
            "cycle": (w["cycle"] if w and w["cycle"] else "month"), "renews_at": renews_at(w),
            "provider": w["provider"] if w else None, "ends_at": w["ends_at"] if w else None,
            "paypal": payments.paypal_on(),
            "plans": cfg["plans"], "addons": cfg["addons"], "topups": cfg["topups"], "rules": cfg["rules"], "history": hist,
            "discount": {"pct": w["discount_pct"] or 0, "code": w["discount_code"] or "", "once": bool(w["discount_once"])} if w and w["discount_pct"] else None}


@app.get("/api/billing/usage")
def billing_usage(request: Request, days: int = 30):
    """📊 استهلاك العميل: صرف كام نقطة في الفترة، وفي أنهي أقسام (من سجل النقاط)."""
    u = customer_user(request)
    since = time.time() - max(1, min(days, 365)) * 86400
    with closing(db()) as c:
        moves = c.execute("SELECT delta, note FROM ledger WHERE workspace=? AND kind='use' AND at>=?", (u["workspace"], since)).fetchall()
        b = c.execute("SELECT plan_credits + topup_credits AS n FROM wallet WHERE workspace=?", (u["workspace"],)).fetchone()
    cats: dict[str, int] = {}
    for m in moves:
        cats[_cat(m["note"])] = cats.get(_cat(m["note"]), 0) - m["delta"]
    return {"days": days, "used": sum(cats.values()), "balance": b["n"] if b else 0, "times": len(moves),
            "by_cat": [{"cat": k, "points": v} for k, v in sorted(cats.items(), key=lambda x: -x[1])]}


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
    cfg = billing.config(DATA_DIR)
    # 🎟️ خصم الكوبون (٪) على الاشتراك والشحن
    w = workspace(wid)
    pct = int(w["discount_pct"] or 0) if w else 0
    once = bool(w and w["discount_once"])   # «للدفعة الجاية بس»: الاشتراك أول دورة بس بالخصم، والخصم بيتشال بعد أول دفعة
    off = lambda v: round(v * (100 - pct) / 100, 2) if pct else v  # noqa: E731
    try:
        if body.kind == "topup":
            t = next((x for x in cfg["topups"] if x["key"] == body.topup), None)
            if not t:
                raise HTTPException(400, "باقة النقاط هذه غير موجودة")
            name = f"SimsimKit · {t['credits']:,} نقطة"
            if body.provider == "paypal":
                url = payments.paypal_order(off(t["price"]), f"{wid}|topup|{t['key']}", name,
                                            ret=f"{back}/api/billing/paypal/order", cancel=f"{back}/billing")
            else:
                raise HTTPException(400, "طريقة دفع غير معروفة")
            return {"url": url}
        try:
            tot = billing.custom_total(cfg, body.plan, body.accounts, body.autopilot)
        except ValueError as e:
            raise HTTPException(400, str(e))
        full = tot["total"]
        tot = {**tot, "total": full if once else off(full)}
        first = off(full) if once and pct else None
        p = plan_of(body.plan)
        extra = tot["accounts"] - p["accounts"]
        ap_paid = tot["autopilot"] and not p.get("autopilot")
        yr = body.cycle == "year"
        px = (lambda v: billing.yearly(cfg, v)) if yr else (lambda v: v)
        if body.provider == "paypal":
            key = f"{p['key']}:{extra}:{int(ap_paid)}:{tot['total']}{':y' if yr else ''}{f':first{first}' if first else ''}"
            pid = payments.paypal_plan((kv_get, kv_set), key, f"SimsimKit {p['name_en']} +{extra} accounts{' +autopilot' if ap_paid else ''}{' yearly' if yr else ''}",
                                       px(tot["total"]), "YEAR" if yr else "MONTH", first=px(first) if first else None)
            url = payments.paypal_subscribe(pid, f"{wid}|{p['key']}|{extra}|{int(ap_paid)}{'|y' if yr else ''}", real_email(u),
                                            ret=f"{back}/api/billing/paypal/sub", cancel=f"{back}/billing")
        else:
            raise HTTPException(400, "طريقة دفع غير معروفة")
        return {"url": url}
    except payments.PayError as e:
        raise HTTPException(502, str(e))


class DeleteMeIn(BaseModel):
    confirm: str = ""


@app.post("/api/me/delete")
def delete_me(body: DeleteMeIn, request: Request):
    """🗑️ حذف الحساب نهائيًا (من التطبيق أو الموقع): الاشتراك بيتلغي، وكل ملفات المساحة بتتمسح.
    سجل المدفوعات بيفضل (للحسابات والضرايب) من غير بيانات العميل."""
    u = current_user(request)
    if not u:
        raise HTTPException(401, "يجب تسجيل الدخول")
    if u["role"] == "admin" or u["workspace"] == OWNER:
        raise HTTPException(400, "لا يمكن حذف حساب المشرف من هنا")
    if body.confirm != "DELETE":
        raise HTTPException(400, "أكّد الحذف أولًا")
    wid, w = u["workspace"], workspace(u["workspace"])
    if w and w["sub_id"] and w["provider"] == "paypal":
        try:
            payments.paypal_cancel(w["sub_id"])
        except payments.PayError as exc:
            issues.record("api", "POST /api/me/delete", "تعذّر إلغاء اشتراك PayPal أثناء حذف حساب", f"{wid}: {exc}", 502)
    with closing(db()) as c, c:
        c.execute("DELETE FROM tokens WHERE user_id=?", (u["id"],))
        c.execute("DELETE FROM users WHERE id=?", (u["id"],))
        last = not c.execute("SELECT 1 FROM users WHERE workspace=?", (wid,)).fetchone()
        if last:
            c.execute("DELETE FROM wallet WHERE workspace=?", (wid,))
            c.execute("DELETE FROM workspaces WHERE id=?", (wid,))
    if last:
        t = _tenants.pop(wid, None)
        if t:
            t.proc.terminate()
            try:
                t.proc.wait(10)
            except subprocess.TimeoutExpired:
                t.proc.kill()
        d = workspace_dir(wid)
        if d != DATA_DIR and d.parent == TENANTS:
            shutil.rmtree(d, ignore_errors=True)
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(COOKIE)
    return resp


@app.post("/api/billing/cancel")
def cancel_sub(request: Request):
    """إلغاء اشتراك PayPal من داخل البرنامج."""
    u = customer_user(request)
    w = workspace(u["workspace"])
    if not w or not w["sub_id"]:
        raise HTTPException(400, "لا يوجد اشتراك فعّال")
    try:
        if w["provider"] == "paypal":
            nxt = payments.paypal_sub(w["sub_id"]).get("next")
            payments.paypal_cancel(w["sub_id"])
            end_subscription(u["workspace"], _iso(nxt))
        else:
            raise HTTPException(400, "لا يوجد اشتراك PayPal فعّال")
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
        raise HTTPException(403, "للمشرف فقط")
    return u


@app.get("/auth/drive")
def drive_start(request: Request):
    """ربط جوجل درايف للنسخة الاحتياطية (الأدمن فقط)."""
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
    # عنوان الرجوع اللي لازم يكون متسجل في Google Cloud (وإلا جوجل بيرفض بـ redirect_uri_mismatch)
    return {**backup_state(), "redirect": f"{base_url(request)}/auth/drive/callback"}


# 🧹 المساحة على الخادم: مين واخد كام (كل حساب وكل قسم)، وأكبر الملفات، والحاجات اللي ينفع تتمسح من غير ما حاجة تبوظ
def _du(path: Path, big: list | None = None, rel: Path | None = None) -> tuple[int, int]:
    """حجم فولدر بالبايت وعدد ملفاته، ويجمّع أكبر الملفات في big."""
    total = n = 0
    for dp, dirs, files in os.walk(path):
        for f in files:
            fp = os.path.join(dp, f)
            try:
                sz = os.lstat(fp).st_size
            except OSError:
                continue
            total += sz
            n += 1
            if big is not None and sz > 50 * 2**20:
                big.append((sz, str(Path(fp).relative_to(rel or path))))
    return total, n


def _tmp_dirs(root: Path) -> list[Path]:
    """الملفات المؤقتة لحساب: فولدر tmp (إلا ملفات الخطوط واللوج) وبقايا التصدير."""
    t = root / "tmp"
    return [x for x in (t.iterdir() if t.is_dir() else []) if x.name not in ("fonts.conf", "fontcache", "render.log")]


@app.get("/api/platform/storage")
def admin_storage(request: Request):
    admin(request)
    import tempfile  # noqa: PLC0415
    usage = shutil.disk_usage(DATA_DIR)
    big: list = []
    with closing(db()) as c:
        names = {r["id"]: r["name"] for r in c.execute("SELECT id, name FROM workspaces")}
        mails = {r["workspace"]: r["email"] for r in c.execute("SELECT workspace, MIN(email) AS email FROM users GROUP BY workspace")}
    accounts, cats, orphans = [], {}, []
    roots = [(OWNER, DATA_DIR)] + [(p.name, p) for p in sorted(TENANTS.iterdir()) if p.is_dir() and not p.name.startswith((".",))]
    for wid, root in roots:
        size = files = tmp = 0
        for sub in root.iterdir() if root.is_dir() else []:
            if root == DATA_DIR and sub.name in ("_platform", "_shared"):
                continue
            if sub.is_dir():
                b, n = _du(sub, big, DATA_DIR)
            else:
                try:
                    b, n = sub.stat().st_size, 1
                except OSError:
                    continue
                if b > 50 * 2**20:
                    big.append((b, str(sub.relative_to(DATA_DIR))))
            size += b
            files += n
            if sub.is_dir():
                cats[sub.name] = cats.get(sub.name, 0) + b
        for x in _tmp_dirs(root):
            tmp += _du(x)[0] if x.is_dir() else x.stat().st_size
        known = wid == OWNER or wid in names
        row = {"id": wid, "name": "حساب المنصة" if wid == OWNER else names.get(wid) or "", "email": mails.get(wid) or "", "mb": round(size / 2**20, 1),
               "files": files, "tmp_mb": round(tmp / 2**20, 1), "orphan": not known}
        (accounts if known else orphans).append(row)
    shared = {k: round(_du(DATA_DIR / k, big, DATA_DIR)[0] / 2**20, 1) for k in ("_shared",) if (DATA_DIR / k).exists()}
    plat = PLATFORM
    plat_b = sum(_du(x, big, DATA_DIR)[0] if x.is_dir() else x.stat().st_size for x in plat.iterdir() if x != TENANTS)
    sys_tmp = Path(tempfile.gettempdir())
    sys_b = _du(sys_tmp)[0] if sys_tmp.exists() else 0
    big.sort(reverse=True)
    return {"total_mb": usage.total // 2**20, "used_mb": (usage.total - usage.free) // 2**20, "free_mb": usage.free // 2**20,
            "accounts": sorted(accounts, key=lambda r: -r["mb"]), "orphans": sorted(orphans, key=lambda r: -r["mb"]),
            "cats": sorted(({"cat": k, "mb": round(v / 2**20, 1)} for k, v in cats.items()), key=lambda r: -r["mb"])[:25],
            "platform_mb": round(plat_b / 2**20, 1), "shared_mb": shared.get("_shared", 0), "system_tmp_mb": round(sys_b / 2**20, 1),
            "tmp_mb": round(sum(r["tmp_mb"] for r in accounts), 1),
            "big": [{"mb": round(b / 2**20, 1), "path": p} for b, p in big[:30]]}


class StorageCleanIn(BaseModel):
    tmp: bool = True          # الملفات المؤقتة في كل الحسابات (بتتعمل تاني لوحدها)
    orphans: bool = False     # فولدرات حسابات اتمسحت (مالهاش حساب في المنصة)


@app.post("/api/platform/storage/clean")
def admin_storage_clean(body: StorageCleanIn, request: Request):
    admin(request)
    import tempfile  # noqa: PLC0415
    before = shutil.disk_usage(DATA_DIR).free
    with closing(db()) as c:
        known = {r["id"] for r in c.execute("SELECT id FROM workspaces")}
    busy = {w for w, t in _tenants.items() if t.proc.poll() is None}
    gone = 0
    if body.tmp:
        for root in [DATA_DIR] + [p for p in TENANTS.iterdir() if p.is_dir()]:
            for x in _tmp_dirs(root):
                if x.name.startswith("render-") and root.name in busy and time.time() - x.stat().st_mtime < 6 * 3600:
                    continue   # تصدير ممكن يكون شغال دلوقتي في الحساب ده
                shutil.rmtree(x, ignore_errors=True) if x.is_dir() else x.unlink(missing_ok=True)
                gone += 1
        for x in Path(tempfile.gettempdir()).glob("studiomania-render/render-*"):
            if time.time() - x.stat().st_mtime > 6 * 3600:
                shutil.rmtree(x, ignore_errors=True)
                gone += 1
    if body.orphans:
        for p in TENANTS.iterdir():
            if p.is_dir() and p.name not in known and p.name not in _tenants and not p.name.startswith(("_", ".")):
                shutil.rmtree(p, ignore_errors=True)
                gone += 1
    return {"deleted": gone, "freed_mb": round(max(0, shutil.disk_usage(DATA_DIR).free - before) / 2**20, 1)}


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
        rows = c.execute("""SELECT CASE WHEN u.email LIKE '%@phone.simsimkit' THEN u.phone ELSE u.email END AS email, u.name, u.verified, u.role, u.workspace, u.created_at, u.last_login, w.plan,
                            COALESCE(x.plan_credits, 0) + COALESCE(x.topup_credits, 0) AS credits
                            FROM users u LEFT JOIN workspaces w ON w.id = u.workspace LEFT JOIN wallet x ON x.workspace = u.workspace
                            ORDER BY u.created_at DESC""").fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------- 👥 العملاء واستهلاكهم (للأدمن)
# كل عميل: سجّل إمتى، باقته (تجربة مجانية ولا مشترك)، نقاطه اللي صرفها، وتكلفتها الحقيقية علينا بالدولار
# (النقطة = سنت على العميل، والسعر = التكلفة × ٣، فالتكلفة = النقاط ÷ ٣٠٠ دولار)، واللي دفعه، وصرف نقاطه في إيه.
COST_PER_POINT = billing.CREDIT_USD / billing.MARKUP


def _cat(note: str) -> str:
    """«المنافسين: اقتراح منافسين» ← «المنافسين»: الجزء قبل النقطتين هو القسم."""
    t = re.sub(r"\s*\([^)]*\)|\s*@\S+", "", str(note or "").removeprefix("ترويج: "))   # «(٤ دقايق)» و«@حساب» مش جزء من اسم القسم
    return (t.split(":")[0].split("·")[0].strip() or "أخرى")[:40]


@app.get("/api/platform/customers")
def admin_customers(request: Request, days: int = 30):
    admin(request)
    since = time.time() - max(1, min(days, 3650)) * 86400
    with closing(db()) as c:
        rows = [dict(r) for r in c.execute("""SELECT w.id AS workspace, w.name AS brand, w.plan, w.created_at, w.discount_pct, w.discount_code,
            (SELECT CASE WHEN u.email LIKE '%@phone.simsimkit' THEN u.phone ELSE u.email END FROM users u WHERE u.workspace = w.id ORDER BY u.created_at LIMIT 1) AS email,
            (SELECT u.name FROM users u WHERE u.workspace = w.id ORDER BY u.created_at LIMIT 1) AS name,
            (SELECT MAX(u.last_login) FROM users u WHERE u.workspace = w.id) AS last_login,
            COALESCE(x.plan_credits, 0) + COALESCE(x.topup_credits, 0) AS balance
            FROM workspaces w LEFT JOIN wallet x ON x.workspace = w.id WHERE w.id != ? ORDER BY w.created_at DESC""", (OWNER,))]
        use = {r["workspace"]: dict(r) for r in c.execute("""SELECT workspace, -SUM(CASE WHEN at >= ? THEN delta ELSE 0 END) AS used_period,
            -SUM(delta) AS used_all FROM ledger WHERE kind = 'use' GROUP BY workspace""", (since,))}
        gifts = {r["workspace"]: r["n"] for r in c.execute("SELECT workspace, SUM(delta) AS n FROM ledger WHERE kind IN ('gift', 'coupon') GROUP BY workspace")}
        # 💸 من عدّاد الصرف: الفترة، وكل الوقت، ومنها وهو تجربة مجانية، ومنها ترويج (مكالمة سعاد وأول تحليل…)
        spend = {r["workspace"]: dict(r) for r in c.execute("""SELECT workspace, SUM(CASE WHEN at >= ? THEN usd ELSE 0 END) AS period, SUM(usd) AS total,
            SUM(CASE WHEN plan = 'trial' THEN usd ELSE 0 END) AS trial, SUM(CASE WHEN promo = 1 THEN usd ELSE 0 END) AS promo
            FROM costs GROUP BY workspace""", (since,))}
        paid = {r["workspace"]: r["n"] for r in c.execute("SELECT workspace, SUM(amount) AS n FROM payments GROUP BY workspace")}
    tot = {"customers": len(rows), "paying": 0, "used_period": 0, "cost_period": 0.0, "cost_free": 0.0, "revenue": 0.0}
    for r in rows:
        u = use.get(r["workspace"]) or {}
        r["used_period"], r["used_all"] = int(u.get("used_period") or 0), int(u.get("used_all") or 0)
        sp = spend.get(r["workspace"]) or {}
        r["cost_period"], r["cost_all"] = round(sp.get("period") or 0, 2), round(sp.get("total") or 0, 2)
        r["cost_trial"], r["cost_promo"] = round(sp.get("trial") or 0, 2), round(sp.get("promo") or 0, 2)
        r["gifted"], r["paid"] = int(gifts.get(r["workspace"]) or 0), round(float(paid.get(r["workspace"]) or 0), 2)
        r["paying"] = r["plan"] not in ("trial", None, "") and r["paid"] > 0
        r["margin"] = round(r["paid"] - r["cost_all"], 2)   # اللي دفعه ناقص كل اللي صرفناه عليه (من أول يوم، حتى وهو مجاني)
        r["losing"] = r["paying"] and r["margin"] < 0
        tot["paying"] += r["paying"]
        tot["used_period"] += r["used_period"]
        tot["cost_period"] += r["cost_period"]
        tot["cost_free"] += 0 if r["paying"] else r["cost_period"]
        tot["revenue"] += r["paid"]
    tot = {k: round(v, 2) if isinstance(v, float) else v for k, v in tot.items()}
    return {"items": rows, "total": tot, "days": days}


@app.get("/api/platform/customers/{wid}")
def admin_customer(wid: str, request: Request, days: int = 30):
    """تفاصيل عميل: صرف نقاطه في أنهي قسم (والتكلفة علينا)، وآخر حركات نقاطه."""
    admin(request)
    if not workspace(wid):
        raise HTTPException(404, "هذا العميل غير موجود")
    since = time.time() - max(1, min(days, 3650)) * 86400
    with closing(db()) as c:
        moves = [dict(r) for r in c.execute("SELECT delta, kind, note, at FROM ledger WHERE workspace=? ORDER BY at DESC LIMIT 300", (wid,))]
        pays = [dict(r) for r in c.execute("SELECT provider, kind, amount, note, at FROM payments WHERE workspace=? ORDER BY at DESC LIMIT 50", (wid,))]
    cats: dict[str, dict] = {}
    for m in moves:
        if m["kind"] == "use" and m["at"] >= since:
            x = cats.setdefault(_cat(m["note"]), {"cat": _cat(m["note"]), "points": 0, "times": 0})
            x["points"] -= m["delta"]
            x["times"] += 1
    by = sorted(cats.values(), key=lambda x: -x["points"])
    for x in by:
        x["cost"] = round(x["points"] * COST_PER_POINT, 2)
    with closing(db()) as c:
        spend = [dict(r) for r in c.execute("SELECT usd, what, promo, plan, at FROM costs WHERE workspace=? ORDER BY at DESC LIMIT 300", (wid,))]
    sc: dict[str, dict] = {}
    for x in spend:
        y = sc.setdefault(_cat(x["what"]), {"cat": _cat(x["what"]), "usd": 0.0, "trial": 0.0, "promo": 0.0})
        y["usd"] += x["usd"]
        y["trial"] += x["usd"] if x["plan"] == "trial" else 0
        y["promo"] += x["usd"] if x["promo"] else 0
    spend_cat = sorted(({k: round(v, 3) if isinstance(v, float) else v for k, v in y.items()} for y in sc.values()), key=lambda y: -y["usd"])
    return {"by_cat": by, "moves": moves[:120], "payments": pays, "spend": spend[:120], "spend_cat": spend_cat}


def fixed_bills(refill: bool = False) -> float:
    """متوسط ما ندفعه شهريًا من قسم «💼 الحسابات»: الاشتراكات (الشهري + السنوي ÷ ١٢)، أو (refill=True) متوسط الشحن مرة واحدة.
    الشحن مالوش مكان في «الفواتير الثابتة» عشان استهلاكه محسوب أصلًا في إنفاق الخدمات (وإلا يتحسب مرتين)."""
    try:
        rows = json.loads((DATA_DIR / "expenses.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return 0.0
    tot = 0.0
    for r in rows:
        cyc = r.get("eff") or r.get("cycle")
        if (cyc == "usage") != refill or cyc == "free":
            continue
        tot += float(r["monthly"]) if "monthly" in r else float(r.get("amount") or 0) / (12 if cyc == "yearly" else 1)
    return round(tot, 2)


@app.get("/api/platform/costs")
def admin_costs(request: Request, month: str = ""):
    """💸 عدّاد صرف الشهر: صرفنا كام، على مين (مشتركين، تجربة مجانية، ترويج، حسابنا إحنا)، وفي أنهي أقسام.
    واقتصاد كل باقة: متوسط اللي بنصرفه على المشترك فيها في الشهر قصاد سعرها، وأقصى خصم يفضل معاه مكسب."""
    admin(request)
    import datetime as dt  # noqa: PLC0415
    now = dt.datetime.now()
    try:
        y, m = (int(x) for x in (month or f"{now.year}-{now.month}").split("-"))
        start = dt.datetime(y, m, 1)
    except ValueError:
        raise HTTPException(400, "اكتب الشهر بالشكل 2026-10") from None
    end = dt.datetime(y + (m == 12), m % 12 + 1, 1)
    t0, t1 = start.timestamp(), end.timestamp()
    with closing(db()) as c:
        rows = c.execute("SELECT workspace, usd, what, promo, plan, at FROM costs WHERE at >= ? AND at < ?", (t0, t1)).fetchall()
        rev = c.execute("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE at >= ? AND at < ?", (t0, t1)).fetchone()[0]
        plans_now = {r["id"]: r["plan"] for r in c.execute("SELECT id, plan FROM workspaces")}
        recent = c.execute("SELECT workspace, SUM(usd) AS usd FROM costs WHERE at >= ? AND promo = 0 AND plan NOT IN ('trial', 'owner') GROUP BY workspace",
                           (time.time() - 30 * 86400,)).fetchall()
    who = {"paying": 0.0, "trial": 0.0, "promo": 0.0, "owner": 0.0}
    cats: dict[str, float] = {}
    for r in rows:
        k = "owner" if r["workspace"] == OWNER else "promo" if r["promo"] else "trial" if r["plan"] == "trial" else "paying"
        who[k] += r["usd"]
        cat = _cat(str(r["what"]))
        cats[cat] = cats.get(cat, 0) + r["usd"]
    usage = sum(who.values())
    bills = fixed_bills()
    refill = fixed_bills(refill=True)
    # اقتصاد الباقات (آخر ٣٠ يوم): متوسط صرف المشترك، وسعر الباقة، والمكسب، وأقصى خصم (بعد عمولة الدفع)
    cfg = billing.config(DATA_DIR)
    eco = []
    for p in cfg["plans"]:
        if not p.get("price"):
            continue
        ws = [r["usd"] for r in recent if plans_now.get(r["workspace"]) == p["key"]]
        subs = sum(1 for v in plans_now.values() if v == p["key"])
        avg = (sum(ws) / max(1, subs)) if subs else None
        fee = billing.fee(p["price"])
        eco.append({"plan": p["key"], "name": p["name"], "price": p["price"], "subs": subs, "avg_cost": round(avg, 2) if avg is not None else None,
                    "margin": round(p["price"] - fee - avg, 2) if avg is not None else None,
                    "max_discount": max(0, int((1 - (avg + fee) / p["price"]) * 100)) if avg is not None else None})
    # 📒 الإنفاق الفعلي من أرصدة المنصات نفسها (فرق الرصيد × سعر الوحدة، ومصاريف OpenAI من المنصة) قصاد تقديرنا
    import providers  # noqa: PLC0415
    pd = providers.load(PLATFORM / "providers.json")
    real = []
    for k, meta in providers.PROVIDERS.items():
        st = providers.month_stats(pd, k, t0, t1)
        if st.get("used_usd") or st.get("topups"):
            real.append({"key": k, "name": meta["name"], "used_usd": st.get("used_usd"), "topups": st.get("topups"), "topup_usd": st.get("topup_usd"),
                         "best": min([x for x in st.get("scenarios") or [] if not x.get("custom")], key=lambda x: x["unit_usd"], default=None),
                         "custom": next((x for x in st.get("scenarios") or [] if x.get("custom")), None)})
    r2 = lambda v: round(v, 2)  # noqa: E731
    return {"real": real, "real_usd": r2(sum(x["used_usd"] or 0 for x in real)), "topup_usd": r2(sum(x["topup_usd"] or 0 for x in real)),
            "month": f"{y}-{m:02d}", "usage": r2(usage), "bills": bills, "refill_avg": refill, "total": r2(usage + bills), "revenue": r2(rev), "net": r2(rev - usage - bills),
            "who": {k: r2(v) for k, v in who.items()}, "by_cat": [{"cat": k, "usd": r2(v)} for k, v in sorted(cats.items(), key=lambda x: -x[1])],
            "plans": eco}


BILL_AR = {"once": "مرة واحدة", "month": "اشتراك شهري", "year": "اشتراك سنوي"}
UNIT_AR = {"pts": "نقاط", "min": "دقائق", "sec": "ثوانٍ", "usd": "دولار", "chars": "حروف", "msg": "رسائل", "req": "طلبات", "tok": "رموز (Tokens)",
           "img": "صور", "vid": "فيديوهات", "acc": "حسابات"}
CU_AR = {"idea": "لم نتواصل بعد", "asked": "تواصلنا وننتظر الرد", "quoted": "وصلنا عرض", "no": "رفض المزود"}


@app.get("/api/platform/finance.xlsx")
def admin_finance_xlsx(request: Request, months: int = 12):
    """📊 تصدير النموذج المالي (Excel): ملخص كل شهر (الإيراد والإنفاق على مين والفواتير والصافي والإنفاق الفعلي من الأرصدة)،
    وباقات كل منصة وسيناريوهاتها (والباقة المخصصة)، واستهلاك المنصات شهر بشهر، وأقسام الإنفاق، والعملاء، واقتصاد الباقات، والفواتير الثابتة."""
    admin(request)
    import datetime as dt  # noqa: PLC0415

    import providers  # noqa: PLC0415
    import xlsx  # noqa: PLC0415
    now = dt.datetime.now()
    ms = []
    y, m = now.year, now.month
    for _ in range(max(1, min(months, 36))):
        ms.append(f"{y}-{m:02d}")
        y, m = (y - 1, 12) if m == 1 else (y, m - 1)
    ms.reverse()
    per = {k: admin_costs(request, k) for k in ms}
    pd = providers.load(PLATFORM / "providers.json")
    summary = [["الشهر", "الإيراد $", "إنفاق الخدمات (تقديرنا) $", "على المشتركين $", "على التجربة المجانية $", "على الترويج $", "على حسابنا $",
                "الفواتير الثابتة $", "إجمالي الإنفاق $", "الصافي $", "الإنفاق الفعلي من أرصدة المنصات $", "شحنات المنصات $"]]
    for k in ms:
        d = per[k]
        w = d["who"]
        summary.append([k, d["revenue"], d["usage"], w["paying"], w["trial"], w["promo"], w["owner"], d["bills"], d["total"], d["net"], d["real_usd"], d["topup_usd"]])
    summary.append(["■ الإجمالي"] + [round(sum(r[i] or 0 for r in summary[1:]), 2) for i in range(1, len(summary[0]))])
    packs = [["المنصة", "الاستخدام", "الباقة", "الدفع", "السعر $", "تعطينا", "الوحدة", "سعر الوحدة $", "التوفير ٪", "نشتريها", "ملاحظة"]]
    scen = [["المنصة", "الباقة", "الدفع", "الاستهلاك الشهري المتوقع", "الوحدة", "عدد الباقات", "ندفع لكل فترة $", "تكلفة السنة $", "بسعر الوحدة شهريًا $",
             "سعر الوحدة $", "التوفير ٪", "نشتريها", "باقة مخصصة", "عرض فعلي من المزود", "ملاحظة"]]
    custom = [["المنصة", "الحالة", "الخصم المتوقع ٪", "سعر العرض $", "يعطينا", "الوحدة", "الدفع", "وسيلة التواصل", "ملاحظة"]]
    bal = [["المنصة", "الاستخدام", "الرصيد الآن", "الوحدة", "حد التنبيه", "الحالة", "سعر الوحدة $", "قيمة الرصيد $"]]
    use = [["الشهر", "المنصة", "الاستهلاك (وحدات)", "الاستهلاك $", "عدد الشحنات", "الشحنات $"]]
    st_ar = {"ok": "سليم", "low": "أوشك على النفاد", "bad": "نفد / توجد مشكلة", "unknown": "—"}
    for row in providers.summary(pd):
        k, nm = row["key"], row["name"]
        for x in row["packs"]:
            packs.append([nm, row["what"], x.get("name") or "", BILL_AR.get(x.get("billing"), ""), x["usd"], x["units"], UNIT_AR.get(x.get("unit"), ""),
                          float(x["unit_usd"]), x["save_pct"], bool(x.get("use")), x.get("note") or ""])
        for x in (row["month"] or {}).get("scenarios") or []:
            scen.append([nm, x["name"] if not x.get("custom") else "🤝 باقة مخصصة لنا", BILL_AR.get(x.get("billing"), ""), x["month_units"], UNIT_AR.get(x.get("unit"), ""),
                         x["packs"], x["pay_usd"], x["year_usd"], x["month_usd"], float(x["unit_usd"]), x["save_pct"], bool(x.get("use")), bool(x.get("custom")),
                         bool(x.get("quoted")) if x.get("custom") else "", x.get("note") or ""])
        c = row.get("custom") or {}
        custom.append([nm, CU_AR.get(c.get("status"), ""), c.get("pct"), c.get("usd"), c.get("units"), UNIT_AR.get(c.get("unit"), ""), BILL_AR.get(c.get("billing"), ""),
                       c.get("contact") or "", c.get("note") or ""])
        u = row.get("unit_usd")
        bal.append([nm, row["what"], row["balance"], row["unit"] or "", row["min"], st_ar.get(row["state"], ""), float(u) if u else None,
                    round(row["balance"] * u, 2) if row["balance"] is not None and u else None])
        for mk in ms:
            yy, mm = (int(v) for v in mk.split("-"))
            t0 = dt.datetime(yy, mm, 1).timestamp()
            t1 = dt.datetime(yy + (mm == 12), mm % 12 + 1, 1).timestamp()
            stt = providers.month_stats(pd, k, t0, t1)
            if stt.get("used") or stt.get("topups"):
                use.append([mk, nm, stt.get("used"), stt.get("used_usd"), stt.get("topups"), stt.get("topup_usd")])
    cats = sorted({c["cat"] for k in ms for c in per[k]["by_cat"]})
    catm = [["القسم"] + ms + ["الإجمالي $"]]
    for cat in cats:
        vals = [next((c["usd"] for c in per[k]["by_cat"] if c["cat"] == cat), 0) for k in ms]
        catm.append([cat] + vals + [round(sum(vals), 2)])
    eco = [["الباقة", "السعر $", "المشتركون", "متوسط إنفاقنا على المشترك $", "المكسب $", "أقصى خصم آمن ٪"]]
    for x in per[ms[-1]]["plans"]:
        eco.append([x["name"], x["price"], x["subs"], x["avg_cost"], x["margin"], x["max_discount"]])
    cu = admin_customers(request, 30)
    cust = [["البراند", "الاسم", "البريد / الجوال", "الباقة", "مشترك يدفع", "تاريخ التسجيل", "آخر دخول", "دفع إجمالًا $", "صرفنا عليه إجمالًا $", "منها وهو مجاني $",
             "منها ترويج $", "صرفنا عليه آخر ٣٠ يومًا $", "المكسب $", "خسران", "نقاط استهلكها إجمالًا", "نقاط آخر ٣٠ يومًا", "نقاط هدية", "رصيده الآن (نقاط)", "الخصم ٪", "الكوبون"]]
    day = lambda t: dt.datetime.fromtimestamp(t).strftime("%Y-%m-%d") if t else ""  # noqa: E731
    for r in cu["items"]:
        cust.append([r.get("brand") or "", r.get("name") or "", r.get("email") or "", r.get("plan") or "", bool(r["paying"]), day(r.get("created_at")), day(r.get("last_login")),
                     r["paid"], r["cost_all"], r["cost_trial"], r["cost_promo"], r["cost_period"], r["margin"], bool(r["losing"]), r["used_all"], r["used_period"],
                     r["gifted"], r.get("balance") or 0, r.get("discount_pct") or 0, r.get("discount_code") or ""])
    try:
        ex = json.loads((DATA_DIR / "expenses.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        ex = []
    cyc = {"monthly": "شهري", "yearly": "سنوي", "usage": "حسب الاستخدام", "once": "مرة واحدة"}
    cyc["usage"] = "شحن مرة واحدة"
    bills = [["الخدمة", "الباقة التي ندفعها", "المبلغ $", "الدفع", "نشحن كل (شهر)", "يوم الدفع", "ملاحظة", "متوسط شهري $"]]
    for r in ex:
        a = float(r.get("amount") or 0)
        c = r.get("eff") or r.get("cycle")
        bills.append([r.get("name") or "", r.get("pack") or "", a, cyc.get(c, c or ""), r.get("every") or 1 if c == "usage" else "", r.get("day") or "",
                      r.get("note") or "", float(r["monthly"]) if "monthly" in r else round(a if c == "monthly" else a / 12 if c == "yearly" else 0, 2)])
    bills.append(["■ الإجمالي", "", "", "", "", "", "", round(sum(x[-1] or 0 for x in bills[1:]), 2)])
    data = xlsx.build([("ملخص شهري", summary), ("الباقات", packs), ("سيناريوهات الباقات", scen), ("الباقات المخصصة", custom), ("أرصدة المنصات", bal),
                       ("استهلاك المنصات", use), ("أقسام الإنفاق", catm), ("العملاء", cust), ("اقتصاد الباقات", eco), ("الحسابات الشهرية", bills)])
    name = f"financial-model-{now:%Y-%m-%d}.xlsx"
    return Response(data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{name}"', "Cache-Control": "no-store"})


# 📼 معمل سعاد: كل مكالمة متسجلة كتابة (كلامها، وكلام العميل من الصوت أو الكتابة، والأدوات، و«كمّلت لوحدها»، والكتم)
ACALLS = PLATFORM / "assistant_calls"


def _acall_sum(d: dict) -> dict:
    ev = d.get("events") or []
    n = lambda who, text=None: sum(1 for e in ev if e.get("who") == who and (text is None or e.get("text") == text))  # noqa: E731
    users = [e for e in ev if e.get("who") == "user"]
    short = sum(1 for e in users if (e.get("data") or {}).get("voice") and len((e.get("text") or "").strip()) < 4)
    saves = sum(1 for e in ev if e.get("who") == "tool" and e.get("text") == "save_answer")
    flags = []
    if n("sys", "auto-continue") >= 3:
        flags.append("أكملت وحدها كثيرًا")
    if short >= 3 or n("sys", "speech_started") > 2 * max(1, len(users)) + 4:
        flags.append("ضوضاء محتملة")
    if n("err"):
        flags.append("أخطاء")
    return {"id": d.get("id"), "started": d.get("started"), "ended": d.get("ended"), "updated": d.get("updated"), "role": d.get("role"),
            "email": d.get("email"), "name": d.get("name"), "brand": d.get("brand"), "dialect": d.get("dialect"), "meta": d.get("meta") or {},
            "turns": {"agent": n("agent"), "user": len(users), "tools": n("tool"), "saved": saves, "auto": n("sys", "auto-continue")},
            "flags": flags, "review": d.get("review")}


@app.get("/api/platform/assistant-calls")
def acalls_list(request: Request, limit: int = 100):
    admin(request)
    out = []
    for f in sorted(ACALLS.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True)[:max(1, min(limit, 500))]:
        try:
            out.append(_acall_sum(json.loads(f.read_text("utf-8"))))
        except (OSError, ValueError):
            continue
    try:
        cust = bool(json.loads((PLATFORM / "assist_log.json").read_text("utf-8")).get("customers"))
    except (OSError, ValueError):
        cust = False
    return {"items": out, "customers": cust}


def _acall_file(cid: str) -> Path:
    f = ACALLS / f"{re.sub(r'[^A-Za-z0-9_-]', '', cid)}.json"
    if not f.exists():
        raise HTTPException(404, "المكالمة غير موجودة")
    return f


@app.get("/api/platform/assistant-calls/{cid}")
def acall_get(cid: str, request: Request):
    admin(request)
    d = json.loads(_acall_file(cid).read_text("utf-8"))
    return {**_acall_sum(d), "events": d.get("events") or []}


class ACallReviewIn(BaseModel):
    stars: int = 0
    note: str = ""


@app.put("/api/platform/assistant-calls/{cid}/review")
def acall_review(cid: str, body: ACallReviewIn, request: Request):
    admin(request)
    f = _acall_file(cid)
    d = json.loads(f.read_text("utf-8"))
    d["review"] = {"stars": max(0, min(5, body.stars)), "note": body.note.strip()[:2000], "at": time.time()}
    f.write_text(json.dumps(d, ensure_ascii=False), "utf-8")
    return _acall_sum(d)


@app.delete("/api/platform/assistant-calls/{cid}")
def acall_delete(cid: str, request: Request):
    admin(request)
    _acall_file(cid).unlink(missing_ok=True)
    return {"ok": True}


class ACallSetIn(BaseModel):
    customers: bool = False


@app.put("/api/platform/assistant-calls-settings")
def acalls_settings(body: ACallSetIn, request: Request):
    """تسجيل مكالمات العملاء (كتابة بس): مقفول افتراضيًا. مكالمات الأدمن بتتسجل دايمًا."""
    admin(request)
    (PLATFORM / "assist_log.json").write_text(json.dumps({"customers": body.customers}), "utf-8")
    return {"customers": body.customers}


class GiftIn(BaseModel):
    points: int
    note: str = ""


@app.post("/api/platform/customers/{wid}/gift")
def admin_gift(wid: str, body: GiftIn, request: Request):
    """🎁 نقاط هدية من الأدمن (بتتحط مع النقاط المشحونة، فمابتروحش مع تجديد الباقة)."""
    admin(request)
    n = int(body.points)
    if not workspace(wid) or wid == OWNER:
        raise HTTPException(404, "هذا العميل غير موجود")
    if not 1 <= n <= 1_000_000:
        raise HTTPException(400, "اكتب عدد نقاط صحيحًا")
    with closing(db()) as c, c:
        c.execute("INSERT OR IGNORE INTO wallet (workspace, plan_credits, topup_credits, updated_at) VALUES (?, 0, 0, ?)", (wid, time.time()))
        c.execute("UPDATE wallet SET topup_credits = topup_credits + ?, updated_at=? WHERE workspace=?", (n, time.time(), wid))
        ledger_add(c, wid, n, "gift", (body.note.strip() or "نقاط هدية من فريق سمسمكيت")[:120])
    return {"ok": True}


# 🎟️ الكوبونات: الأدمن بيعمل كود، والعميل بيكتبه وهو بيسجّل (أو من «باقتي ونقاطي»): نقاط هدية، أو خصم ٪ على الاشتراك والشحن
class CouponIn(BaseModel):
    code: str
    points: int = 0
    pct: int = 0
    max_uses: int = 0      # ٠ = من غير حد
    days: int = 0          # صالح كام يوم (٠ = من غير تاريخ انتهاء)
    once: bool = True      # الخصم ٪: على الدفعة الجاية بس (True)، ولا على كل دفعاته (False)
    note: str = ""


def coupon_code(s: str) -> str:
    return re.sub(r"[^A-Z0-9_-]", "", str(s or "").upper())[:24]


@app.get("/api/platform/coupons")
def coupons_list(request: Request):
    admin(request)
    with closing(db()) as c:
        return {"items": [dict(r) for r in c.execute("SELECT * FROM coupons ORDER BY created_at DESC")]}


@app.post("/api/platform/coupons")
def coupons_add(body: CouponIn, request: Request):
    admin(request)
    code = coupon_code(body.code)
    if len(code) < 3:
        raise HTTPException(400, "الكود ٣ أحرف أو أرقام على الأقل (إنجليزي)")
    pts, pct = max(0, min(int(body.points), 1_000_000)), max(0, min(int(body.pct), 90))
    if not pts and not pct:
        raise HTTPException(400, "حدّد نقاط هدية أو نسبة خصم")
    with closing(db()) as c, c:
        if c.execute("SELECT 1 FROM coupons WHERE code=?", (code,)).fetchone():
            raise HTTPException(400, "هذا الكود موجود بالفعل")
        c.execute("INSERT INTO coupons (code, points, pct, max_uses, used, expires, note, created_at, once) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)",
                  (code, pts, pct, max(0, int(body.max_uses)), time.time() + body.days * 86400 if body.days > 0 else None, body.note.strip()[:120], time.time(),
                   int(body.once)))
    return coupons_list(request)


@app.delete("/api/platform/coupons/{code}")
def coupons_del(code: str, request: Request):
    admin(request)
    with closing(db()) as c, c:
        c.execute("DELETE FROM coupons WHERE code=?", (coupon_code(code),))
    return coupons_list(request)


def coupon_redeem(wid: str, raw: str) -> dict:
    """يطبّق الكوبون على مساحة العميل مرة واحدة: النقاط تنزل في رصيده، والخصم يتسجل على المساحة ويتطبق في الدفع."""
    code = coupon_code(raw)
    with closing(db()) as c, c:
        k = c.execute("SELECT * FROM coupons WHERE code=?", (code,)).fetchone()
        if not k:
            raise HTTPException(400, "هذا الكود غير صحيح")
        if k["expires"] and k["expires"] < time.time():
            raise HTTPException(400, "انتهت صلاحية هذا الكود")
        if k["max_uses"] and k["used"] >= k["max_uses"]:
            raise HTTPException(400, "استُخدم هذا الكود بالعدد المسموح")
        if c.execute("SELECT 1 FROM coupon_uses WHERE code=? AND workspace=?", (code, wid)).fetchone():
            raise HTTPException(400, "استخدمت هذا الكود من قبل")
        c.execute("INSERT INTO coupon_uses (code, workspace, at) VALUES (?, ?, ?)", (code, wid, time.time()))
        c.execute("UPDATE coupons SET used = used + 1 WHERE code=?", (code,))
        if k["points"]:
            c.execute("INSERT OR IGNORE INTO wallet (workspace, plan_credits, topup_credits, updated_at) VALUES (?, 0, 0, ?)", (wid, time.time()))
            c.execute("UPDATE wallet SET topup_credits = topup_credits + ?, updated_at=? WHERE workspace=?", (k["points"], time.time(), wid))
            ledger_add(c, wid, k["points"], "coupon", f"كوبون {code}")
        if k["pct"]:
            c.execute("UPDATE workspaces SET discount_pct=?, discount_code=?, discount_once=? WHERE id=?", (k["pct"], code, int(k["once"] if k["once"] is not None else 1), wid))
    return {"ok": True, "points": k["points"], "pct": k["pct"], "once": bool(k["once"] if k["once"] is not None else 1)}


class RedeemIn(BaseModel):
    code: str


@app.post("/api/billing/coupon")
def billing_coupon(body: RedeemIn, request: Request):
    u = customer_user(request)
    return coupon_redeem(u["workspace"], body.code)


# ---------------------------------------------------------------- 🧭 الفحص الشامل (صفحة الأدمن /admin/inspect)
# عميل تجريبي بيمشي في البرنامج زي العميل بالظبط على نفس السيرفر (journey.py)، والنتيجة: الخطوات والنقاط والصور والفيديو،
# والنتايج اللي تتراجع بالعين (👍/👎 وملاحظة)، وخريطة كل كلام البرنامج وأماكنه.
JOURNEY = PLATFORM / "journey"
JOURNEY.mkdir(parents=True, exist_ok=True)
JOURNEY_EMAIL = "journey@test.simsimkit.com"
JOURNEY_CREDITS = 100_000   # رصيد حساب التجربة في كل تشغيلة (من غير حد عملي: الحد الحقيقي رصيد المنصات نفسها)
_journey: dict[str, subprocess.Popen] = {}


def ensure_test_account(email: str, password: str, credits: int, plan: str = "agency") -> str:
    """حساب عميل للتجربة: يُنشأ أو يُعاد ضبطه، مؤكَّد، على باقة كاملة، ورصيده = credits. يرجّع مساحة العمل."""
    email = norm_email(email)
    plan = plan if any(p["key"] == plan for p in billing.DEFAULTS["plans"]) else "agency"
    u = user_by("email", email)
    if u and u["role"] != "customer":
        raise HTTPException(400, "هذا البريد ليس حساب عميل")
    if not u:
        wid = new_workspace("الفحص الشامل")
        uid = uuid.uuid4().hex[:12]
        with closing(db()) as c, c:
            c.execute("INSERT INTO users (id, email, name, pw, verified, role, workspace, created_at) VALUES (?, ?, ?, ?, 1, 'customer', ?, ?)",
                      (uid, email, "الفحص الشامل", pw_hash(password), wid, time.time()))
        u = user_by("id", uid)
    wid = u["workspace"]
    with closing(db()) as c, c:
        c.execute("UPDATE users SET pw=?, verified=1 WHERE id=?", (pw_hash(password), u["id"]))
        c.execute("UPDATE workspaces SET plan=?, autopilot=1 WHERE id=?", (plan, wid))
        c.execute("INSERT OR IGNORE INTO wallet (workspace, plan_credits, topup_credits, updated_at) VALUES (?, 0, 0, ?)", (wid, time.time()))
        r = c.execute("SELECT plan_credits + topup_credits AS n FROM wallet WHERE workspace=?", (wid,)).fetchone()
        c.execute("UPDATE wallet SET plan_credits=0, topup_credits=?, updated_at=? WHERE workspace=?", (credits, time.time(), wid))
        ledger_add(c, wid, credits - (r["n"] if r else 0), "test", "رصيد الفحص الشامل")
    return wid


def journey_dir(rid: str) -> Path:
    if not re.fullmatch(r"[0-9a-z-]{6,40}", rid) or not (JOURNEY / rid).is_dir():
        raise HTTPException(404, "هذه التشغيلة غير موجودة")
    return JOURNEY / rid


def journey_read(d: Path, name: str, default=None):
    try:
        return json.loads((d / name).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def journey_summary(d: Path) -> dict:
    st = journey_read(d, "status.json", {}) or {}
    rid = d.name
    if st.get("state") in ("starting", "running") and (rid not in _journey or _journey[rid].poll() is not None):
        st["state"] = "failed" if rid not in _journey or _journey[rid].returncode else st["state"]
        st.setdefault("step", "توقفت العملية")
    rep = journey_read(d, "report.json", {}) or {}
    return {"id": rid, **st, "total": rep.get("total"), "niches": (journey_read(d, "request.json", {}) or {}).get("niches") or []}


class JourneyIn(BaseModel):
    phase: str = "1"
    niches: list[str] = []


@app.post("/api/platform/journey")
def journey_start(body: JourneyIn, request: Request):
    admin(request)
    if any(p.poll() is None for p in _journey.values()):
        raise HTTPException(400, "يوجد فحص يعمل الآن، انتظر حتى ينتهي أو أوقفه")
    pw = secrets.token_urlsafe(18)
    ensure_test_account(JOURNEY_EMAIL, pw, JOURNEY_CREDITS)
    rid = time.strftime("%Y%m%d-%H%M%S") + "-p" + re.sub(r"\W", "", body.phase)[:3]
    d = JOURNEY / rid
    d.mkdir(parents=True)
    niches = [n for n in body.niches if re.fullmatch(r"[a-z]{2,20}", n)]
    (d / "request.json").write_text(json.dumps({"phase": body.phase, "niches": niches, "at": time.time()}))
    port = os.environ.get("PORT") or "8000"
    _journey[rid] = subprocess.Popen(
        [sys.executable, str(Path(__file__).with_name("journey.py")), "--base", f"http://127.0.0.1:{port}", "--out", str(d),
         "--phase", body.phase, "--niches", ",".join(niches), "--email", JOURNEY_EMAIL],
        env={**os.environ, "JOURNEY_PASSWORD": pw}, stdout=open(d / "log.txt", "w"), stderr=subprocess.STDOUT, cwd=str(Path(__file__).parent))
    return journey_summary(d)


@app.get("/api/platform/journey")
def journey_list(request: Request):
    admin(request)
    runs = sorted((p for p in JOURNEY.iterdir() if p.is_dir()), reverse=True)[:30]
    return {"runs": [journey_summary(d) for d in runs]}


@app.get("/api/platform/journey/{rid}")
def journey_get(rid: str, request: Request):
    admin(request)
    d = journey_dir(rid)
    rep = journey_read(d, "report.json", {}) or {}
    rep.pop("textmap", None)   # الخريطة لوحدها (كبيرة)
    try:
        log = (d / "log.txt").read_text(encoding="utf-8")[-6000:]
    except OSError:
        log = ""
    files = {k: sorted(p.name for p in (d / k).glob("*")) if (d / k).is_dir() else [] for k in ("shots", "video")}
    return {**journey_summary(d), "report": rep, "ratings": journey_read(d, "ratings.json", {}) or {}, "log": log, "files": files}


@app.get("/api/platform/journey/{rid}/f/{kind}/{name}")
def journey_file(rid: str, kind: str, name: str, request: Request):
    admin(request)
    d = journey_dir(rid)
    if kind not in ("shots", "video") or not re.fullmatch(r"[\w.-]+", name) or not (d / kind / name).is_file():
        raise HTTPException(404, "غير موجود")
    return FileResponse(d / kind / name)


class JourneyRateIn(BaseModel):
    oid: str
    vote: int = 0      # 1 = 👍، -1 = 👎، 0 = بدون
    note: str = ""


@app.post("/api/platform/journey/{rid}/rate")
def journey_rate(rid: str, body: JourneyRateIn, request: Request):
    admin(request)
    d = journey_dir(rid)
    r = journey_read(d, "ratings.json", {}) or {}
    r[body.oid[:80]] = {"vote": max(-1, min(1, body.vote)), "note": body.note.strip()[:2000], "at": time.time()}
    (d / "ratings.json").write_text(json.dumps(r, ensure_ascii=False))
    return r


@app.post("/api/platform/journey/{rid}/stop")
def journey_stop(rid: str, request: Request):
    admin(request)
    d = journey_dir(rid)
    p = _journey.get(rid)
    if p and p.poll() is None:
        p.terminate()
    st = journey_read(d, "status.json", {}) or {}
    (d / "status.json").write_text(json.dumps({**st, "state": "stopped", "step": "أوقفه الأدمن"}, ensure_ascii=False))
    return journey_summary(d)


@app.get("/api/platform/textmap")
def journey_textmap(request: Request, rid: str = ""):
    """🗺️ خريطة الكلام: من آخر تشغيلة فيها خريطة (أو تشغيلة بعينها)."""
    admin(request)
    runs = [journey_dir(rid)] if rid else sorted((p for p in JOURNEY.iterdir() if p.is_dir()), reverse=True)
    for d in runs:
        tm = (journey_read(d, "report.json", {}) or {}).get("textmap")
        if tm:
            return {"run": d.name, "items": tm}
    return {"run": None, "items": []}


# ---------------------------------------------------------------- 🗺️ خريطة لغة البرنامج (tools/langmap.py)
# كل جملة بتظهر للعميل من الكود نفسه (الموقع، تطبيق الجوال، رسايل السيرفر، خانات القوالب): مكانها وترجمتها ولو فيها عامية.
# المشاكل بتنزل في صندوق الأخطاء لوحدها (مع كل تشغيل للبوابة، ومن زرار «افحص الآن»)، واللي اتصلّح بيتقفل.
_langmap: dict = {"at": 0.0, "map": None}


def langmap_get(force: bool = False) -> dict:
    sys.path.insert(0, str(ROOT / "tools"))
    import langmap   # noqa: PLC0415
    if force or not _langmap["map"] or time.time() - _langmap["at"] > 600:
        _langmap.update(at=time.time(), map=langmap.build())
    return _langmap["map"]


def langmap_report(force: bool = False) -> dict:
    """المشاكل ← صندوق الأخطاء: بند لكل ملف ونوع مشكلة، وفيه الجمل بأماكنها. البنود القديمة اللي اتصلّحت بتتقفل."""
    m = langmap_get(force)
    groups: dict[tuple[str, str], list] = {}
    for it in m["items"]:
        for p in lm_problems(it):
            groups.setdefault((p, it["where"][0].split(":")[0]), []).append(it)
    for r in issues.listing(open_only=True, limit=2000):
        if r["kind"] == "i18n":
            issues.resolve(r["id"], "اتصلّح (آخر فحص للغة مالقاهوش)")
    what = {"no_en": "جمل بدون ترجمة إنجليزية", "dialect": "جمل فيها عامية في الواجهة", "dialect_ai": "جمل فيها عامية أو عربي غير سليم (مراجعة الذكاء الاصطناعي)"}
    for (p, f), its in groups.items():
        def line(x):
            if p == "dialect":
                return f"{x['where'][0]}  {x['ar']}  [{x['dialect']}]"
            if p == "dialect_ai":
                v = lm_ai_verdict(x["ar"])
                return f"{x['where'][0]}  {x['ar']}  [{v.get('words', '')}]\n    ← {v.get('fix', '')}"
            return f"{x['where'][0]}  {x['ar']}"
        issues.record("i18n", f, f"{what[p]}: {len(its)} في {f}", "\n".join(line(x) for x in its[:60]), 0, screen="خريطة اللغة")
    return {"stat": lm_stat(m), "groups": len(groups)}


# 🤖 مراجعة العامية بالذكاء الاصطناعي: قاموس الكلمات بيفوّت كلام كتير، فالموديل بيقرا جمل الواجهة ويعلّم اللي مش فصحى سليمة.
# كل جملة بتتراجع مرة واحدة بس (النتيجة محفوظة ببصمة الجملة)، فالزرار بعد كده بيراجع الجديد أو اللي اتغيّر بس.
LM_AI_FILE = DATA_DIR / "langmap_ai.json"
LM_AI_MODEL = os.environ.get("LANGMAP_AI_MODEL", "google/gemini-2.5-flash")
LM_AI_PRICE = (0.30, 2.50)   # دولار لكل مليون توكن (دخل، خرج) للموديل ده
LM_AI_BATCH = 120
_lm_ai: dict = {"cache": None, "job": {"running": False}}
_lm_ai_lock = threading.Lock()


def _lm_key(ar: str) -> str:
    return hashlib.sha1(ar.encode("utf-8")).hexdigest()[:16]


def lm_ai_cache() -> dict:
    if _lm_ai["cache"] is None:
        try:
            _lm_ai["cache"] = json.loads(LM_AI_FILE.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            _lm_ai["cache"] = {}
    return _lm_ai["cache"]


def lm_ai_verdict(ar: str) -> dict:
    return lm_ai_cache().get(_lm_key(ar)) or {}


def lm_problems(it: dict) -> list[str]:
    ps = list(it["problems"])
    if it["kind"] != "content" and "dialect" not in ps and lm_ai_verdict(it["ar"]).get("bad"):
        ps.append("dialect_ai")
    return ps


def lm_ai_pending(m: dict) -> list[dict]:
    c = lm_ai_cache()
    return [it for it in m["items"] if it["kind"] != "content" and _lm_key(it["ar"]) not in c]


def lm_ai_cost(items: list[dict]) -> float:
    # العربي بيتقسم توكنز كتير: حرفين ونص تقريبًا للتوكن، والرد حوالي ربع الدخل، وفوقهم التعليمات في كل دفعة
    tin = sum(len(x["ar"]) for x in items) / 2.5 + 400 * (len(items) / LM_AI_BATCH + 1)
    return round((tin * LM_AI_PRICE[0] + tin * 0.25 * LM_AI_PRICE[1]) / 1e6, 3)


def lm_stat(m: dict) -> dict:
    pend = lm_ai_pending(m)
    bad = sum(1 for it in m["items"] if "dialect_ai" in lm_problems(it))
    return {**m["stat"], "dialect_ai": bad, "ai_pending": len(pend), "ai_cost": lm_ai_cost(pend), "ai_job": _lm_ai["job"]}


LM_AI_PROMPT = """You review Arabic UI strings of a video-marketing web app. Every UI string must be correct Modern Standard Arabic (فصحى).
Flag a string ONLY if it has colloquial/dialect words (Egyptian, Gulf, Levantine, Maghrebi…) or clearly broken Arabic grammar
(e.g. «لا يوجد صور», «جارٍ الرفع الفيديو», «تريد تغيّر ماذا»). Do NOT flag: English words, brand/model names, placeholders like {0},
or tech loanwords that are normal in MSA app UIs (فيديو، ريل، موشن جرافيك، لب سينك، ستوري بورد، أوتوبايلوت، تايبوجرافي، كاروسيل).
Input: JSON list of [index, string]. Output JSON: {"bad": [{"i": index, "words": "the wrong words", "fix": "the full corrected MSA string, same meaning, same placeholders/emojis/punctuation"}]}.
Return {"bad": []} if all are fine."""


def _lm_ai_batch(batch: list[str], key: str) -> list[dict]:
    body = {"model": LM_AI_MODEL, "temperature": 0, "max_tokens": 8000, "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": LM_AI_PROMPT},
                         {"role": "user", "content": json.dumps([[i, s] for i, s in enumerate(batch)], ensure_ascii=False)}]}
    url = os.environ.get("ATLASCLOUD_LLM_URL") or os.environ.get("ATLASCLOUD_BASE_URL", "https://api.atlascloud.ai") + "/v1"
    r = httpx.post(f"{url}/chat/completions", headers={"Authorization": f"Bearer {key}"}, json=body, timeout=240)
    if r.status_code >= 400:
        raise RuntimeError(f"الموديل رد بخطأ {r.status_code}: {r.text[:300]}")
    txt = (r.json()["choices"][0]["message"]["content"] or "").strip()
    txt = re.sub(r"^```(?:json)?\s*|\s*```$", "", txt)
    return json.loads(txt).get("bad") or []


def _lm_ai_run(items: list[dict], key: str) -> None:
    job = _lm_ai["job"]
    try:
        strs = list(dict.fromkeys(x["ar"] for x in items))
        for k in range(0, len(strs), LM_AI_BATCH):
            batch = strs[k:k + LM_AI_BATCH]
            bad = {int(b["i"]): b for b in _lm_ai_batch(batch, key) if str(b.get("i", "")).isdigit() and int(b["i"]) < len(batch)}
            with _lm_ai_lock:
                c = lm_ai_cache()
                for i, s in enumerate(batch):
                    b = bad.get(i)
                    c[_lm_key(s)] = {"bad": True, "words": str(b.get("words") or "")[:200], "fix": str(b.get("fix") or "")[:1000]} if b else {"bad": False}
                LM_AI_FILE.parent.mkdir(parents=True, exist_ok=True)
                LM_AI_FILE.write_text(json.dumps(c, ensure_ascii=False), encoding="utf-8")
            job["done"] = min(len(strs), k + len(batch))
            job["found"] = job.get("found", 0) + len(bad)
        langmap_report()
    except Exception as exc:  # noqa: BLE001
        job["error"] = f"{type(exc).__name__}: {exc}"[:400]
        issues.record("api", "langmap/ai", "مراجعة العامية بالذكاء الاصطناعي فشلت", job["error"], 500)
    finally:
        job["running"] = False
        job["at"] = time.time()


@app.get("/api/platform/langmap")
def langmap_api(request: Request, q: str = "", problem: str = "", kind: str = "", limit: int = 500, fresh: int = 0):
    admin(request)
    m = langmap_get(bool(fresh))
    rows = []
    for r in m["items"]:
        ps = lm_problems(r)
        if (not problem or problem in ps or (problem == "any" and ps)) and (not kind or r["kind"] == kind) \
                and (not q or q in r["ar"] or q.lower() in (r["en"] or "").lower() or any(q in w for w in r["where"])):
            rows.append({**r, "problems": ps, "ai": lm_ai_verdict(r["ar"]) if "dialect_ai" in ps else None})
    return {"stat": lm_stat(m), "count": len(rows), "items": rows[:max(1, min(limit, 5000))]}


@app.get("/api/platform/langmap.csv")
def langmap_csv(request: Request):
    admin(request)
    sys.path.insert(0, str(ROOT / "tools"))
    import langmap   # noqa: PLC0415
    return Response(langmap.to_csv(langmap_get()["items"]), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": "attachment; filename=simsimkit-language-map.csv"})


@app.post("/api/platform/langmap/scan")
def langmap_scan(request: Request):
    admin(request)
    return langmap_report(force=True)


@app.post("/api/platform/langmap/ai")
def langmap_ai(request: Request):
    """يراجع بالموديل جمل الواجهة اللي لسه ماتراجعتش بس (التكلفة على المنصة، وبتظهر على الزرار قبل الضغط)."""
    admin(request)
    key = os.environ.get("ATLASCLOUD_API_KEY") or os.environ.get("ATLAS_CLOUD_API_KEY")
    if not key:
        raise HTTPException(400, "مفتاح Atlas غير مسجل. ضعه من ⚙️ الإعدادات")
    with _lm_ai_lock:
        if _lm_ai["job"].get("running"):
            raise HTTPException(409, "المراجعة تعمل الآن، انتظر حتى تنتهي")
        pend = lm_ai_pending(langmap_get(True))
        if not pend:
            return {"started": False, "stat": lm_stat(langmap_get())}
        _lm_ai["job"] = {"running": True, "total": len(dict.fromkeys(x["ar"] for x in pend)), "done": 0, "found": 0, "cost": lm_ai_cost(pend)}
    threading.Thread(target=_lm_ai_run, args=(pend, key), daemon=True).start()
    return {"started": True, "job": _lm_ai["job"]}


def _langmap_boot() -> None:
    time.sleep(20)   # بعد ما البوابة تقوم
    try:
        langmap_report(force=True)
    except Exception as exc:  # noqa: BLE001
        issues.record("api", "langmap", "فحص خريطة اللغة نفسه فشل", f"{type(exc).__name__}: {exc}", 500)


threading.Thread(target=_langmap_boot, daemon=True).start()


# ---------------------------------------------------------------- 🚨 صندوق الأخطاء (issues.py)
@app.get("/api/platform/issues")
def issues_list(request: Request, all: int = 0):
    admin(request)
    rows = issues.listing(open_only=not all)
    with closing(db()) as c:
        emails = {r["workspace"]: (r["phone"] if r["email"].endswith(PHONE_MAIL) else r["email"]) for r in c.execute("SELECT workspace, email, phone FROM users")}
    for r in rows:
        r["accounts"] = sorted({*r["users"], *(emails.get(w, "صاحب المنصة" if w == OWNER else w) for w in r["workspaces"])})[:20]
    return {"items": rows, "open": issues.open_count()}


class IssueResolveIn(BaseModel):
    note: str = ""
    reopen: bool = False


@app.post("/api/platform/issues/{iid}/resolve")
def issues_resolve(iid: str, body: IssueResolveIn, request: Request):
    admin(request)
    issues.resolve(iid, body.note, body.reopen)
    return {"ok": True, "open": issues.open_count()}


# 🤖 متابعة Claude: نفس صندوق الأخطاء لكن بمفتاح بدل الدخول، عشان جلسة Claude تسحب الأخطاء الجديدة وتصلّحها وتقفلها.
# المفتاح بيتعمل من /admin/inspect ويظهر مرة واحدة، والمتخزّن بصمته بس (sha256)، وتوليد مفتاح جديد بيلغي القديم.
def feed_ok(request: Request) -> None:
    want, got = kv_get("issues_feed_hash") or "", (request.headers.get("authorization") or "").removeprefix("Bearer ").strip()
    if not want or not got or not hmac.compare_digest(want, hashlib.sha256(got.encode()).hexdigest()):
        raise HTTPException(403, "مفتاح المتابعة غير صحيح")


@app.post("/api/platform/issues/feed-key")
def issues_feed_key(request: Request):
    admin(request)
    k = "ssk_" + secrets.token_urlsafe(32)
    kv_set("issues_feed_hash", hashlib.sha256(k.encode()).hexdigest())
    kv_set("issues_feed_at", str(time.time()))
    return {"key": k}


@app.get("/api/platform/issues/feed")
def issues_feed(request: Request, since: float = 0, all: int = 0):
    feed_ok(request)
    kv_set("issues_feed_seen", str(time.time()))
    rows = [r for r in issues.listing(open_only=not all, limit=500) if (r["last_at"] or 0) > since]
    for r in rows:   # من غير بريد العملاء: العدد بس يكفي للتصليح
        r["accounts"] = len({*r.pop("users"), *r.pop("workspaces")})
    return {"items": rows, "open": issues.open_count(), "now": time.time()}


@app.post("/api/platform/issues/feed/{iid}/resolve")
def issues_feed_resolve(iid: str, body: IssueResolveIn, request: Request):
    feed_ok(request)
    issues.resolve(iid, body.note, body.reopen)
    return {"ok": True, "open": issues.open_count()}


@app.get("/api/platform/issues/feed-state")
def issues_feed_state(request: Request):
    admin(request)
    f = lambda k: float(kv_get(k) or 0) or None
    return {"has_key": bool(kv_get("issues_feed_hash")), "made_at": f("issues_feed_at"), "seen_at": f("issues_feed_seen")}


@app.get("/admin/inspect")
def admin_inspect_page(request: Request):
    u = current_user(request)
    if not u or u["role"] != "admin":
        return RedirectResponse("/login")
    return page("inspect.html")


# ---------------------------------------------------------------- 🎙️ مختبر الصوت المباشر (livevoice.py): المساعد اللي بيكلّم العميل لايف
@app.get("/admin/live")
def admin_live_page(request: Request):
    u = current_user(request)
    if not u or u["role"] != "admin":
        return RedirectResponse("/login")
    return page("voicelive.html")


@app.get("/api/platform/live/config")
def live_config(request: Request):
    admin(request)
    return livevoice.models()


class LiveTokenIn(BaseModel):
    provider: str
    model: str = ""
    voice: str = ""
    dialect: str = "ar-eg-cairo"
    agent: str = ""          # فاضي = اسم اللهجة على حسب نوع الصوت
    user: str = ""
    user_gender: str = "m"   # m / f: الضماير اللي المساعد بيكلم بيها العميل
    eagerness: str = "auto"


@app.post("/api/platform/live/token")
def live_token(request: Request, body: LiveTokenIn):
    u = admin(request)
    who = body.user.strip() or (u["name"] if "name" in u.keys() and u["name"] else "") or "محمود"
    ag = livevoice.VOICE_GENDER.get(body.voice, "f")
    instr = livevoice.instructions(body.dialect, body.agent.strip(), who, ag, "f" if body.user_gender == "f" else "m")
    try:
        if body.provider == "openai":
            tok = livevoice.openai_secret(body.model or livevoice.OPENAI_MODELS[0], body.voice or "marin", instr,
                                          body.eagerness if body.eagerness in ("low", "medium", "high", "auto") else "auto")
        else:
            raise HTTPException(400, "مزوّد غير معروف")
    except livevoice.LiveError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {**tok, "instructions": instr}


@app.get("/api/platform/live/results")
def live_results(request: Request):
    admin(request)
    rows = livevoice.results(DATA_DIR)
    return {"rows": rows[-300:][::-1], "summary": livevoice.summary(rows)}


@app.post("/api/platform/live/results")
def live_result_add(request: Request, body: dict):
    admin(request)
    return livevoice.save_result(DATA_DIR, body)


@app.delete("/api/platform/live/results/{rid}")
def live_result_del(request: Request, rid: str):
    admin(request)
    livevoice.delete_result(DATA_DIR, rid)
    return {"ok": True}


# ---------------------------------------------------------------- كل الباقي بيروح لنسخة البرنامج بتاعة العميل

# حاجات للأدمن بس (المفاتيح، المعمل، أدوات السيرفر، مكسبنا)
ADMIN_ONLY = re.compile(r"^/(api/(lab|admin|pricing/margins|atlas)(/|$)|api/settings$|media/lab/|lab\b)")
HOP = {"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers", "transfer-encoding", "upgrade", "host"}
# هيدرز البوابة بس هي اللي تحطها: لو الزائر بعتها بنفسه بتتشال
SPOOF = ("x-gateway-secret", "x-user-", "x-forwarded-", "x-real-ip", "forwarded")
MAX_BODY = int(float(os.environ.get("MAX_UPLOAD_MB") or 2048) * 1024 * 1024)
CSP = "; ".join((
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "connect-src 'self' https: wss: data: blob:",
    "frame-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https:",
))
SEC_HEADERS = {"x-content-type-options": "nosniff", "x-frame-options": "SAMEORIGIN", "referrer-policy": "strict-origin-when-cross-origin",
               "strict-transport-security": "max-age=31536000; includeSubDomains", "content-security-policy": CSP,
               "permissions-policy": "camera=(self), microphone=(self), geolocation=(), payment=(self)"}


class SecurityMiddleware:
    """سيدرز أمان على كل رد، ورفض الرفع الذي حجمه المعلن أكبر من الحد (ASGI خام لكي الستريم والفيديو يظلون كما هم)."""

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
    """الرفع بدون حجم معروف: يقف إذا عدّى الحد."""
    n = 0
    async for chunk in stream:
        n += len(chunk)
        if n > MAX_BODY:
            raise HTTPException(413, "الملف أكبر من المسموح")
        yield chunk


@app.post("/hooks/zernio")
async def zernio_hook(request: Request):
    """الرسائل الذي على الخاص من خدمة النشر: نتأكد من التوقيع، ونوصّلها لنسخة العميل صاحب الحساب."""
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


@app.post("/hooks/bot-ai/{token}")
async def bot_ai_hook(token: str, request: Request):
    """🤖 الرد الذكي لبوتات الرسايل: Zernio بيكلّم الرابط ده من نود webhook، والتوقيع اللي في الرابط بيقول البوت ده بتاع أنهي حساب."""
    import botflows
    wid = botflows.ai_token_ok(token, hook_secret())
    if not wid or not workspace_dir(wid).exists():
        return JSONResponse({"detail": "bad token"}, status_code=401)
    raw = (await request.body())[:20000]
    t = await ensure(wid)
    try:
        r = await _http.post(f"http://127.0.0.1:{t.port}/api/_hooks/bot-ai", content=raw,
                             headers={"x-gateway-secret": GATEWAY_SECRET, "content-type": "application/json"}, timeout=60)
        return JSONResponse(r.json(), status_code=r.status_code)
    except (httpx.HTTPError, ValueError):
        return JSONResponse({"text": "حد من الفريق هيرد عليك حالًا 🙏", "handoff": True})


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
async def proxy(path: str, request: Request):
    url_path = "/" + path
    if url_path.startswith(("/api/_hooks/", "/api/_tenant/")):   # داخلي بين البوابة والنسخ بس
        return JSONResponse({"detail": "غير موجود"}, status_code=404)
    u = current_user(request)
    if not u or not u["verified"]:
        # ملفات الشكل (CSS / JS) لصفحات الدخول بتتقرا من الفولدر على طول
        f = (FRONTEND / path).resolve()
        if url_path.endswith((".css", ".js", ".svg", ".png", ".ico", ".woff2")) and f.parent == FRONTEND.resolve() and f.is_file():
            return Response(f.read_bytes(), media_type={".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml",
                                                        ".png": "image/png"}.get(f.suffix, "application/octet-stream"),
                            headers={"Cache-Control": "no-cache"})
        # 🌐 صفحة الهبوط: صور الموقع (site/) وعيّنات القوالب (gallery/: فيديو وغلاف) مفتوحة للزوار
        if (f.parent == FRONTEND.resolve() / "site" or FRONTEND.resolve() / "gallery" in f.parents) and f.suffix in (".webp", ".png", ".jpg", ".mp4") and f.is_file():
            return FileResponse(f, headers={"Cache-Control": "public, max-age=86400"})
    u_pub = False
    if not u:
        if url_path.startswith("/api/") and url_path not in PUBLIC_FILES or url_path.startswith("/media/"):
            return JSONResponse({"detail": "يجب تسجيل الدخول"}, status_code=401)
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
            return JSONResponse({"detail": "أكّد بريدك الإلكتروني أولًا"}, status_code=403)
        else:
            return RedirectResponse("/verify")
    if u and u["verified"] and url_path in ("/pricing", "/pricing.html"):
        return RedirectResponse("/?plans=1")   # المسجّل دخول بيشوف «باقتي ونقاطي» جوه البرنامج
    if u and u["role"] != "admin" and ADMIN_ONLY.match(url_path):
        if url_path == "/api/settings" and request.method == "GET":
            return JSONResponse({"keys": {}, "password_from_env": False, "customer": True})
        return JSONResponse({"detail": "هذه الصفحة غير متاحة"}, status_code=403)
    # الملفات العامة (من غير دخول) بتتقرا من نسخة صاحب البرنامج، ومن غير بيانات
    t = await ensure(OWNER if u_pub else u["workspace"])
    t.last = time.time()
    headers = [(k, v) for k, v in request.headers.raw
               if (n := k.decode().lower()) not in HOP and n not in ("cookie", "authorization") and not n.startswith(SPOOF)]
    headers += [(b"x-gateway-secret", GATEWAY_SECRET.encode()), (b"x-forwarded-host", (request.headers.get("host") or "").encode()),
                (b"x-forwarded-proto", (request.headers.get("x-forwarded-proto") or request.url.scheme).encode())]
    if u and not u_pub:
        headers += [(b"x-user-email", u["email"].encode()), (b"x-user-role", u["role"].encode()),
                    (b"x-user-name", quote((u["name"] or "")[:80]).encode())]   # اسم التسجيل (المساعد الصوتي بيناديه بيه)
    target = f"http://127.0.0.1:{t.port}{url_path}" + (f"?{request.url.query}" if request.url.query else "")
    req = _http.build_request(request.method, target, headers=headers,
                              content=capped(request.stream()) if request.method not in ("GET", "HEAD", "OPTIONS") else None)
    try:
        r = await _http.send(req, stream=True)
    except httpx.HTTPError:
        _tenants.pop(t.wid, None)
        issues.record("api", f"{request.method} {url_path}", "نسخة العميل لم ترد (أُعيد تشغيلها)", "httpx.HTTPError عند الاتصال بنسخة العميل", 503,
                      u["email"] if u else "")
        return JSONResponse({"detail": "البرنامج يعيد التشغيل، جرّب مرة أخرى بعد ثوانٍ"}, status_code=503)
    out_headers = [(k, v) for k, v in r.headers.multi_items() if k.lower() not in HOP and k.lower() != "set-cookie"]
    resp = StreamingResponse(r.aiter_raw(), status_code=r.status_code, background=BackgroundTask(r.aclose))
    resp.raw_headers = [(k.encode("latin-1"), v.encode("latin-1")) for k, v in out_headers]
    return resp
