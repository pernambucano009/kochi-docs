// StudioMania — 💬 صندوق الردود: الكومنتات والرسايل من الحسابات المربوطة في Zernio.
// تختار بوست أو محادثة، تقرا، و«✨ اقترح رد» بيكتب رد بصوت البراند ونفس لهجة اللي كتب. انت تعدّله وتبعته.

const ib = { tab: "comments", posts: [], convs: [], next: null, sel: null, post: null, comments: [], messages: [], loading: false, onlyWaiting: false, triage: null, tkw: "", tdm: "" };
const IB_ICON = { instagram: "◎", facebook: "f", tiktok: "♪", youtube: "▶", twitter: "𝕏", x: "𝕏", threads: "@", linkedin: "in", telegram: "✈", whatsapp: "✆", bluesky: "🦋", reddit: "◉" };
const IB_NAME = { instagram: "إنستجرام", facebook: "فيسبوك", tiktok: "تيك توك", youtube: "يوتيوب", twitter: "X", x: "X", threads: "ثريدز", linkedin: "لينكدإن", telegram: "تيليجرام", whatsapp: "واتساب", bluesky: "بلوسكاي", reddit: "ريديت" };
const ibCount = (n) => (n === 1 ? "تعليق واحد" : n === 2 ? "تعليقان" : `${n} تعليقات`);
const ibPl = (k) => `<i class="ib-pl" title="${escapeHtml(IB_NAME[k] || k || "")}">${IB_ICON[k] || "•"}</i>`;
const ibAv = (pic, name) => {
  const ch = escapeHtml((name || "?").trim()[0] || "?");
  // الصورة لو مافتحتش (لينكات المنصات بتنتهي) بيبان أول حرف من الاسم
  return pic ? `<i class="ib-av">${ch}<img src="${escapeHtml(pic)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"></i>`
    : `<i class="ib-av">${ch}</i>`;
};

function ibAlert(msg) {
  const a = $("inboxAlert");
  a.hidden = !msg;
  a.innerHTML = msg || "";
}

async function initInbox() {
  ibAlert("");
  ibStarShow();
}

// ---------- ✳️ تقسيمة المرسيدس: ٣ أتلات وكل تلت قسم، والإعدادات في النص ----------
const IB_SECS = ["comments", "messages", "bots"];
function ibStarShow() {
  $("ibStar").hidden = false; $("ibWork").hidden = true;
  ibStarLayout();
  ibStarLoad();
}
// الخطوط التلاتة من النص: واحد لفوق، واتنين للركنين اللي تحت. وكل قسم في المساحة اللي بين خطين
function ibStarLayout() {
  const st = $("ibStar"), w = st.clientWidth, h = st.clientHeight;
  if (!w || !h) return;
  const cx = w / 2, cy = h * 0.47, k = (h - cy) * 0.4, rtl = document.documentElement.dir !== "ltr";
  const poly = { a: `${cx},${cy} ${cx},0 ${w},0 ${w},${h}`, b: `${cx},${cy} ${cx},0 0,0 0,${h}`, c: `${cx},${cy} 0,${h} ${w},${h}` };
  // RTL: أول قسم (التعليقات) على اليمين، والرسائل على الشمال، والردود التلقائية تحت
  const order = rtl ? ["a", "b", "c"] : ["b", "a", "c"];
  $("ibY").setAttribute("viewBox", `0 0 ${w} ${h}`);
  $("ibY").innerHTML = IB_SECS.map((sec, i) => `<polygon data-sec="${sec}" points="${poly[order[i]]}"/>`).join("")
    + `<path d="M${cx} ${cy}V0M${cx} ${cy}L0 ${h}M${cx} ${cy}L${w} ${h}"/>`;
  const side = (el, right) => Object.assign(el.style, { top: "28px", height: `${cy - 40}px`, width: `${cx - 90}px`, left: right ? `${cx + 62}px` : "28px", right: "auto", bottom: "auto" });
  const hw = Math.max(200, k * cx / (h - cy) - 36);
  st.querySelectorAll(".ib-sec").forEach((el, i) => {
    const o = order[i];
    if (o === "c") Object.assign(el.style, { top: `${cy + k}px`, height: `${h - cy - k - 18}px`, width: `${hw * 2}px`, left: `${cx - hw}px`, right: "auto", bottom: "auto" });
    else side(el, o === "a");
  });
  Object.assign($("ibHub").style, { left: `${cx}px`, top: `${cy}px` });
}
addEventListener("resize", () => { if (!$("ibStar").hidden) ibStarLayout(); });

