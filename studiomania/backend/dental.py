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
    {"id": "a24", "name": "الزراعة والتركيبات", "dur": 28.6,
     "desc": "خطوط الوجه، ودخول الزرعات أماكنها، ومخطط نسب عرض الأسنان، وفي النهاية ابتسامة ما بعد العلاج."},
]
TPL_IDS = [t["id"] for t in TEMPLATES]

# الصور المطلوبة من الطبيب (نفس خانات المحرك)
SHOTS = [
    {"slot": "before_retracted", "name": "الأسنان قبل العلاج بالمبعد", "hint": "صورة قريبة من الأمام والمبعد في الفم."},
    {"slot": "after_retracted", "name": "الأسنان بعد العلاج بالمبعد", "hint": "الزاوية نفسها بعد العلاج."},
    {"slot": "before_face", "name": "وجه المريض قبل العلاج", "hint": "المريض يبتسم دون مبعد، من الأمام."},
    {"slot": "after_smile", "name": "الابتسامة بعد العلاج", "hint": "ابتسامة قريبة بعد العلاج دون مبعد (الشفتان والأسنان)."},
]

# العناصر المشتقة اللي الطبيب لازم يشوفها ويوافق عليها بنفسه (فيها وش المريض)، والباقي داخلي بيتعتمد لو عدّى الفلتر
DOCTOR_REVIEW = {
    "after_portrait_v3.png": {"why": "وجه المريض بعد العلاج: الابتسامة الحقيقية من صورة ما بعد العلاج على وجهه. تأكّد أن الأسنان هي أسنانه نفسها."},
    "before_face_hi.png": {"why": "وجه المريض قبل العلاج بدقة أعلى. تأكّد أن الأسنان مطابقة للأصل تمامًا (دون تبييض أو تعديل)."},
}


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


def _missing(case: Path) -> list[str]:
    have = _engine_json(case).get("slots", {})
    return [s["slot"] for s in SHOTS if s["slot"] not in have]


def _continue(case: Path):
    """لو كل الصور المطلوبة موجودة نكمّل للعناصر، وإلا نستنى الطبيب يحدد الصورة الناقصة بنفسه."""
    miss = _missing(case)
    if miss:
        return {"status": "needs", "missing": miss}
    _elements(case)


SLOT_TAG = {"before_retracted": "before", "after_retracted": "after", "after_smile": "smile"}
_ASSIGN = """
import os, sys, json
from case import Case
from intake import view_of, upright
c = Case(sys.argv[1]); slot, f = sys.argv[2], sys.argv[3]; src = c.d + "/input/" + f
v = c.m.get("intake", {}).get("views", {}).get(f) or view_of(src)
im = upright(src, v); out = c.canon(slot); os.makedirs(os.path.dirname(out), exist_ok=True); im.save(out, quality=95)
if slot == "after_smile": im.save(c.d + "/canon/after/smile_front.jpg", quality=95)
for k, x in list(c.m["slots"].items()):
    if k != slot and x.get("file") == f: del c.m["slots"][k]
c.m["slots"][slot] = {"file": f, "view": v.get("view"), "rotate": v.get("rotate", 0), "mirrored": v.get("mirrored", False), "manual": True}
it = c.m.setdefault("intake", {}); it.setdefault("views", {})[f] = v
it["unused"] = [u for u in it.get("unused", []) if u != f]; c.save(); c.log(f"الطبيب حدد {slot} ← {f}")
"""


def _assign_job(slot: str, fname: str):
    """الطبيب حدد صورة لخانة بنفسه: نعدّل اتجاهها ونحطها مكانها، ونعيد تحليل الأسنان للخانة دي، وبعدين نكمّل."""
    def go(case: Path):
        r = _run(case, ["-c", _ASSIGN, str(case), slot, fname], "assign.log", 600)
        if r.returncode != 0:
            raise RuntimeError("تعذّر استخدام الصورة. " + _tail(case, "assign.log", 1))
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
        return _continue(case)
    return go


