"""📖 «حكاية»: قصة قصيرة بصوت راوي، كل مشهد مرسوم بالكود ومتظبط على توقيت النص.

الترتيب (الصوت أولًا ثم الصورة على مقاسه):
الفكرة ← القصة والمشاهد (تُعدّل) ← صوت الراوي (مولّد أو بصوتك) ← توقيت كل كلمة ← المشاهد بالكود ← الفيديو.
النص يظهر على الشاشة كلمة كلمة لحظة ما تُقال.

الأسلوب منفصل عن الرسم: المشاهد تُرسم بأدوات عامة (P للأشكال، M للخامة)، وكل أسلوب (لبّاد، ورق، شمع، ألوان مية…)
يعطي نفس الأدوات شكل آخر. فتغيير الأسلوب بعد ما المشاهد تنتهي لا يحتاج يكتب كود آخر.
"""
from __future__ import annotations

import difflib
import json
import re
import algo

RATIOS = {"16:9": (1920, 1080), "9:16": (1080, 1920), "1:1": (1080, 1080)}
DRAW = {"16:9": (1280, 720), "9:16": (720, 1280), "1:1": (864, 864)}   # بيترسم بالمقاس ده ويتكبّر في الآخر (أسرع ×2.2)
LENGTHS = (20, 30, 40, 60)
FPS = 12          # رسمة كل فريمين («on twos») زي الأنيميشن المرسوم باليد، وأسرع ×2
OUT_FPS = 24
LEAD = .4         # الصوت بيبدأ بعد البداية بشوية
TAIL = 1.2        # نفَس بعد آخر كلمة
TD = .5           # مدة الانتقال بين المشاهد
AUDIENCES = {"kids": "حكاية أطفال", "brand": "حكاية للعلامة", "general": "حكاية لأي حد"}
MOODS = {"playful": "مرحة", "warm": "دافية", "calm": "هادية", "epic": "حماسية", "tense": "تشويق"}
ENDINGS = {"none": "بدون نهاية خاصة", "brand": "اسم العلامة والدعوة (CTA)", "custom": "كلمة في التعليق + جملة"}
TRANS = ("scallop", "iris", "slide", "dissolve", "page")
ROLES = ("sky", "sky2", "sun", "coral", "teal", "grass", "navy", "cream", "ink", "card", "pink", "purple", "orange", "brown", "white", "skin")


def pal(*vals: str) -> dict:
    return dict(zip(ROLES, vals))


# ---------------------------------------------------------------- الستايلات
# كل ستايل: ألوانه (لنفس الأدوار)، شكل الكلام اللي على الشاشة، الانتقال، اللمسة الأخيرة، وإزاي الأدوات بترسم.
STYLES: dict[str, dict] = {
    "felt": {"ar": "لبّاد وقماش", "en": "Felt", "desc": "قطع لبّاد بحواف منفوشة وخياطة وعيون خرز",
             "pal": pal("#8fd3f4", "#dff3fb", "#ffd23f", "#ff6b5b", "#1fb5a6", "#6cc04a", "#24305e", "#fff4dc", "#3a2a1e", "#fff4dc",
                        "#ff9ec7", "#8e6cd8", "#ff9f1c", "#9b6a43", "#fffaf0", "#f6c9a0"),
             "cap": {"font": "Lalezar", "color": "#3a2a1e", "key": "#ff6b5b", "box": "fill", "box_role": "cream"},
             "trans": "scallop", "post": {"grain": .05, "vignette": .18}},
    "paper": {"ar": "ورق مقصوص", "en": "Cut paper", "desc": "طبقات ورق ملزوقة أعلى بعض بضل حقيقي",
              "pal": pal("#a7d8e8", "#e3f4f8", "#f7c948", "#f26d5b", "#2a9d8f", "#7bb661", "#264653", "#fbf3e4", "#2b2b2b", "#fffdf6",
                         "#f4a3b5", "#9c89d9", "#f4a259", "#a1683a", "#ffffff", "#f1c7a3"),
              "cap": {"font": "Lalezar", "color": "#264653", "key": "#f26d5b", "box": "fill", "box_role": "card"},
              "trans": "scallop", "post": {"grain": .05, "vignette": .1}},
    "crayon": {"ar": "ألوان شمع", "en": "Crayon", "desc": "رسم أطفال بألوان الشمع وتظليل مخربش",
               "pal": pal("#6ec6ff", "#e6f6ff", "#ffe066", "#ff595e", "#1ab0a3", "#8ac926", "#1d3557", "#fffbea", "#2d2a32", "#ffffff",
                          "#ff8fab", "#9b5de5", "#ff924c", "#9c6644", "#ffffff", "#ffd3b4"),
               "cap": {"font": "Lalezar", "color": "#2d2a32", "key": "#ff595e", "box": "none", "stroke": "#ffffff"},
               "trans": "page", "post": {"grain": .07, "vignette": 0}},
    "watercolor": {"ar": "ألوان مية", "en": "Watercolor", "desc": "ألوان مية شفافة تسيح على ورق خشن",
                   "pal": pal("#9ecae1", "#eaf4fa", "#fdd47e", "#f08c7e", "#5fb3a8", "#9cc77e", "#3d5a80", "#fbf7ef", "#34404f", "#fffdf8",
                              "#f4b6c2", "#a99ad6", "#f6ae6b", "#b07d5b", "#ffffff", "#f6d2b8"),
                   "cap": {"font": "Cairo", "color": "#34404f", "key": "#e76f51", "box": "none", "stroke": "#fbf7ef"},
                   "trans": "dissolve", "post": {"grain": .06, "vignette": .12}},
    "clay": {"ar": "صلصال", "en": "Clay", "desc": "أشكال صلصال منفوخة بلمعة وضل ناعم",
             "pal": pal("#7fc8f8", "#d6efff", "#ffd166", "#ef476f", "#06d6a0", "#83c75d", "#2b3a67", "#fff1d6", "#2b2d42", "#fff8ec",
                        "#ff99c8", "#9d79d9", "#f78c38", "#a0613a", "#fffefa", "#f2c09b"),
             "cap": {"font": "Changa", "color": "#2b2d42", "key": "#ef476f", "box": "fill", "box_role": "white"},
             "trans": "iris", "post": {"grain": .03, "vignette": .15}},
    "flat": {"ar": "فلات حديث", "en": "Flat", "desc": "أشكال نضيفة وألوان صريحة مثل الموشن جرافيك",
             "pal": pal("#5bc0eb", "#dff4fd", "#fde74c", "#ff5964", "#00a6a6", "#9bc53d", "#211a52", "#fff8e8", "#211a52", "#ffffff",
                        "#ff8fb1", "#7b5cff", "#ff9f1c", "#8d5b3e", "#ffffff", "#ffcfa8"),
             "cap": {"font": "Changa", "color": "#ffffff", "key": "#fde74c", "box": "fill", "box_role": "navy"},
             "trans": "slide", "post": {"grain": 0, "vignette": 0}},
    "ink": {"ar": "حبر وقلم", "en": "Ink", "desc": "خطوط حبر ترتعش وتظليل بالتشطيب وألوان باهتة",
            "pal": pal("#bcd9e0", "#eef4ef", "#f4d58d", "#e07a5f", "#81b29a", "#a8c686", "#3d405b", "#f4efe1", "#1b1b1b", "#fbf8ef",
                       "#e9a6a6", "#a597c7", "#f2a65a", "#9a7b5f", "#fffdf6", "#f1d2b6"),
            "cap": {"font": "Cairo", "color": "#1b1b1b", "key": "#e07a5f", "box": "none", "stroke": "#f4efe1"},
            "trans": "page", "post": {"grain": .07, "vignette": .1}},
    "chalk": {"ar": "طباشير على سبورة", "en": "Chalk", "desc": "رسم طباشير ملوّن على سبورة خضراء",
              "pal": pal("#9fd8ff", "#c8ecff", "#ffe9a8", "#ff9e9e", "#8fe3cf", "#b9f2a0", "#253a30", "#f3f3ea", "#f3f3ea", "#33493d",
                         "#ffc2e2", "#cdb4ff", "#ffc48c", "#d9b38c", "#ffffff", "#ffd9c2"),
              "cap": {"font": "Lalezar", "color": "#f3f3ea", "key": "#ffe9a8", "box": "none"},
              "trans": "dissolve", "post": {"grain": .08, "vignette": .3}},
    "riso": {"ar": "طباعة ريزو", "en": "Risograph", "desc": "حبرين يلفّون على بعض ونقاط طباعة",
             "pal": pal("#62c3e8", "#d8eff7", "#ffe800", "#ff48b0", "#00838a", "#00a95c", "#3255a4", "#f6efe1", "#1a1a1a", "#fbf6ea",
                        "#ff7dc6", "#765ba7", "#ff6c2f", "#a5682a", "#ffffff", "#ffb48f"),
             "cap": {"font": "Cairo", "color": "#3255a4", "key": "#ff48b0", "box": "none", "stroke": "#f6efe1"},
             "trans": "slide", "post": {"grain": .12, "vignette": 0}},
    "pixel": {"ar": "بكسل (ألعاب)", "en": "Pixel", "desc": "أسلوب ألعاب الفيديو القديمة",
              "pal": pal("#5fcde4", "#cbdbfc", "#fbf236", "#d95763", "#37946e", "#6abe30", "#222034", "#eec39a", "#222034", "#ffffff",
                         "#d77bba", "#76428a", "#df7126", "#8f563b", "#ffffff", "#eec39a"),
              "cap": {"font": "Changa", "color": "#ffffff", "key": "#fbf236", "box": "fill", "box_role": "navy"},
              "trans": "slide", "post": {"grain": 0, "vignette": 0, "pixel": 240}},
    "neon": {"ar": "نيون", "en": "Neon", "desc": "خطوط منوّرة على ليل غامق",
             "pal": pal("#0b0820", "#1a1040", "#fff35c", "#ff2a6d", "#05d9e8", "#39ff14", "#0b0820", "#ffe8f7", "#d1f7ff", "#140d33",
                        "#ff6ec7", "#b967ff", "#ff9a00", "#ffb86b", "#ffffff", "#ffd1b3"),
             "cap": {"font": "Changa", "color": "#ffffff", "key": "#05d9e8", "box": "none", "glow": True},
             "trans": "iris", "post": {"grain": .04, "vignette": .35}},
    "comic": {"ar": "كوميكس", "en": "Comic", "desc": "حدود سوداء تخينة ونقاط طباعة وظل صريح",
              "pal": pal("#4cc9f0", "#caf0f8", "#ffd60a", "#ef233c", "#06d6a0", "#80b918", "#14213d", "#fff3d6", "#000000", "#ffffff",
                         "#ff70a6", "#7209b7", "#fb8500", "#8b5e34", "#ffffff", "#ffcb9a"),
              "cap": {"font": "Lalezar", "color": "#000000", "key": "#ef233c", "box": "fill", "box_role": "sun"},
              "trans": "slide", "post": {"grain": .03, "vignette": 0}},
    "storybook": {"ar": "كتاب حكايات", "en": "Storybook", "desc": "ألوان جواش قديمة على ورق، وخط بني رفيع",
                  "pal": pal("#9cc5c9", "#e7efe6", "#f2c14e", "#d9644a", "#3f8a83", "#8aa85b", "#2f3e56", "#f3e9d2", "#3b2f2a", "#f8f1df",
                             "#e8a598", "#8e7cc3", "#e9944a", "#8c5a3c", "#fffaf0", "#efc8a5"),
                  "cap": {"font": "Lalezar", "color": "#3b2f2a", "key": "#d9644a", "box": "fill", "box_role": "card"},
                  "trans": "page", "post": {"grain": .06, "vignette": .2}},
}
DEFAULT_STYLE = "felt"


