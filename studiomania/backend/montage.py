"""الخطوة 6: المونتاج النهائي بـ FFmpeg.

بيركّب الفيديوهات المولَّدة ورا بعض (مع القص والزووم والتحريك والصوت لكل واحد)،
وبعدها أوترو المدرب، وفوقهم التعليق الصوتي والموسيقى.
"""

import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

WIDTH, HEIGHT, FPS = 1080, 1920, 30
MUSIC_FADE_SECONDS = 1.5


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
    delay: float = 0.0  # يبدأ بعد كام ثانية من أول الفيديو (للتعليق الصوتي)
    offset: float = 0.0  # يبدأ من ثانية كام جوه الملف (للموسيقى)
    fade_out: bool = False


def build_command(
    ffmpeg: str,
    segments: list[Segment],
    output: Path,
    voice: AudioTrack | None = None,
    music: AudioTrack | None = None,
) -> tuple[list[str], float]:
    """يبني أمر FFmpeg ويرجّعه مع الطول النهائي للفيديو."""
    if not segments:
        raise ValueError("مفيش فيديوهات في المونتاج")
    total = sum(s.duration for s in segments)
    args = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]
    filters = []
    concat_inputs = []
    idx = 0

    for n, seg in enumerate(segments):
        args += ["-ss", f"{seg.start:.3f}", "-t", f"{seg.duration:.3f}", "-i", str(seg.path)]
        vin = idx
        idx += 1
        zw = int(WIDTH * seg.zoom) // 2 * 2
        zh = int(HEIGHT * seg.zoom) // 2 * 2
        filters.append(
            f"[{vin}:v]scale={zw}:{zh}:force_original_aspect_ratio=increase,"
            f"crop={WIDTH}:{HEIGHT}:x='(iw-ow)/2*(1+({seg.x:.4f}))':y='(ih-oh)/2*(1+({seg.y:.4f}))',"
            f"setsar=1,fps={FPS},format=yuv420p[v{n}]"
        )
        if seg.has_audio:
            filters.append(
                f"[{vin}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,"
                f"volume={seg.volume:.3f}[a{n}]"
            )
        else:
            # فيديو من غير صوت: نحط سكوت بنفس الطول عشان التركيب يمشي
            args += ["-f", "lavfi", "-t", f"{seg.duration:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
            filters.append(f"[{idx}:a]aformat=sample_fmts=fltp:channel_layouts=stereo[a{n}]")
            idx += 1
        concat_inputs.append(f"[v{n}][a{n}]")

    filters.append(f"{''.join(concat_inputs)}concat=n={len(segments)}:v=1:a=1[vout][base]")
    mix = ["[base]"]

    if voice:
        args += ["-i", str(voice.path)]
        delay_ms = int(max(0.0, voice.delay) * 1000)
        filters.append(
            f"[{idx}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,"
            f"volume={voice.volume:.3f},adelay={delay_ms}|{delay_ms}[voice]"
        )
        mix.append("[voice]")
        idx += 1

    if music:
        args += ["-ss", f"{max(0.0, music.offset):.3f}", "-i", str(music.path)]
        chain = (
            f"[{idx}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,"
            f"volume={music.volume:.3f},atrim=0:{total:.3f}"
        )
        if music.fade_out and total > MUSIC_FADE_SECONDS:
            chain += f",afade=t=out:st={total - MUSIC_FADE_SECONDS:.3f}:d={MUSIC_FADE_SECONDS}"
        filters.append(chain + "[music]")
        mix.append("[music]")
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
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
        str(output),
    ]
    return args, total
