# BidLens — Comprehensive Build Prompt (Anthropic-only, v2)

> Paste everything below into a fresh coding session (Claude Code, or any capable
> agent). It is self-contained. It builds the complete working app from scratch with
> **Anthropic as the single AI provider**. Deploy target is Netlify.

---

You are a senior full-stack TypeScript engineer, mobile UX designer, and resale-profitability
analyst. Build a complete, working, mobile-first Progressive Web App named:

**BidLens** — subtitle: **Mac.bid Profitability Evaluator**

Do NOT build a marketing page. Build the actual functional application. Do not ask routine
implementation questions — make sensible engineering decisions, document them, and build the
MVP end to end. Only stop for information that makes implementation impossible.

The central promise: **"Upload one Mac.bid screenshot and receive a defensible Strong Buy, Buy
Below, Borderline, Pass, or Insufficient Evidence recommendation."**

## 0. HARD REQUIREMENTS THAT MUST NOT REGRESS

1. **Anthropic is the ONLY AI provider.** There is no OpenAI, no Gemini, no provider dropdown.
   The single key is `ANTHROPIC_API_KEY`. Settings shows one provider ("Anthropic"), one key
   field, one model field, and a Test Connection button. Do not build a multi-provider
   abstraction with unused branches.
2. **The app must fully work in Demo mode with NO key**, running the entire workflow on the
   bundled Zircon fixture. Demo must never call the network.
3. **All financial math is deterministic TypeScript** with unit tests. The AI model NEVER
   computes fees, profit, ROI, maximum bid, or the verdict. The model only (a) reads the
   screenshot into structured JSON and (b) does market/shipping research. Everything numeric is
   computed by pure functions.
