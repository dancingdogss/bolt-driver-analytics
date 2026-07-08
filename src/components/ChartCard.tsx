import type { ReactNode } from "react";

/** Shared dark-theme tokens for all Recharts charts. */
export const GRID_STROKE = "#27272a"; // zinc-800
export const AXIS_TICK = { fontSize: 11, fill: "#a1a1aa" } as const; // zinc-400
export const TOOLTIP_PROPS = {
  cursor: { fill: "rgba(255,255,255,0.04)" },
  contentStyle: {
    background: "#18181b",
    border: "1px solid #3f3f46",
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: "#e4e4e7" },
  itemStyle: { color: "#e4e4e7" },
} as const;

/** Card wrapper shared by every chart, with a consistent title. */
export function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-zinc-200">{title}</h3>
      {children}
    </div>
  );
}

/** Placeholder shown when a chart has no data for the current filter. */
export function EmptyState({ height = 280 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center text-sm text-zinc-500"
      style={{ height }}
    >
      No data for the selected range
    </div>
  );
}
