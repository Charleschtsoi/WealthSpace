import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT =
  "You are a fiduciary wealth advisor. The user is a 38-year-old IT Project Manager planning for retirement at 55. Their target allocation is 80% Broad Index (VOO/VXUS) and 20% Individual Tech (NVDA, META). Analyze their current portfolio and provide a weekly rebalancing guideline, highlighting concentration risks.";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = (body.messages ?? []) as UIMessage[];
    const portfolio =
      typeof body.portfolio === "string"
        ? body.portfolio
        : JSON.stringify(body.portfolio ?? {});

    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "OPENAI_API_KEY is not configured. Add it to your environment to enable the Weekly AI Advisor.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = streamText({
      model: openai("gpt-4o"),
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

    return result.toUIMessageStreamResponse();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate advice";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
