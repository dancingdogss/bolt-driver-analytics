import { parseMoney } from "@/lib/utils/money";
import type {
  BoltMonthlySummary,
  MonthlySummaryParseResult,
} from "@/lib/types/monthlySummary";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Parse a Romanian-style amount taken from a Bolt monthly summary.
 *
 * Handles both the money format (`.` thousands, `,` decimals) and the
 * kilometrage format (plain `.` decimals), plus trailing units:
 *   "12.637,00 lei" -> 12637
 *   "2.708,08 lei"  -> 2708.08
 *   "130,00 lei"    -> 130
 *   "2452.01km"     -> 2452.01
 *
 * Reuses the well-tested {@link parseMoney}, which already strips units and
 * treats the last `.`/`,` as the decimal separator. Returns `NaN` on failure.
 */
export function parseRomanianNumber(raw: string): number {
  return parseMoney(raw);
}

/**
 * Fold a line of extracted PDF text into a canonical form for matching:
 *   - NFKD + stripping combining marks removes diacritics *and* normalizes the
 *     decomposed accents pdf.js often emits (`a` + combining breve -> `a`), so
 *     "Taxă Bolt" and "Taxa Bolt" both become "taxa bolt";
 *   - NFKD also turns non-breaking / thin spaces into ordinary spaces;
 *   - Unicode minus and dashes become an ASCII "-";
 *   - spaces that a glyph-split inserted *inside* a number are rejoined
 *     ("2.708 ,08" -> "2.708,08"), then the text is trimmed and lower-cased.
 * Digits, dots and commas are otherwise untouched.
 */
function fold(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritic marks
    .replace(/[−–—]/g, "-") // minus / en-dash / em-dash -> "-"
    .replace(/\s+/g, " ")
    .replace(/(\d)\s+(?=[.,]\d)/g, "$1") // "2.708 ,08" / "2452 .01" -> join
    .replace(/([.,])\s+(?=\d)/g, "$1") // "2.708, 08" / "2. 708" -> join
    .trim()
    .toLowerCase();
}

/** All money amounts (numbers carrying a `lei`/`ron` unit) in `lines`, in order. */
function moneyValues(lines: string[]): number[] {
  const out: number[] = [];
  for (const line of lines) {
    const re = /(-?\d[\d.]*(?:,\d+)?)\s*(?:lei|ron)\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const value = parseRomanianNumber(m[1]);
      if (Number.isFinite(value)) out.push(value);
    }
  }
  return out;
}

/** All kilometrage amounts (numbers carrying a `km` unit) in `lines`, in order. */
function kmValues(lines: string[]): number[] {
  const out: number[] = [];
  for (const line of lines) {
    const re = /(-?\d[\d.]*(?:,\d+)?)\s*km\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const value = parseRomanianNumber(m[1]);
      if (Number.isFinite(value)) out.push(value);
    }
  }
  return out;
}

