"""📱 «تصوير بالموبايل»: الشخص بيصوّر نفسه بيتكلم، والبرنامج بيراجع الفيديو ويعمل مونتاج أوتوماتيك.

هنا الحاجات اللي مالهاش دعوة بالسيرفر: ملاحظات القواعد الثابتة، برومبت التحليل، وتقسيم الكلام لقطات
بكاميرات مختلفة (زووم وحركة على الوش) عشان الفيديو ميبقاش ممل، وتظبيط الألوان.
"""
from __future__ import annotations

import json
import uuid

# زوايا الكاميرا (بالقص من الفيديو نفسه): zoom و x/y من -1 لـ 1 (y سالب = فوق، عشان الوش غالبًا في التلت اللي فوق)
SHOTS = [
    ("wide", 1.0, 0.0, 0.0),
    ("close", 1.32, 0.0, -0.45),
    ("medium", 1.14, 0.0, -0.25),
    ("side_l", 1.22, -0.5, -0.3),
    ("closer", 1.45, 0.0, -0.5),
    ("side_r", 1.22, 0.5, -0.3),
]
SHOT_AR = {"wide": "واسعة", "close": "قريبة", "medium": "متوسطة", "side_l": "من الشمال", "closer": "قريبة جدًا", "side_r": "من اليمين"}
SPLIT_AT = 5.5     # اللقطة الأطول من كده بتتقسم عند أقرب وقفة بين كلمتين
MIN_SHOT = 1.2
PAD = 0.08         # هامش قبل وبعد الكلام عشان الكلمة متتقطعش


def rule_notes(m: dict) -> list[dict]:
    """ملاحظات بالقواعد الثابتة (من غير ذكاء اصطناعي): الاتجاه، الإضاءة، الصوت، أول ٣ ثواني، الطول، السكتات."""
    out = []
    add = lambda title, why, fix, level="must", t=None: out.append({"id": uuid.uuid4().hex[:8], "title": title, "why": why, "fix": fix, "level": level, "t": t, "src": "rule"})  # noqa: E731
    if m.get("w") and m.get("h") and m["w"] > m["h"]:
        add("الفيديو عرضي", "الريلز والتيك توك بيتعرضوا طولي (9:16)، والعرضي بيتقص أو بيظهر صغير.", "صوّر والموبايل واقف (طولي).")
    if m.get("yavg") is not None and m["yavg"] < 70:
        add("الصورة غامقة", f"متوسط الإضاءة {round(m['yavg'])} من 255، والوش مش واضح.", "قف قدام شباك أو لمبة، والنور يبقى قدام وشك مش وراك.")
    if m.get("loud") is not None and m["loud"] < -30:
        add("الصوت واطي", f"متوسط الصوت {round(m['loud'])} dB.", "قرّب الموبايل منك أو استخدم مايك صغير، وصوّر في مكان هادي.")
    if m.get("first_word") is not None and m["first_word"] > 1.5:
        add("الكلام بيبدأ متأخر", f"أول كلمة بعد {m['first_word']:.1f} ثانية، والناس بتقرر تكمّل ولا لأ في أول ثانيتين.",
            "ابدأ بالهوك من أول لحظة (المونتاج هيقص السكوت ده، بس الأحسن تبدأ على طول).", "nice", 0)
    if m.get("dur") and m["dur"] > 90:
        add("الفيديو طويل", f"{round(m['dur'])} ثانية. الفيديوهات القصيرة (٢٠–٦٠ ثانية) بتتشاف للآخر أكتر.", "اختصر للفكرة الأساسية، أو قسّمه لأكتر من فيديو.", "nice")
    if m.get("silence_ratio") and m["silence_ratio"] > 0.25:
        add("سكتات كتير", f"حوالي {round(m['silence_ratio'] * 100)}٪ من الفيديو سكوت.", "المونتاج هيقصها لوحده، بس حاول تتكلم بإيقاع أسرع شوية.", "nice")
    return out


