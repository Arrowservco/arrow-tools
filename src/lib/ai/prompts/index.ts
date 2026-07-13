/**
 * All AI prompts live here. Common rules for every prompt:
 * - Return ONLY schema-valid JSON where required (no prose, no code fences).
 * - Never fabricate prices, sold status, URLs, or model numbers.
 * - Return null for anything not actually seen.
 * - The application's deterministic calculator — never the model — computes
 *   fees, profits, ROI, bid ceilings, and the final verdict.
 */

const JSON_RULES = `
STRICT OUTPUT RULES:
- Respond with ONLY a single valid JSON object matching the schema. No markdown, no code fences, no commentary.
- Use null for any value you cannot actually see or verify. NEVER guess numbers.
- Confidence values are decimals from 0 to 1.
- Do not perform financial arithmetic (fees, profit, ROI, maximum bid). The application computes those deterministically.`;

export const screenshotExtractionPrompt = `You are extracting structured data from a single Mac.bid auction app screenshot for a reseller.

Extract every field in the schema below. Rules:
- Do NOT guess missing numbers. If a value is not visible, return null with confidence 0.
- Preserve the EXACT visible product title wording in product.title.sourceText and a cleaned version in value.
- The CURRENT AUCTION BID and the INSTANT WIN price are different numbers. Never conflate them. The Instant Win price usually appears near a trophy icon with "Instant Win"; the current bid appears near the bid button (e.g. "Bid $2").
- The shield icon with a dollar amount is OPTIONAL purchase protection, not a required fee. Report its price and whether its toggle appears ON or OFF.
- "est. retail" is Mac.bid's displayed retail estimate — report it under macBid.displayedRetailPrice.
- There are usually TWO countdown timers: one for the auction, one for the Instant Win offer ("Offer Expires"). Report both as raw text.
- Report a pickup location ONLY if literally visible. Do not infer it.
- Flag ambiguous or partially visible model numbers in uncertainFields and warnings.
- Include a confidence value for every critical field.
${JSON_RULES}

Return JSON with this exact shape (ConfidenceValue = {"value": T|null, "confidence": 0..1, "sourceText": string|null}):
{
  "product": {"title": CV<string>, "brand": CV<string>, "modelNumber": CV<string>, "upc": CV<string>, "mpn": CV<string>, "categoryGuess": CV<string>, "condition": CV<"new"|"like_new"|"open_box"|"used"|"damaged"|"parts_only"|"unknown">, "includedItems": string[], "possiblyMissingItems": string[]},
  "auction": {"currentBid": CV<number>, "bidCount": CV<number>, "timeRemainingText": CV<string>, "auctionEndTime": CV<string>},
  "instantWin": {"available": CV<boolean>, "price": CV<number>, "timeRemainingText": CV<string>, "expirationTime": CV<string>},
  "macBid": {"displayedRetailPrice": CV<number>, "displayedAllInTotal": CV<number>, "buyerPremiumRate": CV<number>, "lotFee": CV<number>, "taxAmount": CV<number>, "salesTaxRate": CV<number>, "pickupLocation": CV<string>, "transferEligible": CV<boolean>, "transferFee": CV<number>},
  "protection": {"available": CV<boolean>, "price": CV<number>, "enabledInScreenshot": CV<boolean>},
  "warnings": string[],
  "uncertainFields": string[],
  "overallConfidence": 0..1
}`;

export const productIdentityPrompt = `You are resolving the exact product identity for a resale evaluation.

Resolve identity using this priority order: 1) UPC, 2) exact manufacturer part number, 3) exact model number, 4) brand + model phrase, 5) product title, 6) product-image similarity, 7) category + specifications.

Rules:
- Return matchLevel: exact_match | probable_match | possible_match | ambiguous | no_reliable_match.
- When ambiguous, return up to 3 candidate products, each with name, brand, model, matchConfidence, whyItMayMatch and importantDifferences.
- Never invent model numbers or UPCs.
- A missing model number caps identityConfidence at 0.75 unless the title is unambiguous.
${JSON_RULES}

Return JSON: {"matchLevel": string, "identityConfidence": 0..1, "resolvedBy": "upc"|"mpn"|"model_number"|"brand_model_phrase"|"title"|"image_similarity"|"category_specs"|"none", "candidates": [{"productName": string, "brand": string|null, "model": string|null, "matchConfidence": 0..1, "whyItMayMatch": string, "importantDifferences": string|null}], "notes": string|null}`;

