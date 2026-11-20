// 🙂 «الأفاتار» في عقل العلامة: كل الأفاتارات (نفس اللي بتظهر في قالب الأفاتار والأوتوبايلوت)، وإنشاء واحد جديد،
// ووشه، وصوته المستنسخ، وأماكن التصوير الخاصة بيه. من غير كروت: قايمة على جنب، والتفاصيل جنبها.
const tw = { list: null, cur: null, kit: null, scenes: [], make: null, rec: null, busy: "" };
const twe = (v) => escapeHtml(v == null ? "" : String(v));
const TW = (p = "") => `/api/twins${p}`;

const AvatarPage = {
  html: () => `<div class="nb-wrap av-wrap" id="twMain"><div class="nh-empty">جارٍ التحميل…</div></div>`,
  mount(root) {
    const el = root.querySelector("#twMain");
    if (!el) return;
    tw.el = el;
    el.addEventListener("click", twClick);
    el.addEventListener("change", twChange);
    el.addEventListener("input", (e) => { if (e.target.matches("[data-twname]")) tw.make = { ...(tw.make || {}), name: e.target.value }; });
    twInit();
  },
  back() { if (tw.make) { tw.make = null; twRender(); return true; } return false; },
  close() { if (tw.rec) try { tw.rec.stop(); } catch { /* */ } },
};

async function twInit() {
  try {
    const [list, kit, scenes] = await Promise.all([api(TW()), tw.kit || api(`/api/twin-kit?lang=${window.I18N?.lang === "en" ? "en" : "ar"}`), tw.scenes.length ? tw.scenes : api("/api/avatar-scenes")]);
    tw.list = list; tw.kit = kit; tw.scenes = scenes || [];
  } catch (err) { tw.list = tw.list || []; toast(err.message, true); }
  if (!tw.cur || !tw.list.some((t) => t.id === tw.cur)) tw.cur = tw.list[0]?.id || null;
  twRender();
}

const twFace = (t) => (t.photos || []).find((p) => ["front", "smile"].includes(p.angle))?.url || (t.photos || [])[0]?.url || "";
function twState(t) {
  const r = t.ready || {};
  return { face: r.photo || r.video, voice: r.voice ? "own" : r.video ? "video" : "" };
}

function twRender() {
  const el = tw.el;
  if (!el || !el.isConnected) return;
  if (tw.list === null) { el.innerHTML = `<div class="nh-empty">جارٍ التحميل…</div>`; return; }
  const side = `<aside class="av-side"><h2>الأفاتار</h2>
    ${tw.list.map((t) => `<button type="button" class="av-row${t.id === tw.cur && !tw.make ? " on" : ""}" data-twpick="${twe(t.id)}">
      <i class="av-face">${twFace(t) ? `<img src="${twe(twFace(t))}" alt="">` : twe((t.name || "؟").slice(0, 1))}</i><span>${twe(t.name)}</span></button>`).join("")}
    <button type="button" class="av-row add${tw.make ? " on" : ""}" data-twnew><i class="av-face">＋</i><span>أفاتار جديد</span></button></aside>`;
  el.innerHTML = `<div class="av">${side}<section class="av-main">${tw.make ? twMaker() : twDetail(tw.list.find((t) => t.id === tw.cur))}</section></div>`;
}

