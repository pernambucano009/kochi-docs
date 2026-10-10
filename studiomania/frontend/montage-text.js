// StudioMania — 🔠 النصوص الحرة في المونتاج (زي كاب كات): تراك نصوص، كل نص بخطه ولونه ومكانه وحركته.
// التصدير بيرسمها بـ libass (backend/textlayer.py)، والمعاينة هنا بنفس المعادلات بالظبط.

const TEXT_FONTS = [
  ["SM Tajawal", "تجوال", "SM-Tajawal.ttf"], ["SM Almarai", "المراعي", "SM-Almarai.ttf"], ["SM Cairo", "القاهرة", "SM-Cairo.ttf"],
  ["SM Lalezar", "لاله‌زار (عريض)", "SM-Lalezar.ttf"], ["SM Changa", "تشانجا", "SM-Changa.ttf"], ["SM Kufi", "كوفي", "SM-Kufi.ttf"],
  ["SM Plex", "بليكس", "SM-Plex.ttf"], ["IBM Plex Sans Arabic", "بليكس تقيل", "TY-PlexArabic-700.ttf", 700], ["Amiri", "أميري (نسخ)", "TY-Amiri-700.ttf", 700],
  ["Anton", "Anton (إنجليزي)", "TY-Anton.ttf"], ["Outfit", "Outfit (إنجليزي)", "TY-Outfit-700.ttf", 700], ["Instrument Serif", "Instrument Serif (إنجليزي)", "TY-InstrumentSerif.ttf"],
];
const TEXT_BOLD = new Set(TEXT_FONTS.filter((f) => f[3]).map((f) => f[0]));
const TEXT_ANIMS = [["", "بدون"], ["fade", "ظهور"], ["pop", "بوب"], ["zoom", "زووم"], ["slideup", "من تحت"], ["slidedown", "من فوق"],
  ["slideleft", "من اليمين"], ["slideright", "من الشمال"], ["type", "كتابة حرف حرف"]];
const TEXT_PRESETS = [
  { label: "عنوان أصفر", font: "SM Lalezar", size: 120, color: "#ffd166", stroke: { w: 6, color: "#000000" }, shadow: true, bg: { on: false } },
  { label: "أبيض كلاسيك", font: "SM Tajawal", size: 80, color: "#ffffff", stroke: { w: 3, color: "#000000" }, shadow: true, bg: { on: false } },
  { label: "بوكس أحمر", font: "SM Cairo", size: 70, color: "#ffffff", stroke: { w: 0 }, shadow: false, bg: { on: true, color: "#e63946" } },
  { label: "بوكس أبيض", font: "IBM Plex Sans Arabic", size: 64, color: "#111111", stroke: { w: 0 }, shadow: false, bg: { on: true, color: "#ffffff" } },
  { label: "نيون", font: "SM Changa", size: 90, color: "#ff4fd8", stroke: { w: 4, color: "#ffffff" }, shadow: true, bg: { on: false } },
  { label: "أسود على أصفر", font: "SM Kufi", size: 72, color: "#000000", stroke: { w: 0 }, shadow: false, bg: { on: true, color: "#ffd166" } },
  { label: "نسخ أنيق", font: "Amiri", size: 96, color: "#fff4d6", stroke: { w: 0 }, shadow: true, bg: { on: false } },
  { label: "English bold", font: "Anton", size: 120, color: "#ffffff", stroke: { w: 5, color: "#000000" }, shadow: false, bg: { on: false } },
];
const TEXT_LANE_H = 24;

let textFontsLoaded = false;
function loadTextFonts() {
  if (textFontsLoaded) return;
  textFontsLoaded = true;
  for (const [fam, , file, w] of TEXT_FONTS) {
    if (fam.startsWith("SM ")) continue;  // متسجلين مع الكابشن
    const face = new FontFace(fam, `url(/fonts/${file})`, w ? { weight: String(w) } : {});
    face.load().then((ff) => { document.fonts.add(ff); drawTextLayer(); }).catch(() => {});
  }
}

const texts = () => mt.project?.data.texts || (mt.project ? (mt.project.data.texts = []) : []);
const selText = () => (mt.sel?.kind === "text" ? texts()[mt.sel.i] : null);
const textK = () => Math.min(OUT_W, OUT_H) / 1080;  // المقاسات متخزنة على أساس ضلع 1080

