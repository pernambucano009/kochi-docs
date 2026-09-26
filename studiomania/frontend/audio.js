// StudioMania — الخطوة 3 (التعليق الصوتي) والخطوة 5 (الموسيقى)
// الاتنين نفس الشكل، الفرق في نوع الملفات اللي بتتحفظ

const AUDIO_TEXT = {
  voice: { title: "مكتبة التعليق الصوتي", empty: "لسه مفيش تعليقات صوتية. ارفع أول ملف.", drop: "اسحب ملفات التعليق الصوتي وحطها هنا" },
  music: { title: "مكتبة الموسيقى", empty: "لسه مفيش موسيقى. ارفع أول ملف.", drop: "اسحب ملفات الموسيقى وحطها هنا" },
};
const AUDIO_ACCEPT = ".mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,audio/*";

function mountAudioLibrary(root) {
  const kind = root.dataset.kind;
  const t = AUDIO_TEXT[kind];
  const lib = { items: [], query: "", sort: "new", playing: null };

  root.innerHTML = `<section class="panel">
    <div class="panel-head">
      <h2>${t.title} <span class="muted" data-el="count"></span></h2>
      <label class="btn primary sm">＋ رفع ملفات
        <input type="file" data-el="file" accept="${AUDIO_ACCEPT}" multiple hidden></label>
    </div>
    <div class="dropzone" data-el="drop">${t.drop}</div>
    <div data-el="uploads"></div>
    <div class="audio-tools">
      <input type="search" data-el="search" placeholder="دوّر بالاسم...">
      <select data-el="sort">
        <option value="new">الأحدث</option>
        <option value="name">بالاسم</option>
        <option value="short">الأقصر الأول</option>
        <option value="long">الأطول الأول</option>
      </select>
    </div>
    <ul class="audio-list" data-el="list"></ul>
    <p class="empty" data-el="empty">${t.empty}</p>
    <audio data-el="player" preload="none"></audio>
  </section>`;
  const el = (name) => root.querySelector(`[data-el="${name}"]`);
  const player = el("player");

  async function load() {
    lib.items = await api(`/api/audio?kind=${kind}`);
    render();
  }

  function visible() {
    const q = lib.query.trim().toLowerCase();
    const items = lib.items.filter((a) => !q || a.name.toLowerCase().includes(q));
    const by = {
      new: (a, b) => b.created_at.localeCompare(a.created_at),
      name: (a, b) => a.name.localeCompare(b.name, "ar"),
      short: (a, b) => a.duration - b.duration,
      long: (a, b) => b.duration - a.duration,
    }[lib.sort];
    return items.sort(by);
  }

  function render() {
    const items = visible();
    el("count").textContent = lib.items.length ? `(${lib.items.length})` : "";
    el("empty").hidden = lib.items.length > 0;
    el("list").innerHTML = items
      .map(
        (a) => `<li data-id="${a.id}" class="${lib.playing === a.id ? "playing" : ""}">
          <button class="btn sm play" data-act="play" title="تشغيل">${lib.playing === a.id && !player.paused ? "⏸" : "▶︎"}</button>
          <span class="name" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</span>
          <span class="dur">${fmtDuration(a.duration)}</span>
          <span class="acts">
            <button class="btn sm" data-act="rename" title="تغيير الاسم">✎</button>
            <button class="btn sm danger" data-act="delete" title="حذف">✕</button>
          </span>
          ${lib.playing === a.id ? `<div class="progress"><i data-el="bar"></i></div>` : ""}
        </li>`
      )
      .join("");
    if (lib.items.length && !items.length) el("list").innerHTML = `<li class="none">مفيش نتايج</li>`;
  }

  async function upload(files) {
    for (const file of files) {
      const row = document.createElement("div");
      row.className = "upload-item";
      row.textContent = `⏳ ${file.name}`;
      el("uploads").appendChild(row);
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file);
      try {
        await api("/api/audio", { method: "POST", body: form });
      } catch (err) {
        toast(`فشل رفع ${file.name}: ${err.message}`, true);
      }
      row.remove();
    }
    await load();
  }

  el("file").addEventListener("change", (e) => {
    upload([...e.target.files]);
    e.target.value = "";
  });
  const drop = el("drop");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    drop.classList.remove("over");
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i.test(f.name));
    if (files.length) upload(files);
  });
  el("search").addEventListener("input", (e) => { lib.query = e.target.value; render(); });
  el("sort").addEventListener("change", (e) => { lib.sort = e.target.value; render(); });

  el("list").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    const li = e.target.closest("li[data-id]");
    if (!btn || !li) return;
    const a = lib.items.find((x) => x.id === li.dataset.id);
    if (btn.dataset.act === "play") {
      if (lib.playing === a.id) {
        player.paused ? player.play() : player.pause();
      } else {
        stopAllAudio();
        lib.playing = a.id;
        player.src = a.url;
        player.play();
      }
      render();
    }
    if (btn.dataset.act === "rename") {
      const name = prompt("الاسم الجديد:", a.name);
      if (!name || name === a.name) return;
      try {
        await api(`/api/audio/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
        await load();
      } catch (err) { toast(err.message, true); }
    }
    if (btn.dataset.act === "delete") {
      if (!confirm(`حذف "${a.name}"؟`)) return;
      if (lib.playing === a.id) { player.pause(); lib.playing = null; }
      await api(`/api/audio/${a.id}`, { method: "DELETE" });
      await load();
    }
  });

  // الضغط على شريط التقدم بيودّي لمكان في الملف
  el("list").addEventListener("click", (e) => {
    const bar = e.target.closest(".progress");
    if (!bar || !player.duration) return;
    const r = bar.getBoundingClientRect();
    player.currentTime = ((r.right - e.clientX) / r.width) * player.duration;
  });
  player.addEventListener("timeupdate", () => {
    const bar = root.querySelector('[data-el="bar"]');
    if (bar && player.duration) bar.style.width = `${(player.currentTime / player.duration) * 100}%`;
  });
  player.addEventListener("ended", () => { lib.playing = null; render(); });
  player.addEventListener("pause", render);
  player.addEventListener("play", render);

  return { load, stop: () => player.pause() };
}

// مدة بصيغة 1:05 (ولو أطول من ساعة 1:02:03)
function fmtDuration(sec) {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

const audioLibs = {};
function stopAllAudio() {
  Object.values(audioLibs).forEach((l) => l.stop());
}
document.querySelectorAll(".audio-lib").forEach((root) => {
  audioLibs[root.dataset.kind] = mountAudioLibrary(root);
});
viewHooks["3"] = () => { stopAllAudio(); audioLibs.voice.load(); };
viewHooks["5"] = () => { stopAllAudio(); audioLibs.music.load(); };
