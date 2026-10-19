import React from 'react';
import {useCurrentFrame} from 'remotion';
import {COLORS, FONT} from '../theme.js';
import {prog} from '../utils.js';

// Layout grid (1080x1920, kept clear of Reels/Shorts UI at the bottom):
//   header 110-310 | card 340-1170 | insight 1200-1440 | captions 1470+ | disclaimer 1725
export const LAYOUT = {headerTop: 110, cardTop: 340, cardH: 830, insightTop: 1200, subTop: 1470, disclaimerTop: 1725};

export const SceneHeader = ({kicker, title, sub, color = COLORS.orange}) => {
  const frame = useCurrentFrame();
  const p = prog(frame, 2, 18);
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        top: LAYOUT.headerTop,
        width: 960,
        fontFamily: FONT,
        opacity: p,
        transform: `translateY(${(1 - p) * 24}px)`,
      }}
    >
      <div style={{fontSize: 28, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color}}>{kicker}</div>
      <div style={{fontSize: 78, fontWeight: 800, color: COLORS.text, lineHeight: 1.08, marginTop: 8}}>{title}</div>
      <div style={{fontSize: 30, fontWeight: 500, color: COLORS.muted, marginTop: 10}}>{sub}</div>
    </div>
  );
};

export const Card = ({top = LAYOUT.cardTop, height = LAYOUT.cardH, left = 60, width = 960, pad = 24, children, style}) => (
  <div
    style={{
      position: 'absolute',
      left,
      top,
      width,
      height,
      boxSizing: 'border-box',
      padding: pad,
      borderRadius: 44,
      background: COLORS.card,
      border: `2px solid ${COLORS.cardBorder}`,
      boxShadow: '0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)',
      fontFamily: FONT,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Legend = ({items}) => (
  <div style={{display: 'flex', gap: 30, height: 56, alignItems: 'center', paddingLeft: 12, fontFamily: FONT}}>
    {items.map((it) => (
      <div key={it.label} style={{display: 'flex', alignItems: 'center', gap: 12, fontSize: 28, fontWeight: 600, color: '#E2E8F0'}}>
        {it.line ? (
          <span style={{width: 34, height: 8, borderRadius: 4, background: it.color, boxShadow: `0 0 10px ${it.color}`}} />
        ) : (
          <span style={{width: 24, height: 24, borderRadius: 7, background: it.color}} />
        )}
        {it.label}
      </div>
    ))}
  </div>
);

// Down/up arrow in a glowing circle; the arrow bobs gently.
export const TrendBadge = ({color = COLORS.orange, down = true, size = 92}) => {
  const frame = useCurrentFrame();
  const bob = Math.sin(frame / 5) * 4;
  return (
    <svg width={size} height={size} viewBox="0 0 92 92" style={{flex: 'none', filter: `drop-shadow(0 0 14px ${color}99)`}}>
      <circle cx="46" cy="46" r="42" fill={`${color}26`} stroke={color} strokeWidth="4" />
      <g transform={`translate(0 ${bob}) ${down ? '' : 'rotate(180 46 46)'}`}>
        <path d="M46 22 V58 M30 44 L46 61 L62 44" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
};

export const CautionIcon = ({size = 56, color = COLORS.amber}) => (
  <svg width={size} height={size} viewBox="0 0 56 56" style={{flex: 'none'}}>
    <path d="M28 6 L52 48 H4 Z" fill={`${color}33`} stroke={color} strokeWidth="4" strokeLinejoin="round" />
    <path d="M28 20 V34" stroke={color} strokeWidth="5" strokeLinecap="round" />
    <circle cx="28" cy="41" r="3" fill={color} />
  </svg>
);

// Large insight card that slides up under the chart.
export const StatBanner = ({p, top = LAYOUT.insightTop, color = COLORS.orange, down = true, children, sub}) => (
  <div
    style={{
      position: 'absolute',
      left: 60,
      top,
      width: 960,
      height: 130,
      boxSizing: 'border-box',
      padding: '0 34px',
      display: 'flex',
      alignItems: 'center',
      gap: 26,
      borderRadius: 36,
      background: 'linear-gradient(135deg, rgba(30,41,59,0.95), rgba(22,32,58,0.92))',
      border: `2px solid ${color}88`,
      boxShadow: `0 0 40px ${color}33, 0 20px 50px rgba(0,0,0,0.45)`,
      fontFamily: FONT,
      opacity: p,
      transform: `translateY(${(1 - p) * 40}px)`,
    }}
  >
    <TrendBadge color={color} down={down} />
    <div>
      <div style={{fontSize: 52, fontWeight: 800, color: COLORS.text, lineHeight: 1.1}}>{children}</div>
      {sub ? <div style={{fontSize: 30, fontWeight: 500, color: COLORS.muted, marginTop: 6}}>{sub}</div> : null}
    </div>
  </div>
);
