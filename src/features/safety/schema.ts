import { z } from "zod";

export const safetyTemplateFormSchema = z.object({
  type: z
    .string()
    .min(2, "El tipo debe tener al menos 2 caracteres")
    .max(20, "Máximo 20 caracteres"),
  equipmentTypeId: z.string().optional().or(z.literal("")),
  name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(120, "Máximo 120 caracteres"),
  version: z
    .string()
    .max(20, "Máximo 20 caracteres")
    .optional()
    .or(z.literal("")),
  content: z.string().min(1, "El contenido es obligatorio"),
});

export type SafetyTemplateFormValues = z.infer<typeof safetyTemplateFormSchema>;