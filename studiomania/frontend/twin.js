// 🪞 «الأفاتار»: نسخة من أي شخص (انت أو حد معاك إذنه) من تسجيلات حقيقية ليه.
// ١) فيديو وهو بيقرا سكريبت إحنا مدينهوله (بنركّب عليه أي كلام جديد بعدين) ٢) صور من كذا اتجاه ٣) صوته لوحده ٤) فيديوهات جديدة بيه.
const tw = { list: [], cur: null, kit: null, timer: null, rec: null };
const twe = (v) => escapeHtml(v == null ? "" : String(v));
const TW = (p = "") => `/api/twins${p}`;
const twSec = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.round((s || 0) % 60)).padStart(2, "0")}`;

// 🪞 صفحة «الأفاتار» بالشكل الجديد (زي «الشخصيات»): كروت لكل أفاتار، وجوه كل واحد خطواته
const AvatarPage = {
  html: () => `<div class="nb-wrap" id="twMain"><div class="nh-empty">جارٍ التحميل…</div></div>`,
  mount(root) { const el = root.querySelector("#twMain"); if (!el) return; twBind(el); twInit(); },
  back() { if (!tw.cur) return false; tw.cur = null; twRender(); return true; },
  close() { clearTimeout(tw.timer); if (tw.rec) tw.rec.mr.stop(); },
};

async function twInit() {
  try {
    [tw.list, tw.kit] = await Promise.all([api(TW()), tw.kit ? tw.kit : api(`/api/twin-kit?lang=${window.I18N?.lang === "en" ? "en" : "ar"}`)]);
  } catch (err) { return toast(err.message, true); }
  if (tw.cur) tw.cur = tw.list.find((x) => x.id === tw.cur.id) || null;
  twRender();
  twPoll();
}

function twRender() {
  const el = $("twMain");
  if (!el) return;
  if (tw.cur) { setHTML(el, twBody(tw.cur)); return; }
  const card = (t, i) => `<div class="ch-card as-card" data-twopen="${t.id}" tabindex="0" role="button">
      <div class="as-art tw-art" style="background: linear-gradient(170deg, ${["#EFE7E1", "#E4E9EF", "#E3EDE4", "#EFE4E9"][i % 4]}, ${["#D9CCC2", "#C8D1DB", "#C6D6C8", "#D9C5CF"][i % 4]})">
        ${(t.photos || [])[0]?.url ? `<img src="${twe(t.photos[0].url)}" alt="" loading="lazy">` : `<span class="tw-ph">🪞</span>`}</div>
      <b data-no-i18n>${twe(t.name)}</b>
      <small>${t.ready.video ? "🎬" : "○"} ${t.ready.photos}/${t.ready.angles} 📷 ${t.ready.voice ? "🎙️" : "○"}</small></div>`;
  setHTML(el, `${tw.adding ? `<section class="nh-panel nb-card ch-new"><form class="tw-new" data-twnew>
        <div class="nb-row"><label class="nb-f"><span>اسم الشخص</span><input name="name" required maxlength="80" placeholder="مثلًا: أنا، أو سارة"></label></div>
        <label class="tw-consent"><input type="checkbox" name="consent" required> هذا أنا، أو لدي إذن صريح من الشخص بإنشاء نسخة منه</label>
        <div class="nb-row"><button class="nb-btn">حفظ</button><button type="button" class="nb-btn danger" data-twnewx>إلغاء</button></div></form></section>` : ""}
    <p class="nb-hint">أفاتار لأي شخص: أنت، أو شخص آخر لديك إذنه. يُنشأ من تسجيلات حقيقية له (وجهه وحركته وملابسه وصوته)، لتصنع به فيديوهات بكلام جديد. يمكنك إنشاء أكثر من أفاتار.</p>
    <div class="as-sh"><h2>الأفاتار <span>(${tw.list.length})</span></h2></div>
    <div class="ch-grid as-grid">${tw.list.map(card).join("")}<button type="button" class="as-new" data-twadd><span>＋</span>أفاتار جديد</button></div>`);
  if (tw.adding) el.querySelector("[data-twnew] input[name=name]")?.focus();
}

function twTips(k) { return `<ul class="tw-tips">${(tw.kit?.tips?.[k] || []).map((x) => `<li>${twe(x)}</li>`).join("")}</ul>`; }

function twBody(t) {
  const k = tw.kit || {}, r = t.ready;
  const step = (n, done, title, body) => `<details class="nh-panel nb-card tw-step${done ? " done" : ""}" ${done ? "" : "open"}><summary><i class="num">${done ? "✓" : n}</i><b>${title}</b></summary>${body}</details>`;
  const video = step(1, r.video, "🎬 فيديو وأنت تقرأ النص", `
    <p class="hint">هذا أهم تسجيل: نركّب عليه أي نص جديد لاحقًا، فيكون الوجه والحركة والملابس والمكان لك أنت بالضبط.</p>${twTips("video")}
    <div class="tw-script" dir="auto">${(k.video_script || []).map((l) => `<p class="${/^\(/.test(l) ? "muted" : ""}">${twe(l)}</p>`).join("")}</div>
    <div class="row wrap"><button type="button" class="nb-btn fs-go" data-twcam="video">📹 سجّل بالكاميرا (يتحرك النص أمامك)</button>
      <label class="nb-btn">⬆ ارفع فيديو<input type="file" accept="video/*" data-twup="video" hidden></label></div>
    ${t.video_url ? `<video class="tw-vid" src="${t.video_url}" controls playsinline preload="metadata"></video><small class="muted">⏱ ${twSec(t.video.duration)} · ${t.video.w}×${t.video.h}</small>` : ""}`);
  const have = Object.fromEntries((t.photos || []).map((p) => [p.angle, p]));
  const photos = step(2, r.photos >= 3 && r.photo, `📷 صور من عدة اتجاهات <small class="muted num">${r.photos}/${r.angles}</small>`, `
    <p class="hint">الصورة الأمامية إلزامية (نصنع منها فيديو إن لم يوجد فيديو قراءة)، والباقي يجعل النسخة أدق.</p>${twTips("photos")}
    <div class="tw-angles">${(k.angles || []).map((a) => `<div class="tw-angle${have[a.id] ? " on" : ""}">
      ${have[a.id] ? `<img src="${have[a.id].url}" alt=""><button type="button" class="tw-x" data-twdelph="${a.id}" title="أزلها">✕</button>` : `<span class="tw-ph">📷</span>`}
      <b>${twe(a.label)}</b><span class="row"><button type="button" class="nb-btn sm" data-twcam="photo:${a.id}">📸</button>
      <label class="nb-btn sm">⬆<input type="file" accept="image/*" data-twup="photo:${a.id}" hidden></label></span></div>`).join("")}</div>`);
  const voice = step(3, r.voice, "🎙️ صوتك تلقائيًا", `
    <p class="hint">تسجيل نظيف لصوتك في مكان هادئ. يُحفظ لاستنساخ صوتك (قريبًا)، ويمكنك استخدامه مرجعًا.</p>${twTips("voice")}
    <div class="tw-script" dir="auto">${(k.voice_script || []).map((l) => `<p>${twe(l)}</p>`).join("")}</div>
    <div class="row wrap"><button type="button" class="nb-btn fs-go" data-twmic="voice">${tw.rec?.kind === "voice" ? "⏹ أوقف واحفظ" : "🎙️ سجّل"}</button>
      <label class="nb-btn">⬆ ارفع تسجيلًا<input type="file" accept="audio/*" data-twup="voice" hidden></label>
      ${tw.rec?.kind === "voice" ? `<b class="tw-live num" data-twt>0:00</b>` : ""}</div>
    ${t.voice_url ? `<audio src="${t.voice_url}" controls preload="metadata"></audio><small class="muted">⏱ ${twSec(t.voice.duration)}</small>` : ""}`);
  const places = step(4, r.backgrounds > 0, `🏠 أماكن التصوير <small class="muted num">${r.backgrounds || 0}</small>`, `
    <p class="hint">صوّر المكان الذي تصوّر فيه فيديوهاتك وهو فارغ. عندما تصوّر فيديو وتختار «صوّرت هنا»، تظهر اللقطات المساندة التي يصنعها البرنامج لك في المكان نفسه.</p>${twTips("backgrounds")}
    <div class="tw-angles">${(t.backgrounds || []).map((b) => `<div class="tw-angle on"><img src="${b.url}" alt=""><button type="button" class="tw-x" data-twdelbg="${twe(b.id)}" title="أزلها">✕</button><b>${twe(b.name)}</b></div>`).join("")}</div>
    <div class="row wrap"><input class="input" data-twbgname placeholder="اسم المكان (المكتب، المطبخ…)" maxlength="60">
      <label class="nb-btn fs-go">📸 صوّر أو ارفع صورة المكان<input type="file" accept="image/*" capture="environment" data-twup="background" hidden></label></div>`);
  const c = t.cost || {}, sec = (key) => `≈ ${Math.max(1, Math.round((c[key] || 0) * 3 / 0.01))} نقطة/ث`;
  const make = `<div class="nh-panel nb-card tw-step tw-make"><div class="tw-mh"><i class="num">5</i><b>🎥 أنشئ فيديو بالأفاتار</b></div>
    <p class="hint">قل النص الجديد بصوتك (سجّله هنا أو ارفعه)، ويركّبه البرنامج على شفتيك في فيديو القراءة، أو يجعل صورتك تتكلم. استنساخ الصوت (تكتب النص فيُقال بصوتك) سيُضاف عندما نصل خدمة الاستنساخ.</p>
    <form class="tw-form" data-twmake>
      <label>الشكل <select name="method"><option value="video" ${r.video ? "" : "disabled"}>🎬 فيديو القراءة الخاص بك (الأدق)</option><option value="photo" ${r.photo ? "" : "disabled"} ${!r.video && r.photo ? "selected" : ""}>📷 من صورتك الأمامية</option></select></label>
      <label>الجودة <select name="quality" data-twq>
        <optgroup label="فيديو القراءة"><option value="veed">عادي · ${sec("video:veed")}</option><option value="sync">احترافي · ${sec("video:sync")}</option></optgroup>
        <optgroup label="الصورة"><option value="std">عادي · ${sec("photo:std")}</option><option value="pro">عالي · ${sec("photo:pro")}</option></optgroup></select></label>
      <label class="wide">ماذا ستقول؟ (اختياري، للتذكير) <textarea name="text" rows="2" dir="auto" placeholder="اكتب النص لتقرأه وأنت تسجّل"></textarea></label>
      <div class="row wrap wide"><button type="button" class="nb-btn" data-twmic="say">${tw.rec?.kind === "say" ? "⏹ أوقف" : "🎙️ سجّل النص"}</button>
        <label class="nb-btn">⬆ ارفع صوتًا<input type="file" accept="audio/*,video/*" data-twsay hidden></label>
        ${tw.rec?.kind === "say" ? `<b class="tw-live num" data-twt>0:00</b>` : tw.say ? `<audio src="${tw.say.url}" controls></audio><small class="muted">${twe(tw.say.name)}</small>` : ""}</div>
      <button class="nb-btn fs-go wide" ${tw.say && (r.video || r.photo) ? "" : "disabled"}>🚀 أنشئ الفيديو</button></form>
    <ul class="tw-clips">${[...(t.clips || [])].reverse().map((x) => `<li class="${x.status}">
      ${x.url ? `<video src="${x.url}" controls playsinline preload="metadata"></video>` : `<span class="tw-ph">${x.status === "failed" ? "⚠️" : "⏳"}</span>`}
      <div><b dir="auto">${twe(x.text || (x.method === "video" ? "على فيديو القراءة" : "من الصورة"))}</b>
        <small class="${x.status === "failed" ? "err" : "muted"}">${x.status === "done" ? `✓ جاهز · ${twSec(x.duration)}${x.credits ? ` · ${x.credits} نقطة` : ""}` : twe(x.error || x.step || "")}</small>
        <span class="row">${x.status === "done" ? `<button type="button" class="nb-btn sm fs-go" data-twtypo="${x.id}">🔤 نص متحرك فوقه (تايبوجرافي)</button><a class="nb-btn sm" href="${x.url}" download>⬇</a>` : ""}
          <button type="button" class="nb-btn sm" data-twdelc="${x.id}">🗑</button></span></div></li>`).join("")}</ul></div>`;
  return `<div class="tw-head"><h2 data-no-i18n>${twe(t.name)}</h2><span class="nb-row"><button type="button" class="nb-btn sm danger" data-twdel>احذف الأفاتار</button><button type="button" class="nb-btn sm" data-twlist>✕ إغلاق</button></span></div>${video}${photos}${places}${voice}${make}`;
}

function twPoll() {
  clearTimeout(tw.timer);
  if (!tw.cur?.busy || !$("twMain")?.isConnected) return;
  tw.timer = setTimeout(async () => {
    try { tw.cur = await api(TW(`/${tw.cur.id}`)); if (!tw.cur.busy) tw.list = await api(TW()); morphing(twRender); } catch { /* الخادم يعيد التشغيل */ }
    twPoll();
  }, 4000);
}

async function twSend(path, form, what) {
  toast(`⏳ جارٍ رفع ${what}…`);
  tw.cur = await api(TW(`/${tw.cur.id}${path}`), { method: "POST", body: form });
  tw.list = await api(TW());
  twRender();
  twPoll();
  toast(`✓ حُفظ ${what}`);
}
function twFile(blob, name) { return new File([blob], name, { type: blob.type }); }

// 🎙️ تسجيل صوت (الصوت لوحده، أو الكلام الجديد)
async function twMic(kind) {
  if (tw.rec) {
    const r = tw.rec;
    if (r.kind !== kind) return;
    r.mr.stop();
    return;
  }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } }); }
  catch { return toast("المتصفح لا يسمح بالميكروفون. اسمح به من جانب شريط العنوان", true); }
  const parts = [], mr = new MediaRecorder(stream), t0 = Date.now();
  mr.ondataavailable = (e) => e.data.size && parts.push(e.data);
  mr.onstop = async () => {
    stream.getTracks().forEach((x) => x.stop());
    clearInterval(tw.rec?.tick);
    tw.rec = null;
    const blob = new Blob(parts, { type: mr.mimeType || "audio/webm" });
    if (Date.now() - t0 < 1500) { twRender(); return toast("التسجيل قصير جدًا", true); }
    const file = twFile(blob, `rec-${Date.now()}.webm`);
    if (kind === "voice") { const f = new FormData(); f.append("file", file); try { await twSend("/voice", f, "التسجيل"); } catch (err) { twRender(); toast(err.message, true); } }
    else { tw.say = { file, url: URL.createObjectURL(blob), name: "🎙️ تسجيل جديد" }; twRender(); }
  };
  mr.start(1000);
  tw.rec = { kind, mr, tick: setInterval(() => { const el = document.querySelector("[data-twt]"); if (el) el.textContent = twSec((Date.now() - t0) / 1000); }, 500) };
  twRender();
}

// 📹 الكاميرا: فيديو القراية (والسكريبت بيتحرك فوق الصورة زي التليبرومبتر) أو صورة لاتجاه
async function twCam(mode) {
  let stream;
  const isVideo = mode === "video";
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1080 }, height: { ideal: 1920 }, facingMode: "user" }, audio: isVideo });
  } catch { return toast("المتصفح لا يسمح بالكاميرا. اسمح بها من جانب شريط العنوان", true); }
  const angle = isVideo ? null : mode.split(":")[1];
  const label = angle ? (tw.kit.angles.find((a) => a.id === angle)?.label || "") : "";
  const ov = Object.assign(document.createElement("div"), { className: "tw-cam" });
  ov.innerHTML = `<div class="tw-cam-box"><video autoplay muted playsinline></video>
    ${isVideo ? `<div class="tw-prompter" dir="auto"><div>${tw.kit.video_script.map((l) => `<p>${twe(l)}</p>`).join("")}</div></div>` : `<div class="tw-cam-label">${twe(label)}</div>`}
    <div class="tw-cam-bar">${isVideo ? `<label class="muted">سرعة النص <input type="range" min="10" max="80" value="32" data-sp></label><b class="num" data-tm>0:00</b>
      <button type="button" class="nb-btn fs-go" data-go>⏺ ابدأ</button>` : `<button type="button" class="nb-btn fs-go" data-snap>📸 صوّر</button>`}
      <button type="button" class="nb-btn" data-x>إلغاء</button></div></div>`;
  document.body.appendChild(ov);
  const vid = ov.querySelector("video");
  vid.srcObject = stream;
  let mr = null, raf = 0, tick = 0;
  const close = () => { cancelAnimationFrame(raf); clearInterval(tick); stream.getTracks().forEach((x) => x.stop()); ov.remove(); };
  ov.querySelector("[data-x]").onclick = () => { if (mr && mr.state !== "inactive") { mr.onstop = null; mr.stop(); } close(); };
  if (!isVideo) {
    ov.querySelector("[data-snap]").onclick = () => {
      const c = document.createElement("canvas");
      c.width = vid.videoWidth; c.height = vid.videoHeight;
      c.getContext("2d").drawImage(vid, 0, 0);
      c.toBlob(async (b) => { close(); const f = new FormData(); f.append("angle", angle); f.append("file", twFile(b, `${angle}.jpg`)); try { await twSend("/photo", f, "الصورة"); } catch (err) { toast(err.message, true); } }, "image/jpeg", 0.92);
    };
    return;
  }
  const pr = ov.querySelector(".tw-prompter > div"), go = ov.querySelector("[data-go]");
  go.onclick = () => {
    if (mr) { mr.stop(); return; }
    const parts = [], t0 = Date.now();
    mr = new MediaRecorder(stream);
    mr.ondataavailable = (e) => e.data.size && parts.push(e.data);
    mr.onstop = async () => {
      const blob = new Blob(parts, { type: mr.mimeType || "video/webm" });
      close();
      if (Date.now() - t0 < 5000) return toast("التسجيل قصير جدًا", true);
      const f = new FormData(); f.append("file", twFile(blob, `read-${Date.now()}.webm`));
      try { await twSend("/video", f, "الفيديو"); } catch (err) { toast(err.message, true); }
    };
    mr.start(1000);
    go.textContent = "⏹ أوقف واحفظ";
    let y = 0, last = performance.now();
    const step = (now) => { y += (now - last) / 1000 * Number(ov.querySelector("[data-sp]").value); last = now; pr.style.transform = `translateY(${-y}px)`; raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    tick = setInterval(() => { ov.querySelector("[data-tm]").textContent = twSec((Date.now() - t0) / 1000); }, 500);
  };
}

function twBind(el) {
  if (el.dataset.bound) return;
  el.dataset.bound = "1";
  el.addEventListener("click", async (e) => {
    const t = e.target, v = tw.cur;
    if (t.closest("[data-twadd]")) { tw.adding = true; return twRender(); }
    if (t.closest("[data-twnewx]")) { tw.adding = false; return twRender(); }
    if (t.closest("[data-twlist]")) { tw.cur = null; clearTimeout(tw.timer); return twRender(); }
    const op = t.closest("[data-twopen]");
    if (op) { tw.cur = tw.list.find((x) => x.id === op.dataset.twopen); tw.say = null; twRender(); return twPoll(); }
    const cam = t.closest("[data-twcam]");
    if (cam) return twCam(cam.dataset.twcam);
    const mic = t.closest("[data-twmic]");
    if (mic) return twMic(mic.dataset.twmic);
    try {
      if (t.closest("[data-twdel]")) {
        if (!(await uiConfirm(`أتحذف نسخة «${v.name}» بكل تسجيلاتها وفيديوهاتها؟`))) return;
        await api(TW(`/${v.id}`), { method: "DELETE" }); tw.cur = null; return twInit();
      }
      const dp = t.closest("[data-twdelph]");
      if (dp) { tw.cur = await api(TW(`/${v.id}/photo/${dp.dataset.twdelph}`), { method: "DELETE" }); return twRender(); }
      const db = t.closest("[data-twdelbg]");
      if (db) { tw.cur = await api(TW(`/${v.id}/background/${db.dataset.twdelbg}`), { method: "DELETE" }); return twRender(); }
      const dc = t.closest("[data-twdelc]");
      if (dc) { if (!(await uiConfirm("هل تحذف هذا الفيديو؟"))) return; tw.cur = await api(TW(`/${v.id}/clips/${dc.dataset.twdelc}`), { method: "DELETE" }); return twRender(); }
      const ty = t.closest("[data-twtypo]");
      if (ty) {
        const p = await api(TW(`/${v.id}/clips/${ty.dataset.twtypo}/typo`), { method: "POST" });
        toast("🔤 أُرسل إلى التايبوجرافي، ويُكتب النص بتوقيته");
        storageSet("studiomania.typo", p.id);
        if (typeof tyx !== "undefined") tyx.cur = null;
        return showStep("12");
      }
    } catch (err) { toast(err.message, true); }
  });
  el.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.matches("[data-twsay]") && t.files[0]) { const file = t.files[0]; tw.say = { file, url: URL.createObjectURL(file), name: file.name }; t.value = ""; return twRender(); }
    if (t.matches("[data-twq]")) return;
    if (!t.matches("[data-twup]") || !t.files[0]) return;
    const [kind, angle] = t.dataset.twup.split(":"), f = new FormData();
    f.append("file", t.files[0]);
    if (angle) f.append("angle", angle);
    if (kind === "background") f.append("name", el.querySelector("[data-twbgname]")?.value || "");
    t.value = "";
    try { await twSend(kind === "photo" ? "/photo" : `/${kind}`, f, kind === "video" ? "الفيديو" : kind === "photo" || kind === "background" ? "الصورة" : "التسجيل"); } catch (err) { toast(err.message, true); }
  });
  el.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      if (form.matches("[data-twnew]")) {
        const t = await api(TW(), { method: "POST", ...jsonBody({ name: form.elements.name.value, consent: form.elements.consent.checked }) });
        tw.cur = t; tw.adding = false; tw.list = await api(TW()); return twRender();
      }
      if (form.matches("[data-twmake]")) {
        if (!tw.say) return toast("سجّل النص أو ارفعه أولًا", true);
        const method = form.elements.method.value;
        let quality = form.elements.quality.value;
        if (method === "video" && !["veed", "sync"].includes(quality)) quality = "veed";
        if (method === "photo" && !["std", "pro"].includes(quality)) quality = "pro";
        const f = new FormData();
        f.append("method", method); f.append("quality", quality); f.append("text", form.elements.text.value); f.append("audio", tw.say.file);
        tw.cur = await api(TW(`/${tw.cur.id}/clips`), { method: "POST", body: f });
        tw.say = null;
        twRender(); twPoll();
        toast("⏳ يُنشأ الفيديو، وسيظهر في الأسفل عند انتهائه");
      }
    } catch (err) { toast(err.message, true); }
  });
}
