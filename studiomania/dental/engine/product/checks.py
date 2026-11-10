"""فحوصات بالأرقام للأخطاء اللي اتكررت (البلاي بوك: references/qa.md Q1–Q4). من غير موديل ذكاء اصطناعي.

Q1 jaw_gap        فراغ إسود بين لثة الفك المعزول وحافة الشاشة اليمين (E20 E21 E22)
Q2 teeth_drift    سنان "قبل" اتبيّضت/اتغيرت في فيديو متولد مقارنة بالصورة الحقيقية (E01)
Q3 veneer_cover   بقايا السنان القديمة الصفرا جوه/بين العدسات بعد التركيب (E02 E04)
Q4 lip_shift      خط الشفايف اتحرك بعد تركيب العدسات في نفس اللقطة (E03)

الاستخدام:
  python3 checks.py gap <video.mp4>                 ← Q1 على كل كادرات الفيديو
  python3 checks.py drift <video.mp4> <real.jpg>    ← Q2
"""
import sys, os, json, subprocess
import numpy as np, cv2
S = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/")

# ---------------- Q1: فراغ يمين الفك المعزول ----------------
def jaw_gap(bgr, dark=28, tol=3):
    """None لو الكادر مش فك معزول. وإلا: (أقصى فراغ بالبكسل، نسبة الصفوف اللي فيها فراغ).
    فك معزول = خلفية إسود في الشمال + لثة وردي ملزوقة ناحية اليمين في جزء من الصفوف على الأقل."""
    H, W = bgr.shape[:2]; g = bgr.max(2) > dark
    if g[:, :int(W * .25)].mean() > .12: return None                    # الشمال مش إسود ← مش فك معزول على خلفية سودا
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV); pink = (hsv[..., 0] > 150) & (hsv[..., 1] > 40) & (hsv[..., 2] > 90)   # لون اللثة (وردي/أحمر) — الكاست البيج بيبقى hue≈11 فمابيتحسبش
    if pink.mean() < .03: return None                                    # مفيش لثة كفاية
    rows = [y for y in range(int(H * .04), int(H * .96)) if g[y].sum() > W * .05]
    if len(rows) < H * .3: return None
    ys, xs = np.where(pink)
    if xs.mean() < W * .5: return None                                   # اللثة مش ناحية اليمين ← مش اتجاه الفك المعزول عندنا (الأطراف للشمال)
    # الفراغ بيتقاس جنب اللثة بس: صفوف جسم اللثة (من غير القفلة المنحنية عند أول/آخر القوس). أطراف القوس اللي مافيهاش لثة حقيقية بتقفل على الإسود بالتصميم (زي auto_gum)
    pr = np.where(pink[:, int(W * .5):].sum(1) > W * .03)[0]
    if len(pr):
        R = max(3, int(H * .07)); rows = [y for y in rows if pr.min() + R <= y <= pr.max() - R]
        if not rows: return 0, 0.0
    xr = np.array([np.where(g[y])[0][-1] for y in rows]); gap = (W - 1) - xr
    bad = gap > tol
    return int(gap.max()), float(bad.mean())

def video_gaps(path, fps=10, w=360, min_px=6, min_rows=.04):
    """كل الكادرات (fps) اللي فيها فك معزول وفيه فراغ يمين. بيرجع [(الثانية، أقصى فراغ بالبكسل على عرض w، نسبة الصفوف)]."""
    cap = cv2.VideoCapture(path); sfps = cap.get(cv2.CAP_PROP_FPS) or 30; W0 = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); out = []; i = 0; nxt = 0.0
    while True:
        ok, f = cap.read()
        if not ok: break
        t = i / sfps; i += 1
        if t + 1e-6 < nxt: continue
        nxt += 1 / fps; f = cv2.resize(f, (w, int(w * f.shape[0] / f.shape[1])))
        r = jaw_gap(f)
        if r and r[0] >= min_px and r[1] >= min_rows: out.append((round(t, 2), r[0], round(r[1], 3)))
    # كادر واحد لوحده = حركة خروج مقصودة أو مشهد فني (مش فراغ). الفراغ الحقيقي بيفضل كادرين ورا بعض على الأقل (أقصر حالة حقيقية: 4 كادرات)
    keep = [g for i, g in enumerate(out) if any(abs(g[0] - h[0] - d) < .06 for h in out for d in (-1 / fps, 1 / fps))]
    return keep

