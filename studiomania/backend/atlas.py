"""عميل Atlas Cloud لتوليد الفيديو بـ Seedance.

الطريقة مأخوذة من المستودع الرسمي AtlasCloudAI/atlas-cloud-skills:
- رفع الملفات: POST /api/v1/model/uploadMedia (multipart) ويرجّع download_url
- إرسال طلب التوليد: POST /api/v1/model/generateVideo
- متابعة الطلب: GET /api/v1/model/prediction/{id} لحد ما الحالة تبقى completed أو failed
"""

import mimetypes
import os
import shutil
import time
from pathlib import Path

import httpx

BASE_URL = os.environ.get("ATLASCLOUD_BASE_URL", "https://api.atlascloud.ai")

# إعدادات ثابتة: Seedance 2.0 Mini (الأرخص)، دقة 480p، مقاس 9:16
MODEL = "bytedance/seedance-2.0-mini/reference-to-video"
MODEL_LABEL = "Seedance 2.0 Mini"
RESOLUTION = "480p"
RATIO = "9:16"
MAX_DURATION = 15
MIN_DURATION = 4

TERMINAL_OK = {"completed", "succeeded"}
TERMINAL_FAIL = {"failed", "timeout", "canceled", "cancelled"}


class AtlasError(Exception):
    pass


def api_key() -> str | None:
    return os.environ.get("ATLASCLOUD_API_KEY") or os.environ.get("ATLAS_CLOUD_API_KEY")


def mock_mode() -> bool:
    """ATLAS_MOCK=1 بيشغّل البرنامج من غير ما يكلّم Atlas، للتجربة بس."""
    return os.environ.get("ATLAS_MOCK") == "1"


def _unwrap(payload):
    if isinstance(payload, dict) and "code" in payload and "data" in payload:
        return payload["data"]
    return payload


def _headers() -> dict:
    key = api_key()
    if not key:
        raise AtlasError("مفتاح Atlas مش متسجل. حطه من ⚙️ الإعدادات")
    return {"Authorization": f"Bearer {key}"}


def _check(resp: httpx.Response, what: str):
    try:
        payload = resp.json()
    except ValueError:
        raise AtlasError(f"{what}: HTTP {resp.status_code}: {resp.text[:200]}")
    if resp.status_code >= 400:
        raise AtlasError(f"{what}: HTTP {resp.status_code}: {str(payload)[:300]}")
    return _unwrap(payload)


