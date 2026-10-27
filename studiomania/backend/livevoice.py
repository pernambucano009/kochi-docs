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

# كل لهجة: اسمها، ووصفها للموديل، وجملة الافتتاح بلهجتها (صاحب المنصة كتب المصري، والباقي على نفس المعنى)
# الجملة فيها {name} (اسم العميل) و{agent} (اسم المساعد)، وبصيغة المساعدة البنت؛ الموديل بيعدّل الضماير لو المساعد ولد أو العميل بنت
DIALECTS = {
    "ar-eg-cairo": ("🇪🇬 مصري", "Egyptian Arabic (Cairene colloquial)",
                    "إزيك يا {name}؟ أنا {agent}، وجاية النهارده عشان أضمن إن رحلتك مع سمسمكيت تكون ألطف ما يكون. ها، مستعد ندردش شوية عشان أتعرف عليك أكتر؟"),
    "ar-sa-najdi": ("🇸🇦 سعودي نجدي", "Saudi Najdi Arabic (Riyadh)",
                    "هلا والله يا {name}، كيف حالك؟ أنا {agent}، وجيتك اليوم عشان أضمن إن رحلتك مع سمسمكيت تكون أحلى ما يكون. ها، جاهز نسولف شوي عشان أتعرف عليك أكثر؟"),
    "ar-sa-hijazi": ("🇸🇦 سعودي حجازي", "Saudi Hijazi Arabic (Jeddah, Makkah)",
                     "أهلين يا {name}، كيفك؟ أنا {agent}، وجيت اليوم عشان أضمن إن رحلتك مع سمسمكيت تكون ألطف شي. ها، جاهز ندردش شوية عشان أتعرف عليك أكتر؟"),
    "ar-gulf": ("🌊 خليجي عام", "general Gulf Arabic",
                "هلا والله يا {name}، شلونك؟ أنا {agent}، وجيت اليوم عشان أضمن إن رحلتك مع سمسمكيت تكون أحلى ما يكون. ها، جاهز نسولف شوي عشان أتعرف عليك أكثر؟"),
    "ar-ae": ("🇦🇪 إماراتي", "Emirati Arabic",
              "هلا والله يا {name}، شحالك؟ أنا {agent}، وياية اليوم عشان أضمن إن رحلتك ويا سمسمكيت تكون أحلى ما يكون. ها، مستعد نسولف شوي عشان أتعرف عليك أكثر؟"),
    "ar-kw": ("🇰🇼 كويتي", "Kuwaiti Arabic",
              "هلا والله يا {name}، شلونك؟ أنا {agent}، وجاية اليوم عشان أضمن إن رحلتك ويا سمسمكيت تكون أحلى شي. ها، جاهز نسولف شوي عشان أتعرف عليك أكثر؟"),
    "ar-qa": ("🇶🇦 قطري", "Qatari Arabic",
              "هلا والله يا {name}، شلونك؟ أنا {agent}، وجاية اليوم عشان أضمن إن رحلتك ويا سمسمكيت تكون أحلى ما يكون. ها، مستعد نسولف شوي عشان أتعرف عليك أكثر؟"),
    "ar-bh": ("🇧🇭 بحريني", "Bahraini Arabic",
              "هلا والله يا {name}، شلونك؟ أنا {agent}، وجاية اليوم عشان أضمن إن رحلتك ويا سمسمكيت تكون أحلى شي. ها، جاهز نسولف شوي عشان أتعرف عليك أكثر؟"),
    "ar-om": ("🇴🇲 عماني", "Omani Arabic",
              "هلا يا {name}، كيف حالك؟ أنا {agent}، وجاية اليوم عشان أضمن إن رحلتك مع سمسمكيت تكون أحلى ما يكون. ها، مستعد نسولف شوي عشان أتعرف عليك أكثر؟"),
    "ar-levant": ("🇱🇧 شامي", "Levantine Arabic (Syrian/Lebanese/Jordanian)",
                  "كيفك يا {name}؟ أنا {agent}، وجاية اليوم لأتأكد إنو رحلتك مع سمسمكيت تكون أحلى ما يكون. شو، جاهز نحكي شوي لأتعرّف عليك أكتر؟"),
    "ar-iq": ("🇮🇶 عراقي", "Iraqi Arabic (Baghdadi)",
              "هلا بيك يا {name}، شلونك؟ آني {agent}، وجاية اليوم حتى أضمن إن رحلتك ويا سمسمكيت تكون أحلى شي. ها، حاضر نسولف شوية حتى أتعرف عليك أكثر؟"),
    "ar-sd": ("🇸🇩 سوداني", "Sudanese Arabic",
              "كيفك يا {name}؟ أنا {agent}، وجاية الليلة عشان أضمن إنو رحلتك مع سمسمكيت تكون أحلى حاجة. ها، جاهز نتونس شوية عشان أتعرف عليك أكتر؟"),
    "ar-ma": ("🇲🇦 مغربي", "Moroccan Darija",
              "لاباس عليك أ {name}؟ أنا {agent}، وجيت اليوم باش نضمن بلي الرحلة ديالك مع سمسمكيت تكون زوينة بزاف. واش واجد نهضرو شوية باش نتعرف عليك كثر؟"),
    "ar-dz": ("🇩🇿 جزائري", "Algerian Darja",
              "واش راك يا {name}؟ أنا {agent}، وجيت اليوم باش نضمن بلي الرحلة تاعك مع سمسمكيت تكون مليحة بزاف. واش راك واجد نهدرو شوية باش نتعرف عليك كثر؟"),
    "ar-tn": ("🇹🇳 تونسي", "Tunisian Derja",
              "شنحوالك يا {name}؟ أنا {agent}، وجيت اليوم باش نضمن إلي الرحلة متاعك مع سمسمكيت تكون باهية برشا. حاضر نحكيو شوية باش نتعرف عليك أكثر؟"),
    "ar-msa": ("📖 فصحى", "Modern Standard Arabic",
               "كيف حالك يا {name}؟ أنا {agent}، وجئت اليوم لأضمن أن تكون رحلتك مع سمسمكيت ألطف ما يكون. هل أنت مستعد لنتحدث قليلًا لأتعرف عليك أكثر؟"),
}
# اسم المساعد في كل لهجة (أقرب لأهلها): (اسم بنت، اسم ولد). الاسم لازم يمشي مع الصوت
AGENT_NAMES = {
    "ar-eg-cairo": ("سعاد", "كريم"), "ar-sa-najdi": ("نورة", "فهد"), "ar-sa-hijazi": ("ريم", "ماجد"), "ar-gulf": ("مريم", "خالد"),
    "ar-ae": ("ميثاء", "حمدان"), "ar-kw": ("دانة", "مشاري"), "ar-qa": ("العنود", "جاسم"), "ar-bh": ("فاطمة", "علي"), "ar-om": ("شيخة", "سالم"),
    "ar-levant": ("لين", "كرم"), "ar-iq": ("زينب", "حيدر"), "ar-sd": ("آمنة", "عثمان"), "ar-ma": ("سلمى", "يونس"), "ar-dz": ("أمينة", "ياسين"),
    "ar-tn": ("ياسمين", "أيمن"), "ar-msa": ("سارة", "عمر"),
}
# نوع كل صوت (عشان الاسم والضماير): f بنت، m ولد
VOICE_GENDER = {"marin": "f", "cedar": "m", "coral": "f", "sage": "f", "shimmer": "f", "alloy": "f", "ash": "m", "ballad": "m", "echo": "m", "verse": "m",
                "Kore": "f", "Puck": "m", "Charon": "m", "Zephyr": "f", "Fenrir": "m", "Leda": "f", "Orus": "m", "Aoede": "f", "Callirrhoe": "f",
                "Autonoe": "f", "Enceladus": "m", "Iapetus": "m", "Umbriel": "m", "Algieba": "m", "Despina": "f", "Erinome": "f", "Algenib": "m",
                "Rasalgethi": "m", "Laomedeia": "f", "Achernar": "f", "Alnilam": "m", "Schedar": "m", "Gacrux": "f", "Pulcherrima": "f",
                "Achird": "m", "Zubenelgenubi": "m", "Vindemiatrix": "f", "Sadachbia": "m", "Sadaltager": "m", "Sulafat": "f"}
