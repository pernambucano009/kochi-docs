// StudioMania — 🌍 الدبلجة باللهجات العامية
// فيديو ← الكلام بيتسمع ← يتحوّل للهجة (بتعدّله) ← صوت جاهز لكل جملة في مكانها + الموسيقى ← ليب سينك (اختياري) ← الفيديوهات الجاهزة للنشر.

const dbx = { list: [], info: null, cur: null, timer: null, err: {}, sending: null };
const DB_BG = { auto: "تلقائي", separate: "🎵 الموسيقى والمؤثرات من الأصل (يفصل الكلام)", low: "الصوت الأصلي منخفضًا في الخلفية", none: "بدون خلفية" };
const dbe = (s) => escapeHtml(String(s ?? ""));
const dbTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

viewHooks["13"] = dbInit;

async function dbInit() {
  try {
    const r = await api("/api/dub");
    dbx.list = r.items; dbx.info = r;
  } catch (err) { return toast(err.message, true); }
  const last = storageGet("studiomania.dub");
  if (!dbx.cur && last && dbx.list.some((p) => p.id === last)) await dbOpen(last);
  dbRender();
}

async function dbOpen(id) {
  try {
    dbx.cur = await api(`/api/dub/${id}`);
    dbx.info = dbx.cur.info;
    storageSet("studiomania.dub", id);
  } catch (err) { toast(err.message, true); dbx.cur = null; }
  dbRender();
  dbPoll();
}

function dbRender() {
  setHTML($("dbList"), dbx.list.map((p) => `<li class="${dbx.cur?.id === p.id ? "active" : ""}" data-dbopen="${p.id}">
    <span class="ph">🌍</span><span class="nm" data-no-i18n>${dbe(p.name)}<br><small class="muted">${p.duration ? dbTime(p.duration) : ""} ${p.targets.map((k) => dbx.info?.dialects?.[k]?.label.split(" ")[0] || "").join(" ")} ${p.busy ? "⏳" : ""}</small></span></li>`).join("")
    || "");
  $("dbMain").hidden = !dbx.cur;
  $("dbEmpty").hidden = !!dbx.cur;
  if (dbx.cur) dbRenderProj();
}

