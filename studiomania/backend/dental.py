"""🦷 قوالب الأسنان (نسخة تجريبية): الطبيب يرفع صور حالة حقيقية (قبل/بعد) ← المحرك يصنّفها ويحللها ← يعمل العناصر
← الطبيب يوافق على الصور المشتقة ← يختار قالب ← فيديو.

المحرك نفسه في studiomania/dental/engine (نسخة من أداة الأسنان، كود وأصول عامة بس — مفيش أي صورة مريض في الريبو).
كل خطوة تقيلة بتشتغل في عملية منفصلة (subprocess) واحدة ورا التانية في طابور (الريندر بياخد دقايق ومحتاج ذاكرة).

القواعد اللي المحرك ماشي عليها: محتوى الطبيب الحقيقي هو الأساس، والذكاء الاصطناعي عمره ما يغيّر السنان ولا يجمّل «قبل».
"""
import json
import os
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path

ENGINE = Path(__file__).resolve().parent.parent / "dental" / "engine"

# القوالب اللي في النسخة التجريبية: اتراجعت كلها في المعرض، ومحتاجة صور + عناصر صور بس (مفيش فيديو متولد)
TEMPLATES = [
    {"id": "a03", "name": "تصميم الابتسامة", "dur": 25.9,
     "desc": "أشكال الابتسامة المقترحة بجانب أسنان المريض، ثم تستقر العدسات على أسنانه، مع قرص الساعة والمسطرة الذهبية، وفي النهاية قبل وبعد."},
    {"id": "a05", "name": "قبل وبعد بالتحوّل", "dur": 8.5,
     "desc": "يتحوّل وجه المريض من قبل العلاج إلى بعده سنًّا سنًّا، مع حدود الأسنان والنِّسب."},
    {"id": "a09", "name": "تحليل الابتسامة", "dur": 25.2,
     "desc": "تحليل الابتسامة بالخطوط والنسب على أسنان المريض، ثم النتيجة."},
    {"id": "a16", "name": "المسح الرقمي", "dur": 25.4,
     "desc": "مسح الأسنان بالضوء، ويخرج الفك من الكادر، ثم قبل وبعد على الصورة القريبة والوجه."},
    {"id": "a17", "name": "إضافة أم تشذيب؟", "dur": 27.7,
     "desc": "مقارنة الأسنان قبل وبعد مع شرح نوع العلاج على الأسنان نفسها."},
    {"id": "a12", "name": "تركيب العدسات على الوجه", "dur": 27.0, "needs": ["after_live"],
     "desc": "تطير العدسات وتستقر كل واحدة على سنّها في وجه المريض، ثم فيديو المريض الحقيقي بعد العلاج، ووجوهه من الزوايا."},
    {"id": "a24", "name": "الزراعة والتركيبات", "dur": 28.6,
     "desc": "خطوط الوجه، ودخول الزرعات أماكنها، ومخطط نسب عرض الأسنان، وفي النهاية ابتسامة ما بعد العلاج."},
]
TPL_IDS = [t["id"] for t in TEMPLATES]


def _tpl_ok(case: Path, t: dict) -> bool:
    """القالب متاح للحالة دي؟ (القوالب اللي محتاجة فيديو حي بتتفتح بس لو الطبيب رفع فيديو حقيقي)"""
    return all((case / "elements" / "v" / f"{v}.mp4").exists() for v in t.get("needs", []))

# الصور: ٤ أنواع × قبل/بعد (نفس خانات المحرك). المطلوب فعلًا ٤ مجموعات، وكل مجموعة ليها بديل بنقصّه من صورة تانية حقيقية
# (عمرنا ما بنولّد سنان: القص بينقل بكسلات حقيقية بس)
SHOTS = [
    {"slot": "before_retracted", "kind": "ret", "phase": "before", "name": "الأسنان قبل العلاج بالمبعد", "hint": "صورة قريبة من الأمام والمبعد في الفم.", "req": True},
    {"slot": "after_retracted", "kind": "ret", "phase": "after", "name": "الأسنان بعد العلاج بالمبعد", "hint": "الزاوية نفسها بعد العلاج.", "req": True},
    {"slot": "before_smile", "kind": "smile", "phase": "before", "name": "الابتسامة قبل العلاج", "hint": "ابتسامة قريبة قبل العلاج دون مبعد (الشفتان والأسنان).", "req": False},
    {"slot": "after_smile", "kind": "smile", "phase": "after", "name": "الابتسامة بعد العلاج", "hint": "ابتسامة قريبة بعد العلاج دون مبعد (الشفتان والأسنان).", "req": True},
    {"slot": "before_face", "kind": "face", "phase": "before", "name": "وجه المريض قبل العلاج", "hint": "المريض يبتسم دون مبعد، من الأمام.", "req": True},
    {"slot": "after_face", "kind": "face", "phase": "after", "name": "وجه المريض بعد العلاج", "hint": "المريض يبتسم دون مبعد، من الأمام.", "req": False},
    {"slot": "before_face_retracted", "kind": "faceret", "phase": "before", "name": "وجه المريض قبل العلاج بالمبعد", "hint": "الوجه كاملًا والمبعد في الفم.", "req": False},
    {"slot": "after_face_retracted", "kind": "faceret", "phase": "after", "name": "وجه المريض بعد العلاج بالمبعد", "hint": "الوجه كاملًا والمبعد في الفم.", "req": False},
]
# الخانة المطلوبة ← الصورة اللي نقدر نقصّها منها لو ناقصة (ونوع القص)
DERIVE = {"before_retracted": ("before_face_retracted", "teeth"), "after_retracted": ("after_face_retracted", "teeth"),
          "after_smile": ("after_face", "lips"), "before_smile": ("before_face", "lips")}
ALT_TEXT = {"before_retracted": {"text": "أو نقصّها تلقائيًا من «وجه المريض قبل العلاج بالمبعد»"},
            "after_retracted": {"text": "أو نقصّها تلقائيًا من «وجه المريض بعد العلاج بالمبعد»"},
            "after_smile": {"text": "أو نقصّها تلقائيًا من «وجه المريض بعد العلاج»"},
            "before_smile": {"text": "أو نقصّها تلقائيًا من «وجه المريض قبل العلاج»"}}
for _s in SHOTS:
    _s["alt"] = ALT_TEXT.get(_s["slot"])

# كل خانات المحرك (بما فيها الإضافية اللي بيحط فيها الصور الزيادة) بأسماء للطبيب
SLOT_NAMES = {"after_retracted_close": {"name": "الأسنان بعد العلاج بالمبعد عن قرب"},
              "after_retracted_side1": {"name": "الأسنان بعد العلاج من الجانب الأيمن"}, "after_retracted_side2": {"name": "الأسنان بعد العلاج من الجانب الأيسر"},
              "after_smile_side_r": {"name": "الابتسامة بعد العلاج من الجانب الأيمن"}, "after_smile_side_l": {"name": "الابتسامة بعد العلاج من الجانب الأيسر"},
              "prep": {"name": "الأسنان المحضّرة"}, "veneers": {"name": "العدسات خارج الفم"}, "cast": {"name": "التركيبات على النموذج"}, "doctor": {"name": "صورة الطبيب"}}

