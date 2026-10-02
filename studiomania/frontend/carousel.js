// StudioMania — صناعة الكاروسيل: نقاش ← نص سعودي ← الشكل العام ← السلايدات واحدة واحدة

const car = { list: [], cur: null, cfg: null, coaches: [], lib: [], sec: null, timer: null, saveTimer: null, sending: false, libTab: "template" };
const CAR_KEY = "studiomania.carousel";
const CAR_STATUS = { idle: "", queued: "⏳ مستنية دورها", working: "🎨 بترسم...", done: "", failed: "✕ فشلت" };

async function initCarousel() {
  try {
    [car.cfg, car.coaches, car.lib] = await Promise.all([api("/api/carousel/settings"), api("/api/coaches"), api("/api/carousel/library")]);
  } catch (err) {
    return toast(err.message, true);
  }
  $("carAlert").hidden = car.cfg.configured;
  $("carAlert").innerHTML = `⚠️ مفتاح Atlas مش متسجل. حطه من <a href="#" data-goto="settings">⚙️ الإعدادات</a>.`;
  $("carModelName").textContent = car.cfg.text_model;
  $("carCount").innerHTML = [3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option value="${n}">${n}</option>`).join("");
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
  if (s === "publish") return c.slides.length > 0 && c.slides.every((x) => x.status === "done");
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
  // الكاروسيلات القديمة اللي اتعملت 9:16 بيفضل مقاسها ظاهر
  if (![...$("carRatio").options].some((o) => o.value === c.settings.ratio)) $("carRatio").add(new Option(`${c.settings.ratio} (قديم)`, c.settings.ratio));
  $("carRatio").value = c.settings.ratio;
  renderSetup();
  renderChat();
  renderPlan();
  renderOverview();
  renderSlides();
  renderPublish();
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
for (const [id, key] of [["carCount", "slides"], ["carRatio", "ratio"]]) {
  $(id).addEventListener("change", async () => {
    try { await patchCarousel({ settings: { [key]: $(id).value } }); renderSetup(); } catch (err) { toast(err.message, true); }
  });
}

// ---------- نوع الكاروسيل والـ CTA ----------
function assetThumb(a, selected) {
  const img = a.images[0];
  return `<button type="button" class="car-asset ${selected ? "selected" : ""}" data-id="${a.id}" title="${escapeHtml(a.notes || a.name)}">
    ${img ? `<img src="${img.url}" alt="">` : ""}<span>${escapeHtml(a.name)}</span><i>✓</i></button>`;
}

function coachThumb(c, selected) {
  return `<button type="button" class="car-asset ${selected ? "selected" : ""}" data-id="${c.id}" title="${escapeHtml(c.name)}${c.instagram ? ` @${escapeHtml(c.instagram)}` : ""}">
    <img src="${c.image_url}" alt="" loading="lazy"><span>${escapeHtml(c.name)}</span><i>✓</i></button>`;
}
function renderSetup() {
  const st = car.cur.settings;
  const picked = new Set(st.character_ids || []);
  const empty = (what) => `<span class="muted">مفيش ${what} لسه. ضيف من 📚 المكتبة.</span>`;
  $("carTemplates").innerHTML = car.lib.filter((a) => a.kind === "template").map((a) => assetThumb(a, a.id === st.template_id)).join("") || empty("تيمبليتس");
  $("carStyles").innerHTML = car.lib.filter((a) => a.kind === "style").map((a) => assetThumb(a, a.id === st.style_id)).join("") || empty("ستايلات");
  $("carChars").innerHTML = car.lib.filter((a) => a.kind === "character").map((a) => assetThumb(a, picked.has(a.id))).join("") || empty("شخصيات");
  $("carCoaches").innerHTML = car.coaches.map((c) => coachThumb(c, c.id === st.coach_id)).join("")
    || `<span class="muted">مفيش مدربين لسه. ضيفهم من صفحة المدربين.</span>`;
  const coach = currentCoach();
  $("carCoachNote").textContent = coach ? (coach.handle ? `@${coach.handle} هيتكتب جنب صورته ويتعمله تاج في النشر` : "⚠️ المدرب ده مالوش حساب إنستجرام متسجل (ضيفه من صفحة المدربين)") : "";
  // الـ CTA
  const cta = st.cta || { type: "auto" };
  $("carCta").innerHTML = `<option value="auto">🤖 خليه يختار الأنسب</option>` +
    // دعوات فيها اسم المدرب بتظهر بس لو فيه مدرب متختار
    car.cfg.ctas.filter((c) => coach || !c.text.includes("{coach}"))
      .map((c) => `<option value="${c.id}">${escapeHtml(c.label)}</option>`).join("") +
    `<option value="custom">✍️ اكتبها بنفسك</option>`;
  $("carCta").value = [...$("carCta").options].some((o) => o.value === cta.type) ? cta.type : "auto";
  const tpl = car.cfg.ctas.find((c) => c.id === $("carCta").value);
  const needs = (k) => !!tpl?.text.includes(`{${k}}`);
  $("carCtaKeyword").hidden = !needs("keyword");
  $("carCtaReward").hidden = !needs("reward");
  $("carCtaText").hidden = $("carCta").value !== "custom";
  for (const [id, k] of [["carCtaKeyword", "keyword"], ["carCtaReward", "reward"], ["carCtaText", "text"]]) {
    if (document.activeElement !== $(id)) $(id).value = cta[k] || "";
  }
  $("carCtaPreview").textContent = ctaPreview();
}

// المدرب المختار (من مكتبة الكاروسيل، أو من مدربين التوليد في الكاروسيلات القديمة)
function currentCoach() {
  const st = car.cur.settings;
  const c = car.coaches.find((x) => x.id === st.coach_id);
  if (c) return { name: c.name, handle: c.instagram };
  const a = car.lib.find((x) => x.id === st.coach_asset_id && x.kind === "coach");  // كاروسيلات قديمة
  return a ? { name: a.name, handle: a.handle } : null;
}

function ctaPreview() {
  const type = $("carCta").value;
  if (type === "auto") return "الموديل هيختار الدعوة الأنسب للمحتوى.";
  if (type === "custom") return $("carCtaText").value ? `آخر سلايد: ${$("carCtaText").value}` : "";
  const tpl = car.cfg.ctas.find((c) => c.id === type);
  if (!tpl) return "";
  const coach = currentCoach();
  const text = tpl.text.replace("{keyword}", $("carCtaKeyword").value || "…").replace("{reward}", $("carCtaReward").value || "…")
    .replace("{coach}", (coach?.name || "…").replace(/^(الكوتش|كوتش|الكابتن|كابتن|coach|captain)\s+/i, ""));
  return `آخر سلايد: ${text}`;
}

async function saveSetup(settings) {
  try { await patchCarousel({ settings }); renderSetup(); } catch (err) { toast(err.message, true); }
}
// كل اختيار بيتلغي بدوسة تانية عليه
const toggleId = (cur, id) => (cur === id ? null : id);
$("carTemplates").addEventListener("click", (e) => {
  const b = e.target.closest(".car-asset");
  if (b) saveSetup({ template_id: toggleId(car.cur.settings.template_id, b.dataset.id) });
});
$("carStyles").addEventListener("click", (e) => {
  const b = e.target.closest(".car-asset");
  if (b) saveSetup({ style_id: toggleId(car.cur.settings.style_id, b.dataset.id) });
});
$("carCoaches").addEventListener("click", (e) => {
  const b = e.target.closest(".car-asset");
  if (b) saveSetup({ coach_id: toggleId(car.cur.settings.coach_id, b.dataset.id), coach_asset_id: null });
});
$("carChars").addEventListener("click", (e) => {
  const b = e.target.closest(".car-asset");
  if (!b) return;
  const ids = new Set(car.cur.settings.character_ids || []);
  if (ids.has(b.dataset.id)) ids.delete(b.dataset.id);
  else if (ids.size >= 4) return toast("4 شخصيات بالكتير", true);
  else ids.add(b.dataset.id);
  saveSetup({ character_ids: [...ids] });
});
function ctaFromForm() {
  return { type: $("carCta").value, keyword: $("carCtaKeyword").value, reward: $("carCtaReward").value, text: $("carCtaText").value };
}
$("carCta").addEventListener("change", () => saveSetup({ cta: ctaFromForm() }));
for (const id of ["carCtaKeyword", "carCtaReward", "carCtaText"]) {
  $(id).addEventListener("input", () => {
    $("carCtaPreview").textContent = ctaPreview();
    clearTimeout(car.ctaTimer);
    car.ctaTimer = setTimeout(() => saveSetup({ cta: ctaFromForm() }), 600);
  });
}
document.querySelector(".car-setup").addEventListener("click", (e) => {
  const a = e.target.closest("[data-lib]");
  if (!a) return;
  e.preventDefault();
  openLibrary(a.dataset.lib);
});
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
    await patchCarousel({ settings: { slides: $("carCount").value, ratio: $("carRatio").value, cta: ctaFromForm() } });
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
  $("carOverview").insertAdjacentHTML("beforeend", versionsRow("overview", ov.versions || [], ov.file, working || car.cur.busy));
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

// النسخ: كل اللي اترسم بيتحفظ، ودوسة على أي نسخة تختارها
function versionsRow(target, list, current, locked) {
  if (list.length < 2) return "";
  return `<div class="car-versions" data-target="${target}">
    <span class="muted">${list.length} نسخ:</span>
    ${list.map((v, i) => `<div class="ver ${v.file === current ? "sel" : ""}" data-file="${v.file}" title="نسخة ${i + 1}">
      <img src="${v.url}" alt="" loading="lazy"><em>${i + 1}</em>
      ${v.file === current || locked ? "" : `<b data-del-ver title="امسح النسخة دي">✕</b>`}</div>`).join("")}
  </div>`;
}
async function onVersionClick(e) {
  const ver = e.target.closest(".car-versions .ver");
  if (!ver) return;
  const target = ver.closest(".car-versions").dataset.target;
  const file = ver.dataset.file;
  try {
    if (e.target.closest("[data-del-ver]")) {
      if (!confirm("مسح النسخة دي نهائي؟")) return;
      car.cur = await api(`/api/carousels/${car.cur.id}/versions?target=${encodeURIComponent(target)}&file=${encodeURIComponent(file)}`, { method: "DELETE" });
    } else {
      car.cur = await api(`/api/carousels/${car.cur.id}/pick`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target, file }) });
    }
    renderCarousel();
  } catch (err) { toast(err.message, true); }
}
$("carOverview").addEventListener("click", onVersionClick);
$("carGrid").addEventListener("click", onVersionClick);

// ---------- السلايدات ----------
function renderSlides() {
  const c = car.cur;
  if (!c.plan) return;
  const done = c.slides.filter((s) => s.status === "done").length;
  const active = c.slides.some((s) => s.status === "working" || s.status === "queued");
  $("carSlidesState").textContent = `${done} / ${c.slides.length} جاهزة`;
  $("carZip").href = `/api/carousels/${c.id}/zip`;
  $("carZip").hidden = !done;
  $("carToPublish").hidden = !reachable(c, "publish");
  $("carSlidesGo").hidden = active || done === c.slides.length;
  $("carSlidesGo").textContent = done ? `🎨 كمّل الباقي (${c.slides.length - done})` : "🎨 ارسم السلايدات";
  $("carSlidesAll").hidden = active || c.busy || !done;
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
          ${versionsRow(String(i + 1), s.versions || [], s.file, active || c.busy)}
          <div class="acts">
            ${s.url ? `<a class="btn sm" href="${s.url}" download="${i + 1}.png">⬇</a>` : ""}
            <button class="btn sm" data-redo="${i + 1}" ${active || c.busy ? "disabled" : ""}>🔄 ${s.url ? "أعد" : "ارسم"}</button>
          </div>
        </div>
      </div>`;
    })
    .join("");
}
$("carSlidesAll").onclick = () => busyButton($("carSlidesAll"), "⏳", async () => {
  if (!confirm("ترسم نسخة جديدة لكل السلايدات؟ النسخ القديمة هتفضل محفوظة وتقدر ترجعلها.")) return;
  car.cur = await api(`/api/carousels/${car.cur.id}/slides?redo_all=true`, { method: "POST" });
  renderCarousel();
});
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
  renderCtaEditor(cfg.ctas);
  $("brandTextModel").value = cfg.text_model;
  $("brandVisionModel").value = cfg.vision_model;
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
    body: JSON.stringify({ brand, ctas: ctasFromEditor(), text_model: $("brandTextModel").value, vision_model: $("brandVisionModel").value, image_family: $("brandImageModel").value, quality: $("brandQuality").value }),
  });
  if (car.cur) renderSetup();
  $("carModelName").textContent = car.cfg.text_model;
  $("brandDialog").close();
  toast("✅ اتحفظ");
});
$("brandTest").onclick = () => busyButton($("brandTest"), "⏳", async () => {
  await api("/api/carousel/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text_model: $("brandTextModel").value }) });
  const r = await api("/api/carousel/test-model", { method: "POST" });
  $("brandTestOut").textContent = `✓ ${r.reply}`;
});
function renderCtaEditor(list) {
  $("ctaList").innerHTML = list.map((c) => `<div class="cta-row" data-id="${escapeHtml(c.id)}">
    <input type="text" data-c="label" value="${escapeHtml(c.label)}" placeholder="الاسم">
    <input type="text" data-c="text" value="${escapeHtml(c.text)}" placeholder="النص اللي في آخر سلايد">
    <button type="button" class="btn sm danger" data-c-del title="امسح">✕</button></div>`).join("");
}
function ctasFromEditor() {
  return [...$("ctaList").querySelectorAll(".cta-row")].map((r) => ({
    id: r.dataset.id, label: r.querySelector('[data-c="label"]').value, text: r.querySelector('[data-c="text"]').value,
  }));
}
$("ctaList").addEventListener("click", (e) => {
  if (e.target.closest("[data-c-del]")) e.target.closest(".cta-row").remove();
});
$("ctaAdd").onclick = () => renderCtaEditor([...ctasFromEditor(), { id: `c${Date.now().toString(36)}`, label: "", text: "" }]);
$("ctaReset").onclick = () => renderCtaEditor(car.cfg.default_ctas);

// ---------- المكتبة: معرض صور تختار منه ----------
async function openLibrary(tab = car.libTab) {
  if (!$("libDialog").open) { libStatus(""); car.libEdit = null; }
  car.libTab = tab;
  car.lib = await api("/api/carousel/library");
  renderCarLibrary();
  if (!$("libDialog").open) $("libDialog").showModal();
}
const LIB_HINTS = {
  template: "دوس على التصميم اللي عاجبك يتختار للكاروسيل (ودوسة تانية تلغيه). البرنامج بياخد التقسيم والشكل ويلوّنه بألوان كوتشي ويحط كلامنا.",
  style: "دوس على الستايل يتختار (ودوسة تانية تلغيه). البرنامج بياخد طريقة الرسم بس ويرسم شخصيات جديدة بألوان كوتشي.",
  character: "دوس على الشخصيات اللي عايزها في الكاروسيل (لحد 4).",
  coach: "دوس على المدرب يتختار لكاروسيل «معلومات من مدرب».",
};
const LIB_NEW = { template: "ضيف تصميم", style: "ضيف ستايل", character: "ضيف شخصية", coach: "ضيف مدرب" };
// المختار في الكاروسيل المفتوح
function libSelected(a) {
  const st = car.cur?.settings;
  if (!st) return false;
  if (a.kind === "template") return st.template_id === a.id;
  if (a.kind === "style") return st.style_id === a.id;
  if (a.kind === "coach") return st.coach_asset_id === a.id;
  return (st.character_ids || []).includes(a.id);
}
// الإعدادات اللي بتتغير لما تختار حاجة من المكتبة (دوسة تانية بتلغيها)
function libPickSettings(a) {
  const st = car.cur.settings;
  const on = libSelected(a);
  if (a.kind === "template") return { template_id: on ? null : a.id };
  if (a.kind === "style") return { style_id: on ? null : a.id };
  if (a.kind === "coach") return { coach_asset_id: on ? null : a.id, coach_id: null };
  const ids = new Set(st.character_ids || []);
  if (ids.has(a.id)) ids.delete(a.id);
  else if (ids.size >= 4) return null;
  else ids.add(a.id);
  return { character_ids: [...ids] };
}
function libCard(a) {
  const img = a.images[0];
  return `<div class="lib-card2 ${libSelected(a) ? "selected" : ""}" data-id="${a.id}" title="${escapeHtml(a.notes || a.name)}">
    <div class="lc-img">${img ? `<img src="${img.url}" alt="" loading="lazy">` : ""}${a.images.length > 1 ? `<em>${a.images.length} صور</em>` : ""}</div>
    <div class="lc-name">${escapeHtml(a.name)}${a.handle ? `<small dir="ltr">@${escapeHtml(a.handle)}</small>` : ""}</div>
    <button class="lc-edit" data-edit title="شوف الصور وعدّل">✏️</button><i>✓</i></div>`;
}
function libDetail(a) {
  return `<div class="lib-item lib-detail" data-id="${a.id}">
    <div class="row wrap">
      <button class="btn sm" data-back>→ رجوع للمعرض</button>
      ${car.cur ? `<button class="btn sm ${libSelected(a) ? "" : "primary"}" data-pick>${libSelected(a) ? "✓ متختار (دوس تلغيه)" : "✓ اختاره للكاروسيل"}</button>` : ""}
      <button class="btn sm" data-describe title="البرنامج يبص على الصور ويكتب الخطوط والألوان والتفاصيل">✨ اقرا الصور واكتب الوصف</button>
      <button class="btn sm danger" data-del-asset>🗑️ امسح من المكتبة</button>
    </div>
    <div class="lib-meta">
      <label>الاسم<input type="text" data-f="name" value="${escapeHtml(a.name)}"></label>
      <label>الوصف (البرنامج بيكتبه لوحده، وتقدر تعدّله)<textarea data-f="notes" rows="4" placeholder="الألوان، الخط، أي تفاصيل">${escapeHtml(a.notes)}</textarea></label>
      ${a.kind === "coach" ? `<label>إنستجرام<input type="text" data-f="handle" dir="ltr" value="${a.handle ? `@${escapeHtml(a.handle)}` : ""}" placeholder="@instagram"></label>` : ""}
    </div>
    <div class="lib-big">${a.images.map((im) => `<div class="ref"><a href="${im.url}" target="_blank"><img src="${im.url}" alt=""></a><button class="del" data-img="${im.name}" title="امسح الصورة">✕</button></div>`).join("")}
      <label class="lib-add" title="ضيف صور (لحد 12)">＋<input type="file" data-add accept="image/*" multiple hidden></label></div>
  </div>`;
}
function renderCarLibrary() {
  const tab = car.libTab;
  document.querySelectorAll("#libTabs [data-t]").forEach((b) => b.classList.toggle("active", b.dataset.t === tab));
  const editing = car.lib.find((a) => a.id === car.libEdit);
  $("libHint").textContent = editing ? "" : car.cur ? LIB_HINTS[tab] : "افتح كاروسيل عشان تختار منها. من هنا تقدر تضيف وتعدّل.";
  $("libItems").classList.toggle("detail", !!editing);
  if (editing) { $("libItems").innerHTML = libDetail(editing); return; }
  const items = car.lib.filter((a) => a.kind === tab);
  $("libItems").innerHTML = `<label class="lib-card2 lib-new-card" id="libUploadBtn">
      <div class="lc-img">＋</div><div class="lc-name">${LIB_NEW[tab]}<small>ارفع صورة أو أكتر</small></div>
      <input type="file" id="libFiles" accept="image/*" multiple hidden></label>` + items.map(libCard).join("");
}
$("libTabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-t]");
  if (b) { car.libTab = b.dataset.t; car.libEdit = null; renderCarLibrary(); }
});
$("libClose").onclick = () => $("libDialog").close();
$("libDialog").addEventListener("close", () => car.cur && renderSetup());
// رسالة ثابتة جوه المكتبة (التوست بيختفي بسرعة ومش باين فوق الشباك)
function libStatus(msg, isError = false) {
  const el = $("libStatus");
  el.hidden = !msg;
  el.textContent = msg || "";
  el.classList.toggle("err", isError);
}
function uploadedMsg(res, count) {
  return res.skipped ? `✅ اتضاف ${count - res.skipped} صورة · ${res.skipped} اتسابوا (12 صورة بالكتير لكل واحد)` : `✅ اتضاف ${count} صورة`;
}
async function libPick(a) {
  const settings = libPickSettings(a);
  if (!settings) return libStatus("✕ 4 شخصيات بالكتير", true);
  const was = libSelected(a);
  try {
    await patchCarousel({ settings });
    renderSetup();
    renderCarLibrary();
    libStatus(was ? `اتلغى «${a.name}»` : `✅ اخترت «${a.name}» للكاروسيل`);
  } catch (err) { libStatus(`✕ ${err.message}`, true); }
}
// رفع جديد: من غير اسم (بياخد اسم تلقائي) وبعدها بيفتح التفاصيل لو حابب تغيّره
$("libItems").addEventListener("change", async (e) => {
  if (e.target.id !== "libFiles") return;
  const files = [...e.target.files];
  e.target.value = "";
  if (!files.length) return;
  const form = new FormData();
  form.append("kind", car.libTab);
  files.forEach((f) => form.append("files", f));
  libStatus(`⏳ بيرفع ${files.length} صورة...`);
  $("libUploadBtn").classList.add("busy");
  try {
    const res = await api("/api/carousel/library", { method: "POST", body: form });
    car.libEdit = res.id;
    await openLibrary();
    // البرنامج يقرا الصور لوحده ويكتب الاسم والوصف
    await describeAsset(res.id, uploadedMsg(res, files.length));
  } catch (err) {
    libStatus(`✕ ${err.message}`, true);
    $("libUploadBtn")?.classList.remove("busy");
  }
});
async function describeAsset(id, prefix = "") {
  libStatus(`${prefix ? `${prefix} · ` : ""}🔍 البرنامج بيبص على الصور ويكتب الاسم والخطوط والألوان...`);
  document.querySelector("[data-describe]")?.classList.add("busy");
  try {
    const a = await api(`/api/carousel/library/${id}/describe`, { method: "POST" });
    await openLibrary();
    libStatus(`✅ اتكتب الوصف لـ«${a.name}». راجعه وعدّل لو حابب`);
  } catch (err) {
    document.querySelector("[data-describe]")?.classList.remove("busy");
    libStatus(`${prefix ? `${prefix} · ` : ""}✕ ${err.message}. اكتب الوصف بنفسك أو جرّب تاني`, true);
  }
}
async function patchAsset(id, form, count = 0) {
  if (count) libStatus(`⏳ بيرفع ${count} صورة...`);
  try {
    const res = await api(`/api/carousel/library/${id}`, { method: "PATCH", body: form });
    await openLibrary();
    libStatus(count ? uploadedMsg(res, count) : "✅ اتحفظ");
  } catch (err) {
    libStatus(`✕ ${err.message}`, true);
  }
}
$("libItems").addEventListener("change", (e) => {
  const item = e.target.closest(".lib-item");
  if (!item) return;
  const form = new FormData();
  let count = 0;
  if (e.target.matches("[data-add]")) {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;
    files.forEach((f) => form.append("files", f));
    count = files.length;
  } else if (e.target.dataset.f) {
    form.append(e.target.dataset.f, e.target.value);
  } else return;
  patchAsset(item.dataset.id, form, count);
});
$("libItems").addEventListener("click", async (e) => {
  const card = e.target.closest(".lib-card2[data-id]");
  if (card) {
    const a = car.lib.find((x) => x.id === card.dataset.id);
    // ✏️ أو مفيش كاروسيل مفتوح: افتح التفاصيل، غير كده الدوسة بتختار
    if (e.target.closest("[data-edit]") || !car.cur) { car.libEdit = a.id; libStatus(""); return renderCarLibrary(); }
    return libPick(a);
  }
  const item = e.target.closest(".lib-item");
  if (!item) return;
  if (e.target.closest("[data-back]")) { car.libEdit = null; libStatus(""); return renderCarLibrary(); }
  if (e.target.closest("[data-pick]")) return libPick(car.lib.find((x) => x.id === item.dataset.id));
  if (e.target.closest("[data-describe]")) return describeAsset(item.dataset.id);
  const img = e.target.closest("[data-img]");
  if (img) {
    const form = new FormData();
    form.append("remove", img.dataset.img);
    return patchAsset(item.dataset.id, form);
  }
  if (e.target.closest("[data-del-asset]")) {
    if (!confirm("مسح ده من المكتبة؟")) return;
    await api(`/api/carousel/library/${item.dataset.id}`, { method: "DELETE" });
    car.libEdit = null;
    await openLibrary();
  }
});
$("carLibOpen").onclick = () => openLibrary();

