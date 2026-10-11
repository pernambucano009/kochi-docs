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
    if (dark) { g.addColorStop(0, "#3c3c43"); g.addColorStop(.2, "#202025"); g.addColorStop(.34, "#0c0c0e"); g.addColorStop(1, "#0c0c0e"); }
    else { g.addColorStop(0, "#d3d7e0"); g.addColorStop(.18, "#eceef3"); g.addColorStop(.34, "#ffffff"); g.addColorStop(1, "#ffffff"); }
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    bdTex.needsUpdate = true;
  }

  // environment: a dark (or white) studio with soft boxes, for reflections on the glass
  function envMap(dark) {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 512;
    const x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 0, 512);
    if (dark) { g.addColorStop(0, "#6a6a74"); g.addColorStop(.5, "#2c2c33"); g.addColorStop(1, "#44444c"); }   // رمادي مش أسود: عشان حواف الزجاج تنوّر وتبان
    else { g.addColorStop(0, "#ffffff"); g.addColorStop(.5, "#c9ccd6"); g.addColorStop(1, "#f2f3f6"); }
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
    if (!dark) {   // في اللايت: شرايط غامقة عشان حواف الزجاج تبان على الأبيض
      for (const [cx, w] of [[380, 26], [640, 18], [880, 30], [150, 20]]) { x.fillStyle = "rgba(40,48,70,.3)"; x.fillRect(cx, 120, w, 300); }
    }
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.encoding = THREE.sRGBEncoding;
    const rt = pmrem.fromEquirectangular(t);
    t.dispose();
    return rt.texture;
  }

  let dark = true, tint = "#b9bcc8";
  const glass = () => new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0, transmission: 1, thickness: 1.2, ior: 1.33,
    clearcoat: 1, clearcoatRoughness: 0, specularIntensity: 1, envMapIntensity: 2.6,
    // لمعة قوس قزح خفيفة على السطح (زي جلد الجيليفيش) + لون خفيف جدًا جوه الأجزاء التخينة
    iridescence: .55, iridescenceIOR: 1.3, iridescenceThicknessRange: [180, 520],
    attenuationColor: new THREE.Color(tint), attenuationDistance: 1.6, transparent: true, opacity: 1,
  });

  // ---------- shapes
  const EX = { depth: .42, bevelEnabled: true, bevelThickness: .16, bevelSize: .11, bevelSegments: 10, curveSegments: 48 };
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
  function gearShape(n = 8, ro = 1.3, ri = 1.02, hole = .42) {
    const s = new THREE.Shape();
    for (let i = 0; i < n * 4; i++) {
      const a = (i / (n * 4)) * Math.PI * 2, r = (i % 4 === 1 || i % 4 === 2) ? ro : ri;
      const p = [Math.cos(a) * r, Math.sin(a) * r];
      i ? s.lineTo(...p) : s.moveTo(...p);
    }
    s.closePath();
    s.holes.push(circle(hole, THREE.Path));
    return s;
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

  // ---------- الهيكل: خط رفيع بيمشي جوه الزجاج على شكل المجسّم نفسه (زي الهيكل اللي بيبان جوه الجيليفيش)
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xf2f4fa, roughness: .3, metalness: 0, emissive: 0x8a93a8, emissiveIntensity: .25 });   // معتم عشان يبان من ورا الزجاج
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
  function skeleton(geo) {
    const S = geo.userData.solid, curves = [];
    if (S.kind === "shape") {
      const thick = Math.min(.16, S.z * .4);
      [[S.outer, false], ...S.holes.map((h) => [h, true])].forEach(([poly, hole]) => {
        const pts = inset(poly, thick, hole).map((v) => v.set(v.x - S.ox, v.y - S.oy, 0));
        if (pts.length > 2) { const path = new THREE.CurvePath(); pts.forEach((v, i) => path.add(new THREE.LineCurve3(v, pts[(i + 1) % pts.length]))); path.closed = true; curves.push(path); }   // خطوط مستقيمة بين النقط: من غير لفّات عند الزوايا
      });
    } else if (S.kind === "sphere") {
      const r = S.r * .62;
      [0, Math.PI / 2].forEach((rot) => curves.push(new THREE.CatmullRomCurve3(Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * r * Math.cos(rot), Math.sin(a) * r, Math.cos(a) * r * Math.sin(rot)); }), true)));
    } else if (S.kind === "capsule") {
      curves.push(new THREE.CatmullRomCurve3([new THREE.Vector3(0, -S.h, 0), new THREE.Vector3(0, S.h, 0)], false));
    }
    if (!curves.length) return null;
    const geos = curves.map((c) => new THREE.TubeGeometry(c, Math.max(24, Math.round(c.getLength() * 40)), .022, 6, !!c.closed));
    // دمج الأنابيب في جيومتري واحد، والرسم بيكبر على طولها (نفس حركة «بيكبر» بتاعة الدخول)
    let nIdx = 0, nPos = 0; geos.forEach((g) => { nIdx += g.index.count; nPos += g.attributes.position.count; });
    const pos = new Float32Array(nPos * 3), nor = new Float32Array(nPos * 3), idx = new Uint32Array(nIdx);
    let po = 0, io = 0;
    geos.forEach((g) => { pos.set(g.attributes.position.array, po * 3); nor.set(g.attributes.normal.array, po * 3); for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + po; po += g.attributes.position.count; io += g.index.count; g.dispose(); });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    const STEPS = 48, ends = new Uint32Array(STEPS);
    for (let i = 0; i < STEPS; i++) ends[i] = Math.floor((nIdx / 3) * (i / (STEPS - 1))) * 3;
    const mesh = new THREE.Mesh(g, coreMat);
    mesh.renderOrder = -1;
    mesh.userData.ends = ends;
    return mesh;
  }

  const BUILD = {
    app(m) {
      const ring = circle(1.25); ring.holes.push(circle(.92, THREE.Path));
      const play = tri([-.32, -.48], [.5, 0], [-.32, .48]);
      return [new THREE.Mesh(extrude(ring, { depth: .5 }), m), new THREE.Mesh(extrude(play, { depth: .32, bevelSize: .08 }), m)];
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
    settings(m) { return [Object.assign(new THREE.Mesh(extrude(gearShape(), { depth: .45 }), m), { userData: { spin: true } })]; },
    progress(m) {
      const pts = [[-1.7, 0], [-.8, 0], [-.45, .95], [.1, -.95], [.5, .3], [.8, 0], [1.7, 0]].map(([x, y]) => new THREE.Vector3(x, y, 0));
      return [new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "catmullrom", .15), 160, .16, 32, false), m)];
    },
    publish(m) {
      const A = new THREE.Mesh(extrude(tri([-1.45, .05], [1.45, .95], [-.15, -.3]), { depth: .16, bevelThickness: .08, bevelSize: .05 }), m);
      const B = new THREE.Mesh(extrude(tri([-.15, -.3], [1.45, .95], [.15, -1.15]), { depth: .16, bevelThickness: .08, bevelSize: .05 }), m);
      A.position.set(-.18, .22, 0); B.position.set(.4, -.2, -.18); B.rotation.x = .35;
      return [A, B];
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

  // حافة منوّرة (فرينل) على كل جزء زجاج: هي اللي بتخلّي الزجاج الشفاف يبان زي راس الجيليفيش
  const rimMat = () => new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(dark ? "#ffffff" : "#1b2233") }, a: { value: 1 } },
    vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform vec3 c; uniform float a; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4); gl_FragColor = vec4(c, f * a); }",
    transparent: true, depthWrite: false,
  });
  const RIM = () => (dark ? .6 : .38);
  const cache = {};
  function group(key) {
    if (cache[key]) return cache[key];
    const m = glass(), g = new THREE.Group();
    (BUILD[key] || BUILD.app)(m).forEach((x) => g.add(x));
    const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3());
    g.userData.k = 2.9 / Math.max(size.x, size.y);
    g.userData.mats = [];
    g.traverse((o) => { if (o.material && !o.userData.mark && !g.userData.mats.includes(o.material)) g.userData.mats.push(o.material); });
    g.userData.marks = g.children.filter((o) => o.userData.mark);
    const rim = rimMat();
    g.userData.rim = rim;
    g.children.filter((o) => o.isMesh && o.material === m).forEach((o) => o.add(new THREE.Mesh(o.geometry, rim)));
    g.userData.cores = [];
    if (key !== "brand") {
      g.children.filter((o) => o.geometry?.userData.solid).forEach((o) => {
        const b = skeleton(o.geometry);
        if (b) { o.add(b); g.userData.cores.push(b); }
      });
    }
    g.userData.a = 0;
    g.userData.to = 0;
    g.visible = false;
    scene.add(g);
    return (cache[key] = g);
  }

  let cur = null;
  const clock = new THREE.Clock();
  function show(key) {   // مفيش قطع: كل مجسّم بيكمّل من مكانه (اللي داخل بيكبر واللي خارج بيختفي في نفس الوقت)
    const g = group(key);
    cur = g;
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
    g.userData.cores.forEach((c) => { const e = c.userData.ends; c.geometry.setDrawRange(0, e[Math.round(a * (e.length - 1))]); });
    g.userData.marks.forEach((m) => { m.scale.setScalar(Math.max(.001, a)); });
  }

  function theme(isDark) {
    dark = isDark;
    tint = isDark ? "#aebce0" : "#7fa2ec";   // دارك: زجاج مدخّن · لايت: زجاج أبيض مزرق (زي الجيليفيش في المرجع)
    scene.environment = envMap(isDark);
    paintBackdrop(isDark);
    Object.values(cache).forEach((g) => { g.userData.mats.forEach((m) => { if (m.attenuationColor) m.attenuationColor.set(tint); }); g.userData.rim.uniforms.c.value.set(isDark ? "#ffffff" : "#1b2233"); });
    coreMat.color.set(isDark ? "#eef1f8" : "#55607a"); coreMat.emissive.set(isDark ? "#8a93a8" : "#000000");
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
      grow(g, Math.pow(e, 1.4));   // المخ بيطلع من النص لبرّه بعد ما الزجاج يبان
      g.scale.setScalar(u.k * (.88 + .12 * e));
      g.position.y = lift + (reduce.matches ? 0 : Math.sin(t * .8) * .1);
      g.rotation.y = reduce.matches ? 0 : Math.sin(t * .45) * .38;
      g.rotation.x = reduce.matches ? 0 : Math.sin(t * .3) * .08;
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
