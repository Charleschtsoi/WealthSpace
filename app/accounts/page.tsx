import { AccountsSpreadsheet } from "@/components/accounts/AccountsSpreadsheet";

export const dynamic = "force-dynamic";

export default function AccountsPage() {
  return (
    <div className="space-y-8">
      <header className="animate-fade-up space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Money ledger
        </p>
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">
          Accounts
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          Update bank, brokerage, crypto, and cash balances in a spreadsheet.
          Designed for quick edits — paste from Sheets, save once.
        </p>
      </header>
      <AccountsSpreadsheet />
    </div>
  );
}
