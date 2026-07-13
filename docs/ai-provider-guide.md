# AI Provider Guide

## Abstraction

Every provider implements `AIProvider` (src/lib/ai/providers/types.ts):

```ts
interface AIProvider {
  testConnection(): Promise<ConnectionResult>;
  analyzeScreenshot(input): Promise<ListingExtractionResult>;     // vision → Zod-validated JSON
  researchProduct(input): Promise<ProductResearchResult>;         // identity + market + shipping
  classifyComparables(input): Promise<ComparableResearchResult>;  // re-grade candidate comps
  explainRecommendation(input): Promise<RecommendationExplanation>; // narrative only
}
```

`BaseAIProvider` owns prompt assembly, JSON extraction/validation, the research call budget
(`maxResearchCalls`, default 3: identity → market → shipping), and error normalization.
Subclasses implement two primitives: `completeText(prompt, {webSearch, maxTokens})` and
`completeVision(prompt, imageBase64, mimeType)`.

## Implementations (official SDKs)

| Provider | SDK | Vision | Web research | testConnection |
| --- | --- | --- | --- | --- |
| OpenAI (`gpt-4o` default) | `openai` | chat.completions with `image_url` data URL + JSON mode | Responses API `web_search` tool | `models.list()` |
| Anthropic (`claude-opus-4-8` default) | `@anthropic-ai/sdk` | messages.create with base64 `image` block | `web_search_20260209` server tool (`max_uses: 6`) | `models.list()` |
| Google Gemini (`gemini-2.5-flash` default) | `@google/genai` | `generateContent` with `inlineData` | `googleSearch` grounding tool | `models.list()` |
| Demo | none | returns the Zircon fixture | none (mock, labeled) | always ok |

All providers run **server-side only** (API routes); SDKs and keys never ship to the browser.

## Prompts (src/lib/ai/prompts/index.ts)

Six prompts: screenshotExtraction, productIdentity, marketResearch, comparableClassification,
shippingResearch, recommendationExplanation. Shared rules baked into each:

- return only schema-valid JSON; null for anything not actually seen
- never fabricate prices, sold status, URLs, or model numbers
- sold ≠ active asking price; explain every exclusion; include source URLs
- prefer conservative estimates
- **never** perform financial arithmetic or produce a bid ceiling/verdict — the app's
  deterministic calculator is authoritative

Responses are parsed with `parseModelJson` (tolerates code fences/preamble) and validated with
Zod; schema failures surface as retryable errors and never crash the UI.

## Key handling

Resolution order per request: user session key (sessionStorage → request body) → provider env var
(`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`). Keys are never logged,
never stored server-side, never placed in IndexedDB/localStorage, never sent to any service other
than the selected provider. `testConnection` reports which source was used (`user` / `environment`).

## Error taxonomy

`ProviderError` codes: `missing_key` (400), `invalid_key` (401), `quota_exceeded` (429),
`timeout` / `provider_error` (502), `schema_validation` (retryable). The UI maps each to a
readable message with a Retry option, and a failed research call degrades to an
`insufficient_evidence` result that preserves all user-entered assumptions.

## Provider-specific notes

- Web research quality differs; evidence is graded per result, not per provider.
- With web research disabled, claimed "sold" statuses are downgraded to "unknown" and relevance
  is capped at 0.5 — recollection is never treated as verified sales.
- Anthropic's web_search tool variant targets current models (Opus 4.6+); set an older model
  name only if your account requires it (the older `web_search_20250305` variant would then be
  needed — not wired in v1).