// خطوات الزرار الواحد، بالترتيب. الخطوة الحالية بتتعرف من أول علامة في كلام السيرفر
const DB_STEPS = [["🎧", "يستمع إلى الكلام"], ["✍️", "يكتب النص باللهجة"], ["🎙️", "يسجّل الجمل"], ["🎚️🎵", "يركّب الصوت والخلفية"], ["👄", "مزامنة الشفاه"], ["🎬", "يحفظ الفيديو"]];
function dbSteps(t) {
  const st = String(t.step || ""), steps = DB_STEPS.filter(([e]) => e !== "👄" || t.lipsync);
  const at = Math.max(0, steps.findIndex(([e]) => [...e].some((c) => c.trim() && st.startsWith(c))));
  return `<ol class="db-steps">${steps.map(([e, l], i) => `<li class="${i < at ? "done" : i === at ? "now" : ""}"><i>${i < at ? "✓" : e.slice(0, 2)}</i>${l}${i === at && /\(/.test(st) ? ` <small>${dbe(st.slice(st.indexOf("(")))}</small>` : ""}</li>`).join("")}</ol>`;
}
const dbOpts = (k, t, dis) => {
  const info = dbx.info, lc = t.lip_cost || {};
  // 🎵 بعد ما يسمع الكلام بيعرف فيه موسيقى ولا لا: مفيش موسيقى = مفيش فصل ولا تكلفته
  const hb = dbx.cur?.has_bg, autoL = hb === false ? "تلقائي (لا توجد موسيقى، فلا حاجة للفصل)" : hb ? "تلقائي (توجد موسيقى: تُفصل وتبقى)" : DB_BG.auto;
  return `<label>🎵 الخلفية <select data-dbbg="${k}" ${dis}>${Object.entries(DB_BG).filter(([b]) => b !== "separate" || info.separate).map(([b, l]) => `<option value="${b}" ${(t.bg || "auto") === b ? "selected" : ""}>${b === "auto" ? autoL : l}</option>`).join("")}</select></label>
    <label>🔤 التعليق النصي <select data-dbcap="${k}" ${dis}><option value="">بدون تعليق نصي</option><option value="same" ${t.caps === "same" ? "selected" : ""}>بنفس لغة الدبلجة</option>${Object.entries(info.caption_langs || {}).map(([c, l]) => `<option value="${c}" ${t.caps === c ? "selected" : ""}>مترجم: ${dbe(l)}</option>`).join("")}</select></label>
    <label>👄 مزامنة الشفاه <select data-dblip="${k}" ${dis}><option value="">بدون (الصوت فقط)</option>${Object.entries(info.lipsync).map(([m, l]) => `<option value="${m}" ${t.lipsync === m ? "selected" : ""}>${dbe(l)}${lc[m] != null ? ` · ≈ $${lc[m]}` : ""}</option>`).join("")}</select></label>`;
};

function dbRenderProj() {
  const d = dbx.cur, info = dbx.info;
  const running = Object.values(d.targets).some((t) => t.busy);
  let h = `<div class="panel db-head"><div class="db-src">${d.source.url ? `<video src="${d.source.url}" controls playsinline preload="metadata"></video>` : ""}</div>
    <div class="db-meta"><h2 data-no-i18n>${dbe(d.name)}</h2><p class="muted">${dbTime(d.source.duration || 0)}${d.lines.length ? ` · ${d.lines.length} جملة` : ""}</p>
      ${d.busy && d.step && !running ? `<p><span class="spin-inline"></span> ${dbe(d.step)}</p>` : ""}
      ${d.error ? `<p class="err">⚠️ ${dbe(d.error)}</p>` : ""}
      ${d.error_raw ? `<details class="db-raw"><summary>🔧 التفاصيل (للأدمن فقط)</summary><code dir="ltr" data-no-i18n>${dbe(d.error_raw)}</code></details>` : ""}
      <label>عن الفيديو (اختياري، يساعد في الدبلجة) <input id="dbBrief" value="${dbe(d.brief)}" placeholder="مثلًا: مدرب يشرح خطأً في التمرين للمبتدئين"></label>
      <button class="btn sm danger" id="dbDel">🗑 احذف المشروع</button></div></div>`;
  // 🎙️ زرار واحد: اختار اللهجة والصوت ودوس «دبلج»، والباقي بيحصل لوحده
  const ks = Object.keys(info.dialects);
  if (!dbx.go || !info.dialects[dbx.go]) dbx.go = info.dialects[info.brand_lang] ? info.brand_lang : ks.find((k) => info.dialects[k].group === "ar") || ks[0];
  const k = dbx.go, dl = info.dialects[k], cur = d.targets[k] || {};
  const opt = (g) => ks.filter((x) => info.dialects[x].group === g).map((x) => `<option value="${x}" ${x === k ? "selected" : ""}>${dbe(info.dialects[x].label)}${d.targets[x]?.video_url ? " ✓" : ""}</option>`).join("");
  const dis = running ? "disabled" : "";
  h += `<div class="panel db-go">
    <div class="db-go-row"><label>اللغة أو اللهجة <select id="dbGoLang" ${dis}><optgroup label="لهجات عربية">${opt("ar")}</optgroup><optgroup label="لغات أجنبية">${opt("foreign")}</optgroup></select></label>
      <label>الصوت <select id="dbGoVoice" ${dis}>${dl.voices.map((v) => `<option value="${v}" ${v === cur.voice ? "selected" : ""}>🎙️ ${dbe(info.voices[v] || v)}</option>`).join("")}</select></label></div>
    <div class="db-go-row">${dbOpts("go", cur, dis)}</div>
    <div class="db-go-row"><button class="btn primary db-go-btn" id="dbGo" ${running || dbx.sending === "go" ? "disabled" : ""}>${dbx.sending === "go" ? "⏳ جارٍ البدء…" : running ? "⏳ تُدبلج الآن…" : cur.video_url ? "🎙️ دبلج من جديد" : "🎙️ دبلج"}</button>
      ${info.fasih || dl.group !== "ar" ? "" : `<small class="err">اللهجات العربية غير متاحة الآن</small>`}
      ${dbx.err.go ? `<p class="err db-stat">⚠️ ${dbe(dbx.err.go)}</p>` : ""}</div>
    <p class="hint">يستمع إلى الكلام، ويكتبه باللهجة، ويسجّله بالصوت الذي اخترته في وقته، ويركّب الموسيقى. وبعد أن ينتهي يمكنك تعديل أي جملة وإعادة الدبلجة.</p></div>`;
  // كل لهجة اتعملت: النتيجة فوق، وتحتها «عدّل الجمل» مقفولة
  for (const [tk, t] of Object.entries(d.targets)) {
    const tl = info.dialects[tk];
    if (!tl) continue;
    const tdis = t.busy || d.busy ? "disabled" : "";
    h += `<div class="panel db-dialect"><div class="db-dh"><h3>${tl.label}</h3>${t.video_url && !t.busy ? `<span class="ok">✓ جاهز</span>` : ""}</div>`;
    if (t.busy) h += dbSteps(t);
    if (t.error || dbx.err[tk]) h += `<p class="err db-stat">⚠️ ${dbe(dbx.err[tk] || t.error)}</p>`
      + (t.error_raw && !dbx.err[tk] ? `<details class="db-raw"><summary>🔧 التفاصيل (للأدمن فقط)</summary><code dir="ltr" data-no-i18n>${dbe(t.error_raw)}</code></details>` : "");
    if (t.video_url) {
      h += `<div class="db-out"><video src="${t.video_url}" controls playsinline preload="metadata"></video>
        <p class="ok">✓ النسخة ${tl.label} في «الفيديوهات الجاهزة» ويمكنك نشرها من شاشة النشر${t.lipsync ? " (بمزامنة الشفاه)" : ""}.</p>
        ${t.note ? `<p class="hint db-note">⚠️ ${dbe(t.note)}</p>` : ""}</div>`;
    }
    if (t.lines?.length) {
      const open = !t.video_url && !t.busy ? " open" : (dbx.open?.[tk] ? " open" : "");
      h += `<details class="db-edit" data-dbedit="${tk}"${open}><summary>✏️ عدّل الجمل وأعد الدبلجة</summary>
        <p class="hint">صحّح أي جملة غير طبيعية. يجب أن تُقال كل جملة في وقتها (الرقم على اليسار)، فإن كانت طويلة فاختصرها.</p><div class="db-lines">`
        + d.lines.map((ln, i) => {
          const room = (d.lines[i + 1]?.s ?? d.source.duration) - ln.s;
          const txt = t.lines[i]?.text || "", over = txt.length > room * 15;
          return `<div class="db-line"><span class="db-t">${dbTime(ln.s)}<small>${room.toFixed(1)}ث</small></span>
            <div class="db-src-t" dir="auto">${dbe(ln.src)}</div>
            <textarea data-dbline="${tk}" data-i="${i}" rows="2" dir="auto" class="${over ? "over" : ""}" ${t.busy ? "disabled" : ""}>${dbe(txt)}</textarea></div>`;
        }).join("") + `</div>
        <div class="db-opts"><label>🎙️ الصوت <select data-dbvoice="${tk}" ${tdis}>${tl.voices.map((v) => `<option value="${v}" ${v === t.voice ? "selected" : ""}>${dbe(info.voices[v] || v)}</option>`).join("")}</select></label>
          ${dbOpts(tk, t, tdis)}</div>
        <div class="db-opts"><button class="btn primary" data-dbrender="${tk}" ${tdis || (dbx.sending === tk ? "disabled" : "")}>${dbx.sending === tk ? "⏳ جارٍ البدء…" : "🎙️ أعد الدبلجة بالتعديل"} <small>${(t.cost || {})[t.voice] ? `(≈ $${t.cost[t.voice]})` : ""}</small></button>
          <button class="btn sm" data-dbadapt="${tk}" ${tdis} title="يكتب النموذج النص من جديد (ستُحذف تعديلاتك)">↻ اكتب النص من جديد</button></div></details>`;
    }
    h += `</div>`;
  }
  // 🧊 بيتحدّث في مكانه: الفيديو اللي شغّال، ومكانك في الصفحة، واختياراتك بيفضلوا زي ما هم
  setHTML($("dbMain"), h);
}

function dbPoll() {
  clearTimeout(dbx.timer);
  if (!dbx.cur?.busy) return;
  dbx.timer = setTimeout(async () => {
    const id = dbx.cur?.id;
    if (!id || document.querySelector('.view[data-view="13"]').hidden) return;
    try {
      const was = JSON.stringify(Object.fromEntries(Object.entries(dbx.cur.targets).map(([k, t]) => [k, t.busy])));
      const cur = await api(`/api/dub/${id}`);
      if (dbx.cur?.id !== id) return;
      dbx.cur = cur;
      dbRenderProj();   // الخانة اللي بتكتب فيها مابتتلمسش (setHTML)
      if (!cur.busy) {
        const r = await api("/api/dub"); dbx.list = r.items; dbRender();
        if (cur.error) toast(cur.error, true);
        for (const [k, t] of Object.entries(cur.targets)) {
          if (JSON.parse(was)[k] && !t.busy) if (dbx.info.dialects[k]) toast(t.error ? `⚠️ ${t.error}` : t.video_url ? `🌍 الدبلجة ${dbx.info.dialects[k].label} جاهزة` : `✍️ النص ${dbx.info.dialects[k].label} جاهز: راجعه`, !!t.error);
        }
      }
    } catch (err) { toast(err.message, true); }
    dbPoll();
  }, 2500);
}

$("dbList").addEventListener("click", (e) => {
  const li = e.target.closest("[data-dbopen]");
  if (li) dbOpen(li.dataset.dbopen);
});

$("dbUpload").addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (!f) return;
  const fd = new FormData();
  fd.append("file", f);
  toast("⬆️ جارٍ رفع الفيديو…");
  try {
    const p = await api("/api/dub", { method: "POST", body: fd });
    await dbInit();
    await dbOpen(p.id);
  } catch (err) { toast(err.message, true); }
});

