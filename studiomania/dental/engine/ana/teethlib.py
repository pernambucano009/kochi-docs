"""مكتبة أداة التحليل: (1) قناع بالذكاء الاصطناعي = الحدود، (2) فصل السنان الملتصقة، (3) Gemini يسمّي كل سنة برقمها = المعنى."""
import cv2, numpy as np, json, base64, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + '/../xpl'); from explainer import chat
def split_wide(lab_mask, med_w):
    """سنة عرضها كبير بزيادة = سنتين لازقين: نقصّها عند أرفع عمود في النص."""
    ys, xs = np.where(lab_mask); x0, x1 = xs.min(), xs.max(); w = x1 - x0
    if w < med_w * 1.55: return [lab_mask]
    col = lab_mask[:, x0:x1 + 1].sum(0).astype(float); lo, hi = int(w * .3), int(w * .7)
    k = lo + int(np.argmin(col[lo:hi])); 
    if col[k] > col.max() * .75: return [lab_mask]
    a = lab_mask.copy(); a[:, x0 + k:] = 0; b = lab_mask.copy(); b[:, :x0 + k + 1] = 0
    return split_wide(a, med_w) + split_wide(b, med_w)
def _valleys(sig, prom, dist):
    """أدنى نقاط محلية في إشارة (الفواصل الغامقة بين السنان): بعمق prom على الأقل، وبينها مسافة dist على الأقل."""
    out = []; n = len(sig)
    for i in range(1, n - 1):
        if sig[i] <= sig[i - 1] and sig[i] < sig[i + 1]:
            l = sig[max(0, i - dist):i].max(); r = sig[i + 1:min(n, i + dist)].max()
            if min(l, r) - sig[i] >= prom:
                if out and i - out[-1] < dist:
                    if sig[i] < sig[out[-1]]: out[-1] = i
                else: out.append(i)
    return out

def split_merged(m, img):
    """موديل القناع أحيانًا بيرجّع السنان كلها كتلة واحدة (من غير فواصل). بنفصلها من الصورة نفسها:
    خط الإطباق = أغمق صف في الكتلة (بين الفكين)، والفواصل بين السنان = أعمدة أغمق من جيرانها في كل فك."""
    H, W = m.shape; n, lab, st, _ = cv2.connectedComponentsWithStats(m); out = m.copy()
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if w <= W * .3 and h <= H * .5: continue
        blob = (lab == i)
        rp = np.array([g[r][blob[r]].mean() if blob[r].sum() > 20 else np.nan for r in range(y, y + h)]); rp = np.nan_to_num(rp, nan=np.nanmax(rp))
        k = int(h / 20) | 1; rs = np.convolve(rp, np.ones(k) / k, "same"); mid = int(h * .3); occ = y + mid + int(np.argmin(rs[mid:int(h * .8)]))
        cuts = np.zeros((H, W), np.uint8); cv2.line(cuts, (x, occ), (x + w, occ), 1, 5)
        for y0, y1 in ((y, occ), (occ, y + h)):
            sub = blob.copy(); sub[:y0] = False; sub[y1:] = False
            xs = np.where(sub.any(0))[0]
            if len(xs) < 40: continue
            x0, x1 = xs.min(), xs.max()
            cp = np.array([g[:, c][sub[:, c]].mean() if sub[:, c].sum() > 5 else np.nan for c in range(x0, x1 + 1)]); cp = np.nan_to_num(cp, nan=np.nanmax(cp))
            kk = int((x1 - x0) / 60) | 1; cs = np.convolve(cp, np.ones(kk) / kk, "same")
            for v in _valleys(cs, 4, int((x1 - x0) / 18)): cv2.line(cuts, (x0 + v, y0), (x0 + v, y1), 1, 5)
        part = (blob & (cuts == 0)).astype(np.uint8); n2, lab2, st2, _ = cv2.connectedComponentsWithStats(part)
        if n2 - 1 < 4: continue   # ماتفصلش: نسيبها (هتتشال بعدين كـ TOOBIG)
        out[blob] = 0
        for jj in range(1, n2):
            if st2[jj, 4] >= m.size * .0015: out[cv2.dilate((lab2 == jj).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0] = 1
        out[cuts > 0] = 0   # الفواصل تفضل سودا
    return out

def components(mask_path, shape, img=None):
    m = cv2.resize(cv2.imread(mask_path, 0), (shape[1], shape[0]), interpolation=cv2.INTER_NEAREST)
    m = (m > 200).astype(np.uint8); m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    if img is not None: m = split_merged(m, img)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m); H, W = m.shape; raw = []
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if a < m.size * .0015 or w > W * .3 or h > H * .5: continue
        c = cv2.findContours((lab == i).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0][0]
        if a / max(1, cv2.contourArea(cv2.convexHull(c))) < .75: continue
        raw.append((lab == i).astype(np.uint8))
    med = np.median([np.ptp(np.where(r)[1]) for r in raw]); out = []
    for r in raw:
        for p in split_wide(r, med):
            if p.sum() < m.size * .001: continue
            c = cv2.findContours(p, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0][0][:, 0]; x, y, w, h = cv2.boundingRect(c)
            M = cv2.moments(p); out.append({"x": x, "y": y, "w": w, "h": h, "area": int(p.sum()), "cx": M["m10"] / M["m00"], "cy": M["m01"] / M["m00"], "c": c})
    return sorted(out, key=lambda t: (t["cy"] > np.median([o["cy"] for o in out]), t["cx"]))
