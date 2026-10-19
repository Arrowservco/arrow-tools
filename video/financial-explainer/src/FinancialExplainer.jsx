import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {DURATION, SCENES} from './config.js';
import {prog, easeInOut} from './utils.js';
import {T} from './timeline.js';
import {useCurrentFrame} from 'remotion';
import {Background} from './components/Background.jsx';
import {Disclaimer} from './components/Disclaimer.jsx';
import {Subtitles} from './components/Subtitles.jsx';
import {Sound} from './components/Sound.jsx';
import {TransitionSweep} from './components/TransitionSweep.jsx';
import {Scene1Intro} from './scenes/Scene1Intro.jsx';
import {Scene2Expenses} from './scenes/Scene2Expenses.jsx';
import {Scene3Cash} from './scenes/Scene3Cash.jsx';
import {Scene4Profit} from './scenes/Scene4Profit.jsx';
import {Scene5Takeaway} from './scenes/Scene5Takeaway.jsx';

const SCENE_COMPONENTS = {
  intro: Scene1Intro,
  expenses: Scene2Expenses,
  cash: Scene3Cash,
  profit: Scene4Profit,
  takeaway: Scene5Takeaway,
};

export const FinancialExplainer = () => {
  const frame = useCurrentFrame();
  // Open from darkness, close to darkness (last frame is fully dark).
  const fadeIn = 1 - prog(frame, 0, 22);
  const fadeOut = prog(frame, DURATION - T.takeaway.fadeOutDur, T.takeaway.fadeOutDur - 1, easeInOut);
  const overlay = Math.max(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{background: '#0B1220'}}>
      <Background />
      {Object.entries(SCENES).map(([key, s]) => {
        const Scene = SCENE_COMPONENTS[key];
        return (
          <Sequence key={key} from={s.from} durationInFrames={s.dur} name={key}>
            <Scene />
          </Sequence>
        );
      })}
      {[SCENES.expenses.from, SCENES.cash.from, SCENES.takeaway.from].map((at) => (
        <TransitionSweep key={at} at={at} />
      ))}
      <Disclaimer />
      <Subtitles />
      <Sound />
      <AbsoluteFill style={{background: '#070B14', opacity: overlay, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};
