// StudioMania — المسلسلات: دستور المسلسل والشخصية ← سكريبت الحلقة والصوت (كل جملة بوقتها) ← لقطات ببرومبتات ← نسخ لكل لقطة ← تجميع

const ser = { list: [], settings: null, sid: null, ep: null, tab: "series", timer: null };
const SER_KEY = "studiomania.series";

async function initSeries() {
  await loadSeries();
  const saved = storageGet(SER_KEY);
  if (saved) {
    const [sid, eid] = saved.split(":");
    if (ser.list.some((s) => s.id === sid)) ser.sid = sid;
    if (eid && ser.cur()?.episodes.some((e) => e.id === eid)) return openEpisode(eid);
  }
  ser.sid = ser.sid || ser.list[0]?.id || null;
  renderSeries();
}
viewHooks["9"] = initSeries;
ser.cur = () => ser.list.find((s) => s.id === ser.sid) || null;

async function loadSeries() {
  try {
    const r = await api("/api/series");
    ser.list = r.series;
    ser.settings = r.settings;
    $("serAlert").hidden = r.configured;
  } catch (err) { toast(err.message, true); }
}
function remember() { storageSet(SER_KEY, `${ser.sid || ""}:${ser.ep?.id || ""}`); }

const serFmt = (t) => (t == null ? "—" : `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`);
const jsonBody = (o) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });

// ---------- القايمة: المسلسلات وحلقاتها ----------
function renderSeries() {
  $("serList").innerHTML = ser.list.map((s) => `<li class="${s.id === ser.sid ? "open" : ""}">
      <div class="ser-name" data-sid="${s.id}" data-no-i18n>🎭 ${escapeHtml(s.name)}</div>
      ${s.id === ser.sid ? `<ul>${s.episodes.map((e) => `<li data-eid="${e.id}" class="${ser.ep?.id === e.id ? "active" : ""}" data-no-i18n>${e.number}. ${escapeHtml(e.name)}</li>`).join("")}
        <li class="ser-add"><form id="serEpForm"><input type="text" id="serEpName" placeholder="اسم الحلقة"><button class="btn sm" type="submit">＋ حلقة</button></form></li></ul>` : ""}
    </li>`).join("") || `<li class="muted">لسه مفيش مسلسلات.</li>`;
  const s = ser.cur();
  $("serMain").hidden = !s;
  $("serEmpty").hidden = !!s;
  if (!s) return;
  const hasEp = !!ser.ep && ser.ep.series_id === s.id;
  document.querySelectorAll("#serTabs [data-t]").forEach((b) => {
    b.classList.toggle("active", b.dataset.t === ser.tab);
  });
  if (!hasEp && ser.tab !== "series") ser.tab = "series";
  document.querySelectorAll(".ser-sec").forEach((x) => (x.hidden = x.dataset.sec !== ser.tab));
  $("serTitle").textContent = hasEp ? `${s.name} · ${ser.ep.number}. ${ser.ep.name}` : s.name;
  renderSeriesTab(s);
  if (hasEp) { renderWriteTab(); renderScriptTab(); renderShotsTab(); renderRenderTab(); }
  schedulePollSeries();
}

$("serList").addEventListener("click", async (e) => {
  const n = e.target.closest("[data-sid]");
  if (n) { ser.sid = n.dataset.sid; ser.ep = null; ser.tab = "series"; remember(); return renderSeries(); }
  const ep = e.target.closest("[data-eid]");
  if (ep) openEpisode(ep.dataset.eid);
});
$("serList").addEventListener("submit", async (e) => {
  if (e.target.id !== "serEpForm") return;
  e.preventDefault();
  try {
    ser.ep = await api(`/api/series/${ser.sid}/episodes`, { method: "POST", ...jsonBody({ name: $("serEpName").value }) });
    await loadSeries();
    ser.tab = "script";
    remember();
    renderSeries();
  } catch (err) { toast(err.message, true); }
});
$("serNewForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("serNewName").value.trim();
  if (!name) return $("serNewName").focus();
  try {
    const r = await api("/api/series", { method: "POST", ...jsonBody({ name }) });
    ser.list = r.series;
    ser.sid = ser.list[ser.list.length - 1].id;
    ser.ep = null;
    $("serNewName").value = "";
    remember();
    renderSeries();
  } catch (err) { toast(err.message, true); }
});