def upload_media(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    with path.open("rb") as f, httpx.Client(timeout=300) as client:
        resp = client.post(
            f"{BASE_URL}/api/v1/model/uploadMedia",
            headers=_headers(),
            files={"file": (path.name, f, mime)},
        )
    data = _check(resp, "رفع الملف")
    url = (data or {}).get("download_url") or (data or {}).get("url")
    if not url:
        raise AtlasError(f"رفع الملف: الرد مفيهوش لينك: {str(data)[:200]}")
    return url


def submit_video(body: dict) -> str:
    with httpx.Client(timeout=60) as client:
        resp = client.post(f"{BASE_URL}/api/v1/model/generateVideo", headers=_headers(), json=body)
    data = _check(resp, "طلب التوليد")
    prediction_id = (data or {}).get("id") or (data or {}).get("prediction_id")
    if not prediction_id:
        raise AtlasError(f"طلب التوليد: الرد مفيهوش رقم طلب: {str(data)[:200]}")
    return prediction_id


def get_prediction(prediction_id: str) -> dict:
    with httpx.Client(timeout=45) as client:
        resp = client.get(f"{BASE_URL}/api/v1/model/prediction/{prediction_id}", headers=_headers())
    return _check(resp, "متابعة الطلب") or {}


def wait_for(prediction_id: str, on_status, max_seconds: int = 1800, interval: float = 4) -> str:
    """يستنى لحد ما الطلب يخلص ويرجّع لينك الفيديو."""
    deadline = time.monotonic() + max_seconds
    while time.monotonic() < deadline:
        try:
            pred = get_prediction(prediction_id)
        except (httpx.HTTPError, AtlasError) as exc:
            # أخطاء الشبكة المؤقتة منكملش بعدها على طول، نستنى ونحاول تاني
            if isinstance(exc, AtlasError) and not any(c in str(exc) for c in ("HTTP 50", "HTTP 404")):
                raise
            time.sleep(interval)
            continue
        status = str(pred.get("status", "unknown")).lower()
        on_status(status)
        if status in TERMINAL_OK:
            outputs = pred.get("outputs") or []
            if not outputs:
                raise AtlasError("الطلب خلص بس مرجّعش فيديو")
            return outputs[0]
        if status in TERMINAL_FAIL:
            detail = pred.get("error") or pred.get("meta_info") or status
            raise AtlasError(f"Seedance رفض الطلب: {str(detail)[:300]}")
        time.sleep(interval)
    raise AtlasError("الطلب أخد وقت أطول من المتوقع. دوس إعادة المحاولة عشان نكمّل متابعته")


def download(url: str, dest: Path) -> None:
    with httpx.Client(timeout=300, follow_redirects=True) as client, client.stream("GET", url) as resp:
        if resp.status_code >= 400:
            raise AtlasError(f"تحميل الفيديو: HTTP {resp.status_code}")
        with dest.open("wb") as out:
            for chunk in resp.iter_bytes():
                out.write(chunk)


def mock_generate(clip_path: Path, dest: Path, on_status) -> None:
    for status in ("processing", "processing", "completed"):
        time.sleep(1.5)
        on_status(status)
    shutil.copyfile(clip_path, dest)


# ---------------------------------------------------------------- تحويل الصوت لكلام (للكابشن)

STT_MODEL = "xai/stt-v1"  # بيرجّع وقت كل كلمة، وبيدعم العربي


def submit_audio(body: dict) -> str:
    with httpx.Client(timeout=60) as client:
        resp = client.post(f"{BASE_URL}/api/v1/model/generateAudio", headers=_headers(), json=body)
    data = _check(resp, "طلب تحويل الصوت")
    prediction_id = (data or {}).get("id") or (data or {}).get("prediction_id")
    if not prediction_id:
        raise AtlasError(f"طلب تحويل الصوت: الرد مفيهوش رقم طلب: {str(data)[:200]}")
    return prediction_id


def wait_prediction(prediction_id: str, max_seconds: int = 600, interval: float = 3) -> dict:
    deadline = time.monotonic() + max_seconds
    while time.monotonic() < deadline:
        try:
            pred = get_prediction(prediction_id)
        except (httpx.HTTPError, AtlasError):
            time.sleep(interval)
            continue
        status = str(pred.get("status", "")).lower()
        if status in TERMINAL_OK:
            return pred
        if status in TERMINAL_FAIL:
            raise AtlasError(f"تحويل الصوت فشل: {str(pred.get('error') or status)[:300]}")
        time.sleep(interval)
    raise AtlasError("تحويل الصوت أخد وقت طويل. جرّب تاني")


def _find_words(obj) -> list[dict] | None:
    """بيدوّر في الرد على قايمة كلمات فيها أوقات، أيًا كان شكل الرد بالظبط."""
    if isinstance(obj, list) and obj and all(isinstance(x, dict) for x in obj):
        sample = obj[0]
        text_key = next((k for k in ("word", "text", "w", "token") if k in sample), None)
        start_key = next((k for k in ("start", "start_time", "startTime", "begin", "s") if k in sample), None)
        end_key = next((k for k in ("end", "end_time", "endTime", "e") if k in sample), None)
        if text_key and start_key and end_key:
            words = []
            for x in obj:
                try:
                    words.append({"w": str(x[text_key]).strip(), "s": float(x[start_key]), "e": float(x[end_key])})
                except (KeyError, TypeError, ValueError):
                    continue
            words = [w for w in words if w["w"]]
            # لو الأوقات بالمللي ثانية نحوّلها لثواني
            if words and max(w["e"] for w in words) > 3600:
                words = [{"w": w["w"], "s": w["s"] / 1000, "e": w["e"] / 1000} for w in words]
            # لو كل عنصر جملة مش كلمة، نقسمها كلمات
            if words and any(len(w["w"].split()) > 1 for w in words):
                from captions import words_from_text

                split = []
                for w in words:
                    split += words_from_text(w["w"], w["s"], w["e"])
                words = split
            return words
    if isinstance(obj, dict):
        for key in ("words", "word_timestamps", "segments", "utterances", "chunks"):
            if key in obj:
                found = _find_words(obj[key])
                if found:
                    return found
        for v in obj.values():
            found = _find_words(v)
            if found:
                return found
    if isinstance(obj, list):
        for v in obj:
            found = _find_words(v)
            if found:
                return found
    return None


def _find_text(obj) -> str:
    if isinstance(obj, str):
        return obj
    if isinstance(obj, dict):
        for key in ("text", "transcript", "stt_result"):
            if key in obj:
                t = _find_text(obj[key])
                if t:
                    return t
        for v in obj.values():
            t = _find_text(v)
            if t:
                return t
    if isinstance(obj, list):
        return " ".join(filter(None, (_find_text(v) for v in obj)))
    return ""


def transcribe(audio_path: Path, duration: float) -> list[dict]:
    """يحوّل التعليق الصوتي لكلام، ويرجّع كل كلمة بوقت بدايتها ونهايتها."""
    import json

    if mock_mode():
        time.sleep(1)
        sample = "ده كابشن تجريبي عشان تشوف الشكل قبل ما تربط الخدمة الحقيقية يا كوتشي".split()
        n = max(1, int(duration / 0.45))
        texts = (sample * (n // len(sample) + 1))[:n]
        step = duration / n
        return [{"w": w, "s": round(i * step, 3), "e": round((i + 1) * step, 3)} for i, w in enumerate(texts)]

    url = upload_media(audio_path)
    pred = wait_prediction(submit_audio({"model": STT_MODEL, "audio": url}))
    payload: object = pred
    outputs = pred.get("outputs") or []
    first = outputs[0] if outputs else None
    if isinstance(first, str) and first.startswith("http"):
        with httpx.Client(timeout=60, follow_redirects=True) as client:
            r = client.get(first)
        try:
            payload = r.json()
        except ValueError:
            payload = r.text
    elif isinstance(first, str):
        try:
            payload = json.loads(first)
        except ValueError:
            payload = {"text": first, "raw": pred}

    words = _find_words(payload) or _find_words(pred)
    if words:
        return words
    from captions import words_from_text

    text = _find_text(payload)
    if not text.strip():
        raise AtlasError("الخدمة مرجّعتش أي كلام. اتأكد إن التسجيل فيه صوت واضح")
    return words_from_text(text, 0, duration)
