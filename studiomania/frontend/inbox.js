// StudioMania — 💬 التعليقات والرسائل: نصّين (الرسائل يمين، والتعليقات شمال)، وبينهم ترس «إعدادات الرد الآلي».
// كل حاجة جاية من الحسابات المربوطة، والرد بيتكتب ويتبعت من هنا (مش من المنصة). «اقترح ردًا» بيكتب رد بصوت العلامة ولهجة اللي كتب.

const ib = { posts: [], convs: [], comments: [], conv: null, messages: [], open: "", loading: false };
const IB_NAME = { instagram: "إنستجرام", facebook: "فيسبوك", tiktok: "تيك توك", youtube: "يوتيوب", twitter: "X", x: "X", threads: "ثريدز", linkedin: "لينكدإن", telegram: "تيليجرام", whatsapp: "واتساب", bluesky: "بلوسكاي", reddit: "ريديت", snapchat: "سناب شات" };
// أيقونة المنصة (خط بسيط بلون الكلام)
const IB_SVG = {
  instagram: `<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r=".9" class="f"/>`,
  facebook: `<path d="M14 21v-7.5h2.6l.4-3H14V8.6c0-.9.3-1.5 1.6-1.5H17V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.7 1.4-3.7 3.9v2.3H8.4v3H11V21"/>`,
  tiktok: `<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5 M14 3c.4 2.6 2.1 4.2 5 4.4"/>`,
  youtube: `<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.2v5.6l4.8-2.8z" class="f"/>`,
  x: `<path d="M4 4l16 16 M20 4L4 20"/>`, twitter: `<path d="M4 4l16 16 M20 4L4 20"/>`,
  threads: `<path d="M16.5 8.5C15.6 6.3 13.9 5 11.8 5 8.6 5 6.5 7.8 6.5 12s2.1 7 5.5 7c2.8 0 4.8-1.7 4.8-4.2 0-2.3-1.8-3.6-4.3-3.6-2 0-3.3 1-3.3 2.4s1.2 2.2 2.6 2.2c2.4 0 3.4-2 3.4-5"/>`,
  linkedin: `<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7 M8 7v.1 M12 17v-4.2c0-1.6 1-2.6 2.3-2.6s2 .9 2 2.6V17 M12 10v7"/>`,
  snapchat: `<path d="M12 3.5c2.9 0 4.6 2.2 4.6 4.9v2.1l1.8-.5-.5 1.6-1.6.7c.7 1.6 2 2.8 3.6 3.2-.7.9-2.1 1-2.8 1.1l-.4 1.4-1.9-.2c-.9.7-1.8 1.7-2.8 1.7s-1.9-1-2.8-1.7l-1.9.2-.4-1.4c-.7-.1-2.1-.2-2.8-1.1 1.6-.4 2.9-1.6 3.6-3.2l-1.6-.7-.5-1.6 1.8.5V8.4c0-2.7 1.7-4.9 4.6-4.9z"/>`,
  whatsapp: `<path d="M4 20l1.3-4A8 8 0 1 1 8.4 19z"/><path d="M9.3 8.6c.3 2.6 2.4 5 5.4 5.9l1.1-1.2-1.6-.9-.8.8c-1.2-.5-2.2-1.5-2.7-2.7l.8-.8-.9-1.6z" class="f"/>`,
};
const ibPlat = (k) => `<i class="ib-plat" title="${escapeHtml(IB_NAME[k] || k || "")}"><svg viewBox="0 0 24 24" aria-hidden="true">${IB_SVG[k] || `<circle cx="12" cy="12" r="8"/>`}</svg></i>`;
const ibAv = (pic, name) => {
  const ch = escapeHtml((name || "?").trim()[0] || "?");
  return pic ? `<i class="ib-av">${ch}<img src="${escapeHtml(pic)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"></i>` : `<i class="ib-av">${ch}</i>`;
};
const ibPostIc = (p) => `<i class="ib-post-ic" title="${escapeHtml(p?.content || "المنشور")}">${p?.picture ? `<img src="${escapeHtml(p.picture)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M10 9.5v5l4-2.5z"/></svg></i>`;
const ibWaiting = (c) => !c.mine && !(c.replies || []).some((r) => r.mine);
const half = (k) => $("ibDuo").querySelector(`[data-half="${k}"]`);

$("inboxAlert").addEventListener("click", (e) => { if (e.target.closest("[data-linkacc]")) { e.preventDefault(); showStep("7"); if (typeof pubTab === "function") pubTab("acc"); } });
function ibAlert(msg) {
  const a = $("inboxAlert");
  a.hidden = !msg;
  a.innerHTML = msg || "";
}

// ⚙️ الترس: سنّاته مرسومة بخط واحد، والسنيك البرتقالي بيلف على السنّات نفسها (مش دايرة)
(function gear() {
  // سنّات بزوايا مدوّرة: كل ركن في السنّة بيتقفل بمنحنى (Q) بدل زاوية حادة، والقوس بين السنّات نقط متقاربة
  const n = 8, R = 44, r = 33, cx = 50, cy = 50, step = (Math.PI * 2) / n, tw = step * 0.2, bw = step * 0.3, rad = 4.2;
  const P = (rr, a) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  const pts = [];   // [x, y, يتدوّر؟]
  for (let i = 0; i < n; i++) {
    const a = i * step - Math.PI / 2;
    pts.push([...P(r, a - bw), 1], [...P(R, a - tw), 1], [...P(R, a + tw), 1], [...P(r, a + bw), 1]);
    for (let k = 1; k < 4; k++) pts.push([...P(r, a + bw + ((step - 2 * bw) * k) / 4), 0]);
  }
  const f = (v) => v.toFixed(2), m = pts.length;
  const toward = (p, q, d) => { const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, t = Math.min(d, L / 2) / L; return [p[0] + dx * t, p[1] + dy * t]; };
  let d = "";
  pts.forEach((p, i) => {
    const prev = pts[(i - 1 + m) % m], next = pts[(i + 1) % m];
    if (!p[2]) { d += `${i ? "L" : "M"}${f(p[0])} ${f(p[1])} `; return; }
    const a = toward(p, prev, rad), b = toward(p, next, rad);
    d += `${i ? "L" : "M"}${f(a[0])} ${f(a[1])} Q${f(p[0])} ${f(p[1])} ${f(b[0])} ${f(b[1])} `;
  });
  $("ibGear").querySelectorAll("[data-gear]").forEach((p) => p.setAttribute("d", d + "Z"));
})();

async function initInbox() {
  ibAlert("");
  $("ibDuo").hidden = false; $("ibBotSet").hidden = true;
  window.NHBar?.();
  // ⚡ آخر بيانات اتشافت بتظهر على طول، والجديد بيتجاب في الخلفية
  if (ib.seen) { ib.conv = null; ibRenderConvs(); ibRenderComments(); half("messages").querySelector("[data-n]").textContent = ib.nM; half("comments").querySelector("[data-n]").textContent = ib.nC; }
  await ibLoadAll();
}

// ---------- التحميل: الرسائل، والتعليقات (من آخر المنشورات اللي عليها تعليقات) ----------
async function ibLoadAll(quiet = false) {
  if (ib.loading) return;
  ib.loading = true;
  try {
    const [cm, ms, pub] = await Promise.allSettled([api("/api/inbox/comments"), api("/api/inbox/conversations"), api("/api/publisher?fresh=0")]);
    const linked = pub.status === "fulfilled" ? (pub.value.account_list || []).length : 1;
    ibAlert(linked ? "" : `يجب ربط حساب سوشيال ميديا واحد على الأقل لتفعيل التعليقات والرسائل. <a href="#" data-linkacc>اربط حسابًا ←</a>`);
    // الرسائل
    if (ms.status === "fulfilled") {
      ib.convs = ms.value.conversations || [];
      half("messages").querySelector("[data-n]").textContent = ib.nM = ib.convs.length;
      if (!ib.conv) ibRenderConvs();
      else if (!quiet) ibOpenConv(ib.conv.id);
    } else ibErr("messages", ms.reason);
    // التعليقات: تعليقات آخر المنشورات (لحد ٨ منشورات) في قايمة واحدة، الأحدث فوق
    if (cm.status === "fulfilled") {
      ib.posts = cm.value.posts || [];
      half("comments").querySelector("[data-n]").textContent = ib.nC = ib.posts.reduce((n, p) => n + (p.comments || 0), 0);
      const withC = ib.posts.filter((p) => p.comments > 0).slice(0, 8);
      const lists = await Promise.allSettled(withC.map((p) => api(`/api/inbox/comments/${encodeURIComponent(p.id)}?account_id=${encodeURIComponent(p.account_id)}`)));
      const all = [];
      lists.forEach((r, i) => { if (r.status === "fulfilled") (r.value || []).filter((c) => !c.mine).forEach((c) => all.push({ ...c, post: withC[i] })); });
      all.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
      // اللي فاتح صندوق رد عليه بيفضل فاتح
      ib.comments = all; ib.seen = true;
      if (!$("ibDuo").querySelector('[data-half="comments"] .ib-compose textarea')?.value.trim()) ibRenderComments();
    } else ibErr("comments", cm.reason);
  } finally { ib.loading = false; }
}
function ibErr(k, err) {
  half(k).querySelector("[data-n]").textContent = 0;
  half(k).querySelector("[data-body]").innerHTML = `<p class="empty">${escapeHtml(err?.message || "")}</p>`;
}

// ---------- التعليقات ----------
function ibRenderComments() {
  const body = half("comments").querySelector("[data-body]");
  body.innerHTML = ib.comments.length ? `<ul class="ib-rows">${ib.comments.map((c) => `<li class="ib-row${ib.open === `c:${c.id}` ? " open" : ""}" data-cid="${escapeHtml(c.id)}">
      <div class="ib-rmain">${ibAv(c.picture, c.name || c.username)}
        <div class="ib-rtext"><div class="ib-rtop"><b>${escapeHtml(c.name || c.username || "—")}</b><small>${c.created_at ? ntfAgo(c.created_at) : ""}</small>${ibWaiting(c) ? `<span class="ib-wait">ينتظر الرد</span>` : ""}</div>
          <p dir="auto">${escapeHtml(c.text)}</p>
          ${(c.replies || []).filter((r) => r.mine).map((r) => `<p class="ib-mine" dir="auto">↩ ${escapeHtml(r.text)}</p>`).join("")}</div>
        ${ibPlat(c.post?.platform)}${ibPostIc(c.post)}</div>
      ${ib.open === `c:${c.id}` ? ibComposer(`c:${c.id}`) : ""}</li>`).join("")}</ul>`
    : `<p class="empty">لا توجد تعليقات بعد.</p>`;
}

// ---------- الرسائل ----------
function ibRenderConvs() {
  const body = half("messages").querySelector("[data-body]");
  body.innerHTML = ib.convs.length ? `<ul class="ib-rows">${ib.convs.map((c) => `<li class="ib-row${c.unread ? " unread" : ""}" data-conv="${escapeHtml(c.id)}">
      <div class="ib-rmain">${ibAv(c.picture, c.name)}
        <div class="ib-rtext"><div class="ib-rtop"><b>${escapeHtml(c.name || "—")}</b><small>${c.updated_at ? ntfAgo(c.updated_at) : ""}</small>${c.unread ? `<span class="ib-unread">${c.unread}</span>` : ""}${c.request ? `<span class="ib-wait">طلب رسالة</span>` : ""}</div>
          <p dir="auto">${escapeHtml(c.last || "")}</p></div>
        ${ibPlat(c.platform)}</div></li>`).join("")}</ul>`
    : `<p class="empty">لا توجد رسائل بعد.</p>`;
}
async function ibOpenConv(id) {
  const c = ib.convs.find((x) => x.id === id);
  if (!c) return;
  ib.conv = c; c.unread = 0;
  const body = half("messages").querySelector("[data-body]");
  if (!ib.messages.length || ib.messages._id !== id) body.innerHTML = `<p class="empty">جارٍ تحميل المحادثة…</p>`;
  try {
    ib.messages = await api(`/api/inbox/conversations/${encodeURIComponent(c.id)}/messages?account_id=${encodeURIComponent(c.account_id)}`);
    ib.messages._id = id;
    if (ib.conv?.id === id) ibRenderChat();
  } catch (err) { body.innerHTML = `<p class="empty">${escapeHtml(err.message)}</p>`; }
}
function ibRenderChat() {
  const c = ib.conv;
  const att = (a) => a.type === "image" || a.type === "sticker" ? `<img src="${escapeHtml(a.url || "")}" alt="" referrerpolicy="no-referrer">`
    : a.url ? `<a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">📎 ${escapeHtml(a.type || "ملف")}</a>` : "";
  half("messages").querySelector("[data-body]").innerHTML = `<div class="ib-chathead"><button type="button" class="ib-act" data-convback>‹ كل الرسائل</button>
      ${ibAv(c.picture, c.name)}<b>${escapeHtml(c.name || "")}</b>${ibPlat(c.platform)}</div>
    <div class="ib-chat">${ib.messages.map((m) => `<div class="ib-msg ${m.mine ? "mine" : ""}">
        ${m.text ? `<p dir="auto">${escapeHtml(m.text)}</p>` : ""}${(m.attachments || []).map(att).join("")}
        <small>${m.created_at ? ntfAgo(m.created_at) : ""}${m.mine && m.status === "failed" ? " · ✕ لم تصل" : ""}</small></div>`).join("") || `<p class="empty">لا توجد رسائل</p>`}</div>
    ${ibComposer("conv")}`;
  const chat = half("messages").querySelector(".ib-chat");
  chat.scrollTop = chat.scrollHeight;
}

