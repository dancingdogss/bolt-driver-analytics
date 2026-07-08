import { Info } from "lucide-react";
import type { ProfitBreakdown } from "@/lib/analytics/estimateProfit";
import { formatNumber, formatRon } from "@/lib/utils/money";

interface EstimatedProfitCardProps {
  breakdown: ProfitBreakdown;
}

const DISCLAIMER =
  "Aceasta este o estimare. Fișierul CSV Bolt nu include comisionul Bolt exact. " +
  "Comisionul Bolt real necesită raportul lunar Bolt în PDF. Această estimare nu " +
  "include taxe, întreținere, parcare, spălătorie, ajustări contabile sau " +
  "reconciliere cu PDF-ul.";

/** Headline estimated-profit section for the selected date range. */
export default function EstimatedProfitCard({
  breakdown: b,
}: EstimatedProfitCardProps) {
  const profitPositive = b.estimatedProfit >= 0;

  const costRows: { label: string; value: number; estimate?: boolean }[] = [
    { label: "Comision Bolt", value: b.boltCommissionCost, estimate: true },
    { label: "Comision flotă", value: b.fleetCommissionCost },
    { label: "Chirie mașină", value: b.carRentCost },
    { label: "Combustibil", value: b.fuelCost },
    { label: "Carte de muncă", value: b.employmentCost },
  ];

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Profit estimat
        </h3>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          Estimare
        </span>
        <span className="text-xs text-zinc-400">
          {formatNumber(b.selectedDays)} zile · {formatNumber(b.trips)} curse
        </span>
      </div>

      {/* Prominent disclaimer */}
      <div className="mb-5 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{DISCLAIMER}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Breakdown */}
        <div className="text-sm">
          <Row label="Venit brut" value={formatRon(b.grossRevenue)} strong />
          <div className="my-2 border-t border-zinc-100 dark:border-zinc-800" />
          {costRows.map((row) => (
            <Row
              key={row.label}
              label={
                <span className="flex items-center gap-1.5">
                  {row.label}
                  {row.estimate && (
                    <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                      est.
                    </span>
                  )}
                </span>
              }
              value={`− ${formatRon(row.value)}`}
              muted
            />
          ))}
          <div className="my-2 border-t border-zinc-100 dark:border-zinc-800" />
          <Row
            label="Total cheltuieli estimate"
            value={`− ${formatRon(b.totalExpenses)}`}
            strong
          />
        </div>

        {/* Headline numbers */}
        <div className="flex flex-col justify-between gap-4">
          <div
            className={`rounded-xl p-4 ${
              profitPositive
                ? "bg-emerald-50 dark:bg-emerald-950/30"
                : "bg-red-50 dark:bg-red-950/30"
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Profit estimat
            </p>
            <p
              className={`mt-1 text-3xl font-bold tabular-nums ${
                profitPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatRon(b.estimatedProfit)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Profit / cursă
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {formatRon(b.profitPerTrip)}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Marjă de profit
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {b.profitMarginPercent.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: React.ReactNode;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span
        className={
          strong
            ? "font-semibold text-zinc-800 dark:text-zinc-100"
            : muted
              ? "text-zinc-600 dark:text-zinc-300"
              : "text-zinc-700 dark:text-zinc-200"
        }
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${
          strong
            ? "font-semibold text-zinc-900 dark:text-zinc-50"
            : "text-zinc-600 dark:text-zinc-300"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
