import { AdvisorChat } from "@/components/advisor/AdvisorChat";
import { DataModeBanner } from "@/components/DataModeBanner";
import { getPortfolioForAdvisor } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdvisorPage() {
  const portfolio = await getPortfolioForAdvisor();
  const portfolioJson = JSON.stringify(portfolio, null, 2);

  return (
    <div className="space-y-8">
      <header className="animate-fade-up space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Fiduciary AI
        </p>
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">
          Weekly advisor
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          Portfolio holdings and accounts are serialized to JSON and sent to the
          Vercel AI SDK endpoint for a weekly rebalancing plan against your
          80/20 target allocation.
        </p>
      </header>
      <DataModeBanner
        preference={portfolio.preference}
        usingDemoData={portfolio.usingDemoData}
        isLive={portfolio.isLive}
        databaseConfigured={portfolio.databaseConfigured}
      />
      {/* reconciliationIssues are embedded in portfolio JSON for the model */}
      <AdvisorChat
        portfolioJson={portfolioJson}
        usingDemoData={portfolio.usingDemoData}
      />
    </div>
  );
}
