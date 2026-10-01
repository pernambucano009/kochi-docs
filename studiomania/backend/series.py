"""المسلسلات: قراءة السكريبت، ترقيم جمل الفويس أوفر على الصوت، وتجهيز اللقطات وبرومبتاتها.

القاعدة: الصوت هو المرجع للتوقيت. مدة الحلقة = مدة الفويس أوفر، ومدة كل لقطة من وقت الجمل اللي بتخدمها.
"""

import json
import math
import re

# ---------------------------------------------------------------- السكريبت

SCENE_RE = re.compile(r"^\s*(?:#+\s*)?المشهد\s*(\d+)\s*[—\-–:|]*\s*(.*)$")
QUOTE_RE = re.compile(r"«([^»]+)»")


def parse_script(text: str) -> dict:
    """المشاهد وجمل الفويس أوفر (الكلام اللي بين « »). كل جملة معاها رقم المشهد بتاعها."""
    scenes: list[dict] = []
    lines: list[dict] = []
    current = 0
    for raw in (text or "").splitlines():
        m = SCENE_RE.match(raw)
        if m:
            current = int(m.group(1))
            scenes.append({"n": current, "title": m.group(2).strip()})
            continue
        for q in QUOTE_RE.findall(raw):
            q = q.strip()
            if q:
                lines.append({"n": len(lines) + 1, "text": q, "scene": current})
    if scenes:
        # اللي قبل أول مشهد (زي عنوان الحلقة بين « ») مش من الفويس أوفر
        lines = [{**ln, "n": k} for k, ln in enumerate((ln for ln in lines if ln["scene"]), 1)]
    if not lines:
        # سكريبت من غير « »: كل سطر مش فاضي جملة
        for raw in (text or "").splitlines():
            t = raw.strip()
            if t and not SCENE_RE.match(t):
                lines.append({"n": len(lines) + 1, "text": t, "scene": current})
    return {"scenes": scenes, "lines": lines}


# ---------------------------------------------------------------- مطابقة الكلمات على الجمل

def norm(word: str) -> str:
    w = re.sub(r"[ً-ْـ]", "", word or "")
    w = re.sub("[إأآا]", "ا", w).replace("ة", "ه").replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    return re.sub(r"[^\w]", "", w.lower())


def tokens(text: str) -> list[str]:
    return [t for t in (norm(x) for x in re.split(r"\s+", text or "")) if t]


def _sim(a: str, b: str) -> float:
    if a == b:
        return 1.0
    if not a or not b:
        return 0.0
    # تشابه بسيط: نسبة الحروف المشتركة بالترتيب (موديل الكلام ساعات بيكتب الكلمة بشكل مختلف)
    m, n = len(a), len(b)
    prev = [0] * (n + 1)
    for i in range(1, m + 1):
        cur = [0] * (n + 1)
        for j in range(1, n + 1):
            cur[j] = prev[j - 1] + 1 if a[i - 1] == b[j - 1] else max(prev[j], cur[j - 1])
        prev = cur
    return 2 * prev[n] / (m + n)


def align(words: list[dict], lines: list[dict]) -> list[dict]:
    return align_with_ratio(words, lines)[0]