def half_left(path):   # فيديو المقارنة cmp: بتاعنا هو النص الشمال
    o = path.replace(".mp4", "_ours_tmp.mp4")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", path, "-vf", "crop=iw/2:ih:0:0", "-an", o]); return o

# ---------------- Q2: لون سنان قبل في فيديو متولد ----------------
_DET = {}
def faces_lmk(rgb, n=2):
    import mediapipe as mp
    from mediapipe.tasks.python import vision, BaseOptions
    if n not in _DET:
        _DET[n] = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=S + "face/face_landmarker.task"), num_faces=n))
    r = _DET[n].detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))); h, w = rgb.shape[:2]
    return [np.float32([[p.x * w, p.y * h] for p in L]) for L in r.face_landmarks]

INN = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]
def teeth_stats(rgb, P):
    """(تنوّع الإضاءة جوه السنان L-std، الصفار b) لوش واحد، أو None لو البق مقفول.
    التجميل اللي الموديلات بتعمله = تنضيف البقع وتوحيد الشكل ← التنوّع بيقل، والصفار بيقل."""
    m = np.zeros(rgb.shape[:2], np.uint8); cv2.fillPoly(m, [P[INN].astype(np.int32)], 1)
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32); hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    t = (m > 0) & (hsv[..., 2] > 90) & (lab[..., 1] < 145)   # فاتح ومش وردي (مش لثة ولا شفة)
    if t.sum() < 150: return None
    return np.float32([lab[..., 0][t].std(), lab[..., 2][t].mean() - 128])

def teeth_drift(video, real_img, step=.25, std_ratio=.88, db=3.0, faces=1, bad_frac=.25):
    """سنان "قبل" في فيديو متولد مقارنة بالصورة الحقيقية (البلاي بوك Q2 / E01).
    اتظبط على فيديوهات حقيقية: اللي اترفضوا بالعين (تجميل) L-std 25.7–27.3 وصفار 13.7، والأصل 33.6 و17.0، والمقبولين 33–35 و15–22.
    فشل = (الوسيط) التنوّع < 88% من الأصل أو الصفار قل بأكتر من 3، أو أكتر من ربع الكادرات فشلت.
    faces=2 (التوأم): الكادرات اللي فيها الوشين بس، ووش القبل = اللي سنانه أصفر."""
    ref = cv2.cvtColor(cv2.imread(real_img), cv2.COLOR_BGR2RGB); Pr = faces_lmk(ref, 1)
    if not Pr: return {"pass": False, "issues": ["مش لاقي وش في الصورة الحقيقية"]}
    r0 = teeth_stats(ref, Pr[0])
    cap = cv2.VideoCapture(video); fps = cap.get(cv2.CAP_PROP_FPS) or 24; n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); rows = []
    for k in range(0, n, max(1, int(fps * step))):
        cap.set(cv2.CAP_PROP_POS_FRAMES, k); ok, f = cap.read()
        if not ok: break
        rgb = cv2.cvtColor(f, cv2.COLOR_BGR2RGB); st = [x for x in (teeth_stats(rgb, P) for P in faces_lmk(rgb, max(1, faces))) if x is not None]
        if len(st) < faces: continue
        v = max(st, key=lambda x: x[1]); rows.append((round(k / fps, 2), round(float(v[0]), 1), round(float(v[1]), 1)))
    if not rows: return {"pass": False, "ref": [round(float(x), 1) for x in r0], "frames": [], "bad": [], "issues": ["مفيش سنان باينة في الفيديو"]}
    # تنوّع قليل مع صفار أعلى من الأصل = بلور حركة/وش صغير (مش تجميل) ← مايتحسبش (اتجرّب على التوأم وهو داخل)
    fb = lambda r: (r[1] < std_ratio * r0[0] and r[2] < r0[1] + 2) or r0[1] - r[2] > db
    bad = [r for r in rows if fb(r)]; med = (float(np.median([r[1] for r in rows])), float(np.median([r[2] for r in rows])))
    run = mx = 0
    for r in rows: run = run + 1 if fb(r) else 0; mx = max(mx, run)
    ok = not fb((0, *med)) and len(bad) <= bad_frac * len(rows) and mx < 2   # كادرين ورا بعض متجمّلين (نص ثانية) = بيبان ← فشل (E01: الوسيط خبّى تبييض وهو داخل)
    iss = [] if ok else [f"السنان اتجمّلت: تنوّع البقع {med[0]:.1f} (الأصل {r0[0]:.1f})، الصفار {med[1]:.1f} (الأصل {r0[1]:.1f})، {len(bad)}/{len(rows)} كادر" + (f" — أوله عند {bad[0][0]}ث" if bad else "")]
    return {"pass": ok, "ref": [round(float(x), 1) for x in r0], "median": [round(x, 1) for x in med], "frames": rows, "bad": bad, "issues": iss}

