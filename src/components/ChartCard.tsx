import type { ReactNode } from "react";

/** Shared dark-theme tokens for all Recharts charts. */
export const GRID_STROKE = "#27272a"; // zinc-800
export const AXIS_TICK = { fontSize: 13, fill: "#a1a1aa" } as const; // zinc-400
export const TOOLTIP_PROPS = {
  cursor: { fill: "rgba(255,255,255,0.04)" },
  contentStyle: {
    background: "#18181b",
    border: "1px solid #3f3f46",
    borderRadius: 8,
    fontSize: 14,
  },
  labelStyle: { color: "#e4e4e7" },
  itemStyle: { color: "#e4e4e7" },
} as const;

/**
 * Categorical palette validated for the dark surface (#18181b) with the dataviz
 * six-checks script: lightness band, chroma, CVD separation, contrast all pass.
 */
export const CHART_COLORS = {
  emerald: "#059669", // emerald-600
  amber: "#d97706", // amber-600
  indigo: "#6366f1", // indigo-500
} as const;

/** Card wrapper shared by every chart, with a consistent title. */
export function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Placeholder shown when a chart has no data for the current filter. */
export function EmptyState({ height = 280 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center text-base text-zinc-400"
      style={{ height }}
    >
      Nu există date pentru perioada selectată
    </div>
  );
}
