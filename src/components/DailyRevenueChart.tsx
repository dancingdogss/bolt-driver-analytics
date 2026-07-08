"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyRevenueRow } from "@/lib/analytics/calculateBoltMetrics";
import { formatNumber, formatRon } from "@/lib/utils/money";
import { ChartCard, EmptyState } from "./PaymentSplitChart";

interface DailyRevenueChartProps {
  data: DailyRevenueRow[];
}

/** Revenue per day, keyed off the real trip date (Data călătoriei). */
export default function DailyRevenueChart({ data }: DailyRevenueChartProps) {
  return (
    <ChartCard title="Venit zilnic">
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => formatNumber(v)}
              width={56}
            />
            <Tooltip
              formatter={(value) => [formatRon(Number(value)), "Venit"]}
              labelFormatter={(label, payload) => {
                const trips = payload?.[0]?.payload?.trips;
                return `${label}${trips != null ? ` · ${trips} curse` : ""}`;
              }}
            />
            <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
