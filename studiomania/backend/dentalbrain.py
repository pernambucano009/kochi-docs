"""🦷🧠 حالات الأسنان في العقل: فولدر «الحالات» جوه «الصور» في مكتبة العقل، وكل فولدر جواه = حالة مريض.

- أول ما الطبيب يضيف صور لحالة: العقل يصنّفها لوحده (قبل/تحضير/بعد، ابتسامة/مبعد/مقرّبة، الاتجاه، ومين بنفس زاوية مين)
  بطلب واحد للحالة كلها (photo/case_scan.py في المحرك).
- الحالة لازم يكون ليها اسم: فولدر اسمه افتراضي (مجلد جديد، New folder، أرقام، IMG_…) عليه «اكتب اسم الحالة».
- في المشاريع: كل قالب (فيديو أو صور) بيعرض الحالات، اللي تنفع له تتختار، واللي ماتنفعش مقفولة ومكتوب ناقصها إيه (photo/fit.py).

مفيش هنا أي FastAPI: app.py بيستدعي الدوال دي بالمكتبة نفسها.
"""
from __future__ import annotations

import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ENGINE = Path(__file__).resolve().parent.parent / "dental" / "engine"
CASES_NAME = "الحالات"
DENTAL_RE = re.compile(r"أسنان|اسنان|الأسنان|تقويم|زراعة الأسنان|فينير|ابتسامة هوليود|dental|dentist|teeth|smile design|veneer", re.I)
GENERIC_RE = re.compile(r"^(مجلد جديد|مجلد|جديد|new folder|untitled|folder|بدون اسم|حالة جديدة|حالة|case|img|dcim|camera|photos?|صور|\d[\d\s_\-.:]*|"
                        r"(img|dsc|pxl|wa)[_\- ]?\d+.*|\d{4}[-_.]\d{2}[-_.]\d{2}.*)( ?\(\d+\))?$", re.I)


def _load(name: str, rel: str):
    sp = importlib.util.spec_from_file_location(name, ENGINE / rel)
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
    return m


fit = _load("dental_fit", "photo/fit.py")

# قوالب الصور (بوستات): نفس أسماء الموك أب، والغلاف في frontend/gallery/dental/
PHOTO_TEMPLATES = [
    {"id": "p01", "name": "قبل وبعد: الابتسامة", "desc": "قبل في الأعلى وبعد في الأسفل، مقصوصتان على الشفتين بالمقاس والمكان نفسيهما، وشعار العيادة."},
    {"id": "p02", "name": "قبل وبعد: بالمبعد", "desc": "قبل وبعد بالمبعد بالزاوية نفسها: فك واحد على خلفية سوداء مع انعكاس خفيف تحت الأسنان، وشعار العيادة."},
    {"id": "p03", "name": "قبل وبعد: من الجانب", "desc": "صورتان جانبيتان بالزاوية نفسها، قبل في الأعلى وبعد في الأسفل."},
    {"id": "p04", "name": "المرآة الطولية", "desc": "صورتا مبعد قبل وبعد للفك نفسه، معزولتان على الأسود ومتقابلتان بالزاوية نفسها، والشعار في المنتصف."},
    {"id": "p05", "name": "الماكرو بالتوقيع", "desc": "صورة مبعد بعد العلاج بالعرض ومقرّبة جدًا لإظهار التفاصيل دون إزالة الخلفية (تُكبَّر تلقائيًا)، مع الشعار واسم الطبيب علامةً مائية."},
    {"id": "p06", "name": "المراحل الثلاث: طولي", "desc": "قبل ثم التحضير ثم بعد، ثلاثة صفوف في صورة طولية 9:16، والشعار كبير في الأسفل."},
    {"id": "p07", "name": "المراحل الثلاث: صفوف", "desc": "قبل ثم التحضير ثم بعد، ثلاثة صفوف على خلفية سوداء."},
    {"id": "p08", "name": "الأسنان على الأسود: من الأمام", "desc": "الفك بعد العلاج في أعلى الصورة واللثة حتى الحافة، والخلفية تحت الأسنان سوداء، والشعار كبير."},
    {"id": "p09", "name": "قبل وبعد متقابلان", "desc": "قبل في الأعلى وبعد في الأسفل مقلوبًا، وأطراف الأسنان متقابلة، والخلفية سوداء والشعار في المنتصف."},
    {"id": "p10", "name": "قبل وبعد على الأسود", "desc": "قبل وبعد مع اللثة والشفة كما هما، والخلفية تحت الأسنان سوداء، والشعار في المنتصف."},
    {"id": "p11", "name": "الأسنان على الأسود: من اليمين", "desc": "صورة مبعد من الجانب الأيمن بعد العلاج، الفك في الأعلى واللثة حتى الحافة، والشعار كبير."},
    {"id": "p12", "name": "الأسنان على الأسود: من اليسار", "desc": "صورة مبعد من الجانب الأيسر بعد العلاج، الفك في الأعلى واللثة حتى الحافة، والشعار كبير."},
]
PHOTO_IDS = {t["id"] for t in PHOTO_TEMPLATES}


