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
    if (dark) { g.addColorStop(0, "#2c2c31"); g.addColorStop(.18, "#1a1a1e"); g.addColorStop(.34, "#0c0c0e"); g.addColorStop(1, "#0c0c0e"); }
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
    if (dark) { g.addColorStop(0, "#2a2a30"); g.addColorStop(.5, "#08080a"); g.addColorStop(1, "#141418"); }
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
    if (!dark) {   // في اللايت: شرايط غامقة عشان حواف الزجاج تبان على الأبيض
      for (const [cx, w] of [[380, 26], [640, 18], [880, 30], [150, 20]]) { x.fillStyle = "rgba(40,48,70,.55)"; x.fillRect(cx, 120, w, 300); }
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
    color: 0xffffff, metalness: 0, roughness: .03, transmission: 1, thickness: 1.6, ior: 1.52,
    clearcoat: 1, clearcoatRoughness: .02, specularIntensity: 1, envMapIntensity: 1.7,
    attenuationColor: new THREE.Color(tint), attenuationDistance: 4.5, transparent: true, opacity: 1,
  });

  // ---------- shapes
  const EX = { depth: .42, bevelEnabled: true, bevelThickness: .16, bevelSize: .11, bevelSegments: 10, curveSegments: 48 };
  const extrude = (shape, o = {}) => { const g = new THREE.ExtrudeGeometry(shape, { ...EX, ...o }); g.center(); g.computeVertexNormals(); return g; };
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
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false }));
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

  const BUILD = {
    app(m) {
      const ring = circle(1.25); ring.holes.push(circle(.92, THREE.Path));
      const play = tri([-.32, -.48], [.5, 0], [-.32, .48]);
      return [new THREE.Mesh(extrude(ring, { depth: .5 }), m), new THREE.Mesh(extrude(play, { depth: .32, bevelSize: .08 }), m)];
    },
    create(m) {
      const a = new THREE.Mesh(extrude(star(1.35, .17), { depth: .4 }), m);
      const b = new THREE.Mesh(extrude(star(.42, .07), { depth: .22, bevelSize: .05, bevelThickness: .06 }), m);
      b.position.set(1.05, 1.05, .2);
      return [a, b];
    },
    brand(m) {
      const plate = new THREE.Mesh(extrude(rr(2.1, 2.1, .52), { depth: .55 }), m);
      const mark = markPlane(1.6);
      mark.position.z = .5;
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
      const A = new THREE.Mesh(extrude(tri([-1.45, .05], [1.45, .95], [-.15, -.3]), { depth: .08, bevelThickness: .06, bevelSize: .05 }), m);
      const B = new THREE.Mesh(extrude(tri([-.15, -.3], [1.45, .95], [.15, -1.15]), { depth: .08, bevelThickness: .06, bevelSize: .05 }), m);
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
      const head = new THREE.Mesh(new THREE.SphereGeometry(.52, 64, 48), m); head.position.y = .82;
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(.62, .5, 16, 48), m); body.position.y = -.5; body.scale.set(1.1, .9, .7);
      return [head, body];
    },
    backgrounds(m) {
      const p = new THREE.Mesh(extrude(rr(2.4, 1.7, .26), { depth: .2 }), m);
      const mt = new THREE.Mesh(extrude(tri([-.95, -.55], [-.15, .4], [.75, -.55]), { depth: .16, bevelSize: .05 }), m); mt.position.set(-.15, -.15, .3);
      const sun = new THREE.Mesh(new THREE.SphereGeometry(.24, 48, 32), m); sun.position.set(.62, .38, .3);
      return [p, mt, sun];
    },
    music(m) {
      const out = [];
      for (const [x, y] of [[-.7, -.85], [.75, -.55]]) {
        const h = new THREE.Mesh(new THREE.SphereGeometry(.38, 48, 32), m); h.scale.set(1.25, .9, .8); h.position.set(x, y, 0); out.push(h);
        const st = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 1.7, 24), m); st.position.set(x + .38, y + .82, 0); out.push(st);
      }
      const beam = new THREE.Mesh(extrude(rr(1.6, .3, .08), { depth: .14 }), m); beam.position.set(.4, 1.0, 0); beam.rotation.z = .18; out.push(beam);
      return out;
    },
    voices(m) {
      const cap = new THREE.Mesh(new THREE.CapsuleGeometry(.48, .9, 16, 48), m); cap.position.y = .45;
      const arc = new THREE.Mesh(new THREE.TorusGeometry(.82, .09, 20, 64, Math.PI), m); arc.rotation.z = Math.PI; arc.position.y = .25;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .6, 20), m); stem.position.y = -.85;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .1, 40), m); base.position.y = -1.15;
      return [cap, arc, stem, base];
    },
  };
  BUILD.pulse = BUILD.progress;

  const cache = {};
  function group(key) {
    if (cache[key]) return cache[key];
    const m = glass(), g = new THREE.Group();
    (BUILD[key] || BUILD.app)(m).forEach((x) => g.add(x));
    const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3());
    g.userData.k = 2.9 / Math.max(size.x, size.y);
    g.userData.mats = [];
    g.traverse((o) => { if (o.material && !g.userData.mats.includes(o.material)) g.userData.mats.push(o.material); });
    g.visible = false;
    scene.add(g);
    return (cache[key] = g);
  }

  let cur = null, prev = null, t0 = 0;
  const clock = new THREE.Clock();
  function show(key) {
    const g = group(key);
    if (g === cur) return;
    if (prev && prev !== g) prev.visible = false;
    prev = cur;
    cur = g;
    cur.visible = true;
    t0 = clock.getElapsedTime();
  }
  function brand() {   // the active client changed: rebuild the brand plate
    const g = cache.brand;
    if (!g) return;
    delete cache.brand;
    const was = g === cur;
    if (g === prev) prev = null;
    scene.remove(g);
    g.traverse((o) => { o.geometry?.dispose(); if (o.material?.map) o.material.map.dispose(); });
    if (was) { cur = null; show("brand"); }
  }
  function setOpacity(g, a) { g.userData.mats.forEach((m) => { m.opacity = a; }); }

  function theme(isDark) {
    dark = isDark;
    tint = isDark ? "#b9bcc8" : "#b8c8f0";   // دارك: زجاج مدخّن · لايت: زجاج أبيض مزرق (زي الجيليفيش في المرجع)
    scene.environment = envMap(isDark);
    paintBackdrop(isDark);
    Object.values(cache).forEach((g) => g.userData.mats.forEach((m) => { if (m.attenuationColor) m.attenuationColor.set(tint); }));
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

  const ease = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  function frame() {
    const t = clock.getElapsedTime(), p = Math.min(1, (t - t0) / .75), e = ease(p);
    const lift = stage.clientHeight > 380 ? .55 : .35;   // the object sits above the title text
    if (cur) {
      const k = cur.userData.k;
      const s = k * (1.12 - .12 * e);
      cur.scale.setScalar(s);
      setOpacity(cur, e);
      cur.position.y = lift + (reduce.matches ? 0 : Math.sin(t * .8) * .1);
      cur.rotation.y = reduce.matches ? 0 : Math.sin(t * .45) * .38;
      cur.rotation.x = reduce.matches ? 0 : Math.sin(t * .3) * .08;
      cur.children.forEach((c) => { if (c.userData.spin && !reduce.matches) c.rotation.z = t * .25; });
    }
    if (prev) {
      setOpacity(prev, 1 - e);
      prev.scale.setScalar(prev.userData.k * (1 - .12 * e));
      if (p >= 1) { prev.visible = false; prev = null; }
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
