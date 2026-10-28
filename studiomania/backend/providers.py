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
    "fasih": {"name": "فصيح", "what": "الأصوات العربية", "unit": "", "api": False, "default_min": 0, "url": "https://www.fasihtts.com"},
    "munsit": {"name": "منصت", "what": "الأصوات الخليجية", "unit": "", "api": False, "default_min": 0, "url": "https://munsit.com"},
    "eleven": {"name": "ElevenLabs", "what": "الأصوات والاستنساخ وفصل الموسيقى عن الكلام (المفتاح المباشر)", "unit": "حرف", "api": True, "default_min": 10000,
               "url": "https://elevenlabs.io/app/subscription"},
    "minimax": {"name": "MiniMax", "what": "الأصوات والاستنساخ (المفتاح المباشر)", "unit": "", "api": False, "default_min": 0,
                "url": "https://platform.minimax.io/user-center/payment/balance"},
    "silma": {"name": "SILMA", "what": "أصوات الفصحى والسعودية", "unit": "", "api": False, "default_min": 0, "url": "https://silma.ai"},
    "zernio": {"name": "Zernio", "what": "النشر والرسائل والإعلانات (اشتراك)", "unit": "", "api": True, "default_min": 0, "url": "https://zernio.com"},
    # OpenAI مالهاش رصيد بيتقري، بس عندها «مصاريف الشهر» الحقيقية بمفتاح الأدمن (Admin key) من صفحة المنظمة
    "openai": {"name": "OpenAI", "what": "المساعدة الصوتية (مصاريف الشهر الفعلية)", "unit": "$", "api": True, "default_min": 0, "spend": True,
               "url": "https://platform.openai.com/settings/organization/billing/overview"},
    "authentica": {"name": "Authentica", "what": "رسائل التحقق برقم الجوال", "unit": "رسالة", "api": False, "default_min": 0, "url": "https://authentica.sa"},
    "gemini": {"name": "Gemini", "what": "تجارب الصوت (Google)", "unit": "", "api": False, "default_min": 0, "url": "https://aistudio.google.com/usage"},
}
HIST_DAYS = 120   # سجل الرصيد كام يوم
LOW_WORDS = re.compile(r"credit|balance|quota|insufficient|payment required|paid plan|upgrade|top.?up|رصيد", re.I)
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
    d.setdefault("pack", {})     # باقات كل منصة: {key: [{"name", "usd": 47, "units": 25000, "use": True}]} ← سعر الوحدة (اللي عليها use = اللي بنشتريها دلوقتي)
    for k, v in list(d["pack"].items()):   # الشكل القديم (باقة واحدة dict) ← قائمة
        if isinstance(v, dict):
            d["pack"][k] = [{"name": "", **v, "use": True}] if v.get("usd") and v.get("units") else []
    d.setdefault("custom", {})   # 🤝 باقة مخصصة لنا (تفاوض مع المزود): {key: {"pct", "usd", "units", "status", "contact", "note"}}
    d.setdefault("hist", {})     # سجل الرصيد: {key: [[وقت, رصيد], …]}
    d.setdefault("moves", {})    # الشحنات والاستهلاك المحسوب من فرق الرصيد: {key: [{"at", "units", "kind": "use"|"topup"}]}
    seed(d)
    return d


def packs(d: dict, name: str) -> list[dict]:
    """باقات المنصة بسعر الوحدة لكل واحدة، ونسبة التوفير عن أغلى سعر وحدة."""
    ps = [dict(x) for x in d.get("pack", {}).get(name) or [] if x.get("usd") and x.get("units")]
    for x in ps:
        x["unit_usd"] = x["usd"] / x["units"]
        x.setdefault("billing", "once")
        x.setdefault("unit", default_unit(name))
    top = max((x["unit_usd"] for x in ps), default=0)
    for x in ps:
        x["save_pct"] = round((1 - x["unit_usd"] / top) * 100, 1) if top else 0
    return ps


def active_pack(d: dict, name: str) -> dict | None:
    """الباقة اللي بنشتريها دلوقتي: المعلَّم عليها، وإلا أقل باقة سعرًا."""
    ps = packs(d, name)
    return next((x for x in ps if x.get("use")), None) or min(ps, key=lambda x: x["usd"], default=None)


