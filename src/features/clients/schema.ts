import { z } from "zod";

export const clientFormSchema = z
  .object({
    legalName: z
      .string()
      .min(2, "La razón social debe tener al menos 2 caracteres")
      .max(150, "Máximo 150 caracteres"),
    commercialName: z
      .string()
      .max(150, "Máximo 150 caracteres")
      .optional()
      .or(z.literal("")),
    taxIdType: z.enum(["RUC", "DNI", "CE", "SIN_DOC"]).default("RUC"),
    taxId: z
      .string()
      .max(20, "Máximo 20 caracteres")
      .optional()
      .or(z.literal("")),
    isProcessingRuc: z.boolean().default(false),
    billingAddress: z
      .string()
      .max(250, "Máximo 250 caracteres")
      .optional()
      .or(z.literal("")),
    billingEmail: z
      .string()
      .email("Correo no válido")
      .max(150, "Máximo 150 caracteres")
      .optional()
      .or(z.literal("")),
    createDefaultHeadquarters: z.boolean().default(true),
    headquartersAddress: z
      .string()
      .max(250, "Máximo 250 caracteres")
      .optional()
      .or(z.literal("")),
    district: z
      .string()
      .max(120, "Máximo 120 caracteres")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.taxIdType !== "SIN_DOC" && !data.taxId?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["taxId"],
        message: "El documento es obligatorio para el tipo seleccionado",
      });
    }
  });

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export const costCenterFormSchema = z.object({
  clientId: z.string().min(1, "El cliente asociado es obligatorio"),
  name: z
    .string()
    .min(2, "El nombre de la sede debe tener al menos 2 caracteres")
    .max(150, "Máximo 150 caracteres"),
  address: z
    .string()
    .min(2, "La dirección es obligatoria")
    .max(250, "Máximo 250 caracteres"),
  ubigeoId: z
    .string()
    .optional()
    .or(z.literal("")),
});

export type CostCenterFormValues = z.infer<typeof costCenterFormSchema>;

export const contactFormSchema = z.object({
  costCenterId: z.string().min(1, "El centro de costo es obligatorio"),
  fullName: z
    .string()
    .min(2, "El nombre completo debe tener al menos 2 caracteres")
    .max(150, "Máximo 150 caracteres"),
  role: z
    .string()
    .max(100, "Máximo 100 caracteres")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(30, "Máximo 30 caracteres")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("Correo no válido")
    .max(150, "Máximo 150 caracteres")
    .optional()
    .or(z.literal("")),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;