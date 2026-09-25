export const IGV_RATE = 0.18;
export const DEFAULT_OVERHEAD_RATE = 0.2;
export const DEFAULT_COMMISSION_RATE = 0.05;
export const DEFAULT_PROFIT_RATE = 0.6;
export const DEFAULT_LABOR_OVERHEAD_RATE = 0.4;

export const round2 = (value: number): number => Math.round(value * 100) / 100;

export const LINE_MODES = [
  { value: "CALCULATED", label: "Calculado" },
  { value: "FIXED_PRICE", label: "Precio fijo" },
  { value: "PASSTHROUGH", label: "Passthrough" },
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
  /** Precio final con IGV digitado por el administrador. Si viene, pisa el cálculo. */
  lineOverridePrice?: number | null;
  overheadRate?: number;
  commissionRate?: number;
  profitRate?: number;
}

export interface QuotationLineCalcResult {
  lineMode: LineMode;
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

/**
 * CALCULATED  → aplica overhead, comisión y utilidad.
 * FIXED_PRICE → el admin pone el precio final directo (lineOverridePrice, con IGV).
 * PASSTHROUGH → costo del proveedor tal cual, sin margen ni gastos.
 */
export function calculateQuotationLine(
  line: QuotationLineCalcInput,
  hourlyCost: number,
  rules: PricingRules = DEFAULT_PRICING_RULES
): QuotationLineCalcResult {
  const lineMode: LineMode = line.lineMode ?? "CALCULATED";
  const override =
    line.lineOverridePrice != null && Number(line.lineOverridePrice) > 0
      ? round2(Number(line.lineOverridePrice))
      : null;

  const overheadRate = line.overheadRate ?? rules.overheadRateQuote;
  const commissionRate = line.commissionRate ?? rules.commissionRate;
  const profitRate = line.profitRate ?? rules.profitRate;
  const igvRate = rules.igvRate;

  const productCost = round2(
    line.products.reduce((sum, p) => sum + (p.quantity ?? 0) * p.unitCost, 0)
  );

  const laborCost = round2((line.totalHours ?? 0) * hourlyCost);

  const subtotal = round2(productCost + laborCost);

  const isPassthrough = lineMode === "PASSTHROUGH";

  const appliedOverheadRate = isPassthrough ? 0 : overheadRate;
  const appliedCommissionRate = isPassthrough ? 0 : commissionRate;
  const appliedProfitRate = isPassthrough ? 0 : profitRate;

  const overheadAmount = round2(subtotal * appliedOverheadRate);
  const totalCost = round2(subtotal + overheadAmount);

  const commissionAmount = override
    ? 0
    : round2(totalCost * appliedCommissionRate);
  const profitAmount = override
    ? 0
    : round2(totalCost * appliedProfitRate);

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
    productCost,
    laborCost,
    subtotal,
    overheadRate: appliedOverheadRate,
    overheadAmount,
    totalCost,
    commissionRate: appliedCommissionRate,
    commissionAmount,
    profitRate: appliedProfitRate,
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