// ---------- صندوق الرد ----------
function ibComposer(target, text = "") {
  return `<div class="ib-compose" data-target="${escapeHtml(target)}">
      <textarea rows="2" placeholder="اكتب الرد… أو اضغط «اقترح ردًا»" dir="auto">${escapeHtml(text)}</textarea>
      <input type="text" class="ib-hint" hidden placeholder="ماذا تريد أن يقول الرد؟ مثلًا: الحجز من الرابط في السيرة">
      <div class="row">
        <button type="button" class="ib-sug" data-sug>اقترح ردًا</button>
        <button type="button" class="ib-act" data-hint>وجّه الاقتراح</button>
        <span class="spacer"></span>
        ${target === "conv" ? "" : `<button type="button" class="ib-cancel" data-cancel>إلغاء</button>`}
        <button type="button" class="ib-send" data-send>إرسال</button>
      </div></div>`;
}
async function ibSuggest(box, payload) {
  const btn = box.querySelector("[data-sug]"), ta = box.querySelector("textarea"), label = btn.textContent;
  btn.disabled = true; btn.textContent = "جارٍ الكتابة…";
  try {
    const { reply } = await api("/api/inbox/suggest", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, hint: box.querySelector(".ib-hint")?.value || "", previous: box.dataset.prev || "" }) });
    ta.value = reply; box.dataset.prev = reply; btn.textContent = "اقترح مرة أخرى"; ta.focus();
  } catch (err) { btn.textContent = label; toast(err.message, true); }
  finally { btn.disabled = false; }
}

