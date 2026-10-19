import React from 'react';
import {COLORS, FONT} from '../theme.js';
import {EXPENSES, MONTHS, expenseTotal} from '../data.js';
import {fmt$} from '../utils.js';
import {GridLines, MonthLabels, Pill, TrendArrow, pillHeight} from './ChartParts.jsx';

const SEGMENTS = [
  ['fees', COLORS.blue],
  ['shipping', COLORS.orange],
  ['refunds', COLORS.green],
];

// Chart 1: stacked monthly expenses (fees / shipping / refunds).
//   barP[i]   0..1 growth of each bar        labelP[i] 0..1 total label opacity
//   glow      0..1 outline on `focus` bar    dim       0..1 fade non-kept bars
//   keep      bar indexes that stay lit while dimmed
//   calloutP  0..1 peak pill                 trendP    0..1 decline arrow
export const StackedBarChart = ({
  compact = false,
  barP,
  labelP = [],
  focus = 2,
  keep = [],
  glow = 0,
  dim = 0,
  calloutP = 0,
  calloutText = '',
  calloutFinal = '',
  trendP = 0,
  frame = 0,
  uid = 'exp',
}) => {
  const W = compact ? 436 : 912;
  const H = compact ? 300 : 720;
  const m = compact ? {l: 14, r: 14, t: 24, b: 48} : {l: 84, r: 10, t: 100, b: 56};
  const plotW = W - m.l - m.r;
  const plotH = H - m.t - m.b;
  const MAX = 2000;
  const slot = plotW / 6;
  const bw = slot * (compact ? 0.62 : 0.6);
  const y = (v) => m.t + plotH * (1 - v / MAX);
  const cx = (i) => m.l + slot * (i + 0.5);
  const ticks = compact ? [0, 1000, 2000] : [0, 500, 1000, 1500, 2000];
  const tickLabels = compact ? null : ['$0', '$500', '$1K', '$1.5K', '$2K'];
  const pulse = 0.82 + 0.18 * Math.sin(frame / 5);

  const peakTotal = expenseTotal(EXPENSES[focus]);
  const lastTotal = expenseTotal(EXPENSES[5]);
  const pH = pillHeight();

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display: 'block', overflow: 'visible'}}>
      <GridLines ticks={ticks} y={y} x0={m.l} x1={W - m.r} labels={tickLabels} />

      {EXPENSES.map((e, i) => {
        const p = barP[i];
        const total = expenseTotal(e);
        const top = y(total * p);
        const base = y(0);
        const lit = i === focus || keep.includes(i);
        const opacity = lit ? 1 : 1 - 0.62 * dim;
        let yy = base;
        return (
          <g key={e.month} opacity={opacity}>
            <clipPath id={`${uid}-clip-${i}`}>
              <rect x={cx(i) - bw / 2} y={top} width={bw} height={Math.max(0, base - top) + 24} rx={compact ? 8 : 12} />
            </clipPath>
            <g clipPath={`url(#${uid}-clip-${i})`}>
              {SEGMENTS.map(([k, color]) => {
                const h = (e[k] / MAX) * plotH * p;
                yy -= h;
                return (
                  <rect
                    key={k}
                    x={cx(i) - bw / 2}
                    y={yy}
                    width={bw}
                    height={h}
                    fill={color}
                    stroke={COLORS.bgDeep}
                    strokeWidth={1.5}
                  />
                );
              })}
            </g>
            {!compact && labelP[i] > 0 ? (
              <text
                x={cx(i)}
                y={top - 16}
                textAnchor="middle"
                fontSize={26}
                fontWeight={800}
                fill={COLORS.text}
                fontFamily={FONT}
                opacity={labelP[i] * (i === focus ? 1 - calloutP : 1)}
              >
                {fmt$(total)}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* Glowing outline on the peak (March) bar */}
      {glow > 0 ? (
        <rect
          x={cx(focus) - bw / 2 - 9}
          y={y(peakTotal) - 9}
          width={bw + 18}
          height={y(0) - y(peakTotal) + 18}
          rx={compact ? 12 : 18}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={compact ? 3 : 4}
          opacity={glow * pulse}
          style={{filter: 'drop-shadow(0 0 14px rgba(255,170,70,0.95))'}}
        />
      ) : null}

      {!compact && calloutP > 0 ? (
        <g>
          <line
            x1={cx(focus)}
            x2={cx(focus)}
            y1={8 + pH}
            y2={y(peakTotal) - 12}
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
          y0={y(peakTotal) + 6}
          x1={cx(5)}
          y1={y(lastTotal) - 62}
          p={trendP}
        />
      ) : null}

      <MonthLabels months={MONTHS} cx={cx} y={H - 14} focus={focus} glow={glow} fs={compact ? 22 : 28} />
    </svg>
  );
};
