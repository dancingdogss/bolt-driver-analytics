import { ArrowDownRight, ArrowRight, ArrowUpRight, GitCompareArrows, Lightbulb } from "lucide-react";
import type {
  ChangeDirection,
  MetricDelta,
  MonthComparison,
} from "@/lib/analytics/calculateMonthComparison";
import {
  deriveMonthComparisonInsights,
  type ComparisonInsight,
} from "@/lib/analytics/deriveMonthComparisonInsights";
import type { ProfitAccuracy } from "@/lib/analytics/estimateProfit";
import { formatNumber, formatPercent, formatRon } from "@/lib/utils/money";

/** Why a comparison can't be shown, when `comparison` is null. */
export type ComparisonUnavailableReason = "current_incomplete" | "no_previous";

interface MonthComparisonCardProps {
  comparison: MonthComparison | null;
  unavailableReason: ComparisonUnavailableReason | null;
}

const ACCURACY_TEXT: Record<ProfitAccuracy, string> = {
  high: "Precizie ridicată",
  medium: "Precizie medie",
  low: "Precizie scăzută",
};

const ACCURACY_CLASS: Record<ProfitAccuracy, string> = {
  high: "bg-emerald-950/50 text-emerald-300",
  medium: "bg-amber-950/50 text-amber-300",
  low: "bg-red-950/50 text-red-300",
};

type Formatter = (value: number) => string;
const asRon: Formatter = (v) => formatRon(v);
const asCount: Formatter = (v) => formatNumber(v);

/** A signed absolute value, e.g. "+2.000,00 RON" / "−40". */
function signedAbsolute(delta: MetricDelta, format: Formatter): string {
  if (delta.direction === "flat") return format(0);
  const sign = delta.absolute > 0 ? "+" : "−";
  return `${sign}${format(Math.abs(delta.absolute))}`;
}

/** A signed percentage, or an em dash when undefined (previous value was 0). */
function signedPercent(delta: MetricDelta): string {
  if (delta.percent === null) return "—";
  if (delta.direction === "flat") return formatPercent(0);
  const sign = delta.percent > 0 ? "+" : "−";
  return `${sign}${formatPercent(Math.abs(delta.percent))}`;
}

/**
 * Directional colour classes. Trip count passes `neutral` so more/fewer trips
 * is never framed as automatically good or bad — only informational.
 */
function directionClass(direction: ChangeDirection, neutral: boolean): string {
  if (neutral || direction === "flat") return "text-zinc-300";
  return direction === "up" ? "text-emerald-400" : "text-red-400";
}

function DirectionIcon({
  direction,
  className,
}: {
  direction: ChangeDirection;
  className: string;
}) {
  const Icon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : ArrowRight;
  return <Icon className={`h-4 w-4 shrink-0 ${className}`} aria-hidden />;
}

function MetricRow({
  label,
  delta,
  format,
  neutral,
}: {
  label: string;
  delta: MetricDelta;
  format: Formatter;
  /** Trip count uses neutral styling instead of green/red. */
  neutral: boolean;
}) {
  const colour = directionClass(delta.direction, neutral);
  return (
    <div className="rounded-xl bg-zinc-800/50 p-4">
      <p className="text-sm text-zinc-300">{label}</p>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className="text-lg font-semibold tabular-nums text-zinc-100">
          {format(delta.current)}
        </p>
        <div className={`flex items-center gap-1 text-sm font-medium tabular-nums ${colour}`}>
          <DirectionIcon direction={delta.direction} className={colour} />
          <span>{signedAbsolute(delta, format)}</span>
          <span className="text-zinc-500">·</span>
          <span>{signedPercent(delta)}</span>
        </div>
      </div>
      <p className="mt-1 text-xs text-zinc-400">
        Luna anterioară:{" "}
        <span className="tabular-nums text-zinc-300">{format(delta.previous)}</span>
      </p>
    </div>
  );
}

