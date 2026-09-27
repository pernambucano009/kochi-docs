// StudioMania — الخطوة 4: مكتبة المدربين

const coachState = { list: [], editing: null };

async function loadCoaches() {
  coachState.list = await api("/api/coaches");
  renderCoaches();
  return coachState.list;
}

function renderCoaches() {
  $("coachesEmpty").hidden = coachState.list.length > 0;
  $("coachCount").textContent = coachState.list.length ? `(${coachState.list.length})` : "";
  $("coachesGrid").innerHTML = coachState.list
    .map(
      (c) => `<div class="coach">
        <img src="${c.image_url}" alt="">
        <div class="body">
          <div class="name">${escapeHtml(c.name)}</div>
          <div class="outro">${
            c.outro_url
              ? `🎬 أوترو ${fmt(c.outro_duration)} <button class="btn sm" data-act="outro" data-id="${c.id}">▶︎ شوف</button>`
              : "مفيش أوترو"
          }</div>
          <div class="acts">
            <button class="btn sm" data-act="edit" data-id="${c.id}">تعديل</button>
            <button class="btn sm danger" data-act="delete" data-id="${c.id}">حذف</button>
          </div>
        </div>
      </div>`
    )
    .join("");
}

function resetCoachForm() {
  coachState.editing = null;
  $("coachForm").reset();
  $("coachFormTitle").textContent = "إضافة مدرب";
  $("coachCancel").hidden = true;
  $("removeOutroWrap").hidden = true;
  $("coachImagePreview").hidden = true;
}

function editCoach(c) {
  resetCoachForm();
  coachState.editing = c;
  $("coachFormTitle").textContent = `تعديل: ${c.name}`;
  $("coachName").value = c.name;
  $("coachImagePreview").src = c.image_url;
  $("coachImagePreview").hidden = false;
  $("coachCancel").hidden = false;
  $("removeOutroWrap").hidden = !c.outro_url;
  $("coachName").focus();
}

$("coachImage").addEventListener("change", (e) => {
  const f = e.target.files[0];
  const img = $("coachImagePreview");
  if (f) {
    img.src = URL.createObjectURL(f);
    img.hidden = false;
  }
});

$("coachCancel").onclick = resetCoachForm;

$("coachForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const editing = coachState.editing;
  const form = new FormData();
  form.append("name", $("coachName").value.trim());
  const image = $("coachImage").files[0];
  const outro = $("coachOutro").files[0];
  if (!editing && !image) return toast("اختار صورة المدرب", true);
  if (image) form.append("image", image);
  if (outro) form.append("outro", outro);
  if (editing && $("removeOutro").checked) form.append("remove_outro", "true");

  const btn = $("coachSubmit");
  btn.disabled = true;
  btn.textContent = "⏳ بيحفظ...";
  try {
    await api(editing ? `/api/coaches/${editing.id}` : "/api/coaches", {
      method: editing ? "PATCH" : "POST",
      body: form,
    });
    toast(editing ? "✅ اتعدّل" : "✅ المدرب اتضاف");
    resetCoachForm();
    await loadCoaches();
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "حفظ";
  }
});

$("coachesGrid").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const c = coachState.list.find((x) => x.id === btn.dataset.id);
  if (!c) return;
  if (btn.dataset.act === "edit") editCoach(c);
  if (btn.dataset.act === "delete") {
    if (!confirm(`حذف المدرب "${c.name}"؟`)) return;
    await api(`/api/coaches/${c.id}`, { method: "DELETE" });
    if (coachState.editing?.id === c.id) resetCoachForm();
    await loadCoaches();
  }
  if (btn.dataset.act === "outro") {
    const dlg = document.createElement("dialog");
    dlg.className = "outro-dlg";
    dlg.innerHTML = `<video src="${c.outro_url}" controls autoplay playsinline></video>
      <div class="row gap-top"><button class="btn sm">إغلاق</button></div>`;
    dlg.querySelector("button").onclick = () => dlg.close();
    dlg.addEventListener("close", () => dlg.remove());
    document.body.appendChild(dlg);
    dlg.showModal();
  }
});

viewHooks["4"] = loadCoaches;

// ---------- الرفع الجماعي ----------
const bulk = { images: [], outros: [], rows: [], busy: false };
const NOISE = /(outro|intro|final|photo|image|img|pic|avatar|coach|اوترو|أوترو|إوترو|صوره|صورة|المدرب|مدرب|كوتش|v\d+)/g;