def styles_list() -> list[dict]:
    return [{"key": k, "ar": s["ar"], "en": s["en"], "desc": s["desc"], "swatch": [s["pal"][r] for r in ("sky", "sun", "coral", "teal", "grass")]}
            for k, s in STYLES.items()]


# ---------------------------------------------------------------- محرّك الرسم (JS)
# الأدوات العامة: P (أشكال) و M (خامة)، والخامة بتختلف حسب الستايل. فوقها: الكاميرا، الهزّة، الانتقالات، والكلام اللي بيظهر كلمة كلمة.
KIT = r"""
// النموذج ساعات يكتب min() و sin() و PI بدون Math.: نعرّفهم عامّين (كخصائص، فلو كود الشخصيات عرّف واحد بنفس الاسم مايحصلش تعارض)
for(const k of ['min','max','abs','floor','ceil','round','trunc','sin','cos','tan','asin','acos','atan','atan2','sqrt','cbrt','hypot','pow','sign','exp','log','log2','log10'])if(!(k in globalThis))globalThis[k]=Math[k];
if(!('PI' in globalThis))globalThis.PI=Math.PI;if(!('TAU' in globalThis))globalThis.TAU=Math.PI*2;
const u=Math.min(W,H)/1080;let T=0;
function hx(c){c=M.c(c);if(typeof c!=='string'||c[0]!=='#')return [128,128,128];let s=c.slice(1);if(s.length===3)s=s.split('').map(x=>x+x).join('');const n=parseInt(s.slice(0,6),16);return [n>>16&255,n>>8&255,n&255]}
function mix(a,b,k){const A=hx(a),B=hx(b);return '#'+A.map((v,i)=>Math.round(lerp(v,B[i],clamp(k))).toString(16).padStart(2,'0')).join('')}
const lite=(c,k=.3)=>mix(c,'#ffffff',k),dark=(c,k=.3)=>mix(c,'#000000',k);
function _bb(p,x,y,w,h){p.bb={x,y,w,h};return p}
const P={
 circle(x,y,r){const p=new Path2D();p.arc(x,y,Math.max(.1,r),0,6.2832);return _bb(p,x-r,y-r,2*r,2*r)},
 ellipse(x,y,rx,ry,rot=0){const p=new Path2D();p.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),rot,0,6.2832);const m=Math.max(rx,ry);return _bb(p,x-m,y-m,2*m,2*m)},
 rect(x,y,w,h,r=0){const p=new Path2D();r=Math.max(0,Math.min(r,Math.abs(w)/2,Math.abs(h)/2));if(p.roundRect)p.roundRect(x,y,w,h,r);else p.rect(x,y,w,h);return _bb(p,Math.min(x,x+w),Math.min(y,y+h),Math.abs(w),Math.abs(h))},
 poly(pts){const p=new Path2D();pts.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.closePath();const xs=pts.map(a=>a[0]),ys=pts.map(a=>a[1]);
   const x0=Math.min(...xs),y0=Math.min(...ys);return _bb(p,x0,y0,Math.max(...xs)-x0,Math.max(...ys)-y0)},
 blob(x,y,r,seed=1,wob=.18,n=9){const R=rng(seed*7919+3),pts=[];for(let i=0;i<n;i++){const a=i/n*6.2832,k=1+(R()-.5)*2*wob;pts.push([x+Math.cos(a)*r*k,y+Math.sin(a)*r*k])}
   const p=new Path2D(),m=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];let s=m(pts[n-1],pts[0]);p.moveTo(s[0],s[1]);
   for(let i=0;i<n;i++){const c=pts[i],e=m(c,pts[(i+1)%n]);p.quadraticCurveTo(c[0],c[1],e[0],e[1])}p.closePath();return _bb(p,x-r*(1+wob),y-r*(1+wob),2*r*(1+wob),2*r*(1+wob))},
 star(x,y,r1,r2,n=5,rot=-Math.PI/2){const pts=[];for(let i=0;i<n*2;i++){const r=i%2?r2:r1,a=rot+i*Math.PI/n;pts.push([x+Math.cos(a)*r,y+Math.sin(a)*r])}return P.poly(pts)},
 tri(x,y,w,h){return P.poly([[x,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2]])},
 cloud(x,y,w){const p=new Path2D(),h=w*.42,b=[[-.32,.08,.26],[0,-.12,.34],[.3,.04,.27],[.12,.14,.24],[-.14,.14,.24]];
   const pts=[];for(let i=0;i<=40;i++){const a=i/40*6.2832;let best=0;for(const [cx,cy,r] of b){const dx=Math.cos(a),dy=Math.sin(a),bx=cx*w,by=cy*w,R=r*w;
     const pr=bx*dx+by*dy,disc=pr*pr-(bx*bx+by*by-R*R);if(disc>=0)best=Math.max(best,pr+Math.sqrt(disc))}pts.push([x+Math.cos(a)*best,y+Math.sin(a)*Math.min(best,h)])}
   pts.forEach(([a,c],i)=>i?p.lineTo(a,c):p.moveTo(a,c));p.closePath();return _bb(p,x-w*.6,y-w*.5,w*1.2,w*.9)},
 hill(x0,x1,top,bottom=H){const p=new Path2D(),w=x1-x0,yb=bottom+(bottom-top)*.35;p.moveTo(x0,yb);
   p.bezierCurveTo(x0+w*.12,top-(bottom-top)*.32,x1-w*.12,top-(bottom-top)*.32,x1,yb);p.closePath();return _bb(p,x0,top,w,bottom-top)},
};
const _TX={};
function txc(name,fn,s=256){if(!_TX[name]){const c=document.createElement('canvas');c.width=c.height=s;fn(c.getContext('2d'),s,rng(name.length*977+13));_TX[name]=c}return _TX[name]}
const TXF={
 felt:(g,s,r)=>{g.fillStyle='#fff';g.fillRect(0,0,s,s);g.lineWidth=1;for(let i=0;i<2400;i++){const x=r()*s,y=r()*s,a=r()*6.28,l=3+r()*9,v=140+r()*115|0;
   g.strokeStyle=`rgba(${v},${v},${v},.6)`;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke()}},
 fibre:(g,s,r)=>{g.fillStyle='#fff';g.fillRect(0,0,s,s);g.lineWidth=1;g.strokeStyle='rgba(120,95,60,.22)';for(let i=0;i<260;i++){const x=r()*s,y=r()*s,a=r()*6.28,l=5+r()*16;
   g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+Math.cos(a+.7)*l*.5,y+Math.sin(a+.7)*l*.5,x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke()}
   g.fillStyle='rgba(90,70,40,.18)';for(let i=0;i<300;i++)g.fillRect(r()*s,r()*s,1+r(),1+r())},
 noise:(g,s,r)=>{const d=g.createImageData(s,s);for(let i=0;i<d.data.length;i+=4){const v=170+r()*85;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255}g.putImageData(d,0,0)},
 dots:(g,s,r)=>{g.clearRect(0,0,s,s);g.fillStyle='#000';for(let y=0;y<s;y+=8)for(let x=0;x<s;x+=8){g.beginPath();g.arc(x+(y/8%2)*4,y+4,2.1,0,6.283);g.fill()}},
 speck:(g,s,r)=>{g.clearRect(0,0,s,s);g.fillStyle=M.c('navy');for(let i=0;i<1600;i++){g.globalAlpha=.3+r()*.7;g.fillRect(r()*s,r()*s,1+r()*2.5,1+r()*1.5)}},
 hatch:(g,s,r)=>{g.clearRect(0,0,s,s);g.strokeStyle='#000';g.lineWidth=2;for(let k=-s;k<s*2;k+=9){g.beginPath();g.moveTo(k+r()*2,0);g.lineTo(k-s*.6+r()*2,s);g.stroke()}},
};
const _PT={};
function pat(ctx,name){if(!_PT[name])_PT[name]=ctx.createPattern(txc(name,TXF[name]),'repeat');return _PT[name]}
function texture(ctx,path,name,alpha,op='multiply'){ctx.save();ctx.globalCompositeOperation=op;ctx.globalAlpha*=alpha;ctx.fillStyle=pat(ctx,name);ctx.fill(path);ctx.restore()}
function inset(ctx,path,d,fn){const b=path.bb;if(!b||b.w<d*4||b.h<d*4)return;const cx=b.x+b.w/2,cy=b.y+b.h/2,sx=(b.w-2*d)/b.w,sy=(b.h-2*d)/b.h;
  ctx.save();ctx.translate(cx,cy);ctx.scale(sx,sy);ctx.translate(-cx,-cy);fn((sx+sy)/2);ctx.restore()}
function drop(ctx,p,dx,dy,a,soft){ctx.save();ctx.fillStyle=`rgba(35,18,8,${a*.55})`;ctx.translate(dx*.6,dy*.6);ctx.fill(p);ctx.fillStyle=`rgba(35,18,8,${a*.45})`;
  ctx.translate(dx*.6,dy*.6);ctx.fill(p);if(soft){ctx.fillStyle=`rgba(35,18,8,${a*.2})`;ctx.translate(dx*.5,dy*.5);ctx.fill(p)}ctx.restore()}
function strokePts(ctx,pts){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y))}
// الخامة الأساسية (فلات)، وكل أسلوب يغيّر ما تحتاجه
const M={
 c(k){return (ST.pal&&ST.pal[k])||k},
 bg(ctx,top='sky',bottom='sky2'){const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,M.c(top));g.addColorStop(1,M.c(bottom||top));ctx.fillStyle=g;ctx.fillRect(-W,-H,W*3,H*3)},
 fill(ctx,p,col,o={}){ctx.fillStyle=M.c(col);ctx.fill(p);if(o.outline){ctx.strokeStyle=M.c(o.outline);ctx.lineWidth=3*u;ctx.stroke(p)}},
 line(ctx,pts,col='ink',w=6){ctx.save();ctx.strokeStyle=M.c(col);ctx.lineWidth=w*u;ctx.lineCap=ctx.lineJoin='round';strokePts(ctx,pts);ctx.stroke();ctx.restore()},
 eye(ctx,x,y,r,o={}){const b=clamp(o.blink||0),lk=o.look||[0,0];ctx.save();ctx.translate(x,y);ctx.scale(1,Math.max(.08,1-b));
   ctx.fillStyle='#1d1b2b';ctx.beginPath();ctx.arc(lk[0]*r*.25,lk[1]*r*.25,r,0,6.283);ctx.fill();
   ctx.fillStyle='rgba(255,255,255,.95)';ctx.beginPath();ctx.arc(lk[0]*r*.25-r*.32,lk[1]*r*.25-r*.35,r*.3,0,6.283);ctx.fill();ctx.restore()},
 txt(ctx,str,x,y,size=60,col='ink'){text(ctx,String(str),x,y,{size:size*u,font:ST.cap.font,weight:800,color:M.c(col)})},
};
"""

