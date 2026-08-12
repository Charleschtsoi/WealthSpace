import { Suspense } from "react";
import { MoneyWorkspace } from "@/components/money/MoneyWorkspace";
import { DataModeBanner } from "@/components/DataModeBanner";
import { getDashboardData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MoneyPage() {
  const { preference, usingDemoData, isLive, databaseConfigured } =
    await getDashboardData();

  return (
    <div className="space-y-8">
      <header className="animate-fade-up space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Money workspace
        </p>
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">
          Money
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          One place for day-to-day books: edit accounts, holdings, and
          transactions like a spreadsheet, import CSV, then check recent saves.
          Dashboard metrics refresh from the same source after you Save.
        </p>
      </header>
      <DataModeBanner
        preference={preference}
        usingDemoData={usingDemoData}
        isLive={isLive}
        databaseConfigured={databaseConfigured}
      />
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">Loading workspace…</p>
        }
      >
        <MoneyWorkspace />
      </Suspense>
    </div>
  );
}
