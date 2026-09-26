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

MODELS = {
    "bytedance/seedance-2.0/reference-to-video": {"label": "Seedance 2.0", "max_duration": 15},
    "bytedance/seedance-2.0-fast/reference-to-video": {"label": "Seedance 2.0 Fast", "max_duration": 15},
    "bytedance/seedance-2.5/reference-to-video": {"label": "Seedance 2.5", "max_duration": 30},
}
DEFAULT_MODEL = "bytedance/seedance-2.0/reference-to-video"
RESOLUTIONS = ["480p", "720p", "1080p"]
RATIOS = ["9:16", "16:9", "1:1"]
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
        raise AtlasError("مفتاح Atlas مش متسجل. ضيف ATLASCLOUD_API_KEY في ملف .env")
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
