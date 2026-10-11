// deterministic ring-escape simulation (fixed step); returns samples + events
function simulate(opt) {
  const { N = 12, R0 = 70, DR = 30, GAP = .55, g = 1500, e = 1.0, dt = 1 / 480, T = 20, start = [0, -10], v0 = [260, -100], speeds } = opt;
  let x = start[0], y = start[1], vx = v0[0], vy = v0[1], k = 0;
  const rb = 12, samples = [], events = [];
  const ang = (i, t) => (i * 1.3 + (speeds ? speeds[i] : (i % 2 ? -1 : 1) * (.9 + i * .12)) * t);
  for (let s = 0, t = 0; t < T; s++, t = s * dt) {
    if (s % 4 === 0) samples.push([x, y, k]);
    if (t < opt.hold) continue;
    vy += g * dt; x += vx * dt; y += vy * dt;
    if (k < N) {
      const R = R0 + k * DR, d = Math.hypot(x, y);
      if (d + rb >= R) {
        let a = Math.atan2(y, x) - ang(k, t); a = ((a % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        if (Math.abs(a) < GAP / 2) { events.push(["pass", t, k]); k++; }
        else {
          const nx = x / d, ny = y / d, vn = vx * nx + vy * ny;
          if (vn > 0) { vx -= (1 + e) * vn * nx; vy -= (1 + e) * vn * ny; const tx = -ny, ty = nx; vx += tx * 30; vy += ty * 30; events.push(["hit", t, k]); }
          x = nx * (R - rb - .5); y = ny * (R - rb - .5);
        }
      }
    } else if (!events.find((e) => e[0] === "free")) events.push(["free", t, k]);
  }
  return { samples, events, dt: dt * 4 };
}
if (typeof module !== "undefined") module.exports = simulate;
