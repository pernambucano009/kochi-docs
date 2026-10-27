"""🎙️ الصوت المباشر (المساعد اللي بيكلّم العميل لايف أول ما يسجّل): مختبر بيجرّب نماذج الصوت المباشر بكل لهجة.

- المتصفح بيكلّم المزوّد على طول (أسرع رد ممكن)، والسيرفر بيدّيه مفتاح مؤقت بس (المفتاح الأساسي ما بيطلعش من السيرفر).
- OpenAI: مفتاح مؤقت من /v1/realtime/client_secrets، والمتصفح بيوصل WebRTC على /v1/realtime/calls.
- Gemini Live: مفتاح مؤقت من /v1alpha/auth_tokens، والمتصفح بيوصل WebSocket على BidiGenerateContentConstrained.
- تقييمات الأدمن (النجوم وسرعة الرد والملاحظات) بتتحفظ في data/live_lab.json، وعليها هنختار النموذج لكل لهجة.
"""
from __future__ import annotations

import json
import os
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

OPENAI_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
GEMINI_URL = os.environ.get("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com")
OPENAI_VOICES = ["marin", "cedar", "coral", "sage", "shimmer", "ash", "ballad", "echo", "verse", "alloy"]
GEMINI_VOICES = ["Kore", "Puck", "Charon", "Zephyr", "Fenrir", "Leda", "Orus", "Aoede", "Callirrhoe", "Autonoe", "Enceladus", "Iapetus",
                 "Umbriel", "Algieba", "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar", "Alnilam", "Schedar",
                 "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi", "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat"]
# لو المزوّد ما رجعش قائمة النماذج (أو المفتاح لسه مش متسجل) بنعرض دول
OPENAI_MODELS = ["gpt-realtime-2.1", "gpt-realtime-2.1-mini", "gpt-realtime-2", "gpt-realtime", "gpt-realtime-mini"]
GEMINI_MODELS = ["gemini-live-2.5-flash-preview", "gemini-2.5-flash-native-audio-preview-09-2025"]
# دولار في الدقيقة تقريبًا (دخل وقت ما العميل بيتكلم، خرج وقت ما المساعد بيتكلم): تقدير للعرض بس، مش للفوترة
PRICE_PER_MIN = {"openai": (0.02, 0.08), "openai-mini": (0.006, 0.024), "gemini": (0.005, 0.018)}

# كل لهجة: اسمها، ووصف قصير للموديل، وجمل من اللهجة نفسها عشان يمسكها صح من أول كلمة
DIALECTS = {
    "ar-eg-cairo": ("🇪🇬 مصري", "Egyptian Arabic (Cairene colloquial)",
                    "أهلًا يا {name}، عامل إيه؟ أنا {agent}، مساعدك الشخصي. قبل ما نبدأ، احكيلي إنت بتشتغل في إيه؟ وإيه نوع المحتوى اللي بتعمله؟"),
    "ar-sa-najdi": ("🇸🇦 سعودي نجدي", "Saudi Najdi Arabic (Riyadh)",
                    "هلا والله يا {name}، كيف حالك؟ أنا {agent}، مساعدك الشخصي. قبل لا نبدأ، علّمني وش شغلك؟ ووش نوع المحتوى اللي تسويه؟"),
    "ar-sa-hijazi": ("🇸🇦 سعودي حجازي", "Saudi Hijazi Arabic (Jeddah, Makkah)",
                     "أهلين يا {name}، كيفك؟ أنا {agent}، مساعدك الشخصي. قبل ما نبدأ، قولّي إيش شغلك؟ وإيش نوع المحتوى اللي تسويه؟"),
    "ar-gulf": ("🌊 خليجي عام", "general Gulf Arabic",
                "هلا والله يا {name}، شلونك؟ أنا {agent}، مساعدك الشخصي. قبل لا نبدأ، قولي شنو شغلك؟ وشنو نوع المحتوى اللي تسويه؟"),
    "ar-ae": ("🇦🇪 إماراتي", "Emirati Arabic",
              "هلا والله يا {name}، شحالك؟ أنا {agent}، مساعدك الشخصي. قبل لا نبدا، خبرني شو شغلك؟ وشو نوع المحتوى اللي تسويه؟"),
    "ar-kw": ("🇰🇼 كويتي", "Kuwaiti Arabic",
              "هلا والله يا {name}، شلونك؟ أنا {agent}، مساعدك الشخصي. قبل لا نبدي، گولي شنو شغلك؟ وشنو المحتوى اللي تسويه؟"),
    "ar-qa": ("🇶🇦 قطري", "Qatari Arabic",
              "هلا والله يا {name}، شلونك؟ أنا {agent}، مساعدك الشخصي. قبل لا نبدا، قولي شو شغلك؟ وشنو المحتوى اللي تسويه؟"),
    "ar-bh": ("🇧🇭 بحريني", "Bahraini Arabic",
              "هلا والله يا {name}، شلونك؟ أنا {agent}، مساعدك الشخصي. قبل لا نبدي، قولي شنو شغلك؟ وشنو المحتوى اللي تسويه؟"),
    "ar-om": ("🇴🇲 عماني", "Omani Arabic",
              "هلا يا {name}، كيف حالك؟ أنا {agent}، مساعدك الشخصي. قبل لا نبدا، خبرني إيش شغلك؟ وإيش المحتوى اللي تسويه؟"),
    "ar-levant": ("🇱🇧 شامي", "Levantine Arabic (Syrian/Lebanese/Jordanian)",
                  "أهلين يا {name}، كيفك؟ أنا {agent}، مساعدك الشخصي. قبل ما نبلّش، احكيلي شو بتشتغل؟ وشو نوع المحتوى اللي بتعمله؟"),
    "ar-iq": ("🇮🇶 عراقي", "Iraqi Arabic (Baghdadi)",
              "هلا بيك يا {name}، شلونك؟ آني {agent}، مساعدك الشخصي. قبل لا نبدي، گلّي شنو شغلك؟ وشنو نوع المحتوى اللي تسويه؟"),
    "ar-sd": ("🇸🇩 سوداني", "Sudanese Arabic",
              "أهلًا يا {name}، كيفك؟ أنا {agent}، مساعدك الشخصي. قبل ما نبدأ، قول لي إنت شغال شنو؟ ونوع المحتوى البتعملو شنو؟"),
    "ar-ma": ("🇲🇦 مغربي", "Moroccan Darija",
              "مرحبا بيك أ {name}، لاباس عليك؟ أنا {agent}، المساعد ديالك. قبل ما نبداو، قول ليا شنو كتخدم؟ وشنو نوع المحتوى اللي كدير؟"),
    "ar-dz": ("🇩🇿 جزائري", "Algerian Darja",
              "مرحبا بيك يا {name}، واش راك؟ أنا {agent}، المساعد تاعك. قبل ما نبداو، قولي واش تخدم؟ وواش نوع المحتوى اللي دير؟"),
    "ar-tn": ("🇹🇳 تونسي", "Tunisian Derja",
              "عسلامة يا {name}، شنحوالك؟ أنا {agent}، المساعد متاعك. قبل ما نبداو، قلّي شنوة تخدم؟ وشنوة نوع المحتوى اللي تعمل فيه؟"),
    "ar-msa": ("📖 فصحى", "Modern Standard Arabic",
               "أهلًا بك يا {name}، كيف حالك؟ أنا {agent}، مساعدك الشخصي. قبل أن نبدأ، أخبرني ما عملك؟ وما نوع المحتوى الذي تقدّمه؟"),
}


