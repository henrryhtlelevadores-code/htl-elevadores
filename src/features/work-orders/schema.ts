import { z } from "zod";

export const workOrderFormSchema = z.object({
  clientId: z.string().optional().or(z.literal("")),
  costCenterId: z.string().min(1, "El centro de costo es obligatorio"),
  serviceTypeId: z.string().min(1, "El tipo de servicio es obligatorio"),
  technicianId: z.string().optional().or(z.literal("")),
  priority: z.string().optional().or(z.literal("")),
  scheduledDate: z.string().min(1, "La fecha programada es obligatoria"),
  scheduledTime: z.string().optional().or(z.literal("")),
  elevatorUnityIds: z.array(z.string()),
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
});

export type WorkOrderTaskFormValues = z.infer<typeof workOrderTaskFormSchema>;