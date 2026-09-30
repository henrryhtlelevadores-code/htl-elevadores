/** Identificador de zona administrada desde el catálogo de maestros. */
export type MaintenanceZone = string;

/** Frecuencias en meses ofrecidas al asignar un módulo a un ascensor. */
export const FREQUENCY_MONTHS_OPTIONS = [1, 3, 6, 12] as const;

export const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Set", "Oct", "Nov", "Dic",
] as const;

/**
 * Grupo de rotación 1: el módulo va en todas las visitas preventivas.
 * Los grupos 2..N se turnan: en cada visita entra un solo grupo rotativo.
 */
export const ALWAYS_ROTATION_GROUP = 1;

/** Frecuencias de mantenimiento ofrecidas en el contrato. */
export const MAINTENANCE_FREQUENCY_OPTIONS = [1, 2, 3, 6, 12] as const;

/** Máximo de grupos de rotación admitidos en el catálogo. */
export const MAX_ROTATION_GROUP = 12;

/**
 * Grupo efectivo de un módulo. Sin grupo guardado se trata como R1 para que
 * ningún módulo quede fuera de la generación por un dato incompleto.
 */
export function rotationGroupOf(
  rotationGroup: number | null | undefined
): number {
  return typeof rotationGroup === "number" &&
    Number.isInteger(rotationGroup) &&
    rotationGroup >= ALWAYS_ROTATION_GROUP
    ? rotationGroup
    : ALWAYS_ROTATION_GROUP;
}

/** ¿El módulo va en todas las visitas? */
export function isAlwaysModule(rotationGroup: number | null | undefined): boolean {
  return rotationGroupOf(rotationGroup) === ALWAYS_ROTATION_GROUP;
}

/** ¿El módulo se turna entre visitas? */
export function isRotatingModule(rotationGroup: number | null | undefined): boolean {
  return rotationGroupOf(rotationGroup) > ALWAYS_ROTATION_GROUP;
}

export function maintenanceFrequencyLabel(months: number | null | undefined): string {
  switch (months ?? 1) {
    case 1:
      return "Mensual";
    case 2:
      return "Bimestral";
    case 3:
      return "Trimestral";
    case 6:
      return "Semestral";
    case 12:
      return "Anual";
    default:
      return `Cada ${months} meses`;
  }
}

/** Meses calendario transcurridos entre dos fechas (puede ser negativo). */
export function monthsBetween(from: Date, to: Date): number {
  const years = to.getUTCFullYear() - from.getUTCFullYear();
  const months = to.getUTCMonth() - from.getUTCMonth();
  return years * 12 + months;
}

/** Datos mínimos de un módulo para decidir si aplica en una visita. */
export type ApplicableModuleInput = {
  id: string;
  rotationGroup: number | null;
};

export type RotationCalendar = {
  /** Visita actual contada desde el inicio del contrato. */
  visitsSinceStart: number;
  /** Grupo que corresponde a esta visita: 1 = siempre, 2..N = rotativos. */
  rotationIndex: number;
  /** Cantidad de grupos rotativos, es decir max(grupo) - 1. */
  totalRotatingGroups: number;
};

/**
 * Calendario rotativo del contrato.
 * El grupo 1 va en todas las visitas; los grupos 2..N se turnan y solo entra
 * uno por visita. Si el contrato no tiene módulos rotativos, manda el grupo 1.
 */
export function getRotationCalendar(
  rotationGroups: Array<number | null>,
  startDate: Date,
  currentDate: Date,
  frequencyMonths: number
): RotationCalendar {
  const frequency = frequencyMonths > 0 ? frequencyMonths : 12;
  const monthsSinceStart = monthsBetween(startDate, currentDate);
  const visitsSinceStart = Math.floor(monthsSinceStart / frequency);

  const groups = rotationGroups.map(rotationGroupOf);
  const maxGroup = groups.reduce((max, group) => Math.max(max, group), ALWAYS_ROTATION_GROUP);
  const totalRotatingGroups = Math.max(maxGroup - 1, 0);

  if (totalRotatingGroups === 0) {
    return { visitsSinceStart, rotationIndex: ALWAYS_ROTATION_GROUP, totalRotatingGroups };
  }

  // El módulo es seguro para contratos cuya fecha de inicio aún no llegó,
  // donde `visitsSinceStart` sale negativo.
  const rotationIndex =
    ((visitsSinceStart % totalRotatingGroups) + totalRotatingGroups) %
      totalRotatingGroups +
    (ALWAYS_ROTATION_GROUP + 1);

  return { visitsSinceStart, rotationIndex, totalRotatingGroups };
}

