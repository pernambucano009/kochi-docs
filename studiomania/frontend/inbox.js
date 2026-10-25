// StudioMania — 💬 صندوق الردود: الكومنتات والرسايل من الحسابات المربوطة في Zernio.
// تختار بوست أو محادثة، تقرا، و«✨ اقترح رد» بيكتب رد بصوت البراند ونفس لهجة اللي كتب. انت تعدّله وتبعته.

const ib = { tab: "comments", posts: [], convs: [], next: null, sel: null, post: null, comments: [], messages: [], loading: false, onlyWaiting: false, triage: null, tkw: "", tdm: "" };
const IB_ICON = { instagram: "◎", facebook: "f", tiktok: "♪", youtube: "▶", twitter: "𝕏", x: "𝕏", threads: "@", linkedin: "in", telegram: "✈", whatsapp: "✆", bluesky: "🦋", reddit: "◉" };
const IB_NAME = { instagram: "إنستجرام", facebook: "فيسبوك", tiktok: "تيك توك", youtube: "يوتيوب", twitter: "X", x: "X", threads: "ثريدز", linkedin: "لينكدإن", telegram: "تيليجرام", whatsapp: "واتساب", bluesky: "بلوسكاي", reddit: "ريديت" };
const ibCount = (n) => (n === 1 ? "تعليق واحد" : n === 2 ? "كومنتين" : `${n} تعليقات`);
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
  if (ib.tab === "bots") { $("ibBots").innerHTML = BotsPage.html(); return BotsPage.mount($("ibBots")); }
  await ibLoad(true);
}

async function ibLoad(reset = false) {
  if (ib.loading) return;
  ib.loading = true;
  $("ibRefresh").disabled = true;
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
    $("ibRefresh").disabled = false;
  }
}

