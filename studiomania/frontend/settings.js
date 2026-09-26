// StudioMania — الإعدادات والخروج

async function loadSettings() {
  const s = await api("/api/settings");
  for (const name of ["atlas", "zernio"]) {
    const k = s.keys[name];
    $(`${name}State`).textContent = k.set ? `✓ فيه مفتاح متسجل (${k.hint})` : "✕ مفيش مفتاح لسه";
    $(`${name}State`).className = "hint " + (k.set ? "ok-text" : "");
    $(`${name}Key`).value = "";
  }
  $("pwForm").hidden = s.password_from_env;
  $("pwEnvNote").hidden = !s.password_from_env;
}

$("keysForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = {};
  for (const name of ["atlas", "zernio"]) {
    const v = $(`${name}Key`).value.trim();
    if (v) body[name] = v;
  }
  if (!Object.keys(body).length) return toast("الصق مفتاح الأول");
  try {
    await api("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    toast("✅ المفاتيح اتحفظت");
    gen.atlas = null; // صفحة التوليد تعيد قراءة حالة المفتاح
    await loadSettings();
  } catch (err) {
    toast(err.message, true);
  }
});

$("pwForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current: $("pwCurrent").value, new: $("pwNew").value }),
    });
    $("pwForm").reset();
    toast("✅ الباسورد اتغيّر");
  } catch (err) {
    toast(err.message, true);
  }
});

$("openSettings").onclick = () => showStep("settings");
$("logout").onclick = async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  location.href = "/login";
};

viewHooks["settings"] = loadSettings;
