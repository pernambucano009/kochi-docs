"""🗣️ FasihTTS (فصيح): صوت عربي باللهجات (مصري، نجدي، حجازي، خليجي، شامي، مغربي...).

- أصوات «-1» (العادية): POST https://api.fasihtts.com/v1/tts ← {audioContent: base64 mp3} على طول.
- أصوات «-2» (HD): POST {SUPABASE}/generate-tts-v2 (Idempotency-Key) ← jobId، وبعدين get-long-tts-job لحد ما يرجع audio_url.
المفتاح في متغير البيئة FASIH_API_KEY (على Railway)، وبيتبعت في هيدر x-api-key من السيرفر بس."""
from __future__ import annotations

import base64
import os
import time
import uuid
from pathlib import Path

import httpx

V1 = os.environ.get("FASIH_BASE_URL", "https://api.fasihtts.com")
HD = os.environ.get("FASIH_HD_URL", "https://xrwqtifhqycpxfjzfrip.supabase.co/functions/v1")
STYLE = "Natural, casual, warm social-media creator tone, like talking to a friend on camera."


class FasihError(RuntimeError):
    pass


def api_key() -> str | None:
    for n in ("FASIH_API_KEY", "FASIHTTS_API_KEY", "FASIH_KEY"):
        v = (os.environ.get(n) or "").strip().strip('"').strip("'")
        if v:
            return v
    return None


def _err(resp: httpx.Response, what: str) -> FasihError:
    try:
        body = resp.json()
        msg = body.get("error") or body.get("message") or body.get("code") or str(body)
    except ValueError:
        msg = resp.text
    hints = {401: "المفتاح غلط", 403: "الرصيد خلص في فصيح أو الباقة مش فيها API", 410: "الصوت ده اتشال من فصيح", 429: "طلبات كتير ورا بعض"}
    return FasihError(f"{what}: {hints.get(resp.status_code, '')} ({resp.status_code}) {str(msg)[:200]}".strip())


def speak(text: str, voice: str, dialect: str, dest: Path, style: str = STYLE) -> Path:
    """بيكتب ملف mp3 في dest."""
    key = api_key()
    if not key:
        raise FasihError("مفتاح فصيح مش متسجل: ضيف FASIH_API_KEY في متغيرات Railway")
    head = {"x-api-key": key, "Content-Type": "application/json"}
    body = {"text": text, "voice": voice, "dialect": dialect, "styleInstruction": style}
    with httpx.Client(timeout=120) as c:
        if not voice.endswith("-2"):
            r = c.post(f"{V1}/v1/tts", headers=head, json=body)
            if r.status_code != 200:
                raise _err(r, "صوت فصيح")
            data = r.json()
            audio = data.get("audioContent") or data.get("audio") or ""
            if not audio:
                if data.get("audio_url") or data.get("url"):
                    dest.write_bytes(c.get(data.get("audio_url") or data["url"], timeout=120).content)
                    return dest
                raise FasihError(f"فصيح مرجعش صوت: {str(data)[:200]}")
            dest.write_bytes(base64.b64decode(audio))
            return dest
        # HD: مهمة وبنستناها
        r = c.post(f"{HD}/generate-tts-v2", headers={**head, "Idempotency-Key": uuid.uuid4().hex}, json=body)
        if r.status_code not in (200, 201, 202):
            raise _err(r, "صوت فصيح HD")
        job = r.json().get("jobId")
        if not job:
            raise FasihError(f"فصيح مرجعش رقم مهمة: {r.text[:200]}")
        t0 = time.time()
        while time.time() - t0 < 600:
            time.sleep(3)
            r = c.post(f"{HD}/get-long-tts-job", headers=head, json={"id": job})
            if r.status_code != 200:
                raise _err(r, "متابعة صوت فصيح")
            j = r.json().get("job") or {}
            st = j.get("status")
            if st == "completed" and j.get("audio_url"):
                dest.write_bytes(c.get(j["audio_url"], timeout=120).content)
                return dest
            if st in ("failed", "error", "cancelled", "canceled"):
                raise FasihError(f"فصيح: {j.get('error') or 'الصوت فشل'}")
        raise FasihError("فصيح اتأخر أكتر من 10 دقايق")