$("dbFromExport").addEventListener("click", async () => {
  try {
    const items = await api("/api/exports");
    const box = $("dbExports");
    box.hidden = !box.hidden;
    box.innerHTML = items.length ? items.slice(0, 40).map((x) => `<li data-dbexp="${x.id}"><span class="ph">🎬</span><span class="nm" data-no-i18n>${dbe(x.name)}<br><small class="muted">${dbTime(x.duration || 0)}</small></span></li>`).join("")
      : `<li class="muted">لا توجد فيديوهات جاهزة</li>`;
  } catch (err) { toast(err.message, true); }
});
$("dbExports").addEventListener("click", async (e) => {
  const li = e.target.closest("[data-dbexp]");
  if (!li) return;
  $("dbExports").hidden = true;
  try {
    const p = await api("/api/dub/from-export", { method: "POST", ...jsonBody({ export_id: li.dataset.dbexp }) });
    await dbInit();
    await dbOpen(p.id);
  } catch (err) { toast(err.message, true); }
});

async function dbAct(path, method, body, msg, k) {
  if (k) { dbx.err[k] = null; dbx.sending = k; dbRenderProj(); }
  try {
    const r = await api(`/api/dub/${dbx.cur.id}${path}`, { method, ...(body ? jsonBody(body) : {}) });
    dbx.cur = { ...r, info: dbx.info };
    if (msg) toast(msg);
    dbPoll();
  } catch (err) {
    if (k) dbx.err[k] = err.message;
    toast(err.message, true);
  }
  dbx.sending = null;
  dbRenderProj();
}

