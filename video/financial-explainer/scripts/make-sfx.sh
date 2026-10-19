#!/usr/bin/env bash
# Synthesizes three tiny UI sound effects with ffmpeg (no external assets).
set -euo pipefail
cd "$(dirname "$0")/../public/audio"
F="ffmpeg -hide_banner -loglevel error -y"

# Soft "tick" for chart growth
$F -f lavfi -i "sine=frequency=1400:duration=0.09" \
   -af "afade=t=in:d=0.005,afade=t=out:st=0.01:d=0.08,volume=0.55" -ar 44100 -ac 1 tick.wav

# Bell-like "ping" for highlights
$F -f lavfi -i "aevalsrc='0.45*sin(2*PI*1760*t)+0.25*sin(2*PI*2640*t)':d=0.8:s=44100" \
   -af "afade=t=in:d=0.004,afade=t=out:st=0.04:d=0.76" -ac 1 ping.wav

# Filtered-noise "whoosh" for scene transitions
$F -f lavfi -i "anoisesrc=d=0.9:c=pink:r=44100:a=0.6" \
   -af "highpass=f=250,lowpass=f=5200,afade=t=in:d=0.35,afade=t=out:st=0.35:d=0.55,volume=0.7" -ac 1 whoosh.wav

ls -l *.wav