# العناصر المشتقة اللي الطبيب لازم يشوفها ويوافق عليها بنفسه (فيها وش المريض)، والباقي داخلي بيتعتمد لو عدّى الفلتر
DOCTOR_REVIEW = {
    "after_portrait_v3.png": {"why": "وجه المريض بعد العلاج: الابتسامة الحقيقية من صورة ما بعد العلاج على وجهه. تأكّد أن الأسنان هي أسنانه نفسها."},
    "before_face_hi.png": {"why": "وجه المريض قبل العلاج بدقة أعلى. تأكّد أن الأسنان مطابقة للأصل تمامًا (دون تبييض أو تعديل)."},
}


# العناصر الداخلية (مش بيشوفها الطبيب لو نجحت): لو فشلت لازم يعرف، لأن العناصر اللي بعدها بتستناها
INTERNAL = {"ms/smile_masks": {"label": "تحديد الشفتين في صورة الابتسامة"}, "ap_teeth": {"label": "حدود كل سنّ على الوجه"},
            "gum_back_after.png": {"label": "خلفية اللثة"}}


def _engine_consts():
    """حالات العناصر من المحرك نفسه (نفس الكلمات اللي بيكتبها في case.json)."""
    import importlib.util
    sp = importlib.util.spec_from_file_location("dental_case", ENGINE / "product" / "case.py")
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
    return m


_EC = _engine_consts()
QA_PASS, QA_FAIL, APPROVED, REJECTED, MISSING = _EC.QA_PASS, _EC.QA_FAIL, _EC.APPROVED, _EC.REJECTED, _EC.MISSING
# الحالة للواجهة: كود + عنوان بالفصحى
STATE = {APPROVED: "approved", REJECTED: "rejected", QA_PASS: "pending", QA_FAIL: "failed"}
STATE_LABEL = {"approved": {"label": "تمت الموافقة"}, "rejected": {"label": "مرفوضة"}, "pending": {"label": "بانتظار موافقتك"},
               "failed": {"label": "لم تجتز الفحص، أعد صنعها"}, "making": {"label": "قيد التجهيز"}}

_Q: "queue.Queue" = queue.Queue()
_LOCK = threading.Lock()
_WORKER = {"t": None}


def enabled() -> bool:
    return os.environ.get("DENTAL_PILOT", "1") != "0" and (ENGINE / "tpl" / "T.py").exists()


def root(data_dir: Path) -> Path:
    d = Path(data_dir) / "dental" / "cases"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _cid_ok(cid: str) -> bool:
    return bool(re.fullmatch(r"[a-z0-9]{8,24}", cid or ""))


def case_dir(data_dir: Path, cid: str) -> Path | None:
    if not _cid_ok(cid):
        return None
    d = root(data_dir) / cid
    return d if d.is_dir() else None


def _env(case: Path) -> dict:
    e = dict(os.environ)
    e["DENTAL_ROOT"] = str(ENGINE)
    e["CASE_DIR"] = str(case)
    e["PYTHONUNBUFFERED"] = "1"
    return e


def _meta(case: Path) -> dict:
    p = case / "pilot.json"
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_meta(case: Path, m: dict) -> None:
    tmp = case / "pilot.json.tmp"
    tmp.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, case / "pilot.json")


def _set_job(case: Path, **kw) -> None:
    with _LOCK:
        m = _meta(case)
        j = m.setdefault("job", {})
        j.update(kw)
        j["updated"] = time.time()
        _save_meta(case, m)


def _engine_json(case: Path) -> dict:
    try:
        return json.loads((case / "case.json").read_text(encoding="utf-8"))
    except Exception:
        return {}


def _run(case: Path, args: list[str], log_name: str, timeout: int, cwd: str = "product") -> subprocess.CompletedProcess:
    log = case / "logs" / log_name
    log.parent.mkdir(exist_ok=True)
    with open(log, "w", encoding="utf-8") as f:
        return subprocess.run([sys.executable, *args], cwd=str(ENGINE / cwd), env=_env(case), stdout=f,
                              stderr=subprocess.STDOUT, timeout=timeout)


def _tail(case: Path, log_name: str, n: int = 6) -> str:
    try:
        lines = (case / "logs" / log_name).read_text(encoding="utf-8", errors="ignore").splitlines()
        noise = ("mediapipe", "Exception ignored", "object is not callable", "Traceback", 'File "/usr', "TensorFlow Lite", "InitGoogle")
        lines = [l for l in lines if l.strip() and not l.startswith(("W0", "I0", "INFO:", "WARNING:")) and not any(x in l for x in noise)]
        return "\n".join(lines[-n:])[-600:]
    except Exception:
        return ""


# ---------------------------------------------------------------- الطابور
def _worker() -> None:
    while True:
        fn, case, stage = _Q.get()
        try:
            _set_job(case, stage=stage, status="running", started=time.time(), error="", missing=[])
            res = fn(case) or {}
            _set_job(case, status=res.get("status", "done"), missing=res.get("missing", []))
        except Exception as e:  # الخطوة فشلت: الطبيب يشوف السبب ويقدر يعيد
            _set_job(case, status="failed", error=str(e)[:400])
        finally:
            _Q.task_done()


def _enqueue(case: Path, stage: str, fn) -> None:
    with _LOCK:
        if not _WORKER["t"] or not _WORKER["t"].is_alive():
            _WORKER["t"] = threading.Thread(target=_worker, daemon=True, name="dental-worker")
            _WORKER["t"].start()
    _set_job(case, stage=stage, status="queued", queued=time.time(), error="")
    _Q.put((fn, case, stage))


def busy(case: Path) -> bool:
    return _meta(case).get("job", {}).get("status") in ("queued", "running")


# ---------------------------------------------------------------- الخطوات
def _intake(case: Path) -> None:
    """تصنيف الصور (قبل/بعد، بمبعد/وش/ابتسامة) وتعديل اتجاهها، وتحليل السنان (قناع + رقم كل سنة)."""
    tmp = case / "_up"
    r = _run(case, ["run.py", "new", str(tmp), str(case)], "intake.log", 1800)
    if r.returncode != 0:
        raise RuntimeError("تعذّر تصنيف الصور وتحليلها. " + _tail(case, "intake.log", 1))
    return _continue(case)


def _missing(case: Path, derivable: bool = False) -> list[str]:
    """الخانات المطلوبة الناقصة. derivable=False: اللي مالهاش بديل كمان (لازم الطبيب يرفعها)."""
    have = _engine_json(case).get("slots", {})
    return [s["slot"] for s in SHOTS if s["req"] and s["slot"] not in have
            and (derivable or not (DERIVE.get(s["slot"]) and DERIVE[s["slot"]][0] in have))]


