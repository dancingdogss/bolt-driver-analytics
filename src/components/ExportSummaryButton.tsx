"use client";

import { Download } from "lucide-react";
import type { ReportSummary } from "@/lib/analytics/reportSummary";

interface ExportSummaryButtonProps {
  /** Called at click time so the report reflects the current view. */
  build: () => ReportSummary;
}

/** Downloads the report summary as a JSON file. Client-only. */
export default function ExportSummaryButton({ build }: ExportSummaryButtonProps) {
  function handleExport() {
    const summary = build();
    // Timestamp added at export time (client), never during SSR render.
    const payload = { generatedAt: new Date().toISOString(), ...summary };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const link = document.createElement("a");
    link.href = url;
    link.download = `bolt-driver-summary-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
    >
      <Download className="h-4 w-4" />
      Export summary
    </button>
  );
}
