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
from datetime import datetime, timezone
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
import publisher  # noqa: E402
import sheets  # noqa: E402
import carousel as cz  # noqa: E402
import series as sz  # noqa: E402
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
SERIES_DIR = DATA_DIR / "series"  # المسلسلات: صور الشخصية، وصوت ولقطات كل حلقة
BRAND_REFS_DIR = DATA_DIR / "brand" / "refs"  # (قديم) صور الشخصيات، اتنقلت لمكتبة الكاروسيل
LIBRARY_DIR = DATA_DIR / "brand" / "library"  # مكتبة الكاروسيل: تيمبليتس وشخصيات
DB_PATH = DATA_DIR / "studiomania.db"
FRONTEND_DIR = ROOT / "frontend"
FONTS_DIR = ROOT / "fonts"

for d in (RAW_DIR, CLIPS_DIR, COACHES_DIR, GENERATED_DIR, AUDIO_DIR, EXPORTS_DIR, BRAND_DIR, TMP_DIR, CAROUSELS_DIR, BRAND_REFS_DIR, LIBRARY_DIR, SERIES_DIR):
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
        "model_label": atlas.MODEL_LABEL if r["model"] == atlas.MODEL else r["model"].split("/")[1],
        "prompt": r["prompt"],
        "params": json.loads(r["params"]),
        "status": r["status"],
        "error": r["error"],
        "output_url": f"/media/generated/{r['output_filename']}" if r["output_filename"] else None,
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
        rows = conn.execute("SELECT * FROM generations WHERE clip_id NOT LIKE 'series:%' ORDER BY created_at DESC, clip_label").fetchall()
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


def project_to_dict(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "name": r["name"],
        "data": json.loads(r["data"]),
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
        get_project(conn, project_id)
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

LOGO_DEFAULTS = {"enabled": True, "size": 18, "x": 92, "y": 4, "opacity": 0.9, "on_outro": True}


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


def logo_path() -> Path | None:
    name = auth.get_setting("logo")
    path = BRAND_DIR / name if name else None
    return path if path and path.exists() else None


@app.get("/api/logo")
def get_logo():
    path = logo_path()
    return {"url": f"/media/brand/{path.name}" if path else None}


@app.post("/api/logo")
def upload_logo(file: UploadFile = File(...)):
    old = logo_path()
    filename = save_upload(file, IMAGE_EXTENSIONS, BRAND_DIR, "logo")
    auth.set_setting("logo", filename)
    if old:
        old.unlink(missing_ok=True)
    return get_logo()


@app.delete("/api/logo")
def delete_logo():
    old = logo_path()
    auth.set_setting("logo", None)
    if old:
        old.unlink(missing_ok=True)
    return {"url": None}


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
app.mount("/media/brand", StaticFiles(directory=BRAND_DIR), name="brand")
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


def brand_settings() -> dict:
    try:
        saved = json.loads(auth.get_setting("brand") or "{}")
    except ValueError:
        saved = {}
    if saved.get("style") in cz.OLD_DEFAULT_STYLES:
        saved.pop("style")  # الستايل القديم اتغيّر بالهوية الرسمية
    return {**cz.DEFAULT_BRAND, **{k: v for k, v in saved.items() if k in cz.DEFAULT_BRAND and v}}


def cta_list() -> list[dict]:
    try:
        saved = json.loads(auth.get_setting("carousel_ctas") or "null")
    except ValueError:
        saved = None
    return saved if isinstance(saved, list) and saved else cz.DEFAULT_CTAS


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
    if body.brand is not None:
        clean = {k: str(v).strip()[:2000] for k, v in body.brand.items() if k in cz.DEFAULT_BRAND}
        auth.set_setting("brand", json.dumps(clean, ensure_ascii=False))
    if body.ctas is not None:
        ctas, seen = [], set()
        for c in body.ctas:
            cid = re.sub(r"[^a-z0-9_]", "", str(c.get("id") or "").lower())[:20] or uuid.uuid4().hex[:6]
            label, text = str(c.get("label") or "").strip()[:60], str(c.get("text") or "").strip()[:300]
            if label and text and cid not in seen and cid not in ("auto", "custom"):
                seen.add(cid)
                ctas.append({"id": cid, "label": label, "text": text})
        auth.set_setting("carousel_ctas", json.dumps(ctas, ensure_ascii=False) if ctas else None)
    return get_carousel_settings()


@app.post("/api/carousel/test-model")
def test_text_model():
    """بيتأكد إن موديل الكلام شغال بمفتاح Atlas، وبيرجّع جملة تجريبية باللهجة السعودية."""
    if atlas.mock_mode():
        return {"ok": True, "reply": "هلا والله، أنا جاهز نشتغل على الكاروسيل 👌"}
    try:
        reply = atlas.chat(
            [{"role": "user", "content": "قل جملة ترحيب قصيرة باللهجة السعودية لمتابعين حساب لياقة."}],
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
    if isinstance(manifest.get("brand"), dict):
        current = json.loads(auth.get_setting("brand") or "{}")
        current.update({k: str(v) for k, v in manifest["brand"].items() if k in cz.DEFAULT_BRAND})
        auth.set_setting("brand", json.dumps(current, ensure_ascii=False))
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
                     (cid, name, json.dumps(new_carousel_data()), now(), now()))
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
    """كل الاختيارات اختيارية: من غير حاجة بيرسم بستايل كوتشي وشخصيات جديدة."""
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
                     (sid, body.name.strip() or "مسلسل جديد", json.dumps(new_series_data()), now(), now()))
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
        pdata = {"name": label, "video_id": None, "coach_id": None, "clips": clips,
                 "voice": {"id": vid, "volume": 1.0, "delay": 0.0, "offset": 0.0, "length": None, "fade_out": False, "parts": []},
                 "music": None, "outro": False, "outro_volume": 1.0, "captions": {}, "logo": {}}
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