def _continue(case: Path):
    """لو كل الصور المطلوبة موجودة نكمّل للعناصر، وإلا نستنى الطبيب يحدد الصورة الناقصة بنفسه."""
    cj = _engine_json(case)
    have, it = cj.get("slots", {}), cj.get("intake", {})
    used = {x.get("file") for x in have.values()}
    for s in SHOTS:   # خانة فاضية وفيه صورة متبقية نوعها بالظبط ده وعدّت الفحص: تتحط فيها (قبل ما نقص من صورة تانية)
        if s["slot"] in have:
            continue
        cands = [f for f, v in it.get("views", {}).items() if f not in used and v.get("view") == FIT_VIEWS[s["kind"]][0]
                 and not _precheck(cj, s["slot"], f) and (case / "input" / f).is_file()]
        if cands:
            f = max(cands, key=lambda f: it["views"][f].get("quality") or 0)
            _set_job(case, stage="assign")
            _assign_job(s["slot"], f, then=False)(case)
            cj = _engine_json(case)
            have, it = cj.get("slots", {}), cj.get("intake", {})
            used = {x.get("file") for x in have.values()}
    for slot, (srcslot, mode) in DERIVE.items():   # الخانة ناقصة وصورتها البديلة موجودة: نقصّها منها (الأسنان من الوجه بالمبعد، الابتسامة من الوجه)
        src = have.get(srcslot, {}).get("file")
        if slot not in have and src:
            _set_job(case, stage="assign")
            _assign_job(slot, src, then=False, mode=mode)(case)
            have = _engine_json(case).get("slots", {})
    miss = _missing(case, derivable=True)
    if miss:
        return {"status": "needs", "missing": miss}
    _elements(case)


SLOT_TAG = {"before_retracted": "before", "after_retracted": "after", "after_smile": "smile"}
# النوع اللي المحرك اتعرف عليه في كل صورة، بالفصحى للطبيب
VIEW_LABEL = {"face_smile": {"label": "وجه مبتسم دون مبعد"}, "face_retracted": {"label": "وجه بالمبعد"},
              "retracted_front": {"label": "أسنان بالمبعد من الأمام"}, "retracted_lateral": {"label": "أسنان بالمبعد من الجانب"},
              "smile_front": {"label": "ابتسامة قريبة من الأمام"}, "smile_lateral": {"label": "ابتسامة قريبة من الجانب"},
              "prep": {"label": "أسنان محضّرة"}, "veneers": {"label": "عدسات خارج الفم"}, "cast": {"label": "تركيبات على نموذج"},
              "doctor": {"label": "صورة الطبيب"}, "other": {"label": "ليست صورة أسنان أو وجه"}}
PHASE_LABEL = {"before": {"label": "قبل العلاج"}, "after": {"label": "بعد العلاج"}, "during": {"label": "أثناء العلاج"}}
# الأنواع اللي تنفع لكل نوع خانة (الوجه ينفع للخانة القريبة لأننا بنقص منه)
FIT_VIEWS = {"ret": ("retracted_front", "face_retracted"), "smile": ("smile_front", "face_smile"), "face": ("face_smile",), "faceret": ("face_retracted",)}
# ليه الصورة اترفضت (أو ليه مااتستخدمتش): البرنامج مابيقبلش صورة هتبوّظ النتيجة
REASON = {"kind": {"text": "نوع الصورة لا يناسب هذه الخانة (مثلًا صورة من الجانب والخانة تحتاج صورة من الأمام)."},
          "phase": {"text": "هذه الصورة من مرحلة أخرى حسب المقارنة بين صور الحالة (قبل العلاج أو بعده)."},
          "blur": {"text": "الصورة غير واضحة بما يكفي، وستُضعف النتيجة."},
          "angle": {"text": "الوجه ليس من الأمام، والقالب يحتاج صورة أمامية."},
          "verify": {"text": "أعدنا فحص الصورة: لا تناسب هذه الخانة (النوع أو الزاوية أو الوضوح)."},
          "taken": {"text": "الخانة المناسبة لها أخذت صورة أوضح منها."},
          "nofit": {"text": "لا توجد خانة لهذا النوع من الصور في القوالب الحالية، لكنها محفوظة في ملف المريض."},
          "other": {"text": "لم نتعرّف عليها على أنها صورة أسنان أو وجه."}}
KIND_OF = {s["slot"]: s["kind"] for s in SHOTS}


def _precheck(cj: dict, slot: str, photo: str) -> str:
    """فحص سريع من نتيجة التصنيف (من غير موديل): النوع + المرحلة + الوضوح. "" = تنفع (أو مش معروفة لسه)."""
    it = cj.get("intake", {})
    v = it.get("views", {}).get(photo)
    if not v:
        return ""
    if v.get("view") not in FIT_VIEWS[KIND_OF[slot]]:
        return "kind"
    ph = it.get("phase_of", {}).get(photo)
    if ph in ("before", "after") and ph != slot.split("_")[0]:
        return "phase"
    if (v.get("quality") or 10) < 4:
        return "blur"
    return ""
