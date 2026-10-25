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
        raise NoCredits(f"معك {b} نقطة، و«{what}» تحتاج نحو {n} نقطة. اشحن نقاطًا إضافية وأكمل.")


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


def gift(n: int, what: str, ref: str = "") -> int:
    """🎁 نقاط هدية ترجع للباقة (مثل أول فيديو: بيتحسب عادي وبعدها نقاطه ترجع)."""
    n = int(math.ceil(n))
    if n <= 0 or free():
        return 0
    with closing(_db()) as c, c:
        c.execute("UPDATE wallet SET plan_credits=plan_credits+?, updated_at=? WHERE workspace=?", (n, time.time(), TENANT))
        c.execute("INSERT INTO ledger (id, workspace, delta, kind, note, ref, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  (uuid.uuid4().hex, TENANT, n, "gift", what[:120], ref[:60], time.time()))
    return n


def spent_between(t0: float, t1: float | None = None) -> int:
    """صافي اللي اتصرف بين t0 وt1 (الخصم ناقص اللي رجع)، عشان هدية أول فيديو ترجّع كل اللي اتخصم بالظبط."""
    if free():
        return 0
    with closing(_db()) as c:
        r = c.execute("SELECT COALESCE(SUM(delta), 0) AS d FROM ledger WHERE workspace=? AND at>=? AND at<=? AND kind IN ('use', 'refund')",
                      (TENANT, t0, t1 or time.time() + 1)).fetchone()
    return max(0, -int(r["d"] or 0))


def first_at() -> float | None:
    """أول حركة في سجل الحساب (نقاط التجربة وقت التسجيل)."""
    if free():
        return None
    with closing(_db()) as c:
        r = c.execute("SELECT MIN(at) AS a FROM ledger WHERE workspace=?", (TENANT,)).fetchone()
    return float(r["a"]) if r and r["a"] else None


def gifted(ref: str) -> int:
    """كام نقطة هدية اتسجلت قبل كده بالمرجع ده (عشان الهدية ماتتكررش)."""
    if free():
        return 0
    with closing(_db()) as c:
        r = c.execute("SELECT COALESCE(SUM(delta), 0) AS d FROM ledger WHERE workspace=? AND kind='gift' AND ref=?", (TENANT, ref[:60])).fetchone()
    return int(r["d"] or 0)


# ---------------------------------------------------------------- 🔒 الحجز الموحّد: النقاط تتحجز قبل العملية، وترجع لو فشلت
# reserve() بتخصم التقدير فورًا (فعمليتين في نفس الوقت مايصرفوش أكتر من الرصيد)، refund() بترجّعه لو العملية فشلت،
# settle() بتظبط الفرق لو التكلفة الحقيقية طلعت أقل. covered(): جوه الحتة دي الخصم بيتعمل صراحةً، فالخصم التلقائي مايتكررش.
import threading  # noqa: E402
from contextlib import contextmanager  # noqa: E402

_local = threading.local()


@contextmanager
def covered():
    _local.covered = getattr(_local, "covered", 0) + 1
    try:
        yield
    finally:
        _local.covered -= 1


def is_covered() -> bool:
    return getattr(_local, "covered", 0) > 0


def covering(fn):
    """ديكوريتور: الدالة دي بتخصم بنفسها، فأي توليد جواها مايتخصمش تاني."""
    def wrap(*a, **kw):
        with covered():
            return fn(*a, **kw)
    wrap.__name__, wrap.__doc__ = fn.__name__, fn.__doc__
    return wrap


def reserve(n: int, what: str, ref: str = "") -> dict | None:
    """يحجز n نقطة قبل العملية (نقاط الباقة أولًا). لو الرصيد مايكفيش: NoCredits ومفيش حاجة بتتصرف."""
    n = int(math.ceil(n))
    if n <= 0 or free():
        return None
    with closing(_db()) as c:
        c.execute("BEGIN IMMEDIATE")
        try:
            r = c.execute("SELECT plan_credits, topup_credits FROM wallet WHERE workspace=?", (TENANT,)).fetchone()
            have = (r["plan_credits"] + r["topup_credits"]) if r else 0
            if have < n:
                c.execute("ROLLBACK")
                raise NoCredits(f"معك {have} نقطة، و«{what}» تحتاج نحو {n} نقطة. اشحن نقاطًا إضافية وأكمل.")
            plan = min(r["plan_credits"], n)
            top = n - plan
            hid = uuid.uuid4().hex
            c.execute("UPDATE wallet SET plan_credits=plan_credits-?, topup_credits=topup_credits-?, updated_at=? WHERE workspace=?",
                      (plan, top, time.time(), TENANT))
            c.execute("INSERT INTO ledger (id, workspace, delta, kind, note, ref, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                      (hid, TENANT, -n, "use", what[:120], ref[:60], time.time()))
            c.execute("COMMIT")
        except NoCredits:
            raise
        except Exception:
            c.execute("ROLLBACK")
            raise
    return {"id": hid, "n": n, "plan": plan, "top": top, "what": what}


def refund(h: dict | None, n: int | None = None, why: str = "رجوع نقاط") -> int:
    """يرجّع الحجز كله (أو n منه) لنفس الأماكن اللي اتخصم منها: الزيادة الأول ثم الباقة."""
    if not h or free():
        return 0
    n = h["n"] if n is None else max(0, min(int(n), h["n"]))
    if n <= 0:
        return 0
    top = min(h["top"], n)
    plan = n - top
    with closing(_db()) as c, c:
        c.execute("UPDATE wallet SET plan_credits=plan_credits+?, topup_credits=topup_credits+?, updated_at=? WHERE workspace=?",
                  (plan, top, time.time(), TENANT))
        c.execute("INSERT INTO ledger (id, workspace, delta, kind, note, ref, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  (uuid.uuid4().hex, TENANT, n, "refund", f"{why}: {h['what']}"[:120], h["id"][:60], time.time()))
    h["n"] -= n
    h["top"] -= top
    h["plan"] -= plan
    return n


def settle(h: dict | None, actual: int) -> None:
    """بعد ما العملية تخلص: لو التكلفة الحقيقية أقل من الحجز الفرق يرجع."""
    if h and actual < h["n"]:
        refund(h, h["n"] - int(math.ceil(actual)), "فرق التقدير")


@contextmanager
def spend(n: int, what: str, ref: str = ""):
    """with wallet.spend(n, "…"): يحجز قبل، ويرجّع كل حاجة لو حصل خطأ جوه. والتوليد جواه مايتخصمش مرتين."""
    h = reserve(n, what, ref)
    try:
        with covered():
            yield h
    except BaseException:
        refund(h, why="العملية فشلت")
        raise
