import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EvaluationResult } from "@/types/domain";
import type { MacBidScreenshotExtraction } from "@/lib/ai/schemas/extraction";
import type { MarketResearch, ProductIdentity, ShippingResearch } from "@/lib/ai/schemas/research";

/**
 * Minimal file-backed store for evaluations created through the REST API,
 * so GET /api/v1/evaluations/:id and recalculate work for API clients.
 * Browser history lives client-side in IndexedDB; this store is only for
 * headless API use and is not durable across deployments.
 */
export interface StoredEvaluation {
  result: EvaluationResult;
  extraction: MacBidScreenshotExtraction;
  identity: ProductIdentity | null;
  market: MarketResearch | null;
  shipping: ShippingResearch | null;
}

const DATA_DIR = path.join(process.cwd(), ".bidlens-data");

function fileFor(id: string): string {
  // Evaluation IDs are UUIDs we generate; sanitize anyway.
  const safe = id.replace(/[^a-zA-Z0-9-]/g, "");
  return path.join(DATA_DIR, `${safe}.json`);
}

export async function saveEvaluation(entry: StoredEvaluation): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(fileFor(entry.result.evaluationId), JSON.stringify(entry), "utf8");
}

export async function loadEvaluation(id: string): Promise<StoredEvaluation | null> {
  try {
    const raw = await readFile(fileFor(id), "utf8");
    return JSON.parse(raw) as StoredEvaluation;
  } catch {
    return null;
  }
}