CANON = {k: v[0] for k, v in _EC.SLOTS.items()}
_ASSIGN = """
import os, sys, json, concurrent.futures as cf
from case import Case
from intake import view_of, upright
c = Case(sys.argv[1]); pairs = []
for a in sys.argv[2:]:   # slot=file[:mode][:verify] (mode = teeth/lips: قص من صورة الوجه، verify = الطبيب طلب فحص الصورة من جديد)
    s_, rest = a.split("=", 1); p_ = rest.split(":") + ["", ""]; pairs.append((s_, p_[0], p_[1], p_[2] == "verify"))
views = c.m.setdefault("intake", {}).setdefault("views", {})
phase_of = c.m["intake"].get("phase_of", {}); rejected = c.m["intake"].setdefault("rejected", {})
need = sorted({f for _, f, _, _ in pairs if f not in views})
with cf.ThreadPoolExecutor(max(1, len(need))) as ex:   # اتجاه كل صورة ونوعها (موديل) — كل الصور في نفس الوقت
    for f, v in zip(need, ex.map(lambda f: view_of(c.d + "/input/" + f), need)): views[f] = v
_DET = {}
def crop_mouth(im, k):
    # وجه كامل بالمبعد ← صورة قريبة للأسنان: قص حوالين البق بنقط الوش (نفس نسبة صورة الماكرو 3:2)
    import numpy as np, mediapipe as mp
    from mediapipe.tasks.python import vision, BaseOptions
    S_ = os.environ.get("DENTAL_ROOT") or os.path.dirname(os.getcwd())
    if "d" not in _DET: _DET["d"] = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=S_ + "/face/face_landmarker.task"), num_faces=1))
    a = np.ascontiguousarray(np.array(im)); r = _DET["d"].detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=a))
    if not r.face_landmarks: raise SystemExit("لم نجد الوجه في الصورة لقص الأسنان منها")
    lm = r.face_landmarks[0]; W, H = im.size
    if k is None: return lm
    xs = [lm[i].x * W for i in (61, 291, 78, 308)]; ys = [lm[i].y * H for i in (0, 17, 13, 14)]
    cx, cy = sum(xs) / 4, sum(ys) / 4; w = (max(xs) - min(xs)) * k; h = w * 2 / 3
    x0, y0 = max(0, cx - w / 2), max(0, cy - h / 2); return im.crop((int(x0), int(y0), int(min(W, x0 + w)), int(min(H, y0 + h))))
# الصورة المناسبة لكل نوع خانة (والصورة اللي ينفع نقص منها)
OK = {"ret": ("retracted_front", "face_retracted"), "smile": ("smile_front", "face_smile"), "face": ("face_smile",), "faceret": ("face_retracted",)}
KIND = {"ret": "an intraoral photo WITH a lip retractor taken from the FRONT (the midline between the upper central incisors near the middle, both sides of the arch equally visible), or a full face wearing a retractor looking straight at the camera",
        "smile": "a close-up smile WITHOUT a retractor taken from the FRONT (symmetric, the midline near the middle), or a full face smiling looking straight at the camera",
        "face": "a full face (or head and shoulders) smiling WITHOUT a retractor, looking straight at the camera (not turned to the side)",
        "faceret": "a full face wearing a lip retractor, looking straight at the camera (not turned to the side)"}
def kind_of(slot): return "faceret" if slot.endswith("face_retracted") else "face" if slot.endswith("_face") else "ret" if slot.endswith("_retracted") else "smile"
def yaw_ok(im):
    # الوش لازم يكون من الأمام: المناخير في نص المسافة بين جنبين الوش (لو مالقيناش وش: صورة قريبة، مانحكمش)
    try: lm = crop_mouth(im, None)
    except SystemExit: return True
    a, b, n = lm[234].x, lm[454].x, lm[1].x
    return abs((n - a) / max(1e-3, b - a) - 0.5) < 0.17
def verify(im, kind):
    from intake import _b64, _json
    from explainer import chat
    q = "Does this photo show " + KIND[kind] + ', with the teeth sharp (not blurry)? Answer ONLY JSON: {"fits": true|false, "why": "short"}'
    r = _json(chat([{"type": "text", "text": q}, {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + _b64(im, 1000)}}], model="google/gemini-2.5-pro", mt=2000))
    return bool(r.get("fits"))
def check(slot, f, v, im, ver):
    k = kind_of(slot); face = str(v.get("view", "")).startswith("face")
    if ver:
        if not verify(im, k): return "verify"
    else:
        if v.get("view") not in OK[k]: return "kind"
        ph = phase_of.get(f); sp = slot.split("_")[0]
        if ph in ("before", "after") and ph != sp: return "phase"
        if (v.get("quality") or 10) < 4: return "blur"
    if (face or k in ("face", "faceret")) and not yaw_ok(im): return "angle"
    return ""
done = []
for slot, f, md, ver in pairs:
    src = c.d + "/input/" + f; v = views[f]; im = upright(src, v)
    face = str(v.get("view", "")).startswith("face")
    why = "" if md else check(slot, f, v, im, ver)   # md = قص من صورة اتقبلت قبل كده في خانتها
    if why:
        rejected[slot] = {"file": f, "why": why, "view": v.get("view")}; print("REJECT", slot, f, why); continue
    rejected.pop(slot, None); done.append((slot, f))
    if ver and f in phase_of and phase_of[f] in ("before", "after"): phase_of[f] = slot.split("_")[0]   # الطبيب أكّد المرحلة
    crop = md or ("teeth" if slot in ("before_retracted", "after_retracted") and face else "lips" if slot in ("before_smile", "after_smile") and face else "")
    if crop: im = crop_mouth(im, 1.15 if crop == "teeth" else 1.45)
    out = c.canon(slot); os.makedirs(os.path.dirname(out), exist_ok=True); im.save(out, quality=95)
    if slot == "after_smile": im.save(c.d + "/canon/after/smile_front.jpg", quality=95)
    for k, x in list(c.m["slots"].items()):
        if k != slot and x.get("file") == f and not k.endswith(("face_retracted", "_face")): del c.m["slots"][k]
    c.m["slots"][slot] = {"file": f, "view": v.get("view"), "rotate": v.get("rotate", 0), "mirrored": v.get("mirrored", False), "manual": True, "cropped": crop}
    if slot == "before_face" and v.get("gender") in ("male", "female"): c.m["patient"]["gender"] = v["gender"]
    it = c.m["intake"]; it["unused"] = [u for u in it.get("unused", []) if u != f]
c.save(); c.log("الطبيب حدد: " + ", ".join(f"{s}<-{f}" for s, f in done) + (" | اترفضت: " + ", ".join(f"{s}<-{x['file']} ({x['why']})" for s, x in rejected.items()) if rejected else ""))
"""


IMG_EXT = (".jpg", ".jpeg", ".png", ".webp", ".heic")
VID_EXT = (".mp4", ".mov", ".m4v", ".webm", ".avi", ".3gp")
# فيديو الوجه ← الفيديو الحي اللي القوالب محتاجاه (بدل ما يتولّد بالذكاء الاصطناعي)
LIVE_OF = {"after_face": "after_live", "before_face": "before_live"}
_VIDEO = """
import sys, os, json, subprocess, cv2, numpy as np
src, kind, out_frame, live_out = sys.argv[1], sys.argv[2], sys.argv[3], (sys.argv[4] if len(sys.argv) > 4 else "")
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions
S_ = os.environ.get("DENTAL_ROOT") or os.path.dirname(os.getcwd())
det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=S_ + "/face/face_landmarker.task"), num_faces=1))
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS) or 30; n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
step = max(1, int(fps / 4)); best = (-1, None, 0, None); faces = []
i = 0
while True:
    ok, fr = cap.read()
    if not ok or i > 20 * 60 * fps: break
    if i % step == 0:
        h, w = fr.shape[:2]; sm = cv2.resize(fr, (480, int(480 * h / w))); g = cv2.cvtColor(sm, cv2.COLOR_BGR2GRAY)
        sharp = cv2.Laplacian(g, cv2.CV_64F).var()
        hsv = cv2.cvtColor(sm, cv2.COLOR_BGR2HSV); ch, cw = hsv.shape[0] // 4, hsv.shape[1] // 4
        teeth = float(((hsv[ch:-ch, cw:-cw, 2] > 150) & (hsv[ch:-ch, cw:-cw, 1] < 70)).mean())
        r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(cv2.cvtColor(sm, cv2.COLOR_BGR2RGB))))
        lm = r.face_landmarks[0] if r.face_landmarks else None
        opn = (lm[14].y - lm[13].y) / max(1e-3, lm[152].y - lm[10].y) if lm else 0
        if kind in ("face", "faceret", "smile") and lm is None and kind != "smile": score = 0
        else: score = (sharp ** .5) * (0.3 + teeth * 6 + opn * 4)
        faces.append((i / fps, lm[1].x if lm else None, score))
        if score > best[0]: best = (score, fr.copy(), i / fps, lm)
    i += 1
cap.release()
if best[1] is None: raise SystemExit("لم نجد كادرًا واضحًا في الفيديو")
cv2.imwrite(out_frame, best[1], [cv2.IMWRITE_JPEG_QUALITY, 95])
res = {"frame": out_frame, "t": round(best[2], 2), "dur": round(i / fps, 2)}
if live_out:   # مقطع ٦ ثواني حوالين أوضح لحظة، مقصوص 9:16 على الوش
    H, W = best[1].shape[:2]; t0 = max(0.0, min(best[2] - 2.0, i / fps - 6.0)); d = min(6.0, i / fps - t0)
    xs = [x for t, x, sc in faces if x is not None and t0 <= t <= t0 + d] or [0.5]; cx = float(np.median(xs)) * W
    if W / H > 9 / 16: cw_ = int(H * 9 / 16) // 2 * 2; x0 = int(min(max(0, cx - cw_ / 2), W - cw_)); vf = f"crop={cw_}:{H}:{x0}:0"
    else: chh = int(W * 16 / 9) // 2 * 2; vf = f"crop={W}:{min(H, chh)}:0:{max(0, (H - chh) // 4)}"
    os.makedirs(os.path.dirname(live_out), exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t0), "-i", src, "-t", str(d), "-vf", vf + ",scale=1080:1920,fps=30", "-an",
                    "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", live_out], check=True)
    res["live"] = live_out
print(json.dumps(res))
"""


