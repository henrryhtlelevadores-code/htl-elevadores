import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, serviceTypes, workOrders, workOrderServices, workOrderServiceTasks } from "@/db";
import { createWorkOrder, deleteWorkOrder, getServiceTypes } from "@/features/work-orders/actions";
import {
  createWorkOrderServiceTask,
  getWorkOrderServices,
  toggleWorkOrderServiceTask,
  updateWorkOrderServiceStatus,
} from "@/features/work-orders/services-actions";
import { parseServiceTasks, type WorkOrderFormValues } from "@/features/work-orders/schema";
import { getTechnicianWorkOrders } from "@/features/technician/server/queries";
import { createCostCenter, createUser, loginAs } from "./helpers/fixtures";

const id = () => randomUUID().toUpperCase();

async function serviceType(serviceScope: "ELEVATOR" | "GENERAL") {
  const typeId = id();
  await db.insert(serviceTypes).values({
    id: typeId,
    code: `S-${typeId.slice(0, 6)}`,
    name: `Servicio ${typeId.slice(0, 6)}`,
    category: "MANTENIMIENTO",
    serviceScope,
  });
  return typeId;
}

const orderForm = (
  costCenterId: string,
  serviceTypeId: string,
  overrides: Partial<WorkOrderFormValues> = {}
): WorkOrderFormValues => ({
  clientId: "",
  costCenterId,
  serviceTypeId,
  technicianId: "",
  priority: "NORMAL",
  scheduledDate: "2026-11-10",
  scheduledTime: "09:00",
  elevatorUnityIds: [],
  services: [],
  description: "",
  supportingTechnicians: "",
  estimatedDurationMins: 60,
  ...overrides,
});

async function orderIdsOf(costCenterId: string) {
  const rows = await db
    .select({ id: workOrders.id, estimatedEndAt: workOrders.estimatedEndAt })
    .from(workOrders)
    .where(eq(workOrders.costCenterId, costCenterId));
  return rows;
}

describe("tareas escritas una por línea", () => {
  it("ignora líneas vacías y quita viñetas o numeración", () => {
    expect(parseServiceTasks("- Barrer\n\n2. Trapear\n  • Vidrios  \n")).toEqual([
      "Barrer",
      "Trapear",
      "Vidrios",
    ]);
    expect(parseServiceTasks("")).toEqual([]);
  });
});

