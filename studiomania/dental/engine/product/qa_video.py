"""فلتر الجودة للفيديو النهائي: بيقارن الفيديو بتاعنا بالفيديو الأصلي (الستاندرد) قبل ما يتسلّم للعميل.

فحوصات بالأرقام (من غير موديل):
  1) المدة = مدة الأصل (فرق ≤ 0.3ث)
  2) توقيت القطعات: كل قطعة في الأصل لازم يقابلها قطعة عندنا في نفس اللحظة تقريبًا (±0.3ث)
  3) حواف سودا: كادر فيه شريط إسود على الجنب/فوق/تحت والأصل مافيهوش في نفس اللحظة
  4) رعشة: اهتزاز سريع رايح جاي في الكادر أكتر من الأصل بكتير (الأصل أحيانًا فيه هزة كاميرا مقصودة، فبنقارن بيه)
  5) كادرات فاضية/متجمدة: لقطة ثابتة تمامًا أكتر من اللي في الأصل
  Q1–Q4 (checks.py) + Q5–Q8 (motion.py): اتجاه اللفة/الزووم زي الأصل، تشويه، فلاشات، حدة لقطات السنان
فحص بالموديل (Gemini): لوحة (بتاعنا | الأصل) لكل ثانية + لستة الأخطاء العامة (ERRORS_CHECKLIST أ→ز)
  → كل مشكلة بالثانية + درجة من 10.

النتيجة: <out>/qa_<name>.json فيها pass/score/issues، والقالب مايتسلّمش غير لو عدّى.
الاستخدام: python3 qa_video.py <فيديونا.mp4> <اسم القالب aXX> [--no-ai]"""
import sys, os, re, json, io, base64, subprocess
S = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/")
sys.path.insert(0, S + "xpl")
import cv2, numpy as np
from PIL import Image, ImageDraw


sys.path.insert(0, S + "product")
def ref_of(name):
    src = open(S + "tpl/T.py").read(); m = re.findall(r'@T\("%s",\s*"([^"]+)"' % name, src)
    return S + f"up/{m[-1]}/in/v.mp4"


def dur(p): return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True).stdout)


def frames(p, fps=10, w=270):
    """كل الكادرات بمعدل ثابت ومقاس صغير (للتحليل)."""
    cap = cv2.VideoCapture(p); src_fps = cap.get(cv2.CAP_PROP_FPS) or 30; out, i, nxt = [], 0, 0.0
    while True:
        ok, f = cap.read()
        if not ok: break
        t = i / src_fps
        if t >= nxt - 1e-6: out.append((t, cv2.resize(f, (w, int(w * f.shape[0] / f.shape[1]))))); nxt += 1 / fps
        i += 1
    return out


def cuts(fr, thr=.45):
    """قطعة = فرق كبير في توزيع الألوان بين كادرين ورا بعض."""
    res, prev = [], None
    for t, f in fr:
        h = cv2.calcHist([cv2.cvtColor(f, cv2.COLOR_BGR2HSV)], [0, 1], None, [24, 16], [0, 180, 0, 256]); cv2.normalize(h, h)
        if prev is not None and cv2.compareHist(prev, h, cv2.HISTCMP_BHATTACHARYYA) > thr: res.append(round(t, 2))
        prev = h
    return res


def black_edges(f, frac=.03, lvl=6):
    """حافة سودا = حشو إسود صافي (من تكبير/تحريك طلّع برا الصورة) بحافة حادة: الشريط إسود ومستوي، واللي جنبه من جوه فيه صورة.
    الخلفيات الغامقة المقصودة (تصميم على إسود) مش بتتحسب لأن اللي جنبها من جوه غامق برضه."""
    g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32); H, W = g.shape; b = max(2, int(min(H, W) * frac))
    sides = (("فوق", g[:b], g[b:3 * b]), ("تحت", g[-b:], g[-3 * b:-b]), ("شمال", g[:, :b], g[:, b:3 * b]), ("يمين", g[:, -b:], g[:, -3 * b:-b]))
    return [n for n, s, inn in sides if s.mean() < lvl and s.std() < 3 and inn.mean() > 35]


