"""مراجع Claude لفريمات العزل (Claude مباشرة لو ANTHROPIC_API_KEY موجود، وإلا عن طريق Atlas).
بيبعت الفريم كامل + 3 تكبيرات (فوق/نص/تحت) ويرجّع العيوب وأماكنها.
بنعمل مراجعتين مستقلتين، والعيب بيتحسب بس لو الاتنين اتفقوا إن فيه عيب في نفس المنطقة (أو منطقة جنبها):
ده بيقلل الإنذارات الكاذبة من غير ما يضيّع العيوب الحقيقية (اتجرب على 19 فريم معروف إجابتهم).
CLAUDE_QA=0 يقفله. CLAUDE_QA_MODEL يغيّر الموديل."""
import os, sys, json, base64, time, re, threading
import cv2, numpy as np, httpx
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "gen"))
URL = "https://api.atlascloud.ai/v1/chat/completions"
MODEL = os.environ.get("CLAUDE_QA_MODEL", "anthropic/claude-opus-5.5")
ZONES = ("top", "upper-middle", "middle", "lower-middle", "bottom")

PROMPT = """You are the final quality inspector for a dental marketing video. The image is ONE frame of an "isolated upper arch":
the patient's upper teeth and the gum above them were cut out of a real photo and placed on a pure black background,
then the whole picture was rotated 90 degrees: the biting edges of the teeth point LEFT, the gum is on the RIGHT side,
and the arch runs from the top of the frame to the bottom. Teeth may be natural (yellowish) or new white veneers.
A paying clinic will publish this, so any visible flaw is unacceptable. You get the full frame plus 3 zoomed crops (top, middle, bottom thirds).

Look carefully for cutting / compositing defects such as:
- leftovers that are not tooth or gum: bits of lip, cheek, tongue, dark mouth interior, lower teeth, shadows, brown/grey slivers along tooth edges
- holes, black spots or black lines inside the gum or inside/between teeth that do not look like the natural gap between two teeth
- pieces of tooth or gum floating, detached, cut with a hard straight edge, or a tooth chopped/missing a part
- a ghost / semi-transparent duplicate of a tooth, or two teeth overlapping unnaturally
- a crescent or band of an old tooth showing along the gum line of a new tooth, color patches/smears on a tooth that look painted
- gum with an unnatural shape: sharp spikes or bumps sticking out, jagged or stair-step edges, a gum strip missing above a tooth
Do NOT report: the natural dark gap between two front teeth, normal tooth texture/shine, natural stains on natural teeth, the black background itself.

Return ONLY JSON:
{"verdict": "clean" or "defect",
 "defects": [{"where": "<top|upper-middle|middle|lower-middle|bottom of the frame> + <teeth side (left) | gum side (right) | at the gum line>",
              "what": "<short description>", "severity": "major|minor"}]}"""

def _key():
    try: from at import K
    except Exception: K = ""
    return K or os.environ.get("ATLASCLOUD_API_KEY") or os.environ.get("ATLAS_CLOUD_API_KEY") or ""

ANT_URL = "https://api.anthropic.com/v1/messages"
def _direct():   # مفتاح Claude المباشر (حساب العميل على Anthropic) — لو موجود بيتقدّم على أطلس
    k = os.environ.get("ANTHROPIC_API_KEY", "")
    if not k:   # أو ملف المفتاح في الـ scratchpad (مش في الريبو) — للتجارب المحلية
        f = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".anthropic_key")
        if os.path.exists(f): k = open(f).read().strip()
    return k