def instructions(dialect: str, agent: str = "إيرل", user: str = "محمود") -> str:
    label, lang, sample = DIALECTS.get(dialect) or DIALECTS["ar-eg-cairo"]
    return f"""You are {agent}, the friendly personal assistant of SimsimKit, an AI platform that makes social-media videos for businesses.
The user ({user}) just signed up. Speak ONLY in {lang} ({label}), exactly like a native speaker from there talks in daily life:
natural, warm, short sentences, never Modern Standard Arabic unless the dialect IS Modern Standard Arabic. Never switch dialects.
Example of how you sound in this dialect: «{sample.format(name=user, agent=agent)}»

Your job in this call:
1. Greet {user} by name, introduce yourself in one sentence, and say you'll show what SimsimKit can do after a few quick questions.
2. Ask ONE short question at a time to learn about the business: what they do, their field, who their customers are,
   their city/market, their social accounts, what content they make now, and their goal. React briefly and naturally to each answer.
3. Keep every turn under ~2 short sentences. If the user interrupts, stop and listen. If they go off-topic, answer briefly and come back.
4. Never mention the names of the AI models or companies behind the platform."""


# ---------------------------------------------------------------- مفاتيح مؤقتة للمتصفح
class LiveError(Exception):
    pass


def openai_key() -> str:
    return (os.environ.get("OPENAI_API_KEY") or "").strip()


