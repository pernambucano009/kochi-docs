"""الخطوة 6: المونتاج النهائي بـ FFmpeg.

بيركّب الفيديوهات المولَّدة ورا بعض (مع القص والزووم والتحريك والصوت لكل واحد)،
وبعدها أوترو المدرب، وفوقهم التعليق الصوتي والموسيقى.
"""

import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

WIDTH, HEIGHT, FPS = 1080, 1920, 30
MUSIC_FADE_SECONDS = 1.5
# عدد الـ threads ثابت: FFmpeg لوحده بيفتح thread لكل core في السيرفر، وعلى Railway
# ده ممكن يبقى عشرات، وكل واحد بيحجز فريمات في الذاكرة لحد ما الذاكرة تخلص
THREADS = max(1, int(os.environ.get("RENDER_THREADS", "2")))


@dataclass
class MediaInfo:
    duration: float
    width: int
    height: int
    has_audio: bool
    fps: float = 30.0


def probe(ffmpeg: str, path: Path) -> MediaInfo:
    err = subprocess.run([ffmpeg, "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    d = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", err)
    if not d:
        raise ValueError(f"تعذّر قراءة الملف: {path.name}")
    h, m, s = d.groups()
    size = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", err)
    w, hh = (int(size.group(1)), int(size.group(2))) if size else (0, 0)
    # فيديو الموبايل الطولي بيتخزن ساعات بالعرض ومعاه «لفّه 90 درجة»، وFFmpeg بيلفّه وهو بيقراه: المقاس الحقيقي بالعكس
    rot = re.search(r"rotation of (-?\d+(?:\.\d+)?) degrees|rotate\s*:\s*(-?\d+)", err)
    if rot and round(abs(float(rot.group(1) or rot.group(2)))) % 180 == 90:
        w, hh = hh, w
    return MediaInfo(
        duration=int(h) * 3600 + int(m) * 60 + float(s),
        width=w,
        height=hh,
        has_audio=bool(re.search(r"Stream #\d+:\d+.*Audio:", err)),
        fps=float(fps.group(1)) if (fps := re.search(r"Video:.*?(\d+(?:\.\d+)?) fps", err)) else 30.0,
    )


@dataclass
class Segment:
    path: Path
    start: float
    end: float
    zoom: float = 1.0  # 1 = الصورة مالية الكادر، 2 = زووم الضعف
    x: float = 0.0  # من -1 (أقصى الشمال) لـ 1 (أقصى اليمين)
    y: float = 0.0  # من -1 (فوق خالص) لـ 1 (تحت خالص)
    volume: float = 1.0
    has_audio: bool = True
    src_duration: float | None = None  # طول الملف الأصلي (عشان نعرف نمدّ القطعة قد إيه للترانزيشن)
    trans_in: str = ""  # ترانزيشن من القطعة اللي قبلها (اسم xfade في FFmpeg)
    trans_dur: float = 0.0

    @property
    def duration(self) -> float:
        return self.end - self.start


# ترانزيشنز بين اللقطات (FFmpeg xfade). الطول الكلي للفيديو مبيتغيرش: كل قطعة بتتمد نص مدة الترانزيشن من الفيديو الأصلي
# (أو بتثبت على أول/آخر فريم لو مفيش)، والترانزيشن بيبقى في نص القطع بالظبط، فالكلام والتايبوجرافي بيفضلوا في مواعيدهم.
TRANSITIONS = {"fade", "fadeblack", "fadewhite", "dissolve", "wipeleft", "wiperight", "wipeup", "wipedown", "slideleft", "slideright",
               "slideup", "slidedown", "smoothleft", "smoothright", "circleopen", "circleclose", "radial", "pixelize", "zoomin",
               "hblur", "squeezeh", "squeezev", "diagtl", "hlslice", "rectcrop", "distance"}


@dataclass
class AudioTrack:
    path: Path
    volume: float = 1.0
    delay: float = 0.0  # يبدأ بعد كام ثانية من أول الفيديو
    offset: float = 0.0  # يبدأ من ثانية كام جوه الملف
    length: float | None = None  # ياخد كام ثانية من الملف (None = لحد آخره)
    fade_out: bool = False


@dataclass
class Logo:
    path: Path
    size: float = 18.0  # عرض اللوجو كنسبة من عرض الفيديو
    x: float = 92.0  # من 0 (شمال) لـ 100 (يمين)
    y: float = 4.0  # من 0 (فوق) لـ 100 (تحت)
    opacity: float = 0.9
    until: float | None = None  # يختفي بعد الثانية دي (قبل الأوترو)


@dataclass
class Subtitles:
    ass_path: Path
    fonts_dir: Path


def encoder_args(preset: str, crf: int, low_memory: bool) -> list[str]:
    args = ["-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-threads", "1" if low_memory else str(THREADS)]
    if low_memory:
        args += ["-x264-params", "rc-lookahead=5"]  # فريمات أقل في الذاكرة
    return args


def segment_command(ffmpeg: str, seg: Segment, output: Path, low_memory: bool = False, pre: float = 0.0, post: float = 0.0) -> list[str]:
    """المرحلة الأولى: قطعة واحدة بس، مقصوصة ومتظبطة على 1080×1920 وصوتها موحّد.
    pre/post: ثواني زيادة قبلها وبعدها للترانزيشن (من الفيديو الأصلي، واللي مش موجود بيثبت على أول/آخر فريم)."""
    start = max(0.0, seg.start - pre)
    lack_pre = pre - (seg.start - start)
    end = seg.end + post
    lack_post = 0.0
    if seg.src_duration is not None and end > seg.src_duration:
        lack_post, end = end - seg.src_duration, seg.src_duration
    take = max(1 / FPS, end - start)
    total = seg.duration + pre + post
    args = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-filter_complex_threads", "1",
            "-threads", "1", "-ss", f"{start:.3f}", "-t", f"{take:.3f}", "-i", str(seg.path)]
    pad = (f",tpad=start_mode=clone:start_duration={lack_pre:.3f}" if lack_pre > 0.001 else "") + \
          (f",tpad=stop_mode=clone:stop_duration={lack_post:.3f}" if lack_post > 0.001 else "")
    # بنقص الجزء اللي هيظهر من الفيديو الأصلي الأول وبعدين نكبّره، بدل ما نكبّر
    # الفيديو كله (لحد 3 أضعاف 1080×1920) ونقص منه — نفس النتيجة بذاكرة أقل بكتير
    z = max(1.0, seg.zoom)
    filters = [
        f"[0:v]crop=w='min(iw,ih*{WIDTH}/{HEIGHT})/{z:.4f}':h='min(ih,iw*{HEIGHT}/{WIDTH})/{z:.4f}'"
        f":x='(iw-ow)/2*(1+({seg.x:.4f}))':y='(ih-oh)/2*(1+({seg.y:.4f}))',"
        f"scale={WIDTH}:{HEIGHT},setsar=1,fps={FPS}{pad},format=yuv420p[v]"
    ]
    if seg.has_audio:
        audio_in = "[0:a]"
    else:
        # فيديو من غير صوت: نحط سكوت بنفس الطول عشان التركيب يمشي
        args += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
        audio_in = "[1:a]"
    delay = f"adelay={int(lack_pre * 1000)}:all=1," if lack_pre > 0.001 else ""
    filters.append(
        f"{audio_in}aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,{delay}"
        f"volume={seg.volume:.3f},apad,atrim=0:{total:.3f}[a]"
    )
    return args + [
        "-filter_complex", ";".join(filters), "-map", "[v]", "-map", "[a]", "-t", f"{total:.3f}",
        # ملف مؤقت هيتضغط تاني: جودة عالية بس بحجم معقول عشان مساحة السيرفر متخلصش
        *encoder_args("veryfast", 16, low_memory),
        "-c:a", "flac", "-sample_fmt", "s16", str(output),
    ]


