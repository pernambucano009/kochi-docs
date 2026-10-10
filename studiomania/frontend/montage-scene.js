// StudioMania — 🪄 المشهد جوه المونتاج: تغيير الخلفية ورا الشخص، وشيل حاجات من الفيديو
// بيشتغل على مشروع التايبوجرافي المخفي بتاع المونتاج (فيديوه هو المونتاج نفسه): الشخص متفصول فريم فريم،
// والكاميرا محسوبة حركتها في كل لقطة. المعاينة طبقة فوق الفيديو (تحت الكلام)، والتصدير بيتركّب في السيرفر.

const msc = { id: null, doc: null, timer: null, ui: null, pick: false, sel: [], reg: null, regTimer: null, hover: null, built: "", pc: new Map(), lastStep: "" };
const SC_FPS = 30;
const SC_KINDS = [["off", "الأصلية"], ["blur", "🌫️ تغبيش"], ["color", "🎨 لون"], ["image", "🖼️ صورة"], ["video", "🎞️ فيديو"], ["ai", "✨ بالـ AI"]];

async function mscLoad() {
  const id = mt.project?.data.typo_id || null;
  if (id !== msc.id) { msc.id = id; msc.doc = null; msc.built = ""; msc.sel = []; msc.pick = false; msc.reg = null; $("pvSceneStage").innerHTML = ""; }
  if (!id) { mscPane(); return; }
  try {
    msc.doc = await api(`/api/typo/${id}/scene/doc`);
  } catch (err) {
    msc.doc = null;
    if (!String(err.message).includes("مش موجود")) toast(err.message, true);
  }
  msc.built = "";
  mscPane();
  mscDraw();
  if (msc.doc?.busy) mscPoll();
}

// ---------- الطبقة فوق المعاينة
const scBgOn = () => msc.doc && msc.doc.bgx.kind !== "off" && msc.doc.person && msc.doc.shots.length;
function mscBuild() {
  const d = msc.doc, st = $("pvSceneStage");
  const key = d ? JSON.stringify([d.bgx, d.removals.map((r) => r.url), d.w]) : "";
  if (key === msc.built) return;
  msc.built = key;
  if (!d || !d.w) { st.innerHTML = ""; return; }
  Object.assign(st.style, { width: `${d.w}px`, height: `${d.h}px` });
  const g = d.bgx;
  let media = "";
  const fill = "position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover";
  if (g.kind === "color") media = `<div style="${fill};background:${g.color}"></div>`;
  else if (g.kind === "image" && g.url) media = `<img src="${g.url}" alt="" style="${fill}">`;
  else if (g.kind === "video" && g.url) media = `<video src="${g.url}" muted playsinline loop preload="auto" data-sc="bg" style="${fill}"></video>`;
  else if (g.kind === "blur" && d.src) media = `<video src="${d.src}" muted playsinline preload="auto" data-sc="src" style="${fill};filter:blur(${(g.blur * 0.8).toFixed(1)}px);transform:scale(1.04)"></video>`;
  st.innerHTML = d.removals.map((r) => `<video class="sc-rm" src="${r.url}" muted playsinline preload="auto" data-f0="${r.f0}" data-f1="${r.f1}" style="${fill}" hidden></video>`).join("")
    + `<div class="sc-bg" style="position:absolute;inset:0" hidden><div class="sc-media" style="position:absolute;inset:0;transform-origin:0 0;${g.dim ? `filter:brightness(${1 - g.dim})` : ""}">${media}</div></div>`;
}

function scSyncVideo(v, want, playing) {
  if (!v || !(want >= 0)) return;
  if (v.duration && want > v.duration) want = v.loop ? want % v.duration : v.duration - 0.05;
  if (playing) {
    if (v.paused) v.play().catch(() => {});
    if (Math.abs(v.currentTime - want) > 0.25) v.currentTime = want;
  } else {
    if (!v.paused) v.pause();
    if (Math.abs(v.currentTime - want) > 0.02) v.currentTime = want;
  }
}

