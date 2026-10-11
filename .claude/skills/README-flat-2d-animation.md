# Skills للأنيميشن 2D بستايل Flat Vector

جُمعت يوم 11 أكتوبر 2026 من اللينكات اللي بعتها، ومن بحث إضافي على GitHub.
فولدر `skills/` فيه 16 skill كاملة بملفاتها (SKILL.md وreferences وscripts)، وكلها برخصة مفتوحة (MIT أو Apache). رخصة كل مصدر موجودة جوه فولدره باسم `LICENSE-SOURCE`.

---

## الترتيب حسب مناسبتها لـ flat vector 2D

### ⭐ الأقوى (ابدأ بيهم)

| Skill | بتعمل إيه | المتطلبات |
|---|---|---|
| **claude-animation** | أقوى واحدة لأفلام 2D مرسومة بالكود: شخصيات برِج حقيقي (chibi، bean، critter)، مكتبة **low-poly flat vector**، تأثيرات أكشن، وصوت متولّد. بتطلع MP4 frame-exact. | Node 20+، ffmpeg، `npm install` جوه فولدرها |
| **text-to-lottie** | بتعمل وبتعدّل وبتصلّح Lottie JSON: أيقونات، لوجوهات، شرح، charts، promos. Lottie أصلاً هو فورمات الـ flat vector animation. | فيها player محلي (Skia Skottie) |
| **motion-canvas** + **animation-basics** | مرجع كامل لـ Motion Canvas (شيبس، SVG paths، كاميرا، transitions) + قواعد الـ 12 principle. ممتازين لفيديوهات الشرح الـ flat. | مشروع Motion Canvas (Node) |
| **hand-drawn-canvas-animation** | أفلام قصيرة بشخصيات بتتحرك بـ whole-pose drawings وexposure sheets. ستايلات ink وriso وscreen print. | Node + Chrome |

### 🎬 موشن جرافيك وريلز

| Skill | بتعمل إيه |
|---|---|
| **motion-reel-ishaan** | ريلز رأسي 1080×1920 (Python + skia + ffmpeg)، وفيها template جاهز لـ **flat editorial-poster explainer**، مناسب جداً لكونتنت KOCHI. |
| **motion-reel-alesha** | showreels وlaunch films وkinetic type وexplainers، بموسيقى وفحص للفريمات وMP4 جاهز. |
| **morph-tile-loop** | لوب هندسي flat: شكل بيتحول لحلقات ونجوم، والكاميرا بتزوم على pattern. |
| **isometric-svg** | illustration أيزومتريك SVG متحركة من غير مكتبات. |
| **riso-rooms** | عوالم أيزومتريك بستايل riso، فيها ناس بتتحرك. |
| **animate** | بيعمل مشروع Vite + React + Framer Motion بمشاهد بتشتغل في المتصفح. |

### 🧰 مكتبات تنفيذ (لو هتبني بنفسك)

| Skill | الاستخدام |
|---|---|
| **lottie-animations** | تشغيل Lottie في الويب وReact (dotLottie وlottie-web). |
| **rive-interactive** | أنيميشن vector تفاعلي بـ state machines (Rive). |
| **animejs** | timelines وstagger وSVG morphing وpath animation. |
| **pixijs-2d** | 2D سريع على WebGL: sprites وparticles. |
| **css-animation-creator** | أنيميشن CSS وmicro-interactions. |

---

## التركيب

**Claude Code:** انسخ أي فولدر من `skills/` إلى `~/.claude/skills/` (لكل المشاريع) أو `.claude/skills/` (لمشروع واحد). مثال:
```bash
cp -r skills/claude-animation ~/.claude/skills/
cd ~/.claude/skills/claude-animation && npm install
```

**Claude.ai / التطبيق:** فولدر `claude-ai-upload/` فيه zip جاهز لكل skill لوحده. ارفعه من Settings ← Capabilities ← Skills. الـ skills اللي بتشغّل Node/ffmpeg محتاجة بيئة تقدر تشغّل كود.

> ملحوظة: فيه اتنين اسمهم `motion-reel` من مصدرين مختلفين. لو هتركّبهم الاتنين، غيّر سطر `name:` في واحد منهم عشان ميحصلش تعارض.

---

## Skills قوية بس مش متضمّنة كملفات (ركّبها من المصدر)

| Skill | ليه مش متضمّنة | التركيب |
|---|---|---|
| **HyperFrames** (HeyGen): `motion-graphics`، `faceless-explainer`، `product-launch-video`، `hyperframes-animation` وغيرها | منظومة كاملة (21 skill) بتتحدّث باستمرار، وبتشتغل مع GSAP وLottie وAnime.js | `npx skills add heygen-com/hyperframes` أو في Claude Code: `claude plugin install hyperframes@hyperframes` |
| **Remotion skills** (12 skill رسمية) | مفيش ملف رخصة في الريبو | `npx skills add remotion-dev/skills` |
| **svg-animation-engineer** | مفيش ملف رخصة. بس هي بالظبط **flat design SVG + CSS keyframes** | github.com/liuyunlong2021-wq/svg-skills |
| **algorithmic-art** و**canvas-design** (Anthropic) | skills رسمية من Anthropic | github.com/anthropics/skills |
| **animation-principles** (dylantarre): 144 skill | كلها عن أنيميشن UI (أزرار، مودالز، loaders)، مش illustration | `npx skills add dylantarre/animation-principles` |
| **horizon-reel** | مفيش رخصة (all rights reserved) | github.com/misbahsy/claude-horizon-animation |

---

## ملاحظات على اللينكات اللي بعتها

1. **buildwithclaude.com ← animation-principles:** دي مجموعة dylantarre، وهي خاصة بأنيميشن الواجهات (UI). مذكورة في الجدول اللي فوق.
2. **onewave-ai ← animate:** متضمّنة (`animate`)، ومعاها `css-animation-creator` من نفس الريبو.
3. **skillsdirectory ← 2d-animation-fundamentals (LoopyLuci):** ملفها عام جداً، checklist ينفع لأي مشروع برمجة ومفيهوش أي إرشاد أنيميشن حقيقي، ومفيش رخصة. **مش متضمّنة ومش مستاهلة.**
4. **analyticsvidhya:** المقال مفيهوش أي skill. بيشرح إن Claude يقدر يرسم SVG مباشرة من غير إضافات.
5. **buildwithhanif/claude-animation-skill:** متضمّنة كاملة (`claude-animation`)، ودي أفضل واحدة في القايمة.
6. **mcpmarket ← motion-canvas-animation:** دي ريبو videozero. متضمّنة (`motion-canvas` و`animation-basics`).
7. **awesomeskill.ai ← 2d-graphics:** فيها 4 skills. أخدت منها `pixijs-2d`. الباقي pixel-art أو Unity، مش flat vector.
