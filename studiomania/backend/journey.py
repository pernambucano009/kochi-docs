"""🧭 الفحص الشامل (رحلة التجربة): عميل تجريبي بيمشي في البرنامج زي العميل بالظبط، على نفس السيرفر، بنقاط حقيقية.

البوابة بتشغّله من صفحة الأدمن (/admin/inspect) كعملية لوحده:
    python journey.py --base http://127.0.0.1:8000 --out <فولدر التشغيلة> --phase 1 [--niches food,tech]
والباسورد بتاع حساب التجربة بييجي في JOURNEY_PASSWORD. ومن غير --email بيشتغل على البرنامج المحلي (وضع التجربة، من غير بوابة).

بيكتب في فولدر التشغيلة:
- status.json: الحالة والخطوة الحالية (صفحة الأدمن بتقراه وهو شغال)
- report.json: كل خطوة (نجحت ولا لا، النقاط، الوقت، الخطأ)، والنتايج اللي تتراجع بالعين، وخريطة الكلام، والرسايل اللي ظهرت
- shots/: صور الشاشات بالعربي والإنجليزي · video/: فيديو لكل مجال
"""
from __future__ import annotations

import argparse
import json
import os
import re
import secrets
import time
import traceback
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
BRANDS = json.loads((HERE / "journey_brands.json").read_text(encoding="utf-8"))
AR = re.compile(r"[؀-ۿ]")
_DW = json.loads((HERE / "dialect_words.json").read_text(encoding="utf-8"))
DIAL = re.compile("(?<![ء-ي])(" + "|".join(w.replace(" ", r"\s") for w in _DW) + ")(?![ء-ي])")
BVERB = re.compile("(?<![ء-ي])(بي|بت|بن)(عمل|قول|تكلم|شتغل|ظهر|جيب|دور|حصل|كتب|رسم|حكي|غني|تحرك|تحول|تجمع|تفتح|طلع|نزل|خلص|ضيف|شيل|حط|بعت|ساعد"
                   "|عرف|فهم|شوف|لف|تغير|كبر|صغر|ترسم|ترمي|تكلم|تتحرك|تبني|توطى|يتكلم|يعمل|يقول)")
# الشاشات اللي بتتصوّر وتتجرد كلمة كلمة في كل مرحلة
SCREENS = {"1": ["#home", "#brand", "#plan", "#rivals", "#viral", "#brainlib"]}

# 🔎 بيتحط في كل صفحة: بيلم كل رسالة بتظهر (التوست والنوافذ) عشان تتسجل
WATCH_JS = r"""
(() => {
  window.__msgs = [];
  const push = (kind, el) => { const t = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim(); if (t && !window.__msgs.some((m) => m.t === t)) window.__msgs.push({ kind, t: t.slice(0, 400), err: el.classList.contains("error") }); };
  const go = () => new MutationObserver(() => {
    const t = document.getElementById("toast"); if (t && !t.hidden) push("toast", t);
    document.querySelectorAll(".ui-dlg").forEach((d) => push("dialog", d));
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class"] });
  if (document.documentElement) go(); else document.addEventListener("DOMContentLoaded", go);
})();
"""
# 🗺️ خريطة الكلام: كل جملة ظاهرة في الشاشة ومكانها (عنصرها)، من غير كلام العميل (خانات الكتابة واللي متعلّم data-no-i18n)
TEXT_JS = r"""
(() => {
  const AR = /[؀-ۿ]/, out = [];
  const where = (el) => {
    const path = [];
    for (let e = el; e && e !== document.body && path.length < 4; e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      if (e.id) { path.unshift(s + "#" + e.id); break; }
      const c = [...e.classList].slice(0, 2).join("."); if (c) s += "." + c;
      const d = [...e.attributes].find((a) => a.name.startsWith("data-") && !/^data-(i18n|tip|ph|orig)/.test(a.name)); if (d) s += `[${d.name}]`;
      path.unshift(s);
    }
    return path.join(" › ");
  };
  const vis = (el) => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none"; };
  const own = (el) => el.closest("[data-no-i18n], [contenteditable], textarea, input");
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    const v = n.nodeValue.replace(/\s+/g, " ").trim(), el = n.parentElement;
    if (!v || !AR.test(v) || !el || ["SCRIPT", "STYLE"].includes(el.tagName) || own(el) || !vis(el)) continue;
    out.push({ t: v, kind: el.closest("button, [role=button], a") ? "زر" : /^H\d$/.test(el.tagName) ? "عنوان" : "نص", at: where(el) });
  }
  for (const el of document.querySelectorAll("[placeholder], [title], [aria-label], [data-tip], [data-ph]")) {
    if (el.closest("[data-no-i18n]")) continue;
    for (const [a, k] of [["placeholder", "نص رمادي"], ["data-ph", "نص رمادي"], ["title", "تلميح"], ["data-tip", "تلميح"], ["aria-label", "وصف لقارئ الشاشة"]]) {
      const v = (el.getAttribute(a) || "").replace(/\s+/g, " ").trim();
      if (v && AR.test(v)) out.push({ t: v, kind: k, at: where(el) });
    }
  }
  return out;
})()
"""


