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

/** Human-friendly Romanian month label, e.g. "Iunie 2026". */
export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  const label = new Intl.DateTimeFormat("ro-RO", {
    month: "long",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
