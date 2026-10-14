"""💳 الأسعار والنقط: الباقات والإضافات وباقات النقط الزيادة، وتحويل أي تكلفة حقيقية لنقط.

- النقطة = سنت واحد في الحساب، وأي عملية بتتخصم بـ (التكلفة الحقيقية × MARKUP) نقطة.
- النقط الزيادة (لما نقط الباقة تخلص) أغلى من نقط الباقة: بنديك نقط أقل من قيمة فلوسك بالسعر العادي.
- الحسابات في الباقة محسوبة على أغلى سعر Zernio (ZERNIO_WORST)، فمفيش خسارة حتى في الأول.
- أي رقم هنا ممكن يتغيّر من غير كود: billing.json في فولدر البيانات بيكتب فوقه (لصفحة الأدمن بعدين).
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
        {"key": "trial", "name": "تجربة مجانية", "name_en": "Free trial", "price": 0, "credits": 300, "accounts": 1,
         "autopilot": False, "once": True, "trial_days": 7,
         "note": "٣٠٠ نقطة مرة واحدة، والنشر على حساب واحد لمدة ٧ أيام"},
        {"key": "starter", "name": "بداية", "name_en": "Starter", "price": 29, "credits": 1000, "accounts": 2, "autopilot": False},
        {"key": "pro", "name": "محترف", "name_en": "Pro", "price": 79, "credits": 3500, "accounts": 4, "autopilot": True, "popular": True},
        {"key": "agency", "name": "وكالات", "name_en": "Agency", "price": 199, "credits": 10000, "accounts": 10, "autopilot": True,
         "max_accounts": 25},
    ],
    "addons": [
        {"key": "account", "name": "حساب سوشيال زيادة", "name_en": "Extra social account", "price": 10, "unit": "للحساب في الشهر"},
        {"key": "autopilot", "name": "أوتوبايلوت", "name_en": "Autopilot", "price": 15, "unit": "في الشهر", "for": ["starter"]},
    ],
    # نقط زيادة لما نقط الباقة تخلص: أغلى من النقطة العادية (السنت)
    "topups": [
        {"key": "t15", "price": 15, "credits": 1000},
        {"key": "t35", "price": 35, "credits": 2500},
        {"key": "t75", "price": 75, "credits": 6000},
    ],
    "rules": {"plan_credits_rollover": False, "topup_valid_months": 12, "refund_failed": True},
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
    return cfg


def credits_for(usd: float) -> int:
    """التكلفة الحقيقية بالدولار ← نقط على العميل (بالتقريب لفوق، وأقل حاجة نقطة واحدة)."""
    if usd <= 0:
        return 0
    return max(1, math.ceil(round(usd * MARKUP / CREDIT_USD, 6)))


def fee(price: float) -> float:
    return round(price * PAY_FEE[0] + PAY_FEE[1], 2) if price else 0.0


def plan_margin(p: dict, zernio_per_acc: float = ZERNIO_WORST) -> dict:
    """مكسبنا من الباقة لو العميل صرف كل نقطه (أسوأ حالة)."""
    credits_cost = p["credits"] * CREDIT_USD / MARKUP
    accounts_cost = p["accounts"] * zernio_per_acc
    profit = p["price"] - credits_cost - accounts_cost - fee(p["price"])
    return {"credits_cost": round(credits_cost, 2), "accounts_cost": round(accounts_cost, 2), "fee": fee(p["price"]),
            "profit": round(profit, 2)}


def topup_margin(t: dict) -> dict:
    cost = t["credits"] * CREDIT_USD / MARKUP
    return {"cost": round(cost, 2), "fee": fee(t["price"]), "profit": round(t["price"] - cost - fee(t["price"]), 2),
            "per_credit_cents": round(t["price"] * 100 / t["credits"], 2)}


def custom_total(cfg: dict, plan: str, extra_accounts: int = 0, autopilot: bool = False) -> dict:
    """باقة على مقاسك: باقة أساسية + حسابات زيادة + أوتوبايلوت."""
    p = next((x for x in cfg["plans"] if x["key"] == plan and not x.get("once")), None)
    if not p:
        raise ValueError("الباقة دي مش موجودة")
    add = {a["key"]: a for a in cfg["addons"]}
    extra_accounts = max(0, int(extra_accounts))
    if p.get("max_accounts"):
        extra_accounts = min(extra_accounts, p["max_accounts"] - p["accounts"])
    total = p["price"] + extra_accounts * add["account"]["price"]
    ap = bool(p.get("autopilot"))
    if autopilot and not ap and plan in add["autopilot"].get("for", []):
        total += add["autopilot"]["price"]
        ap = True
    return {"plan": plan, "accounts": p["accounts"] + extra_accounts, "autopilot": ap, "credits": p["credits"], "total": total}
