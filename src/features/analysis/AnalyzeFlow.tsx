"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, ClipboardPaste, FlaskConical, ImagePlus, ScanSearch, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiExplain, apiExtract, apiResearch, makeThumbnail, ApiError } from "@/lib/client/api";
import { useSettings } from "@/lib/client/useSettings";
import type { MacBidScreenshotExtraction } from "@/lib/ai/schemas/extraction";
import type { ProductResearchResult } from "@/lib/ai/providers/types";
import { assembleEvaluation, type ListingOverrides } from "@/lib/pipeline";
import type { EvaluationResult, SourcingProfile } from "@/types/domain";
import { db, recordFromResult } from "@/lib/storage/db";
import { ProgressScreen, type StageKey } from "@/features/analysis/ProgressScreen";
import { ReviewScreen } from "@/features/extraction/ReviewScreen";
import { CandidateScreen } from "@/features/research/CandidateScreen";
import { ResultsView } from "@/features/results/ResultsView";
import { RecentEvaluations } from "@/features/history/RecentEvaluations";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

type Step =
  | { kind: "input" }
  | { kind: "preview"; file: File; url: string }
  | { kind: "extracting" }
  | { kind: "review" }
  | { kind: "candidates" }
  | { kind: "researching"; stage: StageKey }
  | { kind: "results" }
  | { kind: "error"; message: string; retryable: boolean; retry: () => void };

