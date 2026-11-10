"""أقنعة السنان واللثة بموديل تقسيم حقيقي (SAM 2.1 من Meta، رخصة Apache-2.0، بيشتغل على CPU) بدل موديل توليد الصور.

ليه: Nano Banana كان بيرسم القناع من جديد بمقاس تاني وبعدين بيتمط على الصورة ← الحدود مزحزحة عن السنة الحقيقية،
وده كان أصل أغلب عيوب العزل (بواقي، فراغات، هلالات). SAM بيقطع على بكسلات الصورة نفسها.

الخطوات:
  1) Gemini بيحدد مكان كل سنة باينة (مربع) — مش رسم، مجرد مكان تقريبي.
  2) SAM 2.1 بيقطع حدود كل سنة بالظبط جوه المربع بتاعها.
  3) القناع بيتكتب بنفس شكل الملفات القديمة (ai_*.png: كل سنة أبيض وبينهم خط أسود) فباقي الخط مايتغيرش.
  4) اللثة العلوية: SAM بمربع على شريط اللثة فوق السنان العلوية ← gm_*.png (سنان علوية + لثتها).
"""
import os, sys, json, base64, cv2, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + '/../xpl'); from explainer import chat
import sam21

DETECT = """Detect every individual tooth crown visible in this dental photo (upper and lower arch).
Return JSON: {"teeth": [{"box_2d": [ymin, xmin, ymax, xmax], "fdi": <FDI number>}, ...]}
- box_2d is in 0-1000 normalized coordinates of THIS image, tight around the visible crown only (no gum, no neighbour).
- FDI from the PATIENT's perspective (patient's right = image LEFT): upper right 11-18, upper left 21-28, lower left 31-38, lower right 41-48.
- One entry per tooth. Include partly visible teeth at the ends of the arch. Do not include lips, retractors or shadows."""

def detect(rgb):
    """مربع لكل سنة (بإحداثيات الصورة) + رقمها. الصورة بتتبعت بأقصى ضلع 1600."""
    H, W = rgb.shape[:2]; s = 1600 / max(H, W); v = cv2.resize(rgb, None, fx=s, fy=s, interpolation=cv2.INTER_AREA) if s < 1 else rgb
    ok, b = cv2.imencode(".jpg", cv2.cvtColor(v, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 92])
    msg = [{"type": "text", "text": DETECT}, {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(b.tobytes()).decode()}}]
    d, err = None, None
    for _ in range(3):   # الرد أحيانًا بيرجع JSON مقطوع/بايظ: نحاول تاني
        try:
            d = chat(msg, model="google/gemini-2.5-pro", mt=16000)
            if isinstance(d, dict) and d.get("teeth"): break
        except SystemExit: raise
        except Exception as e: err = e
    if not d or not d.get("teeth"): raise RuntimeError(f"TEETH_DETECT_FAILED {err}")
    out = []
    for t in d.get("teeth", []):
        y0, x0, y1, x1 = [float(q) for q in t["box_2d"]]
        if y1 <= y0 or x1 <= x0: continue
        out.append({"box": [x0 / 1000 * W, y0 / 1000 * H, x1 / 1000 * W, y1 / 1000 * H], "fdi": int(t.get("fdi") or 0)})
    return out

