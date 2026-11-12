#!/usr/bin/env bash
# 🔧 تصليح التحديث التلقائي للتجريبي (مرة واحدة):
#   curl -fsSL https://raw.githubusercontent.com/pernambucano009/kochi-docs/claude/new-program-gvemu5/studiomania/deploy/oracle/fix-autoupdate.sh | sudo bash
# المشكلة: لو البناء فشل مرة (غالبًا الديسك اتملا بالنسخ القديمة)، التحديث التلقائي كان بيفتكر إنه خلص ومابيحاولش تاني.
# التصليح: بيمسح النسخ القديمة قبل كل بناء، وبيقارن بآخر نسخة اشتغلت فعلًا، وبيبني دلوقتي.
set -euo pipefail
SR=/srv/simsimkit-staging
[ -f "$SR/update.sh" ] || { echo "⚠️ التجريبي مش متركّب"; exit 1; }
echo "== آخر سجل:"; tail -n 15 "$SR/update.log" 2>/dev/null || true
echo "== الديسك:"; df -h / | tail -1
grep -q 'image prune' "$SR/update.sh" || sed -i 's|^docker build |docker image prune -f >/dev/null 2>\&1 \|\| true\ndocker build |' "$SR/update.sh"
grep -q '.deployed' "$SR/update.sh" || sed -i "s|{ echo \"✓ التجريبي شغّال|{ git -C \"$SR/src\" rev-parse HEAD > \"$SR/.deployed\"; echo \"✓ التجريبي شغّال|" "$SR/update.sh"
sed -i "s|\[ \"\$(git -C \"$SR/src\" rev-parse HEAD)\" = |[ \"\$(cat \"$SR/.deployed\" 2>/dev/null)\" = |" "$SR/autoupdate.sh"
docker image prune -f >/dev/null 2>&1 || true
echo "== بناء التجريبي دلوقتي (دقايق)…"
"$SR/update.sh"
