// StudioMania — 🌍 الدبلجة باللهجات العامية
// فيديو ← الكلام بيتسمع ← يتحوّل للهجة (بتعدّله) ← صوت جاهز لكل جملة في مكانها + الموسيقى ← ليب سينك (اختياري) ← الفيديوهات الجاهزة للنشر.

const dbx = { list: [], info: null, cur: null, timer: null };
const DB_BG = { auto: "تلقائي", separate: "🎵 الموسيقى والمؤثرات من الأصل (بيفصل الكلام)", low: "الصوت الأصلي واطي تحت", none: "من غير خلفية" };
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
  $("dbList").innerHTML = dbx.list.map((p) => `<li class="${dbx.cur?.id === p.id ? "active" : ""}" data-dbopen="${p.id}">
    <span class="ph">🌍</span><span class="nm" data-no-i18n>${dbe(p.name)}<br><small class="muted">${p.duration ? dbTime(p.duration) : ""} ${p.targets.map((k) => dbx.info?.dialects?.[k]?.label.split(" ")[0] || "").join(" ")} ${p.busy ? "⏳" : ""}</small></span></li>`).join("")
    || `<li class="muted">لسه مفيش</li>`;
  $("dbMain").hidden = !dbx.cur;
  $("dbEmpty").hidden = !!dbx.cur;
  if (dbx.cur) dbRenderProj();
}

