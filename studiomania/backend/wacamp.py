"""💬 حملات واتساب للناس الذي وافقوا فقط (Opt-in): جمع الموافقات، القوالب، الحملات، وسلاسل المتابعة.

قواعد واتساب نفسها: لا يوجد رسالة تسويق حتى ما وافقش. فالأشخاص تدخل القائمة بطريقة من هؤلاء فقط:
- كلّموك هم أولًا (رابط wa.me أو QR بكلمة جاهزة، أو تعليق بكلمة على منشور إنستجرام/فيسبوك يرد عليهم باللينك).
- عملاءك الذي وافقوا من قبل (ملف CSV وأنت تأكد الموافقة).
أي رسالة خارج الـ ٢٤ ساعة يجب تكون قالب متوافق عليه من واتساب، وكل قالب تسويق فيه «للإلغاء أرسل إلغاء».
ما يلغي يتعلّم عليه ومابيوصلوش شيء آخر (الحملات تأخذ المشتركين فقط).
كل علامة له تاج على جهات الاتصال الخاصة به، لكي كل علامة يرى ناسه فقط.
PUBLISH_MOCK=1: جهات اتصال وقوالب وحملات تجريبية.
"""
from __future__ import annotations

import re
import time
import uuid
from urllib.parse import quote

import httpx

import publisher

STOP_FOOTER = "للإلغاء أرسل «إلغاء»"
LANGS = {"ar": "العربية", "en_US": "الإنجليزية"}
CATEGORIES = {"MARKETING": "تسويق (عروض وأخبار)", "UTILITY": "خدمة (تأكيد طلب، تذكير، متابعة)"}
MAX_STEPS = 6


class WaError(Exception):
    pass


def mock() -> bool:
    return publisher.service_name() == "mock"


def ready() -> None:
    if publisher.service_name() not in ("zernio", "mock"):
        raise WaError("خدمة الرسائل غير متصلة ما زال. كلّم الدعم")


def _check(resp: httpx.Response, what: str):
    if resp.status_code == 403 and ("add-on" in resp.text.lower() or "inbox" in resp.text.lower()):
        raise WaError("حملات واتساب غير مفعّلة في اشتراكك بعد. تواصل مع الدعم لتفعيلها.")
    try:
        return publisher._check(resp, what)
    except publisher.PublishError as exc:
        raise WaError(str(exc)) from exc


def _req(method: str, path: str, what: str, params: dict | None = None, body: dict | None = None):
    with publisher._client(60) as c:
        return _check(c.request(method, f"{publisher.BASE_URL}{path}", params={k: v for k, v in (params or {}).items() if v not in (None, "")} or None,
                                json=body), what)


def brand_tag(bid: str) -> str:
    return f"brand-{re.sub(r'[^a-z0-9]', '', str(bid).lower())[:10]}"


def phone(v: str) -> str:
    """رقم بالصيغة الدولية (+966…). بدون كود دولة لا يتقبل، لكي مانبعتش حتى خطأ."""
    v = re.sub(r"[^\d+]", "", str(v or ""))
    if v.startswith("00"):
        v = "+" + v[2:]
    return v if re.fullmatch(r"\+\d{8,15}", v) else ""


def tag(v: str) -> str:
    return re.sub(r"[^\w؀-ۿ-]", "", str(v or "").strip().replace(" ", "-"))[:30]


def wa_link(number: str, text: str) -> str:
    return f"https://wa.me/{re.sub(r'[^0-9]', '', number)}?text={quote(text)}"


# ---------------------------------------------------------------- 🧪 وضع التجربة
_M: dict = {"contacts": [], "templates": [{"name": "welcome_offer", "language": "ar", "category": "MARKETING", "status": "APPROVED",
                                         "body": "أهلًا {{1}}! لدينا عرض جديد اليوم، هل تودّ معرفة التفاصيل؟", "footer": STOP_FOOTER, "vars": 1}],
            "broadcasts": [], "sequences": [], "automations": []}


# ---------------------------------------------------------------- 👥 جهات الاتصال (المشتركين)
def _norm_contact(c: dict) -> dict:
    ch = next((x for x in c.get("channels") or [] if isinstance(x, dict) and str(x.get("platform")).lower() == "whatsapp"), {})
    return {"id": str(c.get("_id") or c.get("id") or ""), "name": c.get("name") or "", "phone": ch.get("platformIdentifier") or c.get("phone") or "",
            "tags": [t for t in c.get("tags") or [] if not str(t).startswith("brand-")], "subscribed": c.get("isSubscribed", True) is not False,
            "source": (c.get("customFields") or {}).get("optin_source") or "", "at": c.get("createdAt")}


