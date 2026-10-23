"""🔒 سيناريو «علّق بكلمة»: قبل ما يوصله الرابط نسأله «هل تتابعنا؟».

ما يعلّق بالكلمة يوصله السؤال (الرد التلقائي على التعليق)، وعندما يرد على الخاص:
- «نعم / تم / عملت…» ← يوصله ما وعدناه به (الرابط أو الهدية).
- أي رد آخر ← «تابعنا أولًا وأرسل تم»، وعندما يرسل «تم» يوصله.
لا نتأكد من الفولو بجد (الخدمة مابتدّيش هذه المعلومة)، نصدّق إجابته.
الرسائل القادمة توصل من خدمة النشر للبوابة، والبوابة تعرف هذا الحساب الخاص بـ أي عميل من ملف dm_accounts.json.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import time
from pathlib import Path

import httpx

import publisher

DEFAULTS = {
    "on": True,
    "ask": "أهلًا! 👋 قبل ما أرسل لك ما طلبته، هل تتابعنا؟ رد بـ «نعم» أو «ليس بعد»",
    "nudge": "تابعنا أولًا 🙏 وبعدها أرسل «تم» وسأرسله لك مباشرة",
    "yes": ["نعم", "أيوة", "ايوه", "اه", "تم", "عملت", "عملته", "تابعت", "تابعتكم", "متابع", "فولو", "yes", "done", "ok", "اوكي"],
}
NO_WORDS = ["ليس بعد", "لسه", "لسة", "لا", "لأ", "مش", "مش لسه", "لم أتابع", "no", "not yet"]   # ردود على السؤال نفسه (لو ماعرفناش هو علّق على أنهي بوست)
GATE_DAYS = 14   # بعد كده السؤال بيتقفل
HOOK_PATH = "/hooks/zernio"
_TASHKEEL = re.compile(r"[ً-ٰٟـ]")


def norm(s: str) -> str:
    s = _TASHKEEL.sub("", str(s or "").strip().lower())
    s = re.sub(r"[أإآ]", "ا", s).replace("ة", "ه").replace("ى", "ي")
    return re.sub(r"[^\w\s]", " ", s).strip()


def settings(brain: dict | None) -> dict:
    raw = (brain or {}).get("dmflow") or {}
    out = {**DEFAULTS, **{k: raw[k] for k in DEFAULTS if k in raw}}
    out["yes"] = [str(w)[:30] for w in out["yes"] if str(w).strip()][:20] or DEFAULTS["yes"]
    return out


def clean_settings(raw: dict) -> dict:
    return {"on": bool(raw.get("on", True)), "ask": str(raw.get("ask") or DEFAULTS["ask"])[:900],
            "nudge": str(raw.get("nudge") or DEFAULTS["nudge"])[:900],
            "yes": [str(w).strip()[:30] for w in raw.get("yes") or DEFAULTS["yes"] if str(w).strip()][:20]}


def is_yes(text: str, words: list[str]) -> bool:
    t = norm(text)
    toks = set(t.split())
    return any((nw := norm(w)) and (nw in toks or (len(nw) > 3 and nw in t)) for w in words)


# ---------------------------------------------------------------- الحالة (ملف واحد في فولدر بيانات العميل)
class Store:
    def __init__(self, data_dir: Path):
        self.file = data_dir / "dmflow.json"
        self.accounts = data_dir / "dm_accounts.json"   # البوابة بتقراه علشان تعرف توصّل الرسايل لنسخة العميل الصح

    def load(self) -> dict:
        try:
            d = json.loads(self.file.read_text("utf-8"))
        except (OSError, ValueError):
            d = {}
        d.setdefault("gates", {})
        d.setdefault("people", {})
        d.setdefault("log", [])
        return d

    def save(self, d: dict) -> None:
        now = time.time()
        d["gates"] = {k: g for k, g in d["gates"].items() if now - g.get("at", 0) < GATE_DAYS * 86400}
        d["people"] = dict(list(d["people"].items())[-5000:])
        d["log"] = d["log"][-200:]
        self.file.write_text(json.dumps(d, ensure_ascii=False), "utf-8")
        accs = sorted({g["account"] for g in d["gates"].values() if g.get("account")})
        self.accounts.write_text(json.dumps(accs), "utf-8")

    def add_gate(self, automation_id: str, account: str, platform: str, reward: str, words: list[str], post_id: str, brand: str, flow: dict) -> None:
        d = self.load()
        d["gates"][automation_id] = {"account": account, "platform": platform, "reward": reward, "words": words, "post": post_id, "brand": brand,
                                     "nudge": flow["nudge"], "yes": flow["yes"], "at": time.time(), "commenters": []}
        self.save(d)


# ---------------------------------------------------------------- الرسالة اللي جاية من الخدمة
def _id(v) -> str:
    if isinstance(v, dict):
        v = v.get("_id") or v.get("id") or v.get("accountId")
    return str(v or "")


def parse(payload: dict) -> dict | None:
    """شكل الرسالة يمكن يختلف قليلًا، فندوّر على الحقول بأكتر من اسم."""
    if not isinstance(payload, dict) or str(payload.get("event") or "message.received") != "message.received":
        return None
    m = payload.get("message") if isinstance(payload.get("message"), dict) else payload.get("data") if isinstance(payload.get("data"), dict) else payload
    conv = m.get("conversation") if isinstance(m.get("conversation"), dict) else {}
    text = m.get("text") or m.get("content") or m.get("message") or m.get("body") or ""
    if isinstance(text, dict):
        text = text.get("text") or ""
    sender = m.get("senderId") or _id(m.get("sender")) or _id(m.get("from")) or m.get("participantId") or conv.get("participantId") or ""
    out = {"text": str(text)[:1000], "sender": str(sender), "conversation": str(m.get("conversationId") or conv.get("id") or payload.get("conversationId") or ""),
           "account": _id(m.get("accountId") or m.get("account") or payload.get("accountId") or payload.get("account") or conv.get("accountId")),
           "platform": str(m.get("platform") or payload.get("platform") or "").lower(),
           "mine": bool(m.get("isFromMe") or m.get("fromMe") or m.get("isEcho") or str(m.get("direction") or "").lower() in ("outgoing", "outbound", "sent"))}
    return out if out["account"] and (out["sender"] or out["conversation"]) else None


def verify(raw: bytes, signature: str, secret: str) -> bool:
    if not secret:
        return False
    sig = (signature or "").split("=", 1)[-1].strip()
    if not sig:
        return False
    bodies = [raw]
    try:   # الخدمة بتوقّع على الـ JSON مضغوط (من غير مسافات)، فبنجرّب الشكلين
        bodies.append(json.dumps(json.loads(raw), separators=(",", ":"), ensure_ascii=False).encode())
    except ValueError:
        pass
    return any(hmac.compare_digest(hmac.new(secret.encode(), b, hashlib.sha256).hexdigest(), sig) for b in bodies)


# ---------------------------------------------------------------- مين علّق على أنهي بوست (سجل الرد الأوتوماتيك)
def commenters(automation_id: str) -> set[str]:
    if publisher.service_name() == "mock":
        return set()
    try:
        with publisher._client(30) as c:
            r = c.get(f"{publisher.BASE_URL}/comment-automations/{automation_id}/logs", params={"limit": 200})
        data = r.json() if r.status_code < 400 else {}
    except (httpx.HTTPError, ValueError):
        return set()
    out = set()
    for x in publisher._pick(data, "logs"):
        if isinstance(x, dict):
            out.update(str(v) for v in (x.get("commenterId"), x.get("commenterPlatformId"), x.get("senderId")) if v)
    return out


def handle(store: Store, msg: dict, send) -> str:
    """يقرر يرد بإيه. send(conversation, account, text) ترسل الرسالة. يعود ما حصل (للسجل)."""
    if msg["mine"] or not msg["text"].strip():
        return "skip"
    d = store.load()
    now = time.time()
    gates = sorted(((k, g) for k, g in d["gates"].items() if g["account"] == msg["account"] and now - g["at"] < GATE_DAYS * 86400),
                   key=lambda kv: -kv[1]["at"])
    if not gates:
        return "no-gate"
    pkey = f"{msg['account']}:{msg['sender'] or msg['conversation']}"
    person = d["people"].get(pkey) or {}
    gid = person.get("gate")
    if not gid or gid not in d["gates"]:   # أول رد منه: نعرف علّق على أنهي بوست من سجل الرد الأوتوماتيك
        gid = next((k for k, g in gates if msg["sender"] and msg["sender"] in (set(g.get("commenters") or []) | commenters(k))), None)
        if not gid:   # ماعرفناش من السجل: لو رده إجابة على السؤال (أيوة/لسه) يبقى على آخر بوست
            gid = gates[0][0] if is_yes(msg["text"], gates[0][1]["yes"] + NO_WORDS) else None
        if not gid:
            return "unknown"
    g = d["gates"][gid]
    if person.get("state") == "sent" and person.get("gate") == gid:
        return "already"
    if is_yes(msg["text"], g["yes"]):
        send(msg["conversation"], msg["account"], g["reward"])
        state = "sent"
    elif person.get("state") != "nudged":
        send(msg["conversation"], msg["account"], g["nudge"])
        state = "nudged"
    else:
        return "waiting"
    d["people"][pkey] = {"gate": gid, "state": state, "at": now}
    d["log"].append({"at": now, "gate": gid, "state": state, "text": msg["text"][:80]})
    store.save(d)
    return state


# ---------------------------------------------------------------- تسجيل اللينك عند الخدمة (مرة واحدة)
def ensure_webhook(base_url: str, secret: str) -> str:
    """نتأكد أن الخدمة ترسل الرسائل القادمة للبوابة. يعود رسالة إذا فيه مشكلة."""
    if publisher.service_name() != "zernio":
        return ""
    if not base_url.startswith("https://") or not secret:
        return "رابط المنصة (PUBLIC_URL) غير متظبط، فالردود على الخاص لن توصل"
    url = base_url.rstrip("/") + HOOK_PATH
    try:
        with publisher._client(30) as c:
            r = c.get(f"{publisher.BASE_URL}/webhooks/settings")
            data = r.json() if r.status_code < 400 else {}
            hooks = publisher._pick(data, "webhooks") or ([data.get("webhook")] if isinstance(data, dict) and isinstance(data.get("webhook"), dict) else [])
            hit = next((h for h in hooks if isinstance(h, dict) and h.get("url") == url), None)
            body = {"name": "SimsimKit DM", "isActive": True, "url": url, "secret": secret,
                    "events": sorted({*((hit or {}).get("events") or []), "message.received"})}
            if not hit:
                r = c.post(f"{publisher.BASE_URL}/webhooks/settings", json=body)
            elif "message.received" not in (hit.get("events") or []) or not hit.get("isActive", True):
                r = c.put(f"{publisher.BASE_URL}/webhooks/settings", json={**body, "id": hit.get("_id") or hit.get("id")})
            if r.status_code >= 400:
                return f"تسجيل الردود: HTTP {r.status_code}"
    except httpx.HTTPError as exc:
        return f"تسجيل الردود: {exc}"[:200]
    return ""


def hook_secret() -> str:
    return os.environ.get("ZERNIO_HOOK_SECRET", "")
