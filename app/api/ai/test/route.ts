import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const provider = body.provider === "anthropic" ? "anthropic" : "openai";
    const apiKey = String(body.apiKey ?? "").trim();
    const model =
      String(body.model ?? "").trim() ||
      (provider === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o");
    const baseUrl = String(body.baseUrl ?? "").trim() || undefined;

    if (!apiKey) {
      return Response.json(
        { ok: false, error: "API key is required." },
        { status: 400 }
      );
    }

    const languageModel =
      provider === "anthropic"
        ? createAnthropic({ apiKey, baseURL: baseUrl })(model)
        : createOpenAI({ apiKey, baseURL: baseUrl })(model);

    const result = await generateText({
      model: languageModel,
      prompt: "Reply with exactly: OK",
      maxOutputTokens: 16,
    });

    const text = result.text.trim();
    return Response.json({
      ok: true,
      provider,
      model,
      sample: text.slice(0, 40),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Connection test failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