def contacts(bid: str, search: str = "", only_tag: str = "", subscribed: bool | None = None, limit: int = 200) -> dict:
    bt = brand_tag(bid)
    if mock():
        lst = [c for c in _M["contacts"] if bt in c["tags_all"] and (not only_tag or only_tag in c["tags"]) and (subscribed is None or c["subscribed"] == subscribed)
               and (not search or search in c["name"] or search in c["phone"])]
        return {"contacts": [{k: v for k, v in c.items() if k != "tags_all"} for c in lst][:limit], "tags": sorted({t for c in _M["contacts"] if bt in c["tags_all"] for t in c["tags"]})}
    out, skip, tags = [], 0, set()
    while len(out) < limit:
        data = _req("GET", "/contacts", "قراءة المشتركين", {"profileId": publisher.tenant_profile(), "tag": bt, "platform": "whatsapp", "search": search or None,
                                                          "isSubscribed": None if subscribed is None else str(subscribed).lower(), "limit": 200, "skip": skip})
        items = publisher._pick(data, "contacts")
        for c in items:
            if isinstance(c, dict):
                n = _norm_contact(c)
                tags.update(n["tags"])
                if not only_tag or only_tag in n["tags"]:
                    out.append(n)
        if len(items) < 200:
            break
        skip += 200
    return {"contacts": out[:limit], "tags": sorted(tags)}


def add_contacts(bid: str, account_id: str, people: list[dict], tags: list[str], source: str) -> dict:
    """يضيف أشخاص وافقوا (بالاسم والرقم الدولي). ما بدون رقم صحيح يتساب ومابيتبعتلوش."""
    bt = brand_tag(bid)
    tags = [t for t in (tag(x) for x in tags) if t][:5]
    good, bad = [], 0
    seen = set()
    for p in people:
        ph = phone(p.get("phone"))
        if not ph or ph in seen:
            bad += 1
            continue
        seen.add(ph)
        good.append({"name": str(p.get("name") or ph)[:80], "platformIdentifier": ph, "tags": [bt, *tags], "customFields": {"optin_source": source[:40]}})
    if not good:
        raise WaError("لا توجد أرقام صحيحة. يجب أن يبدأ الرقم بكود الدولة، مثل +966501234567")
    if mock():
        have = {c["phone"] for c in _M["contacts"]}
        new = [g for g in good if g["platformIdentifier"] not in have]
        for g in new:
            _M["contacts"].append({"id": f"mc-{uuid.uuid4().hex[:6]}", "name": g["name"], "phone": g["platformIdentifier"], "tags": tags, "tags_all": [bt, *tags],
                                   "subscribed": True, "source": source, "at": time.time()})
        return {"created": len(new), "skipped": len(good) - len(new) + bad}
    created = skipped = 0
    for i in range(0, len(good), 1000):
        data = _req("POST", "/contacts/bulk", "إضافة المشتركين", body={"profileId": publisher.tenant_profile() or publisher.default_profile(), "accountId": account_id,
                                                                    "platform": "whatsapp", "contacts": good[i:i + 1000]})
        created += int(data.get("created") or 0) if isinstance(data, dict) else 0
        skipped += int(data.get("skipped") or 0) if isinstance(data, dict) else 0
    return {"created": created, "skipped": skipped + bad}


def set_subscribed(contact_id: str, on: bool) -> None:
    if mock():
        for c in _M["contacts"]:
            if c["id"] == contact_id:
                c["subscribed"] = on
        return
    _req("PATCH", f"/contacts/{contact_id}", "تعديل المشترك", body={"isSubscribed": on})


def delete_contact(contact_id: str) -> None:
    if mock():
        _M["contacts"][:] = [c for c in _M["contacts"] if c["id"] != contact_id]
        return
    _req("DELETE", f"/contacts/{contact_id}", "حذف المشترك")


# ---------------------------------------------------------------- 📝 القوالب (بتتراجع من واتساب)
def _norm_tpl(t: dict) -> dict:
    comps = t.get("components") or []
    body = next((c.get("text") for c in comps if str(c.get("type")).lower() == "body"), "") or ""
    foot = next((c.get("text") for c in comps if str(c.get("type")).lower() == "footer"), "") or ""
    return {"name": t.get("name") or "", "language": t.get("language") or "", "category": t.get("category") or "", "status": str(t.get("status") or "").upper(),
            "body": body, "footer": foot, "vars": len(set(re.findall(r"\{\{(\d+)\}\}", body))), "reason": t.get("rejected_reason") or t.get("rejectedReason")}


