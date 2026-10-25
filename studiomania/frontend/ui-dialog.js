// 💬 مربعات الحوار بتاعة البرنامج (بدل رسايل المتصفح «app.simsimkit.com says»): تأكيد، وكتابة اسم، ورسالة.
// كلهم بيرجّعوا Promise: «await uiConfirm(…)» بيرجّع true/false، و«await uiPrompt(…)» بيرجّع الكلام أو null لو اتلغى.
(() => {
  const css = `
.ui-dlg{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;background:rgba(15,15,20,.42);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:uiDlgIn .18s ease-out}
.ui-dlg-box{width:min(440px,100%);background:var(--ui-dlg-bg,#fff);color:var(--ui-dlg-ink,#1b1b1f);border-radius:22px;padding:22px 22px 18px;box-shadow:0 24px 70px rgba(0,0,0,.28);font:inherit;animation:uiDlgPop .22s cubic-bezier(.2,.8,.2,1)}
.ui-dlg-msg{margin:0 0 14px;font-size:15px;line-height:1.7;white-space:pre-line;overflow-wrap:anywhere}
.ui-dlg-in{width:100%;box-sizing:border-box;margin:0 0 16px;padding:11px 14px;border-radius:12px;border:1.5px solid rgba(0,0,0,.12);background:var(--ui-dlg-field,#F7F7F5);color:inherit;font:inherit;font-size:14.5px;outline:none;transition:border-color .15s}
.ui-dlg-in:focus{border-color:#E5613E}
.ui-dlg-acts{display:flex;gap:8px;justify-content:flex-start}
.ui-dlg-acts button{border:0;border-radius:999px;padding:10px 22px;font:inherit;font-size:14px;cursor:pointer;transition:transform .12s,opacity .15s}
.ui-dlg-acts button:active{transform:scale(.97)}
.ui-dlg-ok{background:#E5613E;color:#fff;box-shadow:0 8px 20px rgba(229,97,62,.3)}
.ui-dlg-ok.danger{background:#D9443A;box-shadow:0 8px 20px rgba(217,68,58,.28)}
.ui-dlg-no{background:var(--ui-dlg-field,#F1EFEC);color:inherit}
:root[data-nh-theme="dark"] .ui-dlg-box{--ui-dlg-bg:#1f1f24;--ui-dlg-ink:#f2f2f2;--ui-dlg-field:rgba(255,255,255,.07)}
:root[data-nh-theme="dark"] .ui-dlg-in{border-color:rgba(255,255,255,.14)}
.ui-kn{width:min(520px,100%);max-height:86vh;overflow:auto}
.ui-kn h3{margin:0 0 2px;font-size:18px}.ui-kn .sub{margin:0 0 12px;font-size:13px;opacity:.7;line-height:1.7}
.ui-kn .bar{position:relative;height:6px;border-radius:99px;background:rgba(127,127,127,.18);margin:0 0 14px}
.ui-kn .bar i{position:absolute;inset-block:0;inset-inline-start:0;border-radius:99px;background:#E5613E}
.ui-kn .bar em{position:absolute;top:-3px;width:2px;height:12px;background:currentColor;opacity:.45}
.ui-kn ul{list-style:none;margin:0 0 14px;padding:0;display:grid;gap:6px}
.ui-kn li{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:start;padding:8px 10px;border-radius:12px;background:var(--ui-dlg-field,#F7F7F5);font-size:13.5px;line-height:1.55}
.ui-kn li.ok{opacity:.75}.ui-kn li b{font-weight:500}.ui-kn li small{display:block;opacity:.7;font-size:12px}
.ui-kn li .pt{font-size:12px;opacity:.7;white-space:nowrap}.ui-kn li .ck{font-size:14px}.ui-kn li .core{color:#E5613E;font-size:11px;margin-inline-start:6px}
@keyframes uiDlgIn{from{opacity:0}to{opacity:1}}
@keyframes uiDlgPop{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ui-dlg,.ui-dlg-box{animation:none}}`;
  const st = document.createElement("style");
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
  const DANGER = /(تمسح|امسح|حذف|تحذف|تشيل|شيل|مسح|delete|remove)/i;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let chain = Promise.resolve();   // إذا فُتح أكثر من مربع خلف بعض: واحد واحد

  function open(kind, msg, def, opts = {}) {
    const run = () => new Promise((resolve) => {
      const back = document.createElement("div");
      back.className = "ui-dlg";
      back.setAttribute("role", "dialog");
      back.setAttribute("aria-modal", "true");
      const okT = opts.ok || (kind === "alert" ? "حسنًا" : kind === "prompt" ? "حسنًا" : DANGER.test(msg) ? "نعم، تابع" : "نعم");
      back.innerHTML = `<div class="ui-dlg-box" dir="auto"><p class="ui-dlg-msg">${esc(msg)}</p>
        ${kind === "prompt" ? `<input class="ui-dlg-in" type="text" dir="auto" value="${esc(def ?? "")}" placeholder="${esc(opts.placeholder || "")}">` : ""}
        <div class="ui-dlg-acts"><button type="button" class="ui-dlg-ok${kind === "confirm" && DANGER.test(msg) ? " danger" : ""}">${esc(okT)}</button>
        ${kind === "alert" ? "" : `<button type="button" class="ui-dlg-no">${esc(opts.cancel || "إلغاء")}</button>`}</div></div>`;
      const prev = document.activeElement;
      const input = back.querySelector(".ui-dlg-in");
      const done = (v) => { document.removeEventListener("keydown", key, true); back.remove(); try { prev?.focus?.(); } catch { /* */ } resolve(v); };
      const ok = () => done(kind === "prompt" ? input.value : true);
      const no = () => done(kind === "prompt" ? null : kind === "alert" ? undefined : false);
      const key = (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); no(); }
        else if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); e.stopPropagation(); ok(); }
      };
      back.querySelector(".ui-dlg-ok").onclick = ok;
      const nb = back.querySelector(".ui-dlg-no");
      if (nb) nb.onclick = no;
      back.addEventListener("mousedown", (e) => { if (e.target === back && kind !== "prompt") no(); });
      document.addEventListener("keydown", key, true);
      document.body.appendChild(back);
      setTimeout(() => { if (input) { input.focus(); input.select(); } else back.querySelector(".ui-dlg-ok").focus(); }, 30);
    });
    const p = chain.then(run, run);
    chain = p.catch(() => {});
    return p;
  }
  window.uiConfirm = (msg, opts) => open("confirm", msg, null, opts);
  // 🧠 «العقل فاهمك قد إيه»: النسبة ومعاها كل شرط (اتحقق ولا لأ، ونقطه، وإزاي تكمّله)
  window.uiKnow = (k) => {
    if (!k || !k.items) return;
    const back = document.createElement("div");
    back.className = "ui-dlg";
    back.setAttribute("role", "dialog");
    back.setAttribute("aria-modal", "true");
    const fmt = (n) => (Math.round(n * 10) / 10).toString();
    back.innerHTML = `<div class="ui-dlg-box ui-kn" dir="rtl"><h3>العقل فاهمك <span class="num">${k.score}٪</span> · ${esc(k.level)}</h3>
      <p class="sub">هذه النسبة مجموع نقاط الشروط أدناه: لكل شرط نقاط ثابتة تحصل عليها عند تحققه. من <b>${k.need}٪</b> ومع الشروط الأساسية (●) يصبح العقل فاهمًا لك وتُنشأ خطة المحتوى تلقائيًا.</p>
      <div class="bar"><i style="width:${Math.min(100, k.score)}%"></i><em style="inset-inline-start:${k.need}%"></em></div>
      <ul>${k.items.map((i) => `<li class="${i.done ? "ok" : ""}"><span class="ck">${i.done ? "✅" : "○"}</span>
        <span><b>${esc(i.t)}</b>${i.core ? `<span class="core">● أساسي</span>` : ""}${i.done ? "" : `<small>${esc(i.hint)}</small>`}</span>
        <span class="pt num" dir="ltr">${fmt(i.got)} / ${i.pts}</span></li>`).join("")}</ul>
      <div class="ui-dlg-acts"><button type="button" class="ui-dlg-ok">حسنًا</button></div></div>`;
    const done = () => { document.removeEventListener("keydown", key, true); back.remove(); };
    const key = (e) => { if (e.key === "Escape") { e.preventDefault(); done(); } };
    back.querySelector(".ui-dlg-ok").onclick = done;
    back.addEventListener("mousedown", (e) => { if (e.target === back) done(); });
    document.addEventListener("keydown", key, true);
    document.body.appendChild(back);
  };
  window.uiPrompt = (msg, def, opts) => open("prompt", msg, def, opts);
  window.uiAlert = (msg, opts) => open("alert", msg, null, opts);

  // 📱 «كمّل على موبايلك»: الخطوة بتتبعت لتطبيق الموبايل (إشعار + QR)، والمربع بيستنى لحد ما الموبايل يرجّع النتيجة.
  // await uiPhone({kind:"shoot", fid}) أو uiPhone({kind:"voice", title, prompt}) ← الطلب بعد ما يخلص، أو null لو اتلغى
  const hreq = async (path, init = {}) => {
    const r = await fetch(path, { credentials: "same-origin", ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}) } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(typeof d.detail === "string" ? d.detail : "حدثت مشكلة، جرّب مرة أخرى");
    return d;
  };
  window.uiPhone = async (req) => {
    let h;
    try { h = await hreq("/api/handoff", { method: "POST", body: JSON.stringify(req) }); } catch (err) { uiAlert(err.message); return null; }
    return new Promise((resolve) => {
      const back = document.createElement("div");
      back.className = "ui-dlg";
      back.setAttribute("role", "dialog");
      back.setAttribute("aria-modal", "true");
      const qr = `/api/handoff/${h.id}/qr.svg?base=${encodeURIComponent(location.origin)}`;
      back.innerHTML = `<div class="ui-dlg-box" dir="rtl" style="text-align:center">
        <p class="ui-dlg-msg" style="margin-bottom:6px"><b>📱 أكمل على جوالك</b></p>
        <p style="margin:0 0 14px;font-size:13px;opacity:.72;line-height:1.7">${esc(req.kind === "shoot" ? "وصلك إشعار على تطبيق سمسم كيت: افتحه وصوّر بالملقّن، وسيعود الفيديو إلى هنا تلقائيًا." : "وصلك إشعار على تطبيق سمسم كيت: سجّل بصوتك، وسيعود التسجيل إلى هنا تلقائيًا.")}<br>لم يصلك؟ صوّر هذا الرمز بكاميرا الجوال.</p>
        <img src="${qr}" alt="QR" width="190" height="190" style="width:190px;height:190px;box-sizing:border-box;border-radius:16px;background:#fff;padding:6px">
        <p data-st style="margin:12px 0 16px;font-size:13px;opacity:.8">⏳ في انتظار الجوال…</p>
        <div class="ui-dlg-acts" style="justify-content:center"><button type="button" class="ui-dlg-no">إلغاء</button></div></div>`;
      let timer = 0, over = false;
      const finish = (val) => {
        if (over) return; over = true;
        clearInterval(timer); document.removeEventListener("keydown", key, true); back.remove(); resolve(val);
      };
      const cancel = () => { hreq(`/api/handoff/${h.id}`, { method: "DELETE" }).catch(() => {}); finish(null); };
      const key = (e) => { if (e.key === "Escape") { e.preventDefault(); cancel(); } };
      back.querySelector(".ui-dlg-no").onclick = cancel;
      document.addEventListener("keydown", key, true);
      document.body.appendChild(back);
      timer = setInterval(async () => {
        const x = await hreq(`/api/handoff/${h.id}`).catch(() => null);
        if (x?.status === "done") { back.querySelector("[data-st]").textContent = "✓ وصل من الجوال"; setTimeout(() => finish(x), 700); }
      }, 3000);
    });
  };
})();