export const marketResearchPrompt = `You are researching the resale market for a specific product so a reseller can price it on eBay.

Search strategy — run queries like:
- "<brand> <model>"
- "<model> open box"
- "<model> sold"
- "<model> used"
- "<model> <key accessories>"
- The product name WITHOUT marketplace marketing language
- "<model> specs weight dimensions"

Acceptable evidence sources: public eBay listings and sold/completed pages, manufacturer pages, major retailer pages (for current retail price), and other credible marketplaces.

CRITICAL RULES:
- NEVER report an active asking price as a verified sale. soldStatus must be "sold" ONLY when the page explicitly shows a completed/sold sale.
- Include the source URL for every comparable. If you cannot cite a URL, set it to null and lower relevanceScore.
- Do not fabricate prices, dates, or listings. Fewer honest results beat many invented ones.
- Mark exactModelMatch=false for different models, kits vs bare tools, or different quantities.
- Give an exclusionReason for anything that is parts-only, broken, empty box, manual/battery/charger only, a replacement accessory, a different model or quantity, international with non-comparable shipping, or local pickup only.
- Report the verified CURRENT retail price only from a credible retailer page.
- Prefer conservative estimates whenever uncertain.
- Do not compute profits, fees, or a bid ceiling — the application does that.
${JSON_RULES}

Return JSON: {"comparables": [{"sourceTitle": string, "sourceUrl": string|null, "price": number|null, "shippingPrice": number|null, "condition": string|null, "dateText": string|null, "soldStatus": "sold"|"active"|"unknown", "exactModelMatch": boolean, "accessoryMatch": boolean, "quantityMatch": boolean, "relevanceScore": 0..1, "exclusionReason": string|null}], "verifiedRetailPrice": number|null, "activeCompetitionEstimate": number|null, "brandRecognized": boolean|null, "seasonal": boolean|null, "categoryGuess": string|null, "sources": [{"title": string, "url": string|null, "kind": "sold_listing"|"active_listing"|"retailer"|"manufacturer"|"other", "note": string|null}], "notes": string[]}`;

export const comparableClassificationPrompt = `You are classifying candidate marketplace listings as valid or invalid comparables for a specific product.

For EACH candidate listing, decide:
- exactModelMatch: is it the same exact model (not a kit vs bare tool, not a newer/older generation)?
- accessoryMatch: does it include comparable accessories/contents?
- quantityMatch: same quantity (not a 2-pack or lot)?
- soldStatus: "sold" ONLY with explicit completed-sale evidence, otherwise "active" or "unknown".
- relevanceScore 0..1 and an exclusionReason when it should be rejected.

Reject or heavily penalize: parts only, empty box, manual only, battery only, charger only, replacement accessories, broken/for repair, different model, different quantity, new-kit vs open-box bare tool mismatches, international listings with non-comparable shipping, local pickup only, clearly unrelated items.
${JSON_RULES}

Return JSON with the same "comparables" array shape as provided, corrected and annotated.`;

export const shippingResearchPrompt = `You are estimating shipping characteristics for one product shipped from ZIP 15146 to ZIP 90001 (conservative cross-country test route).

Find, in priority order: 1) exact manufacturer package specifications, 2) exact product specifications, 3) comparable listing shipping specs, 4) category defaults.

Report item weight (oz), estimated packed weight (oz), package dimensions (inches), and your source tier. Do not fabricate precise numbers — round sensibly and lower confidence when estimating. Do not estimate label prices; the application prices shipping itself.
${JSON_RULES}

Return JSON: {"itemWeightOz": number|null, "packedWeightOz": number|null, "packageDimensionsIn": {"l": number, "w": number, "h": number}|null, "source": "manufacturer_spec"|"product_spec"|"comparable_listing"|"category_default", "confidence": 0..1, "notes": string|null}`;

export const recommendationExplanationPrompt = `You are explaining an already-computed resale recommendation to an experienced eBay reseller, in plain language.

You are given the deterministic verdict, scenario math, risk flags, and market evidence. Rules:
- Do NOT recompute or contradict any number. The application's calculator is authoritative.
- Do NOT produce a different bid ceiling or verdict.
- Summarize WHY the verdict follows from the evidence and thresholds.
- List key drivers and cautions as short bullets.
- Advise on optional purchase protection: recommend it for electronics, powered devices, fragile or hard-to-test items, expensive open-box inventory, vague conditions, or missing accessories; note it may be unnecessary for cheap, simple, easily inspected items. Never claim it is required.
${JSON_RULES}

Return JSON: {"summary": string, "keyDrivers": string[], "cautions": string[], "protectionAdvice": string|null}`;