// ---------- الأحداث ----------
$("ibDuo").addEventListener("click", async (e) => {
  const q = (s) => e.target.closest(s);
  if (q("#ibGear")) return ibBotSettings();
  if (q("[data-convback]")) { ib.conv = null; ib.messages = []; return ibRenderConvs(); }
  const hb = q("[data-hint]");
  if (hb) { const h = hb.closest(".ib-compose").querySelector(".ib-hint"); h.hidden = !h.hidden; if (!h.hidden) h.focus(); return; }
  const box = q(".ib-compose");
  if (box) {
    const target = box.dataset.target;
    if (q("[data-cancel]")) { ib.open = ""; return ibRenderComments(); }
    if (q("[data-sug]")) {
      if (target === "conv") {
        const last = [...ib.messages].reverse().find((m) => !m.mine && m.text);
        if (!last) return toast("لا توجد رسالة منه للرد عليها", true);
        return ibSuggest(box, { kind: "message", text: last.text, platform: ib.conv?.platform || "", history: ib.messages.slice(-10).map((m) => ({ mine: m.mine, text: m.text })) });
      }
      const com = ib.comments.find((x) => x.id === target.slice(2));
      return com && ibSuggest(box, { kind: "comment", text: com.text, platform: com.post?.platform || "", post: com.post?.content || "" });
    }
    const send = q("[data-send]");
    if (send) {
      const text = box.querySelector("textarea").value.trim();
      if (!text) return toast("اكتب الرد أولًا", true);
      send.disabled = true;
      try {
        if (target === "conv") {
          const c = ib.conv;
          await api(`/api/inbox/conversations/${encodeURIComponent(c.id)}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: c.account_id, message: text }) });
          ib.messages.push({ id: "", text, mine: true, created_at: new Date().toISOString(), attachments: [] });
          c.last = text; c.updated_at = new Date().toISOString();
          ibRenderChat();
        } else {
          const com = ib.comments.find((x) => x.id === target.slice(2));
          await api(`/api/inbox/comments/${encodeURIComponent(com.post.id)}/reply`, { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ account_id: com.post.account_id, comment_id: com.id, message: text }) });
          (com.replies ||= []).push({ id: "", text, mine: true, created_at: new Date().toISOString() });
          ib.open = "";
          ibRenderComments();
        }
        toast("✅ أُرسل");
      } catch (err) { send.disabled = false; toast(err.message, true); }
    }
    return;
  }
  const cv = q("[data-conv]");
  if (cv) return ibOpenConv(cv.dataset.conv);
  const cr = q("[data-cid]");
  if (cr && !q("a")) {
    ib.open = ib.open === `c:${cr.dataset.cid}` ? "" : `c:${cr.dataset.cid}`;
    ibRenderComments();
    half("comments").querySelector(".ib-compose textarea")?.focus();
  }
});

// ---------- 🤖 إعدادات الرد الآلي (صفحة جوه التعليقات والرسائل) ----------
function ibBotSettings() {
  $("ibDuo").hidden = true; $("ibBotSet").hidden = false; ibAlert("");
  $("ibBots").innerHTML = BotsPage.html();
  BotsPage.mount($("ibBots"));
  window.NHBar?.();
}
// «رجوع» اللي فوق: من الإعدادات للتعليقات والرسائل (مش للرئيسية)، والتسلسل فيه «إعدادات الرد الآلي»
window.stageSubBack = () => {
  const v = document.querySelector('.view[data-view="15"]');
  if (!v || v.hidden || $("ibBotSet").hidden) return false;
  initInbox();
  return true;
};
window.stageSubLabel = (cur) => (cur === "15" && !$("ibBotSet").hidden ? "إعدادات الرد الآلي" : "");

// 🔄 بيتحدّث لوحده كل دقيقة وهو مفتوح، وماينطّش لو بيكتب رد
setInterval(() => {
  const v = document.querySelector('.view[data-view="15"]');
  if (!v || v.hidden || document.hidden || $("ibDuo").hidden) return;
  if ([...$("ibDuo").querySelectorAll(".ib-compose textarea")].some((t) => t.value.trim()) || $("ibDuo").contains(document.activeElement)) return;
  ibLoadAll(true);
}, 60000);

viewHooks["15"] = initInbox;
