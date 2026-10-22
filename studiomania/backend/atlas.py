"""عميل Atlas Cloud لتوليد الفيديو بـ Seedance.

الطريقة مأخوذة من المستودع الرسمي AtlasCloudAI/atlas-cloud-skills:
- رفع الملفات: POST /api/v1/model/uploadMedia (multipart) ويعود download_url
- إرسال طلب التوليد: POST /api/v1/model/generateVideo
- متابعة الطلب: GET /api/v1/model/prediction/{id} حتى ما الحالة تصبح completed أو failed
"""

import mimetypes
import os
import re
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
    """ATLAS_MOCK=1 يشغّل البرنامج بدون ما يكلّم Atlas، للتجربة فقط."""
    return os.environ.get("ATLAS_MOCK") == "1"


def _unwrap(payload):
    if isinstance(payload, dict) and "code" in payload and "data" in payload:
        return payload["data"]
    return payload


def _headers() -> dict:
    key = api_key()
    if not key:
        raise AtlasError("مفتاح Atlas غير مسجل. ضعه من ⚙️ الإعدادات")
    return {"Authorization": f"Bearer {key}"}


def _check(resp: httpx.Response, what: str):
    try:
        payload = resp.json()
    except ValueError:
        raise AtlasError(f"{what}: HTTP {resp.status_code}: {resp.text[:200]}")
    if resp.status_code >= 400:
        if resp.status_code == 402 or (resp.status_code in (400, 403) and re.search(r"balance|credit|insufficient|quota", str(payload), re.I)):
            import providers
            providers.note_error("atlas", f"{resp.status_code} insufficient balance: {str(payload)[:200]}")
            if os.environ.get("TENANT_ROLE") == "customer":
                raise AtlasError(providers.friendly("atlas"))
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
        raise AtlasError(f"رفع الملف: الرد لا يحتوي رابط: {str(data)[:200]}")
    return url


# قاعدة اللبس المحتشم على كل صورة وكل فيديو، للعملاء اللي مفعّلينها في ملفهم (السوق السعودي مثلًا)
MODESTY_RULE = (
    "Wardrobe rule (always): everyone is modestly dressed. Women wear loose, non-transparent clothing that fully covers "
    "arms to the wrists, legs to the ankles, chest and midriff (loose long-sleeve tops, long loose pants or skirts, abaya), "
    "with a hijab or modest head covering; no tight, sleeveless, cropped, short, low-cut or revealing outfits, "
    "no sports bras or leggings alone. Men wear shirts at all times (never shirtless) and shorts below the knee or long pants."
)


def modesty_on() -> bool:  # البرنامج بيبدّلها بإعداد العميل المختار
    return True


def with_modesty(prompt: str) -> str:
    prompt = prompt or ""
    if not modesty_on():
        return prompt
    return prompt if MODESTY_RULE in prompt else f"{prompt.rstrip()}\n{MODESTY_RULE}"


def brand_rules() -> str:  # البرنامج بيبدّلها بـ«قواعد المحتوى» بتاعة العميل المختار
    return ""


def brand_cta() -> str:  # بيتبدّل من app بالـ CTA الافتراضي للعميل
    return ""


RULES_HEAD = "BRAND CONTENT RULES (always follow):"


def with_rules(prompt: str) -> str:
    """قواعد المحتوى بتاعة البراند (اللبس، المزيكا، الممنوعات...) بتتحط في آخر أي برومبت صورة أو فيديو."""
    prompt = with_modesty(prompt)
    rules = (brand_rules() or "").strip()
    if not rules or RULES_HEAD in prompt:
        return prompt
    return f"{prompt.rstrip()}\n{RULES_HEAD} {rules}"


def _adapt_video(body: dict) -> dict:
    """كل نموذج فيديو بأسماء خاناته (vmodels.py)؛ إذا حصل أي شيء الطلب يروح كما هو."""
    try:
        import vmodels  # noqa: PLC0415 (بيستورد atlas، فالاستيراد هنا)
        return vmodels.adapt(body)
    except Exception:  # noqa: BLE001
        return body


def submit_video(body: dict) -> str:
    body = _adapt_video(body)
    if body.get("prompt") is not None:
        body = {**body, "prompt": with_rules(body["prompt"])}
    with httpx.Client(timeout=60) as client:
        resp = client.post(f"{BASE_URL}/api/v1/model/generateVideo", headers=_headers(), json=body)
    data = _check(resp, "طلب التوليد")
    prediction_id = (data or {}).get("id") or (data or {}).get("prediction_id")
    if not prediction_id:
        raise AtlasError(f"طلب التوليد: الرد لا يحتوي رقم طلب: {str(data)[:200]}")
    return prediction_id