# الخامة لكل ستايل (بتتكتب فوق الأساسية)
IMPL = {
    "felt": r"""Object.assign(M,{
 bg(ctx,top='sky',bottom='sky2'){const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,M.c(top));g.addColorStop(1,M.c(bottom||top));ctx.fillStyle=g;ctx.fillRect(-W,-H,W*3,H*3);
   ctx.save();ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.45;ctx.fillStyle=pat(ctx,'felt');ctx.fillRect(-W,-H,W*3,H*3);ctx.restore()},
 fill(ctx,p,col,o={}){const c=M.c(col),s=o.depth??1;drop(ctx,p,0,5*u*s,.32);ctx.fillStyle=c;ctx.fill(p);
   texture(ctx,p,'felt',.55);ctx.save();ctx.strokeStyle=pat(ctx,'felt');ctx.globalAlpha=.35;ctx.lineWidth=4*u;ctx.stroke(p);ctx.restore();
   if(o.stitch!==false)inset(ctx,p,10*u,(k)=>{ctx.strokeStyle='rgba(255,248,230,.85)';ctx.lineWidth=2.4*u/k;ctx.setLineDash([7*u/k,5*u/k]);ctx.stroke(p)})},
 line(ctx,pts,col='ink',w=6){ctx.save();ctx.lineCap=ctx.lineJoin='round';strokePts(ctx,pts);ctx.translate(0,3*u);ctx.strokeStyle='rgba(45,25,10,.25)';ctx.lineWidth=w*u;ctx.stroke();ctx.translate(0,-3*u);
   ctx.strokeStyle=M.c(col);ctx.stroke();ctx.restore()},
})""",
    "paper": r"""Object.assign(M,{
 bg(ctx,top='sky',bottom='sky2'){ctx.fillStyle=M.c(bottom||top);ctx.fillRect(-W,-H,W*3,H*3);const p=new Path2D();p.rect(-W,-H,W*3,H*2.2);ctx.fillStyle=M.c(top);ctx.fill(p);
   ctx.save();ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.6;ctx.fillStyle=pat(ctx,'fibre');ctx.fillRect(-W,-H,W*3,H*3);ctx.restore()},
 fill(ctx,p,col,o={}){const c=M.c(col),s=o.depth??1;drop(ctx,p,4*u*s,7*u*s,.3);ctx.fillStyle=c;ctx.fill(p);texture(ctx,p,'fibre',.7);ctx.save();ctx.strokeStyle=lite(c,.25);ctx.globalAlpha=.6;ctx.lineWidth=1.5*u;ctx.stroke(p);ctx.restore()},
 line(ctx,pts,col='ink',w=6){ctx.save();ctx.lineCap='butt';ctx.lineJoin='miter';ctx.lineWidth=w*u;strokePts(ctx,pts);ctx.translate(3*u,4*u);ctx.strokeStyle='rgba(30,20,10,.25)';ctx.stroke();
   ctx.translate(-3*u,-4*u);ctx.strokeStyle=M.c(col);ctx.stroke();ctx.restore()},
})""",
    "crayon": r"""Object.assign(M,{
 bg(ctx,top='sky',bottom='sky2'){ctx.fillStyle='#fffdf5';ctx.fillRect(-W,-H,W*3,H*3);const p=new Path2D();p.rect(-W,-H,W*3,H*3);M.fill(ctx,_bb(p,0,0,W,H),top,{soft:true});
   if(bottom&&bottom!==top){const q=new Path2D();q.rect(-W,H*.55,W*3,H*2);M.fill(ctx,_bb(q,0,H*.55,W,H*.45),bottom,{soft:true})}},
 fill(ctx,p,col,o={}){const c=M.c(col),b=p.bb||{x:0,y:0,w:W,h:H};ctx.save();ctx.fillStyle=c;ctx.globalAlpha*=o.soft?.7:.42;ctx.fill(p);ctx.restore();
   ctx.save();ctx.clip(p);const R=rng(Math.round(b.x*7+b.y*13+b.w)+Math.floor(T*8)),gap=Math.max(5*u,(b.w+b.h)/150);ctx.strokeStyle=o.soft?lite(c,.25):c;ctx.lineWidth=3.2*u;ctx.globalAlpha*=o.soft?.35:.85;ctx.beginPath();
   for(let k=-b.h;k<b.w;k+=gap){const j=(R()-.5)*gap*.8;ctx.moveTo(b.x+k+j,b.y+b.h+2);ctx.lineTo(b.x+k+b.h*.55+j,b.y-2)}ctx.stroke();ctx.restore();
   texture(ctx,p,'noise',.35);if(!o.soft){ctx.save();ctx.strokeStyle=dark(c,.35);ctx.lineWidth=3.5*u;ctx.setLineDash([14*u,3*u,5*u,2*u]);ctx.stroke(p);ctx.restore()}},
 line(ctx,pts,col='ink',w=6){ctx.save();ctx.lineCap='round';ctx.strokeStyle=M.c(col);const s=Math.floor(T*8);for(let k=0;k<3;k++){ctx.lineWidth=w*u*(.55+k*.2);ctx.globalAlpha=.55;
   strokePts(ctx,pts.map(([x,y],i)=>[x+noise2(i+k*9,s)*3*u,y+noise2(s,i+k*5)*3*u]));ctx.stroke()}ctx.restore()},
})""",
    "watercolor": r"""Object.assign(M,{
 bg(ctx,top='sky',bottom='sky2'){ctx.fillStyle='#fbf8f1';ctx.fillRect(-W,-H,W*3,H*3);const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,lite(top,.25));g.addColorStop(1,lite(bottom||top,.35));
   ctx.save();ctx.globalAlpha=.85;ctx.fillStyle=g;ctx.fillRect(-W,-H,W*3,H*3);ctx.restore();ctx.save();ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.5;ctx.fillStyle=pat(ctx,'noise');ctx.fillRect(-W,-H,W*3,H*3);ctx.restore()},
 fill(ctx,p,col,o={}){const c=M.c(col),b=p.bb||{x:0,y:0,w:W,h:H};ctx.save();ctx.fillStyle=c;ctx.globalAlpha*=.82;ctx.fill(p);ctx.globalCompositeOperation='multiply';ctx.translate(2.5*u,1.5*u);ctx.globalAlpha*=.35;ctx.fill(p);ctx.restore();
   ctx.save();ctx.clip(p);const g=ctx.createRadialGradient(b.x+b.w*.4,b.y+b.h*.35,0,b.x+b.w*.4,b.y+b.h*.35,Math.max(b.w,b.h)*.7);g.addColorStop(0,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');
   ctx.fillStyle=g;ctx.fillRect(b.x,b.y,b.w,b.h);ctx.restore();ctx.save();ctx.globalCompositeOperation='multiply';ctx.strokeStyle=dark(c,.15);ctx.globalAlpha*=.45;ctx.lineWidth=2.5*u;ctx.stroke(p);ctx.restore();
   texture(ctx,p,'noise',.25)},
 line(ctx,pts,col='ink',w=6){ctx.save();ctx.globalCompositeOperation='multiply';ctx.lineCap=ctx.lineJoin='round';ctx.strokeStyle=M.c(col);ctx.globalAlpha=.55;ctx.lineWidth=w*u;strokePts(ctx,pts);ctx.stroke();
   ctx.globalAlpha=.3;ctx.lineWidth=w*u*1.5;ctx.stroke();ctx.restore()},
})""",
    "clay": r"""Object.assign(M,{
 bg(ctx,top='sky',bottom='sky2'){const g=ctx.createRadialGradient(W/2,H*.35,0,W/2,H*.35,Math.max(W,H)*.85);g.addColorStop(0,lite(top,.2));g.addColorStop(1,dark(bottom||top,.12));ctx.fillStyle=g;ctx.fillRect(-W,-H,W*3,H*3)},
 fill(ctx,p,col,o={}){const c=M.c(col),b=p.bb||{x:0,y:0,w:W,h:H},s=o.depth??1;drop(ctx,p,0,10*u*s,.3,true);ctx.fillStyle=c;ctx.fill(p);
   ctx.save();ctx.clip(p);const R=Math.max(b.w,b.h),g=ctx.createRadialGradient(b.x+b.w*.35,b.y+b.h*.3,R*.05,b.x+b.w*.5,b.y+b.h*.5,R*.75);
   g.addColorStop(0,lite(c,.35));g.addColorStop(.55,c);g.addColorStop(1,dark(c,.3));ctx.fillStyle=g;ctx.fillRect(b.x,b.y,b.w,b.h);
   ctx.fillStyle='rgba(255,255,255,.45)';ctx.beginPath();ctx.ellipse(b.x+b.w*.32,b.y+b.h*.24,b.w*.12,b.h*.06,-.5,0,6.283);ctx.fill();ctx.restore();texture(ctx,p,'noise',.18)},
 line(ctx,pts,col='ink',w=6){ctx.save();ctx.lineCap=ctx.lineJoin='round';strokePts(ctx,pts);ctx.translate(0,5*u);ctx.strokeStyle='rgba(20,10,30,.22)';ctx.lineWidth=w*u*1.4;ctx.stroke();ctx.translate(0,-5*u);
   ctx.strokeStyle=dark(col,.2);ctx.lineWidth=w*u*1.25;ctx.stroke();ctx.strokeStyle=M.c(col);ctx.lineWidth=w*u;ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=w*u*.3;
   ctx.translate(-w*u*.15,-w*u*.2);ctx.stroke();ctx.restore()},
})""",
    "flat": r"""Object.assign(M,{
 fill(ctx,p,col,o={}){const c=M.c(col),b=p.bb;ctx.fillStyle=c;ctx.fill(p);if(b&&b.h>30*u){ctx.save();ctx.clip(p);ctx.fillStyle='rgba(0,0,0,.08)';ctx.fillRect(b.x,b.y+b.h*.62,b.w,b.h*.4);ctx.restore()}
   if(o.outline){ctx.strokeStyle=M.c(o.outline);ctx.lineWidth=3*u;ctx.stroke(p)}},
})""",
    "ink": r"""Object.assign(M,{
 bg(ctx,top='sky',bottom='sky2'){paper(ctx,'#f4efe1',5);const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,M.c(top));g.addColorStop(1,M.c(bottom||top));
   ctx.save();ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.4;ctx.fillStyle=g;ctx.fillRect(-W,-H,W*3,H*3);ctx.restore()},
 fill(ctx,p,col,o={}){const c=M.c(col),b=p.bb||{x:0,y:0,w:W,h:H},s=Math.floor(T*12);ctx.save();ctx.fillStyle=c;ctx.globalAlpha*=.9;ctx.fill(p);ctx.restore();texture(ctx,p,'fibre',.5);
   if(b.w<W*.6){ctx.save();ctx.clip(p);ctx.beginPath();ctx.rect(b.x+b.w*.55,b.y,b.w*.5,b.h);ctx.clip();ctx.globalAlpha*=.4;ctx.fillStyle=pat(ctx,'hatch');ctx.fillRect(b.x,b.y,b.w,b.h);ctx.restore();}
   ctx.save();ctx.translate(noise2(s,.3)*1.4*u,noise2(.7,s)*1.4*u);ctx.strokeStyle=M.c('ink');ctx.lineWidth=3.2*u;ctx.lineJoin='round';ctx.stroke(p);ctx.restore()},
 line(ctx,pts,col='ink',w=6){inkLine(ctx,pts,{w:w*u*1.3,color:M.c(col),t:T,taper:true,boil:1.2*u})},
})""",
    "chalk": r"""Object.assign(M,{
 bg(ctx,top,bottom){ctx.fillStyle='#253a30';ctx.fillRect(-W,-H,W*3,H*3);const R=rng(41);for(let i=0;i<14;i++){const x=R()*W,y=R()*H,r=(.15+R()*.3)*Math.max(W,H),g=ctx.createRadialGradient(x,y,0,x,y,r);
   g.addColorStop(0,'rgba(255,255,255,.05)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
   if(top&&top!=='sky'&&top!=='navy'){ctx.save();ctx.globalAlpha=.18;ctx.fillStyle=M.c(top);ctx.fillRect(0,0,W,H);ctx.restore()}},
 fill(ctx,p,col,o={}){const c=M.c(col);ctx.save();ctx.fillStyle=c;ctx.globalAlpha*=.62;ctx.fill(p);ctx.restore();texture(ctx,p,'speck',.85,'source-over');
   ctx.save();ctx.strokeStyle=c;ctx.lineWidth=4*u;ctx.setLineDash([9*u,2.5*u,3*u,2*u]);ctx.globalAlpha*=.95;ctx.stroke(p);ctx.restore()},
 line(ctx,pts,col='ink',w=6){ctx.save();ctx.lineCap='round';ctx.strokeStyle=M.c(col);ctx.lineWidth=w*u;ctx.setLineDash([10*u,2*u,4*u,2*u]);ctx.globalAlpha=.9;strokePts(ctx,pts);ctx.stroke();ctx.restore()},
 eye(ctx,x,y,r,o={}){const b=clamp(o.blink||0);ctx.save();ctx.translate(x,y);ctx.scale(1,Math.max(.08,1-b));ctx.fillStyle='#f3f3ea';ctx.beginPath();ctx.arc(0,0,r,0,6.283);ctx.fill();
   ctx.fillStyle='#253a30';ctx.beginPath();ctx.arc(0,r*.15,r*.55,0,6.283);ctx.fill();ctx.restore()},
})""",
    "riso": r"""Object.assign(M,{
 bg(ctx,top='sky',bottom='sky2'){ctx.fillStyle='#f6efe1';ctx.fillRect(-W,-H,W*3,H*3);ctx.save();ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.55;
   const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,M.c(top));g.addColorStop(1,M.c(bottom||top));ctx.fillStyle=g;ctx.fillRect(-W,-H,W*3,H*3);ctx.restore()},
 fill(ctx,p,col,o={}){const c=M.c(col);ctx.save();ctx.globalCompositeOperation='multiply';ctx.translate(4*u,3*u);ctx.fillStyle=M.c('pink');ctx.globalAlpha*=.22;ctx.fill(p);ctx.restore();
   ctx.save();ctx.globalCompositeOperation='multiply';ctx.fillStyle=c;ctx.globalAlpha*=.9;ctx.fill(p);ctx.restore();
   ctx.save();ctx.clip(p);const b=p.bb||{x:0,y:0,w:W,h:H};ctx.beginPath();ctx.rect(b.x,b.y+b.h*.5,b.w,b.h*.55);ctx.clip();ctx.globalCompositeOperation='multiply';ctx.globalAlpha*=.35;
   ctx.fillStyle=pat(ctx,'dots');ctx.fillRect(b.x,b.y,b.w,b.h);ctx.restore()},
 line(ctx,pts,col='ink',w=6){ctx.save();ctx.globalCompositeOperation='multiply';ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=w*u;ctx.strokeStyle=M.c('pink');ctx.globalAlpha=.3;
   ctx.translate(3*u,2*u);strokePts(ctx,pts);ctx.stroke();ctx.translate(-3*u,-2*u);ctx.globalAlpha=.9;ctx.strokeStyle=M.c(col);ctx.stroke();ctx.restore()},
})""",
    "pixel": r"""Object.assign(M,{
 fill(ctx,p,col,o={}){ctx.fillStyle=M.c(col);ctx.fill(p);ctx.strokeStyle=M.c('navy');ctx.lineWidth=5*u;ctx.stroke(p)},
 line(ctx,pts,col='ink',w=6){ctx.save();ctx.lineCap='square';ctx.lineJoin='miter';ctx.strokeStyle=M.c(col);ctx.lineWidth=Math.max(6,w)*u;strokePts(ctx,pts);ctx.stroke();ctx.restore()},
})""",
    "neon": r"""Object.assign(M,{
 bg(ctx,top,bottom){const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#0b0820');g.addColorStop(1,'#1a1040');ctx.fillStyle=g;ctx.fillRect(-W,-H,W*3,H*3);
   ctx.save();ctx.strokeStyle='rgba(185,103,255,.12)';ctx.lineWidth=1.5*u;for(let x=0;x<W;x+=60*u){ctx.beginPath();ctx.moveTo(x,H*.62);ctx.lineTo(x+(x-W/2)*1.2,H);ctx.stroke()}ctx.restore()},
 fill(ctx,p,col,o={}){const c=M.c(col);ctx.save();ctx.fillStyle=c;ctx.globalAlpha*=.16;ctx.fill(p);ctx.restore();ctx.save();ctx.strokeStyle=c;ctx.globalAlpha*=.18;ctx.lineWidth=22*u;ctx.stroke(p);ctx.globalAlpha/=.18*1.8;ctx.lineWidth=11*u;ctx.stroke(p);ctx.globalAlpha*=1.8;
   ctx.lineWidth=4.5*u;ctx.stroke(p);ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=1.6*u;ctx.stroke(p);ctx.restore()},
 line(ctx,pts,col='ink',w=6){const c=M.c(col);ctx.save();ctx.lineCap=ctx.lineJoin='round';ctx.strokeStyle=c;strokePts(ctx,pts);ctx.globalAlpha=.18;ctx.lineWidth=w*u*4;ctx.stroke();ctx.globalAlpha=.35;ctx.lineWidth=w*u*2;ctx.stroke();
   ctx.globalAlpha=1;ctx.lineWidth=w*u;ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=w*u*.3;ctx.stroke();ctx.restore()},
 eye(ctx,x,y,r,o={}){const b=clamp(o.blink||0);ctx.save();ctx.translate(x,y);ctx.scale(1,Math.max(.08,1-b));ctx.fillStyle='rgba(255,255,255,.25)';ctx.beginPath();ctx.arc(0,0,r*1.2,0,6.283);ctx.fill();ctx.fillStyle='#ffffff';
   ctx.beginPath();ctx.arc(0,0,r*.7,0,6.283);ctx.fill();ctx.restore()},
})""",
    "comic": r"""Object.assign(M,{
 fill(ctx,p,col,o={}){const c=M.c(col),s=o.depth??1;ctx.save();ctx.translate(7*u*s,7*u*s);ctx.fillStyle='rgba(0,0,0,.85)';ctx.fill(p);ctx.restore();ctx.fillStyle=c;ctx.fill(p);
   const b=p.bb||{x:0,y:0,w:W,h:H};if(b.w<W*.6){ctx.save();ctx.clip(p);ctx.beginPath();ctx.rect(b.x+b.w*.45,b.y+b.h*.4,b.w,b.h);ctx.clip();ctx.globalCompositeOperation='multiply';ctx.globalAlpha*=.3;
   ctx.fillStyle=pat(ctx,'dots');ctx.fillRect(b.x,b.y,b.w,b.h);ctx.restore()}ctx.strokeStyle='#000';ctx.lineWidth=6*u;ctx.lineJoin='round';ctx.stroke(p)},
 line(ctx,pts,col='ink',w=6){ctx.save();ctx.lineCap=ctx.lineJoin='round';ctx.strokeStyle='#000';ctx.lineWidth=(w+6)*u;strokePts(ctx,pts);ctx.stroke();ctx.strokeStyle=M.c(col);ctx.lineWidth=w*u;ctx.stroke();ctx.restore()},
})""",
    "storybook": r"""Object.assign(M,{
 bg(ctx,top='sky',bottom='sky2'){paper(ctx,'#f3e9d2',8);const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,M.c(top));g.addColorStop(1,M.c(bottom||top));
   ctx.save();ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.75;ctx.fillStyle=g;ctx.fillRect(-W,-H,W*3,H*3);ctx.restore()},
 fill(ctx,p,col,o={}){const c=M.c(col),b=p.bb||{x:0,y:0,w:W,h:H};ctx.fillStyle=c;ctx.fill(p);
   ctx.save();ctx.clip(p);const g=ctx.createLinearGradient(0,b.y,0,b.y+b.h);g.addColorStop(0,'rgba(255,250,235,.28)');g.addColorStop(.6,'rgba(255,250,235,0)');g.addColorStop(1,'rgba(60,40,20,.18)');
   ctx.fillStyle=g;ctx.fillRect(b.x,b.y,b.w,b.h);ctx.restore();texture(ctx,p,'fibre',.6);ctx.save();ctx.strokeStyle=dark(c,.45);ctx.globalAlpha*=.7;ctx.lineWidth=2*u;ctx.stroke(p);ctx.restore()},
 line(ctx,pts,col='ink',w=6){inkLine(ctx,pts,{w:w*u,color:M.c(col),t:T,taper:true,boil:.6*u})},
})""",
}