def unit_usd(d: dict, name: str) -> float | None:
    """سعر الوحدة بالدولار: الرصيد بالدولار أصلًا (Atlas) = ١، وإلا من الباقة اللي بنشتريها (المبلغ ÷ الوحدات)."""
    if PROVIDERS.get(name, {}).get("unit") == "$":
        return 1.0
    pk = active_pack(d, name)
    return pk["unit_usd"] if pk else None


def topup_usd(d: dict, name: str, units: float) -> float | None:
    """سعر شحنة: لو عدد الوحدات اللي زادت يطابق باقة (أو مضاعفاتها) يبقى سعرها، وإلا بسعر وحدة الباقة الحالية."""
    if PROVIDERS.get(name, {}).get("unit") == "$":
        return units
    for x in packs(d, name):
        n = round(units / x["units"])
        if n >= 1 and abs(units - n * x["units"]) <= 0.01 * x["units"]:
            return n * x["usd"]
    u = unit_usd(d, name)
    return units * u if u is not None else None


BILLING = {"once": None, "month": 1, "year": 12}   # الدفع: مرة واحدة (شحن) / اشتراك شهري / اشتراك سنوي (الوحدات = لكل فترة)
UNITS = ("pts", "min", "sec", "usd", "chars", "msg", "req", "tok", "img", "vid", "acc")   # الوحدة اللي الباقة بتدّيها
_UNIT_OF = {"$": "usd", "حرف": "chars", "رسالة": "msg"}


def default_unit(name: str) -> str:
    return _UNIT_OF.get(PROVIDERS.get(name, {}).get("unit") or "", "pts")


SAR = 3.75   # الريال مربوط بالدولار

# 📋 الباقات من صفحات أسعار المزودين (٢٨ أكتوبر ٢٠٢٦): بتتحط مرة واحدة لكل منصة لو مالهاش باقات، وبعدها التعديل من «رصيد المنصات».
# السنوي: سعر السنة الفعلي اللي بيتدفع مرة واحدة، والوحدات = رصيد السنة كلها. الباقات «تواصل» راحت للباقة المخصصة.
def _p(name, usd, units, billing="once", unit="", note="", use=False):
    return {"name": name, "usd": round(usd, 2), "units": units, "billing": billing, "unit": unit, "note": note, "use": use}


PACK_PRESET = {
    "scrape": [_p("Freelance", 47, 25000, unit="pts", note="رصيد يُشحن مرة واحدة", use=True),
               _p("Business", 497, 500000, unit="pts", note="يوجد شحن تلقائي عند انخفاض الرصيد")],
    "fasih": [_p("Project Pack", 19, 100, unit="min", note="صالح ١٢ شهرًا بدون تجديد، Long-form + MP3", use=True),
              _p("Basic", 9.99, 60, "month", "min", "Short-form فقط، تتجدد كل شهر"),
              _p("Pro", 29.99, 200, "month", "min", "Long-form، دعم أولوية، تتجدد كل شهر")],
    "eleven": [_p("Starter", 6, 30000, "month", "chars", "≈٣٠ دقيقة، الدقيقة الإضافية $0.20"),
               _p("Starter سنوي", 60, 360000, "year", "chars", "يُدفع مرة في السنة، والرصيد يتجدد كل شهر"),
               _p("Creator", 22, 121000, "month", "chars", "≈١٢١ دقيقة، أول شهر $11، الدقيقة الإضافية $0.18", use=True),
               _p("Creator سنوي", 220, 1452000, "year", "chars", "يُدفع مرة في السنة، والرصيد يتجدد كل شهر"),
               _p("Pro", 99, 600000, "month", "chars", "≈٦٠٠ دقيقة، PCM 44.1kHz، الدقيقة الإضافية $0.17"),
               _p("Pro سنوي", 990, 7200000, "year", "chars", "يُدفع مرة في السنة، والرصيد يتجدد كل شهر"),
               _p("Scale", 299, 1800000, "month", "chars", "≈١٨٠٠ دقيقة، ٣ مقاعد"),
               _p("Scale سنوي", 2990, 21600000, "year", "chars", "يُدفع مرة في السنة، والرصيد يتجدد كل شهر"),
               _p("Business", 990, 6000000, "month", "chars", "≈٦٠٠٠ دقيقة، بث سريع $0.05/دقيقة"),
               _p("Business سنوي", 9900, 72000000, "year", "chars", "يُدفع مرة في السنة، والرصيد يتجدد كل شهر")],
    "zernio": [_p("٣–١٠ حسابات", 6, 1, "month", "acc", "السعر لكل حساب مربوط شهريًا (أول حسابين مجانًا)", use=True),
               _p("١١–١٠٠ حساب", 3, 1, "month", "acc", "السعر لكل حساب مربوط شهريًا"),
               _p("+١٠١ حساب", 1, 1, "month", "acc", "السعر لكل حساب مربوط شهريًا")],
    "authentica": [_p("Lite", 240 / SAR, 2000, unit="msg", note="٢٤٠ ريال · دفع مرة واحدة", use=True),
                   _p("Core", 500 / SAR, 5000, unit="msg", note="٥٠٠ ريال"),
                   _p("Plus", 900 / SAR, 10000, unit="msg", note="٩٠٠ ريال (موصى بها)"),
                   _p("Pro+", 1600 / SAR, 20000, unit="msg", note="١٦٠٠ ريال"),
                   _p("Scale", 2400 / SAR, 30000, unit="msg", note="٢٤٠٠ ريال")],
}
CUSTOM_PRESET = {
    "scrape": {"contact": "support@scrapecreators.com", "note": "Enterprise بسعر خاص + شحن تلقائي"},
    "fasih": {"contact": "https://www.fasihtts.com/en/pricing", "note": "Talk to us للحجم الكبير والتكاملات"},
    "eleven": {"contact": "https://elevenlabs.io/contact-sales", "note": "Enterprise: خصومات حجم، SSO، SLA"},
    "zernio": {"contact": "https://zernio.com/pricing", "note": "Enterprise بعد ٢٠٠٠ حساب"},
    "authentica": {"contact": "https://authentica.sa/ar/pricing/", "note": "باقة مخصصة للمؤسسات (الدفع مرة واحدة)"},
    "openai": {"note": "لا توجد باقات في الـ API: الدفع حسب الاستخدام (Batch بخصم ٥٠٪)"},
}


