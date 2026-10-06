"""StudioMania backend.

الخطوة 1: مكتبة الفيديوهات الخام وتقطيعها لقطع (كل قطعة 15 ثانية أو أقل).
الخطوة 2: توليد فيديوهات بـ Seedance عن طريق Atlas Cloud.
الخطوة 4: مكتبة المدربين (الصورة والأوترو).
"""

import gzip
import hashlib
import json
import math
import os
import re
import shutil
import sqlite3
import subprocess
import tempfile
from xml.sax.saxutils import escape as xml_escape
import threading
import time
import uuid
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi import Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent


def load_env_file(path: Path) -> None:
    """يقرا ملف .env (سطور KEY=VALUE) من غير ما يغيّر متغيرات متسجلة قبل كده."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(ROOT / ".env")

import atlas  # noqa: E402  (لازم بعد قراءة .env)
import captions  # noqa: E402
import montage  # noqa: E402
import lab  # noqa: E402  (معمل التفكيك)
import audioshake  # noqa: E402  (فصل الكلام / الموسيقى / المؤثرات)
import publisher  # noqa: E402
import sheets  # noqa: E402
import carousel as cz  # noqa: E402
import series as sz  # noqa: E402
import ads as az  # noqa: E402
from auth import SESSION_COOKIE, SESSION_DAYS, Auth  # noqa: E402

MAX_CLIP_SECONDS = 15.0
MIN_CUT_GAP = 0.2  # أقل مسافة مسموحة بين نقطتين قطع
MIN_REFERENCE_SECONDS = 2.0  # Seedance مش بيقبل فيديو مرجعي أقصر من كده
VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".opus", ".flac"}
AUDIO_KINDS = {"voice", "music"}  # التعليق الصوتي (الخطوة 3) والموسيقى (الخطوة 5)

DATA_DIR = Path(os.environ.get("STUDIOMANIA_DATA") or ROOT / "data")
RAW_DIR = DATA_DIR / "raw"
CLIPS_DIR = DATA_DIR / "clips"
COACHES_DIR = DATA_DIR / "coaches"
GENERATED_DIR = DATA_DIR / "generated"
AUDIO_DIR = DATA_DIR / "audio"
EXPORTS_DIR = DATA_DIR / "exports"  # فولدر الفيديوهات الجاهزة للنشر
BRAND_DIR = DATA_DIR / "brand"  # اللوجو
TMP_DIR = DATA_DIR / "tmp"
CAROUSELS_DIR = DATA_DIR / "carousels"  # صور الكاروسيلات
ADS_DIR = DATA_DIR / "ads"  # الإعلانات المرجعية وتحليلها، وصور الستايلات
SERIES_DIR = DATA_DIR / "series"  # المسلسلات: صور الشخصية، وصوت ولقطات كل حلقة
BRAND_REFS_DIR = DATA_DIR / "brand" / "refs"  # (قديم) صور الشخصيات، اتنقلت لمكتبة الكاروسيل
LIBRARY_DIR = DATA_DIR / "brand" / "library"  # مكتبة الكاروسيل: تيمبليتس وشخصيات
DB_PATH = DATA_DIR / "studiomania.db"
FRONTEND_DIR = ROOT / "frontend"
FONTS_DIR = ROOT / "fonts"

for d in (RAW_DIR, CLIPS_DIR, COACHES_DIR, GENERATED_DIR, AUDIO_DIR, EXPORTS_DIR, BRAND_DIR, TMP_DIR, CAROUSELS_DIR, BRAND_REFS_DIR, LIBRARY_DIR, SERIES_DIR, ADS_DIR):
    d.mkdir(parents=True, exist_ok=True)

# الكابشن بيدوّر على الخطوط عن طريق fontconfig، والسيرفر (Railway) مفيهوش إعداداته خالص.
# فبنعمل ملف إعدادات صغير يشاور على فولدر الخطوط بتاعنا، وكل أوامر FFmpeg بتستخدمه.
FONTCONFIG_FILE = TMP_DIR / "fonts.conf"
FONTCONFIG_FILE.write_text(
    '<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n'
    f"  <dir>{xml_escape(str(FONTS_DIR))}</dir>\n"
    f"  <cachedir>{xml_escape(str(TMP_DIR / 'fontcache'))}</cachedir>\n"
    "</fontconfig>\n",
    encoding="utf-8",
)
os.environ["FONTCONFIG_FILE"] = str(FONTCONFIG_FILE)


def ffmpeg_exe() -> str:
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError as exc:
        raise RuntimeError("ffmpeg غير موجود. ثبّته أو ثبّت الحزمة imageio-ffmpeg") from exc


def probe_duration(path: Path) -> float:
    """يرجّع طول الفيديو بالثواني من مخرجات ffmpeg."""
    result = subprocess.run(
        [ffmpeg_exe(), "-hide_banner", "-i", str(path)],
        capture_output=True,
        text=True,
    )
    match = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", result.stderr)
    if not match:
        raise ValueError("تعذّر قراءة طول الفيديو")
    h, m, s = match.groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with closing(db()) as conn, conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS videos (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                filename TEXT NOT NULL,
                duration REAL NOT NULL,
                cuts TEXT NOT NULL DEFAULT '[]',
                skipped TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS clips (
                id TEXT PRIMARY KEY,
                video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
                idx INTEGER NOT NULL,
                start REAL NOT NULL,
                end REAL NOT NULL,
                filename TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS prompts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                text TEXT NOT NULL,
                is_default INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS audio (
                id TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                name TEXT NOT NULL,
                filename TEXT NOT NULL,
                duration REAL NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                data TEXT NOT NULL,
                render_status TEXT NOT NULL DEFAULT 'idle',
                render_error TEXT,
                export_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS exports (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                filename TEXT NOT NULL,
                duration REAL NOT NULL,
                source TEXT NOT NULL,
                project_id TEXT,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY,
                export_id TEXT NOT NULL,
                caption TEXT NOT NULL,
                platforms TEXT NOT NULL,
                scheduled_at TEXT NOT NULL,
                status TEXT NOT NULL,
                error TEXT,
                published_at TEXT,
                remote_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS coaches (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                image_filename TEXT NOT NULL,
                outro_filename TEXT,
                outro_duration REAL,
                created_at TEXT NOT NULL
            );
            -- بنحفظ نسخة من بيانات القطعة والمدرب عشان السجل يفضل لو اتمسحوا
            CREATE TABLE IF NOT EXISTS generations (
                id TEXT PRIMARY KEY,
                clip_id TEXT NOT NULL,
                clip_filename TEXT NOT NULL,
                clip_label TEXT NOT NULL,
                coach_id TEXT NOT NULL,
                coach_name TEXT NOT NULL,
                coach_image TEXT NOT NULL,
                model TEXT NOT NULL,
                prompt TEXT NOT NULL,
                params TEXT NOT NULL,
                status TEXT NOT NULL,
                prediction_id TEXT,
                error TEXT,
                output_filename TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def segments_for(duration: float, cuts: list[float], skipped: list[float]) -> list[dict]:
    """يحوّل نقط القطع لقائمة قطع. القطعة المستبعدة بتتعرف ببداية وقتها."""
    points = [0.0, *sorted(cuts), duration]
    skipped_keys = {round(s, 2) for s in skipped}
    segs = []
    for i in range(len(points) - 1):
        start, end = points[i], points[i + 1]
        segs.append(
            {
                "index": i,
                "start": start,
                "end": end,
                "duration": end - start,
                "skipped": round(start, 2) in skipped_keys,
                "too_long": end - start > MAX_CLIP_SECONDS + 1e-6,
            }
        )
    return segs


def video_row_to_dict(row: sqlite3.Row, clips_count: int) -> dict:
    cuts = json.loads(row["cuts"])
    skipped = json.loads(row["skipped"])
    return {
        "id": row["id"],
        "name": row["name"],
        "url": f"/media/raw/{row['filename']}",
        "duration": row["duration"],
        "cuts": cuts,
        "skipped": skipped,
        "segments": segments_for(row["duration"], cuts, skipped),
        "clips_count": clips_count,
        "created_at": row["created_at"],
        "voice": linked_voice(row["voice_id"]),
        "coach": linked_coach(row["coach_id"]),
    }


def linked_coach(coach_id: str | None) -> dict | None:
    if not coach_id:
        return None
    with closing(db()) as conn:
        r = conn.execute("SELECT id, name, image_filename, outro_filename FROM coaches WHERE id = ?", (coach_id,)).fetchone()
    if not r:
        return None
    return {"id": r["id"], "name": r["name"], "image_url": f"/media/coaches/{r['image_filename']}", "has_outro": bool(r["outro_filename"])}


def linked_voice(voice_id: str | None) -> dict | None:
    if not voice_id:
        return None
    with closing(db()) as conn:
        r = conn.execute("SELECT id, name, duration FROM audio WHERE id = ? AND kind = 'voice'", (voice_id,)).fetchone()
    return {"id": r["id"], "name": r["name"], "duration": r["duration"]} if r else None


def get_video(conn: sqlite3.Connection, video_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "الفيديو غير موجود")
    return row


def clips_count(conn: sqlite3.Connection, video_id: str) -> int:
    return conn.execute("SELECT COUNT(*) FROM clips WHERE video_id = ?", (video_id,)).fetchone()[0]


init_db()
with closing(db()) as _conn, _conn:
    if "voice_id" not in {c[1] for c in _conn.execute("PRAGMA table_info(videos)")}:
        _conn.execute("ALTER TABLE videos ADD COLUMN voice_id TEXT")
    _conn.execute(
        """CREATE TABLE IF NOT EXISTS folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            video_id TEXT,
            voice_id TEXT,
            coach_id TEXT,
            created_at TEXT NOT NULL
        )"""
    )
    if "coach_id" not in {c[1] for c in _conn.execute("PRAGMA table_info(videos)")}:
        _conn.execute("ALTER TABLE videos ADD COLUMN coach_id TEXT")
    # كل فيديو متولّد بيفتكر هو من أنهي فيديو خام (عشان الأرشيف)
    if "video_id" not in {c[1] for c in _conn.execute("PRAGMA table_info(generations)")}:
        _conn.execute("ALTER TABLE generations ADD COLUMN video_id TEXT")
        _conn.execute("UPDATE generations SET video_id = (SELECT video_id FROM clips WHERE clips.id = generations.clip_id)")
    # الأرشيف: NULL = لوحده (بعد التصدير)، 1 = اتأرشف بإيدك، 0 = رجّعته بإيدك
    if "archived" not in {c[1] for c in _conn.execute("PRAGMA table_info(videos)")}:
        _conn.execute("ALTER TABLE videos ADD COLUMN archived INTEGER")
    # حسابات المدرب على السوشيال (للتاج في النشر)
    for _col in ("instagram", "tiktok"):
        if _col not in {c[1] for c in _conn.execute("PRAGMA table_info(coaches)")}:
            _conn.execute(f"ALTER TABLE coaches ADD COLUMN {_col} TEXT")
    # دليل الحسابات اللي اتستوردت من ملف (حتى لو المدرب لسه مش في البرنامج)
    _conn.execute(
        """CREATE TABLE IF NOT EXISTS social_handles (
            key TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            instagram TEXT,
            tiktok TEXT
        )"""
    )
    # الإعلانات المرجعية (التحليل والاقتراح للعميل) وستايلات الإعلانات
    _conn.execute(
        """CREATE TABLE IF NOT EXISTS ads (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        )"""
    )
    _conn.execute(
        """CREATE TABLE IF NOT EXISTS ad_brains (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL
        )"""
    )
    _conn.execute(
        """CREATE TABLE IF NOT EXISTS ad_styles (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL
        )"""
    )
    # المسلسلات وحلقاتها (الحلقة: السكريبت والصوت وتوقيت الجمل واللقطات ونسخها)
    _conn.execute(
        """CREATE TABLE IF NOT EXISTS series (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        )"""
    )
    _conn.execute(
        """CREATE TABLE IF NOT EXISTS episodes (
            id TEXT PRIMARY KEY, series_id TEXT NOT NULL, number INTEGER NOT NULL, name TEXT NOT NULL,
            data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        )"""
    )
    # الكاروسيلات: كل واحد بالنقاش والخطة وحالة الصور
    _conn.execute(
        """CREATE TABLE IF NOT EXISTS carousels (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )"""
    )
    # مكتبة الكاروسيل: تيمبليتس (تصميمات نقلدها) وشخصيات 2D، كل واحد بصوره
    _conn.execute(
        """CREATE TABLE IF NOT EXISTS carousel_assets (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            name TEXT NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            files TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL
        )"""
    )
    for _col in ("handle", "seed"):  # حساب إنستجرام (للمدربين) + مفتاح الحزمة اللي اتستورد منها
        if _col not in {c[1] for c in _conn.execute("PRAGMA table_info(carousel_assets)")}:
            _conn.execute(f"ALTER TABLE carousel_assets ADD COLUMN {_col} TEXT")
    # صور الشخصيات القديمة (من الهوية) بتبقى شخصية في المكتبة
    _old_refs = sorted(p for p in BRAND_REFS_DIR.iterdir() if p.is_file())
    if _old_refs:
        _aid = uuid.uuid4().hex[:12]
        (LIBRARY_DIR / _aid).mkdir(parents=True, exist_ok=True)
        for _p in _old_refs:
            shutil.move(str(_p), LIBRARY_DIR / _aid / _p.name)
        _conn.execute(
            "INSERT INTO carousel_assets (id, kind, name, files, created_at) VALUES (?, 'character', ?, ?, ?)",
            (_aid, "شخصيات كوتشي", json.dumps([p.name for p in _old_refs]), datetime.now(timezone.utc).isoformat()),
        )
    # لو البرنامج اتقفل وهو بيرسم كاروسيل، الرسم ده وقف
    for _r in _conn.execute("SELECT id, data FROM carousels").fetchall():
        _d = json.loads(_r["data"])
        _changed = False
        if _d["overview"].get("status") == "working":
            _d["overview"].update(status="failed", error="البرنامج اتقفل وهو بيرسم. دوس ارسم تاني")
            _changed = True
        for _s in _d.get("slides", []):
            if _s.get("status") in ("working", "queued"):
                _s.update(status="idle", error=None)
                _changed = True
        if _changed:
            _conn.execute("UPDATE carousels SET data = ? WHERE id = ?", (json.dumps(_d, ensure_ascii=False), _r["id"]))
    # أوتروهات زيادة بتترفع من صفحة المونتاج (غير أوترو المدرب)
    _conn.execute(
        """CREATE TABLE IF NOT EXISTS outros (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            filename TEXT NOT NULL,
            duration REAL NOT NULL,
            coach_id TEXT,
            created_at TEXT NOT NULL
        )"""
    )
    # سكريبت التعليق الصوتي (النص اللي الراوي بيقراه)
    if "script" not in {c[1] for c in _conn.execute("PRAGMA table_info(folders)")}:
        _conn.execute("ALTER TABLE folders ADD COLUMN script TEXT")
    if "transcript" not in {c[1] for c in _conn.execute("PRAGMA table_info(audio)")}:
        _conn.execute("ALTER TABLE audio ADD COLUMN transcript TEXT")
    # لو البرنامج اتقفل وهو بيكتب الكلام، نعلّمه كفاشل عشان تعيد
    for _r in _conn.execute("""SELECT id FROM audio WHERE transcript LIKE '%"status": "working"%'""").fetchall():
        _conn.execute(
            "UPDATE audio SET transcript = ? WHERE id = ?",
            (json.dumps({"status": "failed", "error": "البرنامج اتقفل أثناء الكتابة. جرّب تاني", "words": []}), _r[0]),
        )
with closing(db()) as _conn, _conn:
    # أي فيديو خام مالوش فولدر بيبقى ليه فولدر بنفس اسمه
    for _v in _conn.execute(
        "SELECT * FROM videos WHERE id NOT IN (SELECT video_id FROM folders WHERE video_id IS NOT NULL)"
    ).fetchall():
        _conn.execute(
            "INSERT INTO folders (id, name, video_id, voice_id, coach_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (uuid.uuid4().hex[:12], _v["name"], _v["id"], _v["voice_id"], _v["coach_id"], _v["created_at"]),
        )
auth = Auth(DB_PATH, DATA_DIR)
app = FastAPI(title="StudioMania")

# الصفحات والملفات اللي بتفتح من غير دخول
PUBLIC_PATHS = {"/login", "/login.html", "/style.css", "/i18n.js", "/i18n-en.js", "/health", "/api/auth/state", "/api/auth/login", "/api/auth/setup"}


# ملفات الواجهة: كل تحديث ليه رقم نسخة جديد عشان المتصفح ميفضلش شغال بالقديم
_asset_versions: dict[str, tuple[float, str]] = {}


def asset_version(name: str) -> str:
    path = FRONTEND_DIR / name
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return "0"
    cached = _asset_versions.get(name)
    if not cached or cached[0] != mtime:
        cached = (mtime, hashlib.sha1(path.read_bytes()).hexdigest()[:10])
        _asset_versions[name] = cached
    return cached[1]


def html_page(name: str) -> Response:
    """الصفحة بروابط الملفات فيها رقم النسخة، ومن غير كاش."""
    html = (FRONTEND_DIR / name).read_text(encoding="utf-8")
    html = re.sub(
        r'((?:src|href)=")/([\w.-]+\.(?:js|css))"',
        lambda m: f'{m.group(1)}/{m.group(2)}?v={asset_version(m.group(2))}"',
        html,
    )
    return Response(html, media_type="text/html; charset=utf-8", headers={"Cache-Control": "no-cache"})


_gzip_cache: dict[str, tuple[float, bytes]] = {}


def gzipped_asset(request: Request) -> Response | None:
    """ملفات الـ JS والـ CSS مضغوطة (أصغر 4 مرات تقريبًا، فالصفحة بتفتح أسرع)."""
    path = request.url.path
    if not path.endswith((".js", ".css")) or "gzip" not in request.headers.get("accept-encoding", ""):
        return None
    file = (FRONTEND_DIR / path.lstrip("/")).resolve()
    if file.parent != FRONTEND_DIR.resolve() or not file.is_file():
        return None
    mtime = file.stat().st_mtime
    cached = _gzip_cache.get(path)
    if not cached or cached[0] != mtime:
        cached = (mtime, gzip.compress(file.read_bytes(), 6))
        _gzip_cache[path] = cached
    return Response(
        cached[1],
        media_type="text/css" if path.endswith(".css") else "text/javascript",
        headers={
            "Content-Encoding": "gzip", "Vary": "Accept-Encoding",
            "Cache-Control": "public, max-age=31536000, immutable" if request.query_params.get("v") else "no-cache",
        },
    )


@app.middleware("http")
async def require_login(request: Request, call_next):
    path = request.url.path
    if path in PUBLIC_PATHS or auth.valid_token(request.cookies.get(SESSION_COOKIE)):
        if (fast := gzipped_asset(request)) is not None:
            return fast
        response = await call_next(request)
        # ملفات الواجهة: اللي برقم نسخة تتخزن، والباقي يتأكد كل مرة إنه آخر نسخة
        if not path.startswith(("/api/", "/media/", "/fonts/")) and "cache-control" not in response.headers:
            response.headers["Cache-Control"] = (
                "public, max-age=31536000, immutable" if request.query_params.get("v") else "no-cache"
            )
        return response
    if path.startswith("/api/"):
        return JSONResponse({"detail": "لازم تسجّل دخول"}, status_code=401)
    return RedirectResponse("/login")


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/login")
@app.get("/login.html")
def login_page():
    return html_page("login.html")


class PasswordIn(BaseModel):
    password: str


def session_response(request: Request) -> JSONResponse:
    resp = JSONResponse({"ok": True})
    secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    resp.set_cookie(
        SESSION_COOKIE, auth.make_token(), max_age=SESSION_DAYS * 86400,
        httponly=True, samesite="lax", secure=secure,
    )
    return resp


@app.get("/api/auth/state")
def auth_state(request: Request):
    return {
        "needs_setup": auth.needs_setup(),
        "logged_in": auth.valid_token(request.cookies.get(SESSION_COOKIE)),
    }


@app.post("/api/auth/setup")
def auth_setup(body: PasswordIn, request: Request):
    if not auth.needs_setup():
        raise HTTPException(400, "الباسورد متعمل قبل كده")
    if len(body.password) < 8:
        raise HTTPException(400, "الباسورد لازم يكون 8 حروف أو أرقام على الأقل")
    auth.set_password(body.password)
    return session_response(request)


@app.post("/api/auth/login")
def auth_login(body: PasswordIn, request: Request):
    if auth.needs_setup():
        raise HTTPException(400, "لسه مفيش باسورد، اعمل واحد الأول")
    if not auth.check_password(body.password):
        time.sleep(1)  # يبطّأ أي حد بيجرّب باسوردات كتير
        raise HTTPException(401, "الباسورد غلط")
    return session_response(request)


@app.post("/api/auth/logout")
def auth_logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(SESSION_COOKIE)
    return resp


class ChangePasswordIn(BaseModel):
    current: str
    new: str


@app.post("/api/auth/password")
def change_password(body: ChangePasswordIn, request: Request):
    if auth.env_password():
        raise HTTPException(400, "الباسورد متحدد من إعدادات السيرفر (APP_PASSWORD)، غيّره من هناك")
    if not auth.check_password(body.current):
        raise HTTPException(400, "الباسورد الحالي غلط")
    if len(body.new) < 8:
        raise HTTPException(400, "الباسورد الجديد لازم يكون 8 حروف أو أرقام على الأقل")
    auth.set_password(body.new)
    return session_response(request)


# ---------------------------------------------------------------- الإعدادات


@app.get("/api/settings")
def get_settings():
    return {"keys": auth.keys_state(), "password_from_env": bool(auth.env_password())}


class SettingsIn(BaseModel):
    atlas: str | None = None  # None = متغيرش، "" = امسح
    zernio: str | None = None


@app.put("/api/settings")
def save_settings(body: SettingsIn):
    for name in ("atlas", "zernio"):
        value = getattr(body, name)
        if value is not None:
            auth.save_key(name, value)
    return get_settings()


@app.get("/api/config")
def config():
    return {"max_clip_seconds": MAX_CLIP_SECONDS, "min_cut_gap": MIN_CUT_GAP}


@app.get("/api/videos")
def list_videos():
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM videos ORDER BY created_at DESC").fetchall()
        return [video_row_to_dict(r, clips_count(conn, r["id"])) for r in rows]


def store_video(file: UploadFile) -> str:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in VIDEO_EXTENSIONS:
        raise HTTPException(400, f"نوع الملف غير مدعوم: {ext or 'بدون امتداد'}")
    video_id = uuid.uuid4().hex[:12]
    filename = f"{video_id}{ext}"
    dest = RAW_DIR / filename
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    try:
        duration = probe_duration(dest)
    except ValueError as exc:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, str(exc)) from exc
    with closing(db()) as conn, conn:
        conn.execute(
            "INSERT INTO videos (id, name, filename, duration, created_at) VALUES (?, ?, ?, ?, ?)",
            (video_id, Path(file.filename).stem, filename, duration, now()),
        )
    return video_id


def remove_video(conn: sqlite3.Connection, video_id: str) -> None:
    row = conn.execute("SELECT filename FROM videos WHERE id = ?", (video_id,)).fetchone()
    if row is None:
        return
    for clip in conn.execute("SELECT filename FROM clips WHERE video_id = ?", (video_id,)):
        (CLIPS_DIR / clip["filename"]).unlink(missing_ok=True)
    conn.execute("DELETE FROM videos WHERE id = ?", (video_id,))
    conn.execute("UPDATE folders SET video_id = NULL WHERE video_id = ?", (video_id,))
    (RAW_DIR / row["filename"]).unlink(missing_ok=True)


@app.post("/api/videos")
def upload_video(file: UploadFile = File(...)):
    video_id = store_video(file)
    with closing(db()) as conn, conn:
        v = get_video(conn, video_id)
        conn.execute(
            "INSERT INTO folders (id, name, video_id, created_at) VALUES (?, ?, ?, ?)",
            (uuid.uuid4().hex[:12], v["name"], video_id, now()),
        )
        return video_row_to_dict(v, 0)


class CutsIn(BaseModel):
    cuts: list[float]
    skipped: list[float] = []


@app.put("/api/videos/{video_id}/cuts")
def save_cuts(video_id: str, body: CutsIn):
    with closing(db()) as conn, conn:
        row = get_video(conn, video_id)
        duration = row["duration"]
        cuts: list[float] = []
        for c in sorted(body.cuts):
            if c < MIN_CUT_GAP or c > duration - MIN_CUT_GAP:
                continue
            if cuts and c - cuts[-1] < MIN_CUT_GAP:
                continue
            cuts.append(round(c, 3))
        starts = {round(s["start"], 2) for s in segments_for(duration, cuts, [])}
        skipped = sorted({round(s, 2) for s in body.skipped} & starts)
        conn.execute(
            "UPDATE videos SET cuts = ?, skipped = ? WHERE id = ?",
            (json.dumps(cuts), json.dumps(skipped), video_id),
        )
        return video_row_to_dict(get_video(conn, video_id), clips_count(conn, video_id))


class VoiceLinkIn(BaseModel):
    voice_id: str | None = None


@app.put("/api/videos/{video_id}/voice")
def link_voice(video_id: str, body: VoiceLinkIn):
    """يربط الفيديو الخام بتسجيل صوتي من المكتبة (أو يفك الربط لو فاضي)."""
    with closing(db()) as conn, conn:
        get_video(conn, video_id)
        if body.voice_id and not conn.execute(
            "SELECT 1 FROM audio WHERE id = ? AND kind = 'voice'", (body.voice_id,)
        ).fetchone():
            raise HTTPException(400, "التسجيل الصوتي مش موجود في المكتبة")
        conn.execute("UPDATE videos SET voice_id = ? WHERE id = ?", (body.voice_id or None, video_id))
        conn.execute("UPDATE folders SET voice_id = ? WHERE video_id = ?", (body.voice_id or None, video_id))
        return video_row_to_dict(get_video(conn, video_id), clips_count(conn, video_id))


class CoachLinkIn(BaseModel):
    coach_id: str | None = None


@app.put("/api/videos/{video_id}/coach")
def link_coach(video_id: str, body: CoachLinkIn):
    """يربط الفيديو الخام بمدرب: صورته للتوليد والأوترو بتاعه للمونتاج."""
    with closing(db()) as conn, conn:
        get_video(conn, video_id)
        if body.coach_id:
            get_coach(conn, body.coach_id)
        conn.execute("UPDATE videos SET coach_id = ? WHERE id = ?", (body.coach_id or None, video_id))
        conn.execute("UPDATE folders SET coach_id = ? WHERE video_id = ?", (body.coach_id or None, video_id))
        return video_row_to_dict(get_video(conn, video_id), clips_count(conn, video_id))


@app.get("/api/videos/{video_id}/montage-draft")
def montage_draft(video_id: str, coach_id: str | None = None):
    """يجمّع آخر فيديو مولَّد لكل قطعة من الفيديو ده بالترتيب، ومعاه الصوت المربوط."""
    with closing(db()) as conn:
        video = get_video(conn, video_id)
        # المدرب المربوط بالفيديو هو الأساس، إلا لو اتحدد غيره
        coach_id = coach_id or video["coach_id"]
        clips = conn.execute("SELECT id, idx FROM clips WHERE video_id = ? ORDER BY idx", (video_id,)).fetchall()
        chosen, missing = [], []
        for c in clips:
            query = "SELECT id, coach_id, output_filename FROM generations WHERE clip_id = ? AND status = 'completed'"
            args: list = [c["id"]]
            if coach_id:
                query += " AND coach_id = ?"
                args.append(coach_id)
            gens = conn.execute(query + " ORDER BY created_at DESC", args).fetchall()
            gen = next((g for g in gens if g["output_filename"] and (GENERATED_DIR / g["output_filename"]).exists()), None)
            if gen:
                chosen.append(gen)
            else:
                missing.append(c["idx"])
    if not coach_id and chosen:
        coach_id = chosen[-1]["coach_id"]
    voice = linked_voice(video["voice_id"])
    return {
        "video_id": video_id,
        "name": video["name"],
        "coach_id": coach_id,
        "gen_ids": [g["id"] for g in chosen],
        "missing": missing,
        "clips_total": len(clips),
        "voice": voice,
    }


@app.delete("/api/videos/{video_id}")
def delete_video(video_id: str):
    with closing(db()) as conn, conn:
        get_video(conn, video_id)
        remove_video(conn, video_id)
    return {"ok": True}


@app.post("/api/videos/{video_id}/split")
def split_video(video_id: str):
    """يقطع الفيديو لقطع. يرفض لو فيه قطعة أطول من 15 ثانية."""
    with closing(db()) as conn:
        row = get_video(conn, video_id)
        segs = [
            s
            for s in segments_for(row["duration"], json.loads(row["cuts"]), json.loads(row["skipped"]))
            if not s["skipped"]
        ]
    if not segs:
        raise HTTPException(400, "كل القطع مستبعدة، مفيش حاجة تتقطع")
    too_long = [s["index"] + 1 for s in segs if s["too_long"]]
    if too_long:
        raise HTTPException(
            400,
            f"فيه قطع أطول من {MAX_CLIP_SECONDS:g} ثانية (رقم {', '.join(map(str, too_long))}). عدّلها الأول.",
        )

    source = RAW_DIR / row["filename"]
    produced = []
    try:
        for n, seg in enumerate(segs, start=1):
            clip_id = uuid.uuid4().hex[:12]
            filename = f"{video_id}_{n:02d}_{clip_id}.mp4"
            cmd = [
                ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y",
                "-ss", f"{seg['start']:.3f}", "-i", str(source), "-t", f"{seg['duration']:.3f}",
                "-map", "0:v:0", "-map", "0:a:0?",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
                str(CLIPS_DIR / filename),
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                raise RuntimeError(result.stderr.strip()[-500:])
            produced.append((clip_id, n, seg["start"], seg["end"], filename))
    except RuntimeError as exc:
        for p in produced:
            (CLIPS_DIR / p[4]).unlink(missing_ok=True)
        raise HTTPException(500, f"فشل التقطيع: {exc}") from exc

    with closing(db()) as conn, conn:
        # التقطيع الجديد بيستبدل القطع القديمة لنفس الفيديو
        for old in conn.execute("SELECT filename FROM clips WHERE video_id = ?", (video_id,)):
            (CLIPS_DIR / old["filename"]).unlink(missing_ok=True)
        conn.execute("DELETE FROM clips WHERE video_id = ?", (video_id,))
        conn.executemany(
            "INSERT INTO clips (id, video_id, idx, start, end, filename, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [(cid, video_id, n, s, e, f, now()) for cid, n, s, e, f in produced],
        )
    return {"clips_count": len(produced)}


@app.get("/api/clips")
def list_clips(video_id: str | None = None):
    query = (
        "SELECT c.*, v.name AS video_name, v.coach_id AS video_coach_id FROM clips c JOIN videos v ON v.id = c.video_id"
        + (" WHERE c.video_id = ?" if video_id else "")
        + " ORDER BY v.created_at DESC, c.idx"
    )
    with closing(db()) as conn:
        rows = conn.execute(query, (video_id,) if video_id else ()).fetchall()
    return [
        {
            "id": r["id"],
            "video_id": r["video_id"],
            "video_name": r["video_name"],
            "video_coach_id": r["video_coach_id"],
            "index": r["idx"],
            "start": r["start"],
            "end": r["end"],
            "duration": r["end"] - r["start"],
            "url": f"/media/clips/{r['filename']}",
        }
        for r in rows
    ]


@app.delete("/api/clips/{clip_id}")
def delete_clip(clip_id: str):
    with closing(db()) as conn, conn:
        row = conn.execute("SELECT filename FROM clips WHERE id = ?", (clip_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "القطعة غير موجودة")
        conn.execute("DELETE FROM clips WHERE id = ?", (clip_id,))
    (CLIPS_DIR / row["filename"]).unlink(missing_ok=True)
    return {"ok": True}


# ---------------------------------------------------------------- المدربين


def save_upload(upload: UploadFile, allowed: set[str], folder: Path, prefix: str) -> str:
    ext = Path(upload.filename or "").suffix.lower()
    if ext not in allowed:
        raise HTTPException(400, f"نوع الملف غير مدعوم: {ext or 'بدون امتداد'}")
    filename = f"{prefix}_{uuid.uuid4().hex[:8]}{ext}"
    with (folder / filename).open("wb") as out:
        shutil.copyfileobj(upload.file, out)
    return filename


def save_audio_upload(upload: UploadFile, folder: Path, prefix: str) -> str:
    """أي ملف صوت (أو فيديو، بناخد صوته): المعروف بيتحفظ زي ما هو، والباقي (amr / caf / aiff / wma / 3gp / webm /
    من غير امتداد...) بيتحول لـ m4a. لو FFmpeg ما عرفش يقراه كصوت بنقول كده بوضوح."""
    ext = Path(upload.filename or "").suffix.lower()
    if ext in AUDIO_EXTENSIONS:
        return save_upload(upload, AUDIO_EXTENSIONS, folder, prefix)
    safe_ext = ext if re.fullmatch(r"\.[a-z0-9]{1,6}", ext) else ""
    raw = folder / f"{prefix}_{uuid.uuid4().hex[:8]}.upload{safe_ext}"
    with raw.open("wb") as out:
        shutil.copyfileobj(upload.file, out)
    filename = f"{prefix}_{uuid.uuid4().hex[:8]}.m4a"
    try:
        r = subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw), "-vn", "-map", "0:a:0",
                            "-c:a", "aac", "-b:a", "192k", str(folder / filename)], capture_output=True, text=True, timeout=600)
        if r.returncode != 0 or not (folder / filename).exists() or (folder / filename).stat().st_size < 1000:
            (folder / filename).unlink(missing_ok=True)
            raise HTTPException(400, f"الملف ده ({ext or 'من غير امتداد'}) مفيهوش صوت أقدر أقراه. جرّب mp3 أو m4a أو wav")
    finally:
        raw.unlink(missing_ok=True)
    return filename


def coach_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "image_url": f"/media/coaches/{row['image_filename']}",
        "outro_url": f"/media/coaches/{row['outro_filename']}" if row["outro_filename"] else None,
        "outro_duration": row["outro_duration"],
        "instagram": row["instagram"],
        "tiktok": row["tiktok"],
        "created_at": row["created_at"],
    }


def get_coach(conn: sqlite3.Connection, coach_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM coaches WHERE id = ?", (coach_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "المدرب غير موجود")
    return row


def save_outro(outro: UploadFile, coach_id: str) -> tuple[str, float]:
    filename = save_upload(outro, VIDEO_EXTENSIONS, COACHES_DIR, f"{coach_id}_outro")
    try:
        return filename, probe_duration(COACHES_DIR / filename)
    except ValueError as exc:
        (COACHES_DIR / filename).unlink(missing_ok=True)
        raise HTTPException(400, f"الأوترو: {exc}") from exc


@app.get("/api/coaches")
def list_coaches():
    with closing(db()) as conn:
        return [coach_to_dict(r) for r in conn.execute("SELECT * FROM coaches ORDER BY name")]


def coach_handles(instagram: str | None, tiktok: str | None) -> dict[str, str | None]:
    """الحسابات اللي اتكتبت (اللي مش مبعوت بيفضل زي ما هو)."""
    out = {}
    for col, value in (("instagram", instagram), ("tiktok", tiktok)):
        if value is None:
            continue
        handle = sheets.clean_handle(value, col)
        if value.strip() and not handle:
            raise HTTPException(400, f"اسم حساب {'إنستجرام' if col == 'instagram' else 'تيك توك'} مش مظبوط: {value.strip()}")
        out[col] = handle
    return out


@app.post("/api/coaches")
def create_coach(
    name: str = Form(...),
    image: UploadFile = File(...),
    outro: UploadFile | None = File(None),
    instagram: str | None = Form(None),
    tiktok: str | None = Form(None),
):
    name = name.strip()
    if not name:
        raise HTTPException(400, "اكتب اسم المدرب")
    handles = coach_handles(instagram, tiktok)
    coach_id = uuid.uuid4().hex[:12]
    image_filename = save_upload(image, IMAGE_EXTENSIONS, COACHES_DIR, f"{coach_id}_image")
    outro_filename, outro_duration = save_outro(outro, coach_id) if outro and outro.filename else (None, None)
    with closing(db()) as conn, conn:
        conn.execute(
            "INSERT INTO coaches (id, name, image_filename, outro_filename, outro_duration, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (coach_id, name, image_filename, outro_filename, outro_duration, now()),
        )
        # لو الاسم موجود في ملف الحسابات اللي اتستورد، حساباته بتتحط لوحدها
        known = conn.execute("SELECT instagram, tiktok FROM social_handles WHERE key = ?", (sheets.norm_name(name),)).fetchone()
        for col in ("instagram", "tiktok"):
            value = handles.get(col) if col in handles else (known[col] if known else None)
            conn.execute(f"UPDATE coaches SET {col} = ? WHERE id = ?", (value, coach_id))
        return coach_to_dict(get_coach(conn, coach_id))


@app.patch("/api/coaches/{coach_id}")
def update_coach(
    coach_id: str,
    name: str | None = Form(None),
    image: UploadFile | None = File(None),
    outro: UploadFile | None = File(None),
    remove_outro: bool = Form(False),
    instagram: str | None = Form(None),
    tiktok: str | None = Form(None),
):
    with closing(db()) as conn, conn:
        row = get_coach(conn, coach_id)
        old_files = []
        for col, handle in coach_handles(instagram, tiktok).items():
            conn.execute(f"UPDATE coaches SET {col} = ? WHERE id = ?", (handle, coach_id))
        if name is not None and name.strip():
            conn.execute("UPDATE coaches SET name = ? WHERE id = ?", (name.strip(), coach_id))
        if image and image.filename:
            filename = save_upload(image, IMAGE_EXTENSIONS, COACHES_DIR, f"{coach_id}_image")
            conn.execute("UPDATE coaches SET image_filename = ? WHERE id = ?", (filename, coach_id))
            old_files.append(row["image_filename"])
        if outro and outro.filename:
            filename, duration = save_outro(outro, coach_id)
            conn.execute(
                "UPDATE coaches SET outro_filename = ?, outro_duration = ? WHERE id = ?",
                (filename, duration, coach_id),
            )
            old_files.append(row["outro_filename"])
        elif remove_outro:
            conn.execute("UPDATE coaches SET outro_filename = NULL, outro_duration = NULL WHERE id = ?", (coach_id,))
            old_files.append(row["outro_filename"])
        result = coach_to_dict(get_coach(conn, coach_id))
    # الصورة القديمة ممكن تكون مستخدمة في توليد لسه شغال، فبنسيبها لو كده
    with closing(db()) as conn:
        in_use = {r[0] for r in conn.execute("SELECT coach_image FROM generations")}
    for f in old_files:
        if f and f not in in_use:
            (COACHES_DIR / f).unlink(missing_ok=True)
    return result


# ---------- حسابات المدربين على السوشيال (استيراد من ملف) ----------
def _find_col(header: list[str], *words: str) -> int | None:
    for i, h in enumerate(header):
        h = (h or "").strip().lower()
        if any(w in h for w in words):
            return i
    return None


@app.post("/api/coaches/handles/preview")
async def preview_handles(file: UploadFile = File(...)):
    """بيقرا ملف Excel أو CSV فيه أسماء المدربين وحساباتهم، ويطابق كل اسم بمدرب في البرنامج."""
    data = await file.read()
    try:
        rows = sheets.read_table(file.filename or "", data)
    except Exception as exc:  # noqa: BLE001  (ملف بايظ أو مش Excel)
        raise HTTPException(400, f"مش قادر أقرا الملف: {exc}") from exc
    if not rows:
        raise HTTPException(400, "الملف فاضي")
    header = rows[0]
    name_col = _find_col(header, "الاسم", "اسم", "name")
    ig_col = _find_col(header, "إنستقرام", "انستقرام", "إنستجرام", "انستجرام", "instagram", "insta")
    tt_col = _find_col(header, "تيك توك", "تيكتوك", "tiktok")
    if name_col is None or (ig_col is None and tt_col is None):
        raise HTTPException(400, "لازم الملف يبقى فيه عمود للاسم وعمود لإنستجرام أو تيك توك")
    with closing(db()) as conn:
        coaches = [dict(r) for r in conn.execute("SELECT id, name FROM coaches")]
    by_name = {sheets.norm_name(c["name"]): c for c in coaches}
    out = []
    for r in rows[1:]:
        r = r + [""] * (len(header) - len(r))
        name = (r[name_col] or "").strip()
        if not name:
            continue
        raw_ig = r[ig_col].strip() if ig_col is not None else ""
        raw_tt = r[tt_col].strip() if tt_col is not None else ""
        ig, tt = sheets.clean_handle(raw_ig, "instagram"), sheets.clean_handle(raw_tt, "tiktok")
        key = sheets.norm_name(name)
        coach = by_name.get(key) or next(
            (c for k, c in by_name.items() if k and len(k) > 3 and (k in key or key in k)), None
        )
        out.append({
            "name": name, "instagram": ig, "tiktok": tt,
            "bad_instagram": raw_ig if raw_ig and not ig else None,
            "bad_tiktok": raw_tt if raw_tt and not tt else None,
            "coach_id": coach["id"] if coach else None,
        })
    return {"rows": out, "coaches": coaches}


class HandleRow(BaseModel):
    name: str
    instagram: str | None = None
    tiktok: str | None = None
    coach_id: str | None = None


class HandlesIn(BaseModel):
    rows: list[HandleRow]


@app.post("/api/coaches/handles/apply")
def apply_handles(body: HandlesIn):
    updated = 0
    with closing(db()) as conn, conn:
        for r in body.rows:
            ig, tt = sheets.clean_handle(r.instagram, "instagram"), sheets.clean_handle(r.tiktok, "tiktok")
            if not (ig or tt):
                continue
            conn.execute(
                "INSERT INTO social_handles (key, name, instagram, tiktok) VALUES (?, ?, ?, ?) "
                "ON CONFLICT(key) DO UPDATE SET name = excluded.name, "
                "instagram = COALESCE(excluded.instagram, instagram), tiktok = COALESCE(excluded.tiktok, tiktok)",
                (sheets.norm_name(r.name), r.name.strip(), ig, tt),
            )
            if r.coach_id and conn.execute("SELECT 1 FROM coaches WHERE id = ?", (r.coach_id,)).fetchone():
                conn.execute(
                    "UPDATE coaches SET instagram = COALESCE(?, instagram), tiktok = COALESCE(?, tiktok) WHERE id = ?",
                    (ig, tt, r.coach_id),
                )
                updated += 1
    return {"saved": len(body.rows), "coaches_updated": updated}


@app.get("/api/handles")
def list_handles():
    """كل الحسابات المعروفة (المدربين + اللي اتستوردت) عشان الاقتراحات في خانة التاج."""
    with closing(db()) as conn:
        out = [{"name": r["name"], "instagram": r["instagram"], "tiktok": r["tiktok"]}
               for r in conn.execute("SELECT name, instagram, tiktok FROM coaches WHERE instagram IS NOT NULL OR tiktok IS NOT NULL")]
        seen = {h["instagram"] for h in out}
        out += [{"name": r["name"], "instagram": r["instagram"], "tiktok": r["tiktok"]}
                for r in conn.execute("SELECT name, instagram, tiktok FROM social_handles ORDER BY name") if r["instagram"] not in seen]
    return out


@app.delete("/api/coaches/{coach_id}")
def delete_coach(coach_id: str):
    with closing(db()) as conn, conn:
        row = get_coach(conn, coach_id)
        conn.execute("DELETE FROM coaches WHERE id = ?", (coach_id,))
        conn.execute("UPDATE videos SET coach_id = NULL WHERE coach_id = ?", (coach_id,))
        conn.execute("UPDATE folders SET coach_id = NULL WHERE coach_id = ?", (coach_id,))
        in_use = {r[0] for r in conn.execute("SELECT coach_image FROM generations")}
    if row["image_filename"] not in in_use:
        (COACHES_DIR / row["image_filename"]).unlink(missing_ok=True)
    if row["outro_filename"]:
        (COACHES_DIR / row["outro_filename"]).unlink(missing_ok=True)
    return {"ok": True}


# ---------------------------------------------------------------- التوليد بـ Seedance

ACTIVE_STATUSES = ("queued", "uploading", "submitted", "processing", "downloading")
executor = ThreadPoolExecutor(max_workers=3)
_running: set[str] = set()
_running_lock = threading.Lock()


def set_generation(gen_id: str, **fields) -> None:
    fields["updated_at"] = now()
    cols = ", ".join(f"{k} = ?" for k in fields)
    with closing(db()) as conn, conn:
        conn.execute(f"UPDATE generations SET {cols} WHERE id = ?", (*fields.values(), gen_id))


def run_generation(gen_id: str) -> None:
    with _running_lock:
        if gen_id in _running:
            return
        _running.add(gen_id)
    try:
        _run_generation(gen_id)
    except httpx.HTTPError as exc:
        set_generation(gen_id, status="failed", error=f"مقدرتش أوصل لـ Atlas (مشكلة إنترنت أو اتصال): {exc}"[:500])
    except Exception as exc:  # أي خطأ يتسجل على الطلب نفسه بدل ما يضيع
        set_generation(gen_id, status="failed", error=str(exc)[:500])
    finally:
        with _running_lock:
            _running.discard(gen_id)


def _run_generation(gen_id: str) -> None:
    with closing(db()) as conn:
        g = conn.execute("SELECT * FROM generations WHERE id = ?", (gen_id,)).fetchone()
    if g is None:
        return
    clip_path = CLIPS_DIR / g["clip_filename"]
    image_path = COACHES_DIR / g["coach_image"]
    output = f"{gen_id}.mp4"

    def on_status(status: str) -> None:
        set_generation(gen_id, status="processing" if status not in ("completed", "succeeded") else "downloading")

    if atlas.mock_mode():
        if not clip_path.exists():
            raise atlas.AtlasError("ملف القطعة اتمسح")
        set_generation(gen_id, status="submitted", prediction_id=f"mock-{gen_id}")
        atlas.mock_generate(clip_path, GENERATED_DIR / output, on_status)
        set_generation(gen_id, status="completed", output_filename=output, error=None)
        return

    prediction_id = g["prediction_id"]
    if not prediction_id:
        # لسه متبعتش: نرفع الملفات ونبعت الطلب
        if not clip_path.exists():
            raise atlas.AtlasError("ملف القطعة اتمسح (غالبًا الفيديو اتقطّع تاني). اختار القطعة الجديدة وولّد من الأول")
        if not image_path.exists():
            raise atlas.AtlasError("صورة المدرب اتمسحت")
        set_generation(gen_id, status="uploading", error=None)
        clip_url = atlas.upload_media(clip_path)
        image_url = atlas.upload_media(image_path)
        params = json.loads(g["params"])
        body = {
            "model": g["model"],
            "prompt": g["prompt"],
            "reference_images": [image_url],
            "reference_videos": [clip_url],
            "duration": params["duration"],
            "resolution": params["resolution"],
            "ratio": params["ratio"],
            "generate_audio": params["generate_audio"],
            "watermark": False,
        }
        prediction_id = atlas.submit_video(body)
        set_generation(gen_id, status="submitted", prediction_id=prediction_id)

    video_url = atlas.wait_for(prediction_id, on_status)
    set_generation(gen_id, status="downloading")
    atlas.download(video_url, GENERATED_DIR / output)
    set_generation(gen_id, status="completed", output_filename=output, error=None)


def generation_to_dict(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "clip_id": r["clip_id"],
        "video_id": r["video_id"],
        "clip_label": r["clip_label"],
        "clip_url": f"/media/clips/{r['clip_filename']}",
        "coach_id": r["coach_id"],
        "coach_name": r["coach_name"],
        "coach_image_url": f"/media/coaches/{r['coach_image']}",
        "model": r["model"],
        "model_label": atlas.MODEL_LABEL if r["model"] == atlas.MODEL else (r["model"] or "").split("/")[-1],
        "prompt": r["prompt"],
        "params": json.loads(r["params"]),
        "status": r["status"],
        "error": r["error"],
        # ?v= عشان لو الفيديو اتولد تاني بنفس الاسم المتصفح ما يعرضش القديم من الكاش
        "output_url": f"/media/generated/{r['output_filename']}?v={re.sub(r'[^0-9]', '', r['updated_at'] or '')[-10:]}" if r["output_filename"] else None,
        "created_at": r["created_at"],
        "updated_at": r["updated_at"],
    }


@app.get("/api/atlas")
def atlas_status():
    return {
        "configured": bool(atlas.api_key()),
        "mock": atlas.mock_mode(),
        "model_label": atlas.MODEL_LABEL,
        "resolution": atlas.RESOLUTION,
        "ratio": atlas.RATIO,
        "min_duration": atlas.MIN_DURATION,
        "max_duration": atlas.MAX_DURATION,
    }


# ---------------------------------------------------------------- مكتبة البرومبتات

DEFAULT_PROMPT = (
    "@image1 is the coach, a cartoon character. Recreate the exact exercise movement, body mechanics, "
    "tempo and camera framing from @video1, performed by the character from @image1. Keep the character's "
    "face, outfit and art style exactly as in @image1. Full body visible, clean gym background, smooth natural motion."
)


def seed_prompts() -> None:
    with closing(db()) as conn, conn:
        if conn.execute("SELECT COUNT(*) FROM prompts").fetchone()[0] == 0:
            conn.execute(
                "INSERT INTO prompts (id, name, text, is_default, created_at) VALUES (?, ?, ?, 1, ?)",
                (uuid.uuid4().hex[:12], "نفس حركة التمرين", DEFAULT_PROMPT, now()),
            )


seed_prompts()


def prompt_to_dict(r: sqlite3.Row) -> dict:
    return {"id": r["id"], "name": r["name"], "text": r["text"], "is_default": bool(r["is_default"])}


def get_prompt(conn: sqlite3.Connection, prompt_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM prompts WHERE id = ?", (prompt_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "البرومبت غير موجود")
    return row


class PromptIn(BaseModel):
    name: str
    text: str
    is_default: bool = False


def clean_prompt(body: PromptIn) -> tuple[str, str]:
    name, text = body.name.strip(), body.text.strip()
    if not name or not text:
        raise HTTPException(400, "اكتب اسم البرومبت ونصّه")
    return name, text


@app.get("/api/prompts")
def list_prompts():
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM prompts ORDER BY is_default DESC, created_at").fetchall()
    return [prompt_to_dict(r) for r in rows]


@app.post("/api/prompts")
def create_prompt(body: PromptIn):
    name, text = clean_prompt(body)
    prompt_id = uuid.uuid4().hex[:12]
    with closing(db()) as conn, conn:
        if body.is_default:
            conn.execute("UPDATE prompts SET is_default = 0")
        conn.execute(
            "INSERT INTO prompts (id, name, text, is_default, created_at) VALUES (?, ?, ?, ?, ?)",
            (prompt_id, name, text, int(body.is_default), now()),
        )
        return prompt_to_dict(get_prompt(conn, prompt_id))


@app.put("/api/prompts/{prompt_id}")
def update_prompt(prompt_id: str, body: PromptIn):
    name, text = clean_prompt(body)
    with closing(db()) as conn, conn:
        get_prompt(conn, prompt_id)
        if body.is_default:
            conn.execute("UPDATE prompts SET is_default = 0")
        conn.execute(
            "UPDATE prompts SET name = ?, text = ?, is_default = ? WHERE id = ?",
            (name, text, int(body.is_default), prompt_id),
        )
        return prompt_to_dict(get_prompt(conn, prompt_id))


@app.delete("/api/prompts/{prompt_id}")
def delete_prompt(prompt_id: str):
    with closing(db()) as conn, conn:
        get_prompt(conn, prompt_id)
        if conn.execute("SELECT COUNT(*) FROM prompts").fetchone()[0] <= 1:
            raise HTTPException(400, "لازم يفضل برومبت واحد على الأقل")
        conn.execute("DELETE FROM prompts WHERE id = ?", (prompt_id,))
        if not conn.execute("SELECT 1 FROM prompts WHERE is_default = 1").fetchone():
            conn.execute(
                "UPDATE prompts SET is_default = 1 WHERE id = (SELECT id FROM prompts ORDER BY created_at LIMIT 1)"
            )
    return {"ok": True}


# ---------------------------------------------------------------- طلبات التوليد


class GenerationIn(BaseModel):
    clip_ids: list[str]
    coach_id: str | None = None  # لو فاضي: كل قطعة بتاخد مدرب المشروع بتاعها
    prompt_id: str
    generate_audio: bool = False


@app.post("/api/generations")
def create_generations(body: GenerationIn):
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
    if not body.clip_ids:
        raise HTTPException(400, "اختار قطعة واحدة على الأقل")

    with closing(db()) as conn, conn:
        forced = get_coach(conn, body.coach_id) if body.coach_id else None
        prompt_text = get_prompt(conn, body.prompt_id)["text"]
        rows = conn.execute(
            f"SELECT c.*, v.name AS video_name, v.coach_id AS video_coach_id FROM clips c JOIN videos v ON v.id = c.video_id "
            f"WHERE c.id IN ({','.join('?' * len(body.clip_ids))})",
            body.clip_ids,
        ).fetchall()
        if len(rows) != len(set(body.clip_ids)):
            raise HTTPException(400, "فيه قطع مش موجودة. حدّث الصفحة")
        short = [f"{r['video_name']} #{r['idx']}" for r in rows if r["end"] - r["start"] < MIN_REFERENCE_SECONDS]
        if short:
            raise HTTPException(400, f"قطع أقصر من {MIN_REFERENCE_SECONDS:g} ثانية ومينفعش تتبعت: {', '.join(short)}")

        if not forced:
            missing = sorted({r["video_name"] for r in rows if not r["video_coach_id"]})
            if missing:
                raise HTTPException(400, f"مفيش مدرب للمشروع: {'، '.join(missing)}. اختاره من صفحة المشاريع")
        coaches = {}
        ids = []
        for r in rows:
            coach = forced or coaches.get(r["video_coach_id"])
            if coach is None:
                coach = coaches[r["video_coach_id"]] = get_coach(conn, r["video_coach_id"])
            # المدة على قد طول القطعة، في حدود اللي Seedance بيقبله (4 لـ 15 ثانية)
            duration = max(atlas.MIN_DURATION, min(atlas.MAX_DURATION, int(r["end"] - r["start"] + 0.5)))
            gen_id = uuid.uuid4().hex[:12]
            params = {
                "duration": duration,
                "resolution": atlas.RESOLUTION,
                "ratio": atlas.RATIO,
                "generate_audio": body.generate_audio,
            }
            conn.execute(
                "INSERT INTO generations (id, clip_id, clip_filename, clip_label, coach_id, coach_name, coach_image, "
                "model, prompt, params, status, created_at, updated_at, video_id) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)",
                (
                    gen_id, r["id"], r["filename"], f"{r['video_name']} #{r['idx']}",
                    coach["id"], coach["name"], coach["image_filename"],
                    atlas.MODEL, prompt_text, json.dumps(params), now(), now(), r["video_id"],
                ),
            )
            ids.append(gen_id)
    for gen_id in ids:
        executor.submit(run_generation, gen_id)
    return {"created": len(ids)}


@app.get("/api/generations")
def list_generations():
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM generations WHERE clip_id NOT LIKE 'series:%' AND clip_id NOT LIKE 'ad:%' AND clip_id != 'upload' ORDER BY created_at DESC, clip_label").fetchall()
    return [generation_to_dict(r) for r in rows]


# ---------------------------------------------------------------- الأرشيف


def exported_videos(conn: sqlite3.Connection) -> dict[str, str]:
    """الفيديوهات الخام اللي اتعملها مونتاج واتصدّرت: video_id → رابط الفيديو النهائي."""
    out: dict[str, str] = {}
    for p in conn.execute(
        "SELECT p.data, e.filename FROM projects p JOIN exports e ON e.id = p.export_id ORDER BY p.updated_at"
    ).fetchall():
        vid = json.loads(p["data"]).get("video_id")
        if vid:
            out[vid] = f"/media/exports/{p['filename']}"
    return out


@app.get("/api/archive")
def archive_status():
    """حالة كل فيديو: شغال عليه ولا في الأرشيف. اللي اتصدّر بيتأرشف لوحده إلا لو رجّعته."""
    with closing(db()) as conn:
        exported = exported_videos(conn)
        rows = conn.execute("SELECT id, name, archived, created_at FROM videos ORDER BY created_at DESC").fetchall()
    return [
        {
            "video_id": r["id"], "name": r["name"],
            "archived": bool(r["archived"]) if r["archived"] is not None else r["id"] in exported,
            "manual": r["archived"] is not None,
            "exported_url": exported.get(r["id"]),
        }
        for r in rows
    ]


class ArchiveIn(BaseModel):
    archived: bool | None = None  # null = يرجع للتلقائي


@app.put("/api/videos/{video_id}/archive")
def set_archive(video_id: str, body: ArchiveIn):
    with closing(db()) as conn, conn:
        if not conn.execute("SELECT 1 FROM videos WHERE id = ?", (video_id,)).fetchone():
            raise HTTPException(404, "الفيديو غير موجود")
        exported = video_id in exported_videos(conn)
        # لو اللي اخترته هو نفس التلقائي، نسيبه تلقائي
        value = None if body.archived is None or body.archived == exported else int(body.archived)
        conn.execute("UPDATE videos SET archived = ? WHERE id = ?", (value, video_id))
    return {"ok": True}


@app.post("/api/generations/{gen_id}/retry")
def retry_generation(gen_id: str):
    with closing(db()) as conn:
        row = conn.execute("SELECT status FROM generations WHERE id = ?", (gen_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "الطلب غير موجود")
    if row["status"] != "failed":
        raise HTTPException(400, "الطلب ده مش فاشل")
    # لو الطلب كان اتبعت لـ Atlas بنكمّل متابعته بدل ما ندفع تاني
    set_generation(gen_id, status="queued", error=None)
    executor.submit(run_generation, gen_id)
    return {"ok": True}


@app.post("/api/generations/{gen_id}/again")
def generate_again(gen_id: str):
    """توليد جديد لنفس القطعة (نفس المدرب والبرومبت والإعدادات) في نفس مكان القديم: الفيديو القديم بيتمسح
    والطلب نفسه بيتولد من الأول، فالترتيب ما بيتغيرش."""
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
    with closing(db()) as conn:
        r = conn.execute("SELECT * FROM generations WHERE id = ?", (gen_id,)).fetchone()
    if r is None:
        raise HTTPException(404, "الطلب غير موجود")
    if r["clip_id"].startswith("series:") or r["clip_id"] == "upload":
        raise HTTPException(400, "الفيديو ده مش من قطعة مشروع")
    if r["status"] not in ("completed", "failed"):
        raise HTTPException(400, "الفيديو لسه بيتولد")
    with _running_lock:
        if gen_id in _running:
            raise HTTPException(400, "الفيديو لسه بيتولد")
    if r["output_filename"]:
        (GENERATED_DIR / r["output_filename"]).unlink(missing_ok=True)
    set_generation(gen_id, status="queued", prediction_id=None, output_filename=None, error=None)
    executor.submit(run_generation, gen_id)
    return {"id": gen_id}


@app.delete("/api/generations/{gen_id}")
def delete_generation(gen_id: str):
    with closing(db()) as conn, conn:
        row = conn.execute("SELECT output_filename, status FROM generations WHERE id = ?", (gen_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "الطلب غير موجود")
        if row["status"] in ACTIVE_STATUSES:
            raise HTTPException(400, "الطلب لسه شغال، استنى لما يخلص")
        conn.execute("DELETE FROM generations WHERE id = ?", (gen_id,))
    if row["output_filename"]:
        (GENERATED_DIR / row["output_filename"]).unlink(missing_ok=True)
    return {"ok": True}


def resume_generations() -> None:
    """لو البرنامج اتقفل والطلبات شغالة، نكمّلها لما يفتح تاني."""
    with closing(db()) as conn:
        ids = [
            r["id"]
            for r in conn.execute(
                f"SELECT id FROM generations WHERE status IN ({','.join('?' * len(ACTIVE_STATUSES))})",
                ACTIVE_STATUSES,
            )
        ]
    for gen_id in ids:
        executor.submit(run_generation, gen_id)


resume_generations()


# ---------------------------------------------------------------- مكتبات الصوت (التعليق الصوتي والموسيقى)


def audio_to_dict(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "kind": r["kind"],
        "name": r["name"],
        "url": f"/media/audio/{r['filename']}",
        "duration": r["duration"],
        "created_at": r["created_at"],
    }


def check_kind(kind: str) -> str:
    if kind not in AUDIO_KINDS:
        raise HTTPException(400, "نوع مكتبة غير معروف")
    return kind


@app.get("/api/audio")
def list_audio(kind: str):
    check_kind(kind)
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM audio WHERE kind = ? ORDER BY created_at DESC", (kind,)).fetchall()
    return [audio_to_dict(r) for r in rows]


@app.post("/api/audio")
def upload_audio(kind: str = Form(...), file: UploadFile = File(...)):
    check_kind(kind)
    audio_id = uuid.uuid4().hex[:12]
    filename = save_audio_upload(file, AUDIO_DIR, f"{kind}_{audio_id}")
    try:
        duration = probe_duration(AUDIO_DIR / filename)
    except ValueError as exc:
        (AUDIO_DIR / filename).unlink(missing_ok=True)
        raise HTTPException(400, str(exc)) from exc
    with closing(db()) as conn, conn:
        conn.execute(
            "INSERT INTO audio (id, kind, name, filename, duration, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (audio_id, kind, Path(file.filename).stem, filename, duration, now()),
        )
        return audio_to_dict(conn.execute("SELECT * FROM audio WHERE id = ?", (audio_id,)).fetchone())


class RenameIn(BaseModel):
    name: str


@app.patch("/api/audio/{audio_id}")
def rename_audio(audio_id: str, body: RenameIn):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "الاسم فاضي")
    with closing(db()) as conn, conn:
        if conn.execute("UPDATE audio SET name = ? WHERE id = ?", (name, audio_id)).rowcount == 0:
            raise HTTPException(404, "الملف غير موجود")
        return audio_to_dict(conn.execute("SELECT * FROM audio WHERE id = ?", (audio_id,)).fetchone())


@app.delete("/api/audio/{audio_id}")
def delete_audio(audio_id: str):
    with closing(db()) as conn, conn:
        row = conn.execute("SELECT filename FROM audio WHERE id = ?", (audio_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "الملف غير موجود")
        conn.execute("DELETE FROM audio WHERE id = ?", (audio_id,))
        conn.execute("UPDATE videos SET voice_id = NULL WHERE voice_id = ?", (audio_id,))
        conn.execute("UPDATE folders SET voice_id = NULL WHERE voice_id = ?", (audio_id,))
    (AUDIO_DIR / row["filename"]).unlink(missing_ok=True)
    return {"ok": True}


# ---------------------------------------------------------------- المونتاج (الخطوة 6)

_probe_cache: dict[str, montage.MediaInfo] = {}


def media_info(path: Path) -> montage.MediaInfo:
    key = f"{path}:{path.stat().st_mtime}"
    if key not in _probe_cache:
        _probe_cache[key] = montage.probe(ffmpeg_exe(), path)
    return _probe_cache[key]


OUTRO_PREFIX = "outro:"  # قطعة في المونتاج من أوترو مدرب: gen_id = "outro:<coach id>"
EXTRA_OUTRO_PREFIX = "xoutro:"  # أوترو زيادة اترفع من المونتاج: gen_id = "xoutro:<outro id>"
ANY_OUTRO = (OUTRO_PREFIX, EXTRA_OUTRO_PREFIX)


def clip_source(conn: sqlite3.Connection, gen_id: str) -> Path | None:
    if gen_id.startswith(OUTRO_PREFIX):
        row = conn.execute("SELECT outro_filename AS f FROM coaches WHERE id = ?", (gen_id[len(OUTRO_PREFIX):],)).fetchone()
        base = COACHES_DIR
    elif gen_id.startswith(EXTRA_OUTRO_PREFIX):
        row = conn.execute("SELECT filename AS f FROM outros WHERE id = ?", (gen_id[len(EXTRA_OUTRO_PREFIX):],)).fetchone()
        base = COACHES_DIR
    else:
        row = conn.execute("SELECT output_filename AS f FROM generations WHERE id = ?", (gen_id,)).fetchone()
        base = GENERATED_DIR
    if row is None or not row["f"] or not (base / row["f"]).exists():
        return None
    return base / row["f"]


@app.post("/api/montage/upload")
def montage_upload(file: UploadFile = File(...), coach_id: str = Form(""), replace: str = Form("")):
    """فيديو من عندك للمونتاج. لو بيبدّل قطعة جاية من لقطة في مسلسل، بيتضاف كمان نسخة على اللقطة دي (موافق عليها)."""
    name = save_upload(file, VIDEO_EXTENSIONS, GENERATED_DIR, "upload")
    path = GENERATED_DIR / name
    try:
        info = media_info(path)
    except Exception as exc:  # noqa: BLE001
        path.unlink(missing_ok=True)
        raise HTTPException(400, f"مقدرتش أقرا الفيديو: {exc}") from exc
    gid = uuid.uuid4().hex[:12]
    label = f"⬆ {Path(file.filename or 'video').stem}"
    link = {}
    with closing(db()) as conn, conn:
        if replace:
            row = conn.execute("SELECT clip_label, params FROM generations WHERE id = ?", (replace,)).fetchone()
            if row:
                try:
                    link = json.loads(row["params"] or "{}")
                except ValueError:
                    link = {}
                label = f"{row['clip_label']} ⬆"
        conn.execute(
            "INSERT INTO generations (id, clip_id, clip_filename, clip_label, coach_id, coach_name, coach_image, model, prompt, "
            "params, status, output_filename, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '', '', 'upload', '', ?, 'completed', ?, ?, ?)",
            (gid, f"series:{link['episode']}" if link.get("episode") else "upload", file.filename or name, label, coach_id,
             json.dumps(link), name, now(), now()),
        )
    synced = None
    if link.get("episode") and link.get("shot"):
        eid, sid = link["episode"], link["shot"]
        try:
            tname = f"take_{uuid.uuid4().hex[:10]}{path.suffix}"
            shutil.copyfile(path, ep_dir(eid) / "takes" / tname)
            tid = uuid.uuid4().hex[:10]
            def fn(d):
                sh = find_shot(d, sid)
                d["takes"][tid] = {"id": tid, "file": tname, "source": "upload", "status": "done", "error": None, "approved": True,
                                   "duration": round(info.duration, 2), "name": file.filename, "created_at": now()}
                sh["takes"].append(tid)
                sh["chosen"], sh["offset"] = tid, 0.0
            update_episode(eid, fn)
            synced = sid
        except HTTPException:
            synced = None
    return {"id": gid, "duration": info.duration, "synced_shot": synced}


@app.get("/api/montage/sources")
def montage_sources():
    """الفيديوهات المولَّدة الجاهزة اللي ينفع تدخل المونتاج."""
    with closing(db()) as conn:
        rows = conn.execute(
            "SELECT * FROM generations WHERE status = 'completed' AND output_filename IS NOT NULL ORDER BY created_at DESC"
        ).fetchall()
    out = []
    for r in rows:
        path = GENERATED_DIR / r["output_filename"]
        if not path.exists():
            continue
        out.append(
            {
                "id": r["id"],
                "label": r["clip_label"],
                "coach_id": r["coach_id"],
                "coach_name": r["coach_name"],
                "url": f"/media/generated/{r['output_filename']}",
                "duration": media_info(path).duration,
                "has_audio": media_info(path).has_audio,
            }
        )
    # أوترو كل مدرب بيدخل المونتاج كقطعة عادية (تتقص وتتحرك وتتقسم)
    with closing(db()) as conn:
        for c in conn.execute("SELECT id, name, outro_filename FROM coaches WHERE outro_filename IS NOT NULL ORDER BY name"):
            path = COACHES_DIR / c["outro_filename"]
            if not path.exists():
                continue
            info = media_info(path)
            out.append({
                "id": f"{OUTRO_PREFIX}{c['id']}", "kind": "outro", "label": f"🎬 أوترو {c['name']}",
                "coach_id": c["id"], "coach_name": c["name"], "url": f"/media/coaches/{c['outro_filename']}",
                "duration": info.duration, "has_audio": info.has_audio,
            })
        for o in conn.execute("SELECT * FROM outros ORDER BY created_at DESC"):
            path = COACHES_DIR / o["filename"]
            if not path.exists():
                continue
            info = media_info(path)
            out.append({
                "id": f"{EXTRA_OUTRO_PREFIX}{o['id']}", "kind": "outro", "extra": True, "label": f"🎬 {o['name']}",
                "coach_id": o["coach_id"], "url": f"/media/coaches/{o['filename']}",
                "duration": info.duration, "has_audio": info.has_audio,
            })
    return out


@app.post("/api/outros")
def upload_outro(name: str = Form(""), coach_id: str = Form(""), file: UploadFile = File(...)):
    """أوترو زيادة من صفحة المونتاج. بيظهر مع الفيديوهات ويتحط في التايم لاين زي أي قطعة."""
    outro_id = uuid.uuid4().hex[:12]
    filename = save_upload(file, VIDEO_EXTENSIONS, COACHES_DIR, f"{outro_id}_xoutro")
    try:
        duration = probe_duration(COACHES_DIR / filename)
    except ValueError as exc:
        (COACHES_DIR / filename).unlink(missing_ok=True)
        raise HTTPException(400, f"الأوترو: {exc}") from exc
    name = name.strip() or Path(file.filename or "").stem or "أوترو"
    with closing(db()) as conn, conn:
        if coach_id and not conn.execute("SELECT 1 FROM coaches WHERE id = ?", (coach_id,)).fetchone():
            coach_id = ""
        conn.execute(
            "INSERT INTO outros (id, name, filename, duration, coach_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (outro_id, name, filename, duration, coach_id or None, now()),
        )
    return {"id": f"{EXTRA_OUTRO_PREFIX}{outro_id}", "name": name, "duration": duration}


@app.delete("/api/outros/{outro_id}")
def delete_outro(outro_id: str):
    outro_id = outro_id.removeprefix(EXTRA_OUTRO_PREFIX)
    gen_id = f"{EXTRA_OUTRO_PREFIX}{outro_id}"
    with closing(db()) as conn, conn:
        row = conn.execute("SELECT filename FROM outros WHERE id = ?", (outro_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "الأوترو غير موجود")
        used = [p["name"] for p in conn.execute("SELECT name, data FROM projects").fetchall()
                if any(c.get("gen_id") == gen_id for c in json.loads(p["data"]).get("clips", []))]
        if used:
            raise HTTPException(400, f"الأوترو ده مستخدم في: {'، '.join(used)}. شيله من المونتاج الأول")
        conn.execute("DELETE FROM outros WHERE id = ?", (outro_id,))
    (COACHES_DIR / row["filename"]).unlink(missing_ok=True)
    return {"ok": True}


# صورة صغيرة من الفيديو بدل ما القوايم تحمّل الفيديوهات نفسها (أخف بكتير على الجهاز)
THUMB_DIRS = {"raw": RAW_DIR, "clips": CLIPS_DIR, "generated": GENERATED_DIR, "exports": EXPORTS_DIR, "coaches": COACHES_DIR}


@app.get("/api/thumb")
def video_thumb(src: str):
    parts = src.split("?")[0].split("#")[0].strip("/").split("/")
    if len(parts) == 4 and parts[:2] == ["media", "export"]:
        # رابط الفولدر الجاهز: /media/export/<id>/<اسم>
        with closing(db()) as conn:
            row = conn.execute("SELECT filename FROM exports WHERE id = ?", (parts[2],)).fetchone()
        path = EXPORTS_DIR / row["filename"] if row else None
    elif len(parts) == 3 and parts[0] == "media" and parts[1] in THUMB_DIRS and "/" not in parts[2] and ".." not in parts[2]:
        path = THUMB_DIRS[parts[1]] / parts[2]
    elif (len(parts) == 6 and parts[:3] == ["media", "series", "episodes"] and parts[4] == "takes"
          and all(re.fullmatch(r"[\w.-]+", x) and ".." not in x for x in (parts[3], parts[5]))):
        # نسخ لقطات المسلسل: /media/series/episodes/<الحلقة>/takes/<الملف>
        path = SERIES_DIR / "episodes" / parts[3] / "takes" / parts[5]
    else:
        raise HTTPException(400, "رابط غلط")
    if path is None or not path.is_file():
        raise HTTPException(404, "الفيديو غير موجود")
    out = TMP_DIR / "thumbs" / f"{path.parent.parent.name if path.parent.name == 'takes' else path.parent.name}-{path.stem}-{int(path.stat().st_mtime)}.jpg"
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        part = out.with_suffix(".part.jpg")
        at = "0.5" if media_info(path).duration > 1 else "0"
        result = subprocess.run(
            [ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-ss", at, "-i", str(path),
             "-frames:v", "1", "-vf", "scale=-2:360", "-q:v", "6", str(part)],
            capture_output=True, text=True,
        )
        if result.returncode != 0 or not part.exists():
            raise HTTPException(500, "مش قادر أعمل صورة للفيديو")
        part.replace(out)
    return FileResponse(out, media_type="image/jpeg", headers={"Cache-Control": "max-age=604800"})


THUMB_FPS = 2  # كام صورة في الثانية في شريط الصور بتاع التايم لاين
THUMB_HEIGHT = 128


@app.get("/api/montage/filmstrip")
def montage_filmstrip(kind: str, id: str):
    """شريط صور صغيرة من الفيديو (صورتين في الثانية) عشان التايم لاين."""
    with closing(db()) as conn:
        if kind == "gen":
            row = conn.execute("SELECT output_filename AS f FROM generations WHERE id = ?", (id,)).fetchone()
            base = GENERATED_DIR
        elif kind == "outro":
            row = conn.execute("SELECT outro_filename AS f FROM coaches WHERE id = ?", (id,)).fetchone()
            base = COACHES_DIR
        elif kind == "xoutro":
            row = conn.execute("SELECT filename AS f FROM outros WHERE id = ?", (id.removeprefix(EXTRA_OUTRO_PREFIX),)).fetchone()
            base = COACHES_DIR
        elif kind == "raw":
            row = conn.execute("SELECT filename AS f FROM videos WHERE id = ?", (id,)).fetchone()
            base = RAW_DIR
        else:
            raise HTTPException(400, "نوع غلط")
    if row is None or not row["f"] or not (base / row["f"]).exists():
        raise HTTPException(404, "الفيديو غير موجود")
    src = base / row["f"]
    info = media_info(src)
    # الفيديو الخام ممكن يبقى طويل: نقلل الصور عشان الصورة متعدّيش حدود الـ JPEG
    thumb_fps, height = THUMB_FPS, THUMB_HEIGHT
    if kind == "raw":
        height = 80
        width = max(1, round(height * (info.width or 9) / (info.height or 16)))
        thumb_fps = min(THUMB_FPS, 60000 / (width * max(info.duration, 1)))
    frames = max(1, int(info.duration * thumb_fps + 0.999))
    out = TMP_DIR / "filmstrips" / f"{kind}-{id}-{int(src.stat().st_mtime)}.jpg"
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        part = out.with_suffix(".part.jpg")
        result = subprocess.run(
            [
                ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
                "-vf", f"fps={thumb_fps:.5f},scale=-2:{height},tile={frames}x1",
                "-frames:v", "1", "-q:v", "5", str(part),
            ],
            capture_output=True, text=True,
        )
        if result.returncode != 0 or not part.exists():
            raise HTTPException(500, "مش قادر أعمل صور التايم لاين")
        part.replace(out)
    return FileResponse(
        out, media_type="image/jpeg",
        headers={
            "Cache-Control": "max-age=86400", "X-Frames": str(frames), "X-Fps": f"{thumb_fps:.5f}",
            "X-Video-Fps": f"{info.fps:g}",
        },
    )


class ClipEdit(BaseModel):
    gen_id: str
    start: float = 0
    end: float | None = None
    zoom: float = 1.0
    x: float = 0.0
    y: float = 0.0
    volume: float = 1.0


class TrackPart(BaseModel):
    delay: float = 0.0
    offset: float = 0.0
    length: float | None = None
    volume: float = 1.0


class TrackEdit(BaseModel):
    id: str
    volume: float = 1.0
    delay: float = 0.0
    offset: float = 0.0
    length: float | None = None  # قصّ آخر الملف (None = لحد آخره)
    fade_out: bool = True
    parts: list[TrackPart] = []  # لو الصوت متقسّم: كل قطعة ومكانها


class ProjectIn(BaseModel):
    name: str
    video_id: str | None = None  # الفيديو الخام اللي المشروع معمول منه
    coach_id: str | None = None
    clips: list[ClipEdit] = []
    voice: TrackEdit | None = None
    music: TrackEdit | None = None
    outro: bool = True
    outro_volume: float = 1.0
    captions: dict = {}  # {enabled, template, font, size, y, words, color, highlight, ...}
    logo: dict = {}  # {enabled, size, x, y, opacity, on_outro}
    section: str | None = None  # المونتاج بتاع أنهي قسم: coach (فيديوهات المدربين) / series / ads


PROJECT_SECTIONS = ("coach", "series", "ads")


def tag_project_sections() -> None:
    """المشاريع القديمة: نعرف قسمها من الفيديوهات اللي فيها (ad: / series:) عشان كل قسم ليه مونتاج لوحده."""
    with closing(db()) as conn, conn:
        for r in conn.execute("SELECT id, data FROM projects").fetchall():
            d = json.loads(r["data"])
            if d.get("section"):
                continue
            ids = [c.get("gen_id") for c in d.get("clips") or [] if c.get("gen_id")]
            kinds = {(g["clip_id"] or "").split(":")[0] for g in conn.execute(
                f"SELECT clip_id FROM generations WHERE id IN ({','.join('?' * len(ids))})", ids).fetchall()} if ids else set()
            d["section"] = "ads" if "ad" in kinds else "series" if "series" in kinds else "coach"
            conn.execute("UPDATE projects SET data = ? WHERE id = ?", (json.dumps(d, ensure_ascii=False), r["id"]))


def project_to_dict(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "name": r["name"],
        "data": json.loads(r["data"]),
        "section": json.loads(r["data"]).get("section") or "coach",
        "render_status": r["render_status"],
        "render_error": r["render_error"],
        "render_progress": RENDER_ACTIVE.get(r["id"]),
        "export_id": r["export_id"],
        "updated_at": r["updated_at"],
    }


def get_project(conn: sqlite3.Connection, project_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "المشروع غير موجود")
    return row


@app.get("/api/projects")
def list_projects():
    with closing(db()) as conn, conn:
        # لو مكتوب «بيصدّر» والتصدير مش شغال فعلًا، يبقى وقف في النص
        for r in conn.execute("SELECT id FROM projects WHERE render_status = 'rendering'").fetchall():
            if r["id"] not in RENDER_ACTIVE:
                conn.execute(
                    "UPDATE projects SET render_status = 'failed', render_error = ? WHERE id = ?",
                    (f"التصدير وقف في النص{memory_note()}. صدّر تاني.", r["id"]),
                )
        return [project_to_dict(r) for r in conn.execute("SELECT * FROM projects ORDER BY updated_at DESC")]


@app.post("/api/projects")
def create_project(body: ProjectIn):
    project_id = uuid.uuid4().hex[:12]
    data = body.model_dump()
    data["name"] = body.name.strip() or "مشروع جديد"
    data["section"] = body.section if body.section in PROJECT_SECTIONS else "coach"
    with closing(db()) as conn, conn:
        conn.execute(
            "INSERT INTO projects (id, name, data, render_status, created_at, updated_at) VALUES (?, ?, ?, 'idle', ?, ?)",
            (project_id, data["name"], json.dumps(data), now(), now()),
        )
        return project_to_dict(get_project(conn, project_id))


@app.put("/api/projects/{project_id}")
def save_project(project_id: str, body: ProjectIn):
    data = body.model_dump()
    data["name"] = body.name.strip() or "مشروع جديد"
    with closing(db()) as conn, conn:
        old = json.loads(get_project(conn, project_id)["data"])
        data["section"] = old.get("section") or "coach"  # القسم مبيتغيرش من الحفظ
        conn.execute(
            "UPDATE projects SET name = ?, data = ?, updated_at = ? WHERE id = ?",
            (data["name"], json.dumps(data), now(), project_id),
        )
        return project_to_dict(get_project(conn, project_id))


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str):
    with closing(db()) as conn, conn:
        row = get_project(conn, project_id)
        if row["render_status"] == "rendering":
            raise HTTPException(400, "المشروع بيتصدّر دلوقتي، استنى لما يخلص")
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    return {"ok": True}


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def track_parts(t: dict) -> list[dict]:
    """قطع التعليق أو الموسيقى. المشاريع القديمة فيها قطعة واحدة بس."""
    if t.get("parts"):
        return t["parts"]
    return [{"delay": t.get("delay", 0), "offset": t.get("offset", 0), "length": t.get("length"), "volume": t.get("volume", 1)}]


def build_montage(conn: sqlite3.Connection, data: dict):
    """يحوّل بيانات المشروع لقطع ومسارات صوت جاهزة لـ FFmpeg، ويتأكد إن كل حاجة موجودة."""
    ff = ffmpeg_exe()
    segments = []
    outro_len = 0.0
    for i, c in enumerate(data["clips"], start=1):
        path = clip_source(conn, c["gen_id"])
        if path is None:
            raise HTTPException(400, f"الفيديو رقم {i} اتمسح. شيله من المونتاج")
        info = media_info(path)
        start = clamp(c["start"], 0, info.duration)
        end = clamp(c["end"] if c["end"] is not None else info.duration, 0, info.duration)
        if end - start < 1 / 30 - 0.001:
            raise HTTPException(400, f"الفيديو رقم {i} مقصوص لدرجة إنه مفيهوش ولا فريم")
        segments.append(
            montage.Segment(
                path, start, end,
                zoom=clamp(c["zoom"], 1, 4), x=clamp(c["x"], -1, 1), y=clamp(c["y"], -1, 1),
                volume=clamp(c["volume"], 0, 3), has_audio=info.has_audio,
            )
        )
    if not segments:
        raise HTTPException(400, "ضيف فيديو واحد على الأقل للمونتاج")
    # الأوترو اللي في آخر المونتاج (عشان اللوجو يختفي وقته لو اخترت كده)
    for c, seg in zip(reversed(data["clips"]), reversed(segments)):
        if not c["gen_id"].startswith(ANY_OUTRO):
            break
        outro_len += seg.duration

    if data.get("outro") and data.get("coach_id"):
        coach = conn.execute("SELECT outro_filename FROM coaches WHERE id = ?", (data["coach_id"],)).fetchone()
        if coach and coach["outro_filename"]:
            path = COACHES_DIR / coach["outro_filename"]
            info = media_info(path)
            segments.append(
                montage.Segment(path, 0, info.duration, volume=clamp(data.get("outro_volume", 1), 0, 3), has_audio=info.has_audio)
            )
            outro_len = info.duration

    def track(t: dict | None, kind: str) -> list[montage.AudioTrack]:
        if not t:
            return []
        row = conn.execute("SELECT filename FROM audio WHERE id = ? AND kind = ?", (t["id"], kind)).fetchone()
        if row is None:
            raise HTTPException(400, "ملف الصوت المختار اتمسح من المكتبة")
        parts = track_parts(t)
        # الاختفاء بالتدريج بيبقى في آخر قطعة بس
        last = max(range(len(parts)), key=lambda n: parts[n]["delay"])
        return [
            montage.AudioTrack(
                AUDIO_DIR / row["filename"], volume=clamp(p["volume"], 0, 3),
                delay=max(0, p["delay"]), offset=max(0, p["offset"]),
                length=p["length"] if p.get("length") and p["length"] > 0.01 else None,
                fade_out=bool(t.get("fade_out")) and n == last,
            )
            for n, p in enumerate(parts)
        ]

    return segments, track(data.get("voice"), "voice"), track(data.get("music"), "music"), outro_len


def project_logo(data: dict, total: float, outro_len: float) -> montage.Logo | None:
    cfg = {**LOGO_DEFAULTS, **(data.get("logo") or {})}
    path = logo_path()
    if not cfg["enabled"] or not path:
        return None
    until = total - outro_len if not cfg["on_outro"] and outro_len > 0 else None
    return montage.Logo(
        path, size=clamp(float(cfg["size"]), 3, 60), x=clamp(float(cfg["x"]), 0, 100),
        y=clamp(float(cfg["y"]), 0, 100), opacity=clamp(float(cfg["opacity"]), 0.1, 1), until=until,
    )


def project_captions(conn: sqlite3.Connection, data: dict, total: float, export_id: str) -> montage.Subtitles | None:
    cfg = data.get("captions") or {}
    if not cfg.get("enabled"):
        return None
    voice = data.get("voice")
    if not voice:
        raise HTTPException(400, "الكابشن بيتعمل من التعليق الصوتي. اختار تعليق صوتي أو اقفل الكابشن")
    row = conn.execute("SELECT transcript FROM audio WHERE id = ?", (voice["id"],)).fetchone()
    tr = json.loads(row["transcript"]) if row and row["transcript"] else {}
    if tr.get("status") != "done" or not tr.get("words"):
        raise HTTPException(400, "لسه الكلام بتاع التعليق الصوتي متكتبش. دوس «اكتب الكلام» الأول أو اقفل الكابشن")
    # الكلام اللي اتمسح من الكابشن في المشروع ده (بمعاد بدايته جوه ملف الصوت)
    removed = {int(k) for k in cfg.get("removed") or []}
    source = [w for w in tr["words"] if round(w["s"] * 100) not in removed]
    words = []
    for part in track_parts(voice):
        offset, delay = max(0.0, part.get("offset") or 0), max(0.0, part.get("delay") or 0)
        length = part.get("length") or float("inf")
        words += [
            {"w": w["w"], "s": w["s"] - offset + delay, "e": w["e"] - offset + delay}
            for w in source if w["e"] - offset > 0 and w["s"] - offset < length
        ]
    words.sort(key=lambda w: w["s"])
    ass = TMP_DIR / f"{export_id}.ass"
    ass.write_text(captions.build_ass(words, cfg, total), encoding="utf-8")
    return montage.Subtitles(ass, FONTS_DIR)


def memory_note() -> str:
    limit = system_info()["memory_limit_mb"]
    return f" — الذاكرة المتاحة للسيرفر {limit} ميجا" if limit else ""


def render_error(result: subprocess.CompletedProcess) -> str:
    """رسالة الخطأ اللي بتظهر لما التصدير يفشل، من غير سطور التحذير اللي ملهاش لازمة."""
    if result.returncode < 0:
        return f"التصدير وقف فجأة (غالبًا ذاكرة السيرفر خلصت){memory_note()}. جرّب تاني."
    if "No space left on device" in result.stderr:
        return space_message(None, free_mb(EXPORTS_DIR))
    noise = ("Fontconfig", "fonctconfig", "fontconfig", "memory font", "Loading font")
    lines = [l for l in result.stderr.strip().splitlines() if l.strip() and not any(n in l for n in noise)]
    return f"FFmpeg: {chr(10).join(lines)[-400:] or f'خطأ رقم {result.returncode}'}"


# ---------- حالة السيرفر (عشان نعرف لو الذاكرة قليلة) ----------
def _read_int(path: str) -> int | None:
    try:
        v = Path(path).read_text().strip()
        return None if v == "max" else int(v)
    except (OSError, ValueError):
        return None


def system_info() -> dict:
    limit = _read_int("/sys/fs/cgroup/memory.max") or _read_int("/sys/fs/cgroup/memory/memory.limit_in_bytes")
    used = _read_int("/sys/fs/cgroup/memory.current") or _read_int("/sys/fs/cgroup/memory/memory.usage_in_bytes")
    if limit and limit > 1 << 50:  # رقم ضخم = مفيش حد
        limit = None
    return {
        "memory_limit_mb": limit // 2**20 if limit else None,
        "memory_used_mb": used // 2**20 if used else None,
        "cpus": os.cpu_count(),
    }


@app.get("/api/system")
def get_system():
    return system_info()


# ---------- المساحة ----------
SYSTEM_TMP = Path(tempfile.gettempdir()) / "studiomania-render"


def free_mb(path: Path) -> int:
    path.mkdir(parents=True, exist_ok=True)
    return shutil.disk_usage(path).free // 2**20


def folder_mb(path: Path) -> float:
    total = 0
    for f in path.rglob("*"):
        try:
            if f.is_file():
                total += f.stat().st_size
        except OSError:
            pass
    return round(total / 2**20, 1)


def render_work_dir(export_id: str, total: float) -> Path:
    """الملفات المؤقتة للتصدير بتتحط في المكان اللي فيه مساحة أكتر، ولو مفيش مساحة كفاية بنقول بدري."""
    need_tmp = int(total * 2.5) + 50  # تقريبًا: القطع المؤقتة
    need_out = int(total * 1.2) + 20  # الفيديو النهائي
    out_free = free_mb(EXPORTS_DIR)
    if out_free < need_out:
        raise HTTPException(400, space_message(need_out, out_free))
    choices = sorted([(free_mb(TMP_DIR), TMP_DIR), (free_mb(SYSTEM_TMP), SYSTEM_TMP)], key=lambda c: c[0], reverse=True)
    free, base = choices[0]
    # لو الملفات المؤقتة والفيديو النهائي على نفس المساحة لازم يكفّوا الاتنين
    same = base.stat().st_dev == EXPORTS_DIR.stat().st_dev
    if free < need_tmp + (need_out if same else 0):
        raise HTTPException(400, space_message(need_tmp + need_out, free))
    return base / f"render-{export_id}"


def space_message(need: int | None, free: int) -> str:
    what = f"محتاج حوالي {need} ميجا والفاضي {free} ميجا بس" if need else f"الفاضي {free} ميجا بس"
    return (
        f"مساحة السيرفر مش كفاية للتصدير: {what}. "
        "امسح فيديوهات جاهزة قديمة (الخطوة 7) أو فيديوهات خام خلصت منها، أو دوس «امسح الملفات المؤقتة» في ⚙️ الإعدادات، "
        "أو كبّر مساحة الـ Volume من إعدادات Railway."
    )


@app.get("/api/storage")
def get_storage():
    usage = shutil.disk_usage(DATA_DIR)
    folders = {
        "raw": RAW_DIR, "clips": CLIPS_DIR, "generated": GENERATED_DIR, "coaches": COACHES_DIR,
        "audio": AUDIO_DIR, "exports": EXPORTS_DIR, "tmp": TMP_DIR,
    }
    return {
        "total_mb": usage.total // 2**20, "free_mb": usage.free // 2**20,
        "folders": {k: folder_mb(v) for k, v in folders.items()},
    }


@app.post("/api/storage/clean")
def clean_storage():
    """بيمسح الملفات المؤقتة بس (صور التايم لاين وبقايا التصدير)، وهي بتتعمل تاني لوحدها لما تحتاجها."""
    if RENDER_ACTIVE:
        raise HTTPException(400, "فيه تصدير شغال دلوقتي، استنى لما يخلص")
    before = folder_mb(TMP_DIR) + folder_mb(SYSTEM_TMP)
    for item in list(TMP_DIR.iterdir()) + list(SYSTEM_TMP.glob("render-*")):
        if item.name in ("fonts.conf", "fontcache", "render.log"):
            continue
        if item.is_dir():
            shutil.rmtree(item, ignore_errors=True)
        else:
            item.unlink(missing_ok=True)
    return {"freed_mb": round(before - folder_mb(TMP_DIR) - folder_mb(SYSTEM_TMP), 1)}


# التصديرات اللي شغالة فعلًا دلوقتي، ووصلت لفين
RENDER_ACTIVE: dict[str, str] = {}


RENDER_PROCS: dict[str, subprocess.Popen] = {}  # أمر FFmpeg الشغال دلوقتي لكل تصدير (عشان الإلغاء)
RENDER_CANCELLED: set[str] = set()
STALL_SECONDS = int(os.environ.get("RENDER_STALL_SECONDS", "180"))  # لو التصدير موقف مكانه المدة دي، بنوقفه بدل ما يفضل معلّق
RENDER_LOG = TMP_DIR / "render.log"


def log_render(text: str) -> None:
    with RENDER_LOG.open("a", encoding="utf-8") as f:
        f.write(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] {text}\n")


def run_ffmpeg(cmd: list[str], project_id: str, length: float, pct: tuple[int, int], label: str) -> tuple[int, str]:
    """يشغّل أمر FFmpeg ويتابع وصل لفين. لو وقف مكانه كتير أو اتلغى، بيتقفل."""
    cmd = cmd[:1] + ["-progress", "pipe:1", "-nostats"] + [a if a != "error" else "warning" for a in cmd[1:]]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    RENDER_PROCS[project_id] = proc
    err_lines: list[str] = []
    state = {"last": time.time(), "done": -1.0, "stalled": False}
    reader = threading.Thread(target=lambda: err_lines.extend(proc.stderr), daemon=True)
    reader.start()

    def watchdog() -> None:
        while proc.poll() is None:
            if time.time() - state["last"] > STALL_SECONDS:
                state["stalled"] = True
                log_render(f"{label}: وقف مكانه {STALL_SECONDS} ثانية عند {state['done']:.1f}ث — ذاكرة: {system_info()}")
                proc.kill()
                return
            time.sleep(2)

    threading.Thread(target=watchdog, daemon=True).start()
    for line in proc.stdout:
        if line.startswith("out_time_us="):
            try:
                done = int(line.split("=", 1)[1]) / 1e6
            except ValueError:
                continue
            if done > state["done"]:
                state["done"], state["last"] = done, time.time()
                frac = min(1.0, done / length) if length > 0 else 0
                RENDER_ACTIVE[project_id] = f"{label}… {int(pct[0] + (pct[1] - pct[0]) * frac)}%"
        elif line.startswith("progress=end"):
            state["last"] = time.time()
    proc.wait()
    reader.join(timeout=5)
    RENDER_PROCS.pop(project_id, None)
    stderr = "".join(err_lines)
    log_render(f"{label}: خلص برقم {proc.returncode} عند {state['done']:.1f}ث من {length:.1f}ث")
    if stderr.strip():
        log_render("FFmpeg قال:\n" + stderr.strip()[-3000:])
    if state["stalled"]:
        return -999, stderr
    return proc.returncode, stderr


def run_render(project_id: str, export_id: str, cmds: list[list[str]], total: float, name: str, work_dir: Path) -> None:
    filename = f"{export_id}.mp4"
    error = None
    RENDER_LOG.write_text("", encoding="utf-8")
    log_render(f"تصدير {name} ({total:.1f}ث، {len(cmds) - 3} قطعة) — السيرفر: {system_info()} — مساحة فاضية: {free_mb(EXPORTS_DIR)} ميجا")
    try:
        # الأوامر بتشتغل ورا بعض: كل قطعة لوحدها وبعدين التجميع النهائي
        segs = cmds[:-3]
        steps = [(c, f"بيجهّز القطعة {n} من {len(segs)}", (int((n - 1) / len(segs) * 40), int(n / len(segs) * 40)))
                 for n, c in enumerate(segs, start=1)]
        steps += [
            (cmds[-3], "بيجهّز الصوت", (40, 48)),
            (cmds[-2], "بيجمّع الفيديو النهائي", (48, 96)),
            (cmds[-1], "بيحفظ الفيديو", (96, 99)),
        ]
        for cmd, label, pct in steps:
            if project_id in RENDER_CANCELLED:
                break
            length = float(cmd[cmd.index("-t") + 1]) if cmd in segs else total
            code, stderr = run_ffmpeg(cmd, project_id, length, pct, label)
            if project_id in RENDER_CANCELLED:
                break
            if code == -999:
                wait = f"{STALL_SECONDS // 60} دقايق" if STALL_SECONDS >= 120 else f"{STALL_SECONDS} ثانية"
                error = (f"التصدير وقف مكانه أكتر من {wait} في «{label}» فوقّفته{memory_note()}. "
                         "جرّب تاني، ولو اتكرر ابعت «سجل آخر تصدير» من ⚙️ الإعدادات.")
                break
            if code != 0:
                error = render_error(subprocess.CompletedProcess(cmd, code, "", stderr))
                break
        if project_id in RENDER_CANCELLED:
            error = "إنت لغيت التصدير."
    except Exception as exc:  # أي مشكلة غير متوقعة لازم تظهر، مش يفضل «بيصدّر» على طول
        error = f"حصلت مشكلة أثناء التصدير: {exc}"
        log_render(f"مشكلة: {exc!r}")
    finally:
        RENDER_CANCELLED.discard(project_id)
        log_render(f"النهاية: {error or 'تمام ✓'}")
        shutil.rmtree(work_dir, ignore_errors=True)
        (TMP_DIR / f"{export_id}.ass").unlink(missing_ok=True)
        with closing(db()) as conn, conn:
            if error:
                (EXPORTS_DIR / filename).unlink(missing_ok=True)
                conn.execute(
                    "UPDATE projects SET render_status = 'failed', render_error = ?, updated_at = ? WHERE id = ?",
                    (error, now(), project_id),
                )
            else:
                conn.execute(
                    "INSERT INTO exports (id, name, filename, duration, source, project_id, created_at) VALUES (?, ?, ?, ?, 'studio', ?, ?)",
                    (export_id, name, filename, total, project_id, now()),
                )
                conn.execute(
                    "UPDATE projects SET render_status = 'done', render_error = NULL, export_id = ?, updated_at = ? WHERE id = ?",
                    (export_id, now(), project_id),
                )
        RENDER_ACTIVE.pop(project_id, None)


@app.post("/api/projects/{project_id}/render/cancel")
def cancel_render(project_id: str):
    if project_id not in RENDER_ACTIVE:
        raise HTTPException(400, "مفيش تصدير شغال للمشروع ده")
    RENDER_CANCELLED.add(project_id)
    proc = RENDER_PROCS.get(project_id)
    if proc and proc.poll() is None:
        proc.kill()
    return {"ok": True}


@app.get("/api/render-log")
def get_render_log():
    text = RENDER_LOG.read_text(encoding="utf-8") if RENDER_LOG.exists() else ""
    return JSONResponse({"log": text or "لسه مفيش تصدير اتعمل من ساعة ما السيرفر اشتغل."})


render_executor = ThreadPoolExecutor(max_workers=1)


@app.post("/api/projects/{project_id}/render")
def render_project(project_id: str):
    with closing(db()) as conn, conn:
        row = get_project(conn, project_id)
        if row["render_status"] == "rendering":
            raise HTTPException(400, "المشروع بيتصدّر بالفعل")
        data = json.loads(row["data"])
        segments, voice, music, outro_len = build_montage(conn, data)
        export_id = uuid.uuid4().hex[:12]
        total = sum(sg.duration for sg in segments)
        subs = project_captions(conn, data, total, export_id)
        work_dir = render_work_dir(export_id, total)
        cmd, total = montage.build_commands(
            ffmpeg_exe(), segments, EXPORTS_DIR / f"{export_id}.mp4", work_dir, voice, music,
            logo=project_logo(data, total, outro_len), subtitles=subs,
            low_memory=(system_info()["memory_limit_mb"] or 99999) < 1500,
        )
        RENDER_ACTIVE[project_id] = "بيبدأ…"
        conn.execute(
            "UPDATE projects SET render_status = 'rendering', render_error = NULL, updated_at = ? WHERE id = ?",
            (now(), project_id),
        )
    render_executor.submit(run_render, project_id, export_id, cmd, total, row["name"], work_dir)
    return {"ok": True, "duration": total}


def export_file_name(name: str) -> str:
    """اسم الملف اللي بيتحمّل: اسم المشروع، من غير الحروف اللي الأجهزة مبتقبلهاش في أسماء الملفات."""
    clean = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', " ", name).strip(" .") or "video"
    return f"{clean[:120]}.mp4"


def export_to_dict(r: sqlite3.Row) -> dict:
    # الاسم جوه الرابط نفسه، عشان أي طريقة تحميل (حتى من قايمة مشغّل الفيديو) تحفظه باسم المشروع
    url = f"/media/export/{r['id']}/{quote(export_file_name(r['name']))}"
    return {
        "id": r["id"],
        "name": r["name"],
        "url": url,
        "download_url": f"{url}?download=1",
        "duration": r["duration"],
        "source": r["source"],
        "project_id": r["project_id"],
        "created_at": r["created_at"],
    }


@app.get("/media/export/{export_id}/{filename}")
def export_file(export_id: str, filename: str, download: int = 0):
    with closing(db()) as conn:
        row = conn.execute("SELECT * FROM exports WHERE id = ?", (export_id,)).fetchone()
    if row is None or not (EXPORTS_DIR / row["filename"]).exists():
        raise HTTPException(404, "الفيديو غير موجود")
    return FileResponse(
        EXPORTS_DIR / row["filename"], media_type="video/mp4", filename=export_file_name(row["name"]),
        content_disposition_type="attachment" if download else "inline",
    )


@app.get("/api/exports")
def list_exports():
    with closing(db()) as conn:
        # مدرب كل فيديو (من مشروع المونتاج) عشان التاج بتاعه يتحط لوحده في النشر
        coach_of = {}
        for p in conn.execute("SELECT id, data FROM projects").fetchall():
            cid = json.loads(p["data"]).get("coach_id")
            if cid:
                coach_of[p["id"]] = cid
        coaches = {r["id"]: {"id": r["id"], "name": r["name"], "instagram": r["instagram"], "tiktok": r["tiktok"]}
                   for r in conn.execute("SELECT id, name, instagram, tiktok FROM coaches")}
        out = []
        for r in conn.execute("SELECT * FROM exports ORDER BY created_at DESC"):
            e = export_to_dict(r)
            e["coach"] = coaches.get(coach_of.get(r["project_id"]))
            out.append(e)
        return out


def reset_stuck_renders() -> None:
    """التصدير بيضيع لو البرنامج اتقفل في النص، فنعلّمه كفاشل."""
    for leftover in [*TMP_DIR.glob("render-*"), *SYSTEM_TMP.glob("render-*")]:
        shutil.rmtree(leftover, ignore_errors=True)
    with closing(db()) as conn, conn:
        conn.execute(
            "UPDATE projects SET render_status = 'failed', render_error = ? WHERE render_status = 'rendering'",
            (f"السيرفر اتقفل وبدأ من جديد أثناء التصدير (غالبًا الذاكرة خلصت{memory_note()}). صدّر تاني.",),
        )


reset_stuck_renders()
tag_project_sections()


# ---------------------------------------------------------------- فولدر الفيديوهات الجاهزة والنشر (الخطوة 7)


@app.post("/api/exports/upload")
def upload_export(file: UploadFile = File(...)):
    """فيديو جاهز من برا البرنامج بيدخل نفس الفولدر."""
    export_id = uuid.uuid4().hex[:12]
    filename = save_upload(file, VIDEO_EXTENSIONS, EXPORTS_DIR, f"upload_{export_id}")
    try:
        duration = probe_duration(EXPORTS_DIR / filename)
    except ValueError as exc:
        (EXPORTS_DIR / filename).unlink(missing_ok=True)
        raise HTTPException(400, str(exc)) from exc
    with closing(db()) as conn, conn:
        conn.execute(
            "INSERT INTO exports (id, name, filename, duration, source, project_id, created_at) VALUES (?, ?, ?, ?, 'upload', NULL, ?)",
            (export_id, Path(file.filename).stem, filename, duration, now()),
        )
        return export_to_dict(conn.execute("SELECT * FROM exports WHERE id = ?", (export_id,)).fetchone())


@app.patch("/api/exports/{export_id}")
def rename_export(export_id: str, body: RenameIn):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "الاسم فاضي")
    with closing(db()) as conn, conn:
        if conn.execute("UPDATE exports SET name = ? WHERE id = ?", (name, export_id)).rowcount == 0:
            raise HTTPException(404, "الفيديو غير موجود")
        return export_to_dict(conn.execute("SELECT * FROM exports WHERE id = ?", (export_id,)).fetchone())


@app.delete("/api/exports/{export_id}")
def delete_export(export_id: str):
    with closing(db()) as conn, conn:
        row = conn.execute("SELECT filename FROM exports WHERE id = ?", (export_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "الفيديو غير موجود")
        pending = conn.execute(
            "SELECT COUNT(*) FROM posts WHERE export_id = ? AND status IN ('scheduled', 'sending', 'publishing')", (export_id,)
        ).fetchone()[0]
        if pending:
            raise HTTPException(400, "الفيديو ده عليه بوستات متجدولة. الغيها الأول")
        conn.execute("DELETE FROM exports WHERE id = ?", (export_id,))
    (EXPORTS_DIR / row["filename"]).unlink(missing_ok=True)
    return {"ok": True}


def post_to_dict(r: sqlite3.Row) -> dict:
    if r["carousel_id"]:
        # كاروسيل صور: الصورة الأولى بدل الفيديو
        first = CAROUSELS_DIR / r["carousel_id"] / "post" / "01.jpg"
        return {**_post_dict(r), "carousel_id": r["carousel_id"],
                "export_name": f"🖼️ {r['carousel_name']}" if r["carousel_name"] else "⚠️ الكاروسيل اتمسح",
                "export_url": None, "image_url": f"/media/carousels/{r['carousel_id']}/post/01.jpg" if first.exists() else None}
    return _post_dict(r)


def _post_dict(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "export_id": r["export_id"],
        "export_name": r["export_name"],
        "export_url": f"/media/exports/{r['export_filename']}" if r["export_filename"] else r["remote_media"],
        "from_zernio": not r["export_filename"] and bool(r["remote_media"]),
        "caption": r["caption"],
        "platforms": json.loads(r["platforms"]),
        "scheduled_at": r["scheduled_at"],
        "status": r["status"],
        "error": r["error"],
        "published_at": r["published_at"],
        "sent": bool(r["remote_id"]),
        "remote_id": r["remote_id"],
        "options": json.loads(r["options"]) if r["options"] else {},
    }


POSTS_QUERY = (
    "SELECT p.*, e.name AS export_name, e.filename AS export_filename, e.source AS export_source, "
    "c.name AS carousel_name FROM posts p LEFT JOIN exports e ON e.id = p.export_id "
    "LEFT JOIN carousels c ON c.id = p.carousel_id"
)


@app.get("/api/publisher")
def publisher_status():
    service = publisher.service_name()
    linked, error = {}, None
    if service == "zernio":
        try:
            linked = publisher.accounts(refresh=True)
        except (publisher.PublishError, httpx.HTTPError) as exc:
            error = f"مقدرتش أوصل لـ Zernio: {exc}"
    return {
        "service": service,
        "platforms": {k: v[1] for k, v in publisher.PLATFORMS.items()},
        "accounts": linked,
        "accounts_error": error,
        "dashboard_url": publisher.DASHBOARD_URL,
    }


@app.get("/api/posts")
def list_posts():
    with closing(db()) as conn:
        return [post_to_dict(r) for r in conn.execute(POSTS_QUERY + " ORDER BY p.scheduled_at")]


class PostOptions(BaseModel):
    tag_slide: int = 1  # في الكاروسيل: التاج على أنهي سلايد
    ig_tags: list[str] = []  # حسابات تتعمل تاج في إنستجرام
    ig_collab: bool = False  # البوست يظهر كمان في حساب المدرب (كولاب) لو وافق
    cover_ms: int | None = None  # الغلاف: فريم من الفيديو (بالملّي ثانية) لإنستجرام وتيك توك


class PostIn(BaseModel):
    export_id: str
    caption: str = ""
    platforms: list[str]
    scheduled_at: datetime  # من المتصفح بتوقيت UTC
    options: PostOptions = PostOptions()


def clean_options(opts: PostOptions) -> str:
    tags = []
    for t in opts.ig_tags:
        h = sheets.clean_handle(t, "instagram")
        if t.strip() and not h:
            raise HTTPException(400, f"اسم الحساب مش مظبوط: {t.strip()}")
        if h and h not in tags:
            tags.append(h)
    if len(tags) > 20:
        raise HTTPException(400, "إنستجرام بيقبل 20 تاج بالكتير")
    if opts.ig_collab and not tags:
        raise HTTPException(400, "الكولاب محتاج حساب واحد على الأقل في خانة التاج")
    if opts.ig_collab and len(tags) > 3:
        raise HTTPException(400, "الكولاب بيقبل 3 حسابات بالكتير")
    cover = max(0, int(opts.cover_ms)) if opts.cover_ms is not None else None
    return json.dumps({"ig_tags": tags, "ig_collab": opts.ig_collab, "cover_ms": cover, "tag_slide": max(1, int(opts.tag_slide or 1))})


def clean_post(conn: sqlite3.Connection, body: PostIn) -> tuple[str, str, str]:
    if not conn.execute("SELECT 1 FROM exports WHERE id = ?", (body.export_id,)).fetchone():
        raise HTTPException(400, "الفيديو مش موجود في الفولدر")
    platforms = [p for p in dict.fromkeys(body.platforms) if p in publisher.PLATFORMS]
    if not platforms:
        raise HTTPException(400, "اختار منصة واحدة على الأقل")
    when = body.scheduled_at
    if when.tzinfo is None:
        raise HTTPException(400, "الميعاد لازم يكون فيه المنطقة الزمنية")
    return json.dumps(platforms), when.astimezone(timezone.utc).isoformat(timespec="seconds"), body.caption.strip()


def set_post(post_id: str, **fields) -> None:
    fields["updated_at"] = now()
    cols = ", ".join(f"{k} = ?" for k in fields)
    with closing(db()) as conn, conn:
        conn.execute(f"UPDATE posts SET {cols} WHERE id = ?", (*fields.values(), post_id))


def send_post(post_id: str, old_remote_id: str | None = None) -> None:
    """يرفع الفيديو ويسلّم البوست لـ Zernio (في الخلفية)."""
    try:
        if old_remote_id:
            publisher.cancel(old_remote_id)
        with closing(db()) as conn:
            r = conn.execute(POSTS_QUERY + " WHERE p.id = ?", (post_id,)).fetchone()
        if r is None or r["status"] != "sending":
            return
        if r["carousel_id"]:
            with closing(db()) as conn:
                _, cdata = load_carousel(conn, r["carousel_id"])
            remote_id = publisher.schedule_carousel(
                post_images(r["carousel_id"], cdata), r["caption"], r["scheduled_at"],
                publish_now=r["scheduled_at"] <= now(), options=json.loads(r["options"]) if r["options"] else {},
            )
            set_post(post_id, status="scheduled", remote_id=remote_id, error=None)
            return
        if not r["export_filename"] or not (EXPORTS_DIR / r["export_filename"]).exists():
            raise publisher.PublishError("الفيديو اتمسح من الفولدر")
        remote_id = publisher.schedule(
            EXPORTS_DIR / r["export_filename"],
            r["caption"],
            json.loads(r["platforms"]),
            r["scheduled_at"],
            title=r["caption"].split("\n")[0].strip() or r["export_name"],
            ai_made=r["export_source"] == "studio",
            publish_now=r["scheduled_at"] <= now(),
            options=json.loads(r["options"]) if r["options"] else {},
        )
        set_post(post_id, status="scheduled", remote_id=remote_id, error=None)
    except (publisher.PublishError, httpx.HTTPError, HTTPException, subprocess.SubprocessError) as exc:
        detail = exc.detail if isinstance(exc, HTTPException) else exc
        set_post(post_id, status="failed", remote_id=None, error=f"مقدرتش أسلّم البوست لـ Zernio: {detail}"[:500])


def after_save(post_id: str, when: str, old_remote_id: str | None) -> None:
    service = publisher.service_name()
    if service == "zernio":
        set_post(post_id, status="sending", remote_id=None)
        threading.Thread(target=send_post, args=(post_id, old_remote_id), daemon=True).start()
    elif when <= now():
        threading.Thread(target=publish_due_posts, daemon=True).start()


@app.post("/api/posts")
def create_post(body: PostIn):
    with closing(db()) as conn, conn:
        platforms, when, caption = clean_post(conn, body)
        options = clean_options(body.options)
        post_id = uuid.uuid4().hex[:12]
        # لو Zernio مربوط بيتسجّل «بيتبعت» على طول، عشان المجدول ميبعتهوش هو كمان (نسختين عند Zernio)
        status = "sending" if publisher.service_name() == "zernio" else "scheduled"
        conn.execute(
            "INSERT INTO posts (id, export_id, caption, platforms, scheduled_at, status, options, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (post_id, body.export_id, caption, platforms, when, status, options, now(), now()),
        )
    after_save(post_id, when, None)
    with closing(db()) as conn:
        return post_to_dict(conn.execute(POSTS_QUERY + " WHERE p.id = ?", (post_id,)).fetchone())


@app.put("/api/posts/{post_id}")
def update_post(post_id: str, body: PostIn):
    with closing(db()) as conn, conn:
        row = conn.execute("SELECT status, remote_id, carousel_id FROM posts WHERE id = ?", (post_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "البوست غير موجود")
        if row["carousel_id"]:
            raise HTTPException(400, "ده كاروسيل: الغيه من هنا وانشره تاني من صفحة الكاروسيل")
        if row["status"] in ("sending", "publishing", "published"):
            raise HTTPException(400, "البوست ده اتنشر أو بيتبعت دلوقتي")
        if row["status"] == "failed" and row["remote_id"]:
            raise HTTPException(400, "البوست ده اتبعت لـ Zernio وفشل. استخدم إعادة المحاولة، أو احذفه واعمل واحد جديد")
        platforms, when, caption = clean_post(conn, body)
        options = clean_options(body.options)
        conn.execute(
            "UPDATE posts SET export_id = ?, caption = ?, platforms = ?, scheduled_at = ?, status = 'scheduled', "
            "options = ?, error = NULL, updated_at = ? WHERE id = ?",
            (body.export_id, caption, platforms, when, options, now(), post_id),
        )
    after_save(post_id, when, row["remote_id"])
    with closing(db()) as conn:
        return post_to_dict(conn.execute(POSTS_QUERY + " WHERE p.id = ?", (post_id,)).fetchone())


@app.delete("/api/posts/{post_id}")
def delete_post(post_id: str):
    with closing(db()) as conn:
        row = conn.execute("SELECT status, remote_id FROM posts WHERE id = ?", (post_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "البوست غير موجود")
    if row["status"] in ("sending", "publishing"):
        raise HTTPException(400, "البوست بيتبعت دلوقتي، استنى ثواني")
    if row["remote_id"] and row["status"] in ("scheduled", "failed"):
        # لازم نلغيه عند Zernio الأول، وإلا هيتنشر برضه (حتى الفاشل ممكن يكون لسه متجدول على منصات تانية)
        try:
            publisher.cancel(row["remote_id"])
        except (publisher.PublishError, httpx.HTTPError) as exc:
            if row["status"] == "scheduled":
                raise HTTPException(400, f"مقدرتش ألغيه عند Zernio: {exc}") from exc
    with closing(db()) as conn, conn:
        conn.execute("DELETE FROM posts WHERE id = ?", (post_id,))
    return {"ok": True}


# ---------- البوستات اللي عند Zernio ومش في القايمة هنا ----------
def _remote_orphans() -> list[dict]:
    if publisher.service_name() != "zernio":
        return []
    try:
        remote = publisher.list_scheduled()
    except (publisher.PublishError, httpx.HTTPError) as exc:
        raise HTTPException(400, f"مقدرتش أوصل لـ Zernio: {exc}") from exc
    with closing(db()) as conn:
        known = {r["remote_id"] for r in conn.execute("SELECT remote_id FROM posts WHERE remote_id IS NOT NULL")}
    return [p for p in remote if p["id"] not in known]


@app.get("/api/posts/published")
def published_posts():
    """اللي اتنشر: من Zernio (بلينك البوست على كل منصة)، ولو مفيش Zernio من القايمة هنا."""
    with closing(db()) as conn:
        local = [post_to_dict(r) for r in conn.execute(POSTS_QUERY + " WHERE p.status = 'published' ORDER BY p.published_at DESC")]
    if publisher.service_name() != "zernio":
        return [{"id": p["id"], "content": p["caption"], "published_at": p["published_at"] or p["scheduled_at"],
                 "media_url": p["export_url"], "name": p["export_name"],
                 "platforms": [{"key": k, "status": "published", "url": None, "error": None} for k in p["platforms"]]}
                for p in local]
    try:
        remote = publisher.list_posts("published", 50)
    except (publisher.PublishError, httpx.HTTPError) as exc:
        raise HTTPException(400, f"مقدرتش أوصل لـ Zernio: {exc}") from exc
    by_remote = {p.get("remote_id"): p for p in local}
    with closing(db()) as conn:
        names = {r["remote_id"]: r["export_name"] for r in conn.execute(POSTS_QUERY + " WHERE p.remote_id IS NOT NULL")}
    out = []
    for r in remote:
        ours = by_remote.get(r["id"])
        out.append({
            "id": r["id"], "content": r["content"], "media_url": r["media_url"] or (ours or {}).get("export_url"),
            "published_at": r["published_at"] or next((x["published_at"] for x in r["platforms"] if x.get("published_at")), None) or r["scheduled_for"],
            "name": names.get(r["id"]), "platforms": r["platforms"],
        })
    out.sort(key=lambda x: x["published_at"] or "", reverse=True)
    return out


@app.get("/api/posts/remote")
def remote_orphans():
    return _remote_orphans()


class AdoptIn(BaseModel):
    remote_id: str


@app.post("/api/posts/adopt")
def adopt_remote_post(body: AdoptIn):
    """بوست متجدول عند Zernio ومش هنا: نضيفه للقايمة عشان تتابعه وتلغيه من هنا."""
    post = next((p for p in _remote_orphans() if p["id"] == body.remote_id), None)
    if post is None:
        raise HTTPException(404, "البوست ده مش لاقيه عند Zernio، أو موجود في القايمة بالفعل")
    try:
        when = datetime.fromisoformat(str(post["scheduled_for"]).replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        when = datetime.now(timezone.utc)
    post_id = uuid.uuid4().hex[:12]
    with closing(db()) as conn, conn:
        conn.execute(
            "INSERT INTO posts (id, export_id, caption, platforms, scheduled_at, status, remote_id, remote_media, created_at, updated_at) "
            "VALUES (?, '', ?, ?, ?, 'scheduled', ?, ?, ?, ?)",
            (post_id, post["content"], json.dumps(post["platforms"]), when.isoformat(timespec="seconds"),
             post["id"], post["media_url"], now(), now()),
        )
    return {"ok": True}


@app.post("/api/posts/remote/{remote_id}/cancel")
def cancel_remote_post(remote_id: str):
    if not any(p["id"] == remote_id for p in _remote_orphans()):
        raise HTTPException(404, "البوست ده مش لاقيه عند Zernio، أو موجود في القايمة بالفعل")
    try:
        publisher.cancel(remote_id)
    except (publisher.PublishError, httpx.HTTPError) as exc:
        raise HTTPException(400, f"مقدرتش ألغيه عند Zernio: {exc}") from exc
    return {"ok": True}


@app.post("/api/posts/{post_id}/retry")
def retry_post(post_id: str):
    with closing(db()) as conn:
        row = conn.execute("SELECT status, remote_id, scheduled_at FROM posts WHERE id = ?", (post_id,)).fetchone()
    if row is None or row["status"] != "failed":
        raise HTTPException(400, "البوست ده مش فاشل")
    if row["remote_id"]:
        # Zernio بتعيد المنصات اللي فشلت بس، فمفيش نشر مكرر
        try:
            publisher.retry(row["remote_id"])
        except (publisher.PublishError, httpx.HTTPError) as exc:
            raise HTTPException(400, str(exc)) from exc
        set_post(post_id, status="scheduled", error=None)
    else:
        set_post(post_id, status="sending" if publisher.service_name() == "zernio" else "scheduled", error=None)
        after_save(post_id, row["scheduled_at"], None)
    return {"ok": True}


_publish_lock = threading.Lock()


def publish_due_posts() -> None:
    if not _publish_lock.acquire(blocking=False):
        return
    try:
        service = publisher.service_name()
        with closing(db()) as conn:
            if service == "zernio":
                # بوستات اتجدولت قبل ما المفتاح يتضاف: نسلّمها دلوقتي
                waiting = [r["id"] for r in conn.execute("SELECT id FROM posts WHERE status = 'scheduled' AND remote_id IS NULL")]
                # بوستات ميعادها عدّى: نسأل Zernio اتنشرت ولا لأ
                sent = conn.execute(
                    "SELECT id, remote_id FROM posts WHERE status = 'scheduled' AND remote_id IS NOT NULL AND scheduled_at <= ?",
                    (now(),),
                ).fetchall()
            else:
                due = conn.execute(
                    POSTS_QUERY + " WHERE p.status = 'scheduled' AND p.scheduled_at <= ? ORDER BY p.scheduled_at", (now(),)
                ).fetchall()

        if service == "zernio":
            for post_id in waiting:
                set_post(post_id, status="sending")
                send_post(post_id)
            for r in sent:
                try:
                    state, error = publisher.remote_status(r["remote_id"])
                except (publisher.PublishError, httpx.HTTPError):
                    continue  # نحاول تاني في اللفة الجاية
                if state == "published":
                    set_post(r["id"], status="published", published_at=now(), error=None)
                elif state == "failed":
                    set_post(r["id"], status="failed", error=error)
            return

        for r in due:
            if service == "mock":
                set_post(r["id"], status="published", published_at=now(), error=None)
            else:
                set_post(
                    r["id"], status="failed",
                    error="لسه مفيش خدمة نشر مربوطة، فالبوست متنشرش. حط مفتاح Zernio من ⚙️ الإعدادات ودوس إعادة المحاولة",
                )
    finally:
        _publish_lock.release()


def scheduler_loop() -> None:
    while True:
        try:
            publish_due_posts()
        except Exception:  # المجدول لازم يفضل شغال مهما حصل
            pass
        time.sleep(20)


with closing(db()) as _conn, _conn:
    if "remote_id" not in {c[1] for c in _conn.execute("PRAGMA table_info(posts)")}:
        _conn.execute("ALTER TABLE posts ADD COLUMN remote_id TEXT")
    if "remote_media" not in {c[1] for c in _conn.execute("PRAGMA table_info(posts)")}:
        _conn.execute("ALTER TABLE posts ADD COLUMN remote_media TEXT")
    if "carousel_id" not in {c[1] for c in _conn.execute("PRAGMA table_info(posts)")}:
        _conn.execute("ALTER TABLE posts ADD COLUMN carousel_id TEXT")
    # إعدادات إضافية للبوست: تاج إنستجرام، كولاب، الغلاف
    if "options" not in {c[1] for c in _conn.execute("PRAGMA table_info(posts)")}:
        _conn.execute("ALTER TABLE posts ADD COLUMN options TEXT")
    # لو البرنامج اتقفل وهو بيسلّم بوست، مش عارفين وصل ولا لأ، فنعلّمه عشان تتأكد بنفسك
    _conn.execute(
        "UPDATE posts SET status = 'failed', error = 'البرنامج اتقفل وهو بيبعت البوست. اتأكد من Zernio قبل ما تعيد المحاولة' "
        "WHERE status IN ('sending', 'publishing')"
    )
threading.Thread(target=scheduler_loop, daemon=True).start()


# ---------------------------------------------------------------- الكابشن واللوجو

LOGO_DEFAULTS = {"enabled": True, "size": 37, "x": 0, "y": 4, "opacity": 0.9, "on_outro": True}


def transcript_of(row: sqlite3.Row) -> dict:
    return json.loads(row["transcript"]) if row["transcript"] else {"status": "none", "words": []}


@app.get("/api/captions/options")
def caption_options():
    return {
        "fonts": [{"family": f["family"], "label": f["label"], "url": f"/fonts/{f['file']}"} for f in captions.FONTS],
        "templates": {k: v for k, v in captions.TEMPLATES.items()},
        "default_template": captions.DEFAULT_TEMPLATE,
        "logo_defaults": LOGO_DEFAULTS,
    }


@app.get("/api/audio/{audio_id}/transcript")
def get_transcript(audio_id: str):
    with closing(db()) as conn:
        row = conn.execute("SELECT transcript FROM audio WHERE id = ?", (audio_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "الملف غير موجود")
    return transcript_of(row)


def set_transcript(audio_id: str, data: dict) -> None:
    with closing(db()) as conn, conn:
        conn.execute("UPDATE audio SET transcript = ? WHERE id = ?", (json.dumps(data, ensure_ascii=False), audio_id))


def run_transcribe(audio_id: str) -> None:
    with closing(db()) as conn:
        row = conn.execute("SELECT filename, duration FROM audio WHERE id = ?", (audio_id,)).fetchone()
    if row is None:
        return
    try:
        words = atlas.transcribe(AUDIO_DIR / row["filename"], row["duration"])
        set_transcript(audio_id, {"status": "done", "words": words, "edited": False})
    except httpx.HTTPError as exc:
        set_transcript(audio_id, {"status": "failed", "error": f"مقدرتش أوصل لـ Atlas: {exc}"[:400], "words": []})
    except Exception as exc:  # الخطأ يبان للمستخدم بدل ما يضيع
        set_transcript(audio_id, {"status": "failed", "error": str(exc)[:400], "words": []})


@app.post("/api/audio/{audio_id}/transcribe")
def start_transcribe(audio_id: str):
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "محتاج مفتاح Atlas عشان يكتب الكلام. حطه من ⚙️ الإعدادات")
    with closing(db()) as conn:
        row = conn.execute("SELECT transcript FROM audio WHERE id = ?", (audio_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "الملف غير موجود")
    if transcript_of(row).get("status") == "working":
        return {"ok": True}
    set_transcript(audio_id, {"status": "working", "words": []})
    threading.Thread(target=run_transcribe, args=(audio_id,), daemon=True).start()
    return {"ok": True}


class WordIn(BaseModel):
    w: str
    s: float
    e: float


class TranscriptIn(BaseModel):
    words: list[WordIn]


@app.put("/api/audio/{audio_id}/transcript")
def save_transcript(audio_id: str, body: TranscriptIn):
    words = sorted(
        ({"w": w.w.strip(), "s": round(max(0.0, w.s), 3), "e": round(max(w.s, w.e), 3)} for w in body.words if w.w.strip()),
        key=lambda w: w["s"],
    )
    with closing(db()) as conn:
        if not conn.execute("SELECT 1 FROM audio WHERE id = ?", (audio_id,)).fetchone():
            raise HTTPException(404, "الملف غير موجود")
    set_transcript(audio_id, {"status": "done", "words": words, "edited": True})
    return {"status": "done", "words": words, "edited": True}


def legacy_logo_path() -> Path | None:
    name = auth.get_setting("logo")
    path = BRAND_DIR / name if name else None
    return path if path and path.exists() else None


def logo_path() -> Path | None:
    """لوجو العميل المختار (أول لوجو في ملفه)."""
    c = active_client()
    for a in (c or {}).get("logos") or []:
        p = brain_dir(c["id"]) / a["file"]
        if p.exists():
            return p
    return None


@app.get("/api/logo")
def get_logo():
    path = logo_path()
    return {"url": f"/media/ads/brains/{path.parent.name}/{path.name}" if path else None}


@app.post("/api/logo")
def upload_logo(file: UploadFile = File(...)):
    """اللوجو الأساسي للعميل المختار (بيبقى أول لوجو في ملفه)."""
    cid = active_client_id()
    if not cid:
        raise HTTPException(400, "اختار عميل الأول")
    name = save_upload(file, IMAGE_EXTENSIONS, brain_dir(cid), "logo")
    update_brain(cid, lambda d: d.update(logos=[{"file": name, "name": "اللوجو", "description": ""}] + (d.get("logos") or [])))
    return get_logo()


@app.delete("/api/logo")
def delete_logo():
    cid, old = active_client_id(), logo_path()
    if cid and old:
        update_brain(cid, lambda d: d.update(logos=[a for a in d.get("logos") or [] if a["file"] != old.name]))
        old.unlink(missing_ok=True)
    return get_logo()


# ---------------------------------------------------------------- المشاريع (الفولدرات)


def sync_folder(conn: sqlite3.Connection, folder_id: str) -> None:
    """الفيديو الخام بياخد اسم الفولدر والصوت والمدرب بتوعه، ومشاريع المونتاج بتاخد الاسم."""
    f = conn.execute("SELECT * FROM folders WHERE id = ?", (folder_id,)).fetchone()
    if not f or not f["video_id"]:
        return
    conn.execute(
        "UPDATE videos SET name = ?, voice_id = ?, coach_id = ? WHERE id = ?",
        (f["name"], f["voice_id"], f["coach_id"], f["video_id"]),
    )
    for p in conn.execute("SELECT id, data FROM projects").fetchall():
        data = json.loads(p["data"])
        if data.get("video_id") == f["video_id"] and data.get("name") != f["name"]:
            data["name"] = f["name"]
            conn.execute("UPDATE projects SET name = ?, data = ? WHERE id = ?", (f["name"], json.dumps(data), p["id"]))


def get_folder(conn: sqlite3.Connection, folder_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM folders WHERE id = ?", (folder_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "المشروع غير موجود")
    return row


def folder_to_dict(conn: sqlite3.Connection, f: sqlite3.Row) -> dict:
    video = None
    if f["video_id"]:
        v = conn.execute("SELECT * FROM videos WHERE id = ?", (f["video_id"],)).fetchone()
        if v:
            clip_ids = [r["id"] for r in conn.execute("SELECT id FROM clips WHERE video_id = ?", (v["id"],))]
            done = 0
            for cid in clip_ids:
                if conn.execute(
                    "SELECT 1 FROM generations WHERE clip_id = ? AND status = 'completed'", (cid,)
                ).fetchone():
                    done += 1
            video = {
                "id": v["id"], "url": f"/media/raw/{v['filename']}", "duration": v["duration"],
                "file": v["filename"], "clips": len(clip_ids), "generated": done,
            }
    voice = None
    if f["voice_id"]:
        a = conn.execute("SELECT id, name, filename, duration FROM audio WHERE id = ?", (f["voice_id"],)).fetchone()
        if a:
            voice = {"id": a["id"], "name": a["name"], "url": f"/media/audio/{a['filename']}", "duration": a["duration"]}
    coach = None
    if f["coach_id"]:
        c = conn.execute("SELECT * FROM coaches WHERE id = ?", (f["coach_id"],)).fetchone()
        if c:
            coach = coach_to_dict(c)
    montage_project, exported = None, None
    if f["video_id"]:
        for p in conn.execute("SELECT id, data, export_id FROM projects ORDER BY updated_at DESC").fetchall():
            if json.loads(p["data"]).get("video_id") == f["video_id"]:
                montage_project = p["id"]
                if p["export_id"]:
                    e = conn.execute("SELECT filename FROM exports WHERE id = ?", (p["export_id"],)).fetchone()
                    exported = f"/media/exports/{e['filename']}" if e else None
                break
    return {
        "id": f["id"], "name": f["name"], "created_at": f["created_at"],
        "video": video, "voice": voice, "coach": coach, "script": f["script"] or "",
        "montage_project": montage_project, "exported": exported,
    }


@app.get("/api/folders")
def list_folders():
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM folders ORDER BY created_at DESC").fetchall()
        return [folder_to_dict(conn, r) for r in rows]


class FolderIn(BaseModel):
    name: str


@app.post("/api/folders")
def create_folder(body: FolderIn):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "اكتب اسم المشروع")
    folder_id = uuid.uuid4().hex[:12]
    with closing(db()) as conn, conn:
        conn.execute("INSERT INTO folders (id, name, created_at) VALUES (?, ?, ?)", (folder_id, name, now()))
        return folder_to_dict(conn, get_folder(conn, folder_id))


@app.patch("/api/folders/{folder_id}")
def update_folder(folder_id: str, body: dict):
    """بيغيّر اللي اتبعت بس: name أو voice_id أو coach_id أو script (null = شيله)."""
    with closing(db()) as conn, conn:
        get_folder(conn, folder_id)
        if "name" in body:
            name = str(body["name"] or "").strip()
            if not name:
                raise HTTPException(400, "الاسم فاضي")
            conn.execute("UPDATE folders SET name = ? WHERE id = ?", (name, folder_id))
        if "voice_id" in body:
            vid = body["voice_id"] or None
            if vid and not conn.execute("SELECT 1 FROM audio WHERE id = ? AND kind = 'voice'", (vid,)).fetchone():
                raise HTTPException(400, "التسجيل مش موجود في المكتبة")
            conn.execute("UPDATE folders SET voice_id = ? WHERE id = ?", (vid, folder_id))
        if "coach_id" in body:
            cid = body["coach_id"] or None
            if cid:
                get_coach(conn, cid)
            conn.execute("UPDATE folders SET coach_id = ? WHERE id = ?", (cid, folder_id))
        if "script" in body:
            script = str(body["script"] or "").replace("\r\n", "\n").strip()
            if len(script) > 200_000:
                raise HTTPException(400, "السكريبت طويل جدًا")
            conn.execute("UPDATE folders SET script = ? WHERE id = ?", (script or None, folder_id))
        sync_folder(conn, folder_id)
        return folder_to_dict(conn, get_folder(conn, folder_id))


@app.post("/api/folders/{folder_id}/video")
def set_folder_video(folder_id: str, file: UploadFile = File(...)):
    """يرفع الفيديو الخام للمشروع. لو فيه فيديو قديم، بيتمسح هو والتقطيع بتاعه."""
    with closing(db()) as conn:
        get_folder(conn, folder_id)
    new_id = store_video(file)
    with closing(db()) as conn, conn:
        old = get_folder(conn, folder_id)["video_id"]
        if old:
            remove_video(conn, old)
        conn.execute("UPDATE folders SET video_id = ? WHERE id = ?", (new_id, folder_id))
        sync_folder(conn, folder_id)
        return folder_to_dict(conn, get_folder(conn, folder_id))


@app.post("/api/folders/{folder_id}/voice")
def set_folder_voice(folder_id: str, file: UploadFile = File(...)):
    """يرفع تسجيل جديد للمكتبة ويحطه في المشروع."""
    with closing(db()) as conn:
        get_folder(conn, folder_id)
    audio = upload_audio(kind="voice", file=file)
    return update_folder(folder_id, {"voice_id": audio["id"]})


@app.delete("/api/folders/{folder_id}/video")
def delete_folder_video(folder_id: str):
    with closing(db()) as conn, conn:
        f = get_folder(conn, folder_id)
        if f["video_id"]:
            remove_video(conn, f["video_id"])
        return folder_to_dict(conn, get_folder(conn, folder_id))


@app.delete("/api/folders/{folder_id}")
def delete_folder(folder_id: str, delete_video: bool = True):
    """يمسح المشروع والفيديو الخام بتاعه. التعليق الصوتي والمدرب بيفضلوا في مكتباتهم."""
    with closing(db()) as conn, conn:
        f = get_folder(conn, folder_id)
        if delete_video and f["video_id"]:
            remove_video(conn, f["video_id"])
        conn.execute("DELETE FROM folders WHERE id = ?", (folder_id,))
    return {"ok": True}


app.mount("/media/raw", StaticFiles(directory=RAW_DIR), name="raw")
app.mount("/media/clips", StaticFiles(directory=CLIPS_DIR), name="clips")
app.mount("/media/coaches", StaticFiles(directory=COACHES_DIR), name="coaches")
app.mount("/media/generated", StaticFiles(directory=GENERATED_DIR), name="generated")
app.mount("/media/audio", StaticFiles(directory=AUDIO_DIR), name="audio")
app.mount("/media/exports", StaticFiles(directory=EXPORTS_DIR), name="exports")
app.mount("/media/carousels", StaticFiles(directory=CAROUSELS_DIR), name="carousels")
app.mount("/media/series", StaticFiles(directory=SERIES_DIR), name="series")
app.mount("/media/ads", StaticFiles(directory=ADS_DIR), name="ads")
app.mount("/media/brand", StaticFiles(directory=BRAND_DIR), name="brand")
app.mount("/media/lab", StaticFiles(directory=DATA_DIR / "lab", check_dir=False), name="lab")
app.mount("/media/assets", StaticFiles(directory=DATA_DIR / "assets", check_dir=False), name="assets")
app.mount("/media/films", StaticFiles(directory=DATA_DIR / "films", check_dir=False), name="films")
app.mount("/fonts", StaticFiles(directory=FONTS_DIR), name="fonts")


# ---------------------------------------------------------------- الكاروسيل

CAROUSEL_LOCK = threading.Lock()
CAROUSEL_JOBS: set[str] = set()  # كاروسيلات بترسم دلوقتي


def carousel_settings() -> dict:
    return {
        "text_model": auth.get_setting("carousel_text_model") or atlas.DEFAULT_TEXT_MODEL,
        "vision_model": auth.get_setting("carousel_vision_model") or atlas.DEFAULT_VISION_MODEL,
        "image_family": auth.get_setting("carousel_image_family") or "sunburst",
        "quality": auth.get_setting("carousel_quality") or "high",
    }


def legacy_brand() -> dict:
    """الهوية القديمة (قبل العملاء): كانت إعداد واحد للبرنامج كله. بتتنقل لأول عميل مرة واحدة."""
    try:
        saved = json.loads(auth.get_setting("brand") or "{}")
    except ValueError:
        saved = {}
    if saved.get("style") in cz.OLD_DEFAULT_STYLES:
        saved.pop("style")
    return {**cz.LEGACY_BRAND, **{k: v for k, v in saved.items() if k in cz.LEGACY_BRAND and v}}


# حقول الهوية في ملف العميل ← أسمائها في البرومبتات
CLIENT_BRAND_MAP = {"about": "about", "audience": "audience", "palette": "colors", "typography": "font", "style": "style",
                    "logo_rule": "logo_rule", "market": "market", "language": "language", "modest": "modest", "rules": "rules",
                    "domain": "domain"}


def brand_settings() -> dict:
    """👤 هوية العميل المختار (الاسم والجمهور والألوان والخط والستايل واللغة والسوق) لكل البرومبتات."""
    c = active_client() or {}
    b = {cz_key: str(c.get(k) or "") for k, cz_key in CLIENT_BRAND_MAP.items()}
    return {**cz.DEFAULT_BRAND, **{k: v for k, v in b.items() if v}, "name": c.get("name") or ""}


def cta_list() -> list[dict]:
    ctas = (active_client() or {}).get("ctas")
    return ctas if isinstance(ctas, list) and ctas else cz.DEFAULT_CTAS


@app.get("/api/carousel/settings")
def get_carousel_settings():
    return {
        **carousel_settings(),
        "brand": brand_settings(),
        "defaults": cz.DEFAULT_BRAND,
        "ctas": cta_list(),
        "default_ctas": cz.DEFAULT_CTAS,
        "kinds": cz.KINDS,
        "logo": get_logo()["url"],
        "image_models": {k: v[2] for k, v in atlas.IMAGE_MODELS.items()},
        "qualities": list(cz.QUALITIES),
        "sizes": list(cz.SIZES),
        "configured": bool(atlas.api_key()) or atlas.mock_mode(),
    }


class CarouselSettingsIn(BaseModel):
    text_model: str | None = None
    vision_model: str | None = None
    image_family: str | None = None
    quality: str | None = None
    brand: dict | None = None
    ctas: list[dict] | None = None


@app.put("/api/carousel/settings")
def save_carousel_settings(body: CarouselSettingsIn):
    if body.text_model is not None:
        auth.set_setting("carousel_text_model", body.text_model.strip() or None)
    if body.vision_model is not None:
        auth.set_setting("carousel_vision_model", body.vision_model.strip() or None)
    if body.image_family is not None:
        if body.image_family not in atlas.IMAGE_MODELS:
            raise HTTPException(400, "موديل الصور غير معروف")
        auth.set_setting("carousel_image_family", body.image_family)
    if body.quality is not None:
        if body.quality not in cz.QUALITIES:
            raise HTTPException(400, "الجودة غير معروفة")
        auth.set_setting("carousel_quality", body.quality)
    if body.brand is not None and (cid := active_client_id()):
        back = {v: k for k, v in CLIENT_BRAND_MAP.items()}
        def fn(d):
            for k, v in body.brand.items():
                if k in back:
                    d[back[k]] = str(v).strip()[:2000]
            return str(body.brand.get("name") or "").strip()[:80] or None
        update_brain(cid, fn)
    if body.ctas is not None:
        ctas, seen = [], set()
        for c in body.ctas:
            cid = re.sub(r"[^a-z0-9_]", "", str(c.get("id") or "").lower())[:20] or uuid.uuid4().hex[:6]
            label, text = str(c.get("label") or "").strip()[:60], str(c.get("text") or "").strip()[:300]
            if label and text and cid not in seen and cid not in ("auto", "custom"):
                seen.add(cid)
                ctas.append({"id": cid, "label": label, "text": text})
        if cid := active_client_id():
            update_brain(cid, lambda d: d.update(ctas=ctas or None))
    return get_carousel_settings()


@app.post("/api/carousel/test-model")
def test_text_model():
    """بيتأكد إن موديل الكلام شغال بمفتاح Atlas، وبيرجّع جملة تجريبية بلغة العميل."""
    if atlas.mock_mode():
        return {"ok": True, "reply": "أهلًا، أنا جاهز نشتغل على الكاروسيل 👌"}
    try:
        reply = atlas.chat(
            [{"role": "user", "content": f"قل جملة ترحيب قصيرة بـ{brand_settings()['language']} لمتابعين حساب «{brand_settings()['name'] or 'البراند'}»."}],
            carousel_settings()["text_model"], max_tokens=120,
        )
    except (atlas.AtlasError, httpx.HTTPError) as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, "reply": reply}


# ---------- مكتبة الكاروسيل: تيمبليتس وشخصيات ----------
ASSET_KINDS = {"template": "تيمبليت", "character": "شخصية", "coach": "مدرب", "style": "ستايل رسم"}
ASSET_MAX_FILES = 12
# صيغ تانية بتتحول PNG لوحدها (صور الآيفون وصور المواقع)
CONVERT_EXTENSIONS = {".heic", ".heif", ".avif", ".gif", ".bmp", ".tif", ".tiff", ".jfif"}


def asset_to_dict(r: sqlite3.Row) -> dict:
    files = [f for f in json.loads(r["files"]) if (LIBRARY_DIR / r["id"] / f).exists()]
    return {"id": r["id"], "kind": r["kind"], "name": r["name"], "notes": r["notes"], "handle": r["handle"],
            "images": [{"name": f, "url": f"/media/brand/library/{r['id']}/{f}"} for f in files]}


def get_asset(conn: sqlite3.Connection, aid: str) -> sqlite3.Row:
    r = conn.execute("SELECT * FROM carousel_assets WHERE id = ?", (aid,)).fetchone()
    if r is None:
        raise HTTPException(404, "مش موجود في المكتبة")
    return r


@app.get("/api/carousel/library")
def carousel_library():
    with closing(db()) as conn:
        return [asset_to_dict(r) for r in conn.execute("SELECT * FROM carousel_assets ORDER BY created_at")]


def add_asset_files(aid: str, current: list[str], files: list[UploadFile]) -> tuple[list[str], int]:
    """بيحفظ الصور (ولو أكتر من الحد بياخد الأول بس). بيرجّع الملفات وعدد اللي اتسابت."""
    folder = LIBRARY_DIR / aid
    folder.mkdir(parents=True, exist_ok=True)
    out, added, skipped = list(current), [], 0
    try:
        for f in files:
            if not f or not f.filename:
                continue
            if len(out) >= ASSET_MAX_FILES:
                skipped += 1
                continue
            ext = Path(f.filename).suffix.lower()
            if ext in IMAGE_EXTENSIONS:
                name = save_upload(f, IMAGE_EXTENSIONS, folder, uuid.uuid4().hex[:8])
            elif ext in CONVERT_EXTENSIONS:
                name = convert_image(f, folder)
            else:
                raise HTTPException(400, f"«{f.filename}» نوعها مش مدعوم. ارفع صور PNG أو JPG")
            out.append(name)
            added.append(name)
    except Exception:
        for name in added:  # متسيبش ملفات نص نص
            (folder / name).unlink(missing_ok=True)
        raise
    return out, skipped


def convert_image(f: UploadFile, folder: Path) -> str:
    src = folder / f"in_{uuid.uuid4().hex[:8]}{Path(f.filename).suffix.lower()}"
    name = f"{uuid.uuid4().hex[:8]}.png"
    try:
        with src.open("wb") as out:
            shutil.copyfileobj(f.file, out)
        result = subprocess.run(
            [ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-frames:v", "1", str(folder / name)],
            capture_output=True, text=True,
        )
    finally:
        src.unlink(missing_ok=True)
    if result.returncode != 0 or not (folder / name).exists():
        raise HTTPException(400, f"مش قادر أفتح «{f.filename}». احفظها PNG أو JPG وارفعها تاني")
    return name


@app.post("/api/carousel/library")
def create_asset(kind: str = Form(...), name: str = Form(""), notes: str = Form(""), files: list[UploadFile] = File(...)):
    if kind not in ASSET_KINDS:
        raise HTTPException(400, "النوع غلط")
    aid = uuid.uuid4().hex[:12]
    saved, skipped = add_asset_files(aid, [], files)
    if not saved:
        shutil.rmtree(LIBRARY_DIR / aid, ignore_errors=True)
        raise HTTPException(400, "ارفع صورة واحدة على الأقل")
    with closing(db()) as conn, conn:
        if not name.strip():
            # من غير اسم: «تيمبليت 3» مثلًا (تقدر تغيّره بعدين)
            n = conn.execute("SELECT COUNT(*) FROM carousel_assets WHERE kind = ?", (kind,)).fetchone()[0] + 1
            name = f"{ASSET_KINDS[kind]} {n}"
        conn.execute("INSERT INTO carousel_assets (id, kind, name, notes, files, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                     (aid, kind, name.strip()[:80], notes.strip()[:1500], json.dumps(saved), now()))
        return {**asset_to_dict(get_asset(conn, aid)), "skipped": skipped}


@app.patch("/api/carousel/library/{aid}")
def update_asset(aid: str, name: str | None = Form(None), notes: str | None = Form(None),
                 files: list[UploadFile] | None = File(None), remove: str | None = Form(None),
                 handle: str | None = Form(None)):
    with closing(db()) as conn, conn:
        r = get_asset(conn, aid)
        current = json.loads(r["files"])
        if remove:
            gone = Path(remove).name
            if gone in current:
                if len(current) == 1:
                    raise HTTPException(400, "لازم تفضل صورة واحدة على الأقل. امسحه كله لو مش عايزه")
                current.remove(gone)
                (LIBRARY_DIR / aid / gone).unlink(missing_ok=True)
        skipped = 0
        if files:
            current, skipped = add_asset_files(aid, current, files)
        if name is not None and name.strip():
            conn.execute("UPDATE carousel_assets SET name = ? WHERE id = ?", (name.strip()[:80], aid))
        if notes is not None:
            conn.execute("UPDATE carousel_assets SET notes = ? WHERE id = ?", (notes.strip()[:1500], aid))
        if handle is not None:
            h = sheets.clean_handle(handle, "instagram")
            if handle.strip() and not h:
                raise HTTPException(400, f"اسم حساب إنستجرام مش مظبوط: {handle.strip()}")
            conn.execute("UPDATE carousel_assets SET handle = ? WHERE id = ?", (h, aid))
        conn.execute("UPDATE carousel_assets SET files = ? WHERE id = ?", (json.dumps(current), aid))
        return {**asset_to_dict(get_asset(conn, aid)), "skipped": skipped}


@app.post("/api/carousel/library/import")
async def import_library_pack(file: UploadFile = File(...)):
    """حزمة جاهزة (zip فيه manifest.json + الصور): بتضيف أو بتحدّث كل اللي فيها مرة واحدة."""
    import io
    import zipfile

    raw = await file.read()
    if len(raw) > 300 * 1024 * 1024:
        raise HTTPException(400, "الحزمة أكبر من 300 ميجا")
    try:
        z = zipfile.ZipFile(io.BytesIO(raw))
        names = {Path(n).name: n for n in z.namelist() if not n.endswith("/")}
        manifest = json.loads(z.read(names["manifest.json"]).decode("utf-8"))
    except (zipfile.BadZipFile, KeyError, ValueError) as exc:
        raise HTTPException(400, "ده مش ملف حزمة مكتبة (لازم zip فيه manifest.json)") from exc
    added = updated = 0
    with closing(db()) as conn, conn:
        for item in manifest.get("items", []):
            kind, key = item.get("kind"), str(item.get("key") or "")[:80]
            if kind not in ASSET_KINDS or not key or not item.get("files"):
                continue
            row = conn.execute("SELECT id FROM carousel_assets WHERE seed = ?", (key,)).fetchone()
            aid = row["id"] if row else uuid.uuid4().hex[:12]
            folder = LIBRARY_DIR / aid
            if row:
                shutil.rmtree(folder, ignore_errors=True)
            folder.mkdir(parents=True, exist_ok=True)
            saved = []
            for fname in item["files"][:ASSET_MAX_FILES]:
                src = names.get(Path(fname).name)
                ext = Path(fname).suffix.lower()
                if not src or ext not in IMAGE_EXTENSIONS:
                    continue
                out = f"{uuid.uuid4().hex[:8]}{ext}"
                (folder / out).write_bytes(z.read(src))
                saved.append(out)
            if not saved:
                continue
            handle = sheets.clean_handle(item.get("handle") or "", "instagram")
            values = (str(item.get("name") or key)[:80], str(item.get("notes") or "")[:1500], handle, json.dumps(saved))
            if row:
                conn.execute("UPDATE carousel_assets SET name = ?, notes = ?, handle = ?, files = ?, kind = ? WHERE id = ?",
                             (*values, kind, aid))
                updated += 1
            else:
                conn.execute("INSERT INTO carousel_assets (id, kind, name, notes, handle, files, seed, created_at) "
                             "VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (aid, kind, values[0], values[1], values[2], values[3], key, now()))
                added += 1
    # الهوية (الألوان والستايل) بعد ما الإضافة تتقفل، عشان الإعدادات قاعدة بيانات تانية
    if isinstance(manifest.get("brand"), dict) and (cid := active_client_id()):
        back = {v: k for k, v in CLIENT_BRAND_MAP.items()}
        update_brain(cid, lambda d: d.update({back[k]: str(v) for k, v in manifest["brand"].items() if k in back}))
    return {"added": added, "updated": updated}


@app.post("/api/carousel/library/{aid}/describe")
def describe_asset(aid: str):
    """موديل الرؤية بيبص على الصور ويكتب الملاحظات (الخطوط والألوان والتقسيم)، واسم لو الاسم تلقائي."""
    with closing(db()) as conn:
        r = get_asset(conn, aid)
        images = asset_to_dict(r)["images"][:4]
    if atlas.mock_mode():
        d = cz.mock_description(r["kind"])
    else:
        if not atlas.api_key():
            raise HTTPException(400, "حط مفتاح Atlas الأول عشان البرنامج يقرا الصور")
        try:
            urls = [atlas.reference_url(LIBRARY_DIR / aid / im["name"]) for im in images]
        except (atlas.AtlasError, httpx.HTTPError) as exc:
            raise HTTPException(400, f"ما قدرتش أرفع الصور لـ Atlas: {exc}") from exc
        preferred = carousel_settings()["vision_model"]
        d, errors = None, []
        # لو الموديل مش موجود أو مش بيشوف صور نجرب اللي بعده، وأول واحد ينجح نحفظه
        for model in atlas.vision_candidates(preferred)[:8]:
            try:
                reply = atlas.chat(cz.describe_messages(r["kind"], urls), model,
                                   temperature=0.3, max_tokens=4000, json_mode=True)
                d = cz.parse_description(reply)
            except (atlas.AtlasError, httpx.HTTPError, ValueError) as exc:
                errors.append(f"{model}: {str(exc)[:120]}")
                continue
            if model != preferred:
                auth.set_setting("carousel_vision_model", model)
            break
        if d is None:
            raise HTTPException(400, "ما قدرتش أقرا الصور بأي موديل: " + " | ".join(errors[:3]))
    with closing(db()) as conn, conn:
        # الاسم بيتغيّر بس لو لسه تلقائي («تيمبليت 3»)، واسم المدرب ما بيتغيّرش
        auto = re.fullmatch(rf"{re.escape(ASSET_KINDS.get(r['kind'], ''))} \d+", r["name"] or "")
        if d["name"] and auto and r["kind"] != "coach":
            conn.execute("UPDATE carousel_assets SET name = ? WHERE id = ?", (d["name"], aid))
        conn.execute("UPDATE carousel_assets SET notes = ? WHERE id = ?", (d["notes"], aid))
        return asset_to_dict(get_asset(conn, aid))


@app.delete("/api/carousel/library/{aid}")
def delete_asset(aid: str):
    with closing(db()) as conn, conn:
        get_asset(conn, aid)
        conn.execute("DELETE FROM carousel_assets WHERE id = ?", (aid,))
    shutil.rmtree(LIBRARY_DIR / Path(aid).name, ignore_errors=True)
    return {"ok": True}


def new_carousel_data() -> dict:
    return {
        "chat": [], "plan": None,
        "settings": {"slides": 6, "ratio": "4:5", "mix": True, "coach_id": None, "style_id": None,
                     "template_id": None, "character_ids": [], "cta": {"type": "auto"}},
        "overview": {"status": "idle", "file": None, "error": None, "approved": False},
        "slides": [],
    }


def load_carousel(conn: sqlite3.Connection, cid: str) -> tuple[sqlite3.Row, dict]:
    row = conn.execute("SELECT * FROM carousels WHERE id = ?", (cid,)).fetchone()
    if row is None:
        raise HTTPException(404, "الكاروسيل غير موجود")
    data = json.loads(row["data"])
    mix_settings(data["settings"])
    init_versions(data)
    return row, data


def init_versions(data: dict) -> None:
    """كل صورة اترسمت بتتحفظ: data["versions"] = {"overview": [...], "1": [...], "2": [...]}.
    الكاروسيلات القديمة: الصور الحالية بتبقى أول نسخة."""
    if "versions" in data:
        return
    v: dict = {}
    if data["overview"].get("file"):
        v["overview"] = [{"file": data["overview"]["file"], "at": None}]
    for k, sl in enumerate(data.get("slides", []), 1):
        if sl.get("file"):
            v[str(k)] = [{"file": sl["file"], "at": None}]
    data["versions"] = v


def add_version(d: dict, key: str, name: str) -> None:
    d.setdefault("versions", {}).setdefault(key, []).append({"file": name, "at": now()})


def mix_settings(st: dict) -> None:
    """الكاروسيلات القديمة كان ليها نوع واحد: نسيب بس الاختيارات اللي كانت شغالة فيه، والباقي يتشال."""
    if st.get("mix"):
        return
    kind = st.get("kind", "characters")
    if kind != "template":
        st["template_id"] = None
    if kind != "characters":
        st["character_ids"] = []
    if kind == "coach":
        st["style_id"] = None
    else:
        st["coach_id"] = st["coach_asset_id"] = None
    st["mix"] = True


def save_carousel(conn: sqlite3.Connection, cid: str, data: dict, name: str | None = None) -> None:
    if name is not None:
        conn.execute("UPDATE carousels SET name = ?, data = ?, updated_at = ? WHERE id = ?",
                     (name, json.dumps(data, ensure_ascii=False), now(), cid))
    else:
        conn.execute("UPDATE carousels SET data = ?, updated_at = ? WHERE id = ?",
                     (json.dumps(data, ensure_ascii=False), now(), cid))


def update_carousel(cid: str, fn) -> dict:
    """تعديل آمن (السيرفر ممكن يكون بيرسم في نفس الوقت)."""
    with CAROUSEL_LOCK, closing(db()) as conn, conn:
        _, data = load_carousel(conn, cid)
        fn(data)
        save_carousel(conn, cid, data)
        return data


def media_file_url(cid: str, name: str | None) -> str | None:
    if not name or not (CAROUSELS_DIR / cid / name).exists():
        return None
    return f"/media/carousels/{cid}/{name}?v={int((CAROUSELS_DIR / cid / name).stat().st_mtime)}"


def carousel_to_dict(row: sqlite3.Row, data: dict | None = None) -> dict:
    data = data or json.loads(row["data"])
    cid = row["id"]
    versions = data.get("versions", {})

    def vlist(key: str) -> list[dict]:
        return [{"file": v["file"], "url": u} for v in versions.get(key, []) if (u := media_file_url(cid, v["file"]))]

    ov = dict(data["overview"], url=media_file_url(cid, data["overview"].get("file")), versions=vlist("overview"))
    slides = [dict(s, url=media_file_url(cid, s.get("file")), versions=vlist(str(k)))
              for k, s in enumerate(data.get("slides", []), 1)]
    return {
        "id": cid, "name": row["name"], "created_at": row["created_at"], "updated_at": row["updated_at"],
        "chat": data["chat"], "plan": data["plan"], "settings": data["settings"],
        "overview": ov, "slides": slides, "busy": cid in CAROUSEL_JOBS,
    }


@app.get("/api/carousels")
def list_carousels():
    with closing(db()) as conn:
        out = []
        for r in conn.execute("SELECT * FROM carousels ORDER BY updated_at DESC"):
            if not owned(json.loads(r["data"]).get("client_id")):
                continue  # كاروسيلات عميل تاني
            d = carousel_to_dict(r)
            done = [s for s in d["slides"] if s["url"]]
            out.append({"id": d["id"], "name": d["name"], "updated_at": d["updated_at"], "busy": d["busy"],
                        "slides": len(d["plan"]["slides"]) if d["plan"] else 0, "done": len(done),
                        "cover": done[0]["url"] if done else d["overview"]["url"]})
        return out


class CarouselIn(BaseModel):
    name: str


@app.post("/api/carousels")
def create_carousel(body: CarouselIn):
    name = body.name.strip() or "كاروسيل جديد"
    cid = uuid.uuid4().hex[:12]
    with closing(db()) as conn, conn:
        conn.execute("INSERT INTO carousels (id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                     (cid, name, json.dumps({**new_carousel_data(), "client_id": active_client_id()}), now(), now()))
        row, data = load_carousel(conn, cid)
        return carousel_to_dict(row, data)


@app.get("/api/carousels/{cid}")
def get_carousel(cid: str):
    with closing(db()) as conn:
        row, data = load_carousel(conn, cid)
        return carousel_to_dict(row, data)


class CarouselPatch(BaseModel):
    name: str | None = None
    plan: dict | None = None
    settings: dict | None = None


@app.patch("/api/carousels/{cid}")
def patch_carousel(cid: str, body: CarouselPatch):
    with CAROUSEL_LOCK, closing(db()) as conn, conn:
        row, data = load_carousel(conn, cid)
        if body.settings is not None:
            st = data["settings"]
            if "slides" in body.settings:
                st["slides"] = max(2, min(10, int(body.settings["slides"] or 6)))
            if "ratio" in body.settings and body.settings["ratio"] in cz.SIZES:
                st["ratio"] = body.settings["ratio"]
            if "coach_id" in body.settings:
                st["coach_id"] = body.settings["coach_id"] or None
            if "template_id" in body.settings:
                st["template_id"] = body.settings["template_id"] or None
            if "coach_asset_id" in body.settings:
                st["coach_asset_id"] = body.settings["coach_asset_id"] or None
            if "character_ids" in body.settings:
                st["character_ids"] = [str(x) for x in (body.settings["character_ids"] or [])][:4]
            if "style_id" in body.settings:
                st["style_id"] = body.settings["style_id"] or None
            if "cta" in body.settings and isinstance(body.settings["cta"], dict):
                c = body.settings["cta"]
                st["cta"] = {k: str(c.get(k) or "")[:300] for k in ("type", "keyword", "reward", "text")}
        if body.plan is not None:
            if cid in CAROUSEL_JOBS:
                raise HTTPException(400, "استنى لحد ما الرسم يخلص")
            plan = cz.parse_plan(json.dumps(body.plan, ensure_ascii=False))
            data["plan"] = plan
            sync_slides(data)
        name = body.name.strip() if body.name and body.name.strip() else None
        save_carousel(conn, cid, data, name)
        row, data = load_carousel(conn, cid)
        return carousel_to_dict(row, data)


def sync_slides(data: dict) -> None:
    """عدد خانات الصور على قد عدد السلايدات في الخطة."""
    n = len(data["plan"]["slides"]) if data["plan"] else 0
    slides = data.get("slides", [])[:n]
    slides += [{"status": "idle", "file": None, "error": None} for _ in range(n - len(slides))]
    data["slides"] = slides


@app.delete("/api/carousels/{cid}")
def delete_carousel(cid: str):
    if cid in CAROUSEL_JOBS:
        raise HTTPException(400, "استنى لحد ما الرسم يخلص")
    with closing(db()) as conn, conn:
        conn.execute("DELETE FROM carousels WHERE id = ?", (cid,))
    shutil.rmtree(CAROUSELS_DIR / Path(cid).name, ignore_errors=True)
    return {"ok": True}


def llm(messages: list[dict], json_mode: bool = False, temperature: float = 0.8) -> str:
    try:
        return atlas.chat(messages, carousel_settings()["text_model"], temperature=temperature,
                          max_tokens=4000, json_mode=json_mode)
    except (atlas.AtlasError, httpx.HTTPError) as exc:
        raise HTTPException(400, f"موديل الكلام: {exc}") from exc


class ChatIn(BaseModel):
    message: str


@app.post("/api/carousels/{cid}/chat")
def carousel_chat(cid: str, body: ChatIn):
    text = body.message.strip()
    if not text:
        raise HTTPException(400, "اكتب حاجة")
    with closing(db()) as conn:
        _, data = load_carousel(conn, cid)
    history = [*data["chat"], {"role": "user", "content": text}]
    if atlas.mock_mode():
        reply = cz.mock_reply(history)
    else:
        reply = llm([{"role": "system", "content": cz.chat_system(brand_settings())}, *history[-30:]])
    def add(d):
        d["chat"] += [{"role": "user", "content": text}, {"role": "assistant", "content": reply}]
    return carousel_to_dict_by_id(cid, update_carousel(cid, add))


def carousel_to_dict_by_id(cid: str, data: dict) -> dict:
    with closing(db()) as conn:
        row, _ = load_carousel(conn, cid)
    return carousel_to_dict(row, data)


def carousel_context(data: dict) -> tuple[dict, dict]:
    """اختيارات الكاروسيل مع بعض (تيمبليت + ستايل + شخصيات + مدرب) للبرومبت، والصور المرجعية بتاعتها."""
    st = {"template_id": None, "character_ids": [], "cta": {"type": "auto"}, **data["settings"]}
    ctx: dict = {"characters": []}
    assets: dict = {"template": None, "characters": [], "coach": None, "coach_asset": None, "style": None}
    with closing(db()) as conn:
        def asset(aid: str | None, kind: str) -> sqlite3.Row | None:
            if not aid:
                return None
            return conn.execute("SELECT * FROM carousel_assets WHERE id = ? AND kind = ?", (aid, kind)).fetchone()

        if r := asset(st.get("template_id"), "template"):
            ctx["template"] = {"name": r["name"], "notes": r["notes"]}
            assets["template"] = asset_to_dict(r)
        for aid in st.get("character_ids") or []:
            if r := asset(aid, "character"):
                ctx["characters"].append({"name": r["name"], "notes": r["notes"]})
                assets["characters"].append(asset_to_dict(r))
        if r := asset(st.get("style_id"), "style"):
            ctx["style"] = {"name": r["name"], "notes": r["notes"]}
            assets["style"] = asset_to_dict(r)
        # المدرب من مكتبة المدربين نفسها (صفحة المدربين)، والقديم من مكتبة الكاروسيل لو لسه متسجل
        coach = conn.execute("SELECT * FROM coaches WHERE id = ?", (st["coach_id"],)).fetchone() if st.get("coach_id") else None
        if coach:
            ctx["coach"] = {"name": coach["name"], "instagram": coach["instagram"]}
            assets["coach"] = coach
        elif r := asset(st.get("coach_asset_id"), "coach"):
            ctx["coach"] = {"name": r["name"], "instagram": r["handle"], "notes": r["notes"]}
            assets["coach_asset"] = asset_to_dict(r)
    ctx["cta_text"] = cz.cta_text(st.get("cta"), cta_list(), (ctx.get("coach") or {}).get("name"))
    return ctx, assets


def check_kind_ready(data: dict) -> None:
    """كل الاختيارات اختيارية: من غير حاجة بيرسم بستايل العميل وشخصيات جديدة."""
    return None


@app.post("/api/carousels/{cid}/plan")
def carousel_plan(cid: str):
    """الموديل يكتب الكاروسيل النهائي (سلايد سلايد) من النقاش."""
    with closing(db()) as conn:
        _, data = load_carousel(conn, cid)
    if not data["chat"]:
        raise HTTPException(400, "اتكلم مع الموديل عن الفكرة الأول")
    n = data["settings"]["slides"]
    check_kind_ready(data)
    ctx, _ = carousel_context(data)
    if atlas.mock_mode():
        text = cz.mock_plan(n, ctx.get("cta_text"))
    else:
        text = llm(cz.plan_messages(brand_settings(), data["chat"], n, ctx), json_mode=True, temperature=0.7)
    try:
        plan = cz.parse_plan(text, n)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    def put(d):
        d["plan"] = plan
        d["overview"] = {"status": "idle", "file": d["overview"].get("file"), "error": None, "approved": False}
        sync_slides(d)
    data = update_carousel(cid, put)
    name = plan["title"] or None
    if name:
        with closing(db()) as conn, conn:
            conn.execute("UPDATE carousels SET name = ? WHERE id = ?", (name, cid))
    return carousel_to_dict_by_id(cid, data)


@app.post("/api/carousels/{cid}/polish")
def carousel_polish(cid: str):
    """تنقيح: إملاء صح ولهجة سعودية، من غير ما يغيّر عدد السلايدات."""
    with closing(db()) as conn:
        _, data = load_carousel(conn, cid)
    if not data["plan"]:
        raise HTTPException(400, "اكتب الخطة الأول")
    if atlas.mock_mode():
        text = json.dumps(data["plan"], ensure_ascii=False)
    else:
        text = llm(cz.polish_messages(brand_settings(), data["plan"], carousel_context(data)[0]), json_mode=True, temperature=0.3)
    try:
        plan = cz.parse_plan(text)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    old = data["plan"]["slides"]
    if len(plan["slides"]) != len(old):
        raise HTTPException(400, "التنقيح غيّر عدد السلايدات، فمتحفظش. جرّب تاني")
    for new, prev in zip(plan["slides"], old):
        new["visual"] = prev.get("visual") or new["visual"]  # الرسمة متتغيرش
    def put(d):
        d["plan"] = plan
    return carousel_to_dict_by_id(cid, update_carousel(cid, put))


# ---------- الرسم ----------
def mock_image(dest: Path, size: str, label: str, hue: int) -> None:
    w, h = size.split("x")
    colors = ["#E5613E", "#2B6CB0", "#2F855A", "#B7791F", "#6B46C1", "#C53030", "#2C7A7B", "#97266D", "#4A5568", "#DD6B20"]
    time.sleep(1.2)
    subprocess.run(
        [ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
         "-i", f"color=c={colors[hue % len(colors)]}:s={w}x{h}", "-frames:v", "1", str(dest)],
        check=True, capture_output=True,
    )


def reference_list(first: list[Path], assets: dict) -> tuple[list[Path], dict]:
    """ترتيب الصور المرجعية وأرقامها عشان البرومبت يقول «الصورة رقم كذا» (لحد 16 صورة).
    لما الاختيارات تتجمع كل واحد بياخد نصيب: المدرب الأول، وبعده الستايل والتيمبليت، والباقي للشخصيات."""
    files, refs = list(first), {}

    def add(path: Path) -> int | None:
        if len(files) >= 16 or not path.exists():
            return None
        files.append(path)
        return len(files)

    def add_asset(a: dict, limit: int) -> list[int]:
        return [i for img in a["images"][:max(0, limit)] if (i := add(LIBRARY_DIR / a["id"] / img["name"]))]

    logo = logo_path()
    if logo and (i := add(logo)):
        refs["logo"] = i
    tpl, style, chars = assets.get("template"), assets.get("style"), assets.get("characters") or []
    coach, coach_asset = assets.get("coach"), assets.get("coach_asset")
    if coach and (i := add(COACHES_DIR / coach["image_filename"])):
        refs["coach"], refs["coach_name"] = [i], coach["name"]
    elif coach_asset and (idx := add_asset(coach_asset, 3)):
        refs["coach"], refs["coach_name"] = idx, coach_asset["name"]
    others = sum(1 for x in (tpl, style) if x) + (1 if chars else 0)
    if style and (idx := add_asset(style, 6 if others == 1 else 3)):
        refs["style"] = idx
    if tpl and (idx := add_asset(tpl, 12 if others == 1 else 4)):
        refs["template"] = idx
    if chars:
        per = max(1, (16 - len(files)) // len(chars))
        refs["characters"] = [(ch["name"], idx) for ch in chars if (idx := add_asset(ch, per))]
    return files, refs


def draw(prompt: str, size: str, files: list[Path], dest: Path, mock_label: str, hue: int) -> None:
    if atlas.mock_mode():
        return mock_image(dest, size, mock_label, hue)
    cfg = carousel_settings()
    urls = [atlas.reference_url(p) for p in files if p.exists()]
    url = atlas.generate_image(cfg["image_family"], prompt, size, cfg["quality"], urls or None)
    part = dest.with_suffix(".part.png")
    atlas.download(url, part)
    part.replace(dest)


def run_overview(cid: str) -> None:
    try:
        with closing(db()) as conn:
            _, data = load_carousel(conn, cid)
        plan, ratio = data["plan"], data["settings"]["ratio"]
        ctx, assets = carousel_context(data)
        files, refs = reference_list([], assets)
        folder = CAROUSELS_DIR / cid
        folder.mkdir(parents=True, exist_ok=True)
        name = f"overview-{uuid.uuid4().hex[:6]}.png"
        prompt = cz.overview_prompt(brand_settings(), plan, ratio, refs, ctx)
        draw(prompt, cz.overview_size(len(plan["slides"]), ratio), files, folder / name, "overview", 0)
        def done(d):
            # القديم بيفضل محفوظ في النسخ، وتقدر ترجعله
            add_version(d, "overview", name)
            d["overview"] = {"status": "done", "file": name, "error": None, "approved": False}
        update_carousel(cid, done)
    except Exception as exc:  # noqa: BLE001  (أي خطأ يتسجّل على الكاروسيل بدل ما يضيع)
        msg = str(exc)[:400]
        update_carousel(cid, lambda d: d["overview"].update(status="failed", error=msg))
    finally:
        CAROUSEL_JOBS.discard(cid)


def run_slides(cid: str, only: int | None, redo_all: bool = False) -> None:
    """السلايدات بالترتيب، كل واحدة ومعاها الصورة الكاملة والسلايد اللي قبلها."""
    try:
        with closing(db()) as conn:
            _, data = load_carousel(conn, cid)
        plan, ratio = data["plan"], data["settings"]["ratio"]
        folder = CAROUSELS_DIR / cid
        overview = folder / data["overview"]["file"]
        ctx, assets = carousel_context(data)
        size = "x".join(map(str, cz.SIZES[ratio]))
        todo = [only] if only else [k for k in range(1, len(plan["slides"]) + 1)
                                    if redo_all or data["slides"][k - 1]["status"] != "done"]
        for k in todo:
            with closing(db()) as conn:
                _, data = load_carousel(conn, cid)
            update_carousel(cid, lambda d, k=k: d["slides"][k - 1].update(status="working", error=None))
            prev = data["slides"][k - 2] if k > 1 else None
            first = [overview]
            if prev and prev.get("file") and (folder / prev["file"]).exists():
                first.append(folder / prev["file"])
            files, refs = reference_list(first, assets)
            if len(first) > 1:
                refs["previous"] = 2
            name = f"slide-{k:02d}-{uuid.uuid4().hex[:6]}.png"
            try:
                draw(cz.slide_prompt(brand_settings(), plan, k, ratio, refs, ctx), size, files, folder / name, f"slide {k}", k)
            except Exception as exc:  # noqa: BLE001
                msg = str(exc)[:400]
                update_carousel(cid, lambda d, k=k: d["slides"][k - 1].update(status="failed", error=msg))
                break  # اللي بعدها محتاجة دي كمرجع
            def done(d, k=k, name=name):
                add_version(d, str(k), name)
                d["slides"][k - 1] = {"status": "done", "file": name, "error": None}
            update_carousel(cid, done)
    finally:
        CAROUSEL_JOBS.discard(cid)


def start_job(cid: str, target, *args) -> None:
    with CAROUSEL_LOCK:
        if cid in CAROUSEL_JOBS:
            raise HTTPException(400, "فيه رسم شغال للكاروسيل ده. استنى يخلص")
        CAROUSEL_JOBS.add(cid)
    threading.Thread(target=target, args=(cid, *args), daemon=True).start()


def need_atlas() -> None:
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")


@app.post("/api/carousels/{cid}/overview")
def carousel_overview(cid: str):
    """الكاروسيل كله في صورة واحدة، عشان نشوف الشكل ونوافق قبل السلايدات."""
    need_atlas()
    with closing(db()) as conn:
        _, data = load_carousel(conn, cid)
    if not data["plan"]:
        raise HTTPException(400, "اكتب الخطة الأول")
    check_kind_ready(data)
    if cid in CAROUSEL_JOBS:
        raise HTTPException(400, "فيه رسم شغال للكاروسيل ده. استنى يخلص")
    update_carousel(cid, lambda d: d["overview"].update(status="working", error=None))
    start_job(cid, run_overview)
    return get_carousel(cid)


@app.post("/api/carousels/{cid}/approve")
def carousel_approve(cid: str):
    with closing(db()) as conn:
        _, data = load_carousel(conn, cid)
    if data["overview"]["status"] != "done":
        raise HTTPException(400, "ارسم الشكل العام الأول")
    update_carousel(cid, lambda d: d["overview"].update(approved=True))
    return get_carousel(cid)


@app.post("/api/carousels/{cid}/slides")
def carousel_slides(cid: str, only: int | None = None, redo_all: bool = False):
    """يرسم السلايدات اللي لسه (أو سلايد واحدة لو only، أو نسخة جديدة لكلهم لو redo_all).
    النسخ القديمة بتفضل محفوظة."""
    need_atlas()
    with closing(db()) as conn:
        _, data = load_carousel(conn, cid)
    if not data["overview"].get("approved"):
        raise HTTPException(400, "وافق على الشكل العام الأول")
    n = len(data["plan"]["slides"])
    if only is not None and not 1 <= only <= n:
        raise HTTPException(400, "رقم السلايد غلط")
    if cid in CAROUSEL_JOBS:
        raise HTTPException(400, "فيه رسم شغال للكاروسيل ده. استنى يخلص")
    def mark(d):
        for k in ([only] if only else range(1, n + 1)):
            if only or redo_all or d["slides"][k - 1]["status"] != "done":
                d["slides"][k - 1].update(status="queued", error=None)
    update_carousel(cid, mark)
    start_job(cid, run_slides, only, redo_all)
    return get_carousel(cid)


class PickIn(BaseModel):
    target: str  # "overview" أو رقم السلايد
    file: str


@app.post("/api/carousels/{cid}/pick")
def carousel_pick(cid: str, body: PickIn):
    """تختار نسخة قديمة لسلايد (أو للشكل العام) بدل اللي متختارة."""
    if cid in CAROUSEL_JOBS:
        raise HTTPException(400, "استنى لحد ما الرسم يخلص")
    def pick(d):
        if body.file not in [v["file"] for v in d.get("versions", {}).get(body.target, [])]:
            raise HTTPException(404, "النسخة دي مش موجودة")
        if body.target == "overview":
            d["overview"].update(status="done", file=body.file, error=None)
            return
        k = int(body.target) if body.target.isdigit() else 0
        if not 1 <= k <= len(d["slides"]):
            raise HTTPException(400, "رقم السلايد غلط")
        d["slides"][k - 1] = {"status": "done", "file": body.file, "error": None}
    return carousel_to_dict_by_id(cid, update_carousel(cid, pick))


@app.delete("/api/carousels/{cid}/versions")
def carousel_delete_version(cid: str, target: str, file: str):
    """مسح نسخة مش عايزها (المتختارة مش بتتمسح)."""
    if cid in CAROUSEL_JOBS:
        raise HTTPException(400, "استنى لحد ما الرسم يخلص")
    def drop(d):
        cur = d["overview"].get("file") if target == "overview" else (
            d["slides"][int(target) - 1].get("file") if target.isdigit() and 1 <= int(target) <= len(d["slides"]) else None)
        if file == cur:
            raise HTTPException(400, "دي النسخة المتختارة. اختار غيرها الأول")
        if file not in [v["file"] for v in d.get("versions", {}).get(target, [])]:
            raise HTTPException(404, "النسخة دي مش موجودة")
        d.get("versions", {})[target] = [v for v in d.get("versions", {}).get(target, []) if v["file"] != file]
    data = update_carousel(cid, drop)
    (CAROUSELS_DIR / cid / Path(file).name).unlink(missing_ok=True)
    return carousel_to_dict_by_id(cid, data)


def post_images(cid: str, data: dict) -> list[Path]:
    """السلايدات بمقاس النشر (1080×1350 JPG)، بتتعمل مرة وبتتحدّث لو السلايد اتغيّر."""
    w, h = cz.POST_SIZES.get(data["settings"].get("ratio"), cz.POST_SIZES["4:5"])
    out_dir = CAROUSELS_DIR / cid / "post"
    out_dir.mkdir(exist_ok=True)
    out = []
    for k, s in enumerate(data["slides"], 1):
        src = CAROUSELS_DIR / cid / s["file"] if s.get("file") else None
        if not src or not src.exists():
            continue
        dest = out_dir / f"{k:02d}.jpg"
        # بنفتكر الصورة اتعملت من أنهي نسخة (لو اخترت نسخة أقدم لازم تتعمل تاني)
        made_from = out_dir / f"{k:02d}.src"
        if not dest.exists() or not made_from.exists() or made_from.read_text() != s["file"]:
            subprocess.run(
                [ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
                 "-vf", f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}", "-q:v", "2", str(dest)],
                check=True, capture_output=True, timeout=60,
            )
            made_from.write_text(s["file"])
        out.append(dest)
    return out


def ready_slides(cid: str) -> tuple[sqlite3.Row, dict, list[Path]]:
    with closing(db()) as conn:
        row, data = load_carousel(conn, cid)
    if not data["slides"] or any(s.get("status") != "done" or not s.get("file") for s in data["slides"]):
        raise HTTPException(400, "خلّص رسم كل السلايدات الأول")
    if cid in CAROUSEL_JOBS:
        raise HTTPException(400, "استنى لحد ما الرسم يخلص")
    return row, data, post_images(cid, data)


class CarouselPostIn(BaseModel):
    caption: str = ""
    scheduled_at: datetime
    options: PostOptions = PostOptions()


@app.post("/api/carousels/{cid}/publish")
def publish_carousel(cid: str, body: CarouselPostIn):
    """كاروسيل صور على إنستجرام عن طريق Zernio (فوري أو مجدول)، مع تاج المدرب على سلايد."""
    _, _, images = ready_slides(cid)
    if not 2 <= len(images) <= 10:
        raise HTTPException(400, "إنستجرام بيقبل كاروسيل من 2 لـ 10 صور")
    when = body.scheduled_at
    if when.tzinfo is None:
        raise HTTPException(400, "الميعاد لازم يكون فيه المنطقة الزمنية")
    when = when.astimezone(timezone.utc).isoformat(timespec="seconds")
    options = clean_options(body.options)
    post_id = uuid.uuid4().hex[:12]
    status = "sending" if publisher.service_name() == "zernio" else "scheduled"
    with closing(db()) as conn, conn:
        conn.execute(
            "INSERT INTO posts (id, export_id, carousel_id, caption, platforms, scheduled_at, status, options, created_at, updated_at) "
            "VALUES (?, '', ?, ?, ?, ?, ?, ?, ?, ?)",
            (post_id, cid, body.caption.strip(), json.dumps(["instagram"]), when, status, options, now(), now()),
        )
    after_save(post_id, when, None)
    with closing(db()) as conn:
        return post_to_dict(conn.execute(POSTS_QUERY + " WHERE p.id = ?", (post_id,)).fetchone())


class ReelIn(BaseModel):
    music_id: str | None = None
    seconds: float = 3.0  # مدة كل سلايد


@app.post("/api/carousels/{cid}/reel")
def carousel_reel(cid: str, body: ReelIn):
    """ريل من السلايدات + موسيقى من المكتبة (إنستجرام مش بيقبل موسيقى على الكاروسيل من الـ API).
    السلايد 4:5 في نص فيديو 9:16 على خلفية كريمي، وبيتحفظ في الفيديوهات الجاهزة عشان يتنشر زي أي فيديو."""
    row, data, images = ready_slides(cid)
    sec = max(1.5, min(8.0, float(body.seconds or 3)))
    total = sec * len(images)
    music = None
    if body.music_id:
        with closing(db()) as conn:
            music = conn.execute("SELECT * FROM audio WHERE id = ? AND kind = 'music'", (body.music_id,)).fetchone()
        if music is None:
            raise HTTPException(400, "الموسيقى مش موجودة في المكتبة")
    cmd = [ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y"]
    for img in images:
        cmd += ["-loop", "1", "-t", f"{sec:.2f}", "-i", str(img)]
    if music:
        cmd += ["-stream_loop", "-1", "-i", str(AUDIO_DIR / music["filename"])]
    else:
        cmd += ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]
    n = len(images)
    vf = "".join(f"[{i}:v]scale=1080:1350,pad=1080:1920:0:285:color=0xEEECDA,setsar=1,fps=30,format=yuv420p[v{i}];" for i in range(n))
    vf += "".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[v];"
    vf += f"[{n}:a]atrim=0:{total:.2f},afade=t=out:st={max(0, total - 1.5):.2f}:d=1.5,asetpts=N/SR/TB[a]"
    export_id = uuid.uuid4().hex[:12]
    filename = f"{export_id}.mp4"
    cmd += ["-filter_complex", vf, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast",
            "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-t", f"{total:.2f}", "-movflags", "+faststart",
            str(EXPORTS_DIR / filename)]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=600)
    except subprocess.CalledProcessError as exc:
        (EXPORTS_DIR / filename).unlink(missing_ok=True)
        raise HTTPException(500, f"مقدرتش أعمل الريل: {exc.stderr.decode(errors='ignore')[-300:]}") from exc
    name = f"ريل {row['name']}"
    with closing(db()) as conn, conn:
        conn.execute("INSERT INTO exports (id, name, filename, duration, source, project_id, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)",
                     (export_id, name, filename, total, "carousel", now()))
    return {"id": export_id, "name": name, "url": f"/media/exports/{filename}", "duration": total}


@app.get("/api/carousels/{cid}/zip")
def carousel_zip(cid: str):
    import io
    import zipfile

    with closing(db()) as conn:
        row, data = load_carousel(conn, cid)
    files = post_images(cid, data)
    if not files:
        raise HTTPException(400, "لسه مفيش سلايدات جاهزة")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as z:
        for p in files:
            z.write(p, p.name)
        plan = data["plan"] or {}
        caption = "\n\n".join(filter(None, [plan.get("caption"), " ".join(plan.get("hashtags") or [])]))
        if caption:
            z.writestr("caption.txt", caption)
    name = export_file_name(row["name"]).rsplit(".", 1)[0] + ".zip"
    return Response(buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}"})


# ---------- المسلسلات: سكريبت ← صوت مترقّم ← لقطات ببرومبتات ← نسخ لكل لقطة ← تجميع الحلقة ----------
SERIES_LOCK = threading.Lock()
SERIES_JOBS: set[str] = set()  # حلقات بيتجمّع فيها الفيديو دلوقتي
series_executor = ThreadPoolExecutor(max_workers=2)
prompt_executor = ThreadPoolExecutor(max_workers=4)  # برومبتات جديدة بعد تغيير الكلام
REPROMPT_BATCH = 8
SERIES_W, SERIES_H = 1080, 1920


def series_settings() -> dict:
    return {
        "text_model": auth.get_setting("series_text_model") or atlas.DEFAULT_SERIES_MODEL,
        "video_model": auth.get_setting("series_video_model") or atlas.MODEL,
    }


def new_series_data() -> dict:
    return {"bible": "", "character": "", "refs": []}


def series_row(conn: sqlite3.Connection, sid: str) -> tuple[sqlite3.Row, dict]:
    r = conn.execute("SELECT * FROM series WHERE id = ?", (sid,)).fetchone()
    if r is None:
        raise HTTPException(404, "المسلسل غير موجود")
    return r, {**new_series_data(), **json.loads(r["data"])}


def series_to_dict(r: sqlite3.Row, data: dict, episodes: list[dict]) -> dict:
    sid = r["id"]
    return {
        "id": sid, "name": r["name"], "bible": data["bible"], "character": data["character"],
        "refs": [{"file": f, "url": f"/media/series/{sid}/refs/{f}"} for f in data["refs"] if (SERIES_DIR / sid / "refs" / f).exists()],
        "episodes": episodes,
    }


def new_episode_data() -> dict:
    return {"script": "", "notes": "", "chat": [], "script_approved": False, "audio": None, "scenes": [], "lines": [], "timing": None,
            "shots": [], "takes": {}, "render": {"status": "idle", "export_id": None, "error": None}}


def episode_row(conn: sqlite3.Connection, eid: str) -> tuple[sqlite3.Row, dict]:
    r = conn.execute("SELECT * FROM episodes WHERE id = ?", (eid,)).fetchone()
    if r is None:
        raise HTTPException(404, "الحلقة غير موجودة")
    return r, {**new_episode_data(), **json.loads(r["data"])}


def update_episode(eid: str, fn) -> dict:
    """تعديل آمن (التوليد والتجميع شغالين في الخلفية على نفس الحلقة)."""
    with SERIES_LOCK, closing(db()) as conn, conn:
        _, data = episode_row(conn, eid)
        fn(data)
        conn.execute("UPDATE episodes SET data = ?, updated_at = ? WHERE id = ?", (json.dumps(data, ensure_ascii=False), now(), eid))
        return data


def ep_dir(eid: str) -> Path:
    d = SERIES_DIR / "episodes" / Path(eid).name
    (d / "takes").mkdir(parents=True, exist_ok=True)
    (d / "frames").mkdir(parents=True, exist_ok=True)
    return d


def take_to_dict(eid: str, t: dict) -> dict:
    f = ep_dir(eid) / "takes" / t["file"] if t.get("file") else None
    return {**t, "url": f"/media/series/episodes/{eid}/takes/{t['file']}" if f and f.exists() else None}


def frame_url(eid: str, name: str | None) -> str | None:
    p = ep_dir(eid) / "frames" / name if name else None
    return f"/media/series/episodes/{eid}/frames/{name}?v={int(p.stat().st_mtime)}" if p and p.exists() else None


def episode_to_dict(r: sqlite3.Row, data: dict) -> dict:
    eid = r["id"]
    audio = data["audio"]
    takes = {k: take_to_dict(eid, t) for k, t in data["takes"].items()}
    used = {tid for s in data["shots"] for tid in s.get("takes", [])}
    return {
        "id": eid, "series_id": r["series_id"], "number": r["number"], "name": r["name"],
        "script": data["script"], "notes": data["notes"], "scenes": data["scenes"], "lines": data["lines"],
        "chat": data["chat"], "script_approved": data["script_approved"],
        "heard": " ".join(str(w.get("w", "")) for w in data.get("words") or []),
        "timing": data["timing"],
        "audio": {**audio, "url": f"/media/series/episodes/{eid}/{audio['file']}"} if audio else None,
        "shots": [{**s, "duration": round(s["end"] - s["start"], 2), "takes": [takes[t] for t in s.get("takes", []) if t in takes],
                   "frames": [{"file": f, "url": frame_url(eid, f)} for f in s.get("frames", []) if frame_url(eid, f)],
                   "frame_url": frame_url(eid, s.get("frame"))}
                  for s in data["shots"]],
        # نسخ من قوايم لقطات قديمة: محفوظة وتقدر تحطها على أي لقطة
        "pool": [t for k, t in takes.items() if k not in used],
        "render": data["render"], "busy": eid in SERIES_JOBS, "project_id": data.get("project_id"),
        "export_url": None,
        "rewrite": data.get("rewrite") or {"chat": [], "lines": []}, "copy_of": data.get("copy_of"),
        "voice_pending": bool(data.get("voice_pending")), "retime": bool(data.get("retime")),
        "retimed": data.get("retimed"),
    }


def episode_response(eid: str) -> dict:
    with closing(db()) as conn:
        r, data = episode_row(conn, eid)
        out = episode_to_dict(r, data)
        if data["render"].get("export_id"):
            e = conn.execute("SELECT filename FROM exports WHERE id = ?", (data["render"]["export_id"],)).fetchone()
            out["export_url"] = f"/media/exports/{e['filename']}" if e else None
    return out


@app.get("/api/series")
def list_series():
    with closing(db()) as conn:
        out = []
        for r in conn.execute("SELECT * FROM series ORDER BY created_at"):
            data = {**new_series_data(), **json.loads(r["data"])}
            if not owned(data.get("client_id")):
                continue  # مسلسلات عميل تاني
            eps = [{"id": e["id"], "number": e["number"], "name": e["name"]}
                   for e in conn.execute("SELECT id, number, name FROM episodes WHERE series_id = ? ORDER BY number", (r["id"],))]
            out.append(series_to_dict(r, data, eps))
        return {"series": out, "settings": series_settings(), "configured": bool(atlas.api_key()) or atlas.mock_mode()}


class NameIn(BaseModel):
    name: str


@app.post("/api/series")
def create_series(body: NameIn):
    sid = uuid.uuid4().hex[:12]
    with closing(db()) as conn, conn:
        conn.execute("INSERT INTO series (id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                     (sid, body.name.strip() or "مسلسل جديد", json.dumps({**new_series_data(), "client_id": active_client_id()}), now(), now()))
    return list_series()


class SeriesPatch(BaseModel):
    name: str | None = None
    bible: str | None = None
    character: str | None = None


@app.patch("/api/series/{sid}")
def patch_series(sid: str, body: SeriesPatch):
    with closing(db()) as conn, conn:
        r, data = series_row(conn, sid)
        for k in ("bible", "character"):
            if getattr(body, k) is not None:
                data[k] = getattr(body, k)[:20000]
        name = body.name.strip() if body.name and body.name.strip() else r["name"]
        conn.execute("UPDATE series SET name = ?, data = ?, updated_at = ? WHERE id = ?", (name, json.dumps(data, ensure_ascii=False), now(), sid))
    return list_series()


@app.post("/api/series/{sid}/refs")
def add_series_refs(sid: str, files: list[UploadFile] = File(...)):
    """صور الشخصية: بتتبعت مع كل لقطة عشان شكله يفضل ثابت."""
    folder = SERIES_DIR / Path(sid).name / "refs"
    folder.mkdir(parents=True, exist_ok=True)
    with closing(db()) as conn, conn:
        _, data = series_row(conn, sid)
        for f in files:
            data["refs"].append(save_upload(f, IMAGE_EXTENSIONS, folder, "ref"))
        conn.execute("UPDATE series SET data = ?, updated_at = ? WHERE id = ?", (json.dumps(data, ensure_ascii=False), now(), sid))
    return list_series()


@app.delete("/api/series/{sid}/refs")
def delete_series_ref(sid: str, file: str):
    with closing(db()) as conn, conn:
        _, data = series_row(conn, sid)
        data["refs"] = [f for f in data["refs"] if f != file]
        conn.execute("UPDATE series SET data = ?, updated_at = ? WHERE id = ?", (json.dumps(data, ensure_ascii=False), now(), sid))
    (SERIES_DIR / Path(sid).name / "refs" / Path(file).name).unlink(missing_ok=True)
    return list_series()


class EpisodeIn(BaseModel):
    name: str
    number: int | None = None


@app.post("/api/series/{sid}/episodes")
def create_episode(sid: str, body: EpisodeIn):
    eid = uuid.uuid4().hex[:12]
    with closing(db()) as conn, conn:
        series_row(conn, sid)
        n = body.number or (conn.execute("SELECT COALESCE(MAX(number), 0) FROM episodes WHERE series_id = ?", (sid,)).fetchone()[0] + 1)
        conn.execute("INSERT INTO episodes (id, series_id, number, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                     (eid, sid, n, body.name.strip() or f"الحلقة {n}", json.dumps(new_episode_data()), now(), now()))
    return episode_response(eid)


@app.post("/api/episodes/{eid}/duplicate")
def duplicate_episode(eid: str):
    """نسخة كاملة من الحلقة (السكريبت والصوت والستوري بورد والفيديوهات) تعدّل عليها من غير ما تلمس الأصلية."""
    with closing(db()) as conn:
        r, data = episode_row(conn, eid)
    new_id = uuid.uuid4().hex[:12]
    src, dst = ep_dir(eid), SERIES_DIR / "episodes" / new_id
    need = sum(f.stat().st_size for f in src.rglob("*") if f.is_file())
    if free_mb(SERIES_DIR) * 1024 * 1024 < need + 200 * 1024 * 1024:
        raise HTTPException(400, space_message(None, free_mb(SERIES_DIR)))
    shutil.copytree(src, dst)
    data = json.loads(json.dumps(data))
    # اللي كان شغال وقت النسخ بيكمل في الأصلية بس؛ هنا ↻ بيكمّله من غير دفع تاني
    for t in data["takes"].values():
        if t.get("status") in ("queued", "working"):
            t.update(status="failed", error="كانت بتتولد وقت النسخ. دوس ↻ تكمّل (من غير دفع تاني لو الطلب كان اتبعت)")
    for sh in data["shots"]:
        if sh.get("frame_status") in ("queued", "working"):
            sh.update(frame_status="failed", frame_error="كانت بتترسم وقت النسخ. ارسم تاني")
    data.update(render={"status": "idle", "export_id": None, "error": None}, project_id=None, copy_of=eid)
    with closing(db()) as conn, conn:
        conn.execute("INSERT INTO episodes (id, series_id, number, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                     (new_id, r["series_id"], r["number"], f"{r['name']} (نسخة)", json.dumps(data, ensure_ascii=False), now(), now()))
    return episode_response(new_id)


@app.get("/api/episodes/{eid}")
def get_episode(eid: str):
    return episode_response(eid)


@app.delete("/api/episodes/{eid}")
def delete_episode(eid: str):
    if eid in SERIES_JOBS:
        raise HTTPException(400, "استنى لحد ما التجميع يخلص")
    with closing(db()) as conn, conn:
        conn.execute("DELETE FROM episodes WHERE id = ?", (eid,))
    shutil.rmtree(SERIES_DIR / "episodes" / Path(eid).name, ignore_errors=True)
    return {"ok": True}


class EpisodePatch(BaseModel):
    name: str | None = None
    script: str | None = None
    notes: str | None = None
    lines: list[dict] | None = None  # تعديل توقيت الجمل بإيدك
    shot: dict | None = None  # تعديل لقطة واحدة: {id, title, prompt, camera, ..., start, end}


@app.patch("/api/episodes/{eid}")
def patch_episode(eid: str, body: EpisodePatch):
    def fn(d):
        if body.script is not None:
            d["script"] = body.script[:60000]
            parsed = sz.parse_script(d["script"])
            old = {ln["text"]: ln for ln in d["lines"]}
            # الجمل اللي ما اتغيرتش بتحتفظ بتوقيتها
            d["scenes"] = parsed["scenes"]
            d["lines"] = [{**ln, "start": old.get(ln["text"], {}).get("start"), "end": old.get(ln["text"], {}).get("end")}
                          for ln in parsed["lines"]]
        if body.notes is not None:
            d["notes"] = body.notes[:4000]
        if body.lines is not None:
            by_n = {int(x.get("n", 0)): x for x in body.lines}
            for ln in d["lines"]:
                x = by_n.get(ln["n"])
                if x:
                    ln["start"], ln["end"] = round(float(x["start"]), 2), round(float(x["end"]), 2)
            d["timing"] = "manual"
        if body.shot:
            s = next((s for s in d["shots"] if s["id"] == body.shot.get("id")), None)
            if s is None:
                raise HTTPException(404, "اللقطة مش موجودة")
            for k in ("title", "prompt", "camera", "shot", "location", "sfx", "transition"):
                if k in body.shot:
                    s[k] = str(body.shot[k] or "")[:3000]
            if "offset" in body.shot:
                s["offset"] = max(0.0, round(float(body.shot["offset"] or 0), 2))
            if "approved" in body.shot:
                s["approved"] = bool(body.shot["approved"])
            if "end" in body.shot:
                # تغيير نهاية لقطة بيحرّك بداية اللي بعدها (الحلقة تفضل متلاصقة على الصوت)
                k = d["shots"].index(s)
                nxt = d["shots"][k + 1] if k + 1 < len(d["shots"]) else None
                hi = nxt["end"] - 0.3 if nxt else s["end"]
                s["end"] = round(min(max(float(body.shot["end"]), s["start"] + 0.3), hi), 2)
                if nxt:
                    nxt["start"] = s["end"]
    with closing(db()) as conn, conn:
        if body.name and body.name.strip():
            conn.execute("UPDATE episodes SET name = ? WHERE id = ?", (body.name.strip(), eid))
    update_episode(eid, fn)
    return episode_response(eid)


@app.post("/api/episodes/{eid}/audio")
def upload_episode_audio(eid: str, file: UploadFile = File(...)):
    """الفويس أوفر: هو المرجع للتوقيت ومدة الحلقة."""
    folder = ep_dir(eid)
    name = save_audio_upload(file, folder, "voiceover")
    try:
        duration = probe_duration(folder / name)
    except Exception as exc:  # noqa: BLE001
        (folder / name).unlink(missing_ok=True)
        raise HTTPException(400, f"مقدرتش أقرا الملف الصوتي: {exc}") from exc
    def fn(d):
        if d["shots"] and d["audio"] and not d.get("retime") and d["lines"] and all(ln.get("start") is not None for ln in d["lines"]):
            d["retime"] = {"old": {str(ln["n"]): [ln["start"], ln["end"]] for ln in d["lines"]}, "total": d["audio"]["duration"]}
        if d["audio"]:
            (folder / d["audio"]["file"]).unlink(missing_ok=True)
        d["audio"] = {"file": name, "duration": round(duration, 2), "name": file.filename}
        d["voice_pending"] = False
        d["timing"] = None
        for ln in d["lines"]:
            ln["start"] = ln["end"] = None
    update_episode(eid, fn)
    return episode_response(eid)


def speech_segments(path: Path) -> list[tuple[float, float]]:
    """أماكن الكلام في الصوت (بين السكتات)."""
    out = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", str(path), "-af", "silencedetect=noise=-35dB:d=0.35", "-f", "null", "-"],
                         capture_output=True, text=True, timeout=300).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    segs, t = [], 0.0
    for a, b in zip(starts, ends):
        if a - t > 0.12:
            segs.append((t, a))
        t = b
    total = probe_duration(path)
    if len(ends) == len(starts) and total - t > 0.12:
        segs.append((t, total))
    return [s for s in segs if s[1] - s[0] > 0.1]


@app.post("/api/episodes/{eid}/timing")
def episode_timing(eid: str, mode: str = "auto"):
    """يرقّم كل جملة من السكريبت بوقتها في الصوت. auto: موديل الكلام (كل كلمة بوقتها)، ولو مش متاح: تقدير من السكتات."""
    with closing(db()) as conn:
        _, data = episode_row(conn, eid)
    if not data["audio"]:
        raise HTTPException(400, "ارفع الفويس أوفر الأول")
    path = ep_dir(eid) / data["audio"]["file"]
    if not data["lines"]:
        # من غير سكريبت: الجمل بتتاخد من الصوت نفسه (محتاج موديل الكلام)
        if atlas.mock_mode():
            mode = "audio"
        elif not atlas.api_key():
            raise HTTPException(400, "من غير سكريبت لازم موديل الكلام يسمع الصوت: حط مفتاح Atlas من ⚙️ الإعدادات، أو الزق السكريبت في «كتابة الحلقة»")
        else:
            mode = "audio"
    source, timed, words, heard_lines = "estimate", None, None, None
    if mode != "estimate" and (atlas.api_key() and not atlas.mock_mode() or (atlas.mock_mode() and not data["lines"])):
        try:
            words = atlas.transcribe(path, data["audio"]["duration"])
            timed, ratio = sz.align_with_ratio(words, data["lines"])
            source = "stt"
            # الصوت اتسجّل بكلام مختلف عن السكريبت: الصوت هو المرجع، فالجمل بتتاخد منه هو
            if ratio < 0.6 or mode == "audio":
                heard_lines, source = sz.sentences_from_words(words), "audio"
        except (atlas.AtlasError, httpx.HTTPError) as exc:
            if mode in ("stt", "audio"):
                raise HTTPException(400, f"موديل الكلام: {exc}") from exc
    if timed is None and heard_lines is None:
        timed = sz.estimate(speech_segments(path), data["lines"])
    def fn(d):
        if words is not None:
            d["words"] = words
        if heard_lines is not None:
            d["lines"] = heard_lines
        else:
            for ln, t in zip(d["lines"], timed):
                ln["start"], ln["end"] = t["start"], t["end"]
        d["timing"] = source
        retime_shots(d, matched=heard_lines is None)
    update_episode(eid, fn)
    describe_new_shots(eid)
    return episode_response(eid)


def describe_new_shots(eid: str) -> None:
    """اللقطات اللي اتعملت لجمل جديدة: الموديل يكتب وصفها وبرومبتها على أسلوب اللي جنبها (كلهم مع بعض)."""
    with closing(db()) as conn:
        r, data = episode_row(conn, eid)
        _, sdata = series_for_episode(conn, r)
    shots = data["shots"]
    todo = [k for k, x in enumerate(shots) if x.get("needs_describe")]
    if not todo:
        return
    def one(k: int) -> tuple[str, dict | None]:
        x = shots[k]
        prev = next((shots[i] for i in range(k - 1, -1, -1) if not shots[i].get("needs_describe")), None)
        nxt = next((shots[i] for i in range(k + 1, len(shots)) if not shots[i].get("needs_describe")), None)
        said = [ln["text"] for ln in data["lines"] if ln["n"] in (x.get("lines") or [])]
        if atlas.mock_mode():
            return x["id"], sz.mock_one_shot(prev, said[0] if said else "")
        if not atlas.api_key():
            return x["id"], None
        try:
            return x["id"], sz.parse_one_shot(series_chat(sz.insert_shot_messages(
                sdata["bible"], sdata["character"], prev, nxt, said, x["end"] - x["start"], "")))
        except (HTTPException, ValueError):
            return x["id"], None
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = dict(pool.map(one, todo))
    def fn(d):
        for x in d["shots"]:
            if x["id"] in results:
                if results[x["id"]]:
                    x.update(results[x["id"]])
                x.pop("needs_describe", None)
    update_episode(eid, fn)


def retime_shots(d: dict, matched: bool) -> None:
    """بعد صوت جديد: كل لقطة تتحرك وتتمط على مكان جملها في الصوت الجديد، والفيديوهات زي ما هي.
    matched: الجمل هي هي بنفس أرقامها (اتقرت من السكريبت)، غير كده بنمط الحلقة كلها بالتناسب."""
    rt = d.pop("retime", None)
    if not rt or not d["shots"] or not d["audio"]:
        return
    total = d["audio"]["duration"]
    added = set(rt.get("added") or []) if matched else set()
    holes, prev_end, group = [], 0.0, []
    for ln in d["lines"] + [None]:
        if ln is not None and ln["n"] in added:
            if ln.get("start") is not None:
                group.append(ln)
            continue
        if group:
            holes.append((prev_end, min(x["start"] for x in group), max(x["end"] for x in group)))
            group = []
        if ln is not None and str(ln["n"]) in rt["old"]:
            prev_end = rt["old"][str(ln["n"])][1]
    d["shots"] = sz.warp_shots(d["shots"], rt["old"] if matched else {}, rt["total"], d["lines"], total, holes)
    if not matched:
        for sh in d["shots"]:
            sh["lines"] = sz.lines_in_shot(sh, d["lines"])
    if added:
        sz.carve_new_shots(d["shots"], d["lines"], sorted(added), total)
    for ln in d["lines"]:
        ln.pop("added", None)
    short = []
    for sh in d["shots"]:
        t = d["takes"].get(sh.get("chosen") or "")
        if t and t.get("duration") and t["duration"] - (sh.get("offset") or 0) < sh["end"] - sh["start"] - 0.05:
            short.append(sh["n"])
    d["retimed"] = {"at": now(), "short": short, "added": [sh["n"] for sh in d["shots"] if sh.get("needs_describe")]}


def series_for_episode(conn: sqlite3.Connection, r: sqlite3.Row) -> tuple[sqlite3.Row, dict]:
    return series_row(conn, r["series_id"])


def series_chat(messages: list[dict], json_mode: bool = True) -> str:
    """GPT 5.6 Luna (أو اللي متختار في الإعدادات). لو الاسم مش موجود في Atlas بندوّر على أقرب موديل ونحفظه."""
    preferred = series_settings()["text_model"]
    errors = []
    for model in atlas.model_candidates(preferred, ("luna",), [carousel_settings()["text_model"]])[:5]:
        try:
            reply = atlas.chat(messages, model, temperature=0.6 if json_mode else 0.8, max_tokens=12000, json_mode=json_mode)
        except (atlas.AtlasError, httpx.HTTPError) as exc:
            errors.append(f"{model}: {str(exc)[:120]}")
            continue
        if model != preferred:
            auth.set_setting("series_text_model", model)
        return reply
    raise HTTPException(400, "موديل اللقطات مش شغال: " + " | ".join(errors[:3]))


@app.post("/api/episodes/{eid}/shots")
def episode_shots(eid: str):
    """الموديل يقسّم الحلقة للقطات على توقيت الصوت، ويكتب برومبت لكل لقطة. النسخ القديمة بتفضل محفوظة."""
    with closing(db()) as conn:
        r, data = episode_row(conn, eid)
        _, sdata = series_for_episode(conn, r)
    if not data["audio"] or not data["lines"] or any(ln.get("start") is None for ln in data["lines"]):
        raise HTTPException(400, "رقّم جمل الفويس أوفر على الصوت الأول")
    total = data["audio"]["duration"]
    if atlas.mock_mode():
        shots = sz.mock_shots(data["lines"], total)
    else:
        if not atlas.api_key():
            raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
        reply = series_chat(sz.shots_messages(sdata["bible"], sdata["character"], data["script"], data["lines"], total, data["notes"]))
        try:
            shots = sz.parse_shots(reply, total)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
    for s in shots:
        s.update(id=uuid.uuid4().hex[:10], takes=[], chosen=None, offset=0.0, approved=False,
                 frames=[], frame=None, frame_status="idle", frame_error=None)
    def fn(d):
        d["shots"] = shots
    update_episode(eid, fn)
    return episode_response(eid)


def find_shot(d: dict, shot_id: str) -> dict:
    s = next((s for s in d["shots"] if s["id"] == shot_id), None)
    if s is None:
        raise HTTPException(404, "اللقطة مش موجودة")
    return s


@app.post("/api/episodes/{eid}/shots/{shot_id}/takes")
def upload_take(eid: str, shot_id: str, file: UploadFile = File(...)):
    """فيديو جاهز (اتعمل برة البرنامج) كنسخة للقطة."""
    folder = ep_dir(eid) / "takes"
    name = save_upload(file, VIDEO_EXTENSIONS, folder, "take")
    try:
        duration = probe_duration(folder / name)
    except Exception as exc:  # noqa: BLE001
        (folder / name).unlink(missing_ok=True)
        raise HTTPException(400, f"مقدرتش أقرا الفيديو: {exc}") from exc
    tid = uuid.uuid4().hex[:10]
    def fn(d):
        s = find_shot(d, shot_id)
        # الفيديو اللي بترفعه بنفسك معتمد على طول
        d["takes"][tid] = {"id": tid, "file": name, "source": "upload", "status": "done", "error": None, "approved": True,
                           "duration": round(duration, 2), "name": file.filename, "created_at": now()}
        s["takes"].append(tid)
        s["chosen"], s["offset"] = tid, 0.0
    update_episode(eid, fn)
    return episode_response(eid)


class TakeIn(BaseModel):
    take_id: str


@app.post("/api/episodes/{eid}/shots/{shot_id}/pick")
def pick_take(eid: str, shot_id: str, body: TakeIn):
    """تختار نسخة للقطة (من نسخها، أو من النسخ المحفوظة من قوايم قديمة)."""
    def fn(d):
        s = find_shot(d, shot_id)
        if body.take_id not in d["takes"]:
            raise HTTPException(404, "النسخة مش موجودة")
        if body.take_id not in s["takes"]:
            for other in d["shots"]:
                if body.take_id in other["takes"] and other is not s:
                    other["takes"].remove(body.take_id)
                    if other["chosen"] == body.take_id:
                        other["chosen"] = other["takes"][-1] if other["takes"] else None
            s["takes"].append(body.take_id)
        s["chosen"], s["offset"] = body.take_id, 0.0
    update_episode(eid, fn)
    return episode_response(eid)


@app.delete("/api/episodes/{eid}/takes/{take_id}")
def delete_take(eid: str, take_id: str):
    file = None
    def fn(d):
        nonlocal file
        t = d["takes"].pop(take_id, None)
        if t is None:
            raise HTTPException(404, "النسخة مش موجودة")
        if t["status"] in ("queued", "working"):
            raise HTTPException(400, "النسخة دي لسه بتتولد")
        file = t.get("file")
        for s in d["shots"]:
            if take_id in s["takes"]:
                s["takes"].remove(take_id)
                if s["chosen"] == take_id:
                    s["chosen"] = s["takes"][-1] if s["takes"] else None
    update_episode(eid, fn)
    if file:
        (ep_dir(eid) / "takes" / Path(file).name).unlink(missing_ok=True)
    return episode_response(eid)


def shot_prompt(s: dict, character: str) -> str:
    parts = [s.get("prompt") or s.get("title") or ""]
    if s.get("frame"):
        parts.append("The first reference image is the approved storyboard frame: keep its composition, framing, setting and lighting.")
    if character.strip():
        parts.append(f"Character (keep identical to the reference images): {character.strip()}")
    parts.append("Vertical 9:16, cinematic, realistic, natural light. The man never talks to the camera. No on-screen text, no subtitles, no logos.")
    return "\n".join(p for p in parts if p)


def seedance_ref(path: Path) -> Path:
    """Seedance بيرفض الصور اللي ضلعها أقل من 300 أو أكتر من 6000 بكسل، أو نسبتها (العرض÷الطول) برة 0.4–2.5.
    بنعمل نسخة متظبطة (JPG): هوامش للصور الطويلة أو العريضة أوي (من غير ما نقص منها)، وبعدين تكبير أو تصغير."""
    probe = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", str(path)], capture_output=True, text=True, timeout=30).stderr
    m = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", probe)
    w, h = (int(m.group(1)), int(m.group(2))) if m else (0, 0)
    ok_ratio = w and h and 0.45 <= w / h <= 2.2
    if ok_ratio and 300 <= min(w, h) and max(w, h) <= 6000 and path.suffix.lower() in (".jpg", ".jpeg", ".png"):
        return path
    out = TMP_DIR / "seedance_refs" / f"{path.parent.name}-{path.stem}-{int(path.stat().st_mtime)}-v2.jpg"
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        steps = []
        if w and h and w / h < 0.45:  # طويلة أوي: هوامش على الجنبين
            steps.append("pad=ceil(ih*0.5/2)*2:ih:(ow-iw)/2:0:color=0x1a1a1a")
        elif w and h and w / h > 2.2:  # عريضة أوي: هوامش فوق وتحت
            steps.append("pad=iw:ceil(iw/2/2)*2:0:(oh-ih)/2:color=0x1a1a1a")
        # أصغر ضلع 720 على الأقل، وأكبر ضلع 4096 بالكتير
        steps.append("scale='if(lt(iw,ih),max(720,min(iw,4096)),-2)':'if(lt(iw,ih),-2,max(720,min(ih,4096)))'")
        steps.append("scale='min(iw,4096)':'min(ih,4096)':force_original_aspect_ratio=decrease")
        subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(path), "-vf", ",".join(steps),
                        "-q:v", "2", str(out)], check=True, capture_output=True, timeout=60)
    return out


def run_take(eid: str, tid: str) -> None:
    """يولّد نسخة للقطة بـ Seedance، وصور الشخصية مراجع عشان شكله يفضل ثابت."""
    def setp(**kw):
        update_episode(eid, lambda d: d["takes"].get(tid, {}).update(**kw))
    try:
        with closing(db()) as conn:
            r, data = episode_row(conn, eid)
            _, sdata = series_for_episode(conn, r)
        t = data["takes"][tid]
        dest = ep_dir(eid) / "takes" / f"{tid}.mp4"
        setp(status="working")
        if atlas.mock_mode():
            time.sleep(1.5)
            subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
                            f"color=c=0x{(hash(tid) & 0xFFFFFF):06x}:s=496x864:d={t['gen_duration']}:r=24",
                            "-c:v", "libx264", "-pix_fmt", "yuv420p", str(dest)], check=True, capture_output=True, timeout=120)
        else:
            # لو الطلب اتبعت قبل كده (إعادة محاولة) بنكمّل متابعته من غير ما ندفع تاني
            pid = t.get("prediction_id")
            if not pid:
                refs = [SERIES_DIR / r["series_id"] / "refs" / f for f in sdata["refs"]][:4]
                if t.get("frame"):
                    # صورة الستوري بورد أول مرجع: نفس الكادر والتكوين
                    refs.insert(0, ep_dir(eid) / "frames" / t["frame"])
                body = {
                    "model": series_settings()["video_model"], "prompt": t["prompt"],
                    "reference_images": [atlas.upload_media(seedance_ref(p)) for p in refs if p.exists()],
                    "duration": t["gen_duration"], "resolution": atlas.RESOLUTION, "ratio": atlas.RATIO,
                    "generate_audio": False, "watermark": False,
                }
                pid = atlas.submit_video(body)
            setp(prediction_id=pid)
            url = atlas.wait_for(pid, lambda _s: None)
            atlas.download(url, dest)
        setp(status="done", file=dest.name, duration=round(probe_duration(dest), 2), error=None)
    except Exception as exc:  # noqa: BLE001
        setp(status="failed", error=str(exc)[:400])


@app.delete("/api/episodes/{eid}/shots/{shot_id}")
def delete_shot(eid: str, shot_id: str, merge: str = "prev"):
    """تشيل لقطة، ووقتها بيتضاف على اللي قبلها (prev) أو اللي بعدها (next) عشان الحلقة تفضل متلاصقة على الصوت.
    نسخها (الفيديوهات) بتروح للنسخ المحفوظة."""
    def fn(d):
        shots = d["shots"]
        s = find_shot(d, shot_id)
        if len(shots) < 2:
            raise HTTPException(400, "دي آخر لقطة في الحلقة")
        k = shots.index(s)
        if merge == "next" and k + 1 < len(shots) or k == 0:
            other = shots[k + 1]
            other["start"] = s["start"]
        else:
            other = shots[k - 1]
            other["end"] = s["end"]
        other["lines"] = sorted(set(other.get("lines") or []) | set(s.get("lines") or []))
        shots.remove(s)
        for n, x in enumerate(shots, 1):
            x["n"] = n
    update_episode(eid, fn)
    return episode_response(eid)


class InsertShotIn(BaseModel):
    after: str  # اللقطة اللي الجديدة هتيجي بعدها
    seconds: float = 2.0
    take_from: str = "both"  # prev | next | both
    idea: str = ""


MIN_SHOT = 0.5


def insert_times(shots: list[dict], after: str, seconds: float, take_from: str) -> tuple[int, float, float, float]:
    """مكان اللقطة الجديدة ووقتها: بتاخد وقتها من اللي قبلها أو اللي بعدها أو الاتنين، والحلقة تفضل على طول الصوت."""
    ids = [x["id"] for x in shots]
    if after not in ids:
        raise HTTPException(404, "اللقطة مش موجودة")
    k = ids.index(after) + 1
    prev, nxt = shots[k - 1], shots[k] if k < len(shots) else None
    room_prev = max(0.0, prev["end"] - prev["start"] - MIN_SHOT)
    room_next = max(0.0, nxt["end"] - nxt["start"] - MIN_SHOT) if nxt else 0.0
    if take_from == "prev" or not nxt:
        a, b = min(seconds, room_prev), 0.0
    elif take_from == "next":
        a, b = 0.0, min(seconds, room_next)
    else:
        a = min(seconds / 2, room_prev)
        b = min(seconds - a, room_next)
        a = min(seconds - b, room_prev)
    if a + b < 0.3:
        raise HTTPException(400, "مفيش وقت كفاية في اللقطات اللي جنبها (كل لقطة لازم تفضل نص ثانية على الأقل)")
    start = prev["end"] - a
    return k, start, start + a + b, a + b


class ShotOrderIn(BaseModel):
    order: list[str]


@app.post("/api/episodes/{eid}/shots/order")
def reorder_shots(eid: str, body: ShotOrderIn):
    """ترتيب جديد للقطات. كل لقطة بتتنقل بالستوري بورد والفيديوهات والبرومبت ومدتها، والفويس أوفر ثابت مكانه:
    الأوقات بتتحسب من جديد ورا بعض، والجمل اللي على كل لقطة بتتحدث حسب وقتها الجديد."""
    def fn(d):
        by_id = {x["id"]: x for x in d["shots"]}
        if sorted(body.order) != sorted(by_id):
            raise HTTPException(400, "اللقطات اتغيرت. اعمل ريفريش وجرّب تاني")
        shots, t = [], 0.0
        for i, sid in enumerate(body.order, 1):
            x = by_id[sid]
            dur = x["end"] - x["start"]
            x.update(n=i, start=round(t, 2), end=round(t + dur, 2))
            t += dur
            shots.append(x)
        if shots and d["audio"]:
            shots[-1]["end"] = round(max(shots[-1]["start"] + 0.1, d["audio"]["duration"]), 2)
        for x in shots:
            x["lines"] = sz.lines_in_shot(x, d["lines"])
        d["shots"] = shots
    update_episode(eid, fn)
    return episode_response(eid)


def start_reprompt(eid: str, ids: list[str]) -> None:
    """يعلّم اللقطات إنها بيتكتب لها برومبت جديد، ويبعتهم للموديل على دفعات في الخلفية."""
    if not ids:
        return
    def mark(d):
        for x in d["shots"]:
            if x["id"] in ids:
                x["prompt_status"], x["prompt_error"] = "working", None
    update_episode(eid, mark)
    for k in range(0, len(ids), REPROMPT_BATCH):
        prompt_executor.submit(run_reprompt, eid, ids[k:k + REPROMPT_BATCH])


def run_reprompt(eid: str, ids: list[str]) -> None:
    try:
        with closing(db()) as conn:
            r, data = episode_row(conn, eid)
            _, sdata = series_for_episode(conn, r)
        shots = data["shots"]
        text = {ln["n"]: ln["text"] for ln in data["lines"]}
        items = []
        for k, x in enumerate(shots):
            if x["id"] in ids:
                items.append({"id": x["id"], "n": x["n"], "seconds": x["end"] - x["start"],
                              "said": [text[n] for n in x.get("lines") or [] if n in text], "shot": x,
                              "prev": shots[k - 1] if k else None, "next": shots[k + 1] if k + 1 < len(shots) else None})
        if atlas.mock_mode():
            result = {it["id"]: sz.mock_one_shot(it["prev"], " ".join(it["said"])) for it in items}
        else:
            result = sz.parse_reprompt(series_chat(sz.reprompt_messages(sdata["bible"], sdata["character"], items)))
        error = None
    except Exception as exc:  # noqa: BLE001
        result, error = {}, str(getattr(exc, "detail", exc))[:300]
    def fn(d):
        for x in d["shots"]:
            if x["id"] not in ids:
                continue
            if x["id"] in result:
                x.update(result[x["id"]])
                x.update(prompt_status="done", prompt_error=None, prompt_new=True)
            else:
                x.update(prompt_status="failed", prompt_error=error or "الموديل ما رجعش برومبت للقطة دي")
    update_episode(eid, fn)


@app.post("/api/episodes/{eid}/reprompt")
def reprompt_episode(eid: str, shot_id: str | None = None):
    """برومبتات جديدة على الكلام الحالي: لقطة واحدة (shot_id) أو كل اللقطات. الستوري بورد والفيديوهات القديمة بيفضلوا."""
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
    with closing(db()) as conn:
        _, data = episode_row(conn, eid)
    ids = [x["id"] for x in data["shots"] if (shot_id is None or x["id"] == shot_id) and x.get("prompt_status") != "working"]
    if not ids:
        raise HTTPException(400, "البرومبت بيتكتب بالفعل")
    start_reprompt(eid, ids)
    return episode_response(eid)


@app.post("/api/episodes/{eid}/shots/{shot_id}/describe")
def describe_shot(eid: str, shot_id: str):
    """وصف وبرومبت جديد للقطة على الكلام الجديد (من المسودة لو فيه)، بنفس أسلوب اللي جنبها.
    الستوري بورد والفيديوهات القديمة بيفضلوا كنسخ؛ ارسم وولّد تاني."""
    with closing(db()) as conn:
        r, data = episode_row(conn, eid)
        _, sdata = series_for_episode(conn, r)
    shots = data["shots"]
    x = find_shot(data, shot_id)
    k = shots.index(x)
    draft = {d["n"]: d["text"] for d in (data.get("rewrite") or {}).get("lines") or [] if d.get("n") is not None}
    said = [draft.get(ln["n"], ln["text"]) for ln in data["lines"] if ln["n"] in (x.get("lines") or [])
            and (not draft or ln["n"] in draft)]
    prev = shots[k - 1] if k else None
    nxt = shots[k + 1] if k + 1 < len(shots) else None
    idea = f"نفس فكرة اللقطة القديمة لو لسه مناسبة للكلام الجديد: {x.get('title') or ''}"
    if atlas.mock_mode():
        fields = sz.mock_one_shot(prev, " ".join(said))
    else:
        if not atlas.api_key():
            raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
        try:
            fields = sz.parse_one_shot(series_chat(sz.insert_shot_messages(
                sdata["bible"], sdata["character"], prev, nxt, said, x["end"] - x["start"], idea)))
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
    def fn(d):
        find_shot(d, shot_id).update(**fields, prompt_new=True, prompt_status="done", prompt_error=None)
    update_episode(eid, fn)
    return episode_response(eid)


@app.post("/api/episodes/{eid}/shots/insert")
def insert_shot(eid: str, body: InsertShotIn):
    """لقطة جديدة بين لقطتين. وقتها بيتاخد من اللي جنبها، والموديل بيكتب وصفها وبرومبتها على نفس أسلوبهم
    عشان تتولد ليها ستوري بورد وفيديو زي الباقي."""
    with closing(db()) as conn:
        r, data = episode_row(conn, eid)
        _, sdata = series_for_episode(conn, r)
    seconds = max(0.3, min(15.0, float(body.seconds or 2)))
    k, start, end, _ = insert_times(data["shots"], body.after, seconds, body.take_from)
    prev = data["shots"][k - 1]
    nxt = data["shots"][k] if k < len(data["shots"]) else None
    said = [ln["text"] for ln in data["lines"] if ln.get("start") is not None and ln["start"] < end and ln["end"] > start]
    if atlas.mock_mode():
        fields = sz.mock_one_shot(prev, body.idea)
    elif atlas.api_key():
        try:
            fields = sz.parse_one_shot(series_chat(sz.insert_shot_messages(
                sdata["bible"], sdata["character"], prev, nxt, said, end - start, body.idea)))
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
    else:
        fields = {"title": body.idea.strip()[:80] or "لقطة جديدة", "shot": "", "camera": "", "location": prev.get("location") or "",
                  "sfx": "", "transition": "cut", "prompt": body.idea.strip()}
    new_id = uuid.uuid4().hex[:10]
    def fn(d):
        shots = d["shots"]
        k, start, end, _ = insert_times(shots, body.after, seconds, body.take_from)
        shots[k - 1]["end"] = round(start, 2)
        if k < len(shots):
            shots[k]["start"] = round(end, 2)
        lines = [ln["n"] for ln in d["lines"] if ln.get("start") is not None and ln["start"] < end and ln["end"] > start]
        shots.insert(k, {"id": new_id, "scene": shots[k - 1].get("scene") or 0, "start": round(start, 2), "end": round(end, 2),
                         "lines": lines, **fields, "takes": [], "chosen": None, "offset": 0.0, "approved": False,
                         "frames": [], "frame": None, "frame_status": "idle", "frame_error": None, "added": True})
        for n, x in enumerate(shots, 1):
            x["n"] = n
    update_episode(eid, fn)
    out = episode_response(eid)
    out["new_shot"] = new_id
    return out


@app.post("/api/episodes/{eid}/takes/{take_id}/retry")
def retry_take(eid: str, take_id: str):
    """نسخة فشلت: لو الطلب كان اتبعت لـ Seedance بنكمّل متابعته وتحميله (من غير دفع تاني)، غير كده بيتبعت من الأول."""
    def fn(d):
        t = d["takes"].get(take_id)
        if t is None:
            raise HTTPException(404, "النسخة مش موجودة")
        if t["status"] != "failed" or t.get("source") != "seedance":
            raise HTTPException(400, "النسخة دي مش فاشلة")
        t.update(status="queued", error=None)
    update_episode(eid, fn)
    series_executor.submit(run_take, eid, take_id)
    return episode_response(eid)


@app.post("/api/episodes/{eid}/shots/{shot_id}/generate")
def generate_take(eid: str, shot_id: str):
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
    tid = uuid.uuid4().hex[:10]
    with closing(db()) as conn:
        r, _ = episode_row(conn, eid)
        _, sdata = series_for_episode(conn, r)
    def fn(d):
        s = find_shot(d, shot_id)
        if not s.get("approved"):
            raise HTTPException(400, f"اعتمد اللقطة {s['n']} الأول (راجع الستوري بورد والبرومبت)")
        dur = s["end"] - s["start"]
        # Seedance بيعمل من 4 لـ 15 ثانية: بنولّد أطول شوية من اللقطة ونقص منها
        gen = int(min(atlas.MAX_DURATION, max(atlas.MIN_DURATION, math.ceil(dur + 0.5))))
        d["takes"][tid] = {"id": tid, "file": None, "source": "seedance", "status": "queued", "error": None,
                           "duration": None, "gen_duration": gen, "prompt": shot_prompt(s, sdata["character"]),
                           "frame": s.get("frame"), "approved": False, "created_at": now()}
        s["takes"].append(tid)
        s.pop("prompt_new", None)
        if not s["chosen"]:
            s["chosen"] = tid
    update_episode(eid, fn)
    series_executor.submit(run_take, eid, tid)
    return episode_response(eid)


def run_episode_render(eid: str) -> None:
    """يجمّع الحلقة: كل لقطة من نسختها المختارة بمدتها بالظبط من الصوت، وفوقهم الفويس أوفر."""
    work = TMP_DIR / f"ep_{eid}_{uuid.uuid4().hex[:6]}"
    work.mkdir(parents=True, exist_ok=True)
    try:
        with closing(db()) as conn:
            r, data = episode_row(conn, eid)
            sr, _ = series_for_episode(conn, r)
        parts = []
        for k, s in enumerate(data["shots"]):
            dur = round(s["end"] - s["start"], 3)
            t = data["takes"].get(s.get("chosen") or "")
            src = ep_dir(eid) / "takes" / t["file"] if t and t.get("file") and t["status"] == "done" else None
            part = work / f"{k:03d}.mp4"
            vf = (f"scale={SERIES_W}:{SERIES_H}:force_original_aspect_ratio=increase,crop={SERIES_W}:{SERIES_H},"
                  f"fps=30,setsar=1,format=yuv420p,tpad=stop_mode=clone:stop_duration={dur:.3f}")
            if src and src.exists():
                cmd = [ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{s.get('offset') or 0:.3f}",
                       "-i", str(src), "-t", f"{dur:.3f}", "-an", "-vf", vf]
            else:  # لقطة لسه من غير فيديو: أسود بمدتها
                cmd = [ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
                       "-i", f"color=c=black:s={SERIES_W}x{SERIES_H}:r=30:d={dur:.3f}"]
            cmd += ["-t", f"{dur:.3f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", str(part)]
            subprocess.run(cmd, check=True, capture_output=True, timeout=600)
            parts.append(part)
        (work / "list.txt").write_text("".join(f"file '{p.name}'\n" for p in parts))
        export_id = uuid.uuid4().hex[:12]
        filename = f"{export_id}.mp4"
        total = data["audio"]["duration"]
        subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0",
                        "-i", str(work / "list.txt"), "-i", str(ep_dir(eid) / data["audio"]["file"]),
                        "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{total:.3f}",
                        "-movflags", "+faststart", str(EXPORTS_DIR / filename)], check=True, capture_output=True, timeout=900)
        name = f"{sr['name']} — {r['name']}"
        with closing(db()) as conn, conn:
            conn.execute("INSERT INTO exports (id, name, filename, duration, source, project_id, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)",
                         (export_id, name, filename, total, "series", now()))
        update_episode(eid, lambda d: d.update(render={"status": "done", "export_id": export_id, "error": None}))
    except Exception as exc:  # noqa: BLE001
        msg = exc.stderr.decode(errors="ignore")[-300:] if isinstance(exc, subprocess.CalledProcessError) and exc.stderr else str(exc)
        update_episode(eid, lambda d: d.update(render={"status": "failed", "export_id": None, "error": msg[:400]}))
    finally:
        shutil.rmtree(work, ignore_errors=True)
        SERIES_JOBS.discard(eid)


@app.post("/api/episodes/{eid}/render")
def render_episode(eid: str):
    with closing(db()) as conn:
        _, data = episode_row(conn, eid)
    if not data["shots"] or not data["audio"]:
        raise HTTPException(400, "جهّز اللقطات الأول")
    with SERIES_LOCK:
        if eid in SERIES_JOBS:
            raise HTTPException(400, "التجميع شغال")
        SERIES_JOBS.add(eid)
    update_episode(eid, lambda d: d.update(render={"status": "working", "export_id": None, "error": None}))
    render_executor.submit(run_episode_render, eid)
    return episode_response(eid)


class WriteIn(BaseModel):
    message: str = ""


@app.post("/api/episodes/{eid}/write")
def write_episode(eid: str, body: WriteIn):
    """الموديل يكتب سكريبت الحلقة استكمالًا للحلقات اللي فاتت. أي رسالة منك = توجيه، وهو بيرجّع السكريبت كامل متعدّل."""
    with closing(db()) as conn:
        r, data = episode_row(conn, eid)
        _, sdata = series_for_episode(conn, r)
        # لو فيه نسخ من نفس الحلقة: الأصلية هي اللي بتتحسب في القصة (أو أحدث نسخة لو الأصلية اتمسحت)
        by_number: dict[int, dict] = {}
        for e in conn.execute("SELECT number, name, data, updated_at FROM episodes WHERE series_id = ? AND number < ? ORDER BY updated_at",
                              (r["series_id"], r["number"])):
            ed = json.loads(e["data"])
            cur = by_number.get(e["number"])
            if cur is None or cur["copy"]:
                by_number[e["number"]] = {"number": e["number"], "name": e["name"], "script": ed.get("script", ""),
                                          "copy": bool(ed.get("copy_of"))}
        previous = [by_number[n] for n in sorted(by_number)]
    chat = list(data["chat"])
    if body.message.strip():
        chat.append({"role": "user", "content": body.message.strip()[:4000]})
    elif not chat:
        chat.append({"role": "user", "content": f"اكتب الحلقة رقم {r['number']} استكمالًا للي فات."})
    if atlas.mock_mode():
        reply = sz.mock_script(r["number"], chat)
    else:
        if not atlas.api_key():
            raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
        reply = series_chat(sz.writer_messages(sdata["bible"], sdata["character"], previous, r["number"], chat), json_mode=False)
    script = sz.clean_script(reply)
    if not sz.parse_script(script)["lines"]:
        raise HTTPException(400, "الموديل رجّع رد مش سكريبت. جرّب تاني أو وضّح طلبك")
    def fn(d):
        d["chat"] = chat + [{"role": "assistant", "content": script}]
        d["script"] = script
        d["script_approved"] = False
        parsed = sz.parse_script(script)
        old = {ln["text"]: ln for ln in d["lines"]}
        d["scenes"] = parsed["scenes"]
        d["lines"] = [{**ln, "start": old.get(ln["text"], {}).get("start"), "end": old.get(ln["text"], {}).get("end")}
                      for ln in parsed["lines"]]
    update_episode(eid, fn)
    return episode_response(eid)


class RewriteLinesIn(BaseModel):
    lines: list[dict]


def rewrite_rows(d: dict) -> list[dict]:
    """المسودة الحالية (أو جمل الحلقة لو لسه مفيش)، ومع كل جملة قديمة مدتها في الصوت."""
    old = {ln["n"]: ln for ln in d["lines"]}
    base = (d.get("rewrite") or {}).get("lines") or [{"n": ln["n"], "k": f"n{ln['n']}", "text": ln["text"]} for ln in d["lines"]]
    rows = []
    for r in base:
        o = old.get(r.get("n")) if r.get("n") is not None else None
        rows.append({**r, "old": o["text"] if o else None,
                     "dur": round((o.get("end") or 0) - (o.get("start") or 0), 2) if o and o.get("start") is not None else None})
    return rows


@app.post("/api/episodes/{eid}/rewrite")
def rewrite_episode(eid: str, body: WriteIn):
    """تعديل كلام الحلقة على نفس الفيديوهات بتوجيهك (مثلًا: أظرف، أو زوّد مشهد). الجمل القديمة بأرقامها،
    والجديدة بيتعمل لها لقطات بعد ما تسجّل الصوت."""
    with closing(db()) as conn:
        r, data = episode_row(conn, eid)
        _, sdata = series_for_episode(conn, r)
    if not data["lines"] or any(ln.get("start") is None for ln in data["lines"]):
        raise HTTPException(400, "الحلقة لسه مفيهاش جمل متوقتة على الصوت")
    rows = rewrite_rows(data)
    rw = data.get("rewrite") or {"chat": [], "lines": []}
    chat = list(rw["chat"])
    msg = body.message.strip()[:4000] or "اكتب كلام جديد للحلقة على نفس الفيديوهات."
    chat.append({"role": "user", "content": msg})
    if atlas.mock_mode():
        reply = sz.mock_rewrite(rows, chat)
    else:
        if not atlas.api_key():
            raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
        reply = series_chat(sz.rewrite_messages(sdata["bible"], sdata["character"], rows, data["shots"], chat))
    try:
        new = sz.parse_rewrite(reply, rows)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    def fn(d):
        d["rewrite"] = {"chat": chat + [{"role": "assistant", "content": json.dumps(
            {"lines": [{"n": x["n"], "text": x["text"]} for x in new]}, ensure_ascii=False)}], "lines": new}
    update_episode(eid, fn)
    return episode_response(eid)


@app.put("/api/episodes/{eid}/rewrite")
def save_rewrite(eid: str, body: RewriteLinesIn):
    """المسودة زي ما هي عندك: تعديل بإيدك، جمل جديدة (من غير رقم)، أو جمل اتشالت."""
    def fn(d):
        known = {ln["n"] for ln in d["lines"]}
        out, seen = [], set()
        for x in body.lines[:400]:
            n = int(x["n"]) if str(x.get("n", "")).isdigit() else None
            text = str(x.get("text") or "").strip()[:500]
            if n is not None and (n not in known or n in seen):
                continue
            if n is not None:
                seen.add(n)
            out.append({"n": n, "k": f"n{n}" if n is not None else (str(x.get("k") or "") or sz._new_key())[:20], "text": text})
        rw = d.get("rewrite") or {"chat": [], "lines": []}
        rw["lines"] = out
        d["rewrite"] = rw
    update_episode(eid, fn)
    return episode_response(eid)


@app.delete("/api/episodes/{eid}/rewrite")
def discard_rewrite(eid: str):
    update_episode(eid, lambda d: d.update(rewrite={"chat": [], "lines": []}))
    return episode_response(eid)


@app.post("/api/episodes/{eid}/rewrite/apply")
def apply_rewrite(eid: str):
    """المسودة تبقى هي سكريبت الحلقة. الجمل القديمة محتفظة بأوقاتها وبلقطاتها، والجديدة من غير وقت لحد ما ترفع
    الصوت الجديد: ساعتها اللقطات القديمة بتتظبط عليه، والجمل الجديدة بيتعمل لها لقطات. القديم بيتحفظ في history."""
    def fn(d):
        draft = [x for x in (d.get("rewrite") or {}).get("lines") or [] if x["text"].strip()]
        if not draft:
            raise HTTPException(400, "اكتب الكلام الجديد الأول")
        d.setdefault("history", []).append({"at": now(), "script": d["script"], "lines": d["lines"], "scenes": d["scenes"],
                                            "audio": d["audio"], "timing": d["timing"]})
        d["history"] = d["history"][-10:]
        old = {ln["n"]: ln for ln in d["lines"]}
        lines, remap, added, scene = [], {}, [], 0
        for i, x in enumerate(draft, 1):
            o = old.get(x["n"]) if x["n"] is not None else None
            if o:
                remap[o["n"]] = i
                scene = o.get("scene") or 0
                lines.append({**o, "n": i, "text": x["text"].strip()})
            else:
                added.append(i)
                lines.append({"n": i, "text": x["text"].strip(), "scene": scene, "start": None, "end": None, "added": True})
        timed = d["shots"] and d["audio"] and all(o.get("start") is not None for o in d["lines"])
        retime = {"old": {str(remap[o["n"]]): [o["start"], o["end"]] for o in d["lines"] if o["n"] in remap},
                  "total": d["audio"]["duration"], "added": added} if timed else None
        for sh in d["shots"]:
            sh["_old_lines"] = list(sh.get("lines") or [])
            sh["lines"] = [remap[n] for n in sh.get("lines") or [] if n in remap]
        d["lines"] = lines
        titles = {sc["n"]: sc["title"] for sc in d["scenes"]}
        out, cur = [], None
        for ln in lines:
            if ln.get("scene") and ln["scene"] != cur:
                cur = ln["scene"]
                out.append(f"المشهد {cur} — {titles.get(cur, '')}".rstrip(" —"))
            out.append(f"«{ln['text']}»")
        d["script"] = "\n".join(out)
        d["script_approved"] = True
        d["voice_pending"] = True
        old_text = {o["n"]: o["text"] for o in old.values()}
        new_by_old = {x["n"]: x["text"].strip() for x in draft if x["n"] is not None}
        changed.extend(sh["id"] for sh in d["shots"]
                       if any(new_by_old.get(o) != old_text[o] for o in sh.get("_old_lines") or []))
        d["rewrite"] = {"chat": [], "lines": []}
        d["retimed"] = None
        d["retime"] = retime
        for sh in d["shots"]:
            sh.pop("_old_lines", None)
    changed: list[str] = []
    update_episode(eid, fn)
    if changed and (atlas.api_key() or atlas.mock_mode()):
        start_reprompt(eid, changed)
    return episode_response(eid)


@app.post("/api/episodes/{eid}/approve-script")
def approve_script(eid: str, approved: bool = True):
    update_episode(eid, lambda d: d.update(script_approved=bool(approved)))
    return episode_response(eid)


FRAME_SIZE = "1152x2048"  # 9:16


def run_frame(eid: str, shot_id: str) -> None:
    """صورة الستوري بورد للقطة بـ GPT Image، وصور الشخصية مراجع."""
    def setp(**kw):
        update_episode(eid, lambda d: next((s for s in d["shots"] if s["id"] == shot_id), {}).update(**kw))
    try:
        with closing(db()) as conn:
            r, data = episode_row(conn, eid)
            _, sdata = series_for_episode(conn, r)
        s = next((s for s in data["shots"] if s["id"] == shot_id), None)
        if s is None:
            return
        setp(frame_status="working", frame_error=None)
        name = f"frame-{s['n']:02d}-{uuid.uuid4().hex[:6]}.png"
        dest = ep_dir(eid) / "frames" / name
        if atlas.mock_mode():
            mock_image(dest, "576x1024", f"shot {s['n']}", s["n"])
        else:
            refs = [SERIES_DIR / r["series_id"] / "refs" / f for f in sdata["refs"]][:6]
            urls = [atlas.reference_url(p) for p in refs if p.exists()]
            cfg = carousel_settings()
            url = atlas.generate_image(cfg["image_family"], sz.frame_prompt(s, sdata["character"]), FRAME_SIZE,
                                       auth.get_setting("series_frame_quality") or "medium", urls or None)
            atlas.download(url, dest)
        def done(d):
            sh = next((x for x in d["shots"] if x["id"] == shot_id), None)
            if sh is not None:
                sh.setdefault("frames", []).append(name)
                sh.update(frame=name, frame_status="done", frame_error=None)
        update_episode(eid, done)
    except Exception as exc:  # noqa: BLE001
        setp(frame_status="failed", frame_error=str(exc)[:400])


def queue_frames(eid: str, ids: list[str]) -> None:
    def fn(d):
        for s in d["shots"]:
            if s["id"] in ids:
                s.update(frame_status="queued", frame_error=None)
    update_episode(eid, fn)
    for i in ids:
        series_executor.submit(run_frame, eid, i)


@app.post("/api/episodes/{eid}/frames")
def episode_frames(eid: str, shot_id: str | None = None):
    """يرسم الستوري بورد: لقطة واحدة (نسخة جديدة)، أو كل اللقطات اللي لسه ملهاش صورة."""
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
    with closing(db()) as conn:
        _, data = episode_row(conn, eid)
    busy = {"queued", "working"}
    if shot_id:
        s = find_shot(data, shot_id)
        if s.get("frame_status") in busy:
            raise HTTPException(400, "الصورة دي بتترسم")
        ids = [shot_id]
    else:
        ids = [s["id"] for s in data["shots"] if not s.get("frame") and s.get("frame_status") not in busy]
    if not ids:
        raise HTTPException(400, "كل اللقطات ليها ستوري بورد")
    queue_frames(eid, ids)
    return episode_response(eid)


class FramePick(BaseModel):
    file: str


@app.post("/api/episodes/{eid}/shots/{shot_id}/frame")
def pick_frame(eid: str, shot_id: str, body: FramePick):
    def fn(d):
        s = find_shot(d, shot_id)
        if body.file not in s.get("frames", []):
            raise HTTPException(404, "الصورة مش موجودة")
        s["frame"] = body.file
    update_episode(eid, fn)
    return episode_response(eid)


@app.post("/api/episodes/{eid}/approve-shots")
def approve_all_shots(eid: str, approved: bool = True):
    def fn(d):
        for s in d["shots"]:
            s["approved"] = bool(approved)
    update_episode(eid, fn)
    return episode_response(eid)


@app.post("/api/episodes/{eid}/generate-approved")
def generate_approved(eid: str):
    """يولّد فيديو لكل لقطة معتمدة لسه ملهاش نسخة (أو نسخها كلها فشلت)."""
    with closing(db()) as conn:
        _, data = episode_row(conn, eid)
    ok = {"queued", "working", "done"}
    todo = [s["id"] for s in data["shots"] if s.get("approved")
            and not any(data["takes"].get(t, {}).get("status") in ok for t in s.get("takes", []))]
    if not todo:
        raise HTTPException(400, "مفيش لقطات معتمدة محتاجة توليد. اعتمد اللقطات الأول")
    for sid in todo:
        generate_take(eid, sid)
    return episode_response(eid)


@app.post("/api/episodes/{eid}/takes/{take_id}/approve")
def approve_take(eid: str, take_id: str, approved: bool = True):
    """توافق على الفيديو: يبقى هو المختار للقطة."""
    def fn(d):
        t = d["takes"].get(take_id)
        if t is None:
            raise HTTPException(404, "النسخة مش موجودة")
        if t["status"] != "done":
            raise HTTPException(400, "النسخة لسه ما خلصتش")
        t["approved"] = bool(approved)
        if approved:
            for s in d["shots"]:
                if take_id in s["takes"]:
                    s["chosen"] = take_id
    update_episode(eid, fn)
    return episode_response(eid)


DEFAULT_MUSIC_NAME = "beat"  # الموسيقى اللي بتتحط في أي مونتاج جديد لو موجودة في المكتبة


def default_music(conn: sqlite3.Connection) -> dict | None:
    row = conn.execute("SELECT id FROM audio WHERE kind = 'music' AND lower(name) LIKE ? ORDER BY lower(name) = ? DESC, created_at DESC",
                       (f"%{DEFAULT_MUSIC_NAME}%", DEFAULT_MUSIC_NAME)).fetchone()
    if not row:
        return None
    return {"id": row["id"], "volume": 0.3, "delay": 0.0, "offset": 0.0, "length": None, "fade_out": True,
            "parts": [{"delay": 0.0, "offset": 0.0, "length": None, "volume": 0.3}]}


def stretch_take(src: Path, out: Path, start: float, have: float, need: float) -> None:
    """الفيديو أقصر من وقت اللقطة (بعد صوت جديد): نبطّأه لحد 1.3x، والباقي آخر فريم واقف."""
    k = min(1.3, need / max(have, 0.1))
    freeze = max(0.0, need - have * k)
    vf = f"setpts={k:.4f}*(PTS-STARTPTS),fps=30" + (f",tpad=stop_mode=clone:stop_duration={freeze + 0.1:.3f}" if freeze > 0.01 else "")
    subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{start:.3f}", "-i", str(src),
                    "-vf", vf, "-an", "-t", f"{need:.3f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
                    "-pix_fmt", "yuv420p", str(out)], check=True, capture_output=True, timeout=300)


@app.post("/api/episodes/{eid}/to-editor")
def episode_to_editor(eid: str):
    """يحط الحلقة في محرر الفيديو: كل لقطة بنسختها المعتمدة ومقصوصة على مدتها، والفويس أوفر تحتهم."""
    with closing(db()) as conn:
        r, data = episode_row(conn, eid)
        sr, _ = series_for_episode(conn, r)
    if not data["shots"] or not data["audio"]:
        raise HTTPException(400, "جهّز اللقطات والصوت الأول")
    def ok(s: dict) -> bool:
        t = data["takes"].get(s.get("chosen") or "", {})
        return t.get("status") == "done" and bool(t.get("file")) and bool(t.get("approved"))
    missing = [s["n"] for s in data["shots"] if not ok(s)]
    if missing:
        raise HTTPException(400, f"اللقطات دي لسه من غير فيديو موافق عليه: {', '.join(map(str, missing))}")
    label = f"{sr['name']} — {r['name']}"
    clips = []
    with closing(db()) as conn, conn:
        for s in data["shots"]:
            t = data["takes"][s["chosen"]]
            gid = uuid.uuid4().hex[:12]
            out = f"{gid}.mp4"
            src = ep_dir(eid) / "takes" / t["file"]
            dur = s["end"] - s["start"]
            start = float(s.get("offset") or 0)
            have = (t.get("duration") or 0) - start
            if t.get("duration") and have < dur - 0.05:
                stretch_take(src, GENERATED_DIR / out, start, have, dur)
                t = {**t, "duration": dur}
                s = {**s, "offset": 0.0}
            else:
                shutil.copyfile(src, GENERATED_DIR / out)
            conn.execute(
                "INSERT INTO generations (id, clip_id, clip_filename, clip_label, coach_id, coach_name, coach_image, model, prompt, "
                "params, status, output_filename, created_at, updated_at) VALUES (?, ?, ?, ?, '', '', '', ?, ?, ?, 'completed', ?, ?, ?)",
                (gid, f"series:{eid}", t["file"], f"{label} · لقطة {s['n']}", t.get("source", ""), t.get("prompt") or "",
                 json.dumps({"episode": eid, "shot": s["id"]}), out, now(), now()),
            )
            start = float(s.get("offset") or 0)
            dur = s["end"] - s["start"]
            clips.append({"gen_id": gid, "start": start, "end": min(start + dur, t.get("duration") or start + dur),
                          "zoom": 1.0, "x": 0.0, "y": 0.0, "volume": 0.0})
        # الفويس أوفر في مكتبة التعليق الصوتي عشان المحرر يقراه
        vid = uuid.uuid4().hex[:12]
        vfile = f"voice_{vid}{Path(data['audio']['file']).suffix}"
        shutil.copyfile(ep_dir(eid) / data["audio"]["file"], AUDIO_DIR / vfile)
        conn.execute("INSERT INTO audio (id, kind, name, filename, duration, created_at) VALUES (?, 'voice', ?, ?, ?, ?)",
                     (vid, f"🎙️ {label}", vfile, data["audio"]["duration"], now()))
        pid = uuid.uuid4().hex[:12]
        pdata = {"name": label, "section": "series", "video_id": None, "coach_id": None, "clips": clips,
                 "voice": {"id": vid, "volume": 1.0, "delay": 0.0, "offset": 0.0, "length": None, "fade_out": False, "parts": []},
                 "music": default_music(conn), "outro": False, "outro_volume": 1.0, "captions": {}, "logo": {}}
        conn.execute("INSERT INTO projects (id, name, data, render_status, created_at, updated_at) VALUES (?, ?, ?, 'idle', ?, ?)",
                     (pid, label, json.dumps(pdata, ensure_ascii=False), now(), now()))
    update_episode(eid, lambda d: d.update(project_id=pid))
    return {"project_id": pid}


def reset_stuck_series() -> None:
    """بعد ما السيرفر يقوم: أي توليد أو تجميع كان شغال اتقطع."""
    with closing(db()) as conn, conn:
        for r in conn.execute("SELECT id, data FROM episodes").fetchall():
            d = json.loads(r["data"])
            changed = False
            for t in (d.get("takes") or {}).values():
                if t.get("status") in ("queued", "working"):
                    t.update(status="failed", error="اتقطع لما السيرفر اتقفل. دوس ولّد تاني")
                    changed = True
            for sh in d.get("shots") or []:
                if sh.get("prompt_status") == "working":
                    sh.update(prompt_status="failed", prompt_error="اتقطع لما السيرفر اتقفل. دوس ✍️ تاني")
                    changed = True
                if sh.get("frame_status") in ("queued", "working"):
                    sh.update(frame_status="failed", frame_error="اتقطع لما السيرفر اتقفل. ارسم تاني")
                    changed = True
            if (d.get("render") or {}).get("status") == "working":
                d["render"] = {"status": "failed", "export_id": None, "error": "اتقطع لما السيرفر اتقفل. جمّع تاني"}
                changed = True
            if changed:
                conn.execute("UPDATE episodes SET data = ? WHERE id = ?", (json.dumps(d, ensure_ascii=False), r["id"]))


reset_stuck_series()


# ================================================================ الإعلانات: تفصيص إعلان مرجعي واقتراح للعميل

ADS_LOCK = threading.Lock()
AD_MAX_SECONDS = 180  # أطول إعلان بنحلله (الموديل بيستقبل الفيديو كله مرة واحدة)
DEFAULT_AD_VIDEO_MODEL = "google/gemini-2.5-pro"
AD_VIDEO_FALLBACKS = ["google/gemini-2.5-pro", "google/gemini-2.5-flash", "google/gemini-3-flash-preview", "google/gemini-3.5-flash"]
AD_SETTING_KEYS = ("style_id", "brain_id", "fidelity", "duration", "format", "language", "production", "notes",
                   # 🎛️ التطبيق على البراند
                   "angle", "tone", "setting", "hero", "feature", "palette_mode", "palette_custom", "brand_level", "variety", "direction")


def ads_settings() -> dict:
    return {"video_model": auth.get_setting("ads_video_model") or DEFAULT_AD_VIDEO_MODEL}


class AdsSettingsIn(BaseModel):
    video_model: str | None = None


@app.get("/api/ads-settings")
def get_ads_settings():
    return ads_settings()


@app.put("/api/ads-settings")
def put_ads_settings(body: AdsSettingsIn):
    if body.video_model is not None:
        auth.set_setting("ads_video_model", body.video_model.strip())
    return ads_settings()


# ---------- 💰 عداد فلوس Atlas: الرصيد من Atlas، والصرف بنحسبه من نزول الرصيد

ATLAS_PUBLIC = f"{atlas.BASE_URL}/public/v1"
MONEY_TZ = timezone(timedelta(hours=3))  # توقيت السعودية


def money_log() -> list[dict]:
    try:
        return json.loads(auth.get_setting("atlas_balance_log") or "[]")
    except ValueError:
        return []


def spent_since(log: list[dict], since: datetime) -> float:
    """مجموع النزول في الرصيد من وقت معين (الشحن بيتجاهل)."""
    out, prev = 0.0, None
    for x in log:
        t = datetime.fromisoformat(x["t"])
        if prev is not None and t >= since and x["v"] < prev:
            out += prev - x["v"]
        prev = x["v"]
    return round(out, 4)


@app.get("/api/atlas/money")
def atlas_money():
    """الرصيد دلوقتي، واتصرف قد إيه النهارده والأسبوع ده، وعدد الطلبات لكل موديل في آخر يومين."""
    if atlas.mock_mode():
        return {"balance": 10.5, "currency": "usd", "spent_today": 0.42, "spent_week": 3.1, "tracked_since": now(),
                "models_recent": [{"name": "kwaivgi/kling-v2.6-pro/avatar", "type": "video", "requests": 2}]}
    if not atlas.api_key():
        raise HTTPException(400, "مفتاح Atlas مش متسجل")
    try:
        with httpx.Client(timeout=20) as client:
            b = client.get(f"{ATLAS_PUBLIC}/balance", headers=atlas._headers()).json()
            today = datetime.now(MONEY_TZ).date()
            u = client.get(f"{ATLAS_PUBLIC}/usage", headers=atlas._headers(),
                           params={"start_date": str(today - timedelta(days=1)), "end_date": str(today + timedelta(days=1)),
                                   "group_by[]": "model"}).json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, f"Atlas مش بيرد: {exc}") from exc
    bal = float(((b or {}).get("available") or {}).get("value") or 0)
    log = money_log()
    if not log or abs(log[-1]["v"] - bal) > 1e-6:
        log.append({"t": datetime.now(MONEY_TZ).isoformat(timespec="seconds"), "v": bal})
        auth.set_setting("atlas_balance_log", json.dumps(log[-2000:]))
    midnight = datetime.now(MONEY_TZ).replace(hour=0, minute=0, second=0, microsecond=0)
    models: dict[str, dict] = {}
    for bucket in (u or {}).get("data") or []:  # إمبارح والنهارده (أيام Atlas بتوقيت UTC)
        for r in bucket.get("results") or []:
            m = r.get("model") or {}
            x = models.setdefault(m.get("name") or "?", {"name": m.get("name") or "?", "type": m.get("type", ""), "requests": 0})
            x["requests"] += int((r.get("usage") or {}).get("requests") or 0)
    return {"balance": bal, "currency": ((b or {}).get("available") or {}).get("currency", "usd"),
            "spent_today": spent_since(log, midnight), "spent_week": spent_since(log, midnight - timedelta(days=6)),
            "tracked_since": log[0]["t"], "models_recent": sorted(models.values(), key=lambda x: -x["requests"])}


def ad_dir(aid: str) -> Path:
    d = ADS_DIR / Path(aid).name
    (d / "frames").mkdir(parents=True, exist_ok=True)
    return d


def ad_row(conn: sqlite3.Connection, aid: str) -> tuple[sqlite3.Row, dict]:
    r = conn.execute("SELECT * FROM ads WHERE id = ?", (aid,)).fetchone()
    if r is None:
        raise HTTPException(404, "الإعلان غير موجود")
    return r, json.loads(r["data"])


def bump(d: dict, key: str) -> None:
    """رقم نسخة الخطوة: بيزيد مع كل تغيير عشان الخطوة اللي بعدها تعرف إنها بقت قديمة."""
    d[key] = int(d.get(key) or 0) + 1


def update_ad(aid: str, fn) -> None:
    with ADS_LOCK, closing(db()) as conn, conn:
        r, data = ad_row(conn, aid)
        fn(data)
        conn.execute("UPDATE ads SET data = ?, updated_at = ? WHERE id = ?", (json.dumps(data, ensure_ascii=False), now(), aid))


def ad_to_dict(r: sqlite3.Row, d: dict) -> dict:
    aid = r["id"]
    base = f"/media/ads/{aid}"
    analysis = d.get("analysis") or {}
    scenes = [{**s, "frame_url": f"{base}/frames/{s['frame']}" if s.get("frame") else None} for s in analysis.get("scenes") or []]
    return {
        "id": aid, "name": r["name"], "created_at": r["created_at"],
        "source": d.get("source"), "source_url": f"{base}/{d['source']['file']}" if d.get("source") else None,
        "original_url": f"{base}/{d['source'].get('original') or d['source']['file']}" if d.get("source") else None,
        "status": d.get("status", "idle"), "step": d.get("step"), "error": d.get("error"),
        "analysis": {**analysis, "scenes": scenes} if analysis else None,
        "audio": d.get("audio"), "audio_error": d.get("audio_error"), "audio_tech": d.get("audio_tech"),
        "audio_status": d.get("audio_status", "idle"), "has_audio": bool((d.get("source") or {}).get("has_audio")),
        "analysis_ver": d.get("analysis_ver", 0), "adapt_ver": d.get("adapt_ver", 0),
        "prod_history": [{"at": h.get("archived_at"), "shots": len(h.get("shots") or [])} for h in d.get("prod_history") or []],
        "settings": d.get("settings") or {},
        "adaptation": d.get("adaptation"), "adapt_status": d.get("adapt_status", "idle"), "adapt_error": d.get("adapt_error"),
        "directions": d.get("directions") or [], "directions_status": d.get("directions_status", "idle"),
        "directions_error": d.get("directions_error"),
        "scomp_status": d.get("scomp_status", "idle"),
        "chat": d.get("chat") or [],
        "thumb": scenes[0]["frame_url"] if scenes and scenes[0].get("frame_url") else None,
        "prod": with_ref_motion(prod_to_dict(aid, d.get("prod")), analysis),
        "chain_prod": bool(d.get("chain_prod")),
        "brain_db": ad_brain_db(d.get("settings")),
        "video_models": [{"key": k, "label": v["label"]} for k, v in AD_VIDEO_MODELS.items()],
        "ar_voices": [{"id": k, "label": v} for k, v in AR_VOICES.items()],
    }


def ad_brain_db(settings: dict | None) -> list[dict]:
    """عناصر ملف العميل اللي ينفع يتعملها منشن (الاسم والنوع والصورة) عشان تظهر في الواجهة."""
    brain = ad_brain(settings)
    return [{"name": a["name"], "kind": a["kind"], "url": f"/media/ads/brains/{brain['id']}/{a['file']}"} for a in brain_db(brain)]


def with_ref_motion(prod: dict | None, analysis: dict) -> dict | None:
    """الموشن جرافيك بتاع المشهد الأصلي المقابل لكل لقطة (من آخر تحليل)، عشان يظهر جنب الموشن بتاع البراند."""
    if not prod:
        return prod
    by_n = {s.get("n"): s for s in (analysis or {}).get("scenes") or []}
    for s in prod["shots"]:
        s["ref_motion"] = (by_n.get(s.get("ref_scene")) or {}).get("motion_graphics", "")
    return prod


def ad_response(aid: str) -> dict:
    with closing(db()) as conn:
        r, d = ad_row(conn, aid)
    return ad_to_dict(r, d)


def ad_progress(d: dict) -> dict:
    """ملخص مراحل المشروع للقايمة الجانبية: وصل لفين."""
    shots = (d.get("prod") or {}).get("shots") or []
    def chosen_ok(s):
        return any(t["id"] == s.get("chosen") and t.get("status") == "done" for t in s.get("takes") or [])
    return {"analysis": bool(d.get("analysis")), "adapt": bool(d.get("adaptation")), "shots": len(shots),
            "frames": sum(1 for s in shots if s.get("frame")), "videos": sum(1 for s in shots if chosen_ok(s)),
            "editor": bool((d.get("prod") or {}).get("project_id")),
            "mode": (d.get("settings") or {}).get("fidelity") or "copy"}


@app.get("/api/ads")
def list_ads():
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM ads ORDER BY created_at DESC").fetchall()
    out = []
    for r in rows:
        d = json.loads(r["data"])
        if not owned((d.get("settings") or {}).get("brain_id") if (d.get("settings") or {}).get("brain_id") != "none" else None):
            continue  # إعلانات عميل تاني
        scenes = (d.get("analysis") or {}).get("scenes") or []
        out.append({"id": r["id"], "name": r["name"], "created_at": r["created_at"], "status": d.get("status", "idle"),
                    "step": d.get("step"), "adapt_status": d.get("adapt_status", "idle"), "progress": ad_progress(d),
                    "thumb": f"/media/ads/{r['id']}/frames/{scenes[0]['frame']}" if scenes and scenes[0].get("frame") else None})
    return out


def parse_ad_edit(start: float | None, end: float | None, crop: str) -> dict | None:
    """القص والكروب من المحرر الصغير: الكروب كسور من الصورة (x,y,w,h بين 0 و1)."""
    edit = {}
    if start is not None and start > 0.01:
        edit["start"] = round(float(start), 3)
    if end is not None and end > 0:
        edit["end"] = round(float(end), 3)
    if crop:
        try:
            x, y, w, h = (max(0.0, min(1.0, float(v))) for v in crop.split(","))
        except ValueError as exc:
            raise HTTPException(400, "الكروب مش مظبوط") from exc
        if w < 0.999 or h < 0.999:
            if w < 0.05 or h < 0.05:
                raise HTTPException(400, "الكروب صغير أوي")
            edit["crop"] = [round(x, 4), round(y, 4), round(min(w, 1 - x), 4), round(min(h, 1 - y), 4)]
    return edit or None


def apply_ad_edit(original: Path, out: Path, edit: dict | None) -> None:
    """يطلّع نسخة مقصوصة ومعمولها كروب من الفيديو الأصلي (بجودة عالية)."""
    if not edit:
        shutil.copyfile(original, out)
        return
    args = [ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y"]
    if edit.get("start"):
        args += ["-ss", f"{edit['start']:.3f}"]
    if edit.get("end"):
        args += ["-to", f"{edit['end']:.3f}"]
    args += ["-i", str(original)]
    if edit.get("start") and edit.get("end"):
        # -to بعد -ss قبل الـ input بيتحسب من أول الملف، فبنحوّله لمدة
        i = args.index("-to")
        args[i], args[i + 1] = "-t", f"{edit['end'] - edit['start']:.3f}"
    vf = []
    if edit.get("crop"):
        x, y, w, h = edit["crop"]
        vf.append(f"crop=trunc(iw*{w}/2)*2:trunc(ih*{h}/2)*2:trunc(iw*{x}):trunc(ih*{y})")
    if vf:
        args += ["-vf", ",".join(vf)]
    args += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
             "-movflags", "+faststart", str(out)]
    r = subprocess.run(args, capture_output=True, text=True, timeout=900)
    if r.returncode != 0 or not out.exists():
        raise HTTPException(400, f"مقدرتش أقص الفيديو: {r.stderr[-300:]}")


def ad_source_from(folder: Path, original: str, edit: dict | None, display_name: str | None) -> dict:
    src_name = original if not edit else "source-edit.mp4"
    if edit:
        apply_ad_edit(folder / original, folder / src_name, edit)
    try:
        info = media_info(folder / src_name)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"مقدرتش أقرا الفيديو: {exc}") from exc
    return {"file": src_name, "original": original, "edit": edit, "name": display_name, "duration": round(info.duration, 2),
            "width": info.width, "height": info.height, "has_audio": info.has_audio}


@app.post("/api/ads")
def create_ad(file: UploadFile = File(...), name: str = Form(""), trim_start: float | None = Form(None),
              trim_end: float | None = Form(None), crop: str = Form("")):
    """ترفع إعلان مرجعي (ولو عايز تقصه أو تعمله كروب قبلها) والتحليل بيبدأ لوحده، وبعده اقتراح للعميل."""
    aid = uuid.uuid4().hex[:12]
    folder = ad_dir(aid)
    fname = save_upload(file, VIDEO_EXTENSIONS, folder, "original")
    try:
        source = ad_source_from(folder, fname, parse_ad_edit(trim_start, trim_end, crop), file.filename)
    except HTTPException:
        shutil.rmtree(folder, ignore_errors=True)
        raise
    info = source
    data = {"source": source,
            "status": "queued", "settings": {"duration": min(60, max(10, round(info["duration"]))), "format": "9:16 ريلز وتيك توك",
                                             "language": brand_settings().get("language") or "", "brain_id": active_client_id()}}
    with closing(db()) as conn, conn:
        conn.execute("INSERT INTO ads (id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                     (aid, name.strip() or Path(file.filename or "إعلان").stem, json.dumps(data, ensure_ascii=False), now(), now()))
    threading.Thread(target=run_ad_analysis, args=(aid,), daemon=True).start()
    return ad_response(aid)


@app.get("/api/ads/{aid}")
def get_ad(aid: str):
    return ad_response(aid)


class AdPatchIn(BaseModel):
    name: str | None = None
    settings: dict | None = None
    analysis: dict | None = None
    audio: dict | None = None
    adaptation: dict | None = None


@app.patch("/api/ads/{aid}")
def patch_ad(aid: str, body: AdPatchIn):
    """مركز الإعدادات: تعديل الإعدادات أو أي حاجة في التحليل أو الاقتراح بإيدك."""
    if body.name is not None and body.name.strip():
        with closing(db()) as conn, conn:
            conn.execute("UPDATE ads SET name = ? WHERE id = ?", (body.name.strip()[:120], aid))
    def fn(d):
        if body.settings is not None:
            d["settings"] = {**(d.get("settings") or {}), **{k: body.settings[k] for k in AD_SETTING_KEYS if k in body.settings}}
        if body.analysis is not None and d.get("analysis"):
            # الفريمات بتفضل زي ما هي
            frames = {s.get("n"): s.get("frame") for s in d["analysis"].get("scenes") or []}
            scenes = [{k: v for k, v in s.items() if k != "frame_url"} for s in body.analysis.get("scenes") or d["analysis"].get("scenes") or []]
            for s in scenes:
                s["frame"] = frames.get(s.get("n"))
            d["analysis"] = {**d["analysis"], **body.analysis, "scenes": scenes}
            bump(d, "analysis_ver")
        if body.audio is not None:
            d["audio"] = body.audio
        if body.adaptation is not None:
            # التعديل بإيدك بيفضل على نفس التحليل اللي الاقتراح اتكتب عليه
            based = (d.get("adaptation") or {}).get("based_on", d.get("analysis_ver", 0))
            d["adaptation"] = {**body.adaptation, "based_on": based}
            bump(d, "adapt_ver")
    update_ad(aid, fn)
    return ad_response(aid)


@app.delete("/api/ads/{aid}")
def delete_ad(aid: str):
    with closing(db()) as conn, conn:
        conn.execute("DELETE FROM ads WHERE id = ?", (aid,))
    shutil.rmtree(ADS_DIR / Path(aid).name, ignore_errors=True)
    return {"ok": True}


class AdEditIn(BaseModel):
    start: float | None = None
    end: float | None = None
    crop: str = ""


@app.post("/api/ads/{aid}/edit")
def edit_ad(aid: str, body: AdEditIn):
    """قص وكروب جديد من الفيديو الأصلي، وبعدها التحليل والاقتراح بيتعملوا من الأول."""
    with closing(db()) as conn:
        _, d = ad_row(conn, aid)
    if d.get("status") in ("queued", "working"):
        raise HTTPException(400, "استنى لما التحليل اللي شغال يخلص")
    folder = ad_dir(aid)
    original = d["source"].get("original") or d["source"]["file"]
    source = ad_source_from(folder, original, parse_ad_edit(body.start, body.end, body.crop), d["source"].get("name"))
    for f in (folder / "frames").glob("*.jpg"):
        f.unlink(missing_ok=True)
    update_ad(aid, lambda d: d.update(source=source, status="queued", error=None, analysis=None, audio=None, audio_error=None,
                                     audio_tech=None, audio_status="idle"))
    threading.Thread(target=run_ad_analysis, args=(aid,), daemon=True).start()
    return ad_response(aid)


def run_scene_components(aid: str) -> None:
    try:
        with closing(db()) as conn:
            _, d = ad_row(conn, aid)
        scenes = d["analysis"]["scenes"]
        if atlas.mock_mode():
            sc = az.mock_scene_components(scenes)
        else:
            proxy = ad_dir(aid) / "proxy.mp4"
            if not proxy.exists():
                raise HTTPException(400, "نسخة الفيديو الصغيرة مش موجودة. دوس «حلّل تاني»")
            sc = ad_json(ad_media_chat(az.with_media(az.scene_components_messages(scenes), data_url(proxy, "video/mp4"), "ad.mp4")),
                         "مكونات المشاهد")
        def fn(d):
            az.merge_scene_components(d["analysis"]["scenes"], sc)
            d["analysis"]["components_error"] = None
            d["scomp_status"] = "done"
            bump(d, "analysis_ver")
        update_ad(aid, fn)
    except Exception as exc:  # noqa: BLE001
        msg = str(getattr(exc, "detail", None) or exc)[:300]
        def fail(d):
            d["scomp_status"] = "failed"
            if d.get("analysis"):
                d["analysis"]["components_error"] = msg
        update_ad(aid, fail)


@app.post("/api/ads/{aid}/scene-components")
def scene_components(aid: str):
    """تفصيص مكونات مشاهد الإعلان الأصلي (للإعلانات اللي اتحللت قبل الخطوة دي، أو لو عايز تعيده)."""
    with closing(db()) as conn:
        _, d = ad_row(conn, aid)
    if not d.get("analysis"):
        raise HTTPException(400, "استنى لما التحليل يخلص")
    if d.get("scomp_status") == "working":
        raise HTTPException(400, "التفصيص شغال بالفعل")
    update_ad(aid, lambda d: d.update(scomp_status="working"))
    threading.Thread(target=run_scene_components, args=(aid,), daemon=True).start()
    return ad_response(aid)


@app.post("/api/ads/{aid}/analyze")
def reanalyze_ad(aid: str):
    with closing(db()) as conn:
        _, d = ad_row(conn, aid)
    if d.get("status") in ("queued", "working"):
        raise HTTPException(400, "التحليل شغال بالفعل")
    update_ad(aid, lambda d: d.update(status="queued", error=None))
    threading.Thread(target=run_ad_analysis, args=(aid,), daemon=True).start()
    return ad_response(aid)


class AdAdaptIn(BaseModel):
    message: str = ""
    then_prod: bool = False  # بعد ما الاقتراح يتكتب، التنفيذ يبدأ منه على طول


@app.post("/api/ads/{aid}/adapt")
def adapt_ad(aid: str, body: AdAdaptIn):
    """الاقتراح من جديد (بالإعدادات والستايل الحاليين)، أو تعديله برسالة منك."""
    with closing(db()) as conn:
        _, d = ad_row(conn, aid)
    if not d.get("analysis"):
        raise HTTPException(400, "استنى لما التحليل يخلص")
    if d.get("adapt_status") == "working":
        raise HTTPException(400, "الاقتراح بيتكتب بالفعل")
    msg = body.message.strip()[:3000]
    def fn(d):
        d["adapt_status"], d["adapt_error"] = "working", None
        d["chain_prod"] = body.then_prod
        if msg:
            d.setdefault("chat", []).append({"role": "user", "content": msg})
        else:
            d["chat"] = []
    update_ad(aid, fn)
    threading.Thread(target=run_ad_adapt, args=(aid,), daemon=True).start()
    return ad_response(aid)


def ad_media_chat(messages: list[dict], max_tokens: int = 32000) -> str:
    """موديل بيفهم الفيديو والصوت (Gemini). بيجرب المختار، ولو مش متاح اللي بعده."""
    if atlas.mock_mode():
        return "{}"
    errors = []
    for model in atlas.model_candidates(ads_settings()["video_model"], ("gemini-2.5-pro", "gemini-2.5-flash"), AD_VIDEO_FALLBACKS)[:4]:
        try:
            body = {"model": model, "messages": messages, "temperature": 0.3, "max_tokens": max_tokens,
                    "response_format": {"type": "json_object"}}
            with httpx.Client(timeout=600) as client:
                resp = client.post(f"{atlas.LLM_URL}/chat/completions", headers=atlas._headers(), json=body)
                if resp.status_code in (400, 422):  # موديل مش بيقبل JSON mode
                    body.pop("response_format")
                    resp = client.post(f"{atlas.LLM_URL}/chat/completions", headers=atlas._headers(), json=body)
            data = atlas._check(resp, f"موديل الفيديو ({model})")
            text = str(data["choices"][0]["message"]["content"] or "").strip()
            if text:
                return text
            errors.append(f"{model}: رد فاضي")
        except (atlas.AtlasError, httpx.HTTPError, KeyError, IndexError) as exc:
            errors.append(f"{model}: {str(exc)[:150]}")
    raise atlas.AtlasError("موديل الفيديو مش شغال: " + " | ".join(errors[:3]))


def ad_json(text: str, what: str) -> dict:
    """JSON من رد موديل الفيديو. لو بايظ ومعرفناش نصلّحه، موديل الكلام بيصلّحه (أرخص بكتير من إعادة التحليل)."""
    try:
        return az.parse_json(text, what)
    except ValueError as first:
        try:
            fixed = series_chat([
                {"role": "system", "content": "رجّع نفس البيانات دي كـ JSON صحيح بالظبط من غير أي تغيير في المحتوى ومن غير أي كلام تاني. "
                                              "لو الرد مقطوع في الآخر اقفله بشكل صحيح."},
                {"role": "user", "content": text[:60000]},
            ], json_mode=True)
            return az.parse_json(fixed, what)
        except (HTTPException, ValueError):
            raise first from None


def data_url(path: Path, mime: str) -> str:
    import base64
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def ad_loudness(path: Path) -> dict:
    """قياس الصوت محليًا (من غير موديل): الارتفاع (LUFS) وأعلى نقطة."""
    out = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True, timeout=300).stderr
    tail = out[out.rfind("Summary:"):] if "Summary:" in out else out
    lufs = re.search(r"I:\s*(-?[\d.]+) LUFS", tail)
    peak = re.search(r"Peak:\s*(-?[\d.]+) dBFS", tail)
    lra = re.search(r"LRA:\s*(-?[\d.]+) LU", tail)
    return {"lufs": float(lufs.group(1)) if lufs else None, "true_peak": float(peak.group(1)) if peak else None,
            "range_lu": float(lra.group(1)) if lra else None}


def run_ad_audio(aid: str) -> None:
    """خطوة جانبية: تفصيص الصوت (كلام، مزيكا، مؤثرات) + قياس الارتفاع."""
    try:
        with closing(db()) as conn:
            _, d = ad_row(conn, aid)
        folder = ad_dir(aid)
        src = folder / d["source"]["file"]
        dur = min(d["source"]["duration"], AD_MAX_SECONDS)
        audio = folder / "audio.mp3"
        subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-t", f"{dur:.2f}",
                        "-vn", "-ac", "1", "-b:a", "96k", str(audio)], check=True, capture_output=True, timeout=300)
        tech = ad_loudness(src)
        data = az.mock_audio() if atlas.mock_mode() else ad_json(
            ad_media_chat(az.with_media(az.audio_messages(dur), data_url(audio, "audio/mpeg"), "ad.mp3")), "تحليل الصوت")
        update_ad(aid, lambda d: d.update(audio=data, audio_tech=tech, audio_error=None, audio_status="done"))
    except Exception as exc:  # noqa: BLE001
        msg = str(getattr(exc, "detail", None) or exc)[:400]
        update_ad(aid, lambda d: d.update(audio_status="failed", audio_error=msg))


@app.post("/api/ads/{aid}/audio-analyze")
def audio_analyze(aid: str):
    with closing(db()) as conn:
        _, d = ad_row(conn, aid)
    if not (d.get("source") or {}).get("has_audio"):
        raise HTTPException(400, "الفيديو ده مفيهوش صوت")
    if d.get("audio_status") == "working":
        raise HTTPException(400, "الصوت بيتحلل بالفعل")
    update_ad(aid, lambda d: d.update(audio_status="working", audio_error=None))
    threading.Thread(target=run_ad_audio, args=(aid,), daemon=True).start()
    return ad_response(aid)


def run_ad_analysis(aid: str) -> None:
    def step(label: str):
        update_ad(aid, lambda d: d.update(status="working", step=label))
    try:
        with closing(db()) as conn:
            _, d = ad_row(conn, aid)
        folder = ad_dir(aid)
        src = folder / d["source"]["file"]
        dur = min(d["source"]["duration"], AD_MAX_SECONDS)
        step("بيجهّز الفيديو")
        proxy = folder / "proxy.mp4"
        # نسخة صغيرة للموديل: الصورة والصوت كفاية للتحليل وحجمها صغير
        subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-t", f"{dur:.2f}",
                        "-vf", "scale='if(gt(iw,ih),min(640,iw),-2)':'if(gt(iw,ih),-2,min(640,ih))',fps=12",
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "31", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-ac", "1", "-b:a", "64k", str(proxy)], check=True, capture_output=True, timeout=600)
        step("بيتفرج على الإعلان (الصورة والصوت)")
        if atlas.mock_mode():
            analysis = az.mock_analysis(dur)
        else:
            analysis = ad_json(ad_media_chat(az.with_media(az.video_messages(dur, d.get("settings", {}).get("notes", "")),
                                                           data_url(proxy, "video/mp4"), "ad.mp4")), "تحليل الإعلان")
        analysis["scenes"] = az.clean_scenes(analysis.get("scenes"), dur)
        step("بيطلّع صورة من كل مشهد")
        for s in analysis["scenes"]:
            fr = f"scene-{s['n']:02d}.jpg"
            t = (s["start"] + s["end"]) / 2
            subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.2f}", "-i", str(src),
                            "-frames:v", "1", "-vf", "scale=-2:480", "-q:v", "4", str(folder / "frames" / fr)],
                           capture_output=True, timeout=60)
            if (folder / "frames" / fr).exists():
                s["frame"] = fr
        step("بيفصّص مكونات كل مشهد والموشن جرافيك")
        try:
            sc = az.mock_scene_components(analysis["scenes"]) if atlas.mock_mode() else ad_json(
                ad_media_chat(az.with_media(az.scene_components_messages(analysis["scenes"]), data_url(proxy, "video/mp4"), "ad.mp4")),
                "مكونات المشاهد")
            az.merge_scene_components(analysis["scenes"], sc)
            analysis["components_error"] = None
        except (atlas.AtlasError, ValueError, HTTPException) as exc:
            analysis["components_error"] = str(getattr(exc, "detail", None) or exc)[:300]
        if not analysis.get("title"):
            analysis["title"] = ""
        chain = []
        def done(d):
            d.update(analysis=analysis, status="done", step=None, error=None)
            bump(d, "analysis_ver")
            # أول مرة بس الاقتراح بيتكتب لوحده. بعد كده بزرار «التالي» عشان ميمسحش اقتراح اتعدل
            if not d.get("adaptation") and d.get("adapt_status") != "working":
                d.update(adapt_status="working", adapt_error=None, chat=[])
                chain.append(True)
        update_ad(aid, done)
    except Exception as exc:  # noqa: BLE001
        msg = str(getattr(exc, "detail", None) or exc)[:500]
        if isinstance(exc, subprocess.CalledProcessError):
            msg = f"FFmpeg: {(exc.stderr or b'').decode(errors='ignore')[-300:] if isinstance(exc.stderr, bytes) else exc.stderr}"
        update_ad(aid, lambda d: d.update(status="failed", step=None, error=msg))
        return
    if chain:
        run_ad_adapt(aid)


def ad_style(style_id: str | None) -> dict | None:
    if not style_id:
        return None
    with closing(db()) as conn:
        r = conn.execute("SELECT * FROM ad_styles WHERE id = ?", (style_id,)).fetchone()
    return {"name": r["name"], **json.loads(r["data"])} if r else None


def other_ads(aid: str, limit: int = 8) -> list[dict]:
    """ملخص الإعلانات التانية (الأحدث الأول) عشان الاقتراح الجديد ميطلعش شبههم."""
    out = []
    with closing(db()) as conn:
        rows = conn.execute("SELECT id, data FROM ads WHERE id != ? ORDER BY created_at DESC", (aid,)).fetchall()
    for r in rows:
        a = (json.loads(r["data"]).get("adaptation") or {})
        if a.get("title"):
            out.append({**{k: str(a.get(k) or "")[:200] for k in ("title", "hook", "tone", "palette", "locations")},
                        "angle": str(a.get("angle") or a.get("kochi_angle") or "")[:200]})
        if len(out) >= limit:
            break
    return out


def run_ad_directions(aid: str) -> None:
    try:
        with closing(db()) as conn:
            _, d = ad_row(conn, aid)
        settings = d.get("settings") or {}
        if atlas.mock_mode():
            result = az.mock_directions()
        else:
            result = ad_json(series_chat(az.directions_messages(brand_settings(), d.get("analysis") or {}, settings,
                                                                ad_brain(settings), other_ads(aid))), "الاتجاهات")
        dirs = [x for x in result.get("directions") or [] if isinstance(x, dict)][:4]
        if not dirs:
            raise RuntimeError("الموديل ما رجعش اتجاهات")
        update_ad(aid, lambda d: d.update(directions=dirs, directions_status="done", directions_error=None))
    except Exception as exc:  # noqa: BLE001
        msg = str(getattr(exc, "detail", None) or exc)[:400]
        update_ad(aid, lambda d: d.update(directions_status="failed", directions_error=msg))


@app.post("/api/ads/{aid}/directions")
def ad_directions(aid: str):
    """🎲 3 اتجاهات مختلفة للتطبيق على البراند تختار منهم قبل ما الاقتراح يتكتب."""
    with closing(db()) as conn:
        _, d = ad_row(conn, aid)
    if not d.get("analysis"):
        raise HTTPException(400, "استنى لما التحليل يخلص")
    if d.get("directions_status") == "working":
        raise HTTPException(400, "بيفكر في الاتجاهات بالفعل")
    update_ad(aid, lambda d: d.update(directions_status="working", directions_error=None))
    threading.Thread(target=run_ad_directions, args=(aid,), daemon=True).start()
    return ad_response(aid)


def run_ad_adapt(aid: str) -> None:
    try:
        with closing(db()) as conn:
            _, d = ad_row(conn, aid)
        settings = d.get("settings") or {}
        if atlas.mock_mode():
            result = az.mock_adaptation(int(settings.get("duration") or 30))
        else:
            msgs = az.adapt_messages(brand_settings(), d.get("analysis") or {}, d.get("audio") or {}, settings,
                                     ad_style(settings.get("style_id")), d.get("chat") or [], ad_brain(settings), other_ads(aid))
            result = ad_json(series_chat(msgs), "اقتراح الإعلان")
        def fn(d):
            d["adaptation"] = {**result, "based_on": d.get("analysis_ver", 0)}
            d["adapt_status"], d["adapt_error"] = "done", None
            bump(d, "adapt_ver")
            if d.get("chat"):
                d["chat"].append({"role": "assistant", "content": json.dumps(result, ensure_ascii=False)[:6000]})
        update_ad(aid, fn)
    except Exception as exc:  # noqa: BLE001
        msg = str(getattr(exc, "detail", None) or exc)[:500]
        update_ad(aid, lambda d: d.update(adapt_status="failed", adapt_error=msg, chain_prod=False))
        return
    chain = []
    update_ad(aid, lambda d: chain.append(d.pop("chain_prod", False)))
    if chain and chain[0]:
        try:
            prod_start(aid)
        except HTTPException as exc:
            update_ad(aid, lambda d: d.update(adapt_error=f"الاقتراح اتكتب بس التنفيذ مبدأش: {exc.detail}"))


# ---------- ملف العميل: المنتج (تطبيق / منتج ملموس / خدمة)، أصوله الحقيقية (شاشات، لوجو، صور منتج) وهويته

BRAIN_KINDS = ("screens", "logos", "products", "characters", "sets", "props")
BRAIN_FIELDS = ("type", "domain", "about", "audience", "rules", "palette", "theme", "typography", "ui_style", "logo_description",
                "style", "market", "language", "logo_rule", "modest")
BRAIN_LOCK = threading.Lock()


def brain_dir(bid: str) -> Path:
    d = ADS_DIR / "brains" / Path(bid).name
    d.mkdir(parents=True, exist_ok=True)
    return d


def brain_row(bid: str) -> dict | None:
    with closing(db()) as conn:
        r = conn.execute("SELECT * FROM ad_brains WHERE id = ?", (bid,)).fetchone()
    return {"id": r["id"], "name": r["name"], "created_at": r["created_at"], **json.loads(r["data"])} if r else None


def update_brain(bid: str, fn) -> None:
    with BRAIN_LOCK, closing(db()) as conn, conn:
        r = conn.execute("SELECT * FROM ad_brains WHERE id = ?", (bid,)).fetchone()
        if r is None:
            raise HTTPException(404, "العميل ده مش موجود")
        d = json.loads(r["data"])
        name = fn(d)
        conn.execute("UPDATE ad_brains SET data = ?" + (", name = ?" if name else "") + " WHERE id = ?",
                     (json.dumps(d, ensure_ascii=False), *([name] if name else []), bid))


def brain_to_dict(b: dict) -> dict:
    base = f"/media/ads/brains/{b['id']}"
    out = {k: b.get(k, "") for k in ("id", "name", "created_at", *BRAIN_FIELDS)}
    out.update(status=b.get("status", "idle"), error=b.get("error"))
    for kind in BRAIN_KINDS:
        out[kind] = [{**a, "url": f"{base}/{a['file']}"} for a in b.get(kind) or []]
    return out


def seed_brain() -> None:
    """👤 العملاء: أول مرة بيتعمل عميل. لو البرنامج كان شغال لكوتشي قبل كده، هويتها ولوجوها وجملها بتتنقل لملف عميل كوتشي."""
    if auth.get_setting("clients_v1"):
        return
    with CLIENTS_LOCK:
        if auth.get_setting("clients_v1"):
            return
        with closing(db()) as conn:
            first = conn.execute("SELECT id FROM ad_brains ORDER BY created_at LIMIT 1").fetchone()
            used = any(conn.execute(f"SELECT 1 FROM {t} LIMIT 1").fetchone() for t in ("ads", "carousels", "series", "coaches"))
        legacy = used or bool(first) or bool(auth.get_setting("brand")) or bool(legacy_logo_path())
        lb = legacy_brand() if legacy else {}
        fields = {"about": lb.get("about", ""), "audience": lb.get("audience", ""), "palette": lb.get("colors", ""),
                  "typography": lb.get("font", ""), "style": lb.get("style", ""), "logo_rule": lb.get("logo_rule", ""),
                  "market": lb.get("market", ""), "language": lb.get("language", ""), "modest": lb.get("modest", ""),
                  "domain": "لياقة وتغذية وتدريب أونلاين" if legacy else "",
                  "rules": ("اللبس محتشم دايمًا: البنات لبس واسع طويل مع حجاب، والرجالة تيشيرت وبنطلون أو شورت تحت الركبة. "
                            + lb.get("rules", "")) if legacy else ""}
        if first:
            bid = first["id"]
            update_brain(bid, lambda d: d.update({k: v for k, v in fields.items() if v and not d.get(k)}))
        else:
            bid = uuid.uuid4().hex[:12]
            data = {"type": "app", **{k: "" for k in BRAIN_FIELDS if k != "type"}, **fields, "theme": "", "ui_style": "",
                    "logo_description": "", "screens": [], "logos": [], "products": [], "status": "idle"}
            with closing(db()) as conn, conn:
                conn.execute("INSERT INTO ad_brains (id, name, data, created_at) VALUES (?, ?, ?, ?)",
                             (bid, (lb.get("name") or "KOCHI") if legacy else "عميلي", json.dumps(data, ensure_ascii=False), now()))
        if legacy:
            try:
                ctas = json.loads(auth.get_setting("carousel_ctas") or "null")
            except ValueError:
                ctas = None
            logo = legacy_logo_path()
            def move(d):
                d.setdefault("ctas", ctas if isinstance(ctas, list) and ctas else cz.LEGACY_CTAS)
                if logo and not d.get("logos"):
                    f = f"logo-{uuid.uuid4().hex[:6]}{logo.suffix.lower()}"
                    shutil.copyfile(logo, brain_dir(bid) / f)
                    d["logos"] = [{"file": f, "name": "اللوجو", "description": ""}]
            update_brain(bid, move)
        auth.set_setting("active_client", auth.get_setting("active_client") or bid)
        auth.set_setting("clients_v1", "1")


CLIENTS_LOCK = threading.Lock()


def first_client_id() -> str | None:
    """أقدم عميل: الحاجات اللي اتعملت قبل العملاء (من غير عميل) بتاعته."""
    seed_brain()
    with closing(db()) as conn:
        r = conn.execute("SELECT id FROM ad_brains ORDER BY created_at LIMIT 1").fetchone()
    return r["id"] if r else None


def active_client_id() -> str | None:
    seed_brain()
    cid = auth.get_setting("active_client")
    if cid and brain_row(cid):
        return cid
    return first_client_id()


def active_client() -> dict | None:
    cid = active_client_id()
    return brain_row(cid) if cid else None


def owned(client_id: str | None) -> bool:
    """الحاجة دي بتاعة العميل المختار؟ (اللي ملهاش عميل، أو عميلها اتمسح، بتاعة أقدم عميل)"""
    if client_id and brain_row(client_id):
        return client_id == active_client_id()
    return first_client_id() == active_client_id()


def ad_brain(settings: dict | None) -> dict | None:
    """ملف العميل المختار للإعلان ده (ولو مش مختار: العميل الحالي)."""
    bid = (settings or {}).get("brain_id")
    if bid == "none":
        return None
    return (brain_row(bid) if bid else None) or active_client()


atlas.modesty_on = lambda: bool((active_client() or {}).get("modest"))  # اللبس المحتشم حسب ملف العميل


@app.get("/api/clients")
def list_clients():
    """👤 العملاء (للاختيار من فوق) والعميل المختار."""
    active = active_client_id()
    out = []
    for b in list_brains():
        out.append({"id": b["id"], "name": b["name"], "domain": b.get("domain", ""),
                    "logo": (b.get("logos") or [{}])[0].get("url"), "active": b["id"] == active})
    return {"clients": out, "active": active}


class ActiveClientIn(BaseModel):
    id: str


@app.put("/api/clients/active")
def set_active_client(body: ActiveClientIn):
    if not brain_row(body.id):
        raise HTTPException(404, "العميل ده مش موجود")
    auth.set_setting("active_client", body.id)
    return list_clients()


@app.get("/api/ad-brains")
def list_brains():
    seed_brain()
    with closing(db()) as conn:
        ids = [r["id"] for r in conn.execute("SELECT id FROM ad_brains ORDER BY created_at")]
    return [brain_to_dict(brain_row(i)) for i in ids]


class BrainIn(BaseModel):
    name: str | None = None
    fields: dict = {}


@app.post("/api/ad-brains")
def create_brain(body: BrainIn):
    bid = uuid.uuid4().hex[:12]
    data = {"type": "app", **{k: str(body.fields.get(k) or "") for k in BRAIN_FIELDS if k != "type"},
            "screens": [], "logos": [], "products": [], "status": "idle"}
    if body.fields.get("type") in az.BRAIN_TYPES:
        data["type"] = body.fields["type"]
    with closing(db()) as conn, conn:
        conn.execute("INSERT INTO ad_brains (id, name, data, created_at) VALUES (?, ?, ?, ?)",
                     (bid, (body.name or "").strip()[:80] or "عميل جديد", json.dumps(data, ensure_ascii=False), now()))
    return brain_to_dict(brain_row(bid))


@app.patch("/api/ad-brains/{bid}")
def patch_brain(bid: str, body: BrainIn):
    def fn(d):
        for k in BRAIN_FIELDS:
            if k in body.fields:
                v = str(body.fields[k] or "")
                if k == "type" and v not in az.BRAIN_TYPES:
                    continue
                d[k] = v[:8000]
                if k in ("palette", "theme", "typography", "ui_style", "logo_description") and k not in d.setdefault("edited", []):
                    d["edited"].append(k)  # الاستنباط بعد كده ميغيّرش اللي كتبته بإيدك
        return (body.name or "").strip()[:80] or None
    update_brain(bid, fn)
    return brain_to_dict(brain_row(bid))


@app.delete("/api/ad-brains/{bid}")
def delete_brain(bid: str):
    with closing(db()) as conn:
        if conn.execute("SELECT COUNT(*) FROM ad_brains").fetchone()[0] <= 1:
            raise HTTPException(400, "ده آخر عميل. اعمل عميل تاني الأول")
    with closing(db()) as conn, conn:
        conn.execute("DELETE FROM ad_brains WHERE id = ?", (bid,))
    shutil.rmtree(ADS_DIR / "brains" / Path(bid).name, ignore_errors=True)
    return {"ok": True}


@app.post("/api/ad-brains/{bid}/assets")
def upload_brain_assets(bid: str, kind: str = Form("screens"), files: list[UploadFile] = File(...)):
    """رفع شاشات التطبيق (فولدر كامل) أو اللوجو أو صور المنتج. بعدها البرنامج بيوصّفهم ويستنبط الهوية لوحده."""
    if kind not in BRAIN_KINDS:
        raise HTTPException(400, "نوع غير معروف")
    if brain_row(bid) is None:
        raise HTTPException(404, "العميل ده مش موجود")
    folder = brain_dir(bid)
    added = []
    for f in files[:120]:
        if Path(f.filename or "").suffix.lower() not in IMAGE_EXTENSIONS:
            continue  # الفولدر ممكن يكون فيه ملفات تانية
        name = save_upload(f, IMAGE_EXTENSIONS, folder, kind[:-1])
        added.append({"file": name, "name": Path(f.filename or name).stem[:60], "description": ""})
    if not added:
        raise HTTPException(400, "مفيش صور في الملفات دي (PNG / JPG / WEBP)")
    update_brain(bid, lambda d: d.setdefault(kind, []).extend(added) or d.update(status="working", error=None))
    threading.Thread(target=run_brain_analyze, args=(bid,), daemon=True).start()
    return brain_to_dict(brain_row(bid))


class BrainAssetIn(BaseModel):
    name: str | None = None
    description: str | None = None


def find_brain_asset(d: dict, file: str) -> tuple[str, dict]:
    for kind in BRAIN_KINDS:
        for a in d.get(kind) or []:
            if a["file"] == file:
                return kind, a
    raise HTTPException(404, "الصورة دي مش موجودة")


@app.patch("/api/ad-brains/{bid}/assets/{file}")
def patch_brain_asset(bid: str, file: str, body: BrainAssetIn):
    def fn(d):
        _, a = find_brain_asset(d, file)
        if body.name is not None:
            a["name"], a["named"] = body.name.strip()[:80], True
        if body.description is not None:
            a["description"] = body.description.strip()[:2000]
    update_brain(bid, fn)
    return brain_to_dict(brain_row(bid))


@app.delete("/api/ad-brains/{bid}/assets/{file}")
def delete_brain_asset(bid: str, file: str):
    def fn(d):
        kind, a = find_brain_asset(d, file)
        d[kind] = [x for x in d[kind] if x is not a]
    update_brain(bid, fn)
    (brain_dir(bid) / Path(file).name).unlink(missing_ok=True)
    return brain_to_dict(brain_row(bid))


@app.post("/api/ad-brains/{bid}/analyze")
def analyze_brain(bid: str):
    b = brain_row(bid)
    if b is None:
        raise HTTPException(404, "العميل ده مش موجود")
    if not any(b.get(k) for k in BRAIN_KINDS):
        raise HTTPException(400, "ارفع اللوجو أو شاشات التطبيق الأول")
    update_brain(bid, lambda d: d.update(status="working", error=None))
    threading.Thread(target=run_brain_analyze, args=(bid,), daemon=True).start()
    return brain_to_dict(b)


def model_image(path: Path, size: int = 768) -> Path:
    """نسخة صغيرة من الصورة للموديل (أوفر في الحجم والتكلفة)."""
    out = TMP_DIR / "brain_view" / f"{path.parent.name}-{path.stem}-{int(path.stat().st_mtime)}.jpg"
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(path),
                        "-vf", f"scale='min({size},iw)':-2", "-q:v", "4", str(out)], capture_output=True, timeout=60)
    return out if out.exists() else path


def run_brain_analyze(bid: str) -> None:
    """الموديل بيشوف اللوجو والشاشات وصور المنتج: يستنبط الألوان والثيم والخطوط وشكل الواجهة، ويوصّف كل صورة."""
    try:
        b = brain_row(bid)
        folder = brain_dir(bid)
        assets = [a for k in ("logos", "screens", "products") for a in b.get(k) or []][:24]
        if atlas.mock_mode():
            out = {"palette": "#57B8AF teal (accent), #EEECDA cream (background)", "theme": "فاتح وهادي", "typography": "خط عريض مستدير",
                   "ui_style": "Clean light UI with teal accents and rounded cards.", "logo_description": "Teal wordmark.",
                   "assets": [{"file": a["file"], "name": a["name"], "description": f"وصف تجريبي لـ {a['name']}"} for a in assets]}
        else:
            parts = [{"type": "text", "text": az.brain_messages(b, [a["file"] for a in assets])}]
            for a in assets:
                parts.append({"type": "image_url", "image_url": {"url": data_url(model_image(folder / a["file"]), "image/jpeg")}})
            out = ad_json(ad_media_chat([{"role": "user", "content": parts}], 12000), "ملف العميل")
        got = {str(x.get("file")): x for x in out.get("assets") or [] if isinstance(x, dict)}
        def fn(d):
            for k in ("palette", "theme", "typography", "ui_style", "logo_description"):
                if out.get(k) and k not in (d.get("edited") or []):
                    d[k] = str(out[k])[:4000]
            for kind in BRAIN_KINDS:
                for a in d.get(kind) or []:
                    x = got.get(a["file"])
                    if not x:
                        continue
                    if not a.get("description"):
                        a["description"] = str(x.get("description") or "")[:2000]
                    # الاسم اللي جاي من اسم الملف بيتبدل باسم أوضح، إلا لو انت سميته بإيدك
                    if x.get("name") and not a.get("named"):
                        a["name"] = str(x["name"])[:80]
            d.update(status="done", error=None)
        update_brain(bid, fn)
    except Exception as exc:  # noqa: BLE001
        msg = str(getattr(exc, "detail", None) or exc)[:300]
        try:
            update_brain(bid, lambda d: d.update(status="failed", error=msg))
        except HTTPException:
            pass


def brain_assets(brain: dict | None, kinds: tuple[str, ...]) -> list[dict]:
    return [{**a, "kind": k} for k in kinds for a in (brain or {}).get(k) or []]


def apply_brain(aid: str, sids: list[str] | None = None, use_model: bool = True) -> int:
    """يحط الأصول الحقيقية من ملف العميل مكان مكونات اللقطات: الشاشات للـ ui، اللوجو للـ logo، وصورة المنتج للمنتج.
    الصور اللي انت رافعها بنفسك متتلمسش. بيرجّع عدد المكونات اللي اتطبّق عليها."""
    with closing(db()) as conn:
        _, d = ad_row(conn, aid)
    p = d.get("prod")
    brain = ad_brain(d.get("settings"))
    if not p or not brain:
        return 0
    want = {"ui": ("screens",), "logo": ("logos",), "prop": ("products", "props"), "character": ("characters",), "background": ("sets",)}
    todo = []
    for s in p["shots"]:
        if sids and s["id"] not in sids:
            continue
        for c in s.get("components") or []:
            if c.get("use") is False or c.get("kind") not in want or (is_uploaded(c.get("image")) and not c.get("brain_asset")):
                continue
            pool = brain_assets(brain, want[c["kind"]])
            if c["kind"] in ("character", "background", "prop"):
                # الأبطال والأماكن والأدوات المتكررة: بالاسم بالظبط بس (مفيش تخمين)
                pool = [a for a in pool if a.get("name") and (a["name"] == c.get("name") or a["name"] == c.get("asset")
                                                              or (a.get("cast_id") and a.get("cast_id") == c.get("cast_id")))]
                if c["kind"] == "prop" and not pool and brain.get("type") == "physical" and c.get("asset"):
                    pool = brain_assets(brain, ("products",))
                if not pool:
                    continue
            if pool:
                todo.append((s["id"], c, pool))
    if not todo:
        return 0
    def by_name(c, pool):
        key = str(c.get("asset") or "").strip()
        for a in pool:
            if key and (a.get("name") == key or a["file"] == key):
                return a
        text = f"{c.get('name', '')} {c.get('description', '')}"
        hits = [a for a in pool if a.get("name") and a["name"] in text]
        return hits[0] if len(hits) == 1 else None
    picks: dict[str, str] = {}
    unsure = []
    for sid, c, pool in todo:
        a = by_name(c, pool) or (pool[0] if len(pool) == 1 or c.get("kind") in ("character", "background") else None)
        if a:
            picks[c["id"]] = a["file"]
        else:
            unsure.append((sid, c, pool))
    if unsure:
        try:
            if not use_model or atlas.mock_mode():
                raise ValueError
            out = ad_json(series_chat(az.match_messages([c for _, c, _ in unsure], brain_assets(brain, BRAIN_KINDS))), "اختيار الأصول")
            files = {a["file"] for a in brain_assets(brain, BRAIN_KINDS)}
            for m in out.get("matches") or []:
                if isinstance(m, dict) and m.get("file") in files:
                    picks[str(m.get("id"))] = m["file"]
        except (ValueError, HTTPException, atlas.AtlasError):
            pass
        for _, c, pool in unsure:
            picks.setdefault(c["id"], pool[0]["file"])
    folder, comp_dir = brain_dir(brain["id"]), prod_dir(aid, "comps")
    copies = {}
    for cid, f in picks.items():
        src = folder / f
        if src.exists():
            name = f"{cid}-up_brain-{Path(f).stem[:40]}{src.suffix.lower()}"
            if not (comp_dir / name).exists():
                shutil.copyfile(src, comp_dir / name)
            copies[cid] = (name, f)
    count = []
    def fn(d):
        for s in (d.get("prod") or {}).get("shots") or []:
            for c in s.get("components") or []:
                if c["id"] in copies and not (is_uploaded(c.get("image")) and not c.get("brain_asset")):
                    name, f = copies[c["id"]]
                    if c.get("image") != name:
                        c.setdefault("images", []).append(name)
                    c.update(image=name, brain_asset=f, status="done", error=None)
                    count.append(1)
    update_ad(aid, fn)
    return len(count)


@app.post("/api/ads/{aid}/prod/apply-brain")
def prod_apply_brain(aid: str, shot_id: str | None = None):
    with closing(db()) as conn:
        _, d = ad_row(conn, aid)
    prod_of(d)
    if not ad_brain(d.get("settings")):
        raise HTTPException(400, "مفيش ملف عميل مختار. اعمله من «👤 ملف العميل»")
    n = apply_brain(aid, [shot_id] if shot_id else None)
    return {**ad_response(aid), "applied": n}


# ---------- ستايلات الإعلانات: صور بتتحفظ وتتختار لأي إعلان

def style_dir(sid: str) -> Path:
    d = ADS_DIR / "styles" / Path(sid).name
    d.mkdir(parents=True, exist_ok=True)
    return d


def style_to_dict(r: sqlite3.Row) -> dict:
    d = json.loads(r["data"])
    return {"id": r["id"], "name": r["name"], "notes": d.get("notes", ""), "status": d.get("status", "done"),
            "error": d.get("error"), "from_ad": d.get("from_ad"), "created_at": r["created_at"],
            "images": [f"/media/ads/styles/{r['id']}/{f}" for f in d.get("images") or []]}


@app.get("/api/ad-styles")
def list_ad_styles():
    with closing(db()) as conn:
        return [style_to_dict(r) for r in conn.execute("SELECT * FROM ad_styles ORDER BY created_at DESC")]


def add_style(name: str, image_paths: list[Path], notes: str = "", from_ad: str | None = None) -> str:
    sid = uuid.uuid4().hex[:12]
    folder = style_dir(sid)
    files = []
    for i, p in enumerate(image_paths):
        f = f"img-{i + 1:02d}{p.suffix.lower()}"
        shutil.copyfile(p, folder / f)
        files.append(f)
    data = {"images": files, "notes": notes, "status": "working", "from_ad": from_ad}
    with closing(db()) as conn, conn:
        conn.execute("INSERT INTO ad_styles (id, name, data, created_at) VALUES (?, ?, ?, ?)",
                     (sid, name.strip() or "ستايل جديد", json.dumps(data, ensure_ascii=False), now()))
    threading.Thread(target=describe_style, args=(sid, not name.strip()), daemon=True).start()
    return sid


def describe_style(sid: str, rename: bool) -> None:
    """الموديل بيشوف صور الستايل ويكتب وصفه (بالإنجليزي عشان البرومبتات)."""
    with closing(db()) as conn:
        r = conn.execute("SELECT * FROM ad_styles WHERE id = ?", (sid,)).fetchone()
    if r is None:
        return
    d = json.loads(r["data"])
    folder = style_dir(sid)
    try:
        if atlas.mock_mode():
            out = {"name": "ستايل تجريبي", "notes": "Cinematic test style."}
        else:
            parts = [{"type": "text", "text": az.style_messages(", ".join(d["images"]))[0]["content"]}]
            for f in d["images"][:6]:
                mime = "image/png" if f.endswith(".png") else "image/webp" if f.endswith(".webp") else "image/jpeg"
                parts.append({"type": "image_url", "image_url": {"url": data_url(folder / f, mime)}})
            out = az.parse_json(ad_media_chat([{"role": "user", "content": parts}], 3000), "وصف الستايل")
        notes = (d.get("notes") + "\n\n" if d.get("notes") else "") + str(out.get("notes") or "").strip()
        d.update(notes=notes.strip(), status="done", error=None)
        name = str(out.get("name") or "").strip()[:60] if rename else None
    except Exception as exc:  # noqa: BLE001
        d.update(status="failed", error=str(getattr(exc, "detail", None) or exc)[:300])
        name = None
    with closing(db()) as conn, conn:
        conn.execute("UPDATE ad_styles SET data = ?" + (", name = ?" if name else "") + " WHERE id = ?",
                     (json.dumps(d, ensure_ascii=False), *( [name] if name else []), sid))


@app.post("/api/ad-styles")
def create_ad_style(files: list[UploadFile] = File(...), name: str = Form(""), notes: str = Form("")):
    tmp = Path(tempfile.mkdtemp(dir=TMP_DIR))
    try:
        paths = [tmp / save_upload(f, IMAGE_EXTENSIONS, tmp, f"s{i}") for i, f in enumerate(files[:12])]
        if not paths:
            raise HTTPException(400, "ارفع صورة واحدة على الأقل")
        sid = add_style(name, paths, notes.strip())
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    with closing(db()) as conn:
        return style_to_dict(conn.execute("SELECT * FROM ad_styles WHERE id = ?", (sid,)).fetchone())


class StylePatchIn(BaseModel):
    name: str | None = None
    notes: str | None = None


@app.patch("/api/ad-styles/{sid}")
def patch_ad_style(sid: str, body: StylePatchIn):
    with closing(db()) as conn, conn:
        r = conn.execute("SELECT * FROM ad_styles WHERE id = ?", (sid,)).fetchone()
        if r is None:
            raise HTTPException(404, "الستايل غير موجود")
        d = json.loads(r["data"])
        if body.notes is not None:
            d["notes"] = body.notes.strip()[:4000]
        conn.execute("UPDATE ad_styles SET data = ?, name = ? WHERE id = ?",
                     (json.dumps(d, ensure_ascii=False), (body.name or r["name"]).strip()[:60] or r["name"], sid))
        return style_to_dict(conn.execute("SELECT * FROM ad_styles WHERE id = ?", (sid,)).fetchone())


@app.delete("/api/ad-styles/{sid}")
def delete_ad_style(sid: str):
    with closing(db()) as conn, conn:
        conn.execute("DELETE FROM ad_styles WHERE id = ?", (sid,))
    shutil.rmtree(ADS_DIR / "styles" / Path(sid).name, ignore_errors=True)
    return {"ok": True}


class SaveStyleIn(BaseModel):
    name: str = ""


@app.post("/api/ads/{aid}/save-style")
def save_ad_style(aid: str, body: SaveStyleIn):
    """ستايل الإعلان نفسه (صور من مشاهده + وصف التصوير والألوان) بيتحفظ في المكتبة عشان تستخدمه بعدين."""
    with closing(db()) as conn:
        r, d = ad_row(conn, aid)
    a = d.get("analysis") or {}
    folder = ad_dir(aid)
    frames = [folder / "frames" / s["frame"] for s in a.get("scenes") or [] if s.get("frame") and (folder / "frames" / s["frame"]).exists()]
    if not frames:
        raise HTTPException(400, "مفيش صور من الإعلان لسه. استنى لما التحليل يخلص")
    step = max(1, len(frames) // 6)
    notes = "\n".join(x for x in [a.get("cinematography"), a.get("colors"), a.get("editing")] if x)
    sid = add_style(body.name.strip() or f"ستايل {r['name']}", frames[::step][:6], notes, from_ad=aid)
    with closing(db()) as conn:
        return style_to_dict(conn.execute("SELECT * FROM ad_styles WHERE id = ?", (sid,)).fetchone())


def reset_stuck_ads() -> None:
    with closing(db()) as conn, conn:
        for r in conn.execute("SELECT id, data FROM ads").fetchall():
            d = json.loads(r["data"])
            changed = False
            if d.get("status") in ("queued", "working"):
                d.update(status="failed", step=None, error="اتقطع لما السيرفر اتقفل. دوس «حلّل تاني»")
                changed = True
            if d.get("adapt_status") == "working":
                d.update(adapt_status="failed", adapt_error="اتقطع لما السيرفر اتقفل. دوس «اكتب الاقتراح تاني»")
                changed = True
            if d.get("audio_status") == "working":
                d.update(audio_status="failed", audio_error="اتقطع لما السيرفر اتقفل. دوس «حلّل الصوت» تاني")
                changed = True
            if d.get("scomp_status") == "working":
                d.update(scomp_status="failed")
                changed = True
            if d.get("directions_status") == "working":
                d.update(directions_status="failed", directions_error="اتقطع لما السيرفر اتقفل. دوس تاني")
                changed = True
            if changed:
                conn.execute("UPDATE ads SET data = ? WHERE id = ?", (json.dumps(d, ensure_ascii=False), r["id"]))
        for r in conn.execute("SELECT id, data FROM ad_styles").fetchall():
            d = json.loads(r["data"])
            if d.get("status") == "working":
                d.update(status="failed", error="اتقطع لما السيرفر اتقفل")
                conn.execute("UPDATE ad_styles SET data = ? WHERE id = ?", (json.dumps(d, ensure_ascii=False), r["id"]))


reset_stuck_ads()


# ---------- تنفيذ الإعلان: راس ← ستوري بورد ← مكونات ← لقطات Seedance ← المونتاج

ad_executor = ThreadPoolExecutor(max_workers=3)
AD_MAX_REFS = 5  # صورة الستوري بورد + لحد 4 مكونات


def prod_dir(aid: str, sub: str) -> Path:
    d = ad_dir(aid) / "prod" / sub
    d.mkdir(parents=True, exist_ok=True)
    return d


def prod_busy(p: dict | None) -> bool:
    if ((p or {}).get("full_voice") or {}).get("status") == "working":
        return True
    if (p or {}).get("cast_status") == "working" or any(c.get("status") == "working" for c in (p or {}).get("cast") or []):
        return True
    for s in (p or {}).get("shots") or []:
        if "working" in (s.get("frame_status"), s.get("comp_status"), s.get("voice_status")):
            return True
        if any(c.get("status") == "working" for c in s.get("components") or []):
            return True
        if any(t.get("status") in ("queued", "working") for t in s.get("takes") or []):
            return True
    return False


def prod_of(d: dict) -> dict:
    p = d.get("prod")
    if not p:
        raise HTTPException(400, "ابدأ التنفيذ الأول")
    return p


def find_pshot(p: dict, sid: str) -> dict:
    s = next((x for x in p["shots"] if x["id"] == sid), None)
    if s is None:
        raise HTTPException(404, "اللقطة مش موجودة")
    return s


def find_comp(s: dict, cid: str) -> dict:
    c = next((x for x in s.get("components") or [] if x["id"] == cid), None)
    if c is None:
        raise HTTPException(404, "المكون مش موجود")
    return c


def prod_to_dict(aid: str, p: dict | None) -> dict | None:
    if not p:
        return None
    base = f"/media/ads/{aid}/prod"
    shots = []
    for s in p["shots"]:
        shots.append({
            **s,
            "frame_url": f"{base}/frames/{s['frame']}" if s.get("frame") else None,
            "frames": [{"file": f, "url": f"{base}/frames/{f}", "note": (s.get("frame_notes") or {}).get(f, "")}
                       for f in s.get("frames") or []],
            "frame_note": (s.get("frame_notes") or {}).get(s.get("frame") or "", ""),
            "voice_url": f"{base}/voice/{s['voice_file']}" if s.get("voice_file") else None,
            "components": [{**c, "image_url": f"{base}/comps/{c['image']}" if c.get("image") else None,
                            "uploaded": is_uploaded(c.get("image")),
                            "images": [{"file": f, "url": f"{base}/comps/{f}"} for f in c.get("images") or []]}
                           for c in s.get("components") or []],
            "takes": [{**t, "url": f"{base}/takes/{t['file']}" if t.get("file") else None,
                       "ref_urls": [f"{base}/editrefs/{f}" for f in t.get("extra_refs") or []]} for t in s.get("takes") or []],
        })
    cast = [{**c, "image_url": f"{base}/cast/{c['image']}" if c.get("image") else None,
             "images": [{"file": f, "url": f"{base}/cast/{f}", "note": (c.get("notes") or {}).get(f, "")} for f in c.get("images") or []]}
            for c in p.get("cast") or []]
    fv = p.get("full_voice")
    if fv and fv.get("file"):
        fv = {**fv, "url": f"{base}/voice/{fv['file']}"}
    return {**p, "shots": shots, "cast": cast, "full_voice": fv}


def ref_scene_for(analysis: dict, k: int, total: int) -> dict | None:
    """اللقطة المقابلة في الإعلان الأصلي (بنفس الترتيب النسبي)."""
    scenes = (analysis or {}).get("scenes") or []
    if not scenes:
        return None
    return scenes[min(len(scenes) - 1, int(k * len(scenes) / max(1, total)))]


@app.post("/api/ads/{aid}/prod/start")
def prod_start(aid: str):
    """يبدأ التنفيذ من الاقتراح: راس الإعلان (الستايل والكونسبت) ولقطة لكل مشهد."""
    with closing(db()) as conn:
        _, d = ad_row(conn, aid)
    a = d.get("adaptation")
    if not a or not a.get("scenes"):
        raise HTTPException(400, "مفيش اقتراح للإعلان ده لسه")
    if prod_busy(d.get("prod")):
        raise HTTPException(400, "في توليد شغال في التنفيذ الحالي. استنى لما يخلص")
    settings = d.get("settings") or {}
    header = az.header_from(a, ad_style(settings.get("style_id")), brand_settings(), settings, ad_brain(settings))
    scenes = a["scenes"]
    shots = []
    orig = {s.get("n"): s for s in (d.get("analysis") or {}).get("scenes") or []}
    for k, sc in enumerate(scenes):
        try:
            ref = orig.get(int(sc.get("ref_scene")))
        except (TypeError, ValueError):
            ref = None
        ref = ref or ref_scene_for(d.get("analysis"), k, len(scenes))
        comps = [{"id": uuid.uuid4().hex[:8], "name": str(c.get("name") or "مكون")[:60], "kind": str(c.get("kind") or "prop")[:20],
                  "from": str(c.get("from") or ""), "asset": str(c.get("asset") or ""), "description": str(c.get("description") or ""),
                  "image_prompt": str(c.get("image_prompt") or ""), "animation": str(c.get("animation") or ""),
                  "image": None, "images": [], "status": "idle", "error": None, "use": True}
                 for c in sc.get("components") or [] if isinstance(c, dict) and (c.get("image_prompt") or c.get("description"))][:10]
        shots.append({
            "id": uuid.uuid4().hex[:10], "n": k + 1,
            "seconds": float(sc.get("seconds") or 4) if str(sc.get("seconds") or "").replace(".", "", 1).isdigit() else 4.0,
            **{f: str(sc.get(f) or "") for f in ("visual", "shot", "camera", "on_screen_text", "voice", "sfx", "music", "prompt")},
            "ref_scene": ref.get("n") if ref else None, "ref_frame": ref.get("frame") if ref else None,
            "frame": None, "frames": [], "frame_status": "idle", "frame_error": None,
            "components": comps, "comp_status": "done" if comps else "idle", "comp_error": None,
            # الموشن جرافيك المكتوب في الاقتراح، ولو مش موجود (اقتراح قديم) بتاع المشهد الأصلي
            "motion_notes": str(sc.get("motion_graphics") or (ref or {}).get("motion_graphics", "")),
            "motion_prompt": str(sc.get("motion_prompt") or ""), "assembly_prompt": "",
            "approved": False, "takes": [], "chosen": None,
        })
    def fn(d):
        old = d.get("prod")
        if old and old.get("shots"):
            # التنفيذ القديم بيتحفظ (ملفاته بأسماء مختلفة فمفيش حاجة بتتمسح)
            d["prod_history"] = ([{**old, "archived_at": now()}] + (d.get("prod_history") or []))[:5]
        d["prod"] = {"header": header, "shots": shots, "based_on": d.get("adapt_ver", 0)}
    update_ad(aid, fn)
    # شاشات التطبيق واللوجو وصور المنتج الحقيقية من ملف العميل بتتحط في المكونات لوحدها
    threading.Thread(target=safe_apply_brain, args=(aid,), daemon=True).start()
    return ad_response(aid)


def safe_apply_brain(aid: str, sids: list[str] | None = None) -> None:
    try:
        apply_brain(aid, sids)
    except Exception:  # noqa: BLE001 — تطبيق العقل تحسين، مش لازم يوقف حاجة
        pass


@app.post("/api/ads/{aid}/prod/restore")
def prod_restore(aid: str, i: int = 0):
    """يرجّع تنفيذ قديم من الأرشيف (والحالي بياخد مكانه في الأرشيف)."""
    def fn(d):
        hist = d.get("prod_history") or []
        if not 0 <= i < len(hist):
            raise HTTPException(404, "مفيش تنفيذ قديم بالرقم ده")
        if prod_busy(d.get("prod")):
            raise HTTPException(400, "في توليد شغال في التنفيذ الحالي. استنى لما يخلص")
        old = {k: v for k, v in hist.pop(i).items() if k != "archived_at"}
        if d.get("prod") and d["prod"].get("shots"):
            hist.insert(0, {**d["prod"], "archived_at": now()})
        d["prod"], d["prod_history"] = old, hist[:5]
    update_ad(aid, fn)
    return ad_response(aid)


class ProdHeaderIn(BaseModel):
    header: dict


@app.patch("/api/ads/{aid}/prod/header")
def prod_header(aid: str, body: ProdHeaderIn):
    keys = ("title", "concept", "style", "style_id", "characters", "locations", "palette", "brand", "rules", "aspect", "market", "modest")
    def fn(d):
        p = prod_of(d)
        h = {**p["header"], **{k: body.header[k] for k in keys if k in body.header}}
        if "style_id" in body.header and body.header["style_id"] != p["header"].get("style_id"):
            st = ad_style(body.header["style_id"])
            h["style"] = (st or {}).get("notes", "")
        if h.get("aspect") not in az.ASPECTS:
            h["aspect"] = "9:16"
        p["header"] = h
    update_ad(aid, fn)
    return ad_response(aid)


class ProdShotIn(BaseModel):
    fields: dict


PSHOT_FIELDS = ("seconds", "visual", "shot", "camera", "on_screen_text", "voice", "sfx", "music", "prompt", "sb_prompt", "speaker", "talking",
                "assembly_prompt", "motion_notes", "motion_prompt", "approved")


@app.patch("/api/ads/{aid}/prod/shots/{sid}")
def prod_shot_patch(aid: str, sid: str, body: ProdShotIn):
    def fn(d):
        s = find_pshot(prod_of(d), sid)
        for k in PSHOT_FIELDS:
            if k in body.fields:
                v = body.fields[k]
                s[k] = bool(v) if k in ("approved", "talking") else max(1.0, min(15.0, float(v or 4))) if k == "seconds" else str(v or "")
        if "sb_prompt" in body.fields:  # المنشنز بتتقري من جديد من البرومبت اللي كتبته
            s["mentions"] = az.find_mentions(s["sb_prompt"], [a["name"] for a in brain_db(ad_brain(d.get("settings")))])
    update_ad(aid, fn)
    return ad_response(aid)


BRAIN_DB_KINDS = {"characters": "character", "sets": "background", "props": "prop", "screens": "screen", "logos": "logo", "products": "product"}


def brain_db(brain: dict | None) -> list[dict]:
    """ملف العميل كقاعدة بيانات: كل عنصر ليه اسم يتعمله منشن (@الاسم) وصورة مرجعية."""
    out = []
    for kind, label in BRAIN_DB_KINDS.items():
        for a in (brain or {}).get(kind) or []:
            if a.get("name"):
                out.append({**a, "kind": label, "brain_kind": kind})
    return out


def mention_refs(brain: dict | None, names: list[str]) -> list[dict]:
    """المنشنز ← صورها الحقيقية من العقل (الشخصيات الأول)."""
    db = {a["name"]: a for a in brain_db(brain)}
    items = [db[n] for n in names or [] if n in db and (brain_dir(brain["id"]) / db[n]["file"]).exists()]
    order = {"character": 0, "background": 1, "prop": 2, "product": 2, "screen": 3, "logo": 4}
    return sorted(items, key=lambda a: order.get(a["kind"], 5))


@app.post("/api/ads/{aid}/prod/sb-prompts")
def prod_sb_prompts(aid: str, shot_id: str | None = None, skip_approved: bool = False):
    """✍️ يكتب برومبت الستوري بورد لكل لقطة ويعمل منشن (@الاسم) لعناصر ملف العميل اللي فيها."""
    with closing(db()) as conn:
        _, d = ad_row(conn, aid)
    p = prod_of(d)
    brain = ad_brain(d.get("settings"))
    items = brain_db(brain)
    shots = [s for s in p["shots"] if (not shot_id or s["id"] == shot_id) and not (skip_approved and s.get("approved"))]
    if not shots:
        raise HTTPException(400, "كل اللقطات معتمدة" if skip_approved else "اللقطة مش موجودة")
    out = az.mock_sb(shots, items) if atlas.mock_mode() else ad_json(
        series_chat(az.sb_messages(az.header_text(p["header"]), shots, items)), "برومبتات الستوري بورد")
    got = {str(x.get("id")): str(x.get("prompt") or "").strip() for x in out.get("shots") or [] if isinstance(x, dict)}
    names = [a["name"] for a in items]
    def fn(d):
        for s in d["prod"]["shots"]:
            if got.get(s["id"]):
                s["sb_prompt"] = got[s["id"]][:4000]
                s["mentions"] = az.find_mentions(s["sb_prompt"], names)
    update_ad(aid, fn)
    return ad_response(aid)


@app.post("/api/ads/{aid}/prod/approve-all")
def prod_approve_all(aid: str, approved: bool = True):
    """✅ اعتمد كل الستوري بورد: اللقطات اللي ليها صورة مرسومة بس (واللي بترسم دلوقتي لأ). الإلغاء بيشيل الاعتماد من الكل."""
    def fn(d):
        for s in prod_of(d)["shots"]:
            if not approved:
                s["approved"] = False
            elif s.get("frame") and s.get("frame_status") not in ("queued", "working"):
                s["approved"] = True
    update_ad(aid, fn)
    return ad_response(aid)


def set_pshot(aid: str, sid: str, **kw) -> None:
    def fn(d):
        s = next((x for x in (d.get("prod") or {}).get("shots", []) if x["id"] == sid), None)
        if s is not None:
            s.update(**kw)
    update_ad(aid, fn)


def style_ref_urls(header: dict, limit: int) -> list[str]:
    """صور الستايل المختار مراجع لموديل الصور عشان الشكل يفضل ثابت."""
    sid = header.get("style_id")
    if not sid:
        return []
    folder = ADS_DIR / "styles" / Path(sid).name
    files = sorted(folder.glob("img-*"))[:limit]
    return [atlas.reference_url(f) for f in files]


AD_FRAME_REFS = 16  # أقصى عدد صور مرجعية لموديل الصور


def ref_comps(shot: dict, limit: int) -> list[dict]:
    """المكونات اللي ليها صورة وداخلة في اللقطة، بالترتيب اللي بيتبعت للموديل: اللي انت رافعها الأول."""
    comps = [c for c in shot.get("components") or [] if c.get("use", True) and c.get("image")]
    return sorted(comps, key=lambda c: not is_uploaded(c.get("image")))[:limit]


def frame_gen(aid: str, sid: str) -> int | None:
    """رقم محاولة الرسم الحالية (بيزيد لما تلغي)، أو None لو اللقطة مش مستنية رسم (اتلغت قبل ما تبدأ)."""
    out: list = []
    def fn(d):
        x = next((y for y in (d.get("prod") or {}).get("shots", []) if y["id"] == sid), None)
        if x is not None and x.get("frame_status") in ("queued", "working"):
            x.update(frame_status="working", frame_error=None)
            out.append(x.get("frame_gen", 0))
    update_ad(aid, fn)
    return out[0] if out else None


def run_ad_frame(aid: str, sid: str, note: str = "", extra: list[str] | None = None, replace: bool = False) -> None:
    gen = frame_gen(aid, sid)
    if gen is None:
        return
    dest = None
    try:
        safe_apply_brain(aid, [sid])  # قبل الرسم: الشاشات واللوجو الحقيقيين من ملف العميل
        with closing(db()) as conn:
            _, d = ad_row(conn, aid)
        p = d["prod"]
        s = find_pshot(p, sid)
        h = p["header"]
        size = az.ASPECTS.get(h.get("aspect"), az.ASPECTS["9:16"])[0]
        name = f"frame-{s['n']:02d}-{uuid.uuid4().hex[:6]}.png"
        dest = prod_dir(aid, "frames") / name
        if atlas.mock_mode():
            w, hh = size.split("x")
            mock_image(dest, f"{int(w) // 2}x{int(hh) // 2}", f"shot {s['n']}", s["n"])
        else:
            # صور المكونات نفسها (شاشات المنتج، اللوجو، الشخصيات...) مراجع أساسية، وبعدها صور الستايل للشكل العام
            comp_dir = prod_dir(aid, "comps")
            # المنشنز من ملف العميل: صورهم الحقيقية أول المراجع
            brain = ad_brain(d.get("settings"))
            ments = mention_refs(brain, s.get("mentions"))[:6]
            m_files = {a["file"] for a in ments}
            comps = [c for c in ref_comps(s, AD_FRAME_REFS - 3 - len(ments))
                     if (comp_dir / c["image"]).exists() and c.get("brain_asset") not in m_files]
            mention_comps = [{"id": f"m-{a['file']}", "name": f"@{a['name']}", "kind": a["kind"],
                              "description": a.get("prompt") or a.get("description", ""), "_path": brain_dir(brain["id"]) / a["file"]}
                             for a in ments]
            # صورة المشهد الأصلي المقابل: عشان الكادر والتكوين ومكان الجرافيك يطلعوا زي الأصلي
            orig = ad_dir(aid) / "frames" / s["ref_frame"] if s.get("ref_frame") else None
            orig_refs = [atlas.reference_url(orig)] if orig and orig.exists() else []
            styles = style_ref_urls(h, min(4, AD_FRAME_REFS - len(comps) - len(orig_refs)))
            refs = ([atlas.reference_url(c["_path"]) for c in mention_comps] + [atlas.reference_url(comp_dir / c["image"]) for c in comps]
                    + orig_refs + styles)
            comps = mention_comps + comps
            prompt = az.frame_prompt(h, s, comps, len(styles), len(comps) + 1 if orig_refs else 0)
            cur = prod_dir(aid, "frames") / s["frame"] if note and s.get("frame") else None
            extra_paths = [p for p in (prod_dir(aid, "editrefs") / f for f in extra or []) if p.exists()][:4]
            if cur and cur.exists():
                # تعديل بطلبك: الصورة الحالية أول مرجع، وبعدها الصور اللي بعتها، والموديل بيغيّر اللي طلبته بس
                comps = comps[:AD_FRAME_REFS - 1 - len(extra_paths)]
                refs = ([atlas.reference_url(cur)] + [atlas.reference_url(x) for x in extra_paths]
                        + [atlas.reference_url(c["_path"] if c.get("_path") else comp_dir / c["image"]) for c in comps])
                prompt = az.frame_edit_prompt(h, note, comps, len(extra_paths))
            url = atlas.generate_image(carousel_settings()["image_family"], prompt, size,
                                       auth.get_setting("series_frame_quality") or "medium", refs or None)
            atlas.download(url, dest)
        gone: list[str] = []
        def done(d):
            x = find_pshot(d["prod"], sid)
            if x.get("frame_gen", 0) != gen:  # اتلغى وهو بيرسم: الصورة دي متتحطش
                gone.append(name)
                return
            if replace and not x.get("approved"):  # الجديد بيمسح النسخ القديمة (اللقطة مش معتمدة)
                gone.extend(f for f in x.get("frames") or [] if f != name)
                x["frames"], x["frame_notes"] = [], {}
            x.setdefault("frames", []).append(name)
            if note:
                x.setdefault("frame_notes", {})[name] = note + (f" (+{len(extra)} صورة مرجعية)" if extra else "")
            x.update(frame=name, frame_status="done", frame_error=None)
        update_ad(aid, done)
        for f in gone:
            (prod_dir(aid, "frames") / f).unlink(missing_ok=True)
    except Exception as exc:  # noqa: BLE001
        msg = str(getattr(exc, "detail", None) or exc)[:400]
        def failed(d):
            x = next((y for y in (d.get("prod") or {}).get("shots", []) if y["id"] == sid), None)
            if x is not None and x.get("frame_gen", 0) == gen:
                x.update(frame_status="failed", frame_error=msg)
        update_ad(aid, failed)


@app.post("/api/ads/{aid}/prod/shots/{sid}/frame-cancel")
def prod_frame_cancel(aid: str, sid: str, redo: bool = False):
    """✕ الغي الرسم اللي معلّق (ولو redo يبدأ رسم جديد على طول). الرسم القديم لو خلص بعدين نتيجته بتترمي."""
    if redo and not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
    def fn(d):
        s = find_pshot(prod_of(d), sid)
        s["frame_gen"] = s.get("frame_gen", 0) + 1
        s.update(frame_status="queued" if redo else ("done" if s.get("frame") else "idle"), frame_error=None)
    update_ad(aid, fn)
    if redo:
        # في Thread لوحده: لو الطابور مليان برسومات معلّقة ميستناش وراهم
        threading.Thread(target=run_ad_frame, args=(aid, sid), daemon=True).start()
    return ad_response(aid)


@app.post("/api/ads/{aid}/prod/frames")
def prod_frames(aid: str, shot_id: str | None = None, note: str = "", redo: bool = False):
    """redo: كل اللقطات اللي مش معتمدة بتترسم من جديد والجديد بيمسح القديم (المعتمدة متتلمسش)."""
    """الستوري بورد: لقطة واحدة (نسخة جديدة) أو كل اللقطات اللي لسه ملهاش صورة."""
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
    with closing(db()) as conn:
        _, d = ad_row(conn, aid)
    p = prod_of(d)
    busy = {"queued", "working"}
    ids = [shot_id] if shot_id else [s["id"] for s in p["shots"] if s.get("frame_status") not in busy
                                     and (not s.get("frame") or (redo and not s.get("approved")))]
    if shot_id and find_pshot(p, shot_id).get("frame_status") in busy:
        raise HTTPException(400, "الصورة دي بتترسم")
    if not ids:
        raise HTTPException(400, "كل اللقطات ليها ستوري بورد")
    def fn(d):
        for s in d["prod"]["shots"]:
            if s["id"] in ids:
                s.update(frame_status="queued", frame_error=None)
    update_ad(aid, fn)
    note = note.strip()[:1500] if shot_id else ""
    for i in ids:
        ad_executor.submit(run_ad_frame, aid, i, note, None, redo)
    return ad_response(aid)


def save_edit_refs(aid: str, files: list[UploadFile]) -> list[str]:
    """الصور المرجعية اللي بتبعتها مع طلب التعديل (لحد 4)."""
    out = []
    for f in (files or [])[:4]:
        if f and f.filename and Path(f.filename).suffix.lower() in IMAGE_EXTENSIONS:
            out.append(save_upload(f, IMAGE_EXTENSIONS, prod_dir(aid, "editrefs"), "ref"))
    return out


@app.post("/api/ads/{aid}/prod/shots/{sid}/edit-frame")
def prod_edit_frame(aid: str, sid: str, note: str = Form(""), files: list[UploadFile] = File(default=[])):
    """✏️ تعديل الستوري بورد بطلبك، ومعاه صور مرجعية لو عايز."""
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
    note = note.strip()[:1500]
    if not note:
        raise HTTPException(400, "اكتب عايز تعدّل إيه")
    extra = save_edit_refs(aid, files)
    def fn(d):
        s = find_pshot(prod_of(d), sid)
        if not s.get("frame"):
            raise HTTPException(400, "اللقطة دي ملهاش ستوري بورد لسه")
        if s.get("frame_status") in ("queued", "working"):
            raise HTTPException(400, "الصورة دي بتترسم")
        s.update(frame_status="queued", frame_error=None)
    update_ad(aid, fn)
    ad_executor.submit(run_ad_frame, aid, sid, note, extra)
    return ad_response(aid)


class FramePickIn(BaseModel):
    file: str


@app.post("/api/ads/{aid}/prod/shots/{sid}/frame")
def prod_pick_frame(aid: str, sid: str, body: FramePickIn):
    def fn(d):
        s = find_pshot(prod_of(d), sid)
        if body.file not in (s.get("frames") or []):
            raise HTTPException(404, "النسخة مش موجودة")
        s["frame"] = body.file
    update_ad(aid, fn)
    return ad_response(aid)


def clear_frames(s: dict, only: str | None = None) -> list[str]:
    """يشيل صورة ستوري بورد (نسخة واحدة أو كلها) من اللقطة ويرجّع أسامي الملفات عشان تتمسح."""
    if s.get("frame_status") in ("queued", "working"):
        raise HTTPException(400, f"اللقطة {s['n']} بترسم دلوقتي. استنى لما تخلص")
    if any(t.get("status") in ("queued", "working") for t in s.get("takes") or []):
        raise HTTPException(400, f"اللقطة {s['n']} بيتولد لها فيديو دلوقتي. استنى لما يخلص")
    frames = s.get("frames") or []
    gone = [f for f in frames if only is None or f == only]
    s["frames"] = [f for f in frames if f not in gone]
    if s.get("frame") in gone or s.get("frame") is None:
        s["frame"] = s["frames"][-1] if s["frames"] else None
    s.update(frame_status="idle" if not s["frame"] else s.get("frame_status"), frame_error=None)
    return gone


@app.delete("/api/ads/{aid}/prod/shots/{sid}/frame")
def prod_delete_frame(aid: str, sid: str, file: str | None = None, all: bool = False):
    """يمسح الستوري بورد المعروضة للقطة (أو كل نسخها)، والنسخة اللي قبلها بتظهر مكانها لو موجودة."""
    gone: list[str] = []
    def fn(d):
        s = find_pshot(prod_of(d), sid)
        target = None if all else (file or s.get("frame"))
        if not all and not target:
            raise HTTPException(400, "اللقطة دي ملهاش ستوري بورد")
        gone.extend(clear_frames(s, target))
    update_ad(aid, fn)
    for f in gone:
        (prod_dir(aid, "frames") / Path(f).name).unlink(missing_ok=True)
    return ad_response(aid)


@app.delete("/api/ads/{aid}/prod/frames")
def prod_delete_all_frames(aid: str):
    """يمسح الستوري بورد بتاعة كل اللقطات (كل النسخ)."""
    gone: list[str] = []
    def fn(d):
        shots = prod_of(d)["shots"]
        busy = [s["n"] for s in shots if s.get("frame_status") in ("queued", "working")
                or any(t.get("status") in ("queued", "working") for t in s.get("takes") or [])]
        if busy:
            raise HTTPException(400, f"في لقطات شغالة دلوقتي ({', '.join(map(str, busy))}). استنى لما تخلص")
        for s in shots:
            gone.extend(clear_frames(s))
    update_ad(aid, fn)
    for f in gone:
        (prod_dir(aid, "frames") / Path(f).name).unlink(missing_ok=True)
    return ad_response(aid)


def run_ad_components(aid: str, sid: str) -> None:
    """يفصّص اللقطة لمكوناتها (من صورة الستوري بورد واللقطة المقابلة في الإعلان الأصلي)."""
    try:
        with closing(db()) as conn:
            _, d = ad_row(conn, aid)
        p = d["prod"]
        s = find_pshot(p, sid)
        set_pshot(aid, sid, comp_status="working", comp_error=None)
        if atlas.mock_mode():
            out = az.mock_components()
        else:
            ref = ad_dir(aid) / "frames" / s["ref_frame"] if s.get("ref_frame") else None
            ref = ref if ref and ref.exists() else None
            orig = next((x for x in (d.get("analysis") or {}).get("scenes") or [] if x.get("n") == s.get("ref_scene")), None)
            msgs = az.components_messages(p["header"], {**s, "ref_components": (orig or {}).get("components") or [],
                                                         "ref_motion": (orig or {}).get("motion_graphics", "")}, bool(ref))
            parts = [{"type": "text", "text": msgs[0]["content"]}]
            if s.get("frame"):
                parts.append({"type": "image_url", "image_url": {"url": data_url(prod_dir(aid, "frames") / s["frame"], "image/png")}})
            if ref:
                parts.append({"type": "image_url", "image_url": {"url": data_url(ref, "image/jpeg")}})
            out = ad_json(ad_media_chat([{"role": "user", "content": parts}], 8000), "مكونات اللقطة")
        comps = []
        for c in (out.get("components") or [])[:10]:
            if isinstance(c, dict) and (c.get("image_prompt") or c.get("description")):
                comps.append({"id": uuid.uuid4().hex[:8], "name": str(c.get("name") or "مكون")[:60],
                              "kind": str(c.get("kind") or "prop")[:20], "description": str(c.get("description") or ""),
                              "image_prompt": str(c.get("image_prompt") or ""), "animation": str(c.get("animation") or ""),
                              "image": None, "images": [], "status": "idle", "error": None, "use": True})
        def done(d):
            x = find_pshot(d["prod"], sid)
            old = {c["name"]: c for c in x.get("components") or [] if c.get("image")}
            for c in comps:  # مكون ليه صورة قبل كده بنفس الاسم بيفضل بصورته
                if c["name"] in old:
                    o = old.pop(c["name"])
                    c.update(image=o["image"], images=o.get("images", []), use=o.get("use", True),
                             **({"uploaded_at": o["uploaded_at"]} if o.get("uploaded_at") else {}))
            # الصور اللي رفعتها بإيدك متتمسحش أبدًا: لو الموديل ما رجعش المكون بنفس الاسم بيفضل زي ما هو
            comps.extend(o for o in old.values() if is_uploaded(o.get("image")))
            x.update(components=comps, comp_status="done", comp_error=None,
                     motion_notes=x.get("motion_notes") or str(out.get("motion_notes") or ""), assembly_prompt=str(out.get("assembly_prompt") or x.get("assembly_prompt") or ""))
        update_ad(aid, done)
        safe_apply_brain(aid, [sid])
    except Exception as exc:  # noqa: BLE001
        set_pshot(aid, sid, comp_status="failed", comp_error=str(getattr(exc, "detail", None) or exc)[:400])


@app.post("/api/ads/{aid}/prod/components")
def prod_components(aid: str, shot_id: str | None = None):
    """استخراج المكونات: لقطة واحدة أو كل اللقطات اللي ليها ستوري بورد ولسه ملهاش مكونات."""
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
    with closing(db()) as conn:
        _, d = ad_row(conn, aid)
    p = prod_of(d)
    if shot_id:
        s = find_pshot(p, shot_id)
        if not s.get("frame"):
            raise HTTPException(400, "ارسم الستوري بورد للقطة دي الأول")
        ids = [shot_id]
    else:
        ids = [s["id"] for s in p["shots"] if s.get("frame") and not s.get("components") and s.get("comp_status") != "working"]
    if not ids:
        raise HTTPException(400, "مفيش لقطات جاهزة (لازم الستوري بورد الأول)")
    for i in ids:
        set_pshot(aid, i, comp_status="working", comp_error=None)
        ad_executor.submit(run_ad_components, aid, i)
    return ad_response(aid)


class CompIn(BaseModel):
    fields: dict


@app.patch("/api/ads/{aid}/prod/shots/{sid}/components/{cid}")
def prod_comp_patch(aid: str, sid: str, cid: str, body: CompIn):
    def fn(d):
        c = find_comp(find_pshot(prod_of(d), sid), cid)
        for k in ("name", "kind", "description", "image_prompt", "animation"):
            if k in body.fields:
                c[k] = str(body.fields[k] or "")
        if "use" in body.fields:
            c["use"] = bool(body.fields["use"])
        if "image" in body.fields and body.fields["image"] in (c.get("images") or []):
            c["image"] = body.fields["image"]
    update_ad(aid, fn)
    return ad_response(aid)


@app.post("/api/ads/{aid}/prod/shots/{sid}/components")
def prod_comp_add(aid: str, sid: str, body: CompIn):
    """مكون جديد بإيدك."""
    def fn(d):
        s = find_pshot(prod_of(d), sid)
        s.setdefault("components", []).append({
            "id": uuid.uuid4().hex[:8], "name": str(body.fields.get("name") or "مكون جديد")[:60], "kind": "prop",
            "description": "", "image_prompt": str(body.fields.get("image_prompt") or ""), "animation": "",
            "image": None, "images": [], "status": "idle", "error": None, "use": True})
    update_ad(aid, fn)
    return ad_response(aid)


@app.delete("/api/ads/{aid}/prod/shots/{sid}/components/{cid}")
def prod_comp_delete(aid: str, sid: str, cid: str):
    def fn(d):
        s = find_pshot(prod_of(d), sid)
        s["components"] = [c for c in s.get("components") or [] if c["id"] != cid]
    update_ad(aid, fn)
    return ad_response(aid)


@app.post("/api/ads/{aid}/prod/shots/{sid}/components/{cid}/upload")
def prod_comp_upload(aid: str, sid: str, cid: str, file: UploadFile = File(...)):
    """صورة المكون من عندك بدل ما تتولد."""
    name = save_upload(file, IMAGE_EXTENSIONS, prod_dir(aid, "comps"), f"{cid}-up")
    def fn(d):
        c = find_comp(find_pshot(prod_of(d), sid), cid)
        c.setdefault("images", []).append(name)
        c.update(image=name, status="done", error=None, uploaded_at=now())
    update_ad(aid, fn)
    return ad_response(aid)


def is_uploaded(image: str | None) -> bool:
    """صورة مكون رفعها المستخدم من عنده (اسمها فيه -up_)."""
    return bool(image) and "-up_" in image


def set_comp(aid: str, sid: str, cid: str, **kw) -> None:
    def fn(d):
        s = next((x for x in (d.get("prod") or {}).get("shots", []) if x["id"] == sid), None)
        c = next((x for x in (s or {}).get("components") or [] if x["id"] == cid), None)
        if c is not None:
            c.update(**kw)
    update_ad(aid, fn)


def run_ad_comp_image(aid: str, sid: str, cid: str) -> None:
    try:
        with closing(db()) as conn:
            _, d = ad_row(conn, aid)
        p = d["prod"]
        c = find_comp(find_pshot(p, sid), cid)
        started = now()
        set_comp(aid, sid, cid, status="working", error=None)
        name = f"{cid}-{uuid.uuid4().hex[:6]}.png"
        dest = prod_dir(aid, "comps") / name
        if atlas.mock_mode():
            mock_image(dest, "512x512", c["name"][:12], len(c["name"]))
        else:
            url = atlas.generate_image(carousel_settings()["image_family"], az.component_prompt(p["header"], c), "1024x1024",
                                       auth.get_setting("series_frame_quality") or "medium", style_ref_urls(p["header"], 3) or None)
            atlas.download(url, dest)
        def done(d):
            x = find_comp(find_pshot(d["prod"], sid), cid)
            x.setdefault("images", []).append(name)
            if x.get("uploaded_at", "") >= started:  # رفعت صورة وهو بيولّد: اللي رفعتها هي اللي بتفضل
                x.update(status="done", error=None)
            else:
                x.update(image=name, status="done", error=None)
        update_ad(aid, done)
    except Exception as exc:  # noqa: BLE001
        set_comp(aid, sid, cid, status="failed", error=str(getattr(exc, "detail", None) or exc)[:400])


@app.post("/api/ads/{aid}/prod/comp-images")
def prod_comp_images(aid: str, shot_id: str | None = None, comp_id: str | None = None):
    """صور المكونات: مكون واحد (نسخة جديدة)، أو كل مكونات لقطة، أو كل المكونات اللي لسه ملهاش صورة."""
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
    if not comp_id:
        safe_apply_brain(aid, [shot_id] if shot_id else None)  # الشاشات واللوجو من ملف العميل بدل ما يتولدوا
    with closing(db()) as conn:
        _, d = ad_row(conn, aid)
    p = prod_of(d)
    jobs = []
    for s in p["shots"]:
        if shot_id and s["id"] != shot_id:
            continue
        for c in s.get("components") or []:
            if comp_id and c["id"] != comp_id:
                continue
            if c.get("status") == "working" or (not comp_id and (c.get("image") or not c.get("use", True))):
                continue
            jobs.append((s["id"], c["id"]))
    if not jobs:
        raise HTTPException(400, "مفيش مكونات محتاجة صور")
    for s_id, c_id in jobs:
        set_comp(aid, s_id, c_id, status="working", error=None)
        ad_executor.submit(run_ad_comp_image, aid, s_id, c_id)
    return ad_response(aid)


def run_ad_take(aid: str, sid: str, tid: str) -> None:
    def setp(**kw):
        def fn(d):
            s = next((x for x in (d.get("prod") or {}).get("shots", []) if x["id"] == sid), None)
            t = next((x for x in (s or {}).get("takes") or [] if x["id"] == tid), None)
            if t is not None:
                t.update(**kw)
        update_ad(aid, fn)
    try:
        with closing(db()) as conn:
            _, d = ad_row(conn, aid)
        p = d["prod"]
        s = find_pshot(p, sid)
        t = next(x for x in s["takes"] if x["id"] == tid)
        dest = prod_dir(aid, "takes") / f"{tid}.mp4"
        setp(status="working")
        aspect = az.ASPECTS.get(p["header"].get("aspect"), az.ASPECTS["9:16"])[1]
        if atlas.mock_mode():
            time.sleep(1.5)
            size = {"9:16": "496x864", "16:9": "864x496", "1:1": "640x640"}[aspect]
            subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
                            f"color=c=0x{(hash(tid) & 0xFFFFFF):06x}:s={size}:d={t['gen_duration']}:r=24",
                            "-c:v", "libx264", "-pix_fmt", "yuv420p", str(dest)], check=True, capture_output=True, timeout=120)
        else:
            pid = t.get("prediction_id")
            if not pid and t.get("note") and not t.get("revised"):
                t["prompt"] = revise_video_prompt(t["prompt"], t["note"])
                if t.get("extra_refs"):
                    n = len(t["extra_refs"][:AD_MAX_REFS - 1])
                    t["prompt"] += (f"\nReference images 2-{n + 1} were provided by the director for this change: follow them "
                                    "for what the change asks (look, object, pose or style).")
                setp(prompt=t["prompt"], revised=True)
            if not pid:
                frames, comps = prod_dir(aid, "frames"), prod_dir(aid, "comps")
                extra = [p for p in (prod_dir(aid, "editrefs") / f for f in t.get("extra_refs") or []) if p.exists()][:AD_MAX_REFS - 1]
                brain = ad_brain(d.get("settings"))
                ments = [brain_dir(brain["id"]) / a["file"] for a in mention_refs(brain, s.get("mentions"))][:max(0, AD_MAX_REFS - 1 - len(extra))]
                refs = ([frames / s["frame"]] + extra + ments
                        + [comps / c["image"] for c in ref_comps(s, AD_MAX_REFS - 1 - len(extra) - len(ments))])
                vm = ad_video_model(t.get("video_model"))
                if vm["kind"] == "i2v":
                    img = atlas.reference_url(frames / s["frame"])
                    body = {"model": vm["model"], "prompt": t["prompt"], "image": img, "image_url": img,
                            "duration": t["gen_duration"], "aspect_ratio": aspect}
                else:
                    body = {
                        "model": vm["model"], "prompt": t["prompt"],
                        "reference_images": [atlas.upload_media(seedance_ref(x)) for x in refs if x.exists()],
                        "duration": t["gen_duration"], "resolution": atlas.RESOLUTION, "ratio": aspect,
                        "generate_audio": False, "watermark": False,
                    }
                pid = atlas.submit_video(body)
                setp(prediction_id=pid)
            url = atlas.wait_for(pid, lambda _s: None)
            atlas.download(url, dest)
        setp(status="done", file=dest.name, duration=round(probe_duration(dest), 2), error=None)
    except Exception as exc:  # noqa: BLE001
        setp(status="failed", error=str(getattr(exc, "detail", None) or exc)[:400])


# ---------- 🎭 الأبطال والمكونات المتكررة: صورة مرجعية ثابتة لكل شخصية ومكان وأداة قبل الستوري بورد

CAST_BRAIN = {"character": "characters", "background": "sets", "prop": "props"}


def find_cast(p: dict, cid: str) -> dict:
    c = next((x for x in p.get("cast") or [] if x["id"] == cid), None)
    if c is None:
        raise HTTPException(404, "العنصر ده مش موجود")
    return c


def set_cast(aid: str, cid: str, **kw) -> None:
    def fn(d):
        c = next((x for x in (d.get("prod") or {}).get("cast") or [] if x["id"] == cid), None)
        if c is not None:
            c.update(**kw)
    update_ad(aid, fn)


def run_cast_extract(aid: str) -> None:
    try:
        with closing(db()) as conn:
            _, d = ad_row(conn, aid)
        p = d["prod"]
        if atlas.mock_mode():
            out = az.mock_cast(p["shots"])
        else:
            brain = ad_brain(d.get("settings"))
            known = [{**a, "kind": k} for k, kind in (("character", "characters"), ("background", "sets"), ("prop", "props"))
                     for a in (brain or {}).get(kind) or []]
            out = ad_json(series_chat(az.cast_messages(az.header_text(p["header"]), d.get("adaptation") or {}, p["shots"], known)), "الأبطال")
        valid_n = {s.get("n") for s in p["shots"]}
        items = []
        for x in out.get("cast") or []:
            if not isinstance(x, dict) or not str(x.get("name") or "").strip():
                continue
            shots_n = []
            for n in x.get("shots") or []:
                try:
                    if int(n) in valid_n and int(n) not in shots_n:
                        shots_n.append(int(n))
                except (TypeError, ValueError):
                    pass
            items.append({"id": uuid.uuid4().hex[:8], "name": str(x["name"]).strip()[:40],
                          "kind": x.get("kind") if x.get("kind") in az.CAST_KINDS else "character",
                          "description": str(x.get("description") or "")[:1000], "image_prompt": str(x.get("image_prompt") or "")[:3000],
                          "shots": shots_n, "image": None, "images": [], "notes": {}, "status": "idle", "error": None,
                          "approved": False})
        # اللي موجود قبل كده في ملف العميل بنفس الاسم: صورته بتتجاب (وبتستنى موافقتك)
        brain = ad_brain(d.get("settings"))
        for it in items:
            a = next((a for a in (brain or {}).get(CAST_BRAIN[it["kind"]]) or [] if a.get("name") == it["name"]), None)
            if a and (brain_dir(brain["id"]) / a["file"]).exists():
                f = f"cast-{it['id']}-brain{Path(a['file']).suffix.lower()}"
                shutil.copyfile(brain_dir(brain["id"]) / a["file"], prod_dir(aid, "cast") / f)
                it.update(image=f, images=[f], status="done", image_prompt=a.get("prompt") or it["image_prompt"], from_brain=True)
        def fn(d):
            p = d["prod"]
            # اللي وافقت عليهم قبل كده بيفضلوا، والجديد بيتضاف
            keep = [c for c in p.get("cast") or [] if c.get("approved") or c.get("image")]
            names = {c["name"] for c in keep}
            p["cast"] = keep + [c for c in items if c["name"] not in names][:max(0, 10 - len(keep))]
            p["cast_status"], p["cast_error"] = "done", None if items else "الموديل ما طلّعش أبطال أو مكونات متكررة"
        update_ad(aid, fn)
    except Exception as exc:  # noqa: BLE001
        msg = str(getattr(exc, "detail", None) or exc)[:300]
        update_ad(aid, lambda d: d["prod"].update(cast_status="failed", cast_error=msg))


@app.post("/api/ads/{aid}/prod/cast/extract")
def prod_cast_extract(aid: str):
    def fn(d):
        p = prod_of(d)
        if p.get("cast_status") == "working":
            raise HTTPException(400, "بيطلّع الأبطال بالفعل")
        p.update(cast_status="working", cast_error=None)
    update_ad(aid, fn)
    threading.Thread(target=run_cast_extract, args=(aid,), daemon=True).start()
    return ad_response(aid)


class CastIn(BaseModel):
    fields: dict


@app.patch("/api/ads/{aid}/prod/cast/{cid}")
def prod_cast_patch(aid: str, cid: str, body: CastIn):
    def fn(d):
        c = find_cast(prod_of(d), cid)
        for k in ("name", "description", "image_prompt"):
            if k in body.fields:
                c[k] = str(body.fields[k] or "")[:3000]
        if body.fields.get("kind") in az.CAST_KINDS:
            c["kind"] = body.fields["kind"]
        if "shots" in body.fields and isinstance(body.fields["shots"], list):
            c["shots"] = [int(n) for n in body.fields["shots"] if str(n).isdigit()]
    update_ad(aid, fn)
    return ad_response(aid)


@app.delete("/api/ads/{aid}/prod/cast/{cid}")
def prod_cast_delete(aid: str, cid: str):
    def fn(d):
        p = prod_of(d)
        p["cast"] = [c for c in p.get("cast") or [] if c["id"] != cid]
    update_ad(aid, fn)
    return ad_response(aid)


def run_cast_image(aid: str, cid: str, note: str = "", extra: list[str] | None = None, replace: bool = False) -> None:
    try:
        set_cast(aid, cid, status="working", error=None)
        with closing(db()) as conn:
            _, d = ad_row(conn, aid)
        p = d["prod"]
        c = find_cast(p, cid)
        h = p["header"]
        size = {"character": "1024x1536", "background": az.ASPECTS.get(h.get("aspect"), az.ASPECTS["9:16"])[0]}.get(c["kind"], "1024x1024")
        name = f"cast-{cid}-{uuid.uuid4().hex[:6]}.png"
        dest = prod_dir(aid, "cast") / name
        if atlas.mock_mode():
            w, hh = size.split("x")
            mock_image(dest, f"{int(w) // 3}x{int(hh) // 3}", c["name"][:10], len(c["name"]))
        else:
            cur = prod_dir(aid, "cast") / c["image"] if note and c.get("image") else None
            extra_paths = [x for x in (prod_dir(aid, "editrefs") / f for f in extra or []) if x.exists()][:4]
            if cur and cur.exists():
                refs = [atlas.reference_url(cur)] + [atlas.reference_url(x) for x in extra_paths]
                prompt = az.frame_edit_prompt(h, note, [], len(extra_paths)).replace("storyboard frame of a commercial", "reference image")
            else:
                refs = [atlas.reference_url(x) for x in extra_paths] + style_ref_urls(h, 3)
                prompt = az.cast_prompt(h, c) + (f"\nThe first {len(extra_paths)} reference image(s) were given by the director: "
                                                 f"follow them for the look. {note}" if extra_paths else (f"\n{note}" if note else ""))
            url = atlas.generate_image(carousel_settings()["image_family"], prompt, size,
                                       auth.get_setting("series_frame_quality") or "medium", refs or None)
            atlas.download(url, dest)
        gone: list[str] = []
        def done(d):
            x = find_cast(d["prod"], cid)
            if replace and not x.get("approved"):  # الجديد بيمسح القديم (مش معتمد)
                gone.extend(f for f in x.get("images") or [] if f != name)
                x["images"], x["notes"] = [], {}
            x.setdefault("images", []).append(name)
            if note:
                x.setdefault("notes", {})[name] = note
            x.update(image=name, status="done", error=None, approved=False)
        update_ad(aid, done)
        for f in gone:
            (prod_dir(aid, "cast") / f).unlink(missing_ok=True)
    except Exception as exc:  # noqa: BLE001
        set_cast(aid, cid, status="failed", error=str(getattr(exc, "detail", None) or exc)[:400])


@app.post("/api/ads/{aid}/prod/cast/images")
def prod_cast_images(aid: str, cast_id: str | None = None, redo: bool = False):
    """🖼️ صورة مرجعية: عنصر واحد (نسخة جديدة)، أو كل اللي ملهمش صورة، أو (redo) كل اللي مش معتمدين والجديد بيمسح القديم."""
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
    ids: list[str] = []
    def fn(d):
        for c in prod_of(d).get("cast") or []:
            if c.get("status") == "working" or (cast_id and c["id"] != cast_id):
                continue
            if not cast_id and (c.get("approved") if redo else c.get("image")):
                continue
            c.update(status="working", error=None)
            ids.append(c["id"])
    update_ad(aid, fn)
    if not ids:
        raise HTTPException(400, "كلهم معتمدين" if redo else "كلهم ليهم صور")
    for i in ids:
        ad_executor.submit(run_cast_image, aid, i, "", None, redo and not cast_id)
    return ad_response(aid)


@app.post("/api/ads/{aid}/prod/cast/{cid}/edit")
def prod_cast_edit(aid: str, cid: str, note: str = Form(""), files: list[UploadFile] = File(default=[])):
    """✏️ تعديل الصورة المرجعية بطلبك (ومعاه صور مرجعية)."""
    note = note.strip()[:1500]
    if not note:
        raise HTTPException(400, "اكتب عايز تعدّل إيه")
    extra = save_edit_refs(aid, files)
    set_cast(aid, cid, status="working", error=None)
    ad_executor.submit(run_cast_image, aid, cid, note, extra)
    return ad_response(aid)


@app.post("/api/ads/{aid}/prod/cast/{cid}/upload")
def prod_cast_upload(aid: str, cid: str, file: UploadFile = File(...)):
    name = save_upload(file, IMAGE_EXTENSIONS, prod_dir(aid, "cast"), f"cast-{cid}-up")
    def fn(d):
        c = find_cast(prod_of(d), cid)
        c.setdefault("images", []).append(name)
        c.update(image=name, status="done", error=None, approved=False)
    update_ad(aid, fn)
    return ad_response(aid)


class CastPickIn(BaseModel):
    file: str


@app.post("/api/ads/{aid}/prod/cast/{cid}/pick")
def prod_cast_pick(aid: str, cid: str, body: CastPickIn):
    def fn(d):
        c = find_cast(prod_of(d), cid)
        if body.file not in c.get("images") or []:
            raise HTTPException(404, "النسخة مش موجودة")
        c.update(image=body.file, approved=False)
    update_ad(aid, fn)
    return ad_response(aid)


def approve_cast(aid: str, cid: str) -> None:
    """الموافقة: الصورة بتتحفظ في ملف العميل، وبتتربط بكل لقطة العنصر ده فيها (مكون باسمه بالظبط)."""
    with closing(db()) as conn:
        _, d = ad_row(conn, aid)
    c = find_cast(prod_of(d), cid)
    if not c.get("image"):
        raise HTTPException(400, f"«{c['name']}» ملوش صورة لسه")
    brain = ad_brain(d.get("settings"))
    if not brain:
        raise HTTPException(400, "مفيش ملف عميل مختار. اعمله من «👤 ملف العميل»")
    kind = CAST_BRAIN[c["kind"]]
    src = prod_dir(aid, "cast") / c["image"]
    bfile = f"{kind[:-1]}-{cid}-{uuid.uuid4().hex[:6]}{src.suffix.lower()}"
    shutil.copyfile(src, brain_dir(brain["id"]) / bfile)
    def bfn(b):
        lst = b.setdefault(kind, [])
        old = [a for a in lst if a.get("cast_id") == cid or a.get("name") == c["name"]]
        for a in old:  # النسخة القديمة من نفس العنصر بتتشال من العقل
            (brain_dir(brain["id"]) / a["file"]).unlink(missing_ok=True)
        b[kind] = [a for a in lst if a not in old] + [
            {"file": bfile, "name": c["name"], "description": c.get("description", ""), "prompt": c.get("image_prompt", ""),
             "cast_id": cid, "from_ad": aid, "named": True}]
    update_brain(brain["id"], bfn)
    comp_kind = {"character": "character", "background": "background", "prop": "prop"}[c["kind"]]
    def fn(d):
        p = d["prod"]
        x = find_cast(p, cid)
        x.update(approved=True, brain_file=bfile)
        for s in p["shots"]:
            if s.get("n") not in x.get("shots") or []:
                continue
            comp = next((k for k in s.get("components") or [] if k.get("cast_id") == cid or k.get("name") == x["name"]), None)
            if comp is None:
                comp = {"id": uuid.uuid4().hex[:8], "name": x["name"], "kind": comp_kind, "from": "", "description": x.get("description", ""),
                        "image_prompt": x.get("image_prompt", ""), "animation": "", "image": None, "images": [], "status": "idle",
                        "error": None, "use": True}
                s.setdefault("components", []).insert(0, comp)
            comp.update(cast_id=cid, name=x["name"], kind=comp_kind, image_prompt=x.get("image_prompt", ""))
        # الشخصيات اللي اتوافق عليها بتدخل في راس الإعلان بوصفها الثابت
        chars = [k for k in p.get("cast") or [] if k.get("approved") and k["kind"] == "character"]
        if chars:
            p["header"]["characters"] = "; ".join(f"{k['name']}: {k.get('image_prompt') or k.get('description', '')}" for k in chars)
    update_ad(aid, fn)
    apply_brain(aid, use_model=False)  # صورته بتتنسخ لكل مكون باسمه


@app.post("/api/ads/{aid}/prod/cast/{cid}/approve")
def prod_cast_approve(aid: str, cid: str, undo: bool = False):
    if undo:
        set_cast(aid, cid, approved=False)
    else:
        approve_cast(aid, cid)
    return ad_response(aid)


@app.post("/api/ads/{aid}/prod/cast/approve-all")
def prod_cast_approve_all(aid: str):
    with closing(db()) as conn:
        _, d = ad_row(conn, aid)
    todo = [c["id"] for c in prod_of(d).get("cast") or [] if c.get("image") and not c.get("approved")]
    if not todo:
        raise HTTPException(400, "مفيش حاجة ليها صورة ومستنية موافقة")
    for cid in todo:
        approve_cast(aid, cid)
    return ad_response(aid)


def base_take(s: dict, tid: str | None = None) -> dict | None:
    """الفيديو اللي الموشن هيتركب عليه: المختار (ولو هو نفسه متركب، الأصل بتاعه)، أو آخر فيديو خلص."""
    takes = {t["id"]: t for t in s.get("takes") or []}
    t = takes.get(tid or s.get("chosen") or "")
    if t and t.get("composite"):
        t = takes.get(t.get("base") or "")
    if t and t.get("status") == "done" and t.get("file") and not t.get("composite"):
        return t
    done = [x for x in s.get("takes") or [] if x.get("status") == "done" and x.get("file") and not x.get("composite")]
    return done[-1] if done else None


# ---------- 🎬 موديلات الفيديو للإعلانات، 🎙️ الصوت (بيحدد مدة اللقطة)، 👄 الكلام على الوش (لب سينك)

AD_VIDEO_MODELS = {
    "seedance": {"label": "Seedance (من الإعدادات)", "kind": "ref"},
    "seedance-2": {"label": "Seedance 2.0", "model": "bytedance/seedance-2.0/reference-to-video", "kind": "ref"},
    "kling-3-std": {"label": "Kling 3.0 Std (تمثيل وحركة أحسن)", "model": "kwaivgi/kling-v3.0-std/image-to-video", "kind": "i2v"},
    "kling-3-pro": {"label": "Kling 3.0 Pro (أعلى جودة)", "model": "kwaivgi/kling-v3.0-pro/image-to-video", "kind": "i2v"},
}
AR_VOICES = {"Arabic_FriendlyGuy": "راجل ودود", "Arabic_CalmWoman": "ست هادية"}
TTS_MODEL = "minimax/speech-2.6-hd"
LIPSYNC = {"video": "veed/lipsync", "image": "atlascloud/infinitetalk",
           # بيعملوا الفيديو من الأول: صورة الستوري بورد + صوتنا + برومبت → شخصية بتتكلم بصوتنا
           "omni": "bytedance/avatar-omni-human-v1.5", "kavatar": "kwaivgi/kling-v2.6-pro/avatar"}
LIPSYNC_FROM_FRAME = ("image", "omni", "kavatar")


def ad_video_model(key: str | None) -> dict:
    vm = AD_VIDEO_MODELS.get(key or "") or AD_VIDEO_MODELS["seedance"]
    return {**vm, "key": key if key in AD_VIDEO_MODELS else "seedance",
            "model": vm.get("model") or series_settings()["video_model"]}


def take_duration(vm: dict, seconds: float) -> int:
    if vm["kind"] == "i2v":
        return 5 if seconds <= 5 else 10  # Kling: 5 أو 10 ثواني
    return int(min(atlas.MAX_DURATION, max(atlas.MIN_DURATION, math.ceil(seconds))))


def shot_voice_id(p: dict, s: dict) -> str:
    voices = p.get("voices") or {}
    return voices.get(s.get("speaker") or "__narrator") or voices.get("__narrator") or "Arabic_FriendlyGuy"


def set_voice_file(aid: str, sid: str, name: str, dur: float) -> None:
    def fn(d):
        s = find_pshot(d["prod"], sid)
        old = s.get("voice_file")
        s.update(voice_file=name, voice_dur=round(dur, 2), voice_status="done", voice_error=None,
                 seconds=max(1.0, min(15.0, round(dur + 0.4, 1))))  # مدة اللقطة = طول الكلام + نفس صغير
        if old and old != name:
            (prod_dir(aid, "voice") / old).unlink(missing_ok=True)
    update_ad(aid, fn)


def run_ad_voice(aid: str, sid: str) -> None:
    try:
        set_pshot(aid, sid, voice_status="working", voice_error=None)
        with closing(db()) as conn:
            _, d = ad_row(conn, aid)
        p = d["prod"]
        s = find_pshot(p, sid)
        text = (s.get("voice") or "").strip()
        if not text:
            raise RuntimeError("اللقطة دي ملهاش كلام. اكتب الكلام في خانة «الكلام» الأول")
        name = f"{sid}-{uuid.uuid4().hex[:6]}.mp3"
        dest = prod_dir(aid, "voice") / name
        if atlas.mock_mode():
            secs = max(1.0, 0.45 * len(text.split()))
            subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
                            f"sine=frequency=220:duration={secs:.2f}", "-c:a", "libmp3lame", str(dest)], check=True, capture_output=True)
        else:
            url = atlas.run_model("Audio", {"model": TTS_MODEL, "text": text[:1500], "voice_id": shot_voice_id(p, s),
                                            "language_boost": "Arabic"}, "الصوت", max_seconds=300, interval=2)
            atlas.download(url, dest)
        set_voice_file(aid, sid, name, probe_duration(dest))
    except Exception as exc:  # noqa: BLE001
        set_pshot(aid, sid, voice_status="failed", voice_error=str(getattr(exc, "detail", None) or exc)[:300])


@app.post("/api/ads/{aid}/prod/voice")
def prod_voice(aid: str, shot_id: str | None = None):
    """🎙️ الصوت: كلام كل لقطة بيتحول لصوت عربي، وطوله بيحدد مدة اللقطة (ومدة الفيديو اللي هيتولد)."""
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
    ids: list[str] = []
    def fn(d):
        for s in prod_of(d)["shots"]:
            if (shot_id and s["id"] != shot_id) or s.get("voice_status") == "working" or not (s.get("voice") or "").strip():
                continue
            if not shot_id and s.get("voice_file"):
                continue  # الكل: اللي ليها صوت بالفعل متتلمسش
            s.update(voice_status="working", voice_error=None)
            ids.append(s["id"])
    update_ad(aid, fn)
    if not ids:
        raise HTTPException(400, "مفيش لقطات محتاجة صوت (كلها ليها صوت أو ملهاش كلام)")
    for i in ids:
        ad_executor.submit(run_ad_voice, aid, i)
    return ad_response(aid)


@app.post("/api/ads/{aid}/prod/shots/{sid}/voice/upload")
def prod_voice_upload(aid: str, sid: str, file: UploadFile = File(...)):
    """صوتك انت (تسجيل) للقطة بدل الصوت المولّد."""
    name = save_audio_upload(file, prod_dir(aid, "voice"), f"{sid}-up")
    set_voice_file(aid, sid, name, probe_duration(prod_dir(aid, "voice") / name))
    return ad_response(aid)


@app.delete("/api/ads/{aid}/prod/shots/{sid}/voice")
def prod_voice_delete(aid: str, sid: str):
    def fn(d):
        s = find_pshot(prod_of(d), sid)
        if s.get("voice_file"):
            (prod_dir(aid, "voice") / s["voice_file"]).unlink(missing_ok=True)
        s.update(voice_file=None, voice_dur=None, voice_status="idle", voice_error=None)
    update_ad(aid, fn)
    return ad_response(aid)


class VoicesIn(BaseModel):
    voices: dict
    video_model: str | None = None


@app.put("/api/ads/{aid}/prod/voices")
def prod_voices(aid: str, body: VoicesIn):
    """الصوت لكل متكلم (الراوي وكل شخصية) وموديل الفيديو للإعلان."""
    def fn(d):
        p = prod_of(d)
        p["voices"] = {str(k)[:60]: str(v)[:80] for k, v in (body.voices or {}).items() if v}
        if body.video_model in AD_VIDEO_MODELS:
            p["header"]["video_model"] = body.video_model
    update_ad(aid, fn)
    return ad_response(aid)


# ---------- 🎙️ الصوت الكامل: سكريبت ← انت بتعمل الصوت بنفسك ← البرنامج بيقطّعه على اللقطات بتوقيت الكلام

def shot_windows(shots: list[dict], spans: list[dict | None], total: float) -> list[tuple[float, float]]:
    """كل لقطة من إمتى لإمتى على الصوت الكامل. spans = وقت كلام اللقطة (أو None لو ملهاش كلام).
    الحدود بتقع في نص السكوت بين كلام لقطتين، واللقطات اللي من غير كلام بتاخد السكوت اللي بينهم بالتساوي.
    اللقطات اللي بعد آخر كلام بتحتفظ بمدتها (زي لقطة اللوجو في الآخر)."""
    n = len(shots)
    voiced = [i for i in range(n) if spans[i]]
    if not voiced:
        return []
    cuts = [0.0] * (n + 1)
    first = voiced[0]
    lead_end = max(0.0, spans[first]["start"] - 0.1)
    for j in range(1, first + 1):  # لقطات قبل أول كلام
        cuts[j] = lead_end * j / first if first else 0.0
    for a, b in zip(voiced, voiced[1:]):
        left, right = spans[a]["end"], spans[b]["start"]
        if right < left:
            left = right = (left + right) / 2
        g = b - a - 1  # لقطات ساكتة بينهم
        for t in range(g + 1):
            cuts[a + 1 + t] = left + (right - left) * (t + 0.5) / (g + 1)
    last = voiced[-1]
    end = max(spans[last]["end"] + 0.35, min(total, spans[last]["end"] + 0.8))
    cuts[last + 1] = end
    for k in range(last + 1, n):  # لقطات بعد آخر كلام
        cuts[k + 1] = cuts[k] + float(shots[k].get("seconds") or 2)
    return [(round(cuts[i], 2), round(cuts[i + 1], 2)) for i in range(n)]


def silences(src: Path, min_len: float = 0.25) -> list[tuple[float, float]]:
    """أماكن السكوت الحقيقي في الصوت (موديل الكلام ساعات بيمد آخر كلمة جوه السكوت)."""
    err = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", str(src), "-af", f"silencedetect=noise=-35dB:d={min_len}", "-f", "null", "-"],
                         capture_output=True, text=True, timeout=120).stderr
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", err)]
    ends = [float(x) for x in re.findall(r"silence_end: (-?[\d.]+)", err)]
    return [(max(0.0, a), b) for a, b in zip(starts, ends)]


def snap_spans(spans: list[dict | None], quiet: list[tuple[float, float]]) -> None:
    """بداية ونهاية كلام كل لقطة بتتظبط على السكوت الحقيقي."""
    for sp in spans:
        if not sp:
            continue
        for a, b in quiet:
            # سكوت في أول الجملة (أو قبلها بشوية): الكلام بيبدأ بعده
            if a <= sp["start"] + 0.35 and sp["start"] < b < sp["end"]:
                sp["start"] = b
            # سكوت في آخر الجملة: الكلام بيخلص قبله
            if b >= sp["end"] - 0.35 and sp["start"] < a < sp["end"]:
                sp["end"] = a


def min_silent(shots: list[dict], wins: list[tuple[float, float]], spans: list[dict | None], least: float = 1.0) -> list[tuple[float, float]]:
    """لقطة من غير كلام لازم تاخد ثانية على الأقل: بتاخدها من اللقطة اللي قبلها أو بعدها (لو مش شخصية بتتكلم قدام الكاميرا)."""
    w = [list(x) for x in wins]
    for i, s in enumerate(shots[:len(w)]):
        if spans[i] or w[i][1] - w[i][0] >= least:
            continue
        need = least - (w[i][1] - w[i][0])
        for j, side in ((i - 1, "prev"), (i + 1, "next")):
            if need <= 0 or not 0 <= j < len(w) or shots[j].get("talking"):
                continue
            room = (w[j][1] - w[j][0]) - 1.0
            take = max(0.0, min(need, room))
            if take <= 0:
                continue
            if side == "prev":
                w[j][1] -= take
                w[i][0] -= take
            else:
                w[j][0] += take
                w[i][1] += take
            need -= take
    return [(round(a, 2), round(b, 2)) for a, b in w]


def run_full_voice(aid: str) -> None:
    try:
        with closing(db()) as conn:
            _, d = ad_row(conn, aid)
        p = d["prod"]
        fv = p["full_voice"]
        src = prod_dir(aid, "voice") / fv["file"]
        total = probe_duration(src)
        words = atlas.transcribe(src, total)
        shots = p["shots"]
        lines = [{"text": s.get("voice") or ""} for s in shots]
        voiced_idx = [i for i, ln in enumerate(lines) if ln["text"].strip()]
        timed, ratio = sz.align_with_ratio(words, [lines[i] for i in voiced_idx]) if voiced_idx else ([], 0.0)
        spans: list[dict | None] = [None] * len(shots)
        for i, t in zip(voiced_idx, timed):
            if t.get("start") is not None and t.get("end") is not None:
                spans[i] = {"start": float(t["start"]), "end": float(t["end"])}
        snap_spans(spans, silences(src))
        wins = shot_windows(shots, spans, total)
        wins = min_silent(shots, wins, spans) if wins else wins
        if not wins:
            raise RuntimeError("مقدرتش ألاقي كلام اللقطات في الصوت. اتأكد إن خانة «الكلام» في اللقطات هي نفس اللي في الصوت")
        cuts = {}
        for s, (a, b) in zip(shots, wins):
            if a >= total:
                continue  # لقطة بعد آخر الصوت (من غير كلام)
            name = f"{s['id']}-cut-{uuid.uuid4().hex[:6]}.m4a"
            subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{a:.2f}", "-i", str(src),
                            "-t", f"{max(0.1, min(b, total) - a):.2f}", "-c:a", "aac", "-b:a", "160k", str(prod_dir(aid, "voice") / name)],
                           check=True, capture_output=True, timeout=120)
            cuts[s["id"]] = name
        def fn(d):
            p = d["prod"]
            for s, (a, b), sp in zip(p["shots"], wins, spans):
                old = s.get("voice_file")
                if old and old != cuts.get(s["id"]):
                    (prod_dir(aid, "voice") / old).unlink(missing_ok=True)
                s.update(a_start=a, a_end=b, seconds=round(max(0.5, b - a), 2), voice_file=cuts.get(s["id"]),
                         voice_dur=round(b - a, 2) if s["id"] in cuts else None, voice_status="done" if s["id"] in cuts else "idle",
                         voice_error=None if sp or not (s.get("voice") or "").strip() else "الكلام ده ما اتلقطش في الصوت بالظبط (اتحط بالتقريب)")
            p["full_voice"].update(status="done", error=None, duration=round(total, 2), ratio=round(ratio, 2))
        update_ad(aid, fn)
    except Exception as exc:  # noqa: BLE001
        msg = str(getattr(exc, "detail", None) or exc)[:300]
        update_ad(aid, lambda d: d["prod"]["full_voice"].update(status="failed", error=msg))


@app.post("/api/ads/{aid}/prod/full-voice")
def prod_full_voice(aid: str, file: UploadFile | None = File(default=None)):
    """⬆ الصوت الكامل للإعلان (انت عامله بنفسك). من غير ملف = يقطّع الصوت الموجود تاني (بعد ما عدّلت الكلام مثلًا)."""
    with closing(db()) as conn:
        _, d = ad_row(conn, aid)
    p = prod_of(d)
    if file is not None and file.filename:
        name = save_audio_upload(file, prod_dir(aid, "voice"), "full")
        old = (p.get("full_voice") or {}).get("file")
        if old and old != name:
            (prod_dir(aid, "voice") / old).unlink(missing_ok=True)
    elif (p.get("full_voice") or {}).get("file"):
        name = p["full_voice"]["file"]
    else:
        raise HTTPException(400, "ارفع ملف الصوت الأول")
    if (p.get("full_voice") or {}).get("status") == "working":
        raise HTTPException(400, "بيقطّع الصوت بالفعل")
    original = name == (p.get("full_voice") or {}).get("file") and (p.get("full_voice") or {}).get("original", False)
    update_ad(aid, lambda d: d["prod"].update(full_voice={"file": name, "status": "working", "error": None, "original": original}))
    threading.Thread(target=run_full_voice, args=(aid,), daemon=True).start()
    return ad_response(aid)


def run_ad_lipsync(aid: str, sid: str, tid: str) -> None:
    """👄 الكلام على الوش: video = الفيديو المختار + الصوت (سريع)، image = الستوري بورد + الصوت بيتحول لفيديو بيتكلم (أبطأ)."""
    def setp(**kw):
        def fn(d):
            s = next((x for x in (d.get("prod") or {}).get("shots", []) if x["id"] == sid), None)
            t = next((x for x in (s or {}).get("takes") or [] if x["id"] == tid), None)
            if t is not None:
                t.update(**kw)
        update_ad(aid, fn)
    try:
        setp(status="working", error=None)
        with closing(db()) as conn:
            _, d = ad_row(conn, aid)
        s = find_pshot(d["prod"], sid)
        t = next(x for x in s["takes"] if x["id"] == tid)
        voice = prod_dir(aid, "voice") / (s.get("voice_file") or "")
        if not s.get("voice_file") or not voice.exists():
            raise RuntimeError("اللقطة ملهاش صوت. ولّد الصوت أو ارفعه الأول")
        dest = prod_dir(aid, "takes") / f"{tid}.mp4"
        if atlas.mock_mode():
            src = prod_dir(aid, "takes") / next(x for x in s["takes"] if x["id"] == t["base"])["file"] if t.get("base") else None
            if src and src.exists():
                subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-i", str(voice),
                                "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-shortest", str(dest)], check=True, capture_output=True)
            else:
                subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-i",
                                str(prod_dir(aid, "frames") / s["frame"]), "-i", str(voice), "-vf", "scale=480:-2", "-c:v", "libx264",
                                "-pix_fmt", "yuv420p", "-shortest", str(dest)], check=True, capture_output=True)
        else:
            audio_url = atlas.upload_media(voice)
            if t["method"] == "video":
                base = next(x for x in s["takes"] if x["id"] == t["base"])
                body = {"model": LIPSYNC["video"], "video_url": atlas.upload_media(prod_dir(aid, "takes") / base["file"]), "audio_url": audio_url}
            else:
                img = atlas.reference_url(prod_dir(aid, "frames") / s["frame"])
                scene = (s.get("sb_prompt") or s.get("visual") or "").strip()
                body = {"model": LIPSYNC[t["method"]], "image": img, "audio": audio_url,
                        "prompt": f"{scene}. The person speaks naturally to the camera in Arabic, lips perfectly synced to the audio, "
                                  "natural blinking, subtle head movement and small hand gestures. Keep the face, outfit, "
                                  "background and phone screen exactly as in the image."}
                if t["method"] == "omni":  # OmniHuman بيطلب الأسماء دي كمان (اتجربت)
                    body.update(image_url=img, audio_url=audio_url)
            url = atlas.run_model("Video", body, "الكلام على الوش", max_seconds=2400, interval=6)
            atlas.download(url, dest)
        setp(status="done", file=dest.name, duration=round(probe_duration(dest), 2), error=None)
    except Exception as exc:  # noqa: BLE001
        setp(status="failed", error=str(getattr(exc, "detail", None) or exc)[:400])


@app.post("/api/ads/{aid}/prod/shots/{sid}/lipsync")
def prod_lipsync(aid: str, sid: str, method: str = "video", take_id: str | None = None):
    if method not in LIPSYNC:
        raise HTTPException(400, "طريقة غير معروفة")
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
    tid = uuid.uuid4().hex[:10]
    def fn(d):
        s = find_pshot(prod_of(d), sid)
        if not s.get("voice_file"):
            raise HTTPException(400, "اللقطة ملهاش صوت. ولّد الصوت أو ارفعه الأول")
        base = base_take(s, take_id) if method == "video" else None
        if method == "video" and not base:
            raise HTTPException(400, "مفيش فيديو للقطة دي يتركب عليه الكلام. ولّد الفيديو الأول (أو استخدم «من الستوري بورد»)")
        if method in LIPSYNC_FROM_FRAME and not s.get("frame"):
            raise HTTPException(400, "ارسم الستوري بورد الأول")
        s["takes"].append({"id": tid, "file": None, "status": "queued", "error": None, "approved": False, "lipsync": True,
                           "method": method, "base": base["id"] if base else None, "duration": None,
                           "gen_duration": s.get("voice_dur"), "prompt": "👄 بيتكلم", "created_at": now()})
        s["chosen"] = tid
    update_ad(aid, fn)
    ad_executor.submit(run_ad_lipsync, aid, sid, tid)
    return ad_response(aid)


def revise_video_prompt(prompt: str, note: str) -> str:
    """موديل الكلام بيعدّل برومبت الفيديو (إنجليزي) على طلبك ويسيب الباقي زي ما هو."""
    try:
        out = series_chat([
            {"role": "system", "content": "You edit prompts for a video model (Seedance). Apply the director's requested change "
                                          "(given in Arabic) to the prompt and keep everything else as it is. Reply with JSON only: "
                                          '{"prompt": "the full revised prompt in English"}'},
            {"role": "user", "content": f"PROMPT:\n{prompt}\n\nREQUESTED CHANGE:\n{note}"},
        ])
        new = str(az.parse_json(out, "تعديل البرومبت").get("prompt") or "").strip()
        if new:
            return new
    except (HTTPException, ValueError, atlas.AtlasError):
        pass
    return f"{prompt}\nDirector's change for this version (most important): {note}"


def queue_ad_take(aid: str, sid: str, note: str = "", from_take: str | None = None, extra: list[str] | None = None) -> None:
    tid = uuid.uuid4().hex[:10]
    def fn(d):
        p = prod_of(d)
        s = find_pshot(p, sid)
        if not s.get("frame"):
            raise HTTPException(400, f"اللقطة {s['n']} ملهاش ستوري بورد")
        vm = ad_video_model(p["header"].get("video_model"))
        if vm["kind"] == "i2v":  # بيبدأ من صورة الستوري بورد بس (فيها الأبطال والمكونات)
            prompt = az.video_prompt(p["header"], s, [])
        else:
            ments = [{"name": f"@{m['name']}"} for m in mention_refs(ad_brain(d.get("settings")), s.get("mentions"))][:AD_MAX_REFS - 1]
            prompt = az.video_prompt(p["header"], s, ments + ref_comps(s, AD_MAX_REFS - 1 - len(ments)))
        src = next((t for t in s.get("takes") or [] if t["id"] == from_take and not t.get("composite")), None)
        if note and src and src.get("prompt"):
            prompt = src["prompt"]  # التعديل بيتبني على برومبت النسخة اللي مش عاجباك
        s.setdefault("takes", []).append({
            "id": tid, "file": None, "status": "queued", "error": None, "approved": False, "duration": None,
            "gen_duration": take_duration(vm, float(s.get("seconds") or 4)), "video_model": vm["key"],
            "prompt": prompt, "note": note, "revised": not note, "extra_refs": extra or [], "created_at": now()})
        if not s.get("chosen"):
            s["chosen"] = tid
    update_ad(aid, fn)
    ad_executor.submit(run_ad_take, aid, sid, tid)


@app.post("/api/ads/{aid}/prod/shots/{sid}/generate")
def prod_generate(aid: str, sid: str, note: str = "", take_id: str | None = None):
    """فيديو جديد للقطة. note = عايز تعدّل إيه في النسخة take_id (البرومبت بيتكتب من جديد بطلبك)."""
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
    queue_ad_take(aid, sid, note.strip()[:1500], take_id)
    return ad_response(aid)


@app.post("/api/ads/{aid}/prod/generate-approved")
def prod_generate_approved(aid: str):
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
    with closing(db()) as conn:
        _, d = ad_row(conn, aid)
    todo = [s["id"] for s in prod_of(d)["shots"] if s.get("approved") and s.get("frame")
            and not any(t["status"] != "failed" for t in s.get("takes") or [])]
    if not todo:
        raise HTTPException(400, "مفيش لقطات معتمدة ليها ستوري بورد ومن غير فيديو")
    for sid in todo:
        queue_ad_take(aid, sid)
    return ad_response(aid)


class TakeActIn(BaseModel):
    take_id: str


@app.post("/api/ads/{aid}/prod/shots/{sid}/take")
def prod_take_act(aid: str, sid: str, body: TakeActIn, action: str = "pick"):
    """pick: النسخة المختارة · approve / unapprove · delete · retry (بيكمّل الطلب من غير دفع تاني)."""
    retry = False
    def fn(d):
        nonlocal retry
        s = find_pshot(prod_of(d), sid)
        t = next((x for x in s.get("takes") or [] if x["id"] == body.take_id), None)
        if t is None:
            raise HTTPException(404, "النسخة مش موجودة")
        if action == "pick":
            s["chosen"] = t["id"]
        elif action in ("approve", "unapprove"):
            if t["status"] != "done":
                raise HTTPException(400, "النسخة لسه ما خلصتش")
            t["approved"] = action == "approve"
            if t["approved"]:
                s["chosen"] = t["id"]
        elif action == "delete":
            s["takes"] = [x for x in s["takes"] if x["id"] != t["id"]]
            if s.get("chosen") == t["id"]:
                s["chosen"] = s["takes"][-1]["id"] if s["takes"] else None
            if t.get("file"):
                (prod_dir(aid, "takes") / t["file"]).unlink(missing_ok=True)
        elif action == "retry":
            if t["status"] != "failed":
                raise HTTPException(400, "النسخة دي مش فاشلة")
            t.update(status="queued", error=None)
            retry = True
    update_ad(aid, fn)
    if retry:
        with closing(db()) as conn:
            _, d = ad_row(conn, aid)
        t = next(x for x in find_pshot(d["prod"], sid)["takes"] if x["id"] == body.take_id)
        if t.get("lipsync"):
            ad_executor.submit(run_ad_lipsync, aid, sid, body.take_id)
        else:
            ad_executor.submit(run_ad_take, aid, sid, body.take_id)
    return ad_response(aid)


@app.post("/api/ads/{aid}/prod/shots/{sid}/edit-take")
def prod_edit_take(aid: str, sid: str, note: str = Form(""), take_id: str = Form(""), files: list[UploadFile] = File(default=[])):
    """✏️ نسخة جديدة من فيديو اللقطة بطلبك، ومعاه صور مرجعية لو عايز."""
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
    note = note.strip()[:1500]
    if not note:
        raise HTTPException(400, "اكتب عايز تعدّل إيه")
    queue_ad_take(aid, sid, note, take_id or None, save_edit_refs(aid, files))
    return ad_response(aid)


@app.post("/api/ads/{aid}/prod/upload-take")
def prod_upload_take(aid: str, shot_id: str, file: UploadFile = File(...)):
    """فيديو من عندك للقطة (بيتعتمد على طول)."""
    tid = uuid.uuid4().hex[:10]
    name = save_upload(file, VIDEO_EXTENSIONS, prod_dir(aid, "takes"), f"{tid}-up")
    dur = probe_duration(prod_dir(aid, "takes") / name)
    def fn(d):
        s = find_pshot(prod_of(d), shot_id)
        s.setdefault("takes", []).append({"id": tid, "file": name, "status": "done", "error": None, "approved": True,
                                          "duration": round(dur, 2), "upload": True, "created_at": now()})
        s["chosen"] = tid
    update_ad(aid, fn)
    return ad_response(aid)


def ad_voice_track(aid: str, conn: sqlite3.Connection, shots: list[dict], label: str) -> dict | None:
    """التعليق الصوتي للمونتاج: الصوت الكامل زي ما هو (لو موجود)، وإلا صوت كل لقطة في مكانه على التايم لاين."""
    with closing(db()) as c2:
        _, d = ad_row(c2, aid)
    fv = (d.get("prod") or {}).get("full_voice") or {}
    if fv.get("file") and fv.get("status") == "done" and (prod_dir(aid, "voice") / fv["file"]).exists():
        vid = uuid.uuid4().hex[:12]
        src = prod_dir(aid, "voice") / fv["file"]
        vfile = f"voice_{vid}{src.suffix}"
        shutil.copyfile(src, AUDIO_DIR / vfile)
        conn.execute("INSERT INTO audio (id, kind, name, filename, duration, created_at) VALUES (?, 'voice', ?, ?, ?, ?)",
                     (vid, f"🎙️ {label}", vfile, probe_duration(AUDIO_DIR / vfile), now()))
        return {"id": vid, "volume": 1.0, "delay": 0.0, "offset": 0.0, "length": None, "fade_out": False, "parts": []}
    parts, t = [], 0.0
    for s in shots:
        f = prod_dir(aid, "voice") / (s.get("voice_file") or "")
        if s.get("voice_file") and f.exists():
            parts.append((f, t))
        t += float(s.get("seconds") or 4)
    if not parts:
        return None
    vid = uuid.uuid4().hex[:12]
    vfile = f"voice_{vid}.m4a"
    inputs, chain = [], []
    for k, (f, start) in enumerate(parts):
        inputs += ["-i", str(f)]
        chain.append(f"[{k}:a]adelay={int(start * 1000)}:all=1[a{k}]")
    chain.append("".join(f"[a{k}]" for k in range(len(parts))) + f"amix=inputs={len(parts)}:normalize=0[out]")
    subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", *inputs, "-filter_complex", ";".join(chain),
                    "-map", "[out]", "-c:a", "aac", "-b:a", "160k", str(AUDIO_DIR / vfile)], check=True, capture_output=True, timeout=300)
    conn.execute("INSERT INTO audio (id, kind, name, filename, duration, created_at) VALUES (?, 'voice', ?, ?, ?, ?)",
                 (vid, f"🎙️ {label}", vfile, probe_duration(AUDIO_DIR / vfile), now()))
    return {"id": vid, "volume": 1.0, "delay": 0.0, "offset": 0.0, "length": None, "fade_out": False, "parts": []}


@app.post("/api/ads/{aid}/prod/to-editor")
def prod_to_editor(aid: str):
    """يجمع اللقطات الموافق عليها بالترتيب في مشروع مونتاج (والموسيقى الافتراضية)."""
    with closing(db()) as conn:
        r, d = ad_row(conn, aid)
    p = prod_of(d)
    missing = []
    picks = []
    for s in p["shots"]:
        t = next((x for x in s.get("takes") or [] if x["id"] == s.get("chosen")), None)
        if not t or t["status"] != "done" or not t.get("approved"):
            missing.append(s["n"])
        else:
            picks.append((s, t))
    if missing:
        raise HTTPException(400, f"اللقطات دي لسه من غير فيديو موافق عليه: {', '.join(map(str, missing))}")
    label = p["header"].get("title") or r["name"]
    clips = []
    with closing(db()) as conn, conn:
        for s, t in picks:
            gid = uuid.uuid4().hex[:12]
            out = f"{gid}.mp4"
            shutil.copyfile(prod_dir(aid, "takes") / t["file"], GENERATED_DIR / out)
            conn.execute(
                "INSERT INTO generations (id, clip_id, clip_filename, clip_label, coach_id, coach_name, coach_image, model, prompt, "
                "params, status, output_filename, created_at, updated_at) VALUES (?, ?, ?, ?, '', '', '', 'seedance', ?, '{}', 'completed', ?, ?, ?)",
                (gid, f"ad:{aid}", t["file"], f"📣 {label} · لقطة {s['n']}", t.get("prompt") or "", out, now(), now()),
            )
            dur = float(s.get("seconds") or t.get("duration") or 4)
            clips.append({"gen_id": gid, "start": 0.0, "end": min(dur, t.get("duration") or dur),
                          "zoom": 1.0, "x": 0.0, "y": 0.0, "volume": 0.0})
        voice = ad_voice_track(aid, conn, [s for s, _ in picks], label)
        pid = uuid.uuid4().hex[:12]
        pdata = {"name": f"📣 {label}", "section": "ads", "video_id": None, "coach_id": None, "clips": clips, "voice": voice,
                 "music": default_music(conn), "outro": False, "outro_volume": 1.0, "captions": {}, "logo": {}}
        conn.execute("INSERT INTO projects (id, name, data, render_status, created_at, updated_at) VALUES (?, ?, ?, 'idle', ?, ?)",
                     (pid, pdata["name"], json.dumps(pdata, ensure_ascii=False), now(), now()))
    update_ad(aid, lambda d: d["prod"].update(project_id=pid))
    return {"project_id": pid}


def reset_stuck_prod() -> None:
    with closing(db()) as conn, conn:
        for r in conn.execute("SELECT id, data FROM ads").fetchall():
            d = json.loads(r["data"])
            p = d.get("prod")
            if not p:
                continue
            if p.get("cast_status") == "working":
                p.update(cast_status="failed", cast_error="اتقطع لما السيرفر اتقفل. دوس تاني")
            if (p.get("full_voice") or {}).get("status") == "working":
                p["full_voice"].update(status="failed", error="اتقطع لما السيرفر اتقفل. دوس «قطّع تاني»")
            for c in p.get("cast") or []:
                if c.get("status") == "working":
                    c.update(status="failed", error="اتقطع لما السيرفر اتقفل")
            for s in p["shots"]:
                if s.get("frame_status") in ("queued", "working"):
                    s.update(frame_status="failed", frame_error="اتقطع لما السيرفر اتقفل. ارسم تاني")
                if s.get("comp_status") == "working":
                    s.update(comp_status="failed", comp_error="اتقطع لما السيرفر اتقفل. استخرج تاني")
                if s.get("voice_status") == "working":
                    s.update(voice_status="failed", voice_error="اتقطع لما السيرفر اتقفل. ولّد الصوت تاني")
                for c in s.get("components") or []:
                    if c.get("status") == "working":
                        c.update(status="failed", error="اتقطع لما السيرفر اتقفل")
                for t in s.get("takes") or []:
                    if t.get("status") in ("queued", "working"):
                        t.update(status="failed", error="اتقطع لما السيرفر اتقفل. دوس ↻ (بيكمّل من غير دفع تاني)")
            conn.execute("UPDATE ads SET data = ? WHERE id = ?", (json.dumps(d, ensure_ascii=False), r["id"]))


reset_stuck_prod()


# ================================================================ 🔬 معمل التفكيك

LAB_DIR = DATA_DIR / "lab"
LAB_DIR.mkdir(parents=True, exist_ok=True)
LAB_LOCK = threading.Lock()
LAB_STEPS = ("shots", "stems", "audio", "elements", "components", "connectors")
# التفكيك العادي: القطعات ← العناصر ← اقتراح الكومبوننتس. الصوت (فصل التراكات وتحليله) متوقف ومش بيشتغل غير لو طلبته
LAB_DEFAULT = ("shots", "elements", "components", "connectors")


def lab_dir(lid: str) -> Path:
    return LAB_DIR / Path(lid).name


def lab_load(lid: str) -> dict:
    f = lab_dir(lid) / "lab.json"
    if not f.exists():
        raise HTTPException(404, "الفيديو ده مش موجود في المعمل")
    return json.loads(f.read_text(encoding="utf-8"))


def lab_update(lid: str, fn) -> dict:
    with LAB_LOCK:
        d = lab_load(lid)
        fn(d)
        d["updated_at"] = now()
        tmp = lab_dir(lid) / "lab.json.tmp"
        tmp.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
        tmp.replace(lab_dir(lid) / "lab.json")
        return d


def lab_step(lid: str, step: str, **kw) -> None:
    lab_update(lid, lambda d: d.setdefault("steps", {}).setdefault(step, {}).update(**kw))


def lab_reviews(d: dict) -> dict:
    """عدّاد المراجعة: كام حاجة اتوافق عليها / اترفضت / لسه، لكل نوع."""
    groups: dict[str, list] = {"shots": [s for s in d.get("shots") or []],
                               "stems": [v for v in (d.get("stems") or {}).values() if isinstance(v, dict) and v.get("file")],
                               "sfx": (d.get("audio") or {}).get("sfx") or [],
                               "music": (d.get("audio") or {}).get("music") or [],
                               "speech": (d.get("audio") or {}).get("speech") or [],
                               "elements": [e for s in d.get("shots") or [] for e in (s.get("analysis") or {}).get("elements") or []],
                               "actions": [a for s in d.get("shots") or [] for e in (s.get("analysis") or {}).get("elements") or []
                                           for a in e.get("actions") or []],
                               "components": d.get("components") or [], "connectors": d.get("connectors") or []}
    out = {}
    for k, items in groups.items():
        oks = [((x.get("review") or {}).get("ok")) for x in items]
        out[k] = {"total": len(items), "ok": oks.count(True), "bad": oks.count(False)}
    return out


def lab_to_dict(lid: str, d: dict) -> dict:
    base = f"/media/lab/{lid}"
    shots = []
    for s in d.get("shots") or []:
        s = {k: v for k, v in s.items() if k not in ("layers", "vedits")}
        shots.append({**s, "frames": [{**f, "url": f"{base}/frames/{f['file']}"} for f in s.get("frames") or []]})
    comps = [{**c, "asset": c["asset"] if c.get("asset") and (clip_dir(c["asset"]) / "asset.json").exists() else None}
             for c in d.get("components") or []]
    conns = [{**c, "asset": c["asset"] if c.get("asset") and (clip_dir(c["asset"]) / "asset.json").exists() else None,
              "keyframes": [{**k, "url": f"{base}/frames/{k['file']}"} for k in c.get("keyframes") or []]}
             for c in d.get("connectors") or []]
    audio = d.get("audio") or {}
    audio = {**audio, "sfx": [{**x, "clip_url": f"{base}/sfx/{x['clip']}" if x.get("clip") else None} for x in audio.get("sfx") or []]}
    stems = {k: {**v, "url": f"{base}/stems/{v['file']}" if v.get("file") else None}
             for k, v in (d.get("stems") or {}).items() if isinstance(v, dict)}
    return {**d, "id": lid, "source_url": f"{base}/{d['source']['file']}", "shots": shots, "audio": audio, "stems": stems,
            "components": comps, "connectors": conns, "families": lab.CONNECTOR_FAMILIES,
            "audioshake": bool(audioshake.api_key() or atlas.mock_mode()),
            "reviews": lab_reviews(d), "busy": any((v or {}).get("status") in ("working", "queued") for v in (d.get("steps") or {}).values()),
            "categories": list(lab.COMPONENT_CATS)}


def lab_list_items() -> list[dict]:
    out = []
    for f in sorted(LAB_DIR.glob("*/lab.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            continue
        lid = f.parent.name
        thumb = next((fr["file"] for s in d.get("shots") or [] for fr in (s.get("frames") or [])[:1]), None)
        out.append({"id": lid, "name": d.get("name"), "created_at": d.get("created_at"), "duration": d["source"]["duration"],
                    "shots": len(d.get("shots") or []), "thumb": f"/media/lab/{lid}/frames/{thumb}" if thumb else None,
                    "busy": any((v or {}).get("status") == "working" for v in (d.get("steps") or {}).values())})
    return out


@app.get("/api/lab")
def lab_list():
    return lab_list_items()


@app.post("/api/lab")
def lab_create(file: UploadFile = File(...), name: str = Form("")):
    """ترفع فيديو والتفكيك بيبدأ لوحده: القطعات ← الصوت ← عناصر كل لقطة."""
    lid = uuid.uuid4().hex[:12]
    folder = lab_dir(lid)
    folder.mkdir(parents=True, exist_ok=True)
    fname = save_upload(file, VIDEO_EXTENSIONS, folder, "source")
    try:
        info = media_info(folder / fname)
    except Exception as exc:  # noqa: BLE001
        shutil.rmtree(folder, ignore_errors=True)
        raise HTTPException(400, f"مقدرتش أقرا الفيديو: {exc}") from exc
    if info.duration > 300:
        shutil.rmtree(folder, ignore_errors=True)
        raise HTTPException(400, "الفيديو أطول من 5 دقايق. قصّه الأول")
    d = {"name": name.strip() or Path(file.filename or "فيديو").stem, "created_at": now(), "updated_at": now(),
         "source": {"file": fname, "duration": round(info.duration, 2), "width": info.width, "height": info.height,
                    "has_audio": info.has_audio},
         "steps": {k: {"status": "queued"} for k in LAB_DEFAULT}, "shots": [], "audio": {}, "components": []}
    (folder / "lab.json").write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    threading.Thread(target=run_lab, args=(lid, list(LAB_DEFAULT)), daemon=True).start()
    return lab_to_dict(lid, d)


@app.get("/api/lab/{lid}")
def lab_get(lid: str):
    return lab_to_dict(lid, lab_load(lid))


class LabPatchIn(BaseModel):
    name: str | None = None
    split: str | None = None   # fine = كل تغيير جوه المشهد، cuts = القطعات بس


@app.patch("/api/lab/{lid}")
def lab_patch(lid: str, body: LabPatchIn):
    def fn(d):
        if body.name and body.name.strip():
            d["name"] = body.name.strip()[:120]
        if body.split in ("fine", "cuts"):
            d["split"] = body.split
    return lab_to_dict(lid, lab_update(lid, fn))


@app.delete("/api/lab/{lid}")
def lab_delete(lid: str):
    lab_load(lid)
    shutil.rmtree(lab_dir(lid), ignore_errors=True)
    return {"ok": True}


@app.post("/api/lab/{lid}/run")
def lab_run(lid: str, step: str = "all", fresh: bool = False):
    """يعيد خطوة (أو كله). اللي بعدها بيتعمل من جديد: القطعات/الصوت ← العناصر ← الكومبوننتس.
    fresh = يمسح كل اقتراحات الكومبوننتس (حتى اللي قبلتها أو رفضتها) ويقترح من الصفر."""
    steps = list(LAB_DEFAULT) if step == "all" else [step] if step in LAB_STEPS else []
    if not steps:
        raise HTTPException(400, "خطوة غير معروفة")
    d = lab_load(lid)
    if any((d.get("steps") or {}).get(k, {}).get("status") == "working" for k in LAB_STEPS):
        raise HTTPException(400, "التفكيك شغال بالفعل. استنى لما يخلص")
    if "stems" in steps:
        steps = sorted(set(steps) | {"audio", "elements"}, key=LAB_STEPS.index)
    if "shots" in steps or "audio" in steps:
        steps = sorted(set(steps) | {"elements"}, key=LAB_STEPS.index)
    if "elements" in steps:
        steps = sorted(set(steps) | {"components", "connectors"}, key=LAB_STEPS.index)
    def fn(d):
        for k in steps:
            d.setdefault("steps", {})[k] = {"status": "queued"}
        if fresh and "components" in steps:
            # أسباب الرفض بتتحفظ عشان الموديل يفضل يتعلم منها، والاقتراحات نفسها بتتمسح (الأصول اللي في المكتبة بتفضل)
            d["comp_lessons"] = ([{"name": c["name"], "t0": c["t0"], "t1": c["t1"], "note": (c.get("review") or {}).get("note")}
                                  for c in d.get("components") or [] if (c.get("review") or {}).get("ok") is False]
                                 + (d.get("comp_lessons") or []))[:40]
            d["components"] = []
        if fresh and "connectors" in steps:
            d["conn_lessons"] = ([{"name": c["name"], "t0": c["t0"], "t1": c["t1"], "note": (c.get("review") or {}).get("note")}
                                  for c in d.get("connectors") or [] if (c.get("review") or {}).get("ok") is False]
                                 + (d.get("conn_lessons") or []))[:40]
            d["connectors"] = []
    lab_update(lid, fn)
    threading.Thread(target=run_lab, args=(lid, steps), daemon=True).start()
    return lab_to_dict(lid, lab_load(lid))


def lab_media_chat(messages: list[dict]) -> str:
    if not (atlas.api_key() or atlas.mock_mode()):
        raise atlas.AtlasError("مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
    return ad_media_chat(messages)


def run_lab(lid: str, steps: list[str]) -> None:
    folder = lab_dir(lid)
    for step in steps:
        try:
            lab_step(lid, step, status="working", error=None, progress="")
            d = lab_load(lid)
            src = folder / d["source"]["file"]
            dur = d["source"]["duration"]
            if step == "shots":
                shutil.rmtree(folder / "frames", ignore_errors=True)
                shots = lab.detect_shots(ffmpeg_exe(), src, dur)
                if d.get("split", "cuts") == "fine":  # 🔀 لو اخترته: كمان كل تغيير جوه المشهد (الأساسي القطعات بس، وإنت بتقسم)
                    lab_step(lid, step, progress="بيدور على التغييرات جوه كل لقطة")
                    shots = lab.fine_shots(ffmpeg_exe(), src, shots)
                for k, s in enumerate(shots):
                    lab_step(lid, step, progress=f"فريمات اللقطة {k + 1} من {len(shots)}")
                    s["frames"] = lab.extract_frames(ffmpeg_exe(), src, s["start"], s["end"], folder / "frames", shot_key(s))
                    s["review"] = None
                lab_update(lid, lambda d: d.update(shots=shots))
            elif step == "stems":
                run_lab_stems(lid, d, src)
            elif step == "audio":
                if not d["source"].get("has_audio"):
                    lab_update(lid, lambda d: d.update(audio={"none": True}))
                else:
                    run_lab_audio(lid, d, src, dur)
            elif step == "elements":
                run_lab_elements(lid)
            elif step == "components":
                run_lab_components(lid)
            elif step == "connectors":
                run_lab_connectors(lid)
            lab_step(lid, step, status="done", error=None, progress="", at=now())
        except LabSkip as exc:
            lab_step(lid, step, status="skipped", error=str(exc), progress="")
        except Exception as exc:  # noqa: BLE001
            lab_step(lid, step, status="failed", error=str(getattr(exc, "detail", None) or exc)[:400], progress="")
            if step == "shots":
                return


def run_lab_audio(lid: str, d: dict, src: Path, dur: float) -> None:
    folder = lab_dir(lid)
    lab_step(lid, "audio", progress="بيقيس بدايات الأصوات")
    # لو التراكات اتفصلت: بدايات الأصوات وقص كل مؤثر بيتعملوا من تراك المؤثرات النضيف (من غير كلام وموسيقى)
    fx_stem = (d.get("stems") or {}).get("effects", {}).get("file")
    fx_src = folder / "stems" / fx_stem if fx_stem and (folder / "stems" / fx_stem).exists() else None
    marks = lab.onsets(lab.pcm(ffmpeg_exe(), fx_src or src))
    audio_mp3 = folder / "audio.mp3"
    subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-vn", "-ac", "1", "-b:a", "96k",
                    str(audio_mp3)], check=True, capture_output=True, timeout=300)
    lab_step(lid, "audio", progress="بيفرّغ الكلام")
    try:
        words = atlas.transcribe(audio_mp3, dur)
    except Exception:  # noqa: BLE001  من غير كلام أو التفريغ فشل: نكمل بالموديل بس
        words = []
    speech = lab.speech_segments(words)
    lab_step(lid, "audio", progress="بيسمع ويصنّف المؤثرات والموسيقى")
    if atlas.mock_mode():
        res = lab.mock_audio(dur, marks)
    else:
        proxy = lab_proxy(lid, d)
        res = ad_json(lab_media_chat(az.with_media(lab.audio_messages(dur, marks, speech), data_url(proxy, "video/mp4"), "video.mp4")),
                      "تفكيك الصوت")
    shutil.rmtree(folder / "sfx", ignore_errors=True)
    (folder / "sfx").mkdir(parents=True, exist_ok=True)
    sfx = []
    for i, x in enumerate(sorted((x for x in res.get("sfx") or [] if isinstance(x, dict)), key=lambda x: float(x.get("t") or 0))):
        try:
            t0 = float(x.get("t") or 0)
        except (TypeError, ValueError):
            continue
        t, snapped = lab.snap(t0, marks)
        if not 0 <= t < dur:
            continue
        try:
            sd = min(2.0, max(0.08, float(x.get("dur") or 0.3)))
        except (TypeError, ValueError):
            sd = 0.3
        sid = f"x{i + 1}"
        clip = f"{sid}.mp3"
        lab.cut_audio(ffmpeg_exe(), fx_src or src, t - 0.04, min(sd + 0.12, dur - t + 0.04), folder / "sfx" / clip)
        sfx.append({"id": sid, "t": round(t, 3), "t_model": round(t0, 3), "snapped": snapped, "dur": round(sd, 2),
                    "label": str(x.get("label") or "")[:80], "category": x.get("category") if x.get("category") in lab.SFX_CATEGORIES else "other",
                    "what": str(x.get("what") or "")[:300], "clip": clip, "review": None})
    gem_speech = [x for x in res.get("speech") or [] if isinstance(x, dict)]
    if speech:  # التوقيت من التفريغ (أدق)، واسم المتكلم من الموديل
        for s in speech:
            hit = next((g for g in gem_speech if float(g.get("start") or 0) <= s["end"] and float(g.get("end") or 0) >= s["start"]), None)
            s.update(speaker=str((hit or {}).get("speaker") or "")[:60], review=None)
    else:
        speech = [{"start": round(float(g.get("start") or 0), 2), "end": round(float(g.get("end") or 0), 2),
                   "text": str(g.get("text") or "")[:500], "speaker": str(g.get("speaker") or "")[:60], "review": None} for g in gem_speech]
    music = [{"start": round(float(m.get("start") or 0), 2), "end": round(float(m.get("end") or 0), 2),
              "description": str(m.get("description") or "")[:300], "mood": str(m.get("mood") or "")[:80], "review": None}
             for m in res.get("music") or [] if isinstance(m, dict)]
    lab_update(lid, lambda d: d.update(audio={"sfx": sfx, "speech": speech, "music": music, "onsets": marks[:300],
                                               "from_stem": bool(fx_src)}))


def lab_proxy(lid: str, d: dict) -> Path:
    """نسخة صغيرة من الفيديو (بالصوت) عشان الموديل يتفرج عليه كله."""
    proxy = lab_dir(lid) / "proxy.mp4"
    if not proxy.exists():
        subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(lab_dir(lid) / d["source"]["file"]),
                        "-vf", "scale='if(gt(iw,ih),min(640,iw),-2)':'if(gt(iw,ih),-2,min(640,ih))',fps=12",
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "31", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-ac", "1", "-b:a", "96k", str(proxy)], check=True, capture_output=True, timeout=600)
    return proxy


def run_lab_stems(lid: str, d: dict, src: Path) -> None:
    """🎚️ فصل الصوت لكلام / موسيقى / مؤثرات (AudioShake). من غير مفتاح الخطوة بتتخطى والتحليل بيكمل على الصوت كله."""
    folder = lab_dir(lid) / "stems"
    if not d["source"].get("has_audio"):
        lab_update(lid, lambda d: d.update(stems={}))
        return
    if not (audioshake.api_key() or atlas.mock_mode()):
        lab_step(lid, "stems", status="skipped", progress="")
        raise LabSkip("مفتاح AudioShake مش متسجل (AUDIOSHAKE_API_KEY)، فالتحليل اشتغل على الصوت كله")
    shutil.rmtree(folder, ignore_errors=True)
    folder.mkdir(parents=True, exist_ok=True)
    mix = folder / "mix.mp3"
    subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-vn", "-ac", "2", "-b:a", "192k",
                    str(mix)], check=True, capture_output=True, timeout=300)
    stems = {}
    if atlas.mock_mode():  # تجربة: فلاتر بدل الفصل الحقيقي
        for name, af in (("dialogue", "bandpass=f=1200:width_type=h:w=2400"), ("music", "lowpass=f=400"), ("effects", "highpass=f=3000")):
            f = f"{name}.mp3"
            subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(mix), "-af", af, str(folder / f)],
                           check=True, capture_output=True, timeout=120)
            stems[name] = {"file": f, "status": "done", "review": None}
    else:
        lab_step(lid, "stems", progress="بيرفع الصوت")
        tid = audioshake.create_task(atlas.upload_media(mix))
        lab_step(lid, "stems", progress="AudioShake بيفصل الكلام والموسيقى والمؤثرات")
        res = audioshake.wait(tid)
        for name in audioshake.STEMS:
            r = res.get(name) or {}
            if r.get("link") and r["status"] not in ("error", "failed"):
                f = f"{name}.mp3"
                atlas.download(r["link"], folder / f)
                stems[name] = {"file": f, "status": "done", "review": None}
            else:
                stems[name] = {"file": None, "status": "failed", "error": str(r.get("error") or "مرجعش ملف")[:200], "review": None}
        stems["_task"] = tid
    lab_update(lid, lambda d: d.update(stems=stems))


class LabSkip(Exception):
    """خطوة اتخطت لسبب معروف (مش فشل)."""


def shot_key(s: dict) -> str:
    """مفتاح ثابت للحتة (رقمها بيتغير لما تتقسم أو تتدمج)."""
    return s.get("uid") or f"s{s['n']:03d}"


def run_lab_elements(lid: str, only: set[str] | None = None) -> None:
    folder = lab_dir(lid)
    d = lab_load(lid)
    shots = [s for s in d.get("shots") or [] if only is None or shot_key(s) in only]
    audio = d.get("audio") or {}
    for k, s in enumerate(shots):
        lab_step(lid, "elements", progress=f"بيفكك عناصر اللقطة {k + 1} من {len(shots)}")
        sfx = [x for x in audio.get("sfx") or [] if s["start"] - 0.05 <= x["t"] < s["end"]]
        speech = [x for x in audio.get("speech") or [] if x["start"] < s["end"] and x["end"] > s["start"]]
        try:
            if atlas.mock_mode():
                raw = lab.mock_elements(s, sfx)
            else:
                frames = [{"t": f["t"], "data_url": data_url(folder / "frames" / f["file"], "image/jpeg")} for f in s.get("frames") or []]
                raw = ad_json(lab_media_chat(lab.elements_messages(s, frames, sfx, speech)), f"عناصر اللقطة {s['n']}")
            res = lab.clean_elements(raw, s, {x["id"] for x in sfx})
            err = None
        except Exception as exc:  # noqa: BLE001  لقطة فشلت متوقفش الباقي
            res, err = None, str(getattr(exc, "detail", None) or exc)[:300]
        def fn(d, key=shot_key(s), res=res, err=err):
            x = next((y for y in d.get("shots") or [] if shot_key(y) == key), None)
            if x is not None:
                x["analysis"], x["analysis_error"] = res, err
                # 🙈 تصوير عادي من غير موشن جرافيك بيتشال لوحده (إلا لو إنت اللي رجّعته أو شلته بإيدك)
                if res and (x.get("ignored") or {}).get("by") != "user" and not x.get("keep"):
                    x["ignored"] = None if res.get("motion_graphics") else {
                        "by": "auto", "reason": res.get("mg_reason") or "مفيهاش موشن جرافيك", "at": now()}
        lab_update(lid, fn)


class LabReviewIn(BaseModel):
    kind: str            # shot | stem | sfx | music | speech | background | element | action
    ref: str             # رقم/id العنصر (الأكشن: elementId:index)
    ok: bool | None = None
    note: str = ""
    fix: dict = {}       # تصحيح الاسم/النوع/التصنيف/الوقت


LAB_FIX_KEYS = {"stem": (), "sfx": ("label", "category", "t"), "music": ("description", "mood"), "speech": ("speaker", "text"),
                "background": ("name", "description"), "element": ("name", "type", "description"),
                "action": ("action", "detail"), "shot": ()}


@app.patch("/api/lab/{lid}/review")
def lab_review(lid: str, body: LabReviewIn):
    """👤 تقييمك: موافق ✅ / غلط ❌ / ملاحظة، والتصحيح بيتحفظ مع الأصل عشان نتعلم منه."""
    if body.kind not in LAB_FIX_KEYS:
        raise HTTPException(400, "نوع غير معروف")
    def find(d):
        shots = d.get("shots") or []
        audio = d.get("audio") or {}
        if body.kind == "shot":
            return next((s for s in shots if str(s["n"]) == body.ref), None)
        if body.kind == "sfx":
            return next((x for x in audio.get("sfx") or [] if x["id"] == body.ref), None)
        if body.kind == "stem":
            x = (d.get("stems") or {}).get(body.ref)
            return x if isinstance(x, dict) else None
        if body.kind in ("music", "speech"):
            lst = audio.get(body.kind) or []
            return lst[int(body.ref)] if body.ref.isdigit() and int(body.ref) < len(lst) else None
        if body.kind == "background":
            s = next((s for s in shots if str(s["n"]) == body.ref), None)
            return ((s or {}).get("analysis") or {}).get("background")
        els = [e for s in shots for e in (s.get("analysis") or {}).get("elements") or []]
        if body.kind == "element":
            return next((e for e in els if e["id"] == body.ref), None)
        if body.kind == "action":
            eid, _, idx = body.ref.rpartition(":")
            e = next((e for e in els if e["id"] == eid), None)
            return (e or {}).get("actions", [])[int(idx)] if e and idx.isdigit() and int(idx) < len(e.get("actions") or []) else None
        return None
    def fn(d):
        x = find(d)
        if x is None:
            raise HTTPException(404, "العنصر ده مش موجود")
        fix = {k: body.fix[k] for k in LAB_FIX_KEYS[body.kind] if k in body.fix}
        if fix:
            x.setdefault("original", {k: x.get(k) for k in fix})  # الأصل بتاع الموديل بيتحفظ للمقارنة والتعلم
            x.update(fix)
        x["review"] = {"ok": body.ok, "note": body.note.strip()[:500], "at": now()}
    return lab_to_dict(lid, lab_update(lid, fn))


class ShotIn(BaseModel):
    ignored: bool


@app.patch("/api/lab/{lid}/shots/{n}")
def lab_shot_patch(lid: str, n: int, body: ShotIn):
    """🗑️ شيل لقطة (مش هتدخل في الكومبوننتس) أو ↩ رجّعها. اللقطة نفسها بتفضل عشان ترجعها وقت ما تحب."""
    def fn(d):
        s = lab_shot(d, n)
        s["ignored"] = {"by": "user", "reason": "شلتها بإيدك", "at": now()} if body.ignored else None
        s["keep"] = not body.ignored  # رجّعتها: التفكيك الجاي ميشيلهاش تاني
    return lab_to_dict(lid, lab_update(lid, fn))


@app.post("/api/lab/{lid}/shots/{n}/merge")
def lab_shot_merge(lid: str, n: int):
    """🔗 يدمج الحتة دي مع اللي بعدها (لو التقسيم فصل حركة واحدة)."""
    def fn(d):
        shots = d.get("shots") or []
        i = next((k for k, x in enumerate(shots) if x["n"] == n), None)
        if i is None or i + 1 >= len(shots):
            raise HTTPException(400, "مفيش لقطة بعدها تتدمج معاها")
        a, b = shots[i], shots[i + 1]
        an, bn = a.get("analysis"), b.get("analysis")
        if an or bn:
            an, bn = an or {}, bn or {}
            a["analysis"] = {**an, "summary": " ← ".join(x for x in (an.get("summary"), bn.get("summary")) if x),
                             "motion_graphics": bool(an.get("motion_graphics") or bn.get("motion_graphics")),
                             "elements": (an.get("elements") or []) + (bn.get("elements") or [])}
        a.update(end=b["end"], frames=(a.get("frames") or []) + (b.get("frames") or []), review=None,
                 ignored=a.get("ignored") if b.get("ignored") else None)
        del shots[i + 1]
        renumber(shots)
    return lab_to_dict(lid, lab_update(lid, fn))


def renumber(shots: list[dict]) -> None:
    for k, x in enumerate(shots):
        if not x.get("uid"):
            x["uid"] = f"s{x['n']:03d}"   # المفتاح القديم بيفضل زي ما هو (أسامي الفريمات والعناصر)
        x["n"] = k + 1


class SplitIn(BaseModel):
    t: float


@app.post("/api/lab/{lid}/shots/{n}/split")
def lab_shot_split(lid: str, n: int, body: SplitIn):
    """✂️ يقسم الحتة عند وقت معيّن (لو البرنامج فوّت تغيير)، والعناصر بتتحلل للحتتين من جديد."""
    d = lab_load(lid)
    s = lab_shot(d, n)
    t = round(body.t, 3)
    if not (s["start"] + 0.25 <= t <= s["end"] - 0.25):
        raise HTTPException(400, "اختار وقت جوه الحتة (مش في أولها أو آخرها بالظبط)")
    if any((v or {}).get("status") in ("working", "queued") for v in (d.get("steps") or {}).values()):
        raise HTTPException(400, "استنى لما التفكيك اللي شغال يخلص")
    src, folder = lab_dir(lid) / d["source"]["file"], lab_dir(lid) / "frames"
    keys = [uuid.uuid4().hex[:4], uuid.uuid4().hex[:4]]
    parts = [{"start": s["start"], "end": t, "cut": s.get("cut") or "hard", "uid": keys[0]},
             {"start": t, "end": s["end"], "cut": "change", "uid": keys[1]}]
    for p in parts:
        p["frames"] = lab.extract_frames(ffmpeg_exe(), src, p["start"], p["end"], folder, p["uid"])
        p.update(review=None, analysis=None, ignored=None, keep=bool(s.get("keep")))
    def fn(d):
        shots = d["shots"]
        i = next(k for k, x in enumerate(shots) if x["n"] == n)
        shots[i:i + 1] = parts
        renumber(shots)
        d.setdefault("steps", {})["elements"] = {"status": "working", "progress": "بيفكك عناصر الحتتين الجداد"}
    d = lab_update(lid, fn)
    def run():
        try:
            run_lab_elements(lid, set(keys))
            lab_step(lid, "elements", status="done", error=None, progress="", at=now())
        except Exception as exc:  # noqa: BLE001
            lab_step(lid, "elements", status="failed", error=str(exc)[:300], progress="")
    threading.Thread(target=run, daemon=True).start()
    return lab_to_dict(lid, d)


@app.post("/api/lab/{lid}/shots/prune")
def lab_shots_prune(lid: str):
    """🧹 يشيل كل اللقطات اللي ملهاش ولا كومبوننت (غير المرفوضة)."""
    def fn(d):
        live = [c for c in d.get("components") or [] if (c.get("review") or {}).get("ok") is not False]
        gone = 0
        for s in d.get("shots") or []:
            if s.get("ignored") or any(c["t0"] < s["end"] and c["t1"] > s["start"] for c in live):
                continue
            s["ignored"], s["keep"] = {"by": "user", "reason": "ملهاش كومبوننتس", "at": now()}, False
            gone += 1
        if not gone:
            raise HTTPException(400, "كل اللقطات اللي فاضلة فيها كومبوننتس")
    return lab_to_dict(lid, lab_update(lid, fn))


def lab_shot(d: dict, n: int) -> dict:
    s = next((x for x in d.get("shots") or [] if x["n"] == n), None)
    if not s:
        raise HTTPException(404, "اللقطة مش موجودة")
    return s


# ---------- ✏️ التعديل جوه المشهد (للأصول في المكتبة): نفس الفيديو بحركته، وكل عنصر فيه يتغيّر بالكلام

def vedit_render(v: dict, src: Path, out: Path, context: dict, setv) -> None:
    """نسخة جديدة من مقطع: ⏩ سرعة جزء (بالكود) أو ✏️ تعديل جوه المشهد بموديل فيديو (الحركة زي ما هي).
    context = {"analysis": ...} عشان التعليمات توصف العناصر بشكلها ومكانها."""
    if v["kind"] == "speed":
        lab.retime(ffmpeg_exe(), src, out, v["t0"], v["t1"], v["factor"], probe_duration(src))
    elif atlas.mock_mode():
        subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-vf", "hue=h=120",
                        "-c:a", "copy", str(out)], check=True, capture_output=True, timeout=300)
        setv(prompt="(تجربة) hue shift")
    else:
        setv(step="بيكتب التعليمات")
        prompt = str(ad_json(series_chat(lab.vedit_messages(context, v["instruction"])), "تعليمات التعديل").get("prompt") or "").strip()
        if not prompt:
            raise RuntimeError("الموديل مكتبش تعليمات")
        setv(prompt=prompt, step="موديل الفيديو بيعدّل المشهد")
        m = lab.VEDIT_MODELS[v["model"]]
        url = atlas.run_model("Video", {"model": m["model"], "video": atlas.upload_media(src), "prompt": prompt},
                              "تعديل المشهد", max_seconds=1500, interval=6)
        atlas.download(url, out)


def vedit_item(body) -> dict:
    """طلب نسخة (من اللقطة أو من أصل في المكتبة) بعد التأكد من القيم."""
    if body.speed:
        try:
            t0, t1, f = float(body.speed["t0"]), float(body.speed["t1"]), float(body.speed["factor"])
        except (KeyError, TypeError, ValueError) as exc:
            raise HTTPException(400, "حدد الجزء والسرعة") from exc
        if not (0.2 <= f <= 5) or t1 - t0 < 0.05:
            raise HTTPException(400, "السرعة من 0.2 لـ 5، والجزء لازم يبقى أطول من كده")
        item = {"kind": "speed", "t0": t0, "t1": t1, "factor": f, "instruction": f"⏩ سرعة ×{f:g} من {t0:.2f} لـ {t1:.2f}"}
    else:
        text = body.instruction.strip()[:2000]
        if not text:
            raise HTTPException(400, "اكتب عايز تغيّر إيه")
        if body.model not in lab.VEDIT_MODELS:
            raise HTTPException(400, "موديل غير معروف")
        if not (atlas.api_key() or atlas.mock_mode()):
            raise HTTPException(400, "مفتاح Atlas مش متسجل")
        item = {"kind": "ai", "instruction": text, "model": body.model}
    return {**item, "id": uuid.uuid4().hex[:8], "base": body.base, "status": "working", "step": "بيجهّز", "file": None,
            "error": None, "review": None, "created_at": now()}


class VeditIn(BaseModel):
    instruction: str = ""
    model: str = "gemini"
    base: str | None = None       # نكمّل على نسخة متعدلة
    speed: dict | None = None     # {"t0", "t1", "factor"} = تسريع/تبطيء جزء (من غير AI)


# ================================================================ 📚 مكتبة الأصول
# الأصل = مقطع من فيديو بحركته وخلفيته وصوته (افيكت، موشن جرافيك، انتقال، حركة ماوس...) + كل اللي اتفهم عنه
# (العناصر وحركاتها والأصوات). بيتحكم فيه بالتعديل جوه المشهد وبالسرعة، وكل تعديل بيبقى نسخة منه.

ASSETS_DIR = DATA_DIR / "assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)
CLIP_LOCK = threading.Lock()
CLIP_CATS = ("connector", "motion_graphics", "effect", "transition", "text", "screen", "cursor", "character", "background", "product", "other")


def clip_dir(aid: str) -> Path:
    return ASSETS_DIR / Path(aid).name


def clip_load(aid: str) -> dict:
    f = clip_dir(aid) / "asset.json"
    if not f.exists():
        raise HTTPException(404, "الأصل ده مش موجود")
    return json.loads(f.read_text(encoding="utf-8"))


def clip_update(aid: str, fn) -> dict:
    with CLIP_LOCK:
        d = clip_load(aid)
        fn(d)
        d["updated_at"] = now()
        tmp = clip_dir(aid) / "asset.json.tmp"
        tmp.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
        tmp.replace(clip_dir(aid) / "asset.json")
        return d


def clip_to_dict(aid: str, d: dict) -> dict:
    base = f"/media/assets/{aid}"
    return {**d, "id": aid, "url": f"{base}/{d['file']}", "thumb_url": f"{base}/{d['thumb']}",
            "keyframes": [{**k, "url": f"{base}/{k['file']}"} for k in d.get("keyframes") or []],
            "variants": [{**v, "url": f"{base}/variants/{v['file']}" if v.get("file") else None} for v in d.get("variants") or []],
            "busy": any(v.get("status") == "working" for v in d.get("variants") or [])
            or any(t.get("status") in ("planning", "working") for t in d.get("trials") or []),
            "trials": [trial_to_dict(aid, t) for t in d.get("trials") or []],
            "trial_models": [{"key": k, "label": v["label"], "per_sec": v["per_sec"]} for k, v in TRIAL_MODELS.items()],
            "vedit_models": [{"key": k, "label": v["label"], "per_sec": v["per_sec"]} for k, v in lab.VEDIT_MODELS.items()]}


def clip_from_lab(lid: str, d: dict, t0: float, t1: float, meta: dict) -> dict:
    """📚 مقطع من الفيديو الأصلي (بحركته وخلفيته وصوته) بيتحفظ كأصل، ومعاه العناصر والحركات والأصوات اللي جواه."""
    dur = d["source"]["duration"]
    t0, t1 = max(0.0, t0), min(dur, t1)
    if t1 - t0 < 0.15:
        raise HTTPException(400, "المقطع قصير أوي")
    aid = uuid.uuid4().hex[:12]
    folder = clip_dir(aid)
    (folder / "variants").mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t0:.3f}", "-i", str(lab_dir(lid) / d["source"]["file"]),
                        "-t", f"{t1 - t0:.3f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(folder / "clip.mp4")],
                       check=True, capture_output=True, timeout=300)
        subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{(t1 - t0) / 2:.3f}", "-i", str(folder / "clip.mp4"),
                        "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "3", str(folder / "thumb.jpg")], check=True, capture_output=True, timeout=60)
        info = media_info(folder / "clip.mp4")
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)
        raise
    shots = [s for s in d.get("shots") or [] if s["start"] < t1 and s["end"] > t0]
    ans = [s.get("analysis") or {} for s in shots]
    rb = lambda t: round(max(0.0, min(t1, t) - t0), 2)  # noqa: E731  الوقت من أول الأصل
    elements = []
    for an in ans:
        for e in an.get("elements") or []:
            if e["last_t"] < t0 or e["first_t"] > t1:
                continue
            acts = [{**{k: a.get(k) for k in ("action", "from", "to", "detail")}, "t0": rb(a["t0"]), "t1": rb(a["t1"])}
                    for a in e.get("actions") or [] if a["t1"] >= t0 and a["t0"] <= t1]
            elements.append({"id": e["id"], "name": e["name"], "type": e["type"], "description": e.get("description", ""), "box": e.get("box"),
                             "first_t": rb(e["first_t"]), "last_t": rb(e["last_t"]), "actions": acts})
    sfx = [{"t": rb(x["t"]), "label": x.get("label"), "category": x.get("category")}
           for x in (d.get("audio") or {}).get("sfx") or [] if t0 <= x["t"] <= t1]
    summary = " ← ".join(a.get("summary", "") for a in ans if a.get("summary"))
    data = {"name": str(meta.get("name") or "").strip()[:120] or summary[:80] or f"أصل من {d.get('name', '')}",
            "category": meta.get("category") if meta.get("category") in CLIP_CATS else "other",
            "tags": [str(t).strip()[:30] for t in meta.get("tags") or [] if str(t).strip()][:12],
            "notes": str(meta.get("notes") or "").strip()[:1000],
            "description": str(meta.get("description") or "")[:600], "use": str(meta.get("use") or "")[:300],
            "controls": meta.get("controls") or [],
            "connector": meta.get("connector"),
            "file": "clip.mp4", "thumb": "thumb.jpg", "duration": round(info.duration, 2), "width": info.width, "height": info.height,
            "source": {"lab": lid, "lab_name": d.get("name"), "shots": [s["n"] for s in shots], "t0": round(t0, 3), "t1": round(t1, 3),
                       "component": meta.get("component")},
            "scene_type": (ans[0] if ans else {}).get("scene_type"), "summary": summary,
            "background": (ans[0] if ans else {}).get("background"),
            "elements": elements, "sfx": sfx, "variants": [], "created_at": now(), "updated_at": now()}
    keys = []
    for k in meta.get("keyframes") or []:  # فريمات الكونيكتور المفتاحية (بداية / نص / نهاية)
        src_k = lab_dir(lid) / "frames" / k["file"]
        if src_k.exists():
            shutil.copyfile(src_k, folder / k["file"])
            keys.append({"t": round(k["t"] - t0, 2), "file": k["file"], "label": k.get("label", "")})
    data["keyframes"] = keys
    (folder / "asset.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return clip_to_dict(aid, data)


class AssetIn(BaseModel):
    name: str = ""
    category: str = "other"
    tags: list[str] = []
    notes: str = ""
    t0: float               # بالثواني من أول الفيديو
    t1: float


@app.post("/api/lab/{lid}/asset")
def lab_save_asset(lid: str, body: AssetIn):
    """📚 احفظ أي مقطع من الفيديو بإيدك كأصل (لو الاقتراحات فاتتها حاجة)."""
    return clip_from_lab(lid, lab_load(lid), body.t0, body.t1, body.model_dump())


# ---------- 💡 الكومبوننتس: الموديل بيقترح من التفكيك، وإنت بتقبل (بيدخل المكتبة) أو ترفض (وسببك بيعلّمه)

def run_lab_components(lid: str) -> None:
    d = lab_load(lid)
    if not any(s.get("analysis") for s in d.get("shots") or []):
        raise LabSkip("مفيش عناصر متفككة. فكّك العناصر الأول")
    old = d.get("components") or []
    keep = [c for c in old if (c.get("review") or {}).get("ok") is not None or c.get("asset")]
    rejected = [{"name": c["name"], "t0": c["t0"], "t1": c["t1"], "note": (c.get("review") or {}).get("note")}
                for c in keep if (c.get("review") or {}).get("ok") is False] + (d.get("comp_lessons") or [])
    lab_step(lid, "components", progress="بيدور على الحتت اللي تنفع تتعاد")
    raw = lab.mock_components(d) if atlas.mock_mode() else ad_json(series_chat(lab.components_messages(d, rejected)), "الكومبوننتس")
    ids = {e["id"] for s in d.get("shots") or [] for e in (s.get("analysis") or {}).get("elements") or []}
    bounds = sorted({x for s in d.get("shots") or [] if not s.get("ignored") for x in (s["start"], s["end"])})
    new = [c for c in lab.clean_components(raw, d["source"]["duration"], ids, bounds)
           if not any(abs(c["t0"] - k["t0"]) < 0.3 and abs(c["t1"] - k["t1"]) < 0.3 for k in keep)]  # نفس اللي اتراجع قبل كده
    lab_update(lid, lambda d: d.update(components=sorted(keep + new, key=lambda c: c["t0"])))


def run_lab_connectors(lid: str) -> None:
    """🔗 الموديل بيتفرج على الفيديو كله ويطلّع الكونيكتورز بوصفتها، ولكل واحد 3 فريمات مفتاحية."""
    d = lab_load(lid)
    old = d.get("connectors") or []
    keep = [c for c in old if (c.get("review") or {}).get("ok") is not None or c.get("asset")]
    rejected = [{"name": c["name"], "t0": c["t0"], "t1": c["t1"], "note": (c.get("review") or {}).get("note")}
                for c in keep if (c.get("review") or {}).get("ok") is False] + (d.get("conn_lessons") or [])
    if atlas.mock_mode():
        raw = lab.mock_connectors(d)
    else:
        lab_step(lid, "connectors", progress="بيجهّز الفيديو")
        proxy = lab_proxy(lid, d)
        lab_step(lid, "connectors", progress="بيتفرج على الفيديو كله ويدوّر على التحوّلات")
        raw = ad_json(lab_media_chat(az.with_media(lab.connectors_messages(d, rejected), data_url(proxy, "video/mp4"), "video.mp4")),
                      "الكونيكتورز")
    new = [c for c in lab.clean_connectors(raw, d["source"]["duration"])
           if not any(abs(c["t0"] - k["t0"]) < 0.3 and abs(c["t1"] - k["t1"]) < 0.3 for k in keep)]
    for c in new:
        lab_step(lid, "connectors", progress=f"فريمات «{c['name'][:30]}»")
        c["keyframes"] = conn_keyframes(lid, d, c)
    lab_update(lid, lambda d: d.update(connectors=sorted(keep + new, key=lambda c: c["t0"])))


def conn_keyframes(lid: str, d: dict, c: dict) -> list[dict]:
    """3 فريمات للكونيكتور: البداية والنص والنهاية (أسامي جديدة كل مرة عشان المتصفح ميعرضش القديمة)."""
    src, folder = lab_dir(lid) / d["source"]["file"], lab_dir(lid) / "frames"
    folder.mkdir(parents=True, exist_ok=True)
    for k in c.get("keyframes") or []:
        (folder / k["file"]).unlink(missing_ok=True)
    tag, out = uuid.uuid4().hex[:4], []
    for k, (t, label) in enumerate(((c["t0"], "البداية"), ((c["t0"] + c["t1"]) / 2, "النص"), (c["t1"], "النهاية"))):
        name = f"cx{c['id']}-{tag}-{k}.jpg"
        subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{min(t, d['source']['duration'] - 0.05):.3f}",
                        "-i", str(src), "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "4", str(folder / name)],
                       capture_output=True, timeout=60)
        if (folder / name).exists():
            out.append({"t": round(t, 2), "file": name, "label": label})
    return out


CONN_TEXT = ("from_scene", "to_scene", "trigger", "camera", "rhythm", "story_role", "sound")


class ConnectorIn(BaseModel):
    name: str | None = None
    family: str | None = None
    t0: float | None = None
    t1: float | None = None
    recipe: list[str] | None = None
    anchors: list[str] | None = None
    transforms: list[dict] | None = None
    from_scene: str | None = None
    to_scene: str | None = None
    trigger: str | None = None
    camera: str | None = None
    rhythm: str | None = None
    story_role: str | None = None
    sound: str | None = None
    review: bool = False
    ok: bool | None = None
    note: str = ""


def conn_fix(c: dict, fix: dict, dur: float) -> dict:
    """يطبّق تعديل على الكونيكتور (والنسخة الأصلية من الموديل بتتحفظ مرة واحدة للمقارنة والتعلم)."""
    if not fix:
        return c
    c.setdefault("original", {k: c.get(k) for k in lab.CONNECTOR_KEYS})
    c.update(fix)
    c["t0"], c["t1"] = round(min(dur, max(0.0, c["t0"])), 2), round(min(dur, max(0.0, c["t1"])), 2)
    if c["t1"] - c["t0"] < 0.2:
        raise HTTPException(400, "المقطع قصير أوي")
    c["edited"] = True
    return c


def conn_sync(lid: str, cid: str, range_changed: bool) -> dict:
    """بعد التعديل: الفريمات بتتعمل من جديد لو التوقيت اتغير، والنسخة اللي في المكتبة (لو اتقبل) بتتحدّث."""
    d = lab_load(lid)
    c = next(x for x in d["connectors"] if x["id"] == cid)
    if range_changed:
        keys = conn_keyframes(lid, d, c)
        d = lab_update(lid, lambda d: next(x for x in d["connectors"] if x["id"] == cid).update(keyframes=keys))
        c = next(x for x in d["connectors"] if x["id"] == cid)
    aid = c.get("asset")
    if aid and (clip_dir(aid) / "asset.json").exists():
        if range_changed:  # المقطع نفسه اتغير: نسخة جديدة في المكتبة مكان القديمة
            shutil.rmtree(clip_dir(aid), ignore_errors=True)
            d = conn_to_library(lid, d, c)
        else:
            rec = conn_recipe(c)
            clip_update(aid, lambda a: a.update(name=c["name"], description=c.get("story_role", ""), connector=rec))
    return d


def conn_recipe(c: dict) -> dict:
    return {k: c.get(k) for k in ("family", "from_scene", "to_scene", "trigger", "anchors", "transforms", "camera",
                                  "rhythm", "recipe", "story_role", "sound")}


def conn_to_library(lid: str, d: dict, c: dict) -> dict:
    a = clip_from_lab(lid, d, c["t0"], c["t1"], {
        "name": c["name"], "category": "connector", "tags": [lab.CONNECTOR_FAMILIES.get(c["family"], "").split(" ", 1)[-1]],
        "description": c.get("story_role", ""), "connector": conn_recipe(c), "keyframes": c.get("keyframes") or [],
        "component": c["id"]})
    def link(d):
        x = next((y for y in d.get("connectors") or [] if y["id"] == c["id"]), None)
        if x is not None:
            x["asset"] = a["id"]
    return lab_update(lid, link)


@app.patch("/api/lab/{lid}/connectors/{cid}")
def lab_connector(lid: str, cid: str, body: ConnectorIn):
    """تعديل الكونيكتور (الاسم/العيلة/التوقيت/الشرح/الوصفة) أو تقييمه. ✅ بيحفظه في المكتبة بوصفته وفريماته."""
    moved = []
    def fn(d):
        c = next((x for x in d.get("connectors") or [] if x["id"] == cid), None)
        if c is None:
            raise HTTPException(404, "الكونيكتور ده مش موجود")
        fix = {}
        if body.name is not None and body.name.strip():
            fix["name"] = body.name.strip()[:100]
        if body.family in lab.CONNECTOR_FAMILIES:
            fix["family"] = body.family
        for k in ("t0", "t1"):
            v = getattr(body, k)
            if v is not None and abs(v - c[k]) > 0.005:
                fix[k] = v
        for k in CONN_TEXT:
            v = getattr(body, k)
            if v is not None:
                fix[k] = v.strip()[:500]
        if body.recipe is not None:
            fix["recipe"] = [x.strip()[:300] for x in body.recipe if x.strip()][:12]
        if body.anchors is not None:
            fix["anchors"] = [x.strip()[:200] for x in body.anchors if x.strip()][:8]
        if body.transforms is not None:
            fix["transforms"] = [{"t0": float(x.get("t0") or 0), "t1": float(x.get("t1") or 0), "from": str(x.get("from") or "")[:200],
                                  "to": str(x.get("to") or "")[:200], "how": str(x.get("how") or "")[:300]}
                                 for x in body.transforms if isinstance(x, dict) and (x.get("from") or x.get("to"))][:12]
        moved.append("t0" in fix or "t1" in fix)
        conn_fix(c, fix, d["source"]["duration"])
        if body.review:
            c["review"] = {"ok": body.ok, "note": body.note.strip()[:500], "at": now()}
    d = lab_update(lid, fn)
    if not body.review:
        d = conn_sync(lid, cid, moved[0])
    c = next(x for x in d["connectors"] if x["id"] == cid)
    if body.review and body.ok and not (c.get("asset") and (clip_dir(c["asset"]) / "asset.json").exists()):
        d = conn_to_library(lid, d, c)
    return lab_to_dict(lid, d)


class RefineIn(BaseModel):
    message: str


@app.post("/api/lab/{lid}/connectors/{cid}/refine")
def lab_connector_refine(lid: str, cid: str, body: RefineIn):
    """💬 تقول للشرح «عدّل كذا»: الموديل بيتفرج على الحتة دي تاني (ومعاها ثانية ونص قبلها وبعدها) ويعدّل."""
    msg = body.message.strip()[:1500]
    if not msg:
        raise HTTPException(400, "اكتب عايز تعدّل إيه")
    d = lab_load(lid)
    c = next((x for x in d.get("connectors") or [] if x["id"] == cid), None)
    if c is None:
        raise HTTPException(404, "الكونيكتور ده مش موجود")
    dur = d["source"]["duration"]
    a0, a1 = max(0.0, c["t0"] - 1.5), min(dur, c["t1"] + 1.5)
    if atlas.mock_mode():
        res = {"reply": "تمام، عدّلت الشرح على كلامك (تجربة).",
               "connector": {"story_role": f"{c.get('story_role', '')} — {msg}", "t0": c["t0"] - a0, "t1": c["t1"] - a0}}
    else:
        if not (atlas.api_key()):
            raise HTTPException(400, "مفتاح Atlas مش متسجل")
        clip = lab_dir(lid) / "tmp" / f"refine-{cid}.mp4"
        clip.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{a0:.3f}", "-i", str(lab_dir(lid) / d["source"]["file"]),
                        "-t", f"{a1 - a0:.3f}", "-vf", "scale='if(gt(iw,ih),min(720,iw),-2)':'if(gt(iw,ih),-2,min(720,ih))',fps=15",
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ac", "1",
                        str(clip)], check=True, capture_output=True, timeout=300)
        try:
            res = ad_json(lab_media_chat(az.with_media(lab.connector_refine_messages(c, msg, a0, c.get("chat") or []),
                                                       data_url(clip, "video/mp4"), "clip.mp4")), "تعديل الشرح")
        finally:
            clip.unlink(missing_ok=True)
    fix = lab.apply_refine(c, res, a0, dur)
    if not fix:
        raise HTTPException(502, "الموديل ما رجعش شرح مفهوم. جرّب تاني بكلام أوضح")
    moved = abs(fix["t0"] - c["t0"]) > 0.005 or abs(fix["t1"] - c["t1"]) > 0.005
    reply = str(res.get("reply") or "اتعدّل")[:500]
    def fn(d):
        x = next(y for y in d["connectors"] if y["id"] == cid)
        conn_fix(x, fix, dur)
        x.setdefault("chat", []).extend([{"role": "user", "text": msg, "at": now()}, {"role": "model", "text": reply, "at": now()}])
        x["chat"] = x["chat"][-20:]
    lab_update(lid, fn)
    return {**lab_to_dict(lid, conn_sync(lid, cid, moved)), "reply": reply}


class ComponentIn(BaseModel):
    name: str | None = None
    category: str | None = None
    t0: float | None = None
    t1: float | None = None
    review: bool = False      # true = ده تقييم (ok/note)
    ok: bool | None = None    # ✅ = يدخل المكتبة على طول، ❌ = مرفوض
    note: str = ""


@app.patch("/api/lab/{lid}/components/{cid}")
def lab_component(lid: str, cid: str, body: ComponentIn):
    """تعديل الاقتراح (الاسم/النوع/البداية والنهاية) أو تقييمه. ✅ بيحفظه في المكتبة."""
    def fn(d):
        c = next((x for x in d.get("components") or [] if x["id"] == cid), None)
        if c is None:
            raise HTTPException(404, "الاقتراح ده مش موجود")
        dur = d["source"]["duration"]
        fix = {}
        if body.name is not None and body.name.strip():
            fix["name"] = body.name.strip()[:100]
        if body.category in CLIP_CATS:
            fix["category"] = body.category
        if body.t0 is not None:
            fix["t0"] = round(min(dur, max(0.0, body.t0)), 2)
        if body.t1 is not None:
            fix["t1"] = round(min(dur, max(0.0, body.t1)), 2)
        if fix:
            c.setdefault("original", {k: c.get(k) for k in fix})
            c.update(fix)
            if c["t1"] - c["t0"] < 0.15:
                raise HTTPException(400, "المقطع قصير أوي")
        if body.review:
            c["review"] = {"ok": body.ok, "note": body.note.strip()[:500], "at": now()}
    d = lab_update(lid, fn)
    c = next(x for x in d["components"] if x["id"] == cid)
    if body.review and body.ok and not (c.get("asset") and (clip_dir(c["asset"]) / "asset.json").exists()):
        a = clip_from_lab(lid, d, c["t0"], c["t1"], {**c, "component": cid})
        def link(d):
            x = next((y for y in d.get("components") or [] if y["id"] == cid), None)
            if x is not None:
                x["asset"] = a["id"]
        d = lab_update(lid, link)
    return lab_to_dict(lid, d)


@app.delete("/api/assets")
def assets_clear():
    """🗑️ يمسح المكتبة كلها (الأصول ونسخها). الكومبوننتس في المعمل بترجع «لسه» وتقدر تقبلها تاني."""
    busy = [f.parent.name for f in ASSETS_DIR.glob("*/asset.json")
            if any(v.get("status") == "working" for v in json.loads(f.read_text(encoding="utf-8")).get("variants") or [])]
    if busy:
        raise HTTPException(400, "فيه نسخة بتتعمل دلوقتي. استنى لما تخلص")
    n = 0
    for f in ASSETS_DIR.glob("*/asset.json"):
        shutil.rmtree(f.parent, ignore_errors=True)
        n += 1
    for f in LAB_DIR.glob("*/lab.json"):  # الكومبوننتس المقبولة ترجع زي ما كانت قبل ما تتقبل
        try:
            lid = f.parent.name
            def fn(d):
                for c in d.get("components") or []:
                    if c.get("asset"):
                        c["asset"] = None
                        if (c.get("review") or {}).get("ok"):
                            c["review"] = None
            lab_update(lid, fn)
        except (ValueError, HTTPException):
            continue
    return {"deleted": n}


@app.get("/api/assets")
def assets_list():
    out = []
    for f in sorted(ASSETS_DIR.glob("*/asset.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            continue
        aid = f.parent.name
        out.append({"id": aid, "name": d["name"], "category": d["category"], "tags": d.get("tags") or [], "duration": d["duration"],
                    "url": f"/media/assets/{aid}/{d['file']}", "thumb_url": f"/media/assets/{aid}/{d['thumb']}",
                    "elements": len(d.get("elements") or []), "variants": len([v for v in d.get("variants") or [] if v.get("file")]),
                    "summary": d.get("summary", ""), "created_at": d.get("created_at")})
    return out


@app.get("/api/assets/{aid}")
def asset_get(aid: str):
    return clip_to_dict(aid, clip_load(aid))


class AssetPatchIn(BaseModel):
    name: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    notes: str | None = None


@app.patch("/api/assets/{aid}")
def asset_patch(aid: str, body: AssetPatchIn):
    def fn(d):
        if body.name is not None and body.name.strip():
            d["name"] = body.name.strip()[:120]
        if body.category in CLIP_CATS:
            d["category"] = body.category
        if body.tags is not None:
            d["tags"] = [t.strip()[:30] for t in body.tags if t.strip()][:12]
        if body.notes is not None:
            d["notes"] = body.notes.strip()[:1000]
    return clip_to_dict(aid, clip_update(aid, fn))


@app.delete("/api/assets/{aid}")
def asset_delete(aid: str):
    clip_load(aid)
    shutil.rmtree(clip_dir(aid), ignore_errors=True)
    return {"ok": True}


def run_asset_variant(aid: str, vid: str) -> None:
    def setv(**kw):
        def fn(d):
            v = next((x for x in d.get("variants") or [] if x["id"] == vid), None)
            if v is not None:
                v.update(**kw)
        clip_update(aid, fn)
    try:
        d = clip_load(aid)
        v = next(x for x in d["variants"] if x["id"] == vid)
        base = next((x for x in d["variants"] if x["id"] == v.get("base") and x.get("file")), None)
        src = clip_dir(aid) / ("variants/" + base["file"] if base else d["file"])
        out = clip_dir(aid) / "variants" / f"{vid}.mp4"
        context = {"analysis": {"summary": d.get("summary"), "background": d.get("background"), "elements": d.get("elements")}}
        vedit_render(v, src, out, context, setv)
        setv(status="done", file=out.name, step=None, error=None, duration=round(probe_duration(out), 2))
    except Exception as exc:  # noqa: BLE001
        setv(status="failed", step=None, error=str(getattr(exc, "detail", None) or exc)[:400])


@app.post("/api/assets/{aid}/variants")
def asset_variant(aid: str, body: VeditIn):
    """✏️ نسخة من الأصل: تعديل جوه المشهد (الحركة زي ما هي) أو ⏩ سرعة جزء."""
    d = clip_load(aid)
    item = vedit_item(body)
    if item["kind"] == "ai" and d["duration"] > 10.5 and not body.base:
        raise HTTPException(400, "الأصل أطول من 10 ثواني، وموديلات التعديل بتقبل لحد 10")
    clip_update(aid, lambda d: d.setdefault("variants", []).append(item))
    threading.Thread(target=run_asset_variant, args=(aid, item["id"]), daemon=True).start()
    return clip_to_dict(aid, clip_load(aid))


@app.delete("/api/assets/{aid}/variants/{vid}")
def asset_variant_delete(aid: str, vid: str):
    def fn(d):
        for v in d.get("variants") or []:
            if v["id"] == vid and v.get("file"):
                (clip_dir(aid) / "variants" / v["file"]).unlink(missing_ok=True)
        d["variants"] = [v for v in d.get("variants") or [] if v["id"] != vid]
    return clip_to_dict(aid, clip_update(aid, fn))


class AssetReviewIn(BaseModel):
    variant: str
    ok: bool | None = None
    note: str = ""


@app.patch("/api/assets/{aid}/review")
def asset_review(aid: str, body: AssetReviewIn):
    def fn(d):
        v = next((x for x in d.get("variants") or [] if x["id"] == body.variant), None)
        if v is None:
            raise HTTPException(404, "النسخة مش موجودة")
        v["review"] = {"ok": body.ok, "note": body.note.strip()[:500], "at": now()}
    return clip_to_dict(aid, clip_update(aid, fn))


# ---------- 🧪 تجربة كونيكتور: الوصفة بين لقطتين (خطة ← صور مفتاحية ← حركة بين كل صورتين ← تجميع)

TRIAL_MODELS = {
    "seedance-mini": {"label": "Seedance 2.0 Mini (الأرخص)", "model": "bytedance/seedance-2.0-mini/image-to-video", "per_sec": 0.011},
    "seedance-fast": {"label": "Seedance 2.0 Fast", "model": "bytedance/seedance-2.0-fast/image-to-video", "per_sec": 0.027},
    "seedance": {"label": "Seedance 2.0 (أجود)", "model": "bytedance/seedance-2.0/image-to-video", "per_sec": 0.09},
}
TRIAL_KEY_COST = 0.06   # صورة مفتاحية واحدة (تقريبًا)
TRIAL_CTX = 2.0         # ثواني من A قبل الكونيكتور ومن B بعده في الفيديو النهائي


def trial_dir(aid: str, tid: str) -> Path:
    return clip_dir(aid) / "trials" / Path(tid).name


def trial_set(aid: str, tid: str, **kw) -> None:
    def fn(a):
        t = next((x for x in a.get("trials") or [] if x["id"] == tid), None)
        if t is not None:
            t.update(**kw)
    clip_update(aid, fn)


def trial_cost(t: dict) -> float:
    plan = t.get("plan") or {}
    secs = sum(trial_gen_seconds(x["seconds"]) for x in plan.get("segments") or [])
    per = TRIAL_MODELS.get(t.get("model"), TRIAL_MODELS["seedance-mini"])["per_sec"] * (2 if t.get("resolution") == "720p" else 1)
    return round(len(plan.get("keyframes") or []) * TRIAL_KEY_COST + secs * per, 2)


def trial_gen_seconds(seconds: float) -> int:
    return int(min(atlas.MAX_DURATION, max(atlas.MIN_DURATION, math.ceil(seconds))))


def trial_to_dict(aid: str, t: dict) -> dict:
    base = f"/media/assets/{aid}/trials/{t['id']}"
    f = t.get("files") or {}
    url = lambda name: f"{base}/{name}" if name else None  # noqa: E731
    return {**t, "a_url": url(f.get("a")), "b_url": url(f.get("b")), "final_url": url(f.get("final")), "conn_url": url(f.get("conn")),
            "key_urls": [url(x) for x in f.get("keys") or []], "seg_urls": [url(x) for x in f.get("segs") or []],
            "cost": trial_cost(t)}


def cut_clip(src: Path, a: float, b: float, out: Path) -> Path:
    subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{a:.3f}", "-i", str(src), "-t", f"{max(0.1, b - a):.3f}",
                    "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", str(out)],
                   check=True, capture_output=True, timeout=300)
    return out


def still_at(src: Path, t: float, out: Path) -> Path:
    subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{max(0.0, t):.3f}", "-i", str(src), "-frames:v", "1",
                    "-vf", "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'", "-q:v", "2", str(out)],
                   check=True, capture_output=True, timeout=60)
    if not out.exists():
        raise HTTPException(400, "مقدرتش أطلّع الفريم ده")
    return out


def trial_side(lab_id: str, n: int | None, t: float | None, side: str) -> dict:
    """نقطة A (آخر اللقطة) أو B (أول اللقطة) من فيديو في المعمل."""
    d = lab_load(lab_id)
    dur = d["source"]["duration"]
    if n is not None:
        s = lab_shot(d, n)
        t = s["end"] - 0.04 if side == "a" else s["start"] + 0.04
        label = f"«{d.get('name')}» لقطة {n}: {(s.get('analysis') or {}).get('summary', '')}"
        lo, hi = s["start"], s["end"]
    else:
        label, lo, hi = f"«{d.get('name')}» عند {t:.2f}", 0.0, dur
    t = min(dur - 0.04, max(0.0, float(t or 0)))
    return {"lab": lab_id, "lab_name": d.get("name"), "n": n, "t": round(t, 3), "label": label[:300],
            "ctx": [round(max(lo, t - TRIAL_CTX), 3), round(t, 3)] if side == "a" else [round(t, 3), round(min(hi, t + TRIAL_CTX), 3)],
            "src": d["source"]["file"]}


class TrialSideIn(BaseModel):
    lab: str
    n: int


class TrialIn(BaseModel):
    mode: str = "rebuild"            # rebuild = نفس النقطتين في الفيديو الأصلي، transfer = لقطتين تانيين
    a: TrialSideIn | None = None
    b: TrialSideIn | None = None
    model: str = "seedance-mini"
    resolution: str = "480p"


@app.post("/api/assets/{aid}/trials")
def asset_trial_create(aid: str, body: TrialIn):
    """🧪 تجربة جديدة: بيطلّع فريم A وفريم B وبيكتب الخطة (رخيص). التوليد بيستنى موافقتك."""
    asset = clip_load(aid)
    if asset.get("category") != "connector" or not asset.get("connector"):
        raise HTTPException(400, "التجربة للكونيكتورز بس")
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل")
    src = asset.get("source") or {}
    if body.mode == "rebuild":
        if not src.get("lab") or not (lab_dir(src["lab"]) / "lab.json").exists():
            raise HTTPException(400, "الفيديو الأصلي للكونيكتور ده اتمسح من المعمل")
        a = trial_side(src["lab"], None, src["t0"], "a")
        b = trial_side(src["lab"], None, src["t1"], "b")
        a["label"], b["label"] = "قبل الكونيكتور الأصلي مباشرة", "بعد الكونيكتور الأصلي مباشرة"
    else:
        if not (body.a and body.b):
            raise HTTPException(400, "اختار اللقطة A واللقطة B")
        a, b = trial_side(body.a.lab, body.a.n, None, "a"), trial_side(body.b.lab, body.b.n, None, "b")
    tid = uuid.uuid4().hex[:8]
    folder = trial_dir(aid, tid)
    folder.mkdir(parents=True, exist_ok=True)
    still_at(lab_dir(a["lab"]) / a["src"], a["t"], folder / "a.jpg")
    still_at(lab_dir(b["lab"]) / b["src"], b["t"], folder / "b.jpg")
    t = {"id": tid, "mode": "rebuild" if body.mode == "rebuild" else "transfer", "a": a, "b": b,
         "model": body.model if body.model in TRIAL_MODELS else "seedance-mini",
         "resolution": body.resolution if body.resolution in ("480p", "720p") else "480p",
         "status": "planning", "step": "بيكتب الخطة", "error": None, "plan": None,
         "files": {"a": "a.jpg", "b": "b.jpg"}, "review": None, "created_at": now()}
    clip_update(aid, lambda x: x.setdefault("trials", []).insert(0, t))
    threading.Thread(target=run_trial_plan, args=(aid, tid), daemon=True).start()
    return clip_to_dict(aid, clip_load(aid))


def run_trial_plan(aid: str, tid: str) -> None:
    try:
        asset = clip_load(aid)
        t = next(x for x in asset["trials"] if x["id"] == tid)
        folder = trial_dir(aid, tid)
        if atlas.mock_mode():
            raw = lab.mock_trial_plan()
        else:
            text = lab.trial_plan_messages(asset["connector"], t["mode"], t["a"]["label"], t["b"]["label"])
            parts: list[dict] = [{"type": "text", "text": text}]
            imgs = [folder / "a.jpg", folder / "b.jpg"] + [clip_dir(aid) / k["file"] for k in asset.get("keyframes") or []]
            for p in imgs:
                if p.exists():
                    parts.append({"type": "image_url", "image_url": {"url": data_url(model_image(p, 768), "image/jpeg")}})
            raw = ad_json(ad_media_chat([{"role": "user", "content": parts}], 8000), "خطة الكونيكتور")
        trial_set(aid, tid, plan=lab.clean_trial_plan(raw), status="planned", step=None, error=None)
    except Exception as exc:  # noqa: BLE001
        trial_set(aid, tid, status="failed", step=None, error=str(getattr(exc, "detail", None) or exc)[:400])


class TrialPatchIn(BaseModel):
    plan: dict | None = None
    model: str | None = None
    resolution: str | None = None


@app.patch("/api/assets/{aid}/trials/{tid}")
def asset_trial_patch(aid: str, tid: str, body: TrialPatchIn):
    """تعدّل الخطة (البرومبتات والأطوال) أو الموديل قبل التوليد."""
    def fn(a):
        t = next((x for x in a.get("trials") or [] if x["id"] == tid), None)
        if t is None:
            raise HTTPException(404, "التجربة دي مش موجودة")
        if t["status"] in ("planning", "working"):
            raise HTTPException(400, "استنى لما الشغل اللي شغال يخلص")
        if body.plan is not None:
            t["plan"] = lab.clean_trial_plan({**(t.get("plan") or {}), **body.plan})
        if body.model in TRIAL_MODELS:
            t["model"] = body.model
        if body.resolution in ("480p", "720p"):
            t["resolution"] = body.resolution
    return clip_to_dict(aid, clip_update(aid, fn))


@app.post("/api/assets/{aid}/trials/{tid}/run")
def asset_trial_run(aid: str, tid: str):
    """🎬 التوليد: الصور المفتاحية، والحركة بين كل صورتين، والتجميع. بيتحسب على Atlas."""
    def fn(a):
        t = next((x for x in a.get("trials") or [] if x["id"] == tid), None)
        if t is None:
            raise HTTPException(404, "التجربة دي مش موجودة")
        if t["status"] in ("planning", "working") or not t.get("plan"):
            raise HTTPException(400, "الخطة لسه مخلصتش")
        t.update(status="working", step="بيبدأ", error=None, review=None)
    clip_update(aid, fn)
    threading.Thread(target=run_trial_gen, args=(aid, tid), daemon=True).start()
    return clip_to_dict(aid, clip_load(aid))


def nearest_ratio(w: int, h: int) -> str:
    r = w / max(1, h)
    return min(("9:16", "16:9", "1:1", "3:4", "4:3"), key=lambda k: abs(r - int(k.split(":")[0]) / int(k.split(":")[1])))


def draw_key(prompt: str, base: Path, target: Path, out: Path, size: str, i: int = 0) -> Path:
    """صورة مرحلة: تعديل على الصورة اللي قبلها، ومعاها الصورة اللي رايحين لها كمرجع."""
    if atlas.mock_mode():
        subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(base), "-vf", f"hue=h={60 * (i + 1)}",
                        str(out)], check=True, capture_output=True, timeout=60)
        return out
    prompt += ("\nIMAGE 1 is the current frame and the base to edit. IMAGE 2 is the final frame we are "
               "heading to (reference only). Keep the same framing, aspect ratio, style and every on-screen text exactly as "
               "written unless the instruction changes it.")
    atlas.download(atlas.generate_image(carousel_settings()["image_family"], prompt, size, "medium",
                                        [atlas.reference_url(base), atlas.reference_url(target)]), out)
    return out


def gen_motion(model_key: str, resolution: str, ratio: str, prompt: str, img_a: Path, img_b: Path, secs: int,
               out: Path, W: int, H: int, what: str = "حركة الكونيكتور") -> Path:
    """حركة بين صورة بداية وصورة نهاية (Seedance)."""
    if atlas.mock_mode():
        subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-t", str(secs), "-i", str(img_a),
                        "-loop", "1", "-t", str(secs), "-i", str(img_b), "-filter_complex",
                        f"[0]scale={W}:{H},setsar=1,fps=30[a];[1]scale={W}:{H},setsar=1,fps=30[b];"
                        f"[a][b]xfade=transition=fade:duration={secs - 0.5}:offset=0.25,format=yuv420p",
                        "-t", str(secs), str(out)], check=True, capture_output=True, timeout=120)
        return out
    body = {"model": TRIAL_MODELS[model_key]["model"], "prompt": prompt + " One continuous shot, no cuts, no text changes.",
            "image": atlas.reference_url(img_a), "last_image": atlas.reference_url(img_b),
            "duration": secs, "resolution": resolution, "ratio": ratio, "generate_audio": False}
    atlas.download(atlas.run_model("Video", body, what, max_seconds=1500, interval=6), out)
    return out


def chain_clips(items: list, out: Path, W: int, H: int) -> Path:
    """يلزق المقاطع ورا بعض؛ كل عنصر (مسار، معامل الطول) عشان كل حتة تاخد الطول اللي في الخطة."""
    inputs, fc = [], []
    for i, it in enumerate(items):
        p, f = (it if isinstance(it, tuple) else (it, 1.0))
        inputs += ["-i", str(p)]
        fc.append(f"[{i}:v]scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,"
                  f"fps=30,setpts={f:.4f}*(PTS-STARTPTS)[v{i}]")
    fc.append("".join(f"[v{i}]" for i in range(len(items))) + f"concat=n={len(items)}:v=1:a=0[out]")
    subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", *inputs, "-filter_complex", ";".join(fc),
                    "-map", "[out]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart", str(out)], check=True, capture_output=True, timeout=900)
    return out


def timed(p: Path, seconds: float) -> tuple:
    return (p, seconds / max(0.1, probe_duration(p)))


def run_trial_gen(aid: str, tid: str) -> None:
    def step(msg: str) -> None:
        trial_set(aid, tid, step=msg)
    try:
        asset = clip_load(aid)
        t = next(x for x in asset["trials"] if x["id"] == tid)
        plan, folder = t["plan"], trial_dir(aid, tid)
        info = media_info(folder / "a.jpg")
        W, H = info.width // 2 * 2, info.height // 2 * 2
        ratio = nearest_ratio(W, H)
        size = az.ASPECTS.get(ratio, az.ASPECTS["9:16"])[0] if ratio in az.ASPECTS else "1024x1024"
        # ١) الصور المفتاحية: كل مرحلة من اللي قبلها، ومعاها صورة النهاية عشان تعرف رايحة فين
        chain, keys = [folder / "a.jpg"], []
        for i, k in enumerate(plan["keyframes"]):
            step(f"🖼️ بيرسم المرحلة {i + 1} من {len(plan['keyframes'])}: {k['label']}")
            chain.append(draw_key(k["prompt"], chain[-1], folder / "b.jpg", folder / f"k{i + 1}.png", size, i))
            keys.append(chain[-1].name)
            trial_set(aid, tid, files={**t["files"], "keys": keys})
        chain.append(folder / "b.jpg")
        # ٢) الحركة بين كل صورتين (صورة بداية + صورة نهاية)
        segs = []
        for i, sg in enumerate(plan["segments"]):
            step(f"🎬 بيولّد الحركة {i + 1} من {len(plan['segments'])}: {sg['label']}")
            gen_motion(t["model"], t["resolution"], ratio, sg["prompt"], chain[i], chain[i + 1], trial_gen_seconds(sg["seconds"]),
                       folder / f"s{i + 1}.mp4", W, H)
            segs.append(f"s{i + 1}.mp4")
            trial_set(aid, tid, files={**t["files"], "keys": keys, "segs": segs})
        # ٣) التجميع: آخر A ← الحركات (كل واحدة على قد طولها في الخطة) ← أول B
        step("🎞️ بيجمّع")
        a_src, b_src = lab_dir(t["a"]["lab"]) / t["a"]["src"], lab_dir(t["b"]["lab"]) / t["b"]["src"]
        parts = [cut_clip(a_src, *t["a"]["ctx"], folder / "a_ctx.mp4")]
        parts += [timed(folder / name, sg["seconds"]) for name, sg in zip(segs, plan["segments"])]
        parts.append(cut_clip(b_src, *t["b"]["ctx"], folder / "b_ctx.mp4"))
        chain_clips(parts, folder / "final.mp4", W, H)
        chain_clips(parts[1:-1], folder / "conn.mp4", W, H)
        trial_set(aid, tid, status="done", step=None, error=None, done_at=now(),
                  files={"a": "a.jpg", "b": "b.jpg", "keys": keys, "segs": segs, "final": "final.mp4", "conn": "conn.mp4"})
    except Exception as exc:  # noqa: BLE001
        trial_set(aid, tid, status="failed", step=None, error=str(getattr(exc, "detail", None) or exc)[:400])


class TrialReviewIn(BaseModel):
    ok: bool | None = None
    note: str = ""


@app.patch("/api/assets/{aid}/trials/{tid}/review")
def asset_trial_review(aid: str, tid: str, body: TrialReviewIn):
    def fn(a):
        t = next((x for x in a.get("trials") or [] if x["id"] == tid), None)
        if t is None:
            raise HTTPException(404, "التجربة دي مش موجودة")
        t["review"] = {"ok": body.ok, "note": body.note.strip()[:1000], "at": now()}
    return clip_to_dict(aid, clip_update(aid, fn))


@app.delete("/api/assets/{aid}/trials/{tid}")
def asset_trial_delete(aid: str, tid: str):
    def fn(a):
        t = next((x for x in a.get("trials") or [] if x["id"] == tid), None)
        if t and t["status"] in ("planning", "working"):
            raise HTTPException(400, "استنى لما الشغل اللي شغال يخلص")
        a["trials"] = [x for x in a.get("trials") or [] if x["id"] != tid]
    d = clip_update(aid, fn)
    shutil.rmtree(trial_dir(aid, tid), ignore_errors=True)
    return clip_to_dict(aid, d)


# ---------- 🎞️ فيديو بالكونيكتورز: سيناريو مكتوب على مقاس الكونيكتورز اللي في المكتبة
# السيناريو ← فريم أول وآخر لكل مشهد ← خطة كل كونيكتور بين مشهدين ← حركة المشاهد والكونيكتورز ← تجميع

FILMS_DIR = DATA_DIR / "films"
FILMS_DIR.mkdir(parents=True, exist_ok=True)
FILM_LOCK = threading.Lock()
FILM_BUSY = ("planning", "drawing", "working")


def film_dir(fid: str) -> Path:
    return FILMS_DIR / Path(fid).name


def film_load(fid: str) -> dict:
    f = film_dir(fid) / "film.json"
    if not f.exists():
        raise HTTPException(404, "الفيديو ده مش موجود")
    return json.loads(f.read_text(encoding="utf-8"))


def film_save(fid: str, d: dict) -> None:
    d["updated_at"] = now()
    tmp = film_dir(fid) / "film.json.tmp"
    tmp.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    tmp.replace(film_dir(fid) / "film.json")


def film_update(fid: str, fn) -> dict:
    with FILM_LOCK:
        d = film_load(fid)
        fn(d)
        film_save(fid, d)
        return d


def film_set(fid: str, **kw) -> dict:
    return film_update(fid, lambda d: d.update(**kw))


def film_files(d: dict) -> dict:
    """ملفات كل مشهد وكل كونيكتور، على قد عدد المشاهد في السيناريو."""
    n = len((d.get("plan") or {}).get("scenes") or [])
    f = d.setdefault("files", {})
    f["scenes"] = (f.get("scenes") or []) + [{} for _ in range(n - len(f.get("scenes") or []))]
    f["scenes"] = f["scenes"][:n]
    f["links"] = (f.get("links") or []) + [{} for _ in range(max(0, n - 1) - len(f.get("links") or []))]
    f["links"] = f["links"][:max(0, n - 1)]
    return f


def film_conns(ids: list[str]) -> list[dict]:
    out = []
    for aid in ids:
        try:
            a = clip_load(aid)
        except HTTPException:
            continue
        if a.get("category") == "connector" and a.get("connector"):
            out.append({**a, "id": aid})
    return out


def film_link_cost(d: dict, i: int) -> float:
    lp = (d["plan"]["links"][i].get("plan") or {})
    per = TRIAL_MODELS.get(d.get("model"), TRIAL_MODELS["seedance-mini"])["per_sec"] * (2 if d.get("resolution") == "720p" else 1)
    if not lp:
        return 1 * TRIAL_KEY_COST + 2 * atlas.MIN_DURATION * per
    return len(lp.get("keyframes") or []) * TRIAL_KEY_COST + sum(trial_gen_seconds(x["seconds"]) for x in lp.get("segments") or []) * per


def film_costs(d: dict) -> dict:
    """تمن الفريمات اللي لسه متترسمتش، وتمن الفيديو (المشاهد والكونيكتورز اللي لسه متولدتش)."""
    p = d.get("plan") or {}
    if not p.get("scenes"):
        return {"frames": 0, "video": 0}
    f = film_files(json.loads(json.dumps(d)))
    per = TRIAL_MODELS.get(d.get("model"), TRIAL_MODELS["seedance-mini"])["per_sec"] * (2 if d.get("resolution") == "720p" else 1)
    frames = sum((0 if x.get("a") else 1) + (0 if x.get("b") else 1) for x in f["scenes"]) * TRIAL_KEY_COST
    video = sum(trial_gen_seconds(sc["seconds"]) * per for sc, x in zip(p["scenes"], f["scenes"]) if not x.get("video"))
    video += sum(film_link_cost(d, i) for i, x in enumerate(f["links"]) if not x.get("segs"))
    return {"frames": round(frames, 2), "video": round(video, 2)}


def film_to_dict(fid: str, d: dict) -> dict:
    base = f"/media/films/{fid}"
    folder = film_dir(fid)
    def url(name):
        if not name or not (folder / name).exists():
            return None
        return f"{base}/{name}?v={int((folder / name).stat().st_mtime)}"
    f = film_files(json.loads(json.dumps(d)))
    links = (d.get("plan") or {}).get("links") or []
    return {**d, "id": fid, "busy": d.get("status") in FILM_BUSY, "costs": film_costs(d),
            "final_url": url((d.get("files") or {}).get("final")),
            "scene_files": [{"a": url(x.get("a")), "b": url(x.get("b")), "video": url(x.get("video"))} for x in f["scenes"]],
            "link_files": [{"keys": [url(k) for k in x.get("keys") or []], "video": url(x.get("video"))} for x in f["links"]],
            "link_assets": [{"id": l.get("asset"), **({"name": a.get("name"), "url": f"/media/assets/{l['asset']}/{a['file']}",
                             "thumb_url": f"/media/assets/{l['asset']}/{a['thumb']}"} if (a := film_asset_brief(l.get("asset"))) else {})}
                            for l in links],
            "models": [{"key": k, "label": v["label"], "per_sec": v["per_sec"]} for k, v in TRIAL_MODELS.items()]}


def film_asset_brief(aid: str | None) -> dict | None:
    if not aid or not (clip_dir(aid) / "asset.json").exists():
        return None
    try:
        return clip_load(aid)
    except (HTTPException, ValueError):
        return None


@app.get("/api/films")
def films_list():
    out = []
    for f in sorted(FILMS_DIR.glob("*/film.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            continue
        if not owned(d.get("client_id")):
            continue
        fid = f.parent.name
        first = ((d.get("files") or {}).get("scenes") or [{}])[0].get("a")
        out.append({"id": fid, "name": d.get("name"), "status": d.get("status"), "scenes": len((d.get("plan") or {}).get("scenes") or []),
                    "thumb": f"/media/films/{fid}/{first}" if first else None, "created_at": d.get("created_at")})
    return out


@app.get("/api/films/{fid}")
def film_get(fid: str):
    return film_to_dict(fid, film_load(fid))


class FilmIn(BaseModel):
    name: str = ""
    brief: str = ""
    connectors: list[str] = []
    scenes: int = 0
    ratio: str = "9:16"
    model: str = "seedance-mini"
    resolution: str = "480p"


@app.post("/api/films")
def film_create(body: FilmIn):
    """🎞️ فيديو جديد: البرنامج بيكتب سيناريو على مقاس الكونيكتورز اللي اخترتها (رخيص). الرسم والتوليد بيستنوا موافقتك."""
    conns = film_conns(body.connectors)
    if not conns:
        raise HTTPException(400, "اختار كونيكتور واحد على الأقل من المكتبة")
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل")
    client = active_client() or {}
    fid = uuid.uuid4().hex[:10]
    film_dir(fid).mkdir(parents=True, exist_ok=True)
    n = body.scenes if 2 <= body.scenes <= 8 else min(8, max(3, len(conns) + 1))
    d = {"name": body.name.strip()[:120] or f"🎞️ {client.get('name') or 'فيديو'}: المميزات", "client_id": client.get("id"),
         "brief": body.brief.strip()[:3000] or f"فيديو قصير بيعرض أهم مميزات {client.get('name') or 'المنتج'}",
         "connectors": [c["id"] for c in conns], "n_scenes": n,
         "ratio": body.ratio if body.ratio in az.ASPECTS else "9:16",
         "model": body.model if body.model in TRIAL_MODELS else "seedance-mini",
         "resolution": body.resolution if body.resolution in ("480p", "720p") else "480p",
         "status": "planning", "step": "بيكتب السيناريو", "error": None, "plan": None, "files": {}, "created_at": now()}
    with FILM_LOCK:
        film_save(fid, d)
    threading.Thread(target=run_film_plan, args=(fid,), daemon=True).start()
    return film_to_dict(fid, d)


def run_film_plan(fid: str) -> None:
    try:
        d = film_load(fid)
        conns = film_conns(d["connectors"])
        brain = brain_row(d.get("client_id") or "") or active_client()
        if not conns:
            raise HTTPException(400, "الكونيكتورز اللي اخترتها اتمسحت من المكتبة")
        if atlas.mock_mode():
            raw = lab.mock_film_plan(conns, d["n_scenes"], (brain or {}).get("name") or "البراند")
        else:
            parts: list[dict] = [{"type": "text", "text": lab.film_plan_messages(az.brain_text(brain), d["brief"], conns, d["n_scenes"])}]
            for c in conns:
                for k in (c.get("keyframes") or [])[:3]:
                    p = clip_dir(c["id"]) / k["file"]
                    if p.exists():
                        parts.append({"type": "image_url", "image_url": {"url": data_url(model_image(p, 512), "image/jpeg")}})
            raw = ad_json(ad_media_chat([{"role": "user", "content": parts}], 12000), "سيناريو الفيديو")
        plan = lab.clean_film_plan(raw, [c["id"] for c in conns])
        if len(plan["scenes"]) < 2:
            raise HTTPException(400, "السيناريو طلع أقل من مشهدين. جرّب تاني")
        def fn(x):
            for f in film_dir(fid).glob("*"):
                if f.name != "film.json":
                    f.unlink(missing_ok=True)
            x.update(plan=plan, files={}, status="planned", step=None, error=None)
            if plan.get("title") and x["name"].startswith("🎞️"):
                x["name"] = "🎞️ " + plan["title"]
        film_update(fid, fn)
    except Exception as exc:  # noqa: BLE001
        film_set(fid, status="failed", step=None, error=str(getattr(exc, "detail", None) or exc)[:400])


class FilmPatchIn(BaseModel):
    name: str | None = None
    brief: str | None = None
    plan: dict | None = None
    model: str | None = None
    resolution: str | None = None


@app.patch("/api/films/{fid}")
def film_patch(fid: str, body: FilmPatchIn):
    """تعديل السيناريو (الكلام والبرومبتات والأطوال، والكونيكتور اللي بين كل مشهدين) أو الموديل."""
    def fn(d):
        if body.plan is not None and d.get("status") in FILM_BUSY:
            raise HTTPException(400, "استنى لما الشغل اللي شغال يخلص")
        if body.name is not None and body.name.strip():
            d["name"] = body.name.strip()[:120]
        if body.brief is not None:
            d["brief"] = body.brief.strip()[:3000]
        if body.model in TRIAL_MODELS:
            d["model"] = body.model
        if body.resolution in ("480p", "720p"):
            d["resolution"] = body.resolution
        if body.plan is not None and d.get("plan"):
            old = d["plan"]
            new = lab.clean_film_plan({**old, **body.plan}, [l["asset"] for l in old["links"]] + d["connectors"])
            if len(new["scenes"]) != len(old["scenes"]):
                raise HTTPException(400, "عدد المشاهد مينفعش يتغير هنا. اكتب السيناريو من جديد")
            f = film_files(d)
            for i, (a, b) in enumerate(zip(old["scenes"], new["scenes"])):
                if a["motion"] != b["motion"] or a["seconds"] != b["seconds"]:
                    f["scenes"][i].pop("video", None)
            for i, (a, b) in enumerate(zip(old["links"], new["links"])):
                lp = (body.plan.get("links") or [{}] * len(new["links"]))[i] if i < len(body.plan.get("links") or []) else {}
                if a["asset"] != b["asset"]:
                    f["links"][i] = {}      # كونيكتور تاني: الخطة بتتعمل من جديد
                    b["plan"] = None
                else:
                    b["plan"] = lab.clean_trial_plan(lp["plan"]) if isinstance(lp, dict) and lp.get("plan") else a.get("plan")
                    if b["plan"] != a.get("plan"):
                        f["links"][i] = {}
            if new != old:
                f.pop("final", None)
            d["plan"] = new
    d = film_update(fid, fn)
    return film_to_dict(fid, d)


def film_start(fid: str, status: str, step: str, target, *args) -> dict:
    def fn(d):
        if d.get("status") in FILM_BUSY:
            raise HTTPException(400, "استنى لما الشغل اللي شغال يخلص")
        if status != "planning" and not (d.get("plan") or {}).get("scenes"):
            raise HTTPException(400, "السيناريو لسه مخلصش")
        d.update(status=status, step=step, error=None)
    d = film_update(fid, fn)
    threading.Thread(target=target, args=(fid, *args), daemon=True).start()
    return film_to_dict(fid, d)


@app.post("/api/films/{fid}/replan")
def film_replan(fid: str):
    """✍️ سيناريو جديد من الأول (الفريمات والفيديوهات القديمة بتتمسح)."""
    return film_start(fid, "planning", "بيكتب السيناريو", run_film_plan)


class FilmFrameIn(BaseModel):
    note: str = ""


@app.post("/api/films/{fid}/frames")
def film_frames(fid: str):
    """🖼️ يرسم الفريمات اللي لسه متترسمتش (أول وآخر كل مشهد) ويكتب خطة كل كونيكتور."""
    return film_start(fid, "drawing", "بيبدأ يرسم", run_film_frames, None, "")


@app.post("/api/films/{fid}/scenes/{i}/{which}")
def film_frame_redo(fid: str, i: int, which: str, body: FilmFrameIn):
    """↻ يرسم فريم واحد تاني (ولو فيه ملاحظة بيعدّل عليه بيها). لو أول المشهد اترسم، آخره بيترسم معاه."""
    if which not in ("a", "b"):
        raise HTTPException(400, "a أو b")
    d = film_load(fid)
    if not 0 <= i < len((d.get("plan") or {}).get("scenes") or []):
        raise HTTPException(404, "المشهد ده مش موجود")
    return film_start(fid, "drawing", "بيرسم", run_film_frames, (i, which), body.note.strip()[:1000])


def film_frame_prompt(d: dict, brain: dict | None, sc: dict, i: int, has_ref: bool, has_style: bool) -> str:
    p = d["plan"]
    parts = [f"A {d['ratio']} frame (scene {i + 1} of {len(p['scenes'])}) of a short premium motion-graphics promo video"
             + (f" for {brain['name']}" if brain and brain.get("name") else "") + ".",
             az.brain_header(brain), f"Color palette: {brain['palette']}" if brain and brain.get("palette") else "",
             f"Video concept: {p.get('idea')}" if p.get("idea") else "",
             f"SCENE: {sc['start']}",
             f'ON-SCREEN TEXT (write it exactly as given, correct Arabic letters joined right-to-left, nothing else written): "{sc["text"]}"'
             if sc.get("text") else "No on-screen text except what the brand asset itself contains.",
             "IMAGE 1 is the REAL brand asset: put it into the frame exactly as it is (same screen content, layout, logo, colors, text)."
             if has_ref else "",
             f"IMAGE {2 if has_ref else 1} is the previous scene of the same video: match its visual style, rendering, colors and typography "
             "(not its content)." if has_style else ""]
    return "\n".join(x for x in parts if x)


def film_brain_ref(brain: dict | None, name: str) -> Path | None:
    if not brain or not name:
        return None
    for kind in ("screens", "logos", "products", "characters", "sets", "props"):
        for a in brain.get(kind) or []:
            if name in (a.get("name"), a.get("file")):
                p = brain_dir(brain["id"]) / a["file"]
                return p if p.exists() else None
    return None


def film_mock_image(out: Path, ratio: str, i: int) -> Path:
    w, h = {"9:16": (576, 1024), "16:9": (1024, 576), "1:1": (768, 768)}.get(ratio, (576, 1024))
    colors = ["0x57B8AF", "0xEEECDA", "0x2F3437", "0xE07A5F", "0x81B29A", "0xF2CC8F", "0x3D405B", "0x9C89B8"]
    subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", f"color=c={colors[i % 8]}:s={w}x{h}",
                    "-frames:v", "1", str(out)], check=True, capture_output=True, timeout=60)
    return out


def film_plan_link(fid: str, i: int) -> None:
    """خطة الكونيكتور بين آخر المشهد i وأول المشهد i+1 (بنفس طريقة تجارب الكونيكتور)."""
    d = film_load(fid)
    p, folder = d["plan"], film_dir(fid)
    link = p["links"][i]
    asset = film_asset_brief(link.get("asset"))
    if not asset or not asset.get("connector"):
        raise HTTPException(400, f"الكونيكتور اللي بين المشهد {i + 1} و{i + 2} اتمسح من المكتبة. اختار غيره")
    a_img, b_img = folder / f"sc{i + 1}_b.png", folder / f"sc{i + 2}_a.png"
    if atlas.mock_mode():
        raw = lab.mock_trial_plan()
    else:
        sa, sb = p["scenes"][i], p["scenes"][i + 1]
        text = lab.trial_plan_messages(asset["connector"], "transfer", f"آخر المشهد «{sa['label']}» ({sa['feature']})",
                                       f"أول المشهد «{sb['label']}» ({sb['feature']})")
        if link.get("why"):
            text += f"\n\nليه الكونيكتور ده هنا: {link['why']}"
        parts: list[dict] = [{"type": "text", "text": text}]
        imgs = [a_img, b_img] + [clip_dir(link["asset"]) / k["file"] for k in asset.get("keyframes") or []]
        for x in imgs:
            if x.exists():
                parts.append({"type": "image_url", "image_url": {"url": data_url(model_image(x, 768), "image/jpeg")}})
        raw = ad_json(ad_media_chat([{"role": "user", "content": parts}], 8000), "خطة الكونيكتور")
    lp = lab.clean_trial_plan(raw)
    def fn(x):
        x["plan"]["links"][i]["plan"] = lp
        film_files(x)["links"][i] = {}
        (x.get("files") or {}).pop("final", None)
    film_update(fid, fn)


def run_film_frames(fid: str, only: tuple | None, note: str) -> None:
    """يرسم الفريمات. أول المشهد من البرومبت (ومعاه أصل العميل والمشهد اللي قبله كستايل)، وآخره تعديل على أوله."""
    try:
        d = film_load(fid)
        p, folder = d["plan"], film_dir(fid)
        brain = brain_row(d.get("client_id") or "") or active_client()
        size = az.ASPECTS.get(d["ratio"], az.ASPECTS["9:16"])[0]
        family = carousel_settings()["image_family"]
        f = film_files(d)
        todo = []
        for i in range(len(p["scenes"])):
            if only is None:
                todo += [(i, w) for w in ("a", "b") if not f["scenes"][i].get(w)]
            elif only[0] == i:
                todo += [(i, "a"), (i, "b")] if only[1] == "a" else [(i, "b")]
        changed = set()
        for n, (i, w) in enumerate(todo):
            sc = p["scenes"][i]
            film_set(fid, step=f"🖼️ بيرسم {'أول' if w == 'a' else 'آخر'} المشهد {i + 1} ({n + 1} من {len(todo)}): {sc['label']}")
            out = folder / f"sc{i + 1}_{w}.png"
            if atlas.mock_mode():
                film_mock_image(out, d["ratio"], i * 2 + (w == "b"))
            elif w == "a":
                old = folder / f"sc{i + 1}_a.png"
                if note and only and old.exists():
                    refs, prompt = [old], (f"Edit this frame: {note}\nKeep everything else identical (layout, style, on-screen text).")
                else:
                    ref = film_brain_ref(brain, sc.get("screen"))
                    style = folder / f"sc{i}_a.png" if i > 0 else None
                    refs = [x for x in (ref, style) if x and x.exists()]
                    prompt = film_frame_prompt(d, brain, sc, i, bool(ref and ref.exists()), bool(style and style.exists()))
                atlas.download(atlas.generate_image(family, prompt, size, "medium", [atlas.reference_url(x) for x in refs]), out)
            else:
                prompt = (f"IMAGE 1 is the FIRST frame of this scene. Draw the LAST frame of the same scene: {sc['end']}"
                          + (f"\nAlso: {note}" if note and only and only[1] == "b" else "")
                          + "\nKeep the exact same visual style, framing, aspect ratio, colors and on-screen text unless the instruction changes them.")
                atlas.download(atlas.generate_image(family, prompt, size, "medium", [atlas.reference_url(folder / f"sc{i + 1}_a.png")]), out)
            changed.add(i)
            def fn(x, i=i, w=w):
                fx = film_files(x)
                fx["scenes"][i][w] = f"sc{i + 1}_{w}.png"
                fx["scenes"][i].pop("video", None)
                x["files"].pop("final", None)
            film_update(fid, fn)
        # الكونيكتورز اللي فريماتها اتغيرت (أو لسه ملهاش خطة) بتتخطط
        d = film_load(fid)
        for i, link in enumerate(d["plan"]["links"]):
            ok = (folder / f"sc{i + 1}_b.png").exists() and (folder / f"sc{i + 2}_a.png").exists()
            if ok and (i in changed or i + 1 in changed or not link.get("plan")):
                film_set(fid, step=f"🧠 بيخطط الكونيكتور {i + 1} من {len(d['plan']['links'])}")
                film_plan_link(fid, i)
        film_set(fid, status="drawn", step=None, error=None)
    except Exception as exc:  # noqa: BLE001
        film_set(fid, status="failed", step=None, error=str(getattr(exc, "detail", None) or exc)[:400])


@app.post("/api/films/{fid}/links/{i}/plan")
def film_link_replan(fid: str, i: int):
    """🧠 خطة جديدة للكونيكتور اللي بين مشهدين."""
    d = film_load(fid)
    if not 0 <= i < len((d.get("plan") or {}).get("links") or []):
        raise HTTPException(404, "الكونيكتور ده مش موجود")
    def job(fid, i):
        try:
            film_plan_link(fid, i)
            film_set(fid, status="drawn", step=None, error=None)
        except Exception as exc:  # noqa: BLE001
            film_set(fid, status="failed", step=None, error=str(getattr(exc, "detail", None) or exc)[:400])
    return film_start(fid, "drawing", f"🧠 بيخطط الكونيكتور {i + 1}", job, i)


class FilmRunIn(BaseModel):
    kind: str | None = None      # scene / link: يولّد الحتة دي تاني بس
    i: int | None = None


@app.post("/api/films/{fid}/run")
def film_run(fid: str, body: FilmRunIn):
    """🎬 يولّد اللي لسه متولدش (أو حتة واحدة تاني) ويجمّع الفيديو. بيتحسب على Atlas."""
    d = film_load(fid)
    f = film_files(d)
    if any(not (x.get("a") and x.get("b")) for x in f["scenes"]):
        raise HTTPException(400, "ارسم الفريمات الأول")
    if any(not l.get("plan") for l in d["plan"]["links"]):
        raise HTTPException(400, "فيه كونيكتور لسه ملوش خطة")
    only = (body.kind, body.i) if body.kind in ("scene", "link") and body.i is not None else None
    return film_start(fid, "working", "بيبدأ", run_film_gen, only)


def run_film_gen(fid: str, only: tuple | None) -> None:
    try:
        d = film_load(fid)
        p, folder = d["plan"], film_dir(fid)
        err = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", str(folder / "sc1_a.png")], capture_output=True, text=True).stderr
        m = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", err)
        if not m:
            raise HTTPException(400, "مقدرتش أقرا مقاس أول فريم. ارسمه تاني")
        W, H = int(m.group(1)) // 2 * 2, int(m.group(2)) // 2 * 2
        ratio = az.ASPECTS.get(d["ratio"], az.ASPECTS["9:16"])[1]
        size = az.ASPECTS.get(d["ratio"], az.ASPECTS["9:16"])[0]
        f = film_files(d)
        n = len(p["scenes"])
        for i, sc in enumerate(p["scenes"]):
            if f["scenes"][i].get("video") and only != ("scene", i):   # اللي اتولد قبل كده بيفضل، إلا الحتة اللي طالبها تاني
                continue
            film_set(fid, step=f"🎬 بيولّد المشهد {i + 1} من {n}: {sc['label']}")
            gen_motion(d["model"], d["resolution"], ratio, sc["motion"], folder / f"sc{i + 1}_a.png", folder / f"sc{i + 1}_b.png",
                       trial_gen_seconds(sc["seconds"]), folder / f"sc{i + 1}.mp4", W, H, "حركة المشهد")
            film_update(fid, lambda x, i=i: film_files(x)["scenes"][i].update(video=f"sc{i + 1}.mp4"))
        for i, link in enumerate(p["links"]):
            if f["links"][i].get("segs") and only != ("link", i):
                continue
            lp = link["plan"]
            chain, keys = [folder / f"sc{i + 1}_b.png"], []
            for j, k in enumerate(lp["keyframes"]):
                film_set(fid, step=f"🖼️ الكونيكتور {i + 1}: بيرسم المرحلة {j + 1}: {k['label']}")
                chain.append(draw_key(k["prompt"], chain[-1], folder / f"sc{i + 2}_a.png", folder / f"L{i + 1}_k{j + 1}.png", size, j))
                keys.append(chain[-1].name)
            chain.append(folder / f"sc{i + 2}_a.png")
            segs = []
            for j, sg in enumerate(lp["segments"]):
                film_set(fid, step=f"🔗 الكونيكتور {i + 1}: بيولّد الحركة {j + 1} من {len(lp['segments'])}: {sg['label']}")
                gen_motion(d["model"], d["resolution"], ratio, sg["prompt"], chain[j], chain[j + 1], trial_gen_seconds(sg["seconds"]),
                           folder / f"L{i + 1}_s{j + 1}.mp4", W, H)
                segs.append(f"L{i + 1}_s{j + 1}.mp4")
            chain_clips([timed(folder / x, sg["seconds"]) for x, sg in zip(segs, lp["segments"])], folder / f"L{i + 1}.mp4", W, H)
            film_update(fid, lambda x, i=i, keys=keys, segs=segs: film_files(x)["links"].__setitem__(
                i, {"keys": keys, "segs": segs, "video": f"L{i + 1}.mp4"}))
        # التجميع: مشهد ← كونيكتور ← مشهد ...
        film_set(fid, step="🎞️ بيجمّع الفيديو")
        d = film_load(fid)
        parts = []
        for i, sc in enumerate(p["scenes"]):
            parts.append(timed(folder / f"sc{i + 1}.mp4", sc["seconds"]))
            if i < n - 1:
                parts.append(folder / f"L{i + 1}.mp4")
        chain_clips(parts, folder / "film.mp4", W, H)
        def fn(x):
            film_files(x)
            x["files"]["final"] = "film.mp4"
            x.update(status="done", step=None, error=None, done_at=now())
        film_update(fid, fn)
    except Exception as exc:  # noqa: BLE001
        film_set(fid, status="failed", step=None, error=str(getattr(exc, "detail", None) or exc)[:400])


@app.delete("/api/films/{fid}")
def film_delete(fid: str):
    d = film_load(fid)
    if d.get("status") in FILM_BUSY:
        raise HTTPException(400, "استنى لما الشغل اللي شغال يخلص")
    shutil.rmtree(film_dir(fid), ignore_errors=True)
    return {"ok": True}


def reset_stuck_films() -> None:
    for f in FILMS_DIR.glob("*/film.json"):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            continue
        if d.get("status") in FILM_BUSY:
            d.update(status="failed", step=None, error="اتقطع لما السيرفر اتقفل. دوس الزرار تاني")
            f.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")


reset_stuck_films()


def reset_stuck_assets() -> None:
    for f in ASSETS_DIR.glob("*/asset.json"):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            continue
        bad = [v for v in d.get("variants") or [] if v.get("status") == "working"]
        bad += [t for t in d.get("trials") or [] if t.get("status") in ("planning", "working")]
        for v in bad:
            v.update(status="failed", step=None, error="اتقطع لما السيرفر اتقفل. اعمله تاني")
        if bad:
            f.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")


reset_stuck_assets()


def reset_stuck_lab() -> None:
    for f in LAB_DIR.glob("*/lab.json"):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            continue
        changed = False
        for v in (d.get("steps") or {}).values():
            if v.get("status") in ("working", "queued"):
                v.update(status="failed", error="اتقطع لما السيرفر اتقفل. دوس «فكّك تاني»")
                changed = True
        if changed:
            f.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")


reset_stuck_lab()


class SeriesSettingsIn(BaseModel):
    text_model: str | None = None
    video_model: str | None = None


@app.put("/api/series-settings")
def save_series_settings(body: SeriesSettingsIn):
    if body.text_model is not None:
        auth.set_setting("series_text_model", body.text_model.strip() or None)
    if body.video_model is not None:
        auth.set_setting("series_video_model", body.video_model.strip() or None)
    return series_settings()


@app.get("/")
@app.get("/index.html")
def index():
    return html_page("index.html")


app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="frontend")