def templates(account_id: str) -> list[dict]:
    if mock():
        return _M["templates"]
    data = _req("GET", "/whatsapp/templates", "قراءة القوالب", {"accountId": account_id})
    return [_norm_tpl(t) for t in publisher._pick(data, "templates") if isinstance(t, dict)]


def tpl_name(s: str) -> str:
    s = re.sub(r"[^a-z0-9_]", "_", str(s or "").lower()).strip("_")
    s = re.sub(r"_+", "_", s)
    return (s if s[:1].isalpha() else f"t_{s}")[:60] or f"t_{uuid.uuid4().hex[:6]}"


def create_template(account_id: str, name: str, category: str, language: str, body: str, example_name: str = "أحمد", button: str = "") -> dict:
    if category not in CATEGORIES or language not in LANGS:
        raise WaError("نوع أو لغة القالب غير معروفة")
    body = body.strip()[:1000]
    if not body:
        raise WaError("اكتب نص الرسالة")
    nums = sorted({int(n) for n in re.findall(r"\{\{(\d+)\}\}", body)})
    if nums and nums != list(range(1, len(nums) + 1)):
        raise WaError("يجب أن تكون المتغيرات {{1}} و{{2}} بالترتيب")
    comps = [{"type": "body", "text": body, **({"example": {"body_text": [[example_name] + ["مثال"] * (len(nums) - 1)]}} if nums else {})}]
    if category == "MARKETING":
        comps.append({"type": "footer", "text": STOP_FOOTER})
    if button.strip():
        comps.append({"type": "buttons", "buttons": [{"type": "quick_reply", "text": button.strip()[:25]}]})
    name = tpl_name(name)
    if mock():
        t = {"name": name, "language": language, "category": category, "status": "PENDING", "body": body, "footer": STOP_FOOTER if category == "MARKETING" else "", "vars": len(nums)}
        _M["templates"].append(t)
        return t
    _req("POST", "/whatsapp/templates", "إنشاء القالب", body={"accountId": account_id, "name": name, "category": category, "language": language, "components": comps})
    return {"name": name, "status": "PENDING"}


def delete_template(account_id: str, name: str) -> None:
    if mock():
        _M["templates"][:] = [t for t in _M["templates"] if t["name"] != name]
        return
    _req("DELETE", f"/whatsapp/templates/{name}", "حذف القالب", {"accountId": account_id})


def mock_review() -> None:
    """في التجربة: القالب يتوافق عليه بعد قليل مثل واتساب."""
    for t in _M["templates"]:
        if t["status"] == "PENDING":
            t["status"] = "APPROVED"


# ---------------------------------------------------------------- 📣 الحملات (Broadcast) والسلاسل (Sequences)
def _tpl_payload(t: dict, language: str, vars_: dict) -> dict:
    comps = []
    if vars_:
        comps.append({"type": "body", "parameters": [{"type": "text", "text": "{{contact.name}}" if v == "name" else str(v)[:60]}
                                                     for _, v in sorted(vars_.items(), key=lambda kv: int(kv[0]))]})
    return {"name": t, "language": language, **({"components": comps} if comps else {})}


def broadcast(account_id: str, name: str, template: str, language: str, vars_: dict, contact_ids: list[str], when: str | None) -> dict:
    """حملة لقايمة أشخاص (المشتركين فقط). when = ISO بتوقيت UTC للجدولة، أو فارغ يُرسل الآن."""
    if not contact_ids:
        raise WaError("لا يوجد مشتركين في هذه القائمة")
    if mock():
        b = {"id": f"mbc-{uuid.uuid4().hex[:6]}", "name": name, "template": template, "status": "scheduled" if when else "completed", "scheduled_at": when,
             "stats": {"total": len(contact_ids), "sent": 0 if when else len(contact_ids), "delivered": 0 if when else int(len(contact_ids) * .9),
                       "read": 0 if when else int(len(contact_ids) * .6), "failed": 0}, "at": time.time()}
        _M["broadcasts"].append(b)
        return b
    d = _req("POST", "/broadcasts", "إنشاء الحملة", body={"profileId": publisher.tenant_profile() or publisher.default_profile(), "accountId": account_id,
                                                       "platform": "whatsapp", "name": name[:100], "template": _tpl_payload(template, language, vars_)})
    bc = (d.get("broadcast") or d) if isinstance(d, dict) else {}
    bid = str(bc.get("_id") or bc.get("id") or "")
    if not bid:
        raise WaError("تعذّر إنشاء الحملة")
    for i in range(0, len(contact_ids), 500):
        _req("POST", f"/broadcasts/{bid}/recipients", "إضافة الأشخاص للحملة", body={"contactIds": contact_ids[i:i + 500]})
    if when:
        _req("POST", f"/broadcasts/{bid}/schedule", "جدولة الحملة", body={"scheduledAt": when})
    else:
        _req("POST", f"/broadcasts/{bid}/send", "إرسال الحملة", body={})
    return {"id": bid, "name": name}


