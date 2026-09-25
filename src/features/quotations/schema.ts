import { z } from "zod";

const positiveNumber = (label: string) =>
  z.string().refine((v) => v !== "" && Number(v) > 0, {
    message: `${label} debe ser mayor a 0`,
  });

const nonNegativeNumber = (label: string) =>
  z.string().refine((v) => v === "" || Number(v) >= 0, {
    message: `${label} no puede ser negativo`,
  });

const quotationProductSchema = z.object({
  description: z
    .string()
    .min(2, "La descripción es obligatoria")
    .max(300, "Máximo 300 caracteres"),
  quantity: positiveNumber("La cantidad"),
  unit: z.string().optional().or(z.literal("")),
  unitCost: positiveNumber("El costo unitario"),
});

const quotationLineSchema = z.object({
  elevatorUnityId: z.string().optional().or(z.literal("")),
  description: z
    .string()
    .min(2, "La descripción es obligatoria")
    .max(300, "Máximo 300 caracteres"),
  totalHours: z.string().refine((v) => v !== "" && Number(v) > 0, {
    message: "Las horas deben ser mayores a 0",
  }),
  hourlyCost: nonNegativeNumber("El costo/hora"),
  products: z.array(quotationProductSchema),
});

export const quotationFormSchema = z.object({
  clientId: z.string().min(1, "El cliente es obligatorio"),
  costCenterId: z.string().optional().or(z.literal("")),
  advisorId: z.string().optional().or(z.literal("")),
  issueDate: z.string().min(1, "La fecha de emisión es obligatoria"),
  validUntil: z.string().min(1, "La fecha de validez es obligatoria"),
  status: z.string().optional().or(z.literal("")),
  discountRate: nonNegativeNumber("El descuento"),
  notes: z.string().optional().or(z.literal("")),
  terms: z.string().optional().or(z.literal("")),
  lines: z.array(quotationLineSchema).min(1, "Agrega al menos un equipo o servicio"),
});

export type QuotationFormValues = z.infer<typeof quotationFormSchema>;

export const QUOTATION_STATUS = [
  { value: "DRAFT", label: "Borrador" },
  { value: "SENT", label: "Enviada" },
  { value: "ACCEPTED", label: "Aceptada" },
  { value: "REJECTED", label: "Rechazada" },
] as const;