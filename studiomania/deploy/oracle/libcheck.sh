#!/usr/bin/env bash
# 🖼️ فحص ملفات مكتبة الصور لعميل (بيقرا بس): كل ملف موجود؟ حجمه؟ نوعه الحقيقي؟
#   curl -fsSL https://raw.githubusercontent.com/pernambucano009/kochi-docs/claude/new-program-gvemu5/studiomania/deploy/oracle/libcheck.sh | sudo bash -s <tenant>
set -uo pipefail
T=${1:?tenant id}
ROOT=/srv/simsimkit/data/_platform/tenants/$T
[ -d "$ROOT" ] || { echo "مفيش عميل بالرقم ده: $ROOT"; exit 1; }
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
        print(f"  {f['file']:<26} {(p.stat().st_size if p.exists() else 0):>9}  {kind}  | {str(f.get('error') or '')[:60]}")
    print("  summary:", dict(stat))
tmp = root / "tmp"
print("tmp dir:", "ok" if tmp.is_dir() else "MISSING", "| free:", subprocess.run(["df", "-h", str(root)], capture_output=True, text=True).stdout.splitlines()[-1])
PY
