// 🤖 الموديل المخصص: بنفس شكل خريطة العقل (النقط والخطوط والزوم والكارت)، بس الخطوات خط واحد من الشمال لليمين:
// «▶ ابدأ» على الشمال، وبعدها الخطوات اللي العميل بيضيفها (فعل + منشن من «مكتبة العقل»)، و«＋» قبل «صدّر»، وآخر حاجة «انشر».
// كل اختيار في الخطوة نقطة فوقها (النوع، منين، العدد…). «ابدأ» بيشغّل الموديل ويطلّع الفيديو ويصدّره وينشره.
const AutoPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, list: [], id: null, rec: null, meta: null, lib: null, open: null, raf: 0, nodes: [], t0: performance.now(), timer: null };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const AR_N = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
  const IC = {
    pull: "M4.5 5h15a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M3.5 15.5l4.5-4.5 4 4 3-3 5 5 M15.5 8.5a1.3 1.3 0 1 1 0 .1z",
    intro: "M5 4.5v15l13-7.5z",
    outro: "M5 5h14v14H5z M9 9h6v6H9z",
    voice: "M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z M6 11a6 6 0 0 0 12 0 M12 17v3.5",
    music: "M9 17.5V6l10-2v11.5 M9 17.5a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 9 17.5z M19 15.5a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 19 15.5z",
    cut: "M6.5 8.5a2.5 2.5 0 1 0 0-.1z M6.5 18a2.5 2.5 0 1 0 0-.1z M8.6 9.6 20 18 M8.6 16.4 20 6",
    caption: "M4 6h16v12H4z M7.5 13.5h4 M13.5 13.5h3 M7.5 10.5h9",
    export: "M12 15V3.5 M7.5 8 12 3.5 16.5 8 M4.5 14v5.5h15V14",
    publish: "M20.5 3.5 10 14 M20.5 3.5 14 20.5l-4-6.5-6.5-4z",
  };
  const svg = (d, s = 22) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const KIND_T = { image: "صور", video: "فيديوهات", any: "صور وفيديوهات" };
  const aAPI = (path = "", opts) => api(`/api/automations/${S.id}${path}`, opts);

  // ---------- الخطوات ← فروع ونقط ----------
  function leavesOf(s) {
    const o = s.opts, M = S.meta, src = s.src ? `@${s.src.label || (s.src.mode === "folder" ? "المكتبة" : "")}` : "";
    const srcLeaf = { f: "src", t: "منين", val: src ? `${src}${s.found != null ? ` · ${AR_N(s.found)} ملف` : ""}` : "", miss: !s.src || !s.found };
    const L = {
      pull: [{ f: "type", t: "النوع", val: KIND_T[o.type] }, srcLeaf, { f: "count", t: "العدد", val: AR_N(o.count) }, { f: "order", t: "الترتيب", val: M.orders[o.order] },
        { f: "sec", t: "مدة الصورة", val: `${AR_N(o.sec)} ث` }],
      intro: [srcLeaf], outro: [srcLeaf],
      voice: [srcLeaf, { f: "fit", t: "الفيديو على قد التعليق", val: o.fit ? "أيوه" : "لأ" }, { f: "order", t: "أنهي تسجيل", val: M.orders[o.order] }],
      music: [srcLeaf, { f: "volume", t: "علو الموسيقى", val: `${AR_N(o.volume)}٪` }, { f: "duck", t: "توطى وقت الكلام", val: o.duck ? "أيوه" : "لأ" }, { f: "order", t: "أنهي موسيقى", val: M.orders[o.order] }],
      cut: [{ f: "max", t: "أقصى طول للقطة", val: `${AR_N(o.max)} ث` }, { f: "trans", t: "الانتقال", val: M.trans[o.trans] }],
      caption: [{ f: "on", t: "الكابشن", val: o.on ? "شغّال" : "مقفول" }],
      export: [{ f: "ratio", t: "المقاس", val: o.ratio }],
      publish: [{ f: "when", t: "إمتى", val: M.when[o.when] }, { f: "platforms", t: "على فين", val: (o.platforms || []).length ? `${AR_N(o.platforms.length)} حساب` : "", miss: o.when === "now" && !(o.platforms || []).length },
        { f: "caption", t: "الكابشن", val: (o.caption || "").slice(0, 40) || "اسم الموديل" }],
    }[s.verb] || [];
    return [...L.map((l) => ({ ...l, type: "opt" })), ...(M.fixed.includes(s.verb) ? [] : [{ f: "move", t: "رتّبها أو شيلها", type: "action" }])];
  }
  // خط واحد من الشمال لليمين: ابدأ ← الخطوات ← «＋» ← صدّر ← انشر، ونقط كل خطوة على قوس فوقها
  const GAPX = 210;
  function layout() {
    const w = S.el, r = S.rec;
    if (!w || !r) return;
    if (!w.clientWidth || !w.clientHeight) return;
    const steps = r.steps || [], fixed = S.meta.fixed, user = steps.filter((x) => !fixed.includes(x.verb)), tail = steps.filter((x) => fixed.includes(x.verb));
    const row = [{ id: "run", kind: "run" }, ...user.map((s) => ({ id: s.id, kind: "branch", s })), { id: "add", kind: "add" }, ...tail.map((s) => ({ id: s.id, kind: "branch", s }))];
    const x0 = -((row.length - 1) * GAPX) / 2, nodes = [];
    let k = 0;
    row.forEach((n, i) => {
      const x = x0 + i * GAPX, y = 0, prev = row[i - 1];
      if (n.kind !== "branch") { nodes.push({ ...n, x, y, from: prev?.id }); return; }
      const leaves = leavesOf(n.s), missing = leaves.some((l) => l.miss);
      nodes.push({ ...n, i: k++, x, y, from: prev?.id, missing, g: leaves.length });
      const m = leaves.length, R = 108, spread = Math.min(Math.PI * .8, Math.max(0, m - 1) * .34);
      leaves.forEach((l, j) => {
        const a = -Math.PI / 2 + (m === 1 ? 0 : -spread / 2 + (j / (m - 1)) * spread);
        nodes.push({ id: `${n.s.id}:${l.f}`, kind: "leaf", s: n.s, l, br: { k: n.s.id }, x: x + Math.cos(a) * R, y: y + Math.sin(a) * R, from: n.s.id, on: !l.miss });
      });
    });
    const old = Object.fromEntries((S.nodes || []).map((n) => [n.id, n]));
    S.nodes = nodes.map((n, i) => {
      const o = old[n.id];
      return { ...n, ph: i * 1.7, px: o ? o.px : n.x, py: o ? o.py : n.y, vx: o?.vx || 0, vy: o?.vy || 0 };
    });
    S.byId = Object.fromEntries(S.nodes.map((n) => [n.id, n]));
    fit();
    draw();
  }
  function fit(force) {
    const w = S.el, W = w.clientWidth, H = w.clientHeight;
    if (S.view?.user && !force) return applyView();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const n of S.nodes) {
      const m = n.kind === "leaf" ? 26 : n.kind === "center" ? 110 : 80;
      x0 = Math.min(x0, n.x - m); x1 = Math.max(x1, n.x + m); y0 = Math.min(y0, n.y - m); y1 = Math.max(y1, n.y + m + (n.kind === "branch" ? 30 : 0));
    }
    const top = topInset(), hh = H - top - 40;
    const s = Math.max(.35, Math.min(1.05, (W - 32) / (x1 - x0), hh / (y1 - y0)));
    S.view = { s, x: W / 2 - (x0 + x1) / 2 * s, y: top + hh / 2 - (y0 + y1) / 2 * s, user: false };
    applyView();
  }
  function topInset() {
    const r = S.el.getBoundingClientRect();
    let y = 8;
    for (const id of ["nhBar", "nhPTitle"]) {
      const e = document.getElementById(id);
      if (e && e.offsetHeight && S.el.closest("#nh")?.contains(S.el)) y = Math.max(y, e.getBoundingClientRect().bottom - r.top + 12);
    }
    S.headY = y;
    return y;
  }
  function applyView() {
    const v = S.view, world = S.el?.querySelector(".bm-world");
    if (!v || !world) return;
    world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`;
    S.topY = topInset();
    S.el.style.setProperty("--bm-top", `${S.headY}px`);
    S.el.style.setProperty("--bm-s", v.s);
    if (S.dv) S.dv.dirty = true;
  }
  function zoomAt(f, sx, sy) {
    const v = S.view;
    if (!v) return;
    const s = Math.max(.35, Math.min(2, v.s * f));
    v.x = sx - (sx - v.x) * (s / v.s); v.y = sy - (sy - v.y) * (s / v.s); v.s = s; v.user = true;
    applyView();
  }
  const toWorld = (sx, sy) => [(sx - S.view.x) / S.view.s, (sy - S.view.y) / S.view.s];
  const toScreen = (p) => p && [p[0] * S.view.s + S.view.x, p[1] * S.view.s + S.view.y];

  // ---------- الرسم (نفس كلاسات خريطة العقل) ----------
  function skeleton() {
    return `<canvas class="bm-dots" aria-hidden="true"></canvas>
      <div class="bm-world"><svg class="bm-lines" aria-hidden="true"></svg><div class="bm-nodes"></div></div>
      <div class="bm-zoom"><button data-zoom="1" aria-label="قرّب">+</button><button data-zoom="0" aria-label="الخريطة كلها">⤢</button><button data-zoom="-1" aria-label="بعّد">−</button></div>
      <div class="bm-card" hidden role="dialog"></div>
      <p class="bm-hint">الخطوات من الشمال لليمين · دوس على أي نقطة تغيّرها · النقط المفرّغة لسه ناقصة · «+» خطوة جديدة قبل «صدّر» · «▶» على الشمال يشغّل الموديل</p>`;
  }
  function nodeHTML(n) {
    const r = S.rec;
    if (n.kind === "run") {
      const last = (r.runs || [])[0];
      const st = r.busy ? esc(last?.step || "شغال…") : last?.status === "failed" ? "آخر تشغيل فشل" : last?.status === "done" ? "آخر فيديو جاهز ✓" : "دوس تشغّل";
      return `<button class="bm-n bm-quiz am-start${r.busy ? " busy" : ""}" data-n="run" title="شغّل الموديل، وغيّر اسمه أو بدّله"><i>▶</i><b>${esc(r.name)}</b><small>${st}</small></button>`;
    }
    if (n.kind === "add") return `<button class="bm-n bm-add" data-n="add" title="ضيف خطوة (فعل + منشن)"><i>+</i><b>خطوة جديدة</b></button>`;
    if (n.kind === "branch") {
      const v = S.meta.verbs[n.s.verb];
      return `<button class="bm-n bm-branch${S.open?.br === n.id ? " on" : ""}" data-n="${n.id}" title="${esc(v.desc)}">
        <span class="bm-bic">${svg(IC[n.s.verb])}${n.missing ? `<em class="num">!</em>` : ""}</span><b>${esc(v.t)}</b><small class="num">${AR_N(n.i + 1)}</small></button>`;
    }
    const l = n.l, cls = l.type === "action" ? "act" : n.on ? "full" : "empty";
    return `<button class="bm-n bm-leaf ${cls}${S.open?.id === n.id ? " on" : ""}" data-n="${esc(n.id)}" aria-label="${esc(l.t)}">
      <i>${l.type === "action" ? "⇅" : ""}</i><span class="bm-tip"><b>${esc(l.t)}</b>${l.val ? `<small>${esc(l.val)}</small>` : l.type === "action" ? "" : `<small class="miss">لسه ناقصة</small>`}</span></button>`;
  }
  function draw() {
    const w = S.el;
    w.querySelector(".bm-nodes").innerHTML = S.nodes.map(nodeHTML).join("");
    S.nodes.forEach((n) => { n.el = w.querySelector(`[data-n="${CSS.escape(n.id)}"]`); });
    w.querySelector(".bm-lines").innerHTML = S.nodes.filter((n) => n.from).map((n) => `<path data-l="${esc(n.id)}" class="${n.kind === "leaf" ? "leaf" : "branch am-flow"}${n.on === false ? " empty" : ""}"/>`).join("");
    S.nodes.forEach((n) => { n.line = n.from ? w.querySelector(`.bm-lines [data-l="${CSS.escape(n.id)}"]`) : null; });
    tick(performance.now());
  }
  const FOLLOW = { branch: .25, leaf: .9, add: .25, run: 0 };
  function step(dt) {
    const k = 140, c = 15;
    for (const n of S.nodes) {
      if (S.drag?.n === n && S.drag.moved) { n.vx = n.vy = 0; n.px = S.drag.x; n.py = S.drag.y; continue; }
      const p = n.from && S.byId[n.from], f = FOLLOW[n.kind] || 0;
      let tx = n.x + (p ? (p.px - p.x) * f : 0), ty = n.y + (p ? (p.py - p.y) * f : 0);
      if (S.mw && !S.drag && (n.kind === "leaf" || n.kind === "branch")) {
        const mx = S.mw[0] - n.x, my = S.mw[1] - n.y, md = Math.hypot(mx, my) || 1;
        if (S.hovNode === n) { const pull = Math.min(n.kind === "leaf" ? 16 : 12, md * .4); tx += mx / md * pull; ty += my / md * pull; }
        else if (md < 110) { const push = (1 - md / 110) * 14; tx -= mx / md * push; ty -= my / md * push; }
      }
      n.vx += (k * (tx - n.px) - c * n.vx) * dt;
      n.vy += (k * (ty - n.py) - c * n.vy) * dt;
      n.px += n.vx * dt; n.py += n.vy * dt;
    }
  }
  function tick(now) {
    const t = (now - S.t0) / 1000, still = reduce.matches;
    const dt = Math.min(.033, Math.max(0, (now - (S.last || now)) / 1000));
    S.last = now;
    if (still) S.nodes.forEach((n) => { if (!(S.drag?.n === n && S.drag.moved)) { n.px = n.x; n.py = n.y; } else { n.px = S.drag.x; n.py = S.drag.y; } });
    else for (let i = 0; i < 2; i++) step(dt / 2);
    const pos = {};
    for (const n of S.nodes) {
      const amp = S.drag?.n === n ? 0 : n.kind === "center" ? 2 : n.kind === "branch" ? 4 : 5;
      const x = n.px + (still ? 0 : Math.sin(t * .55 + n.ph) * amp), y = n.py + (still ? 0 : Math.cos(t * .48 + n.ph * 1.3) * amp);
      pos[n.id] = [x, y];
      if (n.el) {
        n.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        if (n.kind === "leaf") { const down = y * S.view.s + S.view.y < S.topY + 70; if (down !== n.down) { n.down = down; n.el.classList.toggle("tipdown", down); } }
      }
    }
    // الخط الأساسي: من كل خطوة للي بعدها (أفقي)، ونقط الخطوة طالعة لفوق من الدايرة
    for (const n of S.nodes) {
      if (!n.line) continue;
      const A = pos[n.from], B = pos[n.id];
      if (n.kind === "leaf") {
        const P0 = [A[0] + (B[0] - A[0]) * .3, A[1] - 34], P3 = [B[0], B[1] + 10];
        n.line.setAttribute("d", `M${P0[0].toFixed(1)} ${P0[1].toFixed(1)}C${P0[0].toFixed(1)} ${(P0[1] - 30).toFixed(1)} ${P3[0].toFixed(1)} ${(P3[1] + 30).toFixed(1)} ${P3[0].toFixed(1)} ${P3[1].toFixed(1)}`);
        continue;
      }
      const ra = S.byId[n.from]?.kind === "branch" ? 36 : 28, rb = n.kind === "branch" ? 36 : 28;
      const P0 = [A[0] + ra, A[1]], P3 = [B[0] - rb, B[1]], mx = (P0[0] + P3[0]) / 2;
      n.line.setAttribute("d", `M${P0[0].toFixed(1)} ${P0[1].toFixed(1)}C${mx.toFixed(1)} ${P0[1].toFixed(1)} ${mx.toFixed(1)} ${P3[1].toFixed(1)} ${P3[0].toFixed(1)} ${P3[1].toFixed(1)}`);
    }
    dots();
    if (S.open?.n) placeCard(toScreen([S.open.n.px, S.open.n.py]));
  }
  const GAP = 22, GLOW = 170;
  function dotsSize() {
    const w = S.el, cv = w?.querySelector(".bm-dots");
    if (!cv) return;
    const dpr = Math.min(2, devicePixelRatio || 1), W = w.clientWidth, H = w.clientHeight;
    const cs = getComputedStyle(w), ink = cs.getPropertyValue("--nh-ink").trim() || "#181718", acc = cs.getPropertyValue("--nh-accent").trim() || "#E5613E";
    const key = `${W}x${H}@${dpr}${ink}`;
    S.dv = S.dv || { mx: -999, my: -999, tx: -999, ty: -999, a: 0, ta: 0, dirty: true };
    S.dv.ink = ink; S.dv.acc = acc;
    if (S.dv.key === key) return;
    S.dv.key = key; S.dv.dirty = true;
    cv.width = W * dpr; cv.height = H * dpr;
    const base = S.dv.base = document.createElement("canvas");
    base.width = (W + GAP) * dpr; base.height = (H + GAP) * dpr;
    const g = base.getContext("2d");
    g.scale(dpr, dpr); g.fillStyle = ink; g.globalAlpha = .16;
    for (let y = GAP / 2; y <= H + GAP; y += GAP) for (let x = GAP / 2; x <= W + GAP; x += GAP) { g.beginPath(); g.arc(x, y, 1, 0, 6.2832); g.fill(); }
    S.dv.dpr = dpr; S.dv.W = W; S.dv.H = H;
  }
  function dots() {
    const v = S.dv, cv = S.el?.querySelector(".bm-dots");
    if (!v?.base || !cv) return;
    const e = reduce.matches ? 1 : .18;
    v.mx += (v.tx - v.mx) * e; v.my += (v.ty - v.my) * e; v.a += (v.ta - v.a) * (reduce.matches ? 1 : .12);
    const moving = Math.abs(v.tx - v.mx) > .3 || Math.abs(v.ty - v.my) > .3 || Math.abs(v.ta - v.a) > .004;
    if (!moving && !v.dirty) return;
    v.dirty = moving;
    const c = cv.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    const m = (a) => ((a % GAP) + GAP) % GAP;
    v.ox = m(S.view?.x || 0); v.oy = m(S.view?.y || 0);
    c.drawImage(v.base, (m(v.ox - GAP / 2) - GAP) * v.dpr, (m(v.oy - GAP / 2) - GAP) * v.dpr);
    if (v.a < .01) return;
    c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    c.fillStyle = v.acc;
    const x0 = v.ox + Math.ceil((Math.max(0, v.mx - GLOW) - v.ox) / GAP) * GAP, y0 = v.oy + Math.ceil((Math.max(0, v.my - GLOW) - v.oy) / GAP) * GAP;
    for (let y = y0; y <= Math.min(v.H, v.my + GLOW); y += GAP) for (let x = x0; x <= Math.min(v.W, v.mx + GLOW); x += GAP) {
      const d = Math.hypot(x - v.mx, y - v.my) / GLOW;
      if (d >= 1) continue;
      const f = (1 - d * d) ** 2 * v.a;
      c.globalAlpha = .16 + .7 * f;
      c.beginPath(); c.arc(x, y, 1 + 1.3 * f, 0, 6.2832); c.fill();
    }
    c.globalAlpha = 1;
  }
  function loop(now) {
    if (!S.el?.isConnected) { S.raf = 0; return; }
    tick(now);
    S.raf = requestAnimationFrame(loop);
  }

  // ---------- الكارت ----------
  const pills = (key, opts, cur) => `<div class="bm-pills">${opts.map(([v, t]) => `<button class="bm-pill${String(cur) === String(v) ? " on" : ""}" data-set="${esc(key)}" data-v="${esc(v)}">${esc(t)}</button>`).join("")}</div>`;
  function srcCard(s) {
    const v = S.meta.verbs[s.verb], L = S.lib;
    if (!L) { loadLib(); return `<p class="bm-note">بيجيب المكتبة…</p>`; }
    const want = s.verb === "pull" ? (s.opts.type === "any" ? ["image", "video"] : [s.opts.type]) : v.accept;
    const kids = (pid, depth = 0) => L.folders.filter((f) => (f.parent || null) === (pid || null)).map((f) =>
      `<button class="bm-pill${s.src?.mode === "folder" && s.src.id === f.id ? " on" : ""}" data-src="folder" data-id="${f.id}" data-label="${esc(f.path)}" style="margin-inline-start:${depth * 14}px">📁 ${esc(f.name)} <small class="num">${f.count}</small></button>${kids(f.id, depth + 1)}`).join("");
    const q = S.srcQ || "", files = L.files.filter((f) => want.includes(f.kind) && (!q || `${f.name} ${f.desc} ${(f.tags || []).join(" ")} ${f.path}`.includes(q))).slice(0, 30);
    return `<p class="bm-note">${esc(v.desc)}. اختار فولدر (هياخد من اللي جواه كمان)، أو ملف بعينه، أو اكتب كلمة يدوّر بيها بالمعنى.</p>
      <div class="bm-pills am-tree"><button class="bm-pill${s.src?.mode === "folder" && !s.src.id ? " on" : ""}" data-src="folder" data-id="" data-label="المكتبة كلها">📁 المكتبة كلها</button>${kids(null)}</div>
      <div class="bm-write" contenteditable="plaintext-only" data-k="srcq" data-ph="🔎 دوّر بالمعنى: قبل التبييض، ابتسامة، العيادة…">${esc(q)}</div>
      <div class="bm-acts"><button class="bm-go" data-src="search">استخدم البحث ده كمنشن</button></div>
      <div class="am-files">${files.map((f) => `<button class="am-file${s.src?.mode === "file" && s.src.id === f.id ? " on" : ""}" data-src="file" data-id="${f.id}" data-label="${esc([f.path, f.name].filter(Boolean).join("/"))}">
        ${f.thumb ? `<img src="${esc(f.thumb)}" alt="">` : `<span>${f.kind === "audio" ? "🎙️" : "🎬"}</span>`}<small>${esc(f.name)}</small></button>`).join("") || `<p class="bm-note">مفيش ${want.map((k) => S.lib.kinds[k]).join(" أو ")} هنا. ارفع في «📁 مكتبة العقل».</p>`}</div>`;
  }
  function cardHTML(n) {
    const r = S.rec, M = S.meta;
    if (n.kind === "add") {
      return `<div class="bm-ch"><span class="latin">ADD STEP</span><b>خطوة جديدة</b></div><p class="bm-note">اختار الفعل، والخطوة بتتحط آخر الخطوات (قبل «صدّر» و«انشر»). بعدها اختار المنشن من نقطة «منين».</p>
        <div class="am-verbs">${Object.entries(M.verbs).filter(([k]) => !M.fixed.includes(k)).map(([k, v]) => `<button class="am-verb" data-addverb="${k}">${svg(IC[k], 18)}<b>${esc(v.t)}</b><small>${esc(v.desc)}</small></button>`).join("")}</div>`;
    }
    if (n.kind === "run") {
      const runs = r.runs || [];
      return `<div class="bm-ch"><span class="latin">START</span><b>ابدأ</b></div>
        ${editable("@name", r.name, "اسم الموديل")}
        <p class="bm-note">بيمشي على الخطوات من الشمال لليمين: بيعمل الفيديو، ويصدّره، وينشره (أو يستناك توافق).${r.est ? ` التكلفة حوالي <b class="num">${AR_N(r.est)}</b> نقطة (كتابة الكلام للكابشن).` : " من غير تكلفة نقط."}</p>
        <div class="bm-acts"><button class="bm-go" data-run ${r.busy ? "disabled" : ""}>${r.busy ? "⏳ شغال…" : "▶ شغّل الموديل"}</button></div>
        <div class="bm-pills">${S.list.map((x) => `<button class="bm-pill${x.id === S.id ? " on" : ""}" data-pick="${x.id}">${esc(x.name)}</button>`).join("")}
          <button class="bm-pill" data-new>＋ موديل جديد</button><button class="bm-pill" data-delrec>🗑 امسح ده</button></div>
        ${runs.map((x) => `<div class="am-run ${x.status}"><b>${x.status === "done" ? "✓" : x.status === "failed" ? "⚠️" : "⏳"} ${esc(new Date(x.at).toLocaleString("ar-EG-u-nu-latn", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</b>
          ${x.step ? `<small>${esc(x.step)}</small>` : ""}${(x.report || []).map((t) => `<small>${esc(t)}</small>`).join("")}${x.error ? `<small class="bad">${esc(x.error)}</small>` : ""}
          <span class="bm-acts">${x.export_url ? `<a class="bm-pill" href="${esc(x.export_url)}" target="_blank" rel="noopener">⬇ الفيديو</a>` : ""}${x.project_id ? `<button class="bm-pill" data-openpj="${x.project_id}">🎞️ افتح في المونتاج</button>` : ""}</span></div>`).join("")}`;
    }
    if (n.kind === "branch") {
      const v = M.verbs[n.s.verb];
      return `<div class="bm-ch"><span class="latin">STEP ${n.i + 1}</span><b>${esc(v.t)}</b></div><p class="bm-note">${esc(v.desc)}. دوس على أي نقطة فوقها تغيّرها.</p>${M.fixed.includes(n.s.verb) ? `<p class="bm-note">دي من آخر خطوتين ثابتين (صدّر ثم انشر).</p>` : moveActs(n.s)}`;
    }
    const s = n.s, l = n.l, o = s.opts;
    const head = `<div class="bm-ch"><span class="latin">${esc(M.verbs[s.verb].t)}</span><b>${esc(l.t)}</b></div>`;
    if (l.f === "move") return head + moveActs(s);
    if (l.f === "src") return head + srcCard(s);
    if (l.f === "type") return head + pills("type", [["image", "صور"], ["video", "فيديوهات"], ["any", "الاتنين"]], o.type);
    if (l.f === "order") return head + pills("order", Object.entries(M.orders), o.order) + `<p class="bm-note">«اللي متستخدمش» بياخد الملفات اللي لسه ماطلعتش في فيديو قبل كده، ولما الفولدر يخلص بيبدأ من الأول.</p>`;
    if (l.f === "trans") return head + pills("trans", Object.entries(M.trans), o.trans);
    if (l.f === "ratio") return head + pills("ratio", M.ratios.map((x) => [x, x]), o.ratio);
    if (l.f === "when") return head + pills("when", Object.entries(M.when), o.when) + `<p class="bm-note">«يستنى موافقتي»: الفيديو بيتصدّر ويستناك في صفحة النشر. «ينزل على طول»: بينزل على الحسابات اللي هتختارها.</p>`;
    if (l.f === "platforms") return head + platCard(o);
    if (l.f === "caption") return head + editable("pubcap", o.caption || "", "الكابشن اللي هينزل مع الفيديو (لو فاضي: اسم الموديل)") + `<p class="bm-note">بيتحفظ لوحده لما تقف عن الكتابة.</p>`;
    if (["fit", "duck", "on"].includes(l.f)) return head + pills(l.f, [[true, "أيوه"], [false, "لأ"]], o[l.f]);
    const NUM = { count: [[1, "١"], [2, "٢"], [3, "٣"], [4, "٤"], [6, "٦"], [8, "٨"], [12, "١٢"]], sec: [[1.5, "١.٥ ث"], [2, "٢ ث"], [2.5, "٢.٥ ث"], [3, "٣ ث"], [4, "٤ ث"], [6, "٦ ث"]],
      max: [[1.5, "١.٥ ث"], [2, "٢ ث"], [3, "٣ ث"], [4, "٤ ث"], [6, "٦ ث"], [10, "١٠ ث"]], volume: [[15, "١٥٪"], [25, "٢٥٪"], [35, "٣٥٪"], [50, "٥٠٪"], [70, "٧٠٪"], [100, "١٠٠٪"]] };
    return head + pills(l.f, NUM[l.f] || [], o[l.f]);
  }
  const editable = (k, val, ph) => `<div class="bm-write" contenteditable="plaintext-only" data-k="${k}" data-ph="${esc(ph || "اكتب هنا…")}">${esc(val)}</div>`;
  // حسابات النشر المربوطة (من صفحة النشر): كل حساب زرار يتعلّم
  function platCard(o) {
    if (!S.pub) { if (!S.pubLoading) { S.pubLoading = true; api("/api/publisher").then((x) => { S.pub = x; refreshCard(); }).catch((err) => toast(err.message, true)).finally(() => (S.pubLoading = false)); } return `<p class="bm-note">بيجيب حساباتك…</p>`; }
    const list = S.pub.account_list || [], on = new Set(o.platforms || []);
    if (!list.length) return `<p class="bm-note">مفيش حسابات مربوطة. اربطها من صفحة النشر، وبعدين ارجع هنا.</p>`;
    return `<div class="bm-pills">${list.map((a) => { const key = `${a.platform}@${a.id}`; return `<button class="bm-pill${on.has(key) || on.has(a.platform) ? " on" : ""}" data-plat="${esc(key)}">${esc(S.pub.platforms[a.platform] || a.platform)} · ${esc(a.name || "")}</button>`; }).join("")}</div>`;
  }
  // الترتيب جوه خطوات العميل بس (صدّر وانشر ثابتين في الآخر)
  const moveActs = (s) => { const user = S.rec.steps.filter((x) => !S.meta.fixed.includes(x.verb)), i = user.findIndex((x) => x.id === s.id), n = user.length;
    return `<div class="bm-acts"><button class="bm-pill" data-mv="-1" ${i <= 0 ? "disabled" : ""}>← خليها قبل</button><button class="bm-pill" data-mv="1" ${i >= n - 1 ? "disabled" : ""}>خليها بعد →</button>
      <button class="bm-pill" data-rmstep>🗑 شيل الخطوة</button></div>`; };
  function openCard(n) {
    const card = S.el.querySelector(".bm-card");
    if (!n) { S.open = null; card.hidden = true; S.el.classList.remove("has-card"); markOpen(); return; }
    if (S.open?.id !== n.id) { S.cardSide = null; S.cardAt = null; S.srcQ = ""; }
    S.open = { id: n.id, br: n.kind === "leaf" ? n.s.id : n.kind === "branch" ? n.id : null, n };
    card.innerHTML = `<button class="bm-x" data-close aria-label="اقفل">✕</button>${cardHTML(n)}`;
    card.hidden = false;
    S.el.classList.add("has-card");
    markOpen();
    placeCard(toScreen([n.px, n.py]));
  }
  function markOpen() { S.el.querySelectorAll(".bm-n.on").forEach((x) => x.classList.remove("on")); if (S.open?.n?.el) S.open.n.el.classList.add("on"); }
  function placeCard(p) {
    const card = S.el.querySelector(".bm-card");
    if (!p || card.hidden) return;
    const W = S.el.clientWidth, H = S.el.clientHeight, cw = card.offsetWidth, ch = card.offsetHeight;
    if (S.cardSide == null) {
      let r = p[0] >= W / 2;
      if (r && p[0] + 34 + cw > W - 8) r = false;
      if (!r && p[0] - 34 - cw < 8) r = true;
      S.cardSide = r;
    }
    let x = S.cardSide ? p[0] + 34 : p[0] - 34 - cw;
    x = Math.max(8, Math.min(W - cw - 8, x));
    const y = Math.max(topInset(), Math.min(H - ch - 8, p[1] - ch / 2));
    const k = `${Math.round(x)},${Math.round(y)}`;
    if (S.cardAt === k) return;
    S.cardAt = k;
    card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  const refreshCard = () => { if (S.open) { const n = S.nodes.find((x) => x.id === S.open.id) || null; openCard(n || null); } };

  // ---------- الحفظ ----------
  async function setRec(r, { card = true } = {}) {
    S.rec = r;
    layout();
    if (S.open) { const n = S.nodes.find((x) => x.id === S.open.id); if (n) { S.open.n = n; if (card) refreshCard(); else markOpen(); } else openCard(null); }
    if (r.busy) watch();
  }
  const saveSteps = (steps, opts) => aAPI("", { method: "PATCH", ...jsonBody({ steps }) }).then((r) => setRec(r, opts)).catch((err) => toast(err.message, true));
  const stepOf = (id) => S.rec.steps.find((x) => x.id === id);
  function watch() {
    clearTimeout(S.timer);
    S.timer = setTimeout(async () => {
      if (!S.el?.isConnected) return;
      try { const r = await aAPI(); await setRec(r, { card: S.open?.id === "run" }); if (!r.busy) toast("✓ الموديل خلّص. التفاصيل في «ابدأ»"); } catch { /* السيرفر بيعيد التشغيل */ }
    }, 2500);
  }
  async function loadLib() { if (S.libLoading) return; S.libLoading = true; try { S.lib = await api("/api/library"); refreshCard(); } catch (err) { toast(err.message, true); } S.libLoading = false; }

  function bind(w) {
    w.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const el = e.target.closest(".bm-n"), r = w.getBoundingClientRect();
      if (!el) { if (!S.view || e.target.closest(".bm-card, .bm-zoom")) return; S.pan = { sx: e.clientX, sy: e.clientY, x: S.view.x, y: S.view.y, id: e.pointerId, moved: false }; return; }
      const n = S.byId[el.dataset.n];
      if (!n) return;
      const [wx, wy] = toWorld(e.clientX - r.left, e.clientY - r.top);
      S.drag = { n, el, sx: e.clientX, sy: e.clientY, ox: n.px - wx, oy: n.py - wy, x: n.px, y: n.py, moved: false, id: e.pointerId };
    });
    w.addEventListener("wheel", (e) => {
      if (e.target.closest(".bm-card")) return;
      e.preventDefault();
      const r = w.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0015)), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    w.querySelector(".bm-zoom").addEventListener("click", (e) => {
      const z = e.target.closest("[data-zoom]");
      if (!z) return;
      e.stopPropagation();
      if (z.dataset.zoom === "0") return fit(true);
      zoomAt(z.dataset.zoom === "1" ? 1.25 : .8, w.clientWidth / 2, w.clientHeight / 2);
    });
    const HOT_R = { leaf: 20, branch: 46 };
    const setHot = (n) => { if (S.hovNode === n) return; S.hovNode?.el?.classList.remove("hot"); S.hovNode = n; n?.el?.classList.add("hot"); S.el.classList.toggle("hotting", !!n); };
    w.addEventListener("pointermove", (e) => {
      const r = w.getBoundingClientRect();
      if (S.view && e.pointerType !== "touch") {
        S.mw = toWorld(e.clientX - r.left, e.clientY - r.top);
        if (!S.pan?.moved && !S.drag?.moved) {
          if (e.target.closest?.(".bm-card, .bm-zoom")) setHot(null);
          else { const dd = (n) => Math.hypot(S.mw[0] - n.px, S.mw[1] - n.py); if (!(S.hovNode && dd(S.hovNode) < HOT_R[S.hovNode.kind] * 1.9)) { let best = null, bd = 1e9; for (const n of S.nodes) { if (!HOT_R[n.kind]) continue; const k = dd(n); if (k < HOT_R[n.kind] && k < bd) { best = n; bd = k; } } setHot(best); } }
        }
      }
      if (S.dv && e.pointerType !== "touch") { S.dv.tx = e.clientX - r.left; S.dv.ty = e.clientY - r.top; if (S.dv.a < .01) { S.dv.mx = S.dv.tx; S.dv.my = S.dv.ty; } S.dv.ta = 1; }
      const pn = S.pan;
      if (pn && e.pointerId === pn.id) {
        if (!pn.moved && Math.hypot(e.clientX - pn.sx, e.clientY - pn.sy) < 4) return;
        if (!pn.moved) { pn.moved = true; w.setPointerCapture(e.pointerId); w.classList.add("panning"); }
        S.view.x = pn.x + e.clientX - pn.sx; S.view.y = pn.y + e.clientY - pn.sy; S.view.user = true;
        return applyView();
      }
      const d = S.drag;
      if (!d || e.pointerId !== d.id) return;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
      if (!d.moved) { d.moved = true; w.setPointerCapture(e.pointerId); w.classList.add("dragging"); d.el.classList.add("held"); }
      const [wx, wy] = toWorld(e.clientX - r.left, e.clientY - r.top);
      d.x = wx + d.ox; d.y = wy + d.oy;
    });
    const drop = (e) => {
      if (S.pan && (e.pointerId == null || e.pointerId === S.pan.id)) { if (S.pan.moved) { S.noClick = true; setTimeout(() => (S.noClick = false), 0); w.classList.remove("panning"); } S.pan = null; }
      const d = S.drag;
      if (!d || (e.pointerId != null && e.pointerId !== d.id)) return;
      S.drag = null;
      if (d.moved) { S.noClick = true; setTimeout(() => (S.noClick = false), 0); w.classList.remove("dragging"); d.el.classList.remove("held"); }
    };
    w.addEventListener("pointerleave", () => { if (S.dv) S.dv.ta = 0; S.mw = null; setHot(null); });
    w.addEventListener("pointerup", drop);
    w.addEventListener("pointercancel", drop);
    w.addEventListener("click", async (e) => {
      const t = e.target;
      if (S.noClick) { S.noClick = false; return; }
      const node = t.closest(".bm-n") || (S.hovNode && !t.closest(".bm-card, .bm-zoom") ? S.hovNode.el : null);
      if (node) {
        const n = S.nodes.find((x) => x.id === node.dataset.n);
        if (!n) return;
        if (S.open?.id === n.id) return openCard(null);
        return openCard(n);
      }
      if (t.closest("[data-close]")) return openCard(null);
      try {
        let b;
        const cur = S.open?.n, s = cur?.s;
        if ((b = t.closest("[data-pick]"))) { S.id = b.dataset.pick; storageSet("studiomania.auto", S.id); S.view = null; return setRec(await aAPI()); }
        if (t.closest("[data-new]")) {
          const name = prompt("اسم الموديل الجديد (مثلًا: قبل وبعد التبييض):"); if (name == null) return;
          const r = await api("/api/automations", { method: "POST", ...jsonBody({ name }) });
          S.list = await api("/api/automations"); S.id = r.id; storageSet("studiomania.auto", S.id); S.view = null; return setRec(r);
        }
        if (t.closest("[data-delrec]")) {
          if (!confirm(`تمسح موديل «${S.rec.name}»؟`)) return;
          await aAPI("", { method: "DELETE" }); S.list = await api("/api/automations"); openCard(null); return start();
        }
        if ((b = t.closest("[data-addverb]"))) {
          const steps = [...S.rec.steps], at = steps.findIndex((x) => x.verb === "export");
          const ns = { id: Math.random().toString(36).slice(2, 10), verb: b.dataset.addverb, src: null, opts: { ...S.meta.verbs[b.dataset.addverb].opts } };
          steps.splice(at < 0 || ns.verb === "export" ? steps.length : at, 0, ns);
          openCard(null); await saveSteps(steps); const nn = S.byId[ns.id]; if (nn) openCard(nn); return;
        }
        if (t.closest("[data-run]")) { const r = await aAPI("/run", { method: "POST" }); return setRec(r); }
        if ((b = t.closest("[data-openpj]"))) { storageSet(projectKey("free"), b.dataset.openpj); return showStep("6f"); }
        if (!s) return;
        if ((b = t.closest("[data-plat]"))) {
          const cur = new Set(s.opts.platforms || []), k = b.dataset.plat, plat = k.split("@")[0];
          if (cur.has(k) || cur.has(plat)) { cur.delete(k); cur.delete(plat); } else cur.add(k);
          return saveSteps(S.rec.steps.map((x) => (x.id === s.id ? { ...x, opts: { ...x.opts, platforms: [...cur] } } : x)));
        }
        if ((b = t.closest("[data-mv]"))) {
          const steps = [...S.rec.steps], i = steps.findIndex((x) => x.id === s.id), j = i + Number(b.dataset.mv);
          if (j < 0 || j >= steps.length || S.meta.fixed.includes(steps[j].verb)) return;
          [steps[i], steps[j]] = [steps[j], steps[i]];
          return saveSteps(steps);
        }
        if (t.closest("[data-rmstep]")) { if (!confirm("تشيل الخطوة دي؟")) return; openCard(null); return saveSteps(S.rec.steps.filter((x) => x.id !== s.id)); }
        if ((b = t.closest("[data-set]"))) {
          const k = b.dataset.set, raw = b.dataset.v, val = raw === "true" ? true : raw === "false" ? false : isNaN(Number(raw)) || raw === "" ? raw : Number(raw);
          return saveSteps(S.rec.steps.map((x) => (x.id === s.id ? { ...x, opts: { ...x.opts, [k]: val }, ...(k === "type" ? { src: x.src } : {}) } : x)));
        }
        if ((b = t.closest("[data-src]"))) {
          const mode = b.dataset.src;
          const src = mode === "search" ? (S.srcQ?.trim() ? { mode, q: S.srcQ.trim() } : null) : { mode, id: b.dataset.id || null, label: b.dataset.label };
          if (!src) return toast("اكتب الكلمة اللي هيدوّر بيها الأول", true);
          return saveSteps(S.rec.steps.map((x) => (x.id === s.id ? { ...x, src } : x)));
        }
      } catch (err) { toast(err.message, true); }
    });
    // الكتابة: اسم الموديل بيتحفظ لما تقف، وكلمة البحث بتفلتر الملفات
    let typeT = 0;
    w.addEventListener("input", (e) => {
      const el = e.target.closest?.(".bm-write");
      if (!el) return;
      clearTimeout(typeT);
      if (el.dataset.k === "srcq") { S.srcQ = el.innerText.trim(); typeT = setTimeout(() => { const keep = S.srcQ; refreshCard(); const ed = S.el.querySelector('[data-k="srcq"]'); if (ed) { ed.focus(); const rg = document.createRange(); rg.selectNodeContents(ed); rg.collapse(false); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(rg); } S.srcQ = keep; }, 450); return; }
      if (el.dataset.k === "pubcap") { const sid = S.open?.n?.s?.id; typeT = setTimeout(() => { const v = el.innerText.trim(); saveSteps(S.rec.steps.map((x) => (x.id === sid ? { ...x, opts: { ...x.opts, caption: v } } : x)), { card: false }); }, 800); return; }
      if (el.dataset.k === "@name") typeT = setTimeout(async () => { const v = el.innerText.trim(); if (v && v !== S.rec.name) { const r = await aAPI("", { method: "PATCH", ...jsonBody({ name: v }) }); S.list = await api("/api/automations"); setRec(r, { card: false }); } }, 700);
    });
  }
  async function start() {
    S.list = await api("/api/automations");
    if (!S.list.length) { const r = await api("/api/automations", { method: "POST", ...jsonBody({ name: "قبل وبعد" }) }); S.list = [r]; }
    const last = storageGet("studiomania.auto");
    S.id = S.list.some((x) => x.id === last) ? last : S.list[0].id;
    S.view = null;
    await setRec(await aAPI());
  }
  function html() { return `<div class="bm am" id="amWrap"><div class="nh-empty">بيحمّل…</div></div>`; }
  async function mount(root) {
    const w = root.querySelector("#amWrap");
    if (!w) return;
    S.el = w; S.open = null; S.lib = null; S.nodes = [];
    w.innerHTML = skeleton();
    S.dv = null; S.view = null;
    bind(w);
    dotsSize();
    try { S.meta = S.meta || await api("/api/automations-meta"); await start(); } catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; return; }
    if (!S.raf) S.raf = requestAnimationFrame(loop);
    if (!reduce.matches) S.nodes.forEach((n, i) => n.el?.animate([{ opacity: 0, translate: `${-n.x}px ${-n.y}px`, scale: .3 }, { opacity: 1, translate: "0 0", scale: 1 }],
      { duration: 700, delay: n.kind === "center" ? 0 : n.kind === "branch" ? 120 + n.i * 40 : 260 + (i % 9) * 25, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }));
  }
  return { html, mount, close: () => clearTimeout(S.timer) };
})();
