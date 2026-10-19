import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COLORS, FONT} from '../theme.js';
import {easeInOut, easeOut, prog} from '../utils.js';
import {SceneShell} from '../components/SceneShell.jsx';
import {MiniDashboard} from '../components/MiniDashboard.jsx';

const TITLE = ['6 Months of', 'Business', 'Performance'];

// Scene 1 (0-4 s): dashboard emerges from darkness with a slow camera push-in.
export const Scene1Intro = () => {
  const frame = useCurrentFrame();
  const zoom = 1.16 - 0.16 * prog(frame, 0, 120, easeInOut);
  const kick = prog(frame, 10, 18);
  const sub = prog(frame, 56, 20);
  const dash = prog(frame, 34, 30);
  return (
    <SceneShell fadeIn={false}>
      <AbsoluteFill style={{transform: `scale(${zoom})`, transformOrigin: '50% 45%'}}>
        <div style={{position: 'absolute', left: 60, width: 960, top: 250, fontFamily: FONT, textAlign: 'center'}}>
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: '0.24em',
              color: COLORS.orange,
              opacity: kick,
              transform: `translateY(${(1 - kick) * 20}px)`,
            }}
          >
            JAN – JUN 2026
          </div>
          <div style={{marginTop: 26}}>
            {TITLE.map((line, i) => {
              const p = prog(frame, 14 + i * 8, 22);
              return (
                <div
                  key={line}
                  style={{
                    fontSize: 118,
                    fontWeight: 800,
                    lineHeight: 1.1,
                    color: i === 2 ? COLORS.orange : COLORS.text,
                    opacity: p,
                    transform: `translateY(${(1 - p) * 60}px)`,
                    filter: `blur(${(1 - p) * 10}px)`,
                    textShadow: i === 2 ? '0 0 40px rgba(255,128,16,0.45)' : 'none',
                  }}
                >
                  {line}
                </div>
              );
            })}
          </div>
          <div
            style={{
              marginTop: 34,
              fontSize: 44,
              fontWeight: 600,
              color: '#CBD5E1',
              opacity: sub,
              transform: `translateY(${(1 - sub) * 20}px)`,
            }}
          >
            Expenses <span style={{color: COLORS.orange}}>•</span> Cash Flow <span style={{color: COLORS.orange}}>•</span> Profit
          </div>
        </div>
        <MiniDashboard top={1010} start={40} opacity={dash} />
      </AbsoluteFill>
    </SceneShell>
  );
};
