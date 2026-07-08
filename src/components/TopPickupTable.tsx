import type { TopPickupRow } from "@/lib/analytics/calculateBoltMetrics";
import { formatNumber, formatRon } from "@/lib/utils/money";

interface TopPickupTableProps {
  data: TopPickupRow[];
}

/** Ranked table of the most valuable pickup addresses. */
export default function TopPickupTable({ data }: TopPickupTableProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-zinc-200">
        Top pickup addresses
      </h3>
      {data.length === 0 ? (
        <div className="py-8 text-center text-sm text-zinc-500">
          No data for the selected range
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-400">
                <th className="py-2 pr-4 font-medium">#</th>
                <th className="py-2 pr-4 font-medium">Address</th>
                <th className="py-2 pr-4 text-right font-medium">Trips</th>
                <th className="py-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={row.address}
                  className="border-b border-zinc-800/60 last:border-0"
                >
                  <td className="py-2 pr-4 tabular-nums text-zinc-500">{i + 1}</td>
                  <td className="max-w-xs truncate py-2 pr-4 text-zinc-100">
                    {row.address}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-zinc-300">
                    {formatNumber(row.trips)}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums text-zinc-50">
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