function twDetail(t) {
  if (!t) return `<div class="av-empty"><p>لا يوجد أفاتار بعد. أنشئه مرة واحدة من صورة أو فيديو، ثم يقول أي نص بوجهك وصوتك في قالب الأفاتار والأوتوبايلوت.</p>
    <button type="button" class="nb-btn fs-go" data-twnew>＋ أنشئ أفاتار</button></div>`;
  const st = twState(t), places = t.backgrounds || [];
  const voiceTxt = st.voice === "own" ? "صوته مستنسخ من تسجيل خاص" : st.voice === "video" ? "صوته مستنسخ من فيديو القراءة" : "لا يوجد تسجيل صوت بعد، فيستخدم صوت الراوي";
  return `<header class="av-head"><i class="av-face big">${twFace(t) ? `<img src="${twe(twFace(t))}" alt="">` : ""}</i>
      <div><h3>${twe(t.name)}</h3><p class="muted">يظهر في «تصوير الفيديو بالأفاتار» وفي الأوتوبايلوت.</p></div>
      <button type="button" class="av-del" data-twdel="${twe(t.id)}">حذف الأفاتار</button></header>
    <div class="av-block"><h4>الوجه</h4>
      <p class="muted">${t.ready?.video ? "من فيديو القراءة" : t.ready?.photo ? "من صورة أمامية" : "لا يوجد وجه بعد"}</p>
      <div class="av-acts"><label class="nb-btn">تغيير الصورة<input type="file" accept="image/*" data-twup="photo" hidden></label>
        <label class="nb-btn">رفع فيديو قراءة<input type="file" accept="video/*" data-twup="video" hidden></label></div></div>
    <div class="av-block"><h4>الصوت</h4><p class="muted">${voiceTxt}</p>
      ${t.voice_url ? `<audio src="${twe(t.voice_url)}" controls preload="none"></audio>` : ""}
      <div class="av-acts"><button type="button" class="nb-btn" data-twrec>${tw.rec ? "⏹ أوقف التسجيل وارفعه" : "🎙️ سجّل صوته الآن"}</button>
        <label class="nb-btn">ارفع تسجيلًا<input type="file" accept="audio/*,video/*" data-twup="voice" hidden></label></div>
      ${tw.rec ? `<p class="muted">🔴 جارٍ التسجيل… اقرأ النص بصوتك الطبيعي (نصف دقيقة على الأقل)</p>` : ""}
      ${(tw.kit?.voice_script || []).length ? `<details><summary>النص الذي تقرؤه للتسجيل</summary><ol class="av-lines">${tw.kit.voice_script.map((l) => `<li dir="auto">${twe(l)}</li>`).join("")}</ol></details>` : ""}</div>
    <div class="av-block"><h4>أماكن التصوير</h4>
      <p class="muted">الأماكن الجاهزة متاحة لكل أفاتار: ${tw.scenes.map((s) => twe(s.name)).join(" · ")}. وأماكنك الخاصة:</p>
      <div class="av-places">${places.map((b) => `<figure><img src="${twe(b.url)}" alt=""><figcaption>${twe(b.name || "مكاني")}</figcaption><button type="button" data-twbgdel="${twe(b.id)}" aria-label="حذف">✕</button></figure>`).join("")}
        <label class="av-addplace">＋ مكان<input type="file" accept="image/*" data-twup="background" hidden></label></div></div>
    ${tw.busy ? `<p class="muted">⏳ ${twe(tw.busy)}</p>` : ""}`;
}

function twMaker() {
  const A = tw.make || {};
  if (!A.tid) return `<div class="av-block"><h4>أفاتار جديد</h4><p class="muted">مرة واحدة فقط، ثم يقول الأفاتار أي نص بوجهك وصوتك.</p>
      <input class="av-in" data-twname placeholder="اسم الشخص" value="${twe(A.name || "")}" maxlength="80">
      <label class="av-chk"><input type="checkbox" data-twok ${A.ok ? "checked" : ""}> أؤكد أن هذا أنا، أو أن لديّ إذنًا صريحًا من الشخص</label>
      <div class="av-acts"><button type="button" class="nb-btn" data-twback>‹ رجوع</button><button type="button" class="nb-btn fs-go" data-twcreate>متابعة</button></div></div>`;
  if (A.step === "voice") return `<div class="av-block"><h4>صوت ${twe(A.name)}</h4>
      <p class="muted">${A.from === "video" ? "✓ سيُستنسخ صوته من الفيديو. إن كان صوت الفيديو غير واضح، سجّل الصوت وحده في مكان هادئ." : "اقرأ النص بصوتك الطبيعي في مكان هادئ (نصف دقيقة على الأقل)، لكي يتكلم الأفاتار بصوتك."}</p>
      ${(tw.kit?.voice_script || []).length ? `<details ${A.from === "video" ? "" : "open"}><summary>النص الذي تقرؤه</summary><ol class="av-lines">${tw.kit.voice_script.map((l) => `<li dir="auto">${twe(l)}</li>`).join("")}</ol></details>` : ""}
      <div class="av-acts"><button type="button" class="nb-btn" data-twrec>${tw.rec ? "⏹ أوقف التسجيل وارفعه" : "🎙️ سجّل الآن"}</button>
        <label class="nb-btn">ارفع تسجيلًا<input type="file" accept="audio/*,video/*" data-twup="voice" hidden></label>
        <button type="button" class="nb-btn fs-go" data-twdone>${A.from === "video" ? "✓ تم" : "تخطَّ الآن"}</button></div>
      ${tw.busy ? `<p class="muted">⏳ ${twe(tw.busy)}</p>` : ""}</div>`;
  const lines = (tw.kit?.video_script || []).map((l) => `<li dir="auto">${twe(l)}</li>`).join("");
  return `<div class="av-block"><h4>${twe(A.name)}: اختر طريقة واحدة</h4>
      <div class="av-ways"><div><b>🎬 فيديو وأنت تقرأ هذا النص</b><small class="muted">دقيقة تقريبًا، أمام الكاميرا، والضوء أمامك. أفضل نتيجة.</small>
          ${lines ? `<details><summary>النص الذي تقرؤه</summary><ol class="av-lines">${lines}</ol></details>` : ""}
          <label class="nb-btn fs-go">⬆ ارفع الفيديو<input type="file" accept="video/*" data-twup="video" hidden></label></div>
        <div><b>📷 أو صورة أمامية واضحة</b><small class="muted">أسرع، لكن الحركة أقل طبيعية.</small>
          <label class="nb-btn">⬆ ارفع الصورة<input type="file" accept="image/*" data-twup="photo" hidden></label></div></div>
      <div class="av-acts"><button type="button" class="nb-btn" data-twback>‹ رجوع</button></div>
      ${tw.busy ? `<p class="muted">⏳ ${twe(tw.busy)}</p>` : ""}</div>`;
}

