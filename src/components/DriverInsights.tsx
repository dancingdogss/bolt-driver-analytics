import type { DriverInsights as DriverInsightsData } from "@/lib/types/analytics";
import { formatNumber, formatPercent, formatRon } from "@/lib/utils/money";

interface DriverInsightsProps {
  insights: DriverInsightsData;
}

/**
 * Card titles for the day/hour/pickup maxima. These describe the HIGHEST or
 * LOWEST observed total in the currently selected period — they are not advice
 * about when to work. The reliability-gated "Recomandări pentru ieșit la lucru"
 * card is the only surface that recommends when to work.
 */
export const INSIGHT_LABELS = {
  bestDay: "Ziua cu cel mai mare venit total",
  worstDay: "Ziua cu cel mai mic venit total",
  bestHour: "Ora cu cel mai mare venit total",
  worstActiveHour: "Ora activă cu cel mai mic venit total",
  mostCommonPickup: "Cea mai frecventă adresă de preluare",
  topRevenuePickup: "Adresa cu cel mai mare venit total",
} as const;

/** The one line clarifying these are retrospective, not future recommendations. */
export const INSIGHTS_PERIOD_DISCLAIMER =
  "Acestea descriu perioada selectată și nu sunt recomandări pentru viitor. " +
  "Pentru sfaturi despre când să ieși la lucru, vezi „Recomandări pentru ieșit la lucru”.";

/** Driver insights as simple text cards, reacting to the active date range. */
export default function DriverInsights({ insights: i }: DriverInsightsProps) {
  const { payments, averages } = i;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm sm:p-6">
      <h3 className="mb-1 text-lg font-semibold text-zinc-100">
        Observații pentru șofer
      </h3>
      <p className="mb-4 text-sm text-zinc-400">
        Cele mai importante concluzii din perioada selectată.
      </p>

      {/* Highest/lowest observed totals in the selected period (descriptive). */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <InsightCard
          title={INSIGHT_LABELS.bestDay}
          value={i.bestDay?.label ?? "—"}
          hint={
            i.bestDay
              ? `${formatRon(i.bestDay.revenue)} din ${formatNumber(i.bestDay.trips)} curse`
              : undefined
          }
        />
        <InsightCard
          title={INSIGHT_LABELS.worstDay}
          value={i.worstDay?.label ?? "—"}
          hint={
            i.worstDay
              ? `${formatRon(i.worstDay.revenue)} din ${formatNumber(i.worstDay.trips)} curse`
              : undefined
          }
        />
        <div className="hidden lg:block" aria-hidden />
        <InsightCard
          title={INSIGHT_LABELS.bestHour}
          value={i.bestHour?.label ?? "—"}
          hint={
            i.bestHour
              ? `${formatRon(i.bestHour.revenue)} din ${formatNumber(i.bestHour.trips)} curse`
              : undefined
          }
        />
        <InsightCard
          title={INSIGHT_LABELS.worstActiveHour}
          value={i.worstActiveHour?.label ?? "—"}
          hint={
            i.worstActiveHour
              ? `${formatRon(i.worstActiveHour.revenue)} din ${formatNumber(i.worstActiveHour.trips)} curse`
              : undefined
          }
        />
        <div className="hidden lg:block" aria-hidden />
        <InsightCard
          title={INSIGHT_LABELS.mostCommonPickup}
          value={i.mostCommonPickup?.address ?? "—"}
          hint={
            i.mostCommonPickup
              ? `${formatNumber(i.mostCommonPickup.trips)} curse · ${formatRon(i.mostCommonPickup.revenue)}`
              : undefined
          }
        />
        <InsightCard
          title={INSIGHT_LABELS.topRevenuePickup}
          value={i.topRevenuePickup?.address ?? "—"}
          hint={
            i.topRevenuePickup
              ? `${formatRon(i.topRevenuePickup.revenue)} · ${formatNumber(i.topRevenuePickup.trips)} curse`
              : undefined
          }
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        {INSIGHTS_PERIOD_DISCLAIMER}
      </p>

      {/* Payment insights */}
      <h4 className="mt-6 mb-3 text-sm font-semibold text-zinc-300">
        Încasări pe metode de plată
      </h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <InsightCard title="Venit numerar" value={formatRon(payments.cashRevenue)} />
        <InsightCard
          title="Venit prin Bolt Payment"
          value={formatRon(payments.boltPaymentRevenue)}
        />
        <InsightCard title="Venit Business" value={formatRon(payments.businessRevenue)} />
        <InsightCard title="Procent numerar" value={formatPercent(payments.cashPercent)} />
        <InsightCard
          title="Procent card / aplicație"
          value={formatPercent(payments.cardPlatformPercent)}
        />
      </div>

      {/* Average daily performance */}
      <h4 className="mt-6 mb-3 text-sm font-semibold text-zinc-300">
        Medii pe zi
      </h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InsightCard
          title="Medie venit / zi activă"
          value={formatRon(averages.averageRevenuePerActiveDay)}
          hint={`${formatNumber(averages.activeDays)} zile active`}
        />
        <InsightCard
          title="Medie curse / zi activă"
          value={formatNumber(averages.averageTripsPerActiveDay, 1)}
        />
        <InsightCard
          title="Profit estimat / zi calendaristică"
          value={formatRon(averages.estimatedProfitPerDay)}
          hint={`${formatNumber(averages.selectedDays)} zile în perioada selectată`}
        />
        <InsightCard
          title="Profit estimat / săptămână"
          value={formatRon(averages.estimatedProfitPerWeek)}
        />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-zinc-400">
        Zilele active înseamnă doar zilele în care au existat curse. Profitul pe
        zi folosește toate zilele din perioada selectată, deoarece costurile
        săptămânale se aplică și când nu lucrezi.
      </p>
    </section>
  );
}

function InsightCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-zinc-800/40 p-4">
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      <p
        className="mt-1 truncate text-lg font-semibold text-zinc-50"
        title={value}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-sm text-zinc-400">{hint}</p>}
    </div>
  );
}
