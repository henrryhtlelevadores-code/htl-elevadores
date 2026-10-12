import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, quotationLines, quotations, serviceTypes } from "@/db";
import {
  createQuotation,
  getQuotationFormData,
  getQuotations,
  issueQuotation,
  updateQuotation,
  updateQuotationHeader,
} from "@/features/quotations/actions";
import { calculateQuotationLine, DEFAULT_PRICING_RULES } from "@/features/quotations/calc";
import type { QuotationFormValues } from "@/features/quotations/schema";
import { randomUUID } from "node:crypto";
import { createCostCenter, createUser, loginAs } from "./helpers/fixtures";

const today = () => new Date().toISOString().slice(0, 10);

const header = (center: { id: string; clientId: string }) => ({
  clientId: center.clientId,
  costCenterId: center.id,
  advisorId: "",
  issueDate: today(),
  validUntil: today(),
  status: "DRAFT",
});

const emptyQuotation = (center: { id: string; clientId: string }): QuotationFormValues => ({
  ...header(center),
  discountMode: "PERCENT",
  discountRate: "0",
  discountAmount: "0",
  targetTotal: "",
  targetTotalIncludesIgv: true,
  showTaxBreakdown: true,
  lines: [],
});

const manualLine = (
  price: string,
  discount: Partial<Pick<QuotationFormValues["lines"][number], "discountMode" | "discountValue">> = {}
): QuotationFormValues["lines"][number] => ({
  elevatorUnityId: "",
  description: "Cambio de tarjeta",
  totalHours: "0",
  hourlyCost: "0",
  lineMode: "MANUAL_PRICE",
  lineModeReason: "Precio estandarizado",
  manualPrice: price,
  manualPriceIncludesIgv: true,
  supplierName: "",
  supplierCost: "",
  overridePrice: false,
  lineOverridePrice: "",
  lineOverrideReason: "",
  discountMode: "NONE",
  discountValue: "",
  products: [],
  ...discount,
});

describe("descuento por línea (cálculo)", () => {
  const line = { totalHours: 0, hourlyCost: 0, products: [], lineMode: "MANUAL_PRICE" as const };

  it("sin descuento no altera el precio", () => {
    const calc = calculateQuotationLine({ ...line, manualPrice: 1180 }, 0);
    expect(calc).toMatchObject({ listPrice: 1180, clientPrice: 1180, clientValue: 1000, discountAmount: 0 });
  });

  it("un precio manual con IGV incluido se conserva exacto", () => {
    for (const price of [100, 250, 999.99, 1180]) {
      const calc = calculateQuotationLine({ ...line, manualPrice: price }, 0);
      expect(calc.clientPrice).toBe(price);
      expect(Math.round((calc.clientValue + calc.igv) * 100) / 100).toBe(price);
    }
  });

  it("porcentaje y monto fijo se restan del precio con IGV", () => {
    const percent = calculateQuotationLine(
      { ...line, manualPrice: 1180, discountMode: "PERCENT", discountValue: 10 },
      0
    );
    expect(percent).toMatchObject({ listPrice: 1180, discountAmount: 118, clientPrice: 1062, clientValue: 900, igv: 162 });

    const amount = calculateQuotationLine(
      { ...line, manualPrice: 1180, discountMode: "AMOUNT", discountValue: 180 },
      0
    );
    expect(amount).toMatchObject({ discountAmount: 180, clientPrice: 1000 });
  });

  it("también aplica sobre líneas calculadas y nunca deja precio negativo", () => {
    const base = calculateQuotationLine({ totalHours: 10, hourlyCost: 50, products: [] }, 50, DEFAULT_PRICING_RULES);
    const discounted = calculateQuotationLine(
      { totalHours: 10, hourlyCost: 50, products: [], discountMode: "PERCENT", discountValue: 50 },
      50,
      DEFAULT_PRICING_RULES
    );
    expect(discounted.listPrice).toBe(base.clientPrice);
    expect(discounted.clientPrice).toBeCloseTo(base.clientPrice / 2, 2);

    const over = calculateQuotationLine(
      { ...line, manualPrice: 1180, discountMode: "AMOUNT", discountValue: 5000 },
      0
    );
    expect(over).toMatchObject({ discountAmount: 1180, clientPrice: 0 });
  });
});

