// 💳 شكل الباقات (واحد لـ«باقتي ونقاطي» جوه البرنامج ولصفحة الأسعار العامة).
// هادي وفاضي: صف صغير فيه اسم كل باقة وسعرها، وفوقه زرار «تفاصيل الباقات» بيعمل زووم لجوه في نفس الصفحة والكروت بتطلع بالتفاصيل.
// كل باقة أعلى مكتوب فيها «كل اللي في … وكمان:» والزيادة بس. وتحت كبسولة النقاط والنقاط الزيادة.
// PlansView.mount(el, data, { pay(kind, key, provider, cycle), signup(plan), toast(msg, bad) })
const PlansView = (() => {
  const CSS = `
:is(#nh, body) .pv { --pv-ink: var(--nh-ink, var(--text, #181718)); --pv-sub: #6B6A66; --pv-muted: var(--nh-muted, var(--muted, #6B6B67)); --pv-acc: var(--nh-accent, var(--accent));
  --pv-card: var(--card, #fff); --pv-field: var(--field, #F3F2EF); --pv-field-hi: #EBEAE6; --pv-fill: rgba(20, 20, 22, .045); --pv-line: rgba(24, 23, 24, .08);
  --pv-track: #E3E2DE; --pv-soft: rgba(229, 97, 62, .1); --pv-tip: #181718; --pv-tip-ink: #fff; --pv-tip-sub: rgba(255, 255, 255, .78); --pv-tip-m: #F6B29E;
  --pv-sh: 0 4px 24px rgba(24, 23, 24, .06); --pv-sh-hi: 0 16px 34px -18px rgba(24, 23, 24, .3); --pv-cont: 0 6px 24px rgba(24, 23, 24, .07);
  --pv-ease: cubic-bezier(.65, 0, .35, 1); --pv-pop: cubic-bezier(.2, .8, .2, 1);
  position: relative; min-height: 100%; display: grid; grid-template-rows: minmax(0, 1fr) auto; color: var(--pv-ink); font-family: var(--nh-arabic, "Jost", "Alexandria", sans-serif); }
:root[data-nh-theme="dark"] :is(#nh, body) .pv { --pv-sub: #A3A29E; --pv-field: #2A292A; --pv-field-hi: #343334; --pv-fill: rgba(255, 255, 255, .05); --pv-line: rgba(255, 255, 255, .08);
  --pv-track: #3D3C3D; --pv-soft: rgba(240, 117, 79, .14); --pv-tip: #F1F1F3; --pv-tip-ink: #141416; --pv-tip-sub: rgba(20, 20, 22, .72); --pv-tip-m: #A93A1F;
  --pv-sh: 0 4px 24px rgba(0, 0, 0, .28); --pv-sh-hi: 0 16px 34px -18px rgba(0, 0, 0, .7); --pv-cont: 0 6px 24px rgba(0, 0, 0, .35); }
:is(#nh, body) .pv :where(button) { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; padding: 0; }
:is(#nh, body) .pv a { color: inherit; text-decoration: none; }
:is(#nh, body) .pv .num { font-family: var(--nh-latin, "Jost", sans-serif); font-weight: 300; letter-spacing: .03em; font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; }
:is(#nh, body) .pv .lat { font-family: var(--nh-latin, "Jost", sans-serif); text-transform: uppercase; direction: ltr; unicode-bidi: isolate; }
:is(#nh, body) .pv-mid { display: grid; place-content: center; justify-items: center; gap: 40px; padding: 24px 0; }
:is(#nh, body) .pv-cap { cursor: pointer; display: inline-flex; align-items: center; gap: 10px; height: 36px; padding: 0 18px; border-radius: 99px; background: var(--pv-card); box-shadow: var(--pv-cont);
  font-size: 12.5px; color: var(--pv-ink); transition: scale .32s var(--pv-pop), box-shadow .3s; }
:is(#nh, body) .pv-cap:hover { scale: 1.04; box-shadow: var(--pv-sh-hi); }
:is(#nh, body) .pv-cap i { width: 6px; height: 6px; border-right: 1.5px solid var(--pv-muted); border-bottom: 1.5px solid var(--pv-muted); rotate: 45deg; margin-top: -3px; transition: rotate .35s var(--pv-ease); }
:is(#nh, body) .pv.open .pv-cap i { rotate: 225deg; margin-top: 3px; }
:is(#nh, body) .pv-stack { display: grid; justify-items: center; align-items: center; }
:is(#nh, body) .pv-stack > * { grid-area: 1 / 1; }
:is(#nh, body) .pv-row { display: flex; align-items: flex-start; justify-content: center; gap: clamp(32px, 7vw, 120px); transition: transform .6s var(--pv-ease), opacity .45s var(--pv-ease), filter .45s; transform-origin: 50% 30%; }
:is(#nh, body) .pv.open .pv-row { transform: scale(1.35); opacity: 0; filter: blur(6px); pointer-events: none; }
:is(#nh, body) .pv-pl { position: relative; width: 150px; display: grid; justify-items: center; gap: 4px; padding: 18px 10px; border-radius: 24px; text-align: center; transition: translate .32s var(--pv-pop), scale .32s var(--pv-pop); }
:is(#nh, body) .pv-pl:hover { translate: 0 -3px; scale: 1.03; }
:is(#nh, body) .pv-pl .nm { font-size: 14px; font-weight: 500; color: var(--pv-sub); }
:is(#nh, body) .pv-pl .pr { display: flex; align-items: baseline; gap: 6px; min-height: 34px; margin-top: 4px; }
:is(#nh, body) .pv-pl .pr .num { font-size: 20px; color: var(--pv-ink); line-height: 1.4; }
:is(#nh, body) .pv-pl .pr small { font-size: 11.5px; color: var(--pv-muted); }
:is(#nh, body) .pv-pl .pr .free { font-size: 16px; line-height: 1.75; }
:is(#nh, body) .pv-pl.mine::before { content: ""; position: absolute; top: 2px; left: 50%; translate: -50% 0; width: 6px; height: 6px; border-radius: 50%; background: var(--pv-acc); }
:is(#nh, body) .pv-pl.dim .nm, :is(#nh, body) .pv-pl.dim .pr { opacity: .5; }
:is(#nh, body) .pv-hot { position: absolute; top: -14px; left: 50%; translate: -50% 0; font-size: 10.5px; padding: 2px 8px; border-radius: 99px; background: var(--pv-tip); color: var(--pv-tip-ink); white-space: nowrap; }
:is(#nh, body) .pv-act { margin-top: 8px; height: 30px; padding: 0 16px; border-radius: 99px; display: inline-flex; align-items: center; justify-content: center; font-size: 12.5px; white-space: nowrap;
  transition: scale .32s var(--pv-pop), box-shadow .4s var(--pv-ease), background .2s; }
:is(#nh, body) .pv-act.go { background: var(--pv-acc); color: #fff; box-shadow: 0 10px 26px -8px color-mix(in srgb, var(--pv-acc) 55%, transparent); }
:is(#nh, body) .pv-act.go:hover { scale: 1.05; }
:is(#nh, body) .pv-act.soft { background: var(--pv-card); box-shadow: 0 4px 18px rgba(24, 23, 24, .08); }
:is(#nh, body) .pv-act.soft:hover { scale: 1.05; }
:is(#nh, body) .pv-act.cur { color: var(--pv-acc); padding: 0; }
:is(#nh, body) .pv-act.low { color: var(--pv-muted); padding: 0; font-size: 12px; }
:is(#nh, body) .pv-act:disabled { opacity: .5; cursor: default; scale: none; }
:is(#nh, body) .pv-tip { position: absolute; top: calc(100% + 4px); left: 50%; translate: -50% 4px; z-index: 20; width: max-content; max-width: 240px; display: grid; gap: 4px; padding: 10px 13px; border-radius: 14px;
  background: var(--pv-tip); color: var(--pv-tip-ink); text-align: start; font-size: 12.5px; line-height: 1.55; box-shadow: 0 12px 30px rgba(24, 23, 24, .22); opacity: 0; pointer-events: none; transition: opacity .18s, translate .18s; }
:is(#nh, body) .pv-tip b { font-size: 13.5px; font-weight: 600; } :is(#nh, body) .pv-tip span { color: var(--pv-tip-sub); } :is(#nh, body) .pv-tip .m { color: var(--pv-tip-m); }
:is(#nh, body) .pv-pl:hover > .pv-tip { opacity: 1; translate: -50% 0; }
:is(#nh, body) .pv-wrap { display: grid; justify-items: center; gap: 26px; opacity: 0; transform: scale(.72); filter: blur(4px); pointer-events: none;
  transition: transform .6s var(--pv-ease), opacity .45s var(--pv-ease) .08s, filter .45s .08s; transform-origin: 50% 30%; }
:is(#nh, body) .pv.open .pv-wrap { opacity: 1; transform: none; filter: none; pointer-events: auto; }
/* التفاصيل وهي مقفولة مابتاخدش مساحة، فالأسعار تفضل في نص الشاشة */
:is(#nh, body) .pv-stack { position: relative; }
:is(#nh, body) .pv:not(.open) .pv-wrap { position: absolute; top: 0; inset-inline: 0; }
:is(#nh, body) .pv-seg { justify-self: end; display: inline-flex; gap: 2px; padding: 2px; margin-bottom: -10px; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--pv-line); }
:is(#nh, body) .pv-seg button { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 11px; border-radius: 999px; font-size: 11.5px; color: var(--pv-muted); transition: background .2s, color .2s; }
:is(#nh, body) .pv-seg button:hover { color: var(--pv-ink); } :is(#nh, body) .pv-seg button.on { background: var(--pv-fill); color: var(--pv-ink); }
:is(#nh, body) .pv-seg em { font-style: normal; font-size: 10px; color: var(--pv-acc); }
:is(#nh, body) .pv-cards { display: flex; align-items: stretch; gap: 20px; }
:is(#nh, body) .pv-pc { position: relative; width: 264px; display: flex; flex-direction: column; gap: 24px; padding: 32px 30px 28px; border-radius: 24px; background: var(--pv-card); box-shadow: var(--pv-sh); text-align: start;
  opacity: 0; translate: 0 14px; transition: opacity .4s var(--pv-ease), translate .5s var(--pv-ease), box-shadow .4s var(--pv-ease); }
:is(#nh, body) .pv.open .pv-pc { opacity: 1; translate: 0 0; }
:is(#nh, body) .pv.open .pv-pc:nth-child(2) { transition-delay: .05s; } :is(#nh, body) .pv.open .pv-pc:nth-child(3) { transition-delay: .1s; } :is(#nh, body) .pv.open .pv-pc:nth-child(4) { transition-delay: .15s; }
:is(#nh, body) .pv-pc:hover { box-shadow: var(--pv-sh-hi); }
:is(#nh, body) .pv-pc.mine { box-shadow: inset 0 0 0 1.5px var(--pv-acc), var(--pv-sh); }
:is(#nh, body) .pv-pc.dim > :not(.pv-cta) { opacity: .55; }
:is(#nh, body) .pv-pc .t { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 22px; }
:is(#nh, body) .pv-pc .t b { font-size: 14px; font-weight: 500; color: var(--pv-sub); }
:is(#nh, body) .pv-pc .t em { font-style: normal; font-size: 10.5px; padding: 2px 8px; border-radius: 99px; background: var(--pv-tip); color: var(--pv-tip-ink); }
:is(#nh, body) .pv-pc .t em.me { background: var(--pv-soft); color: var(--pv-acc); }
:is(#nh, body) .pv-pc .p { display: grid; gap: 2px; }
:is(#nh, body) .pv-pc .p > div { display: flex; align-items: baseline; gap: 6px; }
:is(#nh, body) .pv-pc .p .num { font-size: 20px; line-height: 1.4; }
:is(#nh, body) .pv-pc .p .free { font-size: 16px; line-height: 1.75; }
:is(#nh, body) .pv-pc .p small { font-size: 11.5px; color: var(--pv-muted); }
:is(#nh, body) .pv-pc .p .yr { font-size: 11px; color: var(--pv-muted); min-height: 16px; }
:is(#nh, body) .pv-pc .p .yr .num { font-size: 11px; line-height: inherit; }
:is(#nh, body) .pv-pc .k { font-size: 12px; color: var(--pv-sub); }
:is(#nh, body) .pv-pc .k .num { font-size: 12px; color: var(--pv-ink); }
:is(#nh, body) .pv-pc ul { margin: 0; padding: 22px 0 6px; border-top: 1px solid var(--pv-line); list-style: none; display: grid; gap: 14px; flex: 1; align-content: start; font-size: 12px; color: var(--pv-sub); }
:is(#nh, body) .pv-pc li { display: flex; gap: 8px; align-items: baseline; }
:is(#nh, body) .pv-pc li::before { content: ""; width: 4px; height: 4px; border-radius: 50%; background: var(--pv-acc); opacity: .7; flex: none; translate: 0 -2px; }
:is(#nh, body) .pv-pc li.inh { font-size: 11.5px; color: var(--pv-muted); margin-bottom: -2px; } :is(#nh, body) .pv-pc li.inh::before { display: none; }
:is(#nh, body) .pv-cta { display: flex; gap: 6px; }
:is(#nh, body) .pv-cta > * { flex: 1; height: 34px; border-radius: 99px; display: flex; align-items: center; justify-content: center; font-size: 12.5px; transition: scale .3s var(--pv-pop), background .2s; }
:is(#nh, body) .pv-cta .go { background: var(--pv-acc); color: #fff; box-shadow: 0 10px 26px -8px color-mix(in srgb, var(--pv-acc) 55%, transparent); }
:is(#nh, body) .pv-cta .go:hover { scale: 1.04; }
:is(#nh, body) .pv-cta .soft { background: var(--pv-field); } :is(#nh, body) .pv-cta .soft:hover { background: var(--pv-field-hi); }
:is(#nh, body) .pv-cta .cur { color: var(--pv-acc); background: var(--pv-soft); }
:is(#nh, body) .pv-cta .low { color: var(--pv-muted); }
:is(#nh, body) .pv-cta button:disabled { opacity: .45; cursor: default; scale: none; }
:is(#nh, body) .pv-low { display: flex; justify-content: center; padding-bottom: 6px; }
:is(#nh, body) .pv-cont { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 99px; background: var(--pv-card); box-shadow: var(--pv-cont); white-space: nowrap; max-width: 100%; overflow-x: auto; scrollbar-width: none; }
:is(#nh, body) .pv-cont .ring { width: 32px; height: 32px; flex: none; }
:is(#nh, body) .pv-cont .ring circle { fill: none; stroke-width: 3; } :is(#nh, body) .pv-cont .ring .trk { stroke: var(--pv-line); }
:is(#nh, body) .pv-cont .ring .val { stroke: var(--pv-acc); stroke-linecap: round; transform: rotate(-90deg); transform-origin: 20px 20px; }
:is(#nh, body) .pv-cont .ttl { font-size: 13px; font-weight: 500; padding-inline: 4px; }
:is(#nh, body) .pv-cont .sep { width: 1px; height: 22px; background: var(--pv-line); }
:is(#nh, body) .pv-cont .tp { height: 30px; padding: 0 12px; border-radius: 99px; font-size: 12.5px; display: inline-flex; align-items: center; gap: 6px; transition: background .2s; }
:is(#nh, body) .pv-cont .tp:hover { background: var(--pv-fill); }
:is(#nh, body) .pv-cont .tp small { color: var(--pv-muted); font-size: 11.5px; }
:is(#nh, body) .pv-cont .tp.pick { background: var(--pv-soft); color: var(--pv-acc); }
:is(#nh, body) .pv-cont .more { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--pv-fill); font-size: 16px; color: var(--pv-sub); transition: rotate .25s var(--pv-ease), background .2s; }
:is(#nh, body) .pv-cont.open .more { rotate: 45deg; }
:is(#nh, body) .pv-cont:not(.open) .sep, :is(#nh, body) .pv-cont:not(.open) .tp { display: none; }
:is(#nh, body) .pv-low { position: relative; flex-direction: column; align-items: center; gap: 8px; }
:is(#nh, body) .pv-hist-b { height: 30px; padding: 0 12px; border-radius: 99px; font-size: 12.5px; color: var(--pv-sub); background: var(--pv-fill); }
:is(#nh, body) .pv-hist { width: min(420px, 100%); max-height: 240px; overflow-y: auto; padding: 8px 14px; border-radius: 18px; background: var(--pv-card); box-shadow: var(--pv-cont); }
:is(#nh, body) .pv-hist li { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; font-size: 12.5px; border-bottom: 1px solid var(--pv-line); }
:is(#nh, body) .pv-hist li:last-child { border-bottom: 0; }
:is(#nh, body) .pv-hist .d { font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; flex: none; } :is(#nh, body) .pv-hist .d.plus { color: var(--pv-acc); }
:is(#nh, body) .pv-hist small { color: var(--pv-muted); display: block; font-size: 11px; }
:is(#nh, body) .pv-cont .how { font-size: 11.5px; color: var(--pv-muted); padding-inline: 6px; }
@media (max-width: 1100px) { :is(#nh, body) .pv-pc { width: 220px; padding: 26px 22px 22px; } :is(#nh, body) .pv-pl { width: 120px; } }
/* التابلت: الكروت الأربعة صفّين بدل ما تتقطع */
@media (min-width: 821px) and (max-width: 1020px) { :is(#nh, body) .pv-cards { flex-wrap: wrap; justify-content: center; max-width: 640px; } :is(#nh, body) .pv-pc { width: calc(50% - 12px); }
  :is(#nh, body) .pv-row { flex-wrap: wrap; justify-content: center; max-width: 640px; } :is(#nh, body) .pv.open .pv-row { display: none; } :is(#nh, body) .pv-tip { display: none; } }
@media (max-width: 820px) {
  :is(#nh, body) .pv-mid { place-content: start stretch; gap: 20px; padding-top: 8px; }
  :is(#nh, body) .pv.open .pv-mid { justify-items: stretch; } :is(#nh, body) .pv.open .pv-cap { justify-self: center; }
  :is(#nh, body) .pv-stack { display: block; width: 100%; justify-self: stretch; }
  :is(#nh, body) .pv-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; }
  :is(#nh, body) .pv-pl { width: auto; background: var(--pv-fill); } :is(#nh, body) .pv-pl:hover { scale: 1; }
  :is(#nh, body) .pv-tip { display: none; }
  :is(#nh, body) .pv.open .pv-row { display: none; }
  :is(#nh, body) .pv-wrap { display: none; transform: none; filter: none; justify-items: stretch; transition: opacity .3s; width: 100%; } :is(#nh, body) .pv.open .pv-wrap { display: grid; }
  :is(#nh, body) .pv-seg { justify-self: center; margin: 0; }
  :is(#nh, body) .pv-cards { flex-direction: column; width: 100%; } :is(#nh, body) .pv-pc { width: 100%; }
  :is(#nh, body) .pv-cont { flex-wrap: wrap; justify-content: center; border-radius: 24px; padding: 10px; white-space: normal; }
  :is(#nh, body) .pv-cont .sep { display: none; } :is(#nh, body) .pv-cont .tp { background: var(--pv-fill); }
}
@media (prefers-reduced-motion: reduce) { .pv *, .pv { transition: none !important; } }`;
  const st = document.createElement("style");
  st.textContent = CSS;
  document.head.appendChild(st);

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const n = (x) => Number(x || 0).toLocaleString("en-US");
  const ORDER = ["trial", "starter", "pro", "agency"];
  const PLUS = `<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

  // اللي بيزيد في الباقة عن اللي قبلها: من plan-items.js، نفس المصدر اللي شاشة الأسعار في صفحة الهبوط بتقرا منه
  let ADDONS = [];
  const adds = (p, prev) => PlanItems.adds(p, prev, ADDONS, "ar");
  // الأسعار بتتعرض بالريال (الدولار × ٣.٧٦ مقرّب)، والدفع نفسه بيتم بما يعادلها
  const SAR = 3.76, sar = (v) => Math.round(v * SAR);
  const credLine = (p) => `<span class="num">${n(p.credits)}</span> نقطة ${p.once ? "مرة واحدة" : "كل شهر"}`;

  function mount(el, d, o = {}) {
    ADDONS = d.addons || [];
    const S = { cyc: "month", open: !!o.open, pick: null, tops: false, top: null, busy: false };   // open: التفاصيل مفتوحة من الأول (صفحة الأسعار العامة)
    const plans = ORDER.map((k) => d.plans.find((p) => p.key === k)).filter(Boolean).concat(d.plans.filter((p) => !ORDER.includes(p.key)));
    const guest = !d.me, ym = +(d.rules?.yearly_months || 10);
    const curI = guest ? -2 : plans.findIndex((p) => p.key === d.plan);
    const moP = (p) => S.cyc === "year" ? Math.round(p.price * ym / 12) : p.price;
    const fmtD = (t) => t ? new Date(t * 1000).toLocaleDateString(typeof UI_LOCALE === "function" ? UI_LOCALE() : "ar-EG", { day: "numeric", month: "long" }) : "";
    const renew = d.ends_at ? `تنتهي ${fmtD(d.ends_at)}` : d.renews_at ? `تتجدد ${fmtD(d.renews_at)}` : "";
    const providers = [d.paypal && ["paypal", "PayPal"]].filter(Boolean);
    const sameCycle = () => (d.cycle || "month") === S.cyc;

    function state(p, i) {
      if (guest) return "buy";
      if (d.owner) return "owner";
      if (i === curI) return sameCycle() || p.once ? "cur" : "switch";
      if (p.once) return curI < 0 ? "trial" : "low";
      return i > curI || curI < 0 ? "up" : "low";
    }
    function small(p, i) {
      const s = state(p, i);
      const act = s === "buy" ? `<button class="pv-act ${p.popular ? "go" : "soft"}" data-pvbuy="${esc(p.key)}">${p.price ? "اشترك" : "ابدأ مجانًا"}</button>`
        : s === "cur" ? `<span class="pv-act cur">✓ باقتك</span>`
        : s === "up" || s === "switch" ? `<button class="pv-act go" data-pvopen>${s === "switch" ? "حوّل" : curI < 0 ? "اشترك" : "ترقية"}</button>`
        : s === "owner" ? "" : `<span class="pv-act low">${p.once ? "خلصت" : "أقل من باقتك"}</span>`;
      const tipM = s === "cur" ? renew : s === "up" ? "ترقية فورية، والفرق يُحسب بالأيام" : "";
      return `<div class="pv-pl${s === "cur" ? " mine" : ""}${s === "low" ? " dim" : ""}">
        ${guest && p.popular ? `<span class="pv-hot">الأكثر اختيارًا</span>` : ""}
        <b class="nm">${esc(p.name)}</b>
        <span class="pr">${p.price ? `<span class="num">${sar(moP(p))}</span><small>ر.س / شهر</small>` : `<span class="free">مجانًا</span>`}</span>
        ${act}
        <span class="pv-tip"><b>${esc(p.name)}</b><span>${credLine(p)}<br>${adds(p, plans[i - 1]).map(esc).join("<br>")}</span>${tipM ? `<span class="m">${esc(tipM)}</span>` : ""}</span></div>`;
    }
    function big(p, i) {
      const s = state(p, i), yr = S.cyc === "year" && p.price;
      let cta;
      if (s === "buy") cta = `<button class="${p.popular ? "go" : "soft"}" data-pvbuy="${esc(p.key)}">${p.price ? `اشترك في ${esc(p.name)}` : "ابدأ مجانًا"}</button>`;
      else if (s === "cur") cta = `<span class="cur">✓ باقتك${renew ? ` · ${esc(renew)}` : ""}</span>`;
      else if (s === "up" || s === "switch") {
        const label = s === "switch" ? (S.cyc === "year" ? "حوّل إلى السنوي" : "حوّل إلى الشهري") : `${curI < 0 ? "اشترك في" : "ترقية إلى"} ${esc(p.name)}`;
        cta = S.pick === p.key && providers.length > 1 ? providers.map(([k, t]) => `<button class="go" data-pvpay="${k}" data-plan="${esc(p.key)}" ${S.busy ? "disabled" : ""}>${t}</button>`).join("")
          : `<button class="go" data-pvup="${esc(p.key)}" ${providers.length ? "" : "disabled"}>${label}</button>`;
      } else if (s === "owner") cta = `<span class="low">حساب صاحب البرنامج</span>`;
      else cta = `<span class="low">${p.once ? "انتهت التجربة" : "أقل من باقتك"}</span>`;
      const tag = s === "cur" ? `<em class="me">باقتك</em>` : p.popular ? `<em>الأكثر اختيارًا</em>` : "";
      const prev = plans[i - 1];
      return `<article class="pv-pc${s === "cur" ? " mine" : ""}${s === "low" ? " dim" : ""}">
        <div class="t"><b>${esc(p.name)}</b>${tag}</div>
        <div class="p">${p.price ? `<div><span class="num">${sar(moP(p))}</span><small>ر.س / شهر</small></div><span class="yr">${yr ? `<span class="num">${sar(p.price * ym)}</span> ر.س مرة واحدة في السنة` : `≈ <span class="num">$${moP(p)}</span>`}</span>`
          : `<div><span class="free">مجانًا</span></div><span class="yr">بدون بطاقة</span>`}</div>
        <div class="k">${credLine(p)}</div>
        <ul>${prev ? `<li class="inh">كل ما في ${prev.once ? "التجربة" : esc(prev.name)}، وأيضًا:</li>` : ""}${adds(p, prev).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
        <div class="pv-cta">${cta}</div></article>`;
    }
    function bottom() {
      const tops = d.topups.map((t) => S.top === t.key && !guest && providers.length > 1
        ? providers.map(([k, tx]) => `<button class="tp pick" data-pvtop="${esc(t.key)}" data-prov="${k}">${tx}</button>`).join("")
        : `<button class="tp" data-pvtop="${esc(t.key)}">+<span class="num">${n(t.credits)}</span> <small><span class="num">${sar(t.price)}</span> ر.س</small></button>`).join("");
      if (guest) return `<div class="pv-cont${S.tops ? " open" : ""}"><b class="ttl" style="padding-inline-start:10px">نقاط إضافية</b><span class="sep"></span>${tops}<span class="how">صالحة ${d.rules?.topup_valid_months || 12} شهرًا</span><button class="more" data-pvmore aria-label="نقاط إضافية">+</button></div>`;
      const c = d.me.credits || {}, cur = plans[curI], full = (cur?.credits || 0) + (c.topup_credits || 0);
      const pct = full ? Math.max(0, Math.min(100, Math.round((c.total || 0) / full * 100))) : 0;
      return `<div class="pv-cont${S.tops ? " open" : ""}"><svg class="ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" class="trk"/><circle cx="20" cy="20" r="16" class="val" style="stroke-dasharray:${pct} 100.5"/></svg>
        <b class="ttl" title="نقاط الباقة ${n(c.plan_credits)} · نقاط إضافية ${n(c.topup_credits)}"><span class="num">${n(c.total)}</span> نقطة</b><span class="sep"></span>${tops}<button class="more" data-pvmore aria-label="أضف نقاطًا">+</button></div>`;
    }
    // 🧾 سجل النقاط: كل خصم وكل رجوع وكل هدية بسطر، عشان العميل يعرف الرقم جه منين
    const KIND = { gift: "هدية", refund: "استرجاع", use: "", plan: "الباقة", topup: "شحن", trial: "التجربة" };
    function hist() {
      if (guest || d.owner || !(d.history || []).length) return "";
      const rows = d.history.map((h) => `<li><span>${KIND[h.kind] ? `<b>${esc(KIND[h.kind])}</b> · ` : ""}${esc(h.note || "")}<small>${fmtD(h.at)}</small></span><bdi class="d${h.delta > 0 ? " plus" : ""}" dir="ltr">${h.delta > 0 ? "+" : "-"}${n(Math.abs(h.delta))}</bdi></li>`).join("");
      return `<button class="pv-hist-b" data-pvhist aria-expanded="${!!S.hist}">${S.hist ? "إخفاء سجل النقاط" : "سجل النقاط"}</button>${S.hist ? `<ul class="pv-hist">${rows}</ul>` : ""}`;
    }
    function render() {
      el.innerHTML = `<div class="pv${S.open ? " open" : ""}" data-nofx>
        <div class="pv-mid">
          <button class="pv-cap" data-pvcap aria-expanded="${S.open}"><span data-pvcapt>${S.open ? "إخفاء" : "التفاصيل"}</span><i aria-hidden="true"></i></button>
          <div class="pv-stack">
            <div class="pv-row">${plans.map(small).join("")}</div>
            <div class="pv-wrap" aria-hidden="${!S.open}">
              ${plans.some((p) => p.price) ? `<div class="pv-seg"><button data-pvcyc="month" class="${S.cyc === "month" ? "on" : ""}">شهري</button><button data-pvcyc="year" class="${S.cyc === "year" ? "on" : ""}">سنوي <em>${ym < 12 ? (12 - ym === 2 ? "شهران مجانًا" : `${12 - ym} أشهر مجانًا`) : ""}</em></button></div>` : ""}
              <div class="pv-cards">${plans.map(big).join("")}</div>
            </div>
          </div>
        </div>
        <div class="pv-low">${bottom()}${hist()}</div></div>`;
    }
    const pv = () => el.querySelector(".pv");
    let shut;
    const zoom = (on) => { clearTimeout(shut); if (on && !S.open) S.openedAt = Date.now(); S.open = on; if (!on) S.pick = null; pv().classList.toggle("open", on); el.querySelector("[data-pvcap]").setAttribute("aria-expanded", on);
      el.querySelector("[data-pvcapt]").textContent = on ? "إخفاء" : "التفاصيل";
      el.querySelector(".pv-wrap").setAttribute("aria-hidden", !on); };
    const pay = async (kind, key, prov) => {
      if (!o.pay) return;
      S.busy = true; render();
      try { await o.pay(kind, key, prov, S.cyc); } finally { S.busy = false; if (el.isConnected) { render(); if (S.open) pv().classList.add("open"); } }
    };
    el.addEventListener("click", (e) => {
      const q = (s) => e.target.closest(s);
      if (q("[data-pvcap]")) return S.open && Date.now() - (S.openedAt || 0) < 700 ? null : zoom(!S.open);   // الضغطة اللي بعد الهوفر على طول ماتقفلهاش
      if (q("[data-pvopen]")) return zoom(true);
      if (q("[data-pvcyc]")) { S.cyc = q("[data-pvcyc]").dataset.pvcyc; S.pick = null; render(); return pv().classList.add("open"); }
      if (q("[data-pvbuy]")) return o.signup?.(q("[data-pvbuy]").dataset.pvbuy, S.cyc);
      if (q("[data-pvup]")) {
        const key = q("[data-pvup]").dataset.pvup;
        if (providers.length === 1) return pay("plan", key, providers[0][0]);
        S.pick = key; render(); return pv().classList.add("open");
      }
      if (q("[data-pvpay]")) { const b = q("[data-pvpay]"); return pay("plan", b.dataset.plan, b.dataset.pvpay); }
      if (q("[data-pvhist]")) { S.hist = !S.hist; const o2 = S.open; render(); return o2 && pv().classList.add("open"); }
      if (q("[data-pvmore]")) { S.tops = !S.tops; S.top = null; return el.querySelector(".pv-cont").classList.toggle("open", S.tops); }
      const t = q("[data-pvtop]");
      if (t) {
        if (guest) return o.signup?.("", S.cyc);
        if (t.dataset.prov) return pay("topup", t.dataset.pvtop, t.dataset.prov);
        if (!providers.length) return o.toast?.("الدفع قيد التجهيز، وسيُتاح قريبًا.");
        if (providers.length === 1) return pay("topup", t.dataset.pvtop, providers[0][0]);
        S.top = t.dataset.pvtop; render(); if (S.open) pv().classList.add("open");
      }
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.open && el.isConnected) zoom(false); });
    // 🖱️ الوقوف على «التفاصيل» يفتحها على طول، والخروج من منطقة الباقات يقفلها بعد لحظة (الضغط شغال كمان، وعلى الجوال بالضغط بس)
    if (matchMedia("(hover: hover)").matches) {
      el.addEventListener("mouseover", (e) => {
        if (e.target.closest?.("[data-pvcap]") && !S.open) zoom(true);
        if (e.target.closest?.(".pv-mid")) clearTimeout(shut);
      });
      el.addEventListener("mouseout", (e) => {
        if (!S.open || !e.target.closest?.(".pv-mid") || e.relatedTarget?.closest?.(".pv-mid")) return;
        clearTimeout(shut); shut = setTimeout(() => { if (S.open && !S.busy) zoom(false); }, 700);
      });
    }
    render();
  }
  return { mount };
})();
