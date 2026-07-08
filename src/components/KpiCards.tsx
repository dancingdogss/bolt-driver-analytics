import type { BoltMetrics } from "@/lib/analytics/calculateBoltMetrics";
import { formatNumber, formatRon } from "@/lib/utils/money";

interface KpiCardsProps {
  metrics: BoltMetrics;
}

/** Top-row KPI cards summarizing the filtered dataset. */
export default function KpiCards({ metrics }: KpiCardsProps) {
  const kpis: { label: string; value: string }[] = [
    { label: "Total trips", value: formatNumber(metrics.totalTrips) },
    { label: "Total revenue", value: formatRon(metrics.totalRevenue) },
    { label: "Avg. trip value", value: formatRon(metrics.averageTripValue) },
    { label: "Revenue excl. VAT", value: formatRon(metrics.revenueWithoutVat) },
    { label: "VAT total", value: formatRon(metrics.vatTotal) },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-sm"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            {kpi.label}
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-zinc-50">
            {kpi.value}
          </p>
        </div>
      ))}
    </div>
  );
}