async function openEpisode(eid) {
  try { ser.ep = await api(`/api/episodes/${eid}`); } catch (err) { return toast(err.message, true); }
  ser.sid = ser.ep.series_id;
  if (ser.tab === "series") ser.tab = ser.ep.shots.length ? "shots" : ser.ep.audio ? "script" : "write";
  remember();
  renderSeries();
}
$("serTabs").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-t]");
  if (!b) return;
  const t = b.dataset.t;
  if (t !== "series" && !(ser.ep && ser.ep.series_id === ser.sid)) {
    // مفيش حلقة مفتوحة: نفتح آخر حلقة، ولو مفيش حلقات خالص نعمل الأولى
    const eps = ser.cur()?.episodes || [];
    ser.tab = t;
    if (eps.length) return openEpisode(eps[eps.length - 1].id);
    try {
      ser.ep = await api(`/api/series/${ser.sid}/episodes`, { method: "POST", ...jsonBody({ name: "" }) });
      await loadSeries();
      remember();
      toast("اتعملت الحلقة الأولى. غيّر اسمها من خانة «اسم الحلقة» لو حابب");
    } catch (err) { return toast(err.message, true); }
  }
  ser.tab = t;
  renderSeries();
});

// ---------- 1. المسلسل: الدستور والشخصية وصورها ----------
function renderSeriesTab(s) {
  for (const [id, v] of [["serName", s.name], ["serBible", s.bible], ["serCharacter", s.character]]) {
    if (document.activeElement !== $(id)) $(id).value = v;
  }
  $("serRefs").innerHTML = s.refs.map((r) => `<div class="ref"><a href="${r.url}" target="_blank"><img src="${r.url}" alt=""></a><button class="del" data-ref="${r.file}" title="امسح">✕</button></div>`).join("")
    + `<label class="lib-add" title="ضيف صور للشخصية">＋<input type="file" id="serRefAdd" accept="image/*" multiple hidden></label>`;
  if (document.activeElement !== $("serTextModel")) $("serTextModel").value = ser.settings.text_model;
  if (document.activeElement !== $("serVideoModel")) $("serVideoModel").value = ser.settings.video_model;
}
async function saveSeries(patch) {
  try { ser.list = (await api(`/api/series/${ser.sid}`, { method: "PATCH", ...jsonBody(patch) })).series; renderSeries(); toast("اتحفظ"); }
  catch (err) { toast(err.message, true); }
}
$("serName").addEventListener("change", () => saveSeries({ name: $("serName").value }));
$("serBible").addEventListener("change", () => saveSeries({ bible: $("serBible").value }));
$("serCharacter").addEventListener("change", () => saveSeries({ character: $("serCharacter").value }));
$("serRefs").addEventListener("change", async (e) => {
  if (e.target.id !== "serRefAdd") return;
  const form = new FormData();
  [...e.target.files].forEach((f) => form.append("files", f));
  try { ser.list = (await api(`/api/series/${ser.sid}/refs`, { method: "POST", body: form })).series; renderSeries(); }
  catch (err) { toast(err.message, true); }
});
$("serRefs").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-ref]");
  if (!b || !confirm("مسح الصورة دي؟")) return;
  try { ser.list = (await api(`/api/series/${ser.sid}/refs?file=${encodeURIComponent(b.dataset.ref)}`, { method: "DELETE" })).series; renderSeries(); }
  catch (err) { toast(err.message, true); }
});
for (const [id, key] of [["serTextModel", "text_model"], ["serVideoModel", "video_model"]]) {
  $(id).addEventListener("change", async () => {
    try { ser.settings = await api("/api/series-settings", { method: "PUT", ...jsonBody({ [key]: $(id).value }) }); toast("اتحفظ"); }
    catch (err) { toast(err.message, true); }
  });
}

