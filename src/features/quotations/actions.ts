"use server";

import { revalidatePath } from "next/cache";
import { type BatchItem } from "drizzle-orm/batch";

type SqliteBatchItem = BatchItem<"sqlite">;
import { getSessionUserId } from "@/features/auth/server";
import {
  db,
  clients,
  costCenters,
  users,
  ubigeos,
  elevatorUnities,
  laborConfig,
  pricingConfig,
  quotations,
  quotationLines,
  quotationLineProducts,
  type Quotation,
  type QuotationLine,
  type QuotationLineProduct,
} from "@/db/index";
import { eq, isNull, desc, count, like, inArray, asc, and } from "drizzle-orm";
import { generateUuid } from "@/lib/uuid";
import { getErrorMessage } from "@/lib/errors";
import { quotationFormSchema, stripBlankProducts, type QuotationFormValues } from "./schema";
import {
  calculateQuotationLine,
  calculateQuotationHeader,
  isManualPassthrough,
  DEFAULT_PRICING_RULES,
  type PricingRules,
} from "./calc";

export interface ActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const toTimestamp = (dateStr: string): number =>
  Math.floor(new Date(`${dateStr}T12:00:00`).getTime() / 1000);

// ==========================================
// COSTO DE MANO DE OBRA (labor_config)
// ==========================================

export async function getLaborConfig(): Promise<number> {
  try {
    const [row] = await db
      .select({ hourlyCost: laborConfig.hourlyCost })
      .from(laborConfig)
      .limit(1);
    return row?.hourlyCost ?? 0;
  } catch (error) {
    console.error("Error al obtener labor_config:", error);
    return 0;
  }
}

