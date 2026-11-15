#!/usr/bin/env bash
# 📼 آخر مكالمة مساعدة متسجلة على الموقع الحقيقي (كلام المساعدة والعميل والأدوات بالترتيب). بيقرا بس:
#   curl -fsSL https://raw.githubusercontent.com/pernambucano009/kochi-docs/claude/new-program-gvemu5/studiomania/deploy/oracle/lastcall.sh | sudo bash
# رقم بعد الأمر = المكالمة رقم كام من الآخر (١ = آخر واحدة):  ... | sudo bash -s 2
set -uo pipefail
D=/srv/simsimkit/data/_platform/assistant_calls
N=${1:-1}
f=$(ls -t "$D"/*.json 2>/dev/null | sed -n "${N}p")
[ -z "$f" ] && { echo "مفيش مكالمات متسجلة (تسجيل مكالمات العملاء مقفول في «معمل سعاد»؟)"; exit 0; }
python3 - "$f" <<'PY'
import json, sys, datetime
d = json.load(open(sys.argv[1], encoding="utf-8"))
print("==", sys.argv[1].rsplit("/", 1)[-1], "|", json.dumps(d.get("meta") or {}, ensure_ascii=False)[:400])
t0 = None
for e in d.get("events") or []:
    t = e.get("t") or e.get("at") or 0
    if t and t0 is None: t0 = t
    s = f"{(t - t0) / 1000:6.1f}s " if t and t0 and t > 1e6 else ""
    extra = e.get("data")
    print(f"{s}{e.get('who', '')}: {e.get('text', '')}" + (f"  {json.dumps(extra, ensure_ascii=False)[:300]}" if extra else ""))
PY
