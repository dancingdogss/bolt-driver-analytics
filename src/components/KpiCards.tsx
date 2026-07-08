import type { BoltMetrics } from "@/lib/analytics/calculateBoltMetrics";
import { formatNumber, formatRon } from "@/lib/utils/money";

interface KpiCardsProps {
  metrics: BoltMetrics;
  /** Simple mode: show only trips + total revenue. */
  simple?: boolean;
}

interface Kpi {
  label: string;
  value: string;
  help: string;
}

/** Top-row KPI cards summarizing the filtered dataset. */
export default function KpiCards({ metrics, simple = false }: KpiCardsProps) {
  const allKpis: Kpi[] = [
    {
      label: "Total curse",
      value: formatNumber(metrics.totalTrips),
      help: "Numărul de facturi/călătorii importate",
    },
    {
      label: "Venit total încasat",
      value: formatRon(metrics.totalRevenue),
      help: "Suma totală din fișierele CSV",
    },
    {
      label: "Valoare medie / cursă",
      value: formatRon(metrics.averageTripValue),
      help: "Venit total împărțit la numărul de curse",
    },
    {
      label: "Venit fără TVA",
      value: formatRon(metrics.revenueWithoutVat),
      help: "Suma înainte de TVA",
    },
    {
      label: "TVA total",
      value: formatRon(metrics.vatTotal),
      help: "TVA calculat din facturile Bolt",
    },
  ];

  const kpis = simple ? allKpis.slice(0, 2) : allKpis;

  return (
    <div
      className={`grid gap-4 ${
        simple
          ? "grid-cols-1 sm:grid-cols-2"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
      }`}
    >
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm"
        >
          <p className="text-sm font-medium text-zinc-300">{kpi.label}</p>
          <p
            className={`mt-2 font-bold tabular-nums text-zinc-50 ${
              simple ? "text-3xl" : "text-2xl"
            }`}
          >
            {kpi.value}
          </p>
          <p className="mt-2 text-sm leading-snug text-zinc-400">{kpi.help}</p>
        </div>
      ))}
    </div>
  );
}
