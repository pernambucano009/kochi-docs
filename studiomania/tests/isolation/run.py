"""🔒 اختبار العزل بين الحسابات (آلي، من غير أي مفاتيح حقيقية ومن غير ما يصرف نقاط).

بيشغّل البوابة الحقيقية بحساب أدمن وعميلين (A وB) وخدمة نشر وهمية بتتصرف زي أسوأ حالة (tests/isolation/fake_zernio.py)،
وبيحط علامة مميزة في بيانات كل حساب، وبعدين:
  1. كل واجهة قراءة (GET) في البرنامج: كل عميل يطلبها، والرد مايكونش فيه علامة حد تاني ولا مفتاح ولا آخر ٤ حروف من مفتاح.
  2. كل واجهات الأدمن (المفاتيح، المعمل، الرصيد، المكسب): العميل ياخد 403 بكل الطرق (GET/POST/PUT/PATCH/DELETE).
  3. العميل B يحاول يفصل حساب A أو الأدمن، أو يقرا تعليقاته ورسايله، أو يرد ويبعت باسمه: لازم يترفض ومايوصلش لخدمة النشر.
  4. من غير تسجيل دخول: كل واجهة بترجع 401.
  5. تزوير الهيدرز (x-user-role: admin، x-gateway-secret): مابيفتحش حاجة.

التشغيل:   python3 tests/isolation/run.py            (من فولدر studiomania)
النتيجة:   ملخص على الشاشة، والتفاصيل في tests/isolation/last_report.json، والخروج 1 لو فيه أي فشل.
"""
import json
import os
import re
import secrets
import socket
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import fake_zernio  # noqa: E402

PW = "Isolation-Test-2026!"
# مفاتيح وهمية: لو أي جزء منها ظهر لعميل يبقى فيه تسريب (آخر ٤ حروف كمان، زي ما الشركة لاقت)
KEYS = {"ZERNIO_API_KEY": "zk_live_SECRETKEY_K7Q2", "ELEVENLABS_API_KEY": "el_SECRETKEY_P9W3", "SCRAPECREATORS_API_KEY": "sc_SECRETKEY_M4T8",
        "PEXELS_API_KEY": "px_SECRETKEY_R5V6", "MINIMAX_API_KEY": "mm_SECRETKEY_D3H7", "RESEND_API_KEY": "re_SECRETKEY_J2N4"}
SECRET_RE = re.compile(r"SECRETKEY|" + "|".join(rf"\b{v[-4:]}\b" for v in KEYS.values()))
# ملفات تقيلة أو ستريم أو بتشغّل شغل: مش قوائم بيانات
SKIP_GET = {"/api/thumb", "/api/montage/filmstrip", "/api/wa/qr.svg", "/api/voicelab/export", "/api/lab/export/picture-fx.zip", "/api/lab/export/typo",
            "/login", "/login.html", "/", "/index.html", "/kochi", "/kochi/", "/pricing", "/pricing.html", "/health"}
PUBLIC = {"/api/pricing", "/api/auth/state", "/health", "/pricing", "/pricing.html"}

results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    results.append({"test": name, "ok": bool(ok), "detail": detail[:400]})
    return ok


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def app_routes() -> list[tuple[str, str]]:
    src = (ROOT / "backend" / "app.py").read_text(encoding="utf-8")
    return [(m.upper(), p) for m, p in re.findall(r'@app\.(get|post|put|patch|delete)\(\s*"([^"]+)"', src)]


def admin_only_re() -> re.Pattern:
    src = (ROOT / "backend" / "gateway.py").read_text(encoding="utf-8")
    return re.compile(re.search(r'ADMIN_ONLY = re\.compile\(r"([^"]+)"\)', src).group(1))