// ماسك الشخص في الفريم ده (أقرب فريم اتحمّل في المعاينة عشان ماترعشش) والفريمات الجاية بتتحمل قبلها
function scMask(i) {
  const p = msc.doc.person;
  if (!p?.n || !p.mbase || i >= p.n) return null;
  for (let j = 0; j < 40; j++) {
    const k = Math.min(p.n - 1, i + j);
    if (msc.pc.has(k)) continue;
    const im = new Image(); im.src = `${p.mbase}${String(k).padStart(5, "0")}.webp`; msc.pc.set(k, im);
    if (msc.pc.size > 400) msc.pc.delete(msc.pc.keys().next().value);
  }
  const ok = (j) => { const im = msc.pc.get(j); return im && im.complete && im.naturalWidth > 0; };
  let k = i;
  if (!ok(k)) for (let d = 1; d <= 20; d++) { if (ok(i - d)) { k = i - d; break; } if (ok(i + d)) { k = i + d; break; } }
  return `${p.mbase}${String(k).padStart(5, "0")}.webp`;
}

function mscDraw() {
  const wrap = $("pvScene");
  if (!wrap) return;
  const d = msc.doc;
  // المشهد معمول على 9:16 بس (زي التصدير)
  const show = !!(d && d.w && (scBgOn() || d.removals.length)) && (typeof canvasRatio !== "function" || canvasRatio() === "9:16");
  wrap.hidden = !show;
  mscPickDraw();
  if (!show) return;
  mscBuild();
  const st = $("pvSceneStage"), k = $("previewFrame").clientWidth / d.w;
  st.style.transform = `scale(${k})`;
  const t = mt.t, i = Math.round(t * SC_FPS), playing = mt.playing;
  st.querySelectorAll(".sc-rm").forEach((v) => {
    const f0 = Number(v.dataset.f0), f1 = Number(v.dataset.f1), on = i >= f0 && i <= f1;
    v.hidden = !on;
    if (on) scSyncVideo(v, t - f0 / SC_FPS, playing); else if (!v.paused) v.pause();
  });
  const bg = st.querySelector(".sc-bg");
  const shot = d.shots.find((s) => i >= s[0] && i <= s[1]);
  const murl = scBgOn() && shot?.[2] ? scMask(i) : null;
  bg.hidden = !murl;
  const vb = bg.querySelector("video");
  if (!murl) { if (vb && !vb.paused) vb.pause(); return; }
  const im = d.person.img;
  const m = `linear-gradient(#000,#000) 0 0/100% 100% no-repeat, url(${murl}) ${im.x.toFixed(1)}px ${im.y.toFixed(1)}px/${im.w.toFixed(1)}px ${im.h.toFixed(1)}px no-repeat`;
  if (bg.dataset.m !== murl) {
    bg.dataset.m = murl;
    bg.style.webkitMask = m; bg.style.webkitMaskComposite = "xor"; bg.style.mask = m; bg.style.maskComposite = "exclude";
  }
  // الخلفية بتتحرك مع الكاميرا (ومتكبّرة شوية عشان أطرافها ماتبانش)
  const med = bg.querySelector(".sc-media"), c = d.cam?.[Math.min(i, d.cam.length - 1)];
  if (c && d.bgx.follow && d.bgx.kind !== "blur" && d.bgx.kind !== "color") {
    const W = d.w, H = d.h;
    med.style.transform = `matrix(${c[0]},${c[3]},${c[1]},${c[4]},${c[2]},${c[5]}) translate(${W / 2}px,${H / 2}px) scale(1.12) translate(${-W / 2}px,${-H / 2}px)`;
  } else med.style.transform = "";
  if (vb) scSyncVideo(vb, t, playing);
}

const _scOverlays = updatePreviewOverlays;
updatePreviewOverlays = function () { _scOverlays(); mscDraw(); };
const _scTick = tick;
tick = function () { _scTick(); if (mt.playing) mscDraw(); };
const _scPause = pause;
pause = function () { const r = _scPause(); $("pvSceneStage")?.querySelectorAll("video").forEach((v) => v.pause()); return r; };
const _scOpen = openProject;
openProject = function (p) { const r = _scOpen(p); mscLoad(); return r; };

