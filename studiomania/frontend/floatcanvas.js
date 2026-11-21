// 🫧 كانفاس الفقاعات الطايرة (نفس فكرة كانفاس العقل): نقط في الخلفية بتمشي مع الصفحة، وأي عنصر [data-fc] تمسكه وتحرّكه،
// وسحب الخلفية بيحرّك الكل، والرول (أو قرصة الإيدين على الموبايل) بيعمل زوم حوالين المكان اللي انت عليه.
// أماكن العناصر اللي حرّكتها بتتحفظ في المتصفح (لكل صفحة مفتاح)، وباقي العناصر في أماكنها الافتراضية.
// الاستخدام: FloatCanvas.mount(viewport, { key, onMove(id, x, y), onTap(target, event), onBg() }) ← { place(), fit(), pos(id), reset() }
const FloatCanvas = (() => {
  const GAP = 22;
  const load = (k) => { try { return JSON.parse(localStorage.getItem(`fc.${k}`) || "{}") || {}; } catch { return {}; } };
  const save = (k, v) => { try { localStorage.setItem(`fc.${k}`, JSON.stringify(v)); } catch { /* */ } };

  function mount(vp, opt = {}) {
    const C = { view: opt.view || null, pos: load(opt.key), drag: null, pan: null, pts: new Map(), pinch: null, noClick: false };
    const world = () => vp.querySelector(".fc-world");
    function apply() {
      const v = C.view, w = world();
      if (!v || !w) return;
      w.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`;
      vp.style.backgroundSize = `${GAP * v.s}px ${GAP * v.s}px`;
      vp.style.backgroundPosition = `${v.x}px ${v.y}px`;
      opt.onView?.(v);
    }
    const toWorld = (cx, cy) => { const r = vp.getBoundingClientRect(), v = C.view; return [(cx - r.left - v.x) / v.s, (cy - r.top - v.y) / v.s]; };
    function setPos(el, x, y) { el.style.left = `${x}px`; el.style.top = `${y}px`; el.dataset.x = x; el.dataset.y = y; }
    // العناصر اللي اتحرّكت قبل كده بترجع لمكانها
    function place() {
      vp.querySelectorAll("[data-fc]").forEach((el) => {
        const p = C.pos[el.dataset.fc];
        if (p) { setPos(el, p[0], p[1]); opt.onMove?.(el.dataset.fc, p[0], p[1], true); }
      });
    }
    // كل العناصر جوه الشاشة (أول مرة، أو لما الصفحة تتغيّر مقاسها)
    function fit(pad = 40) {
      const els = [...vp.querySelectorAll("[data-fc], [data-fcb]")];
      if (!els.length) { C.view = C.view || { x: vp.clientWidth / 2, y: vp.clientHeight / 2, s: 1 }; return apply(); }
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      els.forEach((el) => {
        const x = +el.dataset.x, y = +el.dataset.y, w = el.offsetWidth / 2, h = el.offsetHeight / 2;
        x0 = Math.min(x0, x - w); x1 = Math.max(x1, x + w); y0 = Math.min(y0, y - h); y1 = Math.max(y1, y + h + 24);
      });
      const top = opt.top || 0, W = vp.clientWidth, H = vp.clientHeight - top;
      const s = Math.max(0.3, Math.min(1.15, (W - pad * 2) / (x1 - x0), (H - pad * 2) / (y1 - y0)));
      C.view = { s, x: W / 2 - ((x0 + x1) / 2) * s, y: top + H / 2 - ((y0 + y1) / 2) * s };
      apply();
    }
    function zoomAt(f, cx, cy) {
      const v = C.view, r = vp.getBoundingClientRect(), px = cx - r.left, py = cy - r.top;
      const s = Math.max(0.25, Math.min(2.5, v.s * f)), k = s / v.s;
      C.view = { s, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
      apply();
    }
    vp.addEventListener("wheel", (e) => {
      if (e.target.closest(".fc-skip")) return;
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY);
    }, { passive: false });
    vp.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest(".fc-skip, input, textarea, select")) return;
      C.pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (C.pts.size === 2) {   // قرصة: زوم
        const [a, b] = [...C.pts.values()];
        C.drag = null; C.pan = null;
        C.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) };
        return;
      }
      const el = e.target.closest("[data-fc]");
      if (el && !el.hasAttribute("data-fcfix")) {
        const [wx, wy] = toWorld(e.clientX, e.clientY);
        C.drag = { el, id: el.dataset.fc, pid: e.pointerId, sx: e.clientX, sy: e.clientY, ox: +el.dataset.x - wx, oy: +el.dataset.y - wy, moved: false };
      } else if (!el) C.pan = { pid: e.pointerId, sx: e.clientX, sy: e.clientY, x: C.view.x, y: C.view.y, moved: false };
    });
    vp.addEventListener("pointermove", (e) => {
      if (C.pts.has(e.pointerId)) C.pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (C.pinch && C.pts.size === 2) {
        const [a, b] = [...C.pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        zoomAt(d / C.pinch.d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); C.pinch.d = d; C.noClick = true;
        return;
      }
      const p = C.pan;
      if (p && e.pointerId === p.pid) {
        if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 4) return;
        if (!p.moved) { p.moved = true; vp.setPointerCapture(e.pointerId); vp.classList.add("fc-panning"); }
        C.view.x = p.x + e.clientX - p.sx; C.view.y = p.y + e.clientY - p.sy;
        return apply();
      }
      const d = C.drag;
      if (!d || e.pointerId !== d.pid) return;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
      if (!d.moved) { d.moved = true; vp.setPointerCapture(e.pointerId); d.el.classList.add("fc-held"); }
      const [wx, wy] = toWorld(e.clientX, e.clientY), x = Math.round(wx + d.ox), y = Math.round(wy + d.oy);
      setPos(d.el, x, y);
      opt.onMove?.(d.id, x, y);
    });
    const up = (e) => {
      C.pts.delete(e.pointerId);
      if (C.pts.size < 2) C.pinch = null;
      if (C.pan && e.pointerId === C.pan.pid) { if (C.pan.moved) { C.noClick = true; vp.classList.remove("fc-panning"); } C.pan = null; }
      const d = C.drag;
      if (d && e.pointerId === d.pid) {
        C.drag = null;
        if (d.moved) { C.noClick = true; d.el.classList.remove("fc-held"); C.pos[d.id] = [+d.el.dataset.x, +d.el.dataset.y]; save(opt.key, C.pos); }
      }
      if (C.noClick) setTimeout(() => (C.noClick = false), 0);
    };
    vp.addEventListener("pointerup", up);
    vp.addEventListener("pointercancel", up);
    // الضغطة العادية (من غير سحب) بتروح للصفحة، وسحب أي حاجة مابيتحسبش ضغطة
    vp.addEventListener("click", (e) => {
      if (C.noClick) { e.stopImmediatePropagation(); e.preventDefault(); C.noClick = false; return; }
      if (!e.target.closest("[data-fc], .fc-skip, button, label, input, a")) opt.onBg?.(e);
    }, true);
    return {
      place, fit, apply, zoomAt,
      get view() { return C.view; },
      set view(v) { C.view = v; apply(); },
      pos: (id) => C.pos[id],
      forget(id) { delete C.pos[id]; save(opt.key, C.pos); },
    };
  }
  return { mount, GAP };
})();
