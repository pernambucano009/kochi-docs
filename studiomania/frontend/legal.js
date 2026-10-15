// تبديل اللغة في الصفحات العامة (عربي / English) والتاريخ
(() => {
  const set = (l) => {
    document.querySelectorAll("[data-l]").forEach((el) => { el.hidden = el.dataset.l !== l; });
    document.querySelectorAll("[data-sw]").forEach((b) => b.classList.toggle("on", b.dataset.sw === l));
    document.documentElement.lang = l; document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    try { localStorage.setItem("sk_lang", l); } catch {}
  };
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-sw]"); if (b) set(b.dataset.sw); });
  let l = new URLSearchParams(location.search).get("lang");
  try { l = l || localStorage.getItem("sk_lang"); } catch {}
  set(l === "en" ? "en" : "ar");
  document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
