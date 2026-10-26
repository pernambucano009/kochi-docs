// 🏆 صفحة واحدة لثلاثة مداخل (من البروتوتايب: كلام أقل، من غير براويز، والنماذج في درج على الجنب):
// «منافسوك» (فرع في عقل العلامة) · «وصفة الاستهداف» (من النشر) · «خطة المحتوى» (تقويم الشهر).
const RivalsPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, d: null, timer: null, swap: null, focus: null, open: null, dw: null, au: 0, more: false, sel: null,
    pl: { d: null, busy: false }, mo: { d: null, busy: "", per: 0, edit: null }, bt: { d: null, busy: "", handle: "", platform: "" } };
  const html = () => `<div class="nb-wrap fs-wrap rv-wrap" id="rvWrap"><div class="nh-empty">جارٍ التحميل…</div></div>`;
  const fmt = (n) => { n = +n || 0; return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n); };
  const PL = { tiktok: "TikTok", instagram: "Instagram" };
  const ago = (ts) => { if (!ts) return ""; const d = Math.round((Date.now() / 1000 - ts) / 86400); return d <= 0 ? "اليوم" : d === 1 ? "أمس" : `منذ ${d} يومًا`; };
  const profile = (r) => (r.platform === "tiktok" ? `https://www.tiktok.com/@${r.handle}` : `https://www.instagram.com/${r.handle}`);
  const NEED_OK = "وافق على منافس واحد على الأقل في صفحة «منافسوك»، ثم اضغط «حدّث من تعليقات المنافسين» لتُصنع الوصفة.";
  // 💳 تكلفة الأزرار اللي بتصرف بتتكتب عليها قبل الضغط (مفيش حاجة بتتخصم لوحدها)
  let COST = null;
  api("/api/auto-costs").then((c) => { COST = c; if (S.el) render(); }).catch(() => {});
  const ct = (k) => (COST?.[k] ? ` · نحو ${COST[k]} نقطة` : "");
  const drawer = (t, body, wide) => `<aside class="pk-drawer${wide ? " wide" : ""}" aria-label="${esc(t)}"><div class="pk-dh"><h2>${esc(t)}</h2>${pkIb("close", "إغلاق", "data-rvdx", "sm")}</div>${body}</aside>`;

  // ================= 🏆 منافسوك =================
  function row(r) {
    const ok = r.state === "approved", open = S.open === r.id;
    return `<div class="rv-r${ok ? "" : " pend"}${S.focus === r.id ? " on" : ""}" data-rid="${esc(r.id)}">
      <span class="rv-pl rv-${esc(r.platform)}">${PL[r.platform] || esc(r.platform)}</span>
      <div class="rv-n"><a href="${esc(profile(r))}" target="_blank" rel="noopener noreferrer" dir="ltr">@${esc(r.handle)}</a>${r.why ? `<small>${esc(r.why)}</small>` : ""}</div>
      <span class="num" title="متوسط المشاهدات">${fmt(r.median_views)}</span><span class="num" title="أعلى منشور">${fmt(r.top_views)}</span><span class="num" title="منشورات آخر ٣٠ يومًا">${r.recent_count || 0}</span>
      <span class="pk-acts">${ok ? `${pkIb("eye", open ? "أخفِ المنشورات" : "منشوراته الناجحة", "data-rvopen", "sm")}${pkIb("refresh", "حدّث", "data-rvone", "sm")}${pkIb("edit", "بدّله بحساب آخر", "data-rvswap", "sm")}${pkIb("trash", "احذفه", "data-rvdel", "sm")}`
        : `${pkIb("check", "منافس فعلًا", "data-rvok", "sm blk")}${pkIb("close", "ليس منافسًا", "data-rvno", "sm")}`}</span>
      ${r.error ? `<p class="pk-err rv-full">⚠️ ${esc(r.error)}</p>` : ""}
      ${S.swap === r.id ? `<div class="pk-row2 rv-full"><input type="text" class="pk-q" data-rvswapin placeholder="الحساب البديل: @الاسم أو الرابط" dir="ltr">
          <select data-rvswappl>${Object.entries(PL).map(([k, t]) => `<option value="${k}" ${k === r.platform ? "selected" : ""}>${t}</option>`).join("")}</select>
          <button class="pk-chip" data-rvswapgo>بدّل</button><button class="pk-chip" data-rvswapx>إلغاء</button></div>` : ""}
      ${open ? `<div class="rv-posts rv-full">${(r.posts || []).slice(0, 6).map((p) => `<a class="rv-post" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">
          <b class="vr-x">×${p.multiple || "—"}</b><span class="num">${fmt(p.views)} مشاهدة · ${ago(p.ts)}</span><p>${esc((p.spoken || p.caption || "").slice(0, 160))}</p></a>`).join("") || `<p class="pk-note">لا توجد منشورات بعد.</p>`}</div>` : ""}</div>`;
  }
  function digest(d) {
    if (!d || !Object.keys(d).length) return "";
    const col = (k, t) => (d[k] || []).length ? `<div><span class="pk-lbl">${t}</span><ul>${d[k].slice(0, 5).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "";
    return `<div class="rv-dg2"><b class="pk-h3">ما ينجح لديهم</b>${d.summary ? `<p class="pk-note">${esc(d.summary)}</p>` : ""}
      <div class="rv-cols">${col("hooks", "خطافات تكسب")}${col("concepts", "أفكار تجلب المشاهدات")}${col("formats", "أشكال ناجحة")}${col("angles", "زوايا فارغة لك")}${col("avoid", "يجلب مشاهدات قليلة")}</div></div>`;
  }
  function rivalsView() {
    const d = S.d, busy = d.status === "working", pend = d.items.filter((r) => r.state !== "approved"), oks = d.items.filter((r) => r.state === "approved"), b = d.brain || {};
    const where = [b.domain, b.market, b.audience].filter(Boolean).join(" · ");
    const hd = `<div class="rv-r rv-hd"><span></span><span>الحساب</span><span>المتوسط</span><span>الأعلى</span><span>آخر ٣٠ يومًا</span><span></span></div>`;
    return `<div class="pk-top"><div class="pk-sub"><span><b class="num">${d.approved}</b> منافس معتمد</span>${d.pending ? `<span><b class="num">${d.pending}</b> ينتظر موافقتك</span>` : ""}
          ${d.found_at || d.updated_at ? `<span>آخر تحديث ${ago(d.found_at || d.updated_at)}</span>` : ""}${d.live ? "" : `<span>وضع تجريبي: حسابات تجريبية</span>`}
          ${busy ? `<span class="pk-busy">⏳ ${esc(d.step || "جارٍ العمل…")}</span>` : d.error ? `<span class="pk-err">⚠️ ${esc(d.error)}</span>` : ""}</div>
        <div class="pk-acts"><label class="rv-mode" data-tip="${d.algo_mode ? "القواعد خطوات إلزامية في صناعة كل فيديو" : "القواعد نصائح فقط"}"><input type="checkbox" data-rvmode ${d.algo_mode ? "checked" : ""}>وضع الخوارزمية</label>
          ${pkIb("search", `اقترح منافسين آخرين${ct("rivals_discover")}`, `data-rvfind ${busy ? "disabled" : ""}`)}${d.approved ? pkIb("refresh", `حدّث الأرقام${ct("rivals_refresh")}`, `data-rvall ${busy ? "disabled" : ""}`) : ""}
          ${pkIb("trend", "حلّل آخر ١٠ فيديوهات لك", 'data-rvdw="batch"')}${pkIb("plus", "أضف منافسًا بنفسك", 'data-rvdw="add"', "blk")}</div></div>
      ${pend.length ? `<div class="rv-sec"><span class="pk-lbl">مقترحون${where ? ` حسب: <span data-no-i18n>${esc(where)}</span>` : ""}</span><span class="pk-acts"><button class="pk-chip" data-rvokall>وافق على الكل</button><button class="pk-chip" data-rvnoall>ارفض الكل</button></span></div>
        <div class="rv-rows">${hd}${pend.map(row).join("")}</div>` : ""}
      ${oks.length ? `<div class="rv-sec"><span class="pk-lbl">منافسوك المعتمدون</span></div><div class="rv-rows">${pend.length ? "" : hd}${oks.map(row).join("")}</div>` : ""}
      ${d.items.length ? "" : `<div class="pk-empty">${busy ? "جارٍ البحث عن منافسين في مجالك…" : d.brain.domain ? "لا توجد اقتراحات بعد. اضغط «اقترح منافسين آخرين»." : "اكتب «المجال» في فرع الهوية، وسيجلب البرنامج المنافسين تلقائيًا."}</div>`}
      ${d.approved ? digest(d.digest) : ""}`;
  }
  function addDw() {
    const d = S.d;
    return `<p class="pk-note">من تضيفه يصبح معتمدًا مباشرة. ومن ترفضه أو تحذفه لا يُقترح مرة أخرى.</p>
      <label class="pk-f">الحساب<input type="text" data-rvnew placeholder="@اسم الحساب أو الرابط" dir="ltr"></label>
      <label class="pk-f">المنصة<select data-rvnewpl>${Object.entries(PL).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select></label>
      <div class="pk-dacts"><button class="nb-btn fs-go" data-rvadd ${d.status === "working" ? "disabled" : ""}>أضف</button>${d.excluded ? `<button class="pk-chip" data-rvreset>أعد المحذوفين (${d.excluded})</button>` : ""}</div>`;
  }
  // 📊 تحليل الدفعة: آخر ١٠ فيديوهات، كل واحد بكم ضعف وسيط الدفعة، والعقل يقارن الفائزين بالخاسرين ويخطط العشرة القادمة
  const TIER = { gold: "🥇", win: "🏆", ok: "", low: "" };
  function batchDw() {
    const B = S.bt, d = B.d;
    if (!d) return `<div class="pk-empty">جارٍ التحميل…</div>`;
    const c = d.calc, a = d.analysis, handle = B.handle || d.handle, plat = B.platform || d.platform;
    const by = { leads: "العملاء", follows: "المتابعين", views: "المشاهدات" };
    const head = `<p class="pk-note">نقارن الفيديوهات ببعضها لا بالأرقام المجردة: ما حقق ٥ أضعاف وسيط الدفعة فائز، و١٠ أضعاف ذهبي.${d.live ? "" : " (وضع تجريبي: أرقام تجريبية)"}</p>
      <div class="pk-row2"><input type="text" class="pk-q" data-btin placeholder="@حساب العلامة" dir="ltr" value="${esc(handle)}">
        <select data-btpl>${Object.entries(PL).map(([k, t]) => `<option value="${k}" ${k === plat ? "selected" : ""}>${t}</option>`).join("")}</select>
        ${pkIb("download", B.busy === "fetch" ? "جارٍ الجلب…" : "اجلب آخر ١٠", `data-btfetch ${B.busy ? "disabled" : ""}`, "sm")}</div>`;
    if (!c) return head + `<p class="pk-note">إن كانت لديك أرقام العملاء أو المتابعين التي جلبها كل فيديو، فاكتبها بجانبه: يقدّمها التحليل على المشاهدات.</p>`;
    const rows = c.rows.map((r, i) => `<div class="bt-row ${r.tier}">
        <span class="bt-x num">${r.x != null ? "×" + r.x : "—"}${TIER[r.tier] ? " " + TIER[r.tier] : ""}</span>
        <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" class="bt-cap"><b>${i + 1}.</b> ${esc((r.caption || "").slice(0, 90) || "—")}<small>${fmt(r.views)} مشاهدة · ${ago(r.ts)}</small></a>
        <label>عملاء<input type="number" min="0" data-btm="${esc(r.id)}" data-k="leads" value="${r.leads ?? ""}"></label>
        <label>متابعون<input type="number" min="0" data-btm="${esc(r.id)}" data-k="follows" value="${r.follows ?? ""}"></label></div>`).join("");
    const an = a ? `<div class="bt-an"><b class="pk-h3">ما تقوله هذه الدفعة</b><p class="pk-note">${esc(a.summary)}</p>
        <div class="pk-li"><b>ما نجح</b><small>${esc(a.pattern)}</small></div><div class="pk-li"><b>أوضح خطأ</b><small>${esc(a.mistake)}</small></div>
        <div class="pk-li"><b>التحسين الذي سنجرّبه</b><small>${esc(a.hypothesis)}</small></div>
        ${a.next.length ? `<span class="pk-lbl">العشرة القادمة</span><ol class="pl-list">${a.next.map((x) => `<li><b>${esc(x.idea)}</b>${x.hook ? ` — «${esc(x.hook)}»` : ""} <small>${x.kind === "repeat" ? "تكرار" : "تجربة"}</small></li>`).join("")}</ol>` : ""}
        ${a.stop.length ? `<span class="pk-lbl">نتوقف عن</span><ul class="pl-list">${a.stop.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div>` : "";
    return head + `<div class="bt-verdict ${c.verdict}">${esc(d.verdict_text)}</div>
      <p class="pk-note">المضاعف محسوب على ${by[c.rows.find((r) => r.by)?.by] || "المشاهدات"} (وسيط الدفعة)</p><div class="bt-rows">${rows}</div>
      <div class="pk-dacts"><button class="nb-btn fs-go" data-btgo ${B.busy ? "disabled" : ""}>${B.busy === "an" ? "جارٍ التحليل…" : a ? "حلّل مرة أخرى" : "حلّل الدفعة"}</button></div>${an}`;
  }

  // ================= 🎯 وصفة الاستهداف =================
  const GEN = { all: "الجميع", female: "نساء", male: "رجال" };
  const lines = (a) => (a || []).filter(Boolean).join("\n");
  function audText(a) {
    const m = a.meta, g = a.google, t = a.tiktok, sec = (h, b) => (b ? `${h}\n${b}\n` : "");
    return [a.summary, ...a.personas.map((p) => sec(`${p.name} (${p.age.join("-")} · ${GEN[p.gender]})`, [p.who, p.hook && `الجملة: ${p.hook}`].filter(Boolean).join("\n"))),
      sec("ميتا", [`العمر: ${m.age.join("-")} · ${GEN[m.gender]}`, m.locations.length && `الأماكن: ${m.locations.join("، ")}`, m.interests.length && `الاهتمامات: ${m.interests.join(", ")}`,
        m.behaviors.length && `السلوك: ${m.behaviors.join(", ")}`, m.exclusions.length && `استبعد: ${m.exclusions.join("، ")}`, m.placements && `أماكن الظهور: ${m.placements}`].filter(Boolean).join("\n")),
      sec("جوجل: كلمات البحث", lines(g.keywords)), sec("جوجل: كلمات سلبية", lines(g.negative)), sec("جوجل: من يبحث عن المنافسين", lines(g.competitor_terms)), sec("يوتيوب", lines(g.youtube_topics)),
      sec("تيك توك", [t.tt_interests.join(", "), t.tt_hashtags.map((h) => "#" + h).join(" ")].filter(Boolean).join("\n")),
      sec("الوسوم", a.hashtags.map((h) => "#" + h).join(" ")), ...a.angles.map((x) => sec(`${x.angle} (${x.persona})`, `${x.text}\n${x.cta}`)),
      sec("أسئلة الجمهور", lines(a.questions)), sec("الاعتراضات", lines(a.objections)), sec("الميزانية", a.budget)].filter(Boolean).join("\n");
  }
  // الجماهير: اللي استخلصها العقل من وصف العلامة أولًا، وإلا الشرائح اللي طلعت من كلام جمهور المنافسين
  function auds() {
    const d = S.d, a = d.audience || {}, P = a.personas || [];
    const near = (n) => P.find((p) => p.name === n) || P.find((p) => n && (p.name.includes(n) || n.includes(p.name)));
    if ((d.audiences || []).length) return d.audiences.map((x) => { const p = near(x.name); return { name: x.name, share: x.share, who: x.who || p?.who, pain: x.pain || (p?.pains || []).join("، "), hook: p?.hook, want: x.want, p }; });
    return P.map((p) => ({ name: p.name, who: p.who, pain: (p.pains || []).join("، "), hook: p.hook, want: (p.desires || []).join("، "), p }));
  }
  function audView() {
    const d = S.d, a = d.audience || {}, busy = d.status === "working", has = (a.personas || []).length || (a.meta?.interests || []).length;
    const L = auds(), i = Math.min(S.au, Math.max(0, L.length - 1)), cur = L[i];
    const top = `<div class="pk-top"><div class="pk-sub">${has && d.approved ? `<span>صُنعت ${ago(a.at)} من ${a.rivals || d.approved} منافس${a.comments ? ` و${a.comments} تعليق` : ""}</span>` : ""}${a.budget ? `<span data-tip="${esc(a.budget.slice(0, 120))}">الميزانية المقترحة</span>` : ""}
        ${busy ? `<span class="pk-busy">⏳ ${esc(d.step || "…")}</span>` : d.brief_due ? `<span class="pk-note">تغيّر المنافسون المعتمدون: حدّث الوصفة${ct("rivals_brief")}</span>` : ""}</div>
      <div class="pk-acts">${d.approved ? pkIb("refresh", `حدّث من تعليقات المنافسين${ct("rivals_brief")}`, `data-augo ${busy ? "disabled" : ""}`) : ""}${has ? pkIb("copy", "انسخ الوصفة كلها", 'data-aucp="all"') : ""}
        ${has && d.approved ? `<button class="nb-btn fs-go" data-auads>أنشئ إعلانًا لهذا الجمهور</button>` : ""}</div></div>`;
    if (!d.approved) return top + `<div class="pk-hero"><span class="pk-big">${pkIc("target", 40)}</span><h2>تحتاج منافسًا معتمدًا</h2><p>${NEED_OK}</p>${d.pending ? `<button class="nb-btn fs-go" data-rvgo>راجع الاقتراحات (${d.pending})</button>` : ""}</div>`;
    const pills = L.length ? `<div class="au-sel"><span class="pk-lbl">${d.audiences?.length ? `استخلص العقل ${L.length === 1 ? "جمهورًا واحدًا" : `${L.length} جماهير`} من وصف علامتك` : "الشرائح من نص جمهور المنافسين"}</span>
        <div class="pk-pills">${L.map((x, k) => `<button class="au-p${k === i ? " on" : ""}" data-aupick="${k}">${esc(x.name)}${x.share ? ` <small class="num">${x.share}٪</small>` : ""}</button>`).join("")}${d.client ? pkIb("plus", "أضف جمهورًا", "data-auadd", "sm") : ""}</div></div>` : "";
    if (!has) return top + pills + (busy || d.brief_due ? "" : `<div class="pk-empty">لا توجد وصفة بعد.${d.error ? ` ${esc(d.error)}` : ""}</div>`);
    const m = a.meta, g = a.google, t = a.tiktok, p = cur?.p;
    const tags = (arr, pre = "") => (arr || []).length ? `<div class="pk-pills">${arr.map((x) => `<span class="pk-pill">${pre}${esc(x)}</span>`).join("")}</div>` : `<small class="pk-note">—</small>`;
    const kv = (l, v) => `<div class="au-kv"><span class="pk-lbl">${l}</span>${v}</div>`;
    const age = p ? `${p.age.join("–")} · ${GEN[p.gender]}` : `${m.age.join("–")} · ${GEN[m.gender]}`;
    const plat = (name, k, body) => `<div class="au-plat"><h3>${name}${pkIb("copy", "انسخ الإعدادات", `data-aucp="${k}"`, "sm")}</h3>${body}</div>`;
    const angles = (a.angles || []).filter((x) => !cur || !x.persona || x.persona === cur.name || x.persona.includes(cur.name) || cur.name.includes(x.persona));
    return top + pills + (cur ? `<div class="au-who"><div><span class="pk-lbl">من هو</span><p>${esc(cur.who || "—")}</p></div><div><span class="pk-lbl">ما يزعجه</span><p>${esc(cur.pain || "—")}</p></div>
        <div><span class="pk-lbl">${cur.hook ? "جملة تشدّه" : "ما يريده"}</span><p class="${cur.hook ? "au-hook" : ""}">${cur.hook ? `«${esc(cur.hook)}»` : esc(cur.want || "—")}</p></div></div>` : "")
      + `<div class="au-plats">${plat("ميتا (فيسبوك وإنستجرام)", "meta", kv("العمر والجنس", `<span class="num">${age}</span>`) + kv("الأماكن", tags(m.locations)) + kv("الاهتمامات", tags(m.interests)))}
        ${plat("جوجل ويوتيوب", "google", kv("كلمات البحث", tags(g.keywords)) + kv("كلمات مستبعدة", tags(g.negative)))}
        ${plat("تيك توك", "tiktok", kv("الاهتمامات", tags(t.tt_interests)) + kv("الوسوم", tags(t.tt_hashtags, "#")))}</div>
      ${angles.length ? `<div class="au-ang"><span class="pk-lbl">زوايا إعلانية لهذا الجمهور</span>${angles.slice(0, 3).map((x) => `<div class="pk-li"><b>${esc(x.angle)}</b><small>${esc(x.text)}${x.cta ? ` · ${esc(x.cta)}` : ""}</small><span class="pk-acts">${pkIb("copy", "انسخ", `data-aucp="angle.${a.angles.indexOf(x)}"`, "sm")}</span></div>`).join("")}</div>` : ""}
      <button class="pk-more" data-aumore>${S.more ? "أخفِ التفاصيل" : "المزيد: السلوك والاستبعاد وأسئلة الجمهور واعتراضاته"}</button>
      ${S.more ? `<div class="au-plats">${plat("تفاصيل ميتا", "meta2", kv("السلوك", tags(m.behaviors)) + kv("استبعد", tags(m.exclusions)) + (m.placements ? kv("أماكن الظهور", `<p class="pk-note">${esc(m.placements)}</p>`) : ""))}
          ${plat("من يبحث عن المنافسين", "g.competitor_terms", kv("كلمات", tags(g.competitor_terms)) + kv("مواضيع يوتيوب", tags(g.youtube_topics)))}
          <div class="au-plat"><h3>صوت الجمهور</h3>${kv("أسئلة متكررة", `<ul class="pl-list">${(a.questions || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`)}${kv("ما يمنعهم من الشراء", `<ul class="pl-list">${(a.objections || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`)}</div></div>
        <p class="pk-note">الجمهور الدافئ أقوى من أي اهتمامات: من شاهد ٥٠٪ من فيديوهاتك في آخر ٣٠ يومًا، ومن تفاعل مع صفحتك أو راسلك، وزوار موقعك، وقائمة عملائك ومنها جمهور مشابه ١–٣٪. أنشئه من «إعلاناتك ← الجماهير المخصصة».</p>` : ""}`;
  }
  function audCopy(k) {
    const a = S.d.audience || {}, m = a.meta || {}, g = a.google || {}, t = a.tiktok || {};
    let txt = "";
    if (k === "all") txt = audText(a);
    else if (k === "meta") txt = [`العمر: ${m.age?.join("-")} · ${GEN[m.gender] || ""}`, `الأماكن: ${(m.locations || []).join("، ")}`, `الاهتمامات: ${(m.interests || []).join(", ")}`].join("\n");
    else if (k === "meta2") txt = [`السلوك: ${(m.behaviors || []).join(", ")}`, `استبعد: ${(m.exclusions || []).join("، ")}`, m.placements || ""].filter(Boolean).join("\n");
    else if (k === "google") txt = `${lines(g.keywords)}\n\nكلمات مستبعدة:\n${lines(g.negative)}`;
    else if (k === "tiktok") txt = `${(t.tt_interests || []).join(", ")}\n${(t.tt_hashtags || []).map((h) => "#" + h).join(" ")}`;
    else if (k.startsWith("angle.")) { const x = a.angles[+k.slice(6)]; txt = x ? `${x.text}\n${x.cta}` : ""; }
    else { const [o, f] = k.split("."); txt = lines(({ g, m, t }[o] || a)[f]); }
    if (!txt.trim()) return toast("لا يوجد ما يُنسخ", true);
    navigator.clipboard.writeText(txt).then(() => toast("✓ نُسخ")).catch(() => toast("منع المتصفح النسخ", true));
  }

  // ================= 🗓️ خطة المحتوى: تقويم الشهر =================
  const WD = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const MON = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const KIND_C = { reel: "#E5613E", carousel: "#181718", phone: "#9DB3BE", avatar: "#C9A86A", custom: "#8FA98B" };
  const codeTpls = () => (typeof Gallery !== "undefined" && Gallery.list ? Gallery.list() : []).filter((x) => String(x.id).startsWith("t-")).map((x) => ({ id: x.id, name: x.name, desc: x.desc || "" }));
  const moFmts = (x) => {
    const a = [{ id: "phone", name: "تصوير بالجوال" }, { id: "carousel", name: "كاروسيل" }, { id: "avatar", name: "فيديو بالأفاتار" }, ...codeTpls().map((t) => ({ id: t.id, name: t.name }))];
    return a.some((f) => f.id === x.tpl) ? a : [{ id: x.tpl, name: x.tpl_name || x.tpl }, ...a];
  };
  function ring(score, need) {
    const r = 13, c = 2 * Math.PI * r;
    return `<button class="pl-ring" data-moknow data-tip="اضغط لترى ما ينقص (الخطة تحتاج ${need}٪)"><svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><circle cx="16" cy="16" r="${r}" fill="none" stroke="var(--nh-line, rgba(24,23,24,.1))" stroke-width="3"/>
      <circle cx="16" cy="16" r="${r}" fill="none" stroke="var(--nh-accent)" stroke-width="3" stroke-linecap="round" stroke-dasharray="${(c * Math.min(100, score)) / 100} ${c}" transform="rotate(-90 16 16)"/></svg>نسبة فهم العقل <b class="num">${score}٪</b></button>`;
  }
  function planView() {
    const M = S.mo, d = M.d;
    if (!d) return `<div class="pk-empty">جارٍ التحميل…</div>`;
    const m = d.month, busy = d.status === "working" || M.busy === "make", applied = m?.status === "applied", per = M.per || m?.per_day || 2;
    const items = (m?.items || []).slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)), byDay = {};
    items.forEach((x) => (byDay[x.date] = byDay[x.date] || []).push(x));
    const kinds = [...new Set(items.map((x) => x.kind))];
    const stepper = `<span class="pl-per" data-tip="منشورات في اليوم"><button data-moper="-1" aria-label="أقل">−</button><b class="num">${per}</b><button data-moper="1" aria-label="أكثر">+</button></span>`;
    const first = items[0] ? new Date(items[0].date + "T12:00:00") : new Date();
    const title = items.length ? `خطة ${MON[first.getMonth()]}` : "خطة الشهر";
    const top = `<div class="pk-top"><div class="pk-sub"><b class="pl-title">${title}</b>${ring(d.score, d.need)}
          ${kinds.length ? `<span class="pl-leg">${kinds.map((k) => `<span><i style="background:${KIND_C[k] || "#999"}"></i>${esc(d.kinds[k] || k)}</span>`).join("")}</span>` : ""}
          ${busy ? `<span class="pk-busy">⏳ تُبنى الخطة… (دقيقة أو دقيقتان)</span>` : d.error ? `<span class="pk-err">⚠️ ${esc(d.error)}</span>` : ""}</div>
        <div class="pk-acts">${pkIb("spark", "الاستراتيجية التي تُبنى عليها الخطة", 'data-rvdw="strategy"')}${stepper}${pkIb("refresh", `${m ? "أعد بناء الخطة" : "ابنِ خطة الشهر"}${ct("month")}`, `data-momake ${busy || !d.ready ? "disabled" : ""}`)}
          ${m ? applied ? `<button class="pk-chip" data-mopilot>افتح الأوتوبايلوت</button><button class="pk-chip" data-moapply="0">أوقف التطبيق</button>` : `<button class="nb-btn fs-go" data-moapply="1">اعتمد الخطة للأوتوبايلوت</button>` : ""}</div></div>`;
    if (!items.length) return top + `<div class="pk-hero"><span class="pk-big">${pkIc("target", 40)}</span><h2>${d.ready ? "ابنِ خطة الشهر" : "العقل يحتاج أن يفهمك أكثر"}</h2>
        <p>${d.ready ? "كل يوم بعدد منشوراته، وكل منشور بشكله وقالبه وفكرته وخطافه. راجعها ثم اعتمدها لتنتقل إلى الأوتوبايلوت." : `تُبنى الخطة عندما يفهمك العقل بنسبة ${d.need}٪ مع الشروط الأساسية. اضغط على العدّاد لترى ما ينقص.`}</p>
        ${d.ready ? `<button class="nb-btn fs-go" data-momake ${busy ? "disabled" : ""}>ابنِ خطة الشهر${ct("month")}</button>` : ""}</div>`;
    // التقويم: من أول يوم في الشهر لحد آخر يوم فيه بوست
    const y = first.getFullYear(), mo = first.getMonth(), lead = new Date(y, mo, 1).getDay(), last = new Date(y, mo + 1, 0).getDate();
    const key = (n) => `${y}-${String(mo + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
    if (!S.sel || !byDay[S.sel]) S.sel = Object.keys(byDay).sort()[0];
    const cells = Array.from({ length: Math.ceil((lead + last) / 7) * 7 }, (_, k) => {
      const n = k - lead + 1, real = n >= 1 && n <= last, L = real ? byDay[key(n)] || [] : [];
      if (!real) return `<span class="pl-c off"></span>`;
      return `<button class="pl-c${S.sel === key(n) ? " on" : ""}${L.length ? "" : " empty"}" ${L.length ? `data-moday="${key(n)}"` : "disabled"}><span class="pl-cn"><span class="num">${n}</span><span class="pl-dots">${L.map((x) => `<i style="background:${KIND_C[x.kind] || "#999"}"></i>`).join("")}</span></span>
        <span class="pl-ct">${esc(L[0]?.title || "")}</span></button>`;
    }).join("");
    const sel = byDay[S.sel] || [], sd = new Date(S.sel + "T12:00:00");
    const post = (x) => {
      const done = !!x.job;
      if (M.edit === x.id) return `<div class="pl-post on" data-moid="${esc(x.id)}">
          <label class="pk-f">العنوان<input data-mof="title" value="${esc(x.title)}"></label><label class="pk-f">الفكرة<textarea data-mof="idea" rows="2">${esc(x.idea)}</textarea></label>
          <label class="pk-f">الخطاف<input data-mof="hook" value="${esc(x.hook)}"></label><label class="pk-f">الدعوة<input data-mof="cta" value="${esc(x.cta)}"></label>
          <div class="pk-row2"><label class="pk-f">الوقت<input type="time" data-mof="time" value="${esc(x.time)}"></label><label class="pk-f">القالب<select data-mof="tpl">${moFmts(x).map((f) => `<option value="${esc(f.id)}" ${f.id === x.tpl ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select></label></div>
          <div class="pk-acts"><button class="nb-btn fs-go" data-mosave>احفظ</button><button class="pk-chip" data-mox>إلغاء</button>${pkIb("trash", "احذف المنشور من الخطة", "data-model", "sm")}</div></div>`;
      return `<div class="pl-post${done ? " done" : ""}" data-moid="${esc(x.id)}" ${done ? "" : `data-moedit data-tip="اضغط للتعديل"`}>
          <span class="pl-pm"><span class="num">${esc(x.time)}</span> · ${esc(d.kinds[x.kind] || "")}${x.aud ? ` · ${esc(x.aud)}` : ""}${done ? " · ✓ في الأوتوبايلوت" : ""}</span>
          <b>${esc(x.title)}</b>${x.hook ? `<i>«${esc(x.hook)}»</i>` : ""}<small>القالب: ${esc(x.tpl_name || x.tpl || "")}</small></div>`;
    };
    return top + `<div class="pl-wrap"><div class="pl-cal">${WD.map((w) => `<span class="pl-wd">${w}</span>`).join("")}${cells}</div>
      <div class="pl-side"><span class="pk-lbl">${WD[sd.getDay()]} ${sd.getDate()} ${MON[sd.getMonth()]} · ${sel.length} ${sel.length === 1 ? "منشور" : "منشورات"}</span>${sel.map(post).join("")}
        ${applied ? `<p class="pk-note">الخطة مطبّقة: كل منشور يُصنع في موعده بفكرته، والموافقات كما هي في الأوتوبايلوت.</p>` : ""}</div></div>`;
  }
  // الاستراتيجية (فريمويركس المحتوى مطبّقة على العلامة) في الدرج
  function strategyDw() {
    const P = S.pl, st = P.d?.strategy, G = P.d?.games || {}, AX = P.d?.axes || {}, pl = P.d?.plan;
    if (!P.d) return `<div class="pk-empty">جارٍ التحميل…</div>`;
    const fresh = pl ? Math.max(0, pl.count - pl.built_from) : 0;
    const cnt = pl ? `<p class="pk-note"><b class="num">${pl.count}</b> معلومة يبني منها العقل خطتك${pl.status === "working" ? " · ⏳ تُبنى الآن…" : fresh && pl.has ? ` · ${fresh} جديدة لم تدخل فيها بعد` : ""}. حدّثها بضغطة كلما عرف العقل شيئًا جديدًا عنك.</p>
      ${st && pl.status !== "working" ? `<button class="pk-chip" data-plgo ${P.busy ? "disabled" : ""}>${P.busy ? "جارٍ التحديث…" : `حدّثها الآن${ct("plan")}`}</button>` : !st && pl.status !== "working" && pl.ready && pl.count >= pl.min ? `<button class="pk-chip" data-plgo ${P.busy ? "disabled" : ""}>${P.busy ? "جارٍ البناء…" : `ابنِ الاستراتيجية${ct("plan")}`}</button>` : ""}${pl.error ? `<p class="pk-err">⚠️ ${esc(pl.error)}</p>` : ""}` : "";
    if (!st) return cnt + `<p class="pk-note">تحدد لعبتك (شهرة أم بيع)، وجملة التموضع، والشخص الذي تخاطبه، ودوائر الجمهور، والمواضيع والأشكال، وأسبوعًا بخلطة ٣-٢-١، وآراءك المختلفة، والفراغ الذي تركه المنافسون.</p>
      ${pl && pl.status !== "working" && (pl.count < pl.min || !pl.ready) ? `<p class="pk-note">يمكن بناؤها عندما يعرف العقل ${pl.min} معلومات على الأقل (منها «المجال» أو «عن العلامة»).</p>` : ""}`;
    const li = (a) => a.map((x) => `<li>${esc(x)}</li>`).join("");
    const sec = (t, h) => (h ? `<span class="pk-lbl">${t}</span>${h}` : "");
    return `<span class="pl-game">${esc(G[st.game.key] || "")}</span><p class="pl-state">${esc(st.statement)}</p><p class="pk-note">${esc(st.game.why)}</p>
      ${st.avatar ? `<p class="pk-note"><b>من نخاطبه:</b> ${esc(st.avatar)}</p>` : ""}${cnt}
      ${sec("دوائر الجمهور (من الأضيق إلى الأوسع)", st.rings.length ? `<ol class="pl-list">${li(st.rings)}</ol>` : "")}
      ${sec("مجموعات المواضيع", st.buckets.map((b) => `<div class="pk-li"><b>${esc(b.name)}</b><small>${esc(b.topics.join("، "))}</small></div>`).join(""))}
      ${sec("الأشكال", st.formats.map((f) => `<div class="pk-li"><b>${esc(f.name)}</b><small>${esc(f.why)}</small></div>`).join(""))}
      ${sec("آراؤك المختلفة", st.takes.length ? `<ul class="pl-list">${li(st.takes)}</ul>` : "")}
      ${sec("التميّز", `${st.words.length ? `<div class="pk-pills">${st.words.map((w) => `<span class="pk-pill">${esc(w)}</span>`).join("")}</div>` : ""}${st.signature ? `<p class="pk-note">${esc(st.signature)}</p>` : ""}
        ${Object.entries(st.white_space).filter(([, v]) => v).map(([k, v]) => `<div class="pk-li"><b>الفراغ في ${esc(AX[k] || k)}</b><small>${esc(v)}</small></div>`).join("")}`)}
      ${sec("من مشاهد إلى عميل", `<div class="pk-li"><b>كلمة التعليق</b><small>${esc(st.funnel.keyword || "—")}</small></div><div class="pk-li"><b>الهدية</b><small>${esc(st.funnel.magnet)}</small></div><div class="pk-li"><b>العرض</b><small>${esc(st.funnel.offer)}</small></div>`)}
      ${sec("الإيقاع والمنصة", `${st.cadence ? `<p class="pk-note">${esc(st.cadence)}</p>` : ""}${st.platform ? `<p class="pk-note">المنصة الأساسية: ${esc(st.platform)}</p>` : ""}${st.profile.bio ? `<p class="pk-note">النبذة: ${esc(st.profile.bio)}</p>` : ""}`)}
      ${sec("نبتعد عن", st.avoid.length ? `<ul class="pl-list">${li(st.avoid)}</ul>` : "")}`;
  }
  async function moLoad() {
    try { S.mo.d = await api("/api/plan/month"); } catch (err) { return toast(err.message, true); }
    if (S.only === "plan") morphing(render);
    clearTimeout(S.moT);
    if (S.mo.d.status === "working") S.moT = setTimeout(moLoad, 4000);
  }

  function render() {
    const w = S.el;
    if (!w || !S.d) return;
    if (S.only === "plan" && !S.mo.d && !S.mo.loading) { S.mo.loading = true; moLoad().finally(() => (S.mo.loading = false)); }
    if (S.dw === "strategy" && !S.pl.d) api("/api/strategy").then((x) => { S.pl.d = x; render(); planPoll(); }).catch((err) => toast(err.message, true));
    if (S.dw === "batch" && !S.bt.d) api("/api/batch").then((x) => { S.bt.d = x; render(); }).catch((err) => toast(err.message, true));
    // ماتمسحش اللي بيتكتب في الدرج وهو مفتوح
    const typing = w.querySelector(".pk-drawer :is(input, textarea):focus");
    if (typing && S.keep) return;
    const view = S.only === "plan" ? planView() : S.only === "audience" ? audView() : rivalsView();
    const dw = S.dw ? drawer({ add: "أضف منافسًا", batch: "حلّل آخر ١٠ فيديوهات لك", strategy: "الاستراتيجية" }[S.dw], { add: addDw, batch: batchDw, strategy: strategyDw }[S.dw](), S.dw === "batch") : "";
    w.innerHTML = `<div class="pk rv-pk">${view}${dw}</div>`;
    if (S.focus) { w.querySelector(`[data-rid="${CSS.escape(S.focus)}"]`)?.scrollIntoView({ block: "center" }); S.focus = null; }
  }
  // الاستراتيجية وهي بتتبني لوحدها: بنشوف كل شوية لحد ما تخلص
  function planPoll() {
    clearTimeout(S.plT);
    if (S.pl.d?.plan?.status !== "working") return;
    S.plT = setTimeout(async () => { try { S.pl.d = await api("/api/strategy"); morphing(render); } catch {} planPoll(); }, 4000);
  }
  function poll() {
    clearTimeout(S.timer);
    if (S.d?.status !== "working" && !S.d?.brief_due && !(S.d && !S.d.items.length && S.d.brain?.domain && S.d.status !== "failed")) return;
    S.timer = setTimeout(async () => {
      try { S.d = await api("/api/rivals"); S.keep = true; morphing(render); S.keep = false; } catch {}
      poll();
    }, 2500);
  }
  async function act(path, opts) {
    try { S.d = await api(path, opts); S.swap = null; render(); poll(); }
    catch (err) { toast(err.message, true); }
  }
  function bind(w) {
    w.addEventListener("input", (e) => {
      if (e.target.matches("[data-btin]")) S.bt.handle = e.target.value;
    });
    w.addEventListener("change", (e) => {
      if (e.target.matches("[data-btpl]")) S.bt.platform = e.target.value;
      if (e.target.matches("[data-rvmode]")) {
        api("/api/algo/mode", { method: "POST", ...jsonBody({ on: e.target.checked }) })
          .then((x) => { S.d.algo_mode = x.on; render(); toast(x.on ? "✓ وضع الخوارزمية مفعّل" : "أُوقف وضع الخوارزمية"); }).catch((err) => toast(err.message, true));
      }
      if (e.target.matches("[data-btm]")) {
        const row = S.el.querySelectorAll(`[data-btm="${CSS.escape(e.target.dataset.btm)}"]`), val = (k) => { const x = [...row].find((i) => i.dataset.k === k)?.value; return x === "" || x == null ? null : +x; };
        api("/api/batch/metric", { method: "PATCH", ...jsonBody({ id: e.target.dataset.btm, leads: val("leads"), follows: val("follows") }) })
          .then((x) => { S.bt.d = x; render(); }).catch((err) => toast(err.message, true));
      }
    });
    w.addEventListener("click", async (e) => {
      const q = (s) => e.target.closest(s);
      const dw = q("[data-rvdw]");
      if (dw) { S.dw = S.dw === dw.dataset.rvdw ? null : dw.dataset.rvdw; return render(); }
      if (q("[data-rvdx]")) { S.dw = null; return render(); }
      if (q("[data-btfetch]")) {
        const B = S.bt, h = (B.handle || B.d?.handle || "").trim();
        if (!h) return toast("اكتب حساب العلامة", true);
        B.busy = "fetch"; render();
        try { B.d = await api("/api/batch/fetch", { method: "POST", ...jsonBody({ handle: h, platform: B.platform || B.d?.platform || "tiktok" }) }); }
        catch (err) { toast(err.message, true); }
        B.busy = ""; return render();
      }
      if (q("[data-btgo]")) {
        S.bt.busy = "an"; render();
        try { S.bt.d = await api("/api/batch/analyze", { method: "POST" }); } catch (err) { toast(err.message, true); }
        S.bt.busy = ""; render();
        return S.el.querySelector(".bt-an")?.scrollIntoView({ block: "start", behavior: "smooth" });
      }
      if (q("[data-plgo]")) {
        S.pl.busy = true; render();
        try { await api("/api/strategy", { method: "POST", ...jsonBody({}) }); S.pl.d = await api("/api/strategy"); toast("✓ حُدّثت الاستراتيجية، وستتبعها كل الأدوات"); }
        catch (err) { toast(err.message, true); }
        S.pl.busy = false; return render();
      }
      if (q("[data-moknow]")) return window.uiKnow?.(S.mo.d?.know);
      const per = q("[data-moper]");
      if (per) { S.mo.per = Math.max(1, Math.min(6, (S.mo.per || S.mo.d?.month?.per_day || 2) + +per.dataset.moper)); return render(); }
      if (q("[data-momake]")) {
        if (S.mo.d?.month && !(await uiConfirm("هل تبني خطة جديدة؟ ستُحذف الخطة الحالية (وتكتمل المنشورات التي بدأت في الأوتوبايلوت)."))) return;
        S.mo.busy = "make"; render();
        try { S.mo.d = await api("/api/plan/month", { method: "POST", ...jsonBody({ per_day: S.mo.per || S.mo.d?.month?.per_day || 2, templates: codeTpls() }) }); }
        catch (err) { toast(err.message, true); }
        S.mo.busy = ""; S.sel = null; render(); return moLoad();
      }
      if (q("[data-mopilot]")) return window.NHNav?.("pilot");
      const ap = q("[data-moapply]");
      if (ap) {
        try { S.mo.d = await api("/api/plan/month/apply", { method: "POST", ...jsonBody({ on: ap.dataset.moapply === "1" }) }); toast(ap.dataset.moapply === "1" ? "✓ انتقلت الخطة إلى الأوتوبايلوت" : "عاد الأوتوبايلوت إلى الاختيار من القوالب بالتناوب"); }
        catch (err) { toast(err.message, true); }
        return render();
      }
      const day = q("[data-moday]");
      if (day) { S.sel = day.dataset.moday; S.mo.edit = null; return render(); }
      const mid = q("[data-moid]")?.dataset.moid;
      if (mid && q("[data-mox]")) { S.mo.edit = null; return render(); }
      if (mid && q("[data-model]")) {
        if (!(await uiConfirm("هل تحذف هذا المنشور من الخطة؟"))) return;
        try { S.mo.d = await api(`/api/plan/month/items/${encodeURIComponent(mid)}`, { method: "DELETE" }); S.mo.edit = null; } catch (err) { toast(err.message, true); }
        return render();
      }
      if (mid && q("[data-mosave]")) {
        const box = q("[data-moid]"), v = (k) => box.querySelector(`[data-mof="${k}"]`)?.value;
        try { S.mo.d = await api(`/api/plan/month/items/${encodeURIComponent(mid)}`, { method: "PATCH", ...jsonBody({ title: v("title"), idea: v("idea"), hook: v("hook"), cta: v("cta"), time: v("time"), tpl: v("tpl") }) }); S.mo.edit = null; toast("✓ تم الحفظ"); }
        catch (err) { toast(err.message, true); }
        return render();
      }
      if (mid && q("[data-moedit]") && S.mo.edit !== mid) { S.mo.edit = mid; return render(); }
      const pk = q("[data-aupick]");
      if (pk) { S.au = +pk.dataset.aupick; return render(); }
      if (q("[data-aumore]")) { S.more = !S.more; return render(); }
      if (q("[data-auadd]")) {
        const name = await uiPrompt("اسم الجمهور (مثلًا: الأم التي تشتري للبيت):");
        if (!name || !name.trim()) return;
        const who = (await uiPrompt("من هو في جملة (العمر والاهتمام):")) || "";
        try { const b = await api(`/api/ad-brains/${encodeURIComponent(S.d.client)}/audiences`, { method: "PUT", ...jsonBody({ items: [...(S.d.audiences || []), { name: name.trim(), who }] }) }); S.d.audiences = b.audiences || []; S.au = S.d.audiences.length - 1; render(); }
        catch (err) { toast(err.message, true); }
        return;
      }
      if (q("[data-auads]")) return window.NHNav?.("adsmgr");
      if (q("[data-rvgo]")) return window.NHNav?.("rivals");
      if (q("[data-augo]")) return act("/api/rivals/audience", { method: "POST" });
      const cp = q("[data-aucp]");
      if (cp) return audCopy(cp.dataset.aucp);
      if (q(".vr-wrap") || q("a[href]")) return;
      if (q("[data-rvokall]")) return act("/api/rivals/review", { method: "POST", ...jsonBody({ approve: true }) });
      if (q("[data-rvnoall]")) { if (await uiConfirm(`هل ترفض كل الاقتراحات (${S.d.pending})؟ لن تُقترح مرة أخرى.`)) act("/api/rivals/review", { method: "POST", ...jsonBody({ approve: false }) }); return; }
      if (q("[data-rvfind]")) return act("/api/rivals/discover", { method: "POST" });
      if (q("[data-rvall]")) return act("/api/rivals/refresh", { method: "POST" });
      if (q("[data-rvreset]")) return act("/api/rivals/reset-excluded", { method: "POST" });
      if (q("[data-rvadd]")) {
        const h = w.querySelector("[data-rvnew]").value.trim();
        if (!h) return toast("اكتب اسم الحساب", true);
        S.dw = null;
        return act("/api/rivals/add", { method: "POST", ...jsonBody({ handle: h, platform: w.querySelector("[data-rvnewpl]").value }) });
      }
      const rid = q("[data-rid]")?.dataset.rid;
      if (!rid) return;
      if (q("[data-rvopen]")) { S.open = S.open === rid ? null : rid; return render(); }
      if (q("[data-rvdel]")) { if (await uiConfirm("هل تحذف هذا المنافس؟ لن يعود في البحث.")) act(`/api/rivals/${rid}`, { method: "DELETE" }); return; }
      if (q("[data-rvok]")) return act("/api/rivals/review", { method: "POST", ...jsonBody({ approve: true, ids: [rid] }) });
      if (q("[data-rvno]")) return act("/api/rivals/review", { method: "POST", ...jsonBody({ approve: false, ids: [rid] }) });
      if (q("[data-rvone]")) return act(`/api/rivals/refresh?rid=${encodeURIComponent(rid)}`, { method: "POST" });
      if (q("[data-rvswap]")) { S.swap = rid; render(); w.querySelector("[data-rvswapin]")?.focus(); return; }
      if (q("[data-rvswapx]")) { S.swap = null; return render(); }
      if (q("[data-rvswapgo]")) {
        const h = w.querySelector("[data-rvswapin]").value.trim();
        if (!h) return toast("اكتب اسم الحساب", true);
        return act("/api/rivals/add", { method: "POST", ...jsonBody({ handle: h, platform: w.querySelector("[data-rvswappl]").value, replace: rid }) });
      }
    });
  }
  async function mount(root) {
    const w = root.querySelector("#rvWrap");
    if (!w) return;
    S.el = w;
    w.innerHTML = "";
    const f = String(window.RV_FOCUS || "");
    window.RV_FOCUS = null;
    // 🧭 من «خطة المحتوى»: التقويم لوحده · 🎯 من «النشر»: وصفة الاستهداف لوحدها · غير كده: المنافسين
    S.only = f === "plan-only" || root.dataset.key === "plan" ? "plan" : root.dataset.key === "audience" || f === "rv:audience" ? "audience" : null;
    S.dw = f === "rv:batch" ? "batch" : null;
    S.pl.d = null; S.bt.d = null; S.sel = null; S.open = null; S.more = false;
    S.mo = { d: null, busy: "", per: 0, edit: null };
    S.focus = /^rv[^:]/.test(f) ? f.slice(2) : null;
    bind(w);
    try { S.d = await api("/api/rivals"); render(); poll(); }
    catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  return { html, mount, close: () => { clearTimeout(S.timer); clearTimeout(S.moT); clearTimeout(S.plT); } };
})();