def dialect_of(s: str) -> str | None:
    m = DIAL.search(s) or BVERB.search(s)
    return m.group(0) if m else None


class Journey:
    def __init__(self, base: str, out: Path, phase: str, niches: list[str], email: str, password: str):
        self.base, self.out, self.phase, self.email, self.pw = base.rstrip("/"), out, phase, email, password
        self.live = bool(email)
        self.brands = [b for b in BRANDS if not niches or b["niche"] in niches]
        for d in ("shots", "video"):
            (out / d).mkdir(parents=True, exist_ok=True)
        self.R = {"phase": phase, "at": time.time(), "steps": [], "outputs": [], "messages": [], "errors": [],
                  "textmap": {}, "lang": {"en_arabic": [], "ui_dialect": []}}
        self.content: set[str] = set()   # كل الكلام اللي رجع من السيرفر (محتوى العلامة ونتايج الذكاء الاصطناعي)
        self.status("starting", "تجهيز")

    # ---------- الحالة والتقرير ----------
    def status(self, state: str, step: str = "") -> None:
        (self.out / "status.json").write_text(json.dumps({"state": state, "step": step, "at": time.time(), "phase": self.phase,
                                                          "done": len(self.R["steps"])}, ensure_ascii=False))

    def write(self) -> None:
        R = self.R
        ok = sum(1 for s in R["steps"] if s["ok"])
        credits = sum(s.get("credits") or 0 for s in R["steps"])
        R["total"] = {"steps": len(R["steps"]), "ok": ok, "failed": len(R["steps"]) - ok, "credits": credits, "usd": round(credits / 300, 2)}
        (self.out / "report.json").write_text(json.dumps(R, ensure_ascii=False, indent=1, default=sorted))

    def grab(self, v) -> None:
        if isinstance(v, str):
            if AR.search(v) and len(v) > 1:
                self.content.add(re.sub(r"\s+", " ", v).strip())
        elif isinstance(v, dict):
            for x in v.values():
                self.grab(x)
        elif isinstance(v, list):
            for x in v:
                self.grab(x)

    def is_content(self, s: str) -> bool:
        n = re.sub(r"\s+", " ", s).rstrip("…").strip()
        return len(n) > 1 and any(n in c for c in self.content)

    # ---------- التشغيل ----------
    def run(self) -> None:
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(executable_path=os.environ.get("JOURNEY_CHROMIUM") or None)
                login = browser.new_context(base_url=self.base)
                if self.live:
                    r = login.request.post("/api/auth/login", data={"email": self.email, "password": self.pw})
                else:
                    st = login.request.get("/api/auth/state").json()
                    if st.get("setup") or st.get("needs_setup"):
                        login.request.post("/api/auth/setup", data={"password": self.pw})
                    r = login.request.post("/api/auth/login", data={"password": self.pw})
                if not r.ok:
                    raise RuntimeError(f"دخول حساب التجربة فشل: {r.status} {r.text()[:200]}")
                storage = login.storage_state()
                login.close()
                for i, brand in enumerate(self.brands):
                    self.brand(browser, storage, brand, i)
                    self.write()
                browser.close()
            self.finish("done")
        except Exception as exc:   # noqa: BLE001
            self.R["errors"].append("الفحص توقف: " + "".join(traceback.format_exception_only(type(exc), exc)).strip()[:800])
            self.finish("failed")

    def finish(self, state: str) -> None:
        R = self.R
        en = {t: w for t, w in R.pop("_en", {}).items() if not re.fullmatch(r"[\s\d٠-٩.,:%·]+", t)}
        R["lang"]["en_arabic"] = [{"text": t, "where": w, "content": self.is_content(t)} for t, w in en.items()]
        R["lang"]["ui_dialect"] = [{"text": t, **v} for t, v in R.pop("_dial", {}).items() if not self.is_content(t)]
        # خريطة الكلام: جملة ← أماكن ظهورها، وترجمتها، ومن غير كلام العميل
        R["textmap"] = [{"text": t, **v, "places": sorted(v["places"])[:20]} for t, v in R["textmap"].items() if not self.is_content(t)]
        R["errors"] = list(dict.fromkeys(R["errors"]))
        self.write()
        self.status(state, "")

    def brand(self, browser, storage, brand: dict, idx: int) -> None:
        niche = brand["niche"]
        ctx = browser.new_context(base_url=self.base, storage_state=storage, viewport={"width": 1440, "height": 900},
                                  record_video_dir=str(self.out / "video"), record_video_size={"width": 1280, "height": 800})
        ctx.add_init_script(WATCH_JS)
        page = ctx.new_page()
        page.on("dialog", lambda d: d.dismiss())
        page.on("pageerror", lambda e: self.R["errors"].append(f"[{niche}] خطأ في الصفحة: {str(e)[:200]}"))

        def on_resp(r):
            try:
                if "/api/" not in r.url:
                    return
                if r.status >= 400 and not (not self.live and r.url.endswith("/api/me")):
                    self.R["errors"].append(f"[{niche}] {r.request.method} {r.url.split('/api/', 1)[1][:80]} → {r.status} {r.text()[:200]}")
                elif "json" in (r.headers.get("content-type") or ""):
                    self.grab(r.json())
            except Exception:   # noqa: BLE001
                pass
        page.on("response", on_resp)
        req = ctx.request

        def j(method: str, url: str, data=None, form=None):
            kw = {"method": method, "timeout": 180000}
            if form is not None:
                kw["multipart"] = form
            elif data is not None:
                kw["data"] = data
            r = req.fetch(url, **kw)
            try:
                body = r.json()
            except Exception:   # noqa: BLE001
                body = r.text()
            self.grab(body)
            if not r.ok:
                detail = body.get("detail") if isinstance(body, dict) else body
                raise RuntimeError(f"{r.status} {detail}"[:400])
            return body

        def poll(url: str, done, secs: int = 240):
            t0 = time.time()
            while time.time() - t0 < secs:
                last = j("GET", url)
                if done(last):
                    return last
                time.sleep(3)
            raise RuntimeError(f"انتهى وقت الانتظار ({secs} ث)")

        def balance():
            if not self.live:
                return None
            try:
                b = req.get("/api/billing").json()
                w = b.get("wallet") or b
                return w.get("total")
            except Exception:   # noqa: BLE001
                return None

        def out(kind: str, title: str, text: str = "", media: str = "") -> None:
            self.R["outputs"].append({"id": f"{niche}-{len(self.R['outputs'])}", "niche": niche, "brand": brand["name"], "kind": kind,
                                      "title": title, "text": str(text)[:6000], "media": media})

        def step(name: str, fn) -> bool:
            self.status("running", f"{brand['name']} · {name}")
            b0, t0 = balance(), time.time()
            s = {"niche": niche, "brand": brand["name"], "step": name, "ok": True}
            try:
                note = fn()
                if note:
                    s["note"] = str(note)[:600]
            except Exception as exc:   # noqa: BLE001
                s["ok"], s["error"] = False, str(exc)[:600]
            b1 = balance()
            s["secs"] = round(time.time() - t0)
            if b0 is not None and b1 is not None:
                s["credits"] = b0 - b1
                s["usd"] = round(s["credits"] / 300, 3)
            self.R["steps"].append(s)
            print(("✅" if s["ok"] else "❌"), niche, name, s.get("credits", ""), s.get("error", ""), flush=True)
            return s["ok"]

        st: dict = {}
        A = brand["a"]

        def create():
            b = j("POST", "/api/ad-brains", {"name": brand["name"], "fields": {}})
            st["bid"] = b["id"]
            j("PUT", "/api/clients/active", {"id": b["id"]})
        step("إنشاء العلامة وتفعيلها", create)
        bid = st.get("bid")
        if not bid:
            ctx.close()
            return

        def quiz():
            n = 0
            for q in j("GET", "/api/brain-quiz?lang=ar"):
                if A.get(q["id"]):
                    j("POST", f"/api/ad-brains/{bid}/quiz", {"qid": q["id"], "answer": A[q["id"]], "lang": "ar"})
                    n += 1
            p = j("GET", f"/api/ad-brains/{bid}/plan")
            miss = [i["t"] for i in (p.get("know") or {}).get("items") or [] if not i.get("done")]
            return f"أجاب {n} سؤالًا · العقل يفهمه {p['score']}٪ (المطلوب للخطة {p['need']}٪) · الناقص: {'، '.join(miss)}"
        step("أسئلة العقل", quiz)

        def source():
            j("POST", f"/api/ad-brains/{bid}/sources",
              form={"text": f"{A['about']}\n{A['proof'].replace(chr(10), '، ')}\n{A['offer']}", "note": "ملاحظات صاحب العلامة"})
            b = poll(f"/api/ad-brains/{bid}", lambda x: not any(re.search("work|pending|run", s.get("status") or "") for s in x.get("sources") or []), 180)
            pend = [p for p in b.get("pending") or [] if p.get("id")]
            for p in pend:
                out("اقتراح من العقل", p.get("title") or p.get("field") or p.get("kind"), p.get("value") or p.get("summary") or p.get("q") or "")
                j("POST", f"/api/ad-brains/{bid}/pending/{p['id']}/approve", {"value": A["audience"]} if p.get("kind") == "question" else {})
            return f"{len(pend)} اقتراح وافقنا عليه ({'، '.join(p.get('kind', '') for p in pend)})"
        step("مصدر نصي للعقل ← اقتراحات ← موافقة", source)

        def logo():
            lp = ctx.new_page()
            lp.set_viewport_size({"width": 512, "height": 512})
            lp.set_content(f'<body style="margin:0;display:grid;place-items:center;height:512px;background:#fff"><div style="width:420px;height:420px;'
                           f'border-radius:50%;background:{brand["palette"].split(",")[0]};display:grid;place-items:center;color:#fff;'
                           f'font:bold 220px sans-serif">{brand["name"].strip()[0]}</div></body>')
            png = lp.screenshot(type="png")
            lp.close()
            j("POST", f"/api/ad-brains/{bid}/assets", form={"kind": "logos", "files": {"name": "logo.png", "mimeType": "image/png", "buffer": png}})
            b = poll(f"/api/ad-brains/{bid}", lambda x: x.get("status") != "working", 240)
            for k in ("palette", "theme", "ui_style", "logo_description", "style"):
                if b.get(k):
                    out("استنباط الهوية من الشعار", k, b[k])
            return f"{len(b.get('logos') or [])} شعار · الحالة: {b.get('status')} {b.get('error') or ''}"
        step("رفع الشعار", logo)

        step("ألوان العلامة", lambda: j("PATCH", f"/api/ad-brains/{bid}", {"fields": {"palette": brand["palette"]}}) and None)

        def typo():
            b = j("POST", f"/api/ad-brains/{bid}/suggest/typography")
            p = next((x for x in b.get("pending") or [] if x.get("kind") == "field" and x.get("field") == "typography"), None)
            if not p:
                raise RuntimeError("لا يوجد اقتراح")
            out("اقتراح الخطوط", "الخطوط", f"{p['value']}\n\nالسبب: {p.get('why') or ''}")
            j("POST", f"/api/ad-brains/{bid}/pending/{p['id']}/approve", {})
            return p["value"]
        step("اقتراح الخطوط ← قبوله", typo)

        def strategy():
            s = j("POST", "/api/strategy", {"notes": ""}).get("strategy") or {}
            out("الخطة (الاستراتيجية)", "الخطة", json.dumps(s, ensure_ascii=False, indent=1))
            return f"{len(s)} خانة"
        step("الخطة (الاستراتيجية)", strategy)

        def idea():
            lst = j("POST", "/api/my-ideas", form={"text": f"فكرة فيديو عن {A['pain']} وكيف {brand['name']} يحلّها"})
            items = (lst.get("items") or lst.get("saved")) if isinstance(lst, dict) else lst
            iid = (items or [{}])[-1].get("id")
            if not iid:
                raise RuntimeError("الفكرة لم تُحفظ")
            p = j("POST", f"/api/my-ideas/{iid}/polish")
            s = j("POST", f"/api/my-ideas/{iid}/script")
            def item(res):   # الرد ممكن يكون القايمة كلها أو الفكرة لوحدها
                rows = res if isinstance(res, list) else (res.get("items") or res.get("saved") or [])
                row = next((x for x in rows if isinstance(x, dict) and x.get("id") == iid), None)
                return (row or {}).get("item") or (res if isinstance(res, dict) else {})
            pi, si = item(p), item(s)
            out("تنقيح الفكرة", pi.get("title") or "الفكرة", f"{pi.get('idea') or ''}\n\nالخطاف: {pi.get('hook') or ''}")
            out("السكريبت", si.get("title") or "السكريبت", f"الخطاف: {si.get('hook') or ''}\n\n{si.get('script') or ''}\n\nالمصادر: "
                + json.dumps(si.get("sources") or [], ensure_ascii=False))
        step("فكرة ← تنقيح ← سكريبت", idea)

        def rivals():
            j("POST", "/api/rivals/discover")
            r = poll("/api/rivals", lambda x: x.get("status") != "working", 420)
            if r.get("status") == "failed":
                raise RuntimeError(r.get("error") or "فشل")
            pick = [i["id"] for i in r["items"] if i.get("state") != "approved"][:3]
            if pick:
                r = j("POST", "/api/rivals/review", {"approve": True, "ids": pick})
            out("المنافسون المقترحون", f"{len(r['items'])} منافس", "\n".join(f"{i.get('handle') or i.get('name')} · {i.get('platform', '')} · {i.get('why') or ''}"
                                                                         for i in r["items"]))
            if r.get("digest"):
                out("خلاصة المنافسين", "الخلاصة", json.dumps(r["digest"], ensure_ascii=False, indent=1))
            return f"{len(r['items'])} مقترح، وافقنا على {len(pick)}"
        step("منافسوك: اقتراح منافسين ← موافقة", rivals)

        def trends():
            j("POST", f"/api/ad-brains/{bid}/trends/refresh")
            t = poll(f"/api/ad-brains/{bid}/trends", lambda x: x.get("status") != "working", 420)
            if t.get("error"):
                raise RuntimeError(t["error"])
            out("الترند في المجال", f"{len(t['items'])} ترند", "\n\n".join(json.dumps(i, ensure_ascii=False) for i in t["items"][:10]))
            return f"{len(t['items'])} ترند"
        step("الترند في المجال", trends)

        def month():
            m0 = j("GET", "/api/plan/month")
            if not m0.get("ready"):
                raise RuntimeError(f"الخطة غير جاهزة: العقل {m0['score']}٪ من {m0['need']}٪")
            j("POST", "/api/plan/month", {"per_day": 1})
            m = poll("/api/plan/month", lambda x: x.get("status") != "working", 600)
            if m.get("status") == "failed":
                raise RuntimeError(m.get("error") or "فشلت")
            items = (m.get("month") or {}).get("items") or []
            out("خطة الشهر", f"{len(items)} منشور", "\n".join(f"{x.get('date', '')} {x.get('time', '')} · {x.get('title', '')} · {x.get('hook', '')} · {x.get('tpl', '')}"
                                                         for x in items))
            return f"{len(items)} منشور"
        step("خطة الشهر", month)

        # 📸 الشاشات بالعربي (خريطة الكلام + العامية) وبالإنجليزي (اللي ناقصه ترجمة)
        for scr in SCREENS.get(self.phase, SCREENS["1"]):
            for lang in ("ar", "en"):
                self.shot(page, brand, scr, lang)
        for m in page.evaluate("window.__msgs || []"):
            self.R["messages"].append({**m, "niche": niche})
        vid = page.video
        ctx.close()
        if vid:
            try:
                Path(vid.path()).rename(self.out / "video" / f"{idx + 1:02d}-{niche}.webm")
            except Exception:   # noqa: BLE001
                pass
        for f in (self.out / "video").glob("page@*.webm"):   # صفحة رسم الشعار اتسجلت هي كمان: مالهاش لازمة
            f.unlink(missing_ok=True)

    def shot(self, page, brand: dict, scr: str, lang: str) -> None:
        self.status("running", f"{brand['name']} · صورة {scr} ({lang})")
        page.goto("/")
        page.evaluate("(l) => { localStorage.setItem('studiomania.lang', l); localStorage.setItem('studiomania.i18n-audit', '1'); }", lang)
        page.goto("/" + scr)
        page.reload(wait_until="load")   # الشاشات بتسأل السيرفر كل شوية، فالصفحة مابتهداش: التحميل وبعدين ٣ ثواني
        page.wait_for_timeout(3000)
        for _ in range(3):   # نوافذ أول استخدام
            no = page.locator(".ui-dlg .ui-dlg-no:not([disabled])")
            if not no.count():
                break
            try:
                no.first.click(timeout=1500)
            except Exception:   # noqa: BLE001
                break
            page.wait_for_timeout(400)
        page.screenshot(path=str(self.out / "shots" / f"{brand['niche']}-{scr.lstrip('#')}-{lang}.png"), full_page=True)
        where = f"{brand['niche']} {scr}"
        if lang == "ar":
            for x in page.evaluate(TEXT_JS):
                e = self.R["textmap"].setdefault(x["t"], {"kind": x["kind"], "places": set(), "screens": []})
                e["places"].add(f"{scr} › {x['at']}")
                if scr not in e["screens"]:
                    e["screens"].append(scr)
                w = dialect_of(x["t"])
                if w:
                    self.R.setdefault("_dial", {}).setdefault(x["t"], {"where": where, "word": w})
        else:
            for x in page.evaluate("window.I18N?.misses?.() || []"):
                if AR.search(x) and len(x) > 1:
                    self.R.setdefault("_en", {}).setdefault(x, where)
            # الترجمة الإنجليزي لكل جملة في الخريطة (بقاموس البرنامج نفسه، والقاموس بيشتغل في الوضع الإنجليزي بس)
            texts = [t for t, v in self.R["textmap"].items() if "en" not in v]
            if texts:
                for t, e in zip(texts, page.evaluate("(xs) => xs.map((x) => (window.I18N && I18N.t ? I18N.t(x) : x))", texts)):
                    self.R["textmap"][t]["en"] = e
                    self.R["textmap"][t]["missing"] = bool(AR.search(e or ""))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--phase", default="1")
    ap.add_argument("--niches", default="")
    ap.add_argument("--email", default="")
    a = ap.parse_args()
    pw = os.environ.get("JOURNEY_PASSWORD") or ("Journey-pass-2026!" if not a.email else secrets.token_urlsafe(12))
    Journey(a.base, Path(a.out), a.phase, [x for x in a.niches.split(",") if x], a.email, pw).run()


if __name__ == "__main__":
    main()
