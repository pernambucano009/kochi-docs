"""التايبوجرافي: الكلام المتقال بيتحوّل لموشن جرافيك (كلمات بتتكتب وتتبعتر وتتبدل بأيقونات...).

الرسم نفسه في frontend/typo-engine.js (نفس الملف بيعرض المعاينة وبيرسم الفيديو على السيرفر).
هنا: الستايلات، وبرومبت الموديل اللي بيقسم الكلام على حركات، واستخراج التايبوجرافي من فيديو في المعمل،
وشيل خلفية الأيقونات عشان تبقى ستيكرات شفافة.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

KINDS = {
    "pop": "كلمة كبيرة لوحدها على كارت ملون وبتتشطب في الآخر (للكلمة الأقوى، الهوك أو الافتتاحية)",
    "type": "سطر بيتكتب حرف حرف على قد الكلام ومعاه مؤشر وخربشة قلم (للجمل الهادية والأسئلة)",
    "build": "الجملة بتظهر كلمة كلمة وكلمة منها (focus) بتنوّر، وممكن صورة كبيرة جنبها (side)",
    "icon": "كلمة واحدة مهمة ومعاها أيقونة بتعبّر عنها (أسماء الحاجات، المفاهيم، القيم)",
    "letters": "كلمة قصيرة بحروف متباعدة وحرف منها بيتبدل بأيقونات ورا بعض (كلمة عاطفية أو الخلاصة)",
    "scatter": "حروف متبعترة بتتجمّع لحد ما تبقى الكلمة (لحظة فهم أو تحوّل، أو الختام)",
    "ring": "أيقونات كتير في دايرة بتلف (لما الكلام بيعدّ حاجات كتير أو «كل حاجة»)",
}
THEMES = ("light", "dark", "accent")

# الستايل اللي اتطلّع من فيديو المرجع (أبيض رمادي / أسود / أحمر، وكارت أصفر للكلمة الكبيرة)
BUILTIN_STYLES = {
    "mono-red": {
        "name": "أبيض وأسود وأحمر (المرجع)", "font": "SM Tajawal", "case": "lower", "grain": 0.12, "weight": 700,
        "light": {"bg": "#ECEBE8", "ink": "#141414", "accent": "#E5322D"},
        "dark": {"bg": "#0E0E0F", "ink": "#F4F4F2", "accent": "#E5322D"},
        "accent": {"bg": "#E9B21C", "ink": "#2A1A08", "accent": "#141414"},
        "rules": ["افتتاحية بكلمة كبيرة (pop) على الكارت الأصفر", "الأسئلة والجمل الطويلة type على خلفية فاتحة",
                  "الكلام الشخصي build على خلفية غامقة وجنبه صورة", "كل قيمة أو اسم حاجة = icon",
                  "الكلمة العاطفية في الآخر letters أو scatter"],
        "kinds": {"pop": 1, "type": 2, "build": 3, "icon": 3, "letters": 1, "scatter": 1, "ring": 1},
    },
    "kochi": {
        "name": "كوتشي (تيل وكريمي)", "font": "SM Changa", "case": "none", "grain": 0.08, "weight": 700,
        "light": {"bg": "#EEECDA", "ink": "#1E2A2A", "accent": "#E4572E"},
        "dark": {"bg": "#14201F", "ink": "#EEECDA", "accent": "#57B8AF"},
        "accent": {"bg": "#57B8AF", "ink": "#0E1A19", "accent": "#E4572E"},
        "rules": ["الهوك pop على التيل", "المعلومة build وكلمة الرقم focus", "الأكل والتمارين icon"],
        "kinds": {"pop": 1, "type": 1, "build": 3, "icon": 3, "letters": 1, "scatter": 1, "ring": 1},
    },
}

PLAN_FORMAT = """{
  "blocks": [{"from": 0, "to": 3, "kind": "pop | type | build | icon | letters | scatter | ring", "theme": "light | dark | accent",
              "text": "الكلام اللي يتكتب (من كلام الجمل دي بالظبط، ممكن تختصره لكلمة أو كلمتين في pop/icon/letters/scatter)",
              "focus": 0, "icon": "اسم ستيكر من المكتبة أو وصف قصير بالإنجليزي لأيقونة جديدة", "icons": ["..."], "letter": 1,
              "side": "اسم ستيكر/صورة كبيرة جنب الكلام في build أو فاضي"}]
}"""


def words_text(words: list[dict]) -> str:
    return " ".join(f"[{i}]{w['w']}({w['s']:.2f})" for i, w in enumerate(words))


def plan_messages(words: list[dict], style: dict, stickers: list[str], brief: str) -> list[dict]:
    """الموديل بيقسم الكلام (كل كلمة برقمها ووقتها) على بلوكات، ولكل بلوك حركة وأيقونات."""
    kinds = "\n".join(f"- {k}: {v}" for k, v in KINDS.items())
    rules = "\n".join(f"- {r}" for r in style.get("rules") or [])
    weights = ", ".join(f"{k}×{v}" for k, v in (style.get("kinds") or {}).items())
    text = (
        "أنت مصمم موشن تايبوجرافي محترف (زي فيديوهات الكلام المتحرك اللي الكلام فيها بيتحول لكلمات وأشكال وأيقونات). "
        "قدامك كلام متقال، كل كلمة برقمها ووقت ما اتقالت. قسّمه على بلوكات ورا بعض، كل بلوك = لقطة على الشاشة بحركة من دول:\n"
        f"{kinds}\n\n"
        + (f"قواعد الستايل ده:\n{rules}\n" if rules else "")
        + (f"الحركات بتتكرر تقريبًا بالنسب دي: {weights}\n" if weights else "")
        + (f"عن الفيديو: {brief}\n" if brief else "")
        + (f"الستيكرات اللي في المكتبة (استخدم الاسم بالظبط لو مناسب): {', '.join(stickers[:120])}\n" if stickers else
           "مفيش ستيكرات في المكتبة: اكتب وصف قصير بالإنجليزي لكل أيقونة محتاجها وهتترسم.\n")
        + "\nالكلام:\n" + words_text(words) + "\n\n"
        "القواعد:\n"
        "- from/to = أرقام الكلمات (من كام لكام، شامل). البلوكات ورا بعض وبتغطي كل الكلمات من غير ما تسيب ولا كلمة.\n"
        "- كل بلوك من كلمة لحد 9 كلمات، والإيقاع يتغير: لقطات سريعة لكلمة واحدة، وجمل أطول بالراحة.\n"
        "- غيّر theme عشان الفيديو يقلب بين فاتح وغامق (مش كل بلوك نفس الخلفية)، وaccent قليل (للحظات القوية بس).\n"
        "- icon/letters/ring/side محتاجين صور: اختار من المكتبة بالاسم الأول، ولو مفيش مناسب اكتب اسم قصير بالإنجليزي لأيقونة جديدة (2-3 كلمات، من غير كلمة icon). "
        "ring محتاج 5-6 icons.\n"
        "- الأيقونات الجديدة بتترسم بفلوس: الفيديو كله ميزيدش عن 8 أيقونات جديدة مختلفة، وكرر نفس الاسم بالظبط لو نفس الحاجة اتكررت.\n"
        "- letters: text كلمة واحدة قصيرة، وletter = رقم الحرف اللي هيتبدل (من 0).\n"
        "- focus = رقم الكلمة جوه البلوك اللي تنوّر (من 0) أو -1.\n"
        "- text في pop/icon/letters/scatter كلمة أو كلمتين بس من الكلام نفسه، بنفس لغته.\n"
        "رجّع JSON بس بالشكل ده:\n" + PLAN_FORMAT
    )
    return [{"role": "user", "content": text}]


def _i(v, d=0):
    try:
        return int(v)
    except (TypeError, ValueError):
        return d


def clean_plan(raw: dict, words: list[dict], duration: float) -> list[dict]:
    """البلوكات بأوقات حقيقية من الكلمات: كل بلوك من أول كلمة فيه لحد أول كلمة في اللي بعده."""
    n = len(words)
    out = []
    for b in (raw or {}).get("blocks") or []:
        if not isinstance(b, dict):
            continue
        a, z = max(0, _i(b.get("from"))), min(n - 1, _i(b.get("to"), n - 1))
        if out and a <= out[-1]["to"]:
            a = out[-1]["to"] + 1
        if a > z:
            continue
        kind = b.get("kind") if b.get("kind") in KINDS else "build"
        icons = [str(x).strip() for x in (b.get("icons") or []) if str(x).strip()][:9]
        out.append({"from": a, "to": z, "kind": kind, "theme": b.get("theme") if b.get("theme") in THEMES else "light",
                    "text": str(b.get("text") or "").strip(), "focus": _i(b.get("focus"), -1),
                    "icon": str(b.get("icon") or "").strip(), "icons": icons, "letter": _i(b.get("letter"), 1),
                    "side": str(b.get("side") or "").strip()})
    if not out and n:
        return mock_plan(words, duration)
    # كلمات اتسابت في الآخر: تتضاف لآخر بلوك
    if out and out[-1]["to"] < n - 1:
        out[-1]["to"] = n - 1
    return timed(out, words, duration)


def timed(blocks: list[dict], words: list[dict], duration: float) -> list[dict]:
    for k, b in enumerate(blocks):
        ws = words[b["from"]: b["to"] + 1]
        b["t0"] = 0.0 if k == 0 else round(ws[0]["s"] - 0.05, 3)
        b["words"] = [{"w": w["w"], "t0": w["s"], "t1": w["e"]} for w in ws]
        if not b.get("text"):
            b["text"] = " ".join(w["w"] for w in ws)
    for k, b in enumerate(blocks):
        b["t1"] = blocks[k + 1]["t0"] if k + 1 < len(blocks) else round(max(duration, b["words"][-1]["t1"] + 0.4), 3)
        b["t1"] = max(b["t1"], b["t0"] + 0.3)
    return blocks


def mock_plan(words: list[dict], duration: float) -> list[dict]:
    """من غير موديل: الكلام بيتقسم على الوقفات، والحركات بتتلف بالترتيب."""
    groups, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        gap = (words[i + 1]["s"] - w["e"]) if i + 1 < len(words) else 9
        if len(cur) >= 6 or gap > 0.35 or re.search(r"[.!?؟،,]$", w["w"]):
            groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)
    order = ["pop", "type", "build", "icon", "build", "scatter", "letters"]
    themes = ["accent", "light", "dark", "dark", "light", "light", "dark"]
    out = []
    for k, g in enumerate(groups):
        kind = order[k % len(order)]
        last = words[g[-1]]["w"]
        out.append({"from": g[0], "to": g[-1], "kind": kind, "theme": themes[k % len(themes)],
                    "text": last if kind in ("pop", "icon", "letters", "scatter") else "", "focus": len(g) - 1 if kind == "build" else -1,
                    "icon": "star" if kind == "icon" else "", "icons": ["heart", "star"] if kind == "letters" else [], "letter": 1, "side": ""})
    return timed(out, words, duration)


# ---------------------------------------------------------------- استخراج التايبوجرافي من فيديو (المعمل)

EXTRACT_FORMAT = """{
  "style": {"name": "اسم قصير للستايل بالعربي", "font_look": "English: the typeface look (geometric sans, serif, handwritten...) and weight",
            "case": "lower | upper | none", "grain": 0.1,
            "light": {"bg": "#hex", "ink": "#hex", "accent": "#hex"}, "dark": {"bg": "#hex", "ink": "#hex", "accent": "#hex"},
            "accent": {"bg": "#hex", "ink": "#hex", "accent": "#hex"},
            "icon_style": "English: how the icons/images look (pixel art, 3D, flat, photo cutouts...) so new ones can be drawn the same way",
            "rules": ["قاعدة بالعربي: إمتى بيستخدم كل حركة ولأي نوع كلام"]},
  "moments": [{"t0": 0.0, "t1": 1.2, "kind": "pop | type | build | icon | letters | scatter | ring | other", "theme": "light | dark | accent",
               "text": "الكلام المكتوب على الشاشة", "said": "الكلام المتقال وقتها", "how": "وصف الحركة بالعربي (إزاي الكلام اتحوّل لشكل)",
               "icons": [{"name": "english-short-name", "desc": "English: what it is and how it looks", "t": 1.0, "box": [0.1, 0.2, 0.3, 0.5]}]}]
}"""


def extract_messages(duration: float) -> list[dict]:
    kinds = "\n".join(f"- {k}: {v}" for k, v in KINDS.items())
    text = (
        "أنت مصمم موشن تايبوجرافي. اتفرج على الفيديو ده كله بالصوت، وطلّع كل اللحظات اللي الكلام المتقال فيها اتحوّل لحاجة على الشاشة: "
        "كلمات مكتوبة بحركة، أو حروف، أو أشكال، أو أيقونات، أو صور بتمثّل الكلام.\n"
        f"الفيديو مدته {duration:.2f} ثانية.\n"
        "صنّف كل لحظة بأقرب حركة من دول (ولو مفيش زيها اكتب other ووصفها في how):\n" + kinds + "\n\n"
        "- moments ورا بعض بالترتيب وبتوقيت مظبوط.\n"
        "- icons: كل أيقونة/صورة/رمز ظاهر في اللحظة دي، باسم قصير بالإنجليزي، ووقت تكون فيه واضحة لوحدها (t)، "
        "وbox = مكانها في الفريم [x0, y0, x1, y1] من 0 لـ 1 (مربع ضيق حواليها هي بس).\n"
        "- style: الألوان الحقيقية بالهكس للخلفية الفاتحة والغامقة والملونة، وشكل الخط، وrules = إمتى بيستخدم كل حركة.\n"
        "رجّع JSON بس بالشكل ده:\n" + EXTRACT_FORMAT
    )
    return [{"role": "user", "content": text}]


HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def _plain(v) -> str:
    return re.sub(r"^\s*English\s*:\s*", "", str(v or "")).strip()


def _theme(v: dict | None, base: dict) -> dict:
    v = v if isinstance(v, dict) else {}
    return {k: (v.get(k) if isinstance(v.get(k), str) and HEX.match(v.get(k)) else base[k]) for k in ("bg", "ink", "accent")}


def clean_extract(raw: dict, duration: float) -> dict:
    raw = raw or {}
    base = BUILTIN_STYLES["mono-red"]
    st = raw.get("style") if isinstance(raw.get("style"), dict) else {}
    moments = []
    for m in raw.get("moments") or []:
        if not isinstance(m, dict):
            continue
        try:
            t0, t1 = max(0.0, float(m.get("t0"))), min(duration, float(m.get("t1")))
        except (TypeError, ValueError):
            continue
        if t1 - t0 < 0.1:
            continue
        icons = []
        for ic in m.get("icons") or []:
            if not isinstance(ic, dict):
                continue
            box = ic.get("box")
            try:
                box = [min(1.0, max(0.0, float(x))) for x in box][:4] if isinstance(box, list) and len(box) == 4 else None
            except (TypeError, ValueError):
                box = None
            if box and (box[2] - box[0] < 0.02 or box[3] - box[1] < 0.02):
                box = None
            try:
                t = min(t1, max(t0, float(ic.get("t", (t0 + t1) / 2))))
            except (TypeError, ValueError):
                t = (t0 + t1) / 2
            name = re.sub(r"[^a-z0-9-]+", "-", str(ic.get("name") or "icon").lower()).strip("-")[:30] or "icon"
            icons.append({"name": name, "desc": str(ic.get("desc") or "")[:200], "t": round(t, 2), "box": box})
        moments.append({"t0": round(t0, 2), "t1": round(t1, 2), "kind": m.get("kind") if m.get("kind") in KINDS else "other",
                        "theme": m.get("theme") if m.get("theme") in THEMES else "light", "text": str(m.get("text") or "")[:200],
                        "said": str(m.get("said") or "")[:200], "how": str(m.get("how") or "")[:400], "icons": icons[:12]})
    counts: dict[str, int] = {}
    for m in moments:
        if m["kind"] in KINDS:
            counts[m["kind"]] = counts.get(m["kind"], 0) + 1
    style = {
        "name": str(st.get("name") or "ستايل من المعمل")[:60], "font": base["font"],
        "font_look": str(st.get("font_look") or "")[:200], "case": st.get("case") if st.get("case") in ("lower", "upper", "none") else "none",
        "grain": min(0.4, max(0.0, float(st.get("grain") or 0.1))) if isinstance(st.get("grain"), (int, float)) else 0.1, "weight": 700,
        "light": _theme(st.get("light"), base["light"]), "dark": _theme(st.get("dark"), base["dark"]), "accent": _theme(st.get("accent"), base["accent"]),
        "icon_style": _plain(st.get("icon_style"))[:300],
        "rules": [str(r)[:200] for r in (st.get("rules") or []) if str(r).strip()][:12], "kinds": counts or base["kinds"],
    }
    return {"style": style, "moments": moments}


def mock_extract(duration: float) -> dict:
    d = max(2.0, duration)
    return clean_extract({
        "style": {"name": "ستايل تجريبي", "case": "lower", "rules": ["كلمة مهمة = icon", "الختام scatter"]},
        "moments": [
            {"t0": 0, "t1": d * 0.2, "kind": "pop", "theme": "accent", "text": "how", "how": "كلمة كبيرة على أصفر"},
            {"t0": d * 0.2, "t1": d * 0.5, "kind": "type", "text": "how do you communicate", "how": "كتابة بمؤشر"},
            {"t0": d * 0.5, "t1": d * 0.8, "kind": "icon", "theme": "dark", "text": "action.", "how": "كاميرا جنب الكلمة",
             "icons": [{"name": "camera", "desc": "pixel art camera", "t": d * 0.6, "box": [0.3, 0.3, 0.6, 0.7]}]},
            {"t0": d * 0.8, "t1": d, "kind": "scatter", "text": "love", "how": "حروف بتتجمع"},
        ]}, duration)


def box_messages(name: str, desc: str, frames: list[str]) -> list[dict]:
    """الموديل بيشوف 3 فريمات حوالين وقت الأيقونة ويقول أوضح فريم ومكانها بالظبط (على الصور الثابتة أدق بكتير من الفيديو)."""
    parts: list[dict] = [{"type": "text", "text": (
        f"Find this single object: «{name}» — {desc}.\n"
        f"You get {len(frames)} frames (frame 0, 1, 2...). Pick the frame where the object is most fully visible, sharp and least covered, "
        "and give a tight box around that ONE object only (not neighbours, not text).\n"
        'Return JSON only: {"frame": 0, "box_2d": [ymin, xmin, ymax, xmax]} with coordinates 0-1000. '
        'If it is not visible in any frame return {"frame": -1}.')}]
    for i, f in enumerate(frames):
        parts += [{"type": "text", "text": f"frame {i}:"}, {"type": "image_url", "image_url": {"url": f}}]
    return [{"role": "user", "content": parts}]


def clean_box(raw: dict, n: int) -> tuple[int, list[float]] | None:
    try:
        k = int((raw or {}).get("frame", -1))
        y0, x0, y1, x1 = [min(1.0, max(0.0, float(v) / 1000)) for v in raw.get("box_2d")][:4]
    except (TypeError, ValueError, AttributeError):
        return None
    if not 0 <= k < n or x1 - x0 < 0.02 or y1 - y0 < 0.02:
        return None
    return k, [x0, y0, x1, y1]


# ---------------------------------------------------------------- الستيكرات: شيل الخلفية

def key_background(src: Path, out: Path, tol: int = 34, pad: int = 6) -> tuple[int, int]:
    """يشيل الخلفية السادة (أو قريبة من السادة) اللي لازقة في حواف الصورة، ويقص على الشكل. بيرجّع المقاس."""
    from PIL import Image, ImageFilter

    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    border = [px[x, y][:3] for x in range(0, w, max(1, w // 40)) for y in (0, h - 1)] + \
             [px[x, y][:3] for y in range(0, h, max(1, h // 40)) for x in (0, w - 1)]
    border.sort(key=lambda c: sum(c))
    bg = border[len(border) // 2]

    def near(c):
        return abs(c[0] - bg[0]) + abs(c[1] - bg[1]) + abs(c[2] - bg[2]) <= tol * 3

    seen = bytearray(w * h)
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    mask = Image.new("L", (w, h), 255)
    mp = mask.load()
    while stack:
        x, y = stack.pop()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        if not near(px[x, y]):
            continue
        mp[x, y] = 0
        if x > 0: stack.append((x - 1, y))
        if x < w - 1: stack.append((x + 1, y))
        if y > 0: stack.append((x, y - 1))
        if y < h - 1: stack.append((x, y + 1))
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    im.putalpha(mask)
    box = mask.point(lambda v: 255 if v > 20 else 0).getbbox()
    if box:
        box = (max(0, box[0] - pad), max(0, box[1] - pad), min(w, box[2] + pad), min(h, box[3] + pad))
        im = im.crop(box)
    im.save(out, "PNG")
    return im.size


def sticker_prompt(desc: str, icon_style: str) -> str:
    return (f"A single isolated icon/sticker: {desc}. Style: {icon_style or 'bold clean pixel-art icon, crisp outline, flat vivid colors'}. "
            "Centered, fully visible with generous margin, on a perfectly plain flat pure white #FFFFFF background, "
            "no shadow on the background, no text, no frame, no other objects.")


def json_or(text: str, default):
    try:
        return json.loads(text)
    except (TypeError, ValueError):
        return default
