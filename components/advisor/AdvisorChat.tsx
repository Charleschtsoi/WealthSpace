"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AdvisorChatProps = {
  portfolioJson: string;
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

export function AdvisorChat({ portfolioJson }: AdvisorChatProps) {
  const [started, setStarted] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { portfolio: portfolioJson },
      }),
    [portfolioJson]
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
  });

  const isLoading = status === "submitted" || status === "streaming";

  async function generatePlan() {
    setStarted(true);
    setMessages([]);
    await sendMessage({
      text: `Generate this week's fiduciary rebalancing action plan from my portfolio JSON:\n\n${portfolioJson}`,
    });
  }

  return (
    <div className="space-y-6">
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
          </div>
          <Button onClick={generatePlan} disabled={isLoading} className="shrink-0">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Analyzing…" : started ? "Regenerate plan" : "Generate weekly plan"}
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
              {error.message ||
                "Check that OPENAI_API_KEY is set in your environment."}
            </p>
          </div>
        </div>
      )}

      <Card className="animate-fade-up min-h-[280px] border-border/80 bg-card/80 backdrop-blur [animation-delay:100ms]">
        <CardHeader>
          <CardTitle className="font-display text-lg">Weekly action plan</CardTitle>
          <CardDescription>
            Rebalancing guidelines and concentration-risk highlights
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!started && messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Click &ldquo;Generate weekly plan&rdquo; to analyze the current
              portfolio and receive a fiduciary rebalancing checklist.
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
                      Portfolio submitted for analysis
                    </span>
                  ) : (
                    text
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
