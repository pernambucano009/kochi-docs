"""أداة اللقطات التوضيحية: سكريبت الدكتور ← خطة لقطات (الدكتور بوشه / لقطة توضيحية ثلاثية الأبعاد / صورة من حالاته) ← توليد اللقطات ← فلتر الجودة."""
import sys, os, json, base64, subprocess, concurrent.futures as cf, httpx
from pathlib import Path
sys.path.insert(0, '../gen'); from at import run, get, upload, K
sys.path.insert(0, ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/../../backend")); import clipqa

LLM = "https://api.atlascloud.ai/v1/chat/completions"
def chat(parts, model="google/gemini-3.8-flash", mt=6000, fallback=True, extra=None):
    """fallback=False: الموديل ده بس (للتأكيد بموديل تاني: لو وقع مايترجعش بإجابة موديل غيره من غير ما نعرف)."""
    import time, random
    err = None
    for m in ((model, "google/gemini-2.5-pro") if fallback else (model,)):
        for att in range(5):   # 429 (ضغط/طلبات كتير في نفس الوقت): نستنى ونحاول تاني بدل ما نفشل على طول
            try:
                r = httpx.post(LLM, headers={"Authorization": f"Bearer {K}"}, timeout=300,
                               json={"model": m, "messages": [{"role": "user", "content": parts}], "temperature": .3, "max_tokens": mt, "response_format": {"type": "json_object"}, **(extra or {})})
                if r.status_code in (401, 403): raise SystemExit("ATLAS_AUTH " + r.text[:200])   # المفتاح غلط/منتهي: مفيش فايدة نحاول تاني
                if r.status_code == 429:
                    msg = r.text[:300]; err = RuntimeError(msg)
                    if "balance" in msg.lower() and att >= 3: raise SystemExit("ATLAS_LOW_BALANCE " + msg)   # الرصيد خلص: مفيش فايدة نكمّل
                    time.sleep(2 * (att + 1) + random.random() * 2); continue
                if r.status_code >= 500 or "choices" not in r.text[:4000]:   # Atlas واقع/مزدحم أو رد من غير إجابة: نحاول تاني
                    err = RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}"); time.sleep(3 * (att + 1) + random.random() * 2); continue
                jr = r.json(); t = jr["choices"][0]["message"]["content"].strip()
                try:   # تسجيل التكلفة (gen/costlog.py)
                    import sys as _s, os as _o; _s.path.insert(0, _o.path.join(_o.path.dirname(_o.path.abspath(__file__)), "..", "gen")); import costlog
                    u = jr.get("usage") or {}; costlog.tokens("llm", m, u.get("prompt_tokens"), u.get("completion_tokens"))
                except Exception: pass
                return json.loads(t[t.find("{"): t.rfind("}") + 1])
            except SystemExit: raise
            except Exception as e: err = e; break
    raise SystemExit(f"chat failed: {err}")

STYLE = ("Photorealistic 3D medical animation still, vertical 9:16, clean premium dental education style like a high-end clinic animation, "
         "anatomically accurate, dark teal-charcoal studio background with soft vignette, soft cinematic lighting, ultra detailed, no text, no labels, no watermark, no people's faces.")
PLAN = """You plan short vertical dental education videos where the REAL dentist films himself talking. Specialty: {spec}.
Split the script into lines, keeping the dentist's exact wording (do not rewrite). For each line choose ONE kind:
- "doctor": the dentist says it to the camera (hooks, opinions, reassurance, personal experience, call to action). The first and last lines MUST be doctor.
- "explainer": an invisible process/anatomy that a 3D medical animation makes clear (inside the tooth, bone, nerve, how a procedure works). Never show a treatment RESULT on a real patient.
- "case": a place where the dentist's own real case photo (before/after, x-ray) would be stronger; he must supply it.
Rules: 30-50% explainer, never more than 2 explainers in a row, a doctor line every ~10 seconds at least.
For every explainer give: "still" (English prompt for ONE clear 3D still, describe the cross-section/anatomy and exactly what is shown, consistent camera, no text) and "motion" (English, what moves in 5 seconds, static camera, ONE simple action).
For every case give "ask_ar": what photo to ask the dentist for, in Modern Standard Arabic.
Return JSON: {{"title_ar": "...", "shots": [{{"n": 1, "text": "<exact line>", "kind": "doctor|explainer|case", "why_ar": "<short reason in MSA>", "still": "...", "motion": "...", "ask_ar": "..."}}]}}
SCRIPT:
{script}"""