def build_commands(
    ffmpeg: str,
    segments: list[Segment],
    output: Path,
    work_dir: Path,
    voice: AudioTrack | list[AudioTrack] | None = None,
    music: AudioTrack | list[AudioTrack] | None = None,
    logo: Logo | None = None,
    subtitles: Subtitles | None = None,
    low_memory: bool = False,
) -> tuple[list[list[str]], float]:
    """يبني أوامر FFmpeg بالترتيب ويرجّعها مع الطول النهائي للفيديو.

    كل قطعة بتتجهّز لوحدها الأول، وبعدين أمر أخير بيلزقهم ويحط اللوجو والكابشن
    والصوت. كده الذاكرة ثابتة مهما كان عدد القطع (لو كله في أمر واحد، كل قطعة
    بتفتح فيديو في نفس الوقت والذاكرة بتخلص على السيرفر).
    """
    if not segments:
        raise ValueError("مفيش فيديوهات في المونتاج")
    total = sum(s.duration for s in segments)
    work_dir.mkdir(parents=True, exist_ok=True)
    commands, parts = [], []
    # مدة كل ترانزيشن (بين القطعة k-1 وk)، مش أطول من 80٪ من أقصر القطعتين ومن غير ما نص الترانزيشنين يكلوا القطعة كلها
    tr = [0.0] * len(segments)
    for k in range(1, len(segments)):
        seg = segments[k]
        if seg.trans_in in TRANSITIONS and seg.trans_dur > 0:
            tr[k] = round(min(seg.trans_dur, 2.0, segments[k - 1].duration * 0.8, seg.duration * 0.8), 3)
    for k in range(len(segments)):   # القطعة مايتاكلش منها أكتر من 90٪ (ترانزيشن قبل + بعد)
        nxt = tr[k + 1] if k + 1 < len(segments) else 0.0
        over = (tr[k] + nxt) / 2 - segments[k].duration * 0.9
        if over > 0:
            if tr[k]: tr[k] = max(0.0, tr[k] - over)
            elif nxt: tr[k + 1] = max(0.0, nxt - over)
    if not any(tr):
        for n, seg in enumerate(segments):
            part = work_dir / f"seg{n:03d}.mkv"
            commands.append(segment_command(ffmpeg, seg, part, low_memory))
            parts.append(part)
    else:
        # كل قطعة بتتعمل ممدودة، وبعدين بتتقطع لجسم + نصين ترانزيشن، والترانزيشن بيتعمل من نص القطعتين
        ext = []
        for n, seg in enumerate(segments):
            pre, post = tr[n] / 2, (tr[n + 1] / 2 if n + 1 < len(segments) else 0.0)
            part = work_dir / f"ext{n:03d}.mkv"
            commands.append(segment_command(ffmpeg, seg, part, low_memory, pre, post))
            ext.append((part, pre, post, seg.duration))
        enc = [*encoder_args("veryfast", 16, low_memory), "-c:a", "flac", "-sample_fmt", "s16"]
        cut = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-threads", "1"]
        for n, (part, pre, post, dur) in enumerate(ext):
            body_from, body_len = 2 * pre, dur - pre - post
            if body_len >= 1 / FPS:
                body = work_dir / f"body{n:03d}.mkv"
                commands.append(cut + ["-ss", f"{body_from:.3f}", "-t", f"{body_len:.3f}", "-i", str(part), "-map", "0:v", "-map", "0:a",
                                       "-t", f"{body_len:.3f}", *enc, str(body)])
                parts.append(body)
            if n + 1 < len(ext) and tr[n + 1] > 0:
                d = tr[n + 1]
                b_part = ext[n + 1][0]
                chunk = work_dir / f"tr{n:03d}.mkv"
                a_from = pre + dur - post
                kind = segments[n + 1].trans_in
                commands.append(cut + ["-ss", f"{a_from:.3f}", "-t", f"{d:.3f}", "-i", str(part), "-ss", "0", "-t", f"{d:.3f}", "-i", str(b_part),
                                       "-filter_complex",
                                       # xfade محتاج القطعة الأولى أطول شوية من الترانزيشن، فبنثبّت آخر فريم شوية وبنقص الناتج
                                       f"[0:v]setpts=PTS-STARTPTS,fps={FPS},settb=AVTB,tpad=stop_mode=clone:stop_duration=0.3[a];"
                                       f"[1:v]setpts=PTS-STARTPTS,fps={FPS},settb=AVTB,tpad=stop_mode=clone:stop_duration=0.3[b];"
                                       f"[a][b]xfade=transition={kind}:duration={d:.3f}:offset=0,trim=0:{d:.3f},setpts=PTS-STARTPTS,format=yuv420p[v];"
                                       f"[0:a]asetpts=PTS-STARTPTS,afade=t=out:d={d:.3f}[x];[1:a]asetpts=PTS-STARTPTS,afade=t=in:d={d:.3f}[y];"
                                       f"[x][y]amix=inputs=2:normalize=0,atrim=0:{d:.3f}[au]",
                                       "-map", "[v]", "-map", "[au]", "-t", f"{d:.3f}", *enc, str(chunk)])
                parts.append(chunk)
    concat_list = work_dir / "list.txt"
    concat_list.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")

    base_args = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-filter_complex_threads", "1"]
    concat_in = ["-f", "concat", "-safe", "0", "-i", str(concat_list)]
    mixed, video = work_dir / "mix.flac", work_dir / "video.mp4"

    # (أ) الصوت لوحده: صوت الفيديوهات + قطع التعليق والموسيقى
    # كل ملف صوت بيتفتح مرة واحدة بس، وبنقسمه جوه لقطعه — FFmpeg 7.0 ممكن يعلّق لما
    # يبقى فيه مدخلات كتير ماشية بسرعات مختلفة في نفس الأمر
    def as_list(t):
        return [x for x in t if x] if isinstance(t, list) else ([t] if t else [])

    tracks = [("voice", t) for t in as_list(voice)] + [("music", t) for t in as_list(music)]
    args = base_args + ["-vn"] + concat_in
    filters = ["[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[base]"]
    mix = ["[base]"]
    files: dict[Path, list[AudioTrack]] = {}
    for _, t in tracks:
        files.setdefault(t.path, []).append(t)
    for fi, (path, parts_of_file) in enumerate(files.items(), start=1):
        args += ["-i", str(path)]
        outs = [f"[f{fi}p{k}]" for k in range(len(parts_of_file))]
        filters.append(
            f"[{fi}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,"
            f"asplit={len(outs)}{''.join(outs)}" if len(outs) > 1 else
            f"[{fi}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo{outs[0]}"
        )
        for k, track in enumerate(parts_of_file):
            offset = max(0.0, track.offset)
            trim = f"atrim=start={offset:.3f}" + (f":duration={track.length:.3f}" if track.length else "")
            delay = max(0.0, track.delay)
            # بنأخّر القطعة بتغيير وقتها وaresample بيملا اللي قبلها سكوت.
            # adelay بيتجاهل التأخير لو جه بعد قص الصوت (في FFmpeg 7.0)، فالقطع كانت بتبدأ من أول الفيديو
            chain = (
                f"{outs[k]}{trim},asetpts=PTS-STARTPTS+{delay:.3f}/TB,aresample=async=1:first_pts=0,"
                f"volume={track.volume:.3f},apad,atrim=0:{total:.3f}"
            )
            if track.fade_out:
                # يختفي بالتدريج في آخره، أو في آخر الفيديو لو هو أطول منه
                end = min(total, delay + track.length) if track.length else total
                if end - delay > MUSIC_FADE_SECONDS:
                    chain += f",afade=t=out:st={end - MUSIC_FADE_SECONDS:.3f}:d={MUSIC_FADE_SECONDS}"
            label = f"[a{fi}_{k}]"
            filters.append(chain + label)
            mix.append(label)
    if len(mix) > 1:
        filters.append(f"{''.join(mix)}amix=inputs={len(mix)}:duration=first:normalize=0[aout]")
    else:
        filters.append("[base]anull[aout]")
    commands.append(args + [
        "-filter_complex", ";".join(filters), "-map", "[aout]", "-t", f"{total:.3f}",
        "-c:a", "flac", "-sample_fmt", "s16", str(mixed),
    ])

    # (ب) الصورة لوحدها: الفيديوهات + اللوجو + الكابشن
    args = base_args + ["-an"] + concat_in
    filters = ["[0:v]null[vcat]"]
    video_label = "[vcat]"
    if logo:
        # صورة واحدة بس (من غير -loop): الـ overlay بيكرّر آخر فريم لوحده لآخر الفيديو
        args += ["-i", str(logo.path)]
        lw = max(2, int(WIDTH * logo.size / 100) // 2 * 2)
        filters.append(
            f"[1:v]scale={lw}:-2,format=rgba,colorchannelmixer=aa={max(0.0, min(1.0, logo.opacity)):.2f}[logo]"
        )
        enable = f":enable='lt(t,{logo.until:.3f})'" if logo.until else ""
        filters.append(
            f"{video_label}[logo]overlay=x='(W-w)*{logo.x / 100:.4f}':y='(H-h)*{logo.y / 100:.4f}'"
            f":eof_action=repeat{enable}[vlogo]"
        )
        video_label = "[vlogo]"
    if subtitles:
        from captions import filter_path

        filters.append(
            f"{video_label}subtitles=filename='{filter_path(subtitles.ass_path)}'"
            f":fontsdir='{filter_path(subtitles.fonts_dir)}'[vsub]"
        )
        video_label = "[vsub]"
    filters.append(f"{video_label}format=yuv420p[vout]")
    commands.append(args + [
        "-filter_complex", ";".join(filters), "-map", "[vout]", "-t", f"{total:.3f}",
        *encoder_args("veryfast", 20, low_memory), str(video),
    ])

    # (ج) نركّب الصوت على الصورة من غير ما نضغط الصورة تاني
    commands.append(base_args + [
        "-i", str(video), "-i", str(mixed), "-map", "0:v", "-map", "1:a", "-t", f"{total:.3f}",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(output),
    ])
    return commands, total
