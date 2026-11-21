"""💳 الأسعار والنقاط: الباقات والإضافات وباقات النقاط الزيادة، وتحويل أي تكلفة حقيقية لنقط.

- النقطة = سنت واحد في الحساب، وأي عملية تتخصم بـ (التكلفة الحقيقية × MARKUP) نقطة.
- النقاط الزيادة (عندما نقاط الباقة تنتهي) أغلى من نقاط الباقة: نديك نقاط أقل من قيمة فلوسك بالسعر العادي.
- الحسابات في الباقة محسوبة على أغلى سعر Zernio (ZERNIO_WORST)، فلا يوجد خسارة حتى في أولًا.
- أي رقم هنا يمكن يتغيّر بدون كود: billing.json في مجلد البيانات يكتب فوقه (لصفحة الأدمن لاحقًا).
"""
from __future__ import annotations

import copy
import json
import math
from pathlib import Path

MARKUP = 3            # السعر للعميل = التكلفة الحقيقية × ٣
CREDIT_USD = 0.01     # النقطة بسنت
ZERNIO_WORST = 6.0    # أغلى سعر للحساب عند Zernio (أول ١٠ حسابات)؛ بيقل لـ $3 ثم $1 مع الكبر
PAY_FEE = (0.03, 0.30)  # عمولة سترايب / باي بال التقريبية: ٣٪ + ٣٠ سنت

DEFAULTS = {
    "plans": [
        {"key": "trial", "name": "تجربة مجانية", "name_en": "Free trial", "price": 0, "credits": 300, "accounts": 0, "brands": 1,
         "autopilot": False, "once": True,
         "note": "٣٠٠ نقطة مرة واحدة؛ ربط الحسابات والنشر في الباقات المدفوعة فقط"},
        {"key": "starter", "name": "بداية", "name_en": "Starter", "price": 29, "credits": 1000, "accounts": 2, "brands": 1, "autopilot": False, "bots": False},
        {"key": "pro", "name": "محترف", "name_en": "Pro", "price": 79, "credits": 3500, "accounts": 4, "brands": 3, "autopilot": True, "bots": True, "popular": True},
        # 🏆 أعلى باقة: النقطة فيها أرخص بحوالي ٧٠٪ من «محترف» (٣٠ ألف نقطة)، وتكفي ٩٠ بوست في الشهر بالأوتوبايلوت
        # (٣ في اليوم، فيديوهات أو كاروسيل) من غير ما العميل يحتاج يشحن. والنقط الزيادة ليها بالضعف (نص السعر).
        # أسوأ حالة (كل النقط اتصرفت على توليد + ١٠ حسابات بأغلى سعر Zernio) لسه مكسب: plan_margin.
        {"key": "agency", "name": "وكالات", "name_en": "Agency", "price": 199, "credits": 30000, "accounts": 10, "brands": 10, "autopilot": True, "bots": True,
         "max_accounts": 25, "topup_bonus": 2,
         "features": ["النقطة أرخص بحوالي ٧٠٪ من «محترف»",
                      "تكفي ٩٠ منشورًا شهريًا بالأوتوبايلوت",
                      "شحن النقاط بضعف القيمة"],
         "features_en": ["Credits about 70% cheaper than Pro",
                         "Covers 90 autopilot posts a month",
                         "Top-ups at double credits"]},
    ],
    "addons": [
        {"key": "account", "name": "حساب سوشيال زيادة", "name_en": "Extra social account", "price": 10, "unit": "للحساب في الشهر"},
        {"key": "autopilot", "name": "أوتوبايلوت", "name_en": "Autopilot", "price": 15, "unit": "في الشهر", "for": ["starter"]},
        # 🤖 بوت الردود الآلية على التعليقات والرسائل (التعليقات والرسائل نفسها في كل الباقات، البوت من «محترف»)
        {"key": "bots", "name": "بوت الردود الآلية", "name_en": "Auto-reply bot", "price": 15, "unit": "في الشهر", "for": ["starter"]},
        # 🏷️ علامة زيادة (عقل ومشاريع وأفكار لوحدها) فوق عدد العلامات اللي في الباقة: زي الحساب الزيادة (١٠$ ≈ ٣٨ ر.س في الشهر)
        {"key": "brand", "name": "علامة زيادة", "name_en": "Extra brand", "price": 10, "unit": "للعلامة في الشهر"},
    ],
    # نقط زيادة لما نقط الباقة تخلص: أغلى من النقطة العادية (السنت)
    "topups": [
        {"key": "t15", "price": 15, "credits": 1000},
        {"key": "t35", "price": 35, "credits": 2500},
        {"key": "t75", "price": 75, "credits": 6000},
    ],
    "rules": {"plan_credits_rollover": False, "topup_valid_months": 12, "refund_failed": True,
              "yearly_months": 10},   # السنوي = ١٠ شهور (شهرين ببلاش)، والنقط بتتجدد كل شهر برضه
}


