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
  const W = Math.max(300, el.clientWidth || 900), small = W < 620;
  const making = !!tw.make;
  const H = making ? (small ? 430 : 470) : (small ? 400 : 460);
  const cx = W / 2, cy = making ? (small ? 118 : 132) : H / 2 - 6, R = small ? 62 : 84, r = small ? 30 : 40;
  const cur = tw.list.find((t) => t.id === tw.cur);
  let stage = "";
  // المدار: كل الشخصيات ما عدا المختار، و«＋» في الآخر
  const ring = tw.list.filter((t) => t.id !== (making ? tw.make.tid : tw.cur));
  const n = ring.length + 1, rx = Math.min(W / 2 - r - 14, small ? 160 : 330), ry = H / 2 - r - 22;
  ring.forEach((t, i) => {
    const a = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / (n + 0);
    stage += twCircle(t, cx + Math.cos(a) * rx, H / 2 - 6 + Math.sin(a) * ry, r, making ? " dim" : "");
  });
  if (!making) {
    const a = -Math.PI / 2;
    stage += `<button type="button" class="ob-face add" style="left:${cx + Math.cos(a) * rx - r}px;top:${H / 2 - 6 + Math.sin(a) * ry - r}px;width:${2 * r}px;height:${2 * r}px" data-twnew title="أفاتار جديد"><i>${TW_I.plus}</i><span class="ob-nm">أفاتار جديد</span></button>`;
    stage += cur ? twCircle(cur, cx, cy, R, " main") : "";
  } else stage += twMakerStage(cx, cy, R, small);
  el.innerHTML = `<header class="ob-h"><b>الشخصيات</b><span class="muted">اختر الشخصية التي تظهر في فيديوهاتك، أو أنشئ أفاتارك من ٣ صور وتسجيل صوتي.</span></header>
    <div class="ob-stage${making ? " making" : ""}" style="height:${H}px">${stage}</div>
    <div class="ob-info">${making ? twMakerInfo() : twInfo(cur)}</div>
    <header class="ob-h"><b>الخلفيات وأوضاع التصوير</b><span class="muted">الأماكن الجاهزة متاحة لكل أفاتار، ويمكنك إضافة مكانك الخاص للأفاتار المختار.</span></header>
    ${twPlaces(cur)}`;
}

function twInfo(t) {
  if (!t) return `<p class="muted">اختر شخصية من المدار، أو اضغط «＋» لإنشاء أفاتارك.</p>`;
  if (t.stock) return `<b class="ob-name">${twe(t.name)}</b><p class="muted">أفاتار جاهز من سمسم كيت، يتكلم بصوت جاهز بلهجة مشروعك. اختره في خطوة الفيديو بقالب الأفاتار أو في الأوتوبايلوت.</p>`;
  const r = t.ready || {};
  const voice = r.voice ? "بصوته المستنسخ" : r.video ? "بصوته من فيديو القراءة" : "بصوت الراوي (لم يُسجَّل صوته بعد)";
  return `<b class="ob-name">${twe(t.name)}</b><p class="muted">يظهر في قالب الأفاتار والأوتوبايلوت، ${voice}.</p>
    ${t.voice_url ? `<audio src="${twe(t.voice_url)}" controls preload="none"></audio>` : ""}
    <div class="ob-links"><button type="button" data-twedit="${twe(t.id)}">الصور والصوت</button><button type="button" class="del" data-twdel="${twe(t.id)}">حذف الأفاتار</button></div>`;
}