def _video_frame(case: Path, video: str, kind: str, frame: str, live: str = "") -> None:
    """أوضح كادر في الفيديو (الأسنان باينة والصورة حادة) ← صورة للخانة. ولو live: مقطع حي 9:16 للقوالب."""
    args = ["-c", _VIDEO, str(case / "input" / video), kind, str(frame)] + ([live] if live else [])
    r = _run(case, args, "video.log", 1200)
    if r.returncode != 0:
        raise RuntimeError("تعذّر قراءة الفيديو. " + _tail(case, "video.log", 1))


def _link_live(case: Path) -> None:
    """أي خانة وجه صورتها جاية من فيديو: الفيديو نفسه يبقى الفيديو الحي المعتمد (فيديو حقيقي، مش متولد)."""
    m, cj = _meta(case), _engine_json(case)
    src_of = {**{v["frame"]: v["video"] for v in m.get("video_frames", [])}}
    for slot, live in LIVE_OF.items():
        f = cj.get("slots", {}).get(slot, {}).get("file")
        vid = src_of.get(f)
        out = case / "elements" / "v" / f"{live}.mp4"
        if not vid:
            continue
        _video_frame(case, vid, "face", str(case / "input" / f"_tmp_{live}.jpg"), str(out))
        (case / "input" / f"_tmp_{live}.jpg").unlink(missing_ok=True)
        _run(case, ["run.py", "approve", str(case), f"v/{live}.mp4", "real video from the doctor"], "approve.log", 120)
        with _LOCK:
            mm = _meta(case)
            mm.setdefault("live", {})[live] = {"from": vid, "at": time.time()}
            _save_meta(case, mm)


def _prep_videos(case: Path) -> None:
    """الفيديوهات اللي الطبيب رفعها: كادر من كل فيديو يتعامل كصورة (في خانته أو في التصنيف التلقائي)، والفيديو نفسه بيتحفظ."""
    m = _meta(case)
    frames = list(m.get("video_frames", []))
    kinds = {s["slot"]: s["kind"] for s in SHOTS}
    for slot, f in list(m.get("upload_slots", {}).items()):
        if f.lower().endswith(VID_EXT):
            fr = f"{slot}_frame.jpg"
            _set_job(case, stage="video")
            _video_frame(case, f, kinds.get(slot, "any"), str(case / "input" / fr))
            m["upload_slots"][slot] = fr
            frames.append({"frame": fr, "video": f})
    up = case / "_up"
    if up.is_dir():
        for v in sorted(up.iterdir()):
            if v.suffix.lower() in VID_EXT:
                _set_job(case, stage="video")
                shutil.move(str(v), str(case / "input" / v.name))
                fr = f"{v.stem}_frame.jpg"
                _video_frame(case, v.name, "any", str(up / fr))
                frames.append({"frame": fr, "video": v.name})
    with _LOCK:
        mm = _meta(case)
        mm["upload_slots"], mm["video_frames"] = m.get("upload_slots", {}), frames
        _save_meta(case, mm)


def _slots_intake(case: Path):
    """الطبيب رفع كل صورة في خانتها: نعدّل اتجاه الصور (كلها في نفس الوقت) ونحطها مكانها، ونحلل الأسنان، ونكمّل.
    أسرع وأدق من التصنيف التلقائي لأن الخانة معروفة."""
    _prep_videos(case)
    m = _meta(case)
    if (case / "_up").is_dir() and any((case / "_up").iterdir()):   # صور بالجملة (فولدر/كل الصور): التصنيف التلقائي الأول
        _set_job(case, stage="intake")
        r = _run(case, ["run.py", "new", str(case / "_up"), str(case)], "intake.log", 1800)
        if r.returncode != 0:
            raise RuntimeError("تعذّر تصنيف الصور. " + _tail(case, "intake.log", 1))
        _set_job(case, stage="slots")
    pairs = [f"{s}={f}" for s, f in m.get("upload_slots", {}).items()]
    if pairs:   # اللي الطبيب حطه في خانته بنفسه هو اللي يتعتمد (حتى لو التصنيف التلقائي حط صورة تانية)
        r = _run(case, ["-c", _ASSIGN, str(case), *pairs], "assign.log", 900)
        if r.returncode != 0:
            raise RuntimeError("تعذّر تجهيز الصور. " + _tail(case, "assign.log", 1))
        rej = _engine_json(case).get("intake", {}).get("rejected", {})
        for s_, f_ in m.get("upload_slots", {}).items():
            if rej.get(s_, {}).get("file") == f_:
                continue
            tag = SLOT_TAG.get(s_)
            for f in ([f"ai_{tag}.png", f"lab_{tag}.json", f"gm_{tag}.png"] if tag else []):
                (case / "ana" / f).unlink(missing_ok=True)
    _set_job(case, stage="analysis")
    r = _run(case, ["analysis.py", str(case)], "analysis.log", 1800)
    if r.returncode != 0:
        raise RuntimeError("تعذّر تحليل الأسنان في الصور. " + _tail(case, "analysis.log", 1))
    _link_live(case)
    return _continue(case)


