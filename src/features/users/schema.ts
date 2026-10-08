import { z } from "zod";

export const userStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const documentTypeSchema = z.enum(["DNI", "CE", "RUC", "PASSPORT"]);

export const providerTypeSchema = z.enum(["INTERNAL", "EXTERNAL"]);

const optionalString = (max: number) =>
  z.string().max(max).optional().or(z.literal(""));

const baseUserFields = {
  fullName: z
    .string()
    .min(2, "El nombre completo debe tener al menos 2 caracteres")
    .max(150, "Máximo 150 caracteres"),
  email: z.string().email("Correo electrónico inválido").max(160),
  phone: z.string().max(20).optional().or(z.literal("")),
  roleId: z.string().min(1, "Debes seleccionar un rol"),
  status: userStatusSchema,
  documentType: documentTypeSchema,
  documentNumber: z
    .string()
    .min(6, "El documento debe tener al menos 6 caracteres")
    .max(15, "Máximo 15 caracteres"),
  specialization: z.string().max(100).optional().or(z.literal("")),
  licenseNumber: z.string().max(50).optional().or(z.literal("")),
  // Perfil de técnico (solo aplica si el rol tiene is_field_role).
  providerType: providerTypeSchema,
  providerCompany: optionalString(120),
  hasSctr: z.boolean(),
  // Fecha de vencimiento del SCTR en ISO (YYYY-MM-DD) desde el DatePicker.
  sctrExpiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de vencimiento inválida")
    .optional()
    .or(z.literal("")),
  // Sueldo base (HTL) o tarifa de referencia (proveedor externo).
  baseSalary: z
    .string()
    .max(12)
    .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), {
      message: "Monto inválido (máximo 2 decimales)",
    })
    .optional(),
  signatureUrl: z.string().max(500).optional().or(z.literal("")),
};

const passwordField = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres")
  .max(100, "Máximo 100 caracteres");

export const userFormSchema = z.object({
  ...baseUserFields,
  password: z
    .string()
    .max(100, "Máximo 100 caracteres")
    .refine((v) => v.length === 0 || v.length >= 10, {
      message: "La contraseña debe tener al menos 10 caracteres",
    }),
});

export type UserFormValues = z.infer<typeof userFormSchema>;

export const createUserFormSchema = z.object({
  ...baseUserFields,
  status: userStatusSchema.default("ACTIVE"),
  documentType: documentTypeSchema.default("DNI"),
  password: passwordField,
});

export type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

export const updateUserFormSchema = z.object({
  ...baseUserFields,
  status: userStatusSchema.default("ACTIVE"),
  documentType: documentTypeSchema.default("DNI"),
  password: passwordField.optional().or(z.literal("")),
});

export type UpdateUserFormValues = z.infer<typeof updateUserFormSchema>;

export const changeUserPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type ChangeUserPasswordValues = z.infer<typeof changeUserPasswordSchema>;