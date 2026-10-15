"""📈 أدوات النمو: قوالب الهوك ودرجاتها، «اللي ماشي في مجالك» بمقياس المضاعف، فرز الكومنتات، وشيل نَفَس الذكاء الصناعي.

(الأفكار مستوحاة من حزمة Instagram Agent Skill المفتوحة MIT، ومكتوبة هنا من الأول بالعربي.)
"""
from __future__ import annotations

import re

# ---------------------------------------------------------------- 🪝 قوالب الهوك
HOOK_FORMULAS = [
    ("سؤال يوقف", "سؤال الجمهور بيسأله لنفسه فعلًا"),
    ("غلطة شائعة", "«أغلب الناس بتعمل كذا غلط»"),
    ("عدد محدد", "«٣ حاجات…» أو «في ٧ أيام…» (عدد حاجات، مش أرقام مخترعة)"),
    ("النتيجة الأول", "تبدأ بالنتيجة أو «بعد» وبعدين ترجع للحكاية"),
    ("كسر توقع", "«مش كذا… ده كذا»"),
    ("ده ولا ده", "مقارنة بين حاجتين الجمهور بيحتار بينهم"),
    ("سر محدش قاله", "معلومة من جوه المجال"),
    ("تحذير", "«ماتعملش كذا قبل ما تشوف ده»"),
    ("حكاية في جملة", "«من سنة كنت…» بداية حكاية حقيقية"),
    ("تحدّي", "«جرّب ده كذا يوم»"),
    ("مشهد / POV", "«لما…» موقف الجمهور عاشه"),
    ("رأي جريء", "عكس اللي الكل بيقوله، وتبرره"),
    ("وعد سريع", "«في ٣٠ ثانية هتعرف…»"),
    ("نداء مباشر", "«لو انت كذا، الفيديو ده ليك»"),
]


def hooks_rule() -> str:
    lines = "\n".join(f"- {n}: {d}" for n, d in HOOK_FORMULAS)
    return ("الهوك = أول جملة في الفيديو أو البوست، ولازم توقف اللي بيقلّب في أول ثانيتين. لكل فكرة اكتب ٣ هوكات من ٣ قوالب مختلفة من دول:\n"
            f"{lines}\n"
            "وادي كل هوك درجة من ١٠ (قد إيه هيوقف الجمهور ده بالذات وماشي مع البراند)، وسبب الدرجة في جملة. "
            "ماتخترعش أرقام أو نتايج أو إحصائيات مش معروفة عن البراند.")


def best_hook(hooks) -> tuple[str, list[dict]]:
    """بيرتّب الهوكات بالدرجة، وبيرجّع (أحسن هوك، القايمة)."""
    out = []
    for h in hooks or []:
        if not isinstance(h, dict) or not str(h.get("text") or "").strip():
            continue
        try:
            score = max(0.0, min(10.0, float(h.get("score") or 0)))
        except (TypeError, ValueError):
            score = 0.0
        out.append({"text": str(h["text"]).strip()[:300], "formula": str(h.get("formula") or "")[:40],
                    "score": round(score, 1), "why": str(h.get("why") or "")[:200]})
    out.sort(key=lambda h: -h["score"])
    return (out[0]["text"] if out else ""), out[:3]


def mock_hooks(k: int = 0) -> list[dict]:
    f = HOOK_FORMULAS
    return [{"text": t, "formula": f[(k + i) % len(f)][0], "score": s, "why": "تجريبي"}
            for i, (t, s) in enumerate([("استنى… الحكاية مش زي ما انت فاكر", 8.5), ("أغلب الناس بتبدأ غلط هنا", 7.5), ("لو انت لسه بتبدأ، ده ليك", 6.5)])]


# ---------------------------------------------------------------- 🔥 اللي ماشي في مجالك (المضاعف)

