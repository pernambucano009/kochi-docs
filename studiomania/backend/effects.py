"""✨ إفكتات الفيديو اللي بيتكلم فيه الشخص للكاميرا (قالب «تصوير بالجوال» والمونتاج).

الرسم نفسه من مكتبة مفتوحة المصدر (MIT) متنسخة في vendor/effects: بتلاقي الوش وبتفصل الشخص عن الخلفية،
وبترسم الإفكت قدّامه أو وراه. هنا: قايمة الإفكتات اللي اخترناها (١٥ من ٤٢)، وتعليمات العقل اللي بيختار
الإفكت المناسب لكل جملة ويكتب كلامه بلهجة العميل، وتنضيف اختياره، والتشغيل وقت التصدير.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

VENDOR = Path(__file__).resolve().parent / "vendor" / "effects"
FX_PY = VENDOR / "scripts" / "fx.py"
MIN_D, MAX_D, GAP = 1.5, 4.0, 2.5   # طول كل إفكت، وأقل مسافة بين إفكتين (الإفكت القصير بيبان أحسن)

# المفتاح: (الاسم، الوصف، الخانات اللي العقل بيكتبها: {اسم الخانة: معناها})
CATALOG_SRC: dict[str, tuple[str, str, tuple]] = {
    "locked-on": ("متثبّت عليك", "أقواس تمسك الوجه والكاميرا تتبعه، لجملة مهمة يقولها بقوة", (("text", "وسم قصير تحت الوجه (كلمة أو كلمتان)"),)),
    "lean-in": ("اقتراب سريع", "زووم سريع على كلمة واحدة يريد أن يؤكدها", ()),
    "slow-push": ("اقتراب سينمائي", "اقتراب بطيء من الوجه والخلفية تتغبش، للحظة عاطفية أو جادة", ()),
    "spotlight": ("بقعة ضوء", "الإضاءة تنطفئ ويبقى هو منيرًا، وكلمة مضيئة خلفه", (("text", "كلمة واحدة مضيئة خلفه"),)),
    "backdrop-word": ("كلمة خلفك", "كلمة ضخمة تنزل خلفه، لأهم كلمة في الجملة", (("text", "كلمة واحدة أو اثنتان"),)),
    "led-sign": ("لافتة مضيئة", "الإضاءة تخفت ولافتة LED تكتب نفسها خلفه", (("text", "سطر أو سطران قصيران، افصل السطور بـ |"),)),
    "headline-box": ("عنوان في مربع", "اقتراب مع عنوان من سطرين، الثاني داخل مربع أبيض", (("text", "سطران قصيران مفصولان بـ |"),)),
    "split-headline": ("عنوان من أعلى", "بطاقة عنوان تنزل من أعلى وتدفعه لأسفل الشاشة", (("text", "٢–٣ سطور قصيرة مفصولة بـ |"), ("hl", "كلمة من السطور تُلوَّن"), ("pill", "وسم صغير (اسم العلامة مثلًا)"))),
    "todo": ("قائمة مهام", "بطاقة مهام بجانب رأسه تُعلَّم واحدة واحدة وهو يتكلم، لما يعدّد أشياء", (("title", "عنوان القائمة"), ("text", "٢–٤ بنود قصيرة مفصولة بـ |"))),
    "checklist": ("خطوات تكتمل", "خطوات تحت ذقنه، كل خطوة تدور ثم تصبح خضراء، لما يشرح خطوات", (("title", "عنوان الخطوات"), ("text", "٢–٤ خطوات قصيرة مفصولة بـ |"))),
    "countdown-flip": ("عد تنازلي", "عدّاد ٣، ٢، ١ يتقلب فوق رأسه، قبل كشف أو مفاجأة", ()),
    "scribble": ("شخبطة", "رسومات قلم تظهر حوله، للحظة مرحة أو للإشارة إلى نفسه", (("text", "كلمة قصيرة بخط اليد"),)),
    "reject-stamp": ("ختم الرفض", "ختم أحمر كبير يُطبع على الشاشة، لما يرفض فكرة أو خطأ شائعًا", (("text", "كلمة الختم (مثل: خطأ، مرفوض)"),)),
    "cover-star": ("غلاف مجلة", "يصبح غلاف مجلة والعنوان خلف رأسه، للتقديم أو لقصة نجاح", (("text", "عنوان المجلة (كلمة)"), ("issue", "سطر العدد الصغير"), ("lines", "٣ سطور قصيرة مفصولة بـ |"))),
    "liquid-glass-graph": ("رسم بياني زجاجي", "بطاقة زجاجية تحت ذقنه فيها رسم يصعد ورقم يعدّ، فقط لما يذكر رقمًا حقيقيًا", (("text", "اسم الرقم"), ("from", "الرقم قبل (من الكلام نفسه)"), ("to", "الرقم بعد (من الكلام نفسه، مثل 59% أو 12K)"))),
}
# الخانات مكتوبة أزواج (مش dict) عشان أداة خريطة اللغة تعرف إنها تعليمات للموديل مش كلام بيظهر للعميل
CATALOG: dict[str, tuple[str, str, dict[str, str]]] = {k: (n, d, dict(f)) for k, (n, d, f) in CATALOG_SRC.items()}
NUMERIC = {"liquid-glass-graph"}   # لازم الرقم يكون اتقال فعلًا في الكلام


def available() -> bool:
    if not FX_PY.exists():
        return False
    try:
        import cv2  # noqa: F401, PLC0415
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import person  # noqa: PLC0415
        return person.available()
    except ImportError:
        return False


def catalog() -> list[dict]:
    return [{"key": k, "name": v[0], "desc": v[1], "fields": v[2]} for k, v in CATALOG.items()]


def plan_prompt(words: list[dict], brief: str, dialect: str, dur: float, busy: list[tuple[float, float]]) -> str:
    lines = " ".join(f"[{w['s']:.1f}]{w['w']}" for w in words)[:9000]
    menu = "\n".join(f"- {k}: {v[1]}. الخانات: " + (json.dumps(v[2], ensure_ascii=False) if v[2] else "لا شيء") for k, v in CATALOG.items())
    return (
        "أنت محرر ريلز محترف. أمامك كلام شخص يتكلم للكاميرا، وكل كلمة قبلها ثانيتها في الفيديو النهائي [ث].\n"
        f"طول الفيديو {dur:.1f} ثانية. موضوعه: {brief[:600] or '-'}\n"
        f"الكلام: {lines}\n\n"
        f"الإفكتات المتاحة:\n{menu}\n\n"
        "اختر من ٢ إلى ٥ إفكتات توضع على أقوى اللحظات فقط (الخطاف في أول ٣ ثوانٍ، والأرقام، والتعداد، والكشف، والدعوة في الآخر). "
        f"كل إفكت من {MIN_D} إلى {MAX_D} ثوانٍ، ويبدأ مع الكلمة التي تخصه، ولا يتداخل إفكتان، وبين كل إفكتين {GAP} ثانية على الأقل، "
        "ولا تكرر الإفكت نفسه. "
        + (f"لا تضع إفكتًا في هذه الأوقات (فيها لقطات أخرى فوق الشخص): {json.dumps([[round(a, 1), round(b, 1)] for a, b in busy])}. " if busy else "")
        + f"اكتب كل نص على الشاشة بـ{dialect or 'الفصحى'} البسيطة كما يتكلم الشخص، قصيرًا جدًا (٢–٤ كلمات للسطر)، ومن كلامه هو. "
        "ممنوع اختراع أرقام أو أسماء أو عروض غير موجودة في الكلام، وممنوع ذكر أسماء برامج أو شركات ذكاء اصطناعي. "
        "إفكتات الأرقام فقط إذا قال الرقم فعلًا.\n"
        'أعد JSON: {"effects": [{"fx": "اسم الإفكت", "start": ثانية, "end": ثانية, "why": "سبب قصير", ...الخانات}]}'
    )


def _num_in(v: str, text: str) -> bool:
    n = re.sub(r"[^\d.]", "", str(v or ""))
    return bool(n) and n.rstrip(".") in re.sub(r"[^\d.\s]", " ", text)


def clean_plan(raw, dur: float, busy: list[tuple[float, float]], words: list[dict]) -> list[dict]:
    items = raw.get("effects") if isinstance(raw, dict) else raw
    said = " ".join(str(w.get("w", "")) for w in words)
    # الأرقام بالعربي (٠-٩) بتتحوّل لإنجليزي عشان نقارن
    said = said.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789"))
    out: list[dict] = []
    for it in items if isinstance(items, list) else []:
        if not isinstance(it, dict) or it.get("fx") not in CATALOG:
            continue
        try:
            a, b = float(it.get("start")), float(it.get("end"))
        except (TypeError, ValueError):
            continue
        a = max(0.0, min(a, dur - MIN_D))
        b = max(a + MIN_D, min(b, a + MAX_D, dur))
        if b - a < MIN_D or any(a < y and b > x for x, y in busy):
            continue
        if any(a < o["end"] + GAP and b > o["start"] - GAP for o in out) or any(o["fx"] == it["fx"] for o in out):
            continue
        fields = CATALOG[it["fx"]][2]
        e = {"fx": it["fx"], "start": round(a, 2), "end": round(b, 2), "why": str(it.get("why") or "")[:160]}
        for k in fields:
            v = str(it.get(k) or "").strip()[:80]
            e[k] = v
        if it["fx"] in NUMERIC and not (_num_in(e.get("to"), said) and (not e.get("from") or _num_in(e["from"], said))):
            continue
        # الخانات اللي العقل سابها فاضية: الإفكت ده محتاج كلام، فمنحطوش بكلام المكتبة الافتراضي
        if any(not e[k] for k in fields if k not in ("pill", "hl", "issue", "from")):
            continue
        out.append(e)
        if len(out) >= 5:
            break
    return sorted(out, key=lambda o: o["start"])


def mock_plan(words: list[dict], dur: float) -> list[dict]:
    """وضع التجربة: إفكتان ثابتان من غير ذكاء اصطناعي."""
    first = next((w["w"] for w in words if len(str(w.get("w", ""))) > 3), "مهم")
    out = [{"fx": "backdrop-word", "start": 0.3, "end": min(2.6, dur), "text": first, "why": "تجربة"}]
    if dur > 8:
        out.append({"fx": "checklist", "start": round(dur * 0.5, 2), "end": round(min(dur, dur * 0.5 + 3), 2), "title": "الخطوات",
                    "text": "اكتب الفكرة|صوّرها|انشرها", "why": "تجربة"})
    return out


def _fill(e: dict) -> dict:
    """الخانات اللي مالهاش قيمة: نحط حاجة محايدة بدل كلام المكتبة الافتراضي (اللي فيه أسماء ومصري)."""
    e = dict(e)
    e.pop("why", None)
    if e["fx"] == "split-headline":
        e.setdefault("hl", (e.get("text") or "").split("|")[0].split(" ")[0])
        e["pill"] = e.get("pill") or " "
    if e["fx"] == "cover-star":
        e["issue"] = e.get("issue") or " "
        e["lines"] = e.get("lines") or " "
    if e["fx"] == "locked-on":
        e["text"] = e.get("text") or " "
    if e["fx"] == "liquid-glass-graph":
        e["from"] = e.get("from") or "0"
    return {k: v for k, v in e.items() if v not in (None, "")}


def render(ffmpeg: str, src: Path, dst: Path, plan: list[dict], models_dir: Path, timeout: int = 3600, log=None) -> None:
    """يرسم الإفكتات على الفيديو (src بنفس توقيت الخطة) في dst. الصوت (لو موجود) بيفضل زي ما هو."""
    if not plan:
        return
    pf = dst.with_suffix(".fx.json")
    pf.write_text(json.dumps({"effects": [_fill(e) for e in plan]}, ensure_ascii=False), encoding="utf-8")
    env = {**os.environ, "FX_FFMPEG": ffmpeg, "PERSON_MODELS": str(models_dir), "FX_BACKEND": str(Path(__file__).resolve().parent)}
    try:
        r = subprocess.run([sys.executable, str(FX_PY), "--plan", str(pf), str(src), str(dst)], capture_output=True, text=True, timeout=timeout, env=env)
        if log:
            log((r.stdout or "")[-600:])
        if r.returncode != 0 or not dst.exists() or dst.stat().st_size < 1000:
            raise RuntimeError(f"رسم الإفكتات فشل: {(r.stderr or r.stdout or '').strip()[-400:]}")
    finally:
        pf.unlink(missing_ok=True)
