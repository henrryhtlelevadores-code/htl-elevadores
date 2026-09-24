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

export const invoiceFormSchema = z.object({
  documentType: z.string().min(1, "El tipo de comprobante es obligatorio"),
  series: z.string().optional().or(z.literal("")),
  number: z.string().optional().or(z.literal("")),
  clientId: z.string().min(1, "El cliente es obligatorio"),
  costCenterId: z.string().optional().or(z.literal("")),
  contractId: z.string().optional().or(z.literal("")),
  issueDate: z.string().optional().or(z.literal("")),
  currency: z.string().min(1, "La moneda es obligatoria").default("PEN"),
  items: z
    .array(invoiceItemFormSchema)
    .min(1, "Agrega al menos un concepto a la factura"),
});

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export const DOCUMENT_TYPES = [
  { value: "FACTURA", label: "Factura" },
  { value: "BOLETA", label: "Boleta" },
  { value: "NOTA_VENTA_INTERNA", label: "Nota de Venta Interna" },
] as const;

export const CURRENCIES = [
  { value: "PEN", label: "Soles (PEN)" },
  { value: "USD", label: "Dólares (USD)" },
] as const;