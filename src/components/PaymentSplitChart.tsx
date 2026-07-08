"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { PaymentSplitRow } from "@/lib/analytics/calculateBoltMetrics";
import { formatRon } from "@/lib/utils/money";
import { ChartCard, EmptyState, TOOLTIP_PROPS } from "./ChartCard";

interface PaymentSplitChartProps {
  data: PaymentSplitRow[];
}

/** Stable colors per known payment method, with a fallback palette. */
const METHOD_COLORS: Record<string, string> = {
  "Bolt Payment": "#10b981",
  Numerar: "#f59e0b",
  Business: "#6366f1",
};
const FALLBACK_COLORS = ["#64748b", "#0ea5e9", "#ec4899", "#84cc16"];

function colorFor(method: string, index: number): string {
  return METHOD_COLORS[method] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export default function PaymentSplitChart({ data }: PaymentSplitChartProps) {
  return (
    <ChartCard title="Payment method">
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="revenue"
              nameKey="method"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((row, i) => (
                <Cell key={row.method} fill={colorFor(row.method, i)} />
              ))}
            </Pie>
            <Tooltip
              {...TOOLTIP_PROPS}
              formatter={(value, _name, item) => [
                `${formatRon(Number(value))} · ${((item?.payload?.share ?? 0) * 100).toFixed(1)}%`,
                item?.payload?.method,
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
