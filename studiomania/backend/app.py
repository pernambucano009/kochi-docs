"""StudioMania backend.

الخطوة 1: مكتبة الفيديوهات الخام وتقطيعها لقطع (كل قطعة 15 ثانية أو أقل).
الخطوة 2: توليد فيديوهات بـ Seedance عن طريق Atlas Cloud.
الخطوة 4: مكتبة المدربين (الصورة والأوترو).
"""

import json
import os
import re
import shutil
import sqlite3
import subprocess
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi import Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
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
import montage  # noqa: E402
import publisher  # noqa: E402
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
DB_PATH = DATA_DIR / "studiomania.db"
FRONTEND_DIR = ROOT / "frontend"

for d in (RAW_DIR, CLIPS_DIR, COACHES_DIR, GENERATED_DIR, AUDIO_DIR, EXPORTS_DIR):
    d.mkdir(parents=True, exist_ok=True)


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
    }


def get_video(conn: sqlite3.Connection, video_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "الفيديو غير موجود")
    return row


def clips_count(conn: sqlite3.Connection, video_id: str) -> int:
    return conn.execute("SELECT COUNT(*) FROM clips WHERE video_id = ?", (video_id,)).fetchone()[0]


init_db()
auth = Auth(DB_PATH, DATA_DIR)
app = FastAPI(title="StudioMania")

# الصفحات والملفات اللي بتفتح من غير دخول
PUBLIC_PATHS = {"/login", "/login.html", "/style.css", "/health", "/api/auth/state", "/api/auth/login", "/api/auth/setup"}


@app.middleware("http")
async def require_login(request: Request, call_next):
    path = request.url.path
    if path in PUBLIC_PATHS or auth.valid_token(request.cookies.get(SESSION_COOKIE)):
        return await call_next(request)
    if path.startswith("/api/"):
        return JSONResponse({"detail": "لازم تسجّل دخول"}, status_code=401)
    return RedirectResponse("/login")


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/login")
def login_page():
    return FileResponse(FRONTEND_DIR / "login.html")


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


@app.post("/api/videos")
def upload_video(file: UploadFile = File(...)):
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
        return video_row_to_dict(get_video(conn, video_id), 0)


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


@app.delete("/api/videos/{video_id}")
def delete_video(video_id: str):
    with closing(db()) as conn, conn:
        row = get_video(conn, video_id)
        for clip in conn.execute("SELECT filename FROM clips WHERE video_id = ?", (video_id,)):
            (CLIPS_DIR / clip["filename"]).unlink(missing_ok=True)
        conn.execute("DELETE FROM videos WHERE id = ?", (video_id,))
        (RAW_DIR / row["filename"]).unlink(missing_ok=True)
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
        "SELECT c.*, v.name AS video_name FROM clips c JOIN videos v ON v.id = c.video_id"
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


def coach_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "image_url": f"/media/coaches/{row['image_filename']}",
        "outro_url": f"/media/coaches/{row['outro_filename']}" if row["outro_filename"] else None,
        "outro_duration": row["outro_duration"],
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


@app.post("/api/coaches")
def create_coach(
    name: str = Form(...),
    image: UploadFile = File(...),
    outro: UploadFile | None = File(None),
):
    name = name.strip()
    if not name:
        raise HTTPException(400, "اكتب اسم المدرب")
    coach_id = uuid.uuid4().hex[:12]
    image_filename = save_upload(image, IMAGE_EXTENSIONS, COACHES_DIR, f"{coach_id}_image")
    outro_filename, outro_duration = save_outro(outro, coach_id) if outro and outro.filename else (None, None)
    with closing(db()) as conn, conn:
        conn.execute(
            "INSERT INTO coaches (id, name, image_filename, outro_filename, outro_duration, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (coach_id, name, image_filename, outro_filename, outro_duration, now()),
        )
        return coach_to_dict(get_coach(conn, coach_id))


@app.patch("/api/coaches/{coach_id}")
def update_coach(
    coach_id: str,
    name: str | None = Form(None),
    image: UploadFile | None = File(None),
    outro: UploadFile | None = File(None),
    remove_outro: bool = Form(False),
):
    with closing(db()) as conn, conn:
        row = get_coach(conn, coach_id)
        old_files = []
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


@app.delete("/api/coaches/{coach_id}")
def delete_coach(coach_id: str):
    with closing(db()) as conn, conn:
        row = get_coach(conn, coach_id)
        conn.execute("DELETE FROM coaches WHERE id = ?", (coach_id,))
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
    coach_id: str
    prompt_id: str
    generate_audio: bool = False


