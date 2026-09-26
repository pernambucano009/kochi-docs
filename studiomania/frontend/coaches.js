// StudioMania — الخطوة 4: مكتبة المدربين

const coachState = { list: [], editing: null };

async function loadCoaches() {
  coachState.list = await api("/api/coaches");
  renderCoaches();
  return coachState.list;
}

function renderCoaches() {
  $("coachesEmpty").hidden = coachState.list.length > 0;
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
