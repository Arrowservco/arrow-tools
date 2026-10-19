import React from 'react';
import {useCurrentFrame} from 'remotion';
import {COLORS} from '../theme.js';
import {EXPENSES, MONTHS, PEAK, STATS, expenseTotal} from '../data.js';
import {easeInOut, easeOut, easePop, fmt$, prog} from '../utils.js';
import {T} from '../timeline.js';
import {SceneShell} from '../components/SceneShell.jsx';
import {Card, Legend, SceneHeader, StatBanner} from '../components/Layout.jsx';
import {StackedBarChart} from '../components/StackedBarChart.jsx';

const peakTotal = expenseTotal(EXPENSES[PEAK]);

// Scene 2 (4-11 s): stacked expense bars rise Jan -> Jun, March glows, decline arrow.
export const Scene2Expenses = () => {
  const frame = useCurrentFrame();
  const t = T.expenses;
  const barP = MONTHS.map((_, i) => prog(frame, t.barStart(i), t.barDur, easePop));
  const labelP = MONTHS.map((_, i) => prog(frame, t.barStart(i) + t.barDur - 8, 12));
  const glow = prog(frame, t.peakAt, 14);
  const calloutP = prog(frame, t.peakAt + 2, 16);
  const count = prog(frame, t.peakAt + 2, 30);
  const dim = prog(frame, t.trendAt, 16);
  const trendP = prog(frame, t.trendAt, 30, easeInOut);
  const bannerP = prog(frame, t.bannerAt, 16);
  const pct = Math.round(STATS.expenseDropPct * prog(frame, t.bannerAt + 4, 36));

  return (
    <SceneShell>
      <SceneHeader kicker="01 · Expense Pressure" title="Where the money went" sub="Fees, shipping & refunds · Jan–Jun 2026" />
      <Card>
        <Legend
          items={[
            {label: 'Fees', color: COLORS.blue},
            {label: 'Shipping', color: COLORS.orange},
            {label: 'Refunds', color: COLORS.green},
          ]}
        />
        <StackedBarChart
          barP={barP}
          labelP={labelP}
          focus={PEAK}
          keep={[5]}
          glow={glow}
          dim={dim}
          calloutP={calloutP}
          calloutText={`Peak Expenses: ~${fmt$(peakTotal * count)}`}
          calloutFinal={`Peak Expenses: ~${fmt$(peakTotal)}`}
          trendP={trendP}
          frame={frame}
        />
      </Card>
      <StatBanner p={bannerP} sub="From March to June">
        Expenses Fall <span style={{color: COLORS.orange}}>~{pct}%</span>
      </StatBanner>
    </SceneShell>
  );
};