describe("OT de servicios generales", () => {
  let adminId = "";

  beforeEach(async () => {
    const admin = await createUser({
      permissions: ["work_orders:panel:read", "work_orders:panel:write"],
    });
    adminId = admin.id;
    await loginAs(admin.id);
  });

  it("los tipos de servicio informan si son de ascensores o generales", async () => {
    const general = await serviceType("GENERAL");
    const elevator = await serviceType("ELEVATOR");
    const options = await getServiceTypes();
    expect(options.find((o) => o.id === general)?.serviceScope).toBe("GENERAL");
    expect(options.find((o) => o.id === elevator)?.serviceScope).toBe("ELEVATOR");
  });

  it("se crea con sus servicios y tareas, sin equipos ni plantilla de seguridad", async () => {
    const center = await createCostCenter();
    const cleaning = await serviceType("GENERAL");
    const gardening = await serviceType("GENERAL");

    const result = await createWorkOrder(
      orderForm(center.id, cleaning, {
        services: [
          { serviceTypeId: "", locationDescription: "Baños piso 1", description: "Limpieza de baños", tasks: "Barrer\nTrapear" },
          { serviceTypeId: gardening, locationDescription: "", description: "Jardinería exterior", tasks: "" },
        ],
      })
    );
    expect(result.success).toBe(true);

    const [order] = await orderIdsOf(center.id);
    const services = (await getWorkOrderServices()).filter((s) => s.workOrderId === order.id);
    expect(services).toHaveLength(2);
    // Sin tipo propio, el servicio hereda el de la OT.
    expect(services[0]).toMatchObject({
      serviceTypeId: cleaning,
      locationDescription: "Baños piso 1",
      description: "Limpieza de baños",
      status: "PENDING",
    });
    expect(services[0].tasks.map((t) => t.taskDescription)).toEqual(["Barrer", "Trapear"]);
    expect(services[1]).toMatchObject({ serviceTypeId: gardening, locationDescription: null });
    expect(services[1].tasks).toHaveLength(0);
    // 2 servicios × 60 min desde las 09:00.
    expect(order.estimatedEndAt).not.toBeNull();
  });

  it("exige al menos un servicio y rechaza tipos que no son generales", async () => {
    const center = await createCostCenter();
    const general = await serviceType("GENERAL");
    const elevator = await serviceType("ELEVATOR");

    expect((await createWorkOrder(orderForm(center.id, general))).success).toBe(false);
    const mixed = await createWorkOrder(
      orderForm(center.id, general, {
        services: [{ serviceTypeId: elevator, locationDescription: "", description: "Limpieza", tasks: "" }],
      })
    );
    expect(mixed.success).toBe(false);
    expect(await orderIdsOf(center.id)).toHaveLength(0);
  });

  it("una OT de ascensores sigue exigiendo equipos", async () => {
    const center = await createCostCenter();
    const elevator = await serviceType("ELEVATOR");
    const result = await createWorkOrder(
      orderForm(center.id, elevator, { description: "Falla en puertas de cabina" })
    );
    expect(result).toMatchObject({ success: false, error: "Selecciona al menos un equipo." });
  });

  it("permite llevar el estado y las tareas de cada servicio", async () => {
    const center = await createCostCenter();
    const general = await serviceType("GENERAL");
    await createWorkOrder(
      orderForm(center.id, general, {
        services: [{ serviceTypeId: "", locationDescription: "", description: "Limpieza general", tasks: "Barrer" }],
      })
    );
    const [order] = await orderIdsOf(center.id);
    const [service] = (await getWorkOrderServices()).filter((s) => s.workOrderId === order.id);

    expect((await updateWorkOrderServiceStatus(service.id, "COMPLETED")).success).toBe(true);
    expect((await updateWorkOrderServiceStatus(service.id, "OTRO")).success).toBe(false);
    const added = await createWorkOrderServiceTask(service.id, "Limpiar vidrios");
    expect(added.success).toBe(true);
    expect((await toggleWorkOrderServiceTask(service.tasks[0].id, true)).success).toBe(true);

    const [after] = (await getWorkOrderServices()).filter((s) => s.id === service.id);
    expect(after.status).toBe("COMPLETED");
    expect(after.completedAt).not.toBeNull();
    expect(after.tasks.map((t) => [t.taskDescription, t.isCompleted])).toEqual([
      ["Barrer", true],
      ["Limpiar vidrios", false],
    ]);

    // Una OT aprobada queda de solo lectura.
    await db.update(workOrders).set({ approvalStatus: "APPROVED" }).where(eq(workOrders.id, order.id));
    expect((await createWorkOrderServiceTask(service.id, "Otra tarea")).success).toBe(false);
    expect((await updateWorkOrderServiceStatus(service.id, "PENDING")).success).toBe(false);
  });

  it("al eliminar la OT se eliminan sus servicios y tareas", async () => {
    const center = await createCostCenter();
    const general = await serviceType("GENERAL");
    await createWorkOrder(
      orderForm(center.id, general, {
        services: [{ serviceTypeId: "", locationDescription: "", description: "Limpieza general", tasks: "Barrer\nTrapear" }],
      })
    );
    const [order] = await orderIdsOf(center.id);
    const [service] = await db.select().from(workOrderServices).where(eq(workOrderServices.workOrderId, order.id));

    expect((await deleteWorkOrder(order.id)).success).toBe(true);
    expect(await db.select().from(workOrderServices).where(eq(workOrderServices.workOrderId, order.id))).toHaveLength(0);
    expect(
      await db.select().from(workOrderServiceTasks).where(eq(workOrderServiceTasks.workOrderServiceId, service.id))
    ).toHaveLength(0);
  });

  it("aún no aparece en la app del técnico", async () => {
    const center = await createCostCenter();
    const general = await serviceType("GENERAL");
    await createWorkOrder(
      orderForm(center.id, general, {
        technicianId: adminId,
        services: [{ serviceTypeId: "", locationDescription: "", description: "Limpieza general", tasks: "" }],
      })
    );
    const [order] = await orderIdsOf(center.id);
    const listed = await getTechnicianWorkOrders(adminId);
    expect(listed.some((wo) => wo.id === order.id)).toBe(false);
  });
});
