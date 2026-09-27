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


def probe(ffmpeg: str, path: Path) -> MediaInfo:
    err = subprocess.run([ffmpeg, "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    d = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", err)
    if not d:
        raise ValueError(f"تعذّر قراءة الملف: {path.name}")
    h, m, s = d.groups()
    size = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", err)
    return MediaInfo(
        duration=int(h) * 3600 + int(m) * 60 + float(s),
        width=int(size.group(1)) if size else 0,
        height=int(size.group(2)) if size else 0,
        has_audio=bool(re.search(r"Stream #\d+:\d+.*Audio:", err)),
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

    @property
    def duration(self) -> float:
        return self.end - self.start


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


def segment_command(ffmpeg: str, seg: Segment, output: Path) -> list[str]:
    """المرحلة الأولى: قطعة واحدة بس، مقصوصة ومتظبطة على 1080×1920 وصوتها موحّد."""
    args = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-filter_complex_threads", "1",
            "-threads", "1", "-ss", f"{seg.start:.3f}", "-t", f"{seg.duration:.3f}", "-i", str(seg.path)]
    # بنقص الجزء اللي هيظهر من الفيديو الأصلي الأول وبعدين نكبّره، بدل ما نكبّر
    # الفيديو كله (لحد 3 أضعاف 1080×1920) ونقص منه — نفس النتيجة بذاكرة أقل بكتير
    z = max(1.0, seg.zoom)
    filters = [
        f"[0:v]crop=w='min(iw,ih*{WIDTH}/{HEIGHT})/{z:.4f}':h='min(ih,iw*{HEIGHT}/{WIDTH})/{z:.4f}'"
        f":x='(iw-ow)/2*(1+({seg.x:.4f}))':y='(ih-oh)/2*(1+({seg.y:.4f}))',"
        f"scale={WIDTH}:{HEIGHT},setsar=1,fps={FPS},format=yuv420p[v]"
    ]
    if seg.has_audio:
        audio_in = "[0:a]"
    else:
        # فيديو من غير صوت: نحط سكوت بنفس الطول عشان التركيب يمشي
        args += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
        audio_in = "[1:a]"
    filters.append(
        f"{audio_in}aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,"
        f"volume={seg.volume:.3f},apad,atrim=0:{seg.duration:.3f}[a]"
    )
    return args + [
        "-filter_complex", ";".join(filters), "-map", "[v]", "-map", "[a]", "-t", f"{seg.duration:.3f}",
        # جودة عالية وسرعة عالية، لأنه ملف مؤقت هيتضغط تاني في المرحلة التانية
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "12", "-threads", str(THREADS),
        "-c:a", "pcm_s16le", str(output),
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
    for n, seg in enumerate(segments):
        part = work_dir / f"seg{n:03d}.mkv"
        commands.append(segment_command(ffmpeg, seg, part))
        parts.append(part)
    concat_list = work_dir / "list.txt"
    concat_list.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")

    args = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-filter_complex_threads", "1",
            "-f", "concat", "-safe", "0", "-i", str(concat_list)]
    filters = ["[0:v]null[vcat]", "[0:a]anull[base]"]
    idx = 1
    video_label = "[vcat]"

    if logo:
        args += ["-loop", "1", "-i", str(logo.path)]
        lw = max(2, int(WIDTH * logo.size / 100) // 2 * 2)
        filters.append(
            f"[{idx}:v]scale={lw}:-2,format=rgba,colorchannelmixer=aa={max(0.0, min(1.0, logo.opacity)):.2f}[logo]"
        )
        enable = f":enable='lt(t,{logo.until:.3f})'" if logo.until else ""
        filters.append(
            f"{video_label}[logo]overlay=x='(W-w)*{logo.x / 100:.4f}':y='(H-h)*{logo.y / 100:.4f}'"
            f":shortest=1{enable}[vlogo]"
        )
        video_label = "[vlogo]"
        idx += 1

    if subtitles:
        from captions import filter_path

        filters.append(
            f"{video_label}subtitles=filename='{filter_path(subtitles.ass_path)}'"
            f":fontsdir='{filter_path(subtitles.fonts_dir)}'[vsub]"
        )
        video_label = "[vsub]"

    filters.append(f"{video_label}format=yuv420p[vout]")
    mix = ["[base]"]

    # التعليق والموسيقى ممكن يبقوا متقسّمين لكذا قطعة من نفس الملف
    def as_list(t):
        return [x for x in t if x] if isinstance(t, list) else ([t] if t else [])

    audio = [(f"voice{n}", t) for n, t in enumerate(as_list(voice))] + [(f"music{n}", t) for n, t in enumerate(as_list(music))]
    for label, track in audio:
        args += ["-ss", f"{max(0.0, track.offset):.3f}"]
        if track.length:
            args += ["-t", f"{track.length:.3f}"]
        args += ["-i", str(track.path)]
        delay = max(0.0, track.delay)
        delay_ms = int(delay * 1000)
        chain = (
            f"[{idx}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,"
            f"volume={track.volume:.3f},adelay={delay_ms}|{delay_ms},atrim=0:{total:.3f}"
        )
        if track.fade_out:
            # يختفي بالتدريج في آخره، أو في آخر الفيديو لو هو أطول منه
            end = min(total, delay + track.length) if track.length else total
            if end - delay > MUSIC_FADE_SECONDS:
                chain += f",afade=t=out:st={end - MUSIC_FADE_SECONDS:.3f}:d={MUSIC_FADE_SECONDS}"
        filters.append(chain + f"[{label}]")
        mix.append(f"[{label}]")
        idx += 1

    if len(mix) > 1:
        filters.append(f"{''.join(mix)}amix=inputs={len(mix)}:duration=first:normalize=0[aout]")
        audio_label = "[aout]"
    else:
        audio_label = "[base]"

    args += [
        "-filter_complex", ";".join(filters),
        "-map", "[vout]", "-map", audio_label,
        "-t", f"{total:.3f}",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-threads", str(THREADS),
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
        str(output),
    ]
    commands.append(args)
    return commands, total
