import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  clients,
  contractElevators,
  contracts,
  costCenterContacts,
  costCenters,
  elevatorTypes,
  elevatorUnities,
  preventiveRoutes,
  preventiveRouteStops,
  quotations,
  serviceTypes,
  workOrderElevators,
  workOrders,
} from "@/db";
import {
  deleteClient,
  deleteCostCenter,
  previewClientRemoval,
  previewCostCenterRemoval,
} from "@/features/clients/actions";
import { getPortalSessionCostCenterId } from "@/features/portal/server";
import { resetRequest } from "./helpers/request";
import { createCostCenter, createQuotation, createUser, loginAs, loginPortal } from "./helpers/fixtures";

const id = () => randomUUID().toUpperCase();
const today = () => new Date().toISOString().slice(0, 10);
const daysFromToday = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

/** Sede con todo lo que una baja debe tocar o respetar. */
async function seedCostCenterWithHistory() {
  const center = await createCostCenter();
  await db.insert(costCenterContacts).values({ id: id(), costCenterId: center.id, fullName: "Ana Pérez" });

  const typeId = id();
  await db.insert(elevatorTypes).values({ id: typeId, name: `Tipo ${typeId.slice(0, 8)}` });
  const unityId = id();
  await db.insert(elevatorUnities).values({
    id: unityId,
    costCenterId: center.id,
    elevatorTypeId: typeId,
    internalCode: `ASC-${unityId.slice(0, 6)}`,
    name: "Ascensor 1",
  });

  const prevId = id();
  await db.insert(serviceTypes).values({ id: prevId, code: "PREV", name: "Preventivo", category: "X" });

  const contractId = id();
  await db.insert(contracts).values({
    id: contractId,
    contractNumber: `CON-${contractId.slice(0, 8)}`,
    costCenterId: center.id,
    serviceTypeId: prevId,
    startDate: Math.floor(Date.now() / 1000),
    baseAmount: 500,
  });
  const contractElevatorId = id();
  await db.insert(contractElevators).values({ id: contractElevatorId, contractId, elevatorUnityId: unityId, price: 500 });

  const technician = await createUser({ permissions: ["work_orders:field"] });
  const routeId = id();
  await db.insert(preventiveRoutes).values({ id: routeId, technicianId: technician.id, businessDayNumber: 1 });
  const stopId = id();
  await db.insert(preventiveRouteStops).values({ id: stopId, routeId, contractElevatorId, plannedTime: "09:00" });

  const workOrder = async (status: string, scheduledDate: string) => {
    const workOrderId = id();
    await db.insert(workOrders).values({
      id: workOrderId,
      otNumber: `OT-${workOrderId.slice(0, 8)}`,
      costCenterId: center.id,
      serviceTypeId: prevId,
      status,
      scheduledDate,
    });
    await db.insert(workOrderElevators).values({ id: id(), workOrderId, elevatorUnityId: unityId });
    return workOrderId;
  };
  const pendingWorkOrderId = await workOrder("PENDING", daysFromToday(10));
  const completedWorkOrderId = await workOrder("COMPLETED", daysFromToday(-10));
  const inProgressWorkOrderId = await workOrder("IN_PROGRESS", today());

  const draftQuotationId = await createQuotation(center, "DRAFT");
  const acceptedQuotationId = await createQuotation(center, "ACCEPTED");

  return {
    center,
    unityId,
    contractId,
    stopId,
    pendingWorkOrderId,
    completedWorkOrderId,
    inProgressWorkOrderId,
    draftQuotationId,
    acceptedQuotationId,
  };
}

async function one<T>(rows: Promise<T[]>): Promise<T | undefined> {
  return (await rows)[0];
}

beforeEach(async () => {
  resetRequest();
  const admin = await createUser({ permissions: ["clients"] });
  await loginAs(admin.id);
});