def _assign_job(slot: str, fname: str, then: bool = True, mode: str = "", verify: bool = False):
    """الطبيب حدد صورة لخانة بنفسه: نفحصها (ولو مش هتنفع بنرفضها)، ونعدّل اتجاهها ونحطها مكانها، ونعيد تحليل الأسنان للخانة دي، وبعدين نكمّل."""
    def go(case: Path):
        r = _run(case, ["-c", _ASSIGN, str(case), f"{slot}={fname}:{mode}" + (":verify" if verify else "")], "assign.log", 600)
        if r.returncode != 0:
            raise RuntimeError("تعذّر استخدام الصورة. " + _tail(case, "assign.log", 1))
        if _engine_json(case).get("intake", {}).get("rejected", {}).get(slot, {}).get("file") == fname:   # اترفضت: الخانة زي ما هي
            return _continue(case) if then else None
        tag = SLOT_TAG.get(slot)
        for f in ([f"ai_{tag}.png", f"lab_{tag}.json", f"gm_{tag}.png"] if tag else []):   # تحليل الصورة القديمة مايتستخدمش
            (case / "ana" / f).unlink(missing_ok=True)
        cj = _engine_json(case)
        if cj.get("elements"):   # العناصر اتعملت من الصور القديمة: تتعمل من جديد
            for e in cj["elements"].values():
                e["status"] = MISSING
            (case / "case.json").write_text(json.dumps(cj, ensure_ascii=False, indent=1), encoding="utf-8")
        r = _run(case, ["analysis.py", str(case)], "analysis.log", 1800)
        if r.returncode != 0:
            raise RuntimeError("تعذّر تحليل الأسنان في الصورة. " + _tail(case, "analysis.log", 1))
        return _continue(case) if then else None
    return go


def _elements(case: Path) -> None:
    """العناصر اللي القوالب التجريبية محتاجاها. الداخلية (أقنعة، حدود السنان، خلفية اللثة) بتتعتمد لو عدّت الفلتر،
    واللي فيها وش المريض بتستنى موافقة الطبيب."""
    _set_job(case, stage="elements")
    r = _run(case, ["run.py", "elements", str(case), *[t["id"] for t in TEMPLATES if _tpl_ok(case, t)]], "elements.log", 3600)
    if r.returncode != 0:
        raise RuntimeError("تعذّر تجهيز العناصر. " + _tail(case, "elements.log", 1))
    cj = _engine_json(case)
    for name, e in cj.get("elements", {}).items():
        if name not in DOCTOR_REVIEW and e.get("status") == QA_PASS:
            _run(case, ["run.py", "approve", str(case), name, "auto: internal element passed QA"], "approve.log", 120)


def _render(tpl: str):
    def go(case: Path) -> None:
        out = case / "out" / f"{tpl}.mp4"
        if out.exists():   # النسخة القديمة بتتحفظ (أصول المريض مابتتمسحش)
            (case / "out" / "old").mkdir(exist_ok=True)
            os.replace(out, case / "out" / "old" / f"{tpl}_{int(out.stat().st_mtime)}.mp4")
        r = _run(case, ["T.py", tpl], f"render_{tpl}.log", 3600, cwd="tpl")
        if r.returncode != 0 or not out.exists():
            out.unlink(missing_ok=True)   # ملف ناقص من ريندر فاشل مايتحفظش
            raise RuntimeError("تعذّر إنشاء الفيديو. " + _tail(case, f"render_{tpl}.log", 1))
        with _LOCK:
            m = _meta(case)
            m.setdefault("videos", {})[tpl] = {"at": time.time(), "size": out.stat().st_size}
            _save_meta(case, m)
    return go


# ---------------------------------------------------------------- الواجهة
def create(data_dir: Path, files: list[tuple[str, bytes]], title: str = "", slots: dict | None = None) -> str:
    """slots = {الخانة: (اسم الملف، البيانات)}: كل صورة (أو فيديو) في خانتها. files = صور/فيديوهات بأي ترتيب (تصنيف تلقائي).
    كل اللي الطبيب رفعه بيفضل محفوظ في فولدر المريض (input/) لأي قالب بعدين."""
    slots = slots or {}
    miss = [s["name"] for s in SHOTS if s["req"] and s["slot"] not in slots and not (DERIVE.get(s["slot"]) and DERIVE[s["slot"]][0] in slots)]
    if miss and not files:
        raise ValueError("ارفع صورة لكل خانة مطلوبة: " + "، ".join(miss))
    cid = uuid.uuid4().hex[:12]
    case = root(data_dir) / cid
    (case / "input").mkdir(parents=True)
    (case / "_up").mkdir()
    ok_ext = lambda e: e if e in IMG_EXT + VID_EXT else ".jpg"
    up = {}
    for slot, (name, data) in slots.items():
        ext = ok_ext(os.path.splitext(name or "")[1].lower())
        (case / "input" / f"{slot}{ext}").write_bytes(data)
        up[slot] = f"{slot}{ext}"
    for i, (name, data) in enumerate(files):   # بالجملة: بتتصنف تلقائيًا وتتحط في الخانات الفاضية
        ext = ok_ext(os.path.splitext(name or "")[1].lower())
        (case / "_up" / f"{'v' if ext in VID_EXT else 'p'}{i + 1:02d}{ext}").write_bytes(data)
    _save_meta(case, {"title": (title or "").strip()[:80] or "حالة جديدة", "created": time.time(), "videos": {}, "upload_slots": up})
    _enqueue(case, "slots", _slots_intake)
    return cid