def _norm_bc(b: dict) -> dict:
    st = b.get("stats") or {}
    return {"id": str(b.get("_id") or b.get("id") or ""), "name": b.get("name") or "", "status": str(b.get("status") or "").lower(),
            "scheduled_at": b.get("scheduledAt"), "template": (b.get("template") or {}).get("name") if isinstance(b.get("template"), dict) else b.get("template"),
            "stats": {k: st.get(k) for k in ("total", "sent", "delivered", "read", "failed") if k in st} or {"total": b.get("recipientCount")}}


def broadcasts(ids: set[str]) -> list[dict]:
    if mock():
        return [b for b in _M["broadcasts"] if b["id"] in ids]
    data = _req("GET", "/broadcasts", "قراءة الحملات", {"profileId": publisher.tenant_profile(), "platform": "whatsapp", "limit": 100})
    return [x for x in (_norm_bc(b) for b in publisher._pick(data, "broadcasts") if isinstance(b, dict)) if x["id"] in ids]


def cancel_broadcast(bc_id: str) -> None:
    if mock():
        for b in _M["broadcasts"]:
            if b["id"] == bc_id:
                b["status"] = "cancelled"
        return
    _req("POST", f"/broadcasts/{bc_id}/cancel", "إلغاء الحملة", body={})


def sequence(account_id: str, name: str, steps: list[dict], language: str) -> dict:
    """سلسلة متابعة: كل خطوة قالب بعد مدة. أي حد يرد أو يلغي يخرج منها تلقائيًا."""
    if not 1 <= len(steps) <= MAX_STEPS:
        raise WaError(f"السلسلة من خطوة لـ {MAX_STEPS} خطوات")
    body_steps = []
    for n, s in enumerate(steps, 1):
        mapping = {k: ({"field": "name"} if v == "name" else {"field": "custom", "customValue": str(v)[:60]}) for k, v in (s.get("vars") or {}).items()}
        body_steps.append({"order": n, "delayMinutes": max(0, int(s.get("delay_hours") or 0)) * 60 if n > 1 else 0,
                           "template": {"name": s["template"], "language": language, **({"variableMapping": mapping} if mapping else {})}})
    if mock():
        q = {"id": f"msq-{uuid.uuid4().hex[:6]}", "name": name, "status": "active", "steps": len(body_steps), "enrolled": 0, "at": time.time()}
        _M["sequences"].append(q)
        return q
    d = _req("POST", "/sequences", "إنشاء السلسلة", body={"profileId": publisher.tenant_profile() or publisher.default_profile(), "accountId": account_id,
                                                       "platform": "whatsapp", "name": name[:100], "exitOnReply": True, "exitOnUnsubscribe": True, "steps": body_steps})
    sq = (d.get("sequence") or d) if isinstance(d, dict) else {}
    sid = str(sq.get("_id") or sq.get("id") or "")
    if not sid:
        raise WaError("تعذّر إنشاء السلسلة")
    _req("POST", f"/sequences/{sid}/activate", "تشغيل السلسلة", body={})
    return {"id": sid, "name": name}


def enroll(seq_id: str, contact_ids: list[str]) -> int:
    if mock():
        for q in _M["sequences"]:
            if q["id"] == seq_id:
                q["enrolled"] += len(contact_ids)
        return len(contact_ids)
    total = 0
    for i in range(0, len(contact_ids), 500):
        d = _req("POST", f"/sequences/{seq_id}/enroll", "إضافة الأشخاص للسلسلة", body={"contactIds": contact_ids[i:i + 500]})
        total += int(d.get("enrolled") or 0) if isinstance(d, dict) else 0
    return total


def sequences(ids: set[str]) -> list[dict]:
    if mock():
        return [q for q in _M["sequences"] if q["id"] in ids]
    data = _req("GET", "/sequences", "قراءة السلاسل", {"profileId": publisher.tenant_profile(), "platform": "whatsapp"})
    out = []
    for q in publisher._pick(data, "sequences"):
        if isinstance(q, dict) and str(q.get("_id") or q.get("id")) in ids:
            st = q.get("stats") or q.get("enrollmentStats") or {}
            out.append({"id": str(q.get("_id") or q.get("id")), "name": q.get("name") or "", "status": str(q.get("status") or "").lower(),
                        "steps": len(q.get("steps") or []), "enrolled": st.get("total") or st.get("active") or q.get("enrollmentCount") or 0})
    return out