def _elements(case: Path) -> None:
    """العناصر اللي القوالب التجريبية محتاجاها. الداخلية (أقنعة، حدود السنان، خلفية اللثة) بتتعتمد لو عدّت الفلتر،
    واللي فيها وش المريض بتستنى موافقة الطبيب."""
    _set_job(case, stage="elements")
    r = _run(case, ["run.py", "elements", str(case), *TPL_IDS], "elements.log", 3600)
    if r.returncode != 0:
        raise RuntimeError("تعذّر تجهيز العناصر. " + _tail(case, "elements.log", 1))
    cj = _engine_json(case)
    for name, e in cj.get("elements", {}).items():
        if name not in DOCTOR_REVIEW and e.get("status") == QA_PASS:
            _run(case, ["run.py", "approve", str(case), name, "auto: internal element passed QA"], "approve.log", 120)


def _render(tpl: str):
    def go(case: Path) -> None:
        out = case / "out" / f"{tpl}.mp4"
        if out.exists():
            out.unlink()
        r = _run(case, ["T.py", tpl], f"render_{tpl}.log", 3600, cwd="tpl")
        if r.returncode != 0 or not out.exists():
            raise RuntimeError("تعذّر إنشاء الفيديو. " + _tail(case, f"render_{tpl}.log", 1))
        with _LOCK:
            m = _meta(case)
            m.setdefault("videos", {})[tpl] = {"at": time.time(), "size": out.stat().st_size}
            _save_meta(case, m)
    return go


# ---------------------------------------------------------------- الواجهة
def create(data_dir: Path, files: list[tuple[str, bytes]], title: str = "") -> str:
    if len(files) < 4:
        raise ValueError("ارفع ٤ صور على الأقل: الأسنان قبل العلاج وبعده بالمبعد، ووجه المريض قبل العلاج، وابتسامته بعده.")
    cid = uuid.uuid4().hex[:12]
    case = root(data_dir) / cid
    (case / "_up").mkdir(parents=True)
    for i, (name, data) in enumerate(files):
        ext = os.path.splitext(name or "")[1].lower()
        if ext not in (".jpg", ".jpeg", ".png", ".webp", ".heic"):
            ext = ".jpg"
        (case / "_up" / f"p{i + 1:02d}{ext}").write_bytes(data)
    _save_meta(case, {"title": (title or "").strip()[:80] or "حالة جديدة", "created": time.time(), "videos": {}})
    _enqueue(case, "intake", _intake)
    return cid


def view(data_dir: Path, cid: str) -> dict | None:
    case = case_dir(data_dir, cid)
    if not case:
        return None
    m, cj = _meta(case), _engine_json(case)
    els = cj.get("elements", {})
    review = []
    for name, info in DOCTOR_REVIEW.items():
        e = els.get(name)
        if not e or not (case / "elements" / name).exists():
            continue
        state = STATE.get(e.get("status"), "making")
        review.append({"name": name, "why": info["why"], "state": state, "label": STATE_LABEL[state]["label"],
                       "url": f"/api/dental/cases/{cid}/file/elements/{name}?t={int((case / 'elements' / name).stat().st_mtime)}"})
    ready = all(els.get(n, {}).get("status") == APPROVED for n in DOCTOR_REVIEW) and bool(els)
    vids = {k: {**v, "url": f"/api/dental/cases/{cid}/file/out/{k}.mp4?v={int(v.get('at', 0))}"}
            for k, v in m.get("videos", {}).items() if (case / "out" / f"{k}.mp4").exists()}
    slots = {s["slot"]: s["slot"] in cj.get("slots", {}) for s in SHOTS}
    used = {v.get("file"): k for k, v in cj.get("slots", {}).items()}
    names = {s["slot"]: s["name"] for s in SHOTS}
    photos = [{"file": f.name, "url": f"/api/dental/cases/{cid}/file/input/{f.name}", "slot": used.get(f.name, ""),
               "slot_name": names.get(used.get(f.name, ""), "")}
              for f in sorted((case / "input").glob("*")) if f.is_file() and not f.name.startswith("_")] if (case / "input").is_dir() else []
    return {"id": cid, "title": m.get("title", ""), "created": m.get("created"), "job": m.get("job", {}),
            "slots": slots, "photos": photos, "gender": cj.get("patient", {}).get("gender"), "review": review,
            "ready": ready, "videos": vids, "templates": TEMPLATES}


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
    else:
        _enqueue(case, "elements", _elements_redo)


