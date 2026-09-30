import { z } from "zod";

const monthsOfYearSchema = z
  .array(z.number().int().min(1).max(12))
  .min(1, "Selecciona al menos un mes")
  .transform((months) => [...new Set(months)].sort((a, b) => a - b));

const maintenanceModuleBaseSchema = z.object({
  code: z
    .string()
    .min(1, "El código es obligatorio")
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Solo letras, números, guion y guion bajo"),
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
  description: z.string().max(500).optional().or(z.literal("")),
  monthsOfYear: monthsOfYearSchema,
  elevatorTypeId: z.string().min(1, "Selecciona el tipo de equipo"),
  isActive: z.boolean(),
});

export const maintenanceModuleFormSchema = maintenanceModuleBaseSchema;

/** Versión parcial para las actualizaciones puntuales. */
export const maintenanceModulePatchSchema = maintenanceModuleBaseSchema.partial();
export type MaintenanceModulePatchValues = z.infer<
  typeof maintenanceModulePatchSchema
>;

export type MaintenanceModuleFormValues = z.infer<
  typeof maintenanceModuleFormSchema
>;

export const maintenanceTaskFormSchema = z.object({
  zoneId: z.string().min(1, "Selecciona una zona válida"),
  description: z
    .string()
    .min(10, "La descripción debe tener al menos 10 caracteres")
    .max(300),
  isCritical: z.boolean(),
  requiresPhoto: z.boolean(),
});

export type MaintenanceTaskFormValues = z.infer<typeof maintenanceTaskFormSchema>;

/**
 * Acepta 0 / 1, "0" / "1" y booleanos true / false para tolerar
 * pegados desde Excel o desde un JSON generado por otra herramienta.
 */
const flagSchema = z
  .union([z.boolean(), z.literal(0), z.literal(1), z.literal("0"), z.literal("1")])
  .optional()
  .transform((value) => value === true || value === 1 || value === "1");

export const maintenanceTaskBatchItemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(10, "La descripción debe tener al menos 10 caracteres")
    .max(500, "La descripción no puede superar 500 caracteres"),
  isCritical: flagSchema,
  requiresPhoto: flagSchema,
});

export const maintenanceTaskBatchSchema = z.object({
  zoneId: z.string().min(1, "Selecciona una zona válida"),
  tasks: z
    .array(maintenanceTaskBatchItemSchema)
    .min(1, "Agrega al menos una tarea")
    .max(200, "Máximo 200 tareas por lote"),
});

export type MaintenanceTaskBatchItem = z.infer<
  typeof maintenanceTaskBatchItemSchema
>;
export type MaintenanceTaskBatchValues = z.infer<
  typeof maintenanceTaskBatchSchema
>;
