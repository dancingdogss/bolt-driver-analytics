"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { PaymentSplitRow } from "@/lib/analytics/calculateBoltMetrics";
import { formatRon } from "@/lib/utils/money";
import { paymentMethodLabel } from "@/lib/utils/labels";
import { CHART_COLORS, ChartCard, EmptyState, TOOLTIP_PROPS } from "./ChartCard";

interface PaymentSplitChartProps {
  data: PaymentSplitRow[];
}

/**
 * Stable colors per known raw payment method (colors follow the entity, not
 * its rank), with a fallback palette for unexpected methods.
 */
const METHOD_COLORS: Record<string, string> = {
  "Bolt Payment": CHART_COLORS.emerald,
  Numerar: CHART_COLORS.amber,
  Business: CHART_COLORS.indigo,
};
const FALLBACK_COLORS = ["#64748b", "#0ea5e9", "#ec4899", "#84cc16"];

function colorFor(method: string, index: number): string {
  return METHOD_COLORS[method] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export default function PaymentSplitChart({ data }: PaymentSplitChartProps) {
  // Translate only the display name; `method` stays the raw CSV value.
  const displayData = data.map((row) => ({
    ...row,
    displayMethod: paymentMethodLabel(row.method),
  }));

  return (
    <ChartCard
      title="Metode de plată"
      subtitle="Cât ai încasat în numerar, prin aplicație sau de la firme."
    >
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={displayData}
              dataKey="revenue"
              nameKey="displayMethod"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              stroke="none"
            >
              {displayData.map((row, i) => (
                <Cell key={row.method} fill={colorFor(row.method, i)} />
              ))}
            </Pie>
            <Tooltip
              {...TOOLTIP_PROPS}
              formatter={(value, _name, item) => [
                `${formatRon(Number(value))} · ${((item?.payload?.share ?? 0) * 100).toFixed(1)}%`,
                item?.payload?.displayMethod,
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 14, color: "#a1a1aa" }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
