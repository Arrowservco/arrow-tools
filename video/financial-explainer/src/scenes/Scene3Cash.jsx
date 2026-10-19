import React from 'react';
import {useCurrentFrame} from 'remotion';
import {COLORS} from '../theme.js';
import {CASH, MONTHS, PEAK, STATS} from '../data.js';
import {easeInOut, easePop, fmt$, prog} from '../utils.js';
import {T} from '../timeline.js';
import {SceneShell} from '../components/SceneShell.jsx';
import {Card, Legend, SceneHeader, StatBanner} from '../components/Layout.jsx';
import {CashProfitChart} from '../components/CashProfitChart.jsx';

const peak = CASH[PEAK].cashIn;

// Scene 3 (11-18 s): cash-in proxy bars grow, March peak, decline after.
// Its right edge does not fade out: Scene 4 keeps the same chart on screen.
export const Scene3Cash = () => {
  const frame = useCurrentFrame();
  const t = T.cash;
  const barP = MONTHS.map((_, i) => prog(frame, t.barStart(i), t.barDur, easePop));
  const labelP = MONTHS.map((_, i) => prog(frame, t.barStart(i) + t.barDur - 8, 12));
  const glow = prog(frame, t.peakAt, 14);
  const calloutP = prog(frame, t.peakAt + 2, 16);
  const count = prog(frame, t.peakAt + 2, 30);
  const dim = prog(frame, t.trendAt, 16);
  const trendP = prog(frame, t.trendAt, 30, easeInOut);
  const bannerP = prog(frame, t.bannerAt, 16);

  return (
    <SceneShell fadeOut={false}>
      <SceneHeader kicker="02 · Cash Flow" title="Cash-in proxy" sub="Total credits by month · not verified payouts" color={COLORS.blue} />
      <Card>
        <Legend items={[{label: 'Cash-in proxy (total credits)', color: COLORS.blue}]} />
        <CashProfitChart
          barP={barP}
          labelP={labelP}
          focus={PEAK}
          glow={glow}
          dim={dim * 0.6}
          calloutP={calloutP}
          calloutText={`Peak Cash-In: ~${fmt$(peak * count)}`}
          calloutFinal={`Peak Cash-In: ~${fmt$(peak)}`}
          trendP={trendP}
          frame={frame}
        />
      </Card>
      <StatBanner p={bannerP} color={COLORS.blue} sub={`About ${STATS.cashDropPct}% below the March peak`}>
        Lower Cash-In After March
      </StatBanner>
    </SceneShell>
  );
};
