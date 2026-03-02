#!/usr/bin/env python3
"""Streaming worker: Playwright video + PulseAudio → ffmpeg → RTMP/file.

Uses Playwright's headless mode for clean WebGL rendering (no browser chrome),
captures audio from PulseAudio virtual sink, and pipes both to ffmpeg.
"""
import argparse
import subprocess
import signal
import sys
import time
import tempfile
import os
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--rtmp', help='RTMP URL for YouTube streaming')
    parser.add_argument('--local', type=int, help='Record N seconds to /tmp/test_stream.mp4')
    parser.add_argument('--sink', default='aituber_sink', help='PulseAudio sink name')
    parser.add_argument('--url', default='http://localhost:5173/stream')
    args = parser.parse_args()

    from playwright.sync_api import sync_playwright

    video_dir = tempfile.mkdtemp(prefix='aituber_video_')
    ffmpeg_proc = None

    def cleanup(signum=None, frame=None):
        nonlocal ffmpeg_proc
        if ffmpeg_proc and ffmpeg_proc.poll() is None:
            ffmpeg_proc.send_signal(signal.SIGINT)
            ffmpeg_proc.wait(timeout=10)
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                '--use-gl=swiftshader',
                '--autoplay-policy=no-user-gesture-required',
            ]
        )

        # Record video via Playwright
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            record_video_dir=video_dir,
            record_video_size={'width': 1920, 'height': 1080},
        )
        page = context.new_page()
        page.goto(args.url)
        page.wait_for_load_state('networkidle')
        print('[stream_worker] Page loaded, waiting for Live2D...', flush=True)
        page.wait_for_timeout(5000)

        video_path = page.video.path()
        print(f'[stream_worker] Video recording: {video_path}', flush=True)

        if args.local:
            # Local mode: record for N seconds, then merge video + audio
            print(f'[stream_worker] Recording {args.local}s...', flush=True)

            # Record audio in parallel
            audio_path = '/tmp/aituber_audio.wav'
            audio_proc = subprocess.Popen([
                'ffmpeg', '-loglevel', 'warning', '-y',
                '-f', 'pulse', '-i', f'{args.sink}.monitor',
                '-t', str(args.local),
                audio_path
            ])

            time.sleep(args.local)

            # Stop recording
            context.close()
            browser.close()
            audio_proc.wait()

            # Get the saved video file
            video_files = list(Path(video_dir).glob('*.webm'))
            if not video_files:
                print('[stream_worker] ERROR: No video file recorded')
                return
            recorded_video = str(video_files[0])
            print(f'[stream_worker] Merging video + audio...', flush=True)

            # Merge video + audio
            output = '/tmp/test_stream.mp4'
            subprocess.run([
                'ffmpeg', '-loglevel', 'warning', '-y',
                '-i', recorded_video,
                '-i', audio_path,
                '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '128k',
                '-shortest',
                output
            ], check=True)
            print(f'[stream_worker] Saved to {output}', flush=True)

        else:
            # YouTube mode: stream continuously
            # Playwright video is saved to a file on close, so for live streaming
            # we use a different approach: periodic screenshots piped to ffmpeg
            print('[stream_worker] Starting live stream...', flush=True)

            ffmpeg_cmd = [
                'ffmpeg', '-loglevel', 'warning',
                '-f', 'rawvideo', '-pix_fmt', 'rgba',
                '-video_size', '1920x1080',
                '-framerate', '15',
                '-i', 'pipe:0',
                '-f', 'pulse', '-i', f'{args.sink}.monitor',
                '-c:v', 'libx264', '-preset', 'ultrafast',
                '-maxrate', '4500k', '-bufsize', '9000k',
                '-pix_fmt', 'yuv420p', '-g', '30',
                '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
                '-f', 'flv',
                args.rtmp
            ]

            ffmpeg_proc = subprocess.Popen(
                ffmpeg_cmd,
                stdin=subprocess.PIPE,
                stderr=subprocess.PIPE
            )

            frame_interval = 1.0 / 15  # 15fps for live
            try:
                while ffmpeg_proc.poll() is None:
                    frame_start = time.time()
                    try:
                        png_data = page.screenshot(type='png')
                        # Convert PNG → raw RGBA
                        convert = subprocess.run(
                            ['ffmpeg', '-loglevel', 'error',
                             '-f', 'image2pipe', '-i', 'pipe:0',
                             '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
                            input=png_data, capture_output=True
                        )
                        if convert.returncode == 0:
                            ffmpeg_proc.stdin.write(convert.stdout)
                    except Exception as e:
                        print(f'[stream_worker] Frame error: {e}', flush=True)
                        break

                    elapsed = time.time() - frame_start
                    sleep_time = frame_interval - elapsed
                    if sleep_time > 0:
                        time.sleep(sleep_time)
            except KeyboardInterrupt:
                pass
            finally:
                if ffmpeg_proc.stdin:
                    ffmpeg_proc.stdin.close()
                ffmpeg_proc.wait(timeout=10)
                context.close()
                browser.close()


if __name__ == '__main__':
    main()
