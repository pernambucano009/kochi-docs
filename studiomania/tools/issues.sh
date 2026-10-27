#!/usr/bin/env bash
# 🤖 سحب صندوق الأخطاء من الموقع لجلسة Claude (المفتاح في متغير البيئة SIMSIM_FEED_KEY، من /admin/inspect ← متابعة Claude)
#   tools/issues.sh               الأخطاء المفتوحة
#   tools/issues.sh since <epoch> اللي اتحدّث بعد وقت معيّن
#   tools/issues.sh resolve <id> "<ملاحظة>"
set -euo pipefail
B="${SIMSIM_URL:-https://simsimkit.com}"
# لو المفتاح متحط في «أسرار الشبكة» البروكسي بيضيفه لوحده، فالمتغير مش لازم
H=(-sS -m 30); [ -n "${SIMSIM_FEED_KEY:-}" ] && H+=(-H "Authorization: Bearer $SIMSIM_FEED_KEY")
case "${1:-}" in
  resolve) curl "${H[@]}" -X POST -H "content-type: application/json" -d "$(python3 -c 'import json,sys;print(json.dumps({"note":sys.argv[1]}))' "${3:-}")" "$B/api/platform/issues/feed/$2/resolve" ;;
  since) curl "${H[@]}" "$B/api/platform/issues/feed?since=$2" ;;
  *) curl "${H[@]}" "$B/api/platform/issues/feed" ;;
esac
