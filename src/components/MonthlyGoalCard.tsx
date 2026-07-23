"use client";

import { CalendarDays, Target } from "lucide-react";
import type {
  GoalProgress,
  MonthlyGoals,
} from "@/lib/analytics/calculateGoalProgress";
import type { MonthStatus } from "@/lib/analytics/monthStatus";
import { formatNumber, formatRon } from "@/lib/utils/money";

interface MonthlyGoalCardProps {
  goals: MonthlyGoals;
  onChange: (goals: MonthlyGoals) => void;
  /** Progress for the selected month, or null when no goal is set. */
  progress: GoalProgress | null;
  /** True when a specific month is selected in the filter. */
  isMonthSelected: boolean;
  /** Status of the selected month, for the data-source note. */
  monthStatus: MonthStatus | null;
}

/** Data-source note tied to the month status (falls back to accuracy). */
function monthStatusNote(
  status: MonthStatus | null,
  accuracy: GoalProgress["accuracy"],
): string {
  if (status === "current_month") {
    return "Luna este în desfășurare. Targetul este calculat pe baza datelor CSV importate până acum, cu estimări pentru Taxa Bolt și kilometri.";
  }
  if (status === "completed_with_pdf") {
    return "Profitul folosește Taxă Bolt reală și kilometri reali din PDF-ul lunar Bolt.";
  }
  if (status === "completed_without_pdf") {
    return "Profitul folosește estimări — încarcă PDF-ul lunar Bolt pentru Taxă Bolt reală și kilometri reali.";
  }
  return accuracy === "high"
    ? "Estimarea profitului are precizie ridicată: PDF lunar Bolt importat."
    : "Estimarea profitului folosește comision Bolt estimat.";
}

interface GoalField {
  key: keyof MonthlyGoals;
  label: string;
  suffix: string;
  max?: number;
}

const FIELDS: GoalField[] = [
  { key: "targetGrossRevenue", label: "Obiectiv venit brut lunar", suffix: "RON" },
  { key: "targetMonthlyProfit", label: "Obiectiv profit estimat lunar", suffix: "RON" },
  { key: "targetDailyProfit", label: "Obiectiv profit zilnic", suffix: "RON" },
  { key: "workDaysPerMonth", label: "Zile de lucru pe lună", suffix: "zile", max: 31 },
];

const STATUS_TEXT: Record<GoalProgress["status"], string> = {
  achieved: "Obiectivul principal pare atins în datele importate.",
  onTrack: "Ritmul actual pare suficient pentru obiectivul lunar.",
  behind: "Ritmul actual pare sub necesar — calcul estimativ.",
  unknown: "Nu sunt destule date pentru a evalua ritmul actual.",
};

const STATUS_CLASS: Record<GoalProgress["status"], string> = {
  achieved: "border-emerald-800 bg-emerald-950/30 text-emerald-200",
  onTrack: "border-emerald-800 bg-emerald-950/30 text-emerald-200",
  behind: "border-amber-800 bg-amber-950/30 text-amber-200",
  unknown: "border-zinc-700 bg-zinc-800/40 text-zinc-300",
};

/**
 * "Obiectiv lunar": the driver sets simple monthly targets and sees, for the
 * selected month, how far along they are and what pace the rest of the month
 * would need. Everything is cautious wording — estimates from imported data.
 */
