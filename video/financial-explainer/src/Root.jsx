import React from 'react';
import {Composition} from 'remotion';
import {DURATION, FPS, HEIGHT, SCENES, WIDTH} from './config.js';
import {FinancialExplainer} from './FinancialExplainer.jsx';

// Fail fast if the scene timeline does not tile the full duration exactly.
const scenes = Object.values(SCENES);
scenes.forEach((s, i) => {
  const expectedFrom = i === 0 ? 0 : scenes[i - 1].from + scenes[i - 1].dur;
  if (s.from !== expectedFrom) throw new Error(`Scene ${i} starts at ${s.from}, expected ${expectedFrom}`);
});
const end = scenes[scenes.length - 1].from + scenes[scenes.length - 1].dur;
if (end !== DURATION) throw new Error(`Scenes end at frame ${end}, expected ${DURATION}`);

export const RemotionRoot = () => (
  <Composition
    id="FinancialExplainer"
    component={FinancialExplainer}
    durationInFrames={DURATION}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