PRESET_VER = {"eleven": 2, "authentica": 2}   # لما باقات منصة تتعدّل في القائمة الجاهزة: الرقم يزيد، والباقات المطابقة تاخد الملاحظة الجديدة


def seed(d: dict) -> bool:
    """يحط الباقات والتواصل من القائمة الجاهزة لأي منصة لسه ماتحطلهاش (مرة واحدة: لو اتمسحت ماترجعش)."""
    seen = d.setdefault("seeded", [])
    changed = False
    for k, ps in PACK_PRESET.items():
        ver = PRESET_VER.get(k, 1)
        mark = k if ver == 1 else f"{k}@{ver}"
        bump = ver > 1 and k in seen
        if mark not in seen:
            cur = d["pack"].get(k) or []
            if not cur:
                d["pack"][k] = [dict(x) for x in ps]
            else:   # فيه باقات متكتبة: نكمّل الناقص، واللي متكتب زي باقة جاهزة ياخد اسمها ونوعها وملاحظتها
                for x in ps:
                    same = next((c for c in cur if abs(c.get("usd", 0) - x["usd"]) < 0.01 and c.get("units") == x["units"]), None) \
                        or (next((c for c in cur if c.get("name") == x["name"]), None) if bump else None)
                    if same and bump:   # نسخة أحدث من القائمة: الباقة اللي بنفس الاسم تاخد السعر والوحدات والملاحظة الجديدة
                        same.update({f: x[f] for f in ("usd", "units", "billing", "unit", "note")})
                    elif same:
                        for f in ("name", "billing", "unit", "note"):
                            if not same.get(f) or (bump and f == "note"):
                                same[f] = x[f]
                    elif not bump:
                        cur.append({**x, "use": False})
            for m in (k, mark):
                if m not in seen:
                    seen.append(m)
            changed = True
    old_cu = {"authentica": "باقة مخصصة للمؤسسات، واسألهم: شهري أم مرة واحدة؟"}   # ملاحظات قديمة اتأكدت: تتبدل بالجديدة
    for k, t in old_cu.items():
        if (d["custom"].get(k) or {}).get("note") == t:
            d["custom"][k]["note"] = CUSTOM_PRESET[k]["note"]
            changed = True
    for k, c in CUSTOM_PRESET.items():
        if "c:" + k not in seen:
            cur = d["custom"].setdefault(k, {})
            for f, v in c.items():
                cur.setdefault(f, v)
            seen.append("c:" + k)
            changed = True
    return changed