function AccuracyBadge({ label, accuracy }: { label: string; accuracy: ProfitAccuracy }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
      {label}
      <span className={`rounded px-1.5 ${ACCURACY_CLASS[accuracy]}`}>
        {ACCURACY_TEXT[accuracy]}
      </span>
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-3 flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-700 px-4 py-8 text-center">
      <GitCompareArrows className="h-7 w-7 text-zinc-500" aria-hidden />
      <p className="text-base text-zinc-300">{text}</p>
    </div>
  );
}

const INSIGHT_TONE_CLASS: Record<ComparisonInsight["tone"], string> = {
  positive: "border-l-emerald-500",
  negative: "border-l-red-500",
  neutral: "border-l-zinc-500",
};

/** Up to three cautious, relational observations about the two months. */
function InsightList({ insights }: { insights: ComparisonInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
        <Lightbulb className="h-4 w-4 text-zinc-400" aria-hidden />
        Ce spun datele
      </p>
      <ul className="space-y-2">
        {insights.map((insight) => (
          <li
            key={insight.id}
            className={`rounded-lg border-l-2 bg-zinc-800/50 px-3 py-2.5 text-sm leading-relaxed text-zinc-200 ${INSIGHT_TONE_CLASS[insight.tone]}`}
          >
            {insight.text}
            {insight.qualifyProfitAccuracy && (
              <span className="mt-1.5 block rounded bg-amber-950/50 px-2 py-1 text-xs font-medium text-amber-300">
                Precizie scăzută pentru profit — interpretează cu prudență.
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "Comparație lună": compares the selected completed month against the nearest
 * earlier imported month. Revenue/profit/per-day use green/red directional
 * styling; trip count is intentionally neutral. Profit is always labeled
 * "Profit estimat" — other configured expenses keep it an estimate even with a
 * real monthly PDF. Below the numbers, up to three cautious insights explain
 * relationships between the metrics (deterministic, no recommendations).
 */
export default function MonthComparisonCard({
  comparison,
  unavailableReason,
}: MonthComparisonCardProps) {
  return (
    <section
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm sm:p-6"
      aria-label="Comparație lună"
    >
      <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
        <GitCompareArrows className="h-5 w-5 text-zinc-400" aria-hidden />
        Comparație lună
      </h3>

      {!comparison ? (
        <EmptyState
          text={
            unavailableReason === "current_incomplete"
              ? "Luna selectată este în desfășurare. Nu o comparăm cu o lună finalizată cât timp totalurile sunt incomplete."
              : "Nu există o lună anterioară importată de comparat. Importă cel puțin încă o lună pentru comparație."
          }
        />
      ) : (
        <>
          <p className="mt-1 text-sm text-zinc-400">
            <span className="font-medium text-zinc-200">{comparison.currentLabel}</span>{" "}
            față de{" "}
            <span className="font-medium text-zinc-200">{comparison.previousLabel}</span>
          </p>

          {comparison.previousIsGap && (
            <p className="mt-2 rounded-lg border border-amber-800 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
              Comparație cu cea mai recentă lună anterioară importată.
            </p>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MetricRow
              label="Venit brut"
              delta={comparison.grossRevenue}
              format={asRon}
              neutral={false}
            />
            <MetricRow
              label="Număr curse"
              delta={comparison.tripCount}
              format={asCount}
              neutral
            />
            <MetricRow
              label="Profit estimat"
              delta={comparison.estimatedProfit}
              format={asRon}
              neutral={false}
            />
            <MetricRow
              label="Venit pe zi lucrată"
              delta={comparison.revenuePerWorkedDay}
              format={asRon}
              neutral={false}
            />
          </div>

          {/* Relational insights derived from the comparison. */}
          <InsightList insights={deriveMonthComparisonInsights(comparison)} />

          {/* Calculation-accuracy context for both months. */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <AccuracyBadge
              label={comparison.currentLabel}
              accuracy={comparison.currentAccuracy}
            />
            <AccuracyBadge
              label={comparison.previousLabel}
              accuracy={comparison.previousAccuracy}
            />
          </div>
          <p className="mt-3 text-sm text-zinc-400">
            Profitul rămâne o estimare: chiar și cu PDF-ul lunar Bolt, alte
            cheltuieli configurate pot influența rezultatul. Calcul estimativ pe
            baza datelor importate.
          </p>
        </>
      )}
    </section>
  );
}
