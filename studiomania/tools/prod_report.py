"""تقرير للقراءة فقط من سيرفر الإنتاج: الحسابات، ومين دخل إمتى، والمنشورات اللي كل عميل جدولها وعلى أنهي حسابات.
مابيكتبش أي حاجة (كل القواعد بتتفتح read-only)، ومابيطبعش كلمات سر ولا مفاتيح.

التشغيل من Cloud Shell (سطر واحد):
  curl -s https://raw.githubusercontent.com/pernambucano009/kochi-docs/claude/new-program-gvemu5/studiomania/tools/prod_report.py \
    | ssh -i ~/key.key ubuntu@158.101.253.189 'sudo python3 - /srv/simsimkit/data'
"""
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

DATA = Path(sys.argv[1] if len(sys.argv) > 1 else "/srv/simsimkit/data")
PDB = DATA / "_platform" / "platform.db"


def ro(p: Path) -> sqlite3.Connection:
    c = sqlite3.connect(f"file:{p}?mode=ro", uri=True)
    c.row_factory = sqlite3.Row
    return c


def ts(t) -> str:
    return datetime.fromtimestamp(float(t)).strftime("%Y-%m-%d %H:%M") if t else "-"


def cols(c: sqlite3.Connection, table: str) -> set[str]:
    return {r[1] for r in c.execute(f"PRAGMA table_info({table})")}


with ro(PDB) as c:
    users = c.execute("SELECT email, role, workspace, verified, created_at, last_login FROM users ORDER BY created_at").fetchall()
print(f"== الحسابات ({len(users)}) ==")
print("الإيميل | الدور | مساحة العمل | مفعّل | اتسجّل | آخر دخول")
for u in users:
    print(f"{u['email']} | {u['role']} | {u['workspace']} | {'نعم' if u['verified'] else 'لا'} | {ts(u['created_at'])} | {ts(u['last_login'])}")

print("\n== المنشورات في كل مساحة عمل ==")
spaces = {u["workspace"] for u in users} | {"owner"}
for wid in sorted(spaces):
    db = (DATA if wid == "owner" else DATA / "_platform" / "tenants" / wid) / "studiomania.db"
    if not db.exists():
        print(f"[{wid}] مافيش قاعدة بيانات (ماعملش حاجة)")
        continue
    with ro(db) as c:
        if "posts" not in {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}:
            print(f"[{wid}] مافيش منشورات")
            continue
        extra = ", options" if "options" in cols(c, "posts") else ""
        rows = c.execute(f"SELECT created_at, scheduled_at, status, platforms{extra} FROM posts ORDER BY created_at").fetchall()
    print(f"[{wid}] {len(rows)} منشور")
    if wid != "owner":   # منشورات العملاء بالتفصيل: على أنهي منصات وحسابات اتجدولت
        for r in rows:
            print(f"   {r['created_at'][:16]} → {r['scheduled_at'][:16]} | {r['status']} | {r['platforms'][:160]}" + (f" | {str(r['options'])[:160]}" if extra else ""))
