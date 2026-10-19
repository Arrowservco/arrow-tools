# Remotion patterns that worked

## Progress helper (use everywhere)
```js
import {Easing, interpolate} from 'remotion';
export const prog = (frame, start, dur, easing = Easing.out(Easing.cubic)) =>
  interpolate(frame, [start, start + dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing});
```
Stagger: `items.map((_, i) => prog(frame, base + i * 13, 26))`.
Overshoot "pop": `Easing.out(Easing.back(1.25))`. Smooth draw: `Easing.inOut(Easing.sin)`.

## Timeline as the single source of truth
`config.js`: `SCENES = {intro:{from:0,dur:120}, ...}`; `Root.jsx` throws if scenes don't tile `DURATION`.
`timeline.js`: scene-local frame constants (`barStart(i)`, `peakAt`, ...) + an `SFX` array of absolute cues built from them.
Sequence scenes: `<Sequence from={s.from} durationInFrames={s.dur}>` - inside, `useCurrentFrame()` is scene-local.

## Scene shell (fade/slide in & out)
Wrap each scene; disable `fadeIn`/`fadeOut` on the edge shared with a neighbour when a chart should carry across scenes (e.g. bar chart scene -> same chart gets a line drawn on top).

## SVG charts
- Fixed `viewBox` == pixel size so text is 1:1. Compute `y = v => top + plotH*(1 - v/MAX)`, `cx = i => left + slot*(i+0.5)`.
- Bar growth: height x `barP[i]`; stacked: loop segments bottom-up; round only the top via a `clipPath` rect that extends below the baseline.
- Line draw: `<path pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p}>` (no length math). Point pop-in times: normalised cumulative segment length vs `p`.
- Glow: CSS `filter: drop-shadow(0 0 14px rgba(...))` on SVG elements renders fine.
- Callout pill: size from the *final* string so counting numbers don't jitter; dark text on orange for contrast.
- Curved decline arrow: `M x0 y0 Q x1 y0 x1 y1` (goes right then turns down; stays above intermediate bars), arrowhead appears at p>0.88.
- Counters: `fmt(value * prog(...))` with `Math.round`.

## Captions (burned in)
`NARRATION = [{start, end, text}]` in seconds -> frames. Render active line; highlight words by `ceil(progress * words)`. Keep <=3 lines at 42px, pill background, placed above the disclaimer. Export `.srt` + timestamped script from the same data (`scripts/export-captions.mjs`). Check pacing <= ~190 wpm.

## Layout grid (9:16)
header 110-310 | main card 340-1170 | insight banner 1200-1440 | captions 1470+ | disclaimer ~1725. Keep in `LAYOUT` constants.

## Backgrounds & transitions
Dark navy base, 2 radial colour glows, drifting grid pattern (`patternTransform` from frame), vignette, slow global zoom. Scene boundary: diagonal light-sweep div (`mix-blend-mode: screen`) animated across ~16 frames. Open from darkness and close to darkness with a full-frame overlay whose opacity is a function of frame (last frame fully dark).

## Audio
- Components: `<Audio src={staticFile('audio/x.wav')} volume={v}/>` inside `<Sequence from={cue} layout="none">`.
- Optional externals set via config (`AUDIO.voiceover`, `AUDIO.music`); music volume as a function of frame for fade in/out.
- Synthesize SFX with ffmpeg (no assets):
  - tick: `-f lavfi -i "sine=frequency=1400:duration=0.09" -af "afade=t=in:d=0.005,afade=t=out:st=0.01:d=0.08,volume=0.55"`
  - ping: `-f lavfi -i "aevalsrc='0.45*sin(2*PI*1760*t)+0.25*sin(2*PI*2640*t)':d=0.8:s=44100" -af "afade=t=in:d=0.004,afade=t=out:st=0.04:d=0.76"`
  - whoosh: `-f lavfi -i "anoisesrc=d=0.9:c=pink:r=44100:a=0.6" -af "highpass=f=250,lowpass=f=5200,afade=t=in:d=0.35,afade=t=out:st=0.35:d=0.55,volume=0.7"`
- Verify the mix: `ffmpeg -i out.mp4 -af volumedetect -vn -f null -` (expect max around -10 to -14 dB for SFX-only).

## QA commands
```bash
ffprobe -v error -show_entries stream=codec_name,pix_fmt,width,height,r_frame_rate,nb_frames,duration -of default=nw=1 out/video.mp4
# contact sheet of key frames
ffmpeg -i out/video.mp4 -vf "select='eq(n,60)+eq(n,230)+eq(n,430)+eq(n,860)',scale=270:-1,tile=4x1" -frames:v 1 out/contact.png
```
Frames that land exactly on a transition sweep look blank/odd - sample 2-3 frames off the boundary.
