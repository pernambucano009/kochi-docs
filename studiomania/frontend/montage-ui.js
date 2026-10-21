// 🎬 شكل المونتاج الهادي (زي البروتوتايب): الأدوات أيقونات بس والاسم في فقاعة، كارت الأداة بيظهر وقت الحاجة بس،
// أدوات التايم لاين أيقونات، والتراكات مدموجة في مجموعات (دبل كليك على اسم المجموعة بيفردها، ودبل كليك تاني يلمّها)،
// والتايبوجرافي بقت اختيار جوه الكابشن (التايبوجرافي الـ3D بتاعتنا بكل تحكمها).
(() => {
  const ed = document.getElementById("montage");
  if (!ed) return;
  const insp = ed.querySelector(".ed-inspector");
  const tabs = document.getElementById("inspTabs");
  const $id = (x) => document.getElementById(x);

  // ---------- الفقاعة السودا (واحدة للمونتاج كله، مابتتقصّش جوه الكروت) ----------
  const tip = document.createElement("div");
  tip.className = "mtu-tip";
  document.body.append(tip);
  let tipEl = null;
  const showTip = (el) => {
    const t = el.dataset.tip;
    if (!t) return;
    tipEl = el;
    tip.textContent = t;
    tip.classList.add("on");
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    const side = el.closest("#inspTabs");
    let x = side ? r.left - w - 10 : r.left + r.width / 2 - w / 2, y = side ? r.top + r.height / 2 - h / 2 : r.top - h - 8;
    if (side && x < 8) x = r.right + 10;
    if (!side && y < 8) y = r.bottom + 8;
    tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, x))}px`;
    tip.style.top = `${Math.max(8, y)}px`;
  };
  const hideTip = () => { tipEl = null; tip.classList.remove("on"); };
  document.addEventListener("pointerover", (e) => {
    const el = e.target.closest?.("#montage [data-tip]");
    if (el && el !== tipEl) showTip(el); else if (!el && tipEl) hideTip();
  }, { passive: true });
  document.addEventListener("pointerdown", hideTip, { passive: true });

  // ---------- الأدوات: أيقونة بس، والاسم في الفقاعة ----------
  const clean = (s) => s.replace(/[\u{1F000}-\u{1FFFF}☀-➿️]/gu, "").replace(/\s+/g, " ").trim();
  tabs.querySelectorAll("button[data-tab]").forEach((b) => { b.dataset.tip = clean(b.textContent); b.setAttribute("aria-label", b.dataset.tip); });
  tabs.querySelector('[data-tab="typo"]')?.setAttribute("hidden", "");   // بقت جوه الكابشن

  // ---------- كارت الأداة: بيظهر لما تختار أداة، وبيستخبى لما تدوس عليها تاني أو تقفله ----------
  const close = document.createElement("button");
  close.type = "button";
  close.className = "mtu-x";
  close.setAttribute("aria-label", "اقفل");
  close.textContent = "×";
  insp.append(close);
  const isOpen = () => insp.classList.contains("mtu-open");
  function closePanel() {
    insp.classList.remove("mtu-open");
    tabs.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    insp.querySelectorAll(".pane").forEach((p) => (p.hidden = true));
    if (mt?.project) updatePreviewOverlays();
  }
  close.onclick = closePanel;
  const _showTab = showTab;
  // eslint-disable-next-line no-global-assign
  showTab = function (tab) {
    if (tab === "typo") { tab = "caps"; setCapMode("typo", false); }
    _showTab(tab);
    insp.classList.add("mtu-open");
    insp.querySelector(`.pane[data-pane="${tab}"]`)?.animate?.([{ opacity: 0, transform: "scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" });
    if (tab === "caps") syncCapMode();
  };
  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]");
    if (b && b.classList.contains("active") && isOpen()) { e.stopImmediatePropagation(); closePanel(); }
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen() && !e.target.closest("input, textarea, select")) closePanel(); });
  // أول ما المونتاج يفتح: الكارت مقفول والمعاينة واخدة مكانها
  const _init = viewHooks["6"];
  viewHooks["6"] = async (...a) => { const r = await _init?.(...a); closePanel(); syncCapMode(); groups(); return r; };
  closePanel();

  // دوسة على أي حاجة في التايم لاين (حتى على خط الصوت اللي جوه القطعة) بتفتح كارتها لو الكارت مقفول
  $id("tlCanvas")?.addEventListener("pointerdown", (e) => {
    const x0 = e.clientX, y0 = e.clientY;
    addEventListener("pointerup", (u) => {
      if (Math.hypot(u.clientX - x0, u.clientY - y0) > 6 || isOpen() || !mt?.sel || !e.target.closest(".tl-clip, .tl-audio, .tl-cap, .tl-typo, .tl-text, .tl-over, .tl-fx, [data-ti], [data-ty]")) return;
      if (typeof focusPane === "function") focusPane(mt.sel);
    }, { once: true });
  });

  // ---------- التايبوجرافي اختيار جوه الكابشن ----------
  const capPane = insp.querySelector('.pane[data-pane="caps"]');
  const seg = document.createElement("div");
  seg.className = "mtu-seg";
  seg.innerHTML = `<button type="button" data-capmode="plain">كابشن عادي</button><button type="button" data-capmode="typo">تايبوجرافي 3D</button>`;
  const typoBox = document.createElement("div");
  typoBox.className = "mtu-typo";
  typoBox.hidden = true;
  const typoPane = $id("mtTypoPane");
  if (typoPane) typoBox.append(typoPane);
  capPane.prepend(seg);
  capPane.append(typoBox);
  const capMode = () => {
    const d = mt?.project?.data;
    if (!d) return "plain";
    if (d.cap_mode) return d.cap_mode;
    return typeof mtx !== "undefined" && mtx.doc?.blocks?.length && d.typo_on !== false && !d.captions?.enabled ? "typo" : "plain";
  };
  function syncCapMode() {
    const m = capMode();
    seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.capmode === m));
    typoBox.hidden = m !== "typo";
    capPane.querySelectorAll(":scope > label.switch, :scope > #capOpts").forEach((x) => (x.hidden = m === "typo"));
    if (m === "typo" && typeof mtTypoPaneRender === "function") mtTypoPaneRender();
  }
  function setCapMode(m, user = true) {
    const d = mt?.project?.data;
    if (!d) return;
    if (d.cap_mode !== m) {
      d.cap_mode = m;
      const on = $id("capOn");
      // عادي = الكابشن شغال والتايبوجرافي مستخبية، والعكس (عشان الكلام مايظهرش مرتين)
      if (on && on.checked !== (m === "plain")) { on.checked = m === "plain"; on.dispatchEvent(new Event("change", { bubbles: true })); }
      d.typo_on = m === "typo";
      if (typeof scheduleSave === "function") scheduleSave();
      if (typeof mtTypoDraw === "function") mtTypoDraw();
      if (typeof renderTimeline === "function") renderTimeline();
      if (user && m === "typo" && typeof toast === "function" && !(typeof mtx !== "undefined" && mtx.doc?.blocks?.length)) toast("دوس «وزّع التايبوجرافي» عشان الكلام يتحوّل لتايبوجرافي 3D");
    }
    syncCapMode();
  }
  seg.addEventListener("click", (e) => { const b = e.target.closest("[data-capmode]"); if (b) setCapMode(b.dataset.capmode); });

  // ---------- أدوات التايم لاين: أيقونات بس ----------
  const S = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const IC = {
    tlUndo: S('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
    tlRedo: S('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'),
    tlSplit: S('<path d="M12 3v18M8 7l-4 5 4 5M16 7l4 5-4 5"/>'),
    tlDelete: S('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    tlDelLeft: S('<path d="M4 5v14M20 12H9M13 8l-4 4 4 4"/>'),
    tlDelRight: S('<path d="M20 5v14M4 12h11M11 8l4 4-4 4"/>'),
    tlMarker: S('<path d="M6 21V4M6 4h11l-2.5 4L17 12H6"/>'),
    tlBeat: S('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
    tlSilence: S('<path d="M3 12h3l2-5 3 10 2-5h3M19 9v6M22 10v4"/>'),
    tlPrevFrame: S('<path d="M7 5v14M18 6l-8 6 8 6z"/>'),
    tlNextFrame: S('<path d="M17 5v14M6 6l8 6-8 6z"/>'),
    tlZoomOut: S('<circle cx="11" cy="11" r="7"/><path d="M8 11h6M21 21l-5-5"/>'),
    tlZoomIn: S('<circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6M21 21l-5-5"/>'),
    tlFit: S('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    select: S('<path d="M5 3l14 7-6 2-2 6z"/>'),
    blade: S('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/>'),
  };
  const bar = ed.querySelector(".ed-timeline .tl-toolbar");
  bar?.querySelectorAll("button").forEach((b) => {
    const k = b.id || b.dataset.tool;
    if (!IC[k]) return;
    b.dataset.tip = clean(b.title || b.textContent);
    b.removeAttribute("title");
    b.setAttribute("aria-label", b.dataset.tip);
    b.innerHTML = IC[k];
    b.classList.add("mtu-ic");
  });
  const keys = ed.querySelector(".ed-timeline .tl-keys");
  if (keys && bar) {
    const k = document.createElement("button");
    k.type = "button"; k.className = "ic mtu-ic"; k.dataset.tip = keys.textContent.trim();
    k.innerHTML = S('<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>');
    bar.append(k);
  }

  // ---------- التراكات المدموجة ----------
  // الترتيب: الطبقات والفيديو، الصوت (تعليق + موسيقى + أصوات)، النصوص، العناصر، الكابشن (+ التايبوجرافي وكليكاتها)
  const heads = ed.querySelector(".tl-heads"), canvas = $id("tlCanvas");
  const ORDER = [["h-over", "trkOver"], ["h-video", "trkVideo"], ["h-voice", "trkVoice"], ["h-music", "trkMusic"], ["h-snd", "trkSnd"],
    ["h-text", "trkText"], ["h-fx", "trkFx"], ["h-caps", "trkCaps"], ["h-typo", "trkTypo"], ["h-click", "trkClick"]];
  const ruler = $id("tlRuler");
  let after = ruler, afterH = heads.querySelector(".h-ruler");
  for (const [h, r] of ORDER) {
    const hd = heads.querySelector("." + h), row = $id(r);
    if (!hd || !row) continue;
    afterH.after(hd); after.after(row);
    afterH = hd; after = row;
  }
  const GROUPS = { video: ["h-video", "h-over"], audio: ["h-voice", "h-music", "h-snd"], caps: ["h-caps", "h-typo", "h-click"] };
  const NAMES = { "h-over": "طبقات", "h-video": "فيديو", "h-voice": "تعليق", "h-music": "موسيقى", "h-snd": "أصوات", "h-text": "نصوص", "h-caps": "كابشن", "h-typo": "تايبوجرافي", "h-click": "كليكات", "h-fx": "عناصر" };
  const KEY = "studiomania.mtGroups";
  let openG = {};
  try { openG = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { openG = {}; }
  const rowOf = (h) => $id(ORDER.find((x) => x[0] === h)?.[1]);
  const empty = (row) => !row || !row.children.length || [...row.children].every((c) => c.classList.contains("tl-empty-track"));
  // اسم التراك من غير إيموجي، والإيموجي بتاع الأزرار الصغيرة بيفضل
  heads.querySelectorAll(":scope > div").forEach((d) => {
    const cls = [...d.classList].find((c) => NAMES[c]);
    if (!cls || d.querySelector(".mtu-nm")) return;
    [...d.childNodes].forEach((n) => { if (n.nodeType === 3) n.remove(); });
    const nm = document.createElement("span");
    nm.className = "mtu-nm"; nm.textContent = NAMES[cls];
    d.prepend(nm);
  });
  function groups() {
    // التراك الفاضي بيبقى خط صغير (مش واخد مكان تراك كامل)
    for (const [h, r] of ORDER) {
      const row = $id(r), hd = heads.querySelector("." + h), e = empty(row);
      row?.classList.toggle("mtu-empty", e); hd?.classList.toggle("mtu-empty", e);
    }
    for (const [g, hs] of Object.entries(GROUPS)) {
      const open = !!openG[g];
      const [main, ...rest] = hs;
      const mh = heads.querySelector("." + main);
      if (!mh) continue;
      const extra = rest.filter((h) => !empty(rowOf(h)));
      mh.classList.add("mtu-gh");
      mh.classList.toggle("mtu-closed", !open && extra.length > 0);
      mh.dataset.more = !open && extra.length ? `+${extra.length}` : "";
      mh.dataset.tip = open ? "دبل كليك يلمّ التراكات دي في خط واحد" : extra.length ? `فيها كمان: ${extra.map((h) => NAMES[h]).join("، ")} · دبل كليك يفردهم` : "";
      for (const h of rest) {
        const hd = heads.querySelector("." + h), row = rowOf(h);
        const mini = !open, gone = !open && empty(row);
        [hd, row].forEach((x) => { if (!x) return; x.classList.toggle("mtu-mini", mini && !gone); x.classList.toggle("mtu-gone", gone); });
      }
    }
  }
  heads.addEventListener("dblclick", (e) => {
    const d = e.target.closest(".tl-heads > div");
    if (!d || e.target.closest("[data-flag]")) return;
    const cls = [...d.classList].find((c) => NAMES[c]);
    const g = Object.entries(GROUPS).find(([, hs]) => hs.includes(cls))?.[0];
    if (!g) return;
    openG[g] = !openG[g];
    try { localStorage.setItem(KEY, JSON.stringify(openG)); } catch { }
    groups();
  });
  // كل ما التايم لاين يترسم من جديد (تراكات بتتملا أو تفضى)
  if (typeof renderTimeline === "function") {
    const _rt = renderTimeline;
    // eslint-disable-next-line no-global-assign
    renderTimeline = function (...a) { const r = _rt.apply(this, a); groups(); return r; };
  }
  groups();
})();
