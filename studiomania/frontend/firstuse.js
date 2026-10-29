// 🧭 مسار أول استخدام: من دخل بجوجل (ولم يمر بأسئلة التسجيل) تظهر له الأسئلة الأربعة مرة واحدة (البلد، اللهجة، المجال، الهدف)،
// والعقل يتملأ من بروفايل المجال. بعدها شعار العلامة (اختياري): الأصلي جنب النسخة بلا خلفية والعميل يختار،
// وألوانه تروح لفرع «الشكل» والأوترو يتعمل منه. وزر «اصنع أول فيديو»: قوالب المجال بأغلفتها ← سؤالان ← الفيديو يتعمل لوحده
// بخطوات ظاهرة (النص، الصوت، الرسم، اللوجو والأوترو)، وأول فيديو على حسابنا.
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
#nh .nh-first-note{display:block;margin-top:8px;font-size:12.5px;opacity:.7}
.fu-wide{width:min(640px,100%)}
.fu-drop{display:grid;place-items:center;gap:6px;min-height:150px;border:1.5px dashed rgba(229,97,62,.5);border-radius:18px;cursor:pointer;text-align:center;padding:18px;font-size:14px;transition:background .2s,border-color .2s}
.fu-drop:hover,.fu-drop.on{background:rgba(229,97,62,.06);border-color:#E5613E}.fu-drop small{opacity:.65;font-size:12px}
.fu-pick{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:4px 0 14px}
.fu-opt{border:2px solid transparent;border-radius:18px;padding:10px;background:var(--ui-dlg-field,#F7F7F5);cursor:pointer;font:inherit;color:inherit;display:grid;gap:8px;text-align:center;transition:border-color .2s,transform .2s}
.fu-opt:hover{transform:translateY(-2px)}.fu-opt.on{border-color:#E5613E}
.fu-opt i{display:grid;place-items:center;height:150px;border-radius:12px;font-style:normal;background:#fff}
.fu-opt i.chk{background:repeating-conic-gradient(#e9e9e9 0 25%,#fff 0 50%) 0 0/18px 18px}
.fu-opt img{max-width:88%;max-height:130px;object-fit:contain}
.fu-tpls{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin:0 0 14px}.fu-tpls .fu-tpl{flex:0 1 calc((100% - 48px) / 5);min-width:96px}
.fu-tpl{border:2px solid transparent;border-radius:16px;overflow:hidden;padding:0;background:var(--ui-dlg-field,#F7F7F5);cursor:pointer;font:inherit;color:inherit;text-align:start;transition:border-color .2s,transform .2s}
.fu-tpl:hover{transform:translateY(-2px)}.fu-tpl.on{border-color:#E5613E}
.fu-tpl img,.fu-tpl video{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;background:#ddd;pointer-events:none}
.fu-tpl b{display:block;padding:8px 10px 2px;font-size:13.5px;font-weight:500}.fu-tpl small{display:block;padding:0 10px 9px;font-size:11.5px;color:#E5613E}
.fu-steps{list-style:none;margin:6px 0 16px;padding:0;display:grid;gap:10px}
.fu-steps li{display:flex;align-items:center;gap:12px;font-size:14.5px;opacity:.45;transition:opacity .3s}
.fu-steps li.on,.fu-steps li.ok{opacity:1}
.fu-steps li span{flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:14px;background:rgba(127,127,127,.15)}
.fu-steps li.ok span{background:#E5613E;color:#fff}
.fu-steps li.on span{border:2px solid #E5613E;border-top-color:transparent;background:none;animation:fuSpin .8s linear infinite}
.fu-steps li em{font-style:normal;font-size:12.5px;opacity:.7;margin-inline-start:auto}
@keyframes fuSpin{to{transform:rotate(360deg)}}
.fu-vid{display:block;width:auto;max-width:100%;height:min(50vh,460px);margin:0 auto 14px;border-radius:16px;background:#000;aspect-ratio:9/16}
.fu-cols{display:flex;gap:6px;justify-content:center;margin:-4px 0 12px}.fu-cols i{width:22px;height:22px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}
.fu-idea{margin:0 0 16px;padding:14px 16px;border-radius:16px;background:rgba(229,97,62,.08);font-size:14.5px;line-height:1.8}
.fu-idea b{display:block;font-size:12.5px;color:#E5613E;margin-bottom:4px}
.fu-f input{width:100%;box-sizing:border-box;padding:10px 13px;border-radius:12px;border:1.5px solid rgba(0,0,0,.12);background:var(--ui-dlg-field,#F7F7F5);color:inherit;font:inherit;font-size:14px;outline:0}
.fu-f input:focus{border-color:#E5613E}:root[data-nh-theme="dark"] .fu-f input{border-color:rgba(255,255,255,.14)}
.fu-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.fu-photo{display:flex;align-items:center;gap:12px;padding:10px;border:1.5px dashed rgba(229,97,62,.5);border-radius:14px;cursor:pointer}
.fu-photo img{width:56px;height:56px;object-fit:contain;border-radius:10px;background:repeating-conic-gradient(#e9e9e9 0 25%,#fff 0 50%) 0 0/12px 12px}
.fu-chips{display:flex;flex-wrap:wrap;gap:8px}.fu-chips label{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;background:var(--ui-dlg-field,#F7F7F5);cursor:pointer;font-size:13.5px}
.fu-chips input{width:auto}
.fu-qa{display:grid;gap:4px;margin:0 0 12px;padding:10px 14px;border-radius:14px;background:rgba(46,160,90,.1);font-size:13px;line-height:1.7}
.fu-qa.warn{background:rgba(229,97,62,.1)}.fu-qa b{font-size:13.5px}
@media (prefers-reduced-motion:reduce){.fu-steps li.on span{animation:none}}`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);
  let state = null, asked = false;

  const refresh = () => { if (typeof NH !== "undefined") NH?.refresh?.(); };
  async function load() {
    try { state = await api("/api/onboard"); } catch { state = null; }
    if (state?.job?.status === "done" && typeof refreshMe === "function") refreshMe();   // هدية أول فيديو بتظهر في الرصيد على طول
    refresh();
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
    const p = form("أهلًا بك! أسئلة سريعة", "من إجاباتك نجهّز لك عقل العلامة وأفكارًا وخطة شهر، فلا تبدأ من الصفر.",
      sel("fuC", "بلدك", s.regions.map((r) => [r.id, r.name]), c)
      + sel("fuD", "لهجة المحتوى (الأفكار والنص والصوت)", s.dialects.map((d) => [d.id, d.name]), dia, "اخترناها حسب بلدك، ويمكنك تغييرها.")
      + sel("fuF", "مجال نشاطك", s.fields.map((f) => [f.id, f.hint ? `${f.name} (${f.hint})` : f.name]), s.fields[0].id)
      + sel("fuG", "هدفك من المحتوى", s.goals.map((g) => [g.id, g.name]), s.fields[0].goal)
      + sel("fuS", "أنت", [["m", "ذكر"], ["f", "أنثى"]], "m", "لكي تخاطبك المساعدة بشكل صحيح.")
      + `<label class="fu-f"><span>كود خصم (اختياري)</span><input id="fuK" dir="ltr" autocomplete="off" placeholder="WELCOME50"></label>`,
      "ابدأ", async (b) => {
        // 🎟️ الكوبون الأول: لو الكود غلط بتظهر الرسالة ومابيكملش (يقدر يمسحه ويكمّل)
        const k = b.querySelector("#fuK").value.trim();
        if (k && !b.dataset.kOk) {
          const r = await api("/api/billing/coupon", { method: "POST", ...jsonBody({ code: k }) });
          b.dataset.kOk = "1";
          toast(r.points ? `🎁 أُضيفت ${r.points} نقطة إلى رصيدك` : r.once ? `🎟️ خصم ${r.pct}٪ على دفعتك القادمة` : `🎟️ خصم ${r.pct}٪ على الاشتراك والشحن`);
        }
        return api("/api/onboard", { method: "POST", ...jsonBody({ country: b.querySelector("#fuC").value, dialect: b.querySelector("#fuD").value,
          field: b.querySelector("#fuF").value, goal: b.querySelector("#fuG").value, gender: b.querySelector("#fuS").value }) });
      });
    const b = form.last;
    b.querySelector("#fuC").onchange = () => { b.querySelector("#fuD").value = (s.regions.find((r) => r.id === b.querySelector("#fuC").value) || {}).dialect || "ar-msa"; };
    b.querySelector("#fuF").onchange = () => { b.querySelector("#fuG").value = (s.fields.find((f) => f.id === b.querySelector("#fuF").value) || {}).goal || "sales"; };
    const r = await p;
    if (r) { state = r; (typeof NH !== "undefined" && NH?.refresh?.()); }
  }

  // يفتح صفحة العقل ويستنى دايرة «؟» تظهر (لو ماظهرتش، المساعدة بتفتح في نص الشاشة عادي)
  async function openBrain() {
    const q = () => document.querySelector('.bm [data-n="quiz"]');
    if (!q()) document.querySelector('.nh-tile[data-id="brand"]')?.click();
    for (let i = 0; i < 40 && !q(); i++) await new Promise((r) => setTimeout(r, 150));
    await new Promise((r) => setTimeout(r, 700));   // الخريطة تستقر قبل ما الكرة تطلع من الدايرة
    return q() || null;
  }

  // 🎬 أول دخول بعد التسجيل: انتقال هادي بدل ما الصفحات «تجري». ستارة ناعمة ← العقل بيظهر من الضباب ← نقاطه واحدة ورا التانية ←
  // جملتين قصيرتين ← دايرة المساعدة بتنوّر وتنبض ← وبعدها الكرة تكبر منها على مهلها. أي ضغطة على الشاشة بتختصر الانتظار.
  const CINE = `
.fu-veil{position:fixed;inset:0;z-index:85;background:var(--nh-bg,#F4F2EE);opacity:0;transition:opacity .7s ease;pointer-events:none}
.fu-veil.on{opacity:1;pointer-events:auto}.fu-veil.out{opacity:0;transition:opacity 1.6s cubic-bezier(.4,0,.2,1)}
:root[data-nh-theme="dark"] .fu-veil{background:var(--nh-bg,#141314)}
body.fu-cine #nh .bm-world>*{animation:fuFog 2s cubic-bezier(.2,.8,.2,1) both}
body.fu-cine #nh .bm-lines{animation-delay:1.1s!important;animation-duration:1.6s!important}
body.fu-cine #nh .bm-n{animation:fuIn .9s ease both;animation-delay:calc(.8s + var(--fu-i,0) * 110ms)}
body.fu-cine #nh .bm-n>*{animation:fuPop 1s cubic-bezier(.2,1.2,.3,1) both;animation-delay:calc(.8s + var(--fu-i,0) * 110ms)}
body.fu-cine #nh .bm-center .bm-brain{animation:fuBrain 2.2s cubic-bezier(.2,.9,.2,1) both}
@keyframes fuFog{from{opacity:0;filter:blur(16px)}}@keyframes fuIn{from{opacity:0}}@keyframes fuPop{from{transform:scale(.55)}}
@keyframes fuBrain{0%{transform:scale(.82);filter:blur(10px);opacity:0}60%{transform:scale(1.04);filter:none;opacity:1}100%{transform:none}}
.fu-cap{position:fixed;inset-inline:0;bottom:22px;z-index:84;display:grid;place-items:center;pointer-events:none;text-align:center;padding:0 16px}
.fu-cap>div{display:grid;gap:4px;padding:14px 26px;border-radius:22px;background:color-mix(in srgb,var(--nh-bg,#F4F2EE) 78%,transparent);
  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 14px 40px -18px rgba(0,0,0,.25);opacity:0;transition:opacity .9s ease}
.fu-cap.on>div{opacity:1}.fu-cap.out>div{opacity:0;transition-duration:.8s}
body.fu-cine #nh .bm-hint,body.fu-cine .hp-fab,body.fu-cine .hp-tease{opacity:0!important;pointer-events:none!important;transition:opacity .6s}
.fu-cap p{margin:0;font-size:clamp(17px,2.1vw,23px);line-height:1.6;color:var(--nh-ink,#181718);opacity:0;transform:translateY(10px);filter:blur(4px);
  transition:opacity 1.1s ease,transform 1.1s cubic-bezier(.2,.8,.2,1),filter 1.1s ease}
.fu-cap p.on{opacity:.92;transform:none;filter:none}.fu-cap p.sub{font-size:clamp(14px,1.5vw,16px)}.fu-cap p.sub.on{opacity:.62}
.fu-cap.out p{opacity:0;transform:translateY(-6px);transition-duration:.8s}
#nh .bm-quiz.fu-call>i{animation:fuGlow 1.8s ease-in-out 2;position:relative}
#nh .bm-quiz.fu-call>i::after{content:"";position:absolute;inset:-2px;border-radius:50%;border:2px solid #E5613E;animation:fuRing 1.8s ease-out 2;pointer-events:none}
@keyframes fuGlow{0%,100%{box-shadow:0 0 0 0 rgba(229,97,62,0)}50%{box-shadow:0 0 34px 8px rgba(229,97,62,.45)}}
@keyframes fuRing{from{transform:scale(1);opacity:.9}to{transform:scale(2.3);opacity:0}}
@media (prefers-reduced-motion:reduce){body.fu-cine #nh .bm-world>*,body.fu-cine #nh .bm-n,body.fu-cine #nh .bm-n>*,body.fu-cine #nh .bm-center .bm-brain,#nh .bm-quiz.fu-call>i,#nh .bm-quiz.fu-call>i::after{animation:none}}`;
  async function ceremony() {
    if (!document.getElementById("fu-cine-css")) { const st = document.createElement("style"); st.id = "fu-cine-css"; st.textContent = CINE; document.head.appendChild(st); }
    let skip = false, wake = null;
    const wait = (ms) => new Promise((r) => { if (skip) return r(); const t = setTimeout(r, ms); wake = () => { clearTimeout(t); r(); }; });
    const hurry = () => { skip = true; wake?.(); };
    const veil = document.createElement("div"); veil.className = "fu-veil"; document.body.appendChild(veil);
    requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.add("on")));
    await wait(750);
    const el = await openBrain();
    // النقاط بالترتيب: المخ الأول، وبعده الأقرب فالأبعد (ترتيبها في الصفحة)
    document.querySelectorAll("#nh .bm .bm-n").forEach((n, i) => n.style.setProperty("--fu-i", String(i)));
    document.body.classList.add("fu-cine");
    veil.classList.add("out"); veil.classList.remove("on");
    setTimeout(() => veil.remove(), 1800);
    const agent = (el?.querySelector("b")?.textContent || "").trim();
    const cap = document.createElement("div"); cap.className = "fu-cap"; cap.dir = "rtl";
    cap.innerHTML = `<div><p>${esc(I18N.t("هذا عقل علامتك، وهو فارغ الآن"))}</p><p class="sub">${esc(agent && agent !== "أكمل العقل" ? I18N.t(`ستملؤه معك ${agent} في محادثة قصيرة`) : I18N.t("سنملؤه معًا في محادثة قصيرة"))}</p></div>`;
    document.body.appendChild(cap);
    addEventListener("pointerdown", hurry, { once: true });
    const ln = cap.querySelectorAll("p");
    await wait(1400); cap.classList.add("on"); ln[0].classList.add("on");
    await wait(1900); ln[1].classList.add("on");
    await wait(2100);
    el?.classList.add("fu-call");   // دايرة المساعدة بتنوّر مرتين قبل ما الكرة تطلع منها
    await wait(2300);
    cap.classList.add("out"); setTimeout(() => cap.remove(), 900);
    await wait(500);
    removeEventListener("pointerdown", hurry);
    setTimeout(() => { el?.classList.remove("fu-call"); document.body.classList.remove("fu-cine"); }, 4000);
    return el;
  }

  async function check() {
    if (asked || (typeof APP !== "undefined" && APP === "kochi")) return;
    asked = true;
    const s = await load();
    if (!s) return;
    if (s.need) await askBasics();
    // 🎙️ المساعد الصوتي (بعد ما اللهجة تبقى معروفة): بيملا العقل بالكلام بدل الأسئلة المكتوبة
    // 🧠 المساعدة بتفتح جوه صفحة العقل (من دايرة «؟»)، عشان العميل يشوف العقل بيتبني وهو بيتكلم
    let talked = false;
    if (typeof Assistant !== "undefined" && (await Assistant.can())) talked = await Assistant.maybe(false, await ceremony());
    // المساعدة بتطلب الشعار بنفسها: شاشة الشعار المنفصلة بس لو المساعدة ماطلعتش
    // (لو المساعدة موجودة في البرنامج، هي اللي بتطلبه في المكالمة، حتى لو المكالمة ماطلعتش دلوقتي بعد ريلود)
    if (!talked && typeof Assistant === "undefined" && state && !state.need && !state.logo && !state.logo_asked) await askLogo();
    if (state?.job?.status === "run") watch(false);
  }

  // 🖼️ شعار العلامة (اختياري): الأصلي جنب النسخة من غير خلفية، والعميل يختار
  function dialog(html, wide = true) {
    const back = document.createElement("div");
    back.className = "ui-dlg";
    back.setAttribute("role", "dialog");
    back.setAttribute("aria-modal", "true");
    back.innerHTML = `<div class="ui-dlg-box fu-box${wide ? " fu-wide" : ""}" dir="rtl">${html}</div>`;
    document.body.appendChild(back);
    return back;
  }
  function askLogo() {
    return new Promise((resolve) => {
      const b = dialog(`<h3>أضف شعار علامتك</h3><p class="fu-sub">اختياري. نضعه في ركن فيديوهاتك، ونصنع منه نهاية الفيديو، ونأخذ منه ألوان علامتك.</p>
        <label class="fu-drop" tabindex="0"><input type="file" accept="image/png,image/jpeg,image/webp" hidden><b>📤 اختر صورة الشعار أو اسحبها هنا</b><small>PNG أو JPG، ونزيل الخلفية لك</small></label>
        <div class="fu-res" hidden></div><p class="fu-err" hidden></p>
        <div class="ui-dlg-acts"><button type="button" class="ui-dlg-ok" hidden>اعتمد الشعار</button><button type="button" class="ui-dlg-no">لاحقًا</button></div>`);
      const q = (x) => b.querySelector(x), err = q(".fu-err"), ok = q(".ui-dlg-ok"), drop = q(".fu-drop"), inp = q("input");
      let pick = "cut";
      const done = async (choice) => {
        ok.disabled = true; q(".ui-dlg-no").disabled = true;
        if (choice === "skip") { b.remove(); resolve(); }   // «لاحقًا» بتقفل على طول، والحفظ في الخلفية
        try {
          const r = await api("/api/onboard/logo/pick", { method: "POST", ...jsonBody({ pick: choice }) });
          state = r; refresh();
          if (choice !== "skip" && r.colors?.length) toast("أضفنا الشعار وألوانه إلى عقل العلامة");
        } catch (e) { toast(e.message, true); }
        if (b.isConnected) { b.remove(); resolve(); }
      };
      const send = async (file) => {
        if (!file) return;
        err.hidden = true; drop.querySelector("b").textContent = "⏳ نجهّز الشعار…";
        const fd = new FormData(); fd.append("file", file);
        try {
          const r = await api("/api/onboard/logo", { method: "POST", body: fd });
          drop.hidden = true;
          const res = q(".fu-res");
          res.hidden = false;
          res.innerHTML = r.already ? `<div class="fu-pick" style="grid-template-columns:1fr"><button type="button" class="fu-opt on" data-p="cut"><i class="chk"><img src="${esc(r.cut_url)}" alt=""></i>شعارك شفاف أصلًا</button></div>`
            : `<p class="fu-sub" style="margin:0 0 10px">أيهما تفضّل؟</p><div class="fu-pick">
              <button type="button" class="fu-opt" data-p="src"><i><img src="${esc(r.src_url)}" alt=""></i>الأصلي</button>
              <button type="button" class="fu-opt on" data-p="cut"><i class="chk"><img src="${esc(r.cut_url)}" alt=""></i>بلا خلفية</button></div>`;
          res.onclick = (e) => { const o = e.target.closest(".fu-opt"); if (!o) return; pick = o.dataset.p; res.querySelectorAll(".fu-opt").forEach((x) => x.classList.toggle("on", x === o)); };
          ok.hidden = false;
        } catch (e) { err.textContent = e.message; err.hidden = false; drop.querySelector("b").textContent = "📤 اختر صورة الشعار أو اسحبها هنا"; }
      };
      inp.onchange = () => send(inp.files[0]);
      drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inp.click(); } };
      drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("on"); };
      drop.ondragleave = () => drop.classList.remove("on");
      drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("on"); send(e.dataTransfer.files[0]); };
      ok.onclick = () => done(pick);
      q(".ui-dlg-no").onclick = () => done("skip");
    });
  }

  // 🎬 قوالب المجال بأغلفتها: الأول هو المقترح
  function pickTemplate() {
    const list = typeof Gallery !== "undefined" ? Gallery.list() : [];
    // غلاف كل قالب من مجال العميل نفسه (لو موجود)، وإلا الغلاف العام
    const items = (state.reels || [state.first]).map((id) => ({ id, name: (list.find((x) => x.id === id) || {}).name || id,
      cover: (state.field_media || []).includes(id) ? `/gallery/f/${state.field}/${id}.jpg` : `/gallery/${id}.jpg?v=2`,
      video: (state.field_media || []).includes(id) ? `/gallery/f/${state.field}/${id}.mp4` : `/gallery/${id}.mp4` }));
    return new Promise((resolve) => {
      let cur = items[0];
      const b = dialog(`<h3>اختر شكل أول فيديو</h3><p class="fu-sub">قوالب مناسبة لمجالك. كلها تُصنع بالصوت والحركة فقط، وأول فيديو على حسابنا.</p>
        <div class="fu-tpls">${items.map((x, i) => `<button type="button" class="fu-tpl${i ? "" : " on"}" data-t="${esc(x.id)}"><video src="${esc(x.video)}" poster="${esc(x.cover)}" muted loop playsinline autoplay preload="metadata" aria-hidden="true"></video><b>${esc(x.name)}</b>${i ? "" : "<small>المقترح لمجالك</small>"}</button>`).join("")}</div>
        <div class="ui-dlg-acts"><button type="button" class="ui-dlg-ok">التالي</button><button type="button" class="ui-dlg-no">لاحقًا</button></div>`);
      b.querySelector(".fu-tpls").onclick = (e) => {
        const t = e.target.closest(".fu-tpl"); if (!t) return;
        cur = items.find((x) => x.id === t.dataset.t);
        b.querySelectorAll(".fu-tpl").forEach((x) => x.classList.toggle("on", x === t));
      };
      b.querySelector(".ui-dlg-ok").onclick = () => { b.remove(); resolve(cur); };
      b.querySelector(".ui-dlg-no").onclick = () => { b.remove(); resolve(null); };
    });
  }

  // 🔎 نتيجة مراجعة الفيديو: الكلام المنطوق ↔ الأسعار والوقت والصورة اللي على الشاشة
  const qaHTML = (qa) => {
    if (!qa) return "";
    const fixed = (qa.issues || []).filter((i) => i.fixed), open = (qa.issues || []).filter((i) => !i.fixed);
    return `<div class="fu-qa${open.length ? " warn" : ""}"><b>${open.length ? "⚠️ ملاحظات المراجعة" : "✓ راجعنا الفيديو: الكلام يطابق ما على الشاشة"}</b>${[...open, ...fixed].map((i) => `<span>${i.fixed ? "✓ " : "• "}${esc(i.detail)}</span>`).join("")}</div>`;
  };
  // ✓ الخطوات وهي بتخلص، وفي الآخر الفيديو نفسه
  let watching = null;
  function watch(open = true) {
    if (watching) { if (open && !watching.isConnected) document.body.appendChild(watching); return; }
    const b = dialog(`<h3>نصنع أول فيديو لك</h3><p class="fu-sub">يأخذ بضع دقائق. يمكنك إغلاق هذه النافذة، وسنخبرك عندما يجهز.</p><ul class="fu-steps"></ul>
      <div class="fu-out"></div><div class="ui-dlg-acts"><button type="button" class="ui-dlg-no">إخفاء</button></div>`, false);
    if (!open) b.remove();
    watching = b;
    b.querySelector(".ui-dlg-no").onclick = () => b.remove();
    const paint = () => {
      const j = state?.job || {};
      const done = j.done || [];
      b.querySelector(".fu-steps").innerHTML = (state?.steps || []).map((x) => {
        const ok = done.includes(x.key), on = !ok && j.step === x.key && j.status === "run";
        return `<li class="${ok ? "ok" : on ? "on" : ""}"><span>${ok ? "✓" : ""}</span>${esc(x.label)}${on && x.key === "draw" && j.progress ? `<em>${j.progress}%</em>` : ""}</li>`;
      }).join("");
      const out = b.querySelector(".fu-out");
      if (j.status === "done") {
        b.querySelector("h3").textContent = "أول فيديو جاهز 🎉";
        b.querySelector(".fu-sub").textContent = "موجود في «الفيديوهات الجاهزة». شاهده وانشره، أو ابدأ مشروعًا جديدًا.";
        out.innerHTML = `<video class="fu-vid" src="${esc(j.video_url)}" controls playsinline autoplay></video>${qaHTML(j.qa)}`;
        b.querySelector(".ui-dlg-acts").innerHTML = `<button type="button" class="ui-dlg-ok" data-go="pub">انشره الآن</button><button type="button" class="ui-dlg-no" data-go="new">ابدأ مشروعًا جديدًا</button>`;
        b.querySelector(".ui-dlg-acts").onclick = (e) => {
          const g = e.target.closest("[data-go]")?.dataset.go; if (!g) return;
          b.remove();
          if (g === "pub") showStep("7"); else window.NHNav?.("create");
        };
      } else if (j.status === "failed") {
        b.querySelector("h3").textContent = "توقف أول فيديو";
        out.innerHTML = `<p class="fu-err">${esc(j.error || "حدث خطأ")}</p>`;
        b.querySelector(".ui-dlg-acts").innerHTML = `<button type="button" class="ui-dlg-ok" data-go="again">حاول مرة أخرى</button><button type="button" class="ui-dlg-no" data-go="x">إغلاق</button>`;
        b.querySelector(".ui-dlg-acts").onclick = async (e) => {
          const g = e.target.closest("[data-go]")?.dataset.go; if (!g) return;
          if (g === "x") return b.remove();
          try { state = await api("/api/onboard/first/go", { method: "POST", ...jsonBody({ template: j.tpl || state.first }) }); watching = null; b.remove(); watch(); }
          catch (er) { toast(er.message, true); }
        };
      }
    };
    paint();
    const tick = async () => {
      await load();
      paint();
      if (state?.job?.status === "run") setTimeout(tick, 3000);
      else { if (!b.isConnected) document.body.appendChild(b); watching = null; }   // جهز (أو وقف): النافذة بتظهر بالفيديو نفسه
    };
    setTimeout(tick, 2500);
  }

  // 🧾 فكرة الإعلان بكلام بسيط («سنصنع لك إعلانًا عن طبق من قائمة مطعمكم…») ثم المعطيات الحقيقية اللي هتتحط في القالب
  function factField(q) {
    const id = `fuq-${q.key}`, req = q.req ? "" : ' <small style="display:inline;opacity:.6">(اختياري)</small>';
    const hint = q.hint ? `<small>${esc(q.hint)}</small>` : "";
    const show = q.show_if ? ` data-show="${esc(q.show_if[0])}" data-in="${esc(q.show_if[1].join(","))}"` : "";
    if (q.kind === "choice") return `<label class="fu-f"${show}><span>${esc(q.label)}</span><select id="${id}" data-k="${esc(q.key)}">${q.opts.map(([v, t]) => `<option value="${esc(v)}"${v === q.value ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>${hint}</label>`;
    if (q.kind === "multi") return `<div class="fu-f"${show}><span>${esc(q.label)}</span><div class="fu-chips" data-k="${esc(q.key)}" data-multi>${q.opts.map(([v, t]) => `<label><input type="checkbox" value="${esc(v)}">${esc(t)}</label>`).join("")}</div>${hint}</div>`;
    if (q.kind === "image") return `<div class="fu-f"${show}><span>${esc(q.label)}${req}</span><label class="fu-photo"><img alt="" hidden><b>📷 ارفع صورة</b><input type="file" accept="image/*" hidden data-k="${esc(q.key)}" data-img></label>${hint}</div>`;
    if (q.kind === "lines" || q.kind === "textarea") return `<label class="fu-f"${show}><span>${esc(q.label)}${req}</span><textarea id="${id}" rows="${q.kind === "lines" ? 4 : 2}" dir="auto" data-k="${esc(q.key)}" placeholder="${esc(q.ph || "")}"></textarea>${hint}</label>`;
    return `<label class="fu-f"${show}><span>${esc(q.label)}${req}</span><input id="${id}" ${q.kind === "num" ? 'inputmode="decimal"' : ""} dir="auto" data-k="${esc(q.key)}" placeholder="${esc(q.ph || "")}"${q.max ? ` maxlength="${q.max * 2}"` : ""}>${hint}</label>`;
  }
  async function askFacts(tpl) {
    const br = (window.I18N?.lang === "en" ? state.briefs_en : state.briefs)?.[tpl.id];   // الفكرة والخانات بلغة الواجهة
    const about = !String(state.about || "").trim() ? `<label class="fu-f"><span>ما الذي تقدمه؟ <small style="display:inline;opacity:.6">(سطر واحد)</small></span><textarea id="fuA" rows="2" dir="auto" placeholder="${esc(state.about_ph)}"></textarea></label>` : "";
    const body = br ? `<div class="fu-idea"><b>فكرة الإعلان</b>${esc(br.idea)}</div>${br.ask.map(factField).join("")}${about}`
      : `<label class="fu-f"><span>ما الذي تقدمه؟</span><textarea id="fuA" rows="3" dir="auto" placeholder="${esc(state.about_ph)}">${esc(state.about)}</textarea></label>`;
    const p = form("أول فيديو لك", br ? "اكتب المعطيات الحقيقية فقط، ونحن نكتب الإعلان والصوت حولها." : "سؤال واحد، والباقي يتعلمه العقل منك مع كل مشروع.", body, "اصنع الفيديو", async (b) => {
      const facts = {};
      b.querySelectorAll("[data-k]").forEach((el) => {
        if (el.closest("[data-show]")?.hidden) return;
        if (el.dataset.multi != null) facts[el.dataset.k] = [...el.querySelectorAll("input:checked")].map((x) => x.value);
        else if (el.dataset.img != null) { if (el.dataset.url) facts[el.dataset.k] = el.dataset.url; }
        else facts[el.dataset.k] = el.value;
      });
      const a = b.querySelector("#fuA")?.value || state.about || "";
      if (!br && !a.trim()) throw new Error("اكتب ما الذي تقدمه في جملة أو جملتين");
      return api("/api/onboard/first/go", { method: "POST", ...jsonBody({ template: tpl.id, name: tpl.name, about: a, audience: state.audience || "", facts }) });
    });
    const b = form.last;
    b.querySelector(".ui-dlg-box").classList.add("fu-wide");
    // خانة بتظهر حسب اختيار تاني (المدة تظهر بس لو فيه عدّاد)
    const sync = () => b.querySelectorAll("[data-show]").forEach((el) => {
      const v = b.querySelector(`[data-k="${el.dataset.show}"]`)?.value || "";
      el.hidden = !el.dataset.in.split(",").includes(v);
    });
    b.addEventListener("change", sync); sync();
    // الصورة بتترفع على طول وبتتشال خلفيتها
    b.querySelectorAll("[data-img]").forEach((inp) => inp.addEventListener("change", async () => {
      const file = inp.files?.[0]; if (!file) return;
      const box = inp.closest(".fu-photo"), lab = box.querySelector("b");
      lab.textContent = "جارٍ الرفع…";
      try {
        const fd = new FormData(); fd.append("file", file);
        const r = await api("/api/onboard/photo", { method: "POST", body: fd });
        inp.dataset.url = r.url; const im = box.querySelector("img"); im.src = r.url; im.hidden = false; lab.textContent = "✓ غيّر الصورة";
      } catch (e) { lab.textContent = "📷 ارفع صورة"; toast(e.message, true); }
    }));
    return p;
  }

  // 🎬 أول فيديو: قالب من قوالب المجال ← فكرة الإعلان ومعطياته ← الفيديو يتعمل لوحده
  // opts (من مكالمة سعاد): tpl = القالب اللي اختاره من كارتها، quiet = من غير نافذة المتابعة (هي بتقوله لما يجهز). بترجع true لو بدأ
  async function startFirst(opts = {}) {
    const s = opts.tpl ? await load() : state || (await load());
    if (!s) return false;
    if (s.need) { await askBasics(); if (state?.need) return false; }
    if (state.job && state.job.status !== "failed") { if (!opts.quiet) watch(); return state.job.status === "run" ? "running" : "done"; }
    if (!opts.tpl && !state.logo && !state.logo_asked) await askLogo();
    const tpl = opts.tpl || await pickTemplate();
    if (!tpl) return false;
    const r = await askFacts(tpl);
    if (!r) return false;
    state = r;
    refresh();
    if (!opts.quiet) watch(); else watch(false);
    return true;
  }

  document.addEventListener("click", (e) => { if (e.target.closest?.("[data-first]")) { e.preventDefault(); e.stopPropagation(); startFirst(); } }, true);
  return { check, startFirst, ceremony, state: () => state };
})();