// بيوحّد الاسم عشان "Ahmed_Outro.mp4" و "ahmed.png" و "أحمد" و "احمد" يتطابقوا
function matchKey(filename) {
  return filename
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[ً-ْ]/g, "")
    .replace(NOISE, "")
    .replace(/[\s_\-.()\[\]]+/g, "");
}
function niceName(filename) {
  const n = filename.replace(/\.[^.]+$/, "").replace(/[_\-.]+/g, " ").replace(/\b(outro|photo|image|img|final)\b/gi, "").replace(/\s+/g, " ").trim();
  return n || filename;
}

function findByKey(list, key, getKey) {
  const exact = list.filter((x) => getKey(x) === key);
  if (exact.length) return exact[0];
  if (key.length < 3) return null;
  const partial = list.filter((x) => { const k = getKey(x); return k.length >= 3 && (k.includes(key) || key.includes(k)); });
  return partial.length === 1 ? partial[0] : null; // لو فيه أكتر من احتمال، نسيبه للمستخدم
}

function buildBulkRows() {
  const coaches = coachState.list;
  const outros = bulk.outros.map((f, i) => ({ i, f, key: matchKey(f.name) }));
  const used = new Set();
  const rows = bulk.images.map((f) => {
    const key = matchKey(f.name);
    const existing = findByKey(coaches, key, (c) => matchKey(c.name));
    return { key, image: f, name: existing ? existing.name : niceName(f.name), existingId: existing?.id || null, outro: null, preview: URL.createObjectURL(f) };
  });
  // الأوترو بيدوّر على صورة بنفس الاسم
  for (const o of outros) {
    const row = findByKey(rows.filter((r) => r.outro === null), o.key, (r) => r.key);
    if (row) { row.outro = o.i; used.add(o.i); }
  }
  // أو على مدرب موجود قبل كده (رفع أوتروهات بس)
  for (const o of outros) {
    if (used.has(o.i)) continue;
    const c = findByKey(coaches, o.key, (x) => matchKey(x.name));
    if (c && !rows.some((r) => r.existingId === c.id)) {
      rows.push({ key: o.key, image: null, name: c.name, existingId: c.id, outro: o.i, preview: c.image_url });
      used.add(o.i);
    }
  }
  bulk.rows = rows;
}

function renderBulk() {
  const { rows, outros, images } = bulk;
  $("bulkCounts").textContent = `${images.length} صورة · ${outros.length} أوترو`;
  $("bulkEmpty").hidden = rows.length > 0;
  const assigned = new Set(rows.map((r) => r.outro).filter((x) => x !== null));
  const unmatched = outros.map((f, i) => i).filter((i) => !assigned.has(i));
  const noOutro = rows.filter((r) => r.outro === null).length;
  const warn = [];
  if (unmatched.length) warn.push(`⚠️ ${unmatched.length} أوترو ماتعرفش عليهم: ${unmatched.map((i) => outros[i].name).join("، ")}. اختارهم من القايمة جنب المدرب الصح.`);
  if (noOutro && outros.length) warn.push(`${noOutro} مدرب من غير أوترو.`);
  $("bulkWarn").hidden = !warn.length;
  $("bulkWarn").innerHTML = warn.map(escapeHtml).join("<br>");
  const names = new Map();
  rows.forEach((r) => names.set(r.name.trim(), (names.get(r.name.trim()) || 0) + 1));
  $("bulkRows").innerHTML = rows
    .map((r, ri) => {
      const opts = `<option value="">— من غير أوترو —</option>` + outros
        .map((f, i) => `<option value="${i}" ${r.outro === i ? "selected" : ""}>${assigned.has(i) && r.outro !== i ? "✓ " : ""}${escapeHtml(f.name)}</option>`)
        .join("");
      const action = r.existingId
        ? `<span class="pill scheduled">تحديث مدرب موجود${r.image ? " (صورة" + (r.outro !== null ? " + أوترو)" : ")") : r.outro !== null ? " (أوترو)" : ""}</span>`
        : `<span class="pill published">مدرب جديد</span>`;
      const dup = names.get(r.name.trim()) > 1 ? `<div class="err">الاسم ده متكرر</div>` : "";
      return `<tr data-i="${ri}">
        <td>${r.preview ? `<img src="${r.preview}" alt="">` : ""}</td>
        <td><input type="text" data-f="name" value="${escapeHtml(r.name)}">${dup}</td>
        <td><select data-f="outro">${opts}</select></td>
        <td>${action}</td>
        <td><button class="btn sm danger" data-f="remove" title="شيله">✕</button></td>
      </tr>`;
    })
    .join("");
  const bad = rows.some((r) => !r.name.trim() || names.get(r.name.trim()) > 1 || (!r.existingId && !r.image));
  $("bulkUpload").disabled = !rows.length || bad || bulk.busy;
  $("bulkUpload").textContent = `⬆ ارفع الكل (${rows.length})`;
}

