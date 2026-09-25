export const IGV_RATE = 0.18;
export const DEFAULT_OVERHEAD_RATE = 0.2;
export const DEFAULT_COMMISSION_RATE = 0.04;
export const DEFAULT_PROFIT_RATE = 0.6;

export const round2 = (value: number): number => Math.round(value * 100) / 100;

export interface QuotationLineCalcInput {
  totalHours: number;
  hourlyCost: number;
  products: Array<{ quantity: number | null; unitCost: number }>;
  overheadRate?: number;
  commissionRate?: number;
  profitRate?: number;
}

export interface QuotationLineCalcResult {
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
}

export function calculateQuotationLine(
  line: QuotationLineCalcInput,
  hourlyCost: number
): QuotationLineCalcResult {
  const overheadRate = line.overheadRate ?? DEFAULT_OVERHEAD_RATE;
  const commissionRate = line.commissionRate ?? DEFAULT_COMMISSION_RATE;
  const profitRate = line.profitRate ?? DEFAULT_PROFIT_RATE;

  const productCost = round2(
    line.products.reduce((sum, p) => sum + (p.quantity ?? 0) * p.unitCost, 0)
  );

  const laborCost = round2((line.totalHours ?? 0) * hourlyCost);

  const subtotal = round2(productCost + laborCost);

  const overheadAmount = round2(subtotal * overheadRate);
  const totalCost = round2(subtotal + overheadAmount);

  const commissionAmount = round2(totalCost * commissionRate);
  const profitAmount = round2(totalCost * profitRate);

  const clientValue = round2(totalCost + commissionAmount + profitAmount);

  const igv = round2(clientValue * IGV_RATE);
  const clientPrice = round2(clientValue + igv);

  return {
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
  };
}

export interface QuotationHeaderCalcResult {
  subtotal: number;
  discountRate: number;
  discountAmount: number;
  taxableBase: number;
  igv: number;
  total: number;
}

export function calculateQuotationHeader(
  lines: Array<{ clientValue: number }>,
  discountRate: number
): QuotationHeaderCalcResult {
  const rate = round2(discountRate);
  const subtotal = round2(lines.reduce((sum, l) => sum + l.clientValue, 0));
  const discountAmount = round2(subtotal * rate);
  const taxableBase = round2(subtotal - discountAmount);
  const igv = round2(taxableBase * IGV_RATE);
  const total = round2(taxableBase + igv);
  return { subtotal, discountRate: rate, discountAmount, taxableBase, igv, total };
}