4. **The AI key handshake must actually work end to end on the deployed host.** Concretely:
   - `Test Connection` calls Anthropic `client.models.list()` and reports a clear result.
   - A key typed in Settings is sent to the app's own server route, which forwards it to
     Anthropic. If the field is empty, the server falls back to the `ANTHROPIC_API_KEY`
     environment variable. Server env keys are never exposed to the browser.
   - The client must correctly parse BOTH success and error responses from every `/api` route
     (never call `res.json()` on a non-JSON error page; check `res.ok` and content-type first,
     surface the server's `message`). This is the bug that broke v1 — get it right.
   - Validate the key format client-side (`sk-ant-...`) and show a specific message; but the
     authoritative check is the server round-trip.
5. **Netlify deploy realities (build for these):**
   - Use `@netlify/plugin-nextjs` via `netlify.toml`. API routes run as Netlify Functions.
   - Netlify Functions have a request timeout (as low as ~10s on the free tier, ~26s typical).
     A single evaluation that chains 3 sequential model calls WILL exceed it. Therefore: run
     research as **one Anthropic call** (or at most two), keep `max_tokens` modest, and set a
     hard client-side timeout with a graceful "research unavailable, using conservative
     estimate" fallback that preserves all extracted/edited values. Never let a timeout wipe
     the user's inputs.
   - Do the deterministic evaluation and all recalculation **client-side** so editing
     assumptions never hits the network.

## 1. USER & LOCATION

Experienced eBay reseller sourcing from Mac.bid. Optimize for fast mobile use, one screenshot as
the only required input, conservative estimates, accurate max-bid math, clear separation of
auction vs Instant Win, visible uncertainty, editable assumptions, avoiding dead inventory, and
converting cash back to cash quickly.

- Reseller location: Monroeville, PA — ZIP **15146**.
- Conservative shipping test destination: Los Angeles, CA — ZIP **90001**.

## 2. LOCKED BUSINESS RULES — profile "Eric Standard"

Mac.bid defaults:
- Buyer's premium: **15%** of hammer bid
- Lot fee: **$3.00**
- PA sales tax: **6%**
- Transfer fee (Monroeville): **$0**
- Purchase protection: **optional**; amount extracted from the screenshot when visible;
  protection toggle state read from the screenshot; never auto-enable it
- Taxable base (configurable): hammer + premium + lot fee + protection + transfer fee
- If the screenshot shows an all-in total, display screenshot total vs calculated total, the
  difference, and warn if they differ by more than $0.50; user chooses which controls
- Instant Win is evaluated SEPARATELY from the auction bid

eBay seller defaults (no store subscription; ignore Top Rated Plus):
- Buyer-paid **calculated** shipping (never assume free shipping)
- Origin 15146 → conservative destination 90001
- Final value fee: configurable category table with a clearly-labeled fallback (~13.35%) when
  category is uncertain; do NOT hard-code one permanent rate
- Per-order fee: configurable (default $0.40)
- Promoted listings: default **5%**, quick buttons **0% / 2% / 5% / custom**; show net profit at
  each rate
- Fees apply to (item price + buyer-paid shipping)

Profitability thresholds (the CONSERVATIVE scenario controls the verdict; both floors must pass):
- Minimum net profit: **$20**
- Minimum expected ROI: **75%**
- Minimum conservative ROI: **50%**
- Maximum hammer bid is solved BACKWARD from these requirements

Preferred conditions: Like New, Open Box. Other conditions allowed but carry higher risk and
lower confidence.

## 3. TECH STACK

Next.js (App Router) · React · TypeScript strict · Tailwind CSS · shadcn/ui-style components ·
Zod (runtime validation of every AI response) · React Hook Form (settings & editable
assumptions) · IndexedDB via Dexie (local history) · Vitest (unit) · Playwright (one e2e flow) ·
PWA manifest + service worker (installable, Android-portrait-first) · official
`@anthropic-ai/sdk`.

Runs with `npm install` && `npm run dev`. Also provide `npm run test`, `npm run test:e2e`,
`npm run build`, `npm run lint`, `npm run typecheck`. Resolve ALL TypeScript/lint/test/build
errors before considering it done. Use integer **cents** for all money; never rely on floats.

## 4. ANTHROPIC INTEGRATION (the only provider)

Single provider module using `@anthropic-ai/sdk`. Model default **`claude-opus-4-8`** (editable).
Use the vision API for extraction (base64 image block) and the `web_search` server tool for
research when the "Enable web research" toggle is on. Store all prompts in dedicated files.

Settings screen (one provider only):
- API key field (password input), with a "session-only" storage model: keep the key in
  `sessionStorage`, send it only to this app's own `/api` routes. Never store keys in IndexedDB,
  localStorage, logs, or analytics. Label clearly that it clears when the browser session ends,
  and that leaving it blank uses the server `ANTHROPIC_API_KEY`.
- Model field, Enable-web-research toggle, max research calls (default keep LOW — 1 or 2 — for
  Netlify timeout safety), Test Connection button, Clear key button, connection status.
- Env var support: `ANTHROPIC_API_KEY` (AI) and optional `BIDLENS_API_TOKEN` (gates the public
  REST API; same-origin browser calls exempt; unset = open for local dev).

Prompts must instruct the model: return only schema-valid JSON; null for anything not seen;
never fabricate prices/sold-status/URLs/model numbers; distinguish sold evidence from active
asking prices; include source URLs; prefer conservative estimates; NEVER do financial
arithmetic or produce a bid ceiling — the app's calculator is authoritative.

## 5. SCREENSHOT INPUT (home screen)

Large "Analyze Mac.bid Screenshot" button; file picker; camera capture; drag-and-drop; clipboard
paste; **Demo Screenshot** button; recent evaluations list. Accept PNG/JPEG/WebP; validate type
and size (≤8 MB); show a preview before analysis. Bundle the demo screenshot at
`public/demo/macbid-zircon.png`.

Demo fixture (Zircon SuperScan ID One Touch Stud Finder): Open Box; current bid $1; Instant Win
$56; est. retail $70; optional protection $7 (toggle off); auction + Instant Win countdowns. If
the physical image is unavailable, generate a faithful mock screenshot AND provide structured
demo values; the upload workflow must stay fully functional.

## 6. EXTRACTION → strict Zod schema

Return `ConfidenceValue<T> = { value: T|null; confidence: number; sourceText?: string|null }`
for every critical field. Extract product (title, brand, modelNumber, upc, mpn, categoryGuess,
condition enum [new|like_new|open_box|used|damaged|parts_only|unknown], includedItems,
possiblyMissingItems), auction (currentBid, bidCount, timeRemainingText), instantWin (available,
price, timeRemainingText), macBid (displayedRetailPrice, displayedAllInTotal, buyerPremiumRate,
lotFee, taxAmount, salesTaxRate, pickupLocation, transferEligible, transferFee), protection
(available, price, enabledInScreenshot), plus warnings[], uncertainFields[], overallConfidence.

Rules: never guess missing numbers; separate current auction bid from Instant Win; treat the
shield amount as optional protection (not a required fee); flag ambiguous model numbers; don't
infer pickup location unless visible; confidence on every critical field.

Then a **review screen** with confidence badges and inline editing of: title, brand, model,
condition, current bid, Instant Win, retail, protection amount + on/off, pickup location,
transfer fee, buyer's premium, lot fee, sales tax, displayed total. Primary button "Looks Right,
Research Product"; secondary "Edit Details". Run a cheap preliminary math screen before research
(e.g. "Auction: Worth Researching / Instant Win: Preliminary Pass").

## 7. PRODUCT IDENTITY & MARKET RESEARCH

Resolve identity by priority: UPC → MPN → exact model → brand+model phrase → title → image
similarity → category/specs. Return exact/probable/possible/ambiguous/no_reliable_match; when
ambiguous show up to 3 candidates (name, brand, model, match confidence, why, differences,
select). Never return Strong Buy when identity confidence < 70% (that becomes "Confirm Product").

Research uses the Anthropic web_search tool (no eBay API in v1 — document that historical sold
data is not guaranteed). Build multiple queries (brand+model, +open box, +sold, +used,
+accessories, specs/dimensions). Classify each comparable and HARD-REJECT parts-only, empty box,
manual/battery/charger only, replacement accessory, broken/for-repair, different model, different
quantity, new-kit-vs-open-box, international/non-comparable shipping, local-pickup-only. Never
call active asks "sold". Compute median/mean/p25/p75, outlier-adjusted bounds, quick/expected/
patient prices, active competition, evidence grade (strong sold / partial sold / active-only /
insufficient), market confidence. Fallback when sold evidence is weak: resale = min(75% of median
active ask, 65% of verified retail, conservative category estimate); label PROVISIONAL; never
Strong Buy from active listings alone.

## 8. SHIPPING (buyer-paid calculated, 15146 → 90001)

Category bands (small lightweight / small dense / medium / large / oversized / freight-like) with
buyer charge, expected label, conservative label, packaging, dimensional-weight risk. Research or
estimate item/packaged weight and dimensions (priority: manufacturer spec → product spec →
comparable listing → category default → manual override). Add buyer-paid shipping to revenue,
subtract label cost, include shipping in the eBay fee base, include packaging. All values
editable; display every assumption. No live carrier API required.

## 9. DETERMINISTIC ENGINES (pure functions + unit tests)

- **Mac.bid cost:** hammer + premium + lotFee + optionalProtection + transferFee + salesTax
  (configurable taxable base); displayed-total override with >$0.50 discrepancy warning.
- **eBay fees:** FVF + per-order + promotion + optional buffer, on (item + buyer shipping).
- **Profitability:** revenue = item + buyerShip; expenses = FVF + perOrder + promo + label +
  packaging + returnReserve + accessoryAllowance; net = revenue − expenses − acquisition; ROI =
  net/acquisition; total-cash ROI = net/(acquisition + label + packaging). Three scenarios —
  conservative (quick-sale, higher label, higher reserve, accessory allowance when uncertain,
  full promotion), expected, best-reasonable. Conservative controls the verdict.
- **Maximum bid:** binary-search solver (fees/tax depend on the bid) exact to the cent, floored
  to whole dollars; profit ceiling, ROI ceiling, recommended = lowest, protected max bid, max
  Instant Win price, bid room, absolute cap. Never recommend a bid violating a floor; handle
  zero-cost, negative-profit, protection-on, Instant Win separately.
- **Cash Velocity 0–100** from transparent weighted factors (sold count, recency, frequency,
  competition, brand, seasonality, spread, shipping difficulty, condition, testing difficulty,
  compatibility, return risk, cash tied up). Labels: 90+ Very Fast / 75–89 Fast / 60–74 Moderate
  / 40–59 Slow / <40 Dead Inventory Risk. Low-confidence flag when evidence is thin.
- **Risk:** deterministic flags (identity, condition, completeness, shipping, return, market
  evidence, price volatility, counterfeit) with Low/Moderate/High/Very High overall.
- **Verdict engine:** insufficient_evidence → confirm_product (<70% identity) → pass (fails
  floor/ROI or price>ceiling) → strong_buy (high identity + strong sold evidence + velocity ≥60 +
  material bid room + no high risk + margins not thin) → borderline → buy_below. Low confidence
  can NEVER be Strong Buy.

Unit-test every engine including the exact demo case ($1 bid, 15%/$3/6%, protection off then on
at $7), promotion 0% vs 5%, negative profit, zero-cost guard, max-bid ceilings + protection +
Instant Win + whole-dollar rounding, and all six verdicts.

## 10. RESULTS SCREEN

Big verdict at top ("BUY BELOW $X"). Four metric cards: Conservative Net, Expected Net,
Conservative ROI, Cash Velocity. Then sections: Auction, Instant Win, Mac.bid Cost, Resale
Estimate, Buyer-Paid Shipping, eBay Fees, Promotion Scenarios, Purchase Protection (off/on
comparison of net, ROI, max bid), Maximum Bid, Market Evidence, Risk Analysis, Assumptions,
Sources. Editing ANY assumption recalculates instantly client-side with no AI re-run.

Auction card: current bid, current all-in cost, max bid, max protected bid, bid room, verdict,
time remaining. Instant Win card: price, all-in cost, expected net, conservative ROI, resale
needed to net $20, verdict, time remaining.

## 11. HISTORY (Dexie/IndexedDB, local only, no auth)

Save id, date, thumbnail, product, current bid, Instant Win, protection, recommendation, max bid,
estimated sale, conservative/expected net, conservative/expected ROI, velocity, confidence,
assumptions, evidence, user edits. Actions: open, duplicate, recalculate, delete, export JSON,
mark Won/Lost, enter actual purchase/sale/fees/shipping/days-to-sell/return outcome, compare
predicted vs actual.

## 12. PUBLIC REST API + OpenAPI

`POST /api/v1/evaluate` (multipart: image, provider-config JSON, profile JSON, overrides JSON) →
structured JSON (product identity, Mac.bid costs, resale w/ evidence grade, shipping, three-
scenario profitability, recommendation w/ max bid + protected bid + max Instant Win, velocity,
risks, assumptions, sources). Also `GET /api/v1/evaluations/:id`,
`POST /api/v1/evaluations/:id/recalculate` (deterministic, no AI),
`POST /api/v1/providers/test`, `GET /api/v1/health`. Auth external calls with
`Authorization: Bearer ${BIDLENS_API_TOKEN}`; same-origin browser calls exempt; token unset =
open. Generate `public/openapi.json`.

## 13. UI / ACCESSIBILITY / ERRORS

Mobile-first, clean financial dashboard: dark navy/slate/white with restrained green/red status
accents, large 44px+ touch targets, strong numeric hierarchy, skeleton loaders, toasts, useful
empty states, ARIA live region for analysis progress, keyboard nav, screen-reader labels, visible
focus, correct form labels, proper heading hierarchy. Bottom nav: Analyze / History / Settings.
Analysis progress stages: Reading Mac.bid details → Identifying product → Researching resale
market → Estimating shipping → Calculating maximum bid.

Handle every error with a clear message + retry and NEVER a blank screen or raw stack trace:
unsupported/oversized image, missing/invalid key, quota, timeout, extraction failure, schema
validation failure, product not identified, research unavailable, insufficient evidence,
calculation error, storage error. On any research failure, PRESERVE the user's extracted and
edited values.

## 14. NETLIFY DEPLOYMENT (must work first try)

Include `netlify.toml` with `@netlify/plugin-nextjs` (build `npm run build`, publish `.next`).
Ensure `/api/*` route handlers use the Node runtime and each returns JSON for BOTH success and
error paths with the correct content-type. Keep per-evaluation AI work within Netlify's function
timeout (see §0.5). Document: set `ANTHROPIC_API_KEY` (and optional `BIDLENS_API_TOKEN`) as
Netlify environment variables; the app also works with a session key entered in Settings; Demo
mode needs no key. Note the server-side evaluation store is ephemeral on Netlify (browser history
is the durable store).

## 15. DELIVERABLES

Create/modify real files (not snippets). Provide a complete README plus docs/architecture.md,
docs/calculation-rules.md, docs/anthropic-guide.md, docs/api.md. At the end give: a concise
implementation summary; exact run/test/build commands; required env vars; any features remaining
in Demo mode; and Anthropic-specific limitations (including that v1 does not guarantee complete
historical eBay sold data). Verify with a Playwright test that drives the demo end to end
(extraction values → separate Auction/Instant Win results → toggle $7 protection → change
promotion 5%→2% → recalculation → save → appears in History) and confirm production build passes.
