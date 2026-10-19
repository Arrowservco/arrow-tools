// Writes out/captions.srt and out/voiceover-script.txt from src/narration.js,
// for uploading captions to platforms or recording / generating a voiceover.
import {mkdirSync, writeFileSync} from 'node:fs';
import {NARRATION} from '../src/narration.js';

const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

mkdirSync('out', {recursive: true});
writeFileSync(
  'out/captions.srt',
  NARRATION.map((n, i) => `${i + 1}\n${ts(n.start)} --> ${ts(n.end)}\n${n.text}\n`).join('\n'),
);
writeFileSync(
  'out/voiceover-script.txt',
  NARRATION.map((n) => `[${n.start.toFixed(1)}s - ${n.end.toFixed(1)}s]  ${n.text}`).join('\n') + '\n',
);
console.log('Wrote out/captions.srt and out/voiceover-script.txt');
