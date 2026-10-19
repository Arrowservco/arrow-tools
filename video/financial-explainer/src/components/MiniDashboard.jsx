import React from 'react';
import {useCurrentFrame} from 'remotion';
import {COLORS, FONT} from '../theme.js';
import {MONTHS} from '../data.js';
import {easeInOutSin, prog} from '../utils.js';
import {Card} from './Layout.jsx';
import {StackedBarChart} from './StackedBarChart.jsx';
import {CashProfitChart} from './CashProfitChart.jsx';

const CardTitle = ({children, color}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 12, height: 44, paddingLeft: 6, fontFamily: FONT, fontSize: 30, fontWeight: 800, color: COLORS.text}}>
    <span style={{width: 14, height: 14, borderRadius: 7, background: color, boxShadow: `0 0 10px ${color}`}} />
    {children}
  </div>
);

// Two compact "split-screen" dashboard cards (expenses | cash-in + profit),
// used as the intro teaser and the closing summary. `start` = local frame at
// which the bars begin to rise.
export const MiniDashboard = ({top, start = 0, opacity = 1}) => {
  const frame = useCurrentFrame();
  const expBar = MONTHS.map((_, i) => prog(frame, start + i * 5, 22));
  const cashBar = MONTHS.map((_, i) => prog(frame, start + 4 + i * 5, 22));
  const line = prog(frame, start + 36, 36, easeInOutSin);
  const glow = prog(frame, start + 62, 14);
  return (
    <div style={{opacity}}>
      <Card top={top} left={60} width={468} height={400} pad={16}>
        <CardTitle color={COLORS.orange}>Expenses</CardTitle>
        <StackedBarChart compact uid="mini" barP={expBar} glow={glow} frame={frame} />
      </Card>
      <Card top={top} left={552} width={468} height={400} pad={16}>
        <CardTitle color={COLORS.blue}>Cash-In &amp; Profit</CardTitle>
        <CashProfitChart compact barP={cashBar} barOpacity={0.6} lineP={line} glow={glow} frame={frame} />
      </Card>
    </div>
  );
};
