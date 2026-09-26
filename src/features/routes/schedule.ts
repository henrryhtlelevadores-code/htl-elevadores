export const ROUTE_DEFAULTS = {
  totalDays: 10,
  maxDays: 15,
  includeSaturdays: true,
  saturdayMaxHours: 4,
  defaultStopDurationMins: 120,
} as const;

export type RouteConfigValues = {
  technicianId: string;
  totalDays: number;
  maxDays: number;
  includeSaturdays: boolean;
  saturdayMaxHours: number;
  defaultStopDurationMins: number;
};

export const WEEKDAY_MAX_HOURS = 8;

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidMonth(month: string): boolean {
  return MONTH_PATTERN.test(month);
}

/**
 * Día hábil N del mes: 1 = primer día laborable, N = avanzar N-1 días laborables.
 * Domingos siempre se excluyen; sábados según `includeSaturdays`.
 * Feriados: TODO (no existe tabla de feriados).
 */
export function businessDayDate(
  year: number,
  monthIndex: number,
  businessDayNumber: number,
  includeSaturdays: boolean
): Date | null {
  if (businessDayNumber < 1) return null;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  let counter = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, monthIndex, d);
    const dow = date.getDay();
    if (dow === 0) continue;
    if (dow === 6 && !includeSaturdays) continue;
    counter++;
    if (counter === businessDayNumber) return date;
  }
  return null;
}

/** Mapa día hábil -> fecha ISO (YYYY-MM-DD) para los primeros `totalDays` días. */
export function buildMonthSchedule(
  month: string,
  totalDays: number,
  includeSaturdays: boolean
): Map<number, string> {
  const schedule = new Map<number, string>();
  const parsed = MONTH_PATTERN.exec(month);
  if (!parsed) return schedule;
  const year = Number(parsed[1]);
  const monthIndex = Number(parsed[2]) - 1;
  for (let n = 1; n <= totalDays; n++) {
    const date = businessDayDate(year, monthIndex, n, includeSaturdays);
    if (!date) break;
    schedule.set(n, toIsoDate(date));
  }
  return schedule;
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function isWeekendDate(isoDate: string): boolean {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dow = new Date(y, (m ?? 1) - 1, d ?? 1).getDay();
  return dow === 0 || dow === 6;
}

export type DayCapacity = {
  date: string | null;
  isSaturday: boolean;
  maxMinutes: number;
};

/**
 * Límite de carga de un día hábil de la plantilla. La plantilla no tiene fecha
 * propia, así que la capacidad se resuelve contra un mes de referencia
 * (por defecto el mes siguiente al que se generará).
 */
export function resolveDayCapacity(
  month: string,
  businessDayNumber: number,
  config: { includeSaturdays: boolean; saturdayMaxHours: number }
): DayCapacity {
  const date = buildMonthSchedule(month, Math.max(businessDayNumber, 1), config.includeSaturdays).get(
    businessDayNumber
  );
  if (!date) {
    return { date: null, isSaturday: false, maxMinutes: WEEKDAY_MAX_HOURS * 60 };
  }
  const dow = new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10))
  ).getDay();
  const isSaturday = dow === 6;
  return {
    date,
    isSaturday,
    maxMinutes: isSaturday ? Math.round(config.saturdayMaxHours * 60) : WEEKDAY_MAX_HOURS * 60,
  };
}

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  const names = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "setiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${names[Number(m) - 1] ?? m} ${y}`;
}

export function nextMonthLabel(from = new Date()): string {
  const year = from.getMonth() === 11 ? from.getFullYear() + 1 : from.getFullYear();
  const month = (from.getMonth() + 1) % 12;
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function currentMonthLabel(from = new Date()): string {
  return `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`;
}
