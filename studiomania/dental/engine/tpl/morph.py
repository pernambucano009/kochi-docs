"""مورف حقيقي سنة سنة: حدود القبل وحدود البعد (البعد متطابق على القبل) بيتعمل لهم نفس عدد النقط، وبنحرّك الشكل
تدريجيًا من شكل القبل لشكل البعد، وكل صورة بتتشد على الشكل الوسيط بمثلثات، وبعدين بنمزج. النتيجة: السنة بتكبر/تتعدل في مكانها."""
import numpy as np, cv2
N = 72
def resample(c, n=N):
    c = np.asarray(c, np.float32); cc = np.vstack([c, c[:1]]); d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(cc, axis=0), axis=1))]
    t = np.linspace(0, d[-1], n, endpoint=False); x = np.interp(t, d, cc[:, 0]); y = np.interp(t, d, cc[:, 1]); out = np.c_[x, y]
    ctr = out.mean(0); ang = np.arctan2(out[:, 1] - ctr[1], out[:, 0] - ctr[0])
    area = np.sum(out[:, 0] * np.roll(out[:, 1], -1) - np.roll(out[:, 0], -1) * out[:, 1])   # اتجاه الدوران من مساحة الشكل كله (أول ٣ نقط كانت بتغلط عند تقعر صغير → الشكلين بعكس بعض والنص بيتكرمش لخط)
    if area < 0: out = out[::-1]; ang = ang[::-1]   # نفس الاتجاه
    k = int(np.argmin(np.abs(ang + np.pi / 2))); return np.roll(out, -k, axis=0)       # نبدأ من أعلى نقطة (نفس المرجع للشكلين)
def rig(c, margin=1.35):
    ctr = c.mean(0); ring = ctr + (c - ctr) * margin; return np.vstack([[ctr], c, ring])
TRI = []
for i in range(N):
    j = (i + 1) % N; TRI += [(0, 1 + i, 1 + j), (1 + i, 1 + N + i, 1 + j), (1 + j, 1 + N + i, 1 + N + j)]