/** Convert a `dd.MM.yyyy` date into an ISO `yyyy-MM-dd` string. */
function roDateToIso(date: string): string | null {
  const m = date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

/** Romanian labels for the amount fields, used for `missingFields` reporting. */
const AMOUNT_LABELS = {
  grossFare: "Tarif brut",
  cancellationFee: "Taxă de anulare",
  reservationFee: "Taxă de rezervare",
  totalFare: "TOTAL",
  tips: "Bacșiș",
  boltFee: "Taxă Bolt",
  tripKilometers: "Kilometraj pe cursă",
} as const;

type AmountKey = keyof typeof AMOUNT_LABELS;

/** Folded section headers used to segment the document. */
const SECTION = {
  tarif: "defalcare tarif",
  otherIncome: "defalcare alte venituri",
  deductions: "alte posibile deduceri",
} as const;

/** Index of the first line that contains `header`, at or after `from`. */
function findHeader(lines: string[], header: string, from = 0): number {
  for (let i = from; i < lines.length; i++) {
    if (lines[i].includes(header)) return i;
  }
  return -1;
}

/**
 * Lines strictly between the `start` header and the earliest of `ends` (or the
 * end of the document). Returns `[]` when the start header is absent.
 */
function sliceBlock(lines: string[], start: string, ends: string[]): string[] {
  const startIdx = findHeader(lines, start);
  if (startIdx < 0) return [];
  let endIdx = lines.length;
  for (const end of ends) {
    const idx = findHeader(lines, end, startIdx + 1);
    if (idx >= 0 && idx < endIdx) endIdx = idx;
  }
  return lines.slice(startIdx + 1, endIdx);
}

/**
 * Extract amount fields by document section.
 *
 * Bolt's PDF text often lists all labels of a section first and all values
 * after, so values are read **positionally** from each section block rather
 * than next to their labels:
 *   - DEFALCARE TARIF   -> [grossFare, cancellationFee, reservationFee, totalFare]
 *   - DEFALCARE ALTE VENITURI -> tips = first money value
 *   - ALTE POSIBILE DEDUCERI  -> boltFee = first money value, km = first km value
 * This also handles the "label value on one line" layout, since the ordered
 * money values come out the same. Fields not resolvable are left absent.
 */
function extractBySections(lines: string[]): Partial<Record<AmountKey, number>> {
  const result: Partial<Record<AmountKey, number>> = {};

  const tarif = moneyValues(
    sliceBlock(lines, SECTION.tarif, [SECTION.otherIncome, SECTION.deductions]),
  );
  if (tarif[0] !== undefined) result.grossFare = tarif[0];
  if (tarif[1] !== undefined) result.cancellationFee = tarif[1];
  if (tarif[2] !== undefined) result.reservationFee = tarif[2];
  if (tarif[3] !== undefined) result.totalFare = tarif[3];

  // `tips` is intentionally not resolved here — it is handled by extractTips so
  // a DEFALCARE TARIF value can never leak into it.

  const deductionsBlock = sliceBlock(lines, SECTION.deductions, []);
  const deductions = moneyValues(deductionsBlock);
  if (deductions[0] !== undefined) result.boltFee = deductions[0];
  const km = kmValues(deductionsBlock);
  if (km[0] !== undefined) result.tripKilometers = km[0];

  return result;
}

/**
 * First money value inside `blob` between `start` and `end` markers, skipping
 * any value present in `guards` (used to reject mis-parses).
 */
function firstMoneyInRegion(
  blob: string,
  start: number,
  end: number,
  guards: number[],
): number | undefined {
  if (start < 0) return undefined;
  const region = blob.slice(start, end < 0 ? blob.length : end);
  for (const value of moneyValues([region])) {
    if (!guards.includes(value)) return value;
  }
  return undefined;
}

/**
 * Extract `tips` (Bacșiș) *strictly* from the "other income" area so it can
 * never borrow a DEFALCARE TARIF value.
 *
 * Works on the folded `blob` (all lines joined), so a `DEFALCARE ALTE VENITURI`
 * header that pdf.js split across reconstructed lines is still contiguous here.
 * The region between that header and `ALTE POSIBILE DEDUCERI` is scanned for its
 * first money value — regardless of whether the value sits before or after the
 * "Bacșiș" label. Falls back to the region after the Bacșiș/Bacsis label. Any
 * value equal to a DEFALCARE TARIF value (`tarifGuards`: gross fare,
 * cancellation fee, reservation fee, total) is skipped, so a leaked TARIF number
 * is never used as the tip. Returns `undefined` (→ marked missing) only when no
 * non-TARIF money is found in that area.
 */
function extractTips(blob: string, tarifGuards: number[]): number | undefined {
  const dedIdx = blob.indexOf(SECTION.deductions);

  // 1) Whole DEFALCARE ALTE VENITURI section (header contiguous in the blob).
  const headerIdx = blob.indexOf(SECTION.otherIncome);
  if (headerIdx >= 0) {
    const start = headerIdx + SECTION.otherIncome.length;
    const fromSection = firstMoneyInRegion(blob, start, dedIdx, tarifGuards);
    if (fromSection !== undefined) return fromSection;
  }

  // 2) Fallback: money after the Bacșiș/Bacsis label, bounded before deductions.
  const labelMatch = /(?:^|[^a-z0-9])bacsis(?![a-z])/.exec(blob);
  if (labelMatch) {
    const start = labelMatch.index + labelMatch[0].length;
    return firstMoneyInRegion(blob, start, dedIdx, tarifGuards);
  }

  return undefined;
}

/** Index of `label` in an already-folded `line`, respecting word edges. */
function indexOfLabel(line: string, label: string): number {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?![a-z])`);
  const m = re.exec(line);
  return m ? m.index + m[0].length - label.length : -1;
}

/**
 * Fallback for documents without section headers: find the first line with the
 * label and read the first money/km amount from that line or the next one.
 */
function amountForLabel(lines: string[], label: string): number | null {
  for (let i = 0; i < lines.length; i++) {
    const pos = indexOfLabel(lines[i], label);
    if (pos < 0) continue;
    const rest = lines[i].slice(pos + label.length);
    const here = moneyValues([rest])[0] ?? kmValues([rest])[0];
    if (here !== undefined) return here;
    if (i + 1 < lines.length) {
      const next = moneyValues([lines[i + 1]])[0] ?? kmValues([lines[i + 1]])[0];
      if (next !== undefined) return next;
    }
    return null;
  }
  return null;
}

/**
 * Parse the plain text of a Bolt monthly summary into a rich result (summary +
 * `missingFields` + `error`). Pure and synchronous so it can be unit-tested
 * without a real PDF. The period line is mandatory (it yields `monthKey`); if it
 * is missing the document is treated as "not a Bolt monthly summary". Fields
 * that cannot be read are returned as `0` but always listed in `missingFields`.
 */
export function parseMonthlySummaryText(
  rawText: string,
  sourceFileName?: string,
): MonthlySummaryParseResult {
  const lines = rawText
    .split(/\r?\n/)
    .map(fold)
    .filter((line) => line.length > 0);
  const blob = lines.join(" "); // period may be split across two lines

  const periodMatch = blob.match(
    /perioada\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*-\s*(\d{1,2}\.\d{1,2}\.\d{4})/,
  );
  const periodStart = periodMatch ? roDateToIso(periodMatch[1]) : null;
  const periodEnd = periodMatch ? roDateToIso(periodMatch[2]) : null;

  if (!periodStart || !periodEnd) {
    return { summary: null, missingFields: [], error: "invalid" };
  }

  const monthKey = periodStart.slice(0, 7); // yyyy-MM

  // Section-based extraction is primary; per-field label search is the fallback
  // for PDFs whose section headers are absent or renamed.
  const bySection = extractBySections(lines);
  const missingFields: string[] = [];
  const values = {} as Record<AmountKey, number>;

  const resolve = (key: AmountKey): number | undefined => {
    const value = bySection[key];
    if (value !== undefined) return value;
    const byLabel = amountForLabel(lines, fold(AMOUNT_LABELS[key]));
    return byLabel === null ? undefined : byLabel;
  };

  const set = (key: AmountKey, value: number | undefined) => {
    if (value === undefined) {
      missingFields.push(AMOUNT_LABELS[key]);
      values[key] = 0;
    } else {
      values[key] = value;
    }
  };

  // Resolve TARIF and deduction fields first. `tips` is handled separately so it
  // can never borrow a DEFALCARE TARIF value.
  const grossFare = resolve("grossFare");
  const cancellationFee = resolve("cancellationFee");
  const reservationFee = resolve("reservationFee");
  const totalFare = resolve("totalFare");
  set("grossFare", grossFare);
  set("cancellationFee", cancellationFee);
  set("reservationFee", reservationFee);
  set("totalFare", totalFare);
  set("boltFee", resolve("boltFee"));
  set("tripKilometers", resolve("tripKilometers"));

  // Guard tips against *every* DEFALCARE TARIF value (gross fare, cancellation
  // fee, reservation fee, total) so a TARIF number leaking into the other-income
  // region — e.g. "Taxă de anulare 68,00 lei" — is skipped rather than used.
  const tarifGuards = [
    grossFare,
    cancellationFee,
    reservationFee,
    totalFare,
  ].filter((v): v is number => v !== undefined);
  set("tips", extractTips(blob, tarifGuards));

  const summary: BoltMonthlySummary = {
    platform: "bolt",
    periodStart,
    periodEnd,
    monthKey,
    grossFare: values.grossFare,
    cancellationFee: values.cancellationFee,
    reservationFee: values.reservationFee,
    totalFare: values.totalFare,
    tips: values.tips,
    boltFee: values.boltFee,
    tripKilometers: values.tripKilometers,
    sourceFileName,
  };

  return { summary, missingFields };
}

/**
 * Pure convenience wrapper requested by the app spec: parse extracted text and
 * return the {@link BoltMonthlySummary} directly (or `null` when the text is not
 * a Bolt monthly summary). Missing fields are logged in development so they are
 * never silently zeroed.
 */
export function parseBoltMonthlySummaryText(
  text: string,
  sourceFileName?: string,
): BoltMonthlySummary | null {
  const { summary, missingFields } = parseMonthlySummaryText(text, sourceFileName);
  if (isDev && summary && missingFields.length > 0) {
    console.warn("Bolt monthly summary — missing fields:", missingFields);
  }
  return summary;
}

/**
 * Local validation: return the Romanian labels of amount fields that look
 * unread (missing or a non-positive number where a value is expected). Useful
 * for quick sanity checks and dev logging.
 */
export function validateBoltMonthlySummary(summary: BoltMonthlySummary): string[] {
  const checks: [keyof typeof AMOUNT_LABELS, number][] = [
    ["grossFare", summary.grossFare],
    ["totalFare", summary.totalFare],
    ["boltFee", summary.boltFee],
    ["tripKilometers", summary.tripKilometers],
  ];
  return checks
    .filter(([, value]) => !(value > 0))
    .map(([key]) => AMOUNT_LABELS[key]);
}

/** Lazily load pdf.js in the browser and point it at the bundled worker. */
async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  return pdfjs;
}

/**
 * Extract PDF text while preserving visual lines. pdf.js returns positioned
 * glyph runs, not lines, so we group items by their y coordinate (a table row
 * shares one y) and order each row left-to-right by x. Blocks and section
 * headers survive, which is what the section parser relies on.
 */
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const lines: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const rows = new Map<number, { x: number; str: string }[]>();
      for (const item of content.items) {
        if (!("str" in item) || item.str === "") continue;
        const x = item.transform[4];
        const y = Math.round(item.transform[5]); // cluster by row
        const row = rows.get(y) ?? [];
        row.push({ x, str: item.str });
        rows.set(y, row);
      }
      // PDF y grows upward, so sort rows top-to-bottom (descending y).
      for (const y of [...rows.keys()].sort((a, b) => b - a)) {
        const line = rows
          .get(y)!
          .sort((a, b) => a.x - b.x)
          .map((i) => i.str)
          .join(" ");
        lines.push(line);
      }
    }
  } finally {
    await doc.destroy();
  }
  return lines.join("\n");
}

/**
 * Read a Bolt monthly-summary PDF entirely client-side (text extraction, no
 * OCR) and parse it into a {@link BoltMonthlySummary}. Returns an `error` result
 * when the file cannot be read as a PDF.
 */
export async function parseBoltMonthlySummaryPdf(
  file: File,
): Promise<MonthlySummaryParseResult> {
  let text: string;
  try {
    text = await extractPdfText(file);
  } catch {
    return { summary: null, missingFields: [], error: "unreadable" };
  }
  if (isDev) console.log("PDF raw extracted text", text);
  const result = parseMonthlySummaryText(text, file.name);
  if (isDev) console.log("Parsed monthly summary", result);
  return result;
}
