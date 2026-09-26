export const IGV_RATE = 0.18;
export const DEFAULT_OVERHEAD_RATE = 0.2;
export const DEFAULT_COMMISSION_RATE = 0.05;
export const DEFAULT_PROFIT_RATE = 0.6;
export const DEFAULT_LABOR_OVERHEAD_RATE = 0.4;

export const round2 = (value: number): number => Math.round(value * 100) / 100;

export const LINE_MODES = [
  { value: "CALCULATED", label: "Calculado" },
  { value: "MANUAL_PRICE", label: "Precio manual" },
] as const;

export const DISCOUNT_MODES = [
  { value: "PERCENT", label: "Porcentaje" },
  { value: "AMOUNT", label: "Monto fijo" },
  { value: "FINAL", label: "Precio final" },
] as const;

export type LineMode = (typeof LINE_MODES)[number]["value"];
export type DiscountMode = (typeof DISCOUNT_MODES)[number]["value"];

export interface PricingRules {
  overheadRateLabor: number;
  overheadRateQuote: number;
  commissionRate: number;
  profitRate: number;
  igvRate: number;
  allowPriceOverride: boolean;
  allowCostOverride: boolean;
}

export const DEFAULT_PRICING_RULES: PricingRules = {
  overheadRateLabor: DEFAULT_LABOR_OVERHEAD_RATE,
  overheadRateQuote: DEFAULT_OVERHEAD_RATE,
  commissionRate: DEFAULT_COMMISSION_RATE,
  profitRate: DEFAULT_PROFIT_RATE,
  igvRate: IGV_RATE,
  allowPriceOverride: true,
  allowCostOverride: true,
};

export interface QuotationLineCalcInput {
  totalHours: number;
  hourlyCost: number;
  products: Array<{ quantity: number | null; unitCost: number }>;
  lineMode?: LineMode;
  /** Precio final digitado por el administrador (solo MANUAL_PRICE). */
  manualPrice?: number | null;
  /** Si el precio final manual ya incluye IGV (solo MANUAL_PRICE). */
  manualPriceIncludesIgv?: boolean;
  /** Costo del proveedor (solo MANUAL_PRICE con proveedor). */
  supplierCost?: number | null;
  /** Nombre del proveedor (solo MANUAL_PRICE). */
  supplierName?: string | null;
  /** Override del precio final con IGV sobre una línea CALCULATED. */
  lineOverridePrice?: number | null;
  overheadRate?: number;
  commissionRate?: number;
  profitRate?: number;
}

export interface QuotationLineCalcResult {
  lineMode: LineMode;
  /** MANUAL_PRICE con proveedor: el precio es el del proveedor (pass-through). */
  isPassthrough: boolean;
  manualPrice: number | null;
  manualPriceIncludesIgv: boolean;
  supplierCost: number;
  productCost: number;
  laborCost: number;
  subtotal: number;
  overheadRate: number;
  overheadAmount: number;
  totalCost: number;
  commissionRate: number;
  commissionAmount: number;
  profitRate: number;
  profitAmount: number;
  clientValue: number;
  igv: number;
  clientPrice: number;
  hourlyCostUsed: number;
  hasOverride: boolean;
}

/** Derivación interna: MANUAL_PRICE con proveedor es un pass-through. */
export const isManualPassthrough = (
  lineMode: string | null | undefined,
  supplierName: string | null | undefined,
  supplierCost: number | null | undefined
): boolean =>
  (lineMode ?? "CALCULATED") === "MANUAL_PRICE" &&
  !!supplierName &&
  supplierCost != null &&
  Number(supplierCost) > 0;

/**
 * CALCULATED   → aplica overhead, comisión y utilidad; el override opcional
 *                (lineOverridePrice) pisa el resultado con el precio final.
 * MANUAL_PRICE → el administrador define el precio final; el proveedor es
 *                opcional y solo clasifica la línea como pass-through.
 */
