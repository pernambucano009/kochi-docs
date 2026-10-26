"""💳 الدفع: PayPal (حساب PayPal أو بالكارت من صفحة PayPal). النص مع PayPal فقط، والنقاط والباقات في gateway.py.

المتغيرات (على الخادم):
- PAYPAL_CLIENT_ID و PAYPAL_SECRET و PAYPAL_WEBHOOK_ID و PAYPAL_MODE (sandbox للتجربة، live للحقيقي)
- PAY_CURRENCY (افتراضي USD)

PayPal: الاشتراك يُنشأ له «خطة» عند PayPal بنفس السعر أول مرة (وتُحفظ)، والنقاط طلب دفع مرة واحدة.
"""
from __future__ import annotations

import logging
import os
import time

import httpx

log = logging.getLogger("payments")
CUR = (os.environ.get("PAY_CURRENCY") or "USD").upper()


class PayError(RuntimeError):
    pass


# ---------------------------------------------------------------- PayPal

def _clean(v: str | None) -> str:
    # من غير مسافات ولا علامات تنصيص لو اتنسخت معاها بالغلط
    return (v or "").strip().strip('"').strip("'").strip()


def _pp_cred() -> tuple[str, str]:
    # من غير مسافات ولا علامات تنصيص لو اتنسخت معاها بالغلط
    clean = lambda v: (v or "").strip().strip('"').strip("'").strip()
    return clean(os.environ.get("PAYPAL_CLIENT_ID")), clean(os.environ.get("PAYPAL_SECRET"))


def paypal_on() -> bool:
    return all(_pp_cred())


LIVE, SANDBOX = "https://api-m.paypal.com", "https://api-m.sandbox.paypal.com"
_pp_tok: dict = {"t": "", "exp": 0.0, "base": None}


def _pp_base() -> str:
    if _pp_tok["base"]:
        return _pp_tok["base"]
    return LIVE if (os.environ.get("PAYPAL_MODE") or "sandbox").strip().lower() == "live" else SANDBOX


def _pp_token() -> str:
    if _pp_tok["t"] and _pp_tok["exp"] > time.time() + 60:
        return _pp_tok["t"]
    cid, sec = _pp_cred()
    if not (cid and sec):
        raise PayError("الدفع بـ PayPal غير متفعّل ما زال")
    first = _pp_base()
    # لو المفاتيح من «Sandbox» والوضع «live» (أو العكس) بنجرّب التاني بدل ما نوقف
    for base in (first, SANDBOX if first == LIVE else LIVE):
        try:
            r = httpx.post(f"{base}/v1/oauth2/token", auth=(cid, sec), data={"grant_type": "client_credentials"}, timeout=30)
            j = r.json()
        except (httpx.HTTPError, ValueError) as e:
            raise PayError(f"PayPal لا يرد: {e}") from e
        if r.status_code < 400 and "access_token" in j:
            if base != first:
                log.warning("paypal keys belong to %s, not PAYPAL_MODE", "sandbox" if base == SANDBOX else "live")
            _pp_tok.update(t=j["access_token"], exp=time.time() + int(j.get("expires_in") or 3000), base=base)
            return _pp_tok["t"]
        log.warning("paypal token failed on %s: %s %s", base, r.status_code, str(j)[:200])
    raise PayError("PayPal رفض المفاتيح: تأكد أن PAYPAL_CLIENT_ID و PAYPAL_SECRET من نفس الـ App ومنسوخين كاملين")


def _pp(method: str, path: str, body: dict | None = None) -> dict:
    try:
        r = httpx.request(method, f"{_pp_base()}{path}", json=body, timeout=30,
                          headers={"Authorization": f"Bearer {_pp_token()}", "Prefer": "return=representation"})
    except httpx.HTTPError as e:
        raise PayError(f"PayPal لا يرد: {e}") from e
    j = r.json() if r.content else {}
    if r.status_code >= 400:
        raise PayError(j.get("message") or (j.get("details") or [{}])[0].get("description") or f"PayPal HTTP {r.status_code}")
    return j


def _approve(j: dict) -> str:
    link = next((x["href"] for x in j.get("links") or [] if x.get("rel") in ("approve", "payer-action")), None)
    if not link:
        raise PayError("PayPal مارجّعش رابط الدفع")
    return link