function ibRenderList() {
  const comments = ib.tab === "comments";
  const rows = comments ? ib.posts : ib.convs;
  $("ibList").innerHTML = rows.map((x) => comments
    ? `<li data-id="${escapeHtml(x.id)}" class="${ib.sel === x.id ? "on" : ""}">
        ${x.picture ? `<img class="ib-thumb" src="${escapeHtml(x.picture)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<i class="ib-thumb">${IB_ICON[x.platform] || "•"}</i>`}
        <span class="ib-li"><span class="ib-top"><span class="ib-plat">${escapeHtml(IB_NAME[x.platform] || x.platform || "")}${x.account ? ` · @${escapeHtml(x.account)}` : ""}</span><small>${x.created_at ? ntfAgo(x.created_at) : ""}</small></span>
          <span class="ib-snip">${escapeHtml(x.content || "(بدون تعليق نصي)")}</span>
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
  $("ibEmpty").textContent = comments ? "لا يوجد تعليقات ما زال على المنشورات التي على الحسابات المربوطة." : "لا يوجد رسائل ما زال.";
}

// ---------- الكومنتات ----------
const ibWaiting = (c) => !c.mine && !(c.replies || []).some((r) => r.mine);

async function ibOpenPost(id) {
  const p = ib.posts.find((x) => x.id === id);
  if (!p) return;
  ib.sel = id; ib.post = p; ib.comments = []; ib.triage = null;
  ibRenderList();
  $("ibThread").innerHTML = `<p class="empty">يُحمّل التعليقات…</p>`;
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
          ${c.hidden ? `<span class="ib-req">مخفي</span>` : ""}${!reply && ibWaiting(c) ? `<span class="ib-wait">ينتظر رد</span>` : ""}
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
      <h3 class="ib-cap" dir="auto">${escapeHtml(p.content || "(بدون تعليق نصي)")}</h3>
      ${p.url ? `<a class="ib-open" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">افتح المنشور ↗</a>` : ""}
      <label class="ib-filter"><input type="checkbox" id="ibOnlyWaiting" ${ib.onlyWaiting ? "checked" : ""}> ما ينتظر ردًا فقط${waiting ? ` (${waiting})` : ""}</label></div>
    ${waiting ? `<div class="ib-triage">
      <b>🧠 رتّب التعليقات وجهّز ردودًا</b>
      <div class="row wrap"><input type="text" id="ibKw" placeholder="(اختياري) كلمة الدعوة لاتخاذ إجراء، مثلًا: دليل" value="${escapeHtml(ib.tkw)}">
        <input type="text" id="ibDm" placeholder="(اختياري) ماذا تقول الرسالة الخاصة؟ مثلًا: رابط الدليل" value="${escapeHtml(ib.tdm)}">
        <button type="button" class="btn sm primary" id="ibTriage">رتّب ${waiting} ${waiting === 1 ? "تعليق" : "تعليقات"}</button></div>
      ${ib.triage ? `<small class="muted">${ibTriageSummary()} · راجع كل رد واضغط «إرسال»، أو عدّله أولًا.</small>` : ""}</div>` : ""}
    <div class="ib-comments">${list.map((c) => ibCommentHTML(c)).join("") || `<p class="empty">${ib.onlyWaiting ? "✅ رديت على كل التعليقات" : "لا يوجد تعليقات"}</p>`}</div>`;
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
      <textarea rows="2" placeholder="اكتب الرد… أو اضغط «اقترح رد»" dir="auto">${escapeHtml(text)}</textarea>
      <input type="text" class="ib-hint" placeholder="(اختياري) تريد الرد يقول ماذا؟ مثلًا: الحجز من الرابط في السيرة">
      <div class="row">
        <button type="button" class="btn sm ib-sug" data-sug>اقترح رد</button>
        <span class="spacer"></span>
        <button type="button" class="btn sm ib-cancel" data-cancel>إلغاء</button>
        <button type="button" class="btn sm primary ib-send" data-send>إرسال</button>
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
    btn.textContent = "اقتراح مرة أخرى";
    ta.focus();
  } catch (err) {
    btn.textContent = label;
    toast(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

// ---------- الرسايل ----------
async function ibOpenConv(id) {
  const c = ib.convs.find((x) => x.id === id);
  if (!c) return;
  ib.sel = id; ib.messages = [];
  c.unread = 0;
  ibRenderList();
  $("ibThread").innerHTML = `<p class="empty">يُحمّل المحادثة…</p>`;
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
        <small>${m.created_at ? ntfAgo(m.created_at) : ""}${m.mine && m.status === "failed" ? " · ✕ لم تصل" : ""}</small></div>`).join("") || `<p class="empty">لا يوجد رسائل</p>`}</div>
    ${ibComposer("conv")}`;
  const chat = $("ibChat");
  chat.scrollTop = chat.scrollHeight;
}

// ---------- الأحداث ----------
$("ibTabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-t]");
  if (!b || b.dataset.t === ib.tab) return;
  ib.tab = b.dataset.t;
  ib.sel = null; ib.next = null;
  $("ibTabs").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
  // 🤖 البوتات: تبويب جوه التعليقات والرسائل (بوت بيرد عليهم لوحده)
  const bots = ib.tab === "bots";
  $("ibBots").hidden = !bots; $("ibLayout").hidden = bots; $("ibRefresh").hidden = bots; $("ibNote").hidden = bots;
  if (bots) { ibAlert(""); $("ibBots").innerHTML = BotsPage.html(); return BotsPage.mount($("ibBots")); }
  $("ibThread").innerHTML = `<p class="empty">اختر ${ib.tab === "comments" ? "منشور" : "محادثة"} من القائمة.</p>`;
  ibAlert("");
  ibLoad(true);
});
$("ibRefresh").onclick = () => { ibAlert(""); ibLoad(true); if (ib.sel) (ib.tab === "comments" ? ibOpenPost : ibOpenConv)(ib.sel); };
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
    if (target === "conv") { box.querySelector("textarea").value = ""; delete box.dataset.prev; box.querySelector("[data-sug]").textContent = "اقترح رد"; }
    else box.remove();
    return;
  }
  if (e.target.closest("[data-sug]")) {
    if (target === "conv") {
      const c = ib.convs.find((x) => x.id === ib.sel);
      const last = [...ib.messages].reverse().find((m) => !m.mine && m.text);
      if (!last) return toast("لا يوجد رسالة منه نرد عليها", true);
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