export async function upsertLaborConfig(hourlyCost: number): Promise<ActionResult> {
  try {
    const cost = round2(Number(hourlyCost) || 0);
    if (cost < 0) {
      return { success: false, error: "El costo por hora no puede ser negativo." };
    }
    const existing = await db.select({ id: laborConfig.id }).from(laborConfig).limit(1);
    if (existing.length > 0) {
      await db
        .update(laborConfig)
        .set({ hourlyCost: cost, updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(laborConfig.id, existing[0].id));
    } else {
      await db.insert(laborConfig).values({ id: "default", hourlyCost: cost });
    }
    revalidatePath("/quotations");
    return { success: true, message: "Costo por hora actualizado." };
  } catch (error) {
    console.error("Error al actualizar labor_config:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ==========================================
// CONFIGURACIÓN DE PRECIOS (pricing_config)
// ==========================================

const PRICING_CONFIG_ID = "default";

function toRules(row: typeof pricingConfig.$inferSelect | undefined): PricingRules {
  if (!row) return DEFAULT_PRICING_RULES;
  return {
    overheadRateLabor: row.overheadRateLabor ?? DEFAULT_PRICING_RULES.overheadRateLabor,
    overheadRateQuote: row.overheadRateQuote ?? DEFAULT_PRICING_RULES.overheadRateQuote,
    commissionRate: row.commissionRate ?? DEFAULT_PRICING_RULES.commissionRate,
    profitRate: row.profitRate ?? DEFAULT_PRICING_RULES.profitRate,
    igvRate: row.igvRate ?? DEFAULT_PRICING_RULES.igvRate,
    allowPriceOverride: row.allowPriceOverride ?? true,
    allowCostOverride: row.allowCostOverride ?? true,
  };
}

export async function getPricingConfig(): Promise<PricingRules> {
  try {
    const [row] = await db.select().from(pricingConfig).limit(1);
    return toRules(row);
  } catch (error) {
    console.error("Error al obtener pricing_config:", error);
    return DEFAULT_PRICING_RULES;
  }
}

export type PricingConfigInput = Partial<Omit<PricingRules, never>>;

export async function upsertPricingConfig(input: PricingConfigInput): Promise<ActionResult> {
  try {
    const values = {
      overheadRateLabor: Number(input.overheadRateLabor),
      overheadRateQuote: Number(input.overheadRateQuote),
      commissionRate: Number(input.commissionRate),
      profitRate: Number(input.profitRate),
      igvRate: Number(input.igvRate),
      allowPriceOverride: Boolean(input.allowPriceOverride),
      allowCostOverride: Boolean(input.allowCostOverride),
    };

    for (const [key, value] of Object.entries(values)) {
      if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) {
        return { success: false, error: `El valor de "${key}" no es válido.` };
      }
    }
    if (values.igvRate > 1) {
      return { success: false, error: "El IGV debe expresarse como decimal (0.18 = 18%)." };
    }

    const updatedAt = Math.floor(Date.now() / 1000);
    const existing = await db
      .select({ id: pricingConfig.id })
      .from(pricingConfig)
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(pricingConfig)
        .set({ ...values, updatedAt })
        .where(eq(pricingConfig.id, existing[0].id));
    } else {
      await db
        .insert(pricingConfig)
        .values({ id: PRICING_CONFIG_ID, ...values, updatedAt });
    }

    revalidatePath("/quotations");
    return { success: true, message: "Configuración de precios actualizada." };
  } catch (error) {
    console.error("Error al actualizar pricing_config:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ==========================================
// CORRELATIVO
// ==========================================

async function nextQuotationNumber(): Promise<string> {
  try {
    const year = new Date().getFullYear();
    const [{ total }] = await db
      .select({ total: count() })
      .from(quotations)
      .where(like(quotations.quotationNumber, `QT-${year}-%`));
    return `QT-${year}-${String(total + 1).padStart(4, "0")}`;
  } catch (error) {
    console.error("Error al generar correlativo:", error);
    return `QT-${new Date().getFullYear()}-0001`;
  }
}

// ==========================================
// LISTADO + DETALLE
// ==========================================

export type QuotationWithRelations = Quotation & {
  client_name: string | null;
  cost_center_name: string | null;
  advisor_name: string | null;
  lineCount: number;
};

export async function getQuotations(): Promise<QuotationWithRelations[]> {
  try {
    return await db
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
        notes: quotations.notes,
        terms: quotations.terms,
        configSnapshot: quotations.configSnapshot,
        pdfUrl: quotations.pdfUrl,
        pdfGeneratedAt: quotations.pdfGeneratedAt,
        createdAt: quotations.createdAt,
        client_name: clients.legalName,
        cost_center_name: costCenters.name,
        advisor_name: users.fullName,
        lineCount: count(quotationLines.id),
      })
      .from(quotations)
      .innerJoin(clients, eq(quotations.clientId, clients.id))
      .leftJoin(costCenters, eq(quotations.costCenterId, costCenters.id))
      .leftJoin(users, eq(quotations.advisorId, users.id))
      .leftJoin(quotationLines, eq(quotationLines.quotationId, quotations.id))
      .groupBy(quotations.id)
      .orderBy(desc(quotations.createdAt));
  } catch (error) {
    console.error("Error al obtener cotizaciones:", error);
    return [];
  }
}

export type LineModeSummary =
  | "ALL_CALCULATED"
  | "MANUAL_PRICE"
  | "PASSTHROUGH"
  | "MIXED";

/**
 * Devuelve, para cada cotización, un resumen de los modos de línea que usan sus
 * items. MANUAL_PRICE con proveedor y costo se clasifica como PASSTHROUGH.
 */
export async function getQuotationLineModeSummary(): Promise<Record<string, LineModeSummary>> {
  try {
    const rows = await db
      .select({
        quotationId: quotationLines.quotationId,
        lineMode: quotationLines.lineMode,
        supplierName: quotationLines.supplierName,
        supplierCost: quotationLines.supplierCost,
      })
      .from(quotationLines);

    const sets = new Map<string, Set<string>>();
    for (const row of rows) {
      const mode =
        isManualPassthrough(row.lineMode, row.supplierName, row.supplierCost)
          ? "PASSTHROUGH"
          : (row.lineMode ?? "CALCULATED");
      const set = sets.get(row.quotationId) ?? new Set<string>();
      set.add(mode);
      sets.set(row.quotationId, set);
    }

    const summary: Record<string, LineModeSummary> = {};
    for (const [quotationId, set] of sets) {
      if (set.size === 1) {
        const only = [...set][0];
        summary[quotationId] = only === "CALCULATED" ? "ALL_CALCULATED" : (only as LineModeSummary);
      } else {
        summary[quotationId] = "MIXED";
      }
    }
    return summary;
  } catch (error) {
    console.error("Error al obtener resumen de modos de línea:", error);
    return {};
  }
}

export type QuotationLineWithRelations = QuotationLine & {
  elevator_name: string | null;
  elevator_internal_code: string | null;
  products: QuotationLineProduct[];
};

export type QuotationDetail = Quotation & {
  client_name: string | null;
  client_tax_id: string | null;
  cost_center_name: string | null;
  cost_center_address: string | null;
  cost_center_district: string | null;
  advisor_name: string | null;
  lines: QuotationLineWithRelations[];
};

export async function getQuotationById(id: string): Promise<QuotationDetail | null> {
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
        notes: quotations.notes,
        terms: quotations.terms,
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

// ==========================================
// DATA PARA EL FORMULARIO
// ==========================================

export interface QuotationFormOptions {
  clients: Array<{ id: string; legalName: string | null; taxId: string | null }>;
  costCenters: Array<{
    id: string;
    clientId: string;
    name: string | null;
    clientName: string | null;
    address: string | null;
  }>;
  advisors: Array<{ id: string; fullName: string | null }>;
  equipment: Array<{
    id: string;
    costCenterId: string;
    internalCode: string | null;
    name: string | null;
  }>;
  pricing: PricingRules;
}

export async function getQuotationFormData(): Promise<QuotationFormOptions> {
  const [clientRows, costCenterRows, advisorRows, equipmentRows] = await Promise.all([
    db
      .select({ id: clients.id, legalName: clients.legalName, taxId: clients.taxId })
      .from(clients)
      .where(and(eq(clients.status, "ACTIVE"), isNull(clients.deletedAt)))
      .orderBy(asc(clients.legalName)),
    db
      .select({
        id: costCenters.id,
        clientId: costCenters.clientId,
        name: costCenters.name,
        clientName: clients.legalName,
        address: costCenters.address,
      })
      .from(costCenters)
      .innerJoin(clients, eq(costCenters.clientId, clients.id))
      .where(and(isNull(costCenters.deletedAt), isNull(clients.deletedAt)))
      .orderBy(asc(costCenters.name)),
    db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(eq(users.status, "ACTIVE"))
      .orderBy(asc(users.fullName)),
    db
      .select({
        id: elevatorUnities.id,
        costCenterId: elevatorUnities.costCenterId,
        internalCode: elevatorUnities.internalCode,
        name: elevatorUnities.name,
      })
      .from(elevatorUnities)
      .where(isNull(elevatorUnities.deletedAt))
      .orderBy(asc(elevatorUnities.internalCode)),
  ]);

  return {
    clients: clientRows,
    costCenters: costCenterRows.map((c) => ({
      id: c.id,
      clientId: c.clientId,
      name: c.name,
      clientName: c.clientName,
      address: c.address,
    })),
    advisors: advisorRows,
    equipment: equipmentRows,
    pricing: await getPricingConfig(),
  };
}

// ==========================================
// CREAR / ACTUALIZAR / ELIMINAR
// ==========================================

async function resolveAdvisorId(value: string | null | undefined): Promise<string | null> {
  const trimmed = (value ?? "").trim();
  if (trimmed) return trimmed;
  try {
    return await getSessionUserId();
  } catch {
    return null;
  }
}

async function buildQuotationData(validated: QuotationFormValues, hourlyCostOverride?: number) {
  const rules = await getPricingConfig();
  const hourlyCost =
    typeof hourlyCostOverride === "number" ? hourlyCostOverride : await getLaborConfig();

  const lines = validated.lines.map((l, i) => {
    const lineHourlyCost = Number(l.hourlyCost) || 0;
    const calc = calculateQuotationLine(
      {
        totalHours: Number(l.totalHours),
        hourlyCost: lineHourlyCost,
        lineMode: l.lineMode,
        manualPrice: Number(l.manualPrice) || null,
        manualPriceIncludesIgv: l.manualPriceIncludesIgv ?? true,
        supplierName: l.supplierName || null,
        supplierCost: Number(l.supplierCost) || null,
        lineOverridePrice: l.overridePrice ? Number(l.lineOverridePrice) || null : null,
        products: l.products.map((p) => ({
          quantity: Number(p.quantity),
          unitCost: Number(p.unitCost),
        })),
      },
      lineHourlyCost,
      rules
    );

    return {
      elevatorUnityId: l.elevatorUnityId || null,
      description: l.description,
      orderIndex: i,
      lineMode: calc.lineMode,
      isPassthrough: calc.isPassthrough,
      lineModeReason: l.lineModeReason?.trim() || null,
      manualPrice: calc.manualPrice,
      manualPriceIncludesIgv: calc.manualPriceIncludesIgv,
      supplierName: l.supplierName?.trim() || null,
      supplierCost: calc.supplierCost || null,
      lineOverridePrice:
        l.overridePrice && Number(l.lineOverridePrice) > 0
          ? round2(Number(l.lineOverridePrice))
          : null,
      lineOverrideReason: l.lineOverrideReason?.trim() || null,
      totalHours: Number(l.totalHours),
      hourlyCost: calc.hourlyCostUsed,
      laborCost: calc.laborCost,
      productCost: calc.productCost,
      subtotal: calc.subtotal,
      overheadRate: calc.overheadRate,
      overheadAmount: calc.overheadAmount,
      totalCost: calc.totalCost,
      commissionRate: calc.commissionRate,
      commissionAmount: calc.commissionAmount,
      profitRate: calc.profitRate,
      profitAmount: calc.profitAmount,
      clientValue: calc.clientValue,
      igv: calc.igv,
      clientPrice: calc.clientPrice,
      products:
        l.lineMode === "MANUAL_PRICE"
          ? []
          : l.products.map((p, j) => ({
              description: p.description,
              quantity: Number(p.quantity),
              unit: p.unit || null,
              unitCost: Number(p.unitCost),
              totalCost: round2(Number(p.quantity) * Number(p.unitCost)),
              orderIndex: j,
            })),
    };
  });

  const header = calculateQuotationHeader(
    lines.map((l) => ({ clientValue: l.clientValue })),
    {
      discountMode: validated.discountMode,
      discountRate: Number(validated.discountRate) || 0,
      discountAmount: Number(validated.discountAmount) || 0,
      targetTotal: Number(validated.targetTotal) || null,
      targetTotalIncludesIgv: validated.targetTotalIncludesIgv,
      igvRate: rules.igvRate,
    },
    rules
  );

  return {
    clientId: validated.clientId,
    costCenterId: validated.costCenterId || null,
    advisorId: validated.advisorId || undefined,
    issueDate: toTimestamp(validated.issueDate),
    validUntil: toTimestamp(validated.validUntil),
    status: validated.status || "DRAFT",
    discountMode: header.discountMode,
    targetTotal:
      validated.discountMode === "FINAL" && Number(validated.targetTotal) > 0
        ? round2(Number(validated.targetTotal))
        : null,
    targetTotalIncludesIgv: validated.targetTotalIncludesIgv ?? true,
    discountRate: header.discountRate,
    subtotal: header.subtotal,
    discountAmount: header.discountAmount,
    taxableBase: header.taxableBase,
    igv: header.igv,
    total: header.total,
    notes: validated.notes || null,
    terms: validated.terms || null,
    configSnapshot: JSON.stringify({
      overheadRate: rules.overheadRateQuote,
      commissionRate: rules.commissionRate,
      profitRate: rules.profitRate,
      igvRate: rules.igvRate,
      hourlyCost,
      capturedAt: Math.floor(Date.now() / 1000),
    }),
    lines,
  };
}

/**
 * Validaciones de línea en el servidor. El formulario ya las aplica con Zod,
 * pero se repiten aquí porque la cotización se recalcula y persiste en el
 * backend: nunca se confía en lo que envía el cliente.
 */
function validateLineRules(validated: QuotationFormValues): string | null {
  for (const [index, line] of validated.lines.entries()) {
    const n = index + 1;

    if (line.lineMode === "MANUAL_PRICE") {
      if (!(Number(line.manualPrice) > 0)) {
        return `Línea ${n}: falta el precio final.`;
      }
      const hasSupplierName = !!line.supplierName?.trim();
      const hasSupplierCost = Number(line.supplierCost) > 0;
      if (hasSupplierName || hasSupplierCost) {
        if (!hasSupplierName) return `Línea ${n}: falta el nombre del proveedor.`;
        if (!hasSupplierCost) return `Línea ${n}: falta el costo del proveedor.`;
      }
      continue;
    }

    const hasProducts = line.products.some(
      (p) => p.description.trim() !== "" && Number(p.unitCost) > 0
    );
    if (!(Number(line.totalHours) > 0) && !hasProducts) {
      return `Línea ${n}: la línea no tiene horas ni materiales.`;
    }
    if (line.overridePrice && !(Number(line.lineOverridePrice) > 0)) {
      return `Línea ${n}: falta el precio final del override.`;
    }
  }
  return null;
}

function validateDiscountRules(
  validated: QuotationFormValues,
  payload: Awaited<ReturnType<typeof buildQuotationData>>
): string | null {
  const subtotal = round2(payload.lines.reduce((sum, line) => sum + line.clientValue, 0));
  const snapshot = payload.configSnapshot
    ? (JSON.parse(payload.configSnapshot) as { igvRate?: number })
    : {};
  const igvRate = snapshot.igvRate ?? DEFAULT_PRICING_RULES.igvRate;
  const discountMode = validated.discountMode ?? "PERCENT";
  if (discountMode === "PERCENT") {
    const rate = Number(validated.discountRate) || 0;
    if (rate < 0 || rate > 100) return "El descuento debe estar entre 0% y 100%.";
  }
  if (discountMode === "AMOUNT") {
    const amount = Number(validated.discountAmount) || 0;
    if (amount > subtotal) return "El descuento no puede ser mayor al subtotal.";
  }
  if (discountMode === "FINAL") {
    const target = Number(validated.targetTotal) || 0;
    if (target <= 0) return "Ingresa el precio final.";
    const comparableTarget = validated.targetTotalIncludesIgv
      ? target
      : round2(target * (1 + igvRate));
    if (comparableTarget > round2(subtotal * (1 + igvRate))) {
      return "El precio final no puede ser mayor al subtotal con IGV.";
    }
  }
  return null;
}

export async function createQuotation(
  data: QuotationFormValues
): Promise<ActionResult> {
  try {
    const parsed = quotationFormSchema.parse({
      ...data,
      lines: stripBlankProducts(data.lines),
    });
    const validated = {
      ...parsed,
      advisorId: (await resolveAdvisorId(parsed.advisorId)) ?? undefined,
      status: "DRAFT",
    } as QuotationFormValues;
    const lineError = validateLineRules(validated);
    if (lineError) return { success: false, error: lineError };
    const payload = await buildQuotationData(validated);
    const discountError = validateDiscountRules(validated, payload);
    if (discountError) return { success: false, error: discountError };
    const quotationId = generateUuid();
    const quotationNumber = await nextQuotationNumber();

    const statements: SqliteBatchItem[] = [
      db.insert(quotations).values({
        id: quotationId,
        quotationNumber,
        clientId: payload.clientId,
        costCenterId: payload.costCenterId,
        advisorId: payload.advisorId,
        issueDate: payload.issueDate,
        validUntil: payload.validUntil,
        status: payload.status,
        discountMode: payload.discountMode,
        targetTotal: payload.targetTotal,
        targetTotalIncludesIgv: payload.targetTotalIncludesIgv,
        discountRate: payload.discountRate,
        subtotal: payload.subtotal,
        discountAmount: payload.discountAmount,
        taxableBase: payload.taxableBase,
        igv: payload.igv,
        total: payload.total,
        notes: payload.notes,
        terms: payload.terms,
        configSnapshot: payload.configSnapshot,
      }),
    ];

    for (const line of payload.lines) {
      const lineId = generateUuid();
      statements.push(
        db.insert(quotationLines).values({
          id: lineId,
          quotationId,
          elevatorUnityId: line.elevatorUnityId,
          description: line.description,
          orderIndex: line.orderIndex,
          lineMode: line.lineMode,
          lineModeReason: line.lineModeReason,
          manualPrice: line.manualPrice,
          manualPriceIncludesIgv: line.manualPriceIncludesIgv,
          supplierName: line.supplierName,
          supplierCost: line.supplierCost,
          lineOverridePrice: line.lineOverridePrice,
          lineOverrideReason: line.lineOverrideReason,
          totalHours: line.totalHours,
          hourlyCost: line.hourlyCost,
          laborCost: line.laborCost,
          productCost: line.productCost,
          subtotal: line.subtotal,
          overheadRate: line.overheadRate,
          overheadAmount: line.overheadAmount,
          totalCost: line.totalCost,
          commissionRate: line.commissionRate,
          commissionAmount: line.commissionAmount,
          profitRate: line.profitRate,
          profitAmount: line.profitAmount,
          clientValue: line.clientValue,
          igv: line.igv,
          clientPrice: line.clientPrice,
        })
      );
      for (const product of line.products) {
        statements.push(
          db.insert(quotationLineProducts).values({
            id: generateUuid(),
            quotationLineId: lineId,
            description: product.description,
            quantity: product.quantity,
            unit: product.unit,
            unitCost: product.unitCost,
            totalCost: product.totalCost,
            orderIndex: product.orderIndex,
          })
        );
      }
    }

    await db.batch(statements as unknown as [SqliteBatchItem, ...SqliteBatchItem[]]);
    revalidatePath("/quotations");
    return { success: true, message: `Cotización ${quotationNumber} creada` };
  } catch (error) {
    console.error("Error al crear cotización:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateQuotation(
  id: string,
  data: QuotationFormValues
): Promise<ActionResult> {
  try {
    const parsed = quotationFormSchema.parse({
      ...data,
      lines: stripBlankProducts(data.lines),
    });
    const validated = {
      ...parsed,
      advisorId: (await resolveAdvisorId(parsed.advisorId)) ?? undefined,
    } as QuotationFormValues;
    const lineError = validateLineRules(validated);
    if (lineError) return { success: false, error: lineError };
    const payload = await buildQuotationData(validated);
    const discountError = validateDiscountRules(validated, payload);
    if (discountError) return { success: false, error: discountError };

    const existing = await db
      .select({ id: quotations.id })
      .from(quotations)
      .where(eq(quotations.id, id))
      .limit(1);
    if (existing.length === 0) {
      return { success: false, error: "Cotización no encontrada." };
    }

    await db
      .update(quotations)
      .set({
        clientId: payload.clientId,
        costCenterId: payload.costCenterId,
        advisorId: payload.advisorId,
        issueDate: payload.issueDate,
        validUntil: payload.validUntil,
        status: payload.status,
        discountMode: payload.discountMode,
        targetTotal: payload.targetTotal,
        targetTotalIncludesIgv: payload.targetTotalIncludesIgv,
        discountRate: payload.discountRate,
        subtotal: payload.subtotal,
        discountAmount: payload.discountAmount,
        taxableBase: payload.taxableBase,
        igv: payload.igv,
        total: payload.total,
        notes: payload.notes,
        terms: payload.terms,
      })
      .where(eq(quotations.id, id));

    await db.delete(quotationLines).where(eq(quotationLines.quotationId, id));

    const statements: SqliteBatchItem[] = [];
    for (const line of payload.lines) {
      const lineId = generateUuid();
      statements.push(
        db.insert(quotationLines).values({
          id: lineId,
          quotationId: id,
          elevatorUnityId: line.elevatorUnityId,
          description: line.description,
          orderIndex: line.orderIndex,
          lineMode: line.lineMode,
          lineModeReason: line.lineModeReason,
          manualPrice: line.manualPrice,
          manualPriceIncludesIgv: line.manualPriceIncludesIgv,
          supplierName: line.supplierName,
          supplierCost: line.supplierCost,
          lineOverridePrice: line.lineOverridePrice,
          lineOverrideReason: line.lineOverrideReason,
          totalHours: line.totalHours,
          hourlyCost: line.hourlyCost,
          laborCost: line.laborCost,
          productCost: line.productCost,
          subtotal: line.subtotal,
          overheadRate: line.overheadRate,
          overheadAmount: line.overheadAmount,
          totalCost: line.totalCost,
          commissionRate: line.commissionRate,
          commissionAmount: line.commissionAmount,
          profitRate: line.profitRate,
          profitAmount: line.profitAmount,
          clientValue: line.clientValue,
          igv: line.igv,
          clientPrice: line.clientPrice,
        })
      );
      for (const product of line.products) {
        statements.push(
          db.insert(quotationLineProducts).values({
            id: generateUuid(),
            quotationLineId: lineId,
            description: product.description,
            quantity: product.quantity,
            unit: product.unit,
            unitCost: product.unitCost,
            totalCost: product.totalCost,
            orderIndex: product.orderIndex,
          })
        );
      }
    }

    await db.batch(statements as unknown as [SqliteBatchItem, ...SqliteBatchItem[]]);
    revalidatePath("/quotations");
    return { success: true, message: "Cotización actualizada" };
  } catch (error) {
    console.error("Error al actualizar cotización:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteQuotation(id: string): Promise<ActionResult> {
  try {
    await db.delete(quotations).where(eq(quotations.id, id));
    revalidatePath("/quotations");
    return { success: true, message: "Cotización eliminada" };
  } catch (error) {
    console.error("Error al eliminar cotización:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateQuotationStatus(
  id: string,
  status: string
): Promise<ActionResult> {
  try {
    await db.update(quotations).set({ status }).where(eq(quotations.id, id));
    revalidatePath("/quotations");
    return { success: true, message: "Estado actualizado" };
  } catch (error) {
    console.error("Error al actualizar estado:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ==========================================
// PORTAL DEL CLIENTE
// ==========================================

export type PortalQuotation = Pick<
  Quotation,
  "id" | "quotationNumber" | "issueDate" | "validUntil" | "status" | "total"
>;

export async function getQuotationsByCostCenter(
  costCenterId: string
): Promise<PortalQuotation[]> {
  try {
    const rows = await db
      .select({
        id: quotations.id,
        quotationNumber: quotations.quotationNumber,
        issueDate: quotations.issueDate,
        validUntil: quotations.validUntil,
        status: quotations.status,
        total: quotations.total,
      })
      .from(quotations)
      .where(eq(quotations.costCenterId, costCenterId))
      .orderBy(desc(quotations.createdAt));
    return rows;
  } catch (error) {
    console.error("Error al obtener cotizaciones del portal:", error);
    return [];
  }
}