CUSTOM_PCT = 20          # تقدير افتراضي لخصم الباقة المخصصة لو لسه مفيش عرض من المزود
CUSTOM_STATUS = ("idea", "asked", "quoted", "no")   # لم نتواصل / تواصلنا / وصلنا عرض / رفض


def custom(d: dict, name: str) -> dict:
    c = {"pct": CUSTOM_PCT, "usd": None, "units": None, "status": "idea", "contact": "", "note": "", "billing": "once", "unit": default_unit(name)}
    c.update(d.get("custom", {}).get(name) or {})
    return c


def project(used: float, t0: float, t1: float) -> float:
    """استهلاك الشهر كله المتوقَّع من معدل الأيام اللي فاتت (الشهر اللي خلص = الفعلي)."""
    end = month_start(t0 + 32 * 86400)            # آخر الشهر ده
    now = min(time.time(), t1, end)
    elapsed = max(1.0, (now - t0) / 86400)
    return used * ((end - t0) / 86400) / elapsed if now < end - 60 else used


def scenarios(d: dict, name: str, used: float, t0: float, t1: float) -> list[dict]:
    """🧮 دراسة الجدوى: استهلاك الشهر ده لو اشترينا بكل باقة، وعدد الباقات اللي هنشتريها (بالتقريب لفوق) وتكلفتها الفعلية.
    وآخر سطر دايمًا: 🤝 باقة مخصصة لنا بالتفاوض مع المزود (بسعر العرض لو وصل، وإلا تقدير = أرخص سعر وحدة − نسبة الخصم المتوقعة)."""
    import math  # noqa: PLC0415
    meta = PROVIDERS.get(name, {})
    proj = project(used, t0, t1)
    ps = packs(d, name)
    out = []
    def buy(usd: float, units: float, billing: str) -> dict:
        """كام باقة محتاجين وبندفع كام لكل فترة دفع (من غير ما نقسّم السنوي على ١٢)، وتكلفة السنة كلها عشان المقارنة.
        مرة واحدة: باقات الشهر ده. شهري: اشتراكات الشهر. سنوي: اشتراكات تغطي استهلاك السنة (الشهر × ١٢)."""
        if billing == "year":
            n = max(1, math.ceil(proj * 12 / units)) if proj else 1
            return {"packs": n, "pay_usd": round(n * usd, 2), "year_usd": round(n * usd, 2)}
        if billing == "month":
            n = max(1, math.ceil(proj / units)) if proj else 1   # الاشتراك بيتدفع حتى لو مفيش استهلاك
            return {"packs": n, "pay_usd": round(n * usd, 2), "year_usd": round(n * usd * 12, 2)}
        n = math.ceil(proj / units) if proj else 0
        return {"packs": n, "pay_usd": round(n * usd, 2), "year_usd": round(math.ceil(proj * 12 / units) * usd, 2) if proj else 0}

    for x in ps:
        b = buy(x["usd"], x["units"], x["billing"])
        out.append({"name": x.get("name") or "", "usd": x["usd"], "units": x["units"], "unit_usd": x["unit_usd"], "save_pct": x["save_pct"],
                    "billing": x["billing"], "unit": x["unit"], "note": x.get("note") or "", "use": bool(x.get("use")), "month_units": round(proj, 2),
                    "month_usd": round(proj * x["unit_usd"], 2), **b, "buy_usd": b["pay_usd"]})
    c = custom(d, name)
    top = max((x["unit_usd"] for x in ps), default=None)
    base = min((x["unit_usd"] for x in ps), default=None)
    if meta.get("unit") == "$":                   # الرصيد بالدولار (Atlas) أو مصاريف فعلية (OpenAI): الوحدة = دولار
        top = base = 1.0
    quoted = bool(c.get("usd") and c.get("units"))
    if quoted:
        u = c["usd"] / c["units"]
    elif base is not None:
        u = base * (1 - float(c.get("pct") or 0) / 100)
    else:
        return out
    b = buy(c["usd"], c["units"], c.get("billing") or "once") if quoted else {"packs": None, "pay_usd": round(proj * u, 2), "year_usd": round(proj * 12 * u, 2)}
    out.append({"name": "باقة مخصصة لنا", "custom": True, "quoted": quoted, "status": c.get("status"), "pct": c.get("pct"),
                "usd": c.get("usd"), "units": c.get("units"), "billing": c.get("billing"), "unit": c.get("unit"), "unit_usd": u, "save_pct": round((1 - u / top) * 100, 1) if top else 0, "use": False,
                "month_units": round(proj, 2), "month_usd": round(proj * u, 2), "note": c.get("note") or "", **b, "buy_usd": b["pay_usd"]})
    return out


