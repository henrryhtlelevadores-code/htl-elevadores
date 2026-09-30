/**
 * Ayudantes de fecha para la vista del técnico. Todas operan con fechas
 * locales (el horario del dispositivo) porque el dashboard es mobile-first.
 */

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dateFromISO(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Lista de los próximos 14 días empezando hoy. */
export function nextFourteenDays(): string[] {
  const start = new Date();
  const days: string[] = [];
  for (let i = 0; i < 14; i++) {
    days.push(toISODate(addDays(start, i)));
  }
  return days;
}

export function formatShortDay(date: Date): string {
  return date
    .toLocaleDateString("es-PE", { weekday: "short" })
    .replace(".", "");
}

/** "HOY" · "MAÑANA" · "Martes, 29 de septiembre" */
export function getDateLabel(iso: string): string {
  const d = dateFromISO(iso);
  const today = new Date();
  if (isSameDay(d, today)) return "HOY";
  if (isSameDay(d, addDays(today, 1))) return "MAÑANA";

  const label = d.toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "martes 29 sept" — para acompañar a la etiqueta HOY/MAÑANA. */
export function formatShortHuman(iso: string): string {
  return dateFromISO(iso).toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

/** Tiempo restante (redondeado) hasta una fecha/hora programada, o null si ya pasó. */
export function remainingUntilLabel(
  scheduledDate: string | null,
  scheduledTime: string | null
): string | null {
  if (!scheduledDate) return null;
  const deadline = new Date(`${scheduledDate}T${scheduledTime ?? "00:00"}:00`).getTime();
  const nowMs = Date.now();
  const diff = deadline - nowMs;
  if (diff <= 0) return null;
  const mins = Math.ceil(diff / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}