def _ant_model(m): return m.split("/", 1)[-1].replace(".", "-")   # anthropic/claude-opus-5.5 ← claude-opus-5-5
def _post(parts, model, max_tokens=3000):
    """طلب واحد: Claude مباشرة (ANTHROPIC_API_KEY) أو أطلس. بيرجّع (status, text) — text = رد الموديل لو 200، وإلا نص الخطأ."""
    dk = _direct()
    if dk:
        content = []
        for q in parts:
            if q["type"] == "text": content.append({"type": "text", "text": q["text"]})
            else:
                u = q["image_url"]["url"]; mt, b = u[5:].split(";base64,", 1)
                content.append({"type": "image", "source": {"type": "base64", "media_type": mt, "data": b}})
        r = httpx.post(ANT_URL, timeout=300, headers={"x-api-key": dk, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                       json={"model": _ant_model(model), "max_tokens": max_tokens, "messages": [{"role": "user", "content": content}]})
        if r.status_code != 200: return (529 if r.status_code == 529 else r.status_code), r.text
        jr = r.json(); u = jr.get("usage") or {}; _cost(_ant_model(model), u.get("input_tokens"), u.get("output_tokens"), "anthropic")
        return 200, "".join(b.get("text", "") for b in jr.get("content", []) if b.get("type") == "text")
    r = httpx.post(URL, headers={"Authorization": f"Bearer {_key()}"}, timeout=300,
                   json={"model": model, "messages": [{"role": "user", "content": parts}], "max_tokens": max_tokens, "temperature": 0})
    if r.status_code != 200: return r.status_code, r.text
    jr = r.json(); u = jr.get("usage") or {}; _cost(model, u.get("prompt_tokens"), u.get("completion_tokens"), "atlas")
    return 200, jr["choices"][0]["message"]["content"]
def _cost(model, tin, tout, via):
    try:
        import costlog; costlog.tokens("review", model, tin, tout, via=via)
    except Exception: pass

def _b64(img, q=88):
    ok, b = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, q]); return "data:image/jpeg;base64," + base64.b64encode(b.tobytes()).decode()

def _bgr(im):
    if isinstance(im, str): return cv2.imread(im)
    a = np.asarray(im)
    if a.ndim == 3 and a.shape[2] == 4: a = a[..., :3]
    return cv2.cvtColor(np.ascontiguousarray(a), cv2.COLOR_RGB2BGR)   # PIL/numpy = RGB

def review(im, model=MODEL):
    """مراجعة واحدة. im = مسار صورة أو PIL/numpy (RGB). بيرجّع {verdict, defects, _sec}؛ verdict=error لو الخدمة وقعت."""
    im = _bgr(im); H, W = im.shape[:2]
    full = cv2.resize(im, (int(W * 1400 / H), 1400))
    tiles = [im[int(H * a):int(H * b)] for a, b in ((0, .38), (.31, .69), (.62, 1.0))]
    parts = [{"type": "text", "text": PROMPT}, {"type": "text", "text": "Full frame:"}, {"type": "image_url", "image_url": {"url": _b64(full)}}]
    for name, t in zip(("Zoom - top third:", "Zoom - middle third:", "Zoom - bottom third:"), tiles):
        parts += [{"type": "text", "text": name}, {"type": "image_url", "image_url": {"url": _b64(t, 92)}}]
    t0 = time.time(); err = None
    if not (_direct() or _key()): return {"verdict": "error", "defects": [], "_err": "no Claude/Atlas key", "_sec": 0}
    for att in range(4):
        try:
            st, txt = _post(parts, model)
            if st in (401, 403): return {"verdict": "error", "defects": [], "_err": "AUTH " + txt[:150], "_sec": round(time.time() - t0, 1)}
            if st != 200:
                err = txt[:200]
                if "balance" in txt.lower() or "credit balance" in txt.lower(): break   # الرصيد خلص: مفيش فايدة نعيد
                time.sleep(5 * (att + 1)); continue
            out = json.loads(re.search(r"\{.*\}", txt, re.S).group(0))
            out["_sec"] = round(time.time() - t0, 1); return out
        except Exception as e: err = repr(e)[:300]; time.sleep(3)
    return {"verdict": "error", "defects": [], "_err": err, "_sec": round(time.time() - t0, 1)}

def _zone(where):
    w = (where or "").lower()
    for i, z in sorted(enumerate(ZONES), key=lambda x: -len(x[1])):   # upper-middle قبل middle
        if z in w: return i
    return -1

