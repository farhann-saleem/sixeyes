"""RunPod CPU timeline-v1 extension. No local execution by the web backend."""
import math
import re


def number(value, name, low, high):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError(f'{name} must be finite, {low}–{high}')
    return value


def render(inp, work, worker):
    plan = inp.get('timeline')
    if not isinstance(plan, dict) or plan.get('version') != 1:
        raise ValueError('timeline.version must be 1')
    duration = number(plan.get('duration'), 'duration', .05, 90)
    slices, beds = plan.get('slices'), plan.get('audio', [])
    if not isinstance(slices, list) or not 1 <= len(slices) <= 100:
        raise ValueError('timeline needs 1–100 slices')
    if not isinstance(beds, list) or len(beds) > 100:
        raise ValueError('timeline allows up to 100 audio beds')
    width = worker._integer(inp, 'width', 1280, 2, 3840)
    height = worker._integer(inp, 'height', 720, 2, 3840)
    fps = number(inp.get('fps', 30), 'fps', 1, 60)
    if width % 2 or height % 2:
        raise ValueError('Canvas dimensions must be even')
    # Validate the whole plan before any download or encoding.
    total = 0
    for s in slices:
        if s.get('kind') not in ('black', 'image', 'video'):
            raise ValueError('Invalid slice kind')
        number(s.get('start'), 'start', 0, 86400)
        total += number(s.get('duration'), 'slice duration', .001, 90)
        if s['kind'] != 'black':
            worker._key(s.get('key'), 'slice key')
        if not isinstance(s.get('texts'), list) or len(s['texts']) > 20:
            raise ValueError('Invalid text list')
        for text in s['texts']:
            if not isinstance(text.get('text'), str) or len(text['text']) > 2000:
                raise ValueError('Text exceeds 2000 characters')
            number(text.get('x'), 'text x', 0, 1)
            number(text.get('y'), 'text y', 0, 1)
            number(text.get('font_size'), 'font size', 8, 300)
            if not re.fullmatch(r'#[0-9a-fA-F]{6}', text.get('color', '')):
                raise ValueError('Text color must be #rrggbb')
    if abs(total - duration) > .02:
        raise ValueError('Slice durations must equal timeline duration')
    for bed in beds:
        worker._key(bed.get('key'), 'audio key')
        number(bed.get('start'), 'audio start', 0, 86400)
        number(bed.get('delay'), 'audio delay', 0, 90)
        number(bed.get('duration'), 'audio duration', .001, 90)
        number(bed.get('volume'), 'audio volume', 0, 1)
    files = {}
    def source(key):
        if key not in files:
            dest = work / f'source-{len(files)}.media'
            worker._download(key, dest)
            files[key] = dest
        return files[key]
    segments = []
    for i, s in enumerate(slices):
        worker._disk(work)
        if s['kind'] == 'black':
            args = ['-f', 'lavfi', '-i', f'color=c=black:s={width}x{height}:r={fps}']
        elif s['kind'] == 'image':
            args = ['-loop', '1', '-i', str(source(s['key']))]
        else:
            args = ['-ss', str(s['start']), '-i', str(source(s['key']))]
        vf = (f'scale={width}:{height}:force_original_aspect_ratio=decrease:force_divisible_by=2,'
              f'pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={fps},setpts=PTS-STARTPTS')
        # Owner text never enters filter syntax; only generated text file names do.
        for j, text in enumerate(s['texts']):
            text_file = work / f'text-{i}-{j}.txt'
            text_file.write_text(text['text'], encoding='utf-8')
            vf += (f",drawtext=textfile='{text_file}':expansion=none:fontsize={text['font_size']}:"
                   f"fontcolor={text['color']}:x=(w-text_w)*{text['x']}:y=(h-text_h)*{text['y']}")
        segment = work / f'timeline-{i}.mp4'
        worker._ffmpeg([*args, '-an', '-vf', vf, '-t', str(s['duration']), '-c:v', 'libx264',
                        '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
                        '-threads', str(worker.THREADS), '-video_track_timescale', '90000', str(segment)])
        segments.append(segment)
    manifest = work / 'timeline-concat.txt'
    manifest.write_text(''.join(f"file '{p.name}'\n" for p in segments))
    assembled = work / 'timeline-video.mp4'
    worker._ffmpeg(['-f', 'concat', '-safe', '1', '-i', str(manifest), '-c', 'copy', str(assembled)])
    args = ['-i', str(assembled), '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']
    filters = [f'[1:a]atrim=duration={duration}[silence]']
    labels = ['[silence]']
    for i, bed in enumerate(beds):
        local = source(bed['key'])
        # Silent stock videos are normal. Do not fail the whole film for that bed.
        if not any(s.get('codec_type') == 'audio' for s in worker._probe(local)['streams']):
            continue
        input_index = 2 + len(labels) - 1
        args += ['-i', str(local)]
        label = f'a{i}'
        filters += [f'[{input_index}:a]atrim=start={bed["start"]}:duration={bed["duration"]},asetpts=PTS-STARTPTS,'
                    f'aresample=48000,volume={bed["volume"]},adelay={round(bed["delay"]*1000)}:all=1[{label}]']
        labels.append(f'[{label}]')
    filters += [''.join(labels) + f'amix=inputs={len(labels)}:duration=longest:normalize=0,atrim=duration={duration}[mix]']
    output = work / 'timeline-stitched.mp4'
    worker._ffmpeg([*args, '-filter_complex', ';'.join(filters), '-map', '0:v:0', '-map', '[mix]',
                    '-c:v', 'copy', '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-t', str(duration),
                    '-movflags', '+faststart', str(output)])
    return output, {'width': width, 'height': height, 'fps': fps, 'clip_count': len(slices), 'timeline_version': 1}