def find_teeth(rgb, E=None):
    """إيجاد السنان من غير موديل لغة (Gemini كان بيرجع مربعات غلط خالص): نقط على المناطق اللي لونها سنة (فاتحة وقليلة التشبع)،
    وSAM بيقطع الشكل حوالين كل نقطة، والمكرر بيتشال. الترقيم بعدين بـ Gemini على الحدود المرسومة (ده اللي بيعمله كويس)."""
    E = E or sam21.embed(rgb); H, W = rgb.shape[:2]
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.int16); hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    L, S_ = lab[..., 0], hsv[..., 1]; r = max(6, int(min(H, W) / 45)); acc = []
    def seeds(toothy, region, limit):
        toothy = cv2.morphologyEx(toothy, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) & region
        dt = cv2.distanceTransform(toothy, cv2.DIST_L2, 5)
        pk = (dt == cv2.dilate(dt, np.ones((2 * r + 1, 2 * r + 1), np.uint8))) & (dt > r * .5)
        ys, xs = np.where(pk); return toothy, sorted(zip(xs, ys), key=lambda p: -dt[p[1], p[0]])[:limit]
    def take(pts, toothy, min_tf):
        cands = []
        for (x, y) in pts:
            if any(o[y, x] for _, o in acc): continue
            m, sc = sam21.masks_from_points(E, [(float(x), float(y))])
            mb = m > .5; a = int(mb.sum())
            if a < H * W * .0008 or a > H * W * .06 or sc < .7: continue
            if mb[0].any() or mb[-1].any() or mb[:, 0].any() or mb[:, -1].any(): continue   # لازق في حافة الصورة = مبعد/شفة، مش سنة
            tf = toothy[mb].mean()
            if tf < min_tf: continue   # مش لون سنة (شفة، مبعد، لسان)
            cands.append((sc * tf, mb))
        # قناع ماسك سنتين أو أكتر مع بعض (زي ١١ و٢١ في قناع واحد): بيترفض لو جواه قناعين أصغر لوحدهم — كان بيتقبل الأول ويشيل السنة التانية كمكررة
        areas = [c[1].sum() for c in cands]
        multi = set()
        for i, (_, mi) in enumerate(cands):
            # أجزاء جوه القناع، كل جزء ≥ ٣٠٪ منه (حجم سنة، مش حتة من نفس السنة)، ومش متداخلين مع بعض
            parts = [j for j, (_, mj) in enumerate(cands) if j != i and .3 * areas[i] <= areas[j] < .8 * areas[i] and (mi & mj).sum() > .7 * areas[j]]
            sep = []
            for j in sorted(parts, key=lambda j: -areas[j]):
                if all((cands[j][1] & cands[k][1]).sum() < .2 * min(areas[j], areas[k]) for k in sep): sep.append(j)
            if len(sep) >= 2: multi.add(i)
        cands = [c for i, c in enumerate(cands) if i not in multi]
        cands.sort(key=lambda c: -c[0]); rej = []
        for sc, mb in cands:
            if any((mb & o).sum() > .3 * min(mb.sum(), o.sum()) for _, o in acc): rej.append((sc, mb)); continue
            acc.append((sc, mb))
        # قناع اتقبل وطلع ماسك سنتين (١١+٢١): لو في قناع مرفوض جواه بحجم سنة واحدة (٣٠–٧٥٪ منه) ← نقسمه لسنتين
        out = []
        for sc, mb in acc:
            a = mb.sum(); part = None
            for sc2, c in sorted(rej, key=lambda r: -r[0]):
                ca = c.sum()
                if .3 * a <= ca <= .75 * a and (c & mb).sum() > .85 * ca: part = c & mb; break
            if part is not None:
                rest = mb & ~cv2.dilate(part.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
                n, lb, st, _ = cv2.connectedComponentsWithStats(rest.astype(np.uint8))
                rest = (lb == 1 + int(np.argmax(st[1:, 4]))) if n > 1 else rest
                if rest.sum() >= .25 * a: out += [(sc, part), (sc, rest)]; continue
            out.append((sc, mb))
        acc[:] = out
    # جولة ١: السنان الفاتحة الواضحة
    t1, p1 = seeds(((L > np.percentile(L, 70)) & (S_ < 110) & (lab[..., 1] < 150)).astype(np.uint8), np.ones((H, W), np.uint8), 160)
    take(p1, t1, .45)
    # جولة ٢: السنان اللي في الضل عند أطراف القوس (أغمق) — جنب السنان اللي اتلقت بس
    if acc:
        U = np.zeros((H, W), bool)
        for _, o in acc: U |= o
        ys, xs = np.where(U); bw = xs.max() - xs.min(); bh = ys.max() - ys.min()
        reg = np.zeros((H, W), np.uint8); reg[max(0, int(ys.min() - .15 * bh)):int(ys.max() + .15 * bh), max(0, int(xs.min() - .3 * bw)):int(xs.max() + .3 * bw)] = 1
        reg[U] = 0
        Lt = np.percentile(L[U], 10) - 25   # أغمق شوية من أغمق السنان اللي اتلقت
        t2, p2 = seeds(((L > Lt) & (S_ < 130) & (lab[..., 1] < 150)).astype(np.uint8), reg, 80)
        take(p2, t2, .5)
    if acc:   # قطع صغيرة جدًا جنب الشفة/المبعد (أصغر من ربع سنة عادية) مش سنان
        med = float(np.median([o.sum() for _, o in acc])); acc = [(sc, o) for sc, o in acc if o.sum() >= .25 * med]
    dets = []
    for sc, mb in acc:
        ys_, xs_ = np.where(mb); dets.append({"box": [float(xs_.min()), float(ys_.min()), float(xs_.max()), float(ys_.max())], "fdi": 0, "score": float(sc), "mask": mb})
    return dets, E

CONFIRM_MODEL = "anthropic/claude-opus-5.5"
NUMBERING_LOG = []   # نتيجة التأكيد لكل صورة (analysis بيكتبها في ملف الحالة)
def number_teeth(rgb, dets, lab):
    """الترقيم: نفس طريقة teethlib.label (حدود مرسومة + رقم لكل سنة ← Gemini بيقول FDI)."""
    from teethlib import label
    comps = []
    for i, d in enumerate(dets):
        p = (lab == i).astype(np.uint8)
        if p.sum() < 50: continue
        c = cv2.findContours(p, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0]; c = max(c, key=cv2.contourArea)[:, 0]
        x, y, w, h = cv2.boundingRect(c); M = cv2.moments(p)
        comps.append({"i": i, "x": x, "y": y, "w": w, "h": h, "cx": M["m10"] / M["m00"], "cy": M["m01"] / M["m00"], "c": c})
    import threading, copy
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR); conf = {}
    def _claude():   # Claude بيرقّم لوحده بالتوازي (تأكيد): مفيش رجوع لموديل تاني لو وقع
        for _ in range(2):   # رد فاضي/مش JSON أحيانًا: محاولة تانية
            try:
                cc = copy.deepcopy(comps); label(bgr, cc, model=CONFIRM_MODEL, fallback=False)
                conf["got"] = {t["i"]: int(t.get("fdi", 0)) for t in cc}; conf.pop("err", None); return
            except BaseException as e: conf["err"] = repr(e)[:200]
    th = threading.Thread(target=_claude); th.start()
    best = None
    for _ in range(3):   # Gemini مش ثابت: أحيانًا بيسيب فك كامل من غير أرقام ← نعيد (لحد ٣ مرات) وناخد أكتر ترقيم كامل
        for t in comps: t.pop("fdi", None)
        _, info = label(bgr, comps)
        got = {t["i"]: int(t.get("fdi", 0)) for t in comps}; n = sum(1 for v in got.values() if v)
        if best is None or n > best[0]: best = (n, got)
        if n >= .8 * len(comps): break
    th.join()
    for i, v in best[1].items(): dets[i]["fdi"] = v
    # الفك العلوي (اللي بيدخل في التحويل) لازم الموديلين يتفقوا عليه سنة سنة. لو اختلفوا: التصحيح الهندسي بيحكم والحالة بتتعلّم «محتاجة مراجعة»
    up = lambda g: {i: v for i, v in g.items() if v // 10 in (1, 2)}
    if "got" in conf:
        a, b = up(best[1]), up(conf["got"]); diff = sorted(set(a.items()) ^ set(b.items()))
        NUMBERING_LOG.append({"agree": not diff, "diff": [list(x) for x in diff][:20]})
        if diff: print("numbering: Gemini/Claude disagree on upper teeth:", diff[:10])
    else: NUMBERING_LOG.append({"agree": None, "err": conf.get("err")}); print("numbering: Claude confirm failed:", conf.get("err"))
    nf = fix_numbers(dets, {t["i"]: (t["cx"], t["cy"]) for t in comps})
    if nf: print(f"numbering: fixed {nf} by geometry")
    seen = {}
    for i, d in enumerate(dets):   # رقم مكرر: نسيب أكبر واحدة بس
        if d["fdi"] and d["fdi"] in seen:
            j = seen[d["fdi"]]
            if (lab == i).sum() > (lab == j).sum(): dets[j]["fdi"] = 0; seen[d["fdi"]] = i
            else: d["fdi"] = 0
        elif d["fdi"]: seen[d["fdi"]] = i
    return dets

def fix_rows(dets, centers):
    """سنة سفلية متسمية علوية (srv: سنة تحت الناب اتسمت 14 وطلعت طايرة في العزل): السنان العلوية كلها بتبدأ من خط اللثة.
    المرجع = القواطع العلوية (11/12/21/22): لو بداية السنة (حدها العلوي) أوطى من بداية القواطع بأكتر من نص طول القاطع ← دي سنة سفلية.
    بنحوّلها للربع السفلي في نفس الجنب (والترقيم جوه الربع بيتظبط بعدها). بيرجع عدد التصحيحات."""
    inc = [d for d in dets if d["fdi"] // 10 in (1, 2) and d["fdi"] % 10 in (1, 2) and "box" in d]
    if len(inc) < 2: return 0
    top = np.median([d["box"][1] for d in inc]); h = np.median([d["box"][3] - d["box"][1] for d in inc])
    fixes = 0
    for i, d in enumerate(dets):
        if d["fdi"] // 10 in (1, 2) and d["fdi"] % 10 >= 3 and "box" in d and d["box"][1] > top + h * .5:
            d["fdi"] = (4 if d["fdi"] // 10 == 1 else 3) * 10 + d["fdi"] % 10; d["row_fixed"] = True; fixes += 1
    return fixes

def fix_numbers(dets, centers):
    """تصحيح الترقيم بالهندسة: Gemini أحيانًا بيعكس الجنب (يمين/شمال المريض) في فك كامل.
    لكل فك: لو متوسط مكان سنان «يمين المريض» (1x فوق، 4x تحت) طلع على يمين الصورة بدل شمالها ← الجنبين اتعكسوا فنبدّلهم.
    وجوه كل ربع: الأرقام لازم تزيد كل ما نبعد عن المنتصف (المنتصف = الحد بين الربعين حسب ترقيم Gemini نفسه). بيرجع عدد التصحيحات."""
    fixes = fix_rows(dets, centers)
    for qL, qR in ((1, 2), (4, 3)):
        L = [i for i, d in enumerate(dets) if d["fdi"] // 10 == qL and i in centers]; R = [i for i, d in enumerate(dets) if d["fdi"] // 10 == qR and i in centers]
        if L and R and np.mean([centers[i][0] for i in L]) > np.mean([centers[i][0] for i in R]):   # الجنبين معكوسين
            for i in L: dets[i]["fdi"] = qR * 10 + dets[i]["fdi"] % 10
            for i in R: dets[i]["fdi"] = qL * 10 + dets[i]["fdi"] % 10
            fixes += len(L) + len(R); L, R = R, L
        if not (L and R): continue
        mid = (max(centers[i][0] for i in L) + min(centers[i][0] for i in R)) / 2
        for ids, q in ((L, qL), (R, qR)):
            ids = sorted(ids, key=lambda i: abs(centers[i][0] - mid)); nums = sorted(dets[i]["fdi"] % 10 for i in ids)
            for k in range(1, len(nums)):
                if nums[k] <= nums[k - 1]: nums[k] = nums[k - 1] + 1
            for i, n in zip(ids, nums):
                v = q * 10 + min(n, 8)
                if dets[i]["fdi"] != v: dets[i]["fdi"] = v; fixes += 1
    return fixes

def teeth_masks(rgb, dets, E=None):
    """قناع لكل سنة من SAM. التداخل بين سنتين: البكسل للسنة اللي احتمالها أعلى."""
    E = E or sam21.embed(rgb); H, W = rgb.shape[:2]
    if dets and all("mask" in d for d in dets):   # الأقنعة جاهزة من خطوة الإيجاد (SAM نفسه): من غير قص تاني بالمربع (كان بيضيّع سنة)
        lab = np.full((H, W), -1, np.int32)
        for i in np.argsort([d["mask"].sum() for d in dets])[::-1]: lab[dets[i]["mask"]] = i   # الأصغر فوق في التداخل
        return lab, E
    pad = lambda b: [max(0, b[0] - 4), max(0, b[1] - 4), min(W - 1, b[2] + 4), min(H - 1, b[3] + 4)]
    res = sam21.masks_from_boxes(E, [pad(d["box"]) for d in dets])
    P = np.stack([p for p, _ in res]) if res else np.zeros((0, H, W), np.float32)
    for i, d in enumerate(dets):   # برا المربع (بهامش) مش السنة دي
        x0, y0, x1, y1 = [int(v) for v in d["box"]]; mx = int(.15 * (x1 - x0)) + 6; my = int(.15 * (y1 - y0)) + 6
        keep = np.zeros((H, W), bool); keep[max(0, y0 - my):y1 + my, max(0, x0 - mx):x1 + mx] = True; P[i][~keep] = 0
        d["score"] = res[i][1]
    lab = np.full((H, W), -1, np.int32)
    if len(P):
        best = P.argmax(0); on = P.max(0) > .5; lab[on] = best[on]
    return lab, E

def refine_zoom(rgb, dets, lab, zoom_min=2.0):
    """تكبير لكل سنة: SAM بيصغّر أي صورة لـ1024 قبل ما يقطع، فالسنة الصغيرة بتاخد بكسلات قليلة. بنقص منطقة حوالين كل سنة
    ونقطعها لوحدها (السنة بتملا الـ1024) ← الحدود أدق. (مش upscale بالذكاء الاصطناعي: ده بيخترع تفاصيل عند الحواف)"""
    H, W = rgb.shape[:2]; P = np.zeros((len(dets), H, W), np.float32)
    for i, d in enumerate(dets):
        x0, y0, x1, y1 = d["box"]; w, h = x1 - x0, y1 - y0; s = max(w, h) * 1.6
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        X0, Y0 = int(max(0, cx - s / 2)), int(max(0, cy - s / 2)); X1, Y1 = int(min(W, cx + s / 2)), int(min(H, cy + s / 2))
        crop = rgb[Y0:Y1, X0:X1]
        if 1024 / max(crop.shape[:2]) < zoom_min: P[i][lab == i] = 1; continue   # السنة كبيرة أصلًا: مفيش مكسب
        Ec = sam21.embed(crop)
        (pm, sc), = sam21.masks_from_boxes(Ec, [[x0 - X0 - 3, y0 - Y0 - 3, x1 - X0 + 3, y1 - Y0 + 3]])
        P[i, Y0:Y1, X0:X1] = pm; d["score_zoom"] = sc
    out = np.full((H, W), -1, np.int32); on = P.max(0) > .5; out[on] = P.argmax(0)[on]
    return out

def write_ai(lab, path):
    """نفس شكل ai_*.png القديم: كل سنة أبيض، وبين كل سنتين خط أسود (عشان components تفصلهم)."""
    m = (lab >= 0).astype(np.uint8) * 255
    edges = np.zeros_like(m)
    for i in np.unique(lab[lab >= 0]):
        one = (lab == i).astype(np.uint8); edges |= (one - cv2.erode(one, np.ones((3, 3), np.uint8)))
    m[edges > 0] = 0; cv2.imwrite(path, m)

def gum_mask(rgb, dets, lab, E, path):
    """السنان العلوية + اللثة اللي فوقها (للعزل). SAM بمربع على شريط اللثة، والمتصل بالسنان العلوية بس."""
    H, W = rgb.shape[:2]; ups = [d for i, d in enumerate(dets) if 10 < d["fdi"] < 30]
    upm = np.zeros((H, W), bool)
    for i, d in enumerate(dets):
        if 10 < d["fdi"] < 30: upm |= lab == i
    if not ups: cv2.imwrite(path, upm.astype(np.uint8) * 255); return
    hm = float(np.median([d["box"][3] - d["box"][1] for d in ups])); top = min(d["box"][1] for d in ups)
    box = [max(0, min(d["box"][0] for d in ups) - .3 * hm), max(0, top - 1.1 * hm), min(W - 1, max(d["box"][2] for d in ups) + .3 * hm), max(d["box"][1] for d in ups) + .1 * hm]
    E = E or sam21.embed(rgb)
    g, _ = sam21.masks_from_boxes(E, [box])[0]
    # احتمال SAM في اللثة الضلمة بيطلع متقطع شرايط (srv بعد: 126 خرم ← في الفيديو مستطيلات سودا اتكررت بعرض الشاشة):
    # تنعيم للاحتمال قبل القطع + قفل + أي خرم محاط باللثة/السنان من كل ناحية يتملي (جوه اللثة مفيش خلفية)
    g = cv2.GaussianBlur(g.astype(np.float32), (0, 0), max(1.5, hm * .02)) > .5
    k = max(5, int(hm * .08)) | 1; g = cv2.morphologyEx(g.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))) > 0
    g &= ~(lab >= 0)   # اللثة بس (السنان التانية مستبعدة، بما فيها السفلية)
    # SAM أحيانًا بيرجّع لثة فاضية/صغيرة جدًا (test1 بعد: القناع كان سنان بس من غير لثة ← الفك المعزول طلع سنان على إسود).
    # لو اللثة أقل من ربع شريط اللثة: اللثة بلونها (وردي) جوه الشريط فوق السنان العلوية، المتصل بالسنان بس
    bx0, by0, bx1, by1 = [int(v) for v in box]; band_area = max(1, (bx1 - bx0) * (by1 - by0))
    if g.sum() < .25 * band_area * .5:
        lab_c = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.int16)
        pink = (lab_c[..., 1] > 142) & (lab_c[..., 0] > 70)
        bandm = np.zeros((H, W), bool); bandm[by0:by1, bx0:bx1] = True
        gc = cv2.morphologyEx((pink & bandm & ~(lab >= 0)).astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        gc = cv2.morphologyEx(gc, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))) > 0
        print(f"gum_mask: SAM gum too small ({int(g.sum())} px) → colour gum ({int(gc.sum())} px)", flush=True)
        g = g | gc
    # الاتصال بالسنان بهامش صغير: خط غامق رفيع (2-3 بكسل) بين حافة اللثة وبداية السنة كان بيخلي اللثة كلها «مش متصلة» فتتشال (test1 بعد)
    upd = cv2.dilate(upm.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (max(5, int(hm * .04)) | 1,) * 2)) > 0
    n, cc = cv2.connectedComponents((g | upd).astype(np.uint8))
    ids = set(np.unique(cc[upm])) - {0}; iso = ((np.isin(cc, list(ids)) & (g | upm)) | (upd & ~(lab >= 0) & cv2.dilate(g.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool))).astype(np.uint8)
    inv = (1 - iso).astype(np.uint8); n2, cc2 = cv2.connectedComponents(inv)
    edge = set(np.unique(np.r_[cc2[0], cc2[-1], cc2[:, 0], cc2[:, -1]])) - {0}
    holes = (inv > 0) & ~np.isin(cc2, list(edge)) & ~(lab >= 0)
    iso[holes] = 1
    cv2.imwrite(path, iso * 255)

