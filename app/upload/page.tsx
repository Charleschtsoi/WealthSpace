import { DataUploader } from "@/components/DataUploader";

export default function UploadPage() {
  return (
    <div className="space-y-8">
      <header className="animate-fade-up space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Data ingestion
        </p>
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">
          Import &amp; update accounts
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          Bank APIs are restricted — upload CSV statements or enter balances
          manually. Imports map to Prisma <code className="text-xs">Account</code>{" "}
          and <code className="text-xs">Transaction</code> tables.
        </p>
      </header>
      <DataUploader />
    </div>
  );
}
