import type { ContractDetail } from "./actions";
import type { ContractTemplateData } from "./components/preventive-contract-pdf";

export const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
];

export interface TemplateExtras {
  signerName: string;
  signerDocument: string;
  signatureDate: number;
  customClauses: Record<string, string>;
}

function resolveAssetUrl(...candidates: Array<string | undefined>): string {
  return candidates.find((c) => c && c.length > 0) ?? "";
}

const R2_PUBLIC_URL =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ??
  process.env.R2_PUBLIC_URL ??
  "https://pub-b6dfb30684ac4d50821d7f2a4ceace89.r2.dev";

export function buildContractTemplateData(
  contract: ContractDetail,
  extras: TemplateExtras
): ContractTemplateData {
  const sigDate = new Date(extras.signatureDate * 1000);
  const elevatorsCount = contract.elevators?.length ?? 0;
  const firstElevator = contract.elevators?.[0];
  const overrides = (contract.documentOverrides ?? {}) as Record<string, unknown>;
  const variables = (overrides.variables ?? {}) as Record<string, string>;

  const durationYears =
    (contract.endDate ?? 0) - contract.startDate > 1.5 * 365.25 * 86400
      ? 2
      : 1;

  return {
    costCenterName: contract.cost_center_name ?? "",
    costCenterAddress: contract.cost_center_address ?? "",
    costCenterDistrict: contract.cost_center_district ?? "",
    clientSignerName: extras.signerName || "_______________________",
    clientSignerDocument: extras.signerDocument || "___________",
    elevatorsCount,
    elevators: (contract.elevators ?? []).map((elevator) => ({
      brand: elevator.brand_name ?? "",
      internalCode: elevator.internal_code ?? "",
    })),
    elevatorsBrand: firstElevator?.brand_name ?? variables.elevators_brand ?? "",
    elevatorsInternalCode:
      firstElevator?.internal_code ?? variables.elevators_code ?? "",
    elevatorsFeatures: variables.elevators_features ?? `${elevatorsCount} ascensor(es)`,
    baseAmount: contract.baseAmount?.toFixed(2) ?? "0.00",
    baseAmountText: variables.base_amount_text ?? `${contract.baseAmount?.toFixed(2) ?? "0.00"}`,
    currency: contract.currency === "PEN" ? "Soles" : "Dólares",
    includesIgvText: contract.includesIgv ? "incluido el 18% de IGV" : "sin IGV",
    paymentTermDays: contract.paymentTermsDays ?? 5,
    currentDay: String(sigDate.getDate()),
    currentMonth: MONTHS_ES[sigDate.getMonth()] ?? MONTHS_ES[0],
    currentYear: String(sigDate.getFullYear()),
    contractDurationYears: durationYears,
    htlFooterUrl: resolveAssetUrl(
      process.env.NEXT_PUBLIC_R2_FOOTER_URL,
      process.env.R2_FOOTER_URL
    ),
    htlLogoUrl: resolveAssetUrl(
      process.env.NEXT_PUBLIC_R2_LOGO_URL,
      process.env.R2_LOGO_URL,
      `${R2_PUBLIC_URL}/empresa/logohtlrojo.png`
    ),
    htlSignatureUrl: resolveAssetUrl(
      process.env.NEXT_PUBLIC_R2_FIRM_URL,
      process.env.R2_FIRM_URL,
      `${R2_PUBLIC_URL}/empresa/firma.PNG`
    ),
    customClauses:
      Object.keys(extras.customClauses).length > 0 ? extras.customClauses : undefined,
  };
}

export function buildOverridesSnapshot(
  template: ContractTemplateData,
  customClauses: Record<string, string>
): Record<string, unknown> {
  return {
    variables: {
      cost_center_name: template.costCenterName,
      cost_center_address: template.costCenterAddress,
      base_amount_text: template.baseAmountText,
      base_amount: template.baseAmount,
      equipment_qty: template.elevatorsCount,
      elevators_brand: template.elevatorsBrand,
      elevators_code: template.elevatorsInternalCode,
      elevators_features: template.elevatorsFeatures,
      equipment_list: template.elevators,
    },
    custom_clauses: customClauses,
  };
}