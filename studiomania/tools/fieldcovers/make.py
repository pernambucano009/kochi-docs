"""يعمل غلاف (1080×1350) وفيديو معاينة لكل قالب من قوالب كل مجال، بكلام وصور من المجال نفسه.
    python3 tools/fieldcovers/make.py [field[/tpl] ...]
الناتج: frontend/gallery/f/<field>/<tpl>.jpg و.mp4 + frontend/gallery/f/index.json (المتاح لكل مجال)."""
import base64, io, json, subprocess, sys, tempfile
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageFilter, ImageStat
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
from art import ART  # noqa: E402
from samples import S  # noqa: E402

R = ROOT / "library" / "motion" / "r"
OUT = ROOT / "frontend" / "gallery" / "f"
FF = imageio_ffmpeg.get_ffmpeg_exe()
FPS = 24


def art_png(name: str, page) -> str:
    """الرسمة ← PNG شفاف (data URL)."""
    w, h, body = ART[name]
    page.set_viewport_size({"width": w * 2, "height": h * 2})
    page.set_content(f'<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="{w*2}" height="{h*2}" viewBox="0 0 {w} {h}">{body}</svg></body></html>')
    return "data:image/png;base64," + base64.b64encode(page.screenshot(omit_background=True)).decode()


def score(im):
    g = im.convert("L").resize((270, 338))
    return ImageStat.Stat(g.filter(ImageFilter.FIND_EDGES)).mean[0] + ImageStat.Stat(im.convert("HSV").resize((270, 338))).mean[1] * 0.15 + ImageStat.Stat(g).stddev[0] * 0.3


def render(b, field: str, tpl: str, params: dict, arts: dict):
    pr = {k: (arts[v] if k.startswith(("img", "p")) and isinstance(v, str) and v in ART else v) for k, v in params.items()}
    pg = b.new_page(viewport={"width": 1080, "height": 1920})
    try:
        pg.add_init_script("window.PARAMS = " + json.dumps(pr, ensure_ascii=False) + ";")
        pg.goto((R / tpl / "reel.html").as_uri())
        pg.evaluate("() => window.ready")
        W, H, dur = pg.evaluate("() => [window.W, window.H, window.DUR]")
        pg.set_viewport_size({"width": W, "height": H})
        dest = OUT / field
        dest.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory() as td:
            wav = Path(td) / "a.wav"
            wav.write_bytes(base64.b64decode(pg.evaluate("() => soundtrack()")))
            n = int(dur * FPS)
            cmd = [FF, "-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-", "-i", str(wav),
                   "-vf", "scale=540:-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-pix_fmt", "yuv420p",
                   "-c:a", "aac", "-b:a", "64k", "-shortest", "-movflags", "+faststart", str(dest / f"{tpl}.mp4")]
            proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
            best, picks = None, {int(n * (0.3 + 0.6 * k / 9)) for k in range(10)}
            for i in range(n):
                pg.evaluate(f"() => seek({i / FPS})")
                shot = pg.screenshot(type="jpeg", quality=88)
                proc.stdin.write(shot)
                if i in picks:   # الغلاف: أحسن فريم (نفس قص الكارت ٤:٥ من النص)
                    im = Image.open(io.BytesIO(shot)).convert("RGB")
                    cw = min(W, H * 4 / 5); ch = cw * 5 / 4
                    c = im.crop(tuple(int(v) for v in ((W - cw) / 2, (H - ch) / 2, (W + cw) / 2, (H + ch) / 2))).resize((1080, 1350), Image.LANCZOS)
                    s = score(c)
                    if best is None or s > best[0]:
                        best = (s, c)
            proc.stdin.close()
            if proc.wait() != 0:
                raise RuntimeError("ffmpeg فشل")
        best[1].save(dest / f"{tpl}.jpg", quality=84, optimize=True, progressive=True)
    finally:
        pg.close()


def main():
    want = sys.argv[1:]
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
        ap = b.new_page()
        arts = {k: art_png(k, ap) for k in ART}
        ap.close()
        for field, tpls in S.items():
            for tpl, params in tpls.items():
                if want and field not in want and f"{field}/{tpl}" not in want:
                    continue
                try:
                    render(b, field, tpl, params, arts)
                    print("✓", field, tpl, flush=True)
                except Exception as e:  # noqa: BLE001
                    print("✗", field, tpl, e, flush=True)
        b.close()
    idx = {f: sorted(x.stem for x in (OUT / f).glob("*.jpg")) for f in S if (OUT / f).exists()}
    (OUT / "index.json").write_text(json.dumps(idx, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
