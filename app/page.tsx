import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { DataModeBanner } from "@/components/DataModeBanner";
import { getDashboardData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const {
    metrics,
    snapshots,
    holdings,
    reconciliationIssues,
    preference,
    usingDemoData,
    usingPlaceholderData,
    isLive,
    databaseConfigured,
  } = await getDashboardData();

  return (
    <div className="space-y-8">
      <header className="animate-fade-up space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Portfolio overview
        </p>
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">
          WealthSpace Dashboard
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          Institutional-grade view of net worth, liquidity, and allocation.
          Numbers come from Postgres when seeded; otherwise demo sample data is
          labeled clearly until you start a personal ledger. Edit the ledger in
          Money — after Save, metrics here refresh from the same source of truth.
        </p>
      </header>

      <DataModeBanner
        preference={preference}
        usingDemoData={usingDemoData}
        isLive={isLive}
        databaseConfigured={databaseConfigured}
      />

      <DashboardClient
        metrics={metrics}
        snapshots={snapshots}
        holdings={holdings}
        reconciliationIssues={reconciliationIssues}
        usingPlaceholderData={usingPlaceholderData}
        showMvpBanner={false}
      />
    </div>
  );
}
