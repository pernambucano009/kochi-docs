"""🗄️ نسخة احتياطية يومية على جوجل درايف (البوابة هي اللي بتعملها، لأنها شايفة بيانات كل الحسابات).

- الربط مرة واحدة من الإعدادات: الأدمن بيسجّل دخول بإيميل جوجل ويوافق. الصلاحية drive.file بس،
  يعني البرنامج بيشوف الملفات اللي هو عملها بس، ومش بيقدر يفتح أي حاجة تانية في الدرايف.
- النسخة: كل قواعد البيانات (نسخة متسقة بـ sqlite backup) وملفات الإعدادات الصغيرة، من غير الفيديوهات والصور.
  بتتضغط في ملف واحد وبتترفع في فولدر «SimsimKit Backups»، والأقدم من آخر KEEP نسخة بيتمسح.
- محتاج GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET (نفس بتوع الدخول بجوجل).
"""
from __future__ import annotations

import json
import os
import sqlite3
import tarfile
import tempfile
import time
from contextlib import closing
from pathlib import Path

import httpx

SCOPE = "https://www.googleapis.com/auth/drive.file"
FOLDER = "SimsimKit Backups"
KEEP = 14
EVERY = 24 * 3600
SMALL = 5 * 1024 * 1024          # ملفات الإعدادات (json وغيره) لحد ٥ ميجا
SKIP_DIRS = {"tmp", "cache", "__pycache__"}
KEEP_SUFFIX = {".json", ".key", ".txt", ".csv", ".md", ".yaml", ".yml"}
API = "https://www.googleapis.com"


class BackupError(Exception):
    pass


def oauth_url(client_id: str, redirect: str, state: str) -> str:
    from urllib.parse import urlencode
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode({
        "client_id": client_id, "redirect_uri": redirect, "response_type": "code", "scope": SCOPE, "state": state,
        "access_type": "offline", "prompt": "consent", "include_granted_scopes": "true"})


def exchange(code: str, client_id: str, secret: str, redirect: str) -> dict:
    r = httpx.post("https://oauth2.googleapis.com/token", timeout=30, data={
        "code": code, "client_id": client_id, "client_secret": secret, "redirect_uri": redirect, "grant_type": "authorization_code"})
    d = r.json() if r.content else {}
    if r.status_code >= 400 or not d.get("refresh_token"):
        raise BackupError(f"جوجل مارجّعش صلاحية دائمة: {d.get('error_description') or d.get('error') or r.status_code}")
    who = ""
    try:
        info = httpx.get(f"{API}/drive/v3/about", params={"fields": "user(emailAddress),storageQuota"},
                         headers={"Authorization": f"Bearer {d['access_token']}"}, timeout=20).json()
        who = (info.get("user") or {}).get("emailAddress") or ""
    except (httpx.HTTPError, ValueError):
        pass
    return {"refresh": d["refresh_token"], "email": who}


def access_token(refresh: str, client_id: str, secret: str) -> str:
    r = httpx.post("https://oauth2.googleapis.com/token", timeout=30, data={
        "refresh_token": refresh, "client_id": client_id, "client_secret": secret, "grant_type": "refresh_token"})
    d = r.json() if r.content else {}
    if r.status_code >= 400 or not d.get("access_token"):
        err = d.get("error") or r.status_code
        raise BackupError("ربط جوجل درايف اتلغى أو انتهى، اربطه تاني من الإعدادات" if err == "invalid_grant" else f"جوجل رفض: {err}")
    return d["access_token"]


# ---------------------------------------------------------------- تجميع الملفات
def collect(root: Path) -> list[tuple[Path, str]]:
    """(الملف، اسمه جوه النسخة). قواعد البيانات كلها، والملفات الصغيرة بس من الباقي."""
    out = []
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        for f in files:
            p = Path(dirpath) / f
            if f.endswith(("-wal", "-shm", "-journal", ".tmp")):
                continue
            try:
                size = p.stat().st_size
            except OSError:
                continue
            if p.suffix == ".db" or (p.suffix in KEEP_SUFFIX and size <= SMALL):
                out.append((p, str(p.relative_to(root))))
    return out