@app.post("/api/generations")
def create_generations(body: GenerationIn):
    if not (atlas.api_key() or atlas.mock_mode()):
        raise HTTPException(400, "مفتاح Atlas مش متسجل. ضيف ATLASCLOUD_API_KEY في ملف .env وشغّل البرنامج تاني")
    if not body.clip_ids:
        raise HTTPException(400, "اختار قطعة واحدة على الأقل")

    with closing(db()) as conn, conn:
        coach = get_coach(conn, body.coach_id)
        prompt_text = get_prompt(conn, body.prompt_id)["text"]
        rows = conn.execute(
            f"SELECT c.*, v.name AS video_name FROM clips c JOIN videos v ON v.id = c.video_id "
            f"WHERE c.id IN ({','.join('?' * len(body.clip_ids))})",
            body.clip_ids,
        ).fetchall()
        if len(rows) != len(set(body.clip_ids)):
            raise HTTPException(400, "فيه قطع مش موجودة. حدّث الصفحة")
        short = [f"{r['video_name']} #{r['idx']}" for r in rows if r["end"] - r["start"] < MIN_REFERENCE_SECONDS]
        if short:
            raise HTTPException(400, f"قطع أقصر من {MIN_REFERENCE_SECONDS:g} ثانية ومينفعش تتبعت: {', '.join(short)}")

        ids = []
        for r in rows:
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
                "model, prompt, params, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)",
                (
                    gen_id, r["id"], r["filename"], f"{r['video_name']} #{r['idx']}",
                    coach["id"], coach["name"], coach["image_filename"],
                    atlas.MODEL, prompt_text, json.dumps(params), now(), now(),
                ),
            )
            ids.append(gen_id)
    for gen_id in ids:
        executor.submit(run_generation, gen_id)
    return {"created": len(ids)}


@app.get("/api/generations")
def list_generations():
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM generations ORDER BY created_at DESC, clip_label").fetchall()
    return [generation_to_dict(r) for r in rows]


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
    filename = save_upload(file, AUDIO_EXTENSIONS, AUDIO_DIR, f"{kind}_{audio_id}")
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
    (AUDIO_DIR / row["filename"]).unlink(missing_ok=True)
    return {"ok": True}


# ---------------------------------------------------------------- المونتاج (الخطوة 6)

_probe_cache: dict[str, montage.MediaInfo] = {}


def media_info(path: Path) -> montage.MediaInfo:
    key = f"{path}:{path.stat().st_mtime}"
    if key not in _probe_cache:
        _probe_cache[key] = montage.probe(ffmpeg_exe(), path)
    return _probe_cache[key]


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
            }
        )
    return out


class ClipEdit(BaseModel):
    gen_id: str
    start: float = 0
    end: float | None = None
    zoom: float = 1.0
    x: float = 0.0
    y: float = 0.0
    volume: float = 1.0


class TrackEdit(BaseModel):
    id: str
    volume: float = 1.0
    delay: float = 0.0
    offset: float = 0.0
    fade_out: bool = True


class ProjectIn(BaseModel):
    name: str
    coach_id: str | None = None
    clips: list[ClipEdit] = []
    voice: TrackEdit | None = None
    music: TrackEdit | None = None
    outro: bool = True
    outro_volume: float = 1.0


