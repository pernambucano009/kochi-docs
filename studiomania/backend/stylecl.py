"""🎨 استنساخ الستايل: مراجع (صور/فيديو) + فكرة ← أنيميشن مرسوم بالكود فريم فريم.

مفيش موديل فيديو: الموديل بيكتب دالة JavaScript بترسم أي لحظة على Canvas، والمتصفح (من غير نت ولا كوكيز)
بيرسم كل فريم، والموسيقى والمؤثرات بتتعمل هنا بالحساب، وFFmpeg بيجمّعهم في MP4.

هنا: البرومبتات، والصفحة اللي بترسم، والكود التجريبي (وضع التجربة)، والصوت.
"""
from __future__ import annotations

import json
import math
import re
import wave
from pathlib import Path

import numpy as np

RATIOS = {"9:16": (1080, 1920), "1:1": (1080, 1080), "16:9": (1920, 1080), "4:5": (1080, 1350)}
DURATIONS = (6, 10, 15, 20)
FPS = 30
FONTS = {"Cairo": "SM-Cairo.ttf", "Tajawal": "SM-Tajawal.ttf", "Changa": "SM-Changa.ttf", "Lalezar": "SM-Lalezar.ttf",
         "Almarai": "SM-Almarai.ttf"}
SFX_KINDS = ("whoosh", "pop", "click", "hit", "riser", "chime", "pluck", "scratch", "blip", "boom")
FORMATS = ("single-world story", "transformation journey", "showcase montage", "explainer", "seamless loop", "kinetic type")
MOODS = ("warm", "playful", "calm", "tense", "epic")
KEYS = {"C": 261.63, "D": 293.66, "E": 329.63, "F": 349.23, "G": 392.0, "A": 440.0, "B": 493.88}

# ---------------------------------------------------------------- المساعدات اللي الكود بيستخدمها

