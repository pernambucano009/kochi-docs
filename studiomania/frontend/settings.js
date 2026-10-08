// StudioMania — الإعدادات والخروج

async function loadSettings() {
  const s = await api("/api/settings");
  for (const name of ["atlas", "zernio"]) {
    const k = s.keys[name];
    $(`${name}State`).textContent = k.set ? `✓ فيه مفتاح متسجل (${k.hint})` : "✕ مفيش مفتاح لسه";
    $(`${name}State`).className = "hint " + (k.set ? "ok-text" : "");
    $(`${name}Key`).value = "";
  }
  api("/api/system").then((x) => {
    $("sysInfo").textContent = `🖥️ السيرفر: ${x.cpus ?? "?"} معالج · الذاكرة ${x.memory_limit_mb ? `${x.memory_limit_mb} ميجا (مستخدم ${x.memory_used_mb ?? "?"})` : "من غير حد معروف"}`;
  }).catch(() => {});
  loadStorage();
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

// ---------- المساحة ----------
const STORAGE_LABELS = {
  raw: "الفيديوهات الخام", clips: "القطع", generated: "فيديوهات Seedance", coaches: "المدربين",
  audio: "الصوت والموسيقى", exports: "الفيديوهات الجاهزة", tmp: "ملفات مؤقتة",
  lab: "معمل التفكيك (تقسيم الفيديوهات)", typo: "فيديوهات التايبوجرافي", refs: "📦 أرشيف المراجع", ads: "الإعلانات",
  series: "المسلسلات", films: "الأفلام", carousels: "الكاروسيل", assets: "مكتبة العناصر", tvideos: "فيديوهات التيمبليتس",
};
// الأقسام اللي ينفع تتمسح كلها مرة واحدة، واللي بيتمسح فيها بالظبط
const WIPE_INFO = {
  lab: ["🗑️ امسح كل فيديوهات التفكيك", "كل الفيديوهات اللي في معمل التفكيك هتتمسح هي وتقسيمها. الستايلات والستيكرات اللي اتحفظت في المكتبة بتفضل."],
  typo: ["🗑️ امسح كل فيديوهات التايبوجرافي", "كل مشاريع التايبوجرافي هتتمسح (الفيديوهات والصوت والتحليل). الستايلات والستيكرات والأصوات بتفضل."],
  refs: ["🗑️ امسح كل الأرشيف", "كل الملفات اللي في أرشيف المراجع هتتمسح."],
  raw: ["🗑️ امسح كل الفيديوهات الخام", "كل الفيديوهات الخام وقطعها هتتمسح، والمشاريع اللي معمولة منها مش هتلاقيها."],
  exports: ["🗑️ امسح كل الفيديوهات الجاهزة", "كل الفيديوهات الجاهزة هتتمسح، ما عدا اللي عليها بوستات متجدولة."],
};
async function loadStorage() {
  try {
    const st = await api("/api/storage");
    const used = st.total_mb - st.free_mb;
    const pct = Math.round((used / st.total_mb) * 100);
    $("storageInfo").innerHTML = `
      <div class="bar"><span style="width:${pct}%;background:${pct > 90 ? "var(--danger)" : "var(--accent)"}"></span></div>
      <p class="${pct > 90 ? "err" : "hint"}">مستخدم ${fmtMb(used)} من ${fmtMb(st.total_mb)} · فاضي ${fmtMb(st.free_mb)}</p>
      <ul>${Object.entries(st.folders).filter(([, v]) => v >= 0.1).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
        const n = (st.wipe || {})[k];
        return `<li><span>${STORAGE_LABELS[k] || k}${n ? ` <small class="muted">(${n})</small>` : ""}</span><span class="row">${n ? `<button class="btn sm danger" data-wipe="${k}" data-n="${n}">${WIPE_INFO[k][0]}</button>` : ""}<b>${fmtMb(v)}</b></span></li>`;
      }).join("")}</ul>`;
  } catch (err) {
    $("storageInfo").textContent = err.message;
  }
}
function fmtMb(mb) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} جيجا` : `${Math.round(mb)} ميجا`;
}
$("storageInfo").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-wipe]");
  if (!b) return;
  const [label, what] = WIPE_INFO[b.dataset.wipe];
  if (!confirm(`${label} (${b.dataset.n})؟\n\n${what}\n\nالمسح ده مينفعش يترجع.`)) return;
  b.disabled = true;
  try {
    const r = await api(`/api/storage/wipe/${b.dataset.wipe}`, { method: "POST" });
    toast(`✅ اتمسح ${r.deleted}${r.kept ? ` · ${r.kept} شغالين دلوقتي فضلوا` : ""} · فضي ${fmtMb(r.freed_mb)}`);
  } catch (err) {
    toast(err.message, true);
  }
  loadStorage();
});
$("cleanTmp").onclick = async () => {
  try {
    const r = await api("/api/storage/clean", { method: "POST" });
    toast(`✅ اتمسح ${fmtMb(r.freed_mb)}`);
    loadStorage();
  } catch (err) {
    toast(err.message, true);
  }
};

// ---------- سجل آخر تصدير (عشان نعرف المشكلة فين) ----------
$("showLog").onclick = async () => {
  try {
    const r = await api("/api/render-log");
    $("renderLog").textContent = r.log;
    $("renderLog").hidden = false;
    $("copyLog").hidden = false;
  } catch (err) {
    toast(err.message, true);
  }
};
$("copyLog").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("renderLog").textContent);
    toast("✅ اتنسخ، ابعته في الشات");
  } catch {
    toast("حدّد الكلام وانسخه بإيدك", true);
  }
};
