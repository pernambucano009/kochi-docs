#!/usr/bin/env bash
# 🚨 آخر الأخطاء في صندوق الأخطاء على الموقع الحقيقي (للمساعدة/المكالمة: السبب اللي خلاها ماتفتحش). بيقرا بس:
#   curl -fsSL https://raw.githubusercontent.com/pernambucano009/kochi-docs/claude/new-program-gvemu5/studiomania/deploy/oracle/lastissues.sh | sudo bash
# كلمة بعد الأمر = فلتر (افتراضي: assistant):  ... | sudo bash -s all
set -uo pipefail
DB=/srv/simsimkit/data/_platform/platform.db
F=${1:-assistant}
python3 - "$DB" "$F" <<'PY'
import sqlite3, sys, datetime
db, f = sys.argv[1], sys.argv[2]
c = sqlite3.connect(db); c.row_factory = sqlite3.Row
q = "SELECT * FROM issues ORDER BY last_at DESC LIMIT 15" if f == "all" else \
    "SELECT * FROM issues WHERE screen LIKE ? OR path LIKE ? ORDER BY last_at DESC LIMIT 15"
rows = c.execute(q) if f == "all" else c.execute(q, (f"%{f}%", f"%{f}%"))
n = 0
for r in rows:
    n += 1
    at = datetime.datetime.fromtimestamp(r["last_at"] or 0).strftime("%m-%d %H:%M")
    print(f"== {at} ×{r['count']} | {r['screen'] or r['path']} | {r['message']}")
    if r["raw"]: print("   ", (r["raw"] or "")[:300])
    print("   users:", r["users"], "| resolved" if r["resolved_at"] else "")
if not n: print("مفيش أخطاء متسجلة بالفلتر ده")
PY
