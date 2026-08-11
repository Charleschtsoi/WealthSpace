export function MvpBanner({ usingPlaceholderData }: { usingPlaceholderData: boolean }) {
  if (!usingPlaceholderData) {
    return null;
  }

  return (
    <div className="animate-fade-up rounded-md border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
      <p className="font-medium text-foreground">Demo portfolio data</p>
      <p className="mt-1 text-muted-foreground">
        Showing built-in placeholders. Set <code className="text-xs">DATABASE_URL</code>,
        run <code className="text-xs">npx prisma db push</code> and{" "}
        <code className="text-xs">npm run db:seed</code> to load the Hang Seng / Firstrade /
        Property seed. Advisor needs an API key (Settings BYOK or server env) for live
        suggestions.
      </p>
    </div>
  );
}