def is_dental(client: dict | None) -> bool:
    """عميل مجاله أسنان؟ (من بيانات العقل: الاسم والوصف والمجال)."""
    c = client or {}
    text = " ".join(str(c.get(k) or "") for k in ("name", "about", "niche", "type", "field", "domain", "market"))
    return bool(DENTAL_RE.search(text))


def generic_name(name: str) -> bool:
    return bool(GENERIC_RE.match((name or "").strip()))


# ---------- الشجرة ----------
def cases_root(lib: dict) -> dict | None:
    return next((f for f in lib["folders"] if f.get("cases_root")), None)


def ensure_root(lib: dict, images_root: str) -> str:
    """فولدر «الحالات» جوه الصور (مرة واحدة)، ومتعلّم إنه أساسي لحالات الأسنان."""
    r = cases_root(lib)
    if not r:
        r = next((f for f in lib["folders"] if f.get("parent") == images_root and f["name"].strip() == CASES_NAME), None)
        if not r:
            r = {"id": __import__("uuid").uuid4().hex[:10], "name": CASES_NAME, "parent": images_root}
            lib["folders"].append(r)
        r["cases_root"] = True
    r["parent"] = images_root
    return r["id"]


def case_of(lib: dict, folder: str | None) -> dict | None:
    """الحالة اللي الفولدر ده جواها (فولدر مباشر جوه «الحالات»)."""
    by = {f["id"]: f for f in lib["folders"]}
    cur, root = by.get(folder or ""), cases_root(lib)
    while cur and root:
        if cur.get("parent") == root["id"]:
            return cur
        cur = by.get(cur.get("parent") or "")
    return None


def case_files(lib: dict, case: dict) -> list[dict]:
    """صور وفيديوهات الحالة (الفولدر وفولدراته)، من غير البوستات اللي البرنامج عملها."""
    by = {f["id"]: f for f in lib["folders"]}
    def inside(fid):
        cur, seen = by.get(fid or ""), set()
        while cur and cur["id"] not in seen:
            if cur["id"] == case["id"]:
                return True
            seen.add(cur["id"])
            cur = by.get(cur.get("parent") or "")
        return False
    return [f for f in lib["files"] if f.get("kind") in ("image", "video") and not f.get("made") and inside(f.get("folder"))]


def cases(lib: dict) -> list[dict]:
    r = cases_root(lib)
    return [f for f in lib["folders"] if r and f.get("parent") == r["id"]]


def refresh_flags(lib: dict) -> None:
    """كل حالة: محتاجة اسم؟ وتصنيفها لسه متاخد على نفس الصور؟"""
    for c in cases(lib):
        info = c.setdefault("case", {})
        info["needs_name"] = generic_name(c["name"])
        ids = sorted(f["id"] for f in case_files(lib, c))
        info["count"] = len(ids)
        if info.get("sig") != "|".join(ids):
            info["stale"] = bool(ids)
        else:
            info.pop("stale", None)


