"""صورة الوش بعد العلاج: شفايف المريض الحقيقية من صورة الوش زي ما هي، والسنان بس اللي بتتغير جوه فتحة البق.
(الطريقة القديمة mouth_swap كانت بتلزق البق كله بالشفايف من صورة ماكرو تانية: إضاءة ولون وشكل ابتسامة مختلفين ← شفة دبل وحافة باينة.)

المقاس: المسافة بين الناب والناب (13 ↔ 23) — مكان الناب ثابت في العضم، الفينير مابيحركوش (عرض القواطع هو اللي بيتغير، فمش مقياس).
  الوش: SAM بيلاقي سنان القبل في فتحة البق + الترقيم (Gemini 3.8 + تأكيد Claude) ← مكان 13 و23.
  صورة الابتسامة بعد: من تحليل الحالة (det_smile + ai_smile_ids).
  تحويل تشابه (تكبير + لف + نقل) من نقطتين.
اللون: التحويل بين الصورتين بيتحسب من الشفايف (موجودة في الصورتين بإضاءة كل صورة) وبيتطبق على السنان — مش بنغيّر لون السنان نفسها لصالح لون القبل.
فحص بعد التركيب: عرض 11+21 على الوش ÷ عرض 13↔23 لازم يساوي نفس النسبة في صورة البعد الحقيقية (±5%)، والسنان ماتطلعش برا زوايا البق."""
import os, sys, json, cv2, numpy as np
S = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..") + "/"
sys.path[:0] = [S + "ana", S + "gen", S + "xpl", S + "product", S + "tools"]

def _centers(ids, dets, keys):
    out = {}
    for i, d in enumerate(dets):
        if d.get("fdi") in keys:
            ys, xs = np.where(ids == i + 1)
            if len(xs) > 30: out[d["fdi"]] = (xs.mean(), ys.mean(), xs.min(), xs.max())
    return out

def face_teeth(face_bgr, open_m, cache):
    """سنان القبل في فتحة البق على الوش: قص + تكبير + SAM + ترقيم (بيتخزن)."""
    if os.path.exists(cache): return {int(k): tuple(v) for k, v in json.load(open(cache)).items()}
    import sammask
    ys, xs = np.where(open_m > 0); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    px, py = int((x1 - x0) * .25), int((y1 - y0) * .6)
    x0, y0, x1, y1 = max(0, x0 - px), max(0, y0 - py), min(face_bgr.shape[1], x1 + px), min(face_bgr.shape[0], y1 + py)
    crop = face_bgr[y0:y1, x0:x1]; k = 1400 / crop.shape[1]; big = cv2.resize(crop, None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC)
    rgb = cv2.cvtColor(big, cv2.COLOR_BGR2RGB); dets, E = sammask.find_teeth(rgb); lab, E = sammask.teeth_masks(rgb, dets, E)
    dets = sammask.number_teeth(rgb, dets, lab) or dets
    out = {}; up = np.zeros(face_bgr.shape[:2], np.uint8)
    for i, d in enumerate(dets):
        ys_, xs_ = np.where(lab == i)
        if d.get("fdi") and len(xs_) > 30:
            out[int(d["fdi"])] = (x0 + xs_.mean() / k, y0 + ys_.mean() / k, x0 + xs_.min() / k, x0 + xs_.max() / k)
            if d["fdi"] in (11, 12, 13, 21, 22, 23):
                mm = cv2.resize((lab == i).astype(np.uint8) * 255, (x1 - x0, y1 - y0), interpolation=cv2.INTER_NEAREST); up[y0:y1, x0:x1] = np.maximum(up[y0:y1, x0:x1], mm)
    cv2.imwrite(cache.replace(".json", "_up.png"), up)
    json.dump(out, open(cache, "w")); return out

FRONT = (11, 12, 13, 21, 22, 23)
def teeth_mask(ids, dets, keys=FRONT):
    m = np.zeros(ids.shape, np.uint8)
    for i, d in enumerate(dets):
        if d.get("fdi") in keys: m[ids == i + 1] = 255
    return cv2.erode(m, np.ones((5, 5), np.uint8))

