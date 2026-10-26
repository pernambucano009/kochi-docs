"""🎯 ماكينة العملاء المستهدفين: ناس مهتمين بموضوع معيّن، من التعليقات على أكتر المنشورات انتشارًا فيه (إنستغرام وتيك توك).

- البحث: كلمة أو هاشتاج ← المنشورات الأعلى تفاعلًا (rivals.search) ← تعليقات كل منشور بأصحابها.
- التقييم: الذكاء الاصطناعي بيدّي كل تعليق درجة اهتمام من ٠ لـ ١٠٠ (بيسأل عن السعر أو المكان أو عايز يشتري = سخن)، وسبب قصير.
- الحفظ: نفس الشخص على نفس المنصة سطر واحد (بيتحدّث بأعلى درجة وآخر تعليق)، وعليه «تواصلت معه» وملاحظة.
- الإرسال للناس دي من حساب العلامة يدوي (زر «افتح محادثة» أو الملف)، لأن الربط الرسمي بتاع إنستغرام وتيك توك مابيسمحش ببدء رسالة.
"""
from __future__ import annotations

import csv
import io
import json
import re
import time
import uuid
from pathlib import Path

import rivals

MAX_ITEMS = 3000


def comments_full(platform: str, url: str, n: int = 60) -> list[dict]:
    """تعليقات منشور ومعاها صاحب كل تعليق: [{handle, name, text}]."""
    try:
        if platform == "tiktok":
            d = rivals._get("/v1/tiktok/video/comments", {"url": url, "trim": "true"}, 30)
        else:
            d = rivals._get("/v1/instagram/post/comments", {"url": url, "amount": n}, 60)
    except rivals.RivalsError:
        return []
    items = d.get("comments") or d.get("data") or d.get("items") or []
    out = []
    for c in items if isinstance(items, list) else []:
        if not isinstance(c, dict):
            continue
        u = c.get("user") or c.get("owner") or c.get("author") or {}
        handle = (u.get("username") or u.get("unique_id") or u.get("uniqueId") or c.get("username") or "") if isinstance(u, dict) else ""
        name = (u.get("full_name") or u.get("nickname") or "") if isinstance(u, dict) else ""
        text = str(c.get("text") or c.get("comment") or c.get("content") or "").strip()
        if handle and len(text) >= 2:
            out.append({"handle": rivals.clean_handle(handle), "name": str(name)[:80], "text": text[:300]})
    return out[:n]


def score_messages(topic: str, brand: str, rows: list[dict]) -> list[dict]:
    lines = "\n".join(f"{i}. {r['text']}" for i, r in enumerate(rows))
    return [{"role": "system", "content": "You score social media comments for purchase interest. Return JSON only."},
            {"role": "user", "content": f"Brand: {brand[:1500]}\nTopic searched: {topic}\n\nComments (index. text):\n{lines}\n\n"
                                        "For each comment give interest 0-100: 80+ = asks about price/location/availability/how to buy or says they want it; "
                                        "50-79 = clearly interested in the topic; under 50 = generic praise, jokes, emojis, spam, other businesses.\n"
                                        'Return {"items":[{"i":0,"score":85,"why":"يسأل عن السعر"}]} with "why" a very short Arabic (MSA) reason.'}]


def mock_rows(topic: str, n: int = 8) -> list[dict]:
    samples = [("بكم السعر؟ وكيف أطلب؟", 92, "يسأل عن السعر وطريقة الطلب"), ("وين مكانكم بالضبط؟", 86, "يسأل عن المكان"),
               ("أبغى أجرب هذا الأسبوع", 81, "يريد التجربة"), ("فكرة رائعة 👏", 35, "إعجاب عام"), ("هل يوجد توصيل للرياض؟", 84, "يسأل عن التوصيل"),
               ("😂😂", 5, "تعليق بلا اهتمام"), ("جربته وكان ممتاز", 60, "مهتم بالموضوع"), ("تابعوا حسابي للعروض", 2, "حساب يروّج لنفسه")]
    return [{"handle": f"user_{abs(hash(topic)) % 900 + i}", "name": f"مستخدم {i + 1}", "text": t, "score": s, "why": w}
            for i, (t, s, w) in enumerate(samples[:n])]


def load(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"items": [], "runs": []}


def save(path: Path, d: dict) -> None:
    d["items"] = sorted(d.get("items") or [], key=lambda x: (-int(x.get("score") or 0), -(x.get("at") or 0)))[:MAX_ITEMS]
    path.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")


def merge(d: dict, platform: str, topic: str, post: dict, rows: list[dict]) -> int:
    """يضيف الناس (أو يحدّثهم). يرجّع عدد الجداد."""
    by = {(x["platform"], x["handle"].lower()): x for x in d.setdefault("items", [])}
    new = 0
    for r in rows:
        k = (platform, r["handle"].lower())
        x = by.get(k)
        if x is None:
            x = {"id": uuid.uuid4().hex[:10], "platform": platform, "handle": r["handle"], "name": r.get("name") or "", "contacted": False, "note": "",
                 "score": 0, "found_at": time.time()}
            d["items"].append(x)
            by[k] = x
            new += 1
        if int(r.get("score") or 0) >= int(x.get("score") or 0):
            x.update(score=int(r.get("score") or 0), why=r.get("why") or "", comment=r["text"], post_url=post.get("url") or "", post_by=post.get("handle") or "",
                     topic=topic)
        x["at"] = time.time()
        x.setdefault("topics", [])
        if topic not in x["topics"]:
            x["topics"] = [*x["topics"], topic][-8:]
    return new


def profile_url(x: dict) -> str:
    return f"https://www.tiktok.com/@{x['handle']}" if x["platform"] == "tiktok" else f"https://www.instagram.com/{x['handle']}/"


def dm_url(x: dict) -> str:
    return f"https://ig.me/m/{x['handle']}" if x["platform"] == "instagram" else profile_url(x)


def to_csv(items: list[dict]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["platform", "handle", "name", "score", "reason", "comment", "post", "topic", "contacted", "note", "profile"])
    for x in items:
        w.writerow([x["platform"], x["handle"], x.get("name", ""), x.get("score", 0), x.get("why", ""), x.get("comment", ""), x.get("post_url", ""),
                    x.get("topic", ""), "yes" if x.get("contacted") else "", x.get("note", ""), profile_url(x)])
    return "﻿" + buf.getvalue()


def clean_topic(s: str) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()[:80]
