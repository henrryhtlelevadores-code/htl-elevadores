import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  clients,
  costCenters,
  db,
  elevatorUnities,
  maintenanceModules,
  maintenanceTasks,
  serviceTypes,
  ubigeos,
  users,
  workOrderElevators,
  workOrderTasks,
  workOrders,
} from "@/db/index";

export type WorkOrderReportOrder = {
  otNumber: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  serviceTypeName: string | null;
  serviceTypeCode: string | null;
  technicianName: string | null;
  description: string | null;
  status: string;
  equipments: Array<{ internalCode: string; name: string }>;
};

export type WorkOrderReportModule = {
  code: string;
  name: string;
  tasks: string[];
};

export type WorkOrderReportEquipment = {
  internalCode: string;
  name: string;
  modules: WorkOrderReportModule[];
};

export type WorkOrderReportData = {
  logoUrl: string;
  generatedAt: string;
  clientName: string;
  clientTaxId: string | null;
  costCenterName: string;
  costCenterAddress: string | null;
  costCenterDistrict: string | null;
  orders: WorkOrderReportOrder[];
  annex: WorkOrderReportEquipment[];
};

const BRAND_LOGO_FALLBACK = "empresa/logohtlrojo.png";

function resolveLogoUrl(): string {
  const r2Url =
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? process.env.R2_PUBLIC_URL ?? "";
  const explicit =
    process.env.NEXT_PUBLIC_R2_LOGO_URL ?? process.env.R2_LOGO_URL ?? "";
  if (explicit) return explicit;
  if (!r2Url) return "";
  return `${r2Url.replace(/\/$/, "")}/${BRAND_LOGO_FALLBACK}`;
}

function isPreventive(order: {
  serviceTypeCode: string | null;
  serviceTypeName: string | null;
}) {
  const code = order.serviceTypeCode?.toUpperCase() ?? "";
  const name = order.serviceTypeName?.toLowerCase() ?? "";
  return code.includes("PREV") || name.includes("preventiv");
}

/**
 * Datos del reporte de OTs pendientes de una sede. El anexo agrupa, por equipo,
 * los módulos de mantenimiento y sus tareas tomados de las OTs preventivas.
 */