def outliers(items: list[dict]) -> list[dict]:
    """كل بوست: مشاهداته ÷ متوسط مشاهدات الحساب نفسه. ده بيكشف الفكرة اللي نجحت، مش الحساب الكبير."""
    rows = []
    for i, it in enumerate(items):
        try:
            views = float(str(it.get("views") or 0).replace(",", ""))
            avg = float(str(it.get("avg") or 0).replace(",", ""))
        except ValueError:
            views, avg = 0.0, 0.0
        mult = round(views / avg, 1) if avg > 0 else None
        rows.append({"n": i + 1, "url": str(it.get("url") or "")[:400], "account": str(it.get("account") or "")[:80],
                     "hook": str(it.get("hook") or "")[:400], "views": int(views), "avg": int(avg), "multiple": mult})
    rows.sort(key=lambda r: -(r["multiple"] or 0))
    return rows


def viral_messages(brand: str, niche: str, rows: list[dict]) -> list[dict]:
    lst = "\n".join(f"{r['n']}) {r['account'] or '—'} · {r['views']:,} مشاهدة (متوسطه {r['avg']:,}) · "
                    f"{'×' + str(r['multiple']) if r['multiple'] else 'من غير متوسط'} · الهوك: {r['hook'] or '—'}" for r in rows[:15])
    formulas = "، ".join(n for n, _ in HOOK_FORMULAS)
    system = ("انت محلل محتوى سوشيال ميديا. بتفهم ليه بوست معيّن نجح أكتر من العادي بتاع صاحبه، وبتحوّل ده لأفكار أصلية للبراند من غير نسخ.\n"
              f"البراند:\n{brand}")
    user = (f"المجال: {niche or 'نفس مجال البراند'}\n"
            f"دي بوستات من المجال، مترتبة بالمضاعف (مشاهدات البوست ÷ متوسط الحساب نفسه):\n{lst}\n\n"
            f"حلّل أعلى ٣ (أو أقل لو مفيش). لكل واحد: ليه نجح، وأنهي قالب هوك استخدم من دول ({formulas})، وهيكله (بيبدأ إزاي ويكمّل إزاي ويخلص إزاي).\n"
            "وبعدين طلّع النمط المشترك، و٣ أفكار للبراند بنفس الهيكل بس بزاوية البراند وصوته (ممنوع تنسخ نفس الكلام أو الفكرة).\n"
            'رجّع JSON بس: {"top": [{"n": رقم البوست, "why": "", "formula": "", "structure": ""}], "pattern": "", '
            '"ideas": [{"title": "", "hook": "", "idea": "", "based_on": رقم البوست}]}')
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def mock_viral(rows: list[dict]) -> dict:
    top = [{"n": r["n"], "why": "الهوك سؤال مباشر من مشكلة حقيقية", "formula": "سؤال يوقف", "structure": "سؤال ← مثال ← حل في جملة"} for r in rows[:3]]
    return {"top": top, "pattern": "البوستات اللي عدّت متوسطها بتبدأ بمشكلة الجمهور مش بالبراند",
            "ideas": [{"title": "فكرة تجريبية", "hook": "أغلب الناس بتبدأ غلط هنا", "idea": "نفس الهيكل بزاوية البراند", "based_on": rows[0]["n"] if rows else 1}]}


# ---------------------------------------------------------------- 💬 فرز الكومنتات

KINDS = {"lead": "🎯 عميل محتمل", "question": "❓ سؤال", "keyword": "🔑 كتب الكلمة", "support": "🛠️ مشكلة/شكوى",
         "praise": "💛 مدح", "spam": "🚫 سبام", "other": "💬 تاني"}


def triage_messages(brand: str, post: str, platform: str, keyword: str, dm_hint: str, comments: list[dict]) -> list[dict]:
    lst = "\n".join(f"[{c['id']}] {c.get('name') or '—'}: {str(c.get('text') or '')[:400]}" for c in comments[:60])
    system = (f"انت مسؤول السوشيال ميديا للبراند ده:\n{brand}\n\n"
              "بتفرز الكومنتات اللي تحت بوست وبتجهّز رد لكل واحد. قواعد الرد: بنفس لهجة اللي كتب، قصير وطبيعي (جملة أو اتنين)، "
              "إيموجي واحد بالكتير، من غير هاشتاجات، ماتخترعش أسعار ولا مواعيد ولا عروض.")
    user = (f"البوست ({platform or 'سوشيال'}):\n{post[:1200] or '—'}\n\n"
            + (f"الـ CTA كان: اكتب «{keyword}» في الكومنت. اللي كتبها نوعه keyword، ورده يقوله إننا بعتناله رسالة.\n" if keyword else "")
            + (f"الرسالة الخاصة اللي هتتبعت للي كتب الكلمة لازم تقول: {dm_hint}\n" if dm_hint else "")
            + f"الكومنتات:\n{lst}\n\n"
            "الأنواع: lead (عايز يشتري أو بيسأل عن سعر/حجز)، question (سؤال)، keyword (كتب كلمة الـ CTA)، support (مشكلة أو شكوى)، praise (مدح)، spam، other.\n"
            'رجّع JSON بس: {"items": [{"id": "رقم الكومنت زي ما هو", "type": "", "reply": "الرد", "dm": "رسالة خاصة لو النوع lead أو keyword، وإلا فاضي"}]}')
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def keyword_hit(text: str, keyword: str) -> bool:
    k = (keyword or "").strip().lower()
    return bool(k) and k in (text or "").lower()


