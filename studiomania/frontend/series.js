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
    b.disabled = b.dataset.t !== "series" && !hasEp;
    b.classList.toggle("active", b.dataset.t === ser.tab);
  });
  if (!hasEp && ser.tab !== "series") ser.tab = "series";
  document.querySelectorAll(".ser-sec").forEach((x) => (x.hidden = x.dataset.sec !== ser.tab));
  $("serTitle").textContent = hasEp ? `${s.name} · ${ser.ep.number}. ${ser.ep.name}` : s.name;
  renderSeriesTab(s);
  if (hasEp) { renderScriptTab(); renderShotsTab(); renderRenderTab(); }
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
  if (ser.tab === "series") ser.tab = ser.ep.shots.length ? "shots" : "script";
  remember();
  renderSeries();
}
$("serTabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-t]");
  if (b && !b.disabled) { ser.tab = b.dataset.t; renderSeries(); }
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

// ---------- 2. السكريبت والصوت: كل جملة بوقتها ----------
const TIMING_LABEL = { stt: "✅ من موديل الكلام (كل كلمة بوقتها)", estimate: "≈ تقدير من السكتات في الصوت", manual: "✍️ متعدّل بإيدك" };
function renderScriptTab() {
  const ep = ser.ep;
  if (document.activeElement !== $("serScript")) $("serScript").value = ep.script;
  if (document.activeElement !== $("serNotes")) $("serNotes").value = ep.notes;
  $("serAudioInfo").textContent = ep.audio ? `${ep.audio.name || "الفويس أوفر"} · ${serFmt(ep.audio.duration)} (ده طول الحلقة)` : "لسه مفيش صوت";
  const player = $("serAudio");
  if (ep.audio && !player.src.endsWith(ep.audio.url)) player.src = ep.audio.url;
  player.hidden = !ep.audio;
  $("serTiming").disabled = !ep.audio || !ep.lines.length;
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
  }).join("") || `<tr><td colspan="5" class="muted">حط السكريبت فوق: جمل الفويس أوفر بين « » وكل مشهد يبدأ بـ «المشهد 1».</td></tr>`;
}
async function patchEpisode(body) {
  ser.ep = await api(`/api/episodes/${ser.ep.id}`, { method: "PATCH", ...jsonBody(body) });
}
$("serScript").addEventListener("change", async () => {
  try { await patchEpisode({ script: $("serScript").value }); renderSeries(); toast(`اتحفظ · ${ser.ep.lines.length} جملة`); } catch (err) { toast(err.message, true); }
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
    if (ser.ep.lines.length) $("serTiming").click();
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
  return `<div class="take ${t.id === chosen ? "sel" : ""} ${t.status}" data-take="${t.id}" title="${t.source === "upload" ? escapeHtml(t.name || "فيديو مرفوع") : "Seedance"}${t.error ? ` — ${escapeHtml(t.error)}` : ""}">
    ${media}<em>${t.source === "upload" ? "⬆" : "✨"} ${t.duration ? `${t.duration.toFixed(1)}ث` : ""}</em>
    ${busy ? "" : `<b data-del-take title="امسح النسخة">✕</b>`}</div>`;
}
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
    return `${head}<article class="shot" data-shot="${s.id}">
      <header><b>${s.n}</b><span class="t">${serFmt(s.start)} → ${serFmt(s.end)}</span><span class="dur">${s.duration.toFixed(1)}ث</span>
        <button class="btn sm" data-play="${s.start}:${s.end}" title="اسمع الكلام اللي على اللقطة">▶</button></header>
      <div class="said" data-no-i18n>${said}</div>
      <input type="text" class="title" data-f="title" value="${escapeHtml(s.title || "")}" placeholder="وصف اللقطة" data-no-i18n>
      <div class="meta" data-no-i18n>${[s.shot, s.camera, s.location, s.sfx && `🔊 ${s.sfx}`, s.transition && `↪ ${s.transition}`].filter(Boolean).map(escapeHtml).join(" · ")}</div>
      <textarea data-f="prompt" rows="4" dir="ltr" placeholder="Prompt" data-no-i18n>${escapeHtml(s.prompt || "")}</textarea>
      <div class="takes">${s.takes.map((t) => takeThumb(t, s.chosen)).join("")}</div>
      <div class="acts">
        <button class="btn sm primary" data-gen>✨ ولّد نسخة</button>
        <label class="btn sm">⬆ ارفع فيديو<input type="file" data-up accept="video/*" hidden></label>
        ${chosen ? `<label class="off">يبدأ من <input type="number" step="0.1" min="0" data-f="offset" value="${s.offset || 0}">ث</label>` : ""}
        ${short ? `<span class="warn">⚠️ النسخة أقصر من اللقطة، آخر فريم هيتمد</span>` : ""}
      </div>
    </article>`;
  }).join("");
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
    const take = e.target.closest("[data-take]");
    if (!take) return;
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

// ---------- 4. التجميع ----------
function renderRenderTab() {
  const ep = ser.ep;
  const missing = ep.shots.filter((s) => !s.takes.some((t) => t.id === s.chosen && t.status === "done")).length;
  const r = ep.render;
  $("serRenderGo").disabled = !ep.shots.length || r.status === "working";
  $("serRenderState").textContent = r.status === "working" ? "🎞️ بيجمّع الحلقة..." : r.status === "failed" ? `✕ ${r.error || ""}` : "";
  $("serRenderHint").textContent = !ep.shots.length ? "جهّز اللقطات الأول."
    : missing ? `⚠️ ${missing} لقطة لسه من غير فيديو، هتطلع سودا بمدتها. تقدر تجمّع عشان تشوف الإيقاع.`
      : "كل اللقطات جاهزة. كل لقطة بتتقص على مدتها بالظبط من الصوت، والفويس أوفر فوقهم.";
  $("serRendered").innerHTML = ep.export_url ? `<video src="${ep.export_url}" controls preload="metadata"></video>
    <p class="hint">اتحفظت في الفيديوهات الجاهزة، وتقدر تنشرها من صفحة النشر.</p>` : "";
}
$("serRenderGo").onclick = () => busyButton($("serRenderGo"), "⏳", async () => {
  ser.ep = await api(`/api/episodes/${ser.ep.id}/render`, { method: "POST" });
  renderSeries();
});

// متابعة: النسخ اللي بتتولد والتجميع
function schedulePollSeries() {
  clearTimeout(ser.timer);
  const ep = ser.ep;
  if (!ep) return;
  const busy = ep.render.status === "working" || ep.shots.some((s) => s.takes.some((t) => t.status === "queued" || t.status === "working"));
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
