/**
 * Parse a Romanian-style money string into a JavaScript number.
 *
 * Romanian numbers use `.` as the thousands separator and `,` as the decimal
 * separator (e.g. "1.234,56"). We stay tolerant: currency symbols, spaces and
 * non-breaking spaces are stripped, and both separator styles are handled by
 * treating the last `.` or `,` as the decimal point.
 *
 * Returns `NaN` when the input has no digits, so callers can detect failures.
 */
export function parseMoney(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return NaN;
  if (typeof raw === "number") return raw;

  // Keep only digits, separators and a leading sign.
  const cleaned = raw.replace(/[^0-9.,-]/g, "");
  if (!cleaned || !/\d/.test(cleaned)) return NaN;

  const negative = cleaned.trim().startsWith("-");
  const digitsAndSeps = cleaned.replace(/-/g, "");

  const lastComma = digitsAndSeps.lastIndexOf(",");
  const lastDot = digitsAndSeps.lastIndexOf(".");
  const decimalPos = Math.max(lastComma, lastDot);

  let intPart: string;
  let fracPart: string;
  if (decimalPos === -1) {
    intPart = digitsAndSeps;
    fracPart = "";
  } else {
    intPart = digitsAndSeps.slice(0, decimalPos);
    fracPart = digitsAndSeps.slice(decimalPos + 1);
  }

  // Everything that is not a digit in the integer part is a grouping separator.
  intPart = intPart.replace(/\D/g, "");
  fracPart = fracPart.replace(/\D/g, "");

  const value = parseFloat(`${intPart || "0"}.${fracPart || "0"}`);
  if (Number.isNaN(value)) return NaN;
  return negative ? -value : value;
}

// Fixed Romanian locale so grouping/decimals match the UI language and are
// identical on server and client (avoids hydration mismatches from the
// system-default locale). Romanian formats as `2.708,08` (dot thousands,
// comma decimals).
const NUMBER_LOCALE = "ro-RO";

/** Format a value as RON currency for display, e.g. `27.157,90 RON`. */
export function formatRon(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const amount = new Intl.NumberFormat(NUMBER_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${amount} RON`;
}

/** Format a plain number with thousands grouping (no currency symbol). */
export function formatNumber(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(NUMBER_LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** Format a value as a percentage with one decimal, e.g. `13.3%`. */
export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(fractionDigits)}%`;
}
