#!/usr/bin/env bash
# 🔎 آخر مشاريع القوالب على الموقع الحقيقي (بيقرا بس): القالب، والمجال، وعناصر المجال اتحطت ولا لأ، والصوت
#   curl -fsSL https://raw.githubusercontent.com/pernambucano009/kochi-docs/claude/new-program-gvemu5/studiomania/deploy/oracle/flowcheck.sh | sudo bash -s [template-id]
set -uo pipefail
T=${1:-}
python3 - /srv/simsimkit/data/_platform/tenants "$T" <<'PY'
import json, sys, pathlib, time
root, want = pathlib.Path(sys.argv[1]), sys.argv[2]
rows = []
for f in root.glob("*/ads/flows/*/flow.json"):
    try: d = json.loads(f.read_text("utf-8"))
    except Exception: continue
    t = (d.get("template") or {}).get("id") or ""
    if want and t != want: continue
    rows.append((f.stat().st_mtime, f, d))
for mt, f, d in sorted(rows, key=lambda r: r[0], reverse=True)[:5]:
    ten = f.parts[f.parts.index("tenants") + 1]
    tdir = root / ten
    ob = {}
    try: ob = json.loads((tdir / "onboard.json").read_text("utf-8"))
    except Exception: pass
    p = d.get("params") or {}
    els = p.get("els") or []
    o = d.get("output") or {}
    op = o.get("params") or {}
    print(f"== {time.strftime('%m-%d %H:%M', time.localtime(mt))} tenant={ten} flow={f.parent.name} tpl={(d.get('template') or {}).get('id')} stage={d.get('stage')}")
    print(f"   onboard.field={ob.get('field')!r}  client={d.get('client_id')}")
    print(f"   params.els={len(els)} {[str(x)[:60] for x in els[:3]]}")
    print(f"   output.status={o.get('status')} output.els={len(op.get('els') or [])} {[str(x)[:60] for x in (op.get('els') or [])[:2]]}")
    print(f"   vo={ (d.get('vo') or {}).get('voice') } secs={(d.get('vo_track') or {}).get('secs')}")
PY
echo "== app version: $(cut -c1-7 /srv/simsimkit/release 2>/dev/null)"
docker logs --since 6h simsimkit 2>&1 | grep -E "\[vo\]|field|els|\[logost\]|\[stamp\]" | tail -8