describe("cotizaciones: líneas, descuento por línea y datos generales", () => {
  beforeEach(async () => {
    const user = await createUser({ permissions: ["quotations:read", "quotations:write"] });
    await loginAs(user.id);
  });

  it("se crea sin líneas y no se puede emitir hasta tener una", async () => {
    const center = await createCostCenter();
    const created = await createQuotation(emptyQuotation(center));
    expect(created.success).toBe(true);

    const lines = await db.select().from(quotationLines).where(eq(quotationLines.quotationId, created.id!));
    expect(lines).toHaveLength(0);

    const issued = await issueQuotation(created.id!);
    expect(issued.success).toBe(false);
  });

  it("guarda el descuento de una sola línea y lo refleja en el total", async () => {
    const center = await createCostCenter();
    const created = await createQuotation(emptyQuotation(center));

    const saved = await updateQuotation(created.id!, {
      ...emptyQuotation(center),
      lines: [manualLine("1180", { discountMode: "PERCENT", discountValue: "10" }), manualLine("590")],
    });
    expect(saved.success).toBe(true);

    const lines = await db
      .select()
      .from(quotationLines)
      .where(eq(quotationLines.quotationId, created.id!))
      .orderBy(quotationLines.orderIndex);
    expect(lines[0]).toMatchObject({
      lineDiscountMode: "PERCENT",
      lineDiscountValue: 10,
      lineDiscountAmount: 118,
      clientPrice: 1062,
      clientValue: 900,
    });
    expect(lines[1]).toMatchObject({ lineDiscountMode: null, lineDiscountAmount: 0, clientPrice: 590 });

    const [quotation] = await db.select().from(quotations).where(eq(quotations.id, created.id!));
    expect(quotation).toMatchObject({ subtotal: 1400, total: 1652 });
  });

  it("rechaza un descuento que deja la línea en cero o supera el 100%", async () => {
    const center = await createCostCenter();
    const created = await createQuotation(emptyQuotation(center));

    const zero = await updateQuotation(created.id!, {
      ...emptyQuotation(center),
      lines: [manualLine("1180", { discountMode: "AMOUNT", discountValue: "1180" })],
    });
    expect(zero.success).toBe(false);

    const over = await updateQuotation(created.id!, {
      ...emptyQuotation(center),
      lines: [manualLine("100", { discountMode: "PERCENT", discountValue: "120" })],
    });
    expect(over.success).toBe(false);
  });

  it("editar los datos generales conserva las líneas", async () => {
    const center = await createCostCenter();
    const created = await createQuotation(emptyQuotation(center));
    await updateQuotation(created.id!, { ...emptyQuotation(center), lines: [manualLine("590")] });

    const updated = await updateQuotationHeader(created.id!, { ...header(center), status: "SENT" });
    expect(updated.success).toBe(true);

    const [quotation] = await db.select().from(quotations).where(eq(quotations.id, created.id!));
    expect(quotation.status).toBe("SENT");
    const lines = await db.select().from(quotationLines).where(eq(quotationLines.quotationId, created.id!));
    expect(lines).toHaveLength(1);
  });

  const makeServiceType = (overrides: { price?: string | null; isActive?: boolean; showInQuotations?: boolean } = {}) => {
    const id = randomUUID().toUpperCase();
    return {
      id,
      code: `T-${id.slice(0, 6)}`,
      name: `Servicio ${id.slice(0, 6)}`,
      category: "MANTENIMIENTO",
      price: null,
      isActive: true,
      showInQuotations: true,
      ...overrides,
    };
  };

  it("el indicador de cotizaciones decide qué tipos de servicio se ofrecen; el precio es opcional", async () => {
    const priced = makeServiceType({ price: "350.50" });
    const unpriced = makeServiceType();
    const hidden = makeServiceType({ price: "80", showInQuotations: false });
    const inactive = makeServiceType({ isActive: false });
    await db.insert(serviceTypes).values([priced, unpriced, hidden, inactive]);

    const options = await getQuotationFormData();
    const find = (id: string) => options.serviceTypes.find((s) => s.id === id);
    expect(find(priced.id)).toMatchObject({ showInQuotations: true, price: 350.5 });
    expect(find(unpriced.id)).toMatchObject({ showInQuotations: true, price: null });
    expect(find(hidden.id)).toMatchObject({ showInQuotations: false });
    expect(find(inactive.id)).toBeUndefined();
  });

  it("guarda el tipo de servicio de cada línea y lo expone en el listado", async () => {
    const preventive = makeServiceType();
    const corrective = makeServiceType();
    await db.insert(serviceTypes).values([preventive, corrective]);
    const center = await createCostCenter();
    const created = await createQuotation(emptyQuotation(center));

    const saved = await updateQuotation(created.id!, {
      ...emptyQuotation(center),
      lines: [
        { ...manualLine("590"), serviceTypeId: preventive.id },
        { ...manualLine("590"), serviceTypeId: preventive.id },
        { ...manualLine("590"), serviceTypeId: corrective.id },
        manualLine("590"),
      ],
    });
    expect(saved.success).toBe(true);

    const lines = await db
      .select({ serviceTypeId: quotationLines.serviceTypeId })
      .from(quotationLines)
      .where(eq(quotationLines.quotationId, created.id!))
      .orderBy(quotationLines.orderIndex);
    expect(lines.map((l) => l.serviceTypeId)).toEqual([preventive.id, preventive.id, corrective.id, null]);

    const listed = (await getQuotations()).find((q) => q.id === created.id);
    expect(listed?.serviceTypes.map((s) => s.id).sort()).toEqual([preventive.id, corrective.id].sort());
  });
});