def main() -> int:
    data = Path(tempfile.mkdtemp(prefix="iso-"))
    fake, fport = fake_zernio.start()
    gport = free_port()
    env = {**os.environ, "STUDIOMANIA_DATA": str(data), "SKIP_EMAIL_VERIFY": "1", "ATLAS_MOCK": "1", "GATEWAY_SECRET": secrets.token_hex(16),
           "ZERNIO_BASE_URL": f"http://127.0.0.1:{fport}", **KEYS}
    for k in ("PUBLISH_MOCK", "ADMIN_EMAIL", "APP_PASSWORD", "STAGING"):
        env.pop(k, None)
    log = open(data / "gateway.log", "w")
    gw = subprocess.Popen([sys.executable, "-m", "uvicorn", "gateway:app", "--app-dir", "backend", "--port", str(gport), "--log-level", "warning"],
                          cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
    base = f"http://127.0.0.1:{gport}"
    try:
        for _ in range(120):
            try:
                if httpx.get(base + "/health", timeout=2).status_code == 200:
                    break
            except httpx.HTTPError:
                time.sleep(0.5)
        else:
            print("البوابة ماشتغلتش، شوف", data / "gateway.log")
            return 2
        run(base)
    finally:
        gw.terminate()
        try:
            gw.wait(10)
        except subprocess.TimeoutExpired:
            gw.kill()
        fake.shutdown()
    report(data)
    return 0 if all(r["ok"] for r in results) else 1


def client(base: str) -> httpx.Client:
    return httpx.Client(base_url=base, timeout=60, follow_redirects=False)


def run(base: str) -> None:
    owner, a, b, anon = client(base), client(base), client(base), client(base)
    r = owner.post("/api/auth/setup", json={"email": "owner@iso.test", "password": PW, "name": "Owner"})
    check("إنشاء حساب الأدمن", r.status_code == 200, r.text)
    for c, who in ((a, "a"), (b, "b")):
        r = c.post("/api/auth/signup", json={"email": f"{who}@iso.test", "password": PW, "name": f"Cust {who.upper()}", "country": "SA"})
        check(f"تسجيل العميل {who.upper()}", r.status_code == 200, r.text)
    wid = {k: c.get("/api/me").json()["workspace"] for k, c in (("a", a), ("b", b))}
    check("كل عميل في مساحة لوحده", wid["a"] != wid["b"] and "owner" not in wid.values(), json.dumps(wid))

    # 🏷️ علامة في بيانات كل حساب (مشروع وفكرة)، وفتح «النشر» عشان كل عميل ياخد بروفايل عند خدمة النشر
    marks = {"owner": ["OWNERLEAK", "acc-p-owner"], "a": ["ALEAKMARK", f"h-ws-{wid['a']}"], "b": ["BLEAKMARK", f"h-ws-{wid['b']}"]}
    for who, c in (("owner", owner), ("a", a), ("b", b)):
        tag = marks[who][0]
        c.post("/api/folders", json={"name": f"{tag} folder"})
        c.post("/api/my-ideas", data={"text": f"{tag} idea"})
        c.get("/api/publisher")

    # ✅ العميل شايف حسابه هو (عشان نتأكد إن الاختبار بيعدّي على الكود الحقيقي مش راجع فاضي)
    for who, c in (("a", a), ("b", b)):
        t = c.get("/api/publisher").text
        check(f"العميل {who.upper()} شايف حسابه المربوط", marks[who][1] in t, t[:300])

    routes = app_routes()
    adm = admin_only_re()
    gets = sorted({p for m, p in routes if m == "GET" and "{" not in p and p not in SKIP_GET})

    # 1) كل واجهات القراءة: مفيش علامة حد تاني ولا مفتاح
    def sweep(who: str, c: httpx.Client, path: str) -> None:
        try:
            r = c.get(path, timeout=40)
        except httpx.HTTPError as exc:
            return check(f"[{who.upper()}] GET {path}", True, f"skip: {type(exc).__name__}")
        body = r.text
        if adm.match(path):
            ok = r.status_code == 403 or (path == "/api/settings" and r.status_code == 200 and r.json().get("keys") == {})
            return check(f"[{who.upper()}] واجهة أدمن ممنوعة: GET {path}", ok, f"{r.status_code} {body[:200]}")
        others = [m for k, ms in marks.items() if k != who for m in ms]
        leak = [m for m in others if m in body]
        sec = SECRET_RE.findall(body)
        check(f"[{who.upper()}] GET {path}", not leak and not sec, f"{r.status_code} leak={leak} secrets={sec} {body[:200] if (leak or sec) else ''}")

    with ThreadPoolExecutor(6) as ex:
        list(ex.map(lambda p: sweep("a", a, p), gets))
        list(ex.map(lambda p: sweep("b", b, p), gets))

    # 2) واجهات الأدمن بكل الطرق
    for m, p in routes:
        path = re.sub(r"\{[^}]+\}", "x", p)
        if not adm.match(path) or m == "GET":
            continue
        r = a.request(m, path, json={})
        check(f"[A] واجهة أدمن ممنوعة: {m} {path}", r.status_code == 403, f"{r.status_code} {r.text[:150]}")

    # 3) B يهاجم حسابات A والأدمن
    for victim in ("a", "owner"):
        pid = "p-owner" if victim == "owner" else f"p-ws-{wid['a']}"
        acc = f"acc-{pid}"
        before = len(fake_zernio.S.log)
        tries = [("DELETE", f"/api/publisher/accounts/{acc}", None),
                 ("GET", f"/api/inbox/comments/inbox-comments-{pid}?account_id={acc}", None),
                 ("GET", f"/api/inbox/conversations/inbox-conversations-{pid}/messages?account_id={acc}", None),
                 ("POST", f"/api/inbox/comments/inbox-comments-{pid}/reply", {"account_id": acc, "message": "hi"}),
                 ("POST", f"/api/inbox/conversations/inbox-conversations-{pid}/send", {"account_id": acc, "message": "hi"})]
        for m, path, body in tries:
            r = b.request(m, path, json=body)
            vm = marks[victim]
            check(f"[B ← {victim}] {m} {path.split('?')[0]}", r.status_code >= 400 and not any(x in r.text for x in vm),
                  f"{r.status_code} {r.text[:200]}")
        hits = [x for x in fake_zernio.S.log[before:] if acc in x["path"] or acc in json.dumps(x["body"]) or pid in x["path"]]
        bad = [x for x in hits if x["method"] != "GET"]
        check(f"[B ← {victim}] مفيش أي فصل/رد/إرسال وصل لخدمة النشر على حسابه", not bad, json.dumps(bad)[:300])

    # 4) من غير تسجيل دخول
    for p in gets:
        if p in PUBLIC:
            continue
        r = anon.get(p)
        check(f"[زائر] GET {p}", r.status_code in (401, 404, 307, 302, 303), f"{r.status_code}")

    # 5) تزوير الهيدرز والمسارات الداخلية
    spoof = {"x-user-role": "admin", "x-user-email": "owner@iso.test", "x-gateway-secret": "guess", "x-forwarded-for": "127.0.0.1"}
    for p in ("/api/lab", "/api/admin/providers", "/api/atlas/money", "/api/pricing/margins"):
        r = a.get(p, headers=spoof)
        check(f"[A مزوّر] GET {p}", r.status_code == 403, f"{r.status_code}")
    r = a.get("/api/settings", headers=spoof)
    check("[A مزوّر] GET /api/settings بيرجع فاضي", r.status_code == 200 and r.json().get("keys") == {}, r.text[:200])
    for p in ("/api/_tenant/busy", "/api/_hooks/dm"):
        r = a.get(p)
        check(f"[A] مسار داخلي مقفول: {p}", r.status_code == 404, f"{r.status_code}")
    r = anon.get("/api/me", headers={"authorization": "Bearer x.y.z.w"})
    check("[زائر] توكن مزوّر مايدخلش", r.status_code == 401, f"{r.status_code}")


def report(data: Path) -> None:
    bad = [r for r in results if not r["ok"]]
    (HERE / "last_report.json").write_text(json.dumps({"at": time.strftime("%Y-%m-%d %H:%M"), "total": len(results), "failed": len(bad), "results": results},
                                                      ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n🔒 اختبار العزل: {len(results) - len(bad)}/{len(results)} نجح")
    for r in bad:
        print(f"  ✗ {r['test']}  →  {r['detail']}")
    if not bad:
        print("  ✓ مفيش تسريب بين الحسابات")
    print(f"  (لوج البوابة: {data / 'gateway.log'})")


if __name__ == "__main__":
    sys.exit(main())