// نفس anim_state في textlayer.py
function textAnimState(typ, p, entering) {
  const st = { scale: 1, alpha: 1, dx: 0, dy: 0 }, q = 1 - p, sign = entering ? 1 : -1;
  if (["fade", "zoom", "slideup", "slidedown", "slideleft", "slideright"].includes(typ)) st.alpha = p;
  if (typ === "pop") { st.alpha = Math.min(1, p / 0.3); st.scale = p < 0.7 ? (p / 0.7) * 1.12 : 1.12 - (0.12 * (p - 0.7)) / 0.3; }
  else if (typ === "zoom") st.scale = 0.6 + 0.4 * p;
  else if (typ === "slideup") st.dy = sign * 0.12 * OUT_H * q;
  else if (typ === "slidedown") st.dy = -sign * 0.12 * OUT_H * q;
  else if (typ === "slideleft") st.dx = sign * 0.15 * OUT_W * q;
  else if (typ === "slideright") st.dx = -sign * 0.15 * OUT_W * q;
  return st;
}
const lerpSt = (a, b, f) => ({ scale: a.scale + (b.scale - a.scale) * f, alpha: a.alpha + (b.alpha - a.alpha) * f, dx: a.dx + (b.dx - a.dx) * f, dy: a.dy + (b.dy - a.dy) * f });
// حالة النص في الوقت t (زي الأحداث اللي في ملف ASS: كل مرحلة بتتحرك خطي من حالة لحالة)
function textStateAt(x, t) {
  const dur = x.dur, lt = t - x.t0;
  if (lt < 0 || lt >= dur) return null;
  const ai = x.anim_in?.type ? x.anim_in : null, ao = x.anim_out?.type ? x.anim_out : null;
  const din = ai ? Math.min(ai.dur, dur * 0.5) : 0, dout = ao ? Math.min(ao.dur, dur * 0.5) : 0;
  const rest = { scale: 1, alpha: 1, dx: 0, dy: 0 };
  let text = x.text, st = rest;
  const phase = (a, s0, s1, entering) => {
    const f = clamp((lt - s0) / Math.max(1e-3, s1 - s0), 0, 1);
    if (a.type === "type") {
      const chars = [...x.text], n = Math.max(1, chars.length), i = Math.min(n - 1, Math.floor(f * n));
      text = entering ? chars.slice(0, i + 1).join("") : chars.slice(0, n - i - 1).join("");
      return rest;
    }
    if (a.type === "pop") {
      if (entering) return f < 0.7 ? lerpSt(textAnimState("pop", 0, true), textAnimState("pop", 0.7, true), f / 0.7)
        : lerpSt(textAnimState("pop", 0.7, true), textAnimState("pop", 1, true), (f - 0.7) / 0.3);
      return f < 0.3 ? lerpSt(textAnimState("pop", 1, false), textAnimState("pop", 0.7, false), f / 0.3)
        : lerpSt(textAnimState("pop", 0.7, false), textAnimState("pop", 0, false), (f - 0.3) / 0.7);
    }
    return entering ? lerpSt(textAnimState(a.type, 0, true), textAnimState(a.type, 1, true), f)
      : lerpSt(textAnimState(a.type, 1, false), textAnimState(a.type, 0, false), f);
  };
  if (ai && lt < din) st = phase(ai, 0, din, true);
  else if (ao && lt >= dur - dout) st = phase(ao, dur - dout, dur, false);
  return { st, text };
}

