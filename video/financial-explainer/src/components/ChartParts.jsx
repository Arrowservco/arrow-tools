import React from 'react';
import {COLORS, FONT} from '../theme.js';

export const PILL_FS = 30;
export const pillHeight = (fs = PILL_FS) => fs + 26;

// Rounded callout label inside an SVG chart. `finalText` fixes the width so a
// counting number does not make the pill jitter.
export const Pill = ({x, y, text, finalText, p, maxX, color = COLORS.orange, fs = PILL_FS}) => {
  const w = (finalText || text).length * fs * 0.58 + 52;
  const h = pillHeight(fs);
  const cx = Math.min(Math.max(x, w / 2 + 4), maxX - w / 2 - 4);
  return (
    <g opacity={p} transform={`translate(${cx} ${y + (1 - p) * 12})`}>
      <rect
        x={-w / 2}
        y={0}
        width={w}
        height={h}
        rx={h / 2}
        fill={color}
        style={{filter: `drop-shadow(0 0 16px ${color}cc)`}}
      />
      <text
        x={0}
        y={h / 2 + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fs}
        fontWeight={800}
        fill={COLORS.ink}
        fontFamily={FONT}
      >
        {text}
      </text>
    </g>
  );
};

// Curved "decline" arrow that runs right from (x0,y0), then turns down into
// (x1,y1). `p` (0..1) draws it; the arrowhead pops in at the end.
export const TrendArrow = ({x0, y0, x1, y1, p, color = COLORS.orange}) => {
  if (p <= 0) return null;
  const head = Math.max(0, Math.min(1, (p - 0.88) / 0.12));
  return (
    <g style={{filter: `drop-shadow(0 0 10px ${color}aa)`}}>
      <path
        d={`M ${x0} ${y0} Q ${x1} ${y0} ${x1} ${y1}`}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray="1 1"
        strokeDashoffset={1 - p}
      />
      <polygon
        points={`${x1 - 18},${y1 - 26} ${x1 + 18},${y1 - 26} ${x1},${y1 + 6}`}
        fill={color}
        opacity={head}
        transform={`translate(0 ${(1 - head) * -10})`}
      />
    </g>
  );
};

export const GridLines = ({ticks, y, x0, x1, labels, labelFs = 24}) => (
  <g>
    {ticks.map((v, i) => (
      <g key={v}>
        <line x1={x0} x2={x1} y1={y(v)} y2={y(v)} stroke={COLORS.grid} strokeWidth={2} />
        {labels ? (
          <text
            x={x0 - 14}
            y={y(v)}
            textAnchor="end"
            dominantBaseline="central"
            fontSize={labelFs}
            fill={COLORS.muted}
            fontFamily={FONT}
            fontWeight={600}
          >
            {labels[i]}
          </text>
        ) : null}
      </g>
    ))}
  </g>
);

export const MonthLabels = ({months, cx, y, focus, fs, glow = 0}) => (
  <g>
    {months.map((m, i) => (
      <text
        key={m}
        x={cx(i)}
        y={y}
        textAnchor="middle"
        fontSize={fs}
        fontWeight={i === focus && glow > 0 ? 800 : 600}
        fill={i === focus && glow > 0 ? COLORS.text : COLORS.muted}
        fontFamily={FONT}
      >
        {m}
      </text>
    ))}
  </g>
);
