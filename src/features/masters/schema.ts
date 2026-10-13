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
  serviceScope: z.enum(["ELEVATOR", "GENERAL"]),
  showInQuotations: z.boolean(),
  price: z
    .string()
    .trim()
    .refine((v) => v === "" || parseServicePrice(v) !== null, {
      message: "Ingresa un precio mayor a 0 o déjalo vacío",
    }),
});

/** Línea de negocio de un tipo de servicio. */
export const SERVICE_SCOPES = [
  { value: "ELEVATOR", label: "Ascensores" },
  { value: "GENERAL", label: "Servicios Generales" },
] as const;

export type ServiceScope = (typeof SERVICE_SCOPES)[number]["value"];

/** Todo tipo de servicio sin alcance explícito es de ascensores. */
export const normalizeServiceScope = (value: string | null | undefined): ServiceScope =>
  value === "GENERAL" ? "GENERAL" : "ELEVATOR";

/**
 * Convierte el precio de un tipo de servicio (columna TEXT) a número. Acepta coma
 * decimal. Devuelve null si está vacío o no es un monto mayor a 0.
 */
export function parseServicePrice(value: string | null | undefined): number | null {
  const raw = (value ?? "").trim().replace(",", ".");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type ServiceTypeFormValues = z.infer<typeof serviceTypeFormSchema>;

export const supplierFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "La razón social debe tener al menos 2 caracteres")
    .max(150, "Máximo 150 caracteres"),
  taxId: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{11}$/.test(v), { message: "El RUC debe tener 11 dígitos" }),
  contactName: z.string().trim().max(120, "Máximo 120 caracteres"),
  phone: z.string().trim().max(20, "Máximo 20 caracteres"),
  email: z.string().trim().max(160).email("Correo inválido").or(z.literal("")),
  isActive: z.boolean(),
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;

export const ubigeoFormSchema = z.object({
  id: z
    .string()
    .min(2, "El código del ubigeo debe tener al menos 2 caracteres")
    .max(20, "Máximo 20 caracteres"),
  departamento: z.string().min(1, "El departamento es obligatorio"),
  provincia: z.string().min(1, "La provincia es obligatoria"),
  distrito: z.string().min(1, "El distrito es obligatorio"),
  latitud: z.union([z.literal(""), z.coerce.number()]).optional(),
  longitud: z.union([z.literal(""), z.coerce.number()]).optional(),
});

export type UbigeoFormValues = z.infer<typeof ubigeoFormSchema>;

export const maintenanceZoneFormSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(2).max(100),
  orderIndex: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean(),
  elevatorTypeId: z.string().min(1, "Selecciona el tipo de equipo"),
});

export type MaintenanceZoneFormValues = z.infer<typeof maintenanceZoneFormSchema>;

export const ubigeoBulkItemSchema = z.object({
  Ubigeo: z.string().min(1, "El código de ubigeo es obligatorio"),
  Departamento: z.string().min(1, "El departamento es obligatorio"),
  Provincia: z.string().min(1, "La provincia es obligatoria"),
  Distrito: z.string().min(1, "El distrito es obligatorio"),
  Latitud: z.coerce.number().optional(),
  Longitud: z.coerce.number().optional(),
});

export const ubigeoBulkImportSchema = z.array(ubigeoBulkItemSchema).min(1);

export type UbigeoBulkImportValues = z.infer<typeof ubigeoBulkImportSchema>;