export default function MonthlyGoalCard({
  goals,
  onChange,
  progress,
  isMonthSelected,
  monthStatus,
}: MonthlyGoalCardProps) {
  function update(key: keyof MonthlyGoals, raw: string) {
    const value = raw === "" ? 0 : Number(raw);
    if (Number.isNaN(value) || value < 0) return;
    onChange({ ...goals, [key]: value });
  }

  return (
    <section
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm sm:p-6"
      aria-label="Obiectiv lunar"
    >
      <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
        <Target className="h-5 w-5 text-zinc-400" aria-hidden />
        Obiectiv lunar
      </h3>
      <p className="mt-1 text-sm text-zinc-400">
        Setează un obiectiv și vezi dacă ritmul actual pare suficient. Calcul
        estimativ pe baza datelor importate.
      </p>

      {/* Goal inputs */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FIELDS.map((field) => (
          <label key={field.key} className="flex flex-col gap-1.5 text-base">
            <span className="text-zinc-300">{field.label}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={field.max}
                step="any"
                value={goals[field.key] || ""}
                placeholder="0"
                onChange={(e) => update(field.key, e.target.value)}
                className="w-full min-w-0 rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2.5 text-base text-zinc-100 tabular-nums focus:border-emerald-500 focus:outline-none"
              />
              <span className="shrink-0 text-sm text-zinc-400">{field.suffix}</span>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-5">
        {!isMonthSelected ? (
          <EmptyState text="Selectează o lună pentru calculul obiectivului." />
        ) : !progress ? (
          <EmptyState text="Setează un obiectiv lunar pentru a vedea progresul." />
        ) : (
          <ProgressBody p={progress} monthStatus={monthStatus} />
        )}
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-700 px-4 py-8 text-center">
      <CalendarDays className="h-7 w-7 text-zinc-500" aria-hidden />
      <p className="text-base text-zinc-300">{text}</p>
    </div>
  );
}

function ProgressBody({
  p,
  monthStatus,
}: {
  p: GoalProgress;
  monthStatus: MonthStatus | null;
}) {
  const daysLabel = p.usesWorkDays ? "zile de lucru rămase" : "zile rămase";

  // For a finished month, state the final outcome plainly. The shortfall is the
  // remaining amount of the primary target (revenue first, otherwise profit).
  const primary = p.revenue ?? p.profit;
  let verdict: string;
  let verdictClass: string;
  if (p.monthEnded) {
    if (p.status === "achieved") {
      verdict = "Obiectiv atins.";
      verdictClass = STATUS_CLASS.achieved;
    } else {
      const missing = primary ? primary.remaining : 0;
      verdict = `Obiectiv neatins pentru această lună. Au lipsit aproximativ ${formatRon(missing)}.`;
      verdictClass = STATUS_CLASS.behind;
    }
  } else {
    verdict = STATUS_TEXT[p.status];
    verdictClass = STATUS_CLASS[p.status];
  }

  return (
    <div className="space-y-4">
      {/* Status verdict */}
      <div className={`rounded-xl border p-4 text-sm ${verdictClass}`}>
        {verdict}
      </div>

      {/* Progress bars */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {p.revenue && (
          <ProgressBar
            title="Progres venit"
            current={p.revenue.current}
            target={p.revenue.target}
            percent={p.revenue.percent}
          />
        )}
        {p.profit && (
          <ProgressBar
            title="Progres profit"
            current={p.profit.current}
            target={p.profit.target}
            percent={p.profit.percent}
          />
        )}
      </div>

      {/* Remaining / pace / trips */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {p.revenue && (
          <InfoCard title="Cât mai lipsește">
            {p.revenue.remaining > 0
              ? `Mai ai nevoie de aproximativ ${formatRon(p.revenue.remaining)} venit ca să atingi obiectivul lunar.`
              : "Obiectivul de venit pare atins în datele importate."}
            {p.profit && p.profit.remaining > 0 && (
              <span className="mt-1 block text-zinc-400">
                Pentru profit: aproximativ {formatRon(p.profit.remaining)}.
              </span>
            )}
          </InfoCard>
        )}
        <InfoCard title="Ritm necesar">
          {p.requiredDailyRevenue !== null || p.requiredDailyProfit !== null ? (
            <>
              {p.requiredDailyRevenue !== null && (
                <>
                  Pentru restul lunii, ai avea nevoie de aproximativ{" "}
                  {formatRon(p.requiredDailyRevenue)} venit pe zi (
                  {formatNumber(p.remainingDays)} {daysLabel}).
                </>
              )}
              {p.requiredDailyProfit !== null && (
                <span className="mt-1 block text-zinc-400">
                  Pentru profit: aproximativ {formatRon(p.requiredDailyProfit)} pe
                  zi.
                </span>
              )}
            </>
          ) : p.monthEnded ? (
            "Luna selectată s-a încheiat — nu mai există zile rămase."
          ) : (
            "Nu există un ritm de calculat pentru obiectivul setat."
          )}
        </InfoCard>
        {p.estimatedTripsNeeded !== null && (
          <InfoCard title="Estimare curse necesare">
            La valoarea medie actuală pe cursă (
            {formatRon(p.averageRevenuePerTrip)}), asta înseamnă aproximativ{" "}
            {formatNumber(p.estimatedTripsNeeded)} curse.
          </InfoCard>
        )}
        {p.dailyProfit && (
          <InfoCard title="Profit zilnic">
            Media actuală pe zi lucrată este aproximativ{" "}
            {formatRon(p.dailyProfit.currentAverage)}, față de obiectivul de{" "}
            {formatRon(p.dailyProfit.target)}.
          </InfoCard>
        )}
      </div>

      {/* Month-status data source + estimate note */}
      <p className="text-sm text-zinc-400">
        {monthStatusNote(monthStatus, p.accuracy)} Calcul estimativ pe baza
        datelor importate.
      </p>
    </div>
  );
}

function ProgressBar({
  title,
  current,
  target,
  percent,
}: {
  title: string;
  current: number;
  target: number;
  percent: number;
}) {
  const width = Math.max(Math.min(percent, 100), 0);
  const reached = percent >= 100;
  return (
    <div className="rounded-xl bg-zinc-800/50 p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-zinc-300">{title}</p>
        <p className="text-sm tabular-nums text-zinc-400">
          {formatNumber(Math.min(percent, 999), 0)}%
        </p>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full bg-zinc-700"
        role="progressbar"
        aria-valuenow={Math.round(width)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={title}
      >
        <div
          className={`h-full rounded-full transition-all ${
            reached ? "bg-emerald-500" : "bg-emerald-600/80"
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-2 text-sm tabular-nums text-zinc-300">
        {formatRon(current)} din {formatRon(target)}
      </p>
    </div>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="mb-1.5 text-sm font-semibold text-zinc-100">{title}</p>
      <p className="text-sm leading-relaxed text-zinc-300">{children}</p>
    </div>
  );
}
