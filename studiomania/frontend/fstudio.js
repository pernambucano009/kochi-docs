// 🎞️ «فريم فريم»: استوديو أنيميشن مرسوم بالكود على 5 مراحل، وانت متحكم في كل مرحلة قبل اللي بعدها:
// المدخلات ← دليل الستايل ← الفكرة والمشاهد ← صور ثابتة (المراجعة الأولى) ← الفيديو (المراجعة التانية)
const FrameStudioPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, list: [], opt: null, d: null, tab: null, timer: null, busy: false };
  const STAGES = [["inputs", "1 · المدخلات"], ["bible", "2 · دليل الستايل"], ["concept", "3 · الفكرة والمشاهد"], ["stills", "4 · الصور الثابتة"], ["done", "5 · الفيديو"]];
  const ORDER = STAGES.map(([k]) => k);
  const JOB = { bible: "bible", concept: "concept", stills: "stills", render: "done" };
  const FEATS = [
    ["✏️", "كل فريم مرسوم بالكود", "من غير موديل فيديو: مفيش تشوّه ولا رصيد فيديو"],
    ["📘", "دليل ستايل من مراجعك", "بياخد الشكل بس، ومعاه قايمة «ممنوع تنسخه» باللي في المرجع"],
    ["🎬", "فكرة واحدة ولحظة ذروة", "وعنصر واحد بيربط الفيلم كله من أوله لآخره"],
    ["📈", "منحنى طاقة", "هوك في أول ثانية ← بناء ← نفَس ← ذروة ← كارت نهاية"],
    ["🔀", "انتقالات ليها سبب", "والكاميرا مبتتحركش غير لو بتتبع حاجة أو بتكشف حاجة"],
    ["🖌️", "ملمس يدوي", "حبر بيرتعش، ورق بألياف، حبيبات، طباعة ريزو، هاف تون"],
    ["🔊", "صوت لكل حركة", "موسيقى ومؤثرات متعملة بالحساب، وانت تعدّل كل صوت ووقته"],
    ["🔍", "مراجعتين قبل التسليم", "صور ثابتة قبل الحركة، وشريط حركة بعدها، وملاحظاتك بتتطبّق"],
  ];
  const html = () => `<div class="nb-wrap fs-wrap" id="fsWrap"><div class="nh-empty">بيحمّل…</div></div>`;
  const busy = (d) => !!d?.job;
  const reached = (d, k) => ORDER.indexOf(d.stage) >= ORDER.indexOf(k);
  const opt = (list, cur) => Object.entries(list).map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? "selected" : ""}>${esc(t)}</option>`).join("");
  const optArr = (arr, cur, fmt = (x) => x) => arr.map((v) => `<option value="${esc(v)}" ${String(v) === String(cur) ? "selected" : ""}>${esc(fmt(v))}</option>`).join("");

  // ---------------------------------------------------------------- القايمة + مشروع جديد
  function inputsForm(i = {}, isNew = false) {
    const o = S.opt;
    return `<div class="fs-grid">
      <label class="nb-f fs-span"><span>الفكرة</span><textarea rows="3" data-i="idea" placeholder="مثلًا: ليه الحصان وهو بيجري بيبقى طاير في الهوا لحظة">${esc(i.idea)}</textarea></label>
      <label class="nb-f"><span>المدة</span><select data-i="duration">${optArr(o.durations, i.duration ?? 15, (x) => `${x} ثانية`)}</select></label>
      <label class="nb-f"><span>المقاس</span><select data-i="ratio">${optArr(o.ratios, i.ratio ?? "9:16")}</select></label>
      <label class="nb-f"><span>الطاقة</span><select data-i="energy">${opt(o.energy, i.energy ?? "building")}</select></label>
      <label class="nb-f"><span>الشكل</span><select data-i="format">${opt(o.formats, i.format ?? "auto")}</select></label>
      <label class="nb-f"><span>إحساس الحركة</span><select data-i="fps"><option value="30" ${i.fps == 24 ? "" : "selected"}>ناعمة (30 فريم)</option><option value="24" ${i.fps == 24 ? "selected" : ""}>مرسومة باليد (24 فريم)</option></select></label>
      <label class="nb-f"><span>الصوت</span><select data-i="sound">${opt(o.sound, i.sound ?? "on")}</select></label>
      <label class="nb-f"><span>الخط</span><select data-i="font">${optArr(["auto", ...o.fonts], i.font ?? "auto", (x) => (x === "auto" ? "على حسب الستايل" : x))}</select></label>
      <label class="nb-f"><span>عنوان على الشاشة (اختياري)</span><input type="text" data-i="title" value="${esc(i.title)}"></label>
      <label class="nb-f"><span>جملة النهاية (اختياري)</span><input type="text" data-i="closing" value="${esc(i.closing)}"></label>
      <label class="nb-f"><span>لازم يكون فيه</span><input type="text" data-i="include" value="${esc(i.include)}" placeholder="مثلًا: اللوجو في الآخر"></label>
      <label class="nb-f"><span>ممنوع يكون فيه</span><input type="text" data-i="avoid" value="${esc(i.avoid)}" placeholder="مثلًا: وشوش بشر"></label>
      ${isNew ? `<div class="fs-span fs-up"><label class="nb-btn">🖼️ المراجع (صور أو فيديو)<input type="file" accept="image/*,video/*" multiple data-fsfiles hidden></label><span class="nb-state" data-fscount>لحد 6 ملفات · ستايلات مرسومة (كولاج، ريزو، خطوط، ورق، ألوان مية) بتطلع أحلى</span></div>` : ""}
    </div>`;
  }
  const readInputs = (root) => Object.fromEntries([...root.querySelectorAll("[data-i]")].map((el) => [el.dataset.i, el.dataset.i === "duration" || el.dataset.i === "fps" ? +el.value : el.value]));
  function listView() {
    return `<section class="fs-hero">
        <div class="fs-hero-t"><b>فريم فريم</b><span class="latin">FRAME BY FRAME</span></div>
        <p>استوديو أنيميشن صغير جوه البرنامج: ترفع مرجع بستايل عاجبك وتكتب فكرتك، وهو يرسم الفيلم كله فريم فريم بالكود، بصوت متعمل لكل حركة. وفي كل مرحلة تشوف وتعدّل قبل ما يكمّل، علشان التعديل في الأول رخيص.</p>
        <div class="fs-feats">${FEATS.map(([i, t, s]) => `<div class="fs-feat"><i>${i}</i><b>${t}</b><small>${s}</small></div>`).join("")}</div>
        <ol class="fs-steps">${STAGES.map(([, t]) => `<li>${t}</li>`).join("")}</ol>
      </section>
      <section class="fs-card fs-new"><h3>مشروع جديد</h3>${inputsForm({}, true)}
        <div class="nb-bar"><button class="nb-btn fs-go" data-fsnew ${S.busy ? "disabled" : ""}>${S.busy ? "⏳ بيرفع…" : "🎨 ابدأ: ادرس الستايل"}</button></div></section>
      <div class="fs-list">${S.list.map((p) => `<button class="fs-item" data-fsopen="${p.id}">
          ${p.video ? `<video src="${p.video}" muted preload="metadata"></video>` : p.stills[0] ? `<img src="${p.stills[0].url}" alt="">` : p.refs[0] && !/\.(mp4|mov|webm|m4v)/i.test(p.refs[0]) ? `<img src="${p.refs[0]}" alt="">` : `<span class="fs-ph">🎞️</span>`}
          <b>${esc(p.title)}</b><small>${esc(STAGES.find(([k]) => k === p.stage)?.[1] || "")}${p.job ? " · ⏳ " + esc(p.step || "") : ""}${p.error ? " · ⚠️" : ""}</small></button>`).join("")}</div>`;
  }

  // ---------------------------------------------------------------- المشروع
  function stepper(d) {
    return `<nav class="fs-stepper">${STAGES.map(([k, t]) => `<button data-fstab="${k}" class="${S.tab === k ? "on" : ""} ${reached(d, k) ? "ok" : ""}" ${reached(d, k) ? "" : "disabled"}>${t}</button>`).join("")}</nav>`;
  }
  const banner = (d) => (busy(d) ? `<div class="fs-busy">⏳ ${esc(d.step || "شغال…")}</div>` : d.error ? `<div class="fs-err">⚠️ ${esc(d.error)}</div>` : "");
  const tabInputs = (d) => `<section class="fs-card"><h3>المدخلات</h3>
      <div class="fs-refs">${d.refs.map((u) => /\.(mp4|mov|webm|m4v)/i.test(u) ? `<video src="${u}" muted controls></video>` : `<img src="${u}" alt="">`).join("")}</div>
      ${inputsForm(d.inputs)}
      <div class="nb-bar"><button class="nb-btn" data-fssave="inputs">💾 احفظ</button><button class="nb-btn" data-fsrun="bible">🔁 ادرس الستايل تاني</button></div></section>`;
  function tabBible(d) {
    const b = d.bible || {};
    const f = (k, t, rows = 2) => `<label class="nb-f"><span>${t}</span><textarea rows="${rows}" data-b="${k}">${esc(b[k])}</textarea></label>`;
    return `<section class="fs-card"><h3>دليل الستايل <small>${esc(b.name || "")}</small></h3>
      <p class="nb-hint">ده اللي البرنامج فهمه من مراجعك. عدّل أي حاجة: الألوان، الملمس، الخط. وقايمة «ممنوع تنسخه» هي اللي بتضمن إنه ياخد الستايل بس من غير موضوع المرجع.</p>
      <div class="fs-pal">${(b.palette || []).map((c, k) => `<label class="fs-sw" style="--c:${esc(c)}"><input type="color" value="${esc(c)}" data-pal="${k}"><small>${esc((b.palette_roles || {})[c] || c)}</small><button data-paldel="${k}" title="شيل">✕</button></label>`).join("")}<button class="nb-btn sm" data-paladd>＋ لون</button></div>
      <div class="fs-grid">
        <label class="nb-f"><span>اسم الستايل</span><input type="text" data-b="name" value="${esc(b.name)}"></label>
        <label class="nb-f"><span>الخط</span><select data-b="type">${optArr(S.opt.fonts, b.type)}</select></label>
        ${f("look", "الشكل العام", 3)}${f("texture", "الملمس")}${f("line", "الخط والحدود")}${f("ground", "الأرضية")}${f("composition", "التكوين")}${f("motion", "إيقاع الحركة")}${f("shapes", "الأشكال")}${f("sound_cues", "أصوات العالم ده")}
        <label class="nb-f fs-span"><span>🚫 ممنوع تنسخه (سطر لكل حاجة)</span><textarea rows="3" data-b="do_not_copy">${esc((b.do_not_copy || []).join("\n"))}</textarea></label>
      </div>
      <div class="nb-bar"><button class="nb-btn" data-fssave="bible">💾 احفظ</button><button class="nb-btn" data-fsrun="bible">🔁 اكتبه تاني</button>
        <button class="nb-btn fs-go" data-fsnext="concept">✅ اعتمد ← اكتب الفكرة والمشاهد</button></div></section>`;
  }
  function timeline(d) {
    const dur = d.inputs.duration, c = d.concept || {};
    const beats = (c.beats || []).map((b, k) => `<i style="inset-inline-start:${(b.t0 / dur) * 100}%;width:${((b.t1 - b.t0) / dur) * 100}%" title="${esc(b.what)}">${k + 1}</i>`).join("");
    const sfx = (d.sound?.sfx || []).map((s) => `<em style="inset-inline-start:${(s.t / dur) * 100}%" title="${esc(s.kind)} ${s.t}ث"></em>`).join("");
    const ec = c.end_card ? `<u style="inset-inline-start:${(c.end_card.t0 / dur) * 100}%"></u>` : "";
    return `<div class="fs-tl"><div class="fs-tl-b">${beats}${ec}</div><div class="fs-tl-s">${sfx}</div><div class="fs-tl-r"><span>0</span><span>${dur}ث</span></div></div>`;
  }
  function tabConcept(d) {
    const c = d.concept || {}, s = d.sound || { sfx: [], music: {} };
    const tf = (k, t) => `<label class="nb-f"><span>${t}</span><input type="text" data-c="${k}" value="${esc(c[k])}"></label>`;
    const beat = (b, k) => `<div class="fs-beat" data-beat="${k}"><b>${k + 1}</b>
        <input type="number" step="0.1" min="0" data-bk="t0" value="${b.t0}" title="من"><input type="number" step="0.1" min="0" data-bk="t1" value="${b.t1}" title="لحد">
        <textarea rows="2" data-bk="what" placeholder="اللي بنشوفه">${esc(b.what)}</textarea>
        <input type="text" data-bk="text" value="${esc(b.text)}" placeholder="كلام على الشاشة">
        <input type="text" data-bk="transition" value="${esc(b.transition)}" placeholder="سبب الانتقال للي بعده">
        <input type="text" data-bk="camera" value="${esc(b.camera)}" placeholder="الكاميرا">
        <input type="text" data-bk="sound" value="${esc(b.sound)}" placeholder="الصوت">
        <button class="nb-btn sm danger" data-beatdel="${k}">✕</button></div>`;
    return `<section class="fs-card"><h3>الفكرة والمشاهد</h3>
      <div class="fs-grid">${tf("title", "الاسم")}<label class="nb-f"><span>الشكل</span><select data-c="format">${opt(S.opt.formats, c.format)}</select></label>
        <label class="nb-f fs-span"><span>الفكرة في جملة</span><input type="text" data-c="logline" value="${esc(c.logline)}"></label>
        ${tf("payoff", "لحظة الذروة")}${tf("device", "العنصر اللي بيربط الفيلم")}${tf("why", "ليه تهم")}</div>
      ${timeline(d)}
      <div class="fs-beats"><div class="fs-beat fs-bh"><b>#</b><span>من</span><span>لحد</span><span>اللي بنشوفه</span><span>كلام</span><span>الانتقال</span><span>الكاميرا</span><span>الصوت</span><span></span></div>
        ${(c.beats || []).map(beat).join("")}</div>
      <div class="nb-bar"><button class="nb-btn sm" data-beatadd>＋ مشهد</button>
        <label class="nb-f fs-inline"><span>كارت النهاية</span><input type="text" data-ec="text" value="${esc(c.end_card?.text)}"></label>
        <label class="nb-f fs-inline"><span>يبدأ عند</span><input type="number" step="0.1" data-ec="t0" value="${c.end_card?.t0 ?? ""}"></label></div>
    </section>
    <section class="fs-card"><h3>🔊 الصوت</h3>
      <div class="fs-grid fs-g4">
        <label class="nb-f"><span>المود</span><select data-m="mood">${optArr(S.opt.moods, s.music?.mood)}</select></label>
        <label class="nb-f"><span>السرعة (BPM)</span><input type="number" min="60" max="160" data-m="bpm" value="${s.music?.bpm ?? 100}"></label>
        <label class="nb-f"><span>المقام</span><select data-m="key">${optArr(S.opt.keys, s.music?.key)}</select></label>
        <div class="nb-f"><span>&nbsp;</span><button class="nb-btn" data-fsplay>▶ اسمع الصوت</button></div></div>
      <audio data-fsaudio controls hidden></audio>
      <div class="fs-sfx">${(s.sfx || []).map((x, k) => `<span class="fs-sfxi" data-sfx="${k}"><input type="number" step="0.1" min="0" data-sk="t" value="${x.t}"><select data-sk="kind">${optArr(S.opt.sfx, x.kind)}</select><button data-sfxdel="${k}">✕</button></span>`).join("")}
        <button class="nb-btn sm" data-sfxadd>＋ مؤثر</button></div>
      <div class="nb-bar"><button class="nb-btn" data-fssave="concept">💾 احفظ</button><button class="nb-btn" data-fsrun="concept">🔁 اكتب الفكرة تاني</button>
        <button class="nb-btn fs-go" data-fsnext="stills">✅ اعتمد ← اعمل الصور الثابتة</button></div></section>`;
  }
  const issues = (r) => (r?.issues || []).map((x, k) => `<label class="fs-issue"><input type="checkbox" data-iss="${k}" checked> ${esc(x)}</label>`).join("");
  const score = (r) => (r?.score ? `<span class="fs-score ${r.ok ? "ok" : ""}">${r.score}/10 ${r.ok ? "✓ عدّى" : "محتاج تظبيط"}</span>` : "");
  function tabStills(d) {
    return `<section class="fs-card"><h3>الصور الثابتة <small>المراجعة الأولى، قبل أي حركة</small> ${score(d.review)}</h3>
      <p class="nb-hint">صورة من كل مشهد. لازم كل واحدة تبان كأنها رسمة خلصانة: الكادر مليان، والستايل من مراجعك، ومفيش حاجة من «ممنوع تنسخه»، والكلام مقروء.</p>
      <div class="fs-stills">${d.stills.map((s) => `<figure><img src="${s.url}" alt=""><figcaption>${s.t}ث</figcaption></figure>`).join("")}</div>
      ${d.review?.issues?.length ? `<div class="fs-issues"><b>ملاحظات المخرج</b>${issues(d.review)}</div>` : ""}
      <label class="nb-f"><span>ملاحظاتك (محددة: «الأخطبوط أكبر»، «الكلام فوق»، «اللون الأحمر أهدى»)</span><textarea rows="2" data-note></textarea></label>
      <div class="nb-bar"><button class="nb-btn" data-fsfix="stills">🔧 طبّق الملاحظات</button><button class="nb-btn" data-fsrun="stills">🔁 اكتب الكود من الأول</button>
        <button class="nb-btn fs-go" data-fsnext="render">✅ اعتمد ← ارسم الفيديو</button></div></section>`;
  }
  function tabDone(d) {
    return `<section class="fs-card"><h3>الفيديو <small>المراجعة التانية</small> ${score(d.motion_review)}</h3>
      ${d.video ? `<div class="fs-vid"><video src="${d.video}" controls playsinline></video>
        <div><a class="nb-btn" href="${d.video}" download>⬇ نزّل الفيديو</a>
        ${d.strip ? `<p class="nb-hint">شريط الحركة (3 صور في الثانية): بيبيّن الإيقاع والقطعات مرة واحدة</p><img class="fs-strip" src="${d.strip}" alt="">` : ""}</div></div>` : ""}
      ${d.motion_review?.issues?.length ? `<div class="fs-issues"><b>ملاحظات المخرج على الحركة</b>${issues(d.motion_review)}</div>` : ""}
      <label class="nb-f"><span>عايز تغيّر حاجة؟ (مثلًا: «القطع عند 0:04 متأخر»، «وطّي المؤثرات»، «غيّر اللقطة كل ثانية في الأول»)</span><textarea rows="2" data-note></textarea></label>
      <div class="nb-bar"><button class="nb-btn fs-go" data-fsfix="render">✏️ عدّل وارسم تاني</button><button class="nb-btn" data-fsrun="render">🎬 ارسم تاني زي ما هو</button></div>
      ${d.notes.length ? `<details class="fs-notes"><summary>الملاحظات اللي اتطبّقت (${d.notes.length})</summary>${d.notes.map((n) => `<p>• ${esc(n.note)}</p>`).join("")}</details>` : ""}
    </section>`;
  }
  function projectView(d) {
    const tab = { inputs: tabInputs, bible: tabBible, concept: tabConcept, stills: tabStills, done: tabDone }[S.tab] || tabInputs;
    return `<div class="fs-top"><button class="nb-btn sm" data-fsback>→ كل المشاريع</button><b>${esc(d.title)}</b>
        <span class="nb-state">${d.inputs.ratio} · ${d.inputs.duration}ث</span><button class="nb-btn sm danger" data-fsdel ${busy(d) ? "disabled" : ""}>حذف</button></div>
      ${stepper(d)}${banner(d)}<div class="${busy(d) ? "fs-lock" : ""}">${tab(d)}</div>`;
  }
  function render() {
    const w = S.el;
    if (!w) return;
    const y = w.closest(".nh-scroll")?.scrollTop;
    w.innerHTML = S.d ? projectView(S.d) : listView();
    if (y != null) w.closest(".nh-scroll").scrollTop = y;
  }

  // ---------------------------------------------------------------- قراية التعديلات من الصفحة
  function readBible(w) {
    const b = { ...(S.d.bible || {}) };
    w.querySelectorAll("[data-b]").forEach((el) => { b[el.dataset.b] = el.dataset.b === "do_not_copy" ? el.value.split("\n").map((x) => x.trim()).filter(Boolean) : el.value; });
    b.palette = [...w.querySelectorAll("[data-pal]")].map((el) => el.value);
    return b;
  }
  function readConcept(w) {
    const c = { ...(S.d.concept || {}) };
    w.querySelectorAll("[data-c]").forEach((el) => { c[el.dataset.c] = el.value; });
    c.beats = [...w.querySelectorAll("[data-beat]")].map((row) => Object.fromEntries([...row.querySelectorAll("[data-bk]")].map((el) => [el.dataset.bk, el.type === "number" ? +el.value : el.value])));
    c.end_card = { text: w.querySelector('[data-ec="text"]')?.value || "", t0: +(w.querySelector('[data-ec="t0"]')?.value || 0) };
    return c;
  }
  function readSound(w) {
    const music = Object.fromEntries([...w.querySelectorAll("[data-m]")].map((el) => [el.dataset.m, el.dataset.m === "bpm" ? +el.value : el.value]));
    const sfx = [...w.querySelectorAll("[data-sfx]")].map((row) => ({ t: +row.querySelector('[data-sk="t"]').value, kind: row.querySelector('[data-sk="kind"]').value }));
    return { music, sfx };
  }
  const note = (w) => {
    const own = w.querySelector("[data-note]")?.value.trim() || "";
    const r = S.tab === "done" ? S.d.motion_review : S.d.review;
    const picked = [...w.querySelectorAll("[data-iss]:checked")].map((el) => r?.issues?.[+el.dataset.iss]).filter(Boolean);
    return [own, ...picked].filter(Boolean).join("\n- ");
  };
  async function save(kind) {
    const w = S.el, body = {};
    if (kind === "inputs") body.inputs = readInputs(w);
    if (kind === "bible") body.bible = readBible(w);
    if (kind === "concept") { body.concept = readConcept(w); body.sound = readSound(w); }
    S.d = await api(`/api/fstudio/${S.d.id}`, { method: "PATCH", ...jsonBody(body) });
  }
  async function run(job, payload) {
    S.d = await api(`/api/fstudio/${S.d.id}/${job}`, { method: "POST", ...jsonBody(payload || {}) });
    render(); poll(JOB[job]);
  }
  async function poll(goTo) {
    clearTimeout(S.timer);
    if (!S.el?.isConnected || !S.d) return;
    try {
      const d = await api(`/api/fstudio/${S.d.id}`);
      const wasBusy = busy(S.d);
      S.d = d;
      if (wasBusy && !busy(d) && !d.error && goTo && reached(d, goTo)) S.tab = goTo;
      if (wasBusy || !busy(d)) render();
    } catch {}
    if (busy(S.d)) S.timer = setTimeout(() => poll(goTo), 2500);
  }
  async function open(fid) {
    S.d = await api(`/api/fstudio/${fid}`);
    S.tab = S.d.stage;
    render(); if (busy(S.d)) poll(JOB[S.d.job]);
  }

  function bind(w) {
    w.addEventListener("change", (e) => {
      if (e.target.hasAttribute("data-fsfiles")) w.querySelector("[data-fscount]").textContent = `${e.target.files.length} ملف`;
      if (e.target.hasAttribute("data-pal")) e.target.closest(".fs-sw").style.setProperty("--c", e.target.value);
    });
    w.addEventListener("click", async (e) => {
      const q = (sel) => e.target.closest(sel);
      try {
        if (q("[data-fsnew]")) {
          const files = w.querySelector("[data-fsfiles]").files, i = readInputs(w);
          if (!i.idea.trim()) return toast("اكتب الفكرة", true);
          if (!files.length) return toast("ارفع مرجع واحد على الأقل", true);
          const form = new FormData();
          [...files].slice(0, 6).forEach((f) => form.append("files", f));
          form.append("inputs", JSON.stringify(i));
          S.busy = true; render();
          try { S.d = await api("/api/fstudio", { method: "POST", body: form }); S.tab = "inputs"; } finally { S.busy = false; }
          render(); return poll("bible");
        }
        if (q("[data-fsopen]")) return open(q("[data-fsopen]").dataset.fsopen);
        if (q("[data-fsback]")) { S.d = null; clearTimeout(S.timer); S.list = (await api("/api/fstudio")).items; return render(); }
        if (q("[data-fstab]")) { const k = q("[data-fstab]").dataset.fstab; if (reached(S.d, k)) { S.tab = k; render(); } return; }
        if (q("[data-fsdel]") && confirm("تحذف المشروع ده؟")) { await api(`/api/fstudio/${S.d.id}`, { method: "DELETE" }); S.d = null; S.list = (await api("/api/fstudio")).items; return render(); }
        if (q("[data-fssave]")) { await save(q("[data-fssave]").dataset.fssave); render(); return toast("✅ اتحفظ"); }
        if (q("[data-fsnext]")) {   // اعتمد: احفظ تعديلاتك الأول، وبعدين المرحلة اللي بعدها
          const nx = q("[data-fsnext]").dataset.fsnext;
          if (S.tab === "bible" || S.tab === "concept") await save(S.tab);
          return run(nx, {});
        }
        if (q("[data-fsrun]")) {
          const job = q("[data-fsrun]").dataset.fsrun;
          if (job === "bible" && S.tab === "inputs") await save("inputs");
          if (job !== "render" && S.d.stage !== S.tab && !confirm("ده هيعيد المرحلة دي من الأول، والمراحل اللي بعدها هتحتاج تتعمل تاني. تكمّل؟")) return;
          return run(job, {});
        }
        if (q("[data-fsfix]")) {
          const n = note(w);
          if (!n) return toast("اكتب ملاحظة أو اختار من ملاحظات المخرج", true);
          return run(q("[data-fsfix]").dataset.fsfix, { note: n });
        }
        // تعديلات جوه المرحلة (من غير ما تتحفظ لحد ما تدوس احفظ أو اعتمد)
        if (q("[data-paladd]")) { S.d.bible = readBible(w); S.d.bible.palette.push("#888888"); return render(); }
        if (q("[data-paldel]")) { e.preventDefault(); S.d.bible = readBible(w); S.d.bible.palette.splice(+q("[data-paldel]").dataset.paldel, 1); return render(); }
        if (q("[data-beatadd]")) {
          S.d.concept = readConcept(w); S.d.sound = readSound(w);
          const last = S.d.concept.beats.at(-1), t0 = last ? last.t1 : 0;
          S.d.concept.beats.push({ t0, t1: Math.min(S.d.inputs.duration, +(t0 + 1.5).toFixed(1)), what: "", text: "", transition: "", camera: "ثابتة", sound: "" });
          return render();
        }
        if (q("[data-beatdel]")) { S.d.concept = readConcept(w); S.d.sound = readSound(w); S.d.concept.beats.splice(+q("[data-beatdel]").dataset.beatdel, 1); return render(); }
        if (q("[data-sfxadd]")) { S.d.concept = readConcept(w); S.d.sound = readSound(w); S.d.sound.sfx.push({ t: 0, kind: "pop" }); return render(); }
        if (q("[data-sfxdel]")) { S.d.concept = readConcept(w); S.d.sound = readSound(w); S.d.sound.sfx.splice(+q("[data-sfxdel]").dataset.sfxdel, 1); return render(); }
        if (q("[data-fsplay]")) {
          await save("concept");
          const r = await api(`/api/fstudio/${S.d.id}/sound-preview`, { method: "POST" });
          render();
          const a = S.el.querySelector("[data-fsaudio]"); a.hidden = false; a.src = r.url; a.play().catch(() => {});
        }
      } catch (err) { toast(err.message, true); }
    });
  }
  async function mount(root) {
    const w = root.querySelector("#fsWrap");
    if (!w) return;
    S.el = w;
    bind(w);
    try {
      const r = await api("/api/fstudio");
      S.list = r.items; S.opt = r.options;
      if (S.d) await open(S.d.id); else render();
    } catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  // «رجوع» من جوه مشروع بيرجّع لقايمة المشاريع الأول
  const back = () => { if (!S.d) return false; S.d = null; clearTimeout(S.timer); render(); return true; };
  return { html, mount, back, close: () => clearTimeout(S.timer) };
})();
