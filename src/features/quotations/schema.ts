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

/**
 * La UI deja una fila de material vacía en cada línea y, en modo MANUAL_PRICE, esa
 * fila no se puede llenar ni borrar porque el editor no se renderiza. Como el schema
 * es estricto, esa fila vacía bloqueaba el paso a la siguiente etapa en silencio.
 * Se filtran antes de validar. Una fila con descripción pero sin costo NO se
 * descarta: así el usuario sigue viendo el error real.
 */
export const isBlankProduct = (row: { description?: unknown; unitCost?: unknown }): boolean =>
  String(row?.description ?? "").trim() === "" && !(Number(row?.unitCost) > 0);

/** Devuelve las líneas sin las filas de material vacías. */
export function stripBlankProducts<T extends { products?: unknown[] }>(lines: T[]): T[] {
  return lines.map((line) => {
    const products = Array.isArray(line.products) ? line.products : [];
    const kept = products.filter((row) => !isBlankProduct(row as { description?: unknown }));
    return kept.length === products.length ? line : { ...line, products: kept };
  });
}

const quotationLineSchema = z.object({
  elevatorUnityId: z.string().optional().or(z.literal("")),
  description: z
    .string()
    .min(2, "La descripción es obligatoria")
    .max(300, "Máximo 300 caracteres"),
  totalHours: nonNegativeNumber("Las horas"),
  hourlyCost: nonNegativeNumber("El costo/hora"),
  lineMode: z.enum(["CALCULATED", "MANUAL_PRICE"]).default("CALCULATED"),
  lineModeReason: z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
  manualPrice: nonNegativeNumber("El precio final"),
  manualPriceIncludesIgv: z.boolean().default(true),
  supplierName: z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
  supplierCost: nonNegativeNumber("El costo del proveedor"),
  overridePrice: z.boolean().default(false),
  lineOverridePrice: nonNegativeNumber("El precio final"),
  lineOverrideReason: z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
  products: z.array(quotationProductSchema),
});

const hasMeaningfulProducts = (line: { products: z.infer<typeof quotationProductSchema>[] }) =>
  line.products.some((p) => p.description.trim() !== "" && Number(p.unitCost) > 0);

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
    if (data.discountMode === "PERCENT" && Number(data.discountRate) > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountRate"],
        message: "El descuento debe estar entre 0% y 100%",
      });
    }

    data.lines.forEach((line, index) => {
      const linePath = (field: string) => ["lines", index, field];

      if (line.lineMode === "MANUAL_PRICE") {
        if (!(Number(line.manualPrice) > 0)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: linePath("manualPrice"),
            message: "Ingresa el precio final de la línea",
          });
        }
        if (!line.lineModeReason?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: linePath("lineModeReason"),
            message: "Indica el motivo del precio manual",
          });
        }
        const hasSupplierName = !!line.supplierName?.trim();
        const hasSupplierCost = Number(line.supplierCost) > 0;
        if (hasSupplierName && !hasSupplierCost) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: linePath("supplierCost"),
            message: "Ingresa el costo del proveedor",
          });
        }
        if (hasSupplierCost && !hasSupplierName) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: linePath("supplierName"),
            message: "Indica el nombre del proveedor",
          });
        }
        return;
      }

      if (!(Number(line.totalHours) > 0) && !hasMeaningfulProducts(line)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: linePath("totalHours"),
          message: "La línea no tiene horas ni materiales",
        });
      }

      if (line.overridePrice && !(Number(line.lineOverridePrice) > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: linePath("lineOverridePrice"),
          message: "Ingresa el precio final de la línea",
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

export const DEFAULT_QUOTATION_TERMS = [
  "1. Incluye servicio de instalación y configuración en caso se requiera.",
  "2. Validez de la garantía por 12 meses únicamente si el cliente realiza los mantenimientos preventivos mensualmente con HTL Elevadores.",
  "3. Forma de Pago: Contado",
  "4. Validez de la Oferta: 15 días",
  "5. Garantía por falla de fábrica (aplica en repuesto): 12 meses",
].join("\n");
