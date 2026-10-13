import type { ProviderType } from "./provider-type";

/**
 * Relación del personal de campo con HTL.
 *
 * - INTERNAL_EMPLOYEE: trabajador de HTL en planilla.
 * - COLLABORATOR: persona fuera de planilla que actúa a nombre de HTL.
 * - SUBCONTRACTED_COMPANY: empresa proveedora. Usa UNA sola cuenta para todos
 *   sus trabajadores: la cuenta representa a la empresa, no a una persona.
 * - EXTERNAL_PROFESSIONAL: profesional independiente (recibo por honorarios).
 */
export const STAFF_RELATIONSHIPS = [
  { value: "INTERNAL_EMPLOYEE", label: "Trabajador HTL (planilla)" },
  { value: "COLLABORATOR", label: "Colaborador (a nombre de HTL)" },
  { value: "SUBCONTRACTED_COMPANY", label: "Empresa proveedora (cuenta única)" },
  { value: "EXTERNAL_PROFESSIONAL", label: "Profesional externo" },
] as const;

export type StaffRelationship = (typeof STAFF_RELATIONSHIPS)[number]["value"];

export const STAFF_RELATIONSHIP_VALUES = STAFF_RELATIONSHIPS.map((r) => r.value) as [
  StaffRelationship,
  ...StaffRelationship[],
];

/** Perfiles anteriores al campo: EXTERNAL era una empresa proveedora, el resto planilla. */
export function normalizeStaffRelationship(
  value: string | null | undefined,
  legacyProviderType?: string | null
): StaffRelationship {
  const known = STAFF_RELATIONSHIPS.find((r) => r.value === value);
  if (known) return known.value;
  return legacyProviderType === "EXTERNAL" ? "SUBCONTRACTED_COMPANY" : "INTERNAL_EMPLOYEE";
}

export const staffRelationshipLabel = (value: string | null | undefined): string =>
  STAFF_RELATIONSHIPS.find((r) => r.value === value)?.label ?? STAFF_RELATIONSHIPS[0].label;

/** Quien trabaja a nombre de HTL (planilla o colaborador) cuenta como personal propio. */
export const representsHtl = (value: StaffRelationship): boolean =>
  value === "INTERNAL_EMPLOYEE" || value === "COLLABORATOR";

/** La empresa proveedora es obligatoria solo para la cuenta de empresa. */
export const requiresSupplier = (value: StaffRelationship): boolean =>
  value === "SUBCONTRACTED_COMPANY";

/** El profesional externo puede, opcionalmente, venir de un proveedor registrado. */
export const allowsSupplier = (value: StaffRelationship): boolean => !representsHtl(value);

/** `provider_type` se conserva derivado: de él salen los badges [HTL] / [EXT]. */
export const relationshipProviderType = (value: StaffRelationship): ProviderType =>
  representsHtl(value) ? "INTERNAL" : "EXTERNAL";