def project_to_dict(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "name": r["name"],
        "data": json.loads(r["data"]),
        "render_status": r["render_status"],
        "render_error": r["render_error"],
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
    with closing(db()) as conn:
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


def build_montage(conn: sqlite3.Connection, data: dict) -> tuple[list, montage.AudioTrack | None, montage.AudioTrack | None]:
    """يحوّل بيانات المشروع لقطع ومسارات صوت جاهزة لـ FFmpeg، ويتأكد إن كل حاجة موجودة."""
    ff = ffmpeg_exe()
    segments = []
    for i, c in enumerate(data["clips"], start=1):
        g = conn.execute("SELECT output_filename FROM generations WHERE id = ?", (c["gen_id"],)).fetchone()
        if g is None or not g["output_filename"] or not (GENERATED_DIR / g["output_filename"]).exists():
            raise HTTPException(400, f"الفيديو رقم {i} اتمسح. شيله من المونتاج")
        path = GENERATED_DIR / g["output_filename"]
        info = media_info(path)
        start = clamp(c["start"], 0, info.duration)
        end = clamp(c["end"] if c["end"] is not None else info.duration, 0, info.duration)
        if end - start < 0.3:
            raise HTTPException(400, f"الفيديو رقم {i} مقصوص لدرجة إنه أقل من ثانية")
        segments.append(
            montage.Segment(
                path, start, end,
                zoom=clamp(c["zoom"], 1, 4), x=clamp(c["x"], -1, 1), y=clamp(c["y"], -1, 1),
                volume=clamp(c["volume"], 0, 3), has_audio=info.has_audio,
            )
        )
    if not segments:
        raise HTTPException(400, "ضيف فيديو واحد على الأقل للمونتاج")

    if data.get("outro") and data.get("coach_id"):
        coach = conn.execute("SELECT outro_filename FROM coaches WHERE id = ?", (data["coach_id"],)).fetchone()
        if coach and coach["outro_filename"]:
            path = COACHES_DIR / coach["outro_filename"]
            info = media_info(path)
            segments.append(
                montage.Segment(path, 0, info.duration, volume=clamp(data.get("outro_volume", 1), 0, 3), has_audio=info.has_audio)
            )

    def track(t: dict | None, kind: str) -> montage.AudioTrack | None:
        if not t:
            return None
        row = conn.execute("SELECT filename FROM audio WHERE id = ? AND kind = ?", (t["id"], kind)).fetchone()
        if row is None:
            raise HTTPException(400, "ملف الصوت المختار اتمسح من المكتبة")
        return montage.AudioTrack(
            AUDIO_DIR / row["filename"], volume=clamp(t["volume"], 0, 3),
            delay=max(0, t["delay"]), offset=max(0, t["offset"]), fade_out=t["fade_out"],
        )

    return segments, track(data.get("voice"), "voice"), track(data.get("music"), "music")


def run_render(project_id: str, export_id: str, cmd: list[str], total: float, name: str) -> None:
    filename = f"{export_id}.mp4"
    result = subprocess.run(cmd, capture_output=True, text=True)
    with closing(db()) as conn, conn:
        if result.returncode != 0:
            (EXPORTS_DIR / filename).unlink(missing_ok=True)
            conn.execute(
                "UPDATE projects SET render_status = 'failed', render_error = ?, updated_at = ? WHERE id = ?",
                (f"FFmpeg: {result.stderr.strip()[-400:]}", now(), project_id),
            )
            return
        conn.execute(
            "INSERT INTO exports (id, name, filename, duration, source, project_id, created_at) VALUES (?, ?, ?, ?, 'studio', ?, ?)",
            (export_id, name, filename, total, project_id, now()),
        )
        conn.execute(
            "UPDATE projects SET render_status = 'done', render_error = NULL, export_id = ?, updated_at = ? WHERE id = ?",
            (export_id, now(), project_id),
        )


render_executor = ThreadPoolExecutor(max_workers=1)


@app.post("/api/projects/{project_id}/render")
def render_project(project_id: str):
    with closing(db()) as conn, conn:
        row = get_project(conn, project_id)
        if row["render_status"] == "rendering":
            raise HTTPException(400, "المشروع بيتصدّر بالفعل")
        data = json.loads(row["data"])
        segments, voice, music = build_montage(conn, data)
        export_id = uuid.uuid4().hex[:12]
        cmd, total = montage.build_command(ffmpeg_exe(), segments, EXPORTS_DIR / f"{export_id}.mp4", voice, music)
        conn.execute(
            "UPDATE projects SET render_status = 'rendering', render_error = NULL, updated_at = ? WHERE id = ?",
            (now(), project_id),
        )
    render_executor.submit(run_render, project_id, export_id, cmd, total, row["name"])
    return {"ok": True, "duration": total}


def export_to_dict(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "name": r["name"],
        "url": f"/media/exports/{r['filename']}",
        "duration": r["duration"],
        "source": r["source"],
        "project_id": r["project_id"],
        "created_at": r["created_at"],
    }


@app.get("/api/exports")
def list_exports():
    with closing(db()) as conn:
        return [export_to_dict(r) for r in conn.execute("SELECT * FROM exports ORDER BY created_at DESC")]


def reset_stuck_renders() -> None:
    """التصدير بيضيع لو البرنامج اتقفل في النص، فنعلّمه كفاشل."""
    with closing(db()) as conn, conn:
        conn.execute(
            "UPDATE projects SET render_status = 'failed', render_error = 'البرنامج اتقفل أثناء التصدير. صدّر تاني' "
            "WHERE render_status = 'rendering'"
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
    return {
        "id": r["id"],
        "export_id": r["export_id"],
        "export_name": r["export_name"],
        "export_url": f"/media/exports/{r['export_filename']}" if r["export_filename"] else None,
        "caption": r["caption"],
        "platforms": json.loads(r["platforms"]),
        "scheduled_at": r["scheduled_at"],
        "status": r["status"],
        "error": r["error"],
        "published_at": r["published_at"],
        "sent": bool(r["remote_id"]),
    }


POSTS_QUERY = (
    "SELECT p.*, e.name AS export_name, e.filename AS export_filename, e.source AS export_source "
    "FROM posts p LEFT JOIN exports e ON e.id = p.export_id"
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


class PostIn(BaseModel):
    export_id: str
    caption: str = ""
    platforms: list[str]
    scheduled_at: datetime  # من المتصفح بتوقيت UTC


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
        )
        set_post(post_id, status="scheduled", remote_id=remote_id, error=None)
    except (publisher.PublishError, httpx.HTTPError) as exc:
        set_post(post_id, status="failed", remote_id=None, error=f"مقدرتش أسلّم البوست لـ Zernio: {exc}"[:500])


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
        post_id = uuid.uuid4().hex[:12]
        conn.execute(
            "INSERT INTO posts (id, export_id, caption, platforms, scheduled_at, status, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?)",
            (post_id, body.export_id, caption, platforms, when, now(), now()),
        )
    after_save(post_id, when, None)
    with closing(db()) as conn:
        return post_to_dict(conn.execute(POSTS_QUERY + " WHERE p.id = ?", (post_id,)).fetchone())


@app.put("/api/posts/{post_id}")
def update_post(post_id: str, body: PostIn):
    with closing(db()) as conn, conn:
        row = conn.execute("SELECT status, remote_id FROM posts WHERE id = ?", (post_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "البوست غير موجود")
        if row["status"] in ("sending", "publishing", "published"):
            raise HTTPException(400, "البوست ده اتنشر أو بيتبعت دلوقتي")
        if row["status"] == "failed" and row["remote_id"]:
            raise HTTPException(400, "البوست ده اتبعت لـ Zernio وفشل. استخدم إعادة المحاولة، أو احذفه واعمل واحد جديد")
        platforms, when, caption = clean_post(conn, body)
        conn.execute(
            "UPDATE posts SET export_id = ?, caption = ?, platforms = ?, scheduled_at = ?, status = 'scheduled', "
            "error = NULL, updated_at = ? WHERE id = ?",
            (body.export_id, caption, platforms, when, now(), post_id),
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
    if row["remote_id"] and row["status"] == "scheduled":
        # لازم نلغيه عند Zernio الأول، وإلا هيتنشر برضه
        try:
            publisher.cancel(row["remote_id"])
        except (publisher.PublishError, httpx.HTTPError) as exc:
            raise HTTPException(400, f"مقدرتش ألغيه عند Zernio: {exc}") from exc
    with closing(db()) as conn, conn:
        conn.execute("DELETE FROM posts WHERE id = ?", (post_id,))
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
        set_post(post_id, status="scheduled", error=None)
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
                    error="لسه مفيش خدمة نشر مربوطة، فالبوست متنشرش. ضيف ZERNIO_API_KEY في ملف .env ودوس إعادة المحاولة",
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
    # لو البرنامج اتقفل وهو بيسلّم بوست، مش عارفين وصل ولا لأ، فنعلّمه عشان تتأكد بنفسك
    _conn.execute(
        "UPDATE posts SET status = 'failed', error = 'البرنامج اتقفل وهو بيبعت البوست. اتأكد من Zernio قبل ما تعيد المحاولة' "
        "WHERE status IN ('sending', 'publishing')"
    )
threading.Thread(target=scheduler_loop, daemon=True).start()


app.mount("/media/raw", StaticFiles(directory=RAW_DIR), name="raw")
app.mount("/media/clips", StaticFiles(directory=CLIPS_DIR), name="clips")
app.mount("/media/coaches", StaticFiles(directory=COACHES_DIR), name="coaches")
app.mount("/media/generated", StaticFiles(directory=GENERATED_DIR), name="generated")
app.mount("/media/audio", StaticFiles(directory=AUDIO_DIR), name="audio")
app.mount("/media/exports", StaticFiles(directory=EXPORTS_DIR), name="exports")


@app.get("/")
def index():
    return FileResponse(FRONTEND_DIR / "index.html")


app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="frontend")
