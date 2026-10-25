// 💬 مساعد الدعم: فقاعة صغيرة تحت على اليمين، بتفتح شات بيعرف انت في أنهي صفحة.
// فوق كل صفحة زرار «اشرح لي «الصفحة»» بيفتح الشات ويسأل السؤال ده على طول. ولو المساعد مقدرش يحل، «أرسلها للدعم» بتبعت تذكرة.
const Help = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { open: false, msgs: [], busy: false, names: {} };
  const CSS = `
.hp-fab{position:fixed;bottom:calc(22px + env(safe-area-inset-bottom,0px));right:calc(22px + env(safe-area-inset-right,0px));z-index:80;width:52px;height:52px;border-radius:50%;border:0;background:var(--nh-ink, var(--text, #181718));color:var(--nh-bg,#fff);display:grid;place-items:center;cursor:pointer;box-shadow:0 14px 30px -10px rgba(24,23,24,.5);transition:transform .2s}
.hp-fab:hover{box-shadow:0 18px 36px -10px rgba(24,23,24,.6)}
.hp-fab::before{content:"";position:absolute;inset:-10px;border-radius:50%}
.hp-fab .fx-snake{color:var(--nh-accent, var(--accent))}
.hp-tease{position:fixed;bottom:calc(86px + env(safe-area-inset-bottom,0px));right:calc(22px + env(safe-area-inset-right,0px));z-index:80;display:flex;align-items:center;gap:4px;max-width:min(320px,calc(100vw - 40px));background:var(--card,#fff);color:var(--nh-ink, var(--text, #181718));border-radius:18px 18px 6px 18px;box-shadow:0 14px 34px -14px rgba(24,23,24,.45);padding:4px 4px 4px 6px;direction:rtl;font-family:var(--nh-arabic,"Jost","Alexandria",sans-serif);animation:hpIn .35s cubic-bezier(.2,.8,.2,1)}
.hp-tease[hidden]{display:none}
.hp-tease button{border:0;background:none;font:inherit;color:inherit;cursor:pointer}
.hp-tease [data-hpt]{font-size:13px;padding:8px 10px;text-align:start;line-height:1.5}
.hp-tease [data-hpt]:hover{color:var(--nh-accent, var(--accent))}
.hp-tease [data-hptx]{font-size:11px;color:var(--nh-muted, var(--muted, #6B6B67));padding:6px 8px}
@keyframes hpIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.hp-fab svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linejoin:round}
.hp-box{position:fixed;bottom:calc(86px + env(safe-area-inset-bottom,0px));right:calc(22px + env(safe-area-inset-right,0px));z-index:81;width:min(380px,calc(100vw - 32px));height:min(540px,calc(100vh - 140px));background:var(--card,#fff);color:var(--nh-ink, var(--text, #181718));border-radius:22px;box-shadow:0 24px 60px -20px rgba(24,23,24,.45);display:flex;flex-direction:column;overflow:hidden;direction:rtl;font-family:var(--nh-arabic,"Jost","Alexandria",sans-serif)}
.hp-box[hidden]{display:none}
.hp-h{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 10px}
.hp-h b{font-size:15px;font-weight:500}
.hp-x{border:0;background:none;font-size:16px;color:var(--nh-muted, var(--muted, #6B6B67));cursor:pointer;padding:4px}
.hp-log{flex:1;overflow:auto;padding:4px 18px 10px;display:flex;flex-direction:column;gap:10px}
.hp-m{max-width:88%;font-size:13.5px;line-height:1.75;white-space:pre-line;padding:9px 13px;border-radius:16px}
.hp-m.me{align-self:flex-start;background:var(--nh-ink, var(--text, #181718));color:var(--nh-bg,#fff);border-bottom-right-radius:4px}
.hp-m.ai{align-self:flex-end;background:var(--nh-bg,#F3F2EF);border-bottom-left-radius:4px}
.hp-sug{display:flex;flex-wrap:wrap;gap:6px;padding:0 18px 8px}
.hp-sug button{border:0;background:var(--nh-bg,#F3F2EF);color:var(--nh-ink, var(--text, #181718));font:inherit;font-size:12.5px;padding:6px 12px;border-radius:999px;cursor:pointer}
.hp-sug button:hover{color:var(--nh-accent, var(--accent))}
.hp-in{display:flex;gap:8px;padding:10px 12px 12px;border-top:1px solid var(--nh-line,rgba(24,23,24,.08))}
.hp-in textarea{flex:1;resize:none;border:0;background:none;font:inherit;font-size:14px;color:inherit;outline:none;padding:6px 4px;max-height:96px}
.hp-in button{border:0;width:38px;height:38px;border-radius:50%;background:var(--nh-accent, var(--accent));color:#fff;cursor:pointer;display:grid;place-items:center;flex:none}
.hp-in button:disabled{opacity:.5;cursor:default}
.nh-ask{border:0;background:none;font:inherit;font-size:12.5px;color:var(--nh-muted, var(--muted, #6B6B67));cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:4px 0 0}
.nh-ask:hover{color:var(--nh-accent, var(--accent))}
.nh-ask svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}
@media (prefers-reduced-motion:reduce){.hp-fab{transition:none}.hp-tease{animation:none}}`;
  const ICON_Q = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 17h.01"/></svg>`;
  // الصفحة اللي العميل فيها دلوقتي (الرئيسية لو مفيش صفحة مفتوحة)
  const pageKey = () => (document.getElementById("nhPage")?.hidden !== false ? "home" : document.getElementById("nhPGrid")?.dataset.key || "home");
  const pageName = (k) => S.names[k]?.name || "هذه الصفحة";
  function draw() {
    const box = document.querySelector(".hp-box");
    if (!box) return;
    box.hidden = !S.open;
    const k = pageKey();
    box.querySelector(".hp-log").innerHTML = (S.msgs.length ? S.msgs : [{ role: "assistant", text: "أهلًا، أنا مساعد سمسم كيت. اسألني عن أي صفحة أو خطوة." }])
      .map((m) => `<div class="hp-m ${m.role === "user" ? "me" : "ai"}">${esc(m.text)}</div>`).join("") + (S.busy ? `<div class="hp-m ai">…</div>` : "");
    box.querySelector(".hp-sug").innerHTML = [`اشرح لي «${pageName(k)}»`, "كيف تُحسب النقاط؟", ...(S.msgs.some((m) => m.role === "assistant") ? ["أرسلها للدعم"] : [])]
      .map((t) => `<button type="button" data-hpq="${esc(t)}">${esc(t)}</button>`).join("");
    const log = box.querySelector(".hp-log"); log.scrollTop = log.scrollHeight;
    box.querySelector("[data-hpsend]").disabled = S.busy;
  }
  async function ask(q) {
    q = String(q || "").trim();
    if (!q || S.busy) return;
    if (q === "أرسلها للدعم") return ticket();
    S.msgs.push({ role: "user", text: q }); S.busy = true; draw();
    try {
      const r = await api("/api/help/chat", { method: "POST", ...jsonBody({ page: pageKey(), q, history: S.msgs.slice(0, -1) }) });
      S.msgs.push({ role: "assistant", text: r.text });
    } catch (err) { S.msgs.push({ role: "assistant", text: `⚠️ ${err.message}` }); }
    S.busy = false; draw();
  }
  async function ticket() {
    const last = [...S.msgs].reverse().find((m) => m.role === "user")?.text || "";
    const text = await uiPrompt("اكتب المشكلة باختصار، وسنرد عليك:", last);
    if (text == null || !text.trim()) return;
    try { await api("/api/help/ticket", { method: "POST", ...jsonBody({ page: pageKey(), text, history: S.msgs }) }); S.msgs.push({ role: "assistant", text: "✓ وصلت المشكلة للدعم، وسنرد عليك قريبًا." }); }
    catch (err) { S.msgs.push({ role: "assistant", text: `⚠️ ${err.message}` }); }
    draw();
  }
  function toggle(on = !S.open) { S.open = on; draw(); tease(); if (on) setTimeout(() => document.querySelector(".hp-in textarea")?.focus(), 30); }
  // «اشرح لي» فوق الفقاعة: بيظهر في كل صفحة جديدة، ولو العميل قفله بيرجع تاني أول ما يدخل صفحة تانية
  function tease() {
    const t = document.querySelector(".hp-tease");
    if (!t) return;
    const k = pageKey(), show = !S.open && k !== "home" && k !== "create" && S.closed !== k && !!S.names[k];
    t.hidden = !show;
    if (show) t.querySelector("[data-hpt]").textContent = `اشرح لي «${pageName(k)}»`;
  }
  // زرار «اشرح لي» تحت عنوان الصفحة (بيتحط في titleHTML في home2.js)
  const askBtn = (key, name) => `<button type="button" class="nh-ask" data-hpask="${esc(key)}">${ICON_Q}اشرح لي «${esc(name)}»</button>`;
  function mount() {
    if (document.querySelector(".hp-fab")) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    const fab = document.createElement("button");
    fab.type = "button"; fab.className = "hp-fab"; fab.setAttribute("aria-label", "المساعد"); fab.title = "المساعد";
    fab.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>`;
    const box = document.createElement("div");
    box.className = "hp-box"; box.hidden = true; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "المساعد");
    box.innerHTML = `<div class="hp-h"><b>المساعد</b><button type="button" class="hp-x" data-hpx aria-label="إغلاق">✕</button></div>
      <div class="hp-log" aria-live="polite"></div><div class="hp-sug"></div>
      <form class="hp-in"><textarea rows="1" placeholder="اكتب سؤالك…" aria-label="سؤالك"></textarea>
        <button type="submit" data-hpsend aria-label="أرسل"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12H4M10 6l-6 6 6 6"/></svg></button></form>`;
    const t = document.createElement("div");
    t.className = "hp-tease"; t.hidden = true; t.dataset.nofx = "";
    t.innerHTML = `<button type="button" data-hpt></button><button type="button" data-hptx aria-label="إخفاء">✕</button>`;
    t.addEventListener("click", (e) => {
      if (e.target.closest("[data-hptx]")) { S.closed = pageKey(); return tease(); }
      toggle(true); ask(`اشرح لي «${pageName(pageKey())}»`);
    });
    document.body.append(fab, box, t);
    let last = "";
    setInterval(() => { const k = pageKey(); if (k !== last) { last = k; if (S.closed && S.closed !== k) S.closed = null; tease(); } }, 700);
    fab.addEventListener("click", () => toggle());
    box.addEventListener("click", (e) => {
      if (e.target.closest("[data-hpx]")) return toggle(false);
      const b = e.target.closest("[data-hpq]"); if (b) ask(b.dataset.hpq);
    });
    const ta = box.querySelector("textarea");
    box.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); const q = ta.value; ta.value = ""; ask(q); });
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); box.querySelector("form").requestSubmit(); } });
    document.addEventListener("click", (e) => {
      const a = e.target.closest("[data-hpask]");
      if (!a) return;
      toggle(true); ask(`اشرح لي «${pageName(a.dataset.hpask)}»`);
    });
    api("/api/help/pages").then((x) => { S.names = x; draw(); tease(); }).catch(() => {});
    draw();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
  return { askBtn, ask, toggle };
})();
