import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT =
  "You are a fiduciary wealth advisor. The user is a 38-year-old IT Project Manager planning for retirement at 55. Their target allocation is 80% Broad Index (VOO/VXUS) and 20% Individual Tech (NVDA, META). Analyze their current portfolio and provide a weekly rebalancing guideline, highlighting concentration risks.";

type ByokPayload = {
  provider?: "openai" | "anthropic";
  model?: string;
  apiKey?: string;
  baseUrl?: string;
};

function resolveModel(byok?: ByokPayload) {
  const provider = byok?.provider ?? "openai";
  const apiKey = byok?.apiKey?.trim() || undefined;
  const serverKey =
    provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY;

  const key = apiKey || serverKey;
  if (!key) {
    return {
      error:
        "No AI API key configured. Add your key in Settings (BYOK) or set OPENAI_API_KEY / ANTHROPIC_API_KEY on the server.",
    } as const;
  }

  const modelId =
    byok?.model ||
    (provider === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o");

  if (provider === "anthropic") {
    const anthropic = createAnthropic({
      apiKey: key,
      baseURL: byok?.baseUrl || undefined,
    });
    return { model: anthropic(modelId), source: apiKey ? "byok" : "server" } as const;
  }

  const openai = createOpenAI({
    apiKey: key,
    baseURL: byok?.baseUrl || undefined,
  });
  return { model: openai(modelId), source: apiKey ? "byok" : "server" } as const;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = (body.messages ?? []) as UIMessage[];
    const portfolio =
      typeof body.portfolio === "string"
        ? body.portfolio
        : JSON.stringify(body.portfolio ?? {});
    const byok = body.byok as ByokPayload | undefined;

    const resolved = resolveModel(byok);
    if ("error" in resolved) {
      return new Response(JSON.stringify({ error: resolved.error }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = streamText({
      model: resolved.model,
      system: `${SYSTEM_PROMPT}

Current portfolio JSON for analysis:
${portfolio}

Respond with a concise weekly action plan covering:
1) Current vs target allocation drift
2) Concentration risks (single-name / sector)
3) Specific rebalancing trades or cash deployment for this week
4) Risks and caveats (not personalized legal/tax advice)`,
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse({
      headers: {
        "X-WealthSpace-AI-Source": resolved.source,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate advice";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
