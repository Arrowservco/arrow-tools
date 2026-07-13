# Calculation Rules

All money values are integer cents. Rates are decimal fractions (0.15 = 15%).
Rounding: half away from zero at each fee computation (`roundCents`).

## Eric Standard profile (locked defaults)

| Assumption | Default |
| --- | --- |
| Buyer's premium | 15% of hammer bid |
| Lot fee | $3.00 |
| PA sales tax | 6% |
| Taxable base | hammer + premium + lot fee + protection + transfer fee (each component configurable) |
| Transfer fee (Monroeville) | $0 |
| Purchase protection | optional; price read from screenshot |
| eBay store | none; Top Rated Plus ignored |
| Final value fee | category table (13.35% most categories) or clearly-labeled fallback 13.35% |
| Per-order fee | $0.40 |
| Promoted listings | 5% default; quick 0% / 2% / 5% / custom |
| Shipping | buyer-paid calculated, 15146 → 90001 |
| Floors | net ≥ $20; expected ROI ≥ 75%; conservative ROI ≥ 50% (conservative controls) |
| Bid rounding | recommended bids floored to whole dollars |

## Mac.bid acquisition

```
premium   = hammer × premiumRate
taxBase   = Σ(enabled components)
salesTax  = taxBase × taxRate
total     = hammer + premium + lotFee + protection + transferFee + salesTax
```
If the screenshot shows an all-in total, both totals are displayed with the difference; a
discrepancy > $0.50 raises a warning; the user chooses which total controls.

## eBay fees

`feeBase = itemPrice + buyerPaidShipping` (buyer-paid shipping is **not** fee-free).
`fees = feeBase×FVF + feeBase×promo + feeBase×intl + perOrder`, plus an optional buffer rate.

## Scenarios

| Input | Conservative | Expected | Best reasonable |
| --- | --- | --- | --- |
| Sale price | quick-sale (≈p25 of sold comps) | median of sold comps | patient (≈p75) |
| Shipping label | conservative band price | expected band price | expected band price |
| Return reserve | 1.5 × base rate | base rate | 0.6 × base rate |
| Accessory allowance | 10% of expected price (cap $25) when completeness uncertain | 0 | 0 |
| Promotion | selected rate | selected rate | selected rate |

Base return-reserve rate by condition: new 2%, like-new 4%, open-box 5%, used 8%,
damaged/parts 12%, unknown 8%.

```
revenue   = salePrice + buyerShipping
netProfit = revenue − sellingExpenses − acquisition
acqROI    = netProfit / acquisition            (null when acquisition = 0)
cashROI   = netProfit / (acquisition + label + packaging)
```

## Market statistics

- Hard exclusions (regex + flags): parts only, empty box, manual/battery/charger only,
  replacement accessory, broken/for repair/as-is, local pickup only, no price, different
  quantity, non-exact model with relevance < 0.6.
- Evidence grade: ≥3 sold comps = strong; ≥1 = partial; ≥2 active = active-only; else insufficient.
- Sold-comp pricing: quick = p25, expected = median, patient = p75 (outlier-clipped via 1.5×IQR bounds).
- <3 sold comps: expected is blended down with the fallback and marked provisional.
- No sold evidence: estimate = **min**(75% of median active ask, 65% of verified retail,
  category estimate), marked **provisional**; Strong Buy is impossible from active listings alone.

## Shipping bands (15146 → 90001, planning numbers, all editable)

| Band | Buyer charge | Expected label | Conservative label | Packaging |
| --- | --- | --- | --- | --- |
| Small lightweight (≤1 lb) | $6.99 | $5.50 | $7.50 | $1.00 |
| Small dense (1–3 lb) | $10.99 | $9.00 | $12.50 | $1.50 |
| Medium (3–10 lb) | $15.99 | $14.00 | $19.00 | $2.50 |
| Large (10–30 lb) | $29.99 | $26.00 | $36.00 | $4.00 |
| Oversized (30–70 lb) | $59.99 | $55.00 | $75.00 | $7.00 |
| Freight-like (70 lb+) | $175 | $175 | $250 | $15.00 |

Packed weight ≈ item weight + max(4 oz, 15%). Dimensional-weight risk flagged when
L×W×H/139 (lb) exceeds 1.25× scale weight.

## Maximum bid

Binary search over hammer cents (monotonic: every cost component is non-decreasing in the bid):

- **Profit ceiling**: largest bid with conservative net ≥ floor.
- **ROI ceiling**: largest bid with conservative ROI ≥ 50% AND expected ROI ≥ 75%.
- **Recommended** = min(both, absolute profile cap), floored to whole dollars.
- **Protected max bid**: same search with the protection price included.
- **Max Instant Win price**: same thresholds applied to a fixed price (Mac.bid fees apply to
  Instant Win too).
- Zero-cost acquisitions treat the ROI floor as satisfied when profit ≥ 0. Never recommends a
  bid that violates any threshold; returns null when no bid qualifies.

## Verdict engine (deterministic)

Order of evaluation:
1. `insufficient_evidence` — research failed, evidence grade insufficient, or critical values missing.
2. `confirm_product` — identity confidence < 70%. (Low confidence can never be Strong Buy.)
3. `pass` — profit floor, either ROI floor, or price > ceiling fails.
4. `strong_buy` — identity ≥ 85%, strong sold evidence, velocity ≥ 60, material bid room
   (≥ max($5, 25% of ceiling)), no high risk, margins not thin.
5. `borderline` — passes but near ceiling, thin margin (< floor+$5 or < ROI floor+10pts),
   high risk, slow velocity, or evidence not sold-based.
6. `buy_below` — everything else that passes.

## Cash Velocity (0–100, weights sum to 100)

sold evidence 20, recency 10, sales frequency 10, active competition 10, brand 10,
condition 10, seasonality 5, price spread 5, shipping difficulty 5, testing difficulty 5,
returns 4, compatibility 3, cash tied up 3.
Labels: 90+ Very Fast · 75–89 Fast · 60–74 Moderate · 40–59 Slow · <40 Dead Inventory Risk.
Low-confidence label whenever sold comps < 3 or evidence is active-only/insufficient.

## Risk flags (deterministic floor; AI may only add narrative)

identity (confidence/match level), condition (open-box electronics ⇒ moderate+),
completeness (missing accessories), shipping (band + dimensional risk), returns
(electronics ⇒ moderate), market evidence (grade + comp count), price volatility (IQR/median),
counterfeit (brand watchlist). Overall = worst flag, softened one step when it is the only
elevated flag.
