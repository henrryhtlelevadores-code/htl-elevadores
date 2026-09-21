import { z } from "zod";

export const brandFormSchema = z.object({
  name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  country: z
    .string()
    .max(100, "Máximo 100 caracteres")
    .optional()
    .or(z.literal("")),
});

export type BrandFormValues = z.infer<typeof brandFormSchema>;

export const elevatorTypeFormSchema = z.object({
  name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres"),
});

export type ElevatorTypeFormValues = z.infer<typeof elevatorTypeFormSchema>;

export const modelFormSchema = z.object({
  brandId: z.string().min(1, "Debes seleccionar una marca existente"),
  name: z
    .string()
    .min(2, "El nombre del modelo debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  techSpecs: z
    .string()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
});

export type ModelFormValues = z.infer<typeof modelFormSchema>;

export const serviceTypeFormSchema = z.object({
  code: z
    .string()
    .min(2, "El código debe tener al menos 2 caracteres")
    .max(20, "Máximo 20 caracteres"),
  name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  category: z.string().min(1, "La categoría es obligatoria"),
  requiresContract: z.boolean(),
  defaultSlaMins: z.union([z.literal(""), z.coerce.number().int().nonnegative()]),
  isBillableByDefault: z.boolean(),
});

export type ServiceTypeFormValues = z.infer<typeof serviceTypeFormSchema>;