"""🧪 فحص الجودة الأسبوعي (طلب صاحب المشروع ١٨ نوفمبر): كل أسبوع البرنامج بيجرّب أدواته الحقيقية بعينات ثابتة،
وكلود بيقيّم النص والصور، وجيميناي بيقيّم الصوت، وصاحب المشروع بيشوف العينات في الأدمن ويحكم بنفسه.
الفاشل بيروح صندوق المشاكل. العينات ثابتة عشان أي تغيير في أداة (موديل اتغير، صوت اتغير) يبان من أسبوع للتاني.

التخزين: <PLATFORM>/qa/<run>/run.json + ملفات العينات. الإعدادات: <PLATFORM>/qa/settings.json."""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

DEFAULTS = {
    "on": True,
    "every_days": 7,
    "review_model": "anthropic/claude-sonnet-5",      # بيقيّم النص والصور
    "audio_model": "google/gemini-2.5-pro",           # بيسمع الصوت
    "director_model": "anthropic/claude-opus-4.8",    # 🎬 مخرج الأوتوبايلوت: بيقرر الوصفة
    "director_review_model": "anthropic/claude-sonnet-5",   # بيشوف الفيديو النهائي قبل ما يوصل للعميل
    "director_on": False,
}
MODELS = ["anthropic/claude-fable-5", "anthropic/claude-opus-4.8", "anthropic/claude-sonnet-5",
          "google/gemini-2.5-pro", "google/gemini-2.5-flash"]
KEEP_RUNS = 12

# جملة ثابتة لكل لهجة، فيها كلام لست (كاف المخاطَبة) وأرقام وكلمة إنجليزي: أكتر الحاجات اللي بتبوظ في النطق
SAY = {
    "ar-sa-najdi": "هلا والله! تمارينك اليوم خفيفة، وبعدها اشربي مويتك وارتاحي. لا تنسين الحجز قبل الساعة ثمان.",
    "ar-sa-hijazi": "يا هلا! جلستك جاهزة اليوم، تعالي بدري شوية عشان نبدأ على طول. الخصم ٢٠٪ لين آخر الأسبوع.",
    "ar-gulf": "مرحبا! طلبج جاهز، تقدرين تمرين علينا اليوم من الساعة أربع. العرض لين نهاية الأسبوع.",
    "ar-ae": "مرحبا الساع! طلبج وصل وبنرسله لج باجر الصبح. لا تنسين تشوفين العرض الجديد.",
    "ar-kw": "هلا والله! شلونج اليوم؟ موعدج باجر الساعة خمس، ولا تنسين تجيبين البطاقة.",
    "ar-qa": "هلا! شحالج؟ الطلب جاهز وتقدرين تستلمينه اليوم، والتوصيل علينا.",
    "ar-bh": "هلا! شلونج؟ حجزج تأكد، ونشوفج يوم الخميس الساعة ست.",
    "ar-om": "هلا وغلا! كيف حالش؟ طلبش جاهز، ونوصله لش بكرة الصبح.",
    "ar-eg-cairo": "أهلًا! أوردرك جاهز ومستنيكي، عدّي علينا النهارده قبل الساعة تمانية. الخصم ٢٠٪ لآخر الأسبوع.",
    "ar-levant": "أهلين! طلبيتك جاهزة، فيكي تمرقي اليوم قبل الساعة تمانة. العرض لآخر الجمعة.",
    "ar-iq": "هلا بيج! طلبج حاضر، تكدرين تجين اليوم قبل الساعة ثمانية.",
    "ar-sd": "أهلًا بيك! طلبك جاهز، ممكن تجي الليلة قبل الساعة تمانية.",
    "ar-ma": "مرحبا بيك! الطلبية ديالك واجدة، تقدري تدوزي اليوم قبل الثمانية.",
    "ar-dz": "مرحبا بيك! الطلبية تاعك واجدة، تقدري تجي اليوم قبل الثمانية.",
    "ar-tn": "عسلامة! الطلبية متاعك حاضرة، تنجم تتعدى اليوم قبل الثمانية.",
    "ar-msa": "مرحبًا بكِ! طلبكِ جاهز، ويمكنكِ استلامه اليوم قبل الساعة الثامنة. الخصم عشرون بالمئة حتى نهاية الأسبوع.",
    "en": "Hi there! Your order is ready, and you can pick it up today before eight. The twenty percent discount ends this weekend.",
}
# المجال ← اللهجة اللي بنكتب بيها أفكاره (أكتر عملاء المجال)
IDEA_DIALECT = {"food": "ar-sa-najdi", "dental": "ar-sa-najdi", "beauty": "ar-sa-hijazi", "ecom": "ar-gulf", "realestate": "ar-ae",
                "edu": "ar-eg-cairo", "fitness": "ar-sa-najdi", "home": "ar-kw", "shops": "ar-eg-cairo"}
ELEMENTS = {"fitness": ["a pair of blue running shoes", "a glass of water with lemon slices", "a kettlebell next to a folded towel",
                        "a hand holding a jump rope", "a plate of grilled chicken with rice and salad"]}