def align_with_ratio(words: list[dict], lines: list[dict]) -> tuple[list[dict], float]:
    """كل جملة من السكريبت بوقت بدايتها ونهايتها من كلمات موديل الكلام (w, s, e).
    بنطابق الكلمات بالترتيب (زي المقارنة بين نصين)، والجمل اللي ما اتلقطتش بتاخد وقت بين اللي قبلها واللي بعدها."""
    script = [(li, t) for li, line in enumerate(lines) for t in tokens(line["text"])]
    matched = 0
    heard = [(norm(w.get("w", "")), float(w.get("s", 0)), float(w.get("e", 0))) for w in words]
    heard = [h for h in heard if h[0]]
    n, m = len(script), len(heard)
    out = [{"start": None, "end": None} for _ in lines]
    if n and m:
        gap = -0.4
        score = [[0.0] * (m + 1) for _ in range(n + 1)]
        move = [[0] * (m + 1) for _ in range(n + 1)]
        for i in range(1, n + 1):
            score[i][0], move[i][0] = score[i - 1][0] + gap, 1
        for j in range(1, m + 1):
            score[0][j], move[0][j] = score[0][j - 1] + gap, 2
        for i in range(1, n + 1):
            for j in range(1, m + 1):
                s = _sim(script[i - 1][1], heard[j - 1][0])
                best, mv = score[i - 1][j - 1] + (s * 2 - 1), 0
                if score[i - 1][j] + gap > best:
                    best, mv = score[i - 1][j] + gap, 1
                if score[i][j - 1] + gap > best:
                    best, mv = score[i][j - 1] + gap, 2
                score[i][j], move[i][j] = best, mv
        i, j = n, m
        while i > 0 and j > 0:
            mv = move[i][j]
            if mv == 0:
                li = script[i - 1][0]
                if _sim(script[i - 1][1], heard[j - 1][0]) >= 0.5:
                    matched += 1
                    s, e = heard[j - 1][1], heard[j - 1][2]
                    o = out[li]
                    o["start"] = s if o["start"] is None else min(o["start"], s)
                    o["end"] = e if o["end"] is None else max(o["end"], e)
                i, j = i - 1, j - 1
            elif mv == 1:
                i -= 1
            else:
                j -= 1
    ratio = matched / max(1, min(n, m))
    return fill_gaps(out, words[-1]["e"] if words else 0), ratio


def sentences_from_words(words: list[dict]) -> list[dict]:
    """جمل من كلام الصوت نفسه (لما الفويس أوفر اتسجّل بكلام غير السكريبت):
    بنقطع عند . ؟ ! أو سكتة طويلة، وعند الفاصلة لو الجملة طولت."""
    out, cur = [], []
    for k, w in enumerate(words):
        cur.append(w)
        text = str(w.get("w", ""))
        nxt = words[k + 1] if k + 1 < len(words) else None
        pause = (float(nxt["s"]) - float(w["e"])) if nxt else 99
        dur = float(w["e"]) - float(cur[0]["s"])
        if re.search(r"[.؟?!]$", text) or pause >= 0.7 or (re.search(r"[،,]$", text) and dur >= 2.5) or nxt is None:
            out.append({"n": len(out) + 1, "text": " ".join(str(x["w"]) for x in cur).strip(), "scene": 0,
                        "start": round(float(cur[0]["s"]), 2), "end": round(float(cur[-1]["e"]), 2)})
            cur = []
    return out


def fill_gaps(out: list[dict], total: float) -> list[dict]:
    """الجمل اللي من غير وقت: بتتحط بين اللي قبلها واللي بعدها بالتساوي."""
    k = 0
    while k < len(out):
        if out[k]["start"] is not None:
            k += 1
            continue
        j = k
        while j < len(out) and out[j]["start"] is None:
            j += 1
        a = out[k - 1]["end"] if k > 0 else 0.0
        b = out[j]["start"] if j < len(out) else total
        step = max(0.0, b - a) / (j - k)
        for q in range(k, j):
            out[q] = {"start": a + step * (q - k), "end": a + step * (q - k + 1)}
        k = j
    return [{"start": round(o["start"], 2), "end": round(max(o["end"], o["start"]), 2)} for o in out]