// ---------- طبقة النصوص فوق المعاينة ----------
function textLayer() {
  let el = $("pvText");
  if (!el) {
    el = document.createElement("div");
    el.id = "pvText";
    el.className = "pv-text";
    $("previewFrame").append(el);
    el.addEventListener("pointerdown", textPointerDown);
    el.addEventListener("wheel", textWheel, { passive: false });
    el.addEventListener("dblclick", (e) => { if (e.target.closest("[data-ti]")) { showTab("text"); $("txText").focus(); $("txText").select(); } });
  }
  return el;
}
function drawTextLayer() {
  if (!mt.project) return;
  loadTextFonts();
  const el = textLayer(), list = texts(), fs = PV_W / OUT_W, k = textK();
  const hidden = trackFlag("text", "hide");
  const sel = mt.sel?.kind === "text" ? mt.sel.i : -1;
  const html = [];
  if (!hidden) list.forEach((x, i) => {
    const s = textStateAt(x, mt.t);
    if (!s) return;
    const size = (x.size || 80) * k * fs, st = s.st;
    const stroke = !x.bg?.on && x.stroke?.w ? `-webkit-text-stroke:${(x.stroke.w * 2 * k * fs).toFixed(2)}px ${x.stroke.color || "#000"};paint-order:stroke fill;` : "";
    const shadow = x.shadow ? `text-shadow:${(size * 0.06).toFixed(2)}px ${(size * 0.06).toFixed(2)}px 0 rgba(0,0,0,.5);` : "";
    const box = x.bg?.on ? `background:${x.bg.color || "#000"};padding:${(size * 0.22).toFixed(2)}px;` : "";
    const left = ((x.x ?? 0.5) * OUT_W + st.dx) * fs, top = ((x.y ?? 0.5) * OUT_H + st.dy) * fs;
    const weight = TEXT_BOLD.has(x.font) || x.bold ? 700 : 400;
    html.push(`<div class="pv-tx ${i === sel ? "sel" : ""}" data-ti="${i}" dir="auto" style="left:${left}px;top:${top}px;
      transform:translate(-50%,-50%) rotate(${x.angle || 0}deg) scale(${((x.scale || 1) * st.scale).toFixed(3)});
      opacity:${((x.opacity ?? 1) * st.alpha).toFixed(3)};font-family:'${x.font}','SM Tajawal';font-size:${size.toFixed(2)}px;
      font-weight:${weight};font-style:${x.italic ? "italic" : "normal"};color:${x.color || "#fff"};letter-spacing:${((x.spacing || 0) * k * fs).toFixed(2)}px;
      ${stroke}${shadow}${box}">${escapeHtml(s.text)}${i === sel && !mt.playing ? `<b class="tx-rot" data-txh="rot" title="اسحب عشان تلف"></b><i class="tx-sz" data-txh="sz" title="اسحب عشان تكبّر أو تصغّر"></i>` : ""}</div>`);
  });
  el.innerHTML = html.join("");
}
function textPointerDown(e) {
  const d = e.target.closest("[data-ti]");
  if (!d || e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  pause();
  const i = Number(d.dataset.ti), x = texts()[i];
  if (kindLocked("text")) return toast("تراك النصوص مقفول 🔒", true);
  selectItem({ kind: "text", i });
  pushHistory();
  const fr = $("previewFrame").getBoundingClientRect(), r = (fr.width / PV_W) * (PV_W / OUT_W);
  const cx = fr.left + x.x * OUT_W * r, cy = fr.top + x.y * OUT_H * r;
  const h = e.target.closest("[data-txh]")?.dataset.txh;
  const x0 = x.x, y0 = x.y, a0 = x.angle || 0, s0 = x.scale || 1;
  const ang0 = Math.atan2(e.clientY - cy, e.clientX - cx), d0 = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
  drag(e, (dx, dy, ev) => {
    if (h === "rot") {
      let a = a0 + ((Math.atan2(ev.clientY - cy, ev.clientX - cx) - ang0) * 180) / Math.PI;
      a = ((a + 540) % 360) - 180;
      if (ev.shiftKey) a = Math.round(a / 15) * 15;
      x.angle = Math.round(a * 10) / 10;
    } else if (h === "sz") {
      x.scale = clamp(Math.round(s0 * (Math.hypot(ev.clientX - cx, ev.clientY - cy) / d0) * 100) / 100, 0.1, 5);
    } else {
      let nx = x0 + dx / r / OUT_W, ny = y0 + dy / r / OUT_H;
      // بيلزق في نص الكادر
      if (Math.abs(nx - 0.5) < 0.012) nx = 0.5;
      if (Math.abs(ny - 0.5) < 0.012) ny = 0.5;
      x.x = clamp(nx, -0.5, 1.5); x.y = clamp(ny, -0.5, 1.5);
    }
    drawTextLayer();
    renderTextPane();
  }, () => scheduleSave());
}
function textWheel(e) {
  const d = e.target.closest("[data-ti]");
  if (!d) return;
  e.preventDefault();
  const x = texts()[Number(d.dataset.ti)];
  pushHistory("tx-size");
  x.size = clamp(Math.round((x.size || 80) * (e.deltaY < 0 ? 1.06 : 1 / 1.06)), 10, 400);
  selectItem({ kind: "text", i: Number(d.dataset.ti) });
  drawTextLayer();
  scheduleSave();
}

// ---------- تراك النصوص في التايم لاين ----------
function textLanes() {
  return texts().map((x, i) => ({ x, i, lane: clamp(x.lane | 0, 0, 7) }));
}
function renderTextRow() {
  const row = $("trkText"), head = $("hText");
  if (!row || !mt.project) return;
  const items = textLanes();
  const lanes = Math.max(1, ...items.map((t) => t.lane + 1)) + (items.length ? 1 : 0);
  const h = Math.min(8, lanes) * TEXT_LANE_H + 4;
  row.style.height = head.style.height = `${h}px`;
  if (!items.length) { row.innerHTML = `<div class="tl-empty-track">نصوص حرة: ضيفها من تاب 🔠 نص</div>`; return; }
  row.innerHTML = items.map(({ x, i, lane }) => {
    const sel = isSel({ kind: "text", i });
    return `<div class="tl-text ${sel ? "selected" : ""}" data-ti="${i}" style="left:${x.t0 * mt.pps}px;width:${Math.max(4, x.dur * mt.pps)}px;top:${2 + lane * TEXT_LANE_H}px;height:${TEXT_LANE_H - 3}px">
      <span class="nm" dir="auto">🔠 ${escapeHtml(x.text.replace(/\n/g, " "))}</span><b class="h l" data-h="l"></b><b class="h r" data-h="r"></b></div>`;
  }).join("");
}
function textTrackDown(e) {
  const el = e.target.closest(".tl-text");
  if (!el || e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const i = Number(el.dataset.ti), x = texts()[i];
  if (e.ctrlKey || e.metaKey) {
    const s = { kind: "text", i };
    setSelection(isSel(s) ? allSelected().filter((y) => selKey(y) !== selKey(s)) : [...allSelected(), s]);
    renderTimeline(); renderInspector();
    return;
  }
  if (mt.tool === "blade") return splitText(i, snap(canvasTime(e)));
  pause();
  selectItem({ kind: "text", i });
  if (!(mt.t >= x.t0 && mt.t < x.t0 + x.dur)) seek(x.t0);
  pushHistory();
  const side = e.target.closest("[data-h]")?.dataset.h;
  const t00 = x.t0, d0 = x.dur, lane0 = x.lane | 0;
  const edges = [0, mt.t, ...seq().items.flatMap((it) => [it.t0, it.t1]), ...texts().filter((y) => y !== x).flatMap((y) => [y.t0, y.t0 + y.dur])];
  const snapE = (v) => { for (const ed of edges) if (Math.abs(v - ed) * mt.pps < 8) return ed; return v; };
  let moved = false;
  drag(e, (dx, dy) => {
    moved = true;
    const ds = dx / mt.pps;
    if (side === "l") {
      const nt = clamp(snapE(snap(t00 + ds)), 0, t00 + d0 - 0.1);
      x.dur = snap(t00 + d0 - nt); x.t0 = nt;
    } else if (side === "r") {
      x.dur = Math.max(0.1, snap(snapE(t00 + d0 + ds) - t00));
    } else {
      let nt = Math.max(0, snap(t00 + ds));
      const a = snapE(nt), b = snapE(nt + d0) - d0;
      nt = a !== nt ? a : b !== nt ? Math.max(0, b) : nt;
      x.t0 = nt;
      x.lane = clamp(lane0 + Math.round(dy / TEXT_LANE_H), 0, 7);
    }
    renderTimeline();
    drawTextLayer();
  }, () => { if (!moved) { mt.undo.pop(); renderHistoryButtons(); } else scheduleSave(); renderTextPane(); });
}
function splitText(i, t) {
  const x = texts()[i];
  if (!x || t <= x.t0 + 0.05 || t >= x.t0 + x.dur - 0.05) return toast("حط المؤشر جوه النص عشان تقسمه", true);
  pushHistory();
  const b = JSON.parse(JSON.stringify(x));
  b.t0 = snap(t); b.dur = snap(x.t0 + x.dur - t); b.anim_in = null;
  x.dur = snap(t - x.t0); x.anim_out = null;
  texts().splice(i + 1, 0, b);
  mt.sel = { kind: "text", i: i + 1 };
  changed();
}
function freeTextLane(t0, dur) {
  const busy = (lane) => textLanes().some((y) => y.lane === lane && y.x.t0 < t0 + dur && y.x.t0 + y.x.dur > t0);
  let lane = 0;
  while (lane < 7 && busy(lane)) lane++;
  return lane;
}
function addText(preset) {
  if (!mt.project) return;
  if (kindLocked("text")) return toast("تراك النصوص مقفول 🔒", true);
  pushHistory();
  const p = preset || TEXT_PRESETS[0];
  const t0 = snap(mt.t), dur = 3;
  const x = {
    text: "اكتب هنا", t0, dur, font: p.font, size: p.size, color: p.color, x: 0.5, y: 0.5, angle: 0, scale: 1, opacity: 1, spacing: 0,
    stroke: { w: 0, color: "#000000", ...(p.stroke || {}) }, shadow: !!p.shadow, bg: { on: false, color: "#000000", ...(p.bg || {}) },
    bold: false, italic: false, anim_in: { type: "pop", dur: 0.4 }, anim_out: { type: "fade", dur: 0.3 }, lane: freeTextLane(t0, dur),
  };
  texts().push(x);
  mt.sel = { kind: "text", i: texts().length - 1 };
  showTab("text");
  changed();
  setTimeout(() => { $("txText").focus(); $("txText").select(); }, 30);
}

// ---------- لوحة النص ----------
function renderTextPane() {
  if (!$("txPresets")) return;
  if (!$("txPresets").childElementCount) {
    $("txPresets").innerHTML = TEXT_PRESETS.map((p, n) => `<button class="tx-preset" data-preset="${n}" style="font-family:'${p.font}';color:${p.color};${p.bg?.on ? `background:${p.bg.color};` : ""}${p.stroke?.w ? `-webkit-text-stroke:1px ${p.stroke.color};paint-order:stroke fill;` : ""}">${p.label}</button>`).join("");
    $("txFont").innerHTML = TEXT_FONTS.map(([f, l]) => `<option value="${f}" style="font-family:'${f}'">${l}</option>`).join("");
    for (const id of ["txAnimIn", "txAnimOut"]) $(id).innerHTML = TEXT_ANIMS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
  }
  const x = selText();
  $("txEditor").hidden = !x;
  $("txNone").hidden = !!x;
  if (!x) return;
  if (document.activeElement !== $("txText")) $("txText").value = x.text;
  $("txFont").value = x.font;
  $("txSize").value = x.size; $("txSizeVal").textContent = Math.round(x.size);
  $("txColor").value = x.color || "#ffffff";
  $("txStrokeW").value = x.stroke?.w || 0; $("txStrokeVal").textContent = x.stroke?.w ? x.stroke.w : "";
  $("txStrokeC").value = x.stroke?.color || "#000000";
  $("txShadow").checked = !!x.shadow;
  $("txBgOn").checked = !!x.bg?.on;
  $("txBgC").value = x.bg?.color || "#000000";
  $("txBold").classList.toggle("on", !!x.bold);
  $("txItalic").classList.toggle("on", !!x.italic);
  $("txOpacity").value = Math.round((x.opacity ?? 1) * 100); $("txOpacityVal").textContent = `${Math.round((x.opacity ?? 1) * 100)}%`;
  $("txAngle").value = Math.round(x.angle || 0); $("txAngleVal").textContent = x.angle ? `${Math.round(x.angle)}°` : "";
  $("txSpacing").value = x.spacing || 0;
  $("txAnimIn").value = x.anim_in?.type || ""; $("txAnimInDur").value = Math.round((x.anim_in?.dur || 0.4) * 100); $("txAnimInDur").hidden = !x.anim_in?.type;
  $("txAnimOut").value = x.anim_out?.type || ""; $("txAnimOutDur").value = Math.round((x.anim_out?.dur || 0.3) * 100); $("txAnimOutDur").hidden = !x.anim_out?.type;
  $("txTimes").textContent = `من ${fmtTC(x.t0)} · المدة ${x.dur.toFixed(2)}ث`;
}
function txInput(key, apply) {
  return (e) => {
    const x = selText();
    if (!x) return;
    pushHistory(key);
    apply(x, e);
    drawTextLayer();
    renderTextPane();
    if (key === "text") renderTimeline();
    scheduleSave();
  };
}
function initTextPane() {
  $("txAdd").onclick = () => addText();
  $("txPresets").addEventListener("click", (e) => {
    const b = e.target.closest("[data-preset]");
    if (!b) return;
    const p = TEXT_PRESETS[Number(b.dataset.preset)], x = selText();
    if (!x) return addText(p);
    txInput(null, (t) => Object.assign(t, { font: p.font, size: p.size, color: p.color, shadow: !!p.shadow,
      stroke: { w: 0, color: "#000000", ...(p.stroke || {}) }, bg: { on: false, color: "#000000", ...(p.bg || {}) } }))();
  });
  $("txText").addEventListener("input", txInput("text", (x) => (x.text = $("txText").value || " ")));
  $("txFont").addEventListener("change", txInput(null, (x) => (x.font = $("txFont").value)));
  $("txSize").addEventListener("input", txInput("tx-size", (x) => (x.size = Number($("txSize").value))));
  $("txColor").addEventListener("input", txInput("tx-color", (x) => (x.color = $("txColor").value)));
  $("txStrokeW").addEventListener("input", txInput("tx-sw", (x) => (x.stroke = { ...(x.stroke || {}), w: Number($("txStrokeW").value) })));
  $("txStrokeC").addEventListener("input", txInput("tx-sc", (x) => (x.stroke = { ...(x.stroke || {}), color: $("txStrokeC").value })));
  $("txShadow").addEventListener("change", txInput(null, (x) => (x.shadow = $("txShadow").checked)));
  $("txBgOn").addEventListener("change", txInput(null, (x) => (x.bg = { ...(x.bg || {}), on: $("txBgOn").checked })));
  $("txBgC").addEventListener("input", txInput("tx-bg", (x) => (x.bg = { ...(x.bg || {}), color: $("txBgC").value })));
  $("txBold").onclick = txInput(null, (x) => (x.bold = !x.bold));
  $("txItalic").onclick = txInput(null, (x) => (x.italic = !x.italic));
  $("txOpacity").addEventListener("input", txInput("tx-op", (x) => (x.opacity = Number($("txOpacity").value) / 100)));
  $("txAngle").addEventListener("input", txInput("tx-ang", (x) => (x.angle = Number($("txAngle").value))));
  $("txSpacing").addEventListener("input", txInput("tx-sp", (x) => (x.spacing = Number($("txSpacing").value))));
  $("txAnimIn").addEventListener("change", txInput(null, (x) => (x.anim_in = $("txAnimIn").value ? { type: $("txAnimIn").value, dur: x.anim_in?.dur || 0.4 } : null)));
  $("txAnimOut").addEventListener("change", txInput(null, (x) => (x.anim_out = $("txAnimOut").value ? { type: $("txAnimOut").value, dur: x.anim_out?.dur || 0.3 } : null)));
  $("txAnimInDur").addEventListener("input", txInput("tx-ain", (x) => { if (x.anim_in) x.anim_in.dur = Number($("txAnimInDur").value) / 100; }));
  $("txAnimOutDur").addEventListener("input", txInput("tx-aout", (x) => { if (x.anim_out) x.anim_out.dur = Number($("txAnimOutDur").value) / 100; }));
  $("txCenter").onclick = txInput(null, (x) => { x.x = 0.5; x.y = 0.5; });
  $("txDup").onclick = () => {
    const x = selText();
    if (!x) return;
    pushHistory();
    const b = { ...JSON.parse(JSON.stringify(x)), t0: snap(x.t0 + x.dur), lane: x.lane };
    texts().push(b);
    mt.sel = { kind: "text", i: texts().length - 1 };
    changed();
  };
  $("txDelete").onclick = () => deleteSelected();
  $("txSplit").onclick = () => { if (mt.sel?.kind === "text") splitText(mt.sel.i, mt.t); };
  $("trkText").addEventListener("pointerdown", textTrackDown);
  TAB_OF_KIND.text = "text";
}
initTextPane();
