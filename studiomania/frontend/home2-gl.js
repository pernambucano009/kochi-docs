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
    color: 0xffffff, metalness: 0, roughness: .02, transmission: 1, thickness: 2, ior: 1.5,
    clearcoat: 1, clearcoatRoughness: .02, specularIntensity: 1, envMapIntensity: 2.1,
    attenuationColor: new THREE.Color(tint), attenuationDistance: 5.5, transparent: true, opacity: 1,
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

  // ---------- the brain: dark fibres bursting from a core, grown inside the glass (like the jellyfish)
  function pip(poly, x, y) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  }
  const RING = [[1, 0], [.7, .7], [0, 1], [-.7, .7], [-1, 0], [-.7, -.7], [0, -1], [.7, -.7]];
  function inside(S, p, m) {
    if (S.kind === "sphere") return p.length() < S.r - m;
    if (S.kind === "capsule") return Math.hypot(p.x, p.y - Math.max(-S.h, Math.min(S.h, p.y)), p.z) < S.r - m;
    if (Math.abs(p.z) > S.z - m * .6) return false;
    const x = p.x + S.ox, y = p.y + S.oy;
    const ok = (u, v) => pip(S.outer, u, v) && !S.holes.some((h) => pip(h, u, v));
    return ok(x, y) && RING.every(([dx, dy]) => ok(x + dx * m, y + dy * m));
  }
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const BRAIN_A = new THREE.Color("#000000"), BRAIN_B = new THREE.Color("#d9dee8");
  const coreMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .42, metalness: .2, envMapIntensity: 1.1 });
  function brain(geo, budget, seed) {
    const S = geo.userData.solid;
    geo.computeBoundingBox();
    const bb = geo.boundingBox, size = bb.getSize(new THREE.Vector3()), R = rng(seed);
    const at = () => new THREE.Vector3(bb.min.x + R() * size.x, bb.min.y + R() * size.y, bb.min.z + R() * size.z);
    const pts = [];
    for (let i = 0; i < 3000 && pts.length < 260; i++) { const p = at(); if (inside(S, p, .15)) pts.push(p); }
    if (pts.length < 6) return null;
    const mid = bb.getCenter(new THREE.Vector3());
    pts.sort((a, b) => a.distanceTo(mid) - b.distanceTo(mid));
    const centers = [pts[0]];
    while (centers.length < 6) {   // مراكز متباعدة: في الحلقة والشكل الطويل المخ بيتوزّع على طوله
      let best = null, bd = 0;
      for (const p of pts) { const d = Math.min(...centers.map((c) => c.distanceTo(p))); if (d > bd) { bd = d; best = p; } }
      if (bd < .8) break;
      centers.push(best);
    }
    const segs = [], STEP = .036;
    function grow(p, dir, key, len, r0, depth, c) {
      for (let i = 0; i < len; i++) {
        dir.x += (R() - .5) * .5; dir.y += (R() - .5) * .5; dir.z += (R() - .5) * .3;
        dir.addScaledVector(p.clone().sub(c).normalize(), .12).normalize();
        const q = p.clone().addScaledVector(dir, STEP);
        if (!inside(S, q, .06)) return;
        const f = i / len, r = r0 * Math.pow(1 - f, .9) + .004;
        segs.push({ a: p, b: q, ra: r, rb: r0 * Math.pow(1 - (i + 1) / len, .9) + .004, k: key + i });
        if (depth < 2 && R() < .07) grow(q.clone(), dir.clone().add(new THREE.Vector3(R() - .5, R() - .5, (R() - .5) * .5)).normalize(), key + i + 1, Math.floor((len - i) * .7), r * .8, depth + 1, c);
        p = q;
      }
    }
    const per = Math.max(14, Math.round(budget / centers.length));
    centers.forEach((c) => {
      for (let n = 0; n < per; n++) {
        const d = new THREE.Vector3(R() - .5, R() - .5, (R() - .5) * .5).normalize();
        grow(c.clone().addScaledVector(d, R() * .05), d, 0, 16 + Math.floor(R() * 26), .036 + R() * .016, 0, c);
      }
    });
    if (!segs.length) return null;
    segs.sort((a, b) => a.k - b.k);
    const maxK = segs[segs.length - 1].k, n = segs.length;
    const pos = new Float32Array(n * 18), nor = new Float32Array(n * 18), col = new Float32Array(n * 18), idx = new Uint32Array(n * 18), ends = new Uint32Array(maxK + 2);
    const u = new THREE.Vector3(), v = new THREE.Vector3(), w = new THREE.Vector3(), ax = new THREE.Vector3(), tmp = new THREE.Color();
    segs.forEach((sg, i) => {
      ax.subVectors(sg.b, sg.a).normalize();
      u.set(Math.abs(ax.y) < .9 ? 0 : 1, Math.abs(ax.y) < .9 ? 1 : 0, 0).cross(ax).normalize();
      v.crossVectors(ax, u);
      for (let e = 0; e < 2; e++) {
        const c = e ? sg.b : sg.a, r = e ? sg.rb : sg.ra, t = Math.min(1, (sg.k + e) / Math.max(18, maxK * .8));
        tmp.copy(BRAIN_A).lerp(BRAIN_B, Math.pow(t, 1.6));
        for (let s = 0; s < 3; s++) {
          const an = (s / 3) * Math.PI * 2;
          w.copy(u).multiplyScalar(Math.cos(an)).addScaledVector(v, Math.sin(an));
          const o = (i * 6 + e * 3 + s) * 3;
          pos[o] = c.x + w.x * r; pos[o + 1] = c.y + w.y * r; pos[o + 2] = c.z + w.z * r;
          nor[o] = w.x; nor[o + 1] = w.y; nor[o + 2] = w.z;
          col[o] = tmp.r; col[o + 1] = tmp.g; col[o + 2] = tmp.b;
        }
      }
      for (let s = 0; s < 3; s++) {
        const a0 = i * 6 + s, a1 = i * 6 + ((s + 1) % 3), b0 = a0 + 3, b1 = a1 + 3, o = i * 18 + s * 6;
        idx[o] = a0; idx[o + 1] = b0; idx[o + 2] = a1; idx[o + 3] = a1; idx[o + 4] = b0; idx[o + 5] = b1;
      }
      ends[sg.k + 1] = (i + 1) * 18;
    });
    for (let k = 1; k < ends.length; k++) ends[k] = Math.max(ends[k], ends[k - 1]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const mesh = new THREE.Mesh(g, coreMat);
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
  const BRAINS = 320;   // عدد الألياف في كل أيقونة (بتتقسم على أجزائها حسب حجمها)
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
      const solids = g.children.filter((o) => o.geometry?.userData.solid);
      const vol = solids.map((o) => { o.geometry.computeBoundingBox(); const s3 = o.geometry.boundingBox.getSize(new THREE.Vector3()); return s3.x * s3.y * s3.z; });
      const all = vol.reduce((a, b) => a + b, 0) || 1;
      solids.forEach((o, i) => {
        const b = brain(o.geometry, BRAINS * vol[i] / all, key.length * 97 + i * 13);
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
    tint = isDark ? "#b9bcc8" : "#b8c8f0";   // دارك: زجاج مدخّن · لايت: زجاج أبيض مزرق (زي الجيليفيش في المرجع)
    scene.environment = envMap(isDark);
    paintBackdrop(isDark);
    Object.values(cache).forEach((g) => { g.userData.mats.forEach((m) => { if (m.attenuationColor) m.attenuationColor.set(tint); }); g.userData.rim.uniforms.c.value.set(isDark ? "#ffffff" : "#1b2233"); });
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
