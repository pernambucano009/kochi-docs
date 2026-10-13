# يطلّع قواعد الدارك لكل حاجة في style.css خلفيتها فاتحة مكتوبة بإيدينا (مش من المتغيرات)
import re, sys
css = open(sys.argv[1]).read()
start = css.find("/* ============ الدارك مود للصفحات")
if start > 0: css = css[:start]
css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
def lum(v):
    v = v.strip().lower()
    m = re.fullmatch(r"#([0-9a-f]{3}|[0-9a-f]{6})", v)
    if m:
        h = m.group(1); h = "".join(c*2 for c in h) if len(h) == 3 else h
        r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4)); return (r*.3+g*.59+b*.11)/255, 1
    m = re.fullmatch(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)", v)
    if m:
        r, g, b = (int(m.group(i)) for i in (1, 2, 3)); a = float(m.group(4) or 1); return (r*.3+g*.59+b*.11)/255, a
    if v == "white": return 1, 1
    return None
def sat(v):
    v = v.strip().lower()
    m = re.fullmatch(r"#([0-9a-f]{3}|[0-9a-f]{6})", v)
    if m:
        h = m.group(1); h = "".join(c*2 for c in h) if len(h) == 3 else h
        c = [int(h[i:i+2], 16) for i in (0, 2, 4)]
    else:
        m = re.fullmatch(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+).*", v)
        if not m: return 0
        c = [int(m.group(i)) for i in (1, 2, 3)]
    return (max(c) - min(c)) / 255
out = []
for m in re.finditer(r"([^{}@]+)\{([^{}]*)\}", css):
    sels = [s.strip() for s in m.group(1).split(",") if s.strip()]
    if not sels or any(s.startswith(("from", "to", "0%", "50%", "100%")) or re.fullmatch(r"[\d.]+%", s) for s in sels): continue
    if ":where" in m.group(1): continue
    # المونتاج والتايم لاين والمقابض: الأبيض فيها مقصود (خط المؤشر والمقابض)، والصفحة نفسها بالمتغيرات
    SKIP = (":root", "html", "body", "#nh", ".nh-", ".stage", ".flow", ".tl-", ".vline", ".vol-drag", ".pv-", ".frame", ".ed-player",
            ".tv-", ".gz-", ".kfd", ".ct-", "button.ic", ".clip-pick", ".wd-", ".fx-box", "#pv", ".avatars")
    sels = [s for s in sels if not s.startswith(SKIP)]
    if not sels: continue
    decls = []
    for d in m.group(2).split(";"):
        if ":" not in d: continue
        p, v = d.split(":", 1); p = p.strip(); v = v.replace("!important", "").strip(); imp = " !important" if "!important" in d else ""
        if p in ("background", "background-color"):
            L = lum(v)
            if L and L[0] > .82:
                if L[1] < .5: bg = "rgba(255,255,255,.06)"
                elif sat(v) > .035: bg = f"color-mix(in srgb, {v} 16%, transparent)"   # خلفية ملوّنة (حالة): نفس اللون بس شفاف
                else: bg = "var(--surface-2)"
                decls.append(f"background: {bg}{imp}")
        elif p in ("border", "border-color", "border-bottom", "border-top"):
            mm = re.search(r"#[0-9a-fA-F]{3,6}\b|rgba?\([^)]*\)", v)
            if mm and (L := lum(mm.group(0))) and .7 < L[0] < .97 and L[1] > .4:
                decls.append(f"{p}: {v.replace(mm.group(0), 'var(--line)')}{imp}")
        elif p == "color":
            L = lum(v)
            if L and L[0] < .2 and L[1] > .5:
                decls.append(f"color: var(--text){imp}")
    if decls:
        out.append(",\n".join(f':root[data-nh-theme="dark"] {s}' for s in sels) + " { " + "; ".join(decls) + "; }")
print("\n".join(out))
