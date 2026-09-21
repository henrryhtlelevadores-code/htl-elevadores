import { z } from "zod";

export const elevatorUnityFormSchema = z.object({
  costCenterId: z.string().min(1, "El centro de costo es obligatorio"),
  brandId: z.string().optional().or(z.literal("")),
  modelId: z.string().optional().or(z.literal("")),
  elevatorTypeId: z.string().min(1, "El tipo de ascensor es obligatorio"),
  internalCode: z
    .string()
    .min(1, "El código interno es obligatorio")
    .max(30, "Máximo 30 caracteres"),
  manufacturerSerial: z
    .string()
    .max(50, "Máximo 50 caracteres")
    .optional()
    .or(z.literal("")),
  name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(120, "Máximo 120 caracteres"),
  capacityPersons: z.coerce.number().int().positive().optional().nullable(),
  capacityKg: z.coerce.number().int().positive().optional().nullable(),
  speedMs: z.coerce.number().positive().optional().nullable(),
  stops: z.coerce.number().int().optional().nullable(),
  floors: z.coerce.number().int().optional().nullable(),
tractionType: z
    .string()
    .max(100, "Máximo 100 caracteres")
    .optional()
    .or(z.literal("")),
  yearOfFabrication: z.coerce.number().int().min(1900, "Año no válido").max(2100, "Año no válido").optional().nullable(),
  status: z.string().optional().or(z.literal("")),
});

export type ElevatorUnityFormValues = z.infer<typeof elevatorUnityFormSchema>;