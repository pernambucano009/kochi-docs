"""🎧 مختبر الأصوات (لصاحب المنصة): نفس الجملة بكل مزوّد وكل لهجة جنب بعض، وتقييم، وكلون صوت بين ElevenLabs و MiniMax.

المزودين المباشرين هنا (فصيح ومنصت وElevenLabs-عن-طريق-Atlas موجودين في app.py/dub.py):
- ElevenLabs مباشر (ELEVENLABS_API_KEY): نص ← صوت بموديل eleven_v3، وكلون صوت (يحتاج اشتراك Starter على الأقل).
- MiniMax مباشر (MINIMAX_API_KEY): نص ← صوت (speech-02-hd) مع language_boost، وكلون صوت بالدفع على قد الاستخدام.
- SILMA (SILMA_API_KEY): WebSocket ‎wss://api.silma.ai/tts/v2/ws/stream، موديل فصحى أو سعودي، والصوت float32 بـ 24kHz.
"""
from __future__ import annotations

import base64
import json
import os
import struct
import uuid
import wave
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


def minimax_key() -> str:
    return _key("MINIMAX_API_KEY")


def silma_key() -> str:
    return _key("SILMA_API_KEY")


def _fail(resp: httpx.Response, who: str) -> LabError:
    err = _fail_msg(resp, who)
    # لو السبب الرصيد: يتسجّل في «رصيد المنصات» ويتبعت تنبيه للأدمن
    prov = {"ElevenLabs": "eleven", "MiniMax": "minimax", "SILMA": "silma"}.get(who)
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


# ---------------------------------------------------------------- MiniMax
MM_BASE = "https://api.minimax.io/v1"
MM_MODEL = "speech-02-hd"


def _mm_headers() -> dict:
    return {"Authorization": f"Bearer {minimax_key()}"}


def minimax_say(text: str, voice_id: str, dest: Path, boost: str = "Arabic") -> Path:
    body = {"model": MM_MODEL, "text": text, "stream": False, "language_boost": boost, "output_format": "hex",
            "voice_setting": {"voice_id": voice_id, "speed": 1, "vol": 1, "pitch": 0},
            "audio_setting": {"sample_rate": 32000, "bitrate": 128000, "format": "mp3", "channel": 1}}
    with httpx.Client(timeout=180) as c:
        r = c.post(f"{MM_BASE}/t2a_v2", headers=_mm_headers(), json=body)
    if r.status_code >= 400:
        raise _fail(r, "MiniMax")
    d = r.json()
    if (d.get("base_resp") or {}).get("status_code") not in (0, None):
        msg = f"MiniMax: {(d.get('base_resp') or {}).get('status_msg')}"
        providers.note_error("minimax", msg)
        raise LabError(msg)
    audio = (d.get("data") or {}).get("audio") or ""
    if not audio:
        raise LabError("MiniMax: مارجعش صوت")
    dest.write_bytes(bytes.fromhex(audio))
    return dest


def minimax_voices() -> list[dict]:
    """الأصوات الجاهزة عند MiniMax (العربي الأول لو موجود)."""
    with httpx.Client(timeout=30) as c:
        r = c.post(f"{MM_BASE}/get_voice", headers=_mm_headers(), json={"voice_type": "system"})
    if r.status_code >= 400:
        raise _fail(r, "MiniMax")
    vs = [{"id": v.get("voice_id"), "name": v.get("voice_name") or v.get("voice_id")} for v in r.json().get("system_voice") or [] if v.get("voice_id")]
    return sorted(vs, key=lambda v: not str(v["id"]).lower().startswith("arabic"))


def minimax_clone(sample: Path) -> str:
    """رفع العينة ← كلون ← voice_id جديد (بيتحاسب أول ما يتستخدم في نطق)."""
    with httpx.Client(timeout=180) as c, sample.open("rb") as f:
        r = c.post(f"{MM_BASE}/files/upload", headers=_mm_headers(), data={"purpose": "voice_clone"}, files={"file": (sample.name, f, "audio/mpeg")})
        if r.status_code >= 400:
            raise _fail(r, "MiniMax (رفع العينة)")
        fid = ((r.json().get("file") or {}).get("file_id"))
        if not fid:
            raise LabError(f"MiniMax: الرفع مارجعش file_id ({str(r.json())[:160]})")
        vid = "sk" + uuid.uuid4().hex[:14]
        r = c.post(f"{MM_BASE}/voice_clone", headers=_mm_headers(), json={"file_id": fid, "voice_id": vid})
    if r.status_code >= 400:
        raise _fail(r, "MiniMax (الاستنساخ)")
    if (r.json().get("base_resp") or {}).get("status_code") not in (0, None):
        raise LabError(f"MiniMax: {(r.json().get('base_resp') or {}).get('status_msg')}")
    return vid


# ---------------------------------------------------------------- SILMA
SILMA_WS = "wss://api.silma.ai/tts/v2/ws/stream"
SILMA_RATE = 24000
SILMA_VOICES = {"sarah": "سارة", "salma": "سلمى", "salwa": "سلوى", "saja": "سجى", "sultan": "سلطان", "salman": "سلمان", "sulaiman": "سليمان", "salim": "سالم"}
SILMA_MODELS = {"msa": "silma-tts-v2-msa", "ksa": "silma-tts-v2-ksa"}


def _chunks(text: str, n: int = 240) -> list[str]:
    """SILMA بيقبل لحد ٢٥٠ حرف في الطلب: بنقسم على الكلام."""
    out, cur = [], ""
    for w in text.split():
        if cur and len(cur) + 1 + len(w) > n:
            out.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    return out + ([cur] if cur else [])


def silma_say(text: str, voice: str, model: str, dest: Path) -> Path:
    from websockets.sync.client import connect   # بيتحمّل وقت الحاجة بس

    pcm = bytearray()
    with connect(SILMA_WS, additional_headers={"apiKey": silma_key()}, open_timeout=20, close_timeout=2, max_size=None) as ws:
        for part in _chunks(text):
            ws.send(json.dumps({"model_id": model, "text": part, "voice_id": voice}))
            while True:
                msg = ws.recv(timeout=90)
                if isinstance(msg, (bytes, bytearray)):
                    pcm += msg
                    continue
                try:
                    ev = json.loads(msg)
                except ValueError:
                    continue
                if ev.get("audio"):
                    pcm += base64.b64decode(ev["audio"])
                if ev.get("error") or ev.get("status") in ("error", "failed"):
                    raise LabError(f"SILMA: {str(ev.get('error') or ev.get('message') or ev)[:200]}")
                if ev.get("status") == "completed":
                    break
    n = len(pcm) // 4
    if not n:
        raise LabError("SILMA: مارجعش صوت")
    floats = struct.unpack(f"<{n}f", bytes(pcm[:n * 4]))
    ints = struct.pack(f"<{n}h", *(max(-32767, min(32767, int(x * 32767))) for x in floats))
    with wave.open(str(dest), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SILMA_RATE)
        w.writeframes(ints)
    return dest


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