def get_prediction(prediction_id: str) -> dict:
    with httpx.Client(timeout=45) as client:
        resp = client.get(f"{BASE_URL}/api/v1/model/prediction/{prediction_id}", headers=_headers())
    return _check(resp, "متابعة الطلب") or {}


def wait_for(prediction_id: str, on_status, max_seconds: int = 1800, interval: float = 4) -> str:
    """ينتظر حتى ما الطلب ينتهي ويعود رابط الفيديو."""
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
                raise AtlasError("الطلب خلص فقط مرجّعش فيديو")
            return outputs[0]
        if status in TERMINAL_FAIL:
            detail = pred.get("error") or pred.get("meta_info") or status
            raise AtlasError(f"Seedance رفض الطلب: {str(detail)[:300]}")
        time.sleep(interval)
    raise AtlasError("الطلب أخد وقت أطول من المتوقع. اضغط إعادة المحاولة لكي نكمّل متابعته")


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
        raise AtlasError(f"طلب تحويل الصوت: الرد لا يحتوي رقم طلب: {str(data)[:200]}")
    return prediction_id


def wait_prediction(prediction_id: str, max_seconds: int = 600, interval: float = 3, what: str = "تحويل الصوت") -> dict:
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
            raise AtlasError(f"{what} فشل: {str(pred.get('error') or status)[:300]}")
        time.sleep(interval)
    raise AtlasError(f"{what} أخد وقت طويل. جرّب مرة أخرى")


def _find_words(obj) -> list[dict] | None:
    """يبحث في الرد على قائمة كلمات فيها أوقات، أيًا كان شكل الرد بالضبط."""
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
    """يحوّل التعليق الصوتي لكلام، ويعود كل كلمة بوقت بدايتها ونهايتها."""
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
        raise AtlasError("الخدمة مرجّعتش أي نص. تأكد أن التسجيل فيه صوت واضح")
    return words_from_text(text, 0, duration)


# ---------------------------------------------------------------- الكلام (موديلات الشات)
# Atlas بيدّي موديلات كلام بنفس شكل OpenAI: POST /v1/chat/completions بنفس المفتاح

LLM_URL = os.environ.get("ATLASCLOUD_LLM_URL", f"{BASE_URL}/v1")
DEFAULT_TEXT_MODEL = "deepseek-ai/deepseek-v4-flash"
# لو Atlas شال موديل (بيرد «not found») بنحوّل لأول واحد شغال من دول، ونفتكر البديل علشان الطلبات الجاية
TEXT_FALLBACKS = ["deepseek-ai/deepseek-v4-flash", "openai/gpt-5.4-mini", "google/gemini-2.5-flash", "openai/gpt-4.1", "openai/gpt-4o"]
_MODEL_SWAP: dict[str, str] = {}
# موديل بيشوف الصور (بيقرا التيمبليت والستايل ويكتب وصفه)
DEFAULT_VISION_MODEL = "google/gemini-2.5-flash"
# لو الموديل المختار مش موجود بنجرب دول بالترتيب (الأسماء بتختلف في Atlas)
VISION_FALLBACKS = [
    "google/gemini-2.5-flash", "google/gemini-3-flash-preview", "qwen/qwen3-vl-235b-a22b-thinking",
    "deepseek-ai/deepseek-v4-flash-vision-exp", "google/gemini-2.5-flash", "openai/gpt-4.1", "openai/gpt-4o",
]
VISION_HINTS = ("vl", "vision", "gemini", "gpt-4o", "gpt-4.1", "gpt-5")
# موديل اللقطات في المسلسل (GPT 5.6 Luna من OpenAI). لو الاسم مختلف في Atlas بندوّر عليه بكلمة luna
DEFAULT_SERIES_MODEL = "openai/gpt-5.6-luna"


def model_candidates(preferred: str, hints: tuple[str, ...], fallbacks: list[str]) -> list[str]:
    """النموذج المختار أولًا، وبعده الذي عند Atlas وفيه هذه الكلمات، وبعدها الاحتياطي."""
    available = list_models()
    seen = {m.lower(): m for m in available}
    found = [m for m in available if any(h in m.lower() for h in hints)]
    out: list[str] = []
    for m in [preferred, *found, *fallbacks]:
        m = seen.get((m or "").lower(), m)
        if m and m not in out:
            out.append(m)
    return out


