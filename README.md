# BidLens — Mac.bid Profitability Evaluator

Upload one Mac.bid screenshot and get a defensible **Strong Buy / Buy Below $X / Borderline / Pass /
Insufficient Evidence** recommendation, with a calculated maximum bid, separate Auction and Instant Win
evaluations, buyer-paid shipping modeling, a Cash Velocity score, and fully editable assumptions.

BidLens is a mobile-first Progressive Web App built for an experienced eBay reseller sourcing from
Mac.bid (Monroeville, PA / ZIP 15146; conservative shipping test route to Los Angeles / ZIP 90001).

**Core principle:** AI reads the screenshot and researches the market. **All financial arithmetic —
fees, profits, ROI, maximum bid, verdict — runs in deterministic, unit-tested TypeScript.** The model
never computes the numbers.

## Screens

- **Analyze (home):** large "Analyze Mac.bid Screenshot" button, camera / gallery / paste / drag-drop
  input, a keyless Demo mode, and recent evaluations.
- **Extraction review:** every extracted field with a confidence badge, inline editing, warnings, and a
  cheap preliminary math screen ("Auction: Worth Researching / Instant Win: Preliminary Pass").
- **Product match:** up to three candidates when identity is ambiguous.
- **Results:** big verdict, four metric cards (Conservative Net, Expected Net, Conservative ROI, Cash
  Velocity), then Auction, Instant Win, Mac.bid Cost, Resale Estimate, Buyer-Paid Shipping, eBay Fees,
  Promotion Scenarios, Purchase Protection, Maximum Bid, Market Evidence, Risk Analysis, Assumptions,
  and Sources — every assumption editable with **instant deterministic recalculation** (no AI re-run).
- **History:** local (IndexedDB) list with open / duplicate / recalculate / delete / export JSON /
  mark Won-Lost / actual-outcome tracking (predicted vs. actual).
- **Settings:** AI provider picker (OpenAI / Anthropic / Gemini / Demo), session-only API key, model,
  Test Connection, web-research toggle, research-call budget, and the full Eric Standard sourcing profile.

## Installation

```bash
npm install
npm run dev        # http://localhost:3000
```

Other commands:

```bash
npm run test       # Vitest unit tests (fees, profitability, max bid, verdicts)
npm run test:e2e   # Playwright end-to-end demo flow
npm run build      # production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
node scripts/generate-assets.mjs   # regenerate PWA icons + demo screenshot fixture
```

## Environment variables

All optional. Create `.env.local` for local private use:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Server-side OpenAI key (never sent to the browser) |
| `ANTHROPIC_API_KEY` | Server-side Anthropic key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Server-side Google Gemini key |
| `BIDLENS_API_TOKEN` | When set, external REST calls must send `Authorization: Bearer <token>`. Same-origin browser use is exempt; unset = open (local dev). |

A key entered in Settings (session-only, sessionStorage) **overrides** the corresponding environment
key for that browser session.

## Provider setup

Settings → choose OpenAI, Anthropic, or Google Gemini → paste a key (or rely on the server env var) →
optionally set a model (defaults: `gpt-4o`, `claude-opus-4-8`, `gemini-2.5-flash`) → **Test Connection**.
"Enable web research" uses the provider's web-search/grounding tool (OpenAI Responses `web_search`,
Anthropic `web_search` server tool, Gemini Google Search grounding). With it off, market evidence is
model recollection only and is automatically down-weighted to low confidence. See
`docs/ai-provider-guide.md`.

## Demo Mode

Everything works with **zero keys**: pick **Demo** on the home screen. It runs the entire workflow —
extraction → review → research progress → separate Auction / Instant Win results → assumption edits →
instant recalculation → save → export — using the bundled Zircon SuperScan ID fixture
(`public/demo/macbid-zircon.png`: Open Box, $1 bid, $56 Instant Win, $70 est. retail, $7 protection
off). All demo market evidence is mock data and every screen labels it
**"Demo data, not live market evidence."**

## REST API

`public/openapi.json` is the machine-readable spec (tool-friendly for AI agents). Summary:

