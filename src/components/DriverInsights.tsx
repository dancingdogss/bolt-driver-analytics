import type { DriverInsights as DriverInsightsData } from "@/lib/types/analytics";
import { formatNumber, formatPercent, formatRon } from "@/lib/utils/money";

interface DriverInsightsProps {
  insights: DriverInsightsData;
}

/** Driver insights as simple text cards, reacting to the active date range. */
export default function DriverInsights({ insights: i }: DriverInsightsProps) {
  const { payments, averages } = i;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-zinc-200">Driver insights</h3>

      {/* Best / worst days and hours + pickups */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <InsightCard
          title="Best revenue day"
          value={i.bestDay?.label ?? "—"}
          hint={
            i.bestDay
              ? `${formatRon(i.bestDay.revenue)} from ${formatNumber(i.bestDay.trips)} trips`
              : undefined
          }
        />
        <InsightCard
          title="Worst revenue day"
          value={i.worstDay?.label ?? "—"}
          hint={
            i.worstDay
              ? `${formatRon(i.worstDay.revenue)} from ${formatNumber(i.worstDay.trips)} trips`
              : undefined
          }
        />
        <div className="hidden lg:block" aria-hidden />
        <InsightCard
          title="Best revenue hour"
          value={i.bestHour?.label ?? "—"}
          hint={
            i.bestHour
              ? `${formatRon(i.bestHour.revenue)} from ${formatNumber(i.bestHour.trips)} trips`
              : undefined
          }
        />
        <InsightCard
          title="Worst active hour"
          value={i.worstActiveHour?.label ?? "—"}
          hint={
            i.worstActiveHour
              ? `${formatRon(i.worstActiveHour.revenue)} from ${formatNumber(i.worstActiveHour.trips)} trips`
              : undefined
          }
        />
        <div className="hidden lg:block" aria-hidden />
        <InsightCard
          title="Most common pickup"
          value={i.mostCommonPickup?.address ?? "—"}
          hint={
            i.mostCommonPickup
              ? `${formatNumber(i.mostCommonPickup.trips)} trips · ${formatRon(i.mostCommonPickup.revenue)}`
              : undefined
          }
        />
        <InsightCard
          title="Highest revenue pickup"
          value={i.topRevenuePickup?.address ?? "—"}
          hint={
            i.topRevenuePickup
              ? `${formatRon(i.topRevenuePickup.revenue)} · ${formatNumber(i.topRevenuePickup.trips)} trips`
              : undefined
          }
        />
      </div>

      {/* Payment insights */}
      <h4 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Payment insights
      </h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <InsightCard title="Bolt Payment" value={formatRon(payments.boltPaymentRevenue)} />
        <InsightCard title="Numerar (cash)" value={formatRon(payments.cashRevenue)} />
        <InsightCard title="Business" value={formatRon(payments.businessRevenue)} />
        <InsightCard title="Cash %" value={formatPercent(payments.cashPercent)} />
        <InsightCard
          title="Card / platform %"
          value={formatPercent(payments.cardPlatformPercent)}
        />
      </div>

      {/* Average daily performance */}
      <h4 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Average daily performance
      </h4>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InsightCard
          title="Revenue / active day"
          value={formatRon(averages.averageRevenuePerActiveDay)}
          hint={`${formatNumber(averages.activeDays)} active days`}
        />
        <InsightCard
          title="Trips / active day"
          value={formatNumber(averages.averageTripsPerActiveDay, 1)}
        />
        <InsightCard
          title="Est. profit / day"
          value={formatRon(averages.estimatedProfitPerDay)}
          hint={`${formatNumber(averages.selectedDays)} selected days`}
        />
        <InsightCard
          title="Est. profit / week"
          value={formatRon(averages.estimatedProfitPerWeek)}
        />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-zinc-500">
        Active-day averages only count days with trips. Profit/day uses the full
        selected calendar range because weekly costs apply even on inactive days.
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
    <div className="rounded-xl bg-zinc-800/40 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        {title}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-zinc-50" title={value}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}
