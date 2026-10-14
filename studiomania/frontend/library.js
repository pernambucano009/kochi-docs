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
    return `<div class="ch-sec ch-talk"><div class="nb-kh"><b>🗣️ الأفاتار: خلّيها تتكلم</b><span class="num">${c.talks.length}</span></div>
      <p class="nb-hint">اكتب اللي الشخصية هتقوله، واختار اللهجة والصوت. البرنامج بيعمل الصوت الأول، وبعدين Kling Avatar بيعمل فيديو والشخصية بتقوله: البُق والوش والإيد ماشيين مع الصوت، والصورة زي ما هي. أو ارفع صوتك انت.</p>
      <textarea rows="3" data-tk="text" placeholder="مثلًا: أهلًا! أنا ${libEsc(c.name)}، والنهارده هقولك على ٣ حاجات…">${libEsc(d.text || "")}</textarea>
      <div class="nb-row">
        <label class="nb-f"><span>اللهجة / اللغة</span><select data-tk="lang"><optgroup label="عربي">${opt("ar")}</optgroup><optgroup label="لغات تانية">${opt("foreign")}</optgroup></select></label>
        <label class="nb-f"><span>الصوت</span><select data-tk="voice">${voices.map((v) => `<option value="${v}" ${v === voice ? "selected" : ""}>${libEsc(A.voices?.[v] || v)}</option>`).join("")}</select></label>
        <label class="nb-f"><span>الموديل</span><select data-tk="model">${Object.entries(A.models || {}).map(([k, m]) => `<option value="${k}" ${k === model ? "selected" : ""}>${libEsc(m.label)} · $${m.per_sec}/ث</option>`).join("")}</select></label>
      </div>
      <label class="nb-f"><span>الإحساس والحركة (اختياري)</span><input type="text" data-tk="prompt" value="${libEsc(d.prompt || "")}" placeholder="مثلًا: متحمس وبيبتسم، وبيشاور بإيده على الشاشة"></label>
      <div class="nb-row"><button class="nb-btn" data-talk>🎬 خلّيها تقول الكلام ده</button>
        <label class="nb-btn sm">🎙️ أو ارفع صوتك<input type="file" accept="audio/*,video/*" data-tkaudio hidden></label>
        <small class="muted">${d.text ? `حوالي ${secs} ثانية · ~$${(secs * per).toFixed(2)}` : ""}${!A.fasih ? " · اللهجات العربية محتاجة مفتاح فصيح" : ""}</small></div>
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
          <p class="nb-hint">صورة نص جسم قدام الكاميرا، جاهزة تتكلم في الأفاتار. لو مش عاجباك ارسمها تاني من صفحتها.</p></section>` : ""}
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
      if (tkd) { if (confirm("تحذف الفيديو ده؟")) save(() => api(`/api/coaches/${S.open}/talks/${tkd.dataset.tkdel}`, { method: "DELETE" })); return; }
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