function dbRenderProj() {
  const d = dbx.cur, info = dbx.info;
  let h = `<div class="panel db-head"><div class="db-src">${d.source.url ? `<video src="${d.source.url}" controls playsinline preload="metadata"></video>` : ""}</div>
    <div class="db-meta"><h2 data-no-i18n>${dbe(d.name)}</h2><p class="muted">${dbTime(d.source.duration || 0)} · ${d.lines.length} جملة</p>
      ${d.busy && d.step ? `<p><span class="spin-inline"></span> ${dbe(d.step)}</p>` : ""}
      ${d.error ? `<p class="err">⚠️ ${dbe(d.error)}</p>` : ""}
      <label>عن الفيديو (اختياري، بيساعد في الدبلجة) <input id="dbBrief" value="${dbe(d.brief)}" placeholder="مثلًا: كوتش بيشرح غلطة في التمرين لناس مبتدئين"></label>
      <button class="btn sm danger" id="dbDel">🗑 امسح المشروع</button></div></div>`;
  if (!d.lines.length) { $("dbMain").innerHTML = h; return; }
  for (const [k, dl] of Object.entries(info.dialects)) {
    const t = d.targets[k];
    h += `<div class="panel db-dialect"><div class="db-dh"><h3>${dl.label}</h3>`;
    if (!t) {
      h += `<button class="btn primary sm" data-dbadapt="${k}" ${d.busy ? "disabled" : ""}>✍️ اكتب الكلام ${dl.label.split(" ")[1]}</button></div></div>`;
      continue;
    }
    h += `<select data-dbvoice="${k}" ${t.busy ? "disabled" : ""}>${dl.voices.map((v) => `<option value="${v}" ${v === t.voice ? "selected" : ""}>🎙️ ${dbe(info.voices[v])}</option>`).join("")}</select>
      <button class="btn sm" data-dbadapt="${k}" ${t.busy || d.busy ? "disabled" : ""} title="الموديل يكتب الكلام من جديد (تعديلاتك هتتمسح)">↻ اكتبه من جديد</button></div>`;
    if (t.busy && t.step) h += `<p><span class="spin-inline"></span> ${dbe(t.step)}</p>`;
    if (t.error) h += `<p class="err">⚠️ ${dbe(t.error)}</p>`;
    if (t.lines?.length) {
      h += `<p class="hint">صلّح أي جملة مش طبيعية. كل جملة لازم تتقال في وقتها (الرقم على الشمال)، فلو طويلة اختصرها.</p><div class="db-lines">`
        + d.lines.map((ln, i) => {
          const room = (d.lines[i + 1]?.s ?? d.source.duration) - ln.s;
          const txt = t.lines[i]?.text || "", over = txt.length > room * 15;
          return `<div class="db-line"><span class="db-t">${dbTime(ln.s)}<small>${room.toFixed(1)}ث</small></span>
            <div class="db-src-t" dir="auto">${dbe(ln.src)}</div>
            <textarea data-dbline="${k}" data-i="${i}" rows="2" dir="auto" class="${over ? "over" : ""}" ${t.busy ? "disabled" : ""}>${dbe(txt)}</textarea></div>`;
        }).join("") + `</div>`;
      const lc = t.lip_cost || {};
      h += `<div class="db-opts"><label>🎵 الخلفية <select data-dbbg="${k}">${Object.entries(DB_BG).filter(([b]) => b !== "separate" || info.separate).map(([b, l]) => `<option value="${b}">${l}</option>`).join("")}</select></label>
        <label>👄 ليب سينك <select data-dblip="${k}"><option value="">من غير (الصوت بس)</option>${Object.entries(info.lipsync).map(([m, l]) => `<option value="${m}" ${t.lipsync === m ? "selected" : ""}>${dbe(l)} · حوالي $${lc[m]}</option>`).join("")}</select></label>
        <button class="btn primary" data-dbrender="${k}" ${t.busy || d.busy ? "disabled" : ""}>🎙️ اعمل الدبلجة <small>(الصوت حوالي $${(t.cost || {})[t.voice] ?? "?"})</small></button></div>`;
    }
    if (t.video_url) {
      h += `<div class="db-out"><video src="${t.video_url}" controls playsinline preload="metadata"></video>
        <p class="ok">✓ النسخة ${dl.label} في «الفيديوهات الجاهزة» وتقدر تنشرها من خطوة النشر${t.lipsync ? " (بليب سينك)" : ""}.</p></div>`;
    }
    h += `</div>`;
  }
  $("dbMain").innerHTML = h;
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
      const ta = document.activeElement?.matches?.("textarea[data-dbline]") ? document.activeElement : null;
      dbx.cur = cur;
      if (!ta) dbRenderProj();
      if (!cur.busy) {
        const r = await api("/api/dub"); dbx.list = r.items; dbRender();
        if (cur.error) toast(cur.error, true);
        for (const [k, t] of Object.entries(cur.targets)) {
          if (JSON.parse(was)[k] && !t.busy) toast(t.error ? `⚠️ ${t.error}` : t.video_url ? `🌍 الدبلجة ${dbx.info.dialects[k].label} جاهزة` : `✍️ الكلام ${dbx.info.dialects[k].label} جاهز: راجعه`, !!t.error);
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
  toast("⬆️ بيرفع الفيديو…");
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
      : `<li class="muted">مفيش فيديوهات جاهزة</li>`;
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

async function dbAct(path, method, body, msg) {
  try {
    const r = await api(`/api/dub/${dbx.cur.id}${path}`, { method, ...(body ? jsonBody(body) : {}) });
    dbx.cur = { ...r, info: dbx.info };
    dbRenderProj();
    if (msg) toast(msg);
    dbPoll();
  } catch (err) { toast(err.message, true); }
}

$("dbMain").addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.id === "dbDel") {
    if (!confirm("تمسح مشروع الدبلجة ده؟ (النسخ اللي في الفيديوهات الجاهزة بتفضل)")) return;
    try { await api(`/api/dub/${dbx.cur.id}`, { method: "DELETE" }); dbx.cur = null; storageSet("studiomania.dub", ""); await dbInit(); } catch (err) { toast(err.message, true); }
    return;
  }
  if (b.dataset.dbadapt) {
    const k = b.dataset.dbadapt;
    if (dbx.cur.targets[k]?.lines?.length && !confirm("الكلام هيتكتب من جديد وتعديلاتك هتتمسح. تكمّل؟")) return;
    return dbAct("/target", "POST", { dialect: k, voice: dbx.cur.targets[k]?.voice, brief: $("dbBrief")?.value || "" }, "✍️ بيكتب الكلام باللهجة…");
  }
  if (b.dataset.dbrender) {
    const k = b.dataset.dbrender, lip = document.querySelector(`[data-dblip="${k}"]`).value || null;
    const bg = document.querySelector(`[data-dbbg="${k}"]`).value;
    if (lip && !confirm(`الليب سينك بيتكلف حوالي $${dbx.cur.targets[k].lip_cost[lip]} للفيديو ده. تكمّل؟`)) return;
    return dbAct(`/target/${k}/render`, "POST", { lipsync: lip, background: bg }, "🎙️ بيعمل الدبلجة…");
  }
});

$("dbMain").addEventListener("change", async (e) => {
  const t = e.target;
  if (t.dataset.dbvoice) return dbAct(`/target/${t.dataset.dbvoice}`, "PUT", { voice: t.value }, "🎙️ الصوت اتغيّر");
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
