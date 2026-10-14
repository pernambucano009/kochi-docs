"""🎬 كل موديلات الفيديو اللي عند Atlas: القايمة وأسعارها بتيجي من كتالوج Atlas نفسه (مش مكتوبة بإيدينا)،
وكل موديل بيتظبطله شكل الطلب من الـ schema بتاعه (أسماء الخانات بتختلف من موديل للتاني).

- العائلة = اسم الموديل من غير آخر جزء (مثلًا kwaivgi/kling-video-o3-std)، وليها:
  image-to-video (صورة ← فيديو) و reference-to-video (مراجع ← فيديو) و start-end-to-video (بداية ونهاية) لو موجودين.
- Kling هو الافتراضي والموصى به للفيديوهات اللي مش إنجليزي (نطقه للعربي كويس)."""
from __future__ import annotations

import json
import os
import re
import threading
import time
from pathlib import Path

import httpx

import atlas

DEFAULT = "kwaivgi/kling-video-o3-std"
# لو الكتالوج موصلناش (من غير نت / وضع تجريبي) دول بيفضلوا موجودين
SEED = {
    DEFAULT: {"label": "Kling O3 Std", "model": "kwaivgi/kling-video-o3-std/image-to-video",
              "r2v": "kwaivgi/kling-video-o3-std/reference-to-video", "per_sec": 0.071, "rec": True},
}
_lock = threading.Lock()
_cat: dict = {"at": 0.0, "families": {}}
_schemas: dict[str, dict | None] = {}


def _cache_dir() -> Path:
    base = Path(os.environ.get("STUDIOMANIA_DATA") or Path(__file__).resolve().parent.parent / "data")
    d = base / "cache" / "vmodels"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _price(entry: dict) -> float | None:
    try:
        return float(((entry.get("price") or {}).get("actual") or {}).get("base_price"))
    except (TypeError, ValueError):
        return None


def _label(entry: dict) -> str:
    name = str(entry.get("displayName") or entry.get("model") or "")
    return re.sub(r"\s*(image|reference|start[- ]end)[- ]to[- ]video\b|\s*\bI2V\b", "", name, flags=re.I).strip()


def families(refresh: bool = False) -> dict:
    """{العيلة: {label, model (i2v), r2v, se, per_sec, rec, org}} من كتالوج Atlas، متخزن ٦ ساعات."""
    with _lock:
        if not refresh and _cat["families"] and time.time() - _cat["at"] < 6 * 3600:
            return _cat["families"]
    f = _cache_dir() / "catalog.json"
    data = None
    if not refresh and f.exists() and time.time() - f.stat().st_mtime < 6 * 3600:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            data = None
    if data is None and atlas.api_key() and not atlas.mock_mode():
        try:
            with httpx.Client(timeout=30) as c:
                resp = c.get(f"{atlas.BASE_URL}/api/v1/models", headers=atlas._headers())
            data = resp.json().get("data") if resp.status_code < 400 else None
            if data:
                f.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        except (httpx.HTTPError, ValueError, AttributeError):
            data = None
    if data is None and f.exists():   # الكتالوج القديم أحسن من مفيش
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            data = None
    fams: dict = {}
    for e in data or []:
        if e.get("type") != "Video" or e.get("display_console") is False:
            continue
        mid = str(e.get("model") or "")
        fam, _, kind = mid.rpartition("/")
        if kind not in ("image-to-video", "reference-to-video", "start-end-to-video") or not fam:
            continue
        x = fams.setdefault(fam, {"org": e.get("organization") or fam.split("/")[0]})
        key = {"image-to-video": "model", "reference-to-video": "r2v", "start-end-to-video": "se"}[kind]
        x[key] = mid
        x["schema_" + key] = e.get("schema")
        if kind == "image-to-video" or "label" not in x:
            x["label"] = _label(e)
        p = _price(e)
        if p is not None and (kind == "image-to-video" or "per_sec" not in x):
            x["per_sec"] = p
    out = {}
    for fam, x in fams.items():
        if not (x.get("model") or x.get("r2v")) or x.get("per_sec") is None:
            continue
        x.setdefault("model", x.get("r2v"))
        x["rec"] = "kling" in fam.lower()
        out[fam] = x
    for k, v in SEED.items():
        out.setdefault(k, dict(v))
    with _lock:
        _cat.update(at=time.time(), families=out)
    return out


def listing() -> list[dict]:
    """للواجهة: الموصى بيه الأول، وبعدين الأرخص."""
    fams = families()
    rows = [{"key": k, "label": v["label"], "per_sec": round(v["per_sec"], 4), "rec": bool(v.get("rec")),
             "refs": bool(v.get("r2v")), "org": v.get("org", "")} for k, v in fams.items()]
    rows.sort(key=lambda r: (r["key"] != DEFAULT, not r["rec"], r["per_sec"]))
    return rows