async function ibStarLoad() {
  const sec = (k) => $("ibStar").querySelector(`.ib-sec[data-sec="${k}"]`);
  const fill = (k, n, sub, rows) => {
    const el = sec(k);
    el.querySelector("[data-n]").textContent = n ?? "";
    el.querySelector("[data-s]").textContent = sub || "";
    el.querySelector("[data-l]").innerHTML = rows.join("");
  };
  const [cm, ms, bt] = await Promise.allSettled([api("/api/inbox/comments"), api("/api/inbox/conversations"), api("/api/bots")]);
  if (cm.status === "fulfilled") {
    ib.posts = cm.value.posts || [];
    const total = ib.posts.reduce((n, x) => n + (x.comments || 0), 0);
    fill("comments", total || "", ib.posts.length ? `على ${ib.posts.length} منشور` : "لا توجد تعليقات بعد",
      ib.posts.slice(0, 3).map((x) => `<li data-pick="${escapeHtml(x.id)}"><span>${escapeHtml(x.content || "(بدون كابشن)")}</span><em>${x.comments || 0}</em></li>`));
  } else fill("comments", "", cm.reason?.message || "", []);
  if (ms.status === "fulfilled") {
    ib.convs = ms.value.conversations || [];
    const unread = ib.convs.reduce((n, c) => n + (c.unread || 0), 0);
    fill("messages", unread || ib.convs.length || "", unread ? "لم تُقرأ بعد" : ib.convs.length ? "محادثات" : "لا توجد رسائل بعد",
      ib.convs.slice(0, 3).map((c) => `<li data-pick="${escapeHtml(c.id)}" class="${c.unread ? "unread" : ""}"><b>${escapeHtml(c.name || "—")}</b><span>${escapeHtml(c.last || "")}</span></li>`));
  } else fill("messages", "", ms.reason?.message || "", []);
  if (bt.status === "fulfilled" && bt.value.live) {
    const bots = bt.value.bots || [], on = bots.filter((b) => b.status === "active").length;
    fill("bots", on || "", bots.length ? (on ? "يعمل الآن" : "كلها متوقفة") : "لا توجد ردود تلقائية بعد",
      bots.slice(0, 3).map((b) => `<li><span>${escapeHtml(b.name)}</span><em class="${b.status === "active" ? "ok" : ""}">${b.status === "active" ? "يعمل" : "متوقف"}</em></li>`));
  } else fill("bots", "", bt.status === "fulfilled" ? bt.value.note || "" : bt.reason?.message || "", []);
}

function ibOpenSec(sec, pick = "") {
  $("ibStar").hidden = true; $("ibWork").hidden = false; $("ibSet").hidden = true;
  ibGoTab(sec, true).then(() => { if (pick) (sec === "comments" ? ibOpenPost : ibOpenConv)(pick); });
}
$("ibStar").addEventListener("click", (e) => {
  if (e.target.closest("#ibHub")) return ibSettings();
  const t = e.target.closest("[data-sec]");
  if (t) ibOpenSec(t.dataset.sec, e.target.closest("[data-pick]")?.dataset.pick || "");
});
// لما الماوس على قسم، التلت بتاعه بينوّر
$("ibStar").addEventListener("pointerover", (e) => {
  const t = e.target.closest("[data-sec]")?.dataset.sec || "";
  $("ibY").querySelectorAll("polygon").forEach((p) => p.classList.toggle("on", p.dataset.sec === t));
});
$("ibStar").addEventListener("pointerleave", () => $("ibY").querySelectorAll("polygon").forEach((p) => p.classList.remove("on")));
$("ibBack").onclick = () => { ibAlert(""); ibStarShow(); };

