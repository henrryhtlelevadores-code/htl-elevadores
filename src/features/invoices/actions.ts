"use server";

import { revalidatePath } from "next/cache";
import { type BatchItem } from "drizzle-orm/batch";
import {
  db,
  invoices,
  invoiceItems,
  clients,
  costCenters,
  workOrders,
  contracts,
  serviceTypes,
} from "@/db/index";
import { eq, asc, desc, isNull, count, sql, and, inArray } from "drizzle-orm";
import { generateUuid } from "@/lib/uuid";
import { getErrorMessage } from "@/lib/errors";
import { type InvoiceFormValues } from "./schema";

export interface ActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

export type InvoiceListItem = {
  id: string;
  documentType: string;
  series: string | null;
  number: string | null;
  clientId: string;
  client_name: string;
  costCenterId: string | null;
  cost_center_name: string | null;
  workOrderId: string | null;
  otNumber: string | null;
  contractId: string | null;
  contractNumber: string | null;
  issueDate: number | null;
  dueDate: number | null;
  taxPeriod: string | null;
  currency: string | null;
  total: number;
  taxableBase: number | null;
  igv: number | null;
  rentaRate: number | null;
  rentaAmount: number | null;
  detractionRate: number | null;
  detractionAmount: number | null;
  netPayable: number | null;
  sunatStatus: string | null;
  paymentStatus: string | null;
  clientTaxIdSnapshot: string | null;
  itemCount: number;
  itemTotal: number;
};

export async function getInvoices(): Promise<InvoiceListItem[]> {
  try {
    const rows = await db
      .select({
        id: invoices.id,
        documentType: invoices.documentType,
        series: invoices.series,
        number: invoices.number,
        clientId: invoices.clientId,
        client_name: clients.legalName,
        costCenterId: invoices.costCenterId,
        cost_center_name: costCenters.name,
        workOrderId: invoices.workOrderId,
        otNumber: workOrders.otNumber,
        contractId: invoices.contractId,
        contractNumber: contracts.contractNumber,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        taxPeriod: invoices.taxPeriod,
        currency: invoices.currency,
        total: invoices.total,
        taxableBase: invoices.taxableBase,
        igv: invoices.igv,
        rentaRate: invoices.rentaRate,
        rentaAmount: invoices.rentaAmount,
        detractionRate: invoices.detractionRate,
        detractionAmount: invoices.detractionAmount,
        netPayable: invoices.netPayable,
        sunatStatus: invoices.sunatStatus,
        paymentStatus: invoices.paymentStatus,
        clientTaxIdSnapshot: invoices.clientTaxIdSnapshot,
      })
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .leftJoin(costCenters, eq(invoices.costCenterId, costCenters.id))
      .leftJoin(workOrders, eq(invoices.workOrderId, workOrders.id))
      .leftJoin(contracts, eq(invoices.contractId, contracts.id))
      .orderBy(desc(invoices.createdAt));

    const itemAgg = await db
      .select({
        invoiceId: invoiceItems.invoiceId,
        itemCount: count(invoiceItems.id),
        itemTotal: sql<number>`coalesce(sum(${invoiceItems.total}), 0)`,
      })
      .from(invoiceItems)
      .groupBy(invoiceItems.invoiceId);

    const aggByInvoice = new Map(
      itemAgg.map((a) => [a.invoiceId, a as { invoiceId: string; itemCount: number; itemTotal: number }])
    );

    return rows.map((row) => {
      const agg = aggByInvoice.get(row.id);
      return {
        id: row.id,
        documentType: row.documentType,
        series: row.series,
        number: row.number,
        clientId: row.clientId,
        client_name: row.client_name,
        costCenterId: row.costCenterId,
        cost_center_name: row.cost_center_name,
        workOrderId: row.workOrderId,
        otNumber: row.otNumber,
        contractId: row.contractId,
        contractNumber: row.contractNumber,
        issueDate: row.issueDate,
        dueDate: row.dueDate,
        taxPeriod: row.taxPeriod,
        currency: row.currency,
        total: row.total,
        taxableBase: row.taxableBase,
        igv: row.igv,
        rentaRate: row.rentaRate,
        rentaAmount: row.rentaAmount,
        detractionRate: row.detractionRate,
        detractionAmount: row.detractionAmount,
        netPayable: row.netPayable,
        sunatStatus: row.sunatStatus,
        paymentStatus: row.paymentStatus,
        clientTaxIdSnapshot: row.clientTaxIdSnapshot,
        itemCount: agg?.itemCount ?? 0,
        itemTotal: agg?.itemTotal ?? 0,
      };
    });
  } catch (error) {
    console.error("Error al obtener facturas:", error);
    return [];
  }
}

