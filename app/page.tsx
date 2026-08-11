import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { NetWorthChart } from "@/components/dashboard/NetWorthChart";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { HoldingsTable } from "@/components/dashboard/HoldingsTable";
import { MvpBanner } from "@/components/MvpBanner";
import { getDashboardData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { metrics, snapshots, holdings, usingPlaceholderData } =
    await getDashboardData();

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
          Numbers come from Postgres when seeded; otherwise the demo profile
          keeps the UI usable without a database.
        </p>
      </header>

      {usingPlaceholderData ? (
        <MvpBanner usingPlaceholderData />
      ) : null}

      <SummaryCards
        totalNetWorth={metrics.totalNetWorth}
        liquidCash={metrics.liquidCash}
        totalInvested={metrics.totalInvested}
      />

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <NetWorthChart data={snapshots} />
        </div>
        <div className="xl:col-span-2">
          <AllocationChart data={metrics.allocation} />
        </div>
      </div>

      <HoldingsTable holdings={holdings} />
    </div>
  );
}
