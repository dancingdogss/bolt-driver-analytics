import { CalendarClock, CheckCircle2, FileText, Info } from "lucide-react";
import type { MonthStatus } from "@/lib/analytics/monthStatus";
import type {
  BoltFeeSource,
  KilometersSource,
  ProfitAccuracy,
} from "@/lib/analytics/estimateProfit";
import { formatMonthLabel } from "@/lib/utils/dates";

interface MonthStatusCardProps {
  monthKey: string;
  status: MonthStatus;
  csvPresent: boolean;
  pdfPresent: boolean;
  boltFeeSource: BoltFeeSource;
  kilometersSource: KilometersSource;
  accuracy: ProfitAccuracy;
}

const STATUS_TEXT: Record<MonthStatus, string> = {
  current_month:
    "Lună în desfășurare. PDF-ul lunar Bolt nu este disponibil încă. Calculul folosește CSV-ul importat și estimări pentru Taxa Bolt și kilometri.",
  completed_without_pdf:
    "Lună finalizată fără PDF lunar. Poți încărca PDF-ul Bolt pentru Taxă Bolt reală și kilometri reali.",
  completed_with_pdf:
    "Lună finalizată cu PDF lunar. Calculul folosește Taxa Bolt reală și kilometrii reali.",
};

const STATUS_META: Record<
  MonthStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  current_month: {
    label: "Lună în desfășurare",
    className: "border-sky-800 bg-sky-950/30 text-sky-200",
    icon: <CalendarClock className="h-5 w-5 shrink-0 text-sky-400" aria-hidden />,
  },
  completed_without_pdf: {
    label: "Lună finalizată · fără PDF",
    className: "border-amber-800 bg-amber-950/30 text-amber-200",
    icon: <FileText className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />,
  },
  completed_with_pdf: {
    label: "Lună finalizată · cu PDF",
    className: "border-emerald-800 bg-emerald-950/30 text-emerald-200",
    icon: (
      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
    ),
  },
};

const BOLT_FEE_TEXT: Record<BoltFeeSource, string> = {
  real_pdf: "reală, din PDF-ul lunar Bolt",
  historical_estimate: "estimată pe baza lunilor anterioare",
  default_estimate: "estimată cu procentul setat în aplicație",
};

const KM_TEXT: Record<KilometersSource, string> = {
  real_pdf: "reali, din PDF-ul lunar Bolt",
  historical_estimate: "estimați pe baza lunilor anterioare",
  unavailable: "indisponibili",
};

const ACCURACY_TEXT: Record<ProfitAccuracy, string> = {
  high: "Precizie ridicată",
  medium: "Precizie medie",
  low: "Precizie scăzută",
};

/**
 * "Status lună": tells the driver whether the selected month is still running,
 * finished without its PDF, or finished with real PDF data — plus a small data
 * health check of what the calculation is actually based on.
 */
export default function MonthStatusCard({
  monthKey,
  status,
  csvPresent,
  pdfPresent,
  boltFeeSource,
  kilometersSource,
  accuracy,
}: MonthStatusCardProps) {
  const meta = STATUS_META[status];

  const healthRows: { label: string; value: string }[] = [
    { label: "Luna selectată", value: formatMonthLabel(monthKey) },
    { label: "Status lună", value: meta.label },
    { label: "CSV prezent", value: csvPresent ? "da" : "nu" },
    { label: "PDF lunar prezent", value: pdfPresent ? "da" : "nu" },
    { label: "Taxă Bolt", value: BOLT_FEE_TEXT[boltFeeSource] },
    { label: "Kilometri", value: KM_TEXT[kilometersSource] },
    { label: "Precizie calcul", value: ACCURACY_TEXT[accuracy] },
  ];

  return (
    <section
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm sm:p-6"
      aria-label="Status lună"
    >
      <h3 className="text-lg font-semibold text-zinc-100">Status lună</h3>

      <div
        className={`mt-3 flex gap-2.5 rounded-xl border p-4 text-sm leading-relaxed ${meta.className}`}
      >
        {meta.icon}
        <p>{STATUS_TEXT[status]}</p>
      </div>

      {status === "current_month" && (
        <p className="mt-3 flex gap-2 text-sm text-zinc-400">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
          După finalul lunii, încarcă PDF-ul lunar Bolt pentru a înlocui
          estimările cu date reale.
        </p>
      )}

      {/* Data health check */}
      <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {healthRows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-3 rounded-lg bg-zinc-800/50 px-3 py-2.5 sm:flex-col sm:items-start sm:gap-0.5"
          >
            <dt className="text-xs text-zinc-400">{row.label}</dt>
            <dd className="text-right text-sm font-medium text-zinc-100 sm:text-left">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
