"""💳 رصيد المنصات التي البرنامج يأخذ منها خدمات (للمشرف فقط).

- Atlas Cloud (الفيديو والصور والصوت والعقل) و ScrapeCreators (تحليل الحسابات): لهم API يقول الرصيد، فنسأله.
- AudioShake (فصل الصوت في الدبلجة) وفصيح (الأصوات العربية): مالهمش API للرصيد، فنعرف من أول طلب يفشل بسبب الرصيد،
  ونطلّع الرقم إذا مكتوب في الرسالة (مثل «Client has -1.5 credits»).
- Zernio (النشر): اشتراك شهري غير رصيد، فنشيّك أنه يعمل فقط.
- ElevenLabs: له API يقول الحروف المتبقية في الاشتراك. MiniMax و SILMA: مالهمش API للرصيد، فنعرف من أول طلب يفشل.
كل منصة معها رابط صفحة الشحن (url) لكي الأدمن يدخل ويشحن على طول.
الحالة في ملف واحد بجانب قاعدة بيانات المنصة، لكي كل نسخ العملاء تكتب فيه، والبوابة تنبّه الأدمن (جرس + بريد إلكتروني).
"""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

import httpx

PROVIDERS = {
    "atlas": {"name": "Atlas Cloud", "what": "الفيديو والصور والصوت والعقل", "unit": "$", "api": True, "default_min": 10,
              "url": "https://console.atlascloud.ai/billing"},
    "scrape": {"name": "ScrapeCreators", "what": "تحليل الحسابات والمنافسين", "unit": "رصيد", "api": True, "default_min": 500,
               "url": "https://app.scrapecreators.com"},
    "audioshake": {"name": "AudioShake", "what": "فصل الصوت عن الموسيقى في الدبلجة", "unit": "رصيد", "api": False, "default_min": 5,
                   "url": "https://developer.audioshake.ai"},
    "fasih": {"name": "فصيح", "what": "الأصوات العربية", "unit": "", "api": False, "default_min": 0, "url": "https://www.fasihtts.com"},
    "munsit": {"name": "منصت", "what": "الأصوات الخليجي", "unit": "", "api": False, "default_min": 0, "url": "https://munsit.com"},
    "eleven": {"name": "ElevenLabs", "what": "الأصوات والاستنساخ والدبلجة (المفتاح المباشر)", "unit": "حرف", "api": True, "default_min": 10000,
               "url": "https://elevenlabs.io/app/subscription"},
    "minimax": {"name": "MiniMax", "what": "الأصوات والاستنساخ (المفتاح المباشر)", "unit": "", "api": False, "default_min": 0,
                "url": "https://platform.minimax.io/user-center/payment/balance"},
    "silma": {"name": "SILMA", "what": "أصوات الفصحى والسعودية", "unit": "", "api": False, "default_min": 0, "url": "https://silma.ai"},
    "zernio": {"name": "Zernio", "what": "النشر والرسائل والإعلانات (اشتراك)", "unit": "", "api": True, "default_min": 0, "url": "https://zernio.com"},
}
LOW_WORDS = re.compile(r"credit|balance|quota|insufficient|payment required|top.?up|رصيد", re.I)
CHECK_EVERY = 30 * 60


def state_file(data_dir: Path | None = None) -> Path:
    p = os.environ.get("PLATFORM_DB")
    base = Path(p).parent if p else (data_dir or Path(os.environ.get("STUDIOMANIA_DATA") or "."))
    return base / "providers.json"


def load(f: Path) -> dict:
    try:
        d = json.loads(f.read_text("utf-8"))
    except (OSError, ValueError):
        d = {}
    d.setdefault("p", {})
    d.setdefault("min", {})
    d.setdefault("alerted", {})
    return d


def save(f: Path, d: dict) -> None:
    tmp = f.with_suffix(".tmp")
    tmp.write_text(json.dumps(d, ensure_ascii=False), "utf-8")
    tmp.replace(f)


def _env(keys: dict | None, *names: str) -> str:
    for n in names:
        v = (os.environ.get(n) or (keys or {}).get(n) or "").strip().strip("'\"")
        if v:
            return v
    return ""


def _num(v) -> float | None:
    try:
        return float(str(v).replace(",", ""))
    except (TypeError, ValueError):
        return None