# أسئلة العقل اللي الموديل بيسألها بالترتيب (من نفس كويز العقل، عشان كل إجابة تروح خانتها)
SKIP_Q = {"language", "link", "type"}   # اللهجة معروفة من التسجيل، والحساب بيتطلب الأول، والنوع بيبان من الوصف


def agent_name(dialect: str, gender: str) -> str:
    f, m = AGENT_NAMES.get(dialect) or AGENT_NAMES["ar-eg-cairo"]
    return m if gender == "m" else f


def quiz_questions() -> list[str]:
    try:
        import brainquiz  # noqa: PLC0415
        return [q["ar"] for q in brainquiz.Q if q["id"] not in SKIP_Q]
    except Exception:  # noqa: BLE001
        return ["ما مجال عملك؟", "صِف مشروعك: ماذا تقدم، وما الذي يميزك؟", "من هو عميلك المثالي؟", "في أي مدينة أو دولة عملاؤك؟"]


def instructions(dialect: str, agent: str = "", user: str = "محمود", agent_gender: str = "f", user_gender: str = "m") -> str:
    label, lang, sample = DIALECTS.get(dialect) or DIALECTS["ar-eg-cairo"]
    agent = agent or agent_name(dialect, agent_gender)
    # من غير أمثلة بلهجة معيّنة: المثال المصري كان بيشد الموديل للمصري في اللهجات التانية
    me = "a woman: use feminine forms whenever you talk about yourself" if agent_gender != "m" else "a man: use masculine forms whenever you talk about yourself"
    you = ("a woman: address her ONLY with feminine pronouns, verbs and adjectives" if user_gender == "f" else
           "a man: address him ONLY with masculine pronouns, verbs and adjectives")
    qs = "\n".join(f"   {i + 1}. {q}" for i, q in enumerate(quiz_questions()))
    return f"""You are {agent}, the personal assistant of SimsimKit, a platform that makes social-media videos for businesses.
The user, {user}, just signed up. Speak ONLY in {lang} ({label}), exactly like a native speaker from there talks in daily life:
warm, natural, short sentences. Never use Modern Standard Arabic unless the dialect IS Modern Standard Arabic. Never switch dialects.
Grammar of gender (very important in Arabic): you are {me}. The user is {you}.

Follow this order:
1. Open with this, adapted naturally to the gender rules above: «{sample.format(name=user, agent=agent)}» Then wait for the answer.
2. Ask for their Instagram or TikTok account first, and explain in one sentence why: the analysis takes a while, so the team starts on it now
   and the results are ready by the end of the chat. When they give it, thank them in a few words and move on.
3. Then ask these questions, ONE per turn, in this order, rephrased in the dialect (skip one if the user already answered it):
{qs}
4. When done, thank them and tell them you are preparing what you found.

Rules:
- Keep every turn to 1–2 short sentences. React to each answer in a few words before the next question.
- If the user interrupts, stop and listen. If they go off-topic, answer briefly and come back to the next question.
- Only use facts the user actually said. Never assume a business, product or detail they did not say, and never mix in an example
  as if it were theirs. If you did not hear clearly, ask them to repeat it, without guessing alternatives.
- Never mention the names of the AI models or companies behind the platform."""


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
               "audio": {"input": {"transcription": {"model": "gpt-4o-mini-transcribe"}, "noise_reduction": {"type": "near_field"},
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
         "agents": AGENT_NAMES, "voice_gender": VOICE_GENDER,
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
