"""🎚️ AudioShake: فصل صوت الفيديو لـ ٣ تراكات (كلام / موسيقى / مؤثرات).

POST https://api.audioshake.ai/tasks  (هيدر x-api-key) بلينك الملف والـ targets، وبعدين GET /tasks/{id} لحد ما كل
target يخلص. لينكات النتايج بتنتهي بعد ساعة، فبنحمّلها على طول.
المفتاح في متغير البيئة AUDIOSHAKE_API_KEY (على Railway).
"""
from __future__ import annotations

import os
import time

import httpx

BASE = os.environ.get("AUDIOSHAKE_BASE_URL", "https://api.audioshake.ai")
STEMS = ("dialogue", "music", "effects")
LABELS = {"dialogue": "🗣️ الكلام", "music": "🎵 الموسيقى", "effects": "🔊 المؤثرات"}


class AudioShakeError(RuntimeError):
    pass


def api_key() -> str | None:
    return os.environ.get("AUDIOSHAKE_API_KEY")


def _headers() -> dict:
    key = api_key()
    if not key:
        raise AudioShakeError("مفتاح AudioShake مش متسجل. حطه على Railway في المتغير AUDIOSHAKE_API_KEY")
    return {"x-api-key": key, "Content-Type": "application/json"}


def _json(resp: httpx.Response, what: str) -> dict:
    if resp.status_code >= 400:
        raise AudioShakeError(f"AudioShake ({what}): {resp.status_code} {resp.text[:300]}")
    try:
        return resp.json()
    except ValueError as exc:
        raise AudioShakeError(f"AudioShake ({what}): رد مش مفهوم {resp.text[:200]}") from exc


def create_task(url: str, stems=STEMS, fmt: str = "mp3") -> str:
    body = {"url": url, "targets": [{"model": m, "formats": [fmt]} for m in stems]}
    with httpx.Client(timeout=60) as client:
        data = _json(client.post(f"{BASE}/tasks", headers=_headers(), json=body), "إنشاء المهمة")
    tid = data.get("id") or (data.get("task") or {}).get("id")
    if not tid:
        raise AudioShakeError(f"AudioShake: الرد مفيهوش رقم المهمة: {str(data)[:200]}")
    return str(tid)


def get_task(tid: str) -> dict:
    with httpx.Client(timeout=60) as client:
        return _json(client.get(f"{BASE}/tasks/{tid}", headers=_headers()), "متابعة المهمة")


def wait(tid: str, on_status=None, max_seconds: int = 1800, interval: float = 6) -> dict[str, dict]:
    """بيرجع لكل تراك: {"status": completed|error|..., "link": لينك التحميل, "error": ...}."""
    t0 = time.time()
    while True:
        task = get_task(tid)
        out = {}
        for tg in task.get("targets") or []:
            model = str(tg.get("model") or "")
            link = next((o.get("link") or o.get("url") for o in tg.get("output") or [] if isinstance(o, dict)), None)
            out[model] = {"status": str(tg.get("status") or "").lower(), "link": link,
                          "error": tg.get("error") or tg.get("message")}
        if on_status:
            on_status(out)
        if out and all(v["status"] in ("completed", "complete", "done", "succeeded", "error", "failed") for v in out.values()):
            return out
        if time.time() - t0 > max_seconds:
            raise AudioShakeError("AudioShake خد وقت أطول من اللازم")
        time.sleep(interval)
