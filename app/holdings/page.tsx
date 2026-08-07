import { HoldingsSpreadsheet } from "@/components/holdings/HoldingsSpreadsheet";

export const dynamic = "force-dynamic";

export default function HoldingsPage() {
  return (
    <div className="space-y-8">
      <header className="animate-fade-up space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Money ledger
        </p>
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">
          Holdings
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          Tweak tickers, quantities, and prices in a spreadsheet. Market value
          recalculates live — same UX as Accounts.
        </p>
      </header>
      <HoldingsSpreadsheet />
    </div>
  );
}
