"""خدمة نشر وهمية (بدل Zernio) للاختبار: بتتصرف زي أسوأ حالة.
- قائمة الحسابات بترجع حسابات كل البروفايلات حتى لو اتطلب بروفايل واحد (البرنامج لازم يفلتر بنفسه).
- أي قائمة تانية لو اتطلبت من غير profileId بترجع بيانات الكل (عشان نمسك أي طلب نسي يبعت البروفايل).
- كل عنصر جواه علامة صاحبه (OWNERLEAK أو h-ws-...)، فلو ظهرت عند حد تاني يبقى فيه تسريب.
- بتسجّل كل طلب، عشان نتأكد إن مفيش فصل حساب أو رد أو إرسال اتعمل على حساب حد تاني.
"""
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

OWNER_PROFILE = "p-owner"
OWNER_MARK = "OWNERLEAK"


class State:
    def __init__(self):
        self.lock = threading.Lock()
        self.profiles = [{"_id": OWNER_PROFILE, "name": "owner-main"}]
        self.accounts = [self._acc(OWNER_PROFILE, OWNER_MARK)]
        self.log: list[dict] = []

    @staticmethod
    def _acc(pid: str, mark: str) -> dict:
        return {"_id": f"acc-{pid}", "platform": "tiktok", "username": mark, "displayName": mark, "profileId": pid, "isActive": True}

    def mark_of(self, pid: str) -> str:
        return OWNER_MARK if pid == OWNER_PROFILE else f"h-{pid[2:]}"

    def add_profile(self, name: str) -> dict:
        with self.lock:
            hit = next((p for p in self.profiles if p["name"] == name), None)
            if hit:
                return hit
            p = {"_id": f"p-{name}", "name": name}
            self.profiles.append(p)
            self.accounts.append(self._acc(p["_id"], self.mark_of(p["_id"])))
            return p

    def by_profile(self, pid: str | None) -> list[dict]:
        return [p for p in self.profiles if not pid or p["_id"] == pid]


S = State()


def items_for(pid: str | None, kind: str) -> list[dict]:
    """عنصر واحد لكل بروفايل (أو لبروفايل واحد لو اتطلب)، فيه الحساب والعلامة."""
    out = []
    for p in S.by_profile(pid):
        m, acc = S.mark_of(p["_id"]), f"acc-{p['_id']}"
        out.append({"_id": f"{kind}-{p['_id']}", "id": f"{kind}-{p['_id']}", "profileId": p["_id"], "accountId": acc, "name": f"{m} {kind}",
                    "content": f"{m} {kind}", "text": f"{m} {kind}", "username": m, "platform": "tiktok",
                    "platforms": [{"platform": "tiktok", "accountId": acc, "status": "published"}], "status": "published",
                    "participantName": m, "lastMessage": f"{m} msg", "unreadCount": 1})
    return out


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code: int, obj) -> None:
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _body(self) -> dict:
        n = int(self.headers.get("content-length") or 0)
        if not n:
            return {}
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return {}

    def handle_any(self, method: str) -> None:
        u = urlparse(self.path)
        path = u.path.replace("/api/v1", "", 1)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        body = self._body() if method in ("POST", "PUT", "PATCH") else {}
        with S.lock:
            S.log.append({"method": method, "path": path, "query": q, "body": body})
        pid = q.get("profileId")

        if path == "/profiles" and method == "GET":
            return self._send(200, {"profiles": S.profiles})
        if path == "/profiles" and method == "POST":
            return self._send(200, {"profile": S.add_profile(body.get("name") or "x")})
        if path == "/accounts" and method == "GET":
            return self._send(200, {"accounts": S.accounts})   # 🔥 بيتجاهل profileId عن قصد
        if path.startswith("/accounts/") and method == "DELETE":
            return self._send(200, {"ok": True})
        if path == "/users":
            return self._send(200, {"users": [{"_id": "u1", "email": "x@x"}]})
        if path.startswith("/inbox/comments/") and method == "GET":
            post = path.rsplit("/", 1)[-1]
            p = next((x for x in S.profiles if post.endswith(x["_id"])), None)
            m = S.mark_of(p["_id"]) if p else "unknown"
            return self._send(200, {"data": [{"id": f"c-{post}", "text": f"{m} comment", "from": {"name": m}}]})
        if path.startswith("/inbox/conversations/") and path.endswith("/messages") and method == "GET":
            conv = path.split("/")[3]
            p = next((x for x in S.profiles if conv.endswith(x["_id"])), None)
            m = S.mark_of(p["_id"]) if p else "unknown"
            return self._send(200, {"data": [{"id": f"m-{conv}", "message": f"{m} dm", "direction": "incoming"}]})
        if path in ("/inbox/comments", "/inbox/conversations"):
            return self._send(200, {"data": items_for(None, path.rsplit("/", 1)[-1])})   # 🔥 الكل، والبرنامج لازم يفلتر
        if method == "GET":
            kind = path.strip("/").replace("/", "-") or "root"
            lst = items_for(pid, kind)
            return self._send(200, {"data": lst, "items": lst, "posts": lst, "ads": lst, "broadcasts": lst, "contacts": lst,
                                    "templates": lst, "sequences": lst, "automations": lst, "audiences": lst, "accounts": lst})
        return self._send(200, {"ok": True, "_id": "new-1", "id": "new-1", "post": {"_id": "new-1"}})

    def do_GET(self):
        self.handle_any("GET")

    def do_POST(self):
        self.handle_any("POST")

    def do_PUT(self):
        self.handle_any("PUT")

    def do_PATCH(self):
        self.handle_any("PATCH")

    def do_DELETE(self):
        self.handle_any("DELETE")


def start(port: int = 0) -> tuple[ThreadingHTTPServer, int]:
    srv = ThreadingHTTPServer(("127.0.0.1", port), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]
