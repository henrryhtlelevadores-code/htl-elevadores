import { z } from "zod";

export const routeStopFormSchema = z.object({
  technicianId: z.string().min(1, "Selecciona un técnico"),
  businessDayNumber: z.coerce.number().int().min(1).max(20),
  plannedTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (formato HH:MM)"),
  estimatedDurationMins: z.coerce
    .number()
    .int()
    .min(15, "Duración mínima 15 minutos")
    .max(600, "Duración máxima 600 minutos"),
  contractId: z.string().min(1, "Selecciona un contrato"),
  elevatorUnityIds: z
    .array(z.string())
    .min(1, "Selecciona al menos un equipo")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Hay equipos duplicados en la selección",
    }),
});

export type RouteStopFormValues = z.infer<typeof routeStopFormSchema>;

export const routeStopSheetSchema = z.object({
  contractId: z.string().min(1, "Selecciona un contrato o edificio"),
  plannedTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (formato HH:MM)"),
  estimatedDurationMins: z.coerce
    .number()
    .int()
    .min(15, "Duración mínima 15 minutos")
    .max(600, "Duración máxima 600 minutos"),
  elevatorUnityIds: z
    .array(z.string())
    .min(1, "Selecciona al menos un equipo")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Hay equipos duplicados en la selección",
    }),
});

export type RouteStopSheetValues = z.infer<typeof routeStopSheetSchema>;

export const routeConfigSchema = z.object({
  totalDays: z.coerce.number().int().min(1, "Mínimo 1 día"),
  maxDays: z.coerce.number().int().min(1).optional(),
  includeSaturdays: z.boolean(),
  saturdayMaxHours: z.coerce
    .number()
    .min(0, "Mínimo 0 horas")
    .max(12, "Máximo 12 horas"),
  defaultStopDurationMins: z.coerce
    .number()
    .int()
    .min(15, "Mínimo 15 minutos")
    .max(600, "Máximo 600 minutos"),
});

export type RouteConfigInput = z.infer<typeof routeConfigSchema>;
