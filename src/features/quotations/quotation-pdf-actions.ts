"use server";

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getErrorMessage } from "@/lib/errors";
import { getQuotationById } from "./actions";
import {
  QuotationPDF,
  dateEs,
  type QuotationPdfData,
} from "./components/quotation-pdf";

function resolveLogoUrl(): string {
  const r2Url =
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? process.env.R2_PUBLIC_URL ?? "";
  return (
    process.env.NEXT_PUBLIC_R2_LOGO_URL ||
    process.env.R2_LOGO_URL ||
    `${r2Url}/empresa/logohtlrojo.png`
  );
}

async function buildQuotationPdfData(
  quotationId: string
): Promise<QuotationPdfData> {
  const quotation = await getQuotationById(quotationId);
  if (!quotation) {
    throw new Error("Cotización no encontrada");
  }

  return {
    logoUrl: resolveLogoUrl(),
    quotationNumber: quotation.quotationNumber,
    clientName: quotation.client_name ?? "—",
    clientTaxId: quotation.client_tax_id,
    costCenterName: quotation.cost_center_name,
    costCenterAddress: quotation.cost_center_address,
    costCenterDistrict: quotation.cost_center_district,
    advisorName: quotation.advisor_name,
    status: quotation.status ?? "DRAFT",
    issueDate: dateEs(quotation.issueDate),
    validUntil: dateEs(quotation.validUntil),
    discountRate: quotation.discountRate ?? 0,
    subtotal: quotation.subtotal ?? 0,
    discountAmount: quotation.discountAmount ?? 0,
    taxableBase: quotation.taxableBase ?? 0,
    igv: quotation.igv ?? 0,
    total: quotation.total ?? 0,
    notes: quotation.notes,
    terms: quotation.terms,
    lines: quotation.lines.map((line) => ({
      equipment:
        line.elevator_internal_code || line.elevator_name
          ? [line.elevator_internal_code, line.elevator_name]
              .filter(Boolean)
              .join(" — ")
          : null,
      description: line.description ?? "",
      lineMode: line.lineMode ?? "CALCULATED",
      lineModeReason: line.lineModeReason,
      lineOverrideReason: line.lineOverrideReason,
      totalHours: line.totalHours ?? 0,
      hourlyCost: line.hourlyCost ?? 0,
      productCost: line.productCost ?? 0,
      laborCost: line.laborCost ?? 0,
      subtotal: line.subtotal ?? 0,
      overheadRate: line.overheadRate ?? 0,
      overheadAmount: line.overheadAmount ?? 0,
      totalCost: line.totalCost ?? 0,
      commissionRate: line.commissionRate ?? 0,
      commissionAmount: line.commissionAmount ?? 0,
      profitRate: line.profitRate ?? 0,
      profitAmount: line.profitAmount ?? 0,
      clientValue: line.clientValue ?? 0,
      igv: line.igv ?? 0,
      clientPrice: line.clientPrice ?? 0,
      products: (line.products ?? []).map((p) => ({
        description: p.description,
        quantity: p.quantity ?? 1,
        unit: p.unit,
        unitCost: p.unitCost ?? 0,
        totalCost: p.totalCost ?? 0,
      })),
    })),
  };
}

export async function getQuotationPdfDataUrl(
  quotationId: string
): Promise<{ dataUrl: string } | { error: string }> {
  try {
    const data = await buildQuotationPdfData(quotationId);
    const buffer = await renderToBuffer(
      React.createElement(QuotationPDF, { data }) as unknown as Parameters<
        typeof renderToBuffer
      >[0]
    );
    return {
      dataUrl: `data:application/pdf;base64,${buffer.toString("base64")}`,
    };
  } catch (error) {
    console.error("Error al generar PDF de cotización:", error);
    return { error: getErrorMessage(error) };
  }
}