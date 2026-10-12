"use client";

import { useMemo } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import type { quotationFormSchema, QuotationFormValues } from "../schema";
import type { QuotationDetail } from "../actions";
import {
  calculateQuotationLine,
  calculateQuotationHeader,
  type LineMode,
  type PricingRules,
} from "../calc";

/**
 * Piezas que comparten los tabs "Líneas de Cotización" y "Descuento" del detalle:
 * ambos editan el mismo formulario y muestran el mismo cálculo.
 */

export type QuotationFormInput = z.input<typeof quotationFormSchema>;
export type QuotationFormOutput = z.output<typeof quotationFormSchema>;
export type QuotationForm = UseFormReturn<QuotationFormInput, unknown, QuotationFormOutput>;

export const money = (value: number) =>
  value.toLocaleString("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  });

const toDateInput = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const todayInput = () => toDateInput(new Date());

export const plusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateInput(d);
};

export const tsToInput = (ts: number | null | undefined) =>
  ts ? toDateInput(new Date(ts * 1000)) : todayInput();

export function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="size-3.5" />
      {title}
    </div>
  );
}

export const emptyProduct = () => ({
  description: "",
  quantity: "1",
  unit: "",
  unitCost: "",
});

export const makeDefaultLine = (hourlyCost: number) => ({
  elevatorUnityId: "",
  serviceTypeId: "",
  description: "",
  totalHours: "0",
  hourlyCost: String(hourlyCost || 0),
  lineMode: "CALCULATED" as LineMode,
  lineModeReason: "",
  manualPrice: "",
  manualPriceIncludesIgv: true,
  supplierName: "",
  supplierCost: "",
  overridePrice: false,
  lineOverridePrice: "",
  lineOverrideReason: "",
  discountMode: "NONE" as const,
  discountValue: "",
  products: [emptyProduct()],
});

export function detailToValues(detail: QuotationDetail, hourlyCost: number): QuotationFormValues {
  return {
    clientId: detail.clientId,
    costCenterId: detail.costCenterId ?? "",
    advisorId: detail.advisorId ?? "",
    issueDate: tsToInput(detail.issueDate),
    validUntil: tsToInput(detail.validUntil),
    status: detail.status ?? "DRAFT",
    discountMode: (detail.discountMode ?? "PERCENT") as QuotationFormValues["discountMode"],
    discountRate: String(detail.discountRate ?? 0),
    discountAmount: String(detail.discountAmount ?? 0),
    targetTotal: detail.targetTotal != null ? String(detail.targetTotal) : "",
    targetTotalIncludesIgv: detail.targetTotalIncludesIgv ?? true,
    showTaxBreakdown: detail.showTaxBreakdown ?? true,
    lines: detail.lines.map((l) => ({
      elevatorUnityId: l.elevatorUnityId ?? "",
      serviceTypeId: l.serviceTypeId ?? "",
      description: l.description ?? "",
      totalHours: String(l.totalHours ?? 0),
      hourlyCost: String(l.hourlyCost ?? hourlyCost),
      lineMode: (l.lineMode === "MANUAL_PRICE" ? "MANUAL_PRICE" : "CALCULATED") as LineMode,
      lineModeReason: l.lineModeReason ?? "",
      manualPrice: l.manualPrice != null ? String(l.manualPrice) : "",
      manualPriceIncludesIgv: l.manualPriceIncludesIgv ?? true,
      supplierName: l.supplierName ?? "",
      supplierCost: l.supplierCost != null ? String(l.supplierCost) : "",
      overridePrice: l.lineOverridePrice != null,
      lineOverridePrice: l.lineOverridePrice != null ? String(l.lineOverridePrice) : "",
      lineOverrideReason: l.lineOverrideReason ?? "",
      discountMode:
        l.lineDiscountMode === "PERCENT" || l.lineDiscountMode === "AMOUNT"
          ? l.lineDiscountMode
          : ("NONE" as const),
      discountValue: l.lineDiscountValue != null ? String(l.lineDiscountValue) : "",
      products:
        l.products.length > 0
          ? l.products.map((p) => ({
              description: p.description,
              quantity: String(p.quantity ?? 1),
              unit: p.unit ?? "",
              unitCost: String(p.unitCost ?? 0),
            }))
          : [emptyProduct()],
    })),
  };
}

/** Cálculo en vivo de cada línea y de los totales, con las mismas reglas del servidor. */
export function useQuotationSummary(form: QuotationForm, pricing: PricingRules) {
  const currentLines = useWatch({ control: form.control, name: "lines" });
  const discountMode = useWatch({ control: form.control, name: "discountMode" });
  const discountRate = useWatch({ control: form.control, name: "discountRate" });
  const discountAmount = useWatch({ control: form.control, name: "discountAmount" });
  const targetTotal = useWatch({ control: form.control, name: "targetTotal" });
  const targetTotalIncludesIgv = useWatch({
    control: form.control,
    name: "targetTotalIncludesIgv",
  });

  const summary = useMemo(() => {
    const lines = (currentLines ?? []).map((l, i) => {
      const hourlyCost = Number(l.hourlyCost) || 0;
      const lineMode = (l.lineMode ?? "CALCULATED") as LineMode;
      const products =
        lineMode === "MANUAL_PRICE"
          ? []
          : (l.products ?? [])
              .filter((p) => p.description.trim() !== "" || Number(p.unitCost) > 0)
              .map((p) => ({
                quantity: Number(p.quantity),
                unitCost: Number(p.unitCost),
              }));
      return {
        i,
        calc: calculateQuotationLine(
          {
            totalHours: Number(l.totalHours) || 0,
            hourlyCost,
            products,
            lineMode,
            manualPrice: Number(l.manualPrice) || null,
            manualPriceIncludesIgv: l.manualPriceIncludesIgv ?? true,
            supplierName: l.supplierName || null,
            supplierCost: Number(l.supplierCost) || null,
            lineOverridePrice: l.overridePrice ? Number(l.lineOverridePrice) || null : null,
            discountMode: l.discountMode,
            discountValue: Number(l.discountValue) || 0,
          },
          hourlyCost,
          pricing
        ),
      };
    });
    const byLine = new Map(lines.map((l) => [l.i, l.calc]));
    const header = calculateQuotationHeader(
      lines.map((l) => ({ clientValue: l.calc.clientValue })),
      {
        discountMode: (discountMode ?? "PERCENT") as QuotationFormValues["discountMode"],
        discountRate: Number(discountRate) || 0,
        discountAmount: Number(discountAmount) || 0,
        targetTotal: Number(targetTotal) || null,
        targetTotalIncludesIgv: targetTotalIncludesIgv ?? true,
      },
      pricing
    );
    const lineDiscountTotal =
      Math.round(lines.reduce((sum, l) => sum + l.calc.discountAmount, 0) * 100) / 100;
    return { byLine, header, lineDiscountTotal };
  }, [
    currentLines,
    discountMode,
    discountRate,
    discountAmount,
    targetTotal,
    targetTotalIncludesIgv,
    pricing,
  ]);

  return { currentLines, summary };
}
