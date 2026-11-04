"""كل القوالب. تشغيل: python3 T.py a05 [--still]"""
import sys; sys.path.insert(0, ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/tpl"))
from tl import *
import json, os as _os
REG = {}
def T(name, ref, music="piano"):
    def deco(f): REG[name] = (ref, music, f); return f
    return deco
def A(z=1.0, iso=1.0): return shot("A").base(z, iso)
GUM_P = ("Isolated dental photo of an arch on black, rotated sideways. Fill ONLY the black empty area on the RIGHT side, between the pink gum and the right edge of the image, "
         "with natural continuous pink gum tissue (attached gingiva and mucosa, same color, texture, lighting and sharpness as the existing gum), so the gum reaches the right edge everywhere from top to bottom. "
         "Do not change the teeth or the existing gum at all, and keep the black background on the left of the teeth. Same framing and size.")
def gum_backdrop(frame, key):   # أداة عامة: خلفية لثة ممتدة لحد حافة الشاشة لكادر معين (بتتعمل مرة واحدة وتتحفظ)، gum_fill بياخد منها الفراغ بس
    out = (TO if CASE_DIR else S + "assets/") + f"gum_back_{key}.png"   # لكل حالة لوحدها (مايختلطش بين المرضى)
    if not _os.path.exists(out):
        sys.path.insert(0, S + "gen"); from at import run, get, upload
        src = OUTD + f"gum_src_{key}.png"; frame.save(src)
        get(run("Image", {"model": "google/nano-banana-pro/edit-developer", "prompt": GUM_P, "images": [upload(src)], "aspect_ratio": "9:16", "resolution": "2k"}), out)
    return L(out)
def Bm(z=1.0, iso=1.0): return shot("B").base(z, iso)
def spiral_on(im, x0, y0, w, h, p, flip=False):
    lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); anim.spiral(d, x0, y0, w, h, p, flip, lambda a: int(255 * a)); return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
def arc_line(im, sh, z, p, col=(255, 215, 120), w=3):
    ups = [t for t in sh.teeth_all if t["fdi"] < 30]
    def ept(t):
        c = t["c"]; band = c[np.abs(c[:, 0] - t["cx"]) < t["w"] * .25]; return band[np.argmax(band[:, 1])]
    P = np.array([ept(t) for t in ups]); cf = np.polyfit(P[:, 0], P[:, 1], 2); xs = np.linspace(P[:, 0].min(), P[:, 0].max(), 60)
    lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); pts = [sh.tf(x, np.polyval(cf, x) + 15, z) for x in xs]
    d.line(anim.partial(pts, ease(p)), fill=col + (255,), width=w); return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
def midline(im, sh, z, p, col=(255, 255, 255)):
    lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); _, my = sh.tf(sh.mid, 0, z)
    d.line([(0, my), (im.width * ease(p), my)], fill=col + (230,), width=2); return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
def rotzoom(im, ang, z, cx=.5, cy=.5):   # دوران + تقريب حوالين نقطة (انتقال من الوش للابتسامة)
    W, H = FW, FH; big = cover(im, z, cx, cy); return big.rotate(-ang, resample=Image.BICUBIC, expand=False).resize((W, H))
# ---------------------------------------------------------------- أ٥
_FTV = {}
def face_teeth_overlay(im, M, p_ol=1.0, p_mid=0.0, p_grid=0.0, p_pct=0.0, sh=None):
    """أداة عامة: رسومات التحليل على السنان جوه الوش نفسه (من غير ما نسيب الوش للماكرو): حدود كل سنة ظاهرة، خط المنتصف،
    شبكة عند حدود السنان، والنسب الحقيقية لكل سنة — كلها مرسومة في الشاشة بعد الكاميرا (M) فبتمشي مع الزووم والدوران."""
    if not _FTV: _FTV.update({int(k): np.float32(v) for k, v in json.load(open(TO + "ap_teeth_v3.json")).items() if int(k) < 30})
    T_ = {k: c @ M[:, :2].T + M[:, 2] for k, c in _FTV.items()}
    order = sorted(T_, key=lambda k: (k // 10 == 2, (k % 10) if k // 10 == 2 else -(k % 10)))   # من يمين المريض لشماله على القوس
    lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
    for n, k in enumerate(order):   # حدود رفيعة بتترسم سنة سنة
        q = ease(p_ol * 1.5 - n * .06)
        if q > 0: pts = [tuple(x) for x in T_[k][::2]] + [tuple(T_[k][0])]; d.line(anim.partial(pts, q), fill=(255, 255, 255, 235), width=2, joint="curve")
    ctr = {k: T_[k].mean(0) for k in T_}; allp = np.vstack(list(T_.values())); x0, y0 = allp.min(0); x1, y1 = allp.max(0)
    if p_mid > 0 and 11 in ctr and 21 in ctr:   # خط المنتصف بين السنتين الأماميين
        m = (ctr[11] + ctr[21]) / 2; v = ctr[21] - ctr[11]; v = v / (np.linalg.norm(v) + 1e-6); nrm = np.float32([-v[1], v[0]]); L = (x1 - x0 + y1 - y0) * .6 * ease(p_mid)
        d.line([tuple(m - nrm * L), tuple(m + nrm * L)], fill=(255, 255, 255, 220), width=2)
    if p_grid > 0:   # شبكة: خط عند الحد بين كل سنتين + إطار حوالين الست سنان الأمامية
        for n, (a_, b_) in enumerate(zip(order, order[1:])):
            q = ease(p_grid * 1.6 - n * .08)
            if q <= 0: continue
            m = (ctr[a_] + ctr[b_]) / 2; v = ctr[b_] - ctr[a_]; v = v / (np.linalg.norm(v) + 1e-6); nrm = np.float32([-v[1], v[0]]); L = 260 * q
            d.line([tuple(m - nrm * L), tuple(m + nrm * L)], fill=(255, 255, 255, int(170 * q)), width=1)
        q = ease(p_grid); d.rectangle((x0 - 30, y0 - 30, x1 + 30, y1 + 30), outline=(255, 255, 255, int(150 * q)), width=2)
    if p_pct > 0 and sh is not None:   # النسب الحقيقية من تحليل صورة البعد
        pct = {t_["fdi"]: sh.pct[id(t_)] for t_ in sh.six}; size = 74
        for n, k in enumerate([k for k in order if k in pct]):
            q = ease((p_pct * 1.6 - n * .12) / .4)
            if q > 0: x, y = ctr[k]; d.text((x, y), f"{pct[k]:.1f}%", font=F(FSER, size), fill=(255, 255, 255, int(255 * q)), anchor="mm", stroke_width=3, stroke_fill=(40, 30, 25, int(200 * q)))
    return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")

@T("a05", "v04")
def a05():
    sh = shot("A"); FA1 = face_mix(1); fa = faces_aligned(); amx, amy = fa["lm"][13]; W_, H_ = AP.size; ZE = 3.6
    def s1(t):   # بورتريه بعد بحركة كاميرا يدوية خفيفة
        dx, dy = 8 * math.sin(t * 7), 6 * math.cos(t * 5); return cam(FA1, W_ / 2 + dx, H_ / 2 + dy, 1.06 + .02 * t, 0)
    def s2(t):   # تقريب ودوران متصل لحد الابتسامة (+90: أطراف السنان للشمال) — من غير أي قطع
        p = ease(t / .8); return cam(FA1, W_ / 2 + (amx - W_ / 2) * p, H_ / 2 + (amy - H_ / 2) * p, 1.08 + (ZE - 1.08) * p, 90 * p)
    def s3(t):   # زي الأصل: بنفضل على الابتسامة بالشفايف، والتحليل بيترسم على السنان نفسها والكاميرا بتزق ببطء
        im = cam(FA1, amx, amy, ZE + .5 * t / 6.5, 90); M = CAMM["M"]
        im = face_teeth_overlay(im, M, p_ol=(t - .2) / 1.4, p_mid=(t - 1.4) / .6, p_grid=(t - 1.9) / 1.2, p_pct=(t - 3.0) / 1.2, sh=sh)
        return signature(im, (t - 4.6) / 1.2) if t > 4.6 else im
    return [(1.2, s1), (.8, s2), (6.5, s3)]
# ---------------------------------------------------------------- أ١١
@T("a11", "v10")
def a11():
    z = lambda t: 1.0 + .02 * t
    def s1(t):   # الناقص من السن بالأحمر
        im = Bm(z(t), ease(t / .6)); im = planned(im, z(t), 1.0 if t > .6 else 0, fill=(255, 40, 40, 150), only_added=True, dashed=False, width=0) if t > .6 else im
        return chip(im, "قبل")
    def s2(t):   # حدود الشكل المخطط فوق الأسنان القديمة + مسميات المشكلات
        im = Bm(z(2 + t)); im = planned(im, z(2 + t), ease(t / 1.4), col=(255, 255, 255), width=3)
        labs = ["عدم تناظر", "تصبّغ", "تآكل الحواف"]
        for i, s in enumerate(labs):
            q = ease((t - 1.4 - i * .5) / .4)
            if q > 0: im = txt(im, (FW * .3, FH * (.3 + .2 * i)), s, 54, alpha=q, fill=(255, 90, 90))
        return chip(im, "التشخيص والخطة")
    def s3(t):   # النتيجة: تتحول للبعد الحقيقي مع خط الابتسامة والتحليل
        im = morph_frame(ease(t / .8), z(5 + t)); sh = shot("B")
        im = arc_line(im, sh, z(5 + t), (t - .8) / 1.0); im = outlines(im, sh, z(5 + t), (t - 1.2) / 1.2, col=(255, 255, 255), width=2)
        return chip(im, "النتيجة")
    bt = [0, .45, .9, 1.35, 1.8, 2.25]
    def s4(t):   # تبديل سريع قبل/بعد على الإيقاع
        k = sum(1 for b in bt if t >= b); return chip(morph_frame(k % 2, 1.1), "بعد" if k % 2 else "قبل")
    return [(2.0, s1), (3.0, s2), (3.2, s3), (2.7, s4), (2.4, logo)]
# ---------------------------------------------------------------- أ١٧
@T("a17", "v18")
def a17():
    def up(prog, z=1.0, iso=0.0):   # الماكرو الأمامي معدول (مش ملفوف)
        im = morph_img(prog, rotated=False); return cover(im, 1.55 * z, .5, .42)
    M = morph_setup(); B = shot("B")
    # تحويل نقاط الصورة الأصلية → الفريم المعدول
    def tfu(x, y, z=1.0):
        im_w, im_h = B.W, B.H; s = max(FW / im_w, FH / im_h) * 1.55 * z; w, h = FW / s, FH / s; x0 = (im_w - w) * .5; y0 = (im_h - h) * .42
        return ((x - x0) * s, (y - y0) * s)
    Bt = {t["fdi"]: t for t in B.teeth_all}
    def draw_planned(im, p, green=False):
        lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
        for i, k in enumerate(M["order"]):
            q = ease(p * 1.5 - i * .06)
            if q <= 0: continue
            pts = [tfu(x, y) for x, y in M["planned"][k][::2]]; pts.append(pts[0])
            if green:
                m1 = Image.new("L", im.size); ImageDraw.Draw(m1).polygon(pts, fill=255); m2 = Image.new("L", im.size); ImageDraw.Draw(m2).polygon([tfu(x, y) for x, y in Bt[k]["c"][::2]], fill=255)
                add = np.clip(np.array(m1).astype(int) - np.array(m2), 0, 255).astype(np.uint8)
                hatch = np.zeros_like(add); hatch[(np.add.outer(np.arange(im.height), np.arange(im.width)) // 9) % 2 == 0] = 255
                g = Image.new("RGBA", im.size, (60, 230, 90, 0)); g.putalpha(Image.fromarray((np.minimum(add, hatch) * .8 * q).astype(np.uint8))); lay = Image.alpha_composite(lay, g); d = ImageDraw.Draw(lay)
            part = anim.partial(pts, q)
            for j in range(0, len(part) - 1, 2): d.line([part[j], part[j + 1]], fill=(255, 255, 255, 240), width=3)
        return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
    mx = tfu(B.mid, 0)[0]
    def s1(t): return chip(up(0, 1 + .02 * t), "قبل")
    def s2(t):
        im = draw_planned(up(0, 1.02), min(1, t / 1.2), green=t > 1.2)
        if t > 2.0:
            lay = Image.new("RGBA", im.size); ImageDraw.Draw(lay).line([(mx, 0), (mx, FH * ease((t - 2) / .5))], fill=(255, 255, 255, 220), width=2); im = Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
        im = chip(im, "إضافة أم تشذيب؟")
        return txt(im, (FW / 2, FH * .86), "الأخضر = ما سيُضاف إلى السن فقط", 44, alpha=ease((t - 1.4) / .4))
    def s3(t):
        im = up(ease(t / .6), 1.02); im = draw_planned(im, 1.0) if t < .4 else im; return chip(im, "النتيجة")
    def s4(t):   # قلب كبطاقة بين قبل وبعد
        k = int(t / .9) % 2; f = (t % .9) / .9; sx = abs(np.cos(min(1, f * 2) * np.pi)) if f < .5 else 1
        im = up(k if f > .25 else 1 - k, 1.02); im2 = black(); w = max(2, int(FW * (abs(np.cos(f * np.pi)) if f < .5 else 1)))
        im2.paste(im.resize((w, FH)), ((FW - w) // 2, 0)); return chip(im2, "بعد" if (k if f > .25 else 1 - k) else "قبل")
    def s5(t): return chip(cover(SF, 1.3 + .04 * t, .5, .5), "بعد")
    return [(1.4, s1), (3.0, s2), (2.2, s3), (2.7, s4), (2.0, s5), (2.4, logo)]
# ---------------------------------------------------------------- أ١٩
@T("a19", "v20")
def a19():
    fa = faces_aligned(); lm = fa["lm"]; mx, my = lm[13]; AS = cover(SF, 1.35, .5, .5)
    LIPLINE = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308]   # الشفة السفلية من جوه = خط الابتسامة
    def dotted(im, p, M):
        pts = np.array([lm[k] for k in LIPLINE], np.float32); pts[:, 1] -= 8; pts = cv2.transform(pts.reshape(-1, 1, 2), M).reshape(-1, 2)
        xs = np.linspace(0, 1, 60); P = np.array([np.interp(xs * (len(pts) - 1), np.arange(len(pts)), pts[:, k]) for k in (0, 1)]).T
        d = ImageDraw.Draw(im, "RGBA")
        for k in range(0, int(len(P) * ease(p)), 2): d.ellipse((P[k][0] - 7, P[k][1] - 7, P[k][0] + 7, P[k][1] + 7), fill=(255, 255, 255, 235))
        return im
    def s1(t):   # البق قبل (قريب وعالي الجودة) + خط الابتسامة المنقط، وبعدين يتحول للبعد في نفس المكان والحدود البيضا تترسم
        p = ease((t - 2.0) / 1.4); base = face_mix(p)
        if t > 3.2: base = ap_outlines(base, (t - 3.2) / 1.2, width=2)
        im = cam(base, mx, my, 3.3 + .08 * t, 0); im = dotted(im, (t - .4) / 1.2, CAMM["M"])
        return chip(im, "قبل" if p < .5 else "بعد")
    def s2(t): im = cam(face_mix(1), mx, my, 3.7 + .1 * t, 0); return flash(im, ease(t / .7))   # ومضة بيضا زي الأصل
    def s3(t):   # شاشة مقسومة بنصفين متعاكسين
        a = cover(SF, 1.3, .3, .5); b = cover(SF, 1.3, .7, .5).transpose(Image.Transpose.FLIP_TOP_BOTTOM); im = black()
        off = int(80 * (1 - ease(t / .6))); im.paste(a.crop((0, 0, FW, FH // 2)), (-off, 0)); im.paste(b.crop((0, 0, FW, FH // 2)).transpose(Image.Transpose.FLIP_TOP_BOTTOM), (off, FH // 2)); return flash(im, 1 - t / .25) if t < .25 else im
    def glitch(im, k=18):
        r, g, b = im.split(); return Image.merge("RGB", (r.transform(im.size, Image.AFFINE, (1, 0, k, 0, 1, 0)), g, b.transform(im.size, Image.AFFINE, (1, 0, -k, 0, 1, 0))))
    def s4(t):   # ابتسامة بزاوية + تشوّه ألوان سريع في الآخر
        im = cover(SR, 1.25 + .05 * t, .5, .5); return glitch(im, 22) if t > 1.8 else im
    def product(src, t, box, tilt=0):   # الابتسامة كمنتج على سطح لامع وتحتها انعكاسها
        m = src.crop((int(src.width * box[0]), int(src.height * box[1]), int(src.width * box[2]), int(src.height * box[3]))); w = int(FW * .92); h = int(m.height * w / m.width); m = m.resize((w, h))
        im = Image.new("RGB", (FW, FH), (8, 8, 10)); g = Image.new("L", (FW, FH)); gd = ImageDraw.Draw(g)
        for y in range(FH // 2, FH): gd.line([(0, y), (FW, y)], fill=int(40 * (1 - (y - FH / 2) / (FH / 2))))
        im = Image.composite(Image.new("RGB", im.size, (60, 60, 70)), im, g); y0 = int(FH / 2 - h - 10 + 30 * (1 - ease(t / 1)))
        mask = Image.new("L", (w, h), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, w, h), 50, fill=255); im.paste(m, ((FW - w) // 2, y0), mask)
        refl = m.transpose(Image.Transpose.FLIP_TOP_BOTTOM); fade = Image.linear_gradient("L").resize((w, h)).transpose(Image.Transpose.FLIP_TOP_BOTTOM).point(lambda v: int(v * .35))
        im.paste(refl, ((FW - w) // 2, y0 + h + 20), Image.fromarray(np.minimum(np.array(fade), np.array(mask.transpose(Image.Transpose.FLIP_TOP_BOTTOM)))))
        return cam(im, FW / 2, FH / 2, 1.0 + .08 * t / 4, tilt * (1 - ease(t / 3))) if tilt else im
    def s5(t): im = product(SR, t, (.08, .25, .92, .7), tilt=-12); return glitch(im, 16) if t < .25 or 2.0 < t < 2.15 else im   # بزاوية
    def s6(t): return signature(product(SF, t, (.1, .28, .9, .68)), (t - 1.6) / 1.4, y=FH * .82)   # من قدام + التوقيع
    return [(4.8, s1), (1.2, s2), (1.8, s3), (2.2, s4), (4.2, s5), (4.6, s6)]
# ---------------------------------------------------------------- أ١٤
@T("a14", "v14")
def a14():
    B = shot("B"); Bt = {t["fdi"]: t for t in B.teeth_all}
    # 3 مشكلات من الصورة نفسها: تصبّغ عند اللثة، تآكل الحافة، شرخ/فراغ بين الثنايا
    probs = [("تصبّغ عند اللثة", Bt[12]["cx"], Bt[12]["y"] + Bt[12]["h"] * .12), ("تآكل الحافة", Bt[21]["cx"], Bt[21]["y"] + Bt[21]["h"] * .95), ("فراغ وتلوّن", B.mid, Bt[11]["y"] + Bt[11]["h"] * .4)]
    rng = np.random.default_rng(3); nums = [(rng.integers(40, FW - 40), rng.integers(80, FH - 80), f"{rng.integers(10, 99)}.{rng.integers(0, 9)}") for _ in range(40)]
    def s1(t):
        z = 1 + .02 * t; im = Bm(z); lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
        for x, y, s in nums: d.text((x, y), s, font=F("TY-PlexMono-500.ttf", 26), fill=(255, 255, 255, 40))
        i = min(2, int(t / 1.0)); _, px, py = probs[i]; x, y = B.tf(px, py, z); r = 90 + 15 * np.sin(t * 8)
        for a0 in range(0, 360, 30): d.arc((x - r, y - r, x + r, y + r), a0, a0 + 18, fill=(255, 40, 40, 255), width=5)
        d.line([(x - r - 30, y), (x - r + 20, y)], fill=(255, 40, 40), width=3); d.line([(x + r - 20, y), (x + r + 30, y)], fill=(255, 40, 40), width=3)
        return chip(Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB"), "فحص")
    def s2(t):   # ثلاث دوائر مكبّرة موصولة بخطوط
        z = 1.06; im = Bm(z); im = ImageEnhance.Brightness(im).enhance(.55); lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); big = B.base(z * 3.0, 0.0)
        for i, (s, px, py) in enumerate(probs):
            q = ease((t - i * .6) / .5)
            if q <= 0: continue
            x, y = B.tf(px, py, z); cx, cy = 260, FH * (.22 + .28 * i); R = int(170 * q)
            # المكبّر: نقص حوالين النقطة من صورة أكبر
            bx, by = B.tf(px, py, z * 3.0); crop = big.crop((int(bx - R / 1.0), int(by - R / 1.0), int(bx + R / 1.0), int(by + R / 1.0))).resize((2 * R, 2 * R))
            m = Image.new("L", (2 * R, 2 * R)); ImageDraw.Draw(m).ellipse((0, 0, 2 * R, 2 * R), fill=255); lay.paste(crop, (int(cx - R), int(cy - R)), m)
            d.ellipse((cx - R, cy - R, cx + R, cy + R), outline=(255, 60, 60, 255), width=5); d.line([(x, y), (cx + R, cy)], fill=(255, 60, 60, 220), width=3); d.ellipse((x - 8, y - 8, x + 8, y + 8), fill=(255, 60, 60))
            d.text((cx, cy + R + 40), s, font=F(FA, 40), fill=(255, 255, 255, int(255 * q)), anchor="mm", direction="rtl")
        return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
    def s3(t): return chip(morph_frame(ease(t / .7), 1.06 + .02 * t), "النتيجة")
    def s4(t):   # قبل وبعد متجاورين
        a = morph_frame(0, 1.2).crop((FW // 4, 0, FW * 3 // 4, FH)); b = morph_frame(1, 1.2).crop((FW // 4, 0, FW * 3 // 4, FH)); im = black()
        im.paste(a, (0, 0)); im.paste(b, (FW // 2, 0)); ImageDraw.Draw(im).line([(FW / 2, 0), (FW / 2, FH)], fill="white", width=4)
        return txt(txt(im, (FW * .25, 110), "قبل", 50), (FW * .75, 110), "بعد", 50)
    def s5(t): return chip(cover(SF, 1.3, .5, .5), "بعد")
    def s6(t): return cover(BF, 1.0) if t < 1.0 else (flash(cover(SF, 1.0), 1 - (t - 1) / .3) if t < 1.3 else cover(SF, 1.0 + .05 * (t - 1.3)))
    return [(3.0, s1), (2.6, s2), (2.0, s3), (2.2, s4), (1.4, s5), (2.4, s6), (2.2, logo)]
# ---------------------------------------------------------------- أ٢٩
@T("a29", "v38")
def a29():
    sh = shot("A")
    def zones(im, z, p):   # درس سطح السن على صورة البعد الحقيقية
        lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); items = []
        cent = [t for t in sh.six if t["fdi"] % 10 == 1]
        for k, t in enumerate(cent):
            for j in range(3):   # الفصوص النمائية: 3 أشرطة طولية
                q = ease(p * 3 - j * .2)
                if q <= 0: continue
                xs = t["x"] + t["w"] * (.18 + .32 * j); pts = [sh.tf(xs, t["y"] + t["h"] * f, z) for f in np.linspace(.15, .7, 12)]
                d.line(pts, fill=(80, 200, 255, int(200 * q)), width=14)
        q = ease(p * 3 - 1.2)
        if q > 0:
            for t in sh.six:   # منطقة الانعكاس: إطار داخلي
                c = t["c"].astype(np.float32); cc = c.mean(0); inner = (c - cc) * .78 + cc
                d.line([sh.tf(x, y, z) for x, y in inner[::3]] + [sh.tf(*inner[0], z)], fill=(255, 210, 90, int(230 * q)), width=4)
        q = ease(p * 3 - 2.0)
        if q > 0:
            for t in sh.six:   # الخطوط الدقيقة الأفقية
                for f in (.3, .38, .46): d.line([sh.tf(t["x"] + t["w"] * .2, t["y"] + t["h"] * f, z), sh.tf(t["x"] + t["w"] * .8, t["y"] + t["h"] * f, z)], fill=(255, 255, 255, int(120 * q)), width=2)
        return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
    def legend(im, t):
        it = [("الفصوص النمائية", (80, 200, 255)), ("منطقة الانعكاس", (255, 210, 90)), ("الخطوط الدقيقة", (255, 255, 255))]
        for i, (s, c) in enumerate(it):
            q = ease((t - i * 1.0) / .4)
            if q > 0: im = txt(im, (FW - 70, FH * .1 + i * 70), s, 40, fill=c, anchor="rm", alpha=q)
        return im
    def s1(t): return chip(cover(BF, 1.0 + .03 * t), "قبل")
    def s2(t): return sweep(morph_frame(0, 1.05), morph_frame(1, 1.05), (t - .6) / .9)
    def s3(t): z = 1.1 + .03 * t; return legend(zones(A(z), z, t / 3.6), t)
    def s4(t):   # شبكة ثلاثية الأبعاد تمر على الأسنان
        z = 1.2; im = A(z); lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); off = (t * 220) % 60
        for i in range(-2, 40):
            y = i * 60 + off; d.line([(0, y), (FW, y + 40 * np.sin(y / 300))], fill=(120, 230, 255, 70), width=2)
        for x in range(0, FW, 60): d.line([(x, 0), (x + 30, FH)], fill=(120, 230, 255, 50), width=2)
        m = shot("A").iso.crop((0, 0, 1, 1))
        return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
    def s5(t):
        a = cover(BF, 1.0).crop((FW // 4, 0, FW * 3 // 4, FH)); b = cover(SF, 1.0).crop((FW // 4, 0, FW * 3 // 4, FH)); im = black(); im.paste(a, (0, 0)); im.paste(b, (FW // 2, 0))
        return signature(im, (t - .4) / 1.2)
    return [(1.8, s1), (1.8, s2), (3.8, s3), (1.6, s4), (2.6, s5), (2.2, logo)]

# ======================= الدفعة 2 =======================
_EL = {}
def EL(n):   # عنصر مولّد بخلفية سودا → شفاف
    if n not in _EL: _EL[n] = key_black(L(G + n + ".png"))
    return _EL[n]
_CL = {}
def CL(n):
    if n not in _CL: _CL[n] = Clip(G + n + ".mp4")
    return _CL[n]
def screen(a, b):   # دمج "شاشة" (للعناصر على خلفية سودا)
    return Image.fromarray(255 - ((255 - np.array(a).astype(np.uint16)) * (255 - np.array(b).astype(np.uint16)) // 255).astype(np.uint8))
BFc = cover(BF, 1.0)
def mouth_box(im=None):
    p = face_pts(BFc); xs = p[[61, 291, 0, 17], 0]; ys = p[[61, 291, 0, 17], 1]; return (xs.min() - 30, ys.min() - 30, xs.max() + 30, ys.max() + 30)
def analysis_A(t, z0=1.1, sig=True):
    sh = shot("A"); z = z0 + .03 * t; im = A(z); im = outlines(im, sh, z, t / 1.2); im = midline(im, sh, z, (t - 1.0) / .5); im = pct_labels(im, sh, z, (t - 1.3) / 1.0)
    return signature(im, (t - 2.4) / 1.0) if sig and t > 2.4 else im
ROT_SIGN = -1   # اتجاه لف الصف علشان أطراف السنان تبقى للشمال زي الماكرو
@T("a02", "v01", "beat")
def a02():
    mb = mouth_box(); mx, my = (mb[0] + mb[2]) / 2, (mb[1] + mb[3]) / 2
    arc_old = BFc.crop(tuple(int(v) for v in mb)).convert("RGBA")
    m = Image.new("L", arc_old.size); ImageDraw.Draw(m).ellipse((0, 0, arc_old.width, arc_old.height), fill=255); arc_old.putalpha(m.filter(ImageFilter.GaussianBlur(8)))
    def s1(t):   # إضاءة ملوّنة تعبر الوجه
        im = cover(BF, 1.0 + .03 * t); g = Image.new("RGB", im.size); d = ImageDraw.Draw(g); x = -400 + (FW + 800) * t / 2.2
        d.rectangle((x - 300, 0, x, FH), fill=(220, 30, 60)); d.rectangle((x, 0, x + 300, FH), fill=(40, 80, 255)); g = g.filter(ImageFilter.GaussianBlur(120))
        return chip(screen(im, Image.blend(black(), g, .55)), "قبل")
    P = Particles(None, (mx - 160, my - 60, mx + 160, my + 60), 1200, 700, col=(235, 225, 200), grav=300)
    def s2(t):   # أبيض وأسود، الأسنان القديمة قوس قدّام الفم، والتربينة تفتتها
        im = ImageEnhance.Brightness(bw(cover(BF, 1.07))).enhance(.6); hit = 1.7
        if t < hit: im = paste(im, arc_old, mx, my - 220 * ease(t / .8), 1.0 + 1.3 * ease(t / .8))
        tx = FW + 500 - (FW / 2 + 520) * ease((t - .7) / 1.0); im = paste(im, EL("turbine"), tx, my - 220, .45, 8)
        if t >= hit: im = P.draw(flash(im, max(0, .6 - (t - hit) * 2)), t - hit)
        return im
    def s3(t):   # قوس فينير يدور نحو الكاميرا
        return CL("arc").at(t)
    def s4(t):
        im = analysis_A(t, 1.12, sig=False)
        labs = ["الحافة القاطعة", "الشفافية", "الهالة"]
        for i, l in enumerate(labs):
            q = ease((t - 2.4 - i * .4) / .3)
            if q > 0: im = txt(im, (80, FH * (.3 + .18 * i)), l, 42, anchor="lm", alpha=q)
        return im
    bt = [0, .4, .8, 1.2, 1.6]
    def s5(t): k = sum(1 for b in bt if t >= b); return chip(morph_frame(k % 2, 1.1), "بعد" if k % 2 else "قبل")
    def s6(t): return cover(SF, 1.35 + .05 * t, .5, .5)
    def s7(t): return chip(cover(SF, 1.0 + .03 * t), "بعد")
    return [(2.2, s1), (3.2, s2), (3.0, s3), (4.0, s4), (2.0, s5), (1.4, s6), (1.6, s7), (2.2, logo)]
def clock_bg(t, W=FW, H=FH, cx=None, cy=None):   # نقوش ساعة بتلف
    im = Image.new("RGB", (W, H), (5, 5, 6)); d = ImageDraw.Draw(im); cx = cx or W * .35; cy = cy or H / 2
    for k, R in enumerate((820, 640, 470, 300)):
        d.ellipse((cx - R, cy - R, cx + R, cy + R), outline=(60, 52, 36), width=3)
        n = 60 if k % 2 == 0 else 12; a0 = t * (8 if k % 2 else -5)
        for i in range(n):
            a = math.radians(a0 + i * 360 / n); L1 = 30 if i % 5 == 0 else 14
            d.line([(cx + R * math.cos(a), cy + R * math.sin(a)), (cx + (R - L1) * math.cos(a), cy + (R - L1) * math.sin(a))], fill=(90, 78, 52), width=3)
    rom = "XII I II III IIII V VI VII VIII IX X XI".split()
    for i, r in enumerate(rom):
        a = math.radians(-90 + i * 30 + t * 3); d.text((cx + 560 * math.cos(a), cy + 560 * math.sin(a)), r, font=F("TY-InstrumentSerif.ttf", 54), fill=(110, 95, 62), anchor="mm")
    return im
@T("a03", "v02")
def a03():
    M = morph_setup()
    def base(prog, t, z=1.0): return screen(morph_frame(prog, z), clock_bg(t))
    def s1(t): im = base(0, t); return paste(im, key_black(CL("arc").at(t).resize((540, 960))), FW * .32, FH * .5, 1.0, alpha=ease(t / .5) * (1 - ease((t - 2.2) / .5)))
    def s2(t):   # الفينير يُركّب قطعة قطعة
        prog = {k: ease((t - .2 - i * .3) / .25) for i, k in enumerate(M["order"])}; return base(prog, 2.5 + t)
    def s3(t):   # قرص ساعة حول الحافة القاطعة وعقرب يمر
        im = base(1, 5.5 + t, 1.04); sh = shot("B"); lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
        xi = min(sh.tf(x, y, 1.04)[0] for tt in sh.six for x, y in tt["c"][::4]); cx, cy = xi + 700, FH / 2; R = 760
        d.arc((cx - R, cy - R, cx + R, cy + R), 150, 210, fill=(214, 178, 106, 255), width=4)
        for i in range(13):
            a = math.radians(150 + i * 5); d.line([(cx + R * math.cos(a), cy + R * math.sin(a)), (cx + (R + 30) * math.cos(a), cy + (R + 30) * math.sin(a))], fill=(214, 178, 106, 255), width=3)
        a = math.radians(150 + 60 * ease(t / 2.0)); d.line([(cx, cy), (cx + (R + 60) * math.cos(a), cy + (R + 60) * math.sin(a))], fill=(255, 230, 160, 230), width=3)
        return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
    def s4(t):   # يتحول لمسطرة النسبة الذهبية
        sh = shot("B"); z = 1.06; im = base(1, 8.5 + t, z); im = outlines(im, sh, z, t / 1.0); im = pct_labels(im, sh, z, (t - .8) / 1.0)
        my = sh.tf(sh.mid, 0, z)[1]; w = 230; return spiral_on(spiral_on(im, 40, my, w, w * 1.618, ease((t - .6) / 1.4)), 40, my - w * 1.618, w, w * 1.618, ease((t - .6) / 1.4), True)
    def s5(t): return signature(base(1, 12 + t, 1.08), t / 1.4)
    return [(2.6, s1), (3.2, s2), (2.6, s3), (3.2, s4), (2.6, s5), (2.2, logo)]
@T("a04", "v03")
def a04():
    mb = mouth_box(); mx, my = (mb[0] + mb[2]) / 2, (mb[1] + mb[3]) / 2
    P = Particles(None, (mx - 60, my - 20, mx + 60, my + 20), 1500, 900, col=(250, 250, 250), grav=-60)
    def s1(t): return chip(cover(BF, 1.0 + .03 * t), "قبل")
    def s2(t):   # رذاذ أبيض من الفم وفينيرة كبيرة تدور قدّام الوش المعتم
        im = ImageEnhance.Brightness(cover(BF, 1.04)).enhance(1 - .7 * ease(t / .6)); im = P.draw(im, t, 1.6)
        v = key_black(CL("veneer").at(t).resize((720, 1280))); return paste(im, v, FW / 2, FH * .5, .4 + .9 * ease(t / 1.2), alpha=ease((t - .2) / .5))
    def s3(t):   # فينيرات صغيرة تطير للفم
        im = ImageEnhance.Brightness(cover(BF, 1.04)).enhance(.3 + .7 * ease(t / 1.2)); r = np.random.default_rng(4)
        for i in range(8):
            a = r.uniform(0, 2 * np.pi); d0 = 900; p = ease((t - i * .08) / .8); x = mx + d0 * (1 - p) * math.cos(a); y = my + d0 * (1 - p) * math.sin(a)
            if p < 1: im = paste(im, EL("veneer"), x, y, .12 * (1 - .6 * p), r.uniform(-60, 60))
        return im
    def s4(t):   # بعد بخلفية بلون هوية العيادة
        im = cover(SF, 1.0 + .03 * t); g = Image.new("RGB", im.size, (40, 32, 20)); return chip(Image.blend(im, g, .12), "بعد")
    def s5(t): return cover(SF, 1.4 + .05 * t)
    ten = ["خط المنتصف", "قوس الابتسامة", "نسب العرض", "محاور الأسنان", "الفراغات القاطعة", "حافة اللثة", "اللون", "الشفافية", "الملمس", "التناظر"]
    def s6(t):
        im = analysis_A(t, 1.1, sig=False)
        for i, s_ in enumerate(ten):
            q = ease((t - .3 - i * .28) / .25)
            if q > 0: im = txt(im, (60, 160 + i * 78), f"{i + 1:02d}  {s_}" if False else s_, 38, anchor="lm", alpha=q)
        return im
    def s7(t): return sweep(morph_frame(0, 1.1), morph_frame(1, 1.1), (t - .3) / .9)
    def s8(t): return signature(cover(SF, 1.0), t / 1.2)
    return [(1.4, s1), (2.8, s2), (1.6, s3), (1.8, s4), (1.2, s5), (4.0, s6), (1.8, s7), (2.0, s8), (2.2, logo)]
@T("a10", "v09")
def a10():
    mb = mouth_box(); mx, my = (mb[0] + mb[2]) / 2, (mb[1] + mb[3]) / 2
    arc_old = BFc.crop(tuple(int(v) for v in mb)).convert("RGBA"); m = Image.new("L", arc_old.size); ImageDraw.Draw(m).ellipse((0, 0, arc_old.width, arc_old.height), fill=255); arc_old.putalpha(m.filter(ImageFilter.GaussianBlur(8)))
    def s1(t):   # هالة حمرا
        im = cover(BF, 1.0 + .03 * t); g = Image.new("RGB", im.size); ImageDraw.Draw(g).ellipse((-200, FH * .1, FW + 200, FH * 1.1), fill=(200, 20, 30)); g = g.filter(ImageFilter.GaussianBlur(200))
        return chip(screen(im, Image.blend(black(), g, .5 + .2 * math.sin(t * 6))), "قبل")
    def s2(t): im = ImageEnhance.Brightness(cover(BF, 1.04)).enhance(.45); return paste(im, arc_old, mx, my + 380 * ease(t / 1.0), 1.0 + .8 * ease(t / 1.0))
    V = EL("veneer"); VS = 1.25
    labs = [("خطوط ريتزيوس", .45, .40), ("المنطقة شبه الشفافة", .5, .62), ("المنطقة الشفافة", .5, .80), ("الهالة القاطعة", .5, .88), ("التكيف عند عنق السن", .5, .12), ("اللون", .55, .5), ("الطبيعية", .45, .3), ("التشريح", .6, .2)]
    def s3(t):   # درس تشريح على فينيرة كبيرة
        im = Image.new("RGB", (FW, FH), (6, 6, 8)); vw, vh = V.width * VS, V.height * VS * .62; ang = 6 * math.sin(t * .8)
        im = paste(im, V, FW * .62, FH * .5, VS * .62, ang); lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
        x0 = FW * .62 - vw * .62 / 2 * .6; y0 = FH * .5 - vh / 2
        for i, (s_, fx, fy) in enumerate(labs):
            q = ease((t - .4 - i * .6) / .35)
            if q <= 0: continue
            px = FW * .62 + (fx - .5) * 300; py = FH * .5 + (fy - .5) * vh * 1.0; ly = 200 + i * 190
            d.ellipse((px - 7, py - 7, px + 7, py + 7), fill=(255, 255, 255, int(255 * q))); d.line([(px, py), (330, ly), (60, ly)], fill=(255, 255, 255, int(200 * q)), width=2)
            d.text((60, ly - 32), s_, font=F(FA5, 36), fill=(255, 255, 255, int(255 * q)), anchor="lm", direction="rtl")
        return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
    R = np.random.default_rng(9); pet = [(R.uniform(0, FW), R.uniform(-FH, 0), R.uniform(80, 220), R.uniform(0, 360)) for _ in range(40)]
    def s4(t):   # بتلات ورد متطايرة حوالين السن
        im = Image.new("RGB", (FW, FH), (6, 6, 8)); im = paste(im, V, FW / 2, FH / 2, 1.1, 20 * math.sin(t)); lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
        for x, y, v, a in pet:
            yy = (y + v * t * 2) % (FH + 200) - 100; xx = x + 60 * math.sin(t * 2 + a); d.ellipse((xx, yy, xx + 34, yy + 20), fill=(255, 150, 180, 220))
        return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
    def s5(t): return analysis_A(t, 1.1)
    def s6(t): return sweep(morph_frame(0, 1.1), morph_frame(1, 1.1), (t - .3) / .9)
    return [(1.8, s1), (1.4, s2), (5.8, s3), (2.0, s4), (3.4, s5), (1.8, s6), (2.2, logo)]
@T("a12", "v11")
def a12():
    mb = mouth_box(); mx, my = (mb[0] + mb[2]) / 2, (mb[1] + mb[3]) / 2; pcs = teeth_pieces("A"); n = len(pcs)
    base = lambda: cover(BF, 1.9, .5, .62).filter(ImageFilter.GaussianBlur(10))
    ys0 = np.array([p[3] for p in pcs]); xs0 = np.array([p[2] for p in pcs]); sc = FW * .96 / (xs0.max() - xs0.min() + 120)
    tgt = [(FW / 2 + (x - xs0.mean()) * sc, FH * .5 + (y - ys0.mean()) * sc) for _, _, x, y in pcs]
    def place(im, p_of_i):
        for i, (f, pc, x, y) in enumerate(pcs):
            p = p_of_i(i)
            if p <= 0: continue
            tx, ty = tgt[i]; sx, sy = tx + (i - n / 2) * 260, -300
            im = paste(im, pc, sx + (tx - sx) * p, sy + (ty - sy) * p, sc * (1.6 - .6 * p), 30 * (1 - p))
        return im
    def s1(t): return chip(cover(BF, 1.9 + .05 * t, .5, .62), "قبل")
    def s2(t):   # الفينيرات تطير واحدة واحدة وتبني القوس + إطار التصميم والتوقيع
        im = place(base(), lambda i: ease((t - i * .22) / .45)); lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); q = ease((t - n * .22 - .2) / .5)
        if q > 0:
            x0, x1 = min(p[0] for p in tgt) - 70, max(p[0] for p in tgt) + 70; y0, y1 = FH * .5 - 230, FH * .5 + 230
            d.rectangle((x0, y0, x1, y1), outline=(214, 178, 106, int(255 * q)), width=3); d.line([(FW / 2, y0 - 60), (FW / 2, y1 + 60)], fill=(255, 255, 255, int(200 * q)), width=2)
            for k, s_ in enumerate(["1", "0.62", "0.38"]): d.text((FW / 2 + (k + .5) * 120, y0 - 40), s_, font=F(FSER, 44), fill=(255, 255, 255, int(255 * q)), anchor="mm")
        im = Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB"); return signature(im, (t - n * .22 - .8) / 1.0, y=FH * .8)
    def s3(t): return place(base(), lambda i: 1 - ease((t - (n - 1 - i) * .08) / .4))
    def s4(t): return chip(cover(SF, 1.0 + .03 * t), "بعد")
    def s5(t):
        a = cover(BF, 1.0).crop((FW // 4, 0, FW * 3 // 4, FH)); b = cover(SF, 1.0).crop((FW // 4, 0, FW * 3 // 4, FH)); im = black(); im.paste(a, (0, 0)); im.paste(b, (FW // 2, 0)); return im
    tiles = [rot(cover(x, 1.0, W=600, H=400)) for x in (BF, SF, SR, SL, BF, SF, SR, SL)]
    def s6(t):   # شريط بورتريهات ملفوف يتحرك مثل الفيلم
        im = Image.new("RGB", (FW, FH), (10, 10, 12)); y = -int(t * 500) % 640
        for i in range(-1, 5):
            tl_ = tiles[i % len(tiles)]; im.paste(tl_, ((FW - tl_.width) // 2, y + i * 640 - 640))
        d = ImageDraw.Draw(im)
        for yy in range(-640, FH, 50): d.rectangle((FW / 2 - 260, (yy + y) % FH, FW / 2 - 232, (yy + y) % FH + 26), fill=(240, 240, 240)); d.rectangle((FW / 2 + 232, (yy + y) % FH, FW / 2 + 260, (yy + y) % FH + 26), fill=(240, 240, 240))
        return im
    def s7(t): return cover(SF, 1.45 + .05 * t)
    return [(1.4, s1), (n * .22 + 2.2, s2), (1.2, s3), (1.6, s4), (2.0, s5), (2.4, s6), (1.4, s7), (2.2, logo)]
@T("a15", "v15")
def a15():
    fp = face_pts(BFc); mx, my = fp[[61, 291], 0].mean(), fp[[13, 14], 1].mean()
    def spiral_face(t, p):
        im = cover(BF, 1.0); W_ = 620; x0, y0 = mx - W_ * .72, my - W_ * 1.618 * .72
        return spiral_on(im, x0, y0, W_, W_ * 1.618, p)
    def s1(t):   # المستطيلات الذهبية والحلزون، والكاميرا تدخل معه وتلف
        im = spiral_face(t, ease(t / 1.4)); im = txt(im, (FW / 2, FH * .9), "النسبة الذهبية 1.618", 56, alpha=ease((t - .6) / .5))
        if t > 1.6:
            p = ease((t - 1.6) / 1.6); z = 1 + 3.0 * p; ang = 90 * p
            w, h = FW / z, FH / z; cx, cy = mx + (FW / 2 - mx) * (1 - p), my + (FH / 2 - my) * (1 - p)
            im = im.crop((int(cx - w / 2), int(cy - h / 2), int(cx + w / 2), int(cy + h / 2))).resize((FW, FH)).rotate(-ang, resample=Image.BICUBIC)
        return im
    def s2(t):   # قبل تتحول لبعد في الكادر نفسه (الماكرو المتطابق)
        return chip(morph_frame(ease((t - .4) / .8), 1.06), "بعد" if t > .8 else "قبل")
    def s3(t): return analysis_A(t, 1.1)
    def s4(t):   # الكاميرا تبعد وتلف للبورتريه بعد
        p = 1 - ease(t / 1.6); im = cover(SF, 1.0 + 1.5 * p); return im.rotate(-90 * p, resample=Image.BICUBIC)
    return [(3.4, s1), (1.8, s2), (3.6, s3), (2.0, s4), (2.2, logo)]
@T("a07", "v06")
def a07():
    fp = face_pts(BFc); eyeL, eyeR = fp[468] if len(fp) > 470 else fp[159], fp[473] if len(fp) > 470 else fp[386]
    top, chin = fp[10], fp[152]; cL, cR = fp[61], fp[291]
    def prot(im, cx, cy, R, ang, alpha=1.0):   # منقلة زجاجية
        lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); d.ellipse((cx - R, cy - R, cx + R, cy + R), fill=(180, 220, 255, int(40 * alpha)), outline=(220, 240, 255, int(200 * alpha)), width=3)
        for i in range(0, 360, 5):
            a = math.radians(i + ang); L1 = 30 if i % 30 == 0 else 12
            d.line([(cx + R * math.cos(a), cy + R * math.sin(a)), (cx + (R - L1) * math.cos(a), cy + (R - L1) * math.sin(a))], fill=(230, 245, 255, int(220 * alpha)), width=2)
        return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
    def lines(im, p):
        lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); L_ = [((top, chin), "الخط الأوسط", (255, 215, 120)), ((eyeL, eyeR), "خط الحدقتين", (120, 220, 255)), ((cL, cR), "خط زوايا الفم", (255, 140, 160))]
        for i, ((a, b), s_, c) in enumerate(L_):
            q = ease(p * 3 - i)
            if q <= 0: continue
            v = (b - a); a2 = a - v * .35; b2 = b + v * .35; e = a2 + (b2 - a2) * q; d.line([tuple(a2), tuple(e)], fill=c + (255,), width=4)
            d.text((FW - 50, 140 + i * 70), s_, font=F(FA5, 40), fill=c + (int(255 * q),), anchor="rm", direction="rtl")
        return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
    def s1(t):
        im = cover(BF, 1.0); im = prot(im, fp[1][0], fp[1][1], 430, t * 40, ease(t / .5)); return lines(im, (t - .6) / 2.2)
    # بروفايل المريض (عنصر اتعمل من صورة الوش، شفايفه مقفولة فالسنان ما اتلمستش) + المنقلة + خطوط فرانكفورت/كامبر/الإطباق زي الأصل
    PR = L(TO + "profile_right.png"); _ps = max(FW / PR.width, FH / PR.height); _ox = (PR.width * _ps - FW) * .62; _oy = (PR.height * _ps - FH) / 2
    def pp(x, y): return np.array([x * _ps - _ox, y * _ps - _oy])
    PLN = [((pp(720, 1040), pp(1275, 965)), "مستوى فرانكفورت", (255, 215, 120)), ((pp(700, 1150), pp(1480, 1205)), "مستوى كامبر", (120, 220, 255)), ((pp(760, 1330), pp(1420, 1335)), "مستوى الإطباق", (255, 140, 160))]
    def s2(t):
        im = blend(cover(BF, 1.0), cover(PR, 1.0, cx=.62), ease(t / .6)); c = pp(1180, 1120); im = prot(im, c[0], c[1], 260, -t * 25, ease((t - .4) / .5))
        lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
        for n, ((a, b), s_, col) in enumerate(PLN):
            q = ease((t - 1.0 - n * .6) / .6)
            if q <= 0: continue
            v = b - a; a2 = a - v * .25; b2 = b + v * .25; e = a2 + (b2 - a2) * q; d.line([tuple(a2), tuple(e)], fill=col + (255,), width=3)
            d.text((a2[0] + 6, a2[1] - 12), s_, font=F(FA5, 30), fill=col + (int(255 * q),), anchor="ls", direction="rtl", stroke_width=2, stroke_fill=(0, 0, 0, int(150 * q)))
        return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
    # الفم بينفجر رغوة بيضا وبعدين الفينيرات (مقصوصة من صورة البعد) بتطير وتقعد سنة سنة على وشه — زي الأصل
    fa = faces_aligned(); FB0 = face_mix(0); W_, H_ = AP.size; s_ = max(FW / W_, FH / H_) * 1.03
    mx, my = FW / 2 + (fa["lm"][13][0] - W_ / 2) * s_, FH / 2 + (fa["lm"][13][1] - H_ / 2) * s_
    PB = Particles(None, (mx - 110, my - 35, mx + 110, my + 35), 1800, 300, col=(250, 250, 250), grav=-20)
    def s3(t):
        if t < .5: return blend(cover(PR, 1.0, cx=.62), cover(FB0, 1.03), ease(t / .5))
        if t < 1.7:
            u = t - .5; im = PB.draw(cover(FB0, 1.03), u * .8, 2.0); g = Image.new("L", im.size); r = ease(u / .8)
            ImageDraw.Draw(g).ellipse((mx - 200 * r, my - 100 * r, mx + 200 * r, my + 100 * r), fill=170); return Image.composite(Image.new("RGB", im.size, (250, 250, 250)), im, g.filter(ImageFilter.GaussianBlur(40)))
        return cover(seat_on_face(min(1.0, (t - 1.7) * .62)), 1.03)
    SA_, SB_ = shot("A"), shot("B")
    def s4(t): z = 1.0 + .12 * ease(t / 1.5); return SA_.base(z, 1.0)   # الفك المعزول بعد العلاج
    PLA = dict(lines=.0, stagger=.15, draw=.8, mid=2.0, pct=3.0, arc=4.4, gold=5.8, title=99, label="")
    def s5(t): return anim.render(SA_, t, 1.12, PLA)   # تحليل كامل: حدود، خط النص، نسب، قوس، النسبة الذهبية
    def s6(t):   # البعد الحقيقي + التوقيع رأسي على الطرف + ومضتين للقبل زي الأصل
        z = 1.22 + .03 * t / 6; im = SA_.base(z, 0)
        b = max(ease((t - 2.3) / .7) * (1 - ease((t - 3.4) / .5)), ease((t - 4.3) / .7) * (1 - ease((t - 5.0) / .4)))   # تحول تدريجي (~ثانية) زي الأصل مش قلبة حادة (Q7 مسكها: E151)
        if b > 0: im = blend(im, SB_.base(z, 0), b)
        sg = signature(Image.new("RGB", (1500, 260)), min(1, max(0, t / 1.6)), y=130, W=1500).convert("RGBA"); a_ = np.array(sg); a_[..., 3] = a_[..., :3].max(2)
        im = paste(im, Image.fromarray(a_).rotate(90, expand=True), 42, FH / 2, .62); im = chip(im, "قبل") if b > .5 else im
        q = ease((t - 5.3) / .7)   # انتقال ناعم زي الأصل: الماكرو بيدوب في الشفايف بنفس الاتجاه (من غير قطع)
        return blend(im, s7(0), q) if q > 0 else im
    def s7(t): return cam(face_mix(1), fa["lm"][13][0], fa["lm"][13][1], 3.6 - .5 * ease(t / 1.5), 90)   # الشفايف والابتسامة الحقيقية بعد العلاج، مايلة +90 زي الماكرو اللي قبلها (أطراف السنان للشمال)
    def s8(t): return cover(AP, 1.12 - .08 * ease(t / 3.0))   # الوش بعد العلاج (العنصر المعتمد)
    s2 = push(s2, 4.5)   # كان لقطة متجمدة (فلتر الفيديو)
    return [(3.0, s1), (4.5, s2), (3.6, s3), (1.5, s4), (8.0, s5), (6.0, s6), (1.5, s7), (3.0, s8), (3.1, logo)]
@T("a32", "v41")
def a32():
    fp = face_pts(BFc); cx, cy = fp[168]   # منتصف ما بين العينين
    def sym(im, p):
        lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); c = (214, 178, 106)
        q = ease(p); d.line([(cx, cy - 900 * q), (cx, cy + 900 * q)], fill=c + (230,), width=3)
        for i, idx in enumerate((33, 263)):
            pass
        for k, (a, b) in enumerate(((33, 263), (61, 291), (234, 454))):
            qq = ease(p * 3 - k)
            if qq > 0: d.line([tuple(fp[a]), tuple(fp[a] + (fp[b] - fp[a]) * qq)], fill=c + (220,), width=2)
        return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
    def s1(t):   # الفراشة تهبط على منتصف الوجه
        im = cover(BF, 1.0); p = ease(t / 1.6); bx, by = cx + 300 * (1 - p), cy - 700 * (1 - p)
        b = key_black(CL("butterfly").at(t).resize((540, 960)).crop((0, 210, 540, 750))); return paste(im, b, bx, by, .6, 25 * (1 - p))
    def s2(t):
        im = cover(BF, 1.0); im = sym(im, t / 1.8); b = key_black(CL("butterfly").at(1.6 + t).resize((540, 960)).crop((0, 210, 540, 750))); return paste(im, b, cx, cy, .6, alpha=1 - ease((t - 1.2) / .6))
    def s3(t):   # ندور للابتسامة
        p = ease(t / 1.0); im = sym(cover(BF, 1.0), 1.0); z = 1 + 2.5 * p; mx, my = fp[13]
        w, h = FW / z, FH / z; X, Y = cx + (mx - cx) * p, cy + (my - cy) * p; im = im.crop((int(X - w / 2), int(Y - h / 2), int(X + w / 2), int(Y + h / 2))).resize((FW, FH)).rotate(-90 * p, resample=Image.BICUBIC)
        return blend(im, A(1.1), (t - .8) / .4)
    def s4(t):
        sh = shot("A"); z = 1.1 + .03 * t; im = outlines(A(z), sh, z, t / 1.0)
        six = sorted(sh.six, key=lambda q: q["cx"]); vals = ["0.6", "1", "1.6", "1.6", "1", "0.6"]
        for i, tt in enumerate(six):
            q = ease((t - 1.0 - i * .15) / .3)
            if q > 0: x, y = sh.tf(tt["cx"], tt["y"] + tt["h"] * .45, z); im = txt(im, (x, y), vals[i], 54, font=FSER, rtl=False, alpha=q, fill=(214, 178, 106))
        return signature(im, (t - 2.4) / 1.0) if t > 2.4 else im
    return [(1.8, s1), (2.2, s2), (1.2, s3), (3.8, s4), (2.2, logo)]

# ======================= الدفعة 3 =======================
def delaunay(P):   # مثلثات بين نقاط الوجه (من غير scipy)
    r = (0, 0, int(P[:, 0].max()) + 10, int(P[:, 1].max()) + 10); sd = cv2.Subdiv2D(r)
    for p in P: sd.insert((float(p[0]), float(p[1])))
    idx = {}; out = []
    for i, p in enumerate(P): idx[(round(float(p[0]), 1), round(float(p[1]), 1))] = i
    for x1, y1, x2, y2, x3, y3 in sd.getTriangleList():
        k = [idx.get((round(x, 1), round(y, 1))) for x, y in ((x1, y1), (x2, y2), (x3, y3))]
        if None not in k: out.append(k)
    return np.array(out)
def up(prog, z=1.0):   # الماكرو الأمامي معدول
    return cover(morph_img(prog, rotated=False), 1.4 * z, .5, .42)
def up_tf(x, y, z=1.0):
    B = shot("B"); s_ = max(FW / B.W, FH / B.H) * 1.4 * z; w, h = FW / s_, FH / s_; return ((x - (B.W - w) * .5) * s_, (y - (B.H - h) * .42) * s_)
def up_overlay(prog, col, reveal, alpha=.55, z=1.0):   # طبقة لون فوق السنان العلوية (جل/مادة) بتنكشف من الشمال لليمين
    M = morph_setup(); im = morph_img(prog, rotated=False); u = np.zeros(M["FB"].shape[:2], np.float32)
    for k in M["common"]: u = np.maximum(u, M["FM"][k])
    xs = np.arange(u.shape[1])[None, :]; u = u * (xs < reveal * u.shape[1]); arr = np.array(im).astype(np.float32)
    arr = arr * (1 - u[..., None] * alpha) + np.array(col, np.float32) * u[..., None] * alpha
    return cover(Image.fromarray(arr.astype(np.uint8)), 1.4 * z, .5, .42)
def sbs2(a, b, la="قبل", lb="بعد"):
    im = black(); im.paste(a.crop((FW // 4, 0, FW * 3 // 4, FH)), (0, 0)); im.paste(b.crop((FW // 4, 0, FW * 3 // 4, FH)), (FW // 2, 0))
    ImageDraw.Draw(im).line([(FW / 2, 0), (FW / 2, FH)], fill="white", width=4); return txt(txt(im, (FW * .25, 110), la, 50), (FW * .75, 110), lb, 50)
SL_ = lambda lab, sub="": (lambda t: slot(lab, sub))
@T("a06", "v05")
def a06():
    M = morph_setup()
    def s2(t):
        if t < 1.6: im = up_overlay(0, (40, 120, 255), t / 1.2); lab = "الحمض"
        elif t < 2.8: im = up_overlay(0, (40, 120, 255), 1.0, alpha=.55 * (1 - (t - 1.6) / 1.0)); im = Particles(None, (0, FH * .35, FW, FH * .5), 900, 500, col=(230, 240, 255), grav=-50, dirx=.8).draw(im, t - 1.6, 1.2); lab = "الغسيل"
        else: im = up_overlay(0, (255, 210, 40), (t - 2.8) / 1.2, alpha=.4); lab = "مادة الربط"
        return chip(im, lab)
    def s4(t):   # الفينير ينزل ويتركّب سنة سنة
        prog = {k: ease((t - i * .18) / .3) for i, k in enumerate(M["order"])}; return chip(up(prog), "التركيب")
    return [(1.6, SL_("المريض يستدير للكاميرا", "خلفية سادة وإضاءة أمامية")), (4.2, s2), (1.6, SL_("موديل المعمل بالفينير", "يدخل جنب الأسنان")), (2.4, s4),
            (1.4, lambda t: chip(cover(SF, 1.0 + .03 * t), "بعد")), (1.8, lambda t: sbs2(up(0), up(1))), (3.4, lambda t: analysis_A(t, 1.1)),
            (1.6, SL_("المريض أمام المرآة في العيادة")), (2.2, logo)]
def sprite():   # شخصية من تصميمنا: سنّة صغيرة بعيون وحذاء أزرق (مش شخصية لعبة معروفة)
    g = ["....WWWWWW....", "..WWWWWWWWWW..", ".WWWWWWWWWWWW.", ".WWKWWWWWWKWW.", ".WWKWWWWWWKWW.", ".WWWWWWWWWWWW.", ".WWWWPPPPWWWW.", ".WWWWWWWWWWWW.",
         "..WWWWWWWWWW..", "..WWWW..WWWW..", "..WWW....WWW..", ".BBBB....BBBB.", "BBBBB....BBBBB"]
    c = {"W": (250, 250, 245, 255), "K": (20, 20, 30, 255), "P": (240, 90, 120, 255), "B": (40, 110, 230, 255), ".": (0, 0, 0, 0)}
    im = Image.new("RGBA", (14, 13))
    for y, row in enumerate(g):
        for x, ch in enumerate(row): im.putpixel((x, y), c[ch])
    o = Image.new("RGBA", (16, 15)); o.paste(im, (1, 1)); a = np.array(o); sh = a.copy(); m = sh[..., 3] > 0
    out = Image.new("RGBA", (16, 15)); arr = np.zeros_like(a)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)): arr[np.roll(np.roll(m, dy, 0), dx, 1) & ~m] = (10, 10, 20, 255)
    out = Image.alpha_composite(Image.fromarray(arr), o); return out.resize((16 * 9, 15 * 9), Image.NEAREST)
@T("a08", "v07", "chip")
def a08():
    M = morph_setup(); B = shot("B"); Bt = {t["fdi"]: t for t in B.teeth_all}; SP = sprite(); order = M["order"]; ZG = .72
    lows = [t for t in B.teeth_all if t["fdi"] > 30]
    def low_top(x):
        c = min(lows, key=lambda t: abs(t["cx"] - x)); return c["y"]
    pts = [(up_tf(Bt[k]["cx"], 0, ZG)[0], up_tf(0, low_top(Bt[k]["cx"]), ZG)[1], up_tf(0, Bt[k]["y"] + Bt[k]["h"], ZG)[1], k) for k in order]
    pts = [p for p in pts if 40 < p[0] < FW - 40]; hop = 1.0
    def coin(d, x, y, a):
        d.ellipse((x - 26, y - 26, x + 26, y + 26), fill=(255, 205, 40, a), outline=(160, 110, 0, a), width=5); d.rectangle((x - 5, y - 14, x + 5, y + 14), fill=(255, 240, 150, a))
    def s1(t):
        i = min(len(pts) - 1, int(t / hop)); f = (t % hop) / hop; x0, gy, ty, k = pts[i]; x1 = pts[min(i + 1, len(pts) - 1)][0]
        prog = {kk: ease((t - j * hop - .5) / .15) for j, (_, _, _, kk) in enumerate(pts)}; im = up(prog, ZG); d = ImageDraw.Draw(im, "RGBA")
        jump = math.sin(min(1, f / .5) * math.pi / 2) if f < .5 else math.cos((f - .5) / .5 * math.pi / 2)
        ytop = gy - SP.height; y = ytop - (ytop - ty - 10) * jump * .98; x = x0 + (x1 - x0) * max(0, (f - .6) / .4)
        for j, (cx, _, cty, _) in enumerate(pts):   # عملة تطلع من السنة لما تتخبط
            ft = t - j * hop - .5
            if 0 < ft < .6: coin(d, cx, cty - 60 - 200 * ft, int(255 * (1 - ft / .6)))
        im = paste(im, SP, x, y + SP.height / 2); return txt(im, (FW / 2, 120), f"العملات {sum(1 for j in range(len(pts)) if t > j * hop + .5)}", 50)
    def s2(t):   # زوايا الفراغات القاطعة
        im = up(1, ZG); d = ImageDraw.Draw(im, "RGBA"); angs = [20, 30, 40, 50]
        for j in range(min(4, len(pts) - 1)):
            q = ease((t - j * .3) / .3)
            if q <= 0: continue
            xa = (pts[len(pts) // 2 + j - 1][0] + pts[len(pts) // 2 + j][0]) / 2 if len(pts) // 2 + j < len(pts) else pts[-1][0]; y0 = pts[0][2]
            d.line([(xa - 40, y0 + 60), (xa, y0 - 10), (xa + 40, y0 + 60)], fill=(255, 60, 60, int(255 * q)), width=4)
            d.text((xa, y0 + 100), f"{angs[j]}°", font=F("TY-VT323.ttf", 64), fill=(255, 255, 255, int(255 * q)), anchor="mm")
        return im
    def s3(t):   # الشخصية ترفع لافتة باسم الطبيب
        im = up(1, ZG); d = ImageDraw.Draw(im, "RGBA"); x, y = FW / 2, FH * .62
        d.rectangle((x - 300, y - 260, x + 300, y - 130), fill=(120, 70, 30, 255), outline=(60, 30, 10, 255), width=8); d.text((x, y - 195), DOC, font=F(FA, 64), fill=(255, 240, 200), anchor="mm", direction="rtl")
        d.rectangle((x - 8, y - 130, x + 8, y - 40), fill=(90, 50, 20)); return paste(im, SP, x, y + 20 + 10 * math.sin(t * 10))
    bt = [0, .5, 1.0, 1.5]
    def s4(t): k = sum(1 for b in bt if t >= b); return chip(up(k % 2, ZG), "بعد" if k % 2 else "قبل")
    return [(len(pts) * hop + .6, s1), (2.0, s2), (2.4, s3), (2.0, s4), (2.0, logo)]
@T("a16", "v16")
def a16():
    fp = face_pts(BFc); eye = fp[468] if len(fp) > 470 else fp[159]; mx, my = fp[13]
    idx = list(range(0, len(fp), 7)); tri = delaunay(fp[idx])
    def s1(t):   # تقريب على العين ودوائر مسح القزحية
        p = ease(t / 1.0); z = 1 + 3 * p; w, h = FW / z, FH / z; X, Y = FW / 2 + (eye[0] - FW / 2) * p, FH / 2 + (eye[1] - FH / 2) * p
        im = cover(BF, 1.0).crop((int(X - w / 2), int(Y - h / 2), int(X + w / 2), int(Y + h / 2))).resize((FW, FH)); d = ImageDraw.Draw(im, "RGBA")
        for k in range(4):
            r = 120 + k * 70 + 20 * math.sin(t * 5 + k); a0 = t * (90 if k % 2 else -70)
            for j in range(0, 360, 45): d.arc((FW / 2 - r, FH / 2 - r, FW / 2 + r, FH / 2 + r), a0 + j, a0 + j + 28, fill=(60, 170, 255, int(220 * ease((t - .6) / .4))), width=4)
        return im
    def s2(t):   # شبكة خطوط هندسية على ملامح الوجه
        im = cover(BF, 1.0); d = ImageDraw.Draw(im, "RGBA"); P = fp[idx]; n = int(len(tri) * ease(t / 1.6))
        for a, b, c in tri[:n]: d.line([tuple(P[a]), tuple(P[b]), tuple(P[c]), tuple(P[a])], fill=(80, 200, 255, 120), width=1)
        return im
    def s3(t):   # دوائر ذهبية تصغر نحو الابتسامة والكاميرا تدخل معها
        p = ease(t / 1.6); z = 1 + 2.6 * p; w, h = FW / z, FH / z; X, Y = FW / 2 + (mx - FW / 2) * p, FH / 2 + (my - FH / 2) * p
        im = cover(BF, 1.0).crop((int(X - w / 2), int(Y - h / 2), int(X + w / 2), int(Y + h / 2))).resize((FW, FH)); d = ImageDraw.Draw(im, "RGBA")
        for k in range(5):
            r = (900 - k * 160) * (1 - .6 * p); d.ellipse((FW / 2 - r, FH / 2 - r, FW / 2 + r, FH / 2 + r), outline=(214, 178, 106, 200), width=3)
        return blend(im, A(1.1), (t - 1.3) / .3)
    def s5(t):   # ماكرو بعد وقبل متجاورين مع خط متموج على الأسنان القديمة
        im = sbs2(morph_frame(1, 1.2), morph_frame(0, 1.2), "بعد", "قبل"); d = ImageDraw.Draw(im, "RGBA")
        pts = [(FW * .62 + 40 * math.sin(y / 40 + t * 6), y) for y in range(200, FH - 200, 8)]; d.line(pts[:int(len(pts) * ease(t / 1.0))], fill=(255, 60, 60, 230), width=4); return im
    def s6(t):   # الأسنان تنزلق خارج الإطار
        im = black(); a = analysis_A(3.4, 1.1, sig=False); im.paste(a, (int(-FW * ease((t - .6) / .8)), 0)); return im
    return [(1.6, s1), (1.8, s2), (1.6, s3), (3.6, lambda t: analysis_A(t, 1.1)), (2.0, s5), (1.4, s6), (2.2, logo)]
@T("a18", "v19")
def a18():
    B = shot("B")
    def grid(im, t):
        d = ImageDraw.Draw(im, "RGBA"); off = (t * 120) % 50
        for x in range(0, FW, 50): d.line([(x + off, 0), (x + off, FH)], fill=(60, 255, 150, 40))
        for y in range(0, FH, 50): d.line([(0, y + off), (FW, y + off)], fill=(60, 255, 150, 40))
        y = FH * ((t * .6) % 1); d.rectangle((0, y - 3, FW, y + 3), fill=(60, 255, 150, 160)); return im
    def curves(im, z, p):
        sh = shot("B"); d = ImageDraw.Draw(im, "RGBA"); M = morph_setup()
        for k in M["order"]:
            c = M["planned"][k]; tip = c[np.argsort(-c[:, 1])][:12]; tip = tip[np.argsort(tip[:, 0])]
            pts = [sh.tf(x, y, z) for x, y in tip]; d.line(anim.partial(pts, ease(p)), fill=(190, 90, 255, 255), width=4)
        return im
    def s1(t): return chip(grid(Bm(1.02), t), "مسح")
    def s2(t): z = 1.03; im = planned(Bm(z), z, t / 1.2, col=(80, 255, 140), dashed=False, fill=(60, 230, 120, 110)); return chip(curves(im, z, (t - 1.0) / 1.0), "التصميم الرقمي")
    def s3(t): z = 1.03; return chip(planned(Bm(z), z, 1.0, col=(80, 255, 140), dashed=True, fill=(60, 230, 120, 170), only_added=True), "المساحات المضافة")
    def s4(t): return chip(morph_frame(ease(t / .6), 1.05), "النتيجة") if t < 1.0 else analysis_A(t - 1.0, 1.1, sig=False)
    def s7(t): return neon_write(black(), CLINIC, t / 1.6, FH / 2, size=80)
    return [(1.8, s1), (2.4, s2), (1.6, s3), (3.4, s4), (1.8, lambda t: sbs2(morph_frame(0, 1.2), morph_frame(1, 1.2))), (2.0, SL_("الفينير على الموديل في المعمل", "يد الفني تديره ببطء")), (2.6, s7)]
@T("a21", "v22")
def a21():
    R = np.random.default_rng(2)
    def s1(t): return cover(SR, 1.2 + .04 * t)
    def s2(t):   # شبكة فسيفسائية من نفس اللقطة تتحرك
        base = cover(SR, 1.2); im = black(); n = 4; w, h = FW // n, FH // (n + 2)
        for i in range(n):
            for j in range(n + 2):
                ox = int(30 * math.sin(t * 3 + i + j)); tile = base.crop((i * w + ox, j * h, i * w + w + ox, j * h + h)); im.paste(tile, (i * w, j * h))
        d = ImageDraw.Draw(im)
        for i in range(1, n): d.line([(i * w, 0), (i * w, FH)], fill=(0, 0, 0), width=6)
        for j in range(1, n + 2): d.line([(0, j * h), (FW, j * h)], fill=(0, 0, 0), width=6)
        return im
    def s3(t): return cover(AF, 1.8, .5, .45)
    def s4(t):   # بورتريهان متقابلان
        a = cover(BF, 1.0); b = cover(SF, 1.0).transpose(Image.Transpose.FLIP_LEFT_RIGHT); return sbs2(a, b)   # qa-ok: مرآة صورة وش من غير نص (مقارنة متناظرة)
    BS = cover(BF, 2.6, .5, .66); AS = cover(SF, 1.35, .5, .5)
    def s5(t): return chip(BS if t < .6 else sweep(BS, AS, (t - .6) / .8), "قبل" if t < 1.0 else "بعد")
    noise = cv2.GaussianBlur(R.random((FH // 8, FW // 8)).astype(np.float32), (0, 0), 3); noise = cv2.resize((noise - noise.min()) / (np.ptp(noise) + 1e-6), (FW, FH))
    yy, xx = np.mgrid[0:FH, 0:FW]; dist = np.hypot(xx - FW / 2, yy - FH / 2) / np.hypot(FW / 2, FH / 2); field = dist * .7 + noise * .3
    def ink(a, b, p):   # حبر أزرق ينتشر
        m = (field < p * 1.05).astype(np.float32); edge = ((field < p * 1.05 + .04) & (field >= p * 1.05)).astype(np.float32)
        arr = np.array(a).astype(np.float32) * (1 - m[..., None]) + np.array(b).astype(np.float32) * m[..., None]
        arr = arr * (1 - edge[..., None]) + np.array([20, 60, 200], np.float32) * edge[..., None]; return Image.fromarray(arr.astype(np.uint8))
    def s6(t): return ink(AS, slot("الفينير على الموديل", "لقطة من المعمل"), ease(t / 1.2))
    return [(1.6, s1), (2.0, s2), (1.2, s3), (1.8, s4), (1.8, s5), (1.6, s6), (1.6, SL_("فينيرة على أداة التثبيت", "لقطة من المعمل")), (2.2, logo)]
@T("a22", "v23")
def a22():
    V = EL("veneer")
    def s1(t):   # الطبيب خلف المريضة: قوسا الأسنان القديمة وفينيرة تتشكل بين يديه بضوء ذهبي
        im = slot("الطبيب خلف المريضة يحرّك يديه", "خلفية بيضاء، يصوّره بإرشادنا"); im = ImageEnhance.Brightness(im).enhance(.6)
        g = Image.new("RGB", im.size); ImageDraw.Draw(g).ellipse((FW / 2 - 300, FH * .55 - 300, FW / 2 + 300, FH * .55 + 300), fill=(255, 190, 80)); g = g.filter(ImageFilter.GaussianBlur(120))
        im = screen(im, Image.blend(black(), g, .5 + .3 * math.sin(t * 4))); return paste(im, V, FW / 2, FH * .58, .2 + .5 * ease(t / 2.0), t * 40)
    def s3(t):   # تحليل النسب من عرض ما بين الأنياب + حلزون داخل سن
        sh = shot("A"); z = 1.12; im = A(z); im = outlines(im, sh, z, t / 1.0); im = pct_labels(im, sh, z, (t - .8) / 1.0)
        c = [q for q in sh.six if q["fdi"] == 11][0]; x0, y0 = sh.tf(c["x"], c["y"] + c["h"], z); x1, y1 = sh.tf(c["x"] + c["w"], c["y"], z)
        X0, X1, Y0, Y1 = min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1); w = min(X1 - X0, (Y1 - Y0) / 1.618)
        return spiral_on(im, X0, Y0, w, w * 1.618, ease((t - 1.6) / 1.2)) if t > 1.6 else im
    return [(2.8, s1), (1.6, lambda t: chip(cover(SF, 1.0 + .03 * t), "بعد")), (3.4, s3), (2.2, logo)]
@T("a23", "v24")
def a23():
    B = shot("B"); c11 = [q for q in B.six if q["fdi"] == 11][0]; r = c11["w"] / c11["h"] * 100
    def card(im, p):
        d = ImageDraw.Draw(im, "RGBA"); x = FW / 2 - 260 + (1 - ease(p)) * -700; y = FH * .58
        d.rounded_rectangle((x, y, x + 520, y + 260), 30, fill=(15, 15, 18, 235), outline=(90, 90, 95), width=2)
        d.text((x + 260, y + 60), "الثنية الأمامية", font=F(FA5, 34), fill="white", anchor="mm", direction="rtl")
        d.text((x + 260, y + 150), f"العرض ÷ الطول = {r:.0f}%", font=F(FA, 44), fill=GOLD, anchor="mm", direction="rtl")
        d.text((x + 260, y + 215), "محسوبة من صورة الحالة", font=F(FA5, 24), fill=(150, 150, 150), anchor="mm", direction="rtl"); return im
    def layers(t):   # مقطع لسن يبين طبقات الكومبوزيت
        im = Image.new("RGB", (FW, FH), (8, 8, 10)); d = ImageDraw.Draw(im, "RGBA"); cx, cy = FW * .45, FH * .45
        shape = lambda s_: [(cx + s_ * x, cy + s_ * y) for x, y in [(-160, -380), (160, -380), (190, 0), (150, 330), (0, 380), (-150, 330), (-190, 0)]]
        L_ = [("طبقة العاج", (232, 190, 140), 1.0), ("طبقة المينا", (245, 235, 220), .86), ("الطبقة الشفافة", (200, 225, 255), .72)]
        for i, (n, c, s_) in enumerate(L_):
            q = ease((t - i * 1.0) / .6)
            if q <= 0: continue
            d.polygon(shape(s_ * (.9 + .1 * q)), fill=c + (int(230 * q),), outline=(255, 255, 255, int(200 * q)))
            y = FH * .74 + i * 90; d.rounded_rectangle((90, y - 20, 330, y + 20), 20, fill=c + (255,)); d.polygon([(330, y - 10), (380, y), (330, y + 10)], fill=(200, 200, 200))
            d.text((FW - 80, y), n + " — اسم المادة من الطبيب", font=F(FA5, 34), fill=(255, 255, 255, int(255 * q)), anchor="rm", direction="rtl")
        return im
    BS = cover(BF, 2.6, .5, .66); AS = cover(SF, 1.35, .5, .5)
    return [(2.4, lambda t: chip(card(cover(BF, 1.0), t / .8), "قبل")), (1.6, SL_("المريضة تلتفت (صورة جانبية)", "نقاط على ملامح الوجه")),
            (2.0, lambda t: sweep(BS, AS, (t - .5) / .9)), (3.8, layers), (1.8, SL_("فيديو المريضة بعد", "تبتسم للكاميرا")), (2.2, logo)]
@T("a24", "v25")
def a24():
    fp = face_pts(BFc); mb = mouth_box(); mx, my = (mb[0] + mb[2]) / 2, (mb[1] + mb[3]) / 2
    idx = list(range(0, len(fp), 9)); tri = delaunay(fp[idx])
    def s1(t):
        im = cover(BF, 1.0); d = ImageDraw.Draw(im, "RGBA"); P = fp[idx]
        for a, b, c in tri[:int(len(tri) * ease(t / 1.4))]: d.line([tuple(P[a]), tuple(P[b]), tuple(P[c]), tuple(P[a])], fill=(255, 255, 255, 90), width=1)
        return txt(im, (FW / 2, FH * .9), "خطة واحدة متكاملة لابتسامة جديدة", 50, alpha=ease((t - .8) / .4))
    P_ = Particles(cover(BF, 2.4, .5, .62), (FW * .2, FH * .45, FW * .8, FH * .6), 1500, 500, grav=900)
    def s2(t): im = cover(BF, 2.4, .5, .62); im = ImageEnhance.Brightness(im).enhance(.5) if t > .3 else im; return P_.draw(im, t - .3, 1.4) if t > .3 else im
    def s6(t):   # شعارا الطبيبين
        im = Image.new("RGB", (FW, FH), (6, 6, 7)); d = ImageDraw.Draw(im); p = ease(t / .6)
        for k, (n, r_) in enumerate(((DOC, "أخصائي التركيبات والزراعة"), ("اسم الطبيب الثاني", "طب الأسنان التجميلي"))):
            y = FH * (.35 + .3 * k); col = tuple(int(c * p) for c in GOLD); d.ellipse((FW / 2 - 70, y - 200, FW / 2 + 70, y - 60), outline=col, width=4); tooth_icon(d, FW / 2, y - 130, 45, col, 4)
            d.text((FW / 2, y), n, font=F(FA, 60), fill=col, anchor="mm", direction="rtl"); d.text((FW / 2, y + 70), r_, font=F(FA5, 38), fill=(200, 200, 200), anchor="mm", direction="rtl")
        return im
    return [(2.4, s1), (1.8, s2), (1.6, SL_("الزرعات والدعامات (لو الحالة فيها)", "رسم توضيحي يتولّد ويُكتب عليه توضيحي")), (2.2, lambda t: chip(morph_frame(ease(t / .8), 1.06), "الفينير")),
            (3.4, lambda t: analysis_A(t, 1.1, sig=False)), (1.6, lambda t: chip(cover(SF, 1.0 + .03 * t), "بعد")), (2.6, s6)]
@T("a25", "v26")
def a25():
    M = morph_setup(); ST = EL("stick"); mb = mouth_box(); mx, my = (mb[0] + mb[2]) / 2, (mb[1] + mb[3]) / 2; B = shot("B"); Bt = {t["fdi"]: t for t in B.teeth_all}
    def s2(t): im = cover(BF, 1.0 + .02 * t); return paste(im, ST, FW + 300 - (FW + 300 - mx - 120) * ease(t / 1.2), my - 200 + 150 * ease(t / 1.2), .5, -20)
    def s4(t):   # عصي كتير تركّب الفينير سنة سنة
        prog = {k: ease((t - .3 - i * .25) / .25) for i, k in enumerate(M["order"])}; im = up(prog)
        for i, k in enumerate(M["order"]):
            ft = t - .3 - i * .25
            if -0.4 < ft < .4: x, y = up_tf(Bt[k]["cx"], Bt[k]["y"] + Bt[k]["h"] / 2); im = paste(im, ST, x + 60, y - 300 * (1 - ease((ft + .4) / .4)) - 150, .35, -15)
        return im
    def s6(t):   # مسبار يلمس سنة فتضيء
        sh = shot("A"); z = 1.12; im = A(z); im = outlines(im, sh, z, 1.0, width=2); im = pct_labels(im, sh, z, 1.0)
        c = [q for q in sh.six if q["fdi"] == 21][0]; x, y = sh.tf(c["cx"], c["y"] + c["h"] * .5, z); q = ease((t - .6) / .4)
        im = outlines(im, type("S", (), {"six": [c], "tf": sh.tf, "teeth_all": [c]})(), z, q, col=(255, 230, 140), width=8, glow=True) if q > 0 else im
        d = ImageDraw.Draw(im); px = x - 600 * (1 - ease(t / .6)); d.line([(px - 500, y - 300), (px, y)], fill=(200, 205, 215), width=10); d.line([(px - 500, y - 300), (px, y)], fill=(250, 250, 255), width=3); return im
    return [(1.4, lambda t: chip(cover(BF, 1.0 + .03 * t), "قبل")), (1.8, s2), (1.0, lambda t: up(0)), (len(M["order"]) * .25 + .8, s4), (1.6, lambda t: chip(cover(SF, 1.0 + .03 * t), "بعد")),
            (2.4, s6), (1.8, lambda t: sweep(cover(BF, 2.6, .5, .66), cover(SF, 1.35), (t - .4) / .9)), (2.2, logo)]
@T("a26", "v28")
def a26():
    def ruler(t):   # مسطرة قياس نازلة من فوق
        im = cover(SF, 1.3); d = ImageDraw.Draw(im, "RGBA"); y = -900 + 1200 * ease(t / 1.0); x = FW / 2 - 50
        d.rectangle((x, y, x + 100, y + 900), fill=(235, 235, 240, 230), outline=(60, 60, 60, 255), width=3)
        for k in range(0, 900, 15): d.line([(x, y + k), (x + (40 if k % 75 == 0 else 20), y + k)], fill=(30, 30, 30, 255), width=2)
        return im
    def s5(t):   # هيمنة الثنايا + مناطق الانعكاس
        sh = shot("A"); z = 1.12; im = A(z); cc = lambda q: (255, 210, 90) if q["fdi"] % 10 == 1 else (120, 200, 255)
        im = outlines(im, sh, z, t / 1.0, col=cc, width=5, glow=True); return txt(im, (FW / 2, 130), "هيمنة الثنايا الأمامية", 52, alpha=ease((t - .8) / .4), fill=(255, 210, 90))
    def s6(t):   # الأسنان بالأبيض والأسود لتحليل الإضاءة والفراغات عند اللثة
        sh = shot("A"); z = 1.12; im = bw(A(z)); im = outlines(im, sh, z, 1.0, width=2); return txt(im, (FW / 2, 130), "درجة الإضاءة", 52, alpha=ease(t / .4))
    return [(1.8, SL_("المريضة تضحك (فيديو)")), (1.6, SL_("فرجار الأسنان يقيس أسنانها", "الأداة الحقيقية بيد الطبيب")), (1.6, ruler),
            (1.8, SL_("الفرجار يحمل الفينير وعصي التركيب تضعه")), (2.6, s5), (2.0, s6), (1.6, lambda t: chip(cover(SF, 1.0 + .03 * t), "بعد")), (2.2, logo)]
CITY = (json.load(open(CASE_DIR + "/case.json")).get("settings", {}).get("city") if CASE_DIR else None) or "القاهرة"   # إعداد القالب: مدينة العيادة — العميل بيختارها، والمعالم بتتعمل مرة واحدة بالأداة tools/city_assets.py في assets/city/<المدينة>/
@T("a27", "v31")
def a27():
    V = key_black(L(S + "assets/veneer_upper.png")); V = V.crop(V.getbbox()); sh = shot("A"); fa = faces_aligned(); mx, my = fa["lm"][13]
    lab = asset_clip("lab_tech")
    CD = S + f"assets/city/{CITY}/"; LM = [L(CD + f"l{k}.png") for k in range(3) if _os.path.exists(CD + f"l{k}.png")] or [L(G + "plane.png")]
    PLANE = L(CD + "plane.png") if _os.path.exists(CD + "plane.png") else L(G + "plane.png")   # الطيارة فوق مدينة العميل نفسها
    def s1(t): return cover(lab.at(t), 1.0 + .02 * t) if lab else cover(L(S + "assets/lab_tech.png"), 1.0 + .03 * t)   # فني المعمل بيشتغل على العدسة
    def s2(t):   # العدسة طايرة فوق معالم المدينة (كل معلم ثانيتين، بانتقال ناعم)
        k = min(len(LM) - 1, int(t / 2.0)); u = t - 2.0 * k; im = cover(LM[k], 1.0 + .04 * u)
        if u < .35 and k > 0: im = blend(cover(LM[k - 1], 1.08), im, u / .35)
        x = FW * (1.15 - 1.3 * (u / 2.0)); y = FH * (.3 + .25 * math.sin(u * 1.6 + k)); return paste(im, V, x, y, FW * (.16 + .05 * math.sin(u * 3)) / V.width, u * 140 + k * 60)
    def s3(t):   # الطيارة واسم المدينة
        im = cover(PLANE, 1.0 + .05 * t); im = paste(im, V, -100 + (FW + 200) * t / 2.0, FH * .55 - 150 * math.sin(t * 1.5), FW * .14 / V.width, t * 160)
        return txt(im, (FW / 2, FH * .12), CITY, 72, alpha=ease((t - .2) / .4))
    def s4(t): im = cover(L(G + "earth.png"), 1.0 + .5 * ease(t / 3.0)); return paste(im, V, FW / 2 + 200 * math.sin(t), FH / 2 - 500 * (1 - ease(t / 3.0)), FW * (.06 + .16 * ease(t / 3.0)) / V.width, t * 200)
    def s5(t):   # الهبوط: العدسة بتنزل على السنان والقبل بيتحول للبعد في نفس المكان
        im = morph_frame(ease((t - .4) / .7), 1.06); q = 1 - ease(t / .5)
        return paste(im, V, FW * .3, FH * .35, FW * .22 / V.width * (1 + q), 200 * q, alpha=1 - ease((t - .35) / .2)) if t < .55 else im
    PLA = dict(lines=.0, stagger=.15, draw=.6, mid=1.4, pct=2.2, arc=3.2, gold=4.0, title=99, label="")
    def s6(t): return anim.render(sh, t, 1.1, PLA)   # تحليل كامل للبعد
    def s7(t): return cam(face_mix(1), mx, my, 3.2 - .3 * ease(t / 2.0), 60 - 20 * ease(t / 2.0))   # الشفايف بعد (عالية الجودة)
    sa = asset_clip("smile_after_lock", "smile_after")
    def s8(t): return cover(sa.at(t), 1.06 - .05 * ease(t / 5.0)) if sa else cover(AP, 1.06 - .05 * t / 5)   # الوش بعد العلاج (فيديو حي متقفل السنان)
    return [(4.0, s1), (6.0, s2), (2.0, s3), (3.0, s4), (1.2, s5), (5.0, s6), (2.0, s7), (5.0, s8), (1.0, logo)]
@T("a28", "v33")
def a28():   # قالب المعمل: السيراميك على الكاست + التصميم الرقمي الرمادي + جسر الزرعات
    if not _CAST: cast_spin(0)
    ST = _CAST["st"]; ST = ST.crop(ST.getbbox())
    def gray(e):   # نسخة "التصميم الرقمي" الرمادية من نفس الكاست (نفس الشكل بالظبط)
        a = np.array(e).astype(np.float32); g = a[..., :3].mean(2, keepdims=True); g = cv2.GaussianBlur(g, (0, 0), 1.2)[..., None] if g.ndim == 3 else g
        g = np.clip((g - 60) * 1.15 + 40, 0, 255); return Image.fromarray(np.dstack([g, g, g, a[..., 3:]]).astype(np.uint8), "RGBA")
    GR = gray(ST)
    def on(bg, e, x, y, h, ang=0): return paste(bg, e, x, y, h / e.height, ang)
    def s1(t):   # تلت لقطات للسيراميك على الكاست
        im = black()
        for k in range(3):
            q = ease((t - k * .15) / .3)
            if q > 0: im = on(im, ST, FW / 2, FH * (.18 + .32 * k) + 60 * (1 - q), FH * .28, (k - 1) * 12)
        return im
    def s2(t):   # التصميم الرقمي الرمادي جنب السيراميك الحقيقي، والاتنين بيلفوا
        im = black(); a = 8 * math.sin(t * 1.2); im = on(im, GR, FW * .3, FH * .5, FH * .7, a); return on(im, ST, FW * .74, FH * .5, FH * .7, a)
    LEG = [("فينير", (80, 140, 255)), ("تاج زرعة ملصوق", (255, 60, 60)), ("تاج زركونيا", (255, 160, 60)), ("تاج زرعة بمسمار", (190, 80, 255))]
    def s3(t):   # حواف مضيئة ملونة على التصميم الرمادي + الدليل
        im = on(black(), GR, FW * .58, FH * .58, FH * .74); al = ((np.array(im).max(2) > 12) * 255).astype(np.uint8)
        ed = cv2.Canny(al, 50, 150); ys = np.arange(FH)[:, None] * np.ones((1, FW)); col = np.zeros((FH, FW, 3), np.float32)
        for k, (_, c) in enumerate(LEG): sel = (ys >= FH * k / 4) & (ys < FH * (k + 1) / 4); col[sel] = c
        q = ease(t / .8); ed = (cv2.GaussianBlur(cv2.dilate(ed, np.ones((5, 5), np.uint8)), (0, 0), 6).astype(np.float32) / 255 * 2.2 * q)[..., None]
        im = Image.fromarray(np.clip(np.array(im).astype(np.float32) + col * ed, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(im)
        for k, (n, c) in enumerate(LEG): y = FH * .04 + 30 + k * 56; d.rounded_rectangle((FW - 92, y - 16, FW - 60, y + 16), 7, fill=c); d.text((FW - 110, y), n, font=F(FA5, 32), fill=(230, 230, 230), anchor="rm", direction="rtl")
        return im
    def s4(t): return on(black(), GR, FW * .5, FH * .5, FH * (.95 + .2 * ease(t / 1.5)))   # تقريب على التصميم
    IB = key_black(L(S + "assets/implant_bridge_occlusal.png")) if _os.path.exists(S + "assets/implant_bridge_occlusal.png") else ST
    def s5(t): return on(black(), IB.crop(IB.getbbox()), FW * .5, FH * .5, FH * (.8 + .08 * t / 3.7), -25 + 30 * ease(t / 3.7))   # جسر الزرعات من فوق وفتحات المسامير
    def s6(t): return on(Image.new("RGB", (FW, FH), (246, 246, 244)), ST, FW * .5, FH * .5, FH * (.8 + .1 * ease(t / 2.2)), 6 - 6 * ease(t / 2.2))   # السيراميك على خلفية بيضا
    def s7(t): return cam(on(black(), ST, FW * .5, FH * .5, FH * .9), FW * .38, FH * .5, 2.0 + .3 * t, 35)   # ماكرو على السيراميك
    def lab_logo(v):
        im = logo(v); return txt(im, (FW / 2, FH / 2 + 220), "اسم المعمل", 44, fill=(200, 200, 200))
    return [(.7, lab_logo), (1.3, s1), (3.2, s2), (2.3, s3), (1.5, s4), (3.7, s5), (2.2, s6), (1.5, s7), (2.2, lab_logo)]
def match_into(E, nxt, T=.7):
    """أداة عامة (ملاحظات a29/a30): لقطتين ورا بعض لنفس الابتسامة بمقاسين مختلفين ← زووم ناعم من مقاس الأولى لمقاس التانية
    (الاتنين متطابقين في كل لحظة) بدل القطع. E = آخر كادر في اللي قبلها، nxt = دالة اللقطة الجديدة."""
    def tb(im):
        h = np.array(im.convert("HSV")); m = (h[..., 2] > 170) & (h[..., 1] < 60); ys, xs = np.where(m)
        return (np.percentile(ys, 3), np.percentile(ys, 97), np.median(xs), np.median(ys)) if len(ys) > 500 else None
    E = auto_gum(E); A0 = nxt(0.0); a, b = tb(E), tb(A0)
    if a is None or b is None: return nxt
    (a0, a1, ax, ay), (b0, b1, bx, by) = a, b; RZ = (b1 - b0) / max(1, a1 - a0)
    def f(t):
        if t >= T: return nxt(t)
        e = ease(t / T); zz = 1 + (RZ - 1) * e; cx_ = ax + (bx - ax) * e; cy_ = ay + (by - ay) * e
        old_ = E.transform(E.size, Image.AFFINE, (1 / zz, 0, ax - cx_ / zz, 0, 1 / zz, ay - cy_ / zz), Image.BICUBIC)
        nw = auto_gum(nxt(t)); new_ = nw.transform(nw.size, Image.AFFINE, (RZ / zz, 0, bx - cx_ * RZ / zz, 0, RZ / zz, by - cy_ * RZ / zz), Image.BICUBIC)
        im = Image.blend(old_, new_, e); im.info["no_auto_gum"] = True; return im
    return f
@T("a30", "v39")
def a30():
    mb = mouth_box(); mx, my = (mb[0] + mb[2]) / 2, (mb[1] + mb[3]) / 2; TU = EL("turbine")
    def phone(im, cx, cy, sc, ang, screen_img):
        W_, H_ = int(420 * sc), int(860 * sc); ph = Image.new("RGBA", (W_, H_)); d = ImageDraw.Draw(ph); d.rounded_rectangle((0, 0, W_ - 1, H_ - 1), int(60 * sc), fill=(20, 20, 24, 255), outline=(120, 120, 130, 255), width=4)
        scr = cover(screen_img, 1.0, W=W_ - int(40 * sc), H=H_ - int(60 * sc)); m = Image.new("L", scr.size); ImageDraw.Draw(m).rounded_rectangle((0, 0, scr.width, scr.height), int(40 * sc), fill=255); ph.paste(scr, (int(20 * sc), int(30 * sc)), m)
        return paste(im, ph, cx, cy, 1.0, ang)
    BM0 = Bm(1.0, 0)   # الشاشة بتعرض نفس كادر الماكرو اللي بعدها بالظبط، فالدخول جواها من غير قفزة (ملاحظة a30 3.5)
    def s2(t):   # الهاتف بالعرض وهو بيصور البق (زي الأصل، ملاحظة a30 2.7)
        im = cover(BF, 1.0); p = ease(t / 1.0); return phone(im, mx + 600 * (1 - p), my, .9, 90 - 20 * (1 - p), BM0)
    def s3(t):   # الهاتف بيلف لوضع الطول (ملاحظة a30 3.3) وبعدين ندخل جوه الشاشة على الماكرو
        r_ = ease(t / .5); z_ = ease((t - .35) / .65); im = cover(BF, 1.0)
        im = phone(im, mx + (FW / 2 - mx) * z_, my + (FH / 2 - my) * z_, .9 + 2.15 * z_, 90 * (1 - r_), BM0)
        return blend(im, BM0, (t - .8) / .2)
    P = Particles(None, (FW * .3, FH * .3, FW * .7, FH * .7), 1000, 400, col=(240, 240, 240), grav=200)
    def s5(t):   # التربينة تمر على الأسنان مع غبار أبيض
        im = Bm(1.2, 0); x = FW + 400 - (FW + 800) * t / 3.7; im = P.draw(im, max(0, t - .4) * .5, 1.6); return paste(im, TU, x, FH * .5, .5, 90)
    def s7(t):   # تحليل بالأبيض والأسود مع النسب
        sh = shot("A"); z = 1.12; im = bw(A(z)); im = outlines(im, sh, z, t / 1.0, width=2); im = pct_labels(im, sh, z, (t - .8) / 1.0); my_ = sh.tf(sh.mid, 0, z)[1]; w = 220
        im = spiral_on(spiral_on(im, 40, my_, w, w * 1.618, ease((t - .6) / 1.2)), 40, my_ - w * 1.618, w, w * 1.618, ease((t - .6) / 1.2), True)
        return Image.blend(im, bw(A(z)).convert("RGB"), ease((t - 3.4) / .4))   # الرسومات بتختفي بنعومة قبل ما الابتسامة تتلوّن
    def sM(t): return Bm(1.2 + .03 * t, 0)   # ماكرو القبل
    def s4(t):   # فحص بالمراية والمسبار على سنان القبل (الأدوات بتتحرك على السنان نفسها)
        im = Bm(1.2, 0); B_ = shot("B"); Bt = {q["fdi"]: q for q in B_.teeth_all}
        k1, k2 = (11, 12) if t < 2.0 else (21, 13); u = (t % 2.0) / 2.0; a = ease(t / .4) * (1 - ease((t - 3.6) / .4))
        def at(k, fy): q = Bt.get(k, B_.six[0]); return B_.tf(q["cx"], q["y"] + q["h"] * fy, 1.2)
        p1 = np.array(at(k1, .2)); p2 = np.array(at(k2, .7)); tip = p1 + (p2 - p1) * ease(u); mc = np.array(at(k1, .45)) + np.array([-170, -40])
        im = draw_mirror(im, (mc[0], mc[1] + 40 * math.sin(t * 2)), 80, a, (240, -420), refl=ImageEnhance.Brightness(im.filter(ImageFilter.GaussianBlur(2))).enhance(.75)); return draw_probe(im, (tip[0], tip[1]), a, (-200, 400))
    M06, M16 = auto_gum(morph_frame(0, 1.1)), auto_gum(morph_frame(1, 1.1))   # اللثة لحد الحافة قبل المسح (ملاحظة a30 13.5: كان باين فراغ إسود يمين)
    def s6(t): im = sweep(M06, M16, (t - .2) / .9); im.info["no_auto_gum"] = True; return im   # العدسات بتقعد على السنان المحضّرة
    LBL = [("الفصوص الرأسية", 11, .3), ("الهالة القاطعة", 11, .97), ("المنطقة الشفافة", 21, .9), ("حافة اللثة", 21, .05)]
    def s9(t):   # البعد + أسماء تفاصيل السنة + التوقيع
        e0 = ease(t / 1.0); sh = shot("A"); z = 1.12 + .13 * e0; im = A(z)   # بيبدأ بنفس كادر الأبيض والأسود اللي قبله، وبيتلوّن ويقرّب بنعومة (ملاحظة a30 18.8)
        if e0 < 1: im = Image.blend(bw(im).convert("RGB"), im, e0)
        d = ImageDraw.Draw(im); St = {q["fdi"]: q for q in sh.six}
        for n, (s_, k_, fy) in enumerate(LBL):
            q = ease((t - .4 - n * .5) / .4)
            if q <= 0 or k_ not in St: continue
            x, y = sh.tf(St[k_]["cx"], St[k_]["y"] + St[k_]["h"] * fy, z); tx = 70 if n % 2 == 0 else FW - 70; ty = FH * (.15 + .2 * n)
            d.ellipse((x - 6, y - 6, x + 6, y + 6), fill="white"); d.line([(x, y), (tx + (200 if n % 2 == 0 else -200), ty + 20), (tx, ty + 20)], fill="white", width=2)
            im = txt(im, (tx, ty), s_, 34, anchor="lm" if n % 2 == 0 else "rm", alpha=q); d = ImageDraw.Draw(im)
        return signature(im, (t - 2.5) / 1.4, y=FH * .93) if t > 2.5 else im
    def s10(t):   # ملاحظة a30 28.7: المورف في النص كان باين فيه سنان مزدوجة طول الوقت ← ثبات على قبل/بعد وتحول ناعم سريع (0.45ث) بينهم
        u = (t % 2.5) / 2.5; x = min(1, u / .18) if u < .5 else 1 - min(1, (u - .5) / .18); pr = x * x * (3 - 2 * x)
        return chip(morph_frame(pr, 1.06, 0), "بعد" if pr > .5 else "قبل")   # قبل/بعد على الماكرو — بيتحول بنعومة رايح جاي (مورف) بدل القلبات الحادة (ملاحظة a30 25.8)
    fa = faces_aligned(); fmx, fmy = fa["lm"][13]; sa = asset_clip("smile_after_lock", "smile_after")
    s9 = push(s9, 6.0)   # كان لقطة متجمدة (فلتر الفيديو)
    return [(1.4, lambda t: cam(face_mix(0), fa["A"].width / 2, fa["A"].height * .48, 1.05 + .03 * t, 0)), (1.4, s2), (1.0, s3), (1.2, sM), (4.0, s4), (3.7, s5), (1.2, s6), (1.2, match_into(s6(1.19), lambda t: A(1.08 + .03 * t))),
            (3.8, s7), (6.0, s9), (5.0, s10), (2.5, lambda t: cam(face_mix(1), fmx, fmy, 3.0 + .2 * t, 60)), (2.5, lambda t: cover(sa.at(t), 1.03) if sa else cover(AP, 1.03)), (3.5, logo)]

@T("a33", "v43")
def a33():
    SH = [(246, 240, 226), (240, 230, 205), (236, 222, 190), (232, 214, 176), (228, 210, 182), (226, 206, 168)]; LB = ["A1", "A2", "A3", "B1", "B2", "C1"]
    def s2(t):   # دليل اللون قدام الأسنان ويتسحب منه اللون المختار
        im = cover(SF, 1.3); d = ImageDraw.Draw(im, "RGBA"); y0 = FH * .62 + 300 * (1 - ease(t / .6)); d.rectangle((FW * .1, y0 + 150, FW * .9, y0 + 230), fill=(150, 160, 175, 240))
        for i, (c, l) in enumerate(zip(SH, LB)):
            x = FW * .14 + i * 140; dy = -120 * ease((t - 1.2) / .5) if i == 0 else 0; d.rounded_rectangle((x, y0 + dy, x + 100, y0 + 160 + dy), 40, fill=c + (255,), outline=(180, 170, 150), width=2)
            d.text((x + 50, y0 + 195), l, font=F("TY-Outfit-700.ttf", 30), fill=(20, 25, 35), anchor="mm")
        return im
    def s5(t):   # شبكة تحليل ذهبية: المنتصف وقوس الابتسامة و0.618 / 1.618
        sh = shot("A"); z = 1.12; im = A(z); im = midline(im, sh, z, t / .6, col=(214, 178, 106)); im = arc_line(im, sh, z, (t - .4) / 1.0)
        im = outlines(im, sh, z, (t - .6) / 1.0, col=(214, 178, 106), width=2); im = txt(im, (FW / 2, 130), "0.618  /  1.618", 56, font=FSER, rtl=False, fill=(214, 178, 106), alpha=ease((t - 1.4) / .4)); return im
    def s6(t):   # المريض قبل وبعد في لقطة واحدة
        im = Image.new("RGB", (FW, FH), (12, 12, 14)); a = cover(BF, 1.0, W=FW // 2 + 60, H=FH); b = cover(SF, 1.0, W=FW // 2 + 60, H=FH)
        x = int(-200 * (1 - ease(t / .6))); im.paste(a, (x, 0)); im.paste(b, (FW // 2 - 60 - x, 0)); return txt(txt(im, (FW * .25, 110), "قبل", 50), (FW * .75, 110), "بعد", 50)
    return [(1.6, SL_("المريضة تلتقط سيلفي", "والهاتف يتبدل")), (2.2, s2), (1.8, SL_("يد الطبيب تمرر نموذج الفينير", "النموذج نفسه هو المسح للصورة بعد")), (1.6, lambda t: chip(cover(SF, 1.0 + .03 * t), "بعد")),
            (2.6, s5), (2.2, s6), (2.2, logo)]
@T("a34", "v44")
def a34():
    fp = face_pts(BFc); cx, cy = fp[1]; mb = mouth_box(); mx, my = (mb[0] + mb[2]) / 2, (mb[1] + mb[3]) / 2; ST = EL("stick")
    def s1(t):   # بطاقة قياس دائرية تمر قدام الوش وترسم أقواس ذهبية
        im = cover(BF, 1.0); d = ImageDraw.Draw(im, "RGBA"); x = FW + 400 - (FW + 800) * ease(t / 2.0); R = 330
        d.ellipse((x - R, cy - R, x + R, cy + R), fill=(12, 12, 14, 225), outline=(200, 200, 200, 255), width=3)
        for a in range(0, 360, 6): r2 = R - (24 if a % 30 == 0 else 12); aa = math.radians(a + t * 60); d.line([(x + R * math.cos(aa), cy + R * math.sin(aa)), (x + r2 * math.cos(aa), cy + r2 * math.sin(aa))], fill=(220, 220, 220, 255), width=2)
        for k in range(4):
            q = ease((t - .5 - k * .3) / .6)
            if q > 0: rr = 250 + k * 150; d.arc((cx - rr, cy - rr, cx + rr, cy + rr), 200, 200 + 140 * q, fill=(214, 178, 106, 230), width=3)
        return im
    def s3(t):   # فينيرات على عصي التجربة تطفو قدام الفم وتتجمع
        im = ImageEnhance.Brightness(cover(BF, 1.0)).enhance(.6); r = np.random.default_rng(5)
        for i in range(8):
            a = r.uniform(0, 2 * np.pi); p = ease((t - i * .1) / 1.4); x = mx + (i - 3.5) * 60 * p + 500 * (1 - p) * math.cos(a); y = my - 120 + 600 * (1 - p) * math.sin(a)
            im = paste(im, ST, x, y, .28, -20 + 10 * math.sin(t * 3 + i))
        return im
    def s5(t):
        sh = shot("A"); z = 1.12; im = A(z); im = outlines(im, sh, z, t / 1.0, width=2); im = pct_labels(im, sh, z, (t - .8) / 1.0)
        for i, l in enumerate(["المنطقة الشفافة", "الهالة", "حافة اللثة"]):
            q = ease((t - 1.8 - i * .3) / .3)
            if q > 0: im = txt(im, (70, FH * (.3 + .15 * i)), l, 40, anchor="lm", alpha=q)
        return im
    return [(2.6, s1), (1.6, SL_("نموذج الفينير يمسح الوجه", "يد الطبيب تمرّره")), (2.2, s3), (1.6, lambda t: chip(cover(SF, 1.0 + .03 * t), "بعد")), (3.0, s5), (1.4, lambda t: cover(SF, 1.0 + .02 * t)), (2.2, logo)]

# ======================= أ٣١ كامل على مرجع 40 (31.9ث، 11 مشهد) =======================
@T("a31", "v40")
def a31():
    _av = sys.argv; sys.argv = ["card", "x", "x", "0"]; import card as CD; sys.argv = _av
    sh = shot("A"); z0 = 1.04
    six = sorted(sh.six, key=lambda t: t["cx"])
    GUM = [(40, 90, 255), (255, 220, 40), (255, 40, 40), (40, 230, 70), (255, 140, 30), (160, 70, 255)]
    def gum_lines(im, t, p, on_black=False, w=7):
        lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
        for i, tt in enumerate(six):
            q = ease(p * 1.6 - i * .12)
            if q <= 0: continue
            c = tt["c"]; top = c[c[:, 1] < tt["y"] + tt["h"] * .32]; top = top[np.argsort(top[:, 0])]
            pts = anim.partial([sh.tf(x, y, z0) for x, y in top[::2]], q); d.line(pts, fill=GUM[i] + (255,), width=w)
            if on_black:   # الشكل الملون الممتلي (زي الأصل)
                poly = pts + [(x + 60, y) for x, y in pts[::-1]]; d.polygon(poly, fill=GUM[i] + (150,))
        g = lay.filter(ImageFilter.GaussianBlur(10)); base = im.convert("RGBA")
        return Image.alpha_composite(Image.alpha_composite(base, g), lay).convert("RGB")
    PLAN = dict(lines=.0, stagger=.15, draw=.6, mid=1.0, pct=1.6, arc=2.4, gold=99, title=99, label="")
    PATH = []
    for tt in sorted(six, key=lambda q: q["cx"]):   # مسار واحد متصل على الحواف القاطعة سنة ورا سنة
        c = tt["c"]; band = c[c[:, 1] > tt["y"] + tt["h"] * .78]; band = band[np.argsort(band[:, 0])]; PATH += [sh.tf(x, y, z0) for x, y in band[::2]]
    PATH = np.array(PATH, np.float32); SEG = np.r_[0, np.cumsum(np.hypot(*np.diff(PATH, axis=0).T))]; LEN = SEG[-1]
    def fire(im, p, t):   # خط نار بيجري على الأطراف زي الثعبان: راس منورة وديل بيخفت (مش بيظهر كله مرة واحدة)
        W = LEN * .34; head = (LEN + W) * min(1.0, max(0.0, p)); tail = head - W; lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
        ss = np.linspace(max(0, tail), min(LEN, head), 60)
        if len(ss) < 2 or ss[-1] <= ss[0]: return im
        P = np.c_[np.interp(ss, SEG, PATH[:, 0]), np.interp(ss, SEG, PATH[:, 1])]; r = np.random.default_rng(int(t * 30))
        for k in range(len(P) - 1):
            f = (ss[k] - tail) / W; wd = int(5 + 17 * f); jit = r.normal(0, 2.5, 2)
            d.line([tuple(P[k] + jit), tuple(P[k + 1])], fill=(255, int(110 + 90 * f), 30, int(255 * min(1, .2 + f))), width=wd)
            d.line([tuple(P[k]), tuple(P[k + 1])], fill=(255, 245, 190, int(255 * f)), width=max(1, wd // 3))
        hx, hy = P[-1]; d.ellipse((hx - 14, hy - 14, hx + 14, hy + 14), fill=(255, 250, 220, 255))
        g = lay.filter(ImageFilter.GaussianBlur(14)); return Image.alpha_composite(Image.alpha_composite(im.convert("RGBA"), g), Image.alpha_composite(g, lay)).convert("RGB")
    c11 = [t for t in six if t["fdi"] == 11][0]
    def labels(im, t):
        lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
        cx, cy = sh.tf(c11["cx"], c11["y"] + c11["h"] * .5, z0); q = ease(t / .5)
        d.line([(cx - 400 * q, cy), (cx + 400 * q, cy)], fill=(255, 255, 255, 200), width=2); d.line([(cx, cy - 300 * q), (cx, cy + 300 * q)], fill=(255, 255, 255, 200), width=2)
        im = Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
        for j, (s_, fy) in enumerate((("المنطقة الشفافة", .82), ("الهالة القاطعة", .97), ("حافة اللثة", .04))):
            qq = ease((t - .5 - j * .5) / .4)
            if qq > 0:
                px, py = sh.tf(c11["cx"], c11["y"] + c11["h"] * fy, z0); ty = [FH * .28, FH * .40, FH * .72][j]; d2 = ImageDraw.Draw(im)
                d2.ellipse((px - 7, py - 7, px + 7, py + 7), fill="white"); d2.line([(px, py), (390, ty), (60, ty)], fill=(255, 255, 255), width=2)
                im = txt(im, (60, ty - 32), s_, 36, anchor="lm", alpha=qq)
        return im
    def s1(t): return CD.scene1(t)                                              # 0–4.5 البطاقة
    def s2(t): return A(1.0 + .04 * t / 1.5)                                     # 4.5–6 الماكرو معزول
    def s3(t): return gum_lines(black(), t, t / 1.2, on_black=True, w=10)        # 6–8 أشكال اللثة الملونة على الأسود
    def s4(t): return gum_lines(A(z0), t, 1.0, w=4) if t < .5 else A(z0)         # 8–9 السنان تظهر بالخطوط الملونة
    def s5(t): return anim.render(sh, t, z0, PLAN)                              # 9–14 النسب والحلزون
    def s6(t): return fire(A(z0), t / 1.45, t)                                    # 14–15.5 خط النار
    def s7(t): return labels(A(z0), t)                                           # 15.5–18 أسماء المناطق
    def s8(t): return A(z0 + .02 * t)                                            # 18–19.5
    if not hasattr(CD, "_ART"): CD._ART = Clip(S + "ana/art/art.mp4", loop=False)
    D = CD.teeth_dist(CD.S2, 1.04); RM = float(D.max()) + 60
    def rev(base, art, r):
        a = np.clip((r - D) / 40.0, 0, 1)[..., None]; return Image.fromarray((np.array(art) * a + np.array(base) * (1 - a)).astype(np.uint8))
    def s9(t):   # 19.5–25.5: الفن يطلع من جوه السنان ويرجع لها
        a = CD._ART.at(min(t, 4.99)); base = CD.back(0)
        if t < 1.0: return rev(base, a, ease(t / 1.0) * RM)
        if t > 5.0: return rev(base, a, (1 - ease((t - 5.0) / 1.0)) * RM)
        return a
    def s10(t): return outlines(A(z0), sh, z0, t / 1.6, width=3, stagger=.25)    # 25.5–27.5 رسم الحدود سنة سنة
    return [(4.5, s1), (1.5, s2), (2.0, s3), (1.0, s4), (5.0, s5), (1.5, s6), (2.5, s7), (1.5, s8), (6.0, s9), (2.0, s10), (4.4, logo)]

# ======================= أ٩ درس القياس كامل على مرجع 8 (24.9ث) =======================
_ELD = (CASE_DIR + "/elements/") if CASE_DIR else S + "tools/out/"
AP = L(_ELD + "after_portrait_v3.png")       # مشتق v3: البق كله (شفايف + سنان) من صورة الابتسامة الحقيقية بعد العلاج، متدمج (عدّى الفلتر 9/10)
APH = L(_ELD + "after_portrait_hands.png") if _os.path.exists(_ELD + "after_portrait_hands.png") else AP    # نفس الشيء بإيدين على الخدود (عدّى الفلتر)
def embrasures(sh):   # نسب الفراغات القاطعة بين كل سنتين (محسوبة من الحدود)
    ups = sorted([t for t in sh.teeth_all if t["fdi"] < 30], key=lambda t: t["cx"]); out = []
    for a, b in zip(ups, ups[1:]):
        xa = a["c"][:, 0].max(); xb = b["c"][:, 0].min(); xm = (xa + xb) / 2
        ya = a["c"][np.abs(a["c"][:, 0] - xa) < 6][:, 1].max(); yb = b["c"][np.abs(b["c"][:, 0] - xb) < 6][:, 1].max()
        inc = max(a["y"] + a["h"], b["y"] + b["h"]); h = (a["h"] + b["h"]) / 2; e = 100 * max(0, inc - max(ya, yb) * .5 - min(ya, yb) * .5) / h
        out.append((xm, (ya + yb) / 2, e))
    return out
@T("a09", "v08")
def a09():
    fp = face_pts(cover(AP, 1.0)); sh = shot("A"); z0 = 1.08
    def s1(t):   # خطوط الوش: الحدقتين، المنتصف، أثلاث الوش، خط الابتسامة
        im = cover(AP, 1.0 + .03 * t); d = ImageDraw.Draw(im, "RGBA"); P = fp
        e1, e2 = P[468] if len(P) > 470 else P[159], P[473] if len(P) > 470 else P[386]; q = ease(t / .8)
        v = e2 - e1; d.line([tuple(e1 - v * .6), tuple(e1 - v * .6 + v * 2.2 * q)], fill=(255, 255, 255, 230), width=3)
        q2 = ease((t - .5) / .8); top, chin = P[10], P[152]; d.line([tuple(top), tuple(top + (chin - top) * q2)], fill=(255, 255, 255, 230), width=3)
        for k, idx in enumerate((10, 168, 2, 152)):
            q3 = ease((t - 1.0 - k * .2) / .4)
            if q3 > 0: y = P[idx][1]; d.line([(P[234][0] - 40, y), (P[234][0] - 40 + (P[454][0] - P[234][0] + 80) * q3, y)], fill=(214, 178, 106, 220), width=2)
        q4 = ease((t - 2.0) / .5)
        if q4 > 0:
            sm = P[[61, 84, 17, 314, 291]]; d.line([tuple(p_) for p_ in sm[:max(2, int(5 * q4))]], fill=(255, 255, 255, 230), width=3)
        return im
    fa = faces_aligned(); FA1 = face_mix(1); amx, amy = fa["lm"][13]; W_, H_ = AP.size; ZE = 4.0
    def s2(t):   # تقريب ودوران متصل للشفايف (كاميرا آمنة: من غير قص ولا حواف سودا، والبق بيبقى عالي الدقة تلقائي)
        p = ease(t / 1.0); return cam(FA1, W_ / 2 + (amx - W_ / 2) * p, H_ / 2 + (amy - H_ / 2) * p, 1.0 + (ZE - 1) * p, 90 * p)
    def s3(t): return cam(FA1, amx, amy, ZE + .25 * t / 2.7, 90)   # نفس اللقطة مكملة (مفيش قطع لصورة تانية)
    def s4(t):   # انتقال ناعم للفك المعزول: الاتنين بيقربوا مع بعض وهو بيدوب
        e = ease(t / 1.0); return blend(cam(FA1, amx, amy, ZE + .25 + .6 * e, 90), A(z0 * (1.12 - .12 * e)), e)
    def zs(t): return z0 * (1 + .16 * t / 4.8)   # 7.5–12.3: الكاميرا بتزق ببطء طول رسم الخطوط والنسب (زي الأصل، مش لقطة ثابتة)
    def s5(t): z_ = zs(t); return outlines(A(z_), sh, z_, t / 2.0, width=3, stagger=.12)
    E = embrasures(sh)
    def s6(t):   # المثلثات الحمرا ونسب الفراغات القاطعة
        z0 = zs(3.0 + t); im = outlines(A(z0), sh, z0, 1.0, width=2); d = ImageDraw.Draw(im, "RGBA")
        for k, (xm, ym, e) in enumerate(E):
            q = ease((t - k * .15) / .3)
            if q <= 0: continue
            x, y = sh.tf(xm, ym, z0); x = min(sh.tf(xx, yy, z0)[0] for tt in sh.six for xx, yy in tt["c"][::6]) - 40
            d.polygon([(x - 26, y - 14), (x - 26, y + 14), (x - 2, y)], fill=(230, 40, 40, int(255 * q))); d.text((x - 40, y), f"{e:.0f}%", font=F(FSER, 76), fill=(255, 255, 255, int(255 * q)), anchor="rm", stroke_width=3, stroke_fill=(0, 0, 0, int(200 * q)))
        return im
    COL = {1: (170, 110, 255), 2: (255, 170, 40), 3: (90, 220, 120)}
    def s7(t):   # مربعات نسبة العرض للطول بالألوان مع تقريب
        z = z0 + .5 * ease(t / 3.0); im = A(z); d = ImageDraw.Draw(im, "RGBA")
        for k, tt in enumerate([q for q in sh.six if q["fdi"] in (11, 12, 13)]):
            qq = ease((t - .3 - k * .5) / .4)
            if qq <= 0: continue
            (x0, y0), (x1, y1) = sh.tf(tt["x"], tt["y"] + tt["h"], z), sh.tf(tt["x"] + tt["w"], tt["y"], z); X0, X1, Y0, Y1 = min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1)
            c = COL[tt["fdi"] % 10]; d.rectangle((X0, Y0, X1, Y1), outline=c + (int(255 * qq),), width=4); d.text((X1 - 16, (Y0 + Y1) / 2), f"{100 * tt['w'] / tt['h']:.0f}%", font=F(FSER, 46), fill=(255, 255, 255, int(255 * qq)), anchor="rm")
        return im
    def s8(t):   # منظور مايل مع خطوط القياس
        ZB = .8; base = A(ZB); d = ImageDraw.Draw(base, "RGBA")
        for k, tt in enumerate(sorted(sh.six, key=lambda q: q["cx"])):
            q = ease((t - .4 - k * .25) / .4)
            if q <= 0: continue
            (xa, ya), (xb, yb) = sh.tf(tt["x"], tt["y"] + tt["h"] + 25, ZB), sh.tf(tt["x"] + tt["w"], tt["y"] + tt["h"] + 25, ZB)
            d.line([(xa, ya), (xb, yb)], fill=(255, 255, 255, int(230 * q)), width=2)
            for xx, yy in ((xa, ya), (xb, yb)): d.line([(xx - 30, yy), (xx + 10, yy)], fill=(255, 255, 255, int(230 * q)), width=2)
            d.text((xa - 40, (ya + yb) / 2), ["0.6", "1", "1.6", "1.6", "1", "0.6"][k], font=F(FSER, 76), fill=(255, 255, 255, int(255 * q)), anchor="rm", stroke_width=3, stroke_fill=(0, 0, 0, int(200 * q)))
        # زي الأصل: لف كاميرا عادي وتقريب على السنتين الأماميين (من غير تشويه منظور ولا حواف سودا)
        c2 = sorted(sh.six, key=lambda q: q["cx"])[2:4]; px, py = np.mean([sh.tf(q["cx"], q["y"] + q["h"] / 2, ZB) for q in c2], 0)
        e = ease(t / 1.2); return cam(base, FW / 2 + (px - FW / 2) * e, FH / 2 + (py - FH / 2) * e, 1.6 + .5 * e + .2 * t / 4.5, 30 * e)
    def s9(t): return outlines(A(z0), sh, z0, 1.0, width=2) if t < 1.0 else A(z0)
    bt = [0, .6, 1.2, 1.8, 2.4]
    def s10(t):   # قبل وبعد بالمورف الحقيقي في نفس المكان
        k = sum(1 for b in bt if t >= b); f = (t - bt[k - 1]) / .25; p = (k % 2 == 1)
        pr = min(1, f) if p else 1 - min(1, f); return chip(morph_frame(pr, 1.12), "بعد" if pr > .5 else "قبل")
    return [(2.8, s1), (1.0, s2), (2.7, s3), (1.0, s4), (3.0, s5), (1.8, s6), (3.5, s7), (4.5, s8), (1.0, s9), (3.9, s10)]
def rot_cover(im, z=1.0): return cover(rot(im), z)

# ======================= أ٢ كامل على مرجع 1 (42.4ث) =======================
TO = (CASE_DIR + "/elements/") if CASE_DIR else S + "tools/out/"   # العناصر المعتمدة للحالة
GENDER = (json.load(open(CASE_DIR + "/case.json")).get("patient", {}).get("gender", "male") if CASE_DIR else "male")   # نوع المريض (للبرومتات)
MS = (CASE_DIR + "/elements/ms/") if CASE_DIR else S + "tools/ms/"   # أقنعة الشفايف/فتحة البق
@T("a02", "v01", "beat")
def a02():
    mb = mouth_box(); mx, my = (mb[0] + mb[2]) / 2, (mb[1] + mb[3]) / 2; mw = mb[2] - mb[0]
    old = Image.open(TO + "before_teeth_both.png").convert("RGBA"); sc_old = mw * 1.25 / old.width
    new = Image.open(TO + "after_teeth_upper.png").convert("RGBA"); sc_new = mw * 1.25 / new.width
    oa = np.array(old.resize((int(old.width * sc_old * 1.6), int(old.height * sc_old * 1.6))))
    ys, xs = np.where(oa[..., 3] > 128); r = np.random.default_rng(3); pick = r.choice(len(xs), min(3500, len(xs)), replace=False)
    PX, PY = xs[pick], ys[pick]; PC = oa[PY, PX, :3]; OW, OH = oa.shape[1], oa.shape[0]; V = r.normal(0, 1, (len(PX), 2)) * [260, 160] + [520, -60]
    gray = lambda: ImageEnhance.Brightness(bw(cover(BF, 1.05))).enhance(.62)
    TU = EL("turbine")
    def s1(t):   # إضاءة ملونة بتعدّي على الوش
        im = cover(BF, 1.0 + .02 * t); g = Image.new("RGB", im.size); d = ImageDraw.Draw(g); x = -500 + (FW + 1000) * ((t / 2.2) % 1)
        d.rectangle((x - 350, 0, x, FH), fill=(220, 30, 60)); d.rectangle((x, 0, x + 350, FH), fill=(40, 80, 255)); g = g.filter(ImageFilter.GaussianBlur(140))
        return screen(im, Image.blend(black(), g, .5))
    def old_at(im, p):   # الأسنان القديمة تخرج قوس قدّام الفم
        sc = sc_old * (1 + .6 * ease(p)); return paste(im, old, mx, my - 120 * ease(p), sc)
    def s2(t): return old_at(gray(), t / 1.2)
    def s3(t):   # التربينة تمر وتفتت الأسنان من الشمال لليمين
        im = gray(); hx = -300 + (FW + 600) * ease(t / 2.6); cx0 = mx - OW / 2; cy0 = my - 120 - OH / 2
        alive = (cx0 + PX) > hx; lay = Image.new("RGBA", im.size); im = old_at(im, 1.0) if t < .05 else im
        arr = np.array(old.resize((OW, OH))); arr[:, :max(0, int(hx - cx0))] = 0; im = paste(im, Image.fromarray(arr), mx, my - 120, 1.0)
        d = ImageDraw.Draw(lay); act = (cx0 + PX) <= hx; tt = np.clip((hx - (cx0 + PX)) / 900, 0, 2)
        for (x, y, c, v, a, k) in zip(PX, PY, PC, V, act, tt):
            if not a: continue
            X = cx0 + x + v[0] * k; Y = cy0 + y + v[1] * k + 300 * k * k; al = int(255 * max(0, 1 - k / 1.6))
            if al > 0: d.rectangle((X, Y, X + 5, Y + 5), fill=tuple(int(q) for q in c) + (al,))
        im = Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB"); return paste(im, TU, hx + 160, my - 140, .42, 6)
    def s4(t): return paste(gray(), new, mx, my - 120 + 60 * (1 - ease(t / .6)), sc_new * (1.5 + .2 * ease(t / 1.5)), alpha=ease(t / .4))
    def s5(t):   # زي الأصل: نفس العدسات اللي ظهرت قدّام الوش بتكمّل — بتكبر وتتقلب وتلف لحد ما تبقى بالطول (أطرافها للشمال) وتنزل على الفم
        p = ease(t / .75); bg = Image.blend(black(), gray(), 1 - ease(t / .45))
        sc = sc_new * 1.7 * (1 - p) + FH * .7 / new.width * p
        flip = abs(math.cos(math.pi * min(1.0, t / .6)))   # بتتقلب حوالين نفسها
        el = new.resize((new.width, max(2, int(new.height * max(.1, flip)))))
        tx, ty = np.mean([sh.tf(q["cx"], q["y"] + q["h"] / 2, 1.08) for q in sh.six], 0)   # بتنزل مكان السنان في اللقطة اللي بعدها
        cx = mx + (tx - mx) * p; cy = (my - 120) * (1 - p) + ty * p
        im = paste(bg, el, cx, cy, sc, ROT_SIGN * 90 * p)
        q = ease((t - .75) / .25); return blend(im, A(1.08), q) if q > 0 else im
    sh = shot("A"); z0 = 1.08
    def s6(t):   # النسبة الذهبية بالطول + علامات حمرا وزرقا عند التلامس
        im = outlines(A(z0), sh, z0, t / 1.4, width=2); im = pct_labels(im, sh, z0, (t - 1.4) / 1.4, size=70)
        lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
        six = sorted(sh.six, key=lambda q: q["cx"]); X0 = min(sh.tf(xx, yy, z0)[0] for q2 in sh.six for xx, yy in q2["c"][::6]) - 50
        for k, (tt, v_) in enumerate(zip(six, ("0.6", "1", "1.6", "1.6", "1", "0.6"))):   # نسب العرض الذهبية جنب كل سنة (بخط كبير واضح)
            q = ease((t - 2.2 - k * .15) / .35)
            if q <= 0: continue
            _, yc = sh.tf(tt["cx"], tt["y"] + tt["h"] / 2, z0)
            tl_ = Image.new("RGBA", (220, 110)); ImageDraw.Draw(tl_).text((110, 55), v_, font=F(FSER, 76), fill=(255, 255, 255, int(255 * q)), anchor="mm", stroke_width=3, stroke_fill=(0, 0, 0, int(160 * q)))
            lay.alpha_composite(tl_.rotate(90, expand=True), (int(X0 - 130), int(yc - 110)))
            d.line([(X0 - 30, yc), (X0 - 8, yc)], fill=(230, 40, 40, int(255 * q)), width=4)
        for k, tt in enumerate(sorted(sh.six, key=lambda q: q["cx"])):
            q = ease((t - .6 - k * .2) / .3)
            if q <= 0: continue
            x, y = sh.tf(tt["x"], tt["y"] + tt["h"], z0); x0 = min(sh.tf(xx, yy, z0)[0] for q2 in sh.six for xx, yy in q2["c"][::6]) - 50
            d.polygon([(x0 - 24, y - 12), (x0 - 24, y + 12), (x0, y)], fill=((230, 40, 40) if k % 2 else (40, 90, 255)) + (int(255 * q),))
        im = Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
        v = Image.new("RGBA", (900, 120)); ImageDraw.Draw(v).text((450, 60), "النسبة الذهبية", font=F(FA, 70), fill=(255, 255, 255, int(255 * ease((t - .4) / .6))), anchor="mm", direction="rtl")
        return paste(im, v.rotate(90, expand=True), 90, FH / 2)
    def s7(t):   # أسماء تفاصيل الحافة القاطعة
        im = A(z0 + .15); c11 = [q for q in sh.six if q["fdi"] == 11][0]; z = z0 + .15
        for j, (s_, fx, fy) in enumerate((("الحافة القاطعة", .5, .98), ("المامِلونات", .3, .9), ("الشفافية", .6, .85), ("الهالة", .8, .97))):
            q = ease((t - .3 - j * .6) / .4)
            if q <= 0: continue
            px, py = sh.tf(c11["x"] + c11["w"] * fx, c11["y"] + c11["h"] * fy, z); ty = FH * (.25 + .15 * j); dd = ImageDraw.Draw(im)
            dd.ellipse((px - 7, py - 7, px + 7, py + 7), fill="white"); dd.line([(px, py), (380, ty), (60, ty)], fill="white", width=2); im = txt(im, (60, ty - 32), s_, 38, anchor="lm", alpha=q)
        return im
    def s8(t):   # قبل وبعد من الأمام بمسح متكرر على الإيقاع
        k = int(t / 1.6); f = (t % 1.6) / .9; a_, b_ = (morph_frame(0, .95, 0), morph_frame(1, .95, 0)) if k % 2 == 0 else (morph_frame(1, .95, 0), morph_frame(0, .95, 0)); return sweep(a_, b_, f, vertical=True)
    def s9(t): return rot_cover(SR, 1.25 + .05 * t)
    def s10(t): return cover(AP, 1.6 - .6 * ease(t / 1.5))
    # الختام: زووم أوت من وشه لحد ما يبان إنه قاعد على البحر فرحان بسنانه (مشهد مشتق بأداة place_patient، البق الحقيقي متركب)
    BE = L(TO + "beach.png"); lb = face_pts_raw(np.array(BE)); fx, fy = lb[1]; BW_, BH_ = BE.size
    BV = asset_clip("beach_live")   # فيديو حي (مش صورة ثابتة): هو فرحان على البحر والموج والنخل بيتحركوا
    def s11(t):
        fr = BV.at(t) if BV else BE; r_ = fr.width / BW_
        e = ease(np.clip((t - .3) / 3.4, 0, 1)); z = 2.6 - 1.6 * e; cx = (fx + (BW_ / 2 - fx) * e) * r_; cy = (fy + (BH_ / 2 - fy) * e) * r_
        im = cam(fr, cx, cy, z, 0); return blend(cover(AP, 1.0), im, t / .5) if t < .5 else im
    s6 = push(s6, 5.5)   # كان لقطة متجمدة (فلتر الفيديو)
    return [(4.5, s1), (3.5, s2), (3.0, s3), (1.5, s4), (1.0, s5), (5.5, s6), (3.5, s7), (6.5, s8), (2.0, s9), (2.5, s10), (4.0, s11), (4.9, logo)]

# ======================= أداة رص الفينير: كل فينيرة حقيقية من صورة البعد تطير وتقعد مكانها =======================
_PC = {}
def veneer_pieces():
    if "p" not in _PC:
        M = morph_setup(); _PC["p"] = {f: (pc, cx, cy) for f, pc, cx, cy in teeth_pieces("A") if f in M["common"]}
        m = M["M"]; _PC["s"] = float(np.hypot(m[0, 0], m[0, 1]))
    return _PC["p"], _PC["s"]
def seat(t, z=1.0, t0=0.0, step=.22, fly=.45, order=None, src=(-300, None), tilt=25, wait=False, morph=True):
    """الفينير بيطير ويقعد على كل سنة؛ لما يقعد، السنة بتتحول بالمورف لشكل البعد. يرجّع (فريم، تقدم كل سنة).
    wait=True: العدسات اللي لسه ماطارتش بتفضل مكانها في الصف (الاختيار مايختفيش). morph=False: العدسة بتفضل قاعدة على سنة القبل (من غير مورف) — التحول للبعد بيحصل بعدين مرة واحدة بنعومة زي الأصل."""
    M = morph_setup(); B = shot("B"); pcs, ms = veneer_pieces(); order = order or M["order"]
    prog = {k: (ease((t - t0 - i * step - fly) / .15) if morph else 0.0) for i, k in enumerate(order)}
    im = morph_frame(prog, z); fpx = FH / B.ch * z * ms
    for i, k in enumerate(order):
        q = (t - t0 - i * step) / fly
        if wait and q <= 0: q = 1e-6
        if not morph and q >= 1: q = 1.0
        if q <= 0 or q >= 1.15 or k not in pcs: continue
        pc, _, _ = pcs[k]; cc = M["planned"][k].mean(0); tx, ty = B.tf(cc[0], cc[1], z); sx = src[0]; sy = ty if src[1] is None else src[1]
        e = ease(min(q, 1)); x = sx + (tx - sx) * e; y = sy + (ty - sy) * e
        im = paste(im, pc.transpose(Image.Transpose.ROTATE_270), x, y, fpx * (1.25 - .25 * e), (1 - e) * tilt, alpha=1 - max(0, (q - 1) / .15) if morph else 1.0)
    return im
def real_row(im, z, x0, dy=0.0):   # العدسات الحقيقية بتاعة المريض (من صورة البعد) مرصوصة بالطول عند x0 — نفس مكان بداية seat
    M = morph_setup(); B = shot("B"); pcs, ms = veneer_pieces(); fpx = FH / B.ch * z * ms
    for k in M["order"]:
        if k not in pcs: continue
        cc = M["planned"][k].mean(0); _, ty = B.tf(cc[0], cc[1], z); im = paste(im, pcs[k][0].transpose(Image.Transpose.ROTATE_270), x0, ty + dy, fpx * 1.25, 0)
    return im
DESIGNS = ["design_square", "design_oval", "design_tri_upper"]   # تصميمات للفك العلوي بس (اتشال "arc" لأن جوانبه بتبان زي سنان سفلية) — والاختيار الأخير العدسات الحقيقية
@T("a03", "v02")
def a03():
    sh = shot("B"); M = morph_setup(); z = 1.0
    def bg(t): return clock_bg(t, cx=FW * .3)
    def base(prog, t, zz=1.0): return screen(morph_frame(prog, zz), bg(t))
    def upper_only(im):   # بنشيل أي حتة سنان تحت صف الأسنان العلوية (بقايا سفلية في التصميم)
        a = np.array(im); al = a[..., 3] > 40; n, lb, st, _ = cv2.connectedComponentsWithStats(al.astype(np.uint8))
        if n > 1:
            big = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]); y_main = st[big, cv2.CC_STAT_TOP] + st[big, cv2.CC_STAT_HEIGHT]
            for i in range(1, n):
                if st[i, cv2.CC_STAT_TOP] > y_main - st[big, cv2.CC_STAT_HEIGHT] * .15: a[lb == i, 3] = 0
        return Image.fromarray(a)
    DS = [upper_only(key_black(L(G + d + ".png"))) for d in DESIGNS]
    XR = FW * .26
    _rr = np.array(real_row(Image.new("RGB", (FW, FH)), z, XR, 0).convert("L")) > 12; _ys, _xs = np.where(_rr)
    RH, RC, RW = _ys.max() - _ys.min(), (_ys.max() + _ys.min()) / 2, _xs.max() - _xs.min()   # مقاس ومكان صف العدسات الحقيقية — كل التصميمات بنفس الطول والمكان (ملاحظة a03 5.7)
    DS = [d.crop(Image.fromarray(((np.array(d)[..., 3] > 120) & (np.array(d.convert("L")) > 110)).astype(np.uint8) * 255).getbbox()) for d in DS]   # القص على الأسنان نفسها (مش الحواف الشفافة ولا الظل)   # القص على الأسنان نفسها (مش الحواف الشفافة)
    def design(im, t, k):   # تصميمات ابتسامة مختلفة بتدور جنب الأسنان للاختيار، والأخير العدسات الحقيقية بتاعة المريض (بتفضل)
        f = (t % 1.5) / 1.5
        if k >= len(DS): return real_row(im, z, XR, (1 - ease(min(1, f * 3))) * 900)
        d_ = DS[k].rotate(-90, expand=True)   # أطراف السنان للشمال زي سنان المريض
        y = RC + (1 - ease(min(1, f * 3))) * 900 - ease(max(0, f * 3 - 2)) * 900
        d_ = d_.resize((int(RW), int(RH)), Image.LANCZOS)   # نفس طول وعرض صف العدسات الحقيقية (التصميم بيتظبط على مقاس سنان المريض)
        return paste(im, d_, XR, y, 1.0, 0)
    def s1(t):   # 0–6: القبل على نقوش الساعة + اختيار بين تصميمات + الحدود تترسم
        im = design(base(0, t), t, int(t / 1.5)); return morph_outlines(im, 0, z, (t - 2.4) / 1.4) if 2.4 < t < 4.5 else im
    def seated(t): return seat(t, z, step=.12, fly=.4, src=(XR, None), tilt=0, wait=True, morph=False)   # الاختيار مابيختفيش، والعدسات بتقعد على سنان القبل (ملاحظة a03 8.2)
    def s2(t): return screen(seated(t), bg(6 + t))   # 6–7.5: نفس العدسات الحقيقية بتنزل تترص على سنان المريض
    SEATED = seated(9.0)
    def s3(t):   # 7.5–8.5: نقط حمرا — على نفس الابتسامة اللي العدسات قعدت عليها (مش قطع لصورة تانية)
        im = screen(SEATED, bg(7.5 + t)); d = ImageDraw.Draw(im); r = np.random.default_rng(1)
        for _ in range(8): x, y = r.uniform(80, FW * .45), r.uniform(200, FH - 200); d.ellipse((x - 6, y - 6, x + 6, y + 6), fill=(230, 30, 30))
        return im
    def dial(im, t, mode="clock"):
        lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); xi = min(sh.tf(x, y, z)[0] for tt in sh.six for x, y in tt["c"][::4]); R = 1100; cx, cy = 60 + R, FH / 2
        d.arc((cx - R, cy - R, cx + R, cy + R), 140, 220, fill=(255, 255, 255, 255), width=4); d.arc((cx - R - 40, cy - R - 40, cx + R + 40, cy + R + 40), 140, 220, fill=(255, 255, 255, 255), width=2)
        for k in range(41):
            a = math.radians(140 + k * 2); r2 = R + (40 if k % 5 == 0 else 20); d.line([(cx + R * math.cos(a), cy + R * math.sin(a)), (cx + r2 * math.cos(a), cy + r2 * math.sin(a))], fill=(255, 255, 255, 255), width=2)
            if k % 5 == 0: d.ellipse((cx + (R + 20) * math.cos(a) - 6, cy + (R + 20) * math.sin(a) - 6, cx + (R + 20) * math.cos(a) + 6, cy + (R + 20) * math.sin(a) + 6), fill=(230, 30, 30, 255))
        if mode == "clock":
            for k, rn in enumerate("XII I II III IIII V VI VII VIII".split()):
                a = math.radians(144 + k * 9 + (t * 4) % 9); num = Image.new("RGBA", (220, 160)); ImageDraw.Draw(num).text((110, 80), rn, font=F("TY-InstrumentSerif.ttf", 120), fill=(255, 255, 255, 255), anchor="mm")
                nr = num.rotate(-math.degrees(a) - 90, expand=True); lay.alpha_composite(nr, (int(cx + (R - 130) * math.cos(a) - nr.width / 2), int(cy + (R - 130) * math.sin(a) - nr.height / 2)))
            a = math.radians(150 + 60 * ((t % 2.5) / 2.5)); d.line([(cx, cy), (cx + (R - 40) * math.cos(a), cy + (R - 40) * math.sin(a))], fill=(255, 255, 255, 230), width=5)
        else:   # مسطرة النسبة الذهبية: خطوط من المركز عند حدود كل سنة + 1.6 / 1 / 0.6
            for k, tt in enumerate(sorted(sh.six, key=lambda q: q["cx"])):
                y0 = sh.tf(tt["x"], 0, z)[1]; a = math.atan2(y0 - cy, (xi - 30) - cx); d.line([(cx + (R - 300) * math.cos(a), cy + (R - 300) * math.sin(a)), (cx + R * math.cos(a), cy + R * math.sin(a))], fill=(255, 255, 255, 220), width=2)
                ym = sh.tf(tt["cx"], 0, z)[1]; d.text((xi - 120, ym), ["0.6", "1", "1.6", "1.6", "1", "0.6"][k], font=F(FSER, 88), fill=(255, 255, 255, 255), anchor="mm", stroke_width=3, stroke_fill=(0, 0, 0, 200))
        return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
    Z0 = 1.11   # ملاحظة: كان فيه شريط إسود فوق وتحت (حدود صورة المورف) في المشاهد اللي فيها اللثة
    def s4(t):   # 8.5–13.5: قرص الساعة، والابتسامة بتتحول بنعومة من القبل للبعد في نفس المكان
        p = ease(t / 1.4); return zoomc(dial(Image.blend(SEATED, morph_frame(1, z), p), t), Z0, .5, .5)   # صورة المورف مش مغطية الكادر من فوق وتحت ← تقريب Z0 مع ظهور اللثة   # العدسات اللي قعدت ← البعد بنعومة (زي الأصل: كريمي ← أبيض)، من غير رجوع للقبل
    def s5(t):   # 13.5–18.5: يتحول لمسطرة ذهبية + الكاميرا بتقرّب على السنتين الأماميين وتفضل تزق ببطء (زي الأصل، مش لقطة ثابتة)
        im = auto_gum(dial(morph_outlines(morph_frame(1, z), 1, z, 1.0, width=2), t, "ruler"))   # اللثة توصل للحافة قبل الزووم (بعد الزووم السنان بتملا الشمال فالريندر مابيعرفش إنه فك معزول — كان بيبان نص دايرة إسود: a03 15.1)
        c2 = sorted(sh.six, key=lambda q: q["cx"])[2:4]; px = np.mean([sh.tf(q["cx"], q["y"] + q["h"] / 2, z) for q in c2], 0)
        zz = Z0 + (1.8 - Z0) * ease(t / .8) + .15 * t / 5.0; cx_ = FW / 2 + (px[0] - FW / 2) * ease(t / .8); cy_ = FH / 2 + (px[1] - FH / 2) * ease(t / .8)
        return cam(im, cx_, cy_, zz, 0)
    def s6(t): return arc_line(morph_frame(1, z), shot("B"), z, t / 1.2, col=(255, 255, 255), w=2)   # 18.5–20: خط القوس
    def s7(t):   # 20–25.9: التوقيع بخط اليد بالطول + تحوّل تاني (قبل/بعد)
        p = 1 - ease((t - 1.6) / .5) + ease((t - 2.9) / .5); im = morph_frame(max(0, min(1, p)), z)
        sg = Image.new("RGBA", (1500, 260)); sg = signature(Image.new("RGB", (1500, 260)), t / 1.6, y=130, W=1500).convert("RGBA")
        a_ = np.array(sg); a_[..., 3] = a_[..., :3].max(2); sg = Image.fromarray(a_)
        return paste(im, sg.rotate(90, expand=True), 150, FH / 2)
    # ملاحظة a03 20.7: المشهدين على نفس الكادر ← كاميرا واحدة مستمرة (كل مشهد كان بيبدأ زووم من الأول فكان باين قطع)
    def RAMP(t0): return lambda fn: (lambda t: zoomc(fn(t), Z0 * (1 + .07 * (t0 + t) / 7.4), .5, .5))
    s6, s7 = RAMP(0.0)(s6), RAMP(1.5)(s7)
    s1, s2, s3 = [(lambda f: (lambda t: zoomc(f(t), Z0, .5, .5)))(f) for f in (s1, s2, s3)]   # نفس التقريب من أول الفيديو: صورة القبل/المورف مش مغطية الكادر من فوق وتحت (كان باين إسود في ركن اللثة)
    return [(6.0, s1), (1.5, s2), (1.0, s3), (5.0, s4), (5.0, s5), (1.5, s6), (5.9, s7)]

# ======================= أ٤ كامل على مرجع 3 (25.4ث) =======================
def stack_on_face(im, t, mb, step=.12, fly=.35):
    """الفينيرات الحقيقية (من صورة البعد) تطير وتترص على بق المريض في صورة الوش."""
    pcs, _ = veneer_pieces(); ks = sorted(pcs, key=lambda k: pcs[k][1]); xs = np.array([pcs[k][1] for k in ks]); ys = np.array([pcs[k][2] for k in ks])
    mx, my = (mb[0] + mb[2]) / 2, (mb[1] + mb[3]) / 2 - (mb[3] - mb[1]) * .12; sc = (mb[2] - mb[0]) * .9 / (np.ptp(xs) + 150)
    order = sorted(range(len(ks)), key=lambda j: abs(xs[j] - xs.mean()))   # من النص للأطراف
    for n, j in enumerate(order):
        q = ease((t - n * step) / fly)
        if q <= 0: continue
        tx, ty = mx + (xs[j] - xs.mean()) * sc, my + (ys[j] - ys.mean()) * sc + pcs[ks[j]][0].height * sc * .5; sx, sy = tx + (j - len(ks) / 2) * 120, ty - 700
        im = paste(im, pcs[ks[j]][0], sx + (tx - sx) * q, sy + (ty - sy) * q, sc * (1.8 - .8 * q), 30 * (1 - q))
    return im
_VB = {}
def veneered_before():
    """أداة عامة (قاعدتك): العدسات الكاملة بتتحط على سنان المريض في نفس صورة القبل، والماسك = حدود شفايفه في الصورة دي نفسها.
    ممنوع ناخد سنان صورة الابتسامة المش ريتراكتد (مستوى الشفة بيختلف بين صور نفس المريض، وخصوصًا لو عنده gummy smile).
    العدسة = شكل السنة الكامل من صورة البعد بالمبعد، ولونها على إضاءة الوش؛ بقايا السنان القديمة اللي بين العدسات بتتشال."""
    if "im" in _VB: return _VB["im"]
    fa = faces_aligned(); B = np.array(fa["B"].convert("RGB")); Hh, Ww = B.shape[:2]
    INN = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]
    op = np.zeros((Hh, Ww), np.uint8); cv2.fillPoly(op, [face_pts_raw(B)[INN].astype(np.int32)], 255)
    FULL = {int(k): np.float32(v) for k, v in json.load(open(TO + "ap_teeth_full.json")).items()}; pcs, _ = veneer_pieces(); A_ = AP.convert("RGBA")
    cx = np.mean([c[:, 0].mean() for c in FULL.values()]); lay = Image.new("RGBA", (Ww, Hh))
    for k, fc in sorted(FULL.items(), key=lambda kv: -abs(kv[1][:, 0].mean() - cx)):   # الأطراف الأول والنص فوق
        c0 = fc.mean(0); fc = (fc - c0) * np.float32([1.07, 1.0]) + c0   # عرض أكبر شوية يقفل الفراغات بين العدسات
        x0, y0 = fc.min(0); x1, y1 = fc.max(0); w_, h_ = max(2, int(x1 - x0)), max(2, int(y1 - y0))
        poly = Image.new("L", (w_, h_)); ImageDraw.Draw(poly).polygon([tuple(p - [x0, y0]) for p in fc], fill=255)
        tw = (k + 10 if k < 20 else k - 10) if k < 30 else k   # السنة التوأم في الناحية التانية (15↔25)
        if k in pcs: pc = pcs[k][0].crop(pcs[k][0].getbbox()).resize((w_, h_), Image.LANCZOS)
        elif tw in pcs: pc = ImageOps.mirror(pcs[tw][0].crop(pcs[tw][0].getbbox())).resize((w_, h_), Image.LANCZOS)   # مفيش عدسة مقصوصة للسنة دي ← عدسة توأمها معكوسة (Q3 مسك 15 فاضية)   # qa-ok: عدسة التوأم المعكوسة (15↔25) — مفيهاش نص
        else: pc = A_.crop((int(x0), int(y0), int(x0) + w_, int(y0) + h_))
        rgb = cv2.inpaint(np.array(pc.convert("RGB")), ((np.array(pc.split()[3]) < 160) & (np.array(poly) > 0)).astype(np.uint8) * 255, 7, cv2.INPAINT_TELEA)   # خروم العدسة من العدسة نفسها
        pc = Image.fromarray(rgb).convert("RGBA"); pc.putalpha(Image.fromarray(cv2.erode(np.array(poly), np.ones((5, 5), np.uint8))).filter(ImageFilter.GaussianBlur(1.2))); lay.alpha_composite(pc, (int(x0), int(y0)))
    la_ = cv2.cvtColor(np.array(lay.convert("RGB")), cv2.COLOR_RGB2LAB).astype(np.float32); m_ = np.array(lay.split()[3]) > 200
    apl = cv2.cvtColor(np.array(AP.convert("RGB")), cv2.COLOR_RGB2LAB).astype(np.float32); tm = np.zeros(m_.shape, np.uint8)
    for c in fa["teeth"].values(): cv2.fillPoly(tm, [np.int32(c)], 1)
    for ch, w in ((0, .85), (1, 1.0), (2, 1.0)): la_[..., ch] += (apl[..., ch][tm > 0].mean() - la_[..., ch][m_].mean()) * w + (6 if ch == 0 else 0)   # لون سنان البعد المعتمد على إضاءة الوش
    lay = Image.merge("RGBA", (*Image.fromarray(cv2.cvtColor(np.clip(la_, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)).split(), lay.split()[3]))
    cov = np.array(lay.split()[3]) > 40; full_ = np.array(lay.split()[3]) > 235; low = np.array([np.where(cov[:, x])[0].max() if cov[:, x].any() else -1 for x in range(Ww)])
    hs = cv2.cvtColor(B, cv2.COLOR_RGB2HSV); yy = np.arange(Hh)[:, None]
    old = (hs[..., 2] > 45) & (hs[..., 0] >= 6) & (hs[..., 0] <= 35) & (hs[..., 1] > 45) & (op > 0) & ~full_ & (yy <= low[None, :]) & (low[None, :] >= 0)
    old = cv2.dilate(old.astype(np.uint8) * 255, np.ones((11, 11), np.uint8)); old[op == 0] = 0; old[full_] = 0
    gum = (cv2.cvtColor(B, cv2.COLOR_RGB2LAB)[..., 1] > 145) & (op > 0) & (old == 0); gc = np.median(B[gum], 0) if gum.sum() > 50 else np.float32([190, 110, 115])
    Bf = B.astype(np.float32); Bf[old > 0] = gc; om = cv2.GaussianBlur(old.astype(np.float32) / 255, (0, 0), 3)[..., None]
    B = (cv2.GaussianBlur(Bf, (0, 0), 4) * om + B.astype(np.float32) * (1 - om)).astype(np.uint8)   # مكان بقايا السنان القديمة بقى لثة بلونها   # بقايا السنان القديمة بين العدسات
    opm = cv2.GaussianBlur(cv2.erode(op, np.ones((5, 5), np.uint8)), (0, 0), 1.5).astype(np.float32) / 255
    al = (np.array(lay.split()[3]).astype(np.float32) / 255 * opm)[..., None]
    _VB["im"] = Image.fromarray((np.array(lay.convert("RGB")).astype(np.float32) * al + B.astype(np.float32) * (1 - al)).astype(np.uint8)); _VB["op"] = opm
    try:   # البلاي بوك Q3 + Q4: مفيش سنة قديمة باينة جوه العدسات، وخط الشفايف مااتحركش — النتيجة في out/vb_check.json وفلتر الفيديو بيقراها
        sys.path.insert(0, S + "product"); from checks import veneer_cover, lip_shift
        q3 = veneer_cover(np.array(_VB["im"]), FULL, opm); q4 = lip_shift(np.array(fa["B"].convert("RGB")), np.array(_VB["im"]))
        json.dump({"veneer_cover": q3, "lip_shift": q4, "pass": bool(q3["pass"] and q4["pass"])}, open(OUTD + "vb_check.json", "w"), ensure_ascii=False, indent=1)
        if not (q3["pass"] and q4["pass"]): print("VB_CHECK FAIL", q3["issues"] + q4["issues"], flush=True)
    except Exception as e: print("VB_CHECK ERROR", e, flush=True)
    return _VB["im"]
_SF = {}
def seat_on_face(t, step=.09, fly=.38, settle=.3, dim=1.0, src=None):   # src: نقطة بداية الطيران (مثلاً من على الكاست) بإحداثيات صورة البعد
    """أداة عامة: الفينيرات (مقصوصة من صورة البعد نفسها بحدود كل سنة) بتطير وتقعد بالظبط مكان كل سنة على وش القبل،
    وبعدين البق كله يتحول للبعد. كله في إحداثيات صورة البعد AP، فالمكان مظبوط بالبناء مش بالتقريب."""
    fa = faces_aligned()
    if not _SF:   # العدسة كاملة لحد نهاية السنة: من صورة البعد بالمبعد (السنة كلها باينة) بمقاس الشكل الكامل للسنة على الوش
        A_ = AP.convert("RGBA"); P_ = []; pcs, _ = veneer_pieces()
        FULL = {int(k): np.float32(v) for k, v in json.load(open(TO + "ap_teeth_full.json")).items()}
        for k, c in sorted(fa["teeth"].items(), key=lambda kv: abs(kv[1][:, 0].mean() - fa["lm"][13][0])):   # من النص للأطراف
            fc = FULL.get(k, c); x0, y0 = fc.min(0); x1, y1 = fc.max(0); w, h = max(2, int(x1 - x0)), max(2, int(y1 - y0))
            vis = Image.new("L", (w, h)); ImageDraw.Draw(vis).polygon([tuple(p - [x0, y0]) for p in c], fill=255); vis = vis.filter(ImageFilter.GaussianBlur(.8))   # الجزء الباين (مش ورا الشفة)
            if k in pcs:
                pc = pcs[k][0].crop(pcs[k][0].getbbox()).resize((w, h), Image.LANCZOS)
            else:
                m = Image.new("L", AP.size); ImageDraw.Draw(m).polygon([tuple(p) for p in fc], fill=255); pc = A_.crop((int(x0), int(y0), int(x0) + w, int(y0) + h)); pc.putalpha(m.crop((int(x0), int(y0), int(x0) + w, int(y0) + h)))
            P_.append((pc, vis, (x0 + x1) / 2, (y0 + y1) / 2)); _SF.setdefault("nofly", set()).update(set() if k in pcs else {len(P_) - 1})   # سنان الأطراف من غير عدسة مقصوصة مابتطيرش (فيها حتة من جوه البق الغامق)
        _SF["p"] = P_; _nf = _SF.get("nofly", set()); _o = sorted([i for i in range(len(P_)) if i not in _nf], key=lambda i: P_[i][2]); _SF["rank"] = [(_o.index(i) if i in _o else -1) for i in range(len(P_))]; _SF["nfly"] = len(_o)   # ترتيب كل عدسة على طول الفك
        # عمود كل سنة جوه فتحة البق: أول ما العدسة تقعد، السنة كلها (من اللثة للطرف) بتبقى سنة البعد الحقيقية — مش نصها
        la = fa["lm"]; Wd, Hd = AP.size; mo = np.zeros((Hd, Wd), np.uint8)
        INN = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]
        cv2.fillPoly(mo, [la[INN].astype(np.int32)], 255)
        try:   # فتحة بق القبل كمان (سنانه القديمة أطول وأعلى): العمود لازم يغطيها كلها، وإلا أطراف القديمة الصفرا تفضل باينة فوق الجديدة
            lb_ = face_pts_raw(np.array(fa["B"])); cv2.fillPoly(mo, [lb_[INN].astype(np.int32)], 255)
        except Exception: pass
        mo = cv2.dilate(mo, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
        xs = [cx_ for _, _, cx_, _ in P_]; srt = sorted(xs); cols = []
        for cx_ in xs:
            j = srt.index(cx_); lo = (srt[j - 1] + cx_) / 2 if j > 0 else cx_ - 400; hi = (srt[j + 1] + cx_) / 2 if j + 1 < len(srt) else cx_ + 400
            m = np.zeros_like(mo); m[:, int(max(0, lo)):int(min(Wd, hi))] = 255; m = cv2.GaussianBlur(np.minimum(m, mo), (0, 0), 3).astype(np.float32) / 255; cols.append(m)
        _SF["cols"] = cols; _SF["A"] = np.array(veneered_before()).astype(np.float32)   # السنة بتبقى العدسة على سنانه هو جوه شفايفه هو (مش سنان صورة الابتسامة)
    P_ = _SF["p"]; n = len(P_); t_end = (n - 1) * step + fly
    im = fa["B"].convert("RGB")   # الوش والشفايف بتوع القبل زي ما هم — العدسات بس اللي بتتغير
    a_ = np.array(im).astype(np.float32); kk = np.zeros(a_.shape[:2], np.float32)
    for i in range(n): kk = np.maximum(kk, _SF["cols"][i] * ease(np.clip(((t - i * step) / fly - .85) / .2, 0, 1)))
    if kk.max() > 0: im = Image.fromarray((a_ * (1 - kk[..., None]) + _SF["A"] * kk[..., None]).astype(np.uint8))
    im = im.convert("RGBA")
    if dim < 1: im = ImageEnhance.Brightness(im.convert("RGB")).enhance(dim).convert("RGBA")
    for i, (pc, vis, tx, ty) in enumerate(P_):
        q = (t - i * step) / fly
        if q <= 0 or q > 1.1 or i in _SF.get("nofly", ()): continue   # بعد ما تقعد، السنة نفسها بقت سنة البعد
        e = ease(min(q, 1)); w_ = ease(np.clip((q - .8) / .25, 0, 1))
        if w_ > 0:   # وهي بتقعد: الجزء اللي ورا الشفة بيستخبى زي السنة الحقيقية
            veneered_before(); x0_, y0_ = int(tx - pc.width / 2), int(ty - pc.height / 2); opc = np.zeros((pc.height, pc.width), np.float32); H_, W_ = _VB["op"].shape
            ys_, xs_ = slice(max(0, y0_), min(H_, y0_ + pc.height)), slice(max(0, x0_), min(W_, x0_ + pc.width)); opc[ys_.start - y0_:ys_.stop - y0_, xs_.start - x0_:xs_.stop - x0_] = _VB["op"][ys_, xs_]   # ماسك = خط شفايف القبل
            al = np.array(pc.split()[3]).astype(np.float32) * ((1 - w_) + w_ * opc); pc = pc.copy(); pc.putalpha(Image.fromarray(al.astype(np.uint8)))
        side = -1 if tx < fa["lm"][13][0] else 1; sx, sy = (tx + side * 260, ty - 520) if src is None else (src(_SF["rank"][i], _SF["nfly"]) if callable(src) else (src[0] + (i % 3 - 1) * 40, src[1] + (i % 5 - 2) * 60))
        x = sx + (tx - sx) * e; y = sy + (ty - sy) * e; sc = 2.2 - 1.2 * e; rot = side * 40 * (1 - e)
        p2 = pc.resize((max(1, int(pc.width * sc)), max(1, int(pc.height * sc))), Image.LANCZOS).rotate(rot, resample=Image.BICUBIC, expand=True)
        im.alpha_composite(p2, (int(x - p2.width / 2), int(y - p2.height / 2))) if x - p2.width / 2 >= 0 and y - p2.height / 2 >= 0 else im.paste(p2, (int(x - p2.width / 2), int(y - p2.height / 2)), p2)
    return im.convert("RGB")
_SEG = {}
def person_mask(im):
    """أداة عامة: قناع الشخص (وش + شعر + جسم + هدوم) بموديل تقسيم الأشخاص، من غير ما نعتمد على لون الخلفية."""
    import mediapipe as mp
    from mediapipe.tasks.python import vision, BaseOptions
    if "s" not in _SEG: _SEG["s"] = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(base_options=BaseOptions(model_asset_path=S + "face/selfie_multiclass.tflite"), output_confidence_masks=True))
    a = np.ascontiguousarray(np.array(im.convert("RGB"))); r = _SEG["s"].segment(mp.Image(image_format=mp.ImageFormat.SRGB, data=a))
    bgc = r.confidence_masks[0].numpy_view().astype(np.float32); p = 1 - cv2.resize(bgc, (a.shape[1], a.shape[0]), interpolation=cv2.INTER_LINEAR)
    return np.clip((p - .35) / .3, 0, 1)
def bg_swap(im, col=(52, 38, 24), bg=None):   # تبديل الخلفية (بلون أو بصورة خلفية زي الورد) — الشخص بقناع تقسيم الأشخاص
    a = np.array(im).astype(np.float32); m0 = 1 - person_mask(im); m = cv2.GaussianBlur(m0, (0, 0), 2)
    # تنضيف الحواف (ملاحظة a12 21.4): بقايا الخلفية القديمة (الأبيض) جوه الشعر المجعد وعلى الحافة ← تتشال لو لونها قريب من لون الخلفية القديمة
    sure = m0 > .5
    if sure.sum() > 1000:
        bgc = np.median(a[sure], 0); band = cv2.dilate((m0 > .5).astype(np.uint8), np.ones((61, 61), np.uint8)) & (m0 <= .5).astype(np.uint8)
        lum = a.mean(2); sat = a.max(2) - a.min(2); bl = float(bgc.mean())
        loc = cv2.blur(lum, (25, 25)); w = np.clip((lum - 75) / max(1.0, bl - 75), 0, 1) * band * (sat < 45) * (loc < 175)   # جوه الشعر بس (حواليه غامق) — القميص الأبيض مابيتلمسش   # خليط شعر غامق + خلفية فاتحة: نسبة الخلفية فيه = قد إيه أفتح من الشعر (الجلد مشبّع فمابيتلمسش)
        m = np.maximum(m, cv2.GaussianBlur(w.astype(np.float32), (0, 0), 1.2))
    m = m[..., None]
    if bg is not None: g = np.array(cover(bg, 1.0).resize((a.shape[1], a.shape[0]))).astype(np.float32)
    else: g = np.zeros_like(a); yy = np.linspace(0, 1, a.shape[0])[:, None, None]; g[:] = np.array(col, np.float32) * (1.4 - .8 * yy)
    return Image.fromarray((a * (1 - m) + g * m).astype(np.uint8))
@T("a04", "v03")
def a04():
    sh = shot("A"); fa = faces_aligned(); FB0 = face_mix(0); W_, H_ = AP.size; s_ = max(FW / W_, FH / H_) * 1.03
    mx, my = FW / 2 + (fa["lm"][13][0] - W_ / 2) * s_, FH / 2 + (fa["lm"][13][1] - H_ / 2) * s_   # البق في كادر الوش (نفس إحداثيات صورة البعد)
    P = Particles(None, (mx - 90, my - 30, mx + 90, my + 30), 2200, 260, col=(250, 250, 250), grav=-20)
    ROSES = L(S + "assets/roses_bg.png"); SA = vclip("after_blink")   # عيونه مقفولة وبيفتحها (فيديو من العنصر المعتمد)
    def s2(t):   # رغوة بيضا تنفجر من الفم
        im = ImageEnhance.Brightness(cover(FB0, 1.03)).enhance(1 - .55 * ease(t / 1.5)); im = P.draw(im, t * .8, 2.2)
        g = Image.new("L", im.size); ImageDraw.Draw(g).ellipse((mx - 220 * ease(t), my - 120 * ease(t), mx + 220 * ease(t), my + 120 * ease(t)), fill=200)
        return Image.composite(Image.new("RGB", im.size, (250, 250, 250)), im, g.filter(ImageFilter.GaussianBlur(40)))
    VU = Clip(S + "assets/v/veneer_upper.mp4", 960, 960, loop=False)
    def s3(t):   # فينيرة سنة علوية أمامية عملاقة بتلف (3D) وتكبر قدّام الوش المعتم
        im = ImageEnhance.Brightness(cover(FB0, 1.03)).enhance(.4); v = key_black(VU.at(t * 1.6)); return paste(im, v, FW / 2, FH * .45, FW * (.75 + .5 * ease(t / 2.6)) / v.width)
    def s4(t):   # الفينيرات (من صورة البعد) تطير وتقعد بالظبط على كل سنة، والبق يتحول للبعد، وبعدين ومضة
        if t < 1.25: return ImageEnhance.Brightness(cover(seat_on_face(t * 1.15), 1.03)).enhance(.4 + .6 * ease(t / .6))
        return flash(cover(AP, 1.0), 1 - (t - 1.25) / .25)
    def s5(t):   # فيديو حي (بيرمش وبيتحرك) والخلفية بتتحول لورد أحمر زي الأصل
        fr = SA.at(t); return blend(fr, bg_swap(fr, bg=ROSES), ease((t - 1.0) / .7))   # عينه مقفولة وبعدين يفتحها، والورد يظهر مع فتح العين
    def s6(t): return cover(SR, 1.3 + .05 * t)
    def s7(t):   # تحليل بالمساطر والدوائر والنسب
        z = 1.08; im = anim.render(sh, t, z, dict(lines=.0, stagger=.1, draw=.5, mid=.6, pct=1.2, arc=1.8, gold=99, title=99, label=""))
        d = ImageDraw.Draw(im, "RGBA")
        for k, tt in enumerate([q for q in sh.six if q["fdi"] % 10 == 1]):
            q = ease((t - 2.4 - k * .3) / .4)
            if q > 0: cx, cy = sh.tf(tt["cx"], tt["y"] + tt["h"] * .5, z); r = 70 + 60 * q; d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(255, 255, 255, 180), width=2)
        return im
    SB = shot("B")
    def s8(t):   # زي الأصل: صورة البعد الحقيقية (من غير مورف) + رسم حدود السنان العلوية بخط أبيض رفيع + التوقيع، مع ومضتين سريعتين للقبل
        z = 1.22 + .03 * t / 6.5; im = sh.base(z, 0)
        if t < 2.2: im = outlines(im, sh, z, ease(t / 1.4) * (1 - ease((t - 1.7) / .5)), width=2, which="upper", stagger=.08)
        b = max(ease((t - 2.4) / .7) * (1 - ease((t - 3.5) / .5)), ease((t - 4.4) / .7) * (1 - ease((t - 5.5) / .5)))   # تحول تدريجي زي الأصل (Q7: E151)
        if b > 0: im = blend(im, SB.base(z, 0), b)
        sg = signature(Image.new("RGB", (1500, 260)), min(1, max(0, (t - .3) / 1.6)), y=130, W=1500).convert("RGBA")   # التوقيع رأسي على الطرف الشمال زي الأصل، مش فوق السنان
        a_ = np.array(sg); a_[..., 3] = a_[..., :3].max(2); im = paste(im, Image.fromarray(a_).rotate(90, expand=True), 42, FH / 2, .62)
        return chip(im, "قبل") if b > .5 else im
    s7 = push(s7, 5.5)   # كان لقطة متجمدة (فلتر الفيديو)
    return [(.6, lambda t: cover(FB0, 1.0 + .02 * t)), (1.9, s2), (3.0, s3), (1.5, s4), (2.0, s5), (.5, s6), (5.5, s7), (6.5, s8), (3.9, logo)]

# ======================= أ١٠ كامل على مرجع 9 (21.9ث) — الأسهم جوه السنة بالظبط =======================
def inside_point(el, fx, fy):
    """نقطة جوه العنصر نفسه (من قناع الشفافية): لو المكان المطلوب برا السنة نقرّبه لحد ما يبقى جوه."""
    a = np.array(el.split()[3]); ys, xs = np.where(a > 160); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max(); cx, cy = xs.mean(), ys.mean()
    x, y = x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy
    for _ in range(40):
        if a[int(min(max(y, 0), a.shape[0] - 1)), int(min(max(x, 0), a.shape[1] - 1))] > 200: break
        x += (cx - x) * .12; y += (cy - y) * .12
    return x, y
@T("a10", "v09")
def a10():
    mb = mouth_box(); mx, my = (mb[0] + mb[2]) / 2, (mb[1] + mb[3]) / 2; mw = mb[2] - mb[0]
    old = Image.open(TO + "before_teeth_upper.png").convert("RGBA"); so = mw * 1.2 / old.width; new = Image.open(TO + "after_teeth_upper.png").convert("RGBA")
    V = key_black(L(S + "assets/veneer_upper.png")); vb = V.getbbox(); V = V.crop(vb); HAND = EL("hand"); sh = shot("A")   # عدسة علوية أمامية (مش سفلية)
    def halo(im, t):
        g = Image.new("RGB", im.size); ImageDraw.Draw(g).ellipse((mx - 360, my - 200, mx + 360, my + 200), fill=(230, 20, 30)); g = g.filter(ImageFilter.GaussianBlur(90))
        return screen(im, Image.blend(black(), g, .55 + .25 * math.sin(t * 9)))
    def s1(t): return halo(cover(BF, 1.0 + .02 * t), t)
    def s2(t):
        im = halo(ImageEnhance.Brightness(cover(BF, 1.02)).enhance(1 - .3 * t), t); a_ = ease((t - .45) / .45); im = paste(im, old, mx, my + 40 + 120 * ease(t), so * (1 + .5 * ease(t)), alpha=1 - a_)   # السنان القديمة بتطلع من البق وبتتحول لقوس العدسات البيضا زي الأصل
        return paste(im, new, mx, my + 40 + 120 * ease(t), so * (1 + .5 * ease(t)), alpha=a_) if a_ > 0 else im
    LB = [("خطوط ريتزيوس", .35, .45), ("المنطقة شبه الشفافة", .55, .62), ("المنطقة الشفافة", .5, .82), ("الهالة القاطعة", .5, .96), ("التكيف عند عنق السن", .5, .06), ("اللون", .65, .4), ("الطبيعية", .3, .3), ("التشريح", .7, .2)]
    VS = 620 / V.height
    def s3(t):   # فينيرة كبيرة فوق ودرس تشريح، والأسهم كلها بتلمس السنة نفسها
        im = ImageEnhance.Brightness(cover(BF, 1.02)).enhance(.35); im = paste(im, new, mx, my + 160, so * 1.5)
        vx, vy = FW * .5, FH * .30; im = paste(im, V, vx, vy, VS); d = ImageDraw.Draw(im)
        for j, (s_, fx, fy) in enumerate(LB):
            q = ease((t - .2 - j * .3) / .3)
            if q <= 0: continue
            px, py = inside_point(V, fx, fy); px = vx + (px - V.width / 2) * VS; py = vy + (py - V.height / 2) * VS
            right = j % 2 == 0; tx = FW - 50 if right else 50; ty = FH * .08 + j * 62
            d.ellipse((px - 6, py - 6, px + 6, py + 6), fill="white"); d.line([(px, py), (tx + (-260 if right else 260), ty + 18), (tx, ty + 18)], fill="white", width=2)
            im = txt(im, (tx, ty), s_, 30, anchor="rm" if right else "lm", alpha=q); d = ImageDraw.Draw(im)
        return im
    def s4(t): im = ImageEnhance.Brightness(cover(BF, 1.02)).enhance(.35); return paste(im, new, mx + 300 * ease(t / .5), my - 500 * ease(t / .5), so * 1.3 * (1 + ease(t / .5)), 30 * ease(t / .5))
    R = np.random.default_rng(9); pet = [(R.uniform(0, FW), R.uniform(-FH, FH), R.uniform(60, 180), R.uniform(0, 6)) for _ in range(45)]
    def petals(im, t):
        d = ImageDraw.Draw(im, "RGBA")
        for x, y, v, a in pet:
            yy = (y + v * t * 2) % (FH + 200) - 100; xx = x + 50 * math.sin(t * 2 + a); d.ellipse((xx, yy, xx + 26, yy + 15), fill=(255, 160, 190, 220))
        return im
    c11 = [q for q in sh.six if q["fdi"] == 11][0]
    def s6(t):   # يد أنمي بتحط فينيرة على السنة + بتلات ورد
        z = 1.1; im = petals(A(z), t); tx, ty = sh.tf(c11["cx"], c11["y"] + c11["h"] * .5, z); p = ease(t / 1.6)
        return paste(im, HAND, tx - 260 + (1 - p) * -500, ty + 260 + (1 - p) * 500, .6)
    def s7(t):   # حرفين عربيين مضيئين على الثنيتين (بدل الحروف اليابانية) + بتلات
        z = 1.1; im = petals(A(z), t + 2.5); lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
        for ch, tt in zip("فن", sorted([q for q in sh.six if q["fdi"] % 10 == 1], key=lambda q: q["cx"])):
            x, y = sh.tf(tt["cx"], tt["y"] + tt["h"] * .5, z); d.text((x, y), ch, font=F(FA, 120), fill=(255, 255, 255, int(220 * (.6 + .4 * math.sin(t * 6)))), anchor="mm")
        g = lay.filter(ImageFilter.GaussianBlur(14)); return Image.alpha_composite(Image.alpha_composite(im.convert("RGBA"), g), lay).convert("RGB")
    PL = dict(lines=.0, stagger=.12, draw=.5, mid=.8, pct=1.4, arc=2.0, gold=99, title=99, label="")
    return [(1.0, s1), (1.0, s2), (3.0, s3), (.5, s4), (.5, lambda t: A(1.05)), (2.5, s6), (4.0, s7), (5.0, lambda t: anim.render(sh, t, 1.1, PL)), (4.7, lambda t: A(1.1 + .06 * t / 4.7))]

# ======================= أ١١ كامل على مرجع 10 (24.4ث) — الحدود دايمًا على السنان الظاهرة نفسها =======================
@T("a11", "v10")
def a11():
    B = shot("B"); M = morph_setup(); z = 1.0; Bt = {t["fdi"]: t for t in B.teeth_all}
    def added(im, p):   # الجزء الناقص اللي هيتضاف (شكل البعد ناقص السنة الحالية) بالأحمر
        lay = Image.new("RGBA", im.size)
        for i, k in enumerate(M["order"]):
            q = ease(p * 1.5 - i * .08)
            if q <= 0: continue
            m1 = Image.new("L", im.size); ImageDraw.Draw(m1).polygon([B.tf(x, y, z) for x, y in M["planned"][k][::2]], fill=255)
            m2 = Image.new("L", im.size); ImageDraw.Draw(m2).polygon([B.tf(x, y, z) for x, y in Bt[k]["c"][::2]], fill=255)
            a = np.clip(np.array(m1).astype(int) - np.array(m2), 0, 255).astype(np.uint8); c = Image.new("RGBA", im.size, (200, 20, 25, 0)); c.putalpha(Image.fromarray((a * .8 * q).astype(np.uint8))); lay = Image.alpha_composite(lay, c)
        return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
    def leaders(im, t, items):
        d = ImageDraw.Draw(im)
        for j, (s_, k, fy) in enumerate(items):
            q = ease((t - j * .5) / .4)
            if q <= 0: continue
            tt = Bt[k]; px, py = B.tf(tt["cx"], tt["y"] + tt["h"] * fy, z); ty = FH * (.18 + .16 * j); tx = 60
            d.ellipse((px - 6, py - 6, px + 6, py + 6), fill="white"); d.line([(px, py), (tx + 300, ty + 20), (tx, ty + 20)], fill="white", width=2)
            im = txt(im, (tx, ty - 10), s_, 34, anchor="lm", alpha=q); d = ImageDraw.Draw(im)
        return im
    PROB = [("عدم تناظر", 11, .5), ("تصبّغ عند اللثة", 12, .15), ("تآكل الحافة القاطعة", 21, .95), ("تكسّر", 22, .9), ("فراغ بين الأسنان", 13, .6)]
    def s1(t): return chip(morph_outlines(morph_frame(0, z), 0, z, t / 1.0, width=2), "قبل")   # خط أبيض رفيع على سنان القبل نفسها
    def s2(t): return planned(morph_outlines(morph_frame(0, z), 0, z, 1.0, width=2), z, t / 1.6, width=2)   # شكل البعد المخطط (متقطع أبيض) فوق القبل
    def s3(t): return leaders(morph_outlines(morph_frame(0, z), 0, z, 1.0, width=2), t, PROB)
    def s4(t): p = ease(t / .5); return morph_outlines(morph_frame(p, z), p, z, 1.0, width=2)   # المورف والحدود ماشيين مع بعض
    def s5(t): return chip(morph_outlines(morph_frame(1, z), 1, z, t / 1.8, width=2), "النتيجة")
    def s6(t):   # شبكة مسطرة + نقط التلامس + النسب
        im = morph_outlines(morph_frame(1, z), 1, z, 1.0, width=2); d = ImageDraw.Draw(im, "RGBA"); cc = current_contours(1); q = ease(t / .6)
        for y in range(120, FH - 120, 22): d.line([(70, y), (70 + (30 if y % 110 == 0 else 14) * q, y)], fill=(255, 255, 255, 200), width=2)
        for k in M["order"]:
            pts = [B.tf(x, y, z) for x, y in cc[k]]; top = min(pts, key=lambda p_: p_[1]); bot = max(pts, key=lambda p_: p_[1])
            for (x, y), c in ((top, (255, 255, 255)), (bot, (255, 255, 255))):
                if q > .5: d.ellipse((x - 7, y - 7, x + 7, y + 7), fill=c + (255,))
            d.line([(70, top[1]), (top[0], top[1])], fill=(255, 255, 255, int(110 * q)), width=1)
        return Image.alpha_composite(im.convert("RGBA"), Image.new("RGBA", im.size)).convert("RGB") if t < .01 else pct_on_morph(im, t)
    def pct_on_morph(im, t):
        cc = current_contours(1); ks = [k for k in M["order"] if k % 10 <= 3]; ws = {k: np.ptp(cc[k][:, 0]) for k in ks}; tot = sum(ws.values())
        for j, k in enumerate(ks):
            q = ease((t - .8 - j * .15) / .3)
            if q > 0: x, y = B.tf(*cc[k].mean(0), z); im = txt(im, (x, y), f"{100 * ws[k] / tot:.1f}%", 66, font=FSER, rtl=False, alpha=q)
        return im
    E = embrasures(shot("A"))
    def s7(t):   # مثلثات حمرا بنسب الفراغات القاطعة على حافة الأسنان نفسها
        im = morph_frame(1, z); d = ImageDraw.Draw(im, "RGBA"); cc = current_contours(1); xi = min(B.tf(x, y, z)[0] for k in M["order"] for x, y in cc[k][::4]); ks = M["order"]
        for j in range(len(ks) - 1):
            q = ease((t - j * .2) / .3)
            if q <= 0: continue
            y = (B.tf(*cc[ks[j]].mean(0), z)[1] + B.tf(*cc[ks[j + 1]].mean(0), z)[1]) / 2; e = E[j][2] if j < len(E) else 20
            d.polygon([(xi - 30, y - 12), (xi - 30, y + 12), (xi - 6, y)], fill=(230, 40, 40, int(255 * q))); d.text((xi - 44, y), f"{e:.0f}°", font=F(FSER, 58), fill=(255, 255, 255, int(255 * q)), anchor="rm", stroke_width=2, stroke_fill=(0, 0, 0, int(180 * q)))
        return im
    def s8(t):   # حدود بنفسجي مضيئة بتجري على الأسنان
        return morph_outlines(morph_frame(1, z), 1, z, t / 1.0, col=(255, 255, 255), width=2)
    bt = [0, .5, 1.0, 1.4, 1.8, 2.2, 2.6, 3.0, 3.4, 3.8]
    def s9(t): k = sum(1 for b in bt if t >= b); return chip(morph_frame(k % 2, z), "بعد" if k % 2 else "قبل")
    return [(1.0, s1), (2.0, s2), (5.0, s3), (.5, s4), (2.5, s5), (3.0, s6), (3.5, s7), (1.5, s8), (1.0, lambda t: morph_frame(1, z)), (4.8, s9)]

# ======================= أ١٤ كامل على مرجع 14 (19ث) — الابتسامتين وشهم لبعض =======================
@T("a14", "v14")
def a14():
    B = shot("B"); Bt = {t["fdi"]: t for t in B.teeth_all}; z = 1.0
    probs = [("تصبّغ عند اللثة", 12, .12), ("تآكل الحافة", 21, .95), ("فراغ وتلوّن", 11, .45), ("تكسّر", 13, .85)]
    rng = np.random.default_rng(3); nums = [(rng.integers(40, FW - 40), rng.integers(80, FH - 80), str(rng.integers(0, 9))) for _ in range(30)]
    # زي الأصل: السنان على يمين الكادر واللثة طالعة برا الحافة اليمين، فمش باين قصّ اللثة ولا أسود
    # تكبير 1.45 + إزاحة: السنان تملا نص الكادر اليمين، واللثة (في نص الارتفاع اللي باين) طالعة برا الحافة — من غير أسود ولا سنان مقطوعة
    ZA = 1.45; f0 = np.array(morph_frame(0, ZA)).max(2) > 12; xr = [np.where(r)[0].max() for r in f0[int(FH * .05):int(FH * .95)] if r.any()]; DX = int(FW - np.percentile(xr, 8) + 10) if xr else 0
    def MF(p, zz=1.0): im = morph_frame(p, ZA * zz); o_ = black(); o_.paste(im, (DX, 0)); return o_
    def pt(k, fy): t = Bt[k]; x, y = B.tf(t["cx"], t["y"] + t["h"] * fy, ZA); return x + DX, y
    def s1(t): return MF(0, 1.0 + .03 * t)
    def s2(t):   # دواير استهداف حمرا بتتنقل + أرقام باهتة كأنه فحص
        im = MF(0); lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
        for x, y, s_ in nums: d.text((x, y), s_, font=F("TY-InstrumentSerif.ttf", 90), fill=(255, 255, 255, 30))
        i_ = min(len(probs) - 1, int(t / .5)); x, y = pt(probs[i_][1], probs[i_][2]); r = 70 + 10 * math.sin(t * 9)
        for a0 in range(0, 360, 30): d.arc((x - r, y - r, x + r, y + r), a0, a0 + 20, fill=(235, 40, 40, 255), width=5)
        return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
    def s3(t):   # عدسات مكبّرة: بتكبّر نفس المكان من الفريم نفسه
        im = MF(0); src = im.copy(); lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
        for j, (s_, k, fy) in enumerate(probs):
            q = ease((t - j * .5) / .4)
            if q <= 0: continue
            x, y = pt(k, fy); x, y = int(x), int(y); cx, cy = 230, int(FH * (.14 + .24 * j)); R = max(4, int(150 * q)); r0 = 50
            cr = src.crop((x - r0, y - r0, x + r0, y + r0)).resize((2 * R, 2 * R), Image.LANCZOS)
            m = Image.new("L", (2 * R, 2 * R)); ImageDraw.Draw(m).ellipse((0, 0, 2 * R - 1, 2 * R - 1), fill=255); lay.paste(cr, (cx - R, cy - R), m)
            d.ellipse((cx - R, cy - R, cx + R, cy + R), outline=(255, 255, 255, 255), width=4); d.ellipse((x - r0, y - r0, x + r0, y + r0), outline=(255, 255, 255, 220), width=2)
            d.line([(cx + R, cy), (x - r0, y)], fill=(255, 255, 255, 220), width=2)
            d.text((cx, cy + R + 32), s_, font=F(FA5, 34), fill=(255, 255, 255, int(255 * q)), anchor="mm", direction="rtl")
        return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
    def s4(t): return ImageEnhance.Brightness(MF(0)).enhance(1 - .8 * ease(t))
    def s5(t): p = ease(t / .6); return MF(p, 1.0 + .03 * t)
    ZF14 = 1.12; B14 = morph_frame(0, ZF14); A14 = A(ZF14); fa = faces_aligned(); amx, amy = fa["lm"][13]
    def s6(t):   # زي الأصل: القبل (شمال) قصاد البعد (يمين) بفاصل ومن غير قص، وبعدين القبل يختفي ويفضل البعد
        e = ease(t / .5); im = face_pair(B14, A14, 70, int(-FW * .5 * (1 - e)), int(FW * .5 * (1 - e)))
        f = ease((t - 1.8) / .6)
        if f > 0: r = black(); r.paste(A14, (FW // 2 + 35 - tips_x(A14), 0)); im = blend(im, r, f)
        return im
    def s7(t):   # انتقال ناعم من الفك للشفايف (نفس الاتجاه: أطراف السنان للشمال)
        r = black(); r.paste(A14, (FW // 2 + 35 - tips_x(A14), 0)); return blend(r, cam(face_mix(1), amx, amy, 3.4, 90), ease(t / .5))
    def s8(t):   # الشفايف قريب، والسنان بتتبدل قبل ↔ بعد في نفس المكان (البق بجودة عالية من الصور الأصلية)
        k = int(t / 1.25); f = ease(min(1, (t - k * 1.25) / .18)); p = (1 - f) if k % 2 == 1 else (f if k > 0 else 1.0)   # تبديل سريع وواضح بعد ← قبل ← بعد
        if k % 2 == 1: p = 1 - f
        elif k > 0: p = f
        return cam(face_mix(p), amx, amy, 3.4 - .25 * ease(t / 5), 90)
    def s9(t): return cover(BF, 1.0) if t < 1.0 else (flash(cover(AP, 1.0), 1 - (t - 1) / .3) if t < 1.3 else cover(AP, 1.0 + .03 * (t - 1.3)))
    return [(1.0, s1), (2.0, s2), (3.0, s3), (1.0, s4), (1.0, s5), (2.5, s6), (.5, s7), (5.0, s8), (3.0, s9)]

# ======================= أ١٢ كامل على مرجع 11 (27ث) =======================
AV = S + "assets/v/"
@T("a12", "v11")
def a12():
    BFc_ = cover(BF, 1.0); mb = mouth_box(); mx, my = (mb[0] + mb[2]) / 2, (mb[1] + mb[3]) / 2; ZM = 2.3
    def zoomed(im, zz, t=0):   # تقريب على البق مع الوش مضبّب حواليه
        return cam(im, FW / 2 + (mx - FW / 2) * min(1, zz - 1), FH / 2 + (my - 60 - FH / 2) * min(1, zz - 1), zz, 0)   # كاميرا آمنة: مفيش حواف سودا
    def design_frame(im, q):
        d = ImageDraw.Draw(im, "RGBA"); x0, x1, y0, y1 = FW * .08, FW * .92, FH * .42, FH * .62
        d.rectangle((x0, y0, x1, y1), outline=(255, 255, 255, int(220 * q)), width=2); d.line([(FW / 2, y0 - 120), (FW / 2, y1 + 120)], fill=(255, 255, 255, int(200 * q)), width=2)
        for x in (x0, x1, FW / 2):
            for y in (y0, y1): d.rectangle((x - 9, y - 9, x + 9, y + 9), fill=(255, 255, 255, int(255 * q)))
        return im
    def s1(t): return cover(BF, 1.0 + .03 * t)
    def s2(t):   # تقريب للبق، والوش يتضبب
        p = ease(t / 1.2); im = zoomed(BFc_, 1 + (ZM - 1) * p); return Image.blend(im, im.filter(ImageFilter.GaussianBlur(8)), .4 * p)
    base = lambda: Image.blend(zoomed(BFc_, ZM), zoomed(BFc_, ZM).filter(ImageFilter.GaussianBlur(8)), .4)
    fpz = face_pts(BFc_); oy = my - FH / ZM / 2 - 60; ox = mx - FW / ZM / 2
    up_y = (fpz[13][1] + 4 - oy) * ZM   # خط السنان العلوية تحت الشفة العليا مباشرة
    mbz = ((fpz[78][0] - ox) * ZM, up_y - 10, (fpz[308][0] - ox) * ZM, up_y + 10)
    # ملاحظة a12 4.4: كل عدسة لازم تقعد على السنة بتاعتها بالظبط ← seat_on_face (حدود كل سنة) بدل رص تقريبي في مستطيل البق
    fa_ = faces_aligned(); Mi = cv2.invertAffineTransform(fa_["MB"]); B0 = np.array(fa_["B"].convert("RGB")).astype(np.int16); bh, bw = np.array(BF).shape[:2]
    BLR = base()
    def seated(t):   # العدسات على سنانه في إحداثيات صورة القبل نفسها، والوش مضبب حواليها زي الأول
        sv = np.array(seat_on_face(t, step=.25, fly=.4)); d = (np.abs(sv.astype(np.int16) - B0).sum(2) > 18).astype(np.uint8) * 255
        if d.max() == 0: return BLR.copy()
        d = cv2.GaussianBlur(cv2.dilate(d, np.ones((7, 7), np.uint8)), (0, 0), 2)
        lay = cv2.warpAffine(sv, Mi, (bw, bh), flags=cv2.INTER_CUBIC); m = cv2.warpAffine(d, Mi, (bw, bh))
        lz = zoomed(cover(Image.fromarray(lay), 1.0), ZM); mz = np.array(zoomed(cover(Image.fromarray(m).convert("RGB"), 1.0), ZM))[..., :1].astype(np.float32) / 255
        return Image.fromarray((np.array(lz) * mz + np.array(BLR) * (1 - mz)).astype(np.uint8))
    def s3(t):   # الفينيرات الحقيقية تطير واحدة واحدة وتقعد كل واحدة على سنتها + إطار التصميم + التوقيع
        im = seated(t); im = design_frame(im, ease((t - 2.8) / .5)); return signature(im, (t - 3.6) / 1.2, y=FH * .78) if t > 3.6 else im
    def s4(t):   # تتفكك بالعكس
        return seated(5.2 - t * 2.2)
    CL_ = {}
    def clip(n): 
        n = _live(n)   # الفيديو الحي من العنصر المعتمد (مش لزق)
        if n not in CL_: CL_[n] = Clip(AV + n + ".mp4", loop=True)
        return CL_[n]
    def s5(t): return clip("smile_after_lock").at(t)
    AF12 = A(1.12)
    def s6(t):   # البعد (شمال) قصاد القبل (يمين) بفاصل ومن غير قص، والقبل بيتحول للبعد مكانه
        e = ease(t / .4); return face_pair(AF12, morph_frame(ease((t - .4) / .8), 1.12), 60, int(-FW * .5 * (1 - e)), int(FW * .5 * (1 - e)))
    def pop(im):   # ملاحظة a12 20.5: الوشوش على الإسود كانت باهتة ← كونتراست محلي + تشبّع + عمق للضل (زي الأصل: الوش ناصع على الإسود)
        a = cv2.cvtColor(np.array(im), cv2.COLOR_RGB2LAB); l0 = a[..., 0].astype(np.float32); a[..., 0] = np.clip(l0 * .65 + cv2.createCLAHE(1.2, (4, 4)).apply(a[..., 0]) * .35, 0, 255).astype(np.uint8)
        im = Image.fromarray(cv2.cvtColor(a, cv2.COLOR_LAB2RGB)); im = ImageEnhance.Contrast(im).enhance(1.14); im = ImageEnhance.Brightness(im).enhance(1.04); return ImageEnhance.Color(im).enhance(1.15)
    views = [AP] + [L(TO + f"after_view_{s_}.png") for s_ in ("l", "r") if _os.path.exists(TO + f"after_view_{s_}.png")]   # من قدام + زوايا (البق الحقيقي من صور الابتسامة الجانبية)
    views = (views * 3)[:3]; tiles = [cover(rot(pop(bg_swap(x, col=(0, 0, 0)))), 1.0, W=FW, H=FH // 3) for x in views]   # خلفية سودا (طلب العميل)
    def s7(t):   # زي الأصل: كل وش (قدام، زاوية، الزاوية التانية) بيظهر بنعومة في صفه ويفضل ثابت — من غير شريط بيجري
        im = black()
        for k, tl_ in enumerate(tiles):
            q = ease((t - k * 1.1) / .6)
            if q <= 0: continue
            y = k * (FH // 3); fr = Image.blend(Image.new("RGB", tl_.size), cover(tl_, 1.0 + .06 * (1 - q), W=FW, H=FH // 3), q); im.paste(fr, (0, y))
        return im
    def s8(t): return cover(rot(SR), 1.35 + .1 * t / 5.5, .45, .5)
    s3 = push(s3, 4.6)   # كان لقطة متجمدة (فلتر الفيديو)
    s7 = push(s7, 5.0)   # كان لقطة متجمدة (فلتر الفيديو)
    return [(.5, s1), (1.4, s2), (4.6, s3), (2.4, s4), (1.6, lambda t: flash(s5(0), 1 - t / .3) if t < .3 else s5(t)), (4.5, s5), (1.5, s6), (5.0, s7), (5.5, s8)]

# ======================= كاميرا (زووم + دوران من غير قص ولا حواف سودا) + وش قبل/بعد متطابقين =======================
CAMM = {}
def cam(img, cx, cy, zoom, ang, W=FW, H=FH):
    """الكاميرا بتبص على النقطة (cx,cy) في الصورة، بتقرّب zoom (1 = الصورة مالية الكادر) وبتلف ang درجة."""
    a = np.asarray(img); h, w = a.shape[:2]; base = max(W / w, H / h); th = math.radians(ang)
    # زووم آمن: أقل تكبير يخلي أركان الكادر (بعد اللف) جوه حدود الصورة، علشان مايبانش حواف سودا ولا انعكاس
    corners = np.float32([[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]]); ct, st_ = math.cos(-th), math.sin(-th)
    rc = corners @ np.float32([[ct, st_], [-st_, ct]])   # أركان الكادر في اتجاه الصورة (قبل التكبير)
    need = 1.0
    for px, py in rc:
        for v, lo, hi in ((px, cx, w - cx), (py, cy, h - cy)):
            lim = lo if v < 0 else hi
            if lim > 1: need = max(need, abs(v) / (base * lim))
    s_ = base * max(zoom, min(need, zoom * 3))
    c, sn = math.cos(th) * s_, math.sin(th) * s_
    M = np.float32([[c, -sn, W / 2 - (c * cx - sn * cy)], [sn, c, H / 2 - (sn * cx + c * cy)]])
    out = cv2.warpAffine(a, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT_101); CAMM["M"] = M
    info = getattr(img, "info", {}) or {}
    if "hi_mouth" in info and s_ > 1.15:   # جودة: البق من صورة عالية الدقة (البعد: صورة الابتسامة الأصلية، القبل: تكبير أمين)
        r = min(1, (s_ - 1.15) / .4); wa = info["hi_mouth"]
        if wa < 1: out = hi_mouth_before(out, M, (1 - wa) * r)
        if wa > 0: out = hi_mouth(out, M, wa * r)
    out = Image.fromarray(out)
    if "ol" in info: out = draw_full_outlines(out, M, *info["ol"])   # الحدود بتترسم بعد الكاميرا: خط رفيع حاد في أي زووم
    return out
_HI = {}
def hi_mouth(out, M, w):
    """أداة عامة: لو الكاميرا بتكبّر الوش أكتر من دقته، البق (شفايف + سنان) بيتاخد من صورة الابتسامة الأصلية عالية الدقة،
    متحاذية بنفس التحويل اللي اتركّب بيه البق على الوش، وألوانها متظبطة على الوش."""
    if not _HI:
        sys.path.insert(0, S + "tools"); from mouth_swap import big
        Sm = np.array(L(C + "ret/smile_front_ret4.jpg")).astype(np.float32); Ms = np.load(TO + "smile_to_ap.npy")
        ml = np.maximum(big(cv2.imread(MS + "smile_lips.png", 0)), big(cv2.imread(MS + "smile_open.png", 0)))
        mk = cv2.GaussianBlur(cv2.erode(ml, np.ones((25, 25), np.uint8)), (0, 0), 18).astype(np.float32) / 255
        A_ = np.array(AP).astype(np.float32); Sw = cv2.warpAffine(Sm, Ms, (A_.shape[1], A_.shape[0]), flags=cv2.INTER_AREA); mw = cv2.warpAffine(mk, Ms, (A_.shape[1], A_.shape[0])) > .5
        la = cv2.cvtColor(np.clip(Sw, 0, 255).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32); lb = cv2.cvtColor(A_.astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
        mu_a, sd_a = la[mw].mean(0), la[mw].std(0) + 1e-3; mu_b, sd_b = lb[mw].mean(0), lb[mw].std(0) + 1e-3
        L_ = cv2.cvtColor(np.clip(Sm, 0, 255).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32); L_ = (L_ - mu_a) / sd_a * sd_b + mu_b   # نفس ألوان البق في الوش
        _HI.update(img=cv2.cvtColor(np.clip(L_, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB), mask=mk, Ms=np.vstack([Ms, [0, 0, 1]]))
    Mh = (np.vstack([M, [0, 0, 1]]) @ _HI["Ms"])[:2]; H_, W_ = out.shape[:2]
    hi = cv2.warpAffine(_HI["img"], Mh, (W_, H_), flags=cv2.INTER_CUBIC); m = cv2.warpAffine(_HI["mask"], Mh, (W_, H_))[..., None] * w
    return (hi * m + out * (1 - m)).astype(np.uint8)
_HB = {}
def hi_mouth_before(out, M, w):
    """البق قبل العلاج من نسخة متكبّرة تكبير أمين (الحدة من موديل التكبير، الألوان والبقع من الصورة الأصلية)."""
    if not _HB:
        fa = faces_aligned(); hi = np.array(L(TO + "before_face_hi.png")); BW = np.array(BF).shape[1]; k = BW / hi.shape[1]   # من الصورة الكبيرة لصورة القبل الأصلية
        Mb = np.vstack([fa["MB"], [0, 0, 1]]) @ np.float32([[k, 0, 0], [0, k, 0], [0, 0, 1]])
        ol = fa["lb"][[61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146]] / k; m = np.zeros(hi.shape[:2], np.uint8); cv2.fillPoly(m, [ol.astype(np.int32)], 255)
        wl = np.ptp(ol[:, 0]); m = cv2.GaussianBlur(cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(wl * .35), int(wl * .35)))), (0, 0), wl * .08).astype(np.float32) / 255
        _HB.update(img=hi, mask=m, Mb=Mb)
    Mh = (np.vstack([M, [0, 0, 1]]) @ _HB["Mb"])[:2]; H_, W_ = out.shape[:2]
    hi = cv2.warpAffine(_HB["img"], Mh, (W_, H_), flags=cv2.INTER_CUBIC); m = cv2.warpAffine(_HB["mask"], Mh, (W_, H_))[..., None] * w
    return (hi * m + out * (1 - m)).astype(np.uint8)
_OLF = {}
def draw_full_outlines(im, M, p, col=(255, 255, 255), width=2):
    """حدود السنان العلوية الكاملة (من صورة المبعد، حتى الجزء ورا الشفة) بخط أبيض رفيع، مرسومة في الشاشة بعد الكاميرا."""
    if not _OLF: _OLF.update({int(k): np.float32(v) for k, v in json.load(open(TO + "ap_teeth_full.json")).items()})
    d = ImageDraw.Draw(im); ks = sorted(_OLF, key=lambda k: _OLF[k][:, 0].mean())
    for i, k in enumerate(ks):
        q = ease(p * 1.4 - i * .05)
        if q <= 0: continue
        c = _OLF[k] @ M[:, :2].T + M[:, 2]; pts = [tuple(x) for x in c[::3]] + [tuple(c[0])]; d.line(anim.partial(pts, q), fill=col, width=width, joint="curve")
    return im
_FA = {}
def faces_aligned():
    """وش قبل (الحقيقي) متكبّر ومتطابق على إحداثيات وش بعد (المشتق) بنقط الوش، عشان التحويل بينهم يبقى في نفس المكان."""
    if not _FA:
        ap = np.array(AP); bf = np.array(BF); la = face_pts_raw(ap); lb = face_pts_raw(bf)
        idx = [33, 263, 1, 61, 291, 152, 10, 234, 454, 168, 6, 199]
        M, _ = cv2.estimateAffinePartial2D(lb[idx], la[idx]); wb = cv2.warpAffine(bf, M, (ap.shape[1], ap.shape[0]), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        valid = cv2.warpAffine(np.full(bf.shape[:2], 255, np.uint8), M, (ap.shape[1], ap.shape[0])); valid = cv2.GaussianBlur(cv2.erode(valid, np.ones((15, 15), np.uint8)), (0, 0), 10)[..., None] / 255.
        wb = (wb * valid + ap * (1 - valid)).astype(np.uint8)   # برا حدود صورة قبل: نكمّل من الخلفية (مش بكسلات ممطوطة)
        _FA.update(MB=M, lb=lb, B=Image.fromarray(wb), A=AP, lm=la, teeth={int(k): np.float32(v) for k, v in json.load(open(TO + "ap_teeth_v3.json")).items() if int(k) < 30})   # حدود السنان العلوية بس، متطابقة على وش v3
    return _FA
def face_pts_raw(a):
    import mediapipe as mp
    from mediapipe.tasks.python import vision, BaseOptions
    det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=S + "face/face_landmarker.task"), num_faces=1))
    L_ = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(a))).face_landmarks[0]; return np.float32([[p.x * a.shape[1], p.y * a.shape[0]] for p in L_])
def face_mix(p):   # تحويل ناعم من وش قبل لوش بعد في نفس المكان (البق الأول وبعدين باقي الوش)
    fa = faces_aligned(); a = np.array(fa["B"]).astype(np.float32); b = np.array(fa["A"]).astype(np.float32); la = fa["lm"]
    m = np.zeros(a.shape[:2], np.float32); cv2.fillPoly(m, [la[[61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146]].astype(np.int32)], 1.0); m = cv2.GaussianBlur(m, (0, 0), 12)
    k = np.clip(m * min(1, p * 1.6) + (1 - m) * max(0, p * 1.6 - .6), 0, 1)[..., None]; im = Image.fromarray((a * (1 - k) + b * k).astype(np.uint8)); im.info["hi_mouth"] = min(1, p * 1.6); return im
def incisal_run(c, frac=.42):
    """الجزء الطرفي بس من حدود السنة (ناحية الحافة القاطعة)، من غير الخط اللي ناحية اللثة/الشفة اللي مش باين."""
    c = np.asarray(c, np.float32); y0, y1 = c[:, 1].min(), c[:, 1].max(); keep = c[:, 1] > y0 + (y1 - y0) * frac; n = len(c)
    if keep.all() or not keep.any(): return [tuple(x) for x in c[::2]]
    st = int(np.argmax(~keep & np.roll(keep, -1))) + 1   # أول نقطة بعد جزء مستبعد
    run = [c[(st + i) % n] for i in range(n) if keep[(st + i) % n]]   # نقط متتالية جوه الجزء الطرفي
    out = []; i = st
    for j in range(n):
        p = c[(st + j) % n]
        if keep[(st + j) % n]: out.append(tuple(p))
        elif out: break
    return out[::2] if len(out) > 4 else out
def ap_outlines(im_fn, p, col=(255, 255, 255), width=2, incisal=True):
    base = im_fn.copy(); base.info = dict(getattr(im_fn, "info", {}) or {}); base.info["ol"] = (p, col, width); return base
def ap_outlines_old(im_fn, p, col=(255, 255, 255), width=3, incisal=True):
    """يرسم حدود السنان الحقيقية على صورة الوش بعد قبل الكاميرا (عشان تتحرك وتلف معاها)."""
    fa = faces_aligned(); base = im_fn.copy(); d = ImageDraw.Draw(base); ks = sorted(fa["teeth"], key=lambda k: fa["teeth"][k][:, 0].mean())
    for i, k in enumerate(ks):
        q = ease(p * 1.4 - i * .05)
        if q <= 0: continue
        pts = incisal_run(fa["teeth"][k]) if incisal else [tuple(x) for x in fa["teeth"][k][::2]] + [tuple(fa["teeth"][k][0])]
        d.line(anim.partial(pts, q), fill=col, width=width, joint="curve")
    return base

# ======================= أ١٥ الحلزون الذهبي كامل (22.2ث) =======================
def spiral_layer(img, x0, y0, w, p, flip=False, alpha=1.0, formula=0.0):
    im = img.copy(); lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
    anim.spiral(d, x0, y0, w, w * 1.618, p, flip, lambda a: int(255 * a * alpha)); return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
@T("a15", "v15")
def a15():
    fa = faces_aligned(); lm = fa["lm"]; mx, my = lm[13]; W0, H0 = fa["A"].size; cx0, cy0 = W0 / 2, H0 * .48
    sw = (lm[454][0] - lm[234][0]) * 1.25; sx0 = mx - sw * .62; sy0 = my - sw * 1.618 * .62   # الحلزون مركزه البق
    def withsp(img, p, a=1.0): return spiral_layer(img, sx0, sy0, sw, p, alpha=a)
    def s1(t): return cam(face_mix(0), cx0, cy0, 1.05 + .02 * t, 0)
    def s2(t): return cam(withsp(face_mix(0), t / 1.5), cx0, cy0, 1.07, 0)
    def s3(t):   # الكاميرا تدخل مع الحلزون وتلف معاه للابتسامة
        p = ease(t / 1.4); return cam(withsp(face_mix(0), 1.0), cx0 + (mx - cx0) * p, cy0 + (my - cy0) * p, 1.07 + 3.0 * p, 90 * p)
    def formula(im, q): return txt(im, (FW / 2, FH * .9), "النسبة الذهبية: (أ + ب) ÷ أ = أ ÷ ب = 1.618", 44, alpha=q)
    def lips_sp(im, a=1.0):   # الحلزون على شاشة الشفايف نفسها (زي الأصل)
        w = FW * .62; return spiral_layer(im, FW * .5 - w * .55, FH * .5 - w * 1.618 * .45, w, 1.0, alpha=a)
    def s4(t): return formula(lips_sp(cam(face_mix(ease((t - 1.6) / 1.0)), mx, my, 4.07 + .1 * t / 5, 90), ease(t / .5)), ease(t / .6))   # زي الأصل: عند الثانية 5 الابتسامة بتتحول من القبل للبعد والحلزون لسه عليها
    def s5(t): return formula(lips_sp(cam(face_mix(1), mx, my, 4.17, 90), 1 - ease(t / 1.5)), 1 - ease(t / 1.5))
    def s6(t): return cam(face_mix(1), mx, my, 4.17 + .05 * t, 90)   # البعد (التحويل حصل خلاص عند الثانية 5)
    def s7(t):   # حدود السنان الحقيقية + النسب + التوقيع
        im = cam(ap_outlines(face_mix(1), t / 2.0), mx, my, 4.27, 90)
        if t > 2.5:
            ks = [k for k in fa["teeth"] if k < 30 and k % 10 <= 3]; ws = {k: np.ptp(fa["teeth"][k][:, 0]) for k in ks}; tot = sum(ws.values())
            for j, k in enumerate(sorted(ks, key=lambda k: fa["teeth"][k][:, 0].mean())):
                q = ease((t - 2.5 - j * .15) / .3)
                if q > 0:
                    c = fa["teeth"][k].mean(0); th = math.radians(90); dx, dy = c[0] - mx, c[1] - my; s_ = max(FW / W0, FH / H0) * 4.27
                    X = FW / 2 + s_ * (math.cos(th) * dx - math.sin(th) * dy); Y = FH / 2 + s_ * (math.sin(th) * dx + math.cos(th) * dy)
                    im = txt(im, (min(FW - 70, X + 300), Y), f"{100 * ws[k] / tot:.1f}%", 40, font=FSER, rtl=False, alpha=q)
        return signature(im, (t - 5.0) / 1.5, y=FH * .88) if t > 5.0 else im
    def s8(t): p = ease(t / 1.5); return cam(face_mix(1), mx + (cx0 - mx) * p, my + (cy0 - my) * p, 4.27 - 3.2 * p, 90 * (1 - p))
    s7 = push(s7, 7.0)   # كان لقطة متجمدة (فلتر الفيديو)
    return [(.5, s1), (1.5, s2), (1.4, s3), (5.0, s4), (1.5, s5), (2.0, s6), (7.0, s7), (1.5, s8), (1.8, lambda t: cam(face_mix(1), cx0, cy0, 1.07 + .02 * t, 0))]
# ======================= أ٣٢ الفراشة والتناظر (22.4ث) =======================
@T("a32", "v41")
def a32():
    fa = faces_aligned(); lm = fa["lm"]; mx, my = lm[13]; W0, H0 = fa["A"].size; cx0, cy0 = W0 / 2, H0 * .48; fw = lm[454][0] - lm[234][0]
    BFC = Clip(G + "butterfly.mp4", 960, 960)   # الفيديو مربع: من غير مط ولا قص (كان بيقطع الفراشة من فوق)
    def bfly(t):
        u = t % 10; u = u if u < 5 else 10 - u; e = key_black(BFC.at(min(u, 4.95)))   # لوب رايح جاي (ملاحظة a32 5.7: اللوب كان بيقفز من آخر الفيديو لأوله)
        bb = e.split()[3].point(lambda v: 255 if v > 20 else 0).getbbox() or (0, 0, 960, 960)
        x0, y0, x1, y1 = bb; return e.crop((max(0, x0 - 30), max(0, y0 - 30), min(960, x1 + 30), min(960, y1 + 30)))
    BW0 = max(bfly(i * .1).width for i in range(50))
    def with_b(img, t, bx, by, size, ang=0, a=1.0):
        b = bfly(t); sc = size / BW0; b = b.rotate(ang, expand=True); return paste(img, b, bx, by, sc, 0, alpha=a)   # مقياس ثابت (عرض الجناحين مفتوحين)
    def sym(img, p):
        im = img.copy(); d = ImageDraw.Draw(im, "RGBA"); c = (214, 178, 106)
        d.line([(lm[10][0], lm[10][1] - 200), (lm[10][0], lm[10][1] - 200 + (lm[152][1] - lm[10][1] + 400) * ease(p))], fill=c + (230,), width=4)
        for k, (a_, b_) in enumerate(((33, 263), (61, 291), (234, 454), (70, 300))):
            q = ease(p * 3 - k * .5)
            if q > 0: d.line([tuple(lm[a_]), tuple(lm[a_] + (lm[b_] - lm[a_]) * q)], fill=c + (220,), width=3)
        return im
    def s1(t):   # الفراشة جاية من فوق وتهبط على البق (كبيرة وتغطي الابتسامة)
        p = ease(t / 2.5); im = with_b(face_mix(0), t, mx + 500 * (1 - p), my - 1400 * (1 - p), fw * (.6 + .5 * p), 30 * (1 - p)); return cam(im, cx0, cy0, 1.05, 0)
    def s2(t):   # تقعد على البق وتترك خطوط تناظر
        im = with_b(sym(face_mix(0), t / 2.5), 2.5 + t, mx, my, fw * 1.1); return cam(im, cx0, cy0, 1.05 + .3 * ease(t / 3.0), 0)
    def s3(t):   # زووم مع دوران للابتسامة والفراشة بتطير
        x_ = min(1, max(0, t / 1.5)); p = x_ * x_ * (3 - 2 * x_); im = with_b(sym(face_mix(0), 1), 5.5 + t, mx - 800 * p, my - 900 * p, fw * 1.1, 0, 1 - p)
        return cam(im, cx0 + (mx - cx0) * p, cy0 + (my - cy0) * p, 1.35 + 2.8 * p, 90 * p)
    def s4(t): return cam(face_mix(ease(t / 2.0)), mx, my, 4.15, 90)   # التحويل بنعومة
    def s5(t):   # الحدود + 0.6 / 1 / 1.6
        im = cam(ap_outlines(face_mix(1), t / 1.6, col=(255, 255, 255), width=2), mx, my, 4.15, 90); ks = sorted([k for k in fa["teeth"] if k < 30 and k % 10 <= 3], key=lambda k: fa["teeth"][k][:, 0].mean()); vals = ["0.6", "1", "1.6", "1.6", "1", "0.6"]
        s_ = max(FW / W0, FH / H0) * 4.15
        for j, k in enumerate(ks[:6]):
            q = ease((t - 1.6 - j * .15) / .3)
            if q > 0: c = fa["teeth"][k].mean(0); dx, dy = c[0] - mx, c[1] - my; X = FW / 2 + s_ * dy; Y = FH / 2 - s_ * dx; im = txt(im, (X + 170, Y), vals[j], 46, font=FSER, rtl=False, fill=(255, 255, 255), alpha=q)
        return signature(im, (t - 3.5) / 1.2, y=FH * .88) if t > 3.5 else im
    def s6(t): p = ease(t / 1.6); return cam(face_mix(1), mx + (cx0 - mx) * p, my + (cy0 - my) * p, 4.15 - 3.1 * p, 90 * (1 - p))
    # ملاحظة a32 10.2: كاميرا واحدة بتزق ببطء طول الماكرو (s4 + s5) وبترجع لـ1 بنعومة مع بداية s6 — كان فيه قفزة زووم بين المشاهد
    def RZ(t0, fn): return lambda t: zoomc(fn(t), 1 + .06 * (t0 + t) / 7.2, .5, .5)
    s4, s5 = RZ(0, s4), RZ(2.2, s5); _s6 = s6
    def s6(t): return zoomc(_s6(t), 1 + .06 * (1 - ease(t / 1.0)), .5, .5)
    return [(2.5, s1), (3.0, s2), (1.5, s3), (2.2, s4), (5.0, s5), (1.6, s6), (2.0, lambda t: cam(face_mix(1), cx0, cy0, 1.05 + .02 * t, 0)), (3.0, lambda t: cover(asset_clip("smile_after_lock", "smile_after").at(t), 1.03 + .03 * t / 3)), (1.6, logo)]   # الوش بعد (فيديو حي) لحد قرب الآخر زي الأصل

# ======================= أ١٦ المسح الحيوي كامل (25.4ث) =======================
def facing(a_img, b_img, la="", lb="", off=0):   # صورتين ملفوفتين وشهم لبعض
    im = face_pair(a_img, b_img, gap=70 + 2 * off)   # الأداة العامة: فاصل واضح وأطراف السنان مش مقطوعة
    if la: im = txt(im, (FW * .25, 110), la, 50)
    if lb: im = txt(im, (FW * .75, 110), lb, 50)
    return im
@T("a16", "v16")
def a16():
    fa = faces_aligned(); lm = fa["lm"]; W0, H0 = fa["A"].size; cx0, cy0 = W0 / 2, H0 * .48; mx, my = lm[13]; eye = lm[468] if len(lm) > 470 else lm[159]
    A_ = face_mix(1); tri = delaunay(lm[::6]); P6 = lm[::6]
    def mesh(img, p):
        im = img.copy(); d = ImageDraw.Draw(im, "RGBA")
        for a, b, c in tri[:int(len(tri) * ease(p))]: d.line([tuple(P6[a]), tuple(P6[b]), tuple(P6[c]), tuple(P6[a])], fill=(255, 255, 255, 110), width=2)
        return im
    def s1(t): return cam(A_, cx0, cy0, 1.05, 0)
    def s2(t):   # تقريب على العين + دواير مسح القزحية زرقا
        p = ease(t / .8); im = cam(A_, cx0 + (eye[0] - cx0) * p, cy0 + (eye[1] - cy0) * p, 1.05 + 2.4 * p, 0); d = ImageDraw.Draw(im, "RGBA"); q = ease((t - .7) / .4)
        for k in range(4):
            r = 60 + k * 45 + 8 * math.sin(t * 6 + k); a0 = t * (120 if k % 2 else -90)
            for j in range(0, 360, 40): d.arc((FW / 2 - r, FH / 2 - r, FW / 2 + r, FH / 2 + r), a0 + j, a0 + j + 24, fill=(60, 170, 255, int(230 * q)), width=4)
        return im
    def s3(t): p = 1 - ease(t / .8); return cam(mesh(A_, t / 1.5), cx0 + (eye[0] - cx0) * p, cy0 + (eye[1] - cy0) * p, 1.05 + 2.4 * p, 0)
    def s4(t): return face_lines(cam(A_, cx0, cy0, 1.05 + .02 * t, 0), min(1.0, .35 + t / 1.2))   # خطوط تحليل الوش (المنتصف، المسطرة، زوايا الفم) زي الأصل
    def circles(img, p):
        im = img.copy(); d = ImageDraw.Draw(im, "RGBA")
        for k in range(5):
            r = (W0 * .55 - k * W0 * .08) * (1 - .75 * ease(p)) + 40; c = (mx, my); d.ellipse((c[0] - r, c[1] - r, c[0] + r, c[1] + r), outline=(255, 255, 255, 200), width=4)
        return im
    def s5(t):   # دواير بتصغر نحو الابتسامة والكاميرا تدخل وتلف معاها
        p = ease(t / 2.0); return cam(circles(A_, p), cx0 + (mx - cx0) * p, cy0 + (my - cy0) * p, 1.05 + 3.1 * p, 90 * p)
    def s6(t):   # الشفايف: التوقيع، الحدود، خطوط المحاور
        im = cam(ap_outlines(circles(A_, 1.0) if t < .6 else A_, (t - .8) / 1.6), mx, my, 4.15 + .05 * t, 90)
        return signature(im, t / 1.2, y=FH * .1) if t < 3.0 else im
    # الفكين قدام بعض زي الأصل: البعد شمال (أطراف السنان لليمين) والقبل يمين (أطرافها للشمال)، فاصل أسود بينهم، من غير قص للأطراف
    ZF, GAP = 1.12, 60
    def tips_x(img):   # أول عمود فيه سنان (أطراف السنان) في نص الكادر
        a_ = np.array(img)[int(FH * .25):int(FH * .75)].max(2) > 30; cols = np.where(a_.any(0))[0]; return int(cols.min()) if len(cols) else FW // 2
    def right_panel(img, dx=0):   # الصورة زي ما هي (الأطراف للشمال) متزقة لحد ما الأطراف تيجي يمين الفاصل
        out = black(); sh_ = FW // 2 + GAP // 2 - tips_x(img) + dx; out.paste(img, (sh_, 0)); return out
    def left_panel(img, dx=0):   # معكوسة (الأطراف لليمين) والأطراف شمال الفاصل
        f = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT); out = black(); sh_ = FW // 2 - GAP // 2 - (FW - tips_x(img)) + dx; out.paste(f, (sh_, 0)); return out   # qa-ok: الفك الشمال معكوس عشان الفكين يبصوا لبعض — مفيهوش نص
    def pair(L_img, R_img, dl=0, dr=0):
        l = left_panel(L_img, dl); r = right_panel(R_img, dr); m = Image.new("L", (FW, FH)); ImageDraw.Draw(m).rectangle((FW // 2 + dr, 0, FW, FH), fill=255); return Image.composite(r, l, m)
    AF = A(ZF)
    def s8(t):   # دخول الفكين + خط متموج على السنان القديمة، وبعدين القبل يتحول للبعد مكانه
        e = 1.0; prog = ease((t - 1.9) / .85); R_ = morph_frame(prog, ZF)
        im = pair(AF, R_, int(-FW * .6 * (1 - e)), int(FW * .6 * (1 - e)))
        if t > 2.75: im = blend(im, pair(AF, AF), ease((t - 2.75) / .25))   # آخر التحويل: نفس صورة البعد الحقيقية (علشان الانتقال للفك الواحد يبقى من غير ظل)
        q = ease((t - .6) / 1.1); a_ = 1 - ease((t - 1.9) / .4)
        if q > 0 and a_ > 0:
            lay = Image.new("RGBA", (FW, FH)); d = ImageDraw.Draw(lay); x0 = FW // 2 + GAP // 2 + 70
            pts = [(x0 + 40 * math.sin(y / 46 + 1.3), y) for y in range(120, FH - 120, 5)]; d.line(pts[:max(2, int(len(pts) * q))], fill=(255, 255, 255, int(235 * a_)), width=3)
            im = Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
        return im
    def s9(t):   # البعد اللي شمال يخرج برا الكادر، واللي يمين يتزق ويصغر لحد لقطة الفك الواحد بالظبط
        e = ease(t / .9); R_ = A(ZF + (1.08 - ZF) * e); dr = int((1 - e) * (FW // 2 + GAP // 2 - tips_x(R_)))
        r = black(); r.paste(R_, (dr, 0)); l = left_panel(AF, int(-FW * .8 * e))
        m = Image.new("L", (FW, FH)); ImageDraw.Draw(m).rectangle((min(FW, max(0, FW // 2 + dr - FW // 2 + tips_x(R_) - GAP // 2)), 0, FW, FH), fill=255)
        return Image.composite(r, l, m)
    sh = shot("A"); PL = dict(lines=.0, stagger=.15, draw=.6, mid=1.4, pct=2.2, arc=3.2, gold=99, title=99, label="")
    A11G = auto_gum(A(1.1))
    def s11(t):   # السنان تتزحلق برا الكادر
        im = black(); a = A11G; im.paste(a, (int(-FW * ease((t - .5) / 1.2)), 0)); im.info["no_auto_gum"] = True; return im   # اللثة اتملت قبل الحركة، فالفك كله بيخرج زي ما هو (ملاحظة a16 23.7)
    return [(.5, s1), (1.6, s2), (1.6, s3), (2.3, s4), (2.0, s5), (3.5, s6), (.5, lambda t: (lambda e: Image.composite(pair(AF, morph_frame(0, ZF)), cam(A_, mx, my, 4.2, 90), Image.new("L", (FW, FH), int(255 * e))))(ease(t / .5))), (3.0, s8), (1.0, s9), (7.0, push(lambda t: anim.render(sh, t, 1.08, PL), 7.0)), (2.4, s11)]

# ======================= أ١٧ نضيف ولا نبرد (27.7ث) — طولي 9:16 والصور ملفوفة =======================
def hatch_added(im, z, p, col=(60, 230, 90)):
    """المساحة اللي هتتضاف بس (شكل البعد ناقص السنة الحالية) مخططة بالأخضر + خط منقط لشكل البعد."""
    M = morph_setup(); B = shot("B"); Bt = {t["fdi"]: t for t in B.teeth_all}; lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
    hatch = ((np.add.outer(np.arange(im.height), np.arange(im.width)) // 8) % 2 == 0)
    for i, k in enumerate(M["order"]):
        q = ease(p * 1.5 - i * .07)
        if q <= 0: continue
        m1 = Image.new("L", im.size); ImageDraw.Draw(m1).polygon([B.tf(x, y, z) for x, y in M["planned"][k][::2]], fill=255)
        m2 = Image.new("L", im.size); ImageDraw.Draw(m2).polygon([B.tf(x, y, z) for x, y in Bt[k]["c"][::2]], fill=255)
        add = np.clip(np.array(m1).astype(int) - np.array(m2), 0, 255) * hatch
        g = Image.new("RGBA", im.size, col + (0,)); g.putalpha(Image.fromarray((add * .85 * q).astype(np.uint8))); lay = Image.alpha_composite(lay, g); d = ImageDraw.Draw(lay)
        pts = [B.tf(x, y, z) for x, y in M["planned"][k][::2]]; pts.append(pts[0]); part = anim.partial(pts, q)
        for j in range(0, len(part) - 1, 2): d.line([part[j], part[j + 1]], fill=col + (255,), width=3)
    return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
def flip_card(a, b, p):   # قلب كارت حقيقي (منظور) من a لـ b
    W, H = a.size; side = a if p < .5 else b; k = abs(math.cos(p * math.pi)); w = max(2, int(W * k)); sk = 90 * (1 - k)
    src = np.float32([[0, 0], [W, 0], [W, H], [0, H]]); x0 = (W - w) / 2
    dst = np.float32([[x0, sk], [x0 + w, -sk], [x0 + w, H + sk], [x0, H - sk]]) if p < .5 else np.float32([[x0, -sk], [x0 + w, sk], [x0 + w, H - sk], [x0, H + sk]])
    Mp = cv2.getPerspectiveTransform(src, dst); return Image.fromarray(cv2.warpPerspective(np.array(side), Mp, (W, H), borderValue=(0, 0, 0)))   # qa-ok: قلب كارت (منظور مقصود لحظة القلب بس، الأصل نفسه بيقلب كارت)
@T("a17", "v18")
def a17():
    z = 1.0; B = shot("B"); fa = faces_aligned(); mx, my = fa["lm"][13]
    DX = max(right_gap(morph_frame(0, z)), right_gap(morph_frame(1, z)), right_gap(morph_frame(.5, z))) + 6
    GB, GA = L(S + "assets/gum_back_before.png"), L(S + "assets/gum_back_after.png")   # لثة ممتدة لحد حافة الشاشة (الفراغ بس — السنان واللثة الأصلية زي ما هي)   # اللثة تلزق في حافة الشاشة اليمين (من غير فراغ إسود) — اختيارك
    def s1(t): return chip(morph_frame(0, z), "قبل")
    def s2(t): return morph_outlines(morph_frame(0, z), 0, z, t / 1.5)   # الحدود على السنان الظاهرة نفسها
    def s3(t): return hatch_added(morph_outlines(morph_frame(0, z), 0, z, 1.0, width=2), z, t / 1.6)
    def s4(t):
        im = hatch_added(morph_outlines(morph_frame(0, z), 0, z, 1.0, width=2), z, 1.0); im = midline(im, B, z, t / .6)
        return txt(im, (FW / 2, FH * .9), "الأخضر = ما سيُضاف إلى السن فقط، دون برد", 40, alpha=ease((t - .4) / .5))
    def s5(t): p = ease(t / 1.2); return morph_frame(p, z)   # التحويل في نفس المكان
    def s6(t):   # قوس الابتسامة ومحاور الأسنان منقطة
        im = morph_outlines(morph_frame(1, z), 1, z, t / 1.4, width=2); im = arc_line(im, B, z, (t - 1.2) / 1.2, col=(255, 255, 255), w=2)
        d = ImageDraw.Draw(im, "RGBA"); cc = current_contours(1); q = ease((t - 2.2) / 1.0)
        for k in morph_setup()["order"]:
            c = cc[k]; top = c[np.argmin(c[:, 1])]; bot = c[np.argmax(c[:, 1])]; a_, b_ = B.tf(*top, z), B.tf(*bot, z)
            for j in range(0, 20, 2): f0, f1 = j / 20 * q, (j + 1) / 20 * q; d.line([(a_[0] + (b_[0] - a_[0]) * f0, a_[1] + (b_[1] - a_[1]) * f0), (a_[0] + (b_[0] - a_[0]) * f1, a_[1] + (b_[1] - a_[1]) * f1)], fill=(255, 255, 255, 200), width=2)
        return im
    A0, A1 = gum_fill(shift_x(morph_frame(0, z), DX), GB), gum_fill(shift_x(morph_frame(1, z), DX), GA)
    def s7(t): return cam(A1, FW / 2, FH / 2, 1.0 + .1 * ease(t / 2.8), 0)   # الفك بعد العلاج لوحده بحركة كاميرا هادية (من غير وميض قبل/بعد)
    def s8(t): return cam(face_mix(0), mx, my, 3.4 + .1 * t / 4, 90)   # ابتسامة قبل بالشفايف (+90: أطراف السنان للشمال زي باقي الفيديو)
    def s9(t): return cam(face_mix(ease(t / 2.0)), mx, my, 3.5, 90)   # تتحول للبعد بنعومة
    def s10(t): return cam(ap_outlines(face_mix(1), t / 1.6, width=2), mx, my, 3.5 + .05 * t, 90)   # خط أبيض على الأطراف بس
    def _sx(f, mix=None):   # mix(t): 0 = قبل، 1 = بعد
        def g(t):
            q = mix(t) if mix else 0.0; back = GB if q <= 0 else (GA if q >= 1 else Image.blend(GB.resize(GA.size), GA, q))
            return gum_fill(shift_x(f(t), DX), back)
        return g
    s1, s2, s3, s4 = _sx(s1), _sx(s2), _sx(s3), _sx(s4); s5 = _sx(s5, lambda t: ease(t / 1.2)); s6 = _sx(s6, lambda t: 1.0)
    s5 = push(s5, 1.5)   # كان لقطة متجمدة (فلتر الفيديو)
    s6 = push(s6, 6.5)   # كان لقطة متجمدة (فلتر الفيديو)
    return [(1.0, s1), (2.0, s2), (2.0, s3), (3.0, s4), (1.5, s5), (6.5, s6), (2.8, s7), (4.0, s8), (2.4, s9), (2.5, s10)]

# ======================= أ١٨ من التصميم الرقمي للمعمل (32.2ث) =======================
@T("a18", "v19")
def a18():
    z = 1.0; B = shot("B"); M = morph_setup()
    def cad(im, p, a=1.0):   # شكل التصميم أخضر مالي + منحنيات بنفسجي + خط أفقي بنقط
        lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
        for i, k in enumerate(M["order"]):
            q = ease(p * 1.5 - i * .06)
            if q <= 0: continue
            pts = [B.tf(x, y, z) for x, y in M["planned"][k][::2]]; d.polygon(pts, fill=(40, 110, 80, int(200 * q * a)), outline=(230, 255, 240, int(255 * q * a)))
            c = M["planned"][k]; top = c[np.argmin(c[:, 1])]; bot = c[np.argmax(c[:, 1])]; xm = [B.tf(*top, z), B.tf((top[0] + bot[0]) / 2 + 25, (top[1] + bot[1]) / 2, z), B.tf(*bot, z)]
            d.line(xm, fill=(170, 60, 230, int(255 * q * a)), width=3, joint="curve")
        y = B.tf(B.mid, 0, z)[1]; d.line([(0, y), (FW * ease(p), y)], fill=(230, 40, 160, int(255 * a)), width=3)
        for x in (FW * .55, FW * .78):
            if x < FW * ease(p): d.ellipse((x - 9, y - 9, x + 9, y + 9), outline=(255, 255, 255, int(255 * a)), width=3)
        return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
    def grid(im, t):
        d = ImageDraw.Draw(im, "RGBA"); x0, y0 = FW * .15, FH * .3; n = int(ease(t / 1.2) * 10)
        for k in range(n + 1): d.line([(x0 + k * 40, y0), (x0 + k * 40, y0 + 400)], fill=(120, 220, 255, 160), width=1); d.line([(x0, y0 + k * 40), (x0 + 400, y0 + k * 40)], fill=(120, 220, 255, 160), width=1)
        return im
    def s1(t): im = morph_frame(0, z); return Image.blend(black(), im, ease(t / 1.0))
    def s2(t): return grid(morph_frame(0, z), t)
    def s3(t): return cad(morph_frame(0, z), t / 1.5)
    def s4(t): return cad(morph_frame(0, z), 1.0, 1 - ease(t / 1.0))
    def s5(t): return hatch_added(morph_outlines(morph_frame(0, z), 0, z, 1.0, width=2), z, t / 2.0)
    def s6(t): p = ease(t / 1.6); return morph_outlines(morph_frame(p, z), p, z, 1.0, width=3)
    PL = dict(lines=.0, stagger=.1, draw=.5, mid=.8, pct=1.5, arc=2.4, gold=99, title=99, label="")
    def s7(t): return anim.render(shot("A"), t, 1.08, PL)
    def s9(t): return facing(morph_frame(0, .8, 1.0), morph_frame(1, .8, 1.0), "قبل", "بعد", int(120 * (1 - ease(t / .5))))
    def s10(t): return cast_spin(t, 2.5)   # كاست فك واحد من غير لثة بيلف فوق وتحت وعليه العدسات (زي الأصل)
    P = Particles(None, (FW * .2, FH * .3, FW * .8, FH * .7), 1800, 300, col=(120, 200, 255), grav=-100)
    def s11(t): return P.draw(ImageEnhance.Brightness(s10(2.5)).enhance(1 - t / .8), t, 1.0)
    def s12(t): return neon_write(black(), CLINIC, t / 2.0, FH / 2, size=86)
    return [(1.0, s1), (2.0, s2), (4.0, s3), (1.0, s4), (4.0, s5), (2.0, s6), (4.0, s7), (3.5, lambda t: A(1.08 + .02 * t)), (2.5, s9), (2.5, s10), (.8, s11), (4.9, s12)]

# ======================= أ٢٩ تفاصيل الطبيعية (29.5ث) =======================
_CLP = {}
# قاعدة: الفيديو الحي بيتعمل من العنصر المعتمد (الوش بعد التركيب بالبق كله) بموديل فيديو — مفيش لزق ابتسامة فريم بفريم.
# الفيديوهات القديمة الملزوقة (_lock) بتتحول تلقائي للجديدة لو اتعملت وعدّت المراجعة (اسمها في LIVE_OK)
LIVE_MAP = {"after_blink": "after_blink", "smile_after_lock": "after_live", "smile_after3_lock": "after_live", "smile_after": "after_live", "smile_after3": "after_live",
            "laugh3_lock": "after_fist", "laugh2_lock": "after_fist", "laugh_lock": "after_fist", "smile_before_lock": "before_live"}
LIVE_MAP["beach_live"] = "beach_live"
# فيديو "قبل" الحي اترفض: الموديل بيّض السنان القديمة (ممنوع نجمّل القبل) — بنستخدم صورة القبل الحقيقية بحركة كاميرا   # المريض فرحان على البحر — فيديو من صورة البحر المعتمدة
LIVE_OK = {"beach_live": "beach_live_2", "after_live": "after_live_0", "after_fist": "after_fist_0", "before_live": "before_live_REJECTED", "after_blink": "after_blink_1"}   # اتراجع: نفس الابتسامة والسنان زي العنصر المعتمد   # اسم الفيديو الجديد ← الملف اللي اتختار بعد المراجعة (مثلاً "after_live": "after_live_1")
CASE_V = {"before_selfie": "before_selfie", "twin_walkin": "twin_walkin", "turn_before3": "before_turn", "turn_before2": "before_turn", "turn_before": "before_turn", "turn": "before_turn",
          "selfie3_lock": "after_selfie", "selfie3": "after_selfie", "selfie2_lock": "after_selfie", "selfie": "after_selfie",
          "mirror_lock": "after_mirror", "mirror": "after_mirror", "doctor2_lock": "doctor_talk", "doctor2": "doctor_talk", "doctor": "doctor_talk"}
PATIENT_V = set(LIVE_MAP) | set(LIVE_MAP.values()) | set(CASE_V) | set(CASE_V.values()) | {"before_selfie", "twin_walkin"}   # فيديوهات فيها وش المريض: في فولدر حالة لازم تيجي من الحالة نفسها بس
def _live(n):
    if CASE_DIR and n in CASE_V: return CASE_V[n]
    m = LIVE_MAP.get(n)
    if not m: return n
    return m if CASE_DIR else LIVE_OK.get(m, n)   # في فولدر حالة: الفيديو الحي المعتمد بتاع الحالة نفسها (elements/v/after_live.mp4)
def _vpath(n):   # فيديو الحالة الأول (elements/v/) وبعدين المكتبة العامة (assets/v/) للحاجات المش خاصة بالمريض
    if CASE_DIR and (n in PATIENT_V or _os.path.exists(CASE_DIR + "/elements/v/" + n + ".mp4")): return CASE_DIR + "/elements/v/" + n + ".mp4"   # ممنوع يظهر مريض تاني
    return S + "assets/v/" + n + ".mp4"
def vclip(n):
    n = _live(n)
    if n not in _CLP: _CLP[n] = Clip(_vpath(n), loop=False)
    return _CLP[n]
def tooth_zone(im, sh, z, t_, fy0, fy1, col, a, stripes=0):   # منطقة ملونة جوه سنة (بقناع السنة نفسها)
    m = Image.new("L", im.size); ImageDraw.Draw(m).polygon([sh.tf(x, y, z) for x, y in t_["c"][::2]], fill=255)
    band = Image.new("L", im.size); y0, y1 = t_["y"] + t_["h"] * fy0, t_["y"] + t_["h"] * fy1
    ImageDraw.Draw(band).polygon([sh.tf(t_["x"] - 20, y0, z), sh.tf(t_["x"] + t_["w"] + 20, y0, z), sh.tf(t_["x"] + t_["w"] + 20, y1, z), sh.tf(t_["x"] - 20, y1, z)], fill=255)
    mm = np.minimum(np.array(m), np.array(band)).astype(np.float32) / 255 * a
    if stripes:
        yy, xx = np.mgrid[0:im.height, 0:im.width]; mm = mm * (((xx // 26) % 2) == 0)
    arr = np.array(im).astype(np.float32); arr = arr * (1 - mm[..., None] * .65) + np.array(col, np.float32) * mm[..., None] * .65; return Image.fromarray(arr.astype(np.uint8))
@T("a29", "v38")
def a29():
    sh = shot("A"); z = 1.1; fa = faces_aligned(); mx, my = fa["lm"][13]; c11 = [q for q in sh.six if q["fdi"] == 11][0]; c12 = [q for q in sh.six if q["fdi"] == 12][0]
    def lab(im, items, t):
        d = ImageDraw.Draw(im)
        for j, (s_, tt, fy) in enumerate(items):
            q = ease((t - j * .4) / .3)
            if q <= 0: continue
            px, py = sh.tf(tt["cx"], tt["y"] + tt["h"] * fy, z); ty = FH * (.15 + .12 * j); d.ellipse((px - 6, py - 6, px + 6, py + 6), fill="white"); d.line([(px, py), (340, ty + 18), (50, ty + 18)], fill="white", width=2)
            im = txt(im, (50, ty - 8), s_, 32, anchor="lm", alpha=q); d = ImageDraw.Draw(im)
        return im
    def s1(t): return cam(face_mix(0), faces_aligned()["A"].width / 2, faces_aligned()["A"].height * .48, 1.05 + .05 * ease(t / 2.5), 0)   # صورة القبل الحقيقية (مش فيديو متولد) بزووم هادي — مفيش رعشة
    def s2(t): p = ease(t / .9); return cam(face_mix(0), fa["A"].width / 2 + (mx - fa["A"].width / 2) * p, fa["A"].height * .48 + (my - fa["A"].height * .48) * p, 1.05 + 3 * p, 90 * p)
    def s3(t):   # الفك المعزول بيبدأ في نفس مكان سنان البق وبيتحرك لمكانه، فالدمج مايبانش فيه صورتين
        e = ease(t / .6); sh_ = zoomc(gum_fill(shift_x(morph_frame(0, 1.0), DX4), GB), 1.0 + .25 * (1 - e), .9, .5); return blend(cam(face_mix(0), mx, my, 4.05, 90), sh_, ease(t / .35))   # من أول ظهوره متزق يمين ولثته لحد الحافة (زي المشهد اللي بعده) — مفيش فراغ يظهر ويختفي
    def s4(t): return morph_frame(ease((t - .5) / 2.0), 1.0 + .05 * t / 3.5)
    def s6(t):   # الثنية: الفصوص النمائية (خطوط أحمر وأزرق) + جسم السنة أزرق + أسماء
        im = A(z); im = tooth_zone(im, sh, z, c11, .15, .8, (60, 140, 255), .7 * ease(t / .5)); im = tooth_zone(im, sh, z, c12, .05, .45, (230, 60, 60), ease((t - .3) / .5), stripes=1)
        return lab(im, [("الفصوص النمائية", c12, .25), ("الأخاديد السطحية", c12, .4), ("منطقة الانعكاس", c11, .5), ("الحافة القاطعة", c11, .95)], t - .6)
    def s7(t):   # الفراغات القاطعة: حدود السنة وزاوية الفراغ
        im = outlines(A(z), type("X", (), {"six": [c11, c12], "tf": sh.tf, "teeth_all": [c11, c12]})(), z, t / 1.0, width=4); return lab(im, [("الفراغ القاطع", c11, .97)], t - .8)
    def s8(t):   # الرباعية: اللون (عنق السن برتقالي، الحافة أبيض) + خطوط دقيقة
        c13 = [q for q in sh.six if q["fdi"] == 13][0]; im = tooth_zone(A(z), sh, z, c13, .0, .55, (240, 150, 40), ease(t / .5)); im = tooth_zone(im, sh, z, c13, .55, 1.0, (250, 250, 250), ease((t - .3) / .5))
        im = tooth_zone(im, sh, z, c12, .2, .8, (255, 220, 120), ease((t - .6) / .5), stripes=1)
        return lab(im, [("الإضاءة", c13, .3), ("التشبع", c13, .8), ("الخطوط الدقيقة", c12, .5)], t - 1.0)
    def s9(t):   # شبكة ثلاثية الأبعاد على السنان
        im = A(z); m = sh.iso.crop((0, 0, 1, 1)); lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); q = ease(t / .6) * (1 - ease((t - 1.8) / .5))
        for tt in sh.six:
            for k in range(1, 8):
                f = k / 8; d.line([sh.tf(tt["x"] + tt["w"] * f, tt["y"] + 4, z), sh.tf(tt["x"] + tt["w"] * f, tt["y"] + tt["h"] - 4, z)], fill=(255, 255, 255, int(150 * q)), width=1)
                d.line([sh.tf(tt["x"] + 4, tt["y"] + tt["h"] * f, z), sh.tf(tt["x"] + tt["w"] - 4, tt["y"] + tt["h"] * f, z)], fill=(255, 255, 255, int(150 * q)), width=1)
        mk = Image.new("L", im.size); dm = ImageDraw.Draw(mk)
        for tt in sh.six: dm.polygon([sh.tf(x, y, z) for x, y in tt["c"][::2]], fill=255)
        lay.putalpha(Image.fromarray(np.minimum(np.array(lay.split()[3]), np.array(mk)))); return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
    def s10(t): p = ease(t / 1.5); return cam(face_mix(1), mx + (fa["A"].width / 2 - mx) * p, my + (fa["A"].height * .48 - my) * p, 4.05 - 3 * p, 90 * (1 - p))
    def s11(t):   # الفيديو بيكمل لقدام وبعدين يرجع لورا بنعومة (بدل ما يقفز للأول كل 5 ثواني — ملاحظة a29 28.4)
        u = t % 9.6; u = u if u < 4.8 else 9.6 - u
        return signature(cover(vclip("smile_after_lock").at(u), 1.0), t / 1.5)
    # اللثة لحد حافة الشاشة اليمين (ملاحظتك): زق يمين + الفراغ اللي بعد قوس اللثة بيتملي من خلفية لثة ممتدة (السنان واللثة الحقيقية زي ما هي)
    DX4 = max(right_gap(morph_frame(0, 1.0)), right_gap(morph_frame(1, 1.0))) + 6
    GB, GA = gum_backdrop(shift_x(morph_frame(0, 1.0), DX4), f"before_dx{DX4}"), gum_backdrop(shift_x(morph_frame(1, 1.0), DX4), f"after_dx{DX4}")
    s4 = flush_right(s4, dx=DX4, back=lambda t: Image.blend(GB, GA, ease((t - .5) / 2.0)))
    DXA = right_gap(A(z)) + 6 if right_gap(A(z)) else 0; GZ = gum_backdrop(shift_x(A(z), DXA), f"A{int(z * 100)}_dx{DXA}")
    # ملاحظة a29 19.6 (و7.4): من 7.5 لـ22ث كله نفس الابتسامة ← كاميرا واحدة بتقرّب ببطء على طول المشاهد كلها، فمفيش قفزة في الحجم بين مشهد والتاني
    def RAMP(t0): return lambda fn: (lambda t: zoomc(fn(t), 1 + .18 * (t0 + t) / 14.5, .5, .5))
    sA0 = RAMP(0.0)(flush_right(lambda t: A(z), dx=DXA, back=GZ))
    s6, s7, s8, s9 = (RAMP(o)(flush_right(f, dx=DXA, back=GZ)) for f, o in ((s6, 2.0), (s7, 6.0), (s8, 8.0), (s9, 12.0)))
    # ملاحظة a29 7.4: آخر كادر في التحول وأول كادر هنا نفس الابتسامة بمقاسين مختلفين ← زووم ناعم من مقاس للتاني + ذوبان، من غير قطع
    def _tb(im):
        h = np.array(im.convert("HSV")); m = (h[..., 2] > 170) & (h[..., 1] < 60); ys, xs = np.where(m); return np.percentile(ys, 3), np.percentile(ys, 97), np.median(xs), np.median(ys)
    E4 = s4(3.49); A0 = sA0(0.0); (a0, a1, ax, ay), (b0, b1, bx, by) = _tb(E4), _tb(A0); RZ = (b1 - b0) / max(1, a1 - a0)
    def sA(t):
        if t >= .7: return sA0(t)
        e = ease(t / .7); zz = 1 + (RZ - 1) * e   # الكادر القديم بيكبر لحد مقاس الجديد، والجديد بيظهر فوقه
        cx_ = ax + (bx - ax) * e; cy_ = ay + (by - ay) * e   # مركز السنان بيتنقل بنعومة من مكانه القديم للجديد
        old_ = auto_gum(E4).transform(E4.size, Image.AFFINE, (1 / zz, 0, ax - cx_ / zz, 0, 1 / zz, ay - cy_ / zz), Image.BICUBIC)
        nw = sA0(t); new_ = nw.transform(nw.size, Image.AFFINE, (RZ / zz, 0, bx - cx_ * RZ / zz, 0, RZ / zz, by - cy_ * RZ / zz), Image.BICUBIC)   # الجديد متطابق مع القديم في كل لحظة (مفيش صورتين فوق بعض)
        im = Image.blend(old_, new_, e); im.info["no_auto_gum"] = True; return im
    return [(2.5, s1), (.9, s2), (.6, s3), (3.5, s4), (2.0, sA), (4.0, s6), (2.0, s7), (4.0, s8), (2.5, s9), (1.5, s10), (6.0, s11)]

# ======================= أ٨ لعبة الابتسامة كامل (16.8ث) — ملفوفة زي الأصل =======================
@T("a08", "v07", "chip")
def a08():
    M = morph_setup(); B = shot("B"); z = 1.0; SP = sprite().resize((288, 270), Image.NEAREST); order = M["order"]; cc0 = current_contours(0)
    # نقطة الحافة القاطعة لكل سنة في الفريم الملفوف (السنان على اليمين، الحواف ناحية الشمال)
    def edge(k): pts = np.array([B.tf(x, y, z) for x, y in cc0[k]]); j = np.argmin(pts[:, 0]); return pts[j]
    E = [edge(k) for k in order]; hop = .62
    def coin(d, x, y, a):
        d.ellipse((x - 40, y - 40, x + 40, y + 40), fill=(255, 205, 40, a), outline=(160, 110, 0, a), width=7); d.rectangle((x - 8, y - 22, x + 8, y + 22), fill=(255, 240, 150, a))
    def s1(t):   # الشخصية بتنزل وتنط على حافة كل سنة، والسنة اللي تتخبط تتحول للبعد وتطلع عملة
        prog = {k: ease((t - j * hop - .3) / .25) for j, k in enumerate(order)}; im = morph_frame(prog, z); d = ImageDraw.Draw(im, "RGBA")
        j = min(len(E) - 1, int(t / hop)); f = (t % hop) / hop; a = E[j]; b = E[min(j + 1, len(E) - 1)]
        x = a[0] - SP.width / 2 - 10 - 120 * math.sin(math.pi * f); y = a[1] + (b[1] - a[1]) * f
        for jj, e in enumerate(E):
            ft = t - jj * hop - .3
            if 0 < ft < .6: coin(d, e[0] - 60 - 260 * ft, e[1], int(255 * (1 - ft / .6)))
        im = paste(im, SP.rotate(90, expand=True), x, y); return txt(im, (FW / 2, 90), f"العملات {sum(1 for jj in range(len(E)) if t > jj * hop + .3)}", 46)
    def s2(t):   # الحدود + مثلثات حمرا بزوايا الفراغات القاطعة
        im = morph_outlines(morph_frame(1, z), 1, z, t / .8, width=3); d = ImageDraw.Draw(im, "RGBA"); cc = current_contours(1); xi = min(B.tf(x, y, z)[0] for k in order for x, y in cc[k][::4]); angs = [20, 30, 40, 50, 40, 30, 20, 20]
        for j in range(len(order) - 1):
            q = ease((t - .6 - j * .15) / .3)
            if q <= 0: continue
            y = (B.tf(*cc[order[j]].mean(0), z)[1] + B.tf(*cc[order[j + 1]].mean(0), z)[1]) / 2
            d.polygon([(xi - 34, y - 13), (xi - 34, y + 13), (xi - 8, y)], fill=(230, 40, 40, int(255 * q))); d.text((xi - 48, y), f"{angs[j % 8]}°", font=F("TY-VT323.ttf", 54), fill=(255, 255, 255, int(255 * q)), anchor="rm")
        return im
    def s3(t):   # الشخصية ماشية بلافتة صفرا عليها اسم الطبيب
        im = morph_frame(1, z); y = FH * .25 + FH * .5 * (t / 3.0); x = E[0][0] - 130
        ban = Image.new("RGBA", (520, 120)); dd = ImageDraw.Draw(ban); dd.rectangle((0, 0, 519, 119), fill=(250, 200, 40, 255), outline=(120, 80, 0, 255), width=6); dd.text((260, 60), DOC, font=F(FA, 54), fill=(60, 30, 0), anchor="mm", direction="rtl")
        im = paste(im, ban.rotate(90, expand=True), x - 40, y + 300); return paste(im, SP.rotate(90, expand=True), x + 20, y + 20 * math.sin(t * 12))
    def s4(t):   # قبل وبعد متقابلين مع زووم
        zz = .8 + .25 * ease(t / 3.8); return facing(morph_frame(0, zz, 1.0), morph_frame(1, zz, 1.0))
    return [(len(E) * hop + .6, s1), (.8, lambda t: morph_frame(1, z)), (2.4, s2), (3.0, s3), (16.8 - (len(E) * hop + .6) - .8 - 2.4 - 3.0, s4)]

# ======================= أداة: وش المريض بالمبعد وجواه سنانه الحقيقية (قبل/بعد/أي مرحلة في المورف) =======================
_RF = {}
def retract_face(prog=0.0, overlay=None):
    """prog: تقدم المورف (0 قبل، 1 بعد). overlay: دالة بتعدّل صورة الماكرو قبل اللصق (جل، بوند...)."""
    if not _RF:
        Fc = np.array(L(TO + "retract_face.png")); bx0, by0, bx1, by1 = np.load(TO + "retract_teeth_box.npy")
        B = shot("B"); allt = [t for t in B.teeth_all]; X0 = min(t["x"] for t in allt); Y0 = min(t["y"] for t in allt); X1 = max(t["x"] + t["w"] for t in allt); Y1 = max(t["y"] + t["h"] for t in allt)
        sx = (bx1 - bx0) / (X1 - X0); sy = (by1 - by0) / (Y1 - Y0); s_ = (sx + sy) / 2
        Mx = np.float32([[s_, 0, (bx0 + bx1) / 2 - s_ * (X0 + X1) / 2], [0, s_, (by0 + by1) / 2 - s_ * (Y0 + Y1) / 2]])
        m = np.zeros((B.H, B.W), np.uint8)
        for t in allt: cv2.fillPoly(m, [t["c"].astype(np.int32)], 255)
        m = cv2.dilate(m, np.ones((31, 31), np.uint8))   # السنان + شوية لثة حواليها
        ai = np.zeros(Fc.shape[:2], np.uint8); cm = cv2.imread(TO + "rcrop_teeth.png", 0); _rx, _ry = (np.load(TO + "retract_crop.npy") if _os.path.exists(TO + "retract_crop.npy") else (611, 1398)); ai[_ry:_ry + cm.shape[0], _rx:_rx + cm.shape[1]] = (cm > 128).astype(np.uint8) * 255
        ai = cv2.dilate(ai, np.ones((45, 45), np.uint8))   # كل مكان السنان المولّدة لازم يتغطى بالحقيقي
        _RF.update(F=Fc, M=Mx, m=m, ai=ai)
    R = _RF; mac = np.array(morph_img(prog, rotated=False))
    if overlay is not None: mac = np.array(overlay(Image.fromarray(mac)))
    H_, W_ = R["F"].shape[:2]; wm = cv2.warpAffine(mac, R["M"], (W_, H_), flags=cv2.INTER_AREA)
    mm = np.maximum(cv2.warpAffine(R["m"], R["M"], (W_, H_)), np.minimum(R["ai"], cv2.warpAffine(np.full(R["m"].shape, 255, np.uint8), R["M"], (W_, H_)))); M_ = morph_setup()
    if not isinstance(prog, (int, float)) or prog > 0:   # البعد أطول: نزود شكل البعد في القناع
        cur = np.zeros_like(R["m"])
        for k, c in current_contours(prog).items(): cv2.fillPoly(cur, [c.astype(np.int32)], 255)
        mm = np.maximum(mm, cv2.warpAffine(cv2.dilate(cur, np.ones((21, 21), np.uint8)), R["M"], (W_, H_)))
    k = cv2.GaussianBlur(mm, (0, 0), 6).astype(np.float32)[..., None] / 255
    return Image.fromarray((wm * k + R["F"] * (1 - k)).astype(np.uint8))

# ======================= أ٦ الخطوات على الوش (29.2ث) =======================
import os as _os
def asset_clip(*names):   # أول فيديو موجود من القايمة (بعد التحويل للفيديو الحي المعمول من العنصر المعتمد)
    names = [_live(n) for n in names]
    for n in names:
        if _os.path.exists(_vpath(n)): return vclip(n)
    return None
def upper_tint(col, reveal, alpha, from_right=False):
    def f(mac):
        M = morph_setup(); u = np.zeros(M["FB"].shape[:2], np.float32)
        for k in M["order"]: u = np.maximum(u, M["FM"][k])
        xs = np.arange(u.shape[1])[None, :]; x0 = min(np.where(u.any(0))[0]); x1 = max(np.where(u.any(0))[0]); u = u * ((xs > x1 - (x1 - x0) * reveal) if from_right else (xs < x0 + (x1 - x0) * reveal))
        a = np.array(mac).astype(np.float32); a = a * (1 - u[..., None] * alpha) + np.array(col, np.float32) * u[..., None] * alpha; return Image.fromarray(a.astype(np.uint8))
    return f
@T("a06", "v05")
def a06():
    RF0 = retract_face(0); W0, H0 = RF0.size; bx0, by0, bx1, by1 = np.load(TO + "retract_teeth_box.npy"); mcx, mcy = (bx0 + bx1) / 2, (by0 + by1) / 2; Z = 1.3
    def face_cam(img, z=Z): return cam(img, mcx, mcy - 150, z, 0)
    M0 = morph_setup()
    sc = (bx1 - bx0) / W0 * FW * Z   # عرض السنان على الشاشة
    def tool(im, name, t, dur, y_off=0, ang=0):
        e = key_black(L(S + "assets/" + name + ".png")); x = FW * 1.1 - (FW * .9) * ease(t / dur); return paste(im, e, x, FH / 2 + y_off, sc * 1.1 / e.width, ang)
    turn = asset_clip("turn_before3", "turn_before2", "turn")
    def s1(t): return cover(turn.at(t * 1.6), 1.0) if turn else cover(BF, 1.0)
    def s2(t): p = ease(t / 1.0); return blend(cover(BF, 1.0 + .3 * p), cam(RF0, W0 / 2 + (mcx - W0 / 2) * p, H0 * .45 + (mcy - 150 - H0 * .45) * p, 1.0 + (Z - 1) * p, 0), (t - .3) / .6)
    # أمبوبة الحمض كبيرة زي الأصل: داخلة من تحت، سنّها لفوق، وبتمشي على السنان العلوية مع اللون الأزرق
    ES = key_black(L(S + "assets/etch_syringe.png")); ES = ES.crop(ES.split()[3].getbbox()).rotate(-90, expand=True)
    ES = ES.resize((int(ES.width * FH * .52 / ES.height), int(FH * .52)), Image.LANCZOS)
    pts = sorted(rf_screen_pts(k, 0) for k in M0["order"]); PX = np.array([p[0] for p in pts]); PY = np.array([p[1] for p in pts]) - 15
    def etch(im, t, dur=2.5):
        r = np.clip(t / 2.0, 0, 1); x = PX[0] + (PX[-1] - PX[0]) * r; y = np.interp(x, PX, PY)
        y += FH * .6 * (1 - ease(min(t / .4, 1))) + FH * .6 * ease(max(0, (t - 2.05) / .45))   # دخول وخروج من تحت
        ang = 14 - 10 * r; e = ES.rotate(ang, resample=Image.BICUBIC, expand=True); a = np.array(e.split()[3]); ys, xs = np.where(a > 60); i = ys.argmin(); tx, ty = xs[i], ys[i]
        base = im.convert("RGBA"); sh = Image.new("RGBA", e.size, (0, 0, 0, 0)); sh.putalpha(Image.fromarray((a * .45).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14)))
        base.alpha_composite(sh, (int(x - tx - 45), int(y - ty + 70))) if x - tx - 45 >= 0 else base.paste(sh, (int(x - tx - 45), int(y - ty + 70)), sh)
        base.paste(e, (int(x - tx), int(y - ty)), e); return base.convert("RGB")
    def s3(t): return etch(face_cam(retract_face(0, upper_tint((40, 110, 255), t / 2.0, .55))), t)   # الحمض أزرق
    # الغسيل: سرنجة هوا/مية (chip air syringe) كبيرة داخلة من تحت شمال، ورذاذ أبيض زي الدخان بيشيل الأزرق
    AS = Image.open(S + "assets/air3w_rgba.png").convert("RGBA"); AS = AS.resize((int(FW * .9), int(FW * .9)), Image.LANCZOS); ATX, ATY = 1829 / 2048 * AS.width, 276 / 2048 * AS.height
    TX, TY = PX.mean() + FW * .02, PY.mean() + FH * .08
    rng = np.random.default_rng(7); NM = 1100; born = np.sort(rng.uniform(.3, 1.15, NM)); ang = np.radians(-38 + rng.normal(0, 12, NM)); spd = rng.uniform(220, 560, NM); rad0 = rng.uniform(6, 18, NM); wob = rng.uniform(0, 6.28, NM)
    def _nz(sig): n = cv2.GaussianBlur(rng.random((FH // 4, FW // 4)).astype(np.float32), (0, 0), sig); return cv2.resize((n - n.min()) / np.ptp(n), (FW, FH))
    noise = .6 * _nz(2) + .4 * _nz(6)
    def tip_at(t):
        e_in = ease(min(t / .35, 1)); e_out = ease(max(0, (t - 1.25) / .25)); mv = ease(np.clip((t - .4) / .9, 0, 1))
        return TX - FW * .5 * (1 - e_in) + FW * .1 * mv - FW * .4 * e_out, TY + FH * .35 * (1 - e_in) + FH * .3 * e_out, -10 * mv
    def mist(im, t):
        lay = np.zeros((FH // 2, FW // 2), np.float32)
        for i in np.where((born < t) & (t - born < 1.0))[0]:
            a_ = t - born[i]; sx, sy, _ = tip_at(born[i]); d = spd[i] * a_ * (1 - .4 * a_); x = (sx + np.cos(ang[i]) * d + 30 * np.sin(wob[i] + 5 * a_)) / 2; y = (sy + np.sin(ang[i]) * d - 60 * a_ * a_) / 2
            cv2.circle(lay, (int(x), int(y)), int((rad0[i] + 120 * a_) / 2), float(.45 * (1 - a_) ** 1.2), -1, cv2.LINE_AA)
        lay = cv2.GaussianBlur(lay, (0, 0), 14); lay = cv2.resize(lay, (FW, FH)); lay = lay * (.5 + 1.0 * noise); lay = np.clip(lay * 3.0, 0, .8)[..., None]
        a = np.array(im).astype(np.float32); return Image.fromarray((a * (1 - lay) + np.array([246, 248, 250], np.float32) * lay).astype(np.uint8))
    def s4(t):
        wash = np.clip((t - .45) / .75, 0, 1)   # الرذاذ بيمسح الأزرق من اليمين للشمال (مكان ما بيضرب الأول)
        im = face_cam(retract_face(0, upper_tint((40, 110, 255), 1 - ease(wash), .55)))
        tx, ty, rot = tip_at(t)
        e = AS.rotate(rot, resample=Image.BICUBIC, expand=True) if rot else AS
        if rot:   # مكان السن بعد اللف
            c0 = np.array([AS.width / 2, AS.height / 2]); v = np.array([ATX, ATY]) - c0; th = np.radians(rot); R2 = np.array([[np.cos(th), np.sin(th)], [-np.sin(th), np.cos(th)]]); etx, ety = R2 @ v + np.array([e.width / 2, e.height / 2])
        else: etx, ety = ATX, ATY
        b = im.convert("RGBA"); b.paste(e, (int(tx - etx), int(ty - ety)), e); im = b.convert("RGB")
        return mist(im, t) if t > .3 else im
    def s5(t): return tool(face_cam(retract_face(0, upper_tint((255, 210, 40), t / 1.3, .45))), "bond_brush", t, 1.5, -20, -20)   # البوند أصفر
    # كاست المعمل: فك علوي واحد من غير لثة، داخل من اليمين وبيتلف، والفينيرات بتتاخد منه وتطير تقعد على سنان المريض
    CV = np.array(Image.open(S + "assets/cast1_v_rgba.png")); CS = np.array(Image.open(S + "assets/cast1_s_rgba.png")); CL = cv2.imread(S + "assets/cast1_lab.png", 0)
    NV = int(CL.max()); CC = [np.argwhere(CL == j + 1).mean(0)[::-1] for j in range(NV)]   # مراكز الفينيرات (x, y) على الكاست
    CMK = [cv2.GaussianBlur(cv2.dilate((CL == j + 1).astype(np.uint8) * 255, np.ones((15, 15), np.uint8)), (0, 0), 3).astype(np.float32) / 255 for j in range(NV)]
    CSC = FH * .78 / CV.shape[0]   # ارتفاع الكاست على الشاشة
    M = morph_setup(); pcs, ms = veneer_pieces(); R_ = _RF; W0_, H0_ = R_["F"].shape[1], R_["F"].shape[0]
    SPX = ms * float(np.hypot(R_["M"][0, 0], R_["M"][0, 1])) * max(FW / W0_, FH / H0_) * Z   # حجم السنة على الشاشة
    ORD = sorted(M["order"], key=lambda k: rf_screen_pts(k, 0)[0]); NO = len(ORD)
    CT0, STEP, FLY = 2.55, .15, .45   # امتى الفينيرات تبدأ تطير
    def cast_img(t):   # الكاست بعد ما الفينيرات اللي طارت اتشالت منه
        rem = np.zeros(CL.shape, np.float32)
        for i in range(NO):
            if t > CT0 + i * STEP: rem = np.maximum(rem, CMK[i % NV])
        r = rem[..., None]; return (CV.astype(np.float32) * (1 - r) + CS.astype(np.float32) * r).astype(np.uint8)
    def _key(fr):   # إزالة الأخضر من فريم الفيديو
        a = fr.astype(np.float32); r_, g_, b_ = a[..., 0], a[..., 1], a[..., 2]; d = g_ - np.maximum(r_, b_); al = np.clip(1 - (d - 10) / 40, 0, 1)
        al = cv2.GaussianBlur(cv2.erode(al, np.ones((3, 3), np.uint8)), (0, 0), 1.0); a[..., 1] = np.minimum(g_, (r_ + b_) / 2 + 4)
        return np.dstack([a, al * 255]).clip(0, 255).astype(np.uint8)
    # فيديو الكاست وهو بيلف فوق وتحت (ثلاثي الأبعاد حقيقي) — بنلفه بالطول زي الأصل
    TV = 2.4; _cap = cv2.VideoCapture(S + "assets/v/cast_rot2.mp4"); VFR = []
    while True:
        ok, fr = _cap.read()
        if not ok: break
        VFR.append(np.rot90(_key(cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)), -1).copy())
        if len(VFR) > 1.6 * 24: break   # الجزء الهادي بس: قدام ← ميل لفوق وتحت ← قدام
    a0 = VFR[0][..., 3] > 100; ys0, xs0 = np.where(a0); VS = CSC * CV.shape[0] / (ys0.max() - ys0.min()); VC = np.float32([(xs0.min() + xs0.max()) / 2, (ys0.min() + ys0.max()) / 2])
    def cast_pose(t):
        e_in = ease(min(t / .8, 1)); e_out = ease(max(0, (t - 4.15) / .35))
        return FW * .8 + FW * .6 * (1 - e_in) + FW * .24 * ease(np.clip((t - 2.2) / .4, 0, 1)) + FW * .7 * e_out, FH * .5
    def s67(t):
        prog = {k: ease((t - CT0 - i * STEP - FLY) / .12) for i, k in enumerate(ORD)}
        im = face_cam(retract_face(prog)).convert("RGBA"); cx, cy = cast_pose(t)
        st = Image.fromarray(cast_img(t), "RGBA"); st = st.resize((int(st.width * CSC), int(st.height * CSC)), Image.LANCZOS); ox, oy = int(cx - st.width / 2), int(cy - st.height / 2)
        def put(e, x, y):
            im.alpha_composite(e, (max(0, x), max(0, y)), (max(0, -x), max(0, -y)))
        if t < TV + .15:   # الفيديو بيلف، وفي الآخر بيدوب في الصورة الثابتة (نفس الوضع)
            fr = VFR[min(len(VFR) - 1, int(t / TV * (len(VFR) - 1)))]; e = Image.fromarray(fr, "RGBA"); e = e.resize((int(e.width * VS), int(e.height * VS)), Image.LANCZOS)
            vx, vy = int(cx - VC[0] * VS), int(cy - VC[1] * VS); a_ = 1 - np.clip((t - TV) / .15, 0, 1)
            if a_ < 1: put(st, ox, oy)
            if a_ > 0:
                if a_ < 1: al = e.split()[3].point(lambda v: int(v * a_)); e.putalpha(al)
                put(e, vx, vy)
        else: put(st, ox, oy)
        for i, k in enumerate(ORD):   # الفينيرات الطايرة من الكاست لسنان المريض
            q = (t - CT0 - i * STEP) / FLY
            if not 0 <= q < 1 or k not in pcs: continue
            sx_, sy_ = ox + CC[i % NV][0] * CSC, oy + CC[i % NV][1] * CSC
            tx_, ty_ = rf_screen_pts(k, 1.0); e = ease(q); x = sx_ + (tx_ - sx_) * e; y = sy_ + (ty_ - sy_) * e - 160 * np.sin(np.pi * e)
            pc = pcs[k][0]; sc_ = SPX * (2.2 - 1.2 * e); rot = -90 * (1 - e)
            p2 = pc.resize((max(1, int(pc.width * sc_)), max(1, int(pc.height * sc_))), Image.LANCZOS).rotate(rot, resample=Image.BICUBIC, expand=True)
            put(p2, int(x - p2.width / 2), int(y - p2.height / 2))
        return im.convert("RGB")
    laugh = asset_clip("laugh3_lock", "laugh2_lock", "laugh_lock")
    def s8(t): return flash(cover(laugh.at(t), 1.0), 1 - t / .3) if t < .3 else cover(laugh.at(t), 1.0)
    def s9(t): return facing(morph_frame(0, .8, 1.0), morph_frame(1, .8, 1.0), "قبل", "بعد", int(120 * (1 - ease(t / .5))))
    PL = dict(lines=.0, stagger=.1, draw=.5, mid=.8, pct=1.5, arc=2.4, gold=99, title=99, label="")
    def s10(t): return anim.render(shot("A"), t, 1.08, PL)
    mirror = asset_clip("mirror_lock", "mirror")
    def s12(t): return cover(mirror.at(t), 1.0) if mirror else cover(AP, 1.0)
    s10 = push(s10, 4.5)   # كان لقطة متجمدة (فلتر الفيديو)
    s9 = push(s9, 3.5)   # كان لقطة متجمدة (فلتر الفيديو)
    return [(2.5, s1), (1.0, s2), (2.5, s3), (1.5, s4), (1.5, s5), (4.5, s67), (2.0, s8), (3.5, s9), (4.5, s10), (1.0, lambda t: cover(AP, 1.6 - .5 * t)), (4.7, s12)]

# ======================= أ٢٢ الطبيب يصنع الابتسامة (29.7ث) =======================
@T("a22", "v23")
def a22():
    fa = faces_aligned(); lm = fa["lm"]; W0, H0 = fa["A"].size; cx0, cy0 = W0 / 2, H0 * .48; mx, my = lm[13]
    OU = Image.open(TO + "before_teeth_upper.png").convert("RGBA"); OL = Image.open(TO + "before_teeth_lower.png").convert("RGBA")
    NU = Image.open(TO + "after_teeth_upper.png").convert("RGBA"); NL = Image.open(TO + "after_teeth_lower.png").convert("RGBA"); V = key_black(L(S + "assets/veneer_upper.png")); V = V.crop(V.getbbox())   # عدسة علوية أمامية
    doc = asset_clip("doctor2_lock", "doctor2")
    def arcs(im, y, sc, new=0.0, a=1.0):
        gap = (OU.height * sc / OU.width * FW) * .55 + (OL.height * sc / OL.width * FW) * .55   # صفين منفصلين زي الأصل: العلوي فوق والسفلي تحته
        im = paste(im, OL if new < .5 else NL, FW / 2, y + gap, sc / OL.width * FW, alpha=a); return paste(im, OU if new < .5 else NU, FW / 2, y, sc / OU.width * FW, alpha=a)   # السفلي الأول والعلوي فوقه
    def glow(im, x, y, r, a):
        g = Image.new("RGB", im.size); ImageDraw.Draw(g).ellipse((x - r, y - r, x + r, y + r), fill=(255, 190, 70)); g = g.filter(ImageFilter.GaussianBlur(r * .6)); return screen(im, Image.blend(black(), g, a))
    def rings(im, x, y, t, a):
        d = ImageDraw.Draw(im, "RGBA")
        for k in range(3):
            r = 90 + k * 45; a0 = t * (140 if k % 2 else -110)
            for j in range(0, 360, 30): d.arc((x - r, y - r, x + r, y + r), a0 + j, a0 + j + 16, fill=(255, 200, 90, int(220 * a)), width=4)
        return im
    def s1(t): return cam(face_mix(0), cx0, cy0, 1.05, 0)
    P = Particles(None, (FW * .38, FH * .52, FW * .62, FH * .6), 900, 200, col=(255, 255, 255), grav=-30)
    def s2(t): return P.draw(cam(face_mix(0), cx0, cy0, 1.05, 0), t, 1.5)
    def s3(t): im = ImageEnhance.Brightness(cam(face_mix(0), cx0, cy0, 1.05, 0)).enhance(.85); return arcs(im, FH * .62 + 80 * ease(t / 1.0), .55 * (1 + .3 * ease(t / 1.0)), ease((t - 1.3) / .4))   # السنان القديمة بتطلع وتتحول لعدسات بيضا
    def dview(t, new=0.0, extra=None):
        im = cover(doc.at(t), 1.0) if doc else cover(AP, 1.0); im = glow(im, FW / 2, FH * .6, 110, .3 + .15 * math.sin(t * 5)); im = arcs(im, FH * .74, .7, 1.0)   # الضوء عند الإيدين مش على الوش، والعدسات بيضا
        return extra(im) if extra else im
    def s4(t): return dview(t)
    def s5(t):   # فينيرة بتتشكل بين إيديه بضوء ذهبي ودواير
        def ex(im): im = rings(im, FW * .5, FH * .6, t, ease(t / .5)); return paste(im, V, FW * .5, FH * .6, (.06 + .08 * ease(t / 2.5)) * FW / V.width * 1.5, 12 * math.sin(t * 2))   # بين إيديه قدّام صدر المريض — مش على وشه
        return dview(3.5 + t, 0, ex)
    def s6(t): return dview(4.9, ease(t / .6), lambda im: Particles(None, (FW * .2, FH * .66, FW * .8, FH * .82), 700, 300, col=(255, 230, 160), grav=-60).draw(im, t, 1.0))
    def s7(t): return arcs(cam(face_mix(1), cx0, cy0, 1.05, 0), FH * .62, .55 * 1.3, 1, 1 - ease(t / 1.2)) if t < 1.2 else cam(face_mix(1), cx0, cy0, 1.05 + .02 * t, 0)
    def s9(t):   # الشفايف: نسب الأسنان من عرض ما بين الأنياب + حلزون جوه سنة
        im = cam(ap_outlines(face_mix(1), t / 1.5, col=(255, 255, 255), width=2), mx, my, 4.0 + .1 * t / 9, 90)
        ks = sorted([k for k in fa["teeth"] if k < 30 and k % 10 <= 3], key=lambda k: fa["teeth"][k][:, 0].mean()); vals = ["10%", "15%", "25%", "25%", "15%", "10%"]; s_ = max(FW / W0, FH / H0) * 4.0
        for j, k in enumerate(ks[:6]):
            q = ease((t - 1.5 - j * .2) / .3)
            if q > 0: c = fa["teeth"][k].mean(0); X = FW / 2 - s_ * (c[1] - my); Y = FH / 2 + s_ * (c[0] - mx); im = txt(im, (min(FW - 80, X + 280), Y), vals[j], 42, font=FSER, rtl=False, alpha=q)
        if t > 4: im = spiral_on(im, FW * .38, FH * .42, 160, 160 * 1.618, ease((t - 4) / 1.5))
        return im
    return [(1.0, s1), (1.5, s2), (2.0, s3), (3.5, s4), (4.0, s5), (1.0, s6), (2.5, s7), (.5, lambda t: cam(face_mix(1), mx, my, 3.0, 45)), (9.0, s9), (1.4, lambda t: cam(face_mix(1), cx0, cy0, 1.6 - .3 * t, 0)), (3.3, logo)]
# ======================= أ٢٣ طبقات الكومبوزيت (27ث) =======================
@T("a23", "v24")
def a23():
    _av = sys.argv; sys.argv = ["card", "x", "x", "0"]; import card as CD; sys.argv = _av
    fa = faces_aligned(); lm = fa["lm"]; W0, H0 = fa["A"].size; cx0, cy0 = W0 / 2, H0 * .48; mx, my = lm[13]
    PR = L(TO + "profile_right.png")
    def s2(t):   # بطاقة القياس قدام البق
        im = cam(face_mix(0), cx0, cy0, 1.05, 0); c = CD.CARD[0 if t < 1.0 else 1].rotate(0); sc = .38; return paste(im, c, FW / 2, FH * .62 + 300 * (1 - ease(t / .6)), sc)
    AC = L(TO + "angle_closed_0.png")   # عنصر: وشه بزاوية والشفايف مقفولة (السنان مش باينة فمفيش تعديل في السنان)
    def s3(t):   # زي الأصل: الوش بزاوية + المخطط الأبيض (خطوط ونقط الملامح، خط المنتصف، المسطرة) بيترسم تدريجي
        return face_lines(cover(AC, 1.0 + .02 * t), min(1.0, t / 1.6))
    def s4(t): return cam(face_mix(ease((t - 1.5) / 2.5)), mx, my, 3.4, 60)   # الشفايف قبل ← بعد
    sh = shot("A"); z = 1.12; CS = key_black(L(S + "assets/composite_syringes.png"))
    AG6 = auto_gum(A(z))   # اللثة بتتملي على الفك نفسه قبل ما الرسومات والسرنجات تتحط (ملاحظة a23 17.1: كانت بتتملي وتختفي مع حركة السرنجات)
    def s6w(t): im = s6(t); im.info["no_auto_gum"] = True; return im
    def s6(t):   # مقطع السنة بطبقات الكومبوزيت + سرنجات المواد
        im = AG6.copy(); c11 = [q for q in sh.six if q["fdi"] == 11][0]
        im = tooth_zone(im, sh, z, c11, .0, .75, (230, 90, 140), ease(t / .6)); im = tooth_zone(im, sh, z, c11, .55, 1.0, (190, 215, 255), ease((t - .6) / .6))
        for j, (s_, col, fy) in enumerate((("طبقة العاج", (230, 90, 140), .4), ("طبقة المينا", (255, 255, 255), .7), ("الطبقة الشفافة", (190, 215, 255), .92))):
            q = ease((t - .5 - j * .6) / .4)
            if q > 0:
                px, py = sh.tf(c11["cx"], c11["y"] + c11["h"] * fy, z); ty = FH * (.2 + .25 * j); dd = ImageDraw.Draw(im); dd.line([(px, py), (330, ty)], fill="white", width=2)
                im = paste(im, CS, 190, ty, .2, -30); im = txt(im, (60, ty + 90), s_, 34, anchor="lm", alpha=q, fill=col)
        return im
    sa = asset_clip("smile_after_lock", "smile_after")
    return [(1.0, lambda t: cam(face_mix(0), cx0, cy0, 1.05, 0)), (2.5, s2), (4.5, s3), (6.0, s4), (1.0, lambda t: cam(face_mix(1), mx, my, 3.4 - 1.5 * t, 60 * (1 - t))), (3.5, s6w), (1.5, lambda t: A(z)),
            (2.5, lambda t: cover(sa.at(t), 1.0)), (3.5, lambda t: cam(face_mix(1), mx, my, 3.2 + .1 * t, 60)), (1.0, logo)]

# ======================= أدوات مشتركة للقوالب اللي فيها المبعد والعصي =======================
def rf_cam(img, z=1.3):
    bx0, by0, bx1, by1 = np.load(TO + "retract_teeth_box.npy"); return cam(img, (bx0 + bx1) / 2, (by0 + by1) / 2 - 150, z, 0)
def rf_screen_pts(k, prog=1.0, z=1.3):   # مكان سنة على الشاشة في لقطة الوش بالمبعد
    retract_face(0); R = _RF; c = current_contours(prog)[k].mean(0); x, y = R["M"] @ np.array([c[0], c[1], 1.0])
    W0, H0 = R["F"].shape[1], R["F"].shape[0]; bx0, by0, bx1, by1 = np.load(TO + "retract_teeth_box.npy"); s_ = max(FW / W0, FH / H0) * z
    return FW / 2 + s_ * (x - (bx0 + bx1) / 2), FH / 2 + s_ * (y - ((by0 + by1) / 2 - 150))
def sticks_seat(t, step=.18, fly=.45):   # عصي التركيب بتجيب كل فينيرة وتقعدها على سنتها في وش المريض
    M = morph_setup(); ST = EL("stick"); prog = {k: ease((t - i * step - fly) / .15) for i, k in enumerate(M["order"])}; im = rf_cam(retract_face(prog))
    for i, k in enumerate(M["order"]):
        q = (t - i * step) / fly
        if 0 < q < 1.3:
            x, y = rf_screen_pts(k); e = ease(min(q, 1)); im = paste(im, ST, x + 30, y + 170 + 600 * (1 - e), .2, -12, alpha=1 - max(0, (q - 1) / .3))
    return im
_FLD = {}
def face_lines(im, p, col=(255, 255, 255)):
    """أداة عامة: شبكة تحليل الوش (خطوط رفيعة بين نقط الملامح + نقط + خط المنتصف + مسطرة تحت الدقن + علامات زوايا البق)،
    بتتحسب من الفريم نفسه (فبتمشي مع حركة الوش في الفيديو)."""
    import mediapipe as mp
    from mediapipe.tasks.python import vision, BaseOptions
    if "d" not in _FLD: _FLD["d"] = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=S + "face/face_landmarker.task"), num_faces=1))
    a = np.ascontiguousarray(np.array(im.convert("RGB"))); r = _FLD["d"].detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=a))
    if not r.face_landmarks: return im
    P = np.float32([[q.x * a.shape[1], q.y * a.shape[0]] for q in r.face_landmarks[0]])
    OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
    HUB = [1, 168, 33, 263, 61, 291, 13]   # الأنف، بين العينين، زوايا العين، زوايا البق
    edges = [(OVAL[i], HUB[(i // 2) % len(HUB)]) for i in range(0, len(OVAL), 2)] + [(33, 263), (61, 291), (168, 1), (1, 13), (33, 61), (263, 291), (234, 33), (454, 263)]
    lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
    for i, (u, v) in enumerate(edges):
        q = ease(p * 1.6 - i / len(edges) * .6)
        if q <= 0: continue
        A_, B_ = P[u], P[v]; d.line([tuple(A_), tuple(A_ + (B_ - A_) * q)], fill=col + (int(200 * q),), width=2)
    for i, k in enumerate(set(OVAL[::2] + HUB)):
        q = ease(p * 1.4 - .1); x, y = P[k]
        if q > 0: d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=col + (int(230 * q),))
    q = ease(p * 1.2 - .2); top, chin = P[10], P[152]
    if q > 0:
        d.line([(top[0], 0), (top[0], (top + (chin - top) * q)[1])], fill=col + (int(120 * q),), width=1)   # خط المنتصف
        y = chin[1] + 40; x0, x1 = P[234][0], P[454][0]; d.line([(x0, y), (x0 + (x1 - x0) * q, y)], fill=col + (int(200 * q),), width=2)
        for j in range(0, 21): xx = x0 + (x1 - x0) * j / 20; d.line([(xx, y), (xx, y - (12 if j % 5 == 0 else 6))], fill=col + (int(200 * q),), width=1) if xx < x0 + (x1 - x0) * q else None
    q = ease(p * 1.3 - .5)
    if q > 0:   # علامات زوايا البق (أحمر/أزرق) زي الأصل
        for k, c in ((61, (230, 50, 60)), (291, (60, 110, 240))):
            x, y = P[k]; d.rectangle((x + 10, y - 3, x + 10 + 60 * q, y + 3), fill=c + (int(230 * q),))
    return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
def tips_x(img):   # أول عمود فيه سنان (أطراف السنان) في نص الكادر
    a_ = np.array(img)[int(FH * .25):int(FH * .75)].max(2) > 30; cols = np.where(a_.any(0))[0]; return int(cols.min()) if len(cols) else FW // 2
_CAST = {}
_TOOLS = {}
def real_tools():   # أداة عامة: المراية والمسبار الحقيقيين مفصولين من صورة الأدوات الحقيقية، ونقطة الطرف لكل واحدة
    if not _TOOLS:
        e = key_black(L(S + "assets/mirror_probe.png")); a = np.array(e.split()[3]); n, lab, st, _ = cv2.connectedComponentsWithStats((a > 40).astype(np.uint8))
        comps = sorted(range(1, n), key=lambda k: -st[k, cv2.CC_STAT_AREA])[:2]; out = []
        for k in comps:
            m = (lab == k); x0, y0, w, h = st[k, :4]; arr = np.array(e).copy(); arr[..., 3] = np.where(m, arr[..., 3], 0)
            im = Image.fromarray(arr[y0:y0 + h, x0:x0 + w]); ys, xs = np.where(m[y0:y0 + h, x0:x0 + w]); out.append((im, ys.max(), (xs, ys)))
        out.sort(key=lambda o: o[1])   # المراية فوق، المسبار تحت
        (mi, _, (mx_, my_)), (pi, _, (px_, py_)) = out
        mh = (int(mx_[mx_ < mx_.min() + mi.width * .12].mean()), int(my_[mx_ < mx_.min() + mi.width * .12].mean()))   # مركز راس المراية
        k_ = np.argmax(py_ * 1.0 - px_ * .3); pt = (int(px_[k_]), int(py_[k_]))   # طرف المسبار (أوطى نقطة شمال)
        _TOOLS.update(mirror=(mi, mh), probe=(pi, pt))
    return _TOOLS
def _put_tool(im, kind, tip, h, a=1.0, ang=0):
    t, (tx, ty) = real_tools()[kind]; sc = h / t.height; e = t.resize((max(1, int(t.width * sc)), max(1, int(t.height * sc))), Image.LANCZOS)
    if ang:   # لف الأداة حوالين طرفها
        cx_, cy_ = e.width / 2, e.height / 2; e2 = e.rotate(ang, resample=Image.BICUBIC, expand=True); th_ = math.radians(ang); vx, vy = tx * sc - cx_, ty * sc - cy_
        rx, ry = vx * math.cos(th_) + vy * math.sin(th_), -vx * math.sin(th_) + vy * math.cos(th_); e = e2; tx, ty = (rx + e2.width / 2) / sc, (ry + e2.height / 2) / sc
    if a < 1: e.putalpha(e.split()[3].point(lambda v: int(v * a)))
    base = im.convert("RGBA"); x, y = int(tip[0] - tx * sc), int(tip[1] - ty * sc)
    sh_ = Image.new("RGBA", base.size); sh_.paste(Image.new("RGBA", e.size, (0, 0, 0, 255)), (x + 18, y + 24), e.split()[3].point(lambda v: int(v * .35))); base = Image.alpha_composite(base, sh_.filter(ImageFilter.GaussianBlur(10)))
    lay = Image.new("RGBA", base.size); lay.paste(e, (x, y), e); return Image.alpha_composite(base, lay).convert("RGB")
def draw_probe(im, tip, a=1.0, dirv=None, ang=0): return _put_tool(im, "probe", tip, FH * .55, a, ang)   # المسبار الحقيقي وطرفه عند النقطة
def draw_mirror(im, c, r=70, a=1.0, dirv=None, refl=None): return _put_tool(im, "mirror", c, FH * .5, a)   # المراية الحقيقية وراسها عند النقطة
def cast_spin(t, total=2.5, bg=None, scale=.8, cx=None, cy=None, gone=None):
    """أداة عامة: كاست المعمل (فك علوي واحد من غير لثة وعليه العدسات) بيلف فوق وتحت (فيديو ثلاثي الأبعاد حقيقي) وبعدين يثبت.
    نفس العنصر المعتمد في a06 — بيتستخدم في أي قالب فيه كاست."""
    if "fr" not in _CAST:
        cap = cv2.VideoCapture(S + "assets/v/cast_rot2.mp4"); fr = []
        while True:
            ok, f = cap.read()
            if not ok or len(fr) > 1.6 * 24: break
            a = cv2.cvtColor(f, cv2.COLOR_BGR2RGB).astype(np.float32); r_, g_, b_ = a[..., 0], a[..., 1], a[..., 2]; d = g_ - np.maximum(r_, b_)
            al = cv2.GaussianBlur(cv2.erode(np.clip(1 - (d - 10) / 40, 0, 1), np.ones((3, 3), np.uint8)), (0, 0), 1.0); a[..., 1] = np.minimum(g_, (r_ + b_) / 2 + 4)
            fr.append(Image.fromarray(np.rot90(np.dstack([a, al * 255]).clip(0, 255).astype(np.uint8), -1).copy(), "RGBA"))
        st = Image.open(S + "assets/cast1_v_rgba.png").convert("RGBA"); _CAST.update(fr=fr, st=st)
    fr, st = _CAST["fr"], _CAST["st"]; im = bg.copy() if bg is not None else black()
    tv = total * .7
    if t >= tv and gone:   # مكان كل عدسة طارت بيفضى على الكاست (نفس الكاست من غير العدسة دي)
        cd = _cast_data(); rem = np.zeros(cd["cl"].shape, np.float32)
        for j, g in gone.items():
            if g > 0: rem = np.maximum(rem, cd["cmk"][j] * g)
        r = rem[..., None]; st = Image.fromarray((cd["cv"].astype(np.float32) * (1 - r) + cd["cs"].astype(np.float32) * r).astype(np.uint8), "RGBA")
    e = fr[min(len(fr) - 1, int(t / tv * (len(fr) - 1)))] if t < tv else st
    bb = e.getbbox() or (0, 0, e.width, e.height); e = e.crop(bb); sc = FH * scale / e.height
    return paste(im, e, FW / 2 if cx is None else cx, FH / 2 if cy is None else cy, sc * (1 + .04 * t / total))
def _cast_data():   # الكاست بالعدسات + نفس الكاست من غير عدسات + قناع كل عدسة (مرتبين على طول الفك)
    if "cl" not in _CAST:
        CL = cv2.imread(S + "assets/cast1_lab.png", 0); NV = int(CL.max())
        _CAST.update(cv=np.array(Image.open(S + "assets/cast1_v_rgba.png").convert("RGBA")), cs=np.array(Image.open(S + "assets/cast1_s_rgba.png").convert("RGBA")), cl=CL, nv=NV,
                     cc=[np.argwhere(CL == j + 1).mean(0)[::-1] for j in range(NV)],
                     cmk=[cv2.GaussianBlur(cv2.dilate((CL == j + 1).astype(np.uint8) * 255, np.ones((15, 15), np.uint8)), (0, 0), 3).astype(np.float32) / 255 for j in range(NV)])
    return _CAST
def cast_spot(j, t, total, scale, cx, cy):   # مكان العدسة رقم j على الكاست الثابت على الشاشة
    cd = _cast_data(); st = Image.open(S + "assets/cast1_v_rgba.png") if "stbb" not in _CAST else None
    if st is not None: _CAST["stbb"] = st.convert("RGBA").getbbox()
    x0, y0, x1, y1 = _CAST["stbb"]; s_ = FH * scale / (y1 - y0) * (1 + .04 * t / total); c = cd["cc"][j]
    return cx + (c[0] - (x0 + x1) / 2) * s_, cy + (c[1] - (y0 + y1) / 2) * s_
def cast_link(rank, n):   # العدسة رقم rank (من يمين الصورة لشمالها على الوش) ← أقرب عدسة على الكاست بنفس الترتيب
    nv = _cast_data()["nv"]; return int(round(rank * (nv - 1) / max(1, n - 1)))
def cast_gone(t_seat, step=.09):   # كل عدسة على الكاست: فضيت قد إيه (من توقيت طيران seat_on_face)
    g = {}; rk = _SF.get("rank", [])
    for i, r in enumerate(rk):
        if r < 0: continue
        j = cast_link(r, _SF["nfly"]); g[j] = max(g.get(j, 0), ease(np.clip((t_seat - i * step) / .08, 0, 1)))
    return g
def face_pair(L_img, R_img, gap=60, dl=0, dr=0):
    """أداة عامة: فكين متقابلين — الشمال معكوس (الأطراف لليمين) واليمين زي ما هو (الأطراف للشمال)، فاصل أسود في النص، من غير قص للأطراف."""
    l = black(); f = L_img.transpose(Image.Transpose.FLIP_LEFT_RIGHT); l.paste(f, (FW // 2 - gap // 2 - (FW - tips_x(L_img)) + dl, 0))   # qa-ok: face_pair: الفك الشمال معكوس عشان يبصوا لبعض — مفيهوش نص
    r = black(); r.paste(R_img, (FW // 2 + gap // 2 - tips_x(R_img) + dr, 0))
    m = Image.new("L", (FW, FH)); ImageDraw.Draw(m).rectangle((FW // 2 + dr, 0, FW, FH), fill=255)
    if dl == 0 and dr == 0: _face_pair_guard(l, r, FW // 2)   # الحالة النهائية بس (وقت الدخول من الجنب مقصود يبقى برا الشاشة)
    return Image.composite(r, l, m)
def _face_pair_guard(l, r, split, min_gap=24):
    """Q12 (E23 E141 E142): الفكين المتقابلين — مفيش فك مقصوص عند خط النص، وبينهم فاصل واضح. (ضهر الفك بيكمّل لبرا الشاشة عادي زي الأصل.)
    محتوى = سنان/لثة (سطوع > 45)، مش خلفية غامقة."""
    gl = np.array(l.convert("L").resize((FW // 4, FH // 4))) > 45; gr = np.array(r.convert("L").resize((FW // 4, FH // 4))) > 45; sp = split // 4
    if gl[:, sp:sp + 3].sum() > 15: qa_warn("E141", "الفك الشمال واصل لخط النص (هيتقص)")
    if gr[:, sp - 3:sp].sum() > 15: qa_warn("E141", "الفك اليمين واصل لخط النص (هيتقص)")
    gaps = []
    for y in range(gl.shape[0]):
        a_ = np.where(gl[y, :sp])[0]; b_ = np.where(gr[y, sp:])[0]
        if len(a_) and len(b_): gaps.append((sp + b_.min() - a_.max()) * 4)
    if gaps and min(gaps) < min_gap: qa_warn("E142", f"الفاصل بين الفكين {min(gaps)} بكسل بس")
IMPLANT_SITES = [12, 22]   # إعداد القالب: أرقام السنان (FDI) اللي هيتحط فيها زرعات — العميل يحدد العدد والأماكن
_IMPS = {}
def implant_into(im, t, sites=None, t0=1.5, step=1.2, t_fade=None):
    """أداة عامة: كل زرعة (فيكستشر + دعامة) بتطير لمكان سنة معيّنة وبتتلف زي المسمار وهي داخلة على محور السنة ناحية العظم.
    المكان والمحور بيتحسبوا من حدود السنة الحقيقية في صورة البعد + مصفوفة الكاميرا الحالية."""
    sites = sites or IMPLANT_SITES; M = CAMM.get("M")
    if M is None: return im
    if not _IMPS:
        e = key_black(L(S + "assets/implant.png")); _IMPS["e"] = e.crop(e.split()[3].getbbox())
        _IMPS["c"] = {int(k): np.float32(v) for k, v in json.load(open(TO + "ap_teeth_full.json")).items()}
    E = _IMPS["e"]; base = im.convert("RGBA")
    for i, k in enumerate(sites):
        if k not in _IMPS["c"]: continue
        q = (t - t0 - i * step) / 1.4
        if q <= 0 or (t_fade is None and q >= 1.25): continue
        c = _IMPS["c"][k]
        fade = (1 - ease(np.clip((q - 1.0) / .25, 0, 1))) if t_fade is None else (1 - ease(np.clip((t - t_fade) / .8, 0, 1)))
        if fade <= 0: continue
        hq = ease(np.clip(q / .35, 0, 1)) * fade   # مكان السنة بيفضى: بلير لنفس المكان (من غير لون بني) — ملاحظتك
        if hq > 0:
            pg = (M[:, :2] @ c.T).T + M[:, 2]; hm = Image.new("L", base.size); ImageDraw.Draw(hm).polygon([tuple(p) for p in pg], fill=255); hm = hm.filter(ImageFilter.MaxFilter(9))
            hsv = cv2.cvtColor(np.array(base.convert("RGB")), cv2.COLOR_RGB2HSV); tooth = ((hsv[..., 2] > 105) & (hsv[..., 1] < 120)).astype(np.uint8) * 255   # بكسلات السنة الحقيقية بس (مش الشفة)
            hm = Image.fromarray((np.minimum(np.array(hm), cv2.dilate(cv2.morphologyEx(tooth, cv2.MORPH_CLOSE, np.ones((21, 21), np.uint8)), np.ones((5, 5), np.uint8))) * hq).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))
            base = Image.composite(base.filter(ImageFilter.GaussianBlur(14)), base, hm)
        h = np.ptp(c[:, 1]); cen = c.mean(0); Pc = M[:, :2] @ (cen + np.float32([0, -.5 * h])) + M[:, 2]   # خط اللثة (عنق السنة العلوية)
        ax = M[:, :2] @ np.float32([0, -1]); ax = ax / np.linalg.norm(ax); hs = h * np.hypot(M[0, 0], M[0, 1])   # ax = ناحية الجذر (جوه الفك)
        sc = hs * 1.25 / E.height; h_ = max(2, int(E.height * sc))
        fly = ease(min(q / .45, 1)); screw = ease(np.clip((q - .45) / .5, 0, 1))
        Pf = Pc + ax * h_ * .22   # آخر مكان: الفيكستشر جوه اللثة/العظم والدعامة بس طالعة ناحية التاج
        pos = Pf - ax * (h_ * .62 * (1 - screw) + 650 * (1 - fly))   # جاية من ناحية طرف السنة (برا البق) وبتلف وهي داخلة لجوه الفك
        w_ = max(2, int(E.width * sc * (.55 + .45 * abs(math.cos(screw * 6 * math.pi)))))
        sp = E.resize((w_, h_), Image.LANCZOS)
        ang = math.degrees(math.atan2(ax[0], -ax[1]))   # السن المسنن ناحية الجذر
        sp = sp.rotate(-ang + 180, resample=Image.BICUBIC, expand=True)
        lay = Image.new("RGBA", base.size); lay.paste(sp, (int(pos[0] - sp.width / 2), int(pos[1] - sp.height / 2)), sp)
        yy, xx = np.mgrid[0:base.size[1], 0:base.size[0]].astype(np.float32); depth = (xx - Pc[0]) * ax[0] + (yy - Pc[1]) * ax[1]
        vis = np.clip(1 - depth / 14.0, 0, 1) * fade   # اللي عدّى خط اللثة بيختفي جوه الفك
        lay.putalpha(Image.fromarray((np.asarray(lay.split()[3]) * vis).astype(np.uint8))); base.alpha_composite(lay)
    return base.convert("RGB")
def living(names, fallback):
    c = asset_clip(*names)
    if c: return lambda t: cover(c.at(t), 1.0)
    return lambda t: cover(fallback, 1.04 + .02 * t, .5 + 6 * math.sin(t * 1.7) / FW, .5 + 5 * math.cos(t * 1.3) / FH)   # الصورة الحقيقية بحركة كاميرا يدوية خفيفة
# ======================= أ٢٤ الحالة المركبة (28.6ث) =======================
@T("a24", "v25")
def a24():
    fa = faces_aligned(); lm = fa["lm"]; W0, H0 = fa["A"].size; cx0, cy0 = W0 / 2, H0 * .48; mx, my = lm[13]; tri = delaunay(lm[::7]); P7 = lm[::7]
    IMP = key_black(L(S + "assets/implant.png")) if _os.path.exists(S + "assets/implant.png") else EL("veneer")   # قالب الزراعة (مشترك مع التركيبات والابتسامات)
    sb = living(("angle_before_lock", "smile_before_lock"), BF); sa = living(("smile_after3_lock", "smile_after_lock"), AP)
    def s1(t):   # الوش (بزاوية خفيفة وبيتحرك) وعليه شبكة خطوط بيضا رفيعة بتترسم على ملامحه زي الأصل + مسطرة تحت الدقن
        im = sb(t); p = ease((t - 1.2) / 2.0) * (1 - ease((t - 6.0) / .8)); im = face_lines(im, p) if p > 0 else im
        return txt(im, (FW / 2, FH * .86), "خطة واحدة متكاملة لابتسامة جديدة", 50, alpha=ease((t - 3.5) / .6))
    LIP = lambda p: cam(face_mix(p), mx, my, 3.3, 70)
    Pq = None
    def s3(t):   # الأسنان القديمة بتتفتت، الزرعات والدعامات بتدخل، وبعدين الفينير
        nonlocal Pq
        if t < 1.5:
            im = LIP(0); Pq = Pq or Particles(np.array(im), (FW * .3, FH * .3, FW * .7, FH * .7), 1600, 350, grav=500); return Pq.draw(ImageEnhance.Brightness(im).enhance(1 - .25 * t), t, 1.6)
        im = LIP(ease((t - 5.4) / 1.6)); return implant_into(im, t, IMPLANT_SITES, t0=1.5, step=1.1, t_fade=5.6)   # الزرعات بتفضل مكانها لحد ما التركيبة تظهر فوقها   # الزرعات لأماكن محددة (قابلة للتعديل)
    # لوحة تصميم الابتسامة فوق السنان زي الأصل (ملاحظة a24 18.9): سهم عرض ما بين الأنياب + جدول نسب كل سنة + خطوط إرشاد + توقيع رأسي
    _f = np.array(cam(ap_outlines(face_mix(1), 1.0), mx, my, 3.3, 70).convert("HSV")); _tm = (_f[..., 2] > 170) & (_f[..., 1] < 60)
    _tm = cv2.morphologyEx(_tm.astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8)) > 0; _ys = np.where(_tm.any(1))[0]
    TY0, TY1 = int(np.percentile(_ys, 2)), int(np.percentile(_ys, 98)); TLX = {y: int(np.where(_tm[y])[0].min()) for y in range(TY0, TY1 + 1) if _tm[y].any()}
    PCT = [10, 15, 25, 25, 15, 10]
    def vtext(s_, size, col=(255, 255, 255, 255)):
        f_ = F(FA, size); b = ImageDraw.Draw(Image.new("RGBA", (1, 1))).textbbox((0, 0), s_, font=f_, direction="rtl"); im_ = Image.new("RGBA", (b[2] - b[0] + 20, b[3] - b[1] + 20))
        ImageDraw.Draw(im_).text((10 - b[0], 10 - b[1]), s_, font=f_, fill=col, direction="rtl", stroke_width=2, stroke_fill=(0, 0, 0, 160)); return im_.rotate(90, expand=True)
    LBL = vtext("عرض ما بين الأنياب 100%", 34); SIG = vtext(DOC, 30); PCTS = [vtext(f"{p_}%", 30) for p_ in PCT]
    def chart(im, t):
        lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); W_ = (255, 255, 255)
        q = ease((t - 1.0) / .6)   # السهم
        if q > 0:
            ya, yb = TY0, TY0 + (TY1 - TY0) * q; d.line([(70, ya), (70, yb)], fill=W_ + (235,), width=3)
            for yy, sg in ((ya, 1), (yb, -1)): d.polygon([(70, yy), (60, yy + 18 * sg), (80, yy + 18 * sg)], fill=W_ + (235,))
            l_ = LBL.copy(); l_.putalpha(l_.getchannel("A").point(lambda v: int(v * q))); lay.alpha_composite(l_, (14, int((TY0 + TY1) / 2 - l_.height / 2)))
        y = TY0
        for k, p_ in enumerate(PCT):   # كل سنة بصندوق طوله على قد نسبتها، وخط إرشاد لحد السنة نفسها
            h = (TY1 - TY0) * p_ / 100; qk = ease((t - 1.4 - k * .18) / .35)
            if qk > 0:
                a_ = int(220 * qk); d.rectangle((105, y + 4, 235, y + h - 4), outline=W_ + (a_,), width=2)
                pc = PCTS[k].copy(); pc.putalpha(pc.getchannel("A").point(lambda v: int(v * qk))); lay.alpha_composite(pc, (int(170 - pc.width / 2), int(y + h / 2 - pc.height / 2)))
                for yy in (y, y + h):
                    xe = TLX.get(int(min(TY1, max(TY0, yy))), 300)
                    for xx in range(240, max(242, xe - 6), 16): d.line([(xx, yy), (min(xx + 8, xe - 6), yy)], fill=W_ + (int(170 * qk),), width=2)
            y += h
        qs = ease((t - 2.4) / .8)   # التوقيع رأسي على الطرف
        if qs > 0: sg_ = SIG.copy(); sg_.putalpha(sg_.getchannel("A").point(lambda v: int(v * qs * .85))); lay.alpha_composite(sg_, (FW - sg_.width - 18, int(FH / 2 - sg_.height / 2)))
        return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
    def s4(t):
        im = cam(ap_outlines(face_mix(1), t / 1.5), mx, my, 3.3, 70); return chart(im, t)
    def s7(t):   # شعارين للطبيبين
        im = Image.new("RGB", (FW, FH), (250, 250, 250)); d = ImageDraw.Draw(im); p = ease(t / .5)
        for k, (n, r_) in enumerate(((DOC, "أخصائي التركيبات والزراعة"), ("اسم الطبيب الثاني", "طب الأسنان التجميلي"))):
            y = FH * (.33 + .32 * k); col = (150, 40, 120) if k == 0 else (110, 60, 160); d.ellipse((FW / 2 - 90, y - 230, FW / 2 + 90, y - 50), outline=col, width=6); tooth_icon(d, FW / 2, y - 140, 55, col, 5)
            d.text((FW / 2, y + 10), n, font=F(FA, 56), fill=col, anchor="mm", direction="rtl"); d.text((FW / 2, y + 80), r_, font=F(FA5, 36), fill=(90, 90, 90), anchor="mm", direction="rtl")
        return im
    s4 = push(s4, 4.5)   # كان لقطة متجمدة (فلتر الفيديو)
    S4E = s4(4.5); SA0 = sa(0)
    def back(t):   # ملاحظة a24 19.8: نفس الكادر ← الكاميرا بترجع من البق للوش كله (تبعد وتعدل اللفة) بدل قطعتين ورا بعض
        p = ease(t / .5); z = math.exp(math.log(3.3 * 1.05) * (1 - p) + math.log(1.05) * p)
        im = cam(face_mix(1), mx + (cx0 - mx) * p, my + (cy0 - my) * p, z, 70 * (1 - p))
        if t < .2: im = Image.blend(S4E, im, ease(t / .2))   # الشارت بيختفي بنعومة
        if t > .36: im = Image.blend(im, SA0.resize(im.size), ease((t - .36) / .14))
        return im
    return [(7.0, s1), (.5, lambda t: cam(face_mix(0), cx0 + (mx - cx0) * t * 2, cy0 + (my - cy0) * t * 2, 1.05 + 4 * t, 140 * t)), (7.5, s3), (4.5, s4), (.5, back), (3.0, sa), (4.0, lambda t: cam(face_mix(1), mx, my, 3.3 + .1 * t, 70)), (1.6, s7)]
# ======================= أ٢٥ عصي التركيب (24.8ث) =======================
@T("a25", "v26")
def a25():
    fa = faces_aligned(); lm = fa["lm"]; mx, my = lm[13]; ST = EL("stick"); sh = shot("A"); z = 1.12
    sb = living(("smile_before_lock",), BF); sa = living(("smile_after3_lock", "smile_after_lock"), AP); mb = mouth_box(); bmx, bmy = (mb[0] + mb[2]) / 2, (mb[1] + mb[3]) / 2
    def s2(t): im = cover(BF, 1.0); return paste(im, ST, bmx + 250 - 150 * ease(t / 1.2), bmy + 500 - 380 * ease(t / 1.2), .5, -15)
    def s3(t): return blend(cover(BF, 1.0), rf_cam(retract_face(0)), t / .5)
    c21 = [q for q in sh.six if q["fdi"] == 21][0]; BASE6 = anim.render(sh, 3.0, z, dict(lines=0, stagger=.1, draw=.4, mid=.6, pct=1.0, arc=99, gold=99, title=99, label=""))
    def probe(im, tip, a=1.0):   # مسبار حقيقي الشكل: مقبض معدني + رقبة رفيعة + خطاف عند السن
        d = ImageDraw.Draw(im, "RGBA"); x, y = tip; hx, hy = x - 230, y + 420; ex, ey = x - 700, y + 1300
        d.line([(ex, ey), (hx, hy)], fill=(120, 122, 128, int(255 * a)), width=34); d.line([(ex, ey), (hx, hy)], fill=(205, 207, 212, int(255 * a)), width=22)
        for kk in range(0, 9): yy = hy + (ey - hy) * (kk + .5) / 9; xx = hx + (ex - hx) * (kk + .5) / 9; d.line([(xx - 14, yy + 6), (xx + 14, yy - 6)], fill=(140, 142, 148, int(220 * a)), width=3)
        d.line([(hx, hy), (x - 10, y + 40)], fill=(185, 187, 192, int(255 * a)), width=8); d.arc((x - 30, y - 10, x + 20, y + 50), 180, 330, fill=(190, 192, 198, int(255 * a)), width=7); return im
    def s6(t):   # زي الأصل بالظبط: المسبار بيمسك العدسة من ناحية اللثة ويشدها بالجنب لبره فتبان السنة المحضّرة تحتها، وبعدين يرجعها
        im = BASE6.copy(); pts = np.array([sh.tf(x_, y_, z) for x_, y_ in c21["c"]], np.float32); xg = pts[:, 0].max(); xi = pts[:, 0].min(); yc = pts[:, 1].mean(); tw = xg - xi
        pull = ease(np.clip((t - 1.6) / 1.2, 0, 1)) * (1 - ease(np.clip((t - 3.4) / .8, 0, 1))); dx = -tw * .42 * pull; rot = 6 * pull
        if pull > .01:
            m = Image.new("L", im.size); ImageDraw.Draw(m).polygon([tuple(p) for p in pts], fill=255); x0, y0, x1, y1 = m.getbbox()
            piece = im.crop((x0, y0, x1, y1)); pm = m.crop((x0, y0, x1, y1))
            prep = ImageEnhance.Brightness(Image.blend(piece, Image.new("RGB", piece.size, (222, 200, 165)), .45)).enhance(.92); im.paste(prep, (x0, y0), pm)   # السنة المحضّرة
            pr = piece.convert("RGBA"); pr.putalpha(pm); pr = pr.rotate(rot, resample=Image.BICUBIC, expand=True); ox, oy = int(x0 + dx - (pr.width - piece.width) / 2), int(y0 - (pr.height - piece.height) / 2)
            shd = Image.new("RGBA", im.size); sm = Image.new("L", im.size); sm.paste(pr.split()[3], (ox + 12, oy + 14)); shd.putalpha(sm.filter(ImageFilter.GaussianBlur(9)).point(lambda v: int(v * .45)))
            im = Image.alpha_composite(im.convert("RGBA"), shd); im.alpha_composite(pr, (max(0, ox), max(0, oy))); im = im.convert("RGB")
        tip = (xg + dx - tw * .08, yc + 20); a = ease(np.clip((t - .6) / .6, 0, 1)) * (1 - ease(np.clip((t - 4.3) / .6, 0, 1)))
        off = 800 * (1 - ease(np.clip((t - .6) / 1.0, 0, 1))) + 800 * ease(np.clip((t - 4.3) / .7, 0, 1))
        return draw_probe(im, (tip[0] + off * .4, tip[1] + off), a, ang=-95) if a > 0 else im   # إيد المسبار جاية من تحت ناحية اليمين زي الأصل
    def s6b(t):   # لمعة ضوء بتجري على حدود السنان على الفك المعزول
        im = A(z); return outlines(im, sh, z, min(1.0, t / .6), col=(255, 255, 255), width=3, which="upper", glow=True, stagger=.04)
    def s8(t):   # الشفايف: ومضات قبل/بعد سريعة والكاميرا بتلف من الجنب لقدام وبتقرب (زي الأصل)
        p = 0.0 if (.5 < t < .75 or 1.9 < t < 2.1) else 1.0; ang = 70 - 70 * ease(np.clip((t - 2.2) / 1.5, 0, 1)); return cam(face_mix(p), mx, my, 3.3 + .25 * ease(t / 3.7), ang)
    def gold3d(v):
        im = logo(v); return ImageEnhance.Contrast(im).enhance(1.3)
    s6 = push(s6, 5.0)   # كان لقطة متجمدة (فلتر الفيديو)
    return [(1.5, sb), (1.5, s2), (.5, s3), (2.5, lambda t: sticks_seat(t, .15, .4)), (1.5, lambda t: sa(t)), (1.5, lambda t: cam(face_mix(1), mx, my, 3.0 + .2 * t, 70)), (5.0, s6), (.8, s6b),
            (3.7, s8), (4.0, lambda t: cam(face_mix(1), mx, my, 3.55 + .15 * t, 0)), (2.3, gold3d)]
# ======================= أ٢٦ القياس بالأدوات الحقيقية (26.3ث) =======================
@T("a26", "v28")
def a26():
    fa = faces_aligned(); lm = fa["lm"]; mx, my = lm[13]; sh = shot("A"); z = 1.12; CAL = key_black(L(S + "assets/caliper_thick_4.png").rotate(-150, expand=True)); CAL = CAL.crop(CAL.getbbox())   # الكاليبر ماسك العدسة من سمكها (طرف قدام وطرف ورا) زي الواقع   # كاليبر إيفانسون حقيقي ماسك عدسة علوية أمامية (مش كراون خلفي)
    la = living(("laugh3_lock", "laugh2_lock", "laugh_lock"), AP); sa = living(("smile_after3_lock", "smile_after_lock"), AP)
    def s2(t):   # فرجار الأسنان بيقيس ابتسامتها
        im = cam(face_mix(0), W0c(), H0c(), 1.05, 0); sc = FH * .8 / CAL.height; return paste(im, CAL, FW * .58 + 250 * (1 - ease(t / 1.0)), FH * .72 - 120 * ease(t / 2.5), sc, -6 + 8 * ease(t / 2.5))   # طرف الأداة المقصوص تحت برا الكادر
    def W0c(): return fa["A"].width / 2
    def H0c(): return fa["A"].height * .48
    def s3(t):   # مسطرة نازلة
        im = cam(face_mix(0), W0c(), H0c(), 1.05, 0); d = ImageDraw.Draw(im, "RGBA"); y = -600 + 1500 * ease(t / .8); x = FW * .3
        d.rectangle((x, y, x + FW * .4, y + 90), fill=(230, 230, 235, 235), outline=(60, 60, 60, 255), width=3)
        for k in range(0, int(FW * .4), 14): d.line([(x + k, y), (x + k, y + (40 if k % 70 == 0 else 20))], fill=(30, 30, 30, 255), width=2)
        return im
    def s4(t):   # المبعد، الفرجار ماسك الفينير، والعصي بتركّب
        im = sticks_seat(max(0, t - 1.2), .15, .4)
        if t < 1.6: x, y = rf_screen_pts(11); sc = FH * .42 / CAL.height; im = paste(im, CAL, x, y + CAL.height * sc * .42 + 260 * (1 - ease(t / 1.0)), sc, 0)   # العدسة اللي في طرف الكاليبر قدام الثنية بالظبط
        return im
    def s6(t):   # هيمنة الثنايا + مناطق الانعكاس بالألوان
        cc = lambda q: (255, 210, 90) if q["fdi"] % 10 == 1 else (120, 200, 255); im = outlines(A(z), sh, z, t / 1.0, col=cc, width=5, glow=True)
        return txt(im, (FW / 2, 120), "هيمنة الثنايا الأمامية", 50, alpha=ease((t - .8) / .4), fill=(255, 210, 90))
    def s7(t):   # الأسنان بالأبيض والأسود + الفراغات عند اللثة
        im = bw(A(z)); im = outlines(im, sh, z, t / 1.2, width=2); d = ImageDraw.Draw(im, "RGBA")
        for k in range(1, 6): y = FH * k / 6; d.line([(80, y), (80 + (FW - 160) * ease(t / 1.5), y)], fill=(255, 255, 255, 90), width=1)
        return txt(im, (FW / 2, 120), "درجة الإضاءة", 50, alpha=ease(t / .4))
    s6 = push(s6, 4.0)   # كان لقطة متجمدة (فلتر الفيديو)
    s7 = push(s7, 4.0)   # كان لقطة متجمدة (فلتر الفيديو)
    return [(1.5, la), (2.5, s2), (1.0, s3), (4.5, s4), (1.0, lambda t: cam(face_mix(1), mx, my, 3.0, 50)), (2.5, lambda t: A(z + .02 * t)), (4.0, s6), (4.0, s7), (1.5, lambda t: cam(face_mix(1), mx, my, 3.2, 70)), (3.8, sa)]

# ======================= أ٣٣ رحلة العيادة بالأدوات الحقيقية (29.1ث) =======================
@T("a33", "v43", "beat")
def a33():
    fa = faces_aligned(); lm = fa["lm"]; W0, H0 = fa["A"].size; cx0, cy0 = W0 / 2, H0 * .48; mx, my = lm[13]; sh = shot("A"); z = 1.12
    sel = asset_clip("selfie3_lock", "selfie3", "selfie2_lock"); SG = key_black(L(S + "assets/shade_guide.png")); TAB = key_black(L(S + "assets/shade_tab.png"))
    glove = asset_clip("glove"); GC = Image.open(S + "assets/glove_cast_rgba.png").convert("RGBA")
    SELR = L((TO if CASE_DIR else S + "assets/") + "selfie_real.png")   # صورة السيلفي وفيها بق القبل الحقيقي (موديل الفيديو بيبيّض القبل، فمفيش فيديو متولد هنا)
    SELV = asset_clip("before_selfie")   # فيديو سيلفي: الجوال ضهره للكاميرا زي الأصل — صورة البداية والنهاية فيها بق القبل الحقيقي، واتراجعت السنان في النص (مااتبيّضتش)
    def s1(t): return cover(SELV.at(.3 + t), 1.0) if SELV else cover(SELR, 1.04 + .03 * t / 2.5, .5 + 7 * math.sin(t * 1.9) / FW, .5 + 6 * math.cos(t * 1.4) / FH)
    def s2(t):   # دليل الألوان الحقيقي قدام ابتسامتها، وبيتسحب منه اللون المختار
        im = cam(face_mix(0), mx, my, 2.6, 0); g = SG.rotate(90, expand=True); im = paste(im, g, FW / 2, FH * .5 + 340 + 200 * (1 - ease(t / .6)), FW * 1.1 / g.width)
        if t > 2.0: im = paste(im, TAB.rotate(90, expand=True), FW * .42, FH * .5 + 160 - 300 * ease((t - 2.0) / .8), .35)
        return im
    GF = L(S + "assets/glove_cast_front_0.png")
    GV = asset_clip("glove_cast_move_0")   # الإيد بالجوانتي بتحرك الكاست (فيديو من الصورة المعتمدة) زي الأصل
    def s3a(t): return cover(GV.at(t), 1.0) if GV else cam(GF, GF.width / 2, GF.height / 2, 1.0 + .08 * ease(t / 2.0), -4 + 8 * ease(t / 2.0))   # إيد بجوانتي إسود ماسكة كاست العدسات (العدسات ناحية الكاميرا)
    SAL = asset_clip("smile_after_lock")   # فيديو حي من صورة البعد المعتمدة (مش لزق)
    def s3(t):   # زي الأصل: وش المريض بيتحرك، الكاست يمين بيلف 3D، والعدسات الحقيقية بتطير من على الكاست وتقعد على سنانه
        s_ = max(FW / W0, FH / H0) * (1.1 + .02 * t); ccx, ccy = FW * .9, FH * .55; TOT, T0 = 1.6, 1.15   # الكاست بيلف الأول، وبعد ما يثبت العدسات تبدأ تطير
        ts = max(0.0, t - T0); tc = min(t, TOT)
        def src(r, n):   # كل عدسة بتطير من مكانها هي على الكاست
            sx, sy = cast_spot(cast_link(r, n), tc, TOT, .42, ccx, ccy); return cx0 + (sx - FW / 2) / s_, cy0 + (sy - FH / 2) / s_
        face = seat_on_face(ts, src=src)
        im = cam(face, cx0 + 10 * math.sin(t * 1.6), cy0 + 6 * math.cos(t * 1.2), 1.1 + .02 * t, 1.5 * math.sin(t * .9))   # حركة وش طبيعية خفيفة
        out = ease((t - 2.45) / .55); return cast_spin(tc, TOT, im, .42, ccx + FW * .6 * out, ccy, gone=cast_gone(ts) if t > T0 else None)   # مكان كل عدسة طارت بيفضى
    def s4(t):   # البعد: فيديو حي بيبتسم، وبعدين زووم ودوران للشفايف (+90) زي الأصل
        if t < 3.0: return cover(SAL.at(t), 1.0) if SAL else cam(face_mix(1), cx0, cy0, 1.05 + .02 * t, 0)
        p = ease((t - 3.0) / 1.0); im = cam(face_mix(1), cx0 + (mx - cx0) * p, cy0 + (my - cy0) * p, 1.05 + 2.6 * p, 90 * p)
        return blend(cover(SAL.at(3.0), 1.0), im, ease((t - 3.0) / .3)) if SAL and t < 3.3 else im
    def s5(t):   # ماكرو بشبكة تحليل دهبي
        im = midline(A(z), sh, z, t / .6, col=(214, 178, 106)); im = arc_line(im, sh, z, (t - .4) / 1.0); im = outlines(im, sh, z, (t - .6) / 1.2, col=(214, 178, 106), width=2)
        my_ = sh.tf(sh.mid, 0, z)[1]; w = 230
        if t > 1.5: im = spiral_on(spiral_on(im, 40, my_, w, w * 1.618, ease((t - 1.5) / 1.5)), 40, my_ - w * 1.618, w, w * 1.618, ease((t - 1.5) / 1.5), True)
        return txt(im, (FW / 2, 120), "0.618  /  1.618", 56, font=FSER, rtl=False, fill=(214, 178, 106), alpha=ease((t - 2.5) / .5))
    FIST = asset_clip("laugh3_lock"); TWIN = L((TO if CASE_DIR else S + "assets/") + "twin_mouths.png")   # البعد بإيده تحت دقنه، وبعدين نفس المريض بعد جنب نفسه قبل (الصورة بالبق الحقيقي لكل نسخة — فيديو الموديل كان بيغيّر الوشوش ويبيّض القبل)
    TWV = asset_clip("twin_walkin")
    def s6(t):   # زي الأصل: فيديو البعد، وبعدين نسخة القبل بتدخل من الجنب وتقف جنبه
        a = cover(FIST.at(t), 1.0) if FIST else cam(face_mix(1), cx0, cy0, 1.05 + .02 * t, 0)
        if t < 2.6 or not TWIN: return a
        u = (t - 2.6) / 2.9; e = ease(min(1, u / .5))
        if TWV:   # زي الأصل: فيديو — نسخة القبل بتدخل من الجنب وتقف جنب نسخة البعد (آخر كادر = صورة التوأم بالبق الحقيقي لكل نسخة)
            b = cover(TWV.at(min(3.95, .9 + u * 3.05)), 1.3 - .25 * e, .38 + .12 * e, .4 + .08 * e)
        else: b = cover(TWIN, 1.55 - .5 * ease(u), .32 + .18 * ease(u), .36 + .1 * ease(u))
        return blend(a, b, ease((t - 2.6) / .4))
    s5 = push(s5, 6.0)   # كان لقطة متجمدة (فلتر الفيديو)
    s6 = push(s6, 5.5)   # كان لقطة متجمدة (فلتر الفيديو)
    return [(2.5, s1), (3.5, s2), (2.0, s3a), (3.0, s3), (4.0, s4), (6.0, s5), (5.5, s6), (2.6, logo)]
# ======================= أ٣٤ بطاقة القياس والنموذج وعصي التجربة (29.2ث) =======================
@T("a34", "v44", "beat")
def a34():
    fa = faces_aligned(); lm = fa["lm"]; W0, H0 = fa["A"].size; cx0, cy0 = W0 / 2, H0 * .48; mx, my = lm[13]; sh = shot("A"); z = 1.12
    RC = key_black(L(S + "assets/round_card.png")); GC = Image.open(S + "assets/glove_cast_rgba.png").convert("RGBA"); ST = EL("stick"); pcs, _ = veneer_pieces()
    _a = np.array(ST).copy(); _hsv = cv2.cvtColor(_a[..., :3], cv2.COLOR_RGB2HSV); _a[..., 3] = np.where((_hsv[..., 1] < 70) & (_hsv[..., 2] > 90), 0, _a[..., 3]); STK = Image.fromarray(_a)   # العصاية من غير الفينيرة اللي عليها
    _ys, _xs = np.where((_a[..., 3] > 60) & (_hsv[..., 0] > 80)); _k = np.argmin(_ys); TIP = (_xs[_k] / _a.shape[1] - .5, _ys[_k] / _a.shape[0] - .5)   # طرف العصاية
    def scr(px, py, zz=1.05, cx=None, cy=None):
        cx = cx0 if cx is None else cx; cy = cy0 if cy is None else cy; s_ = max(FW / W0, FH / H0) * zz; return FW / 2 + s_ * (px - cx), FH / 2 + s_ * (py - cy)
    def s1(t):   # بطاقة قياس دايرية بتعدّي قدام الوش وترسم أقواس دهبي
        im = cam(face_mix(0), cx0, cy0, 1.05, 0); x = FW * 1.3 - FW * 1.6 * ease(t / 2.4); im = paste(im, RC, x, FH * .5, FW * .7 / RC.width, t * 40)
        d = ImageDraw.Draw(im, "RGBA"); ncx, ncy = scr(*lm[1])
        for k in range(4):
            q = ease((t - .6 - k * .3) / .6)
            if q > 0: r = 220 + k * 140; d.arc((ncx - r, ncy - r, ncx + r, ncy + r), 200, 200 + 140 * q, fill=(214, 178, 106, 230), width=3)
        return im
    def s2(t):   # زي الأصل وزي ما اتفقنا: الكاست (فك واحد من غير لثة وعليه العدسات) بيلف فوق وتحت جنب وشه
        bg = cam(face_mix(0), cx0, cy0, 1.05, 0); x = FW * 1.25 - FW * .5 * ease(t / .6); return cast_spin(t, 1.8, bg=bg, scale=.58, cx=x, cy=FH * .55)
    def s3(t):   # فينيرات حقيقية على عصي التجربة بتطفو قدام البق وتتجمع
        im = ImageEnhance.Brightness(cam(face_mix(0), mx, my, 2.2, 0)).enhance(.75); M_ = CAMM["M"]; ks = sorted([k for k in pcs if k < 30 and k in fa["teeth"]], key=lambda k: fa["teeth"][k][:, 0].mean())   # صف واحد: العلوي بس
        sc = float(np.hypot(M_[0, 0], M_[0, 1])); rng = np.random.default_rng(5)
        for j, k in enumerate(ks):
            c_ = fa["teeth"][k].mean(0); tx, ty = M_[:, :2] @ c_ + M_[:, 2]   # مكان السنة نفسها بالظبط
            a = rng.uniform(0, 2 * np.pi); p = ease((t - j * .12) / 1.6)
            x = tx + 600 * (1 - p) * math.cos(a); y = ty + 600 * (1 - p) * math.sin(a)
            tw = np.ptp(fa['teeth'][k][:, 0]) * sc; pw = pcs[k][0].getbbox(); s_k = tw / max(1, (pw[2] - pw[0])); ss = .22; im = paste(im, STK, x - TIP[0] * STK.width * ss, y - tw * .75 - TIP[1] * STK.height * ss, ss); im = paste(im, pcs[k][0], x, y, s_k)   # العصاية طرفها ورا العدسة (صف واحد)   # حجم العدسة = حجم السنة على الوش
        return im
    def s5(t):   # الماكرو بنسب عروض الأسنان + أسماء المناطق
        im = outlines(A(z), sh, z, t / 1.0, width=2); vals = ["10%", "15%", "25%", "25%", "15%", "10%"]
        for j, tt in enumerate(sorted(sh.six, key=lambda q: q["cx"])):
            q = ease((t - .8 - j * .15) / .3)
            if q > 0: x, y = sh.tf(tt["cx"], tt["y"] + tt["h"] * .45, z); im = txt(im, (x, y), vals[j], 46, font=FSER, rtl=False, alpha=q)
        c11 = [q for q in sh.six if q["fdi"] == 11][0]
        for j, (s_, fy) in enumerate((("الفصوص الطولية", .4), ("المنطقة الشفافة", .85), ("الهالة", .97), ("حافة اللثة", .03))):
            q = ease((t - 2.4 - j * .4) / .3)
            if q > 0:
                px, py = sh.tf(c11["cx"], c11["y"] + c11["h"] * fy, z); ty = FH * (.15 + .12 * j); d = ImageDraw.Draw(im); d.ellipse((px - 6, py - 6, px + 6, py + 6), fill="white"); d.line([(px, py), (330, ty + 18), (50, ty + 18)], fill="white", width=2)
                im = txt(im, (50, ty - 6), s_, 32, anchor="lm", alpha=q)
        return im
    sa = living(("smile_after3_lock", "smile_after_lock"), AP)
    def s3(t):   # زي الأصل: نفس العدسات اللي على الكاست هي اللي بتطير من عليه وتقعد على سنانه (مش عدسات تظهر من العدم)
        e = ease(t / .4); ccx, ccy = FW * (.75 + .13 * e), FH * .55; s_ = max(FW / W0, FH / H0) * 1.05; ts = max(0.0, t - .3) * .95
        def src(r, n):   # كل عدسة بتطير من مكانها هي على الكاست
            sx, sy = cast_spot(cast_link(r, n), 1.8, 1.8, .58 - .1 * e, ccx, ccy); return cx0 + (sx - FW / 2) / s_, cy0 + (sy - FH / 2) / s_
        im = cam(seat_on_face(ts, src=src), cx0, cy0, 1.05, 0)
        out = ease((t - 2.8) / .6); return cast_spin(1.8, 1.8, im, .58 - .1 * e, ccx + FW * .6 * out, ccy, gone=cast_gone(ts))   # مكان كل عدسة طارت بيفضى على الكاست
    def s4b(t):   # البعد، وبعدين زووم ودوران للشفايف (+90) — الانتقال للماكرو زي الأصل
        p = ease((t - 1.4) / 1.1); return cam(face_mix(1), cx0 + (mx - cx0) * p, cy0 + (my - cy0) * p, 1.05 + .02 * t + 2.6 * p, 90 * p)
    s5 = push(s5, 9.0)   # كان لقطة متجمدة (فلتر الفيديو)
    _s5 = s5
    def s5(t): q = ease(t / .35); return blend(s4b(2.5), _s5(t), q) if q < 1 else _s5(t)   # الشفايف المايلة بتدوب في الماكرو بنفس الاتجاه
    return [(2.4, s1), (1.8, s2), (3.5, s3), (.4, lambda t: flash(cam(face_mix(1), cx0, cy0, 1.05, 0), 1 - t / .4)), (2.5, s4b), (9.0, s5), (6.5, sa), (3.1, logo)]

# ======================= وش بالمبعد v2: دمج بالذكاء الاصطناعي + السنان الحقيقية بس فوقه =======================
_RH = {}
def _harmonized(p):
    key = "h%d" % p; f = TO + f"retract_h{p}.png"
    if key not in _RH:
        if not _os.path.exists(f):
            comp = retract_face_v1(p); comp.save(TO + f"retract_c{p}.png"); sys.path.insert(0, S + "gen"); from at import run, get, upload
            P = ("Make this one natural, unedited clinical studio photo of a " + ("man" if GENDER == "male" else "woman") + " with a black dental retractor. Blend the inside of the mouth seamlessly with the face: "
                 "match lighting, white balance, sharpness and shadows, natural gum and lip edges, no visible seams, patches or pasted look. "
                 "Do NOT change the teeth at all (same shape, size, number, color and position). Keep the same person, eyes closed, framing and background.")
            u = run("Image", {"model": "google/nano-banana-pro/edit-developer", "prompt": P, "images": [upload(TO + f"retract_c{p}.png")], "aspect_ratio": "3:4", "resolution": "2k"}); get(u, f)
            h = np.array(L(f).resize(comp.size)); c = np.array(comp)
            g1, g2 = [cv2.cvtColor(x, cv2.COLOR_RGB2GRAY).astype(np.float32) for x in (c, h)]; Wp = np.eye(2, 3, dtype=np.float32)
            try: _, Wp = cv2.findTransformECC(g1, g2, Wp, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 100, 1e-5), None, 5)
            except cv2.error: pass
            h = cv2.warpAffine(h, Wp, (c.shape[1], c.shape[0]), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE); Image.fromarray(h).save(f)
        _RH[key] = np.array(L(f)).astype(np.float32)
    return _RH[key]
retract_face_v1 = retract_face
def retract_face(prog=0.0, overlay=None):
    retract_face_v1(0); R = _RF; M = morph_setup(); B = shot("B")
    pm = prog if isinstance(prog, (int, float)) else float(np.mean([prog.get(k, 0) for k in M["order"]]))
    base = _harmonized(0) * (1 - pm) + _harmonized(1) * pm
    mac = np.array(morph_img(prog, rotated=False))
    if overlay is not None: mac = np.array(overlay(Image.fromarray(mac)))
    H_, W_ = base.shape[:2]; wm = cv2.warpAffine(mac, R["M"], (W_, H_), flags=cv2.INTER_AREA).astype(np.float32)
    # كل منطقة الفم الحقيقية (سنان + لثة) زي v1 علشان مايفضلش أي سنة مولّدة، والحافة بتذوب في اللثة المدموجة
    mm = np.maximum(cv2.warpAffine(R["m"], R["M"], (W_, H_)), np.minimum(R["ai"], cv2.warpAffine(np.full(R["m"].shape, 255, np.uint8), R["M"], (W_, H_))))
    cur = np.zeros_like(R["m"])
    for kk_, c in current_contours(prog).items(): cv2.fillPoly(cur, [c.astype(np.int32)], 255)
    mm = np.maximum(mm, cv2.warpAffine(cv2.dilate(cur, np.ones((21, 21), np.uint8)), R["M"], (W_, H_)))
    core = cv2.erode(mm, np.ones((25, 25), np.uint8)); ring = (mm > 128) & (core < 128)
    k = cv2.GaussianBlur(core, (0, 0), 9).astype(np.float32)[..., None] / 255
    if ring.sum() > 100:   # نظبط لون وإضاءة الفم الحقيقي على الوش المدموج عند الحافة (من غير تغيير شكل السنان)
        la = cv2.cvtColor(np.clip(wm, 0, 255).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32); lb_ = cv2.cvtColor(np.clip(base, 0, 255).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
        for ch, w in ((0, .6), (1, .9), (2, .9)): la[..., ch] += (lb_[..., ch][ring].mean() - la[..., ch][ring].mean()) * w
        wm = cv2.cvtColor(np.clip(la, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).astype(np.float32)
        wm = cv2.GaussianBlur(wm, (0, 0), .6)
    return Image.fromarray((wm * k + base * (1 - k)).astype(np.uint8))

# ======================= إعدادات المنتج: القوالب الملغية + التخصصات (لاختيار القوالب حسب تخصص العميل) =======================
CANCELLED = {"a19", "a21"}   # ملغية بطلب العميل — مابتتعرضش ومابتترندرش
SPECIALTY = {   # التخصصات اللي القالب يظهر لها
    "a23": ["حشو وتجميل (كومبوزيت / دايركت فينير / ريستوريشن)"],
    "a24": ["زراعة", "تركيبات", "ابتسامات"],
    "a28": ["معمل", "تركيبات"],
}
DEFAULT_SPECIALTY = ["ابتسامات (عدسات / فينير)"]
def specialties(name): return SPECIALTY.get(name, DEFAULT_SPECIALTY)

if __name__ == "__main__":
    name = sys.argv[1]; ref, mus, f = REG[name]; sc = f()
    if "--still" in sys.argv: print(render(name, sc, mus, still=True))
    else: print(render(name, sc, mus)); print(compare(name, ref))
