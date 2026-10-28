"""🎧 مختبر الأصوات (لصاحب المنصة): نفس الجملة بكل مزوّد وكل لهجة جنب بعض، وتقييم، وكلون صوت بـ ElevenLabs.

المزودين المباشرين هنا (فصيح ومنصت وElevenLabs-عن-طريق-Atlas موجودين في app.py/dub.py):
- ElevenLabs مباشر (ELEVENLABS_API_KEY): نص ← صوت بموديل eleven_v3، وكلون صوت (يحتاج اشتراك Starter على الأقل).
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import httpx

import providers


class LabError(RuntimeError):
    pass


def _key(*names: str) -> str:
    for n in names:
        v = (os.environ.get(n) or "").strip().strip('"').strip("'")
        if v:
            return v
    return ""


def eleven_key() -> str:
    return _key("ELEVENLABS_API_KEY", "ELEVEN_API_KEY")


def _fail(resp: httpx.Response, who: str) -> LabError:
    err = _fail_msg(resp, who)
    # لو السبب الرصيد: يتسجّل في «رصيد المنصات» ويتبعت تنبيه للأدمن
    prov = {"ElevenLabs": "eleven"}.get(who)
    if prov:
        providers.note_error(prov, f"{resp.status_code} {err}")
    return err


def _fail_msg(resp: httpx.Response, who: str) -> LabError:
    try:
        d = resp.json()
        msg = d.get("detail") or d.get("message") or (d.get("base_resp") or {}).get("status_msg") or d
    except ValueError:
        msg = resp.text[:200]
    if isinstance(msg, dict):
        msg = msg.get("message") or msg.get("status") or json.dumps(msg, ensure_ascii=False)[:200]
    return LabError(f"{who}: {str(msg)[:200]} ({resp.status_code})")


# ---------------------------------------------------------------- ElevenLabs
EL_BASE = "https://api.elevenlabs.io/v1"


def eleven_stems(src: Path, out_dir: Path, variant: str = "two_stems_v1") -> dict[str, Path]:
    """🎚️ فصل الصوت (بدل AudioShake): two_stems_v1 = الكلام + كل حاجة تانية (موسيقى ومؤثرات).
    بيرجع ZIP فيه ملف لكل تراك؛ بنفكّه ونرجّع {اسم التراك: الملف}."""
    import zipfile  # noqa: PLC0415
    with httpx.Client(timeout=900) as c, src.open("rb") as f:
        r = c.post(f"{EL_BASE}/music/stem-separation", params={"output_format": "mp3_44100_128"},
                   headers={"xi-api-key": eleven_key(), "Accept": "application/zip"},
                   files={"file": (src.name, f, "audio/mpeg")}, data={"stem_variation_id": variant})
    if r.status_code >= 400:
        raise _fail(r, "ElevenLabs")
    out_dir.mkdir(parents=True, exist_ok=True)
    zp = out_dir / "stems.zip"
    zp.write_bytes(r.content)
    got: dict[str, Path] = {}
    with zipfile.ZipFile(zp) as z:
        for n in z.namelist():
            if n.endswith("/") or not n.lower().endswith((".mp3", ".wav", ".flac", ".m4a", ".ogg")):
                continue
            stem = Path(n).stem.lower()
            key = "vocals" if "vocal" in stem else ("instrumental" if "instrument" in stem or "accomp" in stem else stem)
            dest = out_dir / f"{key}{Path(n).suffix.lower()}"
            dest.write_bytes(z.read(n))
            got[key] = dest
    zp.unlink(missing_ok=True)
    if not got:
        raise LabError("ElevenLabs: لم يرجع تراكات")
    return got


def eleven_voices() -> list[dict]:
    """الأصوات الجاهزة في الحساب (premade + اللي اتعملت)."""
    with httpx.Client(timeout=30) as c:
        r = c.get(f"{EL_BASE}/voices", headers={"xi-api-key": eleven_key()})
    if r.status_code >= 400:
        raise _fail(r, "ElevenLabs")
    return [{"id": v["voice_id"], "name": v.get("name") or "", "gender": (v.get("labels") or {}).get("gender") or "", "cat": v.get("category") or ""}
            for v in r.json().get("voices") or []]


def eleven_say(text: str, voice_id: str, dest: Path, model: str = "eleven_v3") -> Path:
    with httpx.Client(timeout=180) as c:
        r = c.post(f"{EL_BASE}/text-to-speech/{voice_id}", params={"output_format": "mp3_44100_128"},
                   headers={"xi-api-key": eleven_key(), "accept": "audio/mpeg"}, json={"text": text, "model_id": model})
    if r.status_code >= 400:
        raise _fail(r, "ElevenLabs")
    dest.write_bytes(r.content)
    return dest


def eleven_clone(sample: Path, name: str) -> str:
    """كلون فوري: يرجع voice_id (بيتمسح بعد التجربة علشان مايشغلش خانة في الحساب)."""
    with httpx.Client(timeout=180) as c, sample.open("rb") as f:
        r = c.post(f"{EL_BASE}/voices/add", headers={"xi-api-key": eleven_key()}, data={"name": name[:60]},
                   files={"files": (sample.name, f, "audio/mpeg")})
    if r.status_code >= 400:
        raise _fail(r, "ElevenLabs (الاستنساخ يحتاج إلى اشتراك Starter على الأقل)")
    return r.json()["voice_id"]


def eleven_delete(voice_id: str) -> None:
    try:
        with httpx.Client(timeout=30) as c:
            c.delete(f"{EL_BASE}/voices/{voice_id}", headers={"xi-api-key": eleven_key()})
    except httpx.HTTPError:
        pass


# ---------------------------------------------------------------- دبلجة ElevenLabs (للمقارنة مع دبلجتنا بفصيح)
# الفيديو كله ← ElevenLabs بيترجم ويدبلج بصوت المتكلم نفسه (من غير اختيار لهجة). بيتحاسب على قد دقايق الفيديو.

def eleven_dub_start(src: Path, target: str = "ar", source: str = "auto") -> str:
    def send(watermark: str) -> httpx.Response:
        with httpx.Client(timeout=300) as c, src.open("rb") as f:
            return c.post(f"{EL_BASE}/dubbing", headers={"xi-api-key": eleven_key()},
                          data={"target_lang": target, "source_lang": source, "num_speakers": "0", "watermark": watermark},
                          files={"file": (src.name, f, "video/mp4" if src.suffix.lower() in (".mp4", ".mov", ".m4v") else "application/octet-stream")})
    r = send("false")
    # الباقة المجانية في ElevenLabs بتدبلج بس بعلامة مائية: للمقارنة ده كفاية، فبنعيد الطلب بالعلامة بدل ما يفشل
    if r.status_code == 400 and "watermark" in r.text.lower():
        r = send("true")
    if r.status_code >= 400:
        raise _fail(r, "ElevenLabs (الدبلجة)")
    return r.json()["dubbing_id"]


def eleven_dub_status(dub_id: str) -> dict:
    with httpx.Client(timeout=30) as c:
        r = c.get(f"{EL_BASE}/dubbing/{dub_id}", headers={"xi-api-key": eleven_key()})
    if r.status_code >= 400:
        raise _fail(r, "ElevenLabs (حالة الدبلجة)")
    return r.json()


def eleven_dub_get(dub_id: str, lang: str, dest: Path) -> Path:
    with httpx.Client(timeout=300) as c:
        r = c.get(f"{EL_BASE}/dubbing/{dub_id}/audio/{lang}", headers={"xi-api-key": eleven_key()})
    if r.status_code >= 400:
        raise _fail(r, "ElevenLabs (تنزيل الدبلجة)")
    dest.write_bytes(r.content)
    return dest
