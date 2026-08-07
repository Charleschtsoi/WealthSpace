import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "WealthSpace — Private Wealth Dashboard",
  description:
    "Personal wealth management and investment advisory dashboard with AI rebalancing guidance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <Sidebar />
        <div className="md:pl-64">
          <main className="mx-auto min-h-screen max-w-7xl px-4 pb-12 pt-20 md:px-8 md:pt-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
