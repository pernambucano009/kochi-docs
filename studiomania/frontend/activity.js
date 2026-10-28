// ⏳ شريط النشاط: أي ملف بيترفع في أي مكان في البرنامج، وأي طلب بيتأخر في السيرفر، بيظهر هنا لوحده بعداد لحد ١٠٠٪.
// الشريط ثابت في ركن الشاشة، فحتى لو العميل نازل لآخر الصفحة بيشوف «يتم الآن رفع الفيديو …» والنسبة.
// مابيحتاجش تعديل في كل صفحة: بيلقط الرفع من fetch و XMLHttpRequest نفسهم (أي FormData فيها ملفات).
(() => {
  const css = `
.act-tray{position:fixed;z-index:90;bottom:calc(22px + env(safe-area-inset-bottom,0px));left:calc(70px + env(safe-area-inset-left,0px));display:flex;flex-direction:column;gap:8px;width:min(340px,calc(100vw - 150px));pointer-events:none}
.act-it{pointer-events:auto;display:flex;flex-direction:column;gap:6px;padding:10px 14px;border-radius:14px;background:var(--card,#fff);color:var(--text,#141414);
  box-shadow:0 12px 30px -10px rgba(0,0,0,.35);border:1px solid var(--line,rgba(127,127,127,.2));font-size:13px;line-height:1.5;animation:actIn .35s cubic-bezier(.2,1.2,.3,1)}
.act-it .act-h{display:flex;gap:8px;align-items:center}.act-it .act-h span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.act-it .act-h b{font-variant-numeric:tabular-nums;font-weight:600}
.act-it i{display:block;height:4px;border-radius:4px;background:rgba(127,127,127,.2);overflow:hidden}.act-it i em{display:block;height:100%;width:0;background:var(--accent,#E5613E);transition:width .25s}
.act-it.busy i em{width:35%;animation:actBusy 1.2s ease-in-out infinite}
.act-it.ok{border-color:rgba(30,158,106,.5)}.act-it.ok i em{background:#1E9E6A;width:100%}
.act-it.bad{border-color:rgba(217,71,43,.6)}.act-it.bad i em{background:#d9472b;width:100%}
.act-it.out{opacity:0;transform:translateY(8px);transition:opacity .35s,transform .35s}
@keyframes actIn{from{opacity:0;transform:translateY(12px)}}@keyframes actBusy{0%{margin-inline-start:-35%}100%{margin-inline-start:100%}}
@media (prefers-reduced-motion:reduce){.act-it,.act-it.busy i em{animation:none}}`;
  let tray = null, seq = 0;
  function ensure() {
    if (tray?.isConnected) return tray;
    if (!document.getElementById("act-css")) { const st = document.createElement("style"); st.id = "act-css"; st.textContent = css; document.head.appendChild(st); }
    tray = document.createElement("div"); tray.className = "act-tray"; tray.dir = "rtl"; tray.setAttribute("role", "status"); tray.setAttribute("aria-live", "polite");
    document.body.appendChild(tray);
    return tray;
  }
  // عنصر في الشريط: label (الكلام)، pct (النسبة أو null = شغّال من غير نسبة معروفة)
  function add(label, pct = null) {
    const el = document.createElement("div"); el.className = "act-it" + (pct == null ? " busy" : ""); el.dataset.id = ++seq;
    el.innerHTML = `<div class="act-h"><span></span><b></b></div><i><em></em></i>`;
    ensure().appendChild(el);
    const it = {
      set(l, p) {
        if (l != null) el.querySelector("span").textContent = l;
        el.classList.toggle("busy", p == null);
        el.querySelector("b").textContent = p == null ? "" : `${Math.round(p)}٪`;
        if (p != null) el.querySelector("em").style.width = `${Math.max(2, Math.min(100, p))}%`;
      },
      done(ok, l) {
        el.classList.remove("busy"); el.classList.add(ok ? "ok" : "bad");
        el.querySelector("em").style.width = "100%";
        if (l) el.querySelector("span").textContent = l;
        el.querySelector("b").textContent = ok ? "✓" : "";
        setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 400); }, ok ? 2200 : 6000);
      },
    };
    it.set(label, pct);
    return it;
  }
  window.Activity = { add };

  // الكلام جمل كاملة لكل نوع (عشان الترجمة الإنجليزي تطلع جملة سليمة): «يتم الآن رفع الفيديو «x.mp4»» أو «يتم الآن رفع ٣ صور»
  const short = (s) => (s.length > 28 ? s.slice(0, 25) + "…" : s);
  const filesOf = (body) => (body instanceof FormData ? [...body.values()].filter((v) => v instanceof File && v.size) : []);
  function labels(files) {
    if (files.length === 1) {
      const f = files[0], n = short(f.name);
      const up = /^video\//.test(f.type) ? `يتم الآن رفع الفيديو «${n}»` : /^image\//.test(f.type) ? `يتم الآن رفع الصورة «${n}»`
        : /^audio\//.test(f.type) ? `يتم الآن رفع الملف الصوتي «${n}»` : `يتم الآن رفع الملف «${n}»`;
      return { up, wait: `جارٍ معالجة «${n}»…`, ok: `اكتمل رفع «${n}»`, bad: `تعذّر رفع «${n}»` };
    }
    const n = files.length, img = files.every((f) => /^image\//.test(f.type)), vid = files.every((f) => /^video\//.test(f.type));
    return img ? { up: `يتم الآن رفع ${n} صور`, wait: `جارٍ معالجة ${n} صور…`, ok: `اكتمل رفع ${n} صور`, bad: `تعذّر رفع ${n} صور` }
      : vid ? { up: `يتم الآن رفع ${n} فيديوهات`, wait: `جارٍ معالجة ${n} فيديوهات…`, ok: `اكتمل رفع ${n} فيديوهات`, bad: `تعذّر رفع ${n} فيديوهات` }
      : { up: `يتم الآن رفع ${n} ملفات`, wait: `جارٍ معالجة ${n} ملفات…`, ok: `اكتمل رفع ${n} ملفات`, bad: `تعذّر رفع ${n} ملفات` };
  }
  // يربط أي XMLHttpRequest بالشريط: نسبة الرفع، وبعد ١٠٠٪ «جارٍ المعالجة»، وفي الآخر تم أو تعذّر
  function track(xhr, files) {
    const L = labels(files), it = add(L.up, 0);
    xhr.upload.addEventListener("progress", (e) => { if (e.lengthComputable) it.set(e.loaded >= e.total ? L.wait : L.up, e.loaded >= e.total ? null : (100 * e.loaded) / e.total); });
    xhr.upload.addEventListener("load", () => it.set(L.wait, null));
    xhr.addEventListener("loadend", () => it.done(xhr.status >= 200 && xhr.status < 400, xhr.status >= 200 && xhr.status < 400 ? L.ok : L.bad));
  }
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    const fs = filesOf(body);
    if (fs.length && !this.__act) { this.__act = true; track(this, fs); }
    return send.call(this, body);
  };

  // fetch مافيهوش نسبة رفع: الرفع بيتحوّل لـ XMLHttpRequest (بنفس الرد بالظبط)، والطلبات اللي بتتأخر بيظهر لها «جارٍ التنفيذ»
  const ofetch = window.fetch.bind(window);
  function xhrFetch(url, init) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open((init.method || "POST").toUpperCase(), typeof url === "string" ? url : url.url);
      x.withCredentials = init.credentials === "include";
      const h = new Headers(init.headers || {});
      h.forEach((v, k) => { if (k.toLowerCase() !== "content-type") x.setRequestHeader(k, v); });
      x.responseType = "blob";
      x.onload = () => {
        const hs = new Headers();
        x.getAllResponseHeaders().trim().split(/[\r\n]+/).forEach((ln) => { const i = ln.indexOf(":"); if (i > 0) { try { hs.append(ln.slice(0, i).trim(), ln.slice(i + 1).trim()); } catch { /* هيدر غريب */ } } });
        resolve(new Response(x.status === 204 ? null : x.response, { status: x.status, statusText: x.statusText, headers: hs }));
      };
      x.onerror = () => reject(new TypeError("Failed to fetch"));
      x.onabort = () => reject(new DOMException("Aborted", "AbortError"));
      if (init.signal) init.signal.addEventListener("abort", () => x.abort());
      x.send(init.body);
    });
  }
  // عدد الطلبات اللي لسه ماخلصتش (الستارة أول الفتح بتستنى الصفحة تجيب بياناتها عشان كل حاجة تبان مع بعض)
  window.__inflight = 0;
  const count = (p) => { window.__inflight++; const dn = () => { window.__inflight = Math.max(0, window.__inflight - 1); }; p.then(dn, dn); return p; };
  window.fetch = (input, init = {}) => count(act(input, init));
  const act = (input, init = {}) => {
    const method = String(init?.method || "GET").toUpperCase();
    if (filesOf(init?.body).length) return xhrFetch(input, init || {});
    if (method === "GET" || method === "HEAD") return ofetch(input, init);
    // طلب بيغيّر حاجة وبياخد وقت (توليد، تحليل، حفظ كبير): بعد ثانية ونص يبان إنه شغّال
    let it = null;
    const t = setTimeout(() => { it = add("جارٍ تنفيذ طلبك…"); }, 1500);
    return ofetch(input, init).then((r) => { clearTimeout(t); it?.done(r.ok, r.ok ? "تمّ" : "لم يكتمل الطلب"); return r; },
      (e) => { clearTimeout(t); it?.done(false, "تعذّر الاتصال، جرّب مرة أخرى"); throw e; });
  };
})();