def make_archive(root: Path, dest: Path) -> dict:
    files = collect(root)
    n = 0
    with tempfile.TemporaryDirectory() as tmp, tarfile.open(dest, "w:gz") as tar:
        for p, name in files:
            try:
                if p.suffix == ".db":   # نسخة متسقة حتى لو البرنامج بيكتب فيها دلوقتي
                    snap = Path(tmp) / f"snap-{n}.db"
                    with closing(sqlite3.connect(f"file:{p}?mode=ro", uri=True, timeout=30)) as src, closing(sqlite3.connect(snap)) as dst:
                        src.backup(dst)
                    tar.add(snap, arcname=name)
                    snap.unlink(missing_ok=True)
                else:
                    tar.add(p, arcname=name)
                n += 1
            except (OSError, sqlite3.Error):
                continue
        meta = Path(tmp) / "backup.json"
        meta.write_text(json.dumps({"at": time.time(), "files": n}), "utf-8")
        tar.add(meta, arcname="backup.json")
    return {"files": n, "size": dest.stat().st_size}


# ---------------------------------------------------------------- الدرايف
def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


def folder_id(tok: str, known: str | None) -> str:
    if known:
        r = httpx.get(f"{API}/drive/v3/files/{known}", params={"fields": "id,trashed"}, headers=_h(tok), timeout=20)
        if r.status_code == 200 and not r.json().get("trashed"):
            return known
    r = httpx.post(f"{API}/drive/v3/files", headers=_h(tok), timeout=20,
                   json={"name": FOLDER, "mimeType": "application/vnd.google-apps.folder"})
    if r.status_code >= 400:
        raise BackupError(f"مقدرتش أعمل فولدر في الدرايف: {r.status_code} {r.text[:150]}")
    return r.json()["id"]


def upload(tok: str, folder: str, path: Path, name: str) -> str:
    """رفع على مرحلتين (resumable) علشان الملف لو كبير مايقعش في النص."""
    r = httpx.post(f"{API}/upload/drive/v3/files", params={"uploadType": "resumable"}, timeout=30,
                   headers={**_h(tok), "X-Upload-Content-Type": "application/gzip", "X-Upload-Content-Length": str(path.stat().st_size)},
                   json={"name": name, "parents": [folder]})
    if r.status_code >= 400 or not r.headers.get("location"):
        raise BackupError(f"الرفع ماتبدأش: {r.status_code} {r.text[:150]}")
    with path.open("rb") as f:
        r2 = httpx.put(r.headers["location"], content=f, headers={"Content-Type": "application/gzip"}, timeout=1800)
    if r2.status_code >= 400:
        if r2.status_code == 403 and "storageQuota" in r2.text:
            raise BackupError("مساحة جوجل درايف خلصت")
        raise BackupError(f"الرفع فشل: {r2.status_code} {r2.text[:150]}")
    return r2.json().get("id", "")


def prune(tok: str, folder: str, keep: int = KEEP) -> int:
    r = httpx.get(f"{API}/drive/v3/files", headers=_h(tok), timeout=20, params={
        "q": f"'{folder}' in parents and trashed = false and name contains 'simsimkit-backup-'",
        "orderBy": "createdTime desc", "fields": "files(id,name,createdTime)", "pageSize": 100})
    files = (r.json().get("files") or []) if r.status_code < 400 else []
    gone = 0
    for f in files[keep:]:
        if httpx.delete(f"{API}/drive/v3/files/{f['id']}", headers=_h(tok), timeout=20).status_code < 400:
            gone += 1
    return gone


def listing(tok: str, folder: str) -> list[dict]:
    r = httpx.get(f"{API}/drive/v3/files", headers=_h(tok), timeout=20, params={
        "q": f"'{folder}' in parents and trashed = false", "orderBy": "createdTime desc", "fields": "files(id,name,size,createdTime,webViewLink)", "pageSize": 20})
    return (r.json().get("files") or []) if r.status_code < 400 else []


def run(root: Path, refresh: str, client_id: str, secret: str, folder: str | None) -> dict:
    tok = access_token(refresh, client_id, secret)
    fid = folder_id(tok, folder)
    stamp = time.strftime("%Y-%m-%d_%H%M", time.gmtime())
    with tempfile.TemporaryDirectory() as tmp:
        arc = Path(tmp) / f"simsimkit-backup-{stamp}.tar.gz"
        info = make_archive(root, arc)
        upload(tok, fid, arc, arc.name)
    pruned = prune(tok, fid)
    return {"at": time.time(), "folder": fid, "name": f"simsimkit-backup-{stamp}.tar.gz", **info, "pruned": pruned}
