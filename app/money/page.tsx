import { Suspense } from "react";
import { MoneyWorkspace } from "@/components/money/MoneyWorkspace";

export const dynamic = "force-dynamic";

export default function MoneyPage() {
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
