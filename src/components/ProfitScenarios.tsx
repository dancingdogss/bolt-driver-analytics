import { TrendingDown, TrendingUp, Target } from "lucide-react";
import type { ProfitScenario } from "@/lib/analytics/estimateProfit";
import { formatPercent, formatRon } from "@/lib/utils/money";

interface ProfitScenariosProps {
  scenarios: ProfitScenario[];
  /** True when the real Bolt fee (PDF) stayed fixed across scenarios. */
  usedMonthlyPdf: boolean;
}

const SCENARIO_META: Record<
  ProfitScenario["id"],
  { icon: React.ReactNode; sub: string; highlight?: boolean }
> = {
  conservative: {
    icon: <TrendingDown className="h-5 w-5 text-amber-400" aria-hidden />,
    sub: "costuri +15%",
  },
  realistic: {
    icon: <Target className="h-5 w-5 text-emerald-400" aria-hidden />,
    sub: "costurile introduse",
    highlight: true,
  },
  optimistic: {
    icon: <TrendingUp className="h-5 w-5 text-sky-400" aria-hidden />,
    sub: "costuri −10%",
  },
};

/**
 * Three simple what-if estimates around the entered costs. Calcul estimativ —
 * the wording stays cautious, never a promise.
 */
export default function ProfitScenarios({
  scenarios,
  usedMonthlyPdf,
}: ProfitScenariosProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold text-zinc-100">Scenarii</h3>
      <p className="mb-4 mt-1 text-sm text-zinc-400">
        Trei estimări simple în jurul costurilor introduse — calcul estimativ,
        nu o promisiune.
        {usedMonthlyPdf &&
          " Taxa Bolt reală din PDF rămâne fixă în toate scenariile."}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {scenarios.map((s) => {
          const meta = SCENARIO_META[s.id];
          const positive = s.estimatedProfit >= 0;
          return (
            <div
              key={s.id}
              className={`rounded-xl border p-4 ${
                meta.highlight
                  ? "border-emerald-800 bg-emerald-950/20"
                  : "border-zinc-700 bg-zinc-800/40"
              }`}
            >
              <p className="flex items-center gap-2 text-base font-semibold text-zinc-100">
                {meta.icon}
                {s.label}
              </p>
              <p className="text-xs text-zinc-400">{meta.sub}</p>

              <p
                className={`mt-3 text-2xl font-bold tabular-nums ${
                  positive ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {formatRon(s.estimatedProfit)}
              </p>
              <p className="text-xs text-zinc-400">profit estimat</p>

              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-400">Profit / cursă</dt>
                  <dd className="tabular-nums text-zinc-200">
                    {formatRon(s.profitPerTrip)}
                  </dd>
                </div>
                {s.profitPerKm !== null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-400">Profit / km</dt>
                    <dd className="tabular-nums text-zinc-200">
                      {formatRon(s.profitPerKm)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-400">Rămâne din venit</dt>
                  <dd className="tabular-nums text-zinc-200">
                    {formatPercent(s.profitMarginPercent)}
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
    </section>
  );
}