STOCK = ["hands tying the laces of running shoes on a gym floor", "a woman seen from behind stretching on a yoga mat at home",
         "hands slicing fresh vegetables on a wooden board", "a cup of coffee on a cafe table by the window",
         "dumbbells on a rack in an empty gym", "hands arranging pastries on a bakery tray"]


def week_pick(lst: list, salt: int = 0):
    """عينة بتتغير كل أسبوع (بس ثابتة جوه نفس الأسبوع)."""
    return lst[(int(time.time() // (7 * 86400)) + salt) % len(lst)]


def root(platform: Path) -> Path:
    return platform / "qa"


def settings(platform: Path) -> dict:
    try:
        d = json.loads((root(platform) / "settings.json").read_text("utf-8"))
    except (OSError, ValueError):
        d = {}
    return {**DEFAULTS, **{k: v for k, v in d.items() if k in DEFAULTS}}


def settings_set(platform: Path, patch: dict) -> dict:
    d = settings(platform)
    for k, v in patch.items():
        if k not in DEFAULTS or v is None:
            continue
        if k.endswith("_model") and (not isinstance(v, str) or not re.fullmatch(r"[a-z0-9._-]+/[a-z0-9._-]+", v)):
            continue
        d[k] = type(DEFAULTS[k])(v)
    d["every_days"] = max(1, min(60, int(d["every_days"])))
    _write(root(platform) / "settings.json", d)
    return d


def _write(f: Path, data) -> None:
    f.parent.mkdir(parents=True, exist_ok=True)
    tmp = f.with_name(f".{f.name}.{time.time_ns()}.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), "utf-8")
    tmp.replace(f)


def run_dir(platform: Path, rid: str) -> Path:
    return root(platform) / re.sub(r"[^a-z0-9_-]", "", rid)


def run_get(platform: Path, rid: str) -> dict | None:
    try:
        return json.loads((run_dir(platform, rid) / "run.json").read_text("utf-8"))
    except (OSError, ValueError):
        return None


def run_put(platform: Path, run: dict) -> None:
    _write(run_dir(platform, run["id"]) / "run.json", run)


def runs(platform: Path) -> list[dict]:
    out = []
    for f in root(platform).glob("*/run.json"):
        try:
            out.append(json.loads(f.read_text("utf-8")))
        except (OSError, ValueError):
            continue
    return sorted(out, key=lambda r: r.get("at", 0), reverse=True)


def prune(platform: Path) -> None:
    import shutil
    for r in runs(platform)[KEEP_RUNS:]:
        shutil.rmtree(run_dir(platform, r["id"]), ignore_errors=True)


def last_at(platform: Path) -> float:
    rs = runs(platform)
    return float(rs[0].get("at") or 0) if rs else 0.0


def judge_json(raw: str) -> dict:
    m = re.search(r"\{.*\}", raw or "", re.S)
    try:
        v = json.loads(m.group(0)) if m else {}
    except ValueError:
        v = {}
    return {"ok": bool(v.get("ok", True)), "score": v.get("score"), "notes": str(v.get("notes") or v.get("problem") or "")[:600]}


def words_match(said: str, heard: str) -> float:
    """نسبة كلمات الجملة اللي اتسمعت (من غير تشكيل وهمزات)."""
    def norm(s):
        s = re.sub(r"[ً-ْـ]", "", s)
        s = re.sub("[أإآ]", "ا", s).replace("ة", "ه").replace("ى", "ي")
        return [w for w in re.findall(r"\w+", s.lower()) if len(w) > 1]
    a, b = norm(said), set(norm(heard))
    return round(sum(1 for w in a if w in b) / max(1, len(a)), 2)


AUDIO_JUDGE = (
    "You are a native Arabic dialect coach. Listen to this text-to-speech clip. The text it should say, in the {dialect} dialect, is:\n"
    "«{text}»\nCheck: (1) does it sound like natural {dialect} (not another dialect, not robotic)? "
    "(2) mispronounced words, wrong vowels, or skipped words? (3) for Najdi or Hijazi: the second-person feminine suffix ك must sound "
    "like k (as in تمارينك = tamarinik), never sh (كشكشة) and never \"ki\". "
    'Answer JSON only: {{"ok": true|false, "score": 1-10, "notes": "short Arabic notes for the owner, empty if perfect"}}'
)
IDEAS_JUDGE = (
    "You review short-video ideas a content tool wrote for a business in the field «{field}». They must be in the {dialect} dialect "
    "(spoken, not formal Arabic), specific to this field, practical to film, with a strong first spoken line (hook) and no false claims. "
    "Ideas:\n{ideas}\n"
    'Answer JSON only: {{"ok": true|false, "score": 1-10, "notes": "short Arabic notes for the owner: dialect slips, weak hooks, generic ideas"}}'
)
IMAGE_JUDGE = (
    "You review an output of a video tool. {what}\n"
    'Answer JSON only: {{"ok": true|false, "score": 1-10, "notes": "short Arabic notes for the owner, empty if perfect"}}'
)
