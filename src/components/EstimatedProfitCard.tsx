import { Info } from "lucide-react";
import type { ProfitBreakdown } from "@/lib/analytics/estimateProfit";
import { formatNumber, formatPercent, formatRon } from "@/lib/utils/money";

interface EstimatedProfitCardProps {
  breakdown: ProfitBreakdown;
  /** Human label of the active filter range, e.g. "Iunie 2026". */
  rangeLabel: string;
}

/** Exact required disclaimer — do not reword. */
const DISCLAIMER =
  "Atenție: acesta este un calcul estimativ. Fișierele CSV Bolt nu includ " +
  "comisionul Bolt exact. Comisionul real apare în rezumatul lunar Bolt PDF. " +
  "Calculul nu include taxe finale, mentenanță, parcare, spălătorie, " +
  "contabilitate sau alte ajustări.";

/** Headline estimated-profit section for the selected date range. */
export default function EstimatedProfitCard({
  breakdown: b,
  rangeLabel,
}: EstimatedProfitCardProps) {
  const profitPositive = b.estimatedProfit >= 0;

  const costRows: { label: string; value: number; estimate?: boolean }[] = [
    { label: "Comision Bolt estimat", value: b.boltCommissionCost, estimate: true },
    { label: "Comision flotă", value: b.fleetCommissionCost },
    { label: "Chirie mașină", value: b.carRentCost },
    { label: "Combustibil", value: b.fuelCost },
    { label: "Carte de muncă", value: b.employmentCost },
  ];

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm sm:p-6">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold text-zinc-100">
          Profit estimat după costuri
        </h3>
        <span className="rounded-full bg-amber-950/50 px-2.5 py-0.5 text-sm font-medium text-amber-300">
          Estimare
        </span>
      </div>
      <p className="mb-4 text-sm text-zinc-400">
        Calcul orientativ pentru perioada selectată ·{" "}
        <span className="font-medium text-zinc-200">{rangeLabel}</span> ·{" "}
        {formatNumber(b.trips)} curse
      </p>

      {/* Prominent disclaimer */}
      <div className="mb-5 flex gap-2.5 rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 text-sm leading-relaxed text-amber-200">
        <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p>{DISCLAIMER}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Breakdown */}
        <div className="text-base">
          <Row label="Venit total" value={formatRon(b.grossRevenue)} strong />
          <div className="my-2 border-t border-zinc-800" />
          {costRows.map((row) => (
            <Row
              key={row.label}
              label={
                <span className="flex items-center gap-1.5">
                  {row.label}
                  {row.estimate && (
                    <span className="rounded bg-amber-950/50 px-1.5 text-xs font-medium text-amber-300">
                      estimare
                    </span>
                  )}
                </span>
              }
              value={`− ${formatRon(row.value)}`}
              muted
            />
          ))}
          <div className="my-2 border-t border-zinc-800" />
          <Row
            label="Total costuri estimate"
            value={`− ${formatRon(b.totalExpenses)}`}
            strong
          />
          <p className="mt-3 text-sm text-zinc-400">
            Calculat pentru {formatNumber(b.selectedDays)} zile calendaristice.
          </p>
        </div>

        {/* Headline numbers */}
        <div className="flex flex-col justify-between gap-4">
          <div
            className={`rounded-xl p-5 ${
              profitPositive ? "bg-emerald-950/30" : "bg-red-950/30"
            }`}
          >
            <p className="text-sm font-medium text-zinc-300">Profit estimat</p>
            <p
              className={`mt-1 text-4xl font-bold tabular-nums ${
                profitPositive ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatRon(b.estimatedProfit)}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-zinc-800/50 p-4">
              <p className="text-sm text-zinc-300">Profit / cursă</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-50">
                {formatRon(b.profitPerTrip)}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-800/50 p-4">
              <p className="text-sm text-zinc-300">Marjă profit</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-50">
                {formatPercent(b.profitMarginPercent)}
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
    <div className="flex items-center justify-between py-1.5">
      <span
        className={
          strong
            ? "font-semibold text-zinc-100"
            : muted
              ? "text-zinc-300"
              : "text-zinc-200"
        }
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${
          strong ? "font-semibold text-zinc-50" : "text-zinc-300"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
