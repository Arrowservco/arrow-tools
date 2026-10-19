import React from 'react';
import {useCurrentFrame} from 'remotion';
import {COLORS, FONT} from '../theme.js';
import {easeOut, prog} from '../utils.js';
import {T} from '../timeline.js';
import {SceneShell} from '../components/SceneShell.jsx';
import {MiniDashboard} from '../components/MiniDashboard.jsx';

const TAKEAWAYS = [
  'Expenses peaked in March.',
  'Cash-in and profit declined afterward.',
  'Lower expenses did not prevent falling profit.',
];

const HEAD = [
  [{w: 'Monitor', c: COLORS.text}, {w: 'Profit,', c: COLORS.orange}],
  [{w: 'Not', c: COLORS.text}, {w: 'Just', c: COLORS.text}, {w: 'Expenses.', c: COLORS.text}],
];

// Scene 5 (25-30 s): split-screen summary, three takeaways, closing headline.
// The composition-level overlay in FinancialExplainer.jsx fades to dark at the end.
export const Scene5Takeaway = () => {
  const frame = useCurrentFrame();
  const t = T.takeaway;
  const kick = prog(frame, 2, 16);
  const underline = prog(frame, t.headlineAt + 16, 22);
  let w = 0;

  return (
    <SceneShell fadeOut={false}>
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 110,
          fontFamily: FONT,
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: '0.22em',
          color: COLORS.orange,
          opacity: kick,
        }}
      >
        KEY TAKEAWAYS
      </div>
      <MiniDashboard top={190} start={t.chartsAt} />

      {TAKEAWAYS.map((text, i) => {
        const p = prog(frame, t.itemAt(i), 16);
        return (
          <div
            key={text}
            style={{
              position: 'absolute',
              left: 60,
              width: 960,
              top: 640 + i * 150,
              height: 126,
              boxSizing: 'border-box',
              padding: '0 30px',
              display: 'flex',
              alignItems: 'center',
              gap: 26,
              borderRadius: 32,
              background: COLORS.card,
              border: `2px solid ${COLORS.cardBorder}`,
              fontFamily: FONT,
              opacity: p,
              transform: `translateX(${(1 - p) * 80}px)`,
            }}
          >
            <div
              style={{
                flex: 'none',
                width: 66,
                height: 66,
                borderRadius: 33,
                background: COLORS.orange,
                color: COLORS.ink,
                fontSize: 36,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(255,128,16,0.6)',
              }}
            >
              {i + 1}
            </div>
            <div style={{fontSize: 40, fontWeight: 700, color: COLORS.text, lineHeight: 1.2}}>{text}</div>
          </div>
        );
      })}

      <div style={{position: 'absolute', left: 60, width: 960, top: 1120, textAlign: 'center', fontFamily: FONT}}>
        {HEAD.map((line, li) => (
          <div key={li} style={{fontSize: 92, fontWeight: 800, lineHeight: 1.12, whiteSpace: 'nowrap'}}>
            {line.map(({w: word, c}) => {
              const p = prog(frame, t.headlineAt + w++ * 6, 16);
              return (
                <span
                  key={word}
                  style={{
                    display: 'inline-block',
                    marginRight: 22,
                    color: c,
                    opacity: p,
                    transform: `translateY(${(1 - p) * 40}px)`,
                    textShadow: c === COLORS.orange ? '0 0 36px rgba(255,128,16,0.55)' : 'none',
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
        ))}
        <div
          style={{
            margin: '16px auto 0',
            height: 8,
            width: 720 * underline,
            borderRadius: 4,
            background: `linear-gradient(90deg, ${COLORS.orange}, ${COLORS.blue})`,
            boxShadow: '0 0 20px rgba(255,128,16,0.6)',
          }}
        />
      </div>
    </SceneShell>
  );
};