TRI = np.array(TRI)
def warp_tri(src, dst_img, acc, s3, d3):
    r1 = cv2.boundingRect(np.float32([s3])); r2 = cv2.boundingRect(np.float32([d3]))
    if r2[2] <= 0 or r2[3] <= 0 or r1[2] <= 0 or r1[3] <= 0: return
    s_ = s3 - r1[:2]; d_ = d3 - r2[:2]; M = cv2.getAffineTransform(np.float32(s_), np.float32(d_))
    patch = cv2.warpAffine(src[r1[1]:r1[1] + r1[3], r1[0]:r1[0] + r1[2]], M, (r2[2], r2[3]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
    m = np.zeros((r2[3], r2[2]), np.float32); cv2.fillConvexPoly(m, np.int32(np.round(d_)), 1.0, 16); m = cv2.dilate(m, np.ones((3, 3), np.uint8))   # المثلثات المتجاورة ما تسيبش خط فاضي بينها (كان بيبان كشرخ غامق على السنة)
    y0, x0 = r2[1], r2[0]; y1, x1 = min(y0 + r2[3], dst_img.shape[0]), min(x0 + r2[2], dst_img.shape[1])
    if y0 < 0 or x0 < 0: return
    m = m[:y1 - y0, :x1 - x0]; patch = patch[:y1 - y0, :x1 - x0]
    dst_img[y0:y1, x0:x1] = dst_img[y0:y1, x0:x1] * (1 - m[..., None]) + patch * m[..., None]; acc[y0:y1, x0:x1] = np.maximum(acc[y0:y1, x0:x1], m)
class ShapeMorph:
    def __init__(s, B_img, A_img, cb, ca, keep=()):
        """B_img/A_img: صور float (البعد متطابق على القبل)، cb/ca: dict سنة → حدودها في نفس الإحداثيات"""
        s.keys = [k for k in cb if k in ca]
        # الفك السفلي: صورة القبل والبعد ممكن يكونوا متصورين والبق مقفول في واحدة ومفتوح في التانية (srv: القبل مقفول، البعد مفتوح)
        # ← التحويل كان بيحرّك السنان السفلية من مكانها للمكان التاني فالفك بيفتح ويقفل مع كل قلبة قبل/بعد (ث24-28).
        # التحويل بيغيّر شكل السنة بس، مش وضع الفك: سنان البعد السفلية بترجع (هي وصورتها) لمكان الفك في صورة القبل بإزاحة واحدة للفك كله
        low = [k for k in s.keys if k > 30]
        if len(low) >= 2 and not __import__("os").environ.get("MORPH_JAWMOVE"):
            d = np.median([np.asarray(cb[k], np.float32).mean(0) - np.asarray(ca[k], np.float32).mean(0) for k in low], axis=0)
            if np.linalg.norm(d) > 3:
                H0, W0 = A_img.shape[:2]; T = np.float32([[1, 0, d[0]], [0, 1, d[1]]])
                lm = np.zeros((H0, W0), np.uint8)
                for k in low: cv2.fillPoly(lm, [np.int32(np.round(ca[k]))], 255)
                lm = cv2.dilate(lm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))   # السنان السفلية بس بهامش صغير (هامش كبير كان بيسحب حتت من العلوية معاها)
                As = cv2.warpAffine(A_img, T, (W0, H0), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
                mw = cv2.GaussianBlur(cv2.warpAffine(lm, T, (W0, H0)).astype(np.float32) / 255, (0, 0), 2)[..., None]
                up = np.zeros((H0, W0), np.uint8)
                for k in s.keys:
                    if k < 30: cv2.fillPoly(up, [np.int32(np.round(ca[k]))], 255)
                mw = mw * (1 - (cv2.erode(up, np.ones((3, 3), np.uint8)) > 0)[..., None])   # مكان السنان العلوية الجديدة بالظبط يفضل من صورة البعد (من غير حلقة حواليها)
                A_img = A_img * (1 - mw) + As * mw
                ca = {k: (np.asarray(v, np.float32) + d if k > 30 else v) for k, v in ca.items()}
                s.jaw_shift = d.tolist()
        s.keys = sorted(s.keys, key=lambda k: k < 30)   # السفلية الأول والعلوية فوقها (في البق المقفول العلوية قدّام السفلية)
        s.B, s.A = B_img, A_img
        s.pb = {k: rig(resample(cb[k])) for k in s.keys}; s.pa = {k: rig(resample(ca[k])) for k in s.keys}
        # المكان اللي كانت فيه السنة القديمة ومش هتغطيه السنة الجديدة (عند اللثة غالبًا): لازم يختفي مع المورف، وإلا بيفضل هلال بيج
        # من السنة القديمة جنب اللثة. بنملاه من اللثة اللي حواليه في نفس صورة القبل (inpaint) — نفس لون اللثة، من غير صورة تانية.
        H_, W_ = B_img.shape[:2]; ob = np.zeros((H_, W_), np.uint8); oa = np.zeros_like(ob)
        for k in s.keys:
            cv2.fillPoly(ob, [np.int32(np.round(s.pb[k][1:1 + N]))], 255); cv2.fillPoly(oa, [np.int32(np.round(s.pa[k][1:1 + N]))], 255)
        U = cv2.dilate(((ob > 0) & (oa == 0)).astype(np.uint8) * 255, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
        U[cv2.erode(oa, np.ones((3, 3), np.uint8)) > 0] = 0
        if __import__("os").environ.get("ISO_NOFILL"): U[:] = 0   # للمعايرة بس (السلوك القديم: هلال السنة القديمة)
        s.U = cv2.GaussianBlur(U.astype(np.float32) / 255, (0, 0), 1.5)
        b8 = np.clip(B_img, 0, 255).astype(np.uint8)
        # المصدر لثة بس: السنان القديمة كلها جوه قناع الملء (وإلا الملء بياخد لون السنة البيج اللي جنبه ويفضل الهلال)
        Ui = cv2.dilate(np.maximum(U, ob), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
        s.Binp = cv2.inpaint(b8, Ui, 7, cv2.INPAINT_TELEA).astype(np.float32) if U.any() else B_img
        # الجزء من السنة القديمة اللي ناحية الحافة القاطعة (السنة الجديدة أقصر): مكانه مش لثة — اللي وراه في الحقيقة (السنان السفلية/جوه البق)
        # بيتاخد من صورة البعد المتطابقة نفسها. كان بيتملى من لون اللثة ← شريط وردي مسطح بين الفكين وحرف مستقيم على السنان السفلية (srv a30 ث25-28)
        if U.any() and not __import__("os").environ.get("ISO_NOINCISAL"):
            yy = np.arange(H_)[:, None]; inc = np.zeros((H_, W_), bool)
            for k in s.keys:
                ck = np.zeros_like(ob); cv2.fillPoly(ck, [np.int32(np.round(s.pb[k][1:1 + N]))], 255)
                ca_ = s.pa[k][1:1 + N]; cy = float(ca_[:, 1].mean())
                side = (yy > cy) if k < 30 else (yy < cy)   # علوية: الحافة تحت؛ سفلية: الحافة فوق
                inc |= (cv2.dilate(ck, np.ones((7, 7), np.uint8)) > 0) & side
            UI = (U > 0) & inc
            if UI.any():
                w_ = cv2.GaussianBlur(UI.astype(np.float32), (0, 0), 2.0)[..., None]
                s.Binp = s.Binp * (1 - w_) + A_img * w_
        # سنة باقية من القبل (keep) والسنة القديمة اللي قدامها كانت مغطية جزء منها: الجزء ده يتملى من السنة الباقية نفسها
        # (مش من اللثة ولا من الخلفية السودا اللي جنبها → كان بيطلع خط إسود على الضاحك)
        # السنان الباقية من القبل: ما يترسمش عليها أي حاجة من صورة البعد (هامش دمج السنة الجديدة اللي جنبها كان بيلوّن طرفها بضل البعد)
        kpm = np.zeros((H_, W_), np.uint8)
        for c in keep: cv2.fillPoly(kpm, [np.int32(np.round(c))], 255)
        s.KP = cv2.GaussianBlur(cv2.dilate(kpm, np.ones((3, 3), np.uint8)).astype(np.float32) / 255, (0, 0), 1.2)
        if __import__("os").environ.get("ISO_NOKEEPGUARD"): s.KP[:] = 0   # للمعايرة بس
        if U.any() and len(keep):
            kp = np.zeros_like(ob)
            for c in keep: cv2.fillPoly(kp, [np.int32(np.round(c))], 255)
            UK = (U > 0) & (kp > 0)
            if UK.any():
                src = cv2.erode(kp, np.ones((5, 5), np.uint8)) > 0; src &= ~UK
                if src.any():
                    mk = (~src).astype(np.uint8) * 255
                    tk = cv2.inpaint(b8, mk, 7, cv2.INPAINT_TELEA).astype(np.float32)
                    s.Binp[UK] = tk[UK]
    @staticmethod
    def _soft(shape, c):
        """منطقة الدمج = حدود السنة نفسها بهامش صغير ناعم (مش الحلقة الخارجية 1.35: كانت بتجيب لثة وظل صورة البعد حوالين السنة → تمشير على اللثة وخرم عند الضاحك)"""
        m = np.zeros(shape, np.uint8); cv2.fillPoly(m, [np.int32(np.round(c))], 255); m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
        return cv2.GaussianBlur(m.astype(np.float32) / 255, (0, 0), 2.5)
    def contour(s, k, p):
        return ((1 - p) * s.pb[k] + p * s.pa[k])[1:1 + N]
    def frame(s, prog):
        pg = prog if isinstance(prog, (int, float)) else max(prog.values() or [0]); pg = max(0.0, min(1.0, pg))
        u = (s.U * (1 - s.KP) * pg)[..., None]; out = s.B * (1 - u) + s.Binp * u   # السنة القديمة برا شكل الجديدة بتدوب في اللثة مع المورف
        for k in s.keys:
            p = prog if isinstance(prog, (int, float)) else prog.get(k, 0)
            if p <= 0: continue
            if p >= 1:   # طريق سريع: السنة خلصت تحويل
                m = s._soft(out.shape[:2], s.pa[k][1:1 + N]) * (1 - s.KP); out = out * (1 - m[..., None]) + s.A * m[..., None]; continue
            mid = (1 - p) * s.pb[k] + p * s.pa[k]
            wb = np.zeros_like(out); wa = np.zeros_like(out); ab = np.zeros(out.shape[:2], np.float32); aa = np.zeros_like(ab)
            for t in TRI:
                warp_tri(s.B, wb, ab, s.pb[k][t], mid[t]); warp_tri(s.A, wa, aa, s.pa[k][t], mid[t])
            mix = wb * (1 - p) + wa * p
            # المنطقة: جوه الحلقة كلها؛ حوافها ناعمة عشان مايبانش خط
            m = s._soft(out.shape[:2], mid[1:1 + N]) * np.minimum(ab, aa) * (1 - s.KP)
            out = out * (1 - m[..., None]) + mix * m[..., None]
        return out
