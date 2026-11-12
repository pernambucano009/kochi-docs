#!/usr/bin/env bash
# 🧹 تنضيف السيرفر من غير ما بيانات العملاء أو البرنامج الشغّال يتلمسوا:
#   curl -fsSL https://raw.githubusercontent.com/pernambucano009/kochi-docs/claude/new-program-gvemu5/studiomania/deploy/oracle/cleanup.sh | sudo bash
# بيمسح: نسخ البرنامج القديمة (Docker images مش شغّالة)، والحاويات الواقفة، وكاش البناء الأقدم من أسبوع،
#        وسجلات النظام الأقدم من أسبوع، وكاش apt، وسجلات التحديث الكبيرة (بيسيب آخر ٥٠٠ سطر).
# مابيلمسش: /srv/simsimkit/data و/srv/simsimkit-staging/data والمفاتيح والبرنامج الشغّال.
set -uo pipefail
[ "$(id -u)" = 0 ] || { echo "شغّله بـ sudo"; exit 1; }
before=$(df --output=used -B1M / | tail -1)
echo "== قبل:"; df -h / | tail -1
docker container prune -f >/dev/null 2>&1
docker image prune -af >/dev/null 2>&1          # أي نسخة مش شغّالة دلوقتي
docker builder prune -af --filter until=168h >/dev/null 2>&1
docker volume prune -f >/dev/null 2>&1          # volumes مش مربوطة (بياناتنا مجلدات مش volumes، فمابتتلمسش)
journalctl --vacuum-time=7d >/dev/null 2>&1
apt-get clean >/dev/null 2>&1
rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* 2>/dev/null
for f in /srv/simsimkit/update.log /srv/simsimkit/autoupdate.log /srv/simsimkit-staging/update.log; do
  [ -f "$f" ] && { tail -n 500 "$f" > "$f.tmp" && mv "$f.tmp" "$f"; }
done
find /var/lib/docker/containers -name '*-json.log' -size +50M -exec truncate -s 0 {} \; 2>/dev/null
after=$(df --output=used -B1M / | tail -1)
echo "== بعد:"; df -h / | tail -1
echo "✓ اتمسح حوالي $(( (before - after) / 1024 )) GB"
echo; echo "== أكبر حاجات فاضلة (للمعلومة بس، مااتمسحتش):"
du -xsh /srv/simsimkit/data /srv/simsimkit-staging/data /var/lib/docker 2>/dev/null
du -xh --max-depth=2 /srv/simsimkit/data 2>/dev/null | sort -rh | head -8
