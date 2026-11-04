"""مورف حقيقي سنة سنة: حدود القبل وحدود البعد (البعد متطابق على القبل) بيتعمل لهم نفس عدد النقط، وبنحرّك الشكل
تدريجيًا من شكل القبل لشكل البعد، وكل صورة بتتشد على الشكل الوسيط بمثلثات، وبعدين بنمزج. النتيجة: السنة بتكبر/تتعدل في مكانها."""
import numpy as np, cv2
N = 72
def resample(c, n=N):
    c = np.asarray(c, np.float32); cc = np.vstack([c, c[:1]]); d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(cc, axis=0), axis=1))]
    t = np.linspace(0, d[-1], n, endpoint=False); x = np.interp(t, d, cc[:, 0]); y = np.interp(t, d, cc[:, 1]); out = np.c_[x, y]
    ctr = out.mean(0); ang = np.arctan2(out[:, 1] - ctr[1], out[:, 0] - ctr[0])
    if np.cross(out[1] - out[0], out[2] - out[1]) < 0: out = out[::-1]; ang = ang[::-1]   # نفس الاتجاه
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
    m = np.zeros((r2[3], r2[2]), np.float32); cv2.fillConvexPoly(m, np.int32(np.round(d_)), 1.0, 16)
    y0, x0 = r2[1], r2[0]; y1, x1 = min(y0 + r2[3], dst_img.shape[0]), min(x0 + r2[2], dst_img.shape[1])
    if y0 < 0 or x0 < 0: return
    m = m[:y1 - y0, :x1 - x0]; patch = patch[:y1 - y0, :x1 - x0]
    dst_img[y0:y1, x0:x1] = dst_img[y0:y1, x0:x1] * (1 - m[..., None]) + patch * m[..., None]; acc[y0:y1, x0:x1] = np.maximum(acc[y0:y1, x0:x1], m)
class ShapeMorph:
    def __init__(s, B_img, A_img, cb, ca):
        """B_img/A_img: صور float (البعد متطابق على القبل)، cb/ca: dict سنة → حدودها في نفس الإحداثيات"""
        s.B, s.A = B_img, A_img; s.keys = [k for k in cb if k in ca]
        s.pb = {k: rig(resample(cb[k])) for k in s.keys}; s.pa = {k: rig(resample(ca[k])) for k in s.keys}
    def contour(s, k, p):
        return ((1 - p) * s.pb[k] + p * s.pa[k])[1:1 + N]
    def frame(s, prog):
        out = s.B.copy()
        for k in s.keys:
            p = prog if isinstance(prog, (int, float)) else prog.get(k, 0)
            if p <= 0: continue
            if p >= 1:   # طريق سريع: السنة خلصت تحويل
                m = np.zeros(out.shape[:2], np.float32); cv2.fillPoly(m, [np.int32(s.pa[k][1 + N:])], 1.0); m = cv2.GaussianBlur(m, (0, 0), 6)
                out = out * (1 - m[..., None]) + s.A * m[..., None]; continue
            mid = (1 - p) * s.pb[k] + p * s.pa[k]
            wb = np.zeros_like(out); wa = np.zeros_like(out); ab = np.zeros(out.shape[:2], np.float32); aa = np.zeros_like(ab)
            for t in TRI:
                warp_tri(s.B, wb, ab, s.pb[k][t], mid[t]); warp_tri(s.A, wa, aa, s.pa[k][t], mid[t])
            mix = wb * (1 - p) + wa * p
            # المنطقة: جوه الحلقة كلها؛ حوافها ناعمة عشان مايبانش خط
            m = np.zeros(out.shape[:2], np.float32); cv2.fillPoly(m, [np.int32(mid[1 + N:])], 1.0); m = cv2.GaussianBlur(m, (0, 0), 6) * np.minimum(ab, aa)
            out = out * (1 - m[..., None]) + mix * m[..., None]
        return out
