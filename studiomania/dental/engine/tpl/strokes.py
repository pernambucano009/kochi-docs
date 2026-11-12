"""أدوات الحركة الأوتوماتيك من الأصل (E452 E454 E458): القالب مابيكتبش اتجاه ولا توقيت بإيده.

1) Stroke — أداة بتحط/بتشيل لون على السنان (حمض، بوند، مية):
   - بتقرا الأصل في نافذة المشهد: البكسلات اللي لونها (أزرق/أصفر) بتظهر أو بتختفي كادر ورا كادر،
     ومن حركة مركزها بتطلع **الاتجاه** (يمين←شمال أو العكس) و**التوقيت** (بداية ونهاية).
   - الصبغة على السنان بتتفرد/بتتشال بنفس الاتجاه والتوقيت، والأداة سنها ماشية على حافة اللون بالظبط.
   - override_dir: لو الطبيب طلب اتجاه غير الأصل (مسجّل في الكود كاستثناء مقصود).
2) BeforeAfter — تحول قبل←بعد (أو العكس) جوه لقطة: التوقيت من تغير لون السنان في الأصل (checks3.morphs).

النتايج بتتحفظ في tpl/out/strokes_cache.json (الأصل ثابت) عشان مابتتحسبش كل ريندر.
"""
import os, json, numpy as np, cv2
from PIL import Image

_HERE = os.path.dirname(os.path.abspath(__file__)); _CACHE = os.path.join(_HERE, "out", "strokes_cache.json")
COLORS = {"blue": lambda h, s, v: (h > 95) & (h < 130) & (s > 90) & (v > 80),
          "yellow": lambda h, s, v: (h > 18) & (h < 35) & (s > 120) & (v > 120)}


def _load():
    try: return json.load(open(_CACHE))
    except Exception: return {}


def _save(c):
    os.makedirs(os.path.dirname(_CACHE), exist_ok=True); json.dump(c, open(_CACHE, "w"), indent=1)


def _frames(path, t0, t1, fps=10, w=360):
    cap = cv2.VideoCapture(path); sf = cap.get(cv2.CAP_PROP_FPS) or 30; out = []; i = 0; nxt = t0
    while True:
        ok, f = cap.read()
        if not ok: break
        t = i / sf; i += 1
        if t < t0 - 1e-6: continue
        if t > t1: break
        if t + 1e-6 < nxt: continue
        nxt += 1 / fps; out.append((t, cv2.resize(f, (w, int(w * f.shape[0] / f.shape[1])))))
    return out


def analyze_stroke(ref, t0, t1, color, kind="add"):
    """من الأصل: {"dir": +1 شمال←يمين / -1 يمين←شمال، "start", "end" (ثواني من بداية النافذة)} لصبغة بتتحط (add) أو بتتشال (remove)."""
    key = f"{os.path.basename(os.path.dirname(os.path.dirname(ref)))}|{t0:.2f}|{t1:.2f}|{color}|{kind}"
    c = _load()
    if key in c: return c[key]
    fr = _frames(ref, t0, t1); pts = []; prev = None; k5 = np.ones((5, 5), np.uint8)
    for t, f in fr:
        hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV); m = COLORS[color](hsv[..., 0], hsv[..., 1], hsv[..., 2])
        m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, k5) > 0
        if prev is not None:
            ch = (m & ~prev) if kind == "add" else (prev & ~m)
            if ch.sum() > m.size * .0008:
                xs = np.where(ch)[1]; pts.append((t - t0, xs.mean() / m.shape[1], ch.sum()))
        prev = m
    if len(pts) < 2: res = {"dir": 1, "start": 0.0, "end": max(.5, t1 - t0), "ok": False}
    else:
        P = np.array(pts); w = P[:, 2] / P[:, 2].max(); keep = w > .15; P = P[keep]
        slope = np.polyfit(P[:, 0], P[:, 1], 1, w=P[:, 2] / P[:, 2].max())[0] if len(P) >= 2 else 0
        res = {"dir": 1 if slope >= 0 else -1, "start": float(P[0, 0]), "end": float(max(P[-1, 0], P[0, 0] + .3)), "ok": True}
    c[key] = res; _save(c); return res


