import { AllocationPolicySettings } from "@/components/settings/AllocationPolicySettings";
import { ByokSettingsForm } from "@/components/settings/ByokSettingsForm";
import { DataModeSettings } from "@/components/settings/DataModeSettings";
import { getDataModeMeta } from "@/lib/actions/demo-mode";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const mode = await getDataModeMeta();

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
          Configure Bring Your Own Key (BYOK), target allocation policy, and
          demo vs personal ledger mode. Keys and policy stay in this browser
          unless you later add server-side auth.
        </p>
      </header>
      <DataModeSettings
        preference={mode.preference}
        databaseConfigured={mode.databaseConfigured}
      />
      <AllocationPolicySettings />
      <ByokSettingsForm />
    </div>
  );
}