$("libPack").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = "";
  if (!files.length) return;
  let added = 0, updated = 0;
  for (const [i, file] of files.entries()) {
    const form = new FormData();
    form.append("file", file);
    libStatus(`⏳ بيستورد ${file.name} (${i + 1} من ${files.length})...`);
    try {
      const r = await api("/api/carousel/library/import", { method: "POST", body: form });
      added += r.added; updated += r.updated;
    } catch (err) {
      return libStatus(`✕ ${file.name}: ${err.message}`, true);
    }
  }
  car.cfg = await api("/api/carousel/settings");
  // افتح التبويب اللي فيه حاجات عشان تبان على طول
  if (!car.lib.some((a) => a.kind === car.libTab)) car.libTab = "template";
  await openLibrary();
  libStatus(`✅ اتضاف ${added} · اتحدّث ${updated}`);
});

// ---------- النشر: كاروسيل صور على إنستجرام، أو ريل من السلايدات بموسيقى ----------
car.pubMode = "carousel";
function localInput(d) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 16);
}
async function renderPublish() {
  const c = car.cur;
  if (car.sec !== "publish") return;
  document.querySelectorAll("#carPubModes [data-mode]").forEach((b) => b.classList.toggle("active", b.dataset.mode === car.pubMode));
  const reel = car.pubMode === "reel";
  $("carPubReel").hidden = !reel;
  $("carPubSlideWrap").hidden = reel;
  $("carPubHint").textContent = reel
    ? "البرنامج هيعمل فيديو من السلايدات بالموسيقى، ويتحفظ كمان في الفيديوهات الجاهزة. التاج في الريل بيبقى على الفيديو كله."
    : "الكاروسيل بيتنشر صور بمقاس 1080×1350 على إنستجرام. تيك توك مش بيقبل كاروسيل صور من هنا، استخدم الريل.";
  // أول ما تفتح النشر للكاروسيل ده: الكابشن من النص، والتاج حساب المدرب
  if (car.pubFor !== c.id) {
    car.pubFor = c.id;
    const plan = c.plan || {};
    $("carPubCaption").value = [plan.caption, (plan.hashtags || []).join(" ")].filter(Boolean).join("\n\n");
    const coach = currentCoach();
    $("carPubTags").value = coach?.handle ? `@${coach.handle}` : "";
    $("carPubCollab").checked = !!coach?.handle; // الكاروسيل عن مدرب ليه حساب: كولاب تلقائي
    $("carPubWhen").value = localInput(new Date(Date.now() + 3600e3));
    $("carPubDone").innerHTML = "";
    $("carPubSlide").innerHTML = c.slides.map((_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  }
  if (!car.music) {
    try { car.music = await api("/api/audio?kind=music"); } catch { car.music = []; }
  }
  const keep = $("carPubMusic").value;
  $("carPubMusic").innerHTML = `<option value="">— من غير موسيقى —</option>` +
    car.music.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join("");
  if (keep) $("carPubMusic").value = keep;
  else if (car.music.length) $("carPubMusic").value = car.music[0].id;
}
$("carPubModes").addEventListener("click", (e) => {
  const b = e.target.closest("[data-mode]");
  if (b) { car.pubMode = b.dataset.mode; renderPublish(); }
});
function pubTags() {
  return $("carPubTags").value.split(/[\s,،]+/).map((t) => t.replace(/^@/, "").trim()).filter(Boolean);
}
async function publishCarousel(now) {
  const c = car.cur;
  const when = now ? new Date() : new Date($("carPubWhen").value);
  if (Number.isNaN(when.getTime())) return toast("اختار الميعاد", true);
  if (!now && when < new Date()) return toast("الميعاد ده عدّى، اختار ميعاد جاي أو دوس انشر دلوقتي", true);
  const options = { ig_tags: pubTags(), ig_collab: $("carPubCollab").checked, tag_slide: Number($("carPubSlide").value) || 1 };
  const caption = $("carPubCaption").value;
  const btns = [$("carPubNow"), $("carPubSchedule")];
  btns.forEach((b) => b.classList.add("busy"));
  try {
    let post;
    if (car.pubMode === "reel") {
      const platforms = [["instagram", "carPubIg"], ["tiktok", "carPubTt"]].filter(([, id]) => $(id).checked).map(([p]) => p);
      if (!platforms.length) return toast("اختار منصة واحدة على الأقل", true);
      $("carPubState").textContent = "🎬 بيعمل الريل...";
      const exp = await api(`/api/carousels/${c.id}/reel`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ music_id: $("carPubMusic").value || null, seconds: Number($("carPubSec").value) }) });
      $("carPubState").textContent = "📤 بيبعته للنشر...";
      post = await api("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ export_id: exp.id, caption, platforms, scheduled_at: when.toISOString(), options: { ig_tags: options.ig_tags, ig_collab: options.ig_collab } }) });
      $("carPubDone").innerHTML = `<video src="${exp.url}" controls preload="metadata"></video>`;
    } else {
      $("carPubState").textContent = "📤 بيبعت الكاروسيل...";
      post = await api(`/api/carousels/${c.id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, scheduled_at: when.toISOString(), options }) });
      $("carPubDone").innerHTML = "";
    }
    $("carPubState").textContent = "";
    $("carPubDone").insertAdjacentHTML("afterbegin", `<p class="ok">✅ ${now ? "اتبعت للنشر دلوقتي" : "اتجدول"}. تابع حالته من <a href="#" data-goto-pub>صفحة النشر</a>.</p>`);
    toast(now ? "اتبعت للنشر" : "اتجدول");
    return post;
  } catch (err) {
    $("carPubState").textContent = "";
    toast(err.message, true);
  } finally {
    btns.forEach((b) => b.classList.remove("busy"));
  }
}
$("carPubNow").onclick = () => publishCarousel(true);
$("carPubSchedule").onclick = () => publishCarousel(false);
$("carPubDone").addEventListener("click", (e) => {
  if (e.target.closest("[data-goto-pub]")) { e.preventDefault(); showStep("7"); }
});
$("carToPublish").onclick = () => { car.sec = "publish"; renderCarousel(); };
