import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COLORS} from '../theme.js';
import {DURATION} from '../config.js';

// Persistent dark-navy backdrop: soft colour glows, a slowly drifting glowing
// grid, vignette, and a very slow global push-in for a "camera" feel.
export const Background = () => {
  const frame = useCurrentFrame();
  const zoom = 1 + 0.05 * (frame / DURATION);
  const drift = (frame * 0.35) % 90;
  const pulse = 0.5 + 0.5 * Math.sin(frame / 38);
  return (
    <AbsoluteFill style={{background: COLORS.bg, overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `scale(${zoom})`}}>
        <AbsoluteFill
          style={{
            background: [
              'radial-gradient(900px 900px at 12% 8%, rgba(36,124,181,0.30), transparent 62%)',
              'radial-gradient(900px 900px at 92% 92%, rgba(255,128,16,0.20), transparent 62%)',
            ].join(','),
          }}
        />
        <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, opacity: 0.55 + 0.25 * pulse}}>
          <defs>
            <pattern id="grid" width="90" height="90" patternUnits="userSpaceOnUse" patternTransform={`translate(0 ${drift})`}>
              <path d="M 90 0 L 0 0 0 90" fill="none" stroke="rgba(120,160,210,0.13)" strokeWidth="2" />
            </pattern>
            <linearGradient id="gridFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.35" />
              <stop offset="1" stopColor="#fff" stopOpacity="0.9" />
            </linearGradient>
            <mask id="gridMask">
              <rect width="100%" height="100%" fill="url(#gridFade)" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" mask="url(#gridMask)" />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 55%, rgba(5,8,18,0.7) 100%)'}} />
    </AbsoluteFill>
  );
};