def _path(data_dir: Path) -> Path:
    return data_dir / "billing.json"


def config(data_dir: Path) -> dict:
    cfg = copy.deepcopy(DEFAULTS)
    f = _path(data_dir)
    if f.exists():
        try:
            over = json.loads(f.read_text(encoding="utf-8"))
            for k in cfg:
                if k in over:
                    cfg[k] = over[k]
        except ValueError:
            pass
    # 🤖 ميزات اتضافت بعد ما الأدمن حفظ إعداداته: بتتكمّل من الافتراضي (بوت الردود في «محترف» و«وكالات»، وإضافة لـ«بداية»)
    have = {a.get("key") for a in cfg["addons"]}
    cfg["addons"] += [copy.deepcopy(a) for a in DEFAULTS["addons"] if a["key"] not in have]
    dflt = {p["key"]: p for p in DEFAULTS["plans"]}
    for p in cfg["plans"]:
        if "bots" not in p:
            p["bots"] = bool(dflt.get(p["key"], {}).get("bots"))
        if "brands" not in p:
            p["brands"] = int(dflt.get(p["key"], {}).get("brands") or 1)
    return cfg


def credits_for(usd: float) -> int:
    """التكلفة الحقيقية بالدولار ← نقاط على العميل (بالتقريب لفوق، وأقل شيء نقطة واحدة)."""
    if usd <= 0:
        return 0
    return max(1, math.ceil(round(usd * MARKUP / CREDIT_USD, 6)))


def fee(price: float) -> float:
    return round(price * PAY_FEE[0] + PAY_FEE[1], 2) if price else 0.0


def plan_margin(p: dict, zernio_per_acc: float = ZERNIO_WORST) -> dict:
    """مكسبنا من الباقة إذا العميل صرف كل نقطه (أسوأ حالة)."""
    credits_cost = p["credits"] * CREDIT_USD / MARKUP
    accounts_cost = p["accounts"] * zernio_per_acc
    profit = p["price"] - credits_cost - accounts_cost - fee(p["price"])
    return {"credits_cost": round(credits_cost, 2), "accounts_cost": round(accounts_cost, 2), "fee": fee(p["price"]),
            "profit": round(profit, 2)}


def topup_margin(t: dict) -> dict:
    cost = t["credits"] * CREDIT_USD / MARKUP
    return {"cost": round(cost, 2), "fee": fee(t["price"]), "profit": round(t["price"] - cost - fee(t["price"]), 2),
            "per_credit_cents": round(t["price"] * 100 / t["credits"], 2)}


def yearly(cfg: dict, monthly: float) -> float:
    """سعر السنة لأي مبلغ شهري."""
    return round(monthly * int(cfg["rules"].get("yearly_months", 10)), 2)


def custom_total(cfg: dict, plan: str, extra_accounts: int = 0, autopilot: bool = False, bots: bool = False, extra_brands: int = 0) -> dict:
    """باقة على مقاسك: باقة أساسية + حسابات زيادة + أوتوبايلوت + بوت الردود الآلية + علامات زيادة."""
    p = next((x for x in cfg["plans"] if x["key"] == plan and not x.get("once")), None)
    if not p:
        raise ValueError("هذه الباقة غير موجودة")
    add = {a["key"]: a for a in cfg["addons"]}
    extra_accounts = max(0, int(extra_accounts))
    if p.get("max_accounts"):
        extra_accounts = min(extra_accounts, p["max_accounts"] - p["accounts"])
    total = p["price"] + extra_accounts * add["account"]["price"]
    ap = bool(p.get("autopilot"))
    if autopilot and not ap and plan in add["autopilot"].get("for", []):
        total += add["autopilot"]["price"]
        ap = True
    bt = bool(p.get("bots"))
    if bots and not bt and "bots" in add and plan in add["bots"].get("for", []):
        total += add["bots"]["price"]
        bt = True
    extra_brands = max(0, min(50, int(extra_brands or 0))) if "brand" in add else 0
    total = round(total + extra_brands * (add["brand"]["price"] if extra_brands else 0), 2)
    return {"plan": plan, "accounts": p["accounts"] + extra_accounts, "autopilot": ap, "bots": bt, "credits": p["credits"], "total": total,
            "brands": int(p.get("brands") or 1) + extra_brands, "extra_brands": extra_brands}