/** ¿Este módulo concreto corresponde a la visita actual? */
export function moduleAppliesOnVisit(
  module: ApplicableModuleInput,
  calendar: RotationCalendar
): boolean {
  const group = rotationGroupOf(module.rotationGroup);
  if (group === ALWAYS_ROTATION_GROUP) return true;
  return group === calendar.rotationIndex;
}

/**
 * Filtra los módulos asignados que corresponde ejecutar en esta visita.
 *
 * - Los módulos R1 van siempre.
 * - Si hay rotativos, solo entra el grupo que le toca a la visita actual.
 * - Si no hay rotativos, van todos: no es un error, es el caso válido de un
 *   contrato con todos sus módulos en R1.
 */
export function getApplicableModules<
  T extends ApplicableModuleInput & { isActive?: boolean | null }
>({
  assigned,
  startDate,
  currentDate,
  frequencyMonths,
}: {
  assigned: T[];
  startDate: Date;
  currentDate: Date;
  frequencyMonths: number;
}): T[] {
  const active = assigned.filter((module) => module.isActive !== false);
  if (active.length === 0) return [];

  const hasRotating = active.some((module) => isRotatingModule(module.rotationGroup));
  if (!hasRotating) {
    // Todos en R1: van en todas las visitas.
    return active;
  }

  const calendar = getRotationCalendar(
    active.map((module) => module.rotationGroup),
    startDate,
    currentDate,
    frequencyMonths
  );

  return active.filter((module) => moduleAppliesOnVisit(module, calendar));
}

export type AnnualPlanMonth = {
  /** 1..12 */
  month: number;
  year: number;
  /** Códigos de los módulos que se ejecutan en ese mes. */
  codes: string[];
  /** Posición dentro del ciclo que arranca con el contrato. */
  visitNumber: number;
  /** El mes cae en una visita de mantenimiento. */
  isVisitMonth: boolean;
};

type PlanModuleInput = ApplicableModuleInput & {
  code?: string | null;
  isActive?: boolean | null;
};

/**
 * Calendario real de los próximos meses, contado desde el inicio del contrato.
 * Ejemplo: contrato en Mayo 2026 con frecuencia trimestral y grupos 2, 3 y 4
 * devuelve Mayo 2026 -> [R1, grupo 2] y Agosto 2026 -> [R1, grupo 3].
 */
export function buildAnnualPlanCalendar({
  assigned,
  startDate,
  frequencyMonths,
  months = 12,
}: {
  assigned: PlanModuleInput[];
  startDate: Date;
  frequencyMonths: number;
  months?: number;
}): AnnualPlanMonth[] {
  const active = assigned.filter((module) => module.isActive !== false);
  const frequency = frequencyMonths > 0 ? frequencyMonths : 12;

  const anchor = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1)
  );

  return Array.from({ length: months }, (_, index) => {
    const date = new Date(anchor);
    date.setUTCMonth(anchor.getUTCMonth() + index);

    const applicable = getApplicableModules({
      assigned: active,
      startDate: anchor,
      currentDate: date,
      frequencyMonths: frequency,
    });

    return {
      month: date.getUTCMonth() + 1,
      year: date.getUTCFullYear(),
      codes: applicable
        .map((module) => module.code)
        .filter((code): code is string => !!code),
      visitNumber: Math.floor(index / frequency) + 1,
      isVisitMonth: index % frequency === 0,
    };
  });
}

export function frequencyMonthsLabel(months: number): string {
  switch (months) {
    case 1:
      return "Mensual";
    case 3:
      return "Trimestral";
    case 6:
      return "Semestral";
    case 12:
      return "Anual";
    default:
      return `Cada ${months} meses`;
  }
}

/** "12/año" · "4/año" · "2/año" */
export function frequencyPerYearLabel(perYear: number): string {
  return `${perYear}/año`;
}

/** Frecuencia anual sugerida cuando se elige una frecuencia en meses. */
export function monthsToPerYear(months: number): number {
  if (months <= 0) return 0;
  return 12 / months;
}

/**
 * Timestamp en segundos (convención del proyecto: `unixNow()` y
 * `new Date(ts * 1000)`) sumando meses calendario a `from`.
 */
export function addMonthsToTimestamp(
  from: number,
  months: number
): number {
  const date = new Date(from * 1000);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  // Si el mes destino es más corto, no pasarse del último día válido.
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return Math.floor(date.getTime() / 1000);
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
