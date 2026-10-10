/* KOCHI — فحص جاهزية بروفايلات المدربين
 * يقرأ البيانات العامة من API منصة كوتشي ويشيك على كل مدرب:
 * صورة البروفايل، الفيديو التعريفي، الشهادات المعتمدة، المواعيد المتاحة، حالات الترانسفورميشن.
 * يشتغل بطريقتين: من صفحة coach-audit.html، أو كـ Bookmarklet وانت فاتح www.kochi.fit.
 */
(function () {
  'use strict';

  var API = 'https://marketplace.kochi.fit/api/v1';
  var MEDIA = 'https://marketplace.kochi.fit';
  var SITE = 'https://www.kochi.fit';
  // الـ API بيرجّع الرجالة بس لو مفيش فلتر، فلازم نطلب الاتنين
  var GENDERS = ['ذكر', 'أنثى'];
  var SLOT_DAYS = 7;
  var CONCURRENCY = 4;

  var CHECKS = [
    { key: 'photo', label: 'صورة البروفايل' },
    { key: 'video', label: 'فيديو تعريفي' },
    { key: 'certs', label: 'شهادات معتمدة' },
    { key: 'hours', label: 'مواعيد زووم متاحة' },
    { key: 'transf', label: 'ترانسفورميشن' }
  ];

  // ---------- API ----------

  function unwrap(body) {
    return body && typeof body === 'object' && 'data' in body ? body.data : body;
  }

  function pick(obj, keys) {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      for (var i = 0; i < keys.length; i++) if (keys[i] in obj) return obj[keys[i]];
    }
    return obj;
  }

  function asArray(obj, keys) {
    var v = unwrap(obj);
    if (Array.isArray(v)) return v;
    v = pick(v, keys);
    return Array.isArray(v) ? v : [];
  }

  function get(path, params) {
    var url = API + path;
    if (params) {
      var q = Object.keys(params)
        .filter(function (k) { return params[k] !== undefined; })
        .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
        .join('&');
      if (q) url += '?' + q;
    }
    return fetch(url, { headers: { Accept: 'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + path);
      return r.json();
    });
  }

  function trainerId(t) { return String(t._id || t.id || ''); }

  function listTrainers() {
    var seen = {};
    var all = [];
    var errors = [];
    return Promise.all(GENDERS.map(function (g) {
      return get('/trainers', { gender: g })
        .then(function (b) { return asArray(b, ['trainers', 'items', 'results']); })
        .catch(function (e) { errors.push(e); return []; });
    })).then(function (lists) {
      lists.forEach(function (list) {
        list.forEach(function (t) {
          var id = trainerId(t);
          if (id && !seen[id]) { seen[id] = true; all.push(t); }
        });
      });
      if (!all.length && errors.length) throw errors[0];
      return all;
    });
  }

  function dateKey(d) {
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // نفس اللي صفحة الحجز بتعرضه للعميل الجديد (intro meeting)
  function loadSlots(id) {
    var days = [];
    for (var i = 0; i < SLOT_DAYS; i++) {
      var d = new Date();
      d.setDate(d.getDate() + i);
      days.push(dateKey(d));
    }
    var WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return Promise.all(days.map(function (date) {
      return get('/bookings/available-slots', { trainerId: id, date: date })
        .then(function (b) { var v = unwrap(b); return (v && v.slots) || (Array.isArray(v) ? v : []); })
        .catch(function () { return null; });
    })).then(function (lists) {
      if (lists.every(function (l) { return l === null; })) return null;
      var byWeekday = {};
      lists.forEach(function (l, i) {
        if (l === null) return;
        var p = days[i].split('-').map(Number);
        byWeekday[WEEK[new Date(p[0], p[1] - 1, p[2]).getDay()]] = l.length;
      });
      return {
        byWeekday: byWeekday,
        days: lists.filter(function (l) { return l && l.length; }).length,
        total: lists.reduce(function (n, l) { return n + (l ? l.length : 0); }, 0)
      };
    });
  }

  function loadDetails(summary) {
    var id = trainerId(summary);
    var enc = encodeURIComponent(id);
    return Promise.all([
      get('/trainers/' + enc).then(function (b) { return pick(unwrap(b), ['trainer', 'profile']); }).catch(function () { return null; }),
      get('/trainers/' + enc + '/working-hours').then(unwrap).catch(function () { return null; }),
      get('/trainers/' + enc + '/transformations').then(function (b) { return asArray(b, ['transformations']); }).catch(function () { return null; }),
      loadSlots(id)
    ]).then(function (res) {
      return { id: id, trainer: Object.assign({}, summary, res[0] || {}), hours: res[1], transformations: res[2], slots: res[3] };
    });
  }

  // ---------- Checks ----------

  function mediaUrl(v) {
    if (!v) return null;
    if (typeof v === 'object') v = v.url || v.path || v.src || null;
    if (typeof v !== 'string' || !v.trim()) return null;
    v = v.trim();
    return /^https?:/.test(v) ? v : MEDIA + '/' + v.replace(/^\//, '');
  }

  function workingDays(hours) {
    if (!hours) return [];
    var days = Array.isArray(hours) ? hours : (hours.days || hours.workingHours || []);
    if (!Array.isArray(days)) return [];
    return days.filter(function (d) {
      var start = d.startTime || d.from || d.start;
      var end = d.endTime || d.to || d.end;
      return d.isWorking && start && end;
    });
  }

  var DAY_AR = {
    saturday: 'السبت', sunday: 'الأحد', monday: 'الاثنين', tuesday: 'الثلاثاء',
    wednesday: 'الأربعاء', thursday: 'الخميس', friday: 'الجمعة'
  };

  function describeBadDay(x, lang) {
    if (lang === 'en') {
      var day = x.dayKey.charAt(0).toUpperCase() + x.dayKey.slice(1);
      return x.midnight
        ? day + ' ' + x.start + '→' + x.end + ' (00:00 counts as the start of the day — set it to 23:30)'
        : day + ' ' + x.start + '→' + x.end + ' (ends before it starts)';
    }
    return x.midnight
      ? x.day + ' من ' + x.start + ' لـ ' + x.end + ' (الـ 00:00 بتتحسب بداية اليوم — خلّيها 23:30)'
      : x.day + ' من ' + x.start + ' لـ ' + x.end + ' (النهاية قبل البداية)';
  }

  function evaluate(d) {
    var t = d.trainer;
    var photo = mediaUrl(t.profileImage || t.image || t.photo);
    var video = mediaUrl(t.introVideo || t.introVideoUrl);
    var certs = Array.isArray(t.certifications) ? t.certifications : [];
    // الـ API العام بيرجّع أسماء الشهادات اللي ظاهرة على البروفايل (نصوص)؛ لو رجعت objects بنعتمد على status
    var certStatus = function (c) {
      if (typeof c === 'string') return c.trim() ? 'approved' : 'empty';
      return String(c.status || (c.verified === false ? 'pending' : 'approved')).toLowerCase();
    };
    var approved = certs.filter(function (c) { return certStatus(c) === 'approved'; }).length;
    var pending = certs.filter(function (c) { return certStatus(c) === 'pending'; }).length;
    var days = workingDays(d.hours || t.workingHours);
    var slots = d.slots;
    var dayKeyOf = function (x) { return String(x.dayOfWeek || x.day || '').toLowerCase(); };
    // النهاية 00:00 = نص الليل (آخر اليوم) — المدرب ظابطها صح. بس الموقع بيحسبها بداية اليوم
    // فبيقفل اليوم ده للعملاء؛ دي مشكلة في الموقع مش عند المدرب، فبتتسجل لوحدها.
    var isMidnight = function (x) { return /^0?0:00/.test(String(x.endTime || x.to || x.end)); };
    var noSlots = function (x) {
      var n = slots && slots.byWeekday ? slots.byWeekday[dayKeyOf(x)] : undefined;
      return n === undefined || n === 0;
    };
    // يوم متسجل غلط من المدرب = النهاية قبل البداية، وصفحة الحجز فعلًا مش بتعرض فيه مواعيد
    var reversed = days.filter(function (x) {
      var a = x.startTime || x.from || x.start, b = x.endTime || x.to || x.end;
      return !isMidnight(x) && String(b) <= String(a) && noSlots(x);
    });
    var midnightDays = days.filter(function (x) { return isMidnight(x) && slots && noSlots(x); });
    var dayName = function (x) { var k = dayKeyOf(x); return DAY_AR[k] || k; };
    var validDays = days.length - reversed.length;
    var hoursOk = slots ? (slots.total > 0 || midnightDays.length > 0) : validDays > 0;
    var hoursNote = !days.length
      ? 'مفيش أيام شغل محددة'
      : (slots
          ? (slots.total ? slots.total + ' ميعاد في ' + slots.days + ' أيام (الأسبوع الجاي)' : 'مفيش ولا ميعاد يتحجز الأسبوع الجاي')
          : days.length + ' أيام شغل');
    var badDays = reversed.map(function (x) {
      var end = x.endTime || x.to || x.end;
      return { day: dayName(x), dayKey: dayKeyOf(x), start: x.startTime || x.from || x.start, end: end, midnight: /^0?0:00/.test(end) };
    });
    if (badDays.length) {
      hoursNote += ' — ⚠️ أيام متسجلة غلط ومفيهاش مواعيد: ' + badDays.map(function (x) { return describeBadDay(x, 'ar'); }).join('، ');
    }
    var siteIssues = midnightDays.map(function (x) {
      return { day: dayName(x), dayKey: dayKeyOf(x), start: x.startTime || x.from || x.start, end: x.endTime || x.to || x.end };
    });
    if (siteIssues.length) {
      hoursNote += ' — ℹ️ مشكلة في الموقع: ' + siteIssues.map(function (x) { return x.day + ' من ' + x.start + ' لنص الليل'; }).join('، ') +
        ' مظبوطة صح بس الموقع مش بيعرضها للعملاء';
    }
    var transf = d.transformations || (Array.isArray(t.transformations) ? t.transformations : []);

    var result = {
      id: d.id,
      name: (t.name || t.fullName || t.fullNameEn || t.username || '').trim() || '(بدون اسم)',
      nameEn: String(t.fullNameEn || '').trim(),
      status: t.status === 'pending_verification' ? 'حسابه لسه قيد التوثيق' : '',
      email: t.email || '',
      phone: t.phone || '',
      phoneDigits: String(t.phone || '').replace(/\D/g, ''),
      instagram: String(t.instagram || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/[/?].*$/, ''),
      reversed: badDays,
      siteIssues: siteIssues,
      hasHours: days.length > 0,
      url: SITE + '/trainers/' + encodeURIComponent(d.id),
      photoUrl: photo,
      checks: {
        photo: { ok: !!photo, note: photo ? 'موجودة' : 'مفيش صورة' },
        video: { ok: !!video, note: video ? 'موجود' : 'مفيش فيديو', link: video },
        certs: {
          ok: approved > 0,
          note: approved > 0
            ? approved + ' شهادة' + (pending ? ' + ' + pending + ' قيد المراجعة' : '')
            : (pending ? pending + ' قيد المراجعة (مش معتمدة لسه)' : (certs.length ? certs.length + ' مرفوضة' : 'مفيش شهادات'))
        },
        hours: { ok: hoursOk, note: hoursNote, warn: reversed.length > 0 },
        transf: { ok: transf.length > 0, note: transf.length ? transf.length + ' حالة' : 'مفيش حالات' }
      }
    };
    result.missing = CHECKS.filter(function (c) { return !result.checks[c.key].ok; }).map(function (c) { return c.label; });
    result.score = CHECKS.length - result.missing.length;
    return result;
  }

  function runPool(items, worker, onProgress) {
    var out = new Array(items.length);
    var next = 0;
    var done = 0;
    function lane() {
      if (next >= items.length) return Promise.resolve();
      var i = next++;
      return worker(items[i]).then(function (r) {
        out[i] = r;
        onProgress(++done, items.length);
        return lane();
      });
    }
    var lanes = [];
    for (var k = 0; k < Math.min(CONCURRENCY, items.length); k++) lanes.push(lane());
    return Promise.all(lanes).then(function () { return out; });
  }

  function audit(onProgress) {
    return listTrainers().then(function (list) {
      onProgress(0, list.length);
      return runPool(list, function (t) { return loadDetails(t).then(evaluate); }, onProgress);
    }).then(function (rows) {
      rows.sort(function (a, b) { return a.score - b.score || a.name.localeCompare(b.name, 'ar'); });
      return rows;
    });
  }

  // ---------- UI ----------

  var CSS = [
    '.kca{--teal:#2FA79E;--ink:#1f2937;--muted:#6b7280;--line:#e5e7eb;--bg:#f7f5f0;--card:#fff;--ok:#0f8a5f;--okbg:#e7f6ef;--bad:#b42318;--badbg:#fdecea;',
    'font-family:Cairo,Tajawal,system-ui,sans-serif;direction:rtl;color:var(--ink);background:var(--bg);line-height:1.5;box-sizing:border-box}',
    '.kca *{box-sizing:border-box}',
    '.kca-overlay{position:fixed;inset:0;z-index:2147483647;overflow:auto;padding:16px}',
    '.kca-wrap{max-width:1200px;margin:0 auto}',
    '.kca-head{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:16px}',
    '.kca h2{margin:0;font-size:22px;font-weight:900}',
    '.kca-btn{font:inherit;font-weight:700;border:0;border-radius:10px;padding:8px 14px;cursor:pointer;background:var(--teal);color:#fff}',
    '.kca-btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}',
    '.kca-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}',
    '.kca-stat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px}',
    '.kca-stat b{display:block;font-size:26px;font-weight:900}',
    '.kca-stat span{color:var(--muted);font-size:13px}',
    '.kca-bar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center}',
    '.kca-bar input,.kca-bar select{font:inherit;border:1px solid var(--line);border-radius:10px;padding:7px 10px;background:var(--card);color:var(--ink)}',
    '.kca-table{width:100%;border-collapse:separate;border-spacing:0;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}',
    '.kca-scroll{overflow-x:auto}',
    '.kca th,.kca td{padding:10px;border-bottom:1px solid var(--line);text-align:right;vertical-align:top;font-size:14px}',
    '.kca th{background:#faf9f6;font-size:13px;color:var(--muted);white-space:nowrap}',
    '.kca tr:last-child td{border-bottom:0}',
    '.kca-who{display:flex;gap:10px;align-items:center;min-width:180px}',
    '.kca-who img,.kca-ph{width:40px;height:40px;border-radius:50%;object-fit:cover;background:#eee;flex:none}',
    '.kca-who a{color:var(--ink);font-weight:700;text-decoration:none}',
    '.kca-who a:hover{color:var(--teal);text-decoration:underline}',
    '.kca-cell{display:inline-block;border-radius:8px;padding:2px 8px;font-size:12px;font-weight:700}',
    '.kca-cell.ok{background:var(--okbg);color:var(--ok)}',
    '.kca-cell.bad{background:var(--badbg);color:var(--bad)}',
    '.kca-cell.warn{background:#fef3c7;color:#b45309}',
    '.kca-note{display:block;color:var(--muted);font-size:12px;margin-top:3px;max-width:220px}',
    '.kca-score{font-weight:900;white-space:nowrap}',
    '.kca-msg{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}',
    '.kca-err{border-color:#f5c2c0;background:var(--badbg);color:var(--bad)}',
    '.kca-progress{height:8px;background:var(--line);border-radius:99px;overflow:hidden;margin-top:10px}',
    '.kca-progress i{display:block;height:100%;background:var(--teal);width:0;transition:width .2s}',
    '@media (max-width:640px){.kca h2{font-size:18px}.kca th,.kca td{padding:8px;font-size:13px}}'
  ].join('');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function ensureStyle(doc) {
    if (doc.getElementById('kca-style')) return;
    var st = doc.createElement('style');
    st.id = 'kca-style';
    st.textContent = CSS;
    doc.head.appendChild(st);
  }

  // extra: أعمدة إضافية اختيارية [{ label, value: function (row) }]
  function toCsv(rows, extra) {
    extra = extra || [];
    var head = ['الاسم', 'الإيميل', 'الموبايل', 'حالة الحساب', 'الرابط', 'النتيجة'].concat(CHECKS.map(function (c) { return c.label; })).concat(['الناقص'])
      .concat(extra.map(function (x) { return x.label; }));
    var lines = [head].concat(rows.map(function (r) {
      return [r.name, r.email, r.phone, r.status || 'موثّق', r.url, r.score + '/' + CHECKS.length]
        .concat(CHECKS.map(function (c) { return (r.checks[c.key].ok ? '✅ ' : '❌ ') + r.checks[c.key].note; }))
        .concat([r.missing.join('، ') || 'جاهز'])
        .concat(extra.map(function (x) { return x.value(r) || ''; }));
    }));
    return '﻿' + lines.map(function (l) {
      return l.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
  }

  function download(name, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function render(root, rows, opts) {
    var filter = { q: '', show: 'all' };
    var ready = rows.filter(function (r) { return r.score === CHECKS.length; }).length;
    var stats = CHECKS.map(function (c) {
      return { label: c.label, missing: rows.filter(function (r) { return !r.checks[c.key].ok; }).length };
    });
    var stamp = new Date().toLocaleString('ar-EG');

    root.innerHTML =
      '<div class="kca-wrap">' +
      '<div class="kca-head"><div><h2>جاهزية بروفايلات المدربين</h2>' +
      '<span style="color:var(--muted);font-size:13px">آخر فحص: ' + esc(stamp) + ' · ' + rows.length + ' مدرب</span></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="kca-btn" data-act="csv">⬇️ تحميل Excel (CSV)</button>' +
      '<button class="kca-btn ghost" data-act="rerun">🔄 فحص تاني</button>' +
      (opts.closable ? '<button class="kca-btn ghost" data-act="close">✕ إغلاق</button>' : '') +
      '</div></div>' +
      '<div class="kca-stats">' +
      '<div class="kca-stat"><b style="color:var(--ok)">' + ready + ' / ' + rows.length + '</b><span>بروفايلات جاهزة 100%</span></div>' +
      stats.map(function (s) {
        return '<div class="kca-stat"><b style="color:' + (s.missing ? 'var(--bad)' : 'var(--ok)') + '">' + s.missing + '</b><span>ناقصهم ' + esc(s.label) + '</span></div>';
      }).join('') +
      '</div>' +
      '<div class="kca-bar"><input type="search" placeholder="دوّر باسم المدرب…" data-f="q">' +
      '<select data-f="show"><option value="all">كل المدربين</option><option value="incomplete">الناقصين بس</option><option value="ready">الجاهزين بس</option>' +
      CHECKS.map(function (c) { return '<option value="miss:' + c.key + '">ناقصهم ' + esc(c.label) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="kca-scroll"><table class="kca-table"><thead><tr><th>المدرب</th><th>النتيجة</th>' +
      CHECKS.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') +
      '</tr></thead><tbody data-body></tbody></table></div></div>';

    var body = root.querySelector('[data-body]');

    function draw() {
      var q = filter.q.trim().toLowerCase();
      var list = rows.filter(function (r) {
        if (q && (r.name + ' ' + r.email + ' ' + r.phone).toLowerCase().indexOf(q) < 0) return false;
        if (filter.show === 'ready') return r.score === CHECKS.length;
        if (filter.show === 'incomplete') return r.score < CHECKS.length;
        if (filter.show.indexOf('miss:') === 0) return !r.checks[filter.show.slice(5)].ok;
        return true;
      });
      body.innerHTML = list.length ? list.map(function (r) {
        var color = r.score === CHECKS.length ? 'var(--ok)' : r.score >= 3 ? '#b45309' : 'var(--bad)';
        return '<tr><td><div class="kca-who">' +
          (r.photoUrl ? '<img src="' + esc(r.photoUrl) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' : '<span class="kca-ph"></span>') +
          '<div><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.name) + '</a>' +
          (r.email || r.phone ? '<span class="kca-note">' + [r.email, r.phone].filter(Boolean).map(function (v) { return '<bdi dir="ltr">' + esc(v) + '</bdi>'; }).join(' · ') + '</span>' : '') +
          (r.status ? '<span class="kca-note" style="color:#b45309">' + esc(r.status) + '</span>' : '') +
          '</div></div></td>' +
          '<td class="kca-score" style="color:' + color + '">' + r.score + '/' + CHECKS.length + '</td>' +
          CHECKS.map(function (c) {
            var ch = r.checks[c.key];
            var note = ch.link ? '<a href="' + esc(ch.link) + '" target="_blank" rel="noopener">' + esc(ch.note) + '</a>' : esc(ch.note);
            var label = ch.ok ? (ch.warn ? '⚠️ راجِع' : '✓ تمام') : '✗ ناقص';
            return '<td><span class="kca-cell ' + (ch.ok ? (ch.warn ? 'warn' : 'ok') : 'bad') + '">' + label + '</span><span class="kca-note">' + note + '</span></td>';
          }).join('') + '</tr>';
      }).join('') : '<tr><td colspan="' + (CHECKS.length + 2) + '" style="text-align:center;color:var(--muted)">مفيش نتايج</td></tr>';
    }

    root.querySelector('[data-f="q"]').addEventListener('input', function (e) { filter.q = e.target.value; draw(); });
    root.querySelector('[data-f="show"]').addEventListener('change', function (e) { filter.show = e.target.value; draw(); });
    root.querySelector('[data-act="csv"]').addEventListener('click', function () {
      download('kochi-coaches-' + new Date().toISOString().slice(0, 10) + '.csv', toCsv(rows));
    });
    root.querySelector('[data-act="rerun"]').addEventListener('click', function () { start(root, opts); });
    var close = root.querySelector('[data-act="close"]');
    if (close) close.addEventListener('click', function () { (opts.host || root).remove(); });
    draw();
  }

  function start(root, opts) {
    opts = opts || {};
    ensureStyle(root.ownerDocument);
    root.innerHTML = '<div class="kca-wrap"><div class="kca-msg"><b>جاري فحص بروفايلات المدربين…</b>' +
      '<div data-p style="color:var(--muted);font-size:13px;margin-top:4px">بجيب قايمة المدربين</div>' +
      '<div class="kca-progress"><i data-bar></i></div></div></div>';
    var p = root.querySelector('[data-p]');
    var bar = root.querySelector('[data-bar]');
    return audit(function (done, total) {
      p.textContent = total ? 'اتفحص ' + done + ' من ' + total + ' مدرب' : 'مفيش مدربين';
      bar.style.width = (total ? Math.round(done / total * 100) : 100) + '%';
    }).then(function (rows) {
      render(root, rows, opts);
      return rows;
    }).catch(function (err) {
      var cors = err instanceof TypeError && !/(^|\.)kochi\.fit$/.test(location.hostname);
      root.innerHTML = '<div class="kca-wrap"><div class="kca-msg kca-err"><b>الفحص موقف.</b><br>' +
        esc(err && err.message) + '<br><br>' +
        (cors
          ? 'السيرفر رافض الطلب من الصفحة دي (CORS). استخدم زرار الـ Bookmark وانت فاتح <b>www.kochi.fit</b> — ده بيشتغل دايمًا.'
          : 'جرّب تاني بعد شوية، ولو فضلت المشكلة ابعت الرسالة دي.') +
        (opts.closable ? '<br><br><button class="kca-btn ghost" data-act="close">✕ إغلاق</button>' : '') +
        '</div></div>';
      var close = root.querySelector('[data-act="close"]');
      if (close) close.addEventListener('click', function () { (opts.host || root).remove(); });
    });
  }

  function openOverlay() {
    var old = document.getElementById('kca-overlay');
    if (old) old.remove();
    var host = document.createElement('div');
    host.id = 'kca-overlay';
    host.className = 'kca kca-overlay';
    document.body.appendChild(host);
    return start(host, { closable: true, host: host });
  }

  var api = { describeBadDay: describeBadDay, audit: audit, start: start, openOverlay: openOverlay, toCsv: toCsv, CHECKS: CHECKS };
  if (typeof window !== 'undefined') window.KochiCoachAudit = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined' && window.__KCA_AUTORUN__) openOverlay();
})();
