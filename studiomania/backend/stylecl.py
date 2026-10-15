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
SFX_KINDS = ("whoosh", "pop", "click", "hit", "riser", "chime")
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
الخطوط المتاحة: """ + "، ".join(FONTS)


def harness(code: str, w: int, h: int, dur: float) -> str:
    """الصفحة اللي بترسم: الكود جوه، ومفيش نت (غير الخطوط من السيرفر نفسه)."""
    faces = "".join(f'@font-face{{font-family:"{fam}";src:url("https://fonts.local/{f}")}}' for fam, f in FONTS.items())
    loads = ",".join(f'document.fonts.load(\'800 40px "{fam}"\')' for fam in FONTS)
    safe = code.replace("</script", "<\\/script")
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{faces}
html,body{{margin:0;background:#000;overflow:hidden}}canvas{{display:block}}</style></head><body>
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
    text = f"""انت مخرج موشن جرافيك. معاك {n_refs} صورة مرجعية (أو فريمات من فيديو مرجعي) وفكرة.
المطلوب: افهم **الستايل** من المراجع (الألوان، الأشكال، الخطوط، الملمس، طريقة الحركة، التايبوجرافي) وطبّقه على **الفكرة دي** مش على موضوع المرجع.
الفيديو هيترسم بالكود على Canvas 2D (أشكال، خطوط، تدرجات، ملمس، كلام). مفيش صور حقيقية ولا واقعية فوتوغرافية: لو المرجع واقعي حوّله لأقرب ستايل مرسوم.

الفكرة: {idea}
المدة: {dur} ثانية · المقاس: {ratio}
{('البراند (للألوان والكلام لو مناسب):' + chr(10) + brand) if brand else ''}

اعمل فيلم صغير: هوك في أول ثانية ونص يوقف الإيد، بعدين بناء، بعدين نهاية واضحة (payoff). الكلام اللي على الشاشة قليل وقصير وبنفس لغة الفكرة.

رجّع JSON بس:
{{"title": "اسم قصير",
 "style": {{"name": "", "look": "وصف دقيق للستايل في 3-5 جمل", "palette": ["#hex", ...4-6], "background": "#hex", "line": "شكل الخط/الحدود", "texture": "الملمس (حبيبات، ورق، ...)", "motion": "إحساس الحركة والتنعيم", "type": "شكل الكلام"}},
 "beats": [{{"t0": 0, "t1": 1.5, "what": "اللي بيحصل بالظبط على الشاشة", "text": "الكلام اللي بيظهر لو فيه"}}],
 "sfx": [{{"t": 0.2, "kind": "{'|'.join(SFX_KINDS)}"}}],
 "music": {{"bpm": 100, "mood": "{'|'.join(MOODS)}", "key": "C|D|E|F|G|A|B"}}}}"""
    return [{"role": "user", "content": text}]


def code_messages(plan: dict, w: int, h: int, dur: int) -> list[dict]:
    system = ("انت مبرمج موشن جرافيك محترف بتكتب Canvas 2D بـ JavaScript. بتكتب دالة واحدة scene(ctx, t, W, H) بترسم الكادر كامل في اللحظة t (بالثواني).\n"
              "قواعد صارمة:\n"
              "- الرسم دالة في t بس: ممنوع Date و performance و Math.random و setTimeout و requestAnimationFrame و fetch و Image و أي نت. أي عشوائية من rng(seed) ثابت.\n"
              "- كل فريم بيترسم من الصفر: ابدأ بالخلفية كاملة.\n"
              "- ممنوع متغيرات بتتغير بين الفريمات (state): نفس t لازم يطلع نفس الصورة.\n"
              "- الحسابات التقيلة (نقط، أشكال) اعملها مرة برّه scene في ثوابت.\n"
              "- خلّي الكود سريع: الفريم الواحد أقل من 30ms.\n"
              "- اهتم بالتفاصيل: easing على كل حركة، overlap بين الحركات، anticipation و follow-through، ملمس، طبقات قريبة وبعيدة.\n"
              "- الكلام: كبير وواضح وجوه الهوامش الآمنة (8% من كل جنب).\n"
              f"{HELPERS_DOC}\n"
              "رجّع الكود بس جوه ```js ... ``` من غير شرح.")
    user = (f"المقاس {w}x{h} · المدة {dur} ثانية.\nالخطة والستايل:\n{json.dumps(plan, ensure_ascii=False, indent=1)}\n\n"
            "اكتب scene(ctx,t,W,H) اللي بتنفّذ الخطة دي بالظبط بالستايل ده.")
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def fix_messages(code: str, problem: str) -> list[dict]:
    return [{"role": "system", "content": "انت بتصلّح كود Canvas 2D لأنيميشن. نفس القواعد: scene(ctx,t,W,H) دالة في t بس، من غير Math.random ولا Date ولا نت. "
                                          f"{HELPERS_DOC}\nرجّع الكود كامل بعد التصليح جوه ```js ... ``` بس."},
            {"role": "user", "content": f"المشكلة:\n{problem}\n\nالكود:\n```js\n{code}\n```"}]


def review_text(plan: dict, n_refs: int, times: list[float]) -> str:
    return (f"أول {n_refs} صورة هي المراجع (الستايل المطلوب). اللي بعدهم فريمات من الأنيميشن عند الثواني {', '.join(f'{t:.1f}' for t in times)}.\n"
            f"الخطة:\n{json.dumps(plan, ensure_ascii=False)[:3000]}\n\n"
            "قيّم الفريمات كمخرج: هل الستايل قريب من المراجع؟ هل فيه حاجة باينة غلط (كلام خارج الكادر أو متداخل أو مقلوب، فراغ، عناصر مقصوصة، ألوان بعيدة، كادر فاضي)؟\n"
            'رجّع JSON بس: {"score": 1-10, "ok": true/false, "issues": ["مشكلة محددة وإزاي تتصلّح", ...]} '
            "(ok=true لو الدرجة 7 أو أكتر ومفيش غلطة واضحة).")


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
    return np.zeros(1)


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
    rnd = np.random.default_rng(seed)
    n = x.size
    for c in plan.get("sfx") or []:
        try:
            t = float(c.get("t"))
        except (TypeError, ValueError, AttributeError):
            continue
        s = _sfx(str(c.get("kind") or ""), rnd)
        a = int(max(0, t) * SR)
        if a < n and s.size > 1:
            k = min(n - a, s.size)
            x[a:a + k] += s[:k]
    peak = float(np.max(np.abs(x))) or 1
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