export async function buildWorkOrderReportData(
  costCenterId: string
): Promise<WorkOrderReportData | null> {
  const [center] = await db
    .select({
      name: costCenters.name,
      address: costCenters.address,
      district: ubigeos.distrito,
      clientName: clients.legalName,
      clientTaxId: clients.taxId,
    })
    .from(costCenters)
    .innerJoin(clients, eq(costCenters.clientId, clients.id))
    .leftJoin(ubigeos, eq(costCenters.ubigeoId, ubigeos.id))
    .where(and(eq(costCenters.id, costCenterId), isNull(costCenters.deletedAt)))
    .limit(1);

  if (!center) return null;

  const orderRows = await db
    .select({
      id: workOrders.id,
      otNumber: workOrders.otNumber,
      scheduledDate: workOrders.scheduledDate,
      scheduledTime: workOrders.scheduledTime,
      status: workOrders.status,
      description: workOrders.description,
      serviceTypeName: serviceTypes.name,
      serviceTypeCode: serviceTypes.code,
      technicianName: users.fullName,
    })
    .from(workOrders)
    .leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
    .leftJoin(users, eq(workOrders.technicianId, users.id))
    .where(
      and(
        eq(workOrders.costCenterId, costCenterId),
        isNull(workOrders.deletedAt),
        inArray(workOrders.status, ["PENDING", "IN_PROGRESS"])
      )
    )
    .orderBy(
      asc(workOrders.scheduledDate),
      asc(workOrders.scheduledTime),
      asc(workOrders.otNumber)
    );

  const orderIds = orderRows.map((row) => row.id);
  const equipmentRows = orderIds.length
    ? await db
        .select({
          workOrderId: workOrderElevators.workOrderId,
          elevatorId: elevatorUnities.id,
          internalCode: elevatorUnities.internalCode,
          name: elevatorUnities.name,
        })
        .from(workOrderElevators)
        .innerJoin(
          elevatorUnities,
          eq(workOrderElevators.elevatorUnityId, elevatorUnities.id)
        )
        .where(inArray(workOrderElevators.workOrderId, orderIds))
        .orderBy(asc(elevatorUnities.internalCode))
    : [];

  const equipmentsByOrder = new Map<
    string,
    Array<{ internalCode: string; name: string }>
  >();
  for (const row of equipmentRows) {
    const list = equipmentsByOrder.get(row.workOrderId) ?? [];
    list.push({ internalCode: row.internalCode, name: row.name });
    equipmentsByOrder.set(row.workOrderId, list);
  }

  const orders: WorkOrderReportOrder[] = orderRows.map((row) => ({
    otNumber: row.otNumber,
    scheduledDate: row.scheduledDate,
    scheduledTime: row.scheduledTime,
    serviceTypeName: row.serviceTypeName,
    serviceTypeCode: row.serviceTypeCode,
    technicianName: row.technicianName,
    description: row.description,
    status: row.status ?? "PENDING",
    equipments: equipmentsByOrder.get(row.id) ?? [],
  }));

  const preventiveIds = orderRows
    .filter((row) => isPreventive(row))
    .map((row) => row.id);

  const annex = new Map<
    string,
    {
      internalCode: string;
      name: string;
      modules: Map<string, WorkOrderReportModule>;
    }
  >();

  if (preventiveIds.length > 0) {
    const taskRows = await db
      .select({
        elevatorId: elevatorUnities.id,
        internalCode: elevatorUnities.internalCode,
        elevatorName: elevatorUnities.name,
        moduleId: maintenanceModules.id,
        moduleCode: maintenanceModules.code,
        moduleName: maintenanceModules.name,
        taskDescription: workOrderTasks.taskDescription,
        taskOrder: maintenanceTasks.orderIndex,
      })
      .from(workOrderTasks)
      .innerJoin(
        workOrderElevators,
        eq(workOrderTasks.workOrderElevatorId, workOrderElevators.id)
      )
      .innerJoin(
        elevatorUnities,
        eq(workOrderElevators.elevatorUnityId, elevatorUnities.id)
      )
      .leftJoin(
        maintenanceModules,
        eq(workOrderTasks.moduleId, maintenanceModules.id)
      )
      .leftJoin(
        maintenanceTasks,
        eq(workOrderTasks.maintenanceTaskId, maintenanceTasks.id)
      )
      .where(inArray(workOrderElevators.workOrderId, preventiveIds))
      .orderBy(
        asc(elevatorUnities.internalCode),
        asc(maintenanceModules.code),
        asc(maintenanceTasks.orderIndex)
      );

    for (const row of taskRows) {
      const equipment = annex.get(row.elevatorId) ?? {
        internalCode: row.internalCode,
        name: row.elevatorName,
        modules: new Map<string, WorkOrderReportModule>(),
      };
      const moduleKey = row.moduleId ?? "no-module";
      const moduleGroup = equipment.modules.get(moduleKey) ?? {
        code: row.moduleCode ?? "—",
        name: row.moduleName ?? "Sin módulo de mantenimiento",
        tasks: [],
      };
      const task = row.taskDescription?.trim();
      if (task && !moduleGroup.tasks.includes(task)) moduleGroup.tasks.push(task);
      equipment.modules.set(moduleKey, moduleGroup);
      annex.set(row.elevatorId, equipment);
    }
  }

  const annexList: WorkOrderReportEquipment[] = [...annex.values()]
    .map((equipment) => ({
      internalCode: equipment.internalCode,
      name: equipment.name,
      modules: [...equipment.modules.values()].sort((a, b) =>
        a.code.localeCompare(b.code, "es", { numeric: true })
      ),
    }))
    .filter((equipment) => equipment.modules.length > 0)
    .sort((a, b) =>
      a.internalCode.localeCompare(b.internalCode, "es", { numeric: true })
    );

  return {
    logoUrl: resolveLogoUrl(),
    generatedAt: new Date().toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    clientName: center.clientName,
    clientTaxId: center.clientTaxId,
    costCenterName: center.name,
    costCenterAddress: center.address,
    costCenterDistrict: center.district,
    orders,
    annex: annexList,
  };
}