# ---------- التصنيف ----------
def classify(paths: list[tuple[str, Path]], env: dict, timeout: int = 600) -> list[dict]:
    """[(id, مسار)] ← تصنيف كل صورة (طلب واحد لموديل رؤية للحالة كلها)."""
    with tempfile.TemporaryDirectory() as td:
        inp, out = Path(td) / "in.json", Path(td) / "out.json"
        inp.write_text(json.dumps([{"id": i, "path": str(p)} for i, p in paths]), encoding="utf-8")
        e = {**os.environ, **env, "DENTAL_ROOT": str(ENGINE), "PYTHONUNBUFFERED": "1"}
        r = subprocess.run([sys.executable, str(ENGINE / "photo" / "case_scan.py"), "--labels", str(inp), str(out)],
                           cwd=str(ENGINE / "photo"), env=e, capture_output=True, text=True, timeout=timeout)
        if r.returncode != 0 or not out.exists():
            raise RuntimeError("تعذّر تصنيف صور الحالة: " + (r.stderr or r.stdout or "")[-300:])
        return json.loads(out.read_text(encoding="utf-8"))


def photos_of(lib: dict, case: dict) -> list[dict]:
    """صور الحالة بتصنيفها (بالشكل اللي fit.py عايزه)."""
    lab = (case.get("case") or {}).get("labels") or {}
    out = []
    for f in case_files(lib, case):
        if f["kind"] == "video":
            out.append({"id": f["id"], "video": True, "stage": "unknown"})
        elif f["id"] in lab:
            out.append({"id": f["id"], **lab[f["id"]]})
    return out


# ---------- أي حالة تنفع لأي قالب ----------
def fit_case(lib: dict, case: dict, tid: str, video_templates: list[dict]) -> dict:
    info = case.get("case") or {}
    base = {"id": case["id"], "name": case["name"], "needs_name": bool(info.get("needs_name"))}
    if not case_files(lib, case):
        return {**base, "ok": False, "missing": "لا توجد صور في هذه الحالة بعد"}
    if info.get("needs_name"):
        return {**base, "ok": False, "missing": "اكتب اسم الحالة أولًا في العقل", "busy": bool(info.get("status") == "classifying" or info.get("stale"))}
    if info.get("status") == "classifying" or info.get("stale"):
        return {**base, "ok": False, "busy": True, "missing": "يصنّف العقل صور الحالة الآن…"}
    if info.get("status") == "error":
        return {**base, "ok": False, "missing": "تعذّر تصنيف الصور: " + str(info.get("error") or "أعد المحاولة من العقل")[:120]}
    P = photos_of(lib, case)
    if tid in PHOTO_IDS:
        r = fit.fit_photo(tid, P)
    else:
        t = next((x for x in video_templates if x["id"] == tid), None)
        if not t:
            raise ValueError("القالب غير موجود")
        r = fit.fit_video(tid, P, t.get("needs", []))
    return {**base, "ok": r["ok"], "missing": r.get("missing"), "photos": r.get("photos") or {}, "live": r.get("live")}


def render_photo(tid: str, photos: dict[str, Path], brand: dict, out: Path, env: dict, timeout: int = 600) -> tuple[Path, bool]:
    """بوست صورة من قالب (المحرك: photo/templates.py) ← (مسار الصورة، الشعار ضعيف الظهور ومحتاج إذن تلوينه؟).
    الشعار عمره ما بيتلوّن من غير موافقة العميل (brand["logo_recolor"] = True)."""
    with tempfile.TemporaryDirectory() as td:
        bj = Path(td) / "brand.json"
        bj.write_text(json.dumps(brand, ensure_ascii=False), encoding="utf-8")
        args = [sys.executable, str(ENGINE / "photo" / "templates.py"), tid, str(bj), str(out)] + [f"{k}={v}" for k, v in photos.items()]
        e = {**os.environ, **env, "DENTAL_ROOT": str(ENGINE), "PYTHONUNBUFFERED": "1"}
        r = subprocess.run(args, cwd=str(ENGINE / "photo"), env=e, capture_output=True, text=True, timeout=timeout)
        msg = next((l for l in (r.stdout or "").splitlines()[::-1] if l.startswith("{")), "")
        try:
            res = json.loads(msg)
        except ValueError:
            res = {"ok": False, "error": (r.stderr or "")[-300:]}
        if not res.get("ok") or not out.exists():
            raise RuntimeError(str(res.get("error") or "تعذّر صنع الصورة").split(": ", 1)[-1])
        return out, bool(res.get("logo_low_contrast"))
