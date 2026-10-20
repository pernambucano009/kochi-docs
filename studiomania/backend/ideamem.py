"""🧠 ذاكرة الأفكار: أي فكرة أو سيناريو أو سكريبت اتستخدم مايتقترحش تاني، واللي عجبك ومش هتستخدمه دلوقتي يتحفظ لبعدين.

الشبه بيتحسب على الكلام نفسه (بعد توحيد الحروف العربي)، مش على العنوان بس: فكرة بعنوان تاني ونفس المضمون برضه بتتشال.
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher

USED_MAX = 400
SAVED_MAX = 200
AVOID_MAX = 40   # كام عنوان قديم بيتبعت للموديل عشان يتجنبه (الباقي بيتفلتر بعد ما يرجع)

_AR = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي"})
_STOP = {"في", "من", "على", "الى", "عن", "مع", "ده", "دي", "دا", "اللي", "او", "و", "يا", "ما", "لا", "هو", "هي", "انت", "انا",
         "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "is", "are", "with", "your", "you", "my", "how", "why", "what"}


def norm(s: str) -> str:
    s = re.sub(r"[ً-ٰٟـ]", "", str(s or "").lower()).translate(_AR)
    return re.sub(r"[^\w\s]", " ", s).strip()


def _toks(s: str) -> set[str]:
    return {w for w in norm(s).split() if len(w) > 1 and w not in _STOP}


def idea_text(it: dict) -> str:
    return " ".join(str(it.get(k) or "") for k in ("title", "hook", "idea"))


def scen_text(sc: dict) -> str:
    parts = [sc.get("title"), sc.get("summary"), sc.get("text")]
    for b in sc.get("beats") or []:
        if isinstance(b, dict):
            parts += [b.get("say"), b.get("what"), b.get("text")]
    for r in sc.get("scenes") or []:
        if isinstance(r, dict):
            parts.append(r.get("say"))
    for s in sc.get("slides") or []:
        if isinstance(s, dict):
            parts += [s.get("heading"), s.get("text")]
    for e in sc.get("episodes") or []:
        if isinstance(e, dict):
            parts += [e.get("title"), *(e.get("beats") or [])]
    return " ".join(str(x) for x in parts if x)


def text_of(kind: str, it: dict) -> str:
    return idea_text(it) if kind == "idea" else scen_text(it)


def similar(a: dict, b: dict, cut: float = 0.5) -> bool:
    """a, b = {"title", "text"}: نفس العنوان تقريبًا، أو نفس الكلام بنسبة كبيرة."""
    ta, tb = norm(a.get("title")), norm(b.get("title"))
    if ta and tb and (ta == tb or SequenceMatcher(None, ta, tb).ratio() >= 0.86):
        return True
    x, y = _toks(a.get("text")), _toks(b.get("text"))
    if len(x) < 4 or len(y) < 4:
        return False
    return len(x & y) / len(x | y) >= cut


def entry(kind: str, it: dict) -> dict:
    return {"title": str(it.get("title") or "")[:200], "text": text_of(kind, it)[:1500]}


def fresh(kind: str, items: list[dict], refs: list[dict]) -> tuple[list[dict], list[dict]]:
    """بيشيل اللي شبه حاجة اتستخدمت أو اتحفظت قبل كده (refs = used + saved من نفس النوع)، والأفكار المتكررة جوه نفس الدفعة.
    السيناريوهات أعلى في نسبة الشبه، ومن غير مقارنة جوه الدفعة: سيناريوهين لنفس الفكرة طبيعي يشتركوا في كلام كتير."""
    cut = 0.5 if kind == "idea" else 0.62
    keep, drop = [], []
    for it in items:
        e = entry(kind, it)
        hit = any(similar(e, r, cut) for r in refs) or (kind == "idea" and any(similar(e, entry(kind, k), cut) for k in keep))
        (drop if hit else keep).append(it)
    return keep, drop


def avoid_titles(mem: dict, kind: str) -> list[str]:
    rows = [r for r in mem.get("used") or [] if r.get("kind") == kind] + [s for s in mem.get("saved") or [] if s.get("kind") == kind]
    return [r["title"] for r in rows[-AVOID_MAX:] if r.get("title")]


def refs(mem: dict, kind: str) -> list[dict]:
    return [r for r in mem.get("used") or [] if r.get("kind") == kind] + \
        [{"title": s["item"].get("title", ""), "text": text_of(kind, s["item"])} for s in mem.get("saved") or [] if s.get("kind") == kind]


def mark_used(mem: dict, kind: str, it: dict, flow: str, at: str) -> None:
    """الفلو بيستخدم دي: لو الفلو ده كان مختار حاجة تانية من نفس النوع قبلها، القديمة بترجع متاحة."""
    used = [r for r in mem.get("used") or [] if not (r.get("flow") == flow and r.get("kind") == kind)]
    used.append({**entry(kind, it), "kind": kind, "flow": flow, "at": at})
    mem["used"] = used[-USED_MAX:]
    # اتستخدمت ← مابقتش «لبعدين»
    mem["saved"] = [s for s in mem.get("saved") or [] if not (s.get("kind") == kind and similar(entry(kind, s["item"]), entry(kind, it)))]