// ---------- 🧽 اختيار الحاجة من المعاينة: الماوس بيوريك حدودها، والدوسة بتختارها (أكتر من حتة عادي)
function mscRegions() {
  const id = msc.id, fi = Math.round(mt.t * SC_FPS), key = `${id}|${fi}`;
  if (!id || msc.reg?.key === key) return;
  msc.reg = { key, loading: true };
  clearTimeout(msc.regTimer);
  msc.regTimer = setTimeout(async () => {
    try {
      const data = await api(`/api/typo/${id}/regions?t=${(fi / SC_FPS).toFixed(3)}`);
      if (msc.reg?.key === key) msc.reg = { key, data };
    } catch (err) { if (msc.reg?.key === key) msc.reg = { key, data: null }; toast(err.message, true); }
    mscPickDraw();
  }, 150);
}
function mscRegionAt(nx, ny) {
  const data = msc.reg?.data;
  if (!data || nx < 0 || ny < 0 || nx >= 1 || ny >= 1) return null;
  const g = data.grid, i = g.cells[Math.floor(ny * g.h) * g.w + Math.floor(nx * g.w)];
  return i >= 0 ? data.regions[i] : null;
}
function mscPickDraw() {
  const svg = $("scPick");
  if (!svg) return;
  svg.style.display = msc.pick ? "" : "none";
  if (!msc.pick) { svg.innerHTML = ""; return; }
  if (!mt.playing) mscRegions();
  const W = svg.clientWidth, H = svg.clientHeight;
  const poly = (p, fill, stroke, dash = "") => `<polygon points="${p.map(([x, y]) => `${(x * W).toFixed(1)},${(y * H).toFixed(1)}`).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="2" ${dash ? `stroke-dasharray="${dash}"` : ""} stroke-linejoin="round"/>`;
  let h = msc.sel.map((s) => poly(s.poly, "rgba(255,70,90,.35)", "#ff4d63")).join("");
  const r = msc.hover;
  if (r && !msc.sel.some((s) => s.key === r.key)) {
    h += poly(r.poly, "rgba(250,204,21,.22)", "#FACC15");
    const xs = r.poly.map((p) => p[0] * W), ys = r.poly.map((p) => p[1] * H), lx = Math.min(...xs), ly = Math.max(14, Math.min(...ys) - 6);
    h += `<rect x="${lx}" y="${ly - 14}" width="${12 + r.name.length * 7}" height="17" rx="6" fill="#FACC15"/><text x="${lx + 6}" y="${ly - 2}" font-size="10.5" font-weight="700" fill="#1a1a1a" font-family="system-ui">${escapeHtml(r.name)}</text>`;
  }
  if (msc.reg?.loading) h += `<text x="${W / 2}" y="22" text-anchor="middle" font-size="12" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke" font-family="system-ui">⏳ بيتعرف على اللي في الفريم…</text>`;
  svg.innerHTML = h;
}
$("scPick").addEventListener("pointermove", (e) => {
  const b = e.currentTarget.getBoundingClientRect();
  const r = mscRegionAt((e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height);
  const key = r ? JSON.stringify(r.quad) : null;
  if ((msc.hover?.key || null) === key) return;
  msc.hover = r ? { ...r, key } : null;
  mscPickDraw();
});
$("scPick").addEventListener("pointerleave", () => { msc.hover = null; mscPickDraw(); });
$("scPick").addEventListener("click", (e) => {
  pause();
  const r = msc.hover;
  if (!r) { toast("عدّي على الحاجة لحد ما حدودها تنوّر بالأصفر، وبعدين دوس"); return; }
  const j = msc.sel.findIndex((s) => s.key === r.key);
  if (j >= 0) msc.sel.splice(j, 1);
  else {
    if (msc.sel.length && Math.abs(msc.sel[0].t - mt.t) > 0.05) msc.sel = [];   // الحتت لازم تبقى من نفس الفريم
    msc.sel.push({ key: r.key, poly: r.poly, name: r.name, t: mt.t });
  }
  mscPickDraw(); mscPane();
});

// ---------- تاب 🪄 المشهد
function mscPane() {
  const el = $("mtScenePane");
  if (!el || !mt.project) return;
  const d = msc.doc, busy = !!d?.busy;
  const ready = d?.ready?.source && d.ready.person && d.ready.camera;
  const stale = d?.duration && Math.abs(d.duration - totalLength()) > 0.25;
  let h = `<div class="mt-typo-row">`;
  if (busy) h += `<p><span class="spin-inline"></span> ${escapeHtml(d.step || "بيشتغل…")}</p>`;
  if (d?.status === "failed" && d.error) h += `<p class="err">⚠️ ${escapeHtml(d.error)}</p>`;
  if (!ready) {
    h += `<p class="hint">عشان تغيّر الخلفية ورا الشخص أو تشيل حاجة من الفيديو، البرنامج محتاج يفصل الشخص عن الخلفية في المونتاج كله ويحسب حركة الكاميرا. ده بيتعمل مرة واحدة (دقيقة أو اتنين، ببلاش).</p>
      <button class="btn primary sm" id="scPrep" ${busy || !mt.project.data.clips.length ? "disabled" : ""}>🪄 جهّز المشهد</button></div>`;
    el.innerHTML = h;
    return;
  }
  if (stale && !busy) h += `<p class="hint">⚠️ المونتاج اتغيّر بعد ما المشهد اتجهّز (الطول مختلف): جهّزه من جديد عشان الخلفية تركب صح. <button class="btn sm" id="scPrep">🪄 جهّز من جديد</button></p>`;
  const g = d.bgx, ui = msc.ui || g.kind;
  h += `<h3>🖼️ الخلفية ورا الشخص</h3>
    <div class="sc-chips">${SC_KINDS.map(([k, l]) => `<button class="sc-chip ${ui === k ? "on" : ""}" data-bgk="${k}" ${busy ? "disabled" : ""}>${l}</button>`).join("")}</div>`;
  if (ui === "blur") h += `<label>قد إيه متغبّشة <b>${Math.round(g.blur)}</b><input type="range" id="scBlur" min="4" max="60" step="1" value="${g.blur}"></label>`;
  if (ui === "color") h += `<label>اللون <input type="color" id="scColor" value="${g.color}"></label>`;
  if (ui === "image" || ui === "video") {
    const has = g.kind === ui && g.url;
    h += `<div class="row wrap"><label class="btn sm">⬆️ ${has ? "غيّر" : "ارفع"} ${ui === "image" ? "صورة" : "فيديو"}<input type="file" id="scFile" accept="${ui === "image" ? "image/*" : "video/*"}" hidden></label>
      ${has && ui === "image" ? `<img src="${g.url}" alt="" class="sc-thumb">` : ""}${has && ui === "video" ? `<span class="muted">✓ الفيديو متركّب (بيلف لو أقصر)</span>` : ""}</div>`;
  }
  if (ui === "ai") {
    h += `<p class="hint">اكتب المكان اللي عايزه. البرنامج بياخد فريم من الفيديو عشان الخلفية تطلع بنفس زاوية الكاميرا والإضاءة.</p>
      <textarea id="scPrompt" rows="2" placeholder="مثلًا: مكتب حديث فيه مكتبة خشب وإضاءة دافية وزرع">${escapeHtml(g.prompt || "")}</textarea>
      <div class="row wrap"><button class="btn primary sm" id="scAi" ${busy ? "disabled" : ""}>✨ اعمل الخلفية</button><small class="muted">صورة واحدة، حوالي $0.05</small></div>
      ${g.kind === "image" && g.url && g.prompt ? `<img src="${g.url}" alt="" class="sc-thumb">` : ""}`;
  }
  if (g.kind !== "off") {
    h += `<label>تغميق الخلفية <b>${Math.round(g.dim * 100)}٪</b><input type="range" id="scDim" min="0" max="70" step="5" value="${Math.round(g.dim * 100)}"></label>
      ${g.kind === "image" || g.kind === "video" ? `<label class="check"><input type="checkbox" id="scFollow" ${g.follow ? "checked" : ""}> تتحرك مع الكاميرا (لو الكاميرا بتتهز أو بتلف)</label>` : ""}
      <div><b>اللقطات</b> <small class="muted">الخلفية بتتغير في اللقطات اللي فيها الشخص؛ دوس على أي لقطة تقفلها أو تفتحها</small>
      <div class="sc-chips">${d.shots.map((s, j) => `<button class="sc-chip sm ${s[2] ? "on" : ""}" data-shot="${j}" title="من ${(s[0] / SC_FPS).toFixed(1)}ث لـ ${((s[1] + 1) / SC_FPS).toFixed(1)}ث">${s[2] ? "✓" : "✕"} ${j + 1}</button>`).join("")}</div></div>`;
  }
  h += `</div><div class="mt-typo-row"><h3>🧽 شيل حاجة من الفيديو</h3>`;
  if (!msc.pick) h += `<p class="hint">وقّف على الفريم اللي فيه الحاجة، ودوس «اختار من المعاينة». عدّي عليها لحد ما تنوّر ودوس. لو الحاجة متقسّمة على كذا حتة، اختارهم كلهم.</p>
    <button class="btn sm" id="scPickBtn" ${busy ? "disabled" : ""}>🎯 اختار من المعاينة</button>`;
  else h += `<p class="hint">عدّي على الحاجة لحد ما تنوّر بالأصفر ودوس عليها (تقدر تختار كذا حتة من نفس الفريم). اللي اخترته بيبقى بالأحمر.</p>
    <div class="row wrap"><button class="btn primary sm" id="scRemove" ${msc.sel.length && !busy ? "" : "disabled"}>🧽 شيل ${msc.sel.length ? `(${msc.sel.length})` : ""}</button>
      <button class="btn sm" id="scPickOff">إلغاء</button></div>`;
  if (d.removals.length) {
    h += `<div class="sc-list">${d.removals.map((r) => {
      const ok = r.holes < 0.03;
      return `<div class="sc-item"><b>🧽 ${escapeHtml(r.name)}</b> <span class="muted">من ${(r.f0 / SC_FPS).toFixed(1)}ث لـ ${((r.f1 + 1) / SC_FPS).toFixed(1)}ث</span>
        <div class="muted">${ok ? "✓ المكان اتملا من الفريمات التانية" : r.ai ? `✨ اتملا بالـ AI (${Math.round(r.holes * 100)}٪ عمره ما ظهر)` : `⚠️ ${Math.round(r.holes * 100)}٪ من المكان عمره ما ظهر في الفيديو، واتملا تقريبي`}</div>
        <div class="row wrap"><button class="btn sm" data-rmgo="${r.id}">▶︎ روح له</button>
          ${!ok && !r.ai ? `<button class="btn sm primary" data-rmai="${r.id}" ${busy ? "disabled" : ""}>✨ املاه بالـ AI (حوالي $0.05)</button>` : ""}
          <button class="btn sm danger" data-rmdel="${r.id}" ${busy ? "disabled" : ""}>🗑</button></div></div>`;
    }).join("")}</div>`;
  }
  h += `</div>`;
  el.innerHTML = h;
}

async function mscAfter(res, msg) {
  if (res && res.bgx) { msc.doc = res; msc.built = ""; mscPane(); syncPreview(); if (msg) toast(msg); }
  else { msc.doc = { ...(msc.doc || {}), busy: true, step: res?.step }; mscPane(); mscPoll(); }
}

async function mscBg(body, msg) {
  try { await mscAfter(await api(`/api/typo/${msc.id}/bgx`, { method: "PATCH", ...jsonBody(body) }), msg); }
  catch (err) { toast(err.message, true); }
}

$("mtScenePane").addEventListener("click", async (e) => {
  const t = e.target.closest("button") || e.target;
  if (t.id === "scPrep") {
    await saveProject();
    try {
      const res = await api(`/api/projects/${mt.project.id}/scene`, { method: "POST" });
      mt.project.data.typo_id = res.id;
      msc.id = res.id;
      if (mtx.id !== res.id) mtTypoLoad();
      msc.doc = { ...(msc.doc || {}), busy: true, step: res.step, ready: msc.doc?.ready || {} };
      mscPane(); mscPoll();
      toast("🪄 بيفصل الشخص عن الخلفية ويحسب حركة الكاميرا… دقيقة أو اتنين");
    } catch (err) { toast(err.message, true); }
    return;
  }
  if (t.dataset.bgk) {
    const k = t.dataset.bgk;
    msc.ui = k;
    if (k === "off" || k === "blur" || k === "color") return mscBg({ kind: k }, k === "off" ? "الخلفية رجعت الأصلية" : "🖼️ الخلفية اتغيرت");
    if ((k === "image" || k === "video") && msc.doc.bgx.url && /\.(mp4)$/.test(msc.doc.bgx.url.split("?")[0]) === (k === "video")) return mscBg({ kind: k }, "🖼️ الخلفية اتغيرت");
    mscPane();
    return;
  }
  if (t.dataset.shot) {
    const j = Number(t.dataset.shot), shots = {};
    msc.doc.shots.forEach((s, i) => { shots[i] = i === j ? !s[2] : s[2]; });
    return mscBg({ shots });
  }
  if (t.id === "scAi") {
    const prompt = $("scPrompt").value.trim();
    if (!prompt) { toast("اكتب المكان اللي عايزه الأول", true); return; }
    try { await mscAfter(await api(`/api/typo/${msc.id}/bgx/ai`, { method: "POST", ...jsonBody({ prompt }) })); toast("✨ بيعمل الخلفية… نص دقيقة تقريبًا"); }
    catch (err) { toast(err.message, true); }
    return;
  }
  if (t.id === "scPickBtn") { pause(); msc.pick = true; msc.sel = []; msc.hover = null; mscPane(); mscPickDraw(); return; }
  if (t.id === "scPickOff") { msc.pick = false; msc.sel = []; mscPane(); mscPickDraw(); return; }
  if (t.id === "scRemove") {
    const sel = msc.sel;
    if (!sel.length) return;
    const names = [...new Set(sel.map((s) => s.name))];
    try {
      await mscAfter(await api(`/api/typo/${msc.id}/remove`, { method: "POST", ...jsonBody({ t: sel[0].t, polys: sel.map((s) => s.poly), name: names.length === 1 ? names[0] : "حاجة" }) }));
      msc.pick = false; msc.sel = []; mscPickDraw(); mscPane();
      toast("🧽 بيتابع الحاجة طول اللقطة ويملا مكانها…");
    } catch (err) { toast(err.message, true); }
    return;
  }
  if (t.dataset.rmgo) { const r = msc.doc.removals.find((x) => x.id === t.dataset.rmgo); if (r) { pause(); seek(r.t ?? r.f0 / SC_FPS); } return; }
  if (t.dataset.rmai) {
    try { await mscAfter(await api(`/api/typo/${msc.id}/remove/${t.dataset.rmai}/ai`, { method: "POST" })); toast("✨ الـ AI بيرسم اللي ورا الحاجة…"); }
    catch (err) { toast(err.message, true); }
    return;
  }
  if (t.dataset.rmdel) {
    try { await mscAfter(await api(`/api/typo/${msc.id}/remove/${t.dataset.rmdel}`, { method: "DELETE" }), "🗑️ الحاجة رجعت زي ما كانت"); }
    catch (err) { toast(err.message, true); }
  }
});

$("mtScenePane").addEventListener("change", async (e) => {
  const t = e.target;
  if (t.id === "scBlur") return mscBg({ blur: Number(t.value) });
  if (t.id === "scColor") return mscBg({ kind: "color", color: t.value });
  if (t.id === "scDim") return mscBg({ dim: Number(t.value) / 100 });
  if (t.id === "scFollow") return mscBg({ follow: t.checked });
  if (t.id === "scFile" && t.files?.[0]) {
    const fd = new FormData();
    fd.append("file", t.files[0]);
    toast("⬆️ بيرفع الخلفية…");
    try { await mscAfter(await api(`/api/typo/${msc.id}/bgx/file`, { method: "POST", body: fd }), "🖼️ الخلفية اتغيرت"); }
    catch (err) { toast(err.message, true); }
  }
});

function mscPoll() {
  clearTimeout(msc.timer);
  if (!msc.id) return;
  msc.timer = setTimeout(async () => {
    try {
      const id = msc.id;
      const doc = await api(`/api/typo/${id}/scene/doc`);
      if (id !== msc.id) return;
      if (doc.busy) msc.lastStep = doc.step || msc.lastStep;
      msc.doc = doc;
      msc.built = "";
      mscPane();
      if (doc.busy) { mscPoll(); return; }
      msc.ui = null;
      const was = msc.lastStep || "";
      msc.lastStep = "";
      if (doc.status === "failed") toast(`🪄 ${doc.error || "حصلت مشكلة"}`, true);
      else if (was.includes("🧽") || was.includes("ورا الحاجة")) toast("🧽 الحاجة اتشالت: شغّل الفيديو وشوف");
      else if (was.includes("الخلفية")) toast("✨ الخلفية الجديدة جاهزة");
      else toast("🪄 المشهد جاهز: اختار الخلفية اللي تحبها");
      syncPreview();
      if (mtx.id === id) mtTypoLoad();
    } catch (err) { toast(err.message, true); }
  }, 2500);
}
