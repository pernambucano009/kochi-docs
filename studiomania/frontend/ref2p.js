// 🎥 «من مرجع لبرومبت»: فيديو مرجعي ← قياسات حقيقية + فريمات + القطعات ← قايمة لقطات وبرومبت بـ 14 جزء يتعدّل ← توليد بأي موديل فيديو عندنا
const Ref2PromptPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, list: [], targets: {}, info: null, d: null, gens: [], timer: null, busy: false };
  const html = () => `<div class="nb-wrap fs-wrap" id="r2pWrap"><div class="nh-empty">جارٍ التحميل…</div></div>`;
  const SEC_AR = { "SCENE CONTEXT": "الفكرة", "LOCATION MAP": "خريطة المكان", "FIRST FRAME / BLOCKING": "أول إطار", "FORMAT MODE": "التوقيت والقطعات",
    OPTICS: "العدسة", CAMERA: "الكاميرا", ACTION: "الحركة", PHYSICS: "الفيزياء", LIGHTING: "الإضاءة", "COLOR GRADE": "الألوان", STYLE: "الأسلوب",
    "OUTPUT SETTINGS": "الإخراج", AUDIO: "الصوت", "POSITIVE LOCKS": "الثوابت" };
  const opt = (o, cur) => Object.entries(o).map(([v, t]) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(t)}</option>`).join("");
  const ratioOf = (d) => (["9:16", "16:9", "1:1", "4:5"].includes(d.facts?.aspect) ? d.facts.aspect : (d.facts?.width || 9) >= (d.facts?.height || 16) ? "16:9" : "9:16");

  function listView() {
    return `<section class="fs-hero">
        <div class="fs-hero-t"><b>من مرجع إلى موجّه</b><span class="latin en-k">REFERENCE → PROMPT</span></div>
        <p>ارفع أي فيديو يعجبك. يقيسه البرنامج فعليًا (المدة والمقاس والإطارات والقطعات)، وينظر إلى إطاراته بتوقيتها، ويكتب لك قائمة اللقطات ووصفًا جاهزًا لنموذج فيديو من 14 جزءًا ثابتًا: الكاميرا بالدرجات، والإضاءة بالكلفن، والتوقيت بالثانية، و«الثوابت» التي يجب أن تبقى في كل لقطة. تعدّله كما تحب، وتولّده بأي نموذج لدينا.</p>
        <div class="fs-feats">${[["📏", "قياس حقيقي", "لا تخمين: المدة والإطارات والقطعات بالثانية"], ["🎞️", "قائمة لقطات", "حجم اللقطة والزاوية والحركة وما يتغيّر"],
          ["🧱", "وصف من 14 جزءًا", "بأرقام حقيقية ودون نص دعائي"], ["🔒", "الثوابت", "ما يجب أن يبقى كما هو في كل اللقطات"],
          ["✂️", "تقسيم ذكي", "إن كان أطول مما يحتمله النموذج فيقسّمه مقاطع"], ["🔀", "نسخة لا نسخ", "غيّر شيئًا واحدًا ليخرج لك فيديو خاص بك"]]
          .map(([i, t, s]) => `<div class="fs-feat"><i>${i}</i><b>${t}</b><small>${s}</small></div>`).join("")}</div>
      </section>
      <section class="fs-card"><h3>فيديو جديد</h3>
        <div class="fs-grid">
          <div class="fs-span fs-up"><label class="nb-btn">🎬 الفيديو المرجعي<input type="file" accept="video/*" data-rfile hidden></label><span class="nb-state" data-rcount>الأفضل أقل من 30 ثانية</span></div>
          <label class="nb-f"><span>النموذج الذي ستولّد به</span><select data-r="target">${opt(S.targets, "")}</select></label>
          <label class="nb-f"><span>الهدف</span><select data-r="goal"><option value="copy">الفيديو نفسه بالضبط</option><option value="variant">الإحساس نفسه بموضوع آخر</option></select></label>
          <label class="nb-f fs-span"><span>ملاحظة (اختياري): إن أردت أن يكون الموضوع شيئًا معيّنًا</span><input type="text" data-r="note" placeholder="مثلًا: اجعله عن عطر بدلًا من السيارة"></label>
        </div>
        <div class="nb-bar"><button class="nb-btn fs-go" data-rnew ${S.busy ? "disabled" : ""}>${S.busy ? "⏳ جارٍ الرفع…" : "🔍 حلّل الفيديو"}</button></div></section>
      <div class="fs-list">${S.list.map((p) => `<button class="fs-item" data-ropen="${p.id}"><video src="${p.video}" muted preload="metadata"></video>
          <b>${esc(p.name)}</b><small>${p.shot_count ? `${p.shot_count} لقطة · ${p.facts?.duration}ث` : ""}${p.job ? " · ⏳" : ""}${p.error ? " · ⚠️" : ""}</small></button>`).join("")}</div>`;
  }
  function genPanel(d, prompt, key, secs) {
    const vms = S.info?.video_models || [];
    secs = Math.max(3, Math.min(15, Math.round(secs || 5)));
    return `<div class="r2p-gen" data-gen="${esc(key)}">
        <select data-gm>${vmOptions(vms, vms[0]?.key, secs, "480p", `لـ ${secs} ث`)}</select>
        <select data-gs>${[3, 4, 5, 6, 8, 10, 12, 15].map((n) => `<option ${n === secs ? "selected" : ""}>${n}</option>`).join("")}</select><span class="nb-state">ثانية</span>
        <select data-gr><option value="480p">480p</option><option value="720p">720p</option></select>
        <button class="nb-btn fs-go" data-rgen="${esc(key)}">🎬 ولّد</button></div>`;
  }
  function projectView(d) {
    const f = d.facts || {};
    const busy = !!d.job;
    const gens = S.gens.filter((g) => d.gens.includes(g.id));
    return `<div class="fs-top"><button class="nb-btn sm" data-rback>→ كل الفيديوهات</button><b>${esc(d.name)}</b>
        <button class="nb-btn sm" data-rredo ${busy ? "disabled" : ""}>🔁 حلّل مرة أخرى</button><button class="nb-btn sm danger" data-rdel ${busy ? "disabled" : ""}>حذف</button></div>
      ${busy ? `<div class="fs-busy">⏳ ${esc(d.step || "يعمل…")}</div>` : d.error ? `<div class="fs-err">⚠️ ${esc(d.error)}</div>` : ""}
      <div class="${busy ? "fs-lock" : ""}">
      <section class="fs-card"><h3>المرجع <small>${f.duration ? `${f.duration}ث · ${f.width}×${f.height} · ${f.fps} إطار · ${esc(f.aspect)} · ${f.has_audio ? "به صوت" : "بدون صوت"} · ${d.cuts.length} قطع` : ""}</small></h3>
        <div class="fs-vid"><video src="${d.video}" controls playsinline></video>
          <div>${d.sheet ? `<p class="nb-hint">الإطارات التي حُلّلت</p><img class="fs-strip" src="${d.sheet}" alt="">` : ""}
          ${d.shots.length ? `<div class="r2p-shots"><div class="r2p-sh r2p-hd"><span>من</span><span>حتى</span><span>اللقطة</span><span>الزاوية</span><span>الحركة</span><span>ما يتغيّر</span></div>
            ${d.shots.map((s) => `<div class="r2p-sh"><span>${s.t0}</span><span>${s.t1}</span><span>${esc(s.size)}</span><span>${esc(s.angle)}</span><span>${esc(s.move)}</span><span>${esc(s.change)}</span></div>`).join("")}</div>` : ""}</div></div>
      </section>
      ${d.prompt ? `<section class="fs-card"><h3>الوصف <small>${d.shot_count || ""} لقطة · عدّل براحتك</small></h3>
        ${d.missing.length ? `<div class="fs-err">⚠️ أجزاء ناقصة: ${d.missing.map((m) => esc(SEC_AR[m] || m)).join("، ")}</div>` : ""}
        <div class="r2p-secs">${Object.entries(SEC_AR).map(([k, v]) => `<span class="${d.missing.includes(k) ? "miss" : ""}">${v}</span>`).join("")}</div>
        <textarea class="r2p-prompt" rows="18" dir="ltr" data-rprompt>${esc(d.prompt)}</textarea>
        <div class="nb-bar"><button class="nb-btn" data-rsave>💾 احفظ</button><button class="nb-btn" data-rcopy>📋 انسخ</button></div>
        ${genPanel(d, d.prompt, "main", f.duration)}
      </section>
      <section class="fs-card"><h3>ملاحظات قبل التوليد</h3>
        ${d.notes.struggle ? `<p><b>⚠️ سيصعب عليه:</b> ${esc(d.notes.struggle)}</p>` : ""}
        ${d.notes.split ? `<p><b>✂️ التقسيم:</b> ${esc(d.notes.split)}</p>` : ""}
        ${d.clips.length ? `<div class="r2p-clips">${d.clips.map((c, k) => `<details class="r2p-clip"><summary>مقطع ${k + 1}: ${c.t0}ث ← ${c.t1}ث</summary>
            <textarea rows="10" dir="ltr" data-rclip="${k}">${esc(c.prompt)}</textarea>${genPanel(d, c.prompt, "clip" + k, c.t1 - c.t0)}</details>`).join("")}</div>` : ""}
        <p><b>🔀 للحصول على نسخة مختلفة:</b></p>
        <div class="r2p-vars">${(d.notes.variants || []).map((v) => `<button class="nb-btn sm" data-rvar="${esc(v)}">${esc(v)}</button>`).join("")}</div>
        <div class="nb-row"><label class="nb-f"><span>أو اكتب التغيير بنفسك</span><input type="text" data-rchange placeholder="مثلًا: الحركة نفسها لكن على زجاجة عطر وبلون ذهبي"></label><button class="nb-btn" data-rvarown>🔀 أنشئ نسخة</button></div>
        ${d.variants.length ? `<div class="r2p-clips">${d.variants.map((v, k) => `<details class="r2p-clip"><summary>نسخة ${k + 1}: ${esc(v.summary || v.change)}</summary>
            <textarea rows="10" dir="ltr" data-rvtext="${k}">${esc(v.prompt)}</textarea>
            <div class="nb-bar"><button class="nb-btn sm" data-ruse="${k}">⬆ اجعلها الوصف الأساسي</button></div>${genPanel(d, v.prompt, "var" + k, f.duration)}</details>`).join("")}</div>` : ""}
      </section>` : ""}
      ${gens.length ? `<section class="fs-card"><h3>ما وُلّد</h3><div class="r2p-gens">${gens.map((g) => `<figure>${g.url ? `<video src="${g.url}" controls playsinline></video>` : `<div class="fs-ph">${g.status === "failed" ? "⚠️" : "⏳"}</div>`}
          <figcaption>${esc(g.model_label || "")} · ${g.duration || ""}ث${g.status === "failed" ? ` · ${esc(g.error || "")}` : g.status === "working" ? ` · ${esc(g.step || "")}` : ""}</figcaption></figure>`).join("")}</div>
          <p class="nb-hint">تدخل هذه الفيديوهات أيضًا «الفيديوهات الجاهزة»: تنشرها أو تدبلجها أو تُدخلها المونتاج وتركّب المقاطع متتالية.</p></section>` : ""}
      </div>`;
  }
  function render() {
    if (!S.el) return;
    const sc = S.el.closest(".nh-scroll"), y = sc?.scrollTop;
    const open = [...S.el.querySelectorAll("details[open]")].map((x) => x.querySelector("summary")?.textContent);
    setHTML(S.el, S.d ? projectView(S.d) : listView());   // بدون وميض وهو يعمل
    S.el.querySelectorAll("details").forEach((x) => { if (open.includes(x.querySelector("summary")?.textContent)) x.open = true; });
    if (sc) sc.scrollTop = y;
  }
  async function refreshGens() {
    if (!S.d?.gens.length) return false;
    S.gens = await api("/api/gens");
    return S.gens.some((g) => S.d.gens.includes(g.id) && g.status === "working");
  }
  async function poll() {
    clearTimeout(S.timer);
    if (!S.el?.isConnected || !S.d) return;
    let again = false;
    try {
      S.d = await api(`/api/ref2p/${S.d.id}`);
      again = !!S.d.job || (await refreshGens());
      morphing(render);
    } catch {}
    if (again) S.timer = setTimeout(poll, 3000);
  }
  const textOf = (key) => (key === "main" ? S.el.querySelector("[data-rprompt]").value
    : key.startsWith("clip") ? S.el.querySelector(`[data-rclip="${key.slice(4)}"]`).value : S.el.querySelector(`[data-rvtext="${key.slice(3)}"]`).value);
  async function savePrompt() {
    const clips = S.d.clips.map((c, k) => ({ ...c, prompt: S.el.querySelector(`[data-rclip="${k}"]`)?.value ?? c.prompt }));
    S.d = await api(`/api/ref2p/${S.d.id}`, { method: "PATCH", ...jsonBody({ prompt: S.el.querySelector("[data-rprompt]").value, clips }) });
  }
  function bind(w) {
    w.addEventListener("change", (e) => {
      if (e.target.hasAttribute("data-rfile")) w.querySelector("[data-rcount]").textContent = e.target.files[0]?.name || "";
      if (e.target.matches("[data-gs], [data-gr]")) {   // التكلفة تُحدّث مع المدة والجودة
        const p = e.target.closest("[data-gen]"), m = p.querySelector("[data-gm]"), secs = +p.querySelector("[data-gs]").value, res = p.querySelector("[data-gr]").value;
        const cur = m.value; m.innerHTML = vmOptions(S.info?.video_models || [], cur, secs, res, `لـ ${secs} ث`);
      }
    });
    w.addEventListener("click", async (e) => {
      const q = (s) => e.target.closest(s);
      try {
        if (q("[data-rnew]")) {
          const file = w.querySelector("[data-rfile]").files[0];
          if (!file) return toast("ارفع الفيديو المرجعي", true);
          const form = new FormData();
          form.append("file", file);
          ["target", "goal", "note"].forEach((k) => form.append(k, w.querySelector(`[data-r="${k}"]`).value));
          S.busy = true; render();
          try { S.d = await api("/api/ref2p", { method: "POST", body: form }); } finally { S.busy = false; }
          render(); return poll();
        }
        if (q("[data-ropen]")) { S.d = await api(`/api/ref2p/${q("[data-ropen]").dataset.ropen}`); await refreshGens(); render(); return poll(); }
        if (q("[data-rback]")) { S.d = null; clearTimeout(S.timer); S.list = (await api("/api/ref2p")).items; return render(); }
        if (q("[data-rdel]") && (await uiConfirm("أتحذف هذا الفيديو وتحليله؟"))) { await api(`/api/ref2p/${S.d.id}`, { method: "DELETE" }); S.d = null; S.list = (await api("/api/ref2p")).items; return render(); }
        if (q("[data-rredo]")) { if (!(await uiConfirm("سيُعاد التحليل من البداية، وستضيع التعديلات التي في الوصف. أتُكمل؟"))) return; S.d = await api(`/api/ref2p/${S.d.id}/redo`, { method: "POST" }); render(); return poll(); }
        if (q("[data-rsave]")) { await savePrompt(); render(); return toast("✅ حُفظ"); }
        if (q("[data-rcopy]")) { await navigator.clipboard.writeText(w.querySelector("[data-rprompt]").value); return toast("✅ نُسخ"); }
        if (q("[data-rvar]") || q("[data-rvarown]")) {
          const change = q("[data-rvar]")?.dataset.rvar || w.querySelector("[data-rchange]").value.trim();
          if (!change) return toast("اكتب ما الذي يتغيّر", true);
          await savePrompt();
          S.d = await api(`/api/ref2p/${S.d.id}/variant`, { method: "POST", ...jsonBody({ change }) }); render(); return poll();
        }
        if (q("[data-ruse]")) {
          const v = w.querySelector(`[data-rvtext="${q("[data-ruse]").dataset.ruse}"]`).value;
          w.querySelector("[data-rprompt]").value = v; await savePrompt(); render(); return toast("✅ أصبح الوصف الأساسي");
        }
        if (q("[data-rgen]")) {
          const key = q("[data-rgen]").dataset.rgen, p = q("[data-gen]");
          const fd = new FormData();
          fd.append("prompt", textOf(key));
          fd.append("model", p.querySelector("[data-gm]").value);
          fd.append("duration", p.querySelector("[data-gs]").value);
          fd.append("ratio", ratioOf(S.d));
          fd.append("resolution", p.querySelector("[data-gr]").value);
          fd.append("audio", "true");
          const g = await api("/api/gens/video", { method: "POST", body: fd });
          S.d = await api(`/api/ref2p/${S.d.id}`, { method: "PATCH", ...jsonBody({ gens: [...S.d.gens, g.id] }) });
          toast("🎬 بدأ التوليد");
          await refreshGens(); render(); return poll();
        }
      } catch (err) { toast(err.message, true); }
    });
  }
  async function mount(root) {
    const w = root.querySelector("#r2pWrap");
    if (!w) return;
    S.el = w;
    bind(w);
    try {
      const [r, info] = await Promise.all([api("/api/ref2p"), S.info || api("/api/gens/info")]);
      S.list = r.items; S.targets = r.targets; S.info = info;
      if (S.d) { S.d = await api(`/api/ref2p/${S.d.id}`); await refreshGens(); render(); poll(); } else render();
    } catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  const back = () => { if (!S.d) return false; S.d = null; clearTimeout(S.timer); render(); return true; };
  return { html, mount, back, close: () => clearTimeout(S.timer) };
})();
