export type IsoDate = string;

export interface CalendarCell {
  date: Date;
  iso: IsoDate;
  day: number;
  inCurrentMonth: boolean;
  isToday: boolean;
}

const MS_PER_DAY = 86_400_000;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function startOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1);
}

export function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

export function addYears(d: Date, delta: number): Date {
  return new Date(d.getFullYear() + delta, d.getMonth(), 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isBetween(d: Date, min?: IsoDate, max?: IsoDate): boolean {
  const t = startOfDay(d).getTime();
  if (min) {
    const [y, m, dd] = min.split("-").map(Number);
    if (t < new Date(y, (m ?? 1) - 1, dd ?? 1).getTime()) return false;
  }
  if (max) {
    const [y, m, dd] = max.split("-").map(Number);
    if (t > new Date(y, (m ?? 1) - 1, dd ?? 1).getTime()) return false;
  }
  return true;
}

export function toIso(d: Date): IsoDate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIso(value: IsoDate | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

export function formatLong(d: Date, locale = "es-PE"): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatMonthYear(d: Date, locale = "es-PE"): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  })
    .format(d)
    .replace(/^./, (c) => c.toUpperCase());
}

const WEEK_FMT_CACHE = new Map<string, Intl.DateTimeFormat>();

function weekFormatter(locale: string): Intl.DateTimeFormat {
  let fmt = WEEK_FMT_CACHE.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    WEEK_FMT_CACHE.set(locale, fmt);
  }
  return fmt;
}

export function weekDayHeaders(locale = "es-PE"): string[] {
  const fmt = weekFormatter(locale);
  const base = new Date(2024, 8, 1); // 1 Sep 2024 is a Sunday.
  const headers: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(base.getTime() + i * MS_PER_DAY);
    const label = fmt.format(day).replace(".", "");
    headers.push(label.charAt(0).toUpperCase() + label.slice(1));
  }
  return headers;
}

export function getMonthMatrix(year: number, monthIndex: number, today: Date): CalendarCell[][] {
  const first = startOfMonth(year, monthIndex);
  const leading = first.getDay(); // 0..6, Sunday-first.
  const start = new Date(first.getTime() - leading * MS_PER_DAY);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start.getTime() + i * MS_PER_DAY);
    cells.push({
      date,
      iso: toIso(date),
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === monthIndex,
      isToday: isSameDay(date, today),
    });
  }
  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < 6; i++) weeks.push(cells.slice(i * 7, i * 7 + 7));
  return weeks;
}

export function getYearRange(centerYear: number, span = 5): number[] {
  const start = centerYear - span;
  const end = centerYear + span;
  const years: number[] = [];
  for (let y = start; y <= end; y++) years.push(y);
  return years;
}

// ==========================================
// HORA (formato HH:00, sin minutos por ahora)
// ==========================================

export type HourOfDay = `${number}:${number}`;
export type IsoHour = `${string}:${string}`;

const HOUR_REGEX = /^(\d{1,2}):(00|15|30|45)$/;

export function isHourOfDay(value: string): value is IsoHour {
  return HOUR_REGEX.test(value);
}

export function clampHour(hour: number): number {
  if (!Number.isFinite(hour)) return 0;
  if (hour < 0) return 0;
  if (hour > 23) return 23;
  return Math.trunc(hour);
}

export function toHourValue(hour: number): IsoHour {
  return `${String(clampHour(hour)).padStart(2, "0")}:00` as IsoHour;
}

export function formatHourValue(value: string): string {
  if (!isHourOfDay(value)) return "";
  const [h] = value.split(":");
  return `${h.padStart(2, "0")}:00`;
}

export function parseHourInput(input: string): IsoHour | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = /^(\d{1,2})(?::(\d{1,2}))?$/.exec(trimmed);
  if (!match) return null;
  const hour = Number(match[1]);
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  if (minutes !== 0) return null;
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  return toHourValue(hour);
}
