"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { PlaceholderHolding } from "@/lib/placeholder-data";

type HoldingsTableProps = {
  holdings: PlaceholderHolding[];
};

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  return (
    <Card className="animate-fade-up border-border/80 bg-card/80 backdrop-blur [animation-delay:320ms]">
      <CardHeader>
        <CardTitle className="font-display text-xl">Equity Holdings</CardTitle>
        <CardDescription>Brokerage positions with market value</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Avg</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Market value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((h) => {
              const mv = h.quantity * h.currentPrice;
              return (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.ticker}</TableCell>
                  <TableCell>{h.accountName ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {h.quantity.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(h.averagePrice, h.currency, {
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(h.currentPrice, h.currency, {
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(mv, h.currency)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