def toggle_sequence(seq_id: str, on: bool) -> None:
    if mock():
        for q in _M["sequences"]:
            if q["id"] == seq_id:
                q["status"] = "active" if on else "paused"
        return
    _req("POST", f"/sequences/{seq_id}/{'activate' if on else 'pause'}", "تشغيل/إيقاف السلسلة", body={})


# ---------------------------------------------------------------- 💬 «علّق بكلمة»: كومنت على بوست إنستجرام/فيسبوك ← رسالة فيها لينك الواتساب
def platform_post_id(remote_id: str, platform: str) -> str:
    if mock():
        return f"17890000{abs(hash(remote_id)) % 100000}"
    d = _req("GET", f"/posts/{remote_id}", "قراءة المنشور")
    post = d.get("post", d) if isinstance(d, dict) else {}
    remote = publisher.PLATFORMS.get(platform, (platform,))[0]
    for p in post.get("platforms") or []:
        if isinstance(p, dict) and str(p.get("platform")).lower() == remote and p.get("platformPostId"):
            return str(p["platformPostId"])
    raise WaError("لم يُنشر هذا المنشور على هذه المنصة بعد")


def comment_automation(account_id: str, post_pid: str, name: str, keywords: list[str], dm: str, reply: str) -> dict:
    body = {"accountId": account_id, "platformPostId": post_pid, "name": name[:100],
            "keywords": [k.strip()[:30] for k in keywords if k.strip()][:10], "matchMode": "contains", "dmMessage": dm[:900], **({"commentReply": reply[:200]} if reply else {})}
    if not body["keywords"]:
        raise WaError("اكتب كلمة واحدة على الأقل")
    if not mock():
        body["profileId"] = publisher.tenant_profile() or publisher.default_profile()
    if mock():
        a = {"id": f"mca-{uuid.uuid4().hex[:6]}", "name": name, "keywords": body["keywords"], "active": True, "stats": {"sent": 0}, "at": time.time()}
        _M["automations"].append(a)
        return a
    d = _req("POST", "/comment-automations", "إنشاء الرد التلقائي", body=body)
    a = (d.get("automation") or d) if isinstance(d, dict) else {}
    return {"id": str(a.get("_id") or a.get("id") or ""), "name": name}


def automations(ids: set[str]) -> list[dict]:
    if mock():
        return [a for a in _M["automations"] if a["id"] in ids]
    data = _req("GET", "/comment-automations", "قراءة الردود التلقائية", {"profileId": publisher.tenant_profile()})
    out = []
    for a in publisher._pick(data, "automations"):
        if isinstance(a, dict) and str(a.get("_id") or a.get("id")) in ids:
            out.append({"id": str(a.get("_id") or a.get("id")), "name": a.get("name") or "", "keywords": a.get("keywords") or [],
                        "active": a.get("isActive", a.get("active", True)) is not False, "stats": a.get("stats") or {}})
    return out


def toggle_automation(aid: str, on: bool) -> None:
    if mock():
        for a in _M["automations"]:
            if a["id"] == aid:
                a["active"] = on
        return
    _req("PATCH", f"/comment-automations/{aid}", "تعديل الرد التلقائي", body={"isActive": on})


def delete_automation(aid: str) -> None:
    if mock():
        _M["automations"][:] = [a for a in _M["automations"] if a["id"] != aid]
        return
    _req("DELETE", f"/comment-automations/{aid}", "حذف الرد التلقائي")


def tpl_messages(brand: str, aud: dict, goal: str, category: str) -> list[dict]:
    return [{"role": "system", "content": "You write WhatsApp Business message templates that Meta approves. Return JSON only."},
            {"role": "user", "content": f"""Brand: {brand[:1500]}
Audience: {aud.get("summary", "")}
Questions they ask: {"; ".join((aud.get("questions") or [])[:5])}
Goal of this message: «{goal[:400]}». Category: {category}.
Write ONE template body in the brand market's Arabic dialect, friendly and short (max 400 chars), starting with a greeting that uses {{{{1}}}} for the customer's first name.
Rules Meta checks: no misleading claims, no threats or fake urgency, no ALL CAPS, no more than 2 emojis, the message must make sense on its own, don't end with a variable.
Return JSON: {{"name": "snake_case_english_name", "body": "...", "button": "quick reply text max 20 chars or empty"}}"""}]
