import "server-only";

import React from "react";
import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { db, quotations } from "@/db/index";
import { eq } from "drizzle-orm";
import { getErrorMessage } from "@/lib/errors";
import {
  deleteStoredPdf,
  isPrivatePdfStorageConfigured,
  newPrivatePdfKey,
  uploadPrivatePdf,
} from "@/lib/r2";
import { loadQuotationDetail, loadQuotationImages } from "./queries";
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

async function buildQuotationPdfData(
  quotationId: string
): Promise<QuotationPdfData> {
  const quotation = await loadQuotationDetail(quotationId);
  if (!quotation) {
    throw new Error("Cotización no encontrada");
  }
  const images = await loadQuotationImages(quotationId);
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
 * Versión del diseño del PDF. Va en el nombre del archivo guardado; al subirla
 * (cada vez que cambie la plantilla en components/quotation-pdf.tsx) los PDFs
 * ya generados dejan de reutilizarse y se regeneran al abrirlos.
 */
const PDF_TEMPLATE_VERSION = 4;
const TEMPLATE_SUFFIX = `-t${PDF_TEMPLATE_VERSION}.pdf`;

export type StoredQuotationPdf =
  | { success: true; pdfKey: string; generatedAt: number; reused: boolean }
  | { success: false; error: string };

/**
 * Deja el PDF de la cotización en el bucket privado y devuelve su clave.
 * Reutiliza el ya guardado si la cotización no cambió desde entonces; si no,
 * lo genera con una clave nueva y aleatoria y borra el anterior.
 *
 * NO comprueba permisos: quien llama debe haber autorizado antes.
 */
export async function storeQuotationPdf(quotationId: string): Promise<StoredQuotationPdf> {
  try {
    const quotation = await loadQuotationDetail(quotationId);
    if (!quotation) {
      return { success: false, error: "Cotización no encontrada" };
    }

    const now = Math.floor(Date.now() / 1000);
    const cacheIsFresh =
      quotation.pdfKey &&
      quotation.pdfKey.endsWith(TEMPLATE_SUFFIX) &&
      (quotation.pdfGeneratedAt ?? 0) >= (quotation.createdAt ?? 0);

    if (cacheIsFresh && quotation.pdfKey) {
      return {
        success: true,
        pdfKey: quotation.pdfKey,
        generatedAt: quotation.pdfGeneratedAt ?? now,
        reused: true,
      };
    }

    if (!isPrivatePdfStorageConfigured()) {
      return {
        success: false,
        error:
          "El almacenamiento privado de PDFs no está configurado (R2_PRIVATE_BUCKET_NAME).",
      };
    }

    const buffer = await renderQuotationPdf(quotationId);
    const pdfKey = newPrivatePdfKey("quotations").replace(/\.pdf$/, TEMPLATE_SUFFIX);
    await uploadPrivatePdf(pdfKey, buffer);
    await db
      .update(quotations)
      .set({ pdfKey, pdfUrl: null, pdfGeneratedAt: now })
      .where(eq(quotations.id, quotationId));
    // El PDF anterior (privado o del bucket público antiguo) ya no se usa.
    await deleteStoredPdf({ url: quotation.pdfUrl, key: quotation.pdfKey });

    revalidatePath("/quotations");
    revalidatePath(`/quotations/${quotationId}`);

    return { success: true, pdfKey, generatedAt: now, reused: false };
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