# المشهد الكامل: الكاميرا، الهزّة، الانتقال، الكلام كلمة كلمة، والنهاية الجاهزة
RUNTIME = r"""
// الخلفية تُرسم مرة واحدة لكل لونين وتتخزن (أسرع بكتير من رسمها كل فريم)
const _bgImpl=M.bg,_BG={};
M.bg=function(ctx,top='sky',bottom='sky2'){const k=top+'|'+bottom;if(!_BG[k]){const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  _bgImpl.call(M,g,top,bottom);_BG[k]=c}ctx.drawImage(_BG[k],-W*.03,-H*.03,W*1.06,H*1.06)};
const _GR=[];
function fgrain(ctx,a,t){const k=Math.floor(t*12)%3;if(!_GR[k]){const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d'),d=g.createImageData(W,H),r=rng(77+k);
  for(let i=0;i<d.data.length;i+=4){const v=r();if(v<.5){const l=r()<.5?0:255;d.data[i]=d.data[i+1]=d.data[i+2]=l;d.data[i+3]=Math.round(255*a*(.4+r()*.9))}}g.putImageData(d,0,0);_GR[k]=c}
  ctx.drawImage(_GR[k],0,0)}
let _VG=null;
function vignette(ctx,a){if(!_VG){_VG=document.createElement('canvas');_VG.width=W;_VG.height=H;const g=_VG.getContext('2d'),r=g.createRadialGradient(W/2,H/2,Math.min(W,H)*.35,W/2,H/2,Math.hypot(W,H)*.6);
  r.addColorStop(0,'rgba(0,0,0,0)');r.addColorStop(1,`rgba(20,10,5,${a})`);g.fillStyle=r;g.fillRect(0,0,W,H)}ctx.drawImage(_VG,0,0)}
const CAPBOX={
 fill(ctx,w,h){M.fill(ctx,P.rect(-w/2,-h/2,w,h,h*.28),ST.cap.box_role||'cream',{stitch:false,depth:.6})},
 none(){},
};
const _CL={};
function capLayout(ctx,i){if(_CL[i])return _CL[i];const sc=SCN[i],c=ST.cap,rtl=/[؀-ۿ]/.test(sc.words.map(x=>x.w).join(''));
  let size=Math.round(Math.min(W,H)*(W>H?.07:.066)),lines=[],maxW=W*.84,sp=0;
  for(let tries=0;tries<5;tries++){ctx.font=`800 ${size}px "${c.font}"`;sp=size*.3;lines=[[]];let lw=0;
    for(const x of sc.words){const ww=ctx.measureText(x.w).width;if(lw+ww>maxW&&lines[lines.length-1].length){lines.push([]);lw=0}lines[lines.length-1].push({...x,ww});lw+=ww+sp}
    if(lines.length<=2)break;size=Math.round(size*.86)}
  const lh=size*1.3,cy=H*(W>H?.855:.83),y0=cy-(lines.length-1)*lh/2,items=[];let bw=0;
  lines.forEach((ln,li)=>{const tot=ln.reduce((a,x)=>a+x.ww,0)+sp*(ln.length-1);bw=Math.max(bw,tot);let x=rtl?W/2+tot/2:W/2-tot/2;
    ln.forEach(o=>{items.push({...o,cx:rtl?x-o.ww/2:x+o.ww/2,cy:y0+li*lh});x+=rtl?-(o.ww+sp):(o.ww+sp)})});
  return _CL[i]={size,items,bw,bh:lines.length*lh,cy,rtl}}
function captions(ctx,i,t){const sc=SCN[i],c=ST.cap;if(!sc.words.length||c.off)return;const L=capLayout(ctx,i),first=sc.words[0].t;if(t<first-.12)return;
  const pb=Math.max(.001,E.outBack(clamp((t-first+.12)/.3)));
  if(c.box&&c.box!=='none'){ctx.save();ctx.translate(W/2,L.cy);ctx.scale(pb,pb);(CAPBOX[c.box]||CAPBOX.fill)(ctx,L.bw+L.size*1.1,L.bh+L.size*.45);ctx.restore()}
  for(const o of L.items){if(t<o.t-.02)continue;const p=clamp((t-o.t+.02)/.2),s=Math.max(.001,E.outBack(p));ctx.save();ctx.translate(o.cx,o.cy+(1-p)*L.size*.3);ctx.scale(s,s);
    const col=o.key?c.key:c.color;ctx.font=`800 ${L.size}px "${c.font}"`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.direction=L.rtl?'rtl':'ltr';
    if(c.stroke){ctx.lineWidth=L.size*.16;ctx.lineJoin='round';ctx.strokeStyle=c.stroke;ctx.strokeText(o.w,0,0)}
    if(c.glow){ctx.strokeStyle=col;ctx.globalAlpha*=.3;ctx.lineWidth=L.size*.22;ctx.lineJoin='round';ctx.strokeText(o.w,0,0);ctx.globalAlpha/=.3}ctx.fillStyle=col;ctx.fillText(o.w,0,0);ctx.restore()}}
function wrapLines(ctx,str,maxW,size,font){ctx.font=`800 ${size}px "${font}"`;const ws=String(str).split(/\s+/).filter(Boolean),out=[];let cur='';
  for(const w of ws){const n=cur?cur+' '+w:w;if(ctx.measureText(n).width>maxW&&cur){out.push(cur);cur=w}else cur=n}if(cur)out.push(cur);return out}
function END_SCENE(ctx,t,d,W,H,sc){M.bg(ctx,'sky2','cream');const cx=W/2,font=ST.cap.font;
  if(sc.end==='card'){const cw=Math.min(W*.66,H*1.0),ch=Math.min(H*.42,cw*.55),p=E.outBack(clamp(t/.8)),y=lerp(-ch,H*.44,p),rot=Math.sin(t*2.4)*.04*Math.exp(-t*.8);
    for(const sx of [-.32,.32])M.line(ctx,[[cx+cw*sx,-20],[cx+cw*sx+Math.sin(rot)*ch*.3,y-ch/2+6*u]],'ink',3);
    ctx.save();ctx.translate(cx,y);ctx.rotate(rot);M.fill(ctx,P.rect(-cw/2,-ch/2,cw,ch,ch*.08),'card');
    const size=Math.round(Math.min(W,H)*.06),ls=wrapLines(ctx,END.card||sc.txt,cw*.82,size,font);ls.forEach((l,k)=>text(ctx,l,0,(k-(ls.length-1)/2)*size*1.3,{size,font,color:M.c('ink')}));ctx.restore()}
  else{const kw=String(END.keyword||'').trim(),rtl=/[؀-ۿ]/.test(kw),tiles=kw?(rtl?kw.split(/\s+/):[...kw.toUpperCase()].filter(c=>c.trim())):[];
    const n=tiles.length,size=Math.round(Math.min(W,H)*(n>6?.08:.11)),gap=size*.25;ctx.font=`800 ${size}px "${font}"`;
    const ws=tiles.map(x=>Math.max(size*1.1,ctx.measureText(x).width+size*.6)),tot=ws.reduce((a,b)=>a+b,0)+gap*Math.max(0,n-1);let x=cx-tot/2;const roles=['coral','teal','sun','purple','grass','orange','pink'];
    const order=rtl?[...tiles.keys()].reverse():[...tiles.keys()];const xs=[];for(const k of order){xs[k]=x+ws[k]/2;x+=ws[k]+gap}
    tiles.forEach((ch,k)=>{const t0=.15+k*.3,p=E.outBack(clamp((t-t0)/.55));if(p<=0)return;const yy=lerp(-size*2,H*.4,p),rot=Math.sin((t-t0)*3+k)*.06*Math.exp(-(t-t0));
      M.line(ctx,[[xs[k],-20],[xs[k],yy-size*.7]],'ink',2.5);ctx.save();ctx.translate(xs[k],yy);ctx.rotate(rot);M.fill(ctx,P.rect(-ws[k]/2,-size*.7,ws[k],size*1.4,size*.2),roles[k%roles.length]);
      text(ctx,ch,0,size*.05,{size,font,color:M.c('white')});ctx.restore()});
    const ts=.25+n*.3,ps=E.out(clamp((t-ts)/.6));if(ps>0&&(END.line||sc.txt)){const size2=Math.round(Math.min(W,H)*.052),ls=wrapLines(ctx,END.line||sc.txt,W*.8,size2,font);
      const bh=ls.length*size2*1.35+size2*.8,yy=lerp(H+bh,n?H*.72:H*.5,ps);ctx.save();ctx.translate(cx,yy);M.fill(ctx,P.rect(-W*.44,-bh/2,W*.88,bh,size2*.4),'card',{depth:.7});
      ls.forEach((l,k)=>text(ctx,l,0,(k-(ls.length-1)/2)*size2*1.35,{size:size2,font,color:M.c('ink')}));ctx.restore()}}}
const WIPE={
 scallop(ctx,p){const x0=W*1.12-p*W*1.3,R=H/14,q=new Path2D();q.moveTo(W+20,-20);q.lineTo(x0,-20);for(let y=0;y<H+2*R;y+=2*R)q.arc(x0,y+R,R,-Math.PI/2,Math.PI/2,true);
   q.lineTo(W+20,H+20);q.closePath();ctx.clip(q)},
 iris(ctx,p){const q=new Path2D();q.arc(W/2,H/2,Math.max(.1,p*Math.hypot(W,H)*.6),0,6.283);ctx.clip(q)},
 slide(ctx,p){ctx.translate(-(1-p)*W,0)},
 dissolve(ctx,p){ctx.globalAlpha=p},
 page(ctx,p){const k=p*(W+H)*1.05,q=new Path2D();q.moveTo(W,H);q.lineTo(W-k,H);q.lineTo(W,H-k);q.closePath();q.moveTo(W+20,H+20);ctx.clip(q)},
};
function sceneAt(t){let i=0;for(let k=0;k<SCN.length;k++)if(t>=SCN[k].s)i=k;return i}
function drawScene(ctx,i,t){const sc=SCN[i],lt=Math.max(0,t-sc.s),d=Math.max(.1,sc.e-sc.s);ctx.save();
  let sx=0,sy=0;if(sc.big&&lt<.9){const a=(1-lt/.9)*W*.012;sx=Math.sin(lt*71)*a;sy=Math.cos(lt*53)*a}
  const z=1+.06*E.inOut(clamp(lt/d));ctx.translate(W/2+sx,H/2+sy);ctx.scale(z,z);ctx.translate(-W/2,-H/2);
  const wf=n=>{const x=sc.words[n];return x?Math.max(0,x.t-sc.s):d};
  try{if(sc.end)END_SCENE(ctx,lt,d,W,H,sc);else if(SC[i])SC[i](ctx,lt,d,W,H,wf);else M.bg(ctx,'sky','sky2')}
  catch(e){throw new Error('scene '+(i+1)+': '+(e&&e.message||e))}finally{ctx.restore()}
  if(!sc.end)captions(ctx,i,t)}
function POST(ctx,t){const p=ST.post||{};if(p.pixel)pixelate(ctx,p.pixel);if(p.vignette)vignette(ctx,p.vignette);if(p.grain)fgrain(ctx,p.grain,t)}
let _px=null;function pixelate(ctx,cols){const w=cols,h=Math.round(cols*H/W);if(!_px){_px=document.createElement('canvas');_px.width=w;_px.height=h}const g=_px.getContext('2d');
  g.imageSmoothingEnabled=true;g.clearRect(0,0,w,h);g.drawImage(ctx.canvas,0,0,w,h);ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(_px,0,0,W,H);ctx.restore()}
function scene(ctx,t){T=t;const i=sceneAt(t),sc=SCN[i],into=t-sc.s;
  if(i>0&&into<TD){const tr=sc.end?'dissolve':(sc.trans||ST.trans),p=E.inOut(clamp(into/TD));drawScene(ctx,i-1,t);ctx.save();(WIPE[tr]||WIPE.dissolve)(ctx,p);drawScene(ctx,i,t);ctx.restore()}
  else drawScene(ctx,i,t);POST(ctx,t)}
"""