// ---------- 2. كتابة الحلقة: الموديل يكتب وانت توجّهه ----------
function renderWriteTab() {
  const ep = ser.ep;
  let v = 0;
  $("serChat").innerHTML = ep.chat.map((m) => m.role === "user"
    ? `<div class="msg user">${escapeHtml(m.content)}</div>`
    : `<div class="msg assistant"><details><summary>📝 نسخة ${++v} من السكريبت</summary><pre>${escapeHtml(m.content)}</pre></details></div>`).join("")
    || `<div class="muted">لسه مفيش. دوس «✍️ اكتب الحلقة» والبرنامج يكتبها استكمالًا للحلقات اللي فاتت، أو الزق سكريبت جاهز تحت.</div>`;
  $("serChat").scrollTop = $("serChat").scrollHeight;
  $("serWriteGo").textContent = ep.chat.length ? "✍️ عدّل" : "✍️ اكتب الحلقة";
  $("serApproveScript").textContent = ep.script_approved ? "✅ معتمد (دوس تلغي)" : "✅ اعتمد السكريبت";
  $("serApproveScript").classList.toggle("primary", !ep.script_approved);
  $("serApproveScript").disabled = !ep.lines.length;
  $("serWriteState").textContent = ep.script_approved ? "✅ السكريبت معتمد: سجّل الفويس أوفر وارفعه في «3 الفويس أوفر»" : ep.lines.length ? `${ep.lines.length} جملة فويس أوفر` : "";
}
$("serWriteForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const message = $("serWriteMsg").value.trim();
  if (ser.ep.chat.length && !message) return $("serWriteMsg").focus();
  busyButton($("serWriteGo"), "⏳ بيكتب...", async () => {
    ser.ep = await api(`/api/episodes/${ser.ep.id}/write`, { method: "POST", ...jsonBody({ message }) });
    $("serWriteMsg").value = "";
    renderSeries();
  });
});
$("serWriteMsg").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("serWriteForm").requestSubmit(); }
});
$("serApproveScript").onclick = () => busyButton($("serApproveScript"), "⏳", async () => {
  ser.ep = await api(`/api/episodes/${ser.ep.id}/approve-script?approved=${!ser.ep.script_approved}`, { method: "POST" });
  if (ser.ep.script_approved) { ser.tab = "script"; toast("اتعتمد. سجّل الفويس أوفر وارفعه هنا"); }
  renderSeries();
});

// ---------- 3. الفويس أوفر: كل جملة بوقتها ----------
const TIMING_LABEL = { stt: "✅ من موديل الكلام (كل كلمة بوقتها)", estimate: "≈ تقدير من السكتات في الصوت", manual: "✍️ متعدّل بإيدك" };
function renderScriptTab() {
  const ep = ser.ep;
  if (document.activeElement !== $("serScript")) $("serScript").value = ep.script;
  if (document.activeElement !== $("serEpRename")) $("serEpRename").value = ep.name;
  if (document.activeElement !== $("serNotes")) $("serNotes").value = ep.notes;
  $("serAudioInfo").textContent = ep.audio ? `${ep.audio.name || "الفويس أوفر"} · ${serFmt(ep.audio.duration)} (ده طول الحلقة)` : "لسه مفيش صوت";
  const player = $("serAudio");
  if (ep.audio && !player.src.endsWith(ep.audio.url)) player.src = ep.audio.url;
  player.hidden = !ep.audio;
  $("serTiming").disabled = !ep.audio;
  $("serTimingState").textContent = ep.timing ? TIMING_LABEL[ep.timing] || "" : "";
  const scenes = Object.fromEntries(ep.scenes.map((s) => [s.n, s.title]));
  let last = null;
  $("serLines").innerHTML = ep.lines.map((ln) => {
    const head = ln.scene !== last ? `<tr class="scene"><td colspan="5">المشهد ${ln.scene}${scenes[ln.scene] ? ` — ${escapeHtml(scenes[ln.scene])}` : ""}</td></tr>` : "";
    last = ln.scene;
    const dur = ln.start != null && ln.end != null ? (ln.end - ln.start).toFixed(1) : "—";
    return `${head}<tr data-n="${ln.n}">
      <td>${ln.n}</td><td class="txt" data-no-i18n>«${escapeHtml(ln.text)}»</td>
      <td><input type="number" step="0.05" min="0" data-f="start" value="${ln.start ?? ""}"></td>
      <td><input type="number" step="0.05" min="0" data-f="end" value="${ln.end ?? ""}"></td>
      <td>${dur}ث ${ln.start != null ? `<button class="btn sm" data-play="${ln.start}:${ln.end}" title="اسمعها">▶</button>` : ""}</td></tr>`;
  }).join("") || `<tr><td colspan="5" class="muted">${ep.audio ? "دوس «⏱️ رقّم الجمل على الصوت»: البرنامج هيسمع الصوت ويقسّمه جمل بتوقيتها (حتى من غير سكريبت)." : "ارفع الفويس أوفر الأول."}</td></tr>`;
}
async function patchEpisode(body) {
  ser.ep = await api(`/api/episodes/${ser.ep.id}`, { method: "PATCH", ...jsonBody(body) });
}
$("serScript").addEventListener("change", async () => {
  try { await patchEpisode({ script: $("serScript").value }); renderSeries(); toast(`اتحفظ · ${ser.ep.lines.length} جملة`); } catch (err) { toast(err.message, true); }
});
$("serEpRename").addEventListener("change", async () => {
  try { await patchEpisode({ name: $("serEpRename").value }); await loadSeries(); renderSeries(); toast("اتحفظ"); } catch (err) { toast(err.message, true); }
});
$("serNotes").addEventListener("change", async () => {
  try { await patchEpisode({ notes: $("serNotes").value }); } catch (err) { toast(err.message, true); }
});
$("serScriptFile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  $("serScript").value = await f.text();
  $("serScript").dispatchEvent(new Event("change"));
});
$("serAudioFile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  const form = new FormData();
  form.append("file", f);
  $("serAudioInfo").textContent = "⏳ بيرفع...";
  try {
    ser.ep = await api(`/api/episodes/${ser.ep.id}/audio`, { method: "POST", body: form });
    renderSeries();
    $("serTiming").click();
  } catch (err) { toast(err.message, true); renderSeries(); }
});
$("serTiming").onclick = () => busyButton($("serTiming"), "⏳ بيسمع الصوت...", async () => {
  ser.ep = await api(`/api/episodes/${ser.ep.id}/timing`, { method: "POST" });
  renderSeries();
});
$("serLines").addEventListener("change", async (e) => {
  const tr = e.target.closest("tr[data-n]");
  if (!tr) return;
  const lines = [...$("serLines").querySelectorAll("tr[data-n]")].map((r) => ({
    n: Number(r.dataset.n), start: Number(r.querySelector('[data-f="start"]').value), end: Number(r.querySelector('[data-f="end"]').value),
  }));
  try { await patchEpisode({ lines }); renderSeries(); } catch (err) { toast(err.message, true); }
});
// تسمع جملة واحدة: الصوت يبدأ من أولها ويقف في آخرها
let serStopAt = null;
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-play]");
  if (!b || !b.closest('.view[data-view="9"]')) return;
  const [a, z] = b.dataset.play.split(":").map(Number);
  const p = $("serAudio");
  p.currentTime = a;
  serStopAt = z;
  p.play();
});
$("serAudio").addEventListener("timeupdate", () => {
  if (serStopAt != null && $("serAudio").currentTime >= serStopAt) { $("serAudio").pause(); serStopAt = null; }
});

