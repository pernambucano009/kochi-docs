#!/usr/bin/env bash
# 🔑 يحط مفتاح خدمة في الموقع الحقيقي (/srv/simsimkit/app.env) من غير ما يظهر على الشاشة ولا يتكتب في أي شات:
#   ssh -t -i "$HOME\.ssh\simsimkit.key" ubuntu@158.101.253.189 "curl -fsSL https://raw.githubusercontent.com/pernambucano009/kochi-docs/claude/new-program-gvemu5/studiomania/deploy/oracle/setkey.sh -o /tmp/setkey.sh && sudo bash /tmp/setkey.sh AUTHENTICA_API_KEY"
# - لو المفتاح موجود قبل كده بيتبدّل، ونسخة من الملف القديم بتتحفظ جنبه (app.env.bak).
# - بعدها البرنامج بيقوم تاني بالمفتاح (update.sh).
set -euo pipefail
ROOT=/srv/simsimkit
NAME="${1:-}"
[[ "$NAME" =~ ^[A-Z][A-Z0-9_]{2,60}$ ]] || { echo "⚠️ اكتب اسم المفتاح بعد الأمر، مثلًا: AUTHENTICA_API_KEY"; exit 1; }
[ -f "$ROOT/app.env" ] || { echo "⚠️ الموقع الحقيقي مش متركّب على السيرفر ده"; exit 1; }

read -rs -p "الصق المفتاح ودوس Enter (مش هيظهر وانت بتلصقه): " K < /dev/tty; echo
K="$(printf '%s' "$K" | tr -d '\r\n' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
[ -n "$K" ] || { echo "⚠️ مفيش مفتاح اتلصق. جرّب تاني"; exit 1; }

# 📱 مفتاح رسائل الدخول: نتأكد إن Authentica قابلاه قبل ما نحفظه (من غير إرسال أي رسالة)
if [ "$NAME" = "AUTHENTICA_API_KEY" ]; then
  R="$(curl -s -m 20 -w ' HTTP%{http_code}' -H "X-Authorization: $K" -H 'Accept: application/json' https://api.authentica.sa/api/v2/balance || true)"
  case "$R" in
    *HTTP200) echo "✓ Authentica قابلين المفتاح. الرصيد: $(printf '%s' "${R% HTTP200}" | grep -o '"balance":[^,}]*' | cut -d: -f2)";;
    *HTTP401*|*HTTP403*) echo "⚠️ Authentica رفضوا المفتاح ده (غلط أو اتلغى). اعمل مفتاح جديد من بوابتهم وجرّب تاني. ماحفظتش حاجة"; exit 1;;
    *) echo "⚠️ ماقدرتش أتأكد من المفتاح (${R##* }). هحفظه وجرّب الدخول";;
  esac
fi

cp -p "$ROOT/app.env" "$ROOT/app.env.bak"
grep -v "^$NAME=" "$ROOT/app.env.bak" > "$ROOT/app.env" || true
printf '%s=%s\n' "$NAME" "$K" >> "$ROOT/app.env"
chmod 600 "$ROOT/app.env" "$ROOT/app.env.bak"
unset K

echo "== البرنامج بيقوم تاني بالمفتاح الجديد…"
"$ROOT/update.sh" >/dev/null 2>&1 || { echo "⚠️ البرنامج ماقامش. رجعنا الملف القديم"; cp -p "$ROOT/app.env.bak" "$ROOT/app.env"; "$ROOT/update.sh" >/dev/null 2>&1 || true; exit 1; }
if [ "$(docker exec simsimkit printenv "$NAME" 2>/dev/null | wc -c)" -gt 1 ]; then
  echo "✓ تم: المفتاح $NAME اتحط والبرنامج شغّال بيه"
else
  echo "⚠️ البرنامج قام بس مش شايف المفتاح. ابعت الرسالة دي"
fi