def clean_teeth_pink(rgb, lab):
    """بكسلات لثة (وردي) جوه قناع سنة عند حدودها (الحليمة بين سنتين بتتاخد مع السنة): بتتشال من القناع.
    test1 بعد: حتة لثة وردي جوه قناع 11 ← في الفيديو بقعة وردي على السنة."""
    lc = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.int16); out = lab.copy()
    for i in np.unique(lab[lab >= 0]):
        m = lab == i
        if m.sum() < 200: continue
        core = cv2.erode(m.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
        if core.sum() < 50: continue
        am = np.median(lc[..., 1][core])
        pinkp = m & (lc[..., 1] > max(am + 12, 140))
        if not pinkp.any(): continue
        n, cc = cv2.connectedComponents(pinkp.astype(np.uint8)); rim = m & ~core
        for j in range(1, n):
            comp = cc == j
            if (comp & rim).any(): out[comp] = -1   # متصل بحد السنة (مش بقعة جوه السنة نفسها)
    return out

def trim_appendages(lab):
    """زوائد رفيعة لازقة في قناع سنة (حتة من سنة سفلية أخدها SAM مع السنة الطرفية: test1 بعد ← حتة بيضا متعلقة تحت آخر سنة في الفك المعزول).
    فتح بشكل بيضاوي بعرض ~35% من عرض السنة: اللي يتشال ويبقى منفصل عن جسم السنة = زائدة."""
    out = lab.copy()
    for i in np.unique(lab[lab >= 0]):
        m = (lab == i).astype(np.uint8)
        if m.sum() < 300: continue
        xs = np.where(m.any(0))[0]; k = max(7, int(np.ptp(xs) * .35)) | 1
        body = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
        if body.sum() < .5 * m.sum(): continue
        n, cc = cv2.connectedComponents(body)
        if n > 2: body = (cc == 1 + int(np.argmax([(cc == j).sum() for j in range(1, n)]))).astype(np.uint8)
        keep = cv2.dilate(body, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k // 3 * 2 + 1,) * 2)) & m   # الحواف الطبيعية ترجع، الزائدة البعيدة لأ
        out[(m > 0) & (keep == 0)] = -1
    return out

def regen_gum(src, ids_path, det_path, gm_path):
    """قناع اللثة من جديد لحالة متحللة (من غير ما نلمس السنان ولا الترقيم)."""
    rgb = cv2.cvtColor(cv2.imread(src), cv2.COLOR_BGR2RGB); dets = json.load(open(det_path))
    ids = cv2.resize(cv2.imread(ids_path, 0), rgb.shape[1::-1], interpolation=cv2.INTER_NEAREST); lab = ids.astype(np.int32) - 1
    gum_mask(rgb, dets, lab, None, gm_path)

def make(src, ai_path, gm_path=None, det_path=None):
    rgb = cv2.cvtColor(cv2.imread(src), cv2.COLOR_BGR2RGB); NUMBERING_LOG.clear()
    if det_path and os.path.exists(det_path): dets = json.load(open(det_path)); E = None
    else: dets, E = find_teeth(rgb)
    lab, E = teeth_masks(rgb, dets, E)
    if os.environ.get("SAM_ZOOM", "1") == "1": lab = refine_zoom(rgb, dets, lab)
    if not any(d.get("fdi") for d in dets): dets = number_teeth(rgb, dets, lab)
    lab = trim_appendages(clean_teeth_pink(rgb, lab))
    write_ai(lab, ai_path)
    ids = np.zeros(lab.shape, np.uint8); ids[lab >= 0] = (lab[lab >= 0] + 1).astype(np.uint8)
    cv2.imwrite(ai_path.replace(".png", "_ids.png"), ids)   # رقم كل سنة لكل بكسل (index+1 في det) ← الترقيم من غير تقسيم وترقيم تاني
    for d in dets: d.pop("mask", None)
    if det_path: json.dump(dets, open(det_path, "w"))
    if det_path and NUMBERING_LOG:   # num_<tag>.json: هل Gemini وClaude اتفقوا على ترقيم الفك العلوي (false = الحالة محتاجة مراجعة)
        json.dump(NUMBERING_LOG[-1], open(os.path.join(os.path.dirname(det_path), "num_" + os.path.basename(det_path)[4:]), "w"))
    if gm_path: gum_mask(rgb, dets, lab, E, gm_path)
    return dets

if __name__ == "__main__": print(make(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None))
