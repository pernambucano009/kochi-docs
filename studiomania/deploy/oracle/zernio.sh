#!/usr/bin/env bash
# 🔗 حالة خدمة النشر (Zernio): البروفايلات، وكل الحسابات المربوطة وعددها، والخطة/الحد لو الخدمة بترجعه. بيقرا بس:
#   curl -fsSL https://raw.githubusercontent.com/pernambucano009/kochi-docs/claude/new-program-gvemu5/studiomania/deploy/oracle/zernio.sh | sudo bash
set -uo pipefail
docker exec -i simsimkit sh -c 'cd /app/backend && python3 -' <<'PY'
import json, os, sqlite3, pathlib
# المفتاح ممكن يكون في إعدادات صاحب البرنامج (قاعدة بيانات مساحته) مش في متغيرات السيرفر، زي ما البوابة بتديه للنسخ
data = pathlib.Path(os.environ.get("STUDIOMANIA_DATA") or "/app/data")
for db in (data / "studiomania.db",):
    try:
        with sqlite3.connect(db) as c0:
            for k, v in c0.execute("SELECT key, value FROM settings WHERE key LIKE 'key:%'"):
                os.environ.setdefault(k[4:], v)
    except sqlite3.Error as e:
        print("settings db:", e)
import publisher
print("key source:", "env/settings" if publisher.api_key() else "MISSING")
c = publisher._client(30)
def show(path):
    try:
        r = c.get(publisher.BASE_URL + path)
        print(f"== {path}: HTTP {r.status_code}")
        try:
            d = r.json()
        except ValueError:
            print(r.text[:600]); return None
        return d
    except Exception as e:
        print(f"== {path}: {e}"); return None
p = show("/profiles") or {}
items = p.get("profiles", p.get("data", [])) if isinstance(p, dict) else p
print(f"profiles: {len(items or [])}")
for x in (items or [])[:30]:
    print("  ", x.get("_id") or x.get("id"), x.get("name"))
a = show("/accounts") or {}
acc = a.get("accounts", a.get("data", [])) if isinstance(a, dict) else a
print(f"connected accounts (all profiles): {len(acc or [])}")
for x in (acc or [])[:40]:
    prof = x.get("profileId")
    if isinstance(prof, dict): prof = prof.get("_id") or prof.get("name")
    print("  ", x.get("platform"), "|", x.get("username") or x.get("displayName") or x.get("name"), "| profile:", prof, "| active:", x.get("isActive"))
for path in ("/usage", "/usage-stats", "/billing", "/me", "/user", "/account"):
    d = show(path)
    if d is not None:
        print(json.dumps(d, ensure_ascii=False)[:800])
PY
