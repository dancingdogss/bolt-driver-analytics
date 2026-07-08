import { ChevronDown } from "lucide-react";

const STEPS: { title: string; text: string }[] = [
  {
    title: "1. Descarcă CSV-urile din Bolt",
    text: "Intră în Bolt și descarcă fișierele Facturi călătorie pentru lunile dorite.",
  },
  {
    title: "2. Încarcă fișierele aici",
    text: "Poți încărca mai multe luni deodată.",
  },
  {
    title: "3. Alege luna și verifică rezultatele",
    text: "Aplicația calculează automat venitul, cursele, TVA-ul, metodele de plată și profitul estimat.",
  },
];

const TITLE = "Cum folosești aplicația";
const CSV_EXPLANATION =
  "Fișiere CSV Bolt = fișierele de facturi călătorie descărcate din contul Bolt.";

function StepCards() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STEPS.map((step) => (
          <div
            key={step.title}
            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm"
          >
            <p className="text-base font-semibold text-zinc-100">{step.title}</p>
            <p className="mt-2 text-base leading-relaxed text-zinc-300">
              {step.text}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-zinc-400">{CSV_EXPLANATION}</p>
    </>
  );
}

/**
 * The 3-step guide. Always expanded before the first import; once data exists
 * it becomes a collapsible section (closed by default) to save space.
 */
export default function HowToUse({ collapsible }: { collapsible: boolean }) {
  if (!collapsible) {
    return (
      <section aria-label={TITLE}>
        <h2 className="mb-3 text-lg font-semibold text-zinc-100">{TITLE}</h2>
        <StepCards />
      </section>
    );
  }

  return (
    <details className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-lg font-semibold text-zinc-100">
        <ChevronDown
          className="h-5 w-5 text-zinc-400 transition-transform group-open:rotate-180"
          aria-hidden
        />
        {TITLE}
      </summary>
      <div className="mt-4">
        <StepCards />
      </div>
    </details>
  );
}
