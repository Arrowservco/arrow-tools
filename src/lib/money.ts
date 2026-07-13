/**
 * Money utilities. All financial math in BidLens is done in integer cents
 * to avoid floating-point drift. Rates (tax, fees, promotion) are decimal
 * fractions (0.15 = 15%).
 */

export type Cents = number;

/** Round half away from zero to the nearest integer cent. */
export function roundCents(value: number): Cents {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Convert a dollar amount (possibly fractional) to integer cents. */
export function dollarsToCents(dollars: number): Cents {
  return roundCents(dollars * 100);
}

export function centsToDollars(cents: Cents): number {
  return cents / 100;
}

/** Multiply a cent amount by a decimal rate, rounding to the cent. */
export function applyRate(cents: Cents, rate: number): Cents {
  return roundCents(cents * rate);
}

/** Format cents as $X,XXX.XX (negative amounts get a leading minus). */
export function formatCents(cents: Cents, opts?: { hideCentsIfWhole?: boolean }): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  const dollarStr = dollars.toLocaleString("en-US");
  const body =
    opts?.hideCentsIfWhole && rem === 0
      ? `$${dollarStr}`
      : `$${dollarStr}.${rem.toString().padStart(2, "0")}`;
  return negative ? `-${body}` : body;
}

/** Format a decimal fraction as a percentage string, e.g. 0.155 -> "15.5%". */
export function formatRate(rate: number, digits = 1): string {
  return `${(rate * 100).toFixed(digits).replace(/\.0+$/, "")}%`;
}

/** Floor cents down to a whole dollar amount (still expressed in cents). */
export function floorToWholeDollar(cents: Cents): Cents {
  return Math.floor(cents / 100) * 100;
}

/** Clamp helper. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
