#!/usr/bin/env bash
# 🚚 نقل كل البيانات من Railway لسيرفر Oracle: الحسابات والعملاء والمشاريع والفيديوهات (كل /data).
# الاستخدام (على سيرفر Oracle):  curl -fsSL https://raw.githubusercontent.com/pernambucano009/kochi-docs/claude/new-program-gvemu5/studiomania/deploy/oracle/from-railway.sh -o /tmp/mig.sh && sudo bash /tmp/mig.sh   (مش | bash: الدخول والاختيار محتاجين الكيبورد)
#
# بيعمل: أداة Railway ← دخول (بتفتح لينك وتوافق) ← تختار المشروع والخدمة ← بيسحب نسخة مضغوطة من /data
# (قواعد البيانات بنسخة سليمة وهي شغالة) ← بيوقف البرنامج ← يحط البيانات مكان الفاضية (والفاضية بتتحفظ جنبها) ← يشغّل.
# البيانات بتمشي من Railway للسيرفر على طول، مش بتعدّي على أي خدمة تالتة.
set -euo pipefail
ROOT=/srv/simsimkit
WORK="$ROOT/migrate"
[ "$(id -u)" = 0 ] || { echo "شغّله بـ sudo"; exit 1; }
mkdir -p "$WORK"
cd "$WORK"

echo "== 1) أداة Railway"
if ! command -v railway >/dev/null; then
  bash <(curl -fsSL https://railway.com/install.sh) -y >/dev/null 2>&1 || bash <(curl -fsSL https://railway.com/install.sh)
fi
export PATH="$HOME/.railway/bin:/usr/local/bin:$PATH"
railway --version

echo "== 2) الدخول: افتح اللينك اللي هيظهر، وادخل بحساب Railway، واكتب الكود"
railway whoami >/dev/null 2>&1 || railway login --browserless

echo "== 3) اختار المشروع والخدمة اللي فيها البرنامج (بالأسهم وEnter)"
railway status >/dev/null 2>&1 || railway link

# الدخول على Railway بالـ ssh محتاج مفتاح على السيرفر ده (بيتعمل مرة واحدة، ولو Railway سأل يضيفه اختار Yes)
[ -f "$HOME/.ssh/id_ed25519" ] || { mkdir -p "$HOME/.ssh"; ssh-keygen -q -t ed25519 -N "" -f "$HOME/.ssh/id_ed25519" -C "simsimkit-oracle"; }
railway ssh keys add 2>/dev/null || true

echo "== 4) المتغيرات: الإعدادات العادية بتتنقل، والمفاتيح لأ (اتكشفت في اختراق Railway ولازم تتغير)"
NEW="$WORK/vars.env"
railway variables --kv 2>/dev/null | tr -d '\r' > "$WORK/railway.env" || true
chmod 600 "$WORK/railway.env"
: > "$NEW"; SKIPPED=""
while IFS= read -r line; do
  k="${line%%=*}"
  case "$k" in ''|RAILWAY_*|PORT|STUDIOMANIA_DATA|PUBLIC_URL|GATEWAY_SECRET) continue ;; esac
  if printf '%s' "$k" | grep -Eq 'KEY|SECRET|TOKEN|PASS|PASSWORD|WEBHOOK'; then SKIPPED="$SKIPPED $k"; continue; fi
  grep -q "^$k=" "$ROOT/app.env" || echo "$line" >> "$NEW"
done < "$WORK/railway.env"
cat "$NEW" >> "$ROOT/app.env"
shred -u "$WORK/railway.env" 2>/dev/null || rm -f "$WORK/railway.env"
echo "✓ اتنقلت الإعدادات: $(cut -d= -f1 "$NEW" | tr '\n' ' ')"
echo "⚠️ المفاتيح دي ماتنقلتش، حط الجديدة بتاعتها من الإعدادات ← المفاتيح والرصيد:$SKIPPED"
[ -s "$NEW" ] && "$ROOT/update.sh" >/dev/null
rm -f "$NEW"