// ---------- 3. اللقطات: كل لقطة بمدتها من الصوت، وبرومبتها، ونسخها ----------
const TAKE_STATE = { queued: "⏳ مستنية", working: "🎬 بتتولد...", failed: "✕ فشلت" };
function takeThumb(t, chosen) {
  const busy = t.status === "queued" || t.status === "working";
  const media = t.url ? lightVideo(t.url, 'muted loop playsinline') : `<div class="car-wait">${busy ? `<div class="spin"></div>` : ""}${TAKE_STATE[t.status] || ""}</div>`;
  return `<div class="take ${t.id === chosen ? "sel" : ""} ${t.status} ${t.approved ? "ok" : ""}" data-take="${t.id}" title="${t.source === "upload" ? escapeHtml(t.name || "فيديو مرفوع") : "Seedance"}${t.error ? ` — ${escapeHtml(t.error)}` : ""}">
    ${media}<em>${t.approved ? "✅" : t.source === "upload" ? "⬆" : "✨"} ${t.duration ? `${t.duration.toFixed(1)}ث` : ""}</em>
    ${busy ? "" : `<b data-del-take title="امسح النسخة">✕</b>`}
    ${t.status === "failed" && t.source === "seedance" ? `<button class="retry" data-retry-take title="حاول تاني (لو الطلب اتبعت بيكمّل من غير دفع تاني)">↻</button>` : ""}</div>`;
}
const FRAME_STATE = { queued: "⏳ مستنية", working: "🎨 بترسم...", failed: "✕ فشلت" };
function renderShotsTab() {
  const ep = ser.ep;
  const ready = ep.audio && ep.lines.length && ep.lines.every((l) => l.start != null);
  $("serShotsGo").disabled = !ready;
  $("serShotsGo").textContent = ep.shots.length ? "✨ قسّم تاني (النسخ بتتحفظ)" : "✨ جهّز اللقطات";
  $("serShotsHint").textContent = ready ? `الحلقة ${serFmt(ep.audio.duration)} · ${ep.shots.length} لقطة · الموديل: ${ser.settings.text_model}` : "رقّم جمل الفويس أوفر على الصوت الأول (تبويب السكريبت والصوت).";
  const lines = Object.fromEntries(ep.lines.map((l) => [l.n, l]));
  let scene = null;
  $("serShots").innerHTML = ep.shots.map((s) => {
    const head = s.scene !== scene ? `<div class="ser-scene">المشهد ${s.scene}</div>` : "";
    scene = s.scene;
    const said = (s.lines || []).map((n) => lines[n]).filter(Boolean).map((l) => `«${escapeHtml(l.text)}»`).join(" ") || `<span class="muted">(من غير كلام)</span>`;
    const chosen = s.takes.find((t) => t.id === s.chosen);
    const short = chosen?.duration && chosen.duration - (s.offset || 0) < s.duration - 0.05;
    const fbusy = s.frame_status === "queued" || s.frame_status === "working";
    const frame = s.frame_url
      ? `<a href="${s.frame_url}" target="_blank"><img src="${s.frame_url}" alt=""></a>${fbusy ? `<div class="car-wait over"><div class="spin"></div></div>` : ""}`
      : `<div class="car-wait">${fbusy ? `<div class="spin"></div>` : ""}${FRAME_STATE[s.frame_status] || "لسه من غير ستوري بورد"}</div>`;
    const frames = (s.frames || []).length > 1 ? `<div class="frame-vers">${s.frames.map((f, i) => `<img src="${f.url}" data-frame="${f.file}" class="${f.url === s.frame_url ? "sel" : ""}" title="نسخة ${i + 1}" alt="">`).join("")}</div>` : "";
    const ready = chosen?.approved;
    return `${head}<article class="shot ${s.approved ? "approved" : ""} ${ready ? "ready" : ""}" data-shot="${s.id}">
      <header><b>${s.n}</b><span class="t">${serFmt(s.start)} → ${serFmt(s.end)}</span><span class="dur">${s.duration.toFixed(1)}ث</span>
        <button class="btn sm" data-play="${s.start}:${s.end}" title="اسمع الكلام اللي على اللقطة">▶</button>
        <button class="btn sm danger" data-del-shot title="احذف اللقطة">🗑️</button></header>
      <div class="said" data-no-i18n>${said}</div>
      <div class="frame">${frame}</div>
      ${frames}
      ${s.frame_error ? `<div class="err">${escapeHtml(s.frame_error)}</div>` : ""}
      <input type="text" class="title" data-f="title" value="${escapeHtml(s.title || "")}" placeholder="وصف اللقطة" data-no-i18n>
      <div class="meta" data-no-i18n>${[s.shot, s.camera, s.location, s.sfx && `🔊 ${s.sfx}`, s.transition && `↪ ${s.transition}`].filter(Boolean).map(escapeHtml).join(" · ")}</div>
      <textarea data-f="prompt" rows="4" dir="ltr" placeholder="Prompt" data-no-i18n>${escapeHtml(s.prompt || "")}</textarea>
      <div class="acts">
        <button class="btn sm" data-frame-go ${fbusy ? "disabled" : ""}>🎨 ${s.frame_url ? "ارسم تاني" : "ارسم الستوري بورد"}</button>
        <button class="btn sm ${s.approved ? "" : "primary"}" data-approve>${s.approved ? "✅ معتمدة (دوس تلغي)" : "✅ اعتمد اللقطة"}</button>
      </div>
      <div class="takes">${s.takes.map((t) => takeThumb(t, s.chosen)).join("")}</div>
      ${(() => { const bad = s.takes.filter((t) => t.status === "failed" && t.error).slice(-1)[0]; return bad ? `<div class="err">✕ الفيديو فشل: ${escapeHtml(bad.error)}</div>` : ""; })()}
      ${chosen && chosen.status === "done" ? `<div class="acts take-acts">
        <button class="btn sm ${chosen.approved ? "" : "primary"}" data-take-ok="${chosen.id}">${chosen.approved ? "✅ موافق عليه" : "✅ موافق على الفيديو"}</button>
        <button class="btn sm" data-gen ${s.approved ? "" : "disabled"}>🔄 واحد تاني</button></div>` : ""}
      <div class="acts">
        ${chosen ? "" : `<button class="btn sm primary" data-gen ${s.approved ? "" : "disabled"} title="${s.approved ? "" : "اعتمد اللقطة الأول"}">🎬 ولّد الفيديو</button>`}
        <label class="btn sm">⬆ ارفع فيديو<input type="file" data-up accept="video/*" hidden></label>
        ${chosen ? `<label class="off">يبدأ من <input type="number" step="0.1" min="0" data-f="offset" value="${s.offset || 0}">ث</label>` : ""}
        ${short ? `<span class="warn">⚠️ النسخة أقصر من اللقطة، آخر فريم هيتمد</span>` : ""}
      </div>
    </article>`;
  }).join("");
  const n = ep.shots.length;
  const framed = ep.shots.filter((s) => s.frame_url).length;
  const approved = ep.shots.filter((s) => s.approved).length;
  const okVideos = ep.shots.filter((s) => s.takes.some((t) => t.id === s.chosen && t.approved)).length;
  $("serProgress").textContent = n ? `🎨 ${framed}/${n} ستوري بورد · ✅ ${approved}/${n} لقطة معتمدة · 🎬 ${okVideos}/${n} فيديو موافق عليه` : "";
  $("serFramesGo").disabled = !n;
  $("serApproveAll").disabled = !n;
  $("serApproveAll").textContent = n && approved === n ? "↩ الغي اعتماد الكل" : "✅ اعتمد كل اللقطات";
  $("serGenApproved").disabled = !approved;
  // نسخ محفوظة من قوايم قديمة
  $("serPool").hidden = !ep.pool.length;
  $("serPoolList").innerHTML = ep.pool.map((t) => `<div class="pool-item">${takeThumb(t, null)}
      <select data-attach="${t.id}"><option value="">حطها على لقطة…</option>${ep.shots.map((s) => `<option value="${s.id}">${s.n}. ${escapeHtml((s.title || "").slice(0, 30))}</option>`).join("")}</select></div>`).join("");
}
$("serShotsGo").onclick = () => {
  if (ser.ep.shots.length && !confirm("تقسيم جديد للحلقة؟ النسخ اللي اتولدت أو اترفعت هتفضل محفوظة تحت «نسخ محفوظة» وتقدر تحطها على أي لقطة.")) return;
  busyButton($("serShotsGo"), "⏳ الموديل بيقسّم الحلقة...", async () => {
    ser.ep = await api(`/api/episodes/${ser.ep.id}/shots`, { method: "POST" });
    renderSeries();
  });
};
$("serShots").addEventListener("change", async (e) => {
  const card = e.target.closest("[data-shot]");
  if (!card) return;
  const id = card.dataset.shot;
  try {
    if (e.target.matches("[data-up]")) {
      const f = e.target.files[0];
      e.target.value = "";
      if (!f) return;
      const form = new FormData();
      form.append("file", f);
      toast("⏳ بيرفع الفيديو...");
      ser.ep = await api(`/api/episodes/${ser.ep.id}/shots/${id}/takes`, { method: "POST", body: form });
    } else if (e.target.dataset.f) {
      const v = e.target.dataset.f === "offset" ? Number(e.target.value) : e.target.value;
      await patchEpisode({ shot: { id, [e.target.dataset.f]: v } });
    } else return;
    renderSeries();
  } catch (err) { toast(err.message, true); }
});
$("serShots").addEventListener("click", async (e) => {
  const card = e.target.closest("[data-shot]");
  if (!card) return;
  const id = card.dataset.shot;
  try {
    if (e.target.closest("[data-gen]")) {
      ser.ep = await api(`/api/episodes/${ser.ep.id}/shots/${id}/generate`, { method: "POST" });
      return renderSeries();
    }
    if (e.target.closest("[data-del-shot]")) return askDeleteShot(id);
    if (e.target.closest("[data-frame-go]")) {
      ser.ep = await api(`/api/episodes/${ser.ep.id}/frames?shot_id=${id}`, { method: "POST" });
      return renderSeries();
    }
    const fr = e.target.closest("[data-frame]");
    if (fr) {
      ser.ep = await api(`/api/episodes/${ser.ep.id}/shots/${id}/frame`, { method: "POST", ...jsonBody({ file: fr.dataset.frame }) });
      return renderSeries();
    }
    if (e.target.closest("[data-approve]")) {
      const s = ser.ep.shots.find((x) => x.id === id);
      await patchEpisode({ shot: { id, approved: !s.approved } });
      return renderSeries();
    }
    const ok = e.target.closest("[data-take-ok]");
    if (ok) {
      const t = ser.ep.shots.find((x) => x.id === id).takes.find((x) => x.id === ok.dataset.takeOk);
      ser.ep = await api(`/api/episodes/${ser.ep.id}/takes/${t.id}/approve?approved=${!t.approved}`, { method: "POST" });
      return renderSeries();
    }
    const take = e.target.closest("[data-take]");
    if (!take) return;
    if (e.target.closest("[data-retry-take]")) {
      ser.ep = await api(`/api/episodes/${ser.ep.id}/takes/${take.dataset.take}/retry`, { method: "POST" });
      return renderSeries();
    }
    if (e.target.closest("[data-del-take]")) {
      if (!confirm("مسح النسخة دي نهائي؟")) return;
      ser.ep = await api(`/api/episodes/${ser.ep.id}/takes/${take.dataset.take}`, { method: "DELETE" });
    } else {
      ser.ep = await api(`/api/episodes/${ser.ep.id}/shots/${id}/pick`, { method: "POST", ...jsonBody({ take_id: take.dataset.take }) });
    }
    renderSeries();
  } catch (err) { toast(err.message, true); }
});
// معاينة: الماوس فوق النسخة يشغّلها
$("serShots").addEventListener("mouseover", (e) => { const v = e.target.closest(".take video"); if (v) { v.preload = "auto"; v.play().catch(() => {}); } });
$("serShots").addEventListener("mouseout", (e) => { const v = e.target.closest(".take video"); if (v) v.pause(); });
$("serPoolList").addEventListener("change", async (e) => {
  const sel = e.target.closest("[data-attach]");
  if (!sel || !sel.value) return;
  try {
    ser.ep = await api(`/api/episodes/${ser.ep.id}/shots/${sel.value}/pick`, { method: "POST", ...jsonBody({ take_id: sel.dataset.attach }) });
    renderSeries();
  } catch (err) { toast(err.message, true); }
});
$("serPoolList").addEventListener("click", async (e) => {
  const take = e.target.closest("[data-take]");
  if (!take || !e.target.closest("[data-del-take]") || !confirm("مسح النسخة دي نهائي؟")) return;
  try { ser.ep = await api(`/api/episodes/${ser.ep.id}/takes/${take.dataset.take}`, { method: "DELETE" }); renderSeries(); }
  catch (err) { toast(err.message, true); }
});

