// StudioMania — 🖼️ طبقات فوق الفيديو (صورة جوه صورة) زي كاب كات: فيديو أو صورة بمكانها وحجمها ولفّها،
// وشفافية ووضع دمج وشكل (دايرة، قلب…) وشيل الشاشة الخضرا وحركة دخول وخروج.
// التصدير في backend/montage.py (overlay_filters) بنفس المعادلات.

const OV_LANE_H = 30;
const OV_BLENDS = [["normal", "عادي"], ["screen", "تفتيح (Screen)"], ["lighten", "الأفتح"], ["addition", "إضافة"],
  ["multiply", "تغميق (Multiply)"], ["darken", "الأغمق"], ["overlay", "Overlay"], ["softlight", "Soft light"]];
const OV_MASKS = [["", "بدون"], ["circle", "دايرة"], ["rounded", "حواف مدوّرة"], ["heart", "قلب"], ["diamond", "معيّن"]];
const OV_ANIMS = [["", "بدون"], ["fade", "ظهور"], ["pop", "بوب"], ["zoom", "زووم"], ["slideup", "من تحت"], ["slidedown", "من فوق"],
  ["slideleft", "من اليمين"], ["slideright", "من الشمال"]];

const overlays = () => mt.project?.data.overlays || (mt.project ? (mt.project.data.overlays = []) : []);
const selOver = () => (mt.sel?.kind === "over" ? overlays()[mt.sel.i] : null);
const ovImages = new Map();  // src ← {url, w, h, name}
function ovSource(o) {
  if (o.src?.startsWith("img:")) return ovImages.get(o.src) || { url: `/media/overlay/${o.src.slice(4)}`, w: o.src_w || 1, h: o.src_h || 1, name: o.name || "صورة", image: true };
  const s = mt.sources.find((x) => x.id === o.src);
  return s ? { url: s.url, w: o.src_w || s.width || 720, h: o.src_h || s.height || 1280, name: s.label, duration: s.duration, has_audio: s.has_audio } : null;
}

// شكل القلب: نفس المعادلة اللي في FFmpeg (MASKS.heart)، بنحسب حدوده مرة واحدة كـ polygon
const HEART_POLY = (() => {
  const f = (u, v) => { const x = u * 1.15, y = -v * 1.15 + 0.25; return (x * x + y * y - 1) ** 3 - x * x * y ** 3; };
  const pts = [];
  for (let k = 0; k < 96; k++) {
    const a = (k / 96) * Math.PI * 2, cx = Math.cos(a), cy = Math.sin(a);
    let lo = 0, hi = 1.5;
    for (let n = 0; n < 30; n++) { const m = (lo + hi) / 2; if (f(cx * m, cy * m) <= 0) lo = m; else hi = m; }
    pts.push(`${(50 + cx * lo * 50).toFixed(2)}% ${(50 + cy * lo * 50).toFixed(2)}%`);
  }
  return `polygon(${pts.join(",")})`;
})();
function ovClip(o, w, h) {
  if (o.mask === "circle") return "ellipse(50% 50% at 50% 50%)";
  if (o.mask === "rounded") return `inset(0 round ${(Math.min(w, h) * 0.12).toFixed(1)}px)`;
  if (o.mask === "diamond") return "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)";
  if (o.mask === "heart") return HEART_POLY;
  return "";
}
// الحركة: نفس overlay_anim_exprs (خطي)
function ovAnim(o, t) {
  let z = 1, dx = 0, dy = 0, alpha = 1;
  for (const [kind, a] of [["in", o.anim_in], ["out", o.anim_out]]) {
    if (!a?.type || !(a.dur > 0.01)) continue;
    const d = Math.min(a.dur, o.dur / 2);
    const p = clamp(kind === "in" ? (t - o.t0) / d : (o.t0 + o.dur - t) / d, 0, 1), q = 1 - p, sign = kind === "in" ? 1 : -1;
    if (a.type === "zoom") z *= 0.6 + 0.4 * p;
    else if (a.type === "pop") z *= Math.max(0.02, p < 0.7 ? (p / 0.7) * 1.12 : 1.12 - (0.12 * (p - 0.7)) / 0.3);
    else if (a.type === "slideup") dy += sign * 0.12 * OUT_H * q;
    else if (a.type === "slidedown") dy += -sign * 0.12 * OUT_H * q;
    else if (a.type === "slideleft") dx += sign * 0.15 * OUT_W * q;
    else if (a.type === "slideright") dx += -sign * 0.15 * OUT_W * q;
    const fd = a.type === "pop" ? d * 0.3 : d;
    const fa = clamp(kind === "in" ? (t - o.t0) / fd : (o.t0 + o.dur - t) / fd, 0, 1);
    alpha = Math.min(alpha, fa);
  }
  return { z, dx, dy, alpha };
}

