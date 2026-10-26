// 👤 العملاء: البرنامج كله بيشتغل على العميل المختار (هويته وأصوله وإعلاناته وكاروسيلاته ومسلسلاته)
const clientx = { list: [], active: null, cur: null };

async function loadClients() {
  try {
    const r = await api("/api/clients");
    clientx.list = r.clients;
    clientx.active = r.active;
    clientx.cur = r.clients.find((c) => c.id === r.active) || null;
  } catch { return; }
  const c = clientx.cur;
  $("clientName").textContent = c?.name || "العميل";
  const av = c?.logo ? `<img src="${c.logo}" alt="">` : escapeHtml((c?.name || "👤").trim().slice(0, 1).toUpperCase());
  $("clientAv").innerHTML = $("stageClientAv").innerHTML = av;
  $("stageClientName").textContent = c?.name || "";
  const nh = document.getElementById("nhClientName");   // شريط الرئيسية: الاسم يتحدّث على طول (مثلًا بعد ما العقل يستنبطه من الحساب)
  if (nh && c?.name) nh.textContent = c.name;
  document.querySelectorAll("[data-client-name]").forEach((el) => (el.textContent = c ? `«${c.name}»` : ""));
  renderClientList();
}

function renderClientList() {
  const many = clientx.list.length > 1;
  $("clientList").innerHTML = clientx.list.map((c) => `<div class="client-row"><button type="button" class="client-card ${c.active ? "on" : ""}" data-client="${c.id}">
      <i class="client-av">${c.logo ? `<img src="${c.logo}" alt="">` : escapeHtml(c.name.trim().slice(0, 1).toUpperCase())}</i>
      <span><b data-no-i18n>${escapeHtml(c.name)}</b>${c.domain ? `<small class="muted" data-no-i18n>${escapeHtml(c.domain)}</small>` : ""}</span>
      ${c.active ? `<small class="client-now">✓ قيد العمل</small>` : ""}</button>
      ${many ? `<button type="button" class="client-del" data-cdel="${c.id}" title="احذف هذا العميل" aria-label="احذف هذا العميل">🗑</button>` : ""}</div>`).join("");
}

async function switchClient(id) {
  if (id === clientx.active) return $("clientDialog").close();
  try {
    await api("/api/clients/active", { method: "PUT", ...jsonBody({ id }) });
    location.reload();  // كل صفحة تُحمّل من جديد بحاجات هذا العميل
  } catch (err) { toast(err.message, true); }
}

function openClientProfile(id) {
  $("clientDialog").open && $("clientDialog").close();
  if (typeof NH !== "undefined" && NH) return NH.openBrand(id);
  adx.wantBrain = id || clientx.active;
  if (shell.step === "10") initAds(); else showStep("10");
}

$("clientBtn").onclick = $("stageClient").onclick = () => { renderClientList(); $("clientDialog").showModal(); };
$("clientClose").onclick = () => $("clientDialog").close();
$("clientList").addEventListener("click", async (e) => {
  const del = e.target.closest("[data-cdel]");
  if (del) {
    const c = clientx.list.find((x) => x.id === del.dataset.cdel);
    if (!c || !(await uiConfirm(`احذف «${c.name}» بكل عقله وصوره وملفاته؟ لا يمكن التراجع عن الحذف.`))) return;
    try {
      await api(`/api/ad-brains/${encodeURIComponent(c.id)}`, { method: "DELETE" });
      if (c.id === clientx.active) return location.reload();   // كان العميل المختار: البرنامج يرجع للي بعده
      await loadClients();
      toast("🗑 حُذف العميل");
    } catch (err) { toast(err.message, true); }
    return;
  }
  const b = e.target.closest("[data-client]");
  if (b) switchClient(b.dataset.client);
});
$("clientEdit").onclick = () => openClientProfile();
// عميل جديد: عقل جديد فاضي، وأول خطوة في العقل بتسأل اسمه أو رابط حسابه (والعقل يستنبط منه الباقي)
$("clientNew").onclick = async () => {
  try {
    const b = await api("/api/ad-brains", { method: "POST", ...jsonBody({ name: "", fields: {} }) });
    await api("/api/clients/active", { method: "PUT", ...jsonBody({ id: b.id }) });
    storageSet("studiomania.openClient", b.id);
    location.reload();
  } catch (err) { toast(err.message, true); }
};

loadClients().then(() => {
  // عميل جديد: بعد التحميل يفتح ملفه عشان تكمّل بياناته
  const want = storageGet("studiomania.openClient");
  if (want) { storageSet("studiomania.openClient", ""); openClientProfile(want); }
});
