"use client";

import { useState } from "react";
import {
  CalendarDays,
  Check,
  ClipboardCopy,
  Eye,
  Sparkles,
  ThumbsUp,
} from "lucide-react";
import type { MonthlyDriverReport } from "@/lib/analytics/calculateMonthlyDriverReport";

interface MonthlyDriverReportProps {
  /** The computed report, or null when the month has no trips. */
  report: MonthlyDriverReport | null;
  /** True when a specific month is selected in the filter. */
  isMonthSelected: boolean;
}

const TITLE = "Raport lunar șofer";
const SUBTITLE =
  "Rezumat simplu pe baza curselor importate și a costurilor introduse.";

/**
 * Plain-Romanian monthly report for the selected month. Simple cards and short
 * bullets only — no big tables — so it stays readable on a phone.
 */
export default function MonthlyDriverReport({
  report,
  isMonthSelected,
}: MonthlyDriverReportProps) {
  return (
    <section
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm sm:p-6"
      aria-label={TITLE}
    >
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-zinc-100">{TITLE}</h3>
        {report && <CopyReportButton text={report.copyText} />}
      </div>
      <p className="mb-5 text-sm text-zinc-400">{SUBTITLE}</p>

      {!isMonthSelected ? (
        <EmptyState
          icon={<CalendarDays className="h-8 w-8 text-zinc-500" aria-hidden />}
          text="Selectează o lună pentru raport lunar."
        />
      ) : !report ? (
        <EmptyState
          icon={<CalendarDays className="h-8 w-8 text-zinc-500" aria-hidden />}
          text="Nu există curse în luna selectată."
        />
      ) : (
        <ReportBody report={report} />
      )}
    </section>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-700 px-4 py-10 text-center">
      {icon}
      <p className="text-base text-zinc-300">{text}</p>
    </div>
  );
}

function ReportBody({ report }: { report: MonthlyDriverReport }) {
  return (
    <div className="space-y-5">
      {/* Concluzia lunii */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold text-zinc-100">
            Concluzia lunii · {report.monthLabel}
          </p>
          {report.accuracy === "high" ? (
            <span className="rounded-full bg-emerald-950/50 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
              Calcul mai precis: PDF lunar Bolt importat
            </span>
          ) : (
            <span className="rounded-full bg-amber-950/50 px-2.5 py-0.5 text-xs font-medium text-amber-300">
              Calcul estimativ
            </span>
          )}
        </div>
        <p className="text-base leading-relaxed text-zinc-200">
          {report.conclusion}
        </p>
      </div>

      {/* Carduri scurte */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {report.kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl bg-zinc-800/50 p-4">
            <p className="text-sm text-zinc-400">{kpi.label}</p>
            <p className="mt-1 break-words text-lg font-semibold tabular-nums text-zinc-50">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Secțiuni cu bullets */}
      <div className="grid gap-4 lg:grid-cols-3">
        <BulletSection
          icon={<ThumbsUp className="h-5 w-5 text-emerald-400" aria-hidden />}
          title="Ce a mers bine"
          items={report.wentWell}
        />
        <BulletSection
          icon={<Eye className="h-5 w-5 text-amber-400" aria-hidden />}
          title="Ce merită urmărit"
          items={report.watchOut}
        />
        <BulletSection
          icon={<Sparkles className="h-5 w-5 text-sky-400" aria-hidden />}
          title="Pentru luna următoare"
          items={report.nextMonth}
        />
      </div>

      {!report.usedMonthlyPdf && (
        <p className="text-sm text-amber-300">
          Pentru un calcul mai precis, încarcă PDF-ul lunar Bolt.
        </p>
      )}
    </div>
  );
}

function BulletSection({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="mb-3 flex items-center gap-2 text-base font-semibold text-zinc-100">
        {icon}
        {title}
      </p>
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-300">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Copies the WhatsApp-friendly plain text and confirms briefly. */
function CopyReportButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions / http) — fall back to a prompt the
      // user can copy from manually.
      window.prompt("Copiază textul raportului:", text);
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-base font-medium transition-colors ${
        copied
          ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
          : "border-zinc-600 text-zinc-200 hover:bg-zinc-800"
      }`}
    >
      {copied ? (
        <>
          <Check className="h-5 w-5" aria-hidden />
          Copiat!
        </>
      ) : (
        <>
          <ClipboardCopy className="h-5 w-5" aria-hidden />
          Copiază raportul
        </>
      )}
    </button>
  );
}