def view(data_dir: Path, cid: str) -> dict | None:
    case = case_dir(data_dir, cid)
    if not case:
        return None
    m, cj = _meta(case), _engine_json(case)
    els = cj.get("elements", {})
    review = []
    started, running = bool(els), m.get("job", {}).get("status") in ("queued", "running")
    for name, info in DOCTOR_REVIEW.items():
        e = els.get(name)
        if not started:
            continue
        f = case / "elements" / name
        state = STATE.get((e or {}).get("status"), "making")
        if not f.exists() and (state != "making" or not running):
            state = "failed"
        # الفلتر رفضها: الطبيب يشوف السبب، ويقرر هو (يوافق رغم ذلك أو تتعمل من جديد)
        review.append({"name": name, "why": info["why"], "state": state, "label": STATE_LABEL[state]["label"],
                       "note": _note((e or {}).get("note", "")) if state in ("failed", "rejected") else "",
                       "url": f"/api/dental/cases/{cid}/file/elements/{name}?t={int(f.stat().st_mtime)}&w=900" if f.exists() else ""})
    problems = [{"name": n, "label": INTERNAL[n]["label"], "note": _note(e.get("note", ""))} for n, e in els.items()
                if n in INTERNAL and e.get("status") in (QA_FAIL, MISSING) and e.get("note")]
    ready = all(els.get(n, {}).get("status") == APPROVED for n in DOCTOR_REVIEW) and bool(els)
    vids = {k: {**v, "url": f"/api/dental/cases/{cid}/file/out/{k}.mp4?v={int(v.get('at', 0))}"}
            for k, v in m.get("videos", {}).items() if (case / "out" / f"{k}.mp4").exists()}
    have = cj.get("slots", {})
    slots = {s["slot"]: s["slot"] in have for s in SHOTS}
    slot_info = {s["slot"]: {"url": f"/api/dental/cases/{cid}/file/slot/{s['slot']}?t={int((case / 'canon' / CANON[s['slot']]).stat().st_mtime)}&w=480",
                             "cropped": bool(have[s["slot"]].get("cropped"))}
                 for s in SHOTS if s["slot"] in have and (case / "canon" / CANON[s["slot"]]).exists()}
    used = {}
    for k, v in have.items():   # صورة واحدة ممكن تبقى في خانتين (الوجه + الابتسامة المقصوصة منه): الأولوية لخانة الصورة نفسها
        if v.get("file") and (v["file"] not in used or not v.get("cropped")):
            used[v["file"]] = k
    names = {**{k: v["name"] for k, v in SLOT_NAMES.items()}, **{s["slot"]: s["name"] for s in SHOTS}}
    it = cj.get("intake", {})
    photos = [{"file": f.name, "url": f"/api/dental/cases/{cid}/file/input/{f.name}?w=360", "slot": used.get(f.name, ""),
               "slot_name": names.get(used.get(f.name, ""), ""), **_photo_info(cj, have, f.name)}
              for f in sorted((case / "input").glob("*")) if f.is_file() and not f.name.startswith("_") and f.suffix.lower() in IMG_EXT] if (case / "input").is_dir() else []
    rejected = [{"slot": k, "slot_name": names.get(k, k), "file": x["file"], "url": f"/api/dental/cases/{cid}/file/input/{x['file']}?w=360",
                 "why": REASON.get(x.get("why"), REASON["kind"])["text"], "code": x.get("why"), "view_label": VIEW_LABEL.get(x.get("view"), {}).get("label", "")}
                for k, x in it.get("rejected", {}).items() if k in KIND_OF and k not in have]
    job = dict(m.get("job", {}))
    if job.get("status") == "running" and job.get("stage") in ("intake", "slots") and have and it.get("views"):
        job["stage"] = "analysis"   # التصنيف خلص والصور في خاناتها: اللي شغال دلوقتي تحليل الأسنان (القناع والترقيم)
    return {"id": cid, "title": m.get("title", ""), "created": m.get("created"), "job": job,
            "slots": slots, "slot_info": slot_info, "need": _missing(case), "photos": photos, "rejected": rejected, "problems": problems, "gender": cj.get("patient", {}).get("gender"), "review": review,
            "ready": ready, "videos": vids, "templates": [{**t, "available": _tpl_ok(case, t)} for t in TEMPLATES],
            "assets": _assets(case, cid)}


def _photo_info(cj: dict, have: dict, f: str) -> dict:
    """النوع اللي اتعرفنا عليه، والمرحلة، والخانات اللي تنفع لها (وسبب الرفض لكل خانة)، وليه مااتستخدمتش."""
    it = cj.get("intake", {})
    v = it.get("views", {}).get(f, {})
    ph = it.get("phase_of", {}).get(f)
    fit = {s["slot"]: _precheck(cj, s["slot"], f) for s in SHOTS}
    unused, is_used = "", any(x.get("file") == f for x in have.values())
    if not is_used:
        if f in it.get("dropped", {}):
            unused = it["dropped"][f].get("why", "kind")
        elif v.get("view") == "other":
            unused = "other"
        elif v and not any(c == "" for c in fit.values()):
            unused = "nofit" if v.get("view") not in sum(FIT_VIEWS.values(), ()) else min(fit.values(), key=lambda c: c != "phase")
        elif v and not [k for k, c in fit.items() if c == "" and k not in have]:
            unused = "taken"
    return {"suggest": [k for k, c in fit.items() if c == "" and k not in have] if unused == "" and v and not is_used else [],"view_label": VIEW_LABEL.get(v.get("view"), {}).get("label", ""), "phase_label": PHASE_LABEL.get(ph, {}).get("label", ""),
            "fit": {k: (REASON[c]["text"] if c else "") for k, c in fit.items()},
            "unused_why": REASON[unused]["text"] if unused else ""}


def _assets(case: Path, cid: str) -> list[dict]:
    """فولدر المريض: كل اللي اترفع واتعمل (صور، فيديوهات، صور الخانات، الصور المشتقة، الفيديوهات الحية، الفيديوهات النهائية)
    بيفضل محفوظ لأي قالب جديد بعدين."""
    u = lambda rel: f"/api/dental/cases/{cid}/file/{rel}"
    out = []
    for f in sorted((case / "input").glob("*")) if (case / "input").is_dir() else []:
        if f.is_file() and not f.name.startswith("_"):
            out.append({"group": "uploads", "name": f.name, "url": u(f"input/{f.name}"), "video": f.suffix.lower() in VID_EXT})
    for f in sorted((case / "elements").glob("*")) if (case / "elements").is_dir() else []:
        if f.is_file() and f.suffix.lower() in (".png", ".jpg", ".jpeg") and not f.name.endswith(("_chk.jpg",)):
            out.append({"group": "derived", "name": f.name, "url": u(f"elements/{f.name}"), "video": False})
    for f in sorted((case / "elements" / "v").glob("*.mp4")) if (case / "elements" / "v").is_dir() else []:
        out.append({"group": "live", "name": f.name, "url": u(f"elements/v/{f.name}"), "video": True})
    for f in sorted((case / "out").rglob("*.mp4")) if (case / "out").is_dir() else []:
        rel = f.relative_to(case).as_posix()
        out.append({"group": "videos", "name": f.name, "url": u(rel), "video": True})
    return out


def assets_zip(data_dir: Path, cid: str) -> Path | None:
    """تنزيل فولدر المريض كله (الأصلي + اللي اتعمل) في ملف واحد."""
    import zipfile
    case = case_dir(data_dir, cid)
    if not case:
        return None
    z = case / "_assets.zip"
    with zipfile.ZipFile(z, "w", zipfile.ZIP_STORED) as zf:
        for sub in ("input", "canon", "elements", "out"):
            for f in sorted((case / sub).rglob("*")) if (case / sub).is_dir() else []:
                if f.is_file() and not f.name.startswith("_"):
                    zf.write(f, f.relative_to(case).as_posix())
    return z


def _note(n: str) -> str:
    """ملاحظة المحرك (مكتوبة للمطوّر) ← جملة للطبيب."""
    n = (n or "").strip()
    if n.startswith("مستني العنصر:"):
        dep = n.split(":", 1)[1].strip()
        lab = (INTERNAL.get(dep) or {}).get("label") or ("وجه المريض بعد العلاج" if dep.startswith("after_portrait") else dep)
        return f"لم تُصنع لأن خطوة «{lab}» لم تكتمل."
    if n.startswith("فشل التصنيع:"):
        return "تعذّر صنعها: " + n.split(":", 1)[1].strip()[:160]
    if n.startswith("الصورة الحقيقية ناقصة"):
        return "تنقصها صورة من صور الحالة."
    return n[:240]