// حذف لقطة: وقتها يتضاف على اللي قبلها أو اللي بعدها (الحلقة تفضل على طول الصوت)
function askDeleteShot(id) {
  const shots = ser.ep.shots;
  const k = shots.findIndex((s) => s.id === id);
  const s = shots[k];
  const prev = shots[k - 1];
  const next = shots[k + 1];
  if (!prev && !next) return toast("دي آخر لقطة في الحلقة", true);
  $("serDelNum").textContent = s.n;
  $("serDelInfo").textContent = `مدتها ${s.duration.toFixed(1)} ثانية. الوقت ده يتضاف على أنهي لقطة؟ ${s.takes.length ? "الفيديوهات بتاعتها هتروح للنسخ المحفوظة." : ""}`;
  $("serDelPrev").hidden = !prev;
  $("serDelNext").hidden = !next;
  if (prev) $("serDelPrev").textContent = `→ اللي قبلها (${prev.n}): ${prev.duration.toFixed(1)} ← ${(prev.duration + s.duration).toFixed(1)}ث`;
  if (next) $("serDelNext").textContent = `← اللي بعدها (${next.n}): ${next.duration.toFixed(1)} ← ${(next.duration + s.duration).toFixed(1)}ث`;
  const go = async (merge) => {
    $("serDelDialog").close();
    try {
      ser.ep = await api(`/api/episodes/${ser.ep.id}/shots/${id}?merge=${merge}`, { method: "DELETE" });
      renderSeries();
      toast(`اتحذفت اللقطة ${s.n}`);
    } catch (err) { toast(err.message, true); }
  };
  $("serDelPrev").onclick = () => go("prev");
  $("serDelNext").onclick = () => go("next");
  $("serDelCancel").onclick = () => $("serDelDialog").close();
  $("serDelDialog").showModal();
}
$("serFramesGo").onclick = () => busyButton($("serFramesGo"), "⏳", async () => {
  ser.ep = await api(`/api/episodes/${ser.ep.id}/frames`, { method: "POST" });
  renderSeries();
});
$("serApproveAll").onclick = () => busyButton($("serApproveAll"), "⏳", async () => {
  const all = ser.ep.shots.every((s) => s.approved);
  ser.ep = await api(`/api/episodes/${ser.ep.id}/approve-shots?approved=${!all}`, { method: "POST" });
  renderSeries();
});
$("serGenApproved").onclick = () => busyButton($("serGenApproved"), "⏳", async () => {
  const todo = ser.ep.shots.filter((s) => s.approved && !s.takes.some((t) => t.status !== "failed")).length;
  if (!confirm(`هيتولد فيديو لـ ${todo} لقطة معتمدة بـ Seedance. نكمّل؟`)) return;
  ser.ep = await api(`/api/episodes/${ser.ep.id}/generate-approved`, { method: "POST" });
  renderSeries();
});

