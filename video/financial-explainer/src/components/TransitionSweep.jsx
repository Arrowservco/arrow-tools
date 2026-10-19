import React from 'react';
import {useCurrentFrame} from 'remotion';
import {easeInOut, prog} from '../utils.js';

// A soft diagonal light bar that sweeps across the frame at scene boundaries.
export const TransitionSweep = ({at, dur = 16}) => {
  const frame = useCurrentFrame();
  const p = prog(frame, at - dur / 2, dur, easeInOut);
  if (p <= 0 || p >= 1) return null;
  const x = -700 + p * 2500;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: -300,
        width: 520,
        height: 2600,
        transform: 'rotate(18deg)',
        background:
          'linear-gradient(90deg, transparent, rgba(255,160,70,0.0) 10%, rgba(255,150,60,0.34) 50%, rgba(255,160,70,0.0) 90%, transparent)',
        mixBlendMode: 'screen',
        pointerEvents: 'none',
      }}
    />
  );
};
