"""📱 الدخول برقم الجوال: يكتب رقمه ← يوصله رمز من ٦ أرقام (رسالة نصية أو واتساب) ← يكتبه فيدخل أو يتعمل له حساب.

- الإرسال والتحقق من Authentica (AUTHENTICA_API_KEY من إعدادات الأدمن): هم اللي بيولّدوا الرمز ويتحققوا منه.
- من غير مفتاح: الخاصية مقفولة، إلا في وضع التجربة (MAIL_DEV=1 أو STAGING=1) فالرمز بيتولّد هنا ويظهر على الشاشة.
- ⏸️ مقفولة دلوقتي (متأجلة للخطة الجاية): بتشتغل بـ PHONE_LOGIN=1 بس.
- الحماية من استنزاف الرصيد: أرقام دول معيّنة بس، ومهلة ٣٠ ثانية بين كل رمز، و٣ رموز لكل رقم في ربع ساعة، و٨ لكل جهاز في الساعة.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import time

import httpx

BASE = os.environ.get("AUTHENTICA_BASE_URL", "https://api.authentica.sa/api/v2")
# مفتاح الدولة ← طول الرقم بعده (السعودية والخليج ومصر والأردن)
COUNTRIES = {"966": 9, "971": 9, "965": 8, "974": 8, "973": 8, "968": 8, "20": 10, "962": 9}
COOLDOWN = 30
TTL = 300


class PhoneError(Exception):
    pass


def key() -> str:
    return os.environ.get("AUTHENTICA_API_KEY", "").strip()


def dev() -> bool:
    return not key() and (os.environ.get("MAIL_DEV") == "1" or os.environ.get("STAGING") == "1")


def enabled() -> bool:
    # ⏸️ متأجلة للخطة الجاية (أسعار الرسائل): مقفولة لحد ما PHONE_LOGIN=1، حتى لو المفتاح موجود
    return os.environ.get("PHONE_LOGIN") == "1" and (bool(key()) or dev())


def normalize(raw: str) -> str:
    """أي شكل للرقم (05…، 5…، 9665…، +966 5…، أرقام عربية) ← +9665XXXXXXXX."""
    s = str(raw or "").translate(str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789"))
    d = re.sub(r"\D", "", s)
    if d.startswith("00"):
        d = d[2:]
    elif not s.strip().startswith("+") and d.startswith("05") and len(d) == 10:
        d = "966" + d[1:]   # رقم سعودي محلي
    elif len(d) == 9 and d.startswith("5"):
        d = "966" + d
    for cc, n in COUNTRIES.items():
        if d.startswith(cc) and len(d) == len(cc) + n:
            return "+" + d
    raise PhoneError("رقم الجوال غير صحيح. اكتبه هكذا: 05XXXXXXXX، أو بمفتاح الدولة مثل +9665XXXXXXXX")


# ---------------------------------------------------------------- حدود الإرسال
_sent: dict[str, list[float]] = {}
_dev_codes: dict[str, tuple[str, float]] = {}


def _hits(k: str, window: float) -> list[float]:
    now = time.time()
    _sent[k] = [t for t in _sent.get(k, []) if now - t < window]
    return _sent[k]


def check_limits(phone: str, ip: str) -> None:
    last = _hits("p:" + phone, 900)
    if last and time.time() - last[-1] < COOLDOWN:
        raise PhoneError(f"انتظر {int(COOLDOWN - (time.time() - last[-1])) + 1} ثانية ثم اطلب رمزًا جديدًا")
    if len(last) >= 3:
        raise PhoneError("طلبت رموزًا كثيرة لهذا الرقم. انتظر ربع ساعة ثم حاول مرة أخرى")
    if len(_hits("ip:" + ip, 3600)) >= 8:
        raise PhoneError("طلبات كثيرة من هذا الجهاز. انتظر قليلًا ثم حاول مرة أخرى")


def mark(phone: str, ip: str) -> None:
    for k in ("p:" + phone, "ip:" + ip):
        _sent.setdefault(k, []).append(time.time())


# ---------------------------------------------------------------- Authentica
def _log(path: str, msg: str, raw: str, status: int = 0) -> None:
    """🚨 صندوق الأخطاء: السبب الحقيقي من شركة الرسائل (العميل بيشوف رسالة بسيطة بس)."""
    try:
        import issues
        issues.record("sms", f"/api/auth/phone/{path}", msg, raw=raw[:1500], status=status)
    except Exception:  # noqa: BLE001
        pass


def _post(path: str, body: dict) -> dict:
    try:
        r = httpx.post(f"{BASE}/{path}", json=body, timeout=20,
                       headers={"X-Authorization": key(), "Accept": "application/json", "Content-Type": "application/json"})
        d = r.json() if r.content else {}
    except (httpx.HTTPError, ValueError) as exc:
        _log(path, "خدمة الرسائل لم ترد", f"{type(exc).__name__}: {exc}")
        raise PhoneError("تعذّر إرسال الرمز الآن. حاول مرة أخرى بعد قليل") from exc
    if r.status_code == 429:
        raise PhoneError("طلبات كثيرة. انتظر قليلًا ثم حاول مرة أخرى")
    if r.status_code >= 400:
        _log(path, "خدمة الرسائل رفضت الطلب", f"{r.status_code} {r.text[:1200]}", r.status_code)
        if r.status_code in (401, 403):   # المفتاح نفسه مرفوض: مشكلة عندنا مش عند العميل (التفاصيل في صندوق الأخطاء)
            raise PhoneError("الدخول برقم الجوال متوقف مؤقتًا. ادخل بالبريد الإلكتروني أو بجوجل، أو حاول بعد قليل")
        raise PhoneError("تعذّر إرسال الرمز لهذا الرقم. تأكد منه أو جرّب واتساب")
    return d if isinstance(d, dict) else {}


def send(phone: str, channel: str = "sms") -> str | None:
    """يرسل الرمز. يرجّع الرمز نفسه في وضع التجربة بس."""
    channel = "whatsapp" if channel == "whatsapp" else "sms"
    if dev():
        code = f"{secrets.randbelow(10 ** 6):06d}"
        _dev_codes[phone] = (hashlib.sha256(code.encode()).hexdigest(), time.time() + TTL)
        return code
    body = {"method": channel, "phone": phone}
    if os.environ.get("AUTHENTICA_TEMPLATE_ID", "").isdigit():
        body["template_id"] = int(os.environ["AUTHENTICA_TEMPLATE_ID"])
    d = _post("send-otp", body)
    if d.get("success") is False:
        _log("send", "خدمة الرسائل لم ترسل الرمز", str(d)[:1200])
        raise PhoneError(str(d.get("message") or "تعذّر إرسال الرمز. حاول مرة أخرى")[:200])
    return None


def verify(phone: str, code: str) -> bool:
    code = re.sub(r"\D", "", str(code or "").translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")))
    if not 4 <= len(code) <= 8:
        return False
    if dev():
        h, exp = _dev_codes.get(phone, ("", 0))
        ok = bool(h) and exp > time.time() and hmac.compare_digest(h, hashlib.sha256(code.encode()).hexdigest())
        if ok:
            _dev_codes.pop(phone, None)
        return ok
    try:
        d = _post("verify-otp", {"phone": phone, "otp": code})
    except PhoneError:
        return False
    return bool(d.get("status"))


def balance() -> dict:
    """رصيد حساب Authentica (للأدمن)."""
    if not key():
        return {"ok": False, "dev": dev()}
    try:
        r = httpx.get(f"{BASE}/balance", timeout=15, headers={"X-Authorization": key(), "Accept": "application/json"})
        d = r.json()
    except (httpx.HTTPError, ValueError):
        return {"ok": False, "error": "تعذّر الاتصال بخدمة الرسائل"}
    if r.status_code >= 400:
        return {"ok": False, "error": f"{r.status_code}: {str(d.get('message', ''))[:160]}"}
    data = d.get("data") if isinstance(d.get("data"), dict) else d
    return {"ok": True, "balance": data.get("balance")}