HELPERS = r"""
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const lerp=(a,b,k)=>a+(b-a)*k;
const prog=(t,a,b)=>clamp((t-a)/(b-a));
const E={lin:k=>k,inOut:k=>k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2,out:k=>1-Math.pow(1-k,3),in:k=>k*k*k,
  outBack:k=>{const c=1.70158;return 1+(c+1)*Math.pow(k-1,3)+c*Math.pow(k-1,2)},
  outElastic:k=>k===0||k===1?k:Math.pow(2,-10*k)*Math.sin((k*10-.75)*2*Math.PI/3)+1,
  bounce:k=>{const n=7.5625,d=2.75;if(k<1/d)return n*k*k;if(k<2/d)return n*(k-=1.5/d)*k+.75;if(k<2.5/d)return n*(k-=2.25/d)*k+.9375;return n*(k-=2.625/d)*k+.984375}};
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const _P=(()=>{const r=rng(1234),p=[...Array(256).keys()];for(let i=255;i>0;i--){const j=Math.floor(r()*(i+1));[p[i],p[j]]=[p[j],p[i]]}return p.concat(p)})();
function noise2(x,y){const X=Math.floor(x)&255,Y=Math.floor(y)&255;x-=Math.floor(x);y-=Math.floor(y);const f=k=>k*k*(3-2*k),u=f(x),v=f(y);
  const g=(h,a,b)=>((h&1)?-a:a)+((h&2)?-b:b);const A=_P[X]+Y,B=_P[X+1]+Y;
  return lerp(lerp(g(_P[A],x,y),g(_P[B],x-1,y),u),lerp(g(_P[A+1],x,y-1),g(_P[B+1],x-1,y-1),u),v)*.5}
const _G={};
function grain(ctx,amount=.08,t=0,scale=2){const key=scale;if(!_G[key]){const c=document.createElement('canvas');c.width=c.height=256;
  const g=c.getContext('2d'),d=g.createImageData(256,256),r=rng(99);for(let i=0;i<d.data.length;i+=4){const v=r()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255}
  g.putImageData(d,0,0);_G[key]=c}ctx.save();ctx.globalAlpha=amount;ctx.globalCompositeOperation='overlay';
  const o=Math.floor(t*12)%4*61;ctx.translate(-o,-o*.7);ctx.scale(scale,scale);ctx.fillStyle=ctx.createPattern(_G[key],'repeat');
  ctx.fillRect(0,0,(W+256)/scale+256,(H+256)/scale+256);ctx.restore()}
function wobbly(ctx,pts,amt=3,t=0,close=true){const s=Math.floor(t*8);ctx.beginPath();pts.forEach(([x,y],i)=>{
  const dx=noise2(i*1.7+s,.3)*amt,dy=noise2(.7,i*1.3+s)*amt;i?ctx.lineTo(x+dx,y+dy):ctx.moveTo(x+dx,y+dy)});if(close)ctx.closePath()}
const _K={};
function paper(ctx,color='#efe6d2',seed=3){const key=color+seed;if(!_K[key]){const c=document.createElement('canvas');c.width=W;c.height=H;
  const g=c.getContext('2d'),r=rng(seed);g.fillStyle=color;g.fillRect(0,0,W,H);
  for(let i=0;i<40;i++){const x=r()*W,y=r()*H,rad=(.1+r()*.3)*Math.max(W,H),gr=g.createRadialGradient(x,y,0,x,y,rad);
    gr.addColorStop(0,r()<.5?'rgba(0,0,0,.035)':'rgba(255,255,255,.05)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,W,H)}
  g.strokeStyle='rgba(90,70,40,.10)';g.lineWidth=1;for(let i=0;i<900;i++){const x=r()*W,y=r()*H,a=r()*6.28,l=4+r()*14;
    g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+Math.cos(a+.6)*l*.5,y+Math.sin(a+.6)*l*.5,x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke()}
  g.fillStyle='rgba(60,40,20,.18)';for(let i=0;i<500;i++){g.fillRect(r()*W,r()*H,1+r()*1.5,1+r()*1.5)}_K[key]=c}
  ctx.drawImage(_K[key],0,0)}
function inkLine(ctx,pts,{w=6,color='#1b1b1b',p=1,t=0,taper=true,boil=1.2,nib=true}={}){if(pts.length<2||p<=0)return;
  const s=Math.floor(t*12),L=[0];for(let i=1;i<pts.length;i++)L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const tot=L[L.length-1]*clamp(p),left=[],right=[];let end=null;
  for(let i=0;i<pts.length;i++){let [x,y]=pts[i];if(L[i]>tot){const a=pts[i-1],k=(tot-L[i-1])/Math.max(1e-6,L[i]-L[i-1]);x=lerp(a[0],x,k);y=lerp(a[1],y,k)}
    const j=Math.min(i+1,pts.length-1),h=Math.max(0,i-1),dx=pts[j][0]-pts[h][0],dy=pts[j][1]-pts[h][1],n=Math.hypot(dx,dy)||1;
    const u=L[i]/(L[L.length-1]||1),prof=taper?Math.pow(Math.sin(Math.PI*clamp(u,.04,.96)),.6):1;
    const ww=w*prof*(.8+.4*(noise2(i*.7,s*1.3)+.5))/2,bx=noise2(i*.9+s,2.1)*boil,by=noise2(3.3,i*.9+s)*boil;
    left.push([x+bx-dy/n*ww,y+by+dx/n*ww]);right.push([x+bx+dy/n*ww,y+by-dx/n*ww]);end=[x,y];if(L[i]>=tot)break}
  ctx.save();ctx.fillStyle=color;ctx.beginPath();left.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  for(let i=right.length-1;i>=0;i--)ctx.lineTo(right[i][0],right[i][1]);ctx.closePath();ctx.fill();
  if(nib&&p<1&&end){ctx.beginPath();ctx.arc(end[0],end[1],w*.45,0,6.283);ctx.fill()}ctx.restore()}
function halftone(ctx,pathFn,color,{cell=12,angle=.4,dx=0,dy=0,shade=null,blend='multiply'}={}){ctx.save();ctx.beginPath();pathFn(ctx);ctx.clip();
  ctx.globalCompositeOperation=blend;ctx.fillStyle=color;const c=Math.cos(angle),sn=Math.sin(angle),R2=Math.hypot(W,H);
  for(let gy=-R2;gy<R2;gy+=cell)for(let gx=-R2;gx<R2;gx+=cell){const x=W/2+gx*c-gy*sn+dx,y=H/2+gx*sn+gy*c+dy;
    if(x<-cell||y<-cell||x>W+cell||y>H+cell)continue;const v=shade?clamp(shade(x,y)):1;if(v<=0.02)continue;
    ctx.beginPath();ctx.arc(x,y,cell*.55*Math.sqrt(v),0,6.283);ctx.fill()}ctx.restore()}
function iris(ctx,x,y,r,draw){ctx.save();ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,6.283);ctx.clip();draw(ctx);ctx.restore()}
function tau(t,segs=[[0,1]]){let acc=0;for(let i=0;i<segs.length;i++){const [a,rate]=segs[i],b=i+1<segs.length?segs[i+1][0]:Infinity;
  if(t<=a)break;acc+=(Math.min(t,b)-a)*rate}return acc}
const typed=(str,p)=>[...str].slice(0,Math.round([...str].length*clamp(p))).join('');
function text(ctx,str,x,y,{size=80,font='Cairo',weight=800,color='#fff',align='center',rtl=null,alpha=1}={}){ctx.save();
  ctx.globalAlpha*=alpha;ctx.font=`${weight} ${size}px "${font}"`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';
  ctx.direction=(rtl??/[؀-ۿ]/.test(str))?'rtl':'ltr';ctx.fillText(str,x,y);ctx.restore()}
"""

