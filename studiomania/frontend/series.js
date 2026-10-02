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
  renderRewrite();
  $("serWriteState").textContent = ep.script_approved ? "✅ السكريبت معتمد: سجّل الفويس أوفر وارفعه في «3 الفويس أوفر»" : ep.lines.length ? `${ep.lines.length} جملة فويس أوفر` : "";
}
$("serWriteForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const message = $("serWriteMsg").value.trim();
  if (ser.ep.chat.length && !message) return $("serWriteMsg").focus();
  if (ser.ep.shots.some((s) => s.takes.length)
    && !confirm("الحلقة دي ليها فيديوهات خلاص. الكاتب هنا بيكتب الحلقة من الأول، ولو غيّرت السكريبت اللقطات مش هتمشي معاه.\nلو عايز تغيّر الكلام بس وتسيب الفيديوهات، استخدم «🎭 كلام جديد على نفس الفيديوهات» فوق.\n\nتكمّل برضه؟")) return;
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

// كلام جديد على نفس الفيديوهات: الجمل القديمة بفيديوهاتها، وتقدر تزوّد جمل جديدة (بيتعمل لها لقطات بعد التسجيل)
const wordsOf = (t) => (t || "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
function rwRows() {
  return [...$("serRwLines").querySelectorAll(".rw-line")].map((el) => ({
    n: el.dataset.n ? Number(el.dataset.n) : null, k: el.dataset.k, text: el.querySelector("textarea").value,
  }));
}
function rwCount(el) {
  const old = ser.ep.lines.find((l) => l.n === Number(el.dataset.n));
  const b = wordsOf(el.querySelector("textarea").value);
  const wc = el.querySelector(".wc");
  if (!old) { wc.textContent = `≈ ${(b / 2.4).toFixed(1)}ث`; wc.classList.remove("long"); return; }
  const a = wordsOf(old.text);
  wc.textContent = `${b}/${a}${b > a + 1 ? " ⚠️ أطول" : ""}`;
  wc.classList.toggle("long", b > a + 1);
}
function rwRowHtml(r) {
  const old = r.n != null ? ser.ep.lines.find((l) => l.n === r.n) : null;
  return `<div class="rw-line ${old ? "" : "new"}" data-k="${escapeHtml(r.k || "")}" data-n="${r.n ?? ""}"><b>${old ? r.n : "➕"}</b>
    <div class="rw-body">${old
      ? `<div class="old">«${escapeHtml(old.text)}» <span class="muted">· ${(old.end - old.start).toFixed(1)}ث</span></div>`
      : `<div class="old new-tag">جملة جديدة: هيتعمل لها لقطة وفيديو بعد ما تسجّل</div>`}
      <textarea rows="1" placeholder="اكتب الجملة...">${escapeHtml(r.text)}</textarea></div>
    <span class="wc" title="${old ? "عدد الكلمات: الجديد / القديم" : "وقتها تقريبًا"}"></span>
    <span class="rw-tools"><button class="btn sm" data-rw-add title="جملة جديدة بعد دي">➕</button><button class="btn sm" data-rw-del title="شيل الجملة">🗑️</button></span></div>`;
}
function renderRewrite() {
  const ep = ser.ep;
  const ready = ep.shots.length && ep.lines.length && ep.lines.every((l) => l.start != null);
  $("serRewrite").hidden = !ready;
  $("serVoicePending1").hidden = !ep.voice_pending;
  $("serVoicePending2").hidden = !ep.voice_pending;
  if (!ready) return;
  const rw = ep.rewrite.lines;
  $("serRwGo").textContent = rw.length ? "🎭 عدّل" : "🎭 اكتب كلام جديد";
  $("serRwManual").hidden = !!rw.length;
  $("serRwActs").hidden = !rw.length;
  const changed = rw.filter((x) => x.n != null && x.text !== ep.lines.find((l) => l.n === x.n)?.text).length;
  const added = rw.filter((x) => x.n == null).length;
  const removed = ep.lines.length - rw.filter((x) => x.n != null).length;
  $("serRwState").textContent = rw.length ? [`${changed} جملة اتغيرت`, added && `➕ ${added} جديدة`, removed && `🗑️ ${removed} اتشالت`].filter(Boolean).join(" · ") : "";
  if (!rw.length) { $("serRwLines").innerHTML = ""; return; }
  if ($("serRwLines").contains(document.activeElement)) return;
  $("serRwLines").innerHTML = rw.map(rwRowHtml).join("");
  $("serRwLines").querySelectorAll(".rw-line").forEach(rwCount);
}
async function saveRw() {
  try { ser.ep = await api(`/api/episodes/${ser.ep.id}/rewrite`, { method: "PUT", ...jsonBody({ lines: rwRows() }) }); renderSeries(); }
  catch (err) { toast(err.message, true); }
}
$("serRwManual").onclick = () => busyButton($("serRwManual"), "⏳", async () => {
  ser.ep = await api(`/api/episodes/${ser.ep.id}/rewrite`, { method: "PUT", ...jsonBody({ lines: ser.ep.lines.map((l) => ({ n: l.n, text: l.text })) }) });
  renderSeries();
});
$("serRwForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const message = $("serRwMsg").value.trim();
  if (ser.ep.rewrite.lines.length && !message) return $("serRwMsg").focus();
  busyButton($("serRwGo"), "⏳ بيكتب...", async () => {
    ser.ep = await api(`/api/episodes/${ser.ep.id}/rewrite`, { method: "POST", ...jsonBody({ message: message || "خليه مضحك أكتر" }) });
    $("serRwMsg").value = "";
    renderSeries();
  });
});
$("serRwMsg").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("serRwForm").requestSubmit(); }
});
$("serRwLines").addEventListener("input", (e) => {
  const row = e.target.closest(".rw-line");
  if (row && e.target.matches("textarea")) rwCount(row);
});
$("serRwLines").addEventListener("change", (e) => {
  if (e.target.matches("textarea")) saveRw();
});
$("serRwLines").addEventListener("click", (e) => {
  const row = e.target.closest(".rw-line");
  if (!row) return;
  if (e.target.closest("[data-rw-add]")) {
    row.insertAdjacentHTML("afterend", rwRowHtml({ n: null, k: `x${Math.random().toString(36).slice(2, 10)}`, text: "" }));
    const fresh = row.nextElementSibling;
    rwCount(fresh);
    fresh.querySelector("textarea").focus();
  } else if (e.target.closest("[data-rw-del]")) {
    if (row.dataset.n && !confirm("تشيل الجملة دي؟ اللقطة بتاعتها بتفضل بفيديوها بس من غير كلام عليها (وتقدر تحذفها من تبويب اللقطات).")) return;
    row.remove();
    saveRw();
  }
});
// نسخ كلام الفويس أوفر بس (من غير أرقام ولا مشاهد)، كل جملة في سطر، عشان يتحط في برنامج الصوت
const voiceText = (texts) => texts.map((t) => (t || "").trim()).filter(Boolean).join("\n");
async function copyText(text) {
  if (!text) return toast("مفيش كلام", true);
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  toast(`📋 اتنسخ الكلام (${text.split("\n").length} جملة)`);
}
$("serRwCopy").onclick = () => copyText(voiceText(rwRows().map((r) => r.text)));
$("serCopyVoice").onclick = $("serCopyVoice2").onclick = () => copyText(voiceText(ser.ep.lines.map((l) => l.text)));
$("serVoiceTxt").onclick = () => {
  const text = voiceText(ser.ep.lines.map((l) => l.text));
  if (!text) return toast("مفيش كلام", true);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text + "\n"], { type: "text/plain;charset=utf-8" }));
  a.download = `episode-${ser.ep.number}-voiceover.txt`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$("serRwApply").onclick = () => {
  const added = ser.ep.rewrite.lines.filter((x) => x.n == null && x.text.trim()).length;
  if (!confirm(`الكلام الجديد هيبقى سكريبت الحلقة. بعدها تسجّل الفويس أوفر بيه وترفعه، واللقطات تتظبط عليه.${added ? `\nالجمل الجديدة (${added}) هيتعمل لها لقطات جديدة بعد ما ترقّم الجمل على الصوت.` : ""}\n(المونتاج والفيديو اللي صدّرته قبل كده بيفضلوا زي ما هما.)`)) return;
  busyButton($("serRwApply"), "⏳", async () => {
    ser.ep = await api(`/api/episodes/${ser.ep.id}/rewrite/apply`, { method: "POST" });
    ser.tab = "script";
    toast("اتعتمد ✅ سجّل الفويس أوفر الجديد وارفعه هنا");
    renderSeries();
  });
};
$("serRwDiscard").onclick = () => busyButton($("serRwDiscard"), "⏳", async () => {
  ser.ep = await api(`/api/episodes/${ser.ep.id}/rewrite`, { method: "DELETE" });
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
  $("serCopyVoice").disabled = $("serVoiceTxt").disabled = !ep.lines.length;
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
    ${t.url ? `<i class="zoom" data-zoom title="كبّر">🔍</i>` : ""}
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
  const rt = ep.retimed;
  $("serRetimed").hidden = !rt;
  if (rt) $("serRetimed").textContent = rt.short.length
    ? `🔁 اللقطات اتظبطت على الصوت الجديد. ${rt.short.length} لقطة الفيديو بتاعها بقى أقصر من وقتها (${rt.short.join("، ")}): في المونتاج هتتبطّأ شوية وآخر فريم يقف، أو دوس «🔄 واحد تاني» عليها يتولد على الوقت الجديد.`
    : "🔁 اللقطات اتظبطت على الصوت الجديد، وكل الفيديوهات مكفية وقتها.";
  if (rt?.added?.length) $("serRetimed").textContent += ` ➕ اتعملت لقطات جديدة للجمل اللي ضفتها (${rt.added.join("، ")}): ارسم لها ستوري بورد واعتمدها وولّدها.`;
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
      <header><b>${s.n}</b>${s.added ? `<span class="added" title="لقطة ضفتها بإيدك">➕</span>` : ""}<span class="t">${serFmt(s.start)} → ${serFmt(s.end)}</span><span class="dur">${s.duration.toFixed(1)}ث</span>
        <button class="btn sm" data-play="${s.start}:${s.end}" title="اسمع الكلام اللي على اللقطة">▶</button>
        <button class="btn sm" data-add-after title="ضيف لقطة جديدة بعد دي">➕</button>
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
        ${short ? `<span class="warn">⚠️ النسخة أقصر من اللقطة: هتتبطّأ شوية وآخر فريم يقف</span>` : ""}
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
  $("serGalleryGo").disabled = !n;
  if ($("serGalDialog").open) renderGallery();
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
    if (e.target.closest("[data-add-after]")) return askAddShot(id);
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
    if (e.target.closest("[data-zoom]")) return openGallery(id, take.dataset.take);
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
// لقطة جديدة بين لقطتين: وقتها بيتاخد من اللي جنبها، والحلقة تفضل على طول الصوت
const ADD_MIN = 0.5;
function addPlan(prev, next, secs, from) {
  const roomP = Math.max(0, prev.duration - ADD_MIN), roomN = next ? Math.max(0, next.duration - ADD_MIN) : 0;
  let a, b;
  if (from === "prev" || !next) { a = Math.min(secs, roomP); b = 0; }
  else if (from === "next") { a = 0; b = Math.min(secs, roomN); }
  else { a = Math.min(secs / 2, roomP); b = Math.min(secs - a, roomN); a = Math.min(secs - b, roomP); }
  return { a, b, got: a + b };
}
function renderAddPlan() {
  const { prev, next } = ser.adding;
  const secs = Number($("serAddSecs").value) || 0;
  const label = (from) => {
    const p = addPlan(prev, next, secs, from);
    const parts = [];
    if (p.a > 0.001) parts.push(`${prev.n}: ${prev.duration.toFixed(1)} ← ${(prev.duration - p.a).toFixed(1)}ث`);
    if (p.b > 0.001) parts.push(`${next.n}: ${next.duration.toFixed(1)} ← ${(next.duration - p.b).toFixed(1)}ث`);
    const short = p.got < secs - 0.05 ? ` · ⚠️ المتاح ${p.got.toFixed(1)}ث بس` : "";
    return `${parts.join(" · ") || "مفيش وقت متاح"}${short}`;
  };
  $("serAddBoth").textContent = `من الاتنين (${label("both")})`;
  $("serAddPrev").textContent = `من اللي قبلها (${label("prev")})`;
  $("serAddNext").textContent = next ? `من اللي بعدها (${label("next")})` : "";
  $("serAddNext").closest("label").hidden = !next;
  $("serAddBoth").closest("label").hidden = !next;
  if (!next) document.querySelector('[name="serAddFrom"][value="prev"]').checked = true;
}
function askAddShot(id) {
  const shots = ser.ep.shots;
  const k = shots.findIndex((s) => s.id === id);
  ser.adding = { prev: shots[k], next: shots[k + 1] || null };
  $("serAddWhere").textContent = ser.adding.next ? `بين ${shots[k].n} و ${shots[k + 1].n}` : `بعد ${shots[k].n}`;
  $("serAddIdea").value = "";
  $("serAddSecs").value = 2;
  document.querySelector('[name="serAddFrom"][value="both"]').checked = true;
  renderAddPlan();
  $("serAddDialog").showModal();
}
$("serAddSecs").addEventListener("input", renderAddPlan);
$("serAddCancel").onclick = () => $("serAddDialog").close();
$("serAddGo").onclick = () => busyButton($("serAddGo"), "⏳ بيكتب اللقطة...", async () => {
  const body = { after: ser.adding.prev.id, seconds: Number($("serAddSecs").value) || 2, idea: $("serAddIdea").value.trim(),
    take_from: document.querySelector('[name="serAddFrom"]:checked').value };
  const r = await api(`/api/episodes/${ser.ep.id}/shots/insert`, { method: "POST", ...jsonBody(body) });
  ser.ep = r;
  $("serAddDialog").close();
  renderSeries();
  const s = ser.ep.shots.find((x) => x.id === r.new_shot);
  toast(`➕ اتضافت اللقطة ${s.n}. راجع البرومبت، ارسم الستوري بورد، واعتمدها عشان تتولد`);
  const card = document.querySelector(`[data-shot="${r.new_shot}"]`);
  if (card) { card.scrollIntoView({ behavior: "smooth", block: "center" }); card.classList.add("flash"); setTimeout(() => card.classList.remove("flash"), 2500); }
});

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
  // الزرار دايمًا شغال: لو فيه لقطات ناقصة بيقولك هي إيه ويفتحهالك
  $("serToEditor").disabled = !ep.shots.length;
  $("serToEditor").classList.toggle("primary", !notOk.length);
  $("serMissing").hidden = !notOk.length;
  $("serMissing").innerHTML = notOk.length ? `<b>⚠️ لقطات لسه من غير فيديو موافق عليه:</b> ${ep.shots.filter((s) => notOk.includes(s.n)).map((s) => `<button class="chip" data-gal-open="${s.id}" title="افتحها">${s.n}</button>`).join("")}` : "";
  const missing = ep.shots.filter((s) => !s.takes.some((t) => t.id === s.chosen && t.status === "done")).length;
  const r = ep.render;
  $("serRenderGo").disabled = !ep.shots.length;
  $("serRenderState").textContent = r.status === "working" ? "🎞️ بيجمّع الحلقة..." : r.status === "failed" ? `✕ ${r.error || ""}` : "";
  $("serRenderHint").textContent = !ep.shots.length ? "جهّز اللقطات الأول."
    : notOk.length ? `🎬 لسه ${notOk.length} لقطة من غير فيديو موافق عليه. دوس على رقم أي لقطة تفتحها. المعاينة السريعة بتحط مكانهم أسود أو النسخة المختارة.`
    : missing ? `⚠️ ${missing} لقطة لسه من غير فيديو، هتطلع سودا بمدتها. تقدر تجمّع عشان تشوف الإيقاع.`
      : "كل اللقطات جاهزة. كل لقطة بتتقص على مدتها بالظبط من الصوت، والفويس أوفر فوقهم.";
  $("serRendered").innerHTML = ep.export_url ? `<video src="${ep.export_url}" controls preload="metadata"></video>
    <p class="hint">اتحفظت في الفيديوهات الجاهزة، وتقدر تنشرها من صفحة النشر.</p>` : "";
}
$("serMissing").addEventListener("click", (e) => {
  const b = e.target.closest("[data-gal-open]");
  if (b) openGallery(b.dataset.galOpen);
});
$("serToEditor").onclick = () => {
  const missing = ser.ep.shots.filter((s) => !s.takes.some((t) => t.id === s.chosen && t.approved));
  if (missing.length) {
    toast(`فيه ${missing.length} لقطة لسه من غير فيديو موافق عليه (${missing.map((s) => s.n).join("، ")}). وافق عليهم وبعدين افتح المحرر.`, true);
    return openGallery(missing[0].id);
  }
  openInEditor();
};
const openInEditor = () => busyButton($("serToEditor"), "⏳", async () => {
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

// ---------- معرض فيديوهات الحلقة: كل اللقطات قدامك، ودوس على أي واحدة تكبر وتعاينها ----------
const gal = { filter: "all", shot: null, take: null, list: [] };
const GAL_LABEL = { done: "✅ موافق عليه", review: "👀 مستني موافقتك", busy: "🎬 بيتولد...", todo: "لسه" };
function galState(s) {
  const chosen = s.takes.find((t) => t.id === s.chosen);
  if (chosen?.status === "done") return chosen.approved ? "done" : "review";
  if (s.takes.some((t) => t.status === "queued" || t.status === "working")) return "busy";
  return "todo";
}
function galTake(s) {
  return s.takes.find((t) => t.id === s.chosen) || s.takes.filter((t) => t.status === "queued" || t.status === "working").slice(-1)[0] || s.takes.slice(-1)[0];
}
function openGallery(shotId = null, takeId = null) {
  gal.shot = shotId;
  gal.take = takeId;
  if (shotId && gal.filter !== "all" && !galShots().some((s) => s.id === shotId)) gal.filter = "all";
  renderGallery();
  if (!$("serGalDialog").open) $("serGalDialog").showModal();
}
function galShots() {
  return ser.ep.shots.filter((s) => gal.filter === "all" || galState(s) === gal.filter);
}
function galStop() {
  $("serGalAudio").pause();
  const v = $("serGalStage").querySelector("video");
  if (v) v.pause();
}
function renderGallery() {
  const ep = ser.ep;
  if (!ep) return;
  const counts = { all: ep.shots.length, done: 0, review: 0, busy: 0, todo: 0 };
  ep.shots.forEach((s) => counts[galState(s)]++);
  $("serGalCount").textContent = `✅ ${counts.done} · 👀 ${counts.review} · 🎬 ${counts.busy} · لسه ${counts.todo} — من ${counts.all} لقطة`;
  document.querySelectorAll("#serGalTabs [data-f]").forEach((b) => {
    b.classList.toggle("active", b.dataset.f === gal.filter);
    b.dataset.count = counts[b.dataset.f];
  });
  const shots = galShots();
  gal.list = shots.map((s) => s.id);
  const viewing = !!gal.shot && ep.shots.some((s) => s.id === gal.shot);
  $("serGalAll").hidden = viewing;
  $("serGalView").hidden = !viewing;
  if (viewing) return renderGalView();
  galStop();
  $("serGalGrid").innerHTML = shots.map((s) => {
    const st = galState(s);
    const t = galTake(s);
    const failed = st === "todo" && t?.status === "failed";
    const media = t?.url && (st === "done" || st === "review")
      ? lightVideo(t.url, "muted loop playsinline")
      : `${s.frame_url ? `<img src="${s.frame_url}" alt="">` : ""}${st === "busy" ? `<div class="spin"></div>` : ""}`;
    return `<button class="gal-tile ${st}" data-gal="${s.id}" title="${escapeHtml(s.title || "")}" data-no-i18n>${media}
      <span class="n">${s.n}</span><span class="st">${failed ? "✕ فشل" : s.approved || st !== "todo" ? GAL_LABEL[st] : "اللقطة مش معتمدة"} · ${s.duration.toFixed(1)}ث</span></button>`;
  }).join("") || `<p class="muted">مفيش لقطات هنا.</p>`;
}
function renderGalView() {
  const ep = ser.ep;
  const s = ep.shots.find((x) => x.id === gal.shot);
  if (!s.takes.some((t) => t.id === gal.take)) gal.take = galTake(s)?.id || null;
  const t = s.takes.find((x) => x.id === gal.take);
  const k = gal.list.indexOf(s.id);
  $("serGalTitle").textContent = `اللقطة ${s.n} · ${serFmt(s.start)} → ${serFmt(s.end)} · ${s.duration.toFixed(1)}ث${s.title ? ` · ${s.title}` : ""}`;
  $("serGalPrev").disabled = k <= 0;
  $("serGalNext").disabled = k < 0 || k >= gal.list.length - 1;
  const lines = Object.fromEntries(ep.lines.map((l) => [l.n, l]));
  $("serGalSaid").innerHTML = (s.lines || []).map((n) => lines[n]).filter(Boolean).map((l) => `«${escapeHtml(l.text)}»`).join(" ") || `<span class="muted">(من غير كلام)</span>`;
  // المسرح: الفيديو الكبير (من غير ما نعيد تحميله لو هو هو)
  const stage = $("serGalStage");
  const cur = stage.querySelector("video");
  if (t?.url) {
    if (!cur || cur.dataset.url !== t.url) {
      galStop();
      stage.innerHTML = `<video src="${t.url}" data-url="${t.url}" controls playsinline autoplay></video>`;
      galHookVideo(stage.querySelector("video"), s);
    }
  } else {
    galStop();
    const busy = t && (t.status === "queued" || t.status === "working");
    stage.innerHTML = `${s.frame_url ? `<img src="${s.frame_url}" alt="">` : ""}<div style="position:absolute">${busy ? `<div class="spin"></div>${TAKE_STATE[t.status]}` : t?.status === "failed" ? "✕ الفيديو فشل" : "لسه مفيش فيديو"}</div>`;
    stage.style.position = "relative";
  }
  $("serGalTakes").innerHTML = s.takes.length > 1 ? s.takes.map((x) => takeThumb(x, s.chosen).replace(`class="take `, `class="take ${x.id === gal.take ? "viewing " : ""}`)).join("") : "";
  $("serGalErr").hidden = !(t?.status === "failed" && t.error);
  $("serGalErr").textContent = t?.error ? `✕ ${t.error}` : "";
  const acts = [];
  if (t?.status === "done") {
    if (t.id !== s.chosen) acts.push(`<button class="btn sm" data-gal-pick>👈 استخدم النسخة دي</button>`);
    else acts.push(`<button class="btn ${t.approved ? "" : "primary"}" data-gal-ok>${t.approved ? "✅ موافق عليه (دوس تلغي)" : "✅ موافق على الفيديو"}</button>`);
  }
  if (t?.status === "failed" && t.source === "seedance") acts.push(`<button class="btn sm" data-gal-retry>↻ حاول تاني</button>`);
  acts.push(s.approved
    ? `<button class="btn sm" data-gal-gen>${t ? "🔄 ولّد واحد تاني" : "🎬 ولّد الفيديو"}</button>`
    : `<button class="btn sm" data-gal-approve-shot>✅ اعتمد اللقطة الأول</button>`);
  $("serGalActs").innerHTML = acts.join("");
}
// الفويس أوفر بتاع اللقطة يمشي مع الفيديو
function galHookVideo(v, s) {
  const a = $("serGalAudio");
  if (ser.ep.audio && !a.src.endsWith(ser.ep.audio.url)) a.src = ser.ep.audio.url;
  const voiceOn = () => $("serGalVoice").checked && !!ser.ep.audio;
  const sync = () => {
    const shot = ser.ep.shots.find((x) => x.id === s.id) || s;
    a.currentTime = shot.start + Math.max(0, v.currentTime - (shot.offset || 0));
  };
  v.muted = voiceOn();
  v.addEventListener("play", () => { v.muted = voiceOn(); if (voiceOn()) { sync(); a.play().catch(() => {}); } });
  v.addEventListener("pause", () => a.pause());
  v.addEventListener("ended", () => a.pause());
  v.addEventListener("seeked", () => { if (voiceOn() && !v.paused) sync(); });
  v.addEventListener("timeupdate", () => { if (!a.paused && a.currentTime >= s.end) a.pause(); });
}
$("serGalVoice").onchange = () => {
  const v = $("serGalStage").querySelector("video");
  if (!v) return;
  v.muted = $("serGalVoice").checked && !!ser.ep.audio;
  if (!v.muted) $("serGalAudio").pause();
  else if (!v.paused) { v.pause(); v.play(); }
};
function galMove(step) {
  const k = gal.list.indexOf(gal.shot);
  const id = gal.list[k + step];
  if (!id) return;
  gal.shot = id;
  gal.take = null;
  renderGallery();
}
$("serGalleryGo").onclick = () => openGallery();
$("serGalClose").onclick = () => $("serGalDialog").close();
$("serGalDialog").addEventListener("close", () => { galStop(); $("serGalStage").innerHTML = ""; gal.shot = null; });
$("serGalDialog").addEventListener("cancel", (e) => { if (gal.shot) { e.preventDefault(); gal.shot = null; renderGallery(); } });
$("serGalBack").onclick = () => { gal.shot = null; renderGallery(); };
$("serGalPrev").onclick = () => galMove(-1);
$("serGalNext").onclick = () => galMove(1);
document.addEventListener("keydown", (e) => {
  if (!$("serGalDialog").open || !gal.shot || e.target.closest?.("input, textarea")) return;
  if (e.key === "ArrowLeft") { e.preventDefault(); galMove(1); }
  if (e.key === "ArrowRight") { e.preventDefault(); galMove(-1); }
});
$("serGalTabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-f]");
  if (!b) return;
  gal.filter = b.dataset.f;
  renderGallery();
});
$("serGalGrid").addEventListener("click", (e) => {
  const tile = e.target.closest("[data-gal]");
  if (tile) openGallery(tile.dataset.gal);
});
$("serGalGrid").addEventListener("mouseover", (e) => { const v = e.target.closest(".gal-tile video"); if (v) { v.preload = "auto"; v.play().catch(() => {}); } });
$("serGalGrid").addEventListener("mouseout", (e) => { const v = e.target.closest(".gal-tile video"); if (v) v.pause(); });
$("serGalTakes").addEventListener("click", async (e) => {
  const take = e.target.closest("[data-take]");
  if (!take) return;
  if (e.target.closest("[data-del-take]")) {
    if (!confirm("مسح النسخة دي نهائي؟")) return;
    try { ser.ep = await api(`/api/episodes/${ser.ep.id}/takes/${take.dataset.take}`, { method: "DELETE" }); renderSeries(); }
    catch (err) { toast(err.message, true); }
    return;
  }
  gal.take = take.dataset.take;
  renderGalView();
});
$("serGalActs").addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const eid = ser.ep.id;
  const sid = gal.shot;
  try {
    b.disabled = true;
    if (b.matches("[data-gal-ok]")) {
      const t = ser.ep.shots.find((x) => x.id === sid).takes.find((x) => x.id === gal.take);
      ser.ep = await api(`/api/episodes/${eid}/takes/${t.id}/approve?approved=${!t.approved}`, { method: "POST" });
      if (!t.approved) toast(`✅ اللقطة ${ser.ep.shots.find((x) => x.id === sid).n} موافق عليها`);
    } else if (b.matches("[data-gal-pick]")) {
      ser.ep = await api(`/api/episodes/${eid}/shots/${sid}/pick`, { method: "POST", ...jsonBody({ take_id: gal.take }) });
    } else if (b.matches("[data-gal-retry]")) {
      ser.ep = await api(`/api/episodes/${eid}/takes/${gal.take}/retry`, { method: "POST" });
    } else if (b.matches("[data-gal-gen]")) {
      ser.ep = await api(`/api/episodes/${eid}/shots/${sid}/generate`, { method: "POST" });
      gal.take = null;
    } else if (b.matches("[data-gal-approve-shot]")) {
      await patchEpisode({ shot: { id: sid, approved: true } });
    }
    renderSeries();
  } catch (err) { toast(err.message, true); b.disabled = false; }
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
