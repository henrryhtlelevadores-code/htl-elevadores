export type MaintenanceZone = string;

export const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Set", "Oct", "Nov", "Dic",
] as const;

export function nowSeconds(): number { return Math.floor(Date.now() / 1000); }
export function addMonthsToTimestamp(timestamp: number, months: number): number {
  const date = new Date(timestamp * 1000);
  date.setUTCMonth(date.getUTCMonth() + months);
  return Math.floor(date.getTime() / 1000);
}

export type ApplicableModuleInput = {
  id: string;
  monthsOfYear: string | null;
};

export function getApplicableModules<T extends ApplicableModuleInput & { isActive?: boolean | null }>({
  assigned,
  currentDate,
}: {
  assigned: T[];
  currentDate: Date;
}): T[] {
  const currentMonth = currentDate.getMonth() + 1;
  return assigned.filter((module) =>
    module.isActive !== false &&
    Boolean(module.monthsOfYear?.split(",").map(Number).includes(currentMonth))
  );
}

export type AnnualPlanMonth = {
  month: number;
  year: number;
  codes: string[];
  visitNumber: number;
  isVisitMonth: boolean;
};

export function buildAnnualPlanCalendar({
  assigned,
  startDate,
}: {
  assigned: Array<ApplicableModuleInput & { code?: string | null; isActive?: boolean | null }>;
  startDate: Date;
}): AnnualPlanMonth[] {
  const startMonth = startDate.getMonth() + 1;
  const year = startDate.getFullYear();
  return Array.from({ length: 12 }, (_, index) => {
    const month = ((startMonth - 1 + index) % 12) + 1;
    const targetDate = new Date(year + Math.floor((startMonth - 1 + index) / 12), month - 1, 1);
    const modules = getApplicableModules({ assigned, currentDate: targetDate });
    return {
      month,
      year: targetDate.getFullYear(),
      codes: modules.map((module) => module.code ?? module.id),
      visitNumber: index + 1,
      isVisitMonth: modules.length > 0,
    };
  });
}
