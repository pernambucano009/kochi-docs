"""وش بعد العلاج v2: بنركّب البق كله (الشفايف + السنان + الجلد حواليه) من صورة الابتسامة الحقيقية بعد العلاج على الوش، بدل السنان بس."""
import sys, cv2, numpy as np
S = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/"); sys.path.insert(0, S + "tools")
from PIL import Image
from derive import _lmk
INNER = [78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178,88,95]
OUTER = [61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146]
def big(m):
    m = (m > 128).astype(np.uint8); n, lab, st, _ = cv2.connectedComponentsWithStats(m); i = 1 + np.argmax(st[1:, 4]); m = (lab == i).astype(np.uint8) * 255
    c, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); f = np.zeros_like(m); cv2.drawContours(f, c, -1, 255, -1); return f
def corners(m):   # طرفين فتحة البق (أبعد نقطة شمال ويمين)
    ys, xs = np.where(m > 0); l = np.argmin(xs); r = np.argmax(xs); return np.float32([xs[l], ys[l]]), np.float32([xs[r], ys[r]])
INC_IPD = .152   # عرض السنة الأمامية ÷ المسافة بين نِنّي العينين في صورة وش (مقاس على صورة اتظبطت بإيد العميل: ٠٫١٥٥)

def swap(base_p, out_p, smile_p=None, lips_p=None, open_p=None, ysq=.92, lipcol=.3, inc_w=None, teeth_l=.5):
    """البق كله (الشفايف + السنان) من صورة الابتسامة الحقيقية بعد العلاج على وش المريض: علاقة السنان بالشفايف حقيقية.
    - المقاس والمكان: زوايا الشفايف على زوايا بق الوش، والبق بيتضغط رأسيًا ٨٪ (الصورة القريبة بتكبّر سُمك الشفايف) — اختيار العميل (نسخة ٣).
    - الإضاءة: لون الشفايف وإضاءتها بيقربوا ٣٠٪ من شفايفه في صورة الوش، والسنان السطوع بس (لونها زي ما هو).
    - الدمج: Poisson، والسنان بترجع بالبكسل الحقيقي."""
    B = np.array(Image.open(base_p).convert("RGB")); Sm = np.array(Image.open(smile_p or S + "case1/ret/smile_front_ret4.jpg").convert("RGB"))
    mo = big(cv2.imread(open_p or S + "tools/ms/smile_open.png", 0)); ml = big(cv2.imread(lips_p or S + "tools/ms/smile_lips.png", 0)); ml = np.maximum(ml, mo)
    P = _lmk(B); fi = P[INNER]; fo = P[OUTER]; H, W = B.shape[:2]
    sl, sr = corners(ml); bl, br = P[61], P[291]
    v1 = sr - sl; v2 = br - bl; s = np.linalg.norm(v2) / np.linalg.norm(v1); a = np.arctan2(v2[1], v2[0]) - np.arctan2(v1[1], v1[0])
    # حماية: صورة ابتسامة مش من الأمام (أو فتحة غلط) بتطلّع بق مقلوب أو عملاق على الوش، فمانركّبش أصلًا
    xs_ = np.where(ml.any(0))[0]; ys_ = np.where(ml.any(1))[0]; asp = (xs_.max() - xs_.min()) / max(1, ys_.max() - ys_.min())
    fh = np.linalg.norm(P[152] - P[10])
    if asp < 1.35 or abs(a) > np.radians(20) or not (.18 < np.linalg.norm(v2) / fh < .75) or (ys_.max() - ys_.min()) * s > .45 * fh:
        raise ValueError(f"SMILE_NOT_FRONTAL asp={asp:.2f} ang={np.degrees(a):.0f} h={(ys_.max() - ys_.min()) * s / fh:.2f}")
    if inc_w and len(P) > 473:
        # المقاس من السنان نفسها (ثابتة عند نفس الشخص) مش من زوايا البق: لو ابتسامة «قبل» أوسع، البق المنقول كان بيتمط معاها ويكبر
        st = INC_IPD * float(np.linalg.norm(P[468] - P[473])) / float(inc_w)
        s = float(np.clip(st, s * .7, s * 1.05))
    # الرأسي: ارتفاع الشفايف المنقولة = ارتفاع شفايف الوش نفسه (من نقط الوش)، وإلا لو البق المنقول أقصر، شفة الوش الأصلية
    # بتفضل باينة فوقه (شفتين علويتين — حصلت على السيرفر لما المقاس اتصغّر من السنان)
    lip_h_face = float(fo[:, 1].max() - fo[:, 1].min()); lip_h_sm = float(ys_.max() - ys_.min()) * s
    ysq = float(np.clip(lip_h_face / max(1.0, lip_h_sm), .8, 1.25))
    R = np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]]) @ np.diag([s, s * ysq])
    c1 = (sl + sr) / 2; c2 = (bl + br) / 2
    so = np.float32([c1[0], (ys_.min() + ys_.max()) / 2]); bo = np.float32([c2[0], (fo[:, 1].min() + fo[:, 1].max()) / 2])
    M = np.hstack([R, (bo - R @ so)[:, None]]).astype(np.float32)
    Sw = cv2.warpAffine(Sm, M, (W, H), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REFLECT); mlw = cv2.warpAffine(ml, M, (W, H)); mow = cv2.warpAffine(mo, M, (W, H))
    la = cv2.cvtColor(Sw, cv2.COLOR_RGB2LAB).astype(np.float32); lb = cv2.cvtColor(B, cv2.COLOR_RGB2LAB).astype(np.float32)
    lips_s = (mlw > 128) & (mow < 128)
    bl_ = np.zeros((H, W), np.uint8); cv2.fillPoly(bl_, [fo.astype(np.int32)], 255); cv2.fillPoly(bl_, [fi.astype(np.int32)], 0); lips_b = bl_ > 0
    # الإضاءة: الصورة القريبة ممكن تكون متصورة أغمق/أفتح بكتير من صورة الوش. بنقيس الفرق من الجلد اللي بين المناخير والشفة العليا
    # (موجود في الصورتين، ومش محتاج أقنعة الموديل اللي ممكن تطلع بايظة) ونطبّقه كضرب في السطوع على البق كله (السنان والشفايف) —
    # تصحيح إضاءة بس، نسب الألوان بين السنان والشفايف بتفضل زي ما هي.
    H_, W_ = B.shape[:2]; sk_b = np.zeros((H_, W_), np.uint8)
    top = P[[0, 37, 267]].astype(np.float32); nose = P[[2, 98, 327]].astype(np.float32)
    cv2.fillPoly(sk_b, [np.vstack([nose[[1]], nose[[0]], nose[[2]], top[[2]], top[[0]], top[[1]]]).astype(np.int32)], 255)
    sk_s = (cv2.warpAffine(np.full(mo.shape, 255, np.uint8), M, (W_, H_)) > 0) & (sk_b > 0) & ~(mlw > 128)
    if sk_s.sum() > 150:
        g = float(np.clip(np.median(lb[..., 0][sk_s]) / max(1.0, np.median(la[..., 0][sk_s])), .75, 1.45))
        la[..., 0] = np.clip(la[..., 0] * g, 0, 255)
    if lipcol and lips_s.sum() > 100 and lips_b.sum() > 100:   # لون الشفايف: الـ a/b بس، وبحد أقصى (القناع ممكن يكون مش دقيق)
        for ch in (1, 2): la[..., ch][lips_s] += float(np.clip(lb[..., ch][lips_b].mean() - la[..., ch][lips_s].mean(), -6, 6)) * lipcol
    St = cv2.cvtColor(np.clip(la, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)   # السنان: البكسل الحقيقي (من غير تنعيم: تفاصيل سطح السنان لازم تفضل)
    Sw = cv2.GaussianBlur(St, (0, 0), .6)   # الشفايف والجلد بس: نفس حدة صورة الوش
    bo_m = np.zeros((H, W), np.uint8); cv2.fillPoly(bo_m, [fo.astype(np.int32)], 255)
    region = np.maximum((mlw > 128).astype(np.uint8) * 255, bo_m); k = max(7, int(.05 * np.linalg.norm(v2)))   # هامش صغير: جلد الصورة القريبة (من غير مسام الوش) مايبانش كرقعة
    region = cv2.dilate(region, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    x, y, w, h = cv2.boundingRect(region); ctr = (x + w // 2, y + h // 2)
    comp = cv2.seamlessClone(Sw, B, region, ctr, cv2.NORMAL_CLONE)
    kk = cv2.GaussianBlur(cv2.erode(mow, np.ones((3, 3), np.uint8)), (0, 0), 1.5).astype(np.float32)[..., None] / 255
    out = (St * kk + comp * (1 - kk)).astype(np.uint8)
    Image.fromarray(out).save(out_p)
    np.save(out_p.replace(".png", "_open.npy"), mow); np.save(out_p.replace(".png", "_M.npy"), M); return out_p   # M: تحويل صورة الابتسامة ← الوش (لحدود السنان على الوش)
if __name__ == "__main__":
    for b, o in (("after_portrait_hands.png", "ap2_hands.png"), ("after_portrait.png", "ap2.png")): print(swap(S + "tools/out/" + b, S + "tools/out/" + o))
