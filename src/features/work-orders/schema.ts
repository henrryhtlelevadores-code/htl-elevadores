import { z } from "zod";

/** Un servicio general de la OT. Las tareas se escriben una por línea. */
export const workOrderServiceItemSchema = z.object({
  serviceTypeId: z.string().optional().or(z.literal("")),
  locationDescription: z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
  description: z
    .string()
    .trim()
    .min(3, "Describe el servicio a realizar")
    .max(1000, "Máximo 1000 caracteres"),
  tasks: z.string().max(4000, "Demasiadas tareas").optional().or(z.literal("")),
});

export type WorkOrderServiceItemValues = z.infer<typeof workOrderServiceItemSchema>;

/** Convierte el texto de tareas (una por línea) en la lista a registrar. */
export const parseServiceTasks = (value: string | null | undefined): string[] =>
  (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length > 0)
    .map((line) => line.slice(0, 300));

export const workOrderFormSchema = z.object({
  clientId: z.string().optional().or(z.literal("")),
  costCenterId: z.string().min(1, "El centro de costo es obligatorio"),
  serviceTypeId: z.string().min(1, "El tipo de servicio es obligatorio"),
  technicianId: z.string().optional().or(z.literal("")),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "EMERGENCY"]).optional(),
  scheduledDate: z.string().min(1, "La fecha programada es obligatoria"),
  scheduledTime: z.string().min(1, "La hora programada es obligatoria"),
  // Una OT atiende ascensores o servicios generales, según el tipo de servicio:
  // qué lista es obligatoria lo valida el servidor con ese dato.
  elevatorUnityIds: z.array(z.string()),
  services: z.array(workOrderServiceItemSchema),
  description: z.string().optional(),
  supportingTechnicians: z.string().optional(),
  estimatedDurationMins: z.coerce.number().int().positive().optional().nullable(),
});

export type WorkOrderFormValues = z.infer<typeof workOrderFormSchema>;

export const workOrderElevatorFormSchema = z.object({
  workOrderId: z.string().min(1, "La OT es obligatoria"),
  elevatorUnityId: z.string().min(1, "El equipo es obligatorio"),
  finding: z
    .string()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
});

export type WorkOrderElevatorFormValues = z.infer<typeof workOrderElevatorFormSchema>;

export const workOrderTaskFormSchema = z.object({
  workOrderElevatorId: z.string().min(1, "El equipo de la OT es obligatorio"),
  taskDescription: z
    .string()
    .min(2, "La descripción debe tener al menos 2 caracteres")
    .max(300, "Máximo 300 caracteres"),
  isCritical: z.boolean().default(false),
  observations: z
    .string()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
  requiresPhoto: z.boolean().default(false),
});

export type WorkOrderTaskFormValues = z.infer<typeof workOrderTaskFormSchema>;
