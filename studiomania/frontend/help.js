// 🟠 سعاد: الدايرة البرتقالي تحت على اليمين، ومكتوب جنبها اسمها (حسب لهجة العميل). هي المساعد كله: الدعم، وشرح الصفحات،
// والرسايل اللي بتبعتها هي (الفيديو خلص، إيه رأيك، الاشتراك). المحادثة محفوظة على السيرفر (/api/suad).
// العميل يكتب أو يبعت صور. المشترك بس يقدر يكلمها صوت (زرار السماعة بيفتح المكالمة).
// فوق الصفحة: شريط كبير طول ما في فيديو بيتعمل له (لو خرج ورجع بيلاقيه مكمّل)، ولما يخلص بيقول «جاهز».
const Help = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { open: false, msgs: [], busy: false, names: {}, name: "", paid: false, unread: 0, job: null, total: 0, rang: "" };
  const OR = "#E5613E";
  const CSS = `
.hp-fab{position:fixed;bottom:calc(22px + env(safe-area-inset-bottom,0px));right:calc(22px + env(safe-area-inset-right,0px));z-index:80;height:56px;min-width:56px;border-radius:999px;border:0;background:${OR};color:#fff;display:flex;align-items:center;gap:8px;padding:0 18px 0 8px;cursor:pointer;box-shadow:0 14px 30px -10px rgba(229,97,62,.65);transition:transform .2s;font:inherit}
.hp-fab:hover{transform:translateY(-2px)}
.hp-fab .dot{width:40px;height:40px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffb38f,#E5613E 60%,#c94a2a);box-shadow:inset 0 0 0 2px rgba(255,255,255,.35);flex:none;animation:hpPulse 2.6s ease-in-out infinite}
.hp-fab b{font-size:15px;font-weight:600;white-space:nowrap}
.hp-fab .bdg{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;border-radius:10px;background:#181718;color:#fff;font-size:11.5px;display:grid;place-items:center;padding:0 5px}
.hp-fab .bdg[hidden]{display:none}
@keyframes hpPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
.hp-tease{position:fixed;bottom:calc(90px + env(safe-area-inset-bottom,0px));right:calc(22px + env(safe-area-inset-right,0px));z-index:80;display:flex;align-items:center;gap:4px;max-width:min(320px,calc(100vw - 40px));background:var(--card,#fff);color:var(--nh-ink, var(--text, #181718));border-radius:18px 18px 6px 18px;box-shadow:0 14px 34px -14px rgba(24,23,24,.45);padding:4px 4px 4px 6px;direction:rtl;animation:hpIn .35s ease}
.hp-tease[hidden]{display:none}
.hp-tease button{border:0;background:none;font:inherit;color:inherit;cursor:pointer}
.hp-tease [data-hpt]{font-size:13px;padding:8px 10px;text-align:start;line-height:1.5}
.hp-tease [data-hpt]:hover{color:${OR}}
.hp-tease [data-hptx]{font-size:11px;color:var(--nh-muted, var(--muted, #6B6B67));padding:6px 8px}
@keyframes hpIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.hp-box{position:fixed;bottom:calc(90px + env(safe-area-inset-bottom,0px));right:calc(22px + env(safe-area-inset-right,0px));z-index:81;width:min(390px,calc(100vw - 32px));height:min(580px,calc(100vh - 140px));background:var(--card,#fff);color:var(--nh-ink, var(--text, #181718));border-radius:22px;box-shadow:0 24px 60px -20px rgba(24,23,24,.45);display:flex;flex-direction:column;overflow:hidden;direction:rtl}
.hp-box[hidden]{display:none}
.hp-h{display:flex;align-items:center;gap:10px;padding:14px 16px 10px;border-bottom:1px solid var(--nh-line,rgba(24,23,24,.08))}
.hp-h .dot{width:34px;height:34px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffb38f,#E5613E 60%,#c94a2a);flex:none}
.hp-h .who{flex:1;display:flex;flex-direction:column;line-height:1.3}.hp-h .who b{font-size:15px;font-weight:600}.hp-h .who small{font-size:11.5px;color:var(--nh-muted, var(--muted, #6B6B67))}
.hp-call{border:0;width:36px;height:36px;border-radius:50%;background:rgba(229,97,62,.12);color:${OR};cursor:pointer;display:grid;place-items:center}
.hp-call[aria-disabled="true"]{opacity:.45;cursor:not-allowed}
.hp-call svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round}
.hp-x{border:0;background:none;font-size:16px;color:var(--nh-muted, var(--muted, #6B6B67));cursor:pointer;padding:4px}
.hp-note{font-size:11.5px;color:var(--nh-muted,#6B6B67);padding:6px 16px 0;min-height:0}.hp-note:empty{display:none}
.hp-log{flex:1;overflow:auto;padding:12px 14px 10px;display:flex;flex-direction:column;gap:10px}
.hp-m{max-width:86%;font-size:13.5px;line-height:1.75;white-space:pre-line;padding:9px 13px;border-radius:16px;unicode-bidi:plaintext}
.hp-m.me{align-self:flex-start;background:var(--nh-ink, var(--text, #181718));color:var(--nh-bg, var(--bg, #fff));border-bottom-right-radius:4px}
.hp-m.ai{align-self:flex-end;background:var(--nh-bg,#F3F2EF);border-bottom-left-radius:4px}
.hp-m img,.hp-m video{display:block;max-width:100%;border-radius:12px;margin-bottom:6px;background:#000}
.hp-m video{max-height:360px}
.hp-cta{align-self:flex-end;display:flex;flex-direction:column;gap:8px;max-width:86%;padding:12px 14px;border-radius:16px;background:rgba(229,97,62,.1);font-size:13.5px;line-height:1.7}
.hp-cta button{border:0;border-radius:999px;background:${OR};color:#fff;font:inherit;font-weight:600;padding:9px 16px;cursor:pointer}
.hp-sug{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px}
.hp-sug button{border:0;background:var(--nh-bg,#F3F2EF);color:var(--nh-ink, var(--text, #181718));font:inherit;font-size:12.5px;padding:6px 12px;border-radius:999px;cursor:pointer}
.hp-sug button:hover{color:${OR}}
.hp-in{display:flex;gap:6px;align-items:flex-end;padding:10px 12px 12px;border-top:1px solid var(--nh-line,rgba(24,23,24,.08))}
.hp-in textarea{flex:1;resize:none;border:0;background:none;font:inherit;font-size:14px;color:inherit;outline:none;padding:8px 4px;max-height:96px}
.hp-in .send{border:0;width:38px;height:38px;border-radius:50%;background:${OR};color:#fff;cursor:pointer;display:grid;place-items:center;flex:none}
.hp-in .att{border:0;width:38px;height:38px;border-radius:50%;background:none;color:var(--nh-muted,#6B6B67);cursor:pointer;display:grid;place-items:center;flex:none}
.hp-in .att svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linejoin:round;stroke-linecap:round}
.hp-in button:disabled{opacity:.5;cursor:default}
.hp-job{position:fixed;top:0;left:0;right:0;z-index:1200;direction:rtl;display:flex;align-items:center;gap:14px;padding:12px 18px calc(12px + 4px);background:#181718;color:#fff;box-shadow:0 10px 30px -12px rgba(0,0,0,.5);font-size:15px}
.hp-job[hidden]{display:none}
.hp-job .dot{width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffb38f,#E5613E 60%,#c94a2a);flex:none;animation:hpPulse 1.4s ease-in-out infinite}
.hp-job .tx{flex:1;display:flex;flex-direction:column;gap:2px;line-height:1.4}.hp-job .tx b{font-weight:600}.hp-job .tx small{opacity:.75;font-size:12.5px}
.hp-job .bar{position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,.12);overflow:hidden}
.hp-job .bar i{position:absolute;top:0;bottom:0;right:0;background:${OR};transition:width .8s ease}
.hp-job .bar i.ind{width:35%!important;animation:hpInd 1.6s ease-in-out infinite}
@keyframes hpInd{from{right:-35%}to{right:100%}}
.hp-job button{border:0;border-radius:999px;background:${OR};color:#fff;font:inherit;font-weight:600;padding:8px 16px;cursor:pointer}
.hp-job.done .dot{animation:none}
.nh-ask{border:0;background:none;font:inherit;font-size:12.5px;color:var(--nh-muted, var(--muted, #6B6B67));cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:4px 0 0}
.nh-ask:hover{color:${OR}}
.nh-ask svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}
.hp-pop{position:fixed;inset:0;z-index:1300;display:grid;place-items:center;background:rgba(10,10,12,.72);direction:rtl;padding:max(16px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(16px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));animation:hpIn .3s ease}
.hp-pop>div{background:var(--card,#fff);color:var(--nh-ink, var(--text, #181718));border-radius:22px;padding:16px;display:flex;flex-direction:column;gap:12px;align-items:center;max-width:min(94vw,520px);max-height:calc(100vh - 32px);box-sizing:border-box}
.hp-pop b{font-size:17px;text-align:center}.hp-pop video{width:auto;max-width:100%;max-height:calc(100vh - 190px);border-radius:14px;background:#000}
.hp-pop .row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.hp-pop button{border:0;border-radius:999px;font:inherit;font-weight:600;padding:10px 18px;cursor:pointer}
.hp-pop .go{background:${OR};color:#fff}.hp-pop .no{background:rgba(127,127,127,.15);color:inherit}
@media (prefers-reduced-motion:reduce){.hp-fab{transition:none}.hp-fab .dot,.hp-job .dot{animation:none}.hp-tease{animation:none}}`;
  const ICON_Q = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 17h.01"/></svg>`;
  const ICON_CALL = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>`;
  const ICON_ATT = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg>`;
  const pageKey = () => (document.getElementById("nhPage")?.hidden !== false ? "home" : document.getElementById("nhPGrid")?.dataset.key || "home");
  const pageName = (k) => S.names[k]?.name || "هذه الصفحة";
  const nm = () => S.name || "سعاد";
  function msgHTML(m) {
    const me = m.role === "user";
    if (m.kind === "cta") {
      return `<div class="hp-cta" data-no-i18n><span>${esc(m.text || "لو عجبك، اشترك وأنا هعملك فيديوهات زي دي بحالاتك إنت بانتظام، وهكون معاك في كل خطوة (وكمان تقدر تكلمني صوت في أي وقت).")}</span>
        <button type="button" data-hpsub>اشترك الآن</button></div>`;
    }
    const media = m.kind === "image" && m.url ? `<img src="${esc(m.url)}" alt="" loading="lazy">`
      : m.kind === "video" && m.url ? `<video src="${esc(m.url)}" controls playsinline preload="metadata"${m.poster ? ` poster="${esc(m.poster)}"` : ""}></video>` : "";
    if (!media && !m.text) return "";
    return `<div class="hp-m ${me ? "me" : "ai"}"${me ? "" : " data-no-i18n"}>${media}${esc(m.text || "")}</div>`;
  }
  function draw() {
    const box = document.querySelector(".hp-box");
    if (!box) return;
    box.hidden = !S.open;
    const fab = document.querySelector(".hp-fab");
    if (fab) {
      fab.querySelector("b").textContent = nm();
      fab.setAttribute("aria-label", nm());
      const bd = fab.querySelector(".bdg"); bd.hidden = !S.unread || S.open; bd.textContent = S.unread > 9 ? "9+" : String(S.unread || "");
    }
    box.querySelector(".who b").textContent = nm();
    const call = box.querySelector(".hp-call");
    call.setAttribute("aria-disabled", S.paid ? "false" : "true");
    call.title = S.paid ? `كلّم ${nm()}` : "المكالمة الصوتية للمشتركين";
    const k = pageKey();
    const first = [{ role: "assistant", text: `أهلًا، أنا ${nm()} 👋 مساعدتك هنا في كل حاجة. اكتبلي، أو ابعتلي صورة، أو اسألني عن أي صفحة.` }];
    box.querySelector(".hp-log").innerHTML = (S.msgs.length ? S.msgs : first).map(msgHTML).join("") + (S.busy ? `<div class="hp-m ai">…</div>` : "");
    box.querySelector(".hp-sug").innerHTML = [`اشرح لي «${pageName(k)}»`, ...(S.msgs.some((m) => m.role === "user") ? ["أرسلها للدعم"] : [])]
      .map((t) => `<button type="button" data-hpq="${esc(t)}">${esc(t)}</button>`).join("");
    const log = box.querySelector(".hp-log"); log.scrollTop = log.scrollHeight;
    box.querySelectorAll("[data-hpsend],[data-hpatt]").forEach((b) => { b.disabled = S.busy; });
    drawJob();
  }
  // 🎬 الشريط الكبير فوق: الفيديو بيتعمل (ماتقفلش الصفحة… ولو قفلتها هتلاقيه مكمّل) ← جاهز
  function drawJob() {
    const el = document.querySelector(".hp-job");
    if (!el) return;
    const j = S.job;
    const on = !!j && (j.status === "working" || (j.status === "done" && !j.seen));
    el.hidden = !on;
    if (!on) return;
    const done = j.status === "done";
    el.classList.toggle("done", done);
    el.querySelector(".tx b").textContent = done ? (j.done_title || "الفيديو بتاعك جاهز 🎉") : (j.title || "بنعمل الفيديو بتاعك…");
    el.querySelector(".tx small").textContent = done ? `هتلاقيه عند ${nm()} تحت على اليمين` : (j.sub || "خليك هنا لو تحب، ولو خرجت هيجيلك إشعار أول ما يخلص");
    el.querySelector("[data-hpjob]").hidden = !done;
    const i = el.querySelector(".bar i");
    const p = typeof j.progress === "number" ? Math.max(.03, Math.min(1, j.progress)) : null;
    i.classList.toggle("ind", !done && p == null);
    i.style.width = done ? "100%" : p != null ? `${Math.round(p * 100)}%` : "";
  }
  async function refresh() {
    try {
      const r = await api("/api/suad");
      const prevJob = S.job?.status;
      Object.assign(S, { name: r.name || S.name, paid: !!r.paid, unread: r.unread || 0, job: r.job || null });
      if (!S.busy) S.msgs = r.msgs || [];
      // الفيديو خلص وهو فاتح الصفحة: رنة + فتح الشات
      if (prevJob === "working" && S.job?.status === "done") ring();
      // 🎬 الفيديو خلص (دلوقتي، أو وهو برّه الصفحة ولسه ماشافوش): يظهر في نص الشاشة مرة واحدة
      if (S.job?.status === "done" && !S.job.seen && S.job.url && S.popped !== S.job.url) { S.popped = S.job.url; popVideo(S.job.url, S.job.done_title || "الفيديو بتاعك جاهز 🎉", true); }
      draw(); tease();
      if (S.open && S.unread) api("/api/suad/read", { method: "POST" }).catch(() => {});
    } catch { /* مش مسجل دخول أو مفيش علامة */ }
  }
  // 🎬 فيديو في نص الشاشة: «إغلاق» (اتشاف) أو «شاهده لاحقًا» (يفضل في الشات وشريط فوق)
  function popVideo(url, title, job = false) {
    document.querySelector(".hp-pop")?.remove();
    const d = document.createElement("div"); d.className = "hp-pop"; d.dataset.noI18n = ""; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    d.innerHTML = `<div><b>${esc(title)}</b><video src="${esc(url)}" controls autoplay playsinline preload="auto"></video>
      <div class="row"><button type="button" class="go" data-pclose>إغلاق</button><button type="button" class="no" data-plater>شاهده لاحقًا</button></div></div>`;
    const close = (seen) => { d.querySelector("video")?.pause(); d.remove(); if (job && seen) seenJob(); };
    d.querySelector("[data-pclose]").onclick = () => close(true);
    d.querySelector("[data-plater]").onclick = () => close(false);
    d.addEventListener("click", (e) => { if (e.target === d) close(false); });
    document.body.append(d);
    d.querySelector("video").play().catch(() => {});
  }
  function ring() {
    try { const a = new Audio("/sfx/suad_ding.wav"); a.volume = .7; a.play().catch(() => {}); } catch { /* */ }
    try { if ("Notification" in window && Notification.permission === "granted") new Notification(`${nm()}`, { body: "الفيديو بتاعك جاهز 🎉" }); } catch { /* */ }
  }
  async function ask(q) {
    q = String(q || "").trim();
    if (!q || S.busy) return;
    if (q === "أرسلها للدعم") return ticket();
    q = I18N.t(q);
    S.msgs.push({ role: "user", text: q }); S.busy = true; draw();
    try {
      const r = await api("/api/suad/msg", { method: "POST", ...jsonBody({ page: pageKey(), text: q, lang: I18N.lang }) });
      S.msgs.push(...(r.msgs || []));
    } catch (err) { S.msgs.push({ role: "assistant", text: `⚠️ ${err.message}` }); }
    S.busy = false; draw();
  }
  async function photo(file) {
    if (!file || S.busy) return;
    S.busy = true; S.msgs.push({ role: "user", kind: "image", url: URL.createObjectURL(file) }); draw();
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await api("/api/suad/photo", { method: "POST", body: fd });
      S.msgs.pop(); S.msgs.push(...(r.msgs || []));
    } catch (err) { S.msgs.push({ role: "assistant", text: `⚠️ ${err.message}` }); }
    S.busy = false; draw();
  }
  async function ticket() {
    const last = [...S.msgs].reverse().find((m) => m.role === "user")?.text || "";
    const text = await uiPrompt("اكتب المشكلة باختصار، وسنرد عليك:", last);
    if (text == null || !text.trim()) return;
    try { await api("/api/help/ticket", { method: "POST", ...jsonBody({ page: pageKey(), text, history: S.msgs.filter((m) => m.text).slice(-10) }) }); S.msgs.push({ role: "assistant", text: I18N.t("✓ وصلت المشكلة للدعم، وسنرد عليك قريبًا.") }); }
    catch (err) { S.msgs.push({ role: "assistant", text: `⚠️ ${err.message}` }); }
    draw();
  }
  function toggle(on = !S.open) {
    S.open = on;
    if (on) { S.unread = 0; api("/api/suad/read", { method: "POST" }).catch(() => {}); if (S.job?.status === "done") seenJob(); }
    draw(); tease();
    if (on) setTimeout(() => document.querySelector(".hp-in textarea")?.focus(), 30);
  }
  function seenJob() { if (S.job) { S.job.seen = true; api("/api/suad/job/seen", { method: "POST" }).catch(() => {}); drawJob(); } }
  function tease() {
    const t = document.querySelector(".hp-tease");
    if (!t) return;
    const k = pageKey(), show = !S.open && k !== "home" && k !== "create" && S.closed !== k && !!S.names[k];
    t.hidden = !show;
    if (show) t.querySelector("[data-hpt]").textContent = `اشرح لي «${pageName(k)}»`;
  }
  const askBtn = (key, name) => `<button type="button" class="nh-ask" data-hpask="${esc(key)}">${ICON_Q}اشرح لي «${esc(name)}»</button>`;
  function mount() {
    if (document.querySelector(".hp-fab")) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    const fab = document.createElement("button");
    fab.type = "button"; fab.className = "hp-fab"; fab.setAttribute("aria-label", nm()); fab.dataset.noI18n = "";
    fab.innerHTML = `<span class="dot" aria-hidden="true"></span><b></b><span class="bdg" hidden></span>`;
    const box = document.createElement("div");
    box.className = "hp-box"; box.hidden = true; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "المساعدة");
    box.innerHTML = `<div class="hp-h"><span class="dot" aria-hidden="true"></span><span class="who"><b data-no-i18n></b><small>مساعدتك الشخصية</small></span>
        <button type="button" class="hp-call" data-hpcall aria-label="مكالمة صوتية">${ICON_CALL}</button>
        <button type="button" class="hp-x" data-hpx aria-label="إغلاق">✕</button></div>
      <div class="hp-note"></div>
      <div class="hp-log" aria-live="polite"></div><div class="hp-sug"></div>
      <form class="hp-in"><button type="button" class="att" data-hpatt aria-label="ابعت صورة">${ICON_ATT}</button>
        <input type="file" accept="image/*" hidden data-hpfile>
        <textarea rows="1" placeholder="اكتب رسالتك…" aria-label="رسالتك"></textarea>
        <button type="submit" class="send" data-hpsend aria-label="أرسل"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12H4M10 6l-6 6 6 6"/></svg></button></form>`;
    const t = document.createElement("div");
    t.className = "hp-tease"; t.hidden = true; t.dataset.nofx = "";
    t.innerHTML = `<button type="button" data-hpt></button><button type="button" data-hptx aria-label="إخفاء">✕</button>`;
    t.addEventListener("click", (e) => {
      if (e.target.closest("[data-hptx]")) { S.closed = pageKey(); return tease(); }
      toggle(true); ask(`اشرح لي «${pageName(pageKey())}»`);
    });
    const job = document.createElement("div");
    job.className = "hp-job"; job.hidden = true; job.setAttribute("role", "status"); job.setAttribute("aria-live", "polite");
    job.innerHTML = `<span class="dot" aria-hidden="true"></span><span class="tx"><b></b><small></small></span><button type="button" data-hpjob hidden>شوف الفيديو</button><span class="bar"><i></i></span>`;
    job.addEventListener("click", (e) => { if (e.target.closest("[data-hpjob]")) { seenJob(); toggle(true); } });
    document.body.append(fab, box, t, job);
    let last = "";
    setInterval(() => { const k = pageKey(); if (k !== last) { last = k; if (S.closed && S.closed !== k) S.closed = null; tease(); draw(); } }, 700);
    fab.addEventListener("click", () => toggle());
    box.addEventListener("click", (e) => {
      if (e.target.closest("[data-hpx]")) return toggle(false);
      if (e.target.closest("[data-hpsub]")) { toggle(false); return window.NHNav?.("plans"); }
      if (e.target.closest("[data-hpatt]")) return box.querySelector("[data-hpfile]").click();
      const c = e.target.closest("[data-hpcall]");
      if (c) {
        if (!S.paid) { box.querySelector(".hp-note").textContent = `المكالمة الصوتية مع ${nm()} للمشتركين. تقدر تكتبلها هنا في أي وقت.`; return; }
        toggle(false); return typeof Assistant !== "undefined" ? Assistant.open?.() : null;
      }
      const b = e.target.closest("[data-hpq]"); if (b) ask(b.dataset.hpq);
    });
    box.querySelector("[data-hpfile]").addEventListener("change", (e) => { const f = e.target.files?.[0]; e.target.value = ""; photo(f); });
    const ta = box.querySelector("textarea");
    box.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); const q = ta.value; ta.value = ""; ask(q); });
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); box.querySelector("form").requestSubmit(); } });
    document.addEventListener("click", (e) => {
      const a = e.target.closest("[data-hpask]");
      if (!a) return;
      toggle(true); ask(`اشرح لي «${pageName(a.dataset.hpask)}»`);
    });
    api("/api/help/pages").then((x) => { S.names = x; draw(); tease(); }).catch(() => {});
    draw(); refresh();
    // بنسأل السيرفر كل شوية (أسرع لما الشات مفتوح أو فيه فيديو بيتعمل)
    const loop = () => { setTimeout(async () => { if (!document.hidden) await refresh(); loop(); }, S.open || S.job?.status === "working" ? 5000 : 20000); };
    loop();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
  return { askBtn, ask, toggle, refresh, popVideo };
})();
