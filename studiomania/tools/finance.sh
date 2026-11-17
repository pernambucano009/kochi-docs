#!/usr/bin/env bash
# 💰 بيانات الحسابات من الموقع لجلسة Claude (قراءة بس، بنفس مفتاح المتابعة بتاع صندوق الأخطاء)
#   tools/finance.sh costs [YYYY-M]     صرف الشهر: على مين، وفي أنهي أقسام، واقتصاد كل باقة
#   tools/finance.sh providers          رصيد كل منصة وباقتها وصرف الشهر ورابط الشحن
#   tools/finance.sh xlsx [months] out  النموذج المالي Excel (ملخص كل شهر، والإيراد، والإنفاق)
set -euo pipefail
B="${SIMSIM_URL:-https://simsimkit.com}"
H=(-sS -m 60); [ -n "${SIMSIM_FEED_KEY:-}" ] && H+=(-H "Authorization: Bearer $SIMSIM_FEED_KEY")
case "${1:-}" in
  costs) curl "${H[@]}" "$B/api/platform/issues/fin/costs?month=${2:-}" ;;
  providers) curl "${H[@]}" "$B/api/platform/issues/fin/providers" ;;
  xlsx) curl "${H[@]}" -o "${3:-finance.xlsx}" "$B/api/platform/issues/fin/finance.xlsx?months=${2:-12}" && echo "saved ${3:-finance.xlsx}" ;;
  *) echo "usage: finance.sh costs [YYYY-M] | providers | xlsx [months] [out]"; exit 1 ;;
esac