def paypal_order(amount: float, custom: str, name: str, ret: str, cancel: str) -> str:
    j = _pp("POST", "/v2/checkout/orders", {
        "intent": "CAPTURE",
        "purchase_units": [{"amount": {"currency_code": CUR, "value": f"{amount:.2f}"}, "custom_id": custom, "description": name}],
        "application_context": {"brand_name": "SimsimKit", "user_action": "PAY_NOW", "shipping_preference": "NO_SHIPPING",
                                "return_url": ret, "cancel_url": cancel}})
    return _approve(j)


def paypal_capture(order_id: str) -> dict:
    """يعود {status, custom, amount}."""
    j = _pp("POST", f"/v2/checkout/orders/{order_id}/capture", {})
    pu = (j.get("purchase_units") or [{}])[0]
    cap = ((pu.get("payments") or {}).get("captures") or [{}])[0]
    return {"status": j.get("status"), "custom": pu.get("custom_id") or cap.get("custom_id"),
            "amount": float((cap.get("amount") or {}).get("value") or 0)}


def paypal_plan(plans_cache, key: str, name: str, price: float, interval: str = "MONTH") -> str:
    """خطة اشتراك (شهري أو سنوي) هذا بالسعر (تُنشأ مرة واحدة وتُحفظ). plans_cache = (get, set)."""
    get, put = plans_cache
    _pp_token()   # يحدد sandbox ولا live قبل ما نقرا الكاش
    if (pid := get(f"paypal_plan:{_pp_base()}:{key}")):
        return pid
    prod = get(f"paypal_product:{_pp_base()}")
    if not prod:
        prod = _pp("POST", "/v1/catalogs/products", {"name": "SimsimKit", "type": "SERVICE"})["id"]
        put(f"paypal_product:{_pp_base()}", prod)
    pid = _pp("POST", "/v1/billing/plans", {
        "product_id": prod, "name": name[:120], "status": "ACTIVE",
        "billing_cycles": [{"frequency": {"interval_unit": interval, "interval_count": 1}, "tenure_type": "REGULAR", "sequence": 1,
                            "total_cycles": 0, "pricing_scheme": {"fixed_price": {"value": f"{price:.2f}", "currency_code": CUR}}}],
        "payment_preferences": {"auto_bill_outstanding": True, "payment_failure_threshold": 1}})["id"]
    put(f"paypal_plan:{_pp_base()}:{key}", pid)
    return pid


def paypal_subscribe(plan_id: str, custom: str, email: str, ret: str, cancel: str) -> str:
    j = _pp("POST", "/v1/billing/subscriptions", {
        "plan_id": plan_id, "custom_id": custom, **({"subscriber": {"email_address": email}} if email else {}),
        "application_context": {"brand_name": "SimsimKit", "user_action": "SUBSCRIBE_NOW", "shipping_preference": "NO_SHIPPING",
                                "return_url": ret, "cancel_url": cancel}})
    return _approve(j)


def paypal_sub(sub_id: str) -> dict:
    j = _pp("GET", f"/v1/billing/subscriptions/{sub_id}")
    return {"status": j.get("status"), "custom": j.get("custom_id"),
            "next": ((j.get("billing_info") or {}).get("next_billing_time"))}


def paypal_cancel(sub_id: str) -> None:
    _pp("POST", f"/v1/billing/subscriptions/{sub_id}/cancel", {"reason": "Cancelled by customer"})


def paypal_verify(headers, event: dict) -> bool:
    wid = os.environ.get("PAYPAL_WEBHOOK_ID")
    if not wid:
        return False
    try:
        j = _pp("POST", "/v1/notifications/verify-webhook-signature", {
            "auth_algo": headers.get("paypal-auth-algo"), "cert_url": headers.get("paypal-cert-url"),
            "transmission_id": headers.get("paypal-transmission-id"), "transmission_sig": headers.get("paypal-transmission-sig"),
            "transmission_time": headers.get("paypal-transmission-time"), "webhook_id": wid, "webhook_event": event})
    except PayError:
        return False
    return j.get("verification_status") == "SUCCESS"
