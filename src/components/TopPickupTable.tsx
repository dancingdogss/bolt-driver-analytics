import type { TopPickupRow } from "@/lib/analytics/calculateBoltMetrics";
import { formatNumber, formatRon } from "@/lib/utils/money";

interface TopPickupTableProps {
  data: TopPickupRow[];
}

/** Ranked table of the most valuable pickup addresses. */
export default function TopPickupTable({ data }: TopPickupTableProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold text-zinc-100">
        Cele mai bune adrese de preluare
      </h3>
      <p className="mb-4 mt-1 text-sm text-zinc-400">
        De unde au pornit cursele care ți-au adus cel mai mult venit.
      </p>
      {data.length === 0 ? (
        <div className="py-8 text-center text-base text-zinc-400">
          Nu există date pentru perioada selectată
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-sm text-zinc-400">
                <th className="py-2.5 pr-4 font-medium">#</th>
                <th className="py-2.5 pr-4 font-medium">Adresă</th>
                <th className="py-2.5 pr-4 text-right font-medium">Curse</th>
                <th className="py-2.5 text-right font-medium">Venit</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={row.address}
                  className="border-b border-zinc-800/60 last:border-0"
                >
                  <td className="py-2.5 pr-4 tabular-nums text-zinc-400">{i + 1}</td>
                  <td className="max-w-xs truncate py-2.5 pr-4 text-zinc-100">
                    {row.address}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-300">
                    {formatNumber(row.trips)}
                  </td>
                  <td className="py-2.5 text-right font-medium tabular-nums text-zinc-50">
                    {formatRon(row.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
