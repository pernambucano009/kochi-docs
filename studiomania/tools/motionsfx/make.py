"""🔊 أصوات الحركات: بيتفرج على كل قالب فريم بفريم، ويطلّع لحظات الحركة، ويكتبها في r/<القالب>/sfx.js.
    python3 tools/motionsfx/make.py [t-id ...]

لكل لحظة نوع:
- pop: حاجة ظهرت فجأة وصغيرة (كلمة، أيقونة، كارت)
- thud: تغيير كبير مفاجئ (خبطة، فلاش، قطع)
- swish: حركة ممتدة (انزلاق، كاميرا، انتقال) وطولها على قد الحركة
والصوت بيتحط يمين أو شمال حسب مكان الحركة في الشاشة.

core.js بيحط الأصوات دي تحت صوت القالب نفسه، وأي لحظة القالب حاطط عليها صوت بإيده (whoosh أو hit أو click…) مابيتحطش عليها صوت تاني.
"""
import io
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent.parent
R = ROOT / "library" / "motion" / "r"
FPS = 20
SCALE = 0.1   # 1080×1920 ← 108×192: كفاية نعرف فين الحركة وإمتى


def frames(pg, dur: float):
    out = []
    for i in range(int(dur * FPS)):
        pg.evaluate(f"() => seek({i / FPS})")
        im = Image.open(io.BytesIO(pg.screenshot(type="jpeg", quality=70))).convert("L")
        out.append(np.asarray(im, dtype=np.float32) / 255.0)
    return out


def detect(fr: list, dur: float) -> list:
    """زي ما بنلاقي ضربات الطبلة في الصوت: الشاشة مقسومة مربعات، وأي مربع الحركة فيه «بدأت» أو زادت فجأة = لحظة."""
    fr = np.asarray(fr)
    n = len(fr)
    if n < 4:
        return []
    h, w = fr.shape[1:]
    TY, TX = 10, 6
    d = np.abs(np.diff(fr, axis=0)) > 0.06   # البكسلات اللي اتغيرت فعلًا (الحبيبات الخفيفة لأ)
    a = d[:, :h // TY * TY, :w // TX * TX].reshape(n - 1, TY, h // TY, TX, w // TX).mean(axis=(2, 4))
    a = np.concatenate([np.zeros((1, TY, TX)), a])
    tot = a.mean(axis=(1, 2))
    flux, xs = np.zeros(n), np.zeros(n)
    cx = np.linspace(-1, 1, TX)[None, :]
    for i in range(1, n):
        r = np.clip(a[i] - a[max(0, i - 3):i].max(axis=0), 0, None)
        flux[i] = r.mean()
        m = r.sum()
        xs[i] = (r * cx).sum() / m if m > 0 else 0
    thr = max(0.004, float(np.percentile(flux, 60)) * 3, float(flux.max()) * 0.08)
    cues, last, last_swish = [], -9.0, -9.0
    for i in range(1, n - 1):
        if flux[i] < thr or flux[i] < flux[i - 1] or flux[i] < flux[i + 1]:
            continue
        t = i / FPS
        if t - last < 0.2 or t > dur - 0.15:
            continue
        lvl, j = tot[i], i
        while j + 1 < n and tot[j + 1] >= lvl * 0.45 and j - i < FPS:
            j += 1
        length, pan = (j - i + 1) / FPS, round(float(np.clip(xs[i], -1, 1)) * 0.6, 2)
        k = float(np.log2(flux[i] / thr))   # قوة اللحظة: ٠ = على الحد، وكل ١ = الضعف
        if flux[i] > 0.18:
            cues.append([round(t, 3), "thud", round(float(np.clip(0.3 + 0.05 * k, 0.3, 0.45)), 3), pan, 0])
        elif length >= 0.3 and t - last_swish > 0.7:   # حركة ممتدة واحدة = انزلاق واحد (مش وش مستمر)
            cues.append([round(t, 3), "swish", round(float(np.clip(0.13 + 0.04 * k, 0.13, 0.28)), 3), pan, round(min(0.75, length), 2)])
            last_swish = t
        else:
            cues.append([round(t, 3), "pop", round(float(np.clip(0.08 + 0.03 * k, 0.08, 0.18)), 3), pan, 0])
        last = t
    # مش أكتر من ٣ أصوات في الثانية: الأضعف بيتشال
    keep = []
    for c in sorted(cues, key=lambda c: -c[2]):
        if sum(abs(k[0] - c[0]) < 1 for k in keep) < 3:
            keep.append(c)
    return sorted(keep)


def one(tid: str) -> str:
    f = R / tid / "reel.html"
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
        pg = b.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=SCALE)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        try:
            pg.goto(f.as_uri())
            pg.evaluate("() => window.ready")
            W, H, dur = pg.evaluate("() => [window.W, window.H, window.DUR]")
            pg.set_viewport_size({"width": W, "height": H})
            cues = detect(frames(pg, dur), dur)
        finally:
            b.close()
    (R / tid / "sfx.js").write_text("// 🔊 أصوات الحركات (tools/motionsfx/make.py): [الوقت، النوع، العلو، يمين/شمال، الطول]\nwindow.SFX = "
                                    + json.dumps(cues) + ";\n", encoding="utf-8")
    kinds = {k: sum(c[1] == k for c in cues) for k in ("pop", "thud", "swish")}
    return f"✓ {tid}: {len(cues)} {kinds}{' ⚠️ ' + errs[0][:80] if errs else ''}"


def main():
    ids = sys.argv[1:] or sorted(d.name for d in R.iterdir() if (d / "reel.html").exists())
    with ThreadPoolExecutor(4) as ex:
        for line in ex.map(one, ids):
            print(line, flush=True)


if __name__ == "__main__":
    main()
