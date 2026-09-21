import { z } from "zod";

export const routeStopFormSchema = z.object({
  technicianId: z.string().min(1, "Selecciona un técnico"),
  businessDayNumber: z.coerce.number().int().min(1).max(20),
  plannedTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (formato HH:MM)"),
  contractElevatorIds: z.array(z.string()).min(1, "Selecciona al menos un equipo"),
});

export type RouteStopFormValues = z.infer<typeof routeStopFormSchema>;

export const routeStopSheetSchema = z.object({
  contractId: z.string().min(1, "Selecciona un contrato o edificio"),
  plannedTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (formato HH:MM)"),
  equipmentIds: z.array(z.string()).min(1, "Selecciona al menos un equipo"),
});

export type RouteStopSheetValues = z.infer<typeof routeStopSheetSchema>;