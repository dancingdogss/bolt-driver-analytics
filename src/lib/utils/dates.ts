import { parse, isValid, format } from "date-fns";

/** The format Bolt uses for both `Dată` and `Data călătoriei`. */
export const BOLT_DATE_FORMAT = "dd.MM.yyyy HH:mm";

/**
 * Parse a Bolt date string in `dd.MM.yyyy HH:mm` format.
 * Returns `null` when the input cannot be parsed into a valid date.
 */
export function parseBoltDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsed = parse(trimmed, BOLT_DATE_FORMAT, new Date());
  return isValid(parsed) ? parsed : null;
}

/** Day key `yyyy-MM-dd` used to group daily analytics. */
export function toDayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Human-friendly day label `dd.MM.yyyy`. */
export function formatDay(date: Date): string {
  return format(date, "dd.MM.yyyy");
}

/** Hour of day, 0–23. */
export function getHour(date: Date): number {
  return date.getHours();
}

/** Format an hour bucket as `HH:00`. */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** Month key `yyyy-MM` (local time) used to group and select months. */
export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Romanian month abbreviations, index 0 = January (Ianuarie). */
const MONTHS_SHORT = [
  "Ian", "Feb", "Mar", "Apr", "Mai", "Iun",
  "Iul", "Aug", "Sep", "Oct", "Noi", "Dec",
] as const;

/** Romanian month names, index 0 = January. Fixed list for SSR determinism. */
const MONTHS_LONG = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
] as const;

/** Format a `yyyy-MM-dd` day key as `01 Iun 2026` (deterministic, no locale). */
export function formatDayKeyLong(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  return `${String(day).padStart(2, "0")} ${MONTHS_SHORT[month - 1]} ${year}`;
}

/** Human-friendly Romanian month label, e.g. "Iunie 2026". */
export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTHS_LONG[month - 1]} ${year}`;
}
