// Values are visually estimated from the dashboard screenshot and are
// APPROXIMATE. Cash-in = "total credits" proxy; profit = "payoff capacity"
// proxy. Neither is a verified eBay payout or cash available for debt.

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

// Chart 1 - monthly expense pressure. `fees + shipping + refunds` equals the
// approximate monthly totals read from the chart (1380, 1100, 1930, 1680,
// 850, 550). The per-category split is an ESTIMATE (the brief only gives
// totals, plus "shipping and fees are most of it"). Adjust to match the
// screenshot exactly; totals drive all labels and callouts.
export const EXPENSES = [
  {month: 'Jan', fees: 560, shipping: 740, refunds: 80},
  {month: 'Feb', fees: 450, shipping: 590, refunds: 60},
  {month: 'Mar', fees: 780, shipping: 1000, refunds: 150},
  {month: 'Apr', fees: 690, shipping: 910, refunds: 80},
  {month: 'May', fees: 350, shipping: 450, refunds: 50},
  {month: 'Jun', fees: 230, shipping: 290, refunds: 30},
];

// Chart 2 - cash-in proxy (total credits) vs profit proxy.
export const CASH = [
  {month: 'Jan', cashIn: 3150, profit: 1650},
  {month: 'Feb', cashIn: 2800, profit: 1650},
  {month: 'Mar', cashIn: 4600, profit: 2400},
  {month: 'Apr', cashIn: 3400, profit: 1550},
  {month: 'May', cashIn: 2000, profit: 1100},
  {month: 'Jun', cashIn: 1200, profit: 600},
];

export const expenseTotal = (e) => e.fees + e.shipping + e.refunds;

export const PEAK = 2; // March
export const LAST = 5; // June

const pctDrop = (from, to) => Math.round((1 - to / from) * 100);

export const STATS = {
  expenseDropPct: pctDrop(expenseTotal(EXPENSES[PEAK]), expenseTotal(EXPENSES[LAST])), // 72
  cashDropPct: pctDrop(CASH[PEAK].cashIn, CASH[LAST].cashIn), // 74
  profitDropPct: pctDrop(CASH[PEAK].profit, CASH[LAST].profit), // 75
};