$("dbMain").addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.id === "dbGo") {
    const lip = $("dbGoLang") && document.querySelector('[data-dblip="go"]').value || null;
    const cost = lip ? dbx.cur.targets[dbx.go]?.lip_cost?.[lip] : null;
    if (lip && !(await uiConfirm(`مزامنة الشفاه تتكلف${cost != null ? ` نحو $${cost}` : ""} لهذا الفيديو. تُكمل؟`))) return;
    return dbAct("/auto", "POST", { dialect: dbx.go, voice: $("dbGoVoice").value, brief: $("dbBrief")?.value || "", lipsync: lip,
      background: document.querySelector('[data-dbbg="go"]').value, captions: document.querySelector('[data-dbcap="go"]')?.value || "" }, "🎙️ بدأت الدبلجة", "go");
  }
  if (b.id === "dbDel") {
    if (!(await uiConfirm("أتحذف مشروع الدبلجة هذا؟ (تبقى النسخ الموجودة في الفيديوهات الجاهزة)"))) return;
    try { await api(`/api/dub/${dbx.cur.id}`, { method: "DELETE" }); dbx.cur = null; storageSet("studiomania.dub", ""); await dbInit(); } catch (err) { toast(err.message, true); }
    return;
  }
  if (b.id === "dbAddLang") {
    const k = $("dbNewLang").value;
    if (!k) return;
    return dbAct("/target", "POST", { dialect: k, brief: $("dbBrief")?.value || "" }, "✍️ جارٍ كتابة النص…");
  }
  if (b.dataset.dbadapt) {
    const k = b.dataset.dbadapt;
    if (dbx.cur.targets[k]?.lines?.length && !(await uiConfirm("سيُكتب النص من جديد وستُحذف تعديلاتك. أتُكمل؟"))) return;
    return dbAct("/target", "POST", { dialect: k, voice: dbx.cur.targets[k]?.voice, brief: $("dbBrief")?.value || "" }, "✍️ جارٍ كتابة النص باللهجة…");
  }
  if (b.dataset.dbrender) {
    const k = b.dataset.dbrender, lip = document.querySelector(`[data-dblip="${k}"]`).value || null;
    const bg = document.querySelector(`[data-dbbg="${k}"]`).value;
    if (lip && !(await uiConfirm(`الليب سينك يتكلف نحو $${dbx.cur.targets[k].lip_cost[lip]} هذا للفيديو. تُكمل؟`))) return;
    const caps = document.querySelector(`[data-dbcap="${k}"]`)?.value || "";
    return dbAct(`/target/${k}/render`, "POST", { lipsync: lip, background: bg, captions: caps }, "🎙️ جارٍ إنشاء الدبلجة…", k);
  }
});

$("dbMain").addEventListener("toggle", (e) => {
  const dt = e.target.closest?.("[data-dbedit]");
  if (dt) (dbx.open ||= {})[dt.dataset.dbedit] = dt.open;
}, true);
$("dbMain").addEventListener("change", async (e) => {
  const t = e.target;
  if (t.id === "dbGoLang") { dbx.go = t.value; dbx.err.go = null; return dbRenderProj(); }
  if (t.dataset.dbvoice) return dbAct(`/target/${t.dataset.dbvoice}`, "PUT", { voice: t.value }, "🎙️ تغيّر الصوت");
  if (t.dataset.dbline) {
    const k = t.dataset.dbline;
    const texts = [...document.querySelectorAll(`textarea[data-dbline="${k}"]`)].map((x) => x.value);
    try {
      const r = await api(`/api/dub/${dbx.cur.id}/target/${k}`, { method: "PUT", ...jsonBody({ texts }) });
      dbx.cur = { ...r, info: dbx.info };
      const i = Number(t.dataset.i), room = (dbx.cur.lines[i + 1]?.s ?? dbx.cur.source.duration) - dbx.cur.lines[i].s;
      t.classList.toggle("over", t.value.length > room * 15);
    } catch (err) { toast(err.message, true); }
  }
});
