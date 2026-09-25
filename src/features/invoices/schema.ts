import { z } from "zod";

const positiveNumber = (label: string) =>
  z.string().refine((v) => v !== "" && Number(v) > 0, {
    message: `${label} debe ser mayor a 0`,
  });

export const invoiceItemFormSchema = z.object({
  description: z
    .string()
    .min(2, "La descripción es obligatoria")
    .max(300, "Máximo 300 caracteres"),
  serviceTypeId: z.string().optional().or(z.literal("")),
  quantity: positiveNumber("La cantidad"),
  unitPrice: positiveNumber("El precio"),
});

export type InvoiceItemFormValues = z.infer<typeof invoiceItemFormSchema>;

export const PAYER_TYPES = [
  { value: "COST_CENTER", label: "Centro de costos" },
  { value: "THIRD_PARTY", label: "Tercero" },
] as const;

export const PAYER_TAX_ID_TYPES = [
  { value: "DNI", label: "DNI" },
  { value: "RUC", label: "RUC" },
  { value: "CE", label: "Carnet de Extranjería" },
  { value: "SIN_DOC", label: "Sin Documento" },
] as const;

export const PAYER_RELATIONSHIPS = [
  { value: "RESIDENTE", label: "Residente" },
  { value: "PROPIETARIO", label: "Propietario" },
  { value: "INQUILINO", label: "Inquilino" },
  { value: "EMPRESA", label: "Empresa" },
  { value: "OTRO", label: "Otro" },
] as const;

const optionalText = (max: number, message: string) =>
  z.string().max(max, message).optional().or(z.literal(""));

const clean = (value?: string) => value?.trim() || null;

export const invoiceFormSchema = z
  .object({
    documentType: z.string().min(1, "El tipo de comprobante es obligatorio"),
    series: z.string().optional().or(z.literal("")),
    number: z.string().optional().or(z.literal("")),
    clientId: z.string().min(1, "El cliente es obligatorio"),
    costCenterId: z.string().optional().or(z.literal("")),
    contractId: z.string().optional().or(z.literal("")),
    issueDate: z.string().optional().or(z.literal("")),
    currency: z.string().min(1, "La moneda es obligatoria").default("PEN"),
    payerType: z.enum(["COST_CENTER", "THIRD_PARTY"]).default("COST_CENTER"),
    payerTaxIdType: z.enum(["DNI", "RUC", "CE", "SIN_DOC"]).optional().or(z.literal("")),
    payerTaxId: optionalText(20, "Máximo 20 caracteres"),
    payerName: optionalText(150, "Máximo 150 caracteres"),
    payerCommercialName: optionalText(150, "Máximo 150 caracteres"),
    payerPhone: optionalText(30, "Máximo 30 caracteres"),
    payerEmail: z
      .string()
      .max(150, "Máximo 150 caracteres")
      .email("Correo no válido")
      .optional()
      .or(z.literal("")),
    payerRelationship: z
      .enum(["RESIDENTE", "PROPIETARIO", "INQUILINO", "EMPRESA", "OTRO"])
      .optional()
      .or(z.literal("")),
    payerNotes: optionalText(500, "Máximo 500 caracteres"),
    items: z
      .array(invoiceItemFormSchema)
      .min(1, "Agrega al menos un concepto a la factura"),
  })
  .superRefine((data, ctx) => {
    if (data.payerType !== "THIRD_PARTY") return;

    if (!data.payerName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payerName"],
        message: "El nombre del pagador es obligatorio",
      });
    }

    const taxIdType = data.payerTaxIdType;
    const taxId = data.payerTaxId?.trim() ?? "";

    if (taxIdType === "DNI" || taxIdType === "RUC") {
      if (!taxId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["payerTaxId"],
          message: "El documento del pagador es obligatorio",
        });
      } else if (taxIdType === "DNI" && !/^\d{8}$/.test(taxId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["payerTaxId"],
          message: "DNI inválido: debe tener 8 dígitos",
        });
      } else if (taxIdType === "RUC" && !/^\d{11}$/.test(taxId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["payerTaxId"],
          message: "RUC inválido: debe tener 11 dígitos",
        });
      }
    }
  });

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export type PayerColumns = {
  payerType: "COST_CENTER" | "THIRD_PARTY";
  payerTaxIdType: string | null;
  payerTaxId: string | null;
  payerName: string | null;
  payerCommercialName: string | null;
  payerPhone: string | null;
  payerEmail: string | null;
  payerRelationship: string | null;
  payerNotes: string | null;
};

/**
 * Regla de oro: el comprobante fiscal siempre sale con los datos del centro de costos
 * (client_*_snapshot no se tocan). El pagador solo describe quién.cancela el importe,
 * por eso cuando es COST_CENTER todos sus campos se limpian.
 */
export function buildPayerColumns(values: InvoiceFormValues): PayerColumns {
  if (values.payerType !== "THIRD_PARTY") {
    return {
      payerType: "COST_CENTER",
      payerTaxIdType: null,
      payerTaxId: null,
      payerName: null,
      payerCommercialName: null,
      payerPhone: null,
      payerEmail: null,
      payerRelationship: null,
      payerNotes: null,
    };
  }

  return {
    payerType: "THIRD_PARTY",
    payerTaxIdType: values.payerTaxIdType || null,
    payerTaxId: clean(values.payerTaxId),
    payerName: clean(values.payerName),
    payerCommercialName: clean(values.payerCommercialName),
    payerPhone: clean(values.payerPhone),
    payerEmail: clean(values.payerEmail),
    payerRelationship: values.payerRelationship || null,
    payerNotes: clean(values.payerNotes),
  };
}

export const PAYER_RELATIONSHIP_LABELS: Record<string, string> = Object.fromEntries(
  PAYER_RELATIONSHIPS.map((r) => [r.value, r.label])
);

export const PAYER_TAX_ID_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PAYER_TAX_ID_TYPES.map((t) => [t.value, t.label])
);

export const DOCUMENT_TYPES = [
  { value: "FACTURA", label: "Factura" },
  { value: "BOLETA", label: "Boleta" },
  { value: "NOTA_VENTA_INTERNA", label: "Nota de Venta Interna" },
] as const;

export const CURRENCIES = [
  { value: "PEN", label: "Soles (PEN)" },
  { value: "USD", label: "Dólares (USD)" },
] as const;
