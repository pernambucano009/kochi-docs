"""💳 الدفع: Stripe (كارت) و PayPal. الكلام مع الشركتين بس، والنقط والباقات في gateway.py.

المتغيرات (على السيرفر):
- STRIPE_SECRET_KEY و STRIPE_WEBHOOK_SECRET  (من لوحة Stripe ← Developers)
- PAYPAL_CLIENT_ID و PAYPAL_SECRET و PAYPAL_WEBHOOK_ID و PAYPAL_MODE (sandbox للتجربة، live للحقيقي)
- PAY_CURRENCY (افتراضي USD)

Stripe: صفحة دفع Stripe (Checkout) للاشتراك أو النقط، وبوابة العميل يغيّر كارته أو يلغي.
PayPal: الاشتراك بيتعمله «خطة» عند PayPal بنفس السعر أول مرة (وبتتحفظ)، والنقط طلب دفع مرة واحدة.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import time

import httpx

log = logging.getLogger("payments")
CUR = (os.environ.get("PAY_CURRENCY") or "USD").upper()


class PayError(RuntimeError):
    pass


# ---------------------------------------------------------------- Stripe

def _clean(v: str | None) -> str:
    # من غير مسافات ولا علامات تنصيص لو اتنسخت معاها بالغلط
    return (v or "").strip().strip('"').strip("'").strip()


def stripe_on() -> bool:
    return bool(_clean(os.environ.get("STRIPE_SECRET_KEY")))


def _stripe(method: str, path: str, data: dict | None = None) -> dict:
    key = _clean(os.environ.get("STRIPE_SECRET_KEY"))
    if not key:
        raise PayError("الدفع بالكارت مش متفعّل لسه")
    if key.startswith("whsec_"):
        raise PayError("STRIPE_SECRET_KEY فيه مفتاح الـ Webhook (whsec_) بالغلط: لازم يكون الـ Secret key اللي بيبدأ بـ sk_test_ أو sk_live_")
    if key.startswith("pk_"):
        raise PayError("STRIPE_SECRET_KEY فيه الـ Publishable key (pk_) بالغلط: لازم يكون الـ Secret key اللي بيبدأ بـ sk_test_ أو sk_live_")
    try:
        r = httpx.request(method, f"https://api.stripe.com/v1/{path}", auth=(key, ""), data=_flat(data or {}), timeout=30)
    except httpx.HTTPError as e:
        raise PayError(f"Stripe مش بيرد: {e}") from e
    j = r.json() if r.content else {}
    if r.status_code >= 400:
        log.warning("stripe %s %s failed: %s %s", method, path, r.status_code, str(j.get("error") or j)[:400])
        raise PayError((j.get("error") or {}).get("message") or f"Stripe HTTP {r.status_code}")
    return j


def _flat(d, prefix: str = "") -> dict:
    """{"a": {"b": 1}, "l": [{"x": 2}]} ← {"a[b]": 1, "l[0][x]": 2} (شكل الفورم اللي Stripe عايزه)."""
    out = {}
    items = d.items() if isinstance(d, dict) else enumerate(d)
    for k, v in items:
        key = f"{prefix}[{k}]" if prefix else str(k)
        if isinstance(v, (dict, list)):
            out.update(_flat(v, key))
        elif v is not None:
            out[key] = "true" if v is True else "false" if v is False else str(v)
    return out


def stripe_checkout(*, mode: str, lines: list[tuple[str, float, int]], meta: dict, email: str, customer: str | None,
                    success: str, cancel: str, interval: str = "month") -> str:
    """lines = [(الاسم، السعر بالدولار، الكمية)]. بيرجّع لينك صفحة الدفع."""
    items = []
    for name, price, qty in lines:
        if qty <= 0:
            continue
        pd = {"currency": CUR.lower(), "unit_amount": int(round(price * 100)), "product_data": {"name": name}}
        if mode == "subscription":
            pd["recurring"] = {"interval": interval}
        items.append({"price_data": pd, "quantity": qty})
    body = {"mode": mode, "line_items": items, "success_url": success, "cancel_url": cancel,
            "client_reference_id": meta.get("wid"), "metadata": meta, "allow_promotion_codes": True}
    if customer:
        body["customer"] = customer
    else:
        body["customer_email"] = email
    if mode == "subscription":
        body["subscription_data"] = {"metadata": meta}
    return _stripe("POST", "checkout/sessions", body)["url"]


def stripe_portal(customer: str, back: str) -> str:
    return _stripe("POST", "billing_portal/sessions", {"customer": customer, "return_url": back})["url"]


def stripe_cancel(sub_id: str) -> None:
    _stripe("DELETE", f"subscriptions/{sub_id}")


def stripe_verify(payload: bytes, header: str, tolerance: int = 300) -> bool:
    """التوقيع اللي Stripe بيبعته مع كل إشعار (عشان محدش يزوّر إشعار دفع)."""
    secret = _clean(os.environ.get("STRIPE_WEBHOOK_SECRET"))
    if not secret or not header:
        return False
    parts = dict(p.split("=", 1) for p in header.split(",") if "=" in p)
    sigs = [p.split("=", 1)[1] for p in header.split(",") if p.startswith("v1=")]
    t = parts.get("t", "")
    if not t.isdigit() or abs(time.time() - int(t)) > tolerance:
        return False
    good = hmac.new(secret.encode(), f"{t}.".encode() + payload, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(good, s) for s in sigs)


# ---------------------------------------------------------------- PayPal

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
        raise PayError("الدفع بـ PayPal مش متفعّل لسه")
    first = _pp_base()
    # لو المفاتيح من «Sandbox» والوضع «live» (أو العكس) بنجرّب التاني بدل ما نوقف
    for base in (first, SANDBOX if first == LIVE else LIVE):
        try:
            r = httpx.post(f"{base}/v1/oauth2/token", auth=(cid, sec), data={"grant_type": "client_credentials"}, timeout=30)
            j = r.json()
        except (httpx.HTTPError, ValueError) as e:
            raise PayError(f"PayPal مش بيرد: {e}") from e
        if r.status_code < 400 and "access_token" in j:
            if base != first:
                log.warning("paypal keys belong to %s, not PAYPAL_MODE", "sandbox" if base == SANDBOX else "live")
            _pp_tok.update(t=j["access_token"], exp=time.time() + int(j.get("expires_in") or 3000), base=base)
            return _pp_tok["t"]
        log.warning("paypal token failed on %s: %s %s", base, r.status_code, str(j)[:200])
    raise PayError("PayPal رفض المفاتيح: اتأكد إن PAYPAL_CLIENT_ID و PAYPAL_SECRET من نفس الـ App ومنسوخين كاملين")


def _pp(method: str, path: str, body: dict | None = None) -> dict:
    try:
        r = httpx.request(method, f"{_pp_base()}{path}", json=body, timeout=30,
                          headers={"Authorization": f"Bearer {_pp_token()}", "Prefer": "return=representation"})
    except httpx.HTTPError as e:
        raise PayError(f"PayPal مش بيرد: {e}") from e
    j = r.json() if r.content else {}
    if r.status_code >= 400:
        raise PayError(j.get("message") or (j.get("details") or [{}])[0].get("description") or f"PayPal HTTP {r.status_code}")
    return j


def _approve(j: dict) -> str:
    link = next((x["href"] for x in j.get("links") or [] if x.get("rel") in ("approve", "payer-action")), None)
    if not link:
        raise PayError("PayPal مارجّعش لينك الدفع")
    return link


def paypal_order(amount: float, custom: str, name: str, ret: str, cancel: str) -> str:
    j = _pp("POST", "/v2/checkout/orders", {
        "intent": "CAPTURE",
        "purchase_units": [{"amount": {"currency_code": CUR, "value": f"{amount:.2f}"}, "custom_id": custom, "description": name}],
        "application_context": {"brand_name": "SimsimKit", "user_action": "PAY_NOW", "shipping_preference": "NO_SHIPPING",
                                "return_url": ret, "cancel_url": cancel}})
    return _approve(j)


def paypal_capture(order_id: str) -> dict:
    """بيرجّع {status, custom, amount}."""
    j = _pp("POST", f"/v2/checkout/orders/{order_id}/capture", {})
    pu = (j.get("purchase_units") or [{}])[0]
    cap = ((pu.get("payments") or {}).get("captures") or [{}])[0]
    return {"status": j.get("status"), "custom": pu.get("custom_id") or cap.get("custom_id"),
            "amount": float((cap.get("amount") or {}).get("value") or 0)}


def paypal_plan(plans_cache, key: str, name: str, price: float, interval: str = "MONTH") -> str:
    """خطة اشتراك (شهري أو سنوي) بالسعر ده (بتتعمل مرة واحدة وبتتحفظ). plans_cache = (get, set)."""
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
        "plan_id": plan_id, "custom_id": custom, "subscriber": {"email_address": email},
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
