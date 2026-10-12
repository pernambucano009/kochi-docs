// StudioMania — 🔔 جرس الإشعارات: تصدير خلص أو فشل، بوست اتنشر أو فشل، أوتوبايلوت خلص أو وقف.
// بيسأل السيرفر كل شوية. الجديد بيظهر رسالة صغيرة، ولو الصفحة مش قدامك بيوصل كإشعار على الجهاز (لو سمحت بده).

const ntf = { items: [], unread: 0, newest: null, timer: null, open: false };
const NTF_EVERY = 20000;

function ntfAgo(iso) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  if (m < 1) return "دلوقتي";
  if (m < 60) return m === 1 ? "من دقيقة" : `من ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? "من ساعة" : `من ${h} ساعة`;
  return new Date(iso).toLocaleDateString(UI_LOCALE(), { weekday: "short", day: "numeric", month: "short" });
}

const NTF_BELLS = "#bellBtn, #nhBell, #stageBell";

function ntfBadge() {
  document.querySelectorAll(NTF_BELLS).forEach((b) => {
    const n = b.querySelector(".bell-n");
    n.hidden = !ntf.unread;
    n.textContent = ntf.unread > 99 ? "99+" : String(ntf.unread);
    b.classList.toggle("has", ntf.unread > 0);
  });
}

async function ntfPoll() {
  clearTimeout(ntf.timer);
  try {
    const d = await api("/api/notifications");
    const first = ntf.newest === null;
    const fresh = first ? [] : d.items.filter((x) => !x.read && x.created_at > ntf.newest);
    ntf.items = d.items;
    ntf.unread = d.unread;
    ntf.newest = d.items[0]?.created_at || ntf.newest || "";
    ntfBadge();
    if (ntf.open) { ntfRender(); ntfPlace($("bellPanel"), ntf.anchor); }
    // الأقدم الأول، وبحد أقصى 3 رسايل عشان مايبقاش زحمة
    for (const x of fresh.slice(0, 3).reverse()) {
      toast(`${x.level === "bad" ? "✕" : "🔔"} ${x.title}`, x.level === "bad");
      ntfDevice(x);
    }
  } catch {
    // السيرفر مش بيرد دلوقتي: نحاول تاني بعدين
  }
  ntf.timer = setTimeout(ntfPoll, document.hidden ? NTF_EVERY * 3 : NTF_EVERY);
}

function ntfDevice(x) {
  if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) return;
  try {
    const n = new Notification(x.title, { body: x.body || "", tag: x.id });
    n.onclick = () => { window.focus(); ntfGo(x); n.close(); };
  } catch {}
}

function ntfRender() {
  const box = $("bellPanel");
  const canAsk = "Notification" in window && Notification.permission === "default";
  box.innerHTML = `<div class="ntf-head"><b>الإشعارات</b>
      ${ntf.unread ? `<button type="button" class="btn sm" data-n="readall">✓ علّم الكل اتقرا</button>` : ""}
      ${ntf.items.length ? `<button type="button" class="btn sm" data-n="clear" title="امسح كل الإشعارات">🗑️</button>` : ""}</div>
    ${canAsk ? `<button type="button" class="ntf-ask" data-n="ask">🔔 وصّلّي الإشعارات على الجهاز حتى لو الصفحة مقفولة</button>` : ""}
    <ul class="ntf-list">${ntf.items.map((x) => `<li class="${x.read ? "" : "unread"} ${x.level}" data-id="${x.id}">
        <i class="ntf-ic">${x.level === "bad" ? "✕" : x.kind === "autopilot" ? "🤖" : x.kind === "render" ? "🎬" : "✓"}</i>
        <span class="ntf-txt"><b>${escapeHtml(x.title)}</b>${x.body ? `<small>${escapeHtml(x.body)}</small>` : ""}<small class="ntf-ago">${ntfAgo(x.created_at)}</small></span>
      </li>`).join("") || `<li class="ntf-empty">مفيش إشعارات لسه. هيوصلك هنا لما فيديو يخلص تصدير أو بوست يتنشر.</li>`}</ul>`;
}

// اللوحة بتفتح جنب الجرس اللي اتداس (في الشريط الجانبي أو فوق في الرئيسية)
function ntfPlace(box, anchor) {
  const r = anchor?.getBoundingClientRect();
  const w = box.offsetWidth, h = box.offsetHeight, pad = 16;
  let left, top;
  if (!r || !r.width) { left = pad; top = pad; }
  else if (r.top < 120 && r.width < innerWidth / 2 && anchor.id !== "bellBtn" || innerWidth <= 640) {
    top = r.bottom + 8;                            // تحت الجرس
    left = document.dir === "rtl" ? r.right - w : r.left;
  } else {
    top = Math.min(r.top, innerHeight - h - pad);  // جنب الشريط الجانبي
    left = document.dir === "rtl" ? r.left - w - 12 : r.right + 12;
  }
  box.style.left = `${Math.max(pad, Math.min(left, innerWidth - w - pad))}px`;
  box.style.top = `${Math.max(pad, Math.min(top, innerHeight - h - pad))}px`;
}

function ntfToggle(open = !ntf.open, anchor = null) {
  ntf.open = open;
  let box = $("bellPanel");
  if (!box) {
    box = document.createElement("div");
    box.id = "bellPanel";
    box.className = "ntf-panel";
    box.setAttribute("role", "dialog");
    document.body.appendChild(box);
    box.addEventListener("click", ntfClick);
  }
  box.hidden = !open;
  document.querySelectorAll(NTF_BELLS).forEach((b) => b.setAttribute("aria-expanded", String(open && b === anchor)));
  if (open) {
    ntf.anchor = anchor;
    ntfRender();
    ntfPlace(box, anchor);
    ntfPoll();
// الرئيسية بتتبني بعد الملف ده، فنحدّث العداد عليها لما تظهر
new MutationObserver(() => { if (document.getElementById("nhBell") && !document.getElementById("nhBell").dataset.ntf) { document.getElementById("nhBell").dataset.ntf = 1; ntfBadge(); } })
  .observe(document.body, { childList: true, subtree: true });
  }
}

async function ntfRead(ids) {
  await api("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
}

function ntfGo(x) {
  if (x.link) showStep(x.link);
}

async function ntfClick(e) {
  const b = e.target.closest("[data-n]");
  try {
    if (b?.dataset.n === "readall") {
      await ntfRead(null);
      return ntfPoll();
// الرئيسية بتتبني بعد الملف ده، فنحدّث العداد عليها لما تظهر
new MutationObserver(() => { if (document.getElementById("nhBell") && !document.getElementById("nhBell").dataset.ntf) { document.getElementById("nhBell").dataset.ntf = 1; ntfBadge(); } })
  .observe(document.body, { childList: true, subtree: true });
    }
    if (b?.dataset.n === "clear") {
      if (!confirm("تمسح كل الإشعارات؟")) return;
      await api("/api/notifications", { method: "DELETE" });
      return ntfPoll();
// الرئيسية بتتبني بعد الملف ده، فنحدّث العداد عليها لما تظهر
new MutationObserver(() => { if (document.getElementById("nhBell") && !document.getElementById("nhBell").dataset.ntf) { document.getElementById("nhBell").dataset.ntf = 1; ntfBadge(); } })
  .observe(document.body, { childList: true, subtree: true });
    }
    if (b?.dataset.n === "ask") {
      await Notification.requestPermission();
      return ntfRender();
    }
  } catch (err) {
    return toast(err.message, true);
  }
  const li = e.target.closest("li[data-id]");
  if (!li) return;
  const x = ntf.items.find((i) => i.id === li.dataset.id);
  if (!x) return;
  if (!x.read) ntfRead([x.id]).then(ntfPoll).catch(() => {});
  ntfToggle(false);
  ntfGo(x);
}

document.addEventListener("click", (e) => {
  const bell = e.target.closest(NTF_BELLS);
  if (bell) return ntfToggle(!(ntf.open && ntf.anchor === bell), bell);
  if (ntf.open && !e.target.closest("#bellPanel")) ntfToggle(false);
});
window.addEventListener("resize", () => ntf.open && ntfPlace($("bellPanel"), ntf.anchor));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ntf.open) ntfToggle(false);
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) ntfPoll();
// الرئيسية بتتبني بعد الملف ده، فنحدّث العداد عليها لما تظهر
new MutationObserver(() => { if (document.getElementById("nhBell") && !document.getElementById("nhBell").dataset.ntf) { document.getElementById("nhBell").dataset.ntf = 1; ntfBadge(); } })
  .observe(document.body, { childList: true, subtree: true });
});
ntfPoll();
// الرئيسية بتتبني بعد الملف ده، فنحدّث العداد عليها لما تظهر
new MutationObserver(() => { if (document.getElementById("nhBell") && !document.getElementById("nhBell").dataset.ntf) { document.getElementById("nhBell").dataset.ntf = 1; ntfBadge(); } })
  .observe(document.body, { childList: true, subtree: true });
