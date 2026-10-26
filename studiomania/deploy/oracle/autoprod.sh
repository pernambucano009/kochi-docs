#!/usr/bin/env bash
# 🚀 الموقع الحقيقي يتحدّث لوحده من الفرع (زي التجريبي)، مرة واحدة:
#   curl -fsSL https://raw.githubusercontent.com/pernambucano009/kochi-docs/claude/new-program-gvemu5/studiomania/deploy/oracle/autoprod.sh | sudo bash
# للإيقاف (يرجع ثابت ويتحدّث بـ promote.sh بس):   sudo rm /etc/cron.d/simsimkit-prod
#
# - كل ٥ دقايق: لو فيه نسخة جديدة على الفرع، الموقع بياخدها (بناء ← تشغيل، والبيانات ماتتلمسش).
# - لو النسخة الجديدة ماقامتش: بيرجع للنسخة اللي قبلها لوحده، وبيستنى النسخة اللي بعدها.
# - السجل: /srv/simsimkit/autoupdate.log
set -euo pipefail
ROOT=/srv/simsimkit
BRANCH=claude/new-program-gvemu5
[ -x "$ROOT/update.sh" ] || { echo "⚠️ الموقع الحقيقي مش متركّب على السيرفر ده"; exit 1; }

cat > "$ROOT/autoupdate.sh" <<EOF
#!/usr/bin/env bash
set -uo pipefail
exec 9>"$ROOT/.autoupdate.lock"; flock -n 9 || exit 0
git -C "$ROOT/src" fetch -q --depth 1 origin "$BRANCH" || exit 0
NEW=\$(git -C "$ROOT/src" rev-parse FETCH_HEAD)
OLD=\$(cat "$ROOT/release" 2>/dev/null || true)
[ "\$NEW" = "\$OLD" ] && exit 0
[ "\$NEW" = "\$(cat "$ROOT/.bad" 2>/dev/null || true)" ] && exit 0   # نسخة فشلت قبل كده: نستنى اللي بعدها
echo "== \$(date '+%F %T') \${OLD:0:7} → \${NEW:0:7}"
echo "\$NEW" > "$ROOT/release"
if "$ROOT/update.sh"; then
  rm -f "$ROOT/.bad"
else
  echo "⚠️ النسخة \${NEW:0:7} ماقامتش: رجوع لـ \${OLD:0:7}"
  echo "\$NEW" > "$ROOT/.bad"
  [ -n "\$OLD" ] && echo "\$OLD" > "$ROOT/release" && "$ROOT/update.sh"
fi
EOF
chmod 700 "$ROOT/autoupdate.sh"
echo "*/5 * * * * root $ROOT/autoupdate.sh >> $ROOT/autoupdate.log 2>&1" > /etc/cron.d/simsimkit-prod
chmod 644 /etc/cron.d/simsimkit-prod

echo "== أول تحديث الآن"
"$ROOT/autoupdate.sh" | tail -3 || true
echo
echo "✓ خلاص: الموقع الحقيقي بياخد أي تحديث على الفرع لوحده كل ٥ دقايق."
echo "  النسخة الحالية: $(cut -c1-7 "$ROOT/release")"
