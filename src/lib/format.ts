import type { RiskLevel, Verdict, VelocityLabel } from "@/types/domain";

export const VERDICT_LABEL: Record<Verdict, string> = {
  strong_buy: "STRONG BUY",
  buy_below: "BUY BELOW",
  borderline: "BORDERLINE",
  pass: "PASS",
  insufficient_evidence: "INSUFFICIENT EVIDENCE",
  confirm_product: "CONFIRM PRODUCT",
};

export const VERDICT_TONE: Record<Verdict, "success" | "warning" | "destructive" | "muted"> = {
  strong_buy: "success",
  buy_below: "success",
  borderline: "warning",
  pass: "destructive",
  insufficient_evidence: "muted",
  confirm_product: "warning",
};

export const VELOCITY_LABEL_TEXT: Record<VelocityLabel, string> = {
  very_fast: "Very Fast",
  fast: "Fast",
  moderate: "Moderate",
  slow: "Slow",
  dead_inventory_risk: "Dead Inventory Risk",
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  very_high: "Very High",
};

export function pct(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function confidenceBadge(confidence: number): { label: string; tone: "success" | "warning" | "destructive" } {
  if (confidence >= 0.8) return { label: `High ${Math.round(confidence * 100)}%`, tone: "success" };
  if (confidence >= 0.5) return { label: `Med ${Math.round(confidence * 100)}%`, tone: "warning" };
  return { label: `Low ${Math.round(confidence * 100)}%`, tone: "destructive" };
}

export function conditionLabel(condition: string): string {
  return condition.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
