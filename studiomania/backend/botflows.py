"""🤖 بوتات الرسايل: Workflows عند Zernio (زي ManyChat) بتتبني من اختيارات بسيطة، من غير ما العميل يرسم أي حاجة.

كل «وصفة» بتتحول لـ nodes + edges بنفس شكل ‎/v1/workflows: trigger ← رسايل ← استنى الرد ← تفرّع ← ذكاء صناعي ← تحويل لإنسان.
الذكاء الصناعي مش نود «ai» بتاعة Zernio (محتاجة مفتاح عندهم): بنستخدم نود webhook بتكلّم منصتنا (عقل العلامة + Atlas الرخيص)،
وردّنا بيترجع في {{ai.body.text}} وبيتبعت للعميل. الرابط فيه توقيع (token) بيعرّف البوابة الحساب صاحب البوت.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import uuid

import publisher

PLATFORMS = ("instagram", "facebook", "whatsapp")   # المنصات اللي البوتات بتشتغل عليها هنا
REMOTE = {"instagram": "instagram", "facebook": "facebook", "whatsapp": "whatsapp"}
NAME_TAG = "🤖 "   # أسماء بوتاتنا عند Zernio بتبدأ بيها (علشان نعرف بتوعنا من اللي اتعمل في لوحتهم)

RECIPES = {
    "comment": {"t": "علّق بكلمة ← رسالة خاصة", "desc": "اللي يكتب الكلمة تحت بوست يوصله رد خاص فيه اللينك، والبوت يكمّل معاه لو سأل.",
                "platforms": ("instagram", "facebook"), "fields": ("keywords", "post", "message", "link_title", "link", "ai")},
    "keyword": {"t": "كلمة في الرسايل ← رد", "desc": "اللي يبعت الكلمة في الخاص أو الواتساب يوصله الرد واللينك على طول.",
                "platforms": ("instagram", "facebook", "whatsapp"), "fields": ("keywords", "message", "link_title", "link", "ai")},
    "story": {"t": "منشن في الستوري ← شكر وعرض", "desc": "اللي يعمل منشن لحسابك في ستوري يوصله شكر وعرض أو لينك.",
              "platforms": ("instagram",), "fields": ("message", "link_title", "link")},
    "qualify": {"t": "اسأل عن الهدف والمستوى ← حوّل للفريق", "desc": "البوت يسأل سؤالين (مثلًا الهدف والمستوى)، يحفظ الإجابات على العميل، وبعدين يحوّل المحادثة لحد من الفريق.",
                "platforms": ("instagram", "facebook", "whatsapp"), "fields": ("keywords", "q1", "a1", "q2", "a2", "message")},
    "assistant": {"t": "مساعد ذكي يرد على أي رسالة", "desc": "أي رسالة توصل، البوت يرد بأسلوب البراند ومن معلومات العقل، ولو العميل عايز إنسان أو السؤال صعب يحوّله للفريق.",
                  "platforms": ("instagram", "facebook", "whatsapp"), "fields": ("message",)},
}
DEFAULTS = {
    "comment": {"keywords": "برنامج", "message": "أهلًا 👋 ده اللينك اللي طلبته:", "link_title": "افتح اللينك"},
    "keyword": {"keywords": "سعر, اشتراك", "message": "أهلًا 👋 دي كل التفاصيل:", "link_title": "التفاصيل"},
    "story": {"message": "شكرًا إنك شاركتنا في الستوري 🙏 ده هدية بسيطة ليك:", "link_title": "الهدية"},
    "qualify": {"keywords": "ابدأ", "q1": "إيه هدفك؟", "a1": "خسارة وزن, بناء عضل, لياقة عامة", "q2": "مستواك إيه؟", "a2": "مبتدئ, متوسط, محترف",
                "message": "تمام، شكرًا! حد من الفريق هيكلمك دلوقتي 🙌"},
    "assistant": {"message": "أهلًا 👋 أنا المساعد الآلي، اسألني أي حاجة."},
}


def words(v) -> list[str]:
    return [w.strip() for w in re.split(r"[,،\n]", str(v or "")) if w.strip()][:20]


def clean(recipe: str, raw: dict) -> dict:
    base = dict(DEFAULTS.get(recipe, {}))
    for k in RECIPES[recipe]["fields"]:
        if k in raw:
            v = raw[k]
            base[k] = bool(v) if k == "ai" else str(v or "").strip()[:900]
    if base.get("link") and not re.match(r"^https?://", base["link"]):
        base["link"] = "https://" + base["link"]
    return base


# ---------------------------------------------------------------- الرابط اللي البوت بيكلّمه للرد الذكي

def ai_token(wid: str, secret: str | None = None) -> str:
    """توقيع ثابت (سر توقيع رسايل Zernio اللي البوابة حافظاه)، علشان الرابط يفضل شغال بعد أي إعادة تشغيل."""
    key = secret or os.environ.get("ZERNIO_HOOK_SECRET") or "dev"
    return f"{wid}.{hmac.new(key.encode(), wid.encode(), hashlib.sha256).hexdigest()[:24]}"


def ai_token_ok(token: str, secret: str) -> str | None:
    wid, _, _ = (token or "").partition(".")
    return wid if wid and re.fullmatch(r"[A-Za-z0-9_-]{1,40}", wid) and hmac.compare_digest(ai_token(wid, secret), token) else None


def ai_url(bot_key: str) -> str:
    base = (os.environ.get("PUBLIC_URL") or "").rstrip("/")
    return f"{base}/hooks/bot-ai/{ai_token(os.environ.get('TENANT_ID') or 'owner')}?bot={bot_key}"


# ---------------------------------------------------------------- الرسم (nodes + edges)

class G:
    def __init__(self):
        self.nodes, self.edges, self.y = [], [], 0

    def add(self, typ: str, config: dict | None = None, label: str = "") -> str:
        nid = f"n{len(self.nodes) + 1}"
        self.nodes.append({"id": nid, "type": typ, "config": config or {}, "label": label[:60], "position": {"x": 0, "y": self.y}})
        self.y += 140
        return nid

    def link(self, a: str, b: str, handle: str | None = None):
        self.edges.append({"id": f"e{len(self.edges) + 1}", "source": a, "target": b, **({"sourceHandle": handle} if handle else {})})


def _msg(platform: str, text: str, link: str = "", link_title: str = "", quick: list[str] | None = None) -> dict:
    """رسالة نصية: على إنستجرام وفيسبوك اللينك زرار والاختيارات أزرار سريعة، وعلى الواتساب بتتكتب في النص."""
    text = text.strip() or "👋"
    if platform == "whatsapp":
        if link:
            text += f"\n{link}"
        if quick:
            text += "\n" + "\n".join(f"{i + 1}. {q}" for i, q in enumerate(quick))
        return {"messageType": "text", "text": text}
    cfg: dict = {"messageType": "text", "text": text[:640]}
    if link:
        cfg["buttons"] = [{"type": "url", "title": (link_title or "افتح")[:20], "url": link}]
    elif quick:
        cfg["quickReplies"] = [{"title": q[:20], "payload": q[:60]} for q in quick[:13]]
    return cfg


def _ai_loop(g: G, platform: str, start: str, bot_key: str, handle: str | None = None):
    """استنى الرد ← اسأل العقل ← ابعت الرد ← (حوّل لإنسان لو لازم) ← استنى تاني (لحد ساعة سكوت)."""
    wait = g.add("wait_for_reply", {"timeoutMinutes": 60, "saveAs": "reply"}, "استنى رده")
    g.link(start, wait, handle)
    hook = g.add("webhook", {"url": ai_url(bot_key), "method": "POST", "headers": {"content-type": "application/json"}, "saveAs": "ai",
                             "bodyTemplate": '{"text": "{{lastMessage}}", "name": "{{contact.name}}", "platform": "' + platform + '"}'}, "رد من عقل العلامة")
    g.link(wait, hook, "reply")
    end = g.add("end", {}, "خلص")
    g.link(wait, end, "timeout")
    cond = g.add("condition", {"rules": [{"id": "human", "variable": "ai.body.handoff", "operator": "is_true"}]}, "محتاج إنسان؟")
    g.link(hook, cond, "success")
    g.link(hook, g.add("handoff", {"note": "البوت ماقدرش يرد"}, "حوّل للفريق"), "error")
    g.link(cond, g.add("handoff", {"note": "العميل طلب حد من الفريق"}, "حوّل للفريق"), "human")
    say = g.add("send_message", {"messageType": "text", "text": "{{ai.body.text}}"}, "ابعت الرد")
    g.link(cond, say, "default")
    g.link(say, wait)


def build(recipe: str, platform: str, o: dict, bot_key: str) -> dict:
    g = G()
    kws = words(o.get("keywords"))
    if recipe == "comment":
        trig = g.add("trigger", {"triggerType": "comment", "comment": {"keywords": kws, "matchType": "contains" if kws else "any",
                                                                         **({"platformPostId": o["post"]} if o.get("post") else {})}}, "تعليق بالكلمة")
        first = g.add("send_message", _msg(platform, o["message"], o.get("link", ""), o.get("link_title", "")), "الرد الخاص")
        g.link(trig, first)
        if o.get("ai"):
            _ai_loop(g, platform, first, bot_key)
        else:
            g.link(first, g.add("end"))
    elif recipe == "keyword":
        trig = g.add("trigger", {"triggerType": "inbound_message", "keywords": kws, "matchType": "contains" if kws else "any", "cooldownHours": 24}, "رسالة بالكلمة")
        first = g.add("send_message", _msg(platform, o["message"], o.get("link", ""), o.get("link_title", "")), "الرد")
        g.link(trig, first)
        if o.get("ai"):
            _ai_loop(g, platform, first, bot_key)
        else:
            g.link(first, g.add("end"))
    elif recipe == "story":
        trig = g.add("trigger", {"triggerType": "story_mention", "cooldownHours": 72}, "منشن في الستوري")
        first = g.add("send_message", _msg(platform, o["message"], o.get("link", ""), o.get("link_title", "")), "شكر وعرض")
        g.link(trig, first)
        g.link(first, g.add("end"))
    elif recipe == "qualify":
        trig = g.add("trigger", {"triggerType": "inbound_message", "keywords": kws, "matchType": "contains" if kws else "any", "cooldownHours": 24}, "رسالة بالكلمة")
        prev = trig
        for i, (q, a, field) in enumerate(((o["q1"], o["a1"], "goal"), (o["q2"], o["a2"], "level"))):
            ask = g.add("send_message", _msg(platform, q, quick=words(a)), f"سؤال {i + 1}")
            g.link(prev, ask)
            wait = g.add("wait_for_reply", {"timeoutMinutes": 1440, "saveAs": field}, "استنى الإجابة")
            g.link(ask, wait)
            g.link(wait, g.add("end", {}, "ماردش"), "timeout")
            save = g.add("set_field", {"field": field, "value": "{{lastMessage}}"}, f"احفظ {field}")
            g.link(wait, save, "reply")
            prev = save
        tag = g.add("add_tag", {"tag": "مهتم"}, "وسم: مهتم")
        g.link(prev, tag)
        bye = g.add("send_message", _msg(platform, o["message"]), "شكرًا")
        g.link(tag, bye)
        g.link(bye, g.add("handoff", {"note": "الهدف: {{contact.fields.goal}} · المستوى: {{contact.fields.level}}"}, "حوّل للفريق"))
    elif recipe == "assistant":
        trig = g.add("trigger", {"triggerType": "inbound_message", "matchType": "any", "onlyFirstMessage": True, "cooldownHours": 12}, "أي رسالة")
        hook = g.add("webhook", {"url": ai_url(bot_key), "method": "POST", "headers": {"content-type": "application/json"}, "saveAs": "ai",
                                 "bodyTemplate": '{"text": "{{lastMessage}}", "name": "{{contact.name}}", "platform": "' + platform + '"}'}, "رد من عقل العلامة")
        g.link(trig, hook)
        g.link(hook, g.add("handoff", {"note": "البوت ماقدرش يرد"}, "حوّل للفريق"), "error")
        cond = g.add("condition", {"rules": [{"id": "human", "variable": "ai.body.handoff", "operator": "is_true"}]}, "محتاج إنسان؟")
        g.link(hook, cond, "success")
        g.link(cond, g.add("handoff", {"note": "العميل طلب حد من الفريق"}, "حوّل للفريق"), "human")
        say = g.add("send_message", {"messageType": "text", "text": "{{ai.body.text}}"}, "ابعت الرد")
        g.link(cond, say, "default")
        _ai_loop(g, platform, say, bot_key)
    return {"nodes": g.nodes, "edges": g.edges, "entryNodeId": g.nodes[0]["id"]}


# ---------------------------------------------------------------- Zernio

def _req(method: str, path: str, what: str, params: dict | None = None, body: dict | None = None):
    with publisher._client(60) as c:
        return publisher._check(c.request(method, f"{publisher.BASE_URL}{path}", params={k: v for k, v in (params or {}).items() if v not in (None, "")} or None,
                                          json=body), what)


def bot_accounts() -> list[dict]:
    return [a for a in publisher.account_list(True) if a["platform"] in PLATFORMS]


def list_bots() -> list[dict]:
    prof = publisher.tenant_profile()
    data = _req("GET", "/workflows", "قراءة البوتات", {"limit": 100, "profileId": prof})
    mine = {a["id"] for a in bot_accounts()}
    out = []
    for w in (data.get("workflows") if isinstance(data, dict) else data) or []:
        if not str(w.get("name") or "").startswith(NAME_TAG):
            continue
        if prof and w.get("accountId") and w["accountId"] not in mine:
            continue
        out.append({"id": w.get("id") or w.get("_id"), "name": w["name"][len(NAME_TAG):], "platform": w.get("platform"), "account": w.get("accountName") or "",
                    "status": w.get("status") or "draft", "started": w.get("totalStarted") or 0, "completed": w.get("totalCompleted") or 0,
                    "exited": w.get("totalExited") or 0, "recipe": (re.search(r"\[(\w+)\]", w.get("description") or "") or [None, ""])[1]})
    return out


def create(recipe: str, account: dict, name: str, o: dict) -> dict:
    key = uuid.uuid4().hex[:8]
    graph = build(recipe, account["platform"], o, key)
    body = {"profileId": publisher.default_profile(), "accountId": account["id"], "platform": REMOTE[account["platform"]],
            "name": NAME_TAG + (name.strip() or RECIPES[recipe]["t"])[:80], "description": f"[{recipe}] {key} · SimsimKit", **graph}
    made = _req("POST", "/workflows", "عمل البوت", body=body)
    wid = ((made or {}).get("workflow") or {}).get("id")
    if not wid:
        raise publisher.PublishError(f"Zernio مارجعش رقم البوت: {str(made)[:200]}")
    _req("POST", f"/workflows/{wid}/activate", "تشغيل البوت")
    return {"id": wid, "key": key}


def set_state(wid: str, on: bool) -> None:
    _req("POST", f"/workflows/{wid}/{'activate' if on else 'pause'}", "تشغيل البوت" if on else "إيقاف البوت")


def delete(wid: str) -> None:
    _req("DELETE", f"/workflows/{wid}", "مسح البوت")


def ai_messages(brain: str, text: str, name: str) -> list[dict]:
    return [{"role": "system", "content": f"""أنت المساعد الآلي لهذه العلامة في رسايل السوشيال والواتساب. اعرف العلامة من الملف ده فقط:
{brain[:6000]}
قواعد:
- رد قصير (جملة لثلاث جمل)، ودود، بنفس لهجة العلامة المكتوبة في الملف.
- ماتخترعش أسعار ولا مواعيد ولا معلومات مش موجودة في الملف. لو مش عارف، قل إن حد من الفريق هيرد عليه، وخلي handoff = true.
- لو العميل طلب يكلّم إنسان، أو اشتكى، أو عايز يحجز أو يدفع: handoff = true.
- رجّع JSON بس: {{"text": "الرد", "handoff": false}}"""},
            {"role": "user", "content": f"اسم العميل: {name or 'غير معروف'}\nرسالته: {text[:1500]}"}]


def parse_hook_body(raw: bytes) -> dict:
    """جسم الطلب من Zernio: JSON، ولو الرسالة نفسها فيها علامات تبوّظه بنطلع النص بالـ regex."""
    s = raw.decode("utf-8", "replace")
    try:
        d = json.loads(s)
        if isinstance(d, dict):
            return d
    except ValueError:
        pass
    m = re.search(r'"text"\s*:\s*"(.*)"\s*,\s*"name"\s*:\s*"(.*?)"\s*,\s*"platform"', s, re.S)
    return {"text": m.group(1), "name": m.group(2)} if m else {"text": s[:1500]}