def mock_triage(comments: list[dict], keyword: str) -> dict:
    out = []
    for c in comments:
        t = str(c.get("text") or "")
        kind = "keyword" if keyword_hit(t, keyword) else "question" if "?" in t or "؟" in t else "lead" if "سعر" in t or "بكام" in t else "praise"
        out.append({"id": c["id"], "type": kind, "reply": "شكرًا 🙏 بعتنالك رسالة" if kind == "keyword" else "شكرًا لكلامك الحلو 🙏",
                    "dm": "أهلًا! ده اللينك اللي طلبته 👇" if kind in ("keyword", "lead") else ""})
    return {"items": out}


# ---------------------------------------------------------------- 🧹 شيل نَفَس الذكاء الصناعي

INVISIBLE = re.compile("[​‌‍⁠⁡⁢⁣⁤﻿­‪‫‬‭‮⁦⁧⁨⁩]")
AI_TELLS_EN = ["delve", "in today's fast-paced world", "unlock", "elevate", "game-changer", "seamless", "leverage", "embark",
               "tapestry", "in conclusion", "moreover", "furthermore", "it's not just", "dive into", "navigate the", "realm"]
AI_TELLS_AR = ["في عالم اليوم المتسارع", "لا يخفى على أحد", "في الختام", "بالإضافة إلى ذلك", "دعونا", "رحلة", "اكتشف سر", "عالم من",
               "تجربة فريدة", "لا مثيل لها", "ليس مجرد", "في هذا العصر", "علاوة على ذلك", "بكل تأكيد", "لا شك أن"]


def clean_invisible(text: str) -> tuple[str, list[str]]:
    """الحروف المخفية (اللي بتكشف إن الكلام متولد) والمسافات الغريبة. من غير ما نلمس الكلام نفسه."""
    changes = []
    n = len(INVISIBLE.findall(text))
    if n:
        text = INVISIBLE.sub("", text)
        changes.append(f"شلت {n} حرف مخفي")
    if " " in text or " " in text:
        text = text.replace(" ", " ").replace(" ", " ")
        changes.append("مسافات غريبة بقت عادية")
    t2 = re.sub(r"[ \t]{2,}", " ", text)
    if t2 != text:
        text = t2
        changes.append("مسافات زيادة")
    return text.strip(), changes


def humanize_messages(text: str, brand: str) -> list[dict]:
    system = ("انت محرر بيخلّي الكلام يبان مكتوب بإيد بني آدم، مش متولد. "
              "شيل العبارات المعلّبة اللي بتكشف الذكاء الصناعي، والشرط الطويلة (—) الكتير، والإيموجي الكتير، والتكرار، والجمل الإنشائية. "
              f"عبارات تتشال أو تتغير: {'، '.join(AI_TELLS_AR)} / {', '.join(AI_TELLS_EN)}.\n"
              "ممنوع: تغيّر المعنى، أو اللهجة، أو اللغة، أو أي رقم/سعر/لينك/منشن، أو كلمة الـ CTA. الطول قريب من الأصلي. الهاشتاجات تفضل في الآخر زي ما هي."
              + (f"\nصوت البراند:\n{brand[:1500]}" if brand else ""))
    user = (f"الكلام:\n{text[:4000]}\n\n"
            'رجّع JSON بس: {"text": "الكلام بعد التعديل", "changes": ["كل تغيير في سطر قصير"]}')
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]
