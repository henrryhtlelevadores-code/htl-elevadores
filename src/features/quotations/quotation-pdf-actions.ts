"use server";

import React from "react";
import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { db, quotations } from "@/db/index";
import { eq } from "drizzle-orm";
import { getErrorMessage } from "@/lib/errors";
import { uploadPdfToR2, buildQuotationPdfKey } from "@/lib/r2";
import { getQuotationById, getQuotationImages } from "./actions";
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

function resolveSignatureUrl(): string {
  const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? process.env.R2_PUBLIC_URL ?? "";
  return process.env.NEXT_PUBLIC_R2_FIRM_URL || process.env.R2_FIRM_URL || `${r2Url}/empresa/firma.PNG`;
}

function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_S3_API &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_PUBLIC_URL
  );
}

async function buildQuotationPdfData(
  quotationId: string
): Promise<QuotationPdfData> {
  const quotation = await getQuotationById(quotationId);
  if (!quotation) {
    throw new Error("Cotización no encontrada");
  }
  const images = await getQuotationImages(quotationId);
  const validityDays = Math.max(1, Math.round(Number(quotation.validityDays) || 15));

  return {
    logoUrl: resolveLogoUrl(),
    signatureUrl: resolveSignatureUrl(),
    quotationNumber: quotation.quotationNumber,
    clientName: quotation.client_name ?? "—",
    clientTaxId: quotation.client_tax_id,
    costCenterName: quotation.cost_center_name,
    costCenterAddress: quotation.cost_center_address,
    costCenterDistrict: quotation.cost_center_district,
    advisorName: quotation.advisor_name,
    status: quotation.status ?? "DRAFT",
    issueDate: dateEs(quotation.issueDate),
    validUntil: dateEs((quotation.issueDate ?? 0) + validityDays * 86400),
    discountMode: (quotation.discountMode ?? "PERCENT") as string,
    showTaxBreakdown: quotation.showTaxBreakdown ?? true,
    discountRate: quotation.discountRate ?? 0,
    subtotal: quotation.subtotal ?? 0,
    discountAmount: quotation.discountAmount ?? 0,
    taxableBase: quotation.taxableBase ?? 0,
    igv: quotation.igv ?? 0,
    total: quotation.total ?? 0,
    welcomeMessage: quotation.welcomeMessage,
    closeMessage: quotation.closeMessage,
    paymentTerms: quotation.paymentTerms,
    executionTime: quotation.executionTime,
    workingHours: quotation.workingHours,
    validityDays,
    images: images.map((image) => ({ url: image.url, caption: image.caption, isReferenceOnly: image.isReferenceOnly })),
    lines: quotation.lines.map((line) => ({
      // La cabecera de la cotización identifica cada equipo únicamente por su código.
      equipment: line.elevator_internal_code || null,
      description: line.description ?? "",
      lineMode: line.lineMode ?? "CALCULATED",
      lineModeReason: line.lineModeReason,
      manualPrice: line.manualPrice,
      manualPriceIncludesIgv: line.manualPriceIncludesIgv,
      supplierName: line.supplierName,
      supplierCost: line.supplierCost,
      lineOverridePrice: line.lineOverridePrice,
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

async function renderQuotationPdf(quotationId: string): Promise<Buffer> {
  const data = await buildQuotationPdfData(quotationId);
  return renderToBuffer(
    React.createElement(QuotationPDF, { data }) as unknown as Parameters<
      typeof renderToBuffer
    >[0]
  );
}

/**
 * Devuelve un data URL para previsualizar o descargar el PDF. Reutiliza el
 * PDF persistido en BD (R2) si existe y la cotización no cambió. Si R2 no
 * está configurado, siempre genera el PDF en memoria.
 */
export async function getQuotationPdfDataUrl(
  quotationId: string
): Promise<{ dataUrl: string; reused: boolean } | { error: string }> {
  try {
    const quotation = await getQuotationById(quotationId);
    if (!quotation) {
      return { error: "Cotización no encontrada" };
    }

    if (
      isR2Configured() &&
      quotation.pdfUrl &&
      quotation.pdfGeneratedAt &&
      quotation.pdfGeneratedAt >= (quotation.createdAt ?? 0)
    ) {
      const dataUrl = `${quotation.pdfUrl}#toolbar=0`;
      return { dataUrl, reused: true };
    }

    const buffer = await renderQuotationPdf(quotationId);
    return {
      dataUrl: `data:application/pdf;base64,${buffer.toString("base64")}`,
      reused: false,
    };
  } catch (error) {
    console.error("Error al generar PDF de cotización:", error);
    return { error: getErrorMessage(error) };
  }
}

/**
 * Reutiliza el PDF persistido en R2 si ya existe y la cotización no cambió
 * desde la última generación. En caso contrario regenera el PDF, sustituye
 * el archivo en R2 (mismo nombre de clave) y actualiza la URL.
 */
export async function generateAndStoreQuotationPdf(quotationId: string): Promise<
  | { success: true; pdfUrl: string; generatedAt: number; reused: boolean }
  | { success: false; error: string }
> {
  try {
    const quotation = await getQuotationById(quotationId);
    if (!quotation) {
      return { success: false, error: "Cotización no encontrada" };
    }

    const now = Math.floor(Date.now() / 1000);
    const cachedPdfUrl = quotation.pdfUrl;
    const cacheIsFresh =
      cachedPdfUrl &&
      cachedPdfUrl.startsWith("http") &&
      (quotation.pdfGeneratedAt ?? 0) >= (quotation.createdAt ?? 0);

    if (cacheIsFresh) {
      return {
        success: true,
        pdfUrl: cachedPdfUrl,
        generatedAt: quotation.pdfGeneratedAt ?? now,
        reused: true,
      };
    }

    const buffer = await renderQuotationPdf(quotationId);
    const key = buildQuotationPdfKey(quotation.quotationNumber);
    const hostedUrl = isR2Configured()
      ? await uploadPdfToR2(key, buffer)
      : `data:application/pdf;base64,${buffer.toString("base64")}`;
    const pdfUrl = hostedUrl.startsWith("http")
      ? `${hostedUrl}?v=${now}`
      : hostedUrl;
    await db
      .update(quotations)
      .set({ pdfUrl, pdfGeneratedAt: now })
      .where(eq(quotations.id, quotationId));

    revalidatePath("/quotations");
    revalidatePath(`/quotations/${quotationId}`);

    return { success: true, pdfUrl, generatedAt: now, reused: false };
  } catch (error) {
    console.error("Error al generar y almacenar PDF de cotización:", error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error:
        message && message !== "[object Object]"
          ? `No se pudo generar el PDF: ${message}`
          : getErrorMessage(error),
    };
  }
}