export function calculateQuotationLine(
  line: QuotationLineCalcInput,
  hourlyCost: number,
  rules: PricingRules = DEFAULT_PRICING_RULES
): QuotationLineCalcResult {
  const lineMode: LineMode = line.lineMode ?? "CALCULATED";
  const igvRate = rules.igvRate;

  const manualPrice =
    lineMode === "MANUAL_PRICE" && line.manualPrice != null && Number(line.manualPrice) > 0
      ? round2(Number(line.manualPrice))
      : null;
  const manualPriceIncludesIgv = line.manualPriceIncludesIgv ?? true;
  const supplierCost = round2(Number(line.supplierCost) || 0);
  const isPassthrough = isManualPassthrough(lineMode, line.supplierName, supplierCost);
  const override =
    lineMode === "CALCULATED" && line.lineOverridePrice != null && Number(line.lineOverridePrice) > 0
      ? round2(Number(line.lineOverridePrice))
      : null;

  if (lineMode === "MANUAL_PRICE") {
    const base = manualPrice ?? 0;
    const clientValue = manualPriceIncludesIgv ? round2(base / (1 + igvRate)) : round2(base);
    const igv = round2(clientValue * igvRate);
    return {
      lineMode,
      isPassthrough,
      manualPrice,
      manualPriceIncludesIgv,
      supplierCost,
      productCost: 0,
      laborCost: 0,
      subtotal: 0,
      overheadRate: 0,
      overheadAmount: 0,
      totalCost: 0,
      commissionRate: 0,
      commissionAmount: 0,
      profitRate: 0,
      profitAmount: 0,
      clientValue,
      igv,
      clientPrice: round2(clientValue + igv),
      hourlyCostUsed: 0,
      hasOverride: false,
    };
  }

  const overheadRate = line.overheadRate ?? rules.overheadRateQuote;
  const commissionRate = line.commissionRate ?? rules.commissionRate;
  const profitRate = line.profitRate ?? rules.profitRate;

  const productCost = round2(
    line.products.reduce((sum, p) => sum + (p.quantity ?? 0) * p.unitCost, 0)
  );

  const laborCost = round2((line.totalHours ?? 0) * hourlyCost);

  const subtotal = round2(productCost + laborCost);

  const overheadAmount = round2(subtotal * overheadRate);
  const totalCost = round2(subtotal + overheadAmount);

  const commissionAmount = override
    ? 0
    : round2(totalCost * commissionRate);
  const profitAmount = override
    ? 0
    : round2(totalCost * profitRate);

  let clientValue: number;
  let igv: number;
  let clientPrice: number;

  if (override != null) {
    // El override siempre es el precio final con IGV.
    clientPrice = override;
    clientValue = round2(override / (1 + igvRate));
    igv = round2(override - clientValue);
  } else {
    clientValue = round2(totalCost + commissionAmount + profitAmount);
    igv = round2(clientValue * igvRate);
    clientPrice = round2(clientValue + igv);
  }

  return {
    lineMode,
    isPassthrough: false,
    manualPrice: null,
    manualPriceIncludesIgv: true,
    supplierCost: 0,
    productCost,
    laborCost,
    subtotal,
    overheadRate,
    overheadAmount,
    totalCost,
    commissionRate,
    commissionAmount,
    profitRate,
    profitAmount,
    clientValue,
    igv,
    clientPrice,
    hourlyCostUsed: round2(hourlyCost),
    hasOverride: override != null,
  };
}

export interface QuotationHeaderCalcInput {
  discountMode?: DiscountMode;
  /** Porcentaje 0-100 (solo PERCENT). */
  discountRate?: number;
  /** Monto fijo del descuento (solo AMOUNT). */
  discountAmount?: number;
  /** Precio final objetivo (solo FINAL). */
  targetTotal?: number | null;
  /** Si el precio final objetivo ya incluye IGV (solo FINAL). */
  targetTotalIncludesIgv?: boolean;
  igvRate?: number;
}

export interface QuotationHeaderCalcResult {
  discountMode: DiscountMode;
  subtotal: number;
  /** Descuento efectivo en % (se deriva también de AMOUNT y FINAL). */
  discountRate: number;
  discountAmount: number;
  taxableBase: number;
  igv: number;
  total: number;
}

export function calculateQuotationHeader(
  lines: Array<{ clientValue: number }>,
  input: QuotationHeaderCalcInput | number = {},
  rules: PricingRules = DEFAULT_PRICING_RULES
): QuotationHeaderCalcResult {
  const options: QuotationHeaderCalcInput =
    typeof input === "number" ? { discountRate: input } : input;

  const discountMode: DiscountMode = options.discountMode ?? "PERCENT";
  const igvRate = options.igvRate ?? rules.igvRate;

  const subtotal = round2(lines.reduce((sum, l) => sum + l.clientValue, 0));

  let taxableBase: number;

  if (discountMode === "FINAL" && options.targetTotal != null) {
    const target = round2(Number(options.targetTotal));
    taxableBase = options.targetTotalIncludesIgv
      ? round2(target / (1 + igvRate))
      : target;
  } else {
    const rate = Math.max(0, Number(options.discountRate) || 0) / 100;
    const amount =
      discountMode === "AMOUNT"
        ? Math.max(0, Number(options.discountAmount) || 0)
        : round2(subtotal * rate);
    taxableBase = round2(subtotal - amount);
  }

  const igv = round2(taxableBase * igvRate);
  const total = round2(taxableBase + igv);
  const discountAmount = round2(subtotal - taxableBase);

  return {
    discountMode,
    subtotal,
    discountRate: subtotal > 0 ? round2((discountAmount / subtotal) * 100) : 0,
    discountAmount,
    taxableBase,
    igv,
    total,
  };
}
