// 🎯 «العملاء المستهدفون»: ناس مهتمون بموضوع، من التعليقات على أكثر المنشورات انتشارًا فيه، مرتّبين حسب اهتمامهم.
// البحث بزرار عليه تكلفته، والقائمة فيها: افتح الحساب، افتح محادثة، «تواصلت معه»، ملاحظة، وتنزيل ملف.
const LeadsPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, d: null, topic: "", plats: ["instagram", "tiktok"], f: "all", q: "", poll: null, busy: false };
  const html = () => `<div class="nb-wrap fs-wrap rv-wrap" id="ldWrap"><div class="nh-empty">جارٍ التحميل…</div></div>`;
  const PL = { instagram: "إنستغرام", tiktok: "تيك توك" };
  const heat = (n) => (n >= 80 ? ["ساخن", "hot"] : n >= 50 ? ["مهتم", "warm"] : ["بارد", "cold"]);

  function list() {
    const q = S.q.trim().toLowerCase();
    return (S.d.items || []).filter((x) => (S.f === "hot" ? x.score >= 80 : S.f === "warm" ? x.score >= 50 : S.f === "new" ? !x.contacted : true)
      && (!q || [x.handle, x.name, x.comment, x.topic, x.note].some((v) => String(v || "").toLowerCase().includes(q))));
  }
  function row(x) {
    const [ht, hc] = heat(x.score);
    return `<div class="ld-r${x.contacted ? " done" : ""}" data-lid="${esc(x.id)}">
      <span class="ld-sc ${hc}"><b class="num">${x.score}</b><small>${ht}</small></span>
      <span class="ld-who"><b dir="ltr" data-no-i18n>@${esc(x.handle)}</b>${x.name ? `<small data-no-i18n>${esc(x.name)}</small>` : ""}<small>${PL[x.platform] || esc(x.platform)}</small></span>
      <span class="ld-say"><q data-no-i18n>${esc(x.comment || "")}</q>${x.why ? `<small data-no-i18n>${esc(x.why)}</small>` : ""}
        <small>عن «<span data-no-i18n>${esc(x.topic || "")}</span>»${x.post_by ? ` · على منشور <span dir="ltr" data-no-i18n>@${esc(x.post_by)}</span>` : ""}</small>
        <input class="ld-note" data-ldnote value="${esc(x.note || "")}" placeholder="ملاحظة…"></span>
      <span class="pk-acts">
        <a class="pk-ib sm" href="${esc(x.profile)}" target="_blank" rel="noopener" data-tip="افتح الحساب" aria-label="افتح الحساب">${pkIc("eye")}</a>
        <a class="pk-ib sm" href="${esc(x.dm)}" target="_blank" rel="noopener" data-tip="افتح محادثة" aria-label="افتح محادثة">${pkIc("chat")}</a>
        ${pkIb(x.contacted ? "check" : "plus", x.contacted ? "تواصلت معه (اضغط للإلغاء)" : "علّمه: تواصلت معه", `data-ldok="${x.contacted ? 0 : 1}"`, `sm${x.contacted ? " on" : ""}`)}
        ${pkIb("trash", "احذفه من القائمة", "data-lddel", "sm")}</span></div>`;
  }
  function render() {
    const d = S.d, busy = d.status === "working", items = list(), all = d.items || [];
    const hot = all.filter((x) => x.score >= 80).length, warm = all.filter((x) => x.score >= 50).length, fresh = all.filter((x) => !x.contacted).length;
    const both = S.plats.length > 1, cost = both ? d.cost.both : d.cost.one;
    S.el.innerHTML = `<div class="pk-top"><div class="pk-sub"><span><b class="num">${all.length}</b> شخصًا في القائمة</span><span><b class="num">${hot}</b> ساخن</span>
        ${d.live ? "" : `<span>وضع تجريبي: أسماء تجريبية</span>`}${busy ? `<span class="pk-busy">⏳ ${esc(d.step || "جارٍ البحث…")}</span>` : d.error ? `<span class="pk-err">⚠️ ${esc(d.error)}</span>` : ""}</div>
        <div class="pk-acts"><a class="pk-ib" href="/api/leads.csv${S.f === "hot" ? "?min_score=80" : S.f === "warm" ? "?min_score=50" : ""}" download="leads.csv" data-tip="نزّل القائمة (ملف Excel)" aria-label="نزّل القائمة (ملف Excel)">${pkIc("download")}</a></div></div>
      <div class="ld-find">
        <p class="pk-note">اكتب موضوعًا أو كلمة أو هاشتاج، فيبحث البرنامج عن أكثر المنشورات انتشارًا فيه، ويجمع من علّقوا عليها، ويقيّم الذكاء الاصطناعي اهتمام كل واحد: من يسأل عن السعر أو المكان أو يريد الشراء يأتي أولًا.</p>
        <div class="ld-row"><input class="ld-in" data-ldtopic value="${esc(S.topic)}" placeholder="مثلًا: قهوة مختصة في الرياض، أو #دايت">
          <span class="pk-chips">${[["instagram", "إنستغرام"], ["tiktok", "تيك توك"]].map(([k, t]) => `<button class="pk-chip${S.plats.includes(k) ? " on" : ""}" data-ldplat="${k}">${t}</button>`).join("")}</span>
          <button class="nb-btn fs-go" data-ldgo ${busy || S.busy ? "disabled" : ""}>${busy ? "جارٍ البحث…" : `ابحث (${cost} نقطة)`}</button></div>
        ${(d.suggest || []).length ? `<div class="pk-chips ld-sug"><span class="pk-lbl">من عقل العلامة:</span>${d.suggest.map((x) => `<button class="pk-chip" data-ldsug="${esc(x)}" data-no-i18n>${esc(x)}</button>`).join("")}</div>` : ""}
      </div>
      <p class="pk-note ld-warn">💬 الرسالة الأولى تُرسل من حسابك بنفسك (زر «افتح محادثة» أو الملف)، لأن إنستغرام وتيك توك لا يسمحان في الربط الرسمي ببدء محادثة مع من لم يراسلك. وعندما يرد عليك أحدهم، يتابع معه بوت الرسائل تلقائيًا.</p>
      ${all.length ? `<div class="pk-top"><span class="pk-chips">${[["all", "الكل", all.length], ["hot", "ساخن (٨٠ فأكثر)", hot], ["warm", "مهتم (٥٠ فأكثر)", warm], ["new", "لم أتواصل معه", fresh]]
        .map(([k, t, n]) => `<button class="pk-chip${S.f === k ? " on" : ""}" data-ldf="${k}">${t}<span class="num">${n}</span></button>`).join("")}</span>
        <input class="ld-in ld-q" data-ldq value="${esc(S.q)}" placeholder="ابحث في القائمة…"></div>
        <div class="ld-rows">${items.map(row).join("") || `<div class="pk-empty">لا يوجد أحد بهذا المرشّح</div>`}</div>`
        : `<div class="pk-empty">${busy ? "جارٍ البحث عن المهتمين…" : "القائمة فارغة. ابحث عن موضوع لتبدأ."}</div>`}`;
    if (busy) watch(); else clearInterval(S.poll);
  }
  function watch() {
    clearInterval(S.poll);
    S.poll = setInterval(async () => {
      if (!S.el?.isConnected) return clearInterval(S.poll);
      try { S.d = await api("/api/leads"); if (S.d.status !== "working") { clearInterval(S.poll); morphing(render); if (!S.d.error) toast(`✓ انتهى البحث: ${S.d.runs.at(-1)?.new ?? 0} شخصًا جديدًا`); } else morphing(render); } catch { clearInterval(S.poll); }
    }, 3000);
  }
  async function act(fn) {
    try { S.d = await fn(); render(); } catch (err) { toast(err.message, true); }
  }
  function bind(w) {
    w.addEventListener("input", (e) => {
      if (e.target.matches("[data-ldtopic]")) S.topic = e.target.value;
      if (e.target.matches("[data-ldq]")) { S.q = e.target.value; const pos = e.target.selectionStart; render(); const el = S.el.querySelector("[data-ldq]"); el.focus(); el.setSelectionRange(pos, pos); }
    });
    w.addEventListener("change", (e) => {
      const n = e.target.closest("[data-ldnote]");
      if (n) { const id = n.closest("[data-lid]").dataset.lid; api(`/api/leads/${id}`, { method: "PATCH", ...jsonBody({ note: n.value }) }).then((d) => { S.d = d; toast("✓ حُفظت الملاحظة"); }).catch((err) => toast(err.message, true)); }
    });
    w.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("[data-ldtopic]")) { e.preventDefault(); w.querySelector("[data-ldgo]")?.click(); } });
    w.addEventListener("click", async (e) => {
      const q = (s) => e.target.closest(s);
      if (q("[data-ldplat]")) {
        const k = q("[data-ldplat]").dataset.ldplat;
        S.plats = S.plats.includes(k) ? (S.plats.length > 1 ? S.plats.filter((x) => x !== k) : S.plats) : [...S.plats, k];
        return render();
      }
      if (q("[data-ldsug]")) { S.topic = q("[data-ldsug]").dataset.ldsug; return render(); }
      if (q("[data-ldf]")) { S.f = q("[data-ldf]").dataset.ldf; return render(); }
      if (q("[data-ldgo]")) {
        if (!S.topic.trim()) return toast("اكتب الموضوع أو الكلمة أولًا", true);
        S.busy = true; render();
        await act(() => api("/api/leads/find", { method: "POST", ...jsonBody({ topic: S.topic, platforms: S.plats }) }));
        S.busy = false; return render();
      }
      const id = q("[data-lid]")?.dataset.lid;
      if (id && q("[data-ldok]")) return act(() => api(`/api/leads/${id}`, { method: "PATCH", ...jsonBody({ contacted: q("[data-ldok]").dataset.ldok === "1" }) }));
      if (id && q("[data-lddel]")) { if (await uiConfirm("هل تحذف هذا الشخص من القائمة؟")) act(() => api(`/api/leads/${id}`, { method: "DELETE" })); }
    });
  }
  async function mount(root) {
    const w = root.querySelector("#ldWrap");
    if (!w) return;
    S.el = w;
    bind(w);
    try { S.d = await api("/api/leads"); if (!S.topic && S.d.suggest?.[0]) S.topic = S.d.suggest[0]; render(); }
    catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  return { html, mount, close: () => clearInterval(S.poll) };
})();
