"""💳 الخصم من رصيد العميل: كل عمل يصرف مال حقيقية (نماذج، تفريغ نص، سحب داتا) يُحسب نقاط ويُخصم.

- الرصيد في قاعدة بيانات المنصة (PLATFORM_DB ما البوابة تديها لكل نسخة)، نقاط الباقة أولًا ثم النقاط الزيادة.
- قبل ما العمل يبدأ: need() تتأكد أن الرصيد يكفي التقدير (وإلا رسالة واضحة)، وبعد ما ينتهي: charge() تخصم.
- مساحة صاحب البرنامج (owner) والتشغيل بدون بوابة: لا يوجد خصم (يُسجّل في اللوج فقط).
"""
from __future__ import annotations

import math
import os
import sqlite3
import time
import uuid
from contextlib import closing

import billing

TENANT = os.environ.get("TENANT_ID") or ""
PDB = os.environ.get("PLATFORM_DB") or ""

# تقدير التكلفة الحقيقية بالدولار (أعلى شوية من المتوقع عشان الأمان)
LLM_PER_MCHAR = 1.2      # ~ مليون حرف نص داخل/خارج لموديل الكلام
LLM_PER_IMAGE = 0.004    # صورة واحدة داخلة للموديل
STT_PER_MIN = 0.012      # تفريغ دقيقة كلام
SCRAPE_PER_CALL = 0.004  # طلب واحد لسحب داتا حساب سوشيال


class NoCredits(Exception):
    """الرصيد مايكفيش."""


def free() -> bool:
    return not PDB or not TENANT or TENANT == "owner"


def _db() -> sqlite3.Connection:
    c = sqlite3.connect(PDB, timeout=15)
    c.row_factory = sqlite3.Row
    return c


def balance() -> int | None:
    """الرصيد الحالي بالنقط (None = لا يوجد رصيد يُحسب، مثل صاحب البرنامج)."""
    if free():
        return None
    with closing(_db()) as c:
        r = c.execute("SELECT plan_credits, topup_credits FROM wallet WHERE workspace=?", (TENANT,)).fetchone()
    return (r["plan_credits"] + r["topup_credits"]) if r else 0


def credits(usd: float) -> int:
    return max(1, billing.credits_for(usd)) if usd > 0 else 0


def est(chars: int = 0, images: int = 0, stt_min: float = 0, scrape: int = 0) -> float:
    return chars / 1e6 * LLM_PER_MCHAR + images * LLM_PER_IMAGE + stt_min * STT_PER_MIN + scrape * SCRAPE_PER_CALL


def need(n: int, what: str) -> None:
    """قبل العمل: إذا الرصيد مايكفيش التقدير نوقف قبل ما نصرف شيء."""
    b = balance()
    if b is not None and b < n:
        raise NoCredits(f"رصيدك {b} نقطة، و«{what}» يحتاج نحو {n} نقطة. اشحن نقاط زيادة وأكمل.")


def charge(n: int, what: str, ref: str = "") -> int:
    """بعد ما العمل ينتهي: الخصم (نقاط الباقة أولًا). يعود ما اتخصم فعلًا."""
    n = int(math.ceil(n))
    if n <= 0 or free():
        return 0
    with closing(_db()) as c, c:
        r = c.execute("SELECT plan_credits, topup_credits FROM wallet WHERE workspace=?", (TENANT,)).fetchone()
        if not r:
            return 0
        plan = min(r["plan_credits"], n)
        top = min(r["topup_credits"], n - plan)
        c.execute("UPDATE wallet SET plan_credits=plan_credits-?, topup_credits=topup_credits-?, updated_at=? WHERE workspace=?",
                  (plan, top, time.time(), TENANT))
        c.execute("INSERT INTO ledger (id, workspace, delta, kind, note, ref, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  (uuid.uuid4().hex, TENANT, -(plan + top), "use", what[:120], ref[:60], time.time()))
    return plan + top