def runtime_code(style: str, scn: list[dict], end: dict, cast_code: str, bodies: dict[int, str]) -> str:
    """الكود الكامل الذي يُرسم: الأسلوب + الأدوات + الشخصيات + المشاهد + المحرّك."""
    st = STYLES.get(style) or STYLES[DEFAULT_STYLE]
    cfg = {"key": style, "pal": st["pal"], "cap": st["cap"], "trans": st["trans"], "post": st["post"]}
    scenes = "\n".join(f"SC[{i}]=function(ctx,t,d,W,H,w){{\n{bodies[i]}\n}};" for i in sorted(bodies))
    return (f"const ST={json.dumps(cfg, ensure_ascii=False)};\nconst SCN={json.dumps(scn, ensure_ascii=False)};\n"
            f"const END={json.dumps(end, ensure_ascii=False)};\nconst TD={TD};\n{KIT}\n{IMPL.get(style, '')};\n"
            f"// ---- الشخصيات\n{cast_code}\n;const SC=[];\n{scenes}\n{RUNTIME}")


# ---------------------------------------------------------------- القصة
API_DOC = """DRAWING KIT (style-independent: the SAME code is rendered in many art styles — felt, cut paper, crayon, watercolour, clay, chalk, neon…
so never draw textures, shadows, outlines or filters yourself; the kit adds the material):
- Shapes (return a Path2D in pixel coords): P.circle(x,y,r) · P.ellipse(x,y,rx,ry,rot) · P.rect(x,y,w,h,radius) · P.poly([[x,y],...]) ·
  P.blob(x,y,r,seed,wobble=.18) organic shape · P.star(x,y,r1,r2,n=5) · P.tri(x,y,w,h) · P.cloud(x,y,width) · P.hill(x0,x1,yTop,yBottom=H)
- Material: M.bg(ctx, topRole, bottomRole) full background (call first) · M.fill(ctx, path, role, {depth:1, stitch:true}) ·
  M.line(ctx, [[x,y],...], role, width) for strings, whiskers, smiles, motion lines · M.eye(ctx, x, y, r, {blink:0..1, look:[dx,dy]}) bead eye ·
  M.txt(ctx, str, x, y, size, role) only for signs/labels (the narration is captioned automatically)
- Colour roles (each style has its own palette for them; use roles, not hex): sky sky2 sun coral teal grass navy cream ink card pink purple orange brown white skin.
  mix(roleA, roleB, k), lite(role, k), dark(role, k) return a colour you can pass to M.fill.
- Helpers: u = min(W,H)/1080 (size unit, ALWAYS scale sizes by u) · clamp lerp prog(t,a,b) · E.out E.inOut E.outBack E.outElastic E.bounce · rng(seed) (no Math.random) · noise2(x,y)
- Motion: ctx.save()/translate/rotate/scale/restore around shape groups for squash & stretch, bounce, wobble, swing."""

