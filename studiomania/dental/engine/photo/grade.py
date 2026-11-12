"""تدريج الألوان زي الأصل (E462): كل قالب صور ليه «ثيم ألوان» متقاس من الصورة الأصلية (أرقام بس في grades.json، من غير صور الأصل).
بنقيس على الجلد/الشفايف/اللثة (مش السنان ولا الأسود): متوسط الإضاءة L، والحرارة b (أزرق↔أصفر)، والصبغة a (أخضر↔أحمر)، وانتشار اللون (تشبع).
وبنطبق على صور الحالة نفس التحويل للقبل والبعد بالظبط (عدل)، والسنان نفسها مابتتلمسش (قناع السنان بحواف ناعمة) — مفيش تبييض ولا تصفير.
"""
import os, json, numpy as np, cv2
HERE = os.path.dirname(os.path.abspath(__file__)); GR = os.path.join(HERE, "grades.json")
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
    return {"L": float(P[:, 0].mean()), "a": float(P[:, 1].mean() - 128), "b": float(P[:, 2].mean() - 128),
            "sa": float(P[:, 1].std()), "sb": float(P[:, 2].std()), "n": int(len(P))}


def build():
    out = {}
    for t, r in REFS.items():
        a = cv2.cvtColor(cv2.imread(os.path.join(HERE, "refs", r + ".jpg")), cv2.COLOR_BGR2RGB)
        a = a[:int(a.shape[0] * .86)]   # من غير الفوتر بتاع الأصل
        out[t] = stats([a])
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
    """نفس التحويل لكل الصور. masks = قناع السنان لكل صورة (مابيتلمسش). بيرجع (صور، تقرير)."""
    masks = [mouth_only(m) for m in masks]
    src = stats(imgs, masks)
    if not tgt or not src: return imgs, None
    da = np.clip(tgt["a"] - src["a"], -8, 10) * k; db = np.clip(tgt["b"] - src["b"], -6, 14) * k   # التبريد الزيادة بيزرّق الضلال
    dL = np.clip(tgt["L"] - src["L"], -14, 14) * .5 * k
    ga = float(np.clip(tgt["sa"] / max(src["sa"], 1), .8, 1.2)); gb = float(np.clip(tgt["sb"] / max(src["sb"], 1), .8, 1.2))
    out = []
    for a, m in zip(imgs, masks):
        lab = cv2.cvtColor(a, cv2.COLOR_RGB2LAB).astype(np.float32)
        A0, B0 = lab[..., 1] - 128, lab[..., 2] - 128
        nA = (A0 - src["a"]) * ga + src["a"] + da; nB = (B0 - src["b"]) * gb + src["b"] + db
        g = lab.copy(); g[..., 0] = lab[..., 0] + dL * (lab[..., 0] / 255) ** .5; g[..., 1] = nA + 128; g[..., 2] = nB + 128
        w = np.ones(a.shape[:2], np.float32)
        if m is not None:
            tw = cv2.GaussianBlur(cv2.dilate(m.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(np.float32), (0, 0), 4)
            w = 1 - tw
            # السنان: توازن أبيض بس (TEETH_WB من الحرارة/الصبغة، من غير تشبع ولا إضاءة)، نفس النسبة للقبل والبعد، عشان ماتبانش زرقا جنب جلد دافي
            t = lab.copy(); t[..., 1] += da * TEETH_WB; t[..., 2] += db * TEETH_WB
            rt = cv2.cvtColor(np.clip(t, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).astype(np.float32)
            a = (a * (1 - tw[..., None]) + rt * tw[..., None]).astype(np.uint8)
        dark = np.clip((lab[..., 0] - 20) / 30, 0, 1)   # الأسود يفضل أسود
        w = (w * dark)[..., None]
        r = cv2.cvtColor(np.clip(g, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).astype(np.float32)
        out.append((a * (1 - w) + r * w).astype(np.uint8))
    rep = {"da": round(float(da), 1), "db": round(float(db), 1), "dL": round(float(dL), 1), "ga": round(ga, 2), "gb": round(gb, 2)}
    return out, rep


if __name__ == "__main__":
    for k, v in build().items(): print(k, {x: round(y, 1) for x, y in v.items()})