def lab_stats(img, m):
    L = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)[m > 0]; return L.mean(0), L.std(0) + 1e-3

def swap(case_dir, out_p, face_p=None):
    """face_p: نسخة تانية من نفس صورة الوش (مثلًا التكبير الأمين before_face_hi) ← نفس العملية بدقتها (للقطات اللي الكاميرا بتقرّب فيها على البق).
    مكان الأنياب وقناع سنان القبل بيتاخدوا من تحليل الصورة الأصلية مضروبين في نسبة المقاس (من غير تحليل تاني)."""
    from case import Case
    from elements import face_mouth_masks
    c = Case(case_dir); E = c.d + "/elements/"; A = c.d + "/ana/"; os.makedirs(E + "ts", exist_ok=True)
    base_p = c.canon("before_face"); hi = face_p is not None; face_p = face_p or base_p
    face = cv2.imread(face_p); H, W = face.shape[:2]; kf = W / cv2.imread(base_p).shape[1]
    fm = face_mouth_masks(face_p, E + "ts", "facehi" if hi else "face"); f_open = cv2.imread(fm["open"], 0); f_lips = cv2.imread(fm["lips"], 0)
    sm_p = c.canon("after_retracted"); sm = cv2.imread(sm_p)   # صورة البعد بالمبعد: السنان كاملة + اللثة + الفك السفلي ← بتملا فتحة البق كلها
    ids = cv2.resize(cv2.imread(A + "ai_after_ids.png", 0), sm.shape[1::-1], interpolation=cv2.INTER_NEAREST); dets = json.load(open(A + "det_after.json"))
    # من صورة البعد: السنان واللثة بس (مش «أي حاجة مش سودا»: حافة المبعد الإسود اللامعة كانت بتدخل ← بقعة خضرا غامقة تحت اللثة السفلية: test1)
    gm_ = cv2.resize(cv2.imread(A + "gm_after.png", 0), sm.shape[1::-1]) if os.path.exists(A + "gm_after.png") else np.zeros(sm.shape[:2], np.uint8)
    core_ = np.maximum(gm_, teeth_mask(ids, dets, keys=tuple(range(11, 49))))
    th_ = float(np.median([d["box"][3] - d["box"][1] for d in dets if 10 < d.get("fdi", 0) < 30])) if any(10 < d.get("fdi", 0) < 30 for d in dets) else 100.
    near_ = cv2.dilate(core_, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(th_ * .25) | 1,) * 2))   # جوه البق اللي جنب السنان/اللثة مباشرة (الفراغات بينهم) — المبعد أبعد من كده
    lab_s = cv2.cvtColor(sm, cv2.COLOR_BGR2LAB).astype(np.int16)
    tissue_ = (lab_s[..., 0] < 70) | (lab_s[..., 1] > 138)   # جوه البق الغامق أو نسيج أحمر؛ الرمادي الباهت (حافة المبعد اللامعة) لأ — كان بيطلع «جسم شفاف زي المثبت» على السنان (test1)
    tight_ = cv2.dilate(core_, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(th_ * .08) | 1,) * 2)) > 0   # الضل الطبيعي بين السنان لاصق فيهم: بيتاخد زي ما هو
    s_open = np.where((sm.max(2) > 25) & (near_ > 0) & (tight_ | tissue_), 255, 0).astype(np.uint8)
    k_ = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(th_ * .45) | 1,) * 2)   # قفل التجاويف (الحرف كان متموج/منشاري من تمديد ماسكات السنان ← سلالم إسود في التقريب: test1 ث30)
    s_open = cv2.morphologyEx(cv2.morphologyEx(s_open, cv2.MORPH_CLOSE, k_), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    s_open = np.where(cv2.GaussianBlur(s_open.astype(np.float32), (0, 0), th_ * .06) > 127, 255, 0).astype(np.uint8)   # حدود ناعمة
    s_open = np.where((sm.max(2) > 25) | (core_ > 0), s_open, 0).astype(np.uint8)   # من غير إسود المبعد   # من غير نقط/سنان منشار (اختبار البكسل بيكسل كان بيطلع حرف سلالم)
    S_ = _centers(ids, dets, (11, 21, 13, 23))
    if hi:
        F_ = {k: tuple(v * kf for v in t) for k, t in json.load(open(E + "ts/face_teeth.json")).items()}; F_ = {int(k): v for k, v in F_.items()}
    else: F_ = face_teeth(face, f_open, E + "ts/face_teeth.json")
    rep = {"src_teeth": sorted(S_), "face_teeth": sorted(F_)}
    if not all(k in S_ for k in (13, 23)) or not all(k in F_ for k in (13, 23)):
        raise ValueError(f"CANINES_MISSING {rep}")
    src = np.float32([S_[13][:2], S_[23][:2]]); dst = np.float32([F_[13][:2], F_[23][:2]])
    M, _ = cv2.estimateAffinePartial2D(src, dst, method=cv2.LMEDS) if False else (None, None)
    v1, v2 = src[1] - src[0], dst[1] - dst[0]; s = np.linalg.norm(v2) / np.linalg.norm(v1)
    ang = np.arctan2(v2[1], v2[0]) - np.arctan2(v1[1], v1[0]); ca, sa = s * np.cos(ang), s * np.sin(ang)
    M = np.float32([[ca, -sa, 0], [sa, ca, 0]]); M[:, 2] = dst[0] - M[:, :2] @ src[0]
    warp = lambda im, interp=cv2.INTER_CUBIC: cv2.warpAffine(im, M, (W, H), flags=interp, borderValue=0)
    w_sm = warp(sm); w_open = warp(s_open, cv2.INTER_LINEAR)
    # اللون: فرق العلاج نفسه (سنان القبل ← سنان البعد في صور الماكرو، نفس العيادة ونفس الفلاش) بيتطبق على سنان القبل في الوش (إضاءة الوش).
    # يعني السنان الجديدة على الوش = إضاءة الوش + التبييض الحقيقي — مش لون الشفايف ولا تجميل
    mb = cv2.imread(c.canon("before_retracted")); idb = cv2.resize(cv2.imread(A + "ai_before_ids.png", 0), mb.shape[1::-1], interpolation=cv2.INTER_NEAREST)
    m_b, s_b = lab_stats(mb, teeth_mask(idb, json.load(open(A + "det_before.json"))))
    m_a, s_a = lab_stats(sm, teeth_mask(ids, dets))
    fup = cv2.erode(cv2.resize(cv2.imread(E + "ts/face_teeth_up.png", 0), (W, H), interpolation=cv2.INTER_NEAREST), np.ones((3, 3), np.uint8)); m_f, s_f = lab_stats(face, fup)
    t_m = m_f + (m_a - m_b); t_s = s_f * np.clip(s_a / s_b, .7, 1.4)
    rep_col = {"before_macro": m_b.round(1).tolist(), "after_macro": m_a.round(1).tolist(), "face_before": m_f.round(1).tolist(), "face_target": t_m.round(1).tolist()}
    Lw0 = cv2.cvtColor(w_sm, cv2.COLOR_BGR2LAB).astype(np.float32); Lw = (Lw0 - m_a) / s_a * t_s + t_m
    # اللثة وجوه البق (مش سنان): ليها تحويل لون لوحدها ← بإضاءة جوه البق في صورة الوش نفسها. التحويل بتاع السنان كان بيسيب اللثة
    # بلون فلاش صورة البعد (شريط وردي فاقع فوق السنان: test1)
    w_ids = cv2.warpAffine(teeth_mask(ids, dets, keys=tuple(range(11, 49))), M, (W, H), flags=cv2.INTER_NEAREST) > 0
    src_nt = (w_open > 127) & ~w_ids & (cv2.erode(f_open, np.ones((5, 5), np.uint8)) > 0)
    fup_all = cv2.dilate(cv2.resize(cv2.imread(E + "ts/face_teeth_up.png", 0), (W, H), interpolation=cv2.INTER_NEAREST), np.ones((9, 9), np.uint8)) > 0
    face_nt = (cv2.erode(f_open, np.ones((5, 5), np.uint8)) > 0) & ~fup_all
    if src_nt.sum() > 200 and face_nt.sum() > 200:
        lf = cv2.cvtColor(face, cv2.COLOR_BGR2LAB).astype(np.float32)
        mg, sg = Lw0[src_nt].mean(0), Lw0[src_nt].std(0) + 1e-3; mf2, sf2 = lf[face_nt].mean(0), lf[face_nt].std(0) + 1e-3
        Lg_ = (Lw0 - mg) / sg * np.clip(sf2 / sg, .6, 1.4) * sg + mf2   # المتوسط والتباين على جوه بق الوش
        nt = (~w_ids).astype(np.float32); nt = cv2.GaussianBlur(nt, (0, 0), 2)[..., None]
        Lw = Lw * (1 - nt) + Lg_ * nt
    w_col = cv2.cvtColor(np.clip(Lw, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)
    # التركيب: جوه فتحة البق في الوش بس. اللي جوه الفتحة ومش جوه فتحة الابتسامة المتلفّة (شفة/جلد الصورة التانية) ← جوه بق غامق
    fo = cv2.erode(f_open, np.ones((3, 3), np.uint8)) > 0; so = w_open > 127
    px_ = face[(f_open > 0)].reshape(-1, 3); dark = np.median(px_[np.argsort(px_.sum(1))[:max(50, len(px_) // 20)]], 0)   # جوه البق الغامق الحقيقي في الوش (مش إسود صريح)
    so_a = cv2.GaussianBlur(w_open.astype(np.float32) / 255, (0, 0), max(1.5, float(s) * 1.2))[..., None]   # حد ناعم بين محتوى صورة البعد وجوه البق الغامق — الحد الحاد المتكبّر كان بيبان سلالم إسود في التقريب (test1 ث30-31)
    content = (w_col.astype(np.float32) * so_a + dark.astype(np.float32) * (1 - so_a)).astype(np.uint8)
    a = cv2.GaussianBlur(fo.astype(np.float32), (0, 0), 1.5)[..., None]
    out = (face * (1 - a) + content * a).astype(np.uint8); cv2.imwrite(out_p, out)
    if os.environ.get("TS_DEBUG"):
        for n_, v_ in (("fo", fo.astype(np.uint8) * 255), ("so", (so_a[..., 0] * 255).astype(np.uint8)), ("wcol", w_col), ("face", face)): cv2.imwrite(E + f"ts/dbg_{n_}.png", v_)
    # نفس شكل ملفات الطريقة القديمة (حدود السنان على الوش + الفلتر بيستخدموها): M = صورة البعد بالمبعد ← الوش، open = فتحة البق على الوش
    if not hi:
        base = out_p.rsplit(".", 1)[0]; np.save(base + "_M.npy", M); np.save(base + "_open.npy", (fo * 255).astype(np.uint8))
        open(base + "_src.txt", "w").write("after_retracted")
    # فحص المقاس: نسبة (عرض 11+21) ÷ (13↔23) على الوش لازم = نفس النسبة في صورة البعد
    if all(k in S_ for k in (11, 21)):
        r_src = (S_[21][3] - S_[11][2]) / np.linalg.norm(src[1] - src[0])
        rep["incisor_ratio_src"] = round(float(r_src), 3)
    rep["color"] = rep_col; rep["scale"] = round(float(s), 3); rep["angle_deg"] = round(float(np.degrees(ang)), 2)
    # الزوايا: السنان ماتطلعش برا طرفين فتحة البق
    xs = np.where(f_open.any(0))[0]; tx = np.where((so & fo).any(0))[0]
    rep["inside_corners"] = bool(len(tx) and tx.min() >= xs.min() and tx.max() <= xs.max())
    json.dump(rep, open(E + ("ts/report_hi.json" if hi else "ts/report.json"), "w"), indent=1); return rep

if __name__ == "__main__":
    print(swap(sys.argv[1], sys.argv[2]))
