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
.dn-case{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;background:var(--dn-bg);cursor:pointer;border:0;color:inherit;font:inherit;text-align:start}
.dn-case b{flex:1}.dn-case small{color:var(--dn-mute)}
.dn-job{display:flex;gap:10px;align-items:center;padding:12px 14px;border-radius:14px;background:rgba(229,97,62,.08);font-size:14px}
.dn-job.bad{background:rgba(217,68,58,.1)}.dn-spin{width:16px;height:16px;border-radius:50%;border:2px solid currentColor;border-inline-end-color:transparent;animation:dnSpin .8s linear infinite;flex:none}
.dn-rev{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-top:12px}
.dn-rev figure{margin:0;background:var(--dn-bg);border-radius:14px;padding:10px;display:grid;gap:8px}
.dn-rev img{width:100%;max-height:360px;object-fit:contain;border-radius:10px;background:#000}
.dn-rev figcaption{font-size:13px;line-height:1.7;color:var(--dn-mute)}.dn-st{font-size:12px;font-weight:600}
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
.dn-slot .art svg{width:88%;height:88%}.dn-slot .art img{width:100%;height:100%;object-fit:cover}
.dn-slot .art.filled svg{position:absolute;bottom:6px;inset-inline-end:6px;width:36%;height:auto;background:rgba(255,255,255,.94);border-radius:10px;padding:3px;box-shadow:0 2px 8px rgba(0,0,0,.25)}
.dn-slot.miss{border-style:solid;border-color:var(--dn-bad)}.dn-slot.miss .act{color:var(--dn-bad)}.dn-slot.static{cursor:default}
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
  const STAGE = { slots: "تجهيز الصور وتحليل الأسنان", assign: "تجهيز الصورة التي حددتها وتحليلها", intake: "تصنيف الصور وتحليل الأسنان", elements: "تجهيز الصور المشتقة", render: "إنشاء الفيديو" };
  const stageName = (s) => s?.startsWith("render:") ? `${STAGE.render} (${s.slice(7)})` : (STAGE[s] || s || "");
  let root = null, home = null, cur = null, timer = null, files = [], picked = {};
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
    smile: (before) => `<svg viewBox="0 0 160 120" aria-hidden="true">
      <path d="M18 58 q30 -30 62 -18 q32 -12 62 18 q-62 60 -124 0z" fill="${INK}"/>
      <path d="M32 58 q48 -16 96 0 q-48 34 -96 0z" fill="#2c2c33"/>
      ${teethRow(48, 16, 8, before ? "#e8d6a4" : "#fff", before)}
      <path d="M18 58 q62 18 124 0" stroke="${INK}" stroke-width="3" fill="none"/></svg>`,
  };
  const SHOT_ART = { before_retracted: ["ret", 1], after_retracted: ["ret", 0], before_face: ["face", 1], after_smile: ["smile", 0] };

  function shell(title, back) {
    if (!root) { root = document.createElement("div"); root.className = "dn"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); document.body.appendChild(root); }
    root.innerHTML = `<div class="dn-top">${back ? `<button class="dn-back" data-dn="home">رجوع</button>` : ""}<h2><span class="t">${esc(title)}</span><span class="beta">نسخة تجريبية</span></h2><button class="dn-x" data-dn="close" aria-label="إغلاق">✕</button></div><div class="dn-body"><div class="dn-wrap"></div></div>`;
    root.onclick = onClick;
    return root.querySelector(".dn-wrap");
  }
  function close() { clearTimeout(timer); root?.remove(); root = null; cur = null; files = []; }

  async function open() {
    const w = shell("فيديوهات الأسنان من حالاتك");
    w.innerHTML = `<div class="dn-card"><p>جارٍ التحميل…</p></div>`;
    try { home = await call("/api/dental"); } catch (e) { w.innerHTML = `<div class="dn-card"><p>${esc(e.message)}</p></div>`; return; }
    picked = {};
    const slotsHtml = home.shots.map((s) => { const [k, b] = SHOT_ART[s.slot] || ["ret", 0];
      return `<label class="dn-slot" data-slot="${esc(s.slot)}"><input type="file" accept="image/*" hidden><div class="art">${ART[k](b)}<span class="tag${b ? "" : " after"}">${b ? "قبل" : "بعد"}</span></div>
        <b>${esc(s.name)}</b><small>${esc(s.hint)}</small><span class="act">اضغط أو اسحب الصورة هنا</span></label>`; }).join("");
    const cases = home.cases.map((c) => `<button class="dn-case" data-case="${esc(c.id)}"><b>${esc(c.title)}</b><small>${c.job?.status === "running" || c.job?.status === "queued" ? "يعمل الآن…" : c.job?.status === "failed" ? "تحتاج إعادة" : `${c.videos} فيديو`}</small></button>`).join("");
    w.innerHTML = `
      <div class="dn-card"><h3>حالة جديدة</h3>
        <p>ارفع صورة حقيقية في كل خانة كما في الرسمة. الأسنان في الفيديو هي أسنان المريض الحقيقية: لا نبيّض «قبل» ولا نعدّل «بعد».</p>
        <div class="dn-slots">${slotsHtml}</div>
        <div class="dn-bulk"><span>أو ارفع كل صور الحالة مرة واحدة، وسنضع كل صورة في خانتها:</span>
          <label class="dn-btn ghost">اختر الصور<input type="file" accept="image/*" multiple hidden data-bulk></label>
          <label class="dn-btn ghost">اختر مجلدًا<input type="file" multiple webkitdirectory hidden data-bulk></label>
          <span data-bulkn></span></div>
        <div class="dn-row"><input class="dn-in" data-title placeholder="اسم الحالة (مثلًا: عدسات — أحمد)" maxlength="80"></div>
        <label class="dn-ck"><input type="checkbox" data-consent> لدي موافقة مكتوبة من المريض على استخدام صوره قبل وبعد في المحتوى.</label>
        <div class="dn-row"><button class="dn-btn" data-dn="create" disabled>ابدأ</button><span class="dn-msg" style="font-size:13px;color:var(--dn-mute)"></span></div>
      </div>
      ${cases ? `<div class="dn-card"><h3>حالاتك</h3><div class="dn-list">${cases}</div></div>` : ""}`;
    w.querySelectorAll(".dn-slot").forEach((box) => {
      const inp = box.querySelector("input"), slot = box.dataset.slot;
      const take = (f) => { if (!f || !f.type.startsWith("image/")) return; picked[slot] = f;
        const art = box.querySelector(".art"); art.querySelector("img")?.remove(); art.classList.add("filled");   // الأفاتار يفضل في الركن
        const i = new Image(); i.src = URL.createObjectURL(f); i.alt = ""; art.prepend(i);
        box.classList.add("done"); box.querySelector(".act").textContent = "✓ تم اختيار الصورة (اضغط للتغيير)"; valid(); };
      inp.onchange = () => take(inp.files[0]);
      box.ondragover = (e) => { e.preventDefault(); box.classList.add("on"); };
      box.ondragleave = () => box.classList.remove("on");
      box.ondrop = (e) => { e.preventDefault(); box.classList.remove("on"); take(e.dataTransfer.files[0]); };
    });
    w.querySelectorAll("[data-bulk]").forEach((inp) => inp.onchange = () => {
      files = [...files, ...[...inp.files].filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(f.name))].slice(0, 30);
      w.querySelector("[data-bulkn]").textContent = files.length ? `${files.length} صورة ستُوزَّع تلقائيًا` : ""; valid();
    });
    w.querySelector("[data-consent]").onchange = valid;
    files = []; valid();
  }
  function valid() {
    const b = root?.querySelector("[data-dn=create]"); if (!b) return;
    const n = Object.keys(picked).length, all = (home?.shots || []).length, enough = n === all || n + files.length >= all;
    const ok = enough && root.querySelector("[data-consent]")?.checked;
    b.disabled = !ok;
    root.querySelector(".dn-msg").textContent = !enough ? `${n + files.length} من ${all} صور` : (ok ? "" : "أكّد موافقة المريض");
  }
  async function create() {
    const b = root.querySelector("[data-dn=create]"); b.disabled = true; root.querySelector(".dn-msg").textContent = "جارٍ الرفع…";
    const fd = new FormData(); Object.entries(picked).forEach(([k, f]) => fd.append(k, f, f.name)); files.forEach((f) => fd.append("files", f, f.name));
    fd.append("title", root.querySelector("[data-title]").value || "");
    try { const v = await call("/api/dental/cases", { method: "POST", body: fd }); picked = {}; files = []; showCase(v.id, v); }
    catch (e) { b.disabled = false; root.querySelector(".dn-msg").textContent = e.message; }
  }

  async function showCase(id, data) {
    cur = id; clearTimeout(timer);
    let v = data;
    if (!v) { try { v = await call(`/api/dental/cases/${id}`); } catch (e) { return open(); } }
    if (cur !== id || !root) return;
    const w = shell(v.title, true);
    const j = v.job || {}, running = j.status === "running" || j.status === "queued";
    const jobHtml = running ? `<div class="dn-job"><span class="dn-spin"></span><span>${j.status === "queued" ? "في الطابور" : "يعمل الآن"}: ${esc(stageName(j.stage))}… (قد يستغرق بضع دقائق، ويمكنك إغلاق النافذة)</span></div>`
      : j.status === "failed" && !Object.values(v.slots || {}).some((x) => !x) ? `<div class="dn-job bad"><span>تعذّرت خطوة «${esc(stageName(j.stage))}»: ${esc(j.error)}</span><button class="dn-btn ghost" data-dn="redo">أعد المحاولة</button></div>` : "";
    const slots = home?.shots || [];
    const missing = !running && v.photos?.length ? slots.filter((s) => !v.slots[s.slot]) : [];
    const spare = [...(v.photos || [])].sort((a, b) => !!a.slot - !!b.slot);   // غير المستخدمة الأول، والمستخدمة كمان (لو اتصنفت غلط في خانة تانية)
    // صورة ناقصة: الطبيب يختارها بنفسه من صوره (أو يرفع صورة جديدة) بدل ما الحالة تقف
    const needHtml = missing.map((s) => `<div class="dn-need"><b>لم نتعرّف على صورة «${esc(s.name)}»</b><p>${esc(s.hint)} اختر الصورة المناسبة من صورك، أو ارفع صورة جديدة.</p>
      ${spare.length ? `<div class="dn-pics">${spare.map((p) => `<figure class="dn-pic"><img src="${esc(p.url)}" alt="" loading="lazy">${p.slot ? `<span>مستخدمة في: ${esc(p.slot_name)}</span>` : "<span>غير مستخدمة</span>"}<button data-assign="${esc(s.slot)}" data-photo="${esc(p.file)}">استخدم هذه</button></figure>`).join("")}</div>` : ""}
      <div class="dn-row" style="margin:0"><label class="dn-btn ghost" style="cursor:pointer">ارفع صورة لهذه الخانة<input type="file" accept="image/*" hidden data-upslot="${esc(s.slot)}"></label></div></div>`).join("");
    const picsHtml = v.photos?.length ? `<details style="margin-top:12px"><summary style="cursor:pointer;font-size:14px">صورك (${v.photos.length}) وأين استُخدمت كل صورة</summary><div class="dn-pics">${v.photos.map((p) => `<figure class="dn-pic${p.slot ? " used" : ""}"><img src="${esc(p.url)}" alt="" loading="lazy">${p.slot ? `<b>${esc(p.slot_name)}</b>` : "غير مستخدمة"}</figure>`).join("")}</div></details>` : "";
    const shotsHtml = Object.keys(v.slots || {}).length && Object.values(v.slots).some(Boolean)
      ? `<div class="dn-slots">${slots.map((s) => { const [k, b] = SHOT_ART[s.slot] || ["ret", 0], ph = (v.photos || []).find((p) => p.slot === s.slot), ok = v.slots[s.slot];
          return `<div class="dn-slot static ${ok ? "done" : "miss"}"><div class="art${ph ? " filled" : ""}">${ph ? `<img src="${esc(ph.url)}" alt="" loading="lazy">` : ""}${ART[k](b)}<span class="tag${b ? "" : " after"}">${b ? "قبل" : "بعد"}</span></div>
            <b>${esc(s.name)}</b><span class="act">${ok ? "✓ تمت تعبئتها" : "✗ لم تُعبّأ بعد"}</span></div>`; }).join("")}</div>` : "";
    const rev = v.review.length ? `<div class="dn-card"><h3>راجع الصور المشتقة</h3><p>هذه الصور مصنوعة من صور المريض الحقيقية وتدخل في الفيديو. وافق عليها فقط إذا كانت الأسنان هي أسنان المريض نفسها.</p>
      <div class="dn-rev">${v.review.map((r) => `<figure>${r.url ? `<img src="${esc(r.url)}" alt="${esc(r.why)}">` : ""}<figcaption>${esc(r.why)}<br><span class="dn-st ${r.state === "approved" ? "ok" : r.state === "rejected" || r.state === "failed" ? "bad" : ""}">${esc(r.label)}</span>${r.note ? `<br>${esc(r.note)}` : ""}</figcaption>
        ${r.state === "pending" ? `<div class="dn-row" style="margin:0"><button class="dn-btn" data-ok="${esc(r.name)}" ${running ? "disabled" : ""}>موافق</button><button class="dn-btn ghost" data-no="${esc(r.name)}" ${running ? "disabled" : ""}>ارفض</button></div>`
          : r.state === "failed" && r.url ? `<div class="dn-row" style="margin:0"><button class="dn-btn ghost" data-ok="${esc(r.name)}" ${running ? "disabled" : ""}>الصورة سليمة، أوافق عليها</button></div>` : ""}</figure>`).join("")}</div>
      ${(v.review.some((r) => r.state === "rejected" || r.state === "failed") || v.problems?.length) && !running ? `<div class="dn-row"><button class="dn-btn ghost" data-dn="redo">أعد صنع المرفوض</button></div>` : ""}</div>` : "";
    const probs = v.problems?.length && !running ? `<div class="dn-need"><b>تعذّر تجهيز بعض الخطوات</b>${v.problems.map((p) => `<p>${esc(p.label)}: ${esc(p.note)}</p>`).join("")}<div class="dn-row" style="margin:0"><button class="dn-btn ghost" data-dn="redo">أعد المحاولة</button></div></div>` : "";
    const tpls = `<div class="dn-card"><h3>القوالب</h3><p>${v.ready ? "اختر قالبًا لإنشاء الفيديو. كل فيديو يأخذ عدة دقائق." : "تفتح القوالب بعد موافقتك على الصور المشتقة."}</p>
      <div class="dn-tpls">${v.templates.map((t) => { const vid = v.videos[t.id], doing = running && j.stage === "render:" + t.id;
        return `<div class="dn-tpl"><b>${esc(t.name)}</b><p>${esc(t.desc)}</p>${vid ? `<video src="${esc(vid.url)}" controls playsinline preload="metadata"></video><a class="dn-btn ghost" href="${esc(vid.url)}" download="${esc(t.id)}.mp4" style="text-align:center;text-decoration:none">تنزيل</a>` : ""}
        <button class="dn-btn${vid ? " ghost" : ""}" data-render="${esc(t.id)}" ${!v.ready || running ? "disabled" : ""}>${doing ? "يعمل الآن…" : vid ? "أنشئه من جديد" : "أنشئ الفيديو"}</button></div>`; }).join("")}</div></div>`;
    w.innerHTML = `<div class="dn-card"><h3>${esc(v.title)}</h3>${jobHtml}${shotsHtml}${needHtml}${probs}${picsHtml}</div>${rev}${tpls}
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

  async function onClick(e) {
    const t = e.target.closest("[data-dn],[data-case],[data-ok],[data-no],[data-render],[data-assign]"); if (!t) return;
    const a = t.dataset.dn;
    try {
      if (a === "close") return close();
      if (a === "home") { cur = null; clearTimeout(timer); return open(); }
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
  window.Dental = { open, close };
})();
