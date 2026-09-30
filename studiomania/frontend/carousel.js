// StudioMania — صناعة الكاروسيل: نقاش ← نص سعودي ← الشكل العام ← السلايدات واحدة واحدة

const car = { list: [], cur: null, cfg: null, coaches: [], sec: null, timer: null, saveTimer: null, sending: false };
const CAR_KEY = "studiomania.carousel";
const CAR_STATUS = { idle: "", queued: "⏳ مستنية دورها", working: "🎨 بترسم...", done: "", failed: "✕ فشلت" };

async function initCarousel() {
  try {
    [car.cfg, car.coaches] = await Promise.all([api("/api/carousel/settings"), api("/api/coaches")]);
  } catch (err) {
    return toast(err.message, true);
  }
  $("carAlert").hidden = car.cfg.configured;
  $("carAlert").innerHTML = `⚠️ مفتاح Atlas مش متسجل. حطه من <a href="#" data-goto="settings">⚙️ الإعدادات</a>.`;
  $("carModelName").textContent = car.cfg.text_model;
  $("carCount").innerHTML = [3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option value="${n}">${n}</option>`).join("");
  $("carCoach").innerHTML = `<option value="">— من غير مدرب —</option>` +
    car.coaches.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  await loadCarList();
  const last = car.cur?.id || storageGet(CAR_KEY) || car.list[0]?.id;
  if (last && car.list.some((c) => c.id === last)) await openCarousel(last);
  else renderCarousel();
}
viewHooks["8"] = initCarousel;

async function loadCarList() {
  car.list = await api("/api/carousels");
  $("carListEmpty").hidden = car.list.length > 0;
  $("carList").innerHTML = car.list
    .map((c) => `<li data-id="${c.id}" class="${car.cur?.id === c.id ? "active" : ""}">
      ${c.cover ? `<img src="${c.cover}" alt="">` : `<span class="ph"></span>`}
      <div><div class="name" data-no-i18n>${escapeHtml(c.name)}</div>
      <div class="muted">${c.slides ? `${c.done} / ${c.slides} سلايد` : "لسه في الفكرة"}${c.busy ? " · 🎨" : ""}</div></div>
    </li>`)
    .join("");
}

$("carList").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-id]");
  if (li) openCarousel(li.dataset.id);
});

$("carNewForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const topic = $("carNewName").value.trim();
  if (!topic) return $("carNewName").focus();
  try {
    const c = await api("/api/carousels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: topic }) });
    $("carNewName").value = "";
    car.cur = c;
    car.sec = "idea";
    storageSet(CAR_KEY, c.id);
    await loadCarList();
    renderCarousel();
    // أول رسالة: الموضوع نفسه، والموديل يبدأ يقترح
    sendChat(`عايز كاروسيل عن: ${topic}. اقترح عليا أفكار.`);
  } catch (err) {
    toast(err.message, true);
  }
});

async function openCarousel(id) {
  try {
    car.cur = await api(`/api/carousels/${id}`);
  } catch (err) {
    return toast(err.message, true);
  }
  car.sec = null;
  storageSet(CAR_KEY, id);
  await loadCarList();
  renderCarousel();
}

// ---------- الرسم على الشاشة ----------
function autoSection(c) {
  if (c.slides.some((s) => s.status !== "idle")) return "slides";
  if (c.overview.status !== "idle") return "overview";
  if (c.plan) return "plan";
  return "idea";
}
function reachable(c, s) {
  if (s === "idea") return true;
  if (s === "plan" || s === "overview") return !!c.plan;
  return !!c.overview.approved;
}

function renderCarousel() {
  const c = car.cur;
  $("carMain").hidden = !c;
  $("carPlaceholder").hidden = !!c;
  if (!c) return;
  if (!car.sec || !reachable(c, car.sec)) car.sec = autoSection(c);
  if (document.activeElement !== $("carName")) $("carName").value = c.name;
  document.querySelectorAll("#carSteps button").forEach((b) => {
    b.classList.toggle("active", b.dataset.s === car.sec);
    b.disabled = !reachable(c, b.dataset.s);
  });
  document.querySelectorAll(".car-sec").forEach((s) => (s.hidden = s.dataset.sec !== car.sec));
  $("carCount").value = c.settings.slides;
  $("carRatio").value = c.settings.ratio;
  $("carCoach").value = c.settings.coach_id || "";
  renderChat();
  renderPlan();
  renderOverview();
  renderSlides();
  schedulePoll();
}

$("carSteps").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-s]");
  if (!b || b.disabled) return;
  car.sec = b.dataset.s;
  renderCarousel();
});

function renderChat() {
  const c = car.cur;
  const msgs = c.chat.map((m) => `<div class="msg ${m.role}">${escapeHtml(m.content)}</div>`);
  if (car.sending) msgs.push(`<div class="msg assistant typing"><span></span><span></span><span></span></div>`);
  $("carChat").innerHTML = msgs.join("") || `<p class="empty">ابدأ بالموضوع، والموديل هيقترح أفكار. اتناقش معاه لحد ما توصلوا لفكرة، وبعدين دوس «اكتب الكاروسيل».</p>`;
  $("carChat").scrollTop = $("carChat").scrollHeight;
  $("carSend").disabled = car.sending;
  $("carPlanBtn").disabled = car.sending || !c.chat.length;
}

async function sendChat(text) {
  const c = car.cur;
  if (!text.trim() || car.sending) return;
  car.sending = true;
  c.chat = [...c.chat, { role: "user", content: text }];
  renderChat();
  try {
    car.cur = await api(`/api/carousels/${c.id}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
  } catch (err) {
    c.chat = c.chat.slice(0, -1);
    $("carMsg").value = text;
    toast(err.message, true);
  } finally {
    car.sending = false;
    renderCarousel();
  }
}
$("carChatForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const t = $("carMsg").value;
  $("carMsg").value = "";
  sendChat(t);
});
$("carMsg").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("carChatForm").requestSubmit(); }
});
$("carQuick").addEventListener("click", (e) => {
  const b = e.target.closest("[data-q]");
  if (b) sendChat(b.dataset.q);
});