# ---------------------------------------------------------------- تظبيط الطلب على schema كل موديل

ALIASES = {
    "ratio": ("aspect_ratio", "ratio", "size"),
    "reference_images": ("reference_images", "images", "image_urls", "reference_image_urls", "refer_images"),
    "image": ("image", "image_url", "first_frame_image", "start_image", "first_frame", "input_image"),
    "last_image": ("last_image", "end_image", "tail_image", "last_frame_image", "last_frame", "end_image_url"),
    "generate_audio": ("generate_audio", "sound", "enable_audio", "audio", "with_audio", "generate_sound"),
    "duration": ("duration", "seconds", "video_length", "length"),
    "resolution": ("resolution", "quality"),
    "watermark": ("watermark", "add_watermark"),
    "prompt": ("prompt", "text"),
    "reference_videos": ("reference_videos", "video_urls", "videos"),
}


def _schema_for(model_id: str) -> dict | None:
    """الـ schema بتاع الموديل (من Atlas، متخزن على الجهاز)؛ None لو مقدرناش نوصله."""
    if model_id in _schemas:
        return _schemas[model_id]
    f = _cache_dir() / (model_id.replace("/", "__") + ".json")
    sch = None
    if f.exists():
        try:
            sch = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            sch = None
    if sch is None:
        url = next((v.get(k) for v in families().values() for kk, k in (("model", "schema_model"), ("r2v", "schema_r2v"), ("se", "schema_se"))
                    if v.get(kk) == model_id and v.get(k)), None)
        if url:
            try:
                with httpx.Client(timeout=20) as c:
                    r = c.get(url)
                if r.status_code < 400:
                    sch = r.json()
                    f.write_text(json.dumps(sch), encoding="utf-8")
            except (httpx.HTTPError, ValueError):
                sch = None
    _schemas[model_id] = sch
    return sch


def _props(sch: dict) -> dict:
    """خانات الإدخال من أي شكل schema (OpenAPI أو JSON schema عادي)."""
    if not isinstance(sch, dict):
        return {}
    for path in (("properties",), ("input", "properties"), ("components", "schemas", "Input", "properties"),
                 ("request", "properties"), ("parameters", "properties")):
        cur = sch
        for p in path:
            cur = cur.get(p) if isinstance(cur, dict) else None
        if isinstance(cur, dict) and cur:
            return cur
    # OpenAPI: أول schema فيه prompt
    for v in ((sch.get("components") or {}).get("schemas") or {}).values():
        if isinstance(v, dict) and "prompt" in (v.get("properties") or {}):
            return v["properties"]
    return {}


def _fit(value, spec: dict):
    """القيمة لأقرب اختيار مسموح (enum) أو جوه الحدود (minimum / maximum)."""
    if not isinstance(spec, dict):
        return value
    enum = spec.get("enum")
    if enum:
        if value in enum:
            return value
        num = None
        try:
            num = float(value)
        except (TypeError, ValueError):
            pass
        if num is not None and not isinstance(value, bool):
            value = num
            nums = [e for e in enum if isinstance(e, (int, float)) or str(e).isdigit()]
            if nums:
                best = min(nums, key=lambda e: abs(float(e) - float(value)))
                return type(enum[0])(best) if not isinstance(best, type(enum[0])) else best
        if str(value) in map(str, enum):
            return next(e for e in enum if str(e) == str(value))
        return spec.get("default", enum[0])
    if isinstance(value, (int, float)):
        lo, hi = spec.get("minimum"), spec.get("maximum")
        if lo is not None:
            value = max(value, lo)
        if hi is not None:
            value = min(value, hi)
        if spec.get("type") == "integer":
            value = int(round(value))
    return value


def adapt(body: dict) -> dict:
    """نفس الطلب، بأسماء خانات الموديل ده وقيم مسموحة عنده. Seedance (اللي البرنامج مبني عليه) بيعدّي زي ما هو."""
    model = str(body.get("model") or "")
    if not model or model.startswith("bytedance/seedance"):
        return body
    props = _props(_schema_for(model) or {})
    if not props:
        return body
    out = {"model": model}
    for k, v in body.items():
        if k == "model" or v is None:
            continue
        name = next((a for a in ALIASES.get(k, (k,)) if a in props), None)
        if name is None:
            # موديل صورة واحدة ومعانا مراجع: أول مرجع بيبقى الصورة
            if k == "reference_images" and v:
                img = next((a for a in ALIASES["image"] if a in props), None)
                if img and img not in out:
                    out[img] = v[0]
            continue
        spec = props.get(name) or {}
        if spec.get("type") == "string" and isinstance(v, list):
            v = v[0] if v else None
        elif spec.get("type") == "array" and not isinstance(v, list):
            v = [v]
        elif spec.get("type") == "string" and isinstance(v, (int, float)) and not isinstance(v, bool):
            v = str(v)
        out[name] = _fit(v, spec)
    return out