// ✨ إنشاء أفاتار: الاسم والموافقة، وبعدين ٣ دواير صور ومربع صوت طالعين من الأفاتار
function twMakerStage(cx, cy, R, small) {
  const A = tw.make, t = twMakeTwin();
  const have = { front: !!(t?.photos || []).find((p) => p.angle === "front"), r45: !!(t?.photos || []).find((p) => p.angle === "r45"), l45: !!(t?.photos || []).find((p) => p.angle === "l45"), voice: !!t?.ready?.voice };
  const done = TW_SLOTS.filter(([k]) => have[k]).length, busy = Object.values(tw.up).some(Boolean);
  const face = twFace(t);
  let out = `<div class="ob-face main new${face ? "" : " empty"}" style="left:${cx - R}px;top:${cy - R}px;width:${2 * R}px;height:${2 * R}px">
      ${face ? `<img src="${twe(face)}" alt="">` : `<i>${TW_I.plus}</i>`}<span class="ob-nm">${twe(A.name || "أفاتار جديد")}</span></div>`;
  if (A.tid) {
    out += `<div class="ob-ring${busy ? " spin" : ""}${done === 4 ? " full" : ""}" style="left:${cx - R - 9}px;top:${cy - R - 9}px;width:${2 * R + 18}px;height:${2 * R + 18}px;--p:${busy ? 18 : (done / 4) * 100}%"></div>`;
    const rad = small ? Math.min(150, cx - 44) : 190, s = small ? 62 : 76;
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
          <span class="ob-vacts"><button type="button" data-twrec>${tw.rec ? "أوقف" : "سجّل"}</button><label>ارفع<input type="file" accept="audio/*,video/*" data-twup="voice" hidden></label></span></div>`;
      } else out += `<label class="${cls}" style="${style}">${inner}<span class="ob-nm">${label}</span><input type="file" accept="image/*" data-twup="photo" data-angle="${k}" hidden></label>`;
    });
    out = `<svg class="ob-wires" aria-hidden="true">${wires}</svg>` + out;
  }
  return out;
}

function twMakerInfo() {
  const A = tw.make, t = twMakeTwin();
  if (!A.tid) return `<div class="ob-form"><input class="av-in" data-twname placeholder="اسم الشخص" value="${twe(A.name || "")}" maxlength="80">
      <label class="av-chk"><input type="checkbox" data-twok ${A.ok ? "checked" : ""}> أؤكد أن هذا أنا، أو أن لديّ إذنًا صريحًا من الشخص</label>
      <div class="ob-links"><button type="button" data-twback>رجوع</button><button type="button" class="nb-btn fs-go" data-twcreate>متابعة</button></div></div>`;
  const ready = !!t?.ready?.photo, all = ready && t?.ready?.voice && (t.photos || []).length >= 3;
  const lines = (tw.kit?.voice_script || []).map((l) => `<li dir="auto">${twe(l)}</li>`).join("");
  return `<p class="muted">${all ? "اكتمل الأفاتار." : "اضغط على كل دائرة لرفع صورة واضحة بإضاءة جيدة، وعلى المربع لتسجيل صوتك في مكان هادئ (نصف دقيقة على الأقل)."}</p>
    ${lines && !t?.ready?.voice ? `<details><summary>النص الذي تقرؤه للتسجيل</summary><ol class="av-lines">${lines}</ol></details>` : ""}
    <div class="ob-links"><button type="button" data-twback>رجوع</button>${ready ? `<button type="button" class="nb-btn fs-go" data-twdone>تم</button>` : ""}</div>`;
}

// 🏞️ الخلفيات وأوضاع التصوير: مربعات (الجاهزة، وأماكن الأفاتار المختار، و«＋»)
function twPlaces(t) {
  const ready = tw.scenes.map((s) => {
    const [place, pose] = String(s.name || "").split(" · ");
    return `<figure class="ob-place">${s.img ? `<img src="${twe(s.img)}" alt="" loading="lazy">` : ""}<figcaption><b>${twe(place)}</b>${pose ? `<small>${twe(pose)}</small>` : ""}</figcaption></figure>`;
  }).join("");
  const own = (t?.backgrounds || []).map((b) => `<figure class="ob-place own"><img src="${twe(b.url)}" alt=""><figcaption><b>${twe(b.name || "مكاني")}</b><small>${twe(t.name)}</small></figcaption>
      <button type="button" data-twbgdel="${twe(b.id)}" aria-label="حذف">✕</button></figure>`).join("");
  const add = t ? `<label class="ob-place add${tw.placeBusy ? " busy" : ""}"><i>${TW_I.plus}</i><figcaption><b>مكانك</b><small>صورة للمكان فارغًا</small></figcaption><input type="file" accept="image/*" data-twup="background" hidden></label>` : "";
  return `<div class="ob-places">${ready}${own}${add}</div>`;
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
  if (q("[data-twback]")) { if (tw.rec) return; tw.make = null; return twRender(); }
  if (q("[data-twdone]")) { tw.cur = tw.make?.tid || tw.cur; tw.make = null; toast("الأفاتار جاهز"); return twInit(); }
  if (q("[data-twrec]")) return twRecord();
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
