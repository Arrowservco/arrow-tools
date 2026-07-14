"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Plug, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiTestConnection } from "@/lib/client/api";
import {
  clearSessionKey, defaultSettings, getSessionKey, setSessionKey,
  type AppSettings,
} from "@/lib/storage/settings";
import { updateSettings, useSettings } from "@/lib/client/useSettings";
import type { ProviderId, ConnectionResult } from "@/lib/ai/providers/types";
import { EBAY_CATEGORY_FEE_RATES, resolveCategoryFeeRate } from "@/lib/profile";
import { dollarsToCents } from "@/lib/money";

const PROVIDER_INFO: Record<ProviderId, { label: string; envVar: string; defaultModel: string }> = {
  demo: { label: "Demo (no key needed)", envVar: "—", defaultModel: "demo" },
  anthropic: { label: "Anthropic (Claude)", envVar: "ANTHROPIC_API_KEY", defaultModel: "claude-opus-4-8" },
};

export function SettingsScreen() {
  const settings = useSettings();
  if (!settings) return null;
  return <SettingsForm settings={settings} />;
}

function SettingsForm({ settings }: { settings: AppSettings }) {
  const [keyValue, setKeyValue] = useState(() => getSessionKey(settings.provider));
  const [connection, setConnection] = useState<ConnectionResult | null>(null);
  const [testing, setTesting] = useState(false);

  const update = (patch: Partial<AppSettings>) => {
    updateSettings({ ...settings, ...patch });
  };

  const updateProfile = (patch: Partial<AppSettings["profile"]>) => {
    update({ profile: { ...settings.profile, ...patch } });
  };

  const info = PROVIDER_INFO[settings.provider];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>AI provider</CardTitle>
          <CardDescription>
            The provider reads your screenshot and researches the resale market. All financial math stays in
            BidLens&apos;s own deterministic calculator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="provider">Provider</Label>
            <Select
              id="provider"
              value={settings.provider}
              onChange={(e) => {
                const provider = e.target.value as ProviderId;
                update({ provider, model: "" });
                setKeyValue(getSessionKey(provider));
                setConnection(null);
              }}
            >
              {Object.entries(PROVIDER_INFO).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>

          {settings.provider !== "demo" && (
            <>
              <div>
                <Label htmlFor="api-key">API key (session only)</Label>
                <Input
                  id="api-key"
                  type="password"
                  autoComplete="off"
                  placeholder={`Session key, or leave empty to use ${info.envVar} on the server`}
                  value={keyValue}
                  onChange={(e) => {
                    setKeyValue(e.target.value);
                    setSessionKey(settings.provider, e.target.value);
                  }}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  <KeyRound aria-hidden className="mr-1 inline h-3 w-3" />
                  Stored in sessionStorage only — cleared when this browser session ends. Never written to
                  IndexedDB, localStorage, logs, or analytics. Sent only to this app&apos;s own server, which
                  forwards it to {info.label}. A key entered here overrides the {info.envVar} environment
                  variable for this session.
                </p>
              </div>
              <div>
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  placeholder={info.defaultModel}
                  value={settings.model}
                  onChange={(e) => update({ model: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label htmlFor="web-research">Enable web research</Label>
                  <p className="text-xs text-muted-foreground">
                    Uses the provider&apos;s web-search/grounding tool for market evidence. Off = model
                    recollection only (treated as low confidence).
                  </p>
                </div>
                <Switch
                  id="web-research"
                  checked={settings.webResearchEnabled}
                  onCheckedChange={(c) => update({ webResearchEnabled: c })}
                />
              </div>
              <div>
                <Label htmlFor="max-calls">Max research calls per evaluation</Label>
                <Input
                  id="max-calls"
                  type="number"
                  min={1}
                  max={10}
                  inputMode="numeric"
                  value={settings.maxResearchCalls}
                  onChange={(e) => update({ maxResearchCalls: Math.max(1, Math.min(10, Number(e.target.value) || 3)) })}
                />
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={async () => {
                setTesting(true);
                setConnection(null);
                try {
                  const res = await apiTestConnection(settings);
                  setConnection(res);
                  if (res.ok) toast.success(res.message);
                  else toast.error(res.message);
                } catch (e) {
                  const message = e instanceof Error ? e.message : "Connection test failed.";
                  setConnection({ ok: false, message, keySource: "none" });
                  toast.error(message);
                } finally {
                  setTesting(false);
                }
              }}
              disabled={testing}
            >
              <Plug /> {testing ? "Testing…" : "Test Connection"}
            </Button>
            {settings.provider !== "demo" && (
              <Button
                variant="outline"
                onClick={() => {
                  clearSessionKey(settings.provider);
                  setKeyValue("");
                  setConnection(null);
                  toast.success("Session key cleared.");
                }}
              >
                <Trash2 /> Clear key
              </Button>
            )}
            {connection && (
              <Badge variant={connection.ok ? "success" : "destructive"}>
                {connection.ok ? <CheckCircle2 aria-hidden className="mr-1 h-3 w-3" /> : <XCircle aria-hidden className="mr-1 h-3 w-3" />}
                {connection.ok
                  ? `Connected (${connection.keySource === "user" ? "session key" : connection.keySource === "environment" ? "env key" : "no key"})`
                  : "Not connected"}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sourcing profile — {settings.profile.name}</CardTitle>
          <CardDescription>
            Defaults for every evaluation. Origin {settings.profile.originZip} → conservative destination{" "}
            {settings.profile.conservativeDestinationZip}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="p-premium">Buyer&apos;s premium (%)</Label>
            <Input id="p-premium" type="number" step="0.1" inputMode="decimal"
              defaultValue={(settings.profile.macBid.buyerPremiumRate * 100).toFixed(1)}
              onBlur={(e) =>
                updateProfile({ macBid: { ...settings.profile.macBid, buyerPremiumRate: (Number(e.target.value) || 0) / 100 } })
              } />
          </div>
          <div>
            <Label htmlFor="p-lot">Lot fee ($)</Label>
            <Input id="p-lot" type="number" step="0.01" inputMode="decimal"
              defaultValue={(settings.profile.macBid.lotFeeCents / 100).toFixed(2)}
              onBlur={(e) =>
                updateProfile({ macBid: { ...settings.profile.macBid, lotFeeCents: dollarsToCents(Number(e.target.value) || 0) } })
              } />
          </div>
          <div>
            <Label htmlFor="p-tax">Sales tax (%)</Label>
            <Input id="p-tax" type="number" step="0.1" inputMode="decimal"
              defaultValue={(settings.profile.macBid.salesTaxRate * 100).toFixed(1)}
              onBlur={(e) =>
                updateProfile({ macBid: { ...settings.profile.macBid, salesTaxRate: (Number(e.target.value) || 0) / 100 } })
              } />
          </div>
          <div>
            <Label htmlFor="p-transfer">Transfer fee ($)</Label>
            <Input id="p-transfer" type="number" step="0.01" inputMode="decimal"
              defaultValue={(settings.profile.macBid.transferFeeCents / 100).toFixed(2)}
              onBlur={(e) =>
                updateProfile({ macBid: { ...settings.profile.macBid, transferFeeCents: dollarsToCents(Number(e.target.value) || 0) } })
              } />
          </div>
          <div className="col-span-2">
            <Label htmlFor="p-category">eBay category (fee profile)</Label>
            <Select
              id="p-category"
              value={settings.profile.ebay.category}
              onChange={(e) => {
                const resolved = resolveCategoryFeeRate(e.target.value);
                updateProfile({
                  ebay: {
                    ...settings.profile.ebay,
                    category: resolved.category,
                    finalValueFeeRate: resolved.rate,
                    isFallbackRate: resolved.isFallback,
                  },
                });
              }}
            >
              {Object.keys(EBAY_CATEGORY_FEE_RATES).map((c) => (
                <option key={c} value={c}>
                  {c} ({(EBAY_CATEGORY_FEE_RATES[c] * 100).toFixed(2)}%)
                </option>
              ))}
              <option value="Unknown">Unknown (fallback non-Store fee assumption)</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="p-fvf">Final value fee (%)</Label>
            <Input id="p-fvf" type="number" step="0.01" inputMode="decimal"
              defaultValue={(settings.profile.ebay.finalValueFeeRate * 100).toFixed(2)}
              onBlur={(e) =>
                updateProfile({ ebay: { ...settings.profile.ebay, finalValueFeeRate: (Number(e.target.value) || 0) / 100 } })
              } />
          </div>
          <div>
            <Label htmlFor="p-per-order">Per-order fee ($)</Label>
            <Input id="p-per-order" type="number" step="0.01" inputMode="decimal"
              defaultValue={(settings.profile.ebay.perOrderFeeCents / 100).toFixed(2)}
              onBlur={(e) =>
                updateProfile({ ebay: { ...settings.profile.ebay, perOrderFeeCents: dollarsToCents(Number(e.target.value) || 0) } })
              } />
          </div>
          <div>
            <Label htmlFor="p-promo">Default promotion (%)</Label>
            <Input id="p-promo" type="number" step="0.1" inputMode="decimal"
              defaultValue={(settings.profile.ebay.promotionRate * 100).toFixed(1)}
              onBlur={(e) =>
                updateProfile({ ebay: { ...settings.profile.ebay, promotionRate: (Number(e.target.value) || 0) / 100 } })
              } />
          </div>
          <div>
            <Label htmlFor="p-buffer">Fee buffer (%)</Label>
            <Input id="p-buffer" type="number" step="0.1" inputMode="decimal"
              defaultValue={(settings.profile.ebay.feeBufferRate * 100).toFixed(1)}
              onBlur={(e) =>
                updateProfile({ ebay: { ...settings.profile.ebay, feeBufferRate: (Number(e.target.value) || 0) / 100 } })
              } />
          </div>
          <div>
            <Label htmlFor="p-min-profit">Min net profit ($)</Label>
            <Input id="p-min-profit" type="number" step="1" inputMode="decimal"
              defaultValue={(settings.profile.thresholds.minNetProfitCents / 100).toFixed(0)}
              onBlur={(e) =>
                updateProfile({
                  thresholds: { ...settings.profile.thresholds, minNetProfitCents: dollarsToCents(Number(e.target.value) || 0) },
                })
              } />
          </div>
          <div>
            <Label htmlFor="p-exp-roi">Expected ROI floor (%)</Label>
            <Input id="p-exp-roi" type="number" inputMode="decimal"
              defaultValue={(settings.profile.thresholds.minExpectedRoi * 100).toFixed(0)}
              onBlur={(e) =>
                updateProfile({
                  thresholds: { ...settings.profile.thresholds, minExpectedRoi: (Number(e.target.value) || 0) / 100 },
                })
              } />
          </div>
          <div>
            <Label htmlFor="p-cons-roi">Conservative ROI floor (%)</Label>
            <Input id="p-cons-roi" type="number" inputMode="decimal"
              defaultValue={(settings.profile.thresholds.minConservativeRoi * 100).toFixed(0)}
              onBlur={(e) =>
                updateProfile({
                  thresholds: { ...settings.profile.thresholds, minConservativeRoi: (Number(e.target.value) || 0) / 100 },
                })
              } />
          </div>
          <div>
            <Label htmlFor="p-cap">Absolute bid cap ($, empty = none)</Label>
            <Input id="p-cap" type="number" step="1" inputMode="decimal"
              defaultValue={
                settings.profile.thresholds.absoluteMaxBidCents !== null
                  ? (settings.profile.thresholds.absoluteMaxBidCents / 100).toFixed(0)
                  : ""
              }
              onBlur={(e) =>
                updateProfile({
                  thresholds: {
                    ...settings.profile.thresholds,
                    absoluteMaxBidCents: e.target.value === "" ? null : dollarsToCents(Number(e.target.value)),
                  },
                })
              } />
          </div>
          <div className="col-span-2">
            <Button
              variant="outline"
              onClick={() => {
                const d = defaultSettings();
                update({ profile: d.profile });
                toast.success("Profile reset to Eric Standard defaults.");
              }}
            >
              Reset profile to Eric Standard
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data &amp; privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>History is stored locally in this browser (IndexedDB) — there is no account or cloud sync in v1.</p>
          <p>
            API keys: session-only by default (sessionStorage). For private local use you can instead set
            OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY on the server — those keys never
            reach the browser.
          </p>
          <p>Screenshots are sent to your selected AI provider for extraction and are not stored server-side.</p>
        </CardContent>
      </Card>
    </div>
  );
}
