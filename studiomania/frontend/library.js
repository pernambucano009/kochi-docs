// 🧍 الشخصيات و🎙️ التعليق الصوتي و🎵 الموسيقى: صفحات بشكل الرئيسية الجديدة (جوه «الأصول»).
// الشخصية: صورتها، وصف، صور كاركتر شيت، صوت، وإنترو وأوترو بيتحطوا في المونتاج لوحدهم.

const libEsc = (s) => escapeHtml(String(s ?? ""));
const libDur = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");

const CharactersPage = (() => {
  const S = { list: [], open: null, el: null, adding: false, voices: [], av: null, draft: {}, aiNew: false, aiBusy: false, timer: null };
  // ألوان كروت الشخصيات (زي البروتوتايب): كل كارت تدرّج هادي مختلف ورا الصورة
  const TINTS = [["#EFE7E1", "#D9CCC2"], ["#E4E9EF", "#C8D1DB"], ["#E3EDE4", "#C6D6C8"], ["#EFE4E9", "#D9C5CF"], ["#ECEAE3", "#D3CEC2"], ["#E6E4EF", "#CDC8DB"]];
  const tint = (i) => `background: linear-gradient(170deg, ${TINTS[i % TINTS.length][0]}, ${TINTS[i % TINTS.length][1]})`;
  // موجة شكلية ثابتة لكل تسجيل (من الـ id) لحد ما يتشغّل
  const bars = (id) => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return Array.from({ length: 34 }, (_, i) => { h = (h * 1103515245 + 12345) >>> 0; const v = 3 + (h % 15); return `<i style="height:${v}px"></i>`; }).join(""); };
  const player = new Audio();
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
        <div class="ch-face"><img src="${libEsc(c.image_url)}" alt=""><label class="nb-btn sm">تغيير الصورة<input type="file" accept="image/*" data-cfile="image" hidden></label>
          <button class="nb-btn sm" data-cai ${S.aiBusy ? "disabled" : ""} title="صورة جديدة من «وصفها»">${S.aiBusy ? "⏳" : "✨ ارسمها من الوصف"}</button></div>
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
      ${talkSec(c)}
      <div class="ch-sec"><p class="nb-hint">لو الفيديو للشخصية دي: إنترو الشخصية قبل الفيديو، وأوترو الشخصية بعده وقبل أوترو البراند. تقدر تشيلهم من أي مشروع في المونتاج.</p>
        <div class="nb-vids">${vidBox(c, "intro", "إنترو الشخصية", "مفيش إنترو")}${vidBox(c, "outro", "أوترو الشخصية", "مفيش أوترو")}</div></div>
    </section>`;
  }

  // 🗣️ الأفاتار: الشخصية بتقول أي كلام في فيديو (الصوت بلهجتك ← Kling Avatar بيحرّك البق والوش على الصوت)
  function talkSec(c) {
    const A = S.av;
    if (!A) return "";
    const d = S.draft;
    const langs = Object.entries(A.dialects || {});
    const lang = d.lang || langs[0]?.[0] || "";
    const voices = (A.dialects?.[lang]?.voices || []);
    const voice = voices.includes(d.voice) ? d.voice : voices[0];
    const model = d.model || "pro", per = A.models?.[model]?.per_sec || 0.095;
    const secs = Math.max(3, Math.round((d.text || "").length / 14));
    const opt = (g) => langs.filter(([, v]) => v.group === g).map(([k, v]) => `<option value="${k}" ${k === lang ? "selected" : ""}>${libEsc(v.label)}</option>`).join("");
    const ST = { queued: "في الطابور", working: "شغّال", done: "جاهز", failed: "وقف" };
    return `<div class="ch-sec ch-talk"><div class="nb-kh"><b>🗣️ خلّيها تتكلم</b><span class="num">${c.talks.length}</span></div>
      <p class="nb-hint">اكتب اللي الشخصية هتقوله، واختار اللهجة والصوت. البرنامج بيعمل الصوت الأول، وبعدين بيعمل فيديو والشخصية بتقوله: البُق والوش والإيد ماشيين مع الصوت، والصورة زي ما هي. أو ارفع صوتك انت.</p>
      <textarea rows="3" data-tk="text" placeholder="مثلًا: أهلًا! أنا ${libEsc(c.name)}، والنهارده هقولك على ٣ حاجات…">${libEsc(d.text || "")}</textarea>
      <div class="nb-row">
        <label class="nb-f"><span>اللهجة / اللغة</span><select data-tk="lang"><optgroup label="عربي">${opt("ar")}</optgroup><optgroup label="لغات تانية">${opt("foreign")}</optgroup></select></label>
        <label class="nb-f"><span>الصوت</span><select data-tk="voice">${voices.map((v) => `<option value="${v}" ${v === voice ? "selected" : ""}>${libEsc(A.voices?.[v] || v)}</option>`).join("")}</select></label>
        <label class="nb-f"><span>الموديل</span><select data-tk="model">${Object.entries(A.models || {}).map(([k, m]) => `<option value="${k}" ${k === model ? "selected" : ""}>${libEsc(m.label)} · $${m.per_sec}/ث</option>`).join("")}</select></label>
      </div>
      <label class="nb-f"><span>الإحساس والحركة (اختياري)</span><input type="text" data-tk="prompt" value="${libEsc(d.prompt || "")}" placeholder="مثلًا: متحمس وبيبتسم، وبيشاور بإيده على الشاشة"></label>
      <div class="nb-row"><button class="nb-btn" data-talk>🎬 خلّيها تقول الكلام ده</button>
        <label class="nb-btn sm">🎙️ أو ارفع صوتك<input type="file" accept="audio/*,video/*" data-tkaudio hidden></label>
        <small class="muted">${d.text ? `حوالي ${secs} ثانية · ~$${(secs * per).toFixed(2)}` : ""}${!A.fasih ? " · اللهجات العربية مش متاحة دلوقتي" : ""}</small></div>
      ${c.talks.length ? `<div class="ch-talks">${[...c.talks].reverse().map((t) => `<figure class="ch-tk ${t.status}">
        ${t.url ? `<video src="${libEsc(t.url)}" controls playsinline preload="metadata"></video>` : `<div class="ch-tkph">${t.status === "failed" ? "⚠️" : `<span class="spin-inline"></span>`}<small>${libEsc(t.step || ST[t.status] || "")}</small></div>`}
        <figcaption><span dir="auto">${libEsc(t.text)}</span>${t.error ? `<small class="err">${libEsc(t.error)}</small>` : ""}
          <button class="nb-x" data-tkdel="${t.id}" title="احذف">✕</button></figcaption></figure>`).join("")}</div>` : ""}
    </div>`;
  }

  function render() {
    const w = S.el;
    if (!w) return;
    const c = cur();
    w.innerHTML = `
      ${S.adding ? `<section class="nh-tile nh-panel nb-card ch-new"><div class="nb-row">
          <label class="nb-f"><span>اسم الشخصية</span><input type="text" id="chNewName" placeholder="مثلًا: سارة"></label>
          <label class="nb-btn">🖼️ اختار صورتها<input type="file" accept="image/*" id="chNewImg" hidden></label>
          <button class="nb-btn" data-cnewgo>حفظ</button><button class="nb-btn danger" data-cnewx>إلغاء</button></div>
          <p class="nb-hint">بعد الحفظ تقدر تضيف الكاركتر شيت والصوت والإنترو والأوترو.</p></section>` : ""}
      ${S.aiNew ? `<section class="nh-tile nh-panel nb-card ch-new"><div class="nb-kh"><b>✨ شخصية جديدة بالذكاء الصناعي</b></div>
          <div class="nb-row"><label class="nb-f"><span>الاسم</span><input type="text" id="chAiName" placeholder="مثلًا: سارة"></label>
            <label class="nb-f"><span>الشكل</span><select id="chAiStyle">${Object.entries(S.av?.styles || { real: "صورة حقيقية" }).map(([k, v]) => `<option value="${k}">${libEsc(v)}</option>`).join("")}</select></label></div>
          <label class="nb-f"><span>اوصفها (السن، الشكل، اللبس، المكان، الإحساس)</span><textarea rows="3" id="chAiDesc" placeholder="مثلًا: مدربة سعودية في التلاتينات، محجبة، لابسة تيشيرت رياضي أسود، في جيم منوّر، ابتسامة واثقة"></textarea></label>
          <div class="nb-row"><button class="nb-btn" data-caigo ${S.aiBusy ? "disabled" : ""}>${S.aiBusy ? "⏳ بترسمها…" : "✨ ارسمها"}</button><button class="nb-btn danger" data-caix>إلغاء</button></div>
          <p class="nb-hint">صورة نص جسم قدام الكاميرا، جاهزة تتكلم في «خلّيها تتكلم». لو مش عاجباك ارسمها تاني من صفحتها.</p></section>` : ""}
      ${c ? detail(c) : `
      <div class="as-sh"><h2>الشخصيات <span>(${S.list.length})</span></h2></div>
      <div class="ch-grid as-grid">${S.list.map((x, i) => `<div class="ch-card as-card ${x.id === S.open ? "on" : ""}" data-cid="${x.id}" tabindex="0" role="button">
          <div class="as-art" style="${tint(i)}"><img src="${libEsc(x.image_url)}" alt="" loading="lazy"></div><b>${libEsc(x.name)}</b>
          <small dir="ltr">${x.instagram ? `@${libEsc(x.instagram)}` : x.tiktok ? `@${libEsc(x.tiktok)}` : ""}</small></div>`).join("")}
        <button type="button" class="as-new" data-cnew><span>＋</span>شخصية جديدة</button>
        <button type="button" class="as-new ai" data-cainew><span>✨</span>اعملها بالذكاء الصناعي</button></div>`}`;
    window.NHBar?.();   // (التعليقات الصوتية مكانها في تاب «التعليق الصوتي» مش هنا)
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
      if (t.closest("[data-cnew]")) { S.adding = true; render(); return w.closest(".nh-pgrid")?.scrollTo({ top: 0, behavior: "smooth" }); }
      if (t.closest("[data-vall]")) return document.querySelector('[data-astab="voice"]')?.click();
      const vp = t.closest("[data-vplay]");
      if (vp) {
        if (player.dataset.url === vp.dataset.vplay && !player.paused) player.pause();
        else { player.src = player.dataset.url = vp.dataset.vplay; player.play().catch(() => {}); }
        player.onplay = player.onpause = player.onended = () => w.querySelectorAll("[data-vplay]").forEach((el) => el.querySelector(".as-play").classList.toggle("on", el.dataset.vplay === player.dataset.url && !player.paused));
        return;
      }
      if (t.closest("[data-cnewx]")) { S.adding = false; return render(); }
      if (t.closest("[data-cainew]")) { S.aiNew = true; S.adding = false; render(); w.closest(".nh-pgrid")?.scrollTo({ top: 0, behavior: "smooth" }); return w.querySelector("#chAiName")?.focus(); }
      if (t.closest("[data-caix]")) { S.aiNew = false; return render(); }
      if (t.closest("[data-caigo]") || t.closest("[data-cai]")) {
        const fromForm = !!t.closest("[data-caigo]"), c = cur();
        const body = fromForm ? { name: w.querySelector("#chAiName").value.trim(), description: w.querySelector("#chAiDesc").value.trim(), style: w.querySelector("#chAiStyle").value }
          : { coach_id: c.id, name: c.name, description: c.about || "", style: "real" };
        if (!body.description) return toast(fromForm ? "اوصف الشخصية" : "اكتب «وصفها» الأول", true);
        S.aiBusy = true; render();
        try {
          const x = await api("/api/coaches/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
          S.list = S.list.some((y) => y.id === x.id) ? S.list.map((y) => (y.id === x.id ? x : y)) : [...S.list, x];
          S.open = x.id; S.aiNew = false; toast("✨ اترسمت");
        } catch (err) { toast(err.message, true); }
        S.aiBusy = false; return render();
      }
      if (t.closest("[data-talk]")) return talk();
      const tkd = t.closest("[data-tkdel]");
      if (tkd) { if ((await uiConfirm("تحذف الفيديو ده؟"))) save(() => api(`/api/coaches/${S.open}/talks/${tkd.dataset.tkdel}`, { method: "DELETE" })); return; }
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
        if (!c || !(await uiConfirm(`تحذف «${c.name}» بكل صورها وفيديوهاتها؟`))) return;
        try { await api(`/api/coaches/${c.id}`, { method: "DELETE" }); S.list = S.list.filter((x) => x.id !== c.id); S.open = null; render(); }
        catch (err) { toast(err.message, true); }
        return;
      }
      const del = t.closest("[data-cdel]");
      if (del) { if ((await uiConfirm("تشيله؟"))) patch({ [`remove_${del.dataset.cdel}`]: "true" }); return; }
      const sfig = t.closest("[data-sfile]");
      if (sfig && t.closest("[data-sdel]")) return save(() => api(`/api/coaches/${S.open}/sheet/${encodeURIComponent(sfig.dataset.sfile)}`, { method: "DELETE" }));
      const card = t.closest("[data-cid]");
      if (card) { S.open = card.dataset.cid; S.draft = {}; render(); w.closest(".nh-pgrid")?.scrollTo({ top: 0 }); }
    });
    w.addEventListener("change", (e) => {
      const el = e.target;
      if (el.id === "chNewImg") { el.closest("label").firstChild.textContent = `🖼️ ${el.files[0]?.name || "اختار صورتها"}`; return; }
      if (el.dataset.tk) { S.draft[el.dataset.tk] = el.value; if (el.dataset.tk === "lang") S.draft.voice = ""; return render(); }
      if (el.hasAttribute("data-tkaudio") && el.files[0]) { const f = el.files[0]; el.value = ""; return talk(f); }
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
    w.addEventListener("input", (e) => { if (e.target.dataset?.tk === "text" || e.target.dataset?.tk === "prompt") S.draft[e.target.dataset.tk] = e.target.value; });
    w.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-cid]")) { e.preventDefault(); e.target.click(); }
      if (e.key === "Enter" && e.target.id === "chNewName") w.querySelector("[data-cnewgo]")?.click();
    });
  }

  async function talk(file) {
    const c = cur(), d = S.draft, w = S.el;
    if (!c) return;
    const form = new FormData();
    const lang = d.lang || Object.keys(S.av?.dialects || {})[0] || "";
    const voices = S.av?.dialects?.[lang]?.voices || [];
    form.append("text", d.text || "");
    form.append("lang", lang);
    form.append("voice", voices.includes(d.voice) ? d.voice : voices[0] || "");
    form.append("model", d.model || "pro");
    form.append("prompt", d.prompt || "");
    if (file) form.append("audio", file);
    else if (!(d.text || "").trim()) return toast("اكتب الكلام الأول، أو ارفع صوت", true);
    await save(() => api(`/api/coaches/${c.id}/talks`, { method: "POST", body: form }), "🎬 بدأت؛ هتلاقي الفيديو تحت لما يخلص");
    S.draft.text = "";
    render();
    poll();
  }
  // لو فيه فيديو بيتعمل: الصفحة بتتحدث لوحدها كل كام ثانية
  function poll() {
    clearTimeout(S.timer);
    if (!S.list.some((c) => (c.talks || []).some((t) => t.status === "queued" || t.status === "working"))) return;
    S.timer = setTimeout(async () => {
      if (!S.el?.isConnected) return;
      try {
        const list = await api("/api/coaches");
        const typing = S.el.contains(document.activeElement) && document.activeElement.matches("input, textarea");
        S.list = list;
        if (!typing && ![...S.el.querySelectorAll("video")].some((v) => !v.paused)) render();
      } catch { /* بيعيد المحاولة */ }
      poll();
    }, 4000);
  }

  async function mount(root) {
    const w = root.querySelector("#chWrap");
    if (!w) return;
    S.el = w;
    S.adding = false;
    bind(w);
    try {
      [S.list, S.voices, S.av] = await Promise.all([api("/api/coaches"), api("/api/audio?kind=voice").catch(() => []), api("/api/avatar/info").catch(() => null)]);
      S.voices = [...S.voices].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
      render();
      poll();
    } catch (err) { w.innerHTML = `<div class="nh-empty">${libEsc(err.message)}</div>`; }
  }
  // صفحة الشخصية جوه صفحة الشخصيات: «رجوع» بيرجّع للقايمة، واسمها بيظهر في التسلسل اللي فوق
  function back() {
    if (!S.open || !S.el?.isConnected) return false;
    S.open = null; S.aiNew = false; render();
    S.el.closest(".nh-pgrid")?.scrollTo({ top: 0 });
    return true;
  }
  const sub = () => (S.el?.isConnected ? cur()?.name : "") || "";
  return { html, mount, back, sub, close: () => { player.pause(); clearTimeout(S.timer); S.open = null; } };
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
      if (e.target.closest("[data-adel]") && (await uiConfirm(`تحذف «${a.name}»؟`))) {
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

// 🔥 «اللي ماشي في مجالك»: بوستات من المجال بمشاهداتها ÷ متوسط حسابها، وليه الأعلى نجحوا، وأفكار بنفس الهيكل للبراند
const ViralPage = (() => {
  const KEY = "sm_viral_rows";
  const blank = () => ({ url: "", account: "", hook: "", views: "", avg: "" });
  const S = { el: null, niche: "", rows: [blank(), blank(), blank()], res: null, busy: false };
  try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); if (v?.rows?.length) Object.assign(S, { niche: v.niche || "", rows: v.rows }); } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ niche: S.niche, rows: S.rows })); } catch {} };
  const html = () => `<div class="nb-wrap vr-wrap" id="vrWrap"></div>`;
  const num = (n) => (n ? Number(n).toLocaleString("en") : "—");
  // من البروتوتايب: صفوف بخط تحت بس من غير براويز، والنتيجة ترتيب بالمضاعف وأفكار بنفس الهيكل
  const row = (r, i) => `<div class="vr2-row" data-i="${i}">
      <input type="text" data-k="account" placeholder="الحساب" aria-label="الحساب" value="${libEsc(r.account)}">
      <input type="text" data-k="hook" placeholder="أول جملة (الخطاف)" aria-label="الخطاف" value="${libEsc(r.hook)}">
      <input type="text" data-k="views" placeholder="مشاهداته" aria-label="مشاهداته" inputmode="numeric" value="${libEsc(r.views)}">
      <input type="text" data-k="avg" placeholder="متوسط الحساب" aria-label="متوسط الحساب" inputmode="numeric" value="${libEsc(r.avg)}">
      <input type="text" data-k="url" placeholder="الرابط (اختياري)" aria-label="الرابط" dir="ltr" value="${libEsc(r.url)}">
      ${pkIb("close", "احذف الصف", "data-del", "sm")}</div>`;
  function results() {
    const R = S.res;
    if (!R) return "";
    const why = Object.fromEntries((R.top || []).map((t) => [String(t.n), t]));
    return `<div class="vr2-res"><span class="pk-lbl">الترتيب: كم ضعفًا تجاوز كل منشور المعتاد لصاحبه</span>
      ${R.rows.map((r) => `<div class="vr2-tr${why[r.n] ? " top" : ""}"><b class="vr2-x num">${r.multiple ? "×" + r.multiple : "—"}</b>
          <div><span class="vr2-hk">${libEsc(r.hook || "—")}</span><small>${libEsc(r.account || "—")} · ${num(r.views)} / ${num(r.avg)}</small>
          ${why[r.n] ? `<small class="vr2-why">${libEsc(why[r.n].why || "")}${why[r.n].formula ? ` · ${libEsc(why[r.n].formula)}` : ""}${why[r.n].principle ? ` · ${libEsc(why[r.n].principle)}` : ""}</small>` : ""}</div></div>`).join("")}
      ${R.pattern ? `<p class="pk-note"><b>النمط:</b> ${libEsc(R.pattern)}</p>` : ""}
      ${(R.ideas || []).length ? `<span class="pk-lbl">أفكار لعلامتك بالهيكل نفسه (لا نسخ)</span>
        <div class="vr2-ideas">${R.ideas.map((d) => `<div class="vr2-idea"><b>${libEsc(d.title || "")}</b><i>«${libEsc(d.hook || "")}»</i><p>${libEsc(d.idea || "")}</p>
          ${pkIb("copy", "انسخ", `data-cp="${libEsc((d.hook || "") + "\n" + (d.idea || ""))}"`, "sm")}</div>`).join("")}</div>` : ""}</div>`;
  }
  function render() {
    const w = S.el;
    if (!w) return;
    w.innerHTML = `<div class="pk"><div class="pk-top"><input type="text" class="vr2-niche" data-niche aria-label="المجال" placeholder="المجال، مثلًا: لياقة للنساء في الخليج" value="${libEsc(S.niche)}">
        <div class="pk-acts">${pkIb("plus", "أضف منشورًا", "data-add")}<button class="nb-btn fs-go" data-run ${S.busy ? "disabled" : ""}>${S.busy ? "جارٍ التحليل…" : "حلّل"}</button></div></div>
      <p class="pk-note">أضف منشورات من مجالك مع مشاهداتها ومتوسط مشاهدات الحساب. المنشور الذي تجاوز متوسطه بكثير نجحت فكرته لا الحساب، وهذا ما نتعلّم منه.</p>
      <div class="vr2-rows">${S.rows.map(row).join("")}</div>${results()}</div>`;
  }
  function bind(w) {
    w.addEventListener("input", (e) => {
      if (e.target.hasAttribute("data-niche")) S.niche = e.target.value;
      const r = e.target.closest("[data-i]");
      if (r && e.target.dataset.k) S.rows[+r.dataset.i][e.target.dataset.k] = e.target.value;
      save();
    });
    w.addEventListener("click", async (e) => {
      if (e.target.closest("[data-add]")) { S.rows.push(blank()); save(); return render(); }
      const del = e.target.closest("[data-del]");
      if (del) { S.rows.splice(+del.closest("[data-i]").dataset.i, 1); if (!S.rows.length) S.rows.push(blank()); save(); return render(); }
      const cp = e.target.closest("[data-cp]");
      if (cp) { navigator.clipboard?.writeText(cp.dataset.cp).then(() => toast("✓ نُسخ"), () => toast("تعذّر النسخ", true)); return; }
      if (e.target.closest("[data-run]") && !S.busy) {
        const items = S.rows.filter((r) => r.hook || r.views || r.account);
        if (!items.length) return toast("أضف منشورًا واحدًا على الأقل", true);
        S.busy = true; render();
        try { S.res = await api("/api/viral", { method: "POST", ...jsonBody({ niche: S.niche, items }) }); }
        catch (err) { toast(err.message, true); }
        S.busy = false; render();
      }
    });
  }
  function mount(root) {
    const w = root.querySelector("#vrWrap");
    if (!w) return;
    S.el = w;
    bind(w);
    render();
  }
  return { html, mount, close: () => {} };
})();

// 🎨 استنساخ الستايل (في عقل البراند ← الشخصيات والأصوات):
// مراجع + فكرة ← أنيميشن مرسوم بالكود فريم فريم، بصوت متعمل بالحساب
const StyleClonePage = (() => {
  const S = { el: null, list: [], timer: null, busy: false };
  const BUSY = ["planning", "coding", "checking", "reviewing", "rendering"];
  const html = () => `<div class="nb-wrap sc-wrap" id="scWrap"><div class="nh-empty">بيحمّل…</div></div>`;
  const card = (p) => `<div class="sc-card" data-sid="${p.id}">
      <div class="sc-head"><b>${libEsc(p.title)}</b><span class="nb-state">${p.ratio} · ${p.duration}ث</span>
        <button class="nb-btn sm danger" data-sdel ${BUSY.includes(p.status) ? "disabled" : ""}>حذف</button></div>
      <div class="sc-refs">${p.refs.map((u) => /\.(mp4|mov|webm|m4v)$/i.test(u) ? `<video src="${u}" muted></video>` : `<img src="${u}" alt="">`).join("")}</div>
      <p class="nb-hint">${libEsc(p.idea)}</p>
      ${BUSY.includes(p.status) ? `<div class="sc-step">${libEsc(p.step || "⏳ شغال…")}</div>` : ""}
      ${p.status === "failed" ? `<div class="sc-err">⚠️ ${libEsc(p.error || "حصلت مشكلة")} <button class="nb-btn sm" data-sretry>جرّب تاني</button></div>` : ""}
      ${p.style ? `<div class="sc-style">${(p.style.palette || []).map((c) => `<i style="background:${libEsc(c)}"></i>`).join("")}<span>${libEsc(p.style.name || "")}: ${libEsc(p.style.look || "")}</span></div>` : ""}
      ${p.video ? `<video class="sc-video" src="${p.video}" controls playsinline></video>
        <div class="nb-bar"><a class="nb-btn sm" href="${p.video}" download>⬇ نزّل</a>${p.review?.score ? `<span class="nb-state">تقييم المراجعة: ${p.review.score}/10</span>` : ""}</div>`
        : p.frames.length ? `<div class="sc-frames">${p.frames.map((u) => `<img src="${u}?v=${encodeURIComponent(p.updated_at || "")}" alt="">`).join("")}</div>` : ""}
      ${p.video && !BUSY.includes(p.status) ? `<div class="nb-row"><label class="nb-f"><span>عايز تغيّر حاجة؟</span><input type="text" data-snote placeholder="مثلًا: خلّي الكلام أكبر والنهاية أبطأ"></label>
        <button class="nb-btn" data-srev>✏️ عدّل</button></div>` : ""}
    </div>`;
  function render() {
    const w = S.el;
    if (!w) return;
    w.innerHTML = `
      <div class="sc-new">
        <p class="nb-hint">ارفع صورة أو فيديو مرجعي بالستايل اللي عاجبك، واكتب فكرتك. البرنامج بياخد الستايل بس (مش موضوع المرجع) ويرسم الأنيميشن بالكود فريم فريم، ومعاه موسيقى ومؤثرات. الستايلات المرسومة (فلات، خطوط، ورق مقصوص، حبيبات طباعة) بتطلع أحسن من الواقعي. بياخد كذا دقيقة.</p>
        <label class="nb-btn">🖼️ المراجع<input type="file" accept="image/*,video/*" multiple data-sfiles hidden></label> <span class="nb-state" data-sfcount></span>
        <div class="nb-row"><label class="nb-f"><span>الفكرة</span><textarea rows="3" data-sidea placeholder="مثلًا: 3 أخطاء بتبوّظ الدايت، والحل في الآخر"></textarea></label></div>
        <div class="nb-row">
          <label class="nb-f"><span>المدة</span><select data-sdur><option>6</option><option selected>10</option><option>15</option><option>20</option></select></label>
          <label class="nb-f"><span>المقاس</span><select data-sratio><option>9:16</option><option>1:1</option><option>4:5</option><option>16:9</option></select></label>
          <label class="nb-f"><span>أداة الرسم</span><select data-sengine><option value="canvas">أشكال وخطوط بالكود</option><option value="brush">فُرش حقيقية (رصاص، فحم، حبر، ألوان مية)</option></select></label>
          <button class="nb-btn" data-sgo ${S.busy ? "disabled" : ""}>🎨 ابدأ</button></div>
      </div>
      <div class="sc-list">${S.list.map(card).join("") || ""}</div>`;
  }
  const refreshList = () => { const l = S.el?.querySelector(".sc-list"); if (l) l.innerHTML = S.list.map(card).join(""); };
  async function poll() {
    clearTimeout(S.timer);
    if (!S.el?.isConnected) return;
    if (S.list.some((p) => BUSY.includes(p.status))) {
      try { S.list = await api("/api/stylecl"); refreshList(); } catch {}
      S.timer = setTimeout(poll, 3000);
    }
  }
  function bind(w) {
    w.addEventListener("change", (e) => {
      if (e.target.hasAttribute("data-sfiles")) w.querySelector("[data-sfcount]").textContent = e.target.files.length ? `${e.target.files.length} ملف` : "";
    });
    w.addEventListener("click", async (e) => {
      const c = e.target.closest("[data-sid]");
      const sid = c?.dataset.sid;
      try {
        if (e.target.closest("[data-sgo]")) {
          const files = w.querySelector("[data-sfiles]").files;
          const idea = w.querySelector("[data-sidea]").value.trim();
          if (!files.length) return toast("ارفع مرجع واحد على الأقل", true);
          if (!idea) return toast("اكتب الفكرة", true);
          const form = new FormData();
          [...files].slice(0, 6).forEach((f) => form.append("files", f));
          form.append("idea", idea);
          form.append("duration", w.querySelector("[data-sdur]").value);
          form.append("ratio", w.querySelector("[data-sratio]").value);
          form.append("engine", w.querySelector("[data-sengine]").value);
          S.busy = true; render();
          try { const p = await api("/api/stylecl", { method: "POST", body: form }); S.list.unshift(p); } finally { S.busy = false; render(); }
          return poll();
        }
        if (e.target.closest("[data-sdel]") && (await uiConfirm("تحذف الفيديو ده؟"))) {
          await api(`/api/stylecl/${sid}`, { method: "DELETE" }); S.list = S.list.filter((p) => p.id !== sid); return refreshList();
        }
        if (e.target.closest("[data-sretry]")) { const p = await api(`/api/stylecl/${sid}/retry`, { method: "POST" }); S.list = S.list.map((x) => x.id === sid ? p : x); refreshList(); return poll(); }
        if (e.target.closest("[data-srev]")) {
          const note = c.querySelector("[data-snote]").value.trim();
          if (!note) return toast("اكتب التعديل", true);
          const p = await api(`/api/stylecl/${sid}/revise`, { method: "POST", ...jsonBody({ note }) });
          S.list = S.list.map((x) => x.id === sid ? p : x); refreshList(); return poll();
        }
      } catch (err) { toast(err.message, true); }
    });
  }
  async function mount(root) {
    const w = root.querySelector("#scWrap");
    if (!w) return;
    S.el = w;
    bind(w);
    try { S.list = await api("/api/stylecl"); render(); poll(); } catch (err) { w.innerHTML = `<div class="nh-empty">${libEsc(err.message)}</div>`; }
  }
  return { html, mount, close: () => clearTimeout(S.timer) };
})();