export function AnalyzeFlow() {
  const settings = useSettings();
  const [step, setStep] = useState<Step>({ kind: "input" });
  const [file, setFile] = useState<File | null>(null);
  const [extraction, setExtraction] = useState<MacBidScreenshotExtraction | null>(null);
  const [overrides, setOverrides] = useState<ListingOverrides>({});
  const [research, setResearch] = useState<ProductResearchResult | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [evalProfile, setEvalProfile] = useState<SourcingProfile | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type)) return "Unsupported image type. Use PNG, JPEG, or WebP.";
    if (f.size > MAX_BYTES) return "Image is larger than 8 MB. Crop or resize the screenshot.";
    return null;
  }, []);

  const acceptFile = useCallback(
    (f: File) => {
      const problem = validateFile(f);
      if (problem) {
        toast.error(problem);
        return;
      }
      const url = URL.createObjectURL(f);
      setFile(f);
      setDemo(false);
      setStep({ kind: "preview", file: f, url });
    },
    [validateFile],
  );

  // Clipboard paste support.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (step.kind !== "input" && step.kind !== "preview") return;
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const f = item?.getAsFile();
      if (f) acceptFile(f);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [acceptFile, step.kind]);

  const startExtraction = async (imageFile: File | null, isDemo: boolean) => {
      if (!settings) return;
      const effective = isDemo ? { ...settings, provider: "demo" as const } : settings;
      setStep({ kind: "extracting" });
      setDemo(isDemo || effective.provider === "demo");
      try {
        if (imageFile) {
          setThumbnail(await makeThumbnail(imageFile));
        } else {
          setThumbnail(null);
        }
        const res = await apiExtract(effective, imageFile);
        setExtraction(res.extraction);
        setOverrides({});
        setStep({ kind: "review" });
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError("Screenshot extraction failed.", "internal", true);
        setStep({
          kind: "error",
          message: err.message,
          retryable: err.retryable,
          retry: () => void startExtraction(imageFile, isDemo),
        });
      }
  };

  const startResearch = async (ext: MacBidScreenshotExtraction, ovr: ListingOverrides, prof?: SourcingProfile) => {
      if (!settings) return;
      const profile = prof ?? evalProfile ?? settings.profile;
      const effective = demo ? { ...settings, provider: "demo" as const } : settings;
      setStep({ kind: "researching", stage: "identify" });
      const stageTimer = window.setTimeout(() => {
        setStep((s) => (s.kind === "researching" ? { kind: "researching", stage: "market" } : s));
      }, 900);
      try {
        const product = {
          title: ovr.title ?? ext.product.title.value ?? "Unknown product",
          brand: ovr.brand !== undefined ? ovr.brand : ext.product.brand.value,
          model: ovr.model !== undefined ? ovr.model : ext.product.modelNumber.value,
          upc: ext.product.upc.value,
          mpn: ext.product.mpn.value,
          condition: ovr.condition ?? ext.product.condition.value ?? "unknown",
          retailPrice: ovr.retailPrice !== undefined ? ovr.retailPrice : ext.macBid.displayedRetailPrice.value,
          categoryGuess: ext.product.categoryGuess.value,
        };
        const res = await apiResearch(effective, product);
        window.clearTimeout(stageTimer);
        setResearch(res);
        for (const w of res.warnings) toast.message(w);

        setStep({ kind: "researching", stage: "shipping" });
        await new Promise((r) => setTimeout(r, 350));
        setStep({ kind: "researching", stage: "maxbid" });

        const assembled = assembleEvaluation({
          extraction: ext,
          identity: res.identity,
          market: res.market,
          shipping: res.shipping,
          profile,
          overrides: ovr,
          demo,
        });
        setResult(assembled);
        setSaved(false);

        const ambiguous =
          res.identity.matchLevel === "ambiguous" ||
          res.identity.matchLevel === "no_reliable_match" ||
          res.identity.candidates.length > 1;
        setStep(ambiguous ? { kind: "candidates" } : { kind: "results" });

        // Fire-and-forget narrative explanation; never blocks results.
        apiExplain(
          effective,
          JSON.stringify({
            verdict: assembled.headlineVerdict,
            detail: assembled.headlineDetail,
            conservativeNetCents: assembled.auction.scenarios?.conservative.netProfitCents,
            expectedNetCents: assembled.auction.scenarios?.expected.netProfitCents,
            maxBidCents: assembled.maxBid.recommendedMaxBidCents,
            instantWinVerdict: assembled.instantWin.verdict,
            risks: assembled.risk.flags.map((f) => `${f.label}: ${f.level}`),
            evidence: assembled.research.stats.evidenceGrade,
          }),
        ).then((explanation) => {
          if (explanation) {
            setResult((r) =>
              r ? { ...r, explanation: `${explanation.summary}\n\nDrivers: ${explanation.keyDrivers.join("; ")}\nCautions: ${explanation.cautions.join("; ")}${explanation.protectionAdvice ? `\nProtection: ${explanation.protectionAdvice}` : ""}` } : r,
            );
          }
        });
      } catch (e) {
        window.clearTimeout(stageTimer);
        const err = e instanceof ApiError ? e : new ApiError("Market research failed.", "internal", true);
        toast.error(err.message);
        // Preserve user-entered assumptions: fall back to review with a
        // researchFailed evaluation so nothing is lost.
        const assembled = assembleEvaluation({
          extraction: ext,
          identity: null,
          market: null,
          shipping: null,
          profile,
          overrides: ovr,
          demo,
          researchFailed: true,
        });
        setResult(assembled);
        setResearch(null);
        setSaved(false);
        setStep({ kind: "results" });
      }
  };

  const saveEvaluation = async () => {
    if (!result || !extraction) return;
    try {
      await db.evaluations.put(recordFromResult(result, extraction, thumbnail));
      setSaved(true);
      toast.success("Saved to history.");
    } catch {
      toast.error("Could not save to local history (storage error).");
    }
  };

  const reset = () => {
    setStep({ kind: "input" });
    setFile(null);
    setExtraction(null);
    setOverrides({});
    setResearch(null);
    setResult(null);
    setThumbnail(null);
    setDemo(false);
    setSaved(false);
    setEvalProfile(null);
  };

  const dropHandlers = useMemo(
    () => ({
      onDragOver: (e: React.DragEvent) => e.preventDefault(),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) acceptFile(f);
      },
    }),
    [acceptFile],
  );

  if (!settings) return null;

  if (step.kind === "extracting") {
    return <ProgressScreen stage="read" />;
  }
  if (step.kind === "researching") {
    return <ProgressScreen stage={step.stage} />;
  }

  if (step.kind === "error") {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>{step.message}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {step.retryable && <Button onClick={step.retry}>Retry</Button>}
          <Button variant="outline" onClick={reset}>
            Start over
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step.kind === "review" && extraction) {
    return (
      <ReviewScreen
        extraction={extraction}
        overrides={overrides}
        previewUrl={step.kind === "review" && file ? URL.createObjectURL(file) : demo ? "/demo/macbid-zircon.png" : null}
        profile={settings.profile}
        onChange={setOverrides}
        onConfirm={(ovr, prof) => {
          setOverrides(ovr);
          setEvalProfile(prof);
          startResearch(extraction, ovr, prof);
        }}
        onCancel={reset}
      />
    );
  }

  if (step.kind === "candidates" && research && result) {
    return (
      <CandidateScreen
        identity={research.identity}
        onSelect={(candidate) => {
          const nextOverrides: ListingOverrides = {
            ...overrides,
            title: candidate?.productName ?? overrides.title,
            brand: candidate?.brand ?? overrides.brand,
            model: candidate?.model ?? overrides.model,
          };
          setOverrides(nextOverrides);
          if (extraction && research) {
            const identity = candidate
              ? { ...research.identity, identityConfidence: candidate.matchConfidence, matchLevel: "probable_match" as const }
              : research.identity;
            const assembled = assembleEvaluation({
              evaluationId: result.evaluationId,
              extraction,
              identity,
              market: research.market,
              shipping: research.shipping,
              profile: evalProfile ?? settings.profile,
              overrides: nextOverrides,
              demo,
            });
            setResult(assembled);
          }
          setStep({ kind: "results" });
        }}
        onSearchAgain={() => extraction && startResearch(extraction, overrides)}
        onContinue={() => setStep({ kind: "results" })}
      />
    );
  }

  if (step.kind === "results" && result) {
    return (
      <ResultsView
        result={result}
        onResultChange={(r) => {
          setResult(r);
          setSaved(false);
        }}
        onSave={saveEvaluation}
        saved={saved}
        onStartOver={reset}
      />
    );
  }

  if (step.kind === "preview") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Confirm screenshot</CardTitle>
          <CardDescription>
            {step.file.name} · {(step.file.size / 1024).toFixed(0)} KB
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={step.url}
            alt="Mac.bid screenshot preview"
            className="max-h-96 w-full rounded-md border object-contain"
          />
          <div className="flex gap-2">
            <Button className="flex-1" size="lg" onClick={() => startExtraction(step.file, false)}>
              <ScanSearch /> Analyze this screenshot
            </Button>
            <Button variant="outline" size="lg" onClick={reset}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Input step (home).
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">BidLens</h1>
        <p className="text-sm text-muted-foreground">Mac.bid Profitability Evaluator</p>
      </header>

      <Card {...dropHandlers}>
        <CardHeader>
          <CardTitle>Upload or share one Mac.bid screenshot</CardTitle>
          <CardDescription>
            BidLens reads the listing, researches resale comps, and calculates your maximum bid against the
            Eric Standard profile ($20 net floor, 75% expected / 50% conservative ROI).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            size="lg"
            className="w-full"
            data-testid="analyze-button"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload /> Analyze Mac.bid Screenshot
          </Button>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button variant="outline" onClick={() => cameraInputRef.current?.click()}>
              <Camera /> Camera
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus /> Gallery
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const items = await navigator.clipboard.read();
                  for (const item of items) {
                    const type = item.types.find((t) => t.startsWith("image/"));
                    if (type) {
                      const blob = await item.getType(type);
                      acceptFile(new File([blob], "pasted.png", { type }));
                      return;
                    }
                  }
                  toast.message("No image on the clipboard. Copy a screenshot first (or press Ctrl+V).");
                } catch {
                  toast.message("Clipboard read blocked — press Ctrl+V / Cmd+V instead.");
                }
              }}
            >
              <ClipboardPaste /> Paste
            </Button>
            <Button variant="secondary" data-testid="demo-button" onClick={() => startExtraction(null, true)}>
              <FlaskConical /> Demo
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPEG, or WebP up to 8 MB. You can also drag &amp; drop or paste anywhere on this screen.
            Demo mode runs the whole workflow with the Zircon fixture — no API key required.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Choose a Mac.bid screenshot"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) acceptFile(f);
              e.target.value = "";
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label="Take a photo of a Mac.bid listing"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) acceptFile(f);
              e.target.value = "";
            }}
          />
        </CardContent>
      </Card>

      <RecentEvaluations />
    </div>
  );
}
