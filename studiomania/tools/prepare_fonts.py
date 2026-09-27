"""يجهّز خطوط الكابشن: نسخة ثابتة عريضة + إضافة أشكال الحروف العربي الناقصة (Presentation Forms)."""
import sys, unicodedata
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FORM_FEATURE = {"<isolated>": "isol", "<final>": "fina", "<initial>": "init", "<medial>": "medi"}

def single_subs(font, feature):
    out = {}
    if "GSUB" not in font: return out
    gsub = font["GSUB"].table
    for fr in gsub.FeatureList.FeatureRecord:
        if fr.FeatureTag != feature: continue
        for li in fr.Feature.LookupListIndex:
            lk = gsub.LookupList.Lookup[li]
            for st in lk.SubTable:
                if lk.LookupType == 7: st = st.ExtSubTable
                if getattr(st, "mapping", None): out.update(st.mapping)
    return out

def add_presentation_forms(font):
    cmap = font.getBestCmap()
    subs = {f: single_subs(font, f) for f in FORM_FEATURE.values()}
    added = 0
    for cp in list(range(0xFB50, 0xFDFF)) + list(range(0xFE70, 0xFEFF)):
        if cp in cmap: continue
        try: dec = unicodedata.decomposition(chr(cp)).split()
        except ValueError: continue
        if len(dec) != 2 or dec[0] not in FORM_FEATURE: continue
        base = int(dec[1], 16)
        if base not in cmap: continue
        g = cmap[base]
        g = subs[FORM_FEATURE[dec[0]]].get(g, g if dec[0] == "<isolated>" else None)
        if g is None: continue
        for t in font["cmap"].tables:
            if t.isUnicode(): t.cmap[cp] = g
        added += 1
    return added

ZERO_WIDTH = (0x200B, 0x200C, 0x200D, 0x200E, 0x200F, 0x2060, 0xFEFF)

def add_zero_width(font):
    """أداة الكتابة بتسيب علامات مخفية جنب الحروف المدموجة (لا، لأ)، فلازم يبقى ليها شكل فاضي."""
    from fontTools.ttLib.tables._g_l_y_f import Glyph
    cmap = font.getBestCmap()
    missing = [cp for cp in ZERO_WIDTH if cp not in cmap]
    if not missing or "glyf" not in font: return 0
    name = "sm.zerowidth"
    order = font.getGlyphOrder()
    if name not in order:
        font.setGlyphOrder(order + [name])
        font["glyf"].glyphs[name] = Glyph()
        font["glyf"].glyphOrder = font.getGlyphOrder()
        font["hmtx"].metrics[name] = (0, 0)
    for t in font["cmap"].tables:
        if t.isUnicode():
            for cp in missing: t.cmap[cp] = name
    return len(missing)

def rename(font, family):
    name = font["name"]
    for nid in (1, 2, 3, 4, 6, 16, 17): name.removeNames(nameID=nid)
    ps = family.replace(" ", "")
    for nid, val in ((1, family), (2, "Regular"), (3, ps), (4, family), (6, ps)):
        name.setName(val, nid, 3, 1, 0x409)
        name.setName(val, nid, 1, 0, 0)
    if "OS/2" in font:
        font["OS/2"].usWeightClass = 400
        font["OS/2"].fsSelection = (font["OS/2"].fsSelection & ~0b1100001) | 0b1000000
    if "head" in font: font["head"].macStyle = 0

src, family, out = sys.argv[1], sys.argv[2], sys.argv[3]
wght = int(sys.argv[4]) if len(sys.argv) > 4 else None
font = TTFont(src)
if "fvar" in font:
    axes = {a.axisTag: a.defaultValue for a in font["fvar"].axes}
    if wght: axes["wght"] = wght
    font = instancer.instantiateVariableFont(font, axes)
n = add_presentation_forms(font)
z = add_zero_width(font)
rename(font, family)
if "DSIG" in font: del font["DSIG"]
font.save(out)
print(f"{out.split('/')[-1]}: +{n} forms, +{z} zero-width")
