#!/usr/bin/env bash
# Scaffold a runnable Remotion (React + SVG, plain JS) video project.
#   scaffold.sh <dir> [WIDTHxHEIGHT=1080x1920] [SECONDS=30]
# Creates 3 scenes (intro / animated bar chart / outro), captions, config and a
# timeline check. Edit src/config.js + src/scenes/*, then:  npm install && npm run preview
set -euo pipefail

dir="${1:?usage: scaffold.sh <dir> [WIDTHxHEIGHT] [SECONDS]}"
size="${2:-1080x1920}"; secs="${3:-30}"
W="${size%x*}"; H="${size#*x}"; FPS=30; FRAMES=$((secs * FPS))
A=$((FRAMES / 5)); C=$((FRAMES / 5)); B=$((FRAMES - A - C))
[ -e "$dir/package.json" ] && { echo "refusing to overwrite $dir/package.json" >&2; exit 1; }
mkdir -p "$dir"/{src/scenes,src/components,scripts,public/audio}
cd "$dir"

cat > package.json <<EOF
{
  "name": "$(basename "$(pwd)")",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "preview": "remotion studio src/index.js",
    "render": "remotion render src/index.js Video out/video.mp4",
    "still": "remotion still src/index.js Video out/still.png --frame=$((FRAMES / 2))",
    "check": "node scripts/check-timeline.mjs"
  },
  "dependencies": {
    "@remotion/cli": "4.0.537",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "remotion": "4.0.537"
  }
}
EOF
printf 'node_modules\nout\n' > .gitignore
cat > remotion.config.js <<'EOF'
import {Config} from '@remotion/cli/config';

Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setVideoImageFormat('png'); // PNG frames => yuv420p (JPEG gives yuvj420p)
Config.setCrf(18);
Config.setOverwriteOutput(true);
EOF
cat > src/index.js <<'EOF'
import {registerRoot} from 'remotion';
import {RemotionRoot} from './Root.jsx';

registerRoot(RemotionRoot);
EOF
cat > src/config.js <<EOF
export const FPS = $FPS;
export const WIDTH = $W;
export const HEIGHT = $H;
export const DURATION = $FRAMES; // $secs s * $FPS fps

// Scenes must tile 0..DURATION exactly (validated in Root.jsx and \`npm run check\`).
export const SCENES = {
  intro: {from: 0, dur: $A},
  chart: {from: $A, dur: $B},
  outro: {from: $((A + B)), dur: $C},
};

// Optional external audio (paths relative to /public). Nothing bundled.
export const AUDIO = {voiceover: null, music: null, musicVolume: 0.12};
EOF
cat > src/theme.js <<'EOF'
export const COLORS = {bg: '#0F172A', card: 'rgba(22,32,58,0.86)', text: '#FFFFFF', muted: '#94A3B8', blue: '#247CB5', orange: '#FF8010', green: '#28A52F', ink: '#0F172A'};
export const FONT = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
EOF
cat > src/utils.js <<'EOF'
import {Easing, interpolate} from 'remotion';

export const easeOut = Easing.out(Easing.cubic);
export const easeInOut = Easing.inOut(Easing.cubic);
export const clamp01 = (v) => Math.max(0, Math.min(1, v));

// 0..1 progress of `frame` over [start, start + dur].
export const prog = (frame, start, dur, easing = easeOut) =>
  interpolate(frame, [start, start + dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing});
EOF
cat > src/narration.js <<'EOF'
import {FPS} from './config.js';

// Voiceover script + burned-in captions. Times in seconds. Replace with your script.
export const NARRATION = [
  {start: 0.5, end: 4.0, text: 'Replace this with your opening line.'},
].map((n) => ({...n, startFrame: Math.round(n.start * FPS), endFrame: Math.round(n.end * FPS)}));
EOF
cat > src/components/Subtitles.jsx <<'EOF'
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {COLORS, FONT} from '../theme.js';
import {NARRATION} from '../narration.js';
import {HEIGHT} from '../config.js';
import {clamp01} from '../utils.js';

