import type { BoltMetrics } from "@/lib/analytics/calculateBoltMetrics";
import { formatNumber, formatRon } from "@/lib/utils/money";

interface KpiCardsProps {
  metrics: BoltMetrics;
}

interface Kpi {
  label: string;
  value: string;
  hint?: string;
}

/** Top-row KPI cards summarizing the whole dataset. */
export default function KpiCards({ metrics }: KpiCardsProps) {
  const kpis: Kpi[] = [
    { label: "Total curse", value: formatNumber(metrics.totalTrips) },
    { label: "Venit total", value: formatRon(metrics.totalRevenue) },
    { label: "Valoare medie / cursă", value: formatRon(metrics.averageTripValue) },
    { label: "Venit fără TVA", value: formatRon(metrics.revenueWithoutVat) },
    { label: "TVA total", value: formatRon(metrics.vatTotal) },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {kpi.label}
          </p>
          <p className="mt-2 text-xl font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
            {kpi.value}
          </p>
          {kpi.hint && (
            <p className="mt-1 text-xs text-zinc-400">{kpi.hint}</p>
          )}
        </div>
      ))}
    </div>
  );
}
