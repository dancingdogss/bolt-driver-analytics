import type { MonthlyRevenueRow } from "@/lib/analytics/dateFilter";
import { formatNumber, formatRon } from "@/lib/utils/money";

interface RevenueByMonthTableProps {
  data: MonthlyRevenueRow[];
  /** Month key currently selected in the filter, if any. */
  activeKey?: string;
  /** Click a row to filter the dashboard to that month. */
  onSelectMonth?: (key: string) => void;
}

/**
 * Always computed from the full dataset (never file names) so month totals can
 * be verified independently of the active filter.
 */
export default function RevenueByMonthTable({
  data,
  activeKey,
  onSelectMonth,
}: RevenueByMonthTableProps) {
  const totalTrips = data.reduce((s, r) => s + r.trips, 0);
  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-zinc-200">
        Revenue by month{" "}
        <span className="font-normal text-zinc-500">(all data)</span>
      </h3>
      {data.length === 0 ? (
        <div className="py-8 text-center text-sm text-zinc-500">No data</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-400">
                <th className="py-2 pr-4 font-medium">Month</th>
                <th className="py-2 pr-4 text-right font-medium">Trips</th>
                <th className="py-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const active = row.key === activeKey;
                return (
                  <tr
                    key={row.key}
                    onClick={() => onSelectMonth?.(row.key)}
                    className={`border-b border-zinc-800/60 last:border-0 ${
                      onSelectMonth ? "cursor-pointer" : ""
                    } ${
                      active
                        ? "bg-emerald-950/40"
                        : "hover:bg-zinc-800/40"
                    }`}
                  >
                    <td className="py-2 pr-4 font-medium text-zinc-100">
                      {row.label}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-zinc-300">
                      {formatNumber(row.trips)}
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums text-zinc-50">
                      {formatRon(row.revenue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-700">
                <td className="py-2 pr-4 font-semibold text-zinc-200">Total</td>
                <td className="py-2 pr-4 text-right font-semibold tabular-nums text-zinc-200">
                  {formatNumber(totalTrips)}
                </td>
                <td className="py-2 text-right font-semibold tabular-nums text-zinc-50">
                  {formatRon(totalRevenue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
