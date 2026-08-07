import { ByokSettingsForm } from "@/components/settings/ByokSettingsForm";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <header className="animate-fade-up space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Settings
        </p>
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">
          AI &amp; preferences
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          Configure Bring Your Own Key (BYOK) so the Weekly Advisor runs on your
          provider account. Keys stay in this browser unless you later add
          server-side auth.
        </p>
      </header>
      <ByokSettingsForm />
    </div>
  );
}