export interface InvoicesFilterData {
  clients: Array<{ id: string; legalName: string }>;
  costCenters: Array<{
    id: string;
    name: string;
    clientId: string;
    client_name: string;
  }>;
}

export async function getInvoicesFilterData(): Promise<InvoicesFilterData> {
  const [clientRes, ccRes] = await Promise.all([
    db
      .select({ id: clients.id, legalName: clients.legalName })
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(asc(clients.legalName)),
    db
      .select({
        id: costCenters.id,
        name: costCenters.name,
        clientId: costCenters.clientId,
        client_name: clients.legalName,
      })
      .from(costCenters)
      .innerJoin(clients, eq(costCenters.clientId, clients.id))
      .where(isNull(costCenters.deletedAt))
      .orderBy(asc(costCenters.name)),
  ]);

  return { clients: clientRes, costCenters: ccRes };
}

export type InvoiceItemDetail = {
  id: string;
  serviceTypeName: string | null;
  description: string;
  sourceType: string | null;
  sourceId: string | null;
  quantity: number | null;
  unitPrice: number;
  subtotal: number;
};

export async function getInvoiceItems(
  invoiceId: string
): Promise<InvoiceItemDetail[]> {
  try {
    const rows = await db
      .select({
        id: invoiceItems.id,
        serviceTypeId: invoiceItems.serviceTypeId,
        serviceTypeName: serviceTypes.name,
        description: invoiceItems.description,
        sourceType: invoiceItems.sourceType,
        sourceId: invoiceItems.sourceId,
        quantity: invoiceItems.quantity,
        unitPrice: invoiceItems.unitPrice,
        subtotal: invoiceItems.subtotal,
      })
      .from(invoiceItems)
      .leftJoin(serviceTypes, eq(invoiceItems.serviceTypeId, serviceTypes.id))
      .where(eq(invoiceItems.invoiceId, invoiceId))
      .orderBy(asc(invoiceItems.createdAt));

    return rows.map((row) => ({
      id: row.id,
      serviceTypeName: row.serviceTypeName,
      description: row.description,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      subtotal: row.subtotal,
    }));
  } catch (error) {
    console.error("Error al obtener conceptos de factura:", error);
    return [];
  }
}

export interface InvoiceFormData {
  serviceTypes: Array<{ id: string; name: string }>;
  contracts: Array<{
    id: string;
    contractNumber: string;
    costCenterId: string;
    status: string | null;
  }>;
}

const INVOICE_SERVICE_CODES = [
  "CORR-1",
  "CORR-2",
  "PREV",
  "MOD-1",
  "MOD-2",
  "INST",
  "REMO",
];

export async function getInvoiceFormData(): Promise<InvoiceFormData> {
  const [serviceTypeRes, contractRes] = await Promise.all([
    db
      .select({ id: serviceTypes.id, name: serviceTypes.name })
      .from(serviceTypes)
      .where(
        and(eq(serviceTypes.isActive, true), inArray(serviceTypes.code, INVOICE_SERVICE_CODES))
      )
      .orderBy(asc(serviceTypes.name)),
    db
      .select({
        id: contracts.id,
        contractNumber: contracts.contractNumber,
        costCenterId: contracts.costCenterId,
        status: contracts.status,
      })
      .from(contracts)
      .where(isNull(contracts.deletedAt))
      .orderBy(asc(contracts.contractNumber)),
  ]);

  return {
    serviceTypes: serviceTypeRes,
    contracts: contractRes,
  };
}

