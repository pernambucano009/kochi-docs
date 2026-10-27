// 🎙️ المساعد الصوتي أول التسجيل: مكالمة لايف بلهجة العميل (الكرة الثلاثية الأبعاد في نص الشاشة والباقي متغبّش)،
// المساعد بيسأل أسئلة العقل وكل إجابة بتتحفظ في العقل وقت ما تتقال (بتظهر على الجنب)، وتحليل حسابه بيبدأ في الخلفية.
// المتصفح بيكلّم خدمة الصوت مباشرة (WebRTC) بمفتاح مؤقت من /api/assistant/token، والأدوات بتنادي /api/assistant/*.
const Assistant = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const css = `
.as-ov{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;color:inherit;
  -webkit-backdrop-filter:blur(0);backdrop-filter:blur(0);transition:backdrop-filter .9s,-webkit-backdrop-filter .9s;font-family:inherit}
.as-ov.on{-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.as-ov>:not(.as-in){opacity:0;transition:opacity .45s}
.as-ov.on>:not(.as-in){opacity:1;transition:opacity .7s .55s}
.as-orb{position:relative;width:min(70vw,340px);aspect-ratio:1;will-change:transform}.as-orb canvas{position:absolute;inset:0;width:100%;height:100%}
.as-orb::before{content:"";position:absolute;inset:-25%;border-radius:50%;background:radial-gradient(circle closest-side,rgba(255,120,30,.3),rgba(255,90,10,.1) 55%,transparent);pointer-events:none}
.as-disc{position:absolute;inset:8%;border-radius:50%;background:#E5613E;pointer-events:none}
.as-h{margin:0;font-size:22px;font-weight:600;text-align:center}.as-sub{margin:0;max-width:min(88vw,520px);text-align:center;font-size:14.5px;line-height:1.8;opacity:.8}
.as-form{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center}
.as-form input{width:200px;padding:11px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;font:inherit;font-size:15px;outline:0}
.as-form input::placeholder{color:rgba(255,255,255,.55)}
.as-seg{display:inline-flex;border-radius:999px;background:rgba(255,255,255,.1);padding:3px}.as-seg button{border:0;background:none;color:#fff;font:inherit;font-size:14px;padding:8px 16px;border-radius:999px;cursor:pointer;opacity:.7}
.as-seg button.on{background:#E5613E;opacity:1}
.as-acts{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
.as-go{border:0;border-radius:999px;padding:13px 34px;background:#E5613E;color:#fff;font:inherit;font-size:16px;cursor:pointer;box-shadow:0 10px 30px rgba(229,97,62,.45)}
.as-go:disabled{opacity:.6}
.as-btn{border:1px solid rgba(127,127,127,.3);background:rgba(127,127,127,.14);color:inherit;border-radius:999px;padding:10px 22px;font:inherit;font-size:14.5px;cursor:pointer}
.as-btn:hover{background:rgba(127,127,127,.24)}.as-btn.end:hover{background:rgba(255,80,40,.35)}
.as-st{font-size:14px;opacity:.8;min-height:1.2em}.as-cap{max-width:min(88vw,640px);min-height:3.2em;text-align:center;font-size:19px;line-height:1.6;unicode-bidi:plaintext;font-weight:500}
.as-err{color:#d9472b;font-size:13.5px;min-height:1em;text-align:center;max-width:90vw}
.as-side{position:fixed;inset-inline-end:22px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px;max-height:80vh;overflow:auto;width:min(260px,40vw)}
.as-chip{display:flex;gap:8px;align-items:center;padding:9px 13px;border-radius:14px;background:rgba(127,127,127,.16);font-size:13px;line-height:1.5;
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);animation:asIn .5s cubic-bezier(.2,1.3,.3,1)}
.as-chip b{color:#E5613E;font-weight:600}@keyframes asIn{from{opacity:0;transform:translateX(30px) scale(.9)}}
.as-type{display:flex;gap:8px}.as-type input{width:min(60vw,360px);padding:10px 14px;border-radius:999px;border:1px solid rgba(127,127,127,.3);background:rgba(127,127,127,.1);color:inherit;font:inherit;outline:0}
@media (max-width:720px){.as-side{position:static;transform:none;width:min(92vw,420px);max-height:22vh;inset:auto}}`;
  let S = null, state = null, orb = null, ov = null, from = null, opts = {};
  const QNAME = { domain: "مجال العمل", about: "وصف المشروع", audience: "العميل المثالي", pain: "مشكلة العميل", market: "السوق", voice: "نبرة العلامة",
    products: "المنتجات والأسعار", offer: "العرض الحالي", proof: "النتائج", faq: "أسئلة العملاء", rules: "الممنوعات", cta: "الدعوة لاتخاذ إجراء", rivals: "المنافسون" };
  const SKIP_KEY = "simsim:assistSkip";

  function mount(html) {
    if (!document.getElementById("as-css")) { const st = document.createElement("style"); st.id = "as-css"; st.textContent = css; document.head.appendChild(st); }
    ov = document.createElement("div");
    ov.className = "as-ov"; ov.dir = "rtl"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
    ov.innerHTML = html;
    document.body.appendChild(ov);
    ov.querySelector(".as-orb")?.insertAdjacentHTML("beforeend", '<div class="as-disc"></div>');
    try { orb = window.Orb3D?.(ov.querySelector("canvas")); } catch (e) { console.warn(e); }
    grow(true);
    requestAnimationFrame(() => requestAnimationFrame(() => ov?.classList.add("on")));
  }
  // 🟠 الكرة بتطلع من دايرة «؟» (أو نقطة برتقالي في النص لو الدايرة مش ظاهرة) وتكبر، وعند القفل بتصغر وترجع لها
  function grow(open) {
    const o = ov?.querySelector(".as-orb"), disc = ov?.querySelector(".as-disc"), cv = ov?.querySelector("canvas");
    if (!o) return null;
    const t = o.getBoundingClientRect(), f = from?.isConnected && from.getBoundingClientRect(), vis = f && f.width && f.bottom > 0 && f.top < innerHeight;
    const fx = vis ? f.left + f.width / 2 : innerWidth / 2, fy = vis ? f.top + f.height / 2 : innerHeight / 2, fs = (vis ? f.width : 48) / (t.width * 0.84);
    const small = `translate(${fx - (t.left + t.width / 2)}px,${fy - (t.top + t.height / 2)}px) scale(${fs})`;
    const k = (a, b) => (open ? [a, b] : [b, a]), opt = { duration: open ? 900 : 700, easing: open ? "cubic-bezier(.2,1.1,.3,1)" : "cubic-bezier(.5,0,.7,.4)", fill: "both" };
    disc?.animate(k({ opacity: 1 }, { opacity: 0 }), { ...opt, duration: opt.duration * 0.8, delay: open ? 180 : 0 });
    cv?.animate(k({ opacity: 0 }, { opacity: 1 }), { ...opt, duration: opt.duration * 0.8, delay: open ? 180 : 0 });
    if (vis && open) from.style.visibility = "hidden";   // الدايرة نفسها هي اللي اتحولت للكرة
    return o.animate(k({ transform: small }, { transform: "none" }), opt);
  }
  function close() {
    return new Promise((res) => {
      if (!ov) return res();
      const o = ov, a = grow(false); ov.classList.remove("on"); ov = null;
      const done = () => { orb?.stop(); orb = null; o.remove(); if (from) from.style.visibility = ""; res(); };
      if (a) a.onfinish = done; else done();
      setTimeout(() => o.isConnected && done(), 1200);
    });
  }
  const q = (s) => ov?.querySelector(s);

  // ---------- المكالمة
  function meter(ctx, node) { const a = ctx.createAnalyser(); a.fftSize = 512; node.connect(a); const buf = new Float32Array(a.fftSize); return () => { a.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; return Math.sqrt(s / buf.length); }; }
  function chip(html) { const d = document.createElement("div"); d.className = "as-chip"; d.innerHTML = html; q(".as-side")?.prepend(d); return d; }
  function caption(t) { const c = q(".as-cap"); if (c) c.textContent = t.slice(-170); }

  async function tool(name, args) {
    if (name === "save_answer") {
      const r = await api("/api/assistant/answer", { method: "POST", ...jsonBody({ qid: args.qid, answer: args.answer || "" }) }).catch((e) => ({ ok: false, error: e.message }));
      if (r.ok) { S.saved++; chip(`✓ <span><b>${esc(QNAME[args.qid] || args.qid)}</b><br>${esc(String(args.answer || "").slice(0, 90))}</span>`); }
      return r;
    }
    if (name === "start_account_analysis") {
      const r = await api("/api/assistant/account", { method: "POST", ...jsonBody({ account: args.account || "" }) }).catch((e) => ({ ok: false, error: e.message }));
      if (r.ok) { S.accChip = chip(`⏳ <span><b>تحليل حسابك</b><br>${esc(args.account || "")}</span>`); pollAccount(); }
      return r;
    }
    if (name === "get_account_analysis") return api("/api/assistant/account").catch(() => ({ ready: false }));
    if (name === "finish") { S.finishing = true; setTimeout(() => end(true), 3500); return { ok: true }; }
    return { ok: false, error: "unknown tool" };
  }
  async function pollAccount() {
    if (!S || S.accTimer) return;
    S.accTimer = setInterval(async () => {
      const r = await api("/api/assistant/account").catch(() => null);
      if (!S || !r) return;
      if (r.ready || r.status === "failed") {
        clearInterval(S.accTimer); S.accTimer = null;
        if (S.accChip) S.accChip.innerHTML = r.ready ? `✓ <span><b>حُلّل حسابك</b><br>${esc(r.account || "")}</span>` : `⚠️ <span><b>تعذّر تحليل الحساب</b></span>`;
      }
    }, 6000);
  }

  async function call() {
    mount(`<div class="as-in"><div class="as-orb"><canvas></canvas></div></div><div class="as-st">⏳ جارٍ الاتصال…</div><div class="as-cap"></div>
      <div class="as-type"><input data-type placeholder="أو اكتب هنا واضغط Enter"></div>
      <div class="as-acts"><button type="button" class="as-btn end" data-end>⏹ أنهِ المحادثة</button>${opts.tasks ? `<button type="button" class="as-btn" data-tasks>✅ مهام العقل (صور، فيديو، صوت)</button>` : ""}</div><p class="as-err" data-err></p><div class="as-side"></div>`);
    S = { saved: 0, aBuf: "" };
    q("[data-end]").onclick = () => end(false);
    const tk = opts.tasks; if (tk) q("[data-tasks]").onclick = async () => { await end(false); tk(); };
    try {
      q(".as-st").textContent = "🎙️ اسمح للمتصفح باستخدام الميكروفون إن ظهر لك طلب بذلك";
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      S.mic = mic; S.ctx = new AudioContext(); S.micLevel = meter(S.ctx, S.ctx.createMediaStreamSource(mic));
      q(".as-st").textContent = "⏳ جارٍ الاتصال…";
      const tok = await api("/api/assistant/token", { method: "POST", ...jsonBody({}) });
      const pc = new RTCPeerConnection(); S.pc = pc;
      const el = new Audio(); el.autoplay = true; S.el = el;
      pc.ontrack = (e) => {
        el.srcObject = e.streams[0]; S.outLevel = meter(S.ctx, S.ctx.createMediaStreamSource(e.streams[0]));
        // 🔊 لو المساعد فتح لوحده (من غير ضغطة)، المتصفح ممكن يمنع الصوت: زرار واحد يشغّله
        el.play().catch(() => unmute());
        if (S.ctx.state === "suspended") unmute();
      };
      pc.addTrack(mic.getTracks()[0], mic);
      const dc = pc.createDataChannel("oai-events"); S.dc = dc;
      // 👋 أول ما الجلسة تجهز المساعد يبدأ يتكلم على طول (لو اتبعت قبلها ممكن يضيع، فيستنى العميل يتكلم الأول)
      const greet = () => { if (S && !S.greeted && dc.readyState === "open") { S.greeted = true; dc.send(JSON.stringify({ type: "response.create" })); } };
      dc.onopen = () => setTimeout(greet, 2500);
      dc.onmessage = async (m) => {
        let e; try { e = JSON.parse(m.data); } catch { return; }
        if (e.type === "response.output_audio_transcript.delta" || e.type === "response.audio_transcript.delta") { S.aBuf += e.delta; caption(S.aBuf); }
        else if (e.type === "session.created" || e.type === "session.updated") greet();
        else if (e.type === "response.created") { S.aBuf = ""; S.greeted = true; }
        else if (e.type === "response.function_call_arguments.done") {
          let args = {}; try { args = JSON.parse(e.arguments || "{}"); } catch { /* أرجومنت مش JSON */ }
          const out = await tool(e.name, args);
          if (!S || S.dc.readyState !== "open") return;
          S.dc.send(JSON.stringify({ type: "conversation.item.create", item: { type: "function_call_output", call_id: e.call_id, output: JSON.stringify(out) } }));
          if (e.name !== "finish") S.dc.send(JSON.stringify({ type: "response.create" }));
        } else if (e.type === "error") console.warn("assistant:", e.error);
      };
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      const r = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", body: offer.sdp, headers: { Authorization: `Bearer ${tok.value}`, "Content-Type": "application/sdp" } });
      if (!r.ok) throw new Error("تعذّر بدء المحادثة الآن، جرّب مرة أخرى بعد قليل");
      await pc.setRemoteDescription({ type: "answer", sdp: await r.text() });
      q(".as-st").textContent = `${tok.agent || ""}`;
      q("[data-type]").onkeydown = (ev) => {
        if (ev.key !== "Enter" || !ev.target.value.trim() || S.dc.readyState !== "open") return;
        S.dc.send(JSON.stringify({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: ev.target.value.trim() }] } }));
        S.dc.send(JSON.stringify({ type: "response.create" })); ev.target.value = "";
      };
      loop();
    } catch (e) {
      q("[data-err]").textContent = e.name === "NotAllowedError" ? "اسمح للمتصفح باستخدام الميكروفون، أو اكتب بدل الكلام بعد السماح" : e.message;
      q(".as-st").textContent = "";
    }
  }
  function unmute() {
    if (!S || q("[data-unmute]")) return;
    const b = document.createElement("button"); b.type = "button"; b.className = "as-go"; b.dataset.unmute = "1"; b.textContent = "🔊 اضغط لسماع المساعدة";
    q(".as-acts")?.prepend(b);
    b.onclick = () => { S?.ctx?.resume(); S?.el?.play().catch(() => {}); b.remove(); };
  }
  function loop() {
    if (!S) return;
    const mu = S.micLevel ? S.micLevel() : 0, ag = S.outLevel ? S.outLevel() : 0;
    const talk = ag > 0.012, user = !talk && mu > 0.03;
    orb?.set(talk ? Math.min(1, ag * 7) : user ? Math.min(0.35, mu * 2) : 0, user);
    requestAnimationFrame(loop);
  }
  async function end(finished) {
    if (!S) return;
    const s = S; S = null;
    clearInterval(s.accTimer);
    try { s.dc?.close(); s.pc?.close(); s.mic?.getTracks().forEach((t) => t.stop()); s.ctx?.close(); if (s.el) s.el.srcObject = null; } catch { /* اتقفل خلاص */ }
    // المحادثة بتتحسب «خلصت» لو المساعد قفلها، أو العميل جاوب على كام سؤال؛ غير كده بتظهر تاني المرة الجاية
    if (finished || s.saved >= 3) await api("/api/assistant/done", { method: "POST", ...jsonBody({}) }).catch(() => {});
    else try { localStorage.setItem(SKIP_KEY, String(Date.now())); } catch { /* التخزين مقفول */ }
    await close();
    if (typeof NH !== "undefined") NH?.refresh?.();
    S_done?.();
  }
  let S_done = null;

  // بترجع false لو المساعد مافتحش (مش جاهز أو مش وقته)، وtrue بعد ما المكالمة تخلص
  async function maybe(force, el, o) {
    if (ov) return true;   // مفتوح أصلًا
    try { state = await api("/api/assistant"); } catch { return false; }
    const forced = force === true || /[?&]assistant=1\b/.test(location.search);   // من دايرة «؟» (أو للتجربة): يفتح حتى لو اتعمل قبل كده
    if (!state?.ready || (!forced && (state.done || !state.new))) return false;
    if (!forced) try { const t = +localStorage.getItem(SKIP_KEY); if (t && Date.now() - t < 864e5) return false; } catch { /* التخزين مقفول */ }
    opts = o || {};
    from = el || document.querySelector('[data-n="quiz"]');
    await new Promise((res) => { S_done = res; call(); });
    return true;
  }
  return { maybe, open: async (el, o) => { try { localStorage.removeItem(SKIP_KEY); } catch { /* */ } state = null; return maybe(true, el, o); } };
})();