async function patchCarousel(body) {
  car.cur = await api(`/api/carousels/${car.cur.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
for (const [id, key] of [["carCount", "slides"], ["carRatio", "ratio"], ["carCoach", "coach_id"]]) {
  $(id).addEventListener("change", async () => {
    try { await patchCarousel({ settings: { [key]: $(id).value } }); } catch (err) { toast(err.message, true); }
  });
}
$("carName").addEventListener("change", async () => {
  try { await patchCarousel({ name: $("carName").value }); await loadCarList(); } catch (err) { toast(err.message, true); }
});

async function busyButton(btn, label, fn) {
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;
  try { await fn(); } catch (err) { toast(err.message, true); } finally { btn.disabled = false; btn.textContent = old; }
}

$("carPlanBtn").onclick = () => {
  const c = car.cur;
  if (c.plan && !confirm("فيه نص مكتوب قبل كده. تكتبه من الأول من النقاش؟")) return;
  busyButton($("carPlanBtn"), "⏳ بيكتب...", async () => {
    await patchCarousel({ settings: { slides: $("carCount").value, ratio: $("carRatio").value, coach_id: $("carCoach").value } });
    car.cur = await api(`/api/carousels/${c.id}/plan`, { method: "POST" });
    car.sec = "plan";
    await loadCarList();
    renderCarousel();
    toast("✅ الكاروسيل اتكتب. راجع الكلام");
  });
};

// ---------- النص ----------
function renderPlan() {
  const p = car.cur.plan;
  if (!p) return;
  const box = $("carPlan");
  if (box.contains(document.activeElement)) return; // متمسحش اللي بتكتبه
  box.innerHTML = p.slides
    .map((s, i) => `<div class="car-slide-edit" data-i="${i}">
      <div class="num">${i + 1}</div>
      <div class="fields">
        <input type="text" data-k="headline" value="${escapeHtml(s.headline)}" placeholder="العنوان">
        <textarea data-k="body" rows="2" placeholder="الكلام (ممكن يبقى فاضي)">${escapeHtml(s.body)}</textarea>
        <details><summary>وصف الرسمة</summary><textarea data-k="visual" rows="2" dir="ltr">${escapeHtml(s.visual)}</textarea></details>
      </div>
      <div class="acts">
        <button class="btn sm" data-act="up" title="لفوق" ${i ? "" : "disabled"}>▲</button>
        <button class="btn sm danger" data-act="del" title="امسح السلايد">✕</button>
      </div>
    </div>`)
    .join("") + `<button class="btn sm" id="carAddSlide">＋ ضيف سلايد</button>`;
  if (document.activeElement !== $("carCaption")) $("carCaption").value = p.caption || "";
  if (document.activeElement !== $("carTags")) $("carTags").value = (p.hashtags || []).join(" ");
  $("carPlanState").textContent = `${p.slides.length} سلايد`;
}

function planFromForm() {
  const slides = [...$("carPlan").querySelectorAll(".car-slide-edit")].map((el) => ({
    headline: el.querySelector('[data-k="headline"]').value.trim(),
    body: el.querySelector('[data-k="body"]').value.trim(),
    visual: el.querySelector('[data-k="visual"]').value.trim(),
  }));
  return { ...car.cur.plan, slides, caption: $("carCaption").value.trim(), hashtags: $("carTags").value.split(/\s+/).filter(Boolean) };
}
function savePlanSoon() {
  $("carPlanState").textContent = "● متعدّل";
  clearTimeout(car.saveTimer);
  car.saveTimer = setTimeout(savePlan, 700);
}
async function savePlan(plan = planFromForm()) {
  clearTimeout(car.saveTimer);
  try {
    await patchCarousel({ plan });
    $("carPlanState").textContent = "✓ اتحفظ";
  } catch (err) {
    toast(err.message, true);
  }
}
$("carPlan").addEventListener("input", savePlanSoon);
$("carCaption").addEventListener("input", savePlanSoon);
$("carTags").addEventListener("input", savePlanSoon);
$("carPlan").addEventListener("click", async (e) => {
  if (e.target.id === "carAddSlide") {
    const plan = planFromForm();
    plan.slides.splice(plan.slides.length - 1, 0, { headline: "", body: "", visual: "" });
    await savePlan(plan);
    return renderCarousel();
  }
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  const i = Number(b.closest(".car-slide-edit").dataset.i);
  const plan = planFromForm();
  if (b.dataset.act === "del") {
    if (plan.slides.length <= 2) return toast("لازم سلايدين على الأقل", true);
    plan.slides.splice(i, 1);
  }
  if (b.dataset.act === "up") [plan.slides[i - 1], plan.slides[i]] = [plan.slides[i], plan.slides[i - 1]];
  await savePlan(plan);
  renderCarousel();
});

$("carPolish").onclick = () => busyButton($("carPolish"), "⏳ بينقّح...", async () => {
  await savePlan();
  car.cur = await api(`/api/carousels/${car.cur.id}/polish`, { method: "POST" });
  $("carPlan").innerHTML = "";
  renderCarousel();
  toast("✨ اتنقّح. راجع التغييرات");
});

$("carToOverview").onclick = () => busyButton($("carToOverview"), "⏳", async () => {
  await savePlan();
  const ov = car.cur.overview;
  if (ov.status === "done" && !confirm("فيه شكل عام مرسوم. ترسمه تاني بالنص الجديد؟")) {
    car.sec = "overview";
    return renderCarousel();
  }
  car.cur = await api(`/api/carousels/${car.cur.id}/overview`, { method: "POST" });
  car.sec = "overview";
  renderCarousel();
});

// ---------- الشكل العام ----------
function renderOverview() {
  const ov = car.cur.overview;
  const working = ov.status === "working";
  $("carOvState").textContent = working ? "🎨 بيرسم... (ممكن ياخد دقيقة أو اتنين)" : ov.approved ? "✅ موافق عليه" : "";
  $("carOverview").innerHTML = ov.url
    ? `<a href="${ov.url}" target="_blank"><img src="${ov.url}" alt=""></a>`
    : working ? `<div class="car-wait"><div class="spin"></div>بيرسم الكاروسيل كله...</div>` : "";
  if (ov.error) $("carOverview").innerHTML += `<div class="err">${escapeHtml(ov.error)}</div>`;
  if (working && ov.url) $("carOverview").insertAdjacentHTML("afterbegin", `<div class="car-wait small"><div class="spin"></div>بيرسم نسخة جديدة...</div>`);
  $("carOvRedo").disabled = working || car.cur.busy;
  $("carOvRedo").textContent = ov.url || ov.error ? "🔄 ارسم تاني" : "🎨 ارسم";
  $("carApprove").disabled = working || ov.status !== "done";
  $("carApprove").textContent = ov.approved ? "📱 روح للسلايدات" : "✅ الشكل تمام، كمّل للسلايدات";
}
$("carOvRedo").onclick = () => busyButton($("carOvRedo"), "⏳", async () => {
  car.cur = await api(`/api/carousels/${car.cur.id}/overview`, { method: "POST" });
  renderCarousel();
});
$("carApprove").onclick = () => busyButton($("carApprove"), "⏳", async () => {
  if (!car.cur.overview.approved) car.cur = await api(`/api/carousels/${car.cur.id}/approve`, { method: "POST" });
  car.sec = "slides";
  renderCarousel();
});

// ---------- السلايدات ----------
function renderSlides() {
  const c = car.cur;
  if (!c.plan) return;
  const done = c.slides.filter((s) => s.status === "done").length;
  const active = c.slides.some((s) => s.status === "working" || s.status === "queued");
  $("carSlidesState").textContent = `${done} / ${c.slides.length} جاهزة`;
  $("carZip").href = `/api/carousels/${c.id}/zip`;
  $("carZip").hidden = !done;
  $("carSlidesGo").hidden = active || done === c.slides.length;
  $("carSlidesGo").textContent = done ? `🎨 كمّل الباقي (${c.slides.length - done})` : "🎨 ارسم السلايدات";
  const ratio = c.settings.ratio === "4:5" ? "4 / 5" : "9 / 16";
  $("carGrid").innerHTML = c.plan.slides
    .map((p, i) => {
      const s = c.slides[i] || { status: "idle" };
      const media = s.url
        ? `<a href="${s.url}" target="_blank"><img src="${s.url}" alt=""></a>`
        : `<div class="car-wait">${s.status === "working" ? `<div class="spin"></div>` : ""}${CAR_STATUS[s.status] || ""}</div>`;
      return `<div class="car-card ${s.status}" data-k="${i + 1}">
        <div class="img" style="aspect-ratio:${ratio}">${media}${s.url && s.status === "working" ? `<div class="car-wait over"><div class="spin"></div></div>` : ""}</div>
        <div class="body">
          <div class="n">${i + 1}</div>
          <div class="txt" data-no-i18n><b>${escapeHtml(p.headline)}</b>${p.body ? `<br>${escapeHtml(p.body)}` : ""}</div>
          ${s.error ? `<div class="err">${escapeHtml(s.error)}</div>` : ""}
          <div class="acts">
            ${s.url ? `<a class="btn sm" href="${s.url}" download="${i + 1}.png">⬇</a>` : ""}
            <button class="btn sm" data-redo="${i + 1}" ${active || c.busy ? "disabled" : ""}>🔄 ${s.url ? "أعد" : "ارسم"}</button>
          </div>
        </div>
      </div>`;
    })
    .join("");
}
$("carSlidesGo").onclick = () => busyButton($("carSlidesGo"), "⏳", async () => {
  car.cur = await api(`/api/carousels/${car.cur.id}/slides`, { method: "POST" });
  renderCarousel();
});
$("carGrid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-redo]");
  if (!b) return;
  busyButton(b, "⏳", async () => {
    car.cur = await api(`/api/carousels/${car.cur.id}/slides?only=${b.dataset.redo}`, { method: "POST" });
    renderCarousel();
  });
});

$("carDelete").onclick = async () => {
  if (!confirm(`حذف «${car.cur.name}» وكل صوره؟`)) return;
  try {
    await api(`/api/carousels/${car.cur.id}`, { method: "DELETE" });
    car.cur = null;
    await loadCarList();
    renderCarousel();
  } catch (err) {
    toast(err.message, true);
  }
};

// متابعة الرسم (بيحصل على السيرفر حتى لو قفلت الصفحة)
function schedulePoll() {
  clearTimeout(car.timer);
  const c = car.cur;
  const running = c && (c.busy || c.overview.status === "working" || c.slides.some((s) => s.status === "working" || s.status === "queued"));
  if (!running || document.querySelector('.view[data-view="8"]').hidden) return;
  car.timer = setTimeout(async () => {
    if (car.cur?.id !== c.id) return;
    try {
      const before = car.cur.slides.filter((s) => s.status === "done").length + (car.cur.overview.status === "done" ? 1 : 0);
      car.cur = await api(`/api/carousels/${c.id}`);
      const after = car.cur.slides.filter((s) => s.status === "done").length + (car.cur.overview.status === "done" ? 1 : 0);
      if (after !== before) loadCarList();
    } catch {}
    renderCarousel();
  }, 3000);
}

// ---------- الهوية البصرية والموديلات ----------
function renderBrand() {
  const cfg = car.cfg;
  document.querySelectorAll("#brandDialog [data-b]").forEach((el) => {
    el.value = cfg.brand[el.dataset.b] || "";
    el.placeholder ||= cfg.defaults[el.dataset.b] || "";
  });
  $("brandLogo").innerHTML = cfg.logo ? `<img src="${cfg.logo}" alt="">` : `<span class="muted">مفيش لوجو. ارفعه من المونتاج ← البراند</span>`;
  $("brandRefs").innerHTML = cfg.refs.map((r) => `<div class="ref"><img src="${r.url}" alt=""><button class="del" data-ref="${r.name}" title="امسح">✕</button></div>`).join("")
    || `<span class="muted">مفيش صور لسه</span>`;
  $("brandTextModel").value = cfg.text_model;
  $("brandImageModel").innerHTML = Object.entries(cfg.image_models).map(([k, v]) => `<option value="${k}" ${k === cfg.image_family ? "selected" : ""}>${v}</option>`).join("");
  $("brandQuality").innerHTML = cfg.qualities.map((q) => `<option ${q === cfg.quality ? "selected" : ""}>${q}</option>`).join("");
}
$("carBrandOpen").onclick = async () => {
  car.cfg = await api("/api/carousel/settings");
  renderBrand();
  $("brandTestOut").textContent = "";
  $("brandDialog").showModal();
};
$("brandClose").onclick = () => $("brandDialog").close();
$("brandSave").onclick = () => busyButton($("brandSave"), "⏳", async () => {
  const brand = {};
  document.querySelectorAll("#brandDialog [data-b]").forEach((el) => (brand[el.dataset.b] = el.value));
  car.cfg = await api("/api/carousel/settings", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brand, text_model: $("brandTextModel").value, image_family: $("brandImageModel").value, quality: $("brandQuality").value }),
  });
  $("carModelName").textContent = car.cfg.text_model;
  $("brandDialog").close();
  toast("✅ اتحفظ");
});
$("brandTest").onclick = () => busyButton($("brandTest"), "⏳", async () => {
  await api("/api/carousel/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text_model: $("brandTextModel").value }) });
  const r = await api("/api/carousel/test-model", { method: "POST" });
  $("brandTestOut").textContent = `✓ ${r.reply}`;
});
$("brandRefUpload").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = "";
  for (const f of files) {
    const form = new FormData();
    form.append("file", f);
    try { car.cfg = await api("/api/carousel/refs", { method: "POST", body: form }); } catch (err) { toast(err.message, true); break; }
  }
  renderBrand();
});
$("brandRefs").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-ref]");
  if (!b) return;
  car.cfg = await api(`/api/carousel/refs/${encodeURIComponent(b.dataset.ref)}`, { method: "DELETE" });
  renderBrand();
});
