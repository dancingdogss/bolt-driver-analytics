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
import type { HourlyRevenueRow } from "@/lib/analytics/calculateBoltMetrics";
import { formatNumber, formatRon } from "@/lib/utils/money";
import {
  AXIS_TICK,
  CHART_COLORS,
  ChartCard,
  EmptyState,
  GRID_STROKE,
  TOOLTIP_PROPS,
} from "./ChartCard";

interface HourlyRevenueChartProps {
  data: HourlyRevenueRow[];
}

/** Revenue by hour of day (0–23), keyed off the real trip time. */
export default function HourlyRevenueChart({ data }: HourlyRevenueChartProps) {
  const hasData = data.some((d) => d.trips > 0);

  return (
    <ChartCard
      title="Venit pe ore"
      subtitle="La ce ore din zi ai încasat cel mai mult."
    >
      {!hasData ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} interval={1} />
            <YAxis
              tick={AXIS_TICK}
              tickFormatter={(v: number) => formatNumber(v)}
              width={56}
            />
            <Tooltip
              {...TOOLTIP_PROPS}
              formatter={(value) => [formatRon(Number(value)), "Venit"]}
              labelFormatter={(label, payload) => {
                const trips = payload?.[0]?.payload?.trips;
                return `${label}${trips != null ? ` · ${trips} curse` : ""}`;
              }}
            />
            <Bar dataKey="revenue" fill={CHART_COLORS.indigo} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