def estimate(segments: list[tuple[float, float]], lines: list[dict]) -> list[dict]:
    """من غير موديل الكلام: توقيت تقريبي من أماكن السكوت في الصوت وطول كل جملة."""
    if not segments or not lines:
        return [{"start": 0.0, "end": 0.0} for _ in lines]
    weights = [len(re.sub(r"[^؀-ۿ\w]", "", line["text"])) + 2 for line in lines]
    rate = sum(b - a for a, b in segments) / sum(weights)
    expected = [w * rate for w in weights]
    L, S = len(lines), len(segments)
    inf = float("inf")
    dp = [[inf] * (S + 1) for _ in range(L + 1)]
    prv: list[list] = [[None] * (S + 1) for _ in range(L + 1)]
    dp[0][0] = 0.0
    for i in range(L + 1):
        for j in range(S + 1):
            if dp[i][j] == inf:
                continue
            for k in range(1, 6):
                for m in range(1, 7):
                    if (k > 1 and m > 1) or i + k > L or j + m > S:
                        continue
                    actual = segments[j + m - 1][1] - segments[j][0]
                    exp = sum(expected[i:i + k]) + 0.6 * (m - 1)
                    c = dp[i][j] + (actual - exp) ** 2 + 0.3 * (k - 1)
                    if c < dp[i + k][j + m]:
                        dp[i + k][j + m], prv[i + k][j + m] = c, (i, j, k, m)
    if dp[L][S] == inf:
        # جمل أكتر بكتير من المقاطع: نوزّع على الصوت كله بالطول
        a, b = segments[0][0], segments[-1][1]
        out, t = [], a
        for e in expected:
            d = (b - a) * e / sum(expected)
            out.append({"start": round(t, 2), "end": round(t + d, 2)})
            t += d
        return out
    res: list = [None] * L
    i, j = L, S
    while i > 0:
        pi, pj, k, m = prv[i][j]
        a, b = segments[pj][0], segments[pj + m - 1][1]
        tot, t = sum(expected[pi:pi + k]), a
        for q in range(k):
            d = (b - a) * expected[pi + q] / tot
            res[pi + q] = {"start": round(t, 2), "end": round(t + d, 2)}
            t += d
        i, j = pi, pj
    return res


# ---------------------------------------------------------------- اللقطات (الموديل)

SHOTS_FORMAT = """{"shots": [
  {"scene": 1, "start": 0.0, "end": 2.4, "lines": [1],
   "title": "وصف قصير بالعربي للقطة",
   "shot": "extreme close-up | close-up | medium | wide | over-the-shoulder | POV | insert ...",
   "camera": "static | slow push-in | handheld follow | tracking | pan ...",
   "location": "المكان",
   "sfx": "المؤثرات الصوتية (من غير موسيقى إلا لو ضروري)",
   "transition": "cut | match cut | hard cut to black ...",
   "prompt": "English prompt for the video model: subject, action, setting, lighting, lens, camera move, mood. Vertical 9:16, cinematic, realistic."}
]}"""


def shots_messages(bible: str, character: str, script: str, lines: list[dict], total: float, notes: str = "") -> list[dict]:
    timed = "\n".join(f'{ln["n"]}. [{ln["start"]:.2f}–{ln["end"]:.2f}] (مشهد {ln.get("scene") or "-"}) «{ln["text"]}»' for ln in lines)
    system = (
        "أنت مخرج ومونتير لمسلسل قصير على السوشيال ميديا. شغلتك تحوّل السكريبت لقائمة لقطات (Shot List) "
        "جاهزة للتوليد بموديل فيديو، وكل لقطة متظبطة على توقيت الفويس أوفر.\n\n"
        f"دستور المسلسل:\n{bible.strip()}\n\n"
        f"الشخصية (لازم تتوصف بنفس الشكل في كل برومبت):\n{character.strip()}"
    )
    user = f"""السكريبت:
{script.strip()}

جمل الفويس أوفر زي ما اتقالت فعلًا في الصوت، بتوقيتها الحقيقي (بالثواني). ممكن الكلام يختلف عن السكريبت: الصوت هو المرجع، والسكريبت للمشاهد والصورة. أي جملة مش من كلام الشخصية (زي ملاحظة أداء اتقرت بالغلط) اعتبرها سكوت. مدة الحلقة كلها {total:.2f} ثانية:
{timed}

قواعد مهمة جدًا:
- الصوت هو المرجع: اللقطات بتغطي الحلقة كلها من 0 لحد {total:.2f} من غير فراغات ولا تداخل (end لكل لقطة = start اللي بعدها).
- أي مدد مكتوبة في السكريبت نفسه تجاهلها. المدة بتيجي من وقت الجمل بس.
- كل جملة ليها لقطة أو أكتر بتخدم معناها بالظبط. الجملة الطويلة ممكن تتقسم على أكتر من لقطة، والكلمات القصيرة ورا بعض ممكن تبقى لقطات سريعة.
- حدود اللقطات يفضل تبقى عند بداية جملة أو في السكوت بين الجمل. الوقت اللي من غير كلام (زي آخر الحلقة) ليه لقطاته من السكريبت.
- اللقطة الواحدة من 0.8 لـ 6 ثواني.
- lines: أرقام الجمل اللي بتتقال وقت اللقطة.
- prompt بالإنجليزي لموديل فيديو (Seedance): وصف الشخصية الكامل في كل برومبت (لو ظاهرة)، الفعل، المكان في السعودية، الإضاءة، العدسة، حركة الكاميرا، المزاج. فيديو طولي 9:16 واقعي سينمائي. الشخصية ما بتتكلمش قدام الكاميرا. من غير أي كلام مكتوب على الشاشة. لقطات الشاشات (جوال/لابتوب) توصف محتواها بوضوح.
- اسم الشخصية ما يتذكرش أبدًا.
{f"- ملاحظات المخرج: {notes.strip()}" if notes.strip() else ""}

رجّع JSON بس بالشكل ده:
{SHOTS_FORMAT}"""
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def parse_shots(text: str, total: float) -> list[dict]:
    """اللقطات من رد الموديل، متظبطة: مترتبة ومتلاصقة من 0 لآخر الحلقة."""
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        raise ValueError("الموديل ما رجعش قائمة لقطات")
    data = json.loads(m.group(0), strict=False)
    raw = data.get("shots") if isinstance(data, dict) else None
    if not isinstance(raw, list) or not raw:
        raise ValueError("الموديل ما رجعش قائمة لقطات")
    shots = []
    for s in raw:
        if not isinstance(s, dict):
            continue
        try:
            start, end = float(s.get("start", 0)), float(s.get("end", 0))
        except (TypeError, ValueError):
            continue
        shots.append({
            "scene": int(s.get("scene") or 0) if str(s.get("scene") or "0").isdigit() else 0,
            "start": start, "end": end,
            "lines": [int(x) for x in s.get("lines") or [] if str(x).isdigit()],
            **{k: str(s.get(k) or "").strip()[:2000] for k in ("title", "shot", "camera", "location", "sfx", "transition", "prompt")},
        })
    return snap(shots, total)