echo "== 5) بيسحب البيانات (ممكن ياخد وقت على حسب حجم الفيديوهات)"
# سكريبت صغير بيشتغل جوه Railway: نسخة سليمة من كل قاعدة بيانات + كل الملفات ← tar.gz ← base64 بين علامتين
PY=$(cat <<'EOF'
import base64, io, os, sqlite3, sys, tarfile, tempfile
root = os.environ.get("STUDIOMANIA_DATA") or "/data"
skip = {"tmp"}
out = sys.stdout
out.write("-----SIMSIM-BEGIN-----\n"); out.flush()
class B64:
    def __init__(s): s.buf = b""
    def write(s, b):
        s.buf += b
        n = len(s.buf) // 57 * 57
        if n:
            out.write(base64.encodebytes(s.buf[:n]).decode()); s.buf = s.buf[n:]
        return len(b)
    def flush(s): pass
    def close(s):
        if s.buf: out.write(base64.encodebytes(s.buf).decode())
w = B64()
with tempfile.TemporaryDirectory() as tmp, tarfile.open(fileobj=w, mode="w|gz") as tar:
    for dp, dns, fns in os.walk(root):
        rel = os.path.relpath(dp, root)
        dns[:] = [d for d in dns if not (rel == "." and d in skip)]
        for fn in fns:
            p = os.path.join(dp, fn)
            arc = os.path.normpath(os.path.join(rel, fn))
            if fn.endswith((".db-wal", ".db-shm", ".db-journal")):
                continue
            if fn.endswith(".db"):
                snap = os.path.join(tmp, "snap.db")
                try:
                    with sqlite3.connect(p) as s, sqlite3.connect(snap) as d:
                        s.backup(d)
                    tar.add(snap, arcname=arc); os.unlink(snap); continue
                except sqlite3.Error:
                    pass
            try:
                tar.add(p, arcname=arc, recursive=False)
            except OSError:
                pass
w.close()
out.write("-----SIMSIM-END-----\n"); out.flush()
EOF
)
B64=$(printf '%s' "$PY" | base64 -w0)
RW=railway
# النسخ الجديدة من الأداة بتدخل بـ ssh على port 22، ولو مقفول بنجرّب نسخة 4 اللي بتدخل من 443 (websocket)
if ! timeout 8 bash -c '</dev/tcp/ssh.railway.com/22' 2>/dev/null; then
  echo "port 22 مقفول، بنجرّب أداة Railway نسخة 4 (من غير ssh)"
  ARCH=$(uname -m); [ "$ARCH" = "arm64" ] && ARCH=aarch64
  URL=$(curl -fsSL "https://api.github.com/repos/railwayapp/cli/releases?per_page=100" | python3 -c "
import json,sys
for r in json.load(sys.stdin):
    if not r['tag_name'].lstrip('v').startswith('4.'): continue
    for a in r['assets']:
        n=a['name']
        if '$ARCH' in n and 'linux' in n and n.endswith('.tar.gz'): print(a['browser_download_url']); sys.exit()
")
  [ -n "$URL" ] || { echo "مالقيتش نسخة 4"; exit 1; }
  mkdir -p "$WORK/rw4" && curl -fsSL "$URL" | tar xz -C "$WORK/rw4"
  RW=$(find "$WORK/rw4" -type f -name railway | head -1); chmod +x "$RW"
  "$RW" --version
fi
"$RW" ssh -- sh -c "echo $B64 | base64 -d | python3 -" > raw.txt || true
sed -n '/-----SIMSIM-BEGIN-----/,/-----SIMSIM-END-----/p' raw.txt | sed '1d;$d' | tr -d '\r' | base64 -d > data.tgz
grep -q -- "-----SIMSIM-END-----" raw.txt || { echo "⚠️ النقل ماكملش، شغّل الأمر تاني"; exit 1; }
gzip -t data.tgz && tar tzf data.tgz >/dev/null
echo "✓ اتسحب $(du -h data.tgz | cut -f1)"
rm -f raw.txt

echo "== 6) بيحط البيانات مكانها"
docker stop simsimkit >/dev/null 2>&1 || true
STAMP=$(date +%Y%m%d-%H%M%S)
[ -d "$ROOT/data" ] && mv "$ROOT/data" "$ROOT/data.before-$STAMP"
mkdir -p "$ROOT/data"
tar xzf data.tgz -C "$ROOT/data"
"$ROOT/update.sh"
echo
echo "✓ خلصنا: البيانات القديمة كلها على Oracle. ادخل بحسابك القديم (اللي كان على Railway)."
echo "  النسخة الفاضية القديمة اتحفظت في $ROOT/data.before-$STAMP، والملف المضغوط في $WORK/data.tgz (امسحهم بعد ما تتأكد)."
