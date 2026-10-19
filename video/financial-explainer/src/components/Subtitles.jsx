import React from 'react';
import {useCurrentFrame} from 'remotion';
import {COLORS, FONT} from '../theme.js';
import {NARRATION} from '../narration.js';
import {clamp01} from '../utils.js';
import {LAYOUT} from './Layout.jsx';

// Burned-in captions with word-by-word highlighting synced to the narration
// timestamps in narration.js.
export const Subtitles = () => {
  const frame = useCurrentFrame();
  const line = NARRATION.find((n) => frame >= n.startFrame && frame < n.endFrame);
  if (!line) return null;
  const words = line.text.split(' ');
  const inP = clamp01((frame - line.startFrame) / 6);
  const outP = clamp01((line.endFrame - frame) / 6);
  const spoken = clamp01((frame - line.startFrame - 3) / (line.endFrame - line.startFrame - 12));
  const lit = Math.ceil(spoken * words.length);
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        width: 960,
        top: LAYOUT.subTop,
        display: 'flex',
        justifyContent: 'center',
        opacity: Math.min(inP, outP),
        transform: `translateY(${(1 - inP) * 14}px)`,
      }}
    >
      <div
        style={{
          maxWidth: 940,
          padding: '18px 30px',
          borderRadius: 30,
          background: 'rgba(5,8,18,0.78)',
          border: '2px solid rgba(255,255,255,0.08)',
          textAlign: 'center',
          fontFamily: FONT,
          fontSize: 42,
          fontWeight: 700,
          lineHeight: 1.26,
        }}
      >
        {words.map((w, i) => (
          <span key={i} style={{color: i < lit ? COLORS.text : 'rgba(255,255,255,0.45)'}}>
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </div>
    </div>
  );
};
