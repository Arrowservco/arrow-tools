import React from 'react';
import {useCurrentFrame} from 'remotion';
import {COLORS, FONT} from '../theme.js';
import {CASH, MONTHS, PEAK, STATS} from '../data.js';
import {easeInOutSin, fmt$, prog} from '../utils.js';
import {T} from '../timeline.js';
import {SceneShell} from '../components/SceneShell.jsx';
import {CautionIcon, Card, LAYOUT, Legend, SceneHeader, StatBanner} from '../components/Layout.jsx';
import {CashProfitChart, PROFIT_FRAC_MARCH} from '../components/CashProfitChart.jsx';

// Frame at which the eased line draw reaches March.
const marchFrame = (t) => t.lineStart + (Math.acos(1 - 2 * PROFIT_FRAC_MARCH) / Math.PI) * t.lineDur;

// Scene 4 (18-25 s): same chart as Scene 3; bars recede, orange profit line draws.
export const Scene4Profit = () => {
  const frame = useCurrentFrame();
  const t = T.profit;
  const barP = MONTHS.map(() => 1);
  const labelP = MONTHS.map(() => 1 - prog(frame, 0, 12));
  const barOpacity = 1 - 0.55 * prog(frame, 0, 20);
  const glow = 1 - prog(frame, 0, 14);
  const lineP = prog(frame, t.lineStart, t.lineDur, easeInOutSin);
  const marchP = prog(frame, marchFrame(t) - 2, 14);
  const juneP = prog(frame, t.lineStart + t.lineDur - 2, 14);
  const bannerP = prog(frame, t.bannerAt, 16);
  const pct = Math.round(STATS.profitDropPct * prog(frame, t.bannerAt + 4, 36));
  const cautionP = prog(frame, t.cautionAt, 16);
  const cautionPulse = 0.6 + 0.4 * Math.sin(frame / 6);

  const march = CASH[PEAK].profit;
  const june = CASH[5].profit;

  return (
    <SceneShell fadeIn={false}>
      <SceneHeader kicker="03 · Profit & Payoff Capacity" title="Profit proxy" sub="Net profit as potential financing payoff capacity" />
      <Card>
        <Legend
          items={[
            {label: 'Cash-in proxy', color: COLORS.blue},
            {label: 'Profit proxy', color: COLORS.orange, line: true},
          ]}
        />
        <CashProfitChart
          barP={barP}
          labelP={labelP}
          focus={PEAK}
          glow={glow}
          barOpacity={barOpacity}
          lineP={lineP}
          callouts={[
            {index: PEAK, text: `March: ~${fmt$(march)}`, finalText: `March: ~${fmt$(march)}`, p: marchP},
            {index: 5, text: `June: ~${fmt$(june)}`, finalText: `June: ~${fmt$(june)}`, p: juneP},
          ]}
          frame={frame}
        />
      </Card>
      <StatBanner p={bannerP} sub={`~${fmt$(march)} in March → ~${fmt$(june)} in June`}>
        Profit Proxy Declines <span style={{color: COLORS.orange}}>~{pct}%</span>
      </StatBanner>
      <div
        style={{
          position: 'absolute',
          left: 60,
          width: 960,
          top: LAYOUT.insightTop + 150,
          height: 88,
          boxSizing: 'border-box',
          padding: '0 30px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          borderRadius: 28,
          background: 'rgba(251,191,36,0.10)',
          border: `2px solid rgba(251,191,36,${0.35 + 0.35 * cautionPulse})`,
          boxShadow: `0 0 ${18 + 16 * cautionPulse}px rgba(251,191,36,0.25)`,
          fontFamily: FONT,
          fontSize: 34,
          fontWeight: 800,
          color: COLORS.amber,
          opacity: cautionP,
          transform: `translateY(${(1 - cautionP) * 30}px)`,
        }}
      >
        <CautionIcon size={50} />
        Lower Profit = Reduced Payoff Capacity
      </div>
    </SceneShell>
  );
};
