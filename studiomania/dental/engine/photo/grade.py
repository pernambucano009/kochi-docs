"""تدريج الألوان زي الأصل (E462): كل قالب صور ليه «ثيم ألوان» متقاس من الصورة الأصلية (أرقام بس في grades.json، من غير صور الأصل).
بنقيس على الجلد/الشفايف/اللثة (مش السنان ولا الأسود): متوسط الإضاءة L، والحرارة b (أزرق↔أصفر)، والصبغة a (أخضر↔أحمر)، وانتشار اللون (تشبع).
وبنطبق على صور الحالة نفس التحويل للقبل والبعد بالظبط (عدل)، والسنان نفسها مابتتلمسش (قناع السنان بحواف ناعمة) — مفيش تبييض ولا تصفير.
"""
import os, json, numpy as np, cv2
HERE = os.path.dirname(os.path.abspath(__file__)); GR = os.path.join(HERE, "grades.json")
REFS_ALIAS = {"p10": "p09", "p11": "p08", "p12": "p08"}   # قوالب مشتقة بتاخد ثيم الأصل بتاعها
REFS = {"p01": "ref10", "p02": "ref11", "p03": "ref15", "p04": "ref07", "p05": "ref08", "p06": "ref04", "p07": "ref05", "p08": "ref03", "p09": "ref06"}


def _sel(lab):
    L, A, B = lab[..., 0], lab[..., 1] - 128, lab[..., 2] - 128; ch = np.hypot(A, B)
    teeth = (L > 150) & (ch < 30)
    return (L > 45) & ~teeth & (ch > 6)


def stats(imgs, masks=None):
    px = []
    for i, a in enumerate(imgs):
        lab = cv2.cvtColor(a, cv2.COLOR_RGB2LAB).astype(np.float32); s = _sel(lab)
        if masks is not None and masks[i] is not None: s &= ~masks[i]
        px.append(lab[s])
    P = np.concatenate(px)
    if len(P) < 500: return None
    A, B = P[:, 1] - 128, P[:, 2] - 128; C = np.hypot(A, B)
    return {"L": float(P[:, 0].mean()), "Ls": float(P[:, 0].std()), "a": float(A.mean()), "b": float(B.mean()),
            "C": float(C.mean()), "h": float(np.degrees(np.arctan2(B.mean(), A.mean()))),
            "sa": float(P[:, 1].std()), "sb": float(P[:, 2].std()), "n": int(len(P))}


def build():
    out = {}
    for t, r in REFS.items():
        a = cv2.cvtColor(cv2.imread(os.path.join(HERE, "refs", r + ".jpg")), cv2.COLOR_BGR2RGB)
        a = a[:int(a.shape[0] * .86)]   # من غير الفوتر بتاع الأصل
        out[t] = stats([a])
    for t, src in REFS_ALIAS.items(): out[t] = out[src]
    json.dump(out, open(GR, "w"), indent=1); return out


def load(tid):
    try: return json.load(open(GR)).get(tid)
    except Exception: return None


TEETH_WB = .4   # E462: نص الطريق تقريبًا — لا تبييض ولا تصفير، بس السنان في نفس جو الصورة


def mouth_only(m):
    """قناع السنان ممكن يمسك حتت فاتحة في الجلد بعيد عن البق — بنسيب بس الحتت اللي في منطقة البق (حوالين أكبر حتة)."""
    if m is None or not m.any(): return m
    n, lb, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8))
    i = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])); x, y, w, h = st[i, :4]
    X0, X1 = x - w * .25, x + w * 1.25; Y0, Y1 = y - h * .6, y + h * 1.6
    keep = [j for j in range(1, n) if st[j, cv2.CC_STAT_AREA] > st[i, cv2.CC_STAT_AREA] * .002 and
            X0 <= st[j, 0] + st[j, 2] / 2 <= X1 and Y0 <= st[j, 1] + st[j, 3] / 2 <= Y1]
    return np.isin(lb, keep)


