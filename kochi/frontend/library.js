// 🧍 الشخصيات و🎙️ التعليق الصوتي و🎵 الموسيقى: صفحات بشكل الرئيسية الجديدة (جوه «الأصول»).
// الشخصية: صورتها، وصف، صور كاركتر شيت، صوت، وإنترو وأوترو بيتحطوا في المونتاج لوحدهم.

const libEsc = (s) => escapeHtml(String(s ?? ""));
const libDur = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");

const CharactersPage = (() => {
  const S = { list: [], open: null, el: null, adding: false };
  const cur = () => S.list.find((c) => c.id === S.open) || null;
  const html = () => `<div class="nb-wrap" id="chWrap"><div class="nh-empty">بيحمّل…</div></div>`;

  const vidBox = (c, k, label, hint) => `<div class="nb-vid">
    <div class="nb-vh"><b>${label}</b>${c[`${k}_duration`] ? `<span class="num">${libDur(c[`${k}_duration`])}</span>` : ""}</div>
    ${c[`${k}_url`] ? `<div class="nb-vbox"><video src="${libEsc(c[`${k}_url`])}" controls preload="metadata" playsinline></video></div>` : `<div class="nb-none">${hint}</div>`}
    <div class="nb-row"><label class="nb-btn sm">⬆ ارفع فيديو<input type="file" accept="video/*" data-cfile="${k}" hidden></label>
      ${c[`${k}_url`] ? `<button class="nb-btn sm danger" data-cdel="${k}">شيله</button>` : ""}</div></div>`;

  function detail(c) {
    return `<section class="nh-tile nh-panel nb-card ch-detail">
      <div class="ch-top">
        <div class="ch-face"><img src="${libEsc(c.image_url)}" alt=""><label class="nb-btn sm">تغيير الصورة<input type="file" accept="image/*" data-cfile="image" hidden></label></div>
        <div class="ch-info">
          <div class="nb-row"><label class="nb-f"><span>الاسم</span><input type="text" data-cf="name" value="${libEsc(c.name)}"></label>
            <button class="nb-btn sm danger" data-cremove>احذف الشخصية</button><button class="nb-btn sm" data-cclose>✕ قفل</button></div>
          <label class="nb-f"><span>وصفها (الشكل، اللبس، الشخصية، طريقة الكلام)</span><textarea rows="3" data-cf="about" placeholder="مثلًا: بنت عشرينية محجبة، لبس رياضي واسع، بتتكلم بحماس">${libEsc(c.about)}</textarea></label>
          <div class="nb-row"><label class="nb-f"><span>إنستجرام</span><input type="text" dir="ltr" data-cf="instagram" value="${libEsc(c.instagram || "")}" placeholder="@handle"></label>
            <label class="nb-f"><span>تيك توك</span><input type="text" dir="ltr" data-cf="tiktok" value="${libEsc(c.tiktok || "")}" placeholder="@handle"></label></div>
        </div>
      </div>
      <div class="ch-sec"><div class="nb-kh"><b>صور الكاركتر شيت</b><span class="num">${c.sheet.length}</span>
        <label class="nb-btn sm">⬆ ارفع صور<input type="file" accept="image/*" multiple data-sheet hidden></label></div>
        <p class="nb-hint">زوايا وتعبيرات مختلفة لنفس الشخصية، عشان التوليد يحافظ على شكلها.</p>
        <div class="nb-imgs">${c.sheet.map((x) => `<figure data-sfile="${libEsc(x.file)}"><img src="${libEsc(x.url)}" alt="" loading="lazy"><button class="nb-x" data-sdel title="احذف">✕</button></figure>`).join("") || `<div class="nb-none">مفيش صور لسه</div>`}</div></div>
      <div class="ch-sec"><div class="nb-kh"><b>الصوت</b></div>
        <p class="nb-hint">عينة من صوت الشخصية (أي ملف صوت أو فيديو).</p>
        <div class="nb-row">${c.voice_url ? `<audio src="${libEsc(c.voice_url)}" controls preload="none"></audio><button class="nb-btn sm danger" data-cdel="voice">شيله</button>` : `<span class="nb-none" style="flex:1">مفيش صوت لسه</span>`}
          <label class="nb-btn sm">⬆ ارفع صوت<input type="file" accept="audio/*,video/*" data-cfile="voice" hidden></label></div></div>
      <div class="ch-sec"><p class="nb-hint">لو الفيديو للشخصية دي: إنترو الشخصية قبل الفيديو، وأوترو الشخصية بعده وقبل أوترو البراند. تقدر تشيلهم من أي مشروع في المونتاج.</p>
        <div class="nb-vids">${vidBox(c, "intro", "إنترو الشخصية", "مفيش إنترو")}${vidBox(c, "outro", "أوترو الشخصية", "مفيش أوترو")}</div></div>
    </section>`;
  }

  function render() {
    const w = S.el;
    if (!w) return;
    const c = cur();
    w.innerHTML = `
      <div class="nb-bar"><button class="nb-btn" data-cnew>＋ شخصية جديدة</button><span class="nb-state">${S.list.length} شخصية</span></div>
      ${S.adding ? `<section class="nh-tile nh-panel nb-card ch-new"><div class="nb-row">
          <label class="nb-f"><span>اسم الشخصية</span><input type="text" id="chNewName" placeholder="مثلًا: سارة"></label>
          <label class="nb-btn">🖼️ اختار صورتها<input type="file" accept="image/*" id="chNewImg" hidden></label>
          <button class="nb-btn" data-cnewgo>حفظ</button><button class="nb-btn danger" data-cnewx>إلغاء</button></div>
          <p class="nb-hint">بعد الحفظ تقدر تضيف الكاركتر شيت والصوت والإنترو والأوترو.</p></section>` : ""}
      ${c ? detail(c) : ""}
      <div class="ch-grid">${S.list.map((x) => `<div class="ch-card ${x.id === S.open ? "on" : ""}" data-cid="${x.id}" tabindex="0" role="button">
          <img src="${libEsc(x.image_url)}" alt="" loading="lazy"><b>${libEsc(x.name)}</b>
          <div class="ch-tags">${x.sheet.length ? `<span>${x.sheet.length} صورة</span>` : ""}${x.voice_url ? "<span>صوت</span>" : ""}${x.intro_url ? "<span>إنترو</span>" : ""}${x.outro_url ? "<span>أوترو</span>" : ""}</div></div>`).join("")
        || `<div class="nh-empty">لسه مفيش شخصيات. دوس «＋ شخصية جديدة».</div>`}</div>`;
    if (S.adding) w.querySelector("#chNewName")?.focus();
  }

  async function save(fn, msg) {
    try {
      const c = await fn();
      if (c?.id) S.list = S.list.some((x) => x.id === c.id) ? S.list.map((x) => (x.id === c.id ? c : x)) : [...S.list, c];
      render();
      if (msg) toast(msg);
    } catch (err) { toast(err.message, true); }
  }
  const patch = (fields) => {
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => form.append(k, v));
    return save(() => api(`/api/coaches/${S.open}`, { method: "PATCH", body: form }));
  };

  function bind(w) {
    w.addEventListener("click", async (e) => {
      const t = e.target;
      if (t.closest("[data-cnew]")) { S.adding = true; return render(); }
      if (t.closest("[data-cnewx]")) { S.adding = false; return render(); }
      if (t.closest("[data-cnewgo]")) {
        const name = w.querySelector("#chNewName").value.trim(), img = w.querySelector("#chNewImg").files[0];
        if (!name) return toast("اكتب اسم الشخصية", true);
        if (!img) return toast("اختار صورة الشخصية", true);
        const form = new FormData();
        form.append("name", name);
        form.append("image", img);
        S.adding = false;
        return save(async () => { const c = await api("/api/coaches", { method: "POST", body: form }); S.open = c.id; return c; }, "✅ الشخصية اتضافت");
      }
      if (t.closest("[data-cclose]")) { S.open = null; return render(); }
      if (t.closest("[data-cremove]")) {
        const c = cur();
        if (!c || !confirm(`تحذف «${c.name}» بكل صورها وفيديوهاتها؟`)) return;
        try { await api(`/api/coaches/${c.id}`, { method: "DELETE" }); S.list = S.list.filter((x) => x.id !== c.id); S.open = null; render(); }
        catch (err) { toast(err.message, true); }
        return;
      }
      const del = t.closest("[data-cdel]");
      if (del) { if (confirm("تشيله؟")) patch({ [`remove_${del.dataset.cdel}`]: "true" }); return; }
      const sfig = t.closest("[data-sfile]");
      if (sfig && t.closest("[data-sdel]")) return save(() => api(`/api/coaches/${S.open}/sheet/${encodeURIComponent(sfig.dataset.sfile)}`, { method: "DELETE" }));
      const card = t.closest("[data-cid]");
      if (card) { S.open = S.open === card.dataset.cid ? null : card.dataset.cid; render(); w.closest(".nh-pgrid")?.scrollTo({ top: 0, behavior: "smooth" }); }
    });
    w.addEventListener("change", (e) => {
      const el = e.target;
      if (el.id === "chNewImg") { el.closest("label").firstChild.textContent = `🖼️ ${el.files[0]?.name || "اختار صورتها"}`; return; }
      if (el.dataset.cf) return patch({ [el.dataset.cf]: el.value });
      if (el.dataset.cfile && el.files[0]) {
        toast("⏳ بيرفع…");
        const f = el.files[0];
        el.value = "";
        return patch({ [el.dataset.cfile]: f });
      }
      if (el.hasAttribute("data-sheet") && el.files.length) {
        const form = new FormData();
        [...el.files].forEach((f) => form.append("files", f));
        el.value = "";
        return save(() => api(`/api/coaches/${S.open}/sheet`, { method: "POST", body: form }));
      }
    });
    w.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-cid]")) { e.preventDefault(); e.target.click(); }
      if (e.key === "Enter" && e.target.id === "chNewName") w.querySelector("[data-cnewgo]")?.click();
    });
  }

  async function mount(root) {
    const w = root.querySelector("#chWrap");
    if (!w) return;
    S.el = w;
    S.adding = false;
    bind(w);
    try { S.list = await api("/api/coaches"); render(); } catch (err) { w.innerHTML = `<div class="nh-empty">${libEsc(err.message)}</div>`; }
  }
  return { html, mount };
})();

