// 🧱 طقم الصفحات الجديد: أيقونات صغيرة بخط رفيع، واسم الزرار بيظهر بالهوفر (data-tip)، ومن غير براويز.
// pkIb("search", "ابحث", 'data-x') ← زرار أيقونة · pkIc("search") ← الأيقونة بس
const PK_IC = {
  search: "M11 5a6 6 0 1 1 0 12 6 6 0 0 1 0-12z M20 20l-4.5-4.5",
  upload: "M12 16V4 M7 9l5-5 5 5 M5 20h14",
  download: "M12 4v12 M7 11l5 5 5-5 M5 20h14",
  plus: "M12 5v14 M5 12h14",
  more: "M5.5 12h.01 M12 12h.01 M18.5 12h.01",
  close: "M6 6l12 12 M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7",
  refresh: "M20 12a8 8 0 1 1-2.3-5.6 M20 4v4h-4",
  copy: "M8 8h12v12H8z M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3",
  trash: "M5 7h14 M10 7V5h4v2 M7 7l1 12h8l1-12",
  play: "M8 5v14l11-7z",
  users: "M9 6a3 3 0 1 1 0 6 3 3 0 0 1 0-6z M17 7.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z M3.5 19a5.5 5.5 0 0 1 11 0 M14.5 19a4 4 0 0 1 6.5-3",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  qr: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2v2h-2z M18 18h2v2h-2z M14 18h2",
  chat: "M4 5h16v11H9l-5 4z",
  trend: "M4 15l6-6 4 4 6-6 M14 7h6v6",
  folder: "M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z",
  edit: "M4 20h4L19 9l-4-4L4 16z",
  eye: "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z",
  spark: "M12 3.5l1.9 5.4 5.6 1.9-5.6 1.9L12 18.1l-1.9-5.4-5.6-1.9 5.6-1.9z",
  msg: "M4 5h16v11H9l-5 4z M8 9.5h8 M8 12.5h5",
  megaphone: "M4 10v4h3l7 4V6l-7 4z M17 9.5a3.5 3.5 0 0 1 0 5",
  target: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z M12 11.5h.01",
  settings: "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z M19 12l2-1-1-3-2.2.3-1.3-1.3L16.8 4l-3-1-1 2h-1.6l-1-2-3 1 .3 2.2L6.2 7.5 4 7.2 3 10l2 1v2l-2 1 1 3 2.2-.3 1.3 1.3L7.2 20l3 1 1-2h1.6l1 2 3-1-.3-2.2 1.3-1.3L20 17l1-3-2-1z",
};
const pkIc = (k, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="${PK_IC[k] || PK_IC.plus}"/></svg>`;
const pkIb = (k, tip, attrs = "", cls = "") => `<button type="button" class="pk-ib ${cls}" data-tip="${tip}" aria-label="${tip}" ${attrs}>${pkIc(k)}</button>`;
