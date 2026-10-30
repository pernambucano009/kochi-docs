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
.as-orb{position:relative;width:min(70vw,340px,40vh);aspect-ratio:1;will-change:transform}.as-orb canvas{position:absolute;inset:0;width:100%;height:100%}
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
.as-st{font-size:14px;opacity:.8;min-height:1.2em}.as-cap{max-width:min(88vw,640px);height:3.2em;overflow:hidden;text-align:center;font-size:18px;line-height:1.6;unicode-bidi:plaintext;font-weight:500;flex:none}
.as-err{color:#d9472b;font-size:13.5px;min-height:1em;text-align:center;max-width:90vw}
.as-side{position:fixed;inset-inline-end:22px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px;max-height:80vh;overflow:auto;width:min(260px,40vw)}
.as-chip{display:flex;gap:8px;align-items:center;padding:9px 13px;border-radius:14px;background:rgba(127,127,127,.16);font-size:13px;line-height:1.5;
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);animation:asIn .5s cubic-bezier(.2,1.3,.3,1)}
.as-chip b{color:#E5613E;font-weight:600}@keyframes asIn{from{opacity:0;transform:translateX(30px) scale(.9)}}
.as-type{display:flex;gap:8px}.as-type input{width:min(60vw,360px);padding:10px 14px;border-radius:999px;border:1px solid rgba(127,127,127,.3);background:rgba(127,127,127,.1);color:inherit;font:inherit;outline:0}
.as-box{display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px 18px;border-radius:20px;background:rgba(127,127,127,.14);
  border:1px solid rgba(127,127,127,.25);max-width:min(92vw,460px);animation:asUp .5s cubic-bezier(.2,1.1,.3,1)}
.as-box b{font-size:14.5px}.as-box .as-err{margin:0;min-height:0}.as-box .as-err:empty{display:none}.as-box .row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.as-box input[type=text]{width:min(64vw,300px);padding:10px 14px;border-radius:999px;border:1px solid rgba(127,127,127,.3);background:rgba(127,127,127,.1);color:inherit;font:inherit;outline:0}
.as-drop{display:flex;align-items:center;justify-content:center;gap:8px;padding:16px 22px;border:1.5px dashed rgba(229,97,62,.7);border-radius:16px;cursor:pointer;font-size:14px}
.as-drop.over{background:rgba(229,97,62,.12)}@keyframes asUp{from{opacity:0;transform:translateY(12px) scale(.96)}}
/* 🧠 من خريطة العقل: الكرة على اليمين من غير بلير، والعقل باين بيكبر في النص */
.as-ov.dock{left:auto;right:0;width:min(380px,100vw);pointer-events:none;justify-content:flex-start;padding:96px 18px 24px}
.as-ov.dock .as-acts{margin-top:auto}
/* 📥 خانة الرفع مفتوحة: الكرة بتصغر عشان الخانة والزراير يبانوا من غير ما ينزلوا تحت الشاشة، ولو الشاشة قصيرة أوي تتحرك بالسكرول */
.as-ov{overflow-y:auto;overscroll-behavior:contain}.as-orb{transition:width .5s cubic-bezier(.2,.8,.2,1)}
.as-ov.has-box .as-orb{width:min(46vw,210px,24vh)}.as-ov.dock{gap:12px;padding-top:84px}.as-ov.dock.has-box .as-orb{width:min(150px,20vh)}
.as-ov.has-box .as-cap{height:auto;max-height:3.2em}.as-ov.dock .as-box{max-width:100%;width:100%;box-sizing:border-box}
@media (max-height:720px){.as-ov.dock{padding-top:64px}.as-ov.dock .as-orb{width:min(180px,26vh)}}
body.as-docked .hp-fab,body.as-docked .hp-tease,body.as-docked #nhPTitle,body.as-docked #nhCorner,body.as-docked .bm-hint{opacity:0!important;pointer-events:none!important;transition:opacity .4s}
.as-prog{width:min(260px,80vw);display:flex;flex-direction:column;gap:4px;align-items:center;font-size:12.5px;opacity:.75}
.as-prog i{display:block;width:100%;height:4px;border-radius:4px;background:rgba(127,127,127,.25);overflow:hidden}.as-prog i b{display:block;height:100%;width:0;background:#E5613E;transition:width .6s}
.as-type{flex-direction:column;align-items:center;visibility:hidden;opacity:0;transition:opacity .5s}.as-ov.talked .as-type{visibility:visible;opacity:1}.as-hint{font-size:12.5px;opacity:.8;min-height:0;text-align:center}.as-type.acct input{border-color:#E5613E;box-shadow:0 0 0 3px rgba(229,97,62,.18)}
.as-ov.dock.on{-webkit-backdrop-filter:none;backdrop-filter:none}.as-ov.dock>*{pointer-events:auto}.as-ov.dock .as-side{display:none}
.as-tw{position:relative;display:flex;align-items:center}.as-tw input{padding-right:46px!important}
.as-send{position:absolute;right:5px;width:34px;height:34px;border-radius:50%;border:0;background:#E5613E;color:#fff;font-size:14px;cursor:pointer;display:grid;place-items:center}
.as-send:hover{filter:brightness(1.08)}
.as-btn[data-mute].on{background:#E5613E;color:#fff;border-color:#E5613E}
.as-lognote{font-size:11.5px;opacity:.72;text-align:center;max-width:420px;margin:4px auto 0;line-height:1.6}.as-lognote button{border:0;background:none;color:inherit;text-decoration:underline;cursor:pointer;font:inherit;padding:0}
.as-ov.dock .as-orb{width:min(210px,26vh)}.as-ov.dock{scrollbar-width:none}.as-ov.dock::-webkit-scrollbar{display:none}.as-ov.dock .as-type input{width:min(80vw,300px)}
@media (max-width:720px){.as-ov.dock{top:auto;width:100vw;height:auto;max-height:60vh;padding:12px 14px 18px;gap:10px}.as-ov.dock .as-orb{width:min(130px,22vh)}}
.as-show{gap:8px;padding:10px 12px}.as-show video{display:block;height:min(54vh,520px);max-width:100%;aspect-ratio:9/16;border-radius:14px;background:#000;object-fit:cover}
.as-ov.dock .as-show video{height:min(46vh,440px)}.as-chs{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;max-width:100%}
.as-chs span{font-size:11.5px;padding:3px 9px;border-radius:999px;background:rgba(127,127,127,.16);opacity:.6;transition:all .3s}.as-chs span.on{background:#E5613E;color:#fff;opacity:1}.as-chs span.done{opacity:.9}
.as-card{gap:8px;max-height:min(62vh,600px);overflow:auto;text-align:center}.as-card p{margin:0;font-size:13.5px;line-height:1.7;opacity:.85}
.as-card ul{margin:0;padding:0 18px 0 0;text-align:start;font-size:13.5px;line-height:1.8}.as-kpis{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.as-kpis span{padding:6px 10px;border-radius:12px;background:rgba(127,127,127,.14);font-size:12.5px}.as-kpis span b{display:block;font-size:16px;color:#E5613E}
.as-card img,.as-card video.pv{width:100%;max-height:30vh;object-fit:cover;border-radius:12px}
.as-tpls{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:100%}.as-tpls button{border:2px solid transparent;border-radius:12px;padding:0;background:none;color:inherit;cursor:pointer;font:inherit;font-size:11.5px}
.as-tpls button.on{border-color:#E5613E}.as-tpls video{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:10px;display:block}
.as-steps{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;font-size:12.5px}.as-steps span{padding:5px 9px;border-radius:999px;background:rgba(229,97,62,.15)}
.as-vr{display:flex;gap:8px;align-items:flex-start}.as-vr img{width:54px;height:96px;object-fit:cover;border-radius:8px;flex:none;max-height:none}
.as-rv{text-align:start;font-size:12.5px;line-height:1.6;padding:8px 10px;border-radius:12px;background:rgba(127,127,127,.1);width:100%;box-sizing:border-box}.as-rv a{color:#E5613E}
@media (max-width:720px){.as-side{position:static;transform:none;width:min(92vw,420px);max-height:22vh;inset:auto}}`;
  let S = null, state = null, orb = null, ov = null, from = null, dock = false;
  // 📣 العقل اتغيّر (إجابة اتحفظت، صورة اترفعت، حساب بيتحلل): الخريطة تعيد رسم نفسها والفرع يطلع قدام العميل
  const changed = () => window.dispatchEvent(new CustomEvent("brain:changed"));
  const docked = (on) => (document.body.classList.toggle("as-docked", on), window.dispatchEvent(new CustomEvent("assistant:dock", { detail: { on, w: on && innerWidth > 720 ? 380 : 0 } })));
  const QNAME = { domain: "مجال العمل", about: "وصف المشروع", audience: "العميل المثالي", pain: "مشكلة العميل", market: "السوق", voice: "نبرة العلامة",
    products: "المنتجات والأسعار", offer: "العرض الحالي", proof: "النتائج", faq: "أسئلة العملاء", rules: "الممنوعات", cta: "الدعوة لاتخاذ إجراء", rivals: "المنافسون" };
  const SKIP_KEY = "simsim:assistSkip";

  function mount(html) {
    if (!document.getElementById("as-css")) { const st = document.createElement("style"); st.id = "as-css"; st.textContent = css; document.head.appendChild(st); }
    ov = document.createElement("div");
    ov.className = "as-ov" + (dock ? " dock" : ""); ov.dir = "rtl"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
    ov.innerHTML = html;
    document.body.appendChild(ov);
    ov.querySelector(".as-orb")?.insertAdjacentHTML("beforeend", '<div class="as-disc"></div>');
    try { orb = window.Orb3D?.(ov.querySelector("canvas")); } catch (e) { console.warn(e); }
    if (dock) docked(true);
    grow(true);
    requestAnimationFrame(() => requestAnimationFrame(() => ov?.classList.add("on")));
  }
  // 🟠 الكرة بتطلع من دايرة «؟» (أو نقطة برتقالي في النص لو الدايرة مش ظاهرة) وتكبر، وعند القفل بتصغر وترجع لها
  let calm = false;   // أول مرة بعد التسجيل: الكرة بتكبر على مهلها (مش فجأة)
  function grow(open, root = ov) {
    const o = root?.querySelector(".as-orb"), disc = root?.querySelector(".as-disc"), cv = root?.querySelector("canvas");
    if (!o) return null;
    const dot = from?.querySelector?.(":scope > i") || from;   // الدايرة نفسها، مش الزرار كله (اللي تحته الاسم)
    const t = o.getBoundingClientRect(), f = dot?.isConnected && dot.getBoundingClientRect(), vis = f && f.width && f.bottom > 0 && f.top < innerHeight;
    const fx = vis ? f.left + f.width / 2 : innerWidth / 2, fy = vis ? f.top + f.height / 2 : innerHeight / 2, fs = (vis ? f.width : 48) / (t.width * 0.84);
    const small = `translate(${fx - (t.left + t.width / 2)}px,${fy - (t.top + t.height / 2)}px) scale(${fs})`;
    const k = (a, b) => (open ? [a, b] : [b, a]), opt = { duration: open ? (calm ? 1700 : 900) : 700, easing: open ? (calm ? "cubic-bezier(.3,.9,.25,1)" : "cubic-bezier(.2,1.1,.3,1)") : "cubic-bezier(.4,0,.2,1)", fill: "both" };
    disc?.animate(k({ opacity: 1 }, { opacity: 0 }), { ...opt, duration: opt.duration * 0.8, delay: open ? 180 : 0 });
    cv?.animate(k({ opacity: 0 }, { opacity: 1 }), { ...opt, duration: opt.duration * 0.8, delay: open ? 180 : 0 });
    if (vis && open) from.style.visibility = "hidden";   // الدايرة نفسها هي اللي اتحولت للكرة
    return o.animate(k({ transform: small }, { transform: "none" }), opt);
  }
  // instant: خرج من صفحة العقل (رجوع / الرئيسية): المساعدة بتختفي في نفس اللحظة، من غير حركة القفل اللي كانت بتتركب فوق الصفحة الجديدة
  function close(instant = false) {
    return new Promise((res) => {
      if (!ov) return res();
      const o = ov; ov = null;
      const done = () => { orb?.stop(); orb = null; o.remove(); if (from) from.style.visibility = ""; res(); };
      if (instant) { if (dock) docked(false); done(); return; }
      // الخريطة بترجع لمكانها الأول، وبعدها الكرة تصغر ناحية دايرة سعاد في مكانها الجديد (مش القديم)
      const go = () => { const a = grow(false, o); o.classList.remove("on"); if (a) a.onfinish = done; else done(); setTimeout(() => o.isConnected && done(), 1200); };
      if (dock) { docked(false); requestAnimationFrame(() => requestAnimationFrame(go)); } else go();
    });
  }
  const q = (s) => ov?.querySelector(s);

  // ---------- المكالمة
  function meter(ctx, node) { const a = ctx.createAnalyser(); a.fftSize = 512; node.connect(a); const buf = new Float32Array(a.fftSize); return () => { a.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; return Math.sqrt(s / buf.length); }; }
  function chip(html) { const d = document.createElement("div"); d.className = "as-chip"; d.innerHTML = html; q(".as-side")?.prepend(d); return d; }
  function caption(t) { const c = q(".as-cap"); if (c) c.textContent = t.slice(-170); }
  // 📝 المكتوب جملة جملة على قد الكلام: النص بيوصل أسرع من الصوت، فكل جملة بتفضل ظاهرة على قد طولها وبعدين اللي بعدها.
  // والمربع اللي المساعد طلبه بيظهر لما الجملة اللي فيها اسمه تتقال (أو في آخر الرد لو الكلمة ماتقالتش)
  const KW = { account: /انست|إنست|instagram|تيك ?توك|tiktok|لينك|رابط/i, logo: /شعار|لوجو|لوغو|logo/i, products: /صور|منتج|أعمال/i, intro: /إنترو|انترو|intro/i, rival: /لينك|رابط|صفحة|اكتب/i, myvideo: /فيديو|فديو|video/i };
  // جملة جملة، والجملة الطويلة بتتقسم عند الفاصلة عشان المكتوب مايزيدش عن سطرين ويغطي على خانة الكتابة
  // كل حتة ≤ ٦٠ حرف تقريبًا (عند الفاصلة لو فيه، وإلا عند آخر كلمة) عشان تتقري كاملة في سطرين من غير ما تتقطع بنقط
  const chunk = (x) => {
    const out = [];
    for (let part of x.split(/(?<=[،,])\s+/)) {
      if (out.length && out[out.length - 1].length < 20) part = out.pop() + " " + part;   // «تمام،» لوحدها: تتلزق في اللي بعدها
      while (part.length > 64) { const cut = part.lastIndexOf(" ", 60); const at = cut > 20 ? cut : 60; out.push(part.slice(0, at)); part = part.slice(at).trim(); }
      if (out.length && out[out.length - 1].length + part.length < 50) out[out.length - 1] += " " + part; else out.push(part);
    }
    return out;
  };
  const sentences = (t) => t.split(/(?<=[.!?؟…])\s+/).flatMap((x) => (x.length > 64 ? chunk(x) : [x])).map((x) => x.trim()).filter(Boolean);
  function capReset() {
    if (!S) return;
    // سرعة كلامها الحقيقية من الرد اللي فات (مدة الصوت ÷ عدد الحروف): المكتوب يمشي على قدها مش على تقدير ثابت
    if (S.spFirst && S.spLast > S.spFirst && S.aBuf.length > 25) S.rate = .6 * (S.rate || 85) + .4 * Math.max(55, Math.min(130, (S.spLast - S.spFirst) / S.aBuf.length));
    S.spFirst = S.spLast = 0;
    S.aBuf = ""; S.capI = 0; S.capAt = S.speaking ? performance.now() : 0; S.capDone = false; caption(""); }
  function capTick() {
    if (!S) return;
    const ss = sentences(S.aBuf), now = performance.now();
    if (ss.length) {
      if (!S.capAt) { if (!S.speaking && !(S.noAudio && now - S.textAt > 400)) return; S.capAt = now; }   // المكتوب بيستنى الصوت يبدأ
      const i = Math.min(S.capI, ss.length - 1), dur = Math.max(1000, ss[i].length * (S.rate || 85));
      if (now - S.capAt > dur && i < ss.length - 1) { S.capI = i + 1; S.capAt = now; }
      caption(ss[Math.min(S.capI, ss.length - 1)]); ov?.classList.add("talked");
      if (S.box && KW[S.box]?.test(ss.slice(0, S.capI + 1).join(" "))) { box(S.box); S.box = null; }
    }
  }

  async function tool(name, args) {
    if (name === "save_answer") {
      const r = await api("/api/assistant/answer", { method: "POST", ...jsonBody({ qid: args.qid, answer: args.answer || "" }) }).catch((e) => ({ ok: false, error: e.message }));
      if (r.ok) { S.saved++; S.wait = null; changed(); step(args.qid); chip(`✓ <span><b>${esc(QNAME[args.qid] || args.qid)}</b><br>${esc(String(args.answer || "").slice(0, 90))}</span>`); }
      return r;
    }
    if (name === "start_account_analysis") {
      // 🛑 الحساب لازم العميل يكتبه بنفسه (في المربع أو خانة الكتابة): الكلام بالصوت مابيتكتبش صح، والموديل ساعات بيخمّن حساب من اسم العلامة
      const norm = (x) => String(x || "").toLowerCase().replace(/https?:\/\/|www\.|instagram\.com\/|tiktok\.com\/|[@\s/]/g, "");
      const h = norm(args.account);
      if (!h || !norm(S.typed).includes(h)) {
        box("account");
        return { ok: false, error: "The user has NOT typed this account. Accounts must be typed, never taken from speech or guessed. Ask them to type it in the box on the screen, or move on if they want to give it later." };
      }
      const r = await api("/api/assistant/account", { method: "POST", ...jsonBody({ account: args.account || "" }) }).catch((e) => ({ ok: false, error: e.message }));
      if (r.ok) { changed(); step("account"); acct(false); S.accChip = chip(`⏳ <span><b>تحليل حسابك</b><br>${esc(args.account || "")}</span>`); pollAccount(); }
      return r;
    }
    if (name === "find_competitors") {
      const r = await api("/api/assistant/rivals", { method: "POST", ...jsonBody({ names: args.names || [] }) }).catch((e) => ({ ok: false, error: e.message }));
      if (r.ok) chip(`🔎 <span><b>نبحث عن منافسيك</b><br>${esc((r.searching || []).join("، "))}</span>`);
      return r;
    }
    if (name === "skip_question") {
      const r = await api("/api/assistant/skip", { method: "POST", ...jsonBody({ qid: args.qid }) }).catch(() => ({ ok: false }));
      step(args.qid); return r;
    }
    if (name === "get_account_analysis") return api("/api/assistant/account").catch(() => ({ ready: false }));
    if (name === "start_showcase") {
      const r = await api("/api/assistant/showcase/start", { method: "POST", ...jsonBody({}) }).catch((e) => ({ ok: false, error: e.message }));
      if (r.ok) { showChip(r); pollShow(); }
      return r;
    }
    if (name === "get_showcase") {
      const r = await api("/api/assistant/showcase").catch(() => ({ status: "unknown" }));
      return { status: r.status, progress: r.progress, step: r.step, error: r.error, parts: (r.chapters || []).length };
    }
    if (name === "play_showcase") return play();
    if (name === "show_card") return card(args.kind);
    if (name === "suggest_competitor") {
      chip(`🔎 <span><b>نبحث عن منافس في مجالك ومنطقتك…</b></span>`);
      const r = await api("/api/assistant/rival/suggest", { method: "POST", ...jsonBody({}) }).catch((e) => ({ ok: false, error: e.message }));
      if (r.ok) rivalCard(r.card);
      return r.ok ? { ok: true, account: r.card, facts: r.facts } : r;
    }
    if (name === "check_competitor") {
      const norm = (x) => String(x || "").toLowerCase().replace(/https?:\/\/|www\.|instagram\.com\/|tiktok\.com\/|[@\s/]/g, "");
      if (!norm(args.link) || !norm(S.typed).includes(norm(args.link))) { box("rival"); return { ok: false, error: "The user has not typed this link. Ask them to type it in the box." }; }
      return rivalCheck(args.link, true);
    }
    if (name === "decide_competitor") return decide(args.platform, args.handle, !!args.add);
    if (name === "set_field") {
      const r = await api("/api/assistant/field", { method: "POST", ...jsonBody({ field: args.field || "other", what: args.what || "" }) }).catch((e) => ({ ok: false, error: e.message }));
      if (r.ok) { changed(); chip(`✓ <span><b>عُدّل مجالك في حسابك</b><br>${esc(r.field || "")}</span>`); }
      return r;
    }
    if (name === "save_preference") {
      const r = await api("/api/assistant/preference", { method: "POST", ...jsonBody({ topic: args.topic || "", text: args.text || "" }) }).catch(() => ({ ok: false }));
      if (r.ok) { changed(); chip(`✓ <span><b>حُفظ رأيك</b><br>${esc(String(args.text || "").slice(0, 90))}</span>`); }
      return r;
    }
    if (name === "show_input") {
      if (args.kind === "none") { step({ logo: "logo", products: "photos", account: "account" }[S.wait] || ""); later(); return { ok: true, closed: true }; }
      if (BOX[args.kind]) {
        S.box = args.kind; S.ask = S.capId || true; S.wait = args.kind; S.waitResp = S.capId || "x";
        // لو الأداة وصلت بعد ما خلّصت كلامها (أو قالتها بكلمة مش في القايمة): الخانة تظهر على طول، مش تستنى كلمة
        setTimeout(() => { if (S?.box === args.kind && !S.speaking && (args.kind !== "account" || KW.account.test(S.aBuf))) { box(args.kind); S.box = null; } }, 900);
      }
      return { ok: true, shown: args.kind };
    }
    // later: العميل قال «بعدين»: تقفل من غير ما المكالمة تتحسب خلصت (تقدر ترجعلها من دايرة سعاد)
    if (name === "set_user_gender") return api("/api/assistant/gender", { method: "POST", ...jsonBody({ gender: args.gender }) }).catch(() => ({ ok: false }));
    if (name === "finish") {
      // 👋 المكالمة بتقفل بعد ما جملة الوداع تتقال كلها (مش أول ما الأداة توصل، الأداة بتوصل قبل الصوت)
      S.finishing = true; S.endDone = !args.later; S.finishAt = performance.now();
      setTimeout(() => S?.finishing && end(S.endDone), 20000);   // احتياط لو الصوت ماوصلش
      return { ok: true };
    }
    return { ok: false, error: "unknown tool" };
  }
  // 🗒️ معلومة من المنصة تدخل في سياق المكالمة من غير ما تخليها تتكلم دلوقتي (بتستخدمها في ردها الجاي)
  function sysItem(text) {
    if (!S?.dc || S.dc.readyState !== "open") return;
    lg("sys", text);
    S.dc.send(JSON.stringify({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text }] } }));
  }
  // ⏳ العميل ساكت وهي مستنياه: بعد ٤٥ ثانية تسأله «بعدك معاي؟»، وبعد ٤٥ كمان تستأذن وتقفل (يكمّل وقت ما يفضى)
  function idle(now) {
    if (!S || !S.dc || S.dc.readyState !== "open" || S.finishing || S.busy || S.speaking || S.lastQ !== true) return;
    if (S.show) return;   // الفيديو الاستعراضي شغال (بيتفرج أو هي بتشرح جزء)
    if (document.querySelector(".ui-dlg")) return;   // بيملا نافذة (المعطيات الحقيقية لأول فيديو)
    const quiet = now - Math.max(S.lastAct || S.t0, S.lastTalk || 0), lim = q(".as-box:not(.as-card)") || S.acct ? 90000 : 45000;
    if (quiet < lim) return;
    S.lastAct = now; S.idleN = (S.idleN || 0) + 1;
    lg("sys", `idle ${S.idleN}`);
    sysItem(S.idleN === 1
      ? "(SYSTEM: the user has been silent for a while. Check in warmly in ONE short sentence in the dialect, using their name, and say it is fine to continue another time if they are busy (like: are you still with me? and if you are busy, no problem, we can continue another time). Then wait.)"
      : "(SYSTEM: the user is still silent. Say a warm short goodbye in the dialect (like: you seem busy now, I will go now, and talk to me whenever you are free), then call finish with later=true.)");
    if (S.busy) S.queued = true; else S.dc.send(JSON.stringify({ type: "response.create" }));
  }
  // 🛰️ رسالة من المنصة لسعاد (مش كلام العميل): مابتتحسبش كتابة منه، وهي بترد عليها لما تخلّص كلامها
  function note(text) {
    if (!S?.dc || S.dc.readyState !== "open") return;
    lg("sys", text);
    S.dc.send(JSON.stringify({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } }));
    if (S.busy) S.queued = true; else S.dc.send(JSON.stringify({ type: "response.create" }));
  }
  // 🎬 الفيديو الاستعراضي: بيتعمل في الخلفية (دقايق)، والكارت على الجنب بيقول وصل لفين، ولما يجهز سعاد تعرف وتعرضه
  function showChip(r) {
    if (!S) return;
    const t = r.status === "done" ? `✓ <span><b>جاهز: فيديو استعراضي من فيديوك</b></span>` : r.status === "failed" ? `⚠️ <span><b>تعذّر الفيديو الاستعراضي</b><br>${esc(r.error || "")}</span>`
      : `🎬 <span><b>نجهّز فيديو استعراضيًا من فيديوك</b><br>${esc(r.step || "")}${r.progress ? ` · ${r.progress}٪` : ""}</span>`;
    if (S.showChip) S.showChip.innerHTML = t; else S.showChip = chip(t);
  }
  function pollShow() {
    if (!S || S.showT) return;
    S.showT = setInterval(async () => {
      const r = await api("/api/assistant/showcase").catch(() => null);
      if (!S || !r) return;
      showChip(r);
      if (r.status === "done" || r.status === "failed") {
        clearInterval(S.showT); S.showT = null;
        if (r.status === "done") note("(SYSTEM: the showcase reel is ready now. When you finish what you are saying, tell the user in one short sentence and call play_showcase.)");
        else note(`(SYSTEM: the showcase reel could not be made (${r.error || "error"}). Tell them kindly in one sentence and go on.)`);
      }
    }, 8000);
  }
  // ▶️ العرض: كل جزء بيشتغل، وفي آخره الفيديو بيقف وسعاد بتشرح اللي اتعمل فيه، ولما تخلّص الجزء اللي بعده يكمل لوحده.
  // الميكروفون بيتقفل وهو شغال (صوت الفيديو من السماعة مايتسمعش على إنه كلام العميل) وبيرجع وهي بتشرح.
  async function play() {
    const r = await api("/api/assistant/showcase").catch(() => null);
    if (!S || !ov || r?.status !== "done" || !r.video) return { ok: false, error: "not ready yet", status: r?.status };
    q(".as-box")?.remove(); acct(false);
    const d = document.createElement("div"); d.className = "as-box as-show";
    d.innerHTML = `<b>🎬 فيديو استعراضي من فيديوك</b><video playsinline controls preload="auto" src="${esc(r.video)}"></video>
      <div class="as-chs" hidden>${r.chapters.map((c, i) => `<span data-ch="${i}">${esc(c.title)}</span>`).join("")}</div>
      <div class="row"><button type="button" class="as-btn" data-sclose>إغلاق</button></div>`;
    q(".as-acts").before(d);
    const v = d.querySelector("video"), ch = r.chapters, sh = { v, ch, i: 0, wait: true, at: performance.now(), spoke: false };
    S.show = sh; S.wait = "showcase"; S.box = null;
    const mark = () => d.querySelectorAll("[data-ch]").forEach((x, k) => { x.classList.toggle("on", k === sh.i); x.classList.toggle("done", k < sh.i); });
    const mic = (on) => { const t = S?.mic?.getTracks()[0]; if (t && !S.muted) t.enabled = on; };
    const stop = () => { if (S?.show !== sh) return; S.show = null; S.wait = null; mic(true); clearInterval(sh.t); };
    d.querySelector("[data-sclose]").onclick = () => { v.pause(); stop(); d.remove(); note("(SYSTEM: the user closed the showcase reel. Ask briefly what they thought of it.)"); };
    v.onplay = () => { sh.wait = false; mic(false); };
    v.onpause = () => mic(true);
    v.onseeked = () => { const k = ch.findIndex((c) => v.currentTime < c.t1 - 0.1); if (k >= 0) { sh.i = k; mark(); } };
    v.ontimeupdate = () => {
      if (sh.wait || S?.show !== sh || sh.tpl) return;
      const c = ch[sh.i]; if (!c || v.currentTime < c.t1 - 0.08) return;
      v.pause(); sh.wait = true; sh.at = performance.now(); sh.spoke = false;
      const last = sh.i === ch.length - 1;
      note(`(SYSTEM: part ${sh.i + 1} of ${ch.length} of the showcase just played: "${c.title}". The video shows: ${r.what || "-"} (${r.type || "-"}). What we did here: ${c.did}. What else is possible: ${c.can}. Say only what is true for this video. `
        + (last ? "This was the last part: explain it, then ask what they thought of the whole reel.)" : "Explain it now in 1–2 short sentences, then stop talking (the next part plays by itself).)"));
      if (last) sh.end = true;
      sh.i = Math.min(ch.length - 1, sh.i + 1);
    };
    v.onended = () => {
      if (sh.tpl) { stop(); note("(SYSTEM: the template examples finished. Ask briefly what they think, then continue the tour (custom templates, then autopilot).)"); return; }
      if (!sh.wait) v.ontimeupdate();
    };
    // الجزء اللي بعده يكمّل لما سعاد تخلّص شرحها (أو بعد ١٥ ثانية لو ماردتش)
    sh.t = setInterval(() => {
      if (!S || S.show !== sh || !sh.wait) return;
      const now = performance.now();
      if (S.speaking) { sh.spoke = true; sh.quiet = 0; return; }
      sh.quiet = sh.quiet || now;
      if (((sh.spoke && !S.busy && now - sh.quiet > 700) || now - sh.at > 15000) && now - sh.at > 1200) {
        if (sh.end && !sh.tpl && r.templates_video && (r.templates || []).length) {
          // 🧩 فيديوه خلص: القوالب لوحدها (من مجاله)، سعاد تقدّمها الأول وبعدين الأمثلة تشتغل
          sh.tpl = true; sh.at = performance.now(); sh.spoke = false;
          d.querySelectorAll("[data-ch]").forEach((x) => x.classList.add("done"));
          v.src = r.templates_video; v.load();
          note(`(SYSTEM: the reel of their own video is finished. Now introduce SimsimKit templates for their field${r.field_name ? ` (${r.field_name})` : ""} in 2–3 short sentences, `
            + `like: and based on your field we can use templates such as: ${r.templates.map((x) => `«${x.name}»: ${x.idea}`).join("; ")}. `
            + "Explain that we use templates to make content that fits their field. The examples play right after you finish.)");
          return;
        }
        if (sh.tpl) { if (!sh.tplOn) { sh.tplOn = true; v.play().catch(() => {}); } return; }   // سعاد قدّمت القوالب: الأمثلة تشتغل
        if (sh.end) { mark(); d.querySelectorAll("[data-ch]").forEach((x) => x.classList.add("done")); stop(); return; }
        mark(); v.play().catch(() => {});
      }
    }, 200);
    mark(); v.load(); api("/api/assistant/card/showcase").catch(() => {});
    return { ok: true, playing: true, parts: ch.map((c) => c.title), video: { shows: r.what || "", type: r.type || "" },
      note: "The reel is on their screen. Say one short sentence like 'watch', then stop talking: it starts when you finish. When you explain each part, "
        + "describe ONLY what the SYSTEM message says was done in it and what this video really shows; never mention a person, speech or captions if the video has none." };
  }
  // 🧭 كروت الجولة: كل محطة بكارت (بيانات حقيقية من البرنامج)، وسعاد بتتكلم عنه
  const fmt = (n) => (n == null || n === "" ? "—" : Number(n).toLocaleString("ar-EG"));
  const CARD = {
    analysis: (d) => `<b>📊 تحليل حسابك ${esc(d.account || "")}</b><div class="as-kpis"><span><b>${fmt(d.followers)}</b>متابع</span><span><b>${fmt(d.avg_views)}</b>متوسط المشاهدات</span>
      <span><b>${d.engagement_pct != null ? fmt(d.engagement_pct) + "٪" : "—"}</b>التفاعل</span><span><b>${fmt(d.posts_every_days)}</b>يوم بين كل منشور</span></div>
      ${(d.videos || []).length ? `<p>رأينا في فيديوهاتك</p>${d.videos.map((v) => `<div class="as-rv as-vr">${v.cover ? `<img src="${esc(v.cover)}" alt="">` : ""}<div>
        <b>${esc(v.line || v.caption || "فيديو")}</b> <small>${fmt(v.views)} مشاهدة ${v.url ? `· <a href="${esc(v.url)}" target="_blank" rel="noopener">شاهد</a>` : ""}</small>
        ${(v.good || []).map((x) => `<div>✓ ${esc(x)}</div>`).join("")}${(v.improve || []).map((x) => `<div>• ${esc(x)}</div>`).join("")}</div></div>`).join("")}` : ""}
      ${(d.improvements || []).length ? `<p>تحسينات للحساب</p><ul>${d.improvements.map((x) => `<li>${esc(x.title)}</li>`).join("")}</ul>` : ""}`,
    types: (d) => `<b>🎬 أنواع الفيديوهات المناسبة لك</b><div class="as-steps">${(d.types || []).map((x) => `<span>${esc(x)}</span>`).join("")}</div>
      ${(d.ideas || []).length ? `<p>أفكار جاهزة:</p><ul>${d.ideas.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}`,
    rivals: (d) => `<b>🏆 ما ينجح عند منافسيك</b>${(d.items || []).map((i) => `<div class="as-rv"><b>${esc(i.name || "")}</b> <small dir="ltr">@${esc(i.handle || "")}</small>
      ${(i.posts || []).map((p) => `<div>• ${esc(p.caption || "فيديو")} — ${fmt(p.views)} مشاهدة${p.multiple ? ` (×${esc(p.multiple)} من المعتاد)` : ""} ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">شاهد</a>` : ""}</div>`).join("")}</div>`).join("")}`,
    phone: () => `<b>📱 صوّر بجوالك، والملقّن يعرض لك النص</b><video class="pv" src="/gallery/phone.mp4" muted loop autoplay playsinline></video>
      <ul><li>النص يظهر على شاشة الجوال وأنت تصوّر</li><li>الفيديو يعود إلى المنصة تلقائيًا</li><li>ونجري له المونتاج: ترجمة وقطع وزووم وموسيقى</li></ul>`,
    avatar: () => `<b>🧑 الأفاتار: نسخة رقمية منك</b><img src="/gallery/avatar.jpg" alt=""><ul><li>من تسجيل قصير حقيقي، وبإذنك فقط</li><li>يقول كلامًا جديدًا بصوتك دون تصوير</li></ul>`,
    templates: (d) => {
      const names = typeof Gallery !== "undefined" ? Gallery.list() : [];
      return `<b>🧩 قوالب مناسبة لمجالك</b><p>اختر قالبًا، ثم اضغط «اصنعه»، ونصنع أول فيديو باسمك وشعارك هدية.</p><div class="as-tpls">${(d.reels || []).map((id, i) => {
        const fm = (d.field_media || []).includes(id), v = fm ? `/gallery/f/${d.field}/${id}.mp4` : `/gallery/${id}.mp4`, c = fm ? `/gallery/f/${d.field}/${id}.jpg` : `/gallery/${id}.jpg?v=2`;
        return `<button type="button" data-tpl="${esc(id)}" data-v="${esc(v)}" data-c="${esc(c)}" class="${i ? "" : "on"}"><video src="${esc(v)}" poster="${esc(c)}" muted loop autoplay playsinline preload="metadata"></video>${esc((names.find((x) => x.id === id) || {}).name || id)}</button>`;
      }).join("")}</div><div class="row"><button type="button" class="as-go" data-mk>اصنعه باسمي وشعاري</button></div>`;
    },
    firstvideo: (d) => `<b>🎬 أول فيديو لك جاهز</b><video src="${esc(d.video || "")}" controls playsinline style="width:100%;max-height:46vh;border-radius:12px;background:#000"></video>`,
    process: () => `<b>🛠️ من الفكرة إلى النشر</b><div class="as-steps"><span>الفكرة</span><span>النص</span><span>المونتاج</span><span>الصوت</span><span>النشر</span></div>
      <p>في كل خطوة تختار مستوى التحكم:</p><ul><li>تلقائي بالكامل</li><li>نجهّزها وأنت توافق</li><li>تفعلها بنفسك</li></ul>`,
    custom: () => `<b>🧱 القالب المخصص</b><img src="/gallery/editor.jpg" alt=""><ul><li>ترتّب الخطوات مرة واحدة: المقدمة والقطع والترجمة والموسيقى والخاتمة</li><li>كل تشغيل يصنع فيديو جديدًا بنفس الطريقة</li></ul>`,
    library: () => `<b>📚 مكتبة المحتويات</b><p>كلما أضفت صورًا وفيديوهات أكثر، صارت فيديوهاتك أقرب إليك.</p>
      <ul><li>شعارك</li><li>صور أعمالك وحالاتك</li><li>صور المكان والفريق</li><li>فيديوهات تصوّرها بنفسك</li></ul>
      <div class="row"><button type="button" class="as-go" data-golib>افتح المكتبة بعد المكالمة</button></div>`,
    autopilot: (d) => `<b>🚀 الأوتوبايلوت</b><ul><li>تحدد عدد المنشورات في اليوم والقوالب</li><li>ينشر في أفضل الأوقات تلقائيًا</li><li>أو ينتظر موافقتك قبل كل منشور</li></ul>
      <p>${d.on ? "✓ يعمل الآن في حسابك" : "يمكنك تشغيله من صفحة الأوتوبايلوت بعد المكالمة"}</p>`,
  };
  async function card(kind) {
    if (!S || !ov || !CARD[kind]) return { ok: false, error: "unknown card" };
    const r = await api(`/api/assistant/card/${encodeURIComponent(kind)}`).catch((e) => ({ ok: false, error: e.message }));
    if (!r.ok || !S) return r;
    if (S.show) { S.show.v.pause(); S.show = null; S.wait = null; }
    q(".as-box")?.remove(); acct(false);
    const d = document.createElement("div"); d.className = "as-box as-card"; d.dataset.card = kind;
    d.innerHTML = CARD[kind](r.data || {}) + `<div class="row"><button type="button" class="as-btn" data-cclose>إخفاء</button></div>`;
    q(".as-acts").before(d);
    d.querySelector("[data-cclose]").onclick = () => d.remove();
    if (kind === "templates") tplCard(d);
    d.querySelector("[data-golib]")?.addEventListener("click", async () => { await end(true); window.NHGo?.("brainlib"); });
    return { ok: true, facts: r.facts || "", data: r.data };
  }
  // 🏆 كارت المنافس: أرقامه الحقيقية ورأينا فيه، وزرارين (هو منافس / مش منافس). الزرار والكلام بيعملوا نفس الحاجة
  const LEVEL = { strong: "💪 صفحة نشطة وقوية", ok: "👌 صفحة متوسطة", weak: "⚠️ صفحة ضعيفة أو غير نشطة" };
  function rivalCard(c) {
    if (!S || !ov || !c) return;
    if (S.show) { S.show.v.pause(); S.show = null; S.wait = null; }
    q(".as-box")?.remove(); acct(false);
    const d = document.createElement("div"); d.className = "as-box as-card"; d.dataset.card = "rival";
    d.innerHTML = `<b>🏆 ${esc(c.name)} <small dir="ltr">@${esc(c.handle)} · ${c.platform === "tiktok" ? "TikTok" : "Instagram"}</small></b>
      ${c.url ? `<a class="as-btn" href="${esc(c.url)}" target="_blank" rel="noopener">🔗 افتح صفحته وشاهدها</a>` : ""}
      <div class="as-kpis"><span><b>${fmt(c.followers)}</b>متابع</span><span><b>${fmt(c.median_views)}</b>متوسط المشاهدات</span><span><b>${fmt(c.recent)}</b>منشور في آخر ٣٠ يومًا</span>
      ${c.days != null ? `<span><b>${fmt(c.days)}</b>يوم منذ آخر منشور</span>` : ""}</div><p>${esc(LEVEL[c.level] || "")}</p>
      ${(c.posts || []).map((p) => `<div class="as-rv">• ${esc(p.caption || "فيديو")} — ${fmt(p.views)} مشاهدة ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">شاهد</a>` : ""}</div>`).join("")}
      <div class="row"><button type="button" class="as-go" data-ry>✓ نعم، منافس لي</button><button type="button" class="as-btn" data-rn>✕ ليس منافسًا</button></div>`;
    q(".as-acts").before(d);
    d.querySelector("[data-ry]").onclick = async () => { await decide(c.platform, c.handle, true); note(`(SYSTEM: the user pressed YES: @${c.handle} is a competitor and was added to their competitors page. Say what works for them in one sentence, then ask if they want to look for one more or move on.)`); };
    d.querySelector("[data-rn]").onclick = async () => { await decide(c.platform, c.handle, false); note(`(SYSTEM: the user pressed NO: @${c.handle} is not a competitor. Ask if they know a page they consider a competitor and can type its link (show_input kind rival), or offer to find another one.)`); };
  }
  async function decide(platform, handle, add) {
    const r = await api("/api/assistant/rival/decide", { method: "POST", ...jsonBody({ platform, handle, add }) }).catch(() => ({ ok: false }));
    if (!S) return r;
    q('[data-card="rival"]')?.remove();
    if (r.ok && r.added) { changed(); chip(`✓ <span><b>أُضيف إلى منافسيك</b><br>@${esc(handle)}</span>`); }
    return r;
  }
  // اللينك اللي كتبه العميل: بيتفحص على طول، وسعاد بتاخد النتيجة وتقول رأيها بصراحة
  async function rivalCheck(link, fromTool) {
    if (!S) return { ok: false };
    S.typed += " " + link; lg("user", `صفحة منافس: ${link}`, { typed: 1 });
    const c = chip(`🔎 <span><b>نفحص الصفحة</b><br>${esc(link)}</span>`);
    const r = await api("/api/assistant/rival/check", { method: "POST", ...jsonBody({ link }) }).catch((e) => ({ ok: false, error: e.message }));
    c.remove();
    if (r.ok) rivalCard(r.card);
    if (fromTool) return r.ok ? { ok: true, account: r.card, facts: r.facts } : r;
    note(r.ok ? `(SYSTEM: the user typed a competitor page: ${link}. Its numbers are on the screen: ${JSON.stringify(r.card)}. ${r.facts})`
      : `(SYSTEM: the user typed ${link} but it could not be checked (${r.error || "error"}). Tell them kindly and ask them to check the link, or offer to find one yourself.)`);
    return r;
  }
  // 🧩 القالب: يختاره من الكارت، ونافذة المعطيات الحقيقية (الأسعار والأسماء) بتفتح فوق المكالمة، والفيديو بيتعمل في الخلفية وهي بتكمّل الجولة
  function tplCard(d) {
    let cur = d.querySelector("[data-tpl].on");
    d.querySelector(".as-tpls").onclick = (e) => {
      const b = e.target.closest("[data-tpl]"); if (!b) return;
      cur = b; d.querySelectorAll("[data-tpl]").forEach((x) => x.classList.toggle("on", x === b));
      note(`(SYSTEM: the user is looking at the template "${b.textContent.trim()}". React in one short sentence at most, then wait for them to press the make button.)`);
    };
    d.querySelector("[data-mk]").onclick = async () => {
      if (!cur || typeof FirstUse === "undefined") return;
      const tpl = { id: cur.dataset.tpl, name: cur.textContent.trim(), video: cur.dataset.v, cover: cur.dataset.c };
      S.wait = "facts";
      const ok = await FirstUse.startFirst({ tpl, quiet: true }).catch(() => false);
      if (!S) return;
      S.wait = null;
      if (ok === true || ok === "running") {
        d.remove(); S.fvChip = chip(`🎬 <span><b>نصنع أول فيديو لك</b><br>${esc(tpl.name)}</span>`); pollFirst();
        note(`(SYSTEM: the user picked "${tpl.name}" and typed the real details. Their first video with their brand name and logo is being made now (a few minutes). Tell them in one short sentence, then continue the tour with the next stop.)`);
      } else if (ok === "done") note("(SYSTEM: their first video was already made before. Call show_card firstvideo to show it, then continue the tour.)");
      else note("(SYSTEM: the user closed the details form without making the video. Ask if they want to do it later, then continue the tour.)");
    };
  }
  function pollFirst() {
    if (!S || S.fvT) return;
    S.fvT = setInterval(async () => {
      const r = await api("/api/onboard").catch(() => null);
      const j = r?.job; if (!S || !j) return;
      if (j.status === "done" || j.status === "failed") {
        clearInterval(S.fvT); S.fvT = null;
        if (S.fvChip) S.fvChip.innerHTML = j.status === "done" ? `✓ <span><b>أول فيديو لك جاهز</b></span>` : `⚠️ <span><b>تعذّر أول فيديو</b></span>`;
        note(j.status === "done" ? "(SYSTEM: their first video is ready. When you finish what you are saying, tell them and call show_card firstvideo.)"
          : `(SYSTEM: their first video could not be made (${j.error || "error"}). Tell them kindly in one sentence; they can try again from the home page.)`);
      }
    }, 9000);
  }
  // 💬 كلام من الشاشة للمساعد (كتابة، أو «رفعت الشعار»): بيتبعت كأن العميل قاله، والمساعد يرد عليه
  function say(text) {
    if (!S?.dc || S.dc.readyState !== "open") return;
    S.typed += " " + text; S.wait = null; S.nudged = 0; S.lastAct = performance.now(); S.idleN = 0; clearTimeout(S.nudgeT); lg("user", text, { typed: 1 });
    S.dc.send(JSON.stringify({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } }));
    // لو هي لسه بتتكلم: الرد يستنى لحد ما تخلّص (طلب رد وهي بترد كان بيترفض، والكلام المكتوب يضيع)
    if (S.busy) S.queued = true; else S.dc.send(JSON.stringify({ type: "response.create" }));
  }
  // 📥 المكان اللي العميل يكتب أو يرفع فيه اللي المساعد طلبه (الحساب، الشعار، صور المنتجات، الإنترو)
  const BOX = {
    account: { t: "رابط حسابك على إنستغرام أو تيك توك", ph: "instagram.com/… أو @اسم_الحساب" },
    rival: { t: "رابط صفحة تراها منافسًا لك", ph: "instagram.com/… أو tiktok.com/@…", pre: "صفحة منافس: " },
    logo: { t: "ارفع شعارك", accept: "image/png,image/jpeg,image/webp", kind: "logos", done: "رفعت الشعار" },
    products: { t: "ارفع صور منتجاتك أو أعمالك", accept: "image/png,image/jpeg,image/webp", multi: true, kind: "products", done: "رفعت صور المنتجات" },
    intro: { t: "ارفع فيديو الإنترو", accept: "video/*", video: true, done: "رفعت فيديو الإنترو" },
    myvideo: { t: "ارفع فيديو قصيرًا تتحدث فيه (من ١٥ ثانية إلى دقيقة)", accept: "video/*", video: true, url: "/api/assistant/showcase/upload", done: "رفعت فيديو أتحدث فيه" },
  };
  function box(kind) {
    if (kind === "account") { q(".as-box")?.remove(); return acct(true); }
    const k = BOX[kind]; q(".as-box")?.remove();
    if (!k || !ov) return;
    const d = document.createElement("div"); d.className = "as-box";
    d.innerHTML = `<b>${esc(k.t)}</b>` + (k.ph
      ? `<div class="row"><input type="text" dir="ltr" placeholder="${esc(k.ph)}"><button type="button" class="as-btn" data-send>أرسل</button></div>`
      : `<label class="as-drop">📎 <span>اختر ${k.multi ? "الصور" : k.video ? "الفيديو" : "الصورة"} أو اسحبها هنا</span><input type="file" hidden accept="${k.accept}"${k.multi ? " multiple" : ""}></label>`)
      + `<div class="row"><button type="button" class="as-btn" data-later>لاحقًا</button></div><p class="as-err" data-berr></p>`;
    q(".as-acts").before(d);
    const err = (m) => { d.querySelector("[data-berr]").textContent = m || ""; };
    d.querySelector("[data-later]").onclick = () => { d.remove(); step({ logos: "logo", products: "photos" }[k.kind] || ""); say("سأرسله لاحقًا"); };
    if (k.ph) {
      const inp = d.querySelector("input"), send = () => { const v = inp.value.trim(); if (!v) return; d.remove(); if (k.pre) return rivalCheck(v); say(`حسابي: ${v}`); };
      d.querySelector("[data-send]").onclick = send; inp.onkeydown = (e) => { if (e.key === "Enter") send(); };
      setTimeout(() => inp.focus(), 300);
      return;
    }
    const drop = d.querySelector(".as-drop"), fin = d.querySelector("input");
    const up = async (files) => {
      files = [...files].slice(0, k.multi ? 30 : 1); if (!files.length) return;
      err(""); drop.querySelector("span").textContent = "⏳ جارٍ الرفع…";
      const f = new FormData();
      if (k.url) f.append("file", files[0]); else if (k.video) { f.append("kind", "intro"); f.append("file", files[0]); } else { f.append("kind", k.kind); files.forEach((x) => f.append("files", x)); }
      try {
        const r = await fetch(k.url || `/api/ad-brains/${encodeURIComponent(state.brand)}/${k.video ? "brand-video" : "assets"}`, { method: "POST", body: f, credentials: "same-origin" });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "تعذّر الرفع، جرّب مرة أخرى");
        d.remove(); if (!k.url) changed(); step(k.kind === "logos" ? "logo" : k.kind === "products" ? "photos" : k.url ? "myvideo" : "intro"); chip(`✓ <span><b>${esc(k.t)}</b></span>`); say(`(${k.done} الآن)`);
      } catch (e) { err(e.message); drop.querySelector("span").textContent = "جرّب مرة أخرى"; }
    };
    fin.onchange = () => up(fin.files);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = () => drop.classList.remove("over");
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); up(e.dataTransfer.files); };
  }
  // 📼 مسجّل المكالمة (عشان نطوّر منطقها): كلامها وكلام العميل (المكتوب من الصوت أو الكتابة)، والأدوات ونتايجها، وأي «كمّلت لوحدها»
  // كتابة بس من غير صوت. بيتبعت كل ١٥ ثانية وفي الآخر، والخادم بيحفظه لو التسجيل مسموح (محادثات الأدمن دايمًا، والعملاء لو اتفعّل)
  function lg(who, text, data) {
    if (!S?.log) return;
    S.log.push({ t: Math.round(performance.now() - S.t0), who, text: String(text ?? "").slice(0, 2000), ...(data ? { data } : {}) });
  }
  function flush(final) {
    if (!S?.log || (!S.log.length && !final)) return;
    if (S.nolog || !state?.log) { S.log.length = 0; return; }   // التسجيل مقفول، أو العميل قال «لا تحفظها»
    const body = JSON.stringify({ call: S.call, events: S.log.splice(0), final: !!final,
      meta: { agent: S.agent || "", saved: S.saved, steps: S.steps.length, done: S.done.size, sec: Math.round((performance.now() - S.t0) / 1000), noMic: !S.mic,
        model: S.model || "", usage: S.usage, ...(S.usd != null ? { usd: S.usd } : {}) } });
    // keepalive بيرفض أي حاجة أكبر من ٦٤ كيلو: الكبير بيتبعت عادي. ولو الإرسال فشل: يبان في صندوق الأخطاء (مرة لكل مكالمة)
    const fail = (why) => { if (S && !S.logErr) { S.logErr = true; fetch("/api/issues/client", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "ui", screen: "assistant", message: "سجل مكالمة سعاد لم يُرسل", raw: String(why).slice(0, 300) }) }).catch(() => {}); } };
    fetch("/api/assistant/log", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: body.length < 60000 })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))).then((j) => { if (j && j.ok === false && !j.off) fail(j.error || "not saved"); })
      .catch((e) => fail(e.message || e));
  }
  async function pollAccount() {
    if (!S || S.accTimer) return;
    S.accTimer = setInterval(async () => {
      const r = await api("/api/assistant/account").catch(() => null);
      if (!S || !r) return;
      if (r.ready || r.status === "failed") {
        clearInterval(S.accTimer); S.accTimer = null;
        changed(); status();
        // 📬 التحليل وصل وهي في نص المكالمة: تعرف دلوقتي، وتقوله في ردها الجاي (من غير ما تقطع سؤال مستني إجابته)
        if (r.ready && r.gender_check?.mismatch) sysItem(`(SYSTEM: important, resolve it in your NEXT turn after reacting to what they say: ${r.gender_check.note})`);
        if (r.ready) sysItem("(SYSTEM: the analysis of the user's account has just arrived. In your NEXT turn, after reacting to what they say, tell them in one short "
          + "sentence in the dialect that you just received their page's analysis and there are many things in it you want to talk with them about, "
          + "but you will finish your questions first so the picture is complete. If the questions are already finished, go to the analysis stop instead. Say it only once.)");
        if (S.accChip) S.accChip.innerHTML = r.ready ? `✓ <span><b>حُلّل حسابك</b><br>${esc(r.account || "")}</span>` : `⚠️ <span><b>تعذّر تحليل الحساب</b></span>`;
      }
    }, 6000);
  }

  async function call() {
    if (S) await end(false);   // احتياط: أي مكالمة قديمة تتقفل قبل الجديدة
    mount(`<div class="as-in"><div class="as-orb"><canvas></canvas></div></div><div class="as-st">⏳ جارٍ الاتصال…</div>
      <div class="as-prog" hidden><span data-pt></span><i><b data-pb></b></i></div><div class="as-cap"></div>
      <div class="as-type"><div class="as-tw"><input data-type placeholder="أو اكتب هنا واضغط Enter"><button type="button" class="as-send" data-tsend aria-label="أرسل">➤</button></div><p class="as-hint" data-hint hidden></p></div>
      <div class="as-acts"><button type="button" class="as-btn" data-mute hidden>🔇 اكتم الميكروفون</button><button type="button" class="as-btn end" data-end>⏹ أنهِ المحادثة</button></div><p class="as-err" data-err></p><div class="as-side"></div>
      ${state?.log && window.IS_CUSTOMER ? `<p class="as-lognote" data-lognote>📝 تُحفظ هذه المحادثة نصًا فقط (دون صوت) لمدة 30 يومًا لتحسين المساعدة، دون اسمك أو بيانات تواصلك. <button type="button" data-nolog>لا تحفظها</button></p>` : ""}`);
    S = { saved: 0, aBuf: "", capI: 0, capAt: 0, capDone: false, box: null, typed: "", t0: performance.now(), agentMs: 0, steps: [...(state?.steps || [])], done: new Set(), speaking: false,
      call: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, log: [],
      usage: { text_in: 0, audio_in: 0, text_cached: 0, audio_cached: 0, text_out: 0, audio_out: 0 } };
    prog();
    S.logT = setInterval(() => flush(false), 15000);
    ["input", "pointerdown", "change"].forEach((ev) => ov.addEventListener(ev, () => { if (S) { S.lastAct = performance.now(); S.idleN = 0; } }, true));   // بيكتب أو بيختار حاجة: مش ساكت
    // خرج من صفحة العقل والمكالمة شغالة (للرئيسية مثلًا): المكالمة بتقفل (نص ثانية سماح عشان إعادة رسم الخريطة)
    if (dock) {
      let away = 0; S.pageT = setInterval(() => { away = onBrain() ? 0 : away + 1; if (away >= 2 && S) { lg("sys", "left brain page"); end(false, true); } }, 400);
      // الصفحة اتغيّرت (زرار «رجوع» أو الرئيسية): المكالمة تقفل في نفس اللحظة قبل ما الصفحة الجديدة ترسم نفسها
      S.onHash = () => { if (S && !/^#brand/.test(location.hash)) { lg("sys", "left brain page"); end(false, true); } };
      addEventListener("hashchange", S.onHash);
    }
    S.capT = setInterval(capTick, 120);
    // ⬅️ زرار الرجوع بيقفل المساعد (والكرة تصغر وترجع) بدل ما يسيبها على الشاشة: خطوة في التاريخ بنفس العنوان
    history.pushState({ ...(history.state || {}), assistant: 1 }, "", location.href); S.hist = true;
    q("[data-end]").onclick = () => end(false);
    const nl = q("[data-nolog]");
    if (nl) nl.onclick = () => { S.nolog = true; S.log.length = 0; q("[data-lognote]").textContent = "✓ لن تُحفظ هذه المحادثة"; };
    // 🔇 كتم الميكروفون: لو العميل هيبعد أو فيه كلام في الأوضة، عشان أصوات الأوضة ماتتاخدش على إنها إجابات
    q("[data-mute]").onclick = () => {
      const t = S?.mic?.getTracks()[0]; if (!t) return;
      t.enabled = !t.enabled; S.muted = !t.enabled; lg("sys", S.muted ? "mic muted" : "mic on");
      q("[data-mute]").textContent = S.muted ? "🎙️ شغّل الميكروفون" : "🔇 اكتم الميكروفون";
      q("[data-mute]").classList.toggle("on", S.muted); status();
    };
    try {
      q(".as-st").textContent = "🎙️ اسمح للمتصفح باستخدام الميكروفون إن ظهر لك طلب بذلك";
      // 🎙️ من غير ميكروفون (مش موجود، أو العميل رفض الإذن) المكالمة بتكمل: المساعد بيتكلم والعميل بيكتب
      let mic = null, noMic = "";
      try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
      catch (me) { noMic = me.name === "NotAllowedError" ? "لم يُسمح باستخدام الميكروفون، فاكتب ردودك في الخانة. للكلام بالصوت: اسمح بالميكروفون من شريط العنوان ثم افتح المساعد مرة أخرى"
        : "لم نجد ميكروفونًا في هذا الجهاز، فاكتب ردودك في الخانة"; }
      S.mic = mic; if (mic) q("[data-mute]").hidden = false; S.ctx = new AudioContext(); if (mic) S.micLevel = meter(S.ctx, S.ctx.createMediaStreamSource(mic));
      q(".as-st").textContent = "⏳ جارٍ الاتصال…";
      const tok = await api("/api/assistant/token", { method: "POST", ...jsonBody({ call: S.call }) });
      if (!S || (dock && !onBrain())) { if (S) end(false); return; }   // خرج من العقل وهي بتتصل
      const pc = new RTCPeerConnection(); S.pc = pc;
      const el = new Audio(); el.autoplay = true; S.el = el;
      pc.ontrack = (e) => {
        el.srcObject = e.streams[0]; S.outLevel = meter(S.ctx, S.ctx.createMediaStreamSource(e.streams[0]));
        // 🔊 لو المساعد فتح لوحده (من غير ضغطة)، المتصفح ممكن يمنع الصوت: زرار واحد يشغّله
        el.play().catch(() => unmute());
        if (S.ctx.state === "suspended") unmute();
      };
      if (mic) pc.addTrack(mic.getTracks()[0], mic); else pc.addTransceiver("audio", { direction: "recvonly" });
      const dc = pc.createDataChannel("oai-events"); S.dc = dc;
      // 👋 أول ما الجلسة تجهز المساعد يبدأ يتكلم على طول (لو اتبعت قبلها ممكن يضيع، فيستنى العميل يتكلم الأول)
      const greet = () => { if (S && !S.greeted && dc.readyState === "open") { S.greeted = true; dc.send(JSON.stringify({ type: "response.create" })); } };
      dc.onopen = () => setTimeout(greet, 2500);
      // ⏸️ كل رد = سؤال واحد ويستنى العميل: بعد نتيجة الأداة المساعد مابيتكلمش تاني إلا لو الرد كان أداة بس من غير كلام
      S.resp = {};
      const R = (id) => S.resp[id] || (S.resp[id] = { msg: false, calls: 0, pending: 0, done: false });
      const follow = (id) => {
        const r = S?.resp[id];
        if (!r || !r.done || r.pending || !r.calls || (r.msg && !r.force) || S.finishing) return;
        delete S.resp[id]; S.dc.send(JSON.stringify({ type: "response.create" }));
      };
      dc.onmessage = async (m) => {
        let e; try { e = JSON.parse(m.data); } catch { return; }
        if (e.type === "response.output_audio_transcript.delta" || e.type === "response.audio_transcript.delta") {
          if (e.response_id !== S.capId) { S.capId = e.response_id; capReset(); }   // كل رد بيبدأ الكلام المكتوب من الأول، ماتتركبش على بعض
          R(e.response_id).msg = true; if (!S.aBuf) S.textAt = performance.now(); S.aBuf += e.delta; S.noAudio = !S.outLevel;
        } else if (e.type === "response.output_item.added" && e.item?.type === "message") R(e.response_id).msg = true;
        else if (e.type === "input_audio_buffer.speech_started") { S.lastAct = performance.now(); S.idleN = 0; lg("sys", "speech_started"); S.nudged = 0; S.capId = null; capReset(); clearTimeout(S.nudgeT); S.lastQ = null; status(); }
        else if (e.type === "input_audio_buffer.speech_stopped") { S.thinking = true; status(); }
        else if (e.type === "conversation.item.input_audio_transcription.completed") { lg("user", e.transcript || "", { voice: 1 }); if ((q(".as-box") || S.acct || S.wait) && LATER.test(e.transcript || "")) later(); }

        else if (e.type === "session.created" || e.type === "session.updated") greet();
        else if (e.type === "response.created") { S.busy = true; S.greeted = true; clearTimeout(S.nudgeT); S.thinking = true; S.ask = null; S.lastQ = null; status(); }
        else if (e.type === "response.done") {
          const id = e.response?.id, r = R(id); r.done = true; S.busy = false;
          // 💵 الاستهلاك الحقيقي من المزوّد (توكنات الصوت والنص، والمتخزّن منها) ← تكلفة المكالمة بالظبط
          const u = e.response?.usage, it = u?.input_token_details || {}, ot = u?.output_token_details || {}, ct = it.cached_tokens_details || {};
          if (u) { const a = S.usage; a.text_in += it.text_tokens || 0; a.audio_in += it.audio_tokens || 0; a.text_cached += ct.text_tokens || 0; a.audio_cached += ct.audio_tokens || 0; a.text_out += ot.text_tokens || 0; a.audio_out += ot.audio_tokens || 0; }
          if (S.wait && S.waitResp && id && id !== S.waitResp && r.msg && !q(".as-box")?.isConnected && !S.acct) { S.wait = null; S.waitResp = null; }
          if (S.queued) { S.queued = false; S.dc.send(JSON.stringify({ type: "response.create" })); }
          if (id === S.capId || !S.capId) S.capDone = true;
          if ((e.response?.output || []).some((x) => x.type === "message")) r.msg = true;
          follow(id);
          if (S.finishing) {
            if (r.msg) { S.finishReady = true; setTimeout(() => S?.finishing && !S.busy && !S.speaking && performance.now() - (S.lastTalk || 0) > 800 && end(S.endDone), 1500); }
            else if (!S.byeAsked && !r.pending) { S.byeAsked = true; S.dc.send(JSON.stringify({ type: "response.create", response: { instructions: "Say a warm, short goodbye in the same dialect (one or two sentences): thank them, and tell them they can continue any time from your circle on the brain page. Do not call any tool." } })); }
          }
          // ردها كان كلام مش سؤال: لو العميل فضل ساكت ثانية بعد ما تخلّص، تكمّل هي (التقدير على طول الكلام لو حدث نهاية الصوت ماوصلش)
          // «في انتظار ردك» بس لو آخر جملة قالتها سؤال، أو طلبت حاجة وخانتها ظاهرة فعلًا. أي جملة تانية (زي «خلينا نكمل…») هي اللي تكمّل
          if (r.msg && (id === S.capId || !S.capId)) {
            const last = sentences(S.aBuf).pop() || "";
            // بتستنى بهدوء بس لو طلبت حاجة وخانتها ظاهرة فعلًا قدام العميل (الأداة لوحدها من غير ما تطلبها بالكلام مش انتظار)
            // سؤال في آخر جملتين من ردها: تستنى العميل. جملة عادية في الآخر («خلينا نبدأ خطوة بخطوة») = تكمّل هي بالسؤال
            const tail = sentences(S.aBuf).slice(-2);
            S.lastQ = isQ(last) || tail.some((x) => /[؟?]/.test(x) || isQ(x)) || (!!S.wait && !!(q(".as-box") || S.acct));
            nudge(Math.max(1800, S.aBuf.length * 75 + 1200)); status();
          }
          if (!r.msg) { S.thinking = false; status(); }
        } else if (e.type === "response.function_call_arguments.done") {
          const r = R(e.response_id); r.calls++; r.pending++;
          if (["suggest_competitor", "check_competitor"].includes(e.name)) r.force = true;   // تتكلم عن الحساب بعد ما يظهر، مش قبله
          let args = {}; try { args = JSON.parse(e.arguments || "{}"); } catch { /* أرجومنت مش JSON */ }
          const out = await tool(e.name, args);
          lg("tool", e.name, { args, out });
          r.pending--;
          if (!S || S.dc.readyState !== "open") return;
          S.dc.send(JSON.stringify({ type: "conversation.item.create", item: { type: "function_call_output", call_id: e.call_id, output: JSON.stringify(out) } }));
          follow(e.response_id);
        } else if (e.type === "response.output_audio_transcript.done" || e.type === "response.audio_transcript.done") {
          lg("agent", e.transcript || "");
          // 📥 طلبت رفع حاجة بالكلام من غير ما تفتح الخانة (نسيت الأداة): الخانة تظهر لوحدها
          const tx = e.transcript || "", ask = /ارفع|ترفع|ترفعها|ترفعلي|رفع|حمّل|حمل|ابعت|أرسل|ارسل|upload/i.test(tx);
          const kind = ask && (KW.logo.test(tx) ? "logo" : /صور|منتج|أعمال|حالات|شغل/.test(tx) ? "products" : KW.intro.test(tx) ? "intro" : "");
          if (kind && !q(".as-box") && S.wait !== kind) { S.wait = kind; S.waitResp = e.response_id || "x"; lg("sys", `box opened from speech: ${kind}`); setTimeout(() => S && box(kind), 300); }
          // ✍️ طلبت الحساب بالكلام («عطني حسابك واكتبه في الصندوق») من غير ما تفتح الخانة: الخانة تنوّر لوحدها (أي لهجة)
          const askType = /اكتب|تكتب|اكتبه|اكتبي|عطني|اعطني|أعطني|عطيني|ابعت|ابعث|أرسل|ارسل|حط|حطه|شاركني|الصندوق|المربع|الخانة/.test(tx);
          if (askType && KW.account.test(tx) && !S.acct && !q(".as-box") && !(state?.account) && !S.accChip) { S.wait = "account"; S.waitResp = e.response_id || "x"; lg("sys", "account box opened from speech"); acct(true); }
        }
        else if (e.type === "error") { console.warn("assistant:", e.error); lg("err", e.error?.message || "error"); }
      };
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      const r = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", body: offer.sdp, headers: { Authorization: `Bearer ${tok.value}`, "Content-Type": "application/sdp" } });
      if (!r.ok) throw new Error("تعذّر بدء المحادثة الآن، جرّب مرة أخرى بعد قليل");
      await pc.setRemoteDescription({ type: "answer", sdp: await r.text() });
      S.agent = tok.agent || ""; S.model = tok.model || ""; status();
      if (noMic) { ov?.classList.add("talked"); q("[data-err]").textContent = noMic; setTimeout(() => q("[data-type]")?.focus(), 300); }
      q("[data-tsend]").onclick = () => { const i = q("[data-type]"), v = i.value.trim(); if (!v) return i.focus(); i.value = ""; submit(v); };
      q("[data-type]").onkeydown = (ev) => {
        if (ev.key !== "Enter" || !ev.target.value.trim()) return;
        const v = ev.target.value.trim(); ev.target.value = "";
        submit(v);
      };
      loop();
    } catch (e) {
      if (!ov) return;   // اتقفلت وهي لسه بتتصل
      q("[data-err]").textContent = /[\u0600-\u06ff]/.test(e.message || "") ? e.message : "تعذّر بدء المحادثة الآن، جرّب مرة أخرى بعد قليل";
      q(".as-st").textContent = "";
    }
  }
  // 🟢 السطر اللي تحت الكرة: بتتكلم، ولا مستنية ردك، ولا بتفكّر، ولا بتحلّل حسابك (عشان مايبقاش فيه سكوت مش مفهوم)
  function status() {
    if (!S || !S.agent) return;
    const st = q(".as-st"); if (!st) return;
    const what = S.speaking ? "تتحدث" : S.show && !S.show.wait ? "📺 يُعرض الفيديو" : S.thinking ? "لحظة…" : S.muted ? "الميكروفون مكتوم: اكتب ردك أو شغّله" : S.lastQ ? "في انتظار ردك" : "";
    st.textContent = S.agent + (what ? ` · ${what}` : "") + (S.accTimer ? " · ⏳ حسابك قيد التحليل" : "");
  }
  // 📊 فاضل قد إيه: الحساب ← أسئلة العقل ← الشعار ← الصور
  function step(id) { if (!S || !S.steps.includes(id)) return; S.done.add(id); prog(); }
  function prog() {
    const n = S?.steps.length, p = q(".as-prog"); if (!p) return;
    p.hidden = !n; if (!n) return;
    const d = Math.min(n, S.done.size);
    q("[data-pt]").textContent = d >= n ? "اكتملت المحادثة تقريبًا" : `الخطوة ${d + 1} من ${n}`;
    q("[data-pb]").style.width = `${Math.round((100 * d) / n)}%`;
  }
  // ⏎ اللي اتكتب في الخانة (بزرار السهم أو Enter). الحساب: المنصة نفسها بتبدأ تحليله على طول، وسعاد بتعرف إنه بدأ وتكمّل
  async function submit(v) {
    if (!S || !v) return;
    if (S.wait === "rival" && /instagram|tiktok|@|\.com|^[\w.]{3,30}$/i.test(v)) { q(".as-box")?.remove(); S.wait = null; return rivalCheck(v); }
    if (!S.acct && S.wait !== "account") return say(v);
    acct(false); S.typed += " " + v;
    const r = await api("/api/assistant/account", { method: "POST", ...jsonBody({ account: v }) }).catch((e) => ({ ok: false, error: e.message }));
    if (r.ok) { changed(); step("account"); S.accChip = chip(`⏳ <span><b>تحليل حسابك</b><br>${esc(v)}</span>`); pollAccount(); }
    say(r.ok ? `حسابي: ${v}\n(SYSTEM: the user typed this account and its analysis already started in the background. Do not call start_account_analysis. Thank them briefly and go on with the next question.)`
      : `حسابي: ${v}\n(SYSTEM: the account analysis could not start (${r.error || "error"}). Tell them kindly the team will check it, and go on with the next question.)`);
  }
  // ✍️ الحساب بيتكتب في نفس خانة الكتابة: الخانة بتنوّر وتحتها سطر بيقول المطلوب
  function acct(on) {
    if (!S) return; S.acct = on; if (on) S.wait = "account";
    const h = q("[data-hint]"), t = q(".as-type"), inp = q("[data-type]");
    ov?.classList.add("talked"); t?.classList.toggle("acct", on); if (h) { h.hidden = !on; h.textContent = on ? "اكتب رابط حسابك على إنستغرام أو تيك توك، أو اسم المستخدم (مثلًا @studio)، ثم اضغط ➤" : ""; }
    if (inp) { inp.dir = on ? "ltr" : "auto"; inp.placeholder = on ? "instagram.com/… أو @اسم_الحساب" : "أو اكتب هنا واضغط Enter"; if (on) setTimeout(() => inp.focus(), 200); }
  }
  // «بعدين» بالكلام = زرار «لاحقًا»
  const LATER = /بعدين|لاحق|مش دلوقت|مش الوقت|مش عايز|ماعنديش|معنديش|ما عندي|مفيش|خليها|later|not now/i;
  function later() { q(".as-box")?.remove(); acct(false); S.box = null; S.wait = null; }
  // سؤال؟ علامة الاستفهام، أو كلمة سؤال (بأي لهجة) لو النص اتكتب من غير «؟»
  // كلمات السؤال في كل اللهجات (الخليجي والنجدي والشامي والمغاربي كمان): «فاضي نسولف؟» من غير علامة استفهام سؤال برضه
  const QW = /(^|\s)(هل|ايه|إيه|ليه|لماذا|ازاي|إزاي|كيف|كيفك|كيفاش|شلون|شلونك|وشلونك|شنو|وش|ايش|إيش|شو|مين|من هو|فين|وين|أين|امتى|إمتى|متى|كام|كم|ماذا|ما هو|ما هي|عندك|عندكم|تحب|تحبي|تقدر|ممكن|فاضي|فاضية|جاهز|جاهزة|مستعد|مستعدة|تبي|تبين|تبغى|تبغي|ودك|شرايك|رأيك|رايك|بدك|واش|علاش|نسولف|ندردش|حالك)(\s|$|[،,])/;
  const isQ = (t) => /[؟?]\s*$/.test(t) || (QW.test(t) && !/[.!]\s*$/.test(t.trim()) ) || /(ولا لا|ولا لأ|صح؟|مش كده|ولا لاء|ولا؟|ولا لا\b)\s*[.!]?$/.test(t);
  function nudge(ms) {
    if (!S) return;
    clearTimeout(S.nudgeT);
    if (S.lastQ !== false || S.finishing || (S.wait && (q(".as-box") || S.acct))) return;   // سؤال، أو طلب (رفع / كتابة): تستنى العميل
    if (S.nudged >= 2) return;   // كمّلت لوحدها مرة ولسه العميل ماردش: تسكت وتستنى (وإلا كانت بتعيد السؤال كل شوية بصيغ مختلفة)
    S.nudgeT = setTimeout(() => { if (S && S.lastQ === false && (S.nudged || 0) < 2 && S.dc?.readyState === "open") { S.lastQ = null; S.nudged = (S.nudged || 0) + 1; lg("sys", "auto-continue");
      // تكمّل بسؤال مباشر، مش بجملة انتقالية تانية («خليني أرتب…» وبعدين تسكت تاني)
      S.dc.send(JSON.stringify({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text",
        text: "You ended your last turn without asking anything, so the user is waiting for you. Now ask your next question directly, in one short sentence, with no transition or filler before it." }] } }));
      S.dc.send(JSON.stringify({ type: "response.create" })); } }, ms);
  }
  function unmute() {
    if (!S || q("[data-unmute]")) return;
    const b = document.createElement("button"); b.type = "button"; b.className = "as-go"; b.dataset.unmute = "1"; b.textContent = "🔊 اضغط لسماع المساعدة";
    q(".as-acts")?.prepend(b);
    b.onclick = () => { S?.ctx?.resume(); S?.el?.play().catch(() => {}); b.remove(); };
  }
  function loop() {
    if (!S) return;
    idle(performance.now());
    // 🔉 صوت سعاد هو الأهم: لو اتكلمت والفيديو الاستعراضي شغال، صوته بيوطى تحتها ويرجع لما تسكت
    if (S.show?.v) { const want = S.speaking ? 0.12 : 1; const v = S.show.v; if (Math.abs(v.volume - want) > 0.01) v.volume += (want - v.volume) * 0.15; }
    ov?.classList.toggle("has-box", !!ov.querySelector(".as-box"));
    const mu = S.micLevel ? S.micLevel() : 0, ag = S.outLevel ? S.outLevel() : 0;
    const talk = ag > 0.012, user = !talk && mu > 0.03;
    orb?.set(talk ? Math.min(1, ag * 7) : user ? Math.min(0.35, mu * 2) : 0, user);
    // بتتكلم ولا سكتت: من مستوى صوتها نفسه (السكتة الصغيرة بين الكلمات ماتتحسبش). المكتوب بيبدأ مع الصوت، ولما تسكت يتقرر تكمّل ولا تستنى
    const now = performance.now();
    if (talk) S.lastTalk = now;
    const sp = talk || (!!S.lastTalk && now - S.lastTalk < 650);
    if (sp !== S.speaking) {
      S.speaking = sp;
      if (sp) { S.thinking = false; S.talkAt = now; if (!S.capAt) S.capAt = now; if (!S.spFirst) S.spFirst = now; ov?.classList.add("talked"); } else { S.spLast = now; S.agentMs = (S.agentMs || 0) + (now - (S.talkAt || now)); nudge(1200); if (S.finishing) setTimeout(() => S?.finishing && S.finishReady && !S.busy && !S.speaking && end(S.endDone), 900); }   // قالت مع السلامة وسكتت: تقفل
      status();
    }
    requestAnimationFrame(loop);
  }
  async function end(finished, instant = false) {
    if (!S) return;
    const s = S; S = null;
    removeEventListener("hashchange", s.onHash);
    clearInterval(s.accTimer); clearInterval(s.showT); clearInterval(s.fvT); clearInterval(s.show?.t); clearInterval(s.capT); clearTimeout(s.nudgeT); clearInterval(s.logT); clearInterval(s.pageT);
    // 💸 تكلفة المكالمة (ببلاش على العميل، بس علينا) ← عدّاد الصرف، وبتتكتب في سجل المكالمة في «معمل سعاد»
    if (s.greeted) {
      const u = await api("/api/assistant/usage", { method: "POST", ...jsonBody({ call_s: (performance.now() - s.t0) / 1000, agent_s: (s.agentMs || 0) / 1000, model: s.model || "", usage: s.usage }) }).catch(() => null);
      if (u?.usd != null) s.usd = u.usd;
    }
    { const keep = S; S = s; lg("sys", finished ? "end: finished" : "end: closed"); flush(true); S = keep; }
    if (s.hist && history.state?.assistant) history.back();   // اتقفل من الزرار: نشيل خطوة التاريخ اللي ضفناها
    try { s.dc?.close(); s.pc?.close(); s.mic?.getTracks().forEach((t) => t.stop()); s.ctx?.close(); if (s.el) s.el.srcObject = null; } catch { /* اتقفل خلاص */ }
    // المحادثة بتتحسب «خلصت» لو المساعد قفلها، أو العميل جاوب على كام سؤال؛ غير كده بتظهر تاني المرة الجاية
    if (finished || s.saved >= 3) await api("/api/assistant/done", { method: "POST", ...jsonBody({}) }).catch(() => {});
    // التأجيل لنفس العلامة بس: حساب جديد على نفس المتصفح (أو علامة تانية) المساعدة بتطلعله عادي
    else try { localStorage.setItem(SKIP_KEY, JSON.stringify({ b: state?.brand || "", t: Date.now() })); } catch { /* التخزين مقفول */ }
    await close(instant);
    if (typeof NH !== "undefined") NH?.refresh?.();
    S_done?.();
  }
  let S_done = null;
  addEventListener("popstate", () => { if (S) { S.hist = false; end(false, dock); } });

  // بترجع false لو المساعد مافتحش (مش جاهز أو مش وقته)، وtrue بعد ما المكالمة تخلص
  // 🔒 مكالمة واحدة بس: ضغطتين ورا بعض (أو الفتح التلقائي مع ضغطة) كانوا بيفتحوا مكالمتين بيتكلموا مع بعض
  let lock = null;
  function maybe(force, el) {
    if (ov || S) return Promise.resolve(true);   // مفتوح أصلًا
    if (lock) return force === true ? lock.then((ok) => ok || maybe(true, el)) : lock;   // الضغطة بتستنى الفتح التلقائي، ولو مافتحش تفتح هي
    lock = run(force, el).finally(() => { lock = null; });
    return lock;
  }
  // هل المساعدة هتفتح؟ (من غير ما تفتح): عشان أول استخدام يروح لصفحة العقل الأول ويفتحها من دايرة «؟»
  async function gate(force) {
    try { state = await api("/api/assistant"); } catch { return false; }
    const forced = force === true || /[?&]assistant=1\b/.test(location.search);   // من دايرة «؟» (أو للتجربة): يفتح حتى لو اتعمل قبل كده
    // 🚨 عميل جديد والمساعدة ماطلعتلوش: السبب بيروح صندوق الأخطاء (عشان نعرف من غير ما حد يبلّغ)
    const miss = (why) => { if (state?.new && !state?.done) fetch("/api/issues/client", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "ui", screen: "assistant", message: "المساعدة الصوتية لم تظهر لعميل جديد", raw: why }) }).catch(() => {}); return false; };
    if (!state?.ready) return miss(`not ready: ${state?.why || "?"}`);
    if (!forced && (state.done || !state.new)) return false;
    if (!forced) try { const k = JSON.parse(localStorage.getItem(SKIP_KEY) || "null"); if (k?.b && k.b === state.brand && Date.now() - k.t < 864e5) return miss("skipped today (closed early before)"); } catch { /* التخزين مقفول أو قيمة قديمة */ }
    return true;
  }
  // 🧠 صفحة العقل لسه مفتوحة؟ المكالمة بتاعتها: لو العميل خرج منها قبل ما تفتح أو وهي شغالة، المكالمة ماتكملش في صفحة تانية
  const onBrain = () => { const m = document.querySelector("#nh .bm"); return !!m && m.isConnected && m.offsetParent !== null; };
  async function run(force, el) {
    const fromBrain = !!(el || document.querySelector('[data-n="quiz"]'))?.closest?.(".bm");
    if (!(await gate(force))) return false;
    if (fromBrain && !onBrain()) return false;   // ضغط على سعاد وخرج من العقل قبل ما تفتح
    calm = !!el?.classList?.contains("fu-call") || document.body.classList.contains("fu-cine");
    from = el || document.querySelector('[data-n="quiz"]');
    dock = !!from?.closest?.(".bm");   // مفتوح من خريطة العقل
    await new Promise((res) => { S_done = res; call(); });
    return true;
  }

  return { maybe, can: () => (ov || S ? Promise.resolve(false) : gate(false)), open: async (el) => { try { localStorage.removeItem(SKIP_KEY); } catch { /* */ } state = null; return maybe(true, el); } };
})();
