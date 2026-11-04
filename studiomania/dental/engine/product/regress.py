"""Q13 اختبار رجوع بملاحظات الطبيب: كل ملاحظة اتكتبت في المعرض (قالب + ثانية + المشكلة) بقت سؤال ثابت
بيتسأل على كل نسخة جديدة من القالب: "المشكلة دي رجعت ولا لأ؟" — سؤال ضيق (Check ONLY) على كادرات حوالين الثانية دي،
بتاعنا جنب الأصل. كده أي غلطة اتقالت مرة مش ممكن ترجع من غير ما الفلتر يمسكها.

الاستخدام: python3 regress.py <cmp_aXX.mp4 أو فيديونا> <aXX>      ← بيطبع كل ملاحظة: رجعت/لأ
"""
import sys, os, io, json, glob, base64, subprocess
import cv2, numpy as np
from PIL import Image
S = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/")
sys.path.insert(0, S + "gen"); sys.path.insert(0, S + "xpl"); sys.path.insert(0, S + "product")
NOTES = S + "gallery/db/notes/"


def notes(name):
    out = []
    for p in sorted(glob.glob(NOTES + "*.json")):
        d = json.load(open(p))
        if d.get("video") == name and d.get("t") is not None and len(d.get("text", "")) > 15: out.append(dict(d, id=os.path.basename(p)[:-5]))
    return out


def _frame(cap, t):
    fps = cap.get(cv2.CAP_PROP_FPS) or 30; cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, int(t * fps))); ok, f = cap.read(); return f if ok else None


def _enc(f, w=320):
    im = Image.fromarray(cv2.cvtColor(f, cv2.COLOR_BGR2RGB)); im.thumbnail((w, w * 2)); b = io.BytesIO(); im.save(b, "JPEG", quality=82)
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()


def frames_at(video, ref, t, offs=(-1.0, -.5, 0, .5, 1.0)):
    """كادرات بتاعنا والأصل حوالين الثانية. لو الفيديو cmp (بتاعنا شمال والأصل يمين) بنقسمه."""
    cv = cv2.VideoCapture(video); cr = cv2.VideoCapture(ref) if ref else None; o, r = [], []
    for d in offs:
        f = _frame(cv, max(0, t + d))
        if f is None: continue
        if ref is None: H = f.shape[1] // 2; o.append((t + d, f[:, :H])); r.append((t + d, f[:, H:]))
        else:
            o.append((t + d, f)); g = _frame(cr, max(0, t + d))
            if g is not None: r.append((t + d, g))
    return o, r


def ask(note, o, r, name):
    from explainer import chat
    q = f"""You are checking ONE specific past complaint on a dental marketing video template "{name}".
The dentist (the client) wrote this note at t={note['t']}s about an EARLIER version of OUR video (Arabic):
«{note['text']}»
You get frames of OUR CURRENT version around that time (labelled OURS t=..), then the ORIGINAL reference video at the same times (different patient — that is expected and fine).
Check ONLY whether the specific problem described in the note is STILL visible in OURS. Ignore every other difference.
If the note asks for motion (smooth transition, rotation, zoom, something moving), judge from how the frames change over time.
Answer ONLY JSON: {{"still_present": true/false, "confidence": 0-1, "why_ar": "جملة قصيرة بالعربي"}}"""
    parts = [{"type": "text", "text": q}]
    for t, f in o: parts += [{"type": "text", "text": f"OURS t={t:.1f}s"}, {"type": "image_url", "image_url": {"url": _enc(f)}}]
    for t, f in r: parts += [{"type": "text", "text": f"ORIGINAL t={t:.1f}s"}, {"type": "image_url", "image_url": {"url": _enc(f)}}]
    err = None
    for _ in range(3):
        try:
            x = chat(parts, model=os.environ.get("REGRESS_MODEL", "google/gemini-4-argon"), mt=1500); x = x if isinstance(x, str) else json.dumps(x)
            return json.loads(x[x.find("{"):x.rfind("}") + 1])
        except BaseException as e: err = e
    return {"still_present": None, "error": str(err)[:150]}


def run(video, name, ref=None):
    """ref=None ← الفيديو cmp. بيرجع لستة: كل ملاحظة ونتيجتها."""
    res = []
    for n in notes(name):
        o, r = frames_at(video, ref, float(n["t"]))
        a = ask(n, o, r, name); res.append({"note": n["id"], "t": n["t"], "text": n["text"][:120], **a})
    return res


if __name__ == "__main__":
    for x in run(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None):
        print(f"  {x['t']}ث {'❌ رجعت' if x.get('still_present') else ('✅ مش موجودة' if x.get('still_present') is False else '؟')} ({x.get('confidence')}) — {x.get('why_ar', x.get('error', ''))} | {x['text'][:60]}")