def list_models() -> list[str]:
    """أسماء نماذج النص الذي Atlas يقدمها (إذا الطلب فشل تعود فارغة)."""
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(f"{LLM_URL}/models", headers=_headers())
        data = resp.json()
        items = data.get("data") if isinstance(data, dict) else data
        return [str(m.get("id") if isinstance(m, dict) else m) for m in items or []]
    except (httpx.HTTPError, ValueError, AttributeError, TypeError):
        return []


def vision_candidates(preferred: str) -> list[str]:
    """النموذج المختار أولًا، وبعده نماذج الرؤية التي Atlas لديه، وبعدها الاحتياطي."""
    available = list_models()
    seen = {m.lower(): m for m in available}
    found = [m for m in available if any(h in m.lower() for h in VISION_HINTS) and "embed" not in m.lower()]
    found.sort(key=lambda m: (0 if "qwen3-vl" in m.lower() else 1, m))
    out: list[str] = []
    for m in [preferred, *found, *VISION_FALLBACKS]:
        m = seen.get(m.lower(), m)  # نفس الاسم بالحروف اللي Atlas كاتبها بيها
        if m and m not in out:
            out.append(m)
    return out


def _missing(resp: httpx.Response) -> bool:
    """Atlas يرد 400/404 «not found» عندما اسم النموذج غير موجود لديه."""
    if resp.status_code not in (400, 404):
        return False
    t = resp.text.lower()
    return "not found" in t or "model_not_found" in t or "does not exist" in t or "no such model" in t


def chat(messages: list[dict], model: str, temperature: float = 0.8, max_tokens: int = 4000, json_mode: bool = False, timeout: float = 180) -> str:
    rules, cta = (brand_rules() or "").strip(), (brand_cta() or "").strip()
    if (rules or cta) and not any(RULES_HEAD in str(m.get("content") or "") for m in messages):
        # أي كلام بيتكتب (سكريبت، تعليق صوتي، كابشن، برومبتات مشاهد) لازم يمشي على قواعد محتوى البراند
        sys_txt = f"{RULES_HEAD} {rules or '-'}\nApply these rules to any content you write (scripts, voice-over, captions, scene and image prompts). They do not change the requested output format."
        if cta:
            sys_txt += f"\nDefault call to action for this brand (use it when a CTA is needed and none is given): {cta}"
        messages = [{"role": "system", "content": sys_txt}, *messages]
    model = _MODEL_SWAP.get(model, model)
    body = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens, "stream": False}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    with httpx.Client(timeout=timeout) as client:
        def send(b):
            r = client.post(f"{LLM_URL}/chat/completions", headers=_headers(), json=b)
            # بعض الموديلات مش بتقبل response_format، فنجرّب من غيره
            if "response_format" in b and r.status_code in (400, 422) and not _missing(r):
                b = {k: v for k, v in b.items() if k != "response_format"}
                r = client.post(f"{LLM_URL}/chat/completions", headers=_headers(), json=b)
            return r
        resp = send(body)
        if _missing(resp):   # الموديل اتشال من Atlas: أقرب بديل شغال (موديل صور لو الرسالة فيها صور)
            images = any(isinstance(m.get("content"), list) and any(isinstance(p, dict) and p.get("type") == "image_url" for p in m["content"]) for m in messages)
            avail = {m.lower(): m for m in list_models()}
            for alt in (VISION_FALLBACKS if images else TEXT_FALLBACKS):
                alt = avail.get(alt.lower(), alt)
                if alt.lower() == model.lower() or (avail and alt.lower() not in avail):
                    continue
                r2 = send({**body, "model": alt})
                if r2.status_code < 400:
                    _MODEL_SWAP[model] = alt
                    resp, model = r2, alt
                    break
                if not _missing(r2):
                    resp, model = r2, alt
                    break
    data = _check(resp, f"نموذج النص ({model})")
    try:
        return str(data["choices"][0]["message"]["content"] or "").strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise AtlasError(f"نموذج النص استعد رد غريب: {str(data)[:200]}") from exc


# ---------------------------------------------------------------- الصور (GPT Image 2.5)

IMAGE_MODELS = {
    "sunburst": ("openai/gpt-image-2.5-sunburst/text-to-image", "openai/gpt-image-2.5-sunburst/edit", "GPT Image 2.5 Sunburst"),
    "flare": ("openai/gpt-image-2.5-flare/text-to-image", "openai/gpt-image-2.5-flare/edit", "GPT Image 2.5 Flare"),
}