HELPERS_DOC = """متاح لك جاهز (متعرّفش تاني):
- W, H, DUR (المقاس والمدة بالثواني)
- clamp(x,a=0,b=1) · lerp(a,b,k) · prog(t,a,b) = تقدّم من 0 لـ 1 بين الوقتين a و b
- E.lin / E.inOut / E.out / E.in / E.outBack / E.outElastic / E.bounce : دوال تنعيم بتاخد 0..1
- rng(seed) : مولّد أرقام عشوائية ثابت (استخدمه بدل Math.random)
- noise2(x,y) : ضوضاء ناعمة من -0.5 لـ 0.5
- grain(ctx, amount=.08, t, scale=2) : حبيبات ورق/طباعة فوق الكادر
- wobbly(ctx, [[x,y],...], amt=3, t, close=true) : مسار بخط مهزوز كأنه مرسوم باليد (بعده ctx.fill() أو ctx.stroke())
- text(ctx, str, x, y, {size, font, weight, color, align, rtl, alpha}) : كلام عربي أو إنجليزي (الاتجاه بيتظبط لوحده)
- paper(ctx, color='#efe6d2', seed) : أرضية ورق كاملة (بقع وألياف ونقط) متجهّزة مرة واحدة
- inkLine(ctx, [[x,y],...], {w, color, p, t, taper, boil, nib}) : خط حبر عرضه بيتغيّر وأطرافه رفيعة وبيرتعش كل فريمين؛ p من 0 لـ 1 = الرسم وهو بيتكتب
- halftone(ctx, c=>{ /* path */ }, color, {cell, angle, dx, dy, shade:(x,y)=>0..1, blend}) : نقط طباعة جوه شكل؛ لون تاني بزاوية تانية وإزاحة 1-3px = ريزوجراف
- iris(ctx, x, y, r, c=>{...}) : انتقال قزحية (دايرة بتفتح على عالم تاني)
- tau(t, [[t0, rate], ...]) : الوقت بسرعات (1 عادي، 0.1 بطيء، 0 فريز) للموضوع وجزيئاته
- typed(str, p) : جزء من الكلام لحد p (كتابة على الآلة الكاتبة)
الخطوط المتاحة: """ + "، ".join(FONTS)


