// StudioMania — الكابشن واللوجو في المونتاج

const brand = { options: null, logoUrl: null, tr: {}, trTimer: null, editing: null };
const FRAME_SCALE = 216 / 1080; // كادر المعاينة بالنسبة لحجم الفيديو الحقيقي

async function loadBrandOptions() {
  if (!brand.options) {
    brand.options = await api("/api/captions/options");
    // نسجّل الخطوط عشان المعاينة تبان بنفس شكل الفيديو
    for (const f of brand.options.fonts) {
      const face = new FontFace(f.family, `url(${f.url})`);
      face.load().then((ff) => document.fonts.add(ff)).catch(() => {});
    }
    $("capFont").innerHTML = brand.options.fonts.map((f) => `<option value="${f.family}">${f.label}</option>`).join("");
    $("capTemplates").innerHTML = Object.entries(brand.options.templates)
      .map(([k, t]) => `<button type="button" data-t="${k}" style="font-family:'${t.font}';color:${t.color};${
        t.box ? `background:${t.box_color};` : `-webkit-text-stroke:1px #000;paint-order:stroke fill;`}">
        كابشن <span style="color:${t.highlight_on ? t.highlight : t.color}">&nbsp;هنا</span><small>${t.label}</small></button>`)
      .join("");
  }
  brand.logoUrl = (await api("/api/logo")).url;
}

function capCfg() {
  const d = mt.project.data;
  if (!d.captions || !d.captions.template) {
    d.captions = { enabled: false, template: brand.options.default_template, ...brand.options.templates[brand.options.default_template], ...(d.captions || {}) };
  }
  return d.captions;
}
function logoCfg() {
  const d = mt.project.data;
  d.logo = { ...brand.options.logo_defaults, ...(d.logo || {}) };
  return d.logo;
}

// ---------- عرض الإعدادات ----------
function renderBrandPanels() {
  if (!mt.project || !brand.options) return;
  const c = capCfg();
  const l = logoCfg();
  $("capOn").checked = !!c.enabled;
  $("capOpts").hidden = !c.enabled;
  document.querySelectorAll("#capTemplates button").forEach((b) => b.classList.toggle("selected", b.dataset.t === c.template));
  $("capFont").value = c.font;
  $("capSize").value = c.size; $("capSizeVal").textContent = c.size;
  $("capY").value = c.y; $("capYVal").textContent = `${Math.round(c.y)}%`;
  $("capWords").value = c.words; $("capWordsVal").textContent = c.words;
  $("capColor").value = c.color; $("capHl").value = c.highlight; $("capBoxColor").value = c.box_color;
  $("capHlOn").checked = !!c.highlight_on; $("capBox").checked = !!c.box; $("capPop").checked = !!c.pop;
  renderTranscriptStatus();

  $("logoOn").checked = !!l.enabled;
  $("logoThumb").hidden = $("logoRemove").hidden = !brand.logoUrl;
  if (brand.logoUrl) $("logoThumb").src = brand.logoUrl;
  $("logoUpLabel").textContent = brand.logoUrl ? "غيّر اللوجو" : "ارفع اللوجو";
  $("logoOpts").hidden = !l.enabled || !brand.logoUrl;
  $("logoSize").value = l.size; $("logoSizeVal").textContent = `${l.size}%`;
  $("logoX").value = l.x; $("logoXVal").textContent = `${l.x}%`;
  $("logoY").value = l.y; $("logoYVal").textContent = `${l.y}%`;
  $("logoOp").value = Math.round(l.opacity * 100); $("logoOpVal").textContent = `${Math.round(l.opacity * 100)}%`;
  $("logoHideOutro").checked = !!l.hide_outro;
  updatePreviewOverlays();
}

function brandInput(apply) {
  return () => { apply(); renderBrandPanels(); scheduleSave(); };
}
$("capOn").addEventListener("change", brandInput(() => (capCfg().enabled = $("capOn").checked)));
$("capTemplates").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-t]");
  if (!b) return;
  const c = capCfg();
  Object.assign(c, brand.options.templates[b.dataset.t], { template: b.dataset.t });
  delete c.label;
  renderBrandPanels();
  scheduleSave();
});
$("capFont").addEventListener("change", brandInput(() => (capCfg().font = $("capFont").value)));
$("capSize").addEventListener("input", brandInput(() => (capCfg().size = Number($("capSize").value))));
$("capY").addEventListener("input", brandInput(() => (capCfg().y = Number($("capY").value))));
$("capWords").addEventListener("input", brandInput(() => (capCfg().words = Number($("capWords").value))));
$("capColor").addEventListener("input", brandInput(() => (capCfg().color = $("capColor").value)));
$("capHl").addEventListener("input", brandInput(() => (capCfg().highlight = $("capHl").value)));
$("capBoxColor").addEventListener("input", brandInput(() => (capCfg().box_color = $("capBoxColor").value)));
$("capHlOn").addEventListener("change", brandInput(() => (capCfg().highlight_on = $("capHlOn").checked)));
$("capBox").addEventListener("change", brandInput(() => (capCfg().box = $("capBox").checked)));
$("capPop").addEventListener("change", brandInput(() => (capCfg().pop = $("capPop").checked)));

$("logoOn").addEventListener("change", brandInput(() => (logoCfg().enabled = $("logoOn").checked)));
$("logoSize").addEventListener("input", brandInput(() => (logoCfg().size = Number($("logoSize").value))));
$("logoX").addEventListener("input", brandInput(() => (logoCfg().x = Number($("logoX").value))));
$("logoY").addEventListener("input", brandInput(() => (logoCfg().y = Number($("logoY").value))));
$("logoOp").addEventListener("input", brandInput(() => (logoCfg().opacity = Number($("logoOp").value) / 100)));
$("logoHideOutro").addEventListener("change", brandInput(() => (logoCfg().hide_outro = $("logoHideOutro").checked)));

$("logoUpload").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const form = new FormData();
  form.append("file", file);
  try {
    brand.logoUrl = (await api("/api/logo", { method: "POST", body: form })).url;
    logoCfg().enabled = true;
    renderBrandPanels();
    scheduleSave();
    toast("✅ اللوجو اترفع");
  } catch (err) {
    toast(err.message, true);
  }
});
$("logoRemove").onclick = async () => {
  if (!confirm("حذف اللوجو من كل الفيديوهات الجاية؟")) return;
  await api("/api/logo", { method: "DELETE" });
  brand.logoUrl = null;
  renderBrandPanels();
};

// ---------- معاينة اللوجو والكابشن على الكادر ----------
function updatePreviewOverlays() {
  if (!mt.project || !brand.options) return;
  const W = 216, H = 384;
  const l = logoCfg();
  const img = $("pvLogo");
  img.hidden = !(l.enabled && brand.logoUrl);
  if (!img.hidden) {
    if (img.getAttribute("src") !== brand.logoUrl) img.src = brand.logoUrl;
    const w = (W * l.size) / 100;
    const h = img.naturalWidth ? (w * img.naturalHeight) / img.naturalWidth : w;
    Object.assign(img.style, {
      width: `${w}px`, left: `${((W - w) * l.x) / 100}px`, top: `${((H - h) * l.y) / 100}px`, opacity: l.opacity,
    });
  }
  const c = capCfg();
  const cap = $("pvCap");
  cap.hidden = !c.enabled;
  if (cap.hidden) return;
  const words = sampleWords(c.words);
  const hlIndex = c.highlight_on && words.length > 1 ? 1 : -1;
  const stroke = c.box ? "" : `-webkit-text-stroke:${Math.max(1, (c.size / 16) * FRAME_SCALE * 2)}px #000;paint-order:stroke fill;`;
  cap.style.cssText = `top:${(H * c.y) / 100}px;font-family:'${c.font}';font-size:${c.size * FRAME_SCALE}px;color:${c.color};`;
  cap.innerHTML = `<span style="${c.box ? `background:${c.box_color};` : ""}${stroke}">${words
    .map((w, i) => (i === hlIndex ? `<b style="color:${c.highlight};font-weight:inherit">${escapeHtml(w)}</b>` : escapeHtml(w)))
    .join(" ")}</span>`;
}
$("pvLogo").addEventListener("load", updatePreviewOverlays);

function sampleWords(n) {
  const voice = mt.project?.data.voice;
  const tr = voice && brand.tr[voice.id];
  const src = tr?.status === "done" && tr.words.length ? tr.words.map((w) => w.w) : "ده مثال للكابشن على الفيديو بتاعك يا كوتشي".split(" ");
  return src.slice(0, Math.max(1, n));
}

// ---------- كتابة الكلام من التعليق الصوتي ----------
async function loadTranscript(voiceId) {
  brand.tr[voiceId] = await api(`/api/audio/${voiceId}/transcript`);
  return brand.tr[voiceId];
}

function renderTranscriptStatus() {
  const voice = mt.project?.data.voice;
  const st = $("capStatus");
  const tr = voice && brand.tr[voice.id];
  $("capTranscribe").disabled = !voice;
  $("capEdit").hidden = !(tr?.status === "done" && tr.words.length);
  clearTimeout(brand.trTimer);
  if (!voice) {
    st.className = "cap-status err";
    st.textContent = "⚠️ اختار تعليق صوتي الأول (تحت)، الكابشن بيتكتب منه.";
    return;
  }
  if (!tr) {
    st.className = "cap-status";
    st.textContent = "…";
    loadTranscript(voice.id).then(renderTranscriptStatus);
    return;
  }
  if (tr.status === "working") {
    st.className = "cap-status";
    st.textContent = "⏳ بيسمع التعليق الصوتي ويكتب الكلام...";
    $("capTranscribe").disabled = true;
    brand.trTimer = setTimeout(async () => {
      await loadTranscript(voice.id);
      renderTranscriptStatus();
      updatePreviewOverlays();
    }, 3000);
  } else if (tr.status === "done") {
    st.className = "cap-status ok";
    st.textContent = `✓ الكلام جاهز (${tr.words.length} كلمة)${tr.edited ? " · متعدّل" : ""}`;
    $("capTranscribe").textContent = "🎧 اكتبه تاني من الأول";
  } else if (tr.status === "failed") {
    st.className = "cap-status err";
    st.textContent = `✕ ${tr.error || "فشل"}`;
    $("capTranscribe").textContent = "🎧 جرّب تاني";
  } else {
    st.className = "cap-status";
    st.textContent = "لسه الكلام متكتبش.";
    $("capTranscribe").textContent = "🎧 اكتب الكلام من التعليق الصوتي";
  }
}

$("capTranscribe").onclick = async () => {
  const voice = mt.project.data.voice;
  const tr = brand.tr[voice.id];
  if (tr?.edited && !confirm("إنت عدّلت الكلام قبل كده. الكتابة من الأول هتمسح تعديلاتك. تكمّل؟")) return;
  try {
    await api(`/api/audio/${voice.id}/transcribe`, { method: "POST" });
    brand.tr[voice.id] = { status: "working", words: [] };
    renderTranscriptStatus();
  } catch (err) {
    toast(err.message, true);
  }
};

// ---------- تعديل الكلام ----------
function groupWords(words, n) {
  const groups = [];
  let cur = [];
  for (const w of words) {
    if (cur.length && (cur.length >= n || w.s - cur[cur.length - 1].e > 0.7)) { groups.push(cur); cur = []; }
    cur.push(w);
  }
  if (cur.length) groups.push(cur);
  return groups;
}

$("capEdit").onclick = () => {
  const voice = mt.project.data.voice;
  const tr = brand.tr[voice.id];
  const groups = groupWords(tr.words, Math.max(4, capCfg().words));
  brand.editing = { voiceId: voice.id, groups };
  const track = mt.voices.find((a) => a.id === voice.id);
  $("trAudio").src = track?.url || "";
  $("trList").innerHTML = groups
    .map((g, i) => `<div class="tr-row" data-i="${i}">
      <button class="btn sm" data-play="${i}" title="اسمع">▶︎</button>
      <span class="t">${g[0].s.toFixed(1)}s → ${g[g.length - 1].e.toFixed(1)}s</span>
      <input type="text" value="${escapeHtml(g.map((w) => w.w).join(" "))}">
    </div>`)
    .join("");
  $("trDialog").showModal();
};

let trStop = null;
$("trList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-play]");
  if (!b) return;
  const g = brand.editing.groups[Number(b.dataset.play)];
  const a = $("trAudio");
  a.currentTime = g[0].s;
  trStop = g[g.length - 1].e;
  a.play();
});
$("trAudio").addEventListener("timeupdate", () => {
  if (trStop !== null && $("trAudio").currentTime >= trStop) { $("trAudio").pause(); trStop = null; }
});

