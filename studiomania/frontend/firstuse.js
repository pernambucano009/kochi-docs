// 🧭 مسار أول استخدام: من دخل بجوجل (ولم يمر بأسئلة التسجيل) تظهر له الأسئلة الأربعة مرة واحدة (البلد، اللهجة، المجال، الهدف)،
// والعقل يتملأ من بروفايل المجال. وزر «اصنع أول فيديو» في الرئيسية يسأل سؤالين فقط (ما الذي تقدمه، ومن عميلك المثالي)،
// ثم يفتح قالب موشن رخيصًا (كود وصوت فقط) مناسبًا للمجال، فالنقاط المجانية تكفيه.
const FirstUse = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const css = `
.fu-box{width:min(500px,100%);max-height:88vh;overflow:auto}
.fu-box h3{margin:0 0 4px;font-size:19px}.fu-box .fu-sub{margin:0 0 16px;font-size:13.5px;opacity:.72;line-height:1.7}
.fu-f{display:grid;gap:6px;margin:0 0 14px;font-size:13.5px}.fu-f>span{font-weight:500}
.fu-f select,.fu-f textarea{width:100%;box-sizing:border-box;padding:10px 13px;border-radius:12px;border:1.5px solid rgba(0,0,0,.12);background:var(--ui-dlg-field,#F7F7F5);color:inherit;font:inherit;font-size:14px;outline:none}
.fu-f textarea{resize:vertical;min-height:74px;line-height:1.6}
.fu-f select:focus,.fu-f textarea:focus{border-color:#E5613E}
.fu-f small{opacity:.65;font-size:12px;line-height:1.6}
.fu-err{color:#D9443A;font-size:13px;margin:-4px 0 10px}
:root[data-nh-theme="dark"] .fu-f select,:root[data-nh-theme="dark"] .fu-f textarea{border-color:rgba(255,255,255,.14)}
#nh .nh-first{margin-top:14px;display:inline-flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 26px;background:#E5613E;color:#fff;font:inherit;font-size:15px;cursor:pointer;
  box-shadow:0 10px 28px rgba(229,97,62,.35);pointer-events:auto;transition:transform .15s}
#nh .nh-first:hover{transform:translateY(-2px)}#nh .nh-first:active{transform:scale(.97)}
#nh .nh-first-note{display:block;margin-top:8px;font-size:12.5px;opacity:.7}`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);
  let state = null, asked = false;

  async function load() {
    try { state = await api("/api/onboard"); } catch { state = null; }
    return state;
  }
  // نافذة بحقول، ترجع القيم أو null إذا أُغلقت
  function form(title, sub, fields, okT, onOk) {
    return new Promise((resolve) => {
      const back = document.createElement("div");
      back.className = "ui-dlg";
      back.setAttribute("role", "dialog");
      back.setAttribute("aria-modal", "true");
      back.innerHTML = `<div class="ui-dlg-box fu-box" dir="rtl"><h3>${esc(title)}</h3><p class="fu-sub">${esc(sub)}</p>${fields}
        <p class="fu-err" hidden></p><div class="ui-dlg-acts"><button type="button" class="ui-dlg-ok">${esc(okT)}</button><button type="button" class="ui-dlg-no">لاحقًا</button></div></div>`;
      const done = (v) => { document.removeEventListener("keydown", key, true); back.remove(); resolve(v); };
      const key = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(null); } };
      const err = back.querySelector(".fu-err"), ok = back.querySelector(".ui-dlg-ok");
      ok.onclick = async () => {
        ok.disabled = true;
        try { done(await onOk(back)); } catch (e) { err.textContent = e.message; err.hidden = false; ok.disabled = false; }
      };
      back.querySelector(".ui-dlg-no").onclick = () => done(null);
      document.addEventListener("keydown", key, true);
      document.body.appendChild(back);
      setTimeout(() => back.querySelector("select,textarea")?.focus(), 40);
      form.last = back;
    });
  }
  const sel = (id, label, opts, val, hint = "") => `<label class="fu-f"><span>${esc(label)}</span><select id="${id}">${opts.map(([v, t]) => `<option value="${esc(v)}"${v === val ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>${hint ? `<small>${esc(hint)}</small>` : ""}</label>`;

  // الأسئلة الأربعة لمن لم يمر بالتسجيل (الدخول بجوجل)
  async function askBasics() {
    const s = state;
    const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop(); } catch { return ""; } })();
    const TZ = { Riyadh: "SA", Dubai: "AE", Kuwait: "KW", Qatar: "QA", Bahrain: "BH", Muscat: "OM", Cairo: "EG", Amman: "JO", Beirut: "LB", Baghdad: "IQ" };
    const c = TZ[tz] || "SA", dia = (s.regions.find((r) => r.id === c) || {}).dialect || "ar-msa";
    const p = form("أهلًا بك! أربعة أسئلة سريعة", "من إجاباتك نجهّز لك عقل العلامة وأفكارًا وخطة شهر، فلا تبدأ من الصفر.",
      sel("fuC", "بلدك", s.regions.map((r) => [r.id, r.name]), c)
      + sel("fuD", "لهجة المحتوى (الأفكار والنص والصوت)", s.dialects.map((d) => [d.id, d.name]), dia, "اخترناها حسب بلدك، ويمكنك تغييرها.")
      + sel("fuF", "مجال نشاطك", s.fields.map((f) => [f.id, f.hint ? `${f.name} (${f.hint})` : f.name]), s.fields[0].id)
      + sel("fuG", "هدفك من المحتوى", s.goals.map((g) => [g.id, g.name]), s.fields[0].goal),
      "ابدأ", async (b) => api("/api/onboard", { method: "POST", ...jsonBody({ country: b.querySelector("#fuC").value, dialect: b.querySelector("#fuD").value,
        field: b.querySelector("#fuF").value, goal: b.querySelector("#fuG").value }) }));
    const b = form.last;
    b.querySelector("#fuC").onchange = () => { b.querySelector("#fuD").value = (s.regions.find((r) => r.id === b.querySelector("#fuC").value) || {}).dialect || "ar-msa"; };
    b.querySelector("#fuF").onchange = () => { b.querySelector("#fuG").value = (s.fields.find((f) => f.id === b.querySelector("#fuF").value) || {}).goal || "sales"; };
    const r = await p;
    if (r) { state = r; (typeof NH !== "undefined" && NH?.refresh?.()); }
  }

  async function check() {
    if (asked || (typeof APP !== "undefined" && APP === "kochi")) return;
    asked = true;
    if (!(await load())?.need) return;
    askBasics();
  }

  // 🎬 أول فيديو: سؤالان فقط، ثم القالب المقترح للمجال
  async function startFirst() {
    const s = state || (await load());
    if (!s) return;
    if (s.need) { await askBasics(); if (state?.need) return; }
    const r = await form("أول فيديو لك", "سؤالان فقط، والباقي يتعلمه العقل منك مع كل مشروع.",
      `<label class="fu-f"><span>ما الذي تقدمه؟</span><textarea id="fuA" rows="3" dir="auto" placeholder="${esc(state.about_ph)}">${esc(state.about)}</textarea>
        <small>ماذا تبيع أو تقدم، وأين، وما الذي يميزك.</small></label>
       <label class="fu-f"><span>من عميلك المثالي؟</span><textarea id="fuB" rows="3" dir="auto" placeholder="${esc(state.audience_ph)}">${esc(state.audience)}</textarea>
        <small>${state.field ? "كتبنا اقتراحًا من مجالك، عدّله ليناسبك." : "العمر، والاهتمامات، وما الذي يبحث عنه."}</small></label>`,
      "اصنع الفيديو", async (b) => api("/api/onboard/first", { method: "POST", ...jsonBody({ about: b.querySelector("#fuA").value, audience: b.querySelector("#fuB").value }) }));
    if (!r) return;
    state = r;
    (typeof NH !== "undefined" && NH?.refresh?.());
    if (!(typeof Gallery !== "undefined" && Gallery.start?.(r.first))) toast("افتح «ابدأ مشروعًا جديدًا» واختر قالبًا", true);
  }

  document.addEventListener("click", (e) => { if (e.target.closest?.("[data-first]")) { e.preventDefault(); e.stopPropagation(); startFirst(); } }, true);
  return { check, startFirst, state: () => state };
})();
