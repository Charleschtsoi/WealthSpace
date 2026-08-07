export type AiProvider = "openai" | "anthropic";

export type ByokSettings = {
  provider: AiProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
};

export type ByokPublicStatus = {
  configured: boolean;
  provider: AiProvider;
  model: string;
  baseUrl?: string;
  /** Masked hint only — never the full key */
  keyHint: string | null;
};

const STORAGE_KEY = "wealthspace.byok.v1";

const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
};

/** Light obfuscation for localStorage — not a substitute for auth (WS-14). */
function encode(value: string): string {
  if (typeof window === "undefined") return value;
  return btoa(unescape(encodeURIComponent(value)));
}

function decode(value: string): string {
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    return "";
  }
}

export function defaultModelFor(provider: AiProvider): string {
  return DEFAULT_MODELS[provider];
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey) return "";
  if (apiKey.length <= 8) return "••••••••";
  return `${apiKey.slice(0, 3)}••••${apiKey.slice(-4)}`;
}

export function loadByokSettings(): ByokSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      provider?: AiProvider;
      model?: string;
      apiKeyEnc?: string;
      baseUrl?: string;
    };
    const apiKey = parsed.apiKeyEnc ? decode(parsed.apiKeyEnc) : "";
    if (!apiKey) return null;
    const provider = parsed.provider === "anthropic" ? "anthropic" : "openai";
    return {
      provider,
      model: parsed.model || defaultModelFor(provider),
      apiKey,
      baseUrl: parsed.baseUrl || undefined,
    };
  } catch {
    return null;
  }
}

export function saveByokSettings(settings: ByokSettings): void {
  const payload = {
    provider: settings.provider,
    model: settings.model || defaultModelFor(settings.provider),
    apiKeyEnc: encode(settings.apiKey.trim()),
    baseUrl: settings.baseUrl?.trim() || undefined,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearByokSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getByokPublicStatus(): ByokPublicStatus {
  const settings = loadByokSettings();
  if (!settings) {
    return {
      configured: false,
      provider: "openai",
      model: defaultModelFor("openai"),
      keyHint: null,
    };
  }
  return {
    configured: true,
    provider: settings.provider,
    model: settings.model,
    baseUrl: settings.baseUrl,
    keyHint: maskApiKey(settings.apiKey),
  };
}
