"""📱 الدخول من تطبيق الجوال:
- Apple: التطبيق بيدّينا identity token (JWT من Apple)، وإحنا بنتأكد من توقيعه بمفاتيح Apple نفسها (RS256) ومن إنه معمول لتطبيقنا.
- جوجل: نفس الدخول بتاع الويب، بس في الآخر بيرجع للتطبيق (simsimkit://auth) بكود مرة واحدة، والتطبيق بيبدّله بجلسة
  ومعاه السر اللي هو بس يعرفه (PKCE)، فلو أي تطبيق تاني خطف الرابط مايقدرش يستخدم الكود.
التحقق من التوقيع مكتوب هنا من غير مكتبات (RSA PKCS#1 v1.5 + SHA-256)، فمش محتاجين cryptography على السيرفر.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import time

import httpx

APPLE_ISS = "https://appleid.apple.com"
APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys"
_keys: dict = {"at": 0.0, "keys": {}}


class AuthError(Exception):
    pass


def b64u(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def b64u_enc(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


# DigestInfo بتاع SHA-256 (RFC 8017)
_SHA256_PREFIX = bytes.fromhex("3031300d060960864801650304020105000420")


def rs256_ok(msg: bytes, sig: bytes, n: int, e: int) -> bool:
    k = (n.bit_length() + 7) // 8
    if len(sig) != k:
        return False
    s = int.from_bytes(sig, "big")
    if s >= n:
        return False
    em = pow(s, e, n).to_bytes(k, "big")
    t = _SHA256_PREFIX + hashlib.sha256(msg).digest()
    if k < len(t) + 11:
        return False
    want = b"\x00\x01" + b"\xff" * (k - len(t) - 3) + b"\x00" + t
    return hmac.compare_digest(em, want)


def apple_keys(force: bool = False) -> dict:
    if force or time.time() - _keys["at"] > 86400 or not _keys["keys"]:
        try:
            d = httpx.get(APPLE_KEYS_URL, timeout=15).json()
            _keys.update(at=time.time(), keys={k["kid"]: k for k in d.get("keys", []) if k.get("kty") == "RSA"})
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            if not _keys["keys"]:
                raise AuthError("تعذّر الاتصال بـ Apple الآن. حاول مرة أخرى بعد قليل") from exc
    return _keys["keys"]


def apple_verify(token: str, audiences: tuple[str, ...]) -> dict:
    """يرجّع بيانات الحساب ({sub, email, email_verified}) لو التوكن سليم، وإلا AuthError."""
    try:
        h64, p64, s64 = token.split(".")
        head, claims, sig = json.loads(b64u(h64)), json.loads(b64u(p64)), b64u(s64)
    except (ValueError, AttributeError) as exc:
        raise AuthError("بيانات الدخول من Apple غير صحيحة") from exc
    if head.get("alg") != "RS256":
        raise AuthError("بيانات الدخول من Apple غير صحيحة")
    keys = apple_keys()
    k = keys.get(head.get("kid")) or apple_keys(force=True).get(head.get("kid"))
    if not k:
        raise AuthError("بيانات الدخول من Apple غير صحيحة")
    n, e = int.from_bytes(b64u(k["n"]), "big"), int.from_bytes(b64u(k["e"]), "big")
    if not rs256_ok(f"{h64}.{p64}".encode(), sig, n, e):
        raise AuthError("بيانات الدخول من Apple غير صحيحة")
    if claims.get("iss") != APPLE_ISS or claims.get("aud") not in audiences:
        raise AuthError("بيانات الدخول من Apple ليست لهذا التطبيق")
    if float(claims.get("exp") or 0) < time.time() - 60:
        raise AuthError("انتهت مهلة الدخول بـ Apple. حاول مرة أخرى")
    if not claims.get("sub"):
        raise AuthError("بيانات الدخول من Apple غير صحيحة")
    ev = claims.get("email_verified")
    return {"sub": str(claims["sub"]), "email": str(claims.get("email") or "").lower(),
            "email_verified": ev is True or str(ev).lower() == "true"}


def apple_audiences() -> tuple[str, ...]:
    return tuple(x.strip() for x in (os.environ.get("APPLE_BUNDLE_IDS") or "com.geekzone.simsimkit").split(",") if x.strip())


# ---------------------------------------------------------------- PKCE لجوجل من التطبيق
CHALLENGE_RE = re.compile(r"^[A-Za-z0-9_-]{43}$")


def challenge_of(verifier: str) -> str:
    return b64u_enc(hashlib.sha256(verifier.encode()).digest())
