"""🗣️ منصت (Munsit · موديل Faseeh): أصوات خليجية حقيقية (نجدي، حجازي، إماراتي، كويتي...). بنستخدمه للهجات الخليجية بس،
وفصيح (fasih.py) بيفضل للهجات التانية.

- الأصوات: GET {BASE}/api/v1/voices ← [{voice_id, name, description, gender, age, languages}]، محفوظة يوم.
- الصوت: POST {BASE}/api/v1/text-to-speech/faseeh-v1-preview بـ {voice_id, text, stability} ← ملف WAV
  (لو رجع PCM خام بنلفّه WAV بـ 24kHz mono 16bit).
المفتاح في متغير البيئة MUNSIT_API_KEY على السيرفر، وبيتبعت في هيدر x-api-key من السيرفر بس."""
from __future__ import annotations

import os
import time
import wave
from pathlib import Path

import httpx

BASE = os.environ.get("MUNSIT_BASE_URL", "https://api.munsit.com")
MODEL = os.environ.get("MUNSIT_TTS_MODEL", "faseeh-v1-preview")
RATE = 24000
_CAT: dict = {"at": 0.0, "voices": []}


class MunsitError(RuntimeError):
    pass


def api_key() -> str | None:
    for n in ("MUNSIT_API_KEY", "MUNSIT_KEY"):
        v = (os.environ.get(n) or "").strip().strip('"').strip("'")
        if v:
            return v
    return None


def _err(resp: httpx.Response, what: str) -> MunsitError:
    try:
        body = resp.json()
        msg = body.get("detail") or body.get("error") or body.get("message") or str(body)
    except ValueError:
        msg = resp.text
    hints = {400: "فيه حاجة غلط في الطلب", 401: "مفتاح منصت غلط أو ناقص", 402: "رصيد منصت خلص", 403: "رصيد منصت خلص أو المفتاح مالوش صلاحية",
             404: "الصوت ده مش موجود عند منصت", 422: "الكلام أو الصوت مش مقبول", 429: "طلبات كتير ورا بعض"}
    if resp.status_code in (402, 403):
        import providers
        providers.note_error("munsit", f"quota/credit {resp.status_code} {str(msg)[:120]}")
        if os.environ.get("TENANT_ROLE") == "customer":
            return MunsitError(providers.friendly("munsit"))
    return MunsitError(f"{what}: {hints.get(resp.status_code, 'منصت فيه مشكلة دلوقتي')} ({resp.status_code}) {str(msg)[:200]}".strip())


def catalog(max_age: float = 86400) -> list[dict]:
    """أصوات منصت (بالمفتاح)، محفوظة يوم. لو مش متاح بترجع آخر نسخة (أو فاضية)."""
    key = api_key()
    if not key:
        return []
    if _CAT["voices"] and time.time() - _CAT["at"] < max_age:
        return _CAT["voices"]
    try:
        r = httpx.get(f"{BASE}/api/v1/voices", headers={"x-api-key": key}, timeout=20)
        if r.status_code == 200:
            data = r.json()
            vs = data.get("voices") or data.get("data") if isinstance(data, dict) else data
            if isinstance(vs, list):
                _CAT.update(at=time.time(), voices=vs)
        else:
            _CAT["at"] = time.time() - max_age + 600
    except (httpx.HTTPError, ValueError):
        _CAT["at"] = time.time() - max_age + 600   # نحاول تاني بعد ١٠ دقايق
    return _CAT["voices"]


def speak(text: str, voice_id: str, dest: Path, stability: float = 0.5) -> Path:
    key = api_key()
    if not key:
        raise MunsitError("مفتاح منصت مش متسجل: ضيف MUNSIT_API_KEY في متغيرات السيرفر")
    text = (text or "").strip()
    if not text:
        raise MunsitError("مفيش كلام يتقال")
    body = {"voice_id": voice_id, "text": text[:10000], "stability": stability, "sample_rate": RATE}
    with httpx.Client(timeout=180) as c:
        for attempt in range(3):
            try:
                r = c.post(f"{BASE}/api/v1/text-to-speech/{MODEL}", headers={"x-api-key": key, "Content-Type": "application/json"}, json=body)
            except httpx.HTTPError:
                if attempt == 2:
                    raise MunsitError("مش قادرين نوصل لمنصت دلوقتي") from None
                time.sleep(2 * (attempt + 1))
                continue
            if r.status_code in (500, 502, 503, 504) and attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            if r.status_code != 200:
                raise _err(r, "الأصوات الخليجية")
            data = r.content
            if "json" in (r.headers.get("content-type") or ""):
                raise _err(r, "الأصوات الخليجية")
            if len(data) < 200:
                raise MunsitError("ملف الصوت من منصت جه فاضي")
            if data[:4] == b"RIFF" or data[:3] == b"ID3" or data[:2] == b"\xff\xfb":
                dest.write_bytes(data)
            else:   # PCM16 خام ← WAV
                with wave.open(str(dest), "wb") as w:
                    w.setnchannels(1)
                    w.setsampwidth(2)
                    w.setframerate(RATE)
                    w.writeframes(data)
            return dest
    raise MunsitError("منصت مارجعش صوت")
