#!/usr/bin/env bash
# 🖼️ فحص ملفات مكتبة الصور لعميل (بيقرا بس): كل ملف موجود؟ حجمه؟ نوعه الحقيقي؟
#   curl -fsSL https://raw.githubusercontent.com/pernambucano009/kochi-docs/claude/new-program-gvemu5/studiomania/deploy/oracle/libcheck.sh | sudo bash -s <tenant>
set -uo pipefail
T=${1:?tenant id}
ROOT=/srv/simsimkit/data/_platform/tenants/$T
[ -d "$ROOT" ] || { echo "مفيش عميل بالرقم ده: $ROOT"; exit 1; }
echo "release: $(cut -c1-7 /srv/simsimkit/release 2>/dev/null) | container up since: $(docker inspect -f '{{.State.StartedAt}}' simsimkit 2>/dev/null)"
grep -c "_lib_retag_jpg" /srv/simsimkit/src/studiomania/backend/app.py 2>/dev/null | sed 's/^/jpg-fix in code: /'
python3 - "$ROOT" <<'PY'
import json, sys, pathlib, subprocess, collections
root = pathlib.Path(sys.argv[1])
for lj in sorted(root.glob("ads/brains/*/library/library.json")):
    d = json.loads(lj.read_text("utf-8")); folder = lj.parent
    files = d.get("files") or []
    print(f"== {lj.parent.parent.name}: {len(files)} files")
    stat = collections.Counter()
    for f in files[-40:]:
        p = folder / f["file"]
        if not p.exists():
            kind = "MISSING"
        else:
            kind = subprocess.run(["file", "-b", str(p)], capture_output=True, text=True).stdout.strip()[:70]
        stat[kind.split(",")[0]] += 1
        print(f"  {f['file']:<22} {(p.stat().st_size if p.exists() else 0):>9} {kind[:20]:<20} st={f.get('status')} th={f.get('thumb') or '-'} | {str(f.get('error') or '')[:110]}")
    print("  summary:", dict(stat))
    e = next((str(f.get("error")) for f in files if f.get("error")), "")
    if e: print("  first full error:", e[:700])
tmp = root / "tmp"
print("tmp dir:", "ok" if tmp.is_dir() else "MISSING", "| free:", subprocess.run(["df", "-h", str(root)], capture_output=True, text=True).stdout.splitlines()[-1])
PY
echo "== HTTP test (inside the app, like the browser)"
docker exec -i simsimkit python3 - "$T" <<'PY'
import os, sys, json, urllib.request, pathlib
t = sys.argv[1]
for pid in os.listdir("/proc"):
    if not pid.isdigit(): continue
    try:
        env = dict(x.split("=", 1) for x in open(f"/proc/{pid}/environ", "rb").read().decode(errors="ignore").split("\0") if "=" in x)
        cmd = open(f"/proc/{pid}/cmdline", "rb").read().decode(errors="ignore").split("\0")
    except OSError:
        continue
    if t not in env.get("STUDIOMANIA_DATA", "") or "--port" not in cmd: continue
    port, sec = cmd[cmd.index("--port") + 1], env.get("GATEWAY_SECRET", "")
    data = pathlib.Path(env["STUDIOMANIA_DATA"])
    print("tenant app port", port)
    for lj in data.glob("ads/brains/*/library/library.json"):
        bid = lj.parent.parent.name
        for f in [x for x in json.loads(lj.read_text()).get("files", []) if x.get("kind") == "image"][-4:]:
            for n in {f["file"], f.get("thumb") or f["file"]}:
                u = f"/media/ads/brains/{bid}/library/{n}"
                try:
                    r = urllib.request.urlopen(urllib.request.Request(f"http://127.0.0.1:{port}{u}", headers={"x-gateway-secret": sec}), timeout=20)
                    print(" ", r.status, r.headers.get("content-type"), r.headers.get("content-length"), u)
                except Exception as e:
                    print("  FAIL", e, u)
    break
else:
    print("tenant app not running now (open the site with that account then run again)")
PY
