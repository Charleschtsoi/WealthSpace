"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

type AllocationSlice = {
  name: string;
  value: number;
  fill: string;
};

type AllocationChartProps = {
  data: AllocationSlice[];
};

export function AllocationChart({ data }: AllocationChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="animate-fade-up border-border/80 bg-card/80 backdrop-blur [animation-delay:240ms]">
      <CardHeader>
        <CardTitle className="font-display text-xl">Asset Allocation</CardTitle>
        <CardDescription>Cash vs. equities vs. property</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={100}
                paddingAngle={3}
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--foreground))",
                }}
                formatter={(value, name) => [
                  formatCurrency(Number(value ?? 0)),
                  String(name),
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 space-y-2">
          {data.map((slice) => {
            const pct = total ? (slice.value / total) * 100 : 0;
            return (
              <li
                key={slice.name}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ background: slice.fill }}
                  />
                  {slice.name}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {pct.toFixed(1)}% · {formatCurrency(slice.value)}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
