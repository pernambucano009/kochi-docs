// 🦷 قوالب الأسنان (نسخة تجريبية): الطبيب يرفع صور حالة حقيقية ← البرنامج يصنّفها ويحللها ويجهز العناصر
// ← الطبيب يوافق على الصور اللي فيها وش المريض ← يختار قالب ← فيديو. كل الخطوات التقيلة على السيرفر في طابور.
(() => {
  const css = `
.dn{position:fixed;inset:0;z-index:2147482000;display:flex;flex-direction:column;background:var(--dn-bg);color:var(--dn-ink);
  --dn-bg:#F7F6F3;--dn-card:#fff;--dn-ink:#1b1b1f;--dn-mute:#6b6b72;--dn-line:rgba(0,0,0,.09);--dn-acc:#E5613E;--dn-ok:#2E8B57;--dn-bad:#D9443A;
  font-family:inherit;direction:rtl;animation:dnIn .25s ease}
:root[data-nh-theme="dark"] .dn{--dn-bg:#141417;--dn-card:#1f1f24;--dn-ink:#f2f2f2;--dn-mute:#a3a3ab;--dn-line:rgba(255,255,255,.1)}
.dn-top{display:flex;align-items:center;gap:12px;padding:14px max(16px,env(safe-area-inset-right)) 12px;border-bottom:1px solid var(--dn-line)}
.dn-top h2{margin:0;font-size:18px;flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px}.dn-top h2 span.t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.dn-top .beta{font-size:11px;font-weight:500;padding:2px 8px;border-radius:99px;background:rgba(229,97,62,.12);color:var(--dn-acc);white-space:nowrap}
@media (max-width:520px){.dn-top h2{font-size:16px}}
.dn-x,.dn-back{border:0;background:var(--dn-card);color:inherit;border-radius:999px;padding:8px 14px;font:inherit;cursor:pointer;box-shadow:0 0 0 1px var(--dn-line)}
.dn-body{flex:1;overflow:auto;padding:18px 16px 40px}
.dn-wrap{max-width:980px;margin:0 auto;display:grid;gap:16px}
.dn-card{background:var(--dn-card);border-radius:18px;padding:16px;box-shadow:0 0 0 1px var(--dn-line)}
.dn-card h3{margin:0 0 6px;font-size:16px}.dn-card p{margin:0;color:var(--dn-mute);font-size:14px;line-height:1.7}
.dn-shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-top:12px}
.dn-shot{border-radius:14px;padding:10px 12px;background:var(--dn-bg);font-size:13px;line-height:1.6}
.dn-shot b{display:block;font-size:14px}.dn-shot.ok b::before{content:"✓ ";color:var(--dn-ok)}.dn-shot.miss b::before{content:"✗ ";color:var(--dn-bad)}
.dn-drop{display:block;margin-top:12px;border:2px dashed var(--dn-line);border-radius:16px;padding:22px;text-align:center;cursor:pointer;color:var(--dn-mute)}
.dn-drop.on{border-color:var(--dn-acc);color:var(--dn-acc)}
.dn-thumbs{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.dn-thumbs img{width:76px;height:76px;object-fit:cover;border-radius:10px}
.dn-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:12px}
.dn-in{flex:1;min-width:180px;padding:10px 12px;border-radius:12px;border:1.5px solid var(--dn-line);background:var(--dn-bg);color:inherit;font:inherit}
.dn-btn{border:0;border-radius:999px;padding:10px 20px;font:inherit;cursor:pointer;background:var(--dn-acc);color:#fff;box-shadow:0 8px 20px rgba(229,97,62,.25)}
.dn-btn.ghost{background:var(--dn-bg);color:inherit;box-shadow:0 0 0 1px var(--dn-line)}.dn-btn.bad{background:var(--dn-bad);box-shadow:none}
.dn-btn:disabled{opacity:.45;cursor:default}
.dn-ck{display:flex;gap:8px;align-items:flex-start;font-size:13px;line-height:1.7;margin-top:12px;color:var(--dn-mute)}
.dn-list{display:grid;gap:8px;margin-top:10px}
.dn-pk{display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:14px;background:var(--dn-bg);border:0;color:inherit;font:inherit;text-align:start;width:100%;cursor:pointer;box-shadow:0 0 0 1px var(--dn-line)}
.dn-pk:hover:not(:disabled){box-shadow:0 0 0 2px var(--dn-acc)}
.dn-pk b{display:block;font-size:15px}.dn-pk small{display:block;color:var(--dn-mute);font-size:13px;line-height:1.6}
.dn-pk:disabled{cursor:not-allowed;opacity:.62}.dn-pk:disabled small{color:var(--dn-bad)}.dn-pk .ic{font-size:20px;width:26px;text-align:center}
.dn-out{display:grid;gap:12px;justify-items:center}.dn-out img{max-width:min(100%,460px);border-radius:16px;box-shadow:0 0 0 1px var(--dn-line)}
.dn-case{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;background:var(--dn-bg);cursor:pointer;border:0;color:inherit;font:inherit;text-align:start}
.dn-case b{flex:1}.dn-case small{color:var(--dn-mute)}
.dn-job{display:flex;gap:10px;align-items:center;padding:12px 14px;border-radius:14px;background:rgba(229,97,62,.08);font-size:14px}
.dn-job.bad{background:rgba(217,68,58,.1)}.dn-spin{width:16px;height:16px;border-radius:50%;border:2px solid currentColor;border-inline-end-color:transparent;animation:dnSpin .8s linear infinite;flex:none}
.dn-rev{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-top:12px}
.dn-rev figure{margin:0;background:var(--dn-bg);border-radius:14px;padding:10px;display:grid;gap:8px}
.dn-rev img{width:100%;max-height:360px;object-fit:contain;border-radius:10px;background:#000}
.dn-full{font-size:12px;color:var(--dn-acc);justify-self:start}.dn-rev figcaption{font-size:13px;line-height:1.7;color:var(--dn-mute)}.dn-st{font-size:12px;font-weight:600}
.dn-st.ok{color:var(--dn-ok)}.dn-st.bad{color:var(--dn-bad)}
.dn-tpls{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:12px}
.dn-tpl{background:var(--dn-bg);border-radius:14px;padding:12px;display:grid;gap:8px;align-content:start}
.dn-tpl b{font-size:15px}.dn-tpl p{font-size:13px}.dn-tpl video{width:100%;border-radius:10px;background:#000;aspect-ratio:9/16;max-height:420px}
.dn-need{margin-top:12px;padding:12px 14px;border-radius:14px;background:rgba(217,68,58,.07);display:grid;gap:10px}
.dn-need b{font-size:14px}.dn-need p{font-size:13px}
.dn-pics{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:10px}
.dn-pic{margin:0;display:grid;gap:4px;font-size:12px;color:var(--dn-mute);text-align:center}
.dn-pic img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;background:var(--dn-bg)}
.dn-pic.used b{color:var(--dn-ok);font-weight:600}.dn-pic button{border:0;border-radius:999px;padding:6px 10px;font:inherit;font-size:12px;cursor:pointer;background:var(--dn-acc);color:#fff}
.dn-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:14px}
.dn-slot{position:relative;display:grid;gap:6px;align-content:start;padding:12px;border-radius:16px;background:var(--dn-bg);border:2px dashed var(--dn-line);cursor:pointer;transition:border-color .15s}
.dn-slot:hover,.dn-slot.on,.dn-slot:focus-within{border-color:var(--dn-acc)}.dn-slot.done{border-style:solid;border-color:var(--dn-ok)}
.dn-slot .art{position:relative;aspect-ratio:4/3;border-radius:12px;overflow:hidden;background:#fff;display:grid;place-items:center}
:root[data-nh-theme="dark"] .dn-slot .art{background:#2a2a30}
.dn-slot .art svg{width:88%;height:88%}.dn-slot .art img,.dn-slot .art video{width:100%;height:100%;object-fit:cover}
.dn-slot .art.filled svg{position:absolute;bottom:6px;inset-inline-end:6px;width:36%;height:auto;background:rgba(255,255,255,.94);border-radius:10px;padding:3px;box-shadow:0 2px 8px rgba(0,0,0,.25)}
.dn-slot.miss{border-style:solid;border-color:var(--dn-bad)}.dn-slot.miss .act{color:var(--dn-bad)}.dn-slot.static{cursor:default}
.dn-slot .req{font-size:11px;font-weight:600;padding:1px 8px;border-radius:99px;background:rgba(229,97,62,.12);color:var(--dn-acc);vertical-align:middle;white-space:nowrap}
.dn-slot .req.opt{background:rgba(127,127,127,.14);color:var(--dn-mute)}.dn-slot.optional{border-style:dashed;border-color:var(--dn-line)}.dn-slot.optional .act{color:var(--dn-mute)}
.dn-bulk{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px;font-size:13px;color:var(--dn-mute)}
.dn-bulk label{cursor:pointer}
.dn-slot .tag{position:absolute;top:8px;inset-inline-start:8px;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700;color:#fff;background:#4a4a52}
.dn-slot .tag.after{background:var(--dn-acc)}
.dn-slot b{font-size:14px}.dn-slot small{font-size:12px;color:var(--dn-mute);line-height:1.6}
.dn-slot .act{font-size:12px;color:var(--dn-acc);font-weight:600}.dn-slot.done .act{color:var(--dn-ok)}
@keyframes dnIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes dnSpin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.dn,.dn-spin{animation:none}}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const call = (p, o) => (window.api ? window.api(p, o) : fetch(p, o).then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.detail || r.status); return d; }));
  const STAGE = { video: "قراءة الفيديو واختيار أوضح لقطة", assign: "تجهيز الصورة التي حددتها وتحليلها", intake: "تصنيف الصور", analysis: "تحليل الأسنان: تحديد كل سن وترقيمه", slots: "تجهيز الصور في خاناتها", elements: "تجهيز الصور المشتقة", render: "إنشاء الفيديو" };
  const stageName = (s) => s?.startsWith("render:") ? `${STAGE.render} (${s.slice(7)})` : (STAGE[s] || s || "");
  let root = null, home = null, cur = null, timer = null, files = [], picked = {}, last = "";
  // 🖼️ رسمة توضيحية لكل صورة مطلوبة (أفاتار أسود): الطبيب يعرف بالظبط يصوّر إيه
  const INK = "#1b1b1f";
  const teethRow = (y, h, n, fill, uneven) => { let o = ""; const w = 84 / n; for (let i = 0; i < n; i++) { const dy = uneven ? [2, -1, 3, 0, -2, 2, 1, -1][i % 8] : 0; o += `<rect x="${38 + i * w + 1}" y="${y + dy}" width="${w - 2}" height="${h - Math.abs(i - (n - 1) / 2) * (h / n / 1.6)}" rx="3" fill="${fill}"/>`; } return o; };
  const ART = {
    ret: (before) => `<svg viewBox="0 0 160 120" aria-hidden="true">
      <ellipse cx="80" cy="62" rx="66" ry="44" fill="${INK}"/>
      <ellipse cx="80" cy="62" rx="50" ry="30" fill="#2c2c33"/>
      <path d="M30 62 q50 -34 100 0" fill="#d98c97" opacity=".85"/><path d="M30 62 q50 30 100 0" fill="#d98c97" opacity=".55"/>
      ${teethRow(44, 18, 8, before ? "#e8d6a4" : "#fff", before)}${teethRow(64, 13, 8, before ? "#ddc994" : "#f4f4f4", before)}
      <path d="M14 30 q-10 32 0 64 M146 30 q10 32 0 64" stroke="#9a9aa3" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M14 30 q30 -8 40 4 M14 94 q30 8 40 -4 M146 30 q-30 -8 -40 4 M146 94 q-30 8 -40 -4" stroke="#9a9aa3" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`,
    face: (before) => `<svg viewBox="0 0 160 120" aria-hidden="true">
      <path d="M30 120 q2 -34 50 -36 q48 2 50 36z" fill="${INK}"/>
      <ellipse cx="80" cy="52" rx="30" ry="36" fill="${INK}"/>
      <path d="M62 62 q18 18 36 0 q-18 6 -36 0z" fill="${before ? "#e8d6a4" : "#fff"}"/>
      <circle cx="68" cy="46" r="3" fill="#fff"/><circle cx="92" cy="46" r="3" fill="#fff"/></svg>`,
    faceret: (before) => `<svg viewBox="0 0 160 120" aria-hidden="true">
      <path d="M30 120 q2 -34 50 -36 q48 2 50 36z" fill="${INK}"/>
      <ellipse cx="80" cy="48" rx="32" ry="38" fill="${INK}"/>
      <circle cx="67" cy="34" r="3.2" fill="#fff"/><circle cx="93" cy="34" r="3.2" fill="#fff"/>
      <ellipse cx="80" cy="62" rx="23" ry="13" fill="#2c2c33"/>
      <path d="M59 58 q21 -9 42 0" fill="#d98c97" opacity=".85"/>
      ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${64.5 + i * 4.5}" y="${57 + (before ? [1, -1, 1, 0, -1, 1, 0][i] : 0)}" width="3.7" height="6.5" rx="1" fill="${before ? "#e8d6a4" : "#fff"}"/>`).join("")}
      ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${67 + i * 4.5}" y="64.5" width="3.7" height="5" rx="1" fill="${before ? "#ddc994" : "#f4f4f4"}"/>`).join("")}
      <path d="M55 50 q-9 12 0 24 M105 50 q9 12 0 24" stroke="#c4c4cc" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M55 50 q6 -4 12 -2 M55 74 q6 4 12 2 M105 50 q-6 -4 -12 -2 M105 74 q-6 4 -12 2" stroke="#c4c4cc" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>`,
    smile: (before) => `<svg viewBox="0 0 160 120" aria-hidden="true">
      <path d="M18 58 q30 -30 62 -18 q32 -12 62 18 q-62 60 -124 0z" fill="${INK}"/>
      <path d="M32 58 q48 -16 96 0 q-48 34 -96 0z" fill="#2c2c33"/>
      ${teethRow(48, 16, 8, before ? "#e8d6a4" : "#fff", before)}
      <path d="M18 58 q62 18 124 0" stroke="${INK}" stroke-width="3" fill="none"/></svg>`,
  };
  const ALT = { before_retracted: "before_face_retracted", after_retracted: "after_face_retracted", after_smile: "after_face", before_smile: "before_face" };
  const altSrc = (slot) => ALT[slot];
  const isVideo = (f) => f.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|avi|3gp)$/i.test(f.name);
  const isMedia = (f) => f.type.startsWith("image/") || isVideo(f) || /\.(jpe?g|png|webp|heic)$/i.test(f.name);
  const artOf = (s) => [s.kind || "ret", s.phase === "before" ? 1 : 0];

  function shell(title, back) {
    if (!root) { root = document.createElement("div"); root.className = "dn"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); document.body.appendChild(root); }
    root.innerHTML = `<div class="dn-top">${back ? `<button class="dn-back" data-dn="home">رجوع</button>` : ""}<h2><span class="t">${esc(title)}</span><span class="beta">نسخة تجريبية</span></h2><button class="dn-x" data-dn="close" aria-label="إغلاق">✕</button></div><div class="dn-body"><div class="dn-wrap"></div></div>`;
    root.onclick = onClick;
    return root.querySelector(".dn-wrap");
  }
  function close() { clearTimeout(timer); clearTimeout(pickTimer); pickT = null; root?.remove(); root = null; cur = null; files = []; }

  async function open() {
    const w = shell("فيديوهات الأسنان من حالاتك");
    w.innerHTML = `<div class="dn-card"><p>جارٍ التحميل…</p></div>`;
    try { home = await call("/api/dental"); } catch (e) { w.innerHTML = `<div class="dn-card"><p>${esc(e.message)}</p></div>`; return; }
    picked = {};
    const slotsHtml = home.shots.map((s) => { const [k, b] = artOf(s);
      return `<label class="dn-slot" data-slot="${esc(s.slot)}"><input type="file" accept="image/*,video/*" hidden><div class="art">${ART[k](b)}<span class="tag${b ? "" : " after"}">${b ? "قبل" : "بعد"}</span></div>
        <b>${esc(s.name)} <span class="req${s.req ? "" : " opt"}">${s.req ? "مطلوبة" : "اختيارية"}</span></b><small>${esc(s.hint)}${s.alt ? `<br>${esc(s.alt.text)}` : ""}</small><span class="act">اضغط أو اسحب صورة أو فيديو هنا</span></label>`; }).join("");
    const cases = home.cases.map((c) => `<button class="dn-case" data-case="${esc(c.id)}"><b>${esc(c.title)}</b><small>${c.job?.status === "running" || c.job?.status === "queued" ? "يعمل الآن…" : c.job?.status === "failed" ? "تحتاج إعادة" : `${c.videos} فيديو`}</small></button>`).join("");
    w.innerHTML = `
      <div class="dn-card"><h3>حالة جديدة</h3>
        <p>ارفع صورة حقيقية في كل خانة كما في الرسمة. الأسنان في الفيديو هي أسنان المريض الحقيقية: لا نبيّض «قبل» ولا نعدّل «بعد».</p>
        <div class="dn-slots">${slotsHtml}</div>
        <p style="margin-top:10px">يمكنك رفع فيديو بدل الصورة في أي خانة: نختار منه أوضح لقطة. وفيديو وجه المريض بعد العلاج يُستخدم كما هو في القوالب التي تعرض المريض متحركًا بدل توليد فيديو.</p>
        <div class="dn-bulk"><span>أو ارفع كل صور الحالة وفيديوهاتها مرة واحدة، وسنضع كل صورة في خانتها:</span>
          <label class="dn-btn ghost">اختر الصور<input type="file" accept="image/*,video/*" multiple hidden data-bulk></label>
          <label class="dn-btn ghost">اختر مجلدًا<input type="file" multiple webkitdirectory hidden data-bulk></label>
          <span data-bulkn></span></div>
        <div class="dn-row"><input class="dn-in" data-title placeholder="اسم الحالة (مثلًا: عدسات — أحمد)" maxlength="80"></div>
        <label class="dn-ck"><input type="checkbox" data-consent> لدي موافقة مكتوبة من المريض على استخدام صوره قبل وبعد في المحتوى.</label>
        <div class="dn-row"><button class="dn-btn" data-dn="create" disabled>ابدأ</button><span class="dn-msg" style="font-size:13px;color:var(--dn-mute)"></span></div>
      </div>
      ${cases ? `<div class="dn-card"><h3>حالاتك</h3><div class="dn-list">${cases}</div></div>` : ""}`;
    w.querySelectorAll(".dn-slot").forEach((box) => {
      const inp = box.querySelector("input"), slot = box.dataset.slot;
      const take = (f) => { if (!f || !isMedia(f)) return; picked[slot] = f;
        const art = box.querySelector(".art"); art.querySelector("img,video")?.remove(); art.classList.add("filled");   // الأفاتار يفضل في الركن
        const vid = isVideo(f), i = vid ? Object.assign(document.createElement("video"), { muted: true, autoplay: true, loop: true, playsInline: true }) : new Image();
        i.src = URL.createObjectURL(f); i.alt = ""; art.prepend(i);
        box.classList.add("done"); box.querySelector(".act").textContent = "✓ تم اختيار الصورة (اضغط للتغيير)"; valid(); };
      inp.onchange = () => take(inp.files[0]);
      box.ondragover = (e) => { e.preventDefault(); box.classList.add("on"); };
      box.ondragleave = () => box.classList.remove("on");
      box.ondrop = (e) => { e.preventDefault(); box.classList.remove("on"); take(e.dataTransfer.files[0]); };
    });
    w.querySelectorAll("[data-bulk]").forEach((inp) => inp.onchange = () => {
      files = [...files, ...[...inp.files].filter(isMedia)].slice(0, 30);
      w.querySelector("[data-bulkn]").textContent = files.length ? `${files.length} ملفًا سيُوزَّع تلقائيًا` : ""; valid();
    });
    w.querySelector("[data-consent]").onchange = valid;
    files = []; valid();
  }
  function valid() {
    const b = root?.querySelector("[data-dn=create]"); if (!b) return;
    const sh = home?.shots || [], has = (slot) => !!picked[slot];
    const lack = sh.filter((s) => s.req && !has(s.slot) && !(s.alt && sh.some((x) => s.alt && has(altSrc(s.slot)))));
    const n = sh.filter((s) => s.req).length - lack.length, all = sh.filter((s) => s.req).length, enough = !lack.length || files.length > 0;
    const ok = enough && root.querySelector("[data-consent]")?.checked;
    b.disabled = !ok;
    root.querySelector(".dn-msg").textContent = !enough ? `ناقص: ${lack.map((s) => s.name).join("، ")}` : (ok ? "" : "أكّد موافقة المريض");
  }
  // صور الموبايل بتبقى كبيرة جدًا (٥–١٠ ميجا): بنصغّرها لـ٣٠٠٠ بكسل قبل الرفع (أكبر من اللي القوالب بتستخدمه)، والفيديو زي ما هو
  async function shrink(f) {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size < 1.5e6) return f;
    try {
      const bm = await createImageBitmap(f, { imageOrientation: "from-image" }), k = Math.min(1, 3000 / Math.max(bm.width, bm.height));
      if (k >= 1 && f.size < 4e6) return f;
      const c = document.createElement("canvas"); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
      c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
      const bl = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));
      return bl && bl.size < f.size ? new File([bl], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : f;
    } catch (e) { return f; }
  }
  // رفع بنسبة مئوية ظاهرة (fetch مابيقولش اترفع قد إيه)
  const upload = (url, fd, onp) => new Promise((ok, bad) => {
    const x = new XMLHttpRequest(); x.open("POST", url); x.timeout = 30 * 60 * 1000;
    x.upload.onprogress = (e) => e.lengthComputable && onp(Math.round(e.loaded * 100 / e.total));
    x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch (e) {}
      if (x.status === 401) { location.href = "/login"; return bad(new Error("يجب تسجيل الدخول")); }
      x.status < 300 ? ok(d) : bad(new Error(d.detail || `خطأ ${x.status}`)); };
    x.onerror = x.ontimeout = () => bad(new Error("انقطع الاتصال أثناء الرفع، حاول مرة أخرى."));
    x.send(fd);
  });
  async function create() {
    const b = root.querySelector("[data-dn=create]"), msg = root.querySelector(".dn-msg"); b.disabled = true; msg.textContent = "جارٍ تجهيز الصور…";
    const fd = new FormData();
    for (const [k, f] of Object.entries(picked)) { const g = await shrink(f); fd.append(k, g, g.name); }
    for (const f of files) { const g = await shrink(f); fd.append("files", g, g.name); }
    fd.append("title", root.querySelector("[data-title]").value || "");
    try { const v = await upload("/api/dental/cases", fd, (p) => { msg.textContent = p < 100 ? `جارٍ الرفع… ${p}%` : "تم الرفع، جارٍ الحفظ…"; }); picked = {}; files = []; showCase(v.id, v); }
    catch (e) { b.disabled = false; msg.textContent = e.message; }
  }

  async function showCase(id, data) {
    cur = id; clearTimeout(timer);
    let v = data;
    if (!v) { try { v = await call(`/api/dental/cases/${id}`); } catch (e) { return open(); } }
    if (cur !== id || !root) return;
    // التحديث الدوري: لو مفيش حاجة اتغيرت ماتعيدش رسم الصفحة (الصور والفيديوهات مابتتحملش تاني)
    const sig = JSON.stringify(v), j0 = v.job || {};
    if (!data && sig === last && root.querySelector(".dn-card")) { if (j0.status === "running" || j0.status === "queued") timer = setTimeout(() => showCase(id), 5000); return; }
    last = sig;
    const w = shell(v.title, true);
    const j = v.job || {}, running = j.status === "running" || j.status === "queued";
    const jobHtml = running ? `<div class="dn-job"><span class="dn-spin"></span><span>${j.status === "queued" ? "في الطابور" : "يعمل الآن"}: ${esc(stageName(j.stage))}… (قد يستغرق بضع دقائق، ويمكنك إغلاق النافذة)</span></div>`
      : j.status === "failed" ? `<div class="dn-job bad"><span>تعذّرت خطوة «${esc(stageName(j.stage))}»: ${esc(j.error)}</span><button class="dn-btn ghost" data-dn="redo">أعد المحاولة</button></div>` : "";
    const slots = home?.shots || [];
    // خانة ناقصة واحدة بس في المرة (مش كل الصور متكررة تحت كل خانة)، ولو خطوة فشلت: الخطأ بس من غير اختيار
    const missing = !running && j.status !== "failed" && v.photos?.length ? slots.filter((s) => (v.need || []).includes(s.slot)).slice(0, 1) : [];
    const spare = [...(v.photos || [])].sort((a, b) => !!a.slot - !!b.slot);   // غير المستخدمة الأول، والمستخدمة كمان (لو اتصنفت غلط في خانة تانية)
    // صورة ناقصة: الطبيب يختارها بنفسه من صوره (أو يرفع صورة جديدة) بدل ما الحالة تقف
    const needHtml = missing.map((s) => `<div class="dn-need"><b>لم نتعرّف على صورة «${esc(s.name)}»</b>${v.rejected?.[s.slot] ? `<p>لم نقبل الصورة التي رفعتها لهذه الخانة: ${esc(v.rejected[s.slot])}</p>` : ""}<p>${esc(s.hint)} اختر الصورة المناسبة من صورك، أو ارفع صورة جديدة.</p>
      ${spare.length ? `<div class="dn-pics">${spare.map((p) => `<figure class="dn-pic"><img src="${esc(p.url)}" alt="" loading="lazy">${p.slot ? `<span>مستخدمة في: ${esc(p.slot_name)}</span>` : "<span>غير مستخدمة</span>"}<button data-assign="${esc(s.slot)}" data-photo="${esc(p.file)}">استخدم هذه</button></figure>`).join("")}</div>` : ""}
      <div class="dn-row" style="margin:0"><label class="dn-btn ghost" style="cursor:pointer">ارفع صورة أو فيديو لهذه الخانة<input type="file" accept="image/*,video/*" hidden data-upslot="${esc(s.slot)}"></label></div></div>`).join("");
    const picsHtml = v.photos?.length ? `<details style="margin-top:12px"><summary style="cursor:pointer;font-size:14px">صورك (${v.photos.length}) وأين استُخدمت كل صورة</summary><div class="dn-pics">${v.photos.map((p) => `<figure class="dn-pic${p.slot ? " used" : ""}"><img src="${esc(p.url)}" alt="" loading="lazy">${p.slot ? `<b>${esc(p.slot_name)}</b>` : "غير مستخدمة"}</figure>`).join("")}</div></details>` : "";
    const shotsHtml = Object.keys(v.slots || {}).length && Object.values(v.slots).some(Boolean)
      ? `<div class="dn-slots">${slots.map((s) => { const [k, b] = artOf(s), si = (v.slot_info || {})[s.slot], ok = v.slots[s.slot], need = (v.need || []).includes(s.slot);
          const st = ok ? (si?.cropped ? "✓ مقصوصة تلقائيًا من صورة الوجه" : "✓ تمت تعبئتها") : need ? "✗ مطلوبة ولم تُعبّأ بعد" : s.req ? "ستُقص تلقائيًا" : "اختيارية — لم تُرفع";
          return `<div class="dn-slot static ${ok ? "done" : need ? "miss" : "optional"}"><div class="art${si ? " filled" : ""}">${si ? `<img src="${esc(si.url)}" alt="" loading="lazy">` : ""}${ART[k](b)}<span class="tag${b ? "" : " after"}">${b ? "قبل" : "بعد"}</span></div>
            <b>${esc(s.name)}</b><span class="act">${st}</span></div>`; }).join("")}</div>` : "";
    const canCrop = !running && !(v.need || []).length && slots.some((s) => s.req && !v.slots[s.slot]);
    const cropHtml = canCrop ? `<div class="dn-row"><button class="dn-btn" data-dn="redo">أكمل: قصّ الصور الناقصة تلقائيًا</button></div>` : "";
    const rev = v.review.length ? `<div class="dn-card"><h3>راجع الصور المشتقة</h3><p>هذه الصور مصنوعة من صور المريض الحقيقية وتدخل في الفيديو. وافق عليها فقط إذا كانت الأسنان هي أسنان المريض نفسها.</p>
      <div class="dn-rev">${v.review.map((r) => `<figure>${r.url ? `<a href="${esc(r.url.replace(/&w=\d+/, ""))}" target="_blank" rel="noopener" title="افتح الصورة بالحجم الكامل"><img src="${esc(r.url)}" alt="${esc(r.why)}" style="cursor:zoom-in"></a><a class="dn-full" href="${esc(r.url.replace(/&w=\d+/, ""))}" target="_blank" rel="noopener">افتح الصورة بالحجم الكامل</a>` : ""}<figcaption>${esc(r.why)}<br><span class="dn-st ${r.state === "approved" ? "ok" : r.state === "rejected" || r.state === "failed" ? "bad" : ""}">${esc(r.label)}</span>${r.note ? `<br>${esc(r.note)}` : ""}</figcaption>
        ${r.state === "pending" ? `<div class="dn-row" style="margin:0"><button class="dn-btn" data-ok="${esc(r.name)}" ${running ? "disabled" : ""}>موافق</button><button class="dn-btn ghost" data-no="${esc(r.name)}" ${running ? "disabled" : ""}>ارفض</button></div>`
          : r.state === "failed" && r.url ? `<div class="dn-row" style="margin:0"><button class="dn-btn ghost" data-ok="${esc(r.name)}" ${running ? "disabled" : ""}>الصورة سليمة، أوافق عليها</button></div>` : ""}</figure>`).join("")}</div>
      ${(v.review.some((r) => r.state === "rejected" || r.state === "failed") || v.problems?.length) && !running ? `<div class="dn-row"><button class="dn-btn ghost" data-dn="redo">أعد صنع المرفوض</button></div>` : ""}</div>` : "";
    const probs = v.problems?.length && !running ? `<div class="dn-need"><b>تعذّر تجهيز بعض الخطوات</b>${v.problems.map((p) => `<p>${esc(p.label)}: ${esc(p.note)}</p>`).join("")}<div class="dn-row" style="margin:0"><button class="dn-btn ghost" data-dn="redo">أعد المحاولة</button></div></div>` : "";
    const tpls = `<div class="dn-card"><h3>القوالب</h3><p>${v.ready ? "اختر قالبًا لإنشاء الفيديو. كل فيديو يأخذ عدة دقائق." : "تفتح القوالب بعد موافقتك على الصور المشتقة."}</p>
      <div class="dn-tpls">${v.templates.map((t) => { const vid = v.videos[t.id], doing = running && j.stage === "render:" + t.id;
        return `<div class="dn-tpl"><b>${esc(t.name)}</b><p>${esc(t.desc)}</p>${vid ? `<video src="${esc(vid.url)}" controls playsinline preload="metadata"></video><a class="dn-btn ghost" href="${esc(vid.url)}" download="${esc(t.id)}.mp4" style="text-align:center;text-decoration:none">تنزيل</a>` : ""}
        ${t.available === false ? `<p class="dn-st">يحتاج فيديو حقيقيًا لوجه المريض بعد العلاج: ارفعه في خانة «وجه المريض بعد العلاج».</p>` : ""}
        <button class="dn-btn${vid ? " ghost" : ""}" data-render="${esc(t.id)}" ${!v.ready || running || t.available === false ? "disabled" : ""}>${doing ? "يعمل الآن…" : vid ? "أنشئه من جديد" : "أنشئ الفيديو"}</button></div>`; }).join("")}</div></div>`;
    const GROUPS = { uploads: "ما رفعته (صور وفيديوهات)", derived: "صور مشتقة ومقصوصة", live: "فيديوهات حية للقوالب", videos: "الفيديوهات النهائية (والنسخ السابقة)" };
    const assets = v.assets?.length ? `<div class="dn-card"><h3>ملف المريض</h3><p>كل ما رفعته وكل ما صُنع منه محفوظ هنا، ويُستخدم في أي قالب جديد لاحقًا دون رفعه مرة أخرى.</p>
      ${Object.entries(GROUPS).map(([g, label]) => { const xs = v.assets.filter((a) => a.group === g); return xs.length ? `<details style="margin-top:10px"><summary style="cursor:pointer;font-size:14px">${esc(label)} (${xs.length})</summary>
        <div class="dn-pics">${xs.map((a) => `<figure class="dn-pic">${a.video ? `<video src="${esc(a.url)}" muted playsinline preload="none" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px"></video>` : `<img src="${esc(a.url)}${a.url.includes("?") ? "&" : "?"}w=360" alt="" loading="lazy">`}<a href="${esc(a.url)}" download="${esc(a.name)}" style="font-size:12px;color:var(--dn-acc)">تنزيل</a></figure>`).join("")}</div></details>` : ""; }).join("")}
      <div class="dn-row"><a class="dn-btn ghost" href="/api/dental/cases/${esc(v.id)}/assets.zip" download style="text-decoration:none">تنزيل ملف المريض كاملًا</a></div></div>` : "";
    w.innerHTML = `<div class="dn-card"><h3>${esc(v.title)}</h3>${jobHtml}${shotsHtml}${cropHtml}${needHtml}${probs}${picsHtml}</div>${rev}${tpls}${assets}
      <div class="dn-row"><button class="dn-btn ghost" data-dn="delete" ${running ? "disabled" : ""}>احذف الحالة</button></div>`;
    if (running) timer = setTimeout(() => showCase(id), 5000);
    w.querySelectorAll("[data-upslot]").forEach((inp) => inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      const fd = new FormData(); fd.append("slot", inp.dataset.upslot); fd.append("file", f, f.name);
      inp.closest("label").style.opacity = ".5";
      try { showCase(id, await call(`/api/dental/cases/${id}/assign`, { method: "POST", body: fd })); }
      catch (err) { inp.closest("label").style.opacity = ""; if (window.uiAlert) uiAlert(err.message); else alert(err.message); }
    });
  }

  // 🧠 قالب من المشاريع ← حالات العقل: اللي تنفع تتختار، واللي ماتنفعش مقفولة ومكتوب ناقصها إيه
  let pickT = null, pickTimer = 0;
  async function pick(t) {
    pickT = t; clearTimeout(pickTimer);
    const w = shell(`اختر حالة لقالب «${t.name}»`);
    if (!w.querySelector(".dn-card")) w.innerHTML = `<div class="dn-card"><p>جارٍ التحميل…</p></div>`;
    let r;
    try { r = await call(`/api/dental/fit/${encodeURIComponent(t.id)}`); } catch (e) { w.innerHTML = `<div class="dn-card"><p>${esc(e.message)}</p></div>`; return; }
    if (pickT !== t || !root) return;
    const item = (c) => `<button class="dn-pk" ${c.ok ? `data-pick="${esc(c.id)}"` : "disabled"}><span class="ic">${c.ok ? "🦷" : c.busy ? "⏳" : "🔒"}</span>
      <span><b>${esc(c.name)}</b><small>${c.ok ? (t.kind === "photo" ? "جاهزة لهذا القالب" : "جاهزة لهذا القالب، وستُجهَّز عناصرها ثم تراجعها") : esc(c.missing || "")}</small></span></button>`;
    const ok = r.cases.filter((c) => c.ok).length;
    w.innerHTML = `<div class="dn-card"><h3>${esc(t.name)}</h3><p>${esc(t.desc || "")}</p></div>
      <div class="dn-card"><h3>حالاتك ${r.cases.length ? `(${ok} من ${r.cases.length} تناسب هذا القالب)` : ""}</h3>
        ${r.cases.length ? `<div class="dn-list">${r.cases.map(item).join("")}</div>` : `<p>لا توجد حالات بعد. أضف فولدرًا لكل حالة داخل «الصور ← الحالات» في العقل، وسيصنّف العقل صورها تلقائيًا.</p>`}
        <div class="dn-row"><button class="dn-btn ghost" data-dn="brain">افتح الحالات في العقل</button></div></div>`;
    if (r.cases.some((c) => c.busy)) pickTimer = setTimeout(() => pickT === t && root && pick(t), 4000);
  }
  let lastCase = null;
  async function make(caseId, replace = "") {
    const t = pickT; clearTimeout(pickTimer); lastCase = caseId;
    const w = shell(`«${t.name}»`);
    w.innerHTML = `<div class="dn-card"><p>${t.kind === "photo" ? "جارٍ صنع البوست من صور الحالة…" : "جارٍ تجهيز الحالة لقالب الفيديو…"}</p></div>`;
    try {
      const r = await call(`/api/dental/brain/${encodeURIComponent(caseId)}/make`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template: t.id, replace }) });
      if (r.kind === "video") { home = home || await call("/api/dental"); return showCase(r.cid); }
      w.innerHTML = `<div class="dn-card dn-out"><img src="${esc(r.file.url)}" alt="${esc(r.file.name)}">
        <p>حُفظ البوست في فولدر الحالة في العقل.</p>
        ${r.ask_logo ? `<div class="dn-card" data-logoask style="box-shadow:0 0 0 1.5px var(--dn-acc)"><p>شعارك لا يظهر بوضوح على هذه الخلفية. هل تسمح بتحويل لونه (أبيض على الخلفية الغامقة) في بوستات الأسنان؟ لن نغيّر شعارك دون موافقتك.</p>
          <div class="dn-row"><button class="dn-btn" data-dn="logo-yes" data-file="${esc(r.file.id)}">نعم، حوّل لونه</button><button class="dn-btn ghost" data-dn="logo-no">لا، أبقِه كما هو</button></div></div>` : ""}
        <div class="dn-row"><a class="dn-btn" href="${esc(r.file.url)}" download style="text-decoration:none">تنزيل</a><button class="dn-btn ghost" data-dn="back-pick">قالب آخر لهذه الحالة أو حالة أخرى</button></div></div>`;
    } catch (e) { w.innerHTML = `<div class="dn-card"><p>${esc(e.message)}</p><div class="dn-row"><button class="dn-btn ghost" data-dn="back-pick">رجوع</button></div></div>`; }
  }

  async function onClick(e) {
    const t = e.target.closest("[data-dn],[data-case],[data-ok],[data-no],[data-render],[data-assign],[data-pick]"); if (!t) return;
    const a = t.dataset.dn;
    try {
      if (a === "close") return close();
      if (t.dataset.pick) return make(t.dataset.pick);
      if (a === "back-pick") return pick(pickT);
      if (a === "logo-yes" || a === "logo-no") {
        t.disabled = true;
        await call("/api/dental/logo-color", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ white: a === "logo-yes" }) });
        if (a === "logo-yes") return make(lastCase, t.dataset.file);
        root.querySelector("[data-logoask]")?.remove(); return;
      }
      if (a === "brain") { close(); window.BL_TAB = "images"; window.BL_CASES = true; return window.NHNav?.("brainlib"); }
      if (a === "home") { cur = null; clearTimeout(timer); return pickT ? pick(pickT) : open(); }
      if (a === "create") return create();
      if (t.dataset.case) return showCase(t.dataset.case);
      if (a === "redo") { t.disabled = true; return showCase(cur, await call(`/api/dental/cases/${cur}/redo`, { method: "POST" })); }
      if (t.dataset.ok || t.dataset.no) {
        let reason = "";
        if (t.dataset.no) { reason = window.uiPrompt ? await uiPrompt("ما المشكلة في الصورة؟ (مثلًا: الأسنان مختلفة)") : ""; if (reason === null) return; }
        t.disabled = true;
        return showCase(cur, await call(`/api/dental/cases/${cur}/decide`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: t.dataset.ok || t.dataset.no, ok: !!t.dataset.ok, reason }) }));
      }
      if (t.dataset.assign) {
        t.disabled = true; const fd = new FormData(); fd.append("slot", t.dataset.assign); fd.append("photo", t.dataset.photo);
        return showCase(cur, await call(`/api/dental/cases/${cur}/assign`, { method: "POST", body: fd }));
      }
      if (t.dataset.render) { t.disabled = true; return showCase(cur, await call(`/api/dental/cases/${cur}/render`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template: t.dataset.render }) })); }
      if (a === "delete") {
        if (window.uiConfirm && !(await uiConfirm("تُحذف الحالة وصورها وفيديوهاتها نهائيًا.", { ok: "احذف", danger: true }))) return;
        await call(`/api/dental/cases/${cur}`, { method: "DELETE" }); cur = null; return open();
      }
    } catch (err) { if (window.uiAlert) uiAlert(err.message); else alert(err.message); t.disabled = false; }
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && root) close(); });
  window.Dental = { open, close, pick };
})();
