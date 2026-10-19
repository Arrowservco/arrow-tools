import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {easeInOut, prog} from '../utils.js';

// Wraps a scene: slide+fade in, slide+fade out. Scenes that share a chart with
// their neighbour disable the matching edge so the chart carries across.
export const SceneShell = ({children, fadeIn = true, fadeOut = true, outDur = 10}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const inP = fadeIn ? prog(frame, 0, 14) : 1;
  const outP = fadeOut ? 1 - prog(frame, durationInFrames - outDur, outDur, easeInOut) : 1;
  const x = (1 - inP) * 70 - (1 - outP) * 70;
  return <AbsoluteFill style={{opacity: Math.min(inP, outP), transform: `translateX(${x}px)`}}>{children}</AbsoluteFill>;
};