SCENE_RULES = """SCENE RULES:
- A scene is the BODY of function(ctx, t, d, W, H, w): t = seconds since the scene started (0..d), d = scene length,
  w(n) = second (from scene start) when word n (0-based) of this scene's narration is spoken. Time actions to the words with w(n).
- Pure function of t: no state between frames, no Math.random/Date. Draw the whole frame: start with M.bg(...).
- Keep the bottom 24% of the frame free of faces and key action (the spoken words pop in there). Ground/grass there is fine.
- Constant motion: something always moves. Characters breathe/bob (sin), blink now and then, secondary motion (tail, ears).
  Entrances pop with E.outBack from scale 0.001 (never exactly 0). Events get particles (puffs, stars, confetti, dust) from rng(fixed seed).
- The kit already adds a slow camera push, a screen shake on the big moment, scene transitions and the captions: don't draw fades or text for the narration.
- Use the cast functions for recurring characters so they look identical in every scene. Reuse layout ideas from earlier scenes for continuity.
- Budget per frame: under ~80 M.fill calls, no loops over thousands of items. Frame must render in < 0.2 s."""


def story_messages(i: dict, brand: str) -> list[dict]:
    n = max(6, min(22, round(i["length"] / 2.6)))
    words = round(i["length"] * 2.1)
    aud = {"kids": "a kids' story: one lovable hero, a goal, a big exciting moment and a happy ending; simple words a 5-year-old understands",
           "brand": "a short story for a brand's audience: a relatable hero with a real problem from the brand's world, the brand/product helps at the turning point (never a hard sell), warm ending",
           "general": "a short fable or story for everyone: a hero, a turn, a satisfying ending with a light lesson"}[i["audience"]]
    end = ""
    if i["ending"] == "brand":
        end = "After the story add exactly 2 closing scenes: one with \"end\": \"card\" (the brand name + a one-line promise, spoken) and one with \"end\": \"cta\" (the call to action, spoken)."
    elif i["ending"] == "custom":
        end = (f"After the story add exactly 2 closing scenes: \"end\": \"card\" with a short closing line, and \"end\": \"cta\" whose text invites people to comment the word "
               f"«{i.get('keyword') or 'حكاية'}»" + (f" and says: {i['cta_line']}" if i.get("cta_line") else "") + ".")
    sys_ = "You are a children's-book author and animation director. Return JSON only."
    if i["audience"] != "kids":   # حكاية للسوشيال: نفس قواعد الحكي اللي بتمسك المشاهد للآخر
        sys_ += "\n\n" + algo.for_use("story")
    return [{"role": "system", "content": sys_},
            {"role": "user", "content": f"""Write {aud}.
IDEA: {i['idea']}
LANGUAGE of the narration: {i.get('lang') or 'Arabic'} (write naturally in it, as a storyteller would read aloud; if Arabic dialect, write it the way it is spoken).
LENGTH: about {i['length']} seconds of narration → about {words} words total, {n}-{n + 3} scenes, each scene 1.5-3 seconds (one short phrase each, 3-8 words).
{('BRAND:' + chr(10) + brand) if brand and i['audience'] == 'brand' else ''}
Rules:
- Start like a storyteller ("كان يا ما كان" / "Once upon a time" in the chosen language). Fast, bright, many quick scenes.
- One scene per narration phrase; together the scene texts ARE the full narration, in order, nothing else is spoken.
- Every visual must be drawable from simple shapes (circles, blobs, rounded rects, stars, clouds, hills): animals, kids, rockets, houses, trees, sun, moon, planets, boxes.
  No real people, no logos, no trademarks, no famous characters.
- Mark exactly one scene as the big moment ("big": true). Pick 1-2 key words per scene to colour.
- Characters: 1-3, each with a look described as simple shapes and colour roles (sky sky2 sun coral teal grass navy cream ink card pink purple orange brown white skin).
{end}
Return JSON:
{{"title": "...", "cast": [{{"name": "ascii_id", "label": "الاسم", "look": "shapes + colour roles + parts that move"}}],
  "scenes": [{{"text": "exact spoken phrase", "visual": "what is on screen (English)", "motion": "what moves (English)", "big": false, "keys": ["word"], "trans": "scallop|iris|slide|dissolve|page", "end": null}}],
  "music": {{"mood": "playful|warm|calm|epic|tense", "bpm": 110}}}}"""}]


