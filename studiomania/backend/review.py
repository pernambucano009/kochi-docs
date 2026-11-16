"""🎬 معرض مراجعة أغلفة المجالات (لصاحب المنصة): كل قالب بغلافه العام جنب نسخة المجال، والفكرة، وملاحظات مكتوبة أو بالصوت.
الصفحة: /admin/review?field=fitness (frontend/review/notes.html). التسجيل بيتم جوه الصفحة نفسها (MediaRecorder)، مش مسجّل الجوال.
جلسة Claude بتقرا الملاحظات وتسمع الصوت وترد من /api/platform/issues/review-* بنفس مفتاح متابعة الأخطاء.
التخزين: DATA_DIR/review/<المجال>/notes.json والصوت في audio/."""
from __future__ import annotations

import base64
import json
import re
import sys
import threading
import time
import uuid
from pathlib import Path
from typing import Callable

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
FIELD_RE = re.compile(r"^[a-z]{2,20}$")
TPL_RE = re.compile(r"^t-[a-z0-9]{2,30}$")
AUDIO_EXT = {"audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/aac": "aac", "audio/wav": "wav"}
MAX_AUDIO = 15 * 1024 * 1024
_lock = threading.Lock()


class NoteIn(BaseModel):
    field: str = "fitness"
    tpl: str
    text: str = ""
    audio_b64: str = ""
    mime: str = ""
    secs: float = 0


class ReplyIn(BaseModel):
    field: str = "fitness"
    tpl: str
    text: str


def _catalog() -> list[dict]:
    """القوالب بالترتيب اللي في المعرض (frontend/gallery.js)."""
    src = (ROOT / "frontend" / "gallery.js").read_text(encoding="utf-8")
    return [{"id": i, "name": n, "desc": d} for i, n, _c, d in re.findall(r'\["(t-[a-z0-9]+)", "([^"]+)", "([a-z0-9]+)", "([^"]+)"', src)]


def _ideas(field: str) -> dict:
    """فكرة كل مثال (tools/fieldcovers/<المجال>.py ‏IDEAS) لو موجودة."""
    p = ROOT / "tools" / "fieldcovers" / f"{field}.py"
    if not p.exists():
        return {}
    ns: dict = {}
    try:
        exec(compile(p.read_text(encoding="utf-8"), str(p), "exec"), ns)   # ملف بيانات من الريبو نفسه
    except Exception:  # noqa: BLE001
        return {}
    return dict(ns.get("IDEAS") or {})


def setup(app: FastAPI, data_dir: Path, admin: Callable, feed_ok: Callable, page: Callable) -> None:
    base = data_dir / "review"

    def fdir(field: str) -> Path:
        if not FIELD_RE.match(field or ""):
            raise HTTPException(400, "bad field")
        d = base / field
        (d / "audio").mkdir(parents=True, exist_ok=True)
        return d

    def load(field: str) -> list[dict]:
        f = fdir(field) / "notes.json"
        try:
            return json.loads(f.read_text(encoding="utf-8")) if f.exists() else []
        except ValueError:
            return []

    def save(field: str, notes: list[dict]) -> None:
        f = fdir(field) / "notes.json"
        tmp = f.with_suffix(".tmp")
        tmp.write_text(json.dumps(notes, ensure_ascii=False), encoding="utf-8")
        tmp.replace(f)

    def add(field: str, tpl: str, by: str, text: str, audio: dict | None = None) -> dict:
        if not TPL_RE.match(tpl or ""):
            raise HTTPException(400, "bad template")
        n = {"id": uuid.uuid4().hex[:12], "tpl": tpl, "by": by, "text": (text or "").strip()[:4000], "at": time.time(), "audio": audio}
        with _lock:
            notes = load(field)
            notes.append(n)
            save(field, notes)
        return n

    @app.get("/admin/review")
    def review_page(request: Request):
        try:
            admin(request)
        except HTTPException:
            return RedirectResponse("/login")
        return page("review/notes.html")

    @app.get("/api/review/items")
    def review_items(request: Request, field: str = "fitness"):
        admin(request)
        fd, ideas = ROOT / "frontend" / "gallery" / "f" / field, _ideas(field)
        fdir(field)
        items = [{**t, "idea": ideas.get(t["id"], ""), "done": (fd / f"{t['id']}.mp4").exists()} for t in _catalog()]
        return {"field": field, "items": items, "notes": load(field)}

    @app.post("/api/review/note")
    def review_note(body: NoteIn, request: Request):
        admin(request)
        audio = None
        if body.audio_b64:
            raw = base64.b64decode(body.audio_b64)
            if len(raw) > MAX_AUDIO:
                raise HTTPException(413, "too large")
            ext = AUDIO_EXT.get(body.mime.split(";")[0].strip().lower(), "webm")
            name = f"{uuid.uuid4().hex[:16]}.{ext}"
            (fdir(body.field) / "audio" / name).write_bytes(raw)
            audio = {"file": name, "mime": body.mime.split(";")[0].strip() or "audio/webm", "secs": round(body.secs, 1)}
        if not audio and not body.text.strip():
            raise HTTPException(400, "empty")
        return add(body.field, body.tpl, "owner", body.text, audio)

    @app.post("/api/review/note/{nid}/delete")
    def review_delete(nid: str, request: Request, field: str = "fitness"):
        admin(request)
        with _lock:
            notes = load(field)
            save(field, [n for n in notes if n["id"] != nid])
        return {"ok": True}

    def audio_file(field: str, name: str) -> FileResponse:
        if not re.match(r"^[0-9a-f]{16}\.[a-z0-9]{2,4}$", name):
            raise HTTPException(404, "not found")
        f = fdir(field) / "audio" / name
        if not f.is_file():
            raise HTTPException(404, "not found")
        mime = next((m for m, e in AUDIO_EXT.items() if f.suffix == "." + e), "audio/webm")
        return FileResponse(f, media_type=mime)

    @app.get("/api/review/audio/{name}")
    def review_audio(name: str, request: Request, field: str = "fitness"):
        admin(request)
        return audio_file(field, name)

    # 🤖 جلسة Claude (بمفتاح متابعة الأخطاء): تقرا الملاحظات، وتسمع الصوت، وترد تحت كل ملاحظة
    @app.get("/api/platform/issues/review-notes")
    def review_feed(request: Request, field: str = "fitness", since: float = 0):
        feed_ok(request)
        return {"items": [n for n in load(field) if n["at"] > since], "now": time.time()}

    @app.get("/api/platform/issues/review-audio/{name}")
    def review_feed_audio(name: str, request: Request, field: str = "fitness"):
        feed_ok(request)
        return audio_file(field, name)

    @app.post("/api/platform/issues/review-reply")
    def review_reply(body: ReplyIn, request: Request):
        feed_ok(request)
        return add(body.field, body.tpl, "claude", body.text)


if __name__ == "__main__":   # فحص سريع: كام قالب وكام فكرة
    f = sys.argv[1] if len(sys.argv) > 1 else "fitness"
    print(len(_catalog()), "templates,", len(_ideas(f)), "ideas")
