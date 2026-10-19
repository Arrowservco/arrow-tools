// Sanity checks: scenes tile exactly 900 frames @ 30 fps, narration fits, stats.
import {DURATION, FPS, SCENES} from '../src/config.js';
import {NARRATION} from '../src/narration.js';
import {CASH, EXPENSES, MONTHS, STATS, expenseTotal} from '../src/data.js';

let ok = true;
const fail = (m) => { ok = false; console.error('FAIL:', m); };

const scenes = Object.entries(SCENES);
let cursor = 0;
for (const [k, s] of scenes) {
  if (s.from !== cursor) fail(`${k} starts at ${s.from}, expected ${cursor}`);
  cursor += s.dur;
}
if (cursor !== DURATION) fail(`scenes total ${cursor} frames, expected ${DURATION}`);
if (DURATION !== 30 * FPS) fail('duration is not exactly 30 s');
if (MONTHS.length !== 6 || EXPENSES.length !== 6 || CASH.length !== 6) fail('expected 6 months of data');

const want = [1380, 1100, 1930, 1680, 850, 550];
EXPENSES.forEach((e, i) => expenseTotal(e) !== want[i] && fail(`${e.month} expense total ${expenseTotal(e)} != ${want[i]}`));

NARRATION.forEach((n, i) => {
  if (n.endFrame > DURATION) fail(`caption ${i + 1} ends after video`);
  if (i && n.startFrame < NARRATION[i - 1].endFrame) fail(`caption ${i + 1} overlaps previous`);
  const words = n.text.split(/\s+/).length;
  const wpm = (words / (n.end - n.start)) * 60;
  if (wpm > 190) fail(`caption ${i + 1} too fast (${wpm.toFixed(0)} wpm)`);
  console.log(`caption ${i + 1}: ${n.start}-${n.end}s, ${words} words, ${wpm.toFixed(0)} wpm`);
});

console.log(`frames: ${cursor} (${cursor / FPS}s @ ${FPS}fps)`, STATS);
console.log(ok ? 'OK' : 'ERRORS FOUND');
process.exit(ok ? 0 : 1);