describe("baja de sedes", () => {
  it("borra de verdad una sede sin historial, con sus contactos", async () => {
    const center = await createCostCenter();
    await db.insert(costCenterContacts).values({ id: id(), costCenterId: center.id, fullName: "Ana Pérez" });

    const res = await deleteCostCenter(center.id);
    expect(res).toMatchObject({ success: true, removal: { mode: "deleted" } });
    expect(await one(db.select().from(costCenters).where(eq(costCenters.id, center.id)))).toBeUndefined();
    expect(await db.select().from(costCenterContacts).where(eq(costCenterContacts.costCenterId, center.id))).toHaveLength(0);
  });

  it("deshabilita una sede con historial y propaga la baja", async () => {
    const s = await seedCostCenterWithHistory();

    const res = await deleteCostCenter(s.center.id);
    expect(res).toMatchObject({
      success: true,
      removal: {
        mode: "disabled",
        equipment: 1,
        activeContracts: 1,
        pendingWorkOrders: 1,
        openQuotations: 1,
        hasPortal: true,
      },
    });

    const center = await one(db.select().from(costCenters).where(eq(costCenters.id, s.center.id)));
    expect(center?.deletedAt).not.toBeNull();
    expect(center?.passwordHash).toBeNull();
    expect(center?.portalSessionVersion).toBe(1);

    const unity = await one(db.select().from(elevatorUnities).where(eq(elevatorUnities.id, s.unityId)));
    expect(unity?.deletedAt).not.toBeNull();

    const contract = await one(db.select().from(contracts).where(eq(contracts.id, s.contractId)));
    expect(contract).toMatchObject({ status: "CANCELLED" });
    expect(contract?.deletedAt).not.toBeNull();
    expect(await db.select().from(preventiveRouteStops).where(eq(preventiveRouteStops.id, s.stopId))).toHaveLength(0);

    const status = async (workOrderId: string) =>
      one(db.select({ status: workOrders.status, deletedAt: workOrders.deletedAt }).from(workOrders).where(eq(workOrders.id, workOrderId)));
    expect((await status(s.pendingWorkOrderId))?.deletedAt).not.toBeNull();
    expect(await status(s.completedWorkOrderId)).toEqual({ status: "COMPLETED", deletedAt: null });
    expect(await status(s.inProgressWorkOrderId)).toEqual({ status: "IN_PROGRESS", deletedAt: null });

    const quote = async (quotationId: string) =>
      (await one(db.select({ status: quotations.status }).from(quotations).where(eq(quotations.id, quotationId))))?.status;
    expect(await quote(s.draftQuotationId)).toBe("INACTIVE");
    expect(await quote(s.acceptedQuotationId)).toBe("ACCEPTED");
  });

  it("cancela las OTs pendientes aunque no estén en un contrato", async () => {
    const center = await createCostCenter();
    const workOrderId = id();
    await db.insert(workOrders).values({ id: workOrderId, otNumber: `OT-${workOrderId.slice(0, 8)}`, costCenterId: center.id });

    await deleteCostCenter(center.id);
    const row = await one(db.select().from(workOrders).where(eq(workOrders.id, workOrderId)));
    expect(row?.status).toBe("CANCELLED");
    expect(row?.deletedAt).not.toBeNull();
  });

  it("cierra las sesiones abiertas del portal", async () => {
    const s = await seedCostCenterWithHistory();
    await loginPortal(s.center.id);
    expect(await getPortalSessionCostCenterId()).toBe(s.center.id);

    const admin = await createUser({ permissions: ["clients"] });
    await loginAs(admin.id);
    await deleteCostCenter(s.center.id);

    await loginPortal(s.center.id);
    // La sesión vieja quedó con la versión anterior; una nueva tampoco vale porque la sede está de baja.
    expect(await getPortalSessionCostCenterId()).toBeNull();
  });

  it("la vista previa informa sin cambiar nada", async () => {
    const s = await seedCostCenterWithHistory();
    const res = await previewCostCenterRemoval(s.center.id);
    expect(res).toMatchObject({ success: true, removal: { mode: "disabled", equipment: 1 } });

    const center = await one(db.select().from(costCenters).where(eq(costCenters.id, s.center.id)));
    expect(center?.deletedAt).toBeNull();
    expect(center?.passwordHash).not.toBeNull();
    expect((await one(db.select().from(contracts).where(eq(contracts.id, s.contractId))))?.status).toBe("ACTIVE");
  });

  it("exige permiso de escritura en clientes", async () => {
    const center = await createCostCenter();
    const reader = await createUser({ permissions: ["clients:read"] });
    await loginAs(reader.id);

    expect(await deleteCostCenter(center.id)).toMatchObject({ success: false });
    expect(await previewCostCenterRemoval(center.id)).toMatchObject({ success: false });
    expect(await one(db.select().from(costCenters).where(eq(costCenters.id, center.id)))).toBeDefined();
  });
});

describe("baja de clientes", () => {
  it("borra de verdad un cliente sin historial, con sus sedes", async () => {
    const center = await createCostCenter();
    const res = await deleteClient(center.clientId);
    expect(res).toMatchObject({ success: true, removal: { mode: "deleted", deletedCostCenters: 1 } });
    expect(await one(db.select().from(clients).where(eq(clients.id, center.clientId)))).toBeUndefined();
    expect(await one(db.select().from(costCenters).where(eq(costCenters.id, center.id)))).toBeUndefined();
  });

  it("con historial: deshabilita al cliente, borra sus sedes vacías y deshabilita las demás", async () => {
    const s = await seedCostCenterWithHistory();
    const emptyCenterId = id();
    await db.insert(costCenters).values({
      id: emptyCenterId,
      clientId: s.center.clientId,
      name: "Sede vacía",
      address: "Calle 1",
    });

    const preview = await previewClientRemoval(s.center.clientId);
    expect(preview).toMatchObject({ success: true, removal: { mode: "disabled" } });

    const res = await deleteClient(s.center.clientId);
    expect(res).toMatchObject({
      success: true,
      removal: { mode: "disabled", deletedCostCenters: 1, disabledCostCenters: 1, portalsRemoved: 1 },
    });

    expect((await one(db.select().from(clients).where(eq(clients.id, s.center.clientId))))?.deletedAt).not.toBeNull();
    expect(await one(db.select().from(costCenters).where(eq(costCenters.id, emptyCenterId)))).toBeUndefined();
    expect((await one(db.select().from(costCenters).where(eq(costCenters.id, s.center.id))))?.deletedAt).not.toBeNull();
  });

  it("limpia sedes que ya estaban dadas de baja y no tienen historial", async () => {
    const center = await createCostCenter();
    await db.update(costCenters).set({ deletedAt: 1 }).where(eq(costCenters.id, center.id));

    const res = await deleteClient(center.clientId);
    expect(res).toMatchObject({ success: true, removal: { mode: "deleted", deletedCostCenters: 1 } });
    expect(await one(db.select().from(costCenters).where(eq(costCenters.id, center.id)))).toBeUndefined();
  });
});