$("bulkOpen").onclick = () => {
  Object.assign(bulk, { images: [], outros: [], rows: [] });
  $("bulkProgress").textContent = "";
  $("bulkBar").hidden = true;
  renderBulk();
  $("bulkDialog").showModal();
};
$("bulkClose").onclick = () => { if (!bulk.busy) $("bulkDialog").close(); };
$("bulkImages").addEventListener("change", (e) => {
  bulk.images = [...bulk.images, ...e.target.files];
  e.target.value = "";
  buildBulkRows();
  renderBulk();
});
$("bulkOutros").addEventListener("change", (e) => {
  bulk.outros = [...bulk.outros, ...e.target.files];
  e.target.value = "";
  buildBulkRows();
  renderBulk();
});

$("bulkRows").addEventListener("input", (e) => {
  if (e.target.dataset.f !== "name") return;
  const row = bulk.rows[Number(e.target.closest("tr").dataset.i)];
  row.name = e.target.value;
  // لو الاسم بقى زي مدرب موجود، نحدّثه بدل ما نكرره
  const c = coachState.list.find((x) => x.name.trim() === row.name.trim());
  if (row.image) row.existingId = c?.id || null;
  const pos = e.target.selectionStart;
  renderBulk();
  const again = document.querySelector(`#bulkRows tr[data-i="${bulk.rows.indexOf(row)}"] input[data-f="name"]`);
  if (again) { again.focus(); again.setSelectionRange(pos, pos); }
});
$("bulkRows").addEventListener("change", (e) => {
  if (e.target.dataset.f !== "outro") return;
  const row = bulk.rows[Number(e.target.closest("tr").dataset.i)];
  const v = e.target.value === "" ? null : Number(e.target.value);
  // الأوترو يروح لمدرب واحد بس
  if (v !== null) bulk.rows.forEach((r) => { if (r !== row && r.outro === v) r.outro = null; });
  row.outro = v;
  renderBulk();
});
$("bulkRows").addEventListener("click", (e) => {
  if (e.target.closest("[data-f=remove]")) {
    bulk.rows.splice(Number(e.target.closest("tr").dataset.i), 1);
    renderBulk();
  }
});

$("bulkUpload").onclick = async () => {
  const rows = bulk.rows.filter((r) => r.image || r.outro !== null || r.existingId);
  bulk.busy = true;
  renderBulk();
  $("bulkBar").hidden = false;
  const bar = $("bulkBar").querySelector("i");
  let ok = 0;
  const failed = [];
  for (const [n, r] of rows.entries()) {
    $("bulkProgress").textContent = `⏳ ${n + 1} من ${rows.length}: ${r.name}`;
    bar.style.width = `${(n / rows.length) * 100}%`;
    const form = new FormData();
    form.append("name", r.name.trim());
    if (r.image) form.append("image", r.image);
    if (r.outro !== null) form.append("outro", bulk.outros[r.outro]);
    try {
      await api(r.existingId ? `/api/coaches/${r.existingId}` : "/api/coaches", { method: r.existingId ? "PATCH" : "POST", body: form });
      ok++;
    } catch (err) {
      failed.push(`${r.name}: ${err.message}`);
    }
  }
  bar.style.width = "100%";
  bulk.busy = false;
  await loadCoaches();
  if (failed.length) {
    $("bulkProgress").textContent = `✅ ${ok} تمام · ✕ ${failed.length} فشلوا`;
    $("bulkWarn").hidden = false;
    $("bulkWarn").innerHTML = failed.map(escapeHtml).join("<br>");
    bulk.rows = bulk.rows.filter((r) => failed.some((f) => f.startsWith(r.name.trim() + ":")));
    renderBulk();
  } else {
    $("bulkDialog").close();
    toast(`✅ اترفع ${ok} مدرب`);
  }
};
