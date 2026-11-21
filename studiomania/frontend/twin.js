// 🙂 «الأفاتار» في عقل العلامة: كانفاس زي العقل (نقط في الخلفية، فقاعات طايرة تمسكها وتحرّكها، وزوم بالرول أو بقرصة الإيدين).
// فوق: الشخصيات دواير (أفاتاراتك والجاهزة من سمسم كيت) و«＋» لأفاتار جديد. تدوس على أفاتارك يطلع منه ٣ دواير للصور
// (أمامية ويمين ويسار) ومربع للصوت متوصلين بخطوط، ودايرة تحميل حواليه بتتملا، وأي ضغطة برّه بتقفلهم. الـ✕ على الدايرة بتحذفها.
// تحت: الخلفيات ووضعيات التصوير مربعات مبعثرة (كل صورة فيها الوضعية نفسها)، وأماكنك، و«＋ مكانك».
const tw = { list: null, kit: null, scenes: [], open: null, make: null, rec: null, up: {}, placeBusy: false, script: false, fc: null };
const twe = (v) => escapeHtml(v == null ? "" : String(v));
const TW = (p = "") => `/api/twins${p}`;
const TW_SLOTS = [["front", "أمامية", "round"], ["r45", "يمين", "round"], ["l45", "يسار", "round"], ["voice", "الصوت", "sq"]];
const TW_R = 66, TW_PS = 132;   // نص قطر دايرة الأفاتار، وضلع مربع المكان
const TW_I = {
  cam: `<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>`,
  mic: `<svg viewBox="0 0 24 24"><path d="M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v3.5"/></svg>`,
  plus: `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`,
  ok: `<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
};

const AvatarPage = {
  html: () => `<div class="fc ob" id="twMain"><div class="nh-empty">جارٍ التحميل…</div></div>`,
  mount(root) {
    const el = root.querySelector("#twMain");
    if (!el) return;
    tw.el = el; tw.open = null; tw.make = null; tw.fitted = false;
    tw.fc = FloatCanvas.mount(el, { key: "avatars", onMove: twMoved, onBg: () => { if (tw.rec || (!tw.open && !tw.make && !tw.script)) return; tw.open = null; tw.make = null; tw.script = false; twRender(); } });
    el.addEventListener("click", twClick);
    el.addEventListener("change", twChange);
    el.addEventListener("input", (e) => { if (e.target.matches("[data-twname]")) tw.make = { ...(tw.make || {}), name: e.target.value }; });
    if (!tw.onResize) {
      let t;
      tw.onResize = () => { clearTimeout(t); t = setTimeout(() => { if (tw.el?.isConnected && !tw.el.querySelector("[data-twname]:focus")) { tw.fitted = false; twRender(); } }, 160); };
      window.addEventListener("resize", tw.onResize);
    }
    twInit();
  },
  back() { if (tw.open || tw.make) { tw.open = null; tw.make = null; twRender(); return true; } return false; },
  close() { if (tw.rec) try { tw.rec.mr.stop(); } catch { /* */ } },
};

async function twInit() {
  try {
    const [list, kit, scenes] = await Promise.all([api(TW()), tw.kit || api(`/api/twin-kit?lang=${window.I18N?.lang === "en" ? "en" : "ar"}`), tw.scenes.length ? tw.scenes : api("/api/avatar-scenes")]);
    tw.list = list; tw.kit = kit; tw.scenes = scenes || [];
  } catch (err) { tw.list = tw.list || []; toast(err.message, true); }
  twRender();
}

const twFace = (t) => (t?.photos || []).find((p) => ["front", "smile"].includes(p.angle))?.url || (t?.photos || [])[0]?.url || "";
const twOwnFirst = () => tw.list.find((t) => !t.stock)?.id || null;
const twHash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 1000003; return h; };

// 📍 الأماكن الافتراضية: الشخصيات مبعثرة في مجموعة فوق، والأماكن صف مبعثر تحتها
function twLayout() {
  const small = (tw.el?.clientWidth || 900) < 620, ids = ["new", ...tw.list.map((t) => t.id)], cols = small ? 3 : Math.max(3, Math.ceil(Math.sqrt(ids.length * 1.8)));
  const pos = {};
  ids.forEach((id, i) => {
    const h = twHash(id), r = Math.floor(i / cols), c = i % cols;
    pos[`a:${id}`] = [(c - (cols - 1) / 2) * 215 + (r % 2 ? 105 : 0) + ((h % 41) - 20), r * 200 + ((h >> 3) % 37) - 18];
  });
  const rows = Math.ceil(ids.length / cols), py = rows * 200 + 120;
  const places = [...tw.scenes.map((s) => `s:${s.id}`), ...twPlacesOf().map((b) => `b:${b.id}`), "s:add"];
  const pc = small ? 3 : Math.min(places.length, Math.max(4, cols + 1));
  places.forEach((id, i) => {
    const h = twHash(id), r = Math.floor(i / pc), c = i % pc;
    pos[id] = [(c - (pc - 1) / 2) * 172 + ((h % 31) - 15), py + 40 + r * 210 + ((h >> 4) % 29) - 14];
  });
  return { pos, py };
}
const twPlacesOf = () => { const t = tw.list.find((x) => x.id === (tw.open || twOwnFirst())); return (t?.backgrounds || []).map((b) => ({ ...b, owner: t })); };

function twRender() {
  const el = tw.el;
  if (!el || !el.isConnected) return;
  if (tw.list === null) { el.innerHTML = `<div class="nh-empty">جارٍ التحميل…</div>`; return; }
  el.style.height = `${Math.max(420, innerHeight - el.getBoundingClientRect().top - 16)}px`;
  const { pos, py } = twLayout(), R = TW_R;
  const node = (id, cls, html, extra = "") => { const [x, y] = pos[id]; return `<div class="fc-n ${cls}" data-fc="${twe(id)}" data-x="${x}" data-y="${y}" style="left:${x}px;top:${y}px" ${extra}><div class="fc-f" style="--fd:${(twHash(id) % 9) * -0.7}s">${html}</div></div>`; };
  let h = "";
  h += node("a:new", "ob-face add", `<button type="button" class="ob-c" data-twnew aria-label="أفاتار جديد" style="width:${2 * R}px;height:${2 * R}px"><i>${TW_I.plus}</i></button><span class="ob-nm">أفاتار جديد</span>`);
  tw.list.forEach((t) => {
    const img = twFace(t), on = tw.open === t.id;
    h += node(`a:${t.id}`, `ob-face${t.stock ? " stock" : ""}${on ? " on" : ""}`, `<button type="button" class="ob-c" data-twopen="${twe(t.id)}" style="width:${2 * R}px;height:${2 * R}px" title="${twe(t.name)}">${img ? `<img src="${twe(img)}" alt="" draggable="false">` : `<i>${TW_I.cam}</i>`}</button>
      ${t.stock ? `<em>جاهز</em>` : `<button type="button" class="ob-x" data-twdel="${twe(t.id)}" aria-label="حذف">✕</button>`}<span class="ob-nm">${twe(t.name)}</span>`);
  });
  // 🏞️ الخلفيات ووضعيات التصوير
  const lab = `<div class="ob-lab" data-fcb data-x="0" data-y="${py - 70}" style="left:0;top:${py - 70}px"><b>الخلفيات ووضعيات التصوير</b><span class="num">${tw.scenes.length + twPlacesOf().length}</span></div>`;
  const sq = (id, inner, cap, extra = "") => node(id, "ob-place", `<div class="ob-sq" style="width:${TW_PS}px;height:${TW_PS}px;--rot:${((twHash(id) % 9) - 4) * 1.5}deg">${inner}</div>${cap}`, extra);
  tw.scenes.forEach((s) => {
    const [place, pose] = String(s.name || "").split(" · ");
    h += sq(`s:${s.id}`, s.img ? `<img src="${twe(s.img)}" alt="" draggable="false">` : "", `<span class="ob-cap"><b>${twe(place)}</b>${pose ? `<small>${twe(pose)}</small>` : ""}</span>`);
  });
  twPlacesOf().forEach((b) => {
    h += sq(`b:${b.id}`, `<img src="${twe(b.url)}" alt="" draggable="false"><button type="button" class="ob-x" data-twbgdel="${twe(b.id)}" data-owner="${twe(b.owner.id)}" aria-label="حذف">✕</button>`, `<span class="ob-cap"><b>${twe(b.name || "مكاني")}</b><small>${twe(b.owner.name)}</small></span>`);
  });
  h += sq("s:add", `<label class="ob-addsq${tw.placeBusy ? " busy" : ""}"><i>${TW_I.plus}</i><input type="file" accept="image/*" data-twup="background" hidden></label>`, `<span class="ob-cap"><b>مكانك</b><small>صورة للمكان فارغًا</small></span>`);
  el.innerHTML = `<div class="fc-world">${h}${lab}<div class="ob-slots" hidden></div></div>
    <div class="ob-tag"><b>الأفاتار</b><span class="num">${tw.list.length}</span></div>
    ${tw.make ? twForm() : ""}${tw.script ? twScript() : ""}`;
  tw.fc.place();
  if (!tw.fitted || !tw.fc.view) { tw.fc.fit(); tw.fitted = true; } else tw.fc.apply();
  twSlots();
}

// ✨ اللي بيطلع من الأفاتار المفتوح: ٣ دواير صور ومربع صوت، ودايرة التحميل حواليه
function twSlots() {
  const box = tw.el.querySelector(".ob-slots"), t = tw.list.find((x) => x.id === tw.open);
  const n = t && tw.el.querySelector(`[data-fc="a:${CSS.escape(t.id)}"]`);
  if (!box || !t || !n) { if (box) box.hidden = true; return; }
  const R = TW_R, s = 80, rad = R + 118;
  const have = { front: !!(t.photos || []).find((p) => p.angle === "front"), r45: !!(t.photos || []).find((p) => p.angle === "r45"), l45: !!(t.photos || []).find((p) => p.angle === "l45"), voice: !!t.ready?.voice };
  const done = TW_SLOTS.filter(([k]) => have[k]).length, busy = Object.values(tw.up).some(Boolean);
  let wires = "", out = `<div class="ob-ring${busy ? " spin" : ""}${done === 4 ? " full" : ""}" style="left:${-R - 10}px;top:${-R - 10}px;width:${2 * R + 20}px;height:${2 * R + 20}px;--p:${busy ? 18 : (done / 4) * 100}%"></div>`;
  TW_SLOTS.forEach(([k, label, shape], i) => {
    const a = (Math.PI * (165 - i * 50)) / 180, x = Math.cos(a) * rad, y = Math.sin(a) * rad + 26;
    wires += `<path d="M${(Math.cos(a) * R).toFixed(1)} ${(Math.sin(a) * R).toFixed(1)} Q ${x / 2} ${y / 2 + 24} ${x} ${y - s / 2}"/>`;
    const img = k !== "voice" && (t.photos || []).find((p) => p.angle === k)?.url;
    const cls = `ob-slot ${shape}${have[k] ? " filled" : ""}${tw.up[k] ? " busy" : ""}${k === "voice" && tw.rec ? " rec" : ""}`;
    const inner = img ? `<img src="${twe(img)}" alt="">` : have[k] ? `<i>${TW_I.ok}</i>` : `<i>${k === "voice" ? TW_I.mic : TW_I.cam}</i>`;
    const style = `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;--d:${i * 70}ms`;
    if (k === "voice") {
      out += `<div class="${cls}" style="${style}">${inner}<span class="ob-nm">${tw.rec ? `<b class="num" data-twrect>0:00</b>` : label}</span>
        <span class="ob-vacts"><button type="button" data-twrec>${tw.rec ? "أوقف" : "سجّل"}</button><label>ارفع<input type="file" accept="audio/*,video/*" data-twup="voice" hidden></label>${(tw.kit?.voice_script || []).length ? `<button type="button" data-twscript>النص</button>` : ""}</span></div>`;
    } else out += `<label class="${cls}" style="${style}">${inner}<span class="ob-nm">${label}</span><input type="file" accept="image/*" data-twup="photo" data-angle="${k}" hidden></label>`;
  });
  box.innerHTML = `<svg class="ob-wires" aria-hidden="true">${wires}</svg>${out}`;
  box.style.left = `${n.dataset.x}px`; box.style.top = `${n.dataset.y}px`;
  box.hidden = false;
}
function twMoved(id, x, y) {
  if (id === `a:${tw.open}`) { const box = tw.el.querySelector(".ob-slots"); if (box) { box.style.left = `${x}px`; box.style.top = `${y}px`; } }
}

function twForm() {
  const A = tw.make;
  return `<div class="ob-form fc-skip"><input class="av-in" data-twname placeholder="اسم الشخص" value="${twe(A.name || "")}" maxlength="80">
    <label class="av-chk"><input type="checkbox" data-twok ${A.ok ? "checked" : ""}> أؤكد أن هذا أنا، أو أن لديّ إذنًا صريحًا من الشخص</label>
    <button type="button" class="nb-btn fs-go" data-twcreate>متابعة</button></div>`;
}
function twScript() {
  return `<div class="ob-script fc-skip"><button type="button" class="x" data-twscript aria-label="إغلاق">✕</button><ol class="av-lines">${(tw.kit?.voice_script || []).map((l) => `<li dir="auto">${twe(l)}</li>`).join("")}</ol></div>`;
}

async function twEnsure(id) {
  if (!String(id || "").startsWith("r-")) return id;
  const t = await api(TW(`/${id}/use`), { method: "POST" });
  return t.id;
}

async function twUpload(kind, file, angle) {
  let tid = kind === "background" ? tw.open || twOwnFirst() || tw.list[0]?.id : tw.open;
  if (!tid) return;
  if (kind === "background") tid = await twEnsure(tid);
  const f = new FormData();
  if (kind === "photo") f.append("angle", angle || "front");
  if (kind === "background") f.append("name", "مكاني");
  f.append("file", file);
  const key = kind === "photo" ? angle : kind;
  if (kind === "background") tw.placeBusy = true; else tw.up[key] = true;
  twRender();
  try {
    const t = await api(TW(`/${tid}/${kind}`), { method: "POST", body: f });
    if (tw.list.some((x) => x.id === t.id)) tw.list = tw.list.map((x) => (x.id === t.id ? t : x));
    else { tw.placeBusy = false; return twInit(); }
  } catch (err) { toast(err.message, true); }
  if (kind === "background") tw.placeBusy = false; else tw.up[key] = false;
  const t = tw.list.find((x) => x.id === tw.open);
  if (kind !== "background" && t?.ready?.photo && t.ready.voice && (t.photos || []).length >= 3) toast("الأفاتار جاهز");
  twRender();
}

async function twRecord() {
  if (tw.rec) { tw.rec.mr.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream), parts = [], t0 = Date.now();
    mr.ondataavailable = (e) => e.data.size && parts.push(e.data);
    mr.onstop = () => { clearInterval(tw.rec?.timer); stream.getTracks().forEach((t) => t.stop()); tw.rec = null; twUpload("voice", new File(parts, "voice.webm", { type: mr.mimeType || "audio/webm" })); };
    mr.start();
    tw.rec = { mr, timer: setInterval(() => { const s = Math.round((Date.now() - t0) / 1000), el = tw.el?.querySelector("[data-twrect]"); if (el) el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }, 500) };
    twSlots();
  } catch { toast("تعذّر الوصول إلى الميكروفون. ارفع تسجيلًا بدلًا من ذلك", true); }
}

async function twClick(e) {
  const q = (s) => e.target.closest(s);
  let b;
  if ((b = q("[data-twdel]"))) {
    e.stopPropagation();
    if (!(await uiConfirm("حذف هذا الأفاتار نهائيًا؟ لن يظهر في قالب الأفاتار ولا في الأوتوبايلوت."))) return;
    try { await api(TW(`/${b.dataset.twdel}`), { method: "DELETE" }); tw.fc.forget(`a:${b.dataset.twdel}`); if (tw.open === b.dataset.twdel) tw.open = null; await twInit(); } catch (err) { toast(err.message, true); }
    return;
  }
  if ((b = q("[data-twbgdel]"))) {
    e.stopPropagation();
    try { const t = await api(TW(`/${b.dataset.owner}/background/${b.dataset.twbgdel}`), { method: "DELETE" }); tw.list = tw.list.map((x) => (x.id === t.id ? t : x)); twRender(); } catch (err) { toast(err.message, true); }
    return;
  }
  if ((b = q("[data-twopen]"))) {
    const t = tw.list.find((x) => x.id === b.dataset.twopen);
    if (!t || t.stock) return;   // الجاهز: صوره وصوته جاهزين
    tw.make = null; tw.up = {}; tw.open = tw.open === t.id ? null : t.id;
    return twRender();
  }
  if (q("[data-twnew]")) { tw.open = null; tw.make = tw.make ? null : {}; twRender(); tw.el.querySelector("[data-twname]")?.focus(); return; }
  if (q("[data-twrec]")) return twRecord();
  if (q("[data-twscript]")) { tw.script = !tw.script; return twRender(); }
  if (q("[data-twcreate]")) {
    const A = tw.make || {};
    if (!(A.name || "").trim()) return toast("اكتب اسم الشخص", true);
    if (!A.ok) return toast("يجب أن تؤكد أن هذا أنت، أو أن لديك إذنًا صريحًا من الشخص", true);
    try {
      const t = await api(TW(), { method: "POST", ...jsonBody({ name: A.name.trim(), consent: true }) });
      tw.list = [t, ...tw.list]; tw.make = null; tw.open = t.id; tw.up = {};
    } catch (err) { toast(err.message, true); }
    return twRender();
  }
}

function twChange(e) {
  if (e.target.matches("[data-twok]")) { tw.make = { ...(tw.make || {}), ok: e.target.checked }; return; }
  const k = e.target.dataset?.twup, f = e.target.files?.[0];
  if (k && f) { const angle = e.target.dataset.angle; e.target.value = ""; twUpload(k, f, angle); }
}