def mock_story(i: dict) -> dict:
    ar = not re.search(r"english|انجليز|إنجليز", i.get("lang") or "", re.I)
    lines = (["كان يا ما كان", "ثعلب صغير اسمه يبو", "يحلم يلمس القمر", "فبنى صاروخ من الكراتين", "ولزقه ولوّنه بالألوان", "ثلاثة اثنان واحد", "انطلق!",
              "عدّى السحاب والطيور", "وطلع أعلى قوس قزح", "ووصل للنجوم", "وهبط على القمر", "الأحلام معمولة لكي تطير"] if ar else
             ["Once upon a time", "a little fox named Pip", "dreamed of the moon", "so Pip built a rocket", "from boxes and paint", "three two one", "blast off!",
              "past the clouds and birds", "over the rainbow", "into the stars", "and landed on the moon", "dreams are made to fly"])
    sc = [{"text": t, "visual": "fox scene", "motion": "bounce", "big": k == 6, "keys": [t.split()[-1]], "trans": None, "end": None} for k, t in enumerate(lines)]
    if i["ending"] != "none":
        sc += [{"text": "كل ما شفته هذا أُنشئ بالكود" if ar else "Everything you saw was made in code", "visual": "", "motion": "", "big": False, "keys": [], "end": "card"},
               {"text": f"اكتب {i.get('keyword') or 'حكاية'} في التعليق" if ar else f"Comment {i.get('keyword') or 'story'}", "visual": "", "motion": "", "big": False,
                "keys": [], "end": "cta"}]
    return {"title": "الصاروخ الورقي" if ar else "The Paper Rocket", "cast": [{"name": "fox", "label": "يبو", "look": "orange blob body, cream belly, triangle ears, bushy tail"}],
            "scenes": sc, "music": {"mood": "playful", "bpm": 118}}


def clean_story(raw: dict, i: dict) -> dict:
    if not isinstance(raw, dict) or not isinstance(raw.get("scenes"), list):
        raise ValueError("القصة رجعت ناقصة")
    scenes = []
    for s in raw["scenes"][:30]:
        if not isinstance(s, dict) or not str(s.get("text") or "").strip():
            continue
        end = s.get("end") if s.get("end") in ("card", "cta") and i.get("ending") != "none" else None
        scenes.append({"text": clean_spoken(str(s["text"]))[:220], "visual": str(s.get("visual") or "")[:400], "motion": str(s.get("motion") or "")[:300],
                       "big": bool(s.get("big")), "keys": [str(k)[:30] for k in s.get("keys") or [] if str(k).strip()][:3],
                       "trans": s.get("trans") if s.get("trans") in TRANS else None, "end": end})
    if len(scenes) < 2:
        raise ValueError("القصة رجعت بدون مشاهد كفاية")
    cast = [{"name": re.sub(r"[^A-Za-z0-9_]", "", str(c.get("name") or f"c{k}"))[:24] or f"c{k}", "label": str(c.get("label") or c.get("name") or "")[:40],
             "look": str(c.get("look") or "")[:400]} for k, c in enumerate(raw.get("cast") or []) if isinstance(c, dict)][:4]
    m = raw.get("music") if isinstance(raw.get("music"), dict) else {}
    try:
        bpm = max(70, min(150, int(m.get("bpm") or 110)))
    except (TypeError, ValueError):
        bpm = 110
    return {"title": str(raw.get("title") or i["idea"][:40])[:80], "cast": cast, "scenes": scenes,
            "music": {"mood": m.get("mood") if m.get("mood") in MOODS else i.get("mood") or "playful", "bpm": bpm}}


def clean_spoken(s: str) -> str:
    """النص الذي يُقال فقط: بدون توجيهات بين أقواس."""
    return re.sub(r"\s+", " ", re.sub(r"\[[^\]]*\]|\([^)]*\)", " ", s)).strip()


def narration(story: dict) -> str:
    return " ".join(s["text"] for s in story["scenes"])


# ---------------------------------------------------------------- التوقيت: كل كلمة اتقالت إمتى
_AR_DIAC = re.compile(r"[ً-ْٰـ]")


def norm_word(w: str) -> str:
    w = _AR_DIAC.sub("", w.lower())
    w = re.sub(r"[أإآٱ]", "ا", w).replace("ة", "ه").replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    return re.sub(r"[^\w]", "", w)


def split_words(s: str) -> list[str]:
    return [w for w in re.split(r"\s+", s.strip()) if norm_word(w)]


def align(script: list[str], heard: list[dict], dur: float) -> list[float]:
    """بداية كل كلمة في القصة: من نص الراوي الذي اتسمع، واللي ماتسمعش يُحسب مما حواليه."""
    n = len(script)
    if not n:
        return []
    times: list[float | None] = [None] * n
    a, b = [norm_word(w) for w in script], [norm_word(str(x.get("w") or "")) for x in heard]
    if heard:
        for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
            for k in range(blk.size):
                times[blk.a + k] = float(heard[blk.b + k].get("s") or 0)
    known = [k for k, t in enumerate(times) if t is not None]
    if len(known) < max(2, n * .3):   # التفريغ مطلعش زي القصة: بنوزّع على طول الصوت حسب طول كل كلمة
        lens = [len(w) + 2 for w in script]
        tot = sum(lens)
        acc, out = 0.0, []
        for ln in lens:
            out.append(round(.05 + acc / tot * max(.5, dur - .3), 3))
            acc += ln
        return out
    first, last = known[0], known[-1]
    for k in range(n):
        if times[k] is not None:
            continue
        prev = max((j for j in known if j < k), default=None)
        nxt = min((j for j in known if j > k), default=None)
        if prev is None:
            times[k] = max(0.0, times[first] - (first - k) * .35)
        elif nxt is None:
            times[k] = min(dur - .1, times[last] + (k - last) * .35)
        else:
            times[k] = times[prev] + (times[nxt] - times[prev]) * (k - prev) / (nxt - prev)
    out = [round(float(t), 3) for t in times]
    for k in range(1, n):   # الترتيب لازم يفضل ماشي لقدّام
        out[k] = max(out[k], out[k - 1] + .05)
    return out


def timeline(story: dict, word_times: list[float], voice_dur: float) -> tuple[list[dict], float]:
    """المشاهد على الصوت: كل مشهد يبدأ قبل أول كلمة فيه بـ 0.15 ثانية."""
    scn, k = [], 0
    for idx, s in enumerate(story["scenes"]):
        ws = split_words(s["text"])
        keys = {norm_word(x) for x in s.get("keys") or []}
        words = [{"w": w, "t": round(LEAD + word_times[k + j], 3), "key": norm_word(w) in keys or any(norm_word(w).startswith(x) for x in keys if len(x) > 2)}
                 for j, w in enumerate(ws) if k + j < len(word_times)]
        start = 0.0 if idx == 0 else max(scn[-1]["s"] + .6, (words[0]["t"] if words else scn[-1]["s"] + 1) - .15)
        scn.append({"s": round(start, 3), "e": 0, "words": words, "big": s.get("big", False), "trans": s.get("trans"), "end": s.get("end"), "txt": s["text"]})
        k += len(ws)
    total = round(LEAD + voice_dur + TAIL + (1.2 if scn and scn[-1]["end"] == "cta" else 0), 2)
    for a, b in zip(scn, scn[1:]):
        a["e"] = b["s"]
    if scn:
        scn[-1]["e"] = total
    return scn, total


