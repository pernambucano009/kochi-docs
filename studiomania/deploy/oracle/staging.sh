#!/usr/bin/env bash
# 🧪 نسخة تجريبية (staging) على نفس السيرفر، مرة واحدة:
#   curl -fsSL https://raw.githubusercontent.com/pernambucano009/kochi-docs/claude/new-program-gvemu5/studiomania/deploy/oracle/staging.sh | sudo bash -s staging.simsimkit.com
#
# - النسخة التجريبية على https://staging.simsimkit.com، ببيانات لوحدها (/srv/simsimkit-staging/data)، وبتاخد أي تحديث على الفرع كل ٥ دقايق.
# - مفاتيح الخدمات بتتنسخ من الموقع الحقيقي، ما عدا مفاتيح الدفع (مفيش فلوس حقيقية بتتدفع على النسخة التجريبية).
# - الموقع الحقيقي بيتثبّت على النسخة اللي شغالة دلوقتي، ومابيتحدّثش لوحده تاني.
#   لما الوكالة توافق على اللي في التجريبي: sudo /srv/simsimkit/promote.sh  ← الموقع الحقيقي ياخد نفس النسخة بالظبط.
set -euo pipefail
ROOT=/srv/simsimkit
SR=/srv/simsimkit-staging
SD="${1:-staging.simsimkit.com}"
BRANCH=claude/new-program-gvemu5
REPO=https://github.com/pernambucano009/kochi-docs.git
SPORT=8100

[ -f "$ROOT/app.env" ] || { echo "⚠️ الموقع الحقيقي مش متركّب على السيرفر ده"; exit 1; }

echo "== 1) الكود والبيانات"
mkdir -p "$SR/data"
[ -d "$SR/src/.git" ] || git clone -q --depth 1 -b "$BRANCH" "$REPO" "$SR/src"

echo "== 2) المفاتيح (من غير مفاتيح الدفع)"
grep -v -E '^(PUBLIC_URL|PAYPAL_[A-Z_]*|STRIPE_[A-Z_]*|TAP_[A-Z_]*)=' "$ROOT/app.env" > "$SR/app.env" || true
echo "PUBLIC_URL=https://$SD" >> "$SR/app.env"
echo "STAGING=1" >> "$SR/app.env"
chmod 600 "$SR/app.env"
# مفاتيح الخدمات اللي اتحفظت من صفحة الإعدادات في الموقع الحقيقي (التوليد والأصوات والنشر)، من غير الدفع
python3 - "$ROOT/data/studiomania.db" "$SR/data/studiomania.db" <<'PY'
import sqlite3, sys
src, dst = sys.argv[1], sys.argv[2]
try:
    rows = sqlite3.connect(src).execute("SELECT key, value FROM settings WHERE key LIKE 'key:%'").fetchall()
except sqlite3.Error:
    rows = []
rows = [(k, v) for k, v in rows if not any(p in k.upper() for p in ("PAYPAL", "STRIPE", "TAP_"))]
c = sqlite3.connect(dst)
c.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
c.executemany("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", rows)
c.commit()
print(f"✓ {len(rows)} مفتاح اتنسخ")
PY

echo "== 3) سكريبتات التحديث"
cat > "$SR/update.sh" <<EOF
#!/usr/bin/env bash
# التجريبي: أحدث كود من الفرع ← بناء ← تشغيل على $SPORT
set -euo pipefail
git -C "$SR/src" fetch -q --depth 1 origin "$BRANCH" && git -C "$SR/src" reset -q --hard FETCH_HEAD
docker build -q -t simsimkit-staging "$SR/src/studiomania" >/dev/null
docker rm -f simsimkit-staging 2>/dev/null || true
docker run -d --name simsimkit-staging --restart unless-stopped --network host \\
  --env-file "$SR/app.env" -e PORT=$SPORT -e STUDIOMANIA_DATA=/data -v "$SR/data:/data" simsimkit-staging >/dev/null
