import type { TopPickupRow } from "@/lib/analytics/calculateBoltMetrics";
import { formatNumber, formatRon } from "@/lib/utils/money";

interface TopPickupTableProps {
  data: TopPickupRow[];
}

/** Ranked table of the most valuable pickup addresses. */
export default function TopPickupTable({ data }: TopPickupTableProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        Top adrese de preluare
      </h3>
      {data.length === 0 ? (
        <div className="py-8 text-center text-sm text-zinc-400">Nu există date</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="py-2 pr-4 font-medium">#</th>
                <th className="py-2 pr-4 font-medium">Adresă</th>
                <th className="py-2 pr-4 text-right font-medium">Curse</th>
                <th className="py-2 text-right font-medium">Venit</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={row.address}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  <td className="py-2 pr-4 text-zinc-400 tabular-nums">{i + 1}</td>
                  <td className="max-w-xs truncate py-2 pr-4 text-zinc-800 dark:text-zinc-100">
                    {row.address}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                    {formatNumber(row.trips)}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
                    {formatRon(row.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
