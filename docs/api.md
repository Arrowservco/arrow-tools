# BidLens REST API

Machine-readable spec: `public/openapi.json` (served at `/openapi.json`).

## Authentication

Set `BIDLENS_API_TOKEN` on the server, then send `Authorization: Bearer <token>` on every
external call. Same-origin browser requests (the app's own UI) are exempt. When the variable is
unset (local development), no auth is required.

## POST /api/v1/evaluate

Full pipeline: extraction → identity/market/shipping research → deterministic evaluation.
`multipart/form-data`:

| field | type | notes |
| --- | --- | --- |
| `image` | file | PNG/JPEG/WebP ≤ 8 MB. Optional when provider = demo. |
| `provider` | JSON string | `{"provider":"openai"|"anthropic"|"gemini"|"demo","apiKey"?,"model"?,"webResearchEnabled"?,"maxResearchCalls"?}` |
| `profile` | JSON string | partial SourcingProfile merged onto Eric Standard (e.g. `{"ebay":{"promotionRate":0.02}}`) |
| `overrides` | JSON string | ListingOverrides (dollars): title, brand, model, condition, currentBid, instantWin, retailPrice, protectionPrice, protectionEnabled, useDisplayedTotal |

Response: see `EvaluationResponse` in the OpenAPI spec — product identity, Mac.bid costs,
resale estimates with evidence grade, shipping, three-scenario profitability, recommendation
(verdict + maximum bid + protected bid + max Instant Win), velocity, risks, assumptions, sources.
All response prices are dollars.

Errors: 400 missing image/key · 401 bad token or provider key · 413 too large ·
415 unsupported type · 429 provider quota · 502 provider failure. Body:
`{"error","message","retryable"}`.

## GET /api/v1/evaluations/:id

Returns an evaluation previously created **through the API** (server store is file-backed and
ephemeral; browser history lives in IndexedDB and is not exposed). 404 when unknown.

## POST /api/v1/evaluations/:id/recalculate

Body: `{"overrides"?: ListingOverrides, "profile"?: partial SourcingProfile}`.
Re-runs only the deterministic calculators — no AI calls — and returns the updated evaluation.

## POST /api/v1/providers/test

Body: ProviderConfig JSON. Returns `{ok, message, modelUsed?, keySource}`.

## GET /api/v1/health

`{status, app, version, time, providersConfigured:{openai,anthropic,gemini}, apiTokenRequired}` —
booleans only; never reveals key material.

## Step endpoints (used by the UI, same auth rules)

- `POST /api/v1/extract` — multipart `{image?, provider}` → `{extraction, demo}`
- `POST /api/v1/research` — JSON `{provider, product}` → `{identity, market, shipping, warnings}`
- `POST /api/v1/explain` — JSON `{provider, resultSummary}` → `{explanation}`

## Agent example

```bash
curl -s -X POST "$BASE/api/v1/evaluate" \
  -H "Authorization: Bearer $BIDLENS_API_TOKEN" \
  -F image=@macbid.png \
  -F 'provider={"provider":"gemini","maxResearchCalls":3}' \
  | jq '{verdict:.recommendation.verdict, maxBid:.recommendation.maximumBid,
         consNet:.profitability.conservativeNetProfit, evidence:.resale.evidenceGrade}'
```