const IGV_RATE = 0.18;
const RENTA_RATE = 0.015;
const DETRACTION_RATE = 0.04;
const DETRACTION_THRESHOLD = 700;
const CENTS = (value: number) => Math.round(value * 100) / 100;

function toTimestamp(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const ts = new Date(`${dateStr}T00:00:00`).getTime();
  return Number.isNaN(ts) ? null : ts;
}

export async function createInvoice(values: InvoiceFormValues): Promise<ActionResult> {
  try {
    const contractId = values.contractId || null;
    const costCenterId = values.costCenterId || null;
    const issueDate = values.issueDate || null;
    const taxPeriod = issueDate ? issueDate.slice(0, 7) : null;

    const clientRow = await db
      .select({
        legalName: clients.legalName,
        taxId: clients.taxId,
        taxIdType: clients.taxIdType,
        billingAddress: clients.billingAddress,
      })
      .from(clients)
      .where(eq(clients.id, values.clientId))
      .limit(1);

    const computedItems = values.items.map((item) => {
      const quantity = CENTS(Number(item.quantity) || 0);
      const unitPrice = CENTS(Number(item.unitPrice) || 0);
      const subtotal = CENTS(quantity * unitPrice);
      return {
        description: item.description,
        serviceTypeId: item.serviceTypeId || null,
        quantity,
        unitPrice,
        subtotal,
      };
    });

    const taxableBase = CENTS(computedItems.reduce((acc, it) => acc + it.subtotal, 0));
    const igv = CENTS(taxableBase * IGV_RATE);
    const total = CENTS(taxableBase + igv);
    const rentaAmount = CENTS(total * RENTA_RATE);
    const detractionAmount =
      total > DETRACTION_THRESHOLD ? CENTS(total * DETRACTION_RATE) : 0;
    const netPayable = CENTS(total - detractionAmount);

    const invoiceId = generateUuid();
    const stmts: BatchItem<"sqlite">[] = [
      db.insert(invoices).values({
        id: invoiceId,
        documentType: values.documentType,
        series: values.series || null,
        number: values.number || null,
        clientId: values.clientId,
        costCenterId,
        contractId,
        issueDate: toTimestamp(issueDate ?? undefined),
        taxPeriod,
        currency: values.currency || "PEN",
        total,
        taxableBase,
        igv,
        rentaRate: total > 0 ? RENTA_RATE : 0,
        rentaAmount,
        detractionRate: total > 0 ? DETRACTION_RATE : 0,
        detractionAmount,
        netPayable,
        sunatStatus: "DRAFT",
        paymentStatus: "PENDING",
        clientTaxIdSnapshot: clientRow[0]?.taxId ?? null,
        clientTaxIdTypeSnapshot: clientRow[0]?.taxIdType ?? "RUC",
        clientNameSnapshot: clientRow[0]?.legalName ?? null,
        clientAddressSnapshot: clientRow[0]?.billingAddress ?? null,
      }),
    ];

    for (const item of computedItems) {
      stmts.push(
        db.insert(invoiceItems).values({
          id: generateUuid(),
          invoiceId,
          serviceTypeId: item.serviceTypeId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          igv: 0,
          total: item.subtotal,
        })
      );
    }

    await db.batch(stmts as unknown as Parameters<typeof db.batch>[0]);

    revalidatePath("/invoices");
    return {
      success: true,
      message: `Factura registrada correctamente por ${total.toLocaleString("es-PE", {
        minimumFractionDigits: 2,
      })}`,
    };
  } catch (error) {
    console.error("Error al crear factura:", error);
    if (getErrorMessage(error).includes("UNIQUE constraint failed")) {
      return {
        success: false,
        error: "La serie y número ya existen para este tipo de comprobante.",
      };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}