// Word-by-word highlighted captions synced to NARRATION.
export const Subtitles = () => {
  const frame = useCurrentFrame();
  const line = NARRATION.find((n) => frame >= n.startFrame && frame < n.endFrame);
  if (!line) return null;
  const words = line.text.split(' ');
  const a = Math.min(clamp01((frame - line.startFrame) / 6), clamp01((line.endFrame - frame) / 6));
  const lit = Math.ceil(clamp01((frame - line.startFrame - 3) / (line.endFrame - line.startFrame - 12)) * words.length);
  return (
    <div style={{position: 'absolute', left: 60, right: 60, top: HEIGHT * 0.77, display: 'flex', justifyContent: 'center', opacity: a}}>
      <div style={{padding: '18px 30px', borderRadius: 30, background: 'rgba(5,8,18,0.78)', textAlign: 'center', fontFamily: FONT, fontSize: 42, fontWeight: 700, lineHeight: 1.26}}>
        {words.map((w, i) => (
          <span key={i} style={{color: i < lit ? COLORS.text : 'rgba(255,255,255,0.45)'}}>{w}{i < words.length - 1 ? ' ' : ''}</span>
        ))}
      </div>
    </div>
  );
};
EOF
cat > src/scenes/Intro.jsx <<'EOF'
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COLORS, FONT} from '../theme.js';
import {prog} from '../utils.js';

export const Intro = () => {
  const frame = useCurrentFrame();
  const p = prog(frame, 6, 24);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', fontFamily: FONT}}>
      <div style={{fontSize: 110, fontWeight: 800, color: COLORS.text, opacity: p, transform: `translateY(${(1 - p) * 50}px)`, textAlign: 'center'}}>
        Your Title <span style={{color: COLORS.orange}}>Here</span>
      </div>
    </AbsoluteFill>
  );
};
EOF
cat > src/scenes/ChartScene.jsx <<'EOF'
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COLORS, FONT} from '../theme.js';
import {prog} from '../utils.js';

const DATA = [{label: 'Jan', v: 40}, {label: 'Feb', v: 65}, {label: 'Mar', v: 90}, {label: 'Apr', v: 55}];

