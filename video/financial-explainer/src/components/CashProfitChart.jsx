import React from 'react';
import {COLORS, FONT} from '../theme.js';
import {CASH, MONTHS} from '../data.js';
import {clamp01, fmt$} from '../utils.js';
import {GridLines, MonthLabels, Pill, TrendArrow, pillHeight} from './ChartParts.jsx';

// Chart 2: cash-in proxy bars (blue) + profit proxy line (orange).
//   barP[i] / labelP[i]  bar growth and value-label opacity
//   barOpacity           fades the bars behind the profit line
//   lineP                0..1 line draw       callouts  [{index, text, finalText, p}]
//   glow                 outline on `focus` bar  dim  fade non-focus bars
//   trendP               decline arrow on the cash-in bars
export const CashProfitChart = ({
  compact = false,
  barP,
  labelP = [],
  focus = 2,
  glow = 0,
  dim = 0,
  barOpacity = 1,
  lineP = 0,
  callouts = [],
  calloutP = 0,
  calloutText = '',
  calloutFinal = '',
  trendP = 0,
  frame = 0,
}) => {
  const W = compact ? 436 : 912;
  const H = compact ? 300 : 720;
  const m = compact ? {l: 14, r: 14, t: 24, b: 48} : {l: 84, r: 10, t: 100, b: 56};
  const plotW = W - m.l - m.r;
  const plotH = H - m.t - m.b;
  const MAX = 5000;
  const slot = plotW / 6;
  const bw = slot * (compact ? 0.62 : 0.6);
  const y = (v) => m.t + plotH * (1 - v / MAX);
  const cx = (i) => m.l + slot * (i + 0.5);
  const ticks = compact ? [0, 2500, 5000] : [0, 1000, 2000, 3000, 4000, 5000];
  const tickLabels = compact ? null : ['$0', '$1K', '$2K', '$3K', '$4K', '$5K'];
  const pulse = 0.82 + 0.18 * Math.sin(frame / 5);

  // Profit polyline + normalised cumulative length of each vertex (so the glowing
  // points pop in exactly as the drawn line reaches them).
  const pts = CASH.map((c, i) => [cx(i), y(c.profit)]);
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  const frac = pts.map((_, i) => seg.slice(0, i).reduce((a, b) => a + b, 0) / total);
  const lineD = pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' ');

  const peak = CASH[focus].cashIn;
  const last = CASH[5].cashIn;
  const pH = pillHeight();
  const r = compact ? 7 : 12;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display: 'block', overflow: 'visible'}}>
      <GridLines ticks={ticks} y={y} x0={m.l} x1={W - m.r} labels={tickLabels} />

      {CASH.map((c, i) => {
        const p = barP[i];
        const top = y(c.cashIn * p);
        const base = y(0);
        const opacity = (i === focus ? 1 : 1 - 0.62 * dim) * barOpacity;
        return (
          <g key={c.month} opacity={opacity}>
            <clipPath id={`cash-clip-${compact ? 'c' : 'f'}-${i}`}>
              <rect x={cx(i) - bw / 2} y={top} width={bw} height={Math.max(0, base - top) + 24} rx={compact ? 8 : 12} />
            </clipPath>
            <rect
              clipPath={`url(#cash-clip-${compact ? 'c' : 'f'}-${i})`}
              x={cx(i) - bw / 2}
              y={top}
              width={bw}
              height={Math.max(0, base - top)}
              fill={COLORS.blue}
            />
          </g>
        );
      })}

      {!compact
        ? CASH.map((c, i) =>
            labelP[i] > 0 ? (
              <text
                key={c.month}
                x={cx(i)}
                y={y(c.cashIn * barP[i]) - 16}
                textAnchor="middle"
                fontSize={26}
                fontWeight={800}
                fill={COLORS.text}
                fontFamily={FONT}
                opacity={labelP[i] * (i === focus ? 1 - calloutP : 1) * (1 - 0.5 * dim)}
              >
                {fmt$(c.cashIn)}
              </text>
            ) : null,
          )
        : null}

      {glow > 0 ? (
        <rect
          x={cx(focus) - bw / 2 - 9}
          y={y(peak) - 9}
          width={bw + 18}
          height={y(0) - y(peak) + 18}
          rx={compact ? 12 : 18}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={compact ? 3 : 4}
          opacity={glow * pulse}
          style={{filter: 'drop-shadow(0 0 14px rgba(90,190,255,0.95))'}}
        />
      ) : null}

      {!compact && calloutP > 0 ? (
        <g>
          <line
            x1={cx(focus)}
            x2={cx(focus)}
            y1={8 + pH}
            y2={y(peak) - 12}
            stroke="#FFFFFF"
            strokeWidth={2.5}
            strokeDasharray="6 6"
            opacity={calloutP * 0.8}
          />
          <Pill x={cx(focus)} y={8} text={calloutText} finalText={calloutFinal} p={calloutP} maxX={W} />
        </g>
      ) : null}

      {!compact ? (
        <TrendArrow
          x0={cx(focus) + bw / 2 + 20}
          y0={y(peak) + 6}
          x1={cx(5)}
          y1={y(last) - 62}
          p={trendP}
        />
      ) : null}

      {/* Profit line + glowing points */}
      {lineP > 0 ? (
        <g>
          <path
            d={lineD}
            pathLength={1}
            fill="none"
            stroke={COLORS.orange}
            strokeWidth={compact ? 5 : 8}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1 1"
            strokeDashoffset={1 - lineP}
            style={{filter: 'drop-shadow(0 0 12px rgba(255,128,16,0.9))'}}
          />
          {pts.map((p, i) => {
            const a = clamp01((lineP - frac[i] + 0.03) / 0.05);
            if (a <= 0) return null;
            return (
              <g key={i} transform={`translate(${p[0]} ${p[1]})`} opacity={a}>
                <circle r={(r + 9 + 5 * Math.sin(frame / 4 + i)) * a} fill={COLORS.orange} opacity={0.28} />
                <circle
                  r={r * (0.6 + 0.4 * a)}
                  fill={COLORS.orange}
                  stroke="#FFFFFF"
                  strokeWidth={compact ? 2.5 : 4}
                  style={{filter: 'drop-shadow(0 0 10px rgba(255,128,16,1))'}}
                />
              </g>
            );
          })}
        </g>
      ) : null}

      {/* Callouts that point at profit values */}
      {!compact
        ? callouts.map((c) =>
            c.p > 0 ? (
              <g key={c.index}>
                <line
                  x1={cx(c.index)}
                  x2={cx(c.index)}
                  y1={Math.max(8, y(CASH[c.index].cashIn) - 76) + pH}
                  y2={y(CASH[c.index].profit) - 22}
                  stroke="#FFFFFF"
                  strokeWidth={2.5}
                  strokeDasharray="6 6"
                  opacity={c.p * 0.85}
                />
                <Pill
                  x={cx(c.index)}
                  y={Math.max(8, y(CASH[c.index].cashIn) - 76)}
                  text={c.text}
                  finalText={c.finalText}
                  p={c.p}
                  maxX={W}
                  color={COLORS.orange}
                />
              </g>
            ) : null,
          )
        : null}

      <MonthLabels months={MONTHS} cx={cx} y={H - 14} focus={focus} glow={glow} fs={compact ? 22 : 28} />
    </svg>
  );
};

// Exposed so scenes can time callouts to the drawn line.
export const PROFIT_FRAC_MARCH = 0.39;