def shift(a, b):
    ga, gb = [np.float32(cv2.cvtColor(x, cv2.COLOR_BGR2GRAY)) for x in (a, b)]
    (dx, dy), _ = cv2.phaseCorrelate(ga, gb); return dx, dy


def jitter(fr, cs):
    """رعشة = تغيّر اتجاه الحركة كتير (رايح جاي) في حركة صغيرة، لكل ثانية — بعيد عن القطعات."""
    per = {}
    for (t0, a), (t1, b), (t2, c) in zip(fr, fr[1:], fr[2:]):
        if any(abs(t1 - x) < .25 for x in cs): continue
        d1 = np.array(shift(a, b)); d2 = np.array(shift(b, c))
        flip = float(np.sum((np.sign(d1) != np.sign(d2)) & (np.abs(d1) > .4) & (np.abs(d2) > .4)))
        per.setdefault(int(t1), []).append(flip)
    return {k: float(np.mean(v)) for k, v in per.items()}


def frozen(fr, cs, min_len=.0):
    """كل اللقطات المتجمدة (مفيش أي حركة): [(المدة، البداية)] من الأطول للأقصر."""
    segs, cur, start = [], 0.0, 0.0
    for (t0, a), (t1, b) in zip(fr, fr[1:]):
        if np.abs(a.astype(np.int16) - b.astype(np.int16)).mean() < .35:
            if cur == 0: start = t0
            cur += t1 - t0
        else:
            if cur > min_len: segs.append((cur, start))
            cur = 0.0
    if cur > min_len: segs.append((cur, start))
    return sorted(segs, reverse=True) or [(0.0, 0.0)]