def snap(shots: list[dict], total: float) -> list[dict]:
    """ترتيب اللقطات وتلزيقها: الأولى من 0، وكل واحدة بتبدأ مكان ما اللي قبلها خلصت، والأخيرة لآخر الصوت."""
    shots = sorted((s for s in shots if s["end"] > s["start"] or s["end"] == 0), key=lambda s: s["start"])
    out = []
    t = 0.0
    for k, s in enumerate(shots):
        end = min(total, s["end"]) if k < len(shots) - 1 else total
        if end - t < 0.3:  # أقصر من اللازم: تدخل في اللي قبلها
            continue
        out.append({**s, "start": round(t, 2), "end": round(end, 2)})
        t = end
    if out and out[-1]["end"] < total:
        out[-1]["end"] = round(total, 2)
    # لقطة أطول من 8 ثواني بتتقسم (Seedance بيعمل 15 ثانية بالكتير، واللقطات الطويلة بتملّ)
    split = []
    for s in out:
        d = s["end"] - s["start"]
        parts = max(1, math.ceil(d / 6)) if d > 8 else 1
        for q in range(parts):
            a, b = s["start"] + d * q / parts, s["start"] + d * (q + 1) / parts
            split.append({**s, "start": round(a, 2), "end": round(b, 2),
                          "title": s.get("title", "") + (f" ({q + 1}/{parts})" if parts > 1 else "")})
    for k, s in enumerate(split, 1):
        s["n"] = k
    return split


def mock_shots(lines: list[dict], total: float) -> list[dict]:
    shots = []
    for ln in lines:
        shots.append({"scene": ln.get("scene") or 0, "start": ln["start"], "end": ln["end"], "lines": [ln["n"]],
                      "title": f"لقطة تجريبية للجملة {ln['n']}", "shot": "medium", "camera": "slow push-in",
                      "location": "كافيه في الرياض", "sfx": "", "transition": "cut",
                      "prompt": f"Mock prompt for line {ln['n']}: tall thin man with a small hair bun and a thick mustache, black loose clothes."})
    return snap(shots, total)


# ---------------------------------------------------------------- كتابة الحلقة (الموديل يكتب وانت توجّهه)

