import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import {
  db,
  clients,
  costCenters,
  users,
  ubigeos,
  elevatorUnities,
  quotations,
  quotationLines,
  quotationLineProducts,
  quotationImages,
  type QuotationLineProduct,
} from "@/db/index";
import type { QuotationDetail } from "./actions";

/**
 * Lecturas internas de cotizaciones, SIN comprobación de permisos. Viven
 * fuera de los archivos "use server" para no ser endpoints: quien las llama
 * (acción de personal, portal, generación de PDF) debe haber autorizado antes.
 */

export async function loadQuotationDetail(id: string): Promise<QuotationDetail | null> {
  try {
    const [row] = await db
      .select({
        id: quotations.id,
        quotationNumber: quotations.quotationNumber,
        clientId: quotations.clientId,
        costCenterId: quotations.costCenterId,
        advisorId: quotations.advisorId,
        issueDate: quotations.issueDate,
        validUntil: quotations.validUntil,
        status: quotations.status,
        discountMode: quotations.discountMode,
        targetTotal: quotations.targetTotal,
        targetTotalIncludesIgv: quotations.targetTotalIncludesIgv,
        discountRate: quotations.discountRate,
        subtotal: quotations.subtotal,
        discountAmount: quotations.discountAmount,
        taxableBase: quotations.taxableBase,
        igv: quotations.igv,
        total: quotations.total,
        welcomeMessage: quotations.welcomeMessage,
        closeMessage: quotations.closeMessage,
        paymentTerms: quotations.paymentTerms,
        executionTime: quotations.executionTime,
        workingHours: quotations.workingHours,
        validityDays: quotations.validityDays,
        showTaxBreakdown: quotations.showTaxBreakdown,
        configSnapshot: quotations.configSnapshot,
        pdfUrl: quotations.pdfUrl,
        pdfGeneratedAt: quotations.pdfGeneratedAt,
        createdAt: quotations.createdAt,
        client_name: clients.legalName,
        client_tax_id: clients.taxId,
        cost_center_name: costCenters.name,
        cost_center_address: costCenters.address,
        cost_center_district: ubigeos.distrito,
        advisor_name: users.fullName,
      })
      .from(quotations)
      .innerJoin(clients, eq(quotations.clientId, clients.id))
      .leftJoin(costCenters, eq(quotations.costCenterId, costCenters.id))
      .leftJoin(ubigeos, eq(costCenters.ubigeoId, ubigeos.id))
      .leftJoin(users, eq(quotations.advisorId, users.id))
      .where(eq(quotations.id, id))
      .limit(1);

    if (!row) return null;

    const lineRows = await db
      .select({
        id: quotationLines.id,
        quotationId: quotationLines.quotationId,
        elevatorUnityId: quotationLines.elevatorUnityId,
        equipmentSerial: quotationLines.equipmentSerial,
        description: quotationLines.description,
        orderIndex: quotationLines.orderIndex,
        lineMode: quotationLines.lineMode,
        lineModeReason: quotationLines.lineModeReason,
        manualPrice: quotationLines.manualPrice,
        manualPriceIncludesIgv: quotationLines.manualPriceIncludesIgv,
        supplierName: quotationLines.supplierName,
        supplierCost: quotationLines.supplierCost,
        lineOverridePrice: quotationLines.lineOverridePrice,
        lineOverrideReason: quotationLines.lineOverrideReason,
        totalHours: quotationLines.totalHours,
        hourlyCost: quotationLines.hourlyCost,
        laborCost: quotationLines.laborCost,
        productCost: quotationLines.productCost,
        subtotal: quotationLines.subtotal,
        overheadRate: quotationLines.overheadRate,
        overheadAmount: quotationLines.overheadAmount,
        totalCost: quotationLines.totalCost,
        commissionRate: quotationLines.commissionRate,
        commissionAmount: quotationLines.commissionAmount,
        profitRate: quotationLines.profitRate,
        profitAmount: quotationLines.profitAmount,
        clientValue: quotationLines.clientValue,
        igv: quotationLines.igv,
        clientPrice: quotationLines.clientPrice,
        createdAt: quotationLines.createdAt,
        elevator_name: elevatorUnities.name,
        elevator_internal_code: elevatorUnities.internalCode,
      })
      .from(quotationLines)
      .leftJoin(elevatorUnities, eq(quotationLines.elevatorUnityId, elevatorUnities.id))
      .where(eq(quotationLines.quotationId, id))
      .orderBy(asc(quotationLines.orderIndex));

    const productRows: QuotationLineProduct[] =
      lineRows.length > 0
        ? ((await db
            .select()
            .from(quotationLineProducts)
            .where(
              inArray(
                quotationLineProducts.quotationLineId,
                lineRows.map((l) => l.id)
              )
            )
            .orderBy(asc(quotationLineProducts.orderIndex))) as QuotationLineProduct[])
        : [];

    const productsByLine = new Map<string, QuotationLineProduct[]>();
    for (const p of productRows) {
      const list = productsByLine.get(p.quotationLineId) ?? [];
      list.push(p);
      productsByLine.set(p.quotationLineId, list);
    }

    return {
      ...row,
      lines: lineRows.map((l) => ({
        ...l,
        products: productsByLine.get(l.id) ?? [],
      })),
    };
  } catch (error) {
    console.error("Error al obtener cotización:", error);
    return null;
  }
}

export async function loadQuotationImages(quotationId: string) {
  return db
    .select()
    .from(quotationImages)
    .where(eq(quotationImages.quotationId, quotationId))
    .orderBy(asc(quotationImages.orderIndex));
}
