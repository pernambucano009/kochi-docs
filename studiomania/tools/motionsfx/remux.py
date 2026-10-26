"""يبدّل صوت فيديوهات المعرض (frontend/gallery) بالصوت الجديد مع أصوات الحركات، والصورة زي ما هي.
    python3 tools/motionsfx/remux.py [t-id ...]"""
import base64, json, subprocess, sys, tempfile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parent.parent.parent; R=ROOT/"library/motion/r"; G=ROOT/"frontend/gallery"
sys.path.insert(0,str(ROOT/"tools/fieldcovers")); from samples import S
from art import ART
import imageio_ffmpeg; FF=imageio_ffmpeg.get_ffmpeg_exe()
from playwright.sync_api import sync_playwright
jobs=[(G/f"{d.name}.mp4",d.name,None) for d in sorted(R.iterdir()) if (G/f"{d.name}.mp4").exists() and (d/"sfx.js").exists()]
for f,tp in S.items():
    for t,pr in tp.items():
        if (G/"f"/f/f"{t}.mp4").exists() and (R/t/"sfx.js").exists(): jobs.append((G/"f"/f/f"{t}.mp4",t,pr))
if len(sys.argv)>1: jobs=[j for j in jobs if j[1] in sys.argv[1:]]
def run(job):
    mp4,tid,pr=job
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path="/opt/pw-browsers/chromium"); pg=b.new_page()
        if pr: pg.add_init_script("window.PARAMS="+json.dumps({k:v for k,v in pr.items() if not (isinstance(v,str) and v in ART)},ensure_ascii=False)+";")
        pg.goto((R/tid/"reel.html").as_uri()); pg.evaluate("()=>window.ready")
        wav=base64.b64decode(pg.evaluate("()=>soundtrack()")); b.close()
    with tempfile.TemporaryDirectory() as td:
        w=Path(td)/"a.wav"; w.write_bytes(wav); o=Path(td)/"o.mp4"
        subprocess.run([FF,"-hide_banner","-loglevel","error","-y","-i",str(mp4),"-i",str(w),"-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a","aac","-b:a","64k","-shortest","-movflags","+faststart",str(o)],check=True)
        mp4.write_bytes(o.read_bytes())
    return f"✓ {mp4.relative_to(G)}"
print(len(jobs),"videos",flush=True)
with ThreadPoolExecutor(4) as ex:
    for r in ex.map(run,jobs): print(r,flush=True)
