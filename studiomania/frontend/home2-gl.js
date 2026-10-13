// 3D glass object in the middle of the new home (three.js r149). Returns null when WebGL is unavailable.
window.NHGL = (stage, getClient) => {
  const THREE = window.THREE;
  if (!THREE || !stage) return null;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return null; }
  if (!renderer.getContext()) return null;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const holder = document.createElement("div");
  holder.className = "gl";
  holder.appendChild(renderer.domElement);
  stage.prepend(holder);
  stage.classList.add("has-gl");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  const pmrem = new THREE.PMREMGenerator(renderer);

  // backdrop: same colour as the page at its edges, a soft glow in the middle (so the glass has something to bend)
  const bd = document.createElement("canvas");
  bd.width = bd.height = 512;
  const bdTex = new THREE.CanvasTexture(bd);
  bdTex.encoding = THREE.sRGBEncoding;
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ map: bdTex, toneMapped: false }));
  backdrop.position.z = -7;
  scene.add(backdrop);

  function paintBackdrop(dark) {
    const x = bd.getContext("2d"), g = x.createRadialGradient(256, 236, 0, 256, 256, 256);
    // نفس لون الصفحة بالظبط عند الأطراف، ونور هادي ورا المجسّم بس (زي المرجع)
    if (dark) { g.addColorStop(0, "#2a2a31"); g.addColorStop(.22, "#16161a"); g.addColorStop(.36, "#0c0c0e"); g.addColorStop(1, "#0c0c0e"); }
    else { g.addColorStop(0, "#eef0f5"); g.addColorStop(.36, "#ffffff"); g.addColorStop(1, "#ffffff"); }
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    bdTex.needsUpdate = true;
  }

  // environment: a dark (or white) studio with soft boxes, for reflections on the glass
  // «ماتكاب» الزجاج: صورة دايرة بتتلزق على كل سطح حسب اتجاهه للكاميرا. النص شفاف، وعند الحافة خطوط زرقا غامقة
  // ولمعات بيضا حادة (زي المرجع)، فكل حافة مدوّرة بتاخد نفس الشكل المصبوب
  const CAP = { value: null };
  function paintCap(dark) {
    const S = 512, c = document.createElement("canvas");
    c.width = c.height = S;
    const x = c.getContext("2d"), R = S / 2;
    const ringAt = (r, w, col, a, wob = 0) => {
      for (let i = 0; i < 360; i++) {
        const t0 = i / 360 * Math.PI * 2, t1 = (i + 1.5) / 360 * Math.PI * 2;
        const m = 1 - wob * (.5 + .5 * Math.sin(t0 * 3 + r * 9) * Math.sin(t0 * 7 + 1.3));
        x.strokeStyle = col; x.globalAlpha = a * m; x.lineWidth = w * R;
        x.beginPath(); x.arc(R, R, r * R, -t1, -t0); x.stroke();
      }
      x.globalAlpha = 1;
    };
    const g = x.createRadialGradient(R, R, 0, R, R, R);
    const tintA = dark ? "rgba(150,185,255," : "rgba(90,135,235,";
    g.addColorStop(0, tintA + "0)"); g.addColorStop(.3, tintA + "0)"); g.addColorStop(.8, tintA + (dark ? ".25)" : ".35)")); g.addColorStop(1, tintA + (dark ? ".55)" : ".7)"));
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    const deep = dark ? "#9db9ff" : "#1b3f9e", mid = dark ? "#cfe0ff" : "#3f6fd6";
    // على أنبوبة مدوّرة، بُعد النقطة عن نص الصورة = بُعدها عن نص الأنبوبة، فالحلقات دي بتبان خطوط ماشية بطول الحافة
    ringAt(.975, .05, deep, .95);
    ringAt(.91, .035, "#ffffff", 1, .5);
    ringAt(.84, .025, deep, .75, .6);
    ringAt(.74, .04, "#ffffff", .85, .7);
    ringAt(.6, .03, mid, .45, .8);
    ringAt(.45, .05, "#ffffff", .55, .85);
    const hl = (ang, r, w, h, a) => {   // لمعة بيضا
      x.save(); x.translate(R + Math.cos(ang) * r * R, R - Math.sin(ang) * r * R); x.rotate(-ang + Math.PI / 2);
      const q = x.createRadialGradient(0, 0, 0, 0, 0, w * R); q.addColorStop(0, `rgba(255,255,255,${a})`); q.addColorStop(1, "rgba(255,255,255,0)");
      x.scale(1, h / w); x.fillStyle = q; x.beginPath(); x.arc(0, 0, w * R, 0, Math.PI * 2); x.fill(); x.restore();
    };
    hl(2.3, .55, .4, .1, 1); hl(2.0, .82, .3, .05, 1); hl(-.8, .66, .34, .07, .9); hl(.5, .88, .2, .04, .85); hl(3.6, .3, .2, .08, .7);
    if (CAP.value) CAP.value.dispose();
    CAP.value = new THREE.CanvasTexture(c);
  }
  function envMap(dark) {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 512;
    const x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 0, 512);
    // استوديو غامق فيه شرايط نور حادة: الزجاج النضيف بيبان من الانعكاسات الحادة، مش من لونه
    if (dark) { g.addColorStop(0, "#3a4258"); g.addColorStop(.5, "#10131c"); g.addColorStop(1, "#232a3c"); }
    else { g.addColorStop(0, "#ffffff"); g.addColorStop(.3, "#c4d3f3"); g.addColorStop(.5, "#1d3f9a"); g.addColorStop(.7, "#c4d3f3"); g.addColorStop(1, "#f4f7ff"); }
    x.fillStyle = g;
    x.fillRect(0, 0, 1024, 512);
    const box = (cx, cy, w, h, a) => {
      const r = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h));
      r.addColorStop(0, `rgba(255,255,255,${a})`); r.addColorStop(.5, `rgba(255,255,255,${a * .6})`); r.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = r;
      x.fillRect(cx - w * 2, cy - h * 2, w * 4, h * 4);
    };
    box(250, 140, 110, 46, 1); box(770, 160, 130, 54, .95); box(512, 50, 260, 36, .9); box(110, 330, 60, 100, .55); box(910, 320, 70, 100, .55);
    // شباك منوّر بعارضتين: ده اللي بيدّي الانعكاس الحاد اللي على راس الجيليفيش
    // (u = 768 هو اللي ورا الكاميرا، فده الانعكاس على الوش؛ و 512 و 0 هما الجناب، فدول بيرسموا حواف الزجاج)
    x.fillStyle = "rgba(255,255,255,.96)"; x.fillRect(640, 118, 110, 80);
    x.fillStyle = dark ? "#08080a" : "#9aa0ad"; x.fillRect(692, 118, 6, 80); x.fillRect(640, 155, 110, 6);
    for (const [cx, w, a] of [[512, 70, .6], [0, 46, .6], [1024, 46, .6], [256, 120, .35]]) {
      const r = x.createLinearGradient(cx - w, 0, cx + w, 0);
      r.addColorStop(0, "rgba(255,255,255,0)"); r.addColorStop(.5, `rgba(255,255,255,${a})`); r.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = r; x.fillRect(cx - w, 60, w * 2, 400);
    }
    // شرايط نور حادة (زي سوفت بوكس): هي اللي بتعمل اللمعة النضيفة على الحواف
    for (const [cx, w] of [[700, 16], [820, 8], [330, 12], [180, 6], [960, 10]]) { x.fillStyle = "rgba(255,255,255,1)"; x.fillRect(cx, 70, w, 360); }
    // خطوط زرقا غامقة رفيعة: هي اللي بتعمل الخطوط الزرقا الحادة على حواف الزجاج (زي المرجع)
    if (!dark) for (const [cx, w] of [[400, 7], [610, 5], [880, 6], [90, 8], [256, 4]]) { x.fillStyle = "#1c3c94"; x.fillRect(cx, 90, w, 320); }
    x.fillStyle = "rgba(255,255,255,1)"; x.fillRect(560, 40, 420, 10);
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.encoding = THREE.sRGBEncoding;
    const rt = pmrem.fromEquirectangular(t);
    t.dispose();
    return rt.texture;
  }

  let dark = true, tint = "#3f78ff";
  // زجاج مصبوب نضيف (زي المرجع): شفاف، والأزرق بيغمق كل ما الزجاج يتخن (الحواف أزرق أغمق، النص فاتح)
  const glass = () => new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0, transmission: 1, thickness: .45, ior: 1.5,
    clearcoat: 1, clearcoatRoughness: 0, specularIntensity: 1, specularColor: new THREE.Color(0xffffff), envMapIntensity: 2.6,
    attenuationColor: new THREE.Color(tint), attenuationDistance: 4, transparent: true, opacity: 1,
  });

  // ---------- shapes
  // حواف مدوّرة وتخينة زي الزجاج المصبوب (المرجع)
  const EX = { depth: .26, bevelEnabled: true, bevelThickness: .32, bevelSize: .22, bevelSegments: 18, curveSegments: 64 };
  function extrude(shape, o = {}) {   // كل الأشكال أتخن من الأول عشان يبقى فيها حجم زجاج والمخ يتحط جواها
    const opt = { ...EX, ...o };
    opt.depth *= 1.7; opt.bevelThickness *= 1.5;
    const g = new THREE.ExtrudeGeometry(shape, opt);
    g.computeBoundingBox();
    const c = g.boundingBox.getCenter(new THREE.Vector3());
    g.translate(-c.x, -c.y, -c.z);
    g.computeVertexNormals();
    const pts = shape.extractPoints(16);
    g.userData.solid = { kind: "shape", outer: pts.shape, holes: pts.holes, ox: c.x, oy: c.y, z: opt.depth / 2 };
    return g;
  }
  const sph = (r, a = 48, b = 32) => { const g = new THREE.SphereGeometry(r, a, b); g.userData.solid = { kind: "sphere", r }; return g; };
  const capsule = (r, len) => { const g = new THREE.CapsuleGeometry(r, len, 16, 48); g.userData.solid = { kind: "capsule", r, h: len / 2 }; return g; };
  function rr(w, h, r, P = THREE.Shape, cx = 0, cy = 0) {
    const s = new P(), x = cx - w / 2, y = cy - h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  const circle = (r, P = THREE.Shape, cx = 0, cy = 0) => { const s = new P(); s.absarc(cx, cy, r, 0, Math.PI * 2, false); return s; };
  function tri(a, b, c, P = THREE.Shape) { const s = new P(); s.moveTo(...a); s.lineTo(...b); s.lineTo(...c); s.lineTo(...a); return s; }
  function star(r = 1.3, k = .16, cx = 0, cy = 0) {
    const s = new THREE.Shape();
    s.moveTo(cx, cy + r);
    s.quadraticCurveTo(cx + k, cy + k, cx + r, cy); s.quadraticCurveTo(cx + k, cy - k, cx, cy - r);
    s.quadraticCurveTo(cx - k, cy - k, cx - r, cy); s.quadraticCurveTo(cx - k, cy + k, cx, cy + r);
    return s;
  }
  // ---------- «طبق» زجاج مصبوب (زي المرجع): حافة مدوّرة تخينة ماشية على الحدود، وأرضية رفيعة غاطسة في النص
  const V2 = (x, y) => new THREE.Vector2(x, y);
  function chaikin(pts, n = 5) {   // يدوّر الزوايا (كل ما n يزيد، الزاوية أنعم)
    for (let k = 0; k < n; k++) {
      const o = [];
      pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; o.push(V2(p.x * .75 + q.x * .25, p.y * .75 + q.y * .25), V2(p.x * .25 + q.x * .75, p.y * .25 + q.y * .75)); });
      pts = o;
    }
    return pts;
  }
  function roundPoly(P, r, seg = 14) {   // مضلّع بزوايا مدوّرة بنص قطر r
    const out = [];
    P.forEach((c, i) => {
      const a = P[(i - 1 + P.length) % P.length], b = P[(i + 1) % P.length];
      const u = a.clone().sub(c).normalize(), w = b.clone().sub(c).normalize();
      const half = Math.acos(Math.max(-1, Math.min(1, u.dot(w)))) / 2, d = Math.min(r / Math.tan(half), a.distanceTo(c) * .4, b.distanceTo(c) * .4);
      const p1 = c.clone().add(u.clone().multiplyScalar(d)), p2 = c.clone().add(w.clone().multiplyScalar(d));
      for (let k = 0; k <= seg; k++) { const t = k / seg, q = 1 - t; out.push(V2(q * q * p1.x + 2 * q * t * c.x + t * t * p2.x, q * q * p1.y + 2 * q * t * c.y + t * t * p2.y)); }
    });
    return out;
  }
  const ring = (r, n = 96) => Array.from({ length: n }, (_, i) => V2(Math.cos(i / n * Math.PI * 2) * r, Math.sin(i / n * Math.PI * 2) * r));
  function rimTube(pts, r, m) {   // أنبوبة زجاج مقفولة على خط
    const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, p.y, 0)), true, "centripetal");
    return new THREE.Mesh(new THREE.TubeGeometry(c, pts.length * 2, r, 28, true), m);
  }
  function dish(m, outer, holes = [], o = {}) {
    const rim = o.rim ?? .09, lip = o.lip ?? rim, out = [];
    out.push(rimTube(inset(outer, rim, false), rim, m));
    holes.forEach((h) => out.push(rimTube(inset(h, lip, true), lip, m)));
    // الأرضية: لوح رفيع جوه الحافة، نازل لتحت شوية
    const fl = (pts, d, hole) => inset(pts, d, hole).map((v) => V2(v.x, v.y));
    const sh = new THREE.Shape(fl(outer, rim * 1.2, false));
    holes.forEach((h) => sh.holes.push(new THREE.Path(fl(h, lip * 1.2, true))));
    const fg = new THREE.ExtrudeGeometry(sh, { depth: o.floor ?? .03, bevelEnabled: true, bevelThickness: .025, bevelSize: rim * .9, bevelSegments: 8, curveSegments: 32 });
    fg.translate(0, 0, -rim * .55);
    const fm = m.clone(); fm.attenuationDistance = 2.5; fm.thickness = .3; fm.envMapIntensity = 1.6;   // الأرضية رفيعة: شبه شفافة خالص
    out.push(new THREE.Mesh(fg, fm));
    (o.lines || []).forEach(([a, b]) => {   // خطوط التقطيع الخفيفة اللي على الأرضية
      const t = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(a.x, a.y, -rim * .55 + .06), new THREE.Vector3(b.x, b.y, -rim * .55 + .06)), 8, .009, 6, false);
      out.push(new THREE.Mesh(t, m));
    });
    return out;
  }
  function toDish(mesh, m) {   // شكل مبثوق ← طبق بنفس الحدود والفتحات
    const S = mesh.geometry.userData.solid;
    const clean = (P) => {
      const o = [];
      P.forEach((p) => { const q = V2(p.x - S.ox, p.y - S.oy), l = o[o.length - 1]; if (!l || l.distanceTo(q) > 1e-4) o.push(q); });
      if (o.length > 2 && o[0].distanceTo(o[o.length - 1]) < 1e-4) o.pop();
      return o;
    };
    let outer = clean(S.outer);
    const sz = new THREE.Box2().setFromPoints(outer).getSize(V2());
    const rim = Math.max(.035, Math.min(.11, Math.min(sz.x, sz.y) * .065));
    if (outer.length <= 8) outer = roundPoly(outer, rim * 1.6);   // مضلّع بزوايا حادة (مثلث): ندوّر زواياه زي المصبوب
    const d = new THREE.Group();
    dish(m, outer, S.holes.map(clean), { rim }).forEach((o) => d.add(o));
    d.position.copy(mesh.position); d.rotation.copy(mesh.rotation); d.scale.copy(mesh.scale);
    Object.assign(d.userData, mesh.userData);
    mesh.geometry.dispose();
    return d;
  }
  // ترس: ٦ سنان مربّعة بزوايا مدوّرة، وفتحة كبيرة في النص
  function gearPts(n = 6, ro = 1, rv = .74, tip = .3, base = .36) {
    const P = [], A = (r, a) => V2(Math.cos(a) * r, Math.sin(a) * r);
    for (let i = 0; i < n; i++) {
      const c = i / n * Math.PI * 2 + Math.PI / 2, h = Math.PI / n;
      P.push(A(rv, c - h), A(rv * 1.01, c - base), A(ro, c - tip), A(ro * 1.02, c), A(ro, c + tip), A(rv * 1.01, c + base));
    }
    return chaikin(P, 4);
  }
  const ACCENT = () => getComputedStyle(document.getElementById("nh") || document.documentElement).getPropertyValue("--nh-accent").trim() || "#ff4a3d";
  function markPlane(size) {   // the client's mark (logo, or the first letter of the name), floating inside the glass plate
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: t, alphaTest: .35, side: THREE.DoubleSide, toneMapped: false }));
    const x = c.getContext("2d"), cl = getClient?.() || null;
    const letter = () => {
      x.clearRect(0, 0, 256, 256);
      x.fillStyle = ACCENT();
      x.font = "500 190px Jost, Futura, sans-serif";
      x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(((cl?.name || "S").trim()[0] || "S").toUpperCase(), 128, 140);
      t.needsUpdate = true;
    };
    letter();
    if (cl?.logo) {
      const img = new Image();
      img.onload = () => {
        const k = 170 / Math.max(img.width, img.height), w = img.width * k, h = img.height * k;
        x.clearRect(0, 0, 256, 256);
        x.drawImage(img, 128 - w / 2, 128 - h / 2, w, h);
        t.needsUpdate = true;
      };
      img.src = cl.logo;
    }
    return plane;
  }

  // ---------- أدوات الأشكال
  function inset(poly, d, hole) {   // يزق كل نقطة لجوه المادة بمسافة d (للفتحة: لبرّه الفتحة)
    let area = 0;
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; area += p.x * q.y - q.x * p.y; }
    const sgn = (area > 0 ? 1 : -1) * (hole ? -1 : 1), n = poly.length, out = [];
    for (let i = 0; i < n; i++) {
      const p = poly[(i - 1 + n) % n], c = poly[i], q = poly[(i + 1) % n];
      const e1 = new THREE.Vector2(c.x - p.x, c.y - p.y).normalize(), e2 = new THREE.Vector2(q.x - c.x, q.y - c.y).normalize();
      const nrm = new THREE.Vector2(-(e1.y + e2.y), e1.x + e2.x).normalize().multiplyScalar(sgn);
      const k = Math.min(2.2, 1 / Math.max(.35, (1 + e1.dot(e2)) / 2) ** .5);
      out.push(new THREE.Vector3(c.x + nrm.x * d * k, c.y + nrm.y * d * k, 0));
    }
    return out;
  }
  const BUILD = {
    app(m) {   // مثلث تشغيل: طبق بحافة تخينة (زي المرجع)
      return dish(m, roundPoly([V2(-.62, -1), V2(1.05, 0), V2(-.62, 1)], .3), [], { rim: .13 });
    },
    create(m) {
      const a = new THREE.Mesh(extrude(star(1.35, .3), { depth: .4, bevelSize: .06 }), m);
      const b = new THREE.Mesh(extrude(star(.42, .1), { depth: .22, bevelSize: .03, bevelThickness: .06 }), m);
      b.position.set(1.05, 1.05, .2);
      return [a, b];
    },
    brand(m) {
      const plate = new THREE.Mesh(extrude(rr(2.1, 2.1, .52), { depth: .55 }), m);
      const mark = markPlane(1.6);
      mark.userData.mark = true;   // معتم وجوه الزجاج: بيتشاف من ورا الزجاج متكسّر زي المخ
      return [plate, mark];
    },
    assets(m) {
      const cube = new THREE.Mesh(extrude(rr(1.55, 1.55, .3), { depth: 1.25, bevelThickness: .18 }), m);
      cube.rotation.set(.5, .7, 0);
      return [cube];
    },
    settings(m) {
      const outer = gearPts(), hole = ring(.37), lines = [];
      for (let i = 0; i < 6; i++) {   // خط من الفتحة لكل وادي، وخط عند قاعدة كل سنّة
        const a = (i + .5) / 6 * Math.PI * 2 + Math.PI / 2, b = i / 6 * Math.PI * 2 + Math.PI / 2;
        lines.push([V2(Math.cos(a) * .5, Math.sin(a) * .5), V2(Math.cos(a) * .66, Math.sin(a) * .66)]);
        lines.push([V2(Math.cos(b - .3) * .66, Math.sin(b - .3) * .66), V2(Math.cos(b + .3) * .66, Math.sin(b + .3) * .66)]);
      }
      return dish(m, outer, [hole], { rim: .085, lip: .12, lines }).map((o) => { o.userData.spin = true; return o; });
    },
    progress(m) {
      const pts = [[-1.7, 0], [-.8, 0], [-.45, .95], [.1, -.95], [.5, .3], [.8, 0], [1.7, 0]].map(([x, y]) => new THREE.Vector3(x, y, 0));
      return [new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "catmullrom", .15), 160, .16, 32, false), m)];
    },
    publish(m) {   // طيارة ورق: شكل واحد بحدود الجناحين
      const s = new THREE.Shape();
      [[-1.45, .05], [1.45, .95], [.15, -1.15], [-.15, -.3]].forEach((p, i) => (i ? s.lineTo(...p) : s.moveTo(...p)));
      s.closePath();
      return [new THREE.Mesh(extrude(s, { depth: .16 }), m)];
    },
    film(m) {
      const f = rr(2.5, 1.8, .26);
      f.holes.push(rr(1.3, 1.25, .12, THREE.Path));
      for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) f.holes.push(rr(.2, .2, .05, THREE.Path, sx * 1.0, -.6 + i * .4));
      return [new THREE.Mesh(extrude(f, { depth: .3 }), m)];
    },
    series(m) {
      const board = new THREE.Mesh(extrude(rr(2.3, 1.45, .2), { depth: .32 }), m);
      board.position.y = -.25;
      const bar = new THREE.Mesh(extrude(rr(2.4, .42, .12), { depth: .28 }), m);
      bar.position.set(-.05, .78, .05); bar.rotation.z = .22;
      return [board, bar];
    },
    reel(m) {
      const ph = rr(1.3, 2.35, .3); ph.holes.push(rr(1.02, 1.8, .16, THREE.Path, 0, .04));
      const play = new THREE.Mesh(extrude(tri([-.2, -.3], [.32, 0], [-.2, .3]), { depth: .18, bevelSize: .05 }), m);
      return [new THREE.Mesh(extrude(ph, { depth: .32 }), m), play];
    },
    carousel(m) {
      return [-1, 0, 1].map((k) => { const p = new THREE.Mesh(extrude(rr(1.25, 1.75, .2), { depth: .14 }), m); p.position.set(k * .62, 0, k * .45); p.rotation.y = -.35; return p; });
    },
    characters(m) {
      const head = new THREE.Mesh(sph(.52, 64, 48), m); head.position.y = .82;
      const body = new THREE.Mesh(capsule(.62, .5), m); body.position.y = -.5; body.scale.set(1.1, .9, .7);
      return [head, body];
    },
    backgrounds(m) {
      const p = new THREE.Mesh(extrude(rr(2.4, 1.7, .26), { depth: .2 }), m);
      const mt = new THREE.Mesh(extrude(tri([-.95, -.55], [-.15, .4], [.75, -.55]), { depth: .16, bevelSize: .05 }), m); mt.position.set(-.15, -.15, .3);
      const sun = new THREE.Mesh(sph(.24), m); sun.position.set(.62, .38, .3);
      return [p, mt, sun];
    },
    music(m) {
      const out = [];
      for (const [x, y] of [[-.7, -.85], [.75, -.55]]) {
        const h = new THREE.Mesh(sph(.38), m); h.scale.set(1.25, .9, .8); h.position.set(x, y, 0); out.push(h);
        const st = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 1.7, 24), m); st.position.set(x + .38, y + .82, 0); out.push(st);
      }
      const beam = new THREE.Mesh(extrude(rr(1.6, .3, .08), { depth: .14 }), m); beam.position.set(.4, 1.0, 0); beam.rotation.z = .18; out.push(beam);
      return out;
    },
    voices(m) {
      const cap = new THREE.Mesh(capsule(.48, .9), m); cap.position.y = .45;
      const arc = new THREE.Mesh(new THREE.TorusGeometry(.82, .09, 20, 64, Math.PI), m); arc.rotation.z = Math.PI; arc.position.y = .25;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .6, 20), m); stem.position.y = -.85;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .1, 40), m); base.position.y = -1.15;
      return [cap, arc, stem, base];
    },
  };
  BUILD.pulse = BUILD.progress;

  // طبقة لمعة فوق الزجاج (الماتكاب اللي فوق)، شغالة على أي شكل
  const rimMat = () => new THREE.ShaderMaterial({
    uniforms: { a: { value: 1 }, cap: CAP },
    vertexShader: "varying vec3 vN; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vP = mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }",
    fragmentShader: `uniform float a; uniform sampler2D cap; varying vec3 vN; varying vec3 vP;
      void main(){ vec3 V = normalize(-vP), N = normalize(vN); if (dot(N, V) < 0.) N = -N;
        vec3 X = normalize(vec3(V.z, 0., -V.x)), Y = cross(V, X);
        vec4 c = texture2D(cap, vec2(dot(X, N), dot(Y, N)) * .495 + .5);
        gl_FragColor = vec4(c.rgb, c.a * a); }`,
    transparent: true, depthWrite: false,
  });
  const RIM = () => 1;   // حافة منوّرة رفيعة زي حافة الجيليفيش
  // الأيقونات اللي ليها صورة زجاج جاهزة (icons3d/<key>.png على الأبيض، و<key>_d.png للغامق) بتتعرض هي نفسها بالظبط
  const IMGS = ["create", "settings", "app", "brand", "assets", "progress", "publish", "reel", "film", "series", "carousel", "characters", "voices", "music", "backgrounds"], loader = new THREE.TextureLoader(), imgPlanes = [];
  // الصور بتتحمّل مرة واحدة وتترفع على كارت الشاشة قبل ما تتعرض (عشان مفيش رعشة ولا مربع فاضي)
  const texCache = {};
  const texUrl = (key, d) => `/icons3d/${key}${d ? "_d" : ""}.webp?v=5`;
  function loadTex(url, cb) {
    const c = texCache[url] || (texCache[url] = { t: null, cbs: [] });
    if (c.t) return cb && cb(c.t);
    if (cb) c.cbs.push(cb);
    if (c.cbs.length > 1 || c.loading) return;
    c.loading = true;
    loader.load(url, (t) => {
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      renderer.initTexture?.(t);
      c.t = t;
      c.cbs.splice(0).forEach((f) => f(t));
    });
  }
  function imgTex(plane) {
    const key = plane.userData.img;
    const want = (plane.userData.want = dark);
    loadTex(texUrl(key, dark), (t) => {
      if (plane.userData.want !== want) return;   // الثيم اتغيّر تاني قبل ما الصورة توصل
      plane.material.map = t; plane.material.needsUpdate = true;
      plane.material.visible = true;
      const w = t.image.width, h = t.image.height, mx = Math.max(w, h);
      plane.scale.set(w / mx, h / mx, 1);
    });
    loadTex(texUrl(key, !dark));   // نسخة الثيم التاني جاهزة كمان
  }
  function imgIcon(key) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, depthWrite: false, depthTest: false, opacity: 0, visible: false }));
    plane.userData.img = key;
    imgPlanes.push(plane);
    imgTex(plane);
    return plane;
  }
  const cache = {};
  function group(key) {
    if (cache[key]) return cache[key];
    const m = glass(), g = new THREE.Group();
    if (IMGS.includes(key)) {
      g.add(imgIcon(key));
      g.userData.k = 2.9;
      g.userData.img = true;
      g.userData.mats = [g.children[0].material];
      g.userData.marks = [];
      if (key === "brand") {   // لوجو العميل (أو أول حرف من اسمه) جوه المربع اللي في النص
        const mark = markPlane(.3);
        mark.userData.mark = true;
        mark.material.depthTest = false;
        mark.position.z = .02;
        g.add(mark);
        g.userData.marks.push(mark);
      }
      g.userData.rim = rimMat();
      g.userData.a = 0; g.userData.to = 0; g.visible = false;
      scene.add(g);
      return (cache[key] = g);
    }
    // أي شكل مبثوق بيتحوّل لطبق زجاج مصبوب (نفس ستايل الترس والمثلث)
    (BUILD[key] || BUILD.app)(m).forEach((x) => g.add(x.geometry?.userData.solid?.kind === "shape" ? toDish(x, m) : x));
    const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3());
    g.userData.k = 2.9 / Math.max(size.x, size.y);
    g.userData.mats = [];
    g.traverse((o) => { if (o.material && !o.userData.mark && !g.userData.mats.includes(o.material)) g.userData.mats.push(o.material); });
    g.userData.marks = g.children.filter((o) => o.userData.mark);
    const rim = rimMat();
    g.userData.rim = rim;
    const glassy = [];
    g.traverse((o) => { if (o.isMesh && o.material === m) glassy.push(o); });
    glassy.forEach((o) => o.add(new THREE.Mesh(o.geometry, rim)));
    g.userData.a = 0;
    g.userData.to = 0;
    g.visible = false;
    scene.add(g);
    return (cache[key] = g);
  }

  let cur = null;
  const clock = new THREE.Clock();
  let order = 0;
  function show(key) {   // مفيش قطع: كل مجسّم بيكمّل من مكانه (اللي داخل بيكبر واللي خارج بيختفي في نفس الوقت)
    const g = group(key);
    cur = g;
    order += 2;   // اللي داخل بيترسم فوق اللي خارج على طول (من غير ما الترتيب يتقلب كل فريم)
    g.traverse((o) => { if (o.isMesh) o.renderOrder = order + (o.userData.mark ? 1 : 0); });
    Object.values(cache).forEach((o) => { o.userData.to = o === g ? 1 : 0; });
    g.visible = true;
    warm();
  }
  // نبني الأيقونات الباقية في الخلفية، واحدة كل شوية، عشان أول مرة تتعرض متعلّقش
  const KEYS = ["app", "create", "brand", "assets", "settings", "progress", "publish", "reel", "film", "series", "carousel", "characters", "voices", "music", "backgrounds"];
  let warming = false;
  function warm() {
    if (warming) return;
    warming = true;
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 80));
    const next = () => {
      const k = KEYS.find((x) => !cache[x]);
      if (!k) return;
      const g = group(k);
      g.visible = true;          // يترسم مرة شفاف عشان يترفع على كارت الشاشة
      g.userData.warm = true;
      idle(next);
    };
    idle(next);
  }
  function brand() {   // the active client changed: rebuild the brand plate
    const g = cache.brand;
    if (!g) return;
    delete cache.brand;
    const was = g === cur;
    scene.remove(g);
    g.traverse((o) => { o.geometry?.dispose(); if (o.material?.map) o.material.map.dispose(); });
    if (was) { cur = null; show("brand"); }
  }
  function setOpacity(g, a) { g.userData.mats.forEach((m) => { m.opacity = a; }); g.userData.rim.uniforms.a.value = a * RIM(); }
  function grow(g, a) {
    g.userData.marks.forEach((m) => { m.scale.setScalar(Math.max(.001, a)); });
  }

  function theme(isDark) {
    dark = isDark;
    tint = isDark ? "#6c9bff" : "#3f78ff";
    // في اللايت: من غير tone mapping، عشان الأبيض اللي ورا الزجاج يفضل أبيض صافي (كان بيطلع رمادي فيبان مغبّش)
    renderer.toneMapping = isDark ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    scene.environment = envMap(isDark);
    paintBackdrop(isDark);
    paintCap(isDark);
    imgPlanes.forEach(imgTex);
    Object.values(cache).forEach((g) => { g.userData.mats.forEach((m) => { if (m.attenuationColor) m.attenuationColor.set(tint); });  });
    resize();
    frame();
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(() => { resize(); frame(); }).observe(stage);

  const smooth = (x) => x * x * (3 - 2 * x);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  function frame() {
    const dt = Math.min(.1, clock.getDelta()), t = clock.elapsedTime;
    const lift = stage.clientHeight > 380 ? .55 : .35;   // the object sits above the title text
    const k = 1 - Math.exp(-dt * (reduce.matches ? 40 : 5.5));
    for (const g of Object.values(cache)) {
      const u = g.userData;
      if (!g.visible) continue;
      u.a += (u.to - u.a) * k;
      if (Math.abs(u.to - u.a) < .004) u.a = u.to;
      if (u.warm) { u.warm = false; setOpacity(g, 0); grow(g, 0); continue; }
      if (u.a === 0 && u.to === 0) { g.visible = false; continue; }
      const e = smooth(u.a);
      setOpacity(g, e);
      u.mats.forEach((m) => { m.depthWrite = u.to === 1; });   // اللي خارج ميخبّيش اللي داخل
      grow(g, Math.pow(e, 1.4));   // اللوجو بيكبر جوه الزجاج بعد ما الزجاج يبان
      g.scale.setScalar(u.k * (.88 + .12 * e));
      g.position.y = lift + (reduce.matches ? 0 : Math.sin(t * .8) * .1);
      const tilt = u.img ? .45 : 1;   // الصورة بتميل أقل عشان متبانش كارت مسطّح
      g.rotation.y = reduce.matches ? 0 : Math.sin(t * .45) * .22 * tilt;
      g.rotation.x = reduce.matches ? 0 : Math.sin(t * .3) * .06 * tilt;
      g.children.forEach((c) => { if (c.userData.spin && !reduce.matches) c.rotation.z = t * .25; });
    }
    renderer.render(scene, camera);
  }
  function loop() {
    if (!document.hidden && stage.offsetParent !== null && !document.body.classList.contains("stage-settled")) frame();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  return { show, theme, brand };
};