# موديلات بتاخد نسبة المقاس كإعداد (aspect_ratio) بدل مقاس بالبكسل: بتلتزم بيها بالظبط (9:16 بيطلع 9:16)
ASPECT_IMAGE_MODELS = {
    "nano2": ("google/nano-banana-2/text-to-image-developer", "google/nano-banana-2/edit-developer", "Nano Banana 2"),
    "nanopro": ("google/nano-banana-pro/text-to-image-developer", "google/nano-banana-pro/edit-developer", "Nano Banana Pro"),
}
ASPECT_RATIOS = ("9:16", "16:9", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4")


def size_ratio(size: str) -> str:
    try:
        w, h = (int(x) for x in size.lower().replace("*", "x").split("x"))
    except ValueError:
        return "1:1"
    return min(ASPECT_RATIOS, key=lambda r: abs(int(r.split(":")[0]) / int(r.split(":")[1]) - w / h))


def generate_image(family: str, prompt: str, size: str, quality: str, images: list[str] | None = None) -> str:
    """يرسم صورة ويعود لينكها. إذا فيه صور مرجعية يستخدم نسخة الـ edit (حتى 16 صورة)."""
    if family in ASPECT_IMAGE_MODELS:
        t2i, edit, _ = ASPECT_IMAGE_MODELS[family]
        body = {"model": edit if images else t2i, "prompt": with_rules(prompt[:30000]), "aspect_ratio": size_ratio(size),
                "resolution": "2k" if quality == "high" else "1k"}
    else:
        t2i, edit, _ = IMAGE_MODELS.get(family) or IMAGE_MODELS["sunburst"]
        body = {"model": edit if images else t2i, "prompt": with_rules(prompt[:30000]), "size": size, "quality": quality, "output_format": "png"}
    if images:
        body["images"] = images[:14]
    with httpx.Client(timeout=90) as client:
        resp = client.post(f"{BASE_URL}/api/v1/model/generateImage", headers=_headers(), json=body)
    data = _check(resp, "طلب الصورة")
    prediction_id = (data or {}).get("id") or (data or {}).get("prediction_id")
    if not prediction_id:
        raise AtlasError(f"طلب الصورة: الرد لا يحتوي رقم طلب: {str(data)[:200]}")
    pred = wait_prediction(prediction_id, max_seconds=900, interval=4, what="رسم الصورة")
    outputs = pred.get("outputs") or []
    url = next((o for o in outputs if isinstance(o, str) and o.startswith("http")), None)
    if not url:
        raise AtlasError("الصورة خلصت فقط مرجعش رابط")
    return url


_uploads: dict[str, tuple[float, str]] = {}


def reference_url(path: Path) -> str:
    """يرفع الصورة المرجعية لـ Atlas مرة واحدة ويتذكر الرابط (لمدة ساعة)."""
    key = f"{path}:{path.stat().st_mtime}"
    cached = _uploads.get(key)
    if cached and time.monotonic() - cached[0] < 3000:
        return cached[1]
    url = upload_media(path)
    _uploads[key] = (time.monotonic(), url)
    return url


def run_model(kind: str, body: dict, what: str, max_seconds: int = 1800, interval: float = 4) -> str:
    """أي نموذج على Atlas (Video / Audio / Image): يرسل الطلب وينتظر ويعود رابط أول ناتج."""
    if kind == "Video":
        body = _adapt_video(body)
    if kind in ("Video", "Image") and isinstance(body.get("prompt"), str):
        body = {**body, "prompt": with_rules(body["prompt"])}
    with httpx.Client(timeout=90) as client:
        resp = client.post(f"{BASE_URL}/api/v1/model/generate{kind}", headers=_headers(), json=body)
    data = _check(resp, what)
    pid = (data or {}).get("id") or (data or {}).get("prediction_id")
    if not pid:
        raise AtlasError(f"{what}: الرد لا يحتوي رقم طلب: {str(data)[:200]}")
    pred = wait_prediction(pid, max_seconds=max_seconds, interval=interval, what=what)
    outputs = pred.get("outputs") or pred.get("output") or []
    if isinstance(outputs, str):
        outputs = [outputs]
    url = next((o for o in outputs if isinstance(o, str) and o.startswith("http")), None)
    if not url:
        raise AtlasError(f"{what} خلص فقط مرجعش رابط")
    return url