async function twUpload(kind, file) {
  const tid = tw.make?.tid || tw.cur;
  if (!tid) return;
  const f = new FormData();
  if (kind === "photo") f.append("angle", "front");
  if (kind === "background") f.append("name", "مكاني");
  f.append("file", file);
  tw.busy = { photo: "جارٍ رفع الصورة…", video: "جارٍ رفع الفيديو وتجهيزه…", voice: "جارٍ رفع الصوت…", background: "جارٍ رفع المكان…" }[kind];
  twRender();
  try {
    await api(TW(`/${tid}/${kind}`), { method: "POST", body: f });
    if (tw.make && (kind === "photo" || kind === "video")) tw.make = { ...tw.make, step: "voice", from: kind };
    else if (tw.make && kind === "voice") { tw.cur = tw.make.tid; tw.make = null; toast("✓ الأفاتار جاهز"); }
    tw.busy = "";
    await twInit();
  } catch (err) { tw.busy = ""; twRender(); toast(err.message, true); }
}

async function twRecord() {
  if (tw.rec) { tw.rec.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream), parts = [];
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
    rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); tw.rec = null; twUpload("voice", new File(parts, "voice.webm", { type: rec.mimeType || "audio/webm" })); };
    rec.start(); tw.rec = rec; twRender();
  } catch { toast("تعذّر الوصول إلى الميكروفون. ارفع تسجيلًا بدلًا من ذلك", true); }
}

async function twClick(e) {
  const q = (s) => e.target.closest(s);
  let b;
  if ((b = q("[data-twpick]"))) { tw.make = null; tw.cur = b.dataset.twpick; return twRender(); }
  if (q("[data-twnew]")) { tw.make = {}; return twRender(); }
  if (q("[data-twback]")) { tw.make = null; return twRender(); }
  if (q("[data-twdone]")) { tw.cur = tw.make?.tid || tw.cur; tw.make = null; toast("✓ الأفاتار جاهز"); return twInit(); }
  if (q("[data-twrec]")) return twRecord();
  if (q("[data-twcreate]")) {
    const A = tw.make || {};
    if (!(A.name || "").trim()) return toast("اكتب اسم الشخص", true);
    if (!A.ok) return toast("يجب أن تؤكد أن هذا أنت، أو أن لديك إذنًا صريحًا من الشخص", true);
    try { const t = await api(TW(), { method: "POST", ...jsonBody({ name: A.name.trim(), consent: true }) }); tw.make = { ...A, tid: t.id }; } catch (err) { toast(err.message, true); }
    return twRender();
  }
  if ((b = q("[data-twdel]"))) {
    if (!(await uiConfirm("حذف هذا الأفاتار نهائيًا؟ لن يظهر في قالب الأفاتار ولا في الأوتوبايلوت."))) return;
    try { await api(TW(`/${b.dataset.twdel}`), { method: "DELETE" }); tw.cur = null; await twInit(); } catch (err) { toast(err.message, true); }
    return;
  }
  if ((b = q("[data-twbgdel]"))) {
    try { await api(TW(`/${tw.cur}/background/${b.dataset.twbgdel}`), { method: "DELETE" }); await twInit(); } catch (err) { toast(err.message, true); }
  }
}

function twChange(e) {
  if (e.target.matches("[data-twok]")) { tw.make = { ...(tw.make || {}), ok: e.target.checked }; return; }
  const k = e.target.dataset?.twup, f = e.target.files?.[0];
  if (k && f) { e.target.value = ""; twUpload(k, f); }
}
