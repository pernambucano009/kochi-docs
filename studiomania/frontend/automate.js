// 🤖 القالب المخصص: بنفس شكل خريطة العقل (النقط والخطوط والزوم والكارت)، بس الخطوات خط واحد من الشمال لليمين:
// «▶ ابدأ» على الشمال، وبعدها الخطوات اللي العميل بيضيفها (فعل + منشن من «مكتبة العقل»)، و«＋» قبل «صدّر»، وآخر حاجة «انشر».
// كل اختيار في الخطوة نقطة فوقها (النوع، منين، العدد…). «ابدأ» بيشغّل القالب ويطلّع الفيديو ويصدّره وينشره.
const AutoPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, list: [], id: null, rec: null, meta: null, lib: null, open: null, raf: 0, nodes: [], t0: performance.now(), timer: null };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const AR_N = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
  const IC = {
    pull: "M4.5 5h15a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M3.5 15.5l4.5-4.5 4 4 3-3 5 5 M15.5 8.5a1.3 1.3 0 1 1 0 .1z",
    intro: "M5 4.5v15l13-7.5z",
    outro: "M5 5h14v14H5z M9 9h6v6H9z",
    voice: "M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z M6 11a6 6 0 0 0 12 0 M12 17v3.5",
    music: "M9 17.5V6l10-2v11.5 M9 17.5a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 9 17.5z M19 15.5a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 19 15.5z",
    cut: "M6.5 8.5a2.5 2.5 0 1 0 0-.1z M6.5 18a2.5 2.5 0 1 0 0-.1z M8.6 9.6 20 18 M8.6 16.4 20 6",
    caption: "M4 6h16v12H4z M7.5 13.5h4 M13.5 13.5h3 M7.5 10.5h9",
    export: "M12 15V3.5 M7.5 8 12 3.5 16.5 8 M4.5 14v5.5h15V14",
    publish: "M20.5 3.5 10 14 M20.5 3.5 14 20.5l-4-6.5-6.5-4z",
    split: "M3.5 12h5 M8.5 12 14 6.5h6 M8.5 12 14 17.5h6 M8.5 12H20",
    gen: "M12 3.5l1.9 5.4 5.6 1.9-5.6 1.9L12 18.1l-1.9-5.4-5.6-1.9 5.6-1.9z M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z",
    merge: "M3.5 6.5h5L14 12l-5.5 5.5h-5 M3.5 12H20 M16.5 9 20 12l-3.5 3",
    genimg: "M4.5 5h15a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M3.5 15.5l4.5-4.5 4 4 3-3 5 5 M16 7l.8 1.9 1.9.8-1.9.8L16 12.4l-.8-1.9-1.9-.8 1.9-.8z",
    genvoice: "M10 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z M4 11a6 6 0 0 0 12 0 M10 17v3.5 M18.5 4l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z",
    piece: "M5 4.5h14v15H5z M5 9h14 M5 15h14 M8 4.5v4.5 M16 15v4.5",
  };
  const svg = (d, s = 22) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const KIND_T = { image: "صور", video: "فيديوهات", any: "صور وفيديوهات", audio: "صوت" };
  const aAPI = (path = "", opts) => api(`/api/automations/${S.id}${path}`, opts);

  // ---------- الخطوات ← فروع ونقط ----------
  function leavesOf(s) {
    const o = s.opts, M = S.meta, stk = s.src?.mode === "stock", src = s.src ? (stk ? s.src.label : `@${s.src.label || (s.src.mode === "folder" ? "المكتبة" : "")}`) : "";
    const srcLeaf = { f: "src", t: "منين", val: src ? `${src}${s.found != null ? ` · ${AR_N(s.found)} ملف` : ""}` : "", miss: !s.src || (!stk && !s.found) };
    const L = {
      pull: o.type === "audio"
        ? [{ f: "type", t: "النوع", val: KIND_T[o.type] }, srcLeaf, { f: "role", t: "يتحط إزاي", val: M.roles?.[o.role] || "" },
          ...(o.role === "voice" ? [] : [{ f: "volume", t: "علو الصوت", val: `${AR_N(o.volume)}٪` }, { f: "duck", t: "توطى وقت الكلام", val: o.duck ? "أيوه" : "لأ" }]),
          { f: "order", t: "أنهي ملف", val: M.orders[o.order] }]
        : [{ f: "type", t: "النوع", val: KIND_T[o.type] }, srcLeaf, { f: "count", t: "العدد", val: AR_N(o.count) }, { f: "order", t: "الترتيب", val: M.orders[o.order] },
          { f: "sec", t: "مدة الصورة", val: `${AR_N(o.sec)} ث` }],
      intro: [srcLeaf], outro: [srcLeaf],
      voice: [srcLeaf, { f: "fit", t: "الفيديو على قد التعليق", val: o.fit ? "أيوه" : "لأ" }, { f: "order", t: "أنهي تسجيل", val: M.orders[o.order] }],
      music: [srcLeaf, { f: "volume", t: "علو الموسيقى", val: `${AR_N(o.volume)}٪` }, { f: "duck", t: "توطى وقت الكلام", val: o.duck ? "أيوه" : "لأ" }, { f: "order", t: "أنهي موسيقى", val: M.orders[o.order] }],
      cut: [{ f: "max", t: "أقصى طول للقطة", val: `${AR_N(o.max)} ث` }, { f: "trans", t: "الانتقال", val: M.trans[o.trans] }],
      caption: [{ f: "on", t: "الكابشن", val: o.on ? "شغّال" : "مقفول" }],
      export: [{ f: "ratio", t: "المقاس", val: o.ratio }],
      split: [{ ...srcLeaf, t: "الفيديو", val: src ? `${src}${s.video ? ` · ${AR_N(Math.round(s.video.dur))} ث` : s.found != null ? ` · ${AR_N(s.found)} فيديو` : ""}` : "" },
        { f: "max", t: "أقصى طول للقطعة", val: `${AR_N(o.max)} ث${s.pieces ? ` · ${AR_N(s.pieces)} قطع` : ""}` },
        { f: "note", t: "محتاج إيه في التقطيع", val: (o.note || "").slice(0, 40) || "قطع متساوية عند السكوت" }, { f: "order", t: "أنهي فيديو", val: M.orders[o.order] }],
      gen: genLeaves(o), genimg: imgLeaves(o), genvoice: voiceLeaves(o),
      merge: [{ f: "items", t: "إيه اللي يتجمع وبأي ترتيب", val: (o.items || []).length ? `${AR_N(o.items.length)} مخرج بالترتيب بتاعك` : "آخر حاجة في كل مسار" }],
      publish: [{ f: "when", t: "إمتى", val: M.when[o.when] }, { f: "platforms", t: "على فين", val: (o.platforms || []).length ? `${AR_N(o.platforms.length)} حساب` : "", miss: o.when === "now" && !(o.platforms || []).length },
        { f: "caption", t: "الكابشن", val: (o.caption || "").slice(0, 40) || "اسم القالب" }],
    }[s.verb] || [];
    if ((M.rules_verbs || []).includes(s.verb)) L.push({ f: "rules", t: "قواعدي", val: (o.rules || "").slice(0, 40) });
    return [...L.map((l) => ({ ...l, type: "opt" })), ...(M.fixed.includes(s.verb) || s.verb === "merge" ? [] : [{ f: "move", t: "رتّبها أو شيلها", type: "action" }])];
  }
  // ✨ «ولّد»: النقط بتتغيّر على حسب نوع الموديل (من القطعة / مراجع / صورة / بداية ونهاية / الكلام بس)
  const genModel = (o) => (S.meta.gen_models || []).find((m) => m.model === o.model) || (S.meta.gen_models || [])[0] || null;
  const genMode = (o) => genModel(o)?.mode || "video";
  function genLeaves(o) {
    const m = genModel(o), mode = genMode(o), refs = o.refs || [];
    const L = [{ f: "model", t: "الموديل", val: m ? `${m.label} · ${S.meta.gen_modes?.[mode] || ""}` : "الافتراضي" },
      { f: "prompt", t: "البرومبت", val: (o.prompt || "").slice(0, 40), miss: mode !== "lipsync" && !(o.prompt || "").trim() }];
    if (mode === "image" || mode === "startend") L.push({ f: "start", t: "صورة البداية", val: o.start?.label || refs[0]?.label || "أول فريم من القطعة" });
    if (mode === "avatar") L.push({ f: "start", t: "صورة اللي بيتكلم", val: o.start?.label || refs[0]?.label || "أول فريم من القطعة" });
    if (mode === "avatar" || mode === "lipsync") L.push({ f: "audio", t: "الصوت", val: o.audio?.label || (mode === "avatar" ? "صوت القطعة نفسها" : ""), miss: mode === "lipsync" && !o.audio });
    if (mode === "startend") L.push({ f: "end", t: "صورة النهاية", val: o.end?.label || refs[1]?.label || "", miss: !o.end && refs.length < 2 });
    if (mode === "refs" || mode === "video") L.push({ f: "refs", t: mode === "refs" ? "المراجع (شخصيات وخلفيات وصور)" : "مراجع (اختياري)", val: refs.length ? refs.map((r) => r.label).join("، ").slice(0, 40) : "",
      miss: mode === "refs" && !refs.length && !(m?.video_in && o.use_piece) });
    if (mode === "refs" && m?.video_in) L.push({ f: "use_piece", t: "القطعة كمرجع فيديو", val: o.use_piece ? "أيوه" : "لأ" });
    return L;
  }
  // 🖼️ «ولّد صورة»: المراجع بتظهر بس لو الموديل بيقبل صور مرجع
  const imgModel = (o) => (S.meta.img_models || []).find((m) => m.key === o.model) || (S.meta.img_models || [])[0] || null;
  function imgLeaves(o) {
    const m = imgModel(o), refs = o.refs || [];
    const L = [{ f: "model", t: "الموديل", val: m ? `${m.label} · ${m.refs ? `بيقبل لحد ${AR_N(m.max_refs)} صور مرجع` : "من الوصف بس"}` : "الافتراضي" },
      { f: "prompt", t: "الوصف", val: (o.prompt || "").slice(0, 40), miss: !(o.prompt || "").trim() }];
    if (m?.refs) L.push({ f: "refs", t: "صور المرجع (اختياري)", val: refs.length ? refs.map((r) => r.label).join("، ").slice(0, 40) : "" });
    L.push({ f: "count", t: "عدد الصور", val: AR_N(o.count) }, { f: "sec", t: "مدة الصورة في الفيديو", val: `${AR_N(o.sec)} ث` });
    return L;
  }
  // 🎙️ «ولّد صوت»: الخانات على حسب الموديل (لهجة وصوت، أصوات الموديل، صوت مرجع، أو موسيقى)
  const voModel = (o) => (S.meta.voice_models || []).find((m) => m.model === o.model) || (S.meta.voice_models || [])[0] || { mode: "std", label: "" };
  function voiceLeaves(o) {
    const m = voModel(o), M = S.meta, music = m.mode === "music";
    const L = [{ f: "model", t: "الموديل", val: `${m.label}${m.ref ? " · بيقبل صوت مرجع" : ""}` },
      { f: "text", t: music ? "وصف الموسيقى" : "الكلام", val: (o.text || "").slice(0, 40), miss: !(o.text || "").trim() }];
    if (m.mode === "std") {
      const lang = M.dialects?.[o.lang] ? o.lang : "ar-eg-cairo", vs = M.dialects?.[lang]?.voices || [];
      L.push({ f: "lang", t: "اللهجة / اللغة", val: M.dialects?.[lang]?.label || "" }, { f: "voice", t: "الصوت", val: M.voices?.[vs.includes(o.voice) ? o.voice : vs[0]] || "" });
    } else if ((m.voices || []).length) L.push({ f: "voice", t: "الصوت", val: (m.voices.includes(o.voice) ? o.voice : m.voices[0]) || "" });
    if (m.ref) L.push({ f: "ref", t: "صوت مرجع (اختياري)", val: o.ref?.label || "" });
    if (music) L.push({ f: "lyrics", t: "كلمات الأغنية (اختياري)", val: (o.lyrics || "").slice(0, 40) || "موسيقى من غير كلام" },
      { f: "volume", t: "علو الموسيقى", val: `${AR_N(o.volume)}٪` }, { f: "duck", t: "توطى وقت الكلام", val: o.duck ? "أيوه" : "لأ" });
    else L.push({ f: "fit", t: "الفيديو على قد الصوت", val: o.fit ? "أيوه" : "لأ" });
    return L;
  }
  // اللي ينفع يتمنشن: الشخصيات، الأفاتار، الخلفيات، والفولدرات والملفات من مكتبة المحتويات
  function loadRefs() {
    if (S.refsLoading) return;
    S.refsLoading = true;
    api("/api/automations-refs").then((x) => { S.refs = x; refreshCard(); }).catch((err) => toast(err.message, true)).finally(() => (S.refsLoading = false));
  }
  const refKey = (r) => `${r.kind}|${r.id}`;
  const refFind = (key) => (S.refs || []).find((r) => refKey(r) === key);
  const refThumb = (r) => (r.thumb ? `<img src="${esc(r.thumb)}" alt="">` : `<span>${r.kind === "folder" ? "📁" : r.kind === "file" ? "🎬" : "✦"}</span>`);
  function refList(q, chosen, f) {
    if (!S.refs) { loadRefs(); return `<p class="bm-note">بيجيب الشخصيات والخلفيات والملفات…</p>`; }
    const nq = String(q || "").trim().toLowerCase(), on = new Set(chosen.map(refKey));
    const list = S.refs.filter((r) => !nq || `${r.label} ${r.sub}`.toLowerCase().includes(nq)).slice(0, 40);
    const groups = f === "audio" || f === "ref" ? [["audio", "🎙️ الأصوات (الشخصيات، صوتك، التعليقات والموسيقى)"]]
      : [["char", "🧑‍🎤 الشخصيات"], ["twin", "🪞 الأفاتار"], ["bg", "🏞️ الخلفيات والأماكن"], ["folder", "📁 فولدرات"], ["file", "🖼️ صور وفيديوهات"], ["export", "📤 فيديوهات جاهزة"]];
    return groups.map(([k, t]) => { const xs = list.filter((r) => r.kind === k); return xs.length ? `<p class="am-gh">${t}</p><div class="am-files">${xs.map((r) =>
      `<button class="am-file${on.has(refKey(r)) ? " on" : ""}" data-refpick="${esc(f)}" data-ref="${esc(refKey(r))}" title="${esc(r.sub)}">${refThumb(r)}<small>${esc(r.label)}</small></button>`).join("")}</div>` : ""; }).join("")
      || `<p class="bm-note">مفيش حاجة بالاسم ده. ضيف شخصيات من «الشخصيات والأفاتار» وخلفيات وملفات من «مكتبة محتويات البراند».</p>`;
  }
  function refsCard(s, f) {
    const o = s.opts, mode = genMode(o), one = f !== "refs", chosen = one ? (o[f] ? [o[f]] : []) : (o.refs || []);
    const note = s.verb === "genimg" ? { refs: `الصور دي بتتبعت للموديل كمرجع (لحد ${AR_N(imgModel(o)?.max_refs || 4)}): شخصية علشان شكلها يفضل ثابت، أو خلفية، أو أي صورة من المكتبة. أو اكتب @ في الوصف.` }[f]
      : s.verb === "genvoice" ? { ref: "الموديل بيقلّد الصوت ده: صوت شخصية، صوت أفاتار، أو تعليق من المكتبة." }[f] : { refs: mode === "refs" ? `الموديل بيعمل الفيديو من المراجع دي (لحد ${AR_N(S.meta.max_refs || 6)}). اختار شخصية أو خلفية أو صورة، أو اكتب @ في البرومبت.` : "لو الموديل بيقبل صور مرجع، بتتبعت معاه القطعة (مثلًا الشخصية علشان شكلها يفضل ثابت).",
      start: mode === "avatar" ? "صورة الشخص اللي هيتكلم (شخصية، أفاتار، أو أي صورة). الافتراضي: أول فريم من القطعة." : "الصورة اللي الفيديو هيبدأ منها. الافتراضي: أول فريم من القطعة.",
      end: "الصورة اللي الفيديو هيخلص عليها.",
      audio: mode === "avatar" ? "الصوت اللي الشخص هيقوله (صوت شخصية، صوت أفاتار، أو تعليق من المكتبة). الافتراضي: صوت القطعة نفسها. الفيديو بيطلع على قد الصوت." : "الصوت اللي الشفايف هتتظبط عليه." }[f];
    if (s.verb !== "gen") return `<p class="bm-note">${note || ""}</p>
      ${chosen.length ? `<div class="am-chosen">${chosen.map((r) => `<span class="am-chip">${refThumb(r)}<b>${esc(r.label)}</b><button data-refrm="${esc(f)}|${esc(refKey(r))}" title="شيله">✕</button></span>`).join("")}</div>` : ""}
      <div class="bm-write" contenteditable="plaintext-only" data-k="refq" data-ph="🔎 دوّر بالاسم">${esc(S.refQ || "")}</div>
      <div data-reflist>${refList(S.refQ, chosen, f)}</div>`;
    return `<p class="bm-note">${note}</p>
      ${chosen.length ? `<div class="am-chosen">${chosen.map((r) => `<span class="am-chip">${refThumb(r)}<b>${esc(r.label)}</b><button data-refrm="${esc(f)}|${esc(refKey(r))}" title="شيله">✕</button></span>`).join("")}</div>` : ""}
      ${f === "start" ? `<div class="bm-pills"><button class="bm-pill${o.start?.kind === "frame" || !o.start ? " on" : ""}" data-refset="start|frame|">🎞️ أول فريم من القطعة</button></div>` : ""}
      ${f === "audio" && mode === "avatar" ? `<div class="bm-pills"><button class="bm-pill${o.audio?.kind === "piece_audio" || !o.audio ? " on" : ""}" data-refset="audio|piece_audio|">🎞️ صوت القطعة نفسها</button></div>` : ""}
      <div class="bm-write" contenteditable="plaintext-only" data-k="refq" data-ph="🔎 دوّر بالاسم">${esc(S.refQ || "")}</div>
      <div data-reflist>${refList(S.refQ, chosen, f)}</div>`;
  }
  // @ في البرومبت: قايمة صغيرة تحت الكتابة، والاختيار بيكتب الاسم ويضيفه للمراجع
  function mentionQuery(el) { const m = /(^|\s)@([^\s@]*)$/.exec(el.innerText); return m ? m[2] : null; }
  function showMentions(el) {
    const box = S.el.querySelector("[data-ment]");
    if (!box) return;
    const q = mentionQuery(el);
    if (q == null || !S.refs) { box.hidden = true; return; }
    const nq = q.toLowerCase(), xs = S.refs.filter((r) => !nq || r.label.toLowerCase().includes(nq)).slice(0, 8);
    box.hidden = !xs.length;
    box.innerHTML = xs.map((r) => `<button type="button" class="am-mi" data-mention="${esc(refKey(r))}">${refThumb(r)}<b>${esc(r.label)}</b><small>${esc(r.sub)}</small></button>`).join("");
  }
  function insertMention(s, key) {
    const r = refFind(key), el = S.el.querySelector('[data-k="opt:prompt"]');
    if (!r || !el) return;
    const txt = el.innerText.replace(/(^|\s)@([^\s@]*)$/, (_, a) => `${a}@${r.label} `);
    el.innerText = txt;   // لو فيه حفظ للكتابة لسه مستني، بيحفظ نفس الكلام
    const it = { kind: r.kind, id: r.id, label: r.label, thumb: r.thumb };
    if (s.verb === "genimg") {
      if (r.kind === "audio") return toast("«ولّد صورة» بياخد صور بس كمرجع", true);
      if (!imgModel(s.opts)?.refs) toast("الموديل ده مابيقبلش صور مرجع، فالاسم هيتكتب بس. اختار موديل بيقبل مراجع لو عايزها تتبعت");
      const max = imgModel(s.opts)?.max_refs || 4;
      return saveSteps(mapStep(s.id, (x) => { const cur = x.opts.refs || []; return { ...x, opts: { ...x.opts, prompt: txt, refs: cur.some((y) => refKey(y) === key) ? cur : [...cur, it].slice(0, max) } }; }));
    }
    if (r.kind === "audio") {
      if (!["avatar", "lipsync"].includes(genMode(s.opts))) toast("الصوت بيتستخدم مع موديلات الأفاتار والليب سينك بس. غيّر الموديل علشان يتبعت");
      return saveSteps(mapStep(s.id, (x) => ({ ...x, opts: { ...x.opts, prompt: txt, audio: it } })));
    }
    return saveSteps(mapStep(s.id, (x) => {
      const cur = x.opts.refs || [];
      return { ...x, opts: { ...x.opts, prompt: txt, refs: cur.some((y) => refKey(y) === key) ? cur : [...cur, it].slice(0, S.meta.max_refs || 6) } };
    }));
  }
  // خط واحد من الشمال لليمين: ابدأ ← الخطوات ← «＋» ← صدّر ← انشر، ونقط كل خطوة على قوس فوقها.
  // «قطّع الفيديو» بيفتح مسار لكل قطعة (فوق بعض)، وكلهم بيرجعوا يتقابلوا عند «جمّع».
  const GAPX = 210, LANEY = 250;
  const lanesOf = (sp) => (sp.lanes && sp.lanes.length ? sp.lanes : [[]]);
  function layout() {
    const w = S.el, r = S.rec;
    if (!w || !r) return;
    if (!w.clientWidth || !w.clientHeight) return;
    const steps = r.steps || [], fixed = S.meta.fixed, user = steps.filter((x) => !fixed.includes(x.verb)), tail = steps.filter((x) => fixed.includes(x.verb));
    const row = [{ id: "run", kind: "run" }, ...user.map((s) => ({ id: s.id, kind: "branch", s })), { id: "add", kind: "add" }, ...tail.map((s) => ({ id: s.id, kind: "branch", s }))];
    const nodes = [];
    let k = 0, x = 0, prev = null, ends = null;
    const put = (n, x, y, from, links) => {
      if (n.kind !== "branch") { nodes.push({ ...n, x, y, from, links }); return; }
      const leaves = leavesOf(n.s), missing = leaves.some((l) => l.miss);
      nodes.push({ ...n, i: n.lane ? null : k++, x, y, from, links, missing, g: leaves.length });
      const m = leaves.length, R = 108, spread = Math.min(Math.PI * .8, Math.max(0, m - 1) * .34);
      leaves.forEach((l, j) => {
        const a = -Math.PI / 2 + (m === 1 ? 0 : -spread / 2 + (j / (m - 1)) * spread);
        nodes.push({ id: `${n.s.id}:${l.f}`, kind: "leaf", s: n.s, l, br: { k: n.s.id }, x: x + Math.cos(a) * R, y: y + Math.sin(a) * R, from: n.s.id, on: !l.miss });
      });
    };
    for (const n of row) {
      if (n.kind === "branch" && n.s.verb === "merge" && ends) { put(n, x, 0, ends[0], ends.slice(1)); prev = n.id; ends = null; x += GAPX; continue; }
      put(n, x, 0, prev); prev = n.id; x += GAPX;
      if (n.kind !== "branch" || n.s.verb !== "split") continue;
      const sp = n.s, L = lanesOf(sp);
      let wmax = 0;
      ends = L.map((ln, li) => {
        const y = (li - (L.length - 1) / 2) * LANEY;
        let lx = x, from = sp.id;
        put({ id: `piece:${li}`, kind: "piece", sp, li }, lx, y, from); from = `piece:${li}`; lx += GAPX;
        ln.forEach((st) => { put({ id: st.id, kind: "branch", s: st, lane: [sp.id, li] }, lx, y, from); from = st.id; lx += GAPX; });
        put({ id: `ladd:${li}`, kind: "ladd", sp, li }, lx, y, from);
        wmax = Math.max(wmax, lx - x + GAPX);
        return `ladd:${li}`;
      });
      x += wmax;
    }
    const xs = nodes.filter((n) => n.kind !== "leaf").map((n) => n.x), mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    nodes.forEach((n) => { n.x -= mid; });
    const old = Object.fromEntries((S.nodes || []).map((n) => [n.id, n]));
    S.nodes = nodes.map((n, i) => {
      const o = old[n.id];
      return { ...n, ph: i * 1.7, px: o ? o.px : n.x, py: o ? o.py : n.y, vx: o?.vx || 0, vy: o?.vy || 0 };
    });
    S.byId = Object.fromEntries(S.nodes.map((n) => [n.id, n]));
    fit();
    draw();
  }
  function fit(force) {
    const w = S.el, W = w.clientWidth, H = w.clientHeight;
    if (S.view?.user && !force) return applyView();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const n of S.nodes) {
      const m = n.kind === "leaf" ? 26 : n.kind === "center" ? 110 : 80;
      x0 = Math.min(x0, n.x - m); x1 = Math.max(x1, n.x + m); y0 = Math.min(y0, n.y - m); y1 = Math.max(y1, n.y + m + (n.kind === "branch" ? 30 : 0));
    }
    const top = topInset(), hh = H - top - 40;
    const s = Math.max(.35, Math.min(1.05, (W - 32) / (x1 - x0), hh / (y1 - y0)));
    S.view = { s, x: W / 2 - (x0 + x1) / 2 * s, y: top + hh / 2 - (y0 + y1) / 2 * s, user: false };
    applyView();
  }
  function topInset() {
    const r = S.el.getBoundingClientRect();
    let y = 8;
    for (const id of ["nhBar", "nhPTitle"]) {
      const e = document.getElementById(id);
      if (e && e.offsetHeight && S.el.closest("#nh")?.contains(S.el)) y = Math.max(y, e.getBoundingClientRect().bottom - r.top + 12);
    }
    S.headY = y;
    return y;
  }
  function applyView() {
    const v = S.view, world = S.el?.querySelector(".bm-world");
    if (!v || !world) return;
    world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`;
    S.topY = topInset();
    S.el.style.setProperty("--bm-top", `${S.headY}px`);
    S.el.style.setProperty("--bm-s", v.s);
    if (S.dv) S.dv.dirty = true;
  }
  function zoomAt(f, sx, sy) {
    const v = S.view;
    if (!v) return;
    const s = Math.max(.35, Math.min(2, v.s * f));
    v.x = sx - (sx - v.x) * (s / v.s); v.y = sy - (sy - v.y) * (s / v.s); v.s = s; v.user = true;
    applyView();
  }
  const toWorld = (sx, sy) => [(sx - S.view.x) / S.view.s, (sy - S.view.y) / S.view.s];
  const toScreen = (p) => p && [p[0] * S.view.s + S.view.x, p[1] * S.view.s + S.view.y];

  // ---------- الرسم (نفس كلاسات خريطة العقل) ----------
  function skeleton() {
    return `<canvas class="bm-dots" aria-hidden="true"></canvas>
      <div class="bm-world"><svg class="bm-lines" aria-hidden="true"></svg><div class="bm-nodes"></div></div>
      <div class="bm-zoom"><button data-zoom="1" aria-label="قرّب">+</button><button data-zoom="0" aria-label="الخريطة كلها">⤢</button><button data-zoom="-1" aria-label="بعّد">−</button></div>
      <div class="bm-card" hidden role="dialog"></div>
      <div class="am-desc${S.descOpen ? " open" : ""}"><button class="am-desc-t" data-desc-open>✨ اوصف القالب بكلامك (كتابة أو صوت)</button>
        <div class="am-desc-b"><div class="bm-write" contenteditable="plaintext-only" data-k="desc" data-ph="مثلًا: قطّع الفيديو اللي في فولدر «لايفات» لقطع أقل من ١٥ ثانية، وولّد كل قطعة بستايل كرتون، وجمّعهم، وحط موسيقى وكابشن، واستنى موافقتي قبل النشر"></div>
          <div class="bm-acts"><button class="bm-pill" data-rec>🎙️ سجّل صوتك</button><span class="am-recst"></span>
            <button class="bm-go" data-desc-go>✨ اعمل الخطوات</button><button class="bm-pill" data-undo hidden>↩ رجّع زي ما كان</button></div>
          <p class="bm-note am-say"></p></div></div>
      <p class="bm-hint">الخطوات من الشمال لليمين · دوس على أي نقطة تغيّرها · «قطّع الفيديو» بيفتح مسار لكل قطعة، و«جمّع» بيلمّهم · «+» خطوة جديدة · «▶» على الشمال يشغّل القالب</p>`;
  }
  function nodeHTML(n) {
    const r = S.rec;
    if (n.kind === "run") {
      const last = (r.runs || [])[0];
      const st = r.busy ? esc(last?.step || "شغال…") : last?.status === "failed" ? "آخر تشغيل فشل" : last?.status === "done" ? "آخر فيديو جاهز ✓" : "دوس تشغّل";
      return `<button class="bm-n bm-quiz am-start${r.busy ? " busy" : ""}" data-n="run" title="شغّل القالب، وغيّر اسمه أو بدّله"><i>▶</i><b>${esc(r.name)}</b><small>${r.saved ? "" : "مسودة · "}${st}</small></button>`;
    }
    if (n.kind === "add") return `<button class="bm-n bm-add" data-n="add" title="ضيف خطوة (فعل + منشن)"><i>+</i><b>خطوة جديدة</b></button>`;
    if (n.kind === "ladd") return `<button class="bm-n bm-add am-ladd" data-n="${n.id}" title="ضيف خطوة في مسار القطعة دي"><i>+</i><b>في المسار ده</b></button>`;
    if (n.kind === "piece") {
      const sp = n.sp, span = (sp.spans || [])[n.li], one = !sp.pieces && lanesOf(sp).length === 1;
      return `<button class="bm-n bm-branch am-piece${S.open?.id === n.id ? " on" : ""}" data-n="${n.id}" title="مسار القطعة دي">
        <span class="bm-bic">${svg(IC.piece)}</span><b>${one ? "كل قطعة" : `قطعة ${AR_N(n.li + 1)}`}</b><small class="num">${span ? `${AR_N(span[0].toFixed(1))}–${AR_N(span[1].toFixed(1))} ث` : sp.pieces ? "" : "العدد بيتعرف وقت التشغيل"}</small></button>`;
    }
    if (n.kind === "branch") {
      const v = S.meta.verbs[n.s.verb];
      return `<button class="bm-n bm-branch${S.open?.br === n.id ? " on" : ""}" data-n="${n.id}" title="${esc(v.desc)}">
        <span class="bm-bic">${svg(IC[n.s.verb])}${n.missing ? `<em class="num">!</em>` : ""}</span><b>${esc(v.t)}</b><small class="num">${n.i == null ? "" : AR_N(n.i + 1)}</small></button>`;
    }
    const l = n.l, cls = l.type === "action" ? "act" : n.on ? "full" : "empty";
    return `<button class="bm-n bm-leaf ${cls}${S.open?.id === n.id ? " on" : ""}" data-n="${esc(n.id)}" aria-label="${esc(l.t)}">
      <i>${l.type === "action" ? "⇅" : ""}</i><span class="bm-tip"><b>${esc(l.t)}</b>${l.val ? `<small>${esc(l.val)}</small>` : l.type === "action" ? "" : `<small class="miss">لسه ناقصة</small>`}</span></button>`;
  }
  function draw() {
    const w = S.el;
    w.querySelector(".bm-nodes").innerHTML = S.nodes.map(nodeHTML).join("");
    S.nodes.forEach((n) => { n.el = w.querySelector(`[data-n="${CSS.escape(n.id)}"]`); });
    w.querySelector(".bm-lines").innerHTML = S.nodes.filter((n) => n.from).map((n) => `<path data-l="${esc(n.id)}" class="${n.kind === "leaf" ? "leaf" : "branch am-flow"}${n.on === false ? " empty" : ""}"/>`).join("")
      + S.nodes.flatMap((n) => (n.links || []).map((f) => `<path data-l="${esc(n.id)}|${esc(f)}" class="branch am-flow"/>`)).join("");
    S.nodes.forEach((n) => {
      n.line = n.from ? w.querySelector(`.bm-lines [data-l="${CSS.escape(n.id)}"]`) : null;
      n.extra = (n.links || []).map((f) => [f, w.querySelector(`.bm-lines [data-l="${CSS.escape(`${n.id}|${f}`)}"]`)]);
    });
    tick(performance.now());
  }
  const FOLLOW = { branch: .25, leaf: .9, add: .25, run: 0, piece: .25, ladd: .25 };
  function step(dt) {
    const k = 140, c = 15;
    for (const n of S.nodes) {
      if (S.drag?.n === n && S.drag.moved) { n.vx = n.vy = 0; n.px = S.drag.x; n.py = S.drag.y; continue; }
      const p = n.from && S.byId[n.from], f = FOLLOW[n.kind] || 0;
      let tx = n.x + (p ? (p.px - p.x) * f : 0), ty = n.y + (p ? (p.py - p.y) * f : 0);
      if (S.mw && !S.drag && (n.kind === "leaf" || n.kind === "branch")) {
        const mx = S.mw[0] - n.x, my = S.mw[1] - n.y, md = Math.hypot(mx, my) || 1;
        // النقطة اللي الماوس عليها بتقرّب منه سنة صغيرة، والباقي ثابت (مابيهربش من الماوس)
        if (S.hovNode === n) { const pull = Math.min(n.kind === "leaf" ? 6 : 5, md * .25); tx += mx / md * pull; ty += my / md * pull; }
      }
      n.vx += (k * (tx - n.px) - c * n.vx) * dt;
      n.vy += (k * (ty - n.py) - c * n.vy) * dt;
      n.px += n.vx * dt; n.py += n.vy * dt;
    }
  }
  function tick(now) {
    const t = (now - S.t0) / 1000, still = reduce.matches;
    const dt = Math.min(.033, Math.max(0, (now - (S.last || now)) / 1000));
    S.last = now;
    if (still) S.nodes.forEach((n) => { if (!(S.drag?.n === n && S.drag.moved)) { n.px = n.x; n.py = n.y; } else { n.px = S.drag.x; n.py = S.drag.y; } });
    else for (let i = 0; i < 2; i++) step(dt / 2);
    const pos = {};
    for (const n of S.nodes) {
      const amp = S.drag?.n === n ? 0 : n.kind === "center" ? 2 : n.kind === "branch" ? 4 : 5;
      const x = n.px + (still ? 0 : Math.sin(t * .55 + n.ph) * amp), y = n.py + (still ? 0 : Math.cos(t * .48 + n.ph * 1.3) * amp);
      pos[n.id] = [x, y];
      if (n.el) {
        n.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        if (n.kind === "leaf") { const down = y * S.view.s + S.view.y < S.topY + 70; if (down !== n.down) { n.down = down; n.el.classList.toggle("tipdown", down); } }
      }
    }
    // الخط الأساسي: من كل خطوة للي بعدها (أفقي)، ونقط الخطوة طالعة لفوق من الدايرة
    const flow = (line, A, B, fromKind, toKind) => {
      const ra = fromKind === "branch" || fromKind === "piece" ? 36 : 28, rb = toKind === "branch" || toKind === "piece" ? 36 : 28;
      const P0 = [A[0] + ra, A[1]], P3 = [B[0] - rb, B[1]], mx = (P0[0] + P3[0]) / 2;
      line.setAttribute("d", `M${P0[0].toFixed(1)} ${P0[1].toFixed(1)}C${mx.toFixed(1)} ${P0[1].toFixed(1)} ${mx.toFixed(1)} ${P3[1].toFixed(1)} ${P3[0].toFixed(1)} ${P3[1].toFixed(1)}`);
    };
    for (const n of S.nodes) for (const [f, line] of n.extra || []) if (line && pos[f]) flow(line, pos[f], pos[n.id], S.byId[f]?.kind, n.kind);
    for (const n of S.nodes) {
      if (!n.line) continue;
      const A = pos[n.from], B = pos[n.id];
      if (n.kind === "leaf") {
        const P0 = [A[0] + (B[0] - A[0]) * .3, A[1] - 34], P3 = [B[0], B[1] + 10];
        n.line.setAttribute("d", `M${P0[0].toFixed(1)} ${P0[1].toFixed(1)}C${P0[0].toFixed(1)} ${(P0[1] - 30).toFixed(1)} ${P3[0].toFixed(1)} ${(P3[1] + 30).toFixed(1)} ${P3[0].toFixed(1)} ${P3[1].toFixed(1)}`);
        continue;
      }
      flow(n.line, A, B, S.byId[n.from]?.kind, n.kind);
    }
    dots();
    if (S.open?.n) placeCard(toScreen([S.open.n.px, S.open.n.py]));
  }
  const GAP = 22, GLOW = 170;
  function dotsSize() {
    const w = S.el, cv = w?.querySelector(".bm-dots");
    if (!cv) return;
    const dpr = Math.min(2, devicePixelRatio || 1), W = w.clientWidth, H = w.clientHeight;
    const cs = getComputedStyle(w), ink = cs.getPropertyValue("--nh-ink").trim() || "#181718", acc = cs.getPropertyValue("--nh-accent").trim() || "#E5613E";
    const key = `${W}x${H}@${dpr}${ink}`;
    S.dv = S.dv || { mx: -999, my: -999, tx: -999, ty: -999, a: 0, ta: 0, dirty: true };
    S.dv.ink = ink; S.dv.acc = acc;
    if (S.dv.key === key) return;
    S.dv.key = key; S.dv.dirty = true;
    cv.width = W * dpr; cv.height = H * dpr;
    const base = S.dv.base = document.createElement("canvas");
    base.width = (W + GAP) * dpr; base.height = (H + GAP) * dpr;
    const g = base.getContext("2d");
    g.scale(dpr, dpr); g.fillStyle = ink; g.globalAlpha = .16;
    for (let y = GAP / 2; y <= H + GAP; y += GAP) for (let x = GAP / 2; x <= W + GAP; x += GAP) { g.beginPath(); g.arc(x, y, 1, 0, 6.2832); g.fill(); }
    S.dv.dpr = dpr; S.dv.W = W; S.dv.H = H;
  }
  function dots() {
    const v = S.dv, cv = S.el?.querySelector(".bm-dots");
    if (!v?.base || !cv) return;
    const e = reduce.matches ? 1 : .18;
    v.mx += (v.tx - v.mx) * e; v.my += (v.ty - v.my) * e; v.a += (v.ta - v.a) * (reduce.matches ? 1 : .12);
    const moving = Math.abs(v.tx - v.mx) > .3 || Math.abs(v.ty - v.my) > .3 || Math.abs(v.ta - v.a) > .004;
    if (!moving && !v.dirty) return;
    v.dirty = moving;
    const c = cv.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    const m = (a) => ((a % GAP) + GAP) % GAP;
    v.ox = m(S.view?.x || 0); v.oy = m(S.view?.y || 0);
    c.drawImage(v.base, (m(v.ox - GAP / 2) - GAP) * v.dpr, (m(v.oy - GAP / 2) - GAP) * v.dpr);
    if (v.a < .01) return;
    c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    c.fillStyle = v.acc;
    const x0 = v.ox + Math.ceil((Math.max(0, v.mx - GLOW) - v.ox) / GAP) * GAP, y0 = v.oy + Math.ceil((Math.max(0, v.my - GLOW) - v.oy) / GAP) * GAP;
    for (let y = y0; y <= Math.min(v.H, v.my + GLOW); y += GAP) for (let x = x0; x <= Math.min(v.W, v.mx + GLOW); x += GAP) {
      const d = Math.hypot(x - v.mx, y - v.my) / GLOW;
      if (d >= 1) continue;
      const f = (1 - d * d) ** 2 * v.a;
      c.globalAlpha = .16 + .7 * f;
      c.beginPath(); c.arc(x, y, 1 + 1.3 * f, 0, 6.2832); c.fill();
    }
    c.globalAlpha = 1;
  }
  function loop(now) {
    if (!S.el?.isConnected) { S.raf = 0; return; }
    tick(now);
    S.raf = requestAnimationFrame(loop);
  }

  // ---------- الكارت ----------
  const pills = (key, opts, cur) => `<div class="bm-pills">${opts.map(([v, t]) => `<button class="bm-pill${String(cur) === String(v) ? " on" : ""}" data-set="${esc(key)}" data-v="${esc(v)}">${esc(t)}</button>`).join("")}</div>`;
  function srcCard(s) {
    const v = S.meta.verbs[s.verb], L = S.lib;
    if (!L) { loadLib(); return `<p class="bm-note">بيجيب المكتبة…</p>`; }
    const want = s.verb === "pull" ? (s.opts.type === "any" ? ["image", "video"] : [s.opts.type]) : v.accept;
    const music = want.includes("audio") && (s.verb === "music" || (s.verb === "pull" && s.opts.role !== "voice"));
    const stockOk = want.includes("audio") ? music : S.meta.stock_pexels;
    const stockBox = !(want.includes("audio") && !music) ? `<p class="am-gh">🌐 من الستوك أونلاين</p>
      <p class="bm-note">${want.includes("audio") ? "موسيقى مسموح استخدامها في الإعلانات والبوستات، باسم صاحبها." : "صور وفيديوهات حقيقية من Pexels، ببلاش."} اكتب اللي عايزه (عربي أو إنجليزي)، وكل تشغيل بيجيب حاجة جديدة ويحفظها في المكتبة في «🌐 من الستوك».</p>
      ${stockOk ? `<div class="bm-write" contenteditable="plaintext-only" data-k="stockq" data-ph="مثلًا: قهوة الصبح، ناس بتضحك في مكتب، lofi chill…">${esc(S.stockQ ?? (s.src?.mode === "stock" ? s.src.q : ""))}</div>
      <div class="bm-acts"><button class="bm-go" data-src="stock">${s.src?.mode === "stock" ? "✓ " : ""}هات من الستوك</button></div>` : `<p class="bm-note">الستوك مش متاح دلوقتي.</p>`}
      <p class="am-gh">📁 من المكتبة</p>` : "";
    const kids = (pid, depth = 0) => L.folders.filter((f) => (f.parent || null) === (pid || null)).map((f) =>
      `<button class="bm-pill${s.src?.mode === "folder" && s.src.id === f.id ? " on" : ""}" data-src="folder" data-id="${f.id}" data-label="${esc(f.path)}" style="margin-inline-start:${depth * 14}px">📁 ${esc(f.name)} <small class="num">${f.count}</small></button>${kids(f.id, depth + 1)}`).join("");
    const q = S.srcQ || "", files = L.files.filter((f) => want.includes(f.kind) && (!q || `${f.name} ${f.desc} ${(f.tags || []).join(" ")} ${f.path}`.includes(q))).slice(0, 30);
    return `${stockBox}<p class="bm-note">اختار فولدر (هياخد من اللي جواه كمان)، أو ملف بعينه، أو اكتب كلمة يدوّر بيها بالمعنى.</p>
      <div class="bm-pills am-tree"><button class="bm-pill${s.src?.mode === "folder" && !s.src.id ? " on" : ""}" data-src="folder" data-id="" data-label="المكتبة كلها">📁 المكتبة كلها</button>${kids(null)}</div>
      <div class="bm-write" contenteditable="plaintext-only" data-k="srcq" data-ph="🔎 دوّر بالمعنى: قبل التبييض، ابتسامة، العيادة…">${esc(q)}</div>
      <div class="bm-acts"><button class="bm-go" data-src="search">استخدم البحث ده كمنشن</button></div>
      <div class="am-files">${files.map((f) => `<button class="am-file${s.src?.mode === "file" && s.src.id === f.id ? " on" : ""}" data-src="file" data-id="${f.id}" data-label="${esc([f.path, f.name].filter(Boolean).join("/"))}">
        ${f.thumb ? `<img src="${esc(f.thumb)}" alt="">` : `<span>${f.kind === "audio" ? "🎙️" : "🎬"}</span>`}<small>${esc(f.name)}</small></button>`).join("") || `<p class="bm-note">مفيش ${want.map((k) => S.lib.kinds[k]).join(" أو ")} هنا. ارفع في «📁 مكتبة العقل».</p>`}</div>`;
  }
  function cardHTML(n) {
    const r = S.rec, M = S.meta;
    if (n.kind === "add") {
      return `<div class="bm-ch"><span class="latin">ADD STEP</span><b>خطوة جديدة</b></div><p class="bm-note">اختار الفعل، والخطوة بتتحط آخر الخطوات (قبل «صدّر» و«انشر»). بعدها اختار المنشن من نقطة «منين».</p>
        <div class="am-verbs">${Object.entries(M.verbs).filter(([k]) => !M.fixed.includes(k) && !M.lane_verbs.includes(k) && k !== "merge" && !(k === "split" && r.steps.some((x) => x.verb === "split"))).map(([k, v]) => `<button class="am-verb" data-addverb="${k}">${svg(IC[k], 18)}<b>${esc(v.t)}</b><small>${esc(v.desc)}</small></button>`).join("")}</div>`;
    }
    if (n.kind === "ladd") {
      return `<div class="bm-ch"><span class="latin">LANE ${n.li + 1}</span><b>خطوة في مسار ${lanesOf(n.sp).length === 1 && !n.sp.pieces ? "كل قطعة" : `القطعة ${AR_N(n.li + 1)}`}</b></div>
        <div class="am-verbs">${M.lane_verbs.map((k) => `<button class="am-verb" data-laneadd="${n.li}" data-verb="${k}">${svg(IC[k], 18)}<b>${esc(M.verbs[k].t)}</b><small>${esc(M.verbs[k].desc)}</small></button>`).join("")}</div>`;
    }
    if (n.kind === "piece") {
      const sp = n.sp, L = lanesOf(sp), span = (sp.spans || [])[n.li];
      return `<div class="bm-ch"><span class="latin">PIECE ${n.li + 1}</span><b>${!sp.pieces && L.length === 1 ? "كل قطعة" : `القطعة ${AR_N(n.li + 1)}`}</b></div>
        <p class="bm-note">${span ? `من ${AR_N(span[0].toFixed(1))} لـ ${AR_N(span[1].toFixed(1))} ثانية في «${esc(sp.video?.name || "")}». ` : ""}${sp.pieces
          ? `الفيديو هيتقطّع لـ ${AR_N(sp.pieces)} قطع، وكل قطعة ليها مسار لوحدها. حط في المسار ده اللي عايزه يحصل للقطعة دي («+» في آخر المسار).`
          : "عدد القطع بيتعرف وقت التشغيل (على قد طول الفيديو اللي هيتختار). القطع الزيادة عن المسارات اللي هنا بتمشي زي آخر مسار."}</p>
        <div class="bm-acts">${L.length > 1 ? `<button class="bm-pill" data-lanecopy="${n.li}">⇊ نفس المسار ده لكل القطع</button>` : ""}
          ${!sp.pieces ? `<button class="bm-pill" data-laneplus>＋ مسار لقطعة كمان</button>${L.length > 1 ? `<button class="bm-pill" data-lanerm="${n.li}">🗑 شيل المسار ده</button>` : ""}` : ""}</div>`;
    }
    if (n.kind === "run") {
      const runs = r.runs || [];
      return `<div class="bm-ch"><span class="latin">START</span><b>ابدأ</b></div>
        ${editable("@name", r.name, "اسم القالب")}
        <p class="bm-note">بيمشي على الخطوات من الشمال لليمين: بيعمل الفيديو، ويصدّره، وينشره (أو يستناك توافق).${r.est ? ` التكلفة حوالي <b class="num">${AR_N(r.est)}</b> نقطة (كتابة الكلام للكابشن).` : " من غير تكلفة نقط."}</p>
        <div class="bm-acts"><button class="bm-go" data-run ${r.busy ? "disabled" : ""}>${r.busy ? "⏳ شغال…" : "▶ شغّل القالب"}</button></div>
        <div class="am-save">${r.saved
          ? `<span class="am-tag ok">💾 محفوظ باسم «${esc(r.name)}»</span>`
          : `<span class="am-tag">مسودة (لسه مااتحفظش)</span><button class="bm-pill" data-saverec>💾 احفظ القالب باسم</button>`}</div>
        <p class="bm-note">${r.saved ? "بيظهر في الأوتوبايلوت كقالب تختاره مع باقي القوالب." : "احفظه باسم يميّزه، وبعدها يظهر في الأوتوبايلوت كقالب تختاره."}</p>
        <div class="bm-pills">${S.list.map((x) => `<button class="bm-pill${x.id === S.id ? " on" : ""}" data-pick="${x.id}">${x.saved ? "" : "✎ "}${esc(x.name)}</button>`).join("")}
          <button class="bm-pill" data-new>＋ قالب جديد</button><button class="bm-pill" data-delrec>🗑 امسح ده</button></div>
        ${runs.map((x) => `<div class="am-run ${x.status}"><b>${x.status === "done" ? "✓" : x.status === "failed" ? "⚠️" : "⏳"} ${esc(new Date(x.at).toLocaleString("ar-EG-u-nu-latn", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</b>
          ${x.step ? `<small>${esc(x.step)}</small>` : ""}${(x.report || []).map((t) => `<small>${esc(t)}</small>`).join("")}${x.error ? `<small class="bad">${esc(x.error)}</small>` : ""}
          <span class="bm-acts">${x.export_url ? `<a class="bm-pill" href="${esc(x.export_url)}" target="_blank" rel="noopener">⬇ الفيديو</a>` : ""}${x.project_id ? `<button class="bm-pill" data-openpj="${x.project_id}">🎞️ افتح في المونتاج</button>` : ""}</span></div>`).join("")}`;
    }
    // الخطوة نفسها: كل تفاصيلها في كارت واحد (تسحب إيه ومنين، المنشن، قواعدك…)، والنقط اللي فوقها بتوديك لنفس الكارت
    if (n.kind === "branch") {
      const v = M.verbs[n.s.verb], ls = leavesOf(n.s).filter((l) => l.type !== "action");
      return `<div class="bm-ch"><span class="latin">${n.i == null ? "LANE STEP" : `STEP ${n.i + 1}`}</span><b>${esc(v.t)}</b></div><p class="bm-note">${esc(v.desc)}.</p>
        ${ls.map((l) => `<section class="am-sec${l.miss ? " miss" : ""}" data-sec="${esc(l.f)}"><p class="am-st"><b>${esc(l.t)}</b>${l.miss ? `<small>لسه ناقصة</small>` : ""}</p>${leafBody(n.s, l)}</section>`).join("")}
        ${M.fixed.includes(n.s.verb) ? `<p class="bm-note">دي من آخر خطوتين ثابتين (صدّر ثم انشر).</p>` : n.s.verb === "merge" ? `<p class="bm-note">«جمّع» بييجي مع «قطّع الفيديو»، ولو شلت التقطيع بيتشال معاه.</p>` : `<section class="am-sec"><p class="am-st"><b>رتّبها أو شيلها</b></p>${moveActs(n.s)}</section>`}`;
    }
    const s = n.s, l = n.l;
    if (l.f === "move") return `<div class="bm-ch"><span class="latin">${esc(M.verbs[s.verb].t)}</span><b>${esc(l.t)}</b></div>` + moveActs(s);
    return `<div class="bm-ch"><span class="latin">${esc(M.verbs[s.verb].t)}</span><b>${esc(l.t)}</b></div>` + leafBody(s, l);
  }
  function leafBody(s, l) {
    const M = S.meta, o = s.opts, head = "";
    if (l.f === "rules") return editable("opt:rules", o.rules || "", RULES_PH[s.verb] || "اكتب قواعدك") + `<p class="bm-note">${RULES_NOTE[s.verb] || ""} بيتحفظ لوحده لما تقف عن الكتابة.</p>`;
    if (l.f === "role") return pills("role", Object.entries(M.roles || {}), o.role) + `<p class="bm-note">«تعليق صوتي»: الفيديو بيطلع على قد الصوت. «موسيقى»: بتتحط تحت الفيديو.</p>`;
    if (l.f === "src") return head + srcCard(s);
    if (l.f === "type") return head + pills("type", [["image", "صور"], ["video", "فيديوهات"], ["any", "صور وفيديوهات"], ["audio", "صوت"]], o.type);
    if (l.f === "order") return head + pills("order", Object.entries(M.orders), o.order) + `<p class="bm-note">«اللي متستخدمش» بياخد الملفات اللي لسه ماطلعتش في فيديو قبل كده، ولما الفولدر يخلص بيبدأ من الأول.</p>`;
    if (l.f === "trans") return head + pills("trans", Object.entries(M.trans), o.trans);
    if (l.f === "ratio") return head + pills("ratio", M.ratios.map((x) => [x, x]), o.ratio);
    if (l.f === "when") return head + pills("when", Object.entries(M.when), o.when) + `<p class="bm-note">«يستنى موافقتي»: الفيديو بيتصدّر ويستناك في صفحة النشر. «ينزل على طول»: بينزل على الحسابات اللي هتختارها.</p>`;
    if (l.f === "platforms") return head + platCard(o);
    if (l.f === "caption") return head + editable("pubcap", o.caption || "", "الكابشن اللي هينزل مع الفيديو (لو فاضي: اسم القالب)") + `<p class="bm-note">بيتحفظ لوحده لما تقف عن الكتابة.</p>`;
    if (l.f === "prompt" && s.verb === "gen") {
      const mode = genMode(o), PH = { video: "مثلًا: نفس المشهد بس بستايل أنمي، ألوان دافية", refs: "مثلًا: @سارة ماشية في @المكتب وبتشاور على الشاشة", image: "مثلًا: الكاميرا بتقرّب ببطء والناس بتتحرك",
        startend: "مثلًا: الكاميرا بتلف من البداية للنهاية", text: "اكتب الفيديو كله: المكان، الناس، الحركة، الإضاءة",
        avatar: "مثلًا: @سارة بتتكلم بحماس وبتشاور بإيدها", lipsync: "اختياري" };
      const NOTE = { avatar: "الموديل بيخلّي الشخص اللي في الصورة يتكلم بالصوت اللي تختاره.", lipsync: "الموديل بيظبط شفايف اللي في القطعة على الصوت اللي تختاره (البرومبت مش ضروري).",
        video: "الموديل بياخد القطعة نفسها وبيعمل منها فيديو جديد بالبرومبت ده.", refs: "الموديل بيعمل فيديو جديد من المراجع اللي منشنتها.", image: "الموديل بيبدأ من صورة البداية ويحرّكها على حسب البرومبت.",
        startend: "الموديل بيعمل الحركة من صورة البداية لصورة النهاية.", text: "الموديل بيعمل الفيديو من الكلام بس، من غير القطعة." };
      if (!S.refs) loadRefs();
      return head + editable("opt:prompt", o.prompt || "", PH[mode]) + `<div class="am-ment" data-ment hidden></div>`
        + `<p class="bm-note">${NOTE[mode]} اكتب <b>@</b> علشان تمنشن شخصية أو خلفية أو صورة أو فولدر (بتتبعت للموديل كمرجع). بيتحفظ لوحده لما تقف عن الكتابة.${S.rec.est ? ` تكلفة التشغيل كله حوالي <b class="num">${AR_N(S.rec.est)}</b> نقطة.` : ""}</p>`;
    }
    if (l.f === "prompt" && s.verb === "genimg") {
      const m = imgModel(o);
      if (!S.refs) loadRefs();
      return head + editable("opt:prompt", o.prompt || "", m?.refs ? "مثلًا: @سارة ماسكة المنتج في @العيادة، إضاءة ناعمة، تصوير احترافي" : "مثلًا: كوباية قهوة على ترابيزة خشب جنب شباك، نور الصبح")
        + `<div class="am-ment" data-ment hidden></div><p class="bm-note">${m?.refs ? "اكتب <b>@</b> علشان تمنشن شخصية أو خلفية أو صورة من المكتبة، وبتتبعت للموديل كصورة مرجع." : "الموديل ده بيرسم من الوصف بس (مابيقبلش صور مرجع)."} الصور بتدخل الفيديو بالترتيب، وبتتحفظ في «مكتبة محتويات البراند ← الصور ← ✨ اتولّد بالموديل المخصص». بيتحفظ لوحده لما تقف عن الكتابة.</p>`;
    }
    if ((l.f === "text" || l.f === "lyrics") && s.verb === "genvoice") {
      const m = voModel(o), music = m.mode === "music";
      return head + editable(`opt:${l.f}`, o[l.f] || "", l.f === "lyrics" ? "[Verse] ... [Chorus] ..." : music ? "مثلًا: موسيقى هادية بيانو ودرامز خفيفة، مود متفائل" : "اكتب الكلام اللي عايزه يتقال بالظبط")
        + `<p class="bm-note">${l.f === "lyrics" ? "لو فاضية بتطلع موسيقى من غير كلام." : music ? "الموسيقى بتتحط تحت الفيديو، وبتتحفظ في «الموسيقى» في المكتبة." : "التعليق بيتحط على الفيديو، وبيتحفظ في «التعليقات الصوتية» في المكتبة."} بيتحفظ لوحده لما تقف عن الكتابة.</p>`;
    }
    if (l.f === "lang" && s.verb === "genvoice") {
      const D = Object.entries(M.dialects || {}), cur = M.dialects?.[o.lang] ? o.lang : "ar-eg-cairo";
      return head + `<p class="am-gh">عربي</p>` + pills("lang", D.filter(([, v]) => v.group === "ar").map(([k, v]) => [k, v.label]), cur) + `<p class="am-gh">لغات تانية</p>` + pills("lang", D.filter(([, v]) => v.group !== "ar").map(([k, v]) => [k, v.label]), cur);
    }
    if (l.f === "voice" && s.verb === "genvoice") {
      const m = voModel(o);
      if (m.mode === "std") { const lang = M.dialects?.[o.lang] ? o.lang : "ar-eg-cairo", vs = M.dialects?.[lang]?.voices || []; return head + pills("voice", vs.map((v) => [v, M.voices?.[v] || v]), vs.includes(o.voice) ? o.voice : vs[0]); }
      return head + pills("voice", (m.voices || []).map((v) => [v, v]), (m.voices || []).includes(o.voice) ? o.voice : (m.voices || [])[0]);
    }
    if (l.f === "model" && s.verb === "genimg") {
      const ms = M.img_models || [], cur = imgModel(o)?.key;
      return head + `<p class="bm-note">الموديلات اللي بتقبل صور مرجع بيظهرلها «صور المرجع». السعر لكل صورة.</p>`
        + `<p class="am-gh">بتقبل صور مرجع</p>` + pills("model", ms.filter((m) => m.refs).map((m) => [m.key, `${m.label} · $${m.price}`]), cur)
        + (ms.some((m) => !m.refs) ? `<p class="am-gh">من الوصف بس</p>` + pills("model", ms.filter((m) => !m.refs).map((m) => [m.key, `${m.label} · $${m.price}`]), cur) : "");
    }
    if (l.f === "model" && s.verb === "genvoice") {
      const ms = M.voice_models || [], cur = voModel(o).model, G = [["std", "🎙️ أصوات جاهزة بكل اللهجات"], ["tts", "🗣️ موديلات كلام على Atlas"], ["music", "🎵 موسيقى"]];
      return head + `<p class="bm-note">الموديلات اللي بتقبل صوت مرجع بيظهرلها «صوت مرجع» تمنشن فيه صوت شخصية أو صوتك أو تعليق من المكتبة.</p>`
        + G.map(([mode, t]) => { const xs = ms.filter((m) => m.mode === mode); return xs.length ? `<p class="am-gh">${t}</p>` + pills("model", xs.map((m) => [m.model, `${m.label}${m.ref ? " · بيقبل صوت مرجع" : ""}${m.price ? ` · $${m.price}` : ""}`]), cur) : ""; }).join("");
    }
    if (["refs", "start", "end", "audio", "ref"].includes(l.f)) return head + refsCard(s, l.f);
    if (l.f === "note") return head + editable("opt:note", o.note || "", "مثلًا: اقطع عند آخر كل جملة، وشيل أول ٣ ثواني، ومن غير السكوت الطويل") + `<p class="bm-note">لو سبته فاضي: قطع متساوية، والقطع بيتزق لأقرب سكوت علشان مايقطعش في نص كلمة. لو كتبت: المخ بيسمع الكلام ويقطّع على حسب طلبك (بيتخصم على قد طول الفيديو).</p>`;
    if (l.f === "model") {
      const cur = genModel(o)?.model;
      return head + `<p class="bm-note">كل موديل بياخد حاجة مختلفة، والنقط اللي حوالين الخطوة بتتغيّر على حسبه.</p>` + Object.entries(M.gen_modes || {}).map(([mode, t]) => {
        const xs = (M.gen_models || []).filter((m) => m.mode === mode);
        return xs.length ? `<p class="am-gh">${esc(t)}</p>` + pills("model", xs.map((m) => [m.model, `${m.label}${m.per_sec ? ` · $${m.per_sec}/ث` : ""}`]), cur) : "";
      }).join("");
    }
    if (l.f === "items") return head + mergeCard(s);
    if (s.verb === "pull" && l.f === "volume") return head + pills("volume", [[15, "١٥٪"], [25, "٢٥٪"], [35, "٣٥٪"], [50, "٥٠٪"], [70, "٧٠٪"], [100, "١٠٠٪"]], o.volume);
    if (["fit", "duck", "on", "use_piece"].includes(l.f)) return head + pills(l.f, [[true, "أيوه"], [false, "لأ"]], o[l.f]);
    const NUM = { count: [[1, "١"], [2, "٢"], [3, "٣"], [4, "٤"], [6, "٦"], [8, "٨"], [12, "١٢"]], sec: [[1.5, "١.٥ ث"], [2, "٢ ث"], [2.5, "٢.٥ ث"], [3, "٣ ث"], [4, "٤ ث"], [6, "٦ ث"]],
      max: [[1.5, "١.٥ ث"], [2, "٢ ث"], [3, "٣ ث"], [4, "٤ ث"], [6, "٦ ث"], [10, "١٠ ث"]], volume: [[15, "١٥٪"], [25, "٢٥٪"], [35, "٣٥٪"], [50, "٥٠٪"], [70, "٧٠٪"], [100, "١٠٠٪"]] };
    if (s.verb === "split" && l.f === "max") return head + pills("max", [[5, "٥ ث"], [8, "٨ ث"], [10, "١٠ ث"], [12, "١٢ ث"], [15, "١٥ ث"], [20, "٢٠ ث"], [30, "٣٠ ث"], [60, "٦٠ ث"]], o.max)
      + `<p class="bm-note">كل قطعة هتطلع أقل من (أو قد) الطول ده. فيديو ٤٠ ثانية على ١٥ = ٣ قطع = ٣ مسارات.</p>`;
    return head + pills(l.f, NUM[l.f] || [], o[l.f]);
  }
  const RULES_PH = { gen: "مثلًا: من غير نصوص على الشاشة، ألوان البراند، الشخصية دايمًا لابسة أبيض", genimg: "مثلًا: خلفية فاتحة، من غير ناس، ستايل مينيمال",
    pull: "مثلًا: قبل وبعد بس، من غير صور فيها وشوش", music: "مثلًا: هادية، من غير كلام", voice: "مثلًا: صوت سارة بس" };
  const RULES_NOTE = { gen: "بتتضاف للبرومبت كل مرة.", genimg: "بتتضاف للوصف كل مرة.", split: "بيختار الفيديو اللي يطابقها من المنشن.",
    pull: "بيختار من المنشن الملفات اللي تطابقها بالمعنى. ولو من الستوك: بتتضاف لكلمة البحث.", music: "بيختار من المنشن اللي يطابقها. ولو من الستوك: بتتضاف لكلمة البحث.",
    voice: "بيختار من المنشن التسجيل اللي يطابقها.", intro: "بيختار الفيديو اللي يطابقها.", outro: "بيختار الفيديو اللي يطابقها." };
  // «جمّع»: كل مخرج ممكن (القطعة الأصلية أو بعد «ولّد») زرار، واللي بتختاره بيتحط في الترتيب
  function mergeCard(s) {
    const sp = S.rec.steps.find((x) => x.verb === "split");
    if (!sp) return `<p class="bm-note">ضيف «قطّع الفيديو» الأول.</p>`;
    const L = lanesOf(sp), items = s.opts.items || [], one = !sp.pieces && L.length === 1;
    const name = (it) => { const pc = one ? "كل قطعة" : `القطعة ${AR_N(it.lane + 1)}`; if (it.node === "piece") return `${pc} (الأصلية)`; return `${pc} ← ولّد`; };
    const opts = L.flatMap((ln, li) => [{ lane: li, node: "piece" }, ...ln.filter((x) => x.verb === "gen").map((x) => ({ lane: li, node: x.id }))]);
    return `<p class="bm-note">اختار المخرجات اللي تتجمع في فيديو واحد، بالترتيب اللي عايزه. لو مااخترتش حاجة: آخر حاجة في كل مسار، بالترتيب.</p>
      <div class="bm-pills">${opts.map((it) => `<button class="bm-pill" data-mitem="${it.lane}|${esc(it.node)}">＋ ${esc(name(it))}</button>`).join("")}</div>
      ${items.length ? `<ol class="am-order">${items.map((it, i) => `<li><span>${esc(name(it))}</span><button class="bm-pill" data-mmv="${i}|-1" ${i ? "" : "disabled"}>↑</button><button class="bm-pill" data-mmv="${i}|1" ${i < items.length - 1 ? "" : "disabled"}>↓</button><button class="bm-pill" data-mrm="${i}">✕</button></li>`).join("")}</ol>
        <div class="bm-acts"><button class="bm-pill" data-mreset>رجّعها للافتراضي</button></div>` : ""}`;
  }
  const editable = (k, val, ph) => `<div class="bm-write" contenteditable="plaintext-only" data-k="${k}" data-ph="${esc(ph || "اكتب هنا…")}">${esc(val)}</div>`;
  // حسابات النشر المربوطة (من صفحة النشر): كل حساب زرار يتعلّم
  function platCard(o) {
    if (!S.pub) { if (!S.pubLoading) { S.pubLoading = true; api("/api/publisher").then((x) => { S.pub = x; refreshCard(); }).catch((err) => toast(err.message, true)).finally(() => (S.pubLoading = false)); } return `<p class="bm-note">بيجيب حساباتك…</p>`; }
    const list = S.pub.account_list || [], on = new Set(o.platforms || []);
    if (!list.length) return `<p class="bm-note">مفيش حسابات مربوطة. اربطها من صفحة النشر، وبعدين ارجع هنا.</p>`;
    return `<div class="bm-pills">${list.map((a) => { const key = `${a.platform}@${a.id}`; return `<button class="bm-pill${on.has(key) || on.has(a.platform) ? " on" : ""}" data-plat="${esc(key)}">${esc(S.pub.platforms[a.platform] || a.platform)} · ${esc(a.name || "")}</button>`; }).join("")}</div>`;
  }
  // الترتيب جوه خطوات العميل بس (صدّر وانشر ثابتين في الآخر)
  const moveActs = (s) => { const lc = laneOf(s.id), user = lc ? lc.ln : S.rec.steps.filter((x) => !S.meta.fixed.includes(x.verb) && x.verb !== "merge"), i = user.findIndex((x) => x.id === s.id), n = user.length;
    return `<div class="bm-acts"><button class="bm-pill" data-mv="-1" ${i <= 0 ? "disabled" : ""}>← خليها قبل</button><button class="bm-pill" data-mv="1" ${i >= n - 1 ? "disabled" : ""}>خليها بعد →</button>
      <button class="bm-pill" data-rmstep>🗑 شيل الخطوة</button></div>`; };
  function openCard(n, sec) {
    const card = S.el.querySelector(".bm-card");
    if (!n) { S.open = null; card.hidden = true; S.el.classList.remove("has-card"); markOpen(); return; }
    if (n.kind === "leaf" && n.l.type !== "action") { const b = S.byId[n.s.id]; if (b) return openCard(b, n.l.f); }
    const same = S.open?.id === n.id, top = same ? card.scrollTop : 0;
    if (!same) { S.cardSide = null; S.cardAt = null; S.srcQ = ""; S.refQ = ""; S.stockQ = null; }
    S.open = { id: n.id, br: n.kind === "leaf" ? n.s.id : n.kind === "branch" ? n.id : null, n };
    card.innerHTML = `<button class="bm-x" data-close aria-label="اقفل">✕</button>${cardHTML(n)}`;
    card.classList.toggle("wide", n.kind === "branch");
    card.hidden = false;
    card.scrollTop = top;
    if (sec) requestAnimationFrame(() => { const el = card.querySelector(`[data-sec="${CSS.escape(sec)}"]`); if (el) { card.scrollTop = el.offsetTop - 12; el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 900); } });
    S.el.classList.add("has-card");
    markOpen();
    placeCard(toScreen([n.px, n.py]));
  }
  function markOpen() { S.el.querySelectorAll(".bm-n.on").forEach((x) => x.classList.remove("on")); if (S.open?.n?.el) S.open.n.el.classList.add("on"); }
  function placeCard(p) {
    const card = S.el.querySelector(".bm-card");
    if (!p || card.hidden) return;
    const W = S.el.clientWidth, H = S.el.clientHeight, cw = card.offsetWidth, ch = card.offsetHeight;
    if (S.cardSide == null) {
      let r = p[0] >= W / 2;
      if (r && p[0] + 34 + cw > W - 8) r = false;
      if (!r && p[0] - 34 - cw < 8) r = true;
      S.cardSide = r;
    }
    let x = S.cardSide ? p[0] + 34 : p[0] - 34 - cw;
    x = Math.max(8, Math.min(W - cw - 8, x));
    const y = Math.max(topInset(), Math.min(H - ch - 8, p[1] - ch / 2));
    const k = `${Math.round(x)},${Math.round(y)}`;
    if (S.cardAt === k) return;
    S.cardAt = k;
    card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  const refreshCard = () => { if (S.open) { const n = S.nodes.find((x) => x.id === S.open.id) || null; openCard(n || null); } };

  // ---------- الحفظ ----------
  async function setRec(r, { card = true } = {}) {
    S.rec = r;
    layout();
    if (S.open) { const n = S.nodes.find((x) => x.id === S.open.id); if (n) { S.open.n = n; if (card) refreshCard(); else markOpen(); } else openCard(null); }
    if (r.busy) watch();
  }
  const saveSteps = (steps, opts) => aAPI("", { method: "PATCH", ...jsonBody({ steps }) }).then((r) => setRec(r, opts)).catch((err) => toast(err.message, true));
  // الخطوات جوه مسارات التقطيع: تعديلها ونقلها ومسحها زي خطوات الخط الأساسي
  const laneOf = (id) => { for (const sp of S.rec.steps) for (const [li, ln] of (sp.lanes || []).entries()) if (ln.some((y) => y.id === id)) return { sp, li, ln }; return null; };
  const mapStep = (id, fn) => S.rec.steps.map((x) => (x.id === id ? fn(x) : x.lanes ? { ...x, lanes: x.lanes.map((ln) => ln.map((y) => (y.id === id ? fn(y) : y))) } : x));
  const mapLanes = (fn) => S.rec.steps.map((x) => (x.verb === "split" ? { ...x, lanes: fn(lanesOf(x).map((ln) => [...ln])) } : x));
  const newId = () => Math.random().toString(36).slice(2, 10);
  const cloneLane = (ln) => ln.map((y) => ({ ...y, id: newId(), opts: JSON.parse(JSON.stringify(y.opts)) }));
  function watch() {
    clearTimeout(S.timer);
    S.timer = setTimeout(async () => {
      if (!S.el?.isConnected) return;
      try { const r = await aAPI(); await setRec(r, { card: S.open?.id === "run" }); if (!r.busy) toast("✓ القالب خلّص. التفاصيل في «ابدأ»"); } catch { /* السيرفر بيعيد التشغيل */ }
    }, 2500);
  }
  async function loadLib() { if (S.libLoading) return; S.libLoading = true; try { S.lib = await api("/api/library"); refreshCard(); } catch (err) { toast(err.message, true); } S.libLoading = false; }

  function bind(w) {
    w.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const el = e.target.closest(".bm-n"), r = w.getBoundingClientRect();
      if (!el) { if (!S.view || e.target.closest(".bm-card, .bm-zoom, .am-desc")) return; S.pan = { sx: e.clientX, sy: e.clientY, x: S.view.x, y: S.view.y, id: e.pointerId, moved: false }; return; }
      const n = S.byId[el.dataset.n];
      if (!n) return;
      const [wx, wy] = toWorld(e.clientX - r.left, e.clientY - r.top);
      S.drag = { n, el, sx: e.clientX, sy: e.clientY, ox: n.px - wx, oy: n.py - wy, x: n.px, y: n.py, moved: false, id: e.pointerId };
    });
    w.addEventListener("wheel", (e) => {
      if (e.target.closest(".bm-card, .am-desc")) return;
      e.preventDefault();
      const r = w.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0015)), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    w.querySelector(".bm-zoom").addEventListener("click", (e) => {
      const z = e.target.closest("[data-zoom]");
      if (!z) return;
      e.stopPropagation();
      if (z.dataset.zoom === "0") return fit(true);
      zoomAt(z.dataset.zoom === "1" ? 1.25 : .8, w.clientWidth / 2, w.clientHeight / 2);
    });
    const HOT_R = { leaf: 26, branch: 46 };
    const setHot = (n) => { if (S.hovNode === n) return; S.hovNode?.el?.classList.remove("hot"); S.hovNode = n; n?.el?.classList.add("hot"); S.el.classList.toggle("hotting", !!n); };
    w.addEventListener("pointermove", (e) => {
      const r = w.getBoundingClientRect();
      if (S.view && e.pointerType !== "touch") {
        S.mw = toWorld(e.clientX - r.left, e.clientY - r.top);
        if (!S.pan?.moved && !S.drag?.moved) {
          if (e.target.closest?.(".bm-card, .bm-zoom, .am-desc")) setHot(null);
          else { const dd = (n) => Math.hypot(S.mw[0] - n.px, S.mw[1] - n.py); if (!(S.hovNode && dd(S.hovNode) < HOT_R[S.hovNode.kind] * 1.9)) { let best = null, bd = 1e9; for (const n of S.nodes) { if (!HOT_R[n.kind]) continue; const k = dd(n); if (k < HOT_R[n.kind] && k < bd) { best = n; bd = k; } } setHot(best); } }
        }
      }
      if (S.dv && e.pointerType !== "touch") { S.dv.tx = e.clientX - r.left; S.dv.ty = e.clientY - r.top; if (S.dv.a < .01) { S.dv.mx = S.dv.tx; S.dv.my = S.dv.ty; } S.dv.ta = 1; }
      const pn = S.pan;
      if (pn && e.pointerId === pn.id) {
        if (!pn.moved && Math.hypot(e.clientX - pn.sx, e.clientY - pn.sy) < 4) return;
        if (!pn.moved) { pn.moved = true; w.setPointerCapture(e.pointerId); w.classList.add("panning"); }
        S.view.x = pn.x + e.clientX - pn.sx; S.view.y = pn.y + e.clientY - pn.sy; S.view.user = true;
        return applyView();
      }
      const d = S.drag;
      if (!d || e.pointerId !== d.id) return;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
      if (!d.moved) { d.moved = true; w.setPointerCapture(e.pointerId); w.classList.add("dragging"); d.el.classList.add("held"); }
      const [wx, wy] = toWorld(e.clientX - r.left, e.clientY - r.top);
      d.x = wx + d.ox; d.y = wy + d.oy;
    });
    const drop = (e) => {
      if (S.pan && (e.pointerId == null || e.pointerId === S.pan.id)) { if (S.pan.moved) { S.noClick = true; setTimeout(() => (S.noClick = false), 0); w.classList.remove("panning"); } S.pan = null; }
      const d = S.drag;
      if (!d || (e.pointerId != null && e.pointerId !== d.id)) return;
      S.drag = null;
      if (d.moved) { S.noClick = true; setTimeout(() => (S.noClick = false), 0); w.classList.remove("dragging"); d.el.classList.remove("held"); }
    };
    w.addEventListener("pointerleave", () => { if (S.dv) S.dv.ta = 0; S.mw = null; setHot(null); });
    w.addEventListener("pointerup", drop);
    w.addEventListener("pointercancel", drop);
    w.addEventListener("click", async (e) => {
      const t = e.target;
      if (S.noClick) { S.noClick = false; return; }
      const node = t.closest(".bm-n") || (S.hovNode && !t.closest(".bm-card, .bm-zoom, .am-desc") ? S.hovNode.el : null);
      if (node) {
        const n = S.nodes.find((x) => x.id === node.dataset.n);
        if (!n) return;
        if (S.open?.id === n.id) return openCard(null);
        if (n.kind === "leaf" && S.open?.id === n.s.id) return openCard(S.byId[n.s.id], n.l.f);
        return openCard(n);
      }
      if (t.closest("[data-close]")) return openCard(null);
      try {
        let b;
        const cur = S.open?.n, s = cur?.s;
        if ((b = t.closest("[data-pick]"))) { S.id = b.dataset.pick; storageSet("studiomania.auto", S.id); S.view = null; return setRec(await aAPI()); }
        if (t.closest("[data-new]")) {
          const name = (await uiPrompt("اسم القالب الجديد (مثلًا: قبل وبعد التبييض):")); if (name == null) return;
          const r = await api("/api/automations", { method: "POST", ...jsonBody({ name }) });
          S.list = await api("/api/automations"); S.id = r.id; storageSet("studiomania.auto", S.id); S.view = null; return setRec(r);
        }
        if (t.closest("[data-delrec]")) {
          if (!(await uiConfirm(`تمسح قالب «${S.rec.name}»؟`))) return;
          await aAPI("", { method: "DELETE" }); S.list = await api("/api/automations"); openCard(null); return start();
        }
        if ((b = t.closest("[data-addverb]"))) {
          const steps = [...S.rec.steps], at = steps.findIndex((x) => x.verb === "export");
          const ns = { id: Math.random().toString(36).slice(2, 10), verb: b.dataset.addverb, src: null, opts: { ...S.meta.verbs[b.dataset.addverb].opts } };
          steps.splice(at < 0 || ns.verb === "export" ? steps.length : at, 0, ns);
          openCard(null); await saveSteps(steps); const nn = S.byId[ns.id]; if (nn) openCard(nn); return;
        }
        if (t.closest("[data-saverec]")) {
          const name = (await uiPrompt("اسم القالب (علشان تختاره بعدين في الأوتوبايلوت):", S.rec.name || "")); if (name == null || !name.trim()) return;
          const r = await aAPI("", { method: "PATCH", ...jsonBody({ name: name.trim(), saved: true }) });
          S.list = await api("/api/automations"); toast(`💾 اتحفظ «${r.name}»`); return setRec(r);
        }
        if ((b = t.closest("[data-active]"))) {
          const r = await aAPI("", { method: "PATCH", ...jsonBody({ active: b.dataset.active === "1" }) });
          S.list = await api("/api/automations"); toast(r.active ? `⚡ «${r.name}» هو اللي متفعّل للأوتوبايلوت` : "اتقفل التفعيل"); return setRec(r);
        }
        if ((b = t.closest("[data-laneadd]"))) {
          const li = Number(b.dataset.laneadd), verb = b.dataset.verb, ns = { id: newId(), verb, src: null, opts: { ...S.meta.verbs[verb].opts } };
          openCard(null); await saveSteps(mapLanes((L) => L.map((ln, i) => (i === li ? [...ln, ns] : ln)))); const nn = S.byId[`${ns.id}:prompt`] || S.byId[ns.id]; if (nn) openCard(nn); return;
        }
        if ((b = t.closest("[data-lanecopy]"))) { const li = Number(b.dataset.lanecopy); return saveSteps(mapLanes((L) => L.map((ln, i) => (i === li ? ln : cloneLane(L[li]))))); }
        if (t.closest("[data-laneplus]")) { openCard(null); return saveSteps(mapLanes((L) => [...L, cloneLane(L[L.length - 1] || [])])); }
        if ((b = t.closest("[data-lanerm]"))) { const li = Number(b.dataset.lanerm); openCard(null); return saveSteps(mapLanes((L) => L.filter((_, i) => i !== li))); }
        if (t.closest("[data-desc-open]")) { S.descOpen = !S.descOpen; S.el.querySelector(".am-desc").classList.toggle("open", S.descOpen); if (S.descOpen) S.el.querySelector('[data-k="desc"]').focus(); return; }
        if (t.closest("[data-rec]")) return recToggle();
        if (t.closest("[data-desc-go]")) {
          const box = S.el.querySelector(".am-desc"), text = box.querySelector('[data-k="desc"]').innerText.trim();
          if (!text && !S.recBlob) return toast("اكتب أو سجّل اللي عايزه الأول", true);
          const fd = new FormData(); fd.append("text", text); if (S.recBlob) fd.append("audio", S.recBlob, "describe.webm");
          const go = box.querySelector("[data-desc-go]"); go.disabled = true; go.textContent = "⏳ بيفهم…";
          try {
            const r = await aAPI("/describe", { method: "POST", body: fd });
            S.recBlob = null; box.querySelector(".am-recst").textContent = ""; box.querySelector(".am-say").textContent = r.say || "";
            box.querySelector("[data-undo]").hidden = false; openCard(null); S.view = null; await setRec(r); toast("✨ الخطوات اتعملت. راجعها");
          } finally { go.disabled = false; go.textContent = "✨ اعمل الخطوات"; }
          return;
        }
        if (t.closest("[data-undo]")) { const r = await aAPI("/undo", { method: "POST" }); S.el.querySelector("[data-undo]").hidden = true; openCard(null); S.view = null; return setRec(r); }
        if (t.closest("[data-run]")) { const r = await aAPI("/run", { method: "POST" }); return setRec(r); }
        if ((b = t.closest("[data-openpj]"))) { storageSet(projectKey("free"), b.dataset.openpj); return showStep("6f"); }
        if (!s) return;
        if ((b = t.closest("[data-plat]"))) {
          const cur = new Set(s.opts.platforms || []), k = b.dataset.plat, plat = k.split("@")[0];
          if (cur.has(k) || cur.has(plat)) { cur.delete(k); cur.delete(plat); } else cur.add(k);
          return saveSteps(mapStep(s.id, (x) => ({ ...x, opts: { ...x.opts, platforms: [...cur] } })));
        }
        if ((b = t.closest("[data-mitem]"))) {
          const [lane, node] = b.dataset.mitem.split("|");
          return saveSteps(mapStep(s.id, (x) => ({ ...x, opts: { ...x.opts, items: [...(x.opts.items || []), { lane: Number(lane), node }] } })));
        }
        if ((b = t.closest("[data-mmv]"))) {
          const [i, d] = b.dataset.mmv.split("|").map(Number), it = [...(s.opts.items || [])], j = i + d;
          if (j < 0 || j >= it.length) return;
          [it[i], it[j]] = [it[j], it[i]];
          return saveSteps(mapStep(s.id, (x) => ({ ...x, opts: { ...x.opts, items: it } })));
        }
        if ((b = t.closest("[data-mrm]"))) { const i = Number(b.dataset.mrm); return saveSteps(mapStep(s.id, (x) => ({ ...x, opts: { ...x.opts, items: (x.opts.items || []).filter((_, k) => k !== i) } }))); }
        if (t.closest("[data-mreset]")) return saveSteps(mapStep(s.id, (x) => ({ ...x, opts: { ...x.opts, items: [] } })));
        if ((b = t.closest("[data-mv]"))) {
          const lc = laneOf(s.id);
          if (lc) {
            const ln = [...lc.ln], i = ln.findIndex((x) => x.id === s.id), j = i + Number(b.dataset.mv);
            if (j < 0 || j >= ln.length) return;
            [ln[i], ln[j]] = [ln[j], ln[i]];
            return saveSteps(mapLanes((L) => L.map((x, li) => (li === lc.li ? ln : x))));
          }
          // الخط الأساسي: «قطّع الفيديو» و«جمّع» بيتحركوا مع بعض كبلوك واحد
          const fixed = S.meta.fixed, user = S.rec.steps.filter((x) => !fixed.includes(x.verb)), tail = S.rec.steps.filter((x) => fixed.includes(x.verb)), units = [];
          for (const x of user) { if (x.verb === "merge" && units.length && units[units.length - 1][0].verb === "split") units[units.length - 1].push(x); else units.push([x]); }
          const i = units.findIndex((u) => u.some((x) => x.id === s.id)), j = i + Number(b.dataset.mv);
          if (j < 0 || j >= units.length) return;
          [units[i], units[j]] = [units[j], units[i]];
          return saveSteps([...units.flat(), ...tail]);
        }
        if (t.closest("[data-rmstep]")) {
          if (!(await uiConfirm(s.verb === "split" ? "تشيل التقطيع؟ المسارات و«جمّع» هيتشالوا معاه." : "تشيل الخطوة دي؟"))) return;
          openCard(null);
          return saveSteps(mapStep(s.id, () => null).filter(Boolean).map((x) => (x.lanes ? { ...x, lanes: x.lanes.map((ln) => ln.filter(Boolean)) } : x)).filter((x) => !(s.verb === "split" && x.verb === "merge")));
        }
        if ((b = t.closest("[data-refpick]"))) {
          const f = b.dataset.refpick, r = refFind(b.dataset.ref);
          if (!r) return;
          const it = { kind: r.kind, id: r.id, label: r.label, thumb: r.thumb };
          if (f !== "refs") return saveSteps(mapStep(s.id, (x) => ({ ...x, opts: { ...x.opts, [f]: it } })));
          const cur = s.opts.refs || [], has = cur.some((x) => refKey(x) === refKey(r));
          const maxR = s.verb === "genimg" ? imgModel(s.opts)?.max_refs || 4 : S.meta.max_refs || 6;
          if (!has && cur.length >= maxR) return toast(`أقصى عدد ${maxR} مراجع للموديل ده`, true);
          return saveSteps(mapStep(s.id, (x) => ({ ...x, opts: { ...x.opts, refs: has ? cur.filter((y) => refKey(y) !== refKey(r)) : [...cur, it] } })));
        }
        if ((b = t.closest("[data-refset]"))) { const [f, kind] = b.dataset.refset.split("|"); return saveSteps(mapStep(s.id, (x) => ({ ...x, opts: { ...x.opts, [f]: { kind, id: "", label: "" } } }))); }
        if ((b = t.closest("[data-refrm]"))) {
          const [f, ...k] = b.dataset.refrm.split("|"), key = k.join("|");
          return saveSteps(mapStep(s.id, (x) => ({ ...x, opts: { ...x.opts, ...(f === "refs" ? { refs: (x.opts.refs || []).filter((r) => refKey(r) !== key) } : { [f]: null }) } })));
        }
        if ((b = t.closest("[data-mention]"))) return insertMention(s, b.dataset.mention);
        if ((b = t.closest("[data-set]"))) {
          const k = b.dataset.set, raw = b.dataset.v, val = raw === "true" ? true : raw === "false" ? false : isNaN(Number(raw)) || raw === "" ? raw : Number(raw);
          return saveSteps(mapStep(s.id, (x) => ({ ...x, opts: { ...x.opts, [k]: val }, ...(k === "type" ? { src: x.src } : {}) })));
        }
        if ((b = t.closest("[data-src]"))) {
          const mode = b.dataset.src;
          const sq = mode === "stock" ? (S.stockQ ?? S.el.querySelector('[data-k="stockq"]')?.innerText ?? "").trim() : "";
          const src = mode === "search" ? (S.srcQ?.trim() ? { mode, q: S.srcQ.trim() } : null) : mode === "stock" ? (sq ? { mode, q: sq } : null) : { mode, id: b.dataset.id || null, label: b.dataset.label };
          if (!src) return toast(mode === "stock" ? "اكتب عايز إيه من الستوك الأول" : "اكتب الكلمة اللي هيدوّر بيها الأول", true);
          return saveSteps(mapStep(s.id, (x) => ({ ...x, src })));
        }
      } catch (err) { toast(err.message, true); }
    });
    // الكتابة: اسم الموديل بيتحفظ لما تقف، وكلمة البحث بتفلتر الملفات
    let typeT = 0;
    w.addEventListener("input", (e) => {
      const el = e.target.closest?.(".bm-write");
      if (!el) return;
      clearTimeout(typeT);
      if (el.dataset.k === "stockq") { S.stockQ = el.innerText.trim(); return; }
      if (el.dataset.k === "srcq") { S.srcQ = el.innerText.trim(); typeT = setTimeout(() => { const keep = S.srcQ; refreshCard(); const ed = S.el.querySelector('[data-k="srcq"]'); if (ed) { ed.focus(); const rg = document.createRange(); rg.selectNodeContents(ed); rg.collapse(false); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(rg); } S.srcQ = keep; }, 450); return; }
      if (el.dataset.k === "pubcap") { const sid = S.open?.n?.s?.id; typeT = setTimeout(() => { const v = el.innerText.trim(); saveSteps(mapStep(sid, (x) => ({ ...x, opts: { ...x.opts, caption: v } })), { card: false }); }, 800); return; }
      if (el.dataset.k === "refq") { S.refQ = el.innerText.trim(); const sec = el.closest("[data-sec]"), box = (sec || S.el).querySelector("[data-reflist]"), f = sec?.dataset.sec || S.open?.n?.l?.f, s = S.open?.n?.s; if (box && s) box.innerHTML = refList(S.refQ, f === "refs" ? s.opts.refs || [] : s.opts[f] ? [s.opts[f]] : [], f); return; }
      if (el.dataset.k === "opt:prompt") showMentions(el);
      if (el.dataset.k?.startsWith("opt:")) { const sid = S.open?.n?.s?.id, key = el.dataset.k.slice(4); typeT = setTimeout(() => { const v = el.innerText.trim(); saveSteps(mapStep(sid, (x) => ({ ...x, opts: { ...x.opts, [key]: v } })), { card: false }); }, 800); return; }
      if (el.dataset.k === "desc") return;
      if (el.dataset.k === "@name") typeT = setTimeout(async () => { const v = el.innerText.trim(); if (v && v !== S.rec.name) { const r = await aAPI("", { method: "PATCH", ...jsonBody({ name: v }) }); S.list = await api("/api/automations"); setRec(r, { card: false }); } }, 700);
    });
  }
  async function start() {
    S.list = await api("/api/automations");
    if (!S.list.length) { const r = await api("/api/automations", { method: "POST", ...jsonBody({ name: "قبل وبعد" }) }); S.list = [r]; }
    const last = storageGet("studiomania.auto");
    S.id = S.list.some((x) => x.id === last) ? last : S.list[0].id;
    S.view = null;
    await setRec(await aAPI());
  }
  // 🎙️ تسجيل الوصف بالصوت (بيتبعت مع الكتابة لو فيه)
  async function recToggle() {
    const box = S.el.querySelector(".am-desc"), btn = box.querySelector("[data-rec]"), st = box.querySelector(".am-recst");
    if (S.rec_?.state === "recording") { S.rec_.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }), chunks = [], t0 = Date.now();
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = () => { stream.getTracks().forEach((x) => x.stop()); S.recBlob = new Blob(chunks, { type: mr.mimeType || "audio/webm" }); btn.textContent = "🎙️ سجّل تاني"; st.textContent = `✓ تسجيل ${AR_N(Math.round((Date.now() - t0) / 1000))} ث جاهز`; };
      mr.start(); S.rec_ = mr; btn.textContent = "⏹ وقّف التسجيل"; st.textContent = "بيسجّل…";
    } catch { toast("مقدرتش أفتح المايك. اسمح للمتصفح يستخدمه", true); }
  }
  function html() { return `<div class="bm am" id="amWrap"><div class="nh-empty">بيحمّل…</div></div>`; }
  async function mount(root) {
    const w = root.querySelector("#amWrap");
    if (!w) return;
    S.el = w; S.open = null; S.lib = null; S.nodes = [];
    w.innerHTML = skeleton();
    S.dv = null; S.view = null;
    bind(w);
    dotsSize();
    try { S.meta = S.meta || await api("/api/automations-meta"); await start(); } catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; return; }
    if (!S.raf) S.raf = requestAnimationFrame(loop);
    if (!reduce.matches) S.nodes.forEach((n, i) => n.el?.animate([{ opacity: 0, translate: `${-n.x}px ${-n.y}px`, scale: .3 }, { opacity: 1, translate: "0 0", scale: 1 }],
      { duration: 700, delay: n.kind === "center" ? 0 : n.kind === "branch" ? 120 + n.i * 40 : 260 + (i % 9) * 25, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }));
  }
  return { html, mount, close: () => clearTimeout(S.timer) };
})();