def consensus(r1, r2):
    """العيوب المتفق عليها: الاتنين قالوا defect، وفيه عيب عند كل واحد في نفس المنطقة أو المنطقة اللي جنبها.
    بيرجّع defects من المراجعة الأولى اللي ليها شريك في التانية (+ وصف التانية)."""
    if r1.get("verdict") != "defect" or r2.get("verdict") != "defect": return []
    out = []
    for a in r1.get("defects", []):
        za = _zone(a.get("where"))
        for b in r2.get("defects", []):
            zb = _zone(b.get("where"))
            if za >= 0 and zb >= 0 and abs(za - zb) <= 1:
                out.append({"zone": ZONES[za], "where": a.get("where"), "what": a.get("what"), "what2": b.get("what"),
                            "severity": "major" if "major" in (a.get("severity"), b.get("severity")) else "minor"}); break
    return out

def review_frames(frames, model=MODEL, runs=2):
    """frames = {اسم: صورة}. كل فريم بيتراجع مرتين بالتوازي، وبيرجع تقرير بالمتفق عليه."""
    jobs = [(k, i) for k in frames for i in range(runs)]
    res = {}   # threads عادية مش ThreadPoolExecutor: الأخير ما ينفعش يتعمل جوه atexit (آخر الريندر)
    def go(j): res[j] = review(frames[j[0]], model)
    ths = [threading.Thread(target=go, args=(j,)) for j in jobs]
    for t in ths: t.start()
    for t in ths: t.join()
    rep = {"model": model, "frames": {}, "flagged": 0, "errors": 0}
    for k in frames:
        rs = [res[(k, i)] for i in range(runs)]
        errs = [r for r in rs if r.get("verdict") == "error"]; rep["errors"] += len(errs)
        agreed = consensus(rs[0], rs[1]) if runs >= 2 and not errs else []
        rep["frames"][k] = {"agreed": agreed, "runs": [{"verdict": r.get("verdict"), "defects": r.get("defects", []), "err": r.get("_err")} for r in rs]}
        rep["flagged"] += bool(agreed)
    rep["verdict"] = "error" if rep["errors"] and not rep["flagged"] else ("defect" if rep["flagged"] else "clean")
    return rep

if __name__ == "__main__":
    print(json.dumps(review_frames({p: p for p in sys.argv[1:]}), ensure_ascii=False, indent=1))

# ---------------- مراجعة الفيديو النهائي نفسه (مش فريمات العزل بس) ----------------
# اللي فلت قبل كده: لثة فيها مستطيلات سودا (ث14-24) وشفة دبل مايلة في لقطة التقريب (ث30) — الفيديو النهائي ماكانش بيتراجع خالص.
VPROMPT = """You are the final quality inspector for a short vertical dental marketing video that a paying clinic will publish.
You see a contact sheet of frames sampled once per second; each frame has its second number in yellow at the top-left.
Scenes may show: a patient's face, close-up macro photos of teeth, an isolated tooth arch on a black background (teeth + gum strip),
animated dental tools, graphic overlays (outlines, percentages, golden spiral, Arabic labels), before/after chips, and a clinic logo.
Report every frame that a viewer would notice as broken. Look for:
- black holes, black blocks/stripes or pixelated patches inside gum, lips, skin or teeth
- doubled/ghosted lips or teeth, a second mouth layered at an angle, visible seams or rectangular patches of a pasted image
- pieces of tooth or gum floating, chopped with straight edges, smeared or stretched
- color patches that look painted, wrong-colored areas, obvious blur islands next to sharp areas
- distorted faces or anatomy
- text or labels cut off at the frame edge, covered by an image patch, or missing letters
- rectangular or straight-edged patches of a different colour/texture, especially along the right edge next to the gum strip
- a dead/static stretch: 4 or more consecutive seconds that look essentially identical (no new overlay being drawn, no camera move, no transition) — viewers drop off; report it at its first second as "static: nothing happens for N s" with severity minor (not the final logo/end card)
Do NOT report: intended graphic overlays, intended black background behind the isolated arch, intended stylistic effects (particles, black & white analysis), natural tooth stains,
and these intended template effects: a smartphone (dark rounded frame) held over the face whose screen shows a close-up of the teeth; a glowing white vertical line sweeping across the frame between a before and an after image;
a handwritten signature at the bottom being written letter by letter (partial letters while it is being written); a natural gap between two front teeth that is in the patient's own photo. In the BEFORE close-up of the patient's natural teeth, individual teeth may differ in shade, smoothness and stain (old crowns, fillings) — that is the real photo; only report it if it has a straight-edged/pasted boundary. In a close-up photo of the open mouth, the patient's own dark lips, cheeks or retractor visible at the frame edges are part of the real photo (only report them if they show a hard straight seam or a mismatched pasted block).
Return ONLY JSON: {"verdict": "clean" or "defect", "defects": [{"second": <int>, "what": "<short description>", "severity": "major|minor"}]}"""

