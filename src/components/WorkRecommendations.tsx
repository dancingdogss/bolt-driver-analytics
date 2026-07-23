import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
  Lightbulb,
  TrendingDown,
  XCircle,
} from "lucide-react";
import type {
  ConfidenceLevel,
  PickupRecommendation,
  RecommendationLearning,
  RecommendationValidation,
  ValidatedWindow,
  ValidationOutcome,
  WeekdayStat,
  WorkRecommendations as WorkRecommendationsData,
} from "@/lib/types/recommendations";
import { formatMonthLabel } from "@/lib/utils/dates";
import { formatNumber, formatRon } from "@/lib/utils/money";

interface WorkRecommendationsProps {
  data: WorkRecommendationsData;
  /** Historical holdout validation of the method (train past, test holdout). */
  validation: RecommendationValidation;
  /** Whether the current (incomplete) month is added to the completed history. */
  includeCurrentMonth: boolean;
  onToggleIncludeCurrentMonth: (include: boolean) => void;
}

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  scazuta: "Încredere scăzută",
  medie: "Încredere medie",
  ridicata: "Încredere ridicată",
};

const CONFIDENCE_CLASS: Record<ConfidenceLevel, string> = {
  scazuta: "border-zinc-600 bg-zinc-800 text-zinc-300",
  medie: "border-sky-800 bg-sky-950/40 text-sky-300",
  ridicata: "border-emerald-800 bg-emerald-950/40 text-emerald-300",
};

const DISCLAIMER =
  "Recomandările arată tipare de venit din lunile complete deja importate. " +
  "Aplicația nu știe dacă ai fost online fără curse, deci acestea sunt tipare " +
  "istorice, nu garanții și nu profit.";

/** Singular/plural helpers for the plain-Romanian sample-size lines. */
function curseText(n: number): string {
  return n === 1 ? "1 cursă" : `${formatNumber(n)} curse`;
}
function zileText(n: number): string {
  return n === 1 ? "1 zi" : `${formatNumber(n)} zile diferite`;
}
function saptamaniText(n: number): string {
  return n === 1 ? "1 săptămână" : `${formatNumber(n)} săptămâni`;
}

/** e.g. "12 curse în 4 zile diferite, pe parcursul a 3 săptămâni." */
function sampleLine(trips: number, days: number, weeks: number): string {
  return `${curseText(trips)} în ${zileText(days)}, pe parcursul a ${saptamaniText(weeks)}.`;
}

