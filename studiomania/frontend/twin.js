// 🙂 «الأفاتار» في عقل العلامة (تصميم «المدار»): الشخصيات دواير بتلف حوالين الأفاتار المختار، و«＋» بيطلّع منه ٣ دواير للصور
// (أمامية ويمين ويسار) ومربع للصوت، متوصلين بخطوط زي عناصر العقل، ودايرة تحميل بتلف حوالين الأفاتار لحد ما يخلص.
// تحت: الخلفيات وأوضاع التصوير بنفس الفكرة بس مربعات (الجاهزة لكل الأفاتارات، وأماكن الأفاتار المختار نفسه).
const tw = { list: null, cur: null, kit: null, scenes: [], make: null, rec: null, up: {}, placeBusy: false };
const twe = (v) => escapeHtml(v == null ? "" : String(v));
const TW = (p = "") => `/api/twins${p}`;
const TW_SLOTS = [["front", "أمامية", "round"], ["r45", "يمين", "round"], ["l45", "يسار", "round"], ["voice", "الصوت", "sq"]];
const TW_I = {
  cam: `<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>`,
  mic: `<svg viewBox="0 0 24 24"><path d="M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v3.5"/></svg>`,
  plus: `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`,
  ok: `<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
};

const AvatarPage = {
  html: () => `<div class="nb-wrap ob" id="twMain"><div class="nh-empty">جارٍ التحميل…</div></div>`,
  mount(root) {
    const el = root.querySelector("#twMain");
    if (!el) return;
    tw.el = el;
    el.addEventListener("click", twClick);
    el.addEventListener("change", twChange);
    el.addEventListener("input", (e) => { if (e.target.matches("[data-twname]")) tw.make = { ...(tw.make || {}), name: e.target.value }; });
    if (!tw.onResize) {
      let t;
      tw.onResize = () => { clearTimeout(t); t = setTimeout(() => { if (tw.el?.isConnected && !tw.el.querySelector("[data-twname]:focus")) twRender(); }, 160); };
      window.addEventListener("resize", tw.onResize);
    }
    twInit();
  },
  back() { if (tw.make) { tw.make = null; twRender(); return true; } return false; },
  close() { if (tw.rec) try { tw.rec.mr.stop(); } catch { /* */ } },
};

async function twInit() {
  try {
    const [list, kit, scenes] = await Promise.all([api(TW()), tw.kit || api(`/api/twin-kit?lang=${window.I18N?.lang === "en" ? "en" : "ar"}`), tw.scenes.length ? tw.scenes : api("/api/avatar-scenes")]);
    tw.list = list; tw.kit = kit; tw.scenes = scenes || [];
  } catch (err) { tw.list = tw.list || []; toast(err.message, true); }
  if (!tw.cur || !tw.list.some((t) => t.id === tw.cur)) tw.cur = (tw.list.find((t) => !t.stock) || tw.list[0])?.id || null;
  twRender();
}

const twFace = (t) => (t?.photos || []).find((p) => ["front", "smile"].includes(p.angle))?.url || (t?.photos || [])[0]?.url || "";
const twMakeTwin = () => (tw.make?.tid ? tw.list.find((t) => t.id === tw.make.tid) : null);

// 🌀 دايرة الأفاتار (في النص أو على المدار)
function twCircle(t, x, y, r, extra = "") {
  const img = twFace(t);
  return `<button type="button" class="ob-face${t.stock ? " stock" : ""}${extra}" style="left:${x - r}px;top:${y - r}px;width:${2 * r}px;height:${2 * r}px" data-twpick="${twe(t.id)}" title="${twe(t.name)}">
    ${img ? `<img src="${twe(img)}" alt="">` : `<i>${TW_I.cam}</i>`}${t.stock ? `<em>جاهز</em>` : ""}<span class="ob-nm">${twe(t.name)}</span></button>`;
}

function twRender() {
  const el = tw.el;
  if (!el || !el.isConnected) return;
  if (tw.list === null) { el.innerHTML = `<div class="nh-empty">جارٍ التحميل…</div>`; return; }
  // 📐 الصفحة كلها في الشاشة من غير سكرول: الدواير فوق، والخلفيات صف (أو صفين على الموبايل) تحت
  const W = Math.max(300, el.clientWidth || 900), small = W < 620;
  const key = `${innerWidth}x${innerHeight}`;
  if (tw.fitKey !== key) { tw.fitKey = key; tw.fitAdj = 0; }
  const avail = Math.max(small ? 520 : 480, innerHeight - el.getBoundingClientRect().top - 18 - tw.fitAdj);
  const cur = tw.list.find((t) => t.id === tw.cur);
  const nPl = tw.scenes.length + (cur?.backgrounds || []).length + (cur ? 1 : 0), rows = small ? 2 : 1, per = Math.ceil(nPl / rows);
  const ps = Math.max(48, Math.min(small ? 70 : 100, (W - (per - 1) * (small ? 8 : 12)) / per));
  const plH = rows * (ps + (small ? 30 : 34)) + (rows - 1) * 8 + 34;
  const H = Math.max(300, avail - plH - 8);
  const making = !!tw.make;
  const top0 = small ? 44 : 0, mY = top0 + (H - top0) / 2 - 14;   // على الموبايل الدواير تحت كلمة «الأفاتار»
  const cx = W / 2, cy = making ? top0 + (H - top0) * 0.27 : mY;
  const R = Math.round(Math.min(small ? 52 : 84, H * 0.18)), r = Math.round(Math.min(small ? 26 : 40, H * 0.085));
  let stage = "";
  const ring = tw.list.filter((t) => t.id !== (making ? tw.make.tid : tw.cur));
  // المدار: «＋» فوق في النص بالظبط، والباقيين متوزعين على الجنبين، وفراغ تحت (مكان اسم المختار وأوامره)
  const gap = (38 * Math.PI) / 180, rx = Math.min(W / 2 - r - (small ? 4 : 12), small ? 170 : 340), ry = (H - top0) / 2 - r - 26;
  const lc = Math.ceil(ring.length / 2), rc = ring.length - lc, half = Math.PI - gap;
  const angs = [...Array(lc)].map((_, j) => Math.PI / 2 + gap + (half * j) / lc).concat([1.5 * Math.PI], [...Array(rc)].map((_, j) => 2.5 * Math.PI - gap - (half * (rc - 1 - j)) / rc));
  const order = [...ring.slice(0, lc), null, ...ring.slice(lc)];
  order.forEach((t, i) => {
    const x = cx + Math.cos(angs[i]) * rx, y = mY + Math.sin(angs[i]) * ry;
    if (t) stage += twCircle(t, x, y, r, making ? " dim" : "");
    else if (!making) stage += `<button type="button" class="ob-face add" style="left:${x - r}px;top:${y - r}px;width:${2 * r}px;height:${2 * r}px" data-twnew title="أفاتار جديد"><i>${TW_I.plus}</i><span class="ob-nm">أفاتار جديد</span></button>`;
  });
  if (!making) {
    if (cur) stage += twCircle(cur, cx, cy, R, " main");
    if (cur && !cur.stock) stage += `<div class="ob-links ob-under" style="top:${cy + R + 40}px"><button type="button" data-twedit="${twe(cur.id)}">الصور والصوت</button><button type="button" class="del" data-twdel="${twe(cur.id)}">حذف</button></div>`;
  } else stage += twMakerStage(cx, cy, R, small, H);
  const own = tw.list.filter((t) => !t.stock).length, stock = tw.list.filter((t) => t.stock).length;
  el.innerHTML = `<div class="ob-stage${making ? " making" : ""}" style="height:${H}px">
      <div class="ob-tag"><b>الأفاتار</b><span class="num">${own + stock}</span></div>${stage}</div>
    <div class="ob-pl"><div class="ob-tag in"><b>الخلفيات ووضعيات التصوير</b><span class="num">${nPl - (cur ? 1 : 0)}</span></div>
      ${twPlaces(cur, ps, per)}</div>`;
  // لو لسه فيه سكرول (فراغات الصفحة حوالين المحتوى): نصغّر الدواير على قده مرة واحدة
  const g = el.closest(".nh-pgrid"), over = g ? g.scrollHeight - g.clientHeight : 0;
  if (over > 0 && tw.fitAdj < 400) { tw.fitAdj += over + 2; twRender(); }
}

// ✨ إنشاء أفاتار: الاسم والموافقة، وبعدين ٣ دواير صور ومربع صوت طالعين من الأفاتار
function twMakerStage(cx, cy, R, small, H) {
  const A = tw.make, t = twMakeTwin();
  const have = { front: !!(t?.photos || []).find((p) => p.angle === "front"), r45: !!(t?.photos || []).find((p) => p.angle === "r45"), l45: !!(t?.photos || []).find((p) => p.angle === "l45"), voice: !!t?.ready?.voice };
  const done = TW_SLOTS.filter(([k]) => have[k]).length, busy = Object.values(tw.up).some(Boolean);
  const face = twFace(t);
  let out = `<div class="ob-face main new${face ? "" : " empty"}" style="left:${cx - R}px;top:${cy - R}px;width:${2 * R}px;height:${2 * R}px">
      ${face ? `<img src="${twe(face)}" alt="">` : `<i>${TW_I.plus}</i>`}<span class="ob-nm">${twe(A.name || "أفاتار جديد")}</span></div>`;
  if (!A.tid) {
    return out + `<div class="ob-form" style="top:${cy + R + 44}px"><input class="av-in" data-twname placeholder="اسم الشخص" value="${twe(A.name || "")}" maxlength="80">
      <label class="av-chk"><input type="checkbox" data-twok ${A.ok ? "checked" : ""}> أؤكد أن هذا أنا، أو أن لديّ إذنًا صريحًا من الشخص</label>
      <div class="ob-links"><button type="button" data-twback>رجوع</button><button type="button" class="nb-btn fs-go" data-twcreate>متابعة</button></div></div>`;
  }
  out += `<div class="ob-ring${busy ? " spin" : ""}${done === 4 ? " full" : ""}" style="left:${cx - R - 9}px;top:${cy - R - 9}px;width:${2 * R + 18}px;height:${2 * R + 18}px;--p:${busy ? 18 : (done / 4) * 100}%"></div>`;
  const s = small ? 60 : Math.min(76, Math.round(H * 0.15));
  const rad = Math.max(110, Math.min(small ? 150 : 200, cx - s / 2 - 34, (H - cy - 40 - s / 2 - 78) / 0.9));
  let wires = "";
  TW_SLOTS.forEach(([k, label, shape], i) => {
    const a = (Math.PI * (160 - i * 46.6)) / 180, x = cx + Math.cos(a) * rad, y = cy + 40 + Math.sin(a) * rad * 0.95;
    wires += `<path d="M${cx} ${cy + R * 0.6} Q ${(cx + x) / 2} ${y + 30} ${x} ${y - s / 2}"/>`;
    const img = k !== "voice" && (t?.photos || []).find((p) => p.angle === k)?.url;
    const cls = `ob-slot ${shape}${have[k] ? " filled" : ""}${tw.up[k] ? " busy" : ""}${k === "voice" && tw.rec ? " rec" : ""}`;
    const inner = img ? `<img src="${twe(img)}" alt="">` : have[k] ? `<i>${TW_I.ok}</i>` : `<i>${k === "voice" ? TW_I.mic : TW_I.cam}</i>`;
    const style = `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;--d:${i * 70}ms`;
    if (k === "voice") {
      out += `<div class="${cls}" style="${style}">${inner}<span class="ob-nm">${tw.rec ? `<b class="num" data-twrect>0:00</b>` : label}</span>
        <span class="ob-vacts"><button type="button" data-twrec>${tw.rec ? "أوقف" : "سجّل"}</button><label>ارفع<input type="file" accept="audio/*,video/*" data-twup="voice" hidden></label>${(tw.kit?.voice_script || []).length ? `<button type="button" data-twscript>النص</button>` : ""}</span></div>`;
    } else out += `<label class="${cls}" style="${style}">${inner}<span class="ob-nm">${label}</span><input type="file" accept="image/*" data-twup="photo" data-angle="${k}" hidden></label>`;
  });
  out = `<svg class="ob-wires" aria-hidden="true">${wires}</svg>` + out;
  const ready = !!t?.ready?.photo;
  out += `<div class="ob-links ob-bottom"><button type="button" data-twback>رجوع</button>${ready ? `<button type="button" class="nb-btn fs-go" data-twdone>تم</button>` : ""}</div>`;
  if (tw.script) out += `<div class="ob-script"><button type="button" class="x" data-twscript aria-label="إغلاق">✕</button><ol class="av-lines">${tw.kit.voice_script.map((l) => `<li dir="auto">${twe(l)}</li>`).join("")}</ol></div>`;
  return out;
}

// 🏞️ الخلفيات ووضعيات التصوير: مربعات في صف واحد (الجاهزة، وأماكن الأفاتار المختار، و«＋»)
function twPlaces(t, ps, per) {
  // 🃏 مبعثرة شوية زي كروت متحطوطة جنب بعض (ميلة ونزلة خفيفة ثابتة لكل كارت)، من غير ما تركب على بعض
  const tilt = (i) => `style="--rot:${(((i * 37) % 9) - 4) * 1.6}deg;--ty:${(((i * 53) % 7) - 3) * 4}px"`;
  let ci = 0;
  const ready = tw.scenes.map((s) => {
    const [place, pose] = String(s.name || "").split(" · ");
    return `<figure class="ob-place" ${tilt(ci++)}>${s.img ? `<img src="${twe(s.img)}" alt="">` : ""}<figcaption><b>${twe(place)}</b>${pose ? `<small>${twe(pose)}</small>` : ""}</figcaption></figure>`;
  }).join("");
  const own = (t?.backgrounds || []).map((b) => `<figure class="ob-place own" ${tilt(ci++)}><img src="${twe(b.url)}" alt=""><figcaption><b>${twe(b.name || "مكاني")}</b><small>${twe(t.name)}</small></figcaption>
      <button type="button" data-twbgdel="${twe(b.id)}" aria-label="حذف">✕</button></figure>`).join("");
  const add = t ? `<label class="ob-place add${tw.placeBusy ? " busy" : ""}" ${tilt(ci++)}><i>${TW_I.plus}</i><figcaption><b>مكانك</b></figcaption><input type="file" accept="image/*" data-twup="background" hidden></label>` : "";
  return `<div class="ob-places" style="--ps:${ps}px;grid-template-columns:repeat(${per}, var(--ps))">${ready}${own}${add}</div>`;
}

async function twEnsure(id) {
  if (!String(id || "").startsWith("r-")) return id;
  const t = await api(TW(`/${id}/use`), { method: "POST" });
  tw.cur = t.id;
  return t.id;
}

async function twUpload(kind, file, angle) {
  const tid = kind === "background" ? await twEnsure(tw.cur) : tw.make?.tid;
  if (!tid) return;
  const f = new FormData();
  if (kind === "photo") f.append("angle", angle || "front");
  if (kind === "background") f.append("name", "مكاني");
  f.append("file", file);
  const key = kind === "photo" ? angle : kind;
  if (kind === "background") tw.placeBusy = true; else tw.up[key] = true;
  twRender();
  try {
    const t = await api(TW(`/${tid}/${kind}`), { method: "POST", body: f });
    tw.list = tw.list.map((x) => (x.id === t.id ? t : x));
    if (!tw.list.some((x) => x.id === t.id)) await twInit();
  } catch (err) { toast(err.message, true); }
  if (kind === "background") tw.placeBusy = false; else tw.up[key] = false;
  twRender();
  const t = twMakeTwin();
  if (tw.make && t?.ready?.photo && t.ready.voice && (t.photos || []).length >= 3) {
    setTimeout(() => { if (tw.make?.tid === t.id) { tw.cur = t.id; tw.make = null; toast("الأفاتار جاهز"); twRender(); } }, 1400);
  }
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
    twRender();
  } catch { toast("تعذّر الوصول إلى الميكروفون. ارفع تسجيلًا بدلًا من ذلك", true); }
}

async function twClick(e) {
  const q = (s) => e.target.closest(s);
  let b;
  if ((b = q("[data-twpick]"))) { if (tw.make) return; tw.cur = b.dataset.twpick; return twRender(); }
  if (q("[data-twnew]")) { tw.make = {}; tw.up = {}; return twRender(); }
  if ((b = q("[data-twedit]"))) { const t = tw.list.find((x) => x.id === b.dataset.twedit); tw.make = { tid: t.id, name: t.name }; tw.up = {}; return twRender(); }
  if (q("[data-twback]")) { if (tw.rec) return; tw.make = null; tw.script = false; return twRender(); }
  if (q("[data-twdone]")) { tw.cur = tw.make?.tid || tw.cur; tw.make = null; toast("الأفاتار جاهز"); return twInit(); }
  if (q("[data-twrec]")) return twRecord();
  if (q("[data-twscript]")) { tw.script = !tw.script; return twRender(); }
  if (q("[data-twcreate]")) {
    const A = tw.make || {};
    if (!(A.name || "").trim()) return toast("اكتب اسم الشخص", true);
    if (!A.ok) return toast("يجب أن تؤكد أن هذا أنت، أو أن لديك إذنًا صريحًا من الشخص", true);
    try { const t = await api(TW(), { method: "POST", ...jsonBody({ name: A.name.trim(), consent: true }) }); tw.list = [t, ...tw.list]; tw.make = { ...A, tid: t.id }; } catch (err) { toast(err.message, true); }
    return twRender();
  }
  if ((b = q("[data-twdel]"))) {
    if (!(await uiConfirm("حذف هذا الأفاتار نهائيًا؟ لن يظهر في قالب الأفاتار ولا في الأوتوبايلوت."))) return;
    try { await api(TW(`/${b.dataset.twdel}`), { method: "DELETE" }); tw.cur = null; await twInit(); } catch (err) { toast(err.message, true); }
    return;
  }
  if ((b = q("[data-twbgdel]"))) {
    try { const t = await api(TW(`/${tw.cur}/background/${b.dataset.twbgdel}`), { method: "DELETE" }); tw.list = tw.list.map((x) => (x.id === t.id ? t : x)); twRender(); } catch (err) { toast(err.message, true); }
  }
}

function twChange(e) {
  if (e.target.matches("[data-twok]")) { tw.make = { ...(tw.make || {}), ok: e.target.checked }; return; }
  const k = e.target.dataset?.twup, f = e.target.files?.[0];
  if (k && f) { const angle = e.target.dataset.angle; e.target.value = ""; twUpload(k, f, angle); }
}
