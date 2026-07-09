"use client";

import { useCallback, useRef, useState } from "react";
import { FileText, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import type { BoltMonthlySummary } from "@/lib/types/monthlySummary";
import { formatMonthLabel } from "@/lib/utils/dates";
import { formatNumber, formatRon } from "@/lib/utils/money";

/** Feedback about the most recent PDF import, rendered under the upload zone. */
export type MonthlyPdfStatus =
  | {
      kind: "ok";
      summary: BoltMonthlySummary;
      missingFields: string[];
    }
  | { kind: "error"; message: string };

/**
 * How the imported PDF's month relates to the current view. Computed reactively
 * from the active filter (not frozen at import time):
 *   - "matched-month": a specific month is selected and equals the PDF's month;
 *   - "all-data": the "Toate datele" view (PDF applies to its own month only);
 *   - "mismatch": a different month is selected.
 */
export type PdfMatchState = "matched-month" | "all-data" | "mismatch";

interface MonthlyPdfUploadProps {
  onFile: (file: File) => void;
  busy?: boolean;
  status: MonthlyPdfStatus | null;
  /** Reactive relationship between the PDF month and the current filter. */
  matchState: PdfMatchState | null;
  /** Count of stored monthly summaries, shown as context. */
  importedCount: number;
}

/**
 * Optional upload for the Bolt "Rezumat lunar" PDF. Text-only parsing happens
 * client-side; the PDF supplies the real Bolt fee and real kilometrage so the
 * profit calculation for that month becomes more precise.
 */
export default function MonthlyPdfUpload({
  onFile,
  busy = false,
  status,
  matchState,
  importedCount,
}: MonthlyPdfUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const pdf = Array.from(fileList).find(
        (f) =>
          f.name.toLowerCase().endsWith(".pdf") || f.type === "application/pdf",
      );
      if (pdf) onFile(pdf);
    },
    [onFile],
  );

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-zinc-100">
          Încarcă rezumat lunar Bolt PDF{" "}
          <span className="ml-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-300">
            opțional
          </span>
        </h3>
        <p className="mt-1 text-sm text-zinc-400">
          PDF-ul lunar ajută aplicația să folosească taxa Bolt reală și
          kilometrii reali, nu estimări.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Încarcă rezumat lunar Bolt PDF"
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) {
            inputRef.current?.click();
          }
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragging
            ? "border-emerald-500 bg-emerald-950/30"
            : "border-zinc-600 bg-zinc-900/50 hover:border-zinc-500"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {busy ? (
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        ) : (
          <FileText className="h-8 w-8 text-zinc-400" />
        )}
        <p className="text-base font-medium text-zinc-100">
          {busy
            ? "Se citește PDF-ul…"
            : "Trage rezumatul lunar Bolt (PDF) aici sau apasă"}
        </p>
        <p className="text-xs text-zinc-400">
          Bolt → Plăți → Rezumat lunar. Poți încărca câte un PDF pentru fiecare
          lună.
        </p>
      </div>

      {importedCount > 0 && (
        <p className="mt-3 text-sm text-zinc-400">
          Rezumate lunare importate: {formatNumber(importedCount)}.
        </p>
      )}

      {status && <StatusPanel status={status} matchState={matchState} />}
    </div>
  );
}

function StatusPanel({
  status,
  matchState,
}: {
  status: MonthlyPdfStatus;
  matchState: PdfMatchState | null;
}) {
  if (status.kind === "error") {
    return (
      <div className="mt-4 flex gap-2.5 rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-200">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p>{status.message}</p>
      </div>
    );
  }

  const { summary, missingFields } = status;
  const monthLabel = formatMonthLabel(summary.monthKey);
  // Tips (Bacșiș) parsing is not reliable enough yet, so it is hidden and its
  // missing-field notice is suppressed. It is not used in profit calculations.
  // TODO: Re-enable tips after reliable PDF parser tests are added.
  const shownMissing = missingFields.filter((field) => field !== "Bacșiș");

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm text-emerald-100">
      <p className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
        Luna detectată: {formatMonthLabel(summary.monthKey)}
      </p>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Stat
          label="Taxă Bolt reală"
          value={formatRon(summary.boltFee)}
          missing={missingFields.includes("Taxă Bolt")}
        />
        <Stat
          label="Kilometri reali"
          value={`${formatNumber(summary.tripKilometers, 2)} km`}
          missing={missingFields.includes("Kilometraj pe cursă")}
        />
      </dl>

      {matchState === "matched-month" && (
        <p className="text-emerald-200">
          Calculul profitului este mai precis pentru această lună.
        </p>
      )}
      {matchState === "all-data" && (
        <p className="text-emerald-200">
          PDF-ul {monthLabel} a fost folosit pentru calculele lunii {monthLabel}.
          Pentru celelalte luni se folosesc estimări dacă nu există PDF.
        </p>
      )}
      {matchState === "mismatch" && (
        <p className="text-amber-200">
          PDF-ul a fost importat, dar nu corespunde lunii selectate.
        </p>
      )}

      {shownMissing.length > 0 && (
        <p className="text-amber-200">
          Câmpuri lipsă din PDF: {shownMissing.join(", ")}. Restul datelor au
          fost folosite.
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  missing = false,
}: {
  label: string;
  value: string;
  missing?: boolean;
}) {
  // When a field could not be read, never show a misleading 0 — warn instead.
  if (missing) {
    return (
      <div className="rounded-lg bg-amber-900/20 p-3">
        <dt className="text-xs text-amber-300/90">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium text-amber-200">
          Necitit din PDF
        </dd>
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-emerald-900/20 p-3">
      <dt className="text-xs text-emerald-300/90">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums text-emerald-50">
        {value}
      </dd>
    </div>
  );
}