/** e.g. "Aprilie–Iunie 2026" (year shown once when it is the same). */
function learningRangeLabel(firstKey: string, lastKey: string): string {
  const first = formatMonthLabel(firstKey);
  if (firstKey === lastKey) return first;
  const last = formatMonthLabel(lastKey);
  const [firstName, firstYear] = first.split(" ");
  return firstYear === last.split(" ")[1]
    ? `${firstName}–${last}`
    : `${first}–${last}`;
}

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-medium ${CONFIDENCE_CLASS[level]}`}
    >
      {CONFIDENCE_LABEL[level]}
    </span>
  );
}

/** Shared card shell for each recommendation block. */
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
      <h4 className="mb-3 text-base font-semibold text-zinc-100">{title}</h4>
      {children}
    </div>
  );
}

export default function WorkRecommendations({
  data,
  validation,
  includeCurrentMonth,
  onToggleIncludeCurrentMonth,
}: WorkRecommendationsProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
            <Lightbulb className="h-5 w-5 text-amber-400" aria-hidden />
            Recomandări pentru ieșit la lucru
          </h3>
          <p className="mt-1 max-w-2xl text-base text-zinc-300">
            Aplicația caută zilele și orele care s-au repetat cu rezultate bune
            în lunile complete importate.
          </p>
        </div>
        <IncludeCurrentMonthToggle
          enabled={includeCurrentMonth}
          onChange={onToggleIncludeCurrentMonth}
        />
      </div>

      <LearningPeriodLine learning={data.learning} />

      {includeCurrentMonth && (
        <div className="mt-3 flex gap-2.5 rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 text-sm leading-relaxed text-amber-200">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
            aria-hidden
          />
          <p>
            Atenție: luna curentă nu este încheiată. Cursele ei sunt date
            incomplete și pot schimba tiparele până la finalul lunii.
          </p>
        </div>
      )}

      {/* Visible interpretation note (always shown). */}
      <div className="mt-3 flex gap-2.5 rounded-xl border border-zinc-700 bg-zinc-800/40 p-4 text-sm leading-relaxed text-zinc-300">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
        <p>{DISCLAIMER}</p>
      </div>

      {!data.sufficient ? (
        <InsufficientData
          totalTrips={data.totalTrips}
          learning={data.learning}
          includeCurrentMonth={includeCurrentMonth}
        />
      ) : !data.hasReliablePatterns ? (
        <InsufficientRepetition />
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BestWeekdayCard data={data} />
          <BestHoursCard data={data} />
          <BestWindowsCard data={data} />
          <WeakWindowsCard data={data} />
          <PickupsCard data={data} />
          <InterpretationCard
            confidence={data.overallConfidence}
            completedMonthCount={data.learning.completedMonthCount}
          />
        </div>
      )}

      <ValidationCard validation={validation} />
    </section>
  );
}

function IncludeCurrentMonthToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-2.5 text-base text-zinc-200">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-emerald-500"
      />
      Include și luna curentă (date incomplete)
    </label>
  );
}

/** "Învățat din 3 luni complete (Aprilie–Iunie 2026), 917 curse." */
function LearningPeriodLine({
  learning,
}: {
  learning: RecommendationLearning;
}) {
  const { completedMonthCount, firstMonthKey, lastMonthKey } = learning;

  let text: string;
  if (completedMonthCount === 0) {
    text = learning.includesCurrentMonth
      ? `Nu există încă nicio lună completă cu curse. Se folosește doar luna curentă: ${curseText(learning.currentMonthTripCount)} (date incomplete).`
      : "Nu există încă nicio lună completă cu curse importate.";
  } else {
    const monthsText =
      completedMonthCount === 1
        ? "1 lună completă"
        : `${formatNumber(completedMonthCount)} luni complete`;
    const range =
      firstMonthKey && lastMonthKey
        ? ` (${learningRangeLabel(firstMonthKey, lastMonthKey)})`
        : "";
    text = `Învățat din ${monthsText}${range}, ${curseText(learning.completedTripCount)}.`;
    if (learning.evidenceMonthCount < learning.completedMonthCount) {
      // A near-empty completed month must not pretend to support confidence.
      text += ` Pentru încrederea generală se folosesc doar lunile cu minim 50 de curse: ${formatNumber(learning.evidenceMonthCount)} din ${formatNumber(learning.completedMonthCount)}.`;
    }
    if (learning.includesCurrentMonth) {
      text += ` Include și luna curentă: ${curseText(learning.currentMonthTripCount)} (date incomplete).`;
    }
  }

  return <p className="mt-3 px-1 text-sm text-zinc-400">{text}</p>;
}

function InsufficientData({
  totalTrips,
  learning,
  includeCurrentMonth,
}: {
  totalTrips: number;
  learning: RecommendationLearning;
  includeCurrentMonth: boolean;
}) {
  const currentMonthUnused =
    !includeCurrentMonth && learning.currentMonthTripCount > 0;
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-zinc-600 p-8 text-center">
      <p className="text-lg font-semibold text-zinc-100">Date insuficiente</p>
      <p className="mx-auto mt-2 max-w-lg text-base text-zinc-300">
        Nu sunt suficiente date pentru recomandări serioase. Încarcă CSV-urile
        Bolt pentru cel puțin o lună completă (ideal 2–3 luni).
      </p>
      <p className="mt-2 text-sm text-zinc-400">
        Momentan avem {curseText(totalTrips)} din lunile complete importate.
      </p>
      {currentMonthUnused && (
        <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-400">
          Cele {curseText(learning.currentMonthTripCount)} din luna curentă nu
          sunt folosite, pentru că luna nu s-a încheiat. Poți bifa „Include și
          luna curentă” dacă vrei să fie folosite (date incomplete).
        </p>
      )}
    </div>
  );
}

/** Enough trips overall, but no pattern repeated enough to be recommended. */
function InsufficientRepetition() {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-zinc-600 p-8 text-center">
      <p className="text-lg font-semibold text-zinc-100">
        Tiparele nu s-au repetat încă destul
      </p>
      <p className="mx-auto mt-2 max-w-lg text-base text-zinc-300">
        Există destule curse, dar nicio zi și niciun interval orar nu a apărut
        în cel puțin 3 zile diferite, din cel puțin 2 săptămâni. Ca să nu îți
        recomandăm o întâmplare norocoasă, așteptăm mai multe repetări.
      </p>
      <p className="mt-2 text-sm text-zinc-400">
        Continuă să imporți CSV-urile — recomandările apar pe măsură ce se adună
        săptămâni de date.
      </p>
    </div>
  );
}

function BestWeekdayCard({ data }: { data: WorkRecommendationsData }) {
  const best = data.bestWeekday;
  const weak = data.weakestActiveWeekday;
  // Only call a day the "weakest" when it is a different day than the best one.
  const showWeak = weak && best && weak.weekday !== best.weekday;

  return (
    <Card title="Când pare cel mai bine să ieși">
      <div className="space-y-4">
        {best ? (
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm font-medium text-zinc-400">Cea mai bună zi</p>
              <ConfidenceBadge level={best.confidence} />
            </div>
            <p className="text-base text-zinc-200">
              Cea mai bună zi din datele tale pare să fie{" "}
              <span className="font-semibold text-zinc-50">{best.label}</span>,
              cu în medie{" "}
              <span className="font-semibold text-zinc-50">
                {formatRon(best.averageRevenuePerActiveDay)}
              </span>{" "}
              pe zi lucrată ({zileText(best.activeDates)} de {best.label},{" "}
              {formatRon(best.revenue)} în total).
            </p>
          </div>
        ) : (
          <p className="text-base text-zinc-300">
            Nicio zi din săptămână nu s-a repetat încă în cel puțin 3 date
            diferite, deci nu putem recomanda o zi cu încredere.
          </p>
        )}

        {showWeak && (
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm font-medium text-zinc-400">
                Cea mai slabă zi cu activitate repetată
              </p>
              <ConfidenceBadge level={weak.confidence} />
            </div>
            <p className="text-base text-zinc-200">
              Cea mai slabă zi repetată a fost{" "}
              <span className="font-semibold text-zinc-50">{weak.label}</span>,
              cu în medie{" "}
              <span className="font-semibold text-zinc-50">
                {formatRon(weak.averageRevenuePerActiveDay)}
              </span>{" "}
              pe zi lucrată ({zileText(weak.activeDates)}).
            </p>
          </div>
        )}

        <WeekdayTable
          weekdays={data.weekdays}
          bestWeekday={best ? best.weekday : null}
        />
      </div>
    </Card>
  );
}

function WeekdayTable({
  weekdays,
  bestWeekday,
}: {
  weekdays: WeekdayStat[];
  bestWeekday: number | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-zinc-400">
            <th className="py-2 pr-3 font-medium">Zi</th>
            <th className="py-2 pr-3 text-right font-medium">Zile</th>
            <th className="py-2 pr-3 text-right font-medium">Curse</th>
            <th className="py-2 text-right font-medium">Venit / zi</th>
          </tr>
        </thead>
        <tbody>
          {weekdays.map((w) => (
            <tr
              key={w.weekday}
              className={`border-b border-zinc-800/60 last:border-0 ${
                w.weekday === bestWeekday ? "bg-emerald-950/30" : ""
              } ${w.reliable ? "" : "text-zinc-500"}`}
            >
              <td
                className={`py-2 pr-3 font-medium ${
                  w.reliable ? "text-zinc-100" : "text-zinc-500"
                }`}
              >
                {w.label}
                {!w.reliable && " *"}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatNumber(w.activeDates)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatNumber(w.trips)}
              </td>
              <td
                className={`py-2 text-right font-medium tabular-nums ${
                  w.reliable ? "text-zinc-50" : "text-zinc-500"
                }`}
              >
                {formatRon(w.averageRevenuePerActiveDay)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {weekdays.some((w) => !w.reliable) && (
        <p className="mt-2 text-xs text-zinc-500">
          * Zile cu mai puțin de 3 date diferite — doar informativ, nu sunt
          folosite pentru recomandări.
        </p>
      )}
    </div>
  );
}

function BestHoursCard({ data }: { data: WorkRecommendationsData }) {
  return (
    <Card title="Ore bune, repetate">
      {data.bestHours.length > 0 ? (
        <ul className="space-y-3">
          {data.bestHours.map((h) => (
            <li
              key={h.hour}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-800/40 p-3"
            >
              <div>
                <p className="text-base font-semibold text-zinc-50">
                  {h.label} — pare un interval bun
                </p>
                <p className="text-sm text-zinc-400">
                  {sampleLine(h.trips, h.activeDays, h.distinctWeeks)}
                </p>
                <p className="text-sm text-zinc-400">
                  În medie {formatRon(h.revenuePerActiveDay)} pe zi activă ·{" "}
                  {formatRon(h.revenue)} în total
                </p>
              </div>
              <ConfidenceBadge level={h.confidence} />
            </li>
          ))}
        </ul>
      ) : (
        <NotRepeatedLine />
      )}
    </Card>
  );
}

function BestWindowsCard({ data }: { data: WorkRecommendationsData }) {
  return (
    <Card title="Intervale de 3 ore bune, repetate">
      {data.bestWindows.length > 0 ? (
        <ul className="space-y-3">
          {data.bestWindows.map((w) => (
            <li
              key={`${w.weekday}-${w.startHour}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-800/40 p-3"
            >
              <div>
                <p className="text-base font-semibold text-zinc-50">{w.label}</p>
                <p className="text-sm text-zinc-400">
                  {sampleLine(w.trips, w.activeDays, w.distinctWeeks)}
                </p>
                <p className="text-sm text-zinc-400">
                  În medie {formatRon(w.revenuePerActiveDay)} pe zi activă ·{" "}
                  {formatRon(w.revenue)} în total
                </p>
              </div>
              <ConfidenceBadge level={w.confidence} />
            </li>
          ))}
        </ul>
      ) : (
        <NotRepeatedLine />
      )}
    </Card>
  );
}