def teeth_image(img, real_img, faces=1, std_ratio=.88, db=3.0):
    """نفس Q2 لصورة واحدة (مثلًا التوأم): سنان وش القبل (الأصفر لو فيه أكتر من وش) مقارنة بالصورة الحقيقية."""
    ref = cv2.cvtColor(cv2.imread(real_img), cv2.COLOR_BGR2RGB); r0 = teeth_stats(ref, faces_lmk(ref, 1)[0])
    rgb = cv2.cvtColor(cv2.imread(img), cv2.COLOR_BGR2RGB); st = [x for x in (teeth_stats(rgb, P) for P in faces_lmk(rgb, faces)) if x is not None]
    if not st: return {"pass": False, "issues": ["مفيش سنان باينة"]}
    v = max(st, key=lambda x: x[1]); ok = not ((v[0] < std_ratio * r0[0] and v[1] < r0[1] + 2) or r0[1] - v[1] > db)
    return {"pass": ok, "ref": [round(float(x), 1) for x in r0], "got": [round(float(x), 1) for x in v],
            "issues": [] if ok else [f"سنان القبل اتجمّلت: تنوّع البقع {v[0]:.1f} (الأصل {r0[0]:.1f})، الصفار {v[1]:.1f} (الأصل {r0[1]:.1f})"]}

# ---------------- Q3 + Q4: تركيب العدسات على وش القبل ----------------
def veneer_cover(vb_rgb, contours, op_mask, erode=6, max_old=.06):   # الحد 6%: العدسة نفسها فيها دفا طبيعي عند العنق (3–4%)، والعيب الحقيقي 40%+
    """جوه حدود كل عدسة (متآكلة شوية من الحافة) وجوه فتحة الشفايف: نسبة البكسلات الصفرا/البني القديمة."""
    hsv = cv2.cvtColor(vb_rgb, cv2.COLOR_RGB2HSV); old = (hsv[..., 0] >= 8) & (hsv[..., 0] <= 30) & (hsv[..., 1] > 70) & (hsv[..., 2] > 60)
    res = {}
    for k, c in contours.items():
        m = np.zeros(op_mask.shape, np.uint8); cv2.fillPoly(m, [np.int32(c)], 1); m = cv2.erode(m, np.ones((erode, erode), np.uint8)) & (op_mask > .5)
        if m.sum() < 50: continue
        res[int(k)] = round(float(old[m > 0].mean()), 3)
    bad = {k: v for k, v in res.items() if v > max_old}
    return {"pass": not bad, "per_tooth": res, "issues": [f"سنة {k}: {v:.0%} من مساحتها لون سنة قديمة" for k, v in bad.items()]}

LIP = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308]   # الشفة العليا + زوايا البق
def lip_shift(before_rgb, after_rgb, max_frac=.015):
    """نقط الشفة العليا قبل وبعد تركيب العدسات في نفس اللقطة لازم تفضل مكانها (الحد = 1.5% من عرض البق؛ أقل من كده = دوشة النقط)."""
    a, b = faces_lmk(before_rgb, 1), faces_lmk(after_rgb, 1)
    if not a or not b: return {"pass": False, "issues": ["مش لاقي الوش"]}
    max_px = max_frac * float(np.linalg.norm(a[0][61] - a[0][291]))
    d = np.linalg.norm(a[0][LIP] - b[0][LIP], axis=1); s = float(np.median(d))
    return {"pass": s <= max_px, "median_px": round(s, 2), "max_px": round(float(d.max()), 2), "issues": [] if s <= max_px else [f"خط الشفايف اتحرك {s:.1f} بكسل"]}

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "gap":
        p = sys.argv[2]; src = half_left(p) if "cmp_" in os.path.basename(p) else p
        g = video_gaps(src)
        print(json.dumps({"frames_with_gap": len(g), "worst": sorted(g, key=lambda x: -x[1])[:5], "seconds": sorted({int(t) for t, _, _ in g})}, ensure_ascii=False))
    elif cmd == "drift":
        r = teeth_drift(sys.argv[2], sys.argv[3], faces=int(sys.argv[4]) if len(sys.argv) > 4 else 1); print(json.dumps({k: r.get(k) for k in ("pass", "ref", "median", "issues")}, ensure_ascii=False))
