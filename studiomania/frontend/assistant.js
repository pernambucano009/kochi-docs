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
body.as-docked .hp-fab,body.as-docked .hp-tease,body.as-docked #nhPTitle,body.as-docked #nhCorner,body.as-docked .bm-hint{opacity:0!important;pointer-events:none!important;transition:opacity .4s}
.as-prog{width:min(260px,80vw);display:flex;flex-direction:column;gap:4px;align-items:center;font-size:12.5px;opacity:.75}
.as-prog i{display:block;width:100%;height:4px;border-radius:4px;background:rgba(127,127,127,.25);overflow:hidden}.as-prog i b{display:block;height:100%;width:0;background:#E5613E;transition:width .6s}
.as-type{flex-direction:column;align-items:center;visibility:hidden;opacity:0;transition:opacity .5s}.as-ov.talked .as-type{visibility:visible;opacity:1}.as-hint{font-size:12.5px;opacity:.8;min-height:0;text-align:center}.as-type.acct input{border-color:#E5613E;box-shadow:0 0 0 3px rgba(229,97,62,.18)}
.as-ov.dock.on{-webkit-backdrop-filter:none;backdrop-filter:none}.as-ov.dock>*{pointer-events:auto}.as-ov.dock .as-side{display:none}
.as-tw{position:relative;display:flex;align-items:center}.as-tw input{padding-right:46px!important}
.as-send{position:absolute;right:5px;width:34px;height:34px;border-radius:50%;border:0;background:#E5613E;color:#fff;font-size:14px;cursor:pointer;display:grid;place-items:center}
.as-send:hover{filter:brightness(1.08)}
.as-ov.dock .as-orb{width:min(240px,36vh)}.as-ov.dock .as-type input{width:min(80vw,300px)}
@media (max-width:720px){.as-ov.dock{top:auto;width:100vw;height:auto;max-height:60vh;padding:12px 14px 18px;gap:10px}.as-ov.dock .as-orb{width:min(130px,22vh)}}
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
  function close() {
    return new Promise((res) => {
      if (!ov) return res();
      const o = ov; ov = null;
      const done = () => { orb?.stop(); orb = null; o.remove(); if (from) from.style.visibility = ""; res(); };
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
  const KW = { account: /انست|إنست|instagram|تيك ?توك|tiktok|لينك|رابط/i, logo: /شعار|لوجو|لوغو|logo/i, products: /صور|منتج|أعمال/i, intro: /إنترو|انترو|intro/i };
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
    if (name === "get_account_analysis") return api("/api/assistant/account").catch(() => ({ ready: false }));
    if (name === "show_input") {
      if (args.kind === "none") { later(); return { ok: true, closed: true }; }
      if (BOX[args.kind]) { S.box = args.kind; S.ask = S.capId || true; S.wait = args.kind; }
      return { ok: true, shown: args.kind };
    }
    // later: العميل قال «بعدين»: تقفل من غير ما المكالمة تتحسب خلصت (تقدر ترجعلها من دايرة سعاد)
    if (name === "set_user_gender") return api("/api/assistant/gender", { method: "POST", ...jsonBody({ gender: args.gender }) }).catch(() => ({ ok: false }));
    if (name === "finish") {
      S.finishing = true; S.endDone = !args.later;
      setTimeout(() => S?.finishing && end(S.endDone), 9000);   // احتياط لو الصوت ماوصلش
      if (!S.speaking) setTimeout(() => S?.finishing && !S.speaking && end(S.endDone), 1500);
      return { ok: true };
    }
    return { ok: false, error: "unknown tool" };
  }
  // 💬 كلام من الشاشة للمساعد (كتابة، أو «رفعت الشعار»): بيتبعت كأن العميل قاله، والمساعد يرد عليه
  function say(text) {
    if (!S?.dc || S.dc.readyState !== "open") return;
    S.typed += " " + text; S.wait = null; clearTimeout(S.nudgeT);
    S.dc.send(JSON.stringify({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } }));
    // لو هي لسه بتتكلم: الرد يستنى لحد ما تخلّص (طلب رد وهي بترد كان بيترفض، والكلام المكتوب يضيع)
    if (S.busy) S.queued = true; else S.dc.send(JSON.stringify({ type: "response.create" }));
  }
  // 📥 المكان اللي العميل يكتب أو يرفع فيه اللي المساعد طلبه (الحساب، الشعار، صور المنتجات، الإنترو)
  const BOX = {
    account: { t: "رابط حسابك على إنستغرام أو تيك توك", ph: "instagram.com/… أو @اسم_الحساب" },
    logo: { t: "ارفع شعارك", accept: "image/png,image/jpeg,image/webp", kind: "logos", done: "رفعت الشعار" },
    products: { t: "ارفع صور منتجاتك أو أعمالك", accept: "image/png,image/jpeg,image/webp", multi: true, kind: "products", done: "رفعت صور المنتجات" },
    intro: { t: "ارفع فيديو الإنترو", accept: "video/*", video: true, done: "رفعت فيديو الإنترو" },
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
    d.querySelector("[data-later]").onclick = () => { d.remove(); say("سأرسله لاحقًا"); };
    if (k.ph) {
      const inp = d.querySelector("input"), send = () => { const v = inp.value.trim(); if (!v) return; d.remove(); say(`حسابي: ${v}`); };
      d.querySelector("[data-send]").onclick = send; inp.onkeydown = (e) => { if (e.key === "Enter") send(); };
      setTimeout(() => inp.focus(), 300);
      return;
    }
    const drop = d.querySelector(".as-drop"), fin = d.querySelector("input");
    const up = async (files) => {
      files = [...files].slice(0, k.multi ? 30 : 1); if (!files.length) return;
      err(""); drop.querySelector("span").textContent = "⏳ جارٍ الرفع…";
      const f = new FormData();
      if (k.video) { f.append("kind", "intro"); f.append("file", files[0]); } else { f.append("kind", k.kind); files.forEach((x) => f.append("files", x)); }
      try {
        const r = await fetch(`/api/ad-brains/${encodeURIComponent(state.brand)}/${k.video ? "brand-video" : "assets"}`, { method: "POST", body: f, credentials: "same-origin" });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "تعذّر الرفع، جرّب مرة أخرى");
        d.remove(); changed(); step(k.kind === "logos" ? "logo" : k.kind === "products" ? "photos" : "intro"); chip(`✓ <span><b>${esc(k.t)}</b></span>`); say(`(${k.done} الآن)`);
      } catch (e) { err(e.message); drop.querySelector("span").textContent = "جرّب مرة أخرى"; }
    };
    fin.onchange = () => up(fin.files);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = () => drop.classList.remove("over");
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); up(e.dataTransfer.files); };
  }
  async function pollAccount() {
    if (!S || S.accTimer) return;
    S.accTimer = setInterval(async () => {
      const r = await api("/api/assistant/account").catch(() => null);
      if (!S || !r) return;
      if (r.ready || r.status === "failed") {
        clearInterval(S.accTimer); S.accTimer = null;
        changed(); status();
        if (S.accChip) S.accChip.innerHTML = r.ready ? `✓ <span><b>حُلّل حسابك</b><br>${esc(r.account || "")}</span>` : `⚠️ <span><b>تعذّر تحليل الحساب</b></span>`;
      }
    }, 6000);
  }

  async function call() {
    if (S) await end(false);   // احتياط: أي مكالمة قديمة تتقفل قبل الجديدة
    mount(`<div class="as-in"><div class="as-orb"><canvas></canvas></div></div><div class="as-st">⏳ جارٍ الاتصال…</div>
      <div class="as-prog" hidden><span data-pt></span><i><b data-pb></b></i></div><div class="as-cap"></div>
      <div class="as-type"><div class="as-tw"><input data-type placeholder="أو اكتب هنا واضغط Enter"><button type="button" class="as-send" data-tsend aria-label="أرسل">➤</button></div><p class="as-hint" data-hint hidden></p></div>
      <div class="as-acts"><button type="button" class="as-btn end" data-end>⏹ أنهِ المحادثة</button></div><p class="as-err" data-err></p><div class="as-side"></div>`);
    S = { saved: 0, aBuf: "", capI: 0, capAt: 0, capDone: false, box: null, typed: "", t0: performance.now(), agentMs: 0, steps: [...(state?.steps || [])], done: new Set(), speaking: false };
    prog();
    S.capT = setInterval(capTick, 120);
    // ⬅️ زرار الرجوع بيقفل المساعد (والكرة تصغر وترجع) بدل ما يسيبها على الشاشة: خطوة في التاريخ بنفس العنوان
    history.pushState({ ...(history.state || {}), assistant: 1 }, "", location.href); S.hist = true;
    q("[data-end]").onclick = () => end(false);
    try {
      q(".as-st").textContent = "🎙️ اسمح للمتصفح باستخدام الميكروفون إن ظهر لك طلب بذلك";
      // 🎙️ من غير ميكروفون (مش موجود، أو العميل رفض الإذن) المكالمة بتكمل: المساعد بيتكلم والعميل بيكتب
      let mic = null, noMic = "";
      try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
      catch (me) { noMic = me.name === "NotAllowedError" ? "لم يُسمح باستخدام الميكروفون، فاكتب ردودك في الخانة. للكلام بالصوت: اسمح بالميكروفون من شريط العنوان ثم افتح المساعد مرة أخرى"
        : "لم نجد ميكروفونًا في هذا الجهاز، فاكتب ردودك في الخانة"; }
      S.mic = mic; S.ctx = new AudioContext(); if (mic) S.micLevel = meter(S.ctx, S.ctx.createMediaStreamSource(mic));
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
        if (!r || !r.done || r.pending || !r.calls || r.msg || S.finishing) return;
        delete S.resp[id]; S.dc.send(JSON.stringify({ type: "response.create" }));
      };
      dc.onmessage = async (m) => {
        let e; try { e = JSON.parse(m.data); } catch { return; }
        if (e.type === "response.output_audio_transcript.delta" || e.type === "response.audio_transcript.delta") {
          if (e.response_id !== S.capId) { S.capId = e.response_id; capReset(); }   // كل رد بيبدأ الكلام المكتوب من الأول، ماتتركبش على بعض
          R(e.response_id).msg = true; if (!S.aBuf) S.textAt = performance.now(); S.aBuf += e.delta; S.noAudio = !S.outLevel;
        } else if (e.type === "response.output_item.added" && e.item?.type === "message") R(e.response_id).msg = true;
        else if (e.type === "input_audio_buffer.speech_started") { S.capId = null; capReset(); clearTimeout(S.nudgeT); S.lastQ = null; status(); }
        else if (e.type === "input_audio_buffer.speech_stopped") { S.thinking = true; status(); }
        else if (e.type === "conversation.item.input_audio_transcription.completed") { if ((q(".as-box") || S.acct || S.wait) && LATER.test(e.transcript || "")) later(); }

        else if (e.type === "session.created" || e.type === "session.updated") greet();
        else if (e.type === "response.created") { S.busy = true; S.greeted = true; clearTimeout(S.nudgeT); S.thinking = true; S.ask = null; S.lastQ = null; status(); }
        else if (e.type === "response.done") {
          const id = e.response?.id, r = R(id); r.done = true; S.busy = false;
          if (S.queued) { S.queued = false; S.dc.send(JSON.stringify({ type: "response.create" })); }
          if (id === S.capId || !S.capId) S.capDone = true;
          if ((e.response?.output || []).some((x) => x.type === "message")) r.msg = true;
          follow(id);
          // ردها كان كلام مش سؤال: لو العميل فضل ساكت ثانية بعد ما تخلّص، تكمّل هي (التقدير على طول الكلام لو حدث نهاية الصوت ماوصلش)
          // «في انتظار ردك» بس لو آخر جملة قالتها سؤال، أو طلبت حاجة وخانتها ظاهرة فعلًا. أي جملة تانية (زي «خلينا نكمل…») هي اللي تكمّل
          if (r.msg && (id === S.capId || !S.capId)) {
            const last = sentences(S.aBuf).pop() || "";
            S.lastQ = /[؟?]\s*$/.test(last) || !!S.wait;   // طلبت حاجة تتكتب أو تترفع: بتستنى بهدوء لحد ما توصل (أو «لاحقًا»)
            nudge(Math.max(1800, S.aBuf.length * 75 + 1200)); status();
          }
          if (!r.msg) { S.thinking = false; status(); }
        } else if (e.type === "response.function_call_arguments.done") {
          const r = R(e.response_id); r.calls++; r.pending++;
          let args = {}; try { args = JSON.parse(e.arguments || "{}"); } catch { /* أرجومنت مش JSON */ }
          const out = await tool(e.name, args);
          r.pending--;
          if (!S || S.dc.readyState !== "open") return;
          S.dc.send(JSON.stringify({ type: "conversation.item.create", item: { type: "function_call_output", call_id: e.call_id, output: JSON.stringify(out) } }));
          follow(e.response_id);
        } else if (e.type === "error") console.warn("assistant:", e.error);
      };
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      const r = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", body: offer.sdp, headers: { Authorization: `Bearer ${tok.value}`, "Content-Type": "application/sdp" } });
      if (!r.ok) throw new Error("تعذّر بدء المحادثة الآن، جرّب مرة أخرى بعد قليل");
      await pc.setRemoteDescription({ type: "answer", sdp: await r.text() });
      S.agent = tok.agent || ""; status();
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
    const what = S.speaking ? "تتحدث" : S.thinking ? "لحظة…" : S.lastQ ? "في انتظار ردك" : "";
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
    t?.classList.toggle("acct", on); if (h) { h.hidden = !on; h.textContent = on ? "اكتب رابط حسابك على إنستغرام أو تيك توك، أو اسم المستخدم (مثلًا @studio)، ثم اضغط ➤" : ""; }
    if (inp) { inp.dir = on ? "ltr" : "auto"; inp.placeholder = on ? "instagram.com/… أو @اسم_الحساب" : "أو اكتب هنا واضغط Enter"; if (on) setTimeout(() => inp.focus(), 200); }
  }
  // «بعدين» بالكلام = زرار «لاحقًا»
  const LATER = /بعدين|لاحق|مش دلوقت|مش الوقت|مش عايز|ماعنديش|معنديش|ما عندي|مفيش|خليها|later|not now/i;
  function later() { q(".as-box")?.remove(); acct(false); S.box = null; S.wait = null; }
  function nudge(ms) {
    if (!S) return;
    clearTimeout(S.nudgeT);
    if (S.lastQ !== false || S.finishing || S.wait) return;   // سؤال، أو طلب (رفع / كتابة): تستنى العميل
    S.nudgeT = setTimeout(() => { if (S && S.lastQ === false && S.dc?.readyState === "open") { S.lastQ = null; S.dc.send(JSON.stringify({ type: "response.create" })); } }, ms);
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
    // بتتكلم ولا سكتت: من مستوى صوتها نفسه (السكتة الصغيرة بين الكلمات ماتتحسبش). المكتوب بيبدأ مع الصوت، ولما تسكت يتقرر تكمّل ولا تستنى
    const now = performance.now();
    if (talk) S.lastTalk = now;
    const sp = talk || (!!S.lastTalk && now - S.lastTalk < 650);
    if (sp !== S.speaking) {
      S.speaking = sp;
      if (sp) { S.thinking = false; S.talkAt = now; if (!S.capAt) S.capAt = now; if (!S.spFirst) S.spFirst = now; ov?.classList.add("talked"); } else { S.spLast = now; S.agentMs = (S.agentMs || 0) + (now - (S.talkAt || now)); nudge(1200); if (S.finishing) setTimeout(() => S?.finishing && !S.speaking && end(S.endDone), 700); }   // قالت مع السلامة وسكتت: تقفل
      status();
    }
    requestAnimationFrame(loop);
  }
  async function end(finished) {
    if (!S) return;
    const s = S; S = null;
    clearInterval(s.accTimer); clearInterval(s.capT); clearTimeout(s.nudgeT);
    // 💸 طول المكالمة وكلام سعاد فيها ← عدّاد الصرف (ببلاش على العميل، بس علينا)
    if (s.greeted) api("/api/assistant/usage", { method: "POST", ...jsonBody({ call_s: (performance.now() - s.t0) / 1000, agent_s: (s.agentMs || 0) / 1000 }) }).catch(() => {});
    if (s.hist && history.state?.assistant) history.back();   // اتقفل من الزرار: نشيل خطوة التاريخ اللي ضفناها
    try { s.dc?.close(); s.pc?.close(); s.mic?.getTracks().forEach((t) => t.stop()); s.ctx?.close(); if (s.el) s.el.srcObject = null; } catch { /* اتقفل خلاص */ }
    // المحادثة بتتحسب «خلصت» لو المساعد قفلها، أو العميل جاوب على كام سؤال؛ غير كده بتظهر تاني المرة الجاية
    if (finished || s.saved >= 3) await api("/api/assistant/done", { method: "POST", ...jsonBody({}) }).catch(() => {});
    // التأجيل لنفس العلامة بس: حساب جديد على نفس المتصفح (أو علامة تانية) المساعدة بتطلعله عادي
    else try { localStorage.setItem(SKIP_KEY, JSON.stringify({ b: state?.brand || "", t: Date.now() })); } catch { /* التخزين مقفول */ }
    await close();
    if (typeof NH !== "undefined") NH?.refresh?.();
    S_done?.();
  }
  let S_done = null;
  addEventListener("popstate", () => { if (S) { S.hist = false; end(false); } });

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
  async function run(force, el) {
    if (!(await gate(force))) return false;
    calm = !!el?.classList?.contains("fu-call") || document.body.classList.contains("fu-cine");
    from = el || document.querySelector('[data-n="quiz"]');
    dock = !!from?.closest?.(".bm");   // مفتوح من خريطة العقل
    await new Promise((res) => { S_done = res; call(); });
    return true;
  }

  return { maybe, can: () => (ov || S ? Promise.resolve(false) : gate(false)), open: async (el) => { try { localStorage.removeItem(SKIP_KEY); } catch { /* */ } state = null; return maybe(true, el); } };
})();