// Animated bar chart: staggered growth, value labels, glow on the max.
export const ChartScene = () => {
  const frame = useCurrentFrame();
  const W = 900, Hh = 600, max = 100, slot = W / DATA.length, bw = slot * 0.6;
  const top = Math.max(...DATA.map((d) => d.v));
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', fontFamily: FONT}}>
      <svg width={W} height={Hh + 60} viewBox={`0 0 ${W} ${Hh + 60}`}>
        {DATA.map((d, i) => {
          const p = prog(frame, 10 + i * 12, 26);
          const h = (d.v / max) * Hh * p;
          const x = slot * i + (slot - bw) / 2;
          return (
            <g key={d.label}>
              <rect x={x} y={Hh - h} width={bw} height={h} rx={12} fill={d.v === top ? COLORS.orange : COLORS.blue}
                style={d.v === top ? {filter: 'drop-shadow(0 0 16px rgba(255,128,16,0.8))'} : undefined} />
              <text x={x + bw / 2} y={Hh - h - 14} textAnchor="middle" fontSize={30} fontWeight={800} fill={COLORS.text} opacity={p}>{d.v}</text>
              <text x={x + bw / 2} y={Hh + 44} textAnchor="middle" fontSize={28} fontWeight={600} fill={COLORS.muted}>{d.label}</text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
EOF
cat > src/scenes/Outro.jsx <<'EOF'
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COLORS, FONT} from '../theme.js';
import {prog} from '../utils.js';

export const Outro = () => {
  const frame = useCurrentFrame();
  const p = prog(frame, 4, 20);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', fontFamily: FONT}}>
      <div style={{fontSize: 90, fontWeight: 800, color: COLORS.text, opacity: p, transform: `translateY(${(1 - p) * 40}px)`, textAlign: 'center'}}>
        Closing <span style={{color: COLORS.orange}}>takeaway.</span>
      </div>
    </AbsoluteFill>
  );
};
EOF
cat > src/Video.jsx <<'EOF'
import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {AUDIO, DURATION, SCENES} from './config.js';
import {COLORS} from './theme.js';
import {easeInOut, prog} from './utils.js';
import {Subtitles} from './components/Subtitles.jsx';
import {Intro} from './scenes/Intro.jsx';
import {ChartScene} from './scenes/ChartScene.jsx';
import {Outro} from './scenes/Outro.jsx';

const COMPONENTS = {intro: Intro, chart: ChartScene, outro: Outro};

export const Video = () => {
  const frame = useCurrentFrame();
  // Open from / close to darkness; last frame is fully dark.
  const overlay = Math.max(1 - prog(frame, 0, 18), prog(frame, DURATION - 18, 17, easeInOut));
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      {Object.entries(SCENES).map(([key, s]) => {
        const Scene = COMPONENTS[key];
        return (
          <Sequence key={key} from={s.from} durationInFrames={s.dur} name={key}>
            <Scene />
          </Sequence>
        );
      })}
      <Subtitles />
      {AUDIO.voiceover ? <Audio src={staticFile(AUDIO.voiceover)} /> : null}
      {AUDIO.music ? (
        <Audio src={staticFile(AUDIO.music)} loop
          volume={(f) => AUDIO.musicVolume * interpolate(f, [0, 30, DURATION - 30, DURATION], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} />
      ) : null}
      <AbsoluteFill style={{background: '#070B14', opacity: overlay, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};
EOF
cat > src/Root.jsx <<'EOF'
import React from 'react';
import {Composition} from 'remotion';
import {DURATION, FPS, HEIGHT, SCENES, WIDTH} from './config.js';
import {Video} from './Video.jsx';

// Fail fast if scenes don't tile the full duration.
let cursor = 0;
Object.entries(SCENES).forEach(([k, s]) => {
  if (s.from !== cursor) throw new Error(`Scene ${k} starts at ${s.from}, expected ${cursor}`);
  cursor += s.dur;
});
if (cursor !== DURATION) throw new Error(`Scenes end at ${cursor}, expected ${DURATION}`);

export const RemotionRoot = () => (
  <Composition id="Video" component={Video} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
);
EOF
cat > scripts/check-timeline.mjs <<'EOF'
import {DURATION, FPS, SCENES} from '../src/config.js';
import {NARRATION} from '../src/narration.js';

let cursor = 0, ok = true;
for (const [k, s] of Object.entries(SCENES)) {
  if (s.from !== cursor) { ok = false; console.error(`FAIL: ${k} starts at ${s.from}, expected ${cursor}`); }
  cursor += s.dur;
}
if (cursor !== DURATION) { ok = false; console.error(`FAIL: scenes total ${cursor}, expected ${DURATION}`); }
NARRATION.forEach((n, i) => {
  if (n.endFrame > DURATION) { ok = false; console.error(`FAIL: caption ${i + 1} ends after video`); }
  const wpm = (n.text.split(/\s+/).length / (n.end - n.start)) * 60;
  if (wpm > 190) { ok = false; console.error(`FAIL: caption ${i + 1} too fast (${wpm.toFixed(0)} wpm)`); }
});
console.log(`frames: ${cursor} (${cursor / FPS}s @ ${FPS}fps)`, ok ? 'OK' : 'ERRORS');
process.exit(ok ? 0 : 1);
EOF
cat > README.md <<'EOF'
# Remotion video project

```bash
npm install
npm run preview   # Remotion Studio
npm run check     # timeline sanity check
npm run render    # out/video.mp4 (H.264, yuv420p)
```
Edit `src/config.js` (size, scenes), `src/narration.js` (captions/voiceover script), `src/scenes/*`.
Optional audio: set `AUDIO.voiceover` / `AUDIO.music` in `src/config.js` to files under `public/`.
EOF
echo "Scaffolded $(pwd) (${W}x${H}, ${FRAMES} frames). Next: npm install && npm run preview"
