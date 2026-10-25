// 👁 زرار العين جنب أي خانة باسوورد: يظهر الكلام ويخفيه. بيشتغل كمان على الخانات اللي بتتعمل بعد التحميل (صفحة الدخول بترسم نفسها).
(() => {
  const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const SHUT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  function add(inp) {
    if (inp.dataset.eye) return;
    inp.dataset.eye = "1";
    const wrap = document.createElement("span");
    wrap.className = "pw-eye";
    inp.replaceWith(wrap);
    const b = document.createElement("button");
    b.type = "button";
    const set = (show) => { inp.type = show ? "text" : "password"; b.innerHTML = show ? SHUT : EYE; b.setAttribute("aria-label", show ? "أخفِ كلمة المرور" : "أظهر كلمة المرور"); b.setAttribute("aria-pressed", show); };
    b.addEventListener("click", (e) => { e.preventDefault(); set(inp.type === "password"); inp.focus(); });
    wrap.append(inp, b);
    set(false);
  }
  const scan = () => document.querySelectorAll('input[type="password"]:not([data-eye])').forEach(add);
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", scan);
  scan();
})();