def sheet(fr_o, fr_r, T, w=200):
    tiles = []
    def at(fr, t): return min(fr, key=lambda x: abs(x[0] - t))[1]
    for i in range(int(T)):
        t = i + .5; o, r = at(fr_o, t), at(fr_r, t)
        h = int(w * o.shape[0] / o.shape[1]); p = Image.new("RGB", (2 * w + 4, h + 18), (40, 40, 40))
        p.paste(Image.fromarray(cv2.cvtColor(cv2.resize(o, (w, h)), cv2.COLOR_BGR2RGB)), (0, 18)); p.paste(Image.fromarray(cv2.cvtColor(cv2.resize(r, (w, h)), cv2.COLOR_BGR2RGB)), (w + 4, 18))
        ImageDraw.Draw(p).text((4, 2), f"{t:.1f}s  OURS | ORIGINAL", fill=(255, 220, 0)); tiles.append(p)
    cols = 6; rows = (len(tiles) + cols - 1) // cols; tw, th = tiles[0].size; sh = Image.new("RGB", (tw * cols, th * rows))
    for k, p in enumerate(tiles): sh.paste(p, ((k % cols) * tw, (k // cols) * th))
    return sh


def rules():
    t = open(S + "ERRORS_CHECKLIST.md").read(); return t.split("# ملاحظات خاصة بكل قالب")[0][:9000]


def template_notes(name):
    t = open(S + "ERRORS_CHECKLIST.md").read(); return "\n".join(l for l in t.splitlines() if re.search(r"\b%s\b" % name, l))[:3000]


def ai_judge(fo, fr, T, name, step=1.0):
    """المراجعة بالموديل: كل ثانية صورتين منفصلتين عليهم اسم واضح (OURS / ORIGINAL) — مش لوحة واحدة، علشان مايلخبطش بينهم."""
    from explainer import chat
    def at(frs, t): return min(frs, key=lambda x: abs(x[0] - t))[1]
    def enc(f):
        im = Image.fromarray(cv2.cvtColor(f, cv2.COLOR_BGR2RGB)); im.thumbnail((300, 540)); b = io.BytesIO(); im.save(b, "JPEG", quality=80); return base64.b64encode(b.getvalue()).decode()
    q = f"""You are the strict final reviewer of a dental marketing video template "{name}".
For each second you get TWO separate images: first "OURS t=..s" (our recreation with OUR patient), then "ORIGINAL t=..s" (the reference video with a DIFFERENT patient).
Different patients/faces between OURS and ORIGINAL is EXPECTED and correct — never report it. Our video must recreate the original's shot type, camera move, timing and graphics.
Rules (Arabic) every video must pass:
{rules()}
Notes specific to this template:
{template_notes(name)}
How to judge teeth direction: look on which side of the teeth the GUM / lips / nose are. Same side in OURS and ORIGINAL = direction matches (do not report).
Before/after: yellow/stained = BEFORE, white uniform = AFTER; originals often alternate, only report when clearly wrong for the whole scene.
Only use "high" when you are sure and it is clearly visible in OURS. Do not guess about motion between seconds.
Answer ONLY JSON: {{"score": 1-10, "pass": true/false, "issues": [{{"t": seconds, "severity": "high|medium|low", "issue_ar": "وصف قصير بالعربي"}}]}}
Inside JSON strings never use double quotes. "t" must be ONE number."""
    parts = [{"type": "text", "text": q}]
    t = .5
    while t < T:
        parts += [{"type": "text", "text": f"OURS t={t:.1f}s"}, {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + enc(at(fo, t))}},
                  {"type": "text", "text": f"ORIGINAL t={t:.1f}s"}, {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + enc(at(fr, t))}}]
        t += step
    err = None
    for _ in range(3):
        try:
            r = chat(parts, model="google/gemini-2.5-pro", mt=6000); x = r if isinstance(r, str) else json.dumps(r); return json.loads(x[x.find("{"):x.rfind("}") + 1])
        except BaseException as e: err = e
    raise RuntimeError(str(err))


def _t(v):   # الوقت ممكن يرجع "5-7" أو "5s": ناخد أول رقم
    if v is None or isinstance(v, (int, float)): return v
    m = re.search(r"[\d.]+", str(v)); return float(m.group()) if m else None


SEAT_TEMPLATES = {"a04", "a07", "a33", "a34"}   # بيستخدموا seat_on_face (العدسات بتقعد على وش القبل)
def check(ours, name, ai=True, out_dir=None):
    ref = ref_of(name); out_dir = out_dir or os.path.dirname(ours); issues = []
    do, dr = dur(ours), dur(ref)
    if abs(do - dr) > .3: issues.append({"t": None, "severity": "high", "issue_ar": f"المدة {do:.1f}ث والأصل {dr:.1f}ث"})
    fo, fr = frames(ours), frames(ref); co, cr = cuts(fo), cuts(fr)
    missed = [c for c in cr if not any(abs(c - x) <= .3 for x in co)]
    extra = [c for c in co if not any(abs(c - x) <= .3 for x in cr)]
    for c in missed:   # القطعات المتجمعة في الأصل (فلاشات سريعة) بتتحسب ملاحظة صغيرة بس
        burst = any(0 < abs(c - x) <= .6 for x in cr)
        issues.append({"t": c, "severity": "low" if burst else "medium", "issue_ar": "في الأصل " + ("فلاشات/قطعات سريعة" if burst else "قطعة/انتقال") + " هنا وعندنا لأ"})
    for c in extra: issues.append({"t": c, "severity": "low", "issue_ar": "عندنا قطعة مش موجودة في الأصل"})
    def at(frs, t): return min(frs, key=lambda x: abs(x[0] - t))[1]
    be = {}
    for t, f in fo[::5]:
        e = black_edges(f)
        if e and not black_edges(at(fr, t)): be.setdefault(int(t), set()).update(e)
    for t, e in sorted(be.items()): issues.append({"t": t, "severity": "high", "issue_ar": "حافة سودا: " + "، ".join(sorted(e))})
    jo, jr = jitter(fo, co), jitter(fr, cr); base = np.median(list(jr.values()) or [0])
    for t, v in sorted(jo.items()):
        if v > max(.6, 2.5 * base + .3) and v > jr.get(t, 0) + .4: issues.append({"t": t, "severity": "high", "issue_ar": "رعشة/اهتزاز في الكادر أكتر من الأصل"})
    zr = frozen(fr, cr)[0][0]
    for zo, zt in frozen(fo, co):
        if zo > zr + 1.0: issues.append({"t": round(zt, 1), "severity": "medium", "issue_ar": f"لقطة متجمدة {zo:.1f}ث من هنا (الأصل أقصاه {zr:.1f}ث)"})
    # البلاي بوك Q1 (E20/E21/E22): فراغ إسود يمين الفك المعزول — على كل الكادرات
    from checks import video_gaps
    gp = video_gaps(ours)
    for sec in sorted({int(t) for t, _, _ in gp}):
        w = max((g for t, g, _ in gp if int(t) == sec)); issues.append({"t": sec, "severity": "high", "issue_ar": f"فراغ إسود بين اللثة وحافة الشاشة اليمين (لحد {w} بكسل من 360)"})
    # Q16–Q20 (checks3, جولة المعرض 11): فراغ في كادر مخلوط، رعشة كادر واحد، اتجاه الخروج، ترتيب قبل/بعد، مكان الابتسامة
    try:
        from checks3 import run_all as r11
        for i in r11(ours, ref, name=name): issues.append({k: i[k] for k in ("t", "severity", "issue_ar")})
    except Exception as e: issues.append({"t": None, "severity": "medium", "issue_ar": f"فحوصات Q16–Q20 ماشتغلتش: {str(e)[:120]}"})
    # Q3 + Q4 (E02/E03/E04): تركيب العدسات على وش القبل — القوالب اللي فيها seat_on_face
    if name in SEAT_TEMPLATES and os.path.exists(S + "tpl/out/vb_check.json"):
        vb = json.load(open(S + "tpl/out/vb_check.json"))
        for i in vb["veneer_cover"]["issues"] + vb["lip_shift"]["issues"]: issues.append({"t": None, "severity": "high", "issue_ar": "تركيب العدسات: " + i})
    # Q5–Q8 (motion.py): حركة الكاميرا مقارنة بالأصل + التشويه + الفلاشات + حدة لقطات السنان القريبة
    import motion as MO
    po, pr = MO.profile(fo, co), MO.profile(fr, cr)
    # اللفة العكس = يسقّط (اتجرّب). الزووم العكس = متوسط (الذوبان بين مشهدين بيلخبطه). الناقص = تنبيه، ومتجمّع في فترات
    mm = MO.motion_match(po, pr, min(do, dr)); runs = []
    for t, k, kind, *_ in sorted(mm, key=lambda x: (x[1], x[2], x[0])):
        if runs and runs[-1][1] == k and runs[-1][2] == kind and t - runs[-1][3] <= 1.0: runs[-1][3] = t
        else: runs.append([t, k, kind, t])
    for t0, k, kind, t1 in sorted(runs):
        what = "لفة" if k == "rot" else "زووم"; span = f" (لحد {t1 + 1:.1f}ث)" if t1 > t0 else ""
        if kind == "عكس": issues.append({"t": t0, "severity": "high" if k == "rot" else "medium", "issue_ar": f"{what} عكس اتجاه الأصل{span} (E160)"})
        else: issues.append({"t": t0, "severity": "low", "issue_ar": f"في الأصل {what} هنا وعندنا مش موجود/ضعيف{span} — راجع (E161 E167)"})
    for t in MO.flash_issues(fo, co, fr, cr): issues.append({"t": t, "severity": "medium", "issue_ar": "تبديل بقطع حاد رايح جاي (فلاش) والأصل مافيهوش — التحول يبقى ناعم (E151 E33)"})
    fo2, fr2 = frames(ours, fps=2, w=540), frames(ref, fps=2, w=540)
    for t, sv, rv in MO.sharp_issues(fo2, fr2)[0]: issues.append({"t": t, "severity": "medium", "issue_ar": f"لقطة السنان القريبة مش حادة ({sv} والأصل {rv}) — زووم على صورة صغيرة (E109)"})
    for t, dev in MO.shear_issues(fo2, fr2, min_frames=2): issues.append({"t": t, "severity": "high", "issue_ar": f"الصورة ممطوطة/مايلة (حوافها مش زوايا قايمة، {dev}°) (E32)"})
    # Q9 (checks2.lint_templates): كود القالب نفسه — عامية على الشاشة، قلب/منظور من غير سبب، كاست عليه لثة
    from checks2 import lint_templates
    for i in lint_templates():
        if f"({name})" in i["where"] or "tl.py" in i["where"]: issues.append({"t": None, "severity": "high", "issue_ar": f"الكود {i['where']}: {i['issue_ar']} ({i['err']})"})
    # Q12: تحذيرات وقت الريندر (qa_warn في T.py): الفكين المتقابلين مقصوصين/لازقين وغيرها
    lg = S + f"tpl/out/R_{name}.log"
    if os.path.exists(lg):
        for ln in sorted(set(l for l in open(lg, errors="ignore") if l.startswith("QA_WARN"))):
            _, code, msg = ln.strip().split(" ", 2); issues.append({"t": None, "severity": "high", "issue_ar": f"وقت الريندر: {msg} ({code})"})
    rep = {"name": name, "ours": ours, "ref": ref, "duration": [round(do, 2), round(dr, 2)], "cuts_ours": co, "cuts_ref": cr,
           "cut_match": round(1 - len(missed) / max(1, len(cr)), 2)}
    if ai:
        sp = os.path.join(out_dir, f"qa_{name}_sheet.jpg"); sheet(fo, fr, min(do, dr)).save(sp, quality=85)
        try:
            j = ai_judge(fo, fr, min(do, dr), name); rep["ai_score"] = j.get("score"); issues += [dict(x, src="ai", t=_t(x.get("t"))) for x in j.get("issues", [])]
        except BaseException as e: rep["ai_error"] = str(e)[:200]
        # Q13: كل ملاحظة قديمة للطبيب على القالب ده بتتسأل تاني (استشاري: gemini-4-argon على 31 ملاحظة — مسك 31/31 من النسخ الغلط، وعدّى 22/31 من المصلّحة)
        try:
            from regress import run as regress_run
            for x in regress_run(ours, name, ref=ref):
                if x.get("still_present"): issues.append({"t": x["t"], "severity": "medium", "src": "ai", "issue_ar": f"ملاحظة قديمة ممكن تكون رجعت: «{x['text'][:70]}» — {x.get('why_ar', '')}"})
        except BaseException as e: rep["regress_error"] = str(e)[:200]
    # ملاحظات الموديل استشارية: اتجرّبت ونصها تقريبًا كان غلط (مش بيشوف الحركة بين الثواني)، فبتتعرض للمراجعة ومش بتسقّط الفيديو لوحدها
    review = [i for i in issues if i.get("src") == "ai"]; issues = [i for i in issues if i.get("src") != "ai"]
    rep["review"] = sorted(review, key=lambda i: i.get("t") or 0)
    high = [i for i in issues if i.get("severity") == "high"]
    score = 10 - 2.5 * len(high) - .8 * sum(i.get("severity") == "medium" for i in issues) - .2 * sum(i.get("severity") == "low" for i in issues)
    rep.update(score=round(max(0, score), 1), passed=(not high and score >= 7), issues=sorted(issues, key=lambda i: (i["t"] is None, i["t"] or 0)))
    json.dump(rep, open(os.path.join(out_dir, f"qa_{name}.json"), "w"), ensure_ascii=False, indent=1)
    return rep


if __name__ == "__main__":
    r = check(sys.argv[1], sys.argv[2], ai="--no-ai" not in sys.argv)
    print(f"{r['name']}: {'عدّى' if r['passed'] else 'ماعدّاش'} — {r['score']}/10 — تطابق القطعات {r['cut_match']}")
    for i in r["issues"]: print(f"  [{i['severity']}] {i['t'] if i['t'] is not None else '-'}ث: {i['issue_ar']}")
    if r.get("review"): print("  ملاحظات للمراجعة (من الموديل، محتاجة تأكيد):")
    for i in r.get("review", []): print(f"    - {i.get('t')}ث: {i.get('issue_ar')}")