def still_times(scn: list[dict]) -> list[float]:
    """صورة من كل مشهد بعد ما معظم كلامه ظهر."""
    out = []
    for s in scn:
        d = s["e"] - s["s"]
        last = (s["words"][-1]["t"] - s["s"] + .25) if s["words"] else d * .6
        out.append(round(s["s"] + max(TD + .05, min(d - .08, max(d * .55, last))), 2))
    return out


# ---------------------------------------------------------------- الكود
def cast_messages(story: dict, w: int, h: int) -> list[dict]:
    cast = "\n".join(f"- {c['name']} ({c['label']}): {c['look']}" for c in story["cast"]) or "- (no recurring character: write one helper for the main recurring prop)"
    return [{"role": "system", "content": "You write clean, fast JavaScript canvas code for a kids' animation studio."},
            {"role": "user", "content": f"""{API_DOC}

STORY: {story['title']}
{narration(story)}

CAST (draw each one ONCE as a reusable function, so it looks identical in every scene):
{cast}

Write one function per cast member: function NAME(ctx, x, y, s, o={{}}) where (x, y) is the bottom-centre (feet) point and s is the scale
(s=1 → about 35% of the frame height at {w}x{h}; multiply every size by s*u). o = {{t, pose, look, blink, flip, mood}}:
- o.t drives idle life (breathing, blinking every ~3s, tail/ear sway), o.flip mirrors horizontally,
- o.pose: 'idle' | 'wave' | 'jump' | 'run' | 'cheer' | 'sit' (move arms/legs/body parts accordingly),
- build from separate shape groups (head, ears, body, belly, arms, legs, tail…) with save/translate/rotate/restore so parts move.
Also write small helpers for recurring props of the story if useful (same signature).
Use only P, M, mix/lite/dark, clamp/lerp/E, u. Colour roles only. No Math.random.
Return ONE ```js block with only these functions."""}]


def scenes_messages(story: dict, scn: list[dict], cast_code: str, idx: list[int], w: int, h: int) -> list[dict]:
    blocks = []
    for i in idx:
        s, sc = story["scenes"][i], scn[i]
        words = ", ".join(f"{k}:{x['w']}@{x['t'] - sc['s']:.2f}s" for k, x in enumerate(sc["words"]))
        blocks.append(f"SCENE {i + 1} (d={sc['e'] - sc['s']:.2f}s{' · BIG MOMENT' if s.get('big') else ''}): narration «{s['text']}»\n"
                      f"  words: {words}\n  on screen: {s['visual']}\n  moves: {s['motion']}")
    ctx_scenes = "\n".join(f"{k + 1}. {x['text']} — {x['visual']}" for k, x in enumerate(story["scenes"]))
    return [{"role": "system", "content": "You write clean, fast JavaScript canvas code for a kids' animation studio."},
            {"role": "user", "content": f"""{API_DOC}

{SCENE_RULES}

FRAME: {w}x{h}. Whole story for continuity:
{ctx_scenes}

CAST FUNCTIONS (already defined, call them):
```js
{cast_code[:9000]}
```

Write these scenes:
{chr(10).join(blocks)}

Return ONE ```js block. Before each scene body put a marker line exactly like: // === SCENE 3 ===
After the marker write ONLY the function body (no function header)."""}]


def fix_messages(body: str, problem: str, scene_no: int, cast_code: str) -> list[dict]:
    return [{"role": "system", "content": "You fix JavaScript canvas code. Return only code."},
            {"role": "user", "content": f"""{API_DOC}

{SCENE_RULES}

Cast functions available:
```js
{cast_code[:6000]}
```

Scene {scene_no} body has a problem: {problem}
Fix it (or apply the note) and return the corrected BODY only, in one ```js block.
```js
{body}
```"""}]


def cast_fix_messages(cast_code: str, problem: str) -> list[dict]:
    return [{"role": "system", "content": "You fix JavaScript canvas code. Return only code."},
            {"role": "user", "content": f"{API_DOC}\n\nThese cast functions fail to load: {problem}\nFix them, keep the same names and signatures, return one ```js block.\n```js\n{cast_code}\n```"}]


def parse_scenes(code: str) -> dict[int, str]:
    out: dict[int, str] = {}
    parts = re.split(r"^\s*//\s*===\s*SCENE\s+(\d+)\s*===\s*$", code, flags=re.M)
    for k in range(1, len(parts) - 1, 2):
        body = parts[k + 1].strip()
        body = re.sub(r"^function\s*\w*\s*\([^)]*\)\s*\{(.*)\}\s*;?\s*$", r"\1", body, flags=re.S).strip()
        if body:
            out[int(parts[k]) - 1] = body
    return out


MOCK_CAST = r"""function fox(ctx,x,y,s,o={}){const t=o.t||0,b=Math.sin(t*4)*4*u*s,f=o.flip?-1:1,blink=(t%3)<.12?1:0;
  ctx.save();ctx.translate(x,y);ctx.scale(f*s,s);
  ctx.save();ctx.translate(110*u,-120*u);ctx.rotate(Math.sin(t*5)*.25);M.fill(ctx,P.ellipse(60*u,-20*u,90*u,40*u,-.5),'orange');M.fill(ctx,P.circle(130*u,-60*u,26*u),'white',{stitch:false});ctx.restore();
  M.fill(ctx,P.blob(0,-150*u+b,120*u,3,.08),'orange');M.fill(ctx,P.ellipse(0,-120*u+b,60*u,70*u),'cream',{stitch:false});
  const wave=o.pose==='wave'?Math.sin(t*9)*.6-.9:0;ctx.save();ctx.translate(80*u,-180*u+b);ctx.rotate(wave);M.fill(ctx,P.rect(-14*u,0,28*u,80*u,14*u),'orange',{stitch:false});ctx.restore();
  ctx.save();ctx.translate(0,-310*u+b*1.4);M.fill(ctx,P.tri(-60*u,-80*u,60*u,90*u),'orange');M.fill(ctx,P.tri(60*u,-80*u,60*u,90*u),'orange');
  M.fill(ctx,P.blob(0,0,100*u,7,.06),'orange');M.fill(ctx,P.ellipse(0,40*u,60*u,38*u),'cream',{stitch:false});
  M.eye(ctx,-36*u,-8*u,13*u,{blink});M.eye(ctx,36*u,-8*u,13*u,{blink});M.fill(ctx,P.circle(0,32*u,11*u),'ink',{stitch:false});ctx.restore();ctx.restore()}"""


def mock_scene(i: int, story: dict) -> str:
    bgs = [("sky", "sky2"), ("sky2", "cream"), ("navy", "purple"), ("sky", "grass")]
    top, bot = bgs[i % len(bgs)]
    return f"""M.bg(ctx,'{top}','{bot}');
const R=rng({i + 1});M.fill(ctx,P.circle(W*.82,H*.2+Math.sin(t*2)*6*u,90*u*E.outBack(clamp(t/.6))+.001),'sun');
for(let k=0;k<3;k++){{const x=((R()*W+t*60*u*(k+1))%(W+400*u))-200*u;M.fill(ctx,P.cloud(x,H*(.15+k*.1),260*u),'white',{{stitch:false}})}}
M.fill(ctx,P.hill(-W*.1,W*.65,H*.6),'grass');M.fill(ctx,P.hill(W*.35,W*1.1,H*.66),'teal');
const p=E.outBack(clamp(t/.5));fox(ctx,W*(.3+.25*clamp(t/d)),H*.76-Math.abs(Math.sin(t*5))*30*u,Math.max(.001,p)*.9,{{t,pose:{'"wave"' if i % 2 else '"idle"'}}});
for(let k=0;k<12;k++){{const a=k/12*6.283,r=(t*240*u)%(300*u);M.fill(ctx,P.star(W*.65+Math.cos(a)*r,H*.4+Math.sin(a)*r,12*u,5*u),k%2?'sun':'coral',{{stitch:false}})}}"""


def sound_plan(scn: list[dict], music: dict, keyword: str = "") -> dict:
    sfx = []
    for k, s in enumerate(scn):
        if k:
            tr = s.get("trans") or ""
            sfx.append({"t": max(0, s["s"] - .05), "kind": "whoosh" if tr in ("slide", "iris", "page") else "pop"})
        if s.get("big"):
            sfx += [{"t": max(0, s["s"] - 1.1), "kind": "riser"}, {"t": s["s"] + .05, "kind": "boom"}]
        if s.get("end") == "card":
            sfx.append({"t": s["s"] + .6, "kind": "pluck"})
        if s.get("end") == "cta":
            n = len(keyword.split()) if re.search(r"[؀-ۿ]", keyword) else len([c for c in keyword if c.strip()])
            sfx += [{"t": s["s"] + .15 + j * .3 + .35, "kind": "chime"} for j in range(min(n, 12))]
    return {"music": {"mood": music.get("mood") or "playful", "bpm": music.get("bpm") or 110, "key": "D"}, "sfx": sfx[:60]}


# ---------------------------------------------------------------- معاينة الستايلات
DEMO_STORY = {"scenes": [{"text": "كان يا ما كان ثعلب صغير", "big": False, "keys": ["ثعلب"]}]}


def demo_code(style: str) -> str:
    scn = [{"s": 0, "e": 3, "words": [{"w": w, "t": .05 + j * .1, "key": w == "ثعلب"} for j, w in enumerate("كان يا ما كان ثعلب صغير".split())],
            "big": False, "trans": None, "end": None, "txt": ""}]
    return runtime_code(style, scn, {}, MOCK_CAST, {0: mock_scene(0, {})})