def _elements_redo(case: Path) -> None:
    cj = _engine_json(case)
    for name, e in cj.get("elements", {}).items():   # make() بيسيب المعتمد والعادي، فبنمسح حالة المرفوض علشان يتعمل تاني
        if e.get("status") in (REJECTED, QA_FAIL):
            e["status"] = MISSING
    (case / "case.json").write_text(json.dumps(cj, ensure_ascii=False, indent=1), encoding="utf-8")
    _elements(case)


def assign(data_dir: Path, cid: str, slot: str, photo: str = "", upload: tuple[str, bytes] | None = None) -> dict:
    """الطبيب يحدد صورة لخانة: من صوره اللي رفعها (photo) أو صورة جديدة (upload)."""
    case = case_dir(data_dir, cid)
    if not case:
        raise ValueError("غير موجود")
    if slot not in {s["slot"] for s in SHOTS}:
        raise ValueError("خانة غير معروفة")
    if busy(case):
        raise RuntimeError("الحالة تعمل الآن، انتظر حتى تنتهي الخطوة الحالية")
    (case / "input").mkdir(exist_ok=True)
    if upload:
        ext = os.path.splitext(upload[0] or "")[1].lower()
        ext = ext if ext in (".jpg", ".jpeg", ".png", ".webp", ".heic") else ".jpg"
        n = len(list((case / "input").glob("*"))) + 1
        photo = f"m{n:02d}{ext}"
        (case / "input" / photo).write_bytes(upload[1])
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", photo or "") or not (case / "input" / photo).is_file():
        raise ValueError("الصورة غير موجودة")
    _enqueue(case, "assign", _assign_job(slot, photo))
    return view(data_dir, cid)


def render(data_dir: Path, cid: str, tpl: str) -> None:
    case = case_dir(data_dir, cid)
    if not case:
        raise ValueError("غير موجود")
    if tpl not in TPL_IDS:
        raise ValueError("القالب غير متاح في النسخة التجريبية")
    if busy(case):
        raise RuntimeError("الحالة تعمل الآن، انتظر حتى تنتهي الخطوة الحالية")
    if not view(data_dir, cid)["ready"]:
        raise RuntimeError("وافق على الصور المشتقة أولًا")
    _enqueue(case, "render:" + tpl, _render(tpl))


def file(data_dir: Path, cid: str, rel: str) -> Path | None:
    """ملفات الحالة اللي الواجهة بتعرضها بس: العناصر اللي محتاجة موافقة، والفيديوهات."""
    case = case_dir(data_dir, cid)
    if not case:
        return None
    ok = (rel.startswith("elements/") and rel[9:] in DOCTOR_REVIEW) or re.fullmatch(r"out/a\d\d\.mp4", rel) \
        or re.fullmatch(r"input/[A-Za-z0-9_.-]{1,64}", rel)   # صور الطبيب نفسه (علشان يشوف كل صورة اتحطت فين)
    p = (case / rel).resolve()
    return p if ok and p.is_file() and str(p).startswith(str(case.resolve())) else None


def delete(data_dir: Path, cid: str) -> bool:
    case = case_dir(data_dir, cid)
    if not case or busy(case):
        return False
    shutil.rmtree(case)
    return True
