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
def components(mask_path, shape):
    m = cv2.resize(cv2.imread(mask_path, 0), (shape[1], shape[0]), interpolation=cv2.INTER_NEAREST)
    m = (m > 200).astype(np.uint8); m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
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
def label(img, comps):
    # بنكبّر الصورة الأول (لـ1600) وبعدين نرسم الحدود والأرقام بمقاس مناسب لحجم السنة: في صورة صغيرة (مقصوصة من الوش)
    # الأرقام كانت بتغطي السنان كلها والموديل مايعرفش يرقّم الفك التحتاني
    s = 1600 / max(img.shape[:2]); v = cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC)
    mw = float(np.median([t["w"] for t in comps])) * s if comps else 60; fs = max(.5, min(1.6, mw / 70)); th = max(1, int(fs * 3))
    for i, t in enumerate(comps):
        cv2.polylines(v, [(t["c"] * s).astype(np.int32)], True, (0, 255, 255), max(1, int(fs * 2)))
        cv2.putText(v, str(i), (int(t["cx"] * s - 10 * fs), int(t["cy"] * s + 10 * fs)), 0, fs, (0, 0, 255), th)
    ok, b = cv2.imencode('.jpg', v, [cv2.IMWRITE_JPEG_QUALITY, 90])
    d = chat([{"type": "text", "text": LABEL}, {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(b.tobytes()).decode()}}], model="google/gemini-2.5-pro", mt=8000)
    for i, t in enumerate(comps): t["fdi"] = int(d["labels"].get(str(i), 0))
    return [t for t in comps if t["fdi"]], d
def analyze(src, mask, cache):
    img = cv2.imread(src); comps = components(mask, img.shape)
    if os.path.exists(cache):
        lab = json.load(open(cache))
        for i, t in enumerate(comps): t["fdi"] = lab[str(i)]
        teeth = [t for t in comps if t["fdi"]]
    else:
        teeth, d = label(img, comps); json.dump({str(i): t.get("fdi", 0) for i, t in enumerate(comps)}, open(cache, "w"))
    return img, teeth
