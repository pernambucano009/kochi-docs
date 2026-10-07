"""تفريغ الكلام على السيرفر نفسه (Whisper مفتوح المصدر) من غير أي خدمة برّه.

بيشتغل لو STT_LOCAL=1 ومكتبة faster-whisper متثبتة (الـ Dockerfile بيثبتها لو LOCAL_STT=1 وقت البناء).
الموديل بيتحمّل أول مرة بس (STT_LOCAL_MODEL، الافتراضي small: كويس في العربي وبيمشي على CPU).
"""
from __future__ import annotations

import os
import threading
from pathlib import Path

_model = None
_lock = threading.Lock()


def enabled() -> bool:
    if os.environ.get("STT_LOCAL") != "1":
        return False
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        return False
    return True


def _get():
    global _model
    with _lock:
        if _model is None:
            from faster_whisper import WhisperModel
            _model = WhisperModel(os.environ.get("STT_LOCAL_MODEL", "small"), device="cpu", compute_type="int8",
                                  download_root=os.environ.get("STT_LOCAL_DIR") or None)
        return _model


def transcribe(audio_path: Path) -> list[dict]:
    """صوت ← كلام بتوقيت كل كلمة: [{"w", "s", "e"}] (نفس شكل atlas.transcribe)."""
    segments, _info = _get().transcribe(str(audio_path), word_timestamps=True, vad_filter=True, beam_size=5)
    out = []
    for seg in segments:
        for w in seg.words or []:
            text = (w.word or "").strip()
            if text:
                out.append({"w": text, "s": round(float(w.start), 3), "e": round(float(w.end), 3)})
    return out
