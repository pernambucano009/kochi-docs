"""فولدر الحالة + الـ placeholders + حالة كل عنصر.

شكل فولدر الحالة:
    <case>/input/      الصور اللي رفعها الطبيب زي ما هي
    <case>/canon/      الصور الحقيقية بعد التصنيف، بأسماء ثابتة (القوالب بتقرا منها)
    <case>/ana/        تحليل السنان (أقنعة + ترقيم كل سنة) — بيتعمل مرة
    <case>/elements/   العناصر المشتقة (وش بعد التركيب، بروفايل، فيديو حي...) — بتتعمل مرة وبتتعتمد
    <case>/out/        الفيديوهات الناتجة
    <case>/case.json   كل حاجة فوق: مين اتصنف فين، كل عنصر حالته (ناقص/اتعمل/عدّى الفلتر/اتعتمد/اترفض)
"""
import json, os, time, threading
_LK = threading.RLock()   # العناصر المستقلة بتتعمل في threads مع بعض: الحفظ واحد واحد

# الصور الحقيقية اللي ممكن الطبيب يرفعها — كل واحدة ليها مكان ثابت في canon/
SLOTS = {
    "before_face":        ("before/face.webp",          "وش المريض قبل العلاج بيبتسم، من غير مبعد", True),
    "before_retracted":   ("before/macro.jpg",          "سنان القبل بالمبعد (ماكرو أمامي)", True),
    "after_retracted":    ("after/front.jpg",           "سنان البعد بالمبعد (ماكرو أمامي)", True),
    "after_retracted_close": ("after/front_close.jpg",  "سنان البعد بالمبعد أقرب", False),
    "after_retracted_side1": ("after/side1.jpg",        "سنان البعد بالمبعد من الجنب (يمين)", False),
    "after_retracted_side2": ("after/side2.jpg",        "سنان البعد بالمبعد من الجنب (شمال)", False),
    "after_smile":        ("ret/smile_front_ret4.jpg",  "ابتسامة البعد قريبة من غير مبعد (شفايف + سنان)", True),
    "before_smile":       ("before/smile.jpg",          "ابتسامة القبل قريبة من غير مبعد (شفايف + سنان)", False),
    "after_smile_side_r": ("ret/smile_side_r_ret4.jpg", "ابتسامة البعد من الجنب اليمين من غير مبعد", False),
    "after_smile_side_l": ("ret/smile_side_l_ret4.jpg", "ابتسامة البعد من الجنب الشمال من غير مبعد", False),
    "after_face":         ("after/face.jpg",            "وش المريض بعد العلاج بيبتسم من غير مبعد", False),
    "before_face_retracted": ("before/face_ret.jpg",    "وش المريض قبل العلاج بالمبعد", False),
    "after_face_retracted":  ("after/face_ret.jpg",     "وش المريض بعد العلاج بالمبعد", False),
    "prep":               ("prep/prep.jpg",             "السنان المحضّرة (بريب)", False),
    "veneers":            ("lab/veneers.jpg",           "العدسات/الفينيرات لوحدها", False),
    "cast":               ("lab/cast.jpg",              "التركيبات على كاست المعمل", False),
    "doctor":             ("doctor/doctor.jpg",         "صورة الطبيب", False),
}

# حالات العنصر
MISSING, MADE, QA_PASS, QA_FAIL, APPROVED, REJECTED = "ناقص", "اتعمل", "عدّى الفلتر", "مرفوض من الفلتر", "معتمد", "مرفوض من العميل"


class Case:
    def __init__(self, d):
        self.d = os.path.abspath(d).rstrip("/")
        for sub in ("input", "canon", "ana", "elements", "elements/ms", "out", "qa"): os.makedirs(f"{self.d}/{sub}", exist_ok=True)
        self.path = f"{self.d}/case.json"; os.environ["CASE_DIR"] = self.d   # تسجيل التكلفة (gen/costlog.py) بيكتب في qa/costs.jsonl بتاع الحالة دي
        self.m = json.load(open(self.path)) if os.path.exists(self.path) else {"slots": {}, "elements": {}, "patient": {}, "settings": {}, "log": []}

    def save(self):
        with _LK:
            s = json.dumps(self.m, ensure_ascii=False, indent=1)
            open(self.path + ".tmp", "w").write(s); os.replace(self.path + ".tmp", self.path)
    def log(self, msg):
        with _LK: self.m["log"].append([time.strftime("%Y-%m-%d %H:%M"), msg]); self.save()

    # ---- الصور الحقيقية ----
    def canon(self, slot): return f"{self.d}/canon/{SLOTS[slot][0]}"
    def has(self, slot): return slot in self.m["slots"] and os.path.exists(self.canon(slot))

    # ---- العناصر ----
    def el_path(self, name): return f"{self.d}/elements/{name}"
    def el(self, name): return self.m["elements"].get(name, {"status": MISSING})
    def set_el(self, name, **kw):
        with _LK: e = self.m["elements"].setdefault(name, {"status": MISSING}); e.update(kw); e["updated"] = time.strftime("%Y-%m-%d %H:%M"); self.save()
    def approved(self, name): return self.el(name).get("status") == APPROVED

    def env(self): e = dict(os.environ); e["CASE_DIR"] = self.d; return e

    def summary(self):
        rows = [f"الحالة: {self.d}", "الصور الحقيقية:"]
        for k, (rel, desc, req) in SLOTS.items():
            rows.append(f"  {'✓' if self.has(k) else ('✗ (مطلوبة)' if req else '—')} {desc}")
        rows.append("العناصر:")
        for k, v in self.m["elements"].items(): rows.append(f"  {v.get('status')}: {k}  {v.get('note', '')}")
        return "\n".join(rows)
