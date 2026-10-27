// 🔶 الكرة ثلاثية الأبعاد للمساعد الصوتي: شبكة خطوط منوّرة على كرة سطحها بيتموّج بـ noise، وحواليها هالة نقط.
// الحركة مع الكلام: وهو ساكت بتتنفس وتلف ببطء، ولما يتكلم الموج بيعلى على قد صوته والنقط بتتنفض لبرّه،
// ولما العميل يتكلم بتهدى وتنوّر أبيض كأنها بتسمعه. WebGL خام من غير مكتبات (الموقع مبيحمّلش سكربتات من برّه).
// الاستخدام: const o = Orb3D(canvas); o.set(level 0..1, userTalking); o.stop();
(function () {
  const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;
  // الشبكة والنقط بنفس الـ shader: a.w = 0 خط على السطح، 1 نقطة في الهالة (وa.w الكسري = بعدها عن السطح)
  const VS = `precision highp float;
attribute vec4 a; attribute float r;
uniform float t, lv, us, asp, pt; uniform mat3 rot;
varying float vA; varying float vK; varying vec3 vP;
${NOISE}
float disp(vec3 p){ return snoise(p*1.5+vec3(0.0,t*0.32,t*0.2))*(0.065+lv*0.13) + snoise(p*3.2-vec3(t*0.45))*(0.018+lv*0.035); }
void main(){
  vec3 p=normalize(a.xyz); float d=disp(p);
  float halo=a.w; vec3 q;
  if(halo>0.0){ q=p*(1.0+d*0.8+halo*(0.10+lv*0.30)+0.02*sin(t*2.0+r*30.0)); }
  else { q=p*(1.0+d); }
  q=rot*q; vP=q;
  float z=q.z+3.1; vec2 xy=q.xy/z*2.6; xy.x/=asp;
  gl_Position=vec4(xy, 0.0, 1.0);
  float face=clamp(0.5+0.5*q.z/1.2,0.0,1.0);
  // الخطوط كلها بتتقابل عند القطبين، فبتخفت هناك عشان النور ميتجمّعش في نقطة
  float pole=1.0-smoothstep(0.82,0.99,abs(p.y));
  vA=halo>0.0 ? (0.45+0.55*fract(r*7.13+t*0.15*(0.5+r)))*(0.6+lv*0.9) : mix(0.28,0.95,1.0-face*0.55)*(0.6+lv*0.6)*pole;
  vK=halo; gl_PointSize=halo>0.0 ? pt*(1.0+r*1.6)*(1.0+lv*0.6) : 1.0;
}`;
  const FS = `precision highp float;
uniform float us; varying float vA; varying float vK; varying vec3 vP;
void main(){
  float a=vA;
  if(vK>0.0){ vec2 c=gl_PointCoord-0.5; a*=smoothstep(0.5,0.0,length(c)); }
  // برتقالي منوّر: من البرتقالي الغامق تحت للدهبي فوق، والحافة وردي-برتقالي، ولما العميل يتكلم بيميل للأبيض
  vec3 lo=vec3(1.0,0.36,0.04), hi=vec3(1.0,0.78,0.38), rim=vec3(1.0,0.48,0.32);
  vec3 col=mix(lo,hi,clamp(0.5+vP.y*0.55,0.0,1.0)); col=mix(col,rim,clamp(-vP.x*0.4,0.0,0.6));
  col=mix(col,vec3(1.0,0.95,0.88),us*0.55);
  gl_FragColor=vec4(col*a,a);
}`;

  function build(lat, lon, nHalo) {
    const v = [], rr = [];
    const P = (th, ph) => [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
    const seg = (a, b) => { v.push(...a, 0, ...b, 0); rr.push(0, 0); };
    for (let i = 1; i < lat; i++) {            // خطوط العرض
      const th = (i / lat) * Math.PI;
      for (let j = 0; j < lon; j++) seg(P(th, (j / lon) * 2 * Math.PI), P(th, ((j + 1) / lon) * 2 * Math.PI));
    }
    for (let j = 0; j < lon; j++) {             // خطوط الطول
      const ph = (j / lon) * 2 * Math.PI;
      for (let i = 0; i < lat; i++) seg(P((i / lat) * Math.PI, ph), P(((i + 1) / lat) * Math.PI, ph));
    }
    const lines = v.length / 4, pts = [];
    for (let k = 0; k < nHalo; k++) {
      const u = Math.random() * 2 - 1, ph = Math.random() * 2 * Math.PI, s = Math.sqrt(1 - u * u);
      pts.push(s * Math.cos(ph), u, s * Math.sin(ph), 0.02 + Math.pow(Math.random(), 2.2) * 0.9); rr.push(Math.random());
    }
    return { data: new Float32Array([...v, ...pts]), r: new Float32Array(rr), lines, points: nHalo };
  }

  window.Orb3D = function (canvas, opt = {}) {
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    const g = build(opt.lat || 46, opt.lon || 72, opt.halo || 2200);
    const buf = (arr, name, size) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); const l = gl.getAttribLocation(pr, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0); };
    buf(g.data, "a", 4); buf(g.r, "r", 1);
    const U = (n) => gl.getUniformLocation(pr, n);
    const u = { t: U("t"), lv: U("lv"), us: U("us"), asp: U("asp"), pt: U("pt"), rot: U("rot") };
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);   // جمع الضوء: الخطوط اللي فوق بعض بتنوّر أكتر
    let lv = 0, tgt = 0, us = 0, usT = 0, ang = 0, raf = 0, last = performance.now(), alive = true;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    function size() {
      const w = canvas.clientWidth || 300, h = canvas.clientHeight || 300;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      gl.viewport(0, 0, canvas.width, canvas.height);
      return w / h;
    }
    function frame(now) {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      lv += (tgt - lv) * (tgt > lv ? 0.35 : 0.08);   // بيعلى بسرعة مع الصوت وبينزل بهدوء
      us += (usT - us) * 0.08;
      ang += dt * (0.18 + lv * 0.5);
      const c = Math.cos(ang), s = Math.sin(ang), tl = 0.32, ct = Math.cos(tl), st = Math.sin(tl);
      // لف حوالين المحور الرأسي، ومايلة شوية لقدّام عشان الخطوط تبان ثلاثية الأبعاد
      gl.uniformMatrix3fv(u.rot, false, new Float32Array([c, s * st, -s * ct, 0, ct, st, s, -c * st, c * ct]));
      gl.uniform1f(u.t, now / 1000); gl.uniform1f(u.lv, lv); gl.uniform1f(u.us, us);
      gl.uniform1f(u.asp, size()); gl.uniform1f(u.pt, 2.1 * dpr);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.LINES, 0, g.lines);
      gl.drawArrays(gl.POINTS, g.lines, g.points);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return {
      set(level, userTalking) { tgt = Math.max(0, Math.min(1, level || 0)); usT = userTalking ? 1 : 0; },
      stop() { alive = false; cancelAnimationFrame(raf); },
    };
  };
})();