SCRIPT_FORMAT = """الشكل المطلوب بالظبط (البرنامج بيقرا السكريبت بالشكل ده):
الحلقة رقم N — «اسم الحلقة»
المشهد 1 — اسم المشهد
الصورة: وصف اللقطات والمكان والحركة (من غير مدد بالثواني)
«جملة الفويس أوفر الأولى.»
«جملة الفويس أوفر التانية.»
المشهد 2 — ...
- كل جملة فويس أوفر في سطر لوحدها بين « » وبس. أي كلام تاني (وصف، ملاحظات) من غير « ».
- الوقفات اكتبها جوه الجملة بـ ... مش في سطر لوحده.
- المشهد اللي من غير كلام يتكتب عادي من غير « »."""


def writer_messages(bible: str, character: str, previous: list[dict], number: int, chat: list[dict]) -> list[dict]:
    """رسايل كاتب الحلقات: الدستور + الحلقات اللي فاتت كاملة + النقاش على الحلقة دي."""
    prev = "\n\n".join(f"=== الحلقة {p['number']}: {p['name']} ===\n{p['script'].strip()}" for p in previous if p.get("script", "").strip())
    system = (
        "أنت كاتب سيناريو ومخرج إبداعي لمسلسل قصير على السوشيال ميديا. بتكتب الحلقات واحدة ورا التانية، "
        "وكل حلقة استكمال طبيعي للي قبلها: القصة بتتقدم، ومحدش بيعيد اللي اتقال، وكل حلقة بتسيب سؤال للي بعدها.\n\n"
        f"دستور المسلسل:\n{bible.strip()}\n\n"
        + (f"الشخصية:\n{character.strip()}\n\n" if character.strip() else "")
        + (f"الحلقات اللي اتعملت لحد دلوقتي (بالترتيب):\n{prev}\n\n" if prev else "")
        + f"{SCRIPT_FORMAT}\n\n"
        "رد دايمًا بسكريبت الحلقة كامل بالشكل ده (حتى لو التعديل المطلوب صغير)، ومن غير أي كلام قبله أو بعده. "
        "اسم الشخصية ما يتذكرش أبدًا."
    )
    first = f"اكتب الحلقة رقم {number} استكمالًا للي فات."
    msgs = [{"role": "system", "content": system}]
    if not chat or chat[0]["role"] != "user":
        msgs.append({"role": "user", "content": first})
    return msgs + chat[-30:]


def clean_script(text: str) -> str:
    """لو الموديل حط السكريبت جوه ``` بناخد اللي جوه بس."""
    m = re.search(r"```(?:\w+)?\n(.*?)```", text or "", re.S)
    return (m.group(1) if m else text or "").strip()


def mock_script(number: int, chat: list[dict]) -> str:
    note = f"\n(اتعدّل حسب: {chat[-1]['content'][:60]})" if chat and chat[-1]["role"] == "user" else ""
    return (f"الحلقة رقم {number} — «تجربة»\nالمشهد 1 — البداية\nالصورة: هو جالس قدام اللابتوب بالليل.\n"
            f"«أول سطر كتبته... ما اشتغل.»\n«والثاني بعد.»\nالمشهد 2 — القرار\nالصورة: يقفل اللابتوب ويطالع الشباك.\n"
            f"«بس ما وقفت.»{note}")


# ---------------------------------------------------------------- الستوري بورد (GPT Image)

def frame_prompt(shot: dict, character: str) -> str:
    """برومبت صورة الستوري بورد للقطة: نفس شكل الشخصية من الصور، وكادر طولي."""
    return "\n".join(x for x in [
        "Cinematic storyboard frame for a vertical 9:16 short-film shot. Photorealistic still, like a frame grab from the final film.",
        f"Shot: {shot.get('shot') or ''}. Camera: {shot.get('camera') or ''}. Location: {shot.get('location') or ''}.",
        f"Action: {shot.get('prompt') or shot.get('title') or ''}",
        f"The man must look exactly like the person in the reference images: {character.strip()}" if character.strip()
        else "The man must look exactly like the person in the reference images.",
        "Saudi Arabia setting, natural realistic lighting, shallow depth of field. No text, no captions, no logos, no watermark, no frame borders.",
    ] if x)
