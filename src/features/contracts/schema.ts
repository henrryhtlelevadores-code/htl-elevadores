import { z } from "zod";

export const contractFormSchema = z.object({
  costCenterId: z.string().min(1, "El centro de costo es obligatorio"),
  status: z.string().optional().or(z.literal("")),
  serviceTypeId: z.string().min(1, "El tipo de servicio es obligatorio"),
  startDate: z.string().min(1, "La fecha de inicio es obligatoria"),
  endDate: z.string().optional().or(z.literal("")),
  autoRenewal: z.boolean(),
  noticePeriodDays: z.coerce.number().int().nonnegative(),
  currency: z.string().min(1, "La moneda es obligatoria"),
  baseAmount: z.coerce.number().nonnegative("El monto no puede ser negativo"),
  includesIgv: z.boolean(),
  paymentTermsDays: z.coerce.number().int().nonnegative(),
  inflationAdjustment: z.boolean(),
  /**
   * Frecuencia del mantenimiento en meses. Solo tiene efecto si el contrato
   * tiene módulos rotativos; la UI la oculta cuando todos son fijos.
   */
  maintenanceFrequencyMonths: z.coerce
    .number({ message: "Ingresa una frecuencia válida" })
    .int("La frecuencia debe ser un número entero")
    .min(1, "Mínimo 1 mes")
    .max(12, "Máximo 12 meses"),
  slaEntrapmentMins: z.coerce.number().int().nonnegative(),
  slaMechanicalFailureMins: z.coerce.number().int().nonnegative(),
});

export type ContractFormValues = z.infer<typeof contractFormSchema>;

export const contractElevatorFormSchema = z.object({
  contractId: z.string().min(1, "El contrato es obligatorio"),
  elevatorUnityId: z.string().min(1, "El equipo es obligatorio"),
  frequencyMonths: z.coerce.number().int().positive().default(1),
  price: z.coerce.number().nonnegative("El precio no puede ser negativo"),
});

export type ContractElevatorFormValues = z.infer<typeof contractElevatorFormSchema>;