def review_prompt(m: dict, words_txt: str, script: str, rules: str, n_frames: int) -> str:
    return (
        "انت مخرج ومحرر فيديوهات قصيرة (ريلز/تيك توك) وبتراجع فيديو صوّره صاحبه بالموبايل وهو بيتكلم للكاميرا، قبل المونتاج.\n"
        f"معلومات الفيديو: {json.dumps({k: m.get(k) for k in ('dur', 'w', 'h', 'yavg', 'loud', 'first_word', 'silence_ratio', 'wpm')}, ensure_ascii=False)}\n"
        f"معاك {n_frames} لقطات منه بالترتيب.\n"
        f"الكلام اللي اتقال: {words_txt[:5000] or '(مفيش كلام مسموع)'}\n"
        + (f"السكريبت اللي كان المفروض يتقال: {script[:3000]}\n" if script else "")
        + (rules + "\n\n" if rules else "")
        + "المطلوب: ملاحظات عملية يقدر يصلحها لو هيعيد التصوير، مرتبة من الأهم. كل ملاحظة: title قصير، why (الدليل من الفيديو أو الكلام)، "
          "fix (يعمل إيه بالظبط المرة الجاية)، level («must» لو بتأثر على المشاهدات بجد، «nice» لو تحسين)، و t (الثانية لو الملاحظة على لحظة معينة، أو null). "
          "ركّز على: الهوك في أول ثانيتين (المكتوب والمعروض والمنطوق)، الطاقة ونبرة الصوت، البص للكاميرا، الكادر والإضاءة والخلفية، "
          "إيقاع الكلام، الجملة اللي بعد الهوك، الدعوة للفعل في الآخر، ولو فيه سكريبت: اللي اتنسى أو اتغير. من ٣ لـ ٨ ملاحظات، ومتكررش ملاحظات الإضاءة والصوت لو الأرقام كويسة.\n"
          "وكمان: tone نوع الفيديو (comedy لو كوميدي/هزار، educational لو تعليمي، story لو حكاية، sales لو بيع، other)، "
          "وscore من 100 للفيديو زي ما هو، وsummary جملة واحدة، وbroll: من ٢ لـ ٥ لقطات قصيرة (B-roll) يصورها تقوّي الكلام (كل واحدة: what تتصوّر إيه، at بعد أي جملة).\n"
          "اكتب بالعربي البسيط. ممنوع تخترع حاجة مش في الفيديو.\n"
          'الشكل: {"tone":"other","score":0,"summary":"","notes":[{"title":"","why":"","fix":"","level":"must","t":null}],"broll":[{"what":"","at":""}]}'
    )


def mock_review() -> dict:
    return {"tone": "comedy", "score": 68, "summary": "الفكرة كويسة، بس البداية هادية والكادر ثابت طول الوقت.",
            "notes": [{"title": "الهوك محتاج يبقى أقوى", "why": "أول جملة تعريف بالنفس، مش سبب للفرجة.", "fix": "ابدأ بالنتيجة أو بسؤال مباشر للمشاهد.", "level": "must", "t": 0},
                      {"title": "البص للكاميرا", "why": "عينك على الشاشة في نص الفيديو.", "fix": "بُص في عدسة الكاميرا نفسها.", "level": "nice", "t": 8}],
            "broll": [{"what": "لقطة قريبة لإيدك وانت بتشتغل", "at": "بعد الجملة التانية"}]}


def clean_review(raw: dict) -> dict:
    notes = []
    for n in raw.get("notes") or []:
        if isinstance(n, dict) and str(n.get("title") or "").strip():
            t = n.get("t")
            notes.append({"id": uuid.uuid4().hex[:8], "title": str(n["title"]).strip()[:140], "why": str(n.get("why") or "").strip()[:500],
                          "fix": str(n.get("fix") or "").strip()[:500], "level": "must" if n.get("level") == "must" else "nice",
                          "t": round(float(t), 1) if isinstance(t, (int, float)) else None, "src": "ai"})
    try:
        score = max(0, min(100, int(raw.get("score"))))
    except (TypeError, ValueError):
        score = None
    broll = [{"what": str(b.get("what") or "")[:200], "at": str(b.get("at") or "")[:120]} for b in raw.get("broll") or [] if isinstance(b, dict) and b.get("what")]
    tone = raw.get("tone") if raw.get("tone") in ("comedy", "educational", "story", "sales", "other") else "other"
    return {"tone": tone, "score": score, "summary": str(raw.get("summary") or "")[:300], "notes": notes[:10], "broll": broll[:6]}


