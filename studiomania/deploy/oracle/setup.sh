#!/usr/bin/env bash
# 🛫 تركيب SimsimKit على سيرفر Oracle (Ubuntu 22.04/24.04، بيشتغل على AMD أو ARM).
# الاستخدام (على السيرفر):  curl -fsSL https://raw.githubusercontent.com/pernambucano009/kochi-docs/claude/new-program-gvemu5/studiomania/deploy/oracle/setup.sh | sudo bash
#   من غير دومين: البرنامج بيشتغل على عنوان مؤقت ببلاش من الـ IP (<ip>.sslip.io) بشهادة HTTPS حقيقية.
#   الدومين بعدين بأمر واحد: sudo /srv/simsimkit/domain.sh app.example.com
#
# بيعمل: Docker ← نسخة من الكود ← يبني البرنامج ← يشغّله على 127.0.0.1:8000 ← Caddy قدامه بشهادة HTTPS لوحدها.
# البيانات في /srv/simsimkit/data (برّه الحاوية، مابتضيعش مع التحديث).
# المفاتيح في /srv/simsimkit/app.env (صلاحية root بس). الملف بيتعمل فاضي، وانت بتملاه بإيدك على السيرفر، مش في الشات.
# التحديث بعد كده: sudo /srv/simsimkit/update.sh
set -euo pipefail

DOMAIN="${1:-}"
BRANCH="${BRANCH:-claude/new-program-gvemu5}"
REPO="${REPO:-https://github.com/pernambucano009/kochi-docs.git}"
ROOT=/srv/simsimkit
[ "$(id -u)" = 0 ] || { echo "شغّله بـ sudo"; exit 1; }
if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "auto" ]; then   # عنوان مؤقت من الـ IP العام لحد ما الدومين يتنقل
  IP="$(curl -fs --max-time 10 https://api.ipify.org || curl -fs --max-time 10 https://ifconfig.me)"
  [ -n "$IP" ] || { echo "مقدرتش أعرف الـ IP العام"; exit 1; }
  DOMAIN="${IP//./-}.sslip.io"
fi
echo "العنوان: https://$DOMAIN"

echo "== 1) Docker"
if ! command -v docker >/dev/null; then
  apt-get update -y
  apt-get install -y ca-certificates curl git
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "== 2) الجدار الناري: 80 و443 مفتوحين (صور Oracle بتقفلهم في iptables)"
if command -v iptables >/dev/null; then
  for p in 80 443; do
    iptables -C INPUT -p tcp --dport $p -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport $p -j ACCEPT   # أول قاعدة، قبل الـ REJECT بتاعة Oracle
  done
  command -v netfilter-persistent >/dev/null && netfilter-persistent save || true
fi

echo "== 3) الكود"
mkdir -p "$ROOT/data" "$ROOT/caddy"
if [ -d "$ROOT/src/.git" ]; then
  git -C "$ROOT/src" fetch --depth 1 origin "$BRANCH" && git -C "$ROOT/src" reset --hard FETCH_HEAD
else
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$ROOT/src"
fi

echo "== 4) ملف المفاتيح"
if [ ! -f "$ROOT/app.env" ]; then
  cat > "$ROOT/app.env" <<EOF
# حط المفاتيح الجديدة هنا (سطر لكل مفتاح: NAME=value). متحطش المفاتيح القديمة اللي كانت على Railway.
PUBLIC_URL=https://$DOMAIN
GATEWAY_SECRET=$(head -c 32 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c 40)
EOF
fi
chmod 600 "$ROOT/app.env"

echo "== 5) Caddy (HTTPS)"
cat > "$ROOT/caddy/Caddyfile" <<EOF
$DOMAIN {
  encode gzip
  request_body {
    max_size 2GB
  }
  reverse_proxy 127.0.0.1:8000 {
    transport http {
      read_timeout 30m
      write_timeout 30m
    }
  }
}
EOF

cat > "$ROOT/update.sh" <<'EOF'
#!/usr/bin/env bash
# تحديث: أحدث كود من الفرع ← بناء ← تشغيل من غير ما البيانات تتلمس
set -euo pipefail
ROOT=/srv/simsimkit
BRANCH="${BRANCH:-claude/new-program-gvemu5}"
git -C "$ROOT/src" fetch --depth 1 origin "$BRANCH" && git -C "$ROOT/src" reset --hard FETCH_HEAD
docker build -t simsimkit "$ROOT/src/studiomania"
docker rm -f simsimkit 2>/dev/null || true
docker run -d --name simsimkit --restart unless-stopped --network host \
  --env-file "$ROOT/app.env" -e PORT=8000 -e STUDIOMANIA_DATA=/data -v "$ROOT/data:/data" simsimkit
docker rm -f caddy 2>/dev/null || true
docker run -d --name caddy --restart unless-stopped --network host \
  -v "$ROOT/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" -v "$ROOT/caddy/data:/data" -v "$ROOT/caddy/config:/config" caddy:2
for i in $(seq 1 60); do curl -fs http://127.0.0.1:8000/health >/dev/null && { echo "✓ البرنامج شغّال"; exit 0; }; sleep 3; done
echo "⚠️ البرنامج مقامش، شوف: docker logs --tail 100 simsimkit"; exit 1
EOF
chmod 700 "$ROOT/update.sh"

cat > "$ROOT/domain.sh" <<'EOF'
#!/usr/bin/env bash
# تغيير عنوان الموقع: sudo /srv/simsimkit/domain.sh app.example.com (بعد ما الدومين يشاور على IP السيرفر)
set -euo pipefail
ROOT=/srv/simsimkit
D="${1:?اكتب الدومين}"
sed -i "1s/.*/$D {/" "$ROOT/caddy/Caddyfile"
sed -i "s#^PUBLIC_URL=.*#PUBLIC_URL=https://$D#" "$ROOT/app.env"
"$ROOT/update.sh"
echo "✓ العنوان بقى https://$D"
EOF
chmod 700 "$ROOT/domain.sh"

# 🔄 تحديث لوحده: كل ٥ دقايق بيشوف لو فيه كود جديد على الفرع، ولو فيه بيبني ويشغّل (من غير ما حد يفتح السيرفر)
cat > "$ROOT/autoupdate.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/simsimkit
BRANCH="${BRANCH:-claude/new-program-gvemu5}"
exec 9>"$ROOT/.update.lock"; flock -n 9 || exit 0
git -C "$ROOT/src" fetch -q --depth 1 origin "$BRANCH"
[ "$(git -C "$ROOT/src" rev-parse HEAD)" = "$(git -C "$ROOT/src" rev-parse FETCH_HEAD)" ] && exit 0
"$ROOT/update.sh" >> "$ROOT/update.log" 2>&1
EOF
chmod 700 "$ROOT/autoupdate.sh"
echo "*/5 * * * * root $ROOT/autoupdate.sh" > /etc/cron.d/simsimkit

echo "== 6) بناء وتشغيل (أول مرة بتاخد حوالي ١٠ دقايق)"
"$ROOT/update.sh"
echo
echo "خلصنا. الخطوات الجاية:"
echo "  1) sudo nano $ROOT/app.env   ← حط المفاتيح الجديدة، وبعدين: sudo $ROOT/update.sh"
echo "  2) العنوان دلوقتي: https://$DOMAIN — ولما الدومين يشاور على IP السيرفر: sudo $ROOT/domain.sh <الدومين>"
echo "  3) البيانات القديمة تتحط في $ROOT/data (وبعدين update.sh)"