def gemini_key() -> str:
    return (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip()


def _fail(r: httpx.Response, who: str) -> None:
    if r.status_code >= 400:
        raise LiveError(f"{who} رد بخطأ {r.status_code}: {r.text[:400]}")


def openai_secret(model: str, voice: str, instr: str, eagerness: str = "auto") -> dict:
    key = openai_key()
    if not key:
        raise LiveError("مفتاح OpenAI غير مسجل. ضعه من ⚙️ الإعدادات ← بقية مفاتيح المنصة")
    session = {"type": "realtime", "model": model, "instructions": instr,
               "audio": {"input": {"transcription": {"model": "gpt-4o-mini-transcribe"},
                                   "turn_detection": {"type": "semantic_vad", "eagerness": eagerness, "interrupt_response": True, "create_response": True}},
                         "output": {"voice": voice}}}
    r = httpx.post(f"{OPENAI_URL}/realtime/client_secrets", headers={"Authorization": f"Bearer {key}"},
                   json={"expires_after": {"anchor": "created_at", "seconds": 600}, "session": session}, timeout=30)
    _fail(r, "OpenAI")
    d = r.json()
    return {"value": d.get("value"), "expires_at": d.get("expires_at")}


def gemini_token() -> dict:
    key = gemini_key()
    if not key:
        raise LiveError("مفتاح Gemini غير مسجل. ضعه من ⚙️ الإعدادات ← بقية مفاتيح المنصة")
    now = datetime.now(timezone.utc)
    body = {"uses": 1, "expireTime": (now + timedelta(minutes=30)).isoformat().replace("+00:00", "Z"),
            "newSessionExpireTime": (now + timedelta(minutes=2)).isoformat().replace("+00:00", "Z")}
    r = httpx.post(f"{GEMINI_URL}/v1alpha/auth_tokens", params={"key": key}, json=body, timeout=30)
    _fail(r, "Gemini")
    return {"value": r.json().get("name")}


_models: dict = {"at": 0.0, "v": None}


def models() -> dict:
    """النماذج المتاحة فعلًا بالمفاتيح المتسجلة (الأسماء بتتغير كتير، فبنسأل المزوّد نفسه)."""
    if _models["v"] and time.time() - _models["at"] < 600:
        return _models["v"]
    oa, gm = list(OPENAI_MODELS), list(GEMINI_MODELS)
    if openai_key():
        try:
            r = httpx.get(f"{OPENAI_URL}/models", headers={"Authorization": f"Bearer {openai_key()}"}, timeout=20)
            found = sorted({m["id"] for m in r.json().get("data", []) if "realtime" in m.get("id", "") and "transcri" not in m["id"]}, reverse=True)
            if found:
                oa = [m for m in OPENAI_MODELS if m in found] + [m for m in found if m not in OPENAI_MODELS]
        except (httpx.HTTPError, ValueError, KeyError):
            pass
    if gemini_key():
        try:
            r = httpx.get(f"{GEMINI_URL}/v1beta/models", params={"key": gemini_key(), "pageSize": 1000}, timeout=20)
            found = [m["name"].split("/", 1)[-1] for m in r.json().get("models", []) if "bidiGenerateContent" in (m.get("supportedGenerationMethods") or [])]
            if found:
                gm = sorted(found, key=lambda m: (("native-audio" not in m and "live" not in m), m), reverse=False)
        except (httpx.HTTPError, ValueError, KeyError):
            pass
    v = {"openai": {"ready": bool(openai_key()), "models": oa, "voices": OPENAI_VOICES},
         "gemini": {"ready": bool(gemini_key()), "models": gm, "voices": GEMINI_VOICES},
         "dialects": [{"code": k, "label": v[0]} for k, v in DIALECTS.items()], "price": PRICE_PER_MIN}
    if openai_key() or gemini_key():
        _models.update(at=time.time(), v=v)
    return v


# ---------------------------------------------------------------- التقييمات
_lock = threading.Lock()


def _file(data_dir: Path) -> Path:
    return data_dir / "live_lab.json"


def results(data_dir: Path) -> list[dict]:
    try:
        return json.loads(_file(data_dir).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []


def save_result(data_dir: Path, r: dict) -> dict:
    keep = ("provider", "model", "voice", "dialect", "stars", "dialect_ok", "notes", "latency_ms", "latencies", "seconds", "interrupts", "cost")
    row = {k: r.get(k) for k in keep}
    row.update(id=uuid.uuid4().hex[:10], at=time.time())
    with _lock:
        rows = results(data_dir)
        rows.append(row)
        _file(data_dir).parent.mkdir(parents=True, exist_ok=True)
        _file(data_dir).write_text(json.dumps(rows[-2000:], ensure_ascii=False), encoding="utf-8")
    return row


def delete_result(data_dir: Path, rid: str) -> None:
    with _lock:
        rows = [x for x in results(data_dir) if x.get("id") != rid]
        _file(data_dir).write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")


def summary(rows: list[dict]) -> list[dict]:
    """لكل لهجة × نموذج × صوت: متوسط النجوم وسرعة الرد، ونسبة «اللهجة صح»."""
    g: dict[tuple, list] = {}
    for x in rows:
        g.setdefault((x.get("dialect"), x.get("provider"), x.get("model"), x.get("voice")), []).append(x)
    out = []
    for (d, p, m, v), xs in g.items():
        st = [x["stars"] for x in xs if x.get("stars")]
        lat = [x["latency_ms"] for x in xs if x.get("latency_ms")]
        ok = [x["dialect_ok"] for x in xs if x.get("dialect_ok") is not None]
        out.append({"dialect": d, "provider": p, "model": m, "voice": v, "n": len(xs),
                    "stars": round(sum(st) / len(st), 2) if st else None,
                    "latency_ms": int(sorted(lat)[len(lat) // 2]) if lat else None,
                    "dialect_ok": round(100 * sum(1 for o in ok if o) / len(ok)) if ok else None})
    return sorted(out, key=lambda r: (r["dialect"] or "", -(r["stars"] or 0)))