function closeTr() {
  $("trAudio").pause();
  $("trDialog").close();
}
$("trClose").onclick = $("trCancel").onclick = closeTr;

$("trSave").onclick = async () => {
  const { voiceId, groups } = brand.editing;
  const words = [];
  document.querySelectorAll("#trList .tr-row").forEach((row) => {
    const g = groups[Number(row.dataset.i)];
    const texts = row.querySelector("input").value.split(/\s+/).filter(Boolean);
    if (!texts.length) return; // لو مسحت الجملة كلها، بتختفي
    if (texts.length === g.length) {
      texts.forEach((t, i) => words.push({ w: t, s: g[i].s, e: g[i].e }));
    } else {
      const s = g[0].s, e = g[g.length - 1].e, step = (e - s) / texts.length;
      texts.forEach((t, i) => words.push({ w: t, s: s + i * step, e: s + (i + 1) * step }));
    }
  });
  try {
    brand.tr[voiceId] = await api(`/api/audio/${voiceId}/transcript`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words }),
    });
    closeTr();
    toast("✅ الكلام اتحفظ");
    renderBrandPanels();
  } catch (err) {
    toast(err.message, true);
  }
};

// نربط نفسنا بصفحة المونتاج
const _openMontage = viewHooks["6"];
viewHooks["6"] = async () => {
  await loadBrandOptions();
  await _openMontage();
};