// 🎙️ / 🎵 مكتبة صوت: رفع (بالسحب أو الزرار)، تشغيل، تغيير الاسم، حذف، وبحث
function makeAudioPage(kind, noun, hint) {
  const S = { list: [], q: "", el: null, playing: null };
  const html = () => `<div class="nb-wrap" id="au_${kind}"><div class="nh-empty">بيحمّل…</div></div>`;
  function rows() {
    const q = S.q.trim().toLowerCase();
    const list = S.list.filter((a) => !q || a.name.toLowerCase().includes(q));
    return list.map((a) => `<div class="au-row" data-aid="${a.id}">
        <button class="au-play" data-play title="تشغيل">${S.playing === a.id ? "❚❚" : "▶"}</button>
        <input type="text" class="au-name" data-aname value="${libEsc(a.name)}">
        <span class="num au-dur">${libDur(a.duration)}</span>
        <button class="nb-btn sm danger" data-adel>احذف</button></div>`).join("")
      || `<div class="nh-empty">${S.list.length ? "مفيش نتايج." : `لسه مفيش ${noun}. اسحب ملفات هنا أو دوس «ارفع».`}</div>`;
  }
  function render() {
    const w = S.el;
    if (!w) return;
    w.innerHTML = `
      <div class="nb-bar"><label class="nb-btn">⬆ ارفع<input type="file" accept="audio/*,video/*" multiple data-aup hidden></label>
        <input type="text" class="au-q" data-aq placeholder="دوّر بالاسم" value="${libEsc(S.q)}"><span class="nb-state">${S.list.length} ${noun}</span></div>
      <p class="nb-hint au-hint">${hint}</p>
      <div class="au-drop"><div class="au-list">${rows()}</div></div>`;
  }
  const player = new Audio();
  player.addEventListener("ended", () => { S.playing = null; S.el && (S.el.querySelector(".au-list").innerHTML = rows()); });
  async function upload(files) {
    files = [...files];
    if (!files.length) return;
    let ok = 0;
    for (const f of files) {
      toast(`⏳ بيرفع ${f.name}…`);
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", f);
      try { await api("/api/audio", { method: "POST", body: form }); ok++; } catch (err) { toast(`${f.name}: ${err.message}`, true); }
    }
    S.list = await api(`/api/audio?kind=${kind}`);
    render();
    if (ok) toast(`✅ اترفع ${ok}`);
  }
  function bind(w) {
    w.addEventListener("click", async (e) => {
      const row = e.target.closest("[data-aid]");
      if (!row) return;
      const a = S.list.find((x) => x.id === row.dataset.aid);
      if (e.target.closest("[data-play]")) {
        if (S.playing === a.id) { player.pause(); S.playing = null; }
        else { player.src = a.url; player.play().catch(() => {}); S.playing = a.id; }
        w.querySelector(".au-list").innerHTML = rows();
      }
      if (e.target.closest("[data-adel]") && confirm(`تحذف «${a.name}»؟`)) {
        try { await api(`/api/audio/${a.id}`, { method: "DELETE" }); S.list = S.list.filter((x) => x.id !== a.id); if (S.playing === a.id) player.pause(); render(); }
        catch (err) { toast(err.message, true); }
      }
    });
    w.addEventListener("change", async (e) => {
      if (e.target.dataset.aup !== undefined && e.target.files.length) { const f = e.target.files; await upload(f); return; }
      const row = e.target.closest("[data-aid]");
      if (row && e.target.hasAttribute("data-aname")) {
        try { await api(`/api/audio/${row.dataset.aid}`, { method: "PATCH", ...jsonBody({ name: e.target.value }) }); S.list.find((x) => x.id === row.dataset.aid).name = e.target.value.trim(); }
        catch (err) { toast(err.message, true); }
      }
    });
    w.addEventListener("input", (e) => { if (e.target.hasAttribute("data-aq")) { S.q = e.target.value; w.querySelector(".au-list").innerHTML = rows(); } });
    w.addEventListener("dragover", (e) => { e.preventDefault(); w.classList.add("au-over"); });
    w.addEventListener("dragleave", (e) => { if (!w.contains(e.relatedTarget)) w.classList.remove("au-over"); });
    w.addEventListener("drop", (e) => { e.preventDefault(); w.classList.remove("au-over"); upload(e.dataTransfer.files); });
  }
  async function mount(root) {
    const w = root.querySelector(`#au_${kind}`);
    if (!w) return;
    player.pause();
    S.playing = null;
    S.el = w;
    bind(w);
    try { S.list = await api(`/api/audio?kind=${kind}`); render(); } catch (err) { w.innerHTML = `<div class="nh-empty">${libEsc(err.message)}</div>`; }
  }
  return { html, mount, close: () => { player.pause(); S.playing = null; } };
}
const VoicesPage = makeAudioPage("voice", "تسجيل", "تسجيلات التعليق الصوتي اللي بتستخدمها في المشاريع والمونتاج. أي ملف صوت أو فيديو (بناخد صوته).");
const MusicPage = makeAudioPage("music", "تراك", "الموسيقى اللي بتتحط تحت الفيديوهات في المونتاج.");
