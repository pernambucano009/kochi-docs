// 📖 «حكاية»: قصة بصوت راوي، كل مشهد مرسوم بالكود ومتظبط على الكلام، والكلام بيظهر كلمة كلمة.
// الفكرة ← الحكاية (تتعدّل) ← صوت الراوي (مولّد أو بصوتك) ← المشاهد (صورة من كل واحد) ← الفيديو. والستايل يتغيّر في أي وقت.
const HekayaPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, list: [], opt: null, d: null, timer: null, busy: false, form: { style: "felt" } };
  const STEPS = [["story", "1 · الحكاية"], ["voice", "2 · صوت الراوي"], ["scenes", "3 · المشاهد"], ["done", "4 · الفيديو"]];
  const ORDER = STEPS.map(([k]) => k);
  const reached = (d, k) => ORDER.indexOf(d.stage) >= ORDER.indexOf(k);
  const html = () => `<div class="nb-wrap fs-wrap hk-wrap" id="hkWrap"><div class="nh-empty">بيحمّل…</div></div>`;
  const opt = (o, cur) => Object.entries(o).map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? "selected" : ""}>${esc(t)}</option>`).join("");
  const FEATS = [["🎙️", "الصوت الأول", "المشاهد بتتظبط على كلام الراوي، مش العكس"], ["💬", "الكلام كلمة كلمة", "كل كلمة بتظهر لحظة ما بتتقال، والمهمة بلون"],
    ["🎨", `${13} ستايل`, "لبّاد، ورق، شمع، ألوان مية، صلصال، طباشير، نيون…"], ["🔁", "غيّر الستايل في ثانية", "نفس المشاهد بخامة تانية من غير ما تترسم تاني"],
    ["🦊", "شخصيات ثابتة", "نفس الشخصية بنفس الشكل في كل المشاهد"], ["🎵", "موسيقى بالحساب", "بتوطى لوحدها لما الراوي يتكلم، وضربة في اللحظة الكبيرة"]];

  function stylePicker(cur, attr) {
    return `<div class="hk-styles">${(S.opt?.styles || []).map((s) => `<button type="button" class="hk-style${s.key === cur ? " on" : ""}" ${attr}="${esc(s.key)}" title="${esc(s.desc)}">
        <span class="hk-sw" style="background:linear-gradient(135deg,${s.swatch.join(",")})"><img src="/api/hekaya-style/${esc(s.key)}.jpg" alt="" loading="lazy" onerror="this.remove()"></span>
        <b>${esc(s.ar)}</b><small>${esc(s.desc)}</small></button>`).join("")}</div>`;
  }
  function newForm() {
    const o = S.opt, f = S.form;
    return `<section class="fs-card"><h3>حكاية جديدة</h3>
      <div class="fs-grid">
        <label class="nb-f fs-span"><span>الفكرة</span><textarea rows="3" data-h="idea" placeholder="مثلًا: ثعلب صغير بيحلم يوصل للقمر، فبيبني صاروخ من الكراتين">${esc(f.idea)}</textarea></label>
        <label class="nb-f"><span>لمين</span><select data-h="audience">${opt(o.audiences, f.audience || "kids")}</select></label>
        <label class="nb-f"><span>اللغة واللهجة</span><input type="text" data-h="lang" value="${esc(f.lang ?? o.lang)}"></label>
        <label class="nb-f"><span>الطول</span><select data-h="length">${o.lengths.map((x) => `<option value="${x}" ${x === +(f.length || 40) ? "selected" : ""}>${x} ثانية</option>`).join("")}</select></label>
        <label class="nb-f"><span>المقاس</span><select data-h="ratio">${o.ratios.map((x) => `<option ${x === (f.ratio || "16:9") ? "selected" : ""}>${x}</option>`).join("")}</select></label>
        <label class="nb-f"><span>الموسيقى</span><select data-h="mood">${opt(o.moods, f.mood || "playful")}</select></label>
        <label class="nb-f"><span>صوت الراوي</span><select data-h="voice_id">${opt(o.voices, f.voice_id)}</select></label>
        <label class="nb-f"><span>النهاية</span><select data-h="ending">${opt(o.endings, f.ending || "none")}</select></label>
        <label class="nb-f"><span>الكلمة اللي يكتبوها في الكومنت</span><input type="text" data-h="keyword" value="${esc(f.keyword)}" placeholder="مثلًا: حكاية"></label>
        <label class="nb-f fs-span"><span>جملة الدعوة (اختياري)</span><input type="text" data-h="cta_line" value="${esc(f.cta_line)}" placeholder="مثلًا: وهبعتلك الحكاية كاملة"></label>
      </div>
      <h4 class="hk-h">الستايل</h4>${stylePicker(f.style, "data-hnstyle")}
      <div class="nb-bar"><button class="nb-btn fs-go" data-hnew ${S.busy ? "disabled" : ""}>✍️ اكتب الحكاية</button></div></section>`;
  }
  function listView() {
    return `<section class="fs-hero">
        <div class="fs-hero-t"><b>حكاية</b><span class="latin">STORY</span></div>
        <p>اكتب فكرة، والبرنامج يكتب الحكاية مشهد مشهد، ويسجّلها بصوت راوي (أو بصوتك)، وبعدين يرسم كل مشهد بالكود على توقيت الكلام بالظبط، والكلام بيظهر على الشاشة كلمة كلمة. وتقدر تعدّل في كل خطوة قبل اللي بعدها.</p>
        <div class="fs-feats">${FEATS.map(([i, t, s]) => `<div class="fs-feat"><i>${i}</i><b>${t}</b><small>${s}</small></div>`).join("")}</div>
        <ol class="fs-steps">${STEPS.map(([, t]) => `<li>${t}</li>`).join("")}</ol></section>
      ${newForm()}
      <div class="fs-list">${S.list.map((p) => `<button class="fs-item" data-hopen="${p.id}">
          ${p.video ? `<video src="${p.video}" muted preload="metadata"></video>` : p.stills[0] ? `<img src="${p.stills[0].url}" alt="">` : `<span class="fs-ph">📖</span>`}
          <b>${esc(p.title)}</b><small>${esc(STEPS.find(([k]) => k === p.stage)?.[1] || "")}${p.job ? " · ⏳ " + esc(p.step || "") : ""}${p.error ? " · ⚠️" : ""}</small></button>`).join("")}</div>`;
  }

  function storySec(d) {
    const st = d.story;
    if (!st) return "";
    const locked = reached(d, "voice");
    return `<section class="fs-card"><h3>1 · الحكاية <small>${st.scenes.length} مشهد · عدّل الكلام والمشاهد براحتك</small></h3>
      <label class="nb-f"><span>العنوان</span><input type="text" data-htitle value="${esc(st.title)}"></label>
      <div class="hk-scenes">${st.scenes.map((s, k) => `<div class="hk-sc${s.end ? " end" : ""}" data-k="${k}">
          <b class="num">${k + 1}</b>
          <div class="hk-sc-b"><textarea rows="2" data-hs="text" placeholder="الكلام اللي الراوي هيقوله">${esc(s.text)}</textarea>
            ${s.end ? `<small class="hk-tag">${s.end === "card" ? "🪧 كارت النهاية" : "📣 الدعوة"}</small>` : `<input type="text" data-hs="visual" dir="auto" value="${esc(s.visual)}" placeholder="إيه اللي على الشاشة">
            <label class="hk-big"><input type="checkbox" data-hs="big" ${s.big ? "checked" : ""}> اللحظة الكبيرة (هزّة وضربة)</label>`}</div>
          <button class="nb-btn sm danger" data-hdel title="شيل المشهد">✕</button></div>`).join("")}</div>
      <div class="nb-bar"><button class="nb-btn sm" data-hadd>＋ مشهد</button><button class="nb-btn" data-hsave>💾 احفظ التعديلات</button>
        ${locked ? `<span class="nb-state">⚠️ لو غيّرت كلام الراوي، الصوت والمشاهد هيتعملوا تاني</span>` : ""}</div>
      <div class="nb-row"><label class="nb-f"><span>أو اطلب تعديل</span><input type="text" data-hnote="story" placeholder="مثلًا: خلّي البطل بنت، وزوّد مشهد فيه مطر"></label><button class="nb-btn" data-hredo="story">✍️ اكتبها تاني</button></div>
      ${!d.voice ? `<div class="nb-bar"><select data-hvoice>${opt(S.opt.voices, d.inputs.voice_id)}</select><button class="nb-btn fs-go" data-hvgo>🎙️ سجّل بصوت الراوي</button>
        <label class="nb-btn">⬆ أو ارفع صوتك<input type="file" accept="audio/*,video/*" data-hvup hidden></label></div>
        <p class="nb-hint">لو هتسجّل بصوتك: اقرا الكلام اللي فوق بالترتيب، بحماس وبراحة. البرنامج هيسمعه ويظبط كل مشهد على كلامك.</p>` : ""}
    </section>`;
  }
  function voiceSec(d) {
    if (!d.voice) return "";
    return `<section class="fs-card"><h3>2 · صوت الراوي <small>${d.voice.dur}ث · الفيديو ${d.total}ث</small></h3>
      <audio src="${d.voice.url}" controls preload="metadata"></audio>
      <div class="hk-timing">${d.timing.map((t, k) => `<span><b class="num">${k + 1}</b> ${t.s.toFixed(1)}–${t.e.toFixed(1)}ث</span>`).join("")}</div>
      <div class="nb-bar"><select data-hvoice>${opt(S.opt.voices, d.inputs.voice_id)}</select><button class="nb-btn" data-hvgo>🔁 سجّل تاني</button>
        <label class="nb-btn">⬆ ارفع صوتك<input type="file" accept="audio/*,video/*" data-hvup hidden></label>
        ${!d.has_code ? `<button class="nb-btn fs-go" data-hscgo>🎨 ارسم المشاهد</button>` : ""}</div></section>`;
  }
  function scenesSec(d) {
    if (!d.has_code && !d.stills.length) return "";
    const sc = d.story.scenes;
    const stale = d.stills.length && d.stills[0].style !== d.inputs.style;
    return `<section class="fs-card"><h3>3 · المشاهد <small>صورة من كل مشهد · دوس على مشهد ترسمه تاني</small></h3>
      ${stylePicker(d.inputs.style, "data-hstyle")}
      ${stale ? `<div class="fs-busy">🎨 الستايل اتغيّر: <button class="nb-btn sm" data-hrestyle>شوف المشاهد بالستايل الجديد</button></div>` : ""}
      <div class="hk-stills">${d.stills.map((s) => `<figure class="hk-still"><img src="${s.url}" alt="" loading="lazy"><figcaption><b class="num">${s.i + 1}</b> ${esc(sc[s.i]?.text || "")}</figcaption>
          ${sc[s.i] && !sc[s.i].end ? `<button class="nb-btn sm" data-hone="${s.i}">🔁 ارسمه تاني</button>` : ""}</figure>`).join("")}</div>
      <div class="nb-row"><label class="nb-f"><span>ملاحظة على كل المشاهد</span><input type="text" data-hnote="scenes" placeholder="مثلًا: حركة أكتر، والثعلب أكبر شوية"></label><button class="nb-btn" data-hredo="scenes">🎨 ارسمهم تاني</button></div>
      ${comicsCard(d)}
      <div class="nb-bar"><button class="nb-btn fs-go" data-hrender>🎬 اعمل الفيديو</button><span class="nb-state">الفيديو بياخد دقايق (كل فريم بيترسم)</span></div></section>`;
  }
  function comicsCard(d) {
    const c = d.comics || { items: [] }, ev = c.every || .35;
    return `<div class="hk-cm"><h4 class="hk-h">🎭 كوميكس أوتوماتيك <small class="nb-state">${d.comics_total || 0} كوميك جاهز في المكتبة</small></h4>
      <div class="nb-bar"><select data-hcmevery>${[[.2, "قليل"], [.35, "متوسط"], [.5, "كتير"]].map(([v, t]) => `<option value="${v}" ${Math.abs(v - ev) < .01 ? "selected" : ""}>${t}</option>`).join("")}</select>
        <label class="hk-big"><input type="checkbox" data-hcmaudio ${c.audio !== false ? "checked" : ""}> صوت الكوميك</label>
        <button class="nb-btn" data-hcmgo>🎭 ${c.items.length ? "اختار تاني" : "اختار كوميكس للمشاهد"}</button>${c.items.length ? `<button class="nb-btn sm" data-hcmclear>شيل الكل</button>` : ""}</div>
      ${c.items.length ? `<div class="hk-cms">${c.items.map((x, n) => `<figure><img src="${x.thumb}" alt=""><figcaption><b class="num">${x.scene + 1}</b> ${esc(x.emotion)}${x.has_audio ? " 🔊" : ""}<small>${esc(x.why)}</small></figcaption>
          <button class="nb-btn sm danger" data-hcmrm="${n}">✕</button></figure>`).join("")}</div><p class="nb-hint">هيتحطوا فوق المشاهد دي في الفيديو لما تدوس «اعمل الفيديو».</p>` : ""}</div>`;
  }
  function videoSec(d) {
    if (!d.video) return "";
    const st = S.opt.styles.find((x) => x.key === d.video_style);
    return `<section class="fs-card"><h3>4 · الفيديو <small>${esc(st?.ar || "")}</small></h3>
      <video class="hk-video" src="${d.video}" controls playsinline></video>
      <div class="nb-bar"><a class="nb-btn" href="${d.video}" download>⬇ نزّل</a><span class="nb-state">عايزه بستايل تاني؟ اختار الستايل فوق ودوس «اعمل الفيديو» تاني.</span></div></section>`;
  }
  function projectView(d) {
    const busy = !!d.job;
    return `<div class="fs-top"><button class="nb-btn sm" data-hback>→ كل الحكايات</button><b>${esc(d.title)}</b>
        <button class="nb-btn sm danger" data-hdelp ${busy ? "disabled" : ""}>حذف</button></div>
      <ol class="fs-steps hk-steps">${STEPS.map(([k, t]) => `<li class="${reached(d, k) ? "on" : ""}">${t}</li>`).join("")}</ol>
      ${busy ? `<div class="fs-busy">⏳ ${esc(d.step || "شغال…")}</div>` : d.error ? `<div class="fs-err">⚠️ ${esc(d.error)}</div>` : ""}
      <div class="${busy ? "fs-lock" : ""}">${storySec(d)}${voiceSec(d)}${scenesSec(d)}${videoSec(d)}</div>`;
  }
  function render() {
    if (!S.el) return;
    const keep = S.el.closest(".nh-scroll")?.scrollTop;
    setHTML(S.el, S.d ? projectView(S.d) : listView());   // من غير وميض وهو شغال
    if (keep != null) S.el.closest(".nh-scroll").scrollTop = keep;
  }
  function poll() {
    clearTimeout(S.timer);
    if (!S.d?.job) return;
    S.timer = setTimeout(async () => {
      try { S.d = await api(`/api/hekaya/${S.d.id}`); render(); } catch {}
      poll();
    }, 2500);
  }
  async function act(path, opts) {
    try { S.d = await api(`/api/hekaya/${S.d.id}${path}`, opts); render(); poll(); }
    catch (err) { toast(err.message, true); }
  }
  const scenesFromDom = () => [...S.el.querySelectorAll(".hk-sc")].map((row) => {
    const g = (k) => row.querySelector(`[data-hs="${k}"]`);
    const old = S.d.story.scenes[+row.dataset.k] || {};
    return { text: g("text").value, visual: g("visual")?.value ?? old.visual, big: g("big") ? g("big").checked : false, keys: old.keys, end: old.end ?? null };
  });
  async function saveStory() {
    try { S.d = await api(`/api/hekaya/${S.d.id}`, { method: "PATCH", ...jsonBody({ title: S.el.querySelector("[data-htitle]")?.value, scenes: scenesFromDom() }) }); render(); return true; }
    catch (err) { toast(err.message, true); return false; }
  }
  function bind(w) {
    w.addEventListener("input", (e) => { const k = e.target.dataset.h; if (k) S.form[k] = e.target.value; });
    w.addEventListener("change", async (e) => {
      if (e.target.matches("[data-hvup]") && e.target.files[0]) {
        const fd = new FormData();
        fd.append("file", e.target.files[0]);
        toast("⬆ بيرفع الصوت…");
        return act("/voice/upload", { method: "POST", body: fd });
      }
    });
    w.addEventListener("click", async (e) => {
      const q = (sel) => e.target.closest(sel);
      if (q("[data-hnstyle]")) { S.form.style = q("[data-hnstyle]").dataset.hnstyle; return render(); }
      if (q("[data-hnew]")) {
        if ((S.form.idea || "").trim().length < 3) return toast("اكتب فكرة الحكاية", true);
        S.busy = true; render();
        try { S.d = await api("/api/hekaya", { method: "POST", ...jsonBody({ inputs: { ...S.form, length: +(S.form.length || 40) } }) }); S.form = { style: S.form.style }; poll(); }
        catch (err) { toast(err.message, true); }
        S.busy = false; return render();
      }
      if (q("[data-hopen]")) { try { S.d = await api(`/api/hekaya/${q("[data-hopen]").dataset.hopen}`); render(); poll(); } catch (err) { toast(err.message, true); } return; }
      if (q("[data-hback]")) return back();
      if (!S.d) return;
      if (q("[data-hdelp]")) {
        if (!confirm("تمسح الحكاية دي؟")) return;
        try { await api(`/api/hekaya/${S.d.id}`, { method: "DELETE" }); back(); } catch (err) { toast(err.message, true); }
        return;
      }
      if (q("[data-hadd]")) { const sc = scenesFromDom(); const at = sc.findIndex((s) => s.end); sc.splice(at < 0 ? sc.length : at, 0, { text: "", visual: "", big: false, end: null }); S.d.story.scenes = sc; return render(); }
      if (q("[data-hdel]")) { const sc = scenesFromDom(); sc.splice(+q(".hk-sc").dataset.k, 1); S.d.story.scenes = sc; return render(); }
      if (q("[data-hsave]")) { if (await saveStory()) toast("✅ اتحفظ"); return; }
      if (q("[data-hredo]")) {
        const k = q("[data-hredo]").dataset.hredo, note = w.querySelector(`[data-hnote="${k}"]`)?.value.trim() || "";
        if (k === "story" && !note && !confirm("تكتب الحكاية من الأول؟")) return;
        return act(`/${k}`, { method: "POST", ...jsonBody({ note }) });
      }
      if (q("[data-hvgo]")) {
        if (!S.d.voice && !(await saveStory())) return;
        return act("/voice", { method: "POST", ...jsonBody({ voice_id: w.querySelector("[data-hvoice]")?.value || "" }) });
      }
      if (q("[data-hscgo]")) return act("/scenes", { method: "POST", ...jsonBody({}) });
      if (q("[data-hone]")) {
        const i = +q("[data-hone]").dataset.hone, note = prompt(`عايز إيه يتغيّر في المشهد ${i + 1}؟ (سيبه فاضي يرسمه أحسن)`, "");
        if (note === null) return;
        return act("/scenes", { method: "POST", ...jsonBody({ note, scene: i }) });
      }
      if (q("[data-hstyle]")) {
        const style = q("[data-hstyle]").dataset.hstyle;
        if (style === S.d.inputs.style) return;
        try { S.d = await api(`/api/hekaya/${S.d.id}`, { method: "PATCH", ...jsonBody({ inputs: { style } }) }); } catch (err) { return toast(err.message, true); }
        return act("/stills", { method: "POST" });
      }
      if (q("[data-hrestyle]")) return act("/stills", { method: "POST" });
      if (q("[data-hrender]")) return act("/render", { method: "POST" });
      if (q("[data-hcmgo]")) return act("/comics", { method: "POST", ...jsonBody({ every: +w.querySelector("[data-hcmevery]").value, audio: w.querySelector("[data-hcmaudio]").checked }) });
      if (q("[data-hcmclear]")) return act("/comics", { method: "POST", ...jsonBody({ clear: true }) });
      if (q("[data-hcmrm]")) return act("/comics", { method: "POST", ...jsonBody({ remove: +q("[data-hcmrm]").dataset.hcmrm }) });
    });
  }
  async function mount(root) {
    const w = root.querySelector("#hkWrap");
    if (!w) return;
    S.el = w;
    bind(w);
    try {
      const r = await api("/api/hekaya");
      S.list = r.items; S.opt = r.options;
      if (S.d) { S.d = await api(`/api/hekaya/${S.d.id}`); poll(); }
      render();
    } catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  function back() {
    if (!S.d) return false;
    S.d = null; clearTimeout(S.timer);
    api("/api/hekaya").then((r) => { S.list = r.items; render(); }).catch(() => render());
    render();
    return true;
  }
  return { html, mount, back, close: () => clearTimeout(S.timer) };
})();
