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
  lineMode: z.enum(["CALCULATED", "FIXED_PRICE", "PASSTHROUGH"]).default("CALCULATED"),
  lineModeReason: z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
  lineOverridePrice: nonNegativeNumber("El precio final"),
  lineOverrideReason: z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
  products: z.array(quotationProductSchema),
});

export const quotationFormSchema = z
  .object({
    clientId: z.string().min(1, "El cliente es obligatorio"),
    costCenterId: z.string().optional().or(z.literal("")),
    advisorId: z.string().optional().or(z.literal("")),
    issueDate: z.string().min(1, "La fecha de emisión es obligatoria"),
    validUntil: z.string().min(1, "La fecha de validez es obligatoria"),
    status: z.string().optional().or(z.literal("")),
    discountMode: z.enum(["PERCENT", "AMOUNT", "FINAL"]).default("PERCENT"),
    discountRate: nonNegativeNumber("El descuento"),
    discountAmount: nonNegativeNumber("El monto del descuento"),
    targetTotal: nonNegativeNumber("El precio final"),
    targetTotalIncludesIgv: z.boolean().default(true),
    notes: z.string().optional().or(z.literal("")),
    terms: z.string().optional().or(z.literal("")),
    lines: z.array(quotationLineSchema).min(1, "Agrega al menos un equipo o servicio"),
  })
  .superRefine((data, ctx) => {
    if (data.discountMode === "FINAL" && !(Number(data.targetTotal) > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetTotal"],
        message: "El precio final es obligatorio",
      });
    }

    data.lines.forEach((line, index) => {
      if (line.lineMode === "FIXED_PRICE" && !(Number(line.lineOverridePrice) > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lines", index, "lineOverridePrice"],
          message: "Ingresa el precio final de la línea",
        });
      }
      if (line.lineMode === "PASSTHROUGH" && !line.lineModeReason?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lines", index, "lineModeReason"],
          message: "Indica el motivo (ej: Proveedor externo)",
        });
      }
    });
  });

export type QuotationFormValues = z.infer<typeof quotationFormSchema>;

export const QUOTATION_STATUS = [
  { value: "DRAFT", label: "Borrador" },
  { value: "SENT", label: "Enviada" },
  { value: "ACCEPTED", label: "Aceptada" },
  { value: "REJECTED", label: "Rechazada" },
] as const;