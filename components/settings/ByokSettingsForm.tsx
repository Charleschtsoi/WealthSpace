"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { KeyRound, ShieldCheck, Trash2, PlugZap } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clearByokSettings,
  defaultModelFor,
  getByokPublicStatus,
  loadByokSettings,
  maskApiKey,
  saveByokSettings,
  type AiProvider,
} from "@/lib/byok";

export function ByokSettingsForm() {
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [model, setModel] = useState(defaultModelFor("openai"));
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [keyHint, setKeyHint] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const existing = loadByokSettings();
    const pub = getByokPublicStatus();
    if (existing) {
      setProvider(existing.provider);
      setModel(existing.model);
      setBaseUrl(existing.baseUrl ?? "");
      setHasSavedKey(true);
      setKeyHint(pub.keyHint);
      setApiKey("");
    }
  }, []);

  const modelPlaceholder = useMemo(
    () => defaultModelFor(provider),
    [provider]
  );

  function onProviderChange(next: AiProvider) {
    setProvider(next);
    setModel(defaultModelFor(next));
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      const existing = loadByokSettings();
      const nextKey = apiKey.trim() || existing?.apiKey || "";
      if (!nextKey) {
        setStatus("Enter an API key to save.");
        return;
      }
      saveByokSettings({
        provider,
        model: model.trim() || defaultModelFor(provider),
        apiKey: nextKey,
        baseUrl: baseUrl.trim() || undefined,
      });
      setHasSavedKey(true);
      setKeyHint(maskApiKey(nextKey));
      setApiKey("");
      setStatus(
        `Saved ${provider} key locally (${maskApiKey(nextKey)}). It stays in this browser and is only sent to WealthSpace when you run the advisor.`
      );
    });
  }

  function onClear() {
    clearByokSettings();
    setHasSavedKey(false);
    setKeyHint(null);
    setApiKey("");
    setStatus("Cleared local AI key.");
  }

  function onTest() {
    startTransition(async () => {
      const existing = loadByokSettings();
      const key = apiKey.trim() || existing?.apiKey || "";
      if (!key) {
        setStatus("Enter or save an API key before testing.");
        return;
      }
      setStatus("Testing connection…");
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model: model.trim() || defaultModelFor(provider),
          apiKey: key,
          baseUrl: baseUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus(`Test failed: ${data.error || res.statusText}`);
        return;
      }
      setStatus(`Connection OK · ${data.provider} / ${data.model}`);
    });
  }

  return (
    <Card className="animate-fade-up border-border/80 bg-card/80 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <KeyRound className="h-5 w-5 text-primary" />
          BYOK AI provider
        </CardTitle>
        <CardDescription>
          Bring your own OpenAI or Anthropic key. Stored locally in this browser
          (obfuscated). Never shown in full after save. Use{" "}
          <Link href="/advisor" className="underline underline-offset-2">
            AI Advisor
          </Link>{" "}
          after configuring.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSave}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={provider}
                onValueChange={(v) => onProviderChange(v as AiProvider)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={modelPlaceholder}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API key</Label>
            <Input
              id="apiKey"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                hasSavedKey && keyHint
                  ? `Saved ${keyHint} — paste to replace`
                  : "sk-… or Anthropic key"
              }
            />
            {hasSavedKey && keyHint && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Using saved key {keyHint}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseUrl">Base URL (optional)</Label>
            <Input
              id="baseUrl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="Leave blank for provider default"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isPending}>
              Save key
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={onTest}
            >
              <PlugZap className="h-4 w-4" />
              Test connection
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isPending || !hasSavedKey}
              onClick={onClear}
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          </div>

          {status && (
            <p
              className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
              role="status"
            >
              {status}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Server env keys remain a demo fallback. Your BYOK key is preferred
            when present and is not written to server logs.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