def harness(code: str, w: int, h: int, dur: float) -> str:
    """الصفحة اللي بترسم: الكود جوه، ومفيش نت (غير الخطوط من السيرفر نفسه)."""
    faces = "".join(f'@font-face{{font-family:"{fam}";src:url("https://fonts.local/{f}")}}' for fam, f in FONTS.items())
    loads = ",".join(f'document.fonts.load(\'800 40px "{fam}"\')' for fam in FONTS)
    safe = code.replace("</script", "<\\/script")
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{faces}
html,body{{margin:0;background:#000;overflow:hidden}}canvas{{display:block;width:100vw;height:100vh}}</style></head><body>
<canvas id="c" width="{w}" height="{h}"></canvas>
<script>
const W={w},H={h},DUR={dur};const ctx=document.getElementById('c').getContext('2d');window.__err=null;
{HELPERS}
try{{
{safe}
;if(typeof scene!=='function')throw new Error('scene is not defined');
}}catch(e){{window.__err='load: '+(e&&e.message||e)}}
window.ready=Promise.all([{loads}]).catch(()=>0);
window.renderAt=(t)=>{{if(window.__err&&window.__err.startsWith('load'))return window.__err;ctx.save();ctx.setTransform(1,0,0,1,0,0);
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,W,H);
  try{{scene(ctx,t,W,H)}}catch(e){{window.__err='t='+t.toFixed(2)+': '+(e&&e.message||e)}}ctx.restore();return window.__err}};
window.stats=()=>{{const d=ctx.getImageData(0,0,W,H).data;let s=0,s2=0,n=0;for(let i=0;i<d.length;i+=4*97){{const v=(d[i]+d[i+1]+d[i+2])/3;s+=v;s2+=v*v;n++}}
  const m=s/n;return {{mean:m,sd:Math.sqrt(Math.max(0,s2/n-m*m))}}}};
</script></body></html>"""


# ---------------------------------------------------------------- البرومبتات

def plan_messages(idea: str, dur: int, ratio: str, n_refs: int, brand: str) -> list[dict]:
    text = f"""You are a small animation studio with great taste. You get {n_refs} reference image(s) (or frames from a reference video) and a rough idea.
The video will be drawn entirely in code on a 2D canvas (shapes, ink lines, gradients, halftone, paper texture, type). No photos.

IDEA: {idea}
DURATION: {dur}s · RATIO: {ratio}
{('BRAND (colours and wording if it fits):' + chr(10) + brand) if brand else ''}

Rules (each prevents a real failure):
1. Take the LOOK, never the subject: palette, texture, line, rendering technique, composition, typography, motion rhythm. Do NOT reuse what the refs depict (their characters, objects, scenes). List those in do_not_copy.
2. One idea with a payoff: say it in one sentence, build toward one moment (a reveal, freeze, bloom, closing line). If the idea rests on a real fact, use one TRUE detail.
3. Every transition is motivated: a match on shape/position, an action or impact in the scene, or a physical device (a line the subject crosses, an iris from a dot, a window that grows, ink that spreads). No empty beat cuts.
4. Camera locked unless it follows a subject or reveals something; every move eases in, travels, lands with a hold.
5. Energy curve: hook (0-1s) -> build (each beat adds something) -> breath (slow-mo/freeze/silence) -> payoff -> end card held >= 1s.
   For 15s: 0-1 hook · 1-4 establish · 4-8 escalate (new state every 1-2s) · 8-11 peak · 11-13 breath · 13-15 payoff+card. Scale for other lengths.
6. One continuity device through the whole piece (a subject, a dot, a line, a character, a colour).
7. Hand-made: variable-width ink that boils on 2s, paper fibres, grain, halftone/stipple matching the refs, overshoot and holds, secondary motion.
8. Fill the frame like a poster: foreground, subject, textured background. In 9:16 stack it: sky/title top ~25%, subject band middle, ground bottom.
9. Every visible action gets a sound; risers into transitions, impacts on them, silence on a freeze.
On-screen text: minimal, short, in the same language as the idea.

Pick ONE format: {', '.join(FORMATS)}.

Return JSON only:
{{"title": "short name",
 "format": "",
 "logline": "the piece in one sentence", "payoff": "the one moment it builds to", "device": "the continuity device",
 "style": {{"name": "", "look": "3-5 precise sentences", "palette": ["#hex", ...6-10], "palette_roles": {{"#hex": "role"}}, "background": "#hex",
   "ground": "paper / flat / gradient...", "texture": "texture recipe", "line": "line quality", "shapes": "", "light": "", "depth": "",
   "composition": "", "type": "typography (one of: {', '.join(FONTS)})", "motion": "avg shot length + easing personality", "do_not_copy": ["what each ref depicts"]}},
 "fps": 24 or 30 (24 for hand-drawn stepped feel),
 "beats": [{{"t0": 0, "t1": 1.0, "what": "exactly what we see", "text": "on-screen text or empty", "transition": "what motivates the cut into the next beat", "camera": "locked / follows / reveals ...", "sound": "what we hear"}}],
 "end_card": {{"text": "closing line", "t0": {max(1, dur - 1.5)}}},
 "sfx": [{{"t": 0.2, "kind": "{'|'.join(SFX_KINDS)}"}}],
 "music": {{"bpm": 100, "mood": "{'|'.join(MOODS)}", "key": "C|D|E|F|G|A|B"}}}}"""
    return [{"role": "user", "content": text}]


CODE_RULES = """Hard rules:
- scene(ctx,t,W,H) is PURE: same t = same image. No Date, performance, Math.random, setTimeout, requestAnimationFrame, fetch, Image, network. Randomness only from rng(seed).
- Redraw the whole frame from scratch every call (background first). No state carried between frames.
- Pre-build heavy static things ONCE outside scene (point lists, layouts); paper() caches itself.
- Fast: each frame well under 40ms. Avoid per-pixel loops inside scene.
- Keep save/restore balanced; reset globalAlpha / globalCompositeOperation after you change them.
Craft (the bar: "Claude drew every frame" videos):
- Hook in the first second; one continuity device always visible; each beat adds something; a breath before the payoff; end card held >= 1s.
- Every transition motivated (match cut, real impact, iris from a dot, a wipe by a line in the world, a window growing to full frame). Camera locked unless following/revealing; ease in, travel, land, hold.
- Hand-made: inkLine with taper + boil, paper()/grain() texture every frame, halftone for riso/print looks, overshoot (E.outBack) and holds, secondary motion (ripples, dust, tails).
- Fill the frame like a poster: foreground, subject, textured background; side-view subjects span ~90% of the width; nothing tiny floating in empty space.
- Silhouettes must read at thumbnail size. No accidental faces/expressions.
- Text: big, legible, >= 60px from the edges; in 9:16 keep the bottom 250px clear (captions/UI).
- Use the planned palette exactly; follow the beats and their times exactly; never draw anything from do_not_copy."""


def code_messages(plan: dict, w: int, h: int, dur: int) -> list[dict]:
    system = ("You are a senior motion designer who writes Canvas 2D JavaScript. You write ONE function scene(ctx, t, W, H) that draws the full frame at time t (seconds).\n"
              f"{CODE_RULES}\n{HELPERS_DOC}\n"
              "Return only the code inside ```js ... ``` with no explanation.")
    user = (f"Size {w}x{h} · duration {dur}s.\nPlan and style bible:\n{json.dumps(plan, ensure_ascii=False, indent=1)}\n\n"
            "Write scene(ctx,t,W,H) that executes this plan exactly, in this style.")
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def fix_messages(code: str, problem: str) -> list[dict]:
    return [{"role": "system", "content": "You fix Canvas 2D animation code. Apply the principle behind the note everywhere it matters, not just at one spot. "
                                          f"{CODE_RULES}\n{HELPERS_DOC}\nReturn the full fixed code inside ```js ... ``` only."},
            {"role": "user", "content": f"Problem / note:\n{problem}\n\nCode:\n```js\n{code}\n```"}]


def review_text(plan: dict, n_refs: int, times: list[float]) -> str:
    return (f"The first {n_refs} image(s) are the references (target look). The rest are stills from the animation at {', '.join(f'{t:.1f}' for t in times)}s.\n"
            f"Plan:\n{json.dumps(plan, ensure_ascii=False)[:3500]}\n\n"
            "Review like a studio director. Each still must pass:\n"
            "- looks like a finished illustration (not a placeholder);\n- the frame is full (no small subject in empty space);\n"
            "- the style comes from the refs and NOTHING from do_not_copy appears;\n- the subject reads at phone size;\n"
            "- no goofy faces or broken shapes;\n- texture is present;\n- text is legible, not clipped, inside the margins, not reversed/garbled;\n"
            "- the stills progress (hook -> build -> payoff), not the same picture repeated.\n"
            'Return JSON only: {"score": 1-10, "ok": true/false, "issues": ["specific problem + how to fix it in code", ...]} '
            "(ok=true only if score >= 7 and nothing above fails).")


def extract_code(text: str) -> str:
    m = re.findall(r"```(?:js|javascript)?\s*\n(.*?)```", text or "", re.S)
    code = max(m, key=len) if m else (text or "")
    return code.strip()


def mock_plan(idea: str, dur: int) -> dict:
    return {"title": (idea or "تجربة")[:40],
            "style": {"name": "فلات بحبيبات", "look": "أشكال بسيطة وألوان دافية", "palette": ["#f4a259", "#5b8e7d", "#bc4b51", "#f4e285"],
                      "background": "#1d1a2f", "line": "من غير حدود", "texture": "حبيبات خفيفة", "motion": "ناعمة بارتداد", "type": "عريض"},
            "beats": [{"t0": 0, "t1": dur * .3, "what": "دواير بتفتح", "text": ""}, {"t0": dur * .3, "t1": dur, "what": "الكلام", "text": idea[:30]}],
            "sfx": [{"t": 0.1, "kind": "pop"}, {"t": dur * .3, "kind": "whoosh"}, {"t": dur * .6, "kind": "hit"}],
            "music": {"bpm": 104, "mood": "playful", "key": "D"}}


def mock_code(title: str) -> str:
    t = json.dumps(title[:40], ensure_ascii=False)
    return """
const PAL=['#f4a259','#5b8e7d','#bc4b51','#f4e285'];
const R=rng(7);const DOTS=Array.from({length:40},()=>({x:R(),y:R(),r:6+R()*22,c:PAL[Math.floor(R()*4)],d:R()*1.5}));
function scene(ctx,t,W,H){
  ctx.fillStyle='#1d1a2f';ctx.fillRect(0,0,W,H);
  const m=Math.min(W,H);
  for(let i=0;i<4;i++){const k=E.outBack(prog(t,.15*i,.15*i+1));ctx.fillStyle=PAL[i];ctx.beginPath();
    ctx.arc(W/2,H*.42,m*(.42-i*.09)*k,0,Math.PI*2);ctx.fill()}
  DOTS.forEach(o=>{const k=E.out(prog(t,o.d,o.d+1));ctx.globalAlpha=k;ctx.fillStyle=o.c;ctx.beginPath();
    ctx.arc(o.x*W,o.y*H+Math.sin(t*1.5+o.d*6)*12,o.r*k,0,Math.PI*2);ctx.fill()});ctx.globalAlpha=1;
  const a=E.out(prog(t,DUR*.3,DUR*.3+.6));
  text(ctx,""" + t + """,W/2,H*.78+(1-a)*60,{size:m*.08,color:'#f4e285',alpha:a});
  grain(ctx,.1,t);
}"""


# ---------------------------------------------------------------- الصوت (بالحساب)

SR = 44100


def _env(n: int, a: float, r: float) -> np.ndarray:
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / max(r, 1e-4))


def _sfx(kind: str, rnd: np.random.Generator) -> np.ndarray:
    if kind == "whoosh":
        n = int(SR * .6)
        x = rnd.standard_normal(n)
        # فلتر بيتفتح ويقفل (متوسط متحرك بطول متغير تقريبي)
        k = np.convolve(x, np.ones(8) / 8, "same")
        env = np.sin(np.linspace(0, np.pi, n)) ** 2
        return .35 * k * env
    if kind == "pop":
        n = int(SR * .15)
        t = np.arange(n) / SR
        f = 900 * np.exp(-t * 30) + 250
        return .5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n, .002, .04)
    if kind == "click":
        n = int(SR * .03)
        return .4 * rnd.standard_normal(n) * _env(n, .0005, .004)
    if kind == "hit":
        n = int(SR * .8)
        t = np.arange(n) / SR
        f = 120 * np.exp(-t * 8) + 45
        return .8 * np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n, .002, .25) + .15 * rnd.standard_normal(n) * _env(n, .001, .03)
    if kind == "riser":
        n = int(SR * 1.2)
        t = np.arange(n) / SR
        f = 200 * (1 + 4 * (t / t[-1]) ** 2)
        env = (t / t[-1]) ** 2
        return .25 * (np.sin(2 * np.pi * np.cumsum(f) / SR) + .5 * np.convolve(rnd.standard_normal(n), np.ones(4) / 4, "same")) * env
    if kind == "chime":
        n = int(SR * 1.2)
        t = np.arange(n) / SR
        return .25 * sum(np.sin(2 * np.pi * 880 * p * t) / (i + 1) for i, p in enumerate((1, 2.76, 5.4))) * _env(n, .002, .35)
    if kind == "pluck":   # Karplus-Strong: وتر بيتشد
        n, f = int(SR * .9), 330 * (1.5 ** rnd.integers(0, 4))
        per = max(2, int(SR / f))
        buf, out = rnd.uniform(-1, 1, per), np.zeros(n)
        for i in range(n):
            out[i] = buf[i % per]
            buf[i % per] = .996 * .5 * (buf[i % per] + buf[(i + 1) % per])
        return .35 * out
    if kind == "scratch":  # قلم على ورق
        n = int(SR * .35)
        x = np.diff(rnd.standard_normal(n + 1))
        env = np.sin(np.linspace(0, np.pi, n)) * (.6 + .4 * np.sin(np.linspace(0, 40, n)))
        return .12 * x * env
    if kind == "blip":
        n = int(SR * .12)
        t = np.arange(n) / SR
        return .3 * np.sin(2 * np.pi * np.cumsum(600 + 2400 * t / t[-1]) / SR) * _env(n, .002, .05)
    if kind == "boom":    # نزلة صب باص للحظة الكبيرة
        n = int(SR * 1.6)
        t = np.arange(n) / SR
        return .9 * np.sin(2 * np.pi * np.cumsum(70 * np.exp(-t * 2) + 30) / SR) * _env(n, .003, .6)
    return np.zeros(1)


def _reverb(x: np.ndarray, wet: float = .16, decay: float = .7, seed: int = 5) -> np.ndarray:
    """صدى بسيط (IR من ضوضاء بتخفت) بالـ FFT."""
    rnd = np.random.default_rng(seed)
    n = int(SR * 1.6)
    ir = rnd.standard_normal(n) * np.exp(-np.arange(n) / (SR * decay / 3))
    ir /= np.sqrt(np.sum(ir ** 2)) or 1
    m = x.size + n - 1
    size = 1 << (m - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: x.size]
    return x + wet * y


def _music(dur: float, bpm: float, mood: str, key: str) -> np.ndarray:
    n = int(SR * dur)
    out = np.zeros(n)
    root = KEYS.get(key, 293.66) / 2
    minor = mood in ("tense", "calm", "epic")
    third = 1.189 if minor else 1.26
    prog_ = [1, 4 / 3, 1.5, 1.122] if not minor else [1, 1.189 * .84, 4 / 3, 1.5]
    beat = 60 / max(60, min(160, bpm))
    bar = beat * 4
    t_all = np.arange(n) / SR
    # pad: كورد لكل مازورة بهجوم بطيء
    for bi in range(int(dur / bar) + 1):
        a, b = int(bi * bar * SR), min(n, int((bi + 1) * bar * SR) + int(SR * .3))
        if a >= n:
            break
        tt = np.arange(b - a) / SR
        f0 = root * prog_[bi % 4]
        tone = sum(np.sin(2 * np.pi * f0 * m * tt + m) for m in (1, third, 1.5, 2)) / 4
        env = np.minimum(1, tt / .4) * np.minimum(1, (b - a - np.arange(b - a)) / (SR * .3))
        out[a:b] += .12 * tone * env
    # إيقاع: كيك على كل ضربة (أخف في الهادي)، وهاي هات على النص
    kick_lv = {"calm": .0, "warm": .35, "playful": .45, "tense": .5, "epic": .6}.get(mood, .4)
    rnd = np.random.default_rng(3)
    kick = _sfx("hit", rnd)[: int(SR * .3)] * kick_lv
    hat = _sfx("click", rnd) * (.0 if mood == "calm" else .25)
    for i in range(int(dur / beat) + 1):
        for start, s in ((i * beat, kick), (i * beat + beat / 2, hat)):
            a = int(start * SR)
            if a < n and s.size > 1:
                m = min(n - a, s.size)
                out[a:a + m] += s[:m]
    # دخول وخروج ناعم
    fade = np.minimum(1, np.minimum(t_all / .5, (dur - t_all) / 1.2))
    return out * np.clip(fade, 0, 1)


def soundtrack(plan: dict, dur: float, out: Path, seed: int = 7) -> Path:
    m = plan.get("music") or {}
    try:
        bpm = float(m.get("bpm") or 100)
    except (TypeError, ValueError):
        bpm = 100
    x = _music(dur, bpm, str(m.get("mood") or "warm"), str(m.get("key") or "D")[:1].upper())
    if plan.get("silent") or plan.get("no_music"):   # «من غير صوت» أو «مؤثرات بس»
        x = np.zeros_like(x)
    rnd = np.random.default_rng(seed)
    n = x.size
    for c in ([] if plan.get("silent") else plan.get("sfx") or []):
        try:
            t = float(c.get("t"))
        except (TypeError, ValueError, AttributeError):
            continue
        s = _sfx(str(c.get("kind") or ""), rnd)
        a = int(max(0, t) * SR)
        if a < n and s.size > 1:
            k = min(n - a, s.size)
            x[a:a + k] += s[:k]
    x = _reverb(x)
    peak = float(np.max(np.abs(x))) or 1
    if plan.get("silent"):
        peak = 1.0
    x = np.tanh(x / peak * 1.2) * .85
    pcm = (x * 32767).astype("<i2")
    with wave.open(str(out), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())
    return out


def sample_times(dur: float) -> list[float]:
    return [round(dur * k, 2) for k in (.08, .3, .55, .85)]


def clean_plan(raw: dict, idea: str, dur: int) -> dict:
    if not isinstance(raw, dict) or not raw.get("style"):
        raise ValueError("الخطة رجعت ناقصة")
    raw["title"] = str(raw.get("title") or idea[:40])[:60]
    raw["sfx"] = [c for c in raw.get("sfx") or [] if isinstance(c, dict) and c.get("kind") in SFX_KINDS][:30]
    m = raw.get("music") if isinstance(raw.get("music"), dict) else {}
    raw["music"] = {"bpm": m.get("bpm") or 100, "mood": m.get("mood") if m.get("mood") in MOODS else "warm", "key": str(m.get("key") or "D")[:1]}
    raw["duration"] = dur
    raw["fps"] = 24 if str(raw.get("fps")) == "24" else 30
    return raw


def wrap_check(code: str) -> str | None:
    """فحص سريع قبل التشغيل: حاجات ممنوعة بتكسر مبدأ «نفس الوقت = نفس الصورة»."""
    for bad, why in (("Math.random", "Math.random (استخدم rng)"), ("Date.now", "Date"), ("new Date", "Date"),
                     ("performance.now", "performance.now"), ("requestAnimationFrame", "requestAnimationFrame"),
                     ("fetch(", "fetch"), ("XMLHttpRequest", "XMLHttpRequest"), ("new Image", "Image"), ("import(", "import")):
        if bad in code:
            return f"الكود فيه {why} وده ممنوع"
    if "function scene" not in code and "scene=" not in code.replace(" ", ""):
        return "مفيش دالة scene"
    return None


