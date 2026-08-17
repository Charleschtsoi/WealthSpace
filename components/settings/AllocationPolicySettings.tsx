"use client";

import { useEffect, useState, useTransition } from "react";
import { Target, Loader2, RotateCcw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_ALLOCATION_POLICY,
  clearLocalAllocationPolicy,
  loadLocalAllocationPolicy,
  normalizeAllocationPolicy,
  saveLocalAllocationPolicy,
  type AllocationPolicy,
} from "@/lib/target-allocation";
import { notifyLedgerSaved } from "@/lib/dashboard-local";

function tickersToInput(tickers: string[]): string {
  return tickers.join(", ");
}

function parseTickers(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
}

export function AllocationPolicySettings() {
  const [policy, setPolicy] = useState<AllocationPolicy>(DEFAULT_ALLOCATION_POLICY);
  const [broadPct, setBroadPct] = useState("80");
  const [techPct, setTechPct] = useState("20");
  const [broadTickers, setBroadTickers] = useState("VOO, VXUS");
  const [techTickers, setTechTickers] = useState("NVDA, META");
  const [hint, setHint] = useState<string | null>(null);
  const [usingCustom, setUsingCustom] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const local = loadLocalAllocationPolicy();
    if (!local) return;
    setPolicy(local);
    setUsingCustom(true);
    const broad = local.buckets.find((b) => b.id === "broadIndex");
    const tech = local.buckets.find((b) => b.id === "individualTech");
    setBroadPct(String(Math.round((broad?.targetWeight ?? 0.8) * 100)));
    setTechPct(String(Math.round((tech?.targetWeight ?? 0.2) * 100)));
    setBroadTickers(tickersToInput(broad?.tickers ?? ["VOO", "VXUS"]));
    setTechTickers(tickersToInput(tech?.tickers ?? ["NVDA", "META"]));
  }, []);

  const save = () => {
    startTransition(() => {
      const broadW = Math.max(0, Number(broadPct) || 0) / 100;
      const techW = Math.max(0, Number(techPct) || 0) / 100;
      const next = normalizeAllocationPolicy({
        ...policy,
        buckets: [
          {
            id: "broadIndex",
            label: "Broad index",
            targetWeight: broadW,
            tickers: parseTickers(broadTickers),
          },
          {
            id: "individualTech",
            label: "Individual tech",
            targetWeight: techW,
            tickers: parseTickers(techTickers),
          },
        ],
      });
      saveLocalAllocationPolicy(next);
      setPolicy(next);
      setUsingCustom(true);
      setHint("Saved in this browser. Dashboard drift uses this policy.");
      notifyLedgerSaved();
    });
  };

  const reset = () => {
    startTransition(() => {
      clearLocalAllocationPolicy();
      setPolicy(DEFAULT_ALLOCATION_POLICY);
      setBroadPct("80");
      setTechPct("20");
      setBroadTickers("VOO, VXUS");
      setTechTickers("NVDA, META");
      setUsingCustom(false);
      setHint("Restored default 80/20 VOO·VXUS / NVDA·META policy.");
      notifyLedgerSaved();
    });
  };

  return (
    <Card
      id="allocation-policy"
      className="animate-fade-up border-border/80 bg-card/80 backdrop-blur scroll-mt-24"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <Target className="h-5 w-5 text-primary" />
          Target allocation policy
        </CardTitle>
        <CardDescription>
          Stored in this browser (same pattern as BYOK). Dashboard shows actual
          vs target drift and flags off-policy names. Default matches the advisor
          80% broad index / 20% individual tech profile.
          {usingCustom ? " Custom policy active." : " Using defaults."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="broad-pct">Broad index target %</Label>
            <Input
              id="broad-pct"
              inputMode="decimal"
              value={broadPct}
              onChange={(e) => setBroadPct(e.target.value)}
            />
            <Label htmlFor="broad-tickers" className="text-muted-foreground">
              Preferred tickers
            </Label>
            <Input
              id="broad-tickers"
              value={broadTickers}
              onChange={(e) => setBroadTickers(e.target.value)}
              placeholder="VOO, VXUS"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tech-pct">Individual tech target %</Label>
            <Input
              id="tech-pct"
              inputMode="decimal"
              value={techPct}
              onChange={(e) => setTechPct(e.target.value)}
            />
            <Label htmlFor="tech-tickers" className="text-muted-foreground">
              Preferred tickers
            </Label>
            <Input
              id="tech-tickers"
              value={techTickers}
              onChange={(e) => setTechTickers(e.target.value)}
              placeholder="NVDA, META"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save policy
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={reset}
            disabled={isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to default
          </Button>
        </div>
        {hint && (
          <p className="text-xs text-muted-foreground" role="status">
            {hint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
