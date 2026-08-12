"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  KeyRound,
  FlaskConical,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getByokPublicStatus, loadByokSettings } from "@/lib/byok";
import { ADVISOR_DEMO_ACK_KEY } from "@/lib/demo-mode";

type AdvisorChatProps = {
  portfolioJson: string;
  usingDemoData: boolean;
};

function messageText(message: {
  parts?: Array<{ type: string; text?: string }>;
  content?: string | Array<{ type: string; text?: string }>;
}): string {
  if (message.parts?.length) {
    return message.parts
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text ?? "")
      .join("");
  }
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("");
  }
  return "";
}

export function AdvisorChat({
  portfolioJson,
  usingDemoData,
}: AdvisorChatProps) {
  const [started, setStarted] = useState(false);
  const [byokConfigured, setByokConfigured] = useState(false);
  const [byokHint, setByokHint] = useState<string | null>(null);
  const [demoAcknowledged, setDemoAcknowledged] = useState(!usingDemoData);

  useEffect(() => {
    const status = getByokPublicStatus();
    setByokConfigured(status.configured);
    setByokHint(
      status.configured
        ? `${status.provider} · ${status.model} · ${status.keyHint}`
        : null
    );
  }, []);

  useEffect(() => {
    if (!usingDemoData) {
      setDemoAcknowledged(true);
      return;
    }
    try {
      setDemoAcknowledged(
        window.sessionStorage.getItem(ADVISOR_DEMO_ACK_KEY) === "1"
      );
    } catch {
      setDemoAcknowledged(false);
    }
  }, [usingDemoData]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => {
          const byok = loadByokSettings();
          return {
            portfolio: portfolioJson,
            usingDemoData,
            byok: byok
              ? {
                  provider: byok.provider,
                  model: byok.model,
                  apiKey: byok.apiKey,
                  baseUrl: byok.baseUrl,
                }
              : undefined,
          };
        },
      }),
    [portfolioJson, usingDemoData]
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
  });

  const isLoading = status === "submitted" || status === "streaming";
  const canGenerate = !usingDemoData || demoAcknowledged;

  function acknowledgeDemo(checked: boolean) {
    setDemoAcknowledged(checked);
    try {
      if (checked) {
        window.sessionStorage.setItem(ADVISOR_DEMO_ACK_KEY, "1");
      } else {
        window.sessionStorage.removeItem(ADVISOR_DEMO_ACK_KEY);
      }
    } catch {
      // ignore storage failures
    }
  }

  async function generatePlan() {
    if (!canGenerate) return;
    setStarted(true);
    setMessages([]);
    const preface = usingDemoData
      ? "This is DEMO portfolio data. Produce an ILLUSTRATIVE weekly plan only — do not imply this is the user's real wealth.\n\n"
      : "";
    await sendMessage({
      text: `${preface}Generate this week's fiduciary rebalancing action plan from my portfolio JSON:\n\n${portfolioJson}`,
    });
  }

  return (
    <div className="space-y-6">
      {usingDemoData && (
        <div className="animate-fade-up flex items-start gap-3 rounded-md border border-amber-600/30 bg-amber-500/5 px-4 py-3 text-sm">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
          <div className="space-y-2">
            <p className="font-medium text-foreground">
              Demo portfolio — advice will be labeled illustrative
            </p>
            <p className="text-muted-foreground">
              The advisor is looking at sample holdings, not a personal ledger.{" "}
              <Link href="/" className="underline underline-offset-2">
                Start with my data
              </Link>{" "}
              from the dashboard when you are ready for real guidance context.
            </p>
            <label className="flex items-start gap-2 text-xs text-foreground/90">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border"
                checked={demoAcknowledged}
                onChange={(e) => acknowledgeDemo(e.target.checked)}
              />
              <span>
                I understand this run is illustrative only and is not personal
                financial advice based on my real accounts.
              </span>
            </label>
          </div>
        </div>
      )}

      <Card className="animate-fade-up border-border/80 bg-card/80 backdrop-blur">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Weekly AI Advisor
            </CardTitle>
            <CardDescription className="mt-2 max-w-2xl">
              Fiduciary guidance for a 38-year-old IT PM targeting retirement at
              55. Target mix: 80% broad index (VOO/VXUS) and 20% individual tech
              (NVDA, META). Portfolio holdings and accounts are sent as JSON to
              the advisor endpoint.
            </CardDescription>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5" />
              {byokConfigured ? (
                <span>Using your BYOK key · {byokHint}</span>
              ) : (
                <span>
                  No BYOK key yet —{" "}
                  <Link
                    href="/settings"
                    className="underline underline-offset-2"
                  >
                    configure Settings
                  </Link>{" "}
                  or rely on server env fallback.
                </span>
              )}
            </p>
          </div>
          <Button
            onClick={generatePlan}
            disabled={isLoading || !canGenerate}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading
              ? "Analyzing…"
              : started
                ? "Regenerate plan"
                : usingDemoData
                  ? "Generate illustrative plan"
                  : "Generate weekly plan"}
          </Button>
        </CardHeader>
        <CardContent>
          <details className="rounded-md border border-border bg-muted/30 p-3 text-xs">
            <summary className="cursor-pointer font-medium text-muted-foreground">
              Portfolio payload preview
            </summary>
            <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
              {portfolioJson}
            </pre>
          </details>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Advisor request failed</p>
            <p className="mt-1 text-muted-foreground">
              {error.message || (
                <>
                  Add your key in{" "}
                  <Link href="/settings" className="underline">
                    Settings (BYOK)
                  </Link>{" "}
                  or set a server API key.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <Card className="animate-fade-up min-h-[280px] border-border/80 bg-card/80 backdrop-blur [animation-delay:100ms]">
        <CardHeader>
          <CardTitle className="font-display text-lg">
            {usingDemoData ? "Illustrative weekly action plan" : "Weekly action plan"}
          </CardTitle>
          <CardDescription>
            {usingDemoData
              ? "Labeled illustrative because the portfolio payload is demo data"
              : "Rebalancing guidelines and concentration-risk highlights"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!started && messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {usingDemoData
                ? "Acknowledge the demo disclaimer, then generate an illustrative plan."
                : "Click “Generate weekly plan” to analyze the current portfolio and receive a fiduciary rebalancing checklist."}
            </p>
          )}
          <div className="space-y-4">
            {messages.map((message) => {
              const text = messageText(message);
              if (!text) return null;
              return (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
                      : "prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap rounded-md border border-primary/20 bg-primary/5 px-4 py-4 text-sm leading-relaxed"
                  }
                >
                  {message.role === "user" ? (
                    <span className="text-xs uppercase tracking-[0.12em]">
                      {usingDemoData
                        ? "Demo portfolio submitted (illustrative)"
                        : "Portfolio submitted for analysis"}
                    </span>
                  ) : (
                    <>
                      {usingDemoData && (
                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">
                          Illustrative only — demo data
                        </p>
                      )}
                      {text}
                    </>
                  )}
                </div>
              );
            })}
            {isLoading && (
              <p className="text-sm text-muted-foreground animate-pulse">
                Reviewing allocation drift and concentration…
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
