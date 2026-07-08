import { Info, Lightbulb, TrendingDown } from "lucide-react";
import type {
  ConfidenceLevel,
  PickupRecommendation,
  WeekdayStat,
  WorkRecommendations as WorkRecommendationsData,
} from "@/lib/types/recommendations";
import { formatNumber, formatRon } from "@/lib/utils/money";

interface WorkRecommendationsProps {
  data: WorkRecommendationsData;
  /** Whether recommendations use all imported data (vs the current filter). */
  useAllData: boolean;
  onToggleUseAllData: (useAll: boolean) => void;
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
  "Recomandările sunt bazate pe cursele importate din CSV. Aplicația nu știe " +
  "dacă ai fost online fără curse, deci recomandările arată tipare istorice, " +
  "nu garanții.";

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
  useAllData,
  onToggleUseAllData,
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
            Pe baza curselor importate, aplicația caută zilele și orele în care ai
            avut cele mai bune rezultate.
          </p>
        </div>
        <UseAllDataToggle enabled={useAllData} onChange={onToggleUseAllData} />
      </div>

      {/* Visible interpretation note (always shown). */}
      <div className="mt-4 flex gap-2.5 rounded-xl border border-zinc-700 bg-zinc-800/40 p-4 text-sm leading-relaxed text-zinc-300">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
        <p>{DISCLAIMER}</p>
      </div>

      {!data.sufficient ? (
        <InsufficientData totalTrips={data.totalTrips} />
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BestWeekdayCard data={data} />
          <BestHoursCard data={data} />
          <BestWindowsCard data={data} />
          <WeakWindowsCard data={data} />
          <PickupsCard data={data} />
          <InterpretationCard confidence={data.overallConfidence} />
        </div>
      )}
    </section>
  );
}

function UseAllDataToggle({
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
      Folosește toate datele pentru recomandări
    </label>
  );
}

function InsufficientData({ totalTrips }: { totalTrips: number }) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-zinc-600 p-8 text-center">
      <p className="text-lg font-semibold text-zinc-100">Date insuficiente</p>
      <p className="mx-auto mt-2 max-w-lg text-base text-zinc-300">
        Nu sunt suficiente date pentru recomandări serioase. Încarcă cel puțin 2–4
        săptămâni de CSV-uri Bolt.
      </p>
      <p className="mt-2 text-sm text-zinc-400">
        Momentan avem {formatNumber(totalTrips)} curse în perioada selectată.
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
      {best ? (
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm font-medium text-zinc-400">Cea mai bună zi</p>
              <ConfidenceBadge level={best.confidence} />
            </div>
            <p className="text-base text-zinc-200">
              Cea mai bună zi din datele tale pare să fie{" "}
              <span className="font-semibold text-zinc-50">{best.label}</span>, cu{" "}
              <span className="font-semibold text-zinc-50">
                {formatRon(best.revenue)}
              </span>{" "}
              venit total și {formatNumber(best.trips)} curse.
            </p>
          </div>

          {showWeak && (
            <div>
              <div className="mb-1 flex items-center gap-2">
                <p className="text-sm font-medium text-zinc-400">
                  Cea mai slabă zi cu activitate
                </p>
                <ConfidenceBadge level={weak.confidence} />
              </div>
              <p className="text-base text-zinc-200">
                Cea mai slabă zi cu activitate a fost{" "}
                <span className="font-semibold text-zinc-50">{weak.label}</span>, cu{" "}
                <span className="font-semibold text-zinc-50">
                  {formatRon(weak.revenue)}
                </span>{" "}
                și {formatNumber(weak.trips)} curse.
              </p>
            </div>
          )}

          <WeekdayTable weekdays={data.weekdays} bestWeekday={best.weekday} />
        </div>
      ) : (
        <EmptyLine />
      )}
    </Card>
  );
}

function WeekdayTable({
  weekdays,
  bestWeekday,
}: {
  weekdays: WeekdayStat[];
  bestWeekday: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-zinc-400">
            <th className="py-2 pr-3 font-medium">Zi</th>
            <th className="py-2 pr-3 text-right font-medium">Curse</th>
            <th className="py-2 text-right font-medium">Venit</th>
          </tr>
        </thead>
        <tbody>
          {weekdays.map((w) => (
            <tr
              key={w.weekday}
              className={`border-b border-zinc-800/60 last:border-0 ${
                w.weekday === bestWeekday ? "bg-emerald-950/30" : ""
              }`}
            >
              <td className="py-2 pr-3 font-medium text-zinc-100">{w.label}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-zinc-300">
                {formatNumber(w.trips)}
              </td>
              <td className="py-2 text-right font-medium tabular-nums text-zinc-50">
                {formatRon(w.revenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BestHoursCard({ data }: { data: WorkRecommendationsData }) {
  return (
    <Card title="Ore bune">
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
                  {formatRon(h.revenue)} · {formatNumber(h.trips)} curse ·{" "}
                  {formatRon(h.averageTripValue)} / cursă
                </p>
              </div>
              <ConfidenceBadge level={h.confidence} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyLine />
      )}
    </Card>
  );
}

function BestWindowsCard({ data }: { data: WorkRecommendationsData }) {
  return (
    <Card title="Intervale de 3 ore bune">
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
                  {formatRon(w.revenue)} · {formatNumber(w.trips)} curse ·{" "}
                  {formatRon(w.averageTripValue)} / cursă
                </p>
              </div>
              <ConfidenceBadge level={w.confidence} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyLine />
      )}
    </Card>
  );
}

function WeakWindowsCard({ data }: { data: WorkRecommendationsData }) {
  return (
    <Card title="Intervale mai slabe">
      <p className="mb-3 flex items-center gap-2 text-sm text-zinc-400">
        <TrendingDown className="h-4 w-4 text-zinc-500" aria-hidden />
        Intervale cu rezultate mai slabe în datele importate.
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
                  {formatRon(w.revenue)} · {formatNumber(w.trips)} curse
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
        Adrese care au produs venit bun în datele importate.
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
                Valoare medie mare pe cursă (minim 3 curse)
              </p>
              <ul className="space-y-2">
                {data.highValuePickups.map((p) => (
                  <li
                    key={p.address}
                    className="rounded-lg bg-zinc-800/40 p-3"
                  >
                    <p className="truncate text-base text-zinc-100" title={p.address}>
                      {p.address}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {formatRon(p.averageTripValue)} / cursă ·{" "}
                      {formatNumber(p.trips)} curse
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <EmptyLine />
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
      <p className="mt-0.5 truncate text-base text-zinc-100" title={pickup.address}>
        {pickup.address}
      </p>
      <p className="text-sm text-zinc-400">
        {formatNumber(pickup.trips)} curse · {formatRon(pickup.revenue)}
      </p>
    </div>
  );
}

function InterpretationCard({ confidence }: { confidence: ConfidenceLevel }) {
  return (
    <Card title="Atenție la interpretare">
      <div className="space-y-3 text-base leading-relaxed text-zinc-300">
        <p className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Încredere generală:</span>
          <ConfidenceBadge level={confidence} />
        </p>
        <p>
          Aceste recomandări arată tipare observate în cursele importate, nu
          garanții. Aplicația nu știe dacă ai stat online fără curse, câte curse ai
          refuzat sau cât ai condus.
        </p>
        <p className="text-zinc-400">
          Recomandare bazată pe cursele existente, nu pe ore online. Merită
          verificat pe teren înainte de a schimba programul.
        </p>
      </div>
    </Card>
  );
}

function EmptyLine() {
  return <p className="text-base text-zinc-400">Date insuficiente.</p>;
}