```bash
# Full evaluation (keyless demo):
curl -X POST http://localhost:3000/api/v1/evaluate -F 'provider={"provider":"demo"}'

# With a real screenshot + provider:
curl -X POST http://localhost:3000/api/v1/evaluate \
  -H "Authorization: Bearer $BIDLENS_API_TOKEN" \
  -F image=@screenshot.png \
  -F 'provider={"provider":"anthropic","webResearchEnabled":true,"maxResearchCalls":3}' \
  -F 'profile={"ebay":{"promotionRate":0.02}}' \
  -F 'overrides={"protectionEnabled":true}'

GET  /api/v1/evaluations/:id                 # fetch (API-created evaluations)
POST /api/v1/evaluations/:id/recalculate     # new assumptions, no AI calls
POST /api/v1/providers/test                  # connection test
GET  /api/v1/health
```

Details in `docs/api.md`.

## Security & key handling

- API keys are **never** logged, sent to analytics, stored in IndexedDB, or persisted server-side.
- Browser keys default to **session-only** (sessionStorage; cleared when the session ends) and are sent
  only to this app's own `/api` routes, which forward them to the selected provider.
- Server environment keys are never exposed to the browser (`/api/v1/health` reports only booleans).
- The public API is Bearer-token gated when `BIDLENS_API_TOKEN` is set.
- Known limitation: any browser key necessarily transits this app's server per request; deploy behind
  HTTPS and treat the server as trusted.

## Data storage

- Evaluations live in **IndexedDB** (Dexie) in your browser only — no accounts, no cloud sync in v1.
- The REST API keeps a small file-backed store (`.bidlens-data/`) so headless clients can re-fetch and
  recalculate; it is ephemeral and deployment-local.
- Non-secret settings live in localStorage; keys in sessionStorage.

## Calculation formulas (summary)

Full detail in `docs/calculation-rules.md`. All money is integer **cents**.

```
acquisition = hammer + premium(15%) + lotFee($3) + protection? + transferFee + tax(6% of configurable base)
revenue     = itemSalePrice + buyerPaidShipping
expenses    = FVF(rate × revenue) + perOrderFee + promo(rate × revenue) + label + packaging
              + returnReserve(rate × price) + accessoryAllowance?
netProfit   = revenue − expenses − acquisition
ROI         = netProfit / acquisition          (also total-cash ROI incl. label + packaging)
maxBid      = binary search for the largest hammer bid where the CONSERVATIVE scenario still clears
              net ≥ $20, conservative ROI ≥ 50%, expected ROI ≥ 75% (floored to whole dollars)
```

The **conservative scenario** (quick-sale price, conservative label, 1.5× return reserve, accessory
allowance when completeness is uncertain, full promotion) controls the verdict. A low-confidence
evaluation can never return Strong Buy.

## Known limitations

- **No eBay API integration in v1.** Market research relies on the selected AI provider's web
  research; it does **not** guarantee complete access to historical eBay sold data. Evidence strength
  is graded (strong sold / partial sold / active-only / insufficient) and shown transparently; weak
  evidence produces provisional pricing and blocks Strong Buy.
- Shipping uses conservative category bands for 15146 → 90001, not live carrier rates.
- The eBay fee table is a configurable assumption set; verify against eBay's current schedule.
- Countdown timers are point-in-time text from the screenshot ("at capture").
- The server-side evaluation store is ephemeral; durable history is browser-local.
- Demo Mode market evidence is mock data by design.

## Future eBay integration path

The market layer is isolated behind `ResearchResult`/`MarketComparable` (see `docs/architecture.md`).
A future eBay Browse/Marketplace Insights integration would replace `researchProduct()`'s market call
with real sold-comp queries and feed the same `computeMarketStats()` pipeline — no changes to the
calculators, verdict engine, or UI.

## Docs

- `docs/architecture.md` — modules, data flow, decisions
- `docs/calculation-rules.md` — every formula, threshold, and rule
- `docs/ai-provider-guide.md` — provider abstraction, prompts, key handling
- `docs/api.md` — REST API reference
