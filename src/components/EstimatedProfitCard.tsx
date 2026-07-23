import { Info } from "lucide-react";
import type { ProfitBreakdown } from "@/lib/analytics/estimateProfit";
import { FREQUENCY_LABELS } from "@/lib/analytics/calculateExpenses";
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
  const highPrecision = b.usedMonthlyPdf;

  // Bolt fee first, then every configured cost line (skip empty ones so the
  // breakdown stays short and readable).
  const boltRow =
    b.boltFeeSource === "real_pdf"
      ? { label: "Taxă Bolt reală", value: b.boltCommissionCost }
      : b.boltFeeSource === "historical_estimate"
        ? {
            label: "Taxă Bolt estimată (pe baza lunilor anterioare)",
            value: b.boltCommissionCost,
            estimate: true,
          }
        : {
            label: "Comision Bolt estimat",
            value: b.boltCommissionCost,
            estimate: true,
          };
  const costRows: {
    label: string;
    value: number;
    estimate?: boolean;
    note?: string;
  }[] = [
    boltRow,
    ...b.expenses.lines
      .filter((line) => line.amount > 0 || line.needsKm)
      .map((line) => ({
        label: line.label,
        value: line.amount,
        note: line.needsKm
          ? "necesită kilometri din PDF"
          : `${formatNumber(line.input.value, line.input.frequency === "perKm" ? 2 : 0)} ${FREQUENCY_LABELS[line.input.frequency]}`,
      })),
  ];

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm sm:p-6">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold text-zinc-100">
          {highPrecision
            ? "Profit estimat cu date reale din PDF"
            : "Profit estimat după costuri"}
        </h3>
        <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-sm font-medium text-zinc-300">
          Calcul estimativ
        </span>
        {b.profitAccuracy === "high" && (
          <span className="rounded-full bg-emerald-950/50 px-2.5 py-0.5 text-sm font-medium text-emerald-300">
            Precizie ridicată
          </span>
        )}
        {b.profitAccuracy === "medium" && (
          <span className="rounded-full bg-amber-950/50 px-2.5 py-0.5 text-sm font-medium text-amber-300">
            Precizie medie
          </span>
        )}
        {b.profitAccuracy === "low" && (
          <span className="rounded-full bg-red-950/50 px-2.5 py-0.5 text-sm font-medium text-red-300">
            Precizie scăzută
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-zinc-400">
        {highPrecision
          ? "Calcul mai precis, pe baza datelor importate (CSV + PDF) ·"
          : "Calcul estimativ, pe baza datelor importate (CSV) ·"}{" "}
        <span className="font-medium text-zinc-200">{rangeLabel}</span> ·{" "}
        {formatNumber(b.trips)} curse
      </p>

      {/* Precision note: real PDF data vs. estimated commission. */}
      {highPrecision ? (
        <div className="mb-5 flex gap-2.5 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm leading-relaxed text-emerald-200">
          <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            Se folosesc <span className="font-medium">Taxă Bolt reală</span> și{" "}
            <span className="font-medium">kilometri reali</span> din rezumatul
            lunar Bolt. Profitul rămâne estimat, dar mai precis — încă lipsesc
            costuri exacte precum service, mentenanță și consum real.
          </p>
        </div>
      ) : (
        <div className="mb-5 flex gap-2.5 rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 text-sm leading-relaxed text-amber-200">
          <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            {DISCLAIMER}{" "}
            <span className="font-medium">
              Încarcă PDF-ul lunar pentru un calcul mai precis.
            </span>
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Breakdown: cum se calculează profitul */}
        <div className="text-base">
          <h4 className="mb-2 text-base font-semibold text-zinc-100">
            Cum se calculează profitul
          </h4>
          <Row label="Venit total" value={formatRon(b.grossRevenue)} strong />
          <div className="my-2 border-t border-zinc-800" />
          {costRows.map((row) => (
            <Row
              key={row.label}
              label={
                <span className="flex flex-wrap items-center gap-1.5">
                  {row.label}
                  {row.estimate && (
                    <span className="rounded bg-amber-950/50 px-1.5 text-xs font-medium text-amber-300">
                      estimare
                    </span>
                  )}
                  {row.note && (
                    <span className="text-xs text-zinc-500">({row.note})</span>
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
          <div className="my-2 border-t border-zinc-800" />
          <Row
            label="Profit estimat"
            value={formatRon(b.estimatedProfit)}
            strong
          />
          <p className="mt-3 text-sm text-zinc-400">
            Calculat pentru {formatNumber(b.selectedDays)} zile calendaristice.
          </p>
          {b.expenses.kmCostSkipped && (
            <p className="mt-2 text-sm text-amber-300">
              Un cost pe km nu a putut fi aplicat: nu există kilometri reali.
              Încarcă PDF-ul lunar Bolt pentru un calcul mai precis.
            </p>
          )}
          <p className="mt-2 text-sm text-zinc-400">
            Profitul este estimativ și depinde de costurile introduse. Nu este
            raport fiscal oficial.
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
              className={`mt-1 text-3xl font-bold tabular-nums break-words sm:text-4xl ${
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

          {/* Per-km metrics — real (PDF) or estimated from previous months. */}
          {b.tripKilometers !== null && (
            <div className="rounded-xl bg-zinc-800/50 p-4">
              <p className="mb-2 text-sm text-zinc-300">
                {b.kilometersSource === "real_pdf"
                  ? "Pe kilometru real"
                  : "Pe kilometru estimat"}{" "}
                ·{" "}
                <span className="tabular-nums text-zinc-100">
                  {formatNumber(b.tripKilometers, 2)} km
                </span>
                {b.kilometersSource === "historical_estimate" && (
                  <span className="ml-1.5 rounded bg-amber-950/50 px-1.5 text-xs font-medium text-amber-300">
                    estimare
                  </span>
                )}
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <KmStat label="Lei / km" value={b.revenuePerKm} />
                <KmStat label="Cost / km" value={b.costPerKm} />
                <KmStat label="Profit / km" value={b.profitPerKm} />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function KmStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-50">
        {value === null ? "—" : formatRon(value)}
      </p>
    </div>
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
