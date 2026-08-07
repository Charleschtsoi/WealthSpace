"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, Wallet, PieChart } from "lucide-react";

type SummaryCardsProps = {
  totalNetWorth: number;
  liquidCash: number;
  totalInvested: number;
};

const items = [
  {
    key: "netWorth" as const,
    label: "Total Net Worth",
    icon: TrendingUp,
    accent: "text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "liquidCash" as const,
    label: "Liquid Cash",
    icon: Wallet,
    accent: "text-sky-600 dark:text-sky-400",
  },
  {
    key: "totalInvested" as const,
    label: "Total Invested",
    icon: PieChart,
    accent: "text-amber-600 dark:text-amber-400",
  },
];

export function SummaryCards({
  totalNetWorth,
  liquidCash,
  totalInvested,
}: SummaryCardsProps) {
  const values = { netWorth: totalNetWorth, liquidCash, totalInvested };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <Card
            key={item.key}
            className="animate-fade-up border-border/80 bg-card/80 backdrop-blur"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardDescription className="text-xs uppercase tracking-[0.12em]">
                  {item.label}
                </CardDescription>
                <CardTitle className="mt-2 font-display text-2xl tracking-tight md:text-3xl">
                  {formatCurrency(values[item.key])}
                </CardTitle>
              </div>
              <div
                className={`rounded-md bg-muted p-2 ${item.accent}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                As of latest account snapshot
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