def apply(imgs, masks, tgt, k=1.0):
    """نفس التحويل لكل الصور (E462/E469): الإضاءة والكونتراست، ودرجة اللون (hue)، والتشبع **نسبةً للإضاءة** (C/L) —
    صورة أغمق بنفس رقم التشبع بتبان مشبّعة أكتر، فالمقارنة لازم تكون بالنسبة. masks = قناع السنان (توازن أبيض بس)."""
    masks = [mouth_only(m) for m in masks]
    src = stats(imgs, masks)
    if not tgt or not src or "C" not in tgt: return imgs, None
    # الإضاءة: منحنى (gamma) على الصورة كلها — بيفتح الدرجات النص (جلد/شفايف) وبالكاد بيلمس الفاتح (السنان)، زي التعريض في الكاميرا.
    # ده اللي بيدي الإحساس «الهادي» بتاع الأصل (E469)؛ نفس المنحنى للقبل والبعد.
    Ls = np.concatenate([cv2.cvtColor(a, cv2.COLOR_RGB2LAB)[..., 0][m0] for a, m0 in zip(imgs, [~mm if mm is not None else np.ones(a.shape[:2], bool) for mm in masks])]).astype(np.float32) / 255
    Ls = Ls[(Ls > .18)]
    gam = 1.0
    for g in np.linspace(.55, 1.4, 86):
        if np.mean(Ls ** g) * 255 <= tgt["L"]: gam = float(g); break
    gam = 1 + (gam - 1) * k
    dh = float(np.clip(((tgt["h"] - src["h"] + 180) % 360) - 180, -12, 12)) * k   # درجة اللون (أكتر من كده الشفايف بتبرتقن)
    Lnew = float(np.mean(Ls ** gam) * 255) if len(Ls) else src["L"]
    kc = float(np.clip((tgt["C"] / tgt["L"]) / max(src["C"] / Lnew, 1e-3), .6, 1.0))   # التشبع نسبةً للإضاءة — عمره ما بيزيد
    kc = 1 + (kc - 1) * k
    th = np.radians(dh); R = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]], np.float32)
    out = []
    for a, m in zip(imgs, masks):
        lab = cv2.cvtColor(a, cv2.COLOR_RGB2LAB).astype(np.float32)
        A0, B0 = lab[..., 1] - 128, lab[..., 2] - 128
        AB = np.stack([A0, B0], -1) @ R.T * kc
        LUT = (np.linspace(0, 1, 256) ** gam * 255).astype(np.float32)
        Lc = LUT[lab[..., 0].astype(np.uint8)]
        g = lab.copy(); g[..., 0] = Lc; g[..., 1] = AB[..., 0] + 128; g[..., 2] = AB[..., 1] + 128
        w = np.ones(a.shape[:2], np.float32)
        if m is not None:
            tw = cv2.GaussianBlur(cv2.dilate(m.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(np.float32), (0, 0), 4)
            w = 1 - tw
            # السنان: توازن أبيض بس (TEETH_WB من تحويل اللون المتوسط)، من غير تشبع ولا إضاءة — لا تبييض ولا تصفير
            mA, mB = src["a"], src["b"]; nA, nB = (np.array([mA, mB], np.float32) @ R.T * kc)
            t = lab.copy(); t[..., 0] = Lc; t[..., 1] += (nA - mA) * TEETH_WB; t[..., 2] += (nB - mB) * TEETH_WB
            rt = cv2.cvtColor(np.clip(t, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).astype(np.float32)
            a = (a * (1 - tw[..., None]) + rt * tw[..., None]).astype(np.uint8)
        dark = np.clip((lab[..., 0] - 20) / 30, 0, 1)   # الأسود يفضل أسود
        w = (w * dark)[..., None]
        r = cv2.cvtColor(np.clip(g, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).astype(np.float32)
        out.append((a * (1 - w) + r * w).astype(np.uint8))
    rep = {"gamma": round(gam, 2), "L": [round(src["L"], 1), round(Lnew, 1), round(tgt["L"], 1)], "hue": round(dh, 1), "sat": round(kc, 2)}
    return out, rep


if __name__ == "__main__":
    for k, v in build().items(): print(k, {x: round(y, 1) for x, y in v.items()})
