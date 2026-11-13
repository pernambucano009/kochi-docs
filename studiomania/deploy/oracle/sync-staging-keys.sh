#!/usr/bin/env bash
# 🔑 مفاتيح الخدمات من الموقع الحقيقي للتجريبي تاني (من غير مفاتيح الدفع)، وبعدين إعادة تشغيل التجريبي:
#   curl -fsSL https://raw.githubusercontent.com/pernambucano009/kochi-docs/claude/new-program-gvemu5/studiomania/deploy/oracle/sync-staging-keys.sh | sudo bash
# لازم لما مفتاح يتضاف للموقع الحقيقي بعد ما التجريبي اتركّب (زي مفتاح OpenAI بتاع مكالمة نورة/سعاد).
# مابيطبعش أي مفتاح: بيطبع أسماءها بس.
set -euo pipefail
ROOT=/srv/simsimkit
SR=/srv/simsimkit-staging
[ -f "$ROOT/app.env" ] && [ -d "$SR/data" ] || { echo "⚠️ الموقع الحقيقي أو التجريبي مش متركّب"; exit 1; }
SD="$(grep -m1 '^PUBLIC_URL=' "$SR/app.env" | cut -d= -f2-)"
grep -v -E '^(PUBLIC_URL|PAYPAL_[A-Z_]*|STRIPE_[A-Z_]*|TAP_[A-Z_]*)=' "$ROOT/app.env" > "$SR/app.env.new" || true
echo "PUBLIC_URL=${SD:-https://staging.simsimkit.com}" >> "$SR/app.env.new"
echo "STAGING=1" >> "$SR/app.env.new"
grep -E '^(SKIP_EMAIL_VERIFY)=' "$SR/app.env" >> "$SR/app.env.new" 2>/dev/null || true
mv "$SR/app.env.new" "$SR/app.env"; chmod 600 "$SR/app.env"
echo "== مفاتيح الملف:"; grep -oE '^[A-Z0-9_]+=' "$SR/app.env" | tr -d '=' | tr '\n' ' '; echo
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
c.executemany("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", rows)
c.commit()
print("== مفاتيح صفحة الإعدادات:", " ".join(k[4:] for k, _ in rows) or "مفيش")
PY
HAS=$(python3 -c "import sqlite3,sys; print(sqlite3.connect(sys.argv[1]).execute(\"SELECT count(*) FROM settings WHERE key='key:OPENAI_API_KEY' AND value<>''\").fetchone()[0])" "$SR/data/studiomania.db" 2>/dev/null || echo 0)
echo "OpenAI (مكالمة نورة): $( { grep -q '^OPENAI_API_KEY=.\+' "$SR/app.env" || [ "$HAS" != 0 ]; } && echo موجود || echo '⚠️ مش موجود')"
docker rm -f simsimkit-staging >/dev/null 2>&1 || true
docker run -d --name simsimkit-staging --restart unless-stopped --network host \
  --env-file "$SR/app.env" -e PORT=8100 -e STUDIOMANIA_DATA=/data -v "$SR/data:/data" simsimkit-staging >/dev/null
for i in $(seq 1 60); do curl -fs http://127.0.0.1:8100/health >/dev/null && { echo "✓ التجريبي شغّال بالمفاتيح الجديدة"; exit 0; }; sleep 3; done
echo "⚠️ التجريبي مقامش: docker logs --tail 50 simsimkit-staging"; exit 1
