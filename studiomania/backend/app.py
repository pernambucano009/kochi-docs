"""StudioMania backend.

الخطوة 1: مكتبة الفيديوهات الخام وتقطيعها لقطع (كل قطعة 15 ثانية أو أقل).
"""

import json
import re
import shutil
import sqlite3
import subprocess
import uuid
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

MAX_CLIP_SECONDS = 15.0
MIN_CUT_GAP = 0.2  # أقل مسافة مسموحة بين نقطتين قطع
VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
CLIPS_DIR = DATA_DIR / "clips"
DB_PATH = DATA_DIR / "studiomania.db"
FRONTEND_DIR = ROOT / "frontend"

for d in (RAW_DIR, CLIPS_DIR):
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
app = FastAPI(title="StudioMania")


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


app.mount("/media/raw", StaticFiles(directory=RAW_DIR), name="raw")
app.mount("/media/clips", StaticFiles(directory=CLIPS_DIR), name="clips")


@app.get("/")
def index():
    return FileResponse(FRONTEND_DIR / "index.html")


app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="frontend")