def _sheets(mp4, per=6, cols=3, fw=360):
    import subprocess, tempfile, glob
    td = tempfile.mkdtemp(); subprocess.run(["ffmpeg", "-loglevel", "error", "-i", mp4, "-vf", f"fps=1,scale={fw}:-2", td + "/f%04d.jpg"], check=True)
    fs = sorted(glob.glob(td + "/f*.jpg")); out = []
    for i in range(0, len(fs), per):
        ims = []
        for j, f in enumerate(fs[i:i + per]):
            im = cv2.imread(f); sec = i + j
            cv2.putText(im, f"{sec}s", (8, 34), 0, 1.0, (0, 0, 0), 5); cv2.putText(im, f"{sec}s", (8, 34), 0, 1.0, (0, 230, 255), 2); ims.append(im)
        while len(ims) % cols: ims.append(np.zeros_like(ims[0]))
        rows = [np.hstack(ims[r:r + cols]) for r in range(0, len(ims), cols)]; out.append((i, np.vstack(rows)))
    return out, len(fs)

def _vreview(img, model):
    parts = [{"type": "text", "text": VPROMPT}, {"type": "image_url", "image_url": {"url": _b64(img, 90)}}]
    t0 = time.time(); err = None
    for att in range(4):
        try:
            st, txt = _post(parts, model)
            if st != 200:
                err = txt[:200]
                if st in (401, 403) or "balance" in txt.lower(): break
                time.sleep(5 * (att + 1)); continue
            out = json.loads(re.search(r"\{.*\}", txt, re.S).group(0)); out["_sec"] = round(time.time() - t0, 1); return out
        except Exception as e: err = repr(e)[:300]; time.sleep(3)
    return {"verdict": "error", "defects": [], "_err": err}

def review_video(mp4, out_json=None, model=MODEL, runs=2):
    """كل ثانية في الفيديو النهائي (شيتات 6 فريمات)، مرتين. العيب بيتحسب لو المراجعتين قالوه في نفس الثانية (±1)."""
    sheets, n = _sheets(mp4); jobs = [(k, r) for k in range(len(sheets)) for r in range(runs)]; res = {}
    def go(j): res[j] = _vreview(sheets[j[0]][1], model)
    ths = [threading.Thread(target=go, args=(j,)) for j in jobs]
    for i in range(0, len(ths), 6):
        for t in ths[i:i + 6]: t.start()
        for t in ths[i:i + 6]: t.join()
    agreed, errors = [], 0
    for k in range(len(sheets)):
        rs = [res[(k, r)] for r in range(runs)]; errors += sum(r.get("verdict") == "error" for r in rs)
        if runs < 2 or any(r.get("verdict") == "error" for r in rs): continue
        for a in rs[0].get("defects", []):
            for b in rs[1].get("defects", []):
                try:
                    if abs(int(a.get("second")) - int(b.get("second"))) <= 1:
                        agreed.append({"second": int(a["second"]), "what": a.get("what"), "what2": b.get("what"), "severity": "major" if "major" in (a.get("severity"), b.get("severity")) else "minor"}); break
                except (TypeError, ValueError): pass
    rep = {"model": model, "seconds": n, "sheets": len(sheets), "errors": errors, "agreed": agreed,
           "verdict": "defect" if agreed else ("error" if errors else "clean"), "runs": {f"{k}_{r}": v for (k, r), v in res.items()}}
    if out_json: json.dump(rep, open(out_json, "w"), ensure_ascii=False, indent=1)
    return rep
