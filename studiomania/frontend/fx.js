// ✨ لمسة الزراير في البرنامج كله: لما تقف على أي زرار بيبرز لبرّه شوية، والسنيك (خط منوّر بديل) بيلف حواليه بالظبط على شكله.
// السنيك بيتعمل أول مرة الماوس يقف على الزرار بس (مش لكل زراير الصفحة مرة واحدة)، وبيتظبط على مقاس الزرار وأركانه لو اتغيّروا.
(() => {
  const SEL = "button, .btn, a.btn, label.btn, .nb-btn, .flw-btn, .flw-chip, .nh-gal-chip, .nh-chip, [role='button']";
  // اللي ليه حركته الخاصة أو صغير/جوه أدوات دقيقة (التايم لاين، المحرر) بيفضل زي ما هو
  const SKIP = ".hp-tease, .hp-box, .nh-tile, .nh-line, .nh-gal-card, .nh-wc, .nh-wh-cat, .nh-wh-gen, .nh-switch, .bm-n, [data-nofx], .nofx, input, select, textarea, .tl, .timeline, .mt-timeline, .gizmo";
  const NS = "http://www.w3.org/2000/svg";
  const fits = new WeakMap();
  const ro = new ResizeObserver((list) => list.forEach((e) => fits.get(e.target)?.()));

  function snake(el) {
    if (el.querySelector(":scope > .fx-snake")) return;
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "fx-snake");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = ["s3", "s2", "s1"].map((c) => `<rect class="${c}" pathLength="1000"/>`).join("");
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.append(svg);   // في الآخر (فيه كود يقرأ أول عنصر في الزر)
    const fit = () => {
      const w = el.offsetWidth, h = el.offsetHeight, cs = getComputedStyle(el);
      const bw = parseFloat(cs.borderTopWidth) || 0;
      // الأركان: بنفس دوران الزرار، ومش أكبر من نص ارتفاعه (عشان الزرار البيضاوي ميطلعش الخط حواليه بيضاوي)
      const r = Math.max(0, Math.min(parseFloat(cs.borderTopLeftRadius) || 0, w / 2, h / 2) - .8);
      Object.assign(svg.style, { top: `${-bw}px`, left: `${-bw}px`, width: `${w}px`, height: `${h}px` });
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.querySelectorAll("rect").forEach((x) => {
        x.setAttribute("x", .8); x.setAttribute("y", .8);
        x.setAttribute("width", Math.max(0, w - 1.6)); x.setAttribute("height", Math.max(0, h - 1.6));
        x.setAttribute("rx", r); x.setAttribute("ry", r);
      });
    };
    fits.set(el, fit);
    ro.observe(el);
    fit();
  }

  let on = null, box = null;   // الزرار المرفوع دلوقتي، ومكانه قبل ما يطلع
  const off = () => { on?.classList.remove("fx-on"); on = box = null; };
  document.addEventListener("pointerover", (e) => {
    const el = e.target.closest?.(SEL);
    if (!el || el.matches(SKIP) || el.closest(SKIP) || el.disabled) return;
    if (el.offsetWidth < 26 || el.offsetHeight < 22) return;   // أيقونات صغيرة جدًا
    el.classList.add("fx");
    snake(el);
    if (on !== el && e.pointerType !== "touch") {
      off();
      const r = el.getBoundingClientRect();
      on = el; box = { l: r.left - 2, r: r.right + 2, t: r.top - 2, b: r.bottom + 4 };
      el.classList.add("fx-on");
    }
  }, { passive: true });
  // 🫨 البروز بيتشال لما الماوس يخرج من مكان الزرار الأصلي (قبل ما يطلع لفوق)، مش من الزرار وهو مرفوع:
  // وإلا الماوس اللي على طرف الزرار التحتاني كان بيخرج منه أول ما يطلع، فيرجع، فيطلع تاني… والزرار يرعش
  document.addEventListener("pointermove", (e) => {
    if (on && (!on.isConnected || e.clientX < box.l || e.clientX > box.r || e.clientY < box.t || e.clientY > box.b)) off();
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", off);
  addEventListener("scroll", off, { capture: true, passive: true });
  addEventListener("blur", off);
  document.addEventListener("focusin", (e) => {
    const el = e.target.closest?.(SEL);
    if (el && !el.matches(SKIP) && !el.closest(SKIP) && el.offsetWidth >= 26) { el.classList.add("fx"); snake(el); }
  });
})();