def track(d: dict, name: str, bal: float | None) -> None:
    """📒 كل قراية رصيد بتتسجل، والفرق عن اللي قبلها: نقص = استهلاك حقيقي، زاد = شحنة (انت شحنت)."""
    if bal is None:
        return
    h = d["hist"].setdefault(name, [])
    now = time.time()
    if h:
        prev = h[-1][1]
        delta = bal - prev
        if abs(delta) > 1e-9:
            d["moves"].setdefault(name, []).append({"at": now, "units": round(abs(delta), 6), "kind": "topup" if delta > 0 else "use"})
    if not h or h[-1][1] != bal or now - h[-1][0] > 6 * 3600:
        h.append([now, bal])
    cut = now - HIST_DAYS * 86400
    d["hist"][name] = [x for x in h if x[0] >= cut][-3000:]
    d["moves"][name] = [x for x in d["moves"].get(name, []) if x["at"] >= cut][-3000:]


def month_start(ts: float | None = None) -> float:
    import datetime as dt  # noqa: PLC0415
    t = dt.datetime.fromtimestamp(ts or time.time())
    return dt.datetime(t.year, t.month, 1).timestamp()


def month_stats(d: dict, name: str, t0: float | None = None, t1: float | None = None) -> dict:
    """استهلاك الشهر وشحناته (بالوحدات وبالدولار) من سجل الرصيد."""
    t0 = t0 or month_start()
    t1 = t1 or time.time() + 1
    mv = [m for m in d.get("moves", {}).get(name, []) if t0 <= m["at"] < t1]
    used = sum(m["units"] for m in mv if m["kind"] == "use")
    tops = [m for m in mv if m["kind"] == "topup"]
    u = unit_usd(d, name)
    tp = [topup_usd(d, name, m["units"]) for m in tops]
    if PROVIDERS.get(name, {}).get("spend"):   # OpenAI: المصاريف الفعلية من المنصة نفسها
        sp = (d["p"].get(name) or {}).get("month_spend")
        return {"used": sp, "used_usd": sp, "topups": 0, "topup_usd": None, "last_topup": None, "scenarios": scenarios(d, name, sp or 0, t0, t1)}
    return {"used": round(used, 4), "used_usd": round(used * u, 2) if u is not None else None, "topups": len(tops),
            "topup_units": round(sum(m["units"] for m in tops), 4), "topup_usd": round(sum(tp), 2) if tp and None not in tp else None,
            "last_topup": tops[-1]["at"] if tops else None, "scenarios": scenarios(d, name, used, t0, t1)}


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
        if name == "openai":
            key = _env(keys, "OPENAI_ADMIN_KEY")
            if not key:
                return {"ok": None}   # من غير مفتاح الأدمن مانقدرش نقرا المصاريف
            total, page = 0.0, None
            for _ in range(5):
                params = {"start_time": int(month_start()), "bucket_width": "1d", "limit": 31, **({"page": page} if page else {})}
                r = httpx.get("https://api.openai.com/v1/organization/costs", headers={"Authorization": f"Bearer {key}"}, params=params, timeout=20)
                if r.status_code >= 400:
                    return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:150]}"}
                j = r.json()
                for b in j.get("data") or []:
                    for x in b.get("results") or []:
                        total += _num((x.get("amount") or {}).get("value")) or 0
                page = j.get("next_page")
                if not j.get("has_more") or not page:
                    break
            return {"ok": True, "month_spend": round(total, 4)}
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
                track(d, name, r["balance"])
            if "month_spend" in r:
                cur["month_spend"] = r["month_spend"]
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
                    "at": cur.get("at"), "error": cur.get("error"), "fail": fail if recent_fail else None,
                    "spend": bool(meta.get("spend")), "packs": packs(d, name), "custom": custom(d, name), "unit_def": default_unit(name), "unit_usd": unit_usd(d, name),
                    "month": month_stats(d, name)})
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
        title = f"🔴 نفد رصيد {row['name']}"
    else:
        title = f"🟠 رصيد {row['name']} أوشك على النفاد"
    body = f"{row['what']}. " + (f"الرصيد الآن: {bal}. " if bal else "") + (f"آخر غلطة: {row['fail']['msg'][:160]}" if row.get("fail") else f"حد التنبيه: {row['min']:g}")
    return title, body
