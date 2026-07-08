import { Info } from "lucide-react";
import type { ProfitBreakdown } from "@/lib/analytics/estimateProfit";
import { formatNumber, formatPercent, formatRon } from "@/lib/utils/money";

interface EstimatedProfitCardProps {
  breakdown: ProfitBreakdown;
  /** Human label of the active filter range, e.g. "June 2026". */
  rangeLabel: string;
}

/** Exact required disclaimer — do not reword. */
const DISCLAIMER =
  "This is an estimate. Bolt CSV files do not include exact Bolt commission. " +
  "Actual Bolt commission requires the monthly Bolt summary PDF. This estimate " +
  "does not include taxes, maintenance, parking, car wash, accounting " +
  "adjustments, or PDF reconciliation.";

/** Headline estimated-profit section for the selected date range. */
export default function EstimatedProfitCard({
  breakdown: b,
  rangeLabel,
}: EstimatedProfitCardProps) {
  const profitPositive = b.estimatedProfit >= 0;

  const costRows: { label: string; value: number; estimate?: boolean }[] = [
    { label: "Bolt commission", value: b.boltCommissionCost, estimate: true },
    { label: "Fleet commission", value: b.fleetCommissionCost },
    { label: "Car rent", value: b.carRentCost },
    { label: "Fuel cost", value: b.fuelCost },
    { label: "Employment (carte de muncă)", value: b.employmentCost },
  ];

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-200">Estimated profit</h3>
        <span className="rounded-full bg-amber-950/50 px-2 py-0.5 text-xs font-medium text-amber-300">
          Estimate
        </span>
        <span className="ml-auto text-xs text-zinc-400">
          Range:{" "}
          <span className="font-medium text-zinc-200">{rangeLabel}</span> ·{" "}
          {formatNumber(b.selectedDays)} days used for weekly cost conversion ·{" "}
          {formatNumber(b.trips)} trips
        </span>
      </div>

      {/* Prominent disclaimer */}
      <div className="mb-5 flex gap-2 rounded-xl border border-amber-900/50 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{DISCLAIMER}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Breakdown */}
        <div className="text-sm">
          <Row label="Gross revenue" value={formatRon(b.grossRevenue)} strong />
          <div className="my-2 border-t border-zinc-800" />
          {costRows.map((row) => (
            <Row
              key={row.label}
              label={
                <span className="flex items-center gap-1.5">
                  {row.label}
                  {row.estimate && (
                    <span className="rounded bg-amber-950/50 px-1 text-[10px] font-medium text-amber-300">
                      est.
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
            label="Total estimated expenses"
            value={`− ${formatRon(b.totalExpenses)}`}
            strong
          />
        </div>

        {/* Headline numbers */}
        <div className="flex flex-col justify-between gap-4">
          <div
            className={`rounded-xl p-4 ${
              profitPositive ? "bg-emerald-950/30" : "bg-red-950/30"
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Estimated profit
            </p>
            <p
              className={`mt-1 text-3xl font-bold tabular-nums ${
                profitPositive ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatRon(b.estimatedProfit)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-zinc-800/50 p-3">
              <p className="text-xs text-zinc-400">Profit / trip</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-50">
                {formatRon(b.profitPerTrip)}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-800/50 p-3">
              <p className="text-xs text-zinc-400">Profit margin</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-50">
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
    <div className="flex items-center justify-between py-1">
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
