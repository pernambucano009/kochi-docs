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
@keyframes uiDlgIn{from{opacity:0}to{opacity:1}}
@keyframes uiDlgPop{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ui-dlg,.ui-dlg-box{animation:none}}`;
  const st = document.createElement("style");
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
  const DANGER = /(تمسح|امسح|حذف|تحذف|تشيل|شيل|مسح|delete|remove)/i;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let chain = Promise.resolve();   // لو اتفتح أكتر من مربع ورا بعض: واحد واحد

  function open(kind, msg, def, opts = {}) {
    const run = () => new Promise((resolve) => {
      const back = document.createElement("div");
      back.className = "ui-dlg";
      back.setAttribute("role", "dialog");
      back.setAttribute("aria-modal", "true");
      const okT = opts.ok || (kind === "alert" ? "تمام" : kind === "prompt" ? "تمام" : DANGER.test(msg) ? "أيوه، كمّل" : "أيوه");
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
  window.uiPrompt = (msg, def, opts) => open("prompt", msg, def, opts);
  window.uiAlert = (msg, opts) => open("alert", msg, null, opts);
})();