def look(images, prompt):
    parts = [{"type": "text", "text": prompt}] + [{"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(Path(p).read_bytes()).decode()}} for p in images]
    return chat(parts, mt=2000)

def make(shot, d: Path, tries=2):
    n = shot["n"]; still = d / f"s{n}.png"; log = []
    if not still.exists(): get(run("Image", {"model": "google/nano-banana-pro/text-to-image-developer", "prompt": shot["still"] + " " + STYLE, "aspect_ratio": "9:16", "resolution": "2k"}, t=900), still)
    su = upload(still)
    for k in range(tries):
        clip = d / f"x{n}_{k}.mp4"
        if not clip.exists():
            get(run("Video", {"model": "bytedance/seedance-2.0-mini/image-to-video", "image": su, "prompt": shot["motion"] + " Static camera, smooth realistic 3D medical animation, no text.",
                              "duration": 5, "resolution": "720p", "generate_audio": False}, t=1800), clip)
        w = d / f"qa{n}_{k}"; w.mkdir(exist_ok=True)
        v = clipqa.review("ffmpeg", clip, still, shot["motion"], look, w)
        log.append({"try": k + 1, "pass": v["pass"], "score": v["score"], "reason_ar": v["reason_ar"], "issues": v["issues"][:3]})
        if v["pass"]: return {"n": n, "clip": str(clip), "qa": log}
    return {"n": n, "clip": None, "qa": log}

if __name__ == "__main__":
    d = Path(sys.argv[1]); spec = sys.argv[2]; script = Path(sys.argv[3]).read_text()
    pf = d / "plan.json"
    plan = json.loads(pf.read_text()) if pf.exists() else chat([{"type": "text", "text": PLAN.format(spec=spec, script=script)}])
    pf.write_text(json.dumps(plan, ensure_ascii=False, indent=1))
    for s in plan["shots"]: print(s["n"], s["kind"], "|", s["text"][:60])
    ex = [s for s in plan["shots"] if s["kind"] == "explainer"]
    with cf.ThreadPoolExecutor(6) as pool: res = list(pool.map(lambda s: make(s, d), ex))
    (d / "result.json").write_text(json.dumps(res, ensure_ascii=False, indent=1))
    for r in res: print("shot", r["n"], "OK" if r["clip"] else "REJECTED", [(q["try"], q["score"], q["pass"]) for q in r["qa"]])

REVISE = """A dentist reviewed one 3D explainer shot of his video and asked for a change. Rewrite the shot so it follows his request exactly, keeping everything else that he did not ask to change.
His spoken line: {text}
Current still prompt: {still}
Current motion prompt: {motion}
His request (may be Arabic): {note}
Return JSON: {{"still": "<new English still prompt>", "motion": "<new English motion prompt, static camera, ONE simple action>", "summary_ar": "<what changed, one sentence in Modern Standard Arabic>"}}"""

def revise(d: Path, n: int, note: str):
    """تعديل لقطة واحدة بطلب العميل: نكتب وصفها من جديد ونولّدها وتعدّي على الفلتر، والباقي زي ما هو."""
    pf = d / "plan.json"; plan = json.loads(pf.read_text())
    shot = next(s for s in plan["shots"] if s["n"] == n)
    new = chat([{"type": "text", "text": REVISE.format(text=shot["text"], still=shot["still"], motion=shot["motion"], note=note)}])
    shot.setdefault("history", []).append({"note": note, "still": shot["still"], "motion": shot["motion"]})
    shot["still"], shot["motion"] = new["still"], new["motion"]; v = len(shot["history"])
    vd = d / f"rev{n}_{v}"; vd.mkdir(exist_ok=True)
    r = make(dict(shot, n=n), vd)
    pf.write_text(json.dumps(plan, ensure_ascii=False, indent=1))
    rf = d / "result.json"; res = [x for x in json.loads(rf.read_text()) if x["n"] != n] + [r]; rf.write_text(json.dumps(sorted(res, key=lambda x: x["n"]), ensure_ascii=False, indent=1))
    return new["summary_ar"], r
