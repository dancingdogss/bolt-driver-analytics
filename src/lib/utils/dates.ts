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

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * ISO-8601 week key, e.g. `2026-W01`, computed deterministically from the
 * LOCAL calendar date (year/month/day). The arithmetic runs entirely in UTC on
 * that calendar date, so the result never shifts with the machine's timezone
 * or DST. ISO rule: a week belongs to the year that contains its Thursday, so
 * 29 Dec 2025 → `2026-W01` and 28 Dec 2025 → `2025-W52`.
 */
export function isoWeekKey(date: Date): string {
  const utcMidnight = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  // ISO weekday 1 (Monday) … 7 (Sunday).
  const isoWeekday = new Date(utcMidnight).getUTCDay() || 7;
  // The Thursday of this date's ISO week decides the ISO year.
  const thursday = utcMidnight + (4 - isoWeekday) * DAY_MS;
  const isoYear = new Date(thursday).getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((thursday - yearStart) / DAY_MS + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
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