LABEL = """The image shows a frontal dental photo where each detected tooth crown is outlined and has a red index number.
Identify each index using FDI numbering from the PATIENT's perspective (patient's right side = image LEFT): upper right 11-18, upper left 21-28, lower left 31-38, lower right 41-48.
Use anatomy (central incisors are the widest front teeth, the dental midline, the labial frenum, canine shape) not just position. If an outline covers two teeth or is not a tooth, mark fdi 0.
Return JSON: {"labels": {"<index>": <fdi>, ...}, "upper_midline_between": [<index of 11>, <index of 21>]}"""
LABEL_MODEL = "google/gemini-3.8-flash"   # اتقارن على 5 حالات: أدق من gemini-2.5-pro (اللي سمّى سنة سفلية 24) وأرخص بكتير
def label(img, comps, model=LABEL_MODEL, fallback=True):
    # بنكبّر الصورة الأول (لـ1600) وبعدين نرسم الحدود والأرقام بمقاس مناسب لحجم السنة: في صورة صغيرة (مقصوصة من الوش)
    # الأرقام كانت بتغطي السنان كلها والموديل مايعرفش يرقّم الفك التحتاني
    s = 1600 / max(img.shape[:2]); v = cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC)
    mw = float(np.median([t["w"] for t in comps])) * s if comps else 60; fs = max(.5, min(1.6, mw / 70)); th = max(1, int(fs * 3))
    for i, t in enumerate(comps):
        cv2.polylines(v, [(t["c"] * s).astype(np.int32)], True, (0, 255, 255), max(1, int(fs * 2)))
        cv2.putText(v, str(i), (int(t["cx"] * s - 10 * fs), int(t["cy"] * s + 10 * fs)), 0, fs, (0, 0, 255), th)
    ok, b = cv2.imencode('.jpg', v, [cv2.IMWRITE_JPEG_QUALITY, 90])
    d = chat([{"type": "text", "text": LABEL}, {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(b.tobytes()).decode()}}], model=model, mt=4000 if model.startswith("anthropic/") else 8000, fallback=fallback)   # Claude (تأكيد): أطلس بيحاسب على الحد الأقصى كله؛ 4000 = نفس الدقة تقريبًا (اتجرب: 5/6 مطابق 100%، و1 فرق سنة ← الحالة بتتعلّم «مراجعة») بنص التمن
    for i, t in enumerate(comps): t["fdi"] = int(d["labels"].get(str(i), 0))
    return [t for t in comps if t["fdi"]], d
def from_ids(ids_path, det_path, shape):
    """سنان جاهزة من موديل التقسيم (SAM): كل سنة قناعها ورقمها من خطوة الكشف — من غير تقسيم القناع وترقيمه تاني (كان بيكرر الأرقام)."""
    ids = cv2.imread(ids_path, 0); dets = json.load(open(det_path)); H, W = shape[:2]
    if ids.shape[:2] != (H, W): ids = cv2.resize(ids, (W, H), interpolation=cv2.INTER_NEAREST)
    out = []
    for i, d in enumerate(dets):
        p = (ids == i + 1).astype(np.uint8)
        if p.sum() < ids.size * .0005 or not d.get("fdi"): continue
        n, lb, st, _ = cv2.connectedComponentsWithStats(p)
        if n > 2: p = (lb == 1 + int(np.argmax(st[1:, 4]))).astype(np.uint8)   # أكبر جزء بس
        c = cv2.findContours(p, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0][0][:, 0]; x, y, w, h = cv2.boundingRect(c); M = cv2.moments(p)
        out.append({"x": x, "y": y, "w": w, "h": h, "area": int(p.sum()), "cx": M["m10"] / M["m00"], "cy": M["m01"] / M["m00"], "c": c, "fdi": int(d["fdi"])})
    return out
def analyze(src, mask, cache):
    img = cv2.imread(src)
    ids_p = mask.replace(".png", "_ids.png"); det_p = os.path.join(os.path.dirname(mask), os.path.basename(mask).replace("ai_", "det_").replace(".png", ".json"))
    if os.path.exists(ids_p) and os.path.exists(det_p):
        teeth = from_ids(ids_p, det_p, img.shape)
        if not os.path.exists(cache): json.dump({str(i): t["fdi"] for i, t in enumerate(teeth)}, open(cache, "w"))
        return img, teeth
    comps = components(mask, img.shape, img)
    if os.path.exists(cache):
        lab = json.load(open(cache))
        for i, t in enumerate(comps): t["fdi"] = lab[str(i)]
        teeth = [t for t in comps if t["fdi"]]
    else:
        teeth, d = label(img, comps); json.dump({str(i): t.get("fdi", 0) for i, t in enumerate(comps)}, open(cache, "w"))
    return img, teeth