// ---------- ⚙️ الإعدادات (من النص) ----------
const ibSetS = { bid: null, mode: "ask", word: "", accounts: [] };
async function ibSettings() {
  const box = $("ibSet");
  box.hidden = false;
  box.innerHTML = `<div class="ib-set-in"><p class="empty">جارٍ التحميل…</p></div>`;
  try {
    const brains = await api("/api/ad-brains");
    const b = (Array.isArray(brains) ? brains : []).find((x) => x.id === clientx?.active) || (Array.isArray(brains) ? brains[0] : null) || {};
    const pub = await api("/api/publisher").catch(() => ({}));
    Object.assign(ibSetS, { bid: b.id, mode: b.dm_mode || (String(b.dm_word || "").trim() ? "always" : "ask"), word: b.dm_word || "", accounts: pub.account_list || [], names: pub.platforms || {} });
  } catch (err) { box.innerHTML = `<div class="ib-set-in"><p class="empty err">${escapeHtml(err.message)}</p></div>`; return; }
  ibSetRender();
}
function ibSetRender() {
  const S = ibSetS, pill = (k, t) => `<button type="button" class="ib-pill${S.mode === k ? " on" : ""}" data-dm="${k}">${t}</button>`;
  $("ibSet").innerHTML = `<div class="ib-set-in">
      <header><b>الإعدادات</b><button type="button" class="ib-x" data-setx aria-label="إغلاق">✕</button></header>
      <section><h4>«علّق بكلمة» فتصله رسالة على الخاص</h4>
        <div class="ib-pills">${pill("always", "في كل منشور")}${pill("ask", "أختار عند النشر")}${pill("off", "لا")}</div>
        <label class="ib-fl">كلمة التعليق<input type="text" id="ibSetWord" value="${escapeHtml(S.word)}" placeholder="مثلًا: برنامج"></label></section>
      <section><h4>الحسابات المربوطة</h4>
        <ul class="ib-accs">${S.accounts.map((a) => `<li><span>${escapeHtml(S.names[a.platform] || a.platform)}</span><small dir="ltr">${escapeHtml(a.username ? "@" + a.username : a.name || "")}</small></li>`).join("") || `<li class="muted">لا توجد حسابات مربوطة بعد.</li>`}</ul>
        <button type="button" class="ib-act" data-setacc>إدارة الحسابات ←</button></section>
      <div class="ib-set-go"><button type="button" class="ib-go" data-setsave>احفظ</button></div></div>`;
}
$("ibSet").addEventListener("click", async (e) => {
  const q = (s) => e.target.closest(s);
  if (q("[data-setx]") || e.target === $("ibSet")) { $("ibSet").hidden = true; return; }
  if (q("[data-dm]")) { ibSetS.word = $("ibSetWord").value; ibSetS.mode = q("[data-dm]").dataset.dm; return ibSetRender(); }
  if (q("[data-setacc]")) { $("ibSet").hidden = true; showStep("7"); if (typeof pubTab === "function") pubTab("acc"); return; }
  if (q("[data-setsave]")) {
    const btn = q("[data-setsave]");
    btn.disabled = true;
    try {
      await api(`/api/ad-brains/${encodeURIComponent(ibSetS.bid)}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { dm_mode: ibSetS.mode, dm_word: $("ibSetWord").value.trim() } }) });
      $("ibSet").hidden = true;
      toast("✅ حُفظت الإعدادات");
    } catch (err) { btn.disabled = false; toast(err.message, true); }
  }
});

async function ibLoad(reset = false) {
  if (ib.loading) return;
  ib.loading = true;
  try {
    const comments = ib.tab === "comments";
    const d = await api(`/api/inbox/${comments ? "comments" : "conversations"}${!reset && ib.next ? `?cursor=${encodeURIComponent(ib.next)}` : ""}`);
    const rows = comments ? d.posts : d.conversations;
    if (comments) ib.posts = reset ? rows : [...ib.posts, ...rows];
    else ib.convs = reset ? rows : [...ib.convs, ...rows];
    ib.next = d.next;
    $("ibNote").textContent = d.failed?.length ? `تعذّرت قراءة من: ${d.failed.join(" · ")}` : "";
    ibRenderList();
  } catch (err) {
    ib.posts = []; ib.convs = []; ib.next = null;
    ibRenderList();
    const settings = /Zernio/.test(err.message) && /الإعدادات/.test(err.message);
    ibAlert(`⚠️ ${escapeHtml(err.message)}${settings ? "" : /Inbox/.test(err.message) ? ` · <a href="https://zernio.com/dashboard" target="_blank" rel="noopener">لوحة Zernio ↗</a>` : ""}`);
  } finally {
    ib.loading = false;
  }
}

function ibRenderList() {
  const comments = ib.tab === "comments";
  const rows = comments ? ib.posts : ib.convs;
  $("ibList").innerHTML = rows.map((x) => comments
    ? `<li data-id="${escapeHtml(x.id)}" class="${ib.sel === x.id ? "on" : ""}">
        ${x.picture ? `<img class="ib-thumb" src="${escapeHtml(x.picture)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<i class="ib-thumb">${IB_ICON[x.platform] || "•"}</i>`}
        <span class="ib-li"><span class="ib-top"><span class="ib-plat">${escapeHtml(IB_NAME[x.platform] || x.platform || "")}${x.account ? ` · @${escapeHtml(x.account)}` : ""}</span><small>${x.created_at ? ntfAgo(x.created_at) : ""}</small></span>
          <span class="ib-snip">${escapeHtml(x.content || "(بدون كابشن)")}</span>
          <span class="ib-count">${ibCount(x.comments)}</span></span></li>`
    : `<li data-id="${escapeHtml(x.id)}" class="${ib.sel === x.id ? "on" : ""}${x.unread ? " unread" : ""}">
        ${ibAv(x.picture, x.name)}
        <span class="ib-li"><span class="ib-top"><span class="ib-plat">${escapeHtml(IB_NAME[x.platform] || x.platform || "")}</span><small>${x.updated_at ? ntfAgo(x.updated_at) : ""}</small></span>
          <b class="ib-name">${escapeHtml(x.name || "—")}</b>
          <span class="ib-snip">${escapeHtml(x.last || "")}</span>
          ${x.unread ? `<span class="ib-unread">${x.unread}</span>` : ""}${x.request ? `<span class="ib-req">طلب رسالة</span>` : ""}</span></li>`).join("");
  $("ibMore").hidden = !ib.next;
  // العدد جنب اسم التاب
  if (comments) $("ibNC").textContent = rows.length || ""; else $("ibNM").textContent = rows.reduce((n, c) => n + (c.unread || 0), 0) || rows.length || "";
  const empty = !rows.length && $("inboxAlert").hidden;
  $("ibEmpty").hidden = !empty;
  $("ibEmpty").textContent = comments ? "لا توجد تعليقات بعد على منشورات الحسابات المربوطة." : "لا توجد رسائل بعد.";
}

// ---------- الكومنتات ----------
const ibWaiting = (c) => !c.mine && !(c.replies || []).some((r) => r.mine);

async function ibOpenPost(id, quiet = false) {
  const p = ib.posts.find((x) => x.id === id);
  if (!p) return;
  ib.sel = id; ib.post = p;
  if (!quiet) { ib.comments = []; ib.triage = null; }
  ibRenderList();
  if (!quiet) $("ibThread").innerHTML = `<p class="empty">جارٍ تحميل التعليقات…</p>`;
  try {
    ib.comments = await api(`/api/inbox/comments/${encodeURIComponent(p.id)}?account_id=${encodeURIComponent(p.account_id)}`);
    if (ib.sel === id) ibRenderPost();
  } catch (err) {
    $("ibThread").innerHTML = `<p class="empty err">${escapeHtml(err.message)}</p>`;
  }
}

function ibCommentHTML(c, reply = false) {
  const tg = !reply && ib.triage ? ib.triage[c.id] : null;
  return `<div class="ib-c${reply ? " reply" : ""}${c.mine ? " mine" : ""}" data-cid="${escapeHtml(c.id)}">
      ${ibAv(c.picture, c.name)}
      <div class="ib-cb">
        <div class="ib-top"><b>${escapeHtml(c.mine ? "أنت" : c.name || c.username || "—")}</b><small>${c.created_at ? ntfAgo(c.created_at) : ""}</small>
          ${c.hidden ? `<span class="ib-req">مخفي</span>` : ""}${!reply && ibWaiting(c) ? `<span class="ib-wait">ينتظر الرد</span>` : ""}
          ${!reply && tg ? `<span class="ib-tg t-${tg.type}">${escapeHtml(tg.label)}</span>` : ""}</div>
        <p dir="auto">${escapeHtml(c.text)}</p>
        ${!reply && !c.mine && c.can_reply !== false && !(tg && tg.reply) ? `<button type="button" class="ib-act" data-reply="${escapeHtml(c.id)}">رد</button>` : ""}
        ${(c.replies || []).map((r) => ibCommentHTML(r, true)).join("")}
        <div class="ib-slot">${!reply && tg && tg.reply && ibWaiting(c) ? ibComposer(`c:${c.id}`, tg.reply) : ""}
          ${!reply && tg && tg.dm ? `<div class="ib-dm"><small>✉️ رسالة خاصة مقترحة (انسخها وأرسلها من الرسائل):</small><p dir="auto">${escapeHtml(tg.dm)}</p>
            <button type="button" class="btn sm" data-copy="${escapeHtml(tg.dm)}">📋 انسخ</button></div>` : ""}</div>
      </div></div>`;
}

function ibRenderPost() {
  const p = ib.post;
  const list = ib.onlyWaiting ? ib.comments.filter(ibWaiting) : ib.comments;
  const waiting = ib.comments.filter(ibWaiting).length;
  $("ibThread").innerHTML = `<div class="ib-post">
      <h3 class="ib-cap" dir="auto">${escapeHtml(p.content || "(بدون كابشن)")}</h3>
      ${p.url ? `<a class="ib-open" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">افتح المنشور ↗</a>` : ""}
      <label class="ib-filter"><input type="checkbox" id="ibOnlyWaiting" ${ib.onlyWaiting ? "checked" : ""}> ما ينتظر ردًا فقط${waiting ? ` (${waiting})` : ""}</label></div>
    ${waiting ? `<div class="ib-triage">
      <button type="button" class="ib-go" id="ibTriage">✨ جهّز ردودًا لـ ${waiting === 1 ? "تعليق واحد" : `${waiting} تعليقات`}</button>
      ${ib.triage ? `<small class="muted">${ibTriageSummary()} · راجع كل رد واضغط «إرسال»، أو عدّله أولًا.</small>`
        : `<button type="button" class="ib-act" id="ibTOpt">${ib.topt ? "إخفاء الخيارات" : "كلمة الـ CTA والرسالة الخاصة"}</button>`}
      <div class="ib-topt"${ib.topt && !ib.triage ? "" : " hidden"}><input type="text" id="ibKw" placeholder="كلمة الـ CTA، مثلًا: دليل" value="${escapeHtml(ib.tkw)}">
        <input type="text" id="ibDm" placeholder="ماذا تقول الرسالة الخاصة؟ مثلًا: رابط الدليل" value="${escapeHtml(ib.tdm)}"></div></div>` : ""}
    <div class="ib-comments">${list.map((c) => ibCommentHTML(c)).join("") || `<p class="empty">${ib.onlyWaiting ? "✅ رددت على كل التعليقات" : "لا توجد تعليقات"}</p>`}</div>`;
}

// صندوق الرد: بيتحط تحت الكومنت (أو فوق لو كومنت جديد على البوست)
function ibTriageSummary() {
  const cnt = {};
  Object.values(ib.triage || {}).forEach((t) => { cnt[t.label] = (cnt[t.label] || 0) + 1; });
  return Object.entries(cnt).map(([k, v]) => `${k} ${v}`).join(" · ");
}

async function ibRunTriage(btn) {
  ib.tkw = $("ibKw").value.trim(); ib.tdm = $("ibDm").value.trim();
  const coms = ib.comments.filter(ibWaiting).map((c) => ({ id: c.id, name: c.name || c.username || "", text: c.text }));
  btn.disabled = true; btn.textContent = "⏳ جارٍ الترتيب…";
  try {
    const r = await api("/api/inbox/triage", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post: ib.post.content || "", platform: ib.post.platform || "", keyword: ib.tkw, dm_hint: ib.tdm, comments: coms }) });
    ib.triage = Object.fromEntries(r.items.map((x) => [x.id, x]));
    ibRenderPost();
  } catch (err) { toast(err.message, true); btn.disabled = false; btn.textContent = "جرّب مرة أخرى"; }
}

function ibComposer(target, text = "") {
  return `<div class="ib-compose" data-target="${escapeHtml(target)}">
      <textarea rows="2" placeholder="اكتب الرد… أو اضغط «اقترح ردًا»" dir="auto">${escapeHtml(text)}</textarea>
      <input type="text" class="ib-hint" hidden placeholder="ماذا تريد أن يقول الرد؟ مثلًا: الحجز من الرابط في السيرة">
      <div class="row">
        <button type="button" class="ib-sug" data-sug>اقترح ردًا</button>
        <button type="button" class="ib-act" data-hint>وجّه الاقتراح</button>
        <span class="spacer"></span>
        <button type="button" class="ib-cancel" data-cancel>إلغاء</button>
        <button type="button" class="ib-send" data-send>إرسال</button>
      </div></div>`;
}

async function ibSuggest(box, payload) {
  const btn = box.querySelector("[data-sug]");
  const ta = box.querySelector("textarea");
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = "جارٍ الكتابة…";
  try {
    const { reply } = await api("/api/inbox/suggest", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, hint: box.querySelector(".ib-hint")?.value || "", previous: box.dataset.prev || "" }),
    });
    ta.value = reply;
    box.dataset.prev = reply;
    btn.textContent = "اقترح مرة أخرى";
    ta.focus();
  } catch (err) {
    btn.textContent = label;
    toast(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

// ---------- الرسايل ----------
async function ibOpenConv(id, quiet = false) {
  const c = ib.convs.find((x) => x.id === id);
  if (!c) return;
  ib.sel = id;
  if (!quiet) ib.messages = [];
  c.unread = 0;
  ibRenderList();
  if (!quiet) $("ibThread").innerHTML = `<p class="empty">جارٍ تحميل المحادثة…</p>`;
  try {
    ib.messages = await api(`/api/inbox/conversations/${encodeURIComponent(c.id)}/messages?account_id=${encodeURIComponent(c.account_id)}`);
    if (ib.sel === id) ibRenderConv(c);
  } catch (err) {
    $("ibThread").innerHTML = `<p class="empty err">${escapeHtml(err.message)}</p>`;
  }
}

function ibRenderConv(c) {
  const att = (a) => a.type === "image" || a.type === "sticker" ? `<img src="${escapeHtml(a.url || "")}" alt="" referrerpolicy="no-referrer">`
    : a.url ? `<a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">📎 ${escapeHtml(a.type || "ملف")}</a>` : "";
  $("ibThread").innerHTML = `<div class="ib-chathead">${ibAv(c.picture, c.name)}<b>${escapeHtml(c.name || "")}</b>${ibPl(c.platform)}
      ${c.url ? `<a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">افتح ↗</a>` : ""}</div>
    <div class="ib-chat" id="ibChat">${ib.messages.map((m) => `<div class="ib-msg ${m.mine ? "mine" : ""}">
        ${m.text ? `<p dir="auto">${escapeHtml(m.text)}</p>` : ""}${(m.attachments || []).map(att).join("")}
        <small>${m.created_at ? ntfAgo(m.created_at) : ""}${m.mine && m.status === "failed" ? " · ✕ لم تصل" : ""}</small></div>`).join("") || `<p class="empty">لا توجد رسائل</p>`}</div>
    ${ibComposer("conv")}`;
  const chat = $("ibChat");
  chat.scrollTop = chat.scrollHeight;
}

// ---------- الأحداث ----------
async function ibGoTab(t, force = false) {
  if (!force && t === ib.tab) return;
  ib.tab = t;
  ib.sel = null; ib.next = null;
  $("ibTabs").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.t === t));
  // 🤖 الردود التلقائية: بوت بيرد على التعليقات والرسائل لوحده
  const bots = ib.tab === "bots";
  $("ibBots").hidden = !bots; $("ibLayout").hidden = bots; $("ibNote").hidden = bots;
  ibAlert("");
  if (bots) { $("ibBots").innerHTML = BotsPage.html(); return BotsPage.mount($("ibBots")); }
  $("ibThread").innerHTML = `<p class="empty">اختر ${ib.tab === "comments" ? "منشورًا" : "محادثة"} من القائمة.</p>`;
  await ibLoad(true);
}
$("ibTabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-t]");
  if (b) ibGoTab(b.dataset.t);
});
// 🔄 بيتحدّث لوحده كل دقيقة وهو مفتوح (من غير زرار «حدّث»)، وماينطّش لو بيكتب رد
setInterval(() => {
  const v = document.querySelector('.view[data-view="15"]');
  if (!v || v.hidden || document.hidden || ib.loading) return;
  if (!$("ibStar").hidden) return ibStarLoad();
  if (ib.tab === "bots") return;
  if ([...$("ibThread").querySelectorAll(".ib-compose textarea")].some((t) => t.value.trim()) || $("ibThread").contains(document.activeElement)) return;
  ibLoad(true).then(() => { if (!ib.sel) return; if (ib.tab === "comments") ibOpenPost(ib.sel, true); else ibOpenConv(ib.sel, true); });
}, 60000);
$("ibMore").onclick = () => ibLoad(false);
$("ibList").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-id]");
  if (!li) return;
  (ib.tab === "comments" ? ibOpenPost : ibOpenConv)(li.dataset.id);
  // على الموبايل المحادثة بتبقى تحت القايمة
  if (innerWidth <= 900) $("ibThread").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("ibThread").addEventListener("change", (e) => {
  if (e.target.id === "ibOnlyWaiting") { ib.onlyWaiting = e.target.checked; ibRenderPost(); }
});

$("ibThread").addEventListener("click", async (e) => {
  if (e.target.closest("#ibTriage")) return ibRunTriage(e.target.closest("#ibTriage"));
  if (e.target.closest("#ibTOpt")) { ib.tkw = $("ibKw").value.trim(); ib.tdm = $("ibDm").value.trim(); ib.topt = !ib.topt; return ibRenderPost(); }
  const hb = e.target.closest("[data-hint]");
  if (hb) { const h = hb.closest(".ib-compose").querySelector(".ib-hint"); h.hidden = !h.hidden; if (!h.hidden) h.focus(); return; }
  const cp = e.target.closest("[data-copy]");
  if (cp) { try { await navigator.clipboard.writeText(cp.dataset.copy); toast("✅ نُسخت"); } catch { toast("تعذّر النسخ", true); } return; }
  const rep = e.target.closest("[data-reply]");
  if (rep) {
    $("ibThread").querySelectorAll(".ib-compose:not([data-target=conv])").forEach((x) => x.remove());
    const slot = rep.closest(".ib-c").querySelector(":scope > .ib-cb > .ib-slot");
    slot.innerHTML = ibComposer(`c:${rep.dataset.reply}`);
    slot.querySelector("textarea").focus();
    return;
  }
  const box = e.target.closest(".ib-compose");
  if (!box) return;
  const target = box.dataset.target;
  if (e.target.closest("[data-cancel]")) {
    if (target === "conv") { box.querySelector("textarea").value = ""; delete box.dataset.prev; box.querySelector("[data-sug]").textContent = "اقترح ردًا"; }
    else box.remove();
    return;
  }
  if (e.target.closest("[data-sug]")) {
    if (target === "conv") {
      const c = ib.convs.find((x) => x.id === ib.sel);
      const last = [...ib.messages].reverse().find((m) => !m.mine && m.text);
      if (!last) return toast("لا توجد رسالة منه للرد عليها", true);
      return ibSuggest(box, { kind: "message", text: last.text, platform: c?.platform || "", history: ib.messages.slice(-10).map((m) => ({ mine: m.mine, text: m.text })) });
    }
    const com = ib.comments.find((x) => x.id === target.slice(2));
    if (!com) return;
    return ibSuggest(box, { kind: "comment", text: com.text, platform: ib.post.platform, post: ib.post.content || "" });
  }
  const send = e.target.closest("[data-send]");
  if (send) {
    const text = box.querySelector("textarea").value.trim();
    if (!text) return toast("اكتب الرد أولًا", true);
    send.disabled = true;
    try {
      if (target === "conv") {
        const c = ib.convs.find((x) => x.id === ib.sel);
        await api(`/api/inbox/conversations/${encodeURIComponent(c.id)}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: c.account_id, message: text }) });
        ib.messages.push({ id: "", text, mine: true, created_at: new Date().toISOString(), attachments: [] });
        c.last = text; c.updated_at = new Date().toISOString();
        ibRenderConv(c);
        ibRenderList();
      } else {
        const cid = target.slice(2);
        await api(`/api/inbox/comments/${encodeURIComponent(ib.post.id)}/reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: ib.post.account_id, comment_id: cid, message: text }) });
        const mine = { id: "", text, mine: true, created_at: new Date().toISOString(), replies: [], name: "" };
        const com = ib.comments.find((x) => x.id === cid);
        if (com) (com.replies ||= []).push(mine);
        ibRenderPost();
      }
      toast("✅ أُرسل");
    } catch (err) {
      send.disabled = false;
      toast(err.message, true);
    }
  }
});

viewHooks["15"] = initInbox;