// ---------- 5. المونتاج ----------
function renderRenderTab() {
  const ep = ser.ep;
  const notOk = ep.shots.filter((s) => !s.takes.some((t) => t.id === s.chosen && t.approved)).map((s) => s.n);
  $("serToEditor").disabled = !ep.shots.length || notOk.length > 0;
  $("serToEditor").title = notOk.length ? `لقطات لسه من غير فيديو موافق عليه: ${notOk.join("، ")}` : "";
  const missing = ep.shots.filter((s) => !s.takes.some((t) => t.id === s.chosen && t.status === "done")).length;
  const r = ep.render;
  $("serRenderGo").disabled = !ep.shots.length || r.status === "working";
  $("serRenderState").textContent = r.status === "working" ? "🎞️ بيجمّع الحلقة..." : r.status === "failed" ? `✕ ${r.error || ""}` : "";
  $("serRenderHint").textContent = !ep.shots.length ? "جهّز اللقطات الأول."
    : notOk.length ? `🎬 لسه ${notOk.length} لقطة من غير فيديو موافق عليه (${notOk.join("، ")}). المعاينة السريعة بتحط مكانهم أسود أو النسخة المختارة.`
    : missing ? `⚠️ ${missing} لقطة لسه من غير فيديو، هتطلع سودا بمدتها. تقدر تجمّع عشان تشوف الإيقاع.`
      : "كل اللقطات جاهزة. كل لقطة بتتقص على مدتها بالظبط من الصوت، والفويس أوفر فوقهم.";
  $("serRendered").innerHTML = ep.export_url ? `<video src="${ep.export_url}" controls preload="metadata"></video>
    <p class="hint">اتحفظت في الفيديوهات الجاهزة، وتقدر تنشرها من صفحة النشر.</p>` : "";
}
$("serToEditor").onclick = () => busyButton($("serToEditor"), "⏳", async () => {
  const r = await api(`/api/episodes/${ser.ep.id}/to-editor`, { method: "POST" });
  storageSet("studiomania.projectId", r.project_id);
  if (typeof mt !== "undefined") mt.project = null;
  toast("اتفتحت الحلقة في محرر الفيديو");
  showStep("6");
});
$("serRenderGo").onclick = () => busyButton($("serRenderGo"), "⏳", async () => {
  ser.ep = await api(`/api/episodes/${ser.ep.id}/render`, { method: "POST" });
  renderSeries();
});

// متابعة: النسخ اللي بتتولد والتجميع
function schedulePollSeries() {
  clearTimeout(ser.timer);
  const ep = ser.ep;
  if (!ep) return;
  const busy = ep.render.status === "working" || ep.shots.some((s) => s.frame_status === "queued" || s.frame_status === "working"
    || s.takes.some((t) => t.status === "queued" || t.status === "working"));
  if (!busy || document.querySelector('.view[data-view="9"]').hidden) return;
  ser.timer = setTimeout(async () => {
    try {
      const fresh = await api(`/api/episodes/${ep.id}`);
      if (ser.ep?.id === fresh.id) {
        ser.ep = fresh;
        // من غير ما نمسح اللي بتكتبه دلوقتي
        if (!document.activeElement?.closest('.view[data-view="9"] textarea, .view[data-view="9"] input')) renderSeries();
        else schedulePollSeries();
      }
    } catch { schedulePollSeries(); }
  }, 4000);
}
