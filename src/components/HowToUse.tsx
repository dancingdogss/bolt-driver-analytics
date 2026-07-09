import { ChevronDown } from "lucide-react";

const STEPS: { title: string; text: string }[] = [
  {
    title: "Pasul 1: Încarcă CSV-ul Bolt",
    text: "Fișierul cu facturi călătorie din Bolt. Poți încărca mai multe luni deodată.",
  },
  {
    title: "Pasul 2: Încarcă PDF-ul lunar (opțional)",
    text: "Rezumatul lunar Bolt aduce taxa Bolt reală și kilometrii reali, pentru un calcul mai precis.",
  },
  {
    title: "Pasul 3: Alege luna și verifică profitul",
    text: "Aplicația calculează venitul, cursele și profitul estimat pentru luna aleasă.",
  },
];

const TITLE = "Cum folosești aplicația";

/** Plain-language explanation of what each file brings, side by side. */
function FileTypeCards() {
  const cards = [
    {
      tag: "CSV",
      title: "Curse individuale",
      text: "Fiecare cursă: zile, ore, adresă de preluare și plată cash / card / business.",
    },
    {
      tag: "PDF",
      title: "Taxă Bolt reală + kilometri reali",
      text: "Rezumatul lunar Bolt cu taxa Bolt exactă și kilometrii reali pentru luna respectivă.",
    },
  ];
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <div
          key={card.tag}
          className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
        >
          <span className="inline-block rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-200">
            {card.tag}
          </span>
          <p className="mt-2 text-base font-semibold text-zinc-100">{card.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-300">{card.text}</p>
        </div>
      ))}
    </div>
  );
}

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
      <FileTypeCards />
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