function WeakWindowsCard({ data }: { data: WorkRecommendationsData }) {
  return (
    <Card title="Intervale mai slabe">
      <p className="mb-3 flex items-center gap-2 text-sm text-zinc-400">
        <TrendingDown className="h-4 w-4 text-zinc-500" aria-hidden />
        Intervale cu rezultate mai slabe, repetate în datele importate.
      </p>
      {data.weakWindows.length > 0 ? (
        <ul className="space-y-3">
          {data.weakWindows.map((w) => (
            <li
              key={`${w.weekday}-${w.startHour}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-800/40 p-3"
            >
              <div>
                <p className="text-base font-semibold text-zinc-100">{w.label}</p>
                <p className="text-sm text-zinc-400">
                  {sampleLine(w.trips, w.activeDays, w.distinctWeeks)}
                </p>
              </div>
              <ConfidenceBadge level={w.confidence} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-base text-zinc-400">
          Date insuficiente pentru a marca intervale slabe cu încredere.
        </p>
      )}
    </Card>
  );
}

function PickupsCard({ data }: { data: WorkRecommendationsData }) {
  const hasAny =
    data.mostCommonPickup ||
    data.topRevenuePickup ||
    data.highValuePickups.length > 0;

  return (
    <Card title="Adrese de preluare valoroase">
      <p className="mb-3 text-sm text-zinc-400">
        Adrese cu venit bun, repetate: minim 3 curse, în cel puțin 2 zile
        diferite.
      </p>
      {hasAny ? (
        <div className="space-y-3">
          {data.mostCommonPickup && (
            <PickupRow
              label="Cea mai frecventă adresă"
              pickup={data.mostCommonPickup}
            />
          )}
          {data.topRevenuePickup && (
            <PickupRow
              label="Cel mai mare venit"
              pickup={data.topRevenuePickup}
            />
          )}
          {data.highValuePickups.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-400">
                Valoare medie mare pe cursă
              </p>
              <ul className="space-y-2">
                {data.highValuePickups.map((p) => (
                  <li key={p.address} className="rounded-lg bg-zinc-800/40 p-3">
                    <p
                      className="truncate text-base text-zinc-100"
                      title={p.address}
                    >
                      {p.address}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {formatRon(p.averageTripValue)} / cursă ·{" "}
                      {curseText(p.trips)} în {zileText(p.activeDays)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-base text-zinc-400">
          Nicio adresă nu s-a repetat încă destul (minim 3 curse, în cel puțin 2
          zile diferite).
        </p>
      )}
    </Card>
  );
}

function PickupRow({
  label,
  pickup,
}: {
  label: string;
  pickup: PickupRecommendation;
}) {
  return (
    <div className="rounded-xl bg-zinc-800/40 p-3">
      <p className="text-sm font-medium text-zinc-400">{label}</p>
      <p
        className="mt-0.5 truncate text-base text-zinc-100"
        title={pickup.address}
      >
        {pickup.address}
      </p>
      <p className="text-sm text-zinc-400">
        {curseText(pickup.trips)} în {zileText(pickup.activeDays)} ·{" "}
        {formatRon(pickup.revenue)}
      </p>
    </div>
  );
}

function InterpretationCard({
  confidence,
  completedMonthCount,
}: {
  confidence: ConfidenceLevel;
  completedMonthCount: number;
}) {
  return (
    <Card title="Atenție la interpretare">
      <div className="space-y-3 text-base leading-relaxed text-zinc-300">
        <p className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Încredere generală:</span>
          <ConfidenceBadge level={confidence} />
        </p>
        <p>
          Aceste recomandări arată tipare de venit observate în{" "}
          {completedMonthCount === 1
            ? "singura lună completă importată"
            : `cele ${formatNumber(completedMonthCount)} luni complete importate`}
          , nu garanții. Aplicația nu știe dacă ai stat online fără curse, câte
          curse ai refuzat sau cât ai condus.
        </p>
        <p className="text-zinc-400">
          Recomandările sunt despre venit, nu despre profit, și merită
          verificate pe teren înainte de a schimba programul.
        </p>
      </div>
    </Card>
  );
}

function NotRepeatedLine() {
  return (
    <p className="text-base text-zinc-400">
      Niciun interval nu s-a repetat încă destul (minim 3 zile diferite, din 2
      săptămâni).
    </p>
  );
}

/* --- Historical holdout validation ("Verificare istorică a metodei") --- */

const VALIDATION_UNAVAILABLE_TEXT: Record<
  NonNullable<RecommendationValidation["unavailableReason"]>,
  string
> = {
  no_holdout:
    "Verificarea separată devine posibilă după cel puțin două luni complete cu volum suficient de curse.",
  training_insufficient:
    "Nu sunt destule curse în lunile de dinaintea lunii de verificare pentru a antrena metoda.",
  no_reliable_patterns:
    "Lunile de antrenare nu au produs încă tipare repetate care să poată fi verificate.",
  holdout_insufficient:
    "Luna de verificare nu are destule curse pentru o comparație corectă.",
};

const OUTCOME_META: Record<
  ValidationOutcome,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  confirmat: {
    label: "Confirmat",
    className: "border-emerald-800 bg-emerald-950/40 text-emerald-300",
    Icon: CheckCircle2,
  },
  neconfirmat: {
    label: "Neconfirmat",
    className: "border-amber-800 bg-amber-950/40 text-amber-300",
    Icon: XCircle,
  },
  date_insuficiente: {
    label: "Date insuficiente",
    className: "border-zinc-600 bg-zinc-800 text-zinc-300",
    Icon: HelpCircle,
  },
};

function OutcomeBadge({ outcome }: { outcome: ValidationOutcome }) {
  const { label, className, Icon } = OUTCOME_META[outcome];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </span>
  );
}

/** "Iunie 2026" style; safe for null keys. */
function monthLabelOrDash(key: string | null): string {
  return key ? formatMonthLabel(key) : "—";
}

/** "Aprilie–Mai 2026" (shared year shown once), or a single month. */
function trainingRangeLabel(first: string | null, last: string | null): string {
  if (!first || !last) return monthLabelOrDash(first ?? last);
  if (first === last) return formatMonthLabel(first);
  const a = formatMonthLabel(first);
  const b = formatMonthLabel(last);
  const [aName, aYear] = a.split(" ");
  return aYear === b.split(" ")[1] ? `${aName}–${b}` : `${a}–${b}`;
}

/** The one honest line explaining absence of observations, when relevant. */
const INSUFFICIENT_OBSERVATION_NOTE =
  "Asta nu înseamnă că intervalul a fost slab; aplicația nu poate ști dacă " +
  "șoferul a fost online fără curse.";

/**
 * The caution shown when training is thin, driven ONLY by the evidence-month
 * count (a completed training month with ≥50 trips). `limited` covers both 0
 * and 1 evidence months, so the wording must distinguish them — and must never
 * name a month, since the last chronological training month may be sparse while
 * an earlier month is the real evidence month. Returns null when not limited.
 */
export function limitedTrainingNote(
  evidenceMonthCount: number,
): string | null {
  if (evidenceMonthCount === 0) {
    return (
      "Rezultatul este foarte limitat: deși există suficiente curse cumulat, " +
      "nicio lună de antrenare nu are individual minimum 50 de curse."
    );
  }
  if (evidenceMonthCount === 1) {
    return (
      "Rezultatul este orientativ: antrenarea are o singură lună cu minimum " +
      "50 de curse."
    );
  }
  return null;
}

function ValidationCard({
  validation,
}: {
  validation: RecommendationValidation;
}) {
  return (
    <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
      <h4 className="flex items-center gap-2 text-base font-semibold text-zinc-100">
        <Info className="h-5 w-5 text-sky-400" aria-hidden />
        Verificare istorică a metodei
      </h4>

      {!validation.available ? (
        <p className="mt-3 text-base text-zinc-300">
          {validation.unavailableReason
            ? VALIDATION_UNAVAILABLE_TEXT[validation.unavailableReason]
            : "Verificarea nu este disponibilă momentan."}
        </p>
      ) : (
        <ValidationBody validation={validation} />
      )}
    </div>
  );
}

function ValidationBody({
  validation,
}: {
  validation: RecommendationValidation;
}) {
  const trainingRange = trainingRangeLabel(
    validation.trainingFirstMonthKey,
    validation.trainingLastMonthKey,
  );
  const holdout = monthLabelOrDash(validation.holdoutMonthKey);

  // At most three window results, most useful first (the recommended order).
  const windowsToShow = validation.windows.slice(0, 3);

  return (
    <div className="mt-3 space-y-4">
      <p className="text-base text-zinc-200">
        Învățat din {trainingRange} ({curseText(validation.trainingTripCount)}).
        Verificat separat pe {holdout} ({curseText(validation.holdoutTripCount)}).
      </p>
      <p className="text-sm text-zinc-400">
        Pentru această verificare, recomandările au fost calculate fără {holdout},
        deși recomandările afișate mai sus folosesc toate lunile complete. Așa
        testăm metoda pe o lună pe care nu a „văzut-o”.
      </p>

      {limitedTrainingNote(validation.trainingEvidenceMonthCount) && (
        <div className="flex gap-2.5 rounded-xl border border-amber-900/50 bg-amber-950/20 p-3 text-sm leading-relaxed text-amber-200">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
            aria-hidden
          />
          <p>{limitedTrainingNote(validation.trainingEvidenceMonthCount)}</p>
        </div>
      )}

      {/* Weekday result */}
      {validation.weekday && (
        <div className="rounded-xl bg-zinc-800/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-base font-semibold text-zinc-50">
              Cea mai bună zi: {validation.weekday.label}
            </p>
            <OutcomeBadge outcome={validation.weekday.outcome} />
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            {validation.weekday.outcome === "date_insuficiente"
              ? `În ${holdout}: curse în ${zileText(validation.weekday.holdoutActiveDates)} de ${validation.weekday.label}. ${INSUFFICIENT_OBSERVATION_NOTE}`
              : `În ${holdout}: locul ${formatNumber(validation.weekday.rank ?? 0)} din ${formatNumber(validation.weekday.rankOf ?? 0)} zile, în medie ${formatRon(validation.weekday.holdoutRevenuePerActiveDay)} pe zi cu curse.`}
          </p>
        </div>
      )}

      {/* Window results */}
      {!validation.windowPoolSufficient ? (
        <p className="text-sm text-zinc-400">
          Intervalele de 3 ore nu pot fi verificate: {holdout} nu are destule
          intervale repetate pentru o comparație corectă.
        </p>
      ) : (
        windowsToShow.length > 0 && (
          <ul className="space-y-2">
            {windowsToShow.map((w) => (
              <ValidationWindowRow key={`${w.weekday}-${w.startHour}`} window={w} holdout={holdout} />
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function ValidationWindowRow({
  window,
  holdout,
}: {
  window: ValidatedWindow;
  holdout: string;
}) {
  return (
    <li className="rounded-xl bg-zinc-800/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold text-zinc-100">{window.label}</p>
        <OutcomeBadge outcome={window.outcome} />
      </div>
      <p className="mt-1 text-sm text-zinc-400">
        {window.outcome === "date_insuficiente"
          ? `În ${holdout}: curse în ${zileText(window.holdoutActiveDays)}. ${INSUFFICIENT_OBSERVATION_NOTE}`
          : `În ${holdout}: interval repetat în ${zileText(window.holdoutActiveDays)}, pe parcursul a ${saptamaniText(window.holdoutDistinctWeeks)}.`}
      </p>
    </li>
  );
}
