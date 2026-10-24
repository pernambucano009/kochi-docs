// 🧊 استوديو المشهد (في عجلة «ابدأ مشروع جديد»): مسودة 3D بأشكال بسيطة ← فيديو حقيقي.
// توصف بكلامك والمخ يبني الأشكال وحركة الكاميرا، أو تعدّلها بإيدك. «طلّع المسودة» بيسجّل فيديو رمادي من المتصفح نفسه (ببلاش)،
// وبعدين «ولّد» بيبعته لموديل بياخد فيديو مرجع مع صور العناصر والبرومبت، فالحركة والكادر ثابتين والموديل بيلوّن بس.
// كل توليدة «لقطة» بتفضل محفوظة، وتقدر تغيّر عنصر أو البرومبت وتولّد تاني بنفس الحركة بالظبط.
const SceneStudio = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, list: [], cur: null, meta: null, refs: null, sel: null, t: 0, play: false, view: "cam", saveT: 0, poll: 0, raf: 0, rec: false,
    orbit: { th: 0.7, ph: 0.35, r: 9 } };
  const G = {};   // three: renderer, scene, cameras, meshes
  const RATIO = { "9:16": [9, 16], "16:9": [16, 9], "1:1": [1, 1], "4:5": [4, 5] };
  const REC = { "9:16": [540, 960], "16:9": [960, 540], "1:1": [720, 720], "4:5": [640, 800] };
  const LIGHT = { studio: [0xffffff, 0xd9dce3, 1.1, 0.55], sunset: [0xffc28a, 0x6b4a7a, 1.2, 0.45], night: [0x9fb6ff, 0x141a2e, 0.7, 0.3], soft: [0xffffff, 0xf2efe9, 0.7, 0.85] };
  const SH = () => S.cur?.scene;
  const AR = (n, d = 1) => Number(n).toFixed(d);

  // ---------------------------------------------------------------- three
  function initGL(canvas) {
    const T = THREE;
    G.r = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    G.r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    G.r.outputColorSpace = T.SRGBColorSpace;
    G.r.shadowMap.enabled = true;
    G.scene = new T.Scene();
    G.cam = new T.PerspectiveCamera(40, 9 / 16, 0.05, 200);
    G.free = new T.PerspectiveCamera(45, 9 / 16, 0.05, 200);
    G.hemi = new T.HemisphereLight(0xffffff, 0x444444, 0.6);
    G.sun = new T.DirectionalLight(0xffffff, 1);
    G.sun.position.set(3, 6, 4); G.sun.castShadow = true; G.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(G.sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    G.scene.add(G.hemi, G.sun);
    G.floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.95 }));
    G.floor.rotation.x = -Math.PI / 2; G.floor.receiveShadow = true;
    G.grid = new T.GridHelper(20, 20, 0x555555, 0x333333); G.grid.material.transparent = true; G.grid.material.opacity = 0.35;
    G.scene.add(G.floor, G.grid);
    G.objs = new T.Group(); G.scene.add(G.objs);
    G.helpers = new T.Group(); G.scene.add(G.helpers);   // مسار الكاميرا في المنظر الحر
    G.tex = {};
    G.ray = new T.Raycaster();
  }
  function texOf(url) {
    if (!url) return null;
    if (!G.tex[url]) { G.tex[url] = new THREE.TextureLoader().load(url, () => draw()); G.tex[url].colorSpace = THREE.SRGBColorSpace; }
    return G.tex[url];
  }
  function geo(shape) {
    const T = THREE;
    return { box: () => new T.BoxGeometry(1, 1, 1), sphere: () => new T.SphereGeometry(0.5, 40, 24), cylinder: () => new T.CylinderGeometry(0.5, 0.5, 1, 40),
      cone: () => new T.ConeGeometry(0.5, 1, 40), torus: () => new T.TorusGeometry(0.38, 0.12, 20, 48), capsule: () => new T.CapsuleGeometry(0.3, 0.4, 8, 24),
      plane: () => new T.PlaneGeometry(1, 1), card: () => new T.PlaneGeometry(1, 1) }[shape]();
  }
  // المشهد كله بيتبني تاني لما الأشكال تتغيّر (عددها قليل)، والحركة بتتحسب كل فريم من الوقت
  function build() {
    const sc = SH(); if (!sc || !G.r) return;
    G.objs.clear();
    const L = LIGHT[sc.light] || LIGHT.studio;
    G.hemi.color.set(L[1]); G.hemi.intensity = L[3]; G.sun.color.set(L[0]); G.sun.intensity = L[2];
    G.scene.background = new THREE.Color(sc.bg);
    const fc = new THREE.Color(sc.bg); fc.offsetHSL(0, 0, 0.06);
    G.floor.material.color.copy(fc); G.floor.visible = sc.floor; G.grid.visible = sc.floor && !S.rec;
    for (const o of sc.objects) {
      const tex = texOf(o.img?.thumb);
      const mat = o.shape === "card" && tex ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
        : new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.55, metalness: 0.05, map: tex || null, side: ["plane", "card"].includes(o.shape) ? THREE.DoubleSide : THREE.FrontSide });
      const m = new THREE.Mesh(geo(o.shape), mat);
      m.castShadow = m.receiveShadow = true;
      m.userData.o = o;
      if (S.sel === o.id && !S.rec) {
        const edge = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xe5613e }));
        m.add(edge);
      }
      G.objs.add(m);
    }
    G.helpers.clear();
    if (sc.camera.length > 1) {
      const pts = []; for (let i = 0; i <= 60; i++) pts.push(camAt(sc.duration * i / 60).pos);
      G.helpers.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xe5613e })));
    }
    for (const k of sc.camera) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 4), new THREE.MeshBasicMaterial({ color: 0xe5613e, wireframe: true }));
      c.position.set(...k.pos); c.lookAt(...k.look); c.rotateX(Math.PI / 2);
      G.helpers.add(c);
    }
    draw();
  }
  const smooth = (u) => u * u * (3 - 2 * u);
  const lerp3 = (a, b, u) => a.map((x, i) => x + (b[i] - x) * u);
  const cr = (p0, p1, p2, p3, u) => p1.map((_, i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * u + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * u * u + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * u * u * u));
  // الكاميرا بتمشي بنعومة بين النقط (Catmull-Rom)، وبتبدأ وتقف براحة
  function camAt(t) {
    const K = SH().camera, n = K.length;
    if (n === 1 || t <= K[0].t) return { pos: new THREE.Vector3(...K[0].pos), look: new THREE.Vector3(...K[0].look), fov: K[0].fov };
    if (t >= K[n - 1].t) { const k = K[n - 1]; return { pos: new THREE.Vector3(...k.pos), look: new THREE.Vector3(...k.look), fov: k.fov }; }
    let i = 0; while (i < n - 2 && t >= K[i + 1].t) i++;
    let u = (t - K[i].t) / Math.max(1e-3, K[i + 1].t - K[i].t);
    u = n === 2 ? smooth(u) : i === 0 ? u * u * (2 - u) : i === n - 2 ? u * (1 + u - u * u) : u;
    const at = (j) => K[Math.max(0, Math.min(n - 1, j))];
    const P = (f) => cr(at(i - 1)[f], at(i)[f], at(i + 1)[f], at(i + 2)[f], u);
    return { pos: new THREE.Vector3(...P("pos")), look: new THREE.Vector3(...P("look")), fov: K[i].fov + (K[i + 1].fov - K[i].fov) * u };
  }
  function pose(t) {
    const sc = SH();
    G.objs.children.forEach((m) => {
      const o = m.userData.o, a = o.anim || {}, u = smooth(Math.min(1, t / Math.max(0.1, sc.duration)));
      const p = a.move ? lerp3(o.pos, a.move, u) : o.pos;
      m.position.set(p[0], p[1] + (a.bob ? Math.sin(t * Math.PI) * a.bob : 0), p[2]);
      // اللف دايمًا حوالين المحور الرأسي حتى لو الشكل مايل (YXZ)
      m.rotation.set(o.rot[0] * Math.PI / 180, (o.rot[1] + (a.spin || 0) * t) * Math.PI / 180, o.rot[2] * Math.PI / 180, "YXZ");
      m.scale.set(...o.scale);
    });
    const c = camAt(t);
    G.cam.position.copy(c.pos); G.cam.lookAt(c.look); G.cam.fov = c.fov; G.cam.updateProjectionMatrix();
  }
  function sizeGL(w, h) {
    G.r.setSize(w, h, false);
    G.cam.aspect = G.free.aspect = w / h; G.cam.updateProjectionMatrix(); G.free.updateProjectionMatrix();
  }
  function fitView() {
    const box = S.el?.querySelector(".sc-view"); if (!box || !G.r) return;
    const [a, b] = RATIO[SH().ratio] || RATIO["9:16"];
    const W = box.clientWidth, H = box.clientHeight || 600;
    let w = W, h = (W * b) / a; if (h > H) { h = H; w = (H * a) / b; }
    const cv = G.r.domElement; cv.style.width = `${Math.round(w)}px`; cv.style.height = `${Math.round(h)}px`;
    sizeGL(Math.round(w), Math.round(h));
  }
  function draw() {
    if (!G.r || !SH()) return;
    pose(S.t);
    G.helpers.visible = S.view === "free" && !S.rec;
    if (S.view === "free" && !S.rec) {
      const o = S.orbit, r = o.r;
      G.free.position.set(r * Math.cos(o.ph) * Math.sin(o.th), r * Math.sin(o.ph) + 0.6, r * Math.cos(o.ph) * Math.cos(o.th));
      G.free.lookAt(0, 0.6, 0);
    }
    G.r.render(G.scene, S.view === "free" && !S.rec ? G.free : G.cam);
    const tl = S.el?.querySelector("[data-sct]"); if (tl && !S.drag) tl.value = S.t;
    const tv = S.el?.querySelector("[data-sctv]"); if (tv) tv.textContent = `${AR(S.t)} / ${AR(SH().duration)} ث`;
  }
  function loop(now) {
    if (!S.el?.isConnected) { S.raf = 0; return; }
    if (S.play) {
      S.t += Math.min(0.1, (now - (S.last || now)) / 1000);
      if (S.t >= SH().duration) { S.t = SH().duration; S.play = false; S.el.querySelector("[data-scplay]").textContent = "▶"; }
      draw();
    }
    S.last = now;
    S.raf = requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- الواجهة
  const v3 = (k, v, step = 0.1) => `<span class="sc-v3">${["x", "y", "z"].map((a, i) => `<label><small>${a}</small><input type="number" step="${step}" data-scv="${k}.${i}" value="${v[i]}"></label>`).join("")}</span>`;
  function objEditor(o) {
    const M = S.meta, a = o.anim || {};
    return `<div class="sc-edit">
      <label class="sc-f"><span>الاسم</span><input data-sco="name" value="${esc(o.name)}"></label>
      <div class="sc-pills">${Object.entries(M.shapes).map(([k, t]) => `<button type="button" class="sc-pill${o.shape === k ? " on" : ""}" data-scshape="${k}">${esc(t)}</button>`).join("")}</div>
      <label class="sc-f"><span>هو ماذا في الحقيقة (يُرسل للنموذج)</span><textarea rows="2" data-sco="what" dir="auto" placeholder="مثلًا: حذاء جري بيضاء بنعل برتقالي">${esc(o.what)}</textarea></label>
      <div class="sc-row"><label class="sc-f sc-c"><span>اللون</span><input type="color" data-sco="color" value="${o.color}"></label>
        <div class="sc-f"><span>صورة العنصر (تُلصق على الشكل وتُرسل مرجع)</span>${o.img ? `<span class="sc-chip"><img src="${esc(o.img.thumb)}" alt=""><b>${esc(o.img.label)}</b><button type="button" data-scimgrm>✕</button></span>` : ""}
          <button type="button" class="sc-btn sm" data-scimg>🖼️ ${o.img ? "غيّر الصورة" : "اختر صورة"}</button></div></div>
      <div class="sc-f"><span>المكان</span>${v3("pos", o.pos)}</div>
      <div class="sc-f"><span>المقاس (متر)</span>${v3("scale", o.scale)}</div>
      <div class="sc-f"><span>الميلان (درجة)</span>${v3("rot", o.rot, 5)}</div>
      <div class="sc-row"><label class="sc-f"><span>يدور (درجة/ثانية)</span><input type="number" step="15" data-sco="anim.spin" value="${a.spin || 0}"></label>
        <label class="sc-f"><span>يظهر وينزل (متر)</span><input type="number" step="0.05" min="0" data-sco="anim.bob" value="${a.bob || 0}"></label></div>
      <div class="sc-f"><span>يتحرك حتى (إذا فارغ: ثابت مكانه)</span>${a.move ? v3("move", a.move) : ""}
        <button type="button" class="sc-btn sm" data-scmove>${a.move ? "✕ اجعله ثابت" : "➜ اجعله يتحرك"}</button></div>
      <div class="sc-acts"><button type="button" class="sc-btn sm" data-scdup>⧉ نسخة</button><button type="button" class="sc-btn sm danger" data-scdel>🗑 أزله</button></div></div>`;
  }
  function camEditor() {
    const sc = SH();
    return sc.camera.map((k, i) => `<div class="sc-key"><b>نقطة ${i + 1}</b>
      <label class="sc-f"><span>الثانية</span><input type="number" step="0.1" min="0" max="${sc.duration}" data-sck="${i}.t" value="${k.t}"></label>
      <div class="sc-f"><span>مكان الكاميرا</span>${["x", "y", "z"].map((a, j) => `<input type="number" step="0.1" data-sck="${i}.pos.${j}" value="${k.pos[j]}">`).join("")}</div>
      <div class="sc-f"><span>تنظر على</span>${["x", "y", "z"].map((a, j) => `<input type="number" step="0.1" data-sck="${i}.look.${j}" value="${k.look[j]}">`).join("")}</div>
      <label class="sc-f"><span>الزوم (fov)</span><input type="number" step="1" min="12" max="100" data-sck="${i}.fov" value="${k.fov}"></label>
      <div class="sc-acts"><button type="button" class="sc-btn sm" data-sckgo="${i}">👁 اذهب هنا</button>
        <button type="button" class="sc-btn sm" data-sckset="${i}" ${S.view === "free" ? "" : "disabled"} title="من المنظر الحر">📍 خذ المنظر الحالي</button>
        ${sc.camera.length > 2 ? `<button type="button" class="sc-btn sm danger" data-sckdel="${i}">✕</button>` : ""}</div></div>`).join("")
      + `<button type="button" class="sc-btn sm" data-sckadd>＋ نقطة كاميرا عند الثانية ${AR(S.t)}</button>`;
  }
  // من البروتوتايب: خطوات مرقّمة على اليمين (خطوة واحدة ظاهرة)، والمشهد على الشمال بأزرار صغيرة فوقه
  const STEPS = ["صِف المشهد بكلماتك", "الأشكال", "حركة الكاميرا", "المسودة", "الفيديو الحقيقي"];
  const SIC = { ratio: "M7 3.5h10v17H7z", light: "M12 3v2 M12 19v2 M4.2 4.2l1.4 1.4 M18.4 18.4l1.4 1.4 M3 12h2 M19 12h2 M4.2 19.8l1.4-1.4 M18.4 5.6l1.4-1.4 M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z",
    bg: "M4.5 5h15v14h-15z M3.5 15.5l4.5-4.5 4 4 3-3 5 5", view: "M3 7l9-4 9 4-9 4z M3 7v10l9 4 9-4V7 M12 11v10", list: "M5 7h14 M5 12h14 M5 17h10", plus: "M12 5v14 M5 12h14",
    play: "M8 5v14l11-7z", pause: "M8 5h3v14H8z M13 5h3v14h-3z" };
  const sic = (k, s = 16) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="${SIC[k]}"/></svg>`;
  function stepBody(d, sc, M, sel, ms, model, est) {
    const k = S.step;
    if (k === 1) return `<textarea class="sc2-pr" rows="4" data-scdesc dir="auto" aria-label="وصف المشهد" placeholder="مثلًا: حذاء يبحث على قاعدة في المنتصف، والكاميرا تبدأ بعيدة ثم تقترب ببطء وترتفع">${esc(S.desc || "")}</textarea>
      <p class="sc-note">${d.say ? esc(d.say) : "يبني العقل الأشكال وحركة الكاميرا (تُخصم التكلفة حسب طول الوصف)، ثم تعدّل ما تريد بنفسك."}</p>`;
    if (k === 2) return `<div class="sc-pills">${sc.objects.map((o) => `<button type="button" class="sc-pill${o.id === S.sel ? " on" : ""}" data-scsel="${o.id}">${esc(o.name)}</button>`).join("")}
        <button type="button" class="sc-pill" data-scadd>＋ شكل</button></div>
      ${sel ? objEditor(sel) : `<p class="sc-note">اختر شكلًا هنا أو في المشهد لتعدّله. كل شكل يمثّل شيئًا حقيقيًا: اكتب ما هو، وأضف صورته أن وُجدت.</p>`}`;
    if (k === 3) return `<p class="sc-note">تتحرك الكاميرا بنعومة من نقطة إلى أخرى. الأسهل: اختر «منظر حر» من أعلى المشهد، ولُفّ حتى الزاوية التي تريدها، ثم «خذ المنظر الحالي».</p>${camEditor()}`;
    if (k === 4) return d.draft_url ? `<video src="${esc(d.draft_url)}" controls muted playsinline loop class="sc-draft"></video>` : `<p class="sc-note">تُسجَّل المسودة من المتصفح مجانًا.</p>`;
    return `<label class="sc-f"><span>الوصف الحقيقي (الخامات والإضاءة والأجواء)</span><textarea rows="3" data-scprompt dir="auto">${esc(d.prompt)}</textarea></label>
      <div class="sc-f"><span>مراجع إضافية (اختيارية)</span><div class="sc-pills">${(d.refs || []).map((r) => `<span class="sc-chip"><img src="${esc(r.thumb)}" alt=""><b>${esc(r.label)}</b><button type="button" data-screfrm="${esc(r.kind)}|${esc(r.id)}">✕</button></span>`).join("")}
        <button type="button" class="sc-pill" data-scref>＋ مرجع</button></div></div>
      <div class="sc-pills">${ms.map((m) => `<button type="button" class="sc-pill${m.model === model?.model ? " on" : ""}" data-scmodelp="${esc(m.model)}">${esc(m.label)}${m.per_sec ? ` · $${m.per_sec}/ث` : ""}</button>`).join("")}</div>
      ${!d.draft_url ? `<p class="sc-note">سجّل المسودة أولًا.</p>` : ""}
      ${(d.takes || []).length ? `<div class="sc-takes">${[...(d.takes || [])].reverse().map((t, i, a) => `<figure class="sc-take ${t.status}">
        ${t.status === "done" ? `<video src="${esc(t.url)}" controls playsinline loop></video>` : `<div class="sc-ph">${t.status === "failed" ? "⚠️" : '<span class="flw-spin"></span>'}<small>${esc(t.error || t.step || "")}</small></div>`}
        <figcaption><b>لقطة ${a.length - i}</b><span class="sc-acts">${t.url ? `<a class="sc-ib" href="${esc(t.url)}" download aria-label="نزّل" title="نزّل">⬇</a>` : ""}<button type="button" class="sc-ib" data-sctakedel="${t.id}" aria-label="احذف" title="احذف">✕</button></span></figcaption></figure>`).join("")}</div>` : ""}`;
  }
  function pop(sc, M) {
    if (S.pop === "ratio") return `<div class="sc2-pop"><div class="sc-pills">${M.ratios.map((r) => `<button type="button" class="sc-pill${r === sc.ratio ? " on" : ""}" data-scset="ratio|${r}">${r}</button>`).join("")}</div>
      <label class="sc-f"><span>المدة (ثانية)</span><input type="number" min="2" max="15" step="0.5" data-scs="duration" value="${sc.duration}"></label></div>`;
    if (S.pop === "light") return `<div class="sc2-pop"><div class="sc-pills">${Object.entries(M.lights).map(([k, t]) => `<button type="button" class="sc-pill${k === sc.light ? " on" : ""}" data-scset="light|${k}">${esc(t)}</button>`).join("")}</div></div>`;
    if (S.pop === "bg") return `<div class="sc2-pop"><label class="sc-f sc-c"><span>لون الخلفية</span><input type="color" data-scs="bg" value="${sc.bg}"></label><label class="sc-f sc-chk"><input type="checkbox" data-scs="floor" ${sc.floor ? "checked" : ""}><span>أرضية</span></label></div>`;
    if (S.pop === "view") return `<div class="sc2-pop"><div class="sc-pills"><button type="button" class="sc-pill${S.view === "cam" ? " on" : ""}" data-scview="cam">عين الكاميرا</button><button type="button" class="sc-pill${S.view === "free" ? " on" : ""}" data-scview="free">منظر حر (اسحب ولُفّ)</button></div></div>`;
    return "";
  }
  function render() {
    const d = S.cur, sc = SH(), M = S.meta;
    const sel = sc.objects.find((o) => o.id === S.sel);
    const ms = M.models || [], model = ms.find((m) => m.model === d.model) || ms[0];
    const est = model ? Math.max(1, Math.round((model.per_sec || 0.17) * sc.duration * (model.mode === "refs" ? 2 : 1) * 100)) : 0;
    S.step = S.step || (d.draft_url ? 5 : sc.objects.length ? 2 : 1);
    const k = S.step, busyGen = (d.takes || []).some((t) => t.status === "working");
    const cta = k === 1 ? `<button type="button" class="sc2-go" data-scplan>ابنِ المسودة</button>`
      : k === 4 ? `<button type="button" class="sc2-go" data-screc ${S.rec ? "disabled" : ""}>${d.draft_url ? "سجّلها مرة أخرى" : "سجّل المسودة"}</button>${d.draft_url ? `<button type="button" class="sc2-ghost" data-scstep="5">التالي</button>` : ""}`
      : k === 5 ? `<button type="button" class="sc2-go" data-scgen ${d.draft_url && !busyGen ? "" : "disabled"}>ولّد الفيديو</button><span class="sc-note">التكلفة نحو <b class="num">${est}</b> نقطة</span>`
      : `<button type="button" class="sc2-go" data-scstep="${k + 1}">التالي</button>`;
    const ib = (p, t) => `<button type="button" class="sc-ib dark${S.pop === p ? " on" : ""}" data-scpop="${p}" title="${t}" aria-label="${t}">${sic(p)}</button>`;
    S.el.innerHTML = `<div class="sc2">
      <div class="sc2-l">
        <div class="sc2-h"><div><span class="latin en-k">SCENE STUDIO</span><h2>${esc(d.name || "استوديو المشهد")}</h2></div>
          <div class="sc-acts"><span class="sc2-wrap"><button type="button" class="sc-ib" data-scpop="list" title="مشاهدي" aria-label="مشاهدي">${sic("list")}</button>
            ${S.pop === "list" ? `<div class="sc2-pop sc2-list">${S.list.map((x) => `<button type="button" class="sc-pill${x.id === d.id ? " on" : ""}" data-scpick="${x.id}">${esc(x.name)}${x.takes ? ` · ${x.takes}` : ""}</button>`).join("")}</div>` : ""}</span>
            <button type="button" class="sc-ib" data-scnew title="مشهد جديد" aria-label="مشهد جديد">${sic("plus")}</button></div></div>
        <div class="sc2-steps">${STEPS.map((t, i) => `<button type="button" class="sc2-st${i + 1 === k ? " on" : i + 1 < k ? " done" : ""}" data-scstep="${i + 1}" title="${t}" aria-label="${t}">${i + 1}</button>${i < STEPS.length - 1 ? `<span class="sc2-ln"></span>` : ""}`).join("")}</div>
        <div class="sc2-body"><h3>${STEPS[k - 1]}</h3>${stepBody(d, sc, M, sel, ms, model, est)}</div>
        <div class="sc2-cta">${cta}${k > 1 ? `<button type="button" class="sc2-ghost" data-scstep="${k - 1}">السابق</button>` : ""}</div>
      </div>
      <div class="sc2-r">
        <div class="sc2-stage"><div class="sc-view"><canvas></canvas>${S.rec ? `<div class="sc-recov">⏺ جارٍ تسجيل المسودة…</div>` : ""}</div>
          <div class="sc2-tools">${ib("ratio", `المقاس ${sc.ratio} · ${sc.duration} ث`)}${ib("light", "الإضاءة")}${ib("bg", "الخلفية والأرضية")}${ib("view", S.view === "cam" ? "عين الكاميرا" : "منظر حر")}</div>${pop(sc, M)}</div>
        <div class="sc2-time"><button type="button" class="sc-ib" data-scplay aria-label="شغّل الحركة">${sic(S.play ? "pause" : "play")}</button>
          <input type="range" min="0" max="${sc.duration}" step="0.02" value="${S.t}" data-sct aria-label="الزمن"><small class="num" data-sctv dir="ltr"></small></div>
      </div>
      <div class="sc-pick" hidden></div></div>`;
    const cv = S.el.querySelector("canvas");
    if (G.r) { G.r.dispose(); G.r = null; }
    initGL(cv); build(); fitView(); draw();
    bindCanvas(cv);
  }
  // اسحب على المنظر الحر علشان تلف حوالين المشهد، والرول بيقرّب؛ ودوسة على شكل بتختاره
  function bindCanvas(cv) {
    let drag = null;
    cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, th: S.orbit.th, ph: S.orbit.ph, moved: false }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      if (S.view !== "free" || !drag.moved) return;
      S.orbit.th = drag.th - dx * 0.01; S.orbit.ph = Math.max(-0.1, Math.min(1.45, drag.ph + dy * 0.01)); draw();
    });
    cv.addEventListener("pointerup", (e) => {
      const d = drag; drag = null;
      if (!d || d.moved) return;
      const r = cv.getBoundingClientRect();
      G.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), S.view === "free" ? G.free : G.cam);
      const hit = G.ray.intersectObjects(G.objs.children, false)[0];
      S.sel = hit ? hit.object.userData.o.id : null; render();
    });
    cv.addEventListener("wheel", (e) => { if (S.view !== "free") return; e.preventDefault(); S.orbit.r = Math.max(2, Math.min(30, S.orbit.r * Math.exp(e.deltaY * 0.001))); draw(); }, { passive: false });
  }

  // ---------------------------------------------------------------- الحفظ والأوامر
  const sAPI = (path = "", opts) => api(`/api/scenes/${S.cur.id}${path}`, opts);
  function save(fields, redraw = true) {
    Object.assign(S.cur, fields);
    if (fields.scene) { S.cur.draft = null; S.cur.draft_url = null; }
    if (redraw) { build(); }
    clearTimeout(S.saveT);
    S.saveT = setTimeout(async () => { try { const r = await sAPI("", { method: "PATCH", ...jsonBody(fields) }); S.cur.draft_url = r.draft_url; S.cur.draft = r.draft; } catch (err) { toast(err.message, true); } }, 500);
  }
  const editScene = (fn) => { const sc = JSON.parse(JSON.stringify(SH())); fn(sc); save({ scene: sc }); };
  const newId = () => Math.random().toString(36).slice(2, 10);
  function setPath(obj, path, val) { const ks = path.split("."); let o = obj; ks.slice(0, -1).forEach((k) => (o = o[k] ??= {})); o[ks[ks.length - 1]] = val; }
  async function pickRef(onPick) {
    const box = S.el.querySelector(".sc-pick");
    if (!S.refs) { try { S.refs = await api("/api/automations-refs"); } catch (err) { return toast(err.message, true); } }
    const imgs = S.refs.filter((r) => ["char", "twin", "bg"].includes(r.kind) || (r.kind === "file" && /صورة/.test(r.sub)));
    box.hidden = false;
    box.innerHTML = `<div class="sc-pick-in"><b>اختر صورة (شخصية، أفاتار، خلفية، أو صورة من المكتبة)</b>
      <div class="sc-grid">${imgs.map((r, i) => `<button type="button" data-scpk="${i}">${r.thumb ? `<img src="${esc(r.thumb)}" alt="">` : "🖼️"}<small>${esc(r.label)}</small></button>`).join("") || `<p class="sc-note">لا يوجد صور. ارفع صور في «مكتبة المحتويات».</p>`}</div>
      <div class="sc-acts"><button type="button" class="sc-btn" data-scpkx>إلغاء</button></div></div>`;
    box.onclick = (e) => {
      const b = e.target.closest("[data-scpk]");
      if (e.target.closest("[data-scpkx]") || e.target === box) { box.hidden = true; return; }
      if (!b) return;
      const r = imgs[+b.dataset.scpk]; box.hidden = true;
      onPick({ kind: r.kind, id: r.id, label: r.label, thumb: r.thumb });
    };
  }
  // المسودة: كل فريم بيترسم لوحده بالوقت بتاعه بالظبط (٢٤ فريم في الثانية) بالمقاس الحقيقي، والسيرفر بيلمّهم فيديو.
  // كده المدة والحركة مظبوطين مهما كان الجهاز بطيء (مش تسجيل للشاشة)
  const FPS = 24;
  // VP8 جوه ملف IVF (هيدر بسيط بنكتبه بإيدنا): كل فريم بوقته بالظبط، والملف صغير وسريع
  function ivf(frames, w, h) {
    const size = 32 + frames.reduce((a, f) => a + 12 + f.length, 0), buf = new Uint8Array(size), dv = new DataView(buf.buffer);
    buf.set([68, 75, 73, 70]); dv.setUint16(4, 0, true); dv.setUint16(6, 32, true); buf.set([86, 80, 56, 48], 8);
    dv.setUint16(12, w, true); dv.setUint16(14, h, true); dv.setUint32(16, FPS, true); dv.setUint32(20, 1, true); dv.setUint32(24, frames.length, true);
    let o = 32;
    frames.forEach((f, i) => { dv.setUint32(o, f.length, true); dv.setUint32(o + 4, i, true); dv.setUint32(o + 8, 0, true); buf.set(f, o + 12); o += 12 + f.length; });
    return new Blob([buf], { type: "video/x-ivf" });
  }
  async function encodeVP8(n, w, h, drawAt, prog) {
    if (!window.VideoEncoder) return null;
    try { if (!(await VideoEncoder.isConfigSupported({ codec: "vp8", width: w, height: h })).supported) return null; } catch { return null; }
    const out = [];
    let fail = null;
    const enc = new VideoEncoder({ output: (c) => { const b = new Uint8Array(c.byteLength); c.copyTo(b); out.push(b); }, error: (e) => (fail = e) });
    enc.configure({ codec: "vp8", width: w, height: h, bitrate: 8e6, framerate: FPS });
    for (let i = 0; i < n && !fail; i++) {
      drawAt(i / FPS);
      const vf = new VideoFrame(G.r.domElement, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      enc.encode(vf, { keyFrame: i % 48 === 0 }); vf.close();
      if (enc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 0));
      if (i % 12 === 0) { prog(i / n); await new Promise((r) => setTimeout(r, 0)); }
    }
    await enc.flush(); enc.close();
    return fail || out.length < n ? null : ivf(out, w, h);
  }
  // المسودة: كل فريم بيترسم لوحده بالوقت بتاعه بالظبط (٢٤ فريم في الثانية) بالمقاس الحقيقي، فالمدة والحركة مظبوطين مهما كان الجهاز بطيء.
  // المتصفحات الجديدة بتعمل الفيديو بنفسها (WebCodecs)، والقديمة بتبعت الفريمات صور والسيرفر بيلمّهم
  async function record() {
    const sc = SH(), [w, h] = REC[sc.ratio] || REC["9:16"], n = Math.max(2, Math.round(sc.duration * FPS));
    S.rec = true; S.play = false; S.sel = null; S.view = "cam";
    render();
    sizeGL(w, h);
    const ov = S.el.querySelector(".sc-recov"), prog = (f) => { if (ov) ov.textContent = `⏺ يرسم المسودة… ${Math.round(f * 100)}٪`; };
    const drawAt = (t) => { S.t = t; pose(t); G.r.render(G.scene, G.cam); };
    const fd = new FormData();
    fd.append("fps", String(FPS));
    let vid = null;
    try { vid = await encodeVP8(n, w, h, drawAt, prog); } catch { vid = null; }
    if (vid) fd.append("video", vid, "draft.ivf");
    else {
      for (let i = 0; i < n; i++) {
        drawAt(i / FPS);
        const blob = await new Promise((res) => G.r.domElement.toBlob(res, "image/jpeg", 0.88));
        fd.append("frames", blob, `f${String(i).padStart(4, "0")}.jpg`);
        if (i % 6 === 0) prog(i / n);
      }
    }
    if (ov) ov.textContent = "⏳ جارٍ التجهيز المسودة…";
    try { Object.assign(S.cur, await sAPI("/draft", { method: "POST", body: fd })); toast("✓ المسودة جاهزة. ولّد الآن الفيديو الحقيقي"); S.step = 5; }
    catch (err) { toast(err.message, true); }
    S.rec = false; S.t = 0;
    render();
  }
  function watch() {
    clearTimeout(S.poll);
    if (!(S.cur?.takes || []).some((t) => t.status === "working")) return;
    S.poll = setTimeout(async () => {
      if (!S.el?.isConnected || !S.cur) return;
      try {
        const r = await sAPI();
        const before = (S.cur.takes || []).map((t) => t.status).join();
        Object.assign(S.cur, { takes: r.takes });
        if (r.takes.map((t) => t.status).join() !== before) {   // نغيّر قائمة اللقطات فقط، المشهد لا يُرسم آخر
          render();
          if (r.takes.some((t) => t.status === "done")) toast("✓ اللقطة جاهزة");
        }
      } catch { /* يحاول مرة أخرى */ }
      watch();
    }, 4000);
  }
  async function onClick(e) {
    const q = (s) => e.target.closest(s);
    let b;
    try {
      if ((b = q("[data-scpick]"))) return load(b.dataset.scpick);
      if (q("[data-scnew]")) {
        const name = await uiPrompt("اسم المشهد (مثلًا: إعلان الحذاء):"); if (name == null) return;
        const r = await api("/api/scenes", { method: "POST", ...jsonBody({ name }) }); S.list = await api("/api/scenes"); return load(r.id);
      }
      if ((b = q("[data-scview]"))) { S.view = b.dataset.scview; S.pop = null; return render(); }
      if ((b = q("[data-scpop]"))) { S.pop = S.pop === b.dataset.scpop ? null : b.dataset.scpop; return render(); }
      if ((b = q("[data-scstep]"))) { S.step = +b.dataset.scstep; S.pop = null; return render(); }
      if ((b = q("[data-scset]"))) { const [k, v] = b.dataset.scset.split("|"); editScene((sc) => (sc[k] = v)); return render(); }
      if ((b = q("[data-scmodelp]"))) { save({ model: b.dataset.scmodelp }, false); S.cur.model = b.dataset.scmodelp; return render(); }
      if (S.pop && !q(".sc2-pop")) { S.pop = null; render(); }
      if (q("[data-scplay]")) { if (S.t >= SH().duration) S.t = 0; S.play = !S.play; S.last = performance.now(); b = q("[data-scplay]"); b.innerHTML = sic(S.play ? "pause" : "play"); return; }
      if (q("[data-scplan]")) {
        const text = S.el.querySelector("[data-scdesc]").value.trim(); S.desc = text;
        if (!text) return toast("صِف المشهد أولًا", true);
        b = q("[data-scplan]"); b.disabled = true; b.textContent = "جارٍ البناء…";
        try { S.cur = await sAPI("/plan", { method: "POST", ...jsonBody({ text }) }); S.sel = null; S.t = 0; S.step = 2; render(); toast("✓ بُنيت المسودة. شغّلها وعدّل ما تريد"); }
        finally { b.disabled = false; }
        return;
      }
      if ((b = q("[data-scsel]"))) { S.sel = S.sel === b.dataset.scsel ? null : b.dataset.scsel; return render(); }
      if (q("[data-scadd]")) { const id = newId(); editScene((sc) => sc.objects.push({ id, name: "شكل جديد", shape: "box", color: "#9a9a9a", pos: [1.2, 0.5, 0], rot: [0, 0, 0], scale: [1, 1, 1], img: null, what: "", anim: { spin: 0, bob: 0, move: null } })); S.sel = id; return render(); }
      const o = SH().objects.find((x) => x.id === S.sel);
      if (o && (b = q("[data-scshape]"))) {
        editScene((sc) => { const x = sc.objects.find((y) => y.id === o.id); x.shape = b.dataset.scshape; if (x.shape === "card") { x.rot = [0, x.rot[1], 0]; x.scale = [Math.max(x.scale[0], 0.8), Math.max(x.scale[1], 0.8), 0.02]; } });
        return render();
      }
      if (o && q("[data-scdup]")) { const id = newId(); editScene((sc) => sc.objects.push({ ...JSON.parse(JSON.stringify(o)), id, name: `${o.name} ٢`, pos: [o.pos[0] + 1, o.pos[1], o.pos[2]] })); S.sel = id; return render(); }
      if (o && q("[data-scdel]")) { editScene((sc) => (sc.objects = sc.objects.filter((x) => x.id !== o.id))); S.sel = null; return render(); }
      if (o && q("[data-scmove]")) { editScene((sc) => { const x = sc.objects.find((y) => y.id === o.id); x.anim.move = x.anim.move ? null : [x.pos[0], x.pos[1], x.pos[2] + 1.5]; }); return render(); }
      if (o && q("[data-scimgrm]")) { editScene((sc) => (sc.objects.find((x) => x.id === o.id).img = null)); return render(); }
      if (o && q("[data-scimg]")) return pickRef((r) => { editScene((sc) => (sc.objects.find((x) => x.id === o.id).img = r)); render(); });
      if ((b = q("[data-sckgo]"))) { S.t = SH().camera[+b.dataset.sckgo].t; S.view = "cam"; return render(); }
      if ((b = q("[data-sckset]"))) {
        const p = G.free.position, i = +b.dataset.sckset;
        editScene((sc) => { sc.camera[i].pos = [p.x, p.y, p.z].map((v) => +v.toFixed(2)); sc.camera[i].look = [0, 0.6, 0]; sc.camera[i].fov = Math.round(G.free.fov); });
        toast("✓ أخذت النقطة المنظر الحالي"); return render();
      }
      if ((b = q("[data-sckdel]"))) { editScene((sc) => sc.camera.splice(+b.dataset.sckdel, 1)); return render(); }
      if (q("[data-sckadd]")) {
        const c = S.view === "free" ? { pos: G.free.position, look: new THREE.Vector3(0, 0.6, 0), fov: G.free.fov } : camAt(S.t);
        editScene((sc) => { sc.camera.push({ t: +S.t.toFixed(2), pos: [c.pos.x, c.pos.y, c.pos.z].map((v) => +v.toFixed(2)), look: [c.look.x, c.look.y, c.look.z].map((v) => +v.toFixed(2)), fov: Math.round(c.fov) }); sc.camera.sort((a, x) => a.t - x.t); });
        return render();
      }
      if (q("[data-screc]")) return record();
      if (q("[data-scref]")) return pickRef((r) => { const refs = [...(S.cur.refs || [])]; if (!refs.some((x) => x.kind === r.kind && x.id === r.id)) refs.push(r); save({ refs: refs.slice(0, 6) }, false); render(); });
      if ((b = q("[data-screfrm]"))) { const [k, ...id] = b.dataset.screfrm.split("|"); save({ refs: (S.cur.refs || []).filter((x) => !(x.kind === k && x.id === id.join("|"))) }, false); return render(); }
      if (q("[data-scgen]")) {
        clearTimeout(S.saveT);
        await sAPI("", { method: "PATCH", ...jsonBody({ prompt: S.cur.prompt, model: S.cur.model || (S.meta.models || [])[0]?.model, refs: S.cur.refs || [] }) });
        S.cur = await sAPI("/generate", { method: "POST" }); render(); watch(); return toast("✓ بدأ التوليد، وتظهر اللقطة عند انتهائها");
      }
      if ((b = q("[data-sctakedel]"))) { if (!(await uiConfirm("هل تحذف هذه اللقطة؟"))) return; S.cur = await sAPI(`/takes/${b.dataset.sctakedel}`, { method: "DELETE" }); return render(); }
    } catch (err) { toast(err.message, true); }
  }
  function onInput(e) {
    const t = e.target, val = t.type === "checkbox" ? t.checked : t.type === "number" ? Number(t.value) : t.value;
    if (t.matches("[data-sct]")) { S.t = Number(t.value); S.play = false; return draw(); }
    if (t.matches("[data-scdesc]")) { S.desc = t.value; return; }
    if (t.matches("[data-scprompt]")) return save({ prompt: t.value }, false);
    if (t.matches("[data-scmodel]")) return save({ model: t.value }, false);
    if (t.dataset.scs) { if (t.type === "number" && !(val > 0)) return; editScene((sc) => (sc[t.dataset.scs] = val)); if (["ratio", "duration"].includes(t.dataset.scs)) { if (e.type === "change") render(); } else draw(); return; }
    const o = SH().objects.find((x) => x.id === S.sel);
    if (o && t.dataset.sco) { if (t.type === "number" && Number.isNaN(val)) return; editScene((sc) => setPath(sc.objects.find((x) => x.id === o.id), t.dataset.sco, val)); return; }
    if (o && t.dataset.scv) { const [k, i] = t.dataset.scv.split("."); if (Number.isNaN(val)) return; editScene((sc) => { const x = sc.objects.find((y) => y.id === o.id); (k === "move" ? x.anim.move : x[k])[+i] = val; }); return; }
    if (t.dataset.sck) { if (Number.isNaN(val)) return; editScene((sc) => setPath(sc.camera, t.dataset.sck, val)); }
  }
  async function load(id) {
    S.cur = await api(`/api/scenes/${id}`); S.sel = null; S.t = 0; S.desc = ""; S.step = 0; S.pop = null;
    try { localStorage.setItem("studiomania.scene", id); } catch { /* */ }
    render(); watch();
  }
  async function open(host) {
    close();
    S.el = Object.assign(document.createElement("div"), { className: "sc" });
    host.appendChild(S.el);
    S.el.innerHTML = `<div class="flw-load"><span class="flw-spin"></span></div>`;
    S.el.addEventListener("click", onClick);
    S.el.addEventListener("input", onInput);
    S.el.addEventListener("change", onInput);
    try {
      [S.meta, S.list] = await Promise.all([S.meta || api("/api/scenes-meta"), api("/api/scenes")]);
      if (!S.list.length) { await api("/api/scenes", { method: "POST", ...jsonBody({ name: "أول مشهد" }) }); S.list = await api("/api/scenes"); }
      let last = null; try { last = localStorage.getItem("studiomania.scene"); } catch { /* */ }
      await load(S.list.some((x) => x.id === last) ? last : S.list[0].id);
    } catch (err) { S.el.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; return; }
    if (!S.raf) S.raf = requestAnimationFrame(loop);
    addEventListener("resize", onResize);
  }
  const onResize = () => { if (G.r && !S.rec) { fitView(); draw(); } };
  function close() {
    clearTimeout(S.poll); clearTimeout(S.saveT); removeEventListener("resize", onResize);
    if (G.r) { G.r.dispose(); G.r = null; }
    S.el?.remove(); S.el = null; S.play = false;
  }
  return { open, close };
})();