def speech_ranges(dur: float, quiet: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """الأجزاء اللي فيها كلام = الفيديو من غير السكتات (بهامش صغير عشان الكلمات متتقطعش)."""
    out, t = [], 0.0
    for a, b in sorted(quiet):
        if a - t > 0.25:
            out.append((max(0.0, t - PAD), min(dur, a + PAD)))
        t = max(t, b)
    if dur - t > 0.25:
        out.append((max(0.0, t - PAD), dur))
    merged: list[list[float]] = []
    for a, b in out:
        if merged and a - merged[-1][1] < 0.3:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    return [(a, b) for a, b in merged if b - a >= 0.4] or [(0.0, dur)]


def split_shots(ranges: list[tuple[float, float]], words: list[dict]) -> list[tuple[float, float]]:
    """كل جزء كلام أطول من SPLIT_AT بيتقسم عند أوسع وقفة بين كلمتين قريبة من النص، عشان اللقطات تتغيّر كل كام ثانية."""
    gaps = [((w0["e"] + w1["s"]) / 2, w1["s"] - w0["e"]) for w0, w1 in zip(words, words[1:])]
    out = []
    stack = list(ranges)
    while stack:
        a, b = stack.pop(0)
        if b - a <= SPLIT_AT:
            out.append((a, b))
            continue
        mid = (a + b) / 2
        cands = [(abs(t - mid) - g * 4, t) for t, g in gaps if a + MIN_SHOT < t < b - MIN_SHOT]
        cut = min(cands)[1] if cands else mid
        stack[0:0] = [(a, cut), (cut, b)]
    return out


def camera_plan(n: int) -> list[tuple[str, float, float, float]]:
    """زاوية لكل لقطة: أول لقطة قريبة (الهوك)، ومفيش زاويتين ورا بعض زي بعض، والواسعة بترجع كل شوية."""
    order = ["close", "wide", "medium", "side_l", "closer", "wide", "side_r", "medium"]
    by = {s[0]: s for s in SHOTS}
    return [by[order[i % len(order)]] for i in range(n)]


def auto_color(yavg: float | None, satavg: float | None) -> dict:
    """تظبيط ألوان بسيط من متوسط الإضاءة والتشبع: الغامق بيتنوّر، والباهت بياخد لون، وتباين خفيف دايمًا."""
    adj = {"contrast": 8, "sharp": 15}
    if yavg is not None:
        adj["bright"] = int(max(-25, min(45, (118 - yavg) * 0.55)))
    if satavg is not None:
        adj["sat"] = int(max(-10, min(22, (42 - satavg) * 0.5)))
    return adj


# ---------------------------------------------------------------- 🎞️ B-roll أوتوماتيك: لقطة بالشخص (متولّدة بصوره) أو لقطة ستوك حقيقية
MAX_BROLL = 4
MAX_AVATAR = 2


def broll_plan_prompt(texts: list[str], has_twin: bool, brief: str) -> str:
    lines = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(texts))
    kinds = ("avatar = a short shot of THE SAME PERSON doing something that shows the line (cooking, working at the laptop, walking, pointing at a product…), "
             "generated from their real photos and their filming place; stock = real stock footage WITHOUT the person (objects, places, hands, food, city…). "
             if has_twin else "stock = real stock footage that shows the line (objects, places, hands, food, city…). There is no avatar option. ")
    return ("You are the editor of a vertical talking-head video (one person speaking to a phone camera). Choose B-roll cutaways that make it less boring.\n"
            + (f"Topic: {brief[:500]}\n" if brief else "")
            + "Shots (what the person says in each shot):\n" + lines + "\n\n"
            + kinds
            + f"Rules: at most {MAX_BROLL} B-rolls" + (f", at most {MAX_AVATAR} avatar" if has_twin else "") + "; never shot 1 (the hook keeps the face); never two shots in a row; "
              "only where a visual really adds something concrete to the words. For each: shot number, kind, query (2-5 English Pexels keywords for stock), "
              "and prompt (one English sentence describing the action and framing for avatar, vertical 9:16, natural phone-camera look).\n"
              'Return JSON only: {"broll": [{"shot": 2, "kind": "stock", "query": "...", "prompt": "..."}]}')


def mock_broll_plan(n: int, has_twin: bool) -> dict:
    out = []
    for k in range(1, n, 2):
        out.append({"shot": k + 1, "kind": "avatar" if has_twin and len(out) % 2 == 0 else "stock", "query": "coffee cup morning",
                    "prompt": "The person pours coffee in their kitchen, medium shot, natural light"})
    return {"broll": out[:MAX_BROLL]}


def clean_broll_plan(raw: dict, n: int, has_twin: bool) -> list[dict]:
    out, last, av = [], -9, 0
    for b in sorted([x for x in raw.get("broll") or [] if isinstance(x, dict)], key=lambda x: int(x.get("shot") or 0) if str(x.get("shot") or "").isdigit() else 0):
        try:
            k = int(b.get("shot")) - 1
        except (TypeError, ValueError):
            continue
        if not 0 < k < n or k - last < 2 or len(out) >= MAX_BROLL:
            continue
        kind = "avatar" if b.get("kind") == "avatar" and has_twin and av < MAX_AVATAR else "stock"
        av += kind == "avatar"
        out.append({"shot": k, "kind": kind, "query": str(b.get("query") or "")[:80] or "lifestyle", "prompt": str(b.get("prompt") or "")[:400]})
        last = k
    return out
