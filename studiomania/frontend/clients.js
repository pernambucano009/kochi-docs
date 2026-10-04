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
  document.querySelectorAll("[data-client-name]").forEach((el) => (el.textContent = c ? `«${c.name}»` : ""));
  renderClientList();
}

function renderClientList() {
  $("clientList").innerHTML = clientx.list.map((c) => `<button type="button" class="client-card ${c.active ? "on" : ""}" data-client="${c.id}">
      <i class="client-av">${c.logo ? `<img src="${c.logo}" alt="">` : escapeHtml(c.name.trim().slice(0, 1).toUpperCase())}</i>
      <span><b data-no-i18n>${escapeHtml(c.name)}</b>${c.domain ? `<small class="muted" data-no-i18n>${escapeHtml(c.domain)}</small>` : ""}</span>
      ${c.active ? `<small class="client-now">✓ شغال عليه</small>` : ""}</button>`).join("");
}

async function switchClient(id) {
  if (id === clientx.active) return $("clientDialog").close();
  try {
    await api("/api/clients/active", { method: "PUT", ...jsonBody({ id }) });
    location.reload();  // كل صفحة بتتحمّل من جديد بحاجات العميل ده
  } catch (err) { toast(err.message, true); }
}

function openClientProfile(id) {
  $("clientDialog").open && $("clientDialog").close();
  adx.wantBrain = id || clientx.active;
  if (shell.step === "10") initAds(); else showStep("10");
}

$("clientBtn").onclick = $("stageClient").onclick = () => { renderClientList(); $("clientDialog").showModal(); };
$("clientClose").onclick = () => $("clientDialog").close();
$("clientList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-client]");
  if (b) switchClient(b.dataset.client);
});
$("clientEdit").onclick = () => openClientProfile();
$("clientNew").onclick = async () => {
  const name = prompt("اسم العميل الجديد؟");
  if (!name?.trim()) return;
  try {
    const b = await api("/api/ad-brains", { method: "POST", ...jsonBody({ name, fields: {} }) });
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