def fetch(name: str, keys: dict | None = None) -> dict:
    """يسأل المنصة عن الرصيد. يعود {"balance", "ok", "error"}."""
    try:
        if name == "atlas":
            key = _env(keys, "ATLASCLOUD_API_KEY", "ATLAS_CLOUD_API_KEY")
            if not key:
                return {"ok": False, "error": "لا يوجد مفتاح"}
            base = os.environ.get("ATLASCLOUD_BASE_URL", "https://api.atlascloud.ai").rstrip("/") + "/public/v1"
            r = httpx.get(f"{base}/balance", headers={"Authorization": f"Bearer {key}"}, timeout=20)
            if r.status_code >= 400:
                return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:150]}"}
            d = r.json()
            d = d.get("data", d) if isinstance(d, dict) else {}
            av = d.get("available")
            bal = _num(av.get("value") or av.get("amount")) if isinstance(av, dict) else _num(av)
            if bal is None:
                bal = _num(d.get("balance") or d.get("total"))
            return {"ok": bal is not None, "balance": bal, "error": None if bal is not None else f"رد غير مفهوم: {str(d)[:150]}"}
        if name == "scrape":
            key = _env(keys, "SCRAPECREATORS_API_KEY", "SCRAPE_CREATORS_API_KEY")
            if not key:
                return {"ok": False, "error": "لا يوجد مفتاح"}
            r = httpx.get("https://api.scrapecreators.com/v1/account/credit-balance", headers={"x-api-key": key}, timeout=20)
            if r.status_code == 402:
                return {"ok": True, "balance": 0.0}
            if r.status_code >= 400:
                return {"ok": False, "error": f"HTTP {r.status_code}"}
            d = r.json()
            bal = _num(d.get("creditCount") if isinstance(d, dict) else None)
            return {"ok": bal is not None, "balance": bal, "error": None if bal is not None else "رد غير مفهوم"}
        if name == "eleven":
            key = _env(keys, "ELEVENLABS_API_KEY", "ELEVEN_API_KEY")
            if not key:
                return {"ok": None}   # المفتاح المباشر اختياري: من غيره المنصة مش مستخدمة
            r = httpx.get("https://api.elevenlabs.io/v1/user/subscription", headers={"xi-api-key": key}, timeout=20)
            if r.status_code >= 400:
                return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:150]}"}
            d = r.json()
            used, limit = _num(d.get("character_count")), _num(d.get("character_limit"))
            bal = None if used is None or limit is None else max(0.0, limit - used)
            return {"ok": bal is not None, "balance": bal, "error": None if bal is not None else "رد غير مفهوم"}
        if name == "zernio":
            key = _env(keys, "ZERNIO_API_KEY", "LATE_API_KEY")
            if not key:
                return {"ok": False, "error": "لا يوجد مفتاح"}
            r = httpx.get(os.environ.get("ZERNIO_BASE_URL", "https://zernio.com/api/v1") + "/profiles", headers={"Authorization": f"Bearer {key}"}, timeout=20)
            return {"ok": r.status_code < 400, "error": None if r.status_code < 400 else f"HTTP {r.status_code}: {r.text[:120]}"}
    except (httpx.HTTPError, ValueError) as exc:
        return {"ok": False, "error": str(exc)[:150]}
    return {"ok": None}


def refresh(f: Path, keys: dict | None = None) -> dict:
    d = load(f)
    for name, meta in PROVIDERS.items():
        if not meta["api"]:
            continue
        r = fetch(name, keys)
        cur = d["p"].setdefault(name, {})
        if r.get("ok") is not None:
            cur.update(ok=r["ok"], error=r.get("error"), at=time.time())
            if "balance" in r:
                cur["balance"] = r["balance"]
            if r["ok"] and (r.get("balance") is None or r["balance"] > 0):
                cur.pop("fail", None)   # اتشحن
    d["checked"] = time.time()
    save(f, d)
    return d


def note_error(provider: str, message: str) -> None:
    """أي نسخة شافت طلب فشل بسبب الرصيد تسجّله هنا (والبوابة تنبّه الأدمن)."""
    if provider not in PROVIDERS or not LOW_WORDS.search(message or ""):
        return
    f = state_file()
    try:
        d = load(f)
        cur = d["p"].setdefault(provider, {})
        m = re.search(r"(-?\d+(?:\.\d+)?)\s*credits?", message, re.I)
        if m:
            cur["balance"] = float(m.group(1))
        cur.update(fail={"at": time.time(), "msg": message[:300]}, ok=False)
        save(f, d)
    except OSError:
        pass


def friendly(provider: str) -> str:
    """الرسالة التي العميل يشوفها (بدون أسامي مزوّدين ولا أرقام رصيد)."""
    return "هذه الخدمة غير متاحة الآن لسبب من جهتنا، وقد أُبلغ فريقنا وسيصلحها. حاول مرة أخرى بعد قليل."


def summary(d: dict) -> list[dict]:
    out = []
    for name, meta in PROVIDERS.items():
        cur = d["p"].get(name) or {}
        low = d["min"].get(name, meta["default_min"])
        bal = cur.get("balance")
        fail = cur.get("fail") or {}
        recent_fail = bool(fail) and time.time() - fail.get("at", 0) < 3 * 86400
        state = "bad" if (bal is not None and bal <= 0) or recent_fail else "low" if bal is not None and low and bal < low else "ok" if cur.get("ok") else "unknown"
        out.append({"key": name, **{k: meta[k] for k in ("name", "what", "unit", "api", "url")}, "balance": bal, "min": low, "state": state,
                    "at": cur.get("at"), "error": cur.get("error"), "fail": fail if recent_fail else None})
    return out


def alerts(d: dict) -> list[dict]:
    """ما يحتاج تنبيه الآن (مرة لكل مرة الرصيد يقل)، ويعلّم عليهم أنهم اتبعتوا."""
    out = []
    for row in summary(d):
        key = row["key"]
        if row["state"] in ("low", "bad"):
            if d["alerted"].get(key) != row["state"]:
                d["alerted"][key] = row["state"]
                out.append(row)
        else:
            d["alerted"].pop(key, None)
    return out


def alert_text(row: dict) -> tuple[str, str]:
    bal = "" if row["balance"] is None else f"{row['balance']:g} {row['unit']}".strip()
    if row["state"] == "bad":
        title = f"🔴 رصيد {row['name']} خلص"
    else:
        title = f"🟠 رصيد {row['name']} قرّب ينتهي"
    body = f"{row['what']}. " + (f"الرصيد الآن: {bal}. " if bal else "") + (f"آخر غلطة: {row['fail']['msg'][:160]}" if row.get("fail") else f"حد التنبيه: {row['min']:g}")
    return title, body
