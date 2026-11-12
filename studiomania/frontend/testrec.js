// ⏺️ وضع تسجيل التجربة: حساب إيميله فيه «+rec» ← أول ما البرنامج يفتح بيظهر سؤال واحد «نبدأ التسجيل؟»، وبعد موافقة المتصفح
// بيتسجل: الشاشة (التاب) + صوت التاب/الجهاز + المايك + صوت سعاد من المكالمة نفسها. «إيقاف وحفظ» ← الملف ينزل على الجهاز ويترفع للسيرفر.
const TestRec = (() => {
  const S = { rec: null, chunks: [], t0: 0, ctx: null, dest: null, streams: [], timer: 0, suad: new Set() };
  const CSS = `
.tr-ask{border:0;padding:0;background:transparent;direction:rtl}.tr-ask::backdrop{background:rgba(0,0,0,.55)}
.tr-ask>div{background:#fff;color:#181718;border-radius:20px;padding:22px 24px;max-width:min(92vw,420px);display:flex;flex-direction:column;gap:12px;text-align:center;font-size:15px;line-height:1.7}
.tr-ask b{font-size:18px}.tr-ask button{border:0;border-radius:999px;padding:12px 20px;font:inherit;font-weight:600;cursor:pointer}
.tr-ask .go{background:#d9342b;color:#fff}.tr-ask .no{background:#eee;color:#181718}
.tr-bar{position:fixed;left:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:5000;display:flex;align-items:center;gap:10px;background:#181718;color:#fff;border-radius:999px;padding:8px 10px 8px 14px;font-size:13.5px;direction:rtl;box-shadow:0 10px 26px -10px rgba(0,0,0,.6)}
.tr-bar i{width:10px;height:10px;border-radius:50%;background:#e33;animation:trB 1s infinite}
.tr-bar button{border:0;border-radius:999px;background:#d9342b;color:#fff;font:inherit;font-weight:600;padding:6px 12px;cursor:pointer}
.tr-bar[hidden]{display:none}
@keyframes trB{50%{opacity:.25}}`;
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  function addAudio(stream) {
    if (!S.ctx || !stream || !stream.getAudioTracks().length) return;
    try { S.ctx.createMediaStreamSource(stream).connect(S.dest); } catch { /* */ }
  }
  async function start() {
    document.querySelector(".tr-ask")?.remove();
    let scr;
    try {
      scr = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 24, displaySurface: "browser" }, audio: { suppressLocalAudioPlayback: false },
        preferCurrentTab: true, selfBrowserSurface: "include", systemAudio: "include", surfaceSwitching: "exclude" });
    } catch { return toast("التسجيل ماشتغلش (لازم توافق على مشاركة الشاشة)"); }
    let mic = null;
    try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch { /* من غير مايك */ }
    S.ctx = new AudioContext(); S.dest = S.ctx.createMediaStreamDestination();
    addAudio(scr); addAudio(mic); S.suad.forEach(addAudio);
    S.streams = [scr, mic].filter(Boolean);
    const out = new MediaStream([...scr.getVideoTracks(), ...S.dest.stream.getAudioTracks()]);
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || "";
    S.chunks = []; S.mime = mime || "video/webm";
    S.rec = new MediaRecorder(out, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 2_500_000 });
    S.rec.ondataavailable = (e) => { if (e.data?.size) S.chunks.push(e.data); };
    S.rec.onstop = save;
    S.rec.start(5000); S.t0 = Date.now();
    scr.getVideoTracks()[0].addEventListener("ended", () => stop());   // وقف المشاركة من المتصفح نفسه = إيقاف وحفظ
    bar(true);
  }
  function stop() { if (S.rec && S.rec.state !== "inactive") S.rec.stop(); }
  async function save() {
    clearInterval(S.timer);
    S.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    try { S.ctx?.close(); } catch { /* */ }
    const blob = new Blob(S.chunks, { type: S.mime });
    const ext = S.mime.includes("mp4") ? "mp4" : "webm";
    const d = new Date(); const name = `test-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}.${ext}`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
    const b = document.querySelector(".tr-bar");
    if (b) { b.querySelector("span").textContent = "⏳ بيترفع…"; b.querySelector("button").hidden = true; b.querySelector("i").hidden = true; }
    try {
      const fd = new FormData(); fd.append("file", blob, name);
      const r = await fetch("/api/testrec/upload", { method: "POST", body: fd, credentials: "same-origin" });
      if (!r.ok) throw new Error();
      toast(`✓ اتحفظ «${name}» على جهازك واترفع. ابعته في الشات.`);
    } catch { toast(`✓ اتحفظ «${name}» على جهازك (الرفع ماكملش). ابعته في الشات.`); }
    S.rec = null; bar(false);
    setTimeout(ask, 1500);   // تجربة جديدة؟
  }
  function bar(on) {
    let b = document.querySelector(".tr-bar");
    if (!b) {
      b = document.createElement("div"); b.className = "tr-bar"; b.dataset.noI18n = "";
      b.innerHTML = `<i></i><span></span><button type="button">إيقاف وحفظ</button>`;
      b.querySelector("button").onclick = stop;
      document.body.append(b);
    }
    b.hidden = !on;
    if (!on) return;
    b.querySelector("i").hidden = false; b.querySelector("button").hidden = false;
    const tick = () => { b.querySelector("span").textContent = `بيسجّل ${fmt((Date.now() - S.t0) / 1000)}`; };
    tick(); clearInterval(S.timer); S.timer = setInterval(tick, 1000);
  }
  function toast(t) {
    const d = document.createElement("div"); d.className = "tr-bar"; d.style.bottom = "70px"; d.textContent = t; document.body.append(d);
    setTimeout(() => d.remove(), 7000);
  }
  function ask() {
    if (S.rec || document.querySelector(".tr-ask")) return;
    // <dialog> مفتوح بـ showModal بيبقى فوق أي نافذة تانية (زي نافذة الترحيب)
    const d = document.createElement("dialog"); d.className = "tr-ask"; d.dataset.noI18n = "";
    d.innerHTML = `<div><b>⏺️ حساب تجربة</b><span>نبدأ تسجيل الشاشة والصوت (صوتك وصوت سعاد)؟ لما تخلّص دوس «إيقاف وحفظ» تحت على الشمال.</span>
      <button type="button" class="go">ابدأ التسجيل</button><button type="button" class="no">مش دلوقتي</button></div>`;
    d.querySelector(".go").onclick = start;   // ضغطة الزرار لازمة: المتصفح مابيسمحش بتسجيل الشاشة من غير ما المستخدم يدوس
    d.querySelector(".no").onclick = () => d.remove();
    d.addEventListener("cancel", (e) => e.preventDefault());
    document.body.append(d); d.showModal();
  }
  window.addEventListener("suad-audio", (e) => { S.suad.add(e.detail); addAudio(e.detail); });
  async function mount() {
    try {
      const r = await fetch("/api/testrec", { credentials: "same-origin" });
      if (!r.ok || !(await r.json()).on) return;
    } catch { return; }
    if (!navigator.mediaDevices?.getDisplayMedia) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    ask();
    window.addEventListener("beforeunload", (e) => { if (S.rec) { e.preventDefault(); e.returnValue = ""; } });   // التسجيل يضيع لو الصفحة اتقفلت
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
  return { start, stop };
})();
