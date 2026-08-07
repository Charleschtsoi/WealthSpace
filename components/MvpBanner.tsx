export function MvpBanner({ usingPlaceholderData }: { usingPlaceholderData: boolean }) {
  return (
    <div className="animate-fade-up rounded-md border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
      <p className="font-medium text-foreground">MVP preview</p>
      <p className="mt-1 text-muted-foreground">
        Dashboard, CSV ingestion, and Weekly AI Advisor are available for testing.
        {usingPlaceholderData
          ? " Showing demo portfolio data — add DATABASE_URL in Vercel to persist real accounts."
          : " Connected to your database."}{" "}
        Advisor needs OPENAI_API_KEY for live suggestions.
      </p>
    </div>
  );
}
