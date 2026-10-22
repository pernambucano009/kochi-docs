#!/usr/bin/env bash
# 🌐 ربط الدومين (simsimkit.com + www) بالسيرفر، والعنوان القديم (sslip.io) بيحوّل عليه.
# الاستخدام (على السيرفر، بعد ما الدومين يشاور على IP السيرفر):
#   curl -fsSL https://raw.githubusercontent.com/pernambucano009/kochi-docs/claude/new-program-gvemu5/studiomania/deploy/oracle/set-domain.sh | sudo bash -s simsimkit.com
# بيتأكد الأول إن الدومين واصل للسيرفر ده، وإلا مابيغيرش حاجة (عشان شهادة HTTPS ماتفشلش والموقع مايقعش).
set -euo pipefail
ROOT=/srv/simsimkit
D="${1:-simsimkit.com}"
D="${D#https://}"; D="${D#http://}"; D="${D#www.}"; D="${D%%/*}"
[ "$(id -u)" = 0 ] || { echo "شغّله بـ sudo"; exit 1; }
[ -f "$ROOT/caddy/Caddyfile" ] || { echo "مالقيتش تركيب SimsimKit في $ROOT"; exit 1; }

IP="$(curl -fs --max-time 10 https://api.ipify.org || curl -fs --max-time 10 https://ifconfig.me)"
OLD="${IP//./-}.sslip.io"
ok=1
for h in "$D" "www.$D"; do
  got="$(getent ahostsv4 "$h" | awk '{print $1; exit}' || true)"
  if [ "$got" = "$IP" ]; then echo "✓ $h ← $IP"; else echo "✗ $h بيشاور على «${got:-ولا حاجة}» مش $IP"; ok=0; fi
done
[ "$ok" = 1 ] || { echo "اعمل في لوحة الدومين سجلين A: @ و www ← $IP، واستنى شوية (ممكن لحد ساعة) وشغّل الأمر تاني. ماتغيرش حاجة."; exit 1; }

cp "$ROOT/caddy/Caddyfile" "$ROOT/caddy/Caddyfile.bak-$(date +%Y%m%d-%H%M%S)"
cat > "$ROOT/caddy/Caddyfile" <<EOF
$D {
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

www.$D, $OLD {
  redir https://$D{uri} permanent
}
EOF
if grep -q '^PUBLIC_URL=' "$ROOT/app.env"; then
  sed -i "s#^PUBLIC_URL=.*#PUBLIC_URL=https://$D#" "$ROOT/app.env"
else
  echo "PUBLIC_URL=https://$D" >> "$ROOT/app.env"
fi
"$ROOT/update.sh"
echo "✓ الموقع بقى https://$D (و www والعنوان القديم بيحوّلوا عليه)"
echo "  لو بتستخدم تسجيل الدخول بجوجل: زوّد https://$D/auth/google/callback (وللنسخ الاحتياطي https://$D/auth/drive/callback) في إعدادات Google OAuth."
