"""تحليل السنان لكل حالة (بيتعمل مرة ويتخزن في <case>/ana/):
- قناع السنان بالذكاء الاصطناعي (كل سنة شكل أبيض لوحده) ← ai_*.png
- ترقيم كل سنة (FDI) بالموديل ← lab_*.json
- قناع (السنان + اللثة العلوية) للعزل الدقيق من غير لسان/بق ← gm_before.png / gm_after.png
الاستخدام: python3 analysis.py <فولدر الحالة>"""
import sys, os, cv2
S = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/")
sys.path.insert(0, S + "ana"); sys.path.insert(0, S + "product"); sys.path.insert(0, S + "gen"); os.chdir(S + "ana")
from case import Case
import aimask, gummask
MASKER = os.environ.get("DENTAL_MASKER", "sam")   # sam = موديل تقسيم حقيقي (SAM 2.1)؛ nb = الطريقة القديمة (Nano Banana بيرسم القناع)
from teethlib import analyze

JOBS = [("before_retracted", "before"), ("after_retracted", "after"), ("after_smile", "smile")]

def run(case_dir):
    import concurrent.futures as cf
    c = Case(case_dir); A = c.d + "/ana/"
    def one(job):   # كل صورة لوحدها (موديل القناع + الترقيم + قناع اللثة) — التلاتة في نفس الوقت
        slot, tag = job
        if not c.has(slot): return tag, "الصورة مش موجودة"
        src = c.canon(slot)
        try:   # صورة صغيرة (أقل من 1400 بكسل عرض): تكبير أمين قبل التحليل — الحدة من موديل التكبير، والألوان والشكل من الأصل.
            from PIL import Image as _I   # (كان بيتعمل بس لما الطبيب يحط الصورة بإيده في خانتها، فالصور اللي دخلت بالتصنيف التلقائي فضلت صغيرة)
            if _I.open(src).width < 1400 and not c.m["slots"].get(slot, {}).get("upscaled"):
                sys.path.insert(0, S + "tools"); from faithful_upscale import upscale_small
                up_ = upscale_small(src); c.m["slots"].setdefault(slot, {})["upscaled"] = up_; c.save(); c.log(f"تكبير {slot}: {up_}")
                for f in (A + f"ai_{tag}.png", A + f"lab_{tag}.json", A + f"det_{tag}.json", A + f"gm_{tag}.png", A + f"ai_{tag}_ids.png"):
                    if os.path.exists(f): os.remove(f)
        except Exception as e: print("UPSCALE_FAILED", slot, str(e)[:160])
        if MASKER == "sam":
            import sammask
            if not os.path.exists(A + f"ai_{tag}.png"):
                sammask.make(src, A + f"ai_{tag}.png", A + f"gm_{tag}.png" if tag in ("before", "after") else None, A + f"det_{tag}.json")
        elif not os.path.exists(A + f"ai_{tag}.png"): aimask.one(src, A + f"ai_{tag}.png")
        _, teeth = analyze(src, A + f"ai_{tag}.png", A + f"lab_{tag}.json")
        if sum(1 for t in teeth if t["fdi"] < 30) < 4:   # الترقيم طلع ناقص (الموديل غلط أو القناع بايظ): قناع وترقيم من جديد مرة واحدة
            for f in (A + f"ai_{tag}.png", A + f"lab_{tag}.json"):
                if os.path.exists(f): os.remove(f)
            if MASKER == "sam":
                import sammask
                for f in (A + f"det_{tag}.json", A + f"gm_{tag}.png"):
                    if os.path.exists(f): os.remove(f)
                sammask.make(src, A + f"ai_{tag}.png", A + f"gm_{tag}.png" if tag in ("before", "after") else None, A + f"det_{tag}.json")
            else: aimask.one(src, A + f"ai_{tag}.png")
            _, teeth = analyze(src, A + f"ai_{tag}.png", A + f"lab_{tag}.json")
        if tag in ("before", "after") and not os.path.exists(A + f"gm_{tag}.png"): gummask.make(src, A + f"gm_{tag}.png")
        return tag, f"{len(teeth)} سنة: " + " ".join(str(t['fdi']) for t in sorted(teeth, key=lambda t: t['fdi']))
    with cf.ThreadPoolExecutor(len(JOBS)) as ex: res = dict(ex.map(one, JOBS))
    c.m["analysis"] = res; c.save(); c.log("تحليل السنان: " + str(res)); return res

if __name__ == "__main__": print(run(sys.argv[1]))