// ---------- الطبقة فوق المعاينة ----------
const ovEls = new Map();  // مفتاح الطبقة ← عنصر الفيديو/الصورة
function overLayer() {
  let el = $("pvOver");
  if (!el) {
    el = document.createElement("div");
    el.id = "pvOver";
    el.className = "pv-over";
    $("pvStage").after(el);
    el.addEventListener("pointerdown", overPointerDown);
    el.addEventListener("wheel", overWheel, { passive: false });
  }
  return el;
}
function ovMedia(o, key) {
  const src = ovSource(o);
  if (!src) return null;
  let m = ovEls.get(key);
  if (!m || m.dataset.url !== src.url) {
    m?.remove();
    if (src.image) { m = new Image(); m.src = src.url; }
    else { m = document.createElement("video"); m.src = src.url; m.playsInline = true; m.preload = "auto"; m.muted = true; }
    m.dataset.url = src.url;
    m.className = "ov-media";
    m.draggable = false;
    ovEls.set(key, m);
  }
  return m;
}
function drawOverlayLayer() {
  if (!mt.project) return;
  const el = overLayer(), fs = PV_W / OUT_W, list = overlays(), t = mt.t;
  const hidden = trackFlag("over", "hide"), muted = trackFlag("over", "mute");
  const live = new Set();
  list.forEach((o, i) => {
    const key = o.id || (o.id = Math.random().toString(36).slice(2, 10));
    const on = !hidden && !o.disabled && t >= o.t0 && t < o.t0 + o.dur;
    let box = el.querySelector(`[data-ov="${key}"]`);
    const m = ovMedia(o, key);
    if (!on || !m) { if (box) box.hidden = true; if (m?.tagName === "VIDEO" && !m.paused) m.pause(); return; }
    live.add(key);
    if (!box) {
      box = document.createElement("div");
      box.className = "pv-ov";
      box.dataset.ov = key;
      box.innerHTML = `<canvas class="ov-key" hidden></canvas><b class="ov-rot" data-ovh="rot"></b><i class="ov-sz" data-ovh="sz"></i>`;
      box.prepend(m);
      el.append(box);
    } else if (box.firstChild !== m) box.prepend(m);
    box.hidden = false;
    box.dataset.i = i;
    const src = ovSource(o), a = ovAnim(o, t);
    if (m.tagName === "VIDEO" && m.videoWidth) { src.w = m.videoWidth; src.h = m.videoHeight; o.src_w = m.videoWidth; o.src_h = m.videoHeight; }
    const w = (o.w ?? 0.5) * OUT_W * fs, h = (w * (src.h || 1)) / (src.w || 1);
    Object.assign(box.style, {
      width: `${w}px`, height: `${h}px`, left: `${((o.x ?? 0.5) * OUT_W + a.dx) * fs}px`, top: `${((o.y ?? 0.5) * OUT_H + a.dy) * fs}px`,
      transform: `translate(-50%,-50%) rotate(${o.angle || 0}deg) scale(${a.z.toFixed(4)})`,
      opacity: ((o.opacity ?? 1) * a.alpha).toFixed(3), mixBlendMode: o.blend && o.blend !== "normal" ? ({ addition: "plus-lighter", softlight: "soft-light" }[o.blend] || o.blend) : "",
    });
    const clipCss = ovClip(o, w, h);
    m.style.clipPath = clipCss;
    m.style.transform = o.flip_h ? "scaleX(-1)" : "";
    box.classList.toggle("sel", mt.sel?.kind === "over" && mt.sel.i === i && !mt.playing);
    // الفيديو: وقته جوه الملف = البداية + (الوقت من أول الطبقة × السرعة)
    if (m.tagName === "VIDEO") {
      const want = (o.start || 0) + (t - o.t0) * (o.speed || 1);
      m.playbackRate = o.speed || 1;
      m.muted = muted || !(o.volume > 0) || !mt.playing;
      m.volume = clamp(o.volume ?? 1, 0, 1);
      if (mt.playing) { if (m.paused) { m.currentTime = want; m.play().catch(() => {}); } else if (Math.abs(m.currentTime - want) > 0.25) m.currentTime = want; }
      else { if (!m.paused) m.pause(); if (Math.abs(m.currentTime - want) > 0.03) m.currentTime = want; }
    }
    // شيل الشاشة الخضرا: بنرسم الفريم على كانفاس ونخلي اللون ده شفاف (زي colorkey في FFmpeg)
    const cv = box.querySelector(".ov-key");
    const keyOn = !!o.chroma?.on;
    cv.hidden = !keyOn;
    m.style.visibility = keyOn ? "hidden" : "";
    if (keyOn) chromaDraw(cv, m, o, Math.round(w), Math.round(h), clipCss);
  });
  for (const [key, m] of ovEls) if (!live.has(key) && m.tagName === "VIDEO" && !m.paused) m.pause();
  for (const b of el.querySelectorAll(".pv-ov")) if (!list.some((o) => o.id === b.dataset.ov)) b.remove();
}
function chromaDraw(cv, m, o, w, h, clipCss) {
  const ready = m.tagName === "VIDEO" ? m.readyState >= 2 : m.complete;
  if (!ready || w < 2 || h < 2) return;
  const sw = Math.min(w, 360), sh = Math.round((h * sw) / w);
  if (cv.width !== sw || cv.height !== sh) { cv.width = sw; cv.height = sh; }
  cv.style.clipPath = clipCss;
  cv.style.transform = o.flip_h ? "scaleX(-1)" : "";
  const g = cv.getContext("2d", { willReadFrequently: true });
  try { g.drawImage(m, 0, 0, sw, sh); } catch { return; }
  const img = g.getImageData(0, 0, sw, sh), d = img.data;
  const hex = o.chroma.color || "#00ff00";
  const kr = parseInt(hex.slice(1, 3), 16), kg = parseInt(hex.slice(3, 5), 16), kb = parseInt(hex.slice(5, 7), 16);
  const sim = clamp(o.chroma.sim ?? 0.3, 0.01, 1), bl = clamp(o.chroma.blend ?? 0.1, 0, 1);
  const maxd = Math.sqrt(3) * 255;
  for (let n = 0; n < d.length; n += 4) {
    const diff = Math.sqrt((d[n] - kr) ** 2 + (d[n + 1] - kg) ** 2 + (d[n + 2] - kb) ** 2) / maxd;
    if (diff < sim) d[n + 3] = 0;
    else if (bl > 0 && diff < sim + bl) d[n + 3] = Math.round(((diff - sim) / bl) * 255);
  }
  g.putImageData(img, 0, 0);
}
function overPointerDown(e) {
  const box = e.target.closest(".pv-ov");
  if (!box || e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  if (kindLocked("over")) return toast("تراك الطبقات مقفول 🔒", true);
  pause();
  const i = Number(box.dataset.i), o = overlays()[i];
  selectItem({ kind: "over", i });
  pushHistory();
  const fr = $("previewFrame").getBoundingClientRect(), r = (fr.width / PV_W) * (PV_W / OUT_W);
  const cx = fr.left + o.x * OUT_W * r, cy = fr.top + o.y * OUT_H * r;
  const h = e.target.closest("[data-ovh]")?.dataset.ovh;
  const x0 = o.x, y0 = o.y, a0 = o.angle || 0, w0 = o.w;
  const ang0 = Math.atan2(e.clientY - cy, e.clientX - cx), d0 = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
  drag(e, (dx, dy, ev) => {
    if (h === "rot") {
      let a = a0 + ((Math.atan2(ev.clientY - cy, ev.clientX - cx) - ang0) * 180) / Math.PI;
      a = ((a + 540) % 360) - 180;
      if (ev.shiftKey) a = Math.round(a / 15) * 15;
      o.angle = Math.round(a * 10) / 10;
    } else if (h === "sz") o.w = clamp(Math.round(w0 * (Math.hypot(ev.clientX - cx, ev.clientY - cy) / d0) * 1000) / 1000, 0.03, 3);
    else {
      let nx = x0 + dx / r / OUT_W, ny = y0 + dy / r / OUT_H;
      if (Math.abs(nx - 0.5) < 0.012) nx = 0.5;
      if (Math.abs(ny - 0.5) < 0.012) ny = 0.5;
      o.x = clamp(nx, -1, 2); o.y = clamp(ny, -1, 2);
    }
    drawOverlayLayer();
    renderOverPane();
  }, () => scheduleSave());
}
function overWheel(e) {
  const box = e.target.closest(".pv-ov");
  if (!box) return;
  e.preventDefault();
  const o = overlays()[Number(box.dataset.i)];
  pushHistory("ov-size");
  o.w = clamp(o.w * (e.deltaY < 0 ? 1.05 : 1 / 1.05), 0.03, 3);
  drawOverlayLayer();
  renderOverPane();
  scheduleSave();
}

// ---------- تراك الطبقات ----------
function renderOverRow() {
  const row = $("trkOver"), head = $("hOver");
  if (!row || !mt.project) return;
  const list = overlays();
  const lanes = Math.max(1, ...list.map((o) => (o.lane | 0) + 1)) + (list.length ? 1 : 0);
  const h = Math.min(6, lanes) * OV_LANE_H + 4;
  row.style.height = head.style.height = `${h}px`;
  if (!list.length) { row.innerHTML = `<div class="tl-empty-track">طبقات فوق الفيديو: دوس ⧉ على فيديو في المكتبة أو ارفع صورة من تاب 🖼️ طبقة</div>`; return; }
  row.innerHTML = list.map((o, i) => {
    const src = ovSource(o), sel = isSel({ kind: "over", i });
    const thumb = src?.image ? `<img src="${src.url}" alt="">` : src ? lightVideo(src.url, "muted playsinline") : "";
    return `<div class="tl-over ${sel ? "selected" : ""} ${o.disabled ? "disabled" : ""}" data-oi="${i}" style="left:${o.t0 * mt.pps}px;width:${Math.max(4, o.dur * mt.pps)}px;top:${2 + (o.lane | 0) * OV_LANE_H}px;height:${OV_LANE_H - 3}px">
      ${thumb}<span class="nm" dir="auto">${src?.image ? "🖼️" : "🎞️"} ${escapeHtml(src?.name || "⚠️ اتمسح")}</span><b class="h l" data-h="l"></b><b class="h r" data-h="r"></b></div>`;
  }).join("");
}
function overTrackDown(e) {
  const el = e.target.closest(".tl-over");
  if (!el || e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const i = Number(el.dataset.oi), o = overlays()[i];
  if (e.ctrlKey || e.metaKey) {
    const s = { kind: "over", i };
    setSelection(isSel(s) ? allSelected().filter((y) => selKey(y) !== selKey(s)) : [...allSelected(), s]);
    renderTimeline(); renderInspector();
    return;
  }
  if (mt.tool === "blade") return splitOver(i, snap(canvasTime(e)));
  pause();
  selectItem({ kind: "over", i });
  if (!(mt.t >= o.t0 && mt.t < o.t0 + o.dur)) seek(o.t0);
  pushHistory();
  const side = e.target.closest("[data-h]")?.dataset.h, src = ovSource(o);
  const t00 = o.t0, d0 = o.dur, s0 = o.start || 0, lane0 = o.lane | 0, sp = o.speed || 1;
  const maxDur = src?.image ? 600 : Math.max(0.1, ((src?.duration || 600) - s0) / sp);
  const edges = [0, mt.t, ...seq().items.flatMap((it) => [it.t0, it.t1]), ...overlays().filter((y) => y !== o).flatMap((y) => [y.t0, y.t0 + y.dur])];
  const snapE = (v) => { for (const ed of edges) if (Math.abs(v - ed) * mt.pps < 8) return ed; return v; };
  let moved = false;
  drag(e, (dx, dy) => {
    moved = true;
    const ds = dx / mt.pps;
    if (side === "l") {
      // القص من الشمال: البداية جوه الفيديو بتتحرك معاه
      const lo = src?.image ? -t00 : Math.max(-t00, -s0 / sp);
      const k = clamp(snapE(snap(t00 + ds)) - t00, lo, d0 - 0.1);
      o.t0 = snap(t00 + k); o.dur = snap(d0 - k);
      if (!src?.image) o.start = Math.max(0, s0 + k * sp);
    } else if (side === "r") o.dur = clamp(snap(snapE(t00 + d0 + ds) - t00), 0.1, maxDur);
    else {
      let nt = Math.max(0, snap(t00 + ds));
      const a = snapE(nt), b = snapE(nt + d0) - d0;
      o.t0 = a !== nt ? a : b !== nt ? Math.max(0, b) : nt;
      o.lane = clamp(lane0 + Math.round(dy / OV_LANE_H), 0, 5);
    }
    renderTimeline();
    drawOverlayLayer();
  }, () => { if (!moved) { mt.undo.pop(); renderHistoryButtons(); } else scheduleSave(); renderOverPane(); });
}
function splitOver(i, t) {
  const o = overlays()[i];
  if (!o || t <= o.t0 + 0.05 || t >= o.t0 + o.dur - 0.05) return toast("حط المؤشر جوه الطبقة عشان تقسمها", true);
  pushHistory();
  const b = JSON.parse(JSON.stringify(o));
  const cut = t - o.t0;
  b.id = Math.random().toString(36).slice(2, 10);
  b.t0 = snap(t); b.dur = snap(o.dur - cut); b.anim_in = null;
  if (!ovSource(o)?.image) b.start = (o.start || 0) + cut * (o.speed || 1);
  o.dur = snap(cut); o.anim_out = null;
  overlays().splice(i + 1, 0, b);
  mt.sel = { kind: "over", i: i + 1 };
  changed();
}
function freeOverLane(t0, dur) {
  const busy = (lane) => overlays().some((y) => (y.lane | 0) === lane && y.t0 < t0 + dur && y.t0 + y.dur > t0);
  let lane = 0;
  while (lane < 5 && busy(lane)) lane++;
  return lane;
}
function addOverlay(src, extra = {}) {
  if (!mt.project) return;
  if (kindLocked("over")) return toast("تراك الطبقات مقفول 🔒", true);
  pushHistory();
  const s = ovSource({ src, ...extra });
  const t0 = snap(extra.t0 ?? mt.t), dur = extra.dur ?? (s?.image ? 3 : Math.min(5, s?.duration || 3));
  const o = { id: Math.random().toString(36).slice(2, 10), src, t0, dur, start: 0, x: 0.5, y: 0.5, w: 0.5, angle: 0, opacity: 1,
    blend: "normal", mask: "", chroma: null, volume: s?.has_audio ? 1 : 0, speed: 1, anim_in: { type: "pop", dur: 0.4 }, anim_out: { type: "fade", dur: 0.3 },
    lane: freeOverLane(t0, dur), ...extra };
  overlays().push(o);
  mt.sel = { kind: "over", i: overlays().length - 1 };
  showTab("over");
  changed();
}
// القطعة من التراك الأساسي ← طبقة (في نفس وقتها)، والعكس
function clipToOverlay() {
  const c = selectedClip(), it = selItem();
  if (!c || !it) return toast("اختار قطعة فيديو الأول", true);
  const t0 = it.t0, dur = it.t1 - it.t0;
  pushHistory();
  mt.project.data.clips.splice(it.i, 1);
  const o = { id: Math.random().toString(36).slice(2, 10), src: c.gen_id, t0, dur, start: c.start, x: 0.5, y: 0.5, w: 0.6, angle: 0, opacity: 1,
    blend: "normal", mask: "", chroma: null, volume: c.volume ?? 1, speed: clipSpeed(c), anim_in: null, anim_out: null, lane: freeOverLane(t0, dur) };
  overlays().push(o);
  mt.undo.pop();  // خطوة واحدة بس
  mt.sel = { kind: "over", i: overlays().length - 1 };
  showTab("over");
  changed();
  toast("⤴ بقت طبقة فوق الفيديو");
}
function overlayToMain() {
  const o = selOver();
  if (!o || ovSource(o)?.image) return toast("الصور مينفعش تبقى في التراك الأساسي", true);
  pushHistory();
  const sp = o.speed || 1, d = mt.project.data;
  const idx = insertIndexAt(o.t0);
  d.clips.splice(idx, 0, { gen_id: o.src, ...CLIP_DEFAULTS, start: o.start || 0, end: (o.start || 0) + o.dur * sp, speed: sp, volume: o.volume ?? 1 });
  overlays().splice(mt.sel.i, 1);
  mt.sel = { kind: "clip", i: idx };
  showTab("clip");
  changed();
}

// ---------- لوحة الطبقة ----------
function renderOverPane() {
  if (!$("ovEditor")) return;
  if (!$("ovBlend").childElementCount) {
    $("ovBlend").innerHTML = OV_BLENDS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
    $("ovMask").innerHTML = OV_MASKS.map(([k, l]) => `<button class="chip" data-mask="${k}">${l}</button>`).join("");
    for (const id of ["ovAnimIn", "ovAnimOut"]) $(id).innerHTML = OV_ANIMS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
  }
  const o = selOver();
  $("ovEditor").hidden = !o;
  $("ovNone").hidden = !!o;
  if (!o) return;
  const src = ovSource(o);
  $("ovName").textContent = `${src?.image ? "🖼️" : "🎞️"} ${src?.name || ""} · من ${fmtTC(o.t0)} · ${o.dur.toFixed(2)}ث`;
  $("ovW").value = Math.round(o.w * 100); $("ovWVal").textContent = `${Math.round(o.w * 100)}%`;
  $("ovX").value = Math.round(o.x * 100); $("ovY").value = Math.round(o.y * 100);
  $("ovAngle").value = Math.round(o.angle || 0); $("ovAngleVal").textContent = o.angle ? `${Math.round(o.angle)}°` : "";
  $("ovOpacity").value = Math.round((o.opacity ?? 1) * 100); $("ovOpacityVal").textContent = `${Math.round((o.opacity ?? 1) * 100)}%`;
  $("ovBlend").value = o.blend || "normal";
  $("ovMask").querySelectorAll("[data-mask]").forEach((b) => b.classList.toggle("on", b.dataset.mask === (o.mask || "")));
  $("ovChroma").checked = !!o.chroma?.on;
  $("ovChromaOpts").hidden = !o.chroma?.on;
  $("ovChromaC").value = o.chroma?.color || "#00ff00";
  $("ovChromaSim").value = Math.round((o.chroma?.sim ?? 0.3) * 100);
  $("ovChromaBl").value = Math.round((o.chroma?.blend ?? 0.1) * 100);
  $("ovFlip").classList.toggle("on", !!o.flip_h);
  $("ovVolRow").hidden = !!src?.image || !src?.has_audio;
  $("ovVol").value = Math.round((o.volume ?? 1) * 100); $("ovVolVal").textContent = `${Math.round((o.volume ?? 1) * 100)}%`;
  $("ovAnimIn").value = o.anim_in?.type || ""; $("ovAnimOut").value = o.anim_out?.type || "";
  $("ovToMain").hidden = !!src?.image;
}
function ovInput(key, apply) {
  return (e) => {
    const o = selOver();
    if (!o) return;
    pushHistory(key);
    apply(o, e);
    drawOverlayLayer();
    renderOverPane();
    scheduleSave();
  };
}
function initOverPane() {
  $("ovW").addEventListener("input", ovInput("ov-w", (o) => (o.w = Number($("ovW").value) / 100)));
  $("ovX").addEventListener("input", ovInput("ov-x", (o) => (o.x = Number($("ovX").value) / 100)));
  $("ovY").addEventListener("input", ovInput("ov-y", (o) => (o.y = Number($("ovY").value) / 100)));
  $("ovAngle").addEventListener("input", ovInput("ov-a", (o) => (o.angle = Number($("ovAngle").value))));
  $("ovOpacity").addEventListener("input", ovInput("ov-op", (o) => (o.opacity = Number($("ovOpacity").value) / 100)));
  $("ovBlend").addEventListener("change", ovInput(null, (o) => (o.blend = $("ovBlend").value)));
  $("ovMask").addEventListener("click", (e) => { const b = e.target.closest("[data-mask]"); if (b) ovInput(null, (o) => (o.mask = b.dataset.mask))(); });
  $("ovChroma").addEventListener("change", ovInput(null, (o) => (o.chroma = { color: "#00ff00", sim: 0.3, blend: 0.1, ...(o.chroma || {}), on: $("ovChroma").checked })));
  $("ovChromaC").addEventListener("input", ovInput("ov-cc", (o) => (o.chroma = { ...(o.chroma || {}), color: $("ovChromaC").value })));
  $("ovChromaSim").addEventListener("input", ovInput("ov-cs", (o) => (o.chroma = { ...(o.chroma || {}), sim: Number($("ovChromaSim").value) / 100 })));
  $("ovChromaBl").addEventListener("input", ovInput("ov-cb", (o) => (o.chroma = { ...(o.chroma || {}), blend: Number($("ovChromaBl").value) / 100 })));
  $("ovFlip").onclick = ovInput(null, (o) => (o.flip_h = !o.flip_h));
  $("ovVol").addEventListener("input", ovInput("ov-v", (o) => (o.volume = Number($("ovVol").value) / 100)));
  $("ovAnimIn").addEventListener("change", ovInput(null, (o) => (o.anim_in = $("ovAnimIn").value ? { type: $("ovAnimIn").value, dur: 0.4 } : null)));
  $("ovAnimOut").addEventListener("change", ovInput(null, (o) => (o.anim_out = $("ovAnimOut").value ? { type: $("ovAnimOut").value, dur: 0.3 } : null)));
  $("ovCenter").onclick = ovInput(null, (o) => { o.x = 0.5; o.y = 0.5; });
  $("ovFull").onclick = ovInput(null, (o) => { o.x = 0.5; o.y = 0.5; o.w = 1; o.angle = 0; });
  $("ovToMain").onclick = overlayToMain;
  $("ovSplit").onclick = () => { if (mt.sel?.kind === "over") splitOver(mt.sel.i, mt.t); };
  $("ovDelete").onclick = () => deleteSelected();
  $("ovImage").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file || !mt.project) return;
    const form = new FormData();
    form.append("file", file);
    try {
      const r = await api("/api/montage/overlay-image", { method: "POST", body: form });
      ovImages.set(r.src, { url: r.url, w: r.w, h: r.h, name: r.name, image: true });
      addOverlay(r.src, { src_w: r.w, src_h: r.h, name: r.name });
    } catch (err) { toast(err.message, true); }
  });
  $("trkOver").addEventListener("pointerdown", overTrackDown);
  TAB_OF_KIND.over = "over";
}
initOverPane();
