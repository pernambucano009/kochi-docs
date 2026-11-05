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
@keyframes dnIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes dnSpin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.dn,.dn-spin{animation:none}}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const call = (p, o) => (window.api ? window.api(p, o) : fetch(p, o).then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.detail || r.status); return d; }));
  const STAGE = { assign: "تجهيز الصورة التي حددتها وتحليلها", intake: "تصنيف الصور وتحليل الأسنان", elements: "تجهيز الصور المشتقة", render: "إنشاء الفيديو" };
  const stageName = (s) => s?.startsWith("render:") ? `${STAGE.render} (${s.slice(7)})` : (STAGE[s] || s || "");
  let root = null, home = null, cur = null, timer = null, files = [];

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
    const shots = home.shots.map((s) => `<div class="dn-shot"><b>${esc(s.name)}</b>${esc(s.hint)}</div>`).join("");
    const cases = home.cases.map((c) => `<button class="dn-case" data-case="${esc(c.id)}"><b>${esc(c.title)}</b><small>${c.job?.status === "running" || c.job?.status === "queued" ? "يعمل الآن…" : c.job?.status === "failed" ? "تحتاج إعادة" : `${c.videos} فيديو`}</small></button>`).join("");
    w.innerHTML = `
      <div class="dn-card"><h3>حالة جديدة</h3>
        <p>ارفع صور حالة حقيقية لمريض واحد (بأي ترتيب). البرنامج يتعرّف على كل صورة ويعدّل اتجاهها، ثم يصنع فيديوهات بقوالب الأسنان. الأسنان في الفيديو هي أسنان المريض الحقيقية: لا نبيّض «قبل» ولا نعدّل «بعد».</p>
        <div class="dn-shots">${shots}</div>
        <label class="dn-drop" tabindex="0"><input type="file" accept="image/*" multiple hidden>اسحب الصور هنا أو اضغط للاختيار (٤ صور على الأقل)</label>
        <div class="dn-thumbs"></div>
        <div class="dn-row"><input class="dn-in" data-title placeholder="اسم الحالة (مثلًا: عدسات — أحمد)" maxlength="80"></div>
        <label class="dn-ck"><input type="checkbox" data-consent> لدي موافقة مكتوبة من المريض على استخدام صوره قبل وبعد في المحتوى.</label>
        <div class="dn-row"><button class="dn-btn" data-dn="create" disabled>ابدأ</button><span class="dn-msg" style="font-size:13px;color:var(--dn-mute)"></span></div>
      </div>
      ${cases ? `<div class="dn-card"><h3>حالاتك</h3><div class="dn-list">${cases}</div></div>` : ""}`;
    const inp = w.querySelector("input[type=file]"), drop = w.querySelector(".dn-drop");
    const take = (list) => { files = [...files, ...[...list].filter((f) => f.type.startsWith("image/"))].slice(0, 12); thumbs(); };
    inp.onchange = () => take(inp.files);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("on"); };
    drop.ondragleave = () => drop.classList.remove("on");
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("on"); take(e.dataTransfer.files); };
    drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inp.click(); } };
    w.querySelector("[data-consent]").onchange = valid;
    thumbs();
  }
  function thumbs() {
    const t = root?.querySelector(".dn-thumbs"); if (!t) return;
    t.innerHTML = ""; files.forEach((f) => { const i = new Image(); i.src = URL.createObjectURL(f); i.alt = f.name; t.appendChild(i); });
    valid();
  }
  function valid() {
    const b = root?.querySelector("[data-dn=create]"); if (!b) return;
    const ok = files.length >= 4 && root.querySelector("[data-consent]")?.checked;
    b.disabled = !ok;
    root.querySelector(".dn-msg").textContent = files.length < 4 ? `${files.length} من ٤ صور على الأقل` : (ok ? "" : "أكّد موافقة المريض");
  }
  async function create() {
    const b = root.querySelector("[data-dn=create]"); b.disabled = true; root.querySelector(".dn-msg").textContent = "جارٍ الرفع…";
    const fd = new FormData(); files.forEach((f) => fd.append("files", f, f.name)); fd.append("title", root.querySelector("[data-title]").value || "");
    try { const v = await call("/api/dental/cases", { method: "POST", body: fd }); files = []; showCase(v.id, v); }
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
      ${spare.length ? `<div class="dn-pics">${spare.map((p) => `<figure class="dn-pic"><img src="${esc(p.url)}" alt="" loading="lazy">${p.slot ? `<span>مستخدمة في: ${esc(p.slot_name)}</span>` : ""}<button data-assign="${esc(s.slot)}" data-photo="${esc(p.file)}">استخدم هذه</button></figure>`).join("")}</div>` : ""}
      <div class="dn-row" style="margin:0"><label class="dn-btn ghost" style="cursor:pointer">ارفع صورة لهذه الخانة<input type="file" accept="image/*" hidden data-upslot="${esc(s.slot)}"></label></div></div>`).join("");
    const picsHtml = v.photos?.length ? `<details style="margin-top:12px"><summary style="cursor:pointer;font-size:14px">صورك (${v.photos.length}) وأين استُخدمت كل صورة</summary><div class="dn-pics">${v.photos.map((p) => `<figure class="dn-pic${p.slot ? " used" : ""}"><img src="${esc(p.url)}" alt="" loading="lazy">${p.slot ? `<b>${esc(p.slot_name)}</b>` : "غير مستخدمة"}</figure>`).join("")}</div></details>` : "";
    const shotsHtml = Object.keys(v.slots || {}).length && Object.values(v.slots).some(Boolean)
      ? `<div class="dn-shots">${slots.map((s) => `<div class="dn-shot ${v.slots[s.slot] ? "ok" : "miss"}"><b>${esc(s.name)}</b></div>`).join("")}</div>` : "";
    const rev = v.review.length ? `<div class="dn-card"><h3>راجع الصور المشتقة</h3><p>هذه الصور مصنوعة من صور المريض الحقيقية وتدخل في الفيديو. وافق عليها فقط إذا كانت الأسنان هي أسنان المريض نفسها.</p>
      <div class="dn-rev">${v.review.map((r) => `<figure><img src="${esc(r.url)}" alt="${esc(r.why)}"><figcaption>${esc(r.why)}<br><span class="dn-st ${r.state === "approved" ? "ok" : r.state === "rejected" || r.state === "failed" ? "bad" : ""}">${esc(r.label)}</span></figcaption>
        ${r.state === "pending" ? `<div class="dn-row" style="margin:0"><button class="dn-btn" data-ok="${esc(r.name)}" ${running ? "disabled" : ""}>موافق</button><button class="dn-btn ghost" data-no="${esc(r.name)}" ${running ? "disabled" : ""}>ارفض</button></div>` : ""}</figure>`).join("")}</div>
      ${v.review.some((r) => r.state === "rejected" || r.state === "failed") && !running ? `<div class="dn-row"><button class="dn-btn ghost" data-dn="redo">أعد صنع المرفوض</button></div>` : ""}</div>` : "";
    const tpls = `<div class="dn-card"><h3>القوالب</h3><p>${v.ready ? "اختر قالبًا لإنشاء الفيديو. كل فيديو يأخذ عدة دقائق." : "تفتح القوالب بعد موافقتك على الصور المشتقة."}</p>
      <div class="dn-tpls">${v.templates.map((t) => { const vid = v.videos[t.id], doing = running && j.stage === "render:" + t.id;
        return `<div class="dn-tpl"><b>${esc(t.name)}</b><p>${esc(t.desc)}</p>${vid ? `<video src="${esc(vid.url)}" controls playsinline preload="metadata"></video><a class="dn-btn ghost" href="${esc(vid.url)}" download="${esc(t.id)}.mp4" style="text-align:center;text-decoration:none">تنزيل</a>` : ""}
        <button class="dn-btn${vid ? " ghost" : ""}" data-render="${esc(t.id)}" ${!v.ready || running ? "disabled" : ""}>${doing ? "يعمل الآن…" : vid ? "أنشئه من جديد" : "أنشئ الفيديو"}</button></div>`; }).join("")}</div></div>`;
    w.innerHTML = `<div class="dn-card"><h3>${esc(v.title)}</h3>${jobHtml}${shotsHtml}${needHtml}${picsHtml}</div>${rev}${tpls}
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