class Stroke:
    """صبغة + أداة ماشيين مع بعض. xs = (x أول سنة، x آخر سنة) على الشاشة من الشمال لليمين، y(x) = خط السنان."""
    def __init__(s, ref, t0, t1, color, kind="add", override_dir=None, why=""):
        s.a = analyze_stroke(ref, t0, t1, color, kind); s.kind = kind
        s.dir = override_dir if override_dir else s.a["dir"]; s.why = why   # override = طلب الطبيب (استثناء مقصود)
        s.t_start, s.t_end = s.a["start"], s.a["end"]

    def p(s, t):
        """تقدم الصبغة 0←1 بتوقيت الأصل."""
        u = np.clip((t - s.t_start) / max(.2, s.t_end - s.t_start), 0, 1); return float(u * u * (3 - 2 * u))

    def tint(s, upper_tint, col, alpha, t):
        """فلتر الصبغة لـ retract_face: بيتفرد (add) أو بيتشال (remove) في نفس الاتجاه."""
        p = s.p(t)
        if s.kind == "add": return upper_tint(col, p, alpha, from_right=(s.dir < 0))
        return upper_tint(col, 1 - p, alpha, from_right=(s.dir > 0))   # الشيل بيبدأ من ناحية البداية، فاللي فاضل في الناحية التانية

    def edge_x(s, t, X0, X1):
        """مكان حافة اللون على الشاشة دلوقتي."""
        p = s.p(t); return X0 + (X1 - X0) * p if s.dir > 0 else X1 - (X1 - X0) * p

    def place(s, im, sprite, t, X0, X1, yfun, FH, tip=None, tilt=8.0, dy=0.0, enter=.35, leave=.3, fw=None):
        """بيرسم الأداة: داخلة من تحت قبل البداية، سنها (أعلى نقطة في الصورة، أو tip) على حافة اللون، بتميل مع الاتجاه، وبتخرج لتحت بعد النهاية."""
        x = s.edge_x(t, X0, X1); y = float(yfun(x)) + dy
        e_in = np.clip((t - (s.t_start - enter)) / enter, 0, 1); e_out = np.clip((t - s.t_end) / leave, 0, 1)
        y += FH * .6 * (1 - e_in * e_in * (3 - 2 * e_in)) + FH * .6 * (e_out * e_out * (3 - 2 * e_out))
        ang = -s.dir * tilt * (1 + .6 * s.p(t))   # بتميل ناحية ما هي ماشية
        e = sprite.rotate(ang, resample=Image.BICUBIC, expand=True); a = np.array(e.split()[3])
        if tip is None:
            ys, xs = np.where(a > 60); i = ys.argmin(); tx, ty = xs[i], ys[i]
        else:   # نقطة السن في الصورة الأصلية ← بعد اللف
            c0 = np.array([sprite.width / 2, sprite.height / 2]); v = np.array(tip) - c0; th = np.radians(ang)
            R = np.array([[np.cos(th), np.sin(th)], [-np.sin(th), np.cos(th)]]); tx, ty = R @ v + np.array([e.width / 2, e.height / 2])
        b = im.convert("RGBA"); b.paste(e, (int(x - tx), int(y - ty)), e); return b.convert("RGB"), (x, y)


def analyze_ba(ref, t0, t1):
    """تحول قبل/بعد جوه اللقطة في الأصل: {"start","end","to":"after"|"before"} أو None."""
    key = f"{os.path.basename(os.path.dirname(os.path.dirname(ref)))}|{t0:.2f}|{t1:.2f}|ba"
    c = _load()
    if key in c: return c[key]
    import sys; sys.path.insert(0, os.path.join(os.path.dirname(_HERE), "product")); import checks3
    fr = checks3.read(ref, 10, t0=t0, t1=t1); ms = checks3.morphs(fr)
    res = None
    if ms:
        a, b, d = max(ms, key=lambda m: abs(m[2])); res = {"start": a - t0, "end": b - t0, "to": "after" if d < 0 else "before"}
    c[key] = res; _save(c); return res


class BeforeAfter:
    """لقطة بتتحول قبل↔بعد بتوقيت الأصل. before(t)/after(t) بيرجعوا الكادر؛ blend = أداة المزج (بتملا اللثة قبل المزج)."""
    def __init__(s, ref, t0, t1, default=("after", None)):
        s.a = analyze_ba(ref, t0, t1)

    def p(s, t):
        """0 = قبل، 1 = بعد."""
        if not s.a: return 1.0
        u = np.clip((t - s.a["start"]) / max(.3, s.a["end"] - s.a["start"]), 0, 1); u = float(u * u * (3 - 2 * u))
        return u if s.a["to"] == "after" else 1 - u

    def frame(s, t, before, after, blend):
        p = s.p(t)
        if p <= 0: return before(t)
        if p >= 1: return after(t)
        return blend(before(t), after(t), p)