def cases(data_dir: Path) -> list[dict]:
    out = []
    for d in sorted(root(data_dir).iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if d.is_dir() and _cid_ok(d.name):
            m = _meta(d)
            out.append({"id": d.name, "title": m.get("title", ""), "created": m.get("created"),
                        "job": m.get("job", {}), "videos": len(m.get("videos", {}))})
    return out


def decide(data_dir: Path, cid: str, name: str, ok: bool, reason: str = "") -> dict:
    case = case_dir(data_dir, cid)
    if not case or name not in DOCTOR_REVIEW:
        raise ValueError("غير موجود")
    _run(case, ["run.py", "approve" if ok else "reject", str(case), name, (reason or "")[:300]], "approve.log", 120)
    return view(data_dir, cid)


def redo(data_dir: Path, cid: str) -> None:
    """إعادة الخطوة اللي فشلت (أو إعادة تجهيز العناصر بعد رفض)."""
    case = case_dir(data_dir, cid)
    if not case:
        raise ValueError("غير موجود")
    if busy(case):
        raise RuntimeError("الحالة تعمل الآن")
    cj = _engine_json(case)
    if not cj.get("slots"):
        _enqueue(case, "intake", _intake)
    elif _missing(case):
        raise RuntimeError("حدّد الصورة الناقصة أولًا")
    elif _missing(case, derivable=True):   # ناقصة بس ليها بديل: نقصّها ونكمّل
        _enqueue(case, "assign", _continue)
    else:
        _enqueue(case, "elements", _elements_redo)


def _elements_redo(case: Path) -> None:
    cj = _engine_json(case)
    for name, e in cj.get("elements", {}).items():   # make() بيسيب المعتمد والعادي، فبنمسح حالة المرفوض علشان يتعمل تاني
        if e.get("status") in (REJECTED, QA_FAIL):
            e["status"] = MISSING
    (case / "case.json").write_text(json.dumps(cj, ensure_ascii=False, indent=1), encoding="utf-8")
    _elements(case)


def assign(data_dir: Path, cid: str, slot: str, photo: str = "", upload: tuple[str, bytes] | None = None, verify: bool = False) -> dict:
    """الطبيب يحدد صورة لخانة: من صوره اللي رفعها (photo) أو صورة جديدة (upload).
    الصورة اللي مش هتنفع (نوع غلط، من الجنب، مش واضحة، مرحلة تانية) بتترفض. verify = الطبيب شايف إن التصنيف غلط: نفحصها من جديد للخانة دي."""
    case = case_dir(data_dir, cid)
    if not case:
        raise ValueError("غير موجود")
    if slot not in {s["slot"] for s in SHOTS}:
        raise ValueError("خانة غير معروفة")
    if busy(case):
        raise RuntimeError("الحالة تعمل الآن، انتظر حتى تنتهي الخطوة الحالية")
    (case / "input").mkdir(exist_ok=True)
    video = ""
    if upload:
        ext = os.path.splitext(upload[0] or "")[1].lower()
        ext = ext if ext in IMG_EXT + VID_EXT else ".jpg"
        n = len(list((case / "input").glob("*"))) + 1
        photo = f"m{n:02d}{ext}"
        (case / "input" / photo).write_bytes(upload[1])
        if ext in VID_EXT:   # فيديو للخانة: أوضح كادر فيه هو الصورة، والفيديو نفسه بيتحفظ (وبيبقى فيديو حي لو للوجه)
            video, photo = photo, f"m{n:02d}_frame.jpg"
            kind = next((x["kind"] for x in SHOTS if x["slot"] == slot), "any")

            def go(c: Path, slot=slot, video=video, photo=photo, kind=kind):
                _video_frame(c, video, kind, str(c / "input" / photo))
                with _LOCK:
                    mm = _meta(c)
                    mm.setdefault("video_frames", []).append({"frame": photo, "video": video})
                    _save_meta(c, mm)
                res = _assign_job(slot, photo, then=False)(c)
                _link_live(c)
                return _continue(c)
            _enqueue(case, "video", go)
            return view(data_dir, cid)
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", photo or "") or not (case / "input" / photo).is_file():
        raise ValueError("الصورة غير موجودة")
    why = "" if verify else _precheck(_engine_json(case), slot, photo)
    if why:
        raise ValueError(REASON[why]["text"])
    _enqueue(case, "assign", _assign_job(slot, photo, verify=verify))
    return view(data_dir, cid)


def render(data_dir: Path, cid: str, tpl: str) -> None:
    case = case_dir(data_dir, cid)
    if not case:
        raise ValueError("غير موجود")
    t = next((x for x in TEMPLATES if x["id"] == tpl), None)
    if not t:
        raise ValueError("القالب غير متاح في النسخة التجريبية")
    if not _tpl_ok(case, t):
        raise RuntimeError("هذا القالب يحتاج فيديو حقيقيًا للمريض بعد العلاج")
    if busy(case):
        raise RuntimeError("الحالة تعمل الآن، انتظر حتى تنتهي الخطوة الحالية")
    if not view(data_dir, cid)["ready"]:
        raise RuntimeError("وافق على الصور المشتقة أولًا")
    _enqueue(case, "render:" + tpl, _render(tpl))


def thumb(data_dir: Path, cid: str, rel: str, w: int) -> Path | None:
    """نسخة صغيرة من الصورة للعرض (الصور الأصلية بتبقى كبيرة جدًا والصفحة بتتقل). بتتعمل مرة وتتخزن."""
    p = file(data_dir, cid, rel)
    if not p or p.suffix.lower() not in IMG_EXT or w <= 0:
        return p
    w = min(max(w, 120), 1200)
    case = case_dir(data_dir, cid)
    out = case / "_thumb" / f"{re.sub(r'[^A-Za-z0-9_.-]', '_', rel)}_{int(p.stat().st_mtime)}_{w}.jpg"
    if not out.exists():
        from PIL import Image, ImageOps
        out.parent.mkdir(exist_ok=True)
        im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
        im.thumbnail((w, w * 2))
        im.save(out, "JPEG", quality=82)
    return out


def file(data_dir: Path, cid: str, rel: str) -> Path | None:
    """ملفات الحالة اللي الواجهة بتعرضها بس: العناصر اللي محتاجة موافقة، والفيديوهات."""
    case = case_dir(data_dir, cid)
    if not case:
        return None
    if rel.startswith("slot/") and rel[5:] in CANON:   # الصورة اللي في الخانة (بعد تعديل الاتجاه/القص)
        p = case / "canon" / CANON[rel[5:]]
        return p if p.is_file() else None
    ok = re.fullmatch(r"elements/[A-Za-z0-9_.-]{1,80}\.(png|jpe?g)", rel) or re.fullmatch(r"elements/v/[A-Za-z0-9_.-]{1,80}\.mp4", rel) \
        or re.fullmatch(r"out/(old/)?[A-Za-z0-9_.-]{1,80}\.mp4", rel) \
        or re.fullmatch(r"input/[A-Za-z0-9_.-]{1,64}", rel)   # صور الطبيب نفسه (علشان يشوف كل صورة اتحطت فين)
    p = (case / rel).resolve()
    return p if ok and p.is_file() and str(p).startswith(str(case.resolve())) else None


def delete(data_dir: Path, cid: str) -> bool:
    case = case_dir(data_dir, cid)
    if not case or busy(case):
        return False
    shutil.rmtree(case)
    return True