for i in \$(seq 1 60); do curl -fs http://127.0.0.1:$SPORT/health >/dev/null && { echo "✓ التجريبي شغّال: \$(git -C "$SR/src" rev-parse --short HEAD)"; exit 0; }; sleep 3; done
echo "⚠️ التجريبي مقامش: docker logs --tail 100 simsimkit-staging"; exit 1
EOF
cat > "$SR/autoupdate.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec 9>"$SR/.update.lock"; flock -n 9 || exit 0
git -C "$SR/src" fetch -q --depth 1 origin "$BRANCH"
[ "\$(git -C "$SR/src" rev-parse HEAD)" = "\$(git -C "$SR/src" rev-parse FETCH_HEAD)" ] && exit 0
"$SR/update.sh" >> "$SR/update.log" 2>&1
EOF
chmod 700 "$SR/update.sh" "$SR/autoupdate.sh"
echo "*/5 * * * * root $SR/autoupdate.sh" > /etc/cron.d/simsimkit-staging

echo "== 4) الموقع الحقيقي يتثبّت على نسخته الحالية"
git -C "$ROOT/src" rev-parse HEAD > "$ROOT/release"
cat > "$ROOT/update.sh" <<'EOF'
#!/usr/bin/env bash
# تحديث الموقع الحقيقي: النسخة المكتوبة في release (اللي الوكالة وافقت عليها) ← بناء ← تشغيل من غير ما البيانات تتلمس
set -euo pipefail
ROOT=/srv/simsimkit
BRANCH="${BRANCH:-claude/new-program-gvemu5}"
REF="$(cat "$ROOT/release" 2>/dev/null || echo "$BRANCH")"
git -C "$ROOT/src" fetch --depth 1 origin "$REF" && git -C "$ROOT/src" reset --hard FETCH_HEAD
docker build -t simsimkit "$ROOT/src/studiomania"
docker rm -f simsimkit 2>/dev/null || true
docker run -d --name simsimkit --restart unless-stopped --network host \
  --env-file "$ROOT/app.env" -e PORT=8000 -e STUDIOMANIA_DATA=/data -v "$ROOT/data:/data" simsimkit
for i in $(seq 1 60); do curl -fs http://127.0.0.1:8000/health >/dev/null && { echo "✓ البرنامج شغّال"; exit 0; }; sleep 3; done
echo "⚠️ البرنامج مقامش، شوف: docker logs --tail 100 simsimkit"; exit 1
EOF
chmod 700 "$ROOT/update.sh"
rm -f /etc/cron.d/simsimkit   # مفيش تحديث لوحده للموقع الحقيقي
cat > "$ROOT/promote.sh" <<EOF
#!/usr/bin/env bash
# ✅ الموقع الحقيقي ياخد نفس النسخة اللي في التجريبي بالظبط (بعد موافقة الوكالة)
set -euo pipefail
git -C "$SR/src" rev-parse HEAD > "$ROOT/release"
echo "النسخة: \$(cut -c1-7 "$ROOT/release")"
"$ROOT/update.sh"
EOF
chmod 700 "$ROOT/promote.sh"

echo "== 5) العنوان (HTTPS)"
if ! grep -q "^$SD {" "$ROOT/caddy/Caddyfile"; then
  cat >> "$ROOT/caddy/Caddyfile" <<EOF

$SD {
  encode gzip
  request_body {
    max_size 2GB
  }
  reverse_proxy 127.0.0.1:$SPORT {
    transport http {
      read_timeout 30m
      write_timeout 30m
    }
  }
}
EOF
fi
docker restart caddy >/dev/null

echo "== 6) بناء وتشغيل التجريبي (أول مرة حوالي ١٠ دقايق)"
"$SR/update.sh"
echo
echo "خلصنا:"
echo "  • التجريبي: https://$SD (أول مرة: اعمل حساب الأدمن، وبعده حساب عميل عادي للوكالة)"
echo "  • الموقع الحقيقي ثابت على: $(cut -c1-7 "$ROOT/release")"
echo "  • بعد موافقة الوكالة: sudo $ROOT/promote.sh"
